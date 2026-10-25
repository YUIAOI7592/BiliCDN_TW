import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { rescuePlayerFixture } from '../../support/rescue-player.ts'
import { deferred } from '../../support/deferred.ts'
import { sustainedPlayback, type RescueProgressSample } from '../../support/rescue-acceptance.ts'

function fixture(
  t: TestContext,
  rate: number,
  fault: 'seek' | 'rate' | 'both' | 'none',
  zero = false,
) {
  const f = rescuePlayerFixture(t, rate),
    video = f.video()
  let position = video.currentTime,
    nativeRate = rate,
    target = NaN,
    playAt: number | null = null
  const writes: { kind: string; value: number }[] = [],
    calls = { seek: 0, rate: 0 }
  Object.defineProperty(video, 'currentTime', {
    configurable: true,
    get: () => position,
    set: (value: number) => {
      position = value
      writes.push({ kind: 'position', value })
    },
  })
  Object.defineProperty(video, 'playbackRate', {
    configurable: true,
    get: () => nativeRate,
    set: (value: number) => {
      nativeRate = value
      writes.push({ kind: 'rate', value })
    },
  })
  f.site.seek = function (...args: unknown[]) {
    calls.seek++
    if (fault !== 'seek' && fault !== 'both') video.currentTime = Number(args[0])
  }
  f.site.setPlaybackRate = function (value: number) {
    calls.rate++
    if (fault !== 'rate' && fault !== 'both') video.playbackRate = value
  }
  f.healthy()
  if (zero) {
    video.currentTime = 0
    f.tick()
  }
  target = video.currentTime
  f.recovery.armStall(f.player.snapshot(), {
    id: 1,
    startedAt: f.clock.now(),
    targetSec: target,
    reloadAfterMs: 12000,
    valid: () => true,
  })
  f.returns.reload = () => {
    f.core(null)
    Object.assign(video, {
      paused: true,
      currentTime: 0,
      playbackRate: rate === 1 ? 2 : 1,
      readyState: 0,
      videoWidth: 0,
      videoHeight: 0,
    })
  }
  f.advance(12000)
  f.tick()
  f.core({ state: { initialized: true }, getMpd: () => ({ video: [{}] }) })
  Object.assign(video, { readyState: 4, videoWidth: 1280, videoHeight: 720 })
  writes.length = 0
  f.returns.play = () => {
    video.paused = false
    playAt = f.clock.now()
  }
  const progress = () => {
    if (!video.paused && !video.seeking) {
      video.currentTime += video.playbackRate
      video.frames += 30
    }
    f.advance(1000)
  }
  const sample = (): RescueProgressSample => ({
    at: f.clock.now(),
    position: video.currentTime,
    frames: video.frames,
    rate: video.playbackRate,
    owner: 'same',
    paused: video.paused,
    seeking: video.seeking,
    ended: video.ended,
    error: !!video.error,
    reloadCount: f.recovery.snapshot().reloadCount,
  })
  return { ...f, calls, writes, target, progress, sample, playAt: () => playAt }
}

