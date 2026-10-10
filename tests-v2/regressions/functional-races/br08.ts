import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { PlayerAdapter } from '../../../src-v2/adapters/player.ts'
import { PlayerMonitor } from '../../../src-v2/application/player-monitor.ts'
import { RecoveryController } from '../../../src-v2/application/recovery-controller.ts'
import type { PlayerPort, PlayerControlSnapshot, VideoSnapshot } from '../../../src-v2/application/ports.ts'
import { representationId, generationId, epochId } from '../../../src-v2/domain/model.ts'
import { FakeClock } from '../../support/clock.ts'
import { testScope } from '../../support/scope.ts'
import { monitorRoutes, monitorMeasurement } from '../../support/controllers.ts'
import { idleControls } from '../../support/player.ts'
import { deferred } from '../../support/deferred.ts'

// A causal model of the site hitbox observed in Chrome. Node's trusted-event
// override is a contract fixture, not proof of real native pointer behavior.
function fixture(t: TestContext, options: { prime?: boolean; firstMediaAt?: number } = {}) {
  const scope = testScope(t), clock = scope.own(new FakeClock())
  const document = new EventTarget(), window = new EventTarget()
  class DomElement extends EventTarget {
    currentTime = 120
    seeking = false
    parentElement: DomElement | null = null
    readonly classes: ReadonlySet<string>
    constructor(...classes: string[]) { super(); this.classes = new Set(classes) }
    closest(selectors: string): DomElement | null {
      for (let current: DomElement | null = this; current; current = current.parentElement) {
        for (const selector of selectors.split(',').map(s => s.trim())) {
          if (selector.startsWith('.') && current.classes.has(selector.slice(1))) return current
        }
      }
      return null
    }
    contains(target: unknown): boolean {
      if (!(target instanceof DomElement)) return false
      for (let current: DomElement | null = target; current; current = current.parentElement) if (current === this) return true
      return false
    }
  }
  const region = new DomElement('bpx-player-container'), video = new DomElement()
  const wrapper = new DomElement('bpx-player-progress-wrap'), inner = new DomElement('bpx-player-progress')
  const schedule = new DomElement('bpx-player-progress-schedule'), outside = new DomElement()
  video.parentElement = region; wrapper.parentElement = region; inner.parentElement = wrapper; schedule.parentElement = inner
  class PointerBoundary extends Event {
    readonly pointerId = 1
    constructor(type: string, private readonly trusted: boolean, private readonly receiver: DomElement) { super(type) }
    override get isTrusted(): boolean { return this.trusted }
    override get target(): EventTarget { return this.receiver }
  }
  for (const [name, value] of Object.entries({ document, window, Node: DomElement, Element: DomElement, HTMLElement: DomElement, PointerEvent: PointerBoundary })) {
    scope.defineGlobal(name, { configurable: true, value })
  }
  let frames = 100
  const effects = { fallbacks: 0, startupFallbacks: 0, reloads: 0 }
  let snapshotPatch: Partial<VideoSnapshot> = options.prime === false
    ? { readyState: 1, bufferAheadSec: 0, playableBufferSec: 0 } : {}
  const core = { state: { initialized: true } }
  const site = {
    __core: () => core,
    getCurrentTime: () => video.currentTime,
    getPlaybackRate: () => 1,
    seek(value: number): void { video.currentTime = value; video.seeking = true; video.dispatchEvent(new Event('seeking')) },
    reload(): void { effects.reloads++ }, setPlaybackRate(): void {}, play(): void {},
  }
  class Player extends PlayerAdapter {
    protected override player() { return site }
    override video(): HTMLVideoElement { return video as unknown as HTMLVideoElement }
    override syncManifest(): boolean { return true }
    override snapshot(): VideoSnapshot {
      return { available: true, paused: false, seeking: video.seeking, ended: false,
        readyState: video.seeking ? 1 : 4, currentTime: video.currentTime, duration: 3910, width: 1280, height: 720,
        playbackRate: 1, effectiveRate: 1, bufferAheadSec: video.seeking ? 0 : 30, playableBufferSec: video.seeking ? 0 : 30,
        bufferedToEnd: false, frames, mediaError: false, coreInitialized: true, manifestHasVideo: true, ...snapshotPatch }
    }
  }
  const environment = { scheduler: clock, isActuallyVisible: () => true, subscribeControlLoss: () => () => undefined }
  const player = new Player({ lifecycleKey: () => 'br08-fixture', transform: () => ({ accepted: true, formats: [],
    videoCount: 0, audioCount: 0, segmentCount: 0, upstreamCode: 0, reason: null }) }, environment)
  scope.defer(() => player.reset())
  const recovery = scope.own(new RecoveryController(player, clock.now))
  const monitor = scope.own(new PlayerMonitor(player,
    { get: () => ({ generation: generationId(1), epoch: epochId(0), representation: representationId('video:br08'),
      affinity: null, disabled: false, recovering: false, lastDecisionId: null }) },
    { get: () => ({ disabled: false }) },
    { groupSummary: () => ({ kind: 'video', bandwidth: 4_000_000, height: 720, codec: 'avc', routeCount: 1 }) },
    monitorRoutes({ firstMediaAt: () => options.firstMediaAt ?? 0, latestRequested: () => ({ generation: generationId(1), epoch: epochId(0), representation: representationId('video:br08'),
      targetHost: 'upos-sz-mirrorali.bilivideo.com', routePolicyRevision: 0, authorityRevision: 1 }),
      recoveryEligible: () => true, recover() { effects.fallbacks++ },
      recoverStartup() { effects.startupFallbacks++; return { host: 'upos-sz-mirrorcos.bilivideo.com' } } }),
    monitorMeasurement(), recovery, () => true, clock.now, clock))
  monitor.tick()
  if (options.prime !== false) { clock.advance(1000); video.currentTime++; frames += 30; monitor.tick() }
  const down = (target: DomElement, trusted = true): void => {
    document.dispatchEvent(new PointerBoundary('pointerdown', trusted, target))
  }
  const holdSeek = (target: DomElement): void => { down(target); site.seek(900); monitor.tick() }
  const release = (type: 'pointerup' | 'pointercancel' | 'lostpointercapture'): void => {
    document.dispatchEvent(new PointerBoundary(type, true, wrapper)); monitor.tick()
  }
  return { player, monitor, recovery, clock, effects, wrapper, inner, schedule, outside, down, holdSeek, release,
    set: (patch: Partial<VideoSnapshot>) => { snapshotPatch = { ...snapshotPatch, ...patch } },
    siteSeek: (value: number) => site.seek(value) }
}

