import { CatalogSettingsStore } from '../support/catalog-settings.ts'
import '../regressions/functional-races/runtime.ts'
import '../regressions/functional-races/content.ts'
import '../regressions/functional-races/cr-startup.ts'
import '../regressions/functional-races/navigation.ts'
import { createRuntimeIds } from '../../src-v2/platform/runtime-ids.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { playurlResult } from '../support/playurl.ts'
import { RuntimeController } from '../../src-v2/application/runtime-controller.ts'
import { LifecycleController } from '../../src-v2/application/lifecycle-controller.ts'
import { ControlCommands } from '../../src-v2/application/control-commands.ts'
import { RouteCoordinator } from '../../src-v2/application/routing/route-coordinator.ts'
import { SessionStore } from '../../src-v2/state/session-store.ts'
import { RestrictionStore } from '../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../src-v2/state/evidence-store.ts'
import { SignedRouteVault } from '../../src-v2/state/signed-route-vault.ts'
import { MeasurementMetaStore } from '../../src-v2/state/measurement-meta-store.ts'
import { type VideoSnapshot } from '../../src-v2/application/playback/player-contracts.ts'
import { type NavigationPort } from '../../src-v2/application/lifecycle-contracts.ts'
import { type DomainEvent } from '../../src-v2/application/routing/route-contracts.ts'
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

// Named scenarios create only their prerequisite state; resources belong to this test.

function createPlaybackResourcesBlock1() {
  const calls: string[] = []
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
  let routeListener: (event: DomainEvent) => void = () => undefined
  const routeControl = {
    observePlaybackFacts: () => undefined,
    latestRequested: () => null,
    recoveryEligible: () => true,
    subscribe(listener: (event: DomainEvent) => void) {
      routeListener = listener
      return () => {
        routeListener = () => undefined
      }
    },
    invalidateForUserSetting: () => {
      calls.push('routes.invalidate')
    },
  } satisfies ConstructorParameters<typeof RuntimeController>[1]
  const monitor = {
    subscribe: () => () => undefined,
    start: () => {
      calls.push('monitor.start')
    },
    stop: () => {
      calls.push('monitor.stop')
    },
    reset: () => {
      calls.push('monitor.reset')
    },
  } satisfies ConstructorParameters<typeof RuntimeController>[3]
  return {
    calls,
    video,
    get routeListener() {
      return routeListener
    },
    set routeListener(value: typeof routeListener) {
      routeListener = value
    },
    routeControl,
    monitor,
  }
}

async function createNativeSwitchInvalidatesPlansBeforeCancellingProbeAndRecoveryWork1Context1(
  t: TestContext,
) {
  const scope = testScope(t)
  const clock = scope.own(new FakeClock())
  const storage = new FakeStorage()
  const settings = scope.own(new CatalogSettingsStore(storage, clock.now))
  const block1 = createPlaybackResourcesBlock1()
  const { routeControl, video, calls, monitor } = block1
  const runtime = scope.own(
    new RuntimeController(
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
        armRouteFailure: () => {
          calls.push('recovery.arm')
        },
      },
      {
        setEnabled: () => {
          calls.push('visibility')
        },
      },
      { subscribeEpoch: () => () => undefined },
    ),
  )
  runtime.install()
  runtime.install()
  calls.length = 0
  await settings.update({ considerNativeSources: true })
  return {
    calls,
    clock,
    get routeListener() {
      return block1.routeListener
    },
    set routeListener(value: typeof block1.routeListener) {
      block1.routeListener = value
    },
    runtime,
    settings,
    storage,
  }
}

function createLifecycleResources(t: TestContext) {
  const scope = testScope(t)
  const clock = scope.own(new FakeClock())
  const storage = new FakeStorage()
  const settings = scope.own(new CatalogSettingsStore(storage, clock.now))
  const session = new SessionStore()
  const block1 = createPlaybackResourcesBlock1()
  const { calls, monitor } = block1
  const restrictions = scope.own(new RestrictionStore(storage, clock.now))
  const evidence = scope.own(new EvidenceStore(storage, clock.now))
  const meta = new MeasurementMetaStore(storage, clock.now)
  return { scope, clock, storage, settings, session, calls, monitor, restrictions, evidence, meta }
}

async function createBlacklistCommandPersistsBeforeRouteInvalidation2Context2(t: TestContext) {
  const resources = createLifecycleResources(t)
  const { scope, clock, storage, settings, session, calls, monitor, restrictions, evidence, meta } =
    resources
  const commands = new ControlCommands(
    settings,
    {
      clear: async () => {
        calls.push('restrictions.clear')
        await restrictions.clear()
      },
    },
    {
      clear: async () => {
        calls.push('evidence.clear')
        await evidence.clear()
      },
    },
    {
      clear: async () => {
        calls.push('meta.clear')
        await meta.clear()
      },
    },
    {
      invalidateForUserSetting: () => {
        calls.push('routes.invalidate')
      },
    },
  )
  calls.length = 0
  await restrictions.add({
    host: TRUSTED_CATALOG[0],
    kind: 'all',
    type: 'black',
    reason: 'user',
    expireAt: clock.now() + 60000,
  })
  return {
    calls,
    clock,
    commands,
    evidence,
    meta,
    monitor,
    restrictions,
    scope,
    session,
    settings,
    storage,
  }
}

async function checkBlacklistCommandPersistsBeforeRouteInvalidation2(
  t: TestContext,
): Promise<void> {
  const base = await createBlacklistCommandPersistsBeforeRouteInvalidation2Context2(t)

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
    true,
    'measurement metadata clear is confirmed in its existing key',
  )
  assert.deepEqual(base.meta.get(), { catalogCursor: 0, lastChallengeAt: 0 })
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

async function checkDisableStartsADisabledGeneration3(t: TestContext): Promise<void> {
  const base = createLifecycleResources(t)
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
  let transformed = 0,
    accept = true
  const navigation: NavigationPort = {
    key: () => '/video/a',
    subscribe: () => () => undefined,
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
): Promise<void> {
  const base =
    await createNativeSwitchInvalidatesPlansBeforeCancellingProbeAndRecoveryWork1Context1(t)

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
    'recovery.arm',
    'fallback arms only application-owned recovery',
  )
  base.runtime.dispose()
  base.calls.length = 0
  base.routeListener(fallback)
  assert.strictEqual(base.calls.length, 0, 'runtime disposal removes routing subscription')
}

test(
  'Native switch invalidates plans before cancelling probe and recovery work [1]',
  { timeout: 5000 },
  async (t) => {
    await checkNativeSwitchInvalidatesPlansBeforeCancellingProbeAndRecoveryWork1(t)
  },
)
test('blacklist command persists before route invalidation [2]', { timeout: 5000 }, async (t) => {
  await checkBlacklistCommandPersistsBeforeRouteInvalidation2(t)
})
test('disable starts a disabled generation [3]', { timeout: 5000 }, async (t) => {
  await checkDisableStartsADisabledGeneration3(t)
})
