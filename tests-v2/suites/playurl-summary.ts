import { TransportAdapter } from '../../src-v2/adapters/transport.ts'
import type { StartupGate, TransportRoutes, TransportSettings } from '../../src-v2/adapters/transport-context.ts'
import type { PlayurlPort } from '../../src-v2/application/ports.ts'
import type { PlayurlTransformResult } from '../../src-v2/domain/playurl-model.ts'
import { DiagnosticRecorder } from '../../src-v2/diagnostics/recorder.ts'
import { SessionStore } from '../../src-v2/state/session-store.ts'
import { assertionCount, check, equal } from '../support/assert.ts'
import { testScope } from '../support/scope.ts'

const scope = testScope()
try {
  const session = new SessionStore(); session.beginGeneration(false)
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
  Object.defineProperty(globalThis, 'unsafeWindow', { configurable: true, value: windowFixture })
  Object.defineProperty(globalThis, 'location', { configurable: true, value: new URL('https://www.bilibili.com/') })
  const transport = scope.own(new TransportAdapter(session, settings, routes, playurl, measurement, () => now))
  transport.install()
  const endpoint = 'https://api.bilibili.com/x/player/wbi/playurl?token=summary-secret'
  equal(transport.snapshot().lastPlayurl, null, 'playurl summary starts empty')
  equal((await windowFixture.fetch(endpoint)).status, 200, 'accepted typed Fetch result preserves native HTTP status')
  const first = transport.snapshot().lastPlayurl
  check(first?.accepted && first.transport === 'fetch', 'Fetch records typed acceptance and transport')
  equal(first?.formats.join(','), 'dash,mp4,flv', 'summary distinguishes accepted DASH, MP4 and FLV')
  equal(first?.videoCount, 3, 'summary retains video count')
  equal(first?.audioCount, 2, 'summary retains audio count')
  equal(first?.segmentCount, 4, 'summary retains progressive segment count')
  check(Object.isFrozen(first) && Object.isFrozen(first?.formats), 'summary and its format list are immutable')

  result = { accepted: false, formats: ['mp4'], videoCount: 0, audioCount: 0, segmentCount: 2,
    upstreamCode: -10403, reason: 'upstream-error' }
  const rejected = await windowFixture.fetch(endpoint)
  equal(rejected.status, 503, 'a rejected result object cannot truthily pass strict Fetch')
  const rejectedBody: unknown = await rejected.json()
  check(typeof rejectedBody === 'object' && rejectedBody !== null && Reflect.get(rejectedBody, 'code') === -1,
    'strict Fetch returns the local block body')
  equal(transport.snapshot().lastPlayurl?.upstreamCode, -10403, 'summary preserves a numeric upstream error code')
  equal(transport.snapshot().lastPlayurl?.reason, 'upstream-error', 'summary distinguishes upstream failure from parse failure')
  equal(transport.snapshot().lastPlayurl?.status, 200, 'summary records native status separately from Fetch block status')

  const makeXhr = (type: XMLHttpRequestResponseType, value: unknown = { code: 0 }) => {
    const xhr = new windowFixture.XMLHttpRequest(); xhr.responseType = type; xhr.payload = value
    xhr.open('GET', endpoint); xhr.send(); return xhr
  }
  for (const type of ['text', 'json'] as const) {
    const xhr = makeXhr(type, { code: 0, data: { url: secret } })
    const output = type === 'json' ? JSON.stringify(xhr.response) : xhr.responseText
    check(!output.includes('summary-secret'), `strict XHR ${type} rejects an unaccepted typed result`)
    equal(xhr.status, 200, `strict XHR ${type} retains native HTTP status`)
    equal(transport.snapshot().lastPlayurl?.transport, 'xhr', `XHR ${type} updates summary`)
    equal(transport.snapshot().lastPlayurl?.reason, 'upstream-error', `XHR ${type} reports rejection reason`)
    const transformedAt = calls
    void xhr.response; if (type === 'text') void xhr.responseText
    equal(calls, transformedAt, `XHR ${type} reads reuse the cached transformation`)
  }

  result = accepted
  const acceptedXhr = makeXhr('text')
  equal(acceptedXhr.response, '{"code":0}', 'XHR response text accepts a typed accepted result')
  equal(transport.snapshot().lastPlayurl?.segmentCount, 4, 'XHR accepted result includes segment count')
  const jsonXhr = makeXhr('json'); void jsonXhr.response
  check(transport.snapshot().lastPlayurl?.accepted, 'XHR JSON accepts a typed accepted result')

  body = '{malformed:' + secret
  equal((await windowFixture.fetch(endpoint)).status, 503, 'strict Fetch still blocks malformed JSON')
  equal(transport.snapshot().lastPlayurl?.reason, 'malformed-payload', 'malformed Fetch JSON receives a safe reason')
  const malformedXhr = makeXhr('text'); malformedXhr.rawText = body
  void malformedXhr.responseText
  equal(transport.snapshot().lastPlayurl?.reason, 'malformed-payload', 'malformed XHR JSON receives a safe reason')
  body = '{"code":0}'; throws = true
  await windowFixture.fetch(endpoint)
  equal(transport.snapshot().lastPlayurl?.reason, 'malformed-payload', 'transform exceptions receive no raw error message')
  throws = false

  strict = false; result = { ...accepted, accepted: false, reason: 'no-legal-route' }
  body = JSON.stringify({ code: 0, data: { url: secret } })
  equal(await (await windowFixture.fetch(endpoint)).text(), body, 'Native-enabled Fetch preserves rejected upstream payload')
  const nativeXhr = makeXhr('json', { code: 0, data: { url: secret } })
  check(JSON.stringify(nativeXhr.response).includes('summary-secret'), 'Native-enabled XHR preserves rejected upstream payload')
  check(transport.snapshot().lastPlayurl?.accepted === false, 'pass-through rejection remains visible as unaccepted')
  strict = true
  const stale = makeXhr('text', { data: { url: secret } }); session.beginGeneration(false)
  check(!stale.responseText.includes('summary-secret'), 'old-generation XHR remains blocked')
  equal(transport.snapshot().lastPlayurl?.reason, 'inactive', 'stale response summary does not claim acceptance')

  let releaseBody = (): void => {}
  responseOverride = new Response(new ReadableStream<Uint8Array>({ start(controller) {
    releaseBody = () => { controller.enqueue(new TextEncoder().encode('{"code":0}')); controller.close() }
  } }), { status: 201 })
  result = accepted
  const pending = windowFixture.fetch(endpoint), beforeStale = calls
  session.beginGeneration(false); releaseBody()
  equal((await pending).status, 503, 'late Fetch playurl response cannot use old generation acceptance')
  equal(calls, beforeStale, 'old-generation Fetch response is not transformed')
  equal(transport.snapshot().lastPlayurl?.reason, 'inactive', 'late Fetch summary reports lifecycle rejection')
  equal(transport.snapshot().lastPlayurl?.status, 201, 'late Fetch summary keeps upstream status distinct')
  responseOverride = null

  result = { ...accepted, videoCount: Infinity, audioCount: -1, segmentCount: 1_000_000, upstreamCode: Infinity,
    formats: ['dash', 'dash', 'mp4', 'flv', 'mp4'] }
  await windowFixture.fetch(endpoint)
  equal(transport.snapshot().lastPlayurl?.videoCount, 0, 'non-finite diagnostic counts are normalized')
  equal(transport.snapshot().lastPlayurl?.audioCount, 0, 'negative diagnostic counts are normalized')
  equal(transport.snapshot().lastPlayurl?.segmentCount, 65_535, 'diagnostic counts have a finite upper bound')
  equal(transport.snapshot().lastPlayurl?.upstreamCode, null, 'non-finite upstream code is omitted')
  equal(transport.snapshot().lastPlayurl?.formats.join(','), 'dash,mp4,flv', 'diagnostic formats have a bounded unique set')

  const augmented = { ...accepted, url: secret, token: 'summary-secret', payload: { raw: secret } }
  result = augmented; now++
  await windowFixture.fetch(endpoint)
  const safe = transport.snapshot().lastPlayurl
  equal(safe?.observedAt, now, 'recent summary reflects observation time')
  check(!JSON.stringify(transport.snapshot()).includes('summary-secret'), 'summary copies only safe fields from result')
  const recorder = new DiagnosticRecorder(() => now, () => false)
  const report = recorder.buildReport({ interception: transport.snapshot() })
  check(!report.includes('summary-secret') && !report.includes('example.invalid') && !report.includes('video.m4s'),
    'diagnostic export contains no response body, signed path or token')
  const parsed: unknown = JSON.parse(report)
  const current: unknown = parsed && typeof parsed === 'object' ? Reflect.get(parsed, 'current') : null
  const interception: unknown = current && typeof current === 'object' ? Reflect.get(current, 'interception') : null
  check(!!interception && typeof interception === 'object' && Reflect.get(interception, 'lastPlayurl') !== null,
    'diagnostic report retains the recent playurl summary')
  disabled = true
  const previous = transport.snapshot().lastPlayurl
  await windowFixture.fetch(endpoint)
  equal(transport.snapshot().lastPlayurl, previous, 'fully disabled pass-through does not transform or replace summary')
  console.log(`playurl-summary: ${assertionCount()} assertions`)
} finally { scope.dispose() }
