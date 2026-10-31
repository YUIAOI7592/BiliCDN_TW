import { extendFixture } from '../support/fixture-context.ts'
import { CatalogSettingsStore } from '../support/catalog-settings.ts'
import { currentResumePlayer } from '../support/player.ts'
import { installProgressEvent } from '../support/progress-event.ts'
import { createRuntimeIds } from '../../src-v2/platform/runtime-ids.ts'
import { deferred } from '../support/deferred.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { playurlResult } from '../support/playurl.ts'
import { PlayurlController } from '../../src-v2/application/playurl-controller.ts'
import { decisionId, epochId, generationId } from '../../src-v2/domain/model.ts'
import { TRUSTED_CATALOG } from '../../src-v2/domain/catalog.ts'
import { parseMediaUrl } from '../../src-v2/domain/url-policy.ts'
import { SignedRouteVault } from '../../src-v2/state/signed-route-vault.ts'
import { RestrictionStore } from '../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../src-v2/state/evidence-store.ts'
import { SessionStore } from '../../src-v2/state/session-store.ts'
import { RouteCoordinator } from '../../src-v2/application/route-coordinator.ts'
import { TransportAdapter } from '../../src-v2/adapters/transport.ts'
import { DiagnosticRecorder } from '../../src-v2/diagnostics/recorder.ts'
import type { AppliedRouteDecision } from '../../src-v2/application/route-contracts.ts'
import type { TransportObservation } from '../../src-v2/domain/model.ts'
import { RecoveryController } from '../../src-v2/application/recovery-controller.ts'
import { PlayerAdapter } from '../../src-v2/adapters/player.ts'
import { PlayurlAdapter } from '../../src-v2/adapters/playurl.ts'
import type { PlayerPort, VideoSnapshot } from '../../src-v2/application/ports.ts'
import { FakeStorage } from '../support/storage.ts'
import { testScope } from '../support/scope.ts'

// Named scenarios create only their prerequisite state; resources belong to this test.
async function createAdaptersScenario(t: TestContext) {
  const scope = testScope(t)
  installProgressEvent(scope)
  const now = 2_000_000_000_000
  return extendFixture({}, { scope, now } as const)
}

async function createRuntimeSessionContext1(t: TestContext) {
  const base = await createAdaptersScenario(t)
  const runtimeSession = new SessionStore()
  runtimeSession.beginGeneration(false)
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
  let disabled = false,
    blockHttpDns = true
  const settingsStub = { get: () => ({ disabled, blockHttpDns, considerNativeSources: true }) }
  let nativeFetchCalls = 0,
    cancelReason: unknown = null
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
  base.scope.defineGlobal('unsafeWindow', { configurable: true, value: fakeWindow })
  base.scope.defineGlobal('location', {
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
  const transport = base.scope.own(
    new TransportAdapter(
      runtimeSession,
      settingsStub,
      routeStub,
      playurlStub,
      measurementStub,
      () => base.now,
      createRuntimeIds(),
    ),
  )
  transport.install()
  return extendFixture(base, {
    runtimeSession,
    passDecision,
    observations,
    routeStub,
    get transformed() {
      return transformed
    },
    set transformed(next: typeof transformed) {
      transformed = next
    },
    playurlStub,
    get disabled() {
      return disabled
    },
    set disabled(next: typeof disabled) {
      disabled = next
    },
    get blockHttpDns() {
      return blockHttpDns
    },
    set blockHttpDns(next: typeof blockHttpDns) {
      blockHttpDns = next
    },
    settingsStub,
    get nativeFetchCalls() {
      return nativeFetchCalls
    },
    set nativeFetchCalls(next: typeof nativeFetchCalls) {
      nativeFetchCalls = next
    },
    get cancelReason() {
      return cancelReason
    },
    set cancelReason(next: typeof cancelReason) {
      cancelReason = next
    },
    get playurlFetchBody() {
      return playurlFetchBody
    },
    set playurlFetchBody(next: typeof playurlFetchBody) {
      playurlFetchBody = next
    },
    get playurlFetchOverride() {
      return playurlFetchOverride
    },
    set playurlFetchOverride(next: typeof playurlFetchOverride) {
      playurlFetchOverride = next
    },
    nativeFetchUrls,
    nativeFetchMethods,
    nativeFetchRedirects,
    nativeFetchHeaders,
    get streamedRequestBody() {
      return streamedRequestBody
    },
    set streamedRequestBody(next: typeof streamedRequestBody) {
      streamedRequestBody = next
    },
    nativeFetch,
    FakeXhr,
    originalWorker,
    fakeWindow,
    get skippedPreflightReason() {
      return skippedPreflightReason
    },
    set skippedPreflightReason(next: typeof skippedPreflightReason) {
      skippedPreflightReason = next
    },
    measurementStub,
    transport,
  } as const)
}

async function createMediaResponseContext2(t: TestContext) {
  const base = await createRuntimeSessionContext1(t)
  const mediaResponse = await base.fakeWindow.fetch(base.passDecision.url ?? '')
  base.transport.snapshot().lastMediaRequest
  const mediaReader = mediaResponse.body?.getReader()
  await mediaReader?.read()
  await mediaReader?.cancel('caller-cancel')
  return extendFixture(base, { mediaResponse, mediaReader } as const)
}

async function createRewrittenRequestPreservesRequestHeaders3Context3(t: TestContext) {
  const base = await createMediaResponseContext2(t)
  await base.fakeWindow.fetch('https://httpdns.bilivideo.com/resolve')
  base.disabled = true
  await base.fakeWindow.fetch('https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/disabled.m4s')
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
              catalogIndex: 0,
            },
            ranking: [],
          },
          url: url.replace('upos-sz-mirrorali.bilivideo.com', TRUSTED_CATALOG[0]),
        }
      : { ...base.passDecision, url }
  const gatedFetch = base.fakeWindow.fetch(gatedUrl)
  gateControl.release()
  await gatedFetch
  gateReady = false
  const mutableMediaUrl = new URL(gatedUrl)
  const mutableInit: RequestInit = { method: 'GET' }
  const lifecycleFetch = base.fakeWindow.fetch(mutableMediaUrl, mutableInit)
  mutableMediaUrl.hostname = 'upos-sz-mirrorcosov.bilivideo.com'
  mutableInit.method = 'POST'
  base.runtimeSession.beginGeneration(false)
  gateControl.release()
  await lifecycleFetch
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
  const staleForbiddenFetch = base.fakeWindow.fetch(staleForbiddenUrl)
  base.runtimeSession.beginGeneration(false)
  gateControl.release()
  await staleForbiddenFetch.then(
    () => {
      throw new Error('stale generation must still block restricted original')
    },
    () => undefined,
  )
  base.routeStub.inspectOriginal = originalInspect
  const requestInput = new Request(gatedUrl, { method: 'GET' })
  base.measurementStub.willGateStartup = () => false
  await base.fakeWindow.fetch(requestInput)
  const headerRequest = new Request(gatedUrl, { headers: { 'x-bilicdn-test': 'kept' } })
  await base.fakeWindow.fetch(headerRequest)
  return extendFixture(base, {
    gatedUrl,
    gateControl,
    get gateReady() {
      return gateReady
    },
    set gateReady(next: typeof gateReady) {
      gateReady = next
    },
    gatedFetch,
    mutableMediaUrl,
    mutableInit,
    lifecycleFetch,
    originalInspect,
    staleForbiddenUrl,
    staleForbiddenFetch,
    requestInput,
    headerRequest,
  } as const)
}

async function createBlacklistedNonGETFetchNeverReachesNativeFetch4Context4(t: TestContext) {
  const base = await createRewrittenRequestPreservesRequestHeaders3Context3(t)
  await base.fakeWindow.fetch(new URL(base.gatedUrl))
  base.measurementStub.willGateStartup = () => true
  base.gateReady = false
  const gatedXhr = new base.FakeXhr()
  gatedXhr.open('GET', base.gatedUrl)
  gatedXhr.send()
  base.gateControl.release()
  await base.gateControl.done
  base.gateReady = false
  const abortedXhr = new base.FakeXhr()
  abortedXhr.open('GET', base.gatedUrl)
  abortedXhr.send()
  abortedXhr.abort()
  base.gateControl.release()
  await base.gateControl.done
  const finiteTimeoutXhr = new base.FakeXhr()
  finiteTimeoutXhr.timeout = 5000
  finiteTimeoutXhr.open('GET', base.gatedUrl)
  finiteTimeoutXhr.send()
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
  return extendFixture(base, {
    gatedXhr,
    abortedXhr,
    finiteTimeoutXhr,
    forbiddenNonGetUrl,
  } as const)
}

