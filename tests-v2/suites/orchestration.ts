import '../regressions/functional-races/runtime.ts'
import { createRuntimeIds } from "../../src-v2/platform/runtime-ids.ts"
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { playurlResult } from '../support/playurl.ts'
import { RuntimeController } from '../../src-v2/application/runtime-controller.ts'
import { LifecycleController } from '../../src-v2/application/lifecycle-controller.ts'
import { ControlCommands } from '../../src-v2/application/control-commands.ts'
import { RouteCoordinator } from '../../src-v2/application/route-coordinator.ts'
import { SessionStore } from '../../src-v2/state/session-store.ts'
import { SettingsStore } from '../../src-v2/state/settings-store.ts'
import { RestrictionStore } from '../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../src-v2/state/evidence-store.ts'
import { SignedRouteVault } from '../../src-v2/state/signed-route-vault.ts'
import { MeasurementMetaStore } from '../../src-v2/state/measurement-meta-store.ts'
import type { VideoSnapshot, NavigationPort } from '../../src-v2/application/ports.ts'
import type { DomainEvent } from '../../src-v2/domain/model.ts'
import { decisionId, generationId, epochId, representationId, recoveryActionId } from '../../src-v2/domain/model.ts'
import { TRUSTED_CATALOG } from '../../src-v2/domain/catalog.ts'
import { FakeStorage } from '../support/storage.ts'
import { FakeClock } from '../support/clock.ts'
import { testScope } from '../support/scope.ts'

