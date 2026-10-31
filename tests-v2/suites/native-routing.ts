import { extendFixture } from '../support/fixture-context.ts'
import { CatalogSettingsStore } from '../support/catalog-settings.ts'
import { createRuntimeIds } from '../../src-v2/platform/runtime-ids.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { PlayurlController } from '../../src-v2/application/playurl-controller.ts'
import { decisionId, epochId, generationId, requestId } from '../../src-v2/domain/model.ts'
import { TRUSTED_CATALOG } from '../../src-v2/domain/catalog.ts'
import { SignedRouteVault } from '../../src-v2/state/signed-route-vault.ts'
import { RestrictionStore } from '../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../src-v2/state/evidence-store.ts'
import { SessionStore } from '../../src-v2/state/session-store.ts'
import { RouteCoordinator } from '../../src-v2/application/route-coordinator.ts'
import type { TransportObservation } from '../../src-v2/domain/model.ts'
import { PlayurlAdapter } from '../../src-v2/adapters/playurl.ts'
import { FakeStorage } from '../support/storage.ts'
import { testScope } from '../support/scope.ts'

// Named scenarios create only their prerequisite state; resources belong to this test.
async function createNativeRoutingScenario(t: TestContext) {
  const scope = testScope(t)
  const now = 2_000_000_000_000
  const clock = { now: () => now }
  const healthyObservation: TransportObservation = {
    generation: generationId(1),
    epoch: epochId(1),
    decisionId: decisionId('aggregate'),
    representation: null,
    kind: 'video',
    routeType: 'catalog-generated',
    originalHost: 'a.example',
    targetHost: 'b.example',
    finalHost: 'b.example',
    status: 206,
    bytes: 100_000,
    ttfbMs: 20,
    elapsedMs: 100,
    completedAt: now,
    outcome: 'success',
    streamKey: 'aggregate',
  }
  const transitionStorage = new FakeStorage(),
    transitionSession = new SessionStore()
  const transitionState = transitionSession.beginGeneration(false),
    transitionVault = new SignedRouteVault()
  transitionVault.reset(transitionState.generation, transitionState.epoch)
  const transitionSettings = scope.own(new CatalogSettingsStore(transitionStorage, () => now))
  await transitionSettings.update({ considerNativeSources: true })
  const transitionRestrictions = scope.own(new RestrictionStore(transitionStorage, () => now))
  const transitionRoutes = new RouteCoordinator(
    clock,
    transitionSession,
    transitionSettings,
    transitionRestrictions,
    scope.own(new EvidenceStore(transitionStorage, () => now)),
    transitionVault,
    createRuntimeIds(),
  )
  const transitionAdapter = new PlayurlAdapter(
    new PlayurlController(transitionSession, transitionVault, transitionRoutes),
  )
  const transitionItems = [1080, 720].map((height, index) => ({
    id: 80 - index * 16,
    codecid: 13,
    height,
    bandwidth: 1_000_000,
    base_url: `https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/transition/${height}/1.m4s?k=1`,
    backup_url: [
      `https://upos-hz-mirrorakam.akamaized.net/upgcxcode/transition/${height}/1.m4s?k=2`,
    ],
  }))
  transitionAdapter.transform({ data: { dash: { video: transitionItems, audio: [] } } })
  const firstTransition = transitionItems[0]!,
    nextTransition = transitionItems[1]!
  const transitionNative = firstTransition.backup_url.find((url) => url.includes('.akamaized.net'))!
  const transitionApplied = transitionRoutes.apply(transitionNative)
  for (let index = 0; index < 2; index++)
    await transitionRoutes.observe({
      ...healthyObservation,
      generation: transitionState.generation,
      epoch: transitionState.epoch,
      decisionId: transitionApplied.decision.id,
      representation: transitionApplied.context!.representation,
      routeType: 'native-signed',
      originalHost: 'upos-hz-mirrorakam.akamaized.net',
      targetHost: 'upos-hz-mirrorakam.akamaized.net',
      finalHost: 'upos-hz-mirrorakam.akamaized.net',
      completedAt: now + index,
    })
  return extendFixture({}, {
    scope,
    now,
    clock,
    healthyObservation,
    transitionSession,
    transitionState,
    transitionSettings,
    transitionRestrictions,
    transitionRoutes,
    transitionAdapter,
    nextTransition,
    transitionApplied,
  } as const)
}

async function createCatalogOnlyFixtureRetainsBothOriginalURLsPrivatelyForAttribution2Context1(
  t: TestContext,
) {
  const base = await createNativeRoutingScenario(t)
  const catalogStorage = new FakeStorage(),
    catalogSettings = base.scope.own(new CatalogSettingsStore(catalogStorage, () => base.now))
  const catalogSession = new SessionStore(),
    catalogState = catalogSession.beginGeneration(false)
  const catalogVault = new SignedRouteVault()
  catalogVault.reset(catalogState.generation, catalogState.epoch)
  const catalogRestrictions = base.scope.own(new RestrictionStore(catalogStorage, () => base.now))
  const catalogEvidence = base.scope.own(new EvidenceStore(catalogStorage, () => base.now))
  const catalogRoutes = new RouteCoordinator(
    base.clock,
    catalogSession,
    catalogSettings,
    catalogRestrictions,
    catalogEvidence,
    catalogVault,
    createRuntimeIds(),
  )
  const catalogAdapter = new PlayurlAdapter(
    new PlayurlController(catalogSession, catalogVault, catalogRoutes),
  )
  const catalogVideoRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/catalog-only/video.m4s?signature=video-root'
  const catalogVideoBackup =
    'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/catalog-only/backup/video-alt.m4s?signature=video-backup&part=2'
  const catalogAudioRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/catalog-only/audio.m4s?signature=audio-root'
  const catalogVideo = {
    id: 80,
    codecid: 13,
    height: 1080,
    bandwidth: 2_000_000,
    base_url: catalogVideoRoot,
    backup_url: [catalogVideoBackup],
  }
  const catalogAudio = {
    id: 30280,
    bandwidth: 192_000,
    base_url: catalogAudioRoot,
    backup_url: [] as string[],
  }
  void catalogAdapter.transform({
    data: { dash: { video: [catalogVideo], audio: [catalogAudio] } },
  }).accepted
  const catalogVideoRep = catalogVault.contextForUrl(catalogVideoRoot)?.representation
  const catalogAudioRep = catalogVault.contextForUrl(catalogAudioRoot)?.representation
  return extendFixture(base, {
    catalogSettings,
    catalogSession,
    catalogEvidence,
    catalogRoutes,
    catalogAdapter,
    catalogVideoRoot,
    catalogVideoBackup,
    catalogAudioRoot,
    catalogVideo,
    catalogAudio,
    catalogVideoRep,
    catalogAudioRep,
  } as const)
}

async function createCatalogDemandContext2(t: TestContext) {
  const base =
    await createCatalogOnlyFixtureRetainsBothOriginalURLsPrivatelyForAttribution2Context1(t)
  const catalogDemand = { kind: 'video' as const, requiredMbps: 5, highDemand: false }
  return extendFixture(base, { catalogDemand } as const)
}

