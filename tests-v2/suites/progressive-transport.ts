import { installProgressEvent } from "../support/progress-event.ts"
import { createRuntimeIds } from "../../src-v2/platform/runtime-ids.ts"
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
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

// Each call creates fresh resources and replays only this fixture's prerequisite transitions.
// Earlier expectations run in their own cases; no mutable state crosses a test boundary.
async function fixture(t: TestContext, scenario: number, parameter = 0): Promise<() => Promise<void>> {
  const scope = testScope(t)
  installProgressEvent(scope)
const now = () => 2_000_000_000_000, storage = new FakeStorage()
const settings = scope.own(new SettingsStore(storage, now)), session = new SessionStore(), vault = new SignedRouteVault()
const state = session.beginGeneration(false);
vault.reset(state.generation, state.epoch)
const routes = new RouteCoordinator({ now }, session, settings, scope.own(new RestrictionStore(storage, now)),
    scope.own(new EvidenceStore(storage, now)), vault, createRuntimeIds())
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
scope.defineGlobal('unsafeWindow', { configurable: true, value: fakeWindow })
scope.defineGlobal('location', { configurable: true, value: new URL('https://www.bilibili.com/') })
const measurement = { willGateStartup: () => false, prepareStartup: async () => undefined, noteUnpreflighted: () => undefined } satisfies ConstructorParameters<typeof TransportAdapter>[4]
const transport = scope.own(new TransportAdapter(session, settings, routes, playurl, measurement, now, createRuntimeIds()))
transport.install()
const response = await fakeWindow.fetch(api)
if (scenario === 0) return async () => {
assert.strictEqual(response.status, 200, 'successful MP4 API remains HTTP 200 through Fetch')
const payload = await response.json() as ReturnType<typeof fixture>
assert.strictEqual(payload.code, 0, 'successful MP4 API is not replaced with synthetic -1')
assert.ok(isCatalogHost(new URL(payload.data.durl[0]!.url).hostname), 'Fetch emits Catalog MP4 primary')
}
void (response.status);
void (200);
const payload = await response.json() as ReturnType<typeof fixture>
void (payload.code);
void (0);
void (isCatalogHost(new URL(payload.data.durl[0]!.url).hostname));

if (scenario === 1) {
 let iteration = 0
for (const responseType of ['text', 'json'] as const) {
 if (iteration++ === parameter) return async () => {
    const xhr = new FakeXhr(); xhr.responseType = responseType; xhr.open('GET', api); xhr.send()
    const result = (responseType === 'json' ? xhr.response : JSON.parse(xhr.responseText)) as ReturnType<typeof fixture>
    assert.strictEqual(result.code, 0, `XHR ${responseType} accepts MP4 durl`)
    assert.ok(isCatalogHost(new URL(result.data.durl[0]!.url).hostname), `XHR ${responseType} emits Catalog primary`)
    xhr.payload = fixture(); xhr.open('GET', api); xhr.send()
    assert.strictEqual((responseType === 'json' ? xhr.response as ReturnType<typeof fixture> : JSON.parse(xhr.responseText)).code, 0,
      `XHR ${responseType} reuse resets transformed response`)
  }
 }
 throw Error('Unknown fixture parameter')
}
for (const responseType of ['text', 'json'] as const) {
    const xhr = new FakeXhr(); xhr.responseType = responseType; xhr.open('GET', api); xhr.send()
    const result = (responseType === 'json' ? xhr.response : JSON.parse(xhr.responseText)) as ReturnType<typeof fixture>
void (result.code);
void (0);
void (isCatalogHost(new URL(result.data.durl[0]!.url).hostname));
    xhr.payload = fixture(); xhr.open('GET', api); xhr.send()
void ((responseType === 'json' ? xhr.response as ReturnType<typeof fixture> : JSON.parse(xhr.responseText)).code);
void (0);
  }
await fakeWindow.fetch(payload.data.durl[0]!.url)
if (scenario === 2) return async () => {
assert.strictEqual(sent.at(-1)?.redirect, 'error', 'MP4 Catalog-only Fetch rejects redirects')
const before = sent.length
let denied = false
try { await fakeWindow.fetch(new Request(original, { method: 'POST' })) } catch { denied = true }
assert.ok(denied && sent.length === before, 'recognized non-GET MP4 does not reach native Fetch')
apiBody = JSON.stringify({ code: -403, data: { durl: [{ url: original }] } })
assert.strictEqual((await fakeWindow.fetch(api)).status, 503, 'upstream error retains strict local Fetch block contract')
assert.ok(!await (await fakeWindow.fetch(api)).text().then(text => text.includes('fixture=primary')),
    'upstream error cannot expose nested original URL')
await settings.update({ disabled: true })
assert.strictEqual(await (await fakeWindow.fetch(api)).text(), apiBody, 'disabled Fetch preserves website API body')
const disabledXhr = new FakeXhr();
disabledXhr.open('GET', api);
disabledXhr.send()
assert.strictEqual(disabledXhr.responseText, JSON.stringify(fixture()), 'disabled XHR preserves original MP4 body')
}
void (sent.at(-1)?.redirect);
void ('error');
const before = sent.length
let denied = false
try { await fakeWindow.fetch(new Request(original, { method: 'POST' })) } catch { denied = true }
void (denied && sent.length === before);
apiBody = JSON.stringify({ code: -403, data: { durl: [{ url: original }] } })
void ((await fakeWindow.fetch(api)).status);
void (503);
void (!await (await fakeWindow.fetch(api)).text().then(text => text.includes('fixture=primary')));
await settings.update({ disabled: true })
void (await (await fakeWindow.fetch(api)).text());
void (apiBody);
const disabledXhr = new FakeXhr();
disabledXhr.open('GET', api);
disabledXhr.send()
void (disabledXhr.responseText);
void (JSON.stringify(fixture()));
throw Error('Unknown fixture scenario')
}

test("successful MP4 API remains HTTP 200 through Fetch [1]", { timeout: 5000 }, async t => { await (await fixture(t, 0))() })
{
 let parameter = 0
for (const responseType of ['text', 'json'] as const) {
 const selected = parameter++
 test("`XHR ${responseType} accepts MP4 durl` [2]" + ` / ${String(responseType)} / ${selected}`, { timeout: 5000 }, async t => { await (await fixture(t, 1, selected))() })
}
}
test("MP4 Catalog-only Fetch rejects redirects [3]", { timeout: 5000 }, async t => { await (await fixture(t, 2))() })
