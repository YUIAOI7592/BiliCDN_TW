import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { RangeProbeAdapter } from '../../src-v2/adapters/range-probe.ts'
import { BrowserNavigation } from '../../src-v2/adapters/navigation.ts'
import { testScope } from '../support/scope.ts'

// Each call creates fresh resources and replays only this fixture's prerequisite transitions.
// Earlier expectations run in their own cases; no mutable state crosses a test boundary.
async function fixture(t: TestContext, scenario: number, parameter = 0): Promise<() => Promise<void>> {
  const scope = testScope(t)
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
if (scenario === 0) return async () => {
assert.ok(measured.directRange && measured.bytes === 16, 'probe caps consumed bytes at its declared limit')
assert.ok(requestInit?.redirect === 'error' && requestInit.credentials === 'omit' && requestInit.cache === 'no-store', 'probe uses bounded anonymous direct requests')
assert.strictEqual(new Headers(requestInit?.headers).get('range'), 'bytes=0-15', 'probe range matches limit')
assert.strictEqual(reason, 'enough', 'bounded probe cancels reader with completion reason')
assert.ok(body !== null && !Reflect.get(body, 'locked'), 'bounded probe releases reader lock')
}
void (measured.directRange && measured.bytes === 16);
void (requestInit?.redirect === 'error' && requestInit.credentials === 'omit' && requestInit.cache === 'no-store');
void (new Headers(requestInit?.headers).get('range'));
void ('bytes=0-15');
void (reason);
void ('enough');
void (body !== null && !Reflect.get(body, 'locked'));

if (scenario === 1) {
 let iteration = 0
for (const [status, target, redirected] of [[200, url, false], [206, 'https://other.example/test', false],
    [206, '', false], [206, url, true], [206, `http://${host}/test`, false], [206, `https://${host}:444/test`, false]] as const) {
 if (iteration++ === parameter) return async () => {
    const probe = new RangeProbeAdapter(async () => response(status, target, redirected), () => 10)
    assert.ok(!(await probe.read(input)).directRange, `probe rejects status/response authority: ${status}, ${target}, ${redirected}`)
  }
 }
 throw Error('Unknown fixture parameter')
}
for (const [status, target, redirected] of [[200, url, false], [206, 'https://other.example/test', false],
    [206, '', false], [206, url, true], [206, `http://${host}/test`, false], [206, `https://${host}:444/test`, false]] as const) {
    const probe = new RangeProbeAdapter(async () => response(status, target, redirected), () => 10)
void (!(await probe.read(input)).directRange);
  }
const aborted = new AbortController();
aborted.abort('generation')
let fetchCalls = 0
const cancelled = await new RangeProbeAdapter(async () => { fetchCalls++; return response(206, url) }, () => 10)
    .read({ ...input, signal: aborted.signal })
if (scenario === 2) return async () => {
assert.strictEqual(fetchCalls, 0, 'already cancelled probe does not start network work')
assert.strictEqual(cancelled.reason, 'cancelled', 'already cancelled probe returns cancellation')
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
const delayedResponse = new Response(stream, { status: 206 });
Object.defineProperty(delayedResponse, 'url', { value: url })
const timed = await new RangeProbeAdapter(async () => delayedResponse, () => 10).read({ ...input, signal: duringRead.signal })
assert.strictEqual(timed.reason, 'timeout', 'abort during reader consumption cannot become measured success')
assert.ok(!timed.directRange && readCount === 1, 'aborted probe stops consuming')
assert.strictEqual(cancelReasons[0], 'timeout', 'probe cleanup propagates abort reason')
assert.strictEqual(releaseCount, 1, 'probe cleanup releases exactly one reader')
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
assert.strictEqual(navigation.key(), '/video/test?p=2', 'navigation supplies explicit current key')
historyFixture.pushState();
historyFixture.replaceState()
assert.ok(pushes === 1 && replaces === 1 && calledThis === historyFixture, 'history wrapper preserves calls and receiver')
assert.strictEqual(notifications, 0, 'navigation notification runs after history call')
}
void (fetchCalls);
void (0);
void (cancelled.reason);
void ('cancelled');
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
const delayedResponse = new Response(stream, { status: 206 });
Object.defineProperty(delayedResponse, 'url', { value: url })
const timed = await new RangeProbeAdapter(async () => delayedResponse, () => 10).read({ ...input, signal: duringRead.signal })
void (timed.reason);
void ('timeout');
void (!timed.directRange && readCount === 1);
void (cancelReasons[0]);
void ('timeout');
void (releaseCount);
void (1);
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
void (navigation.key());
void ('/video/test?p=2');
historyFixture.pushState();
historyFixture.replaceState()
void (pushes === 1 && replaces === 1 && calledThis === historyFixture);
void (notifications);
void (0);
tasks.splice(0).forEach(task => task());
eventTarget.dispatchEvent(new Event('popstate'))
if (scenario === 3) return async () => {
assert.strictEqual(notifications, 3, 'navigation observes history and popstate')
historyFixture.pushState();
stop();
tasks.splice(0).forEach(task => task());
eventTarget.dispatchEvent(new Event('popstate'))
assert.strictEqual(notifications, 3, 'disposed navigation ignores queued events and removes popstate listener')
assert.ok(historyFixture.pushState === originalPush && historyFixture.replaceState === originalReplace, 'navigation restores owned hooks')
const stopSecond = navigation.subscribe(() => notifications++), newerHook = () => undefined
historyFixture.pushState = newerHook;
stopSecond()
assert.ok(historyFixture.pushState === newerHook, 'navigation cleanup preserves a newer owner')
}
void (notifications);
void (3);
historyFixture.pushState();
stop();
tasks.splice(0).forEach(task => task());
eventTarget.dispatchEvent(new Event('popstate'))
void (notifications);
void (3);
void (historyFixture.pushState === originalPush && historyFixture.replaceState === originalReplace);
const stopSecond = navigation.subscribe(() => notifications++), newerHook = () => undefined
historyFixture.pushState = newerHook;
stopSecond()
void (historyFixture.pushState === newerHook);
throw Error('Unknown fixture scenario')
}

test("probe caps consumed bytes at its declared limit [1]", { timeout: 5000 }, async t => { await (await fixture(t, 0))() })
{
 let parameter = 0
 const host = 'upos-sz-mirrorcos.bilivideo.com', url = `https://${host}/test.m4s`
for (const [status, target, redirected] of [[200, url, false], [206, 'https://other.example/test', false],
    [206, '', false], [206, url, true], [206, `http://${host}/test`, false], [206, `https://${host}:444/test`, false]] as const) {
 const selected = parameter++
 test(`probe rejects status/response authority: ${status}, ${target}, ${redirected} [2] / ${selected}`, { timeout: 5000 }, async t => { await (await fixture(t, 1, selected))() })
}
}
test("already cancelled probe does not start network work [3]", { timeout: 5000 }, async t => { await (await fixture(t, 2))() })
test("navigation observes history and popstate [4]", { timeout: 5000 }, async t => { await (await fixture(t, 3))() })
import '../regressions/functional-races/adapter-controls.ts'