async function createClockContext5(t: TestContext) {
  const base = await createAdaptersScenario(t)
  const clock = { now: () => base.now }
  const runtimeSession = new SessionStore()
  runtimeSession.beginGeneration(false)
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
  let disabled = false,
    blockHttpDns = true
  const settingsStub = { get: () => ({ disabled, blockHttpDns, considerNativeSources: true }) }
  let nativeFetchCalls = 0
  void null
  let playurlFetchBody = JSON.stringify({ code: 0, data: { dash: { video: [], audio: [] } } })
  let playurlFetchOverride: Response | null = null
  const nativeFetchUrls: string[] = []
  const nativeFetchMethods: string[] = []
  const nativeFetchRedirects: RequestRedirect[] = []
  const nativeFetchHeaders: (string | null)[] = []
  void ''
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
    if (url.includes('/stream-body.m4s') && input instanceof Request) void (await input.text())
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
          void reason
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
  base.scope.defineGlobal('unsafeWindow', { configurable: true, value: fakeWindow })
  base.scope.defineGlobal('location', {
    configurable: true,
    value: new URL('https://www.bilibili.com/video/BVtest/'),
  })
  void ''
  const measurementStub = {
    willGateStartup: (): boolean => false,
    prepareStartup: async (): Promise<void> => {},
    noteUnpreflighted(reason: string): void {
      void reason
    },
  }
  const transport = base.scope.own(
    new TransportAdapter(
      runtimeSession,
      settingsStub,
      routeStub,
      playurlStub,
      measurementStub,
      () => base.now,
      createRuntimeIds(),
    ),
  )
  transport.install()
  const mediaResponse = await fakeWindow.fetch(passDecision.url ?? '')
  transport.snapshot().lastMediaRequest
  const mediaReader = mediaResponse.body?.getReader()
  await mediaReader?.read()
  await mediaReader?.cancel('caller-cancel')
  await fakeWindow.fetch('https://httpdns.bilivideo.com/resolve')
  disabled = true
  await fakeWindow.fetch('https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/disabled.m4s')
  disabled = false
  const gatedUrl = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/gated.m4s'
  const gateControl: { release: () => void; done: Promise<void> } = {
    release: () => undefined,
    done: Promise.resolve(),
  }
  let gateReady = false
  measurementStub.willGateStartup = () => true
  measurementStub.prepareStartup = () => {
    const done = deferred<void>()
    gateControl.done = done.promise
    gateControl.release = () => {
      gateReady = true
      done.resolve()
    }
    return done.promise
  }
  routeStub.apply = (url: string): AppliedRouteDecision =>
    gateReady
      ? {
          ...passDecision,
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
              catalogIndex: 0,
            },
            ranking: [],
          },
          url: url.replace('upos-sz-mirrorali.bilivideo.com', TRUSTED_CATALOG[0]),
        }
      : { ...passDecision, url }
  const gatedFetch = fakeWindow.fetch(gatedUrl)
  gateControl.release()
  await gatedFetch
  gateReady = false
  const mutableMediaUrl = new URL(gatedUrl)
  const mutableInit: RequestInit = { method: 'GET' }
  const lifecycleFetch = fakeWindow.fetch(mutableMediaUrl, mutableInit)
  mutableMediaUrl.hostname = 'upos-sz-mirrorcosov.bilivideo.com'
  mutableInit.method = 'POST'
  runtimeSession.beginGeneration(false)
  gateControl.release()
  await lifecycleFetch
  const originalInspect = routeStub.inspectOriginal
  const staleForbiddenUrl = 'https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/a/b/stale.m4s'
  routeStub.inspectOriginal = (url: string): AppliedRouteDecision =>
    url === staleForbiddenUrl
      ? {
          ...passDecision,
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
      : { ...passDecision, url }
  gateReady = false
  const staleForbiddenFetch = fakeWindow.fetch(staleForbiddenUrl)
  runtimeSession.beginGeneration(false)
  gateControl.release()
  await staleForbiddenFetch.then(
    () => {
      throw new Error('stale generation must still block restricted original')
    },
    () => undefined,
  )
  routeStub.inspectOriginal = originalInspect
  const requestInput = new Request(gatedUrl, { method: 'GET' })
  measurementStub.willGateStartup = () => false
  await fakeWindow.fetch(requestInput)
  const headerRequest = new Request(gatedUrl, { headers: { 'x-bilicdn-test': 'kept' } })
  await fakeWindow.fetch(headerRequest)
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
  abortedXhr.open('GET', gatedUrl)
  abortedXhr.send()
  abortedXhr.abort()
  gateControl.release()
  await gateControl.done
  const finiteTimeoutXhr = new FakeXhr()
  finiteTimeoutXhr.timeout = 5000
  finiteTimeoutXhr.open('GET', gatedUrl)
  finiteTimeoutXhr.send()
  const forbiddenNonGetUrl = 'https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/a/b/forbidden.m4s'
  routeStub.apply = (url: string): AppliedRouteDecision => ({
    ...passDecision,
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
        : passDecision.decision,
  })
  await fakeWindow.fetch(forbiddenNonGetUrl, { method: 'POST' }).then(
    () => {
      throw new Error('blacklisted POST Fetch must reject locally')
    },
    () => undefined,
  )
  const forbiddenXhr = new FakeXhr()
  forbiddenXhr.open('POST', forbiddenNonGetUrl)
  forbiddenXhr.send()
  const forbiddenRequest = new Request(forbiddenNonGetUrl, { method: 'POST' })
  await fakeWindow.fetch(forbiddenRequest).then(
    () => {
      throw new Error('blacklisted Request object must reject locally')
    },
    () => undefined,
  )
  const spoofedRequest = new Request(forbiddenNonGetUrl, { method: 'POST' })
  Object.defineProperty(spoofedRequest, 'href', {
    value: 'https://upos-sz-mirrorali.bilivideo.com/live-bvc/allowed.m4s',
  })
  await fakeWindow.fetch(spoofedRequest).then(
    () => {
      throw new Error('forged Request.href must not bypass blocked POST')
    },
    () => undefined,
  )
  measurementStub.willGateStartup = () => false
  const converseRequest = new Request(passDecision.url ?? '')
  Object.defineProperty(converseRequest, 'href', { value: forbiddenNonGetUrl })
  await fakeWindow.fetch(converseRequest)
  const spoofedDns = new Request('https://httpdns.bilivideo.com/resolve')
  Object.defineProperty(spoofedDns, 'href', { value: passDecision.url })
  await fakeWindow.fetch(spoofedDns)
  routeStub.inspectOriginal = (url: string): AppliedRouteDecision => ({ ...passDecision, url })
  const overrideRequest = new Request(gatedUrl, { method: 'GET' })
  await fakeWindow.fetch(overrideRequest, { method: 'POST' })
  const streamBody = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('stream-ok'))
      controller.close()
    },
  })
  await fakeWindow.fetch(
    new Request('https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/stream-body.m4s', {
      method: 'POST',
      body: streamBody,
      duplex: 'half',
    } as RequestInit),
  )
  measurementStub.willGateStartup = () => false
  const xhr = new FakeXhr()
  xhr.responseType = 'json'
  xhr.payload = { code: 0, data: { dash: { video: [], audio: [] } } }
  xhr.open('GET', 'https://api.bilibili.com/x/player/wbi/playurl')
  xhr.send()
  transport.dispose()
  class UnpatchableXhr extends FakeXhr {}
  Object.defineProperty(UnpatchableXhr.prototype, 'send', {
    value: FakeXhr.prototype.send,
    writable: false,
    configurable: true,
  })
  const partialWindow = { fetch: nativeFetch, XMLHttpRequest: UnpatchableXhr }
  base.scope.defineGlobal('unsafeWindow', { configurable: true, value: partialWindow })
  const partialTransport = base.scope.own(
    new TransportAdapter(
      runtimeSession,
      settingsStub,
      routeStub,
      playurlStub,
      measurementStub,
      () => base.now,
      createRuntimeIds(),
    ),
  )
  partialTransport.install()
  base.scope.defineGlobal('unsafeWindow', { configurable: true, value: fakeWindow })
  let reloads = 0
  let seeks: number[] = []
  let rates: number[] = []
  let plays = 0
  let playerSnapshot: VideoSnapshot = {
    available: true,
    paused: false,
    seeking: false,
    ended: false,
    readyState: 4,
    currentTime: 349.434,
    duration: 900,
    width: 1920,
    height: 1080,
    playbackRate: 2,
    effectiveRate: 2,
    bufferAheadSec: 30,
    playableBufferSec: 15,
    bufferedToEnd: false,
    frames: 1000,
    mediaError: false,
    coreInitialized: true,
    manifestHasVideo: true,
  }
  const recoveryPlayer: PlayerPort = {
    controls: idleControls,
    observePlayIntent: () => () => undefined,
    snapshot: () => playerSnapshot,
    syncManifest: () => true,
    reload: () => {
      reloads++
    },
    currentTime: () => 349.434,
    playbackRate: () => 2,
    seek: (value) => {
      seeks.push(value)
    },
    setRate: (value) => {
      rates.push(value)
    },
    play: () => {
      plays++
      return Promise.resolve()
    },
    reset: () => undefined,
  }
  return extendFixture(base, {
    clock,
    runtimeSession,
    passDecision,
    observations,
    routeStub,
    get transformed() {
      return transformed
    },
    set transformed(next: typeof transformed) {
      transformed = next
    },
    playurlStub,
    get disabled() {
      return disabled
    },
    set disabled(next: typeof disabled) {
      disabled = next
    },
    get blockHttpDns() {
      return blockHttpDns
    },
    set blockHttpDns(next: typeof blockHttpDns) {
      blockHttpDns = next
    },
    settingsStub,
    get nativeFetchCalls() {
      return nativeFetchCalls
    },
    set nativeFetchCalls(next: typeof nativeFetchCalls) {
      nativeFetchCalls = next
    },
    get playurlFetchBody() {
      return playurlFetchBody
    },
    set playurlFetchBody(next: typeof playurlFetchBody) {
      playurlFetchBody = next
    },
    get playurlFetchOverride() {
      return playurlFetchOverride
    },
    set playurlFetchOverride(next: typeof playurlFetchOverride) {
      playurlFetchOverride = next
    },
    nativeFetchUrls,
    nativeFetchMethods,
    nativeFetchRedirects,
    nativeFetchHeaders,
    nativeFetch,
    FakeXhr,
    originalWorker,
    fakeWindow,
    measurementStub,
    transport,
    mediaResponse,
    mediaReader,
    gatedUrl,
    gateControl,
    get gateReady() {
      return gateReady
    },
    set gateReady(next: typeof gateReady) {
      gateReady = next
    },
    gatedFetch,
    mutableMediaUrl,
    mutableInit,
    lifecycleFetch,
    originalInspect,
    staleForbiddenUrl,
    staleForbiddenFetch,
    requestInput,
    headerRequest,
    gatedXhr,
    abortedXhr,
    finiteTimeoutXhr,
    forbiddenNonGetUrl,
    forbiddenXhr,
    forbiddenRequest,
    spoofedRequest,
    converseRequest,
    spoofedDns,
    overrideRequest,
    streamBody,
    xhr,
    UnpatchableXhr,
    partialWindow,
    partialTransport,
    get reloads() {
      return reloads
    },
    set reloads(next: typeof reloads) {
      reloads = next
    },
    get seeks() {
      return seeks
    },
    set seeks(next: typeof seeks) {
      seeks = next
    },
    get rates() {
      return rates
    },
    set rates(next: typeof rates) {
      rates = next
    },
    get plays() {
      return plays
    },
    set plays(next: typeof plays) {
      plays = next
    },
    get playerSnapshot() {
      return playerSnapshot
    },
    set playerSnapshot(next: typeof playerSnapshot) {
      playerSnapshot = next
    },
    recoveryPlayer,
  } as const)
}

async function createHealthyObservationContext6(t: TestContext) {
  const base = await createClockContext5(t)
  void {
    generation: generationId(1),
    epoch: epochId(1),
    decisionId: decisionId('aggregate'),
    representation: null,
    kind: 'video',
    routeType: 'catalog-generated',
    originalHost: 'a.example',
    targetHost: 'b.example',
    finalHost: 'b.example',
    status: 206,
    bytes: 100_000,
    ttfbMs: 20,
    elapsedMs: 100,
    completedAt: base.now,
    outcome: 'success',
    streamKey: 'aggregate',
  }
  const outputStorage = new FakeStorage(),
    outputSession = new SessionStore()
  const outputState = outputSession.beginGeneration(false),
    outputVault = new SignedRouteVault()
  outputVault.reset(outputState.generation, outputState.epoch)
  const outputSettings = base.scope.own(new CatalogSettingsStore(outputStorage, () => base.now))
  await outputSettings.update({ considerNativeSources: true })
  const outputRestrictions = base.scope.own(new RestrictionStore(outputStorage, () => base.now))
  const outputEvidence = base.scope.own(new EvidenceStore(outputStorage, () => base.now))
  const outputRoutes = new RouteCoordinator(
    base.clock,
    outputSession,
    outputSettings,
    outputRestrictions,
    outputEvidence,
    outputVault,
    createRuntimeIds(),
  )
  const outputAdapter = new PlayurlAdapter(
    new PlayurlController(outputSession, outputVault, outputRoutes),
  )
  const forbiddenUrl = 'https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/test/output/1.m4s?k=1'
  const outputItem = {
    id: 80,
    codecid: 13,
    height: 1080,
    bandwidth: 1_000_000,
    base_url: forbiddenUrl,
    backup_url: [forbiddenUrl],
  }
  outputAdapter.transform({ data: { dash: { video: [outputItem], audio: [] } } })
  return extendFixture(base, {
    outputStorage,
    outputSession,
    outputState,
    outputVault,
    outputSettings,
    outputRestrictions,
    outputEvidence,
    outputRoutes,
    outputAdapter,
    forbiddenUrl,
    outputItem,
  } as const)
}

