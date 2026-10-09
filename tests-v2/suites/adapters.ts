import { installProgressEvent } from "../support/progress-event.ts"
import { createRuntimeIds } from "../../src-v2/platform/runtime-ids.ts"
import { deferred } from '../support/deferred.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
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
import { FakeStorage } from '../support/storage.ts'
import { testScope } from '../support/scope.ts'

// Each call creates fresh resources and replays only this fixture's prerequisite transitions.
// Earlier expectations run in their own cases; no mutable state crosses a test boundary.
async function fixture(t: TestContext, scenario: number, parameter = 0): Promise<() => Promise<void>> {
  const scope = testScope(t)
  installProgressEvent(scope)
const now = 2_000_000_000_000
const clock = { now: () => now }
const runtimeSession = new SessionStore();
runtimeSession.beginGeneration(false)
const passDecision: AppliedRouteDecision = { decision: { action: 'pass', id: decisionId('runtime-pass'), reason: 'test', routeType: 'root-original',
  host: 'upos-sz-mirrorali.bilivideo.com', ranking: [] }, url: 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/runtime.m4s', context: null, streamKey: 'runtime', sourceHost: 'upos-sz-mirrorali.bilivideo.com' }
const observations: TransportObservation[] = []
const routeStub = {
  policyRevision(): number { return 0 },
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
  method = ''; url = ''; readyState = 0; status = 200; responseURL = ''; sync = false; sent = false
  #responseType: XMLHttpRequestResponseType = ''; #timeout = 0
  get responseType(): XMLHttpRequestResponseType { return this.#responseType }
  set responseType(value: XMLHttpRequestResponseType) {
    if (this.sync) throw new DOMException('synchronous XHR', 'InvalidAccessError')
    this.#responseType = value
  }
  get timeout(): number { return this.#timeout }
  set timeout(value: number) {
    if (this.sync) throw new DOMException('synchronous XHR', 'InvalidAccessError')
    this.#timeout = value
  }
  finalResponseUrl: string | null = null
  rawResponseText: string | null = null
  holdAtLoading = false
  withCredentials = false
  payload: unknown = { ok: true }; nativeSends = 0
  get response(): unknown { return this.payload }
  get responseText(): string { return this.rawResponseText ?? JSON.stringify(this.payload) }
  open(method: string, url: string | URL, async = true): void { this.method = method; this.url = String(url); this.responseURL = this.url; this.readyState = 1; this.sync = !async; this.sent = false }
  send(): void {
    if (this.readyState !== 1 || this.sent) throw new DOMException('send invalid state', 'InvalidStateError')
    this.sent = true; this.nativeSends++; if (this.finalResponseUrl) this.responseURL = this.finalResponseUrl;
    this.readyState = this.holdAtLoading ? 3 : 4
    this.dispatchEvent(new Event('readystatechange'))
    if (!this.holdAtLoading) { this.dispatchEvent(new Event('load')); this.dispatchEvent(new Event('loadend')) } }
  abort(): void {
    if ((this.readyState === 1 && this.sent) || this.readyState === 2 || this.readyState === 3) {
      this.readyState = 4; this.sent = false; this.status = 0
      this.dispatchEvent(new Event('readystatechange')); this.dispatchEvent(new Event('abort')); this.dispatchEvent(new Event('loadend'))
    }
    if (this.readyState === 4) this.readyState = 0
  }
  setRequestHeader(_name: string, _value: string): void {}
}
const originalWorker = function WorkerIdentity() { return undefined }
const fakeWindow = { fetch: nativeFetch, XMLHttpRequest: FakeXhr, Worker: originalWorker, navigator: globalThis.navigator }
scope.defineGlobal('unsafeWindow', { configurable: true, value: fakeWindow })
scope.defineGlobal('location', { configurable: true, value: new URL('https://www.bilibili.com/video/BVtest/') })
let skippedPreflightReason = ''
const measurementStub = { willGateStartup: (): boolean => false, prepareStartup: async (): Promise<void> => {},
  noteUnpreflighted(reason: string): void { skippedPreflightReason = reason } }
const transport = scope.own(new TransportAdapter(runtimeSession, settingsStub, routeStub, playurlStub, measurementStub, () => now, createRuntimeIds()))
transport.install()
if (scenario === 0) return async () => {
assert.strictEqual(transport.snapshot().hookState, 'installed', 'Fetch and XHR hook assignments are verified')
const mediaResponse = await fakeWindow.fetch(passDecision.url ?? '')
const firstIntercept = transport.snapshot().lastMediaRequest
assert.ok(firstIntercept?.hookEntered && firstIntercept.mediaRecognized && firstIntercept.nativeCalled && firstIntercept.responseObserved,
  'diagnostic stages distinguish hook entry, media recognition, native invocation and response')
const mediaReader = mediaResponse.body?.getReader()
assert.ok(mediaReader, 'fetch wrapper returns a readable body')
await mediaReader?.read()
await mediaReader?.cancel('caller-cancel')
assert.strictEqual(cancelReason, 'caller-cancel', 'fetch cancel reason reaches original reader')
assert.strictEqual(observations.at(-1)?.outcome, 'abort', 'cancel settles as abort once')
assert.strictEqual(observations.at(-1)?.finalHost, null, 'empty response URL never invents a response host')
const beforeHttpDns = nativeFetchCalls
const blockedDns = await fakeWindow.fetch('https://httpdns.bilivideo.com/resolve')
assert.strictEqual(blockedDns.status, 503, 'HTTPDNS manual block returns local response')
assert.strictEqual(nativeFetchCalls, beforeHttpDns, 'HTTPDNS block performs no native request')
}

const mediaResponse = await fakeWindow.fetch(passDecision.url ?? '')
const firstIntercept = transport.snapshot().lastMediaRequest

const mediaReader = mediaResponse.body?.getReader()

await mediaReader?.read()
await mediaReader?.cancel('caller-cancel')



const beforeHttpDns = nativeFetchCalls
const blockedDns = await fakeWindow.fetch('https://httpdns.bilivideo.com/resolve')


disabled = true
await fakeWindow.fetch('https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/disabled.m4s')
if (scenario === 1) return async () => {
assert.strictEqual(nativeFetchCalls, beforeHttpDns + 1, 'disabled mode passes site fetch through')
disabled = false
const gatedUrl = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/gated.m4s'
const gateControl: { release: () => void; done: Promise<void> } = { release: () => undefined, done: Promise.resolve() }
let gateReady = false
measurementStub.willGateStartup = () => true
measurementStub.prepareStartup = () => {
  const done = deferred<void>()
  gateControl.done = done.promise
  gateControl.release = () => { gateReady = true; done.resolve() }
  return done.promise
}
routeStub.apply = (url: string): AppliedRouteDecision => gateReady ? { ...passDecision,
  decision: { action: 'rewrite', id: decisionId('gated-rewrite'), reason: 'preflight', routeType: 'catalog-generated',
    host: TRUSTED_CATALOG[0], candidate: { type: 'catalog-generated', host: TRUSTED_CATALOG[0], kind: 'video', catalogIndex: 0 }, ranking: [] },
  url: url.replace('upos-sz-mirrorali.bilivideo.com', TRUSTED_CATALOG[0]) } : { ...passDecision, url }
const beforeGate = nativeFetchCalls
const gatedFetch = fakeWindow.fetch(gatedUrl)
assert.strictEqual(nativeFetchCalls, beforeGate, 'Fetch player request waits before native dispatch')
gateControl.release()
await gatedFetch
assert.strictEqual(new URL(nativeFetchUrls.at(-1) ?? '').host, TRUSTED_CATALOG[0], 'Fetch dispatch uses preflight winner')
gateReady = false
const mutableMediaUrl = new URL(gatedUrl)
const mutableInit: RequestInit = { method: 'GET' }
const beforeLifecycleGate = nativeFetchCalls
const lifecycleFetch = fakeWindow.fetch(mutableMediaUrl, mutableInit)
assert.strictEqual(nativeFetchCalls, beforeLifecycleGate, 'generation-switch Fetch waits at the same startup boundary')
mutableMediaUrl.hostname = 'upos-sz-mirrorcosov.bilivideo.com'
mutableInit.method = 'POST'
runtimeSession.beginGeneration(false)
gateControl.release()
await lifecycleFetch
assert.strictEqual(nativeFetchUrls.at(-1), gatedUrl, 'generation-switch Fetch sends the checked URL, not mutated input')
assert.strictEqual(nativeFetchMethods.at(-1), 'GET', 'generation-switch Fetch sends the checked method, not mutated init')
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
assert.strictEqual(nativeFetchCalls, beforeStaleForbidden, 'stale generation cannot dispatch a restricted original media host')
routeStub.inspectOriginal = originalInspect
const requestInput = new Request(gatedUrl, { method: 'GET' })
measurementStub.willGateStartup = () => false
await fakeWindow.fetch(requestInput)
assert.strictEqual(new URL(nativeFetchUrls.at(-1) ?? '').host, TRUSTED_CATALOG[0], 'Fetch Request input dispatch uses the selected host')
}

disabled = false
const gatedUrl = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/gated.m4s'
const gateControl: { release: () => void; done: Promise<void> } = { release: () => undefined, done: Promise.resolve() }
let gateReady = false
measurementStub.willGateStartup = () => true
measurementStub.prepareStartup = () => {
  const done = deferred<void>()
  gateControl.done = done.promise
  gateControl.release = () => { gateReady = true; done.resolve() }
  return done.promise
}
routeStub.apply = (url: string): AppliedRouteDecision => gateReady ? { ...passDecision,
  decision: { action: 'rewrite', id: decisionId('gated-rewrite'), reason: 'preflight', routeType: 'catalog-generated',
    host: TRUSTED_CATALOG[0], candidate: { type: 'catalog-generated', host: TRUSTED_CATALOG[0], kind: 'video', catalogIndex: 0 }, ranking: [] },
  url: url.replace('upos-sz-mirrorali.bilivideo.com', TRUSTED_CATALOG[0]) } : { ...passDecision, url }
const beforeGate = nativeFetchCalls
const gatedFetch = fakeWindow.fetch(gatedUrl)

gateControl.release()
await gatedFetch

gateReady = false
const mutableMediaUrl = new URL(gatedUrl)
const mutableInit: RequestInit = { method: 'GET' }
const beforeLifecycleGate = nativeFetchCalls
const lifecycleFetch = fakeWindow.fetch(mutableMediaUrl, mutableInit)

mutableMediaUrl.hostname = 'upos-sz-mirrorcosov.bilivideo.com'
mutableInit.method = 'POST'
runtimeSession.beginGeneration(false)
gateControl.release()
await lifecycleFetch


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

routeStub.inspectOriginal = originalInspect
const requestInput = new Request(gatedUrl, { method: 'GET' })
measurementStub.willGateStartup = () => false
await fakeWindow.fetch(requestInput)

const headerRequest = new Request(gatedUrl, { headers: { 'x-bilicdn-test': 'kept' } })
await fakeWindow.fetch(headerRequest)
if (scenario === 2) return async () => {
assert.strictEqual(nativeFetchHeaders.at(-1), 'kept', 'rewritten Request preserves request headers')
await fakeWindow.fetch(new URL(gatedUrl))
assert.strictEqual(new URL(nativeFetchUrls.at(-1) ?? '').host, TRUSTED_CATALOG[0], 'URL object is normalized before rewrite')
measurementStub.willGateStartup = () => true
gateReady = false
const gatedXhr = new FakeXhr()
gatedXhr.open('GET', gatedUrl)
gatedXhr.send()
assert.strictEqual(gatedXhr.nativeSends, 0, 'async XHR send waits before native dispatch')
gateControl.release()
await gateControl.done
assert.strictEqual(gatedXhr.nativeSends, 1, 'async XHR sends exactly once after preflight')
assert.strictEqual(new URL(gatedXhr.url).host, TRUSTED_CATALOG[0], 'XHR dispatch uses preflight winner')
gateReady = false
const abortedXhr = new FakeXhr()
abortedXhr.open('GET', gatedUrl);
abortedXhr.send();
abortedXhr.abort()
gateControl.release()
await gateControl.done
assert.strictEqual(abortedXhr.nativeSends, 0, 'XHR abort during preflight never dispatches the website request')
const finiteTimeoutXhr = new FakeXhr();
finiteTimeoutXhr.timeout = 5000
finiteTimeoutXhr.open('GET', gatedUrl);
finiteTimeoutXhr.send()
assert.strictEqual(finiteTimeoutXhr.nativeSends, 1, 'explicit XHR timeout bypasses delay to preserve native timeout semantics')
assert.strictEqual(skippedPreflightReason, 'preflight-skipped:xhr-explicit-timeout', 'XHR timeout is labelled as skipped preflight, not skipped interception')
}

await fakeWindow.fetch(new URL(gatedUrl))

measurementStub.willGateStartup = () => true
gateReady = false
const gatedXhr = new FakeXhr()
gatedXhr.open('GET', gatedUrl)
gatedXhr.send()

gateControl.release()
await gateControl.done


gateReady = false
const abortedXhr = new FakeXhr()
abortedXhr.open('GET', gatedUrl);
abortedXhr.send();
abortedXhr.abort()
gateControl.release()
await gateControl.done

const finiteTimeoutXhr = new FakeXhr();
finiteTimeoutXhr.timeout = 5000
finiteTimeoutXhr.open('GET', gatedUrl);
finiteTimeoutXhr.send()


const forbiddenNonGetUrl = 'https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/a/b/forbidden.m4s'
routeStub.apply = (url: string): AppliedRouteDecision => ({ ...passDecision, url: url === forbiddenNonGetUrl ? null : url,
  decision: url === forbiddenNonGetUrl ? { action: 'block', id: decisionId('blocked-non-get'), reason: 'black',
    routeType: 'root-original', host: 'upos-sz-mirrorcosov.bilivideo.com', ranking: [] } : passDecision.decision })
const beforeForbidden = nativeFetchCalls
await fakeWindow.fetch(forbiddenNonGetUrl, { method: 'POST' }).then(() => { throw new Error('blacklisted POST Fetch must reject locally') }, () => undefined)
if (scenario === 3) return async () => {
assert.strictEqual(nativeFetchCalls, beforeForbidden, 'blacklisted non-GET Fetch never reaches native fetch')
const forbiddenXhr = new FakeXhr();
forbiddenXhr.open('POST', forbiddenNonGetUrl);
forbiddenXhr.send()
assert.strictEqual(forbiddenXhr.nativeSends, 0, 'blacklisted non-GET XHR never reaches native send')
assert.strictEqual(transport.snapshot().lastBlocked?.reason, 'black', 'local block diagnostics retain the reason without a URL')
const forbiddenRequest = new Request(forbiddenNonGetUrl, { method: 'POST' })
await fakeWindow.fetch(forbiddenRequest).then(() => { throw new Error('blacklisted Request object must reject locally') }, () => undefined)
assert.strictEqual(nativeFetchCalls, beforeForbidden, 'blacklisted Request object never reaches native fetch')
const spoofedRequest = new Request(forbiddenNonGetUrl, { method: 'POST' })
Object.defineProperty(spoofedRequest, 'href', { value: 'https://upos-sz-mirrorali.bilivideo.com/live-bvc/allowed.m4s' })
await fakeWindow.fetch(spoofedRequest).then(() => { throw new Error('forged Request.href must not bypass blocked POST') }, () => undefined)
assert.strictEqual(nativeFetchCalls, beforeForbidden, 'Fetch checks the Request internal URL, not a forged href expando')
measurementStub.willGateStartup = () => false
const converseRequest = new Request(passDecision.url ?? '')
Object.defineProperty(converseRequest, 'href', { value: forbiddenNonGetUrl })
await fakeWindow.fetch(converseRequest)
assert.strictEqual(nativeFetchUrls.at(-1), passDecision.url, 'forged forbidden href cannot block an allowed Request')
const beforeDnsRequest = nativeFetchCalls
const spoofedDns = new Request('https://httpdns.bilivideo.com/resolve')
Object.defineProperty(spoofedDns, 'href', { value: passDecision.url })
const spoofedDnsResponse = await fakeWindow.fetch(spoofedDns)
assert.strictEqual(spoofedDnsResponse.status, 503, 'forged Request.href cannot bypass HTTPDNS block')
assert.strictEqual(nativeFetchCalls, beforeDnsRequest, 'blocked HTTPDNS Request never reaches native fetch')
}

const forbiddenXhr = new FakeXhr();
forbiddenXhr.open('POST', forbiddenNonGetUrl);
forbiddenXhr.send()


const forbiddenRequest = new Request(forbiddenNonGetUrl, { method: 'POST' })
await fakeWindow.fetch(forbiddenRequest).then(() => { throw new Error('blacklisted Request object must reject locally') }, () => undefined)

const spoofedRequest = new Request(forbiddenNonGetUrl, { method: 'POST' })
Object.defineProperty(spoofedRequest, 'href', { value: 'https://upos-sz-mirrorali.bilivideo.com/live-bvc/allowed.m4s' })
await fakeWindow.fetch(spoofedRequest).then(() => { throw new Error('forged Request.href must not bypass blocked POST') }, () => undefined)

measurementStub.willGateStartup = () => false
const converseRequest = new Request(passDecision.url ?? '')
Object.defineProperty(converseRequest, 'href', { value: forbiddenNonGetUrl })
await fakeWindow.fetch(converseRequest)

const beforeDnsRequest = nativeFetchCalls
const spoofedDns = new Request('https://httpdns.bilivideo.com/resolve')
Object.defineProperty(spoofedDns, 'href', { value: passDecision.url })
const spoofedDnsResponse = await fakeWindow.fetch(spoofedDns)


routeStub.inspectOriginal = (url: string): AppliedRouteDecision => ({ ...passDecision, url })
const overrideRequest = new Request(gatedUrl, { method: 'GET' })
await fakeWindow.fetch(overrideRequest, { method: 'POST' })
if (scenario === 4) return async () => {
assert.strictEqual(nativeFetchMethods.at(-1), 'POST', 'init.method override is preserved for native Fetch')
assert.strictEqual(nativeFetchUrls.at(-1), gatedUrl, 'non-GET method override is not rewritten as a GET')
const streamBody = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode('stream-ok')); controller.close() } })
await fakeWindow.fetch(new Request('https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/stream-body.m4s',
  { method: 'POST', body: streamBody, duplex: 'half' } as RequestInit))
assert.strictEqual(streamedRequestBody, 'stream-ok', 'normalized POST Request preserves a streaming body')
measurementStub.willGateStartup = () => false
const xhr = new FakeXhr()
xhr.responseType = 'json'
xhr.payload = { code: 0, data: { dash: { video: [], audio: [] } } }
xhr.open('GET', 'https://api.bilibili.com/x/player/wbi/playurl')
xhr.send()
void xhr.response
assert.strictEqual(transformed, 1, 'XHR JSON playurl is transformed lazily once')
assert.strictEqual(fakeWindow.Worker, originalWorker, 'Worker constructor identity is untouched')
transport.dispose()
class UnpatchableXhr extends FakeXhr {}
Object.defineProperty(UnpatchableXhr.prototype, 'send', { value: FakeXhr.prototype.send, writable: false, configurable: true })
const partialWindow = { fetch: nativeFetch, XMLHttpRequest: UnpatchableXhr }
scope.defineGlobal('unsafeWindow', { configurable: true, value: partialWindow })
const originalPartialOpen = UnpatchableXhr.prototype.open
const partialTransport = scope.own(new TransportAdapter(runtimeSession, settingsStub, routeStub, playurlStub,
  measurementStub, () => now, createRuntimeIds()))
partialTransport.install()
assert.strictEqual(partialTransport.snapshot().hookState, 'failed', 'partial hook installation is reported as failed')
assert.strictEqual(partialWindow.fetch, nativeFetch, 'partial XHR install failure restores fetch')
assert.strictEqual(UnpatchableXhr.prototype.open, originalPartialOpen, 'partial XHR install failure restores open')
}


