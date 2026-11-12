import { requestDispatch } from '../../support/request-dispatch.ts'
import { installProgressEvent } from '../../support/progress-event.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { deferred } from '../../support/deferred.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { type TestContext } from 'node:test'
import { playurlResult } from '../../support/playurl.ts'
import { decisionId } from '../../../src-v2/domain/model.ts'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import { parseMediaUrl } from '../../../src-v2/domain/url-policy.ts'
import { SessionStore } from '../../../src-v2/state/session-store.ts'
import { TransportAdapter } from '../../../src-v2/adapters/transport/transport.ts'
import { type AppliedRouteDecision } from '../../../src-v2/application/routing/route-contracts.ts'
import { type TransportObservation } from '../../../src-v2/domain/transport-model.ts'
import { testScope } from '../../support/scope.ts'

async function createFetchRequestResources() {
  const passDecision: AppliedRouteDecision = {
    decision: {
      action: 'pass',
      target: { type: 'request' },
      id: decisionId('runtime-pass'),
      reason: 'test',
      routeType: 'root-original',
      host: 'upos-sz-mirrorali.bilivideo.com',
      ranking: [],
    },
    url: 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/runtime.m4s',
    context: null,
    streamKey: 'runtime',
    sourceHost: 'upos-sz-mirrorali.bilivideo.com',
  }
  const observations: TransportObservation[] = []
  const routeStub = {
    prepareRequest: requestDispatch(),
    policyRevision(): number {
      return 0
    },
    requestStarted(): void {},
    isCatalogOnly(): boolean {
      return false
    },
    isBilibiliMedia(url: string): boolean {
      return /\.bilivideo\.com\/|\.akamaized\.net\//.test(url)
    },
    recognizesMedia(url: string): boolean {
      return parseMediaUrl(url)?.kind !== 'unknown'
    },
    inspectOriginal(url: string): AppliedRouteDecision {
      return this.apply(url)
    },
    apply(url: string): AppliedRouteDecision {
      return { ...passDecision, url }
    },
    async observe(observation: TransportObservation): Promise<void> {
      observations.push(observation)
    },
  }
  let transformed = 0
  const playurlStub = {
    transform() {
      transformed++
      return playurlResult(true)
    },
  }
  let disabled = false
  let blockHttpDns = true
  const settingsStub = {
    get: () => ({ disabled: disabled, blockHttpDns: blockHttpDns, considerNativeSources: true }),
  }
  let nativeFetchCalls = 0
  let cancelReason: unknown = null
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
    nativeFetchMethods.push(
      input instanceof Request ? input.method : String(_init?.method ?? 'GET'),
    )
    nativeFetchRedirects.push(
      input instanceof Request
        ? input.redirect
        : (String(_init?.redirect ?? 'follow') as RequestRedirect),
    )
    nativeFetchHeaders.push(input instanceof Request ? input.headers.get('x-bilicdn-test') : null)
    if (url.includes('/stream-body.m4s') && input instanceof Request)
      streamedRequestBody = await input.text()
    if (url.includes('/player/wbi/playurl'))
      return playurlFetchOverride ?? new Response(playurlFetchBody, { status: 200 })
    let emitted = false
    return new Response(
      new ReadableStream<Uint8Array>({
        pull(controller) {
          if (!emitted) {
            emitted = true
            controller.enqueue(new Uint8Array(70 * 1024))
          }
        },
        cancel(reason) {
          cancelReason = reason
        },
      }),
      { status: 206, headers: { 'content-type': 'video/mp4' } },
    )
  }
  class FakeXhr extends EventTarget {
    #state = 0
    get readyState() {
      return this.#state
    }
    set readyState(value: number) {
      this.#state = value
    }
    method = ''
    url = ''
    status = 200
    responseURL = ''
    sync = false
    sent = false
    #responseType: XMLHttpRequestResponseType = ''
    #timeout = 0
    get responseType(): XMLHttpRequestResponseType {
      return this.#responseType
    }
    set responseType(value: XMLHttpRequestResponseType) {
      if (this.sync) throw new DOMException('synchronous XHR', 'InvalidAccessError')
      this.#responseType = value
    }
    get timeout(): number {
      return this.#timeout
    }
    set timeout(value: number) {
      if (this.sync) throw new DOMException('synchronous XHR', 'InvalidAccessError')
      this.#timeout = value
    }
    finalResponseUrl: string | null = null
    rawResponseText: string | null = null
    holdAtLoading = false
    withCredentials = false
    payload: unknown = { ok: true }
    nativeSends = 0
    get response(): unknown {
      return this.payload
    }
    get responseText(): string {
      return this.rawResponseText ?? JSON.stringify(this.payload)
    }
    open(method: string, url: string | URL, async = true): void {
      this.method = method
      this.url = String(url)
      this.responseURL = this.url
      this.readyState = 1
      this.sync = !async
      this.sent = false
    }
    send(): void {
      if (this.readyState !== 1 || this.sent)
        throw new DOMException('send invalid state', 'InvalidStateError')
      this.sent = true
      this.nativeSends++
      if (this.finalResponseUrl) this.responseURL = this.finalResponseUrl
      this.readyState = this.holdAtLoading ? 3 : 4
      this.dispatchEvent(new Event('readystatechange'))
      if (!this.holdAtLoading) {
        this.dispatchEvent(new Event('load'))
        this.dispatchEvent(new Event('loadend'))
      }
    }
    abort(): void {
      if ((this.readyState === 1 && this.sent) || this.readyState === 2 || this.readyState === 3) {
        this.readyState = 4
        this.sent = false
        this.status = 0
        this.dispatchEvent(new Event('readystatechange'))
        this.dispatchEvent(new Event('abort'))
        this.dispatchEvent(new Event('loadend'))
      }
      if (this.readyState === 4) this.readyState = 0
    }
    setRequestHeader(_name: string, _value: string): void {}
  }
  const originalWorker = function WorkerIdentity() {
    return undefined
  }
  const fakeWindow = {
    fetch: nativeFetch,
    XMLHttpRequest: FakeXhr,
    Worker: originalWorker,
    navigator: globalThis.navigator,
  }
  return {
    passDecision,
    observations,
    routeStub,
    get transformed() {
      return transformed
    },
    set transformed(value: typeof transformed) {
      transformed = value
    },
    playurlStub,
    get disabled(): boolean {
      return disabled
    },
    set disabled(value: boolean) {
      disabled = value
    },
    settingsStub,
    get nativeFetchCalls() {
      return nativeFetchCalls
    },
    set nativeFetchCalls(value: typeof nativeFetchCalls) {
      nativeFetchCalls = value
    },
    get cancelReason() {
      return cancelReason
    },
    set cancelReason(value: typeof cancelReason) {
      cancelReason = value
    },
    nativeFetchUrls,
    nativeFetchMethods,
    nativeFetchHeaders,
    get streamedRequestBody() {
      return streamedRequestBody
    },
    set streamedRequestBody(value: typeof streamedRequestBody) {
      streamedRequestBody = value
    },
    nativeFetch,
    FakeXhr,
    originalWorker,
    fakeWindow,
  }
}

