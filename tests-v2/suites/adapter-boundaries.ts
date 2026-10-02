import { RangeProbeAdapter } from '../../src-v2/adapters/range-probe.ts'
import { BrowserNavigation } from '../../src-v2/adapters/navigation.ts'
import { assertionCount, check, equal } from '../support/assert.ts'
import { testScope } from '../support/scope.ts'

const scope = testScope()
try {
  const host = 'upos-sz-mirrorcos.bilivideo.com', url = `https://${host}/test.m4s`
  const input = { url, host, limit: 16, signal: new AbortController().signal, completionReason: 'enough' }
  let requestInit: RequestInit | undefined, reason: unknown, body: ReadableStream<Uint8Array> | null = null
  const response = (status: number, responseUrl: string, redirected = false): Response => {
    body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(32)) }, cancel(value) { reason = value } })
    const result = new Response(body, { status })
    Object.defineProperties(result, { url: { value: responseUrl }, redirected: { value: redirected } })
    return result
  }
  const direct = new RangeProbeAdapter(async (_url, init) => { requestInit = init; return response(206, url) }, () => 10)
  const measured = await direct.read(input)
  check(measured.directRange && measured.bytes === 16, 'probe caps consumed bytes at its declared limit')
  check(requestInit?.redirect === 'error' && requestInit.credentials === 'omit' && requestInit.cache === 'no-store', 'probe uses bounded anonymous direct requests')
  equal(new Headers(requestInit?.headers).get('range'), 'bytes=0-15', 'probe range matches limit')
  equal(reason, 'enough', 'bounded probe cancels reader with completion reason')
  check(body !== null && !Reflect.get(body, 'locked'), 'bounded probe releases reader lock')
  for (const [status, target, redirected] of [[200, url, false], [206, 'https://other.example/test', false],
    [206, '', false], [206, url, true], [206, `http://${host}/test`, false], [206, `https://${host}:444/test`, false]] as const) {
    const probe = new RangeProbeAdapter(async () => response(status, target, redirected), () => 10)
    check(!(await probe.read(input)).directRange, `probe rejects status/response authority: ${status}, ${target}, ${redirected}`)
  }
  const aborted = new AbortController(); aborted.abort('generation')
  let fetchCalls = 0
  const cancelled = await new RangeProbeAdapter(async () => { fetchCalls++; return response(206, url) }, () => 10)
    .read({ ...input, signal: aborted.signal })
  equal(fetchCalls, 0, 'already cancelled probe does not start network work')
  equal(cancelled.reason, 'cancelled', 'already cancelled probe returns cancellation')

  const duringRead = new AbortController()
  let releaseCount = 0, readCount = 0
  const cancelReasons: unknown[] = []
  // A typed port at the browser boundary models a reader resolving after cancellation.
  const stream = new ReadableStream<Uint8Array>({ pull(controller) {
    readCount++; duringRead.abort('timeout'); controller.enqueue(new Uint8Array(4))
  }, cancel(value) { cancelReasons.push(value) } }, { highWaterMark: 0 })
  const originalGetReader = stream.getReader.bind(stream)
  Object.defineProperty(stream, 'getReader', { value: () => {
    const reader = originalGetReader(), release = reader.releaseLock.bind(reader)
    reader.releaseLock = () => { releaseCount++; release() }
    return reader
  } })
  const delayedResponse = new Response(stream, { status: 206 }); Object.defineProperty(delayedResponse, 'url', { value: url })
  const timed = await new RangeProbeAdapter(async () => delayedResponse, () => 10).read({ ...input, signal: duringRead.signal })
  equal(timed.reason, 'timeout', 'abort during reader consumption cannot become measured success')
  check(!timed.directRange && readCount === 1, 'aborted probe stops consuming')
  equal(cancelReasons[0], 'timeout', 'probe cleanup propagates abort reason')
  equal(releaseCount, 1, 'probe cleanup releases exactly one reader')

  const tasks: (() => void)[] = [], eventTarget = new EventTarget()
  let calledThis: unknown, pushes = 0, replaces = 0, notifications = 0
  const historyFixture = { pushState(this: unknown) { calledThis = this; pushes++ }, replaceState() { replaces++ } } satisfies Pick<History, 'pushState' | 'replaceState'>
  const originalPush = historyFixture.pushState, originalReplace = historyFixture.replaceState
  Object.defineProperties(globalThis, {
    history: { configurable: true, value: historyFixture }, location: { configurable: true, value: { pathname: '/video/test', search: '?p=2' } },
    addEventListener: { configurable: true, value: eventTarget.addEventListener.bind(eventTarget) },
    removeEventListener: { configurable: true, value: eventTarget.removeEventListener.bind(eventTarget) },
    queueMicrotask: { configurable: true, value: (task: () => void) => tasks.push(task) },
  })
  const navigation = new BrowserNavigation(), stop = navigation.subscribe(() => notifications++)
  scope.defer(stop)
  equal(navigation.key(), '/video/test?p=2', 'navigation supplies explicit current key')
  historyFixture.pushState(); historyFixture.replaceState()
  check(pushes === 1 && replaces === 1 && calledThis === historyFixture, 'history wrapper preserves calls and receiver')
  equal(notifications, 0, 'navigation notification runs after history call')
  tasks.splice(0).forEach(task => task()); eventTarget.dispatchEvent(new Event('popstate'))
  equal(notifications, 3, 'navigation observes history and popstate')
  historyFixture.pushState(); stop(); tasks.splice(0).forEach(task => task()); eventTarget.dispatchEvent(new Event('popstate'))
  equal(notifications, 3, 'disposed navigation ignores queued events and removes popstate listener')
  check(historyFixture.pushState === originalPush && historyFixture.replaceState === originalReplace, 'navigation restores owned hooks')
  const stopSecond = navigation.subscribe(() => notifications++), newerHook = () => undefined
  historyFixture.pushState = newerHook; stopSecond()
  check(historyFixture.pushState === newerHook, 'navigation cleanup preserves a newer owner')
  console.log(`adapter-boundaries: ${assertionCount()} assertions`)
} finally { scope.dispose() }
