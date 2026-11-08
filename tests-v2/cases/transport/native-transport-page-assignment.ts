import { CatalogSettingsStore } from '../../support/catalog-settings.ts'
import { installProgressEvent } from '../../support/progress-event.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { type TestContext } from 'node:test'
import { PlayurlController } from '../../../src-v2/application/playurl/playurl-controller.ts'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import { SignedRouteVault } from '../../../src-v2/state/signed-route-vault.ts'
import { RestrictionStore } from '../../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../../src-v2/state/evidence-store.ts'
import { SessionStore } from '../../../src-v2/state/session-store.ts'
import { RouteCoordinator } from '../../../src-v2/application/routing/route-coordinator.ts'
import { TransportAdapter } from '../../../src-v2/adapters/transport/transport.ts'
import { PlayurlAdapter } from '../../../src-v2/adapters/playurl/playurl.ts'
import { PagePlayinfoAdapter } from '../../../src-v2/adapters/playurl/page-playinfo.ts'
import { FakeStorage } from '../../support/storage.ts'
import { testScope } from '../../support/scope.ts'
import { createNativeTransportResources } from './native-transport-resources.ts'

async function createCappedThirdPartyBackupContext4(t: TestContext) {
  const scope = testScope(t)
  installProgressEvent(scope)
  const now = 2_000_000_000_000
  const clock = { now: () => now }
  const block1 = await createNativeTransportResources()
  const { fakeWindow, FakeXhr } = block1
  scope.defineGlobal('unsafeWindow', { configurable: true, value: fakeWindow })
  scope.defineGlobal('location', {
    configurable: true,
    value: new URL('https://www.bilibili.com/video/BVtest/'),
  })
  const measurementStub = {
    willGateStartup: (): boolean => false,
    prepareStartup: async (): Promise<void> => {},
    noteUnpreflighted(_reason: string): void {},
  }
  const emittedBackupStorage = new FakeStorage()
  const emittedBackupSettings = scope.own(new CatalogSettingsStore(emittedBackupStorage, () => now))
  const emittedBackupSession = new SessionStore()
  const emittedBackupState = emittedBackupSession.beginGeneration(false)
  const emittedBackupVault = new SignedRouteVault()
  emittedBackupVault.reset(emittedBackupState.generation, emittedBackupState.epoch)
  const emittedBackupRoutes = new RouteCoordinator(
    clock,
    emittedBackupSession,
    emittedBackupSettings,
    scope.own(new RestrictionStore(emittedBackupStorage, () => now)),
    scope.own(new EvidenceStore(emittedBackupStorage, () => now)),
    emittedBackupVault,
    createRuntimeIds(),
  )
  const emittedBackupPlayurl = new PlayurlAdapter(
    new PlayurlController(emittedBackupSession, emittedBackupVault, emittedBackupRoutes),
  )
  const emittedBackupRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/emitted-backup/root.m4s?signature=root'
  const emittedBackupTransport = scope.own(
    new TransportAdapter(
      emittedBackupSession,
      emittedBackupSettings,
      emittedBackupRoutes,
      emittedBackupPlayurl,
      measurementStub,
      () => now,
      createRuntimeIds(),
      undefined,
      () => now,
    ),
  )
  void emittedBackupVault.contextForUrl(emittedBackupRoot)?.representation
  const cappedThirdPartyBackup =
    'https://cdn.example.net/upgcxcode/emitted-backup/capped-final.m4s?signature=capped-old-backup'
  emittedBackupRoutes.invalidateForUserSetting()
  await fakeWindow.fetch(cappedThirdPartyBackup)
  const cappedBackupXhr = new FakeXhr()
  cappedBackupXhr.open('GET', cappedThirdPartyBackup)
  cappedBackupXhr.send()
  emittedBackupTransport.dispose()
  const pageStorage = new FakeStorage()
  const pageSettings = scope.own(new CatalogSettingsStore(pageStorage, () => now))
  const pageSession = new SessionStore()
  const pageState = pageSession.beginGeneration(false)
  const pageVault = new SignedRouteVault()
  pageVault.reset(pageState.generation, pageState.epoch)
  const pageRoutes = new RouteCoordinator(
    clock,
    pageSession,
    pageSettings,
    scope.own(new RestrictionStore(pageStorage, () => now)),
    scope.own(new EvidenceStore(pageStorage, () => now)),
    pageVault,
    createRuntimeIds(),
  )
  const pagePlayurl = new PlayurlAdapter(new PlayurlController(pageSession, pageVault, pageRoutes))
  const assignedAtSetter: string[] = []
  const assignedPayloadAtSetter: string[] = []
  let pageOwnedPlayinfo: unknown = undefined
  Object.defineProperty(fakeWindow, '__playinfo__', {
    configurable: true,
    get: () => pageOwnedPlayinfo,
    set: (value: unknown) => {
      const item = (value as { data?: { dash?: { video?: { base_url?: string }[] } } })?.data?.dash
        ?.video?.[0]
      assignedAtSetter.push(item?.base_url ?? '')
      assignedPayloadAtSetter.push(JSON.stringify(value))
      pageOwnedPlayinfo = value
    },
  })
  const pageInfo = scope.own(
    new PagePlayinfoAdapter(
      (payload) => pagePlayurl.transform(payload, 'page-hint').accepted,
      () => pageRoutes.isCatalogOnly(),
    ),
  )
  pageInfo.install()
  const earlyPageUrl =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/page-hint/early.m4s?signature=early'
  const earlyPagePayload = {
    data: {
      dash: {
        video: [
          {
            id: 80,
            codecid: 13,
            height: 1080,
            bandwidth: 1_000_000,
            base_url: earlyPageUrl,
            backup_url: [] as string[],
          },
        ],
        audio: [],
      },
    },
  }
  Reflect.set(fakeWindow, '__playinfo__', earlyPagePayload)
  const trustedPageUrl =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/page-hint/trusted.m4s?signature=trusted'
  const trustedPagePayload = {
    data: {
      dash: {
        video: [
          {
            id: 80,
            codecid: 13,
            height: 1080,
            bandwidth: 1_000_000,
            base_url: trustedPageUrl,
            backup_url: [] as string[],
          },
        ],
        audio: [],
      },
    },
  }
  pagePlayurl.transform(trustedPagePayload, 'trusted-api')
  const trustedPageRep = pageVault.contextForUrl(trustedPageUrl)?.representation
  const trustedPageOutput = trustedPagePayload.data.dash.video[0]?.base_url ?? ''
  const trustedOutputRole = trustedPageRep
    ? pageVault.outputRole(trustedPageRep, trustedPageOutput)
    : null
  const latePageUrl =
    'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/page-hint/late.m4s?signature=late'
  const latePagePayload = {
    data: {
      dash: {
        video: [
          {
            id: 80,
            codecid: 13,
            height: 1080,
            bandwidth: 1_000_000,
            base_url: latePageUrl,
            backup_url: [] as string[],
          },
        ],
        audio: [],
      },
    },
  }
  Reflect.set(fakeWindow, '__playinfo__', latePagePayload)
  return {
    assignedAtSetter,
    latePagePayload,
    latePageUrl,
    pageSession,
    pageVault,
    trustedOutputRole,
    trustedPageOutput,
    trustedPageRep,
    trustedPageUrl,
  }
}

