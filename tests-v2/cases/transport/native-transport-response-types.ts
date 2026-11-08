import { CatalogSettingsStore } from '../../support/catalog-settings.ts'
import { installProgressEvent } from '../../support/progress-event.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { deferred } from '../../support/deferred.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { type TestContext } from 'node:test'
import { PlayurlController } from '../../../src-v2/application/playurl/playurl-controller.ts'
import { SignedRouteVault } from '../../../src-v2/state/signed-route-vault.ts'
import { RestrictionStore } from '../../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../../src-v2/state/evidence-store.ts'
import { SessionStore } from '../../../src-v2/state/session-store.ts'
import { RouteCoordinator } from '../../../src-v2/application/routing/route-coordinator.ts'
import { TransportAdapter } from '../../../src-v2/adapters/transport/transport.ts'
import { PlayurlAdapter } from '../../../src-v2/adapters/playurl/playurl.ts'
import { FakeStorage } from '../../support/storage.ts'
import { testScope } from '../../support/scope.ts'
import { createNativeTransportResources } from './native-transport-resources.ts'

async function createRejectedApiResponses() {
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
  return { apiEndpoint, leakedNativeUrl, malformedApi, unsupportedApi, assertNoRawNative }
}

function createApiFailureStores(now: number, scope: ReturnType<typeof testScope>) {
  const apiFailureStorage = new FakeStorage()
  const apiFailureSettings = scope.own(new CatalogSettingsStore(apiFailureStorage, () => now))
  const apiFailureSession = new SessionStore()
  const apiFailureState = apiFailureSession.beginGeneration(false)
  const apiFailureVault = new SignedRouteVault()
  return {
    apiFailureStorage,
    apiFailureSettings,
    apiFailureSession,
    apiFailureState,
    apiFailureVault,
  }
}

async function createCatalogOnlyXHRParameterPlayurlIsBlockedBeforeNativeSendBecauseContext8(
  t: TestContext,
) {
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
  const block4 = createApiFailureStores(now, scope)
  const {
    apiFailureVault,
    apiFailureState,
    apiFailureSession,
    apiFailureSettings,
    apiFailureStorage,
  } = block4
  apiFailureVault.reset(apiFailureState.generation, apiFailureState.epoch)
  const apiFailureRoutes = new RouteCoordinator(
    clock,
    apiFailureSession,
    apiFailureSettings,
    scope.own(new RestrictionStore(apiFailureStorage, () => now)),
    scope.own(new EvidenceStore(apiFailureStorage, () => now)),
    apiFailureVault,
    createRuntimeIds(),
  )
  const apiFailurePlayurl = new PlayurlAdapter(
    new PlayurlController(apiFailureSession, apiFailureVault, apiFailureRoutes),
  )
  const apiFailureTransport = scope.own(
    new TransportAdapter(
      apiFailureSession,
      apiFailureSettings,
      apiFailureRoutes,
      apiFailurePlayurl,
      measurementStub,
      () => now,
      createRuntimeIds(),
      undefined,
      () => now,
    ),
  )
  apiFailureTransport.install()
  const block2 = await createRejectedApiResponses()
  const { apiEndpoint } = block2
  return {
    FakeXhr,
    apiEndpoint,
  }
}

