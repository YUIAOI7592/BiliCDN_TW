import { extendFixture } from '../support/fixture-context.ts'
import { CatalogSettingsStore } from '../support/catalog-settings.ts'
import '../regressions/functional-races/runtime.ts'
import '../regressions/buffer-integration.ts'
import '../regressions/buffer-low-integration.ts'
import '../regressions/buffer-continuity-integration.ts'
import '../regressions/buffer-low-nonintervention.ts'
import '../regressions/functional-races/content.ts'
import '../regressions/functional-races/cr-startup.ts'
import { createRuntimeIds } from '../../src-v2/platform/runtime-ids.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { playurlResult } from '../support/playurl.ts'
import { RuntimeController } from '../../src-v2/application/runtime-controller.ts'
import { LifecycleController } from '../../src-v2/application/lifecycle-controller.ts'
import { ControlCommands } from '../../src-v2/application/control-commands.ts'
import { RouteCoordinator } from '../../src-v2/application/route-coordinator.ts'
import { SessionStore } from '../../src-v2/state/session-store.ts'
import { RestrictionStore } from '../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../src-v2/state/evidence-store.ts'
import { SignedRouteVault } from '../../src-v2/state/signed-route-vault.ts'
import { MeasurementMetaStore } from '../../src-v2/state/measurement-meta-store.ts'
import type { VideoSnapshot, NavigationPort } from '../../src-v2/application/ports.ts'
import type { DomainEvent } from '../../src-v2/domain/model.ts'
import {
  decisionId,
  generationId,
  epochId,
  representationId,
  recoveryActionId,
} from '../../src-v2/domain/model.ts'
import { TRUSTED_CATALOG } from '../../src-v2/domain/catalog.ts'
import { FakeStorage } from '../support/storage.ts'
import { FakeClock } from '../support/clock.ts'
import { testScope } from '../support/scope.ts'

test('UP141-DIAG runtime owns one retry subscription and releases it on dispose', async (t) => {
  await checkUP141DIAGRuntimeOwnsOneRetrySubscriptionAndReleasesItOn(t, true)
})

// Named scenarios create only their prerequisite state; resources belong to this test.
async function createOrchestrationScenario(t: TestContext, observeRetry = false) {
  const scope = testScope(t)
  const clock = scope.own(new FakeClock()),
    storage = new FakeStorage()
  const settings = scope.own(new CatalogSettingsStore(storage, clock.now)),
    session = new SessionStore()
  const calls: string[] = []
  let retryListener:
    | ((
        snapshot: import('../../src-v2/application/early-retry-contracts.ts').EarlyRetrySnapshot,
      ) => void)
    | null = null
  const retrySnapshot = {
    state: 'waiting' as const,
    reason: 'no-alternative',
    host: null,
    attempts: 0,
    history: [{ at: 1000, state: 'waiting' as const, reason: 'no-alternative', host: null }],
  }
  const retryPort = observeRetry
    ? {
        tick() {},
        reset() {},
        cancel() {},
        dispose() {},
        snapshot: () => retrySnapshot,
        subscribe(listener: NonNullable<typeof retryListener>) {
          assert.equal(retryListener, null)
          retryListener = listener
          return () => {
            retryListener = null
          }
        },
      }
    : undefined
  const video: VideoSnapshot = {
    available: true,
    paused: false,
    seeking: false,
    ended: false,
    readyState: 4,
    currentTime: 10,
    duration: 100,
    width: 1920,
    height: 1080,
    playbackRate: 1.5,
    effectiveRate: 1.5,
    bufferAheadSec: 60,
    playableBufferSec: 40,
    bufferedToEnd: false,
    frames: 100,
    mediaError: false,
    coreInitialized: true,
    manifestHasVideo: true,
  }
  let routeListener: (event: DomainEvent) => void = () => undefined,
    comparison = false
  const routeControl = {
    latestRequested: () => null,
    recoveryEligible: () => true,
    subscribe(listener: (event: DomainEvent) => void) {
      routeListener = listener
      return () => {
        routeListener = () => undefined
      }
    },
    isOriginalComparison: () => comparison,
    invalidateForUserSetting: () => {
      calls.push('routes.invalidate')
    },
  } satisfies ConstructorParameters<typeof RuntimeController>[2]
  const monitor = {
    observeTransport() {},
    subscribe: () => () => {
      calls.push('monitor.unsubscribe')
    },
    snapshot: () => ({
      video,
      stableProgressSec: 20,
      watchdog: 'healthy' as const,
      stallTicks: 0,
      startupRescue: { state: 'not-needed' as const, ageSec: 0 },
    }),
    start: () => {
      calls.push('monitor.start')
    },
    stop: () => {
      calls.push('monitor.stop')
    },
    reset: () => {
      calls.push('monitor.reset')
    },
  } satisfies ConstructorParameters<typeof RuntimeController>[4]
  const runtime = scope.own(
    new RuntimeController(
      session,
      settings,
      routeControl,
      {
        snapshot: () => video,
        reset: () => {
          calls.push('player.reset')
        },
      },
      monitor,
      {
        reset: () => {
          calls.push('measurement.reset')
        },
      },
      {
        reset: () => {
          calls.push('recovery.reset')
        },
        subscribe: () => () => undefined,
        armRouteFailure: () => {
          calls.push('recovery.arm')
        },
      },
      {
        setEnabled: () => {
          calls.push('visibility')
        },
      },
      {
        record: () => {
          calls.push('diagnostic.event')
        },
        recordPlayer: () => {
          calls.push('diagnostic.player')
        },
      },
      clock.now,
      { subscribeEpoch: () => () => undefined },
      retryPort,
    ),
  )
  runtime.install()
  runtime.install()
  calls.length = 0
  return extendFixture({}, {
    scope,
    clock,
    storage,
    settings,
    session,
    calls,
    get retryListener() {
      return retryListener
    },
    set retryListener(next: typeof retryListener) {
      retryListener = next
    },
    retrySnapshot,
    get routeListener() {
      return routeListener
    },
    set routeListener(next: typeof routeListener) {
      routeListener = next
    },
    get comparison() {
      return comparison
    },
    set comparison(next: typeof comparison) {
      comparison = next
    },
    monitor,
    runtime,
  } as const)
}

