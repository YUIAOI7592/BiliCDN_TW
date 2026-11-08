import { requestDispatch } from '../../support/request-dispatch.ts'
import { playurlResult } from '../../support/playurl.ts'
import { decisionId } from '../../../src-v2/domain/model.ts'
import { parseMediaUrl } from '../../../src-v2/domain/url-policy.ts'
import { SignedRouteVault } from '../../../src-v2/state/signed-route-vault.ts'
import { SessionStore } from '../../../src-v2/state/session-store.ts'
import { type AppliedRouteDecision } from '../../../src-v2/application/routing/route-contracts.ts'
import { type TransportObservation } from '../../../src-v2/domain/transport-model.ts'
import { FakeStorage } from '../../support/storage.ts'

// Named scenarios create only their prerequisite state; resources belong to this test.

export async function createTransportHookResources() {
  const passDecision: AppliedRouteDecision = {
    decision: {
      action: 'pass',
      target: { type: 'request' },
      id: decisionId('runtime-pass'),
      reason: 'test',
      routeType: 'root-original',
      host: 'upos-sz-mirrorali.bilivideo.com',
      ranking: [],
    },
    url: 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/runtime.m4s',
    context: null,
    streamKey: 'runtime',
    sourceHost: 'upos-sz-mirrorali.bilivideo.com',
  }
  const observations: TransportObservation[] = []
  const routeStub = {
    prepareRequest: requestDispatch(),
    policyRevision(): number {
      return 0
    },
    requestStarted(): void {},
    isCatalogOnly(): boolean {
      return false
    },
    isBilibiliMedia(url: string): boolean {
      return /\.bilivideo\.com\/|\.akamaized\.net\//.test(url)
    },
    recognizesMedia(url: string): boolean {
      return parseMediaUrl(url)?.kind !== 'unknown'
    },
    inspectOriginal(url: string): AppliedRouteDecision {
      return this.apply(url)
    },
    apply(url: string): AppliedRouteDecision {
      return { ...passDecision, url }
    },
    async observe(observation: TransportObservation): Promise<void> {
      observations.push(observation)
    },
  }
  let transformed = 0
  const playurlStub = {
    transform() {
      transformed++
      return playurlResult(true)
    },
  }
  let disabled = false
  let blockHttpDns = true
  const settingsStub = {
    get: () => ({ disabled: disabled, blockHttpDns: blockHttpDns, considerNativeSources: true }),
  }
  let nativeFetchCalls = 0
  let playurlFetchBody = JSON.stringify({ code: 0, data: { dash: { video: [], audio: [] } } })
  let playurlFetchOverride: Response | null = null
  const nativeFetchUrls: string[] = []
  const nativeFetchMethods: string[] = []
  const nativeFetchRedirects: RequestRedirect[] = []
  const nativeFetchHeaders: (string | null)[] = []
  const nativeFetch = async (input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    nativeFetchCalls++
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    nativeFetchUrls.push(url)
    nativeFetchMethods.push(
      input instanceof Request ? input.method : String(_init?.method ?? 'GET'),
    )
    nativeFetchRedirects.push(
      input instanceof Request
        ? input.redirect
        : (String(_init?.redirect ?? 'follow') as RequestRedirect),
    )
    nativeFetchHeaders.push(input instanceof Request ? input.headers.get('x-bilicdn-test') : null)
    if (url.includes('/stream-body.m4s') && input instanceof Request) void (await input.text())
    if (url.includes('/player/wbi/playurl'))
      return playurlFetchOverride ?? new Response(playurlFetchBody, { status: 200 })
    let emitted = false
    return new Response(
      new ReadableStream<Uint8Array>({
        pull(controller) {
          if (!emitted) {
            emitted = true
            controller.enqueue(new Uint8Array(70 * 1024))
          }
        },
        cancel(_reason) {},
      }),
      { status: 206, headers: { 'content-type': 'video/mp4' } },
    )
  }
  class FakeXhr extends EventTarget {
    #state = 0
    get readyState() {
      return this.#state
    }
    set readyState(value: number) {
      this.#state = value
    }
    method = ''
    url = ''
    status = 200
    responseURL = ''
    sync = false
    sent = false
    #responseType: XMLHttpRequestResponseType = ''
    #timeout = 0
    get responseType(): XMLHttpRequestResponseType {
      return this.#responseType
    }
    set responseType(value: XMLHttpRequestResponseType) {
      if (this.sync) throw new DOMException('synchronous XHR', 'InvalidAccessError')
      this.#responseType = value
    }
    get timeout(): number {
      return this.#timeout
    }
    set timeout(value: number) {
      if (this.sync) throw new DOMException('synchronous XHR', 'InvalidAccessError')
      this.#timeout = value
    }
    finalResponseUrl: string | null = null
    rawResponseText: string | null = null
    holdAtLoading = false
    withCredentials = false
    payload: unknown = { ok: true }
    nativeSends = 0
    get response(): unknown {
      return this.payload
    }
    get responseText(): string {
      return this.rawResponseText ?? JSON.stringify(this.payload)
    }
    open(method: string, url: string | URL, async = true): void {
      this.method = method
      this.url = String(url)
      this.responseURL = this.url
      this.readyState = 1
      this.sync = !async
      this.sent = false
    }
    send(): void {
      if (this.readyState !== 1 || this.sent)
        throw new DOMException('send invalid state', 'InvalidStateError')
      this.sent = true
      this.nativeSends++
      if (this.finalResponseUrl) this.responseURL = this.finalResponseUrl
      this.readyState = this.holdAtLoading ? 3 : 4
      this.dispatchEvent(new Event('readystatechange'))
      if (!this.holdAtLoading) {
        this.dispatchEvent(new Event('load'))
        this.dispatchEvent(new Event('loadend'))
      }
    }
    abort(): void {
      if ((this.readyState === 1 && this.sent) || this.readyState === 2 || this.readyState === 3) {
        this.readyState = 4
        this.sent = false
        this.status = 0
        this.dispatchEvent(new Event('readystatechange'))
        this.dispatchEvent(new Event('abort'))
        this.dispatchEvent(new Event('loadend'))
      }
      if (this.readyState === 4) this.readyState = 0
    }
    setRequestHeader(_name: string, _value: string): void {}
  }
  const originalWorker = function WorkerIdentity() {
    return undefined
  }
  const fakeWindow = {
    fetch: nativeFetch,
    XMLHttpRequest: FakeXhr,
    Worker: originalWorker,
    navigator: globalThis.navigator,
  }
  return {
    passDecision,
    routeStub,
    playurlStub,
    get disabled(): boolean {
      return disabled
    },
    set disabled(value: boolean) {
      disabled = value
    },
    settingsStub,
    get nativeFetchCalls() {
      return nativeFetchCalls
    },
    set nativeFetchCalls(value: typeof nativeFetchCalls) {
      nativeFetchCalls = value
    },
    nativeFetch,
    FakeXhr,
    fakeWindow,
  }
}

