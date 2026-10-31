import { extendFixture } from '../support/fixture-context.ts'
import '../regressions/v220-settings.ts'
import '../regressions/v220-settings-policy.ts'
import { CatalogSettingsStore } from '../support/catalog-settings.ts'
import { createRuntimeIds } from '../../src-v2/platform/runtime-ids.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { signedRouteHandle } from '../../src-v2/domain/model.ts'
import { PlayurlController } from '../../src-v2/application/playurl-controller.ts'
import { decisionId, epochId, generationId, requestId } from '../../src-v2/domain/model.ts'
import { TRUSTED_CATALOG } from '../../src-v2/domain/catalog.ts'
import { SignedRouteVault } from '../../src-v2/state/signed-route-vault.ts'
import { RestrictionStore } from '../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../src-v2/state/evidence-store.ts'
import { SettingsStore } from '../../src-v2/state/settings-store.ts'
import { SessionStore } from '../../src-v2/state/session-store.ts'
import { RouteCoordinator } from '../../src-v2/application/route-coordinator.ts'
import { PlayurlAdapter } from '../../src-v2/adapters/playurl.ts'
import { FakeStorage, DelayedSettingsStorage } from '../support/storage.ts'
import { testScope } from '../support/scope.ts'

// Named scenarios create only their prerequisite state; resources belong to this test.
async function createStateScenario(_t: TestContext) {
  return extendFixture({}, {} as const)
}

async function createVaultAndgenerationAndepochContext1(t: TestContext) {
  const base = await createStateScenario(t)
  const vault = new SignedRouteVault(),
    generation = generationId(1),
    epoch = epochId(1)
  vault.reset(generation, epoch)
  const rep = vault.register({
    generation,
    epoch,
    kind: 'video',
    key: '80:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 4_000_000,
    urls: ['https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/1.m4s?token=secret'],
    source: 'trusted-api',
  })
  return extendFixture(base, { vault, generation, epoch, rep } as const)
}

async function createScopeContext2(t: TestContext) {
  const base = await createStateScenario(t)
  const scope = testScope(t)
  const now = 2_000_000_000_000
  const clock = { now: () => now }
  const vault = new SignedRouteVault(),
    generation = generationId(1),
    epoch = epochId(1)
  vault.reset(generation, epoch)
  const rep = vault.register({
    generation,
    epoch,
    kind: 'video',
    key: '80:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 4_000_000,
    urls: ['https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/1.m4s?token=secret'],
    source: 'trusted-api',
  })
  void vault.register({
    generation,
    epoch,
    kind: 'video',
    key: '80:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 4_000_000,
    urls: ['https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/1.m4s?token=secret'],
    source: 'player-mpd',
  })
  const authorityVault = new SignedRouteVault()
  authorityVault.reset(generation, epoch)
  const hintedUrl = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/hint.m4s?token=hint'
  const trustedUrl = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/api.m4s?token=api'
  const hintedRep = authorityVault.register({
    generation,
    epoch,
    kind: 'video',
    key: '80:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 4_000_000,
    urls: [hintedUrl],
    source: 'page-hint',
  })
  const hintedIdentity = hintedRep ? authorityVault.identity(hintedRep) : null
  const hintedHandle = hintedRep
    ? authorityVault.candidates(hintedRep, new Set()).native[0]?.handle
    : null
  const trustedRep = authorityVault.register({
    generation,
    epoch,
    kind: 'video',
    key: '80:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 4_000_000,
    urls: [trustedUrl],
    source: 'trusted-api',
  })
  void (trustedRep ? authorityVault.rootUrl(trustedRep) : null)
  void (
    !trustedRep ||
    !authorityVault
      .candidates(trustedRep, new Set())
      .native.some((route) => route.host === 'upos-hz-mirrorakam.akamaized.net')
  )
  void (hintedHandle && hintedRep
    ? authorityVault.resolve(hintedHandle, authorityVault.identity(hintedRep)!)
    : null)
  void (!hintedIdentity || !authorityVault.isCurrentIdentity(hintedIdentity))
  void (trustedRep ? authorityVault.identity(trustedRep) : null)
  const lateHintUrl = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/late.m4s?token=late'
  authorityVault.register({
    generation,
    epoch,
    kind: 'video',
    key: '80:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 4_000_000,
    urls: [lateHintUrl],
    source: 'page-hint',
  })
  void (trustedRep ? authorityVault.rootUrl(trustedRep) : null)
  void (
    !trustedRep ||
    !authorityVault
      .candidates(trustedRep, new Set())
      .native.some((route) => route.host === 'upos-hz-mirrorakam.akamaized.net')
  )
  authorityVault.register({
    generation,
    epoch,
    kind: 'video',
    key: '80:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 4_000_000,
    urls: [trustedUrl],
    source: 'trusted-api',
  })
  void (trustedRep ? authorityVault.identity(trustedRep) : null)
  void authorityVault.register({
    generation,
    epoch,
    kind: 'video',
    key: '999:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 4_000_000,
    urls: [trustedUrl],
    source: 'player-mpd',
  })
  void authorityVault.match(trustedUrl).context
  const crossKeyVault = new SignedRouteVault()
  crossKeyVault.reset(generation, epoch)
  const crossKeyHint = crossKeyVault.register({
    generation,
    epoch,
    kind: 'video',
    key: '999:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 4_000_000,
    urls: [trustedUrl],
    source: 'page-hint',
  })
  void crossKeyVault.register({
    generation,
    epoch,
    kind: 'video',
    key: '80:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 4_000_000,
    urls: [trustedUrl],
    source: 'trusted-api',
  })
  void crossKeyVault.match(trustedUrl).context?.representation
  void (crossKeyHint ? crossKeyVault.identity(crossKeyHint) : null)
  const invalidHintVault = new SignedRouteVault()
  invalidHintVault.reset(generation, epoch)
  const invalidHintHost = 'upos-hz-mirrorakam.akamaized.net'
  const invalidHintRep = invalidHintVault.register({
    generation,
    epoch,
    kind: 'video',
    key: '80:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 4_000_000,
    urls: [hintedUrl],
    source: 'page-hint',
  })
  invalidHintVault.invalidate(invalidHintRep!, invalidHintHost)
  const sameHostTrustedUrl = `https://${invalidHintHost}/upgcxcode/a/b/trusted.m4s?token=trusted`
  const invalidHintTrustedRep = invalidHintVault.register({
    generation,
    epoch,
    kind: 'video',
    key: '80:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 4_000_000,
    urls: [sameHostTrustedUrl],
    source: 'trusted-api',
  })
  return extendFixture(base, {
    scope,
    now,
    clock,
    vault,
    generation,
    epoch,
    rep,
    authorityVault,
    hintedUrl,
    trustedUrl,
    hintedRep,
    hintedIdentity,
    hintedHandle,
    trustedRep,
    lateHintUrl,
    crossKeyVault,
    crossKeyHint,
    invalidHintVault,
    invalidHintHost,
    invalidHintRep,
    sameHostTrustedUrl,
    invalidHintTrustedRep,
  } as const)
}

