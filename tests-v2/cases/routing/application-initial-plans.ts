import { CatalogSettingsStore } from '../../support/catalog-settings.ts'
import { currentResumePlayer } from '../../support/player.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { type TestContext } from 'node:test'
import { SignedRouteVault } from '../../../src-v2/state/signed-route-vault.ts'
import { RestrictionStore } from '../../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../../src-v2/state/evidence-store.ts'
import { SessionStore } from '../../../src-v2/state/session-store.ts'
import { RouteCoordinator } from '../../../src-v2/application/routing/route-coordinator.ts'
import { RecoveryController } from '../../../src-v2/application/playback/recovery-controller.ts'
import {
  type PlayerPort,
  type VideoSnapshot,
} from '../../../src-v2/application/playback/player-contracts.ts'
import { FakeStorage } from '../../support/storage.ts'
import { testScope } from '../../support/scope.ts'
import { idleControls } from '../../support/player.ts'
import { createRouteStateResources } from './application-resources.ts'

async function createNowContext2(t: TestContext) {
  const resources = await createRouteStateResources(t)
  const { liveVault, state, clock, evidenceStore, now, restrictions, session, settings } = resources

  const liveRep = liveVault.register({
    generation: state.generation,
    epoch: state.epoch,
    kind: 'video',
    key: '80:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 3_000_000,
    urls: ['https://upos-sz-mirrorali.bilivideo.com/upgcxcode/c/d/2.m4s?k=1'],
    source: 'page-hint',
  })
  return {
    clock,
    evidenceStore,
    liveRep,
    liveVault,
    now,
    restrictions,
    session,
    settings,
    state,
  }
}

async function createCoordinatorContext3(t: TestContext) {
  const scope = testScope(t)
  const now = 2_000_000_000_000
  const clock = { now: () => now }
  const storage = new FakeStorage()
  const restrictions = scope.own(new RestrictionStore(storage, () => now))
  const settings = scope.own(new CatalogSettingsStore(storage, () => now))
  const evidenceStore = scope.own(new EvidenceStore(storage, () => now))
  const session = new SessionStore()
  await settings.update({ considerNativeSources: true })
  const liveVault = new SignedRouteVault()
  const state = session.beginGeneration(false)
  liveVault.reset(state.generation, state.epoch)
  const liveRep = liveVault.register({
    generation: state.generation,
    epoch: state.epoch,
    kind: 'video',
    key: '80:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 3_000_000,
    urls: ['https://upos-sz-mirrorali.bilivideo.com/upgcxcode/c/d/2.m4s?k=1'],
    source: 'page-hint',
  })
  const coordinator = new RouteCoordinator(
    clock,
    session,
    settings,
    restrictions,
    evidenceStore,
    liveVault,
    createRuntimeIds(),
  )
  return {
    coordinator,
    liveRep,
    liveVault,
    now,
    restrictions,
    state,
  }
}

async function createManyQualityGroupsStillEnterTheRouteCoordinator3Context4(t: TestContext) {
  const resources = await createRouteStateResources(t)
  const {
    liveVault,
    state,
    clock,
    session,
    settings,
    restrictions,
    evidenceStore,
    now,
    scope,
    storage,
  } = resources

  void liveVault.register({
    generation: state.generation,
    epoch: state.epoch,
    kind: 'video',
    key: '80:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 3_000_000,
    urls: ['https://upos-sz-mirrorali.bilivideo.com/upgcxcode/c/d/2.m4s?k=1'],
    source: 'page-hint',
  })
  const coordinator = new RouteCoordinator(
    clock,
    session,
    settings,
    restrictions,
    evidenceStore,
    liveVault,
    createRuntimeIds(),
  )
  const groupPlans = Array.from({ length: 40 }, (_, index) => {
    const group = liveVault.register({
      generation: state.generation,
      epoch: state.epoch,
      kind: 'video',
      key: `quality-group:${index}`,
      height: 1080,
      codec: 'av1',
      bandwidth: 3_000_000,
      urls: [`https://upos-sz-mirrorali.bilivideo.com/upgcxcode/c/d/${index + 100}.m4s?k=1`],
      source: 'page-hint',
    })
    assert.ok(group)
    const decision = coordinator.plan(
      group,
      { kind: 'video', requiredMbps: 7.5, highDemand: false },
      'startup',
    )
    return { representation: group, decision }
  })
  const routeReadModel = coordinator.snapshot()
  return {
    coordinator,
    groupPlans,
    now,
    routeReadModel,
    scope,
    storage,
  }
}

