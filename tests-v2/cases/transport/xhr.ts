import { CatalogSettingsStore } from '../../support/catalog-settings.ts'
import { installProgressEvent } from '../../support/progress-event.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { TransportAdapter } from '../../../src-v2/adapters/transport/transport.ts'
import { PlayurlAdapter } from '../../../src-v2/adapters/playurl/playurl.ts'
import { PlayurlController } from '../../../src-v2/application/playurl/playurl-controller.ts'
import { RouteCoordinator } from '../../../src-v2/application/routing/route-coordinator.ts'
import { SessionStore } from '../../../src-v2/state/session-store.ts'
import { RestrictionStore } from '../../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../../src-v2/state/evidence-store.ts'
import { SignedRouteVault } from '../../../src-v2/state/signed-route-vault.ts'
import { testScope } from '../../support/scope.ts'
import { deferred } from '../../support/deferred.ts'
import { FakeStorage } from '../../support/storage.ts'
import { startupAbortFixture } from '../../support/startup-abort.ts'
import { type StartupGate } from '../../../src-v2/adapters/transport/transport-ports.ts'
import { MeasurementController } from '../../../src-v2/application/measurement/measurement-controller.ts'
import { MeasurementMetaStore } from '../../../src-v2/state/measurement-meta-store.ts'
import {
  type RangeProbePort,
  type RangeProbeResult,
} from '../../../src-v2/application/measurement/measurement-contracts.ts'
import { FakeClock } from '../../support/clock.ts'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
const originalUrl =
  'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/11/22/1000/1000-1-30080.m4s?test=synthetic'
const apiUrl = 'https://api.bilibili.com/x/player/wbi/playurl?cid=1000'
const payload = () => ({
  code: 0,
  data: {
    dash: {
      video: [
        {
          id: 80,
          codecid: 7,
          height: 1080,
          bandwidth: 1_000_000,
          base_url: originalUrl,
          backup_url: [],
        },
      ],
      audio: [],
    },
  },
})

async function fixture(
  t: TestContext,
  native = true,
  gate = false,
  fetchResponse?: () => Promise<Response>,
  startup?: StartupGate,
  probe?: RangeProbePort,
) {
  const scope = testScope(t),
    clock = probe ? scope.own(new FakeClock()) : null,
    now = clock?.now ?? (() => 2_000_000_000_000)
  installProgressEvent(scope)
  // Minimal native state model follows https://xhr.spec.whatwg.org/#the-abort()-method.
  // Unlike existing FakeXhr, abort() before native send does not invent terminal events.
  class NativeXhr extends EventTarget {
    constructor() {
      super()
      scope.defer(() => this.abort())
    }
    #state = 0
    get readyState() {
      return this.#state
    }
    status = 0
    responseURL = ''
    syncMode = false
    #responseType: XMLHttpRequestResponseType = ''
    #timeout = 0
    #credentials = false
    onRestore: ((option: 'responseType' | 'timeout' | 'credentials' | 'header') => void) | null =
      null
    sendError: Error | null = null
    successfulOpens = 0
    get responseType() {
      return this.#responseType
    }
    set responseType(value: XMLHttpRequestResponseType) {
      if (this.syncMode)
        throw new DOMException(
          'Window synchronous XHR responseType cannot be set',
          'InvalidAccessError',
        )
      this.#responseType = value
      this.onRestore?.('responseType')
    }
    get timeout() {
      return this.#timeout
    }
    set timeout(value: number) {
      if (this.syncMode)
        throw new DOMException('Window synchronous XHR timeout cannot be set', 'InvalidAccessError')
      this.#timeout = value
      this.onRestore?.('timeout')
    }
    get withCredentials() {
      return this.#credentials
    }
    set withCredentials(value: boolean) {
      this.#credentials = value
      this.onRestore?.('credentials')
    }
    method = ''
    url = ''
    nativeSends = 0
    sentTimeouts: number[] = []
    sentAt: number[] = []
    onOpen: (() => void) | null = null
    sendInvoked = false
    user: string | null = null
    password: string | null = null
    headers: [string, string][] = []
    raw = JSON.stringify(payload())
    open(
      method: string,
      url: string | URL,
      _async?: boolean,
      _user?: string | null,
      _password?: string | null,
    ) {
      if (arguments.length < 2) throw new TypeError('open requires method and URL')
      const normalizedMethod = `${method}`
      if (/[^\x00-\xff]/.test(normalizedMethod)) throw new TypeError('method must be a ByteString')
      const normalizedUrl = `${url}`.toWellFormed(),
        async = arguments.length < 3 ? true : Boolean(_async)
      const user = _user == null ? null : `${_user}`.toWellFormed(),
        password = _password == null ? null : `${_password}`.toWellFormed()
      if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(normalizedMethod))
        throw new DOMException('invalid method', 'SyntaxError')
      if (/^(CONNECT|TRACE|TRACK)$/i.test(normalizedMethod))
        throw new DOMException('forbidden method', 'SecurityError')
      let parsed: URL
      try {
        parsed = new URL(normalizedUrl, 'https://www.bilibili.com/')
      } catch {
        throw new DOMException('invalid URL', 'SyntaxError')
      }
      if (!async && (this.timeout !== 0 || this.responseType !== '')) {
        // Chrome 154 resets the native object to UNSENT before this Window error,
        // without terminal events. Measured independently in the BR-02 browser harness.
        this.#state = 0
        this.sendInvoked = false
        throw new DOMException('synchronous options', 'InvalidAccessError')
      }
      const changed = this.#state !== 1
      this.successfulOpens++
      this.method = /^(DELETE|GET|HEAD|OPTIONS|POST|PUT)$/i.test(normalizedMethod)
        ? normalizedMethod.toUpperCase()
        : normalizedMethod
      this.url = parsed.href
      this.#state = 1
      this.sendInvoked = false
      this.syncMode = !async
      this.status = 0
      this.responseURL = ''
      this.user = user
      this.password = password
      this.headers = []
      this.onOpen?.()
      if (changed) this.dispatchEvent(new Event('readystatechange'))
    }
    send(_body?: unknown) {
      if (this.readyState !== 1 || this.sendInvoked)
        throw new DOMException('send invalid state', 'InvalidStateError')
      if (this.sendError) throw this.sendError
      this.sendInvoked = true
      this.nativeSends++
      this.sentTimeouts.push(this.timeout)
      this.sentAt.push(now())
    }
    abort() {
      if (
        (this.readyState === 1 && this.sendInvoked) ||
        this.readyState === 2 ||
        this.readyState === 3
      ) {
        this.#state = 4
        this.sendInvoked = false
        this.status = 0
        this.dispatchEvent(new Event('readystatechange'))
        this.dispatchEvent(new Event('abort'))
        this.dispatchEvent(new Event('loadend'))
      }
      if (this.readyState === 4) this.#state = 0
    }
    setRequestHeader(_name: string, _value: string) {
      if (this.readyState !== 1 || this.sendInvoked)
        throw new DOMException('header invalid state', 'InvalidStateError')
      this.headers.push([_name, _value])
      this.onRestore?.('header')
    }
    complete() {
      this.#state = 4
      this.sendInvoked = false
      this.status = 200
      this.responseURL = this.url
      this.dispatchEvent(new Event('readystatechange'))
      this.dispatchEvent(new Event('load'))
      this.dispatchEvent(new Event('loadend'))
    }
    receiveHeaders() {
      this.#state = 2
      this.status = 200
      this.dispatchEvent(new Event('readystatechange'))
    }
    get response(): unknown {
      return this.responseType === 'json' ? JSON.parse(this.raw) : this.raw
    }
    get responseText(): string {
      if (this.responseType !== '' && this.responseType !== 'text')
        throw new DOMException('not text', 'InvalidStateError')
      return this.raw
    }
  }
  const storage = new FakeStorage(),
    settings = scope.own(new CatalogSettingsStore(storage, now))
  await settings.update({ considerNativeSources: native })
  const session = new SessionStore(),
    state = session.beginGeneration(false),
    vault = new SignedRouteVault()
  vault.reset(state.generation, state.epoch)
  const restrictions = scope.own(new RestrictionStore(storage, now)),
    evidence = scope.own(new EvidenceStore(storage, now))
  const routes = new RouteCoordinator(
    { now, monotonicNow: now },
    session,
    settings,
    restrictions,
    evidence,
    vault,
    createRuntimeIds(),
  )
  const playurl = new PlayurlAdapter(new PlayurlController(session, vault, routes))
  const accepted = playurl.transform(payload(), 'trusted-api', 'initial')
  assert.equal(accepted.accepted, true)
  const wait = deferred<void>(),
    fetchCalls: string[] = []
  const nativeFetch: typeof fetch = async (input) => {
    const url = input instanceof Request ? input.url : String(input)
    fetchCalls.push(url)
    if (fetchResponse) return await fetchResponse()
    return new Response(url.includes('/playurl') ? JSON.stringify(payload()) : null, {
      status: 200,
    })
  }
  const nativeOpen = NativeXhr.prototype.open
  const fakeWindow = { fetch: nativeFetch, XMLHttpRequest: NativeXhr }
  scope.defineGlobal('unsafeWindow', { configurable: true, value: fakeWindow })
  scope.defineGlobal('location', {
    configurable: true,
    value: new URL('https://www.bilibili.com/video/BVsynthetic'),
  })
  const measurement = probe
    ? scope.own(
        new MeasurementController(
          routes,
          new MeasurementMetaStore(storage, now),
          probe,
          now,
          clock!,
          undefined,
          () => 0,
          settings,
          now,
        ),
      )
    : (startup ?? {
        willGateStartup: () => gate,
        prepareStartup: () => wait.promise,
        noteUnpreflighted: () => undefined,
      })
  const transport = scope.own(
    new TransportAdapter(
      session,
      settings,
      routes,
      playurl,
      measurement,
      now,
      createRuntimeIds(),
      undefined,
      now,
    ),
  )
  transport.install()
  scope.defer(() => wait.resolve())
  // Production LifecycleController.#beginGeneration resets these same state owners.
  const advanceGeneration = () => {
    const next = session.beginGeneration(false)
    vault.reset(next.generation, next.epoch)
    routes.resetEpoch()
  }
  return {
    scope,
    clock,
    storage,
    vault,
    measurement,
    session,
    settings,
    restrictions,
    evidence,
    routes,
    playurl,
    now,
    fakeWindow,
    NativeXhr,
    nativeOpen,
    wait,
    transport,
    fetchCalls,
    advanceGeneration,
  }
}

