import type {
  AttributionSource,
  AttributionStatus,
  DecisionId,
  MediaKind,
  PlaybackDemand,
  PlayurlOutputSummary,
  RecoveryActionId,
  RepresentationId,
  RequestContext,
  RouteDecision,
  RouteIdentity,
  RouteType,
  TransportObservation,
} from '../domain/model.ts'
import type { SessionSnapshot } from '../state/session-model.ts'
import type { VaultGroupSnapshot } from '../state/vault-model.ts'

export interface AppliedRouteDecision {
  readonly decision: RouteDecision
  readonly url: string | null
  readonly context: RouteIdentity | null
  readonly streamKey: string | null
  readonly sourceHost: string | null
  readonly attributionStatus?: AttributionStatus
  readonly attributionSource?: AttributionSource
  readonly playurlHostChanged?: boolean
  readonly playurlOutput?: PlayurlOutputSummary
}

export interface CatalogValidationContext {
  readonly identity: RouteIdentity
  readonly policyRevision: number
}
export interface CatalogValidationTarget extends CatalogValidationContext {
  readonly host: string
}

export interface StartupCandidate {
  readonly host: string
  readonly type: RouteType
  readonly url: string
  readonly original: boolean
  readonly cachedSafeMbps: number | null
  readonly context: RouteIdentity
}

export interface StartupOptions {
  readonly candidates: readonly StartupCandidate[]
  readonly demand: PlaybackDemand
  readonly originalHost: string
}

export interface DecisionRecord {
  readonly decision: RouteDecision
  readonly context: RouteIdentity | null
  readonly kind: MediaKind
  readonly representation: RepresentationId | null
  readonly policyRevision: number
}
export interface FallbackProgress {
  readonly actionId: RecoveryActionId
  readonly representation: RepresentationId
  readonly decisionId: DecisionId
  readonly plannedHost: string
  readonly routeType: RouteType
  readonly stage: 'planned' | 'entered-hook' | 'response-observed' | 'request-failed'
  readonly requestId: string | null
  readonly responseHost: string | null
  readonly outcome: TransportObservation['outcome'] | null
  readonly status: number | null
}

export interface RouteTransferSnapshot extends Partial<RequestContext> {
  readonly kind: MediaKind | null
  readonly routeType: RouteType
  readonly originalHost: string
  readonly targetHost: string
  readonly responseHost: string | null
  readonly outcome: TransportObservation['outcome']
  readonly status: number
  readonly observedAt: number
  readonly attributionStatus: AttributionStatus
}
export type MediaRows<T> = Readonly<Partial<Record<MediaKind | 'unknown', T>>>
export interface RoutePlanSummary {
  readonly id: DecisionId
  readonly action: RouteDecision['action']
  readonly reason: string
  readonly routeType: RouteType
  readonly host: string | null
}
export interface RouteRankingSummary {
  readonly host: string
  readonly type: RouteType
  readonly state: RouteDecision['ranking'][number]['state']
  readonly eligible: boolean
  readonly reasons: readonly string[]
  readonly safeMbps: number | null
  readonly ratio: number | null
  readonly ttfbMs: number | null
}
export interface RouteSnapshot {
  readonly originalComparison: boolean
  readonly planCount: number
  readonly activePlan:
    (RoutePlanSummary & { readonly ranking: readonly RouteRankingSummary[] }) | null
  readonly recentPlans: readonly (RoutePlanSummary & {
    readonly representation: RepresentationId
  })[]
  readonly affinity: SessionSnapshot['affinity']
  readonly latest: MediaRows<RouteTransferSnapshot>
  readonly lastSuccess: MediaRows<RouteTransferSnapshot>
  readonly requested: MediaRows<RequestContext>
  readonly attribution: 'confirmed' | 'awaiting-second-video-transfer' | 'awaiting-matched-video'
  readonly representation: VaultGroupSnapshot | null
  readonly fallback: Readonly<Partial<Record<MediaKind, Readonly<FallbackProgress>>>>
}