test('BR-08 wrapper hitbox trusted pointerdown owns the active progress drag', t => {
  const f = fixture(t), before = f.player.controls().userRevision
  f.holdSeek(f.wrapper)
  assert.equal(f.player.controls().userRevision, before + 1)
  assert.equal(f.player.controls().targetSec, 900)
  assert.equal(f.player.controls().dragging, true,
    'the website progress wrapper is a functional seek hitbox, so a held pointer must suppress rescue')
})

test('BR-08 wrapper drag held for 15000 ms must not issue video fallback', t => {
  const f = fixture(t)
  f.holdSeek(f.wrapper)
  f.clock.advance(14999); f.monitor.tick()
  assert.equal(f.effects.fallbacks, 0)
  f.clock.advance(1); f.monitor.tick()
  assert.equal(f.effects.fallbacks, 0, 'a still-held user progress drag cannot start the seek rescue deadline')
})

test('BR-08 wrapper drag held for 30000 ms must not reload the core', t => {
  const f = fixture(t)
  f.holdSeek(f.wrapper)
  f.clock.advance(15000); f.monitor.tick()
  f.clock.advance(15000); f.monitor.tick()
  assert.equal(f.effects.reloads, 0, 'a held progress drag must remain protected at the core reload boundary')
})

test('BR-08 control: inner progress descendant acquires drag ownership and suppresses rescue', t => {
  const f = fixture(t)
  f.holdSeek(f.schedule)
  assert.equal(f.player.controls().dragging, true)
  f.clock.advance(31000); f.monitor.tick()
  assert.equal(f.effects.fallbacks, 0)
  assert.equal(f.effects.reloads, 0)
})

