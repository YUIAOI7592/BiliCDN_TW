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
import {
  fixture as routingFixture,
  media as routingMedia,
  dash as routingDash,
} from '../routing/routing-fixture.ts'
import { createNativeTransportResources } from './native-transport-resources.ts'

async function createCatalogOnlyFetchBlocksKnownBStationPCDNSuffixParameterBeforeContext13(
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
  const oversizedStorage = new FakeStorage()
  const oversizedSettings = scope.own(new CatalogSettingsStore(oversizedStorage, () => now))
  const oversizedSession = new SessionStore()
  const oversizedState = oversizedSession.beginGeneration(false)
  const oversizedVault = new SignedRouteVault()
  oversizedVault.reset(oversizedState.generation, oversizedState.epoch)
  const oversizedRoutes = new RouteCoordinator(
    clock,
    oversizedSession,
    oversizedSettings,
    scope.own(new RestrictionStore(oversizedStorage, () => now)),
    scope.own(new EvidenceStore(oversizedStorage, () => now)),
    oversizedVault,
    createRuntimeIds(),
  )
  const oversizedPlayurl = new PlayurlAdapter(
    new PlayurlController(oversizedSession, oversizedVault, oversizedRoutes),
  )
  const oversizedTransport = scope.own(
    new TransportAdapter(
      oversizedSession,
      oversizedSettings,
      oversizedRoutes,
      oversizedPlayurl,
      measurementStub,
      () => now,
      createRuntimeIds(),
      undefined,
      () => now,
    ),
  )
  oversizedTransport.install()
  return {
    FakeXhr,
    fakeWindow,
    get nativeFetchCalls() {
      return block1.nativeFetchCalls
    },
    set nativeFetchCalls(value: typeof block1.nativeFetchCalls) {
      block1.nativeFetchCalls = value
    },
  }
}

async function createUnattributedThirdPartyM4sFetchRemainsWebsiteOwned15Context14(t: TestContext) {
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
  const oversizedStorage = new FakeStorage()
  const oversizedSettings = scope.own(new CatalogSettingsStore(oversizedStorage, () => now))
  const oversizedSession = new SessionStore()
  const oversizedState = oversizedSession.beginGeneration(false)
  const oversizedVault = new SignedRouteVault()
  oversizedVault.reset(oversizedState.generation, oversizedState.epoch)
  const oversizedRoutes = new RouteCoordinator(
    clock,
    oversizedSession,
    oversizedSettings,
    scope.own(new RestrictionStore(oversizedStorage, () => now)),
    scope.own(new EvidenceStore(oversizedStorage, () => now)),
    oversizedVault,
    createRuntimeIds(),
  )
  const oversizedPlayurl = new PlayurlAdapter(
    new PlayurlController(oversizedSession, oversizedVault, oversizedRoutes),
  )
  const oversizedTransport = scope.own(
    new TransportAdapter(
      oversizedSession,
      oversizedSettings,
      oversizedRoutes,
      oversizedPlayurl,
      measurementStub,
      () => now,
      createRuntimeIds(),
      undefined,
      () => now,
    ),
  )
  oversizedTransport.install()
  const thirdPartyMedia = 'https://cdn.example.net/video.m4s?signature=outside'
  return {
    FakeXhr,
    fakeWindow,
    get nativeFetchCalls() {
      return block1.nativeFetchCalls
    },
    set nativeFetchCalls(value: typeof block1.nativeFetchCalls) {
      block1.nativeFetchCalls = value
    },
    oversizedRoutes,
    oversizedSettings,
    oversizedTransport,
    thirdPartyMedia,
  }
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
    'oversized media block status never includes the signed URL or query',
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
  } catch {}
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

for (const transportKind of ['fetch', 'xhr'] as const) {
  for (const range of ['bytes=10-65545', 'bytes=1-', 'bytes=0-1,3-4']) {
    test(
      'V227 dispatch: ' + transportKind + ' passes bounded request facts for ' + range,
      async (t) => {
        const scope = testScope(t),
          f = routingFixture(scope),
          resources = await createNativeTransportResources()
        scope.defineGlobal('unsafeWindow', { configurable: true, value: resources.fakeWindow })
        scope.defineGlobal('location', {
          configurable: true,
          value: new URL('https://www.bilibili.com/video/synthetic'),
        })
        installProgressEvent(scope)
        const url = routingMedia('v227-range', 'video.m4s')
        assert.equal(f.adapter.transform(routingDash(url)).accepted, true)
        const sizes: (number | null | undefined)[] = [],
          gates: (number | null | undefined)[] = [],
          apply = f.routes.apply.bind(f.routes)
        f.routes.apply = (...args) => {
          sizes.push(args[4])
          return apply(...args)
        }
        const transport = scope.own(
          new TransportAdapter(
            f.session,
            f.settings,
            f.routes,
            f.adapter,
            {
              willGateStartup: () => true,
              prepareStartup: async (_url, _signal, bytes) => {
                gates.push(bytes)
              },
              noteUnpreflighted: () => undefined,
            },
            f.clock.now,
            createRuntimeIds(),
            undefined,
            f.clock.now,
          ),
        )
        transport.install()
        assert.equal(transport.snapshot().hookState, 'installed')
        if (transportKind === 'fetch') {
          const response = await resources.fakeWindow.fetch(url, { headers: { Range: range } })
          await response.body?.cancel('case-complete')
        } else {
          const xhr = new resources.FakeXhr()
          xhr.open('GET', url)
          xhr.setRequestHeader('Range', range)
          const complete = deferred<void>()
          xhr.addEventListener('loadend', () => complete.resolve(), { once: true })
          xhr.send()
          await complete.promise
          assert.equal(xhr.nativeSends, 1)
        }
        const expected = range === 'bytes=10-65545' ? 65536 : null
        assert.equal(gates.at(-1), expected)
        assert.equal(sizes.at(-1), expected)
        assert.equal(f.routes.latestRequested('video')?.expectedBytes, expected)
      },
    )
  }
}
