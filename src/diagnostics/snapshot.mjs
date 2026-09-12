// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createSnapshot(deps) {
const describePlaybackBuffer = (stats) => {
    if (stats.readyState < 0) return '緩衝：無資料（尚無影片）'
    const rate = deps.playbackRateState.confirmed ? deps.playbackRateState.observedRate : deps.ASSUMED_PLAYBACK_RATE
    return '連續前方緩衝：' + stats.bufferAheadSec + ' 秒｜約可播放 ' + (stats.bufferAheadSec / rate).toFixed(1)
        + ' 秒' + (deps.playbackRateState.confirmed ? '' : '（未確認，按 2x 估算）')
}

const PUBLIC_DIAG_HOST_MAX = 32

const publicFinite = (value, fallback = 0) => Number.isFinite(+value) ? +value : fallback

const publicHost = (value) => {
    const host = typeof value === 'string' ? value.trim().toLowerCase() : ''
    return host.length <= 253 && /^[a-z0-9.-]+$/.test(host) ? host : null
}

const deepFreezePublic = (value, seen = new WeakSet()) => {
    if (!value || typeof value !== 'object' || seen.has(value)) return value
    seen.add(value)
    Object.values(value).forEach(child => deepFreezePublic(child, seen))
    return Object.freeze(value)
}