async function createAffinityFixtureHasADifferentLegalCatalogHost6Context5(t: TestContext) {
  const scope = testScope(t)
  installProgressEvent(scope)
  const now = 2_000_000_000_000
  const clock = { now: () => now }
  const block1 = await createNativeTransportResources()
  const { fakeWindow } = block1
  scope.defineGlobal('unsafeWindow', { configurable: true, value: fakeWindow })
  scope.defineGlobal('location', {
    configurable: true,
    value: new URL('https://www.bilibili.com/video/BVtest/'),
  })
  const pageStorage = new FakeStorage()
  const pageSettings = scope.own(new CatalogSettingsStore(pageStorage, () => now))
  const pageSession = new SessionStore()
  const pageState = pageSession.beginGeneration(false)
  const pageVault = new SignedRouteVault()
  pageVault.reset(pageState.generation, pageState.epoch)
  const pageRoutes = new RouteCoordinator(
    clock,
    pageSession,
    pageSettings,
    scope.own(new RestrictionStore(pageStorage, () => now)),
    scope.own(new EvidenceStore(pageStorage, () => now)),
    pageVault,
    createRuntimeIds(),
  )
  const pagePlayurl = new PlayurlAdapter(new PlayurlController(pageSession, pageVault, pageRoutes))
  const assignedPayloadAtSetter: string[] = []
  const pageInfo = scope.own(
    new PagePlayinfoAdapter(
      (payload) => pagePlayurl.transform(payload, 'page-hint').accepted,
      () => pageRoutes.isCatalogOnly(),
    ),
  )
  const trustedPageUrl =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/page-hint/trusted.m4s?signature=trusted'
  const trustedPagePayload = {
    data: {
      dash: {
        video: [
          {
            id: 80,
            codecid: 13,
            height: 1080,
            bandwidth: 1_000_000,
            base_url: trustedPageUrl,
            backup_url: [] as string[],
          },
        ],
        audio: [],
      },
    },
  }
  const trustedPageRep = pageVault.contextForUrl(trustedPageUrl)?.representation
  const trustedPageOutput = trustedPagePayload.data.dash.video[0]?.base_url ?? ''
  void (trustedPageRep ? pageVault.outputRole(trustedPageRep, trustedPageOutput) : null)
  const affinityPageRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/page-hint/affinity.m4s?signature=affinity'
  const affinityPageRep = pageVault.register({
    generation: pageSession.get().generation,
    epoch: pageSession.get().epoch,
    kind: 'video',
    key: 'affinity:64',
    height: 720,
    codec: 'av1',
    bandwidth: 1_000_000,
    urls: [affinityPageRoot],
    source: 'trusted-api',
  })
  const affinityChoice = pageRoutes
    .startupOptions(affinityPageRoot)
    ?.candidates.find(
      (candidate) =>
        candidate.type === 'catalog-generated' &&
        candidate.host !== new URL(trustedPageOutput).host,
    )
  return {
    affinityChoice,
    affinityPageRep,
    affinityPageRoot,
    assignedPayloadAtSetter,
    fakeWindow,
    now,
    pageInfo,
    pagePlayurl,
    pageRoutes,
    pageSession,
    pageSettings,
    scope,
    trustedPageOutput,
  }
}