async function createPartialPlayurlXHRFixtureIsStillLoading10Context9(t: TestContext) {
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
  const block4 = createApiFailureStores(now, scope)
  const {
    apiFailureVault,
    apiFailureState,
    apiFailureSession,
    apiFailureSettings,
    apiFailureStorage,
  } = block4
  apiFailureVault.reset(apiFailureState.generation, apiFailureState.epoch)
  const apiFailureRoutes = new RouteCoordinator(
    clock,
    apiFailureSession,
    apiFailureSettings,
    scope.own(new RestrictionStore(apiFailureStorage, () => now)),
    scope.own(new EvidenceStore(apiFailureStorage, () => now)),
    apiFailureVault,
    createRuntimeIds(),
  )
  const apiFailurePlayurl = new PlayurlAdapter(
    new PlayurlController(apiFailureSession, apiFailureVault, apiFailureRoutes),
  )
  const apiFailureTransport = scope.own(
    new TransportAdapter(
      apiFailureSession,
      apiFailureSettings,
      apiFailureRoutes,
      apiFailurePlayurl,
      measurementStub,
      () => now,
      createRuntimeIds(),
      undefined,
      () => now,
    ),
  )
  apiFailureTransport.install()
  const block2 = await createRejectedApiResponses()
  const { malformedApi, assertNoRawNative, apiEndpoint, unsupportedApi, leakedNativeUrl } = block2
  block1.playurlFetchBody = malformedApi
  await assertNoRawNative(
    async () => await (await fakeWindow.fetch(apiEndpoint)).text(),
    'Catalog-only Fetch does not expose a malformed HTTP-200 playurl carrying a signed Native URL',
  )
  block1.playurlFetchBody = JSON.stringify(unsupportedApi)
  await assertNoRawNative(
    async () => await (await fakeWindow.fetch(apiEndpoint)).text(),
    'Catalog-only Fetch does not expose a non-DASH HTTP-200 playurl carrying a signed Native URL',
  )
  const malformedTextXhr = new FakeXhr()
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
  const unsupportedTextXhr = new FakeXhr()
  unsupportedTextXhr.responseType = 'text'
  unsupportedTextXhr.payload = JSON.stringify(unsupportedApi)
  unsupportedTextXhr.rawResponseText = JSON.stringify(unsupportedApi)
  unsupportedTextXhr.open('GET', apiEndpoint)
  unsupportedTextXhr.send()
  await assertNoRawNative(
    () => unsupportedTextXhr.responseText,
    'Catalog-only XHR text response does not expose non-DASH playurl signed Native URL',
  )
  const unsupportedJsonXhr = new FakeXhr()
  unsupportedJsonXhr.responseType = 'json'
  unsupportedJsonXhr.payload = unsupportedApi
  unsupportedJsonXhr.open('GET', apiEndpoint)
  unsupportedJsonXhr.send()
  await assertNoRawNative(
    () => unsupportedJsonXhr.response,
    'Catalog-only XHR JSON response does not expose non-DASH playurl signed Native URL',
  )
  const loadingSignedText = `{"data":{"dash":{"video":[{"base_url":"${leakedNativeUrl}"`
  const loadingTextXhr = new FakeXhr()
  loadingTextXhr.responseType = 'text'
  loadingTextXhr.holdAtLoading = true
  loadingTextXhr.payload = loadingSignedText
  loadingTextXhr.rawResponseText = loadingSignedText
  loadingTextXhr.open('GET', apiEndpoint)
  loadingTextXhr.send()
  return {
    FakeXhr,
    apiEndpoint,
    apiFailureRoutes,
    apiFailureSession,
    apiFailureSettings,
    apiFailureTransport,
    apiFailureVault,
    assertNoRawNative,
    fakeWindow,
    leakedNativeUrl,
    loadingSignedText,
    loadingTextXhr,
    malformedApi,
    measurementStub,
    now,
    get playurlFetchBody() {
      return block1.playurlFetchBody
    },
    set playurlFetchBody(value: typeof block1.playurlFetchBody) {
      block1.playurlFetchBody = value
    },
    get playurlFetchOverride() {
      return block1.playurlFetchOverride
    },
    set playurlFetchOverride(value: typeof block1.playurlFetchOverride) {
      block1.playurlFetchOverride = value
    },
    scope,
  }
}

async function createNativeOnXHRParameterPlayurlRetainsWebsiteDispatch11ParameterParameterContext10(
  t: TestContext,
) {
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
  const block4 = createApiFailureStores(now, scope)
  const {
    apiFailureVault,
    apiFailureState,
    apiFailureSession,
    apiFailureSettings,
    apiFailureStorage,
  } = block4
  apiFailureVault.reset(apiFailureState.generation, apiFailureState.epoch)
  const apiFailureRoutes = new RouteCoordinator(
    clock,
    apiFailureSession,
    apiFailureSettings,
    scope.own(new RestrictionStore(apiFailureStorage, () => now)),
    scope.own(new EvidenceStore(apiFailureStorage, () => now)),
    apiFailureVault,
    createRuntimeIds(),
  )
  const block2 = await createRejectedApiResponses()
  const { malformedApi, apiEndpoint, leakedNativeUrl } = block2
  const loadingSignedText = `{"data":{"dash":{"video":[{"base_url":"${leakedNativeUrl}"`
  const throwingPlayurl = {
    transform: (): never => {
      throw new Error('synthetic transform failure')
    },
  }
  const throwingTransport = scope.own(
    new TransportAdapter(
      apiFailureSession,
      apiFailureSettings,
      apiFailureRoutes,
      throwingPlayurl,
      measurementStub,
      () => now,
      createRuntimeIds(),
      undefined,
      () => now,
    ),
  )
  throwingTransport.install()
  await apiFailureSettings.update({ considerNativeSources: true })
  apiFailureRoutes.invalidateForUserSetting()
  block1.playurlFetchBody = malformedApi
  const nativeOnXhr = new FakeXhr()
  nativeOnXhr.responseType = 'text'
  nativeOnXhr.payload = malformedApi
  nativeOnXhr.rawResponseText = malformedApi
  nativeOnXhr.open('GET', apiEndpoint)
  nativeOnXhr.send()
  const nativeOnLoadingXhr = new FakeXhr()
  nativeOnLoadingXhr.responseType = 'text'
  nativeOnLoadingXhr.holdAtLoading = true
  nativeOnLoadingXhr.payload = loadingSignedText
  nativeOnLoadingXhr.rawResponseText = loadingSignedText
  nativeOnLoadingXhr.open('GET', apiEndpoint)
  nativeOnLoadingXhr.send()
  return {
    FakeXhr,
    apiEndpoint,
  }
}