async function createLateLowerTrustPageHintDoesNotRewriteOrMergeIntoContext3(t: TestContext) {
  const base = await createScopeContext2(t)
  void !base.invalidHintVault.isInvalid(base.invalidHintTrustedRep!, base.invalidHintHost)
  void base.invalidHintVault.candidates(base.invalidHintTrustedRep!, new Set()).native[0]?.host
  const authoritySession = new SessionStore()
  authoritySession.beginGeneration(false)
  const authorityState = authoritySession.beginEpoch(),
    authorityStorage = new FakeStorage()
  const authoritySettings = base.scope.own(new SettingsStore(authorityStorage, () => base.now))
  await authoritySettings.update({ considerNativeSources: true })
  const authorityRestrictions = base.scope.own(
    new RestrictionStore(authorityStorage, () => base.now),
  )
  const authorityEvidence = base.scope.own(new EvidenceStore(authorityStorage, () => base.now))
  const plannedVault = new SignedRouteVault()
  plannedVault.reset(authorityState.generation, authorityState.epoch)
  const plannedRep = plannedVault.register({
    generation: authorityState.generation,
    epoch: authorityState.epoch,
    kind: 'video',
    key: '80:av1:1080',
    height: 1080,
    codec: 'av1',
    bandwidth: 4_000_000,
    urls: [base.hintedUrl],
    source: 'page-hint',
  })
  const plannedRoutes = new RouteCoordinator(
    base.clock,
    authoritySession,
    authoritySettings,
    authorityRestrictions,
    authorityEvidence,
    plannedVault,
    createRuntimeIds(),
  )
  const plannedDemand = { kind: 'video' as const, requiredMbps: 8, highDemand: false }
  void (plannedRep ? plannedRoutes.plan(plannedRep, plannedDemand, 'startup').host : null)
  const staleStartup = plannedRoutes.startupOptions(base.hintedUrl)?.candidates[0] ?? null
  const staleChallenge = plannedRep
    ? plannedRoutes.challenge(plannedRep, plannedDemand, false)
    : null
  const plannedAdapter = new PlayurlAdapter(
    new PlayurlController(authoritySession, plannedVault, plannedRoutes),
  )
  const trustedPayload = {
    data: {
      dash: {
        video: [
          {
            id: 80,
            height: 1080,
            codecs: 'av01',
            bandwidth: 4_000_000,
            base_url: base.trustedUrl,
            backup_url: [] as string[],
          },
        ],
        audio: [],
      },
    },
  }
  void plannedAdapter.transform(trustedPayload, 'trusted-api').accepted
  void (plannedRep ? plannedVault.rootUrl(plannedRep) : null)
  void (plannedRep ? plannedRoutes.plan(plannedRep, plannedDemand, 'startup').host : null)
  const lateHintPayload = {
    data: {
      dash: {
        video: [
          {
            id: 80,
            height: 1080,
            codecs: 'av01',
            bandwidth: 4_000_000,
            base_url: base.lateHintUrl,
            backup_url: [] as string[],
          },
        ],
        audio: [],
      },
    },
  }
  plannedAdapter.transform(lateHintPayload, 'page-hint')
  return extendFixture(base, {
    authoritySession,
    authorityState,
    authorityStorage,
    authoritySettings,
    authorityRestrictions,
    authorityEvidence,
    plannedVault,
    plannedRep,
    plannedRoutes,
    plannedDemand,
    staleStartup,
    staleChallenge,
    plannedAdapter,
    trustedPayload,
    lateHintPayload,
  } as const)
}

async function createLateChallengerResultFromTheRetiredHintCannotCreateHealthEvidenceContext4(
  t: TestContext,
) {
  const base = await createLateLowerTrustPageHintDoesNotRewriteOrMergeIntoContext3(t)
  if (base.staleStartup) {
    await base.plannedRoutes.recordStartupSuccess(base.staleStartup, 70 * 1024, 100, 10)
    void base.authorityEvidence.get(base.staleStartup.host, 'video')
    void null
  }
  return extendFixture(base, {} as const)
}

async function createRetiredPageHintTransportDoesNotPunishItsOldHostAfterContext5(t: TestContext) {
  const base =
    await createLateChallengerResultFromTheRetiredHintCannotCreateHealthEvidenceContext4(t)
  if (base.staleChallenge) {
    await base.plannedRoutes.recordChallenge(
      base.staleChallenge,
      70 * 1024,
      100,
      10,
      'success',
      null,
    )
    void base.authorityEvidence.get(base.staleChallenge.decision.host ?? '', 'video')
    void null
  }
  return extendFixture(base, {} as const)
}

async function createExactSignedRouteMapsToCurrentEpoch8Context6(t: TestContext) {
  const base = await createRetiredPageHintTransportDoesNotPunishItsOldHostAfterContext5(t)
  if (base.plannedRep) {
    const staleRequest = {
      requestId: requestId('retired-hint'),
      generation: base.authorityState.generation,
      epoch: base.authorityState.epoch,
      decisionId: decisionId('retired-hint'),
      representation: base.plannedRep,
      authorityRevision: 1,
      routePolicyRevision: base.plannedRoutes.policyRevision(),
      kind: 'video' as const,
      attributionStatus: 'matched' as const,
      attributionSource: 'exact' as const,
      decisionStage: 'request' as const,
      routeType: 'root-original' as const,
      originalHost: 'upos-hz-mirrorakam.akamaized.net',
      targetHost: 'upos-hz-mirrorakam.akamaized.net',
      sourceHost: 'upos-hz-mirrorakam.akamaized.net',
      playurlHostChanged: false,
      playurlOutput: null,
      urlChanged: false,
      hostChanged: false,
      startedAt: base.now,
    }
    await base.plannedRoutes.observe({
      request: staleRequest,
      generation: base.authorityState.generation,
      epoch: base.authorityState.epoch,
      decisionId: staleRequest.decisionId,
      representation: base.plannedRep,
      kind: 'video',
      routeType: 'root-original',
      originalHost: staleRequest.originalHost,
      targetHost: staleRequest.targetHost,
      finalHost: staleRequest.targetHost,
      streamKey: 'retired-hint',
      status: 500,
      bytes: 0,
      ttfbMs: 10,
      elapsedMs: 100,
      completedAt: base.now + 100,
      outcome: 'failure',
      failureKind: 'http-5xx',
    })
    void base.authorityEvidence.get(staleRequest.targetHost, 'video')
    void null
  }
  const context = base.vault.contextForUrl(
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/1.m4s?token=secret',
  )
  return extendFixture(base, { context } as const)
}

async function createProtectedUrlContext7(t: TestContext) {
  const base = await createExactSignedRouteMapsToCurrentEpoch8Context6(t)
  const protectedUrl = 'https://upos-hz-mirrorakam.akamaized.net/opaque/signed-segment?token=secret'
  const protectedRep = base.vault.register({
    generation: base.generation,
    epoch: base.epoch,
    kind: 'audio',
    key: '30280:opaque',
    height: 0,
    codec: 'other',
    bandwidth: 192_000,
    urls: [protectedUrl],
    source: 'trusted-api',
  })
  void base.vault.match(protectedUrl).context?.kind
  void (protectedRep ? base.vault.candidates(protectedRep, new Set()).native.length : -1)
  const externalOpaque = 'https://media.example.org/private/chunk?signature=private'
  const externalRep = base.vault.register({
    generation: base.generation,
    epoch: base.epoch,
    kind: 'audio',
    key: 'external:opaque',
    height: 0,
    codec: 'other',
    bandwidth: 192_000,
    urls: [externalOpaque],
    source: 'page-hint',
  })
  void (externalRep ? base.vault.candidates(externalRep, new Set()).native.length : -1)
  const native = base.rep ? base.vault.candidates(base.rep, new Set()).native[0] : null
  return extendFixture(base, {
    protectedUrl,
    protectedRep,
    externalOpaque,
    externalRep,
    native,
  } as const)
}

async function createSignedRouteNeverCrossesGeneration10Context8(t: TestContext) {
  const base = await createProtectedUrlContext7(t)
  if (base.rep && base.native) {
    void base.vault.resolve(base.native.handle, base.native.route)?.includes('token=secret')
    void true
    base.vault.invalidate(base.rep, base.native.host)
    void base.vault.candidates(base.rep, new Set()).native.length
    void 0
  }
  base.vault.reset(generationId(2), epochId(0))
  return extendFixture(base, {} as const)
}

async function createPCDNCatalogSourceHandleResolvesOnlyTheCurrentExactSignedURLContext9(
  t: TestContext,
) {
  const base = await createSignedRouteNeverCrossesGeneration10Context8(t)
  void (base.context
    ? base.vault.resolve(base.native?.handle ?? signedRouteHandle('missing'), base.context)
    : null)
  const pcdnUrl = 'https://x.szbdyd.com/a.m4s'
  const pcdnRep = base.vault.register({
    generation: generationId(2),
    epoch: epochId(0),
    kind: 'video',
    key: 'pcdn',
    height: 720,
    codec: 'avc',
    bandwidth: 1,
    urls: [pcdnUrl],
    source: 'trusted-api',
  })
  return extendFixture(base, { pcdnUrl, pcdnRep } as const)
}

async function createRestrictionAppliesToAudio12Context10(t: TestContext) {
  const base = await createPCDNCatalogSourceHandleResolvesOnlyTheCurrentExactSignedURLContext9(t)
  if (base.pcdnRep) {
    const identity = base.vault.identity(base.pcdnRep),
      handle = base.vault.catalogSourceHandle(base.pcdnRep)
    void (identity && handle ? base.vault.resolve(handle, identity) : null)
    void base.pcdnUrl
    void base.vault.match(base.pcdnUrl).context?.representation
    void base.pcdnRep
    void base.vault.candidates(base.pcdnRep, new Set()).native.length
    void 0
    void base.vault.candidates(base.pcdnRep, new Set()).root
    void null
  }
  const storage = new FakeStorage(),
    restrictions = base.scope.own(new RestrictionStore(storage, () => base.now))
  await restrictions.add({
    host: TRUSTED_CATALOG[0],
    type: 'black',
    kind: 'all',
    reason: 'test',
    expireAt: base.now + 1000,
  })
  return extendFixture(base, { storage, restrictions } as const)
}

