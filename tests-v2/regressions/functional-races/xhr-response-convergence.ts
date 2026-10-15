import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import { XhrHookAdapter } from '../../../src-v2/adapters/xhr-hook.ts'
import { TransportContext } from '../../../src-v2/adapters/transport-context.ts'
import type {
  StartupGate,
  TransportRoutes,
  TransportSettings,
} from '../../../src-v2/adapters/transport-ports.ts'
import type { PlayurlPort } from '../../../src-v2/application/ports.ts'
import type {
  PlayurlRequestContext,
  PlayurlTransformResult,
} from '../../../src-v2/domain/playurl-model.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { SessionStore } from '../../../src-v2/state/session-store.ts'
import { testScope } from '../../support/scope.ts'

const apiUrl = 'https://api.bilibili.com/x/player/wbi/playurl?cid=1000'
const accepted = (): PlayurlTransformResult => ({
  accepted: true,
  formats: ['dash'],
  videoCount: 1,
  audioCount: 0,
  segmentCount: 0,
  upstreamCode: 0,
  reason: null,
})

function responseObject(value: unknown): Record<string, unknown> {
  assert.ok(value !== null && typeof value === 'object')
  return value as Record<string, unknown>
}

function fixture(t: TestContext) {
  const scope = testScope(t),
    reads: string[] = [],
    calls: {
      payload: unknown
      key: string | undefined
      context: PlayurlRequestContext | undefined
    }[] = []
  const policy = { strict: true, disabled: false }
  const behavior: {
    accepted: boolean
    error: Error | null
    beforeTransform: ((payload: unknown, key: string | undefined) => void) | null
  } = { accepted: true, error: null, beforeTransform: null }
  // This boundary models native getter branding, text eligibility and stable JSON
  // identity. No network work or synthetic response enters product storage.
  class NativeXhr extends EventTarget {
    #state = 0
    #status = 0
    responseType: XMLHttpRequestResponseType = ''
    timeout = 0
    withCredentials = false
    responseURL = ''
    raw = ''
    json: unknown = null
    responseError: Error | null = null
    textError: Error | null = null
    get readyState() {
      return this.#state
    }
    get status() {
      reads.push('status')
      return this.#status
    }
    open(_method: string, _url: string | URL, _async?: boolean) {
      this.#state = 1
      this.#status = 0
      this.raw = ''
      this.json = null
    }
    send() {
      if (this.#state !== 1) throw new DOMException('send state', 'InvalidStateError')
    }
    abort() {
      this.#state = 0
    }
    setRequestHeader(_name: string, _value: string) {
      if (this.#state !== 1) throw new DOMException('header state', 'InvalidStateError')
    }
    receive(value: string | object, done = true) {
      this.raw = typeof value === 'string' ? value : JSON.stringify(value)
      this.json = typeof value === 'string' ? null : value
      this.#status = 200
      this.#state = done ? 4 : 3
    }
    get response(): unknown {
      void this.#state
      reads.push('native-response')
      if (this.responseError) throw this.responseError
      return this.responseType === 'json' ? this.json : this.raw
    }
    get responseText(): string {
      void this.#state
      reads.push('native-responseText')
      if (this.responseType !== '' && this.responseType !== 'text')
        throw new DOMException('not text', 'InvalidStateError')
      if (this.textError) throw this.textError
      return this.raw
    }
  }
  const settings = {
    get: () => ({ disabled: policy.disabled, blockHttpDns: false }),
  } satisfies TransportSettings
  const routes = {
    policyRevision: () => 0,
    isCatalogOnly: () => policy.strict,
    recognizesMedia: () => false,
    isBilibiliMedia: () => false,
    apply: () => {
      throw new Error('No media request in this response contract')
    },
    inspectOriginal: () => {
      throw new Error('No media request in this response contract')
    },
    requestStarted: () => undefined,
    observe: async () => undefined,
  } satisfies TransportRoutes
  const playurl = {
    transform(payload, _source, key, context) {
      reads.push('transform')
      calls.push({ payload, key, context })
      behavior.beforeTransform?.(payload, key)
      if (behavior.error) throw behavior.error
      if (payload && typeof payload === 'object') Reflect.set(payload, 'transformed', true)
      return behavior.accepted
        ? accepted()
        : { ...accepted(), accepted: false, reason: 'no-legal-route' }
    },
  } satisfies PlayurlPort
  const gate = {
    willGateStartup: () => false,
    prepareStartup: async () => undefined,
    noteUnpreflighted: () => undefined,
  } satisfies StartupGate
  const session = new SessionStore()
  session.beginGeneration(false)
  scope.defineGlobal('unsafeWindow', { configurable: true, value: { XMLHttpRequest: NativeXhr } })
  scope.defineGlobal('location', {
    configurable: true,
    value: new URL('https://www.bilibili.com/video/BVsynthetic'),
  })
  const context = new TransportContext(
    session,
    settings,
    routes,
    playurl,
    gate,
    () => 2_000_000_000_000,
    createRuntimeIds((bytes) => bytes.fill(2)),
  )
  const installation = new XhrHookAdapter(context).install()
  assert.ok(installation)
  scope.defer(() => installation.restore())
  const createXhr = (type: XMLHttpRequestResponseType = 'text', url = apiUrl) => {
    const xhr = new NativeXhr()
    scope.defer(() => xhr.abort())
    xhr.open('GET', url, true)
    xhr.responseType = type
    return xhr
  }
  return { NativeXhr, createXhr, reads, calls, behavior, policy, session, context, installation }
}

for (const first of ['response', 'responseText'] as const) {
  test(`XHR response convergence: ${first} first shares one completed text conversion`, (t) => {
    const f = fixture(t),
      xhr = f.createXhr()
    xhr.receive('{ "code": 0, "marker": "text" }')
    f.reads.length = 0
    const initial = xhr[first]
    assert.deepEqual(f.reads, [`native-${first}`, 'transform', 'status'])
    assert.deepEqual(JSON.parse(String(initial)), { code: 0, marker: 'text', transformed: true })
    assert.equal(xhr.response, initial)
    assert.equal(xhr.responseText, initial)
    assert.equal(f.calls.length, 1)
    assert.deepEqual(f.calls[0]?.context, { contentId: '1000' })
    assert.equal(f.context.snapshot().lastPlayurl?.accepted, true)
  })
}

test('XHR response convergence: JSON retains its native object identity and transforms once', (t) => {
  const f = fixture(t),
    xhr = f.createXhr('json'),
    native = { code: 0, marker: 'json' }
  xhr.receive(native)
  assert.equal(xhr.response, native)
  assert.equal(xhr.response, native)
  assert.deepEqual(native, { code: 0, marker: 'json', transformed: true })
  assert.equal(f.calls.length, 1)
  assert.equal(f.calls[0]?.payload, native)
  assert.throws(() => xhr.responseText, { name: 'InvalidStateError' })
})

for (const strict of [true, false]) {
  test(`XHR response convergence: malformed text is cached with Catalog-only ${strict}`, (t) => {
    const f = fixture(t),
      xhr = f.createXhr()
    f.policy.strict = strict
    xhr.receive('{malformed')
    const initial = xhr.responseText
    assert.equal(xhr.response, initial)
    assert.equal(xhr.responseText, initial)
    assert.equal(f.calls.length, 0)
    assert.equal(f.context.snapshot().lastPlayurl?.reason, 'malformed-payload')
    if (strict) assert.equal(JSON.parse(initial).code, -1)
    else assert.equal(initial, '{malformed')
  })

  for (const type of ['text', 'json'] as const) {
    test(`XHR response convergence: rejected ${type} is cached with Catalog-only ${strict}`, (t) => {
      const f = fixture(t),
        xhr = f.createXhr(type),
        native = { code: 0, marker: 'rejected' }
      f.policy.strict = strict
      f.behavior.accepted = false
      xhr.receive(native)
      const initial = xhr.response
      assert.equal(xhr.response, initial)
      assert.equal(f.calls.length, 1)
      assert.equal(f.context.snapshot().lastPlayurl?.reason, 'no-legal-route')
      if (strict)
        assert.equal(
          responseObject(type === 'text' ? JSON.parse(String(initial)) : initial).code,
          -1,
        )
      else if (type === 'json') assert.equal(initial, native)
      else assert.deepEqual(JSON.parse(String(initial)), { ...native, transformed: true })
    })
  }
}

for (const type of ['text', 'json'] as const) {
  test(`XHR response convergence: Catalog-only changes invalidate ${type} cache`, (t) => {
    const f = fixture(t),
      xhr = f.createXhr(type),
      native = { code: 0, marker: 'mode' }
    f.behavior.accepted = false
    f.policy.strict = false
    xhr.receive(native)
    const original = xhr.response
    f.policy.strict = true
    const blocked = xhr.response
    assert.equal(responseObject(type === 'text' ? JSON.parse(String(blocked)) : blocked).code, -1)
    assert.notEqual(blocked, original)
    f.policy.strict = false
    const restored = xhr.response
    assert.equal(restored, original)
    assert.equal(f.calls.length, 3)
    if (type === 'json') assert.equal(restored, native)
  })

  test(`XHR response convergence: reopen discards ${type} cache and preserves request context`, (t) => {
    const f = fixture(t),
      xhr = f.createXhr(type)
    xhr.receive({ code: 0, marker: 'first' })
    const first = xhr.response
    xhr.open('GET', apiUrl.replace('1000', '2000'), true)
    xhr.receive({ code: 0, marker: 'second' })
    const second = xhr.response
    assert.notEqual(second, first)
    assert.equal(xhr.response, second)
    assert.equal(f.calls.length, 2)
    assert.notEqual(f.calls[0]?.key, f.calls[1]?.key)
    assert.deepEqual(
      f.calls.map((call) => call.context),
      [{ contentId: '1000' }, { contentId: '2000' }],
    )
  })
}

test('XHR response convergence: native branding, eligibility and exceptions precede bypasses', (t) => {
  const f = fixture(t),
    xhr = f.createXhr('json')
  xhr.receive({ code: 0 })
  f.policy.disabled = true
  assert.throws(() => xhr.responseText, { name: 'InvalidStateError' })
  for (const key of ['response', 'responseText'] as const) {
    const get = Object.getOwnPropertyDescriptor(f.NativeXhr.prototype, key)?.get
    assert.ok(get)
    assert.throws(() => get.call({}), TypeError)
  }
  const responseError = new Error('native response getter'),
    textError = new Error('native text getter')
  xhr.responseError = responseError
  assert.throws(
    () => xhr.response,
    (error) => error === responseError,
  )
  xhr.responseType = 'text'
  xhr.textError = textError
  assert.throws(
    () => xhr.responseText,
    (error) => error === textError,
  )
  assert.equal(f.calls.length, 0)
})

test('XHR response convergence: disabled and loading reads preserve their existing guards', (t) => {
  const f = fixture(t),
    xhr = f.createXhr()
  xhr.receive('{partial', false)
  assert.equal(xhr.response, '')
  assert.equal(xhr.responseText, '')
  f.policy.strict = false
  assert.equal(xhr.response, '{partial')
  assert.equal(xhr.responseText, '{partial')
  f.policy.strict = true
  f.policy.disabled = true
  xhr.receive('{ "code": 0 }')
  assert.equal(xhr.responseText, '{ "code": 0 }')
  assert.equal(xhr.response, '{ "code": 0 }')
  assert.equal(f.calls.length, 0)
  f.policy.disabled = false
  assert.equal(JSON.parse(xhr.responseText).transformed, true)
  assert.equal(f.calls.length, 1)
})

test('XHR response convergence: stale generation rejects before using a populated cache', (t) => {
  const f = fixture(t),
    xhr = f.createXhr()
  xhr.receive({ code: 0 })
  void xhr.responseText
  f.session.beginGeneration(false)
  assert.equal(JSON.parse(String(xhr.response)).code, -1)
  assert.equal(JSON.parse(xhr.responseText).code, -1)
  assert.equal(f.calls.length, 1)
  assert.equal(f.context.snapshot().lastPlayurl?.reason, 'inactive')
  f.policy.strict = false
  assert.equal(xhr.responseText, xhr.raw)
})

test('XHR response convergence: throwing transforms cache the existing failure projection', (t) => {
  const f = fixture(t),
    text = f.createXhr(),
    json = f.createXhr('json')
  f.behavior.error = new Error('synthetic transform rejection')
  text.receive({ code: 0 })
  json.receive({ code: 0 })
  assert.equal(JSON.parse(text.responseText).code, -1)
  assert.equal(text.response, text.responseText)
  const blocked = json.response
  assert.equal(responseObject(blocked).code, -1)
  assert.equal(json.response, blocked)
  assert.equal(f.calls.length, 2)
  assert.equal(f.context.snapshot().lastPlayurl?.reason, 'malformed-payload')
})

test('XHR response convergence: synchronous getter reentry completes before outer cache publication', (t) => {
  const f = fixture(t),
    xhr = f.createXhr()
  let nested: string | undefined
  xhr.receive({ code: 0, marker: 'reentry' })
  f.behavior.beforeTransform = () => {
    f.behavior.beforeTransform = null
    nested = xhr.responseText
  }
  const outer = xhr.response
  assert.equal(outer, nested)
  assert.equal(xhr.responseText, outer)
  assert.equal(f.calls.length, 2)
  assert.equal(f.calls[0]?.key, f.calls[1]?.key)
})

for (const type of ['text', 'json'] as const) {
  test(`XHR response convergence: ${type} transform reentry cannot publish into a reopened request`, (t) => {
    const f = fixture(t),
      xhr = f.createXhr(type)
    let nested: unknown
    xhr.receive({ code: 0, marker: 'old' })
    f.behavior.beforeTransform = () => {
      f.behavior.beforeTransform = null
      xhr.open('GET', apiUrl.replace('1000', '2000'), true)
      xhr.receive({ code: 0, marker: 'new' })
      nested = xhr.response
    }
    const outer = xhr.response
    const object = (value: unknown) =>
      responseObject(type === 'text' ? JSON.parse(String(value)) : value)
    assert.equal(object(outer).marker, 'old')
    assert.equal(object(nested).marker, 'new')
    assert.equal(xhr.response, nested)
    assert.equal(f.calls.length, 2)
    assert.notEqual(f.calls[0]?.key, f.calls[1]?.key)
    assert.deepEqual(
      f.calls.map((call) => call.context),
      [{ contentId: '1000' }, { contentId: '2000' }],
    )
  })
}
