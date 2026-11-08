import { test } from 'node:test'
import assert from 'node:assert/strict'
import { type TestContext } from 'node:test'
import { RangeProbeAdapter } from '../../../src-v2/adapters/transport/range-probe.ts'
import { BrowserNavigation } from '../../../src-v2/adapters/navigation.ts'
import { createRangeProbeResources } from './adapter-boundaries-resources.ts'

// Named scenarios create only their prerequisite state; resources belong to this test.

async function createHostAndurlContext1(_t: TestContext) {
  const host = 'upos-sz-mirrorcos.bilivideo.com'
  const url = `https://${host}/test.m4s`
  const input = {
    url: url,
    host: host,
    limit: 16,
    signal: new AbortController().signal,
    completionReason: 'enough',
  }
  let requestInit: RequestInit | undefined
  let reason: unknown
  let body: ReadableStream<Uint8Array> | null = null
  const response = (status: number, responseUrl: string, redirected = false): Response => {
    body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(32))
      },
      cancel(value) {
        reason = value
      },
    })
    const result = new Response(body, { status })
    Object.defineProperties(result, {
      url: { value: responseUrl },
      redirected: { value: redirected },
    })
    return result
  }
  const direct = new RangeProbeAdapter(
    async (_url, init) => {
      requestInit = init
      return response(206, url)
    },
    () => 10,
  )
  const measured = await direct.read(input)
  return {
    get body() {
      return body
    },
    set body(value: typeof body) {
      body = value
    },
    host,
    input,
    measured,
    get reason() {
      return reason
    },
    set reason(value: typeof reason) {
      reason = value
    },
    get requestInit() {
      return requestInit
    },
    set requestInit(value: typeof requestInit) {
      requestInit = value
    },
    response,
    url,
  }
}

async function checkProbeCapsConsumedBytesAtItsDeclaredLimit1(t: TestContext): Promise<void> {
  const base = await createHostAndurlContext1(t)

  assert.ok(
    base.measured.directRange && base.measured.bytes === 16,
    'probe caps consumed bytes at its declared limit',
  )
  assert.ok(
    base.requestInit?.redirect === 'error' &&
      base.requestInit.credentials === 'omit' &&
      base.requestInit.cache === 'no-store',
    'probe uses bounded anonymous direct requests',
  )
  assert.strictEqual(
    new Headers(base.requestInit?.headers).get('range'),
    'bytes=0-15',
    'probe range matches limit',
  )
  assert.strictEqual(base.reason, 'enough', 'bounded probe cancels reader with completion reason')
  assert.ok(
    base.body !== null && !Reflect.get(base.body, 'locked'),
    'bounded probe releases reader lock',
  )
}

async function checkProbeRejectsStatusResponseAuthorityParameterParameterParameter2Parameter(
  t: TestContext,
  parameter = 0,
): Promise<void> {
  const base = await createHostAndurlContext1(t)

  void (base.measured.directRange && base.measured.bytes === 16)
  void (
    base.requestInit?.redirect === 'error' &&
    base.requestInit.credentials === 'omit' &&
    base.requestInit.cache === 'no-store'
  )
  void new Headers(base.requestInit?.headers).get('range')
  void (base.body !== null && !Reflect.get(base.body, 'locked'))

  let iteration = 0
  for (const [status, target, redirected] of [
    [200, base.url, false],
    [206, 'https://other.example/test', false],
    [206, '', false],
    [206, base.url, true],
    [206, `http://${base.host}/test`, false],
    [206, `https://${base.host}:444/test`, false],
  ] as const) {
    if (iteration++ === parameter) {
      const probe = new RangeProbeAdapter(
        async () => base.response(status, target, redirected),
        () => 10,
      )
      assert.ok(
        !(await probe.read(base.input)).directRange,
        `probe rejects status/response authority: ${status}, ${target}, ${redirected}`,
      )

      return
    }
  }
  throw Error('Unknown fixture parameter')
}

