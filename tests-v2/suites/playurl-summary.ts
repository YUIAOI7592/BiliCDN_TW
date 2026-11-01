import { requestDispatch } from '../support/request-dispatch.ts'
import { installProgressEvent } from '../support/progress-event.ts'
import '../regressions/up141-api.ts'
import { createRuntimeIds } from '../../src-v2/platform/runtime-ids.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { TransportAdapter } from '../../src-v2/adapters/transport.ts'
import type { StartupGate } from '../../src-v2/adapters/transport-ports.ts'
import type { TransportRoutes } from '../../src-v2/adapters/transport-ports.ts'
import type { TransportSettings } from '../../src-v2/adapters/transport-ports.ts'
import type { PlayurlPort } from '../../src-v2/application/ports.ts'
import type { PlayurlTransformResult } from '../../src-v2/domain/playurl-model.ts'
import { SessionStore } from '../../src-v2/state/session-store.ts'
import { testScope } from '../support/scope.ts'

// Named scenarios create only their prerequisite state; resources belong to this test.

function createPlaybackResourcesBlock1() {
  let strict = true
  let disabled = false
  let status = 200
  let body = '{"code":0}'
  let throws = false
  let calls = 0
  let responseOverride: Response | null = null
  let now = 2_000_000_000_000
  const secret = 'https://example.invalid/private/video.m4s?token=summary-secret'
  const accepted = {
    accepted: true,
    formats: ['dash', 'mp4', 'flv'],
    videoCount: 3,
    audioCount: 2,
    segmentCount: 4,
    upstreamCode: 0,
    reason: null,
  } satisfies PlayurlTransformResult
  let result: PlayurlTransformResult = accepted
  const playurl = {
    transform() {
      calls++
      if (throws) throw Error(secret)
      return result
    },
  } satisfies PlayurlPort
  const routes = {
    prepareRequest: requestDispatch(),
    policyRevision: () => 0,
    isCatalogOnly: () => strict,
    isBilibiliMedia: () => false,
    recognizesMedia: () => false,
    apply(): never {
      throw Error('Unexpected media application')
    },
    inspectOriginal(): never {
      throw Error('Unexpected media inspection')
    },
    requestStarted() {},
    async observe() {},
  } satisfies TransportRoutes
  const settings = {
    get: () => ({ disabled: disabled, blockHttpDns: false }),
  } satisfies TransportSettings
  const measurement = {
    willGateStartup: () => false,
    async prepareStartup() {},
    noteUnpreflighted() {},
  } satisfies StartupGate
  class FakeXhr extends EventTarget {
    #state = 0
    get readyState() {
      return this.#state
    }
    set readyState(value: number) {
      this.#state = value
    }
    status = 200
    responseURL = ''
    responseType: XMLHttpRequestResponseType = ''
    timeout = 0
    withCredentials = false
    payload: unknown = { code: 0 }
    rawText: string | null = null
    get response(): unknown {
      return this.responseType === 'json' ? this.payload : this.responseText
    }
    get responseText(): string {
      return this.rawText ?? JSON.stringify(this.payload)
    }
    open(_method: string, url: string | URL): void {
      this.responseURL = String(url)
      this.readyState = 1
    }
    send(): void {
      this.readyState = 4
      this.dispatchEvent(new Event('readystatechange'))
      this.dispatchEvent(new Event('load'))
      this.dispatchEvent(new Event('loadend'))
    }
    abort(): void {
      this.dispatchEvent(new Event('abort'))
    }
    setRequestHeader(): void {}
  }
  const nativeFetch: typeof fetch = async () =>
    responseOverride ?? new Response(body, { status: status })
  const windowFixture = { fetch: nativeFetch, XMLHttpRequest: FakeXhr }
  return {
    get strict(): boolean {
      return strict
    },
    set strict(value: boolean) {
      strict = value
    },
    get disabled(): boolean {
      return disabled
    },
    set disabled(value: boolean) {
      disabled = value
    },
    get body() {
      return body
    },
    set body(value: typeof body) {
      body = value
    },
    get throws() {
      return throws
    },
    set throws(value: typeof throws) {
      throws = value
    },
    get calls() {
      return calls
    },
    set calls(value: typeof calls) {
      calls = value
    },
    get responseOverride() {
      return responseOverride
    },
    set responseOverride(value: typeof responseOverride) {
      responseOverride = value
    },
    get now() {
      return now
    },
    set now(value: typeof now) {
      now = value
    },
    secret,
    accepted,
    get result() {
      return result
    },
    set result(value: typeof result) {
      result = value
    },
    playurl,
    routes,
    settings,
    measurement,
    windowFixture,
  }
}

