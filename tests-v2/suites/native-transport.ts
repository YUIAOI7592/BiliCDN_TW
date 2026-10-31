import { extendFixture } from '../support/fixture-context.ts'
import { CatalogSettingsStore } from '../support/catalog-settings.ts'
import { installProgressEvent } from '../support/progress-event.ts'
import { createRuntimeIds } from '../../src-v2/platform/runtime-ids.ts'
import { deferred } from '../support/deferred.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { PlayurlController } from '../../src-v2/application/playurl-controller.ts'
import { decisionId } from '../../src-v2/domain/model.ts'
import { TRUSTED_CATALOG } from '../../src-v2/domain/catalog.ts'
import { parseMediaUrl } from '../../src-v2/domain/url-policy.ts'
import { SignedRouteVault } from '../../src-v2/state/signed-route-vault.ts'
import { RestrictionStore } from '../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../src-v2/state/evidence-store.ts'
import { SessionStore } from '../../src-v2/state/session-store.ts'
import { RouteCoordinator } from '../../src-v2/application/route-coordinator.ts'
import { TransportAdapter } from '../../src-v2/adapters/transport.ts'
import type { AppliedRouteDecision } from '../../src-v2/application/route-contracts.ts'
import type { TransportObservation } from '../../src-v2/domain/model.ts'
import { PlayurlAdapter } from '../../src-v2/adapters/playurl.ts'
import { PagePlayinfoAdapter } from '../../src-v2/adapters/page-playinfo.ts'
import { FakeStorage } from '../support/storage.ts'
import { testScope } from '../support/scope.ts'

// Named scenarios create only their prerequisite state; resources belong to this test.
async function createNativeTransportScenario(t: TestContext) {
  const scope = testScope(t)
  installProgressEvent(scope)
  const now = 2_000_000_000_000
  const clock = { now: () => now }
  const passDecision: AppliedRouteDecision = {
    decision: {
      action: 'pass',
      target: { type: 'request' },
      id: decisionId('runtime-pass'),
      reason: 'test',
      routeType: 'root-original',
      host: 'upos-sz-mirrorali.bilivideo.com',
      ranking: [],
    },
    url: 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/runtime.m4s',
    context: null,
    streamKey: 'runtime',
    sourceHost: 'upos-sz-mirrorali.bilivideo.com',
  }
  const observations: TransportObservation[] = []
  ;({
    requestStarted(): void {},
    isCatalogOnly(): boolean {
      return false
    },
    isBilibiliMedia(url: string): boolean {
      return /\.bilivideo\.com\/|\.akamaized\.net\//.test(url)
    },
    recognizesMedia(url: string): boolean {
      return parseMediaUrl(url)?.kind !== 'unknown'
    },
    inspectOriginal(url: string): AppliedRouteDecision {
      return this.apply(url)
    },
    apply(url: string): AppliedRouteDecision {
      return { ...passDecision, url }
    },
    async observe(observation: TransportObservation): Promise<void> {
      observations.push(observation)
    },
  })
  let nativeFetchCalls = 0
  let playurlFetchBody = JSON.stringify({ code: 0, data: { dash: { video: [], audio: [] } } })
  let playurlFetchOverride: Response | null = null
  const nativeFetchUrls: string[] = []
  const nativeFetchMethods: string[] = []
  const nativeFetchRedirects: RequestRedirect[] = []
  const nativeFetchHeaders: (string | null)[] = []
  const nativeFetch = async (input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    nativeFetchCalls++
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    nativeFetchUrls.push(url)
    nativeFetchMethods.push(
      input instanceof Request ? input.method : String(_init?.method ?? 'GET'),
    )
    nativeFetchRedirects.push(
      input instanceof Request
        ? input.redirect
        : (String(_init?.redirect ?? 'follow') as RequestRedirect),
    )
    nativeFetchHeaders.push(input instanceof Request ? input.headers.get('x-bilicdn-test') : null)
    if (url.includes('/stream-body.m4s') && input instanceof Request) await input.text()
    if (url.includes('/player/wbi/playurl'))
      return playurlFetchOverride ?? new Response(playurlFetchBody, { status: 200 })
    let emitted = false
    return new Response(
      new ReadableStream<Uint8Array>({
        pull(controller) {
          if (!emitted) {
            emitted = true
            controller.enqueue(new Uint8Array(70 * 1024))
          }
        },
        cancel(reason) {
          reason
        },
      }),
      { status: 206, headers: { 'content-type': 'video/mp4' } },
    )
  }
  class FakeXhr extends EventTarget {
    #state = 0
    get readyState() {
      return this.#state
    }
    set readyState(value: number) {
      this.#state = value
    }
    method = ''
    url = ''
    status = 200
    responseURL = ''
    responseType: XMLHttpRequestResponseType = ''
    finalResponseUrl: string | null = null
    rawResponseText: string | null = null
    holdAtLoading = false
    timeout = 0
    withCredentials = false
    payload: unknown = { ok: true }
    nativeSends = 0
    get response(): unknown {
      return this.payload
    }
    get responseText(): string {
      return this.rawResponseText ?? JSON.stringify(this.payload)
    }
    open(method: string, url: string | URL): void {
      this.method = method
      this.url = String(url)
      this.responseURL = this.url
      this.readyState = 1
    }
    send(): void {
      this.nativeSends++
      if (this.finalResponseUrl) this.responseURL = this.finalResponseUrl
      this.readyState = this.holdAtLoading ? 3 : 4
      this.dispatchEvent(new Event('readystatechange'))
      if (!this.holdAtLoading) {
        this.dispatchEvent(new Event('load'))
        this.dispatchEvent(new Event('loadend'))
      }
    }
    abort(): void {
      this.dispatchEvent(new Event('abort'))
    }
    setRequestHeader(_name: string, _value: string): void {}
  }
  const originalWorker = function WorkerIdentity() {
    return undefined
  }
  const fakeWindow = {
    fetch: nativeFetch,
    XMLHttpRequest: FakeXhr,
    Worker: originalWorker,
    navigator: globalThis.navigator,
  }
  scope.defineGlobal('unsafeWindow', { configurable: true, value: fakeWindow })
  scope.defineGlobal('location', {
    configurable: true,
    value: new URL('https://www.bilibili.com/video/BVtest/'),
  })
  return extendFixture({}, {
    scope,
    now,
    clock,
    passDecision,
    observations,
    get nativeFetchCalls() {
      return nativeFetchCalls
    },
    set nativeFetchCalls(next: typeof nativeFetchCalls) {
      nativeFetchCalls = next
    },
    get playurlFetchBody() {
      return playurlFetchBody
    },
    set playurlFetchBody(next: typeof playurlFetchBody) {
      playurlFetchBody = next
    },
    get playurlFetchOverride() {
      return playurlFetchOverride
    },
    set playurlFetchOverride(next: typeof playurlFetchOverride) {
      playurlFetchOverride = next
    },
    nativeFetchUrls,
    nativeFetchMethods,
    nativeFetchRedirects,
    nativeFetchHeaders,
    nativeFetch,
    FakeXhr,
    originalWorker,
    fakeWindow,
  } as const)
}