async function createNativeSwitchInvalidatesPlansBeforeCancellingProbeAndRecoveryWork1Context1(
  t: TestContext,
  observeRetry = false,
) {
  const base = await createOrchestrationScenario(t, observeRetry)
  await base.settings.update({ considerNativeSources: true })
  return extendFixture(base, {} as const)
}

async function createBlacklistCommandPersistsBeforeRouteInvalidation2Context2(
  t: TestContext,
  observeRetry = false,
) {
  const base =
    await createNativeSwitchInvalidatesPlansBeforeCancellingProbeAndRecoveryWork1Context1(
      t,
      observeRetry,
    )
  void base.calls.join(',')
  base.calls.length = 0
  base.storage.remote('bilicdn.v2.settings', {
    ...base.settings.get(),
    considerNativeSources: false,
    updatedAt: base.settings.get().updatedAt + 1,
  })
  void base.calls.join(',')
  base.calls.length = 0
  await base.settings.update({ blockHttpDns: false })
  void base.calls.join(',')
  base.runtime.reset()
  void base.calls.slice(1).join(',')

  base.calls.length = 0
  void base.calls.join(',')
  base.comparison = true
  base.calls.length = 0
  void base.calls.join(',')
  base.runtime.dispose()
  base.calls.length = 0
  const restrictions = base.scope.own(new RestrictionStore(base.storage, base.clock.now)),
    evidence = base.scope.own(new EvidenceStore(base.storage, base.clock.now))
  const meta = new MeasurementMetaStore(base.storage, base.clock.now)
  const commands = new ControlCommands(
    base.settings,
    {
      clear: async () => {
        base.calls.push('restrictions.clear')
        await restrictions.clear()
      },
    },
    {
      clear: async () => {
        base.calls.push('evidence.clear')
        await evidence.clear()
      },
    },
    {
      clear: () => {
        base.calls.push('meta.clear')
        meta.clear()
      },
    },
    {
      invalidateForUserSetting: () => {
        base.calls.push('routes.invalidate')
      },
      setOriginalComparison: () => {
        base.calls.push('comparison')
      },
    },
    {
      reset: () => {
        base.calls.push('measurement.reset')
      },
    },
    {
      reset: () => {
        base.calls.push('recovery.reset')
      },
    },
  )
  commands.setOriginalComparison(true)
  void base.calls.join(',')
  base.calls.length = 0
  await restrictions.add({
    host: TRUSTED_CATALOG[0],
    kind: 'all',
    type: 'black',
    reason: 'user',
    expireAt: base.clock.now() + 60000,
  })
  return extendFixture(base, { restrictions, evidence, meta, commands } as const)
}