async function createTransportFixture(t: TestContext) {
  const scope = testScope(t)
  installProgressEvent(scope)
  const now = 2_000_000_000_000,
    runtimeSession = new SessionStore(),
    resources = await createFetchRequestResources()
  runtimeSession.beginGeneration(false)
  scope.defineGlobal('unsafeWindow', { configurable: true, value: resources.fakeWindow })
  scope.defineGlobal('location', {
    configurable: true,
    value: new URL('https://www.bilibili.com/video/BVtest/'),
  })
  let skippedPreflightReason = ''
  const measurementStub = {
    willGateStartup: (): boolean => false,
    prepareStartup: async (): Promise<void> => {},
    noteUnpreflighted(reason: string): void {
      skippedPreflightReason = reason
    },
  }
  const transport = scope.own(
    new TransportAdapter(
      runtimeSession,
      resources.settingsStub,
      resources.routeStub,
      resources.playurlStub,
      measurementStub,
      () => now,
      createRuntimeIds(),
      undefined,
      () => now,
    ),
  )
  transport.install()
  return Object.assign(resources, {
    scope,
    now,
    runtimeSession,
    measurementStub,
    transport,
    gatedUrl: 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/gated.m4s',
    preflightReason: {
      get value() {
        return skippedPreflightReason
      },
      set value(reason: string) {
        skippedPreflightReason = reason
      },
    },
  })
}

