import { CatalogSettingsStore } from '../../support/catalog-settings.ts'
import { installProgressEvent } from '../../support/progress-event.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { deferred } from '../../support/deferred.ts'
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

async function createDispatchStorageAnddispatchSettingsContext1(t: TestContext) {
  const scope = testScope(t)
  installProgressEvent(scope)
  const now = 2_000_000_000_000
  const clock = { now: () => now }
  const block1 = await createNativeTransportResources()
  const { fakeWindow, FakeXhr, nativeFetchRedirects, nativeFetchUrls } = block1
  scope.defineGlobal('unsafeWindow', { configurable: true, value: fakeWindow })
  scope.defineGlobal('location', {
    configurable: true,
    value: new URL('https://www.bilibili.com/video/BVtest/'),
  })
  const dispatchStorage = new FakeStorage()
  const dispatchSettings = scope.own(new CatalogSettingsStore(dispatchStorage, () => now))
  const dispatchSession = new SessionStore()
  const dispatchState = dispatchSession.beginGeneration(false)
  const dispatchVault = new SignedRouteVault()
  dispatchVault.reset(dispatchState.generation, dispatchState.epoch)
  const dispatchEvidence = scope.own(new EvidenceStore(dispatchStorage, () => now))
  const dispatchRoutes = new RouteCoordinator(
    clock,
    dispatchSession,
    dispatchSettings,
    scope.own(new RestrictionStore(dispatchStorage, () => now)),
    dispatchEvidence,
    dispatchVault,
    createRuntimeIds(),
  )
  const dispatchPlayurl = new PlayurlAdapter(
    new PlayurlController(dispatchSession, dispatchVault, dispatchRoutes),
  )
  const dispatchRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/dispatch/video.m4s?signature=private'
  const dispatchNativeBackup =
    'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/dispatch/video.m4s?signature=backup'
  const dispatchItem = {
    id: 80,
    codecid: 13,
    height: 1080,
    bandwidth: 1_000_000,
    base_url: dispatchRoot,
    backup_url: [dispatchNativeBackup],
  }
  dispatchPlayurl.transform({ data: { dash: { video: [dispatchItem], audio: [] } } })
  let gateDispatch = true
  const dispatchGate: { release: () => void; done: Promise<void> } = {
    release: () => undefined,
    done: Promise.resolve(),
  }
  const dispatchMeasurement = {
    willGateStartup: () => gateDispatch,
    prepareStartup: (): Promise<void> => {
      const done = deferred<void>()
      dispatchGate.done = done.promise
      dispatchGate.release = () => done.resolve()
      return done.promise
    },
    noteUnpreflighted: (_reason: string): void => undefined,
  }
  const dispatchTransport = scope.own(
    new TransportAdapter(
      dispatchSession,
      dispatchSettings,
      dispatchRoutes,
      dispatchPlayurl,
      dispatchMeasurement,
      () => now,
      createRuntimeIds(),
      undefined,
      () => now,
    ),
  )
  dispatchTransport.install()
  return {
    FakeXhr,
    dispatchEvidence,
    dispatchGate,
    dispatchNativeBackup,
    dispatchRoot,
    dispatchRoutes,
    dispatchSession,
    dispatchSettings,
    dispatchTransport,
    dispatchVault,
    fakeWindow,
    get gateDispatch() {
      return gateDispatch
    },
    set gateDispatch(value: typeof gateDispatch) {
      gateDispatch = value
    },
    get nativeFetchCalls() {
      return block1.nativeFetchCalls
    },
    set nativeFetchCalls(value: typeof block1.nativeFetchCalls) {
      block1.nativeFetchCalls = value
    },
    nativeFetchRedirects,
    nativeFetchUrls,
  }
}

