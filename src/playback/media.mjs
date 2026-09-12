// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createMedia(deps) {
let currentStreamBitsPerSec = 0

let streamProfile = null

const DEFAULT_BUFFER_TARGET_BYTES = 20 * 1024 * 1024

const MIN_BUFFER_TARGET_BYTES = 16 * 1024 * 1024

const MAX_BUFFER_TARGET_BYTES = 160 * 1024 * 1024

let baseBufferTargetBytes = DEFAULT_BUFFER_TARGET_BYTES

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const setBufferTargetFromBitrate = (totalBitsPerSec, isHighBitrate) => {
    if (!totalBitsPerSec || !Number.isFinite(totalBitsPerSec)) return
    currentStreamBitsPerSec = totalBitsPerSec
    // 高碼率（4K/高 fps）多存一點，下載速度暫時掉下去也有緩衝可以撐
    const targetSeconds = isHighBitrate ? 45 : 20
    baseBufferTargetBytes = clamp(
        (totalBitsPerSec / 8) * targetSeconds,
        MIN_BUFFER_TARGET_BYTES,
        MAX_BUFFER_TARGET_BYTES
    )
}

const getBufferTargetBytes = (playbackRate) => {
    const rate = deps.getEffectivePlaybackRate(playbackRate)
    return clamp(baseBufferTargetBytes * rate, MIN_BUFFER_TARGET_BYTES, MAX_BUFFER_TARGET_BYTES)
}

const getWatchdogRequiredBps = (streamMbps, playbackRate, highBitrate) => highBitrate
    ? Math.max(0, Number(streamMbps) || 0) * deps.getEffectivePlaybackRate(playbackRate) * 1e6 / 8
    : deps.getRequiredStreamMbps(playbackRate, 'steady') * 1e6 / 8

const REPRESENTATION_REGISTRY_MAX = 128

const AUDIO_REGISTRY_MAX = 64

const REPRESENTATION_OBSERVATION_TTL_MS = 30 * 1000

const representationRegistry = new Map()

const audioRepresentationRegistry = new Map()

const muxedRepresentationRegistry = new Map()

let playinfoEpoch = 0

let mediaObservations = { video: null, audio: null, muxed: null, unknown: null }

let lastVideoTransportObservation = null

let observedVideoRepresentation = null
let pageAudioBps = 0

let streamEstimate = { source: 'unknown', codec: 'other', height: 0, videoMbps: 0, audioMbps: 0 }

const resetMediaDelivery = () => {
    mediaObservations = { video: null, audio: null, muxed: null, unknown: null }
    lastVideoTransportObservation = null
    observedVideoRepresentation = null
    pageAudioBps = 0
}

const resetRepresentationRegistry = () => {
    playinfoEpoch++
    deps.resetNativeRoutePool()
    deps.DiagnosticLog.boundary(deps.runtimeGeneration, playinfoEpoch, 'epoch')
    representationRegistry.clear()
    audioRepresentationRegistry.clear()
    muxedRepresentationRegistry.clear()
    resetMediaDelivery()
}

const representationIdentity = (url) => {
    if (typeof url !== 'string' || !url || url.length > 16 * 1024) return ''
    try {
        const parsed = new URL(url, location.href)
        if (!/^https?:$/.test(parsed.protocol) || !deps.isMediaSegmentUrl(parsed.href)) return ''
        return parsed.pathname + parsed.search
    } catch { return '' }
}

const registerMediaRepresentation = (registry, rep, kind, limit) => {
    const safeRep = {
        kind, height: Number.isFinite(+rep.height) ? Math.max(0, Math.trunc(+rep.height)) : 0,
        bandwidth: Number.isFinite(+rep.bandwidth) ? Math.max(0, +rep.bandwidth) : 0,
        codec: ['av1', 'hevc', 'avc'].includes(rep.codec) ? rep.codec : 'other',
    }
    ;(Array.isArray(rep.urls) ? rep.urls : []).forEach(url => {
        const key = representationIdentity(url)
        if (!key) return
        if (!registry.has(key) && registry.size >= limit) registry.delete(registry.keys().next().value)
        // Ambiguous identities remain unknown, even when repeated later in this epoch.
        if (registry.has(key) && JSON.stringify(registry.get(key)) !== JSON.stringify(safeRep)) registry.set(key, null)
        else registry.set(key, safeRep)
    })
}