async function createCatalogOnlyPlayinfoAccessorGetterSanitizesEveryFreshUnsupportedNativeValueContext6(
  _t: TestContext,
) {
  const block1 = await createNativeTransportResources()
  const { fakeWindow } = block1
  return {
    fakeWindow,
  }
}

async function createNativeOnPlayinfoAccessorGetterPreservesFreshWebsiteValue8Context7(
  t: TestContext,
) {
  const scope = testScope(t)
  installProgressEvent(scope)
  const now = 2_000_000_000_000
  const clock = { now: () => now }
  const block1 = await createNativeTransportResources()
  const { fakeWindow } = block1
  scope.defineGlobal('unsafeWindow', { configurable: true, value: fakeWindow })
  scope.defineGlobal('location', {
    configurable: true,
    value: new URL('https://www.bilibili.com/video/BVtest/'),
  })
  const pageStorage = new FakeStorage()
  const pageSettings = scope.own(new CatalogSettingsStore(pageStorage, () => now))
  const pageSession = new SessionStore()
  const pageState = pageSession.beginGeneration(false)
  const pageVault = new SignedRouteVault()
  pageVault.reset(pageState.generation, pageState.epoch)
  const pageRoutes = new RouteCoordinator(
    clock,
    pageSession,
    pageSettings,
    scope.own(new RestrictionStore(pageStorage, () => now)),
    scope.own(new EvidenceStore(pageStorage, () => now)),
    pageVault,
    createRuntimeIds(),
  )
  const pagePlayurl = new PlayurlAdapter(new PlayurlController(pageSession, pageVault, pageRoutes))
  const pageInfo = scope.own(
    new PagePlayinfoAdapter(
      (payload) => pagePlayurl.transform(payload, 'page-hint').accepted,
      () => pageRoutes.isCatalogOnly(),
    ),
  )
  const trustedPageUrl =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/page-hint/trusted.m4s?signature=trusted'
  const trustedPagePayload = {
    data: {
      dash: {
        video: [
          {
            id: 80,
            codecid: 13,
            height: 1080,
            bandwidth: 1_000_000,
            base_url: trustedPageUrl,
            backup_url: [] as string[],
          },
        ],
        audio: [],
      },
    },
  }
  const trustedPageRep = pageVault.contextForUrl(trustedPageUrl)?.representation
  const trustedPageOutput = trustedPagePayload.data.dash.video[0]?.base_url ?? ''
  void (trustedPageRep ? pageVault.outputRole(trustedPageRep, trustedPageOutput) : null)
  const affinityPageRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/page-hint/affinity.m4s?signature=affinity'
  const affinityPageRep = pageVault.register({
    generation: pageSession.get().generation,
    epoch: pageSession.get().epoch,
    kind: 'video',
    key: 'affinity:64',
    height: 720,
    codec: 'av1',
    bandwidth: 1_000_000,
    urls: [affinityPageRoot],
    source: 'trusted-api',
  })
  const affinityChoice = pageRoutes
    .startupOptions(affinityPageRoot)
    ?.candidates.find(
      (candidate) =>
        candidate.type === 'catalog-generated' &&
        candidate.host !== new URL(trustedPageOutput).host,
    )
  pageRoutes.commitStartupChoice(affinityPageRoot, affinityChoice ?? null, 'test-observed-affinity')
  const affinityApplied = pageRoutes.apply(affinityPageRoot)
  for (let index = 0; index < 2; index++)
    await pageRoutes.observe({
      generation: pageSession.get().generation,
      epoch: pageSession.get().epoch,
      decisionId: affinityApplied.decision.id,
      representation: affinityPageRep,
      kind: 'video',
      routeType: 'catalog-generated',
      originalHost: new URL(affinityPageRoot).host,
      targetHost: affinityApplied.decision.host ?? '',
      finalHost: affinityApplied.decision.host,
      responseUrlMatchesRequest: true,
      streamKey: affinityApplied.streamKey,
      status: 206,
      bytes: 70 * 1024,
      ttfbMs: 20,
      elapsedMs: 100,
      completedAt: now + index + 1,
      outcome: 'success',
    })
  const unsupportedPageUrl =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/page-hint/unsupported.m4s?signature=unsupported-secret'
  const unsupportedPagePayload = { data: { durl: [{ url: unsupportedPageUrl }] } }
  Reflect.set(fakeWindow, '__playinfo__', unsupportedPagePayload)
  pageInfo.dispose()
  Reflect.deleteProperty(fakeWindow, '__playinfo__')
  const initialUnsupportedUrl =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/page-hint/initial.m4s?signature=initial-secret'
  const initialUnsupportedPlayinfo = { data: { durl: [{ url: initialUnsupportedUrl }] } }
  Object.defineProperty(fakeWindow, '__playinfo__', {
    configurable: true,
    writable: true,
    value: initialUnsupportedPlayinfo,
  })
  const initialPageInfo = scope.own(
    new PagePlayinfoAdapter(
      (payload) => pagePlayurl.transform(payload, 'page-hint').accepted,
      () => pageRoutes.isCatalogOnly(),
    ),
  )
  initialPageInfo.install()
  initialPageInfo.dispose()
  Reflect.deleteProperty(fakeWindow, '__playinfo__')
  pageRoutes.invalidateForUserSetting()
  Object.defineProperty(fakeWindow, '__playinfo__', {
    configurable: true,
    writable: true,
    value: initialUnsupportedPlayinfo,
  })
  const nativeOnInitialPageInfo = scope.own(
    new PagePlayinfoAdapter(
      (payload) => pagePlayurl.transform(payload, 'page-hint').accepted,
      () => pageRoutes.isCatalogOnly(),
    ),
  )
  nativeOnInitialPageInfo.install()
  nativeOnInitialPageInfo.dispose()
  Reflect.deleteProperty(fakeWindow, '__playinfo__')
  pageRoutes.invalidateForUserSetting()
  let freshPlayinfoReads = 0
  Object.defineProperty(fakeWindow, '__playinfo__', {
    configurable: true,
    get: () => ({
      data: {
        durl: [
          {
            url: `https://upos-hz-mirrorakam.akamaized.net/upgcxcode/page-hint/fresh.m4s?signature=fresh-${++freshPlayinfoReads}`,
          },
        ],
      },
    }),
  })
  const freshPageInfo = scope.own(
    new PagePlayinfoAdapter(
      (payload) => pagePlayurl.transform(payload, 'page-hint').accepted,
      () => pageRoutes.isCatalogOnly(),
    ),
  )
  freshPageInfo.install()
  await pageSettings.update({ considerNativeSources: true })
  pageRoutes.invalidateForUserSetting()
  return {
    fakeWindow,
  }
}

