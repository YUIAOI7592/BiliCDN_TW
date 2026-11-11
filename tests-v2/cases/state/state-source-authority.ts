import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { type TestContext } from 'node:test'
import { signedRouteHandle } from '../../../src-v2/domain/model.ts'
import { PlayurlController } from '../../../src-v2/application/playurl/playurl-controller.ts'
import { decisionId, epochId, generationId, requestId } from '../../../src-v2/domain/model.ts'
import { SignedRouteVault } from '../../../src-v2/state/signed-route-vault.ts'
import { RestrictionStore } from '../../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../../src-v2/state/evidence-store.ts'
import { SettingsStore } from '../../../src-v2/state/settings-store.ts'
import { SessionStore } from '../../../src-v2/state/session-store.ts'
import { RouteCoordinator } from '../../../src-v2/application/routing/route-coordinator.ts'
import { PlayurlAdapter } from '../../../src-v2/adapters/playurl/playurl.ts'
import { FakeStorage } from '../../support/storage.ts'
import { testScope } from '../../support/scope.ts'

// Named scenarios create only their prerequisite state; resources belong to this test.

async function createRoutingResources(t: TestContext) {
  const scope = testScope(t)
  const now = 2_000_000_000_000
  const clock = { now: () => now }
  const hintedUrl = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/hint.m4s?token=hint'
  const trustedUrl = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/api.m4s?token=api'
  const lateHintUrl = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/late.m4s?token=late'
  const authoritySession = new SessionStore()
  authoritySession.beginGeneration(false)
  const authorityState = authoritySession.beginEpoch()
  const authorityStorage = new FakeStorage()
  const authoritySettings = scope.own(new SettingsStore(authorityStorage, () => now))
  const authorityRestrictions = scope.own(new RestrictionStore(authorityStorage, () => now))
  const authorityEvidence = scope.own(new EvidenceStore(authorityStorage, () => now))
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
    urls: [hintedUrl],
    source: 'page-hint',
  })
  const plannedRoutes = new RouteCoordinator(
    clock,
    authoritySession,
    authoritySettings,
    authorityRestrictions,
    authorityEvidence,
    plannedVault,
    createRuntimeIds(),
  )
  const plannedDemand = { kind: 'video' as const, requiredMbps: 8, highDemand: false }
  return {
    now,
    hintedUrl,
    trustedUrl,
    lateHintUrl,
    authoritySession,
    authorityState,
    authorityEvidence,
    plannedVault,
    plannedRep,
    plannedRoutes,
    plannedDemand,
  }
}

async function createRouteStateResourcesGroup2(_t: TestContext) {
  const vault = new SignedRouteVault()
  const generation = generationId(1)
  const epoch = epochId(1)
  vault.reset(generation, epoch)
  const rep = vault.register({
    generation: generation,
    epoch: epoch,
    kind: 'video',
    key: '80:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 4_000_000,
    urls: ['https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/1.m4s?token=secret'],
    source: 'trusted-api',
  })
  return { vault, generation, epoch, rep }
}

async function createTrustedSourceReplacementResources(t: TestContext) {
  const scope = testScope(t)
  const now = 2_000_000_000_000
  const clock = { now: () => now }
  const generation = generationId(1)
  const epoch = epochId(1)
  const hintedUrl = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/hint.m4s?token=hint'
  const trustedUrl = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/api.m4s?token=api'
  const invalidHintVault = new SignedRouteVault()
  invalidHintVault.reset(generation, epoch)
  const invalidHintHost = 'upos-hz-mirrorakam.akamaized.net'
  const invalidHintRep = invalidHintVault.register({
    generation: generation,
    epoch: epoch,
    kind: 'video',
    key: '80:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 4_000_000,
    urls: [hintedUrl],
    source: 'page-hint',
  })
  assert.ok(invalidHintRep)
  invalidHintVault.invalidate(invalidHintRep, invalidHintHost)
  const sameHostTrustedUrl = `https://${invalidHintHost}/upgcxcode/a/b/trusted.m4s?token=trusted`
  const invalidHintTrustedRep = invalidHintVault.register({
    generation: generation,
    epoch: epoch,
    kind: 'video',
    key: '80:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 4_000_000,
    urls: [sameHostTrustedUrl],
    source: 'trusted-api',
  })
  return {
    clock,
    hintedUrl,
    invalidHintHost,
    invalidHintTrustedRep,
    invalidHintVault,
    now,
    scope,
    trustedUrl,
  }
}

