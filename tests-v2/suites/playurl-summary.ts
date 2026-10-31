import { extendFixture } from '../support/fixture-context.ts'
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
import { DiagnosticRecorder } from '../../src-v2/diagnostics/recorder.ts'
import { SessionStore } from '../../src-v2/state/session-store.ts'
import { testScope } from '../support/scope.ts'

// Named scenarios create only their prerequisite state; resources belong to this test.
async function createPlayurlSummaryScenario(t: TestContext) {
  const scope = testScope(t)
  installProgressEvent(scope)
  const session = new SessionStore()
  session.beginGeneration(false)
  let strict = true,
    disabled = false,
    status = 200,
    body = '{"code":0}',
    throws = false,
    calls = 0
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
  const settings = { get: () => ({ disabled, blockHttpDns: false }) } satisfies TransportSettings
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
  const nativeFetch: typeof fetch = async () => responseOverride ?? new Response(body, { status })
  const windowFixture = { fetch: nativeFetch, XMLHttpRequest: FakeXhr }
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
      () => now,
      createRuntimeIds(),
    ),
  )
  transport.install()
  const endpoint = 'https://api.bilibili.com/x/player/wbi/playurl?token=summary-secret'
  return extendFixture({}, {
    session,
    get strict() {
      return strict
    },
    set strict(next: typeof strict) {
      strict = next
    },
    get disabled() {
      return disabled
    },
    set disabled(next: typeof disabled) {
      disabled = next
    },
    get body() {
      return body
    },
    set body(next: typeof body) {
      body = next
    },
    get throws() {
      return throws
    },
    set throws(next: typeof throws) {
      throws = next
    },
    get calls() {
      return calls
    },
    set calls(next: typeof calls) {
      calls = next
    },
    get responseOverride() {
      return responseOverride
    },
    set responseOverride(next: typeof responseOverride) {
      responseOverride = next
    },
    get now() {
      return now
    },
    set now(next: typeof now) {
      now = next
    },
    secret,
    accepted,
    get result() {
      return result
    },
    set result(next: typeof result) {
      result = next
    },
    windowFixture,
    transport,
    endpoint,
  } as const)
}

async function createARejectedResultObjectCannotTruthilyPassStrictFetch2Context1(t: TestContext) {
  const base = await createPlayurlSummaryScenario(t)
  void base.transport.snapshot().lastPlayurl
  void (await base.windowFixture.fetch(base.endpoint)).status
  const first = base.transport.snapshot().lastPlayurl
  void first?.formats.join(',')
  base.result = {
    accepted: false,
    formats: ['mp4'],
    videoCount: 0,
    audioCount: 0,
    segmentCount: 2,
    upstreamCode: -10403,
    reason: 'upstream-error',
  }
  const rejected = await base.windowFixture.fetch(base.endpoint)
  return extendFixture(base, { rejected } as const)
}

async function createRejectedBodyContext2(t: TestContext) {
  const base = await createARejectedResultObjectCannotTruthilyPassStrictFetch2Context1(t)
  void (await base.rejected.json())
  void base.transport.snapshot().lastPlayurl?.upstreamCode
  void base.transport.snapshot().lastPlayurl?.reason
  void base.transport.snapshot().lastPlayurl?.status
  const makeXhr = (type: XMLHttpRequestResponseType, value: unknown = { code: 0 }) => {
    const xhr = new base.windowFixture.XMLHttpRequest()
    xhr.responseType = type
    xhr.payload = value
    xhr.open('GET', base.endpoint)
    xhr.send()
    return xhr
  }
  return extendFixture(base, { makeXhr } as const)
}

async function createXHRResponseTextAcceptsATypedAcceptedResult4Context3(t: TestContext) {
  const base = await createRejectedBodyContext2(t)
  for (const type of ['text', 'json'] as const) {
    const xhr = base.makeXhr(type, { code: 0, data: { url: base.secret } })
    const output = type === 'json' ? JSON.stringify(xhr.response) : xhr.responseText
    void !output.includes('summary-secret')
    void xhr.status
    void 200
    void base.transport.snapshot().lastPlayurl?.transport
    void 'xhr'
    void base.transport.snapshot().lastPlayurl?.reason
    void 'upstream-error'
    const transformedAt = base.calls
    void xhr.response
    if (type === 'text') void xhr.responseText
    void base.calls
    void transformedAt
  }
  base.result = base.accepted
  const acceptedXhr = base.makeXhr('text')
  return extendFixture(base, { acceptedXhr } as const)
}

async function createNativeEnabledXHRPreservesRejectedUpstreamPayload5Context4(t: TestContext) {
  const base = await createXHRResponseTextAcceptsATypedAcceptedResult4Context3(t)
  void base.transport.snapshot().lastPlayurl?.segmentCount
  void base.transport.snapshot().lastPlayurl?.accepted
  base.body = '{malformed:' + base.secret
  void (await base.windowFixture.fetch(base.endpoint)).status
  void base.transport.snapshot().lastPlayurl?.reason
  const malformedXhr = base.makeXhr('text')
  malformedXhr.rawText = base.body
  void base.transport.snapshot().lastPlayurl?.reason
  base.body = '{"code":0}'
  base.throws = true
  await base.windowFixture.fetch(base.endpoint)
  void base.transport.snapshot().lastPlayurl?.reason
  base.throws = false
  base.strict = false
  base.result = { ...base.accepted, accepted: false, reason: 'no-legal-route' }
  base.body = JSON.stringify({ code: 0, data: { url: base.secret } })
  void (await (await base.windowFixture.fetch(base.endpoint)).text())
  const nativeXhr = base.makeXhr('json', { code: 0, data: { url: base.secret } })
  return extendFixture(base, { nativeXhr } as const)
}

