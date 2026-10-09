import { createRuntimeIds } from "../../../src-v2/platform/runtime-ids.ts"
import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { RecoveryController } from '../../../src-v2/application/recovery-controller.ts'
import { PlayerMonitor } from '../../../src-v2/application/player-monitor.ts'
import { RouteCoordinator } from '../../../src-v2/application/route-coordinator.ts'
import { TransportContext } from '../../../src-v2/adapters/transport-context.ts'
import { MeasurementController, type MeasurementStatus } from '../../../src-v2/application/measurement-controller.ts'
import { MeasurementMetaStore } from '../../../src-v2/state/measurement-meta-store.ts'
import { SessionStore } from '../../../src-v2/state/session-store.ts'
import { SettingsStore } from '../../../src-v2/state/settings-store.ts'
import { RestrictionStore } from '../../../src-v2/state/restriction-store.ts'
import { SignedRouteVault } from '../../../src-v2/state/signed-route-vault.ts'
import { EvidenceStore } from '../../../src-v2/state/evidence-store.ts'
import { evidenceMetrics } from '../../../src-v2/domain/evidence.ts'
import type { PlayerPort, VideoSnapshot } from '../../../src-v2/application/ports.ts'
import { FakeStorage } from '../../support/storage.ts'
import { FakeClock } from '../../support/clock.ts'
import { deferred } from '../../support/deferred.ts'
import { testScope } from '../../support/scope.ts'
import { playurlResult } from '../../support/playurl.ts'
import { monitorRoutes, monitorMeasurement } from '../../support/controllers.ts'

const rootUrl = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/c/d/2.m4s?k=synthetic'

function recoveryFixture(t: TestContext) {
  const scope = testScope(t), clock = scope.own(new FakeClock())
  let video: VideoSnapshot = { available: true, paused: false, seeking: false, ended: false,
    readyState: 4, currentTime: 120, duration: 600, width: 1920, height: 1080,
    playbackRate: 1.5, effectiveRate: 1.5, bufferAheadSec: 60, playableBufferSec: 40,
    bufferedToEnd: false, frames: 100, mediaError: false, coreInitialized: true, manifestHasVideo: true }
  const effects: { seeks: number[]; rates: number[]; plays: number; reloads: number } = { seeks: [], rates: [], plays: 0, reloads: 0 }
  let play: () => unknown = () => undefined
  const player = { snapshot: () => video, currentTime: () => video.currentTime,
    playbackRate: () => video.playbackRate, observePlayIntent: () => () => undefined,
    reload: () => { effects.reloads++ }, seek: (value: number) => { effects.seeks.push(value) },
    setRate: (value: number) => { effects.rates.push(value) }, play: () => { effects.plays++; return play() },
    reset: () => undefined, syncManifest: () => true } satisfies PlayerPort
  const recovery = scope.own(new RecoveryController(player, clock.now))
  scope.defer(() => recovery.reset())
  const set = (patch: Partial<VideoSnapshot>) => { video = { ...video, ...patch } }
  recovery.tick(video)
  recovery.armRouteFailure('route-failure', video)
  set({ readyState: 0, width: 0, height: 0, coreInitialized: false, playableBufferSec: 0 })
  clock.advance(4000); recovery.tick(video)
  assert.equal(effects.reloads, 1, 'fixture reached a genuine controller reload')
  return { scope, clock, recovery, effects, set, tick: () => recovery.tick(video), setPlay: (value: () => unknown) => { play = value } }
}

test('C-01 control: healthy core recovery restores saved position and user rate', t => {
  const f = recoveryFixture(t)
  f.set({ readyState: 3, width: 1920, height: 1080, coreInitialized: true })
  f.tick()
  assert.deepEqual(f.effects.seeks, [120]); assert.deepEqual(f.effects.rates, [1.5])
  assert.equal(f.effects.plays, 1); assert.equal(f.recovery.snapshot().state, 'recovered')
})

test('C-01 control: seeking before the core becomes healthy cancels recovery', t => {
  const f = recoveryFixture(t)
  f.set({ seeking: true, currentTime: 300 }); f.tick()
  assert.deepEqual(f.effects.seeks, []); assert.equal(f.effects.plays, 0)
  assert.equal(f.recovery.snapshot().reason, 'seek-interrupted')
})

