import { currentResumePlayer } from '../../support/player.ts'
import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { PlayerControlObserver } from '../../../src-v2/adapters/player-controls.ts'
import { PlayerMonitor } from '../../../src-v2/application/player-monitor.ts'
import { RecoveryController } from '../../../src-v2/application/recovery-controller.ts'
import type {
  PlayerControlSnapshot,
  PlayerPort,
  VideoSnapshot,
} from '../../../src-v2/application/ports.ts'
import { epochId, generationId } from '../../../src-v2/domain/model.ts'
import { FakeClock } from '../../support/clock.ts'
import { monitorMeasurement, monitorRecovery, monitorRoutes } from '../../support/controllers.ts'
import { deferred } from '../../support/deferred.ts'
import { testScope } from '../../support/scope.ts'

const initialVideo = (): VideoSnapshot => ({
  available: true,
  paused: false,
  seeking: false,
  ended: false,
  readyState: 4,
  currentTime: 0,
  duration: 600,
  width: 1920,
  height: 1080,
  playbackRate: 1,
  effectiveRate: 1,
  bufferAheadSec: 30,
  playableBufferSec: 30,
  bufferedToEnd: false,
  frames: null,
  mediaError: false,
  coreInitialized: true,
  manifestHasVideo: true,
})

const initialControls = (): PlayerControlSnapshot => ({
  mediaId: 1,
  coreId: 1,
  seekRevision: 0,
  userRevision: 0,
  dragging: false,
  targetSec: null,
  reloadRevision: 0,
  coreReloadRevision: 0,
})

function playbackFixture(t: TestContext) {
  const scope = testScope(t),
    clock = scope.own(new FakeClock())
  let video = initialVideo(),
    controls = initialControls(),
    active = true
  let reload: () => unknown = () => undefined,
    play: () => unknown = () => undefined
  const effects: string[] = []
  const player = {
    snapshot: () => video,
    controls: () => controls,
    syncManifest: () => true,
    currentTime: () => video.currentTime,
    playbackRate: () => video.playbackRate,
    observePlayIntent: () => () => undefined,
    reload() {
      effects.push('reload')
      return reload()
    },
    seek(value: number) {
      effects.push(`seek:${value}`)
    },
    setRate(value: number) {
      effects.push(`rate:${value}`)
    },
    play() {
      effects.push('play')
      return play()
    },
    reset() {},
  } satisfies PlayerPort
  const recovery = scope.own(
    new RecoveryController(currentResumePlayer(player), clock.now, () => active),
  )
  const monitor = scope.own(
    new PlayerMonitor(
      player,
      {
        get: () => ({
          generation: generationId(1),
          epoch: epochId(0),
          representation: null,
          affinity: null,
          disabled: false,
          recovering: false,
          lastDecisionId: null,
        }),
      },
      { get: () => ({ disabled: false }) },
      { groupSummary: () => null },
      monitorRoutes(),
      monitorMeasurement(),
      monitorRecovery(),
      () => true,
      clock.now,
      clock,
    ),
  )
  return {
    clock,
    monitor,
    recovery,
    effects,
    video: () => video,
    set(patch: Partial<VideoSnapshot>) {
      video = { ...video, ...patch }
    },
    controls(patch: Partial<PlayerControlSnapshot>) {
      controls = { ...controls, ...patch }
    },
    active(value: boolean) {
      active = value
    },
    onReload(value: () => unknown) {
      reload = value
    },
    onPlay(value: () => unknown) {
      play = value
    },
  }
}