async function createGatedFixture(t: TestContext) {
  const base = await createTransportFixture(t)
  const gate = {
    ready: true,
    release: () => {},
    done: Promise.resolve(),
  }
  base.scope.defer(() => gate.release())
  base.measurementStub.prepareStartup = () => {
    const done = deferred<void>()
    gate.done = done.promise
    gate.release = () => {
      gate.ready = true
      done.resolve()
    }
    return done.promise
  }
  base.routeStub.apply = (url: string): AppliedRouteDecision =>
    gate.ready
      ? {
          ...base.passDecision,
          decision: {
            action: 'rewrite',
            id: decisionId('gated-rewrite'),
            reason: 'preflight',
            routeType: 'catalog-generated',
            host: TRUSTED_CATALOG[0],
            candidate: {
              type: 'catalog-generated',
              host: TRUSTED_CATALOG[0],
              kind: 'video',
            },
            ranking: [],
          },
          url: url.replace('upos-sz-mirrorali.bilivideo.com', TRUSTED_CATALOG[0]),
        }
      : { ...base.passDecision, url }
  return Object.assign(base, { gate })
}

async function createBlockedFixture(t: TestContext) {
  const base = await createTransportFixture(t)
  const forbiddenNonGetUrl = 'https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/a/b/forbidden.m4s'
  base.routeStub.apply = (url: string): AppliedRouteDecision => ({
    ...base.passDecision,
    url: url === forbiddenNonGetUrl ? null : url,
    decision:
      url === forbiddenNonGetUrl
        ? {
            action: 'block',
            id: decisionId('blocked-non-get'),
            reason: 'black',
            routeType: 'root-original',
            host: 'upos-sz-mirrorcosov.bilivideo.com',
            ranking: [],
          }
        : base.passDecision.decision,
  })
  return Object.assign(base, { forbiddenNonGetUrl })
}

async function checkBlacklistedNonGETFetchNeverReachesNativeFetch4(t: TestContext): Promise<void> {
  const base = await createBlockedFixture(t)

  const beforeForbidden = base.nativeFetchCalls
  await base.fakeWindow.fetch(base.forbiddenNonGetUrl, { method: 'POST' }).then(
    () => {
      throw new Error('blacklisted POST Fetch must reject locally')
    },
    () => undefined,
  )

  assert.strictEqual(
    base.nativeFetchCalls,
    beforeForbidden,
    'blacklisted non-GET Fetch never reaches native fetch',
  )
  const forbiddenXhr = new base.FakeXhr()
  forbiddenXhr.open('POST', base.forbiddenNonGetUrl)
  forbiddenXhr.send()
  assert.strictEqual(
    forbiddenXhr.nativeSends,
    0,
    'blacklisted non-GET XHR never reaches native send',
  )
  assert.strictEqual(
    base.transport.snapshot().lastBlocked?.reason,
    'black',
    'local block status retains the reason without a URL',
  )
  const forbiddenRequest = new Request(base.forbiddenNonGetUrl, { method: 'POST' })
  await base.fakeWindow.fetch(forbiddenRequest).then(
    () => {
      throw new Error('blacklisted Request object must reject locally')
    },
    () => undefined,
  )
  assert.strictEqual(
    base.nativeFetchCalls,
    beforeForbidden,
    'blacklisted Request object never reaches native fetch',
  )
  const spoofedRequest = new Request(base.forbiddenNonGetUrl, { method: 'POST' })
  Object.defineProperty(spoofedRequest, 'href', {
    value: 'https://upos-sz-mirrorali.bilivideo.com/live-bvc/allowed.m4s',
  })
  await base.fakeWindow.fetch(spoofedRequest).then(
    () => {
      throw new Error('forged Request.href must not bypass blocked POST')
    },
    () => undefined,
  )
  assert.strictEqual(
    base.nativeFetchCalls,
    beforeForbidden,
    'Fetch checks the Request internal URL, not a forged href expando',
  )
  base.measurementStub.willGateStartup = () => false
  const converseRequest = new Request(base.passDecision.url ?? '')
  Object.defineProperty(converseRequest, 'href', { value: base.forbiddenNonGetUrl })
  await base.fakeWindow.fetch(converseRequest)
  assert.strictEqual(
    base.nativeFetchUrls.at(-1),
    base.passDecision.url,
    'forged forbidden href cannot block an allowed Request',
  )
  const beforeDnsRequest = base.nativeFetchCalls
  const spoofedDns = new Request('https://httpdns.bilivideo.com/resolve')
  Object.defineProperty(spoofedDns, 'href', { value: base.passDecision.url })
  const spoofedDnsResponse = await base.fakeWindow.fetch(spoofedDns)
  assert.strictEqual(
    spoofedDnsResponse.status,
    503,
    'forged Request.href cannot bypass HTTPDNS block',
  )
  assert.strictEqual(
    base.nativeFetchCalls,
    beforeDnsRequest,
    'blocked HTTPDNS Request never reaches native fetch',
  )
}