const blockedUrl = 'https://httpdns.bilivideo.com/bilicdn-browser-contract'
const ordinaryUrl = 'https://example.invalid/synthetic-control'

function startupProbe() {
  const pending: {
    host: string
    limit: number
    signal: AbortSignal
    complete: (result: RangeProbeResult) => void
    fail: (reason: unknown) => void
  }[] = []
  const probe: RangeProbePort = {
    async read({ host, limit, signal }) {
      assert.ok(host)
      const d = deferred<RangeProbeResult>()
      const abort = () =>
        d.resolve({
          bytes: 0,
          elapsedMs: 1,
          ttfbMs: null,
          status: null,
          directRange: false,
          reason: 'cancelled',
        })
      signal.addEventListener('abort', abort, { once: true })
      pending.push({ host, limit, signal, complete: d.resolve, fail: d.reject })
      try {
        return await d.promise
      } finally {
        signal.removeEventListener('abort', abort)
      }
    },
  }
  const complete = () =>
    pending.forEach((p, i) =>
      p.complete({
        bytes: 262144,
        elapsedMs: i === pending.length - 1 ? 100 : 2000,
        ttfbMs: 10,
        status: 206,
        directRange: true,
        reason: 'measured',
      }),
    )
  return { probe, pending, complete }
}

for (const native of [false, true]) {
  test(`V228 startup: real XHR gate retains timeout boundaries native=${native}`, async (t) => {
    for (const timeout of [0, 1, 500, 2999, 3000, 5000, 6000, 10000, 19000]) {
      const probes = startupProbe(),
        f = await fixture(t, native, false, undefined, undefined, probes.probe)
      try {
        assert.ok(f.measurement instanceof MeasurementController)
        const xhr = new f.NativeXhr(),
          start = f.now()
        xhr.open('GET', originalUrl)
        xhr.timeout = timeout
        xhr.send()
        assert.equal(xhr.nativeSends, 0)
        assert.ok(probes.pending.length > 0 && probes.pending.length <= 3)
        assert.equal(f.measurement.snapshot().startup?.state, 'running')
        assert.equal(f.measurement.snapshot().startup?.deadlineAt, start + 3000)
        const count = probes.pending.length,
          done = f.measurement.prepareStartup(originalUrl)
        f.clock!.advance(500)
        assert.equal(xhr.nativeSends, 0, 'waiting does not run the native timeout')
        probes.complete()
        await done
        await Promise.resolve()
        const selected = f.measurement.snapshot().startup!
        assert.equal(selected.result, 'adequate')
        assert.equal(new URL(xhr.url).host, selected.selectedHost)
        assert.equal(xhr.nativeSends, 1)
        assert.deepEqual(xhr.sentTimeouts, [timeout])
        assert.deepEqual(xhr.sentAt, [start + 500])
        assert.equal(probes.pending.length, count)
        assert.ok(probes.pending.every((p) => p.limit <= 512 * 1024 && p.signal.aborted))
        assert.equal(f.clock!.pendingCount, 0)
        xhr.complete()
      } finally {
        await f.scope.dispose()
      }
    }
  })
}

for (const [before, after] of [
  [0, 5000],
  [5000, 0],
  [10000, 1],
  [1, 19000],
] as const) {
  test(`V228 startup: website timeout ${before}->${after} during wait survives reopen`, async (t) => {
    const probes = startupProbe(),
      f = await fixture(t, true, false, undefined, undefined, probes.probe)
    assert.ok(f.measurement instanceof MeasurementController)
    const xhr = new f.NativeXhr()
    xhr.open('GET', originalUrl)
    xhr.timeout = before
    xhr.send()
    xhr.timeout = after
    const deadline = f.measurement.snapshot().startup?.deadlineAt
    const done = f.measurement.prepareStartup(originalUrl)
    assert.equal(f.measurement.snapshot().startup?.deadlineAt, deadline)
    probes.complete()
    await done
    await Promise.resolve()
    assert.equal(xhr.nativeSends, 1)
    assert.deepEqual(xhr.sentTimeouts, [after])
    xhr.timeout = 7777
    assert.equal(xhr.timeout, 7777)
    xhr.complete()
  })
}

test('V228 startup: timeout changed inside native reopen is not overwritten by an earlier snapshot', async (t) => {
  const f = await fixture(t, true, true),
    xhr = new f.NativeXhr()
  xhr.open('GET', originalUrl)
  xhr.timeout = 5000
  xhr.send()
  f.routes.apply = (url) => ({
    ...f.routes.inspectOriginal(url),
    url: url.replace('upos-sz-mirrorali', 'upos-sz-mirroraliov'),
  })
  xhr.onOpen = () => {
    xhr.timeout = 19000
  }
  f.wait.resolve()
  await f.wait.promise
  await Promise.resolve()
  assert.equal(xhr.successfulOpens, 2)
  assert.deepEqual(xhr.sentTimeouts, [19000])
  assert.equal(xhr.timeout, 19000)
  xhr.complete()
})

test('V228 startup: finite XHR and Fetch share one deadline and one cancelled waiter cannot dispatch', async (t) => {
  const probes = startupProbe(),
    f = await fixture(t, true, false, undefined, undefined, probes.probe)
  assert.ok(f.measurement instanceof MeasurementController)
  const a = new f.NativeXhr(),
    b = new f.NativeXhr(),
    events: string[] = []
  a.open('GET', originalUrl)
  a.timeout = 5000
  a.send()
  const used = probes.pending.length,
    deadline = f.measurement.snapshot().startup?.deadlineAt
  const fetched = f.fakeWindow.fetch(originalUrl)
  f.clock!.advance(2000)
  b.open('GET', originalUrl)
  b.timeout = 10000
  b.send()
  for (const type of ['abort', 'timeout', 'error', 'loadend'])
    a.addEventListener(type, () => events.push(type))
  a.abort()
  assert.deepEqual(events, ['abort', 'loadend'])
  assert.equal(probes.pending.length, used)
  assert.equal(f.measurement.snapshot().startup?.deadlineAt, deadline)
  assert.ok(probes.pending.every((p) => !p.signal.aborted))
  const done = f.measurement.prepareStartup(originalUrl)
  probes.complete()
  await done
  await fetched
  await Promise.resolve()
  assert.equal(a.nativeSends, 0)
  assert.equal(b.nativeSends, 1)
  assert.equal(f.fetchCalls.length, 1)
  assert.deepEqual(b.sentTimeouts, [10000])
  b.complete()
  const c = new f.NativeXhr()
  c.open('GET', originalUrl)
  c.timeout = 1
  c.send()
  assert.equal(c.nativeSends, 1)
  assert.equal(probes.pending.length, used)
  assert.equal(f.clock!.pendingCount, 0)
  c.complete()
})