// Each call creates fresh resources and replays only this fixture's prerequisite transitions.
// Earlier expectations run in their own cases; no mutable state crosses a test boundary.
async function fixture(t: TestContext, scenario: number, parameter = 0): Promise<() => Promise<void>> {
  const scope = testScope(t)
const clock = scope.own(new FakeClock()), storage = new FakeStorage()
const settings = scope.own(new SettingsStore(storage, clock.now)), session = new SessionStore()
const calls: string[] = []
const video: VideoSnapshot = { available: true, paused: false, seeking: false, ended: false, readyState: 4,
    currentTime: 10, duration: 100, width: 1920, height: 1080, playbackRate: 1.5, effectiveRate: 1.5,
    bufferAheadSec: 60, playableBufferSec: 40, bufferedToEnd: false, frames: 100, mediaError: false,
    coreInitialized: true, manifestHasVideo: true }
let routeListener: (event: DomainEvent) => void = () => undefined, comparison = false
const routeControl = {
    subscribe(listener: (event: DomainEvent) => void) { routeListener = listener; return () => { routeListener = () => undefined } },
    isOriginalComparison: () => comparison, invalidateForUserSetting: () => { calls.push('routes.invalidate') },
  } satisfies ConstructorParameters<typeof RuntimeController>[2]
const monitor = {
    subscribe: () => () => { calls.push('monitor.unsubscribe') },
    snapshot: () => ({ video, stableProgressSec: 20, watchdog: 'healthy' as const, stallTicks: 0,
      startupRescue: { state: 'not-needed' as const, ageSec: 0 } }),
    start: () => { calls.push('monitor.start') }, stop: () => { calls.push('monitor.stop') }, reset: () => { calls.push('monitor.reset') },
  } satisfies ConstructorParameters<typeof RuntimeController>[4]
const runtime = scope.own(new RuntimeController(session, settings, routeControl,
    { snapshot: () => video, reset: () => { calls.push('player.reset') } }, monitor,
    { reset: () => { calls.push('measurement.reset') } },
    { reset: () => { calls.push('recovery.reset') }, subscribe: () => () => undefined, armRouteFailure: () => { calls.push('recovery.arm') } },
    { setEnabled: () => { calls.push('visibility') } },
    { record: () => { calls.push('diagnostic.event') }, recordPlayer: () => { calls.push('diagnostic.player') } }, clock.now, { subscribeEpoch: () => () => undefined }))
runtime.install();
runtime.install();
calls.length = 0
await settings.update({ considerNativeSources: true })
if (scenario === 0) return async () => {
assert.strictEqual(calls.join(','), 'visibility,routes.invalidate,measurement.reset,recovery.reset', 'Native switch invalidates plans before cancelling probe and recovery work')
calls.length = 0
storage.remote('bilicdn.v2.settings', { ...settings.get(), considerNativeSources: false, updatedAt: settings.get().updatedAt + 1 })
assert.strictEqual(calls.join(','), 'visibility,routes.invalidate,measurement.reset,recovery.reset', 'remote settings use the same coordination path')
calls.length = 0;
await settings.update({ codec: 'hevc' })
assert.strictEqual(calls.join(','), 'visibility', 'unrelated setting does not reset route or recovery')
runtime.reset()
assert.strictEqual(calls.slice(1).join(','), 'monitor.reset,measurement.reset,recovery.reset,player.reset', 'generation reset has one explicit owner and order')
const fallback: DomainEvent = { type: 'recovery', at: clock.now(), action: { action: 'route-fallback',
    id: recoveryActionId('test-recovery'), kind: 'video', identity: { generation: generationId(1), epoch: epochId(0),
      representation: representationId('test-rep'), authorityRevision: 1, kind: 'video' },
    decision: { action: 'pass', id: decisionId('fallback'), reason: 'test', routeType: 'root-original', host: TRUSTED_CATALOG[0], ranking: [] } } }
calls.length = 0;
routeListener(fallback)
assert.strictEqual(calls.join(','), 'diagnostic.event,diagnostic.player,recovery.arm', 'fallback records observation and arms only application-owned recovery')
comparison = true;
calls.length = 0;
routeListener(fallback)
assert.strictEqual(calls.join(','), 'diagnostic.event', 'comparison prevents fallback recovery effects')
runtime.dispose();
calls.length = 0;
routeListener(fallback)
assert.strictEqual(calls.length, 0, 'runtime disposal removes routing subscription')
const restrictions = scope.own(new RestrictionStore(storage, clock.now)), evidence = scope.own(new EvidenceStore(storage, clock.now))
const meta = new MeasurementMetaStore(storage, clock.now)
const commands = new ControlCommands(settings, { add: input => { calls.push('blacklist:' + input.kind); return restrictions.add(input) },
    clear: async () => { calls.push('restrictions.clear'); await restrictions.clear() } },
    { clear: async () => { calls.push('evidence.clear'); await evidence.clear() } },
    { clear: () => { calls.push('meta.clear'); meta.clear() } },
    { latestVideoHost: () => TRUSTED_CATALOG[0], invalidateForUserSetting: () => { calls.push('routes.invalidate') },
      setOriginalComparison: () => { calls.push('comparison') } },
    { reset: () => { calls.push('measurement.reset') }, requestManual: () => { calls.push('manual') } },
    { reset: () => { calls.push('recovery.reset') } }, clock.now)
commands.setOriginalComparison(true)
assert.strictEqual(calls.join(','), 'comparison,measurement.reset,recovery.reset', 'comparison command coordinates all affected controllers')
}
void (calls.join(','));
void ('visibility,routes.invalidate,measurement.reset,recovery.reset');
calls.length = 0
storage.remote('bilicdn.v2.settings', { ...settings.get(), considerNativeSources: false, updatedAt: settings.get().updatedAt + 1 })
void (calls.join(','));
void ('visibility,routes.invalidate,measurement.reset,recovery.reset');
calls.length = 0;
await settings.update({ codec: 'hevc' })
void (calls.join(','));
void ('visibility');
runtime.reset()
void (calls.slice(1).join(','));
void ('monitor.reset,measurement.reset,recovery.reset,player.reset');
const fallback: DomainEvent = { type: 'recovery', at: clock.now(), action: { action: 'route-fallback',
    id: recoveryActionId('test-recovery'), kind: 'video', identity: { generation: generationId(1), epoch: epochId(0),
      representation: representationId('test-rep'), authorityRevision: 1, kind: 'video' },
    decision: { action: 'pass', id: decisionId('fallback'), reason: 'test', routeType: 'root-original', host: TRUSTED_CATALOG[0], ranking: [] } } }
calls.length = 0;
routeListener(fallback)
void (calls.join(','));
void ('diagnostic.event,diagnostic.player,recovery.arm');
comparison = true;
calls.length = 0;
routeListener(fallback)
void (calls.join(','));
void ('diagnostic.event');
runtime.dispose();
calls.length = 0;
routeListener(fallback)
void (calls.length);
void (0);
const restrictions = scope.own(new RestrictionStore(storage, clock.now)), evidence = scope.own(new EvidenceStore(storage, clock.now))
const meta = new MeasurementMetaStore(storage, clock.now)
const commands = new ControlCommands(settings, { add: input => { calls.push('blacklist:' + input.kind); return restrictions.add(input) },
    clear: async () => { calls.push('restrictions.clear'); await restrictions.clear() } },
    { clear: async () => { calls.push('evidence.clear'); await evidence.clear() } },
    { clear: () => { calls.push('meta.clear'); meta.clear() } },
    { latestVideoHost: () => TRUSTED_CATALOG[0], invalidateForUserSetting: () => { calls.push('routes.invalidate') },
      setOriginalComparison: () => { calls.push('comparison') } },
    { reset: () => { calls.push('measurement.reset') }, requestManual: () => { calls.push('manual') } },
    { reset: () => { calls.push('recovery.reset') } }, clock.now)
commands.setOriginalComparison(true)
void (calls.join(','));
void ('comparison,measurement.reset,recovery.reset');
calls.length = 0;
await commands.blacklistLatestVideo()
if (scenario === 1) return async () => {
assert.strictEqual(calls.join(','), 'blacklist:all,routes.invalidate', 'blacklist command persists before route invalidation')
assert.strictEqual(restrictions.has(TRUSTED_CATALOG[0], 'audio', 'black'), true, 'UI blacklist remains applicable to audio')
meta.update({ catalogCursor: 2, lastChallengeAt: clock.now() });
calls.length = 0;
await commands.clearLearning()
assert.strictEqual(calls.join(','), 'evidence.clear,restrictions.clear,meta.clear', 'learning clear order is application-owned')
assert.strictEqual(storage.values.has('bilicdn.v2.meta'), false, 'measurement metadata cleared through its store')
const vault = new SignedRouteVault(), routes = new RouteCoordinator(clock, session, settings, restrictions, evidence, vault, createRuntimeIds())
let pageKey = '/video/a', transformed = 0, accept = true
let navigationListener: () => void = () => undefined
const navigation: NavigationPort = { key: () => pageKey, subscribe(listener) { navigationListener = listener; return () => { navigationListener = () => undefined } } }
const lifecycle = scope.own(new LifecycleController(session, settings, vault, routes,
    { transform: () => { transformed++; return playurlResult(accept) } }, { install: () => undefined, dispose: () => undefined },
    monitor, clock.now, navigation, clock))
assert.strictEqual(typeof location, 'undefined', 'lifecycle contract has no browser globals')
lifecycle.start();
const initial = session.get().generation;
lifecycle.start()
assert.strictEqual(session.get().generation, initial, 'lifecycle installation is idempotent')
lifecycle.acceptPageAssignment({}, 1);
clock.advance(0)
assert.strictEqual(transformed, 1, 'accepted page assignment is not ingested twice by microtask')
pageKey = '/video/b';
navigationListener()
assert.ok(session.get().generation !== initial, 'navigation observation advances generation without browser API access')
}
void (calls.join(','));
void ('blacklist:all,routes.invalidate');
void (restrictions.has(TRUSTED_CATALOG[0], 'audio', 'black'));
void (true);
meta.update({ catalogCursor: 2, lastChallengeAt: clock.now() });
calls.length = 0;
await commands.clearLearning()
void (calls.join(','));
void ('evidence.clear,restrictions.clear,meta.clear');
void (storage.values.has('bilicdn.v2.meta'));
void (false);
const vault = new SignedRouteVault(), routes = new RouteCoordinator(clock, session, settings, restrictions, evidence, vault, createRuntimeIds())
let pageKey = '/video/a', transformed = 0, accept = true
let navigationListener: () => void = () => undefined
const navigation: NavigationPort = { key: () => pageKey, subscribe(listener) { navigationListener = listener; return () => { navigationListener = () => undefined } } }
const lifecycle = scope.own(new LifecycleController(session, settings, vault, routes,
    { transform: () => { transformed++; return playurlResult(accept) } }, { install: () => undefined, dispose: () => undefined },
    monitor, clock.now, navigation, clock))
void (typeof location);
void ('undefined');
lifecycle.start();
const initial = session.get().generation;
lifecycle.start()
void (session.get().generation);
void (initial);
lifecycle.acceptPageAssignment({}, 1);
clock.advance(0)
void (transformed);
void (1);
pageKey = '/video/b';
navigationListener()
void (session.get().generation !== initial);
await settings.update({ disabled: true })
if (scenario === 2) return async () => {
assert.strictEqual(session.get().disabled, true, 'disable starts a disabled generation')
await settings.update({ disabled: false })
accept = false;
lifecycle.acceptPageAssignment({}, 2);
const beforeDispose = transformed
lifecycle.dispose();
clock.advance(0)
assert.strictEqual(transformed, beforeDispose, 'disposed lifecycle ignores queued page assignments')
}
void (session.get().disabled);
void (true);
await settings.update({ disabled: false })
accept = false;
lifecycle.acceptPageAssignment({}, 2);
const beforeDispose = transformed
lifecycle.dispose();
clock.advance(0)
void (transformed);
void (beforeDispose);
throw Error('Unknown fixture scenario')
}

test("Native switch invalidates plans before cancelling probe and recovery work [1]", { timeout: 5000 }, async t => { await (await fixture(t, 0))() })
test("blacklist command persists before route invalidation [2]", { timeout: 5000 }, async t => { await (await fixture(t, 1))() })
test("disable starts a disabled generation [3]", { timeout: 5000 }, async t => { await (await fixture(t, 2))() })
