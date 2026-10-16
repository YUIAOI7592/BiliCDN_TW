import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { PlayerControlObserver } from '../../../src-v2/adapters/player-controls.ts'
import { VisibilityAdapter } from '../../../src-v2/adapters/visibility.ts'
import { rescueDomFixture } from '../../support/rescue-dom.ts'

function fixture(t: TestContext, rate: number) {
  const f = rescueDomFixture(t)
  f.video().playbackRate = rate
  const observer = new PlayerControlObserver(f.sources, f.environment)
  f.scope.defer(() => {
    observer.reset()
    f.check()
  })
  observer.controls()
  const capture = () => observer.captureResumePosition(() => f.video().currentTime)
  const resetMedia = () => {
    f.video().seeking = false
    f.video().readyState = 0
    f.video().currentTime = 0
    observer.controls()
  }
  return { ...f, observer, capture, resetMedia }
}

for (const target of ['descendant', 'window'] as const)
  test(`U-V01 visibility guard ${target} blur notifies only actual window loss`, (t) => {
    const f = rescueDomFixture(t)
    class Document {
      get hidden() {
        return false
      }
      get visibilityState() {
        return 'visible'
      }
    }
    f.scope.defineGlobal('Document', { configurable: true, value: Document })
    const visibility = new VisibilityAdapter()
    let notifications = 0
    const stop = visibility.subscribeControlLoss(() => {
      notifications++
    })
    visibility.install()
    f.scope.defer(() => {
      stop()
      visibility.dispose()
      f.check()
    })
    const event = new f.Input('blur', f.button)
    if (target === 'window') Object.defineProperty(event, 'target', { get: () => f.window })
    f.window.dispatchEvent(event)
    assert.equal(notifications, target === 'window' ? 1 : 0)
  })

