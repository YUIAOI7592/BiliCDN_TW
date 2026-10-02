import { isPlayurlApi } from '../domain/catalog.ts'
import { isHttpDnsUrl } from '../domain/url-policy.ts'
import type { FailureKind, RequestContext, GenerationId, EpochId } from '../domain/model.ts'
import type { AppliedRouteDecision } from '../application/route-coordinator.ts'
import { type TransportContext, type HookInstallation, sameUrl, blockedPlayurl, blockedPlayurlText } from './transport-context.ts'
interface XhrMeta {
  method: string
  originalUrl: string
  managedBilibili: boolean
  targetUrl: string
  applied: AppliedRouteDecision | null
  startedAt: number
  responseAt: number
  bytes: number
  settled: boolean
  playurl: boolean
  transformedText: string | null
  transformedJson: unknown
  catalogOnlyAtTransform: boolean | null
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


export class XhrHookAdapter {
  #xhrMeta = new WeakMap<XMLHttpRequest, XhrMeta>()
  constructor(private readonly context: TransportContext) {}
  install(): HookInstallation | null {
    const proto = unsafeWindow.XMLHttpRequest?.prototype
    if (!proto) return null
    const originalOpen = proto.open, originalSend = proto.send, originalAbort = proto.abort, originalSetHeader = proto.setRequestHeader
    const responseDescriptor = Object.getOwnPropertyDescriptor(proto, 'response')
    const responseTextDescriptor = Object.getOwnPropertyDescriptor(proto, 'responseText')
    const self = this.context, xhrMeta = this.#xhrMeta

    const open: typeof XMLHttpRequest.prototype.open = function(this: XMLHttpRequest, method: string, url: string | URL,
      async: boolean = true, username?: string | null, password?: string | null): void {
      self.count('enteredXhr')
      const originalUrl = String(url), playurl = isPlayurlApi(originalUrl, location.href)
      const previous = xhrMeta.get(this)
      if (previous) { previous.abortedBeforeSend = true; previous.cleanup() }
      let applied: AppliedRouteDecision | null = null, targetUrl = originalUrl
      if (!self.settings.get().disabled && !playurl && self.routes.recognizesMedia(originalUrl)) {
        self.count('mediaRecognized')
        applied = method.toUpperCase() === 'GET' ? self.routes.apply(originalUrl) : self.routes.inspectOriginal(originalUrl)
        if (applied.url) targetUrl = applied.url
      }
      xhrMeta.set(this, { method: String(method).toUpperCase(), originalUrl,
        managedBilibili: self.routes.isBilibiliMedia(originalUrl), targetUrl, applied,
        startedAt: 0, responseAt: 0, bytes: 0, settled: false, playurl,
        transformedText: null, transformedJson: undefined, catalogOnlyAtTransform: null, request: null,
        generation: self.session.get().generation, epoch: self.session.get().epoch,
        responseKey: self.nextResponseKey('api-xhr'), cleanup: () => undefined, async, headers: [],
        pendingSend: false, abortedBeforeSend: false,
        ...(username !== undefined ? { username } : {}), ...(password !== undefined ? { password } : {}) })
      if (username !== undefined) Reflect.apply(originalOpen, this, [method, targetUrl, async, username, password])
      else Reflect.apply(originalOpen, this, [method, targetUrl, async])
    }

    const send: typeof XMLHttpRequest.prototype.send = function(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null): void {
      const meta = xhrMeta.get(this)
      if (!meta) { Reflect.apply(originalSend, this, [body ?? null]); return }
      if (meta.pendingSend) throw new DOMException('send already called', 'InvalidStateError')
      const perform = (): void => {
      if (meta.abortedBeforeSend || xhrMeta.get(this) !== meta) return
      meta.pendingSend = false
      const reopen = (url: string): void => {
        const responseType = this.responseType, timeout = this.timeout, credentials = this.withCredentials
        Reflect.apply(originalOpen, this, [meta.method, url, meta.async, meta.username ?? null, meta.password ?? null])
        this.responseType = responseType; this.timeout = timeout; this.withCredentials = credentials
        for (const [key, value] of meta.headers) Reflect.apply(originalSetHeader, this, [key, value])
      }
      if (self.settings.get().disabled) {
        if (meta.targetUrl !== meta.originalUrl) reopen(meta.originalUrl)
        self.count('nativeCalled'); Reflect.apply(originalSend, this, [body ?? null]); return
      }
      if (meta.playurl && self.routes.isCatalogOnly() && !['', 'text', 'json'].includes(this.responseType)) {
        self.blocked(meta.method, meta.originalUrl, 'playurl-response-type')
        queueMicrotask(() => { this.dispatchEvent(new Event('error')); this.dispatchEvent(new Event('loadend')) })
        return
      }
      const strictManaged = self.routes.isCatalogOnly()
        && (meta.managedBilibili || self.routes.recognizesMedia(meta.originalUrl))
      if (!self.session.isGeneration(meta.generation) && strictManaged) {
        self.blocked(meta.method, meta.originalUrl, 'catalog-unavailable')
        queueMicrotask(() => { this.dispatchEvent(new Event('error')); this.dispatchEvent(new Event('loadend')) })
        return
      }
      if (!self.session.isGeneration(meta.generation)) {
        if (meta.targetUrl !== meta.originalUrl) reopen(meta.originalUrl)
        self.count('nativeCalled'); Reflect.apply(originalSend, this, [body ?? null]); return
      }
      if (!meta.playurl && (self.routes.recognizesMedia(meta.originalUrl) || strictManaged)) {
        if (!meta.applied) self.count('mediaRecognized')
        const next = meta.method === 'GET' ? self.routes.apply(meta.originalUrl) : self.routes.inspectOriginal(meta.originalUrl)
        if (next.url && next.url !== meta.targetUrl) {
          reopen(next.url)
          meta.targetUrl = next.url
        }
        meta.applied = next
      }
      if (self.settings.get().blockHttpDns && isHttpDnsUrl(meta.originalUrl, location.href)) {
        queueMicrotask(() => { this.dispatchEvent(new Event('error')); this.dispatchEvent(new Event('loadend')) })
        return
      }
      const reason = self.dispatchFailure({ generation: meta.generation, applied: meta.applied, targetUrl: meta.targetUrl, managedMedia: strictManaged })
      if (reason) {
        self.blocked(meta.method, meta.originalUrl, reason)
        queueMicrotask(() => { this.dispatchEvent(new Event('error')); this.dispatchEvent(new Event('loadend')) })
        return
      }
      meta.startedAt = self.now()
      if (meta.applied) { meta.request = self.request(meta.applied, meta.originalUrl, meta.targetUrl, meta.startedAt, meta.method); self.routes.requestStarted(meta.request) }
      const noteHeaders = (): void => { if (!meta.responseAt && this.readyState >= 2) meta.responseAt = self.now() }
      const progress = (event: ProgressEvent): void => { noteHeaders(); meta.bytes = Math.max(meta.bytes, Number(event.loaded) || 0) }
      const settle = (outcome: 'success' | 'abort' | 'failure', failure?: FailureKind): void => {
        if (meta.settled) return
        meta.settled = true
        meta.cleanup()
        if (meta.responseAt > 0 || this.status > 0) { self.count('responseObserved'); self.noteResponse(meta.request, Number(this.status) || 0) }
        if (!meta.applied || !meta.request) return
        const finalUrl = (() => { try { return this.responseURL || '' } catch { return '' } })()
        void self.routes.observe(self.observation(meta.request, meta.applied, meta.originalUrl, meta.targetUrl, finalUrl,
          Number(this.status) || 0, meta.bytes, meta.startedAt, meta.responseAt, outcome, failure, sameUrl(finalUrl, meta.targetUrl)))
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
      self.count('nativeCalled')
      self.noteNativeCall(meta.request)
      Reflect.apply(originalSend, this, [body ?? null])
      }
      if (meta.async && !meta.playurl && meta.method === 'GET' && self.routes.recognizesMedia(meta.originalUrl)
        && !self.settings.get().disabled && this.timeout === 0
        && self.measurement.willGateStartup(meta.originalUrl)) {
        meta.pendingSend = true
        void self.measurement.prepareStartup(meta.originalUrl).then(perform, perform)
        return
      }
      if (!meta.playurl && self.routes.recognizesMedia(meta.originalUrl)) {
        if (!meta.async) self.measurement.noteUnpreflighted('preflight-skipped:synchronous-xhr')
        else if (this.timeout > 0) self.measurement.noteUnpreflighted('preflight-skipped:xhr-explicit-timeout')
        else self.measurement.noteUnpreflighted('no-safe-startup-candidate')
      }
      perform()
    }

    const abort: typeof XMLHttpRequest.prototype.abort = function(this: XMLHttpRequest): void {
      const meta = xhrMeta.get(this)
      if (meta?.pendingSend) { meta.abortedBeforeSend = true; meta.pendingSend = false }
      Reflect.apply(originalAbort, this, [])
    }
    const setHeader: typeof XMLHttpRequest.prototype.setRequestHeader = function(this: XMLHttpRequest, name: string, value: string): void {
      if (xhrMeta.get(this)?.pendingSend) throw new DOMException('send already called', 'InvalidStateError')
      Reflect.apply(originalSetHeader, this, [name, value])
      xhrMeta.get(this)?.headers.push([name, value])
    }
    const rollback = (): void => {
      try { if (proto.open === open) proto.open = originalOpen } catch { /* host-owned */ }
      try { if (proto.send === send) proto.send = originalSend } catch { /* host-owned */ }
      try { if (proto.abort === abort) proto.abort = originalAbort } catch { /* host-owned */ }
      try { if (proto.setRequestHeader === setHeader) proto.setRequestHeader = originalSetHeader } catch { /* host-owned */ }
      try { if (responseDescriptor) Object.defineProperty(proto, 'response', responseDescriptor) } catch { /* host-owned */ }
      try { if (responseTextDescriptor) Object.defineProperty(proto, 'responseText', responseTextDescriptor) } catch { /* host-owned */ }
    }
    try {
      proto.open = open; proto.send = send; proto.abort = abort; proto.setRequestHeader = setHeader
      if (proto.open !== open || proto.send !== send || proto.abort !== abort || proto.setRequestHeader !== setHeader) throw new Error('XHR hook assignment did not stick')
      if (responseDescriptor?.get && responseDescriptor.configurable) {
        Object.defineProperty(proto, 'response', { ...responseDescriptor, get(this: XMLHttpRequest) {
          const raw: unknown = responseDescriptor.get?.call(this), meta = xhrMeta.get(this)
          if (!meta?.playurl || self.settings.get().disabled) return raw
          if (this.readyState !== 4) return self.routes.isCatalogOnly()
            ? (this.responseType === '' || this.responseType === 'text' ? '' : null) : raw
          if (!self.session.isGeneration(meta.generation) && self.routes.isCatalogOnly()) return blockedPlayurl()
          if (!self.session.isGeneration(meta.generation)) return raw
          const strict = self.routes.isCatalogOnly()
          if (meta.catalogOnlyAtTransform !== strict) {
            meta.transformedText = null; meta.transformedJson = undefined; meta.catalogOnlyAtTransform = strict
          }
          if (this.responseType === 'json') {
            if (meta.transformedJson === undefined) {
              try {
                const accepted = raw && typeof raw === 'object' && self.playurl.transform(raw, 'trusted-api', meta.responseKey)
                meta.transformedJson = strict && !accepted ? blockedPlayurl() : raw
              } catch { meta.transformedJson = strict ? blockedPlayurl() : raw }
            }
            return meta.transformedJson
          }
          if ((this.responseType === '' || this.responseType === 'text') && typeof raw === 'string') {
            if (meta.transformedText === null) {
              try {
                const payload: unknown = JSON.parse(raw), accepted = self.playurl.transform(payload, 'trusted-api', meta.responseKey)
                meta.transformedText = strict && !accepted ? blockedPlayurlText() : JSON.stringify(payload)
              } catch { meta.transformedText = strict ? blockedPlayurlText() : raw }
            }
            return meta.transformedText
          }
          return strict ? blockedPlayurl() : raw
        } })
      }
      if (responseTextDescriptor?.get && responseTextDescriptor.configurable) {
        Object.defineProperty(proto, 'responseText', { ...responseTextDescriptor, get(this: XMLHttpRequest) {
          const raw = String(responseTextDescriptor.get?.call(this) ?? ''), meta = xhrMeta.get(this)
          if (!meta?.playurl || self.settings.get().disabled) return raw
          if (this.readyState !== 4) return self.routes.isCatalogOnly() ? '' : raw
          if (!self.session.isGeneration(meta.generation) && self.routes.isCatalogOnly()) return blockedPlayurlText()
          if (!self.session.isGeneration(meta.generation)) return raw
          const strict = self.routes.isCatalogOnly()
          if (meta.catalogOnlyAtTransform !== strict) {
            meta.transformedText = null; meta.transformedJson = undefined; meta.catalogOnlyAtTransform = strict
          }
          if (meta.transformedText !== null) return meta.transformedText
          try {
            const payload: unknown = JSON.parse(raw), accepted = self.playurl.transform(payload, 'trusted-api', meta.responseKey)
            meta.transformedText = strict && !accepted ? blockedPlayurlText() : JSON.stringify(payload)
          } catch { meta.transformedText = strict ? blockedPlayurlText() : raw }
          return meta.transformedText
        } })
      }
      return { restore: rollback, isInstalled: () => proto.open === open && proto.send === send }
    } catch { rollback(); return null }
  }

}