async function createMeasurementStubContext2(t: TestContext) {
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
  const dispatchStorage = new FakeStorage()
  const dispatchSettings = scope.own(new CatalogSettingsStore(dispatchStorage, () => now))
  const dispatchSession = new SessionStore()
  const dispatchState = dispatchSession.beginGeneration(false)
  const dispatchVault = new SignedRouteVault()
  dispatchVault.reset(dispatchState.generation, dispatchState.epoch)
  const dispatchEvidence = scope.own(new EvidenceStore(dispatchStorage, () => now))
  const dispatchRoutes = new RouteCoordinator(
    clock,
    dispatchSession,
    dispatchSettings,
    scope.own(new RestrictionStore(dispatchStorage, () => now)),
    dispatchEvidence,
    dispatchVault,
    createRuntimeIds(),
  )
  const dispatchPlayurl = new PlayurlAdapter(
    new PlayurlController(dispatchSession, dispatchVault, dispatchRoutes),
  )
  const dispatchRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/dispatch/video.m4s?signature=private'
  const dispatchNativeBackup =
    'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/dispatch/video.m4s?signature=backup'
  const dispatchItem = {
    id: 80,
    codecid: 13,
    height: 1080,
    bandwidth: 1_000_000,
    base_url: dispatchRoot,
    backup_url: [dispatchNativeBackup],
  }
  dispatchPlayurl.transform({ data: { dash: { video: [dispatchItem], audio: [] } } })
  let gateDispatch = true
  const dispatchGate: { release: () => void; done: Promise<void> } = {
    release: () => undefined,
    done: Promise.resolve(),
  }
  const dispatchMeasurement = {
    willGateStartup: () => gateDispatch,
    prepareStartup: (): Promise<void> => {
      const done = deferred<void>()
      dispatchGate.done = done.promise
      dispatchGate.release = () => done.resolve()
      return done.promise
    },
    noteUnpreflighted: (_reason: string): void => undefined,
  }
  const dispatchTransport = scope.own(
    new TransportAdapter(
      dispatchSession,
      dispatchSettings,
      dispatchRoutes,
      dispatchPlayurl,
      dispatchMeasurement,
      () => now,
      createRuntimeIds(),
      undefined,
      () => now,
    ),
  )
  dispatchTransport.install()
  dispatchRoutes.invalidateForUserSetting()
  const pendingToggleXhr = new FakeXhr()
  pendingToggleXhr.open('GET', dispatchRoot)
  pendingToggleXhr.send()
  dispatchRoutes.invalidateForUserSetting()
  dispatchGate.release()
  await dispatchGate.done
  gateDispatch = false
  await fakeWindow.fetch(dispatchRoot, { method: 'POST' }).then(
    () => {
      throw new Error('Catalog-only POST Fetch must reject locally')
    },
    () => undefined,
  )
  void (await fakeWindow.fetch(dispatchNativeBackup))
  const blockedPostXhr = new FakeXhr()
  blockedPostXhr.open('POST', dispatchRoot)
  blockedPostXhr.send()
  const catalogXhr = new FakeXhr()
  catalogXhr.open('GET', dispatchRoot)
  catalogXhr.send()
  const redirectedXhr = new FakeXhr()
  redirectedXhr.finalResponseUrl = dispatchRoot
  redirectedXhr.open('GET', dispatchRoot)
  redirectedXhr.send()
  await Promise.resolve()
  dispatchRoutes.invalidateForUserSetting()
  const staleOpaqueUrl =
    'https://upos-hz-mirrorakam.akamaized.net/opaque/stale-audio?signature=private'
  dispatchVault.register({
    generation: dispatchSession.get().generation,
    epoch: dispatchSession.get().epoch,
    kind: 'audio',
    key: 'stale-opaque',
    height: 0,
    codec: 'other',
    bandwidth: 192_000,
    urls: [staleOpaqueUrl],
    source: 'trusted-api',
  })
  const staleOpaqueXhr = new FakeXhr()
  staleOpaqueXhr.open('GET', staleOpaqueUrl)
  dispatchRoutes.invalidateForUserSetting()
  const nextDispatchState = dispatchSession.beginGeneration(false)
  dispatchVault.reset(nextDispatchState.generation, nextDispatchState.epoch)
  dispatchRoutes.resetEpoch()
  staleOpaqueXhr.send()
  const disabledDispatch = new FakeXhr()
  disabledDispatch.open('GET', dispatchRoot)
  disabledDispatch.send()
  dispatchTransport.dispose()
  const emittedBackupStorage = new FakeStorage()
  const emittedBackupSettings = scope.own(new CatalogSettingsStore(emittedBackupStorage, () => now))
  await emittedBackupSettings.update({ considerNativeSources: true })
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
  const emittedThirdPartyBackup =
    'https://cdn.example.net/upgcxcode/emitted-backup/final.m4s?signature=old-player-backup'
  return {
    FakeXhr,
    emittedBackupPlayurl,
    emittedBackupRoot,
    emittedBackupRoutes,
    emittedBackupSession,
    emittedBackupSettings,
    emittedBackupVault,
    emittedThirdPartyBackup,
    fakeWindow,
    measurementStub,
    get nativeFetchCalls() {
      return block1.nativeFetchCalls
    },
    set nativeFetchCalls(value: typeof block1.nativeFetchCalls) {
      block1.nativeFetchCalls = value
    },
    now,
    scope,
  }
}