test('player convergence: monitor keeps initial, exact time, missing frame and seeking baselines', (t) => {
  const f = playbackFixture(t)
  f.monitor.tick()
  assert.equal(f.monitor.snapshot().stableProgressSec, 0)
  f.set({ currentTime: 0.05 })
  f.monitor.tick()
  assert.equal(f.monitor.snapshot().stableProgressSec, 0, 'the boundary is strictly greater')
  f.set({ currentTime: 0.100001 })
  f.monitor.tick()
  assert.equal(f.monitor.snapshot().stableProgressSec, 1)
  f.set({ currentTime: 1, frames: 10 })
  f.monitor.tick()
  assert.equal(f.monitor.snapshot().stableProgressSec, 0, 'first known frame is not a frame delta')
  f.set({ currentTime: 2, frames: 11 })
  f.monitor.tick()
  assert.equal(f.monitor.snapshot().stableProgressSec, 1)
  f.set({ currentTime: 3, frames: 12, seeking: true })
  f.monitor.tick()
  f.set({ currentTime: 4, frames: 13, seeking: false })
  f.monitor.tick()
  assert.equal(f.monitor.snapshot().stableProgressSec, 0, 'seek completion establishes a baseline')
  f.set({ currentTime: 5, frames: 14 })
  f.monitor.tick()
  assert.equal(f.monitor.snapshot().stableProgressSec, 1)
  f.set({ available: false, currentTime: 6, frames: 15 })
  f.monitor.tick()
  f.set({ available: true, currentTime: 7, frames: 16 })
  f.monitor.tick()
  assert.equal(f.monitor.snapshot().stableProgressSec, 0, 'unavailable media clears monitor time')
  f.set({ currentTime: 8, frames: 17 })
  f.monitor.tick()
  f.set({ currentTime: 9 })
  let monitorFrameReads = 0
  Object.defineProperty(f.video(), 'frames', {
    configurable: true,
    get() {
      if (++monitorFrameReads === 1) f.monitor.reset()
      return 18
    },
  })
  f.monitor.tick()
  assert.equal(f.monitor.snapshot().stableProgressSec, 0, 'getter reset clears the previous frame')
  assert.equal(monitorFrameReads, 3, 'frame guards and final sampling keep their read sequence')
  f.set({ currentTime: 0, frames: 1 })
  f.recovery.tick(f.video())
  f.set({ currentTime: 1 })
  let recoveryFrameReads = 0
  Object.defineProperty(f.video(), 'frames', {
    configurable: true,
    get() {
      if (++recoveryFrameReads === 1) f.recovery.reset()
      return 2
    },
  })
  f.recovery.tick(f.video())
  assert.equal(recoveryFrameReads, 3, 'recovery also reads the baseline only after the first frame')
  assert.equal(f.recovery.snapshot().state, 'healthy')
})

test('player convergence: each control identity change rejects one monitor progress sample', (t) => {
  const f = playbackFixture(t)
  f.monitor.tick()
  let position = 0
  for (const name of ['seekRevision', 'userRevision', 'mediaId', 'coreId'] as const) {
    f.controls({ [name]: 10 })
    f.set({ currentTime: ++position })
    f.monitor.tick()
    assert.equal(f.monitor.snapshot().stableProgressSec, 0, name)
    f.set({ currentTime: ++position })
    f.monitor.tick()
    assert.equal(f.monitor.snapshot().stableProgressSec, 1, name)
  }
})

test('player convergence: recovery retains its unavailable-sample progress policy', (t) => {
  const f = playbackFixture(t)
  f.recovery.tick(f.video())
  f.recovery.armRouteFailure('route-failure', f.video())
  f.clock.advance(1000)
  f.set({ available: false, currentTime: 0.05 })
  f.recovery.tick(f.video())
  f.clock.advance(1000)
  f.set({ currentTime: 0.100001 })
  f.recovery.tick(f.video())
  f.clock.advance(15_000)
  f.recovery.tick(f.video())
  assert.equal(f.recovery.snapshot().state, 'failed')
  assert.equal(f.recovery.snapshot().reason, 'progress-not-sustained')
  assert.deepEqual(f.effects, [], 'no reload or restore follows unavailable progress')
})

for (const condition of ['media-error', 'reload-timeout', 'ownership-ended'] as const) {
  test(`player convergence: recovery terminal order preserves ${condition}`, (t) => {
    const f = playbackFixture(t)
    f.recovery.tick(f.video())
    f.recovery.armRouteFailure('route-failure', f.video())
    f.set({ readyState: 0, width: 0, height: 0, coreInitialized: false })
    f.clock.advance(4000)
    f.recovery.tick(f.video())
    assert.deepEqual(f.effects, ['reload'])
    f.active(false)
    f.set({ readyState: 4, width: 1920, height: 1080, coreInitialized: true })
    if (condition !== 'ownership-ended') f.clock.advance(15_000)
    if (condition === 'media-error') f.set({ mediaError: true })
    f.recovery.tick(f.video())
    assert.equal(f.recovery.snapshot().reason, condition)
    assert.deepEqual(f.effects, ['reload'], 'terminal checks precede healthy restoration')
  })
}

test('player convergence: synchronous reset and late rejected reload cannot revive an action', async (t) => {
  const f = playbackFixture(t),
    pending = deferred<void>()
  f.onReload(() => {
    f.recovery.reset()
    return pending.promise
  })
  f.recovery.tick(f.video())
  f.recovery.armRouteFailure('route-failure', f.video())
  f.set({ readyState: 0, width: 0, height: 0, coreInitialized: false })
  f.clock.advance(4000)
  f.recovery.tick(f.video())
  pending.reject(new Error('synthetic late reload'))
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(f.recovery.snapshot().state, 'healthy')
  assert.equal(f.recovery.isRecovering(), false)
  assert.deepEqual(f.effects, ['reload'])
})

