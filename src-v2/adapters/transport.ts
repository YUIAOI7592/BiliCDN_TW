import { isPlayurlApi } from '../domain/catalog.ts'
import { isHttpDnsUrl, parseMediaUrl } from '../domain/url-policy.ts'
import { requestId, type FailureKind, type RequestContext, type RouteType, type TransportObservation, type GenerationId, type EpochId } from '../domain/model.ts'
import type { RouteCoordinator, AppliedRouteDecision } from '../application/route-coordinator.ts'
import type { MeasurementController } from '../application/measurement-controller.ts'
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
  request: RequestContext | null
  generation: GenerationId
  epoch: EpochId
  responseKey: string
  cleanup: () => void
  async: boolean
  headers: [string, string][]
  username?: string | null
  password?: string | null
  pendingSend: boolean
  abortedBeforeSend: boolean
}

const urlOf = (input: RequestInfo | URL): string => typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
const hostOf = (value: string): string => { try { return new URL(value, location.href).hostname.toLowerCase() } catch { return '' } }
const isMedia = (url: string): boolean => { const parsed = parseMediaUrl(url); return !!parsed && parsed.kind !== 'unknown' }

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
    private readonly measurement: MeasurementController,
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
        const generation = self.session.get().generation, responseKey = `api-fetch-${++self.#requestSerial}`
        const response = await Reflect.apply(original, this, [input, init]) as Response
        let text: string
        try { text = await response.text() } catch { return response }
        try {
          const payload: unknown = JSON.parse(text)
          if (self.session.isGeneration(generation) && !self.settings.get().disabled) self.playurl.transform(payload, 'trusted-api', responseKey)
          text = JSON.stringify(payload)
        } catch { /* preserve original body */ }
        return copyResponseSurface(new Response(text, { status: response.status, statusText: response.statusText, headers: response.headers }), response)
      }
      const parsed = parseMediaUrl(originalUrl)
      if (!parsed || parsed.kind === 'unknown' || !['GET', ''].includes(String(init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase())) {
        return await Reflect.apply(original, this, [input, init]) as Response
      }
      const generation = self.session.get().generation
      if (self.measurement.willGateStartup(originalUrl)) {
        await self.measurement.prepareStartup(originalUrl, init?.signal ?? (input instanceof Request ? input.signal : null))
      } else self.measurement.noteUnpreflighted('no-safe-startup-candidate')
      if (self.settings.get().disabled || !self.session.isGeneration(generation)) {
        return await Reflect.apply(original, this, [input, init]) as Response
      }
      const applied = self.routes.apply(originalUrl)
      if (applied.decision.action === 'block' || !applied.url) throw new TypeError(`BiliCDN blocked media request: ${applied.decision.reason}`)
      const targetInput = applied.url === originalUrl ? input : input instanceof Request ? new Request(applied.url, input) : applied.url
      const startedAt = self.now()
      const request = self.#request(applied, originalUrl, applied.url, startedAt)
      self.routes.requestStarted(request)
      let response: Response
      try {
        response = await Reflect.apply(original, this, [targetInput, init]) as Response
      } catch (error) {
        const signal = init?.signal ?? (input instanceof Request ? input.signal : null)
        const aborted = signal?.aborted === true || (error instanceof DOMException && error.name === 'AbortError')
        void self.#observeFetch(request, applied, originalUrl, applied.url, null, startedAt, 0, 0, aborted ? 'abort' : 'failure', aborted ? undefined : 'network')
        throw error
      }
      const responseAt = self.now()
      if (!response.body) {
        const invalid = applied.decision.routeType === 'native-signed' && [403,451,959].includes(response.status)
        void self.#observeFetch(request, applied, originalUrl, applied.url, response, startedAt, responseAt, 0,
          response.ok ? 'success' : 'failure', invalid ? 'native-invalid' : response.status >= 500 ? 'http-5xx' : undefined)
        return response
      }
      const reader = response.body.getReader()
      let bytes = 0, settled = false
      const settle = (outcome: 'success' | 'abort' | 'failure', failure?: FailureKind): void => {
        if (settled) return
        settled = true
        void self.#observeFetch(request, applied, originalUrl, applied.url ?? originalUrl, response, startedAt, responseAt, bytes, outcome, failure)
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
            const signal = init?.signal ?? (input instanceof Request ? input.signal : null)
            if (signal?.aborted) settle('abort')
            else settle('failure', 'body')
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
    const originalOpen = proto.open, originalSend = proto.send, originalAbort = proto.abort, originalSetHeader = proto.setRequestHeader
    const responseDescriptor = Object.getOwnPropertyDescriptor(proto, 'response')
    const responseTextDescriptor = Object.getOwnPropertyDescriptor(proto, 'responseText')
    const self = this

    const open: typeof XMLHttpRequest.prototype.open = function(this: XMLHttpRequest, method: string, url: string | URL,
      async: boolean = true, username?: string | null, password?: string | null): void {
      const originalUrl = String(url), playurl = isPlayurlApi(originalUrl)
      const previous = self.#xhrMeta.get(this)
      if (previous) { previous.abortedBeforeSend = true; previous.cleanup() }
      let applied: AppliedRouteDecision | null = null, targetUrl = originalUrl
      if (!self.settings.get().disabled && !playurl && isMedia(originalUrl) && method.toUpperCase() === 'GET') {
        applied = self.routes.apply(originalUrl)
        if (applied.url) targetUrl = applied.url
      }
      self.#xhrMeta.set(this, { method: String(method).toUpperCase(), originalUrl, targetUrl, applied,
        startedAt: 0, responseAt: 0, bytes: 0, settled: false, playurl,
        transformedText: null, transformedJson: undefined, request: null,
        generation: self.session.get().generation, epoch: self.session.get().epoch,
        responseKey: `api-xhr-${++self.#requestSerial}`, cleanup: () => undefined, async, headers: [],
        pendingSend: false, abortedBeforeSend: false,
        ...(username !== undefined ? { username } : {}), ...(password !== undefined ? { password } : {}) })
      if (username !== undefined) Reflect.apply(originalOpen, this, [method, targetUrl, async, username, password])
      else Reflect.apply(originalOpen, this, [method, targetUrl, async])
    }

    const send: typeof XMLHttpRequest.prototype.send = function(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null): void {
      const meta = self.#xhrMeta.get(this)
      if (!meta) { Reflect.apply(originalSend, this, [body ?? null]); return }
      if (meta.pendingSend) throw new DOMException('send already called', 'InvalidStateError')
      const perform = (): void => {
      if (meta.abortedBeforeSend || self.#xhrMeta.get(this) !== meta) return
      meta.pendingSend = false
      const reopen = (url: string): void => {
        const responseType = this.responseType, timeout = this.timeout, credentials = this.withCredentials
        Reflect.apply(originalOpen, this, [meta.method, url, meta.async, meta.username ?? null, meta.password ?? null])
        this.responseType = responseType; this.timeout = timeout; this.withCredentials = credentials
        for (const [key, value] of meta.headers) Reflect.apply(originalSetHeader, this, [key, value])
      }
      if (self.settings.get().disabled || !self.session.isGeneration(meta.generation)) {
        if (meta.targetUrl !== meta.originalUrl) reopen(meta.originalUrl)
        Reflect.apply(originalSend, this, [body ?? null]); return
      }
      if (!meta.playurl && meta.method === 'GET' && isMedia(meta.originalUrl)) {
        const next = self.routes.apply(meta.originalUrl)
        if (next.url && next.url !== meta.targetUrl) {
          reopen(next.url)
          meta.targetUrl = next.url
        }
        meta.applied = next
      }
      if (self.settings.get().blockHttpDns && isHttpDnsUrl(meta.originalUrl)) {
        queueMicrotask(() => { this.dispatchEvent(new Event('error')); this.dispatchEvent(new Event('loadend')) })
        return
      }
      if (meta.applied?.decision.action === 'block' || (meta.applied && !meta.applied.url)) {
        queueMicrotask(() => { this.dispatchEvent(new Event('error')); this.dispatchEvent(new Event('loadend')) })
        return
      }
      meta.startedAt = self.now()
      if (meta.applied) { meta.request = self.#request(meta.applied, meta.originalUrl, meta.targetUrl, meta.startedAt); self.routes.requestStarted(meta.request) }
      const noteHeaders = (): void => { if (!meta.responseAt && this.readyState >= 2) meta.responseAt = self.now() }
      const progress = (event: ProgressEvent): void => { noteHeaders(); meta.bytes = Math.max(meta.bytes, Number(event.loaded) || 0) }
      const settle = (outcome: 'success' | 'abort' | 'failure', failure?: FailureKind): void => {
        if (meta.settled) return
        meta.settled = true
        meta.cleanup()
        if (!meta.applied || !meta.request) return
        const finalUrl = (() => { try { return this.responseURL || '' } catch { return '' } })()
        void self.routes.observe(self.#observation(meta.request, meta.applied, meta.originalUrl, meta.targetUrl, finalUrl,
          Number(this.status) || 0, meta.bytes, meta.startedAt, meta.responseAt, outcome, failure))
      }
      const load = (): void => {
        const invalid = meta.applied?.decision.routeType === 'native-signed' && [403,451,959].includes(this.status)
        settle(this.status >= 200 && this.status < 400 ? 'success' : 'failure', invalid ? 'native-invalid' : this.status >= 500 ? 'http-5xx' : undefined)
      }
      const error = (): void => settle('failure', 'network'), timeout = (): void => settle('failure', 'timeout'), abort = (): void => settle('abort')
      this.addEventListener('readystatechange', noteHeaders); this.addEventListener('progress', progress)
      this.addEventListener('load', load); this.addEventListener('error', error); this.addEventListener('timeout', timeout); this.addEventListener('abort', abort)
      meta.cleanup = () => {
        this.removeEventListener('readystatechange', noteHeaders); this.removeEventListener('progress', progress)
        this.removeEventListener('load', load); this.removeEventListener('error', error); this.removeEventListener('timeout', timeout); this.removeEventListener('abort', abort)
      }
      Reflect.apply(originalSend, this, [body ?? null])
      }
      if (meta.async && !meta.playurl && meta.method === 'GET' && isMedia(meta.originalUrl)
        && !self.settings.get().disabled && this.timeout === 0
        && self.measurement.willGateStartup(meta.originalUrl)) {
        meta.pendingSend = true
        void self.measurement.prepareStartup(meta.originalUrl).then(perform, perform)
        return
      }
      if (!meta.playurl && isMedia(meta.originalUrl)) {
        if (!meta.async) self.measurement.noteUnpreflighted('synchronous-xhr')
        else if (this.timeout > 0) self.measurement.noteUnpreflighted('xhr-explicit-timeout')
        else self.measurement.noteUnpreflighted('no-safe-startup-candidate')
      }
      perform()
    }

    const abort: typeof XMLHttpRequest.prototype.abort = function(this: XMLHttpRequest): void {
      const meta = self.#xhrMeta.get(this)
      if (meta?.pendingSend) { meta.abortedBeforeSend = true; meta.pendingSend = false }
      Reflect.apply(originalAbort, this, [])
    }
    const setHeader: typeof XMLHttpRequest.prototype.setRequestHeader = function(this: XMLHttpRequest, name: string, value: string): void {
      if (self.#xhrMeta.get(this)?.pendingSend) throw new DOMException('send already called', 'InvalidStateError')
      Reflect.apply(originalSetHeader, this, [name, value])
      self.#xhrMeta.get(this)?.headers.push([name, value])
    }
    try {
      proto.open = open; proto.send = send; proto.abort = abort; proto.setRequestHeader = setHeader
      if (responseDescriptor?.get && responseDescriptor.configurable) {
        Object.defineProperty(proto, 'response', { ...responseDescriptor, get(this: XMLHttpRequest) {
          const raw: unknown = responseDescriptor.get?.call(this), meta = self.#xhrMeta.get(this)
          if (!meta?.playurl || self.settings.get().disabled || !self.session.isGeneration(meta.generation) || this.readyState !== 4) return raw
          if (this.responseType === 'json' && raw && typeof raw === 'object') {
            if (meta.transformedJson === undefined) { self.playurl.transform(raw, 'trusted-api', meta.responseKey); meta.transformedJson = raw }
            return meta.transformedJson
          }
          if ((this.responseType === '' || this.responseType === 'text') && typeof raw === 'string') {
            if (meta.transformedText === null) {
              try { const payload: unknown = JSON.parse(raw); self.playurl.transform(payload, 'trusted-api', meta.responseKey); meta.transformedText = JSON.stringify(payload) }
              catch { meta.transformedText = raw }
            }
            return meta.transformedText
          }
          return raw
        } })
      }
      if (responseTextDescriptor?.get && responseTextDescriptor.configurable) {
        Object.defineProperty(proto, 'responseText', { ...responseTextDescriptor, get(this: XMLHttpRequest) {
          const raw = String(responseTextDescriptor.get?.call(this) ?? ''), meta = self.#xhrMeta.get(this)
          if (!meta?.playurl || self.settings.get().disabled || !self.session.isGeneration(meta.generation) || this.readyState !== 4) return raw
          if (meta.transformedText !== null) return meta.transformedText
          try { const payload: unknown = JSON.parse(raw); self.playurl.transform(payload, 'trusted-api', meta.responseKey); meta.transformedText = JSON.stringify(payload) }
          catch { meta.transformedText = raw }
          return meta.transformedText
        } })
      }
      this.#restore.push(() => {
        if (proto.open === open) proto.open = originalOpen
        if (proto.send === send) proto.send = originalSend
        if (proto.abort === abort) proto.abort = originalAbort
        if (proto.setRequestHeader === setHeader) proto.setRequestHeader = originalSetHeader
        if (responseDescriptor) Object.defineProperty(proto, 'response', responseDescriptor)
        if (responseTextDescriptor) Object.defineProperty(proto, 'responseText', responseTextDescriptor)
      })
    } catch { /* fail-open */ }
  }

  #request(applied: AppliedRouteDecision, originalUrl: string, targetUrl: string, startedAt: number): RequestContext {
    const state = this.session.get(), matched = applied.attributionStatus ?? (applied.context ? 'matched' : 'waiting-data')
    return Object.freeze({ requestId: requestId(`request-${++this.#requestSerial}`), generation: state.generation, epoch: state.epoch,
      decisionId: applied.decision.id, representation: applied.context?.representation ?? null, kind: applied.context?.kind ?? null,
      attributionStatus: matched, attributionSource: applied.attributionSource ?? (applied.context ? 'exact' : 'none'),
      decisionStage: 'request', routeType: applied.decision.routeType, originalHost: hostOf(originalUrl), targetHost: hostOf(targetUrl),
      sourceHost: applied.sourceHost, playurlHostChanged: applied.playurlHostChanged ?? false,
      urlChanged: originalUrl !== targetUrl, hostChanged: hostOf(originalUrl) !== hostOf(targetUrl), startedAt })
  }

  async #observeFetch(request: RequestContext, applied: AppliedRouteDecision, originalUrl: string, targetUrl: string, response: Response | null,
    startedAt: number, responseAt: number, bytes: number, outcome: 'success' | 'abort' | 'failure', failureKind?: FailureKind): Promise<void> {
    const finalUrl = response?.url || ''
    await this.routes.observe(this.#observation(request, applied, originalUrl, targetUrl, finalUrl, response?.status ?? 0,
      bytes, startedAt, responseAt, outcome, failureKind))
  }

  #observation(request: RequestContext, applied: AppliedRouteDecision, originalUrl: string, targetUrl: string, finalUrl: string, status: number,
    bytes: number, startedAt: number, responseAt: number, outcome: 'success' | 'abort' | 'failure', failureKind?: FailureKind): TransportObservation {
    const completedAt = this.now(), kind = request.kind
    const routeType: RouteType = applied.decision.routeType
    return {
      request, generation: request.generation, epoch: request.epoch, decisionId: request.decisionId,
      representation: request.representation, kind, routeType,
      originalHost: request.originalHost, targetHost: request.targetHost, finalHost: finalUrl ? hostOf(finalUrl) || null : null,
      streamKey: applied.streamKey,
      status, bytes, ttfbMs: responseAt > 0 ? responseAt - startedAt : null,
      elapsedMs: Math.max(1, completedAt - startedAt), completedAt, outcome,
      ...(failureKind ? { failureKind } : {}),
    }
  }
}
