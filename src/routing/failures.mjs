// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createFailures(deps) {
const forcedRedirectHosts = new Map()

const FORCED_REDIRECT_TTL = 10 * 60 * 1000

const FORCED_REDIRECT_MAX = Math.min(32, deps.TRUSTED_CDN_CATALOG.length)

const sweepForcedRedirectHosts = () => {
    const now = Date.now()
    for (const [host, expireAt] of forcedRedirectHosts) {
        if (!deps.isValidCustomCdnHost(host) || !Number.isFinite(expireAt) || expireAt <= now) {
            forcedRedirectHosts.delete(host)
        }
    }
}

const addForcedRedirect = (host, ttl) => {
    host = typeof host === 'string' ? host.trim().toLowerCase() : ''
    if (!deps.isValidCustomCdnHost(host)) return false
    sweepForcedRedirectHosts()
    if (!forcedRedirectHosts.has(host) && forcedRedirectHosts.size >= FORCED_REDIRECT_MAX) {
        let oldestHost = null, oldestExpiry = Infinity
        for (const [candidate, expireAt] of forcedRedirectHosts) {
            if (expireAt < oldestExpiry) { oldestHost = candidate; oldestExpiry = expireAt }
        }
        if (oldestHost) forcedRedirectHosts.delete(oldestHost)
    }
    const duration = Number.isFinite(+ttl)
        ? Math.max(1000, Math.min(FORCED_REDIRECT_TTL, +ttl))
        : FORCED_REDIRECT_TTL
    forcedRedirectHosts.set(host, Date.now() + duration)
    return true
}

const isForcedRedirect = (host) => {
    sweepForcedRedirectHosts()
    if (!deps.isValidCustomCdnHost(host)) return false
    const t = forcedRedirectHosts.get(host)
    if (!t) return false
    return true
}

const handleVerifiedSegmentFailure = ({
    cdn, url, status = 0, kind = 'http', bytesReceived = 0,
    requestElapsedMs = 0, timeoutEvidence = null,
    hostRewriteAttempt = false, originalUrl = '',
} = {}) => {
    if (deps.disabled) return false
    cdn = typeof cdn === 'string' ? cdn.trim().toLowerCase() : ''
    if (!deps.isValidCustomCdnHost(cdn)) return false
    if (typeof url !== 'string' || url.length > 16 * 1024 || !deps.isMediaSegmentUrl(url)) return false
    const numericStatus = Number.isFinite(+status) ? Math.trunc(+status) : 0

    if (numericStatus === 403 && hostRewriteAttempt) {
        deps.DiagnosticLog.record('host-lock', { host: cdn, status: 403 }, true)
        deps.noteHostLockedStream(originalUrl || url)
        return true
    }

    const isNetworkError = kind === 'network-error' || kind === 'body-error'
    const isTimeout = kind === 'timeout'
    // 原生 timeout 是期限到達，不是 DNS 證據；seek 保護期也不得因此懲罰。
    if (isTimeout && deps.inSeekGrace()) return false
    if (isTimeout) {
        const bytes = Number.isFinite(+bytesReceived) ? Math.max(0, Math.trunc(+bytesReceived)) : 0
        const elapsed = Number.isFinite(+requestElapsedMs) ? Math.max(0, +requestElapsedMs) : 0
        let admission = 'accepted'
        if (timeoutEvidence !== deps.TRUSTED_XHR_TIMEOUT_EVIDENCE
            || bytes < deps.MIN_THROUGHPUT_SAMPLE_BYTES || elapsed < deps.XHR_TIMEOUT_MIN_ELAPSED_MS) {
            admission = 'insufficient'
        } else {
            const now = performance.now()
            for (const [host, acceptedAt] of deps.acceptedXhrTimeoutAt) {
                if (!deps.isValidCustomCdnHost(host) || !Number.isFinite(acceptedAt)
                    || now < acceptedAt || now - acceptedAt >= deps.XHR_TIMEOUT_HOST_GAP_MS) {
                    deps.acceptedXhrTimeoutAt.delete(host)
                }
            }
            if (deps.acceptedXhrTimeoutAt.has(cdn)) admission = 'cooldown'
            else deps.acceptedXhrTimeoutAt.set(cdn, now)
        }
        if (admission !== 'accepted') {
            deps.DiagnosticLog.record('recovery', { host: cdn, kind: 'timeout', reason: admission,
                bytes, waitMs: elapsed, punished: false, reselected: false, preconnect: false }, true)
            return false
        }
    }
    if (deps.HARD_FAIL_STATUSES.has(numericStatus)) {
        deps.recordCdnFailure(cdn, true, numericStatus)
    } else if (numericStatus >= 500) {
        deps.recordCdnFailure(cdn, false, numericStatus)
    } else if (isNetworkError || isTimeout) {
        deps.recordCdnFailure(cdn)
        if (!isTimeout) deps.handleSegmentConnError(cdn, Math.max(0, deps.publicFinite(bytesReceived)))
    } else {
        return false
    }

    addForcedRedirect(cdn)
    deps.DiagnosticLog.record('recovery', { host: cdn, reason: isNetworkError || isTimeout ? kind : 'http', status: numericStatus,
        punished: true, reselected: true, preconnect: true }, true)
    deps.promoteBestCdnNow()
    deps.beginRouteRecovery?.('verified-transport', cdn)
    deps.preconnectBatch(deps.getHealthyCdnList().slice(0, 3), true)
    if (deps.lastSampleSegmentUrl && (deps.currentStreamBitsPerSec / 1e6 >= 12 || deps.playbackRateState.effectiveRate >= 1.75)) {
        deps.runThroughputBakeoff(deps.lastSampleSegmentUrl, false, deps.trustedBakeoffRequest('verified-failure')).catch(deps.reportMeasurementFailure())
    }
    return true
}
return { /* TEST_EXPORTS:failures */
get forcedRedirectHosts() { return forcedRedirectHosts; },
get addForcedRedirect() { return addForcedRedirect; },
get isForcedRedirect() { return isForcedRedirect; },
get handleVerifiedSegmentFailure() { return handleVerifiedSegmentFailure; }
};
}