async function createPlayurlSummaryScenario(t: TestContext) {
  const scope = testScope(t)
  installProgressEvent(scope)
  const session = new SessionStore()
  session.beginGeneration(false)
  const block1 = createPlaybackResourcesBlock1()
  const { windowFixture, settings, routes, playurl, measurement } = block1
  scope.defineGlobal('unsafeWindow', { configurable: true, value: windowFixture })
  scope.defineGlobal('location', {
    configurable: true,
    value: new URL('https://www.bilibili.com/'),
  })
  const transport = scope.own(
    new TransportAdapter(
      session,
      settings,
      routes,
      playurl,
      measurement,
      () => block1.now,
      createRuntimeIds(),
    ),
  )
  transport.install()
  const endpoint = 'https://api.bilibili.com/x/player/wbi/playurl?token=summary-secret'
  return {
    endpoint,
    transport,
    windowFixture,
  }
}

async function createARejectedResultObjectCannotTruthilyPassStrictFetch2Context1(t: TestContext) {
  const scope = testScope(t)
  installProgressEvent(scope)
  const session = new SessionStore()
  session.beginGeneration(false)
  const block1 = createPlaybackResourcesBlock1()
  const { windowFixture, settings, routes, playurl, measurement } = block1
  scope.defineGlobal('unsafeWindow', { configurable: true, value: windowFixture })
  scope.defineGlobal('location', {
    configurable: true,
    value: new URL('https://www.bilibili.com/'),
  })
  const transport = scope.own(
    new TransportAdapter(
      session,
      settings,
      routes,
      playurl,
      measurement,
      () => block1.now,
      createRuntimeIds(),
    ),
  )
  transport.install()
  const endpoint = 'https://api.bilibili.com/x/player/wbi/playurl?token=summary-secret'
  void (await windowFixture.fetch(endpoint)).status
  const first = transport.snapshot().lastPlayurl
  void first?.formats.join(',')
  block1.result = {
    accepted: false,
    formats: ['mp4'],
    videoCount: 0,
    audioCount: 0,
    segmentCount: 2,
    upstreamCode: -10403,
    reason: 'upstream-error',
  }
  const rejected = await windowFixture.fetch(endpoint)
  return {
    rejected,
    transport,
  }
}

async function createRejectedBodyContext2(t: TestContext) {
  const scope = testScope(t)
  installProgressEvent(scope)
  const session = new SessionStore()
  session.beginGeneration(false)
  const block1 = createPlaybackResourcesBlock1()
  const { windowFixture, settings, routes, playurl, measurement, secret } = block1
  scope.defineGlobal('unsafeWindow', { configurable: true, value: windowFixture })
  scope.defineGlobal('location', {
    configurable: true,
    value: new URL('https://www.bilibili.com/'),
  })
  const transport = scope.own(
    new TransportAdapter(
      session,
      settings,
      routes,
      playurl,
      measurement,
      () => block1.now,
      createRuntimeIds(),
    ),
  )
  transport.install()
  const endpoint = 'https://api.bilibili.com/x/player/wbi/playurl?token=summary-secret'
  void (await windowFixture.fetch(endpoint)).status
  const first = transport.snapshot().lastPlayurl
  void first?.formats.join(',')
  block1.result = {
    accepted: false,
    formats: ['mp4'],
    videoCount: 0,
    audioCount: 0,
    segmentCount: 2,
    upstreamCode: -10403,
    reason: 'upstream-error',
  }
  const makeXhr = (type: XMLHttpRequestResponseType, value: unknown = { code: 0 }) => {
    const xhr = new windowFixture.XMLHttpRequest()
    xhr.responseType = type
    xhr.payload = value
    xhr.open('GET', endpoint)
    xhr.send()
    return xhr
  }
  return {
    get calls() {
      return block1.calls
    },
    set calls(value: typeof block1.calls) {
      block1.calls = value
    },
    makeXhr,
    secret,
    transport,
  }
}

