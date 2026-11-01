import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rescuePlayerFixture } from '../support/rescue-player.ts'
import { rescueDomFixture } from '../support/rescue-dom.ts'
import { PlayerControlObserver } from '../../src-v2/adapters/player-controls.ts'

test('V226 R06: unavailable reload closes without consuming the committed reload quota', (t) => {
  const f = rescuePlayerFixture(t, 1)
  f.healthy()
  f.recovery.armRouteFailure('route-failure', f.player.snapshot())
  Reflect.set(f.site, 'reload', undefined)
  f.dead(false)
  f.advance(4000)
  assert.equal(f.recovery.snapshot().reason, 'reload-unavailable')
  assert.equal(f.recovery.snapshot().reloadCount, 0)
  f.advance(30_000)
  assert.equal(f.effects.filter((e) => e.method === 'reload').length, 0)
})

test('V226 R09: saved playback rate prefers the valid native rate over an SDK cache', (t) => {
  const f = rescuePlayerFixture(t, 1)
  f.site.getPlaybackRate = () => 2
  assert.equal(f.player.playbackRate(), 1)
  f.healthy()
  f.recovery.armRouteFailure('route-failure', f.player.snapshot())
  f.dead(false)
  f.advance(4000)
  assert.equal(f.recovery.snapshot().savedRate, 1)
})

for (const at of ['validation', 'commit'] as const)
  test(`V226 R06: a prepared reload rejects unknown SDK seek reentry at=${at}`, (t) => {
    const f = rescueDomFixture(t),
      observer = new PlayerControlObserver(f.sources, f.environment)
    f.scope.defer(() => {
      observer.reset()
      f.check()
    })
    observer.controls()
    const prepared = observer.prepareReload()!
    assert.ok(prepared)
    let entered = false,
      commits = 0
    const seek = () => {
      if (!entered) {
        entered = true
        f.site.seek(777)
      }
    }
    if (at === 'validation') {
      const core = f.site.__core
      f.site.__core = () => {
        seek()
        return core()
      }
    }
    assert.throws(
      () =>
        prepared.dispatch(() => {
          commits++
          if (at === 'commit') seek()
          return true
        }),
      /ownership ended/,
    )
    assert.equal(f.effects.filter((e) => e.method === 'reload').length, 0)
    assert.equal(f.video().currentTime, 777)
    if (at === 'validation') assert.equal(commits, 0)
  })
