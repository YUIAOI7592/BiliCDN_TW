import { test } from 'node:test'
import assert from 'node:assert/strict'
import { testScope } from '../support/scope.ts'
import { trustedSeekReady } from '../../scripts/iab-installed-verdict.mts'

test('IR36 R2 trusted native seeking does not require an opaque PendingGoal proof', (t) => {
  testScope(t)
  const observation = {
    draggingObserved: true,
    beforeRevision: 4,
    targetSec: 1955,
    goal: {
      value: 1955,
      proof: false,
      native: {
        position: 1955,
        seeking: true,
        paused: false,
        ended: false,
        error: false,
        visible: true,
        controls: { dragging: false, userRevision: 5 },
      },
    },
  }
  assert.equal(trustedSeekReady(observation), true)
  assert.equal(
    trustedSeekReady({
      ...observation,
      goal: { ...observation.goal, native: { ...observation.goal.native, seeking: false } },
    }),
    false,
  )
  assert.equal(
    trustedSeekReady({ ...observation, goal: { ...observation.goal, value: 1982 } }),
    false,
  )
})
import {
  ownMethod,
  isolateWrites,
  installInstalledCase,
  progressPoint,
} from '../../scripts/iab-installed-restore.mts'

function fixture(t: Parameters<typeof testScope>[0]) {
  const recoveryListeners = new Set<(event: any) => void>()
  const routeListeners = new Set<(event: any) => void>()
  const scope = testScope(t)
  let now = 0,
    serial = 0
  const timers = new Map<number, { at: number; fn: () => void; repeat: number }>()
  const env = {
    now: () => now,
    timeout(fn: () => void, ms: number) {
      const id = ++serial
      timers.set(id, { at: now + ms, fn, repeat: 0 })
      return id
    },
    interval(fn: () => void, ms: number) {
      const id = ++serial
      timers.set(id, { at: now + ms, fn, repeat: ms })
      return id
    },
    clear(id: number) {
      timers.delete(id)
    },
  }
  const registry: Record<string, any> = {}
  const video = {
    currentTime: 10,
    playbackRate: 1,
    paused: false,
    seeking: false,
    ended: false,
    readyState: 4,
    error: null,
    buffered: { length: 0 },
    getVideoPlaybackQuality: () => ({ totalVideoFrames: 20 }),
  }
  const state = { state: 'healthy', reloadCount: 0 }
  const controls = {
    userRevision: 0,
    seekRevision: 0,
    reloadRevision: 0,
    mediaId: 1,
    coreId: 1,
    dragging: false,
    pendingSeekGoal: false,
  }
  let sequence = 0,
    writes = 0,
    listeners = 0
  const sdk = {
    seek(v: number) {
      video.currentTime = v
    },
    setPlaybackRate(v: number) {
      video.playbackRate = v
    },
    reload() {},
    play() {},
    __core() {
      return {
        getMpd: () => ({ video: [{ baseUrl: 'https://synthetic.invalid/video' }], audio: [] }),
      }
    },
  }
  const runtime: any = {
    session: { get: () => ({ generation: 1, epoch: 1 }) },
    visibility: { isActuallyVisible: () => true },
    recovery: {
      snapshot: () => ({ ...state }),
      subscribe(listener: any) {
        recoveryListeners.add(listener)
        listeners++
        return () => {
          recoveryListeners.delete(listener)
          listeners--
        }
      },
    },
    measurement: { snapshot: () => ({ state: 'idle', startup: { state: 'complete' } }) },
    routes: {
      ids: { next: (kind: string) => kind + ++sequence },
      evidence: {
        record(_h: string, _k: string, _s: any, valid = () => true) {
          if (valid()) writes++
          return Promise.resolve()
        },
        list: () => [],
        storage: { get: () => ({ records: {} }) },
      },
      subscribe(listener: any) {
        routeListeners.add(listener)
        listeners++
        return () => {
          routeListeners.delete(listener)
          listeners--
        }
      },
      observe() {
        return Promise.resolve()
      },
      recordStartupSuccess() {
        return Promise.resolve()
      },
      recordChallenge() {
        return Promise.resolve()
      },
      latestRequested: () => ({ representation: 'one' }),
    },
  }
  runtime.player = {
    play() {
      return sdk.play()
    },
    player: () => sdk,
    video: () => video,
    controls: () => ({ ...controls }),
    captureResumePosition: () => ({ positionSec: video.currentTime, proof: {} }),
    performRestore(command: any, _guard: any) {
      command.kind === 'position' ? sdk.seek(command.value) : sdk.setPlaybackRate(command.value)
      return { kind: command.kind, proof: {} }
    },
    readRestore: () => ({ owned: true, status: 'settled' }),
    correctRestore() {},
  }
  const advance = (ms: number) => {
    const target = now + ms
    for (;;) {
      const next = [...timers.entries()]
        .filter(([, v]) => v.at <= target)
        .sort((a, b) => a[1].at - b[1].at)[0]
      if (!next) break
      now = next[1].at
      if (next[1].repeat) next[1].at += next[1].repeat
      else timers.delete(next[0])
      next[1].fn()
    }
    now = target
  }
  scope.defer(() => {
    registry.slot?.probe?.forceCleanup()
    timers.clear()
  })
  return {
    registry,
    env,
    runtime,
    sdk,
    video,
    state,
    controls,
    timers,
    advance,
    emitReload: () => {
      for (const listener of recoveryListeners)
        listener({
          type: 'recovery',
          action: { action: 'player-reload', id: 'owned-one', savedPositionSec: 50, savedRate: 1 },
        })
    },
    emitRequest: (requestId: string) => {
      for (const listener of routeListeners)
        listener({ type: 'request-started', request: { requestId, kind: 'video' } })
    },
    listeners: () => listeners,
    writes: () => writes,
  }
}
const options = (kind = 'S') => ({
  id: 'E-' + kind,
  kind,
  rate: 1,
  target: 50,
  catalog: [],
  remainingMs: 240000,
  leaseMs: 12000,
})