for (const rate of [1, 2]) {
  for (const fault of ['seek', 'rate', 'both', 'none'] as const)
    test(`SR2-I01 native verified restoration corrects ${fault} within six ticks and sustains fifteen seconds rate=${rate}`, (t) => {
      const f = fixture(t, rate, fault)
      f.tick()
      for (let i = 0; i < 6; i++) f.progress()
      assert.equal(f.recovery.snapshot().state, 'recovered')
      assert.equal(f.video().playbackRate, rate)
      assert.notEqual(f.playAt(), null)
      const expected = f.target + (rate * (f.clock.now() - f.playAt()!)) / 1000
      assert.ok(
        Math.abs(f.video().currentTime - expected) <= 0.000001,
        'actual native position must follow the saved target',
      )
      assert.deepEqual(f.calls, { seek: 1, rate: 1 })
      assert.equal(f.effects.filter((e) => e.method === 'play').length, 1)
      assert.equal(f.effects.filter((e) => e.method === 'reload').length, 1)
      assert.equal(f.writes.filter((w) => w.kind === 'position' && w.value === f.target).length, 1)
      assert.equal(f.writes.filter((w) => w.kind === 'rate' && w.value === rate).length, 1)
      const tail = [f.sample()],
        before = f.effects.length
      for (let i = 0; i < 15; i++) {
        f.progress()
        tail.push(f.sample())
      }
      assert.equal(sustainedPlayback(tail, rate), true)
      assert.equal(f.effects.length, before)
    })
  test(`SR2-I02 ignored seek at an already correct zero needs no native correction rate=${rate}`, (t) => {
    const f = fixture(t, rate, 'seek', true)
    f.tick()
    for (let i = 0; i < 6; i++) f.progress()
    assert.equal(f.recovery.snapshot().state, 'recovered')
    assert.equal(f.writes.filter((w) => w.kind === 'position' && w.value === 0).length, 0)
    assert.deepEqual(f.calls, { seek: 1, rate: 1 })
  })
  test(`SR2-I03 asynchronous seek does not permit early rate or play rate=${rate}`, async (t) => {
    const f = fixture(t, rate, 'seek'),
      pending = deferred<void>()
    f.site.seek = function () {
      f.video().seeking = true
      return pending.promise
    }
    f.tick()
    assert.equal(f.calls.rate, 0)
    assert.equal(f.effects.filter((e) => e.method === 'play').length, 0)
    f.advance(999)
    assert.equal(f.calls.rate, 0)
    f.video().currentTime = f.target
    f.video().seeking = false
    f.video().dispatchEvent(new Event('seeked'))
    pending.resolve()
    await Promise.resolve()
    await Promise.resolve()
    f.advance(1)
    for (let i = 0; i < 3; i++) f.progress()
    assert.equal(f.recovery.snapshot().state, 'recovered')
    assert.equal(f.video().playbackRate, rate)
  })
  test(`SR2-I04 ignored seek correction observes the 999/1000 ms boundary rate=${rate}`, (t) => {
    const f = fixture(t, rate, 'seek')
    f.tick()
    f.advance(999)
    assert.equal(f.writes.length, 0)
    assert.equal(f.calls.rate, 0)
    f.advance(1)
    assert.equal(f.writes.filter((w) => w.kind === 'position').length, 1)
    assert.equal(f.calls.rate, 1)
    assert.equal(f.effects.filter((e) => e.method === 'play').length, 1)
  })
  test(`SR2-I09 wrong speed after play cannot turn frame progress into recovered rate=${rate}`, (t) => {
    const f = fixture(t, rate, 'none')
    f.tick()
    f.video().playbackRate = rate === 1 ? 2 : 1
    f.progress()
    assert.equal(f.recovery.snapshot().state, 'failed')
    assert.equal(f.recovery.snapshot().reason, 'restore-mismatch')
    assert.equal(f.recovery.snapshot().restoration?.result, 'mismatch')
    assert.equal(f.effects.filter((e) => e.method === 'reload').length, 1)
  })
  for (const kind of ['position', 'rate'] as const) {
    test(`SR2-I05 ineffective native ${kind} correction is used once and expires rate=${rate}`, (t) => {
      const f = fixture(t, rate, kind === 'position' ? 'seek' : 'rate'),
        video = f.video()
      const key = kind === 'position' ? 'currentTime' : 'playbackRate'
      const before = Object.getOwnPropertyDescriptor(video, key)!
      let corrections = 0
      Object.defineProperty(video, key, {
        ...before,
        set() {
          corrections++
        },
      })
      f.tick()
      f.advance(1000)
      assert.equal(corrections, 1)
      assert.equal(f.effects.filter((e) => e.method === 'play').length, 0)
      f.advance(13_999)
      assert.equal(f.recovery.isRecovering(), true)
      f.advance(1)
      assert.equal(f.recovery.snapshot().reason, 'reload-timeout')
      for (let i = 0; i < 120; i++) f.advance(1000)
      assert.equal(corrections, 1)
      assert.equal(f.effects.filter((e) => e.method === 'reload').length, 1)
      assert.notEqual(f.recovery.snapshot().state, 'recovered')
    })
    test(`SR2-I06 new operation inside native ${kind} correction blocks later effects rate=${rate}`, (t) => {
      const f = fixture(t, rate, kind === 'position' ? 'seek' : 'rate'),
        video = f.video()
      const key = kind === 'position' ? 'currentTime' : 'playbackRate'
      const before = Object.getOwnPropertyDescriptor(video, key)!
      Object.defineProperty(video, key, {
        ...before,
        set(value: number) {
          before.set!.call(video, value)
          f.pointer()
        },
      })
      f.tick()
      f.advance(1000)
      assert.equal(f.effects.filter((e) => e.method === 'play').length, 0)
      if (kind === 'position') assert.equal(f.calls.rate, 0)
      assert.equal(f.recovery.isRecovering(), false)
    })
  }
  test(`SR2-I07 pending SDK seek cannot force a native write or survive reset rate=${rate}`, async (t) => {
    const f = fixture(t, rate, 'seek'),
      pending = deferred<void>()
    f.site.seek = () => pending.promise
    f.tick()
    f.advance(1000)
    f.advance(5000)
    assert.deepEqual(f.writes, [])
    assert.equal(f.calls.rate, 0)
    f.recovery.reset()
    pending.reject(new Error('old SDK work'))
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(f.recovery.snapshot().state, 'healthy')
    f.advance(1000)
    assert.deepEqual(f.writes, [])
    assert.equal(f.effects.filter((e) => e.method === 'play').length, 0)
    assert.equal(f.recovery.isRecovering(), false)
  })
  for (const value of [NaN, Infinity])
    test(`SR2-I08 unknown native ${String(value)} cannot acknowledge restoration rate=${rate}`, (t) => {
      const f = fixture(t, rate, 'seek'),
        video = f.video()
      Object.defineProperty(video, 'currentTime', {
        configurable: true,
        get: () => value,
        set() {
          throw Error('unknown cannot authorize a write')
        },
      })
      f.tick()
      f.advance(1000)
      assert.equal(f.calls.rate, 0)
      assert.equal(f.effects.filter((e) => e.method === 'play').length, 0)
      assert.notEqual(f.recovery.snapshot().state, 'recovered')
    })
}
