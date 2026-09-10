// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createPlayurl(deps) {
const playInfoTransformer = (playInfo) => {
    if (!playInfo) return
    if (playInfo.code !== undefined && playInfo.code !== 0) {
        return
    }
    // 每包新的 playinfo 都是一個 representation epoch；不可讓前一包 URL identity 汙染判讀。
    deps.clearCodecPlayinfo()
    deps.resetRepresentationRegistry()
    deps.streamEstimate = { source: 'unknown', codec: 'other', height: 0, videoMbps: 0, audioMbps: 0 }
    deps.streamProfile = null
    deps.currentStreamBitsPerSec = 0
    deps.baseBufferTargetBytes = deps.DEFAULT_BUFFER_TARGET_BYTES

    // 三個呼叫端都不接回傳值，原本回傳的 { total, akamai } 只是白算一輪。
    // 只保留真正需要的副作用：逐個 item 改寫。
    const transformList = (list, isDash) => {
        if (!Array.isArray(list)) return
        list.forEach(item => {
            if (!isDash) deps.registerMediaRepresentation(deps.muxedRepresentationRegistry,
                { urls: deps.pickStreamUrls(item, false).validUrls }, 'muxed', deps.AUDIO_REGISTRY_MAX)
            deps.transformStreamItem(item, isDash)
        })
    }

    let video_info
    if (playInfo.result) {
        video_info = playInfo.result.dash === undefined ? playInfo.result.video_info : playInfo.result
        if (!video_info || !video_info.dash) {
            if (playInfo.result.durl || playInfo.result.durls) video_info = playInfo.result
            if (video_info && video_info.durl) transformList(video_info.durl, false)
            if (video_info && video_info.durls) video_info.durls.forEach(d => transformList(d.durl, false))
            deps.sanitizePlayInfoUrls(video_info || playInfo.result)
            return
        }
    } else {
        video_info = playInfo.data
    }

    try {
        const dash = video_info && video_info.dash
        if (dash) {
            deps.normalizeDashCodecPreference(dash)

            // 只動 minBufferTime；不能加 maxBufferLength —
            // 4K AV1 + FLAC 設大會觸發 SourceBuffer QuotaExceeded → DecodeError 6003
            // 4K/高碼率用 2s：4.0 會讓 seek 後多等 ~2s 才開播（長片拖曳特明顯）
            try {
                const vids = (dash.video || [])
                const auds = (dash.audio || [])
                const maxV = vids.reduce((m, v) => Math.max(m, v.bandwidth || 0), 0)
                const maxA = auds.reduce((m, a) => Math.max(m, a.bandwidth || 0), 0)
                const is4K = vids.some(v => (v.height || 0) >= 2160 || (v.bandwidth || 0) > 12e6)
                // 4K：首播先讓畫面更快進入 canplay；穩定度交給 Watchdog/HEVC/CDN 切換處理。
                const minBuf = is4K ? 1.0 : 3.0
                // v1.3.3：記下完整畫質清單，讓 Watchdog 之後能用實際播放的畫質校正碼率
                // （見 syncStreamBitrateFromVideo）。這裡的 maxV 只當起播前的初估值，
                // 起播那 3~5 秒 Watchdog 本來就在 grace 期不判定，校正得及。
                deps.streamProfile = {
                    reps: vids
                        .map(v => ({
                            height: v.height || 0,
                            bandwidth: v.bandwidth || 0,
                            codec: deps.normalizeCodecName(v),
                            // 登記改寫前的 base/backup；identity 只取 pathname+search，換 host 後仍能命中。
                            urls: deps.pickStreamUrls(v, true).validUrls,
                        }))
                        .filter(r => r.bandwidth > 0 && r.height > 0),
                    audioBps: maxA,
                    audioReps: [...auds, ...[].concat(dash.flac?.audio || []), ...[].concat(dash.dolby?.audio || [])]
                        .filter(a => a && typeof a === 'object')
                        .map(a => ({ bandwidth: a.bandwidth || 0, urls: deps.pickStreamUrls(a, true).validUrls })),
                }
                deps.rebuildRepresentationRegistry()
                deps.setBufferTargetFromBitrate(maxV + maxA, is4K || (maxV + maxA) > 12e6)
                dash.minBufferTime   = minBuf
                dash.min_buffer_time = minBuf
            } catch {}

            const extras = []
            if (dash.flac  && dash.flac.audio)  [].concat(dash.flac.audio).forEach(i  => extras.push(i))
            if (dash.dolby && dash.dolby.audio)  [].concat(dash.dolby.audio).forEach(i => extras.push(i))

            transformList(dash.video, true)
            transformList(dash.audio, true)
            transformList(extras,     true)
            deps.sanitizePlayInfoUrls(dash)

            // 拿一條真實視訊 segment 當賽馬樣本（純 bilivideo 來源時才跑；Akamai 為主不適用）
            try {
                const sample = dash.video && dash.video[0] && (dash.video[0].base_url || dash.video[0].baseUrl)
                if (sample && deps.isBiliVideoUrl(sample) && !deps.isAkamaiUrl(sample)) deps.scheduleBakeoff(sample)
            } catch {}

        } else if (video_info && (video_info.durl || video_info.durls)) {
            transformList(video_info.durl, false)
            ;(video_info.durls || []).forEach(d => transformList(d.durl, false))
            deps.sanitizePlayInfoUrls(video_info)
        }
    } catch (e) {
        if (video_info && video_info.durl) transformList(video_info.durl, false)
        else deps.err('playInfoTransformer 例外：', e)
    }
}

const isBiliFragmentUrl = (url) => {
    if (!url || !deps.isBiliVideoUrl(url)) return false
    try {
        const parsed = deps.parseMediaHttpUrl(url)
        if (!parsed) return false
        const path = parsed.pathname
        return deps.mediaUrlPolicy.mediaPathPattern.test(path) || path.includes('/upgcxcode/') || path.startsWith('/v1/resource')
    } catch {
        return /bilivideo\.com|bilivideo\.cn/.test(url) &&
               (url.includes('.m4s') || url.includes('.flv') || url.includes('/upgcxcode/'))
    }
}
return { /* TEST_EXPORTS:playurl */
get playInfoTransformer() { return playInfoTransformer; },
get isBiliFragmentUrl() { return isBiliFragmentUrl; }
};
}