const rebuildRepresentationRegistry = (reset = true) => {
    if (reset) resetRepresentationRegistry()
    if (!streamProfile || !Array.isArray(streamProfile.reps)) return
    streamProfile.reps.forEach(rep => {
        if (!rep || !Number.isFinite(+rep.bandwidth) || +rep.bandwidth <= 0) return
        registerMediaRepresentation(representationRegistry, rep, 'video', REPRESENTATION_REGISTRY_MAX)
    })
    ;(streamProfile.audioReps || []).forEach(rep => registerMediaRepresentation(audioRepresentationRegistry, rep, 'audio', AUDIO_REGISTRY_MAX))
}

const lookupMediaRepresentation = (url) => {
    const key = representationIdentity(url)
    if (!key) return null
    const matches = [representationRegistry, audioRepresentationRegistry, muxedRepresentationRegistry].filter(map => map.has(key))
    return matches.length === 1 ? matches[0].get(key) : null
}

const captureMediaRequest = (url, runtime = deps.captureRuntimeGeneration()) => ({
    runtime, epoch: playinfoEpoch, rep: lookupMediaRepresentation(url), route: deps.captureNativeRouteContext(url),
})

const mediaContextActive = context => !!context && context.epoch === playinfoEpoch && deps.isRuntimeGenerationActive(context.runtime)

const mediaHeightMatches = rep => {
    try {
        const video = deps.Watchdog.getVideo()
        return !video || !video.videoHeight || !rep.height || Math.abs(rep.height - video.videoHeight) <= 16
    } catch { return false }
}

const noteObservedVideoRepresentation = (url, context = captureMediaRequest(url)) => {
    if (!mediaContextActive(context)) return false
    const rep = context.rep
    if (rep && rep.kind !== 'video') return false
    if (!rep) return false
    observedVideoRepresentation = {
        height: rep.height,
        bandwidth: rep.bandwidth,
        codec: rep.codec,
        observedAt: Date.now(),
    }
    return true
}

const observeMediaTransfer = (context, url, bytes, source) => {
    if (!mediaContextActive(context) || !Number.isSafeInteger(bytes) || bytes <= 0 || bytes > 256 * 1024 * 1024) return
    deps.observeNativeTransport(context, url, bytes, source)
    let host = '', classification = 'non-catalog'
    try {
        const parsed = new URL(url, location.href)
        if (!representationIdentity(parsed.href)) return
        host = parsed.hostname
        classification = deps.classifyMediaDelivery(parsed.href).kind || 'non-catalog'
    } catch { return }
    const trustedHost = deps.TRUSTED_CDN_CATALOG_SET.has(host) ? host : null
    // A redirect to an unrelated resource is not evidence for the original representation.
    const pageRep = deps.pageRepresentation(context)
    const rep = pageRep || (lookupMediaRepresentation(url) === context.rep ? context.rep : null)
    const kind = rep && ['video', 'audio', 'muxed'].includes(rep.kind) ? rep.kind : 'unknown'
    const observation = { host: trustedHost, classification: trustedHost ? 'catalog' :
        (classification === 'pcdn' || classification === 'suspected-pcdn' ? classification : 'non-catalog'),
        source, kind, height: rep?.height || 0, observedAt: Date.now(), bytes,
        generation: context.runtime.generation, epoch: context.epoch, metadataSource: pageRep ? 'page-hint' : 'trusted-api' }
    const previous = mediaObservations[kind]
    if (previous && previous.host === observation.host && previous.source === source) {
        observation.bytes = Math.min(Number.MAX_SAFE_INTEGER, previous.bytes + bytes)
    }
    mediaObservations[kind] = observation
    if (pageRep && kind === 'video' && mediaHeightMatches(rep)) {
        observedVideoRepresentation = { ...rep, observedAt: Date.now() }
        const audioBps = streamProfile?.audioBps || pageAudioBps
        if (!streamProfile || streamProfile.source === 'page-hint') streamProfile = { reps: [rep], audioBps, source: 'page-hint' }
    }
    if (pageRep && kind === 'audio') {
        pageAudioBps = Math.max(pageAudioBps, rep.bandwidth)
        if (streamProfile?.source === 'page-hint') streamProfile.audioBps = pageAudioBps
    }
    if (kind === 'video' && mediaHeightMatches(rep)) {
        noteObservedVideoRepresentation(url, context)
        if (!pageRep && (source === 'fetch' || source === 'xhr')) {
            deps.Watchdog.noteVideoTransport(lastVideoTransportObservation, observation)
            lastVideoTransportObservation = observation
        }
    }
}