const streamBody = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode('stream-ok')); controller.close() } })
await fakeWindow.fetch(new Request('https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/stream-body.m4s',
  { method: 'POST', body: streamBody, duplex: 'half' } as RequestInit))

measurementStub.willGateStartup = () => false
const xhr = new FakeXhr()
xhr.responseType = 'json'
xhr.payload = { code: 0, data: { dash: { video: [], audio: [] } } }
xhr.open('GET', 'https://api.bilibili.com/x/player/wbi/playurl')
xhr.send()
void xhr.response


transport.dispose()
class UnpatchableXhr extends FakeXhr {}
Object.defineProperty(UnpatchableXhr.prototype, 'send', { value: FakeXhr.prototype.send, writable: false, configurable: true })
const partialWindow = { fetch: nativeFetch, XMLHttpRequest: UnpatchableXhr }
scope.defineGlobal('unsafeWindow', { configurable: true, value: partialWindow })
const originalPartialOpen = UnpatchableXhr.prototype.open
const partialTransport = scope.own(new TransportAdapter(runtimeSession, settingsStub, routeStub, playurlStub,
  measurementStub, () => now, createRuntimeIds()))
partialTransport.install()



scope.defineGlobal('unsafeWindow', { configurable: true, value: fakeWindow })
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
const outputRoutes = new RouteCoordinator(clock, outputSession, outputSettings, outputRestrictions, outputEvidence, outputVault, createRuntimeIds())
const outputAdapter = new PlayurlAdapter(new PlayurlController(outputSession, outputVault, outputRoutes, outputSettings))
const forbiddenUrl = 'https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/test/output/1.m4s?k=1'
const outputItem = { id: 80, codecid: 13, height: 1080, bandwidth: 1_000_000, base_url: forbiddenUrl, backup_url: [forbiddenUrl] }
outputAdapter.transform({ data: { dash: { video: [outputItem], audio: [] } } })
if (scenario === 5) return async () => {
assert.ok(![outputItem.base_url, ...outputItem.backup_url].some(url => url.includes('mirrorcosov')), 'forbidden original cannot remain in playurl primary or backup')
const exceptionalForbidden = `${forbiddenUrl}&os=mcdn`
assert.strictEqual(outputRoutes.apply(exceptionalForbidden).url, null, 'default-unavailable source cannot pass through PCDN guard')
assert.strictEqual(outputRoutes.apply(forbiddenUrl.replace('/upgcxcode/', '/live-bvc/')).url, null, 'default-unavailable live source is locally blocked without host replacement')
assert.strictEqual(outputRoutes.apply(forbiddenUrl.replace('/upgcxcode/', '/v1/resource/')).url, null, 'default-unavailable resource source is locally blocked')
assert.strictEqual(outputRoutes.apply('https://upos-sz-mirrorali.bilivideo.com/live-bvc/test/output/1.m4s?k=1').decision.action, 'pass', 'unrestricted live source remains untouched')
const exceptionalItem = { ...outputItem, base_url: exceptionalForbidden, backup_url: [exceptionalForbidden] }
outputAdapter.transform({ data: { dash: { video: [exceptionalItem], audio: [] } } })
assert.strictEqual(exceptionalItem.base_url, '', 'playurl cannot emit a default-unavailable PCDN-marked primary')
assert.strictEqual(exceptionalItem.backup_url.length, 0, 'playurl cannot emit a default-unavailable PCDN-marked backup')
const opaquePrimary = 'https://upos-hz-mirrorakam.akamaized.net/opaque/video-chunk?signature=private'
const opaqueBackup = 'https://upos-sz-mirrorali.bilivideo.com/opaque/video-chunk?signature=private'
const opaqueItem = { id: 81, codecid: 13, height: 1080, bandwidth: 1_000_000, base_url: opaquePrimary, backup_url: [opaqueBackup] }
outputAdapter.transform({ data: { dash: { video: [opaqueItem], audio: [] } } }, 'page-hint')
assert.strictEqual(opaqueItem.base_url, opaquePrimary, 'legal opaque signed primary is not emptied by playurl assembly')
}