async function createOpaqueSignedBStationAudioIsRemovedFromCatalogOnlyPlayerContext3(
  t: TestContext,
) {
  const base = await createCatalogDemandContext2(t)
  if (base.catalogVideoRep && base.catalogAudioRep) {
    const options = base.catalogRoutes.startupOptions(base.catalogVideoRoot)
    void (options && options.candidates.length > 0)
    void options?.candidates.every(
      (candidate) => candidate.type === 'catalog-generated' && !candidate.original,
    )
    const catalogPlan = base.catalogRoutes.plan(base.catalogVideoRep, base.catalogDemand, 'startup')
    void catalogPlan.routeType
    void 'catalog-generated'
    void base.catalogRoutes.apply(base.catalogVideoRoot).decision.routeType
    void 'catalog-generated'
    void base.catalogRoutes.apply(base.catalogAudioRoot).decision.routeType
    void 'catalog-generated'
    void [
      base.catalogVideo.base_url,
      ...base.catalogVideo.backup_url,
      base.catalogAudio.base_url,
      ...base.catalogAudio.backup_url,
    ].every(
      (url) =>
        !!url && TRUSTED_CATALOG.includes(new URL(url).host as (typeof TRUSTED_CATALOG)[number]),
    )
    void ![base.catalogVideo.base_url, ...base.catalogVideo.backup_url].includes(
      base.catalogVideoBackup,
    )
    const signedBackupApplied = base.catalogRoutes.apply(base.catalogVideoBackup)
    void (signedBackupApplied.url && signedBackupApplied.decision.routeType === 'catalog-generated')
    if (signedBackupApplied.url) {
      const requested = new URL(base.catalogVideoBackup),
        sent = new URL(signedBackupApplied.url)
      void `${sent.pathname}${sent.search}`
      void `${requested.pathname}${requested.search}`
    }
    const deliveredCatalogBackup = base.catalogVideo.backup_url.find(
      (url) => new URL(url).host !== new URL(base.catalogVideo.base_url).host,
    )
    void deliveredCatalogBackup
    if (deliveredCatalogBackup) {
      const deliveredApplied = base.catalogRoutes.apply(deliveredCatalogBackup)
      void deliveredApplied.decision.routeType
      void 'catalog-generated'
      void deliveredApplied.url
      void deliveredCatalogBackup
    }
    const challenger = base.catalogRoutes.challenge(base.catalogVideoRep, base.catalogDemand, true)
    void challenger?.decision.routeType
    void 'catalog-generated'
    const failedCatalog = options?.candidates.find(
      (candidate) => candidate.type === 'catalog-generated',
    )
    if (failedCatalog) {
      base.catalogRoutes.noteStartupProbeResult(failedCatalog, 403)
      void !base.catalogRoutes
        .startupOptions(base.catalogVideoRoot)
        ?.candidates.some((candidate) => candidate.host === failedCatalog.host)
      void (
        base.catalogRoutes.plan(base.catalogVideoRep, base.catalogDemand, 'new-epoch').host !==
        failedCatalog.host
      )
    }
  }
  const opaqueCatalogUrl =
    'https://upos-hz-mirrorakam.akamaized.net/opaque/catalog-only-audio?signature=opaque'
  const opaqueCatalogItem = {
    id: 30281,
    bandwidth: 192_000,
    base_url: opaqueCatalogUrl,
    backup_url: [] as string[],
  }
  base.catalogAdapter.transform(
    { data: { dash: { video: [], audio: [opaqueCatalogItem] } } },
    'page-hint',
  )
  return extendFixture(base, { opaqueCatalogUrl, opaqueCatalogItem } as const)
}

async function createNoLegalCatalogCandidateStartsNoHealthyProbe5Context4(t: TestContext) {
  const base = await createOpaqueSignedBStationAudioIsRemovedFromCatalogOnlyPlayerContext3(t)
  void base.catalogRoutes.apply(base.opaqueCatalogUrl).decision.reason
  void base.catalogRoutes.inspectOriginal(base.catalogVideoRoot).decision.reason
  void base.catalogRoutes.apply(
    'https://upos-hz-mirrorakam.akamaized.net/live-bvc/catalog-only.m4s',
  ).decision.reason
  void base.catalogRoutes.apply('https://cdn.example.net/unrelated/media.bin').decision.action
  await base.catalogSettings.update({ fixedHost: TRUSTED_CATALOG[3] })
  base.catalogRoutes.invalidateForUserSetting()
  void base.catalogRoutes.apply(base.catalogVideoRoot).decision.host
  await base.catalogSettings.update({
    fixedHost: null,
    catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map((host) => [host, false])),
  })
  base.catalogRoutes.invalidateForUserSetting()
  void base.catalogRoutes.apply(base.catalogVideoRoot).decision.reason
  return extendFixture(base, {} as const)
}

async function createNoLegalCatalogCandidateEmitsNoPlayerPrimary6Context5(t: TestContext) {
  const base = await createNoLegalCatalogCandidateStartsNoHealthyProbe5Context4(t)
  if (base.catalogVideoRep) {
    void base.catalogRoutes.challenge(base.catalogVideoRep, base.catalogDemand, true)
    void null
  }
  const noCatalogOutput = {
    id: 80,
    codecid: 13,
    height: 1080,
    bandwidth: 2_000_000,
    base_url: base.catalogVideoRoot,
    backup_url: [base.catalogVideoBackup],
  }
  base.catalogAdapter.transform({ data: { dash: { video: [noCatalogOutput], audio: [] } } })
  return extendFixture(base, { noCatalogOutput } as const)
}

async function createEnablingNativeSourcesPreservesColdStartOriginalRoute7Context6(t: TestContext) {
  const base = await createNoLegalCatalogCandidateEmitsNoPlayerPrimary6Context5(t)
  base.catalogRoutes.setOriginalComparison(true)
  void base.catalogRoutes.apply(base.catalogVideoRoot).url
  base.catalogRoutes.setOriginalComparison(false)
  await base.catalogSettings.update({ considerNativeSources: true, catalogOverrides: {} })
  base.catalogRoutes.invalidateForUserSetting()
  return extendFixture(base, {} as const)
}

async function createCatalogDecisionMayYieldTheExactSameURLAsTheOriginalContext7(t: TestContext) {
  const base = await createEnablingNativeSourcesPreservesColdStartOriginalRoute7Context6(t)
  const overlapStorage = new FakeStorage(),
    overlapSession = new SessionStore()
  const overlapState = overlapSession.beginGeneration(false),
    overlapVault = new SignedRouteVault()
  overlapVault.reset(overlapState.generation, overlapState.epoch)
  const overlapRoot = `https://${TRUSTED_CATALOG[0]}/upgcxcode/catalog-overlap/video.m4s?signature=same-url`
  const overlapRep = overlapVault.register({
    generation: overlapState.generation,
    epoch: overlapState.epoch,
    kind: 'video',
    key: 'overlap',
    height: 1080,
    codec: 'av1',
    bandwidth: 1_000_000,
    urls: [overlapRoot],
    source: 'trusted-api',
  })
  const overlapRoutes = new RouteCoordinator(
    base.clock,
    overlapSession,
    base.scope.own(new CatalogSettingsStore(overlapStorage, () => base.now)),
    base.scope.own(new RestrictionStore(overlapStorage, () => base.now)),
    base.scope.own(new EvidenceStore(overlapStorage, () => base.now)),
    overlapVault,
    createRuntimeIds(),
  )
  return extendFixture(base, { overlapState, overlapRoot, overlapRep, overlapRoutes } as const)
}

