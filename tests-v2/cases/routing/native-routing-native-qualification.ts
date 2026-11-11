import { CatalogSettingsStore } from '../../support/catalog-settings.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { type TestContext } from 'node:test'
import { PlayurlController } from '../../../src-v2/application/playurl/playurl-controller.ts'
import { requestId } from '../../../src-v2/domain/model.ts'
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

async function createRoutingResourcesGroup2(t: TestContext) {
  const scope = testScope(t)
  const now = 2_000_000_000_000
  const clock = { now: () => now }
  const redirectedStorage = new FakeStorage()
  const redirectedSession = new SessionStore()
  const redirectedState = redirectedSession.beginGeneration(false)
  const redirectedVault = new SignedRouteVault()
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
  const redirectedEvidence = scope.own(new EvidenceStore(redirectedStorage, () => now))
  const redirectedRoutes = new RouteCoordinator(
    clock,
    redirectedSession,
    scope.own(new CatalogSettingsStore(redirectedStorage, () => now)),
    scope.own(new RestrictionStore(redirectedStorage, () => now)),
    redirectedEvidence,
    redirectedVault,
    createRuntimeIds(),
  )
  return {
    scope,
    now,
    clock,
    redirectedSession,
    redirectedState,
    redirectedVault,
    redirectedRoot,
    redirectedRep,
    redirectedEvidence,
    redirectedRoutes,
  }
}

async function createEnablingNativeSourcesPreservesColdStartOriginalRoute7Context6(t: TestContext) {
  const resources = await createRoutingResources(t)
  const {
    catalogVideoRoot,
    catalogVideoBackup,
    catalogAudioRoot,
    catalogAdapter,
    catalogVault,
    catalogRoutes,
    catalogSettings,
    catalogEvidence,
    catalogSession,
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
  void catalogRoutes.apply(catalogVideoRoot).url
  await catalogSettings.update({ considerNativeSources: true, catalogOverrides: {} })
  catalogRoutes.invalidateForUserSetting()
  return {
    catalogDemand,
    catalogEvidence,
    catalogRoutes,
    catalogSession,
    catalogSettings,
    catalogVideoBackup,
    catalogVideoRep,
    catalogVideoRoot,
  }
}

async function createCatalogDecisionMayYieldTheExactSameURLAsTheOriginalContext7(t: TestContext) {
  const scope = testScope(t)
  const now = 2_000_000_000_000
  const clock = { now: () => now }
  const overlapStorage = new FakeStorage()
  const overlapSession = new SessionStore()
  const overlapState = overlapSession.beginGeneration(false)
  const overlapVault = new SignedRouteVault()
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
    clock,
    overlapSession,
    scope.own(new CatalogSettingsStore(overlapStorage, () => now)),
    scope.own(new RestrictionStore(overlapStorage, () => now)),
    scope.own(new EvidenceStore(overlapStorage, () => now)),
    overlapVault,
    createRuntimeIds(),
  )
  return {
    now,
    overlapRep,
    overlapRoot,
    overlapRoutes,
    overlapState,
  }
}

async function createKnownBackup403FixtureHasACurrentEpochRepresentation9Context8(t: TestContext) {
  const scope = testScope(t)
  const now = 2_000_000_000_000
  const clock = { now: () => now }
  const backup403Storage = new FakeStorage()
  const backup403Session = new SessionStore()
  const backup403State = backup403Session.beginGeneration(false)
  const backup403Vault = new SignedRouteVault()
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
  return {
    backup403Rep,
    backup403Session,
    backup403State,
    backup403Storage,
    backup403Url,
    backup403Vault,
    clock,
    now,
    scope,
  }
}

async function createBackup403RoutesContext9(t: TestContext) {
  const resources = await createRoutingResourcesGroup2(t)
  const {
    redirectedRoutes,
    redirectedRoot,
    redirectedState,
    redirectedRep,
    redirectedVault,
    now,
    redirectedEvidence,
    redirectedSession,
    clock,
    scope,
  } = resources

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
    startedAt: now,
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
    completedAt: now + 1,
    outcome: 'success',
  })
  void redirectedEvidence.get(new URL(redirectedRoot).host, 'video')
  void redirectedSession.get().affinity
  const redirectedNext = redirectedRoutes.apply(redirectedRoot)
  return {
    clock,
    now,
    redirectedFirst,
    redirectedNext,
    scope,
  }
}

async function createCatalogOnlyNestedAudioFixtureAcceptsValidDASHVideo11Context10(t: TestContext) {
  const resources = await createRoutingResourcesGroup2(t)
  const {
    redirectedRoutes,
    redirectedRoot,
    redirectedState,
    redirectedRep,
    redirectedVault,
    now,
    redirectedEvidence,
    redirectedSession,
    scope,
    clock,
  } = resources

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
    startedAt: now,
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
    completedAt: now + 1,
    outcome: 'success',
  })
  void redirectedEvidence.get(new URL(redirectedRoot).host, 'video')
  void redirectedSession.get().affinity
  void redirectedRoutes.apply(redirectedRoot)
  const nestedStorage = new FakeStorage()
  const nestedSettings = scope.own(new CatalogSettingsStore(nestedStorage, () => now))
  const nestedSession = new SessionStore()
  const nestedState = nestedSession.beginGeneration(false)
  const nestedVault = new SignedRouteVault()
  nestedVault.reset(nestedState.generation, nestedState.epoch)
  const nestedRoutes = new RouteCoordinator(
    clock,
    nestedSession,
    nestedSettings,
    scope.own(new RestrictionStore(nestedStorage, () => now)),
    scope.own(new EvidenceStore(nestedStorage, () => now)),
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
  void nestedPayload()
  const strictNested = nestedPayload()
  return {
    clock,
    nestedAdapter,
    now,
    scope,
    strictNested,
  }
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
        completedAt: base.now,
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

  assert.ok(base.overlapRep, 'behavior requires its fixture prerequisites')
  {
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

  assert.ok(base.catalogVideoRep, 'behavior requires its fixture prerequisites')
  {
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