async function checkInitMethodOverrideIsPreservedForNativeFetch5(t: TestContext): Promise<void> {
  const base = await createTransportFixture(t)

  base.routeStub.inspectOriginal = (url: string): AppliedRouteDecision => ({
    ...base.passDecision,
    url,
  })
  const overrideRequest = new Request(base.gatedUrl, { method: 'GET' })
  await base.fakeWindow.fetch(overrideRequest, { method: 'POST' })

  assert.strictEqual(
    base.nativeFetchMethods.at(-1),
    'POST',
    'init.method override is preserved for native Fetch',
  )
  assert.strictEqual(
    base.nativeFetchUrls.at(-1),
    base.gatedUrl,
    'non-GET method override is not rewritten as a GET',
  )
  const streamBody = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('stream-ok'))
      controller.close()
    },
  })
  await base.fakeWindow.fetch(
    new Request('https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/stream-body.m4s', {
      method: 'POST',
      body: streamBody,
      duplex: 'half',
    } as RequestInit),
  )
  assert.strictEqual(
    base.streamedRequestBody,
    'stream-ok',
    'normalized POST Request preserves a streaming body',
  )
  base.measurementStub.willGateStartup = () => false
  const xhr = new base.FakeXhr()
  xhr.responseType = 'json'
  xhr.payload = { code: 0, data: { dash: { video: [], audio: [] } } }
  xhr.open('GET', 'https://api.bilibili.com/x/player/wbi/playurl')
  xhr.send()
  void xhr.response
  assert.strictEqual(base.transformed, 1, 'XHR JSON playurl is transformed lazily once')
  assert.strictEqual(
    base.fakeWindow.Worker,
    base.originalWorker,
    'Worker constructor identity is untouched',
  )
  base.transport.dispose()
  class UnpatchableXhr extends base.FakeXhr {}
  Object.defineProperty(UnpatchableXhr.prototype, 'send', {
    value: base.FakeXhr.prototype.send,
    writable: false,
    configurable: true,
  })
  const partialWindow = { fetch: base.nativeFetch, XMLHttpRequest: UnpatchableXhr }
  base.scope.defineGlobal('unsafeWindow', { configurable: true, value: partialWindow })
  const originalPartialOpen = UnpatchableXhr.prototype.open
  const partialTransport = base.scope.own(
    new TransportAdapter(
      base.runtimeSession,
      base.settingsStub,
      base.routeStub,
      base.playurlStub,
      base.measurementStub,
      () => base.now,
      createRuntimeIds(),
      undefined,
      () => base.now,
    ),
  )
  partialTransport.install()
  assert.strictEqual(
    partialTransport.snapshot().hookState,
    'failed',
    'partial hook installation is reported as failed',
  )
  assert.strictEqual(
    partialWindow.fetch,
    base.nativeFetch,
    'partial XHR install failure restores fetch',
  )
  assert.strictEqual(
    UnpatchableXhr.prototype.open,
    originalPartialOpen,
    'partial XHR install failure restores open',
  )
}

