import { playurlResult } from '../support/playurl.ts'
import { PlayurlController } from '../../src-v2/application/playurl-controller.ts'
import { decisionId, epochId, generationId, requestId } from '../../src-v2/domain/model.ts'
import { TRUSTED_CATALOG } from '../../src-v2/domain/catalog.ts'
import { parseMediaUrl } from '../../src-v2/domain/url-policy.ts'
import { SignedRouteVault } from '../../src-v2/state/signed-route-vault.ts'
import { RestrictionStore } from '../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../src-v2/state/evidence-store.ts'
import { SettingsStore } from '../../src-v2/state/settings-store.ts'
import { SessionStore } from '../../src-v2/state/session-store.ts'
import { RouteCoordinator } from '../../src-v2/application/route-coordinator.ts'
import { TransportAdapter } from '../../src-v2/adapters/transport.ts'
import { DiagnosticRecorder } from '../../src-v2/diagnostics/recorder.ts'
import type { AppliedRouteDecision } from '../../src-v2/application/route-coordinator.ts'
import type { TransportObservation } from '../../src-v2/domain/model.ts'
import { RecoveryController } from '../../src-v2/application/recovery-controller.ts'
import { PlayerAdapter } from '../../src-v2/adapters/player.ts'
import { PlayurlAdapter } from '../../src-v2/adapters/playurl.ts'
import type { PlayerPort, VideoSnapshot } from '../../src-v2/application/ports.ts'

