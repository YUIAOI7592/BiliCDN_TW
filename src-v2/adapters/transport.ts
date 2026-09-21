import { isPlayurlApi } from '../domain/catalog.ts'
import { isHttpDnsUrl, parseMediaUrl } from '../domain/url-policy.ts'
import type { FailureKind, MediaKind, RouteType, TransportObservation } from '../domain/model.ts'
import type { RouteCoordinator, AppliedRouteDecision } from '../application/route-coordinator.ts'
import type { SessionStore } from '../state/session-store.ts'
import type { SettingsStore } from '../state/settings-store.ts'
import type { PlayurlAdapter } from './playurl.ts'

interface XhrMeta {
  method: string
  originalUrl: string
  targetUrl: string
  applied: AppliedRouteDecision | null
  startedAt: number
  responseAt: number
  bytes: number
  settled: boolean
  playurl: boolean
  transformedText: string | null
  transformedJson: unknown
}

const urlOf = (input: RequestInfo | URL): string => typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
const hostOf = (value: string): string => { try { return new URL(value, location.href).hostname.toLowerCase() } catch { return '' } }
const mediaKind = (applied: AppliedRouteDecision): MediaKind | null => applied.context?.kind ?? null

const copyResponseSurface = (target: Response, source: Response): Response => {
  for (const key of ['url', 'redirected', 'type'] as const) {
    try { Object.defineProperty(target, key, { configurable: true, enumerable: true, value: source[key] }) } catch { /* browser-owned */ }
  }
  return target
}

export class TransportAdapter {
  #installed = false
  #xhrMeta = new WeakMap<XMLHttpRequest, XhrMeta>()
  #restore: (() => void)[] = []
  #requestSerial = 0

  constructor(
    private readonly session: SessionStore,
    private readonly settings: SettingsStore,
    private readonly routes: RouteCoordinator,
    private readonly playurl: PlayurlAdapter,
    private readonly now: () => number,
  ) {}

