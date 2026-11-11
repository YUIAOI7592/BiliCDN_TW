import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { TransportAdapter } from '../../../src-v2/adapters/transport/transport.ts'
import { deferred } from '../../support/deferred.ts'
import { installProgressEvent } from '../../support/progress-event.ts'
import { testScope } from '../../support/scope.ts'
import {
  fixture as routingFixture,
  media as routingMedia,
  dash as routingDash,
} from '../routing/routing-fixture.ts'
import { createNativeTransportResources } from './native-transport-resources.ts'

async function fixture(t: TestContext) {
  const scope = testScope(t),
    f = routingFixture(scope),
    resources = await createNativeTransportResources()
  installProgressEvent(scope)
  scope.defineGlobal('unsafeWindow', { configurable: true, value: resources.fakeWindow })
  scope.defineGlobal('location', {
    configurable: true,
    value: new URL('https://www.bilibili.com/video/BVtest/'),
  })
  const transport = scope.own(
    new TransportAdapter(
      f.session,
      f.settings,
      f.routes,
      f.adapter,
      {
        willGateStartup: () => false,
        prepareStartup: async () => undefined,
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
  return { ...f, resources, transport }
}
const oversized =
  'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/video.m4s?signature=oversized-secret-' +
  'x'.repeat(17 * 1024)

for (const suffix of ['szbdyd.com', 'mountaintoys.cn', 'nexusedgeio.com', 'ahdohpiechei.com']) {
  test(`Catalog-only Fetch and XHR block known PCDN suffix ${suffix} [14]`, async (t) => {
    const f = await fixture(t),
      r = f.resources
    const url = `https://node.${suffix}/video.m4s?signature=pcdn-secret`
    await assert.rejects(r.fakeWindow.fetch(url), /blocked media request/)
    assert.equal(r.nativeFetchCalls, 0)
    const xhr = new r.FakeXhr()
    xhr.open('GET', url)
    xhr.send()
    assert.equal(xhr.nativeSends, 0)
  })
}

test('third-party media stays website-owned while oversized B station media obeys Native policy [15]', async (t) => {
  const f = await fixture(t),
    r = f.resources
  const thirdParty = 'https://cdn.example.net/video.m4s?signature=outside'
  const response = await r.fakeWindow.fetch(thirdParty)
  assert.deepEqual(r.nativeFetchUrls, [thirdParty])
  await response.body?.cancel('case-complete')
  const other = new r.FakeXhr()
  other.open('GET', thirdParty)
  other.send()
  assert.equal(other.nativeSends, 1)
  assert.equal(other.url, thirdParty)

  await assert.rejects(r.fakeWindow.fetch(oversized), /blocked media request/)
  assert.equal(r.nativeFetchCalls, 1)
  const blocked = new r.FakeXhr()
  blocked.open('GET', oversized)
  blocked.send()
  assert.equal(blocked.nativeSends, 0)
  assert.equal(JSON.stringify(f.transport.snapshot()).includes('oversized-secret'), false)
  await f.settings.update({ considerNativeSources: true })
  f.routes.invalidateForUserSetting()
  const allowed = await r.fakeWindow.fetch(oversized)
  assert.equal(r.nativeFetchCalls, 2)
  assert.equal(r.nativeFetchUrls.at(-1), oversized)
  await allowed.body?.cancel('case-complete')
  const native = new r.FakeXhr()
  native.open('GET', oversized)
  native.send()
  assert.equal(native.nativeSends, 1)
  assert.equal(native.url, oversized)
})

test('disabled script preserves oversized website Fetch and XHR dispatch [16]', async (t) => {
  const f = await fixture(t),
    r = f.resources
  await f.settings.update({ disabled: true, considerNativeSources: false })
  const response = await r.fakeWindow.fetch(oversized)
  assert.deepEqual(r.nativeFetchUrls, [oversized])
  await response.body?.cancel('case-complete')
  const xhr = new r.FakeXhr()
  xhr.open('GET', oversized)
  xhr.send()
  assert.equal(xhr.nativeSends, 1)
  assert.equal(xhr.url, oversized)
})

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