import { check, equal, assertionCount } from '../support/assert.ts'
import { FakeStorage } from '../support/storage.ts'
import { testScope } from '../support/scope.ts'
const scope = testScope()
try {
const now = 2_000_000_000_000
const clock = { now: () => now }
const runtimeSession = new SessionStore(); runtimeSession.beginGeneration(false)
const passDecision: AppliedRouteDecision = { decision: { action: 'pass', id: decisionId('runtime-pass'), reason: 'test', routeType: 'root-original',
  host: 'upos-sz-mirrorali.bilivideo.com', ranking: [] }, url: 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/runtime.m4s', context: null, streamKey: 'runtime', sourceHost: 'upos-sz-mirrorali.bilivideo.com' }
const observations: TransportObservation[] = []
const routeStub = {
  requestStarted(): void {},
  isCatalogOnly(): boolean { return false },
  isBilibiliMedia(url: string): boolean { return /\.bilivideo\.com\/|\.akamaized\.net\//.test(url) },
  recognizesMedia(url: string): boolean { return parseMediaUrl(url)?.kind !== 'unknown' },
  inspectOriginal(url: string): AppliedRouteDecision { return this.apply(url) },
  apply(url: string): AppliedRouteDecision { return { ...passDecision, url } },
  async observe(observation: TransportObservation): Promise<void> { observations.push(observation) },
}
let transformed = 0
const playurlStub = { transform() { transformed++; return playurlResult(true) } }
let disabled = false, blockHttpDns = true
const settingsStub = { get: () => ({ disabled, blockHttpDns, considerNativeSources: true }) }
let nativeFetchCalls = 0, cancelReason: unknown = null
let playurlFetchBody = JSON.stringify({ code: 0, data: { dash: { video: [], audio: [] } } })
let playurlFetchOverride: Response | null = null
const nativeFetchUrls: string[] = []
const nativeFetchMethods: string[] = []
const nativeFetchRedirects: RequestRedirect[] = []
const nativeFetchHeaders: (string | null)[] = []
let streamedRequestBody = ''
const nativeFetch = async (input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
  nativeFetchCalls++
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  nativeFetchUrls.push(url)
  nativeFetchMethods.push(input instanceof Request ? input.method : String(_init?.method ?? 'GET'))
  nativeFetchRedirects.push(input instanceof Request ? input.redirect : String(_init?.redirect ?? 'follow') as RequestRedirect)
  nativeFetchHeaders.push(input instanceof Request ? input.headers.get('x-bilicdn-test') : null)
  if (url.includes('/stream-body.m4s') && input instanceof Request) streamedRequestBody = await input.text()
  if (url.includes('/player/wbi/playurl')) return playurlFetchOverride ?? new Response(playurlFetchBody, { status: 200 })
  let emitted = false
  return new Response(new ReadableStream<Uint8Array>({
    pull(controller) { if (!emitted) { emitted = true; controller.enqueue(new Uint8Array(70 * 1024)) } },
    cancel(reason) { cancelReason = reason },
  }), { status: 206, headers: { 'content-type': 'video/mp4' } })
}

class FakeXhr extends EventTarget {
  method = ''; url = ''; readyState = 0; status = 200; responseURL = ''; responseType: XMLHttpRequestResponseType = ''
  finalResponseUrl: string | null = null
  rawResponseText: string | null = null
  holdAtLoading = false
  timeout = 0; withCredentials = false
  payload: unknown = { ok: true }; nativeSends = 0
  get response(): unknown { return this.payload }
  get responseText(): string { return this.rawResponseText ?? JSON.stringify(this.payload) }
  open(method: string, url: string | URL): void { this.method = method; this.url = String(url); this.responseURL = this.url; this.readyState = 1 }
  send(): void { this.nativeSends++; if (this.finalResponseUrl) this.responseURL = this.finalResponseUrl;
    this.readyState = this.holdAtLoading ? 3 : 4
    this.dispatchEvent(new Event('readystatechange'))
    if (!this.holdAtLoading) { this.dispatchEvent(new Event('load')); this.dispatchEvent(new Event('loadend')) } }
  abort(): void { this.dispatchEvent(new Event('abort')) }
  setRequestHeader(_name: string, _value: string): void {}
}

const originalWorker = function WorkerIdentity() { return undefined }
const fakeWindow = { fetch: nativeFetch, XMLHttpRequest: FakeXhr, Worker: originalWorker, navigator: globalThis.navigator }
Object.defineProperty(globalThis, 'unsafeWindow', { configurable: true, value: fakeWindow })
Object.defineProperty(globalThis, 'location', { configurable: true, value: new URL('https://www.bilibili.com/video/BVtest/') })
let skippedPreflightReason = ''
const measurementStub = { willGateStartup: (): boolean => false, prepareStartup: async (): Promise<void> => {},
  noteUnpreflighted(reason: string): void { skippedPreflightReason = reason } }
const transport = scope.own(new TransportAdapter(runtimeSession, settingsStub, routeStub, playurlStub, measurementStub, () => now))
transport.install()
equal(transport.snapshot().hookState, 'installed', 'Fetch and XHR hook assignments are verified')
const mediaResponse = await fakeWindow.fetch(passDecision.url ?? '')
const firstIntercept = transport.snapshot().lastMediaRequest
check(firstIntercept?.hookEntered && firstIntercept.mediaRecognized && firstIntercept.nativeCalled && firstIntercept.responseObserved,
  'diagnostic stages distinguish hook entry, media recognition, native invocation and response')
const mediaReader = mediaResponse.body?.getReader()
check(mediaReader, 'fetch wrapper returns a readable body')
await mediaReader?.read()
await mediaReader?.cancel('caller-cancel')
equal(cancelReason, 'caller-cancel', 'fetch cancel reason reaches original reader')
equal(observations.at(-1)?.outcome, 'abort', 'cancel settles as abort once')
equal(observations.at(-1)?.finalHost, null, 'empty response URL never invents a response host')
const beforeHttpDns = nativeFetchCalls
const blockedDns = await fakeWindow.fetch('https://httpdns.bilivideo.com/resolve')
equal(blockedDns.status, 503, 'HTTPDNS manual block returns local response')
equal(nativeFetchCalls, beforeHttpDns, 'HTTPDNS block performs no native request')
disabled = true
await fakeWindow.fetch('https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/disabled.m4s')
equal(nativeFetchCalls, beforeHttpDns + 1, 'disabled mode passes site fetch through')
disabled = false
const gatedUrl = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/gated.m4s'
const gateControl: { release: () => void } = { release: () => undefined }
let gateReady = false
measurementStub.willGateStartup = () => true
measurementStub.prepareStartup = async () => { await new Promise<void>(resolve => { gateControl.release = resolve }); gateReady = true }
routeStub.apply = (url: string): AppliedRouteDecision => gateReady ? { ...passDecision,
  decision: { action: 'rewrite', id: decisionId('gated-rewrite'), reason: 'preflight', routeType: 'catalog-generated',
    host: TRUSTED_CATALOG[0], candidate: { type: 'catalog-generated', host: TRUSTED_CATALOG[0], kind: 'video', catalogIndex: 0 }, ranking: [] },
  url: url.replace('upos-sz-mirrorali.bilivideo.com', TRUSTED_CATALOG[0]) } : { ...passDecision, url }
const beforeGate = nativeFetchCalls
const gatedFetch = fakeWindow.fetch(gatedUrl)
equal(nativeFetchCalls, beforeGate, 'Fetch player request waits before native dispatch')
gateControl.release()
await gatedFetch
equal(new URL(nativeFetchUrls.at(-1) ?? '').host, TRUSTED_CATALOG[0], 'Fetch dispatch uses preflight winner')
gateReady = false
const mutableMediaUrl = new URL(gatedUrl)
const mutableInit: RequestInit = { method: 'GET' }
const beforeLifecycleGate = nativeFetchCalls
const lifecycleFetch = fakeWindow.fetch(mutableMediaUrl, mutableInit)
equal(nativeFetchCalls, beforeLifecycleGate, 'generation-switch Fetch waits at the same startup boundary')
mutableMediaUrl.hostname = 'upos-sz-mirrorcosov.bilivideo.com'
mutableInit.method = 'POST'
runtimeSession.beginGeneration(false)
gateControl.release()
await lifecycleFetch
equal(nativeFetchUrls.at(-1), gatedUrl, 'generation-switch Fetch sends the checked URL, not mutated input')
equal(nativeFetchMethods.at(-1), 'GET', 'generation-switch Fetch sends the checked method, not mutated init')
const originalInspect = routeStub.inspectOriginal
const staleForbiddenUrl = 'https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/a/b/stale.m4s'
routeStub.inspectOriginal = (url: string): AppliedRouteDecision => url === staleForbiddenUrl
  ? { ...passDecision, url: null, decision: { action: 'block', id: decisionId('stale-black'), reason: 'black',
    routeType: 'root-original', host: 'upos-sz-mirrorcosov.bilivideo.com', ranking: [] } }
  : { ...passDecision, url }
gateReady = false
const beforeStaleForbidden = nativeFetchCalls
const staleForbiddenFetch = fakeWindow.fetch(staleForbiddenUrl)
runtimeSession.beginGeneration(false)
gateControl.release()
await staleForbiddenFetch.then(() => { throw new Error('stale generation must still block restricted original') }, () => undefined)
equal(nativeFetchCalls, beforeStaleForbidden, 'stale generation cannot dispatch a restricted original media host')
routeStub.inspectOriginal = originalInspect
const requestInput = new Request(gatedUrl, { method: 'GET' })
measurementStub.willGateStartup = () => false
await fakeWindow.fetch(requestInput)
equal(new URL(nativeFetchUrls.at(-1) ?? '').host, TRUSTED_CATALOG[0], 'Fetch Request input dispatch uses the selected host')
const headerRequest = new Request(gatedUrl, { headers: { 'x-bilicdn-test': 'kept' } })
await fakeWindow.fetch(headerRequest)
equal(nativeFetchHeaders.at(-1), 'kept', 'rewritten Request preserves request headers')
await fakeWindow.fetch(new URL(gatedUrl))
equal(new URL(nativeFetchUrls.at(-1) ?? '').host, TRUSTED_CATALOG[0], 'URL object is normalized before rewrite')
measurementStub.willGateStartup = () => true
gateReady = false
const gatedXhr = new FakeXhr()
gatedXhr.open('GET', gatedUrl)
gatedXhr.send()
equal(gatedXhr.nativeSends, 0, 'async XHR send waits before native dispatch')
gateControl.release()
await new Promise(resolve => setTimeout(resolve, 0))
equal(gatedXhr.nativeSends, 1, 'async XHR sends exactly once after preflight')
equal(new URL(gatedXhr.url).host, TRUSTED_CATALOG[0], 'XHR dispatch uses preflight winner')
gateReady = false
const abortedXhr = new FakeXhr()
abortedXhr.open('GET', gatedUrl); abortedXhr.send(); abortedXhr.abort()
gateControl.release()
await new Promise(resolve => setTimeout(resolve, 0))
equal(abortedXhr.nativeSends, 0, 'XHR abort during preflight never dispatches the website request')
const finiteTimeoutXhr = new FakeXhr(); finiteTimeoutXhr.timeout = 5000
finiteTimeoutXhr.open('GET', gatedUrl); finiteTimeoutXhr.send()
equal(finiteTimeoutXhr.nativeSends, 1, 'explicit XHR timeout bypasses delay to preserve native timeout semantics')
equal(skippedPreflightReason, 'preflight-skipped:xhr-explicit-timeout', 'XHR timeout is labelled as skipped preflight, not skipped interception')
const forbiddenNonGetUrl = 'https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/a/b/forbidden.m4s'
routeStub.apply = (url: string): AppliedRouteDecision => ({ ...passDecision, url: url === forbiddenNonGetUrl ? null : url,
  decision: url === forbiddenNonGetUrl ? { action: 'block', id: decisionId('blocked-non-get'), reason: 'black',
    routeType: 'root-original', host: 'upos-sz-mirrorcosov.bilivideo.com', ranking: [] } : passDecision.decision })
const beforeForbidden = nativeFetchCalls
await fakeWindow.fetch(forbiddenNonGetUrl, { method: 'POST' }).then(() => { throw new Error('blacklisted POST Fetch must reject locally') }, () => undefined)
equal(nativeFetchCalls, beforeForbidden, 'blacklisted non-GET Fetch never reaches native fetch')
const forbiddenXhr = new FakeXhr(); forbiddenXhr.open('POST', forbiddenNonGetUrl); forbiddenXhr.send()
equal(forbiddenXhr.nativeSends, 0, 'blacklisted non-GET XHR never reaches native send')
equal(transport.snapshot().lastBlocked?.reason, 'black', 'local block diagnostics retain the reason without a URL')
const forbiddenRequest = new Request(forbiddenNonGetUrl, { method: 'POST' })
await fakeWindow.fetch(forbiddenRequest).then(() => { throw new Error('blacklisted Request object must reject locally') }, () => undefined)
equal(nativeFetchCalls, beforeForbidden, 'blacklisted Request object never reaches native fetch')
const spoofedRequest = new Request(forbiddenNonGetUrl, { method: 'POST' })
Object.defineProperty(spoofedRequest, 'href', { value: 'https://upos-sz-mirrorali.bilivideo.com/live-bvc/allowed.m4s' })
await fakeWindow.fetch(spoofedRequest).then(() => { throw new Error('forged Request.href must not bypass blocked POST') }, () => undefined)
equal(nativeFetchCalls, beforeForbidden, 'Fetch checks the Request internal URL, not a forged href expando')
measurementStub.willGateStartup = () => false
const converseRequest = new Request(passDecision.url ?? '')
Object.defineProperty(converseRequest, 'href', { value: forbiddenNonGetUrl })
await fakeWindow.fetch(converseRequest)
equal(nativeFetchUrls.at(-1), passDecision.url, 'forged forbidden href cannot block an allowed Request')
const beforeDnsRequest = nativeFetchCalls
const spoofedDns = new Request('https://httpdns.bilivideo.com/resolve')
Object.defineProperty(spoofedDns, 'href', { value: passDecision.url })
const spoofedDnsResponse = await fakeWindow.fetch(spoofedDns)
equal(spoofedDnsResponse.status, 503, 'forged Request.href cannot bypass HTTPDNS block')
equal(nativeFetchCalls, beforeDnsRequest, 'blocked HTTPDNS Request never reaches native fetch')
routeStub.inspectOriginal = (url: string): AppliedRouteDecision => ({ ...passDecision, url })
const overrideRequest = new Request(gatedUrl, { method: 'GET' })
await fakeWindow.fetch(overrideRequest, { method: 'POST' })
equal(nativeFetchMethods.at(-1), 'POST', 'init.method override is preserved for native Fetch')
equal(nativeFetchUrls.at(-1), gatedUrl, 'non-GET method override is not rewritten as a GET')
const streamBody = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode('stream-ok')); controller.close() } })
await fakeWindow.fetch(new Request('https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/stream-body.m4s',
  { method: 'POST', body: streamBody, duplex: 'half' } as RequestInit))
