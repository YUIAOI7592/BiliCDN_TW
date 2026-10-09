import { installProgressEvent } from "../../support/progress-event.ts"
import { createRuntimeIds } from "../../../src-v2/platform/runtime-ids.ts"
import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { TransportAdapter } from '../../../src-v2/adapters/transport.ts'
import { PlayurlAdapter } from '../../../src-v2/adapters/playurl.ts'
import { PlayurlController } from '../../../src-v2/application/playurl-controller.ts'
import { RouteCoordinator } from '../../../src-v2/application/route-coordinator.ts'
import { SessionStore } from '../../../src-v2/state/session-store.ts'
import { SettingsStore } from '../../../src-v2/state/settings-store.ts'
import { RestrictionStore } from '../../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../../src-v2/state/evidence-store.ts'
import { SignedRouteVault } from '../../../src-v2/state/signed-route-vault.ts'
import { testScope } from '../../support/scope.ts'
import { deferred } from '../../support/deferred.ts'
import { FakeStorage } from '../../support/storage.ts'

const originalUrl = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/11/22/1000/1000-1-30080.m4s?test=synthetic'
const apiUrl = 'https://api.bilibili.com/x/player/wbi/playurl?cid=1000'
const payload = () => ({ code: 0, data: { dash: { video: [{ id: 80, codecid: 7, height: 1080,
  bandwidth: 1_000_000, base_url: originalUrl, backup_url: [] }], audio: [] } } })