async function checkManyQualityGroupsStillEnterTheRouteCoordinator3(t: TestContext): Promise<void> {
  const base = await createManyQualityGroupsStillEnterTheRouteCoordinator3Context4(t)

  assert.equal(base.groupPlans.length, 40)
  assert.equal(new Set(base.groupPlans.map((row) => row.representation)).size, 40)
  for (const { representation, decision } of base.groupPlans) {
    assert.strictEqual(
      base.coordinator.plan(
        representation,
        { kind: 'video', requiredMbps: 7.5, highDemand: false },
        'startup',
      ),
      decision,
      'each quality group retains its current route plan',
    )
    assert.equal(base.coordinator.decisionRecord(decision.id)?.representation, representation)
  }
  assert.equal(Object.hasOwn(base.routeReadModel, 'planCount'), false)
  const snapshot = base.coordinator.snapshot()
  assert.equal(Object.hasOwn(snapshot, 'recentPlans'), false)
  assert.equal(Object.hasOwn(snapshot, 'lastSuccess'), false)
  for (const { representation, decision } of base.groupPlans)
    assert.strictEqual(
      base.coordinator.plan(
        representation,
        { kind: 'video', requiredMbps: 7.5, highDemand: false },
        'startup',
      ),
      decision,
      'reading the display snapshot preserves every quality group decision',
    )
  assert.ok(
    ![...base.storage.values.keys()].some((key) => !key.startsWith('bilicdn.v2.')),
    'stores only use v2 namespace',
  )
  let recoveryNow = base.now,
    reloads = 0,
    seeks: number[] = [],
    rates: number[] = [],
    plays = 0
  let playerSnapshot: VideoSnapshot = {
    available: true,
    paused: false,
    seeking: false,
    ended: false,
    readyState: 4,
    currentTime: 349.434,
    duration: 900,
    width: 1920,
    height: 1080,
    playbackRate: 2,
    effectiveRate: 2,
    bufferAheadSec: 30,
    playableBufferSec: 15,
    bufferedToEnd: false,
    frames: 1000,
    mediaError: false,
    coreInitialized: true,
    manifestHasVideo: true,
  }
  const recoveryPlayer: PlayerPort = {
    controls: idleControls,
    observePlayIntent: () => () => undefined,
    snapshot: () => playerSnapshot,
    syncManifest: () => true,
    reload: () => {
      reloads++
    },
    currentTime: () => 349.434,
    playbackRate: () => 2,
    seek: (value) => {
      seeks.push(value)
    },
    setRate: (value) => {
      rates.push(value)
    },
    play: () => {
      plays++
      return Promise.resolve()
    },
    reset: () => undefined,
  }
  const recovery = base.scope.own(
    new RecoveryController(currentResumePlayer(recoveryPlayer), () => recoveryNow),
  )
  recovery.tick(playerSnapshot)
  recovery.armRouteFailure('route-failure', playerSnapshot)
  playerSnapshot = {
    ...playerSnapshot,
    readyState: 0,
    width: 0,
    height: 0,
    currentTime: 349.434,
    frames: 1000,
    coreInitialized: false,
  }
  recoveryNow += 4000
  recovery.tick(playerSnapshot)
  assert.strictEqual(reloads, 1, 'dead core after committed route recovery reloads exactly once')
  recoveryNow += 1000
  recovery.tick(playerSnapshot)
  assert.strictEqual(reloads, 1, 'dead core does not loop reload')
  playerSnapshot = {
    ...playerSnapshot,
    readyState: 3,
    width: 1920,
    height: 1080,
    coreInitialized: true,
    frames: 1,
  }
  recoveryNow += 1000
  recovery.tick(playerSnapshot)
  assert.strictEqual(seeks[0], 349.434, 'core recovery restores saved position')
  assert.strictEqual(rates[0], 2, 'core recovery restores 2x')
  assert.strictEqual(plays, 1, 'core recovery restores play intent once')
}