async function createExistingSchema2SettingsWithoutNativeToggleDefaultOff13Context11(
  t: TestContext,
) {
  const base = await createRestrictionAppliesToAudio12Context10(t)
  void base.restrictions.has(TRUSTED_CATALOG[0], 'audio', 'black')
  base.storage.remote('bilicdn.v2.restrictions', {
    schema: 2,
    records: [],
    updatedAt: base.now + 1,
  })
  void base.restrictions.has(TRUSTED_CATALOG[0], 'video')
  await base.restrictions.add({
    host: TRUSTED_CATALOG[0],
    type: 'black',
    kind: 'all',
    reason: 'test',
    expireAt: base.now + 1000,
  })
  await base.restrictions.remove(TRUSTED_CATALOG[0], 'black')
  void base.restrictions.has(TRUSTED_CATALOG[0], 'video')
  const legacyUserRestriction = new FakeStorage()
  legacyUserRestriction.set('bilicdn.v2.restrictions', {
    schema: 2,
    updatedAt: base.now,
    records: [
      {
        host: TRUSTED_CATALOG[0],
        type: 'black',
        kind: 'video',
        reason: 'user',
        createdAt: base.now,
        updatedAt: base.now,
        expireAt: base.now + 60_000,
      },
    ],
  })
  const restoredUserRestriction = base.scope.own(
    new RestrictionStore(legacyUserRestriction, () => base.now),
  )
  void restoredUserRestriction.has(TRUSTED_CATALOG[0], 'audio', 'black')
  void restoredUserRestriction.list()[0]?.kind
  const settings = base.scope.own(new SettingsStore(base.storage, () => base.now))
  const evidenceStore = base.scope.own(new EvidenceStore(base.storage, () => base.now))
  await settings.update({ considerNativeSources: true })
  await evidenceStore.record(TRUSTED_CATALOG[0], 'video', {
    requestId: 'remote-clear',
    at: base.now,
    source: 'transport',
    outcome: 'success',
    throughputMbps: 8,
    ttfbMs: 20,
    failureKind: null,
  })
  void evidenceStore.get(TRUSTED_CATALOG[0], 'video')
  base.storage.remote('bilicdn.v2.routeEvidence', {
    schema: 2,
    records: {},
    updatedAt: base.now + 1,
  })
  void evidenceStore.get(TRUSTED_CATALOG[0], 'video')
  const legacyOnly = new FakeStorage()
  legacyOnly.set('cdnHealth', { poisoned: true })
  legacyOnly.set('workerStats_v1', { created: 99 })
  const freshSettings = base.scope.own(new SettingsStore(legacyOnly, () => base.now))
  void freshSettings.get().earlyRetryEnabled
  void [...legacyOnly.values.keys()].includes('bilicdn.v2.settings')
  void freshSettings.get().considerNativeSources
  const nativeSettingStorage = new FakeStorage()
  nativeSettingStorage.set('bilicdn.v2.settings', {
    schema: 2,
    disabled: false,
    codec: 'hevc',
    updatedAt: base.now - 10,
  })
  const nativeSettings = base.scope.own(new SettingsStore(nativeSettingStorage, () => base.now))
  return extendFixture(base, {
    legacyUserRestriction,
    restoredUserRestriction,
    settings,
    evidenceStore,
    legacyOnly,
    freshSettings,
    nativeSettingStorage,
    nativeSettings,
  } as const)
}

async function createOtherTabReceivesANativeOnSettingWithAFutureTimestampContext12(t: TestContext) {
  const base = await createExistingSchema2SettingsWithoutNativeToggleDefaultOff13Context11(t)
  void base.nativeSettings.get().considerNativeSources
  void ('codec' in base.nativeSettings.get())
  await base.nativeSettings.update({ considerNativeSources: true })
  void base.nativeSettings.get().considerNativeSources
  const nativeOtherTab = base.scope.own(
    new SettingsStore(base.nativeSettingStorage, () => base.now),
  )
  void nativeOtherTab.get().considerNativeSources
  base.nativeSettingStorage.remote('bilicdn.v2.settings', {
    ...base.nativeSettings.get(),
    considerNativeSources: false,
    updatedAt: base.nativeSettings.get().updatedAt + 1,
  })
  void base.nativeSettings.get().considerNativeSources
  void nativeOtherTab.get().considerNativeSources
  base.nativeSettingStorage.remote('bilicdn.v2.settings', {
    ...base.nativeSettings.get(),
    considerNativeSources: 'true',
    updatedAt: base.nativeSettings.get().updatedAt + 1,
  })
  void base.nativeSettings.get().considerNativeSources
  await base.nativeSettings.reset()
  void base.nativeSettings.get().considerNativeSources
  const futureSettingsStorage = new FakeStorage()
  const futureResetTab = base.scope.own(new SettingsStore(futureSettingsStorage, () => base.now))
  const futureOtherTab = base.scope.own(new SettingsStore(futureSettingsStorage, () => base.now))
  futureSettingsStorage.remote('bilicdn.v2.settings', {
    ...futureResetTab.get(),
    considerNativeSources: true,
    updatedAt: base.now + 60_000,
  })
  return extendFixture(base, {
    nativeOtherTab,
    futureSettingsStorage,
    futureResetTab,
    futureOtherTab,
  } as const)
}

async function createNativeOnPageHintInitiallyPreservesItsOriginalURL15Context13(t: TestContext) {
  const base = await createOtherTabReceivesANativeOnSettingWithAFutureTimestampContext12(t)
  void base.futureOtherTab.get().considerNativeSources
  await base.futureResetTab.reset()
  base.futureSettingsStorage.remote(
    'bilicdn.v2.settings',
    base.futureSettingsStorage.get('bilicdn.v2.settings', null),
  )
  void base.futureOtherTab.get().considerNativeSources
  const delayedStorage = new DelayedSettingsStorage(),
    delayedSettings = base.scope.own(new SettingsStore(delayedStorage, () => base.now))
  await delayedSettings.update({ considerNativeSources: true })
  const delayedSession = new SessionStore(),
    delayedState = delayedSession.beginGeneration(false)
  const delayedVault = new SignedRouteVault()
  delayedVault.reset(delayedState.generation, delayedState.epoch)
  const delayedRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/delayed/video.m4s?signature=delayed'
  delayedVault.register({
    generation: delayedState.generation,
    epoch: delayedState.epoch,
    kind: 'video',
    key: 'delayed',
    height: 1080,
    codec: 'av1',
    bandwidth: 1_000_000,
    urls: [delayedRoot],
    source: 'trusted-api',
  })
  const delayedRoutes = new RouteCoordinator(
    base.clock,
    delayedSession,
    delayedSettings,
    base.scope.own(new RestrictionStore(delayedStorage, () => base.now)),
    base.scope.own(new EvidenceStore(delayedStorage, () => base.now)),
    delayedVault,
    createRuntimeIds(),
  )
  void delayedRoutes.apply(delayedRoot).decision.routeType
  delayedStorage.holdNextSettingsLock = true
  const pendingNativeOff = delayedSettings.update({
    considerNativeSources: false,
  })
  void delayedSettings.get().considerNativeSources
  void delayedRoutes.apply(delayedRoot).decision.routeType
  delayedStorage.remote('bilicdn.v2.settings', {
    ...delayedSettings.get(),
    considerNativeSources: true,
    updatedAt: base.now + 100,
  })
  void delayedSettings.get().considerNativeSources
  delayedStorage.releaseSettingsLock()
  await pendingNativeOff
  void delayedSettings.get().considerNativeSources
  await delayedSettings.update({ considerNativeSources: true })
  delayedStorage.holdNextSettingsLock = true
  const pendingNativeReset = delayedSettings.reset()
  void delayedSettings.get().considerNativeSources
  void delayedRoutes.apply(delayedRoot).decision.routeType
  delayedStorage.releaseSettingsLock()
  await pendingNativeReset
  const reuseStorage = new FakeStorage(),
    reuseSettings = base.scope.own(new SettingsStore(reuseStorage, () => base.now))
  await reuseSettings.update({ considerNativeSources: true })
  const reuseSession = new SessionStore(),
    reuseState = reuseSession.beginGeneration(false)
  const reuseVault = new SignedRouteVault()
  reuseVault.reset(reuseState.generation, reuseState.epoch)
  const reuseRoutes = new RouteCoordinator(
    base.clock,
    reuseSession,
    reuseSettings,
    base.scope.own(new RestrictionStore(reuseStorage, () => base.now)),
    base.scope.own(new EvidenceStore(reuseStorage, () => base.now)),
    reuseVault,
    createRuntimeIds(),
  )
  const reusePlayurl = new PlayurlAdapter(
    new PlayurlController(reuseSession, reuseVault, reuseRoutes),
  )
  const reusedPageRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/reuse/page.m4s?signature=page'
  const reusedPagePayload = {
    data: {
      dash: {
        video: [
          {
            id: 80,
            codecid: 13,
            height: 1080,
            bandwidth: 1_000_000,
            base_url: reusedPageRoot,
            backup_url: [] as string[],
          },
        ],
        audio: [],
      },
    },
  }
  reusePlayurl.transform(reusedPagePayload, 'page-hint')
  return extendFixture(base, {
    delayedStorage,
    delayedSettings,
    delayedSession,
    delayedState,
    delayedVault,
    delayedRoot,
    delayedRoutes,
    pendingNativeOff,
    pendingNativeReset,
    reuseStorage,
    reuseSettings,
    reuseSession,
    reuseState,
    reuseVault,
    reuseRoutes,
    reusePlayurl,
    reusedPageRoot,
    reusedPagePayload,
  } as const)
}