async function createExceptionalForbiddenContext7(t: TestContext) {
  const base = await createHealthyObservationContext6(t)
  const exceptionalForbidden = `${base.forbiddenUrl}&os=mcdn`
  const exceptionalItem = {
    ...base.outputItem,
    base_url: exceptionalForbidden,
    backup_url: [exceptionalForbidden],
  }
  base.outputAdapter.transform({ data: { dash: { video: [exceptionalItem], audio: [] } } })
  const opaquePrimary =
    'https://upos-hz-mirrorakam.akamaized.net/opaque/video-chunk?signature=private'
  const opaqueBackup =
    'https://upos-sz-mirrorali.bilivideo.com/opaque/video-chunk?signature=private'
  const opaqueItem = {
    id: 81,
    codecid: 13,
    height: 1080,
    bandwidth: 1_000_000,
    base_url: opaquePrimary,
    backup_url: [opaqueBackup],
  }
  base.outputAdapter.transform({ data: { dash: { video: [opaqueItem], audio: [] } } }, 'page-hint')
  const opaqueLineage = base.outputRoutes.apply(opaquePrimary)
  return extendFixture(base, {
    exceptionalForbidden,
    exceptionalItem,
    opaquePrimary,
    opaqueBackup,
    opaqueItem,
    opaqueLineage,
  } as const)
}

async function createPausedDeadCoreAutomaticallyCapturesAnIncident8Context8(t: TestContext) {
  const base = await createExceptionalForbiddenContext7(t)
  await base.outputRestrictions.add({
    host: 'upos-hz-mirrorakam.akamaized.net',
    type: 'black',
    kind: 'all',
    reason: 'opaque-output',
    expireAt: base.now + 60_000,
  })
  const opaqueRestricted = {
    ...base.opaqueItem,
    base_url: base.opaquePrimary,
    backup_url: [base.opaqueBackup],
  }
  base.outputAdapter.transform(
    { data: { dash: { video: [opaqueRestricted], audio: [] } } },
    'page-hint',
  )
  await base.outputRestrictions.remove('upos-hz-mirrorakam.akamaized.net', 'black')
  const mixedItem = {
    id: 82,
    codecid: 13,
    height: 1080,
    bandwidth: 1_000_000,
    base_url:
      'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/test/mixed/82.m4s?signature=private',
    backup_url: ['https://upos-hz-mirrorakam.akamaized.net/opaque/mixed-82?signature=private'],
  }
  base.outputAdapter.transform({ data: { dash: { video: [mixedItem], audio: [] } } }, 'page-hint')
  const alternateOutput = base.outputItem.backup_url.find(
    (url) => new URL(url).host !== new URL(base.outputItem.base_url).host,
  )
  void base.outputRoutes.apply(alternateOutput ?? '')
  let coreClock = base.now,
    coreReloads = 0
  const coreRecorder = new DiagnosticRecorder(() => coreClock)
  const coreObserver = base.scope.own(
    new RecoveryController(
      currentResumePlayer({
        ...base.recoveryPlayer,
        reload: () => {
          coreReloads++
        },
      }),
      () => coreClock,
    ),
  )
  coreObserver.subscribe((event) => coreRecorder.record(event))
  coreObserver.tick({
    ...base.playerSnapshot,
    paused: false,
    readyState: 4,
    width: 1920,
    height: 1080,
  })
  const deadPaused = {
    ...base.playerSnapshot,
    paused: true,
    readyState: 0,
    width: 0,
    height: 0,
    frames: 0,
    coreInitialized: false,
  }
  for (let tick = 0; tick < 5; tick++) {
    coreClock += 1000
    coreObserver.tick(deadPaused)
  }
  return extendFixture(base, {
    opaqueRestricted,
    mixedItem,
    alternateOutput,
    get coreClock() {
      return coreClock
    },
    set coreClock(next: typeof coreClock) {
      coreClock = next
    },
    get coreReloads() {
      return coreReloads
    },
    set coreReloads(next: typeof coreReloads) {
      coreReloads = next
    },
    coreRecorder,
    coreObserver,
    deadPaused,
  } as const)
}

async function createParameterInvalidatesCachedFallbackOnNextRequest9ParameterParameterContext9(
  t: TestContext,
) {
  const base = await createPausedDeadCoreAutomaticallyCapturesAnIncident8Context8(t)
  base.coreClock += 31_000
  base.coreRecorder.tick()
  void base.coreRecorder.snapshot().incident
  base.coreRecorder.mark()
  for (let tick = 0; tick < 100; tick++) {
    base.coreClock += 1000
    base.coreObserver.tick(base.deadPaused)
  }
  void base.outputVault.contextForUrl(base.outputItem.base_url)!.representation
  void (
    base.outputRoutes.apply(base.outputItem.base_url) as AppliedRouteDecision & {
      playurlOutput?: {
        originalHost: string
        outputHost: string
        source: string
        decisionId: string
        role: string
      }
    }
  ).playurlOutput
  const alternateHost = new URL(base.alternateOutput!).host
  return extendFixture(base, { alternateHost } as const)
}

async function createPerTabOriginalComparisonDoesNotOverwriteSavedRoutingSettings10Context10(
  t: TestContext,
) {
  const base =
    await createParameterInvalidatesCachedFallbackOnNextRequest9ParameterParameterContext9(t)
  for (const type of ['black', 'dead'] as const) {
    await base.outputRestrictions.add({
      host: base.alternateHost,
      type,
      kind: 'all',
      reason: 'regression',
      expireAt: base.now + 60_000,
    })
    await base.outputSettings.update({ fixedHost: base.alternateHost })
    base.outputRoutes.invalidateForUserSetting()
    const item = {
      ...base.outputItem,
      base_url: base.forbiddenUrl,
      backup_url: [base.alternateOutput!],
    }
    base.outputAdapter.transform({ data: { dash: { video: [item], audio: [] } } })
    await base.outputRestrictions.remove(base.alternateHost, type)
  }
  await base.outputSettings.update({ fixedHost: null })
  base.outputRoutes.invalidateForUserSetting()
  base.outputRoutes.setOriginalComparison(true)
  return extendFixture(base, {} as const)
}

async function createNativeControlUrlContext11(t: TestContext) {
  const base =
    await createPerTabOriginalComparisonDoesNotOverwriteSavedRoutingSettings10Context10(t)
  const nativeControlUrl =
    'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/control/clip.m4s?signature=private'
  const nativeControlBackup =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/control/clip.m4s?signature=other'
  const controlItem = {
    id: 240,
    codecid: 13,
    height: 1080,
    bandwidth: 1_000_000,
    base_url: nativeControlUrl,
    backup_url: [nativeControlBackup],
  }
  base.outputAdapter.transform({ data: { dash: { video: [controlItem], audio: [] } } }, 'page-hint')
  await base.outputRestrictions.add({
    host: 'upos-sz-mirrorali.bilivideo.com',
    type: 'black',
    kind: 'all',
    reason: 'original-mode',
    expireAt: base.now + 60_000,
  })
  const blockedControlItem = {
    ...controlItem,
    base_url: nativeControlUrl,
    backup_url: [nativeControlBackup],
  }
  base.outputAdapter.transform(
    { data: { dash: { video: [blockedControlItem], audio: [] } } },
    'page-hint',
  )
  const promotedRep = base.outputVault.contextForUrl(nativeControlBackup)!.representation
  const promotedPlan = base.outputRoutes.snapshot().recentPlans
  return extendFixture(base, {
    nativeControlUrl,
    nativeControlBackup,
    controlItem,
    blockedControlItem,
    promotedRep,
    promotedPlan,
  } as const)
}

