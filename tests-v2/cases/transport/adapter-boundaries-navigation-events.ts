import { test } from 'node:test'
import assert from 'node:assert/strict'
import { type TestContext } from 'node:test'
import { RangeProbeAdapter } from '../../../src-v2/adapters/transport/range-probe.ts'
import { BrowserNavigation } from '../../../src-v2/adapters/navigation.ts'
import { createRangeProbeResources } from './adapter-boundaries-resources.ts'

async function checkNavigationObservesHistoryAndPopstate4(t: TestContext): Promise<void> {
  const base = await createRangeProbeResources(t)

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

test('navigation observes history and popstate [4]', { timeout: 5000 }, async (t) => {
  await checkNavigationObservesHistoryAndPopstate4(t)
})
