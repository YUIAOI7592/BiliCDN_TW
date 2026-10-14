import type { PlayurlRequestContext } from '../domain/playurl-model.ts'
import type { RequestContext, GenerationId, EpochId } from '../domain/model.ts'
import type { AppliedRouteDecision } from '../application/route-model.ts'

export interface XhrMeta {
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

export interface XhrRequestState {
  waiting(xhr: XMLHttpRequest, meta: XhrMeta): boolean
  finishLocal(xhr: XMLHttpRequest, meta: XhrMeta, type: 'error' | 'abort'): void
  rejectLocal(xhr: XMLHttpRequest, meta: XhrMeta): void
}

// The hook keeps the only metadata index. Each terminal event rechecks its lookup.
export function createXhrRequestState(
  getMetadata: (xhr: XMLHttpRequest) => XhrMeta | undefined,
): XhrRequestState {
  const waiting = (xhr: XMLHttpRequest, meta: XhrMeta): boolean =>
    getMetadata(xhr) === meta && meta.phase === 'waiting'
  const finishLocal = (xhr: XMLHttpRequest, meta: XhrMeta, type: 'error' | 'abort'): void => {
    if (!waiting(xhr, meta)) return
    meta.phase = 'terminal'
    meta.virtualReadyState = 4
    meta.cleanup()
    if (!meta.async) throw new DOMException('BiliCDN blocked request', 'NetworkError')
    // Each callback can reopen or abort this object. The old request then loses event ownership.
    const owns = (): boolean => getMetadata(xhr) === meta && meta.virtualReadyState === 4
    xhr.dispatchEvent(new Event('readystatechange'))
    if (owns()) xhr.dispatchEvent(new ProgressEvent(type))
    if (owns()) xhr.dispatchEvent(new ProgressEvent('loadend'))
  }
  const rejectLocal = (xhr: XMLHttpRequest, meta: XhrMeta): void => {
    if (meta.async) queueMicrotask(() => finishLocal(xhr, meta, 'error'))
    else finishLocal(xhr, meta, 'error')
  }
  return { waiting, finishLocal, rejectLocal }
}

export function resetXhrTransform(meta: XhrMeta, strict: boolean): void {
  if (meta.catalogOnlyAtTransform !== strict) {
    meta.transformedText = null
    meta.transformedJson = undefined
    meta.catalogOnlyAtTransform = strict
  }
}