for (const native of [false, true]) {
  for (const action of [
    'replace',
    'failed-open',
    'disabled',
    'content',
    'generation',
    'forbidden',
    'send-error',
    'probe-error',
  ] as const) {
    test(`V228 startup: finite waiter preserves ${action} native=${native}`, async (t) => {
      const probes = startupProbe(),
        f = await fixture(t, native, false, undefined, undefined, probes.probe)
      assert.ok(f.measurement instanceof MeasurementController)
      const xhr = new f.NativeXhr(),
        events: string[] = []
      xhr.open('GET', originalUrl)
      xhr.timeout = 5000
      xhr.send()
      assert.equal(xhr.nativeSends, 0)
      for (const type of ['error', 'abort', 'timeout', 'loadend'])
        xhr.addEventListener(type, () => events.push(type))
      const done = f.measurement.prepareStartup(originalUrl)
      if (action === 'replace') {
        xhr.open('POST', ordinaryUrl)
        xhr.timeout = 1234
        xhr.send()
      } else if (action === 'failed-open')
        assert.throws(() => xhr.open('BAD METHOD', ordinaryUrl), { name: 'SyntaxError' })
      else if (action === 'disabled') await f.settings.update({ disabled: true })
      else if (action === 'content') {
        const next = payload()
        next.data.dash.video[0]!.base_url = originalUrl.replaceAll('1000', '2000')
        const prior = f.session.get().epoch
        assert.equal(f.playurl.transform(next, 'trusted-api').accepted, true)
        assert.notEqual(f.session.get().epoch, prior)
        f.measurement.reset()
      } else if (action === 'generation') {
        f.advanceGeneration()
        f.measurement.reset()
      } else if (action === 'forbidden') {
        const apply = f.routes.apply.bind(f.routes),
          inspect = f.routes.inspectOriginal.bind(f.routes)
        f.routes.apply = (...args) => {
          const value = apply(...args)
          return {
            ...value,
            url: null,
            decision: { ...value.decision, action: 'block', reason: 'black' },
          }
        }
        f.routes.inspectOriginal = (...args) => {
          const value = inspect(...args)
          return {
            ...value,
            url: null,
            decision: { ...value.decision, action: 'block', reason: 'black' },
          }
        }
      } else if (action === 'send-error')
        xhr.sendError = new DOMException('synthetic', 'InvalidStateError')
      if (action === 'probe-error')
        probes.pending.forEach((p) => p.fail(Error('synthetic probe error')))
      else probes.complete()
      await done
      await Promise.resolve()
      const blocked =
        action === 'forbidden' ||
        action === 'send-error' ||
        (!native && (action === 'content' || action === 'generation'))
      assert.equal(xhr.nativeSends, blocked ? 0 : 1)
      assert.deepEqual(events, blocked ? ['error', 'loadend'] : [])
      if (action === 'replace') {
        assert.equal(xhr.url, ordinaryUrl)
        assert.equal(xhr.timeout, 1234)
      } else assert.equal(xhr.timeout, 5000)
      if (action === 'disabled') assert.equal(xhr.url, originalUrl)
      const used = probes.pending.length
      f.clock!.advance(4000)
      await f.measurement.prepareStartup(originalUrl)
      assert.equal(probes.pending.length, used)
      assert.equal(f.clock!.pendingCount, 0)
      if (!blocked) xhr.complete()
    })
  }
}

for (const eligibility of [
  'fixed',
  'disabled',
  'non-get',
  'non-media',
  'sync',
  'playurl',
] as const) {
  test(`V228 startup: ${eligibility} retains its original non-gated behavior`, async (t) => {
    const probes = startupProbe(),
      f = await fixture(t, true, false, undefined, undefined, probes.probe)
    assert.ok(f.measurement instanceof MeasurementController)
    if (eligibility === 'fixed') await f.settings.update({ fixedHost: TRUSTED_CATALOG[0] })
    if (eligibility === 'disabled') await f.settings.update({ disabled: true })
    const xhr = new f.NativeXhr()
    xhr.open(
      eligibility === 'non-get' ? 'POST' : 'GET',
      eligibility === 'non-media' ? ordinaryUrl : eligibility === 'playurl' ? apiUrl : originalUrl,
      eligibility !== 'sync',
    )
    if (eligibility !== 'sync') xhr.timeout = 5000
    xhr.send()
    assert.equal(xhr.nativeSends, 1)
    assert.equal(probes.pending.length, 0)
    assert.equal(f.clock!.pendingCount, 0)
    xhr.complete()
  })
}

for (const hasVideo of [false, true]) {
  test(`V228 startup: finite audio respects trusted content hasVideo=${hasVideo}`, async (t) => {
    const probes = startupProbe(),
      f = await fixture(t, false, false, undefined, undefined, probes.probe)
    assert.ok(f.measurement instanceof MeasurementController)
    const audioUrl = originalUrl.replace('30080', '30280')
    const body = {
      code: 0,
      data: {
        dash: {
          video: hasVideo ? payload().data.dash.video : [],
          audio: [{ id: 30280, bandwidth: 128000, base_url: audioUrl, backup_url: [] }],
        },
      },
    }
    assert.equal(f.playurl.transform(body, 'trusted-api').accepted, true)
    const audio = new f.NativeXhr()
    audio.open('GET', audioUrl)
    audio.timeout = 5000
    audio.send()
    assert.equal(audio.nativeSends, hasVideo ? 1 : 0)
    assert.equal(probes.pending.length, hasVideo ? 0 : 3)
    let video: InstanceType<typeof f.NativeXhr> | null = null
    if (hasVideo) {
      video = new f.NativeXhr()
      video.open('GET', originalUrl)
      video.timeout = 10000
      video.send()
      assert.equal(video.nativeSends, 0)
    }
    const done = f.measurement.prepareStartup(hasVideo ? originalUrl : audioUrl)
    probes.complete()
    await done
    await Promise.resolve()
    assert.equal(audio.nativeSends, 1)
    assert.equal(video?.nativeSends ?? 1, 1)
    assert.equal(probes.pending.length, 3)
    if (!hasVideo) assert.equal(f.routes.latestRequested('video'), null)
    audio.complete()
    video?.complete()
  })
}

function captureContentContexts(f: Awaited<ReturnType<typeof fixture>>) {
  const seen: unknown[] = [],
    original = f.playurl.transform.bind(f.playurl)
  f.playurl.transform = (body, source, key, ...context: unknown[]) => {
    seen.push(context[0])
    return Reflect.apply(original, f.playurl, [body, source, key, ...context])
  }
  return seen
}

test('BR-03 Fetch captures the once-normalized request cid before awaiting its response', async (t) => {
  const pending = deferred<Response>(),
    f = await fixture(t, true, false, () => pending.promise)
  t.after(() => pending.resolve(new Response('{}')))
  const seen = captureContentContexts(f)
  let conversions = 0,
    cid = '0009007199254740993'
  const input = {
    toString: () => {
      conversions++
      return apiUrl.replace('1000', cid)
    },
  }
  const response = f.fakeWindow.fetch(input as unknown as string)
  cid = '42'
  pending.resolve(new Response(JSON.stringify(payload())))
  await (await response).text()
  assert.equal(conversions, 1)
  assert.deepEqual(seen, [{ contentId: '9007199254740993', generation: 1, requestSequence: 1 }])
  assert.ok(f.fetchCalls[0]!.endsWith('cid=0009007199254740993'))
})

for (const type of ['text', 'json'] as const) {
  test(`BR-03 XHR ${type} failed open keeps the original cid and repeated getters transform once`, async (t) => {
    const f = await fixture(t),
      seen = captureContentContexts(f),
      xhr = new f.NativeXhr()
    let conversions = 0
    xhr.open('GET', {
      toString: () => {
        conversions++
        return apiUrl
      },
    } as unknown as URL)
    xhr.responseType = type
    xhr.send()
    assert.throws(() => xhr.open('BAD METHOD', apiUrl.replace('1000', '2000')), {
      name: 'SyntaxError',
    })
    xhr.complete()
    void xhr.response
    void xhr.response
    if (type === 'text') void xhr.responseText
    assert.equal(conversions, 1)
    assert.deepEqual(seen, [{ contentId: '1000', generation: 1, requestSequence: 1 }])
    xhr.open('GET', apiUrl.replace('1000', '3000'))
    xhr.send()
    xhr.complete()
    void xhr.response
    assert.deepEqual(seen, [
      { contentId: '1000', generation: 1, requestSequence: 1 },
      { contentId: '3000', generation: 1, requestSequence: 2 },
    ])
  })
}