async function checkAlreadyCancelledProbeDoesNotStartNetworkWork3(t: TestContext): Promise<void> {
  const base = await createRangeProbeResources(t)

  assert.strictEqual(base.fetchCalls, 0, 'already cancelled probe does not start network work')
  assert.strictEqual(
    base.cancelled.reason,
    'cancelled',
    'already cancelled probe returns cancellation',
  )
  const duringRead = new AbortController()
  let releaseCount = 0,
    readCount = 0
  const cancelReasons: unknown[] = []
  // A typed port at the browser boundary models a reader resolving after cancellation.
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        readCount++
        duringRead.abort('timeout')
        controller.enqueue(new Uint8Array(4))
      },
      cancel(value) {
        cancelReasons.push(value)
      },
    },
    { highWaterMark: 0 },
  )
  const originalGetReader = stream.getReader.bind(stream)
  Object.defineProperty(stream, 'getReader', {
    value: () => {
      const reader = originalGetReader(),
        release = reader.releaseLock.bind(reader)
      reader.releaseLock = () => {
        releaseCount++
        release()
      }
      return reader
    },
  })
  const delayedResponse = new Response(stream, { status: 206 })
  Object.defineProperty(delayedResponse, 'url', { value: base.url })
  const timed = await new RangeProbeAdapter(
    async () => delayedResponse,
    () => 10,
  ).read({ ...base.input, signal: duringRead.signal })
  assert.strictEqual(
    timed.reason,
    'timeout',
    'abort during reader consumption cannot become measured success',
  )
  assert.ok(!timed.directRange && readCount === 1, 'aborted probe stops consuming')
  assert.strictEqual(cancelReasons[0], 'timeout', 'probe cleanup propagates abort reason')
  assert.strictEqual(releaseCount, 1, 'probe cleanup releases exactly one reader')
  const tasks: (() => void)[] = [],
    eventTarget = new EventTarget()
  let calledThis: unknown,
    pushes = 0,
    replaces = 0,
    notifications = 0
  const historyFixture = {
    pushState(this: unknown) {
      calledThis = this
      pushes++
    },
    replaceState() {
      replaces++
    },
  } satisfies Pick<History, 'pushState' | 'replaceState'>
  historyFixture.pushState
  historyFixture.replaceState
  for (const [name, descriptor] of Object.entries({
    history: { configurable: true, value: historyFixture },
    location: { configurable: true, value: { pathname: '/video/test', search: '?p=2' } },
    addEventListener: {
      configurable: true,
      value: eventTarget.addEventListener.bind(eventTarget),
    },
    removeEventListener: {
      configurable: true,
      value: eventTarget.removeEventListener.bind(eventTarget),
    },
    queueMicrotask: { configurable: true, value: (task: () => void) => tasks.push(task) },
  }))
    base.scope.defineGlobal(name, descriptor)
  const navigation = new BrowserNavigation(),
    stop = navigation.subscribe(() => notifications++)
  base.scope.defer(stop)
  assert.strictEqual(
    navigation.key(),
    '/video/test?p=2',
    'navigation supplies explicit current key',
  )
  historyFixture.pushState()
  historyFixture.replaceState()
  assert.ok(
    pushes === 1 && replaces === 1 && calledThis === historyFixture,
    'history wrapper preserves calls and receiver',
  )
  assert.strictEqual(notifications, 0, 'navigation notification runs after history call')
}

test('probe caps consumed bytes at its declared limit [1]', { timeout: 5000 }, async (t) => {
  await checkProbeCapsConsumedBytesAtItsDeclaredLimit1(t)
})

{
  let parameter = 0
  const host = 'upos-sz-mirrorcos.bilivideo.com',
    url = `https://${host}/test.m4s`
  for (const [status, target, redirected] of [
    [200, url, false],
    [206, 'https://other.example/test', false],
    [206, '', false],
    [206, url, true],
    [206, `http://${host}/test`, false],
    [206, `https://${host}:444/test`, false],
  ] as const) {
    const selected = parameter++
    test(
      `probe rejects status/response authority: ${status}, ${target}, ${redirected} [2] / ${selected}`,
      { timeout: 5000 },
      async (t) => {
        await checkProbeRejectsStatusResponseAuthorityParameterParameterParameter2Parameter(
          t,
          selected,
        )
      },
    )
  }
}

test('already cancelled probe does not start network work [3]', { timeout: 5000 }, async (t) => {
  await checkAlreadyCancelledProbeDoesNotStartNetworkWork3(t)
})
