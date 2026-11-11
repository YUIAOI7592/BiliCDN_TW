import { SignedRouteVault } from '../../../src-v2/state/signed-route-vault.ts'
import { SessionStore } from '../../../src-v2/state/session-store.ts'
import { FakeStorage } from '../../support/storage.ts'

// Each caller owns its installed transport and globals; this helper has no external effects.
export function createTransportHookResources() {
  let nativeFetchCalls = 0
  const nativeFetch: typeof fetch = async () => {
    nativeFetchCalls++
    return new Response(null, { status: 206 })
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
  const fakeWindow = { fetch: nativeFetch, XMLHttpRequest: FakeXhr }
  return {
    fakeWindow,
    FakeXhr,
    get nativeFetchCalls() {
      return nativeFetchCalls
    },
  }
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
