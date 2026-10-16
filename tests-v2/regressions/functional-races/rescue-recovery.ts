import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { RecoveryController } from '../../../src-v2/application/recovery-controller.ts'
import type { RecoveryPlayerPort } from '../../../src-v2/application/recovery-ports.ts'
import type { VideoSnapshot } from '../../../src-v2/application/ports.ts'
import { FakeClock } from '../../support/clock.ts'
import { testScope } from '../../support/scope.ts'
import { idleControls } from '../../support/player.ts'
import { deferred } from '../../support/deferred.ts'

function fixture(t: TestContext, rate: number, target = 978) {
  const scope = testScope(t),
    clock = new FakeClock()
  let controls = idleControls(),
    active = true,
    valid = true,
    initialization = true
  let video: VideoSnapshot = {
    available: true,
    paused: false,
    seeking: false,
    ended: false,
    readyState: 4,
    currentTime: target,
    duration: 3910,
    width: 1280,
    height: 720,
    playbackRate: rate,
    effectiveRate: rate,
    bufferAheadSec: 0,
    playableBufferSec: 0,
    bufferedToEnd: false,
    frames: 100,
    mediaError: false,
    coreInitialized: true,
    manifestHasVideo: true,
  }
  const effects: { method: string; value?: number }[] = [],
    proof = Object.freeze({})
  const reads = { position: 0, rate: 0 }
  const on: Partial<
    Record<'capture' | 'rate' | 'snapshot' | 'reload' | 'seek' | 'setRate' | 'play', () => void>
  > = {}
  const returns = { reload: (): unknown => undefined, play: (): unknown => undefined }
  const player = {
    controls: () => controls,
    snapshot: () => {
      on.snapshot?.()
      return video
    },
    currentTime: () => video.currentTime,
    captureResumePosition: () => {
      reads.position++
      on.capture?.()
      return { positionSec: target, proof }
    },
    validateResumePosition: (capture, revision) =>
      valid &&
      capture.proof === proof &&
      (revision === undefined || (initialization && revision === controls.reloadRevision)),
    playbackRate: () => {
      reads.rate++
      on.rate?.()
      return rate
    },
    observePlayIntent: () => () => undefined,
    ownedReload: (revision) => revision === controls.reloadRevision,
    reload() {
      effects.push({ method: 'reload' })
      controls = {
        ...controls,
        coreId: 2,
        reloadRevision: controls.reloadRevision + 1,
        coreReloadRevision: controls.reloadRevision + 1,
      }
      on.reload?.()
      return returns.reload()
    },
    seek(value) {
      effects.push({ method: 'seek', value })
      video = { ...video, currentTime: value }
      on.seek?.()
    },
    setRate(value) {
      effects.push({ method: 'rate', value })
      video = { ...video, playbackRate: value }
      on.setRate?.()
    },
    play() {
      effects.push({ method: 'play' })
      on.play?.()
      return returns.play()
    },
  } satisfies RecoveryPlayerPort
  const recovery = new RecoveryController(player, clock.now, () => active)
  scope.defer(() => {
    recovery.dispose()
    assert.equal(clock.pendingCount, 0)
    clock.dispose()
  })
  const tick = () => recovery.tick(video),
    advance = (ms: number) => {
      clock.advance(ms)
      tick()
    }
  tick()
  const begin = () => recovery.armRouteFailure('route-failure', video)
  const dead = () => {
    video = { ...video, readyState: 0, width: 0, height: 0, coreInitialized: false }
  }
  const healthy = () => {
    video = { ...video, readyState: 4, width: 1280, height: 720, coreInitialized: true }
  }
  return {
    recovery,
    effects,
    reads,
    on,
    returns,
    tick,
    advance,
    begin,
    dead,
    healthy,
    user: () => {
      controls = { ...controls, userRevision: controls.userRevision + 1 }
    },
    set: (patch: Partial<VideoSnapshot>) => {
      video = { ...video, ...patch }
    },
    active: (value: boolean) => {
      active = value
    },
    valid: (value: boolean) => {
      valid = value
    },
    initialization: (value: boolean) => {
      initialization = value
    },
  }
}

