import { isCatalogHost } from '../../domain/catalog.ts'
import { sampleTiming } from '../../domain/evidence.ts'
import { type EvidenceSample } from '../../domain/evidence-model.ts'
import { type MediaKind } from '../../domain/model.ts'
import { type RequestContext, type TransportObservation } from '../../domain/transport-model.ts'
import { type RouteTransferSnapshot } from './route-contracts.ts'
export function catalogObservationAllowed(
  catalogOnly: boolean,
  observation: TransportObservation,
): boolean {
  return (
    !catalogOnly ||
    (observation.routeType === 'catalog-generated' &&
      isCatalogHost(observation.targetHost) &&
      (observation.finalHost === observation.targetHost ||
        (observation.finalHost === null && observation.outcome === 'failure')))
  )
}

export function transportSnapshot(observation: TransportObservation): RouteTransferSnapshot {
  const request = observation.request
  return Object.freeze({
    ...(request ?? {}),
    kind: observation.kind,
    routeType: observation.routeType,
    originalHost: observation.originalHost,
    targetHost: observation.targetHost,
    responseHost: observation.finalHost,
    outcome: observation.outcome,
    status: observation.status,
    observedAt: observation.completedAt,
    attributionStatus:
      request?.attributionStatus ?? (observation.representation ? 'matched' : 'waiting-data'),
  })
}

/** Static transport facts only; persistence, current ownership and timing stay at the call site. */
export function circuitCreditEligible(
  observation: TransportObservation,
  sample: EvidenceSample,
): boolean {
  return (
    observation.circuitVerified !== false &&
    sample.bytes !== undefined &&
    sample.bytes >= 65536 &&
    sample.elapsedMs !== undefined &&
    Number.isFinite(sample.throughputMbps) &&
    (sample.throughputMbps ?? 0) > 0
  )
}

export function retryTransportEligible(
  request: RequestContext,
  observation: TransportObservation,
): boolean {
  return (
    Number.isSafeInteger(observation.retryVerifiedBytes) &&
    (observation.retryVerifiedBytes ?? 0) >= 64 * 1024 &&
    request.generation === observation.generation &&
    request.epoch === observation.epoch &&
    request.representation === observation.representation &&
    request.kind === observation.kind &&
    request.targetHost === observation.targetHost &&
    observation.kind === 'video' &&
    observation.routeType === 'catalog-generated' &&
    observation.status === 206 &&
    observation.responseUrlMatchesRequest === true &&
    observation.finalHost === observation.targetHost &&
    observation.bytes >= 64 * 1024 &&
    observation.elapsedMs > 0 &&
    observation.ttfbMs !== null &&
    Number.isFinite(observation.ttfbMs) &&
    observation.ttfbMs >= 0
  )
}

export type TransportResult =
  | { readonly type: 'ignore' }
  | { readonly type: 'catalog-forbidden' }
  | { readonly type: 'catalog-resource-missing' }
  | { readonly type: 'request-rejected' }
  | { readonly type: 'native-invalid'; readonly host: string; readonly kind: MediaKind }
  | {
      readonly type: 'success' | 'failure'
      readonly host: string
      readonly kind: MediaKind
      readonly sample: EvidenceSample
    }

/** Classifies supplied facts only; authorization and every commit stay with the coordinator. */
export function classifyTransportResult(observation: TransportObservation): TransportResult {
  if (observation.outcome === 'abort') return { type: 'ignore' }
  const evidenceHost = observation.finalHost ?? observation.targetHost
  if (!evidenceHost) return { type: 'ignore' }
  if (
    observation.status === 403 &&
    observation.streamKey &&
    observation.routeType === 'catalog-generated'
  )
    return { type: 'catalog-forbidden' }
  const request = observation.request
  if (
    observation.routeType === 'catalog-generated' &&
    observation.streamKey &&
    [404, 410].includes(observation.status)
  )
    return { type: 'catalog-resource-missing' }
  if (
    observation.status >= 400 &&
    observation.status < 500 &&
    !(observation.failureKind === 'native-invalid' && observation.representation)
  )
    return { type: 'request-rejected' }
  if (!observation.kind || (request && request.attributionStatus !== 'matched'))
    return { type: 'ignore' }
  const requestId =
    request?.requestId ??
    `${Number(observation.generation)}:${Number(observation.epoch)}:${observation.completedAt}:${observation.targetHost}`
  if (observation.outcome === 'success') {
    if (!observation.finalHost) return { type: 'ignore' }
    return {
      type: 'success',
      host: observation.finalHost,
      kind: observation.kind,
      sample: {
        ...(observation.timingBasis ? { timingBasis: observation.timingBasis } : {}),
        requestId,
        at: observation.completedAt,
        source: 'transport',
        outcome: 'success',
        throughputMbps:
          observation.speedEligible !== false &&
          observation.bytes >= 64 * 1024 &&
          observation.elapsedMs > 0
            ? (observation.bytes * 8) / observation.elapsedMs / 1000
            : null,
        ttfbMs: observation.ttfbMs,
        failureKind: null,
        ...(sampleTiming(observation.bytes, observation.elapsedMs, observation.ttfbMs) ?? {}),
      },
    }
  }
  const failureKind = observation.failureKind
  if (failureKind === 'native-invalid' && observation.representation)
    return { type: 'native-invalid', host: evidenceHost, kind: observation.kind }
  if (!failureKind || !['network', 'body', 'timeout', 'http-5xx'].includes(failureKind))
    return { type: 'ignore' }
  return {
    type: 'failure',
    host: evidenceHost,
    kind: observation.kind,
    sample: {
      requestId,
      at: observation.completedAt,
      source: 'transport',
      outcome: 'failure',
      throughputMbps: null,
      ttfbMs: observation.ttfbMs,
      failureKind,
    },
  }
}