const exceptionalForbidden = `${forbiddenUrl}&os=mcdn`




const exceptionalItem = { ...outputItem, base_url: exceptionalForbidden, backup_url: [exceptionalForbidden] }
outputAdapter.transform({ data: { dash: { video: [exceptionalItem], audio: [] } } })


const opaquePrimary = 'https://upos-hz-mirrorakam.akamaized.net/opaque/video-chunk?signature=private'
const opaqueBackup = 'https://upos-sz-mirrorali.bilivideo.com/opaque/video-chunk?signature=private'
const opaqueItem = { id: 81, codecid: 13, height: 1080, bandwidth: 1_000_000, base_url: opaquePrimary, backup_url: [opaqueBackup] }
outputAdapter.transform({ data: { dash: { video: [opaqueItem], audio: [] } } }, 'page-hint')

const opaqueLineage = outputRoutes.apply(opaquePrimary)
if (scenario === 6) return async () => {
assert.strictEqual(opaqueLineage.attributionStatus, 'weak', 'opaque signed output remains observation-only')
assert.strictEqual(opaqueLineage.playurlOutput?.outputHost, new URL(opaquePrimary).host,
  'an exact opaque output still links playurl delivery to the later segment request by host')
await outputRestrictions.add({ host: 'upos-hz-mirrorakam.akamaized.net', type: 'black', kind: 'all', reason: 'opaque-output', expireAt: now + 60_000 })
const opaqueRestricted = { ...opaqueItem, base_url: opaquePrimary, backup_url: [opaqueBackup] }
outputAdapter.transform({ data: { dash: { video: [opaqueRestricted], audio: [] } } }, 'page-hint')
assert.strictEqual(opaqueRestricted.base_url, opaqueBackup, 'opaque signed fallback uses its own exact URL when source is forbidden')
await outputRestrictions.remove('upos-hz-mirrorakam.akamaized.net', 'black')
const mixedItem = { id: 82, codecid: 13, height: 1080, bandwidth: 1_000_000,
  base_url: 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/test/mixed/82.m4s?signature=private',
  backup_url: ['https://upos-hz-mirrorakam.akamaized.net/opaque/mixed-82?signature=private'] }
outputAdapter.transform({ data: { dash: { video: [mixedItem], audio: [] } } }, 'page-hint')
assert.ok(mixedItem.backup_url.includes('https://upos-hz-mirrorakam.akamaized.net/opaque/mixed-82?signature=private'),
  'normal primary retains a legal exact opaque signed backup')
const alternateOutput = outputItem.backup_url.find(url => new URL(url).host !== new URL(outputItem.base_url).host)
assert.ok(alternateOutput, 'playurl includes a legal alternate backup')
const fallbackApplied = outputRoutes.apply(alternateOutput ?? '')
assert.strictEqual(fallbackApplied.url, alternateOutput, 'player requested output backup is not pulled back to primary')
assert.strictEqual(fallbackApplied.decision.reason, 'player-fallback', 'player backup has explicit coordinated decision')
assert.strictEqual(outputRoutes.apply(outputItem.base_url).url, alternateOutput, 'subsequent group requests retain adopted backup')
}