async function checkBlacklistCommandPersistsBeforeRouteInvalidation2(
  t: TestContext,
  observeRetry = false,
): Promise<void> {
  const base = await createBlacklistCommandPersistsBeforeRouteInvalidation2Context2(t, observeRetry)

  assert.strictEqual(
    base.calls.join(','),
    '',
    'existing restriction data does not recreate the removed manual command',
  )
  assert.strictEqual(
    base.restrictions.has(TRUSTED_CATALOG[0], 'audio', 'black'),
    true,
    'UI blacklist remains applicable to audio',
  )
  base.meta.update({ catalogCursor: 2, lastChallengeAt: base.clock.now() })
  base.calls.length = 0
  await base.commands.clearLearning()
  assert.strictEqual(
    base.calls.join(','),
    'evidence.clear,restrictions.clear,meta.clear',
    'learning clear order is application-owned',
  )
  assert.strictEqual(
    base.storage.values.has('bilicdn.v2.meta'),
    false,
    'measurement metadata cleared through its store',
  )
  const vault = new SignedRouteVault(),
    routes = new RouteCoordinator(
      base.clock,
      base.session,
      base.settings,
      base.restrictions,
      base.evidence,
      vault,
      createRuntimeIds(),
    )
  let pageKey = '/video/a',
    transformed = 0,
    accept = true
  let navigationListener: () => void = () => undefined
  const navigation: NavigationPort = {
    key: () => pageKey,
    subscribe(listener) {
      navigationListener = listener
      return () => {
        navigationListener = () => undefined
      }
    },
  }
  const lifecycle = base.scope.own(
    new LifecycleController(
      base.session,
      base.settings,
      vault,
      routes,
      {
        transform: () => {
          transformed++
          return playurlResult(accept)
        },
      },
      { install: () => undefined, dispose: () => undefined },
      base.monitor,
      base.clock.now,
      navigation,
      base.clock,
    ),
  )
  assert.strictEqual(typeof location, 'undefined', 'lifecycle contract has no browser globals')
  lifecycle.start()
  const initial = base.session.get().generation
  lifecycle.start()
  assert.strictEqual(base.session.get().generation, initial, 'lifecycle installation is idempotent')
  lifecycle.acceptPageAssignment({}, 1)
  base.clock.advance(0)
  assert.strictEqual(transformed, 1, 'accepted page assignment is not ingested twice by microtask')
  pageKey = '/video/b'
  navigationListener()
  assert.ok(
    base.session.get().generation !== initial,
    'navigation observation advances generation without browser API access',
  )
}

async function checkDisableStartsADisabledGeneration3(
  t: TestContext,
  observeRetry = false,
): Promise<void> {
  const base = await createBlacklistCommandPersistsBeforeRouteInvalidation2Context2(t, observeRetry)

  void base.calls.join(',')
  void base.restrictions.has(TRUSTED_CATALOG[0], 'audio', 'black')
  base.meta.update({ catalogCursor: 2, lastChallengeAt: base.clock.now() })
  base.calls.length = 0
  await base.commands.clearLearning()
  void base.calls.join(',')
  void base.storage.values.has('bilicdn.v2.meta')
  const vault = new SignedRouteVault(),
    routes = new RouteCoordinator(
      base.clock,
      base.session,
      base.settings,
      base.restrictions,
      base.evidence,
      vault,
      createRuntimeIds(),
    )
  let pageKey = '/video/a',
    transformed = 0,
    accept = true
  let navigationListener: () => void = () => undefined
  const navigation: NavigationPort = {
    key: () => pageKey,
    subscribe(listener) {
      navigationListener = listener
      return () => {
        navigationListener = () => undefined
      }
    },
  }
  const lifecycle = base.scope.own(
    new LifecycleController(
      base.session,
      base.settings,
      vault,
      routes,
      {
        transform: () => {
          transformed++
          return playurlResult(accept)
        },
      },
      { install: () => undefined, dispose: () => undefined },
      base.monitor,
      base.clock.now,
      navigation,
      base.clock,
    ),
  )
  lifecycle.start()
  const initial = base.session.get().generation
  lifecycle.start()
  void base.session.get().generation
  lifecycle.acceptPageAssignment({}, 1)
  base.clock.advance(0)
  pageKey = '/video/b'
  navigationListener()
  void (base.session.get().generation !== initial)
  await base.settings.update({ disabled: true })

  assert.strictEqual(base.session.get().disabled, true, 'disable starts a disabled generation')
  await base.settings.update({ disabled: false })
  accept = false
  lifecycle.acceptPageAssignment({}, 2)
  const beforeDispose = transformed
  lifecycle.dispose()
  base.clock.advance(0)
  assert.strictEqual(
    transformed,
    beforeDispose,
    'disposed lifecycle ignores queued page assignments',
  )
}