test('C-01 repro: seeking on the first healthy reload snapshot must cancel before restoring', t => {
  const f = recoveryFixture(t)
  f.set({ seeking: true, currentTime: 300, readyState: 3, width: 1920, height: 1080, coreInitialized: true }); f.tick()
  assert.deepEqual(f.effects.seeks, [], 'recovery must not overwrite the user seek to 300 seconds with the saved 120 seconds')
  assert.equal(f.effects.plays, 0); assert.equal(f.recovery.snapshot().reason, 'seek-interrupted')
})

test('C-01 repro: ended on the first healthy reload snapshot must not seek or restart playback', t => {
  const f = recoveryFixture(t)
  f.set({ ended: true, paused: true, currentTime: 600, readyState: 4, width: 1920, height: 1080, coreInitialized: true }); f.tick()
  assert.deepEqual(f.effects.seeks, [], 'ended playback must not be rewound by recovery')
  assert.equal(f.effects.plays, 0); assert.equal(f.recovery.snapshot().reason, 'ended')
})

function routeFixture(scope: ReturnType<typeof testScope>, clock: FakeClock, storage: FakeStorage) {
  const settings = scope.own(new SettingsStore(storage, clock.now))
  const restrictions = scope.own(new RestrictionStore(storage, clock.now))
  const evidence = scope.own(new EvidenceStore(storage, clock.now))
  const session = new SessionStore(), state = session.beginGeneration(false), vault = new SignedRouteVault()
  vault.reset(state.generation, state.epoch)
  const representation = vault.register({ generation: state.generation, epoch: state.epoch, kind: 'video', key: '80:av1',
    height: 1080, codec: 'av1', bandwidth: 3_000_000, urls: [rootUrl], source: 'trusted-api' })
  assert.ok(representation)
  session.setRepresentation(representation)
  const routes = new RouteCoordinator(clock, session, settings, restrictions, evidence, vault, createRuntimeIds())
  const transport = new TransportContext(session, settings, routes, { transform: () => playurlResult(true) },
    { willGateStartup: () => false, prepareStartup: async () => undefined, noteUnpreflighted: () => undefined }, clock.now, createRuntimeIds())
  return { session, settings, restrictions, evidence, vault, representation, routes, transport }
}

async function success(f: ReturnType<typeof routeFixture>, clock: FakeClock, bytes: number) {
  const applied = f.routes.apply(rootUrl)
  assert.equal(applied.decision.action, 'rewrite'); assert.ok(applied.url)
  const started = clock.now(), request = f.transport.request(applied, rootUrl, applied.url, started, 'GET')
  clock.advance(100)
  await f.routes.observe(f.transport.observation(request, applied, rootUrl, applied.url, applied.url, 206,
    bytes, started, started + 10, 'success', undefined, true))
  return { request, host: applied.decision.host! }
}

test('C-02 control: two requests in one page preserve independent evidence', async t => {
  const scope = testScope(t), clock = scope.own(new FakeClock()), f = routeFixture(scope, clock, new FakeStorage())
  scope.defineGlobal('location', { configurable: true, value: { href: 'https://www.bilibili.com/video/synthetic' } })
  const first = await success(f, clock, 128 * 1024), second = await success(f, clock, 256 * 1024)
  assert.equal(first.host, second.host); assert.notEqual(first.request.requestId, second.request.requestId)
  assert.equal(f.evidence.get(second.host, 'video')?.samples.length, 2)
  assert.equal(evidenceMetrics(f.evidence.get(second.host, 'video'), clock.now()).state, 'proven')
})

test('C-02 repro: independent page instances must not overwrite matching request serial evidence', async t => {
  const scope = testScope(t), clock = scope.own(new FakeClock()), storage = new FakeStorage()
  scope.defineGlobal('location', { configurable: true, value: { href: 'https://www.bilibili.com/video/synthetic' } })
  const firstPage = routeFixture(scope, clock, storage), first = await success(firstPage, clock, 128 * 1024)
  const secondPage = routeFixture(scope, clock, storage), second = await success(secondPage, clock, 256 * 1024)
  assert.equal(first.host, second.host, 'both independently completed transfers observed the same Catalog host')
  assert.equal(secondPage.evidence.get(second.host, 'video')?.samples.length, 2,
    'a second page request is independent; its local serial must not replace persisted history')
  assert.equal(evidenceMetrics(secondPage.evidence.get(second.host, 'video'), clock.now()).state, 'proven')
})