await outputRestrictions.add({ host: 'upos-hz-mirrorakam.akamaized.net', type: 'black', kind: 'all', reason: 'opaque-output', expireAt: now + 60_000 })
const opaqueRestricted = { ...opaqueItem, base_url: opaquePrimary, backup_url: [opaqueBackup] }
outputAdapter.transform({ data: { dash: { video: [opaqueRestricted], audio: [] } } }, 'page-hint')

await outputRestrictions.remove('upos-hz-mirrorakam.akamaized.net', 'black')
const mixedItem = { id: 82, codecid: 13, height: 1080, bandwidth: 1_000_000,
  base_url: 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/test/mixed/82.m4s?signature=private',
  backup_url: ['https://upos-hz-mirrorakam.akamaized.net/opaque/mixed-82?signature=private'] }
outputAdapter.transform({ data: { dash: { video: [mixedItem], audio: [] } } }, 'page-hint')

const alternateOutput = outputItem.backup_url.find(url => new URL(url).host !== new URL(outputItem.base_url).host)

const fallbackApplied = outputRoutes.apply(alternateOutput ?? '')



let coreClock = now, coreReloads = 0
const coreRecorder = new DiagnosticRecorder(() => coreClock, () => false)
const coreObserver = scope.own(new RecoveryController({ ...recoveryPlayer, reload: () => { coreReloads++ } }, () => coreClock))
coreObserver.subscribe(event => coreRecorder.record(event))
coreObserver.tick({ ...playerSnapshot, paused: false, readyState: 4, width: 1920, height: 1080 })
const deadPaused = { ...playerSnapshot, paused: true, readyState: 0, width: 0, height: 0, frames: 0, coreInitialized: false }
for (let tick = 0; tick < 5; tick++) { coreClock += 1000; coreObserver.tick(deadPaused) }
if (scenario === 7) return async () => {
assert.ok(coreRecorder.snapshot().incident, 'paused dead core automatically captures an incident')
assert.strictEqual(coreReloads, 0, 'dead paused core without play intent never reloads')
coreClock += 31_000;
coreRecorder.tick()
const frozenCore = coreRecorder.snapshot().incident
coreRecorder.mark()
assert.strictEqual(coreRecorder.snapshot().incident?.id, frozenCore?.id, 'late manual mark preserves frozen automatic incident')
for (let tick = 0; tick < 100; tick++) { coreClock += 1000; coreObserver.tick(deadPaused) }
assert.strictEqual(coreRecorder.snapshot().incident?.id, frozenCore?.id, 'continuous dead core does not replace its own incident')
const outputRep = outputVault.contextForUrl(outputItem.base_url)!.representation
const playurlLineage = (outputRoutes.apply(outputItem.base_url) as AppliedRouteDecision & {
  playurlOutput?: { originalHost: string; outputHost: string; source: string; decisionId: string; role: string }
}).playurlOutput
assert.strictEqual(playurlLineage?.originalHost, 'upos-sz-mirrorcosov.bilivideo.com', 'playurl lineage retains the original host without retaining a signed URL')
assert.strictEqual(playurlLineage?.outputHost, new URL(outputItem.base_url).host, 'playurl lineage names the host actually offered to the player')
assert.strictEqual(playurlLineage?.source, 'trusted-api', 'playurl lineage identifies trusted API output separately from page hints')
assert.ok(!!playurlLineage?.decisionId && playurlLineage.role === 'primary', 'playurl output links its plan to a primary request')
}