async function checkSignedRouteRegistered1(t: TestContext): Promise<void> {
  const base = await createVaultAndgenerationAndepochContext1(t)

  assert.ok(base.rep, 'signed route registered')
  assert.strictEqual(
    base.vault.register({
      generation: base.generation,
      epoch: base.epoch,
      kind: 'video',
      key: '80:av1',
      height: 1080,
      codec: 'av1',
      bandwidth: 4_000_000,
      urls: ['https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/1.m4s?token=secret'],
      source: 'player-mpd',
    }),
    base.rep,
    'repeated manifest ingestion preserves representation identity',
  )
  const authorityVault = new SignedRouteVault()
  authorityVault.reset(base.generation, base.epoch)
  const hintedUrl = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/hint.m4s?token=hint'
  const trustedUrl = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/api.m4s?token=api'
  const hintedRep = authorityVault.register({
    generation: base.generation,
    epoch: base.epoch,
    kind: 'video',
    key: '80:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 4_000_000,
    urls: [hintedUrl],
    source: 'page-hint',
  })
  assert.ok(hintedRep, 'page hint establishes a provisional group')
  const hintedIdentity = hintedRep ? authorityVault.identity(hintedRep) : null
  const hintedHandle = hintedRep
    ? authorityVault.candidates(hintedRep, new Set()).native[0]?.handle
    : null
  const trustedRep = authorityVault.register({
    generation: base.generation,
    epoch: base.epoch,
    kind: 'video',
    key: '80:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 4_000_000,
    urls: [trustedUrl],
    source: 'trusted-api',
  })
  assert.ok(trustedRep, 'trusted API adopts the representation')
  assert.strictEqual(
    trustedRep ? authorityVault.rootUrl(trustedRep) : null,
    trustedUrl,
    'trusted API root replaces the provisional page URL',
  )
  assert.ok(
    !trustedRep ||
      !authorityVault
        .candidates(trustedRep, new Set())
        .native.some((route) => route.host === 'upos-hz-mirrorakam.akamaized.net'),
    'page-hint Native route cannot remain selectable after trusted API adoption',
  )
  assert.strictEqual(
    hintedHandle && hintedRep
      ? authorityVault.resolve(hintedHandle, authorityVault.identity(hintedRep)!)
      : null,
    null,
    'trusted API adoption revokes the earlier hint handle',
  )
  assert.ok(
    !hintedIdentity || !authorityVault.isCurrentIdentity(hintedIdentity),
    'an in-flight page-hint identity is retired on trusted API adoption',
  )
}

async function checkLatePageHintsCannotReplaceTheTrustedRoot2(t: TestContext): Promise<void> {
  const base = await createVaultAndgenerationAndepochContext1(t)

  void base.vault.register({
    generation: base.generation,
    epoch: base.epoch,
    kind: 'video',
    key: '80:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 4_000_000,
    urls: ['https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/1.m4s?token=secret'],
    source: 'player-mpd',
  })
  const authorityVault = new SignedRouteVault()
  authorityVault.reset(base.generation, base.epoch)
  const hintedUrl = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/hint.m4s?token=hint'
  const trustedUrl = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/api.m4s?token=api'
  const hintedRep = authorityVault.register({
    generation: base.generation,
    epoch: base.epoch,
    kind: 'video',
    key: '80:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 4_000_000,
    urls: [hintedUrl],
    source: 'page-hint',
  })
  const hintedIdentity = hintedRep ? authorityVault.identity(hintedRep) : null
  const hintedHandle = hintedRep
    ? authorityVault.candidates(hintedRep, new Set()).native[0]?.handle
    : null
  const trustedRep = authorityVault.register({
    generation: base.generation,
    epoch: base.epoch,
    kind: 'video',
    key: '80:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 4_000_000,
    urls: [trustedUrl],
    source: 'trusted-api',
  })
  void (trustedRep ? authorityVault.rootUrl(trustedRep) : null)
  void (
    !trustedRep ||
    !authorityVault
      .candidates(trustedRep, new Set())
      .native.some((route) => route.host === 'upos-hz-mirrorakam.akamaized.net')
  )
  void (hintedHandle && hintedRep
    ? authorityVault.resolve(hintedHandle, authorityVault.identity(hintedRep)!)
    : null)
  void (!hintedIdentity || !authorityVault.isCurrentIdentity(hintedIdentity))
  const trustedIdentity = trustedRep ? authorityVault.identity(trustedRep) : null
  const lateHintUrl = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/late.m4s?token=late'
  authorityVault.register({
    generation: base.generation,
    epoch: base.epoch,
    kind: 'video',
    key: '80:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 4_000_000,
    urls: [lateHintUrl],
    source: 'page-hint',
  })

  assert.strictEqual(
    trustedRep ? authorityVault.rootUrl(trustedRep) : null,
    trustedUrl,
    'late page hints cannot replace the trusted root',
  )
  assert.ok(
    !trustedRep ||
      !authorityVault
        .candidates(trustedRep, new Set())
        .native.some((route) => route.host === 'upos-hz-mirrorakam.akamaized.net'),
    'late page hints cannot become Native candidates',
  )
  authorityVault.register({
    generation: base.generation,
    epoch: base.epoch,
    kind: 'video',
    key: '80:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 4_000_000,
    urls: [trustedUrl],
    source: 'trusted-api',
  })
  assert.strictEqual(
    trustedRep ? authorityVault.identity(trustedRep) : null,
    trustedIdentity,
    'repeated identical trusted data does not invalidate active work',
  )
  const duplicateHintRep = authorityVault.register({
    generation: base.generation,
    epoch: base.epoch,
    kind: 'video',
    key: '999:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 4_000_000,
    urls: [trustedUrl],
    source: 'player-mpd',
  })
  assert.strictEqual(
    duplicateHintRep,
    trustedRep,
    'later different-key hint cannot duplicate a trusted exact URL',
  )
  assert.strictEqual(
    authorityVault.match(trustedUrl).context,
    trustedIdentity,
    'trusted exact URL remains unambiguous after a different-key hint',
  )
  const crossKeyVault = new SignedRouteVault()
  crossKeyVault.reset(base.generation, base.epoch)
  const crossKeyHint = crossKeyVault.register({
    generation: base.generation,
    epoch: base.epoch,
    kind: 'video',
    key: '999:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 4_000_000,
    urls: [trustedUrl],
    source: 'page-hint',
  })
  const crossKeyTrusted = crossKeyVault.register({
    generation: base.generation,
    epoch: base.epoch,
    kind: 'video',
    key: '80:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 4_000_000,
    urls: [trustedUrl],
    source: 'trusted-api',
  })
  assert.strictEqual(
    crossKeyVault.match(trustedUrl).context?.representation,
    crossKeyTrusted,
    'trusted API revokes a different-key hint that duplicates its exact URL',
  )
  assert.strictEqual(
    crossKeyHint ? crossKeyVault.identity(crossKeyHint) : null,
    null,
    'different-key provisional group is retired after trusted API adoption',
  )
  const invalidHintVault = new SignedRouteVault()
  invalidHintVault.reset(base.generation, base.epoch)
  ;('upos-hz-mirrorakam.akamaized.net')
  const invalidHintRep = invalidHintVault.register({
    generation: base.generation,
    epoch: base.epoch,
    kind: 'video',
    key: '80:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 4_000_000,
    urls: [hintedUrl],
    source: 'page-hint',
  })
  assert.ok(invalidHintRep, 'provisional route exists before its host is invalidated')
}

