import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { createSummaryTransportResources } from './playurl-summary-resources.ts'

async function checkXHRResponseTextAcceptsATypedAcceptedResult4(t: TestContext): Promise<void> {
  const base = createSummaryTransportResources(t)
  const acceptedXhr = base.makeXhr('text')

  assert.strictEqual(
    acceptedXhr.response,
    '{"code":0}',
    'XHR response text accepts a typed accepted result',
  )
  assert.strictEqual(
    base.transport.snapshot().lastPlayurl?.segmentCount,
    4,
    'XHR accepted result includes segment count',
  )
  const jsonXhr = base.makeXhr('json')
  const beforeJson = base.block1.calls
  assert.deepEqual(jsonXhr.response, { code: 0 })
  assert.strictEqual(
    base.block1.calls,
    beforeJson + 1,
    'JSON acceptance must have its own transformation',
  )
  assert.ok(
    base.transport.snapshot().lastPlayurl?.accepted,
    'XHR JSON accepts a typed accepted result',
  )
  base.block1.body = '{malformed:' + base.secret
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
  malformedXhr.rawText = base.block1.body
  void malformedXhr.responseText
  assert.strictEqual(
    base.transport.snapshot().lastPlayurl?.reason,
    'malformed-payload',
    'malformed XHR JSON receives a safe reason',
  )
  base.block1.body = '{"code":0}'
  base.block1.throws = true
  await base.windowFixture.fetch(base.endpoint)
  assert.strictEqual(
    base.transport.snapshot().lastPlayurl?.reason,
    'malformed-payload',
    'transform exceptions receive no raw error message',
  )
  base.block1.throws = false
  base.block1.strict = false
  base.block1.result = { ...base.accepted, accepted: false, reason: 'no-legal-route' }
  base.block1.body = JSON.stringify({ code: 0, data: { url: base.secret } })
  assert.strictEqual(
    await (await base.windowFixture.fetch(base.endpoint)).text(),
    base.block1.body,
    'Native-enabled Fetch preserves rejected upstream payload',
  )
}

async function checkStrictXHRParameterRejectsAnUnacceptedTypedResult3ParameterParameter(
  t: TestContext,
  type: 'text' | 'json',
): Promise<void> {
  const base = createSummaryTransportResources(t)
  base.block1.result = {
    accepted: false as const,
    formats: ['mp4'] as const,
    videoCount: 0,
    audioCount: 0,
    segmentCount: 2,
    upstreamCode: -10403,
    reason: 'upstream-error' as const,
  }

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
  const transformedAt = base.block1.calls
  void xhr.response
  if (type === 'text') void xhr.responseText
  assert.strictEqual(
    base.block1.calls,
    transformedAt,
    `XHR ${type} reads reuse the cached transformation`,
  )
}

async function checkARejectedResultObjectCannotTruthilyPassStrictFetch2(
  t: TestContext,
): Promise<void> {
  const base = createSummaryTransportResources(t)
  base.block1.result = {
    accepted: false as const,
    formats: ['mp4'] as const,
    videoCount: 0,
    audioCount: 0,
    segmentCount: 2,
    upstreamCode: -10403,
    reason: 'upstream-error' as const,
  }
  const rejected = await base.windowFixture.fetch(base.endpoint)

  assert.strictEqual(
    rejected.status,
    503,
    'a rejected result object cannot truthily pass strict Fetch',
  )
  const rejectedBody: unknown = await rejected.json()
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
  const base = createSummaryTransportResources(t)

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

for (const type of ['text', 'json'] as const) {
  test(
    `strict XHR ${type} rejects an unaccepted typed result [3]`,
    { timeout: 5000 },
    async (t) => {
      await checkStrictXHRParameterRejectsAnUnacceptedTypedResult3ParameterParameter(t, type)
    },
  )
}

test('XHR response text accepts a typed accepted result [4]', { timeout: 5000 }, async (t) => {
  await checkXHRResponseTextAcceptsATypedAcceptedResult4(t)
})