equal(streamedRequestBody, 'stream-ok', 'normalized POST Request preserves a streaming body')
measurementStub.willGateStartup = () => false
const xhr = new FakeXhr()
xhr.responseType = 'json'
xhr.payload = { code: 0, data: { dash: { video: [], audio: [] } } }
xhr.open('GET', 'https://api.bilibili.com/x/player/wbi/playurl')
xhr.send()
void xhr.response
equal(transformed, 1, 'XHR JSON playurl is transformed lazily once')
equal(fakeWindow.Worker, originalWorker, 'Worker constructor identity is untouched')
transport.dispose()
class UnpatchableXhr extends FakeXhr {}
Object.defineProperty(UnpatchableXhr.prototype, 'send', { value: FakeXhr.prototype.send, writable: false, configurable: true })
const partialWindow = { fetch: nativeFetch, XMLHttpRequest: UnpatchableXhr }
Object.defineProperty(globalThis, 'unsafeWindow', { configurable: true, value: partialWindow })
const originalPartialOpen = UnpatchableXhr.prototype.open
const partialTransport = scope.own(new TransportAdapter(runtimeSession, settingsStub, routeStub, playurlStub,
  measurementStub, () => now))
partialTransport.install()
equal(partialTransport.snapshot().hookState, 'failed', 'partial hook installation is reported as failed')
equal(partialWindow.fetch, nativeFetch, 'partial XHR install failure restores fetch')
equal(UnpatchableXhr.prototype.open, originalPartialOpen, 'partial XHR install failure restores open')
Object.defineProperty(globalThis, 'unsafeWindow', { configurable: true, value: fakeWindow })