coreClock += 31_000;
coreRecorder.tick()
const frozenCore = coreRecorder.snapshot().incident
coreRecorder.mark()

for (let tick = 0; tick < 100; tick++) { coreClock += 1000; coreObserver.tick(deadPaused) }

const outputRep = outputVault.contextForUrl(outputItem.base_url)!.representation
const playurlLineage = (outputRoutes.apply(outputItem.base_url) as AppliedRouteDecision & {
  playurlOutput?: { originalHost: string; outputHost: string; source: string; decisionId: string; role: string }
}).playurlOutput




const alternateHost = new URL(alternateOutput!).host
if (scenario === 8) {
 let iteration = 0
for (const type of ['black', 'dead'] as const) {
 if (iteration++ === parameter) return async () => {
  await outputRestrictions.add({ host: alternateHost, type, kind: 'all', reason: 'regression', expireAt: now + 60_000 })
  assert.ok(outputRoutes.apply(alternateOutput!).decision.host !== alternateHost, `${type} invalidates cached fallback on next request`)
  await outputSettings.update({ fixedHost: alternateHost })
  outputRoutes.invalidateForUserSetting()
  assert.ok(outputRoutes.apply(alternateOutput!).decision.host !== alternateHost, `fixed CDN cannot bypass ${type}`)
  const item = { ...outputItem, base_url: forbiddenUrl, backup_url: [alternateOutput!] }
  outputAdapter.transform({ data: { dash: { video: [item], audio: [] } } })
  assert.ok(![item.base_url, ...item.backup_url].some(url => url && new URL(url).host === alternateHost), `${type} filtered from all playurl outputs`)
  await outputRestrictions.remove(alternateHost, type)
}
 }
 throw Error('Unknown fixture parameter')
}
for (const type of ['black', 'dead'] as const) {
  await outputRestrictions.add({ host: alternateHost, type, kind: 'all', reason: 'regression', expireAt: now + 60_000 })
  await outputSettings.update({ fixedHost: alternateHost })
  outputRoutes.invalidateForUserSetting()
  const item = { ...outputItem, base_url: forbiddenUrl, backup_url: [alternateOutput!] }
  outputAdapter.transform({ data: { dash: { video: [item], audio: [] } } })
  await outputRestrictions.remove(alternateHost, type)
}
await outputSettings.update({ fixedHost: null })
outputRoutes.invalidateForUserSetting()
outputRoutes.setOriginalComparison(true)
if (scenario === 9) return async () => {
assert.strictEqual(outputSettings.get().fixedHost, null, 'per-tab original comparison does not overwrite saved routing settings')
const nativeControlUrl = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/control/clip.m4s?signature=private'
const nativeControlBackup = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/control/clip.m4s?signature=other'
const controlItem = { id: 240, codecid: 13, height: 1080, bandwidth: 1_000_000,
  base_url: nativeControlUrl, backup_url: [nativeControlBackup] }
outputAdapter.transform({ data: { dash: { video: [controlItem], audio: [] } } }, 'page-hint')
assert.strictEqual(controlItem.base_url, nativeControlUrl, 'original comparison mode does not rewrite a legal playurl primary')
assert.strictEqual(controlItem.backup_url[0], nativeControlBackup, 'original comparison mode preserves the exact legal signed backup')
assert.strictEqual(outputRoutes.apply(nativeControlUrl).url, nativeControlUrl, 'original comparison mode passes the exact segment URL')
assert.strictEqual(outputRoutes.startupOptions(nativeControlUrl), null, 'original comparison mode does not launch cold preflight')
assert.strictEqual(outputRoutes.challenge(outputVault.contextForUrl(nativeControlUrl)!.representation,
  { kind: 'video', requiredMbps: 3, highDemand: false }, false), null, 'original comparison mode starts no healthy probe')
await outputRestrictions.add({ host: 'upos-sz-mirrorali.bilivideo.com', type: 'black', kind: 'all', reason: 'original-mode', expireAt: now + 60_000 })
assert.strictEqual(outputRoutes.apply(nativeControlUrl).url, null, 'original comparison mode does not bypass a prohibited original host')
const blockedControlItem = { ...controlItem, base_url: nativeControlUrl, backup_url: [nativeControlBackup] }
outputAdapter.transform({ data: { dash: { video: [blockedControlItem], audio: [] } } }, 'page-hint')
assert.strictEqual(blockedControlItem.base_url, nativeControlBackup, 'original comparison promotes an exact legal signed backup when primary is forbidden')
}

const nativeControlUrl = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/control/clip.m4s?signature=private'
const nativeControlBackup = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/control/clip.m4s?signature=other'
const controlItem = { id: 240, codecid: 13, height: 1080, bandwidth: 1_000_000,
  base_url: nativeControlUrl, backup_url: [nativeControlBackup] }
outputAdapter.transform({ data: { dash: { video: [controlItem], audio: [] } } }, 'page-hint')





await outputRestrictions.add({ host: 'upos-sz-mirrorali.bilivideo.com', type: 'black', kind: 'all', reason: 'original-mode', expireAt: now + 60_000 })

const blockedControlItem = { ...controlItem, base_url: nativeControlUrl, backup_url: [nativeControlBackup] }
outputAdapter.transform({ data: { dash: { video: [blockedControlItem], audio: [] } } }, 'page-hint')