async function checkRewrittenRequestPreservesRequestHeaders3(t: TestContext): Promise<void> {
  const base = await createGatedFixture(t)
  const headerRequest = new Request(base.gatedUrl, { headers: { 'x-bilicdn-test': 'kept' } })
  await base.fakeWindow.fetch(headerRequest)

  assert.strictEqual(
    base.nativeFetchHeaders.at(-1),
    'kept',
    'rewritten Request preserves request headers',
  )
  await base.fakeWindow.fetch(new URL(base.gatedUrl))
  assert.strictEqual(
    new URL(base.nativeFetchUrls.at(-1) ?? '').host,
    TRUSTED_CATALOG[0],
    'URL object is normalized before rewrite',
  )
  base.measurementStub.willGateStartup = () => true
  base.gate.ready = false
  const gatedXhr = new base.FakeXhr()
  gatedXhr.open('GET', base.gatedUrl)
  gatedXhr.send()
  assert.strictEqual(gatedXhr.nativeSends, 0, 'async XHR send waits before native dispatch')
  base.gate.release()
  await base.gate.done
  assert.strictEqual(gatedXhr.nativeSends, 1, 'async XHR sends exactly once after preflight')
  assert.strictEqual(
    new URL(gatedXhr.url).host,
    TRUSTED_CATALOG[0],
    'XHR dispatch uses preflight winner',
  )
  base.gate.ready = false
  const abortedXhr = new base.FakeXhr()
  abortedXhr.open('GET', base.gatedUrl)
  abortedXhr.send()
  abortedXhr.abort()
  base.gate.release()
  await base.gate.done
  assert.strictEqual(
    abortedXhr.nativeSends,
    0,
    'XHR abort during preflight never dispatches the website request',
  )
  const finiteTimeoutXhr = new base.FakeXhr()
  base.preflightReason.value = ''
  finiteTimeoutXhr.timeout = 5000
  finiteTimeoutXhr.open('GET', base.gatedUrl)
  finiteTimeoutXhr.send()
  assert.strictEqual(
    finiteTimeoutXhr.nativeSends,
    0,
    'explicit XHR timeout joins the same bounded preflight',
  )
  base.gate.release()
  await base.gate.done
  assert.strictEqual(finiteTimeoutXhr.nativeSends, 1)
  assert.strictEqual(finiteTimeoutXhr.timeout, 5000)
  assert.strictEqual(
    base.preflightReason.value,
    '',
    'XHR timeout no longer generates a skipped-preflight reason',
  )
}

async function checkDisabledModePassesSiteFetchThrough2(t: TestContext): Promise<void> {
  const base = await createTransportFixture(t)

  const beforeHttpDns = base.nativeFetchCalls
  await base.fakeWindow.fetch('https://httpdns.bilivideo.com/resolve')
  base.disabled = true
  await base.fakeWindow.fetch('https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/disabled.m4s')

  assert.strictEqual(
    base.nativeFetchCalls,
    beforeHttpDns + 1,
    'disabled mode passes site fetch through',
  )
  base.disabled = false
  const gatedUrl = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/gated.m4s'
  const gateControl: { release: () => void; done: Promise<void> } = {
    release: () => undefined,
    done: Promise.resolve(),
  }
  let gateReady = false
  base.measurementStub.willGateStartup = () => true
  base.measurementStub.prepareStartup = () => {
    const done = deferred<void>()
    gateControl.done = done.promise
    gateControl.release = () => {
      gateReady = true
      done.resolve()
    }
    return done.promise
  }
  base.routeStub.apply = (url: string): AppliedRouteDecision =>
    gateReady
      ? {
          ...base.passDecision,
          decision: {
            action: 'rewrite',
            id: decisionId('gated-rewrite'),
            reason: 'preflight',
            routeType: 'catalog-generated',
            host: TRUSTED_CATALOG[0],
            candidate: {
              type: 'catalog-generated',
              host: TRUSTED_CATALOG[0],
              kind: 'video',
            },
            ranking: [],
          },
          url: url.replace('upos-sz-mirrorali.bilivideo.com', TRUSTED_CATALOG[0]),
        }
      : { ...base.passDecision, url }
  const beforeGate = base.nativeFetchCalls
  const gatedFetch = base.fakeWindow.fetch(gatedUrl)
  assert.strictEqual(
    base.nativeFetchCalls,
    beforeGate,
    'Fetch player request waits before native dispatch',
  )
  gateControl.release()
  await gatedFetch
  assert.strictEqual(
    new URL(base.nativeFetchUrls.at(-1) ?? '').host,
    TRUSTED_CATALOG[0],
    'Fetch dispatch uses preflight winner',
  )
  gateReady = false
  const mutableMediaUrl = new URL(gatedUrl)
  const mutableInit: RequestInit = { method: 'GET' }
  const beforeLifecycleGate = base.nativeFetchCalls
  const lifecycleFetch = base.fakeWindow.fetch(mutableMediaUrl, mutableInit)
  assert.strictEqual(
    base.nativeFetchCalls,
    beforeLifecycleGate,
    'generation-switch Fetch waits at the same startup boundary',
  )
  mutableMediaUrl.hostname = 'upos-sz-mirrorcosov.bilivideo.com'
  mutableInit.method = 'POST'
  base.runtimeSession.beginGeneration(false)
  gateControl.release()
  await lifecycleFetch
  assert.strictEqual(
    base.nativeFetchUrls.at(-1),
    gatedUrl,
    'generation-switch Fetch sends the checked URL, not mutated input',
  )
  assert.strictEqual(
    base.nativeFetchMethods.at(-1),
    'GET',
    'generation-switch Fetch sends the checked method, not mutated init',
  )
  const originalInspect = base.routeStub.inspectOriginal
  const staleForbiddenUrl = 'https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/a/b/stale.m4s'
  base.routeStub.inspectOriginal = (url: string): AppliedRouteDecision =>
    url === staleForbiddenUrl
      ? {
          ...base.passDecision,
          url: null,
          decision: {
            action: 'block',
            id: decisionId('stale-black'),
            reason: 'black',
            routeType: 'root-original',
            host: 'upos-sz-mirrorcosov.bilivideo.com',
            ranking: [],
          },
        }
      : { ...base.passDecision, url }
  gateReady = false
  const beforeStaleForbidden = base.nativeFetchCalls
  const staleForbiddenFetch = base.fakeWindow.fetch(staleForbiddenUrl)
  base.runtimeSession.beginGeneration(false)
  gateControl.release()
  await staleForbiddenFetch.then(
    () => {
      throw new Error('stale generation must still block restricted original')
    },
    () => undefined,
  )
  assert.strictEqual(
    base.nativeFetchCalls,
    beforeStaleForbidden,
    'stale generation cannot dispatch a restricted original media host',
  )
  base.routeStub.inspectOriginal = originalInspect
  const requestInput = new Request(gatedUrl, { method: 'GET' })
  base.measurementStub.willGateStartup = () => false
  await base.fakeWindow.fetch(requestInput)
  assert.strictEqual(
    new URL(base.nativeFetchUrls.at(-1) ?? '').host,
    TRUSTED_CATALOG[0],
    'Fetch Request input dispatch uses the selected host',
  )
}