async function createKnownBackup403FixtureHasACurrentEpochRepresentation9Context8(t: TestContext) {
  const base = await createCatalogDecisionMayYieldTheExactSameURLAsTheOriginalContext7(t)
  const backup403Storage = new FakeStorage(),
    backup403Session = new SessionStore()
  const backup403State = backup403Session.beginGeneration(false),
    backup403Vault = new SignedRouteVault()
  backup403Vault.reset(backup403State.generation, backup403State.epoch)
  const backup403Root =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/backup-403/root.m4s?signature=root'
  const backup403Url =
    'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/backup-403/other.m4s?signature=backup'
  const backup403Rep = backup403Vault.register({
    generation: backup403State.generation,
    epoch: backup403State.epoch,
    kind: 'video',
    key: 'backup-403',
    height: 1080,
    codec: 'av1',
    bandwidth: 1_000_000,
    urls: [backup403Root, backup403Url],
    source: 'trusted-api',
  })
  return extendFixture(base, {
    backup403Storage,
    backup403Session,
    backup403State,
    backup403Vault,
    backup403Url,
    backup403Rep,
  } as const)
}

async function createBackup403RoutesContext9(t: TestContext) {
  const base = await createKnownBackup403FixtureHasACurrentEpochRepresentation9Context8(t)
  const redirectedStorage = new FakeStorage(),
    redirectedSession = new SessionStore()
  const redirectedState = redirectedSession.beginGeneration(false),
    redirectedVault = new SignedRouteVault()
  redirectedVault.reset(redirectedState.generation, redirectedState.epoch)
  const redirectedRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/redirected/video.m4s?signature=source'
  const redirectedRep = redirectedVault.register({
    generation: redirectedState.generation,
    epoch: redirectedState.epoch,
    kind: 'video',
    key: 'redirected',
    height: 1080,
    codec: 'av1',
    bandwidth: 1_000_000,
    urls: [redirectedRoot],
    source: 'trusted-api',
  })
  const redirectedEvidence = base.scope.own(new EvidenceStore(redirectedStorage, () => base.now))
  const redirectedRoutes = new RouteCoordinator(
    base.clock,
    redirectedSession,
    base.scope.own(new CatalogSettingsStore(redirectedStorage, () => base.now)),
    base.scope.own(new RestrictionStore(redirectedStorage, () => base.now)),
    redirectedEvidence,
    redirectedVault,
    createRuntimeIds(),
  )
  const redirectedFirst = redirectedRoutes.apply(redirectedRoot)
  const redirectedRequest = {
    requestId: requestId('catalog-xhr-redirect'),
    generation: redirectedState.generation,
    epoch: redirectedState.epoch,
    decisionId: redirectedFirst.decision.id,
    representation: redirectedRep,
    routePolicyRevision: redirectedRoutes.policyRevision(),
    authorityRevision: redirectedRep
      ? (redirectedVault.identity(redirectedRep)?.authorityRevision ?? null)
      : null,
    kind: 'video' as const,
    attributionStatus: 'matched' as const,
    attributionSource: 'exact' as const,
    decisionStage: 'request' as const,
    routeType: 'catalog-generated' as const,
    originalHost: new URL(redirectedRoot).host,
    targetHost: redirectedFirst.decision.host ?? '',
    sourceHost: new URL(redirectedRoot).host,
    playurlHostChanged: false,
    playurlOutput: null,
    urlChanged: true,
    hostChanged: true,
    startedAt: base.now,
  }
  redirectedRoutes.requestStarted(redirectedRequest)
  await redirectedRoutes.observe({
    request: redirectedRequest,
    generation: redirectedState.generation,
    epoch: redirectedState.epoch,
    decisionId: redirectedFirst.decision.id,
    representation: redirectedRep,
    kind: 'video',
    routeType: 'catalog-generated',
    originalHost: new URL(redirectedRoot).host,
    targetHost: redirectedFirst.decision.host ?? '',
    finalHost: new URL(redirectedRoot).host,
    responseUrlMatchesRequest: false,
    streamKey: redirectedFirst.streamKey,
    status: 206,
    bytes: 70 * 1024,
    ttfbMs: 20,
    elapsedMs: 100,
    completedAt: base.now + 1,
    outcome: 'success',
  })
  void redirectedEvidence.get(new URL(redirectedRoot).host, 'video')
  void redirectedSession.get().affinity
  const redirectedNext = redirectedRoutes.apply(redirectedRoot)
  return extendFixture(base, { redirectedFirst, redirectedNext } as const)
}

async function createCatalogOnlyNestedAudioFixtureAcceptsValidDASHVideo11Context10(t: TestContext) {
  const base = await createBackup403RoutesContext9(t)
  const nestedStorage = new FakeStorage(),
    nestedSettings = base.scope.own(new CatalogSettingsStore(nestedStorage, () => base.now))
  await nestedSettings.update({ considerNativeSources: true })
  const nestedSession = new SessionStore(),
    nestedState = nestedSession.beginGeneration(false)
  const nestedVault = new SignedRouteVault()
  nestedVault.reset(nestedState.generation, nestedState.epoch)
  const nestedRoutes = new RouteCoordinator(
    base.clock,
    nestedSession,
    nestedSettings,
    base.scope.own(new RestrictionStore(nestedStorage, () => base.now)),
    base.scope.own(new EvidenceStore(nestedStorage, () => base.now)),
    nestedVault,
    createRuntimeIds(),
  )
  const nestedAdapter = new PlayurlAdapter(
    new PlayurlController(nestedSession, nestedVault, nestedRoutes),
  )
  const nestedVideoRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/nested/video.m4s?signature=video'
  const dolbyRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/nested/dolby.m4s?signature=dolby'
  const dolbyBackup =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/nested/dolby-backup.m4s?signature=dolby-backup'
  const flacRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/nested/flac.m4s?signature=flac'
  const flacBackup =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/nested/flac-backup.m4s?signature=flac-backup'
  const nestedPayload = () => ({
    data: {
      dash: {
        video: [
          {
            id: 80,
            codecid: 13,
            height: 1080,
            bandwidth: 1_000_000,
            base_url: nestedVideoRoot,
            backup_url: [] as string[],
          },
        ],
        audio: [] as unknown[],
        dolby: {
          audio: [
            {
              id: 30280,
              bandwidth: 448_000,
              base_url: dolbyRoot,
              backup_url: [dolbyBackup],
            },
          ],
        },
        flac: {
          audio: {
            id: 30251,
            bandwidth: 1_000_000,
            base_url: flacRoot,
            backup_url: [flacBackup],
          },
        },
      },
    },
  })
  const nativeOnNested = nestedPayload()
  void nestedAdapter.transform(nativeOnNested, 'trusted-api').accepted
  await nestedSettings.update({ considerNativeSources: false })
  nestedRoutes.invalidateForUserSetting()
  const strictNested = nestedPayload()
  return extendFixture(base, { nestedAdapter, strictNested } as const)
}

async function checkCatalogOnlyNestedAudioFixtureAcceptsValidDASHVideo11(
  t: TestContext,
): Promise<void> {
  const base = await createCatalogOnlyNestedAudioFixtureAcceptsValidDASHVideo11Context10(t)

  assert.ok(
    base.nestedAdapter.transform(base.strictNested, 'trusted-api').accepted,
    'Catalog-only nested audio fixture accepts valid DASH video',
  )
  const nestedAudioUrls = [
    base.strictNested.data.dash.dolby.audio[0]?.base_url ?? '',
    ...base.strictNested.data.dash.dolby.audio[0]!.backup_url,
    base.strictNested.data.dash.flac.audio.base_url,
    ...base.strictNested.data.dash.flac.audio.backup_url,
  ]
  assert.ok(
    nestedAudioUrls.every(
      (url) =>
        url === '' ||
        TRUSTED_CATALOG.includes(new URL(url).host as (typeof TRUSTED_CATALOG)[number]),
    ),
    'Catalog-only playurl rewrites or clears every nested Dolby and FLAC audio primary and backup URL',
  )
}

