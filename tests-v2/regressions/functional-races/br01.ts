import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { PlayerMonitor } from '../../../src-v2/application/player-monitor.ts'
import { RecoveryController } from '../../../src-v2/application/recovery-controller.ts'
import type { PlayerPort, VideoSnapshot, PlayerControlSnapshot } from '../../../src-v2/application/ports.ts'
import { representationId, generationId, epochId } from '../../../src-v2/domain/model.ts'
import { FakeClock } from '../../support/clock.ts'
import { testScope } from '../../support/scope.ts'
import { monitorRoutes, monitorMeasurement } from '../../support/controllers.ts'
import { deferred } from '../../support/deferred.ts'

function fixture(t: TestContext) {
  const scope = testScope(t), clock = scope.own(new FakeClock())
  let video: VideoSnapshot = { available: true, paused: false, seeking: false, ended: false, readyState: 4,
    currentTime: 120, duration: 3910, width: 3840, height: 2160, playbackRate: 2, effectiveRate: 2,
    bufferAheadSec: 60, playableBufferSec: 30, bufferedToEnd: false, frames: 100, mediaError: false,
    coreInitialized: true, manifestHasVideo: true }
  const effects = { fallbacks: 0, reloads: 0, seeks: [] as number[], plays: 0 }
  let controls = idleControls(), visible = true, disabled = false, eligible = true, representation = representationId('video:fixture')
  let onReload: () => unknown = () => undefined, onSeek: () => void = () => undefined, onPlay: () => unknown = () => undefined
  const player = { snapshot: () => video, currentTime: () => video.currentTime, playbackRate: () => video.playbackRate,
  controls: () => controls,
    syncManifest: () => true, reset() {}, observePlayIntent: () => () => {}, reload() { effects.reloads++; return onReload() },
    seek(value: number) { effects.seeks.push(value); onSeek() }, setRate() {}, play() { effects.plays++; return onPlay() } } satisfies PlayerPort
  const recovery = scope.own(new RecoveryController(player, clock.now, () => visible && !disabled))
  const monitor = scope.own(new PlayerMonitor(player, { get: () => ({ generation: generationId(1), epoch: epochId(0),
    representation: representationId('video:fixture'), affinity: null, disabled: false, recovering: false, lastDecisionId: null }) },
    { get: () => ({ disabled }) }, { groupSummary: () => ({ kind: 'video', bandwidth: 16_000_000, height: 2160, codec: 'hevc', routeCount: 1 }) },
    monitorRoutes({ latestRequested: () => ({ generation: generationId(1), epoch: epochId(0), representation,
      targetHost: 'upos-sz-mirrorali.bilivideo.com', routePolicyRevision: 0, authorityRevision: 1 }), recoveryEligible: () => eligible,
      recover() { effects.fallbacks++; recovery.armRouteFailure('watchdog', video) } }),
    monitorMeasurement(), recovery, () => visible, clock.now, clock))
  scope.defer(() => recovery.reset())
  const set = (patch: Partial<VideoSnapshot>) => { video = { ...video, ...patch } }
  const ticks = (count: number) => { for (let i = 0; i < count; i++) { clock.advance(1000); monitor.tick() } }
  monitor.tick(); set({ currentTime: 120.5, frames: 130 }); ticks(1)
  return { clock, monitor, recovery, effects, set, ticks, video: () => video,
    controls: (patch: Partial<PlayerControlSnapshot>) => { controls = { ...controls, ...patch } },
    visible: (value: boolean) => { visible = value }, disabled: (value: boolean) => { disabled = value },
    eligible: (value: boolean) => { eligible = value }, representation: (value: string) => { representation = representationId(value) },
    onReload: (value: () => unknown) => { onReload = value }, onSeek: (value: () => void) => { onSeek = value },
    onPlay: (value: () => unknown) => { onPlay = value } }
}

function longSeek(t: TestContext) {
  const f = fixture(t)
  f.set({ seeking: true, currentTime: 978, readyState: 1, playableBufferSec: 0, bufferAheadSec: 0 })
  f.controls({ userRevision: 1, seekRevision: 1, targetSec: 978 }); f.monitor.tick()
  return f
}