async function createHealthyCustomRateContext12(t: TestContext) {
  const base = await createClockContext5(t)
  const healthyCustomRate = { ...base.playerSnapshot, playbackRate: 1.5, effectiveRate: 1.5 }
  const healthyObservation: TransportObservation = {
    generation: generationId(1),
    epoch: epochId(1),
    decisionId: decisionId('aggregate'),
    representation: null,
    kind: 'video',
    routeType: 'catalog-generated',
    originalHost: 'a.example',
    targetHost: 'b.example',
    finalHost: 'b.example',
    status: 206,
    bytes: 100_000,
    ttfbMs: 20,
    elapsedMs: 100,
    completedAt: base.now,
    outcome: 'success',
    streamKey: 'aggregate',
  }
  const outputStorage = new FakeStorage(),
    outputSession = new SessionStore()
  const outputState = outputSession.beginGeneration(false),
    outputVault = new SignedRouteVault()
  outputVault.reset(outputState.generation, outputState.epoch)
  const outputSettings = base.scope.own(new CatalogSettingsStore(outputStorage, () => base.now))
  await outputSettings.update({ considerNativeSources: true })
  const outputRestrictions = base.scope.own(new RestrictionStore(outputStorage, () => base.now))
  const outputEvidence = base.scope.own(new EvidenceStore(outputStorage, () => base.now))
  const outputRoutes = new RouteCoordinator(
    base.clock,
    outputSession,
    outputSettings,
    outputRestrictions,
    outputEvidence,
    outputVault,
    createRuntimeIds(),
  )
  const outputAdapter = new PlayurlAdapter(
    new PlayurlController(outputSession, outputVault, outputRoutes),
  )
  const forbiddenUrl = 'https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/test/output/1.m4s?k=1'
  const outputItem = {
    id: 80,
    codecid: 13,
    height: 1080,
    bandwidth: 1_000_000,
    base_url: forbiddenUrl,
    backup_url: [forbiddenUrl],
  }
  outputAdapter.transform({ data: { dash: { video: [outputItem], audio: [] } } })
  const exceptionalForbidden = `${forbiddenUrl}&os=mcdn`
  const exceptionalItem = {
    ...outputItem,
    base_url: exceptionalForbidden,
    backup_url: [exceptionalForbidden],
  }
  outputAdapter.transform({ data: { dash: { video: [exceptionalItem], audio: [] } } })
  const opaquePrimary =
    'https://upos-hz-mirrorakam.akamaized.net/opaque/video-chunk?signature=private'
  const opaqueBackup =
    'https://upos-sz-mirrorali.bilivideo.com/opaque/video-chunk?signature=private'
  const opaqueItem = {
    id: 81,
    codecid: 13,
    height: 1080,
    bandwidth: 1_000_000,
    base_url: opaquePrimary,
    backup_url: [opaqueBackup],
  }
  outputAdapter.transform({ data: { dash: { video: [opaqueItem], audio: [] } } }, 'page-hint')
  void outputRoutes.apply(opaquePrimary)
  await outputRestrictions.add({
    host: 'upos-hz-mirrorakam.akamaized.net',
    type: 'black',
    kind: 'all',
    reason: 'opaque-output',
    expireAt: base.now + 60_000,
  })
  const opaqueRestricted = {
    ...opaqueItem,
    base_url: opaquePrimary,
    backup_url: [opaqueBackup],
  }
  outputAdapter.transform({ data: { dash: { video: [opaqueRestricted], audio: [] } } }, 'page-hint')
  await outputRestrictions.remove('upos-hz-mirrorakam.akamaized.net', 'black')
  const mixedItem = {
    id: 82,
    codecid: 13,
    height: 1080,
    bandwidth: 1_000_000,
    base_url:
      'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/test/mixed/82.m4s?signature=private',
    backup_url: ['https://upos-hz-mirrorakam.akamaized.net/opaque/mixed-82?signature=private'],
  }
  outputAdapter.transform({ data: { dash: { video: [mixedItem], audio: [] } } }, 'page-hint')
  const alternateOutput = outputItem.backup_url.find(
    (url) => new URL(url).host !== new URL(outputItem.base_url).host,
  )
  const fallbackApplied = outputRoutes.apply(alternateOutput ?? '')
  let coreClock = base.now,
    coreReloads = 0
  const coreRecorder = new DiagnosticRecorder(() => coreClock)
  const coreObserver = base.scope.own(
    new RecoveryController(
      currentResumePlayer({
        ...base.recoveryPlayer,
        reload: () => {
          coreReloads++
        },
      }),
      () => coreClock,
    ),
  )
  coreObserver.subscribe((event) => coreRecorder.record(event))
  coreObserver.tick({
    ...base.playerSnapshot,
    paused: false,
    readyState: 4,
    width: 1920,
    height: 1080,
  })
  const deadPaused = {
    ...base.playerSnapshot,
    paused: true,
    readyState: 0,
    width: 0,
    height: 0,
    frames: 0,
    coreInitialized: false,
  }
  for (let tick = 0; tick < 5; tick++) {
    coreClock += 1000
    coreObserver.tick(deadPaused)
  }
  coreClock += 31_000
  coreRecorder.tick()
  const frozenCore = coreRecorder.snapshot().incident
  coreRecorder.mark()
  for (let tick = 0; tick < 100; tick++) {
    coreClock += 1000
    coreObserver.tick(deadPaused)
  }
  const outputRep = outputVault.contextForUrl(outputItem.base_url)!.representation
  ;(
    outputRoutes.apply(outputItem.base_url) as AppliedRouteDecision & {
      playurlOutput?: {
        originalHost: string
        outputHost: string
        source: string
        decisionId: string
        role: string
      }
    }
  ).playurlOutput
  const alternateHost = new URL(alternateOutput!).host
  for (const type of ['black', 'dead'] as const) {
    await outputRestrictions.add({
      host: alternateHost,
      type,
      kind: 'all',
      reason: 'regression',
      expireAt: base.now + 60_000,
    })
    await outputSettings.update({ fixedHost: alternateHost })
    outputRoutes.invalidateForUserSetting()
    const item = { ...outputItem, base_url: forbiddenUrl, backup_url: [alternateOutput!] }
    outputAdapter.transform({ data: { dash: { video: [item], audio: [] } } })
    await outputRestrictions.remove(alternateHost, type)
  }
  await outputSettings.update({ fixedHost: null })
  outputRoutes.invalidateForUserSetting()
  outputRoutes.setOriginalComparison(true)
  const nativeControlUrl =
    'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/control/clip.m4s?signature=private'
  const nativeControlBackup =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/control/clip.m4s?signature=other'
  const controlItem = {
    id: 240,
    codecid: 13,
    height: 1080,
    bandwidth: 1_000_000,
    base_url: nativeControlUrl,
    backup_url: [nativeControlBackup],
  }
  outputAdapter.transform({ data: { dash: { video: [controlItem], audio: [] } } }, 'page-hint')
  await outputRestrictions.add({
    host: 'upos-sz-mirrorali.bilivideo.com',
    type: 'black',
    kind: 'all',
    reason: 'original-mode',
    expireAt: base.now + 60_000,
  })
  const blockedControlItem = {
    ...controlItem,
    base_url: nativeControlUrl,
    backup_url: [nativeControlBackup],
  }
  outputAdapter.transform(
    { data: { dash: { video: [blockedControlItem], audio: [] } } },
    'page-hint',
  )
  void outputVault.contextForUrl(nativeControlBackup)!.representation
  void outputRoutes.snapshot().recentPlans
  await outputRestrictions.remove('upos-sz-mirrorali.bilivideo.com', 'black')
  outputRoutes.setOriginalComparison(false)
  const ungroupedHost = TRUSTED_CATALOG[0]
  await outputRestrictions.add({
    host: ungroupedHost,
    type: 'black',
    kind: 'audio',
    reason: 'ungrouped-audio',
    expireAt: base.now + 60_000,
  })
  await outputRestrictions.remove(ungroupedHost, 'black')
  const audioScopedUrl = `https://${ungroupedHost}/upgcxcode/test/audio/1.m4s?k=1`
  outputVault.register({
    generation: outputState.generation,
    epoch: outputState.epoch,
    kind: 'audio',
    key: 'scope-audio',
    height: 0,
    codec: 'other',
    bandwidth: 128_000,
    urls: [audioScopedUrl],
    source: 'trusted-api',
  })
  await outputRestrictions.add({
    host: ungroupedHost,
    type: 'black',
    kind: 'all',
    reason: 'user',
    expireAt: base.now + 60_000,
  })
  await outputRestrictions.remove(ungroupedHost, 'black')
  for (const type of ['black', 'dead'] as const) {
    await outputRestrictions.add({
      host: ungroupedHost,
      type,
      kind: 'all',
      reason: 'exceptional',
      expireAt: base.now + 60_000,
    })
    await outputRestrictions.remove(ungroupedHost, type)
  }
  const unknownQuery = alternateOutput!.replace('k=1', 'k=unknown')
  return extendFixture(base, {
    healthyCustomRate,
    healthyObservation,
    outputStorage,
    outputSession,
    outputState,
    outputVault,
    outputSettings,
    outputRestrictions,
    outputEvidence,
    outputRoutes,
    outputAdapter,
    forbiddenUrl,
    outputItem,
    exceptionalForbidden,
    exceptionalItem,
    opaquePrimary,
    opaqueBackup,
    opaqueItem,
    opaqueRestricted,
    mixedItem,
    alternateOutput,
    fallbackApplied,
    get coreClock() {
      return coreClock
    },
    set coreClock(next: typeof coreClock) {
      coreClock = next
    },
    get coreReloads() {
      return coreReloads
    },
    set coreReloads(next: typeof coreReloads) {
      coreReloads = next
    },
    coreRecorder,
    coreObserver,
    deadPaused,
    frozenCore,
    outputRep,
    alternateHost,
    nativeControlUrl,
    nativeControlBackup,
    controlItem,
    blockedControlItem,
    ungroupedHost,
    audioScopedUrl,
    unknownQuery,
  } as const)
}

async function createInitialDeadLookingStartupWithoutPreviousHealthIsNotAnIncidentContext13(
  t: TestContext,
) {
  const base = await createHealthyCustomRateContext12(t)
  await base.outputEvidence.record(TRUSTED_CATALOG[0], 'video', {
    requestId: 'fresh-challenger',
    at: base.now,
    source: 'transport',
    outcome: 'success',
    throughputMbps: 10,
    ttfbMs: 1,
    failureKind: null,
  })
  const beforeGeneration = base.outputSession.get()
  await base.outputRoutes.observe({
    ...base.healthyObservation,
    generation: beforeGeneration.generation,
    epoch: beforeGeneration.epoch,
    representation: base.outputRep,
    originalHost: base.forbiddenUrl,
    targetHost: TRUSTED_CATALOG[2],
    finalHost: TRUSTED_CATALOG[2],
    completedAt: base.now,
    decisionId: base.fallbackApplied.decision.id,
  })
  await base.outputRoutes.observe({
    ...base.healthyObservation,
    generation: beforeGeneration.generation,
    epoch: beforeGeneration.epoch,
    representation: base.outputRep,
    targetHost: TRUSTED_CATALOG[2],
    finalHost: null,
    outcome: 'abort',
    status: 0,
    completedAt: base.now + 1,
  })
  await base.outputRoutes.observe({
    ...base.healthyObservation,
    generation: beforeGeneration.generation,
    epoch: beforeGeneration.epoch,
    representation: base.outputRep,
    targetHost: TRUSTED_CATALOG[3],
    finalHost: null,
    outcome: 'failure',
    failureKind: 'network',
    status: 0,
    completedAt: base.now + 2,
  })
  await base.outputSettings.update({
    catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map((host) => [host, false])),
  })
  base.outputRoutes.invalidateForUserSetting()
  const noOutput = {
    ...base.outputItem,
    base_url: base.forbiddenUrl,
    backup_url: [base.forbiddenUrl],
  }
  base.outputAdapter.transform({ data: { dash: { video: [noOutput], audio: [] } } })
  const gapRecorder = new DiagnosticRecorder(() => base.coreClock)
  const gapRecovery = base.scope.own(
    new RecoveryController(currentResumePlayer(base.recoveryPlayer), () => base.coreClock),
  )
  gapRecovery.subscribe((event) => gapRecorder.record(event))
  gapRecovery.tick(base.healthyCustomRate)
  for (let i = 0; i < 5; i++) {
    base.coreClock += 10_000
    gapRecovery.tick(base.deadPaused)
  }
  gapRecovery.reset()
  for (let i = 0; i < 5; i++) {
    base.coreClock += 1000
    gapRecovery.tick(base.deadPaused)
  }
  return extendFixture(base, { beforeGeneration, noOutput, gapRecorder, gapRecovery } as const)
}

