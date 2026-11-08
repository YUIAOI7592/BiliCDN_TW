import { CatalogSettingsStore } from '../../support/catalog-settings.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { type TestContext } from 'node:test'
import { decisionId, requestId } from '../../../src-v2/domain/model.ts'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import { SignedRouteVault } from '../../../src-v2/state/signed-route-vault.ts'
import { RestrictionStore } from '../../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../../src-v2/state/evidence-store.ts'
import { SessionStore } from '../../../src-v2/state/session-store.ts'
import { RouteCoordinator } from '../../../src-v2/application/routing/route-coordinator.ts'
import { FakeStorage } from '../../support/storage.ts'
import { testScope } from '../../support/scope.ts'
import {
  createStallEvidenceResources,
  createStartupVaultResources,
  createRouteStateResources,
} from './application-resources.ts'

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
  const block3 = createStartupVaultResources()
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