test('IR36 R2 progress point uses measured visible interior and rejects covered or invalid geometry', (t) => {
  testScope(t)
  assert.deepEqual(progressPoint({ left: 91, top: 450, width: 708, height: 4 }, 0.5), {
    x: 445,
    y: 452,
  })
  assert.throws(() => progressPoint({ left: 0, top: 0, width: 0, height: 4 }, 0.5))
  assert.throws(() => progressPoint({ left: 0, top: 0, width: 10, height: 4 }, 2))
})
test('IR36 R2 registry survives a caller losing the returned collector handle', (t) => {
  const f = fixture(t)
  installInstalledCase(f.registry, 'slot', f.runtime, options(), f.env)
  assert.equal(f.registry.slot.probe.status().id, 'E-S')
  assert.throws(() => installInstalledCase(f.registry, 'slot', f.runtime, options(), f.env))
  assert.equal(f.registry.slot.probe.forceCleanup().restored, true)
})
test('IR36 R2 partial installation preserves recoverable failure state and rolls resources back', (t) => {
  const f = fixture(t),
    original = f.runtime.routes.ids.next
  Object.defineProperty(f.sdk, 'seek', { get: () => () => {}, configurable: true })
  assert.throws(() => installInstalledCase(f.registry, 'slot', f.runtime, options(), f.env))
  assert.equal(f.registry.slot.state, 'failed')
  assert.equal(f.runtime.routes.ids.next, original)
  assert.equal(f.timers.size, 0)
  assert.equal(f.listeners(), 0)
})
test('IR36 R2 lease expiry preserves first stop time and tail isolation until explicit cleanup', (t) => {
  const f = fixture(t),
    p = installInstalledCase(f.registry, 'slot', f.runtime, options(), f.env)
  const id = f.runtime.routes.ids.next('request')
  f.advance(12001)
  const stopped = p.export().ended
  assert.ok(p.status().errors.includes('lease-expired'))
  assert.equal(p.status().collecting, false)
  f.runtime.routes.evidence.record('synthetic', 'video', { requestId: id })
  assert.equal(f.writes(), 0)
  f.advance(10000)
  assert.equal(p.export().ended, stopped)
  assert.equal(p.forceCleanup().timers, 0)
})
test('IR36 R2 hard attempt deadline cannot be extended by heartbeats', (t) => {
  const f = fixture(t),
    p = installInstalledCase(
      f.registry,
      'slot',
      f.runtime,
      { ...options(), remainingMs: 2000 },
      f.env,
    )
  f.advance(1500)
  p.heartbeat()
  f.advance(501)
  assert.ok(p.status().errors.includes('attempt-deadline'))
  assert.equal(p.status().collecting, false)
})
test('IR36 R2 capacity stop retains suppression and cannot silently stop deadline accounting', (t) => {
  const f = fixture(t),
    p = installInstalledCase(f.registry, 'slot', f.runtime, { ...options(), maxSamples: 2 }, f.env)
  f.advance(1001)
  assert.ok(p.status().errors.includes('sample-limit'))
  assert.equal(p.export().rows.length, 2)
  assert.equal(p.status().isolation.active, true)
})
test('IR36 R2 tail audit refuses detachment while original asynchronous record remains pending', async (t) => {
  const f = fixture(t)
  let resolve!: () => void
  const pending = new Promise<void>((r) => {
    resolve = r
  })
  f.runtime.routes.evidence.record = () => pending
  const p = installInstalledCase(f.registry, 'slot', f.runtime, options(), f.env)
  const id = f.runtime.routes.ids.next('request')
  assert.equal(f.runtime.routes.evidence.record('synthetic', 'video', { requestId: id }), pending)
  p.stopObservation()
  assert.equal(p.tail().pendingWrites, 1)
  assert.throws(() => p.finish())
  resolve()
  await pending
  await Promise.resolve()
  assert.equal(p.tail().pendingWrites, 0)
  assert.equal(p.finish().restored, true)
})
test('IR36 R2 all original work IDs and late writes remain blocked while unrelated work is forwarded', async (t) => {
  const f = fixture(t),
    guard = isolateWrites(f.runtime.routes.ids, f.runtime.routes.evidence, () => true)
  const ids = ['request', 'startup', 'challenge'].map((k) => f.runtime.routes.ids.next(k))
  guard.seal()
  for (const id of ids)
    await f.runtime.routes.evidence.record('synthetic', 'video', { requestId: id })
  await f.runtime.routes.evidence.record('synthetic', 'video', {
    requestId: f.runtime.routes.ids.next('request'),
  })
  assert.equal(f.writes(), 1)
  assert.equal(guard.snapshot().suppressed, 3)
  assert.equal(guard.stop().every(Boolean), true)
})
test('IR36 R2 SDK accessor restores receiver values and preserves a newer owner', (t) => {
  testScope(t)
  let fn = function (this: { marker: number }, v: number) {
    return this.marker + v
  }
  const original = fn,
    sdk: any = { marker: 7 }
  Object.defineProperty(sdk, 'seek', {
    get: () => fn,
    set: (v) => {
      fn = v
    },
    configurable: true,
  })
  const before = Object.getOwnPropertyDescriptor(sdk, 'seek'),
    stop = ownMethod(
      sdk,
      'seek',
      (f) =>
        function (this: unknown, ...args: unknown[]) {
          return Reflect.apply(f, this, args)
        },
    )
  assert.equal(sdk.seek(2), 9)
  assert.equal(stop(), true)
  assert.equal(fn, original)
  assert.deepEqual(Object.getOwnPropertyDescriptor(sdk, 'seek'), before)
  const stop2 = ownMethod(sdk, 'seek', (f) => f)
  fn = () => 99
  assert.equal(stop2(), false)
  assert.equal(sdk.seek(), 99)
})
test('IR36 R2 U pending does not require manufacturing a position mismatch', (t) => {
  const f = fixture(t),
    p = installInstalledCase(f.registry, 'slot', f.runtime, options('U'), f.env)
  p.arm()
  f.state.reloadCount = 1
  f.controls.reloadRevision = 1
  f.emitReload()
  f.sdk.reload()
  f.runtime.player.performRestore({ kind: 'position', value: 10, at: 0 }, { valid: () => true })
  assert.equal(p.status().pending, true)
  assert.equal(p.releasePending(), true)
  assert.equal(f.video.currentTime, 10)
})
test('IR36 R2 lost write isolation blocks arming and preserves the newer owner on cleanup', (t) => {
  const f = fixture(t),
    p = installInstalledCase(f.registry, 'slot', f.runtime, options(), f.env)
  const newer = () => Promise.resolve()
  f.runtime.routes.evidence.record = newer
  assert.equal(p.status().isolation.intact, false)
  assert.throws(() => p.arm(), /arm-prerequisites/)
  p.forceCleanup()
  assert.equal(f.runtime.routes.evidence.record, newer)
})
test('IR36 R2 SDK pending prevents finish and retains suppression through forced unload', async (t) => {
  const f = fixture(t),
    p = installInstalledCase(f.registry, 'slot', f.runtime, options('U'), f.env)
  p.arm()
  f.controls.reloadRevision = 1
  f.emitReload()
  f.sdk.reload()
  f.runtime.player.performRestore({ kind: 'position', value: 10, at: 0 }, { valid: () => true })
  assert.equal(p.tail().ready, false)
  assert.equal(p.tail().controlledPending, true)
  assert.throws(() => p.finish(), /controlled-tail-pending/)
  p.releasePending()
  await Promise.resolve()
  f.runtime.recovery.isRecovering = () => true
  assert.equal(p.tail().ready, false)
  assert.equal(p.tail().recoveryActive, true)
  assert.throws(() => p.finish(), /controlled-tail-pending/)
  const cleanup = p.forceCleanup()
  assert.equal(cleanup.guardHeldUntilUnload, true)
  await Promise.resolve()
  const late = f.runtime.routes.ids.next('request')
  await f.runtime.routes.evidence.record('synthetic', 'video', { requestId: late })
  assert.equal(f.writes(), 0)
  assert.equal(cleanup.timers, 0)
})
test('IR36 R2 forced unload cleanup retains ID and write suppression for unfinished transports', async (t) => {
  const f = fixture(t),
    p = installInstalledCase(f.registry, 'slot', f.runtime, options(), f.env)
  const id = f.runtime.routes.ids.next('request')
  f.emitRequest(id)
  p.stopObservation()
  const cleanup = p.forceCleanup()
  assert.equal(cleanup.guardHeldUntilUnload, true)
  await f.runtime.routes.evidence.record('synthetic', 'video', { requestId: id })
  const late = f.runtime.routes.ids.next('challenge')
  await f.runtime.routes.evidence.record('synthetic', 'video', { requestId: late })
  assert.equal(f.writes(), 0)
  assert.equal(cleanup.timers, 0)
})
test('IR36 R2 matches the legal reload event before the public snapshot publishes its count', (t) => {
  const f = fixture(t),
    p = installInstalledCase(f.registry, 'slot', f.runtime, options(), f.env)
  p.arm()
  f.controls.reloadRevision = 1
  f.emitReload()
  f.sdk.reload()
  assert.notEqual(p.status().reloadAt, null)
  assert.equal(f.state.reloadCount, 0)
})
test('IR36 R2 traces script play separately from website play without changing either call', (t) => {
  const f = fixture(t),
    p = installInstalledCase(f.registry, 'slot', f.runtime, options(), f.env)
  p.arm()
  f.state.reloadCount = 1
  f.controls.reloadRevision = 1
  f.emitReload()
  f.sdk.reload()
  f.sdk.play()
  f.runtime.player.play()
  assert.deepEqual(
    p
      .export()
      .events.filter((e: any) => e.kind === 'sdk-play')
      .map((e: any) => e.scriptOwned),
    [false, true],
  )
})
test('IR36 R2 correction evidence keeps the original command and product clock in the same time base', (t) => {
  const f = fixture(t),
    p = installInstalledCase(f.registry, 'slot', f.runtime, options(), f.env)
  p.arm()
  f.state.reloadCount = 1
  f.controls.reloadRevision = 1
  f.emitReload()
  f.sdk.reload()
  const a = f.runtime.player.performRestore(
    { kind: 'position', value: 50, at: 0 },
    { valid: () => true, now: f.env.now },
  )
  f.advance(1000)
  f.runtime.player.correctRestore(a)
  const event = p.export().events.find((e: any) => e.kind === 'correction-before')
  assert.equal(event.productAt - event.commandAt, 1000)
})
test('IR36 R2 S mismatch absence is invalid and forwards original seek without a fake fault', (t) => {
  const f = fixture(t),
    p = installInstalledCase(f.registry, 'slot', f.runtime, options(), f.env)
  p.arm()
  f.state.reloadCount = 1
  f.controls.reloadRevision = 1
  f.emitReload()
  f.sdk.reload()
  f.runtime.player.performRestore({ kind: 'position', value: 10, at: 0 }, { valid: () => true })
  assert.ok(p.status().errors.includes('position-mismatch-absent'))
  assert.equal(p.status().skipped.position, 0)
})