async function createDispatchStorageAnddispatchSettingsContext1(t: TestContext) {
  const base = await createNativeTransportScenario(t)
  const dispatchStorage = new FakeStorage(),
    dispatchSettings = base.scope.own(new CatalogSettingsStore(dispatchStorage, () => base.now))
  await dispatchSettings.update({ considerNativeSources: true })
  const dispatchSession = new SessionStore(),
    dispatchState = dispatchSession.beginGeneration(false)
  const dispatchVault = new SignedRouteVault()
  dispatchVault.reset(dispatchState.generation, dispatchState.epoch)
  const dispatchEvidence = base.scope.own(new EvidenceStore(dispatchStorage, () => base.now))
  const dispatchRoutes = new RouteCoordinator(
    base.clock,
    dispatchSession,
    dispatchSettings,
    base.scope.own(new RestrictionStore(dispatchStorage, () => base.now)),
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
  const dispatchTransport = base.scope.own(
    new TransportAdapter(
      dispatchSession,
      dispatchSettings,
      dispatchRoutes,
      dispatchPlayurl,
      dispatchMeasurement,
      () => base.now,
      createRuntimeIds(),
    ),
  )
  dispatchTransport.install()
  return extendFixture(base, {
    dispatchStorage,
    dispatchSettings,
    dispatchSession,
    dispatchState,
    dispatchVault,
    dispatchEvidence,
    dispatchRoutes,
    dispatchPlayurl,
    dispatchRoot,
    dispatchNativeBackup,
    dispatchItem,
    get gateDispatch() {
      return gateDispatch
    },
    set gateDispatch(next: typeof gateDispatch) {
      gateDispatch = next
    },
    dispatchGate,
    dispatchMeasurement,
    dispatchTransport,
  } as const)
}

async function createMeasurementStubContext2(t: TestContext) {
  const base = await createNativeTransportScenario(t)
  const measurementStub = {
    willGateStartup: (): boolean => false,
    prepareStartup: async (): Promise<void> => {},
    noteUnpreflighted(reason: string): void {
      reason
    },
  }
  const dispatchStorage = new FakeStorage(),
    dispatchSettings = base.scope.own(new CatalogSettingsStore(dispatchStorage, () => base.now))
  await dispatchSettings.update({ considerNativeSources: true })
  const dispatchSession = new SessionStore(),
    dispatchState = dispatchSession.beginGeneration(false)
  const dispatchVault = new SignedRouteVault()
  dispatchVault.reset(dispatchState.generation, dispatchState.epoch)
  const dispatchEvidence = base.scope.own(new EvidenceStore(dispatchStorage, () => base.now))
  const dispatchRoutes = new RouteCoordinator(
    base.clock,
    dispatchSession,
    dispatchSettings,
    base.scope.own(new RestrictionStore(dispatchStorage, () => base.now)),
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
  const dispatchTransport = base.scope.own(
    new TransportAdapter(
      dispatchSession,
      dispatchSettings,
      dispatchRoutes,
      dispatchPlayurl,
      dispatchMeasurement,
      () => base.now,
      createRuntimeIds(),
    ),
  )
  dispatchTransport.install()
  const pendingToggleFetch = base.fakeWindow.fetch(dispatchRoot)
  await dispatchSettings.update({ considerNativeSources: false })
  dispatchRoutes.invalidateForUserSetting()
  dispatchGate.release()
  await pendingToggleFetch
  await dispatchSettings.update({ considerNativeSources: true })
  dispatchRoutes.invalidateForUserSetting()
  const pendingToggleXhr = new base.FakeXhr()
  pendingToggleXhr.open('GET', dispatchRoot)
  pendingToggleXhr.send()
  await dispatchSettings.update({ considerNativeSources: false })
  dispatchRoutes.invalidateForUserSetting()
  dispatchGate.release()
  await dispatchGate.done
  gateDispatch = false
  await base.fakeWindow.fetch(dispatchRoot, { method: 'POST' }).then(
    () => {
      throw new Error('Catalog-only POST Fetch must reject locally')
    },
    () => undefined,
  )
  void (await base.fakeWindow.fetch(dispatchNativeBackup))
  const blockedPostXhr = new base.FakeXhr()
  blockedPostXhr.open('POST', dispatchRoot)
  blockedPostXhr.send()
  const catalogXhr = new base.FakeXhr()
  catalogXhr.open('GET', dispatchRoot)
  catalogXhr.send()
  const redirectedXhr = new base.FakeXhr()
  redirectedXhr.finalResponseUrl = dispatchRoot
  redirectedXhr.open('GET', dispatchRoot)
  redirectedXhr.send()
  await Promise.resolve()
  await dispatchSettings.update({ considerNativeSources: true })
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
  const staleOpaqueXhr = new base.FakeXhr()
  staleOpaqueXhr.open('GET', staleOpaqueUrl)
  await dispatchSettings.update({ considerNativeSources: false })
  dispatchRoutes.invalidateForUserSetting()
  const nextDispatchState = dispatchSession.beginGeneration(false)
  dispatchVault.reset(nextDispatchState.generation, nextDispatchState.epoch)
  dispatchRoutes.resetEpoch()
  staleOpaqueXhr.send()
  await dispatchSettings.update({ disabled: true })
  const disabledDispatch = new base.FakeXhr()
  disabledDispatch.open('GET', dispatchRoot)
  disabledDispatch.send()
  dispatchTransport.dispose()
  const emittedBackupStorage = new FakeStorage(),
    emittedBackupSettings = base.scope.own(
      new CatalogSettingsStore(emittedBackupStorage, () => base.now),
    )
  await emittedBackupSettings.update({ considerNativeSources: true })
  const emittedBackupSession = new SessionStore(),
    emittedBackupState = emittedBackupSession.beginGeneration(false)
  const emittedBackupVault = new SignedRouteVault()
  emittedBackupVault.reset(emittedBackupState.generation, emittedBackupState.epoch)
  const emittedBackupRoutes = new RouteCoordinator(
    base.clock,
    emittedBackupSession,
    emittedBackupSettings,
    base.scope.own(new RestrictionStore(emittedBackupStorage, () => base.now)),
    base.scope.own(new EvidenceStore(emittedBackupStorage, () => base.now)),
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
  return extendFixture(base, {
    measurementStub,
    dispatchStorage,
    dispatchSettings,
    dispatchSession,
    dispatchState,
    dispatchVault,
    dispatchEvidence,
    dispatchRoutes,
    dispatchPlayurl,
    dispatchRoot,
    dispatchNativeBackup,
    dispatchItem,
    get gateDispatch() {
      return gateDispatch
    },
    set gateDispatch(next: typeof gateDispatch) {
      gateDispatch = next
    },
    dispatchGate,
    dispatchMeasurement,
    dispatchTransport,
    pendingToggleFetch,
    pendingToggleXhr,
    blockedPostXhr,
    catalogXhr,
    redirectedXhr,
    staleOpaqueUrl,
    staleOpaqueXhr,
    nextDispatchState,
    disabledDispatch,
    emittedBackupStorage,
    emittedBackupSettings,
    emittedBackupSession,
    emittedBackupState,
    emittedBackupVault,
    emittedBackupRoutes,
    emittedBackupPlayurl,
    emittedBackupRoot,
    emittedThirdPartyBackup,
  } as const)
}

async function createEmittedBackupTransportContext3(t: TestContext) {
  const base = await createMeasurementStubContext2(t)
  const emittedBackupTransport = base.scope.own(
    new TransportAdapter(
      base.emittedBackupSession,
      base.emittedBackupSettings,
      base.emittedBackupRoutes,
      base.emittedBackupPlayurl,
      base.measurementStub,
      () => base.now,
      createRuntimeIds(),
    ),
  )
  emittedBackupTransport.install()
  await base.emittedBackupSettings.update({ considerNativeSources: false })
  base.emittedBackupRoutes.invalidateForUserSetting()
  try {
    await base.fakeWindow.fetch(base.emittedThirdPartyBackup)
  } catch {
    true
  }
  const emittedBackupXhr = new base.FakeXhr()
  emittedBackupXhr.open('GET', base.emittedThirdPartyBackup)
  emittedBackupXhr.send()
  const unrelatedThirdPartyUrl = 'https://media.other-example.org/unrelated/video.m4s?source=site'
  await base.fakeWindow.fetch(unrelatedThirdPartyUrl)
  const unrelatedThirdPartyXhr = new base.FakeXhr()
  unrelatedThirdPartyXhr.open('GET', unrelatedThirdPartyUrl)
  unrelatedThirdPartyXhr.send()
  await base.emittedBackupSettings.update({ considerNativeSources: true })
  base.emittedBackupRoutes.invalidateForUserSetting()
  const outputCapRep = base.emittedBackupVault.contextForUrl(base.emittedBackupRoot)?.representation
  for (let index = 0; index < 1200; index++) {
    const fillerUrl = `https://fill.example.net/upgcxcode/output-cap/${index}.m4s?signature=filler`
    base.emittedBackupVault.registerAlias(outputCapRep!, fillerUrl)
    base.emittedBackupVault.registerOutput(
      outputCapRep!,
      base.emittedBackupRoot,
      fillerUrl,
      [],
      decisionId('output-cap-fill'),
      'trusted-api',
    )
  }
  return extendFixture(base, {
    emittedBackupTransport,
    emittedBackupXhr,
    unrelatedThirdPartyUrl,
    unrelatedThirdPartyXhr,
    outputCapRep,
  } as const)
}

async function createCappedThirdPartyBackupContext4(t: TestContext) {
  const base = await createEmittedBackupTransportContext3(t)
  const cappedThirdPartyBackup =
    'https://cdn.example.net/upgcxcode/emitted-backup/capped-final.m4s?signature=capped-old-backup'
  await base.emittedBackupSettings.update({ considerNativeSources: false })
  base.emittedBackupRoutes.invalidateForUserSetting()
  await base.fakeWindow.fetch(cappedThirdPartyBackup)
  const cappedBackupXhr = new base.FakeXhr()
  cappedBackupXhr.open('GET', cappedThirdPartyBackup)
  cappedBackupXhr.send()
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
  Reflect.set(base.fakeWindow, '__playinfo__', latePagePayload)
  return extendFixture(base, {
    cappedThirdPartyBackup,
    cappedBackupXhr,
    pageStorage,
    pageSettings,
    pageSession,
    pageState,
    pageVault,
    pageRoutes,
    pagePlayurl,
    assignedAtSetter,
    assignedPayloadAtSetter,
    get pageOwnedPlayinfo() {
      return pageOwnedPlayinfo
    },
    set pageOwnedPlayinfo(next: typeof pageOwnedPlayinfo) {
      pageOwnedPlayinfo = next
    },
    pageInfo,
    earlyPageUrl,
    earlyPagePayload,
    trustedPageUrl,
    trustedPagePayload,
    trustedPageRep,
    trustedPageOutput,
    trustedOutputRole,
    latePageUrl,
    latePagePayload,
  } as const)
}

async function createAffinityFixtureHasADifferentLegalCatalogHost6Context5(t: TestContext) {
  const base = await createCappedThirdPartyBackupContext4(t)
  base.trustedPageRep
    ? base.pageVault.outputRole(base.trustedPageRep, base.trustedPageOutput)
    : null
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
  const affinityChoice = base.pageRoutes
    .startupOptions(affinityPageRoot)
    ?.candidates.find(
      (candidate) =>
        candidate.type === 'catalog-generated' &&
        candidate.host !== new URL(base.trustedPageOutput).host,
    )
  return extendFixture(base, { affinityPageRoot, affinityPageRep, affinityChoice } as const)
}

async function createCatalogOnlyPlayinfoAccessorGetterSanitizesEveryFreshUnsupportedNativeValueContext6(
  t: TestContext,
) {
  const base = await createAffinityFixtureHasADifferentLegalCatalogHost6Context5(t)
  base.pageRoutes.commitStartupChoice(
    base.affinityPageRoot,
    base.affinityChoice ?? null,
    'test-observed-affinity',
  )
  const affinityApplied = base.pageRoutes.apply(base.affinityPageRoot)
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
  const unsupportedPageUrl =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/page-hint/unsupported.m4s?signature=unsupported-secret'
  const unsupportedPagePayload = { data: { durl: [{ url: unsupportedPageUrl }] } }
  Reflect.set(base.fakeWindow, '__playinfo__', unsupportedPagePayload)
  base.pageInfo.dispose()
  Reflect.deleteProperty(base.fakeWindow, '__playinfo__')
  const initialUnsupportedUrl =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/page-hint/initial.m4s?signature=initial-secret'
  const initialUnsupportedPlayinfo = { data: { durl: [{ url: initialUnsupportedUrl }] } }
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
  nativeOnInitialPageInfo.dispose()
  Reflect.deleteProperty(base.fakeWindow, '__playinfo__')
  await base.pageSettings.update({ considerNativeSources: false })
  base.pageRoutes.invalidateForUserSetting()
  let freshPlayinfoReads = 0
  Object.defineProperty(base.fakeWindow, '__playinfo__', {
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
  const freshPageInfo = base.scope.own(
    new PagePlayinfoAdapter(
      (payload) => base.pagePlayurl.transform(payload, 'page-hint').accepted,
      () => base.pageRoutes.isCatalogOnly(),
    ),
  )
  freshPageInfo.install()
  return extendFixture(base, {
    affinityApplied,
    unsupportedPageUrl,
    unsupportedPagePayload,
    initialUnsupportedUrl,
    initialUnsupportedPlayinfo,
    initialPageInfo,
    nativeOnInitialPageInfo,
    get freshPlayinfoReads() {
      return freshPlayinfoReads
    },
    set freshPlayinfoReads(next: typeof freshPlayinfoReads) {
      freshPlayinfoReads = next
    },
    freshPageInfo,
  } as const)
}

async function createNativeOnPlayinfoAccessorGetterPreservesFreshWebsiteValue8Context7(
  t: TestContext,
) {
  const base =
    await createCatalogOnlyPlayinfoAccessorGetterSanitizesEveryFreshUnsupportedNativeValueContext6(
      t,
    )
  await base.pageSettings.update({ considerNativeSources: true })
  base.pageRoutes.invalidateForUserSetting()
  return extendFixture(base, {} as const)
}

async function createCatalogOnlyXHRParameterPlayurlIsBlockedBeforeNativeSendBecauseContext8(
  t: TestContext,
) {
  const base = await createNativeOnPlayinfoAccessorGetterPreservesFreshWebsiteValue8Context7(t)
  base.freshPageInfo.dispose()
  Reflect.deleteProperty(base.fakeWindow, '__playinfo__')
  const apiFailureStorage = new FakeStorage(),
    apiFailureSettings = base.scope.own(new CatalogSettingsStore(apiFailureStorage, () => base.now))
  const apiFailureSession = new SessionStore(),
    apiFailureState = apiFailureSession.beginGeneration(false)
  const apiFailureVault = new SignedRouteVault()
  apiFailureVault.reset(apiFailureState.generation, apiFailureState.epoch)
  const apiFailureRoutes = new RouteCoordinator(
    base.clock,
    apiFailureSession,
    apiFailureSettings,
    base.scope.own(new RestrictionStore(apiFailureStorage, () => base.now)),
    base.scope.own(new EvidenceStore(apiFailureStorage, () => base.now)),
    apiFailureVault,
    createRuntimeIds(),
  )
  const apiFailurePlayurl = new PlayurlAdapter(
    new PlayurlController(apiFailureSession, apiFailureVault, apiFailureRoutes),
  )
  const apiFailureTransport = base.scope.own(
    new TransportAdapter(
      apiFailureSession,
      apiFailureSettings,
      apiFailureRoutes,
      apiFailurePlayurl,
      base.measurementStub,
      () => base.now,
      createRuntimeIds(),
    ),
  )
  apiFailureTransport.install()
  const apiEndpoint = 'https://api.bilibili.com/x/player/wbi/playurl?cid=contract'
  const leakedNativeUrl =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/api-failure/video.m4s?signature=raw-secret'
  const malformedApi = `{"data":{"dash":{"video":[{"base_url":"${leakedNativeUrl}"}`
  const unsupportedApi = { code: 0, data: { sources: [{ url: leakedNativeUrl }] } }
  const assertNoRawNative = async (
    read: () => unknown | Promise<unknown>,
    message: string,
  ): Promise<void> => {
    let value: unknown = null,
      rejected = false
    try {
      value = await read()
    } catch {
      rejected = true
    }
    assert.ok(rejected || !JSON.stringify(value)?.includes('signature=raw-secret'), message)
  }
  base.playurlFetchBody = malformedApi
  await assertNoRawNative(
    async () => await (await base.fakeWindow.fetch(apiEndpoint)).text(),
    'Catalog-only Fetch does not expose a malformed HTTP-200 playurl carrying a signed Native URL',
  )
  base.playurlFetchBody = JSON.stringify(unsupportedApi)
  await assertNoRawNative(
    async () => await (await base.fakeWindow.fetch(apiEndpoint)).text(),
    'Catalog-only Fetch does not expose a non-DASH HTTP-200 playurl carrying a signed Native URL',
  )
  const malformedTextXhr = new base.FakeXhr()
  malformedTextXhr.responseType = 'text'
  malformedTextXhr.payload = malformedApi
  malformedTextXhr.rawResponseText = malformedApi
  malformedTextXhr.open('GET', apiEndpoint)
  malformedTextXhr.send()
  await assertNoRawNative(
    () => malformedTextXhr.responseText,
    'Catalog-only XHR text response does not expose malformed playurl signed Native URL',
  )
  await assertNoRawNative(
    () => malformedTextXhr.response,
    'Catalog-only XHR response getter does not expose malformed playurl signed Native URL',
  )
  const unsupportedTextXhr = new base.FakeXhr()
  unsupportedTextXhr.responseType = 'text'
  unsupportedTextXhr.payload = JSON.stringify(unsupportedApi)
  unsupportedTextXhr.rawResponseText = JSON.stringify(unsupportedApi)
  unsupportedTextXhr.open('GET', apiEndpoint)
  unsupportedTextXhr.send()
  await assertNoRawNative(
    () => unsupportedTextXhr.responseText,
    'Catalog-only XHR text response does not expose non-DASH playurl signed Native URL',
  )
  const unsupportedJsonXhr = new base.FakeXhr()
  unsupportedJsonXhr.responseType = 'json'
  unsupportedJsonXhr.payload = unsupportedApi
  unsupportedJsonXhr.open('GET', apiEndpoint)
  unsupportedJsonXhr.send()
  await assertNoRawNative(
    () => unsupportedJsonXhr.response,
    'Catalog-only XHR JSON response does not expose non-DASH playurl signed Native URL',
  )
  return extendFixture(base, {
    apiFailureStorage,
    apiFailureSettings,
    apiFailureSession,
    apiFailureState,
    apiFailureVault,
    apiFailureRoutes,
    apiFailurePlayurl,
    apiFailureTransport,
    apiEndpoint,
    leakedNativeUrl,
    malformedApi,
    unsupportedApi,
    assertNoRawNative,
    malformedTextXhr,
    unsupportedTextXhr,
    unsupportedJsonXhr,
  } as const)
}

async function createPartialPlayurlXHRFixtureIsStillLoading10Context9(t: TestContext) {
  const base = await createCatalogOnlyXHRParameterPlayurlIsBlockedBeforeNativeSendBecauseContext8(t)
  for (const responseType of ['blob', 'arraybuffer'] as const) {
    const binaryXhr = new base.FakeXhr()
    binaryXhr.responseType = responseType
    binaryXhr.open('GET', base.apiEndpoint)
    binaryXhr.send()
  }
  const loadingSignedText = `{"data":{"dash":{"video":[{"base_url":"${base.leakedNativeUrl}"`
  const loadingTextXhr = new base.FakeXhr()
  loadingTextXhr.responseType = 'text'
  loadingTextXhr.holdAtLoading = true
  loadingTextXhr.payload = loadingSignedText
  loadingTextXhr.rawResponseText = loadingSignedText
  loadingTextXhr.open('GET', base.apiEndpoint)
  loadingTextXhr.send()
  return extendFixture(base, { loadingSignedText, loadingTextXhr } as const)
}

async function createNativeOnXHRParameterPlayurlRetainsWebsiteDispatch11ParameterParameterContext10(
  t: TestContext,
) {
  const base = await createPartialPlayurlXHRFixtureIsStillLoading10Context9(t)
  await base.assertNoRawNative(
    () => base.loadingTextXhr.responseText,
    'Catalog-only XHR LOADING responseText cannot expose a partial signed Native playurl',
  )
  await base.assertNoRawNative(
    () => base.loadingTextXhr.response,
    'Catalog-only XHR LOADING text response cannot expose a partial signed Native playurl',
  )
  const delayedSitePlayurl = JSON.stringify(
    {
      code: 0,
      data: {
        dash: {
          video: [
            {
              id: 80,
              codecid: 13,
              height: 1080,
              bandwidth: 1_000_000,
              base_url: base.leakedNativeUrl,
              backup_url: [],
            },
          ],
          audio: [],
        },
      },
    },
    null,
    2,
  )
  const stalePlayurlTextXhr = new base.FakeXhr()
  stalePlayurlTextXhr.responseType = 'text'
  stalePlayurlTextXhr.payload = delayedSitePlayurl
  stalePlayurlTextXhr.rawResponseText = delayedSitePlayurl
  stalePlayurlTextXhr.open('GET', base.apiEndpoint)
  stalePlayurlTextXhr.send()
  const stalePlayurlJsonXhr = new base.FakeXhr()
  stalePlayurlJsonXhr.responseType = 'json'
  stalePlayurlJsonXhr.payload = JSON.parse(delayedSitePlayurl) as unknown
  stalePlayurlJsonXhr.open('GET', base.apiEndpoint)
  stalePlayurlJsonXhr.send()
  const nextApiFailureState = base.apiFailureSession.beginGeneration(false)
  base.apiFailureVault.reset(nextApiFailureState.generation, nextApiFailureState.epoch)
  base.apiFailureRoutes.resetEpoch()
  await base.assertNoRawNative(
    () => stalePlayurlTextXhr.responseText,
    'Catalog-only XHR text opened in an old SPA generation never exposes a signed Native playurl after generation reset',
  )
  await base.assertNoRawNative(
    () => stalePlayurlTextXhr.response,
    'Catalog-only XHR response opened in an old SPA generation never exposes a signed Native playurl after generation reset',
  )
  await base.assertNoRawNative(
    () => stalePlayurlJsonXhr.response,
    'Catalog-only XHR JSON opened in an old SPA generation never exposes a signed Native playurl after generation reset',
  )
  let releaseDelayedPlayurl: () => void = () => undefined
  const bodyReadStarted = deferred<void>()
  base.playurlFetchOverride = new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        releaseDelayedPlayurl = () => {
          controller.enqueue(new TextEncoder().encode(delayedSitePlayurl))
          controller.close()
        }
      },
    }),
    { status: 201, headers: { 'x-website-playurl': 'original' } },
  )
  const readWebsiteBody = base.playurlFetchOverride.text.bind(base.playurlFetchOverride)
  Object.defineProperty(base.playurlFetchOverride, 'text', {
    value: () => {
      bodyReadStarted.resolve()
      return readWebsiteBody()
    },
  })
  const delayedPlayurlFetch = base.fakeWindow.fetch(base.apiEndpoint).then((response) => {
    true
    return response
  })
  await bodyReadStarted.promise
  await base.apiFailureSettings.update({ disabled: true })
  releaseDelayedPlayurl()
  await delayedPlayurlFetch
  base.playurlFetchOverride = null
  await base.apiFailureSettings.update({ disabled: false })
  base.apiFailureTransport.dispose()
  const throwingPlayurl = {
    transform: (): never => {
      throw new Error('synthetic transform failure')
    },
  }
  const throwingTransport = base.scope.own(
    new TransportAdapter(
      base.apiFailureSession,
      base.apiFailureSettings,
      base.apiFailureRoutes,
      throwingPlayurl,
      base.measurementStub,
      () => base.now,
      createRuntimeIds(),
    ),
  )
  throwingTransport.install()
  const transformFailurePayload = {
    code: 0,
    data: {
      dash: {
        video: [
          {
            id: 80,
            codecid: 13,
            height: 1080,
            bandwidth: 1_000_000,
            base_url: base.leakedNativeUrl,
            backup_url: [],
          },
        ],
        audio: [],
      },
    },
  }
  base.playurlFetchBody = JSON.stringify(transformFailurePayload)
  await base.assertNoRawNative(
    async () => await (await base.fakeWindow.fetch(base.apiEndpoint)).text(),
    'Catalog-only Fetch does not expose signed Native URL after transform throws',
  )
  const throwingTextXhr = new base.FakeXhr()
  throwingTextXhr.responseType = 'text'
  throwingTextXhr.payload = JSON.stringify(transformFailurePayload)
  throwingTextXhr.rawResponseText = JSON.stringify(transformFailurePayload)
  throwingTextXhr.open('GET', base.apiEndpoint)
  throwingTextXhr.send()
  await base.assertNoRawNative(
    () => throwingTextXhr.responseText,
    'Catalog-only XHR text does not expose signed Native URL after transform throws',
  )
  const throwingJsonXhr = new base.FakeXhr()
  throwingJsonXhr.responseType = 'json'
  throwingJsonXhr.payload = transformFailurePayload
  throwingJsonXhr.open('GET', base.apiEndpoint)
  throwingJsonXhr.send()
  await base.assertNoRawNative(
    () => throwingJsonXhr.response,
    'Catalog-only XHR JSON does not expose signed Native URL after transform throws',
  )
  await base.apiFailureSettings.update({ considerNativeSources: true })
  base.apiFailureRoutes.invalidateForUserSetting()
  base.playurlFetchBody = base.malformedApi
  const nativeOnXhr = new base.FakeXhr()
  nativeOnXhr.responseType = 'text'
  nativeOnXhr.payload = base.malformedApi
  nativeOnXhr.rawResponseText = base.malformedApi
  nativeOnXhr.open('GET', base.apiEndpoint)
  nativeOnXhr.send()
  const nativeOnLoadingXhr = new base.FakeXhr()
  nativeOnLoadingXhr.responseType = 'text'
  nativeOnLoadingXhr.holdAtLoading = true
  nativeOnLoadingXhr.payload = base.loadingSignedText
  nativeOnLoadingXhr.rawResponseText = base.loadingSignedText
  nativeOnLoadingXhr.open('GET', base.apiEndpoint)
  nativeOnLoadingXhr.send()
  return extendFixture(base, {
    delayedSitePlayurl,
    stalePlayurlTextXhr,
    stalePlayurlJsonXhr,
    nextApiFailureState,
    get releaseDelayedPlayurl() {
      return releaseDelayedPlayurl
    },
    set releaseDelayedPlayurl(next: typeof releaseDelayedPlayurl) {
      releaseDelayedPlayurl = next
    },
    bodyReadStarted,
    readWebsiteBody,
    delayedPlayurlFetch,
    throwingPlayurl,
    throwingTransport,
    transformFailurePayload,
    throwingTextXhr,
    throwingJsonXhr,
    nativeOnXhr,
    nativeOnLoadingXhr,
  } as const)
}

async function createDisabledScriptPreservesMalformedWebsiteFetchPlayurlResponse12Context11(
  t: TestContext,
) {
  const base =
    await createNativeOnXHRParameterPlayurlRetainsWebsiteDispatch11ParameterParameterContext10(t)
  for (const responseType of ['blob', 'arraybuffer'] as const) {
    const binaryXhr = new base.FakeXhr()
    binaryXhr.responseType = responseType
    binaryXhr.open('GET', base.apiEndpoint)
    binaryXhr.send()
  }
  await base.apiFailureSettings.update({
    disabled: true,
    considerNativeSources: false,
  })
  return extendFixture(base, {} as const)
}

async function createDisabledApiXhrContext12(t: TestContext) {
  const base = await createDisabledScriptPreservesMalformedWebsiteFetchPlayurlResponse12Context11(t)
  const disabledApiXhr = new base.FakeXhr()
  disabledApiXhr.responseType = 'text'
  disabledApiXhr.payload = base.malformedApi
  disabledApiXhr.rawResponseText = base.malformedApi
  disabledApiXhr.open('GET', base.apiEndpoint)
  disabledApiXhr.send()
  const disabledLoadingXhr = new base.FakeXhr()
  disabledLoadingXhr.responseType = 'text'
  disabledLoadingXhr.holdAtLoading = true
  disabledLoadingXhr.payload = base.loadingSignedText
  disabledLoadingXhr.rawResponseText = base.loadingSignedText
  disabledLoadingXhr.open('GET', base.apiEndpoint)
  disabledLoadingXhr.send()
  return extendFixture(base, { disabledApiXhr, disabledLoadingXhr } as const)
}

async function createCatalogOnlyFetchBlocksKnownBStationPCDNSuffixParameterBeforeContext13(
  t: TestContext,
) {
  const base = await createDisabledApiXhrContext12(t)
  for (const responseType of ['blob', 'arraybuffer'] as const) {
    const binaryXhr = new base.FakeXhr()
    binaryXhr.responseType = responseType
    binaryXhr.open('GET', base.apiEndpoint)
    binaryXhr.send()
  }
  base.throwingTransport.dispose()
  base.playurlFetchBody = JSON.stringify({
    code: 0,
    data: { dash: { video: [], audio: [] } },
  })
  const oversizedStorage = new FakeStorage(),
    oversizedSettings = base.scope.own(new CatalogSettingsStore(oversizedStorage, () => base.now))
  const oversizedSession = new SessionStore(),
    oversizedState = oversizedSession.beginGeneration(false)
  const oversizedVault = new SignedRouteVault()
  oversizedVault.reset(oversizedState.generation, oversizedState.epoch)
  const oversizedRoutes = new RouteCoordinator(
    base.clock,
    oversizedSession,
    oversizedSettings,
    base.scope.own(new RestrictionStore(oversizedStorage, () => base.now)),
    base.scope.own(new EvidenceStore(oversizedStorage, () => base.now)),
    oversizedVault,
    createRuntimeIds(),
  )
  const oversizedPlayurl = new PlayurlAdapter(
    new PlayurlController(oversizedSession, oversizedVault, oversizedRoutes),
  )
  const oversizedTransport = base.scope.own(
    new TransportAdapter(
      oversizedSession,
      oversizedSettings,
      oversizedRoutes,
      oversizedPlayurl,
      base.measurementStub,
      () => base.now,
      createRuntimeIds(),
    ),
  )
  oversizedTransport.install()
  return extendFixture(base, {
    oversizedStorage,
    oversizedSettings,
    oversizedSession,
    oversizedState,
    oversizedVault,
    oversizedRoutes,
    oversizedPlayurl,
    oversizedTransport,
  } as const)
}

async function createUnattributedThirdPartyM4sFetchRemainsWebsiteOwned15Context14(t: TestContext) {
  const base = await createCatalogOnlyFetchBlocksKnownBStationPCDNSuffixParameterBeforeContext13(t)
  for (const suffix of ['szbdyd.com', 'mountaintoys.cn', 'nexusedgeio.com', 'ahdohpiechei.com']) {
    const knownPcdnUrl = `https://node.${suffix}/video.m4s?signature=pcdn-secret`
    base.nativeFetchCalls
    false
    try {
      await base.fakeWindow.fetch(knownPcdnUrl)
    } catch {
      true
    }
    const pcdnXhr = new base.FakeXhr()
    pcdnXhr.open('GET', knownPcdnUrl)
    pcdnXhr.send()
  }
  const thirdPartyMedia = 'https://cdn.example.net/video.m4s?signature=outside'
  return extendFixture(base, { thirdPartyMedia } as const)
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

async function checkUnattributedThirdPartyM4sFetchRemainsWebsiteOwned15(
  t: TestContext,
): Promise<void> {
  const base = await createUnattributedThirdPartyM4sFetchRemainsWebsiteOwned15Context14(t)

  const beforeThirdPartyFetch = base.nativeFetchCalls
  await base.fakeWindow.fetch(base.thirdPartyMedia)

  assert.strictEqual(
    base.nativeFetchCalls,
    beforeThirdPartyFetch + 1,
    'unattributed third-party .m4s Fetch remains website-owned',
  )
  const thirdPartyXhr = new base.FakeXhr()
  thirdPartyXhr.open('GET', base.thirdPartyMedia)
  thirdPartyXhr.send()
  assert.strictEqual(
    thirdPartyXhr.nativeSends,
    1,
    'unattributed third-party .m4s XHR remains website-owned',
  )
  const oversizedBilibiliMedia =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/video.m4s?signature=oversized-secret-' +
    'x'.repeat(17 * 1024)
  const beforeOversizedFetch = base.nativeFetchCalls
  let oversizedFetchBlocked = false
  try {
    await base.fakeWindow.fetch(oversizedBilibiliMedia)
  } catch {
    oversizedFetchBlocked = true
  }
  assert.ok(
    oversizedFetchBlocked,
    'Catalog-only oversized recognizable B station media Fetch rejects before native dispatch',
  )
  assert.strictEqual(
    base.nativeFetchCalls,
    beforeOversizedFetch,
    'Catalog-only oversized recognizable B station media Fetch never calls native fetch',
  )
  const oversizedXhr = new base.FakeXhr()
  oversizedXhr.open('GET', oversizedBilibiliMedia)
  oversizedXhr.send()
  assert.strictEqual(
    oversizedXhr.nativeSends,
    0,
    'Catalog-only oversized recognizable B station media XHR never calls native send',
  )
  assert.ok(
    !JSON.stringify(base.oversizedTransport.snapshot()).includes('oversized-secret'),
    'oversized media block diagnostics never include the signed URL or query',
  )
  await base.oversizedSettings.update({ considerNativeSources: true })
  base.oversizedRoutes.invalidateForUserSetting()
  const beforeOversizedNativeOn = base.nativeFetchCalls
  await base.fakeWindow.fetch(oversizedBilibiliMedia)
  assert.strictEqual(
    base.nativeFetchCalls,
    beforeOversizedNativeOn + 1,
    'Native-on oversized website Fetch preserves native dispatch',
  )
  const nativeOnOversizedXhr = new base.FakeXhr()
  nativeOnOversizedXhr.open('GET', oversizedBilibiliMedia)
  nativeOnOversizedXhr.send()
  assert.strictEqual(
    nativeOnOversizedXhr.nativeSends,
    1,
    'Native-on oversized website XHR preserves native dispatch',
  )
}

async function checkDisabledScriptPreservesOversizedWebsiteFetchDispatch16(
  t: TestContext,
): Promise<void> {
  const base = await createUnattributedThirdPartyM4sFetchRemainsWebsiteOwned15Context14(t)

  await base.fakeWindow.fetch(base.thirdPartyMedia)
  const thirdPartyXhr = new base.FakeXhr()
  thirdPartyXhr.open('GET', base.thirdPartyMedia)
  thirdPartyXhr.send()
  const oversizedBilibiliMedia =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/video.m4s?signature=oversized-secret-' +
    'x'.repeat(17 * 1024)
  try {
    await base.fakeWindow.fetch(oversizedBilibiliMedia)
  } catch {
    true
  }
  const oversizedXhr = new base.FakeXhr()
  oversizedXhr.open('GET', oversizedBilibiliMedia)
  oversizedXhr.send()
  await base.oversizedSettings.update({ considerNativeSources: true })
  base.oversizedRoutes.invalidateForUserSetting()
  await base.fakeWindow.fetch(oversizedBilibiliMedia)
  const nativeOnOversizedXhr = new base.FakeXhr()
  nativeOnOversizedXhr.open('GET', oversizedBilibiliMedia)
  nativeOnOversizedXhr.send()
  await base.oversizedSettings.update({
    disabled: true,
    considerNativeSources: false,
  })
  const beforeDisabledOversized = base.nativeFetchCalls
  await base.fakeWindow.fetch(oversizedBilibiliMedia)

  assert.strictEqual(
    base.nativeFetchCalls,
    beforeDisabledOversized + 1,
    'disabled script preserves oversized website Fetch dispatch',
  )
  const disabledOversizedXhr = new base.FakeXhr()
  disabledOversizedXhr.open('GET', oversizedBilibiliMedia)
  disabledOversizedXhr.send()
  assert.strictEqual(
    disabledOversizedXhr.nativeSends,
    1,
    'disabled script preserves oversized website XHR dispatch',
  )
}

async function checkCatalogOnlyFetchBlocksKnownBStationPCDNSuffixParameterBefore(
  t: TestContext,
  parameter = 0,
): Promise<void> {
  const base = await createCatalogOnlyFetchBlocksKnownBStationPCDNSuffixParameterBeforeContext13(t)

  let iteration = 0
  for (const suffix of ['szbdyd.com', 'mountaintoys.cn', 'nexusedgeio.com', 'ahdohpiechei.com']) {
    if (iteration++ === parameter) {
      const knownPcdnUrl = `https://node.${suffix}/video.m4s?signature=pcdn-secret`
      const beforePcdnFetch = base.nativeFetchCalls
      let pcdnFetchBlocked = false
      try {
        await base.fakeWindow.fetch(knownPcdnUrl)
      } catch {
        pcdnFetchBlocked = true
      }
      assert.ok(
        pcdnFetchBlocked,
        `Catalog-only Fetch blocks known B station PCDN suffix ${suffix} before native dispatch`,
      )
      assert.strictEqual(
        base.nativeFetchCalls,
        beforePcdnFetch,
        `known PCDN suffix ${suffix} never reaches native Fetch`,
      )
      const pcdnXhr = new base.FakeXhr()
      pcdnXhr.open('GET', knownPcdnUrl)
      pcdnXhr.send()
      assert.strictEqual(
        pcdnXhr.nativeSends,
        0,
        `Catalog-only XHR blocks known B station PCDN suffix ${suffix} before native send`,
      )

      return
    }
  }
  throw Error('Unknown fixture parameter')
}

async function checkDisabledScriptPreservesWebsiteXHRParameterPlayurlDispatch13ParameterParameter(
  t: TestContext,
  parameter = 0,
): Promise<void> {
  const base = await createDisabledApiXhrContext12(t)

  let iteration = 0
  for (const responseType of ['blob', 'arraybuffer'] as const) {
    if (iteration++ === parameter) {
      const binaryXhr = new base.FakeXhr()
      binaryXhr.responseType = responseType
      binaryXhr.open('GET', base.apiEndpoint)
      binaryXhr.send()
      assert.strictEqual(
        binaryXhr.nativeSends,
        1,
        `disabled script preserves website XHR ${responseType} playurl dispatch`,
      )

      return
    }
  }
  throw Error('Unknown fixture parameter')
}

async function checkDisabledScriptPreservesMalformedWebsiteFetchPlayurlResponse12(
  t: TestContext,
): Promise<void> {
  const base = await createDisabledScriptPreservesMalformedWebsiteFetchPlayurlResponse12Context11(t)

  assert.strictEqual(
    await (await base.fakeWindow.fetch(base.apiEndpoint)).text(),
    base.malformedApi,
    'disabled script preserves malformed website Fetch playurl response',
  )
  const disabledApiXhr = new base.FakeXhr()
  disabledApiXhr.responseType = 'text'
  disabledApiXhr.payload = base.malformedApi
  disabledApiXhr.rawResponseText = base.malformedApi
  disabledApiXhr.open('GET', base.apiEndpoint)
  disabledApiXhr.send()
  assert.strictEqual(
    disabledApiXhr.responseText,
    base.malformedApi,
    'disabled script preserves malformed website XHR playurl response',
  )
  const disabledLoadingXhr = new base.FakeXhr()
  disabledLoadingXhr.responseType = 'text'
  disabledLoadingXhr.holdAtLoading = true
  disabledLoadingXhr.payload = base.loadingSignedText
  disabledLoadingXhr.rawResponseText = base.loadingSignedText
  disabledLoadingXhr.open('GET', base.apiEndpoint)
  disabledLoadingXhr.send()
  assert.strictEqual(
    disabledLoadingXhr.responseText,
    base.loadingSignedText,
    'disabled script preserves website partial playurl responseText',
  )
  assert.strictEqual(
    disabledLoadingXhr.response,
    base.loadingSignedText,
    'disabled script preserves website partial playurl text response',
  )
}

async function checkNativeOnXHRParameterPlayurlRetainsWebsiteDispatch11ParameterParameter(
  t: TestContext,
  parameter = 0,
): Promise<void> {
  const base =
    await createNativeOnXHRParameterPlayurlRetainsWebsiteDispatch11ParameterParameterContext10(t)

  let iteration = 0
  for (const responseType of ['blob', 'arraybuffer'] as const) {
    if (iteration++ === parameter) {
      const binaryXhr = new base.FakeXhr()
      binaryXhr.responseType = responseType
      binaryXhr.open('GET', base.apiEndpoint)
      binaryXhr.send()
      assert.strictEqual(
        binaryXhr.nativeSends,
        1,
        `Native-on XHR ${responseType} playurl retains website dispatch`,
      )

      return
    }
  }
  throw Error('Unknown fixture parameter')
}

async function checkPartialPlayurlXHRFixtureIsStillLoading10(t: TestContext): Promise<void> {
  const base = await createPartialPlayurlXHRFixtureIsStillLoading10Context9(t)

  assert.strictEqual(
    base.loadingTextXhr.readyState,
    3,
    'partial playurl XHR fixture is still loading',
  )
  await base.assertNoRawNative(
    () => base.loadingTextXhr.responseText,
    'Catalog-only XHR LOADING responseText cannot expose a partial signed Native playurl',
  )
  await base.assertNoRawNative(
    () => base.loadingTextXhr.response,
    'Catalog-only XHR LOADING text response cannot expose a partial signed Native playurl',
  )
  const delayedSitePlayurl = JSON.stringify(
    {
      code: 0,
      data: {
        dash: {
          video: [
            {
              id: 80,
              codecid: 13,
              height: 1080,
              bandwidth: 1_000_000,
              base_url: base.leakedNativeUrl,
              backup_url: [],
            },
          ],
          audio: [],
        },
      },
    },
    null,
    2,
  )
  const stalePlayurlTextXhr = new base.FakeXhr()
  stalePlayurlTextXhr.responseType = 'text'
  stalePlayurlTextXhr.payload = delayedSitePlayurl
  stalePlayurlTextXhr.rawResponseText = delayedSitePlayurl
  stalePlayurlTextXhr.open('GET', base.apiEndpoint)
  stalePlayurlTextXhr.send()
  const stalePlayurlJsonXhr = new base.FakeXhr()
  stalePlayurlJsonXhr.responseType = 'json'
  stalePlayurlJsonXhr.payload = JSON.parse(delayedSitePlayurl) as unknown
  stalePlayurlJsonXhr.open('GET', base.apiEndpoint)
  stalePlayurlJsonXhr.send()
  const nextApiFailureState = base.apiFailureSession.beginGeneration(false)
  base.apiFailureVault.reset(nextApiFailureState.generation, nextApiFailureState.epoch)
  base.apiFailureRoutes.resetEpoch()
  await base.assertNoRawNative(
    () => stalePlayurlTextXhr.responseText,
    'Catalog-only XHR text opened in an old SPA generation never exposes a signed Native playurl after generation reset',
  )
  await base.assertNoRawNative(
    () => stalePlayurlTextXhr.response,
    'Catalog-only XHR response opened in an old SPA generation never exposes a signed Native playurl after generation reset',
  )
  await base.assertNoRawNative(
    () => stalePlayurlJsonXhr.response,
    'Catalog-only XHR JSON opened in an old SPA generation never exposes a signed Native playurl after generation reset',
  )
  let releaseDelayedPlayurl: () => void = () => undefined
  const bodyReadStarted = deferred<void>()
  base.playurlFetchOverride = new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        releaseDelayedPlayurl = () => {
          controller.enqueue(new TextEncoder().encode(delayedSitePlayurl))
          controller.close()
        }
      },
    }),
    { status: 201, headers: { 'x-website-playurl': 'original' } },
  )
  const readWebsiteBody = base.playurlFetchOverride.text.bind(base.playurlFetchOverride)
  Object.defineProperty(base.playurlFetchOverride, 'text', {
    value: () => {
      bodyReadStarted.resolve()
      return readWebsiteBody()
    },
  })
  let delayedPlayurlSettled = false
  const delayedPlayurlFetch = base.fakeWindow.fetch(base.apiEndpoint).then((response) => {
    delayedPlayurlSettled = true
    return response
  })
  await bodyReadStarted.promise
  assert.strictEqual(
    delayedPlayurlSettled,
    false,
    'website playurl response body remains pending before script is disabled',
  )
  await base.apiFailureSettings.update({ disabled: true })
  releaseDelayedPlayurl()
  const disabledDuringResponse = await delayedPlayurlFetch
  assert.strictEqual(
    disabledDuringResponse.status,
    201,
    'disabled script preserves pending website playurl status',
  )
  assert.strictEqual(
    disabledDuringResponse.headers.get('x-website-playurl'),
    'original',
    'disabled script preserves pending website playurl headers',
  )
  assert.strictEqual(
    await disabledDuringResponse.text(),
    delayedSitePlayurl,
    'disabled script passes the original pending website playurl body through unchanged',
  )
  base.playurlFetchOverride = null
  await base.apiFailureSettings.update({ disabled: false })
  base.apiFailureTransport.dispose()
  const throwingPlayurl = {
    transform: (): never => {
      throw new Error('synthetic transform failure')
    },
  }
  const throwingTransport = base.scope.own(
    new TransportAdapter(
      base.apiFailureSession,
      base.apiFailureSettings,
      base.apiFailureRoutes,
      throwingPlayurl,
      base.measurementStub,
      () => base.now,
      createRuntimeIds(),
    ),
  )
  throwingTransport.install()
  const transformFailurePayload = {
    code: 0,
    data: {
      dash: {
        video: [
          {
            id: 80,
            codecid: 13,
            height: 1080,
            bandwidth: 1_000_000,
            base_url: base.leakedNativeUrl,
            backup_url: [],
          },
        ],
        audio: [],
      },
    },
  }
  base.playurlFetchBody = JSON.stringify(transformFailurePayload)
  await base.assertNoRawNative(
    async () => await (await base.fakeWindow.fetch(base.apiEndpoint)).text(),
    'Catalog-only Fetch does not expose signed Native URL after transform throws',
  )
  const throwingTextXhr = new base.FakeXhr()
  throwingTextXhr.responseType = 'text'
  throwingTextXhr.payload = JSON.stringify(transformFailurePayload)
  throwingTextXhr.rawResponseText = JSON.stringify(transformFailurePayload)
  throwingTextXhr.open('GET', base.apiEndpoint)
  throwingTextXhr.send()
  await base.assertNoRawNative(
    () => throwingTextXhr.responseText,
    'Catalog-only XHR text does not expose signed Native URL after transform throws',
  )
  const throwingJsonXhr = new base.FakeXhr()
  throwingJsonXhr.responseType = 'json'
  throwingJsonXhr.payload = transformFailurePayload
  throwingJsonXhr.open('GET', base.apiEndpoint)
  throwingJsonXhr.send()
  await base.assertNoRawNative(
    () => throwingJsonXhr.response,
    'Catalog-only XHR JSON does not expose signed Native URL after transform throws',
  )
  await base.apiFailureSettings.update({ considerNativeSources: true })
  base.apiFailureRoutes.invalidateForUserSetting()
  base.playurlFetchBody = base.malformedApi
  assert.strictEqual(
    await (await base.fakeWindow.fetch(base.apiEndpoint)).text(),
    base.malformedApi,
    'Native-on Fetch preserves malformed website playurl response',
  )
  const nativeOnXhr = new base.FakeXhr()
  nativeOnXhr.responseType = 'text'
  nativeOnXhr.payload = base.malformedApi
  nativeOnXhr.rawResponseText = base.malformedApi
  nativeOnXhr.open('GET', base.apiEndpoint)
  nativeOnXhr.send()
  assert.strictEqual(
    nativeOnXhr.responseText,
    base.malformedApi,
    'Native-on XHR preserves malformed website playurl response',
  )
  const nativeOnLoadingXhr = new base.FakeXhr()
  nativeOnLoadingXhr.responseType = 'text'
  nativeOnLoadingXhr.holdAtLoading = true
  nativeOnLoadingXhr.payload = base.loadingSignedText
  nativeOnLoadingXhr.rawResponseText = base.loadingSignedText
  nativeOnLoadingXhr.open('GET', base.apiEndpoint)
  nativeOnLoadingXhr.send()
  assert.strictEqual(
    nativeOnLoadingXhr.responseText,
    base.loadingSignedText,
    'Native-on XHR LOADING responseText preserves website partial playurl',
  )
  assert.strictEqual(
    nativeOnLoadingXhr.response,
    base.loadingSignedText,
    'Native-on XHR LOADING text response preserves website partial playurl',
  )
}

