import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { TransportAdapter } from '../../../src-v2/adapters/transport/transport.ts'
import { deferred } from '../../support/deferred.ts'
import { installProgressEvent } from '../../support/progress-event.ts'
import { testScope } from '../../support/scope.ts'
import { fixture as routingFixture } from '../routing/routing-fixture.ts'
import { createNativeTransportResources } from './native-transport-resources.ts'

const api = 'https://api.bilibili.com/x/player/wbi/playurl?cid=contract'
const signed =
  'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/api-failure/video.m4s?signature=raw-secret'
const malformed = `{"data":{"dash":{"video":[{"base_url":"${signed}"}`
const partial = `{"data":{"dash":{"video":[{"base_url":"${signed}"`
const unsupported = { code: 0, data: { sources: [{ url: signed }] } }
const valid = () => ({
  code: 0,
  data: {
    dash: {
      video: [
        {
          id: 80,
          codecid: 13,
          height: 1080,
          bandwidth: 1_000_000,
          base_url: signed,
          backup_url: [],
        },
      ],
      audio: [],
    },
  },
})
const blocked = { code: -1, message: 'BiliCDN Catalog route unavailable' }

async function fixture(t: TestContext) {
  const scope = testScope(t),
    f = routingFixture(scope),
    r = await createNativeTransportResources()
  installProgressEvent(scope)
  scope.defineGlobal('unsafeWindow', { configurable: true, value: r.fakeWindow })
  scope.defineGlobal('location', {
    configurable: true,
    value: new URL('https://www.bilibili.com/video/BVtest/'),
  })
  let transformCalls = 0,
    failTransform = false
  const transport = scope.own(
    new TransportAdapter(
      f.session,
      f.settings,
      f.routes,
      {
        transform: (...args: Parameters<typeof f.adapter.transform>) => {
          transformCalls++
          if (failTransform) throw new Error('synthetic transform failure')
          return f.adapter.transform(...args)
        },
      },
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
  const xhr = (type: XMLHttpRequestResponseType, body: unknown, loading = false) => {
    const request = new r.FakeXhr()
    scope.defer(() => request.abort())
    request.responseType = type
    request.payload = body
    request.rawResponseText = typeof body === 'string' ? body : JSON.stringify(body)
    request.holdAtLoading = loading
    request.open('GET', api)
    request.send()
    assert.equal(request.nativeSends, 1)
    return request
  }
  return {
    ...f,
    scope,
    r,
    xhr,
    get transformCalls() {
      return transformCalls
    },
    get failTransform() {
      return failTransform
    },
    set failTransform(value: boolean) {
      failTransform = value
    },
  }
}

for (const mode of ['Catalog-only', 'Native-on', 'disabled'] as const) {
  for (const type of ['blob', 'arraybuffer'] as const) {
    test(`XHR ${type} playurl dispatch respects ${mode} policy [9/11/13]`, async (t) => {
      const f = await fixture(t)
      await f.settings.update({
        disabled: mode === 'disabled',
        considerNativeSources: mode === 'Native-on',
      })
      f.routes.invalidateForUserSetting()
      const xhr = new f.r.FakeXhr()
      xhr.responseType = type
      xhr.open('GET', api)
      xhr.send()
      assert.equal(xhr.nativeSends, mode === 'Catalog-only' ? 0 : 1)
      assert.equal(f.transformCalls, 0)
    })
  }
}

test(
  'playurl response failures, partial reads and lifecycle changes preserve their transport contracts [10]',
  { timeout: 5000 },
  async (t) => {
    const f = await fixture(t),
      r = f.r
    for (const body of [malformed, JSON.stringify(unsupported)]) {
      r.playurlFetchBody = body
      const response = await r.fakeWindow.fetch(api)
      assert.equal(response.status, 503)
      assert.deepEqual(await response.json(), blocked)
      const xhr = f.xhr('text', body)
      assert.equal(xhr.readyState, 4)
      assert.deepEqual(JSON.parse(xhr.responseText), blocked)
      assert.equal(xhr.response, xhr.responseText)
    }
    assert.deepEqual(f.xhr('json', unsupported).response, blocked)
    const loading = f.xhr('text', partial, true)
    assert.equal(loading.readyState, 3)
    assert.equal(loading.responseText, '')
    assert.equal(loading.response, '')

    const websiteBody = JSON.stringify(valid(), null, 2)
    const staleText = f.xhr('text', websiteBody),
      staleJson = f.xhr('json', JSON.parse(websiteBody))
    const state = f.session.beginGeneration(false)
    f.vault.reset(state.generation, state.epoch)
    f.routes.resetEpoch()
    assert.deepEqual(JSON.parse(staleText.responseText), blocked)
    assert.equal(staleText.response, staleText.responseText)
    assert.deepEqual(staleJson.response, blocked)

    const reading = deferred<void>()
    let released = false
    let release: () => void = () => undefined
    const original = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          release = () => {
            if (released) return
            released = true
            controller.enqueue(new TextEncoder().encode(websiteBody))
            controller.close()
          }
        },
      }),
      { status: 201, headers: { 'x-website-playurl': 'original' } },
    )
    const read = original.text.bind(original)
    f.scope.defer(() => release())
    Object.defineProperty(original, 'text', {
      value: () => {
        reading.resolve()
        return read()
      },
    })
    r.playurlFetchOverride = original
    let settled = false
    const pending = r.fakeWindow.fetch(api).then((response) => {
      settled = true
      return response
    })
    await reading.promise
    assert.equal(settled, false)
    await f.settings.update({ disabled: true })
    release()
    const preserved = await pending
    assert.equal(preserved.status, 201)
    assert.equal(preserved.headers.get('x-website-playurl'), 'original')
    assert.equal(await preserved.text(), websiteBody)
    r.playurlFetchOverride = null
    await f.settings.update({ disabled: false })

    f.failTransform = true
    r.playurlFetchBody = JSON.stringify(valid())
    const beforeFailure = f.transformCalls
    const failure = await r.fakeWindow.fetch(api)
    assert.equal(failure.status, 503)
    assert.deepEqual(await failure.json(), blocked)
    assert.deepEqual(JSON.parse(f.xhr('text', JSON.stringify(valid())).responseText), blocked)
    assert.deepEqual(f.xhr('json', valid()).response, blocked)
    assert.equal(f.transformCalls, beforeFailure + 3)

    await f.settings.update({ considerNativeSources: true })
    f.routes.invalidateForUserSetting()
    r.playurlFetchBody = malformed
    assert.equal(await (await r.fakeWindow.fetch(api)).text(), malformed)
    assert.equal(f.xhr('text', malformed).responseText, malformed)
    const nativeLoading = f.xhr('text', partial, true)
    assert.equal(nativeLoading.readyState, 3)
    assert.equal(nativeLoading.responseText, partial)
    assert.equal(nativeLoading.response, partial)
  },
)

test('disabled script preserves malformed and partial website Fetch and XHR responses [12]', async (t) => {
  const f = await fixture(t)
  f.failTransform = true
  await f.settings.update({ disabled: true, considerNativeSources: false })
  f.r.playurlFetchBody = malformed
  assert.equal(await (await f.r.fakeWindow.fetch(api)).text(), malformed)
  assert.equal(f.xhr('text', malformed).responseText, malformed)
  const loading = f.xhr('text', partial, true)
  assert.equal(loading.readyState, 3)
  assert.equal(loading.responseText, partial)
  assert.equal(loading.response, partial)
  assert.equal(f.transformCalls, 0)
})