let recoveryNow = now, reloads = 0, seeks: number[] = [], rates: number[] = [], plays = 0
let playerSnapshot: VideoSnapshot = { available: true, paused: false, seeking: false, ended: false, readyState: 4,
  currentTime: 349.434, duration: 900, width: 1920, height: 1080, playbackRate: 2, effectiveRate: 2,
  bufferAheadSec: 30, playableBufferSec: 15, bufferedToEnd: false, frames: 1000, mediaError: false,
  coreInitialized: true, manifestHasVideo: true }
const recoveryPlayer: PlayerPort = {
  observePlayIntent: () => () => undefined, snapshot: () => playerSnapshot, syncManifest: () => true, reload: () => { reloads++ },
  currentTime: () => 349.434, playbackRate: () => 2, seek: value => { seeks.push(value) }, setRate: value => { rates.push(value) },
  play: () => { plays++; return Promise.resolve() }, reset: () => undefined,
}

const healthyCustomRate = { ...playerSnapshot, playbackRate: 1.5, effectiveRate: 1.5 }
const healthyObservation: TransportObservation = { generation: generationId(1), epoch: epochId(1), decisionId: decisionId('aggregate'),
  representation: null, kind: 'video', routeType: 'catalog-generated', originalHost: 'a.example', targetHost: 'b.example', finalHost: 'b.example',
  status: 206, bytes: 100_000, ttfbMs: 20, elapsedMs: 100, completedAt: now, outcome: 'success', streamKey: 'aggregate' }

const outputStorage = new FakeStorage(), outputSession = new SessionStore()
const outputState = outputSession.beginGeneration(false), outputVault = new SignedRouteVault()
outputVault.reset(outputState.generation, outputState.epoch)
const outputSettings = scope.own(new SettingsStore(outputStorage, () => now))
await outputSettings.update({ considerNativeSources: true })
const outputRestrictions = scope.own(new RestrictionStore(outputStorage, () => now))
const outputEvidence = scope.own(new EvidenceStore(outputStorage, () => now))
const outputRoutes = new RouteCoordinator(clock, outputSession, outputSettings, outputRestrictions, outputEvidence, outputVault)
const outputAdapter = new PlayurlAdapter(new PlayurlController(outputSession, outputVault, outputRoutes, outputSettings))
const forbiddenUrl = 'https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/test/output/1.m4s?k=1'
const outputItem = { id: 80, codecid: 13, height: 1080, bandwidth: 1_000_000, base_url: forbiddenUrl, backup_url: [forbiddenUrl] }
outputAdapter.transform({ data: { dash: { video: [outputItem], audio: [] } } })
check(![outputItem.base_url, ...outputItem.backup_url].some(url => url.includes('mirrorcosov')), 'forbidden original cannot remain in playurl primary or backup')
const exceptionalForbidden = `${forbiddenUrl}&os=mcdn`
equal(outputRoutes.apply(exceptionalForbidden).url, null, 'default-unavailable source cannot pass through PCDN guard')
equal(outputRoutes.apply(forbiddenUrl.replace('/upgcxcode/', '/live-bvc/')).url, null, 'default-unavailable live source is locally blocked without host replacement')
equal(outputRoutes.apply(forbiddenUrl.replace('/upgcxcode/', '/v1/resource/')).url, null, 'default-unavailable resource source is locally blocked')
equal(outputRoutes.apply('https://upos-sz-mirrorali.bilivideo.com/live-bvc/test/output/1.m4s?k=1').decision.action, 'pass', 'unrestricted live source remains untouched')
const exceptionalItem = { ...outputItem, base_url: exceptionalForbidden, backup_url: [exceptionalForbidden] }
outputAdapter.transform({ data: { dash: { video: [exceptionalItem], audio: [] } } })
equal(exceptionalItem.base_url, '', 'playurl cannot emit a default-unavailable PCDN-marked primary')
equal(exceptionalItem.backup_url.length, 0, 'playurl cannot emit a default-unavailable PCDN-marked backup')
const opaquePrimary = 'https://upos-hz-mirrorakam.akamaized.net/opaque/video-chunk?signature=private'
const opaqueBackup = 'https://upos-sz-mirrorali.bilivideo.com/opaque/video-chunk?signature=private'
const opaqueItem = { id: 81, codecid: 13, height: 1080, bandwidth: 1_000_000, base_url: opaquePrimary, backup_url: [opaqueBackup] }
outputAdapter.transform({ data: { dash: { video: [opaqueItem], audio: [] } } }, 'page-hint')
equal(opaqueItem.base_url, opaquePrimary, 'legal opaque signed primary is not emptied by playurl assembly')
const opaqueLineage = outputRoutes.apply(opaquePrimary)
equal(opaqueLineage.attributionStatus, 'weak', 'opaque signed output remains observation-only')
equal(opaqueLineage.playurlOutput?.outputHost, new URL(opaquePrimary).host,
  'an exact opaque output still links playurl delivery to the later segment request by host')