test('player convergence: pending play rejection after reset does not overwrite a new lifecycle', async (t) => {
  const f = playbackFixture(t),
    pending = deferred<void>()
  f.onPlay(() => pending.promise)
  f.recovery.tick(f.video())
  f.recovery.armRouteFailure('route-failure', f.video())
  f.set({ readyState: 0, width: 0, height: 0, coreInitialized: false })
  f.clock.advance(4000)
  f.recovery.tick(f.video())
  f.set({ readyState: 4, width: 1920, height: 1080, coreInitialized: true })
  f.recovery.tick(f.video())
  assert.deepEqual(f.effects, ['reload', 'seek:0', 'rate:1', 'play'])
  f.recovery.reset()
  pending.reject(new Error('synthetic late play'))
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(f.recovery.snapshot().state, 'healthy')
  assert.equal(f.recovery.isRecovering(), false)
})

test('player convergence: bindings, SDK reads, exact results and reverse cleanup keep their order', (t) => {
  const scope = testScope(t),
    clock = scope.own(new FakeClock()),
    log: string[] = []
  class Target extends EventTarget {
    constructor(readonly name: string) {
      super()
    }
    override addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ): void {
      log.push(`add:${this.name}:${type}`)
      super.addEventListener(type, listener, options)
    }
    override removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions,
    ): void {
      log.push(`remove:${this.name}:${type}`)
      super.removeEventListener(type, listener, options)
    }
  }
  class Element extends Target {
    currentTime = 0
    readyState = 4
    seeking = false
    closest(): Element {
      return region
    }
    contains(target: unknown): boolean {
      return target === video || target === this
    }
  }
  const document = new Target('document'),
    window = new Target('window'),
    region = new Element('region'),
    video = new Element('video'),
    marker = {},
    error = new Error('synthetic SDK failure'),
    receiver = {},
    calls: unknown[][] = []
  let failure: Error | null = null
  const originalSeek = function (this: unknown, ...args: unknown[]): unknown {
    calls.push([this, ...args])
    if (failure) throw failure
    return marker
  }
  const originalReload = () => marker
  let seek: unknown = originalSeek,
    reload: unknown = originalReload
  const site = {
    __core: () => marker,
    get seek(): unknown {
      log.push('read:seek')
      return seek
    },
    set seek(value: unknown) {
      log.push('write:seek')
      seek = value
    },
    get reload(): unknown {
      log.push('read:reload')
      return reload
    },
    set reload(value: unknown) {
      log.push('write:reload')
      reload = value
    },
  }
  scope.defineGlobal('document', { configurable: true, value: document })
  scope.defineGlobal('window', { configurable: true, value: window })
  scope.defineGlobal('Node', { configurable: true, value: Element })
  scope.defineGlobal('Element', { configurable: true, value: Element })
  const observer = new PlayerControlObserver(
    {
      video: () => video as unknown as HTMLVideoElement,
      player: () => site,
      lifecycleKey: () => 'convergence',
    },
    {
      scheduler: clock,
      isActuallyVisible: () => true,
      subscribeControlLoss() {
        log.push('subscribe:loss')
        return () => log.push('unsubscribe:loss')
      },
    },
  )
  scope.defer(() => observer.reset())
  observer.controls()
  assert.deepEqual(log, [
    'add:document:pointerdown',
    'add:document:pointerup',
    'add:document:pointercancel',
    'add:document:lostpointercapture',
    'add:window:blur',
    'subscribe:loss',
    'add:document:keydown',
    'add:document:keyup',
    'add:video:seeking',
    'add:video:seeked',
    'read:seek',
    'read:reload',
    'write:reload',
    'write:seek',
  ])
  assert.equal(typeof seek, 'function')
  assert.equal(
    Reflect.apply(seek as (...args: unknown[]) => unknown, receiver, [0, 'extra']),
    marker,
  )
  assert.deepEqual(calls, [[receiver, 0, 'extra']])
  failure = error
  assert.throws(
    () => Reflect.apply(seek as (...args: unknown[]) => unknown, receiver, [12]),
    (thrown) => thrown === error,
  )
  assert.equal(Reflect.apply(reload as () => unknown, receiver, []), marker)
  log.length = 0
  observer.reset()
  assert.deepEqual(log, [
    'read:seek',
    'write:seek',
    'read:reload',
    'write:reload',
    'remove:video:seeked',
    'remove:video:seeking',
    'remove:document:keyup',
    'remove:document:keydown',
    'unsubscribe:loss',
    'remove:window:blur',
    'remove:document:lostpointercapture',
    'remove:document:pointercancel',
    'remove:document:pointerup',
    'remove:document:pointerdown',
  ])
  assert.equal(seek, originalSeek)
  assert.equal(reload, originalReload)
  assert.equal(clock.pendingCount, 0)
})
