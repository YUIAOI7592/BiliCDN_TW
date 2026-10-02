import { isPlayurlApi } from '../domain/catalog.ts'
import { isHttpDnsUrl } from '../domain/url-policy.ts'
import type { FailureKind, RequestContext } from '../domain/model.ts'
import { type TransportContext, type HookInstallation, copyResponseSurface, blockedPlayurlText } from './transport-context.ts'
export class FetchHookAdapter {
  constructor(private readonly context: TransportContext) {}
  install(): HookInstallation | null {
    const original = unsafeWindow.fetch
    if (typeof original !== 'function') return null
    const self = this.context
    const wrapped: typeof fetch = async function(this: Window & typeof globalThis, input, init) {
      self.count('enteredFetch')
      let activeRequest: RequestContext | null = null
      const native = async (source: RequestInfo | URL, originalInit = true): Promise<Response> => {
        self.count('nativeCalled')
        self.noteNativeCall(activeRequest)
        const response = await Reflect.apply(original, this, originalInit ? [source, init] : [source]) as Response
        self.count('responseObserved')
        self.noteResponse(activeRequest, response.status)
        return response
      }
      if (self.settings.get().disabled) return await native(input)
      // The same platform-normalized Request supplies policy inputs and native dispatch.
      // Page-owned href/url expandos and mutable init getters cannot split those destinations.
      const sourceRequest = new Request(input, init)
      const originalUrl = sourceRequest.url
      if (self.settings.get().blockHttpDns && isHttpDnsUrl(originalUrl, location.href)) {
        return new Response(JSON.stringify({ code: -1, message: 'HTTPDNS blocked by BiliCDN v2' }), {
          status: 503, headers: { 'content-type': 'application/json; charset=utf-8' },
        })
      }
      if (isPlayurlApi(originalUrl, location.href)) {
        const generation = self.session.get().generation, responseKey = self.nextResponseKey('api-fetch')
        const response = await native(sourceRequest, false)
        if (self.settings.get().disabled) return response
        const catalogOnly = (): boolean => !self.settings.get().disabled && self.routes.isCatalogOnly()
        const blocked = (): Response => copyResponseSurface(new Response(blockedPlayurlText(), {
          status: 503, headers: { 'content-type': 'application/json; charset=utf-8' },
        }), response)
        let text: string
        try { text = await response.text() } catch { return catalogOnly() ? blocked() : response }
        if (self.settings.get().disabled) {
          return copyResponseSurface(new Response(text, { status: response.status, statusText: response.statusText, headers: response.headers }), response)
        }
        try {
          const payload: unknown = JSON.parse(text)
          const accepted = self.session.isGeneration(generation) && !self.settings.get().disabled
            ? self.playurl.transform(payload, 'trusted-api', responseKey) : false
          if (catalogOnly() && !accepted) return blocked()
          text = JSON.stringify(payload)
        } catch { if (catalogOnly()) return blocked() }
        return copyResponseSurface(new Response(text, { status: response.status, statusText: response.statusText, headers: response.headers }), response)
      }
      const method = sourceRequest.method.toUpperCase()
      if (!self.routes.recognizesMedia(originalUrl)) return await native(sourceRequest, false)
      self.count('mediaRecognized')
      const generation = self.session.get().generation
      if (method === 'GET') {
        if (self.measurement.willGateStartup(originalUrl)) {
          await self.measurement.prepareStartup(originalUrl, sourceRequest.signal)
        } else self.measurement.noteUnpreflighted('no-safe-startup-candidate')
      }
      if (self.settings.get().disabled) return await native(sourceRequest, false)
      if (!self.session.isGeneration(generation)) {
        if (self.routes.isCatalogOnly()) {
          self.blocked(method, originalUrl, 'catalog-unavailable')
          throw new TypeError('BiliCDN blocked stale media request: catalog-unavailable')
        }
        // Never apply an old route plan after SPA, but still enforce current host restrictions.
        const original = self.routes.inspectOriginal(originalUrl)
        if (original.decision.action === 'block' || !original.url) {
          self.blocked(method, originalUrl, original.decision.reason)
          throw new TypeError(`BiliCDN blocked media request: ${original.decision.reason}`)
        }
        return await native(sourceRequest, false)
      }
      const applied = method === 'GET' ? self.routes.apply(originalUrl) : self.routes.inspectOriginal(originalUrl)
      const reason = self.dispatchFailure({ generation, applied, targetUrl: applied.url ?? '', managedMedia: true })
      if (reason || !applied.url) {
        self.blocked(method, originalUrl, reason ?? 'catalog-unavailable')
        throw new TypeError(`BiliCDN blocked media request: ${reason}`)
      }
      const targetInput = applied.url === originalUrl ? sourceRequest : new Request(applied.url, sourceRequest)
      const outbound = self.routes.isCatalogOnly() ? new Request(targetInput, { redirect: 'error' }) : targetInput
      const startedAt = self.now()
      const request = self.request(applied, originalUrl, applied.url, startedAt, method)
      activeRequest = request
      self.routes.requestStarted(request)
      let response: Response
      try {
        response = await native(outbound, false)
      } catch (error) {
        const signal = sourceRequest.signal
        const aborted = signal?.aborted === true || (error instanceof DOMException && error.name === 'AbortError')
        void self.observeFetch(request, applied, originalUrl, applied.url, null, startedAt, 0, 0, aborted ? 'abort' : 'failure', aborted ? undefined : 'network')
        throw error
      }
      const responseAt = self.now()
      if (!response.body) {
        const invalid = applied.decision.routeType === 'native-signed' && [403,451,959].includes(response.status)
        void self.observeFetch(request, applied, originalUrl, applied.url, response, startedAt, responseAt, 0,
          response.ok ? 'success' : 'failure', invalid ? 'native-invalid' : response.status >= 500 ? 'http-5xx' : undefined)
        return response
      }
      const reader = response.body.getReader()
      let bytes = 0, settled = false
      const settle = (outcome: 'success' | 'abort' | 'failure', failure?: FailureKind): void => {
        if (settled) return
        settled = true
        void self.observeFetch(request, applied, originalUrl, applied.url ?? originalUrl, response, startedAt, responseAt, bytes, outcome, failure)
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
            const signal = sourceRequest.signal
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
      if (unsafeWindow.fetch !== wrapped) {
        try { unsafeWindow.fetch = original } catch { /* host-owned */ }
        return null
      }
      return { isInstalled: () => unsafeWindow.fetch === wrapped,
        restore: () => { if (unsafeWindow.fetch === wrapped) unsafeWindow.fetch = original } }
    } catch {
      try { if (unsafeWindow.fetch === wrapped) unsafeWindow.fetch = original } catch { /* host-owned */ }
      return null
    }
  }

}