async function createXHRResponseTextAcceptsATypedAcceptedResult4Context3(t: TestContext) {
  const scope = testScope(t)
  installProgressEvent(scope)
  const session = new SessionStore()
  session.beginGeneration(false)
  const block1 = createPlaybackResourcesBlock1()
  const { windowFixture, settings, routes, playurl, measurement, accepted, secret } = block1
  scope.defineGlobal('unsafeWindow', { configurable: true, value: windowFixture })
  scope.defineGlobal('location', {
    configurable: true,
    value: new URL('https://www.bilibili.com/'),
  })
  const transport = scope.own(
    new TransportAdapter(
      session,
      settings,
      routes,
      playurl,
      measurement,
      () => block1.now,
      createRuntimeIds(),
    ),
  )
  transport.install()
  const endpoint = 'https://api.bilibili.com/x/player/wbi/playurl?token=summary-secret'
  void transport.snapshot().lastPlayurl
  const makeXhr = (type: XMLHttpRequestResponseType, value: unknown = { code: 0 }) => {
    const xhr = new windowFixture.XMLHttpRequest()
    xhr.responseType = type
    xhr.payload = value
    xhr.open('GET', endpoint)
    xhr.send()
    return xhr
  }
  const acceptedXhr = makeXhr('text')
  return {
    accepted,
    acceptedXhr,
    get body() {
      return block1.body
    },
    set body(value: typeof block1.body) {
      block1.body = value
    },
    endpoint,
    makeXhr,
    get result() {
      return block1.result
    },
    set result(value: typeof block1.result) {
      block1.result = value
    },
    secret,
    get strict(): boolean {
      return block1.strict
    },
    set strict(value: boolean) {
      block1.strict = value
    },
    get throws() {
      return block1.throws
    },
    set throws(value: typeof block1.throws) {
      block1.throws = value
    },
    transport,
    windowFixture,
  }
}

async function createNativeEnabledXHRPreservesRejectedUpstreamPayload5Context4(t: TestContext) {
  const scope = testScope(t)
  installProgressEvent(scope)
  const session = new SessionStore()
  session.beginGeneration(false)
  const block1 = createPlaybackResourcesBlock1()
  const { windowFixture, settings, routes, playurl, measurement, secret, accepted } = block1
  scope.defineGlobal('unsafeWindow', { configurable: true, value: windowFixture })
  scope.defineGlobal('location', {
    configurable: true,
    value: new URL('https://www.bilibili.com/'),
  })
  const transport = scope.own(
    new TransportAdapter(
      session,
      settings,
      routes,
      playurl,
      measurement,
      () => block1.now,
      createRuntimeIds(),
    ),
  )
  transport.install()
  const endpoint = 'https://api.bilibili.com/x/player/wbi/playurl?token=summary-secret'
  void transport.snapshot().lastPlayurl
  const makeXhr = (type: XMLHttpRequestResponseType, value: unknown = { code: 0 }) => {
    const xhr = new windowFixture.XMLHttpRequest()
    xhr.responseType = type
    xhr.payload = value
    xhr.open('GET', endpoint)
    xhr.send()
    return xhr
  }
  block1.body = '{malformed:' + secret
  void (await windowFixture.fetch(endpoint)).status
  const malformedXhr = makeXhr('text')
  malformedXhr.rawText = block1.body
  block1.body = '{"code":0}'
  block1.throws = true
  await windowFixture.fetch(endpoint)
  block1.throws = false
  block1.strict = false
  block1.result = { ...accepted, accepted: false, reason: 'no-legal-route' }
  block1.body = JSON.stringify({ code: 0, data: { url: secret } })
  void (await (await windowFixture.fetch(endpoint)).text())
  const nativeXhr = makeXhr('json', { code: 0, data: { url: secret } })
  return {
    accepted,
    get calls() {
      return block1.calls
    },
    set calls(value: typeof block1.calls) {
      block1.calls = value
    },
    endpoint,
    makeXhr,
    nativeXhr,
    get responseOverride() {
      return block1.responseOverride
    },
    set responseOverride(value: typeof block1.responseOverride) {
      block1.responseOverride = value
    },
    get result() {
      return block1.result
    },
    set result(value: typeof block1.result) {
      block1.result = value
    },
    secret,
    session,
    get strict(): boolean {
      return block1.strict
    },
    set strict(value: boolean) {
      block1.strict = value
    },
    transport,
    windowFixture,
  }
}