test('BR-03 XHR successful synchronous open reentry owns the new cid', async (t) => {
  const f = await fixture(t),
    seen = captureContentContexts(f),
    xhr = new f.NativeXhr()
  xhr.addEventListener(
    'readystatechange',
    () => {
      if (xhr.readyState === 1) {
        xhr.open('GET', apiUrl.replace('1000', '2000'))
        xhr.send()
      }
    },
    { once: true },
  )
  xhr.open('GET', apiUrl)
  xhr.complete()
  void xhr.responseText
  assert.equal(xhr.nativeSends, 1)
  assert.deepEqual(seen, [{ contentId: '2000', generation: 1, requestSequence: 1 }])
})

test('V226 L01: protocol-relative XHR retains its open-owned cid at actual dispatch', async (t) => {
  const f = await fixture(t),
    seen = captureContentContexts(f),
    xhr = new f.NativeXhr()
  xhr.open('GET', apiUrl.replace('https:', ''))
  xhr.send()
  xhr.complete()
  void xhr.responseText
  assert.deepEqual(seen, [{ contentId: '1000', generation: 1, requestSequence: 1 }])
})

test('BR-03 transport treats invalid request identities as missing in Fetch and XHR', async (t) => {
  for (const query of [
    'cid=0',
    'cid=000',
    'cid=',
    'cid=1&cid=1',
    'cid=%201',
    'cid=1+',
    'cid=-1',
    'cid=1.5',
    'cid=123456789012345678901',
    'bvid=123',
  ]) {
    const f = await fixture(t),
      seen = captureContentContexts(f),
      url = apiUrl.split('?')[0] + '?' + query
    try {
      await (await f.fakeWindow.fetch(url)).text()
      const xhr = new f.NativeXhr()
      xhr.open('GET', url)
      xhr.send()
      xhr.complete()
      void xhr.responseText
      assert.deepEqual(
        seen,
        [
          { contentId: null, generation: 1, requestSequence: 1 },
          { contentId: null, generation: 1, requestSequence: 2 },
        ],
        query,
      )
    } finally {
      await f.scope.dispose()
    }
  }
})

async function blockedFixture(t: TestContext) {
  const f = await fixture(t),
    xhr = new f.NativeXhr(),
    events: string[] = []
  xhr.open('GET', blockedUrl)
  for (const name of ['readystatechange', 'error', 'abort', 'load', 'loadend'])
    xhr.addEventListener(name, () => events.push(name))
  return { ...f, xhr, events }
}

test('BR-02 control: native failed open preserves the original request', async (t) => {
  const f = await fixture(t),
    xhr = new f.NativeXhr()
  f.nativeOpen.call(xhr, 'GET', ordinaryUrl)
  assert.throws(() => f.nativeOpen.call(xhr, 'BAD METHOD', ordinaryUrl + '/new'), {
    name: 'SyntaxError',
  })
  xhr.send()
  xhr.complete()
  assert.equal(xhr.responseURL, ordinaryUrl)
  assert.equal(xhr.nativeSends, 1)
})

test('BR-02 control: local policy failure completes once without native send', async (t) => {
  const { xhr, events } = await blockedFixture(t)
  xhr.send()
  await Promise.resolve()
  assert.equal(xhr.readyState, 4)
  assert.equal(xhr.nativeSends, 0)
  assert.deepEqual(events, ['readystatechange', 'error', 'loadend'])
})

for (const kind of ['method', 'forbidden', 'url', 'sync'] as const) {
  test(`BR-02 contract: ${kind} open exception must not discard the pending failure`, async (t) => {
    const { xhr, events } = await blockedFixture(t)
    xhr.send()
    assert.throws(
      () => {
        if (kind === 'method') xhr.open('BAD METHOD', ordinaryUrl)
        else if (kind === 'forbidden') xhr.open('TRACE', ordinaryUrl)
        else if (kind === 'url') xhr.open('GET', 'http://[')
        else {
          xhr.timeout = 1
          xhr.open('GET', ordinaryUrl, false)
        }
      },
      {
        name:
          kind === 'sync'
            ? 'InvalidAccessError'
            : kind === 'forbidden'
              ? 'SecurityError'
              : 'SyntaxError',
      },
    )
    await Promise.resolve()
    assert.deepEqual(events, ['readystatechange', 'error', 'loadend'])
    assert.equal(xhr.readyState, 4)
    assert.equal(xhr.nativeSends, 0)
  })
}

test('BR-02 contract: failed open after virtual DONE preserves DONE', async (t) => {
  const { xhr } = await blockedFixture(t)
  xhr.send()
  await Promise.resolve()
  assert.throws(() => xhr.open('BAD METHOD', ordinaryUrl), { name: 'SyntaxError' })
  assert.equal(xhr.readyState, 4)
  assert.equal(xhr.response, '')
  assert.equal(xhr.responseText, '')
})

for (const type of ['readystatechange', 'error'] as const) {
  test(`BR-02 contract: failed open in ${type} does not suppress remaining terminal events`, async (t) => {
    const { xhr, events } = await blockedFixture(t)
    xhr.addEventListener(
      type,
      () => assert.throws(() => xhr.open('BAD METHOD', ordinaryUrl), { name: 'SyntaxError' }),
      { once: true },
    )
    xhr.send()
    await Promise.resolve()
    assert.deepEqual(events, ['readystatechange', 'error', 'loadend'])
  })
}

test('BR-02 contract: failed open cannot authorize a second send of the blocked original', async (t) => {
  const { xhr } = await blockedFixture(t)
  xhr.send()
  assert.throws(() => xhr.open('BAD METHOD', ordinaryUrl), { name: 'SyntaxError' })
  let thrown: unknown
  try {
    xhr.send()
  } catch (error) {
    thrown = error
  }
  assert.equal(xhr.nativeSends, 0)
  assert.ok(thrown instanceof DOMException && thrown.name === 'InvalidStateError')
  await Promise.resolve()
})

for (const abort of [false, true]) {
  test(`BR-02 failed open preserves startup waiter with abort=${abort}`, async (t) => {
    const f = await fixture(t, true, true),
      xhr = new f.NativeXhr(),
      events: string[] = []
    xhr.open('GET', originalUrl)
    xhr.send()
    for (const type of ['abort', 'loadend']) xhr.addEventListener(type, () => events.push(type))
    assert.throws(() => xhr.open('BAD METHOD', ordinaryUrl), { name: 'SyntaxError' })
    if (abort) {
      xhr.abort()
      xhr.abort()
    }
    f.wait.resolve()
    await f.wait.promise
    assert.equal(xhr.nativeSends, abort ? 0 : 1)
    assert.deepEqual(events, abort ? ['abort', 'loadend'] : [])
    if (!abort) {
      xhr.complete()
      assert.deepEqual(events, ['loadend'])
    }
  })
}

for (const state of ['opened', 'sent', 'done'] as const) {
  test(`BR-02 failed open preserves ${state} native request and its observation`, async (t) => {
    const f = await fixture(t),
      xhr = new f.NativeXhr()
    xhr.open('GET', originalUrl)
    if (state !== 'opened') xhr.send()
    if (state === 'done') xhr.complete()
    assert.throws(() => xhr.open('BAD METHOD', ordinaryUrl), { name: 'SyntaxError' })
    assert.equal(xhr.readyState, state === 'done' ? 4 : 1)
    if (state === 'opened') xhr.send()
    if (state !== 'done') xhr.complete()
    assert.equal(xhr.nativeSends, 1)
    assert.equal(f.transport.snapshot().responseObserved, 1)
    assert.throws(() => xhr.send(), { name: 'InvalidStateError' })
  })
}

for (const action of ['send', 'abort', 'reopen', 'failed-reopen'] as const) {
  test(`BR-02 successful open synchronous callback owns ${action}`, async (t) => {
    const f = await fixture(t, true, true),
      xhr = new f.NativeXhr()
    xhr.addEventListener(
      'readystatechange',
      () => {
        if (action === 'reopen') xhr.open('POST', ordinaryUrl)
        if (action === 'failed-reopen')
          assert.throws(() => xhr.open('BAD METHOD', ordinaryUrl), { name: 'SyntaxError' })
        xhr.send()
        if (action === 'abort') xhr.abort()
      },
      { once: true },
    )
    xhr.open('GET', originalUrl)
    f.wait.resolve()
    await f.wait.promise
    assert.equal(xhr.nativeSends, action === 'abort' ? 0 : 1)
    assert.equal(xhr.readyState, action === 'abort' ? 0 : 1)
    if (action === 'reopen') {
      assert.equal(xhr.url, ordinaryUrl)
      assert.equal(xhr.method, 'POST')
    }
  })
}

