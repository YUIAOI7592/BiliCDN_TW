// Recover the Bilibili DASH failure where the wrapper keeps its playback
// state but loses the underlying video core. Long-pause recovery is armed by
// a trusted media play call; verified route failure recovery is armed only
// after the affected representation group has a different legal fallback.
export function createVideoCoreRecovery(deps) {
const MIN_PAUSE_MS = 30 * 1000
const TRUSTED_STRONG_WAIT_MS = 4 * 1000
const STRONG_WAIT_MS = 10 * 1000
const WEAK_WAIT_MS = 15 * 1000
const RELOAD_TIMEOUT_MS = 15 * 1000
const RELOAD_COOLDOWN_MS = 90 * 1000
const MAX_RELOADS_PER_GENERATION = 2

let generation = -1
let video = null
let lastPlayback = null
let previouslyPaused = null
let pauseStartedAt = 0
let pauseArmedRecorded = false
let hadHealthyVideo = false
let lastStablePosition = 0
let lastStableRate = 2
let resumeToken = 0
let resume = null
let state = 'healthy'
let reloadCount = 0
let lastReloadAt = 0
let breakerUntil = 0
let foregroundAt = 0
let hookState = 'not-installed'
let hookedMedia = null
let hookedPlayer = null
let hookedPlay = null
let originalPlay = null
let originalPlayOwnDescriptor = null
let playHookFailureRecorded = false
let internalPlayDepth = 0
let intentSource = 'none'
let userActivationAccepted = false
let postReloadPlayOutcome = 'not-called'

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
    const routeFailure = resume?.routeFailure || null
    const actionId = extra.actionId || routeFailure?.actionId
    deps.DiagnosticLog.record('video-core', {
        stage, resumeToken, reloadCount, breakerSec: Math.max(0, Math.ceil((breakerUntil - now()) / 1000)),
        actionId, groupOrdinal: routeFailure?.groupOrdinal, routeRevision: routeFailure?.revision,
        routeType: routeFailure?.fallbackType, ...extra,
    }, true)
    const routeStage = ({ 'route-failure-armed': 'core-waiting', reloading: 'reload-requested',
        recovered: 'core-recovered', 'recovered-paused': 'core-recovered',
        'reload-failed': 'reload-failed' })[stage]
    if (actionId && routeStage) deps.DiagnosticLog.record('route', {
        stage: routeStage, actionId, reason: extra.reason || stage,
        kind: routeFailure?.kind, failedHost: routeFailure?.failedHost,
        fallbackHost: routeFailure?.fallbackHost, fallbackType: routeFailure?.fallbackType,
        routeType: routeFailure?.fallbackType, routeRevision: routeFailure?.revision,
        groupOrdinal: routeFailure?.groupOrdinal,
        waitingForRetry: !['core-recovered', 'reload-failed'].includes(routeStage),
    }, true)
}
const safePlayerCall = (player, name, ...args) => {
    const fn = player?.[name]
    return typeof fn === 'function' ? fn.apply(player, args) : undefined
}
const readPlayerNumber = (player, name) => {
    try { return bounded(safePlayerCall(player, name)) } catch { return null }
}
const readUserActivation = () => {
    try { return deps.isUserActivationActive?.() === true } catch { return false }
}
const captureResumeValues = (player, playback = lastPlayback) => {
    const playerTime = readPlayerNumber(player, 'getCurrentTime')
    const playerRate = readPlayerNumber(player, 'getPlaybackRate')
    const playbackTime = bounded(playback?.currentTime)
    const playbackRate = bounded(playback?.effectiveRate)
    return {
        currentTime: Math.max(0, playerTime ?? (lastStablePosition > 0 ? lastStablePosition : playbackTime) ?? 0),
        rate: playerRate > 0 ? playerRate : playbackRate > 0 ? playbackRate : lastStableRate > 0 ? lastStableRate : 2,
    }
}
const uninstallPlayHook = () => {
    const media = hookedMedia, wrapped = hookedPlay, original = originalPlay
    const ownDescriptor = originalPlayOwnDescriptor
    hookedMedia = null
    hookedPlayer = null
    hookedPlay = null
    originalPlay = null
    originalPlayOwnDescriptor = null
    if (media && wrapped) {
        try {
            if (media.play === wrapped) {
                if (ownDescriptor) Object.defineProperty(media, 'play', ownDescriptor)
                else delete media.play
                if (media.play === wrapped && original) Reflect.set(media, 'play', original, media)
            }
        } catch {
            try { if (media.play === wrapped && original) Reflect.set(media, 'play', original, media) } catch {}
        }
    }
    if (hookState === 'installed') hookState = 'not-installed'
}
const beginResume = (playback, snapshots, source, values) => {
    const t = now()
    resumeToken++
    intentSource = source
    postReloadPlayOutcome = 'not-called'
    resume = {
        token: resumeToken, generation: deps.runtimeGeneration, startedAt: t, deadSince: 0,
        currentTime: Math.max(0, bounded(values?.currentTime) ?? bounded(playback?.currentTime) ?? 0),
        rate: bounded(values?.rate) > 0 ? values.rate : bounded(playback?.effectiveRate) > 0 ? playback.effectiveRate : 2,
        videoBaseline: snapshots.video ? { ...snapshots.video } : null,
        audioBaseline: snapshots.audio ? { ...snapshots.audio } : null,
        frameBaseline: frameCount(), reloadAttempted: false, reloadStartedAt: 0,
        playRequested: false, wasPlaying: true, intentSource: source,
        sawDeadShape: false, routeFailure: null,
    }
    state = source === 'trusted-media-play' ? 'play-intent' : 'waiting-metadata'
    record(state, { intentSource: source, userActivationAccepted, currentTime: resume.currentTime,
        effectiveRate: resume.rate })
}
const armTransportFailure = details => {
    const t = now(), playback = lastPlayback
    const fallback = details?.fallback
    if (resume || !hadHealthyVideo || !playback?.available || !playback.valid || playback.paused
        || playback.seeking || playback.ended || playback.errorCode
        || details?.generation !== deps.runtimeGeneration || details?.epoch !== deps.playinfoEpoch
        || !['video','audio'].includes(details?.kind) || typeof details?.groupId !== 'string'
        || !details.groupId || typeof details?.failedHost !== 'string' || !details.failedHost
        || !fallback || !['catalog-generated','native-signed'].includes(fallback.type)
        || typeof fallback.host !== 'string' || !fallback.host || fallback.host === details.failedHost
        || !Number.isSafeInteger(details?.revision) || details.revision < 0) return false
    if (reloadCount >= MAX_RELOADS_PER_GENERATION || t < breakerUntil
        || (lastReloadAt && t - lastReloadAt < RELOAD_COOLDOWN_MS)) return false
    userActivationAccepted = false
    beginResume(playback, mediaSnapshot(), 'verified-route-failure', captureResumeValues(deps.getPlayer(), playback))
    resume.routeFailure = {
        kind: details.kind, failedHost: details.failedHost, groupId: details.groupId,
        fallbackType: fallback.type, fallbackHost: fallback.host,
        epoch: details.epoch, revision: details.revision, actionId: details.actionId,
        groupOrdinal: deps.DiagnosticLog.groupOrdinal?.(details.groupId) || null,
    }
    record('route-failure-armed', {
        kind: details.kind, failedHost: details.failedHost, fallbackType: fallback.type,
        fallbackHost: fallback.host, routeRevision: details.revision,
    })
    return true
}
const noteTrustedPlayIntent = (player, values) => {
    userActivationAccepted = true
    if (resume) return
    const t = now(), playback = lastPlayback
    const pausedFor = pauseStartedAt ? t - pauseStartedAt : 0
    if (!hadHealthyVideo || pausedFor < MIN_PAUSE_MS || !playback?.available || !playback.valid
        || playback.seeking || playback.ended || playback.errorCode) return
    if (reloadCount >= MAX_RELOADS_PER_GENERATION || t < breakerUntil
        || (lastReloadAt && t - lastReloadAt < RELOAD_COOLDOWN_MS)) {
        state = 'breaker'
        record('breaker', { reason: 'cooldown', userActivationAccepted: true })
        return
    }
    beginResume(playback, mediaSnapshot(), 'trusted-media-play', values)
}
const installPlayHook = (media, player) => {
    if (!media || typeof media.play !== 'function') return false
    if (hookedMedia === media && hookedPlayer === player && media.play === hookedPlay) {
        hookState = 'installed'
        return true
    }
    if (hookedMedia || hookedPlay) uninstallPlayHook()
    const original = media.play
    const ownDescriptor = (() => { try { return Object.getOwnPropertyDescriptor(media, 'play') || null } catch { return null } })()
    let wrapped
    try {
        wrapped = new Proxy(original, {
            apply(target, thisArg, args) {
                const accepted = internalPlayDepth === 0 && readUserActivation()
                const values = accepted ? captureResumeValues(player) : null
                try { return Reflect.apply(target, thisArg, args) }
                finally { if (accepted) noteTrustedPlayIntent(player, values) }
            },
        })
        if (!Reflect.set(media, 'play', wrapped, media) || media.play !== wrapped) throw Error('play-not-writable')
    } catch {
        hookState = 'unavailable'
        if (!playHookFailureRecorded) {
            playHookFailureRecorded = true
            state = 'hook-unavailable'
            record('hook-unavailable', { reason: 'unavailable' })
        }
        return false
    }
    hookedMedia = media
    hookedPlayer = player
    hookedPlay = wrapped
    originalPlay = original
    originalPlayOwnDescriptor = ownDescriptor
    hookState = 'installed'
    return true
}
const clearResume = (nextState = 'healthy') => {
    resume = null
    intentSource = 'none'
    state = nextState
    uninstallPlayHook()
}
const reset = () => {
    uninstallPlayHook()
    generation = deps.runtimeGeneration
    video = null
    lastPlayback = null
    previouslyPaused = null
    pauseStartedAt = 0
    pauseArmedRecorded = false
    hadHealthyVideo = false
    lastStablePosition = 0
    lastStableRate = 2
    resumeToken = 0
    resume = null
    state = 'healthy'
    reloadCount = 0
    lastReloadAt = 0
    breakerUntil = 0
    foregroundAt = 0
    hookState = 'not-installed'
    playHookFailureRecorded = false
    internalPlayDepth = 0
    intentSource = 'none'
    userActivationAccepted = false
    postReloadPlayOutcome = 'not-called'
}
const fail = reason => {
    if (!resume) return
    state = reason === 'breaker' ? 'breaker' : 'reload-failed'
    breakerUntil = Math.max(breakerUntil, now() + RELOAD_COOLDOWN_MS)
    record(state, { reason })
    resume = null
    intentSource = 'none'
    uninstallPlayHook()
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
    state = 'recovered'
    const token = pending.token, tokenGeneration = pending.generation
    record('recovered', { currentTime: target, effectiveRate: pending.rate, intentSource: pending.intentSource })
    if (pending.wasPlaying && !pending.playRequested) {
        pending.playRequested = true
        postReloadPlayOutcome = 'pending'
        try {
            internalPlayDepth++
            const result = safePlayerCall(player, 'play')
            internalPlayDepth--
            if (result && typeof result.then === 'function') {
                Promise.resolve(result).then(() => {
                    if (tokenGeneration === deps.runtimeGeneration && resumeToken === token) postReloadPlayOutcome = 'resolved'
                }, () => {
                    if (tokenGeneration !== deps.runtimeGeneration || resumeToken !== token) return
                    postReloadPlayOutcome = 'rejected'
                    state = 'recovered-paused'
                    record('recovered-paused', { reason: 'rejected', currentTime: target, effectiveRate: pending.rate })
                })
            } else postReloadPlayOutcome = 'resolved'
        } catch {
            internalPlayDepth = Math.max(0, internalPlayDepth - 1)
            postReloadPlayOutcome = 'rejected'
            state = 'recovered-paused'
            record('recovered-paused', { reason: 'rejected', currentTime: target, effectiveRate: pending.rate })
        }
    }
    resume = null
    uninstallPlayHook()
    return true
}
const startReload = liveness => {
    const t = now()
    if (!resume || resume.reloadAttempted) return
    if (reloadCount >= MAX_RELOADS_PER_GENERATION || t < breakerUntil || (lastReloadAt && t - lastReloadAt < RELOAD_COOLDOWN_MS)) {
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
    reloadCount++
    lastReloadAt = t
    state = 'reloading'
    uninstallPlayHook()
    record('reloading', { coreInitialized: liveness.coreInitialized, currentTime: resume.currentTime,
        effectiveRate: resume.rate, intentSource: resume.intentSource })
    try {
        const result = safePlayerCall(player, 'reload')
        if (result && typeof result.catch === 'function') result.catch(() => fail('failed'))
    } catch { fail('failed') }
}
const tick = (currentVideo, playback) => {
    if (generation !== deps.runtimeGeneration) reset()
    const t = now(), snapshots = mediaSnapshot(), frames = frameCount()
    const dimensionsReady = !!currentVideo && Number(currentVideo.videoWidth) > 0 && Number(currentVideo.videoHeight) > 0
    const videoEvidence = dimensionsReady || (playback?.readyState >= 2)
        || (snapshots.video?.fresh && snapshots.video.bytes > 0) || (frames !== null && frames > 0)
    if (videoEvidence) hadHealthyVideo = true
    if (dimensionsReady && playback?.readyState >= 1) {
        const position = bounded(playback.currentTime), rate = bounded(playback.effectiveRate)
        if (position !== null) lastStablePosition = Math.max(0, position)
        if (rate > 0) lastStableRate = rate
    }
    lastPlayback = playback && typeof playback === 'object' ? { ...playback } : null

    if (!currentVideo || !playback?.available || !playback.valid) {
        if (!resume?.reloadAttempted) clearResume('healthy')
        video = currentVideo || null
        previouslyPaused = null
        return
    }
    if (currentVideo !== video && !resume?.reloadAttempted) {
        clearResume('healthy')
        video = currentVideo
        previouslyPaused = playback.paused
        pauseStartedAt = playback.paused ? t : 0
        pauseArmedRecorded = false
        return
    }
    video = currentVideo

    if (playback.paused && !resume) {
        if (previouslyPaused !== true) {
            pauseStartedAt = t
            pauseArmedRecorded = false
            userActivationAccepted = false
            intentSource = 'none'
            postReloadPlayOutcome = 'not-called'
        }
        previouslyPaused = true
        if (hadHealthyVideo && !playback.seeking && !playback.ended && !playback.errorCode
            && reloadCount < MAX_RELOADS_PER_GENERATION && t >= breakerUntil) {
            const installed = installPlayHook(currentVideo, deps.getPlayer())
            const pausedFor = pauseStartedAt ? t - pauseStartedAt : 0
            if (installed && pausedFor >= MIN_PAUSE_MS && !pauseArmedRecorded) {
                pauseArmedRecorded = true
                state = 'pause-armed'
                record('pause-armed', { pauseSec: Math.floor(pausedFor / 1000), playHookState: hookState })
            }
        } else {
            uninstallPlayHook()
            if (state === 'pause-armed' || state === 'hook-unavailable') state = 'healthy'
        }
        return
    }
    if (playback.paused && resume?.intentSource !== 'trusted-media-play') {
        clearResume('healthy')
        previouslyPaused = true
        return
    }
    if (!playback.paused && previouslyPaused === true && !resume) {
        const pausedFor = pauseStartedAt ? t - pauseStartedAt : 0
        if (pausedFor >= MIN_PAUSE_MS && hadHealthyVideo) {
            userActivationAccepted = false
            beginResume(playback, snapshots, 'paused-transition', captureResumeValues(deps.getPlayer(), playback))
        }
    }
    if (!playback.paused) previouslyPaused = false

    if (!resume) {
        uninstallPlayHook()
        return
    }
    if (resume.generation !== deps.runtimeGeneration || playback.seeking || playback.ended || playback.errorCode) {
        clearResume('healthy')
        return
    }
    const elapsed = t - (resume.reloadStartedAt || resume.startedAt)
    const videoAdvanced = mediaAdvanced(snapshots.video, resume.videoBaseline, t - resume.startedAt)
    const frameAdvanced = frames !== null && resume.frameBaseline !== null && frames > resume.frameBaseline
    const routeFailure = resume.intentSource === 'verified-route-failure'
    const positionAdvanced = Number.isFinite(playback.currentTime)
        && playback.currentTime > resume.currentTime + 0.05
    const metadataRecovered = playback.readyState >= 1 && dimensionsReady
        && (!routeFailure || resume.reloadAttempted || resume.sawDeadShape)
    if (metadataRecovered || videoAdvanced || frameAdvanced || (routeFailure && positionAdvanced)) {
        if (resume.reloadAttempted) restore(deps.getPlayer(), currentVideo)
        else clearResume('healthy')
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
    const fastStrong = strong && ['trusted-media-play','verified-route-failure'].includes(resume.intentSource)
    if (routeFailure && !strong) {
        resume.deadSince = 0
        state = 'waiting-metadata'
        return
    }
    const supportingEvidence = fastStrong ? true : strong
        ? audioAdvanced || playback.bufferAheadSec > 0 || stagnant
        : audioAdvanced
    const wait = fastStrong ? TRUSTED_STRONG_WAIT_MS : strong ? STRONG_WAIT_MS : WEAK_WAIT_MS
    if (deadShape) {
        resume.sawDeadShape = true
        if (!resume.deadSince) resume.deadSince = t
        state = 'waiting-metadata'
        if (supportingEvidence && t - resume.deadSince >= wait) {
            state = 'video-init-dead'
            record('video-init-dead', { coreInitialized: liveness.coreInitialized,
                waitMs: t - resume.deadSince, intentSource: resume.intentSource })
            startReload(liveness)
        }
    } else {
        resume.deadSince = 0
        state = 'waiting-metadata'
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
        playHookState: hookState, intentSource, userActivationAccepted,
        pauseSec: pauseStartedAt && previouslyPaused === true ? Math.max(0, Math.floor((t - pauseStartedAt) / 1000)) : 0,
        intentAgeSec: resume ? Math.max(0, Math.floor((t - resume.startedAt) / 1000)) : 0,
        savedPositionSec: resume ? resume.currentTime : null,
        savedRate: resume ? resume.rate : null,
        routeFailure: resume?.routeFailure ? {
            kind: resume.routeFailure.kind, failedHost: resume.routeFailure.failedHost,
            groupOrdinal: resume.routeFailure.groupOrdinal, fallbackType: resume.routeFailure.fallbackType,
            fallbackHost: resume.routeFailure.fallbackHost, routeRevision: resume.routeFailure.revision,
            actionId: resume.routeFailure.actionId || null,
            waitingForRetry: !resume.reloadAttempted,
        } : null,
        postReloadPlayOutcome,
    }
}

reset()
return { reset, tick, noteForeground, armTransportFailure, summary }
}
