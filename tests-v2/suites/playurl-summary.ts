import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { TransportAdapter } from '../../src-v2/adapters/transport.ts'
import type { StartupGate, TransportRoutes, TransportSettings } from '../../src-v2/adapters/transport-context.ts'
import type { PlayurlPort } from '../../src-v2/application/ports.ts'
import type { PlayurlTransformResult } from '../../src-v2/domain/playurl-model.ts'
import { DiagnosticRecorder } from '../../src-v2/diagnostics/recorder.ts'
import { SessionStore } from '../../src-v2/state/session-store.ts'
import { testScope } from '../support/scope.ts'

// Each call creates fresh resources and replays only this fixture's prerequisite transitions.
// Earlier expectations run in their own cases; no mutable state crosses a test boundary.
async function fixture(t: TestContext, scenario: number, parameter = 0): Promise<() => Promise<void>> {
  const scope = testScope(t)
const session = new SessionStore();
session.beginGeneration(false)
let strict = true, disabled = false, status = 200, body = '{"code":0}', throws = false, calls = 0
let responseOverride: Response | null = null
let now = 2_000_000_000_000
const secret = 'https://example.invalid/private/video.m4s?token=summary-secret'
const accepted = { accepted: true, formats: ['dash', 'mp4', 'flv'], videoCount: 3, audioCount: 2,
    segmentCount: 4, upstreamCode: 0, reason: null } satisfies PlayurlTransformResult
let result: PlayurlTransformResult = accepted
const playurl = { transform() { calls++; if (throws) throw Error(secret); return result } } satisfies PlayurlPort
const routes = {
    isCatalogOnly: () => strict, isBilibiliMedia: () => false, recognizesMedia: () => false,
    apply(): never { throw Error('Unexpected media application') },
    inspectOriginal(): never { throw Error('Unexpected media inspection') },
    requestStarted() {}, async observe() {},
  } satisfies TransportRoutes
const settings = { get: () => ({ disabled, blockHttpDns: false }) } satisfies TransportSettings
const measurement = { willGateStartup: () => false, async prepareStartup() {}, noteUnpreflighted() {} } satisfies StartupGate
class FakeXhr extends EventTarget {
    readyState = 0; status = 200; responseURL = ''; responseType: XMLHttpRequestResponseType = ''
    timeout = 0; withCredentials = false; payload: unknown = { code: 0 }; rawText: string | null = null
    get response(): unknown { return this.responseType === 'json' ? this.payload : this.responseText }
    get responseText(): string { return this.rawText ?? JSON.stringify(this.payload) }
    open(_method: string, url: string | URL): void { this.responseURL = String(url); this.readyState = 1 }
    send(): void { this.readyState = 4; this.dispatchEvent(new Event('readystatechange')); this.dispatchEvent(new Event('load')); this.dispatchEvent(new Event('loadend')) }
    abort(): void { this.dispatchEvent(new Event('abort')) }
    setRequestHeader(): void {}
  }
const nativeFetch: typeof fetch = async () => responseOverride ?? new Response(body, { status })
const windowFixture = { fetch: nativeFetch, XMLHttpRequest: FakeXhr }
scope.defineGlobal('unsafeWindow', { configurable: true, value: windowFixture })
scope.defineGlobal('location', { configurable: true, value: new URL('https://www.bilibili.com/') })
const transport = scope.own(new TransportAdapter(session, settings, routes, playurl, measurement, () => now))
transport.install()
const endpoint = 'https://api.bilibili.com/x/player/wbi/playurl?token=summary-secret'
if (scenario === 0) return async () => {
assert.strictEqual(transport.snapshot().lastPlayurl, null, 'playurl summary starts empty')
assert.strictEqual((await windowFixture.fetch(endpoint)).status, 200, 'accepted typed Fetch result preserves native HTTP status')
const first = transport.snapshot().lastPlayurl
assert.ok(first?.accepted && first.transport === 'fetch', 'Fetch records typed acceptance and transport')
assert.strictEqual(first?.formats.join(','), 'dash,mp4,flv', 'summary distinguishes accepted DASH, MP4 and FLV')
assert.strictEqual(first?.videoCount, 3, 'summary retains video count')
assert.strictEqual(first?.audioCount, 2, 'summary retains audio count')
assert.strictEqual(first?.segmentCount, 4, 'summary retains progressive segment count')
assert.ok(Object.isFrozen(first) && Object.isFrozen(first?.formats), 'summary and its format list are immutable')
}
void (transport.snapshot().lastPlayurl);
void (null);
void ((await windowFixture.fetch(endpoint)).status);
void (200);
const first = transport.snapshot().lastPlayurl
void (first?.accepted && first.transport === 'fetch');
void (first?.formats.join(','));
void ('dash,mp4,flv');
void (first?.videoCount);
void (3);
void (first?.audioCount);
void (2);
void (first?.segmentCount);
void (4);
void (Object.isFrozen(first) && Object.isFrozen(first?.formats));
result = { accepted: false, formats: ['mp4'], videoCount: 0, audioCount: 0, segmentCount: 2,
    upstreamCode: -10403, reason: 'upstream-error' }
const rejected = await windowFixture.fetch(endpoint)
if (scenario === 1) return async () => {
assert.strictEqual(rejected.status, 503, 'a rejected result object cannot truthily pass strict Fetch')
const rejectedBody: unknown = await rejected.json()
assert.ok(typeof rejectedBody === 'object' && rejectedBody !== null && Reflect.get(rejectedBody, 'code') === -1,
    'strict Fetch returns the local block body')
assert.strictEqual(transport.snapshot().lastPlayurl?.upstreamCode, -10403, 'summary preserves a numeric upstream error code')
assert.strictEqual(transport.snapshot().lastPlayurl?.reason, 'upstream-error', 'summary distinguishes upstream failure from parse failure')
assert.strictEqual(transport.snapshot().lastPlayurl?.status, 200, 'summary records native status separately from Fetch block status')
}
void (rejected.status);
void (503);
const rejectedBody: unknown = await rejected.json()
void (typeof rejectedBody === 'object' && rejectedBody !== null && Reflect.get(rejectedBody, 'code') === -1);
void (transport.snapshot().lastPlayurl?.upstreamCode);
void (-10403);
void (transport.snapshot().lastPlayurl?.reason);
void ('upstream-error');
void (transport.snapshot().lastPlayurl?.status);
void (200);
const makeXhr = (type: XMLHttpRequestResponseType, value: unknown = { code: 0 }) => {
    const xhr = new windowFixture.XMLHttpRequest(); xhr.responseType = type; xhr.payload = value
    xhr.open('GET', endpoint); xhr.send(); return xhr
  }
if (scenario === 2) {
 let iteration = 0
for (const type of ['text', 'json'] as const) {
 if (iteration++ === parameter) return async () => {
    const xhr = makeXhr(type, { code: 0, data: { url: secret } })
    const output = type === 'json' ? JSON.stringify(xhr.response) : xhr.responseText
    assert.ok(!output.includes('summary-secret'), `strict XHR ${type} rejects an unaccepted typed result`)
    assert.strictEqual(xhr.status, 200, `strict XHR ${type} retains native HTTP status`)
    assert.strictEqual(transport.snapshot().lastPlayurl?.transport, 'xhr', `XHR ${type} updates summary`)
    assert.strictEqual(transport.snapshot().lastPlayurl?.reason, 'upstream-error', `XHR ${type} reports rejection reason`)
    const transformedAt = calls
    void xhr.response; if (type === 'text') void xhr.responseText
    assert.strictEqual(calls, transformedAt, `XHR ${type} reads reuse the cached transformation`)
  }
 }
 throw Error('Unknown fixture parameter')
}
for (const type of ['text', 'json'] as const) {
    const xhr = makeXhr(type, { code: 0, data: { url: secret } })
    const output = type === 'json' ? JSON.stringify(xhr.response) : xhr.responseText
void (!output.includes('summary-secret'));
void (xhr.status);
void (200);
void (transport.snapshot().lastPlayurl?.transport);
void ('xhr');
void (transport.snapshot().lastPlayurl?.reason);
void ('upstream-error');
    const transformedAt = calls
    void xhr.response; if (type === 'text') void xhr.responseText
void (calls);
void (transformedAt);
  }
result = accepted
const acceptedXhr = makeXhr('text')
if (scenario === 3) return async () => {
assert.strictEqual(acceptedXhr.response, '{"code":0}', 'XHR response text accepts a typed accepted result')
assert.strictEqual(transport.snapshot().lastPlayurl?.segmentCount, 4, 'XHR accepted result includes segment count')
const jsonXhr = makeXhr('json');
void jsonXhr.response
assert.ok(transport.snapshot().lastPlayurl?.accepted, 'XHR JSON accepts a typed accepted result')
body = '{malformed:' + secret
assert.strictEqual((await windowFixture.fetch(endpoint)).status, 503, 'strict Fetch still blocks malformed JSON')
assert.strictEqual(transport.snapshot().lastPlayurl?.reason, 'malformed-payload', 'malformed Fetch JSON receives a safe reason')
const malformedXhr = makeXhr('text');
malformedXhr.rawText = body
void malformedXhr.responseText
assert.strictEqual(transport.snapshot().lastPlayurl?.reason, 'malformed-payload', 'malformed XHR JSON receives a safe reason')
body = '{"code":0}';
throws = true
await windowFixture.fetch(endpoint)
assert.strictEqual(transport.snapshot().lastPlayurl?.reason, 'malformed-payload', 'transform exceptions receive no raw error message')
throws = false
strict = false;
result = { ...accepted, accepted: false, reason: 'no-legal-route' }
body = JSON.stringify({ code: 0, data: { url: secret } })
assert.strictEqual(await (await windowFixture.fetch(endpoint)).text(), body, 'Native-enabled Fetch preserves rejected upstream payload')
}
void (acceptedXhr.response);
void ('{"code":0}');
void (transport.snapshot().lastPlayurl?.segmentCount);
void (4);
const jsonXhr = makeXhr('json');
void jsonXhr.response
void (transport.snapshot().lastPlayurl?.accepted);
body = '{malformed:' + secret
void ((await windowFixture.fetch(endpoint)).status);
void (503);
void (transport.snapshot().lastPlayurl?.reason);
void ('malformed-payload');
const malformedXhr = makeXhr('text');
malformedXhr.rawText = body
void malformedXhr.responseText
void (transport.snapshot().lastPlayurl?.reason);
void ('malformed-payload');
body = '{"code":0}';
throws = true
await windowFixture.fetch(endpoint)
void (transport.snapshot().lastPlayurl?.reason);
void ('malformed-payload');
throws = false
strict = false;
result = { ...accepted, accepted: false, reason: 'no-legal-route' }
body = JSON.stringify({ code: 0, data: { url: secret } })
void (await (await windowFixture.fetch(endpoint)).text());
void (body);
const nativeXhr = makeXhr('json', { code: 0, data: { url: secret } })
if (scenario === 4) return async () => {
assert.ok(JSON.stringify(nativeXhr.response).includes('summary-secret'), 'Native-enabled XHR preserves rejected upstream payload')
assert.ok(transport.snapshot().lastPlayurl?.accepted === false, 'pass-through rejection remains visible as unaccepted')
strict = true
const stale = makeXhr('text', { data: { url: secret } });
session.beginGeneration(false)
assert.ok(!stale.responseText.includes('summary-secret'), 'old-generation XHR remains blocked')
assert.strictEqual(transport.snapshot().lastPlayurl?.reason, 'inactive', 'stale response summary does not claim acceptance')
let releaseBody = (): void => {}
responseOverride = new Response(new ReadableStream<Uint8Array>({ start(controller) {
    releaseBody = () => { controller.enqueue(new TextEncoder().encode('{"code":0}')); controller.close() }
  } }), { status: 201 })
result = accepted
const pending = windowFixture.fetch(endpoint), beforeStale = calls
session.beginGeneration(false);
releaseBody()
assert.strictEqual((await pending).status, 503, 'late Fetch playurl response cannot use old generation acceptance')
assert.strictEqual(calls, beforeStale, 'old-generation Fetch response is not transformed')
assert.strictEqual(transport.snapshot().lastPlayurl?.reason, 'inactive', 'late Fetch summary reports lifecycle rejection')
assert.strictEqual(transport.snapshot().lastPlayurl?.status, 201, 'late Fetch summary keeps upstream status distinct')
}
void (JSON.stringify(nativeXhr.response).includes('summary-secret'));
void (transport.snapshot().lastPlayurl?.accepted === false);
strict = true
const stale = makeXhr('text', { data: { url: secret } });
session.beginGeneration(false)
void (!stale.responseText.includes('summary-secret'));
void (transport.snapshot().lastPlayurl?.reason);
void ('inactive');
let releaseBody = (): void => {}
responseOverride = new Response(new ReadableStream<Uint8Array>({ start(controller) {
    releaseBody = () => { controller.enqueue(new TextEncoder().encode('{"code":0}')); controller.close() }
  } }), { status: 201 })
result = accepted
const pending = windowFixture.fetch(endpoint), beforeStale = calls
session.beginGeneration(false);
releaseBody()
void ((await pending).status);
void (503);
void (calls);
void (beforeStale);
void (transport.snapshot().lastPlayurl?.reason);
void ('inactive');
void (transport.snapshot().lastPlayurl?.status);
void (201);
responseOverride = null
result = { ...accepted, videoCount: Infinity, audioCount: -1, segmentCount: 1_000_000, upstreamCode: Infinity,
    formats: ['dash', 'dash', 'mp4', 'flv', 'mp4'] }
await windowFixture.fetch(endpoint)
if (scenario === 5) return async () => {
assert.strictEqual(transport.snapshot().lastPlayurl?.videoCount, 0, 'non-finite diagnostic counts are normalized')
assert.strictEqual(transport.snapshot().lastPlayurl?.audioCount, 0, 'negative diagnostic counts are normalized')
assert.strictEqual(transport.snapshot().lastPlayurl?.segmentCount, 65_535, 'diagnostic counts have a finite upper bound')
assert.strictEqual(transport.snapshot().lastPlayurl?.upstreamCode, null, 'non-finite upstream code is omitted')
assert.strictEqual(transport.snapshot().lastPlayurl?.formats.join(','), 'dash,mp4,flv', 'diagnostic formats have a bounded unique set')
const augmented = { ...accepted, url: secret, token: 'summary-secret', payload: { raw: secret } }
result = augmented;
now++
await windowFixture.fetch(endpoint)
const safe = transport.snapshot().lastPlayurl
assert.strictEqual(safe?.observedAt, now, 'recent summary reflects observation time')
assert.ok(!JSON.stringify(transport.snapshot()).includes('summary-secret'), 'summary copies only safe fields from result')
const recorder = new DiagnosticRecorder(() => now, () => false)
const report = recorder.buildReport({ interception: transport.snapshot() })
assert.ok(!report.includes('summary-secret') && !report.includes('example.invalid') && !report.includes('video.m4s'),
    'diagnostic export contains no response body, signed path or token')
}
void (transport.snapshot().lastPlayurl?.videoCount);
void (0);
void (transport.snapshot().lastPlayurl?.audioCount);
void (0);
void (transport.snapshot().lastPlayurl?.segmentCount);
void (65_535);
void (transport.snapshot().lastPlayurl?.upstreamCode);
void (null);
void (transport.snapshot().lastPlayurl?.formats.join(','));
void ('dash,mp4,flv');
const augmented = { ...accepted, url: secret, token: 'summary-secret', payload: { raw: secret } }
result = augmented;
now++
await windowFixture.fetch(endpoint)
const safe = transport.snapshot().lastPlayurl
void (safe?.observedAt);
void (now);
void (!JSON.stringify(transport.snapshot()).includes('summary-secret'));
const recorder = new DiagnosticRecorder(() => now, () => false)
const report = recorder.buildReport({ interception: transport.snapshot() })
void (!report.includes('summary-secret') && !report.includes('example.invalid') && !report.includes('video.m4s'));
const parsed: unknown = JSON.parse(report)
const current: unknown = parsed && typeof parsed === 'object' ? Reflect.get(parsed, 'current') : null
const interception: unknown = current && typeof current === 'object' ? Reflect.get(current, 'interception') : null
if (scenario === 6) return async () => {
assert.ok(!!interception && typeof interception === 'object' && Reflect.get(interception, 'lastPlayurl') !== null,
    'diagnostic report retains the recent playurl summary')
disabled = true
const previous = transport.snapshot().lastPlayurl
await windowFixture.fetch(endpoint)
assert.strictEqual(transport.snapshot().lastPlayurl, previous, 'fully disabled pass-through does not transform or replace summary')
}
void (!!interception && typeof interception === 'object' && Reflect.get(interception, 'lastPlayurl') !== null);
disabled = true
const previous = transport.snapshot().lastPlayurl
await windowFixture.fetch(endpoint)
void (transport.snapshot().lastPlayurl);
void (previous);
throw Error('Unknown fixture scenario')
}

test("playurl summary starts empty [1]", { timeout: 5000 }, async t => { await (await fixture(t, 0))() })
test("a rejected result object cannot truthily pass strict Fetch [2]", { timeout: 5000 }, async t => { await (await fixture(t, 1))() })
{
 let parameter = 0
for (const type of ['text', 'json'] as const) {
 const selected = parameter++
 test("`strict XHR ${type} rejects an unaccepted typed result` [3]" + ` / ${String(type)} / ${selected}`, { timeout: 5000 }, async t => { await (await fixture(t, 2, selected))() })
}
}
test("XHR response text accepts a typed accepted result [4]", { timeout: 5000 }, async t => { await (await fixture(t, 3))() })
test("Native-enabled XHR preserves rejected upstream payload [5]", { timeout: 5000 }, async t => { await (await fixture(t, 4))() })
test("non-finite diagnostic counts are normalized [6]", { timeout: 5000 }, async t => { await (await fixture(t, 5))() })
test("diagnostic report retains the recent playurl summary [7]", { timeout: 5000 }, async t => { await (await fixture(t, 6))() })