for (const argument of ['method', 'url', 'username', 'password'] as const) {
  test(`BR-02 throwing ${argument} conversion preserves the prior owner and exception`, async (t) => {
    const { xhr, events } = await blockedFixture(t),
      failure = new Error('synthetic conversion')
    const throwing = {
      toString() {
        throw failure
      },
    }
    xhr.send()
    const args: unknown[] = ['GET', ordinaryUrl, true, null, null]
    args[{ method: 0, url: 1, username: 3, password: 4 }[argument]] = throwing
    assert.throws(
      () => Reflect.apply(xhr.open, xhr, args),
      (error) => error === failure,
    )
    await Promise.resolve()
    assert.deepEqual(events, ['readystatechange', 'error', 'loadend'])
    assert.equal(xhr.nativeSends, 0)
  })
}

test('BR-02 converts open arguments once in Web IDL order before publishing a new owner', async (t) => {
  const { xhr, events } = await blockedFixture(t),
    order: string[] = []
  xhr.send()
  const value = (name: string, result: string) => ({
    toString() {
      order.push(name)
      return result
    },
  })
  Reflect.apply(xhr.open, xhr, [
    value('method', 'post'),
    value('url', ordinaryUrl),
    true,
    value('username', 'user'),
    value('password', 'pass'),
  ])
  xhr.send()
  await Promise.resolve()
  assert.deepEqual(order, ['method', 'url', 'username', 'password'])
  assert.equal(xhr.method, 'POST')
  assert.equal(xhr.user, 'user')
  assert.equal(xhr.password, 'pass')
  assert.equal(xhr.nativeSends, 1)
  assert.deepEqual(events, [])
})

test('BR-02 conversion reentry followed by an exception retains the nested successful request', async (t) => {
  const { xhr } = await blockedFixture(t),
    failure = new Error('conversion after reentry')
  xhr.send()
  const method = {
    toString() {
      xhr.open('POST', ordinaryUrl)
      xhr.send()
      throw failure
    },
  }
  assert.throws(
    () => Reflect.apply(xhr.open, xhr, [method, ordinaryUrl + '/outer']),
    (error) => error === failure,
  )
  await Promise.resolve()
  assert.equal(xhr.nativeSends, 1)
  assert.equal(xhr.url, ordinaryUrl)
  assert.equal(xhr.method, 'POST')
  xhr.complete()
  assert.equal(xhr.responseURL, ordinaryUrl)
})

test('BR-02 missing arguments and non-ByteString methods do not replace a waiting owner', async (t) => {
  const { xhr, events } = await blockedFixture(t)
  xhr.send()
  for (const args of [
    [],
    ['GET'],
    ['\u0100', ordinaryUrl],
    [Symbol('method'), ordinaryUrl],
    ['GET', Symbol('url')],
  ]) {
    assert.throws(() => Reflect.apply(xhr.open, xhr, args), { name: 'TypeError' })
  }
  await Promise.resolve()
  assert.deepEqual(events, ['readystatechange', 'error', 'loadend'])
})

test('BR-02 omitted async is asynchronous but explicitly undefined is synchronous', async (t) => {
  const f = await fixture(t),
    xhr = new f.NativeXhr()
  xhr.open('GET', ordinaryUrl)
  assert.equal(xhr.syncMode, false)
  Reflect.apply(xhr.open, xhr, ['GET', ordinaryUrl, undefined])
  assert.equal(xhr.syncMode, true)
})

test('BR-02 custom method casing and password without username survive policy reopen', async (t) => {
  const f = await fixture(t, false),
    xhr = new f.NativeXhr()
  await f.settings.update({ fixedHost: 'upos-sz-mirroraliov.bilivideo.com' })
  f.routes.invalidateForUserSetting()
  xhr.open('GET', originalUrl, true, undefined, 'synthetic-pass')
  await f.settings.update({ disabled: true })
  xhr.send()
  assert.equal(xhr.password, 'synthetic-pass')
  assert.equal(xhr.nativeSends, 1)
  xhr.open('custom', ordinaryUrl)
  xhr.send()
  assert.equal(xhr.method, 'custom')
})

for (const type of ['', 'text', 'json'] as const) {
  test(`BR-02 failed open preserves ${type || 'default'} playurl response ownership`, async (t) => {
    const f = await fixture(t, false),
      xhr = new f.NativeXhr()
    xhr.open('GET', apiUrl)
    xhr.responseType = type
    xhr.send()
    f.advanceGeneration()
    xhr.complete()
    assert.throws(() => xhr.open('BAD METHOD', ordinaryUrl), { name: 'SyntaxError' })
    const value = type === 'json' ? xhr.response : JSON.parse(xhr.responseText)
    assert.equal(value.code, -1)
    assert.equal(xhr.status, 200)
    assert.equal(xhr.readyState, 4)
    if (type === 'json') assert.throws(() => xhr.responseText, { name: 'InvalidStateError' })
    else assert.equal(xhr.response, xhr.responseText)
  })
}

test('BR-02 failed sync open with JSON option preserves pending local error and null response', async (t) => {
  const { xhr, events } = await blockedFixture(t)
  xhr.responseType = 'json'
  xhr.send()
  assert.throws(() => xhr.open('GET', ordinaryUrl, false), { name: 'InvalidAccessError' })
  await Promise.resolve()
  assert.deepEqual(events, ['readystatechange', 'error', 'loadend'])
  assert.equal(xhr.response, null)
  assert.throws(() => xhr.responseText, { name: 'InvalidStateError' })
})

test('BR-02 retiring an active request does not clear a nested successful open or its observation', async (t) => {
  const f = await fixture(t),
    xhr = new f.NativeXhr()
  xhr.open('GET', originalUrl)
  xhr.send()
  xhr.receiveHeaders()
  xhr.addEventListener(
    'readystatechange',
    () => {
      xhr.open('POST', ordinaryUrl)
      xhr.send()
      xhr.complete()
    },
    { once: true },
  )
  xhr.open('GET', originalUrl)
  assert.equal(xhr.url, ordinaryUrl)
  assert.equal(xhr.nativeSends, 2)
  assert.equal(xhr.readyState, 4)
  assert.equal(f.transport.snapshot().responseObserved, 1, 'only the nested request completed')
})

test('BR-02 first open failure leaves no sendable metadata and later valid open works', async (t) => {
  const f = await fixture(t),
    xhr = new f.NativeXhr()
  assert.throws(() => xhr.open('BAD METHOD', ordinaryUrl), { name: 'SyntaxError' })
  assert.equal(xhr.readyState, 0)
  assert.throws(() => xhr.send(), { name: 'InvalidStateError' })
  xhr.open('GET', ordinaryUrl)
  xhr.send()
  xhr.complete()
  assert.equal(xhr.nativeSends, 1)
  assert.equal(xhr.readyState, 4)
})

for (const option of ['timeout', 'json'] as const) {
  test(`BR-02 gated failed sync open with ${option} re-prepares only the unsent native request`, async (t) => {
    const f = await fixture(t, true, true),
      xhr = new f.NativeXhr()
    xhr.open('GET', originalUrl, true, 'synthetic-user', 'synthetic-pass')
    xhr.setRequestHeader('x-synthetic', 'kept')
    xhr.withCredentials = true
    xhr.send()
    if (option === 'timeout') xhr.timeout = 1
    else xhr.responseType = 'json'
    assert.throws(() => xhr.open('GET', ordinaryUrl, false), { name: 'InvalidAccessError' })
    assert.equal(xhr.readyState, 0, 'matches observed Chrome native state')
    f.wait.resolve()
    await f.wait.promise
    assert.equal(xhr.nativeSends, 1)
    assert.equal(xhr.url, originalUrl)
    assert.equal(xhr.user, 'synthetic-user')
    assert.equal(xhr.password, 'synthetic-pass')
    assert.equal(xhr.withCredentials, true)
    assert.deepEqual(xhr.headers, [['x-synthetic', 'kept']])
    assert.equal(xhr.timeout, option === 'timeout' ? 1 : 0)
    assert.equal(xhr.responseType, option === 'json' ? 'json' : '')
    xhr.complete()
  })
}

