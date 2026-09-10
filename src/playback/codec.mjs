// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createCodec(deps) {
const getDashCodecString = (item) => {
    const direct = String((item && (item.codecs || item.codec)) || '').trim()
    if (direct) return direct
    const mime = String((item && (item.mime_type || item.mimeType)) || '')
    const match = mime.match(/codecs\s*=\s*["']?\s*([^"',;\s]+)/i)
    return match ? match[1] : ''
}

const normalizeCodecName = (item) => {
    const codec = String(getDashCodecString(item)
        || (item && (item.mime_type || item.mimeType)) || '').toLowerCase()
    const codecid = Number(item && (item.codecid || item.codec_id || item.codecId))
    if (codec.includes('av01') || codecid === 13) return 'av1'
    if (codec.includes('hev1') || codec.includes('hvc1') || codecid === 12) return 'hevc'
    if (codec.includes('avc1') || codecid === 7) return 'avc'
    return 'other'
}

const VIDEO_CODEC_PREFERENCES = Object.freeze(['av1', 'hevc', 'avc', 'auto'])

const resolvedVideoCodecPreference = VIDEO_CODEC_PREFERENCES.includes(deps.PreferredVideoCodec)
    ? deps.PreferredVideoCodec
    : 'hevc'

const CODEC_CAPABILITY_MAX = 128

const codecCapability = new Map()

let codecQueryQueue = []

let codecQueriesInFlight = 0

let activeCodecConfigurations = []

let codecResumeItems = []

let lastCodecDecision = { preference: resolvedVideoCodecPreference, groups: [] }

const parseRepresentationFrameRate = value => {
    if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null
    if (typeof value !== 'string' || value.length > 64) return null
    const parts = value.trim().match(/^(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?$/)
    if (!parts) return null
    const n = Number(parts[1]) / (parts[2] === undefined ? 1 : Number(parts[2]))
    return Number.isFinite(n) && n > 0 ? n : null
}

const getRepresentationCodecConfig = item => {
    try {
        if (!item || typeof item !== 'object') return null
        const codec = getDashCodecString(item)
        const mime = String(item.mime_type || item.mimeType || '').split(';')[0].trim().toLowerCase()
        if (!codec || codec.length > 256 || !/^[a-z0-9._-]+$/i.test(codec)
            || mime.length > 128 || !/^video\/[a-z0-9.+-]+$/.test(mime)) return null
        const width = Number(item.width), height = Number(item.height), bitrate = Number(item.bandwidth)
        const framerate = parseRepresentationFrameRate(item.frame_rate ?? item.frameRate ?? item.framerate)
        if (![width, height, bitrate].every(n => Number.isSafeInteger(n) && n > 0)
            || width > 0xffffffff || height > 0xffffffff || !framerate) return null
        return { type: 'media-source', video: { contentType: mime + '; codecs="' + codec + '"', width, height, bitrate, framerate } }
    } catch { return null }
}

const codecConfigurationKey = item => {
    const config = getRepresentationCodecConfig(item)
    return config ? JSON.stringify(config) : ''
}

const summarizeCodecCapability = value => {
    if (!value || typeof value !== 'object') return 'unknown'
    if (value.supported === false || value.smooth === false || value.powerEfficient === false) return 'bad'
    return value.supported === true && value.smooth === true && value.powerEfficient === true ? 'good' : 'unknown'
}

const getRepresentationCapability = item => {
    const kind = normalizeCodecName(item)
    if (kind !== 'av1' && kind !== 'hevc') return { capability: 'not-applicable', reason: 'not-applicable' }
    const key = codecConfigurationKey(item)
    if (!key) return { capability: 'unknown', reason: 'missing-or-invalid-metadata' }
    const entry = codecCapability.get(key)
    return entry && entry.state === 'complete'
        ? { capability: summarizeCodecCapability(entry.value), reason: entry.reason }
        : { capability: 'unknown', reason: entry?.state || (deps.disabled ? 'disabled' : 'not-requested') }
}

const invalidateCodecQueries = () => {
    codecQueryQueue.forEach(entry => { if (codecCapability.get(entry.key) === entry) codecCapability.delete(entry.key) })
    codecQueryQueue = []
    activeCodecConfigurations = []
    lastCodecDecision = { preference: resolvedVideoCodecPreference, groups: [] }
    // Native decodingInfo has no AbortSignal: pending entries retain their slots until settlement.
}

const pumpCodecQueries = () => {
    while (!deps.disabled && codecQueriesInFlight < 2 && codecQueryQueue.length) {
        const entry = codecQueryQueue.shift()
        if (codecCapability.get(entry.key) !== entry || !deps.isRuntimeGenerationActive(entry.runtime)) continue
        entry.state = 'pending'
        codecQueriesInFlight++
        const finish = (value, reason) => {
            codecQueriesInFlight--
            if (codecCapability.get(entry.key) === entry) {
                if (deps.isRuntimeGenerationActive(entry.runtime)) {
                    entry.state = 'complete'
                    entry.value = value ? {
                        supported: typeof value.supported === 'boolean' ? value.supported : null,
                        smooth: typeof value.smooth === 'boolean' ? value.smooth : null,
                        powerEfficient: typeof value.powerEfficient === 'boolean' ? value.powerEfficient : null,
                    } : null
                    entry.reason = reason
                } else codecCapability.delete(entry.key)
            }
            // Only configurations requested by the current playinfo may occupy the freed slot.
            const retry = activeCodecConfigurations.find(row => row.key === entry.key)
            if (retry && !deps.isRuntimeGenerationActive(entry.runtime)) enqueueCodecQuery(retry, false)
            pumpCodecQueries()
        }
        Promise.resolve().then(() => deps.isRuntimeGenerationActive(entry.runtime)
            ? navigator.mediaCapabilities.decodingInfo(entry.config) : null)
            .then(value => {
                let safe = null, reason = 'query-failed'
                try {
                    if (value && typeof value === 'object') {
                        safe = { supported: value.supported, smooth: value.smooth, powerEfficient: value.powerEfficient }
                        reason = summarizeCodecCapability(safe) === 'unknown' ? 'incomplete-result' : 'completed'
                    }
                } catch {}
                finish(safe, reason)
            }, () => finish(null, 'query-failed'))
    }
}

const clearCodecPlayinfo = () => { invalidateCodecQueries(); codecResumeItems = [] }

const enqueueCodecQuery = (row, pump = true) => {
    if (deps.disabled || !row.key || (row.kind !== 'av1' && row.kind !== 'hevc') || codecCapability.has(row.key)) return
    if (codecCapability.size >= CODEC_CAPABILITY_MAX) {
        const activeKeys = new Set(activeCodecConfigurations.map(row => row.key))
        const removable = [...codecCapability].find(([key, entry]) => entry.state === 'complete' && !activeKeys.has(key))
        if (!removable) return
        codecCapability.delete(removable[0])
    }
    let available = false
    try { available = typeof navigator.mediaCapabilities?.decodingInfo === 'function' } catch {}
    const entry = { key: row.key, config: row.config, runtime: deps.captureRuntimeGeneration(),
        state: available ? 'queued' : 'complete', reason: available ? 'queued' : 'api-unavailable', value: null }
    codecCapability.set(row.key, entry)
    if (available) codecQueryQueue.push(entry)
    if (pump) pumpCodecQueries()
}

const prepareCodecConfigurations = videoItems => {
    activeCodecConfigurations = videoItems.slice(0, CODEC_CAPABILITY_MAX).map(item => {
        const config = getRepresentationCodecConfig(item)
        const snapshot = { codecs: getDashCodecString(item).slice(0, 256),
            mime_type: String(item?.mime_type || item?.mimeType || '').slice(0, 128),
            width: Number(item?.width), height: Number(item?.height), bandwidth: Number(item?.bandwidth),
            frame_rate: config ? config.video.framerate : null,
            codecid: Number(item?.codecid || item?.codec_id || item?.codecId) }
        return { item: Object.freeze(snapshot), kind: normalizeCodecName(item), key: config ? JSON.stringify(config) : '', config }
    })
    codecResumeItems = activeCodecConfigurations.map(row => row.item)
    const keys = new Set(activeCodecConfigurations.map(row => row.key))
    codecQueryQueue = codecQueryQueue.filter(entry => {
        if (keys.has(entry.key) && deps.isRuntimeGenerationActive(entry.runtime)) return true
        if (codecCapability.get(entry.key) === entry) codecCapability.delete(entry.key)
        return false
    })
    activeCodecConfigurations.forEach(row => enqueueCodecQuery(row, false))
    pumpCodecQueries()
}

const getCurrentCodecDiagnostics = () => activeCodecConfigurations.slice(0, 8).map(row => ({
    codec: row.kind, height: row.config?.video.height || 0, width: row.config?.video.width || 0,
    frameRate: row.config?.video.framerate || null, ...getRepresentationCapability(row.item),
}))

const getCodecCapabilityState = (kind, height) => {
    if (kind !== 'hevc' && kind !== 'av1') return 'not-applicable'
    const states = activeCodecConfigurations.filter(row => row.kind === kind
        && ((Number(row.item.height) || 0) >= 2160 ? 2160 : 1080) === (height >= 2160 ? 2160 : 1080))
        .map(row => getRepresentationCapability(row.item).capability)
    return states.length && states.every(state => state === states[0]) ? states[0] : 'unknown'
}

const canPlayDashVideoItem = (() => {
    const cache = {}
    let testVideo = null

    const canPlayCodecString = (codec) => {
        if (!codec) return null
        const key = codec.toLowerCase()
        if (key in cache) return cache[key]
        const mime = 'video/mp4; codecs="' + codec + '"'
        let ok = false
        try {
            const MS = unsafeWindow.MediaSource || (typeof MediaSource !== 'undefined' ? MediaSource : null)
            ok = !!(MS && MS.isTypeSupported && MS.isTypeSupported(mime))
        } catch {}
        if (!ok) {
            try {
                if (!testVideo) testVideo = document.createElement('video')
                ok = !!(testVideo.canPlayType && testVideo.canPlayType(mime))
            } catch {}
        }
        cache[key] = ok
        return ok
    }

    return (item) => {
        const kind = normalizeCodecName(item)
        const codec = getDashCodecString(item)
        const explicit = canPlayCodecString(codec)
        if (explicit !== null) return explicit
        if (kind === 'av1') return false
        return true
    }
})()

const normalizeDashCodecPreference = (dash) => {
    if (!dash || !Array.isArray(dash.video)) return
    prepareCodecConfigurations(dash.video)
    if (resolvedVideoCodecPreference === 'auto') {
        lastCodecDecision = { preference: 'auto', groups: [] }
        return
    }

    const codecRank = (item) => {
        const kind = normalizeCodecName(item)
        if (resolvedVideoCodecPreference === 'avc') {
            if (kind === 'avc') return 0
            if (kind === 'hevc') return 1
            if (kind === 'av1') return 2
            return 3
        }
        const capability = getRepresentationCapability(item).capability
        const suitable = capability !== 'bad'
        if (resolvedVideoCodecPreference === 'av1') {
            if (kind === 'av1')  return suitable ? 0 : 3
            if (kind === 'hevc') return suitable ? 1 : 4
            if (kind === 'avc')  return 2
            return 5
        }
        // 'hevc' 模式維持 v1.4.1 的相對順序；只有 Media Capabilities 明確否定時
        // 才把 HEVC/AV1 降到 AVC 後面。
        if (kind === 'hevc') return suitable ? 0 : 2
        if (kind === 'avc')  return 1
        if (kind === 'av1')  return suitable ? 1.5 : 3
        return 4
    }

    const groups = []
    const byQuality = new Map()
    dash.video.forEach((item, originalIndex) => {
        const quality = String(item && (item.id || item.quality || item.qn || originalIndex))
        if (!byQuality.has(quality)) {
            const group = { quality, items: [] }
            byQuality.set(quality, group)
            groups.push(group)
        }
        byQuality.get(quality).items.push({ item, originalIndex })
    })

    const normalized = []
    const decisions = []
    groups.forEach(group => {
        let entries = group.items
        const supported = entries.filter(entry => canPlayDashVideoItem(entry.item))
        if (supported.length) entries = supported
        entries.sort((a, b) => {
            const rankDiff = codecRank(a.item) - codecRank(b.item)
            return rankDiff || (a.originalIndex - b.originalIndex)
        })
        entries.forEach(entry => normalized.push(entry.item))
        const selected = entries[0] && entries[0].item
        if (decisions.length < 8 && selected) {
            const height = ((selected && selected.height) || 0) >= 2160 ? 2160 : 1080
            const kind = normalizeCodecName(selected)
            decisions.push({
                quality: String(group.quality).slice(0, 16),
                selected: kind,
                capability: getRepresentationCapability(selected).capability,
            })
        }
    })

    if (normalized.length) dash.video = normalized
    lastCodecDecision = { preference: resolvedVideoCodecPreference, groups: decisions }
}
return { /* TEST_EXPORTS:codec */
get normalizeCodecName() { return normalizeCodecName; },
get resolvedVideoCodecPreference() { return resolvedVideoCodecPreference; },
get codecResumeItems() { return codecResumeItems; }, set codecResumeItems(value) { codecResumeItems = value; },
get lastCodecDecision() { return lastCodecDecision; }, set lastCodecDecision(value) { lastCodecDecision = value; },
get invalidateCodecQueries() { return invalidateCodecQueries; },
get clearCodecPlayinfo() { return clearCodecPlayinfo; },
get prepareCodecConfigurations() { return prepareCodecConfigurations; },
get getCurrentCodecDiagnostics() { return getCurrentCodecDiagnostics; },
get getCodecCapabilityState() { return getCodecCapabilityState; },
get normalizeDashCodecPreference() { return normalizeDashCodecPreference; }
};
}