async function checkNativeSwitchInvalidatesPlansBeforeCancellingProbeAndRecoveryWork1(
  t: TestContext,
  observeRetry = false,
): Promise<void> {
  const base =
    await createNativeSwitchInvalidatesPlansBeforeCancellingProbeAndRecoveryWork1Context1(
      t,
      observeRetry,
    )

  assert.strictEqual(
    base.calls.join(','),
    'visibility,routes.invalidate,measurement.reset,recovery.reset',
    'Native switch invalidates plans before cancelling probe and recovery work',
  )
  base.calls.length = 0
  base.storage.remote('bilicdn.v2.settings', {
    ...base.settings.get(),
    considerNativeSources: false,
    updatedAt: base.settings.get().updatedAt + 1,
  })
  assert.strictEqual(
    base.calls.join(','),
    'visibility,routes.invalidate,measurement.reset,recovery.reset',
    'remote settings use the same coordination path',
  )
  base.calls.length = 0
  await base.settings.update({ blockHttpDns: false })
  assert.strictEqual(
    base.calls.join(','),
    'visibility',
    'unrelated setting does not reset route or recovery',
  )
  base.runtime.reset()
  assert.strictEqual(
    base.calls.slice(1).join(','),
    'monitor.reset,measurement.reset,recovery.reset,player.reset',
    'generation reset has one explicit owner and order',
  )
  const fallback: DomainEvent = {
    type: 'recovery',
    at: base.clock.now(),
    action: {
      action: 'route-fallback',
      id: recoveryActionId('test-recovery'),
      kind: 'video',
      identity: {
        generation: generationId(1),
        epoch: epochId(0),
        representation: representationId('test-rep'),
        authorityRevision: 1,
        kind: 'video',
      },
      decision: {
        action: 'pass',
        target: { type: 'request' },
        id: decisionId('fallback'),
        reason: 'test',
        routeType: 'root-original',
        host: TRUSTED_CATALOG[0],
        ranking: [],
      },
    },
  }
  base.calls.length = 0
  base.routeListener(fallback)
  assert.strictEqual(
    base.calls.join(','),
    'diagnostic.event,diagnostic.player,recovery.arm',
    'fallback records observation and arms only application-owned recovery',
  )
  base.comparison = true
  base.calls.length = 0
  base.routeListener(fallback)
  assert.strictEqual(
    base.calls.join(','),
    'diagnostic.event',
    'comparison prevents fallback recovery effects',
  )
  base.runtime.dispose()
  base.calls.length = 0
  base.routeListener(fallback)
  assert.strictEqual(base.calls.length, 0, 'runtime disposal removes routing subscription')
  const restrictions = base.scope.own(new RestrictionStore(base.storage, base.clock.now)),
    evidence = base.scope.own(new EvidenceStore(base.storage, base.clock.now))
  const meta = new MeasurementMetaStore(base.storage, base.clock.now)
  const commands = new ControlCommands(
    base.settings,
    {
      clear: async () => {
        base.calls.push('restrictions.clear')
        await restrictions.clear()
      },
    },
    {
      clear: async () => {
        base.calls.push('evidence.clear')
        await evidence.clear()
      },
    },
    {
      clear: () => {
        base.calls.push('meta.clear')
        meta.clear()
      },
    },
    {
      invalidateForUserSetting: () => {
        base.calls.push('routes.invalidate')
      },
      setOriginalComparison: () => {
        base.calls.push('comparison')
      },
    },
    {
      reset: () => {
        base.calls.push('measurement.reset')
      },
    },
    {
      reset: () => {
        base.calls.push('recovery.reset')
      },
    },
  )
  commands.setOriginalComparison(true)
  assert.strictEqual(
    base.calls.join(','),
    'comparison,measurement.reset,recovery.reset',
    'comparison command coordinates all affected controllers',
  )
}

async function checkUP141DIAGRuntimeOwnsOneRetrySubscriptionAndReleasesItOn(
  t: TestContext,
  observeRetry = false,
): Promise<void> {
  const base = await createOrchestrationScenario(t, observeRetry)

  assert.ok(base.retryListener)
  base.retryListener(base.retrySnapshot)
  assert.deepEqual(base.calls, ['diagnostic.event'])
  base.runtime.dispose()
  assert.equal(base.retryListener, null)
}

test(
  'Native switch invalidates plans before cancelling probe and recovery work [1]',
  { timeout: 5000 },
  async (t) => {
    await checkNativeSwitchInvalidatesPlansBeforeCancellingProbeAndRecoveryWork1(t, false)
  },
)
test('blacklist command persists before route invalidation [2]', { timeout: 5000 }, async (t) => {
  await checkBlacklistCommandPersistsBeforeRouteInvalidation2(t, false)
})
test('disable starts a disabled generation [3]', { timeout: 5000 }, async (t) => {
  await checkDisableStartsADisabledGeneration3(t, false)
})
