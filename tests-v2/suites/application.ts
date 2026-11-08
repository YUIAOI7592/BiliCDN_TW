import { CatalogSettingsStore } from '../support/catalog-settings.ts'
import { currentResumePlayer } from '../support/player.ts'
import '../regressions/cc39-integration.ts'
import '../regressions/v2211-circuit-routing.ts'
import { createRuntimeIds } from '../../src-v2/platform/runtime-ids.ts'
import { FakeClock } from '../support/clock.ts'
import { deferred, countdown } from '../support/deferred.ts'
import { test } from 'node:test'
import '../regressions/v227-route-owner.ts'
import '../regressions/v227-startup.ts'
import '../regressions/v227-completion-owner.ts'
import '../regressions/up141-retry-transport.ts'
import '../regressions/up141-retry-policy.ts'
import '../regressions/functional-races/up141-backups.ts'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { playurlResult } from '../support/playurl.ts'
import {
  measurementRoutes,
  monitorRoutes,
  monitorMeasurement,
  monitorRecovery,
} from '../support/controllers.ts'
import { RangeProbeAdapter } from '../../src-v2/adapters/transport/range-probe.ts'
import { MeasurementMetaStore } from '../../src-v2/state/measurement-meta-store.ts'
import {
  decisionId,
  epochId,
  generationId,
  representationId,
  requestId,
} from '../../src-v2/domain/model.ts'
import { TRUSTED_CATALOG } from '../../src-v2/domain/catalog.ts'
import { SignedRouteVault } from '../../src-v2/state/signed-route-vault.ts'
import { RestrictionStore } from '../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../src-v2/state/evidence-store.ts'
import { SessionStore } from '../../src-v2/state/session-store.ts'
import { RouteCoordinator } from '../../src-v2/application/routing/route-coordinator.ts'
import { type AppliedRouteDecision } from '../../src-v2/application/routing/route-contracts.ts'
import { RecoveryController } from '../../src-v2/application/playback/recovery-controller.ts'
import { MeasurementController } from '../../src-v2/application/measurement/measurement-controller.ts'
import { PlayerMonitor } from '../../src-v2/application/playback/player-monitor.ts'
import { PlayerAdapter } from '../../src-v2/adapters/player/player.ts'
import {
  type PlayerPort,
  type VideoSnapshot,
} from '../../src-v2/application/playback/player-contracts.ts'
import { FakeStorage } from '../support/storage.ts'
import { testScope } from '../support/scope.ts'
import { BrowserScheduler } from '../../src-v2/adapters/scheduler.ts'

// Named scenarios create only their prerequisite state; resources belong to this test.

async function createRateMonitorResources(t: TestContext) {
  const scope = testScope(t)
  const now = 2_000_000_000_000
  const storage = new FakeStorage()
  const settings = scope.own(new CatalogSettingsStore(storage, () => now))
  const session = new SessionStore()
  void session.beginGeneration(false)
  const block1 = createPlaybackResourcesBlock1()
  const { recoveryPlayer } = block1
  let selectedRate = 1
  let rateWrites = 0
  let observedRate = 0
  let rateSamples = 0
  const ratePlayer: PlayerPort = {
    ...recoveryPlayer,
    snapshot: () => ({
      ...block1.playerSnapshot,
      playbackRate: selectedRate,
      effectiveRate: selectedRate,
      currentTime: 50,
    }),
    playbackRate: () => selectedRate,
    setRate: () => {
      rateWrites++
    },
  }
  const rateMonitor = scope.own(
    new PlayerMonitor(
      ratePlayer,
      session,
      settings,
      new SignedRouteVault(),
      monitorRoutes({
        observePlaybackRate: (rate: number) => {
          observedRate = rate
          rateSamples++
        },
        firstMediaAt: () => 0,
      }),
      monitorMeasurement({ tick: () => undefined }),
      monitorRecovery({ tick: () => undefined, isRecovering: () => false }),
      () => true,
      () => now,
      new BrowserScheduler(),
      undefined,
      () => now,
    ),
  )
  return {
    get rateWrites() {
      return rateWrites
    },
    get rateSamples() {
      return rateSamples
    },
    get observedRate() {
      return observedRate
    },
    set observedRate(value: typeof observedRate) {
      observedRate = value
    },
    rateMonitor,
    get selectedRate() {
      return selectedRate
    },
    set selectedRate(value: typeof selectedRate) {
      selectedRate = value
    },
  }
}

function createPlaybackResourcesBlock1() {
  let reloads = 0
  let seeks: number[] = []
  let rates: number[] = []
  let plays = 0
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
  return {
    get playerSnapshot() {
      return playerSnapshot
    },
    set playerSnapshot(value: typeof playerSnapshot) {
      playerSnapshot = value
    },
    recoveryPlayer,
  }
}

function createPlaybackResourcesBlock2(now: number, scope: ReturnType<typeof testScope>) {
  let stallNow = now
  const stallEvidence = scope.own(new EvidenceStore(new FakeStorage(), () => stallNow))
  const stallRestrictions = scope.own(new RestrictionStore(new FakeStorage(), () => stallNow))
  const stallSettings = scope.own(new CatalogSettingsStore(new FakeStorage(), () => stallNow))
  return {
    get stallNow() {
      return stallNow
    },
    set stallNow(value: typeof stallNow) {
      stallNow = value
    },
    stallEvidence,
    stallRestrictions,
    stallSettings,
  }
}

function createPlaybackResourcesBlock3() {
  const startupSession = new SessionStore()
  const startupGeneration = startupSession.beginGeneration(false)
  const startupVault = new SignedRouteVault()
  return { startupSession, startupGeneration, startupVault }
}

async function createRouteStateResources(t: TestContext) {
  const scope = testScope(t)
  const now = 2_000_000_000_000
  const clock = { now: () => now }
  const storage = new FakeStorage()
  const restrictions = scope.own(new RestrictionStore(storage, () => now))
  const settings = scope.own(new CatalogSettingsStore(storage, () => now))
  const evidenceStore = scope.own(new EvidenceStore(storage, () => now))
  const session = new SessionStore()
  const liveVault = new SignedRouteVault()
  const state = session.beginGeneration(false)
  liveVault.reset(state.generation, state.epoch)
  return {
    scope,
    now,
    clock,
    storage,
    restrictions,
    settings,
    evidenceStore,
    session,
    liveVault,
    state,
  }
}

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

