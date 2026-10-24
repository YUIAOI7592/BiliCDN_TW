import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PlayerControlObserver } from '../../src-v2/adapters/player-controls.ts'
import { rescueDomFixture } from '../support/rescue-dom.ts'

for (const rate of [1, 2]) {
  for (const mutation of [
    'pointer',
    'seek',
    'pause',
    'core',
    'video',
    'lifecycle',
    'hidden',
    'reset',
    'policy',
  ] as const)
    test(`SR1-U01 throwing SDK rate cannot overwrite newer ${mutation} rate=${rate}`, (t) => {
      const f = rescueDomFixture(t),
        observer = new PlayerControlObserver(f.sources, f.environment)
      let active = true
      const newer = rate === 1 ? 2 : 1
      f.scope.defer(() => {
        observer.reset()
        f.check()
      })
      observer.controls()
      f.site.setPlaybackRate = () => {
        if (mutation === 'pointer') f.pointer()
        if (mutation === 'seek') f.key(555)
        if (mutation === 'pause') {
          f.pointer()
          f.video().paused = true
        }
        if (mutation === 'core') f.core({ state: { initialized: true } })
        if (mutation === 'video') f.replaceVideo()
        if (mutation === 'lifecycle') f.lifecycle()
        if (mutation === 'hidden') f.visible(false)
        if (mutation === 'reset') observer.reset()
        if (mutation === 'policy') active = false
        f.video().playbackRate = newer
        throw Error('synthetic-sdk-error')
      }
      Reflect.apply(observer.setRate, observer, [rate, () => active])
      assert.equal(f.video().playbackRate, newer)
    })
  test(`SR1-U02 unchanged owner retains the existing native rate fallback rate=${rate}`, (t) => {
    const f = rescueDomFixture(t),
      observer = new PlayerControlObserver(f.sources, f.environment)
    f.scope.defer(() => {
      observer.reset()
      f.check()
    })
    observer.controls()
    f.site.setPlaybackRate = () => {
      throw Error('synthetic-sdk-error')
    }
    observer.setRate(rate)
    assert.equal(f.video().playbackRate, rate)
  })
  test(`SR1-U04 SDK method getter reentry prevents calling the stale method rate=${rate}`, (t) => {
    const f = rescueDomFixture(t),
      observer = new PlayerControlObserver(f.sources, f.environment)
    let calls = 0
    const newer = rate === 1 ? 2 : 1
    f.scope.defer(() => {
      observer.reset()
      f.check()
    })
    observer.controls()
    Object.defineProperty(f.site, 'setPlaybackRate', {
      configurable: true,
      get() {
        f.pointer()
        f.video().playbackRate = newer
        return () => {
          calls++
        }
      },
    })
    observer.setRate(rate)
    assert.equal(calls, 0)
    assert.equal(f.video().playbackRate, newer)
  })
}

test('SR1-U03 missing SDK seek getter cannot change owner then write old native position', (t) => {
  const f = rescueDomFixture(t),
    observer = new PlayerControlObserver(f.sources, f.environment)
  f.scope.defer(() => {
    observer.reset()
    f.check()
  })
  observer.controls()
  Object.defineProperty(f.site, 'seek', {
    configurable: true,
    get() {
      f.pointer()
      f.video().currentTime = 555
      return undefined
    },
  })
  observer.seek(121)
  assert.equal(f.video().currentTime, 555)
})
