// Synchronize the current Bilibili player MPD into the ordinary route/representation
// pipeline.  This module only reads feature-detected player methods and clones a
// bounded allow-list of fields; it never mutates the player or starts networking.
export function createPlayerManifest(deps) {
const RETRY_DELAYS = [50, 100, 200, 400, 800, 1500]
const URL_MAX = 16 * 1024
const TOTAL_URL_CHARS_MAX = 1024 * 1024
const VIDEO_MAX = 128
const AUDIO_MAX = 64
const BOOTSTRAP_MAX = 16

let expectedKey = ''
let runtime = null
let timers = new Set()
let attempts = 0
let startedAt = 0
let lastCore = null
let previousAcceptedCore = null
let previousAcceptedKey = ''
let acceptedFingerprint = ''
let acceptedGeneration = -1
let adoptedAt = 0
let source = 'none'
let state = 'idle'
let reason = 'none'
let coreChanged = false
let videoGroups = 0
let audioGroups = 0
let transportBootstrapCount = 0
let lastReadAt = 0
let livenessCore = null
let coreRevision = 0
let coreInitialized = null

const safeGet = (object, names) => {
    if (!object) return undefined
    for (const name of names) {
        try {
            const value = object[name]
            if (value !== undefined && value !== null) return value
        } catch {}
    }
    return undefined
}
const safeCall = (object, name, ...args) => {
    try {
        const fn = object?.[name]
        return typeof fn === 'function' ? fn.apply(object, args) : undefined
    } catch { return undefined }
}
const finite = (value, max = Number.MAX_SAFE_INTEGER) => {
    const number = Number(value)
    return Number.isFinite(number) && number >= 0 && number <= max ? number : undefined
}
const text = (value, max = 256) => typeof value === 'string' && value.length <= max ? value : undefined
const normalizedUrl = value => {
    if (typeof value !== 'string' || !value || value.length > URL_MAX) return null
    try {
        const parsed = deps.parseMediaHttpUrl(value)
        return parsed && /^https?:$/.test(parsed.protocol) ? parsed.href : null
    } catch { return null }
}
const urlList = item => {
    const out = []
    const values = [safeGet(item, ['base_url', 'baseUrl', 'url'])]
    const backups = safeGet(item, ['backup_url', 'backupUrl'])
    if (Array.isArray(backups)) values.push(...backups.slice(0, 8))
    for (const value of values) {
        const url = normalizedUrl(value)
        if (url && !out.includes(url)) out.push(url)
        if (out.length >= 4) break
    }
    return out
}
const cloneRepresentation = (item, budget) => {
    if (!item || typeof item !== 'object') return null
    const urls = urlList(item)
    if (!urls.length) return null
    const chars = urls.reduce((sum, url) => sum + url.length, 0)
    if (budget.used + chars > TOTAL_URL_CHARS_MAX) return null
    budget.used += chars
    const clone = {
        base_url: urls[0], baseUrl: urls[0], backup_url: urls.slice(1), backupUrl: urls.slice(1),
    }
    const numeric = {
        id: finite(safeGet(item, ['id']), 1e9),
        quality: finite(safeGet(item, ['quality']), 1e9),
        codecid: finite(safeGet(item, ['codecid', 'codecId']), 1e9),
        width: finite(safeGet(item, ['width']), 100000),
        height: finite(safeGet(item, ['height']), 100000),
        bandwidth: finite(safeGet(item, ['bandwidth', 'bandWidth', 'bitrate']), 1e11),
    }
    const strings = {
        codecs: text(safeGet(item, ['codecs', 'codec']), 256),
        mimeType: text(safeGet(item, ['mimeType', 'mime_type']), 128),
        frameRate: text(String(safeGet(item, ['frameRate', 'frame_rate']) ?? ''), 64) || finite(safeGet(item, ['frameRate', 'frame_rate']), 1000),
    }
    for (const [key, value] of Object.entries({ ...numeric, ...strings })) if (value !== undefined && value !== '') clone[key] = value
    if (clone.frameRate !== undefined) clone.frame_rate = clone.frameRate
    return clone
}
const cloneList = (value, limit, budget) => (Array.isArray(value) ? value : [])
    .slice(0, limit).map(item => cloneRepresentation(item, budget)).filter(Boolean)

const cloneMpd = mpd => {
    if (!mpd || typeof mpd !== 'object') return null
    const budget = { used: 0 }
    const video = cloneList(safeGet(mpd, ['video']), VIDEO_MAX, budget)
    const audio = cloneList(safeGet(mpd, ['audio']), AUDIO_MAX, budget)
    const dolbyAudio = cloneList(safeGet(safeGet(mpd, ['dolby']), ['audio']), AUDIO_MAX, budget)
    const flacAudio = cloneList(safeGet(safeGet(mpd, ['flac']), ['audio']), AUDIO_MAX, budget)
    if (!video.length && !audio.length && !dolbyAudio.length && !flacAudio.length) return null
    const dash = { video, audio }
    if (dolbyAudio.length) dash.dolby = { audio: dolbyAudio }
    if (flacAudio.length) dash.flac = { audio: flacAudio }
    const minBufferTime = finite(safeGet(mpd, ['minBufferTime', 'min_buffer_time']), 60)
    if (minBufferTime !== undefined) dash.minBufferTime = minBufferTime
    return { payload: { code: 0, data: { dash } }, fingerprint: JSON.stringify(dash),
        videoGroups: video.length, audioGroups: audio.length + dolbyAudio.length + flacAudio.length }
}

const keyMatchesManifest = manifest => {
    if (!manifest || typeof manifest !== 'object' || !expectedKey) return false
    const [base, partValue] = expectedKey.toLowerCase().split('#p')
    const manifestBvid = String(safeGet(manifest, ['bvid', 'bvidStr']) || '').toLowerCase()
    const manifestAid = String(safeGet(manifest, ['aid', 'avid']) || '')
    let matched = false
    if (/^bv[0-9a-z]+$/i.test(base)) matched = manifestBvid === base
    else if (/^av\d+$/i.test(base)) matched = manifestAid && `av${manifestAid}` === base
    else if (/^(?:ep|ss)\d+$/i.test(base)) matched = finite(safeGet(manifest, ['cid']), Number.MAX_SAFE_INTEGER) > 0
    else matched = false
    if (!matched || !partValue) return matched
    const manifestPart = String(safeGet(manifest, ['p', 'page']) || '')
    return !manifestPart || manifestPart === partValue
}

const clearTimers = () => {
    for (const timer of timers) clearTimeout(timer)
    timers.clear()
}
const setState = (next, why = reason) => { state = next; reason = why }
const active = () => !!runtime && !deps.disabled && deps.isRuntimeGenerationActive(runtime)

const inspectLiveness = () => {
    if (!active()) return { coreInitialized: null, coreRevision, videoGroups, audioGroups, lastReadAt }
    const player = (() => { try { return unsafeWindow.player } catch { return null } })()
    const core = safeCall(player, '__core')
    if (core && core !== livenessCore) { livenessCore = core; coreRevision++ }
    let initialized = null
    try { if (typeof core?.state?.initialized === 'boolean') initialized = core.state.initialized } catch {}
    coreInitialized = initialized
    let liveVideoGroups = videoGroups, liveAudioGroups = audioGroups
    try {
        const mpd = safeCall(core, 'getMpd')
        if (mpd && typeof mpd === 'object') {
            if (Array.isArray(mpd.video)) liveVideoGroups = Math.min(VIDEO_MAX, mpd.video.length)
            if (Array.isArray(mpd.audio)) liveAudioGroups = Math.min(AUDIO_MAX, mpd.audio.length)
        }
    } catch {}
    lastReadAt = Date.now()
    return { coreInitialized, coreRevision, videoGroups: liveVideoGroups, audioGroups: liveAudioGroups, lastReadAt }
}

const reconcileNow = (trigger = 'manual') => {
    if (!active()) { setState('expired', 'generation'); return false }
    attempts++
    lastReadAt = Date.now()
    const player = (() => { try { return unsafeWindow.player } catch { return null } })()
    if (!player) { setState('waiting-player', trigger); return false }
    const manifest = safeCall(player, 'getManifest')
    if (!keyMatchesManifest(manifest)) { setState('waiting-match', trigger); return false }
    const core = safeCall(player, '__core')
    if (!core) { setState('waiting-core', trigger); return false }
    if (core !== livenessCore) { livenessCore = core; coreRevision++ }
    try { coreInitialized = typeof core?.state?.initialized === 'boolean' ? core.state.initialized : null } catch { coreInitialized = null }
    coreChanged = !!lastCore && lastCore !== core
    lastCore = core
    if (previousAcceptedCore && previousAcceptedKey !== expectedKey && core === previousAcceptedCore) {
        setState('waiting-core', 'stale-core')
        return false
    }
    const cloned = cloneMpd(safeCall(core, 'getMpd'))
    if (!cloned) { setState('waiting-mpd', trigger); return false }
    const generation = runtime.generation
    if (acceptedGeneration === generation && acceptedFingerprint === cloned.fingerprint) {
        setState('adopted', coreInitialized === false ? 'core-uninitialized' : 'unchanged')
        clearTimers()
        return true
    }
    try {
        deps.playInfoTransformer(cloned.payload, { source: 'player-mpd' })
    } catch {
        deps.DiagnosticLog?.fault?.('player-manifest')
        setState('unsupported', 'transform')
        return false
    }
    acceptedFingerprint = cloned.fingerprint
    acceptedGeneration = generation
    previousAcceptedCore = core
    previousAcceptedKey = expectedKey
    adoptedAt = Date.now()
    source = 'player-mpd'
    videoGroups = cloned.videoGroups
    audioGroups = cloned.audioGroups
    setState('adopted', trigger)
    clearTimers()
    return true
}

const start = (videoKey, startReason = 'initial') => {
    clearTimers()
    expectedKey = String(videoKey || '').toLowerCase()
    runtime = deps.captureRuntimeGeneration()
    attempts = 0
    startedAt = Date.now()
    acceptedFingerprint = ''
    acceptedGeneration = -1
    adoptedAt = 0
    source = 'none'
    videoGroups = 0
    audioGroups = 0
    transportBootstrapCount = 0
    lastCore = null
    livenessCore = null
    coreRevision = 0
    coreInitialized = null
    setState('waiting-player', startReason)
    if (reconcileNow(startReason)) return true
    for (const delay of RETRY_DELAYS) {
        const timer = setTimeout(() => {
            timers.delete(timer)
            if (!active() || state === 'superseded') return
            reconcileNow('retry')
            if (!timers.size && state !== 'adopted') setState('expired', reason)
        }, delay)
        timers.add(timer)
    }
    return false
}

const supersede = (why = 'trusted-api') => {
    clearTimers()
    setState('superseded', why)
}
const cancel = (why = 'lifecycle') => {
    clearTimers()
    runtime = null
    if (state !== 'superseded') setState('expired', why)
}

const bootstrapTransport = url => {
    if (!active() || transportBootstrapCount >= BOOTSTRAP_MAX) return false
    if (deps.captureNativeRouteContext(url)) return true
    const groupId = deps.registerTransportBootstrap(url)
    if (!groupId) return false
    transportBootstrapCount++
    source = source === 'player-mpd' ? source : 'transport-bootstrap'
    if (state !== 'adopted') setState('transport-bootstrap', 'context-miss')
    return true
}

const reconcileMediaRequest = url => {
    if (!active()) return false
    let context = deps.captureNativeRouteContext(url)
    if (context) return true
    // A core can be replaced during auto-quality without a URL navigation. Read
    // once on an actual context miss; an unchanged fingerprint is a no-op.
    reconcileNow('media-context-miss')
    context = deps.captureNativeRouteContext(url)
    return !!context || bootstrapTransport(url)
}

const diagnostics = () => ({
    state, source, reason, attempts: Math.max(0, attempts), elapsedMs: startedAt ? Math.max(0, Date.now() - startedAt) : 0,
    coreChanged, coreInitialized, coreRevision, videoGroups, audioGroups, adoptedAt, lastReadAt,
    transportBootstrapCount, pendingRetries: timers.size,
})

return { start, cancel, supersede, reconcileNow, reconcileMediaRequest, inspectLiveness, diagnostics }
}