async function createStartupSessionAndstartupGenerationContext5(t: TestContext) {
  const resources = await createRouteStateResources(t)
  const { liveVault, state, clock, session, settings, restrictions, evidenceStore } = resources

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
  void Array.from({ length: 40 }, (_, index) => {
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
  void coordinator.snapshot()
  const block3 = createPlaybackResourcesBlock3()
  const { startupVault, startupGeneration } = block3
  startupVault.reset(startupGeneration.generation, startupGeneration.epoch)
  const startupRoot = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/startup/video.m4s?k=1'
  const startupRep = startupVault.register({
    generation: startupGeneration.generation,
    epoch: startupGeneration.epoch,
    kind: 'video',
    key: 'startup:80',
    height: 1080,
    codec: 'av1',
    bandwidth: 3_000_000,
    urls: [startupRoot],
    source: 'trusted-api',
  })
  return {
    startupRep,
  }
}

async function createStallNowAndstartupReloadsContext6(t: TestContext) {
  const resources = await createRouteStateResources(t)
  const { liveVault, state, clock, session, settings, restrictions, evidenceStore, now, scope } =
    resources

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
  void Array.from({ length: 40 }, (_, index) => {
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
  void coordinator.snapshot()
  const block3 = createPlaybackResourcesBlock3()
  const { startupVault, startupGeneration, startupSession } = block3
  startupVault.reset(startupGeneration.generation, startupGeneration.epoch)
  const startupRoot = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/startup/video.m4s?k=1'
  const startupRep = startupVault.register({
    generation: startupGeneration.generation,
    epoch: startupGeneration.epoch,
    kind: 'video',
    key: 'startup:80',
    height: 1080,
    codec: 'av1',
    bandwidth: 3_000_000,
    urls: [startupRoot],
    source: 'trusted-api',
  })
  const block2 = createPlaybackResourcesBlock2(now, scope)
  const { stallSettings, stallRestrictions, stallEvidence } = block2
  await stallSettings.update({ considerNativeSources: true })
  const stallRoutes = new RouteCoordinator(
    { now: () => block2.stallNow, monotonicNow: () => block2.stallNow },
    startupSession,
    stallSettings,
    stallRestrictions,
    stallEvidence,
    startupVault,
    createRuntimeIds(),
  )
  return {
    clock,
    now,
    scope,
    stallEvidence,
    get stallNow() {
      return block2.stallNow
    },
    set stallNow(value: typeof block2.stallNow) {
      block2.stallNow = value
    },
    stallRestrictions,
    stallRoutes,
    startupGeneration,
    startupRep,
    startupRoot,
    startupVault,
  }
}

async function createChallengeDoneAndredirectDoneAndmismatchedDoneAndmissingDoneContext7(
  t: TestContext,
) {
  const scope = testScope(t)
  const challengeDone = countdown(3)
  const now = 2_000_000_000_000
  const clock = { now: () => now }
  const storage = new FakeStorage()
  const restrictions = scope.own(new RestrictionStore(storage, () => now))
  const settings = scope.own(new CatalogSettingsStore(storage, () => now))
  const evidenceStore = scope.own(new EvidenceStore(storage, () => now))
  const session = new SessionStore()
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
  const opaqueAudioUrl =
    'https://upos-hz-mirrorakam.akamaized.net/opaque/audio-segment?signature=private'
  liveVault.register({
    generation: state.generation,
    epoch: state.epoch,
    kind: 'audio',
    key: 'opaque-audio',
    height: 0,
    codec: 'other',
    bandwidth: 192_000,
    urls: [opaqueAudioUrl],
    source: 'trusted-api',
  })
  if (liveRep) {
    coordinator.plan(liveRep, { kind: 'video', requiredMbps: 7.5, highDemand: false }, 'startup')
    const startupRoot = liveVault.rootUrl(liveRep) ?? ''
    const catalogChoice = coordinator
      .startupOptions(startupRoot)
      ?.candidates.find((candidate) => candidate.type === 'catalog-generated')
    if (catalogChoice) coordinator.commitStartupChoice(startupRoot, catalogChoice, 'test-preflight')
    const applied = coordinator.apply(startupRoot)
    await coordinator.observe({
      generation: state.generation,
      epoch: state.epoch,
      decisionId: applied.decision.id,
      representation: liveRep,
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
      completedAt: now,
      outcome: 'failure',
    })
    coordinator.apply(applied.url ?? '')
    await restrictions.add({
      host: 'upos-sz-mirrorali.bilivideo.com',
      type: 'black',
      kind: 'all',
      reason: 'cold-start-test',
      expireAt: now + 60_000,
    })
    coordinator.apply(startupRoot)
    await restrictions.remove('upos-sz-mirrorali.bilivideo.com', 'black')
  }
  for (let index = 0; index < 40; index++) {
    const group = liveVault.register({
      generation: state.generation,
      epoch: state.epoch,
      kind: 'video',
      key: `diagnostic:${index}`,
      height: 1080,
      codec: 'av1',
      bandwidth: 3_000_000,
      urls: [`https://upos-sz-mirrorali.bilivideo.com/upgcxcode/c/d/${index + 100}.m4s?k=1`],
      source: 'page-hint',
    })
    if (group)
      coordinator.plan(group, { kind: 'video', requiredMbps: 7.5, highDemand: false }, 'startup')
  }
  let recoveryNow = now
  const block1 = createPlaybackResourcesBlock1()
  const { recoveryPlayer } = block1
  const recovery = scope.own(
    new RecoveryController(currentResumePlayer(recoveryPlayer), () => recoveryNow),
  )
  recovery.tick(block1.playerSnapshot)
  recovery.armRouteFailure('route-failure', block1.playerSnapshot)
  block1.playerSnapshot = {
    ...block1.playerSnapshot,
    readyState: 0,
    width: 0,
    height: 0,
    currentTime: 349.434,
    frames: 1000,
    coreInitialized: false,
  }
  recoveryNow += 4000
  recovery.tick(block1.playerSnapshot)
  recoveryNow += 1000
  recovery.tick(block1.playerSnapshot)
  block1.playerSnapshot = {
    ...block1.playerSnapshot,
    readyState: 3,
    width: 1920,
    height: 1080,
    coreInitialized: true,
    frames: 1,
  }
  recoveryNow += 1000
  recovery.tick(block1.playerSnapshot)
  const block3 = createPlaybackResourcesBlock3()
  const { startupVault, startupGeneration, startupSession } = block3
  startupVault.reset(startupGeneration.generation, startupGeneration.epoch)
  const startupRoot = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/startup/video.m4s?k=1'
  const startupRep = startupVault.register({
    generation: startupGeneration.generation,
    epoch: startupGeneration.epoch,
    kind: 'video',
    key: 'startup:80',
    height: 1080,
    codec: 'av1',
    bandwidth: 3_000_000,
    urls: [startupRoot],
    source: 'trusted-api',
  })
  let stallNow = now
  let startupReloads = 0
  const stallEvidence = scope.own(new EvidenceStore(new FakeStorage(), () => stallNow))
  const stallRestrictions = scope.own(new RestrictionStore(new FakeStorage(), () => stallNow))
  const stallSettings = scope.own(new CatalogSettingsStore(new FakeStorage(), () => stallNow))
  const stallRoutes = new RouteCoordinator(
    { now: () => stallNow, monotonicNow: () => stallNow },
    startupSession,
    stallSettings,
    stallRestrictions,
    stallEvidence,
    startupVault,
    createRuntimeIds(),
  )
  if (startupRep) {
    const exactCatalogBackup = `https://${TRUSTED_CATALOG[0]}/upgcxcode/startup/video.m4s?k=backup-exact`
    startupVault.register({
      generation: startupGeneration.generation,
      epoch: startupGeneration.epoch,
      kind: 'video',
      key: 'startup:80',
      height: 1080,
      codec: 'av1',
      bandwidth: 3_000_000,
      urls: [exactCatalogBackup],
      source: 'trusted-api',
    })
    stallRoutes
      .startupOptions(startupRoot)
      ?.candidates.find((candidate) => candidate.host === TRUSTED_CATALOG[0])
    const incompatibleCatalog = stallRoutes
      .startupOptions(startupRoot)
      ?.candidates.find((candidate) => candidate.type === 'catalog-generated')
    if (incompatibleCatalog) {
      stallRoutes.noteStartupProbeResult(incompatibleCatalog, 403)
      await stallEvidence.record(incompatibleCatalog.host, 'video', {
        requestId: 'prior-fast-stream',
        at: stallNow,
        source: 'transport',
        outcome: 'success',
        throughputMbps: 100,
        ttfbMs: 10,
        failureKind: null,
      })
      stallRoutes.plan(
        startupRep,
        { kind: 'video', requiredMbps: 8, highDemand: false },
        'new-epoch',
      )
    }
    stallRoutes.apply('https://upos-sz-mirrorali.bilivideo.com/upgcxcode/startup/unmatched.m4s?k=1')
    const initial = stallRoutes.apply(startupRoot)
    const fallback = stallRoutes.recoverStartup(
      startupRep,
      { kind: 'video', requiredMbps: 8, highDemand: false },
      initial.decision.host ?? '',
      [],
    )
    const firstFairProbe = stallRoutes.challenge(
      startupRep,
      { kind: 'video', requiredMbps: 8, highDemand: false },
      false,
    )
    stallRoutes.challenge(startupRep, { kind: 'video', requiredMbps: 8, highDemand: false }, false)
    if (firstFairProbe) {
      await stallRoutes.recordChallenge(firstFairProbe, 0, 100, 50, 'failure', null)
    }
    stallRoutes.snapshot().fallback.video
    const nextFallback = stallRoutes.apply(startupRoot)
    const fallbackRequest = {
      routePolicyRevision: stallRoutes.policyRevision(),
      requestId: requestId('fallback-next'),
      generation: startupGeneration.generation,
      epoch: startupGeneration.epoch,
      decisionId: nextFallback.decision.id,
      representation: startupRep,
      kind: 'video' as const,
      attributionStatus: 'matched' as const,
      attributionSource: 'exact' as const,
      decisionStage: 'request' as const,
      routeType: nextFallback.decision.routeType,
      originalHost: 'upos-sz-mirrorali.bilivideo.com',
      targetHost: fallback!.host!,
      sourceHost: 'upos-sz-mirrorali.bilivideo.com',
      playurlHostChanged: false,
      playurlOutput: null,
      urlChanged: true,
      hostChanged: true,
      startedAt: stallNow,
    }
    stallRoutes.requestStarted({
      ...fallbackRequest,
      requestId: requestId('unrelated-same-host'),
      decisionId: decisionId('unrelated'),
    })
    stallRoutes.requestStarted(fallbackRequest)
    await stallRoutes.observe({
      request: fallbackRequest,
      generation: startupGeneration.generation,
      epoch: startupGeneration.epoch,
      decisionId: fallbackRequest.decisionId,
      representation: startupRep,
      kind: 'video',
      routeType: nextFallback.decision.routeType,
      originalHost: fallbackRequest.originalHost,
      targetHost: fallbackRequest.targetHost,
      finalHost: fallbackRequest.targetHost,
      streamKey: nextFallback.streamKey,
      status: 206,
      bytes: 100_000,
      ttfbMs: 20,
      elapsedMs: 250,
      completedAt: stallNow + 250,
      outcome: 'success',
    })
    for (const host of TRUSTED_CATALOG)
      await stallRestrictions.add({
        host,
        type: 'black',
        kind: 'all',
        reason: 'no-route',
        expireAt: stallNow + 60_000,
      })
    stallRoutes.recover(
      startupRep,
      { kind: 'video', requiredMbps: 8, highDemand: false },
      'verified-failure',
      fallback!.host,
    )
    for (const host of TRUSTED_CATALOG) await stallRestrictions.remove(host, 'black')
  }
  const deadStartup: VideoSnapshot = {
    ...block1.playerSnapshot,
    currentTime: 0,
    readyState: 0,
    width: 0,
    height: 0,
    frames: 0,
    bufferAheadSec: 0,
    playableBufferSec: 0,
    coreInitialized: false,
    paused: false,
  }
  let originalProbeDisabled = false
  let originalRecoveryTicks = 0
  let originalFallbacks = 0
  const originalMonitor = scope.own(
    new PlayerMonitor(
      {
        ...recoveryPlayer,
        snapshot: () => deadStartup,
        syncManifest: () => true,
      } satisfies PlayerPort,
      startupSession,
      { get: () => ({ disabled: true }) },
      startupVault,
      monitorRoutes({
        observePlaybackRate: () => undefined,
        firstMediaAt: () => now,
        latestRequested: () => ({
          routePolicyRevision: 0,
          targetHost: 'upos-sz-mirrorali.bilivideo.com',
          representation: startupRep,
          generation: startupGeneration.generation,
          epoch: startupGeneration.epoch,
        }),
        recoverStartup: () => {
          originalFallbacks++
          return null
        },
        recover: () => {
          originalFallbacks++
          return null
        },
      }),
      monitorMeasurement({
        tick: (input: { disabled: boolean }) => {
          originalProbeDisabled = input.disabled
        },
      }),
      monitorRecovery({
        tick: () => {
          originalRecoveryTicks++
        },
        isRecovering: () => false,
      }),
      () => true,
      () => now + 16_000,
      new BrowserScheduler(),
      undefined,
      () => now + 16_000,
    ),
  )
  for (let i = 0; i < 17; i++) originalMonitor.tick()
  return {
    challengeDone,
    deadStartup,
    now,
    get originalFallbacks() {
      return originalFallbacks
    },
    set originalFallbacks(value: typeof originalFallbacks) {
      originalFallbacks = value
    },
    get originalProbeDisabled(): boolean {
      return originalProbeDisabled
    },
    set originalProbeDisabled(value: boolean) {
      originalProbeDisabled = value
    },
    get originalRecoveryTicks() {
      return originalRecoveryTicks
    },
    set originalRecoveryTicks(value: typeof originalRecoveryTicks) {
      originalRecoveryTicks = value
    },
    recoveryPlayer,
    scope,
    get stallNow() {
      return stallNow
    },
    set stallNow(value: typeof stallNow) {
      stallNow = value
    },
    startupGeneration,
    get startupReloads() {
      return startupReloads
    },
    set startupReloads(value: typeof startupReloads) {
      startupReloads = value
    },
    startupRep,
    startupSession,
    startupVault,
  }
}

async function createStartupRecoveryContext8(t: TestContext) {
  const scope = testScope(t)
  const challengeDone = countdown(3)
  const redirectDone = countdown(3)
  const mismatchedDone = countdown(3)
  const missingDone = countdown(3)
  const now = 2_000_000_000_000
  const block1 = createPlaybackResourcesBlock1()
  const { recoveryPlayer } = block1
  const block3 = createPlaybackResourcesBlock3()
  const { startupVault, startupGeneration, startupSession } = block3
  startupVault.reset(startupGeneration.generation, startupGeneration.epoch)
  const startupRoot = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/startup/video.m4s?k=1'
  const startupRep = startupVault.register({
    generation: startupGeneration.generation,
    epoch: startupGeneration.epoch,
    kind: 'video',
    key: 'startup:80',
    height: 1080,
    codec: 'av1',
    bandwidth: 3_000_000,
    urls: [startupRoot],
    source: 'trusted-api',
  })
  let stallNow = now
  let startupReloads = 0
  const stallEvidence = scope.own(new EvidenceStore(new FakeStorage(), () => stallNow))
  const stallRestrictions = scope.own(new RestrictionStore(new FakeStorage(), () => stallNow))
  const stallSettings = scope.own(new CatalogSettingsStore(new FakeStorage(), () => stallNow))
  const stallRoutes = new RouteCoordinator(
    { now: () => stallNow, monotonicNow: () => stallNow },
    startupSession,
    stallSettings,
    stallRestrictions,
    stallEvidence,
    startupVault,
    createRuntimeIds(),
  )
  const deadStartup: VideoSnapshot = {
    ...block1.playerSnapshot,
    currentTime: 0,
    readyState: 0,
    width: 0,
    height: 0,
    frames: 0,
    bufferAheadSec: 0,
    playableBufferSec: 0,
    coreInitialized: false,
    paused: false,
  }
  const startupRecovery = scope.own(
    new RecoveryController(
      currentResumePlayer({
        ...recoveryPlayer,
        snapshot: () => deadStartup,
        reload: () => {
          startupReloads++
        },
        currentTime: () => 0,
        playbackRate: () => 1,
      } satisfies PlayerPort),
      () => stallNow,
    ),
  )
  startupRecovery.armStartupFailure(deadStartup)
  stallNow += 4000
  startupRecovery.tick(deadStartup)
  stallNow += 4000
  startupRecovery.tick(deadStartup)
  let softFallbacks = 0
  let startupArms = 0
  const stallMonitor = scope.own(
    new PlayerMonitor(
      {
        ...recoveryPlayer,
        snapshot: () => deadStartup,
        syncManifest: () => true,
      } satisfies PlayerPort,
      startupSession,
      scope.own(new CatalogSettingsStore(new FakeStorage(), () => stallNow)),
      startupVault,
      monitorRoutes({
        recoveryEligible: () => true,
        firstMediaAt: () => now,
        latestRequested: () => ({
          routePolicyRevision: 0,
          targetHost: 'upos-sz-mirrorali.bilivideo.com',
          representation: startupRep,
          generation: startupGeneration.generation,
          epoch: startupGeneration.epoch,
        }),
        recoverStartup: () => {
          softFallbacks++
          return { host: TRUSTED_CATALOG[0] }
        },
        observePlaybackRate: () => undefined,
      }),
      monitorMeasurement({ tick: () => undefined }),
      monitorRecovery({
        tick: () => undefined,
        isRecovering: () => false,
        armStartupFailure: () => {
          startupArms++
        },
      }),
      () => true,
      () => stallNow,
      new BrowserScheduler(),
      undefined,
      () => stallNow,
    ),
  )
  stallNow = now + 14_000
  stallMonitor.tick()
  stallNow = now + 15_000
  stallMonitor.tick()
  stallNow = now + 16_000
  stallMonitor.tick()
  let challengeCalls = 0
  let challengeFetches = 0
  let challengeRecords = 0
  const directRangeResponse = (url: string, bytes: number): Response => {
    const response = new Response(new Uint8Array(bytes), { status: 206 })
    Object.defineProperty(response, 'url', { value: url })
    return response
  }
  const challengeApplied: AppliedRouteDecision = {
    decision: {
      action: 'rewrite',
      id: decisionId('challenge'),
      reason: 'test',
      routeType: 'catalog-generated',
      host: TRUSTED_CATALOG[1],
      candidate: {
        type: 'catalog-generated',
        host: TRUSTED_CATALOG[1],
        kind: 'video',
        catalogIndex: 1,
      },
      ranking: [],
    },
    url: `https://${TRUSTED_CATALOG[1]}/upgcxcode/a/b/challenge.m4s`,
    context: {
      generation: generationId(1),
      epoch: epochId(1),
      representation: representationId('video:test'),
      kind: 'video',
      authorityRevision: 1,
    },
    streamKey: 'challenge',
    sourceHost: TRUSTED_CATALOG[0],
  }
  const challengeRoutes = {
    isCatalogOnly: () => false,
    challenge: () => {
      challengeCalls++
      return challengeApplied
    },
    recordChallenge: async () => {
      challengeRecords++
      challengeDone.complete()
    },
  }
  const challengeFetch = async (): Promise<Response> => {
    challengeFetches++
    return directRangeResponse(challengeApplied.url ?? '', 70 * 1024)
  }
  const measurement = scope.own(
    new MeasurementController(
      measurementRoutes(challengeRoutes),
      new MeasurementMetaStore(new FakeStorage(), () => now),
      new RangeProbeAdapter(challengeFetch as typeof fetch, () => now),
      () => now,
      new BrowserScheduler(),
      undefined,
      undefined,
      undefined,
      () => now,
    ),
  )
  const baseMeasurement = {
    generationActive: true,
    representation: representationId('video:test'),
    demand: { kind: 'video' as const, requiredMbps: 8, highDemand: false },
    stableProgressTicks: 20,
    playableBufferSec: 29,
    visible: true,
    seeking: false,
    recovering: false,
    disabled: false,
  }
  measurement.tick(baseMeasurement)
  measurement.tick({ ...baseMeasurement, playableBufferSec: 30 })
  await challengeDone.promise
  return {
    baseMeasurement,
    challengeApplied,
    get challengeCalls() {
      return challengeCalls
    },
    set challengeCalls(value: typeof challengeCalls) {
      challengeCalls = value
    },
    get challengeFetches() {
      return challengeFetches
    },
    set challengeFetches(value: typeof challengeFetches) {
      challengeFetches = value
    },
    get challengeRecords() {
      return challengeRecords
    },
    set challengeRecords(value: typeof challengeRecords) {
      challengeRecords = value
    },
    mismatchedDone,
    missingDone,
    now,
    redirectDone,
    scope,
    stallRoutes,
    startupRoot,
  }
}

async function createRedirectChallengeFetchContext9(t: TestContext) {
  const scope = testScope(t)
  const now = 2_000_000_000_000
  const block3 = createPlaybackResourcesBlock3()
  const { startupVault, startupGeneration, startupSession } = block3
  startupVault.reset(startupGeneration.generation, startupGeneration.epoch)
  const startupRoot = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/startup/video.m4s?k=1'
  const startupRep = startupVault.register({
    generation: startupGeneration.generation,
    epoch: startupGeneration.epoch,
    kind: 'video',
    key: 'startup:80',
    height: 1080,
    codec: 'av1',
    bandwidth: 3_000_000,
    urls: [startupRoot],
    source: 'trusted-api',
  })
  const block2 = createPlaybackResourcesBlock2(now, scope)
  const { stallSettings, stallRestrictions, stallEvidence } = block2
  await stallSettings.update({ considerNativeSources: true })
  const stallRoutes = new RouteCoordinator(
    { now: () => block2.stallNow, monotonicNow: () => block2.stallNow },
    startupSession,
    stallSettings,
    stallRestrictions,
    stallEvidence,
    startupVault,
    createRuntimeIds(),
  )
  if (startupRep) {
    const exactCatalogBackup = `https://${TRUSTED_CATALOG[0]}/upgcxcode/startup/video.m4s?k=backup-exact`
    startupVault.register({
      generation: startupGeneration.generation,
      epoch: startupGeneration.epoch,
      kind: 'video',
      key: 'startup:80',
      height: 1080,
      codec: 'av1',
      bandwidth: 3_000_000,
      urls: [exactCatalogBackup],
      source: 'trusted-api',
    })
    stallRoutes
      .startupOptions(startupRoot)
      ?.candidates.find((candidate) => candidate.host === TRUSTED_CATALOG[0])
    const incompatibleCatalog = stallRoutes
      .startupOptions(startupRoot)
      ?.candidates.find((candidate) => candidate.type === 'catalog-generated')
    if (incompatibleCatalog) {
      stallRoutes.noteStartupProbeResult(incompatibleCatalog, 403)
      await stallEvidence.record(incompatibleCatalog.host, 'video', {
        requestId: 'prior-fast-stream',
        at: block2.stallNow,
        source: 'transport',
        outcome: 'success',
        throughputMbps: 100,
        ttfbMs: 10,
        failureKind: null,
      })
      stallRoutes.plan(
        startupRep,
        { kind: 'video', requiredMbps: 8, highDemand: false },
        'new-epoch',
      )
    }
    stallRoutes.apply('https://upos-sz-mirrorali.bilivideo.com/upgcxcode/startup/unmatched.m4s?k=1')
    const initial = stallRoutes.apply(startupRoot)
    const fallback = stallRoutes.recoverStartup(
      startupRep,
      { kind: 'video', requiredMbps: 8, highDemand: false },
      initial.decision.host ?? '',
      [],
    )
    const firstFairProbe = stallRoutes.challenge(
      startupRep,
      { kind: 'video', requiredMbps: 8, highDemand: false },
      false,
    )
    stallRoutes.challenge(startupRep, { kind: 'video', requiredMbps: 8, highDemand: false }, false)
    if (firstFairProbe) {
      await stallRoutes.recordChallenge(firstFairProbe, 0, 100, 50, 'failure', null)
    }
    stallRoutes.snapshot().fallback.video
    const nextFallback = stallRoutes.apply(startupRoot)
    const fallbackRequest = {
      routePolicyRevision: stallRoutes.policyRevision(),
      requestId: requestId('fallback-next'),
      generation: startupGeneration.generation,
      epoch: startupGeneration.epoch,
      decisionId: nextFallback.decision.id,
      representation: startupRep,
      kind: 'video' as const,
      attributionStatus: 'matched' as const,
      attributionSource: 'exact' as const,
      decisionStage: 'request' as const,
      routeType: nextFallback.decision.routeType,
      originalHost: 'upos-sz-mirrorali.bilivideo.com',
      targetHost: fallback!.host!,
      sourceHost: 'upos-sz-mirrorali.bilivideo.com',
      playurlHostChanged: false,
      playurlOutput: null,
      urlChanged: true,
      hostChanged: true,
      startedAt: block2.stallNow,
    }
    stallRoutes.requestStarted({
      ...fallbackRequest,
      requestId: requestId('unrelated-same-host'),
      decisionId: decisionId('unrelated'),
    })
    stallRoutes.requestStarted(fallbackRequest)
    await stallRoutes.observe({
      request: fallbackRequest,
      generation: startupGeneration.generation,
      epoch: startupGeneration.epoch,
      decisionId: fallbackRequest.decisionId,
      representation: startupRep,
      kind: 'video',
      routeType: nextFallback.decision.routeType,
      originalHost: fallbackRequest.originalHost,
      targetHost: fallbackRequest.targetHost,
      finalHost: fallbackRequest.targetHost,
      streamKey: nextFallback.streamKey,
      status: 206,
      bytes: 100_000,
      ttfbMs: 20,
      elapsedMs: 250,
      completedAt: block2.stallNow + 250,
      outcome: 'success',
    })
    for (const host of TRUSTED_CATALOG)
      await stallRestrictions.add({
        host,
        type: 'black',
        kind: 'all',
        reason: 'no-route',
        expireAt: block2.stallNow + 60_000,
      })
    stallRoutes.recover(
      startupRep,
      { kind: 'video', requiredMbps: 8, highDemand: false },
      'verified-failure',
      fallback!.host,
    )
    for (const host of TRUSTED_CATALOG) await stallRestrictions.remove(host, 'black')
  }
  const directRangeResponse = (url: string, bytes: number): Response => {
    const response = new Response(new Uint8Array(bytes), { status: 206 })
    Object.defineProperty(response, 'url', { value: url })
    return response
  }
  const preflightOptions = stallRoutes.startupOptions(startupRoot)
  return {
    directRangeResponse,
    now,
    preflightOptions,
    scope,
    startupRoot,
  }
}

async function createRepeatedMonitoringNeverWritesPlaybackSpeed12Context11(t: TestContext) {
  const resources = await createRateMonitorResources(t)
  for (const rate of [1, 1.5, 0.75, 2, 1]) {
    resources.selectedRate = rate
    resources.rateMonitor.tick()
    resources.rateMonitor.tick()
  }
  return {
    get rateWrites() {
      return resources.rateWrites
    },
    get rateSamples() {
      return resources.rateSamples
    },
  }
}

async function createRateAdapterContext13(t: TestContext) {
  const scope = testScope(t)
  const now = 2_000_000_000_000
  const block1 = createPlaybackResourcesBlock1()
  const { recoveryPlayer } = block1
  const adapterVideo = {
    isConnected: true,
    paused: false,
    seeking: false,
    ended: false,
    readyState: 4,
    currentTime: 10,
    duration: 100,
    videoWidth: 1920,
    videoHeight: 1080,
    playbackRate: 1,
    buffered: { length: 1, start: () => 0, end: () => 70 },
    error: null,
  } as unknown as HTMLVideoElement
  class RateAdapter extends PlayerAdapter {
    override controls() {
      return {
        mediaId: 1,
        coreId: 1,
        seekRevision: 0,
        userRevision: 0,
        dragging: false,
        targetSec: null,
        reloadRevision: 0,
        coreReloadRevision: 0,
      }
    }
    override video(): HTMLVideoElement {
      return adapterVideo
    }
    override player(): Record<string, unknown> {
      return { getPlaybackRate: () => null }
    }
  }
  const rateAdapter = new RateAdapter(
    { transform: () => playurlResult(false), lifecycleKey: () => 'test' },
    {
      scheduler: { timeout: () => () => undefined },
      isActuallyVisible: () => true,
      subscribeControlLoss: () => () => undefined,
    },
  )
  return {
    adapterVideo,
    now,
    get playerSnapshot() {
      return block1.playerSnapshot
    },
    set playerSnapshot(value: typeof block1.playerSnapshot) {
      block1.playerSnapshot = value
    },
    rateAdapter,
    recoveryPlayer,
    scope,
  }
}

async function createHostLockNeverRestoresADeadRootAndMayChooseAContext14(t: TestContext) {
  const resources = await createRouteStateResources(t)
  const { liveVault, state, clock, session, settings, restrictions, evidenceStore, now, scope } =
    resources

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
  const block1 = createPlaybackResourcesBlock1()
  const { recoveryPlayer } = block1
  return {
    coordinator,
    liveRep,
    liveVault,
    now,
    get playerSnapshot() {
      return block1.playerSnapshot
    },
    set playerSnapshot(value: typeof block1.playerSnapshot) {
      block1.playerSnapshot = value
    },
    recoveryPlayer,
    restrictions,
    scope,
  }
}

async function checkCatalogHostSignedBackupCompetesAsItsOwnExactNativeURL(
  t: TestContext,
): Promise<void> {
  const base = await createStallNowAndstartupReloadsContext6(t)

  if (base.startupRep) {
    const exactCatalogBackup = `https://${TRUSTED_CATALOG[0]}/upgcxcode/startup/video.m4s?k=backup-exact`
    base.startupVault.register({
      generation: base.startupGeneration.generation,
      epoch: base.startupGeneration.epoch,
      kind: 'video',
      key: 'startup:80',
      height: 1080,
      codec: 'av1',
      bandwidth: 3_000_000,
      urls: [exactCatalogBackup],
      source: 'trusted-api',
    })
    const signedBackup = base.stallRoutes
      .startupOptions(base.startupRoot)
      ?.candidates.find((candidate) => candidate.host === TRUSTED_CATALOG[0])
    assert.strictEqual(
      signedBackup?.type,
      'native-signed',
      'Catalog-host signed backup competes as its own exact Native URL',
    )
    assert.strictEqual(
      signedBackup?.url,
      exactCatalogBackup,
      'signed backup retains its original query instead of synthesizing a URL',
    )
    const incompatibleCatalog = base.stallRoutes
      .startupOptions(base.startupRoot)
      ?.candidates.find((candidate) => candidate.type === 'catalog-generated')
    if (incompatibleCatalog) {
      base.stallRoutes.noteStartupProbeResult(incompatibleCatalog, 403)
      assert.ok(
        !base.stallRoutes
          .startupOptions(base.startupRoot)
          ?.candidates.some((candidate) => candidate.host === incompatibleCatalog.host),
        'Catalog 403 excludes only this stream-host pairing from startup fallback',
      )
      await base.stallEvidence.record(incompatibleCatalog.host, 'video', {
        requestId: 'prior-fast-stream',
        at: base.stallNow,
        source: 'transport',
        outcome: 'success',
        throughputMbps: 100,
        ttfbMs: 10,
        failureKind: null,
      })
      const laterChoice = base.stallRoutes.plan(
        base.startupRep,
        { kind: 'video', requiredMbps: 8, highDemand: false },
        'new-epoch',
      )
      assert.ok(
        laterChoice.host !== incompatibleCatalog.host,
        'this-stream 403 remains ineligible at a later route ranking boundary despite global speed evidence',
      )
    }
    const unmatchedStartup = base.stallRoutes.apply(
      'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/startup/unmatched.m4s?k=1',
    )
    assert.strictEqual(
      unmatchedStartup.decision.action,
      'pass',
      'unattributed first media request never blindly rewrites to first Catalog',
    )
    const initial = base.stallRoutes.apply(base.startupRoot)
    const fallback = base.stallRoutes.recoverStartup(
      base.startupRep,
      { kind: 'video', requiredMbps: 8, highDemand: false },
      initial.decision.host ?? '',
      [],
    )
    assert.ok(
      fallback && fallback.host !== initial.decision.host,
      'unconfirmed startup stall commits a different legal host',
    )
    assert.strictEqual(
      base.stallRoutes.apply(base.startupRoot).decision.host,
      fallback?.host,
      'next startup request uses committed fallback',
    )
    const firstFairProbe = base.stallRoutes.challenge(
      base.startupRep,
      { kind: 'video', requiredMbps: 8, highDemand: false },
      false,
    )
    const secondFairProbe = base.stallRoutes.challenge(
      base.startupRep,
      { kind: 'video', requiredMbps: 8, highDemand: false },
      false,
    )
    assert.ok(
      firstFairProbe &&
        secondFairProbe &&
        firstFairProbe.decision.host !== secondFairProbe.decision.host,
      'failed or unmeasured challenger is not selected again in the same round',
    )
    if (firstFairProbe) {
      await base.stallRoutes.recordChallenge(firstFairProbe, 0, 100, 50, 'failure', null)
      assert.strictEqual(
        base.stallRoutes.snapshot().affinity,
        null,
        'active probe failure does not change playback affinity',
      )
    }
    const plannedFallback = base.stallRoutes.snapshot().fallback.video
    assert.strictEqual(
      plannedFallback?.stage,
      'planned',
      'fallback plan is not reported as a sent request',
    )
    const nextFallback = base.stallRoutes.apply(base.startupRoot)
    assert.ok(
      nextFallback.url && nextFallback.decision.host === fallback?.host,
      'fallback remains legal for the next request',
    )
    const fallbackRequest = {
      routePolicyRevision: base.stallRoutes.policyRevision(),
      requestId: requestId('fallback-next'),
      generation: base.startupGeneration.generation,
      epoch: base.startupGeneration.epoch,
      decisionId: nextFallback.decision.id,
      representation: base.startupRep,
      kind: 'video' as const,
      attributionStatus: 'matched' as const,
      attributionSource: 'exact' as const,
      decisionStage: 'request' as const,
      routeType: nextFallback.decision.routeType,
      originalHost: 'upos-sz-mirrorali.bilivideo.com',
      targetHost: fallback!.host!,
      sourceHost: 'upos-sz-mirrorali.bilivideo.com',
      playurlHostChanged: false,
      playurlOutput: null,
      urlChanged: true,
      hostChanged: true,
      startedAt: base.stallNow,
    }
    base.stallRoutes.requestStarted({
      ...fallbackRequest,
      requestId: requestId('unrelated-same-host'),
      decisionId: decisionId('unrelated'),
    })
    assert.strictEqual(
      base.stallRoutes.snapshot().fallback.video?.stage,
      'planned',
      'a same-host request from another decision cannot impersonate the submitted fallback',
    )
    base.stallRoutes.requestStarted(fallbackRequest)
    assert.strictEqual(
      base.stallRoutes.snapshot().fallback.video?.stage,
      'entered-hook',
      'fallback entering the hook is distinct from observed completion',
    )
    await base.stallRoutes.observe({
      request: fallbackRequest,
      generation: base.startupGeneration.generation,
      epoch: base.startupGeneration.epoch,
      decisionId: fallbackRequest.decisionId,
      representation: base.startupRep,
      kind: 'video',
      routeType: nextFallback.decision.routeType,
      originalHost: fallbackRequest.originalHost,
      targetHost: fallbackRequest.targetHost,
      finalHost: fallbackRequest.targetHost,
      streamKey: nextFallback.streamKey,
      status: 206,
      bytes: 100_000,
      ttfbMs: 20,
      elapsedMs: 250,
      completedAt: base.stallNow + 250,
      outcome: 'success',
    })
    assert.strictEqual(
      base.stallRoutes.snapshot().fallback.video?.stage,
      'response-observed',
      'fallback is observed only after its own transport response',
    )
    for (const host of TRUSTED_CATALOG)
      await base.stallRestrictions.add({
        host,
        type: 'black',
        kind: 'all',
        reason: 'no-route',
        expireAt: base.stallNow + 60_000,
      })
    const noAlternate = base.stallRoutes.recover(
      base.startupRep,
      { kind: 'video', requiredMbps: 8, highDemand: false },
      'verified-failure',
      fallback!.host,
    )
    assert.strictEqual(
      noAlternate.action,
      'block',
      'all forbidden alternatives yield a blocked recovery decision',
    )
    assert.strictEqual(
      base.stallRoutes.snapshot().fallback.video,
      undefined,
      'no legal fallback clears an older submitted fallback instead of presenting it as current',
    )
    for (const host of TRUSTED_CATALOG) await base.stallRestrictions.remove(host, 'black')
  }
}

async function checkACatalogURLCanBeCheckedForThisStream7(t: TestContext): Promise<void> {
  const base = await createStallNowAndstartupReloadsContext6(t)

  if (base.startupRep) {
    const exactCatalogBackup = `https://${TRUSTED_CATALOG[0]}/upgcxcode/startup/video.m4s?k=backup-exact`
    base.startupVault.register({
      generation: base.startupGeneration.generation,
      epoch: base.startupGeneration.epoch,
      kind: 'video',
      key: 'startup:80',
      height: 1080,
      codec: 'av1',
      bandwidth: 3_000_000,
      urls: [exactCatalogBackup],
      source: 'trusted-api',
    })
    base.stallRoutes
      .startupOptions(base.startupRoot)
      ?.candidates.find((candidate) => candidate.host === TRUSTED_CATALOG[0])
    const incompatibleCatalog = base.stallRoutes
      .startupOptions(base.startupRoot)
      ?.candidates.find((candidate) => candidate.type === 'catalog-generated')
    if (incompatibleCatalog) {
      base.stallRoutes.noteStartupProbeResult(incompatibleCatalog, 403)
      await base.stallEvidence.record(incompatibleCatalog.host, 'video', {
        requestId: 'prior-fast-stream',
        at: base.stallNow,
        source: 'transport',
        outcome: 'success',
        throughputMbps: 100,
        ttfbMs: 10,
        failureKind: null,
      })
      base.stallRoutes.plan(
        base.startupRep,
        { kind: 'video', requiredMbps: 8, highDemand: false },
        'new-epoch',
      )
    }
    base.stallRoutes.apply(
      'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/startup/unmatched.m4s?k=1',
    )
    const initial = base.stallRoutes.apply(base.startupRoot)
    const fallback = base.stallRoutes.recoverStartup(
      base.startupRep,
      { kind: 'video', requiredMbps: 8, highDemand: false },
      initial.decision.host ?? '',
      [],
    )
    const firstFairProbe = base.stallRoutes.challenge(
      base.startupRep,
      { kind: 'video', requiredMbps: 8, highDemand: false },
      false,
    )
    base.stallRoutes.challenge(
      base.startupRep,
      { kind: 'video', requiredMbps: 8, highDemand: false },
      false,
    )
    if (firstFairProbe) {
      await base.stallRoutes.recordChallenge(firstFairProbe, 0, 100, 50, 'failure', null)
    }
    base.stallRoutes.snapshot().fallback.video
    const nextFallback = base.stallRoutes.apply(base.startupRoot)
    const fallbackRequest = {
      routePolicyRevision: base.stallRoutes.policyRevision(),
      requestId: requestId('fallback-next'),
      generation: base.startupGeneration.generation,
      epoch: base.startupGeneration.epoch,
      decisionId: nextFallback.decision.id,
      representation: base.startupRep,
      kind: 'video' as const,
      attributionStatus: 'matched' as const,
      attributionSource: 'exact' as const,
      decisionStage: 'request' as const,
      routeType: nextFallback.decision.routeType,
      originalHost: 'upos-sz-mirrorali.bilivideo.com',
      targetHost: fallback!.host!,
      sourceHost: 'upos-sz-mirrorali.bilivideo.com',
      playurlHostChanged: false,
      playurlOutput: null,
      urlChanged: true,
      hostChanged: true,
      startedAt: base.stallNow,
    }
    base.stallRoutes.requestStarted({
      ...fallbackRequest,
      requestId: requestId('unrelated-same-host'),
      decisionId: decisionId('unrelated'),
    })
    base.stallRoutes.requestStarted(fallbackRequest)
    await base.stallRoutes.observe({
      request: fallbackRequest,
      generation: base.startupGeneration.generation,
      epoch: base.startupGeneration.epoch,
      decisionId: fallbackRequest.decisionId,
      representation: base.startupRep,
      kind: 'video',
      routeType: nextFallback.decision.routeType,
      originalHost: fallbackRequest.originalHost,
      targetHost: fallbackRequest.targetHost,
      finalHost: fallbackRequest.targetHost,
      streamKey: nextFallback.streamKey,
      status: 206,
      bytes: 100_000,
      ttfbMs: 20,
      elapsedMs: 250,
      completedAt: base.stallNow + 250,
      outcome: 'success',
    })
    for (const host of TRUSTED_CATALOG)
      await base.stallRestrictions.add({
        host,
        type: 'black',
        kind: 'all',
        reason: 'no-route',
        expireAt: base.stallNow + 60_000,
      })
    base.stallRoutes.recover(
      base.startupRep,
      { kind: 'video', requiredMbps: 8, highDemand: false },
      'verified-failure',
      fallback!.host,
    )
    for (const host of TRUSTED_CATALOG) await base.stallRestrictions.remove(host, 'black')
  }
  const incompatibleSession = new SessionStore(),
    incompatibleState = incompatibleSession.beginGeneration(false)
  const incompatibleVault = new SignedRouteVault()
  incompatibleVault.reset(incompatibleState.generation, incompatibleState.epoch)
  const incompatibleRoot =
    'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/incompatible/segment.m4s?sig=clip'
  const incompatibleRep = incompatibleVault.register({
    generation: incompatibleState.generation,
    epoch: incompatibleState.epoch,
    kind: 'video',
    key: 'incompatible:80',
    height: 1080,
    codec: 'av1',
    bandwidth: 2_000_000,
    urls: [incompatibleRoot],
    source: 'trusted-api',
  })
  const incompatibleRoutes = new RouteCoordinator(
    base.clock,
    incompatibleSession,
    base.scope.own(new CatalogSettingsStore(new FakeStorage(), () => base.now)),
    base.scope.own(new RestrictionStore(new FakeStorage(), () => base.now)),
    base.scope.own(new EvidenceStore(new FakeStorage(), () => base.now)),
    incompatibleVault,
    createRuntimeIds(),
  )

  if (incompatibleRep) {
    const badCatalog = incompatibleRoutes
      .startupOptions(incompatibleRoot)
      ?.candidates.find((candidate) => candidate.type === 'catalog-generated')
    assert.ok(badCatalog, 'a Catalog URL can be checked for this stream')
    incompatibleRoutes.commitStartupChoice(
      incompatibleRoot,
      badCatalog ?? null,
      'startup-preflight',
    )
    const failed = incompatibleRoutes.apply(incompatibleRoot)
    assert.strictEqual(
      failed.decision.host,
      badCatalog?.host,
      'first media request uses the tested Catalog host',
    )
    await incompatibleRoutes.observe({
      generation: incompatibleState.generation,
      epoch: incompatibleState.epoch,
      decisionId: failed.decision.id,
      representation: incompatibleRep,
      kind: 'video',
      routeType: 'catalog-generated',
      originalHost: new URL(incompatibleRoot).host,
      targetHost: badCatalog!.host,
      finalHost: badCatalog!.host,
      streamKey: failed.streamKey,
      status: 403,
      bytes: 0,
      ttfbMs: 40,
      elapsedMs: 100,
      completedAt: base.now + 100,
      outcome: 'failure',
      responseUrlMatchesRequest: true,
    })
    const after403 = incompatibleRoutes.apply(incompatibleRoot)
    assert.ok(
      after403.url && after403.decision.host !== badCatalog?.host,
      'a per-stream Catalog 403 permits the next request to use a different legal host',
    )
    assert.strictEqual(
      after403.decision.host,
      incompatibleRoutes.snapshot().fallback.video?.plannedHost,
      'Catalog incompatibility fallback plan is actually used by the next request',
    )
  }
}

async function checkStartupStallFixtureHasARepresentation4(t: TestContext): Promise<void> {
  const base = await createStartupSessionAndstartupGenerationContext5(t)

  assert.ok(base.startupRep, 'startup stall fixture has a representation')
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

async function checkAdapterUsesRealParameterXForDemand13ParameterParameter(
  t: TestContext,
  parameter = 0,
): Promise<void> {
  const base = await createRateAdapterContext13(t)

  let iteration = 0
  for (const rate of [1, 1.5, 2, 0.75]) {
    if (iteration++ === parameter) {
      base.adapterVideo.playbackRate = rate
      assert.strictEqual(
        base.rateAdapter.snapshot().effectiveRate,
        rate,
        `adapter uses real ${rate}x for demand`,
      )
      assert.strictEqual(
        base.rateAdapter.snapshot().playableBufferSec,
        60 / rate,
        `buffer duration respects ${rate}x`,
      )
      assert.strictEqual(
        base.rateAdapter.playbackRate(),
        rate,
        'unavailable player API falls back to video rate',
      )

      return
    }
  }
  throw Error('Unknown fixture parameter')
}

async function check2xIsOnlyTheUnknownRatePlanningFallback14(t: TestContext): Promise<void> {
  const base = await createRateAdapterContext13(t)

  for (const rate of [1, 1.5, 2, 0.75]) {
    base.adapterVideo.playbackRate = rate
  }
  base.adapterVideo.playbackRate = Number.NaN

  assert.strictEqual(
    base.rateAdapter.snapshot().effectiveRate,
    2,
    '2x is only the unknown-rate planning fallback',
  )
  let savedRateRestored = 0,
    rateRecoveryNow = base.now
  const customRatePlayer: PlayerPort = {
    ...base.recoveryPlayer,
    playbackRate: () => 1.5,
    setRate: (value) => {
      savedRateRestored = value
    },
  }
  const customRateRecovery = base.scope.own(
    new RecoveryController(currentResumePlayer(customRatePlayer), () => rateRecoveryNow),
  )
  const healthyCustomRate = {
    ...base.playerSnapshot,
    playbackRate: 1.5,
    effectiveRate: 1.5,
  }
  customRateRecovery.tick(healthyCustomRate)
  customRateRecovery.armRouteFailure('route-failure', healthyCustomRate)
  rateRecoveryNow += 4000
  customRateRecovery.tick({
    ...healthyCustomRate,
    readyState: 0,
    width: 0,
    height: 0,
    coreInitialized: false,
  })
  rateRecoveryNow += 1000
  customRateRecovery.tick({ ...healthyCustomRate, frames: 2 })
  assert.strictEqual(
    savedRateRestored,
    1.5,
    'core recovery restores the saved user rate, not forced 2x',
  )
}

async function checkHostLockNeverRestoresADeadRootAndMayChooseA(t: TestContext): Promise<void> {
  const base = await createHostLockNeverRestoresADeadRootAndMayChooseAContext14(t)

  if (base.liveRep) {
    const root = base.liveVault.rootUrl(base.liveRep)!,
      lockedHost = new URL(root).host
    await base.restrictions.add({
      host: lockedHost,
      type: 'dead',
      kind: 'all',
      reason: 'host-lock-test',
      expireAt: base.now + 60_000,
    })
    const deadRootFallback = base.coordinator.apply(root)
    assert.ok(
      deadRootFallback.url !== root && deadRootFallback.decision.host !== lockedHost,
      'host-lock never restores a dead root and may choose a legal alternative',
    )
    const lockedPlan = base.coordinator.plan(
      base.liveRep,
      { kind: 'video', requiredMbps: 3, highDemand: false },
      'startup',
    )
    assert.ok(
      base.coordinator.playerOutput(base.liveRep, root, lockedPlan, [root]).primary !== root,
      'host-locked dead root cannot leak through playurl output',
    )
  }
}

async function checkNormalShortResumeReturnsHealthyState16(t: TestContext): Promise<void> {
  const base = await createHostLockNeverRestoresADeadRootAndMayChooseAContext14(t)

  if (base.liveRep) {
    const root = base.liveVault.rootUrl(base.liveRep)!,
      lockedHost = new URL(root).host
    await base.restrictions.add({
      host: lockedHost,
      type: 'dead',
      kind: 'all',
      reason: 'host-lock-test',
      expireAt: base.now + 60_000,
    })
    base.coordinator.apply(root)
    base.coordinator.plan(
      base.liveRep,
      { kind: 'video', requiredMbps: 3, highDemand: false },
      'startup',
    )
  }
  let shortResumeNow = base.now
  const shortResume = base.scope.own(
    new RecoveryController(currentResumePlayer(base.recoveryPlayer), () => shortResumeNow),
  )
  shortResume.tick({ ...base.playerSnapshot, paused: false })
  shortResumeNow += 1000
  shortResume.tick({ ...base.playerSnapshot, paused: true })
  shortResumeNow += 1000
  shortResume.tick({ ...base.playerSnapshot, paused: false, frames: 100 })

  assert.strictEqual(
    shortResume.snapshot().state,
    'healthy',
    'normal short resume returns to healthy recovery state',
  )
}

async function checkRepeatedMonitoringNeverWritesPlaybackSpeed12(t: TestContext): Promise<void> {
  const base = await createRepeatedMonitoringNeverWritesPlaybackSpeed12Context11(t)

  assert.strictEqual(base.rateSamples, 10, 'all ten monitoring ticks reach the rate observer')
  assert.strictEqual(base.rateWrites, 0, 'repeated monitoring never writes playback speed')
}

async function checkMonitorObservesSelectedParameterX11ParameterParameter(
  t: TestContext,
  parameter = 0,
): Promise<void> {
  const base = await createRateMonitorResources(t)

  let iteration = 0
  for (const rate of [1, 1.5, 0.75, 2, 1]) {
    if (iteration++ === parameter) {
      base.selectedRate = rate
      base.rateMonitor.tick()
      base.rateMonitor.tick()
      assert.strictEqual(base.observedRate, rate, `monitor observes selected ${rate}x`)

      return
    }
  }
  throw Error('Unknown fixture parameter')
}

async function checkAlreadyAbortedPlayerRequestRejectsStartupGate10(t: TestContext): Promise<void> {
  const base = await createRedirectChallengeFetchContext9(t)
  const preflightSettings = base.scope.own(
    new CatalogSettingsStore(new FakeStorage(), () => base.now),
  )
  await preflightSettings.update({ startupEarlyReleaseEnabled: false })
  const preflightOptions = base.preflightOptions
  assert.ok(preflightOptions)

  if (preflightOptions) {
    let preflightFetches = 0,
      committedHost: string | null = null,
      startupSamples = 0
    const preflightRoutes = {
      isCatalogOnly: () => false,
      startupOptions: () => preflightOptions,
      commitStartupChoice: (_url: string, candidate: { host: string } | null) => {
        committedHost = candidate?.host ?? null
        return candidate ? { host: candidate.host } : null
      },
      recordStartupSuccess: async () => {
        startupSamples++
      },
      noteStartupProbeResult: () => undefined,
    }
    const preflightFetch = async (input: RequestInfo | URL): Promise<Response> => {
      preflightFetches++
      const host = new URL(String(input)).host
      const length =
        host ===
        preflightOptions.candidates.find((candidate) => candidate.type === 'catalog-generated')
          ?.host
          ? 256 * 1024
          : 70 * 1024
      return base.directRangeResponse(String(input), length)
    }
    const preflight = base.scope.own(
      new MeasurementController(
        measurementRoutes(preflightRoutes),
        new MeasurementMetaStore(new FakeStorage(), () => base.now),
        new RangeProbeAdapter(
          preflightFetch as typeof fetch,
          (() => {
            let tick = 0
            return () => tick++
          })(),
        ),
        () => base.now,
        new BrowserScheduler(),
        undefined,
        undefined,
        preflightSettings,
        () => base.now,
      ),
    )
    const abortedStartup = new AbortController()
    abortedStartup.abort()
    let abortRejected = false
    try {
      await preflight.prepareStartup(base.startupRoot, abortedStartup.signal)
    } catch {
      abortRejected = true
    }
    assert.strictEqual(abortRejected, true, 'already-aborted player request rejects startup gate')
    assert.strictEqual(preflightFetches, 0, 'already-aborted player request starts no probe')
    await preflight.prepareStartup(base.startupRoot)
    assert.strictEqual(
      committedHost,
      preflightOptions.candidates.find((candidate) => candidate.type === 'catalog-generated')?.host,
      'faster qualified Catalog wins bounded preflight',
    )
    assert.strictEqual(
      preflightFetches,
      preflightOptions.candidates.length,
      'cold window probes no more than three distinct routes',
    )
    assert.ok(startupSamples > 0, 'valid full startup sample contributes to later evidence')
    await preflight.prepareStartup(base.startupRoot)
    assert.strictEqual(
      preflightFetches,
      preflightOptions.candidates.length,
      'startup preflight runs only once per tab',
    )
    const timeoutRoutes = {
      ...preflightRoutes,
      commitStartupChoice: (_url: string, candidate: { host: string } | null) => {
        committedHost = candidate?.host ?? null
        return candidate ? { host: candidate.host } : null
      },
    }
    let hangingProbes = 0
    const probesStarted = deferred<void>(),
      deadlineClock = base.scope.own(new FakeClock())
    const hangingFetch = async (
      _input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      hangingProbes++
      if (hangingProbes === preflightOptions.candidates.length) probesStarted.resolve()
      return await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        )
      })
    }
    committedHost = null
    const timedPreflight = base.scope.own(
      new MeasurementController(
        measurementRoutes(timeoutRoutes),
        new MeasurementMetaStore(new FakeStorage(), () => base.now),
        new RangeProbeAdapter(hangingFetch as typeof fetch, deadlineClock.now),
        deadlineClock.now,
        deadlineClock,
        undefined,
        undefined,
        undefined,
        deadlineClock.now,
      ),
    )
    let gateSettled = false
    const pendingGate = timedPreflight.prepareStartup(base.startupRoot).then(() => {
      gateSettled = true
    })
    await probesStarted.promise
    deadlineClock.advance(2999)
    await Promise.resolve()
    assert.strictEqual(gateSettled, false, 'startup remains pending at 2999 ms')
    deadlineClock.advance(1)
    await pendingGate
    assert.strictEqual(gateSettled, true, 'startup completes at 3000 ms')
    assert.strictEqual(
      deadlineClock.now(),
      2_000_000_003_000,
      'cold preflight releases a hanging player request within the three-second window',
    )
    assert.strictEqual(
      hangingProbes,
      preflightOptions.candidates.length,
      'startup deadline bounds all parallel probes in one window',
    )
    assert.strictEqual(
      committedHost,
      null,
      'inconclusive window without an untested candidate never selects a tested failure',
    )
    const cachedHost = preflightOptions.candidates.find(
      (candidate) => candidate.type === 'catalog-generated',
    )?.host
    const cachedOptions = {
      ...preflightOptions,
      candidates: preflightOptions.candidates.map((candidate) =>
        candidate.host === cachedHost ? { ...candidate, cachedSafeMbps: 1000 } : candidate,
      ),
    }
    const ranges = new Map<string, string>()
    const compatibilityFetch = async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      const host = new URL(String(input)).host
      ranges.set(host, String((init?.headers as Record<string, string> | undefined)?.Range ?? ''))
      return base.directRangeResponse(String(input), host === cachedHost ? 16 * 1024 : 70 * 1024)
    }
    const cachedPreflight = base.scope.own(
      new MeasurementController(
        measurementRoutes({ ...preflightRoutes, startupOptions: () => cachedOptions }),
        new MeasurementMetaStore(new FakeStorage(), () => base.now),
        new RangeProbeAdapter(compatibilityFetch as typeof fetch, () => base.now),
        () => base.now,
        new BrowserScheduler(),
        undefined,
        undefined,
        undefined,
        () => base.now,
      ),
    )
    await cachedPreflight.prepareStartup(base.startupRoot)
    assert.strictEqual(
      ranges.get(cachedHost ?? ''),
      'bytes=0-16383',
      'cross-tab Catalog evidence requires only a 16 KiB current-URL compatibility range',
    )
    assert.strictEqual(
      committedHost,
      cachedHost,
      'compatible recent Catalog sample can win without redownloading a full throughput sample',
    )
    let startupRedirectMode: RequestRedirect | undefined,
      redirectStartupSamples = 0
    const redirectStartup = base.scope.own(
      new MeasurementController(
        measurementRoutes({
          ...preflightRoutes,
          recordStartupSuccess: async () => {
            redirectStartupSamples++
          },
        }),
        new MeasurementMetaStore(new FakeStorage(), () => base.now),
        new RangeProbeAdapter(
          (async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            startupRedirectMode = init?.redirect
            if (init?.redirect === 'error') throw new TypeError('redirect refused')
            return new Response(new Uint8Array(70 * 1024), { status: 206 })
          }) as typeof fetch,
          () => base.now,
        ),
        () => base.now,
        new BrowserScheduler(),
        undefined,
        undefined,
        undefined,
        () => base.now,
      ),
    )
    await redirectStartup.prepareStartup(base.startupRoot)
    assert.strictEqual(startupRedirectMode, 'error', 'startup probes forbid HTTP redirects')
    assert.strictEqual(
      redirectStartupSamples,
      0,
      'redirected startup probes create no throughput evidence',
    )
    assert.strictEqual(
      committedHost,
      null,
      'redirected startup without an untested fallback cannot select a failed original',
    )
    const wrongHostStartup = base.scope.own(
      new MeasurementController(
        measurementRoutes({
          ...preflightRoutes,
          recordStartupSuccess: async () => {
            redirectStartupSamples++
          },
        }),
        new MeasurementMetaStore(new FakeStorage(), () => base.now),
        new RangeProbeAdapter(
          (async (): Promise<Response> => {
            const response = new Response(new Uint8Array(70 * 1024), { status: 206 })
            Object.defineProperty(response, 'url', {
              value: 'https://upos-sz-mirrorhwov.bilivideo.com/upgcxcode/a/b/redirected.m4s',
            })
            return response
          }) as typeof fetch,
          () => base.now,
        ),
        () => base.now,
        new BrowserScheduler(),
        undefined,
        undefined,
        undefined,
        () => base.now,
      ),
    )
    await wrongHostStartup.prepareStartup(base.startupRoot)
    assert.strictEqual(
      redirectStartupSamples,
      0,
      'mismatched startup response host creates no throughput evidence',
    )
  }
}