async function createEmittedBackupTransportContext3(t: TestContext) {
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
  return {
    FakeXhr,
    clock,
    emittedBackupPlayurl,
    emittedBackupRoutes,
    emittedBackupSettings,
    emittedBackupTransport,
    fakeWindow,
    get nativeFetchCalls() {
      return block1.nativeFetchCalls
    },
    set nativeFetchCalls(value: typeof block1.nativeFetchCalls) {
      block1.nativeFetchCalls = value
    },
    now,
    scope,
  }
}

async function checkCatalogOnlyDispatchFixtureInstallsFetchAndXHRHooks1(
  t: TestContext,
): Promise<void> {
  const base = await createDispatchStorageAnddispatchSettingsContext1(t)

  assert.strictEqual(
    base.dispatchTransport.snapshot().hookState,
    'installed',
    'Catalog-only dispatch fixture installs Fetch and XHR hooks',
  )
  const beforeToggleFetch = base.nativeFetchCalls
  const pendingToggleFetch = base.fakeWindow.fetch(base.dispatchRoot)
  assert.strictEqual(
    base.nativeFetchCalls,
    beforeToggleFetch,
    'Native-on Fetch can wait for startup before send',
  )
  await base.dispatchSettings.update({ considerNativeSources: false })
  base.dispatchRoutes.invalidateForUserSetting()
  base.dispatchGate.release()
  await pendingToggleFetch
  assert.ok(
    TRUSTED_CATALOG.includes(
      new URL(base.nativeFetchUrls.at(-1) ?? '').host as (typeof TRUSTED_CATALOG)[number],
    ),
    'Fetch rechecks Catalog-only mode after startup wait before native send',
  )
  assert.strictEqual(
    base.nativeFetchRedirects.at(-1),
    'error',
    'Catalog-only Fetch media request rejects redirects',
  )
  await base.dispatchSettings.update({ considerNativeSources: true })
  base.dispatchRoutes.invalidateForUserSetting()
  const pendingToggleXhr = new base.FakeXhr()
  pendingToggleXhr.open('GET', base.dispatchRoot)
  pendingToggleXhr.send()
  assert.strictEqual(
    pendingToggleXhr.nativeSends,
    0,
    'Native-on XHR can wait for startup before send',
  )
  await base.dispatchSettings.update({ considerNativeSources: false })
  base.dispatchRoutes.invalidateForUserSetting()
  base.dispatchGate.release()
  await base.dispatchGate.done
  assert.strictEqual(
    pendingToggleXhr.nativeSends,
    1,
    'XHR waiting across Native switch still sends only once',
  )
  assert.ok(
    TRUSTED_CATALOG.includes(
      new URL(pendingToggleXhr.url).host as (typeof TRUSTED_CATALOG)[number],
    ),
    'XHR rechecks Catalog-only mode after startup wait before native send',
  )
  base.gateDispatch = false
  const beforeNonGetFetch = base.nativeFetchCalls
  await base.fakeWindow.fetch(base.dispatchRoot, { method: 'POST' }).then(
    () => {
      throw new Error('Catalog-only POST Fetch must reject locally')
    },
    () => undefined,
  )
  assert.strictEqual(
    base.nativeFetchCalls,
    beforeNonGetFetch,
    'Catalog-only non-GET Fetch never reaches native fetch',
  )
}

