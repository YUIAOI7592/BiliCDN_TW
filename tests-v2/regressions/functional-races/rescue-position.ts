import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rescuePlayerFixture as fixture } from '../../support/rescue-player.ts'
for (const rate of [1, 2]) {
  for (const source of ['stall', 'trusted-player-play'] as const)
    test(`U-I integration owned initialization restores goal source=${source} rate=${rate}`, (t) => {
      const f = fixture(t, rate),
        target = 978
      f.healthy()
      if (source === 'trusted-player-play') f.pause()
      f.key(target)
      if (source === 'stall')
        f.recovery.armStall(f.player.snapshot(), {
          id: 1,
          startedAt: f.clock.now(),
          targetSec: target,
          valid: () => true,
        })
      else {
        f.dead(true)
        f.click()
      }
      f.returns.reload = () => {
        f.core(null)
        f.video().paused = true
        f.video().readyState = 0
        f.video().seeking = false
        f.video().currentTime = 0
      }
      f.advance(source === 'stall' ? 30_000 : 4000)
      assert.deepEqual(f.saved(), [target])
      f.tick()
      f.core({ state: { initialized: true }, getMpd: () => ({ video: [{}] }) })
      f.video().readyState = 4
      f.video().videoWidth = 1280
      f.video().videoHeight = 720
      f.site.seek(977)
      f.video().seeking = true
      f.video().dispatchEvent(new Event('seeking'))
      const before = f.effects.length
      f.tick()
      assert.equal(f.recovery.isRecovering(), true)
      assert.equal(f.effects.length, before, 'wait for initialization seeking to finish')
      f.video().seeking = false
      f.video().dispatchEvent(new Event('seeked'))
      f.returns.play = () => {
        f.video().paused = false
      }
      f.tick()
      assert.deepEqual(
        f.effects.slice(before).map((e) => [e.method, e.args[0]]),
        [
          ['seek', target],
          ['rate', rate],
          ['play', undefined],
        ],
      )
      for (let i = 0; i < 17; i++) {
        f.video().currentTime += rate
        f.video().frames += 30
        f.advance(1000)
        assert.equal(f.video().playbackRate, rate)
        assert.equal(f.video().paused, false)
        if (i >= 1) assert.equal(f.recovery.snapshot().state, 'recovered')
      }
      assert.equal(f.effects.filter((e) => e.method === 'reload').length, 1)
      assert.equal(f.effects.filter((e) => e.method === 'rate').length, 1)
      assert.equal(f.effects.filter((e) => e.method === 'play').length, 1)
    })
}
for (const rate of [1, 2]) {
  for (const [id, target, reset] of [
    ['I-P01', 2811.002824, true],
    ['I-P02', 2811.002824, false],
    ['I-P03', 0, true],
  ] as const)
    test(id + ' paused seek target=' + target + ' reset=' + reset + ' rate=' + rate, (t) => {
      const f = fixture(t, rate)
      f.healthy()
      f.pause()
      f.key(target)
      assert.equal(f.player.controls().targetSec, target)
      f.dead(reset)
      f.click()
      f.advance(4000)
      f.trace(id)
      assert.equal(f.effects.filter((e) => e.method === 'reload').length, 1)
      assert.deepEqual(f.saved(), [target])
    })
  test('I-P04 latest A then B then reset rate=' + rate, (t) => {
    const f = fixture(t, rate)
    f.healthy()
    f.pause()
    f.key(2000)
    f.key(2811.002824)
    assert.equal(f.player.controls().targetSec, 2811.002824)
    f.dead(true)
    f.click()
    f.advance(4000)
    f.trace('I-P04')
    assert.deepEqual(f.saved(), [2811.002824])
  })
  test('I-P05 completed target is not a permanent restore target rate=' + rate, (t) => {
    const f = fixture(t, rate)
    f.healthy()
    f.key(2000)
    f.video().seeking = false
    f.video().dispatchEvent(new Event('seeked'))
    for (let i = 0; i < 3; i++) {
      f.video().currentTime += rate
      f.video().frames += 30
      f.advance(1000)
    }
    f.video().currentTime = 2100
    f.video().frames += 30
    f.advance(1000)
    f.pause()
    f.dead(false)
    f.click()
    f.advance(4000)
    f.trace('I-P05')
    assert.deepEqual(f.saved(), [2100])
  })
  for (const invalidation of ['media', 'lifecycle', 'unknown-position'] as const)
    test('I-P06 old target invalidation=' + invalidation + ' rate=' + rate, (t) => {
      const f = fixture(t, rate)
      f.healthy()
      f.pause()
      f.key(2811)
      if (invalidation === 'unknown-position') {
        const revision = f.player.controls().userRevision
        f.video().seeking = false
        f.video().readyState = 0
        f.video().currentTime = 400
        f.tick()
        assert.equal(f.player.controls().userRevision, revision)
        f.dead(false)
        f.click()
        f.advance(4000)
        assert.deepEqual(f.saved(), [400])
      } else {
        if (invalidation === 'media') f.replaceVideo()
        else f.lifecycle()
        f.recovery.reset()
        f.player.reset()
        f.video().seeking = false
        f.video().paused = false
        f.video().currentTime = 120
        f.video().readyState = 4
        f.healthy()
        f.pause()
        f.dead(false)
        f.click()
        f.advance(4000)
        assert.deepEqual(f.saved(), [121])
      }
      f.trace('I-P06/' + invalidation)
    })
}