async function checkNativeOnPageHintInitiallyPreservesItsOriginalURL15(
  t: TestContext,
): Promise<void> {
  const base = await createNativeOnPageHintInitiallyPreservesItsOriginalURL15Context13(t)

  assert.strictEqual(
    base.reusedPagePayload.data.dash.video[0]?.base_url,
    base.reusedPageRoot,
    'Native-on page hint initially preserves its original URL',
  )
  await base.reuseSettings.update({ considerNativeSources: false })
  base.reuseRoutes.invalidateForUserSetting()
  base.reusePlayurl.transform(base.reusedPagePayload, 'page-hint')
  assert.ok(
    TRUSTED_CATALOG.includes(
      new URL(base.reusedPagePayload.data.dash.video[0]?.base_url ?? '')
        .host as (typeof TRUSTED_CATALOG)[number],
    ),
    'same-generation seen page hint is reprocessed to Catalog after Native switch turns off',
  )
  await base.reuseSettings.update({ considerNativeSources: true })
  await base.reuseSettings.update({ considerNativeSources: false })
  base.reusedPagePayload.data.dash.video[0]!.base_url = base.reusedPageRoot
  base.reusePlayurl.transform(base.reusedPagePayload, 'page-hint')
  assert.ok(
    TRUSTED_CATALOG.includes(
      new URL(base.reusedPagePayload.data.dash.video[0]?.base_url ?? '')
        .host as (typeof TRUSTED_CATALOG)[number],
    ),
    'OFF-to-ON-to-OFF transition without intermediate transform cannot reuse unsafe page-hint cache',
  )
  const mutatedPageRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/reuse/page-mutated.m4s?signature=changed'
  base.reusedPagePayload.data.dash.video[0]!.base_url = mutatedPageRoot
  base.reusePlayurl.transform(base.reusedPagePayload, 'page-hint')
  assert.ok(
    TRUSTED_CATALOG.includes(
      new URL(base.reusedPagePayload.data.dash.video[0]?.base_url ?? '')
        .host as (typeof TRUSTED_CATALOG)[number],
    ),
    'mutated same-object page hint is re-sanitized while Native stays OFF',
  )
  assert.strictEqual(
    new URL(base.reusedPagePayload.data.dash.video[0]?.base_url ?? '').search,
    new URL(mutatedPageRoot).search,
    'same-object page hint mutation preserves its newly requested query during Catalog rewrite',
  )
  await base.reuseSettings.update({ considerNativeSources: true })
  base.reuseRoutes.invalidateForUserSetting()
  const reusedApiRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/reuse/api.m4s?signature=api'
  const reusedApiPayload = {
    data: {
      dash: {
        video: [
          {
            id: 64,
            codecid: 13,
            height: 720,
            bandwidth: 1_000_000,
            base_url: reusedApiRoot,
            backup_url: [] as string[],
          },
        ],
        audio: [],
      },
    },
  }
  base.reusePlayurl.transform(reusedApiPayload, 'trusted-api', 'reuse-api-response')
  assert.strictEqual(
    reusedApiPayload.data.dash.video[0]?.base_url,
    reusedApiRoot,
    'Native-on trusted response initially preserves its original URL',
  )
  await base.reuseSettings.update({ considerNativeSources: false })
  base.reuseRoutes.invalidateForUserSetting()
  base.reusePlayurl.transform(reusedApiPayload, 'trusted-api', 'reuse-api-response')
  assert.ok(
    TRUSTED_CATALOG.includes(
      new URL(reusedApiPayload.data.dash.video[0]?.base_url ?? '')
        .host as (typeof TRUSTED_CATALOG)[number],
    ),
    'same-generation response key is reprocessed to Catalog after Native switch turns off',
  )
  await base.reuseSettings.update({ considerNativeSources: true })
  await base.reuseSettings.update({ considerNativeSources: false })
  reusedApiPayload.data.dash.video[0]!.base_url = reusedApiRoot
  base.reusePlayurl.transform(reusedApiPayload, 'trusted-api', 'reuse-api-response')
  assert.ok(
    TRUSTED_CATALOG.includes(
      new URL(reusedApiPayload.data.dash.video[0]?.base_url ?? '')
        .host as (typeof TRUSTED_CATALOG)[number],
    ),
    'OFF-to-ON-to-OFF transition without intermediate transform cannot reuse unsafe responseKey cache',
  )
}

async function checkMutatedSameObjectTrustedPayloadIsReSanitizedDespiteAnAlready(
  t: TestContext,
): Promise<void> {
  const base = await createNativeOnPageHintInitiallyPreservesItsOriginalURL15Context13(t)

  await base.reuseSettings.update({ considerNativeSources: false })
  base.reuseRoutes.invalidateForUserSetting()
  base.reusePlayurl.transform(base.reusedPagePayload, 'page-hint')
  void TRUSTED_CATALOG.includes(
    new URL(base.reusedPagePayload.data.dash.video[0]?.base_url ?? '')
      .host as (typeof TRUSTED_CATALOG)[number],
  )
  await base.reuseSettings.update({ considerNativeSources: true })
  await base.reuseSettings.update({ considerNativeSources: false })
  base.reusedPagePayload.data.dash.video[0]!.base_url = base.reusedPageRoot
  base.reusePlayurl.transform(base.reusedPagePayload, 'page-hint')
  void TRUSTED_CATALOG.includes(
    new URL(base.reusedPagePayload.data.dash.video[0]?.base_url ?? '')
      .host as (typeof TRUSTED_CATALOG)[number],
  )
  const mutatedPageRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/reuse/page-mutated.m4s?signature=changed'
  base.reusedPagePayload.data.dash.video[0]!.base_url = mutatedPageRoot
  base.reusePlayurl.transform(base.reusedPagePayload, 'page-hint')
  void TRUSTED_CATALOG.includes(
    new URL(base.reusedPagePayload.data.dash.video[0]?.base_url ?? '')
      .host as (typeof TRUSTED_CATALOG)[number],
  )
  await base.reuseSettings.update({ considerNativeSources: true })
  base.reuseRoutes.invalidateForUserSetting()
  const reusedApiRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/reuse/api.m4s?signature=api'
  const reusedApiPayload = {
    data: {
      dash: {
        video: [
          {
            id: 64,
            codecid: 13,
            height: 720,
            bandwidth: 1_000_000,
            base_url: reusedApiRoot,
            backup_url: [] as string[],
          },
        ],
        audio: [],
      },
    },
  }
  base.reusePlayurl.transform(reusedApiPayload, 'trusted-api', 'reuse-api-response')
  await base.reuseSettings.update({ considerNativeSources: false })
  base.reuseRoutes.invalidateForUserSetting()
  base.reusePlayurl.transform(reusedApiPayload, 'trusted-api', 'reuse-api-response')
  void TRUSTED_CATALOG.includes(
    new URL(reusedApiPayload.data.dash.video[0]?.base_url ?? '')
      .host as (typeof TRUSTED_CATALOG)[number],
  )
  await base.reuseSettings.update({ considerNativeSources: true })
  await base.reuseSettings.update({ considerNativeSources: false })
  reusedApiPayload.data.dash.video[0]!.base_url = reusedApiRoot
  base.reusePlayurl.transform(reusedApiPayload, 'trusted-api', 'reuse-api-response')
  void TRUSTED_CATALOG.includes(
    new URL(reusedApiPayload.data.dash.video[0]?.base_url ?? '')
      .host as (typeof TRUSTED_CATALOG)[number],
  )
  const mutatedApiRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/reuse/api-mutated.m4s?signature=changed-api'
  reusedApiPayload.data.dash.video[0]!.base_url = mutatedApiRoot
  base.reusePlayurl.transform(reusedApiPayload, 'trusted-api', 'reuse-api-response')

  assert.ok(
    TRUSTED_CATALOG.includes(
      new URL(reusedApiPayload.data.dash.video[0]?.base_url ?? '')
        .host as (typeof TRUSTED_CATALOG)[number],
    ),
    'mutated same-object trusted payload is re-sanitized despite an already-seen responseKey',
  )
  const epochReuseStorage = new FakeStorage(),
    epochReuseSettings = base.scope.own(new CatalogSettingsStore(epochReuseStorage, () => base.now))
  const epochReuseSession = new SessionStore(),
    epochReuseState = epochReuseSession.beginGeneration(false)
  const epochReuseVault = new SignedRouteVault()
  epochReuseVault.reset(epochReuseState.generation, epochReuseState.epoch)
  const epochReuseRoutes = new RouteCoordinator(
    base.clock,
    epochReuseSession,
    epochReuseSettings,
    base.scope.own(new RestrictionStore(epochReuseStorage, () => base.now)),
    base.scope.own(new EvidenceStore(epochReuseStorage, () => base.now)),
    epochReuseVault,
    createRuntimeIds(),
  )
  const epochReuseAdapter = new PlayurlAdapter(
    new PlayurlController(epochReuseSession, epochReuseVault, epochReuseRoutes),
  )
  const oldEpochRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/epoch-reuse/old/video.m4s?signature=old-epoch'
  const newEpochRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/epoch-reuse/new/video.m4s?signature=new-epoch'
  const oldEpochPayload = {
    data: {
      dash: {
        video: [
          {
            id: 80,
            codecid: 13,
            height: 1080,
            bandwidth: 1_000_000,
            base_url: oldEpochRoot,
            backup_url: [] as string[],
          },
        ],
        audio: [],
      },
    },
  }
  assert.ok(
    epochReuseAdapter.transform(oldEpochPayload, 'trusted-api').accepted,
    'old trusted payload registers a representation',
  )
  const oldEpochRep = epochReuseVault.match(oldEpochRoot).context?.representation
  assert.ok(oldEpochRep, 'old trusted payload has a vault identity before epoch reset')
  const nextEpochState = epochReuseSession.beginEpoch()
  epochReuseVault.reset(nextEpochState.generation, nextEpochState.epoch)
  epochReuseRoutes.resetEpoch()
  const newEpochRep = epochReuseVault.register({
    generation: nextEpochState.generation,
    epoch: nextEpochState.epoch,
    kind: 'video',
    key: 'new-epoch',
    height: 1080,
    codec: 'av1',
    bandwidth: 1_000_000,
    urls: [newEpochRoot],
    source: 'trusted-api',
  })
  assert.strictEqual(
    newEpochRep,
    oldEpochRep,
    'vault representation IDs are reused in a later epoch',
  )
  epochReuseAdapter.transform(oldEpochPayload, 'trusted-api')
  const oldEpochOutput = oldEpochPayload.data.dash.video[0]?.base_url ?? ''
  assert.ok(
    !oldEpochOutput.includes('new-epoch') &&
      (oldEpochOutput === '' ||
        (TRUSTED_CATALOG.includes(
          new URL(oldEpochOutput).host as (typeof TRUSTED_CATALOG)[number],
        ) &&
          new URL(oldEpochOutput).pathname === new URL(oldEpochRoot).pathname)),
    'reused old trusted payload cannot inherit a new epoch representation root',
  )
}