async function checkOldNativePlayerBackupIsRecheckedAtFetchDispatch2(
  t: TestContext,
): Promise<void> {
  const base = await createDispatchStorageAnddispatchSettingsContext1(t)

  const pendingToggleFetch = base.fakeWindow.fetch(base.dispatchRoot)
  await base.dispatchSettings.update({ considerNativeSources: false })
  base.dispatchRoutes.invalidateForUserSetting()
  base.dispatchGate.release()
  await pendingToggleFetch
  await base.dispatchSettings.update({ considerNativeSources: true })
  base.dispatchRoutes.invalidateForUserSetting()
  const pendingToggleXhr = new base.FakeXhr()
  pendingToggleXhr.open('GET', base.dispatchRoot)
  pendingToggleXhr.send()
  await base.dispatchSettings.update({ considerNativeSources: false })
  base.dispatchRoutes.invalidateForUserSetting()
  base.dispatchGate.release()
  await base.dispatchGate.done
  base.gateDispatch = false
  await base.fakeWindow.fetch(base.dispatchRoot, { method: 'POST' }).then(
    () => {
      throw new Error('Catalog-only POST Fetch must reject locally')
    },
    () => undefined,
  )
  const directCatalogFetch = await base.fakeWindow.fetch(base.dispatchNativeBackup)

  assert.ok(
    directCatalogFetch.status === 206 &&
      TRUSTED_CATALOG.includes(
        new URL(base.nativeFetchUrls.at(-1) ?? '').host as (typeof TRUSTED_CATALOG)[number],
      ),
    'old Native player backup is rechecked at Fetch dispatch',
  )
  assert.strictEqual(
    base.nativeFetchRedirects.at(-1),
    'error',
    'old player backup Fetch also rejects redirects',
  )
  const blockedPostXhr = new base.FakeXhr()
  blockedPostXhr.open('POST', base.dispatchRoot)
  blockedPostXhr.send()
  assert.strictEqual(
    blockedPostXhr.nativeSends,
    0,
    'Catalog-only non-GET XHR never reaches native send',
  )
  const catalogXhr = new base.FakeXhr()
  catalogXhr.open('GET', base.dispatchRoot)
  catalogXhr.send()
  assert.strictEqual(catalogXhr.nativeSends, 1, 'Catalog-only XHR sends once')
  assert.ok(
    TRUSTED_CATALOG.includes(new URL(catalogXhr.url).host as (typeof TRUSTED_CATALOG)[number]),
    'Catalog-only XHR checks its final native send URL',
  )
  const redirectedXhr = new base.FakeXhr()
  redirectedXhr.finalResponseUrl = base.dispatchRoot
  redirectedXhr.open('GET', base.dispatchRoot)
  redirectedXhr.send()
  await Promise.resolve()
  assert.strictEqual(
    base.dispatchEvidence.get(new URL(base.dispatchRoot).host, 'video'),
    null,
    'XHR response on a non-Catalog host does not establish successful Native health',
  )
  await base.dispatchSettings.update({ considerNativeSources: true })
  base.dispatchRoutes.invalidateForUserSetting()
  const staleOpaqueUrl =
    'https://upos-hz-mirrorakam.akamaized.net/opaque/stale-audio?signature=private'
  base.dispatchVault.register({
    generation: base.dispatchSession.get().generation,
    epoch: base.dispatchSession.get().epoch,
    kind: 'audio',
    key: 'stale-opaque',
    height: 0,
    codec: 'other',
    bandwidth: 192_000,
    urls: [staleOpaqueUrl],
    source: 'trusted-api',
  })
  const staleOpaqueXhr = new base.FakeXhr()
  staleOpaqueXhr.open('GET', staleOpaqueUrl)
  await base.dispatchSettings.update({ considerNativeSources: false })
  base.dispatchRoutes.invalidateForUserSetting()
  const nextDispatchState = base.dispatchSession.beginGeneration(false)
  base.dispatchVault.reset(nextDispatchState.generation, nextDispatchState.epoch)
  base.dispatchRoutes.resetEpoch()
  staleOpaqueXhr.send()
  assert.strictEqual(
    staleOpaqueXhr.nativeSends,
    0,
    'XHR opened for opaque Native media cannot leak after Catalog-only switch and SPA generation reset',
  )
  await base.dispatchSettings.update({ disabled: true })
  const disabledDispatch = new base.FakeXhr()
  disabledDispatch.open('GET', base.dispatchRoot)
  disabledDispatch.send()
  assert.strictEqual(
    disabledDispatch.url,
    base.dispatchRoot,
    'disabled script preserves website Native XHR URL',
  )
  assert.strictEqual(disabledDispatch.nativeSends, 1, 'disabled script still sends website XHR')
}

