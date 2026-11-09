import { CatalogSettingsStore } from '../../support/catalog-settings.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { type TestContext } from 'node:test'
import { PlayurlController } from '../../../src-v2/application/playurl/playurl-controller.ts'
import { decisionId, epochId, generationId } from '../../../src-v2/domain/model.ts'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import { SignedRouteVault } from '../../../src-v2/state/signed-route-vault.ts'
import { RestrictionStore } from '../../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../../src-v2/state/evidence-store.ts'
import { SessionStore } from '../../../src-v2/state/session-store.ts'
import { RouteCoordinator } from '../../../src-v2/application/routing/route-coordinator.ts'
import { type TransportObservation } from '../../../src-v2/domain/transport-model.ts'
import { PlayurlAdapter } from '../../../src-v2/adapters/playurl/playurl.ts'
import { FakeStorage } from '../../support/storage.ts'
import { testScope } from '../../support/scope.ts'
import { createRoutingResources } from './native-routing-resources.ts'

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
  const transitionStorage = new FakeStorage()
  const transitionSession = new SessionStore()
  const transitionState = transitionSession.beginGeneration(false)
  const transitionVault = new SignedRouteVault()
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
  const firstTransition = transitionItems[0]!
  const nextTransition = transitionItems[1]!
  const transitionNative = [firstTransition.base_url, ...firstTransition.backup_url].find((url) =>
    url.includes('.akamaized.net'),
  )!
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
      completedAt: now - 1 + index,
    })
  return {
    clock,
    healthyObservation,
    nextTransition,
    now,
    scope,
    transitionAdapter,
    transitionApplied,
    transitionRestrictions,
    transitionRoutes,
    transitionSession,
    transitionSettings,
    transitionState,
  }
}

async function createCatalogOnlyFixtureRetainsBothOriginalURLsPrivatelyForAttribution2Context1(
  t: TestContext,
) {
  const resources = await createRoutingResources(t)
  const { catalogVideoRoot, catalogVideoBackup, catalogAudioRoot, catalogAdapter, catalogVault } =
    resources

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
  return {
    catalogAudioRep,
    catalogVideoRep,
  }
}

async function createCatalogDemandContext2(t: TestContext) {
  const resources = await createRoutingResources(t)
  const {
    catalogVideoRoot,
    catalogVideoBackup,
    catalogAudioRoot,
    catalogAdapter,
    catalogVault,
    catalogRoutes,
  } = resources

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
  const catalogDemand = { kind: 'video' as const, requiredMbps: 5, highDemand: false }
  return {
    catalogAudio,
    catalogAudioRep,
    catalogAudioRoot,
    catalogDemand,
    catalogRoutes,
    catalogVideo,
    catalogVideoBackup,
    catalogVideoRep,
    catalogVideoRoot,
  }
}