async function createXHRDoesNotSendDefaultUnavailablePCDNMarkedMedia15Context14(t: TestContext) {
  const base = await createInitialDeadLookingStartupWithoutPreviousHealthIsNotAnIncidentContext13(t)
  await base.outputSettings.update({ catalogOverrides: {}, fixedHost: null })
  base.outputRoutes.invalidateForUserSetting()
  const realAdapter = base.scope.own(
    new TransportAdapter(
      base.outputSession,
      base.outputSettings,
      base.outputRoutes,
      base.outputAdapter,
      base.measurementStub,
      () => base.now,
      createRuntimeIds(),
    ),
  )
  realAdapter.install()
  const tracedXhr = new base.FakeXhr()
  tracedXhr.open('GET', base.outputItem.base_url)
  tracedXhr.send()
  await Promise.resolve()
  base.outputRoutes.snapshot().latest.video
  const actualXhr = new base.FakeXhr()
  actualXhr.open('GET', base.forbiddenUrl)
  const initiallySentHost = new URL(actualXhr.url).host
  await base.outputRestrictions.add({
    host: initiallySentHost,
    type: 'black',
    kind: 'all',
    reason: 'before-send',
    expireAt: base.now + 60_000,
  })
  actualXhr.send()
  await base.outputSettings.update({
    catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map((host) => [host, false])),
  })
  const blockedXhr = new base.FakeXhr()
  blockedXhr.open('GET', base.forbiddenUrl)
  blockedXhr.send()
  const exceptionalXhr = new base.FakeXhr()
  exceptionalXhr.open('GET', base.exceptionalForbidden)
  exceptionalXhr.send()
  return extendFixture(base, {
    realAdapter,
    tracedXhr,
    actualXhr,
    initiallySentHost,
    blockedXhr,
    exceptionalXhr,
  } as const)
}

async function createPlayObserverInstalledOnFirstPausedTickNotThirtySecondsLaterContext15(
  t: TestContext,
) {
  const base = await createXHRDoesNotSendDefaultUnavailablePCDNMarkedMedia15Context14(t)
  try {
    await base.fakeWindow.fetch(base.forbiddenUrl)
  } catch {
    true
  }
  try {
    await base.fakeWindow.fetch(base.exceptionalForbidden)
  } catch {
    true
  }
  await base.outputSettings.update({ disabled: true })
  const enabledAfterOpen = new base.FakeXhr()
  enabledAfterOpen.open('GET', base.forbiddenUrl)
  await base.outputSettings.update({ disabled: false })
  enabledAfterOpen.send()
  await base.outputSettings.update({ disabled: true })
  const disabledXhr = new base.FakeXhr()
  disabledXhr.open('GET', base.forbiddenUrl)
  disabledXhr.send()
  base.realAdapter.dispose()
  let intentClock = base.now,
    intentReloads = 0,
    activation = false
  let intentVideo = { ...base.healthyCustomRate }
  const intentTarget = { play: () => 'original-result' }
  return extendFixture(base, {
    enabledAfterOpen,
    disabledXhr,
    get intentClock() {
      return intentClock
    },
    set intentClock(next: typeof intentClock) {
      intentClock = next
    },
    get intentReloads() {
      return intentReloads
    },
    set intentReloads(next: typeof intentReloads) {
      intentReloads = next
    },
    get activation() {
      return activation
    },
    set activation(next: typeof activation) {
      activation = next
    },
    get intentVideo() {
      return intentVideo
    },
    set intentVideo(next: typeof intentVideo) {
      intentVideo = next
    },
    intentTarget,
  } as const)
}