async function checkSafePlaybackConsidersUpToThreeFairChallengers9(t: TestContext): Promise<void> {
  const base = await createStartupRecoveryContext8(t)

  assert.strictEqual(base.challengeCalls, 3, 'safe playback considers up to three fair challengers')
  assert.strictEqual(base.challengeFetches, 3, 'each safe challenger performs one bounded request')
  assert.strictEqual(base.challengeRecords, 3, 'each valid challenger updates evidence once')
  let challengeRedirectSetting: RequestRedirect | undefined
  const redirectChallengeFetch = async (
    _input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    challengeRedirectSetting = init?.redirect
    if (init?.redirect === 'error') throw new TypeError('redirect refused')
    return new Response(new Uint8Array(70 * 1024), { status: 206 })
  }
  let redirectedChallengeSamples = 0
  const redirectChallengeRoutes = {
    isCatalogOnly: () => false,
    challenge: () => base.challengeApplied,
    recordChallenge: async (
      _route: unknown,
      _bytes: number,
      _elapsed: number,
      _ttfb: number | null,
      outcome: string,
    ) => {
      if (outcome === 'success') redirectedChallengeSamples++
      base.redirectDone.complete()
    },
  }
  const redirectChallenge = base.scope.own(
    new MeasurementController(
      measurementRoutes(redirectChallengeRoutes),
      new MeasurementMetaStore(new FakeStorage(), () => base.now),
      new RangeProbeAdapter(redirectChallengeFetch as typeof fetch, () => base.now),
      () => base.now,
      new BrowserScheduler(),
      undefined,
      undefined,
      undefined,
      () => base.now,
    ),
  )
  redirectChallenge.tick({ ...base.baseMeasurement, playableBufferSec: 30 })
  await base.redirectDone.promise
  assert.strictEqual(challengeRedirectSetting, 'error', 'healthy challenge forbids HTTP redirects')
  assert.strictEqual(redirectedChallengeSamples, 0, 'redirected challenge cannot add host evidence')
  const redirectedResponse = new Response(new Uint8Array(70 * 1024), { status: 206 })
  Object.defineProperty(redirectedResponse, 'url', {
    value: 'https://upos-sz-mirrorhwov.bilivideo.com/upgcxcode/a/b/redirected.m4s',
  })
  let mismatchedChallengeSuccesses = 0
  const mismatchedChallenge = base.scope.own(
    new MeasurementController(
      measurementRoutes({
        isCatalogOnly: () => false,
        challenge: () => base.challengeApplied,
        recordChallenge: async (
          _route: unknown,
          _bytes: number,
          _elapsed: number,
          _ttfb: number | null,
          outcome: string,
        ) => {
          if (outcome === 'success') mismatchedChallengeSuccesses++
          base.mismatchedDone.complete()
        },
      }),
      new MeasurementMetaStore(new FakeStorage(), () => base.now),
      new RangeProbeAdapter((async () => redirectedResponse) as typeof fetch, () => base.now),
      () => base.now,
      new BrowserScheduler(),
      undefined,
      undefined,
      undefined,
      () => base.now,
    ),
  )
  mismatchedChallenge.tick({ ...base.baseMeasurement, playableBufferSec: 30 })
  await base.mismatchedDone.promise
  assert.strictEqual(
    mismatchedChallengeSuccesses,
    0,
    'a mismatched response host cannot be credited to the challenged host',
  )
  const missingHostChallenge = base.scope.own(
    new MeasurementController(
      measurementRoutes({
        isCatalogOnly: () => false,
        challenge: () => base.challengeApplied,
        recordChallenge: async (
          _route: unknown,
          _bytes: number,
          _elapsed: number,
          _ttfb: number | null,
          outcome: string,
        ) => {
          if (outcome === 'success') mismatchedChallengeSuccesses++
          base.missingDone.complete()
        },
      }),
      new MeasurementMetaStore(new FakeStorage(), () => base.now),
      new RangeProbeAdapter(
        (async () => new Response(new Uint8Array(70 * 1024), { status: 206 })) as typeof fetch,
        () => base.now,
      ),
      () => base.now,
      new BrowserScheduler(),
      undefined,
      undefined,
      undefined,
      () => base.now,
    ),
  )
  missingHostChallenge.tick({ ...base.baseMeasurement, playableBufferSec: 30 })
  await base.missingDone.promise
  assert.strictEqual(
    mismatchedChallengeSuccesses,
    0,
    'a response with no verifiable host cannot create probe evidence',
  )
  const preflightOptions = base.stallRoutes.startupOptions(base.startupRoot)
  assert.ok(
    preflightOptions && preflightOptions.candidates.length >= 2,
    'preflight offers original and legal Catalog candidate',
  )
}