async function checkCatalogFailureFixtureRegistersParameter12ParameterParameter(
  t: TestContext,
  parameter = 0,
): Promise<void> {
  const base = await createCatalogOnlyNestedAudioFixtureAcceptsValidDASHVideo11Context10(t)

  void base.nestedAdapter.transform(base.strictNested, 'trusted-api').accepted
  const nestedAudioUrls = [
    base.strictNested.data.dash.dolby.audio[0]?.base_url ?? '',
    ...base.strictNested.data.dash.dolby.audio[0]!.backup_url,
    base.strictNested.data.dash.flac.audio.base_url,
    ...base.strictNested.data.dash.flac.audio.backup_url,
  ]
  void nestedAudioUrls.every(
    (url) =>
      url === '' || TRUSTED_CATALOG.includes(new URL(url).host as (typeof TRUSTED_CATALOG)[number]),
  )
  const failureStorage = new FakeStorage(),
    failureSession = new SessionStore()
  const failureState = failureSession.beginGeneration(false),
    failureVault = new SignedRouteVault()
  failureVault.reset(failureState.generation, failureState.epoch)
  const failureEvidence = base.scope.own(new EvidenceStore(failureStorage, () => base.now))
  const failureRoutes = new RouteCoordinator(
    base.clock,
    failureSession,
    base.scope.own(new CatalogSettingsStore(failureStorage, () => base.now)),
    base.scope.own(new RestrictionStore(failureStorage, () => base.now)),
    failureEvidence,
    failureVault,
    createRuntimeIds(),
  )
  const failureRoots = {
    video:
      'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/catalog-failure/video.m4s?signature=video',
    audio:
      'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/catalog-failure/audio.m4s?signature=audio',
  }

  let iteration = 0
  for (const kind of ['video', 'audio'] as const) {
    if (iteration++ === parameter) {
      const root = failureRoots[kind]
      const rep = failureVault.register({
        generation: failureState.generation,
        epoch: failureState.epoch,
        kind,
        key: `failure:${kind}`,
        height: kind === 'video' ? 1080 : 0,
        codec: kind === 'video' ? 'av1' : 'other',
        bandwidth: kind === 'video' ? 2_000_000 : 192_000,
        urls: [root],
        source: 'trusted-api',
      })
      assert.ok(rep, `Catalog failure fixture registers ${kind}`)
      const applied = failureRoutes.apply(root)
      assert.strictEqual(
        applied.decision.routeType,
        'catalog-generated',
        `${kind} failure fixture targets Catalog`,
      )
      const targetHost = applied.decision.host ?? ''
      const observed: TransportObservation = {
        generation: failureState.generation,
        epoch: failureState.epoch,
        decisionId: applied.decision.id,
        representation: rep,
        kind,
        routeType: 'catalog-generated',
        originalHost: new URL(root).host,
        targetHost,
        finalHost: null,
        responseUrlMatchesRequest: false,
        streamKey: applied.streamKey,
        status: 0,
        bytes: 0,
        ttfbMs: null,
        elapsedMs: 100,
        completedAt: base.now + (kind === 'video' ? 1 : 2),
        outcome: 'failure',
        failureKind: 'network',
      }
      const { failureKind: _failureKind, ...redirected } = observed
      await failureRoutes.observe({
        ...redirected,
        finalHost: new URL(root).host,
        status: 206,
        bytes: 70 * 1024,
        outcome: 'success',
      })
      assert.strictEqual(
        failureEvidence.get(new URL(root).host, kind),
        null,
        `${kind} response redirected to Native host cannot gain success evidence`,
      )
      assert.strictEqual(
        failureSession.get().affinity,
        null,
        'detached response cannot establish playback affinity',
      )
      await failureRoutes.observe(observed)
      assert.ok(
        failureEvidence
          .get(targetHost, kind)
          ?.samples.some((sample) => sample.outcome === 'failure'),
        `${kind} Catalog network failure without response host still records transport failure`,
      )
      assert.ok(
        failureRoutes.snapshot().fallback[kind],
        `${kind} Catalog network failure without response host still plans recovery`,
      )

      return
    }
  }
  throw Error('Unknown fixture parameter')
}

async function checkXHRRedirectAwayFromCatalogInvalidatesThatCatalogHostForThe(
  t: TestContext,
): Promise<void> {
  const base = await createBackup403RoutesContext9(t)

  assert.ok(
    base.redirectedNext.decision.routeType === 'catalog-generated' &&
      base.redirectedNext.decision.host !== base.redirectedFirst.decision.host,
    'XHR redirect away from Catalog invalidates that Catalog host for the same stream',
  )
  const aliasStorage = new FakeStorage(),
    aliasSession = new SessionStore()
  const aliasState = aliasSession.beginGeneration(false),
    aliasVault = new SignedRouteVault()
  aliasVault.reset(aliasState.generation, aliasState.epoch)
  const aliasSettings = base.scope.own(new CatalogSettingsStore(aliasStorage, () => base.now))
  const aliasRoutes = new RouteCoordinator(
    base.clock,
    aliasSession,
    aliasSettings,
    base.scope.own(new RestrictionStore(aliasStorage, () => base.now)),
    base.scope.own(new EvidenceStore(aliasStorage, () => base.now)),
    aliasVault,
    createRuntimeIds(),
  )
  const aliasAdapter = new PlayurlAdapter(
    new PlayurlController(aliasSession, aliasVault, aliasRoutes),
  )
  const aliasRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/aliases/primary.m4s?signature=primary'
  const aliasBackup =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/aliases/backup.m4s?signature=backup'
  const aliasItem = {
    id: 90,
    codecid: 13,
    height: 1080,
    bandwidth: 1_000_000,
    baseUrl: aliasRoot,
    base_url: aliasRoot,
    backupUrl: [aliasBackup],
    backup_url: [aliasBackup],
  }
  assert.ok(
    aliasAdapter.transform({
      data: { dash: { video: [aliasItem], audio: [] } },
    }).accepted,
    'playurl with both field spellings is transformed',
  )
  assert.strictEqual(
    aliasItem.baseUrl,
    aliasItem.base_url,
    'Catalog-only playurl rewrites both primary field spellings to the same URL',
  )
  assert.strictEqual(
    JSON.stringify(aliasItem.backupUrl),
    JSON.stringify(aliasItem.backup_url),
    'Catalog-only playurl rewrites both backup field spellings to the same URLs',
  )
  assert.ok(
    [aliasItem.baseUrl, aliasItem.base_url, ...aliasItem.backupUrl, ...aliasItem.backup_url].every(
      (url) =>
        !!url && TRUSTED_CATALOG.includes(new URL(url).host as (typeof TRUSTED_CATALOG)[number]),
    ),
    'no Native signed URL remains in either playurl field spelling',
  )
  const nestedStorage = new FakeStorage(),
    nestedSettings = base.scope.own(new CatalogSettingsStore(nestedStorage, () => base.now))
  await nestedSettings.update({ considerNativeSources: true })
  const nestedSession = new SessionStore(),
    nestedState = nestedSession.beginGeneration(false)
  const nestedVault = new SignedRouteVault()
  nestedVault.reset(nestedState.generation, nestedState.epoch)
  const nestedRoutes = new RouteCoordinator(
    base.clock,
    nestedSession,
    nestedSettings,
    base.scope.own(new RestrictionStore(nestedStorage, () => base.now)),
    base.scope.own(new EvidenceStore(nestedStorage, () => base.now)),
    nestedVault,
    createRuntimeIds(),
  )
  const nestedAdapter = new PlayurlAdapter(
    new PlayurlController(nestedSession, nestedVault, nestedRoutes),
  )
  const nestedVideoRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/nested/video.m4s?signature=video'
  const dolbyRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/nested/dolby.m4s?signature=dolby'
  const dolbyBackup =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/nested/dolby-backup.m4s?signature=dolby-backup'
  const flacRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/nested/flac.m4s?signature=flac'
  const flacBackup =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/nested/flac-backup.m4s?signature=flac-backup'
  const nestedPayload = () => ({
    data: {
      dash: {
        video: [
          {
            id: 80,
            codecid: 13,
            height: 1080,
            bandwidth: 1_000_000,
            base_url: nestedVideoRoot,
            backup_url: [] as string[],
          },
        ],
        audio: [] as unknown[],
        dolby: {
          audio: [
            {
              id: 30280,
              bandwidth: 448_000,
              base_url: dolbyRoot,
              backup_url: [dolbyBackup],
            },
          ],
        },
        flac: {
          audio: {
            id: 30251,
            bandwidth: 1_000_000,
            base_url: flacRoot,
            backup_url: [flacBackup],
          },
        },
      },
    },
  })
  const nativeOnNested = nestedPayload()
  assert.ok(
    nestedAdapter.transform(nativeOnNested, 'trusted-api').accepted,
    'Native-on nested audio fixture accepts valid DASH video',
  )
  assert.strictEqual(
    nativeOnNested.data.dash.dolby.audio[0]?.base_url,
    dolbyRoot,
    'Native-on preserves legacy Dolby audio URL',
  )
  assert.strictEqual(
    nativeOnNested.data.dash.flac.audio.base_url,
    flacRoot,
    'Native-on preserves legacy FLAC audio URL',
  )
}