export function createNativeControlSources() {
  const nativeControlUrl =
    'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/control/clip.m4s?signature=private'
  const nativeControlBackup =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/control/clip.m4s?signature=other'
  const controlItem = {
    id: 240,
    codecid: 13,
    height: 1080,
    bandwidth: 1_000_000,
    base_url: nativeControlUrl,
    backup_url: [nativeControlBackup],
  }
  return { nativeControlUrl, nativeControlBackup, controlItem }
}

export function createOpaqueControlSources() {
  const opaquePrimary =
    'https://upos-hz-mirrorakam.akamaized.net/opaque/video-chunk?signature=private'
  const opaqueBackup =
    'https://upos-sz-mirrorali.bilivideo.com/opaque/video-chunk?signature=private'
  const opaqueItem = {
    id: 81,
    codecid: 13,
    height: 1080,
    bandwidth: 1_000_000,
    base_url: opaquePrimary,
    backup_url: [opaqueBackup],
  }
  return { opaquePrimary, opaqueBackup, opaqueItem }
}

export function createOutputStores() {
  const outputStorage = new FakeStorage()
  const outputSession = new SessionStore()
  const outputState = outputSession.beginGeneration(false)
  const outputVault = new SignedRouteVault()
  return { outputStorage, outputSession, outputState, outputVault }
}