const freshMediaObservation = observation => !!observation && !deps.disabled
    && observation.generation === deps.runtimeGeneration && observation.epoch === playinfoEpoch
    && Date.now() - observation.observedAt >= 0 && Date.now() - observation.observedAt <= REPRESENTATION_OBSERVATION_TTL_MS
    && (observation.kind !== 'video' || mediaHeightMatches(observation))

const getAttributedVideoHost = () => freshMediaObservation(lastVideoTransportObservation)
    ? lastVideoTransportObservation.host : null

const getMediaDeliverySnapshot = () => Object.fromEntries(Object.entries(mediaObservations).map(([kind, observation]) => [kind,
    observation ? { host: observation.host, classification: observation.classification, source: observation.source,
        ageSec: Math.max(0, Math.round((Date.now() - observation.observedAt) / 1000)),
        bytes: observation.bytes, metadataSource: observation.metadataSource || 'unknown', fresh: freshMediaObservation(observation) }
        : { host: null, classification: 'unknown', source: 'none', ageSec: null, bytes: 0, fresh: false },
]))

let playbackQualityBaseline = null

let playbackQualitySnapshot = { available: false, totalFrames: null, droppedFrames: null, droppedPercent: null }

const resetPlaybackQuality = () => {
    playbackQualityBaseline = null
    playbackQualitySnapshot = { available: false, totalFrames: null, droppedFrames: null, droppedPercent: null }
}

const samplePlaybackQuality = () => {
    if (deps.disabled) { resetPlaybackQuality(); return }
    try {
        const video = deps.Watchdog.getVideo()
        if (!video || typeof video.getVideoPlaybackQuality !== 'function') { resetPlaybackQuality(); return }
        const result = video.getVideoPlaybackQuality()
        const total = result.totalVideoFrames, dropped = result.droppedVideoFrames
        if (![total, dropped].every(n => Number.isSafeInteger(n) && n >= 0) || dropped > total) {
            resetPlaybackQuality(); return
        }
        let baseline = playbackQualityBaseline
        if (!baseline || baseline.video !== video || baseline.generation !== deps.runtimeGeneration
            || total < baseline.lastTotal || dropped < baseline.lastDropped) {
            baseline = playbackQualityBaseline = { video, generation: deps.runtimeGeneration, total, dropped,
                lastTotal: total, lastDropped: dropped, since: Date.now() }
        }
        baseline.lastTotal = total; baseline.lastDropped = dropped
        const totalFrames = total - baseline.total, droppedFrames = dropped - baseline.dropped
        if (droppedFrames > totalFrames) { resetPlaybackQuality(); return }
        playbackQualitySnapshot = { available: true, totalFrames, droppedFrames,
            droppedPercent: totalFrames ? +(droppedFrames * 100 / totalFrames).toFixed(3) : 0,
            observedSec: Math.max(0, Math.round((Date.now() - baseline.since) / 1000)) }
    } catch { resetPlaybackQuality() }
}