function createSummaryTransportResources(t: TestContext) {
  const scope = testScope(t)
  installProgressEvent(scope)
  const session = new SessionStore()
  session.beginGeneration(false)
  const block1 = createPlaybackResourcesBlock1()
  const { windowFixture, settings, routes, playurl, measurement, secret, accepted } = block1
  scope.defineGlobal('unsafeWindow', { configurable: true, value: windowFixture })
  scope.defineGlobal('location', {
    configurable: true,
    value: new URL('https://www.bilibili.com/'),
  })
  const transport = scope.own(
    new TransportAdapter(
      session,
      settings,
      routes,
      playurl,
      measurement,
      () => block1.now,
      createRuntimeIds(),
    ),
  )
  transport.install()
  const endpoint = 'https://api.bilibili.com/x/player/wbi/playurl?token=summary-secret'
  return { block1, transport, endpoint, accepted, secret, windowFixture }
}

async function createNonFinitePlayurlSummaryCountsContext5(t: TestContext) {
  const { block1, transport, endpoint, accepted, secret, windowFixture } =
    createSummaryTransportResources(t)
  block1.result = {
    ...accepted,
    videoCount: Infinity,
    audioCount: -1,
    segmentCount: 1_000_000,
    upstreamCode: Infinity,
    formats: ['dash', 'dash', 'mp4', 'flv', 'mp4'],
  }
  await windowFixture.fetch(endpoint)
  return {
    accepted,
    endpoint,
    get now() {
      return block1.now
    },
    set now(value: typeof block1.now) {
      block1.now = value
    },
    get result() {
      return block1.result
    },
    set result(value: typeof block1.result) {
      block1.result = value
    },
    secret,
    transport,
    windowFixture,
  }
}

async function checkNonFinitePlayurlSummaryCountsAreNormalized6(t: TestContext): Promise<void> {
  const base = await createNonFinitePlayurlSummaryCountsContext5(t)

  assert.strictEqual(
    base.transport.snapshot().lastPlayurl?.videoCount,
    0,
    'non-finite playurl summary counts are normalized',
  )
  assert.strictEqual(
    base.transport.snapshot().lastPlayurl?.audioCount,
    0,
    'negative playurl summary counts are normalized',
  )
  assert.strictEqual(
    base.transport.snapshot().lastPlayurl?.segmentCount,
    65_535,
    'playurl summary counts have a finite upper bound',
  )
  assert.strictEqual(
    base.transport.snapshot().lastPlayurl?.upstreamCode,
    null,
    'non-finite upstream code is omitted',
  )
  assert.strictEqual(
    base.transport.snapshot().lastPlayurl?.formats.join(','),
    'dash,mp4,flv',
    'playurl summary formats have a bounded unique set',
  )
  const augmented = {
    ...base.accepted,
    url: base.secret,
    token: 'summary-secret',
    payload: { raw: base.secret },
  }
  base.result = augmented
  base.now++
  await base.windowFixture.fetch(base.endpoint)
  const safe = base.transport.snapshot().lastPlayurl
  assert.strictEqual(safe?.observedAt, base.now, 'recent summary reflects observation time')
  assert.ok(
    !JSON.stringify(base.transport.snapshot()).includes('summary-secret'),
    'summary copies only safe fields from result',
  )
}

async function checkDisabledTransportPreservesTheRecentPlayurlSummary7(
  t: TestContext,
): Promise<void> {
  const base = createSummaryTransportResources(t)
  await base.windowFixture.fetch(base.endpoint)
  base.block1.disabled = true
  const previous = base.transport.snapshot().lastPlayurl
  assert.ok(previous, 'disabled preservation starts with a completed summary')
  await base.windowFixture.fetch(base.endpoint)
  assert.strictEqual(
    base.transport.snapshot().lastPlayurl,
    previous,
    'fully disabled pass-through does not transform or replace summary',
  )
}