async function checkKnownBackup403FixtureHasACurrentEpochRepresentation9(
  t: TestContext,
): Promise<void> {
  const base = await createKnownBackup403FixtureHasACurrentEpochRepresentation9Context8(t)

  assert.ok(base.backup403Rep, 'known backup 403 fixture has a current-epoch representation')
  const backup403Routes = new RouteCoordinator(
    base.clock,
    base.backup403Session,
    base.scope.own(new CatalogSettingsStore(base.backup403Storage, () => base.now)),
    base.scope.own(new RestrictionStore(base.backup403Storage, () => base.now)),
    base.scope.own(new EvidenceStore(base.backup403Storage, () => base.now)),
    base.backup403Vault,
    createRuntimeIds(),
  )
  const backup403First = backup403Routes.apply(base.backup403Url)
  assert.strictEqual(
    backup403First.decision.routeType,
    'catalog-generated',
    'known signed backup initially selects Catalog',
  )
  await backup403Routes.observe({
    generation: base.backup403State.generation,
    epoch: base.backup403State.epoch,
    decisionId: backup403First.decision.id,
    representation: base.backup403Rep,
    kind: 'video',
    routeType: 'catalog-generated',
    originalHost: new URL(base.backup403Url).host,
    targetHost: backup403First.decision.host ?? '',
    finalHost: backup403First.decision.host,
    responseUrlMatchesRequest: true,
    streamKey: backup403First.streamKey,
    status: 403,
    bytes: 0,
    ttfbMs: 20,
    elapsedMs: 100,
    completedAt: base.now + 2,
    outcome: 'failure',
  })
  const backup403Next = backup403Routes.apply(base.backup403Url)
  assert.ok(
    backup403Next.decision.routeType === 'catalog-generated' &&
      backup403Next.decision.host !== backup403First.decision.host,
    'known backup request avoids a Catalog host after its own stream gets 403',
  )
  const unmatched403Storage = new FakeStorage(),
    unmatched403Session = new SessionStore()
  unmatched403Session.beginGeneration(false)
  const unmatched403Vault = new SignedRouteVault()
  unmatched403Vault.reset(unmatched403Session.get().generation, unmatched403Session.get().epoch)
  const unmatched403Routes = new RouteCoordinator(
    base.clock,
    unmatched403Session,
    base.scope.own(new CatalogSettingsStore(unmatched403Storage, () => base.now)),
    base.scope.own(new RestrictionStore(unmatched403Storage, () => base.now)),
    base.scope.own(new EvidenceStore(unmatched403Storage, () => base.now)),
    unmatched403Vault,
    createRuntimeIds(),
  )
  const unmatched403Url =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/unmatched-403/video.m4s?signature=unmatched'
  const unmatched403First = unmatched403Routes.apply(unmatched403Url)
  assert.strictEqual(
    unmatched403First.decision.routeType,
    'catalog-generated',
    'unattributed B station stream initially selects Catalog',
  )
  await unmatched403Routes.observe({
    generation: unmatched403Session.get().generation,
    epoch: unmatched403Session.get().epoch,
    decisionId: unmatched403First.decision.id,
    representation: null,
    kind: 'video',
    routeType: 'catalog-generated',
    originalHost: new URL(unmatched403Url).host,
    targetHost: unmatched403First.decision.host ?? '',
    finalHost: unmatched403First.decision.host,
    responseUrlMatchesRequest: true,
    streamKey: unmatched403First.streamKey,
    status: 403,
    bytes: 0,
    ttfbMs: 20,
    elapsedMs: 100,
    completedAt: base.now + 3,
    outcome: 'failure',
  })
  const unmatched403Next = unmatched403Routes.apply(unmatched403Url)
  assert.ok(
    unmatched403Next.decision.routeType === 'catalog-generated' &&
      unmatched403Next.decision.host !== unmatched403First.decision.host,
    'unattributed B station stream avoids a Catalog host after its own 403',
  )
  const redirectedStorage = new FakeStorage(),
    redirectedSession = new SessionStore()
  const redirectedState = redirectedSession.beginGeneration(false),
    redirectedVault = new SignedRouteVault()
  redirectedVault.reset(redirectedState.generation, redirectedState.epoch)
  const redirectedRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/redirected/video.m4s?signature=source'
  const redirectedRep = redirectedVault.register({
    generation: redirectedState.generation,
    epoch: redirectedState.epoch,
    kind: 'video',
    key: 'redirected',
    height: 1080,
    codec: 'av1',
    bandwidth: 1_000_000,
    urls: [redirectedRoot],
    source: 'trusted-api',
  })
  assert.ok(redirectedRep, 'redirected XHR fixture has trusted representation')
  const redirectedEvidence = base.scope.own(new EvidenceStore(redirectedStorage, () => base.now))
  const redirectedRoutes = new RouteCoordinator(
    base.clock,
    redirectedSession,
    base.scope.own(new CatalogSettingsStore(redirectedStorage, () => base.now)),
    base.scope.own(new RestrictionStore(redirectedStorage, () => base.now)),
    redirectedEvidence,
    redirectedVault,
    createRuntimeIds(),
  )
  const redirectedFirst = redirectedRoutes.apply(redirectedRoot)
  assert.strictEqual(
    redirectedFirst.decision.routeType,
    'catalog-generated',
    'XHR redirect fixture initially selects Catalog',
  )
  const redirectedRequest = {
    requestId: requestId('catalog-xhr-redirect'),
    generation: redirectedState.generation,
    epoch: redirectedState.epoch,
    decisionId: redirectedFirst.decision.id,
    representation: redirectedRep,
    routePolicyRevision: redirectedRoutes.policyRevision(),
    authorityRevision: redirectedRep
      ? (redirectedVault.identity(redirectedRep)?.authorityRevision ?? null)
      : null,
    kind: 'video' as const,
    attributionStatus: 'matched' as const,
    attributionSource: 'exact' as const,
    decisionStage: 'request' as const,
    routeType: 'catalog-generated' as const,
    originalHost: new URL(redirectedRoot).host,
    targetHost: redirectedFirst.decision.host ?? '',
    sourceHost: new URL(redirectedRoot).host,
    playurlHostChanged: false,
    playurlOutput: null,
    urlChanged: true,
    hostChanged: true,
    startedAt: base.now,
  }
  redirectedRoutes.requestStarted(redirectedRequest)
  await redirectedRoutes.observe({
    request: redirectedRequest,
    generation: redirectedState.generation,
    epoch: redirectedState.epoch,
    decisionId: redirectedFirst.decision.id,
    representation: redirectedRep,
    kind: 'video',
    routeType: 'catalog-generated',
    originalHost: new URL(redirectedRoot).host,
    targetHost: redirectedFirst.decision.host ?? '',
    finalHost: new URL(redirectedRoot).host,
    responseUrlMatchesRequest: false,
    streamKey: redirectedFirst.streamKey,
    status: 206,
    bytes: 70 * 1024,
    ttfbMs: 20,
    elapsedMs: 100,
    completedAt: base.now + 1,
    outcome: 'success',
  })
  assert.strictEqual(
    redirectedEvidence.get(new URL(redirectedRoot).host, 'video'),
    null,
    'XHR redirected to Native host stays detached from successful health evidence',
  )
  assert.strictEqual(
    redirectedSession.get().affinity,
    null,
    'XHR redirected to Native host cannot confirm playback affinity',
  )
}

