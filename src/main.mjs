import { createSettings } from './config.mjs';
import { createEvents } from './diagnostics/events.mjs';
import { createRuntime } from './runtime/generation.mjs';
import { createCatalog } from './policy/catalog.mjs';
import { createHostAccess } from './policy/host-access.mjs';
import { createHealth } from './routing/health.mjs';
import { createNativeRoutes } from './routing/native-routes.mjs';
import { createRate } from './playback/rate.mjs';
import { createMediaPolicy } from './policy/media.mjs';
import { createEvidence } from './transport/evidence.mjs';
import { createMedia } from './playback/media.mjs';
import { createHttpdns } from './routing/httpdns.mjs';
import { createRewrite } from './policy/rewrite.mjs';
import { createCodec } from './playback/codec.mjs';
import { createPlayurl } from './playback/playurl.mjs';
import { createTransport } from './transport/interceptors.mjs';
import { createFailures } from './routing/failures.mjs';
import { createDom } from './ui/dom.mjs';
import { createLatency } from './routing/latency.mjs';
import { createBakeoff } from './routing/bakeoff.mjs';
import { createHints } from './runtime/connections.mjs';
import { createProbe } from './routing/probe.mjs';
import { createWatchdog } from './playback/watchdog.mjs';
import { createTrustedUI } from './ui/trusted.mjs';
import { createReport } from './diagnostics/report.mjs';
import { createControls } from './runtime/controls.mjs';
import { createSnapshot } from './diagnostics/snapshot.mjs';
import { createCatalogControls } from './routing/catalog-controls.mjs';
import { createViews } from './ui/control-center.mjs';
import { createApplication } from './runtime/application.mjs';
export function start(settingsInput) {
let settings;
let events;
let runtime;
let catalog;
let health;
let nativeRoutes;
let rate;
let mediaPolicy;
let evidence;
let media;
let httpdns;
let rewrite;
let codec;
let playurl;
let transport;
let failures;
let dom;
let latency;
let bakeoff;
let hints;
let probe;
let watchdog;
let trustedUI;
let report;
let controls;
let snapshot;
let catalogControls;
let views;
let application;
const hostAccess = createHostAccess({
get matchesExclude() { return catalog.matchesExclude; },
get initialDead() { return catalog.INITIAL_DEAD_HOSTS_TW; },
get overrides() { return catalog.catalogOverrides; },
get catalog() { return catalog.TRUSTED_CDN_CATALOG_SET; },
get black() { return health?.blacklistSet; },
get dead() { return health?.knownDeadHosts; },
get soft() { return health?.isCdnSoftBlocked; },
get nativeBlocked() { return nativeRoutes?.isHostSoftBlocked; }
});
settings = createSettings({

}, settingsInput);
events = createEvents({
get VERSION() { return settings.VERSION; },
get TRUSTED_CDN_CATALOG_SET() { return catalog.TRUSTED_CDN_CATALOG_SET; },
get mediaContextActive() { return media.mediaContextActive; }
});
runtime = createRuntime({
get DiagnosticLog() { return events.DiagnosticLog; },
get playinfoEpoch() { return media.playinfoEpoch; },
get resetMediaDelivery() { return media.resetMediaDelivery; },
get invalidateCodecQueries() { return codec.invalidateCodecQueries; },
get resetPlaybackQuality() { return media.resetPlaybackQuality; }
});
catalog = createCatalog({
get ExcludeHostKeywords() { return settings.ExcludeHostKeywords; }
});
health = createHealth({
get isHostAllowed() { return hostAccess.allowed; },
get catalogOverrides() { return catalog.catalogOverrides; },
get TRUSTED_CDN_CATALOG_SET() { return catalog.TRUSTED_CDN_CATALOG_SET; },
get VERSION() { return settings.VERSION; },
get verGte() { return settings.verGte; },
get isValidCustomCdnHost() { return catalog.isValidCustomCdnHost; },
get PREFERRED_CDN_LIST() { return catalog.PREFERRED_CDN_LIST; },
get PROBE_CACHE_KEY() { return latency.PROBE_CACHE_KEY; },
get log() { return events.log; },
get disabled() { return runtime.disabled; },
get matchesExclude() { return catalog.matchesExclude; },
get DiagnosticLog() { return events.DiagnosticLog; },
get getEffectivePlaybackRate() { return rate.getEffectivePlaybackRate; },
get currentStreamBitsPerSec() { return media.currentStreamBitsPerSec; },
get INITIAL_DEAD_HOSTS_TW() { return catalog.INITIAL_DEAD_HOSTS_TW; },
get isUnstableCdnHost() { return mediaPolicy.isUnstableCdnHost; },
get Watchdog() { return watchdog.Watchdog; },
get err() { return events.err; },
get getWarmCdnHost() { return bakeoff.getWarmCdnHost; },
get preconnectBatch() { return hints.preconnectBatch; },
get inSeekGrace() { return rate.inSeekGrace; },
get preconnectCdn() { return hints.preconnectCdn; },
get CustomCDN() { return settings.CustomCDN; },
get PluginName() { return events.PluginName; }
});
nativeRoutes = createNativeRoutes({
get noteHostDiscovery() { return hostAccess.discover; },
get isHostAllowed() { return hostAccess.allowed; },
get noteHostRestriction() { return hostAccess.note; },
get getHealthyCdnList() { return health.getHealthyCdnList; },
get isBiliVideoUrl() { return mediaPolicy.isBiliVideoUrl; },
get gmGet() { return key => GM_getValue(key); },
get gmSet() { return (key, value) => GM_setValue(key, value); },
get gmDelete() { return key => GM_deleteValue(key); },
get TRUSTED_CDN_CATALOG_SET() { return catalog.TRUSTED_CDN_CATALOG_SET; },
get parseMediaHttpUrl() { return mediaPolicy.parseMediaHttpUrl; },
get classifyMediaDelivery() { return mediaPolicy.classifyMediaDelivery; },
get mediaUrlPolicy() { return mediaPolicy.mediaUrlPolicy; },
get isMediaSegmentUrl() { return rewrite.isMediaSegmentUrl; },
get normalizeCodecName() { return codec.normalizeCodecName; },
get playinfoEpoch() { return media.playinfoEpoch; },
get resolvedCdn() { return health.resolvedCdn; },
get disabled() { return runtime.disabled; },
get peekCurrentCdn() { return health.peekCurrentCdn; },
get getRequiredStreamMbps() { return health.getRequiredStreamMbps; },
get getCdnHealthScore() { return health.getCdnHealthScore; },
get scoreRouteHealth() { return health.scoreRouteHealth; },
get cdnHealth() { return health.cdnHealth; },
get playbackRateState() { return rate.playbackRateState; },
get getVideo() { return watchdog.Watchdog.getVideo; },
get DiagnosticLog() { return events.DiagnosticLog; },
// Representation changes and CDN changes are independent.  Auto-quality/codec
// prefetch may move the active representation without moving the media host, so
// this callback may update the sample pointer but must never grant switch grace
// or schedule another measurement round.
get onActiveRepresentation() { return (sampleUrl) => bakeoff.noteActiveSample(sampleUrl); },
get scheduleObservedSample() { return (sampleUrl) => bakeoff.scheduleBakeoff(sampleUrl); },
get buildBackupUrls() { return rewrite.buildBackupUrls; },
get preserveOriginalFallback() { return rewrite.withOriginalStreamFallback; },
get normalizeMediaUrl() { return rewrite.normalizeMediaUrl; },
get decideMediaRewrite() { return rewrite.decideMediaRewrite; },
get replaceUrlHost() { return rewrite.replaceUrlHost; }
});
rate = createRate({
get currentStreamBitsPerSec() { return media.currentStreamBitsPerSec; }
});
mediaPolicy = createMediaPolicy({
get matchesExclude() { return catalog.matchesExclude; },
get knownDeadHosts() { return health.knownDeadHosts; },
get blacklistSet() { return health.blacklistSet; },
get isCdnSoftBlocked() { return health.isCdnSoftBlocked; },
get isValidCustomCdnHost() { return catalog.isValidCustomCdnHost; },
get preconnectCdn() { return hints.preconnectCdn; },
get resolvedCdn() { return health.resolvedCdn; },
get getCurrentCdn() { return health.getCurrentCdn; },
get activeCdnList() { return health.activeCdnList; },
get PREFERRED_CDN_LIST() { return catalog.PREFERRED_CDN_LIST; },
get decideMediaRewrite() { return rewrite.decideMediaRewrite; },
get redirectStats() { return evidence.redirectStats; },
get needsRedirect() { return rewrite.needsRedirect; },
get replaceUrlHost() { return rewrite.replaceUrlHost; }
});
evidence = createEvidence({
get disabled() { return runtime.disabled; },
get isRuntimeGenerationActive() { return runtime.isRuntimeGenerationActive; },
get observeMediaTransfer() { return media.observeMediaTransfer; },
get Watchdog() { return watchdog.Watchdog; },
get recordCdnThroughput() { return health.recordCdnThroughput; },
get recordNativeThroughput() { return nativeRoutes.recordNativeThroughput; },
get playbackRateState() { return rate.playbackRateState; }
});
media = createMedia({
get getEffectivePlaybackRate() { return rate.getEffectivePlaybackRate; },
get getRequiredStreamMbps() { return health.getRequiredStreamMbps; },
get DiagnosticLog() { return events.DiagnosticLog; },
get runtimeGeneration() { return runtime.runtimeGeneration; },
get isMediaSegmentUrl() { return rewrite.isMediaSegmentUrl; },
get captureRuntimeGeneration() { return runtime.captureRuntimeGeneration; },
get isRuntimeGenerationActive() { return runtime.isRuntimeGenerationActive; },
get Watchdog() { return watchdog.Watchdog; },
get classifyMediaDelivery() { return mediaPolicy.classifyMediaDelivery; },
get TRUSTED_CDN_CATALOG_SET() { return catalog.TRUSTED_CDN_CATALOG_SET; },
get disabled() { return runtime.disabled; },
get clearCodecPlayinfo() { return codec.clearCodecPlayinfo; },
get hostLockedStreams() { return rewrite.hostLockedStreams; },
get preservedOriginalStreamUrls() { return rewrite.preservedOriginalStreamUrls; },
get rewrittenStreamOrigins() { return rewrite.rewrittenStreamOrigins; },
get seekGraceUntil() { return rate.seekGraceUntil; }, set seekGraceUntil(value) { rate.seekGraceUntil = value; },
get resetPlaybackRateState() { return rate.resetPlaybackRateState; },
get resetNativeRoutePool() { return nativeRoutes.resetPool; },
get captureNativeRouteContext() { return nativeRoutes.captureRouteContext; },
get pageRepresentation() { return nativeRoutes.pageRepresentation; },
get observeNativeTransport() { return nativeRoutes.observeTransport; }
});
httpdns = createHttpdns({
get BlockHttpDNS() { return settings.BlockHttpDNS; }, set BlockHttpDNS(value) { settings.BlockHttpDNS = value; },
get getRequiredStreamMbps() { return health.getRequiredStreamMbps; },
get redirectStats() { return evidence.redirectStats; },
get PROBE_CACHE_KEY() { return latency.PROBE_CACHE_KEY; }
});
rewrite = createRewrite({
get isHostAllowed() { return hostAccess.allowed; },
get redirectStats() { return evidence.redirectStats; },
get parseMediaHttpUrl() { return mediaPolicy.parseMediaHttpUrl; },
get classifyMediaDelivery() { return mediaPolicy.classifyMediaDelivery; },
get rewriteUnstableMediaUrl() { return mediaPolicy.rewriteUnstableMediaUrl; },
get isAkamaiUrl() { return mediaPolicy.isAkamaiUrl; },
get isForcedRedirect() { return failures.isForcedRedirect; },
get getCurrentCdn() { return health.getCurrentCdn; },
get isBiliFragmentUrl() { return playurl.isBiliFragmentUrl; },
get getBiliVideoCdn() { return mediaPolicy.getBiliVideoCdn; },
get inSeekGrace() { return rate.inSeekGrace; },
get matchesExclude() { return catalog.matchesExclude; },
get knownDeadHosts() { return health.knownDeadHosts; },
get blacklistSet() { return health.blacklistSet; },
get isUnstableCdnHost() { return mediaPolicy.isUnstableCdnHost; },
get DiagnosticLog() { return events.DiagnosticLog; },
get log() { return events.log; },
get resolvedCdn() { return health.resolvedCdn; },
get isCdnStronglyBad() { return health.isCdnStronglyBad; },
get PREFERRED_CDN_LIST() { return catalog.PREFERRED_CDN_LIST; },
get mediaUrlPolicy() { return mediaPolicy.mediaUrlPolicy; },
get isValidCustomCdnHost() { return catalog.isValidCustomCdnHost; },
get MEDIA_URL_MAX_LENGTH() { return mediaPolicy.MEDIA_URL_MAX_LENGTH; },
get getHealthyCdnList() { return health.getHealthyCdnList; },
get STARTUP_PICK() { return health.STARTUP_PICK; },
get isBiliVideoUrl() { return mediaPolicy.isBiliVideoUrl; },
get noteDiscoveredCdn() { return mediaPolicy.noteDiscoveredCdn; },
get isProtectedSignedUrl() { return nativeRoutes.isProtectedSignedUrl; }
});
codec = createCodec({
get PreferredVideoCodec() { return settings.PreferredVideoCodec; },
get disabled() { return runtime.disabled; },
get isRuntimeGenerationActive() { return runtime.isRuntimeGenerationActive; },
get captureRuntimeGeneration() { return runtime.captureRuntimeGeneration; }
});
playurl = createPlayurl({
get clearCodecPlayinfo() { return codec.clearCodecPlayinfo; },
get resetRepresentationRegistry() { return media.resetRepresentationRegistry; },
get streamEstimate() { return media.streamEstimate; }, set streamEstimate(value) { media.streamEstimate = value; },
get streamProfile() { return media.streamProfile; }, set streamProfile(value) { media.streamProfile = value; },
get currentStreamBitsPerSec() { return media.currentStreamBitsPerSec; }, set currentStreamBitsPerSec(value) { media.currentStreamBitsPerSec = value; },
get baseBufferTargetBytes() { return media.baseBufferTargetBytes; }, set baseBufferTargetBytes(value) { media.baseBufferTargetBytes = value; },
get DEFAULT_BUFFER_TARGET_BYTES() { return media.DEFAULT_BUFFER_TARGET_BYTES; },
get registerMediaRepresentation() { return media.registerMediaRepresentation; },
get muxedRepresentationRegistry() { return media.muxedRepresentationRegistry; },
get pickStreamUrls() { return rewrite.pickStreamUrls; },
get AUDIO_REGISTRY_MAX() { return media.AUDIO_REGISTRY_MAX; },
get transformStreamItem() { return rewrite.transformStreamItem; },
get sanitizePlayInfoUrls() { return rewrite.sanitizePlayInfoUrls; },
get normalizeDashCodecPreference() { return codec.normalizeDashCodecPreference; },
get normalizeCodecName() { return codec.normalizeCodecName; },
get rebuildRepresentationRegistry() { return media.rebuildRepresentationRegistry; },
get setBufferTargetFromBitrate() { return media.setBufferTargetFromBitrate; },
get isBiliVideoUrl() { return mediaPolicy.isBiliVideoUrl; },
get isAkamaiUrl() { return mediaPolicy.isAkamaiUrl; },
get scheduleBakeoff() { return nativeRoutes.scheduleStartupSample; },
get err() { return events.err; },
get parseMediaHttpUrl() { return mediaPolicy.parseMediaHttpUrl; },
get mediaUrlPolicy() { return mediaPolicy.mediaUrlPolicy; },
get registerSignedRouteGroup() { return nativeRoutes.registerSignedRouteGroup; },
get retainAffinityForTrustedPlayinfo() { return nativeRoutes.retainAffinityForTrustedPlayinfo; },
get planUnregisteredItem() { return nativeRoutes.planUnregisteredItem; },
get applySignedRoutePlan() { return nativeRoutes.applySignedRoutePlan; }
});
transport = createTransport({
get isHostAllowed() { return hostAccess.allowed; },
get noteHostRestriction() { return hostAccess.note; },
get parseMediaHttpUrl() { return mediaPolicy.parseMediaHttpUrl; },
get disabled() { return runtime.disabled; },
get DiagnosticLog() { return events.DiagnosticLog; },
get isRuntimeGenerationActive() { return runtime.isRuntimeGenerationActive; },
get captureRuntimeGeneration() { return runtime.captureRuntimeGeneration; },
get captureMediaRequest() { return media.captureMediaRequest; },
get isBiliJsonMetadataApi() { return mediaPolicy.isBiliJsonMetadataApi; },
get isHttpDnsUrl() { return mediaPolicy.isHttpDnsUrl; },
get shouldBlockHttpDns() { return httpdns.shouldBlockHttpDns; },
get redirectStats() { return evidence.redirectStats; },
get isMediaSegmentUrl() { return rewrite.isMediaSegmentUrl; },
get getOriginalStreamUrl() { return rewrite.getOriginalStreamUrl; },
get normalizeMediaUrl() { return rewrite.normalizeMediaUrl; },
get getBiliVideoCdn() { return mediaPolicy.getBiliVideoCdn; },
get err() { return events.err; },
get mediaContextActive() { return media.mediaContextActive; },
get handleVerifiedSegmentFailure() { return failures.handleVerifiedSegmentFailure; },
get TRUSTED_XHR_TIMEOUT_EVIDENCE() { return health.TRUSTED_XHR_TIMEOUT_EVIDENCE; },
get observeMediaTransfer() { return media.observeMediaTransfer; },
get Watchdog() { return watchdog.Watchdog; },
get noteSegmentAccounted() { return evidence.noteSegmentAccounted; },
get HARD_FAIL_STATUSES() { return health.HARD_FAIL_STATUSES; },
get recordCdnSuccess() { return health.recordCdnSuccess; },
get noteSegmentBytes() { return evidence.noteSegmentBytes; },
get isPlayUrlApi() { return catalog.isPlayUrlApi; },
get recordCdnThroughput() { return health.recordCdnThroughput; },
get playbackRateState() { return rate.playbackRateState; },
get resolveRequestRoute() { return nativeRoutes.resolveRequestRoute; },
get noteNativeRouteFailure() { return nativeRoutes.noteNativeFailure; },
get recordNativeThroughput() { return nativeRoutes.recordNativeThroughput; },
get canAdoptSpaPlayurl() { return application?.canAdoptSpaPlayurl; }
});
failures = createFailures({
get TRUSTED_CDN_CATALOG() { return catalog.TRUSTED_CDN_CATALOG; },
get isValidCustomCdnHost() { return catalog.isValidCustomCdnHost; },
get disabled() { return runtime.disabled; },
get isMediaSegmentUrl() { return rewrite.isMediaSegmentUrl; },
get DiagnosticLog() { return events.DiagnosticLog; },
get noteHostLockedStream() { return rewrite.noteHostLockedStream; },
get inSeekGrace() { return rate.inSeekGrace; },
get TRUSTED_XHR_TIMEOUT_EVIDENCE() { return health.TRUSTED_XHR_TIMEOUT_EVIDENCE; },
get MIN_THROUGHPUT_SAMPLE_BYTES() { return health.MIN_THROUGHPUT_SAMPLE_BYTES; },
get XHR_TIMEOUT_MIN_ELAPSED_MS() { return health.XHR_TIMEOUT_MIN_ELAPSED_MS; },
get acceptedXhrTimeoutAt() { return health.acceptedXhrTimeoutAt; },
get XHR_TIMEOUT_HOST_GAP_MS() { return health.XHR_TIMEOUT_HOST_GAP_MS; },
get HARD_FAIL_STATUSES() { return health.HARD_FAIL_STATUSES; },
get recordCdnFailure() { return health.recordCdnFailure; },
get handleSegmentConnError() { return latency.handleSegmentConnError; },
get publicFinite() { return snapshot.publicFinite; },
get promoteBestCdnNow() { return health.promoteBestCdnNow; },
get preconnectBatch() { return hints.preconnectBatch; },
get getHealthyCdnList() { return health.getHealthyCdnList; },
get lastSampleSegmentUrl() { return bakeoff.lastSampleSegmentUrl; },
get currentStreamBitsPerSec() { return media.currentStreamBitsPerSec; },
get playbackRateState() { return rate.playbackRateState; },
get runThroughputBakeoff() { return bakeoff.runThroughputBakeoff; },
get trustedBakeoffRequest() { return bakeoff.trustedBakeoffRequest; },
get reportMeasurementFailure() { return runtime.reportMeasurementFailure; },
get beginRouteRecovery() { return nativeRoutes.beginRouteRecovery; }
});
dom = createDom({

});
latency = createLatency({
get isHostAllowed() { return hostAccess.allowed; },
get captureRuntimeGeneration() { return runtime.captureRuntimeGeneration; },
get isRuntimeGenerationActive() { return runtime.isRuntimeGenerationActive; },
get clearRuntimeTimeout() { return runtime.clearRuntimeTimeout; },
get scheduleRuntimeTimeout() { return runtime.scheduleRuntimeTimeout; },
get interceptNetResponse() { return transport.interceptNetResponse; },
get disabled() { return runtime.disabled; },
get knownDeadHosts() { return health.knownDeadHosts; },
get blacklistSet() { return health.blacklistSet; },
get isPresumedDnsFailHost() { return health.isPresumedDnsFailHost; },
get markHostDead() { return health.markHostDead; },
get log() { return events.log; },
get promoteBestCdnNow() { return health.promoteBestCdnNow; },
get DiagnosticLog() { return events.DiagnosticLog; },
get recordCdnLatency() { return health.recordCdnLatency; },
get ensureCdnHealth() { return health.ensureCdnHealth; },
get CDN_HEALTH_CAPS() { return health.CDN_HEALTH_CAPS; },
get scheduleCdnHealthSave() { return health.scheduleCdnHealthSave; },
get softBlockCdn() { return health.softBlockCdn; },
get cdnHealth() { return health.cdnHealth; }
});
bakeoff = createBakeoff({
get isHostAllowed() { return hostAccess.allowed; },
get captureRuntimeGeneration() { return runtime.captureRuntimeGeneration; },
get isRuntimeGenerationActive() { return runtime.isRuntimeGenerationActive; },
get isValidCustomCdnHost() { return catalog.isValidCustomCdnHost; },
get blacklistSet() { return health.blacklistSet; },
get knownDeadHosts() { return health.knownDeadHosts; },
get matchesExclude() { return catalog.matchesExclude; },
get isPresumedDnsFailHost() { return health.isPresumedDnsFailHost; },
get decideMediaRewrite() { return rewrite.decideMediaRewrite; },
get replaceUrlHost() { return rewrite.replaceUrlHost; },
get clearRuntimeTimeout() { return runtime.clearRuntimeTimeout; },
get recordCdnThroughput() { return health.recordCdnThroughput; },
get playbackRateState() { return rate.playbackRateState; },
get recordCdnLatency() { return health.recordCdnLatency; },
get redirectStats() { return evidence.redirectStats; },
get DiagnosticLog() { return events.DiagnosticLog; },
get scheduleRuntimeTimeout() { return runtime.scheduleRuntimeTimeout; },
get interceptNetResponse() { return transport.interceptNetResponse; },
get getAttributedVideoHost() { return media.getAttributedVideoHost; },
get resolvedCdn() { return health.resolvedCdn; },
get lastChosenCdn() { return health.lastChosenCdn; },
get activeCdnList() { return health.activeCdnList; },
get Watchdog() { return watchdog.Watchdog; },
get disabled() { return runtime.disabled; },
get inSeekGrace() { return rate.inSeekGrace; },
get isBiliVideoUrl() { return mediaPolicy.isBiliVideoUrl; },
get isHostLockedStream() { return rewrite.isHostLockedStream; },
get reportMeasurementFailure() { return runtime.reportMeasurementFailure; },
get cdnHealth() { return health.cdnHealth; },
get getRequiredStreamMbps() { return health.getRequiredStreamMbps; },
get PREFERRED_CDN_LIST() { return catalog.PREFERRED_CDN_LIST; },
get isCdnSoftBlocked() { return health.isCdnSoftBlocked; },
get currentStreamBitsPerSec() { return media.currentStreamBitsPerSec; },
get noteHostLockedStream() { return rewrite.noteHostLockedStream; },
get err() { return events.err; },
get getHealthyCdnList() { return health.getHealthyCdnList; },
get addForcedRedirect() { return failures.addForcedRedirect; },
get log() { return events.log; },
get promoteBestCdnNow() { return health.promoteBestCdnNow; },
get PROBE_CACHE_KEY() { return latency.PROBE_CACHE_KEY; },
get getNativeProbeCandidate() { return nativeRoutes.getNativeProbeCandidate; },
get recordNativeProbe() { return nativeRoutes.recordNativeProbe; },
get canUseRouteSample() { return nativeRoutes.canUseRouteSample; },
get isRouteSampleAllowed() { return nativeRoutes.isRouteSampleAllowed; },
get captureRouteContext() { return nativeRoutes.captureRouteContext; },
get getObservedRouteHost() { return nativeRoutes.getObservedRouteHost; },
get setNativeBakeoffDiagnostics() { return nativeRoutes.setLastBakeoff; }
});
hints = createHints({
get isHostAllowed() { return hostAccess.allowed; },
get isValidCustomCdnHost() { return catalog.isValidCustomCdnHost; },
get resolvedCdn() { return health.resolvedCdn; },
get knownDeadHosts() { return health.knownDeadHosts; },
get blacklistSet() { return health.blacklistSet; },
get isCdnSoftBlocked() { return health.isCdnSoftBlocked; },
get matchesExclude() { return catalog.matchesExclude; },
get isPresumedDnsFailHost() { return health.isPresumedDnsFailHost; }
});
probe = createProbe({
get isHostAllowed() { return hostAccess.allowed; },
get activeCdnList() { return health.activeCdnList; },
get cdnHealth() { return health.cdnHealth; },
get knownDeadHosts() { return health.knownDeadHosts; },
get blacklistSet() { return health.blacklistSet; },
get scheduleRuntimeTimeout() { return runtime.scheduleRuntimeTimeout; },
get isStartupBuffering() { return bakeoff.isStartupBuffering; },
get reportMeasurementFailure() { return runtime.reportMeasurementFailure; },
get disabled() { return runtime.disabled; },
get captureRuntimeGeneration() { return runtime.captureRuntimeGeneration; },
get isRuntimeGenerationActive() { return runtime.isRuntimeGenerationActive; },
get resolvedCdn() { return health.resolvedCdn; },
get preconnectCdn() { return hints.preconnectCdn; },
get bakeoffRunning() { return bakeoff.bakeoffRunning; },
get inSeekGrace() { return rate.inSeekGrace; },
get PROBE_CACHE_KEY() { return latency.PROBE_CACHE_KEY; },
get PROBE_CACHE_TTL() { return latency.PROBE_CACHE_TTL; },
get isCdnSoftBlocked() { return health.isCdnSoftBlocked; },
get PREFERRED_CDN_LIST() { return catalog.PREFERRED_CDN_LIST; },
get promoteBestCdnNow() { return health.promoteBestCdnNow; },
get preconnectBatch() { return hints.preconnectBatch; },
get isPresumedDnsFailHost() { return health.isPresumedDnsFailHost; },
get probeCdnLatency() { return latency.probeCdnLatency; },
get log() { return events.log; },
get getHealthyCdnList() { return health.getHealthyCdnList; }
});
watchdog = createWatchdog({
get cdnHealth() { return health.cdnHealth; },
get cdnSoftBlockUntil() { return health.cdnSoftBlockUntil; },
get activeCdnList() { return health.activeCdnList; },
get blacklistSet() { return health.blacklistSet; },
get knownDeadHosts() { return health.knownDeadHosts; },
get PREFERRED_CDN_LIST() { return catalog.PREFERRED_CDN_LIST; },
get scheduleCdnHealthSave() { return health.scheduleCdnHealthSave; },
get promoteBestCdnNow() { return health.promoteBestCdnNow; },
get freshMediaObservation() { return media.freshMediaObservation; },
get DiagnosticLog() { return events.DiagnosticLog; },
get runtimeGeneration() { return runtime.runtimeGeneration; },
get playinfoEpoch() { return media.playinfoEpoch; },
get inSeekGrace() { return rate.inSeekGrace; },
get getAttributedVideoHost() { return media.getAttributedVideoHost; },
get disabled() { return runtime.disabled; },
get wasSegmentAccounted() { return evidence.wasSegmentAccounted; },
get TRUSTED_CDN_CATALOG_SET() { return catalog.TRUSTED_CDN_CATALOG_SET; },
get observeMediaTransfer() { return media.observeMediaTransfer; },
get captureMediaRequest() { return media.captureMediaRequest; },
get syncPlaybackRateFromVideo() { return rate.syncPlaybackRateFromVideo; },
get playbackRateState() { return rate.playbackRateState; },
get recordCdnThroughput() { return health.recordCdnThroughput; },
get bumpSeekGrace() { return rate.bumpSeekGrace; },
get currentStreamBitsPerSec() { return media.currentStreamBitsPerSec; },
get log() { return events.log; },
get readPlaybackDiagnostic() { return report.readPlaybackDiagnostic; },
get HttpDnsAutoPilot() { return httpdns.HttpDnsAutoPilot; },
get reorderCdnsByLatency() { return probe.reorderCdnsByLatency; },
get reportMeasurementFailure() { return runtime.reportMeasurementFailure; },
get isUnstableCdnHost() { return mediaPolicy.isUnstableCdnHost; },
get recordCdnPenalty() { return health.recordCdnPenalty; },
get softBlockCdn() { return health.softBlockCdn; },
get CDN_SOFT_BLOCK_MS() { return health.CDN_SOFT_BLOCK_MS; },
get PROBE_CACHE_KEY() { return latency.PROBE_CACHE_KEY; },
get getWarmCdnHost() { return bakeoff.getWarmCdnHost; },
get getHealthyCdnList() { return health.getHealthyCdnList; },
get preconnectBatch() { return hints.preconnectBatch; },
get preconnectCdn() { return hints.preconnectCdn; },
get scheduleRuntimeTimeout() { return runtime.scheduleRuntimeTimeout; },
get bakeoffRunning() { return bakeoff.bakeoffRunning; },
get lastSampleSegmentUrl() { return bakeoff.lastSampleSegmentUrl; },
get runThroughputBakeoff() { return bakeoff.runThroughputBakeoff; },
get trustedBakeoffRequest() { return bakeoff.trustedBakeoffRequest; },
get resetPlaybackRateState() { return rate.resetPlaybackRateState; },
get syncStreamBitrateFromVideo() { return media.syncStreamBitrateFromVideo; },
get getBufferTargetBytes() { return media.getBufferTargetBytes; },
get getWatchdogRequiredBps() { return media.getWatchdogRequiredBps; },
get resetMediaDelivery() { return media.resetMediaDelivery; },
get getRequiredStreamMbps() { return health.getRequiredStreamMbps; },
get getCdnHealthScore() { return health.getCdnHealthScore; },
get beginRouteRecovery() { return nativeRoutes.beginRouteRecovery; }
});
trustedUI = createTrustedUI({
get Watchdog() { return { getVideo: watchdog.Watchdog.getVideo }; }
});
report = createReport({
get getPagePlayInfoLifecycle() { return application?.getPagePlayInfoLifecycle || (() => ({ state: 'no-new-assignment', timing: 'initial', updatedAt: 0 })); },
get resolvedCdn() { return health.resolvedCdn; },
get hostRestrictionSummary() { return hostAccess.summary; },
get hostRestriction() { return hostAccess.restriction; },
get playbackRateState() { return rate.playbackRateState; },
get Watchdog() { return watchdog.Watchdog; },
get DiagnosticLog() { return events.DiagnosticLog; },
get getHttpDnsStatus() { return httpdns.getHttpDnsStatus; },
get VERSION() { return settings.VERSION; },
get uiInjectStatus() { return runtime.uiInjectStatus; },
get disabled() { return runtime.disabled; },
get activeCdnList() { return health.activeCdnList; },
get getHealthyCdnList() { return health.getHealthyCdnList; },
get blacklistSet() { return health.blacklistSet; },
get listDeadHosts() { return health.listDeadHosts; },
get getCdnShortName() { return health.getCdnShortName; },
get getMediaDeliverySnapshot() { return media.getMediaDeliverySnapshot; },
get describePlaybackBuffer() { return snapshot.describePlaybackBuffer; },
get resolvedVideoCodecPreference() { return codec.resolvedVideoCodecPreference; },
get lastCodecDecision() { return codec.lastCodecDecision; },
get getCurrentCodecDiagnostics() { return codec.getCurrentCodecDiagnostics; },
get streamEstimate() { return media.streamEstimate; },
get playbackQualitySnapshot() { return media.playbackQualitySnapshot; },
get pageDiscoveredCdn() { return mediaPolicy.pageDiscoveredCdn; },
get redirectStats() { return evidence.redirectStats; },
get getNativeRouteDiagnostics() { return nativeRoutes.diagnostics; },
get Config() { return events.Config; }
});
controls = createControls({
get TrustedMenuUI() { return trustedUI.TrustedMenuUI; },
get buildDiagReport() { return report.buildDiagReport; },
get DiagnosticLog() { return events.DiagnosticLog; },
get log() { return events.log; },
get activeCdnList() { return health.activeCdnList; },
get blacklistSet() { return health.blacklistSet; },
get cdnSoftBlockUntil() { return health.cdnSoftBlockUntil; },
get isCdnSoftBlocked() { return health.isCdnSoftBlocked; },
get listDeadHosts() { return health.listDeadHosts; },
get PREFERRED_CDN_LIST() { return catalog.PREFERRED_CDN_LIST; },
get isPresumedDnsFailHost() { return health.isPresumedDnsFailHost; },
get cdnFailCount() { return health.cdnFailCount; },
get cdnHealth() { return health.cdnHealth; },
get getCdnHealthScore() { return health.getCdnHealthScore; },
get playbackRateState() { return rate.playbackRateState; },
get streamEstimate() { return media.streamEstimate; },
get getMediaDeliverySnapshot() { return media.getMediaDeliverySnapshot; },
get getNativeRouteDiagnostics() { return nativeRoutes.diagnostics; },
get playbackQualitySnapshot() { return media.playbackQualitySnapshot; },
get getCurrentCodecDiagnostics() { return codec.getCurrentCodecDiagnostics; },
get resolvedVideoCodecPreference() { return codec.resolvedVideoCodecPreference; },
get getCodecCapabilityState() { return codec.getCodecCapabilityState; },
get lastCodecDecision() { return codec.lastCodecDecision; },
get Config() { return events.Config; },
get redirectStats() { return evidence.redirectStats; },
get pageDiscoveredCdn() { return mediaPolicy.pageDiscoveredCdn; }, set pageDiscoveredCdn(value) { mediaPolicy.pageDiscoveredCdn = value; },
get getHttpDnsStatus() { return httpdns.getHttpDnsStatus; },
get uiInjectStatus() { return runtime.uiInjectStatus; },
get disabled() { return runtime.disabled; },
get resolvedCdn() { return health.resolvedCdn; },
get lastSampleSegmentUrl() { return bakeoff.lastSampleSegmentUrl; },
get inSeekGrace() { return rate.inSeekGrace; },
get bakeoffRunning() { return bakeoff.bakeoffRunning; },
get trustedBakeoffLastAt() { return bakeoff.trustedBakeoffLastAt; },
get TRUSTED_BAKEOFF_MIN_GAP() { return bakeoff.TRUSTED_BAKEOFF_MIN_GAP; },
get runThroughputBakeoff() { return bakeoff.runThroughputBakeoff; },
get trustedBakeoffRequest() { return bakeoff.trustedBakeoffRequest; },
get TRUSTED_CDN_CATALOG() { return catalog.TRUSTED_CDN_CATALOG; },
get getCdnShortName() { return health.getCdnShortName; },
get isHostLockedStream() { return rewrite.isHostLockedStream; },
get clearBlacklist() { return health.clearBlacklist; },
get clearDeadHosts() { return health.clearDeadHosts; },
get CDN_HEALTH_KEY() { return health.CDN_HEALTH_KEY; },
get lastChosenCdn() { return health.lastChosenCdn; }, set lastChosenCdn(value) { health.lastChosenCdn = value; },
get HttpDnsAutoPilot() { return httpdns.HttpDnsAutoPilot; },
get hostLockedStreams() { return rewrite.hostLockedStreams; },
get preservedOriginalStreamUrls() { return rewrite.preservedOriginalStreamUrls; },
get rewrittenStreamOrigins() { return rewrite.rewrittenStreamOrigins; },
get clearNativeRouteLedger() { return nativeRoutes.clearLedger; },
get PROBE_CACHE_KEY() { return latency.PROBE_CACHE_KEY; },
get Watchdog() { return watchdog.Watchdog; },
get setHttpDnsMode() { return httpdns.setHttpDnsMode; },
get reorderRunning() { return probe.reorderRunning; },
get reorderCdnsByLatency() { return probe.reorderCdnsByLatency; },
get TRUSTED_CDN_CATALOG_SET() { return catalog.TRUSTED_CDN_CATALOG_SET; },
get knownDeadHosts() { return health.knownDeadHosts; },
get reviveDeadHost() { return health.reviveDeadHost; },
get promoteBestCdnNow() { return health.promoteBestCdnNow; },
get scheduleCdnHealthSave() { return health.scheduleCdnHealthSave; },
get DEAD_HOSTS_KEY() { return health.DEAD_HOSTS_KEY; },
get isValidCustomCdnHost() { return catalog.isValidCustomCdnHost; },
get ExcludeHostKeywords() { return settings.ExcludeHostKeywords; },
get rebuildPreferredCdnList() { return catalog.rebuildPreferredCdnList; },
get matchesExclude() { return catalog.matchesExclude; },
get getHealthyCdnList() { return health.getHealthyCdnList; }
});
snapshot = createSnapshot({
get getPagePlayInfoLifecycle() { return application?.getPagePlayInfoLifecycle || (() => ({ state: 'no-new-assignment', timing: 'initial', updatedAt: 0 })); },
get hostRestrictionSummary() { return hostAccess.summary; },
get playbackRateState() { return rate.playbackRateState; },
get ASSUMED_PLAYBACK_RATE() { return rate.ASSUMED_PLAYBACK_RATE; },
get Watchdog() { return watchdog.Watchdog; },
get getHttpDnsStatus() { return httpdns.getHttpDnsStatus; },
get TRUSTED_CDN_CATALOG() { return catalog.TRUSTED_CDN_CATALOG; },
get cdnHealth() { return health.cdnHealth; },
get isCdnSoftBlocked() { return health.isCdnSoftBlocked; },
get VERSION() { return settings.VERSION; },
get DiagnosticLog() { return events.DiagnosticLog; },
get disabled() { return runtime.disabled; },
get peekCurrentCdn() { return health.peekCurrentCdn; },
get activeCdnList() { return health.activeCdnList; },
get getHealthyCdnList() { return health.getHealthyCdnList; },
get isCatalogAutoEnabled() { return catalog.isCatalogAutoEnabled; },
get catalogOverrides() { return catalog.catalogOverrides; },
get blacklistSet() { return health.blacklistSet; },
get cdnSoftBlockUntil() { return health.cdnSoftBlockUntil; },
get listDeadHosts() { return health.listDeadHosts; },
get pageDiscoveredCdn() { return mediaPolicy.pageDiscoveredCdn; },
get redirectStats() { return evidence.redirectStats; },
get getEffectivePlaybackRate() { return rate.getEffectivePlaybackRate; },
get getMediaDeliverySnapshot() { return media.getMediaDeliverySnapshot; },
get getNativeRouteDiagnostics() { return nativeRoutes.diagnostics; },
get playbackQualitySnapshot() { return media.playbackQualitySnapshot; },
get getCurrentCodecDiagnostics() { return codec.getCurrentCodecDiagnostics; },
get streamEstimate() { return media.streamEstimate; },
get resolvedVideoCodecPreference() { return codec.resolvedVideoCodecPreference; },
get getCodecCapabilityState() { return codec.getCodecCapabilityState; },
get lastCodecDecision() { return codec.lastCodecDecision; },
get uiInjectStatus() { return runtime.uiInjectStatus; },
get err() { return events.err; }
});
catalogControls = createCatalogControls({
get INITIAL_DEAD_HOSTS_TW() { return catalog.INITIAL_DEAD_HOSTS_TW; },
get disabled() { return runtime.disabled; },
get getCurrentCdn() { return health.getCurrentCdn; },
get STARTUP_PICK() { return health.STARTUP_PICK; },
get getHealthyCdnList() { return health.getHealthyCdnList; },
get preconnectBatch() { return hints.preconnectBatch; },
get reorderCdnsByLatency() { return probe.reorderCdnsByLatency; },
get reportMeasurementFailure() { return runtime.reportMeasurementFailure; },
get catalogOverrides() { return catalog.catalogOverrides; },
get TRUSTED_CDN_CATALOG_SET() { return catalog.TRUSTED_CDN_CATALOG_SET; },
get CATALOG_OVERRIDES_KEY() { return catalog.CATALOG_OVERRIDES_KEY; },
get rebuildPreferredCdnList() { return catalog.rebuildPreferredCdnList; },
get activeCdnList() { return health.activeCdnList; },
get PREFERRED_CDN_LIST() { return catalog.PREFERRED_CDN_LIST; },
get blacklistSet() { return health.blacklistSet; },
get knownDeadHosts() { return health.knownDeadHosts; },
get lastChosenCdn() { return health.lastChosenCdn; }, set lastChosenCdn(value) { health.lastChosenCdn = value; },
get pageDiscoveredCdn() { return mediaPolicy.pageDiscoveredCdn; }, set pageDiscoveredCdn(value) { mediaPolicy.pageDiscoveredCdn = value; },
get PROBE_CACHE_KEY() { return latency.PROBE_CACHE_KEY; },
get clearRuntimeConnectionHints() { return hints.clearRuntimeConnectionHints; },
get promoteBestCdnNow() { return health.promoteBestCdnNow; },
get refreshPublicDiagnosticSnapshot() { return snapshot.refreshPublicDiagnosticSnapshot; },
get TRUSTED_CDN_CATALOG() { return catalog.TRUSTED_CDN_CATALOG; },
get matchesHeaderExclude() { return catalog.matchesHeaderExclude; },
get isPresumedDnsFailHost() { return health.isPresumedDnsFailHost; },
get controlResult() { return controls.controlResult; }
});
views = createViews({
get hostRestriction() { return hostAccess.restriction; },
get TrustedMenuUI() { return trustedUI.TrustedMenuUI; },
get BiliCDNControls() { return controls.BiliCDNControls; },
get refreshPublicDiagnosticSnapshot() { return snapshot.refreshPublicDiagnosticSnapshot; },
get reloadAfterFeedback() { return catalogControls.reloadAfterFeedback; },
get buildDiagReport() { return report.buildDiagReport; },
get copyDiagReport() { return controls.copyDiagReport; },
get listDeadHosts() { return health.listDeadHosts; },
get TRUSTED_CDN_CATALOG_SET() { return new Set(catalog.TRUSTED_CDN_CATALOG_SET); },
get controlResult() { return controls.controlResult; },
get lastSampleSegmentUrl() { return bakeoff.lastSampleSegmentUrl; },
get resolvedCdn() { return health.resolvedCdn; },
get TRUSTED_CDN_CATALOG() { return catalog.TRUSTED_CDN_CATALOG; },
get matchesHeaderExclude() { return catalog.matchesHeaderExclude; },
get catalogOverrides() { return Object.freeze({ ...catalog.catalogOverrides }); },
get knownDeadHosts() { return new Set(health.knownDeadHosts); },
get isPresumedDnsFailHost() { return health.isPresumedDnsFailHost; },
get isCatalogAutoEnabled() { return catalog.isCatalogAutoEnabled; },
get restoreAutomaticDefaults() { return catalogControls.restoreAutomaticDefaults; },
get applyCatalogSelection() { return catalogControls.applyCatalogSelection; },
get cdnSoftBlockUntil() { return Object.freeze({ ...health.cdnSoftBlockUntil }); },
get isCdnSoftBlocked() { return health.isCdnSoftBlocked; },
get blacklistSet() { return new Set(health.blacklistSet); },
get Config() { return Object.freeze({ ...events.Config }); },
get Watchdog() { return { stats: watchdog.Watchdog.stats }; },
get getHttpDnsStatus() { return httpdns.getHttpDnsStatus; },
get lastCodecDecision() { return JSON.parse(JSON.stringify(codec.lastCodecDecision)); },
get disabled() { return runtime.disabled; },
get getCdnShortName() { return health.getCdnShortName; },
get playbackRateState() { return Object.freeze({ ...rate.playbackRateState }); },
get describePlaybackBuffer() { return snapshot.describePlaybackBuffer; },
get streamEstimate() { return Object.freeze({ ...media.streamEstimate }); },
get getNativeRouteDiagnostics() { return nativeRoutes.diagnostics; }
});
if (typeof GM_registerMenuCommand === 'function') views.registerControlMenu(GM_registerMenuCommand);
application = createApplication({
get interceptNetResponse() { return transport.interceptNetResponse; },
get disabled() { return runtime.disabled; }, set disabled(value) { runtime.disabled = value; },
get isPlayUrlApi() { return catalog.isPlayUrlApi; },
get playInfoTransformer() { return playurl.playInfoTransformer; },
get DiagnosticLog() { return events.DiagnosticLog; },
get BlockWebRTC() { return settings.BlockWebRTC; },
get readDiagnosticHidden() { return report.readDiagnosticHidden; }, set readDiagnosticHidden(value) { report.readDiagnosticHidden = value; },
get err() { return events.err; },
get resolvedCdn() { return health.resolvedCdn; },
get activeCdnList() { return health.activeCdnList; },
get preconnectBatch() { return hints.preconnectBatch; },
get crossTabShouldBakeoff() { return bakeoff.crossTabShouldBakeoff; }, set crossTabShouldBakeoff(value) { bakeoff.crossTabShouldBakeoff = value; },
get onBakeoffStart() { return bakeoff.onBakeoffStart; }, set onBakeoffStart(value) { bakeoff.onBakeoffStart = value; },
get isValidCustomCdnHost() { return catalog.isValidCustomCdnHost; },
get matchesExclude() { return catalog.matchesExclude; },
get getPlayingCdnHost() { return bakeoff.getPlayingCdnHost; },
get getHealthyCdnList() { return health.getHealthyCdnList; },
get STARTUP_PICK() { return health.STARTUP_PICK; },
get Watchdog() { return watchdog.Watchdog; },
get bumpSeekGrace() { return rate.bumpSeekGrace; },
get syncPlaybackRateFromVideo() { return rate.syncPlaybackRateFromVideo; },
get PluginName() { return events.PluginName; },
get TrustedMenuUI() { return trustedUI.TrustedMenuUI; },
get openControlCenter() { return views.showControlCenter; },
get stopRuntimeGeneration() { return runtime.stopRuntimeGeneration; },
get cdnProbeStarted() { return catalogControls.cdnProbeStarted; }, set cdnProbeStarted(value) { catalogControls.cdnProbeStarted = value; },
get clearRuntimeConnectionHints() { return hints.clearRuntimeConnectionHints; },
get forcedRedirectHosts() { return failures.forcedRedirectHosts; },
get resetStreamProfile() { return media.resetStreamProfile; },
get bakeoffStartupDefers() { return bakeoff.bakeoffStartupDefers; }, set bakeoffStartupDefers(value) { bakeoff.bakeoffStartupDefers = value; },
get setLastBakeoffAt() { return bakeoff.setLastBakeoffAt; },
get lastSampleSegmentUrl() { return bakeoff.lastSampleSegmentUrl; }, set lastSampleSegmentUrl(value) { bakeoff.lastSampleSegmentUrl = value; },
get bakeoffEpoch() { return bakeoff.bakeoffEpoch; }, set bakeoffEpoch(value) { bakeoff.bakeoffEpoch = value; },
get bakeoffTimer() { return bakeoff.bakeoffTimer; }, set bakeoffTimer(value) { bakeoff.bakeoffTimer = value; },
get bakeoffAbortController() { return bakeoff.bakeoffAbortController; }, set bakeoffAbortController(value) { bakeoff.bakeoffAbortController = value; },
get HttpDnsAutoPilot() { return httpdns.HttpDnsAutoPilot; },
get beginRuntimeGeneration() { return runtime.beginRuntimeGeneration; },
get captureRuntimeGeneration() { return runtime.captureRuntimeGeneration; },
get isRuntimeGenerationActive() { return runtime.isRuntimeGenerationActive; },
get startCdnProbe() { return catalogControls.startCdnProbe; },
get refreshPublicDiagnosticSnapshot() { return snapshot.refreshPublicDiagnosticSnapshot; },
get log() { return events.log; },
get refreshExpiredRestrictions() { return health.refreshExpiredRestrictions; },
get codecResumeItems() { return codec.codecResumeItems; },
get prepareCodecConfigurations() { return codec.prepareCodecConfigurations; },
get discoverCdnFromPage() { return mediaPolicy.discoverCdnFromPage; },
get inSeekGrace() { return rate.inSeekGrace; },
get runThroughputBakeoff() { return bakeoff.runThroughputBakeoff; },
get reportMeasurementFailure() { return runtime.reportMeasurementFailure; },
get clearRuntimeTimeout() { return runtime.clearRuntimeTimeout; },
get probeDeferTimer() { return probe.probeDeferTimer; }, set probeDeferTimer(value) { probe.probeDeferTimer = value; },
get probeDeferCount() { return probe.probeDeferCount; }, set probeDeferCount(value) { probe.probeDeferCount = value; },
get uiInjectStatus() { return runtime.uiInjectStatus; }, set uiInjectStatus(value) { runtime.uiInjectStatus = value; },
get fromHTML() { return dom.fromHTML; },
get SettingsBarTitle() { return mediaPolicy.SettingsBarTitle; },
get describePlaybackBuffer() { return snapshot.describePlaybackBuffer; },
get playbackRateState() { return rate.playbackRateState; },
get ASSUMED_PLAYBACK_RATE() { return rate.ASSUMED_PLAYBACK_RATE; },
get cdnSoftBlockUntil() { return health.cdnSoftBlockUntil; },
get isCdnSoftBlocked() { return health.isCdnSoftBlocked; },
get blacklistSet() { return health.blacklistSet; },
get knownDeadHosts() { return health.knownDeadHosts; },
get getCdnShortName() { return health.getCdnShortName; },
get waitForElm() { return dom.waitForElm; },
get samplePlaybackQuality() { return media.samplePlaybackQuality; },
get readPlaybackDiagnostic() { return report.readPlaybackDiagnostic; }
});
/* TEST_BRIDGE */
}