test('BR-01 exact 15/30/15 boundaries perform one fallback, one reload and one terminal failure', t => {
  const f = longSeek(t)
  f.clock.advance(14_999); f.monitor.tick(); assert.equal(f.effects.fallbacks, 0)
  f.clock.advance(1); f.monitor.tick(); assert.equal(f.effects.fallbacks, 1); assert.equal(f.effects.reloads, 0)
  f.clock.advance(14_999); f.monitor.tick(); assert.equal(f.effects.reloads, 0)
  f.clock.advance(1); f.monitor.tick(); assert.equal(f.effects.reloads, 1)
  f.clock.advance(14_999); f.monitor.tick(); assert.equal(f.recovery.isRecovering(), true)
  f.clock.advance(1); f.monitor.tick(); assert.equal(f.recovery.isRecovering(), false)
  assert.equal(f.recovery.snapshot().reason, 'reload-timeout')
  f.ticks(120); assert.equal(f.effects.reloads, 1); assert.equal(f.effects.fallbacks, 1)
})
test('BR-01 website target adjustments and Auto representation replacement retain the original deadline and budget', t => {
  const f = longSeek(t); f.ticks(10)
  f.set({ currentTime: 979 }); f.controls({ seekRevision: 2 }); f.monitor.tick()
  f.ticks(5); assert.equal(f.effects.fallbacks, 1)
  f.representation('video:auto-new-codec'); f.monitor.tick()
  f.ticks(15); assert.equal(f.effects.reloads, 1); assert.equal(f.effects.fallbacks, 1)
  f.set({ seeking: false, readyState: 3 }); f.monitor.tick(); assert.deepEqual(f.effects.seeks, [979])
})
test('BR-01 a new user seek starts a new grace period and cancels the old restore', t => {
  const f = longSeek(t); f.ticks(20)
  f.controls({ userRevision: 2, seekRevision: 2 }); f.set({ currentTime: 0 }); f.monitor.tick()
  f.ticks(10); assert.equal(f.effects.reloads, 0)
  f.ticks(20); assert.equal(f.effects.reloads, 1)
  f.set({ seeking: false, readyState: 3 }); f.monitor.tick(); assert.deepEqual(f.effects.seeks, [0])
})
test('BR-01 dragging and hidden time are excluded from the stall deadline', t => {
  const f = longSeek(t); f.controls({ dragging: true }); f.ticks(45)
  assert.equal(f.effects.reloads, 0); assert.equal(f.effects.fallbacks, 0)
  f.controls({ dragging: false }); f.monitor.tick(); f.ticks(14); assert.equal(f.effects.fallbacks, 0)
  f.visible(false); f.ticks(60); f.visible(true); f.monitor.tick(); f.ticks(14); assert.equal(f.effects.fallbacks, 0)
  f.ticks(1); assert.equal(f.effects.fallbacks, 1)
})
test('BR-01 policy revocation before the deadline terminates rescue without a reload', t => {
  const f = longSeek(t); f.ticks(15); f.eligible(false); f.ticks(60)
  assert.equal(f.effects.reloads, 0); assert.equal(f.recovery.isRecovering(), false)
})
test('BR-01 two genuine progressing samples are required after restore', t => {
  const f = longSeek(t); f.ticks(30); f.set({ seeking: false, readyState: 3 }); f.monitor.tick()
  assert.equal(f.recovery.snapshot().state, 'waiting')
  f.set({ currentTime: 979, frames: 160 }); f.ticks(1); assert.notEqual(f.recovery.snapshot().state, 'recovered')
  f.set({ currentTime: 980, frames: 190 }); f.ticks(1); assert.equal(f.recovery.snapshot().state, 'recovered')
})
test('BR-01 synchronous user input during restore prevents rate/play side effects', t => {
  const f = longSeek(t); f.ticks(30)
  f.onSeek(() => f.controls({ userRevision: 2, seekRevision: 2 }))
  f.set({ seeking: false, readyState: 3 }); f.monitor.tick()
  assert.equal(f.effects.plays, 0); assert.equal(f.recovery.isRecovering(), false)
})
test('BR-01 external core replacement invalidates a pending restore', t => {
  const f = longSeek(t); f.ticks(30); f.controls({ coreId: 2 }); f.set({ seeking: false, readyState: 3 }); f.monitor.tick()
  assert.deepEqual(f.effects.seeks, []); assert.equal(f.effects.plays, 0)
})
test('BR-01 pause or disable after reload cannot replay old intent', t => {
  const f = longSeek(t); f.ticks(30); f.set({ paused: true }); f.monitor.tick()
  f.disabled(true); f.set({ paused: false, seeking: false, readyState: 4 }); f.ticks(30)
  assert.deepEqual(f.effects.seeks, []); assert.equal(f.effects.plays, 0)
})

