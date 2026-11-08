import { installProgressEvent } from '../../support/progress-event.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { type TestContext } from 'node:test'
import { TransportAdapter } from '../../../src-v2/adapters/transport/transport.ts'
import { SessionStore } from '../../../src-v2/state/session-store.ts'
import { testScope } from '../../support/scope.ts'
import { createSummaryHookPrimitives } from './playurl-summary-resources.ts'

async function createNativeEnabledXHRPreservesRejectedUpstreamPayload5Context4(t: TestContext) {
  const scope = testScope(t)
  installProgressEvent(scope)
  const session = new SessionStore()
  session.beginGeneration(false)
  const block1 = createSummaryHookPrimitives()
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
      undefined,
      () => block1.now,
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
  const block1 = createSummaryHookPrimitives()
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
      undefined,
      () => block1.now,
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
