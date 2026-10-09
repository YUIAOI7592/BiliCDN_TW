import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { startupAbortFixture as fixture, startupAbortUrl as url } from '../../support/startup-abort.ts'

const reasons: readonly [string, () => unknown][] = [
  ['object', () => ({ tag: 'owned-object' })], ['Error', () => new Error('owned-error')],
  ['TimeoutError', () => new DOMException('owned-timeout', 'TimeoutError')], ['string', () => 'owned-string'],
  ['zero', () => 0], ['false', () => false], ['empty-string', () => ''], ['null', () => null],
  ['default', () => undefined],
]

for (const [label, makeReason] of reasons) {
  for (const timing of ['pre-aborted', 'before-listener', 'waiting'] as const) {
    test(`BR-05 ${timing} startup preserves ${label} cancellation reason`, async t => {
      const controller = new AbortController(), reason = makeReason()
      const abort = () => controller.abort(reason)
      const f = fixture(t, timing === 'before-listener' ? abort : undefined)
      if (timing === 'pre-aborted') abort()
      const pending = f.measurement.prepareStartup(url, controller.signal)
      if (timing === 'waiting') abort()
      const caught = await pending.then(() => ({ rejected: false, reason: undefined }), reason => ({ rejected: true, reason }))
      assert.equal(caught.rejected, true)
      assert.strictEqual(caught.reason, controller.signal.reason)
      assert.equal(f.probeSignals.length, timing === 'pre-aborted' ? 0 : 1)
    })
  }
}

for (const timing of ['cancel', 'complete', 'reset'] as const) {
  test(`BR-05 ${timing} cleans waiter listeners and preserves shared-window ownership`, async t => {
    const f = fixture(t), controller = new AbortController(), listeners = new Set<EventListenerOrEventListenerObject>()
    const signal = controller.signal, add = signal.addEventListener.bind(signal), remove = signal.removeEventListener.bind(signal)
    signal.addEventListener = (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => { if (type === 'abort') listeners.add(listener); add(type, listener, options) }
    signal.removeEventListener = (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) => { if (type === 'abort') listeners.delete(listener); remove(type, listener, options) }
    const pending = f.measurement.prepareStartup(url, signal)
    const other = f.measurement.prepareStartup(url)
    let settlements = 0
    const outcome = pending.then(() => { settlements++; return { rejected: false, reason: undefined } }, reason => { settlements++; return { rejected: true, reason } })
    assert.equal(listeners.size, 1); assert.equal(f.probeSignals.length, 1)
    const reason = { tag: 'single-waiter' }
    if (timing === 'cancel') {
      controller.abort(reason)
      const caught = await outcome; assert.equal(caught.rejected, true); assert.strictEqual(caught.reason, reason)
      assert.equal(f.probeSignals[0]!.aborted, false, 'caller cancellation must not abort the shared probe')
      assert.equal(f.measurement.snapshot().startup?.state, 'running')
      f.complete()
    } else if (timing === 'reset') f.measurement.reset()
    else f.complete()
    await other; await outcome
    assert.equal(listeners.size, 0); assert.equal(settlements, 1)
    assert.equal(f.commits(), timing === 'reset' ? 0 : 1)
    controller.abort(reason); await Promise.resolve(); assert.equal(settlements, 1)
    assert.equal(f.clock.pendingCount, 0)
  })
}

test('BR-05 legacy signal without reason capability uses AbortError fallback', async t => {
  const f = fixture(t), controller = new AbortController(); controller.abort()
  const legacy = new Proxy(controller.signal, {
    has: (target, key) => key !== 'reason' && Reflect.has(target, key),
    get: (target, key) => { const value: unknown = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value },
  })
  await assert.rejects(f.measurement.prepareStartup(url, legacy), { name: 'AbortError' })
})