async function checkBlacklistedNonGETFetchNeverReachesNativeFetch4(t: TestContext): Promise<void> {
  const base = await createBlacklistedNonGETFetchNeverReachesNativeFetch4Context4(t)

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
    'local block diagnostics retain the reason without a URL',
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
  const base = await createBlacklistedNonGETFetchNeverReachesNativeFetch4Context4(t)

  await base.fakeWindow.fetch(base.forbiddenNonGetUrl, { method: 'POST' }).then(
    () => {
      throw new Error('blacklisted POST Fetch must reject locally')
    },
    () => undefined,
  )
  const forbiddenXhr = new base.FakeXhr()
  forbiddenXhr.open('POST', base.forbiddenNonGetUrl)
  forbiddenXhr.send()
  const forbiddenRequest = new Request(base.forbiddenNonGetUrl, { method: 'POST' })
  await base.fakeWindow.fetch(forbiddenRequest).then(
    () => {
      throw new Error('blacklisted Request object must reject locally')
    },
    () => undefined,
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
  base.measurementStub.willGateStartup = () => false
  const converseRequest = new Request(base.passDecision.url ?? '')
  Object.defineProperty(converseRequest, 'href', { value: base.forbiddenNonGetUrl })
  await base.fakeWindow.fetch(converseRequest)
  const spoofedDns = new Request('https://httpdns.bilivideo.com/resolve')
  Object.defineProperty(spoofedDns, 'href', { value: base.passDecision.url })
  await base.fakeWindow.fetch(spoofedDns)
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
  const base = await createRewrittenRequestPreservesRequestHeaders3Context3(t)

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
  base.gateReady = false
  const gatedXhr = new base.FakeXhr()
  gatedXhr.open('GET', base.gatedUrl)
  gatedXhr.send()
  assert.strictEqual(gatedXhr.nativeSends, 0, 'async XHR send waits before native dispatch')
  base.gateControl.release()
  await base.gateControl.done
  assert.strictEqual(gatedXhr.nativeSends, 1, 'async XHR sends exactly once after preflight')
  assert.strictEqual(
    new URL(gatedXhr.url).host,
    TRUSTED_CATALOG[0],
    'XHR dispatch uses preflight winner',
  )
  base.gateReady = false
  const abortedXhr = new base.FakeXhr()
  abortedXhr.open('GET', base.gatedUrl)
  abortedXhr.send()
  abortedXhr.abort()
  base.gateControl.release()
  await base.gateControl.done
  assert.strictEqual(
    abortedXhr.nativeSends,
    0,
    'XHR abort during preflight never dispatches the website request',
  )
  const finiteTimeoutXhr = new base.FakeXhr()
  finiteTimeoutXhr.timeout = 5000
  finiteTimeoutXhr.open('GET', base.gatedUrl)
  finiteTimeoutXhr.send()
  assert.strictEqual(
    finiteTimeoutXhr.nativeSends,
    1,
    'explicit XHR timeout bypasses delay to preserve native timeout semantics',
  )
  assert.strictEqual(
    base.skippedPreflightReason,
    'preflight-skipped:xhr-explicit-timeout',
    'XHR timeout is labelled as skipped preflight, not skipped interception',
  )
}

async function checkDisabledModePassesSiteFetchThrough2(t: TestContext): Promise<void> {
  const base = await createMediaResponseContext2(t)

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
              catalogIndex: 0,
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
  const base = await createRuntimeSessionContext1(t)

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
    'diagnostic stages distinguish hook entry, media recognition, native invocation and response',
  )
  const mediaReader = mediaResponse.body?.getReader()
  assert.ok(mediaReader, 'fetch wrapper returns a readable body')
  await mediaReader?.read()
  await mediaReader?.cancel('caller-cancel')
  assert.strictEqual(
    base.cancelReason,
    'caller-cancel',
    'fetch cancel reason reaches original reader',
  )
  assert.strictEqual(base.observations.at(-1)?.outcome, 'abort', 'cancel settles as abort once')
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

async function checkTheReportedPlanNamesTheBackupActuallyOfferedToThePlayer(
  t: TestContext,
): Promise<void> {
  const base = await createNativeControlUrlContext11(t)

  assert.ok(
    base.promotedPlan.some(
      (row) =>
        row.host === new URL(base.nativeControlBackup).host &&
        row.action === 'pass' &&
        row.reason === 'original-backup',
    ),
    'the reported plan names the backup actually offered to the player, not the blocked primary',
  )
  assert.strictEqual(
    base.outputVault.outputRole(base.promotedRep, base.nativeControlBackup)?.decisionId,
    base.promotedPlan.find(
      (row) =>
        row.host === new URL(base.nativeControlBackup).host && row.reason === 'original-backup',
    )?.id,
    'promoted backup lineage points to its accurate route decision',
  )
  await base.outputRestrictions.remove('upos-sz-mirrorali.bilivideo.com', 'black')
  base.outputRoutes.setOriginalComparison(false)
  const ungroupedHost = TRUSTED_CATALOG[0]
  const ungroupedUrl = `https://${ungroupedHost}/upgcxcode/test/ungrouped/1.m4s?k=1`
  await base.outputRestrictions.add({
    host: ungroupedHost,
    type: 'black',
    kind: 'audio',
    reason: 'ungrouped-audio',
    expireAt: base.now + 60_000,
  })
  assert.ok(
    base.outputRoutes.apply(ungroupedUrl).decision.host !== ungroupedHost,
    'ungrouped media cannot use a host with an audio-only blacklist',
  )
  await base.outputRestrictions.remove(ungroupedHost, 'black')
  const audioScopedUrl = `https://${ungroupedHost}/upgcxcode/test/audio/1.m4s?k=1`
  const audioScopedRep = base.outputVault.register({
    generation: base.outputState.generation,
    epoch: base.outputState.epoch,
    kind: 'audio',
    key: 'scope-audio',
    height: 0,
    codec: 'other',
    bandwidth: 128_000,
    urls: [audioScopedUrl],
    source: 'trusted-api',
  })
  assert.ok(audioScopedRep, 'matched audio representation exists for blacklist coverage')
  await base.outputRestrictions.add({
    host: ungroupedHost,
    type: 'black',
    kind: 'all',
    reason: 'user',
    expireAt: base.now + 60_000,
  })
  assert.ok(
    base.outputRoutes.apply(audioScopedUrl).decision.host !== ungroupedHost,
    'user-wide blacklist excludes matched audio route',
  )
  assert.strictEqual(
    base.outputRoutes.apply(`${audioScopedUrl}&os=mcdn`).url,
    null,
    'user-wide blacklist locally blocks an exceptional audio route',
  )
}

async function checkParameterBlocksPCDNMarkedCatalogHost12ParameterParameter(
  t: TestContext,
  parameter = 0,
): Promise<void> {
  const base = await createNativeControlUrlContext11(t)

  await base.outputRestrictions.remove('upos-sz-mirrorali.bilivideo.com', 'black')
  base.outputRoutes.setOriginalComparison(false)
  const ungroupedHost = TRUSTED_CATALOG[0]
  const ungroupedUrl = `https://${ungroupedHost}/upgcxcode/test/ungrouped/1.m4s?k=1`
  await base.outputRestrictions.add({
    host: ungroupedHost,
    type: 'black',
    kind: 'audio',
    reason: 'ungrouped-audio',
    expireAt: base.now + 60_000,
  })
  await base.outputRestrictions.remove(ungroupedHost, 'black')
  const audioScopedUrl = `https://${ungroupedHost}/upgcxcode/test/audio/1.m4s?k=1`
  base.outputVault.register({
    generation: base.outputState.generation,
    epoch: base.outputState.epoch,
    kind: 'audio',
    key: 'scope-audio',
    height: 0,
    codec: 'other',
    bandwidth: 128_000,
    urls: [audioScopedUrl],
    source: 'trusted-api',
  })
  await base.outputRestrictions.add({
    host: ungroupedHost,
    type: 'black',
    kind: 'all',
    reason: 'user',
    expireAt: base.now + 60_000,
  })
  await base.outputRestrictions.remove(ungroupedHost, 'black')

  let iteration = 0
  for (const type of ['black', 'dead'] as const) {
    if (iteration++ === parameter) {
      await base.outputRestrictions.add({
        host: ungroupedHost,
        type,
        kind: 'all',
        reason: 'exceptional',
        expireAt: base.now + 60_000,
      })
      assert.strictEqual(
        base.outputRoutes.apply(`${ungroupedUrl}&os=mcdn`).url,
        null,
        `${type} blocks PCDN-marked Catalog host`,
      )
      await base.outputRestrictions.remove(ungroupedHost, type)

      return
    }
  }
  throw Error('Unknown fixture parameter')
}

async function checkPerTabOriginalComparisonDoesNotOverwriteSavedRoutingSettings10(
  t: TestContext,
): Promise<void> {
  const base =
    await createPerTabOriginalComparisonDoesNotOverwriteSavedRoutingSettings10Context10(t)

  assert.strictEqual(
    base.outputSettings.get().fixedHost,
    null,
    'per-tab original comparison does not overwrite saved routing settings',
  )
  const nativeControlUrl =
    'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/control/clip.m4s?signature=private'
  const nativeControlBackup =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/control/clip.m4s?signature=other'
  const controlItem = {
    id: 240,
    codecid: 13,
    height: 1080,
    bandwidth: 1_000_000,
    base_url: nativeControlUrl,
    backup_url: [nativeControlBackup],
  }
  base.outputAdapter.transform({ data: { dash: { video: [controlItem], audio: [] } } }, 'page-hint')
  assert.strictEqual(
    controlItem.base_url,
    nativeControlUrl,
    'original comparison mode does not rewrite a legal playurl primary',
  )
  assert.strictEqual(
    controlItem.backup_url[0],
    nativeControlBackup,
    'original comparison mode preserves the exact legal signed backup',
  )
  assert.strictEqual(
    base.outputRoutes.apply(nativeControlUrl).url,
    nativeControlUrl,
    'original comparison mode passes the exact segment URL',
  )
  assert.strictEqual(
    base.outputRoutes.startupOptions(nativeControlUrl),
    null,
    'original comparison mode does not launch cold preflight',
  )
  assert.strictEqual(
    base.outputRoutes.challenge(
      base.outputVault.contextForUrl(nativeControlUrl)!.representation,
      { kind: 'video', requiredMbps: 3, highDemand: false },
      false,
    ),
    null,
    'original comparison mode starts no healthy probe',
  )
  await base.outputRestrictions.add({
    host: 'upos-sz-mirrorali.bilivideo.com',
    type: 'black',
    kind: 'all',
    reason: 'original-mode',
    expireAt: base.now + 60_000,
  })
  assert.strictEqual(
    base.outputRoutes.apply(nativeControlUrl).url,
    null,
    'original comparison mode does not bypass a prohibited original host',
  )
  const blockedControlItem = {
    ...controlItem,
    base_url: nativeControlUrl,
    backup_url: [nativeControlBackup],
  }
  base.outputAdapter.transform(
    { data: { dash: { video: [blockedControlItem], audio: [] } } },
    'page-hint',
  )
  assert.strictEqual(
    blockedControlItem.base_url,
    nativeControlBackup,
    'original comparison promotes an exact legal signed backup when primary is forbidden',
  )
}

async function checkParameterInvalidatesCachedFallbackOnNextRequest9ParameterParameter(
  t: TestContext,
  parameter = 0,
): Promise<void> {
  const base =
    await createParameterInvalidatesCachedFallbackOnNextRequest9ParameterParameterContext9(t)

  let iteration = 0
  for (const type of ['black', 'dead'] as const) {
    if (iteration++ === parameter) {
      await base.outputRestrictions.add({
        host: base.alternateHost,
        type,
        kind: 'all',
        reason: 'regression',
        expireAt: base.now + 60_000,
      })
      assert.ok(
        base.outputRoutes.apply(base.alternateOutput!).decision.host !== base.alternateHost,
        `${type} invalidates cached fallback on next request`,
      )
      await base.outputSettings.update({ fixedHost: base.alternateHost })
      base.outputRoutes.invalidateForUserSetting()
      assert.ok(
        base.outputRoutes.apply(base.alternateOutput!).decision.host !== base.alternateHost,
        `fixed CDN cannot bypass ${type}`,
      )
      const item = {
        ...base.outputItem,
        base_url: base.forbiddenUrl,
        backup_url: [base.alternateOutput!],
      }
      base.outputAdapter.transform({ data: { dash: { video: [item], audio: [] } } })
      assert.ok(
        ![item.base_url, ...item.backup_url].some(
          (url) => url && new URL(url).host === base.alternateHost,
        ),
        `${type} filtered from all playurl outputs`,
      )
      await base.outputRestrictions.remove(base.alternateHost, type)

      return
    }
  }
  throw Error('Unknown fixture parameter')
}

async function checkPausedDeadCoreAutomaticallyCapturesAnIncident8(t: TestContext): Promise<void> {
  const base = await createPausedDeadCoreAutomaticallyCapturesAnIncident8Context8(t)

  assert.ok(
    base.coreRecorder.snapshot().incident,
    'paused dead core automatically captures an incident',
  )
  assert.strictEqual(base.coreReloads, 0, 'dead paused core without play intent never reloads')
  base.coreClock += 31_000
  base.coreRecorder.tick()
  const frozenCore = base.coreRecorder.snapshot().incident
  base.coreRecorder.mark()
  assert.strictEqual(
    base.coreRecorder.snapshot().incident?.id,
    frozenCore?.id,
    'late manual mark preserves frozen automatic incident',
  )
  for (let tick = 0; tick < 100; tick++) {
    base.coreClock += 1000
    base.coreObserver.tick(base.deadPaused)
  }
  assert.strictEqual(
    base.coreRecorder.snapshot().incident?.id,
    frozenCore?.id,
    'continuous dead core does not replace its own incident',
  )
  base.outputVault.contextForUrl(base.outputItem.base_url)!.representation
  const playurlLineage = (
    base.outputRoutes.apply(base.outputItem.base_url) as AppliedRouteDecision & {
      playurlOutput?: {
        originalHost: string
        outputHost: string
        source: string
        decisionId: string
        role: string
      }
    }
  ).playurlOutput
  assert.strictEqual(
    playurlLineage?.originalHost,
    'upos-sz-mirrorcosov.bilivideo.com',
    'playurl lineage retains the original host without retaining a signed URL',
  )
  assert.strictEqual(
    playurlLineage?.outputHost,
    new URL(base.outputItem.base_url).host,
    'playurl lineage names the host actually offered to the player',
  )
  assert.strictEqual(
    playurlLineage?.source,
    'trusted-api',
    'playurl lineage identifies trusted API output separately from page hints',
  )
  assert.ok(
    !!playurlLineage?.decisionId && playurlLineage.role === 'primary',
    'playurl output links its plan to a primary request',
  )
}

async function checkOpaqueSignedOutputRemainsObservationOnly7(t: TestContext): Promise<void> {
  const base = await createExceptionalForbiddenContext7(t)

  assert.strictEqual(
    base.opaqueLineage.attributionStatus,
    'weak',
    'opaque signed output remains observation-only',
  )
  assert.strictEqual(
    base.opaqueLineage.playurlOutput?.outputHost,
    new URL(base.opaquePrimary).host,
    'an exact opaque output still links playurl delivery to the later segment request by host',
  )
  await base.outputRestrictions.add({
    host: 'upos-hz-mirrorakam.akamaized.net',
    type: 'black',
    kind: 'all',
    reason: 'opaque-output',
    expireAt: base.now + 60_000,
  })
  const opaqueRestricted = {
    ...base.opaqueItem,
    base_url: base.opaquePrimary,
    backup_url: [base.opaqueBackup],
  }
  base.outputAdapter.transform(
    { data: { dash: { video: [opaqueRestricted], audio: [] } } },
    'page-hint',
  )
  assert.strictEqual(
    opaqueRestricted.base_url,
    base.opaqueBackup,
    'opaque signed fallback uses its own exact URL when source is forbidden',
  )
  await base.outputRestrictions.remove('upos-hz-mirrorakam.akamaized.net', 'black')
  const mixedItem = {
    id: 82,
    codecid: 13,
    height: 1080,
    bandwidth: 1_000_000,
    base_url:
      'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/test/mixed/82.m4s?signature=private',
    backup_url: ['https://upos-hz-mirrorakam.akamaized.net/opaque/mixed-82?signature=private'],
  }
  base.outputAdapter.transform({ data: { dash: { video: [mixedItem], audio: [] } } }, 'page-hint')
  assert.ok(
    mixedItem.backup_url.includes(
      'https://upos-hz-mirrorakam.akamaized.net/opaque/mixed-82?signature=private',
    ),
    'normal primary retains a legal exact opaque signed backup',
  )
  const alternateOutput = base.outputItem.backup_url.find(
    (url) => new URL(url).host !== new URL(base.outputItem.base_url).host,
  )
  assert.ok(alternateOutput, 'playurl includes a legal alternate backup')
  const fallbackApplied = base.outputRoutes.apply(alternateOutput ?? '')
  assert.strictEqual(
    fallbackApplied.url,
    alternateOutput,
    'player requested output backup is not pulled back to primary',
  )
  assert.strictEqual(
    fallbackApplied.decision.reason,
    'player-fallback',
    'player backup has explicit coordinated decision',
  )
  assert.strictEqual(
    base.outputRoutes.apply(base.outputItem.base_url).url,
    alternateOutput,
    'subsequent group requests retain adopted backup',
  )
}

async function checkForbiddenOriginalCannotRemainInPlayurlPrimaryOrBackup6(
  t: TestContext,
): Promise<void> {
  const base = await createHealthyObservationContext6(t)

  assert.ok(
    ![base.outputItem.base_url, ...base.outputItem.backup_url].some((url) =>
      url.includes('mirrorcosov'),
    ),
    'forbidden original cannot remain in playurl primary or backup',
  )
  const exceptionalForbidden = `${base.forbiddenUrl}&os=mcdn`
  assert.strictEqual(
    base.outputRoutes.apply(exceptionalForbidden).url,
    null,
    'default-unavailable source cannot pass through PCDN guard',
  )
  assert.strictEqual(
    base.outputRoutes.apply(base.forbiddenUrl.replace('/upgcxcode/', '/live-bvc/')).url,
    null,
    'default-unavailable live source is locally blocked without host replacement',
  )
  assert.strictEqual(
    base.outputRoutes.apply(base.forbiddenUrl.replace('/upgcxcode/', '/v1/resource/')).url,
    null,
    'default-unavailable resource source is locally blocked',
  )
  assert.strictEqual(
    base.outputRoutes.apply(
      'https://upos-sz-mirrorali.bilivideo.com/live-bvc/test/output/1.m4s?k=1',
    ).decision.action,
    'pass',
    'unrestricted live source remains untouched',
  )
  const exceptionalItem = {
    ...base.outputItem,
    base_url: exceptionalForbidden,
    backup_url: [exceptionalForbidden],
  }
  base.outputAdapter.transform({ data: { dash: { video: [exceptionalItem], audio: [] } } })
  assert.strictEqual(
    exceptionalItem.base_url,
    '',
    'playurl cannot emit a default-unavailable PCDN-marked primary',
  )
  assert.strictEqual(
    exceptionalItem.backup_url.length,
    0,
    'playurl cannot emit a default-unavailable PCDN-marked backup',
  )
  const opaquePrimary =
    'https://upos-hz-mirrorakam.akamaized.net/opaque/video-chunk?signature=private'
  const opaqueBackup =
    'https://upos-sz-mirrorali.bilivideo.com/opaque/video-chunk?signature=private'
  const opaqueItem = {
    id: 81,
    codecid: 13,
    height: 1080,
    bandwidth: 1_000_000,
    base_url: opaquePrimary,
    backup_url: [opaqueBackup],
  }
  base.outputAdapter.transform({ data: { dash: { video: [opaqueItem], audio: [] } } }, 'page-hint')
  assert.strictEqual(
    opaqueItem.base_url,
    opaquePrimary,
    'legal opaque signed primary is not emptied by playurl assembly',
  )
}

async function checkPlayObserverInstalledOnFirstPausedTickNotThirtySecondsLater(
  t: TestContext,
): Promise<void> {
  const base = await createPlayObserverInstalledOnFirstPausedTickNotThirtySecondsLaterContext15(t)

  const originalIntentPlay = base.intentTarget.play
  Object.defineProperty(base.fakeWindow, 'navigator', {
    configurable: true,
    value: {
      userActivation: {
        get isActive() {
          return base.activation
        },
      },
    },
  })
  class IntentAdapter extends PlayerAdapter {
    protected override player(): Record<string, unknown> {
      return base.intentTarget
    }
  }
  const intentAdapter = new IntentAdapter(
    { transform: () => playurlResult(false), lifecycleKey: () => 'test' },
    {
      scheduler: { timeout: () => () => undefined },
      isActuallyVisible: () => true,
      subscribeControlLoss: () => () => undefined,
    },
  )
  const intentRecovery = base.scope.own(
    new RecoveryController(
      currentResumePlayer({
        ...base.recoveryPlayer,
        observePlayIntent: (listener) => intentAdapter.observePlayIntent(listener),
        snapshot: () => base.intentVideo,
        reload: () => {
          base.intentReloads++
        },
        playbackRate: () => 1.5,
      }),
      () => base.intentClock,
    ),
  )
  intentRecovery.tick(base.intentVideo)
  base.intentVideo = { ...base.deadPaused }
  base.intentClock += 1000
  intentRecovery.tick(base.intentVideo)

  assert.ok(
    base.intentTarget.play !== originalIntentPlay,
    'play observer installed on first paused tick, not thirty seconds later',
  )
  base.intentClock += 31_000
  assert.strictEqual(
    base.intentTarget.play(),
    'original-result',
    'play observer preserves original return',
  )
  assert.strictEqual(intentRecovery.isRecovering(), false, 'untrusted play call never arms reload')
  base.activation = true
  base.intentTarget.play()
  assert.strictEqual(
    intentRecovery.isRecovering(),
    true,
    'trusted long-pause request arms intent while video stays paused',
  )
  for (let tick = 0; tick < 4; tick++) {
    base.intentClock += 1000
    intentRecovery.tick(base.intentVideo)
  }
  assert.strictEqual(base.intentReloads, 1, 'dead paused video with valid intent reloads once')
  base.intentClock += 1000
  intentRecovery.tick(base.intentVideo)
  assert.strictEqual(base.intentReloads, 1, 'repeated dead ticks cannot loop reload')
  intentRecovery.reset()
  assert.strictEqual(
    base.intentTarget.play,
    originalIntentPlay,
    'generation reset restores owned play method',
  )
  for (let i = 0; i < 1000; i++)
    base.coreRecorder.record({
      type: 'transport',
      at: base.coreClock,
      observation: { ...base.healthyObservation, completedAt: base.coreClock },
    })
  assert.strictEqual(
    base.coreRecorder.snapshot().incident?.id,
    base.frozenCore?.id,
    'one thousand successes retain frozen core incident',
  )
  assert.ok(
    new TextEncoder().encode(JSON.stringify(base.coreRecorder.snapshot())).length <= 128 * 1024,
    'recorder remains within 128 KiB',
  )
  assert.ok(
    new TextEncoder().encode(base.coreRecorder.buildReport({})).length <= 96 * 1024,
    'report remains within 96 KiB',
  )
  assert.ok(
    !base.coreRecorder.buildReport({}).includes('token=secret'),
    'incident report contains no test signed query',
  )
}

async function checkEligibleNativeBackupUsesItsOwnFullSignedURL17(t: TestContext): Promise<void> {
  const base = await createPlayObserverInstalledOnFirstPausedTickNotThirtySecondsLaterContext15(t)

  Object.defineProperty(base.fakeWindow, 'navigator', {
    configurable: true,
    value: {
      userActivation: {
        get isActive() {
          return base.activation
        },
      },
    },
  })
  class IntentAdapter extends PlayerAdapter {
    protected override player(): Record<string, unknown> {
      return base.intentTarget
    }
  }
  const intentAdapter = new IntentAdapter(
    { transform: () => playurlResult(false), lifecycleKey: () => 'test' },
    {
      scheduler: { timeout: () => () => undefined },
      isActuallyVisible: () => true,
      subscribeControlLoss: () => () => undefined,
    },
  )
  const intentRecovery = base.scope.own(
    new RecoveryController(
      currentResumePlayer({
        ...base.recoveryPlayer,
        observePlayIntent: (listener) => intentAdapter.observePlayIntent(listener),
        snapshot: () => base.intentVideo,
        reload: () => {
          base.intentReloads++
        },
        playbackRate: () => 1.5,
      }),
      () => base.intentClock,
    ),
  )
  intentRecovery.tick(base.intentVideo)
  base.intentVideo = { ...base.deadPaused }
  base.intentClock += 1000
  intentRecovery.tick(base.intentVideo)
  base.intentClock += 31_000
  base.activation = true
  base.intentTarget.play()
  for (let tick = 0; tick < 4; tick++) {
    base.intentClock += 1000
    intentRecovery.tick(base.intentVideo)
  }
  base.intentClock += 1000
  intentRecovery.tick(base.intentVideo)
  intentRecovery.reset()
  for (let i = 0; i < 1000; i++)
    base.coreRecorder.record({
      type: 'transport',
      at: base.coreClock,
      observation: { ...base.healthyObservation, completedAt: base.coreClock },
    })
  await base.outputSettings.update({
    disabled: false,
    catalogOverrides: {},
    fixedHost: null,
  })
  base.outputRoutes.invalidateForUserSetting()
  const nativeAudioUrl =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/test/output/audio.m4s?s=exact'
  const audioItem = {
    id: 30280,
    base_url: nativeAudioUrl,
    backup_url: [],
    bandwidth: 100_000,
  }
  base.outputAdapter.transform({ data: { dash: { video: [], audio: [audioItem] } } })
  const beforeAudioAffinity = base.outputSession.get().affinity
  const nativeAudioApplied = base.outputRoutes.apply(nativeAudioUrl)

  assert.strictEqual(
    nativeAudioApplied.url,
    nativeAudioUrl,
    'eligible Native backup uses its own full signed URL',
  )
  assert.strictEqual(
    nativeAudioApplied.decision.routeType,
    'root-original',
    'cold-start signed original remains unchanged before preflight',
  )
  assert.strictEqual(
    base.outputSession.get().affinity,
    beforeAudioAffinity,
    'audio backup request does not alter video affinity',
  )
  const audioRep = nativeAudioApplied.context!.representation
  base.outputVault.invalidate(audioRep, new URL(nativeAudioUrl).host)
  assert.ok(
    base.outputRoutes.apply(nativeAudioUrl).url !== nativeAudioUrl,
    'invalid Native cannot return through existing backup role',
  )
  const repeatAudio = {
    id: 30280,
    base_url: nativeAudioUrl,
    backup_url: [nativeAudioUrl],
    bandwidth: 100_000,
  }
  base.outputAdapter.transform({ data: { dash: { video: [], audio: [repeatAudio] } } })
  assert.ok(
    ![repeatAudio.base_url, ...repeatAudio.backup_url].includes(nativeAudioUrl),
    'invalid Native is removed from refreshed player outputs',
  )
  const nextGeneration = base.outputSession.beginGeneration(false)
  base.outputVault.reset(nextGeneration.generation, nextGeneration.epoch)
  base.outputRoutes.resetEpoch()
  assert.strictEqual(
    base.outputVault.outputRole(audioRep, nativeAudioUrl),
    null,
    'generation reset discards output roles',
  )
  assert.strictEqual(
    base.outputRoutes.latestVideoHost(),
    null,
    'generation reset drops old successful host',
  )
}

async function checkXHRDoesNotSendDefaultUnavailablePCDNMarkedMedia15(
  t: TestContext,
): Promise<void> {
  const base = await createXHRDoesNotSendDefaultUnavailablePCDNMarkedMedia15Context14(t)

  assert.strictEqual(
    base.exceptionalXhr.nativeSends,
    0,
    'XHR does not send default-unavailable PCDN-marked media',
  )
  const fetchCountBeforeBlock = base.nativeFetchCalls
  let fetchBlocked = false
  try {
    await base.fakeWindow.fetch(base.forbiddenUrl)
  } catch {
    fetchBlocked = true
  }
  assert.ok(fetchBlocked, 'no-alternative Fetch rejects locally')
  assert.strictEqual(
    base.nativeFetchCalls,
    fetchCountBeforeBlock,
    'blocked Fetch sends no native request',
  )
  let exceptionalFetchBlocked = false
  try {
    await base.fakeWindow.fetch(base.exceptionalForbidden)
  } catch {
    exceptionalFetchBlocked = true
  }
  assert.ok(exceptionalFetchBlocked, 'Fetch does not send default-unavailable PCDN-marked media')
  assert.strictEqual(
    base.nativeFetchCalls,
    fetchCountBeforeBlock,
    'exceptional Fetch does not reach native transport',
  )
  await base.outputSettings.update({ disabled: true })
  const enabledAfterOpen = new base.FakeXhr()
  enabledAfterOpen.open('GET', base.forbiddenUrl)
  await base.outputSettings.update({ disabled: false })
  enabledAfterOpen.send()
  assert.strictEqual(
    enabledAfterOpen.nativeSends,
    0,
    'XHR opened while disabled rechecks restriction when enabled before send',
  )
  await base.outputSettings.update({ disabled: true })
  const disabledXhr = new base.FakeXhr()
  disabledXhr.open('GET', base.forbiddenUrl)
  disabledXhr.send()
  assert.strictEqual(
    disabledXhr.url,
    base.forbiddenUrl,
    'disabled adapter preserves website original request',
  )
  assert.strictEqual(disabledXhr.nativeSends, 1, 'disabled adapter sends website request once')
}

async function checkInitialDeadLookingStartupWithoutPreviousHealthIsNotAnIncident(
  t: TestContext,
): Promise<void> {
  const base = await createInitialDeadLookingStartupWithoutPreviousHealthIsNotAnIncidentContext13(t)

  assert.strictEqual(
    base.gapRecorder.snapshot().incident,
    null,
    'initial dead-looking startup without previous health is not an incident',
  )
  await base.outputSettings.update({ catalogOverrides: {}, fixedHost: null })
  base.outputRoutes.invalidateForUserSetting()
  const realAdapter = base.scope.own(
    new TransportAdapter(
      base.outputSession,
      base.outputSettings,
      base.outputRoutes,
      base.outputAdapter,
      base.measurementStub,
      () => base.now,
      createRuntimeIds(),
    ),
  )
  realAdapter.install()
  const tracedXhr = new base.FakeXhr()
  tracedXhr.open('GET', base.outputItem.base_url)
  tracedXhr.send()
  await Promise.resolve()
  const tracedVideo = base.outputRoutes.snapshot().latest.video
  assert.strictEqual(
    tracedXhr.nativeSends,
    1,
    'playurl output is sent through the native XHR method exactly once',
  )
  assert.strictEqual(
    tracedVideo?.targetHost,
    new URL(tracedXhr.url).host,
    'route report target matches the URL received by native XHR',
  )
  assert.strictEqual(
    tracedVideo?.playurlOutput?.originalHost,
    'upos-sz-mirrorcosov.bilivideo.com',
    'the completed native request retains the original playurl host lineage',
  )
  const actualXhr = new base.FakeXhr()
  actualXhr.open('GET', base.forbiddenUrl)
  assert.ok(!actualXhr.url.includes('mirrorcosov'), 'native XHR open receives rewritten legal host')
  const initiallySentHost = new URL(actualXhr.url).host
  await base.outputRestrictions.add({
    host: initiallySentHost,
    type: 'black',
    kind: 'all',
    reason: 'before-send',
    expireAt: base.now + 60_000,
  })
  actualXhr.send()
  assert.strictEqual(actualXhr.nativeSends, 1, 'XHR sends one replacement request')
  assert.ok(
    new URL(actualXhr.url).host !== initiallySentHost,
    'restriction added after open is rechecked before native send',
  )
  await base.outputSettings.update({
    catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map((host) => [host, false])),
  })
  const blockedXhr = new base.FakeXhr()
  blockedXhr.open('GET', base.forbiddenUrl)
  blockedXhr.send()
  assert.strictEqual(
    blockedXhr.nativeSends,
    0,
    'no-alternative XHR never sends forbidden native request',
  )
}