async function fixture(t: TestContext, native = true, gate = false) {
  const scope = testScope(t), now = () => 2_000_000_000_000
  installProgressEvent(scope)
  // Minimal native state model follows https://xhr.spec.whatwg.org/#the-abort()-method.
  // Unlike existing FakeXhr, abort() before native send does not invent terminal events.
  class NativeXhr extends EventTarget {
    #state = 0
    get readyState() { return this.#state }
    status = 0; responseURL = ''; syncMode = false
    #responseType: XMLHttpRequestResponseType = ''; #timeout = 0
    get responseType() { return this.#responseType }
    set responseType(value: XMLHttpRequestResponseType) {
      if (this.syncMode) throw new DOMException('Window synchronous XHR responseType cannot be set', 'InvalidAccessError')
      this.#responseType = value
    }
    get timeout() { return this.#timeout }
    set timeout(value: number) {
      if (this.syncMode) throw new DOMException('Window synchronous XHR timeout cannot be set', 'InvalidAccessError')
      this.#timeout = value
    }
    withCredentials = false; method = ''; url = ''; nativeSends = 0; sendInvoked = false
    user: string | null = null; password: string | null = null; headers: [string, string][] = []
    raw = JSON.stringify(payload())
    open(method: string, url: string | URL, _async = true, _user?: string | null, _password?: string | null) {
      this.method = method; this.url = String(url); this.#state = 1; this.sendInvoked = false; this.syncMode = !_async
      this.status = 0; this.responseURL = ''
      this.user = _user ?? null; this.password = _password ?? null; this.headers = []
      this.dispatchEvent(new Event('readystatechange'))
    }
    send(_body?: unknown) {
      if (this.readyState !== 1 || this.sendInvoked) throw new DOMException('send invalid state', 'InvalidStateError')
      this.sendInvoked = true; this.nativeSends++
    }
    abort() {
      if ((this.readyState === 1 && this.sendInvoked) || this.readyState === 2 || this.readyState === 3) {
        this.#state = 4; this.sendInvoked = false; this.status = 0
        this.dispatchEvent(new Event('readystatechange'))
        this.dispatchEvent(new Event('abort')); this.dispatchEvent(new Event('loadend'))
      }
      if (this.readyState === 4) this.#state = 0
    }
    setRequestHeader(_name: string, _value: string) {
      if (this.readyState !== 1 || this.sendInvoked) throw new DOMException('header invalid state', 'InvalidStateError')
      this.headers.push([_name, _value])
    }
    complete() {
      this.#state = 4; this.sendInvoked = false; this.status = 200; this.responseURL = this.url
      this.dispatchEvent(new Event('readystatechange')); this.dispatchEvent(new Event('load')); this.dispatchEvent(new Event('loadend'))
    }
    get response(): unknown { return this.responseType === 'json' ? JSON.parse(this.raw) : this.raw }
    get responseText(): string {
      if (this.responseType !== '' && this.responseType !== 'text') throw new DOMException('not text', 'InvalidStateError')
      return this.raw
    }
  }
  const storage = new FakeStorage(), settings = scope.own(new SettingsStore(storage, now))
  await settings.update({ considerNativeSources: native })
  const session = new SessionStore(), state = session.beginGeneration(false), vault = new SignedRouteVault()
  vault.reset(state.generation, state.epoch)
  const restrictions = scope.own(new RestrictionStore(storage, now)), evidence = scope.own(new EvidenceStore(storage, now))
  const routes = new RouteCoordinator({ now }, session, settings, restrictions, evidence, vault, createRuntimeIds())
  const playurl = new PlayurlAdapter(new PlayurlController(session, vault, routes, settings))
  const accepted = playurl.transform(payload(), 'trusted-api', 'initial')
  assert.equal(accepted.accepted, true)
  const wait = deferred<void>(), fetchCalls: string[] = []
  const nativeFetch: typeof fetch = async input => {
    const url = input instanceof Request ? input.url : String(input)
    fetchCalls.push(url)
    return new Response(url.includes('/playurl') ? JSON.stringify(payload()) : null, { status: 200 })
  }
  const fakeWindow = { fetch: nativeFetch, XMLHttpRequest: NativeXhr }
  scope.defineGlobal('unsafeWindow', { configurable: true, value: fakeWindow })
  scope.defineGlobal('location', { configurable: true, value: new URL('https://www.bilibili.com/video/BVsynthetic') })
  const transport = scope.own(new TransportAdapter(session, settings, routes, playurl, {
    willGateStartup: () => gate, prepareStartup: () => wait.promise, noteUnpreflighted: () => undefined,
  }, now, createRuntimeIds()))
  transport.install()
  scope.defer(() => wait.resolve())
  // Production LifecycleController.#beginGeneration resets these same state owners.
  const advanceGeneration = () => {
    const next = session.beginGeneration(false)
    vault.reset(next.generation, next.epoch); routes.resetEpoch()
  }
  return { session, settings, restrictions, routes, playurl, now, fakeWindow, NativeXhr, wait, transport, fetchCalls, advanceGeneration }
}

test('B2 gated abort exposes DONE then UNSENT with empty response and exactly one terminal sequence', async t => {
  const f = await fixture(t, true, true), xhr = new f.NativeXhr(), events: string[] = []
  xhr.open('GET', originalUrl); xhr.send()
  assert.throws(() => xhr.send(), { name: 'InvalidStateError' })
  assert.throws(() => xhr.setRequestHeader('x-test', 'late'), { name: 'InvalidStateError' })
  for (const type of ['readystatechange', 'abort', 'loadend']) xhr.addEventListener(type, event => {
    events.push(type)
    assert.equal(xhr.readyState, 4); assert.equal(xhr.status, 0); assert.equal(xhr.responseURL, '')
    assert.equal(xhr.response, ''); assert.equal(xhr.responseText, '')
    if (type !== 'readystatechange') { assert.ok(event instanceof ProgressEvent); assert.equal(event.loaded, 0) }
  })
  xhr.abort(); xhr.abort(); f.wait.resolve(); await f.wait.promise
  assert.deepEqual(events, ['readystatechange', 'abort', 'loadend']); assert.equal(xhr.readyState, 0)
  assert.throws(() => xhr.send(), { name: 'InvalidStateError' }); assert.equal(xhr.nativeSends, 0)
})

for (const type of ['readystatechange', 'abort'] as const) {
  test(`B2/B4 reopen inside ${type} does not receive an old loadend or late send`, async t => {
    const f = await fixture(t, true, true), xhr = new f.NativeXhr(), events: string[] = []
    xhr.open('GET', originalUrl); xhr.send()
    xhr.addEventListener(type, () => { xhr.open('GET', 'https://example.invalid/new'); xhr.send() }, { once: true })
    xhr.addEventListener('loadend', () => events.push('loadend'))
    xhr.abort(); f.wait.resolve(); await f.wait.promise
    assert.equal(xhr.url, 'https://example.invalid/new'); assert.equal(xhr.nativeSends, 1)
    assert.equal(xhr.readyState, 1); assert.deepEqual(events, [])
    xhr.complete(); assert.deepEqual(events, ['loadend'])
  })
}

test('B4 queued error is owned by its request even when error callback reopens', async t => {
  const f = await fixture(t), xhr = new f.NativeXhr(), events: string[] = []
  xhr.open('GET', 'https://httpdns.bilivideo.com/resolve'); xhr.send()
  xhr.addEventListener('error', () => { xhr.open('GET', 'https://example.invalid/new'); xhr.send() }, { once: true })
  xhr.addEventListener('loadend', () => events.push('loadend'))
  await Promise.resolve()
  assert.equal(xhr.nativeSends, 1); assert.equal(xhr.readyState, 1); assert.deepEqual(events, [])
})

test('B5 policy reopen preserves async options, authorization arguments and headers', async t => {
  const f = await fixture(t, false), xhr = new f.NativeXhr()
  await f.settings.update({ fixedHost: 'upos-sz-mirroraliov.bilivideo.com' }); f.routes.invalidateForUserSetting()
  xhr.open('GET', originalUrl, true, 'synthetic-user', 'synthetic-password')
  xhr.responseType = 'arraybuffer'; xhr.timeout = 5000; xhr.withCredentials = true
  xhr.setRequestHeader('x-synthetic', 'kept')
  await f.settings.update({ disabled: true }); xhr.send()
  assert.equal(xhr.url, originalUrl); assert.equal(xhr.responseType, 'arraybuffer'); assert.equal(xhr.timeout, 5000)
  assert.equal(xhr.withCredentials, true); assert.equal(xhr.user, 'synthetic-user'); assert.equal(xhr.password, 'synthetic-password')
  assert.deepEqual(xhr.headers, [['x-synthetic', 'kept']]); assert.equal(xhr.nativeSends, 1)
})

test('B2 native sent timeout and cancellation are not synthesized or replayed after policy change', async t => {
  const f = await fixture(t, true, true), xhr = new f.NativeXhr(), events: string[] = []
  xhr.open('GET', originalUrl); xhr.timeout = 5000; xhr.send()
  assert.equal(xhr.nativeSends, 1, 'explicit timeout bypasses the gate')
  for (const type of ['abort', 'timeout', 'loadend']) xhr.addEventListener(type, () => events.push(type))
  await f.settings.update({ disabled: true }); f.advanceGeneration()
  assert.deepEqual(events, []); assert.equal(xhr.nativeSends, 1)
  xhr.abort(); f.wait.resolve(); await f.wait.promise
  assert.deepEqual(events, ['abort', 'loadend']); assert.equal(xhr.nativeSends, 1)
})

test('B3 text getter exceptions survive JSON failures and hook restoration preserves later owners', async t => {
  const f = await fixture(t, false), xhr = new f.NativeXhr()
  xhr.open('GET', apiUrl); xhr.responseType = 'json'; xhr.send(); f.advanceGeneration(); xhr.complete()
  assert.equal(xhr.status, 200); assert.equal(typeof xhr.response, 'object')
  assert.throws(() => xhr.responseText, { name: 'InvalidStateError' })
  const newer = () => 'new owner'
  Object.defineProperty(f.NativeXhr.prototype, 'response', { configurable: true, get: newer })
  assert.equal(f.transport.snapshot().hookState, 'degraded')
  f.transport.dispose()
  assert.equal(Object.getOwnPropertyDescriptor(f.NativeXhr.prototype, 'response')?.get, newer)
})

test('B1 retired opaque media attribution still enforces current host restrictions', async t => {
  const f = await fixture(t, true), opaque = 'https://upos-sz-mirrorali.bilivideo.com/opaque-chunk?synthetic=1'
  const input = payload(); input.data.dash.video[0]!.base_url = opaque
  assert.equal(f.playurl.transform(input, 'trusted-api', 'opaque').accepted, true)
  const xhr = new f.NativeXhr(); xhr.open('GET', opaque)
  f.advanceGeneration()
  await f.restrictions.add({ host: new URL(opaque).hostname, type: 'black', kind: 'all', reason: 'user', expireAt: f.now() + 60_000 })
  xhr.send(); assert.equal(xhr.nativeSends, 0)
})

test('CONTROL: native-on XHR rechecks blacklist before same-generation send', async t => {
  const f = await fixture(t)
  const xhr = new f.NativeXhr(); xhr.open('POST', originalUrl)
  await f.restrictions.add({ host: new URL(originalUrl).hostname, type: 'black', kind: 'all', reason: 'user', expireAt: f.now() + 60_000 })
  xhr.send()
  assert.equal(xhr.nativeSends, 0)
})

test('B1: native-on XHR must recheck blacklist after generation changes between open and send', async t => {
  const f = await fixture(t)
  const xhr = new f.NativeXhr(); xhr.open('POST', originalUrl)
  await f.restrictions.add({ host: new URL(originalUrl).hostname, type: 'black', kind: 'all', reason: 'user', expireAt: f.now() + 60_000 })
  f.advanceGeneration()
  assert.equal(f.routes.inspectOriginal(originalUrl).decision.action, 'block')
  xhr.send()
  assert.equal(xhr.nativeSends, 0, 'blacklisted original must not be sent after generation changes')
})

test('B1: gated native-on GET must recheck blacklist after SPA generation change', async t => {
  const f = await fixture(t, true, true)
  const xhr = new f.NativeXhr(); xhr.open('GET', originalUrl); xhr.send()
  assert.equal(xhr.nativeSends, 0)
  await f.restrictions.add({ host: new URL(originalUrl).hostname, type: 'black', kind: 'all', reason: 'user', expireAt: f.now() + 60_000 })
  f.advanceGeneration()
  f.wait.resolve(); await f.wait.promise
  assert.equal(xhr.nativeSends, 0, 'startup waiter must not release stale XHR onto a currently forbidden host')
})

test('CONTROL: gated Fetch rejects the same stale blacklisted request', async t => {
  const f = await fixture(t, true, true)
  const response = f.fakeWindow.fetch(originalUrl)
  await f.restrictions.add({ host: new URL(originalUrl).hostname, type: 'black', kind: 'all', reason: 'user', expireAt: f.now() + 60_000 })
  f.advanceGeneration(); f.wait.resolve()
  await assert.rejects(response, /blocked media request/)
  assert.equal(f.fetchCalls.length, 0)
})

test('CONTROL: current-generation XHR blocks HTTPDNS in default Catalog mode', async t => {
  const f = await fixture(t, false)
  const xhr = new f.NativeXhr(); xhr.open('GET', 'https://httpdns.bilivideo.com/resolve'); xhr.send()
  assert.equal(xhr.nativeSends, 0)
})

test('B1: stale XHR must not bypass HTTPDNS block in default Catalog mode', async t => {
  const f = await fixture(t, false)
  const xhr = new f.NativeXhr(); xhr.open('GET', 'https://httpdns.bilivideo.com/resolve')
  f.advanceGeneration(); xhr.send()
  assert.equal(xhr.nativeSends, 0, 'generation change must not bypass enabled HTTPDNS block')
})

test('CONTROL: abort after native send delivers abort and loadend', async t => {
  const f = await fixture(t, true, false)
  const xhr = new f.NativeXhr(), events: string[] = []
  for (const type of ['abort', 'loadend']) xhr.addEventListener(type, () => events.push(type))
  xhr.open('GET', originalUrl); xhr.send(); xhr.abort()
  assert.deepEqual(events, ['abort', 'loadend']); assert.equal(xhr.readyState, 0)
})

test('B2: abort during startup gate must settle the website XHR once', async t => {
  const f = await fixture(t, true, true)
  const xhr = new f.NativeXhr(), events: string[] = []
  for (const type of ['abort', 'loadend']) xhr.addEventListener(type, () => events.push(type))
  xhr.open('GET', originalUrl); xhr.send(); xhr.abort()
  f.wait.resolve(); await f.wait.promise
  assert.equal(xhr.nativeSends, 0)
  assert.deepEqual(events, ['abort', 'loadend'], 'site cancellation Promise must receive its terminal events')
  assert.equal(xhr.readyState, 0)
})

test('CONTROL: locally blocked XHR emits its own error and loadend', async t => {
  const f = await fixture(t)
  await f.restrictions.add({ host: new URL(originalUrl).hostname, type: 'black', kind: 'all', reason: 'user', expireAt: f.now() + 60_000 })
  const xhr = new f.NativeXhr(), events: string[] = []
  for (const type of ['error', 'loadend']) xhr.addEventListener(type, () => events.push(type))
  xhr.open('POST', originalUrl); xhr.send()
  await Promise.resolve()
  assert.deepEqual(events, ['error', 'loadend']); assert.equal(xhr.nativeSends, 0)
})

test('B4: queued rejection from replaced XHR must not fail the newer native request', async t => {
  const f = await fixture(t)
  await f.restrictions.add({ host: new URL(originalUrl).hostname, type: 'black', kind: 'all', reason: 'user', expireAt: f.now() + 60_000 })
  const xhr = new f.NativeXhr(), currentEvents: string[] = []
  xhr.open('POST', originalUrl); xhr.send()
  const legalUrl = originalUrl.replace('upos-sz-mirrorali.bilivideo.com', 'upos-sz-mirrorcos.bilivideo.com')
  xhr.open('GET', legalUrl)
  for (const type of ['error', 'loadend']) xhr.addEventListener(type, () => currentEvents.push(type))
  xhr.send()
  assert.equal(xhr.nativeSends, 1)
  await Promise.resolve()
  assert.deepEqual(currentEvents, [], 'error belonging to superseded request must not settle new website request')
  xhr.complete()
})

test('CONTROL: unchanged synchronous Catalog XHR sends without assigning forbidden properties', async t => {
  const f = await fixture(t, false)
  const xhr = new f.NativeXhr(); xhr.open('GET', originalUrl, false)
  assert.doesNotThrow(() => xhr.send()); assert.equal(xhr.nativeSends, 1)
})

test('B5: disabling before synchronous XHR send must preserve original website dispatch', async t => {
  const f = await fixture(t, false)
  await f.settings.update({ fixedHost: 'upos-sz-mirroraliov.bilivideo.com' }); f.routes.invalidateForUserSetting()
  const xhr = new f.NativeXhr(); xhr.open('GET', originalUrl, false)
  assert.notEqual(xhr.url, originalUrl, 'fixture originally selects a different Catalog host')
  await f.settings.update({ disabled: true })
  assert.doesNotThrow(() => xhr.send(), 'reopening sync XHR must not write forbidden responseType or timeout setters')
  assert.equal(xhr.nativeSends, 1); assert.equal(xhr.url, originalUrl)
})

test('CONTROL: disabling before async XHR send restores original website dispatch', async t => {
  const f = await fixture(t, false)
  await f.settings.update({ fixedHost: 'upos-sz-mirroraliov.bilivideo.com' }); f.routes.invalidateForUserSetting()
  const xhr = new f.NativeXhr(); xhr.open('GET', originalUrl, true)
  assert.notEqual(xhr.url, originalUrl)
  await f.settings.update({ disabled: true })
  assert.doesNotThrow(() => xhr.send()); assert.equal(xhr.nativeSends, 1); assert.equal(xhr.url, originalUrl)
})

for (const type of ['', 'text', 'json'] as const) {
  test(`CONTROL: current-generation playurl response preserves ${type || 'default'} type`, async t => {
    const f = await fixture(t, false)
    const xhr = new f.NativeXhr(); xhr.open('GET', apiUrl); xhr.responseType = type; xhr.send(); xhr.complete()
    assert.equal(typeof xhr.response, type === 'json' ? 'object' : 'string')
  })
  test(`B3: stale playurl response preserves ${type || 'default'} type`, async t => {
    const f = await fixture(t, false)
    const xhr = new f.NativeXhr(); xhr.open('GET', apiUrl); xhr.responseType = type; xhr.send()
    f.advanceGeneration(); xhr.complete()
    assert.equal(typeof xhr.response, type === 'json' ? 'object' : 'string', 'safe failure payload must respect responseType')
    if (type !== 'json') assert.equal(xhr.response, xhr.responseText)
  })
}
