import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import { FetchHookAdapter } from '../../src-v2/adapters/fetch-hook.ts'
import { XhrHookAdapter } from '../../src-v2/adapters/xhr-hook.ts'
import { TransportContext } from '../../src-v2/adapters/transport-context.ts'
import { classifyPlayurlApi, isPlayurlApi, TRUSTED_CATALOG } from '../../src-v2/domain/catalog.ts'
import { playurlRequestContext } from '../../src-v2/domain/playurl-content.ts'
import { createRuntimeIds } from '../../src-v2/platform/runtime-ids.ts'
import { fixture as runtimeFixture, media } from '../support/runtime-fixture.ts'

const endpoint = 'https://api.bilibili.com/ogv/player/playview'
const precheck = 'https://api.bilibili.com/ogv/player/pre/check/drm?cid=999'
const nested = (content: number) => ({ code: 0, data: { video_info: media(content).data } })

function fixture(t: TestContext) {
  const f = runtimeFixture(t)
  class NativeXhr extends EventTarget {
    #state = 0
    responseType: XMLHttpRequestResponseType = 'text'
    timeout = 0
    withCredentials = false
    responseURL = ''
    status = 0
    raw = ''
    json: unknown = null
    get readyState() {
      return this.#state
    }
    open(method: string, _url: string | URL, _async?: boolean) {
      if (method === 'BAD METHOD') throw new DOMException('method', 'SyntaxError')
      this.#state = 1
    }
    send() {}
    abort() {
      this.#state = 0
    }
    setRequestHeader(_name: string, _value: string) {}
    receive(payload: unknown) {
      this.raw = JSON.stringify(payload)
      this.json = payload
      this.status = 200
      this.#state = 4
    }
    get response() {
      return this.responseType === 'json' ? this.json : this.raw
    }
    get responseText() {
      if (this.responseType !== '' && this.responseType !== 'text')
        throw new DOMException('not text', 'InvalidStateError')
      return this.raw
    }
  }
  let payload: unknown = nested(100)
  let lastResponse: Response | null = null
  const nativeCalls: Request[] = []
  const windowFixture = {
    XMLHttpRequest: NativeXhr,
    fetch: async (request: Request) => {
      nativeCalls.push(request)
      lastResponse = new Response(JSON.stringify(payload), { status: 200 })
      return lastResponse
    },
  }
  f.scope.defineGlobal('unsafeWindow', { configurable: true, value: windowFixture })
  f.scope.defineGlobal('location', {
    configurable: true,
    value: new URL('https://www.bilibili.com/bangumi/play/epSynthetic'),
  })
  const context = new TransportContext(
    f.session,
    f.settings,
    f.routes,
    f.playurl,
    {
      willGateStartup: () => false,
      prepareStartup: async () => undefined,
      noteUnpreflighted: () => undefined,
    },
    f.clock.now,
    createRuntimeIds(),
  )
  const fetchHook = new FetchHookAdapter(context).install()
  const xhrHook = new XhrHookAdapter(context).install()
  assert.ok(fetchHook && xhrHook)
  f.scope.defer(() => fetchHook.restore())
  f.scope.defer(() => xhrHook.restore())
  return {
    ...f,
    context,
    NativeXhr,
    setPayload: (value: unknown) => {
      payload = value
    },
    fetch: (url: string) => windowFixture.fetch(new Request(url)),
    nativeCalls,
    nativeResponse: () => lastResponse,
  }
}

test('UP141-API exact OGV playview admission preserves ordinary endpoints and rejects precheck', (t) => {
  runtimeFixture(t)
  for (const value of [
    endpoint,
    endpoint + '?cid=0012',
    '//api.bilibili.com/ogv/player/playview',
  ]) {
    assert.equal(isPlayurlApi(value, 'https://www.bilibili.com/'), true, value)
    assert.equal(
      playurlRequestContext(
        value + (value.includes('?') ? '&x=1' : '?cid=0012'),
        'https://www.bilibili.com/',
      ).contentId,
      '12',
    )
  }
  for (const value of [
    precheck,
    endpoint + '/extra',
    endpoint + '/',
    endpoint.replace('https:', 'http:'),
    endpoint.replace('api.bilibili.com', 'api.bilibili.com.evil.invalid'),
    endpoint.replace('api.bilibili.com', 'user@api.bilibili.com'),
    endpoint.replace('api.bilibili.com', 'api.bilibili.com:444'),
  ])
    assert.equal(isPlayurlApi(value), false, value)
  assert.equal(isPlayurlApi('https://api.bilibili.com/x/player/wbi/playurl'), true)
  assert.equal(classifyPlayurlApi(precheck), 'ogv-precheck')
  assert.equal(playurlRequestContext(precheck).contentId, null)
  assert.equal(classifyPlayurlApi(endpoint + '?redirect=https://example.invalid'), 'ogv-playview')
  assert.equal(
    classifyPlayurlApi('https://api.bilibili.com:443/ogv/player/playview'),
    'ogv-playview',
  )
})

