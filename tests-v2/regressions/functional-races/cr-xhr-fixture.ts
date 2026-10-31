import { CatalogSettingsStore } from '../../support/catalog-settings.ts'
import { type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { TransportAdapter } from '../../../src-v2/adapters/transport.ts'
import { PlayurlAdapter } from '../../../src-v2/adapters/playurl.ts'
import { PlayurlController } from '../../../src-v2/application/playurl-controller.ts'
import { RouteCoordinator } from '../../../src-v2/application/route-coordinator.ts'
import { SessionStore } from '../../../src-v2/state/session-store.ts'
import { RestrictionStore } from '../../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../../src-v2/state/evidence-store.ts'
import { SignedRouteVault } from '../../../src-v2/state/signed-route-vault.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { testScope } from '../../support/scope.ts'
import { FakeStorage } from '../../support/storage.ts'
import { FakeClock } from '../../support/clock.ts'
import { installProgressEvent } from '../../support/progress-event.ts'

export const mediaUrl =
  'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/01/02/1000/1000-1-30080.m4s?review=synthetic'
export const ordinaryUrl = 'https://example.invalid/review'

export async function fixture(
  t: TestContext,
  response?: () => Promise<Response>,
  baseUrl = 'https://www.bilibili.com/',
) {
  const scope = testScope(t),
    clock = scope.own(new FakeClock())
  installProgressEvent(scope)
  // The external XHR boundary converts header ByteStrings just as Web IDL does.
  // It never opens a network connection. Product hooks/controllers/stores are real.
  class NativeXhr extends EventTarget {
    #state = 0
    #sent = false
    get readyState() {
      return this.#state
    }
    status = 0
    responseURL = ''
    responseType: XMLHttpRequestResponseType = ''
    timeout = 0
    withCredentials = false
    nativeSends = 0
    nativeOpens = 0
    url = ''
    headers: [string, string][] = []
    open(
      method: string,
      url: string | URL,
      async?: boolean,
      _user?: string | null,
      _password?: string | null,
    ) {
      const convertedMethod = `${method}`,
        convertedUrl = `${url}`
      if (!convertedMethod) throw new DOMException('invalid method', 'SyntaxError')
      const asynchronous = arguments.length < 3 ? true : Boolean(async)
      if (!asynchronous && (this.timeout !== 0 || this.responseType !== ''))
        throw new DOMException('sync options', 'InvalidAccessError')
      const changed = this.#state !== 1
      this.#state = 1
      this.#sent = false
      this.url = new URL(convertedUrl, baseUrl).href
      this.headers = []
      this.nativeOpens++
      if (changed) this.dispatchEvent(new Event('readystatechange'))
    }
    send(body?: unknown) {
      // Plain objects select USVString in XMLHttpRequestBodyInit. Conversion is
      // before the native send algorithm, so a throwing coercion leaves OPENED.
      if (
        body !== null &&
        body !== undefined &&
        !(body instanceof Blob) &&
        !(body instanceof ArrayBuffer) &&
        !ArrayBuffer.isView(body)
      )
        `${body}`.toWellFormed()
      if (this.#state !== 1 || this.#sent) throw new DOMException('send state', 'InvalidStateError')
      this.#sent = true
      this.nativeSends++
    }
    abort() {
      if (this.#sent || this.#state === 4) {
        this.#state = 0
        this.#sent = false
      }
    }
    setRequestHeader(name: string, value: string) {
      const convertedName = `${name}`,
        convertedValue = `${value}`
      if (/[^\x00-\xff]/.test(convertedName + convertedValue)) throw new TypeError('ByteString')
      if (this.#state !== 1) throw new DOMException('header state', 'InvalidStateError')
      this.headers.push([convertedName, convertedValue.trim()])
    }
    get response(): unknown {
      return ''
    }
    get responseText(): string {
      return ''
    }
  }
  const storage = new FakeStorage(),
    settings = scope.own(new CatalogSettingsStore(storage, clock.now))
  const restrictions = scope.own(new RestrictionStore(storage, clock.now)),
    evidence = scope.own(new EvidenceStore(storage, clock.now))
  const session = new SessionStore(),
    state = session.beginGeneration(false),
    vault = new SignedRouteVault()
  vault.reset(state.generation, state.epoch)
  const ids = createRuntimeIds((bytes) => bytes.fill(12))
  const routes = new RouteCoordinator(clock, session, settings, restrictions, evidence, vault, ids)
  const playurl = new PlayurlAdapter(new PlayurlController(session, vault, routes))
  const fakeWindow = {
    XMLHttpRequest: NativeXhr,
    fetch: (async (_input: RequestInfo | URL) =>
      response ? await response() : new Response(null)) as typeof fetch,
  }
  scope.defineGlobal('unsafeWindow', { configurable: true, value: fakeWindow })
  scope.defineGlobal('location', {
    configurable: true,
    value: new URL('https://www.bilibili.com/video/BVsynthetic'),
  })
  scope.defineGlobal('document', { configurable: true, value: { baseURI: baseUrl } })
  const result = playurl.transform(
    {
      code: 0,
      data: {
        dash: {
          video: [
            {
              id: 80,
              codecid: 7,
              height: 1080,
              bandwidth: 1_000_000,
              base_url: mediaUrl,
              backup_url: [],
            },
          ],
          audio: [],
        },
      },
    },
    'trusted-api',
    'review-initial',
  )
  assert.equal(result.accepted, true)
  const transport = scope.own(
    new TransportAdapter(
      session,
      settings,
      routes,
      playurl,
      {
        willGateStartup: () => false,
        prepareStartup: async () => undefined,
        noteUnpreflighted: () => undefined,
      },
      clock.now,
      ids,
    ),
  )
  const nativeSend = NativeXhr.prototype.send
  transport.install()
  assert.equal(transport.snapshot().hookState, 'installed')
  const createXhr = () => {
    const xhr = new NativeXhr()
    scope.defer(() => xhr.abort())
    return xhr
  }
  return {
    scope,
    clock,
    settings,
    restrictions,
    evidence,
    routes,
    transport,
    fakeWindow,
    createXhr,
    nativeSend,
  }
}
