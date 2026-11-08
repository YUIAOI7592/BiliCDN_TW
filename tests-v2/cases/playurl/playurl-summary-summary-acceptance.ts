import { installProgressEvent } from '../../support/progress-event.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { type TestContext } from 'node:test'
import { TransportAdapter } from '../../../src-v2/adapters/transport/transport.ts'
import { SessionStore } from '../../../src-v2/state/session-store.ts'
import { testScope } from '../../support/scope.ts'
import { createSummaryHookPrimitives } from './playurl-summary-resources.ts'

async function createPlayurlSummaryScenario(t: TestContext) {
  const scope = testScope(t)
  installProgressEvent(scope)
  const session = new SessionStore()
  session.beginGeneration(false)
  const block1 = createSummaryHookPrimitives()
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
      undefined,
      () => block1.now,
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
  const block1 = createSummaryHookPrimitives()
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
      undefined,
      () => block1.now,
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
  const block1 = createSummaryHookPrimitives()
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
      undefined,
      () => block1.now,
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
  const block1 = createSummaryHookPrimitives()
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
