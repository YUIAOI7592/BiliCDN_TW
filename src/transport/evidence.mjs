// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createEvidence(deps) {
const redirectStats = {
    unstable: 0,
    pcdnExplicit: 0,
    pcdnSuspectedPort: 0,
    liveSkipped: 0,
    partialProbeSamples: 0,
    // v1.3.3：命中 /v1/resource 而「刻意不改寫」的次數。數字持續增加代表你的網路
    // 環境常被分配到 PCDN —— 這正是舊版會改壞、造成偶發起播變慢的那類連結。
    pcdnSkipped: 0,
    // 2026-08-20：這條串流「換 host 會被 403 拒絕」而刻意不改寫、也不賽馬的次數。
    // 數字 > 0 代表你遇到了 os=<節點>bv 這種綁定節點的簽名（見 hostLockedStreams）。
    hostLocked: 0,
    whitelist: 0,
    httpdns: 0,
    httpdnsAllowed: 0,
    httpdnsAutoSwitch: 0,
    quietRedirects: 0,
}

const segmentByteAccountedUrls = new Map()

const SEGMENT_DEDUP_WINDOW_MS = 5000

const segmentDedupKey = (url) => {
    try { return new URL(url).href } catch { return String(url || '') }
}

const noteSegmentAccounted = (url) => {
    if (!url) return
    const now = Date.now()
    segmentByteAccountedUrls.set(segmentDedupKey(url), now)
    if (segmentByteAccountedUrls.size > 64) {
        segmentByteAccountedUrls.forEach((t, u) => {
            if (now - t > SEGMENT_DEDUP_WINDOW_MS) segmentByteAccountedUrls.delete(u)
        })
    }
}

const wasSegmentAccounted = (url) => {
    const t = url && segmentByteAccountedUrls.get(segmentDedupKey(url))
    return !!t && (Date.now() - t < SEGMENT_DEDUP_WINDOW_MS)
}

const noteSegmentBytes = (cdn, xhr, startedAt, url, alreadyReportedBytes, runtimeToken, mediaContext) => {
    if (deps.disabled || (runtimeToken && !deps.isRuntimeGenerationActive(runtimeToken))) return
    try {
        let bytes = 0
        const cl = xhr.getResponseHeader && xhr.getResponseHeader('content-length')
        if (cl) bytes = parseInt(cl, 10) || 0
        if (!bytes) {
            try {
                const r = xhr.response
                if (r && typeof r.byteLength === 'number') bytes = r.byteLength
                else if (r && typeof r.size === 'number') bytes = r.size // Blob（responseType: 'blob'）
                else if ((xhr.responseType === '' || xhr.responseType === 'text') && typeof xhr.responseText === 'string') {
                    bytes = xhr.responseText.length
                }
            } catch {}
        }
        if (!bytes) return
        const durationMs = Math.max(1, Date.now() - startedAt)
        const remaining  = Math.max(0, bytes - (alreadyReportedBytes || 0))
        if (remaining) {
            deps.observeMediaTransfer(mediaContext, xhr.responseURL || url, remaining, 'xhr')
            if (cdn) deps.Watchdog.noteExternalBytes(cdn, remaining)
        }
        if (cdn) deps.recordCdnThroughput(cdn, bytes, durationMs, deps.playbackRateState.effectiveRate)
        deps.recordNativeThroughput(mediaContext, xhr.responseURL || url, bytes, durationMs,
            deps.playbackRateState.effectiveRate, 'transport')
        noteSegmentAccounted(url)
        if (xhr.responseURL && xhr.responseURL !== url) noteSegmentAccounted(xhr.responseURL)
    } catch {}
}
return { /* TEST_EXPORTS:evidence */
get redirectStats() { return redirectStats; },
get noteSegmentAccounted() { return noteSegmentAccounted; },
get wasSegmentAccounted() { return wasSegmentAccounted; },
get noteSegmentBytes() { return noteSegmentBytes; }
};
}