async function checkCatalogOnlyXHRParameterPlayurlIsBlockedBeforeNativeSendBecause(
  t: TestContext,
  parameter = 0,
): Promise<void> {
  const base = await createCatalogOnlyXHRParameterPlayurlIsBlockedBeforeNativeSendBecauseContext8(t)

  let iteration = 0
  for (const responseType of ['blob', 'arraybuffer'] as const) {
    if (iteration++ === parameter) {
      const binaryXhr = new base.FakeXhr()
      binaryXhr.responseType = responseType
      binaryXhr.open('GET', base.apiEndpoint)
      binaryXhr.send()
      assert.strictEqual(
        binaryXhr.nativeSends,
        0,
        `Catalog-only XHR ${responseType} playurl is blocked before native send because its response cannot be sanitized`,
      )

      return
    }
  }
  throw Error('Unknown fixture parameter')
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
      'https://upos-sz-mirrorali02.bilivideo.com/upgcxcode/emitted-backup/third.m4s?signature=third',
      base.emittedThirdPartyBackup,
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
    'Native-on player output can emit a fifth signed route on an arbitrary host',
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
{
  let parameter = 0
  for (const responseType of ['blob', 'arraybuffer'] as const) {
    const selected = parameter++
    test(
      '`Catalog-only XHR ${responseType} playurl is blocked before native send because its response cannot  [9]' +
        ` / ${String(responseType)} / ${selected}`,
      { timeout: 5000 },
      async (t) => {
        await checkCatalogOnlyXHRParameterPlayurlIsBlockedBeforeNativeSendBecause(t, selected)
      },
    )
  }
}
test('partial playurl XHR fixture is still loading [10]', { timeout: 5000 }, async (t) => {
  await checkPartialPlayurlXHRFixtureIsStillLoading10(t)
})
{
  let parameter = 0
  for (const responseType of ['blob', 'arraybuffer'] as const) {
    const selected = parameter++
    test(
      '`Native-on XHR ${responseType} playurl retains website dispatch` [11]' +
        ` / ${String(responseType)} / ${selected}`,
      { timeout: 5000 },
      async (t) => {
        await checkNativeOnXHRParameterPlayurlRetainsWebsiteDispatch11ParameterParameter(
          t,
          selected,
        )
      },
    )
  }
}
test(
  'disabled script preserves malformed website Fetch playurl response [12]',
  { timeout: 5000 },
  async (t) => {
    await checkDisabledScriptPreservesMalformedWebsiteFetchPlayurlResponse12(t)
  },
)
{
  let parameter = 0
  for (const responseType of ['blob', 'arraybuffer'] as const) {
    const selected = parameter++
    test(
      '`disabled script preserves website XHR ${responseType} playurl dispatch` [13]' +
        ` / ${String(responseType)} / ${selected}`,
      { timeout: 5000 },
      async (t) => {
        await checkDisabledScriptPreservesWebsiteXHRParameterPlayurlDispatch13ParameterParameter(
          t,
          selected,
        )
      },
    )
  }
}
{
  let parameter = 0
  for (const suffix of ['szbdyd.com', 'mountaintoys.cn', 'nexusedgeio.com', 'ahdohpiechei.com']) {
    const selected = parameter++
    test(
      '`Catalog-only Fetch blocks known B station PCDN suffix ${suffix} before native dispatch` [14]' +
        ` / ${String(suffix)} / ${selected}`,
      { timeout: 5000 },
      async (t) => {
        await checkCatalogOnlyFetchBlocksKnownBStationPCDNSuffixParameterBefore(t, selected)
      },
    )
  }
}
test(
  'unattributed third-party .m4s Fetch remains website-owned [15]',
  { timeout: 5000 },
  async (t) => {
    await checkUnattributedThirdPartyM4sFetchRemainsWebsiteOwned15(t)
  },
)
test(
  'disabled script preserves oversized website Fetch dispatch [16]',
  { timeout: 5000 },
  async (t) => {
    await checkDisabledScriptPreservesOversizedWebsiteFetchDispatch16(t)
  },
)
import '../regressions/functional-races/xhr.ts'
import '../regressions/functional-races/cr-xhr-headers.ts'
import '../regressions/functional-races/cr-xhr-send-conversion.ts'
import '../regressions/functional-races/xhr-response-convergence.ts'