async function checkNativeOnPlayinfoAccessorGetterPreservesFreshWebsiteValue8(
  t: TestContext,
): Promise<void> {
  const base = await createNativeOnPlayinfoAccessorGetterPreservesFreshWebsiteValue8Context7(t)

  assert.ok(
    JSON.stringify(Reflect.get(base.fakeWindow, '__playinfo__'))?.includes('signature=fresh-'),
    'Native-on __playinfo__ accessor getter preserves fresh website value',
  )
}

async function checkCatalogOnlyPlayinfoAccessorGetterSanitizesEveryFreshUnsupportedNativeValue(
  t: TestContext,
): Promise<void> {
  const base =
    await createCatalogOnlyPlayinfoAccessorGetterSanitizesEveryFreshUnsupportedNativeValueContext6(
      t,
    )

  for (let read = 0; read < 2; read++) {
    assert.ok(
      !JSON.stringify(Reflect.get(base.fakeWindow, '__playinfo__'))?.includes('signature=fresh-'),
      'Catalog-only __playinfo__ accessor getter sanitizes every fresh unsupported Native value',
    )
  }
}

async function checkAffinityFixtureHasADifferentLegalCatalogHost6(t: TestContext): Promise<void> {
  const base = await createAffinityFixtureHasADifferentLegalCatalogHost6Context5(t)

  assert.ok(base.affinityChoice, 'affinity fixture has a different legal Catalog host')
  base.pageRoutes.commitStartupChoice(
    base.affinityPageRoot,
    base.affinityChoice ?? null,
    'test-observed-affinity',
  )
  const affinityApplied = base.pageRoutes.apply(base.affinityPageRoot)
  assert.strictEqual(
    affinityApplied.decision.host,
    base.affinityChoice?.host,
    'separate representation sends its selected Catalog host',
  )
  for (let index = 0; index < 2; index++)
    await base.pageRoutes.observe({
      generation: base.pageSession.get().generation,
      epoch: base.pageSession.get().epoch,
      decisionId: affinityApplied.decision.id,
      representation: base.affinityPageRep,
      kind: 'video',
      routeType: 'catalog-generated',
      originalHost: new URL(base.affinityPageRoot).host,
      targetHost: affinityApplied.decision.host ?? '',
      finalHost: affinityApplied.decision.host,
      responseUrlMatchesRequest: true,
      streamKey: affinityApplied.streamKey,
      status: 206,
      bytes: 70 * 1024,
      ttfbMs: 20,
      elapsedMs: 100,
      completedAt: base.now + index + 1,
      outcome: 'success',
    })
  assert.strictEqual(
    base.pageSession.get().affinity?.host,
    base.affinityChoice?.host,
    'two observed requests confirm a different Catalog affinity',
  )
  assert.strictEqual(
    base.pageRoutes.apply(base.trustedPageOutput).decision.host,
    base.affinityChoice?.host,
    'sanitizing late page hint does not consume the trusted representation first-use affinity decision',
  )
  const unsupportedPageUrl =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/page-hint/unsupported.m4s?signature=unsupported-secret'
  const unsupportedPagePayload = { data: { durl: [{ url: unsupportedPageUrl }] } }
  Reflect.set(base.fakeWindow, '__playinfo__', unsupportedPagePayload)
  assert.ok(
    !base.assignedPayloadAtSetter.at(-1)?.includes('signature=unsupported-secret'),
    'Catalog-only configurable page setter never receives raw signed URL from non-DASH playinfo',
  )
  base.pageInfo.dispose()
  Reflect.deleteProperty(base.fakeWindow, '__playinfo__')
  const initialUnsupportedUrl =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/page-hint/initial.m4s?signature=initial-secret'
  const initialUnsupportedPlayinfo = {
    data: { durl: [{ url: initialUnsupportedUrl }] },
  }
  Object.defineProperty(base.fakeWindow, '__playinfo__', {
    configurable: true,
    writable: true,
    value: initialUnsupportedPlayinfo,
  })
  const initialPageInfo = base.scope.own(
    new PagePlayinfoAdapter(
      (payload) => base.pagePlayurl.transform(payload, 'page-hint').accepted,
      () => base.pageRoutes.isCatalogOnly(),
    ),
  )
  initialPageInfo.install()
  assert.ok(
    !JSON.stringify(Reflect.get(base.fakeWindow, '__playinfo__'))?.includes(
      'signature=initial-secret',
    ),
    'Catalog-only installed __playinfo__ getter cannot expose an existing unsupported Native playinfo value',
  )
  initialPageInfo.dispose()
  Reflect.deleteProperty(base.fakeWindow, '__playinfo__')
  await base.pageSettings.update({ considerNativeSources: true })
  base.pageRoutes.invalidateForUserSetting()
  Object.defineProperty(base.fakeWindow, '__playinfo__', {
    configurable: true,
    writable: true,
    value: initialUnsupportedPlayinfo,
  })
  const nativeOnInitialPageInfo = base.scope.own(
    new PagePlayinfoAdapter(
      (payload) => base.pagePlayurl.transform(payload, 'page-hint').accepted,
      () => base.pageRoutes.isCatalogOnly(),
    ),
  )
  nativeOnInitialPageInfo.install()
  assert.strictEqual(
    Reflect.get(base.fakeWindow, '__playinfo__'),
    initialUnsupportedPlayinfo,
    'Native-on installed __playinfo__ getter preserves an existing unsupported website value',
  )
}