async function checkOtherTabReceivesANativeOnSettingWithAFutureTimestamp(
  t: TestContext,
): Promise<void> {
  const base = await createOtherTabReceivesANativeOnSettingWithAFutureTimestampContext12(t)

  assert.strictEqual(
    base.futureOtherTab.get().considerNativeSources,
    true,
    'other tab receives a Native-on setting with a future timestamp',
  )
  await base.futureResetTab.reset()
  base.futureSettingsStorage.remote(
    'bilicdn.v2.settings',
    base.futureSettingsStorage.get('bilicdn.v2.settings', null),
  )
  assert.strictEqual(
    base.futureOtherTab.get().considerNativeSources,
    true,
    'settings reset propagates Native-on across tabs even after a future timestamp',
  )
  const delayedStorage = new DelayedSettingsStorage(),
    delayedSettings = base.scope.own(new SettingsStore(delayedStorage, () => base.now))
  await delayedSettings.update({ considerNativeSources: true })
  const delayedSession = new SessionStore(),
    delayedState = delayedSession.beginGeneration(false)
  const delayedVault = new SignedRouteVault()
  delayedVault.reset(delayedState.generation, delayedState.epoch)
  const delayedRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/delayed/video.m4s?signature=delayed'
  delayedVault.register({
    generation: delayedState.generation,
    epoch: delayedState.epoch,
    kind: 'video',
    key: 'delayed',
    height: 1080,
    codec: 'av1',
    bandwidth: 1_000_000,
    urls: [delayedRoot],
    source: 'trusted-api',
  })
  const delayedRoutes = new RouteCoordinator(
    base.clock,
    delayedSession,
    delayedSettings,
    base.scope.own(new RestrictionStore(delayedStorage, () => base.now)),
    base.scope.own(new EvidenceStore(delayedStorage, () => base.now)),
    delayedVault,
    createRuntimeIds(),
  )
  assert.strictEqual(
    delayedRoutes.apply(delayedRoot).decision.routeType,
    'root-original',
    'delayed-lock fixture initially permits Native-on original',
  )
  delayedStorage.holdNextSettingsLock = true
  const pendingNativeOff = delayedSettings.update({
    considerNativeSources: false,
  })
  assert.strictEqual(
    delayedSettings.get().considerNativeSources,
    false,
    'turning Native off takes effect before storage lock callback completes',
  )
  assert.strictEqual(
    delayedRoutes.apply(delayedRoot).decision.routeType,
    'catalog-generated',
    'pre-dispatch routing obeys pending Native-off update',
  )
  delayedStorage.remote('bilicdn.v2.settings', {
    ...delayedSettings.get(),
    considerNativeSources: true,
    updatedAt: base.now + 100,
  })
  assert.strictEqual(
    delayedSettings.get().considerNativeSources,
    false,
    'remote Native-on update cannot reopen Native while a local OFF write is pending',
  )
  delayedStorage.releaseSettingsLock()
  await pendingNativeOff
  assert.strictEqual(
    delayedSettings.get().considerNativeSources,
    false,
    'pending Native-off write completes with OFF state',
  )
  await delayedSettings.update({ considerNativeSources: true })
  delayedStorage.holdNextSettingsLock = true
  delayedSettings.reset()
  assert.strictEqual(
    delayedSettings.get().considerNativeSources,
    false,
    'settings reset defaults Native use OFF before storage lock callback completes',
  )
  assert.strictEqual(
    delayedRoutes.apply(delayedRoot).decision.routeType,
    'catalog-generated',
    'pre-dispatch routing obeys pending settings reset',
  )
}

async function checkExistingSchema2SettingsWithoutNativeToggleDefaultOn13(
  t: TestContext,
): Promise<void> {
  const base = await createExistingSchema2SettingsWithoutNativeToggleDefaultOff13Context11(t)

  assert.strictEqual(
    base.nativeSettings.get().considerNativeSources,
    true,
    'existing schema 2 settings without Native toggle default on',
  )
  assert.strictEqual(
    'codec' in base.nativeSettings.get(),
    false,
    'obsolete codec preference is ignored without changing Native permission',
  )
  await base.nativeSettings.update({ considerNativeSources: true })
  assert.strictEqual(
    base.nativeSettings.get().considerNativeSources,
    true,
    'Native source permission can be enabled',
  )
  const nativeOtherTab = base.scope.own(
    new SettingsStore(base.nativeSettingStorage, () => base.now),
  )
  assert.strictEqual(
    nativeOtherTab.get().considerNativeSources,
    true,
    'Native source permission persists for another tab',
  )
  base.nativeSettingStorage.remote('bilicdn.v2.settings', {
    ...base.nativeSettings.get(),
    considerNativeSources: false,
    updatedAt: base.nativeSettings.get().updatedAt + 1,
  })
  assert.strictEqual(
    base.nativeSettings.get().considerNativeSources,
    false,
    'remote settings can turn Native source use off',
  )
  assert.strictEqual(
    nativeOtherTab.get().considerNativeSources,
    false,
    'remote Native switch reaches another open tab',
  )
  base.nativeSettingStorage.remote('bilicdn.v2.settings', {
    ...base.nativeSettings.get(),
    considerNativeSources: 'true',
    updatedAt: base.nativeSettings.get().updatedAt + 1,
  })
  assert.strictEqual(
    base.nativeSettings.get().considerNativeSources,
    true,
    'non-boolean stored Native permission uses the enabled default',
  )
  await base.nativeSettings.reset()
  assert.strictEqual(
    base.nativeSettings.get().considerNativeSources,
    true,
    'settings reset enables Native source use',
  )
}