async function checkCatalogDecisionMayYieldTheExactSameURLAsTheOriginal(
  t: TestContext,
): Promise<void> {
  const base = await createCatalogDecisionMayYieldTheExactSameURLAsTheOriginalContext7(t)

  if (base.overlapRep) {
    const sameUrlCatalog = base.overlapRoutes.apply(base.overlapRoot)
    assert.strictEqual(
      sameUrlCatalog.url,
      base.overlapRoot,
      'Catalog decision may yield the exact same URL as the original',
    )
    assert.strictEqual(
      sameUrlCatalog.decision.routeType,
      'catalog-generated',
      'same-host overlap is authorized by Catalog provenance, not Native provenance',
    )
    await base.overlapRoutes.observe({
      generation: base.overlapState.generation,
      epoch: base.overlapState.epoch,
      decisionId: sameUrlCatalog.decision.id,
      representation: base.overlapRep,
      kind: 'video',
      routeType: 'catalog-generated',
      originalHost: new URL(base.overlapRoot).host,
      targetHost: sameUrlCatalog.decision.host ?? '',
      finalHost: sameUrlCatalog.decision.host,
      responseUrlMatchesRequest: true,
      streamKey: sameUrlCatalog.streamKey,
      status: 403,
      bytes: 0,
      ttfbMs: 20,
      elapsedMs: 100,
      completedAt: base.now + 1,
      outcome: 'failure',
    })
    const afterOverlap403 = base.overlapRoutes.apply(base.overlapRoot)
    assert.ok(
      afterOverlap403.decision.routeType === 'catalog-generated' &&
        afterOverlap403.decision.host !== sameUrlCatalog.decision.host,
      'Catalog 403 invalidates stream-host pairing even when original host equals Catalog target',
    )
  }
}

async function checkEnablingNativeSourcesPreservesColdStartOriginalRoute7(
  t: TestContext,
): Promise<void> {
  const base = await createEnablingNativeSourcesPreservesColdStartOriginalRoute7Context6(t)

  if (base.catalogVideoRep) {
    const legacyPlan = base.catalogRoutes.plan(base.catalogVideoRep, base.catalogDemand, 'startup')
    assert.strictEqual(
      legacyPlan.routeType,
      'root-original',
      'enabling Native sources preserves cold-start original route',
    )
    const nativeStartup = base.catalogRoutes
      .startupOptions(base.catalogVideoRoot)
      ?.candidates.find((candidate) => candidate.original)
    assert.ok(nativeStartup, 'enabled Native mode includes the original in preflight')
    const enabledOutput = base.catalogRoutes.playerOutput(
      base.catalogVideoRep,
      base.catalogVideoRoot,
      legacyPlan,
      [base.catalogVideoRoot, base.catalogVideoBackup],
    )
    assert.strictEqual(
      enabledOutput.primary,
      base.catalogVideoRoot,
      'enabled Native mode may offer the exact original primary',
    )
    assert.ok(
      enabledOutput.backups.includes(base.catalogVideoBackup),
      'enabled Native mode may offer an exact Native backup',
    )
    await base.catalogSettings.update({ considerNativeSources: false })
    base.catalogRoutes.invalidateForUserSetting()
    assert.strictEqual(
      base.catalogRoutes.commitStartupChoice(
        base.catalogVideoRoot,
        nativeStartup ?? null,
        'late-preflight',
      ),
      null,
      'late Native startup result cannot commit after switch to Catalog-only',
    )
    if (nativeStartup) {
      await base.catalogRoutes.recordStartupSuccess(nativeStartup, 70 * 1024, 100, 10)
      assert.strictEqual(
        base.catalogEvidence.get(nativeStartup.host, 'video'),
        null,
        'late Native preflight cannot add new health evidence after switch',
      )
    }
    assert.strictEqual(
      base.catalogRoutes.apply(base.catalogVideoBackup).decision.routeType,
      'catalog-generated',
      'old player Native backup is rechecked as a Catalog decision after switch',
    )
    assert.strictEqual(
      base.catalogSession.get().affinity,
      null,
      'Native permission switch invalidates route affinity',
    )
  }
}

async function checkNoLegalCatalogCandidateEmitsNoPlayerPrimary6(t: TestContext): Promise<void> {
  const base = await createNoLegalCatalogCandidateEmitsNoPlayerPrimary6Context5(t)

  assert.strictEqual(
    base.noCatalogOutput.base_url,
    '',
    'no legal Catalog candidate emits no player primary',
  )
  assert.strictEqual(
    base.noCatalogOutput.backup_url.length,
    0,
    'no legal Catalog candidate emits no player backups',
  )
  base.catalogRoutes.setOriginalComparison(true)
  assert.strictEqual(
    base.catalogRoutes.apply(base.catalogVideoRoot).url,
    base.catalogVideoRoot,
    'per-tab original comparison overrides saved Catalog-only mode',
  )
}

async function checkNoLegalCatalogCandidateStartsNoHealthyProbe5(t: TestContext): Promise<void> {
  const base = await createNoLegalCatalogCandidateStartsNoHealthyProbe5Context4(t)

  if (base.catalogVideoRep)
    assert.strictEqual(
      base.catalogRoutes.challenge(base.catalogVideoRep, base.catalogDemand, true),
      null,
      'no legal Catalog candidate starts no healthy probe',
    )
}

