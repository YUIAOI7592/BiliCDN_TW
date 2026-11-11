import { type TestContext } from 'node:test'
import { TransportAdapter } from '../../../src-v2/adapters/transport/transport.ts'
import { SessionStore } from '../../../src-v2/state/session-store.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { testScope } from '../../support/scope.ts'
import { installProgressEvent } from '../../support/progress-event.ts'
import { requestDispatch } from '../../support/request-dispatch.ts'
import { type StartupGate } from '../../../src-v2/adapters/transport/transport-ports.ts'
import { type TransportRoutes } from '../../../src-v2/adapters/transport/transport-ports.ts'
import { type TransportSettings } from '../../../src-v2/adapters/transport/transport-ports.ts'
import { type PlayurlPort } from '../../../src-v2/application/playurl/playurl-contracts.ts'
import { type PlayurlTransformResult } from '../../../src-v2/domain/playurl-model.ts'

// Named scenarios create only their prerequisite state; resources belong to this test.

function createSummaryHookPrimitives() {
  let strict = true
  let disabled = false
  let body = '{"code":0}'
  let throws = false
  let calls = 0
  let responseOverride: Response | null = null
  let now = 2_000_000_000_000
  const secret = 'https://example.invalid/private/video.m4s?token=summary-secret'
  const accepted = {
    accepted: true,
    formats: ['dash', 'mp4', 'flv'],
    videoCount: 3,
    audioCount: 2,
    segmentCount: 4,
    upstreamCode: 0,
    reason: null,
  } satisfies PlayurlTransformResult
  let result: PlayurlTransformResult = accepted
  const playurl = {
    transform() {
      calls++
      if (throws) throw Error(secret)
      return result
    },
  } satisfies PlayurlPort
  const routes = {
    prepareRequest: requestDispatch(),
    policyRevision: () => 0,
    isCatalogOnly: () => strict,
    isBilibiliMedia: () => false,
    recognizesMedia: () => false,
    apply(): never {
      throw Error('Unexpected media application')
    },
    inspectOriginal(): never {
      throw Error('Unexpected media inspection')
    },
    requestStarted() {},
    async observe() {},
  } satisfies TransportRoutes
  const settings = {
    get: () => ({ disabled: disabled, blockHttpDns: false }),
  } satisfies TransportSettings
  const measurement = {
    willGateStartup: () => false,
    async prepareStartup() {},
    noteUnpreflighted() {},
  } satisfies StartupGate
  class FakeXhr extends EventTarget {
    #state = 0
    get readyState() {
      return this.#state
    }
    set readyState(value: number) {
      this.#state = value
    }
    status = 200
    responseURL = ''
    responseType: XMLHttpRequestResponseType = ''
    timeout = 0
    withCredentials = false
    payload: unknown = { code: 0 }
    rawText: string | null = null
    get response(): unknown {
      return this.responseType === 'json' ? this.payload : this.responseText
    }
    get responseText(): string {
      return this.rawText ?? JSON.stringify(this.payload)
    }
    open(_method: string, url: string | URL): void {
      this.responseURL = String(url)
      this.readyState = 1
    }
    send(): void {
      this.readyState = 4
      this.dispatchEvent(new Event('readystatechange'))
      this.dispatchEvent(new Event('load'))
      this.dispatchEvent(new Event('loadend'))
    }
    abort(): void {
      this.dispatchEvent(new Event('abort'))
    }
    setRequestHeader(): void {}
  }
  const nativeFetch: typeof fetch = async () =>
    responseOverride ?? new Response(body, { status: 200 })
  const windowFixture = { fetch: nativeFetch, XMLHttpRequest: FakeXhr }
  return {
    get strict(): boolean {
      return strict
    },
    set strict(value: boolean) {
      strict = value
    },
    get disabled(): boolean {
      return disabled
    },
    set disabled(value: boolean) {
      disabled = value
    },
    get body() {
      return body
    },
    set body(value: typeof body) {
      body = value
    },
    get throws() {
      return throws
    },
    set throws(value: typeof throws) {
      throws = value
    },
    get calls() {
      return calls
    },
    get responseOverride() {
      return responseOverride
    },
    set responseOverride(value: typeof responseOverride) {
      responseOverride = value
    },
    get now() {
      return now
    },
    set now(value: typeof now) {
      now = value
    },
    secret,
    accepted,
    get result() {
      return result
    },
    set result(value: typeof result) {
      result = value
    },
    playurl,
    routes,
    settings,
    measurement,
    windowFixture,
  }
}

export function createSummaryTransportResources(t: TestContext) {
  const scope = testScope(t)
  installProgressEvent(scope)
  const session = new SessionStore()
  session.beginGeneration(false)
  const block1 = createSummaryHookPrimitives()
  const { windowFixture, settings, routes, playurl, measurement, secret, accepted } = block1
  scope.defineGlobal('unsafeWindow', { configurable: true, value: windowFixture })
  scope.defineGlobal('location', {
    configurable: true,
    value: new URL('https://www.bilibili.com/'),
  })
  const transport = scope.own(
    new TransportAdapter(
      session,
      settings,
      routes,
      playurl,
      measurement,
      () => block1.now,
      createRuntimeIds(),
      undefined,
      () => block1.now,
    ),
  )
  transport.install()
  const endpoint = 'https://api.bilibili.com/x/player/wbi/playurl?token=summary-secret'
  const makeXhr = (type: XMLHttpRequestResponseType, value: unknown = { code: 0 }) => {
    const xhr = new windowFixture.XMLHttpRequest()
    xhr.responseType = type
    xhr.payload = value
    xhr.open('GET', endpoint)
    xhr.send()
    return xhr
  }
  return { block1, session, transport, endpoint, accepted, secret, windowFixture, makeXhr }
}
