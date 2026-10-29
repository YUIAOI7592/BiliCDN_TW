import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, media } from './functional-races/routing-fixture.ts'
import { testScope } from '../support/scope.ts'
import {
  requestId,
  type RequestContext,
  type TransportObservation,
} from '../../src-v2/domain/model.ts'
import { TransportAdapter } from '../../src-v2/adapters/transport.ts'
import { createRuntimeIds } from '../../src-v2/platform/runtime-ids.ts'

const first = 'upos-sz-mirroraliov.bilivideo.com'
const alternative = 'upos-sz-mirrorbos.bilivideo.com'

async function routeFixture(
  t: Parameters<typeof testScope>[0],
  suppressed = false,
  verified = true,
) {
  const scope = testScope(t),
    f = fixture(scope)
  await f.settings.update({ earlyRetryEnabled: true })
  const state = f.session.get(),
    original = media('retry', 'video.m4s')
  const rep = f.vault.register({
    generation: state.generation,
    epoch: state.epoch,
    kind: 'video',
    key: 'video',
    height: 1080,
    codec: 'avc',
    bandwidth: 1_000_000,
    urls: [original],
    source: 'trusted-api',
  })!
  const applied = f.routes.apply(original)
  assert.ok(applied.context)
  const request: RequestContext = {
    requestId: requestId('retry-current'),
    generation: state.generation,
    epoch: state.epoch,
    representation: rep,
    authorityRevision: applied.context.authorityRevision,
    routePolicyRevision: f.routes.policyRevision(),
    decisionId: applied.decision.id,
    kind: 'video',
    attributionStatus: 'matched',
    attributionSource: 'exact',
    decisionStage: 'request',
    routeType: 'catalog-generated',
    originalHost: first,
    targetHost: first,
    sourceHost: first,
    playurlHostChanged: false,
    playurlOutput: null,
    urlChanged: false,
    hostChanged: false,
    startedAt: f.clock.now(),
  }
  if (suppressed) scope.defer(f.routes.suppressEarlyRetryEvidence(['retry-past-1', 'retry-past-2']))
  for (const serial of [1, 2]) {
    const past = {
      ...request,
      requestId: requestId(`retry-past-${serial}`),
      targetHost: alternative,
      startedAt: f.clock.now() - 100,
    }
    const observation: TransportObservation = {
      ...(verified ? { retryVerifiedBytes: 256 * 1024 } : {}),
      request: past,
      generation: past.generation,
      epoch: past.epoch,
      decisionId: past.decisionId,
      representation: rep,
      kind: 'video',
      routeType: 'catalog-generated',
      originalHost: first,
      targetHost: alternative,
      finalHost: alternative,
      responseUrlMatchesRequest: true,
      streamKey: applied.streamKey,
      status: 206,
      bytes: 256 * 1024,
      ttfbMs: 20,
      elapsedMs: 100,
      completedAt: f.clock.now(),
      outcome: 'success',
    }
    await f.routes.observe(observation)
  }
  f.routes.requestStarted(request)
  return { ...f, request, original, rep, scope }
}

test('UP141-RETRY route permit prepares without affinity and commits only accepted dispatch', async (t) => {
  const f = await routeFixture(t)
  const demand = { kind: 'video' as const, requiredMbps: 2, highDemand: false }
  const found = f.routes.earlyRetryAlternative(f.request, demand)
  assert.equal(found?.host, alternative)
  const before = f.session.get().affinity
  const permit = f.routes.prepareEarlyRetry(f.request, alternative, demand)
  assert.ok(permit)
  assert.deepEqual(f.session.get().affinity, before)
  const selected = f.routes.applyEarlyRetry(f.original, permit)
  assert.ok(selected)
  assert.equal(new URL(selected.url!).hostname, alternative)
  assert.deepEqual(f.session.get().affinity, before)
  const retry = {
    ...f.request,
    requestId: requestId('retry-new'),
    targetHost: alternative,
    decisionId: selected.decision.id,
  }
  f.routes.requestStarted(retry)
  assert.equal(f.routes.acceptEarlyRetry(permit, retry), true)
  assert.equal(f.session.get().affinity?.host, alternative)
  assert.equal(f.routes.acceptEarlyRetry(permit, retry), false)
})