async function checkNativeOnOutputCapFixtureAcceptsAnotherRepresentationInTheCurrent(
  t: TestContext,
): Promise<void> {
  const base = await createEmittedBackupTransportContext3(t)

  const cappedBackupRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/emitted-backup/capped-root.m4s?signature=capped-root'
  const cappedThirdPartyBackup =
    'https://cdn.example.net/upgcxcode/emitted-backup/capped-final.m4s?signature=capped-old-backup'
  const cappedBackupItem = {
    id: 90,
    codecid: 13,
    height: 720,
    bandwidth: 1_000_000,
    base_url: cappedBackupRoot,
    backup_url: [
      'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/emitted-backup/capped-first.m4s?signature=first',
      'https://upos-sz-mirroralib.bilivideo.com/upgcxcode/emitted-backup/capped-second.m4s?signature=second',
      'https://upos-sz-mirrorali02.bilivideo.com/upgcxcode/emitted-backup/capped-third.m4s?signature=third',
      cappedThirdPartyBackup,
    ],
  }

  assert.ok(
    base.emittedBackupPlayurl.transform(
      { data: { dash: { video: [cappedBackupItem], audio: [] } } },
      'trusted-api',
    ).accepted,
    'Native-on output-cap fixture accepts another representation in the current epoch',
  )
  assert.ok(
    !cappedBackupItem.backup_url.includes(cappedThirdPartyBackup),
    'Native-on player omits an external backup that bounded provenance indexes cannot retain',
  )
  await base.emittedBackupSettings.update({ considerNativeSources: false })
  base.emittedBackupRoutes.invalidateForUserSetting()
  const beforeCappedBackupFetch = base.nativeFetchCalls
  await base.fakeWindow.fetch(cappedThirdPartyBackup)
  assert.strictEqual(
    base.nativeFetchCalls,
    beforeCappedBackupFetch + 1,
    'a backup withheld from player output remains an unattributable third-party website request',
  )
  const cappedBackupXhr = new base.FakeXhr()
  cappedBackupXhr.open('GET', cappedThirdPartyBackup)
  cappedBackupXhr.send()
  assert.strictEqual(
    cappedBackupXhr.nativeSends,
    1,
    'XHR also leaves an unattributable third-party website request unchanged',
  )
  base.emittedBackupTransport.dispose()
  const pageStorage = new FakeStorage(),
    pageSettings = base.scope.own(new CatalogSettingsStore(pageStorage, () => base.now))
  const pageSession = new SessionStore(),
    pageState = pageSession.beginGeneration(false)
  const pageVault = new SignedRouteVault()
  pageVault.reset(pageState.generation, pageState.epoch)
  const pageRoutes = new RouteCoordinator(
    base.clock,
    pageSession,
    pageSettings,
    base.scope.own(new RestrictionStore(pageStorage, () => base.now)),
    base.scope.own(new EvidenceStore(pageStorage, () => base.now)),
    pageVault,
    createRuntimeIds(),
  )
  const pagePlayurl = new PlayurlAdapter(new PlayurlController(pageSession, pageVault, pageRoutes))
  const assignedAtSetter: string[] = []
  const assignedPayloadAtSetter: string[] = []
  let pageOwnedPlayinfo: unknown = undefined
  Object.defineProperty(base.fakeWindow, '__playinfo__', {
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
  const pageInfo = base.scope.own(
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
  Reflect.set(base.fakeWindow, '__playinfo__', earlyPagePayload)
  assert.ok(
    TRUSTED_CATALOG.includes(
      new URL(assignedAtSetter.at(-1) ?? '').host as (typeof TRUSTED_CATALOG)[number],
    ),
    'page-owned configurable setter synchronously receives Catalog-rewritten playinfo in OFF mode',
  )
  assert.strictEqual(
    assignedAtSetter.at(-1),
    earlyPagePayload.data.dash.video[0]?.base_url,
    'setter observes the same sanitized page-hint payload that remains on the page',
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
  pagePlayurl.transform(trustedPagePayload, 'trusted-api')
  const trustedPageRep = pageVault.contextForUrl(trustedPageUrl)?.representation
  assert.ok(trustedPageRep, 'trusted API adopts the page-hint representation')
  const trustedPageOutput = trustedPagePayload.data.dash.video[0]?.base_url ?? ''
  const trustedOutputRole = trustedPageRep
    ? pageVault.outputRole(trustedPageRep, trustedPageOutput)
    : null
  assert.strictEqual(
    trustedOutputRole?.source,
    'trusted-api',
    'trusted Catalog output records API provenance before later hints',
  )
}

async function checkNativeOnPlayurlFixtureAcceptsPrimaryPlusFourBackups3(
  t: TestContext,
): Promise<void> {
  const base = await createMeasurementStubContext2(t)

  const emittedBackupItem = {
    id: 80,
    codecid: 13,
    height: 1080,
    bandwidth: 1_000_000,
    base_url: base.emittedBackupRoot,
    backup_url: [
      'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/emitted-backup/first.m4s?signature=first',
      'https://upos-sz-mirroralib.bilivideo.com/upgcxcode/emitted-backup/second.m4s?signature=second',
      base.emittedThirdPartyBackup,
      'https://upos-sz-mirrorali02.bilivideo.com/upgcxcode/emitted-backup/third.m4s?signature=third',
    ],
  }

  assert.ok(
    base.emittedBackupPlayurl.transform(
      { data: { dash: { video: [emittedBackupItem], audio: [] } } },
      'trusted-api',
    ).accepted,
    'Native-on playurl fixture accepts primary plus four backups',
  )
  assert.ok(
    emittedBackupItem.backup_url.includes(base.emittedThirdPartyBackup),
    'Native-on player output can emit an admitted signed route on an arbitrary host',
  )
  const current = base.emittedBackupVault.contextForUrl(base.emittedBackupRoot)!
  assert.equal(base.emittedBackupVault.sourceURLs(current.representation).length, 4)
  assert.ok(
    base.emittedBackupVault
      .sourceURLs(current.representation)
      .includes(base.emittedThirdPartyBackup),
  )
  assert.ok(
    !emittedBackupItem.backup_url.includes(
      'https://upos-sz-mirrorali02.bilivideo.com/upgcxcode/emitted-backup/third.m4s?signature=third',
    ),
  )
  const emittedBackupTransport = base.scope.own(
    new TransportAdapter(
      base.emittedBackupSession,
      base.emittedBackupSettings,
      base.emittedBackupRoutes,
      base.emittedBackupPlayurl,
      base.measurementStub,
      () => base.now,
      createRuntimeIds(),
      undefined,
      () => base.now,
    ),
  )
  emittedBackupTransport.install()
  await base.emittedBackupSettings.update({ considerNativeSources: false })
  base.emittedBackupRoutes.invalidateForUserSetting()
  const beforeEmittedBackupFetch = base.nativeFetchCalls
  let emittedBackupFetchBlocked = false
  try {
    await base.fakeWindow.fetch(base.emittedThirdPartyBackup)
  } catch {
    emittedBackupFetchBlocked = true
  }
  assert.ok(
    emittedBackupFetchBlocked,
    'Catalog-only Fetch blocks an old emitted Native player backup absent from the current exact vault index',
  )
  assert.strictEqual(
    base.nativeFetchCalls,
    beforeEmittedBackupFetch,
    'old emitted player backup never reaches native Fetch after Native is turned off',
  )
  const emittedBackupXhr = new base.FakeXhr()
  emittedBackupXhr.open('GET', base.emittedThirdPartyBackup)
  emittedBackupXhr.send()
  assert.strictEqual(
    emittedBackupXhr.nativeSends,
    0,
    'Catalog-only XHR blocks an old emitted Native player backup before native send',
  )
  const unrelatedThirdPartyUrl = 'https://media.other-example.org/unrelated/video.m4s?source=site'
  const beforeUnrelatedFetch = base.nativeFetchCalls
  await base.fakeWindow.fetch(unrelatedThirdPartyUrl)
  assert.strictEqual(
    base.nativeFetchCalls,
    beforeUnrelatedFetch + 1,
    'unrelated third-party media Fetch remains website-owned',
  )
  const unrelatedThirdPartyXhr = new base.FakeXhr()
  unrelatedThirdPartyXhr.open('GET', unrelatedThirdPartyUrl)
  unrelatedThirdPartyXhr.send()
  assert.strictEqual(
    unrelatedThirdPartyXhr.nativeSends,
    1,
    'unrelated third-party media XHR remains website-owned',
  )
  await base.emittedBackupSettings.update({ considerNativeSources: true })
  base.emittedBackupRoutes.invalidateForUserSetting()
  const outputCapRep = base.emittedBackupVault.contextForUrl(base.emittedBackupRoot)?.representation
  assert.ok(outputCapRep, 'Native-on output-cap fixture retains a current representation')
}

test(
  'Catalog-only dispatch fixture installs Fetch and XHR hooks [1]',
  { timeout: 5000 },
  async (t) => {
    await checkCatalogOnlyDispatchFixtureInstallsFetchAndXHRHooks1(t)
  },
)

test(
  'old Native player backup is rechecked at Fetch dispatch [2]',
  { timeout: 5000 },
  async (t) => {
    await checkOldNativePlayerBackupIsRecheckedAtFetchDispatch2(t)
  },
)

test(
  'Native-on playurl fixture accepts primary plus four backups [3]',
  { timeout: 5000 },
  async (t) => {
    await checkNativeOnPlayurlFixtureAcceptsPrimaryPlusFourBackups3(t)
  },
)

test(
  'Native-on output-cap fixture accepts another representation in the current epoch [4]',
  { timeout: 5000 },
  async (t) => {
    await checkNativeOnOutputCapFixtureAcceptsAnotherRepresentationInTheCurrent(t)
  },
)