for (const action of ['abort-before-gate', 'abort-in-reopen', 'replace-in-reopen'] as const) {
  test(`BR-02 native preparation lost by failed open respects ${action}`, async (t) => {
    const f = await fixture(t, true, true),
      xhr = new f.NativeXhr(),
      events: string[] = []
    xhr.open('GET', originalUrl)
    xhr.send()
    xhr.timeout = 1
    assert.throws(() => xhr.open('GET', ordinaryUrl, false), { name: 'InvalidAccessError' })
    for (const type of ['abort', 'loadend']) xhr.addEventListener(type, () => events.push(type))
    if (action === 'abort-before-gate') xhr.abort()
    else
      xhr.addEventListener(
        'readystatechange',
        () => {
          if (action === 'abort-in-reopen') xhr.abort()
          else {
            xhr.open('POST', ordinaryUrl)
            xhr.send()
          }
        },
        { once: true },
      )
    f.wait.resolve()
    await f.wait.promise
    assert.equal(xhr.nativeSends, action === 'replace-in-reopen' ? 1 : 0)
    assert.deepEqual(events, action === 'replace-in-reopen' ? [] : ['abort', 'loadend'])
    if (action === 'replace-in-reopen') {
      assert.equal(xhr.url, ordinaryUrl)
      assert.equal(xhr.method, 'POST')
    }
  })
}

test('BR-02 failed sync open never replays an already-sent native request', async (t) => {
  const f = await fixture(t, true, true),
    xhr = new f.NativeXhr()
  xhr.open('GET', originalUrl)
  xhr.timeout = 1
  xhr.send()
  assert.equal(xhr.nativeSends, 0)
  f.wait.resolve()
  await f.wait.promise
  await Promise.resolve()
  assert.equal(xhr.nativeSends, 1)
  assert.throws(() => xhr.open('GET', ordinaryUrl, false), { name: 'InvalidAccessError' })
  f.wait.resolve()
  await f.wait.promise
  assert.equal(xhr.readyState, 0)
  assert.equal(xhr.nativeSends, 1)
  assert.throws(() => xhr.send(), { name: 'InvalidStateError' })
})

for (const failure of ['syntax', 'sync-once', 'sync-always'] as const) {
  test(`BR-04 preparation callback ${failure} has bounded dispatch and termination`, async (t) => {
    const f = await fixture(t, true, true),
      xhr = new f.NativeXhr(),
      terminal: string[] = []
    xhr.open('GET', originalUrl, true, 'synthetic-user', 'synthetic-password')
    xhr.responseType = 'json'
    xhr.withCredentials = true
    xhr.setRequestHeader('x-synthetic', 'kept')
    xhr.send()
    assert.throws(() => xhr.open('GET', ordinaryUrl, false), { name: 'InvalidAccessError' })
    const before = xhr.successfulOpens
    let callbacks = 0
    xhr.addEventListener(
      'readystatechange',
      () => {
        if (xhr.readyState !== 1) return
        callbacks++
        if (failure === 'syntax')
          assert.throws(() => xhr.open('BAD METHOD', ordinaryUrl), { name: 'SyntaxError' })
        else
          assert.throws(() => xhr.open('GET', ordinaryUrl, false), { name: 'InvalidAccessError' })
      },
      { once: failure !== 'sync-always' },
    )
    for (const type of ['error', 'load', 'loadend'])
      xhr.addEventListener(type, () => terminal.push(type))
    f.wait.resolve()
    await f.wait.promise
    await Promise.resolve()
    assert.equal(xhr.successfulOpens - before, failure === 'syntax' ? 1 : 2)
    assert.equal(callbacks, failure === 'sync-always' ? 2 : 1)
    if (failure === 'sync-always') {
      assert.equal(xhr.nativeSends, 0)
      assert.equal(xhr.readyState, 4)
      assert.equal(xhr.response, null)
      assert.deepEqual(terminal, ['error', 'loadend'])
      assert.equal(
        f.transport.snapshot().nativeCalled,
        0,
        'failed preparation is not a native send',
      )
      assert.throws(() => xhr.send(), { name: 'InvalidStateError' })
    } else {
      assert.equal(xhr.nativeSends, 1)
      assert.equal(xhr.url, originalUrl)
      assert.equal(xhr.withCredentials, true)
      assert.equal(xhr.user, 'synthetic-user')
      assert.equal(xhr.password, 'synthetic-password')
      assert.deepEqual(xhr.headers, [['x-synthetic', 'kept']])
      xhr.complete()
      assert.deepEqual(terminal, ['load', 'loadend'])
    }
  })
}

for (const option of ['responseType', 'timeout', 'credentials', 'header'] as const) {
  for (const action of ['invalidate', 'abort', 'replace'] as const) {
    test(`BR-04 ${option} restoration respects ${action} ownership`, async (t) => {
      const f = await fixture(t, true, true),
        xhr = new f.NativeXhr(),
        events: string[] = []
      xhr.open('GET', originalUrl)
      xhr.responseType = 'json'
      xhr.setRequestHeader('x-synthetic', 'kept')
      xhr.send()
      assert.throws(() => xhr.open('GET', ordinaryUrl, false), { name: 'InvalidAccessError' })
      xhr.onRestore = (key) => {
        if (key !== option) return
        xhr.onRestore = null
        if (action === 'invalidate')
          assert.throws(() => xhr.open('GET', ordinaryUrl, false), { name: 'InvalidAccessError' })
        else if (action === 'abort') xhr.abort()
        else {
          xhr.open('POST', ordinaryUrl)
          xhr.send()
        }
      }
      for (const type of ['abort', 'error', 'loadend'])
        xhr.addEventListener(type, () => events.push(type))
      f.wait.resolve()
      await f.wait.promise
      await Promise.resolve()
      assert.equal(xhr.nativeSends, action === 'abort' ? 0 : 1)
      assert.equal(xhr.url, action === 'replace' ? ordinaryUrl : originalUrl)
      assert.deepEqual(events, action === 'abort' ? ['abort', 'loadend'] : [])
      if (action !== 'abort') xhr.complete()
    })
  }
}

test('BR-04 deferred native send exception terminates once while immediate send throws unchanged', async (t) => {
  const f = await fixture(t, true, true),
    xhr = new f.NativeXhr(),
    events: string[] = []
  const failure = new DOMException('synthetic dispatch failure', 'InvalidStateError')
  xhr.open('GET', originalUrl)
  xhr.sendError = failure
  xhr.send()
  for (const type of ['readystatechange', 'error', 'loadend'])
    xhr.addEventListener(type, () => events.push(type))
  f.wait.resolve()
  await f.wait.promise
  await Promise.resolve()
  assert.deepEqual(events, ['readystatechange', 'error', 'loadend'])
  assert.equal(xhr.readyState, 4)
  assert.equal(xhr.nativeSends, 0)
  assert.throws(() => xhr.send(), { name: 'InvalidStateError' })
  assert.equal(
    f.routes.pendingMediaCount(),
    0,
    'failed native dispatch releases pending media attribution',
  )
  assert.equal(
    f.evidence.list().length,
    0,
    'a local dispatch exception is not a CDN failure sample',
  )
  const immediate = new f.NativeXhr()
  immediate.open('POST', ordinaryUrl)
  immediate.sendError = failure
  assert.throws(
    () => immediate.send(),
    (error) => error === failure,
  )
})

for (const [label, makeReason] of [
  ['object', () => ({ tag: 'fetch-owned-object' })],
  ['Error', () => new Error('fetch-owned-error')],
  ['string', () => 'fetch-owned-string'],
  ['zero', () => 0],
  ['false', () => false],
  ['empty-string', () => ''],
  ['null', () => null],
  ['default', () => undefined],
] as const) {
  for (const timing of ['pre-aborted', 'waiting'] as const) {
    test(`BR-05 managed Fetch ${timing} preserves ${label} while other Fetch and XHR finish`, async (t) => {
      const startup = startupAbortFixture(t),
        f = await fixture(t, true, false, undefined, startup.measurement)
      const controller = new AbortController(),
        reason = makeReason(),
        xhr = new f.NativeXhr()
      xhr.open('GET', originalUrl)
      xhr.send()
      const other = f.fakeWindow.fetch(originalUrl)
      if (timing === 'pre-aborted') controller.abort(reason)
      const pending = f.fakeWindow.fetch(originalUrl, { signal: controller.signal })
      if (timing === 'waiting') controller.abort(reason)
      const caught = await pending.then(
        () => ({ rejected: false, reason: undefined }),
        (reason) => ({ rejected: true, reason }),
      )
      assert.equal(caught.rejected, true)
      assert.strictEqual(caught.reason, controller.signal.reason)
      assert.equal(startup.probeSignals.length, 1)
      assert.equal(startup.probeSignals[0]!.aborted, false)
      assert.equal(f.fetchCalls.length, 0)
      assert.equal(xhr.nativeSends, 0)
      startup.complete()
      assert.equal((await other).status, 200)
      await Promise.resolve()
      assert.equal(xhr.nativeSends, 1)
      assert.equal(f.fetchCalls.length, 1)
      assert.equal(startup.commits(), 1)
      xhr.complete()
    })
  }
}

