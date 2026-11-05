import type { TimingBasis } from './measurement-model.ts'
export type { TimingBasis, FrozenMeasurement } from './measurement-model.ts'
export type Brand<T, Name extends string> = T & { readonly __brand: Name }

export type GenerationId = Brand<number, 'GenerationId'>
export type EpochId = Brand<number, 'EpochId'>
export type RepresentationId = Brand<string, 'RepresentationId'>
export type DecisionId = Brand<string, 'DecisionId'>
export type RequestId = Brand<string, 'RequestId'>
export type AttributionStatus = 'matched' | 'waiting-data' | 'weak' | 'ambiguous' | 'detached'
export type AttributionSource = 'exact' | 'catalog-alias' | 'path-hint' | 'none'

export interface PlayurlOutputSummary {
  readonly originalHost: string
  readonly outputHost: string
  readonly role: 'primary' | 'backup'
  readonly source: 'trusted-api' | 'page-hint'
  readonly decisionId: DecisionId
  readonly hostChanged: boolean
}

export interface RequestContext {
  readonly timingBasis?: TimingBasis
  /** Assigned by the route owner at dispatch preparation; absent before dispatch. */
  readonly expectedBytes?: number | null
  readonly dispatchSequence?: number
  readonly routeRevision?: number
  readonly selectionRevision?: number
  readonly routePolicyRevision: number
  readonly requestId: RequestId
  readonly generation: GenerationId
  readonly epoch: EpochId
  readonly decisionId: DecisionId
  readonly representation: RepresentationId | null
  readonly authorityRevision?: number | null
  readonly kind: MediaKind | null
  readonly attributionStatus: AttributionStatus
  readonly attributionSource: AttributionSource
  readonly decisionStage: 'request'
  readonly routeType: RouteType
  readonly originalHost: string
  readonly targetHost: string
  readonly sourceHost: string | null
  readonly playurlHostChanged: boolean
  readonly playurlOutput: PlayurlOutputSummary | null
  readonly urlChanged: boolean
  readonly hostChanged: boolean
  readonly startedAt: number
}
export type RecoveryActionId = Brand<string, 'RecoveryActionId'>
export type SignedRouteHandle = Brand<string, 'SignedRouteHandle'>

export type MediaKind = 'video' | 'audio'
export type RouteType = 'catalog-generated' | 'native-signed' | 'root-original'
export type RouteState = 'unknown' | 'usable' | 'proven' | 'degraded' | 'circuit-open' | 'forbidden'
export type EvidenceSource = 'transport' | 'challenge'
export type CapacityConfidence =
  'missing' | 'provisional' | 'sufficient' | 'historical' | 'revalidation'
export type FailureKind = 'network' | 'body' | 'timeout' | 'http-5xx' | 'native-invalid'

export interface RouteIdentity {
  readonly generation: GenerationId
  readonly epoch: EpochId
  readonly representation: RepresentationId
  readonly kind: MediaKind
  readonly authorityRevision: number
}

interface CandidateBase {
  readonly host: string
  readonly kind: MediaKind
  readonly catalogIndex: number
}

export interface CatalogCandidate extends CandidateBase {
  readonly type: 'catalog-generated'
}

export interface NativeCandidate extends CandidateBase {
  readonly type: 'native-signed'
  readonly route: RouteIdentity
  readonly handle: SignedRouteHandle
  readonly activelyExplorable: boolean
}

export interface RootCandidate extends CandidateBase {
  readonly type: 'root-original'
  readonly route: RouteIdentity | null
  readonly handle: SignedRouteHandle | null
}

export type RouteCandidate = CatalogCandidate | NativeCandidate | RootCandidate

export type RestrictionReason =
  | 'catalog-disabled'
  | 'default-unavailable'
  | 'black'
  | 'dead'
  | 'circuit-open'
  | 'host-lock'
  | 'pcdn'
  | 'live'
  | 'resource'
  | 'invalid-url'
  | 'native-stale'
  | 'native-locked'
  | 'catalog-unavailable'
  | 'catalog-unreplaceable'
  | 'catalog-only-non-get'

export interface RouteRankingEntry {
  readonly comparisonMode: 'throughput' | 'completion'
  readonly predictionReason: PredictionReason
  readonly estimatedCompletionMs: number | null
  readonly candidateOrder: number
  readonly capacityConfidence: CapacityConfidence
  readonly freshSpeedCount: number
  readonly newestSpeedAt: number | null
  readonly safePayloadMbps: number | null
  readonly predictionTtfbMs: number | null
  readonly candidate: RouteCandidate
  readonly state: RouteState
  readonly eligible: boolean
  readonly reasons: readonly RestrictionReason[]
  readonly safeThroughputMbps: number | null
  readonly demandRatio: number | null
  readonly medianTtfbMs: number | null
  readonly successCount: number
  readonly failureCount: number
}

export type RouteDecision =
  | {
      readonly action: 'pass'
      readonly target:
        | { readonly type: 'request' }
        | { readonly type: 'selected-original'; readonly candidate: RootCandidate }
      readonly id: DecisionId
      readonly reason: string
      readonly routeType: 'root-original'
      readonly host: string | null
      readonly ranking: readonly RouteRankingEntry[]
    }
  | {
      readonly action: 'rewrite'
      readonly id: DecisionId
      readonly reason: string
      readonly routeType: 'catalog-generated' | 'native-signed'
      readonly host: string
      readonly candidate: CatalogCandidate | NativeCandidate
      readonly ranking: readonly RouteRankingEntry[]
    }
  | {
      readonly action: 'block'
      readonly id: DecisionId
      readonly reason: RestrictionReason
      readonly routeType: RouteType
      readonly host: string | null
      readonly ranking: readonly RouteRankingEntry[]
    }

