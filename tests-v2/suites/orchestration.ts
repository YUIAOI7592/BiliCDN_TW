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
import { check, equal, assertionCount } from '../support/assert.ts'

const scope = testScope()
try {
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
    { record: () => { calls.push('diagnostic.event') }, recordPlayer: () => { calls.push('diagnostic.player') } }, clock.now))
  runtime.install(); runtime.install(); calls.length = 0
  await settings.update({ considerNativeSources: true })
  equal(calls.join(','), 'visibility,routes.invalidate,measurement.reset,recovery.reset', 'Native switch invalidates plans before cancelling probe and recovery work')
  calls.length = 0
  storage.remote('bilicdn.v2.settings', { ...settings.get(), considerNativeSources: false, updatedAt: settings.get().updatedAt + 1 })
  equal(calls.join(','), 'visibility,routes.invalidate,measurement.reset,recovery.reset', 'remote settings use the same coordination path')
  calls.length = 0; await settings.update({ codec: 'hevc' })
  equal(calls.join(','), 'visibility', 'unrelated setting does not reset route or recovery')
  runtime.reset()
  equal(calls.slice(1).join(','), 'monitor.reset,measurement.reset,recovery.reset,player.reset', 'generation reset has one explicit owner and order')
  const fallback: DomainEvent = { type: 'recovery', at: clock.now(), action: { action: 'route-fallback',
    id: recoveryActionId('test-recovery'), kind: 'video', identity: { generation: generationId(1), epoch: epochId(0),
      representation: representationId('test-rep'), authorityRevision: 1, kind: 'video' },
    decision: { action: 'pass', id: decisionId('fallback'), reason: 'test', routeType: 'root-original', host: TRUSTED_CATALOG[0], ranking: [] } } }
  calls.length = 0; routeListener(fallback)
  equal(calls.join(','), 'diagnostic.event,diagnostic.player,recovery.arm', 'fallback records observation and arms only application-owned recovery')
  comparison = true; calls.length = 0; routeListener(fallback)
  equal(calls.join(','), 'diagnostic.event', 'comparison prevents fallback recovery effects')
  runtime.dispose(); calls.length = 0; routeListener(fallback)
  equal(calls.length, 0, 'runtime disposal removes routing subscription')

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
  equal(calls.join(','), 'comparison,measurement.reset,recovery.reset', 'comparison command coordinates all affected controllers')
  calls.length = 0; await commands.blacklistLatestVideo()
  equal(calls.join(','), 'blacklist:all,routes.invalidate', 'blacklist command persists before route invalidation')
  equal(restrictions.has(TRUSTED_CATALOG[0], 'audio', 'black'), true, 'UI blacklist remains applicable to audio')
  meta.update({ catalogCursor: 2, lastChallengeAt: clock.now() }); calls.length = 0; await commands.clearLearning()
  equal(calls.join(','), 'evidence.clear,restrictions.clear,meta.clear', 'learning clear order is application-owned')
  equal(storage.values.has('bilicdn.v2.meta'), false, 'measurement metadata cleared through its store')

  const vault = new SignedRouteVault(), routes = new RouteCoordinator(clock, session, settings, restrictions, evidence, vault)
  let pageKey = '/video/a', transformed = 0, accept = true
  let navigationListener: () => void = () => undefined
  const navigation: NavigationPort = { key: () => pageKey, subscribe(listener) { navigationListener = listener; return () => { navigationListener = () => undefined } } }
  const lifecycle = scope.own(new LifecycleController(session, settings, vault, routes,
    { transform: () => { transformed++; return accept } }, { install: () => undefined, dispose: () => undefined },
    monitor, clock.now, navigation, clock))
  equal(typeof location, 'undefined', 'lifecycle contract has no browser globals')
  lifecycle.start(); const initial = session.get().generation; lifecycle.start()
  equal(session.get().generation, initial, 'lifecycle installation is idempotent')
  lifecycle.acceptPageAssignment({}, 1); clock.advance(0)
  equal(transformed, 1, 'accepted page assignment is not ingested twice by microtask')
  pageKey = '/video/b'; navigationListener()
  check(session.get().generation !== initial, 'navigation observation advances generation without browser API access')
  await settings.update({ disabled: true })
  equal(session.get().disabled, true, 'disable starts a disabled generation')
  await settings.update({ disabled: false })
  accept = false; lifecycle.acceptPageAssignment({}, 2); const beforeDispose = transformed
  lifecycle.dispose(); clock.advance(0)
  equal(transformed, beforeDispose, 'disposed lifecycle ignores queued page assignments')
} finally { scope.dispose() }
console.log(`orchestration: ${assertionCount()} assertions`)