await outputRestrictions.add({ host: 'upos-hz-mirrorakam.akamaized.net', type: 'black', kind: 'all', reason: 'opaque-output', expireAt: now + 60_000 })
const opaqueRestricted = { ...opaqueItem, base_url: opaquePrimary, backup_url: [opaqueBackup] }
outputAdapter.transform({ data: { dash: { video: [opaqueRestricted], audio: [] } } }, 'page-hint')
equal(opaqueRestricted.base_url, opaqueBackup, 'opaque signed fallback uses its own exact URL when source is forbidden')
await outputRestrictions.remove('upos-hz-mirrorakam.akamaized.net', 'black')
const mixedItem = { id: 82, codecid: 13, height: 1080, bandwidth: 1_000_000,
  base_url: 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/test/mixed/82.m4s?signature=private',
  backup_url: ['https://upos-hz-mirrorakam.akamaized.net/opaque/mixed-82?signature=private'] }
outputAdapter.transform({ data: { dash: { video: [mixedItem], audio: [] } } }, 'page-hint')
check(mixedItem.backup_url.includes('https://upos-hz-mirrorakam.akamaized.net/opaque/mixed-82?signature=private'),
  'normal primary retains a legal exact opaque signed backup')
const alternateOutput = outputItem.backup_url.find(url => new URL(url).host !== new URL(outputItem.base_url).host)
check(alternateOutput, 'playurl includes a legal alternate backup')
const fallbackApplied = outputRoutes.apply(alternateOutput ?? '')
equal(fallbackApplied.url, alternateOutput, 'player requested output backup is not pulled back to primary')
equal(fallbackApplied.decision.reason, 'player-fallback', 'player backup has explicit coordinated decision')
equal(outputRoutes.apply(outputItem.base_url).url, alternateOutput, 'subsequent group requests retain adopted backup')

let coreClock = now, coreReloads = 0
const coreRecorder = new DiagnosticRecorder(() => coreClock, () => false)
const coreObserver = scope.own(new RecoveryController({ ...recoveryPlayer, reload: () => { coreReloads++ } }, () => coreClock))
coreObserver.subscribe(event => coreRecorder.record(event))
coreObserver.tick({ ...playerSnapshot, paused: false, readyState: 4, width: 1920, height: 1080 })
const deadPaused = { ...playerSnapshot, paused: true, readyState: 0, width: 0, height: 0, frames: 0, coreInitialized: false }
for (let tick = 0; tick < 5; tick++) { coreClock += 1000; coreObserver.tick(deadPaused) }
check(coreRecorder.snapshot().incident, 'paused dead core automatically captures an incident')
equal(coreReloads, 0, 'dead paused core without play intent never reloads')
coreClock += 31_000; coreRecorder.tick()
const frozenCore = coreRecorder.snapshot().incident
coreRecorder.mark()
equal(coreRecorder.snapshot().incident?.id, frozenCore?.id, 'late manual mark preserves frozen automatic incident')
for (let tick = 0; tick < 100; tick++) { coreClock += 1000; coreObserver.tick(deadPaused) }
equal(coreRecorder.snapshot().incident?.id, frozenCore?.id, 'continuous dead core does not replace its own incident')