async function checkNativeEnabledXHRPreservesRejectedUpstreamPayload5(
  t: TestContext,
): Promise<void> {
  const base = await createNativeEnabledXHRPreservesRejectedUpstreamPayload5Context4(t)

  assert.ok(
    JSON.stringify(base.nativeXhr.response).includes('summary-secret'),
    'Native-enabled XHR preserves rejected upstream payload',
  )
  assert.ok(
    base.transport.snapshot().lastPlayurl?.accepted === false,
    'pass-through rejection remains visible as unaccepted',
  )
  base.strict = true
  const stale = base.makeXhr('text', { data: { url: base.secret } })
  base.session.beginGeneration(false)
  assert.ok(!stale.responseText.includes('summary-secret'), 'old-generation XHR remains blocked')
  assert.strictEqual(
    base.transport.snapshot().lastPlayurl?.reason,
    'inactive',
    'stale response summary does not claim acceptance',
  )
  let releaseBody = (): void => {}
  base.responseOverride = new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        releaseBody = () => {
          controller.enqueue(new TextEncoder().encode('{"code":0}'))
          controller.close()
        }
      },
    }),
    { status: 201 },
  )
  base.result = base.accepted
  const pending = base.windowFixture.fetch(base.endpoint),
    beforeStale = base.calls
  base.session.beginGeneration(false)
  releaseBody()
  assert.strictEqual(
    (await pending).status,
    503,
    'late Fetch playurl response cannot use old generation acceptance',
  )
  assert.strictEqual(base.calls, beforeStale, 'old-generation Fetch response is not transformed')
  assert.strictEqual(
    base.transport.snapshot().lastPlayurl?.reason,
    'inactive',
    'late Fetch summary reports lifecycle rejection',
  )
  assert.strictEqual(
    base.transport.snapshot().lastPlayurl?.status,
    201,
    'late Fetch summary keeps upstream status distinct',
  )
}

async function checkXHRResponseTextAcceptsATypedAcceptedResult4(t: TestContext): Promise<void> {
  const base = await createXHRResponseTextAcceptsATypedAcceptedResult4Context3(t)

  assert.strictEqual(
    base.acceptedXhr.response,
    '{"code":0}',
    'XHR response text accepts a typed accepted result',
  )
  assert.strictEqual(
    base.transport.snapshot().lastPlayurl?.segmentCount,
    4,
    'XHR accepted result includes segment count',
  )
  const jsonXhr = base.makeXhr('json')
  void jsonXhr.response
  assert.ok(
    base.transport.snapshot().lastPlayurl?.accepted,
    'XHR JSON accepts a typed accepted result',
  )
  base.body = '{malformed:' + base.secret
  assert.strictEqual(
    (await base.windowFixture.fetch(base.endpoint)).status,
    503,
    'strict Fetch still blocks malformed JSON',
  )
  assert.strictEqual(
    base.transport.snapshot().lastPlayurl?.reason,
    'malformed-payload',
    'malformed Fetch JSON receives a safe reason',
  )
  const malformedXhr = base.makeXhr('text')
  malformedXhr.rawText = base.body
  void malformedXhr.responseText
  assert.strictEqual(
    base.transport.snapshot().lastPlayurl?.reason,
    'malformed-payload',
    'malformed XHR JSON receives a safe reason',
  )
  base.body = '{"code":0}'
  base.throws = true
  await base.windowFixture.fetch(base.endpoint)
  assert.strictEqual(
    base.transport.snapshot().lastPlayurl?.reason,
    'malformed-payload',
    'transform exceptions receive no raw error message',
  )
  base.throws = false
  base.strict = false
  base.result = { ...base.accepted, accepted: false, reason: 'no-legal-route' }
  base.body = JSON.stringify({ code: 0, data: { url: base.secret } })
  assert.strictEqual(
    await (await base.windowFixture.fetch(base.endpoint)).text(),
    base.body,
    'Native-enabled Fetch preserves rejected upstream payload',
  )
}

async function checkStrictXHRParameterRejectsAnUnacceptedTypedResult3ParameterParameter(
  t: TestContext,
  parameter = 0,
): Promise<void> {
  const base = await createRejectedBodyContext2(t)

  let iteration = 0
  for (const type of ['text', 'json'] as const) {
    if (iteration++ === parameter) {
      const xhr = base.makeXhr(type, { code: 0, data: { url: base.secret } })
      const output = type === 'json' ? JSON.stringify(xhr.response) : xhr.responseText
      assert.ok(
        !output.includes('summary-secret'),
        `strict XHR ${type} rejects an unaccepted typed result`,
      )
      assert.strictEqual(xhr.status, 200, `strict XHR ${type} retains native HTTP status`)
      assert.strictEqual(
        base.transport.snapshot().lastPlayurl?.transport,
        'xhr',
        `XHR ${type} updates summary`,
      )
      assert.strictEqual(
        base.transport.snapshot().lastPlayurl?.reason,
        'upstream-error',
        `XHR ${type} reports rejection reason`,
      )
      const transformedAt = base.calls
      void xhr.response
      if (type === 'text') void xhr.responseText
      assert.strictEqual(
        base.calls,
        transformedAt,
        `XHR ${type} reads reuse the cached transformation`,
      )

      return
    }
  }
  throw Error('Unknown fixture parameter')
}

