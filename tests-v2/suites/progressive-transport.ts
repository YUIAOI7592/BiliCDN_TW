import { PlayurlAdapter } from '../../src-v2/adapters/playurl.ts'
import { TransportAdapter } from '../../src-v2/adapters/transport.ts'
import { PlayurlController } from '../../src-v2/application/playurl-controller.ts'
import { RouteCoordinator } from '../../src-v2/application/route-coordinator.ts'
import { SettingsStore } from '../../src-v2/state/settings-store.ts'
import { RestrictionStore } from '../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../src-v2/state/evidence-store.ts'
import { SessionStore } from '../../src-v2/state/session-store.ts'
import { SignedRouteVault } from '../../src-v2/state/signed-route-vault.ts'
import { isCatalogHost } from '../../src-v2/domain/catalog.ts'
import { FakeStorage } from '../support/storage.ts'
import { testScope } from '../support/scope.ts'
import { check, equal, assertionCount } from '../support/assert.ts'

const scope = testScope()
try {
  const now = () => 2_000_000_000_000, storage = new FakeStorage()
  const settings = scope.own(new SettingsStore(storage, now)), session = new SessionStore(), vault = new SignedRouteVault()
  const state = session.beginGeneration(false); vault.reset(state.generation, state.epoch)
  const routes = new RouteCoordinator({ now }, session, settings, scope.own(new RestrictionStore(storage, now)),
    scope.own(new EvidenceStore(storage, now)), vault)
  const playurl = new PlayurlAdapter(new PlayurlController(session, vault, routes, settings))
  const original = 'https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/progressive-transport/one.mp4?fixture=primary'
  const fixture = () => ({ code: 0, message: 'OK', data: { format: 'mp4', quality: 64,
    durl: [{ order: 1, length: 30_000, size: 3_000_000, url: original,
      backup_url: ['https://upos-sz-mirrorali.bilivideo.com/upgcxcode/progressive-transport/one.mp4?fixture=backup'] }] } })
  let apiBody = JSON.stringify(fixture())
  const api = 'https://api.bilibili.com/x/player/wbi/playurl?fixture=progressive'
  const sent: { url: string; method: string; redirect: RequestRedirect }[] = []
  const nativeFetch = async (input: RequestInfo | URL): Promise<Response> => {
    const request = new Request(input)
    sent.push({ url: request.url, method: request.method, redirect: request.redirect })
    return request.url.includes('/playurl') ? new Response(apiBody, { status: 200,
      headers: { 'content-type': 'application/json' } }) : new Response(new Uint8Array(70 * 1024), { status: 206 })
  }
  class FakeXhr extends EventTarget {
    url = ''; method = ''; readyState = 0; status = 200; responseURL = ''; timeout = 0; withCredentials = false
    responseType: XMLHttpRequestResponseType = ''; payload: unknown = fixture(); nativeSends = 0
    get response(): unknown { return this.responseType === 'json' ? this.payload : JSON.stringify(this.payload) }
    get responseText(): string { return JSON.stringify(this.payload) }
    open(method: string, url: string | URL): void { this.method = method; this.url = String(url); this.responseURL = this.url; this.readyState = 1 }
    send(): void { this.nativeSends++; this.readyState = 4; this.dispatchEvent(new Event('readystatechange'));
      this.dispatchEvent(new Event('load')); this.dispatchEvent(new Event('loadend')) }
    abort(): void { this.dispatchEvent(new Event('abort')); this.dispatchEvent(new Event('loadend')) }
    setRequestHeader(_name: string, _value: string): void {}
  }
  const fakeWindow = { fetch: nativeFetch, XMLHttpRequest: FakeXhr }
  Object.defineProperty(globalThis, 'unsafeWindow', { configurable: true, value: fakeWindow })
  Object.defineProperty(globalThis, 'location', { configurable: true, value: new URL('https://www.bilibili.com/') })
  const measurement = { willGateStartup: () => false, prepareStartup: async () => undefined, noteUnpreflighted: () => undefined } satisfies ConstructorParameters<typeof TransportAdapter>[4]
  const transport = scope.own(new TransportAdapter(session, settings, routes, playurl, measurement, now))
  transport.install()
  const response = await fakeWindow.fetch(api)
  equal(response.status, 200, 'successful MP4 API remains HTTP 200 through Fetch')
  const payload = await response.json() as ReturnType<typeof fixture>
  equal(payload.code, 0, 'successful MP4 API is not replaced with synthetic -1')
  check(isCatalogHost(new URL(payload.data.durl[0]!.url).hostname), 'Fetch emits Catalog MP4 primary')
  for (const responseType of ['text', 'json'] as const) {
    const xhr = new FakeXhr(); xhr.responseType = responseType; xhr.open('GET', api); xhr.send()
    const result = (responseType === 'json' ? xhr.response : JSON.parse(xhr.responseText)) as ReturnType<typeof fixture>
    equal(result.code, 0, `XHR ${responseType} accepts MP4 durl`)
    check(isCatalogHost(new URL(result.data.durl[0]!.url).hostname), `XHR ${responseType} emits Catalog primary`)
    xhr.payload = fixture(); xhr.open('GET', api); xhr.send()
    equal((responseType === 'json' ? xhr.response as ReturnType<typeof fixture> : JSON.parse(xhr.responseText)).code, 0,
      `XHR ${responseType} reuse resets transformed response`)
  }
  await fakeWindow.fetch(payload.data.durl[0]!.url)
  equal(sent.at(-1)?.redirect, 'error', 'MP4 Catalog-only Fetch rejects redirects')
  const before = sent.length
  let denied = false
  try { await fakeWindow.fetch(new Request(original, { method: 'POST' })) } catch { denied = true }
  check(denied && sent.length === before, 'recognized non-GET MP4 does not reach native Fetch')
  apiBody = JSON.stringify({ code: -403, data: { durl: [{ url: original }] } })
  equal((await fakeWindow.fetch(api)).status, 503, 'upstream error retains strict local Fetch block contract')
  check(!await (await fakeWindow.fetch(api)).text().then(text => text.includes('fixture=primary')),
    'upstream error cannot expose nested original URL')
  await settings.update({ disabled: true })
  equal(await (await fakeWindow.fetch(api)).text(), apiBody, 'disabled Fetch preserves website API body')
  const disabledXhr = new FakeXhr(); disabledXhr.open('GET', api); disabledXhr.send()
  equal(disabledXhr.responseText, JSON.stringify(fixture()), 'disabled XHR preserves original MP4 body')
  console.log(`progressive-transport: ${assertionCount()} assertions passed`)
} finally { scope.dispose() }