test('C-02 repro: independent startup controllers must preserve both measurement samples', async t => {
  const scope = testScope(t), clock = scope.own(new FakeClock()), storage = new FakeStorage()
  const firstPage = routeFixture(scope, clock, storage)
  const first = firstPage.routes.startupOptions(rootUrl)?.candidates[0]; assert.ok(first)
  await firstPage.routes.recordStartupSuccess(first, 128 * 1024, 100, 10)
  clock.advance(100)
  const secondPage = routeFixture(scope, clock, storage)
  const second = secondPage.routes.startupOptions(rootUrl)?.candidates.find(candidate => candidate.host === first.host); assert.ok(second)
  await secondPage.routes.recordStartupSuccess(second, 256 * 1024, 100, 10)
  assert.equal(secondPage.evidence.get(second.host, 'video')?.samples.length, 2,
    'startup sample IDs must be unique across independent RouteCoordinator instances')
})

class HeldMeasurementStorage extends FakeStorage {
  readonly completed = deferred<void>()
  readonly gate = deferred<void>()
  readonly wrote = deferred<void>()
  override async withLock<T>(name: string, task: () => T | Promise<T>): Promise<T> {
    if (name === 'measurement') await this.gate.promise
    try { return await task() } finally { if (name === 'measurement') this.completed.resolve() }
  }
  override set<T>(key: string, value: T): void { super.set(key, value); if (key.endsWith('.meta')) this.wrote.resolve() }
}

async function measurementLockFixture(t: TestContext, unsafe: boolean | Partial<MeasurementStatus>) {
  const scope = testScope(t), clock = scope.own(new FakeClock()), storage = new HeldMeasurementStorage()
  const f = routeFixture(scope, clock, storage), meta = new MeasurementMetaStore(storage, clock.now)
  let probes = 0
  const probed = deferred<void>()
  const measurement = scope.own(new MeasurementController(f.routes, meta, { read: async () => {
    probes++; probed.resolve(); return { bytes: 128 * 1024, elapsedMs: 100, ttfbMs: 10, status: 206, directRange: true, reason: 'measured' }
  } }, clock.now, clock))
  scope.defer(() => storage.gate.resolve())
  const status = { generationActive: true, representation: f.representation, demand: { kind: 'video' as const, requiredMbps: 4, highDemand: false },
    stableProgressSec: 30, playableBufferSec: 60, visible: true, seeking: false, recovering: false, disabled: false }
  measurement.tick(status)
  if (unsafe) measurement.tick({ ...status, ...(unsafe === true ? { visible: false } : unsafe) })
  clock.advance(1234)
  storage.gate.resolve()
  await storage.completed.promise
  if (!unsafe) await probed.promise
  // A microtask checkpoint flushes the lock callback's direct continuation, not a timing delay.
  await Promise.resolve(); await Promise.resolve()
  return { meta, probes: () => probes, clock, measurement, routes: f.routes, representation: f.representation, status }
}

test('C-03 control: safe status on lock acquisition starts a measured round', async t => {
  const f = await measurementLockFixture(t, false)
  assert.ok(f.probes() > 0); assert.equal(f.meta.get().lastChallengeAt, f.clock.now())
})

test('C-03 repro: hidden while waiting for measurement lock must not consume a ten-minute cooldown', async t => {
  const f = await measurementLockFixture(t, true)
  assert.equal(f.probes(), 0, 'unsafe status correctly prevents network work')
  assert.equal(f.meta.get().lastChallengeAt, 0, 'aborted planning must not charge cross-tab cooldown before any probe starts')
  assert.equal(f.meta.get().catalogCursor, 0)
})