async function checkARejectedResultObjectCannotTruthilyPassStrictFetch2(
  t: TestContext,
): Promise<void> {
  const base = await createARejectedResultObjectCannotTruthilyPassStrictFetch2Context1(t)

  assert.strictEqual(
    base.rejected.status,
    503,
    'a rejected result object cannot truthily pass strict Fetch',
  )
  const rejectedBody: unknown = await base.rejected.json()
  assert.ok(
    typeof rejectedBody === 'object' &&
      rejectedBody !== null &&
      Reflect.get(rejectedBody, 'code') === -1,
    'strict Fetch returns the local block body',
  )
  assert.strictEqual(
    base.transport.snapshot().lastPlayurl?.upstreamCode,
    -10403,
    'summary preserves a numeric upstream error code',
  )
  assert.strictEqual(
    base.transport.snapshot().lastPlayurl?.reason,
    'upstream-error',
    'summary distinguishes upstream failure from parse failure',
  )
  assert.strictEqual(
    base.transport.snapshot().lastPlayurl?.status,
    200,
    'summary records native status separately from Fetch block status',
  )
}

async function checkPlayurlSummaryStartsEmpty1(t: TestContext): Promise<void> {
  const base = await createPlayurlSummaryScenario(t)

  assert.strictEqual(base.transport.snapshot().lastPlayurl, null, 'playurl summary starts empty')
  assert.strictEqual(
    (await base.windowFixture.fetch(base.endpoint)).status,
    200,
    'accepted typed Fetch result preserves native HTTP status',
  )
  const first = base.transport.snapshot().lastPlayurl
  assert.ok(
    first?.accepted && first.transport === 'fetch',
    'Fetch records typed acceptance and transport',
  )
  assert.strictEqual(
    first?.formats.join(','),
    'dash,mp4,flv',
    'summary distinguishes accepted DASH, MP4 and FLV',
  )
  assert.strictEqual(first?.videoCount, 3, 'summary retains video count')
  assert.strictEqual(first?.audioCount, 2, 'summary retains audio count')
  assert.strictEqual(first?.segmentCount, 4, 'summary retains progressive segment count')
  assert.ok(
    Object.isFrozen(first) && Object.isFrozen(first?.formats),
    'summary and its format list are immutable',
  )
}

test('playurl summary starts empty [1]', { timeout: 5000 }, async (t) => {
  await checkPlayurlSummaryStartsEmpty1(t)
})
test(
  'a rejected result object cannot truthily pass strict Fetch [2]',
  { timeout: 5000 },
  async (t) => {
    await checkARejectedResultObjectCannotTruthilyPassStrictFetch2(t)
  },
)
{
  let parameter = 0
  for (const type of ['text', 'json'] as const) {
    const selected = parameter++
    test(
      '`strict XHR ${type} rejects an unaccepted typed result` [3]' +
        ` / ${String(type)} / ${selected}`,
      { timeout: 5000 },
      async (t) => {
        await checkStrictXHRParameterRejectsAnUnacceptedTypedResult3ParameterParameter(t, selected)
      },
    )
  }
}
test('XHR response text accepts a typed accepted result [4]', { timeout: 5000 }, async (t) => {
  await checkXHRResponseTextAcceptsATypedAcceptedResult4(t)
})
test('Native-enabled XHR preserves rejected upstream payload [5]', { timeout: 5000 }, async (t) => {
  await checkNativeEnabledXHRPreservesRejectedUpstreamPayload5(t)
})
test('non-finite playurl summary counts are normalized [6]', { timeout: 5000 }, async (t) => {
  await checkNonFinitePlayurlSummaryCountsAreNormalized6(t)
})
test(
  'disabled transport preserves the recent playurl summary [7]',
  { timeout: 5000 },
  async (t) => {
    await checkDisabledTransportPreservesTheRecentPlayurlSummary7(t)
  },
)