const promotedRep = outputVault.contextForUrl(nativeControlBackup)!.representation
const promotedPlan = outputRoutes.snapshot().recentPlans
if (scenario === 10) return async () => {
assert.ok(promotedPlan.some(row => row.host === new URL(nativeControlBackup).host && row.action === 'pass' && row.reason === 'original-backup'),
  'the reported plan names the backup actually offered to the player, not the blocked primary')
assert.strictEqual(outputVault.outputRole(promotedRep, nativeControlBackup)?.decisionId,
  promotedPlan.find(row => row.host === new URL(nativeControlBackup).host && row.reason === 'original-backup')?.id,
  'promoted backup lineage points to its accurate route decision')
await outputRestrictions.remove('upos-sz-mirrorali.bilivideo.com', 'black')
outputRoutes.setOriginalComparison(false)
const ungroupedHost = TRUSTED_CATALOG[0]
const ungroupedUrl = `https://${ungroupedHost}/upgcxcode/test/ungrouped/1.m4s?k=1`
await outputRestrictions.add({ host: ungroupedHost, type: 'black', kind: 'audio', reason: 'ungrouped-audio', expireAt: now + 60_000 })
assert.ok(outputRoutes.apply(ungroupedUrl).decision.host !== ungroupedHost,
  'ungrouped media cannot use a host with an audio-only blacklist')
await outputRestrictions.remove(ungroupedHost, 'black')
const audioScopedUrl = `https://${ungroupedHost}/upgcxcode/test/audio/1.m4s?k=1`
const audioScopedRep = outputVault.register({ generation: outputState.generation, epoch: outputState.epoch, kind: 'audio',
  key: 'scope-audio', height: 0, codec: 'other', bandwidth: 128_000, urls: [audioScopedUrl], source: 'trusted-api' })
assert.ok(audioScopedRep, 'matched audio representation exists for blacklist coverage')
await outputRestrictions.add({ host: ungroupedHost, type: 'black', kind: 'all', reason: 'user', expireAt: now + 60_000 })
assert.ok(outputRoutes.apply(audioScopedUrl).decision.host !== ungroupedHost, 'user-wide blacklist excludes matched audio route')
assert.strictEqual(outputRoutes.apply(`${audioScopedUrl}&os=mcdn`).url, null, 'user-wide blacklist locally blocks an exceptional audio route')
}


await outputRestrictions.remove('upos-sz-mirrorali.bilivideo.com', 'black')
outputRoutes.setOriginalComparison(false)
const ungroupedHost = TRUSTED_CATALOG[0]
const ungroupedUrl = `https://${ungroupedHost}/upgcxcode/test/ungrouped/1.m4s?k=1`
await outputRestrictions.add({ host: ungroupedHost, type: 'black', kind: 'audio', reason: 'ungrouped-audio', expireAt: now + 60_000 })

await outputRestrictions.remove(ungroupedHost, 'black')
const audioScopedUrl = `https://${ungroupedHost}/upgcxcode/test/audio/1.m4s?k=1`
const audioScopedRep = outputVault.register({ generation: outputState.generation, epoch: outputState.epoch, kind: 'audio',
  key: 'scope-audio', height: 0, codec: 'other', bandwidth: 128_000, urls: [audioScopedUrl], source: 'trusted-api' })

await outputRestrictions.add({ host: ungroupedHost, type: 'black', kind: 'all', reason: 'user', expireAt: now + 60_000 })


await outputRestrictions.remove(ungroupedHost, 'black')
if (scenario === 11) {
 let iteration = 0
for (const type of ['black', 'dead'] as const) {
 if (iteration++ === parameter) return async () => {
  await outputRestrictions.add({ host: ungroupedHost, type, kind: 'all', reason: 'exceptional', expireAt: now + 60_000 })
  assert.strictEqual(outputRoutes.apply(`${ungroupedUrl}&os=mcdn`).url, null, `${type} blocks PCDN-marked Catalog host`)
  await outputRestrictions.remove(ungroupedHost, type)
}
 }
 throw Error('Unknown fixture parameter')
}
for (const type of ['black', 'dead'] as const) {
  await outputRestrictions.add({ host: ungroupedHost, type, kind: 'all', reason: 'exceptional', expireAt: now + 60_000 })
  await outputRestrictions.remove(ungroupedHost, type)
}
const unknownQuery = alternateOutput!.replace('k=1', 'k=unknown')
if (scenario === 12) return async () => {
assert.ok(outputRoutes.apply(unknownQuery).decision.reason !== 'player-fallback', 'weak query match is not a backup capability')
await outputEvidence.record(TRUSTED_CATALOG[0], 'video', { requestId: 'fresh-challenger', at: now, source: 'transport', outcome: 'success', throughputMbps: 10, ttfbMs: 1, failureKind: null })
assert.ok(outputRoutes.challenge(outputRep, { kind: 'video', requiredMbps: 3, highDemand: false }, false)?.decision.host !== TRUSTED_CATALOG[1], 'challenger never selects default unavailable cosov')
const beforeGeneration = outputSession.get()
await outputRoutes.observe({ ...healthyObservation, generation: beforeGeneration.generation, epoch: beforeGeneration.epoch, representation: outputRep,
  originalHost: forbiddenUrl, targetHost: TRUSTED_CATALOG[2], finalHost: TRUSTED_CATALOG[2], completedAt: now, decisionId: fallbackApplied.decision.id })
await outputRoutes.observe({ ...healthyObservation, generation: beforeGeneration.generation, epoch: beforeGeneration.epoch, representation: outputRep,
  targetHost: TRUSTED_CATALOG[2], finalHost: null, outcome: 'abort', status: 0, completedAt: now + 1 })
assert.strictEqual(outputRoutes.latestVideoHost(), TRUSTED_CATALOG[2], 'latest abort does not erase last successful video host')
await outputRoutes.observe({ ...healthyObservation, generation: beforeGeneration.generation, epoch: beforeGeneration.epoch, representation: outputRep,
  targetHost: TRUSTED_CATALOG[3], finalHost: null, outcome: 'failure', failureKind: 'network', status: 0, completedAt: now + 2 })
assert.ok(outputEvidence.get(TRUSTED_CATALOG[3], 'video')?.circuitUntil! > now, 'no-response network failure still attributed to sent target')
await outputSettings.update({ catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map(host => [host, false])) })
outputRoutes.invalidateForUserSetting()
assert.strictEqual(outputRoutes.apply(forbiddenUrl).url, null, 'no legal alternative blocks forbidden source')
const noOutput = { ...outputItem, base_url: forbiddenUrl, backup_url: [forbiddenUrl] }
outputAdapter.transform({ data: { dash: { video: [noOutput], audio: [] } } })
assert.strictEqual(noOutput.base_url, '', 'blocked playurl does not leak original primary')
assert.strictEqual(noOutput.backup_url.length, 0, 'blocked playurl does not leak original backup')
const gapRecorder = new DiagnosticRecorder(() => coreClock, () => false)
const gapRecovery = scope.own(new RecoveryController(recoveryPlayer, () => coreClock))
gapRecovery.subscribe(event => gapRecorder.record(event))
gapRecovery.tick(healthyCustomRate)
for (let i = 0; i < 5; i++) { coreClock += 10_000; gapRecovery.tick(deadPaused) }
assert.strictEqual(gapRecorder.snapshot().incident, null, 'background timer gaps do not count as continuous dead-core ticks')
}

await outputEvidence.record(TRUSTED_CATALOG[0], 'video', { requestId: 'fresh-challenger', at: now, source: 'transport', outcome: 'success', throughputMbps: 10, ttfbMs: 1, failureKind: null })

const beforeGeneration = outputSession.get()
await outputRoutes.observe({ ...healthyObservation, generation: beforeGeneration.generation, epoch: beforeGeneration.epoch, representation: outputRep,
  originalHost: forbiddenUrl, targetHost: TRUSTED_CATALOG[2], finalHost: TRUSTED_CATALOG[2], completedAt: now, decisionId: fallbackApplied.decision.id })