async function checkWeakQueryMatchIsNotABackupCapability13(t: TestContext): Promise<void> {
  const base = await createHealthyCustomRateContext12(t)

  assert.ok(
    base.outputRoutes.apply(base.unknownQuery).decision.reason !== 'player-fallback',
    'weak query match is not a backup capability',
  )
  await base.outputEvidence.record(TRUSTED_CATALOG[0], 'video', {
    requestId: 'fresh-challenger',
    at: base.now,
    source: 'transport',
    outcome: 'success',
    throughputMbps: 10,
    ttfbMs: 1,
    failureKind: null,
  })
  assert.ok(
    base.outputRoutes.challenge(
      base.outputRep,
      { kind: 'video', requiredMbps: 3, highDemand: false },
      false,
    )?.decision.host !== TRUSTED_CATALOG[1],
    'challenger never selects default unavailable cosov',
  )
  const beforeGeneration = base.outputSession.get()
  await base.outputRoutes.observe({
    ...base.healthyObservation,
    generation: beforeGeneration.generation,
    epoch: beforeGeneration.epoch,
    representation: base.outputRep,
    originalHost: base.forbiddenUrl,
    targetHost: TRUSTED_CATALOG[2],
    finalHost: TRUSTED_CATALOG[2],
    completedAt: base.now,
    decisionId: base.fallbackApplied.decision.id,
  })
  await base.outputRoutes.observe({
    ...base.healthyObservation,
    generation: beforeGeneration.generation,
    epoch: beforeGeneration.epoch,
    representation: base.outputRep,
    targetHost: TRUSTED_CATALOG[2],
    finalHost: null,
    outcome: 'abort',
    status: 0,
    completedAt: base.now + 1,
  })
  assert.strictEqual(
    base.outputRoutes.latestVideoHost(),
    TRUSTED_CATALOG[2],
    'latest abort does not erase last successful video host',
  )
  await base.outputRoutes.observe({
    ...base.healthyObservation,
    generation: beforeGeneration.generation,
    epoch: beforeGeneration.epoch,
    representation: base.outputRep,
    targetHost: TRUSTED_CATALOG[3],
    finalHost: null,
    outcome: 'failure',
    failureKind: 'network',
    status: 0,
    completedAt: base.now + 2,
  })
  assert.ok(
    base.outputEvidence.get(TRUSTED_CATALOG[3], 'video')?.circuitUntil! > base.now,
    'no-response network failure still attributed to sent target',
  )
  await base.outputSettings.update({
    catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map((host) => [host, false])),
  })
  base.outputRoutes.invalidateForUserSetting()
  assert.strictEqual(
    base.outputRoutes.apply(base.forbiddenUrl).url,
    null,
    'no legal alternative blocks forbidden source',
  )
  const noOutput = {
    ...base.outputItem,
    base_url: base.forbiddenUrl,
    backup_url: [base.forbiddenUrl],
  }
  base.outputAdapter.transform({ data: { dash: { video: [noOutput], audio: [] } } })
  assert.strictEqual(noOutput.base_url, '', 'blocked playurl does not leak original primary')
  assert.strictEqual(noOutput.backup_url.length, 0, 'blocked playurl does not leak original backup')
  const gapRecorder = new DiagnosticRecorder(() => base.coreClock)
  const gapRecovery = base.scope.own(
    new RecoveryController(currentResumePlayer(base.recoveryPlayer), () => base.coreClock),
  )
  gapRecovery.subscribe((event) => gapRecorder.record(event))
  gapRecovery.tick(base.healthyCustomRate)
  for (let i = 0; i < 5; i++) {
    base.coreClock += 10_000
    gapRecovery.tick(base.deadPaused)
  }
  assert.strictEqual(
    gapRecorder.snapshot().incident,
    null,
    'background timer gaps do not count as continuous dead-core ticks',
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
test(
  'forbidden original cannot remain in playurl primary or backup [6]',
  { timeout: 5000 },
  async (t) => {
    await checkForbiddenOriginalCannotRemainInPlayurlPrimaryOrBackup6(t)
  },
)
test('opaque signed output remains observation-only [7]', { timeout: 5000 }, async (t) => {
  await checkOpaqueSignedOutputRemainsObservationOnly7(t)
})
test('paused dead core automatically captures an incident [8]', { timeout: 5000 }, async (t) => {
  await checkPausedDeadCoreAutomaticallyCapturesAnIncident8(t)
})
{
  let parameter = 0
  for (const type of ['black', 'dead'] as const) {
    const selected = parameter++
    test(
      '`${type} invalidates cached fallback on next request` [9]' +
        ` / ${String(type)} / ${selected}`,
      { timeout: 5000 },
      async (t) => {
        await checkParameterInvalidatesCachedFallbackOnNextRequest9ParameterParameter(t, selected)
      },
    )
  }
}
test(
  'per-tab original comparison does not overwrite saved routing settings [10]',
  { timeout: 5000 },
  async (t) => {
    await checkPerTabOriginalComparisonDoesNotOverwriteSavedRoutingSettings10(t)
  },
)
test(
  'the reported plan names the backup actually offered to the player, not the blocked primary [11]',
  { timeout: 5000 },
  async (t) => {
    await checkTheReportedPlanNamesTheBackupActuallyOfferedToThePlayer(t)
  },
)
{
  let parameter = 0
  for (const type of ['black', 'dead'] as const) {
    const selected = parameter++
    test(
      '`${type} blocks PCDN-marked Catalog host` [12]' + ` / ${String(type)} / ${selected}`,
      { timeout: 5000 },
      async (t) => {
        await checkParameterBlocksPCDNMarkedCatalogHost12ParameterParameter(t, selected)
      },
    )
  }
}
test('weak query match is not a backup capability [13]', { timeout: 5000 }, async (t) => {
  await checkWeakQueryMatchIsNotABackupCapability13(t)
})
test(
  'initial dead-looking startup without previous health is not an incident [14]',
  { timeout: 5000 },
  async (t) => {
    await checkInitialDeadLookingStartupWithoutPreviousHealthIsNotAnIncident(t)
  },
)
test(
  'XHR does not send default-unavailable PCDN-marked media [15]',
  { timeout: 5000 },
  async (t) => {
    await checkXHRDoesNotSendDefaultUnavailablePCDNMarkedMedia15(t)
  },
)
test(
  'play observer installed on first paused tick, not thirty seconds later [16]',
  { timeout: 5000 },
  async (t) => {
    await checkPlayObserverInstalledOnFirstPausedTickNotThirtySecondsLater(t)
  },
)
test('eligible Native backup uses its own full signed URL [17]', { timeout: 5000 }, async (t) => {
  await checkEligibleNativeBackupUsesItsOwnFullSignedURL17(t)
})
import { idleControls } from '../support/player.ts'
import '../regressions/functional-races/br01-player.ts'
import '../regressions/functional-races/rescue-goals.ts'
import '../regressions/functional-races/br08-player.ts'
import '../regressions/functional-races/br01-reload-controls.ts'
import '../regressions/functional-races/br01-play-intent.ts'
import '../regressions/player-restore-ownership.ts'
import '../regressions/player-restore-readback.ts'