for (const rate of [1, 2]) {
  for (const target of [0, 2811.002824])
    test(`U-R01 captured position ${target} and rate read once rate=${rate}`, (t) => {
      const f = fixture(t, rate, target)
      f.begin()
      f.dead()
      f.advance(3999)
      assert.deepEqual(f.reads, { position: 1, rate: 1 })
      assert.deepEqual(f.effects, [])
      f.advance(1)
      f.healthy()
      f.tick()
      assert.deepEqual(f.effects, [
        { method: 'reload' },
        { method: 'seek', value: target },
        { method: 'rate', value: rate },
        { method: 'play' },
      ])
      assert.equal(f.recovery.snapshot().savedPositionSec, target)
    })
  for (const boundary of ['capture', 'rate', 'snapshot'] as const)
    for (const operation of ['user', 'reset', 'inactive', 'proof'] as const)
      test(`U-O01 ${boundary} ${operation} reentry rejects stale intent rate=${rate}`, (t) => {
        const f = fixture(t, rate)
        let done = false
        f.on[boundary] = () => {
          if (done) return
          done = true
          if (operation === 'user') f.user()
          if (operation === 'reset') f.recovery.reset()
          if (operation === 'inactive') f.active(false)
          if (operation === 'proof') f.valid(false)
        }
        f.begin()
        f.dead()
        f.advance(4000)
        assert.equal(f.recovery.isRecovering(), false)
        assert.deepEqual(f.effects, [])
      })
  for (const boundary of ['reload', 'seek', 'setRate', 'play'] as const)
    test(`U-O02 new operation inside ${boundary} blocks later effects rate=${rate}`, (t) => {
      const f = fixture(t, rate)
      f.on[boundary] = f.user
      f.begin()
      f.dead()
      f.advance(4000)
      f.healthy()
      f.tick()
      const expected = ['reload', 'seek', 'rate', 'play'].slice(
        0,
        ['reload', 'seek', 'setRate', 'play'].indexOf(boundary) + 1,
      )
      assert.deepEqual(
        f.effects.map((e) => e.method),
        expected,
      )
      f.tick()
      assert.equal(f.recovery.isRecovering(), false)
    })
  test(`U-I01 unknown initialization seek remains canceled rate=${rate}`, (t) => {
    const f = fixture(t, rate)
    f.begin()
    f.dead()
    f.advance(4000)
    f.initialization(false)
    f.set({ seeking: true })
    f.healthy()
    f.tick()
    assert.equal(f.recovery.snapshot().reason, 'seek-interrupted')
    assert.deepEqual(f.effects, [{ method: 'reload' }])
  })
  test(`U-T01 reload terminal deadline 14999/15000 does not retry rate=${rate}`, (t) => {
    const f = fixture(t, rate)
    f.begin()
    f.dead()
    f.advance(4000)
    f.advance(14999)
    assert.equal(f.recovery.isRecovering(), true)
    f.advance(1)
    assert.equal(f.recovery.snapshot().reason, 'reload-timeout')
    for (let i = 0; i < 120; i++) f.advance(1000)
    assert.deepEqual(f.effects, [{ method: 'reload' }])
  })
  for (const method of ['reload', 'play'] as const)
    for (const completion of ['resolve', 'reject'] as const)
      test(`U-A01 late ${method} ${completion} after reset is inert rate=${rate}`, async (t) => {
        const f = fixture(t, rate),
          pending = deferred<unknown>()
        f.returns[method] = () => pending.promise
        f.begin()
        f.dead()
        f.advance(4000)
        if (method === 'play') {
          f.healthy()
          f.tick()
        }
        f.recovery.reset()
        const before = f.recovery.snapshot(),
          count = f.effects.length
        if (completion === 'resolve') pending.resolve(undefined)
        else pending.reject(Error('synthetic rejection'))
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
        assert.deepEqual(f.recovery.snapshot(), before)
        assert.equal(f.effects.length, count)
      })
}