async function checkOpaqueSignedBStationAudioIsRemovedFromCatalogOnlyPlayer(
  t: TestContext,
): Promise<void> {
  const base = await createOpaqueSignedBStationAudioIsRemovedFromCatalogOnlyPlayerContext3(t)

  assert.strictEqual(
    base.opaqueCatalogItem.base_url,
    '',
    'opaque signed B station audio is removed from Catalog-only player output',
  )
  assert.strictEqual(
    base.catalogRoutes.apply(base.opaqueCatalogUrl).decision.reason,
    'catalog-unreplaceable',
    'opaque signed B station audio blocks rather than passing its Native URL',
  )
  assert.strictEqual(
    base.catalogRoutes.inspectOriginal(base.catalogVideoRoot).decision.reason,
    'catalog-only-non-get',
    'recognized non-GET B station media cannot pass its Native URL',
  )
  assert.strictEqual(
    base.catalogRoutes.apply('https://upos-hz-mirrorakam.akamaized.net/live-bvc/catalog-only.m4s')
      .decision.reason,
    'catalog-unreplaceable',
    'non-replaceable B station media cannot pass its Native URL',
  )
  assert.strictEqual(
    base.catalogRoutes.apply('https://cdn.example.net/unrelated/media.bin').decision.action,
    'pass',
    'unattributed third-party media keeps its original route',
  )
  await base.catalogSettings.update({ fixedHost: TRUSTED_CATALOG[3] })
  base.catalogRoutes.invalidateForUserSetting()
  assert.strictEqual(
    base.catalogRoutes.apply(base.catalogVideoRoot).decision.host,
    TRUSTED_CATALOG[3],
    'Catalog-only fixed host selects the requested legal Catalog node',
  )
  await base.catalogSettings.update({
    fixedHost: null,
    catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map((host) => [host, false])),
  })
  base.catalogRoutes.invalidateForUserSetting()
  assert.strictEqual(
    base.catalogRoutes.apply(base.catalogVideoRoot).decision.reason,
    'catalog-unavailable',
    'no legal Catalog candidate blocks the original media request',
  )
}

async function checkCatalogOnlyStartupHasLegalCandidates3(t: TestContext): Promise<void> {
  const base = await createCatalogDemandContext2(t)

  if (base.catalogVideoRep && base.catalogAudioRep) {
    const options = base.catalogRoutes.startupOptions(base.catalogVideoRoot)
    assert.ok(options && options.candidates.length > 0, 'Catalog-only startup has legal candidates')
    assert.ok(
      options?.candidates.every(
        (candidate) => candidate.type === 'catalog-generated' && !candidate.original,
      ),
      'Catalog-only startup never probes original or Native backup',
    )
    const catalogPlan = base.catalogRoutes.plan(base.catalogVideoRep, base.catalogDemand, 'startup')
    assert.strictEqual(
      catalogPlan.routeType,
      'catalog-generated',
      'Catalog-only startup plan never chooses Native',
    )
    assert.strictEqual(
      base.catalogRoutes.apply(base.catalogVideoRoot).decision.routeType,
      'catalog-generated',
      'Catalog-only video request uses a Catalog decision',
    )
    assert.strictEqual(
      base.catalogRoutes.apply(base.catalogAudioRoot).decision.routeType,
      'catalog-generated',
      'Catalog-only audio request uses a Catalog decision',
    )
    assert.ok(
      [
        base.catalogVideo.base_url,
        ...base.catalogVideo.backup_url,
        base.catalogAudio.base_url,
        ...base.catalogAudio.backup_url,
      ].every(
        (url) =>
          !!url && TRUSTED_CATALOG.includes(new URL(url).host as (typeof TRUSTED_CATALOG)[number]),
      ),
      'Catalog-only player primary and backup URLs all use built-in Catalog hosts',
    )
    assert.ok(
      ![base.catalogVideo.base_url, ...base.catalogVideo.backup_url].includes(
        base.catalogVideoBackup,
      ),
      'Catalog-only player output does not reuse the exact signed Native backup',
    )
    const signedBackupApplied = base.catalogRoutes.apply(base.catalogVideoBackup)
    assert.ok(
      signedBackupApplied.url && signedBackupApplied.decision.routeType === 'catalog-generated',
      'current-epoch signed backup is reselected through a Catalog decision',
    )
    if (signedBackupApplied.url) {
      const requested = new URL(base.catalogVideoBackup),
        sent = new URL(signedBackupApplied.url)
      assert.strictEqual(
        `${sent.pathname}${sent.search}`,
        `${requested.pathname}${requested.search}`,
        'Catalog rewrite of signed backup preserves the requested backup path and query',
      )
    }
    const deliveredCatalogBackup = base.catalogVideo.backup_url.find(
      (url) => new URL(url).host !== new URL(base.catalogVideo.base_url).host,
    )
    assert.ok(deliveredCatalogBackup, 'Catalog-only playurl delivers a distinct Catalog backup')
    if (deliveredCatalogBackup) {
      const deliveredApplied = base.catalogRoutes.apply(deliveredCatalogBackup)
      assert.strictEqual(
        deliveredApplied.decision.routeType,
        'catalog-generated',
        'delivered Catalog backup retains Catalog provenance',
      )
      assert.strictEqual(
        deliveredApplied.url,
        deliveredCatalogBackup,
        'delivered Catalog backup stays on the URL the player requested',
      )
    }
    const challenger = base.catalogRoutes.challenge(base.catalogVideoRep, base.catalogDemand, true)
    assert.strictEqual(
      challenger?.decision.routeType,
      'catalog-generated',
      'prefer-Native healthy exploration remains Catalog-only',
    )
    const failedCatalog = options?.candidates.find(
      (candidate) => candidate.type === 'catalog-generated',
    )
    if (failedCatalog) {
      base.catalogRoutes.noteStartupProbeResult(failedCatalog, 403)
      assert.ok(
        !base.catalogRoutes
          .startupOptions(base.catalogVideoRoot)
          ?.candidates.some((candidate) => candidate.host === failedCatalog.host),
        'Catalog 403 removes that stream-host pairing from Catalog-only preflight',
      )
      assert.ok(
        base.catalogRoutes.plan(base.catalogVideoRep, base.catalogDemand, 'new-epoch').host !==
          failedCatalog.host,
        'Catalog-only ranking does not revive a Catalog 403 host',
      )
    }
  }
}

async function checkCatalogOnlyFixtureRetainsBothOriginalURLsPrivatelyForAttribution2(
  t: TestContext,
): Promise<void> {
  const base =
    await createCatalogOnlyFixtureRetainsBothOriginalURLsPrivatelyForAttribution2Context1(t)

  assert.ok(
    base.catalogVideoRep && base.catalogAudioRep,
    'Catalog-only fixture retains both original URLs privately for attribution',
  )
}

