// Recover the specific Bilibili DASH failure where audio keeps loading after a
// long pause but the video core never initializes again.  This state machine
// only observes the existing one-second playback cycle and performs at most one
// player-level reload for each resume token.
export function createVideoCoreRecovery(deps) {
const MIN_PAUSE_MS = 30 * 1000
const STRONG_WAIT_MS = 10 * 1000
const WEAK_WAIT_MS = 15 * 1000
const RELOAD_TIMEOUT_MS = 15 * 1000
const RELOAD_COOLDOWN_MS = 90 * 1000
const MAX_RELOADS_PER_GENERATION = 2

let generation = -1
let video = null
let previouslyPaused = null
let pauseStartedAt = 0
let hadHealthyVideo = false
let resumeToken = 0
let resume = null
let state = 'healthy'
let reloadCount = 0
let lastReloadAt = 0
let breakerUntil = 0
let foregroundAt = 0

const now = () => deps.now ? deps.now() : Date.now()
const bounded = value => Number.isFinite(+value) ? +value : null
const mediaSnapshot = () => {
    try { return deps.getMediaDeliverySnapshot() || {} } catch { return {} }
}
const frameCount = () => {
    try {
        const quality = deps.playbackQualitySnapshot
        return quality?.available && Number.isSafeInteger(quality.totalFrames) ? quality.totalFrames : null
    } catch { return null }
}
const coreLiveness = () => {
    try { return deps.inspectPlayerLiveness() || {} } catch { return {} }
}
const mediaAdvanced = (current, baseline, elapsedMs) => {
    if (!current?.fresh) return false
    if (!baseline) return current.ageSec != null && current.ageSec * 1000 <= elapsedMs + 1100
    if (current.host === baseline.host && current.source === baseline.source) return current.bytes > baseline.bytes
    return current.ageSec != null && current.ageSec * 1000 <= elapsedMs + 1100
}
const record = (stage, extra = {}) => {
    deps.DiagnosticLog.record('video-core', {
        stage, resumeToken, reloadCount, breakerSec: Math.max(0, Math.ceil((breakerUntil - now()) / 1000)), ...extra,
    }, true)
}
const reset = () => {
    generation = deps.runtimeGeneration
    video = null
    previouslyPaused = null
    pauseStartedAt = 0
    hadHealthyVideo = false
    resumeToken = 0
    resume = null
    state = 'healthy'
    reloadCount = 0
    lastReloadAt = 0
    breakerUntil = 0
    foregroundAt = 0
}
const fail = reason => {
    if (!resume) return
    state = reason === 'breaker' ? 'breaker' : 'reload-failed'
    breakerUntil = Math.max(breakerUntil, now() + RELOAD_COOLDOWN_MS)
    record(state, { reason })
    resume = null
}
const safePlayerCall = (player, name, ...args) => {
    try {
        const fn = player?.[name]
        return typeof fn === 'function' ? fn.apply(player, args) : undefined
    } catch (error) { throw error }
}
const restore = (player, currentVideo) => {
    const pending = resume
    if (!pending || pending.generation !== deps.runtimeGeneration) return false
    const duration = bounded(currentVideo?.duration)
    const target = duration && duration > 0
        ? Math.max(0, Math.min(pending.currentTime, Math.max(0, duration - 0.05)))
        : Math.max(0, pending.currentTime)
    try { safePlayerCall(player, 'seek', target) } catch {}
    try { safePlayerCall(player, 'setPlaybackRate', pending.rate) } catch {}
    if (pending.wasPlaying && !pending.playRequested) {
        pending.playRequested = true
        try {
            const result = safePlayerCall(player, 'play')
            if (result && typeof result.catch === 'function') result.catch(() => {})
        } catch {}
    }
    state = 'recovered'
    record('recovered', { currentTime: target, effectiveRate: pending.rate })
    resume = null
    return true
}
const startReload = (currentVideo, playback, liveness) => {
    const t = now()
    if (!resume || resume.reloadAttempted) return
    if (reloadCount >= MAX_RELOADS_PER_GENERATION || t < breakerUntil || t - lastReloadAt < RELOAD_COOLDOWN_MS) {
        fail('breaker')
        return
    }
    const player = deps.getPlayer()
    if (!player || typeof player.reload !== 'function') {
        fail('unavailable')
        return
    }
    resume.reloadAttempted = true
    resume.reloadStartedAt = t
    resume.currentTime = Math.max(0, bounded(playback.currentTime) || 0)
    resume.rate = bounded(playback.effectiveRate) > 0 ? playback.effectiveRate : 2
    resume.wasPlaying = playback.paused === false
    reloadCount++
    lastReloadAt = t
    state = 'reloading'
    let failedHost = null
    if (!deps.resolvedCdn) {
        try { failedHost = deps.getNativeRouteDiagnostics()?.currentHost || deps.getAttributedVideoHost?.() || null } catch {}
        try { deps.beginRouteRecovery('video-init-dead', failedHost, { temporaryMs: 2 * 60 * 1000 }) } catch {}
    }
    record('reloading', { coreInitialized: liveness.coreInitialized, currentTime: resume.currentTime,
        effectiveRate: resume.rate })
    try {
        const result = safePlayerCall(player, 'reload')
        if (result && typeof result.catch === 'function') result.catch(() => fail('failed'))
    } catch { fail('failed') }
}
const beginResume = (playback, snapshots) => {
    const t = now()
    resumeToken++
    resume = {
        token: resumeToken, generation: deps.runtimeGeneration, startedAt: t,
        currentTime: Math.max(0, bounded(playback.currentTime) || 0),
        rate: bounded(playback.effectiveRate) > 0 ? playback.effectiveRate : 2,
        videoBaseline: snapshots.video ? { ...snapshots.video } : null,
        audioBaseline: snapshots.audio ? { ...snapshots.audio } : null,
        frameBaseline: frameCount(), reloadAttempted: false, reloadStartedAt: 0,
        playRequested: false, wasPlaying: true,
    }
    state = 'waiting-metadata'
    record('waiting-metadata')
}
const tick = (currentVideo, playback) => {
    if (generation !== deps.runtimeGeneration) reset()
    const t = now()
    const snapshots = mediaSnapshot()
    const frames = frameCount()
    const dimensionsReady = !!currentVideo && Number(currentVideo.videoWidth) > 0 && Number(currentVideo.videoHeight) > 0
    const videoEvidence = dimensionsReady || (playback?.readyState >= 2)
        || (snapshots.video?.fresh && snapshots.video.bytes > 0) || (frames !== null && frames > 0)
    if (videoEvidence) hadHealthyVideo = true

    if (!currentVideo || !playback?.available || !playback.valid) {
        if (!resume?.reloadAttempted) { resume = null; state = 'healthy' }
        video = currentVideo || null
        previouslyPaused = null
        return
    }
    if (currentVideo !== video && !resume?.reloadAttempted) {
        video = currentVideo
        previouslyPaused = playback.paused
        pauseStartedAt = playback.paused ? t : 0
        return
    }
    video = currentVideo

    if (playback.paused) {
        if (previouslyPaused !== true) pauseStartedAt = t
        previouslyPaused = true
        if (!resume?.reloadAttempted) { resume = null; state = 'healthy' }
        return
    }
    if (previouslyPaused === true) {
        const pausedFor = pauseStartedAt ? t - pauseStartedAt : 0
        if (pausedFor >= MIN_PAUSE_MS && hadHealthyVideo) beginResume(playback, snapshots)
    }
    previouslyPaused = false

    if (!resume) return
    if (resume.generation !== deps.runtimeGeneration || playback.seeking || playback.ended || playback.errorCode) {
        resume = null; state = 'healthy'; return
    }
    const elapsed = t - (resume.reloadStartedAt || resume.startedAt)
    const videoAdvanced = mediaAdvanced(snapshots.video, resume.videoBaseline, t - resume.startedAt)
    const frameAdvanced = frames !== null && resume.frameBaseline !== null && frames > resume.frameBaseline
    const metadataRecovered = playback.readyState >= 1 && dimensionsReady
    if (metadataRecovered || videoAdvanced || frameAdvanced) {
        if (resume.reloadAttempted) restore(deps.getPlayer(), currentVideo)
        else { resume = null; state = 'healthy' }
        return
    }
    if (resume.reloadAttempted) {
        if (elapsed >= RELOAD_TIMEOUT_MS) fail('timeout')
        return
    }

    const liveness = coreLiveness()
    const audioAdvanced = mediaAdvanced(snapshots.audio, resume.audioBaseline, t - resume.startedAt)
    const stagnant = Math.abs((bounded(playback.currentTime) || 0) - resume.currentTime) <= 0.1
    const deadShape = playback.readyState === 0 && !dimensionsReady && liveness.videoGroups > 0
    const strong = liveness.coreInitialized === false
    // Without the explicit core.initialized=false signal, require continued
    // audio transport rather than inferring a dead video core from a merely
    // stagnant clock or an old buffered range.
    const supportingEvidence = strong
        ? audioAdvanced || playback.bufferAheadSec > 0 || stagnant
        : audioAdvanced
    const wait = strong ? STRONG_WAIT_MS : WEAK_WAIT_MS
    if (deadShape && supportingEvidence && t - resume.startedAt >= wait) {
        state = 'video-init-dead'
        record('video-init-dead', { coreInitialized: liveness.coreInitialized,
            waitMs: t - resume.startedAt })
        startReload(currentVideo, playback, liveness)
    }
}
const noteForeground = () => { foregroundAt = now() }
const summary = () => {
    const live = coreLiveness(), snapshots = mediaSnapshot(), t = now()
    return {
        state, coreInitialized: typeof live.coreInitialized === 'boolean' ? live.coreInitialized : null,
        coreRevision: Number.isSafeInteger(live.coreRevision) ? live.coreRevision : 0,
        videoGroups: Math.max(0, Number(live.videoGroups) || 0), audioGroups: Math.max(0, Number(live.audioGroups) || 0),
        resumeToken, reloadCount, waitingSec: resume ? Math.max(0, Math.round((t - resume.startedAt) / 1000)) : 0,
        videoAgeSec: snapshots.video?.ageSec ?? null, audioAgeSec: snapshots.audio?.ageSec ?? null,
        breakerSec: Math.max(0, Math.ceil((breakerUntil - t) / 1000)), foregroundAgeSec: foregroundAt ? Math.max(0, Math.round((t - foregroundAt) / 1000)) : null,
    }
}

reset()
return { reset, tick, noteForeground, summary }
}