for (const action of ['disable', 'blacklist', 'change-host'] as const) {
  test(`BR-04 preparation callback rechecks ${action} before native dispatch`, async (t) => {
    const f = await fixture(t, false, true),
      xhr = new f.NativeXhr()
    await f.settings.update({ fixedHost: 'upos-sz-mirroraliov.bilivideo.com' })
    f.routes.invalidateForUserSetting()
    xhr.open('GET', originalUrl)
    xhr.responseType = 'json'
    xhr.send()
    assert.throws(() => xhr.open('GET', ordinaryUrl, false), { name: 'InvalidAccessError' })
    const getSettings = f.settings.get.bind(f.settings),
      settings = getSettings()
    const inspectOriginal = f.routes.inspectOriginal.bind(f.routes)
    let blacklistChecks = 0
    xhr.addEventListener(
      'readystatechange',
      () => {
        if (action === 'disable') f.settings.get = () => ({ ...settings, disabled: true })
        else if (action === 'change-host') {
          f.settings.get = () => ({ ...settings, fixedHost: 'upos-sz-mirrorcos.bilivideo.com' })
          f.routes.invalidateForUserSetting()
        } else {
          // Let stale Native dispatch reach the host restriction check instead of
          // being rejected earlier solely because Catalog generation changed.
          f.settings.get = () => ({ ...settings, considerNativeSources: true })
          f.advanceGeneration()
          f.routes.inspectOriginal = (url) => {
            blacklistChecks++
            const applied = inspectOriginal(url)
            return {
              ...applied,
              url: null,
              decision: {
                action: 'block',
                id: applied.decision.id,
                reason: 'black',
                routeType: 'root-original',
                host: null,
                ranking: [],
              },
            }
          }
        }
      },
      { once: true },
    )
    f.wait.resolve()
    await f.wait.promise
    await Promise.resolve()
    assert.equal(xhr.nativeSends, action === 'blacklist' ? 0 : 1)
    if (action === 'blacklist') {
      assert.ok(blacklistChecks > 0)
      assert.equal(f.transport.snapshot().lastBlocked?.reason, 'black')
    }
    if (action === 'disable') assert.equal(xhr.url, originalUrl)
    if (action === 'change-host')
      assert.equal(new URL(xhr.url).hostname, 'upos-sz-mirrorcos.bilivideo.com')
  })
}

test('B2 gated abort exposes DONE then UNSENT with empty response and exactly one terminal sequence', async (t) => {
  const f = await fixture(t, true, true),
    xhr = new f.NativeXhr(),
    events: string[] = []
  xhr.open('GET', originalUrl)
  xhr.send()
  assert.throws(() => xhr.send(), { name: 'InvalidStateError' })
  assert.throws(() => xhr.setRequestHeader('x-test', 'late'), { name: 'InvalidStateError' })
  for (const type of ['readystatechange', 'abort', 'loadend'])
    xhr.addEventListener(type, (event) => {
      events.push(type)
      assert.equal(xhr.readyState, 4)
      assert.equal(xhr.status, 0)
      assert.equal(xhr.responseURL, '')
      assert.equal(xhr.response, '')
      assert.equal(xhr.responseText, '')
      if (type !== 'readystatechange') {
        assert.ok(event instanceof ProgressEvent)
        assert.equal(event.loaded, 0)
      }
    })
  xhr.abort()
  xhr.abort()
  f.wait.resolve()
  await f.wait.promise
  assert.deepEqual(events, ['readystatechange', 'abort', 'loadend'])
  assert.equal(xhr.readyState, 0)
  assert.throws(() => xhr.send(), { name: 'InvalidStateError' })
  assert.equal(xhr.nativeSends, 0)
})

for (const type of ['readystatechange', 'abort'] as const) {
  test(`B2/B4 reopen inside ${type} does not receive an old loadend or late send`, async (t) => {
    const f = await fixture(t, true, true),
      xhr = new f.NativeXhr(),
      events: string[] = []
    xhr.open('GET', originalUrl)
    xhr.send()
    xhr.addEventListener(
      type,
      () => {
        xhr.open('GET', 'https://example.invalid/new')
        xhr.send()
      },
      { once: true },
    )
    xhr.addEventListener('loadend', () => events.push('loadend'))
    xhr.abort()
    f.wait.resolve()
    await f.wait.promise
    assert.equal(xhr.url, 'https://example.invalid/new')
    assert.equal(xhr.nativeSends, 1)
    assert.equal(xhr.readyState, 1)
    assert.deepEqual(events, [])
    xhr.complete()
    assert.deepEqual(events, ['loadend'])
  })
}

test('B4 queued error is owned by its request even when error callback reopens', async (t) => {
  const f = await fixture(t),
    xhr = new f.NativeXhr(),
    events: string[] = []
  xhr.open('GET', 'https://httpdns.bilivideo.com/resolve')
  xhr.send()
  xhr.addEventListener(
    'error',
    () => {
      xhr.open('GET', 'https://example.invalid/new')
      xhr.send()
    },
    { once: true },
  )
  xhr.addEventListener('loadend', () => events.push('loadend'))
  await Promise.resolve()
  assert.equal(xhr.nativeSends, 1)
  assert.equal(xhr.readyState, 1)
  assert.deepEqual(events, [])
})

test('B5 policy reopen preserves async options, authorization arguments and headers', async (t) => {
  const f = await fixture(t, false),
    xhr = new f.NativeXhr()
  await f.settings.update({ fixedHost: 'upos-sz-mirroraliov.bilivideo.com' })
  f.routes.invalidateForUserSetting()
  xhr.open('GET', originalUrl, true, 'synthetic-user', 'synthetic-password')
  assert.notEqual(xhr.url, originalUrl)
  xhr.responseType = 'arraybuffer'
  xhr.timeout = 5000
  xhr.withCredentials = true
  xhr.setRequestHeader('x-synthetic', 'kept')
  await f.settings.update({ disabled: true })
  xhr.send()
  assert.equal(xhr.url, originalUrl)
  assert.equal(xhr.responseType, 'arraybuffer')
  assert.equal(xhr.timeout, 5000)
  assert.equal(xhr.withCredentials, true)
  assert.equal(xhr.user, 'synthetic-user')
  assert.equal(xhr.password, 'synthetic-password')
  assert.deepEqual(xhr.headers, [['x-synthetic', 'kept']])
  assert.equal(xhr.nativeSends, 1)
})

test('B2 native sent timeout and cancellation are not synthesized or replayed after policy change', async (t) => {
  const f = await fixture(t, true, true),
    xhr = new f.NativeXhr(),
    events: string[] = []
  xhr.open('GET', originalUrl)
  xhr.timeout = 5000
  xhr.send()
  assert.equal(xhr.nativeSends, 0, 'explicit timeout joins the startup gate')
  f.wait.resolve()
  await f.wait.promise
  await Promise.resolve()
  assert.equal(xhr.nativeSends, 1, 'native timeout begins only after actual dispatch')
  assert.equal(xhr.timeout, 5000)
  for (const type of ['abort', 'timeout', 'loadend'])
    xhr.addEventListener(type, () => events.push(type))
  await f.settings.update({ disabled: true })
  f.advanceGeneration()
  assert.deepEqual(events, [])
  assert.equal(xhr.nativeSends, 1)
  xhr.abort()
  f.wait.resolve()
  await f.wait.promise
  assert.deepEqual(events, ['abort', 'loadend'])
  assert.equal(xhr.nativeSends, 1)
  assert.equal(xhr.readyState, 0)
})

test('B3 text getter exceptions survive JSON failures and hook restoration preserves later owners', async (t) => {
  const f = await fixture(t, false),
    xhr = new f.NativeXhr()
  xhr.open('GET', apiUrl)
  xhr.responseType = 'json'
  xhr.send()
  f.advanceGeneration()
  xhr.complete()
  assert.equal(xhr.status, 200)
  assert.deepEqual(xhr.response, { code: -1, message: 'BiliCDN Catalog route unavailable' })
  assert.throws(() => xhr.responseText, { name: 'InvalidStateError' })
  const newer = () => 'new owner'
  Object.defineProperty(f.NativeXhr.prototype, 'response', { configurable: true, get: newer })
  assert.equal(f.transport.snapshot().hookState, 'degraded')
  f.transport.dispose()
  assert.equal(Object.getOwnPropertyDescriptor(f.NativeXhr.prototype, 'response')?.get, newer)
})

