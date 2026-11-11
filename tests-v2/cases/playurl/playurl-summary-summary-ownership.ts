import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { createSummaryTransportResources } from './playurl-summary-resources.ts'

async function checkNonFinitePlayurlSummaryCountsAreNormalized6(t: TestContext): Promise<void> {
  const base = createSummaryTransportResources(t)
  base.block1.result = {
    ...base.accepted,
    videoCount: Infinity,
    audioCount: -1,
    segmentCount: 1_000_000,
    upstreamCode: Infinity,
    formats: ['dash', 'dash', 'mp4', 'flv', 'mp4'],
  }
  await base.windowFixture.fetch(base.endpoint)

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
  base.block1.result = augmented
  base.block1.now++
  await base.windowFixture.fetch(base.endpoint)
  const safe = base.transport.snapshot().lastPlayurl
  assert.strictEqual(safe?.observedAt, base.block1.now, 'recent summary reflects observation time')
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
  const base = createSummaryTransportResources(t)
  base.block1.strict = false
  base.block1.result = { ...base.accepted, accepted: false, reason: 'no-legal-route' }
  const nativeXhr = base.makeXhr('json', { code: 0, data: { url: base.secret } })

  assert.ok(
    JSON.stringify(nativeXhr.response).includes('summary-secret'),
    'Native-enabled XHR preserves rejected upstream payload',
  )
  assert.ok(
    base.transport.snapshot().lastPlayurl?.accepted === false,
    'pass-through rejection remains visible as unaccepted',
  )
  base.block1.strict = true
  const stale = base.makeXhr('text', { data: { url: base.secret } })
  base.session.beginGeneration(false)
  assert.ok(!stale.responseText.includes('summary-secret'), 'old-generation XHR remains blocked')
  assert.strictEqual(
    base.transport.snapshot().lastPlayurl?.reason,
    'inactive',
    'stale response summary does not claim acceptance',
  )
  let releaseBody = (): void => {}
  base.block1.responseOverride = new Response(
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
  base.block1.result = base.accepted
  const pending = base.windowFixture.fetch(base.endpoint),
    beforeStale = base.block1.calls
  base.session.beginGeneration(false)
  releaseBody()
  assert.strictEqual(
    (await pending).status,
    503,
    'late Fetch playurl response cannot use old generation acceptance',
  )
  assert.strictEqual(
    base.block1.calls,
    beforeStale,
    'old-generation Fetch response is not transformed',
  )
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