test('BR-08 control: pointercancel ends a known drag and grants a fresh grace after release', t => {
  const f = fixture(t)
  f.holdSeek(f.inner); f.clock.advance(31000); f.monitor.tick()
  f.release('pointercancel')
  assert.equal(f.player.controls().dragging, false)
  f.clock.advance(14999); f.monitor.tick(); assert.equal(f.effects.fallbacks, 0)
  f.clock.advance(1); f.monitor.tick(); assert.equal(f.effects.fallbacks, 1)
})

test('BR-08 control: synthetic wrapper input does not acquire trusted drag ownership', t => {
  const f = fixture(t), before = f.player.controls().userRevision
  f.down(f.wrapper, false)
  assert.equal(f.player.controls().dragging, false)
  assert.equal(f.player.controls().userRevision, before)
})

test('BR-08 control: trusted input outside the player does not acquire player ownership', t => {
  const f = fixture(t), before = f.player.controls().userRevision
  f.down(f.outside)
  assert.equal(f.player.controls().dragging, false)
  assert.equal(f.player.controls().userRevision, before)
})

test('BR-08 held non-seeking low-buffer preview clears watchdog counts and cannot issue fallback', t => {
  const f = fixture(t, { prime: false })
  f.down(f.inner)
  assert.equal(f.player.controls().dragging, true)
  for (const age of [14_999, 15_000, 29_999, 30_000, 31_000]) {
    f.clock.advance(age - (f.clock.now() - 2_000_000_000_000)); f.monitor.tick()
    assert.equal(f.effects.fallbacks, 0, `held preview at ${age} ms`)
    assert.equal(f.effects.reloads, 0)
    assert.equal(f.monitor.snapshot().stallTicks, 0, 'a held preview cannot accumulate legacy watchdog ticks')
  }
})

test('BR-08 held wrapper seek is protected at every precise fallback and reload boundary', t => {
  const f = fixture(t), start = f.clock.now()
  f.holdSeek(f.wrapper)
  for (const age of [14_999, 15_000, 29_999, 30_000, 31_000]) {
    f.clock.advance(age - (f.clock.now() - start)); f.monitor.tick()
    assert.equal(f.effects.fallbacks, 0, `held seeking at ${age} ms`)
    assert.equal(f.effects.reloads, 0); assert.equal(f.recovery.isRecovering(), false)
  }
})

test('BR-08 preview resets the old watchdog counter rather than postponing its remaining ticks', t => {
  const f = fixture(t, { prime: false })
  for (let index = 0; index < 4; index++) { f.clock.advance(1000); f.monitor.tick() }
  assert.equal(f.monitor.snapshot().stallTicks, 5)
  f.down(f.inner); f.clock.advance(31_000); f.monitor.tick()
  assert.equal(f.monitor.snapshot().stallTicks, 0); assert.equal(f.effects.fallbacks, 0)
  f.release('pointerup')
  for (let index = 0; index < 4; index++) { f.clock.advance(1000); f.monitor.tick() }
  assert.equal(f.effects.fallbacks, 0, 'five fresh low-buffer samples have not reached the six-tick watchdog')
  f.clock.advance(1000); f.monitor.tick(); assert.equal(f.effects.fallbacks, 1)
})

