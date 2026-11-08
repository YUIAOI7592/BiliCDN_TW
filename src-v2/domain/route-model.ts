import { type PredictionReason } from './route-completion.ts'
import { type RouteState, type CapacityConfidence } from './evidence-model.ts'
import {
  type GenerationId,
  type EpochId,
  type RepresentationId,
  type DecisionId,
  type SignedRouteHandle,
  type MediaKind,
} from './model.ts'
export type RouteType = 'catalog-generated' | 'native-signed' | 'root-original'

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

export interface RouteAffinity {
  readonly type: RouteType
  readonly host: string
  readonly confirmedAt: number
  readonly decisionId: DecisionId
  readonly representation: RepresentationId | null
}