async function checkLatePageHintSetterSynchronouslyReceivesACatalogURLAfterTrusted(
  t: TestContext,
): Promise<void> {
  const base = await createCappedThirdPartyBackupContext4(t)

  assert.ok(
    TRUSTED_CATALOG.includes(
      new URL(base.assignedAtSetter.at(-1) ?? '').host as (typeof TRUSTED_CATALOG)[number],
    ),
    'late page-hint setter synchronously receives a Catalog URL after trusted API adoption',
  )
  assert.ok(
    base.latePagePayload.data.dash.video[0]?.base_url !== base.latePageUrl,
    'late lower-trust hint is sanitized in its own object before page consumption',
  )
  assert.strictEqual(
    base.latePagePayload.data.dash.video[0]?.base_url,
    base.trustedPageOutput,
    'late hint reuses the existing trusted Catalog output URL',
  )
  const roleAfterLateHint = base.trustedPageRep
    ? base.pageVault.outputRole(base.trustedPageRep, base.trustedPageOutput)
    : null
  assert.strictEqual(
    roleAfterLateHint?.source,
    base.trustedOutputRole?.source,
    'late page hint cannot replace trusted API output source for the same Catalog URL',
  )
  assert.strictEqual(
    roleAfterLateHint?.decisionId,
    base.trustedOutputRole?.decisionId,
    'late page hint cannot replace trusted API output decision for the same Catalog URL',
  )
  assert.strictEqual(
    base.trustedPageRep ? base.pageVault.rootUrl(base.trustedPageRep) : null,
    base.trustedPageUrl,
    'late hint cannot replace trusted API root authority',
  )
  assert.ok(
    !base.trustedPageRep ||
      !base.pageVault
        .candidates(base.trustedPageRep, new Set())
        .native.some((route) => route.host === new URL(base.latePageUrl).host),
    'sanitizing late page hint grants no new Native candidate',
  )
  const affinityPageRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/page-hint/affinity.m4s?signature=affinity'
  const affinityPageRep = base.pageVault.register({
    generation: base.pageSession.get().generation,
    epoch: base.pageSession.get().epoch,
    kind: 'video',
    key: 'affinity:64',
    height: 720,
    codec: 'av1',
    bandwidth: 1_000_000,
    urls: [affinityPageRoot],
    source: 'trusted-api',
  })
  assert.ok(affinityPageRep, 'separate video representation can establish observed affinity')
}

test(
  'late page-hint setter synchronously receives a Catalog URL after trusted API adoption [5]',
  { timeout: 5000 },
  async (t) => {
    await checkLatePageHintSetterSynchronouslyReceivesACatalogURLAfterTrusted(t)
  },
)

test('affinity fixture has a different legal Catalog host [6]', { timeout: 5000 }, async (t) => {
  await checkAffinityFixtureHasADifferentLegalCatalogHost6(t)
})

test(
  'Catalog-only __playinfo__ accessor getter sanitizes every fresh unsupported Native value [7]',
  { timeout: 5000 },
  async (t) => {
    await checkCatalogOnlyPlayinfoAccessorGetterSanitizesEveryFreshUnsupportedNativeValue(t)
  },
)

test(
  'Native-on __playinfo__ accessor getter preserves fresh website value [8]',
  { timeout: 5000 },
  async (t) => {
    await checkNativeOnPlayinfoAccessorGetterPreservesFreshWebsiteValue8(t)
  },
)