test('BR-08 cold startup held preview does not consume rescue and release retains the original first-media age', t => {
  const f = fixture(t, { prime: false, firstMediaAt: 2_000_000_000_000 })
  f.down(f.inner)
  for (const age of [14_999, 15_000, 29_999, 30_000, 31_000]) {
    f.clock.advance(age - (f.clock.now() - 2_000_000_000_000)); f.monitor.tick()
    assert.equal(f.effects.startupFallbacks, 0, `held cold preview at ${age} ms`)
    assert.equal(f.recovery.isRecovering(), false)
    assert.equal(f.monitor.snapshot().startupRescue.state, 'watching')
  }
  f.release('pointerup')
  assert.equal(f.effects.startupFallbacks, 1, 'release must retain the original cold-start deadline and remaining attempt')
  assert.equal(f.recovery.isRecovering(), true)
  f.monitor.tick(); assert.equal(f.effects.startupFallbacks, 1)
})

test('BR-08 release of ordinary seeking drag creates a new exact 15/30-second segment from position zero', t => {
  const f = fixture(t)
  f.holdSeek(f.inner); f.clock.advance(31_000); f.monitor.tick()
  f.siteSeek(0); f.release('pointerup')
  f.clock.advance(14_999); f.monitor.tick(); assert.equal(f.effects.fallbacks, 0)
  f.clock.advance(1); f.monitor.tick(); assert.equal(f.effects.fallbacks, 1); assert.equal(f.effects.reloads, 0)
  f.clock.advance(14_999); f.monitor.tick(); assert.equal(f.effects.reloads, 0)
  f.clock.advance(1); f.monitor.tick(); assert.equal(f.effects.reloads, 1)
  assert.equal(f.recovery.snapshot().source, 'stall')
})

function recoveryFixture(t: TestContext) {
  const scope = testScope(t), clock = scope.own(new FakeClock())
  let video: VideoSnapshot = { available: true, paused: false, seeking: false, ended: false, readyState: 4,
    currentTime: 120, duration: 3910, width: 1920, height: 1080, playbackRate: 2, effectiveRate: 2,
    bufferAheadSec: 60, playableBufferSec: 30, bufferedToEnd: false, frames: 100, mediaError: false,
    coreInitialized: true, manifestHasVideo: true }
  let controls = idleControls(), active = true, legal = true
  let intent: (() => void) | null = null, currentRead: () => void = () => undefined, rateRead: () => void = () => undefined
  let controlRead: () => void = () => undefined
  let reload: () => unknown = () => undefined, play: () => unknown = () => undefined
  const effects = { reloads: 0, seeks: [] as number[], rates: [] as number[], plays: 0 }
  const player = { snapshot: () => video, controls() { controlRead(); return controls },
    currentTime() { currentRead(); return video.currentTime }, playbackRate() { rateRead(); return video.playbackRate },
    observePlayIntent(listener: () => void) { intent = listener; return () => { if (intent === listener) intent = null } },
    reload() { effects.reloads++; return reload() }, seek(value: number) { effects.seeks.push(value) },
    setRate(value: number) { effects.rates.push(value) }, play() { effects.plays++; return play() },
    reset() {}, syncManifest: () => true } satisfies PlayerPort
  const recovery = scope.own(new RecoveryController(player, clock.now, () => active, () => () => legal))
  recovery.tick(video)
  return { clock, recovery, effects, video: () => video, tick: () => recovery.tick(video),
    set: (patch: Partial<VideoSnapshot>) => { video = { ...video, ...patch } },
    controls: (patch: Partial<PlayerControlSnapshot>) => { controls = { ...controls, ...patch } },
    active: (value: boolean) => { active = value }, legal: (value: boolean) => { legal = value }, eligible: () => legal,
    intent: () => intent?.(), onCurrent: (value: () => void) => { currentRead = value },
    onRate: (value: () => void) => { rateRead = value }, onControls: (value: () => void) => { controlRead = value },
    onReload: (value: () => unknown) => { reload = value },
    onPlay: (value: () => unknown) => { play = value } }
}