async function checkDisabledModeNeitherProbesNorInitiatesScriptRouteCoreRecovery(
  t: TestContext,
): Promise<void> {
  const base = await createChallengeDoneAndredirectDoneAndmismatchedDoneAndmissingDoneContext7(t)

  assert.ok(
    base.originalProbeDisabled && base.originalRecoveryTicks === 0 && base.originalFallbacks === 0,
    'disabled mode neither probes nor initiates script route/core recovery',
  )
  const startupRecovery = base.scope.own(
    new RecoveryController(
      currentResumePlayer({
        ...base.recoveryPlayer,
        snapshot: () => base.deadStartup,
        reload: () => {
          base.startupReloads++
        },
        currentTime: () => 0,
        playbackRate: () => 1,
      } satisfies PlayerPort),
      () => base.stallNow,
    ),
  )
  startupRecovery.armStartupFailure(base.deadStartup)
  base.stallNow += 4000
  startupRecovery.tick(base.deadStartup)
  assert.strictEqual(
    base.startupReloads,
    1,
    'cold-start dead core reloads once despite no prior healthy frames',
  )
  base.stallNow += 4000
  startupRecovery.tick(base.deadStartup)
  assert.strictEqual(base.startupReloads, 1, 'startup recovery does not loop reload')
  let softFallbacks = 0,
    startupArms = 0
  const stallMonitor = base.scope.own(
    new PlayerMonitor(
      {
        ...base.recoveryPlayer,
        snapshot: () => base.deadStartup,
        syncManifest: () => true,
      } satisfies PlayerPort,
      base.startupSession,
      base.scope.own(new CatalogSettingsStore(new FakeStorage(), () => base.stallNow)),
      base.startupVault,
      monitorRoutes({
        recoveryEligible: () => true,
        firstMediaAt: () => base.now,
        latestRequested: () => ({
          routePolicyRevision: 0,
          targetHost: 'upos-sz-mirrorali.bilivideo.com',
          representation: base.startupRep,
          generation: base.startupGeneration.generation,
          epoch: base.startupGeneration.epoch,
        }),
        recoverStartup: () => {
          softFallbacks++
          return { host: TRUSTED_CATALOG[0] }
        },
        observePlaybackRate: () => undefined,
      }),
      monitorMeasurement({ tick: () => undefined }),
      monitorRecovery({
        tick: () => undefined,
        isRecovering: () => false,
        armStartupFailure: () => {
          startupArms++
        },
      }),
      () => true,
      () => base.stallNow,
      new BrowserScheduler(),
      undefined,
      () => base.stallNow,
    ),
  )
  base.stallNow = base.now + 14_000
  stallMonitor.tick()
  assert.strictEqual(softFallbacks, 0, 'unconfirmed startup stall waits fifteen seconds')
  base.stallNow = base.now + 15_000
  stallMonitor.tick()
  assert.strictEqual(softFallbacks, 1, 'unconfirmed startup stall submits one different route')
  assert.strictEqual(startupArms, 1, 'unconfirmed startup stall arms bounded player recovery')
  base.stallNow = base.now + 16_000
  stallMonitor.tick()
  assert.strictEqual(softFallbacks, 1, 'startup stall fallback is not repeated each tick')
  let challengeCalls = 0,
    challengeFetches = 0,
    challengeRecords = 0
  const directRangeResponse = (url: string, bytes: number): Response => {
    const response = new Response(new Uint8Array(bytes), { status: 206 })
    Object.defineProperty(response, 'url', { value: url })
    return response
  }
  const challengeApplied: AppliedRouteDecision = {
    decision: {
      action: 'rewrite',
      id: decisionId('challenge'),
      reason: 'test',
      routeType: 'catalog-generated',
      host: TRUSTED_CATALOG[1],
      candidate: {
        type: 'catalog-generated',
        host: TRUSTED_CATALOG[1],
        kind: 'video',
        catalogIndex: 1,
      },
      ranking: [],
    },
    url: `https://${TRUSTED_CATALOG[1]}/upgcxcode/a/b/challenge.m4s`,
    context: {
      generation: generationId(1),
      epoch: epochId(1),
      representation: representationId('video:test'),
      kind: 'video',
      authorityRevision: 1,
    },
    streamKey: 'challenge',
    sourceHost: TRUSTED_CATALOG[0],
  }
  const challengeRoutes = {
    isCatalogOnly: () => false,
    challenge: () => {
      challengeCalls++
      return challengeApplied
    },
    recordChallenge: async () => {
      challengeRecords++
      base.challengeDone.complete()
    },
  }
  const challengeFetch = async (): Promise<Response> => {
    challengeFetches++
    return directRangeResponse(challengeApplied.url ?? '', 70 * 1024)
  }
  const measurement = base.scope.own(
    new MeasurementController(
      measurementRoutes(challengeRoutes),
      new MeasurementMetaStore(new FakeStorage(), () => base.now),
      new RangeProbeAdapter(challengeFetch as typeof fetch, () => base.now),
      () => base.now,
      new BrowserScheduler(),
      undefined,
      undefined,
      undefined,
      () => base.now,
    ),
  )
  const baseMeasurement = {
    generationActive: true,
    representation: representationId('video:test'),
    demand: { kind: 'video' as const, requiredMbps: 8, highDemand: false },
    stableProgressTicks: 20,
    playableBufferSec: 29,
    visible: true,
    seeking: false,
    recovering: false,
    disabled: false,
  }
  measurement.tick(baseMeasurement)
  assert.strictEqual(challengeCalls, 0, 'low buffer prevents challenger selection and network')
}