const outputRep = outputVault.contextForUrl(outputItem.base_url)!.representation
const playurlLineage = (outputRoutes.apply(outputItem.base_url) as AppliedRouteDecision & {
  playurlOutput?: { originalHost: string; outputHost: string; source: string; decisionId: string; role: string }
}).playurlOutput
equal(playurlLineage?.originalHost, 'upos-sz-mirrorcosov.bilivideo.com', 'playurl lineage retains the original host without retaining a signed URL')
equal(playurlLineage?.outputHost, new URL(outputItem.base_url).host, 'playurl lineage names the host actually offered to the player')
equal(playurlLineage?.source, 'trusted-api', 'playurl lineage identifies trusted API output separately from page hints')
check(!!playurlLineage?.decisionId && playurlLineage.role === 'primary', 'playurl output links its plan to a primary request')
const alternateHost = new URL(alternateOutput!).host
for (const type of ['black', 'dead'] as const) {
  await outputRestrictions.add({ host: alternateHost, type, kind: 'all', reason: 'regression', expireAt: now + 60_000 })
  check(outputRoutes.apply(alternateOutput!).decision.host !== alternateHost, `${type} invalidates cached fallback on next request`)
  await outputSettings.update({ fixedHost: alternateHost })
  outputRoutes.invalidateForUserSetting()
  check(outputRoutes.apply(alternateOutput!).decision.host !== alternateHost, `fixed CDN cannot bypass ${type}`)
  const item = { ...outputItem, base_url: forbiddenUrl, backup_url: [alternateOutput!] }
  outputAdapter.transform({ data: { dash: { video: [item], audio: [] } } })
  check(![item.base_url, ...item.backup_url].some(url => url && new URL(url).host === alternateHost), `${type} filtered from all playurl outputs`)
  await outputRestrictions.remove(alternateHost, type)
}
await outputSettings.update({ fixedHost: null })
outputRoutes.invalidateForUserSetting()
outputRoutes.setOriginalComparison(true)
equal(outputSettings.get().fixedHost, null, 'per-tab original comparison does not overwrite saved routing settings')
const nativeControlUrl = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/control/clip.m4s?signature=private'
const nativeControlBackup = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/control/clip.m4s?signature=other'
const controlItem = { id: 240, codecid: 13, height: 1080, bandwidth: 1_000_000,
  base_url: nativeControlUrl, backup_url: [nativeControlBackup] }
outputAdapter.transform({ data: { dash: { video: [controlItem], audio: [] } } }, 'page-hint')
equal(controlItem.base_url, nativeControlUrl, 'original comparison mode does not rewrite a legal playurl primary')
equal(controlItem.backup_url[0], nativeControlBackup, 'original comparison mode preserves the exact legal signed backup')
equal(outputRoutes.apply(nativeControlUrl).url, nativeControlUrl, 'original comparison mode passes the exact segment URL')
equal(outputRoutes.startupOptions(nativeControlUrl), null, 'original comparison mode does not launch cold preflight')
equal(outputRoutes.challenge(outputVault.contextForUrl(nativeControlUrl)!.representation,
  { kind: 'video', requiredMbps: 3, highDemand: false }, false), null, 'original comparison mode starts no healthy probe')
await outputRestrictions.add({ host: 'upos-sz-mirrorali.bilivideo.com', type: 'black', kind: 'all', reason: 'original-mode', expireAt: now + 60_000 })
equal(outputRoutes.apply(nativeControlUrl).url, null, 'original comparison mode does not bypass a prohibited original host')
const blockedControlItem = { ...controlItem, base_url: nativeControlUrl, backup_url: [nativeControlBackup] }
outputAdapter.transform({ data: { dash: { video: [blockedControlItem], audio: [] } } }, 'page-hint')
equal(blockedControlItem.base_url, nativeControlBackup, 'original comparison promotes an exact legal signed backup when primary is forbidden')
const promotedRep = outputVault.contextForUrl(nativeControlBackup)!.representation
const promotedPlan = outputRoutes.snapshot().recentPlans
check(promotedPlan.some(row => row.host === new URL(nativeControlBackup).host && row.action === 'pass' && row.reason === 'original-backup'),
  'the reported plan names the backup actually offered to the player, not the blocked primary')
equal(outputVault.outputRole(promotedRep, nativeControlBackup)?.decisionId,
  promotedPlan.find(row => row.host === new URL(nativeControlBackup).host && row.reason === 'original-backup')?.id,
  'promoted backup lineage points to its accurate route decision')
await outputRestrictions.remove('upos-sz-mirrorali.bilivideo.com', 'black')
outputRoutes.setOriginalComparison(false)
const ungroupedHost = TRUSTED_CATALOG[0]
const ungroupedUrl = `https://${ungroupedHost}/upgcxcode/test/ungrouped/1.m4s?k=1`
await outputRestrictions.add({ host: ungroupedHost, type: 'black', kind: 'audio', reason: 'ungrouped-audio', expireAt: now + 60_000 })
check(outputRoutes.apply(ungroupedUrl).decision.host !== ungroupedHost,
  'ungrouped media cannot use a host with an audio-only blacklist')
await outputRestrictions.remove(ungroupedHost, 'black')
const audioScopedUrl = `https://${ungroupedHost}/upgcxcode/test/audio/1.m4s?k=1`
const audioScopedRep = outputVault.register({ generation: outputState.generation, epoch: outputState.epoch, kind: 'audio',
  key: 'scope-audio', height: 0, codec: 'other', bandwidth: 128_000, urls: [audioScopedUrl], source: 'trusted-api' })
check(audioScopedRep, 'matched audio representation exists for blacklist coverage')
await outputRestrictions.add({ host: ungroupedHost, type: 'black', kind: 'all', reason: 'user', expireAt: now + 60_000 })
check(outputRoutes.apply(audioScopedUrl).decision.host !== ungroupedHost, 'user-wide blacklist excludes matched audio route')
equal(outputRoutes.apply(`${audioScopedUrl}&os=mcdn`).url, null, 'user-wide blacklist locally blocks an exceptional audio route')
await outputRestrictions.remove(ungroupedHost, 'black')
for (const type of ['black', 'dead'] as const) {
  await outputRestrictions.add({ host: ungroupedHost, type, kind: 'all', reason: 'exceptional', expireAt: now + 60_000 })
  equal(outputRoutes.apply(`${ungroupedUrl}&os=mcdn`).url, null, `${type} blocks PCDN-marked Catalog host`)
  await outputRestrictions.remove(ungroupedHost, type)
}
const unknownQuery = alternateOutput!.replace('k=1', 'k=unknown')
check(outputRoutes.apply(unknownQuery).decision.reason !== 'player-fallback', 'weak query match is not a backup capability')
await outputEvidence.record(TRUSTED_CATALOG[0], 'video', { requestId: 'fresh-challenger', at: now, source: 'transport', outcome: 'success', throughputMbps: 10, ttfbMs: 1, failureKind: null })
check(outputRoutes.challenge(outputRep, { kind: 'video', requiredMbps: 3, highDemand: false }, false)?.decision.host !== TRUSTED_CATALOG[1], 'challenger never selects default unavailable cosov')