export interface TransportObservation {
  /** XHR native terminal and trusted byte evidence; independent of early-retry eligibility. */
  readonly circuitVerified?: boolean
  readonly timingBasis?: TimingBasis
  readonly speedEligible?: boolean
  readonly retryVerifiedBytes?: number
  readonly terminationReason?: 'early-retry-timeout'
  readonly request?: RequestContext
  readonly generation: GenerationId
  readonly epoch: EpochId
  readonly decisionId: DecisionId | null
  readonly representation: RepresentationId | null
  readonly kind: MediaKind | null
  readonly routeType: RouteType
  readonly originalHost: string
  readonly targetHost: string
  readonly finalHost: string | null
  readonly responseUrlMatchesRequest?: boolean
  readonly streamKey: string | null
  readonly status: number
  readonly bytes: number
  readonly ttfbMs: number | null
  readonly elapsedMs: number
  readonly completedAt: number
  readonly outcome: 'success' | 'abort' | 'failure'
  readonly failureKind?: FailureKind
}

export interface EvidenceSample {
  readonly timingBasis?: TimingBasis
  readonly requestId: string
  readonly at: number
  readonly source: EvidenceSource
  readonly outcome: 'success' | 'failure'
  readonly throughputMbps: number | null
  readonly ttfbMs: number | null
  readonly failureKind: FailureKind | null
  readonly bytes?: number
  readonly elapsedMs?: number
}

export interface CircuitControlStamp {
  readonly generation: string
  readonly recordId: string
  readonly revision: number
}
export interface CircuitRecordControl {
  readonly recordId: string
  readonly revision: number
  readonly lastCommitId: string | null
}
export interface CircuitObservationSnapshot {
  readonly host: string
  readonly kind: MediaKind
  readonly level: number
  readonly until: number
  readonly phase: 'clear' | 'isolated' | 'awaiting' | 'observing' | 'settling'
  readonly reason: string
  readonly progressSec: number
  readonly remainingSec: number | null
}
export interface RouteEvidence {
  readonly circuitControl?: CircuitRecordControl
  readonly host: string
  readonly kind: MediaKind
  readonly samples: readonly EvidenceSample[]
  readonly circuitLevel: number
  readonly circuitUntil: number
  readonly updatedAt: number
}

export interface PlaybackDemand {
  readonly kind: MediaKind
  readonly requiredMbps: number
  readonly highDemand: boolean
}

export interface CompletionBudget {
  readonly timingBasis?: TimingBasis
  readonly ageMs?: number
  readonly requestBytes: number | null
  readonly playableBufferSec: number | null
  readonly sampledAt: number
}
export type PredictionReason =
  | 'available'
  | 'unknown-size'
  | 'unknown-buffer'
  | 'stale-playback'
  | 'unknown-body-rate'
  | 'cohort-incomplete'
export interface RoutePlaybackFacts extends Pick<
  RequestContext,
  | 'generation'
  | 'epoch'
  | 'representation'
  | 'authorityRevision'
  | 'selectionRevision'
  | 'routePolicyRevision'
> {
  readonly sampledTick: number
  readonly playbackRate: number
  readonly bufferAheadSec: number
  readonly playbackRevision: number
  readonly sampledAt: number
  readonly playableBufferSec: number
}

export interface RouteAffinity {
  readonly type: RouteType
  readonly host: string
  readonly confirmedAt: number
  readonly decisionId: DecisionId
  readonly representation: RepresentationId | null
}

export type RecoveryAction =
  | {
      readonly action: 'route-fallback'
      readonly id: RecoveryActionId
      readonly kind: MediaKind
      readonly identity: RouteIdentity
      readonly decision: RouteDecision
    }
  | { readonly action: 'none'; readonly id: RecoveryActionId; readonly reason: string }

export type DomainEvent =
  | { readonly type: 'route-planned'; readonly at: number; readonly decision: RouteDecision }
  | { readonly type: 'request-started'; readonly at: number; readonly request: RequestContext }
  | {
      readonly type: 'attribution-changed'
      readonly at: number
      readonly requestId: RequestId
      readonly status: AttributionStatus
      readonly kind: MediaKind | null
    }
  | {
      readonly type: 'route-confirmed'
      readonly at: number
      readonly observation: TransportObservation
    }
  | { readonly type: 'route-decision'; readonly at: number; readonly decision: RouteDecision }
  | { readonly type: 'recovery'; readonly at: number; readonly action: RecoveryAction }

export interface Clock {
  now(): number
  monotonicNow?(): number | null
}

export const generationId = (value: number): GenerationId => value as GenerationId
export const epochId = (value: number): EpochId => value as EpochId
export const representationId = (value: string): RepresentationId => value as RepresentationId
export const decisionId = (value: string): DecisionId => value as DecisionId
export const requestId = (value: string): RequestId => value as RequestId
export const recoveryActionId = (value: string): RecoveryActionId => value as RecoveryActionId
export const signedRouteHandle = (value: string): SignedRouteHandle => value as SignedRouteHandle

export interface EvidenceMetrics {
  readonly state: RouteState
  readonly safeThroughputMbps: number | null
  readonly medianTtfbMs: number | null
  readonly successCount: number
  readonly failureCount: number
  readonly speedSampleCount: number
  readonly freshSpeedCount: number
  readonly capacityConfidence: CapacityConfidence
  readonly newestSpeedAt: number | null
  readonly revalidationRequired: boolean
  readonly safePayloadMbps: number | null
  readonly predictionTtfbMs: number | null
}
