import { isPlayurlApi } from '../domain/catalog.ts'
import { playurlRequestContext } from '../domain/playurl-content.ts'
import type { PlayurlRequestContext } from '../domain/playurl-model.ts'
import { isHttpDnsUrl } from '../domain/url-policy.ts'
import type { FailureKind, RequestContext, GenerationId, EpochId } from '../domain/model.ts'
import type { AppliedRouteDecision } from '../application/route-coordinator.ts'
import { type TransportContext, type HookInstallation, sameUrl, blockedPlayurl, blockedPlayurlText, rejectedPlayurl } from './transport-context.ts'
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
  requestContext: PlayurlRequestContext
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
  phase: 'opened' | 'waiting' | 'sent' | 'terminal'
  virtualReadyState: number | null
  needsNativeOpen: boolean
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
    const readyStateDescriptor = Object.getOwnPropertyDescriptor(proto, 'readyState')
    const self = this.context, xhrMeta = this.#xhrMeta
    const waiting = (xhr: XMLHttpRequest, meta: XhrMeta): boolean => xhrMeta.get(xhr) === meta && meta.phase === 'waiting'
    const finishLocal = (xhr: XMLHttpRequest, meta: XhrMeta, type: 'error' | 'abort'): void => {
      if (!waiting(xhr, meta)) return
      meta.phase = 'terminal'; meta.virtualReadyState = 4; meta.cleanup()
      if (!meta.async) throw new DOMException('BiliCDN blocked request', 'NetworkError')
      // Each callback can reopen or abort this object. The old request then loses event ownership.
      const owns = (): boolean => xhrMeta.get(xhr) === meta && meta.virtualReadyState === 4
      xhr.dispatchEvent(new Event('readystatechange'))
      if (owns()) xhr.dispatchEvent(new ProgressEvent(type))
      if (owns()) xhr.dispatchEvent(new ProgressEvent('loadend'))
    }
    const rejectLocal = (xhr: XMLHttpRequest, meta: XhrMeta): void => {
      if (meta.async) queueMicrotask(() => finishLocal(xhr, meta, 'error'))
      else finishLocal(xhr, meta, 'error')
    }

    const open: typeof XMLHttpRequest.prototype.open = function(this: XMLHttpRequest, method: string, url: string | URL,
      async?: boolean, username?: string | null, password?: string | null): void {
      // Check the receiver before user-controlled argument conversions. Native open still
      // owns method/URL/options validation and its original exception.
      readyStateDescriptor?.get?.call(this)
      if (arguments.length < 2) {
        Reflect.apply(originalOpen, this, Array.from(arguments))
        return
      }
      // Web IDL converts arguments before entering open's algorithm. Convert once, in
      // order, before saving an owner: a conversion can itself reopen this XHR.
      const methodString = `${method}`
      if (/[^\x00-\xff]/.test(methodString)) throw new TypeError('XHR method must be a ByteString')
      const originalUrl = `${url}`.toWellFormed()
      const asynchronous = arguments.length < 3 ? true : Boolean(async)
      const user = username == null ? null : `${username}`.toWellFormed()
      const pass = password == null ? null : `${password}`.toWellFormed()
      const normalizedMethod = /^(DELETE|GET|HEAD|OPTIONS|POST|PUT)$/i.test(methodString) ? methodString.toUpperCase() : methodString
      self.count('enteredXhr')
      const playurl = isPlayurlApi(originalUrl, location.href)
      const previous = xhrMeta.get(this)
      let applied: AppliedRouteDecision | null = null, targetUrl = originalUrl
      if (!self.settings.get().disabled && !playurl && self.routes.recognizesMedia(originalUrl)) {
        self.count('mediaRecognized')
        applied = normalizedMethod === 'GET' ? self.routes.apply(originalUrl) : self.routes.inspectOriginal(originalUrl)
        if (applied.url) targetUrl = applied.url
      }
      const next: XhrMeta = { method: normalizedMethod, originalUrl,
        managedBilibili: self.routes.isBilibiliMedia(originalUrl), targetUrl, applied,
        startedAt: 0, responseAt: 0, bytes: 0, settled: false, playurl,
        requestContext: playurlRequestContext(originalUrl, location.href),
        transformedText: null, transformedJson: undefined, catalogOnlyAtTransform: null, request: null,
        generation: self.session.get().generation, epoch: self.session.get().epoch,
        responseKey: self.nextResponseKey('api-xhr'), cleanup: () => undefined, async: asynchronous, headers: [],
        phase: 'opened', virtualReadyState: null, needsNativeOpen: false,
        username: user, password: pass }
      // Publish for synchronous readystatechange callbacks, but retain the previous
      // request intact until native validation succeeds. Nested successful open wins.
      xhrMeta.set(this, next)
      try {
        Reflect.apply(originalOpen, this, [methodString, targetUrl, asynchronous, user, pass])
      } catch (error) {
        if (xhrMeta.get(this) === next) {
          if (previous) {
            xhrMeta.set(this, previous)
            // Chrome can reset to UNSENT when rejecting Window synchronous options.
            // Only our still-unsent waiter may be prepared again; never replay sent work.
            if (previous.phase === 'waiting' && readyStateDescriptor?.get?.call(this) === 0) previous.needsNativeOpen = true
          }
          else xhrMeta.delete(this)
        }
        throw error
      }
      if (previous) { previous.phase = 'terminal'; previous.cleanup() }
    }

    const send: typeof XMLHttpRequest.prototype.send = function(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null): void {
      const meta = xhrMeta.get(this)
      if (!meta) { Reflect.apply(originalSend, this, [body ?? null]); return }
      if (meta.phase !== 'opened' || this.readyState !== 1) throw new DOMException('send invalid state', 'InvalidStateError')
      meta.phase = 'waiting'
      let nativeAccepted = false
      const perform = (): void => {
      if (!waiting(this, meta)) return
      const responseType = this.responseType, requestTimeout = this.timeout, credentials = this.withCredentials
      let preparations = 0
      const nativeReady = (): boolean => waiting(this, meta) && readyStateDescriptor?.get?.call(this) === 1
      const reopen = (url: string): void => {
        if (++preparations > 2) throw new DOMException('XHR preparation did not stabilize', 'InvalidStateError')
        Reflect.apply(originalOpen, this, [meta.method, url, meta.async, meta.username ?? null, meta.password ?? null])
        if (!waiting(this, meta)) return
        if (!nativeReady()) { meta.needsNativeOpen = true; return }
        if (meta.async) {
          this.responseType = responseType
          if (!nativeReady()) { if (waiting(this, meta)) meta.needsNativeOpen = true; return }
          this.timeout = requestTimeout
          if (!nativeReady()) { if (waiting(this, meta)) meta.needsNativeOpen = true; return }
        }
        this.withCredentials = credentials
        if (!nativeReady()) { if (waiting(this, meta)) meta.needsNativeOpen = true; return }
        for (const [key, value] of meta.headers) {
          Reflect.apply(originalSetHeader, this, [key, value])
          if (!nativeReady()) { if (waiting(this, meta)) meta.needsNativeOpen = true; return }
        }
        meta.targetUrl = url; meta.needsNativeOpen = false
      }
      // Every native preparation can synchronously change ownership, native state or
      // policy. Recompute the decision before attribution, with at most two opens.
      let disabled = false, stale = false
      for (;;) {
      if (!waiting(this, meta)) return
      disabled = self.settings.get().disabled
      let targetUrl = meta.originalUrl, applied: AppliedRouteDecision | null = null
      if (!disabled) {
      if (meta.playurl && self.routes.isCatalogOnly() && !['', 'text', 'json'].includes(this.responseType)) {
        self.blocked(meta.method, meta.originalUrl, 'playurl-response-type')
        self.notePlayurl('xhr', 0, rejectedPlayurl('unsupported-format'))
        rejectLocal(this, meta)
        return
      }
      const strictManaged = self.routes.isCatalogOnly()
        && (meta.managedBilibili || self.routes.recognizesMedia(meta.originalUrl))
      if (!self.session.isGeneration(meta.generation) && strictManaged) {
        self.blocked(meta.method, meta.originalUrl, 'catalog-unavailable')
        rejectLocal(this, meta)
        return
      }
      stale = !self.session.isGeneration(meta.generation)
      if (!meta.playurl && (meta.applied || meta.managedBilibili || self.routes.recognizesMedia(meta.originalUrl) || strictManaged)) {
        if (!meta.applied) self.count('mediaRecognized')
        applied = !stale && meta.method === 'GET' ? self.routes.apply(meta.originalUrl) : self.routes.inspectOriginal(meta.originalUrl)
        if (applied.url) targetUrl = applied.url
      }
      if (self.settings.get().blockHttpDns && isHttpDnsUrl(meta.originalUrl, location.href)) {
        rejectLocal(this, meta)
        return
      }
      const reason = self.dispatchFailure({ generation: meta.generation, applied, targetUrl, managedMedia: strictManaged })
      if (reason) {
        self.blocked(meta.method, meta.originalUrl, reason)
        rejectLocal(this, meta)
        return
      }
      }
      if (!waiting(this, meta)) return
      if (meta.needsNativeOpen || !nativeReady() || targetUrl !== meta.targetUrl) {
        reopen(targetUrl)
        continue
      }
      meta.applied = stale ? null : applied
      break
      }
      if (!waiting(this, meta)) return
      if (disabled) {
        meta.phase = 'sent'
        self.count('nativeCalled'); Reflect.apply(originalSend, this, [body ?? null]); nativeAccepted = true; return
      }
      meta.startedAt = self.now()
      if (meta.applied) { meta.request = self.request(meta.applied, meta.originalUrl, meta.targetUrl, meta.startedAt, meta.method); self.routes.requestStarted(meta.request) }
      const noteHeaders = (): void => {
        if (xhrMeta.get(this) === meta && !meta.responseAt && this.readyState >= 2) meta.responseAt = self.now()
      }
      const progress = (event: ProgressEvent): void => {
        if (xhrMeta.get(this) !== meta) return
        noteHeaders(); meta.bytes = Math.max(meta.bytes, Number(event.loaded) || 0)
      }
      const settle = (outcome: 'success' | 'abort' | 'failure', failure?: FailureKind): void => {
        if (meta.settled || xhrMeta.get(this) !== meta) return
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
      meta.phase = 'sent'
      try { Reflect.apply(originalSend, this, [body ?? null]) } catch (error) {
        // Native did not accept dispatch. Release attribution without blaming the
        // CDN; the deferred caller owns local error events, direct send still throws.
        if (!meta.settled && xhrMeta.get(this) === meta) {
          meta.cleanup()
          if (meta.applied && meta.request) void self.routes.observe(self.observation(meta.request,
            meta.applied, meta.originalUrl, meta.targetUrl, '', 0, 0, meta.startedAt, 0, 'abort', undefined, false))
        }
        throw error
      }
      nativeAccepted = true
      }
      if (meta.async && !meta.playurl && meta.method === 'GET' && self.routes.recognizesMedia(meta.originalUrl)
        && !self.settings.get().disabled && this.timeout === 0
        && self.measurement.willGateStartup(meta.originalUrl)) {
        const release = (): void => {
          try { perform() } catch {
            // send() already returned to the caller. A preparation/dispatch exception
            // must terminate this waiter, unless native events or a newer owner won.
            if (!nativeAccepted && xhrMeta.get(this) === meta && !meta.settled
              && (meta.phase === 'waiting' || meta.phase === 'sent')) {
              meta.phase = 'waiting'
              finishLocal(this, meta, 'error')
            }
          }
        }
        void self.measurement.prepareStartup(meta.originalUrl).then(release, release)
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
      if (meta?.phase === 'waiting') {
        finishLocal(this, meta, 'abort')
        if (xhrMeta.get(this) === meta) meta.virtualReadyState = 0
        return
      }
      if (meta?.virtualReadyState !== null && meta?.virtualReadyState !== undefined) {
        meta.virtualReadyState = 0
        return
      }
      Reflect.apply(originalAbort, this, [])
    }
    const setHeader: typeof XMLHttpRequest.prototype.setRequestHeader = function(this: XMLHttpRequest, name: string, value: string): void {
      const meta = xhrMeta.get(this)
      if (meta && (meta.phase === 'waiting' || meta.virtualReadyState !== null)) throw new DOMException('header invalid state', 'InvalidStateError')
      Reflect.apply(originalSetHeader, this, [name, value])
      xhrMeta.get(this)?.headers.push([name, value])
    }
    let responseGetter: PropertyDescriptor['get'], responseTextGetter: PropertyDescriptor['get'], readyStateGetter: PropertyDescriptor['get']
    const rollback = (): void => {
      try { if (proto.open === open) proto.open = originalOpen } catch { /* host-owned */ }
      try { if (proto.send === send) proto.send = originalSend } catch { /* host-owned */ }
      try { if (proto.abort === abort) proto.abort = originalAbort } catch { /* host-owned */ }
      try { if (proto.setRequestHeader === setHeader) proto.setRequestHeader = originalSetHeader } catch { /* host-owned */ }
      try { if (responseDescriptor && Object.getOwnPropertyDescriptor(proto, 'response')?.get === responseGetter) Object.defineProperty(proto, 'response', responseDescriptor) } catch { /* host-owned */ }
      try { if (responseTextDescriptor && Object.getOwnPropertyDescriptor(proto, 'responseText')?.get === responseTextGetter) Object.defineProperty(proto, 'responseText', responseTextDescriptor) } catch { /* host-owned */ }
      try { if (readyStateDescriptor && Object.getOwnPropertyDescriptor(proto, 'readyState')?.get === readyStateGetter) Object.defineProperty(proto, 'readyState', readyStateDescriptor) } catch { /* host-owned */ }
    }
    try {
      proto.open = open; proto.send = send; proto.abort = abort; proto.setRequestHeader = setHeader
      if (proto.open !== open || proto.send !== send || proto.abort !== abort || proto.setRequestHeader !== setHeader) throw new Error('XHR hook assignment did not stick')
      if (readyStateDescriptor?.get && readyStateDescriptor.configurable) {
        readyStateGetter = function(this: XMLHttpRequest): number {
          return xhrMeta.get(this)?.virtualReadyState ?? readyStateDescriptor.get!.call(this)
        }
        Object.defineProperty(proto, 'readyState', { ...readyStateDescriptor, get: readyStateGetter })
      }
      if (responseDescriptor?.get && responseDescriptor.configurable) {
        responseGetter = function(this: XMLHttpRequest): unknown {
          const raw: unknown = responseDescriptor.get?.call(this), meta = xhrMeta.get(this)
          if (meta && meta.virtualReadyState !== null) return this.responseType === '' || this.responseType === 'text' ? '' : null
          if (!meta?.playurl || self.settings.get().disabled) return raw
          if (this.readyState !== 4) return self.routes.isCatalogOnly()
            ? (this.responseType === '' || this.responseType === 'text' ? '' : null) : raw
          if (!self.session.isGeneration(meta.generation)) {
            self.notePlayurl('xhr', this.status, rejectedPlayurl('inactive'))
            return self.routes.isCatalogOnly() ? (this.responseType === '' || this.responseType === 'text' ? blockedPlayurlText() : blockedPlayurl()) : raw
          }
          const strict = self.routes.isCatalogOnly()
          if (meta.catalogOnlyAtTransform !== strict) {
            meta.transformedText = null; meta.transformedJson = undefined; meta.catalogOnlyAtTransform = strict
          }
          if (this.responseType === 'json') {
            if (meta.transformedJson === undefined) {
              try {
                const result = self.playurl.transform(raw, 'trusted-api', meta.responseKey, meta.requestContext)
                self.notePlayurl('xhr', this.status, result)
                meta.transformedJson = strict && !result.accepted ? blockedPlayurl() : raw
              } catch {
                self.notePlayurl('xhr', this.status, rejectedPlayurl('malformed-payload'))
                meta.transformedJson = strict ? blockedPlayurl() : raw
              }
            }
            return meta.transformedJson
          }
          if ((this.responseType === '' || this.responseType === 'text') && typeof raw === 'string') {
            if (meta.transformedText === null) {
              try {
                const payload: unknown = JSON.parse(raw), result = self.playurl.transform(payload, 'trusted-api', meta.responseKey, meta.requestContext)
                self.notePlayurl('xhr', this.status, result)
                meta.transformedText = strict && !result.accepted ? blockedPlayurlText() : JSON.stringify(payload)
              } catch {
                self.notePlayurl('xhr', this.status, rejectedPlayurl('malformed-payload'))
                meta.transformedText = strict ? blockedPlayurlText() : raw
              }
            }
            return meta.transformedText
          }
          self.notePlayurl('xhr', this.status, rejectedPlayurl('unsupported-format'))
          return strict ? blockedPlayurl() : raw
        }
        Object.defineProperty(proto, 'response', { ...responseDescriptor, get: responseGetter })
      }
      if (responseTextDescriptor?.get && responseTextDescriptor.configurable) {
        responseTextGetter = function(this: XMLHttpRequest): string {
          const raw = String(responseTextDescriptor.get?.call(this) ?? ''), meta = xhrMeta.get(this)
          if (meta && meta.virtualReadyState !== null) return ''
          if (!meta?.playurl || self.settings.get().disabled) return raw
          if (this.readyState !== 4) return self.routes.isCatalogOnly() ? '' : raw
          if (!self.session.isGeneration(meta.generation)) {
            self.notePlayurl('xhr', this.status, rejectedPlayurl('inactive'))
            return self.routes.isCatalogOnly() ? blockedPlayurlText() : raw
          }
          const strict = self.routes.isCatalogOnly()
          if (meta.catalogOnlyAtTransform !== strict) {
            meta.transformedText = null; meta.transformedJson = undefined; meta.catalogOnlyAtTransform = strict
          }
          if (meta.transformedText !== null) return meta.transformedText
          try {
            const payload: unknown = JSON.parse(raw), result = self.playurl.transform(payload, 'trusted-api', meta.responseKey, meta.requestContext)
            self.notePlayurl('xhr', this.status, result)
            meta.transformedText = strict && !result.accepted ? blockedPlayurlText() : JSON.stringify(payload)
          } catch {
            self.notePlayurl('xhr', this.status, rejectedPlayurl('malformed-payload'))
            meta.transformedText = strict ? blockedPlayurlText() : raw
          }
          return meta.transformedText
        }
        Object.defineProperty(proto, 'responseText', { ...responseTextDescriptor, get: responseTextGetter })
      }
      return { restore: rollback, isInstalled: () => proto.open === open && proto.send === send
        && proto.abort === abort && proto.setRequestHeader === setHeader
        && (!responseGetter || Object.getOwnPropertyDescriptor(proto, 'response')?.get === responseGetter)
        && (!responseTextGetter || Object.getOwnPropertyDescriptor(proto, 'responseText')?.get === responseTextGetter)
        && (!readyStateGetter || Object.getOwnPropertyDescriptor(proto, 'readyState')?.get === readyStateGetter) }
    } catch { rollback(); return null }
  }

}