test('UP141-API Fetch transforms nested OGV data and uses request cid for episode identity', async (t) => {
  const f = fixture(t)
  const first = await f.fetch(endpoint + '?cid=100')
  assert.equal(f.context.snapshot().lastPlayurl?.accepted, true)
  const output = (await first.json()) as ReturnType<typeof nested>
  assert.notEqual(
    output.data.video_info.dash.video[0]!.base_url,
    media(100).data.dash.video[0]!.base_url,
  )
  const epoch = f.session.get().epoch
  f.setPayload(nested(200))
  await f.fetch(endpoint + '?cid=100')
  assert.equal(
    f.session.get().epoch,
    epoch,
    'same request cid retains identity despite changed directory',
  )
  f.setPayload(nested(300))
  await f.fetch(endpoint + '?cid=300')
  assert.notEqual(f.session.get().epoch, epoch, 'different request cid creates a content epoch')
  assert.equal(f.nativeCalls.length, 3)
  assert.equal(f.context.snapshot().lastPlayurl?.endpointKind, 'ogv-playview')
})

for (const type of ['text', 'json'] as const) {
  test(`UP141-API XHR ${type} OGV transforms once and preserves native getter semantics`, (t) => {
    const f = fixture(t),
      xhr = new f.NativeXhr()
    xhr.open('GET', '//api.bilibili.com/ogv/player/playview?cid=100', true)
    xhr.responseType = type
    xhr.receive(nested(100))
    const initial = xhr.response
    assert.equal(f.context.snapshot().lastPlayurl?.accepted, true)
    assert.equal(xhr.response, initial)
    if (type === 'text') assert.equal(xhr.responseText, initial)
    else assert.throws(() => xhr.responseText, { name: 'InvalidStateError' })
  })

  test(`UP141-API XHR ${type} precheck passes through before and after the active episode`, async (t) => {
    const f = fixture(t)
    const before = f.session.get().epoch
    for (const stage of ['before', 'after'] as const) {
      const xhr = new f.NativeXhr()
      xhr.open('GET', precheck, true)
      xhr.responseType = type
      const body = nested(999)
      xhr.receive(body)
      assert.equal(xhr.response, type === 'json' ? body : JSON.stringify(body))
      assert.equal(f.session.get().epoch, before)
      if (stage === 'before') await f.fetch(endpoint + '?cid=100')
      else assert.equal(f.context.snapshot().lastPlayurl?.accepted, true)
    }
  })
}

test('UP141-API Fetch precheck preserves native response and unread body without content authority', async (t) => {
  const f = fixture(t)
  const epoch = f.session.get().epoch
  const response = await f.fetch(precheck)
  assert.equal(response, f.nativeResponse())
  assert.equal(response.bodyUsed, false)
  assert.equal(f.context.snapshot().lastPlayurl, null)
  assert.equal(f.session.get().epoch, epoch)
  assert.equal(f.session.get().representation, null)
  const summary = f.context.snapshot().lastApiEndpoint
  assert.deepEqual(summary, { kind: 'ogv-precheck', transport: 'fetch', observedAt: f.clock.now() })
  assert.equal(Object.isFrozen(summary), true)
  assert.equal(
    JSON.stringify(summary).includes('999'),
    false,
    'no cid or request URL enters endpoint summary',
  )
})

test('UP141-API failed XHR open retains the prior endpoint and request context owner', (t) => {
  const f = fixture(t),
    xhr = new f.NativeXhr()
  xhr.open('GET', endpoint + '?cid=100', true)
  const summary = f.context.snapshot().lastApiEndpoint
  assert.throws(() => xhr.open('BAD METHOD', precheck, true), { name: 'SyntaxError' })
  assert.equal(f.context.snapshot().lastApiEndpoint, summary)
  xhr.receive(nested(100))
  void xhr.response
  assert.equal(f.context.snapshot().lastPlayurl?.endpointKind, 'ogv-playview')
  assert.equal(f.context.snapshot().lastPlayurl?.accepted, true)
})

test('UP141-API no legal Catalog route rejects OGV without passing original media', async (t) => {
  const f = fixture(t)
  await f.settings.update({
    catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map((host) => [host, false])),
  })
  const response = await f.fetch(endpoint + '?cid=100')
  assert.equal(response.status, 503)
  assert.equal(f.context.snapshot().lastPlayurl?.reason, 'no-legal-route')
  assert.equal((await response.text()).includes('upgcxcode'), false)
})

for (const mode of ['disabled', 'comparison', 'native-off'] as const) {
  test(`UP141-API ${mode} retains the existing OGV transport policy`, async (t) => {
    const f = fixture(t)
    if (mode === 'disabled') await f.settings.update({ disabled: true })
    if (mode === 'comparison') f.routes.setOriginalComparison(true)
    const response = await f.fetch(endpoint + '?cid=100')
    assert.equal(response.status, 200)
    if (mode === 'disabled') {
      assert.equal(response, f.nativeResponse())
      assert.equal(f.context.snapshot().lastPlayurl, null)
      assert.equal(f.session.get().representation, null)
    } else {
      assert.equal(f.context.snapshot().lastPlayurl?.accepted, true)
      assert.equal(f.routes.isCatalogOnly(), mode === 'native-off')
    }
  })
}

for (const [name, payload, reason] of [
  ['upstream error', { code: -10403, data: null }, 'upstream-error'],
  ['empty nested', { code: 0, data: { video_info: {} } }, 'unsupported-format'],
  ['malformed nested', { code: 0, data: { video_info: { dash: 'bad' } } }, 'malformed-payload'],
] as const) {
  test(`UP141-API Fetch ${name} retains strict rejection`, async (t) => {
    const f = fixture(t)
    f.setPayload(payload)
    const response = await f.fetch(endpoint)
    assert.equal(response.status, 503)
    assert.equal(f.context.snapshot().lastPlayurl?.reason, reason)
    assert.equal(f.session.get().representation, null)
  })
}