async function createDisabledScriptPreservesMalformedWebsiteFetchPlayurlResponse12Context11(
  t: TestContext,
) {
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
  const block4 = createApiFailureStores(now, scope)
  const {
    apiFailureVault,
    apiFailureState,
    apiFailureSession,
    apiFailureSettings,
    apiFailureStorage,
  } = block4
  apiFailureVault.reset(apiFailureState.generation, apiFailureState.epoch)
  const apiFailureRoutes = new RouteCoordinator(
    clock,
    apiFailureSession,
    apiFailureSettings,
    scope.own(new RestrictionStore(apiFailureStorage, () => now)),
    scope.own(new EvidenceStore(apiFailureStorage, () => now)),
    apiFailureVault,
    createRuntimeIds(),
  )
  const block2 = await createRejectedApiResponses()
  const { malformedApi, apiEndpoint, leakedNativeUrl } = block2
  const loadingSignedText = `{"data":{"dash":{"video":[{"base_url":"${leakedNativeUrl}"`
  const throwingPlayurl = {
    transform: (): never => {
      throw new Error('synthetic transform failure')
    },
  }
  const throwingTransport = scope.own(
    new TransportAdapter(
      apiFailureSession,
      apiFailureSettings,
      apiFailureRoutes,
      throwingPlayurl,
      measurementStub,
      () => now,
      createRuntimeIds(),
      undefined,
      () => now,
    ),
  )
  throwingTransport.install()
  await apiFailureSettings.update({ disabled: true, considerNativeSources: false })
  block1.playurlFetchBody = malformedApi
  return {
    apiFailureSettings,
    FakeXhr,
    apiEndpoint,
    fakeWindow,
    loadingSignedText,
    malformedApi,
  }
}

async function createDisabledApiXhrContext12(t: TestContext) {
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
  const block4 = createApiFailureStores(now, scope)
  const {
    apiFailureVault,
    apiFailureState,
    apiFailureSession,
    apiFailureSettings,
    apiFailureStorage,
  } = block4
  apiFailureVault.reset(apiFailureState.generation, apiFailureState.epoch)
  const apiFailureRoutes = new RouteCoordinator(
    clock,
    apiFailureSession,
    apiFailureSettings,
    scope.own(new RestrictionStore(apiFailureStorage, () => now)),
    scope.own(new EvidenceStore(apiFailureStorage, () => now)),
    apiFailureVault,
    createRuntimeIds(),
  )
  const block2 = await createRejectedApiResponses()
  const { malformedApi, apiEndpoint } = block2
  const throwingPlayurl = {
    transform: (): never => {
      throw new Error('synthetic transform failure')
    },
  }
  const throwingTransport = scope.own(
    new TransportAdapter(
      apiFailureSession,
      apiFailureSettings,
      apiFailureRoutes,
      throwingPlayurl,
      measurementStub,
      () => now,
      createRuntimeIds(),
      undefined,
      () => now,
    ),
  )
  throwingTransport.install()
  await apiFailureSettings.update({ disabled: true, considerNativeSources: false })
  block1.playurlFetchBody = malformedApi
  return {
    apiFailureSettings,
    FakeXhr,
    apiEndpoint,
  }
}

async function checkDisabledScriptPreservesWebsiteXHRParameterPlayurlDispatch13ParameterParameter(
  t: TestContext,
  parameter = 0,
): Promise<void> {
  const base = await createDisabledApiXhrContext12(t)
  assert.equal(base.apiFailureSettings.get().disabled, true)
  assert.equal(base.apiFailureSettings.get().considerNativeSources, false)

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
  assert.equal(base.apiFailureSettings.get().disabled, true)
  assert.equal(base.apiFailureSettings.get().considerNativeSources, false)

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
      undefined,
      () => base.now,
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