async function checkRestrictionAppliesToAudio12(t: TestContext): Promise<void> {
  const base = await createRestrictionAppliesToAudio12Context10(t)

  assert.strictEqual(
    base.restrictions.has(TRUSTED_CATALOG[0], 'audio', 'black'),
    true,
    'restriction applies to audio',
  )
  base.storage.remote('bilicdn.v2.restrictions', {
    schema: 2,
    records: [],
    updatedAt: base.now + 1,
  })
  assert.strictEqual(
    base.restrictions.has(TRUSTED_CATALOG[0], 'video'),
    false,
    'newer remote removal replaces stale restriction state',
  )
  await base.restrictions.add({
    host: TRUSTED_CATALOG[0],
    type: 'black',
    kind: 'all',
    reason: 'test',
    expireAt: base.now + 1000,
  })
  await base.restrictions.remove(TRUSTED_CATALOG[0], 'black')
  assert.strictEqual(
    base.restrictions.has(TRUSTED_CATALOG[0], 'video'),
    false,
    'restriction removal applies immediately',
  )
  const legacyUserRestriction = new FakeStorage()
  legacyUserRestriction.set('bilicdn.v2.restrictions', {
    schema: 2,
    updatedAt: base.now,
    records: [
      {
        host: TRUSTED_CATALOG[0],
        type: 'black',
        kind: 'video',
        reason: 'user',
        createdAt: base.now,
        updatedAt: base.now,
        expireAt: base.now + 60_000,
      },
    ],
  })
  const restoredUserRestriction = base.scope.own(
    new RestrictionStore(legacyUserRestriction, () => base.now),
  )
  assert.strictEqual(
    restoredUserRestriction.has(TRUSTED_CATALOG[0], 'audio', 'black'),
    true,
    'existing user-created video blacklist also protects audio after update',
  )
  assert.strictEqual(
    restoredUserRestriction.list()[0]?.kind,
    'all',
    'existing user-created blacklist displays its effective scope',
  )
  const settings = base.scope.own(new SettingsStore(base.storage, () => base.now))
  const evidenceStore = base.scope.own(new EvidenceStore(base.storage, () => base.now))
  new SessionStore()
  await settings.update({ considerNativeSources: true })
  await evidenceStore.record(TRUSTED_CATALOG[0], 'video', {
    requestId: 'remote-clear',
    at: base.now,
    source: 'transport',
    outcome: 'success',
    throughputMbps: 8,
    ttfbMs: 20,
    failureKind: null,
  })
  assert.ok(evidenceStore.get(TRUSTED_CATALOG[0], 'video'), 'evidence store records local result')
  base.storage.remote('bilicdn.v2.routeEvidence', {
    schema: 2,
    records: {},
    updatedAt: base.now + 1,
  })
  assert.strictEqual(
    evidenceStore.get(TRUSTED_CATALOG[0], 'video'),
    null,
    'newer remote clear removes stale evidence',
  )
  const legacyOnly = new FakeStorage()
  legacyOnly.set('cdnHealth', { poisoned: true })
  legacyOnly.set('workerStats_v1', { created: 99 })
  const freshSettings = base.scope.own(new SettingsStore(legacyOnly, () => base.now))
  assert.strictEqual(freshSettings.get().earlyRetryEnabled, true, 'v2 settings ignore every v1 key')
  assert.strictEqual(
    [...legacyOnly.values.keys()].includes('bilicdn.v2.settings'),
    false,
    'reading defaults does not migrate legacy data',
  )
  assert.strictEqual(
    freshSettings.get().considerNativeSources,
    true,
    'Native source use defaults on without stored v2 settings',
  )
}

async function checkPCDNCatalogSourceHandleResolvesOnlyTheCurrentExactSignedURL(
  t: TestContext,
): Promise<void> {
  const base = await createPCDNCatalogSourceHandleResolvesOnlyTheCurrentExactSignedURLContext9(t)

  if (base.pcdnRep) {
    const identity = base.vault.identity(base.pcdnRep),
      handle = base.vault.catalogSourceHandle(base.pcdnRep)
    assert.strictEqual(
      identity && handle ? base.vault.resolve(handle, identity) : null,
      base.pcdnUrl,
      'PCDN Catalog source handle resolves only the current exact signed URL',
    )
    assert.strictEqual(
      base.vault.match(base.pcdnUrl).context?.representation,
      base.pcdnRep,
      'exact PCDN source is attributable',
    )
    assert.strictEqual(
      base.vault.candidates(base.pcdnRep, new Set()).native.length,
      0,
      'PCDN source never becomes an active Native candidate',
    )
    assert.strictEqual(
      base.vault.candidates(base.pcdnRep, new Set()).root,
      null,
      'PCDN source never becomes an original fallback',
    )
  }
}

async function checkSignedRouteNeverCrossesGeneration10(t: TestContext): Promise<void> {
  const base = await createSignedRouteNeverCrossesGeneration10Context8(t)

  assert.strictEqual(
    base.context
      ? base.vault.resolve(base.native?.handle ?? signedRouteHandle('missing'), base.context)
      : null,
    null,
    'signed route never crosses generation',
  )
  const pcdnUrl = 'https://x.szbdyd.com/a.m4s'
  const pcdnRep = base.vault.register({
    generation: generationId(2),
    epoch: epochId(0),
    kind: 'video',
    key: 'pcdn',
    height: 720,
    codec: 'avc',
    bandwidth: 1,
    urls: [pcdnUrl],
    source: 'trusted-api',
  })
  assert.ok(pcdnRep, 'safe exact PCDN source is held privately for Catalog generation')
}

async function checkOpaqueHandleResolvesInsideVault9(t: TestContext): Promise<void> {
  const base = await createProtectedUrlContext7(t)

  if (base.rep && base.native) {
    assert.strictEqual(
      base.vault.resolve(base.native.handle, base.native.route)?.includes('token=secret'),
      true,
      'opaque handle resolves inside vault',
    )
    base.vault.invalidate(base.rep, base.native.host)
    assert.strictEqual(
      base.vault.candidates(base.rep, new Set()).native.length,
      0,
      'epoch invalidation removes native candidate',
    )
  }
}

async function checkExactSignedRouteMapsToCurrentEpoch8(t: TestContext): Promise<void> {
  const base = await createExactSignedRouteMapsToCurrentEpoch8Context6(t)

  assert.strictEqual(base.context?.epoch, base.epoch, 'exact signed route maps to current epoch')
  const protectedUrl = 'https://upos-hz-mirrorakam.akamaized.net/opaque/signed-segment?token=secret'
  const protectedRep = base.vault.register({
    generation: base.generation,
    epoch: base.epoch,
    kind: 'audio',
    key: '30280:opaque',
    height: 0,
    codec: 'other',
    bandwidth: 192_000,
    urls: [protectedUrl],
    source: 'trusted-api',
  })
  assert.ok(protectedRep, 'current-epoch signed URL without a known media suffix is retained')
  assert.strictEqual(
    base.vault.match(protectedUrl).context?.kind,
    'audio',
    'exact protected signed URL is recognized as audio',
  )
  assert.strictEqual(
    protectedRep ? base.vault.candidates(protectedRep, new Set()).native.length : -1,
    0,
    'opaque protected URL is observation-only, not a Native selection capability',
  )
  const externalOpaque = 'https://media.example.org/private/chunk?signature=private'
  const externalRep = base.vault.register({
    generation: base.generation,
    epoch: base.epoch,
    kind: 'audio',
    key: 'external:opaque',
    height: 0,
    codec: 'other',
    bandwidth: 192_000,
    urls: [externalOpaque],
    source: 'page-hint',
  })
  assert.ok(
    externalRep,
    'current-epoch external signed URL can be observed without active capability',
  )
  assert.strictEqual(
    externalRep ? base.vault.candidates(externalRep, new Set()).native.length : -1,
    0,
    'external opaque URL never enters Native selection',
  )
  const native = base.rep ? base.vault.candidates(base.rep, new Set()).native[0] : null
  assert.strictEqual(
    native?.host,
    'upos-hz-mirrorakam.akamaized.net',
    'known native family can be explored',
  )
}

async function checkRetiredPageHintTransportDoesNotPunishItsOldHostAfter(
  t: TestContext,
): Promise<void> {
  const base = await createRetiredPageHintTransportDoesNotPunishItsOldHostAfterContext5(t)

  if (base.plannedRep) {
    const staleRequest = {
      requestId: requestId('retired-hint'),
      generation: base.authorityState.generation,
      epoch: base.authorityState.epoch,
      decisionId: decisionId('retired-hint'),
      representation: base.plannedRep,
      authorityRevision: 1,
      routePolicyRevision: base.plannedRoutes.policyRevision(),
      kind: 'video' as const,
      attributionStatus: 'matched' as const,
      attributionSource: 'exact' as const,
      decisionStage: 'request' as const,
      routeType: 'root-original' as const,
      originalHost: 'upos-hz-mirrorakam.akamaized.net',
      targetHost: 'upos-hz-mirrorakam.akamaized.net',
      sourceHost: 'upos-hz-mirrorakam.akamaized.net',
      playurlHostChanged: false,
      playurlOutput: null,
      urlChanged: false,
      hostChanged: false,
      startedAt: base.now,
    }
    await base.plannedRoutes.observe({
      request: staleRequest,
      generation: base.authorityState.generation,
      epoch: base.authorityState.epoch,
      decisionId: staleRequest.decisionId,
      representation: base.plannedRep,
      kind: 'video',
      routeType: 'root-original',
      originalHost: staleRequest.originalHost,
      targetHost: staleRequest.targetHost,
      finalHost: staleRequest.targetHost,
      streamKey: 'retired-hint',
      status: 500,
      bytes: 0,
      ttfbMs: 10,
      elapsedMs: 100,
      completedAt: base.now + 100,
      outcome: 'failure',
      failureKind: 'http-5xx',
    })
    assert.strictEqual(
      base.authorityEvidence.get(staleRequest.targetHost, 'video'),
      null,
      'retired page-hint transport does not punish its old host after API adoption',
    )
  }
}