async function createPromotedRouting(
  t: TestContext,
  pending: 'startup' | 'challenge' | 'transport' | 'late-hint',
) {
  const resources = await createRoutingResources(t)
  const {
    plannedRep,
    plannedRoutes,
    plannedDemand,
    hintedUrl,
    authoritySession,
    plannedVault,
    trustedUrl,
    lateHintUrl,
  } = resources
  assert.ok(plannedRep, 'provisional representation exists before promotion')
  const priorIdentity = plannedVault.identity(plannedRep)
  assert.ok(priorIdentity)
  plannedRoutes.plan(plannedRep, plannedDemand, 'startup')
  const staleStartup =
    pending === 'startup' ? plannedRoutes.startupOptions(hintedUrl)?.candidates[0] : undefined
  const staleChallenge =
    pending === 'challenge' ? plannedRoutes.challenge(plannedRep, plannedDemand, false) : undefined
  const plannedAdapter = new PlayurlAdapter(
    new PlayurlController(authoritySession, plannedVault, plannedRoutes),
  )
  const payload = (url: string) => ({
    data: {
      dash: {
        video: [
          {
            id: 80,
            height: 1080,
            codecs: 'av01',
            bandwidth: 4_000_000,
            base_url: url,
            backup_url: [] as string[],
          },
        ],
        audio: [],
      },
    },
  })
  assert.equal(plannedAdapter.transform(payload(trustedUrl), 'trusted-api').accepted, true)
  assert.equal(plannedVault.rootUrl(plannedRep), trustedUrl)
  assert.notEqual(plannedVault.identity(plannedRep), priorIdentity)
  const lateHintPayload = payload(lateHintUrl)
  plannedAdapter.transform(lateHintPayload, 'page-hint')
  return { ...resources, staleStartup, staleChallenge, lateHintPayload }
}

async function createExactSignedRouteMapsToCurrentEpoch8Context6(_t: TestContext) {
  const resources = await createRouteStateResourcesGroup2(_t)
  const { vault, epoch, generation, rep } = resources

  const context = vault.contextForUrl(
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/1.m4s?token=secret',
  )
  return {
    context,
    epoch,
    generation,
    rep,
    vault,
  }
}

async function createProtectedUrlContext7(t: TestContext) {
  const { vault, rep } = await createRouteStateResourcesGroup2(t)
  assert.ok(rep)
  const native = vault.candidates(rep, new Set()).native[0]
  return { native, rep, vault }
}

async function createSignedRouteNeverCrossesGeneration10Context8(t: TestContext) {
  const { vault, rep } = await createRouteStateResourcesGroup2(t)
  assert.ok(rep)
  const context = vault.contextForUrl(
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/1.m4s?token=secret',
  )
  const native = vault.candidates(rep, new Set()).native[0]
  assert.ok(context && native, 'current route is resolvable before generation reset')
  assert.equal(
    vault.resolve(native.handle, context),
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/1.m4s?token=secret',
  )
  vault.reset(generationId(2), epochId(0))
  return { context, native, vault }
}

async function createPCDNCatalogSourceHandleResolvesOnlyTheCurrentExactSignedURLContext9(
  _t: TestContext,
) {
  const vault = new SignedRouteVault()
  vault.reset(generationId(2), epochId(0))
  const pcdnUrl = 'https://x.szbdyd.com/a.m4s'
  const pcdnRep = vault.register({
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
  return {
    pcdnRep,
    pcdnUrl,
    vault,
  }
}

async function checkSignedRouteRegistered1(t: TestContext): Promise<void> {
  const base = await createRouteStateResourcesGroup2(t)

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
  const base = await createRouteStateResourcesGroup2(t)

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
}

async function checkPCDNCatalogSourceHandleResolvesOnlyTheCurrentExactSignedURL(
  t: TestContext,
): Promise<void> {
  const base = await createPCDNCatalogSourceHandleResolvesOnlyTheCurrentExactSignedURLContext9(t)

  assert.ok(base.pcdnRep, 'behavior requires its fixture prerequisites')
  {
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

  assert.ok(base.rep && base.native, 'behavior requires its fixture prerequisites')
  {
    assert.strictEqual(
      base.vault.resolve(base.native.handle, base.native.route),
      'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/1.m4s?token=secret',
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
  const base = await createPromotedRouting(t, 'transport')

  assert.ok(base.plannedRep, 'behavior requires its fixture prerequisites')
  {
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
  const base = await createPromotedRouting(t, 'challenge')

  assert.ok(base.staleChallenge, 'behavior requires its fixture prerequisites')
  {
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
  const base = await createPromotedRouting(t, 'late-hint')

  assert.strictEqual(
    base.lateHintPayload.data.dash.video[0]?.base_url,
    base.lateHintUrl,
    'late lower-trust page hint does not rewrite or merge into trusted API output',
  )
}

async function checkLatePreflightResultFromTheRetiredHintCannotCreateHealthEvidence(
  t: TestContext,
): Promise<void> {
  const base = await createPromotedRouting(t, 'startup')

  assert.ok(base.staleStartup, 'behavior requires its fixture prerequisites')
  {
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
  const base = await createTrustedSourceReplacementResources(t)

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