test('BR-01 a marked replacement from this reload can restore once', t => {
  const f = longSeek(t)
  f.onReload(() => f.controls({ reloadRevision: 1 }))
  f.ticks(30); f.controls({ coreId: 2, coreReloadRevision: 1 }); f.set({ seeking: false, readyState: 3 }); f.monitor.tick()
  assert.deepEqual(f.effects.seeks, [978]); assert.equal(f.effects.plays, 1)
})
test('BR-01 rejection of reload terminates only its own intent', async t => {
  const f = longSeek(t), pending = deferred<void>()
  f.onReload(() => pending.promise); f.ticks(30)
  pending.reject(new Error('controlled reload failure')); await Promise.resolve()
  assert.equal(f.recovery.snapshot().reason, 'reload-rejected'); assert.equal(f.recovery.isRecovering(), false)
  f.ticks(100); assert.equal(f.effects.reloads, 1)
})
test('BR-01 late play rejection cannot revive a seek-cancelled restore', async t => {
  const f = longSeek(t), pending = deferred<void>()
  f.onPlay(() => pending.promise); f.ticks(30); f.set({ seeking: false, readyState: 3 }); f.monitor.tick()
  f.controls({ userRevision: 2, seekRevision: 2 }); f.set({ currentTime: 0, seeking: true }); f.monitor.tick()
  const state = f.recovery.snapshot()
  pending.reject(new Error('old play failure')); await Promise.resolve()
  assert.deepEqual(f.recovery.snapshot(), state); assert.equal(f.effects.plays, 1)
})
test('BR-01 rate command during reload invalidates the saved speed', t => {
  const f = longSeek(t); f.ticks(30); f.controls({ userRevision: 2 }); f.set({ seeking: false, readyState: 3, playbackRate: 1 })
  f.monitor.tick(); assert.deepEqual(f.effects.seeks, []); assert.equal(f.effects.plays, 0)
})
test('BR-01 missing legal authority fails explicitly and does not report health', t => {
  const f = longSeek(t); f.eligible(false); f.ticks(15)
  assert.equal(f.recovery.snapshot().reason, 'no-legal-video-route')
  assert.equal(f.effects.fallbacks, 0); assert.equal(f.effects.reloads, 0)
})
test('BR-01 synchronous reset inside reload cannot restore or resurrect state', t => {
  const f = longSeek(t); f.onReload(() => f.recovery.reset()); f.ticks(30)
  assert.equal(f.recovery.isRecovering(), false); assert.equal(f.recovery.snapshot().state, 'healthy')
  f.set({ seeking: false, readyState: 4 }); f.monitor.tick(); assert.deepEqual(f.effects.seeks, [])
})
test('BR-01 a time jump without new frames is not playback evidence', t => {
  const f = longSeek(t); f.ticks(30); f.set({ seeking: false, readyState: 3 }); f.monitor.tick()
  f.set({ currentTime: 990 }); f.ticks(2)
  assert.notEqual(f.recovery.snapshot().state, 'recovered'); f.ticks(13)
  assert.equal(f.recovery.isRecovering(), false)
})

test('BR-01 control: short seek preserves its target without reload', t => {
  const f = fixture(t); f.set({ seeking: true, currentTime: 978, readyState: 1, playableBufferSec: 0, bufferAheadSec: 0 })
  f.ticks(3); assert.equal(f.monitor.snapshot().watchdog, 'seek-grace'); assert.equal(f.effects.reloads, 0)
  f.set({ seeking: false, currentTime: 979, readyState: 4, playableBufferSec: 4, bufferAheadSec: 8, frames: 200 }); f.ticks(1)
  assert.equal(f.effects.reloads, 0); assert.deepEqual(f.effects.seeks, [])
})
test('BR-01 control: Auto downshift with real progress causes no forced reload', t => {
  const f = fixture(t); f.set({ width: 1920, height: 1080, currentTime: 121, frames: 160 })
  f.ticks(1); f.set({ currentTime: 122, frames: 220 }); f.ticks(1)
  assert.equal(f.monitor.snapshot().watchdog, 'healthy'); assert.equal(f.effects.fallbacks, 0); assert.equal(f.effects.reloads, 0)
})
test('BR-01 control: later seek cancels an older core restore', t => {
  const f = fixture(t); f.recovery.armRouteFailure('route-failure', f.video())
  f.set({ readyState: 0, width: 0, height: 0, coreInitialized: false, playableBufferSec: 0 }); f.ticks(4)
  assert.equal(f.effects.reloads, 1)
  f.set({ seeking: true, currentTime: 1900, readyState: 4, width: 1920, height: 1080, coreInitialized: true })
  f.ticks(1); assert.deepEqual(f.effects.seeks, []); assert.equal(f.effects.plays, 0)
  assert.equal(f.recovery.snapshot().reason, 'seek-interrupted')
})
test('BR-01 A: unchanged seeking must leave temporary grace', t => {
  const f = fixture(t); f.set({ seeking: true, currentTime: 978, readyState: 1, playableBufferSec: 0, bufferAheadSec: 0 })
  f.ticks(300); assert.notEqual(f.monitor.snapshot().watchdog, 'seek-grace')
})
test('BR-01 B: initialized stalled core must release recovery intent', t => {
  const f = fixture(t); f.set({ readyState: 1, playableBufferSec: 0, bufferAheadSec: 0 })
  f.recovery.armRouteFailure('route-failure', f.video()); f.ticks(300)
  assert.equal(f.recovery.isRecovering(), false)
})
test('BR-01 C: retained dimensions after interrupted seek do not prove recovery', t => {
  const f = fixture(t); f.recovery.armRouteFailure('route-failure', f.video())
  f.set({ seeking: true, currentTime: 978, readyState: 1, playableBufferSec: 0, bufferAheadSec: 0 })
  f.ticks(1); assert.equal(f.recovery.snapshot().reason, 'seek-interrupted'); f.ticks(1)
  assert.notEqual(f.recovery.snapshot().state, 'recovered')
})
import { idleControls } from "../../support/player.ts"