async function checkFetchAndXHRHookAssignmentsAreVerified1(t: TestContext): Promise<void> {
  const base = await createTransportFixture(t)

  assert.strictEqual(
    base.transport.snapshot().hookState,
    'installed',
    'Fetch and XHR hook assignments are verified',
  )
  const mediaResponse = await base.fakeWindow.fetch(base.passDecision.url ?? '')
  const firstIntercept = base.transport.snapshot().lastMediaRequest
  assert.ok(
    firstIntercept?.hookEntered &&
      firstIntercept.mediaRecognized &&
      firstIntercept.nativeCalled &&
      firstIntercept.responseObserved,
    'interception stages distinguish hook entry, media recognition, native invocation and response',
  )
  const mediaReader = mediaResponse.body?.getReader()
  assert.ok(mediaReader, 'fetch wrapper returns a readable body')
  await mediaReader.read()
  await mediaReader.cancel('caller-cancel')
  assert.strictEqual(
    base.cancelReason,
    'caller-cancel',
    'fetch cancel reason reaches original reader',
  )
  mediaReader.releaseLock()
  assert.equal(base.observations.length, 1, 'cancel settles exactly one observation')
  assert.strictEqual(base.observations[0]?.outcome, 'abort')
  assert.strictEqual(
    base.observations.at(-1)?.finalHost,
    null,
    'empty response URL never invents a response host',
  )
  const beforeHttpDns = base.nativeFetchCalls
  const blockedDns = await base.fakeWindow.fetch('https://httpdns.bilivideo.com/resolve')
  assert.strictEqual(blockedDns.status, 503, 'HTTPDNS manual block returns local response')
  assert.strictEqual(
    base.nativeFetchCalls,
    beforeHttpDns,
    'HTTPDNS block performs no native request',
  )
}

test('Fetch and XHR hook assignments are verified [1]', { timeout: 5000 }, async (t) => {
  await checkFetchAndXHRHookAssignmentsAreVerified1(t)
})

test('disabled mode passes site fetch through [2]', { timeout: 5000 }, async (t) => {
  await checkDisabledModePassesSiteFetchThrough2(t)
})

test('rewritten Request preserves request headers [3]', { timeout: 5000 }, async (t) => {
  await checkRewrittenRequestPreservesRequestHeaders3(t)
})

test('blacklisted non-GET Fetch never reaches native fetch [4]', { timeout: 5000 }, async (t) => {
  await checkBlacklistedNonGETFetchNeverReachesNativeFetch4(t)
})

test('init.method override is preserved for native Fetch [5]', { timeout: 5000 }, async (t) => {
  await checkInitMethodOverrideIsPreservedForNativeFetch5(t)
})
