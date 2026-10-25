import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { PlayerControlObserver } from '../../src-v2/adapters/player-controls.ts'
import { rescueDomFixture } from '../support/rescue-dom.ts'
import { deferred } from '../support/deferred.ts'

function fixture(t: TestContext) {
  const f = rescueDomFixture(t),
    observer = new PlayerControlObserver(f.sources, f.environment)
  f.scope.defer(() => {
    observer.reset()
    f.check()
  })
  observer.controls()
  observer.reload()
  const guard = {
    reloadRevision: observer.controls().reloadRevision,
    valid: () => true,
    now: f.clock.now,
  }
  return { ...f, observer, guard }
}

for (const rate of [1, 2]) {
  test(`SR2-U01 native readback confirms the actual SDK landing and detached proof rate=${rate}`, (t) => {
    const f = fixture(t),
      result = { sdkResult: true }
    f.returns.seek = () => result
    const attempt = f.observer.performRestore(
      { kind: 'position', value: 600.25, at: f.clock.now() },
      f.guard,
    )
    const reading = f.observer.readRestore(attempt)
    assert.equal(reading.positionSec, 600.25)
    assert.equal(reading.landing?.positionSec, 600.25)
    assert.equal(reading.channel, 'sdk')
    assert.equal(f.effects.find((e) => e.method === 'seek')?.receiver, f.site)
    assert.deepEqual(f.effects.find((e) => e.method === 'seek')?.args, [600.25])
    assert.equal(f.observer.readRestore({ ...attempt, proof: {} }).owned, false)
    f.video().playbackRate = rate
    assert.equal(f.observer.readRestore(attempt).rate, rate)
  })
  test(`SR2-U02 throwing SDK rate uses the same single native channel rate=${rate}`, (t) => {
    const f = fixture(t)
    f.site.setPlaybackRate = () => {
      throw Error('SDK unavailable')
    }
    const attempt = f.observer.performRestore(
      { kind: 'rate', value: rate, at: f.clock.now() },
      f.guard,
    )
    assert.equal(f.observer.readRestore(attempt).channel, 'native')
    const old = Object.getOwnPropertyDescriptor(f.video(), 'playbackRate')!
    let extra = 0
    Object.defineProperty(f.video(), 'playbackRate', { ...old, value: rate, writable: false })
    // Repeated correction cannot re-enter a native channel already consumed.
    f.observer.correctRestore(attempt)
    extra = f.video().playbackRate
    assert.equal(extra, rate)
  })
  for (const value of ['throw', 'NaN', 'Infinity'] as const)
    test(`SR2-U03 unavailable native position ${value} remains unknown rate=${rate}`, (t) => {
      const f = fixture(t)
      const attempt = f.observer.performRestore(
        { kind: 'rate', value: rate, at: f.clock.now() },
        f.guard,
      )
      Object.defineProperty(f.video(), 'currentTime', {
        configurable: true,
        get() {
          if (value === 'throw') throw Error('unreadable')
          return value === 'NaN' ? NaN : Infinity
        },
      })
      const reading = f.observer.readRestore(attempt)
      assert.equal(reading.positionSec, null)
      assert.equal(reading.landing, null)
    })
  for (const change of ['pointer', 'core', 'content', 'hidden', 'reset'] as const)
    test(`SR2-U04 native correction cannot retain an obsolete ${change} owner rate=${rate}`, (t) => {
      const f = fixture(t)
      f.site.setPlaybackRate = () => undefined
      f.video().playbackRate = rate === 1 ? 2 : 1
      const attempt = f.observer.performRestore(
        { kind: 'rate', value: rate, at: f.clock.now() },
        f.guard,
      )
      if (change === 'pointer') f.pointer()
      if (change === 'core') f.core({ state: { initialized: true } })
      if (change === 'content') f.lifecycle()
      if (change === 'hidden') f.visible(false)
      if (change === 'reset') f.observer.reset()
      f.observer.correctRestore(attempt)
      assert.equal(f.video().playbackRate, rate === 1 ? 2 : 1)
      assert.equal(f.observer.readRestore(attempt).owned, false)
    })
  test(`SR2-U05 pending SDK seek cannot absorb a different unknown seek rate=${rate}`, async (t) => {
    const f = fixture(t),
      pending = deferred<void>()
    f.site.seek = () => pending.promise
    const before = f.observer.controls()
    const attempt = f.observer.performRestore(
      { kind: 'position', value: 600, at: f.clock.now() },
      f.guard,
    )
    f.video().currentTime = 300
    f.video().seeking = true
    f.video().dispatchEvent(new Event('seeking'))
    assert.ok(f.observer.controls().seekRevision > before.seekRevision)
    assert.equal(f.observer.readRestore(attempt).owned, false)
    pending.reject(Error('stale SDK rejection'))
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(f.video().currentTime, 300)
  })
}