for (const source of ['route-failure', 'watchdog'] as const) test(`BR-08 dragging prevents Runtime ${source} recovery token creation`, t => {
  const f = recoveryFixture(t); f.controls({ dragging: true })
  f.recovery.armRouteFailure(source, f.video())
  assert.equal(f.recovery.isRecovering(), false)
  assert.equal(f.recovery.snapshot().source, null)
})

test('BR-08 dragging prevents a new stall token even before a monitor cancellation tick', t => {
  const f = recoveryFixture(t); f.controls({ dragging: true })
  f.recovery.armStall(f.video(), { id: 1, startedAt: f.clock.now() - 30_000, targetSec: 0, valid: () => true })
  assert.equal(f.recovery.isRecovering(), false)
  assert.equal(f.effects.reloads, 0)
})

test('BR-08 dragging prevents a cold-start recovery token independently of Monitor', t => {
  const f = recoveryFixture(t); f.controls({ dragging: true }); f.set({ readyState: 1, playableBufferSec: 0 })
  f.recovery.armStartupFailure(f.video())
  assert.equal(f.recovery.isRecovering(), false)
})

test('BR-08 dragging prevents trusted long-pause play intent and paused-transition tokens', t => {
  const f = recoveryFixture(t); f.set({ paused: true }); f.tick(); f.clock.advance(31_000)
  f.controls({ dragging: true }); f.intent(); assert.equal(f.recovery.isRecovering(), false)
  f.set({ paused: false }); f.tick(); assert.equal(f.recovery.isRecovering(), false)
})

for (const change of ['drag', 'user', 'seek', 'media', 'core', 'reset', 'inactive', 'authority'] as const)
  test(`BR-08 recovery preparation must reject ${change} reentry while reading saved position`, t => {
    const f = recoveryFixture(t)
    f.onCurrent(() => {
      f.onCurrent(() => undefined)
      if (change === 'drag') f.controls({ dragging: true })
      else if (change === 'user') f.controls({ userRevision: 1 })
      else if (change === 'seek') f.controls({ seekRevision: 1 })
      else if (change === 'media') f.controls({ mediaId: 2 })
      else if (change === 'core') f.controls({ coreId: 2 })
      else if (change === 'reset') f.recovery.reset()
      else if (change === 'inactive') f.active(false)
      else f.legal(false)
    })
    f.recovery.armRouteFailure('route-failure', f.video(), f.eligible)
    assert.equal(f.recovery.isRecovering(), false, `a ${change} callback revoked the preparation owner`)
    assert.equal(f.effects.reloads, 0)
  })

test('BR-08 rate getter reentry must not create a token with a stale saved speed', t => {
  const f = recoveryFixture(t)
  f.onRate(() => { f.onRate(() => undefined); f.controls({ userRevision: 1 }); f.set({ playbackRate: 1 }) })
  f.recovery.armRouteFailure('route-failure', f.video()); assert.equal(f.recovery.isRecovering(), false)
})

for (const qualification of ['active', 'authority'] as const)
  test(`BR-08 final control sampling must not commit after ${qualification} is revoked synchronously`, t => {
    const f = recoveryFixture(t); let reads = 0
    f.onControls(() => {
      if (++reads !== 2) return
      if (qualification === 'active') f.active(false)
      else f.legal(false)
    })
    f.recovery.armRouteFailure('route-failure', f.video(), f.eligible)
    assert.equal(reads, 2); assert.equal(f.recovery.isRecovering(), false)
  })

test('BR-08 saved position and rate are read exactly once before creating a legal token', t => {
  const f = recoveryFixture(t); let positions = 0, rates = 0
  f.onCurrent(() => { positions++ }); f.onRate(() => { rates++ })
  f.recovery.armRouteFailure('route-failure', f.video())
  assert.equal(f.recovery.isRecovering(), true); assert.equal(positions, 1); assert.equal(rates, 1)
})

