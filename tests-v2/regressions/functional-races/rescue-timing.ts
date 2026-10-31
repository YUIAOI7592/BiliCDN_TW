import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { PlayerMonitor } from '../../../src-v2/application/player-monitor.ts'
import { RecoveryController } from '../../../src-v2/application/recovery-controller.ts'
import type { StallRecoveryIntent } from '../../../src-v2/application/recovery-contracts.ts'
import type {
  PlayerPort,
  VideoSnapshot,
  PlayerControlSnapshot,
} from '../../../src-v2/application/ports.ts'
import { epochId, generationId, representationId } from '../../../src-v2/domain/model.ts'
import { FakeClock } from '../../support/clock.ts'
import { testScope } from '../../support/scope.ts'
import { currentResumePlayer, idleControls } from '../../support/player.ts'
import { monitorRoutes, monitorMeasurement, monitorRecovery } from '../../support/controllers.ts'

function fixture(t: TestContext, rate: number, realRecovery: boolean) {
  const scope = testScope(t),
    clock = new FakeClock(),
    rep = representationId('video:rescue')
  let video: VideoSnapshot = {
      available: true,
      paused: false,
      seeking: false,
      ended: false,
      readyState: 4,
      currentTime: 120,
      duration: 3910,
      width: 1280,
      height: 720,
      playbackRate: rate,
      effectiveRate: rate,
      bufferAheadSec: 10,
      playableBufferSec: 10,
      bufferedToEnd: false,
      frames: 100,
      mediaError: false,
      coreInitialized: true,
      manifestHasVideo: true,
    },
    controls = idleControls(),
    active = false
  const effects: string[] = [],
    intents: StallRecoveryIntent[] = []
  const player = currentResumePlayer({
    snapshot: () => video,
    controls: () => controls,
    currentTime: () => video.currentTime,
    playbackRate: () => rate,
    syncManifest: () => true,
    reset() {},
    observePlayIntent: () => () => undefined,
    reload() {
      effects.push('reload')
      video = { ...video, readyState: 0, width: 0, height: 0, coreInitialized: false }
    },
    seek() {
      effects.push('seek')
    },
    setRate() {
      effects.push('rate')
    },
    play() {
      effects.push('play')
    },
  } satisfies PlayerPort)
  const recovery = realRecovery ? new RecoveryController(player, clock.now) : null
  const port =
    recovery ??
    monitorRecovery({
      armStall: (intentSnapshot) => {
        void intentSnapshot
      },
      isRecovering: () => active,
    })
  if (!recovery) {
    port.armStall = (_snapshot, intent) => {
      effects.push('arm')
      intents.push(intent)
      active = true
    }
    port.cancelStall = () => {
      active = false
    }
  }
  const monitor = new PlayerMonitor(
    player,
    {
      get: () => ({
        generation: generationId(1),
        epoch: epochId(0),
        representation: rep,
        affinity: null,
        disabled: false,
        recovering: false,
        lastDecisionId: null,
      }),
    },
    { get: () => ({ disabled: false }) },
    { groupSummary: () => null },
    monitorRoutes({
      latestRequested: () => ({
        generation: generationId(1),
        epoch: epochId(0),
        representation: rep,
        targetHost: 'upos-sz-mirrorali.bilivideo.com',
        routePolicyRevision: 0,
        authorityRevision: 1,
      }),
      recoveryEligible: () => true,
      recover() {
        effects.push('fallback')
        recovery?.armRouteFailure('route-failure', video)
      },
    }),
    monitorMeasurement(),
    port,
    () => true,
    clock.now,
    clock,
  )
  scope.defer(() => {
    monitor.dispose()
    recovery?.dispose()
    assert.equal(clock.pendingCount, 0)
    clock.dispose()
  })
  monitor.tick()
  clock.advance(1000)
  video = { ...video, currentTime: 120 + rate, frames: 130 }
  monitor.tick()
  const start = clock.now()
  const tick = () => monitor.tick(),
    advance = (ms: number) => {
      clock.advance(ms)
      tick()
    }
  return {
    monitor,
    recovery,
    clock,
    effects,
    intents,
    start,
    tick,
    advance,
    set: (patch: Partial<VideoSnapshot>) => {
      video = { ...video, ...patch }
    },
    controls: (patch: Partial<PlayerControlSnapshot>) => {
      controls = { ...controls, ...patch }
    },
    fallback: () => {
      effects.push('fallback')
      recovery?.armRouteFailure('route-failure', video)
    },
  }
}
for (const rate of [1, 2]) {
  test(`I-T05 later dead-core route intent retains its four-second deadline rate=${rate}`, (t) => {
    const f = fixture(t, rate, true)
    f.tick()
    f.advance(5000)
    f.set({ readyState: 0, width: 0, height: 0, coreInitialized: false })
    f.fallback()
    f.advance(1000)
    f.advance(2999)
    assert.equal(f.effects.filter((effect) => effect === 'reload').length, 0)
    f.advance(1)
    assert.equal(f.effects.filter((effect) => effect === 'reload').length, 1)
    assert.equal(f.effects.filter((effect) => effect === 'fallback').length, 1)
  })
  test(`U-T02 ordinary stall fallback at 5999/6000 rate=${rate}`, (t) => {
    const f = fixture(t, rate, false)
    f.tick()
    f.advance(5999)
    assert.deepEqual(f.effects, [])
    f.advance(1)
    assert.deepEqual(f.effects, ['arm', 'fallback'])
    assert.equal(f.intents[0]?.startedAt, f.start)
    assert.equal(f.intents[0]?.reloadAfterMs, 12000)
  })
  for (const pending of [false, true])
    test(`U-T03 long seek grace 14999/15000 pending=${pending} rate=${rate}`, (t) => {
      const f = fixture(t, rate, false)
      f.set({ seeking: !pending })
      f.controls({ pendingSeekGoal: pending })
      f.tick()
      f.advance(14999)
      assert.deepEqual(f.effects, [])
      f.advance(1)
      assert.deepEqual(f.effects, ['arm', 'fallback'])
      assert.equal(f.intents[0]?.reloadAfterMs, 30000)
    })
  test(`U-T04 promotion keeps original start and never downgrades rate=${rate}`, (t) => {
    const f = fixture(t, rate, false)
    f.tick()
    f.advance(5000)
    f.set({ seeking: true })
    f.tick()
    f.advance(1000)
    assert.deepEqual(f.effects, [])
    f.set({ seeking: false })
    f.advance(9000)
    assert.deepEqual(f.effects, ['arm', 'fallback'])
    assert.equal(f.intents[0]?.startedAt, f.start)
    assert.equal(f.intents[0]?.reloadAfterMs, 30000)
  })
  test(`U-T05 short pause in progress does not trigger fallback rate=${rate}`, (t) => {
    const f = fixture(t, rate, false)
    f.tick()
    f.advance(5999)
    f.set({ currentTime: 121 + rate, frames: 160 })
    f.tick()
    f.advance(1)
    assert.deepEqual(f.effects, [])
  })
  test(`I-T01 ordinary 6/12/15 ends once at 27000 rate=${rate}`, (t) => {
    const f = fixture(t, rate, true)
    f.tick()
    f.advance(5999)
    assert.deepEqual(f.effects, [])
    f.advance(1)
    assert.deepEqual(f.effects, ['fallback'])
    f.advance(5999)
    assert.equal(
      f.effects.some((effect) => effect === 'reload'),
      false,
    )
    f.advance(1)
    assert.deepEqual(f.effects, ['fallback', 'reload'])
    f.advance(14999)
    assert.equal(f.recovery?.isRecovering(), true)
    f.advance(1)
    assert.equal(f.recovery?.snapshot().reason, 'reload-timeout')
    for (let i = 0; i < 120; i++) f.advance(1000)
    assert.deepEqual(f.effects, ['fallback', 'reload'])
  })
  test(`I-T02 early transport fallback shares episode and reload quota rate=${rate}`, (t) => {
    const f = fixture(t, rate, true)
    f.tick()
    f.advance(1000)
    f.fallback()
    f.tick()
    f.advance(5000)
    assert.equal(f.effects.filter((e) => e === 'fallback').length, 1)
    f.advance(6000)
    assert.equal(f.effects.filter((e) => e === 'reload').length, 1)
    assert.equal(f.recovery?.snapshot().reloadCount, 1)
  })
  test(`I-T03 already armed ordinary stall promotes without another fallback rate=${rate}`, (t) => {
    const f = fixture(t, rate, true)
    f.tick()
    f.advance(6000)
    f.set({ seeking: true })
    f.controls({ seekRevision: 1 })
    f.advance(1000)
    f.set({ seeking: false })
    f.advance(8000)
    assert.equal(f.effects.filter((e) => e === 'fallback').length, 1)
    f.advance(14999)
    assert.equal(f.effects.includes('reload'), false)
    f.advance(1)
    assert.equal(f.effects.filter((e) => e === 'reload').length, 1)
  })
  test(`I-T04 one-second scheduler bounds phase delay rate=${rate}`, (t) => {
    const f = fixture(t, rate, true)
    f.tick()
    f.clock.advance(250)
    f.monitor.start()
    f.clock.advance(5750)
    assert.deepEqual(f.effects, [])
    f.clock.advance(250)
    assert.deepEqual(f.effects, ['fallback'])
    f.clock.advance(6000)
    assert.deepEqual(f.effects, ['fallback', 'reload'])
    f.clock.advance(15000)
    assert.equal(f.recovery?.snapshot().reason, 'reload-timeout')
    assert.equal(f.clock.now() - f.start, 27250)
  })
  test(`I-COMP ordinary policy ${process.env.BR01_TIMING_BASELINE === '1' ? 'baseline-45' : 'current-27'} rate=${rate}`, (t) => {
    const f = fixture(t, rate, true),
      observed: Record<string, number> = {}
    f.tick()
    for (let i = 0; i < 60; i++) {
      f.advance(1000)
      if (f.effects.includes('fallback')) observed.fallback ??= f.clock.now() - f.start
      if (f.effects.includes('reload')) observed.reload ??= f.clock.now() - f.start
      if (f.recovery?.snapshot().reason === 'reload-timeout') {
        observed.terminal = f.clock.now() - f.start
        break
      }
    }
    console.log(JSON.stringify({ id: 'I-COMP', rate, observed }))
    assert.deepEqual(
      observed,
      process.env.BR01_TIMING_BASELINE === '1'
        ? { fallback: 15000, reload: 30000, terminal: 45000 }
        : { fallback: 6000, reload: 12000, terminal: 27000 },
    )
    assert.deepEqual(f.effects, ['fallback', 'reload'])
  })
}