const syncStreamBitrateFromVideo = (videoEl) => {
    if (!streamProfile || !streamProfile.reps.length || !videoEl) return
    const h = videoEl.videoHeight || 0
    if (!h) return   // 起播初期還沒解出畫面，維持原估計值（Watchdog 此時也還在 grace 期）

    let bestDiff = Infinity, bestBps = 0, selectedCodec = 'other', estimateSource = 'conservative-height-max'
    const observed = observedVideoRepresentation
    if (observed && Date.now() - observed.observedAt <= REPRESENTATION_OBSERVATION_TTL_MS
        && Math.abs(observed.height - h) <= 16) {
        bestDiff = Math.abs(observed.height - h)
        bestBps = observed.bandwidth
        selectedCodec = observed.codec
        estimateSource = 'observed-representation'
    }
    for (const r of streamProfile.reps) {
        const diff = Math.abs(r.height - h)
        // 同一個高度可能有多個 codec（AVC/HEVC/AV1）碼率不同；取較大的那個，
        // 寧可略為高估也不要低估到讓 Watchdog 對真正的卡頓變遲鈍。
        if (estimateSource !== 'observed-representation'
            && (diff < bestDiff || (diff === bestDiff && r.bandwidth > bestBps))) {
            bestDiff = diff
            bestBps  = r.bandwidth
            selectedCodec = ['av1', 'hevc', 'avc'].includes(r.codec) ? r.codec : 'other'
        }
    }
    if (!bestBps) return

    const total = bestBps + (streamProfile.audioBps || 0)
    streamEstimate = {
        source: estimateSource,
        metadataSource: streamProfile.source || 'trusted-api',
        codec: selectedCodec,
        height: Math.max(0, Math.trunc(h)),
        videoMbps: +(bestBps / 1e6).toFixed(3),
        audioMbps: +((streamProfile.audioBps || 0) / 1e6).toFixed(3),
    }
    // 變動小於 5% 就不動，避免每秒重算緩衝目標造成 reached 狀態抖動
    if (currentStreamBitsPerSec > 0 && Math.abs(total - currentStreamBitsPerSec) < currentStreamBitsPerSec * 0.05) return
    setBufferTargetFromBitrate(total, total > 12e6)
}

const resetStreamProfile = () => {
    deps.clearCodecPlayinfo()
    // 綁定節點是「這支影片這次簽發」的性質，換片就要重新給機會，不能一路沿用
    deps.hostLockedStreams.clear()
    deps.preservedOriginalStreamUrls.clear()
    deps.rewrittenStreamOrigins.clear()
    resetRepresentationRegistry()
    streamEstimate = { source: 'unknown', codec: 'other', height: 0, videoMbps: 0, audioMbps: 0 }
    streamProfile = null
    currentStreamBitsPerSec = 0
    baseBufferTargetBytes = DEFAULT_BUFFER_TARGET_BYTES
    deps.seekGraceUntil = 0
    deps.resetPlaybackRateState()
}
return { /* TEST_EXPORTS:media */
get currentStreamBitsPerSec() { return currentStreamBitsPerSec; }, set currentStreamBitsPerSec(value) { currentStreamBitsPerSec = value; },
get streamProfile() { return streamProfile; }, set streamProfile(value) { streamProfile = value; },
get DEFAULT_BUFFER_TARGET_BYTES() { return DEFAULT_BUFFER_TARGET_BYTES; },
get baseBufferTargetBytes() { return baseBufferTargetBytes; }, set baseBufferTargetBytes(value) { baseBufferTargetBytes = value; },
get setBufferTargetFromBitrate() { return setBufferTargetFromBitrate; },
get getBufferTargetBytes() { return getBufferTargetBytes; },
get getWatchdogRequiredBps() { return getWatchdogRequiredBps; },
get AUDIO_REGISTRY_MAX() { return AUDIO_REGISTRY_MAX; },
get muxedRepresentationRegistry() { return muxedRepresentationRegistry; },
get playinfoEpoch() { return playinfoEpoch; }, set playinfoEpoch(value) { playinfoEpoch = value; },
get mediaObservations() { return mediaObservations; }, set mediaObservations(value) { mediaObservations = value; },
get streamEstimate() { return streamEstimate; }, set streamEstimate(value) { streamEstimate = value; },
get resetMediaDelivery() { return resetMediaDelivery; },
get resetRepresentationRegistry() { return resetRepresentationRegistry; },
get registerMediaRepresentation() { return registerMediaRepresentation; },
get rebuildRepresentationRegistry() { return rebuildRepresentationRegistry; },
get captureMediaRequest() { return captureMediaRequest; },
get mediaContextActive() { return mediaContextActive; },
get observeMediaTransfer() { return observeMediaTransfer; },
get freshMediaObservation() { return freshMediaObservation; },
get getAttributedVideoHost() { return getAttributedVideoHost; },
get getMediaDeliverySnapshot() { return getMediaDeliverySnapshot; },
get playbackQualitySnapshot() { return playbackQualitySnapshot; }, set playbackQualitySnapshot(value) { playbackQualitySnapshot = value; },
get resetPlaybackQuality() { return resetPlaybackQuality; },
get samplePlaybackQuality() { return samplePlaybackQuality; },
get syncStreamBitrateFromVideo() { return syncStreamBitrateFromVideo; },
get resetStreamProfile() { return resetStreamProfile; }
};
}
