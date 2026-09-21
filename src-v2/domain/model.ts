export type Brand<T, Name extends string> = T & { readonly __brand: Name }

export type GenerationId = Brand<number, 'GenerationId'>
export type EpochId = Brand<number, 'EpochId'>
export type RepresentationId = Brand<string, 'RepresentationId'>
export type DecisionId = Brand<string, 'DecisionId'>
export type RecoveryActionId = Brand<string, 'RecoveryActionId'>
export type SignedRouteHandle = Brand<string, 'SignedRouteHandle'>

export type MediaKind = 'video' | 'audio'
export type RouteType = 'catalog-generated' | 'native-signed' | 'root-original'
export type RouteState = 'unknown' | 'usable' | 'proven' | 'degraded' | 'circuit-open' | 'forbidden'
export type EvidenceSource = 'transport' | 'challenge'
export type FailureKind = 'network' | 'body' | 'timeout' | 'http-5xx' | 'native-invalid'

export interface RouteIdentity {
  readonly generation: GenerationId
  readonly epoch: EpochId
  readonly representation: RepresentationId
  readonly kind: MediaKind
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

export interface RouteRankingEntry {
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
  readonly generation: GenerationId
  readonly epoch: EpochId
  readonly decisionId: DecisionId | null
  readonly representation: RepresentationId | null
  readonly kind: MediaKind | null
  readonly routeType: RouteType
  readonly originalHost: string
  readonly targetHost: string
  readonly finalHost: string | null
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
  readonly requestId: string
  readonly at: number
  readonly source: EvidenceSource
  readonly outcome: 'success' | 'failure'
  readonly throughputMbps: number | null
  readonly ttfbMs: number | null
  readonly failureKind: FailureKind | null
}

export interface RouteEvidence {
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

export interface RouteAffinity {
  readonly type: RouteType
  readonly host: string
  readonly confirmedAt: number
  readonly decisionId: DecisionId
  readonly representation: RepresentationId | null
}

export type RecoveryAction =
  | { readonly action: 'route-fallback'; readonly id: RecoveryActionId; readonly kind: MediaKind; readonly decision: RouteDecision }
  | { readonly action: 'player-reload'; readonly id: RecoveryActionId; readonly savedPositionSec: number; readonly savedRate: number }
  | { readonly action: 'none'; readonly id: RecoveryActionId; readonly reason: string }

export type DomainEvent =
  | { readonly type: 'route-decision'; readonly at: number; readonly decision: RouteDecision }
  | { readonly type: 'transport'; readonly at: number; readonly observation: TransportObservation }
  | { readonly type: 'route-observed'; readonly at: number; readonly routeType: RouteType; readonly host: string; readonly decisionId: DecisionId | null }
  | { readonly type: 'recovery'; readonly at: number; readonly action: RecoveryAction }
  | { readonly type: 'core'; readonly at: number; readonly state: 'healthy' | 'waiting' | 'reloading' | 'recovered' | 'failed'; readonly actionId: RecoveryActionId | null }
  | { readonly type: 'lifecycle'; readonly at: number; readonly generation: GenerationId; readonly epoch: EpochId; readonly reason: string }

export interface Clock {
  now(): number
}

export const generationId = (value: number): GenerationId => value as GenerationId
export const epochId = (value: number): EpochId => value as EpochId
export const representationId = (value: string): RepresentationId => value as RepresentationId
export const decisionId = (value: string): DecisionId => value as DecisionId
export const recoveryActionId = (value: string): RecoveryActionId => value as RecoveryActionId
export const signedRouteHandle = (value: string): SignedRouteHandle => value as SignedRouteHandle