for (const rate of [1, 2]) {
  test(`U-G08 unknown native movement while paused revokes pending goal rate=${rate}`, (t) => {
    const f = fixture(t, rate)
    f.video().paused = true
    f.key(978)
    f.video().seeking = false
    f.video().dispatchEvent(new Event('seeked'))
    const capture = f.capture()
    f.clock.advance(1000)
    f.video().currentTime = 978.5
    assert.equal(f.observer.validateResumePosition(capture), false)
  })
  for (const target of ['descendant', 'window'] as const)
    test(`U-G07 trusted ${target} blur has the correct loss boundary rate=${rate}`, (t) => {
      const f = fixture(t, rate)
      f.key(978)
      const before = f.capture(),
        event = new f.Input('blur', f.button)
      if (target === 'window') Object.defineProperty(event, 'target', { get: () => f.window })
      f.window.dispatchEvent(event)
      assert.equal(f.observer.validateResumePosition(before), target === 'descendant')
    })
  for (const target of [0, 2811.002824])
    test(`U-G01 finite trusted target ${target} survives loss reset rate=${rate}`, (t) => {
      const f = fixture(t, rate)
      f.key(target)
      const before = f.capture()
      f.resetMedia()
      const after = f.capture()
      assert.equal(after.positionSec, target)
      assert.notEqual(after.proof, null)
      assert.equal(after.proof, before.proof)
      assert.equal(f.observer.validateResumePosition(after), true)
      assert.equal(f.observer.controls().userRevision, 1)
    })
  test(`U-G02 latest B replaces A without duplicate observation rate=${rate}`, (t) => {
    const f = fixture(t, rate)
    f.key(2000)
    const a = f.capture()
    f.key(2811.002824)
    const b = f.capture()
    f.video().dispatchEvent(new Event('seeking'))
    assert.equal(f.capture().proof, b.proof)
    assert.equal(f.observer.controls().userRevision, 2)
    assert.equal(f.observer.validateResumePosition(a), false)
    f.resetMedia()
    assert.equal(f.capture().positionSec, 2811.002824)
  })
  test(`U-G03 pointer gesture captures actual target before release rate=${rate}`, (t) => {
    const f = fixture(t, rate),
      slider = new f.Element(['.bpx-player-progress-wrap'])
    slider.parentElement = f.region
    f.document.dispatchEvent(new f.Input('pointerdown', slider))
    f.video().currentTime = 978
    f.video().seeking = true
    f.video().dispatchEvent(new Event('seeking'))
    const before = f.capture()
    f.document.dispatchEvent(new f.Input('pointerup', slider))
    f.resetMedia()
    assert.equal(f.observer.controls().dragging, false)
    assert.equal(f.capture().positionSec, 978)
    assert.equal(f.capture().proof, before.proof)
  })
  test(`U-G04 play pointer explicitly hands off pending goal rate=${rate}`, (t) => {
    const f = fixture(t, rate)
    f.video().paused = true
    f.key(978)
    const before = f.capture()
    f.resetMedia()
    f.document.dispatchEvent(new f.Input('pointerdown', f.button))
    assert.equal(f.observer.controls().userRevision, 2)
    const after = f.capture()
    assert.equal(after.positionSec, 978)
    assert.equal(after.proof, before.proof)
  })
  for (const invalidation of [
    'unknown-sdk-seek',
    'unknown-native-position',
    'media',
    'core',
    'lifecycle',
    'control-loss',
    'reset',
    'new-pointer',
  ] as const)
    test(`U-G05 ${invalidation} revokes old goal rate=${rate}`, (t) => {
      const f = fixture(t, rate)
      f.key(978)
      const before = f.capture()
      if (invalidation === 'unknown-sdk-seek') f.site.seek(400)
      if (invalidation === 'unknown-native-position') {
        f.video().readyState = 0
        f.video().seeking = false
        f.video().currentTime = 400
      }
      if (invalidation === 'media') f.replaceVideo()
      if (invalidation === 'core') f.core({})
      if (invalidation === 'lifecycle') f.lifecycle()
      if (invalidation === 'control-loss') f.loss()
      if (invalidation === 'reset') f.observer.reset()
      if (invalidation === 'new-pointer') f.pointer()
      assert.equal(f.observer.validateResumePosition(before), false)
      assert.equal(f.capture().proof, null)
    })
  test(`U-G06 completed goal yields later current position rate=${rate}`, (t) => {
    const f = fixture(t, rate)
    f.key(978)
    f.video().seeking = false
    f.video().dispatchEvent(new Event('seeked'))
    for (let i = 0; i < 2; i++) {
      f.clock.advance(1000)
      f.video().currentTime += rate
      f.video().frames += 30
      f.observer.controls()
    }
    const after = f.capture()
    assert.equal(after.proof, null)
    assert.equal(after.positionSec, 978 + 2 * rate)
  })
  for (const invalidation of [
    'second-seek',
    'second-core',
    'new-user',
    'timeout',
    'stable-playback',
  ] as const)
    test(`U-I02 ${invalidation} cannot extend initialization exception rate=${rate}`, (t) => {
      const f = fixture(t, rate)
      f.key(978)
      const capture = f.capture()
      f.returns.reload = () => {
        f.core(null)
        f.video().paused = true
        f.video().seeking = false
        f.video().readyState = 0
        f.video().currentTime = 0
      }
      f.observer.reload()
      const revision = f.observer.controls().reloadRevision
      f.core({ state: { initialized: true } })
      f.video().readyState = 4
      if (invalidation === 'stable-playback') {
        f.video().paused = false
        f.observer.controls()
      }
      f.site.seek(977)
      f.video().seeking = true
      f.video().dispatchEvent(new Event('seeking'))
      if (invalidation !== 'stable-playback')
        assert.equal(f.observer.validateResumePosition(capture, revision), true)
      if (invalidation === 'second-seek') f.site.seek(976)
      if (invalidation === 'second-core') f.core({ state: { initialized: true } })
      if (invalidation === 'new-user') f.pointer()
      if (invalidation === 'timeout') f.clock.advance(15_000)
      assert.equal(f.observer.validateResumePosition(capture, revision), false)
    })
  test(`U-O03 native getter reentry cannot keep old proof rate=${rate}`, (t) => {
    const f = fixture(t, rate)
    f.key(978)
    const capture = f.capture()
    let pending = true
    Object.defineProperty(f.video(), 'currentTime', {
      configurable: true,
      get() {
        if (pending) {
          pending = false
          f.pointer()
        }
        return 978
      },
    })
    assert.equal(f.observer.validateResumePosition(capture), false)
    assert.equal(f.capture().proof, null)
  })
}
