import type { TransportContext } from './transport-context.ts'
import { sameUrl } from './transport-context.ts'
import { measuredPayload } from '../../domain/measurement-time.ts'
import type { FailureKind } from '../../domain/evidence-model.ts'
import { type PlayurlEndpointKind, type PlayurlRequestContext } from '../../domain/playurl-model.ts'
import { type RequestContext } from '../../domain/transport-model.ts'
import { type GenerationId, type EpochId } from '../../domain/model.ts'
import { type AppliedRouteDecision } from '../../application/routing/route-contracts.ts'
export interface XhrMeta {
  startedTick: number | null
  responseTick: number | null
  measurement: import('../../domain/measurement-time.ts').FrozenMeasurement | null
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
  apiEndpoint: PlayurlEndpointKind | null
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

interface XhrCompletionRetry {
  progress(xhr: XMLHttpRequest, meta: XhrMeta, event: ProgressEvent): void
  tracks(meta: XhrMeta): boolean
  verifiedBytes(xhr: XMLHttpRequest, meta: XhrMeta): number | null
  terminal(
    xhr: XMLHttpRequest,
    meta: XhrMeta,
    type: 'success' | 'failure' | 'abort' | 'timeout',
  ): boolean
}
/** Completion state for one accepted owner; no metadata index or independent authorization. */
export function createXhrCompletion(
  xhr: XMLHttpRequest,
  meta: XhrMeta,
  self: TransportContext,
  retry: XhrCompletionRetry,
  current: () => boolean,
) {
  let nativeBytes = 0
  const noteHeaders = (): void => {
    if (current() && meta.responseTick === null && xhr.readyState >= 2) {
      meta.responseAt = self.now()
      meta.responseTick = self.tick()
    }
  }
  const progress = (event: ProgressEvent): void => {
    if (!current()) return
    noteHeaders()
    meta.bytes = Math.max(meta.bytes, Number(event.loaded) || 0)
    if (event.isTrusted && Number.isSafeInteger(event.loaded) && event.loaded >= 0)
      nativeBytes = Math.max(nativeBytes, event.loaded)
    retry.progress(xhr, meta, event)
  }
  const settle = (
    outcome: 'success' | 'abort' | 'failure',
    failure?: FailureKind,
    nativeTimeout = false,
    event?: Event,
  ): void => {
    if (meta.settled || !current()) return
    meta.measurement = self.freezeMeasurement(meta.startedTick, meta.responseTick, 'xhr-terminal')
    let payloadValid = false
    try {
      payloadValid = measuredPayload(
        meta.bytes,
        xhr.getResponseHeader('Content-Length'),
        xhr.getResponseHeader('Content-Range'),
      )
    } catch {
      /* unavailable native metadata */
    }
    if (!current() || meta.settled) return
    meta.measurement = {
      ...meta.measurement,
      speedEligible: meta.measurement.speedEligible && payloadValid,
    }
    if (event && !event.isTrusted && retry.tracks(meta)) return
    const verifiedBytes = outcome === 'success' ? retry.verifiedBytes(xhr, meta) : null
    const controlledTimeout = retry.terminal(xhr, meta, nativeTimeout ? 'timeout' : outcome)
    if (controlledTimeout) {
      outcome = 'abort'
      failure = undefined
    }
    meta.settled = true
    meta.cleanup()
    if (meta.responseAt > 0 || xhr.status > 0) {
      self.count('responseObserved')
      self.noteResponse(meta.request, Number(xhr.status) || 0)
    }
    if (!meta.applied || !meta.request) return
    const finalUrl = (() => {
      try {
        return xhr.responseURL || ''
      } catch {
        return ''
      }
    })()
    void self.routes.observe({
      circuitVerified:
        event?.isTrusted === true && nativeBytes === meta.bytes && nativeBytes >= 65536,
      ...self.observation(
        meta.request,
        meta.applied,
        meta.originalUrl,
        meta.targetUrl,
        finalUrl,
        Number(xhr.status) || 0,
        meta.bytes,
        meta.startedAt,
        meta.responseAt,
        outcome,
        failure,
        sameUrl(finalUrl, meta.targetUrl),
        meta.measurement,
      ),
      ...(controlledTimeout ? { terminationReason: 'early-retry-timeout' as const } : {}),
      ...(verifiedBytes !== null ? { retryVerifiedBytes: verifiedBytes } : {}),
    })
  }

  return { noteHeaders, progress, settle }
}