test('B1 retired opaque media attribution still enforces current host restrictions', async (t) => {
  const f = await fixture(t, true),
    opaque = 'https://upos-sz-mirrorali.bilivideo.com/opaque-chunk?synthetic=1'
  const input = payload()
  input.data.dash.video[0]!.base_url = opaque
  assert.equal(f.playurl.transform(input, 'trusted-api', 'opaque').accepted, true)
  const xhr = new f.NativeXhr()
  xhr.open('GET', opaque)
  f.advanceGeneration()
  await f.restrictions.add({
    host: new URL(opaque).hostname,
    type: 'black',
    kind: 'all',
    reason: 'user',
    expireAt: f.now() + 60_000,
  })
  xhr.send()
  assert.equal(xhr.nativeSends, 0)
})

test('CONTROL: native-on XHR rechecks blacklist before same-generation send', async (t) => {
  const f = await fixture(t)
  const xhr = new f.NativeXhr()
  xhr.open('POST', originalUrl)
  await f.restrictions.add({
    host: new URL(originalUrl).hostname,
    type: 'black',
    kind: 'all',
    reason: 'user',
    expireAt: f.now() + 60_000,
  })
  xhr.send()
  assert.equal(xhr.nativeSends, 0)
})

test('B1: native-on XHR must recheck blacklist after generation changes between open and send', async (t) => {
  const f = await fixture(t)
  const xhr = new f.NativeXhr()
  xhr.open('POST', originalUrl)
  await f.restrictions.add({
    host: new URL(originalUrl).hostname,
    type: 'black',
    kind: 'all',
    reason: 'user',
    expireAt: f.now() + 60_000,
  })
  f.advanceGeneration()
  assert.equal(f.routes.inspectOriginal(originalUrl).decision.action, 'block')
  xhr.send()
  assert.equal(xhr.nativeSends, 0, 'blacklisted original must not be sent after generation changes')
})

test('B1: gated native-on GET must recheck blacklist after SPA generation change', async (t) => {
  const f = await fixture(t, true, true)
  const xhr = new f.NativeXhr()
  xhr.open('GET', originalUrl)
  xhr.send()
  assert.equal(xhr.nativeSends, 0)
  await f.restrictions.add({
    host: new URL(originalUrl).hostname,
    type: 'black',
    kind: 'all',
    reason: 'user',
    expireAt: f.now() + 60_000,
  })
  f.advanceGeneration()
  f.wait.resolve()
  await f.wait.promise
  assert.equal(
    xhr.nativeSends,
    0,
    'startup waiter must not release stale XHR onto a currently forbidden host',
  )
})

test('CONTROL: gated Fetch rejects the same stale blacklisted request', async (t) => {
  const f = await fixture(t, true, true)
  const response = f.fakeWindow.fetch(originalUrl)
  await f.restrictions.add({
    host: new URL(originalUrl).hostname,
    type: 'black',
    kind: 'all',
    reason: 'user',
    expireAt: f.now() + 60_000,
  })
  f.advanceGeneration()
  f.wait.resolve()
  await assert.rejects(response, /blocked media request/)
  assert.equal(f.fetchCalls.length, 0)
})

test('CONTROL: current-generation XHR blocks HTTPDNS in default Catalog mode', async (t) => {
  const f = await fixture(t, false)
  const xhr = new f.NativeXhr()
  xhr.open('GET', 'https://httpdns.bilivideo.com/resolve')
  xhr.send()
  assert.equal(xhr.nativeSends, 0)
})

test('B1: stale XHR must not bypass HTTPDNS block in default Catalog mode', async (t) => {
  const f = await fixture(t, false)
  const xhr = new f.NativeXhr()
  xhr.open('GET', 'https://httpdns.bilivideo.com/resolve')
  f.advanceGeneration()
  xhr.send()
  assert.equal(xhr.nativeSends, 0, 'generation change must not bypass enabled HTTPDNS block')
})

test('CONTROL: locally blocked XHR emits its own error and loadend', async (t) => {
  const f = await fixture(t)
  await f.restrictions.add({
    host: new URL(originalUrl).hostname,
    type: 'black',
    kind: 'all',
    reason: 'user',
    expireAt: f.now() + 60_000,
  })
  const xhr = new f.NativeXhr(),
    events: string[] = []
  for (const type of ['error', 'loadend']) xhr.addEventListener(type, () => events.push(type))
  xhr.open('POST', originalUrl)
  xhr.send()
  await Promise.resolve()
  assert.deepEqual(events, ['error', 'loadend'])
  assert.equal(xhr.nativeSends, 0)
})

test('B4: queued rejection from replaced XHR must not fail the newer native request', async (t) => {
  const f = await fixture(t)
  await f.restrictions.add({
    host: new URL(originalUrl).hostname,
    type: 'black',
    kind: 'all',
    reason: 'user',
    expireAt: f.now() + 60_000,
  })
  const xhr = new f.NativeXhr(),
    currentEvents: string[] = []
  xhr.open('POST', originalUrl)
  xhr.send()
  const legalUrl = originalUrl.replace(
    'upos-sz-mirrorali.bilivideo.com',
    'upos-sz-mirrorcos.bilivideo.com',
  )
  xhr.open('GET', legalUrl)
  for (const type of ['error', 'loadend'])
    xhr.addEventListener(type, () => currentEvents.push(type))
  xhr.send()
  assert.equal(xhr.nativeSends, 1)
  await Promise.resolve()
  assert.deepEqual(
    currentEvents,
    [],
    'error belonging to superseded request must not settle new website request',
  )
  xhr.complete()
})

test('CONTROL: unchanged synchronous Catalog XHR sends without assigning forbidden properties', async (t) => {
  const f = await fixture(t, false)
  const xhr = new f.NativeXhr()
  xhr.open('GET', originalUrl, false)
  assert.doesNotThrow(() => xhr.send())
  assert.equal(xhr.nativeSends, 1)
})

test('B5: disabling before synchronous XHR send must preserve original website dispatch', async (t) => {
  const f = await fixture(t, false)
  await f.settings.update({ fixedHost: 'upos-sz-mirroraliov.bilivideo.com' })
  f.routes.invalidateForUserSetting()
  const xhr = new f.NativeXhr()
  xhr.open('GET', originalUrl, false)
  assert.notEqual(xhr.url, originalUrl, 'fixture originally selects a different Catalog host')
  await f.settings.update({ disabled: true })
  assert.doesNotThrow(
    () => xhr.send(),
    'reopening sync XHR must not write forbidden responseType or timeout setters',
  )
  assert.equal(xhr.nativeSends, 1)
  assert.equal(xhr.url, originalUrl)
})

for (const type of ['', 'text', 'json'] as const) {
  test(`CONTROL: current-generation playurl response preserves ${type || 'default'} type`, async (t) => {
    const f = await fixture(t, false)
    const xhr = new f.NativeXhr()
    xhr.open('GET', apiUrl)
    xhr.responseType = type
    xhr.send()
    xhr.complete()
    assert.equal(typeof xhr.response, type === 'json' ? 'object' : 'string')
    const body = type === 'json' ? xhr.response : JSON.parse(String(xhr.response))
    assert.ok(body && typeof body === 'object')
    assert.equal(Reflect.get(body, 'code'), 0)
    assert.equal(Reflect.get(body, 'data').dash.video.length, 1)
    assert.equal(xhr.nativeSends, 1)
    assert.equal(xhr.status, 200)
  })
  test(`B3: stale playurl response preserves ${type || 'default'} type`, async (t) => {
    const f = await fixture(t, false)
    const xhr = new f.NativeXhr()
    xhr.open('GET', apiUrl)
    xhr.responseType = type
    xhr.send()
    f.advanceGeneration()
    xhr.complete()
    assert.equal(
      typeof xhr.response,
      type === 'json' ? 'object' : 'string',
      'safe failure payload must respect responseType',
    )
    const body = type === 'json' ? xhr.response : JSON.parse(String(xhr.response))
    assert.ok(body && typeof body === 'object')
    assert.equal(Reflect.get(body, 'code'), -1)
    assert.equal(JSON.stringify(body).includes(originalUrl), false)
    if (type !== 'json') assert.equal(xhr.response, xhr.responseText)
  })
}
