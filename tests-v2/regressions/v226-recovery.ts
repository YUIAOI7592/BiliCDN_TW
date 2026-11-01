import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rescuePlayerFixture } from '../support/rescue-player.ts'

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