async function createOpaqueSignedBStationAudioIsRemovedFromCatalogOnlyPlayerContext3(
  t: TestContext,
) {
  const resources = await createRoutingResources(t)
  const {
    catalogVideoRoot,
    catalogVideoBackup,
    catalogAudioRoot,
    catalogVault,
    catalogRoutes,
    catalogAdapter,
    catalogSettings,
  } = resources

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
  const catalogVideoRep = catalogVault.contextForUrl(catalogVideoRoot)?.representation
  const catalogAudioRep = catalogVault.contextForUrl(catalogAudioRoot)?.representation
  const catalogDemand = { kind: 'video' as const, requiredMbps: 5, highDemand: false }
  if (catalogVideoRep && catalogAudioRep) {
    const options = catalogRoutes.startupOptions(catalogVideoRoot)
    void (options && options.candidates.length > 0)
    void options?.candidates.every(
      (candidate) => candidate.type === 'catalog-generated' && !candidate.original,
    )
    const catalogPlan = catalogRoutes.plan(catalogVideoRep, catalogDemand, 'startup')
    void catalogPlan.routeType
    void catalogRoutes.apply(catalogVideoRoot).decision.routeType
    void catalogRoutes.apply(catalogAudioRoot).decision.routeType
    void [
      catalogVideo.base_url,
      ...catalogVideo.backup_url,
      catalogAudio.base_url,
      ...catalogAudio.backup_url,
    ].every(
      (url) =>
        !!url && TRUSTED_CATALOG.includes(new URL(url).host as (typeof TRUSTED_CATALOG)[number]),
    )
    void ![catalogVideo.base_url, ...catalogVideo.backup_url].includes(catalogVideoBackup)
    const signedBackupApplied = catalogRoutes.apply(catalogVideoBackup)
    void (signedBackupApplied.url && signedBackupApplied.decision.routeType === 'catalog-generated')
    if (signedBackupApplied.url) {
      const requested = new URL(catalogVideoBackup),
        sent = new URL(signedBackupApplied.url)
      void `${sent.pathname}${sent.search}`
      void `${requested.pathname}${requested.search}`
    }
    const deliveredCatalogBackup = catalogVideo.backup_url.find(
      (url) => new URL(url).host !== new URL(catalogVideo.base_url).host,
    )
    if (deliveredCatalogBackup) {
      const deliveredApplied = catalogRoutes.apply(deliveredCatalogBackup)
      void deliveredApplied.decision.routeType
      void deliveredApplied.url
    }
    const challenger = catalogRoutes.challenge(catalogVideoRep, catalogDemand, true)
    void challenger?.decision.routeType
    const failedCatalog = options?.candidates.find(
      (candidate) => candidate.type === 'catalog-generated',
    )
    if (failedCatalog) {
      catalogRoutes.noteStartupProbeResult(failedCatalog, 403)
      void !catalogRoutes
        .startupOptions(catalogVideoRoot)
        ?.candidates.some((candidate) => candidate.host === failedCatalog.host)
      void (
        catalogRoutes.plan(catalogVideoRep, catalogDemand, 'new-epoch').host !== failedCatalog.host
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
  catalogAdapter.transform(
    { data: { dash: { video: [], audio: [opaqueCatalogItem] } } },
    'page-hint',
  )
  return {
    catalogRoutes,
    catalogSettings,
    catalogVideoRoot,
    opaqueCatalogItem,
    opaqueCatalogUrl,
  }
}

async function createNoLegalCatalogCandidateStartsNoHealthyProbe5Context4(t: TestContext) {
  const resources = await createRoutingResources(t)
  const {
    catalogVideoRoot,
    catalogVideoBackup,
    catalogAudioRoot,
    catalogAdapter,
    catalogVault,
    catalogRoutes,
    catalogSettings,
  } = resources

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
  void catalogVault.contextForUrl(catalogAudioRoot)?.representation
  const catalogDemand = { kind: 'video' as const, requiredMbps: 5, highDemand: false }
  const opaqueCatalogUrl =
    'https://upos-hz-mirrorakam.akamaized.net/opaque/catalog-only-audio?signature=opaque'
  void catalogRoutes.apply(opaqueCatalogUrl).decision.reason
  void catalogRoutes.inspectOriginal(catalogVideoRoot).decision.reason
  void catalogRoutes.apply('https://upos-hz-mirrorakam.akamaized.net/live-bvc/catalog-only.m4s')
    .decision.reason
  void catalogRoutes.apply('https://cdn.example.net/unrelated/media.bin').decision.action
  await catalogSettings.update({ fixedHost: TRUSTED_CATALOG[3] })
  catalogRoutes.invalidateForUserSetting()
  void catalogRoutes.apply(catalogVideoRoot).decision.host
  catalogRoutes.invalidateForUserSetting()
  void catalogRoutes.apply(catalogVideoRoot).decision.reason
  return {
    catalogDemand,
    catalogRoutes,
    catalogVideoRep,
  }
}

async function createNoLegalCatalogCandidateEmitsNoPlayerPrimary6Context5(t: TestContext) {
  const resources = await createRoutingResources(t)
  const {
    catalogVault,
    catalogVideoRoot,
    catalogAudioRoot,
    catalogRoutes,
    catalogSettings,
    catalogVideoBackup,
    catalogAdapter,
  } = resources

  const catalogVideoRep = catalogVault.contextForUrl(catalogVideoRoot)?.representation
  void catalogVault.contextForUrl(catalogAudioRoot)?.representation
  const catalogDemand = { kind: 'video' as const, requiredMbps: 5, highDemand: false }
  const opaqueCatalogUrl =
    'https://upos-hz-mirrorakam.akamaized.net/opaque/catalog-only-audio?signature=opaque'
  void catalogRoutes.apply(opaqueCatalogUrl).decision.reason
  void catalogRoutes.inspectOriginal(catalogVideoRoot).decision.reason
  void catalogRoutes.apply('https://upos-hz-mirrorakam.akamaized.net/live-bvc/catalog-only.m4s')
    .decision.reason
  void catalogRoutes.apply('https://cdn.example.net/unrelated/media.bin').decision.action
  catalogRoutes.invalidateForUserSetting()
  void catalogRoutes.apply(catalogVideoRoot).decision.host
  await catalogSettings.update({
    fixedHost: null,
    catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map((host) => [host, false])),
  })
  catalogRoutes.invalidateForUserSetting()
  void catalogRoutes.apply(catalogVideoRoot).decision.reason
  if (catalogVideoRep) {
    void catalogRoutes.challenge(catalogVideoRep, catalogDemand, true)
  }
  const noCatalogOutput = {
    id: 80,
    codecid: 13,
    height: 1080,
    bandwidth: 2_000_000,
    base_url: catalogVideoRoot,
    backup_url: [catalogVideoBackup],
  }
  catalogAdapter.transform({ data: { dash: { video: [noCatalogOutput], audio: [] } } })
  return {
    noCatalogOutput,
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
    [base.nextTransition.base_url, ...base.nextTransition.backup_url].find((url) =>
      url.includes('.akamaized.net'),
    ),
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