async function checkFirstGroupEstablishesObservedNativeAffinity1(t: TestContext): Promise<void> {
  const base = await createNativeRoutingScenario(t)

  assert.strictEqual(
    base.transitionSession.get().affinity?.host,
    'upos-hz-mirrorakam.akamaized.net',
    'first group establishes observed Native affinity',
  )
  const nextTransitionApplied = base.transitionRoutes.apply(base.nextTransition.base_url)
  assert.strictEqual(
    nextTransitionApplied.url,
    base.nextTransition.backup_url.find((url) => url.includes('.akamaized.net')),
    'new quality uses its own exact Native URL instead of reviving its startup Catalog plan',
  )
  assert.strictEqual(
    base.transitionSession.get().affinity?.representation,
    base.transitionApplied.context!.representation,
    'planning another quality does not fabricate observed affinity',
  )
  const missingNativeItem = {
    id: 32,
    codecid: 13,
    height: 480,
    bandwidth: 500_000,
    base_url: 'https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/transition/480/1.m4s?k=1',
    backup_url: [] as string[],
  }
  base.transitionAdapter.transform({ data: { dash: { video: [missingNativeItem], audio: [] } } })
  const missingNativeApplied = base.transitionRoutes.apply(missingNativeItem.base_url)
  assert.ok(
    missingNativeApplied.url && !missingNativeApplied.url.includes('.akamaized.net'),
    'quality missing an exact Native capability falls back without synthesizing Native URL',
  )
  const observedTransitionHost = new URL(nextTransitionApplied.url!).host
  await base.transitionSettings.update({ fixedHost: TRUSTED_CATALOG[3] })
  base.transitionRoutes.invalidateForUserSetting()
  assert.strictEqual(
    base.transitionRoutes.apply(base.nextTransition.base_url).decision.host,
    TRUSTED_CATALOG[3],
    'explicit fixed CDN overrides inherited Native affinity',
  )
  assert.ok(
    observedTransitionHost !== TRUSTED_CATALOG[3],
    'fixed-mode test uses a genuinely different host',
  )
  await base.transitionSettings.update({ fixedHost: null })
  base.transitionRoutes.invalidateForUserSetting()
  for (let index = 0; index < 2; index++)
    await base.transitionRoutes.observe({
      ...base.healthyObservation,
      generation: base.transitionState.generation,
      epoch: base.transitionState.epoch,
      decisionId: base.transitionApplied.decision.id,
      representation: base.transitionApplied.context!.representation,
      routeType: 'native-signed',
      targetHost: observedTransitionHost,
      finalHost: observedTransitionHost,
      completedAt: base.now + 10 + index,
    })
  const restrictedTransition = {
    id: 16,
    codecid: 13,
    height: 360,
    bandwidth: 300_000,
    base_url: 'https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/transition/360/1.m4s?k=1',
    backup_url: ['https://upos-hz-mirrorakam.akamaized.net/upgcxcode/transition/360/1.m4s?k=2'],
  }
  base.transitionAdapter.transform({ data: { dash: { video: [restrictedTransition], audio: [] } } })
  await base.transitionRestrictions.add({
    host: observedTransitionHost,
    type: 'black',
    kind: 'all',
    reason: 'regression',
    expireAt: base.now + 60_000,
  })
  assert.ok(
    base.transitionRoutes.apply(restrictedTransition.base_url).decision.host !==
      observedTransitionHost,
    'first-use affinity inheritance cannot bypass a newly blacklisted Native host',
  )
  // Native source permission is a routing boundary, including URLs the player already received.
  const catalogStorage = new FakeStorage(),
    catalogSettings = base.scope.own(new CatalogSettingsStore(catalogStorage, () => base.now))
  const catalogSession = new SessionStore(),
    catalogState = catalogSession.beginGeneration(false)
  const catalogVault = new SignedRouteVault()
  catalogVault.reset(catalogState.generation, catalogState.epoch)
  const catalogRestrictions = base.scope.own(new RestrictionStore(catalogStorage, () => base.now))
  const catalogEvidence = base.scope.own(new EvidenceStore(catalogStorage, () => base.now))
  const catalogRoutes = new RouteCoordinator(
    base.clock,
    catalogSession,
    catalogSettings,
    catalogRestrictions,
    catalogEvidence,
    catalogVault,
    createRuntimeIds(),
  )
  const catalogAdapter = new PlayurlAdapter(
    new PlayurlController(catalogSession, catalogVault, catalogRoutes),
  )
  const catalogVideoRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/catalog-only/video.m4s?signature=video-root'
  const catalogVideoBackup =
    'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/catalog-only/backup/video-alt.m4s?signature=video-backup&part=2'
  const catalogAudioRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/catalog-only/audio.m4s?signature=audio-root'
  const catalogVideo = {
    id: 80,
    codecid: 13,
    height: 1080,
    bandwidth: 2_000_000,
    base_url: catalogVideoRoot,
    backup_url: [catalogVideoBackup],
  }
  const catalogAudio = {
    id: 30280,
    bandwidth: 192_000,
    base_url: catalogAudioRoot,
    backup_url: [] as string[],
  }
  assert.ok(
    catalogAdapter.transform({
      data: { dash: { video: [catalogVideo], audio: [catalogAudio] } },
    }).accepted,
    'Catalog-only fixture adopts trusted video and audio playurl',
  )
}

test('first group establishes observed Native affinity [1]', { timeout: 5000 }, async (t) => {
  await checkFirstGroupEstablishesObservedNativeAffinity1(t)
})
test(
  'Catalog-only fixture retains both original URLs privately for attribution [2]',
  { timeout: 5000 },
  async (t) => {
    await checkCatalogOnlyFixtureRetainsBothOriginalURLsPrivatelyForAttribution2(t)
  },
)
test('Catalog-only startup has legal candidates [3]', { timeout: 5000 }, async (t) => {
  await checkCatalogOnlyStartupHasLegalCandidates3(t)
})
test(
  'opaque signed B station audio is removed from Catalog-only player output [4]',
  { timeout: 5000 },
  async (t) => {
    await checkOpaqueSignedBStationAudioIsRemovedFromCatalogOnlyPlayer(t)
  },
)
test('no legal Catalog candidate starts no healthy probe [5]', { timeout: 5000 }, async (t) => {
  await checkNoLegalCatalogCandidateStartsNoHealthyProbe5(t)
})
test('no legal Catalog candidate emits no player primary [6]', { timeout: 5000 }, async (t) => {
  await checkNoLegalCatalogCandidateEmitsNoPlayerPrimary6(t)
})
test(
  'enabling Native sources preserves cold-start original route [7]',
  { timeout: 5000 },
  async (t) => {
    await checkEnablingNativeSourcesPreservesColdStartOriginalRoute7(t)
  },
)
test(
  'Catalog decision may yield the exact same URL as the original [8]',
  { timeout: 5000 },
  async (t) => {
    await checkCatalogDecisionMayYieldTheExactSameURLAsTheOriginal(t)
  },
)
test(
  'known backup 403 fixture has a current-epoch representation [9]',
  { timeout: 5000 },
  async (t) => {
    await checkKnownBackup403FixtureHasACurrentEpochRepresentation9(t)
  },
)
test(
  'XHR redirect away from Catalog invalidates that Catalog host for the same stream [10]',
  { timeout: 5000 },
  async (t) => {
    await checkXHRRedirectAwayFromCatalogInvalidatesThatCatalogHostForThe(t)
  },
)
test(
  'Catalog-only nested audio fixture accepts valid DASH video [11]',
  { timeout: 5000 },
  async (t) => {
    await checkCatalogOnlyNestedAudioFixtureAcceptsValidDASHVideo11(t)
  },
)
{
  let parameter = 0
  for (const kind of ['video', 'audio'] as const) {
    const selected = parameter++
    test(
      '`Catalog failure fixture registers ${kind}` [12]' + ` / ${String(kind)} / ${selected}`,
      { timeout: 5000 },
      async (t) => {
        await checkCatalogFailureFixtureRegistersParameter12ParameterParameter(t, selected)
      },
    )
  }
}