  install(): void {
    if (this.#installed) return
    this.#installed = true
    this.#installFetch()
    this.#installXhr()
  }

  dispose(): void {
    for (const restore of this.#restore.splice(0).reverse()) {
      try { restore() } catch { /* fail-open */ }
    }
    this.#installed = false
  }

  #installFetch(): void {
    const original = unsafeWindow.fetch
    if (typeof original !== 'function') return
    const self = this
    const wrapped: typeof fetch = async function(this: Window & typeof globalThis, input, init) {
      if (self.settings.get().disabled) return await Reflect.apply(original, this, [input, init]) as Response
      const originalUrl = urlOf(input)
      if (self.settings.get().blockHttpDns && isHttpDnsUrl(originalUrl)) {
        return new Response(JSON.stringify({ code: -1, message: 'HTTPDNS blocked by BiliCDN v2' }), {
          status: 503, headers: { 'content-type': 'application/json; charset=utf-8' },
        })
      }
      if (isPlayurlApi(originalUrl)) {
        const response = await Reflect.apply(original, this, [input, init]) as Response
        let text: string
        try { text = await response.text() } catch { return response }
        try {
          const payload: unknown = JSON.parse(text)
          self.playurl.transform(payload, 'trusted-api')
          text = JSON.stringify(payload)
        } catch { /* preserve original body */ }
        return copyResponseSurface(new Response(text, { status: response.status, statusText: response.statusText, headers: response.headers }), response)
      }
      const parsed = parseMediaUrl(originalUrl)
      if (!parsed || !['GET', ''].includes(String(init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase())) {
        return await Reflect.apply(original, this, [input, init]) as Response
      }
      const applied = self.routes.apply(originalUrl)
      if (applied.decision.action === 'block' || !applied.url) throw new TypeError(`BiliCDN blocked media request: ${applied.decision.reason}`)
      const targetInput = applied.url === originalUrl ? input : input instanceof Request ? new Request(applied.url, input) : applied.url
      const startedAt = self.now()
      let response: Response
      try {
        response = await Reflect.apply(original, this, [targetInput, init]) as Response
      } catch (error) {
        const signal = init?.signal ?? (input instanceof Request ? input.signal : null)
        const aborted = signal?.aborted === true || (error instanceof DOMException && error.name === 'AbortError')
        void self.#observeFetch(applied, originalUrl, applied.url, null, startedAt, 0, 0, aborted ? 'abort' : 'failure', aborted ? undefined : 'network')
        throw error
      }
      const responseAt = self.now()
      if (!response.body) {
        const invalid = applied.decision.routeType === 'native-signed' && [403,451,959].includes(response.status)
        void self.#observeFetch(applied, originalUrl, applied.url, response, startedAt, responseAt, 0,
          response.ok ? 'success' : 'failure', invalid ? 'native-invalid' : response.status >= 500 ? 'http-5xx' : undefined)
        return response
      }
      const reader = response.body.getReader()
      let bytes = 0, settled = false
      const settle = (outcome: 'success' | 'abort' | 'failure', failure?: FailureKind): void => {
        if (settled) return
        settled = true
        void self.#observeFetch(applied, originalUrl, applied.url ?? originalUrl, response, startedAt, responseAt, bytes, outcome, failure)
      }
      const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const result = await reader.read()
            if (result.done) {
              const invalid = applied.decision.routeType === 'native-signed' && [403,451,959].includes(response.status)
              settle(response.ok ? 'success' : 'failure', invalid ? 'native-invalid' : response.status >= 500 ? 'http-5xx' : undefined)
              controller.close(); return
            }
            bytes += result.value.byteLength
            controller.enqueue(result.value)
          } catch (error) {
            settle('failure', 'body')
            controller.error(error)
          }
        },
        async cancel(reason) {
          settle('abort')
          await reader.cancel(reason)
        },
      })
      return copyResponseSurface(new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers }), response)
    }
    try {
      unsafeWindow.fetch = wrapped
      this.#restore.push(() => { if (unsafeWindow.fetch === wrapped) unsafeWindow.fetch = original })
    } catch { /* fail-open */ }
  }

  #installXhr(): void {
    const proto = unsafeWindow.XMLHttpRequest?.prototype
    if (!proto) return
    const originalOpen = proto.open, originalSend = proto.send, originalAbort = proto.abort
    const responseDescriptor = Object.getOwnPropertyDescriptor(proto, 'response')
    const responseTextDescriptor = Object.getOwnPropertyDescriptor(proto, 'responseText')
    const self = this

    const open: typeof XMLHttpRequest.prototype.open = function(this: XMLHttpRequest, method: string, url: string | URL,
      async = true, username?: string | null, password?: string | null): void {
      const originalUrl = String(url), playurl = isPlayurlApi(originalUrl)
      let applied: AppliedRouteDecision | null = null, targetUrl = originalUrl
      if (!self.settings.get().disabled && !playurl && parseMediaUrl(originalUrl)) {
        applied = self.routes.apply(originalUrl)
        if (applied.url) targetUrl = applied.url
      }
      self.#xhrMeta.set(this, { method: String(method).toUpperCase(), originalUrl, targetUrl, applied,
        startedAt: 0, responseAt: 0, bytes: 0, settled: false, playurl,
        transformedText: null, transformedJson: undefined })
      if (username !== undefined) Reflect.apply(originalOpen, this, [method, targetUrl, async, username, password])
      else Reflect.apply(originalOpen, this, [method, targetUrl, async])
    }

    const send: typeof XMLHttpRequest.prototype.send = function(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null): void {
      const meta = self.#xhrMeta.get(this)
      if (!meta || self.settings.get().disabled) { Reflect.apply(originalSend, this, [body ?? null]); return }
      if (self.settings.get().blockHttpDns && isHttpDnsUrl(meta.originalUrl)) {
        queueMicrotask(() => { this.dispatchEvent(new Event('error')); this.dispatchEvent(new Event('loadend')) })
        return
      }
      if (meta.applied?.decision.action === 'block' || (meta.applied && !meta.applied.url)) {
        queueMicrotask(() => { this.dispatchEvent(new Event('error')); this.dispatchEvent(new Event('loadend')) })
        return
      }
      meta.startedAt = self.now()
      const noteHeaders = (): void => { if (!meta.responseAt && this.readyState >= 2) meta.responseAt = self.now() }
      const progress = (event: ProgressEvent): void => { noteHeaders(); meta.bytes = Math.max(meta.bytes, Number(event.loaded) || 0) }
      const settle = (outcome: 'success' | 'abort' | 'failure', failure?: FailureKind): void => {
        if (meta.settled) return
        meta.settled = true
        if (!meta.applied) return
        const finalUrl = (() => { try { return this.responseURL || meta.targetUrl } catch { return meta.targetUrl } })()
        void self.routes.observe(self.#observation(meta.applied, meta.originalUrl, meta.targetUrl, finalUrl,
          Number(this.status) || 0, meta.bytes, meta.startedAt, meta.responseAt, outcome, failure))
      }
      this.addEventListener('readystatechange', noteHeaders)
      this.addEventListener('progress', progress)
      this.addEventListener('load', () => {
        const invalid = meta.applied?.decision.routeType === 'native-signed' && [403,451,959].includes(this.status)
        settle(this.status >= 200 && this.status < 400 ? 'success' : 'failure', invalid ? 'native-invalid' : this.status >= 500 ? 'http-5xx' : undefined)
      }, { once: true })
      this.addEventListener('error', () => settle('failure', 'network'), { once: true })
      this.addEventListener('timeout', () => settle('failure', 'timeout'), { once: true })
      this.addEventListener('abort', () => settle('abort'), { once: true })
      Reflect.apply(originalSend, this, [body ?? null])
    }

    const abort: typeof XMLHttpRequest.prototype.abort = function(this: XMLHttpRequest): void { Reflect.apply(originalAbort, this, []) }
    try {
      proto.open = open; proto.send = send; proto.abort = abort
      if (responseDescriptor?.get && responseDescriptor.configurable) {
        Object.defineProperty(proto, 'response', { ...responseDescriptor, get(this: XMLHttpRequest) {
          const raw: unknown = responseDescriptor.get?.call(this), meta = self.#xhrMeta.get(this)
          if (!meta?.playurl || self.settings.get().disabled || this.readyState !== 4) return raw
          if (this.responseType === 'json' && raw && typeof raw === 'object') {
            if (meta.transformedJson === undefined) { self.playurl.transform(raw, 'trusted-api'); meta.transformedJson = raw }
            return meta.transformedJson
          }
          return raw
        } })
      }
      if (responseTextDescriptor?.get && responseTextDescriptor.configurable) {
        Object.defineProperty(proto, 'responseText', { ...responseTextDescriptor, get(this: XMLHttpRequest) {
          const raw = String(responseTextDescriptor.get?.call(this) ?? ''), meta = self.#xhrMeta.get(this)
          if (!meta?.playurl || self.settings.get().disabled || this.readyState !== 4) return raw
          if (meta.transformedText !== null) return meta.transformedText
          try { const payload: unknown = JSON.parse(raw); self.playurl.transform(payload, 'trusted-api'); meta.transformedText = JSON.stringify(payload) }
          catch { meta.transformedText = raw }
          return meta.transformedText
        } })
      }
      this.#restore.push(() => {
        if (proto.open === open) proto.open = originalOpen
        if (proto.send === send) proto.send = originalSend
        if (proto.abort === abort) proto.abort = originalAbort
        if (responseDescriptor) Object.defineProperty(proto, 'response', responseDescriptor)
        if (responseTextDescriptor) Object.defineProperty(proto, 'responseText', responseTextDescriptor)
      })
    } catch { /* fail-open */ }
  }

  async #observeFetch(applied: AppliedRouteDecision, originalUrl: string, targetUrl: string, response: Response | null,
    startedAt: number, responseAt: number, bytes: number, outcome: 'success' | 'abort' | 'failure', failureKind?: FailureKind): Promise<void> {
    const finalUrl = response?.url || targetUrl
    await this.routes.observe(this.#observation(applied, originalUrl, targetUrl, finalUrl, response?.status ?? 0,
      bytes, startedAt, responseAt, outcome, failureKind))
  }

  #observation(applied: AppliedRouteDecision, originalUrl: string, targetUrl: string, finalUrl: string, status: number,
    bytes: number, startedAt: number, responseAt: number, outcome: 'success' | 'abort' | 'failure', failureKind?: FailureKind): TransportObservation {
    const state = this.session.get(), completedAt = this.now(), kind = mediaKind(applied)
    const routeType: RouteType = applied.decision.routeType
    return {
      generation: state.generation, epoch: state.epoch, decisionId: applied.decision.id,
      representation: applied.context?.representation ?? null, kind, routeType,
      originalHost: applied.sourceHost ?? hostOf(originalUrl), targetHost: hostOf(targetUrl), finalHost: hostOf(finalUrl) || null,
      streamKey: applied.streamKey,
      status, bytes, ttfbMs: responseAt > 0 ? responseAt - startedAt : null,
      elapsedMs: Math.max(1, completedAt - startedAt), completedAt, outcome,
      ...(failureKind ? { failureKind } : {}),
    }
  }
}