test('UP141-RETRY expired or policy-revoked route permit cannot be consumed', async (t) => {
  const f = await routeFixture(t)
  const demand = { kind: 'video' as const, requiredMbps: 2, highDemand: false }
  const permit = f.routes.prepareEarlyRetry(f.request, alternative, demand)
  assert.ok(permit)
  await f.clock.advance(2001)
  assert.equal(f.routes.applyEarlyRetry(f.original, permit), null)
  const next = f.routes.prepareEarlyRetry(f.request, alternative, demand)
  assert.ok(next)
  f.routes.invalidateForUserSetting()
  assert.equal(f.routes.applyEarlyRetry(f.original, next), null)
})

test('UP141-RETRY alternative evidence requires current identity and persisted unique successes', async (t) => {
  const f = await routeFixture(t)
  const demand = { kind: 'video' as const, requiredMbps: 2, highDemand: false }
  assert.equal(f.routes.earlyRetryAlternative(f.request, demand)?.successCount, 2)
  await f.clock.advance(60001)
  assert.equal(f.routes.earlyRetryAlternative(f.request, demand), null)
  assert.equal(f.routes.prepareEarlyRetry(f.request, alternative, demand), null)
})

async function xhrFixture(
  t: Parameters<typeof testScope>[0],
  capability:
    | 'normal'
    | 'missing-timeout'
    | 'fixed-timeout'
    | 'throwing-header'
    | 'throwing-timeout-getter' = 'normal',
) {
  const f = await routeFixture(t)
  class NativeEvent extends Event {
    override get isTrusted() {
      return true
    }
  }
  class NativeProgress extends NativeEvent {
    constructor(readonly loaded: number) {
      super('progress')
    }
  }
  class NativeXhr extends EventTarget {
    static nextSend: (() => void) | null = null
    static nextSendError: Error | null = null
    #ready = 0
    #status = 0
    #responseURL = ''
    #timeout = 0
    #sent = false
    #started = 0
    get readyState() {
      return this.#ready
    }
    get status() {
      return this.#status
    }
    get responseURL() {
      return this.#responseURL
    }
    get timeout() {
      return this.#timeout
    }
    set timeout(value: number) {
      void this.#timeout
      const converted = +value
      this.#timeout = Number.isFinite(converted) ? Math.trunc(converted) >>> 0 : 0
      if (this.#sent && this.#timeout > 0 && this.#timeout <= f.clock.now() - this.#started)
        queueMicrotask(() => {
          if (!this.#sent || this.#timeout === 0) return
          this.#sent = false
          this.#ready = 4
          this.#status = 0
          this.#responseURL = ''
          this.nativeTimeouts++
          this.dispatchEvent(new NativeEvent('readystatechange'))
          this.dispatchEvent(new NativeEvent('timeout'))
          this.dispatchEvent(new NativeEvent('loadend'))
        })
    }
    get response() {
      return ''
    }
    get responseText() {
      return ''
    }
    responseType: XMLHttpRequestResponseType = ''
    withCredentials = false
    url = ''
    headers: [string, string][] = []
    nativeSends = 0
    nativeTimeouts = 0
    responseOverride: string | null = null
    contentRange = 'bytes 0-399999/1000000'
    open(_method: string, url: string, _async = true) {
      this.#ready = 1
      this.#status = 0
      this.#responseURL = ''
      this.#sent = false
      this.url = url
      this.headers = []
      this.dispatchEvent(new NativeEvent('readystatechange'))
    }
    send() {
      if (NativeXhr.nextSendError) {
        const error = NativeXhr.nextSendError
        NativeXhr.nextSendError = null
        throw error
      }
      if (this.#ready !== 1 || this.#sent) throw new DOMException('send state', 'InvalidStateError')
      this.#sent = true
      this.#started = f.clock.now()
      this.nativeSends++
      const callback = NativeXhr.nextSend
      NativeXhr.nextSend = null
      callback?.()
    }
    setRequestHeader(name: string, value: string) {
      this.headers.push([`${name}`, `${value}`])
    }
    getResponseHeader(name: string) {
      return name.toLowerCase() === 'content-range' ? this.contentRange : null
    }
    abort() {
      this.#sent = false
      this.#ready = 0
      this.dispatchEvent(new NativeEvent('abort'))
    }
    progress(loaded: number, trusted = true) {
      this.#ready = 3
      this.#status = 206
      this.#responseURL = this.responseOverride ?? this.url
      this.dispatchEvent(new NativeEvent('readystatechange'))
      const event = trusted
        ? new NativeProgress(loaded)
        : Object.assign(new Event('progress'), { loaded })
      this.dispatchEvent(event)
    }
    complete(loaded = 400000) {
      this.progress(loaded)
      this.#ready = 4
      this.#sent = false
      this.dispatchEvent(new NativeEvent('load'))
      this.dispatchEvent(new NativeEvent('loadend'))
    }
  }
  const nativeTimeout = Object.getOwnPropertyDescriptor(NativeXhr.prototype, 'timeout')!
  if (capability === 'missing-timeout') Reflect.deleteProperty(NativeXhr.prototype, 'timeout')
  if (capability === 'fixed-timeout')
    Object.defineProperty(NativeXhr.prototype, 'timeout', { ...nativeTimeout, configurable: false })
  if (capability === 'throwing-header')
    Object.defineProperty(NativeXhr.prototype, 'getResponseHeader', {
      configurable: true,
      get() {
        throw Error('host header getter')
      },
    })
  if (capability === 'throwing-timeout-getter')
    Object.defineProperty(NativeXhr.prototype, 'timeout', {
      ...nativeTimeout,
      get() {
        throw Error('host timeout getter')
      },
    })
  f.scope.defineGlobal('unsafeWindow', {
    configurable: true,
    value: { XMLHttpRequest: NativeXhr, fetch: async () => new Response(null) },
  })
  f.scope.defineGlobal('location', {
    configurable: true,
    value: new URL('https://www.bilibili.com/video/BVfixture'),
  })
  f.scope.defineGlobal('document', {
    configurable: true,
    value: { baseURI: 'https://www.bilibili.com/' },
  })
  const transport = f.scope.own(
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
      createRuntimeIds((bytes) => bytes.fill(42)),
      f.routes,
    ),
  )
  transport.install()
  assert.equal(transport.snapshot().hookState, 'installed')
  const open = (range = 'bytes=0-399999') => {
    const xhr = new NativeXhr()
    xhr.open('GET', f.original)
    xhr.setRequestHeader('Range', range)
    xhr.send()
    return xhr
  }
  const ready = async (xhr: NativeXhr) => {
    xhr.progress(1000)
    await f.clock.advance(1600)
    xhr.progress(11000)
    return transport.samples(f.clock.now())[0]!
  }
  const arm = async (xhr: NativeXhr) => {
    const sample = await ready(xhr)
    assert.ok(sample)
    const permit = f.routes.prepareEarlyRetry(sample.request, alternative, {
      kind: 'video',
      requiredMbps: 2,
      highDemand: false,
    })
    assert.ok(permit)
    assert.equal(transport.arm(sample.request.requestId, permit), true)
    return permit
  }
  return { ...f, NativeXhr, nativeTimeout, transport, open, ready, arm }
}

test('UP141-RETRY native timeout hands matching website retry to alternative only after native send', async (t) => {
  const f = await xhrFixture(t),
    xhr = f.open()
  const events: string[] = []
  f.scope.defer(
    f.routes.subscribe((event) => {
      if (event.type === 'recovery') events.push('recovery')
    }),
  )
  let retry: InstanceType<typeof f.NativeXhr> | undefined
  xhr.addEventListener('timeout', () => {
    retry = f.open()
  })
  const permit = await f.arm(xhr)
  await Promise.resolve()
  assert.equal(xhr.nativeTimeouts, 1)
  assert.ok(retry)
  assert.equal(new URL(retry.url).hostname, alternative)
  assert.equal(retry.nativeSends, 1)
  assert.equal(f.transport.state(permit), 'dispatched')
  assert.equal(xhr.timeout, 0)
  retry.complete()
  await Promise.resolve()
  assert.equal(f.transport.state(permit), 'succeeded')
  assert.deepEqual(events, [])
  assert.equal(
    f.evidence.get(first, 'video')?.samples.some((sample) => sample.failureKind === 'timeout') ??
      false,
    false,
  )
})

test('UP141-RETRY same-value website timeout write revokes lease and survives cancellation', async (t) => {
  const f = await xhrFixture(t),
    xhr = f.open(),
    sample = await f.ready(xhr)
  const permit = f.routes.prepareEarlyRetry(sample.request, alternative, {
    kind: 'video',
    requiredMbps: 2,
    highDemand: false,
  })!
  assert.equal(f.transport.arm(sample.request.requestId, permit), true)
  const written = xhr.timeout
  xhr.timeout = written
  f.transport.cancel(permit)
  assert.equal(xhr.timeout, written)
  assert.equal(f.transport.state(permit), 'expired')
  await Promise.resolve()
})

test('UP141-RETRY timeout reuse restores zero before next open and keeps one native send per request', async (t) => {
  const f = await xhrFixture(t),
    xhr = f.open()
  xhr.addEventListener('timeout', () => {
    xhr.open('GET', f.original)
    assert.equal(xhr.timeout, 0)
    xhr.setRequestHeader('Range', 'bytes=0-399999')
    xhr.send()
  })
  const permit = await f.arm(xhr)
  await Promise.resolve()
  assert.equal(xhr.nativeSends, 2)
  assert.equal(f.transport.state(permit), 'dispatched')
  assert.equal(xhr.timeout, 0)
})

test('UP141-RETRY synthetic progress and malformed Content-Range cannot authorize early timeout', async (t) => {
  const f = await xhrFixture(t),
    xhr = f.open()
  xhr.progress(50000, false)
  await f.clock.advance(1600)
  const samples = f.transport.samples(f.clock.now())
  assert.equal(samples[0]!.loadedBytes, 0)
  assert.equal(samples[0]!.recentBytesPerSec, null)
  xhr.contentRange = 'bytes 1-399999/1000000'
  assert.deepEqual(f.transport.samples(f.clock.now()), [])
  assert.equal(xhr.timeout, 0)
})

test('UP141-RETRY timeout setter preserves native brand and performs user conversion once', async (t) => {
  const f = await xhrFixture(t),
    xhr = new f.NativeXhr()
  const wrapped = Object.getOwnPropertyDescriptor(f.NativeXhr.prototype, 'timeout')!
  assert.throws(() => wrapped.get!.call({}), TypeError)
  assert.throws(() => wrapped.set!.call({}, 1), TypeError)
  let conversions = 0
  wrapped.set!.call(xhr, {
    valueOf() {
      conversions++
      return 7
    },
  })
  assert.equal(conversions, 1)
  assert.equal(xhr.timeout, 7)
  const failure = Error('conversion')
  assert.throws(
    () =>
      wrapped.set!.call(xhr, {
        valueOf() {
          throw failure
        },
      }),
    (error) => error === failure,
  )
  assert.equal(xhr.timeout, 7)
  f.transport.dispose()
  assert.equal(
    Object.getOwnPropertyDescriptor(f.NativeXhr.prototype, 'timeout')?.set,
    f.nativeTimeout.set,
  )
})

test('UP141-RETRY sub250ms progress keeps rate sample bytes paired with their original time', async (t) => {
  const f = await xhrFixture(t),
    xhr = f.open()
  xhr.progress(0)
  for (let i = 1; i <= 20; i++) {
    await f.clock.advance(50)
    xhr.progress(i * 10000)
  }
  const sample = f.transport.samples(f.clock.now())[0]!
  assert.equal(sample.loadedBytes, 200000)
  assert.equal(sample.recentBytesPerSec, 200000)
})

test('UP141-RETRY native timeout brand errors precede bookkeeping and argument conversion', async (t) => {
  const f = await xhrFixture(t)
  const setter = Object.getOwnPropertyDescriptor(f.NativeXhr.prototype, 'timeout')!.set!
  const error = (fn: () => void) => {
    try {
      fn()
      return null
    } catch (value) {
      const e = value as Error
      return { name: e.name, message: e.message }
    }
  }
  for (const receiver of [1, null, {}]) {
    let conversions = 0
    const value = {
      valueOf() {
        conversions++
        return 5
      },
    }
    assert.deepEqual(
      error(() => setter.call(receiver, value)),
      error(() => f.nativeTimeout.set!.call(receiver, value)),
    )
    assert.equal(conversions, 0)
  }
})

test('UP141-RETRY tool-owned suppression excludes controlled successes from private alternative ledger', async (t) => {
  const f = await routeFixture(t, true)
  assert.equal(f.evidence.get(alternative, 'video')?.samples.length, 2)
  assert.equal(
    f.routes.earlyRetryAlternative(f.request, {
      kind: 'video',
      requiredMbps: 2,
      highDemand: false,
    }),
    null,
  )
  assert.throws(
    () => f.routes.suppressEarlyRetryEvidence(Array.from({ length: 33 }, (_, i) => `scope-${i}`)),
    RangeError,
  )
})

test('UP141-RETRY exact response path and query must match before timeout can be armed', async (t) => {
  const f = await xhrFixture(t),
    xhr = f.open()
  xhr.responseOverride = xhr.url.replace('video.m4s', 'different.m4s')
  xhr.progress(1000)
  await f.clock.advance(1600)
  xhr.progress(2000)
  assert.deepEqual(f.transport.samples(f.clock.now()), [])
  xhr.responseOverride = xhr.url + '&extra=query'
  xhr.progress(3000)
  assert.deepEqual(f.transport.samples(f.clock.now()), [])
  assert.equal(xhr.timeout, 0)
})

test('UP141-RETRY invalid trusted progress after arm restores owned timeout before removing tracking', async (t) => {
  const f = await xhrFixture(t),
    xhr = f.open(),
    sample = await f.ready(xhr)
  const permit = f.routes.prepareEarlyRetry(sample.request, alternative, {
    kind: 'video',
    requiredMbps: 2,
    highDemand: false,
  })!
  assert.equal(f.transport.arm(sample.request.requestId, permit), true)
  xhr.progress(500000)
  assert.equal(xhr.timeout, 0)
  assert.equal(f.transport.state(permit), 'failed')
  await Promise.resolve()
  assert.equal(xhr.nativeTimeouts, 0)
})

test('UP141-RETRY native send reentry cannot reuse the same permit for two requests', async (t) => {
  const f = await xhrFixture(t),
    xhr = f.open()
  let outer: InstanceType<typeof f.NativeXhr> | undefined,
    nested: InstanceType<typeof f.NativeXhr> | undefined
  xhr.addEventListener('timeout', () => {
    f.NativeXhr.nextSend = () => {
      nested = f.open()
    }
    outer = f.open()
  })
  await f.arm(xhr)
  await Promise.resolve()
  assert.ok(outer && nested)
  assert.equal(new URL(outer.url).hostname, alternative)
  assert.equal(new URL(nested.url).hostname, first)
  assert.equal(outer.nativeSends, 1)
  assert.equal(nested.nativeSends, 1)
})

test('UP141-RETRY post-send route listener failure never changes native successful send return', async (t) => {
  const f = await xhrFixture(t),
    xhr = f.open(),
    expected = Error('observer')
  f.scope.defer(
    f.routes.subscribe((event) => {
      if (event.type === 'route-decision' && event.decision.reason === 'early-retry') throw expected
    }),
  )
  let retry: InstanceType<typeof f.NativeXhr> | undefined, error: unknown
  xhr.addEventListener('timeout', () => {
    try {
      retry = f.open()
    } catch (value) {
      error = value
    }
  })
  await f.arm(xhr)
  await Promise.resolve()
  assert.equal(error, undefined)
  assert.equal(retry?.nativeSends, 1)
})

for (const capability of ['missing-timeout', 'fixed-timeout', 'throwing-header'] as const) {
  test(`UP141-RETRY optional capability ${capability} leaves ordinary Fetch and XHR hooks installed`, async (t) => {
    const f = await xhrFixture(t, capability),
      xhr = f.open()
    assert.equal(f.transport.snapshot().hookState, 'installed')
    assert.equal(xhr.nativeSends, 1)
    assert.deepEqual(f.transport.samples(f.clock.now()), [])
  })
}

test('UP141-RETRY timeout conversion reopen then throw cannot leak old script deadline', async (t) => {
  const f = await xhrFixture(t),
    xhr = f.open(),
    sample = await f.ready(xhr)
  const permit = f.routes.prepareEarlyRetry(sample.request, alternative, {
    kind: 'video',
    requiredMbps: 2,
    highDemand: false,
  })!
  assert.equal(f.transport.arm(sample.request.requestId, permit), true)
  const failure = Error('conversion reopen')
  const setter = Object.getOwnPropertyDescriptor(f.NativeXhr.prototype, 'timeout')!.set!
  assert.throws(
    () =>
      setter.call(xhr, {
        valueOf() {
          xhr.open('GET', f.original)
          xhr.setRequestHeader('Range', 'bytes=0-399999')
          xhr.send()
          throw failure
        },
      }),
    (error) => error === failure,
  )
  assert.equal(xhr.timeout, 0)
})

test('UP141-RETRY restoring hooks preserves a replacement getter that retained our timeout setter', async (t) => {
  const f = await xhrFixture(t)
  const descriptor = Object.getOwnPropertyDescriptor(f.NativeXhr.prototype, 'timeout')!
  const getter = function () {
    return 11
  }
  Object.defineProperty(f.NativeXhr.prototype, 'timeout', { ...descriptor, get: getter })
  f.transport.dispose()
  assert.equal(Object.getOwnPropertyDescriptor(f.NativeXhr.prototype, 'timeout')?.get, getter)
})

test('UP141-RETRY off-mode timeout assignment delegates native setter without extra getter reads', async (t) => {
  const f = await xhrFixture(t, 'throwing-timeout-getter')
  await f.settings.update({ earlyRetryEnabled: false })
  const xhr = new f.NativeXhr()
  assert.doesNotThrow(() => {
    xhr.timeout = 7
  })
  assert.equal(f.nativeTimeout.get!.call(xhr), 7)
})

test('UP141-RETRY passive byte counts without verified native range bytes cannot qualify alternatives', async (t) => {
  const f = await routeFixture(t, false, false)
  assert.equal(
    f.routes.earlyRetryAlternative(f.request, {
      kind: 'video',
      requiredMbps: 2,
      highDemand: false,
    }),
    null,
  )
})

test('UP141-RETRY synthetic timeout and load cannot become native retry handoff evidence', async (t) => {
  const f = await xhrFixture(t),
    xhr = f.open(),
    sample = await f.ready(xhr)
  const permit = f.routes.prepareEarlyRetry(sample.request, alternative, {
    kind: 'video',
    requiredMbps: 2,
    highDemand: false,
  })!
  assert.equal(f.transport.arm(sample.request.requestId, permit), true)
  xhr.dispatchEvent(new Event('timeout'))
  assert.equal(f.transport.state(permit), 'pending')
  assert.equal(xhr.timeout, 1600)
  let retry: InstanceType<typeof f.NativeXhr> | undefined
  xhr.addEventListener('timeout', (event) => {
    if (event.isTrusted) retry = f.open()
  })
  await Promise.resolve()
  assert.ok(retry)
  retry.dispatchEvent(new Event('load'))
  assert.equal(f.transport.state(permit), 'dispatched')
  retry.complete()
  assert.equal(f.transport.state(permit), 'succeeded')
})