const buildPublicDiagnosticSnapshot = () => {
    const wd = deps.Watchdog.stats()
    const hd = deps.getHttpDnsStatus()
    const native = deps.getNativeRouteDiagnostics()
    const health = {}
    deps.TRUSTED_CDN_CATALOG.slice(0, PUBLIC_DIAG_HOST_MAX).forEach(host => {
        const h = deps.cdnHealth[host]
        if (!h) return
        health[host] = {
            mbps: publicFinite(h.ewmaMbps),
            latencyMs: publicFinite(h.latencyMs),
            samples: Math.max(0, Math.min(10000, Math.trunc(publicFinite(h.samples)))),
            failures: Math.max(0, Math.min(10000, Math.trunc(publicFinite(h.failures)))),
            slowSamples: Math.max(0, Math.min(10000, Math.trunc(publicFinite(h.slowSamples)))),
            softBlocked: !!deps.isCdnSoftBlocked(host),
        }
    })
    const scores = hd && hd.scores ? {
        block: publicFinite(hd.scores.block),
        allow: publicFinite(hd.scores.allow),
        blockSamples: Math.max(0, Math.trunc(publicFinite(hd.scores.blockSamples))),
        allowSamples: Math.max(0, Math.trunc(publicFinite(hd.scores.allowSamples))),
        trial: hd.scores.trial == null ? null : publicFinite(hd.scores.trial),
    } : null
    return deepFreezePublic({
        version: deps.VERSION,
        updatedAt: Date.now(),
        diagnostics: deps.DiagnosticLog.summary(),
        disabled: !!deps.disabled,
        currentCdn: publicHost(deps.peekCurrentCdn()),
        active: deps.activeCdnList.map(publicHost).filter(Boolean).slice(0, PUBLIC_DIAG_HOST_MAX),
        selectable: deps.getHealthyCdnList().map(publicHost).filter(Boolean).slice(0, PUBLIC_DIAG_HOST_MAX),
        catalog: deps.TRUSTED_CDN_CATALOG.slice(0, PUBLIC_DIAG_HOST_MAX).map(host => ({
            host,
            autoEnabled: !!deps.isCatalogAutoEnabled(host),
            overridden: Object.prototype.hasOwnProperty.call(deps.catalogOverrides, host),
        })),
        black: [...deps.blacklistSet].map(publicHost).filter(Boolean).slice(0, PUBLIC_DIAG_HOST_MAX),
        soft: Object.keys(deps.cdnSoftBlockUntil).filter(deps.isCdnSoftBlocked)
            .map(publicHost).filter(Boolean).slice(0, PUBLIC_DIAG_HOST_MAX),
        dead: deps.listDeadHosts().slice(0, PUBLIC_DIAG_HOST_MAX).map(entry => ({
            host: publicHost(entry.host),
            reason: String(entry.reason || 'unknown').slice(0, 64),
            daysLeft: Math.max(0, publicFinite(entry.daysLeft)),
        })).filter(entry => entry.host),
        health,
        discovered: publicHost(deps.pageDiscoveredCdn),
        redirects: Object.fromEntries(Object.entries(deps.redirectStats)
            .map(([key, value]) => [String(key).slice(0, 40), Math.max(0, publicFinite(value))])),
        buffer: {
            totalMB: Math.max(0, publicFinite(wd.totalMB)), // compatibility alias: cumulative downloaded MB, NOT buffered MB
            downloadedMB: Math.max(0, publicFinite(wd.totalMB)),
            available: wd.readyState >= 0,
            playableSec: wd.readyState >= 0 ? +(wd.bufferAheadSec / (deps.playbackRateState.confirmed ? deps.playbackRateState.observedRate : deps.ASSUMED_PLAYBACK_RATE)).toFixed(2) : null,
            targetMB: Math.max(0, publicFinite(wd.targetMB)),
            bufferAheadSec: Math.max(0, publicFinite(wd.bufferAheadSec)),
            bufferedEndSec: Math.max(0, publicFinite(wd.bufferedEndSec)),
            videoTimeSec: Math.max(0, publicFinite(wd.videoTimeSec)),
            requiredMbps: Math.max(0, publicFinite(wd.requiredMbps)),
            switchCount: Math.max(0, Math.trunc(publicFinite(wd.switchCount))),
            stallCount: Math.max(0, Math.trunc(publicFinite(wd.stallCount))),
            breakerSec: Math.max(0, Math.trunc(publicFinite(wd.breakerSec))),
        },
        playback: {
            observedRate: Math.max(0, publicFinite(deps.playbackRateState.observedRate, deps.ASSUMED_PLAYBACK_RATE)),
            effectiveRate: deps.getEffectivePlaybackRate(deps.playbackRateState.effectiveRate),
            confirmed: !!deps.playbackRateState.confirmed,
            source: ['assumed', 'initial', 'ratechange', 'watchdog', 'performance'].includes(deps.playbackRateState.source)
                ? deps.playbackRateState.source
                : 'assumed',
        },
        mediaDelivery: deps.getMediaDeliverySnapshot(),
        hostRestrictions: deps.hostRestrictionSummary?.() || {},
        nativeRouting: {
            selectedRouteType: ['catalog-generated','native-signed','root-original'].includes(native.currentRouteType)
                ? native.currentRouteType : 'unknown',
            admission: { ...native.admission },
            catalogSuggestionMeaning: 'currentCdn is a catalog suggestion, not an observed route',
            routeRevision: Math.max(0, Math.trunc(publicFinite(native.routeRevision))),
            representationRevision: Math.max(0, Math.trunc(publicFinite(native.representationRevision))),
            activeRepresentation: native.active ? {
                height: Math.max(0, Math.trunc(publicFinite(native.active.height))),
                codec: ['av1','hevc','avc','other'].includes(native.active.codec) ? native.active.codec : 'other',
            } : null,
            tentativeRepresentation: native.tentative ? {
                height: Math.max(0, Math.trunc(publicFinite(native.tentative.height))),
                codec: ['av1','hevc','avc','other'].includes(native.tentative.codec) ? native.tentative.codec : 'other',
            } : null,
            currentGroupNativeCount: Math.max(0, Math.min(4, Math.trunc(publicFinite(native.groupNativeCount)))),
            states: Object.fromEntries(['unknown','provisional','probeQualified','confirmed','invalid']
                .map(key => [key, Math.max(0, Math.trunc(publicFinite(native.counts?.[key])))])),
            suppressedSwitches: {
                probeHealthy: Math.max(0, Math.trunc(publicFinite(native.suppressedSwitches?.probeHealthy))),
                representation: Math.max(0, Math.trunc(publicFinite(native.suppressedSwitches?.representation))),
            },
            ledgerSize: {
                video: Math.max(0, Math.min(48, Math.trunc(publicFinite(native.ledger?.video)))),
                audio: Math.max(0, Math.min(16, Math.trunc(publicFinite(native.ledger?.audio)))),
            },
        },
        playbackQuality: { ...deps.playbackQualitySnapshot },
        currentCodecConfigurations: deps.getCurrentCodecDiagnostics(),
        streamEstimate: {
            metadataSource: deps.streamEstimate.metadataSource || 'unknown',
            source: deps.streamEstimate.source === 'observed-representation'
                ? 'observed-representation'
                : (deps.streamEstimate.source === 'conservative-height-max' ? 'conservative-height-max' : 'unknown'),
            codec: ['av1', 'hevc', 'avc', 'other'].includes(deps.streamEstimate.codec) ? deps.streamEstimate.codec : 'other',
            height: Math.max(0, Math.trunc(publicFinite(deps.streamEstimate.height))),
            videoMbps: Math.max(0, publicFinite(deps.streamEstimate.videoMbps)),
            audioMbps: Math.max(0, publicFinite(deps.streamEstimate.audioMbps)),
        },
        codec: {
            preference: deps.resolvedVideoCodecPreference,
            selectedMeaning: 'sorting-first',
            capabilities: {
                av1_1080: deps.getCodecCapabilityState('av1', 1080),
                av1_2160: deps.getCodecCapabilityState('av1', 2160),
                hevc_1080: deps.getCodecCapabilityState('hevc', 1080),
                hevc_2160: deps.getCodecCapabilityState('hevc', 2160),
            },
            groups: deps.lastCodecDecision.groups.slice(0, 8).map(group => ({
                quality: String(group.quality || '').slice(0, 16),
                selected: ['av1', 'hevc', 'avc', 'other'].includes(group.selected) ? group.selected : 'other',
                capability: ['good', 'bad', 'unknown', 'not-applicable'].includes(group.capability)
                    ? group.capability
                    : 'unknown',
            })),
        },
        httpdns: {
            mode: hd && (hd.mode === true || hd.mode === false || hd.mode === 'auto') ? hd.mode : 'auto',
            block: !!(hd && hd.block),
            ttlMin: Math.max(0, publicFinite(hd && hd.ttlMin)),
            decision: String((hd && hd.decision) || '').slice(0, 32),
            scores,
        },
        uiInjectStatus: String(deps.uiInjectStatus || 'pending').slice(0, 32),
    })
}

let publicDiagnosticSnapshot = deepFreezePublic({ version: deps.VERSION, disabled: !!deps.disabled })

const refreshPublicDiagnosticSnapshot = () => {
    try { publicDiagnosticSnapshot = buildPublicDiagnosticSnapshot() } catch { deps.DiagnosticLog.fault('snapshot') }
    return publicDiagnosticSnapshot
}

refreshPublicDiagnosticSnapshot()

try {
    Object.defineProperty(unsafeWindow, 'BiliCDN', {
        enumerable: true,
        configurable: false,
        get: () => publicDiagnosticSnapshot,
    })
} catch (e) {
    deps.err('[安全] 無法安裝唯讀診斷快照：', e)
}
return { /* TEST_EXPORTS:snapshot */
get describePlaybackBuffer() { return describePlaybackBuffer; },
get publicFinite() { return publicFinite; },
get refreshPublicDiagnosticSnapshot() { return refreshPublicDiagnosticSnapshot; }
};
}
