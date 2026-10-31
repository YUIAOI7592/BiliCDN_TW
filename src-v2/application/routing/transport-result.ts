import { isCatalogHost } from '../../domain/catalog.ts'
import type { EvidenceSample, MediaKind, TransportObservation } from '../../domain/model.ts'
import type { RouteTransferSnapshot } from '../route-contracts.ts'

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

export type TransportResult =
  | { readonly type: 'ignore' }
  | { readonly type: 'catalog-forbidden' }
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
        requestId,
        at: observation.completedAt,
        source: 'transport',
        outcome: 'success',
        throughputMbps:
          observation.bytes >= 64 * 1024 && observation.elapsedMs > 0
            ? (observation.bytes * 8) / observation.elapsedMs / 1000
            : null,
        ttfbMs: observation.ttfbMs,
        failureKind: null,
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