for (const patch of [{ seeking: true }, { recovering: true }, { playableBufferSec: 0 }, { representation: null }, { disabled: true }]) {
  test(`C-03 ${Object.keys(patch)[0]} changes while waiting do not consume cooldown or candidate attempts`, async t => {
    const f = await measurementLockFixture(t, patch)
    assert.equal(f.probes(), 0); assert.equal(f.meta.get().lastChallengeAt, 0); assert.equal(f.meta.get().catalogCursor, 0)
    assert.ok(f.routes.challenge(f.representation, f.status.demand, false), 'candidate remains available after cancelled planning')
  })
}

test('C-02 startup and challenge samples deduplicate one work item and preserve independent reloads', async t => {
  const scope = testScope(t), clock = scope.own(new FakeClock()), storage = new FakeStorage()
  const first = routeFixture(scope, clock, storage), second = routeFixture(scope, clock, storage)
  const a = first.routes.challenge(first.representation, { kind: 'video', requiredMbps: 4, highDemand: false }, false)
  const b = second.routes.challenge(second.representation, { kind: 'video', requiredMbps: 4, highDemand: false }, false)
  assert.ok(a && b); assert.equal(a.decision.host, b.decision.host)
  await first.routes.recordChallenge(a, 128 * 1024, 100, 10, 'success', null)
  await first.routes.recordChallenge(a, 128 * 1024, 100, 10, 'success', null)
  await second.routes.recordChallenge(b, 128 * 1024, 100, 10, 'success', null)
  assert.equal(second.evidence.get(b.decision.host!, 'video')?.samples.length, 2)
  const startup = second.routes.startupOptions(rootUrl)?.candidates[0]; assert.ok(startup)
  await second.routes.recordStartupSuccess(startup, 128 * 1024, 100, 10)
  const count = second.evidence.get(startup.host, 'video')?.samples.length
  await second.routes.recordStartupSuccess(startup, 128 * 1024, 100, 10)
  assert.equal(second.evidence.get(startup.host, 'video')?.samples.length, count)
})

test('C-02 runtime IDs use opaque bounded namespaces for every work kind', () => {
  const first = createRuntimeIds(bytes => bytes.fill(1)), second = createRuntimeIds(bytes => bytes.fill(2))
  const ids = [first.next('request'), first.next('startup'), first.next('challenge'), first.next('request'), second.next('request')]
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(ids.every(id => id.length <= 64 && /^[rsc]:[0-9a-f]{32}:[0-9a-z]+$/.test(id)))
})

test('C-01 media error on first healthy snapshot prevents all restore side effects', t => {
  const f = recoveryFixture(t)
  f.set({ mediaError: true, readyState: 4, width: 1920, coreInitialized: true }); f.tick()
  assert.deepEqual(f.effects.seeks, []); assert.deepEqual(f.effects.rates, []); assert.equal(f.effects.plays, 0)
  assert.equal(f.recovery.snapshot().reason, 'media-error')
})

function stalledStartup(t: TestContext, initialPosition: number, progressing = false) {
  const scope = testScope(t), clock = scope.own(new FakeClock()), storage = new FakeStorage(), f = routeFixture(scope, clock, storage)
  let video: VideoSnapshot = { available: true, paused: false, seeking: false, ended: false,
    readyState: 0, currentTime: initialPosition, duration: 600, width: 0, height: 0,
    playbackRate: 1, effectiveRate: 1, bufferAheadSec: 0, playableBufferSec: 0,
    bufferedToEnd: false, frames: 0, mediaError: false, coreInitialized: false, manifestHasVideo: true }
  let reloads = 0, startupFallbacks = 0, watchdogFallbacks = 0
  const player = { snapshot: () => video, currentTime: () => video.currentTime,
    playbackRate: () => video.playbackRate, observePlayIntent: () => () => undefined,
    reload: () => { reloads++ }, seek: () => undefined, setRate: () => undefined,
    play: () => undefined, reset: () => undefined, syncManifest: () => true } satisfies PlayerPort
  const recovery = scope.own(new RecoveryController(player, clock.now)); scope.defer(() => recovery.reset())
  const start = clock.now(), state = f.session.get()
  const routes = monitorRoutes({ firstMediaAt: () => start,
    latestRequested: () => ({ generation: state.generation, epoch: state.epoch, representation: f.representation, targetHost: 'upos-sz-mirrorali.bilivideo.com' }),
    recover: () => { watchdogFallbacks++; recovery.armRouteFailure('route-failure', video) },
    recoverStartup: () => { startupFallbacks++; return { host: 'upos-sz-mirrorcos.bilivideo.com' } } })
  const monitor = scope.own(new PlayerMonitor(player, f.session, f.settings, f.vault, routes,
    monitorMeasurement(), recovery, () => true, clock.now, clock))
  monitor.tick()
  for (let i = 0; i < 19; i++) {
    clock.advance(1000)
    if (progressing) video = { ...video, currentTime: video.currentTime + 1, readyState: 4, width: 1920, height: 1080,
      coreInitialized: true, frames: (video.frames ?? 0) + 30, playableBufferSec: 40 }
    monitor.tick()
  }
  return { reloads, startupFallbacks, watchdogFallbacks, snapshot: monitor.snapshot() }
}