async function createNonFiniteDiagnosticCountsAreNormalized6Context5(t: TestContext) {
  const base = await createNativeEnabledXHRPreservesRejectedUpstreamPayload5Context4(t)
  void (base.transport.snapshot().lastPlayurl?.accepted === false)
  base.strict = true
  const stale = base.makeXhr('text', { data: { url: base.secret } })
  base.session.beginGeneration(false)
  void !stale.responseText.includes('summary-secret')
  void base.transport.snapshot().lastPlayurl?.reason
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
  void base.windowFixture.fetch(base.endpoint)
  base.session.beginGeneration(false)
  releaseBody()
  void base.transport.snapshot().lastPlayurl?.reason
  void base.transport.snapshot().lastPlayurl?.status
  base.responseOverride = null
  base.result = {
    ...base.accepted,
    videoCount: Infinity,
    audioCount: -1,
    segmentCount: 1_000_000,
    upstreamCode: Infinity,
    formats: ['dash', 'dash', 'mp4', 'flv', 'mp4'],
  }
  await base.windowFixture.fetch(base.endpoint)
  return extendFixture(base, {} as const)
}

async function checkNonFiniteDiagnosticCountsAreNormalized6(t: TestContext): Promise<void> {
  const base = await createNonFiniteDiagnosticCountsAreNormalized6Context5(t)

  assert.strictEqual(
    base.transport.snapshot().lastPlayurl?.videoCount,
    0,
    'non-finite diagnostic counts are normalized',
  )
  assert.strictEqual(
    base.transport.snapshot().lastPlayurl?.audioCount,
    0,
    'negative diagnostic counts are normalized',
  )
  assert.strictEqual(
    base.transport.snapshot().lastPlayurl?.segmentCount,
    65_535,
    'diagnostic counts have a finite upper bound',
  )
  assert.strictEqual(
    base.transport.snapshot().lastPlayurl?.upstreamCode,
    null,
    'non-finite upstream code is omitted',
  )
  assert.strictEqual(
    base.transport.snapshot().lastPlayurl?.formats.join(','),
    'dash,mp4,flv',
    'diagnostic formats have a bounded unique set',
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
  const recorder = new DiagnosticRecorder(() => base.now)
  const report = recorder.buildReport({ interception: base.transport.snapshot() })
  assert.ok(
    !report.includes('summary-secret') &&
      !report.includes('example.invalid') &&
      !report.includes('video.m4s'),
    'diagnostic export contains no response body, signed path or token',
  )
}

async function checkDiagnosticReportRetainsTheRecentPlayurlSummary7(t: TestContext): Promise<void> {
  const base = await createNonFiniteDiagnosticCountsAreNormalized6Context5(t)

  void base.transport.snapshot().lastPlayurl?.videoCount
  void base.transport.snapshot().lastPlayurl?.audioCount
  void base.transport.snapshot().lastPlayurl?.segmentCount
  void base.transport.snapshot().lastPlayurl?.upstreamCode
  void base.transport.snapshot().lastPlayurl?.formats.join(',')
  const augmented = {
    ...base.accepted,
    url: base.secret,
    token: 'summary-secret',
    payload: { raw: base.secret },
  }
  base.result = augmented
  await base.windowFixture.fetch(base.endpoint)
  void base.transport.snapshot().lastPlayurl
  void !JSON.stringify(base.transport.snapshot()).includes('summary-secret')
  const recorder = new DiagnosticRecorder(() => base.now)
  const report = recorder.buildReport({ interception: base.transport.snapshot() })
  void (
    !report.includes('summary-secret') &&
    !report.includes('example.invalid') &&
    !report.includes('video.m4s')
  )
  const parsed: unknown = JSON.parse(report)
  const current: unknown =
    parsed && typeof parsed === 'object' ? Reflect.get(parsed, 'current') : null
  const interception: unknown =
    current && typeof current === 'object' ? Reflect.get(current, 'interception') : null

  assert.ok(
    !!interception &&
      typeof interception === 'object' &&
      Reflect.get(interception, 'lastPlayurl') !== null,
    'diagnostic report retains the recent playurl summary',
  )
  base.disabled = true
  const previous = base.transport.snapshot().lastPlayurl
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
test('non-finite diagnostic counts are normalized [6]', { timeout: 5000 }, async (t) => {
  await checkNonFiniteDiagnosticCountsAreNormalized6(t)
})
test('diagnostic report retains the recent playurl summary [7]', { timeout: 5000 }, async (t) => {
  await checkDiagnosticReportRetainsTheRecentPlayurlSummary7(t)
})
