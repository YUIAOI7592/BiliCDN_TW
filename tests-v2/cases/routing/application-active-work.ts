import { createMutablePlaybackResources } from '../../support/player.ts'
import { CatalogSettingsStore } from '../../support/catalog-settings.ts'
import { currentResumePlayer } from '../../support/player.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { FakeClock } from '../../support/clock.ts'
import { deferred, countdown } from '../../support/deferred.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { type TestContext } from 'node:test'
import {
  measurementRoutes,
  monitorRoutes,
  monitorMeasurement,
  monitorRecovery,
} from '../../support/controllers.ts'
import { RangeProbeAdapter } from '../../../src-v2/adapters/transport/range-probe.ts'
import { MeasurementMetaStore } from '../../../src-v2/state/measurement-meta-store.ts'
import {
  decisionId,
  epochId,
  generationId,
  representationId,
  requestId,
} from '../../../src-v2/domain/model.ts'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import { SignedRouteVault } from '../../../src-v2/state/signed-route-vault.ts'
import { RestrictionStore } from '../../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../../src-v2/state/evidence-store.ts'
import { SessionStore } from '../../../src-v2/state/session-store.ts'
import { RouteCoordinator } from '../../../src-v2/application/routing/route-coordinator.ts'
import { type AppliedRouteDecision } from '../../../src-v2/application/routing/route-contracts.ts'
import { RecoveryController } from '../../../src-v2/application/playback/recovery-controller.ts'
import { MeasurementController } from '../../../src-v2/application/measurement/measurement-controller.ts'
import { PlayerMonitor } from '../../../src-v2/application/playback/player-monitor.ts'
import {
  type PlayerPort,
  type VideoSnapshot,
} from '../../../src-v2/application/playback/player-contracts.ts'
import { FakeStorage } from '../../support/storage.ts'
import { testScope } from '../../support/scope.ts'
import { BrowserScheduler } from '../../../src-v2/adapters/scheduler.ts'
import {
  createStallEvidenceResources,
  createStartupVaultResources,
} from './application-resources.ts'

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
  const block1 = createMutablePlaybackResources()
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
  const block3 = createStartupVaultResources()
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
  const block1 = createMutablePlaybackResources()
  const { recoveryPlayer } = block1
  const block3 = createStartupVaultResources()
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
    stableProgressMs: 20_000,
    progressObservation: 'progress' as const,
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
  const block3 = createStartupVaultResources()
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
  const block2 = createStallEvidenceResources(now, scope)
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

async function checkAlreadyAbortedPlayerRequestRejectsStartupGate10(t: TestContext): Promise<void> {
  const base = await createRedirectChallengeFetchContext9(t)
  const preflightSettings = base.scope.own(
    new CatalogSettingsStore(new FakeStorage(), () => base.now),
  )
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
      preflightOptions.candidates[0]?.host,
      'first qualified candidate releases bounded preflight',
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
    stableProgressMs: 20_000,
    progressObservation: 'progress' as const,
    playableBufferSec: 29,
    visible: true,
    seeking: false,
    recovering: false,
    disabled: false,
  }
  measurement.tick(baseMeasurement)
  assert.strictEqual(challengeCalls, 0, 'low buffer prevents challenger selection and network')
}

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