test('C-04 control: zero-position startup stall submits fallback and reloads once', t => {
  const f = stalledStartup(t, 0)
  assert.equal(f.startupFallbacks, 1); assert.equal(f.reloads, 1)
})

test('C-04 control: resumed playback with real progress does not rescue startup', t => {
  const f = stalledStartup(t, 120, true)
  assert.equal(f.startupFallbacks, 0); assert.equal(f.reloads, 0)
})

test('C-04 repro: a nonzero resume position alone must not count as observed startup progress', t => {
  const f = stalledStartup(t, 120)
  assert.equal(f.startupFallbacks, 1, 'a constant initial 120-second position with no frames or buffer still needs startup rescue')
  assert.equal(f.reloads, 1)
})

test('C-05 control: current restore play rejection reports recovered-paused', async t => {
  const f = recoveryFixture(t), play = deferred<void>()
  f.setPlay(() => play.promise)
  f.set({ readyState: 3, width: 1920, height: 1080, coreInitialized: true }); f.tick()
  play.reject(new Error('synthetic autoplay rejection')); await Promise.resolve()
  assert.equal(f.recovery.snapshot().state, 'recovered-paused')
  assert.equal(f.recovery.snapshot().reason, 'play-rejected')
})

test('C-05 control: reset invalidates a pending restore play rejection', async t => {
  const f = recoveryFixture(t), play = deferred<void>()
  f.setPlay(() => play.promise)
  f.set({ readyState: 3, width: 1920, height: 1080, coreInitialized: true }); f.tick()
  f.recovery.reset()
  play.reject(new Error('synthetic old-lifecycle rejection')); await Promise.resolve()
  assert.equal(f.recovery.snapshot().state, 'healthy')
})

test('C-05 repro: old restore play rejection must not overwrite a later completed recovery', async t => {
  const f = recoveryFixture(t), firstPlay = deferred<void>()
  f.setPlay(() => firstPlay.promise)
  f.set({ readyState: 3, width: 1920, height: 1080, coreInitialized: true }); f.tick()
  assert.equal(f.recovery.snapshot().state, 'recovered')
  f.clock.advance(90_000)
  f.setPlay(() => undefined)
  f.set({ currentTime: 220, readyState: 4 }); f.tick()
  // Route failure after the reload breaker has expired creates a distinct action in the same lifecycle.
  f.recovery.armRouteFailure('watchdog', { available: true, paused: false, seeking: false, ended: false,
    readyState: 4, currentTime: 220, duration: 600, width: 1920, height: 1080, playbackRate: 1.5,
    effectiveRate: 1.5, bufferAheadSec: 0, playableBufferSec: 0, bufferedToEnd: false, frames: 100,
    mediaError: false, coreInitialized: true, manifestHasVideo: true })
  f.set({ readyState: 0, width: 0, height: 0, coreInitialized: false }); f.clock.advance(4000); f.tick()
  f.set({ readyState: 3, width: 1920, height: 1080, coreInitialized: true }); f.tick()
  assert.equal(f.effects.reloads, 2); assert.equal(f.recovery.snapshot().state, 'recovered')
  firstPlay.reject(new Error('synthetic old-action rejection')); await Promise.resolve()
  assert.equal(f.recovery.snapshot().state, 'recovered', 'the previous action no longer owns current recovery status')
  assert.equal(f.recovery.snapshot().savedPositionSec, 220)
})