const beforeGeneration = outputSession.get()
await outputRoutes.observe({ ...healthyObservation, generation: beforeGeneration.generation, epoch: beforeGeneration.epoch, representation: outputRep,
  originalHost: forbiddenUrl, targetHost: TRUSTED_CATALOG[2], finalHost: TRUSTED_CATALOG[2], completedAt: now, decisionId: fallbackApplied.decision.id })
await outputRoutes.observe({ ...healthyObservation, generation: beforeGeneration.generation, epoch: beforeGeneration.epoch, representation: outputRep,
  targetHost: TRUSTED_CATALOG[2], finalHost: null, outcome: 'abort', status: 0, completedAt: now + 1 })
equal(outputRoutes.latestVideoHost(), TRUSTED_CATALOG[2], 'latest abort does not erase last successful video host')
await outputRoutes.observe({ ...healthyObservation, generation: beforeGeneration.generation, epoch: beforeGeneration.epoch, representation: outputRep,
  targetHost: TRUSTED_CATALOG[3], finalHost: null, outcome: 'failure', failureKind: 'network', status: 0, completedAt: now + 2 })
check(outputEvidence.get(TRUSTED_CATALOG[3], 'video')?.circuitUntil! > now, 'no-response network failure still attributed to sent target')

await outputSettings.update({ catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map(host => [host, false])) })
outputRoutes.invalidateForUserSetting()
equal(outputRoutes.apply(forbiddenUrl).url, null, 'no legal alternative blocks forbidden source')
const noOutput = { ...outputItem, base_url: forbiddenUrl, backup_url: [forbiddenUrl] }
outputAdapter.transform({ data: { dash: { video: [noOutput], audio: [] } } })
equal(noOutput.base_url, '', 'blocked playurl does not leak original primary')
equal(noOutput.backup_url.length, 0, 'blocked playurl does not leak original backup')

const gapRecorder = new DiagnosticRecorder(() => coreClock, () => false)
const gapRecovery = scope.own(new RecoveryController(recoveryPlayer, () => coreClock))
gapRecovery.subscribe(event => gapRecorder.record(event))
gapRecovery.tick(healthyCustomRate)
for (let i = 0; i < 5; i++) { coreClock += 10_000; gapRecovery.tick(deadPaused) }
equal(gapRecorder.snapshot().incident, null, 'background timer gaps do not count as continuous dead-core ticks')
gapRecovery.reset()
for (let i = 0; i < 5; i++) { coreClock += 1000; gapRecovery.tick(deadPaused) }
equal(gapRecorder.snapshot().incident, null, 'initial dead-looking startup without previous health is not an incident')

await outputSettings.update({ catalogOverrides: {}, fixedHost: null })
outputRoutes.invalidateForUserSetting()
const realAdapter = scope.own(new TransportAdapter(outputSession, outputSettings, outputRoutes, outputAdapter, measurementStub, () => now))
realAdapter.install()
const tracedXhr = new FakeXhr(); tracedXhr.open('GET', outputItem.base_url); tracedXhr.send()
await Promise.resolve()
const tracedVideo = (outputRoutes.snapshot().latest).video
equal(tracedXhr.nativeSends, 1, 'playurl output is sent through the native XHR method exactly once')
equal(tracedVideo?.targetHost, new URL(tracedXhr.url).host, 'route report target matches the URL received by native XHR')
equal(tracedVideo?.playurlOutput?.originalHost, 'upos-sz-mirrorcosov.bilivideo.com',
  'the completed native request retains the original playurl host lineage')
const actualXhr = new FakeXhr()
actualXhr.open('GET', forbiddenUrl)
check(!actualXhr.url.includes('mirrorcosov'), 'native XHR open receives rewritten legal host')
const initiallySentHost = new URL(actualXhr.url).host
await outputRestrictions.add({ host: initiallySentHost, type: 'black', kind: 'all', reason: 'before-send', expireAt: now + 60_000 })
actualXhr.send()
equal(actualXhr.nativeSends, 1, 'XHR sends one replacement request')
check(new URL(actualXhr.url).host !== initiallySentHost, 'restriction added after open is rechecked before native send')
await outputSettings.update({ catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map(host => [host, false])) })
const blockedXhr = new FakeXhr(); blockedXhr.open('GET', forbiddenUrl); blockedXhr.send()
equal(blockedXhr.nativeSends, 0, 'no-alternative XHR never sends forbidden native request')
const exceptionalXhr = new FakeXhr(); exceptionalXhr.open('GET', exceptionalForbidden); exceptionalXhr.send()
equal(exceptionalXhr.nativeSends, 0, 'XHR does not send default-unavailable PCDN-marked media')
const fetchCountBeforeBlock = nativeFetchCalls
let fetchBlocked = false
try { await fakeWindow.fetch(forbiddenUrl) } catch { fetchBlocked = true }
check(fetchBlocked, 'no-alternative Fetch rejects locally')
equal(nativeFetchCalls, fetchCountBeforeBlock, 'blocked Fetch sends no native request')
let exceptionalFetchBlocked = false
try { await fakeWindow.fetch(exceptionalForbidden) } catch { exceptionalFetchBlocked = true }
check(exceptionalFetchBlocked, 'Fetch does not send default-unavailable PCDN-marked media')
equal(nativeFetchCalls, fetchCountBeforeBlock, 'exceptional Fetch does not reach native transport')
await outputSettings.update({ disabled: true })
const enabledAfterOpen = new FakeXhr(); enabledAfterOpen.open('GET', forbiddenUrl)
await outputSettings.update({ disabled: false })
enabledAfterOpen.send()
equal(enabledAfterOpen.nativeSends, 0, 'XHR opened while disabled rechecks restriction when enabled before send')
await outputSettings.update({ disabled: true })
const disabledXhr = new FakeXhr(); disabledXhr.open('GET', forbiddenUrl); disabledXhr.send()
equal(disabledXhr.url, forbiddenUrl, 'disabled adapter preserves website original request')
equal(disabledXhr.nativeSends, 1, 'disabled adapter sends website request once')
realAdapter.dispose()