async function checkColdStartupPreservesTheLegalOriginalUntilPreflightCompletes2(
  t: TestContext,
): Promise<void> {
  const base = await createCoordinatorContext3(t)

  if (base.liveRep) {
    const plan = base.coordinator.plan(
      base.liveRep,
      { kind: 'video', requiredMbps: 7.5, highDemand: false },
      'startup',
    )
    assert.strictEqual(
      plan.action,
      'pass',
      'cold startup preserves the legal original until preflight completes',
    )
    const startupRoot = base.liveVault.rootUrl(base.liveRep) ?? ''
    const catalogChoice = base.coordinator
      .startupOptions(startupRoot)
      ?.candidates.find((candidate) => candidate.type === 'catalog-generated')
    assert.ok(catalogChoice, 'startup offers a Catalog challenger absent from playinfo')
    if (catalogChoice)
      base.coordinator.commitStartupChoice(startupRoot, catalogChoice, 'test-preflight')
    const applied = base.coordinator.apply(startupRoot)
    assert.strictEqual(applied.decision.action, 'rewrite', 'planned catalog decision is applied')
    assert.ok(
      applied.url?.includes(catalogChoice?.host ?? ''),
      'applied URL uses the preflight winner',
    )
    await base.coordinator.observe({
      generation: base.state.generation,
      epoch: base.state.epoch,
      decisionId: applied.decision.id,
      representation: base.liveRep,
      kind: 'video',
      routeType: 'catalog-generated',
      originalHost: applied.sourceHost ?? '',
      targetHost: applied.decision.host ?? '',
      finalHost: applied.decision.host,
      streamKey: applied.streamKey,
      status: 403,
      bytes: 0,
      ttfbMs: 30,
      elapsedMs: 60,
      completedAt: base.now,
      outcome: 'failure',
    })
    const restored = base.coordinator.apply(applied.url ?? '')
    assert.strictEqual(
      restored.decision.reason,
      'host-locked',
      '403 host-lock is remembered for the exact stream',
    )
    assert.strictEqual(
      restored.url,
      base.liveVault.rootUrl(base.liveRep),
      'host-lock restores exact root signed URL',
    )
    await base.restrictions.add({
      host: 'upos-sz-mirrorali.bilivideo.com',
      type: 'black',
      kind: 'all',
      reason: 'cold-start-test',
      expireAt: base.now + 60_000,
    })
    assert.ok(
      !base.coordinator
        .startupOptions(startupRoot)
        ?.candidates.some((candidate) => candidate.host === 'upos-sz-mirrorali.bilivideo.com'),
      'startup preflight never probes a blacklisted original host',
    )
    const restrictedFallback = base.coordinator.apply(startupRoot)
    assert.ok(
      restrictedFallback.url !== startupRoot &&
        restrictedFallback.decision.host !== 'upos-sz-mirrorali.bilivideo.com',
      'host-locked blacklisted original uses a different legal fallback',
    )
    await base.restrictions.remove('upos-sz-mirrorali.bilivideo.com', 'black')
  }
}

async function checkControllerFixtureRepresentationExists1(t: TestContext): Promise<void> {
  const base = await createNowContext2(t)

  assert.ok(base.liveRep, 'controller fixture representation exists')
  const coordinator = new RouteCoordinator(
    base.clock,
    base.session,
    base.settings,
    base.restrictions,
    base.evidenceStore,
    base.liveVault,
    createRuntimeIds(),
  )
  const opaqueAudioUrl =
    'https://upos-hz-mirrorakam.akamaized.net/opaque/audio-segment?signature=private'
  const opaqueAudioRep = base.liveVault.register({
    generation: base.state.generation,
    epoch: base.state.epoch,
    kind: 'audio',
    key: 'opaque-audio',
    height: 0,
    codec: 'other',
    bandwidth: 192_000,
    urls: [opaqueAudioUrl],
    source: 'trusted-api',
  })
  assert.ok(opaqueAudioRep, 'trusted opaque audio URL enters observation-only vault')
  assert.strictEqual(
    coordinator.recognizesMedia(opaqueAudioUrl),
    true,
    'current-epoch opaque signed URL enters the media hook',
  )
  assert.strictEqual(
    coordinator.startupOptions(opaqueAudioUrl),
    null,
    'opaque URL cannot start an active probe',
  )
  assert.strictEqual(
    coordinator.apply(opaqueAudioUrl).attributionStatus,
    'weak',
    'opaque URL cannot create health evidence',
  )
  await base.restrictions.add({
    host: 'upos-hz-mirrorakam.akamaized.net',
    type: 'black',
    kind: 'all',
    reason: 'opaque-test',
    expireAt: base.now + 60_000,
  })
  assert.strictEqual(
    coordinator.apply(opaqueAudioUrl).decision.action,
    'block',
    'opaque exact URL still obeys the blacklist',
  )
  assert.strictEqual(
    coordinator.inspectOriginal(opaqueAudioUrl).decision.action,
    'block',
    'non-GET opaque URL obeys the blacklist',
  )
}

test('controller fixture representation exists [1]', { timeout: 5000 }, async (t) => {
  await checkControllerFixtureRepresentationExists1(t)
})

test(
  'cold startup preserves the legal original until preflight completes [2]',
  { timeout: 5000 },
  async (t) => {
    await checkColdStartupPreservesTheLegalOriginalUntilPreflightCompletes2(t)
  },
)

test('many quality groups still enter the route coordinator [3]', { timeout: 5000 }, async (t) => {
  await checkManyQualityGroupsStillEnterTheRouteCoordinator3(t)
})
