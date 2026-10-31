import { extendFixture } from '../support/fixture-context.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { RangeProbeAdapter } from '../../src-v2/adapters/range-probe.ts'
import { BrowserNavigation } from '../../src-v2/adapters/navigation.ts'
import { testScope } from '../support/scope.ts'

// Named scenarios create only their prerequisite state; resources belong to this test.
async function createAdapterBoundariesScenario(_t: TestContext) {
  return extendFixture({}, {} as const)
}

async function createHostAndurlContext1(t: TestContext) {
  const base = await createAdapterBoundariesScenario(t)
  const host = 'upos-sz-mirrorcos.bilivideo.com',
    url = `https://${host}/test.m4s`
  const input = {
    url,
    host,
    limit: 16,
    signal: new AbortController().signal,
    completionReason: 'enough',
  }
  let requestInit: RequestInit | undefined,
    reason: unknown,
    body: ReadableStream<Uint8Array> | null = null
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
  return extendFixture(base, {
    host,
    url,
    input,
    get requestInit() {
      return requestInit
    },
    set requestInit(next: typeof requestInit) {
      requestInit = next
    },
    get reason() {
      return reason
    },
    set reason(next: typeof reason) {
      reason = next
    },
    get body() {
      return body
    },
    set body(next: typeof body) {
      body = next
    },
    response,
    direct,
    measured,
  } as const)
}

async function createScopeContext2(t: TestContext) {
  const base = await createAdapterBoundariesScenario(t)
  const scope = testScope(t)
  const host = 'upos-sz-mirrorcos.bilivideo.com',
    url = `https://${host}/test.m4s`
  const input = {
    url,
    host,
    limit: 16,
    signal: new AbortController().signal,
    completionReason: 'enough',
  }
  let requestInit: RequestInit | undefined
  let body: ReadableStream<Uint8Array> | null = null
  const response = (status: number, responseUrl: string, redirected = false): Response => {
    body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(32))
      },
      cancel(value) {
        void value
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
  void (measured.directRange && measured.bytes === 16)
  void (
    requestInit?.redirect === 'error' &&
    requestInit.credentials === 'omit' &&
    requestInit.cache === 'no-store'
  )
  void new Headers(requestInit?.headers).get('range')
  void (body !== null && !Reflect.get(body, 'locked'))
  for (const [status, target, redirected] of [
    [200, url, false],
    [206, 'https://other.example/test', false],
    [206, '', false],
    [206, url, true],
    [206, `http://${host}/test`, false],
    [206, `https://${host}:444/test`, false],
  ] as const) {
    const probe = new RangeProbeAdapter(
      async () => response(status, target, redirected),
      () => 10,
    )
    void !(await probe.read(input)).directRange
  }
  const aborted = new AbortController()
  aborted.abort('generation')
  let fetchCalls = 0
  const cancelled = await new RangeProbeAdapter(
    async () => {
      fetchCalls++
      return response(206, url)
    },
    () => 10,
  ).read({ ...input, signal: aborted.signal })
  return extendFixture(base, {
    scope,
    host,
    url,
    input,
    get requestInit() {
      return requestInit
    },
    set requestInit(next: typeof requestInit) {
      requestInit = next
    },
    get body() {
      return body
    },
    set body(next: typeof body) {
      body = next
    },
    response,
    direct,
    measured,
    aborted,
    get fetchCalls() {
      return fetchCalls
    },
    set fetchCalls(next: typeof fetchCalls) {
      fetchCalls = next
    },
    cancelled,
  } as const)
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
  const base = await createScopeContext2(t)

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
  Object.defineProperties(globalThis, {
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
  })
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

async function checkNavigationObservesHistoryAndPopstate4(t: TestContext): Promise<void> {
  const base = await createScopeContext2(t)

  const duringRead = new AbortController()
  let releaseCount = 0,
    readCount = 0
  const cancelReasons: unknown[] = []
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
  void (!timed.directRange && readCount === 1)
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
  const originalPush = historyFixture.pushState,
    originalReplace = historyFixture.replaceState
  Object.defineProperties(globalThis, {
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
  })
  const navigation = new BrowserNavigation(),
    stop = navigation.subscribe(() => notifications++)
  base.scope.defer(stop)
  void navigation.key()
  historyFixture.pushState()
  historyFixture.replaceState()
  void (pushes === 1 && replaces === 1 && calledThis === historyFixture)
  tasks.splice(0).forEach((task) => task())
  eventTarget.dispatchEvent(new Event('popstate'))

  assert.strictEqual(notifications, 3, 'navigation observes history and popstate')
  historyFixture.pushState()
  stop()
  tasks.splice(0).forEach((task) => task())
  eventTarget.dispatchEvent(new Event('popstate'))
  assert.strictEqual(
    notifications,
    3,
    'disposed navigation ignores queued events and removes popstate listener',
  )
  assert.ok(
    historyFixture.pushState === originalPush && historyFixture.replaceState === originalReplace,
    'navigation restores owned hooks',
  )
  const stopSecond = navigation.subscribe(() => notifications++),
    newerHook = () => undefined
  historyFixture.pushState = newerHook
  stopSecond()
  assert.ok(historyFixture.pushState === newerHook, 'navigation cleanup preserves a newer owner')
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
test('navigation observes history and popstate [4]', { timeout: 5000 }, async (t) => {
  await checkNavigationObservesHistoryAndPopstate4(t)
})
import '../regressions/functional-races/adapter-controls.ts'
import '../regressions/functional-races/visibility-ownership.ts'