async function checkLateChallengerResultFromTheRetiredHintCannotCreateHealthEvidence(
  t: TestContext,
): Promise<void> {
  const base =
    await createLateChallengerResultFromTheRetiredHintCannotCreateHealthEvidenceContext4(t)

  if (base.staleChallenge) {
    await base.plannedRoutes.recordChallenge(
      base.staleChallenge,
      70 * 1024,
      100,
      10,
      'success',
      null,
    )
    assert.strictEqual(
      base.authorityEvidence.get(base.staleChallenge.decision.host ?? '', 'video'),
      null,
      'late challenger result from the retired hint cannot create health evidence',
    )
  }
}

async function checkLateLowerTrustPageHintDoesNotRewriteOrMergeInto(t: TestContext): Promise<void> {
  const base = await createLateLowerTrustPageHintDoesNotRewriteOrMergeIntoContext3(t)

  assert.strictEqual(
    base.lateHintPayload.data.dash.video[0]?.base_url,
    base.lateHintUrl,
    'late lower-trust page hint does not rewrite or merge into trusted API output',
  )
}

async function checkLatePreflightResultFromTheRetiredHintCannotCreateHealthEvidence(
  t: TestContext,
): Promise<void> {
  const base = await createLateLowerTrustPageHintDoesNotRewriteOrMergeIntoContext3(t)

  if (base.staleStartup) {
    await base.plannedRoutes.recordStartupSuccess(base.staleStartup, 70 * 1024, 100, 10)
    assert.strictEqual(
      base.authorityEvidence.get(base.staleStartup.host, 'video'),
      null,
      'late preflight result from the retired hint cannot create health evidence',
    )
  }
}

async function checkTrustedAPIReplacesInvalidatedProvisionalRouteOnTheSameHost3(
  t: TestContext,
): Promise<void> {
  const base = await createScopeContext2(t)

  assert.ok(
    base.invalidHintTrustedRep,
    'trusted API replaces invalidated provisional route on the same host',
  )
  assert.ok(
    !base.invalidHintVault.isInvalid(base.invalidHintTrustedRep!, base.invalidHintHost),
    'provisional host invalidation does not poison newly trusted exact URL',
  )
  assert.strictEqual(
    base.invalidHintVault.candidates(base.invalidHintTrustedRep!, new Set()).native[0]?.host,
    base.invalidHintHost,
    'newly trusted Native URL remains selectable after lower-trust promotion',
  )
  const authoritySession = new SessionStore()
  authoritySession.beginGeneration(false)
  const authorityState = authoritySession.beginEpoch(),
    authorityStorage = new FakeStorage()
  const authoritySettings = base.scope.own(new SettingsStore(authorityStorage, () => base.now))
  await authoritySettings.update({ considerNativeSources: true })
  const authorityRestrictions = base.scope.own(
    new RestrictionStore(authorityStorage, () => base.now),
  )
  const authorityEvidence = base.scope.own(new EvidenceStore(authorityStorage, () => base.now))
  const plannedVault = new SignedRouteVault()
  plannedVault.reset(authorityState.generation, authorityState.epoch)
  const plannedRep = plannedVault.register({
    generation: authorityState.generation,
    epoch: authorityState.epoch,
    kind: 'video',
    key: '80:av1:1080',
    height: 1080,
    codec: 'av1',
    bandwidth: 4_000_000,
    urls: [base.hintedUrl],
    source: 'page-hint',
  })
  assert.ok(plannedRep, 'provisional route can be planned before the API arrives')
  const plannedRoutes = new RouteCoordinator(
    base.clock,
    authoritySession,
    authoritySettings,
    authorityRestrictions,
    authorityEvidence,
    plannedVault,
    createRuntimeIds(),
  )
  const plannedDemand = { kind: 'video' as const, requiredMbps: 8, highDemand: false }
  assert.strictEqual(
    plannedRep ? plannedRoutes.plan(plannedRep, plannedDemand, 'startup').host : null,
    'upos-hz-mirrorakam.akamaized.net',
    'provisional startup initially follows its signed root',
  )
  plannedRoutes.startupOptions(base.hintedUrl)?.candidates[0] ?? null
  plannedRep ? plannedRoutes.challenge(plannedRep, plannedDemand, false) : null
  const plannedAdapter = new PlayurlAdapter(
    new PlayurlController(authoritySession, plannedVault, plannedRoutes),
  )
  const trustedPayload = {
    data: {
      dash: {
        video: [
          {
            id: 80,
            height: 1080,
            codecs: 'av01',
            bandwidth: 4_000_000,
            base_url: base.trustedUrl,
            backup_url: [] as string[],
          },
        ],
        audio: [],
      },
    },
  }
  assert.ok(
    plannedAdapter.transform(trustedPayload, 'trusted-api').accepted,
    'trusted API playurl is adopted',
  )
  assert.strictEqual(
    plannedRep ? plannedVault.rootUrl(plannedRep) : null,
    base.trustedUrl,
    'trusted playurl replaces hint root in the live adapter',
  )
  assert.strictEqual(
    plannedRep ? plannedRoutes.plan(plannedRep, plannedDemand, 'startup').host : null,
    'upos-sz-mirrorali.bilivideo.com',
    'previous provisional plan is invalidated at trusted API adoption',
  )
}

test('signed route registered [1]', { timeout: 5000 }, async (t) => {
  await checkSignedRouteRegistered1(t)
})
test('late page hints cannot replace the trusted root [2]', { timeout: 5000 }, async (t) => {
  await checkLatePageHintsCannotReplaceTheTrustedRoot2(t)
})
test(
  'trusted API replaces invalidated provisional route on the same host [3]',
  { timeout: 5000 },
  async (t) => {
    await checkTrustedAPIReplacesInvalidatedProvisionalRouteOnTheSameHost3(t)
  },
)
test(
  'late lower-trust page hint does not rewrite or merge into trusted API output [4]',
  { timeout: 5000 },
  async (t) => {
    await checkLateLowerTrustPageHintDoesNotRewriteOrMergeInto(t)
  },
)
test(
  'late preflight result from the retired hint cannot create health evidence [5]',
  { timeout: 5000 },
  async (t) => {
    await checkLatePreflightResultFromTheRetiredHintCannotCreateHealthEvidence(t)
  },
)
test(
  'late challenger result from the retired hint cannot create health evidence [6]',
  { timeout: 5000 },
  async (t) => {
    await checkLateChallengerResultFromTheRetiredHintCannotCreateHealthEvidence(t)
  },
)
test(
  'retired page-hint transport does not punish its old host after API adoption [7]',
  { timeout: 5000 },
  async (t) => {
    await checkRetiredPageHintTransportDoesNotPunishItsOldHostAfter(t)
  },
)
test('exact signed route maps to current epoch [8]', { timeout: 5000 }, async (t) => {
  await checkExactSignedRouteMapsToCurrentEpoch8(t)
})
test('opaque handle resolves inside vault [9]', { timeout: 5000 }, async (t) => {
  await checkOpaqueHandleResolvesInsideVault9(t)
})
test('signed route never crosses generation [10]', { timeout: 5000 }, async (t) => {
  await checkSignedRouteNeverCrossesGeneration10(t)
})
test(
  'PCDN Catalog source handle resolves only the current exact signed URL [11]',
  { timeout: 5000 },
  async (t) => {
    await checkPCDNCatalogSourceHandleResolvesOnlyTheCurrentExactSignedURL(t)
  },
)
test('restriction applies to audio [12]', { timeout: 5000 }, async (t) => {
  await checkRestrictionAppliesToAudio12(t)
})
test(
  'existing schema 2 settings without Native toggle default on [13]',
  { timeout: 5000 },
  async (t) => {
    await checkExistingSchema2SettingsWithoutNativeToggleDefaultOn13(t)
  },
)
test(
  'other tab receives a Native-on setting with a future timestamp [14]',
  { timeout: 5000 },
  async (t) => {
    await checkOtherTabReceivesANativeOnSettingWithAFutureTimestamp(t)
  },
)
test(
  'Native-on page hint initially preserves its original URL [15]',
  { timeout: 5000 },
  async (t) => {
    await checkNativeOnPageHintInitiallyPreservesItsOriginalURL15(t)
  },
)
test(
  'mutated same-object trusted payload is re-sanitized despite an already-seen responseKey [16]',
  { timeout: 5000 },
  async (t) => {
    await checkMutatedSameObjectTrustedPayloadIsReSanitizedDespiteAnAlready(t)
  },
)
