import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rescuePlayerFixture } from '../../support/rescue-player.ts'

for (const rate of [1, 2])
  for (const change of ['seek', 'pause', 'rate', 'hidden', 'policy'] as const)
    test(`SR1-I01 SDK rate rejection preserves newer ${change} and stops play rate=${rate}`, (t) => {
      const f = rescuePlayerFixture(t, rate),
        newer = rate === 1 ? 2 : 1
      let valid = true
      f.site.setPlaybackRate = () => {
        if (change === 'seek') f.key(555)
        if (change === 'pause') {
          f.pointer()
          f.video().paused = true
        }
        if (change === 'rate') f.pointer()
        if (change === 'hidden') f.visible(false)
        if (change === 'policy') valid = false
        f.video().playbackRate = newer
        throw Error('synthetic-sdk-error')
      }
      f.healthy()
      f.recovery.armStall(f.player.snapshot(), {
        id: 1,
        startedAt: f.clock.now(),
        targetSec: f.video().currentTime,
        reloadAfterMs: 12000,
        valid: () => valid,
      })
      f.returns.reload = () => {
        f.core(null)
        Object.assign(f.video(), {
          paused: true,
          currentTime: 0,
          readyState: 0,
          videoWidth: 0,
          videoHeight: 0,
        })
      }
      f.advance(12000)
      f.tick()
      f.core({ state: { initialized: true }, getMpd: () => ({ video: [{}] }) })
      Object.assign(f.video(), { readyState: 4, videoWidth: 1280, videoHeight: 720 })
      f.tick()
      assert.equal(f.video().playbackRate, newer)
      assert.equal(f.effects.filter((e) => e.method === 'play').length, 0)
      assert.equal(f.recovery.isRecovering(), false)
    })