await outputRoutes.observe({ ...healthyObservation, generation: beforeGeneration.generation, epoch: beforeGeneration.epoch, representation: outputRep,
  targetHost: TRUSTED_CATALOG[2], finalHost: null, outcome: 'abort', status: 0, completedAt: now + 1 })

await outputRoutes.observe({ ...healthyObservation, generation: beforeGeneration.generation, epoch: beforeGeneration.epoch, representation: outputRep,
  targetHost: TRUSTED_CATALOG[3], finalHost: null, outcome: 'failure', failureKind: 'network', status: 0, completedAt: now + 2 })

await outputSettings.update({ catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map(host => [host, false])) })
outputRoutes.invalidateForUserSetting()

const noOutput = { ...outputItem, base_url: forbiddenUrl, backup_url: [forbiddenUrl] }
outputAdapter.transform({ data: { dash: { video: [noOutput], audio: [] } } })


const gapRecorder = new DiagnosticRecorder(() => coreClock, () => false)
const gapRecovery = scope.own(new RecoveryController(recoveryPlayer, () => coreClock))
gapRecovery.subscribe(event => gapRecorder.record(event))
gapRecovery.tick(healthyCustomRate)
for (let i = 0; i < 5; i++) { coreClock += 10_000; gapRecovery.tick(deadPaused) }

gapRecovery.reset()
for (let i = 0; i < 5; i++) { coreClock += 1000; gapRecovery.tick(deadPaused) }
if (scenario === 13) return async () => {
assert.strictEqual(gapRecorder.snapshot().incident, null, 'initial dead-looking startup without previous health is not an incident')
await outputSettings.update({ catalogOverrides: {}, fixedHost: null })
outputRoutes.invalidateForUserSetting()
const realAdapter = scope.own(new TransportAdapter(outputSession, outputSettings, outputRoutes, outputAdapter, measurementStub, () => now, createRuntimeIds()))
realAdapter.install()
const tracedXhr = new FakeXhr();
tracedXhr.open('GET', outputItem.base_url);
tracedXhr.send()
await Promise.resolve()
const tracedVideo = (outputRoutes.snapshot().latest).video
assert.strictEqual(tracedXhr.nativeSends, 1, 'playurl output is sent through the native XHR method exactly once')
assert.strictEqual(tracedVideo?.targetHost, new URL(tracedXhr.url).host, 'route report target matches the URL received by native XHR')
assert.strictEqual(tracedVideo?.playurlOutput?.originalHost, 'upos-sz-mirrorcosov.bilivideo.com',
  'the completed native request retains the original playurl host lineage')
const actualXhr = new FakeXhr()
actualXhr.open('GET', forbiddenUrl)
assert.ok(!actualXhr.url.includes('mirrorcosov'), 'native XHR open receives rewritten legal host')
const initiallySentHost = new URL(actualXhr.url).host
await outputRestrictions.add({ host: initiallySentHost, type: 'black', kind: 'all', reason: 'before-send', expireAt: now + 60_000 })
actualXhr.send()
assert.strictEqual(actualXhr.nativeSends, 1, 'XHR sends one replacement request')
assert.ok(new URL(actualXhr.url).host !== initiallySentHost, 'restriction added after open is rechecked before native send')
await outputSettings.update({ catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map(host => [host, false])) })
const blockedXhr = new FakeXhr();
blockedXhr.open('GET', forbiddenUrl);
blockedXhr.send()
assert.strictEqual(blockedXhr.nativeSends, 0, 'no-alternative XHR never sends forbidden native request')
}

await outputSettings.update({ catalogOverrides: {}, fixedHost: null })
outputRoutes.invalidateForUserSetting()
const realAdapter = scope.own(new TransportAdapter(outputSession, outputSettings, outputRoutes, outputAdapter, measurementStub, () => now, createRuntimeIds()))
realAdapter.install()
const tracedXhr = new FakeXhr();
tracedXhr.open('GET', outputItem.base_url);
tracedXhr.send()
await Promise.resolve()
const tracedVideo = (outputRoutes.snapshot().latest).video



const actualXhr = new FakeXhr()
actualXhr.open('GET', forbiddenUrl)

const initiallySentHost = new URL(actualXhr.url).host
await outputRestrictions.add({ host: initiallySentHost, type: 'black', kind: 'all', reason: 'before-send', expireAt: now + 60_000 })
actualXhr.send()


await outputSettings.update({ catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map(host => [host, false])) })
const blockedXhr = new FakeXhr();
blockedXhr.open('GET', forbiddenUrl);
blockedXhr.send()

const exceptionalXhr = new FakeXhr();
exceptionalXhr.open('GET', exceptionalForbidden);
exceptionalXhr.send()
if (scenario === 14) return async () => {
assert.strictEqual(exceptionalXhr.nativeSends, 0, 'XHR does not send default-unavailable PCDN-marked media')
const fetchCountBeforeBlock = nativeFetchCalls
let fetchBlocked = false
try { await fakeWindow.fetch(forbiddenUrl) } catch { fetchBlocked = true }
assert.ok(fetchBlocked, 'no-alternative Fetch rejects locally')
assert.strictEqual(nativeFetchCalls, fetchCountBeforeBlock, 'blocked Fetch sends no native request')
let exceptionalFetchBlocked = false
try { await fakeWindow.fetch(exceptionalForbidden) } catch { exceptionalFetchBlocked = true }
assert.ok(exceptionalFetchBlocked, 'Fetch does not send default-unavailable PCDN-marked media')
assert.strictEqual(nativeFetchCalls, fetchCountBeforeBlock, 'exceptional Fetch does not reach native transport')
await outputSettings.update({ disabled: true })
const enabledAfterOpen = new FakeXhr();
enabledAfterOpen.open('GET', forbiddenUrl)
await outputSettings.update({ disabled: false })
enabledAfterOpen.send()
assert.strictEqual(enabledAfterOpen.nativeSends, 0, 'XHR opened while disabled rechecks restriction when enabled before send')
await outputSettings.update({ disabled: true })
const disabledXhr = new FakeXhr();
disabledXhr.open('GET', forbiddenUrl);
disabledXhr.send()
assert.strictEqual(disabledXhr.url, forbiddenUrl, 'disabled adapter preserves website original request')
assert.strictEqual(disabledXhr.nativeSends, 1, 'disabled adapter sends website request once')
}

const fetchCountBeforeBlock = nativeFetchCalls
let fetchBlocked = false
try { await fakeWindow.fetch(forbiddenUrl) } catch { fetchBlocked = true }


let exceptionalFetchBlocked = false
try { await fakeWindow.fetch(exceptionalForbidden) } catch { exceptionalFetchBlocked = true }


await outputSettings.update({ disabled: true })
const enabledAfterOpen = new FakeXhr();
enabledAfterOpen.open('GET', forbiddenUrl)
await outputSettings.update({ disabled: false })
enabledAfterOpen.send()