let intentClock = now, intentReloads = 0, activation = false
let intentVideo = { ...healthyCustomRate }
const intentTarget = { play: () => 'original-result' }
const originalIntentPlay = intentTarget.play
Object.defineProperty(fakeWindow, 'navigator', { configurable: true, value: { userActivation: { get isActive() { return activation } } } })
class IntentAdapter extends PlayerAdapter { protected override player(): Record<string, unknown> { return intentTarget } }
const intentAdapter = new IntentAdapter({ transform: () => playurlResult(false), lifecycleKey: () => 'test' })
const intentRecovery = scope.own(new RecoveryController({ ...recoveryPlayer, observePlayIntent: listener => intentAdapter.observePlayIntent(listener), snapshot: () => intentVideo,
  reload: () => { intentReloads++ }, playbackRate: () => 1.5 }, () => intentClock))
intentRecovery.tick(intentVideo)
intentVideo = { ...deadPaused }; intentClock += 1000; intentRecovery.tick(intentVideo)
check(intentTarget.play !== originalIntentPlay, 'play observer installed on first paused tick, not thirty seconds later')
intentClock += 31_000
equal(intentTarget.play(), 'original-result', 'play observer preserves original return')
equal(intentRecovery.isRecovering(), false, 'untrusted play call never arms reload')
activation = true; intentTarget.play()
equal(intentRecovery.isRecovering(), true, 'trusted long-pause request arms intent while video stays paused')
for (let tick = 0; tick < 4; tick++) { intentClock += 1000; intentRecovery.tick(intentVideo) }
equal(intentReloads, 1, 'dead paused video with valid intent reloads once')
intentClock += 1000; intentRecovery.tick(intentVideo)
equal(intentReloads, 1, 'repeated dead ticks cannot loop reload')
intentRecovery.reset()
equal(intentTarget.play, originalIntentPlay, 'generation reset restores owned play method')

for (let i = 0; i < 1000; i++) coreRecorder.record({ type: 'transport', at: coreClock, observation: { ...healthyObservation, completedAt: coreClock } })
equal(coreRecorder.snapshot().incident?.id, frozenCore?.id, 'one thousand successes retain frozen core incident')
check(new TextEncoder().encode(JSON.stringify(coreRecorder.snapshot())).length <= 128 * 1024, 'recorder remains within 128 KiB')
check(new TextEncoder().encode(coreRecorder.buildReport({})).length <= 96 * 1024, 'report remains within 96 KiB')
check(!coreRecorder.buildReport({}).includes('token=secret'), 'incident report contains no test signed query')

await outputSettings.update({ disabled: false, catalogOverrides: {}, fixedHost: null })
outputRoutes.invalidateForUserSetting()
const nativeAudioUrl = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/test/output/audio.m4s?s=exact'
const audioItem = { id: 30280, base_url: nativeAudioUrl, backup_url: [], bandwidth: 100_000 }
outputAdapter.transform({ data: { dash: { video: [], audio: [audioItem] } } })
const beforeAudioAffinity = outputSession.get().affinity
const nativeAudioApplied = outputRoutes.apply(nativeAudioUrl)
equal(nativeAudioApplied.url, nativeAudioUrl, 'eligible Native backup uses its own full signed URL')
equal(nativeAudioApplied.decision.routeType, 'root-original', 'cold-start signed original remains unchanged before preflight')
equal(outputSession.get().affinity, beforeAudioAffinity, 'audio backup request does not alter video affinity')
const audioRep = nativeAudioApplied.context!.representation
outputVault.invalidate(audioRep, new URL(nativeAudioUrl).host)
check(outputRoutes.apply(nativeAudioUrl).url !== nativeAudioUrl, 'invalid Native cannot return through existing backup role')
const repeatAudio = { id: 30280, base_url: nativeAudioUrl, backup_url: [nativeAudioUrl], bandwidth: 100_000 }
outputAdapter.transform({ data: { dash: { video: [], audio: [repeatAudio] } } })
check(![repeatAudio.base_url, ...repeatAudio.backup_url].includes(nativeAudioUrl), 'invalid Native is removed from refreshed player outputs')
const nextGeneration = outputSession.beginGeneration(false)
outputVault.reset(nextGeneration.generation, nextGeneration.epoch); outputRoutes.resetEpoch()
equal(outputVault.outputRole(audioRep, nativeAudioUrl), null, 'generation reset discards output roles')
equal(outputRoutes.latestVideoHost(), null, 'generation reset drops old successful host')


} finally { scope.dispose() }
console.log('adapters: ' + assertionCount() + ' assertions')