async function checkCatalogIncompatibilityFixtureHasARepresentation6(
  t: TestContext,
): Promise<void> {
  testScope(t)

  const incompatibleSession = new SessionStore(),
    incompatibleState = incompatibleSession.beginGeneration(false)
  const incompatibleVault = new SignedRouteVault()
  incompatibleVault.reset(incompatibleState.generation, incompatibleState.epoch)
  const incompatibleRoot =
    'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/incompatible/segment.m4s?sig=clip'
  const incompatibleRep = incompatibleVault.register({
    generation: incompatibleState.generation,
    epoch: incompatibleState.epoch,
    kind: 'video',
    key: 'incompatible:80',
    height: 1080,
    codec: 'av1',
    bandwidth: 2_000_000,
    urls: [incompatibleRoot],
    source: 'trusted-api',
  })

  assert.ok(incompatibleRep, 'Catalog incompatibility fixture has a representation')
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
test('startup stall fixture has a representation [4]', { timeout: 5000 }, async (t) => {
  await checkStartupStallFixtureHasARepresentation4(t)
})
test(
  'Catalog-host signed backup competes as its own exact Native URL [5]',
  { timeout: 5000 },
  async (t) => {
    await checkCatalogHostSignedBackupCompetesAsItsOwnExactNativeURL(t)
  },
)
test('Catalog incompatibility fixture has a representation [6]', { timeout: 5000 }, async (t) => {
  await checkCatalogIncompatibilityFixtureHasARepresentation6(t)
})
test('a Catalog URL can be checked for this stream [7]', { timeout: 5000 }, async (t) => {
  await checkACatalogURLCanBeCheckedForThisStream7(t)
})
test(
  'disabled mode neither probes nor initiates script route/core recovery [8]',
  { timeout: 5000 },
  async (t) => {
    await checkDisabledModeNeitherProbesNorInitiatesScriptRouteCoreRecovery(t)
  },
)
test('safe playback considers up to three fair challengers [9]', { timeout: 5000 }, async (t) => {
  await checkSafePlaybackConsidersUpToThreeFairChallengers9(t)
})
test('already-aborted player request rejects startup gate [10]', { timeout: 5000 }, async (t) => {
  await checkAlreadyAbortedPlayerRequestRejectsStartupGate10(t)
})
{
  let parameter = 0
  for (const rate of [1, 1.5, 0.75, 2, 1]) {
    const selected = parameter++
    test(
      '`monitor observes selected ${rate}x` [11]' + ` / ${String(rate)} / ${selected}`,
      { timeout: 5000 },
      async (t) => {
        await checkMonitorObservesSelectedParameterX11ParameterParameter(t, selected)
      },
    )
  }
}
test('repeated monitoring never writes playback speed [12]', { timeout: 5000 }, async (t) => {
  await checkRepeatedMonitoringNeverWritesPlaybackSpeed12(t)
})
{
  let parameter = 0
  for (const rate of [1, 1.5, 2, 0.75]) {
    const selected = parameter++
    test(
      '`adapter uses real ${rate}x for demand` [13]' + ` / ${String(rate)} / ${selected}`,
      { timeout: 5000 },
      async (t) => {
        await checkAdapterUsesRealParameterXForDemand13ParameterParameter(t, selected)
      },
    )
  }
}
test('2x is only the unknown-rate planning fallback [14]', { timeout: 5000 }, async (t) => {
  await check2xIsOnlyTheUnknownRatePlanningFallback14(t)
})
test(
  'host-lock never restores a dead root and may choose a legal alternative [15]',
  { timeout: 5000 },
  async (t) => {
    await checkHostLockNeverRestoresADeadRootAndMayChooseA(t)
  },
)
test('normal short resume returns to healthy recovery state [16]', { timeout: 5000 }, async (t) => {
  await checkNormalShortResumeReturnsHealthyState16(t)
})
import '../regressions/functional-races/recovery.ts'
import '../regressions/functional-races/br01.ts'
import '../regressions/functional-races/br06.ts'
import '../regressions/functional-races/br08.ts'
import '../regressions/functional-races/br01-followthrough.ts'
import '../regressions/functional-races/br09.ts'
import '../regressions/functional-races/player-convergence.ts'
import '../regressions/functional-races/rescue-position.ts'
import '../regressions/functional-races/rescue-recovery.ts'
import '../regressions/functional-races/restore-ownership.ts'
import '../regressions/functional-races/restore-closed-loop.ts'
import '../regressions/recovery-restore-controller.ts'
import '../regressions/functional-races/rescue-timing.ts'
import '../regressions/functional-races/rescue-runtime.ts'
import '../regressions/functional-races/rescue-sustained.ts'
import { idleControls } from '../support/player.ts'
import '../regressions/up141-test-release.ts'

import '../regressions/v226-startup.ts'

import '../regressions/v226-routing.ts'
import '../regressions/v226-api-order.ts'
import '../regressions/v226-http-status.ts'
import '../regressions/v226-monitor.ts'
import '../regressions/v226-recovery.ts'
import '../regressions/v226-interleavings.ts'
import '../regressions/v229-playback-facts.ts'
import '../regressions/v230-startup.ts'
import '../regressions/v2212-route-retirement.ts'