test('BR-08 synchronous preparation reentry cannot replace an already-created newer token', t => {
  const f = recoveryFixture(t)
  f.onCurrent(() => { f.onCurrent(() => undefined); f.recovery.armRouteFailure('watchdog', f.video()) })
  f.recovery.armRouteFailure('route-failure', f.video())
  assert.equal(f.recovery.isRecovering(), true); assert.equal(f.recovery.snapshot().source, 'watchdog')
})

test('BR-08 synchronous preparation reentry must recheck the current reload breaker', t => {
  const f = recoveryFixture(t)
  f.onCurrent(() => {
    f.onCurrent(() => undefined); f.recovery.armRouteFailure('watchdog', f.video())
    f.set({ readyState: 0, width: 0, height: 0, coreInitialized: false }); f.clock.advance(4000); f.tick()
    assert.equal(f.effects.reloads, 1)
    f.controls({ userRevision: 1 }); f.tick(); assert.equal(f.recovery.isRecovering(), false)
    f.controls({ userRevision: 0 }); f.set({ readyState: 4, width: 1920, height: 1080, coreInitialized: true })
  })
  f.recovery.armRouteFailure('route-failure', f.video())
  assert.equal(f.recovery.isRecovering(), false); assert.equal(f.recovery.snapshot().reloadCount, 1)
})

test('BR-08 synchronous preparation reentry must recheck consumed reload quota after the breaker expires', t => {
  const f = recoveryFixture(t), startedAt = f.clock.now()
  f.onCurrent(() => {
    f.onCurrent(() => undefined)
    for (let index = 0; index < 2; index++) {
      f.recovery.armRouteFailure('watchdog', f.video())
      f.set({ readyState: 0, width: 0, height: 0, coreInitialized: false }); f.clock.advance(4000); f.tick()
      f.controls({ userRevision: 1 }); f.tick()
      f.controls({ userRevision: 0 }); f.set({ readyState: 4, width: 1920, height: 1080, coreInitialized: true })
      f.clock.advance(90_000); f.tick()
    }
  })
  f.recovery.armRouteFailure('route-failure', f.video())
  assert.equal(f.effects.reloads, 2); assert.equal(f.clock.now() - startedAt, 188_000)
  assert.equal(f.recovery.isRecovering(), false, 'a completed inner action cannot make the outer preparation bypass quota')
})

test('BR-08 drag revokes a pending reload token and late reload rejection cannot revive it', async t => {
  const f = recoveryFixture(t), pending = deferred<void>()
  f.onReload(() => pending.promise); f.recovery.armRouteFailure('route-failure', f.video())
  f.set({ readyState: 0, width: 0, height: 0, coreInitialized: false }); f.clock.advance(4000); f.tick()
  assert.equal(f.effects.reloads, 1)
  f.controls({ dragging: true, userRevision: 1 }); f.tick(); assert.equal(f.recovery.isRecovering(), false)
  const state = f.recovery.snapshot(); pending.reject(new Error('owned late reload rejection')); await Promise.resolve()
  assert.deepEqual(f.recovery.snapshot(), state); assert.deepEqual(f.effects.seeks, [])
})

test('BR-08 drag revokes a pending play token and late play rejection cannot restore old position', async t => {
  const f = recoveryFixture(t), pending = deferred<void>()
  f.onPlay(() => pending.promise); f.recovery.armRouteFailure('route-failure', f.video())
  f.set({ readyState: 0, width: 0, height: 0, coreInitialized: false }); f.clock.advance(4000); f.tick()
  f.set({ readyState: 3, width: 1920, height: 1080, coreInitialized: true }); f.tick()
  assert.equal(f.effects.plays, 1)
  f.controls({ dragging: true, userRevision: 1 }); f.set({ currentTime: 0 }); f.tick()
  const state = f.recovery.snapshot(); pending.reject(new Error('owned late play rejection')); await Promise.resolve()
  assert.equal(f.recovery.isRecovering(), false); assert.deepEqual(f.recovery.snapshot(), state)
  assert.deepEqual(f.effects.seeks, [120]); assert.equal(f.effects.plays, 1)
})
