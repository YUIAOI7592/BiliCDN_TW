// Named scenarios create only their prerequisite state; resources belong to this test.

export async function createNativeTransportResources() {
  let nativeFetchCalls = 0
  let playurlFetchBody = JSON.stringify({ code: 0, data: { dash: { video: [], audio: [] } } })
  let playurlFetchOverride: Response | null = null
  const nativeFetchUrls: string[] = []
  const nativeFetchRedirects: RequestRedirect[] = []
  const nativeFetch = async (input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    nativeFetchCalls++
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    nativeFetchUrls.push(url)
    nativeFetchRedirects.push(
      input instanceof Request
        ? input.redirect
        : (String(_init?.redirect ?? 'follow') as RequestRedirect),
    )
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
    responseType: XMLHttpRequestResponseType = ''
    finalResponseUrl: string | null = null
    rawResponseText: string | null = null
    holdAtLoading = false
    timeout = 0
    withCredentials = false
    payload: unknown = { ok: true }
    nativeSends = 0
    get response(): unknown {
      return this.payload
    }
    get responseText(): string {
      return this.rawResponseText ?? JSON.stringify(this.payload)
    }
    open(method: string, url: string | URL): void {
      this.method = method
      this.url = String(url)
      this.responseURL = this.url
      this.readyState = 1
    }
    send(): void {
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
      this.dispatchEvent(new Event('abort'))
    }
    setRequestHeader(_name: string, _value: string): void {}
  }
  const fakeWindow = {
    fetch: nativeFetch,
    XMLHttpRequest: FakeXhr,
  }
  return {
    get nativeFetchCalls() {
      return nativeFetchCalls
    },
    get playurlFetchBody() {
      return playurlFetchBody
    },
    set playurlFetchBody(value: typeof playurlFetchBody) {
      playurlFetchBody = value
    },
    get playurlFetchOverride() {
      return playurlFetchOverride
    },
    set playurlFetchOverride(value: typeof playurlFetchOverride) {
      playurlFetchOverride = value
    },
    nativeFetchUrls,
    nativeFetchRedirects,
    FakeXhr,
    fakeWindow,
  }
}