await outputSettings.update({ disabled: true })
const disabledXhr = new FakeXhr();
disabledXhr.open('GET', forbiddenUrl);
disabledXhr.send()


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
intentVideo = { ...deadPaused };
intentClock += 1000;
intentRecovery.tick(intentVideo)
if (scenario === 15) return async () => {
assert.ok(intentTarget.play !== originalIntentPlay, 'play observer installed on first paused tick, not thirty seconds later')
intentClock += 31_000
assert.strictEqual(intentTarget.play(), 'original-result', 'play observer preserves original return')
assert.strictEqual(intentRecovery.isRecovering(), false, 'untrusted play call never arms reload')
activation = true;
intentTarget.play()
assert.strictEqual(intentRecovery.isRecovering(), true, 'trusted long-pause request arms intent while video stays paused')
for (let tick = 0; tick < 4; tick++) { intentClock += 1000; intentRecovery.tick(intentVideo) }
assert.strictEqual(intentReloads, 1, 'dead paused video with valid intent reloads once')
intentClock += 1000;
intentRecovery.tick(intentVideo)
assert.strictEqual(intentReloads, 1, 'repeated dead ticks cannot loop reload')
intentRecovery.reset()
assert.strictEqual(intentTarget.play, originalIntentPlay, 'generation reset restores owned play method')
for (let i = 0; i < 1000; i++) coreRecorder.record({ type: 'transport', at: coreClock, observation: { ...healthyObservation, completedAt: coreClock } })
assert.strictEqual(coreRecorder.snapshot().incident?.id, frozenCore?.id, 'one thousand successes retain frozen core incident')
assert.ok(new TextEncoder().encode(JSON.stringify(coreRecorder.snapshot())).length <= 128 * 1024, 'recorder remains within 128 KiB')
assert.ok(new TextEncoder().encode(coreRecorder.buildReport({})).length <= 96 * 1024, 'report remains within 96 KiB')
assert.ok(!coreRecorder.buildReport({}).includes('token=secret'), 'incident report contains no test signed query')
}

intentClock += 31_000


activation = true;
intentTarget.play()

for (let tick = 0; tick < 4; tick++) { intentClock += 1000; intentRecovery.tick(intentVideo) }

intentClock += 1000;
intentRecovery.tick(intentVideo)

intentRecovery.reset()

for (let i = 0; i < 1000; i++) coreRecorder.record({ type: 'transport', at: coreClock, observation: { ...healthyObservation, completedAt: coreClock } })




await outputSettings.update({ disabled: false, catalogOverrides: {}, fixedHost: null })
outputRoutes.invalidateForUserSetting()
const nativeAudioUrl = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/test/output/audio.m4s?s=exact'
const audioItem = { id: 30280, base_url: nativeAudioUrl, backup_url: [], bandwidth: 100_000 }
outputAdapter.transform({ data: { dash: { video: [], audio: [audioItem] } } })
const beforeAudioAffinity = outputSession.get().affinity
const nativeAudioApplied = outputRoutes.apply(nativeAudioUrl)
if (scenario === 16) return async () => {
assert.strictEqual(nativeAudioApplied.url, nativeAudioUrl, 'eligible Native backup uses its own full signed URL')
assert.strictEqual(nativeAudioApplied.decision.routeType, 'root-original', 'cold-start signed original remains unchanged before preflight')
assert.strictEqual(outputSession.get().affinity, beforeAudioAffinity, 'audio backup request does not alter video affinity')
const audioRep = nativeAudioApplied.context!.representation
outputVault.invalidate(audioRep, new URL(nativeAudioUrl).host)
assert.ok(outputRoutes.apply(nativeAudioUrl).url !== nativeAudioUrl, 'invalid Native cannot return through existing backup role')
const repeatAudio = { id: 30280, base_url: nativeAudioUrl, backup_url: [nativeAudioUrl], bandwidth: 100_000 }
outputAdapter.transform({ data: { dash: { video: [], audio: [repeatAudio] } } })
assert.ok(![repeatAudio.base_url, ...repeatAudio.backup_url].includes(nativeAudioUrl), 'invalid Native is removed from refreshed player outputs')
const nextGeneration = outputSession.beginGeneration(false)
outputVault.reset(nextGeneration.generation, nextGeneration.epoch);
outputRoutes.resetEpoch()
assert.strictEqual(outputVault.outputRole(audioRep, nativeAudioUrl), null, 'generation reset discards output roles')
assert.strictEqual(outputRoutes.latestVideoHost(), null, 'generation reset drops old successful host')
}



const audioRep = nativeAudioApplied.context!.representation
outputVault.invalidate(audioRep, new URL(nativeAudioUrl).host)

const repeatAudio = { id: 30280, base_url: nativeAudioUrl, backup_url: [nativeAudioUrl], bandwidth: 100_000 }
outputAdapter.transform({ data: { dash: { video: [], audio: [repeatAudio] } } })

const nextGeneration = outputSession.beginGeneration(false)
outputVault.reset(nextGeneration.generation, nextGeneration.epoch);
outputRoutes.resetEpoch()


throw Error('Unknown fixture scenario')
}

test("Fetch and XHR hook assignments are verified [1]", { timeout: 5000 }, async t => { await (await fixture(t, 0))() })
test("disabled mode passes site fetch through [2]", { timeout: 5000 }, async t => { await (await fixture(t, 1))() })
test("rewritten Request preserves request headers [3]", { timeout: 5000 }, async t => { await (await fixture(t, 2))() })
test("blacklisted non-GET Fetch never reaches native fetch [4]", { timeout: 5000 }, async t => { await (await fixture(t, 3))() })
test("init.method override is preserved for native Fetch [5]", { timeout: 5000 }, async t => { await (await fixture(t, 4))() })
test("forbidden original cannot remain in playurl primary or backup [6]", { timeout: 5000 }, async t => { await (await fixture(t, 5))() })
test("opaque signed output remains observation-only [7]", { timeout: 5000 }, async t => { await (await fixture(t, 6))() })
test("paused dead core automatically captures an incident [8]", { timeout: 5000 }, async t => { await (await fixture(t, 7))() })
{
 let parameter = 0
for (const type of ['black', 'dead'] as const) {
 const selected = parameter++
 test("`${type} invalidates cached fallback on next request` [9]" + ` / ${String(type)} / ${selected}`, { timeout: 5000 }, async t => { await (await fixture(t, 8, selected))() })
}
}
test("per-tab original comparison does not overwrite saved routing settings [10]", { timeout: 5000 }, async t => { await (await fixture(t, 9))() })
test("the reported plan names the backup actually offered to the player, not the blocked primary [11]", { timeout: 5000 }, async t => { await (await fixture(t, 10))() })
{
 let parameter = 0
for (const type of ['black', 'dead'] as const) {
 const selected = parameter++
 test("`${type} blocks PCDN-marked Catalog host` [12]" + ` / ${String(type)} / ${selected}`, { timeout: 5000 }, async t => { await (await fixture(t, 11, selected))() })
}
}
test("weak query match is not a backup capability [13]", { timeout: 5000 }, async t => { await (await fixture(t, 12))() })
test("initial dead-looking startup without previous health is not an incident [14]", { timeout: 5000 }, async t => { await (await fixture(t, 13))() })
test("XHR does not send default-unavailable PCDN-marked media [15]", { timeout: 5000 }, async t => { await (await fixture(t, 14))() })
test("play observer installed on first paused tick, not thirty seconds later [16]", { timeout: 5000 }, async t => { await (await fixture(t, 15))() })
test("eligible Native backup uses its own full signed URL [17]", { timeout: 5000 }, async t => { await (await fixture(t, 16))() })
