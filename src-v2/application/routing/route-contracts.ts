import {
  type RequestId,
  type DecisionId,
  type MediaKind,
  type RecoveryActionId,
  type RepresentationId,
} from '../../domain/model.ts'
import {
  type AttributionSource,
  type AttributionStatus,
  type PlayurlOutputSummary,
  type RequestContext,
  type TransportObservation,
} from '../../domain/transport-model.ts'
import {
  type EvidenceSample,
  type EvidenceMetrics,
  type CapacityConfidence,
  type FailureKind,
  type CircuitObservationSnapshot,
  type CircuitControlStamp,
} from '../../domain/evidence-model.ts'
import { type CompletionBudget, type PredictionReason } from '../../domain/route-completion.ts'
import { type TimingBasis } from '../../domain/measurement-time.ts'
import { type RoutePlaybackFacts, type PlaybackDemand } from '../../domain/playback-demand.ts'
import {
  type RouteDecision,
  type RouteIdentity,
  type RouteType,
  type CatalogCandidate,
  type NativeCandidate,
} from '../../domain/route-model.ts'
import { type SessionSnapshot, type SessionPort } from '../../state/session-contracts.ts'
import { type VaultGroupSnapshot, type SignedRouteVaultPort } from '../../state/vault-contracts.ts'
import { type EvidencePort } from '../../state/evidence-ports.ts'
import { type RestrictionPort } from '../../state/restriction-contracts.ts'
import { type RevalidationClaim } from '../../state/measurement-meta-ports.ts'
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

export interface StartupCandidate {
  readonly host: string
  readonly type: RouteType
  readonly url: string
  readonly original: boolean
  readonly cachedSafeMbps: number | null
  readonly context: RouteIdentity
}

export interface ChallengePriority {
  readonly claims: readonly RevalidationClaim[]
  readonly allowNative?: boolean
}

export interface ChallengeProposal {
  readonly context: RouteIdentity
  readonly candidate: CatalogCandidate | NativeCandidate
  readonly url: string
  readonly streamKey: string | null
  readonly priorityStamp: CircuitControlStamp | null
}

export interface StartupOptions {
  readonly requestBytes?: number | null
  readonly candidates: readonly StartupCandidate[]
  readonly demand: PlaybackDemand
  readonly originalHost: string
  readonly deferredToVideo?: boolean
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
export interface CurrentRouteCapacity {
  readonly capacityConfidence: CapacityConfidence
  readonly freshSpeedCount: number
  readonly newestSpeedAt: number | null
  readonly safePayloadMbps: number | null
  readonly estimatedCompletionMs: number | null
  readonly predictionReason: PredictionReason
  readonly generation: SessionSnapshot['generation']
  readonly epoch: SessionSnapshot['epoch']
  readonly representation: RepresentationId
  readonly decisionId: DecisionId
  readonly host: string
  readonly routeType: RouteType
  readonly safeMbps: number | null
  readonly sampleStatus: 'available' | 'expired' | 'missing'
  readonly evidenceOrigin?: 'current-transport' | 'current-probe' | 'historical-cache' | null
}
export interface RouteSnapshot {
  readonly circuits: readonly CircuitObservationSnapshot[]
  readonly selection?: {
    readonly phase: 'pending' | 'confirmed'
    readonly sampleCount: number
    readonly nextAction: 'await-video-success' | 'observe-playback'
    readonly revision: number
  } | null
  readonly currentCapacity: CurrentRouteCapacity | null
  readonly activePlan:
    (RoutePlanSummary & { readonly ranking: readonly RouteRankingSummary[] }) | null
  readonly affinity: SessionSnapshot['affinity']
  readonly latest: MediaRows<RouteTransferSnapshot>
  readonly requested: MediaRows<RequestContext>
  readonly attribution: 'confirmed' | 'awaiting-second-video-transfer' | 'awaiting-matched-video'
  readonly representation: VaultGroupSnapshot | null
  readonly fallback: Readonly<Partial<Record<MediaKind, Readonly<FallbackProgress>>>>
}

export interface RouteSessionPort extends Pick<
  SessionPort,
  'get' | 'noteDecision' | 'setAffinity' | 'setRepresentation'
> {}
export interface RouteRestrictionsPort extends Pick<RestrictionPort, 'snapshot'> {}
export interface RouteEvidencePort extends Pick<
  EvidencePort,
  'get' | 'list' | 'record' | 'control' | 'commit' | 'tryDowngrade'
> {}
export interface RouteVaultPort extends Pick<
  SignedRouteVaultPort,
  | 'candidates'
  | 'catalogSourceHandle'
  | 'groupSummary'
  | 'startupMediaKind'
  | 'hosts'
  | 'identity'
  | 'invalidate'
  | 'isCurrentIdentity'
  | 'isInvalid'
  | 'match'
  | 'outputRole'
  | 'registerAlias'
  | 'registerOutput'
  | 'resolve'
  | 'rootUrl'
  | 'wasPlayerOutput'
> {}
export interface RouteCoordinatorPort {
  subscribe(listener: (event: DomainEvent) => void): () => void
  resetEpoch(): void
  invalidateForUserSetting(): void
  policyRevision(): number
  isCatalogOnly(): boolean
  prepareRequest(request: RequestContext): RequestContext
  requestStarted(request: RequestContext): void
  observePlaybackRate(rate: number): void
  playbackRate(): number
  firstMediaAt(kind?: MediaKind): number
  pendingMediaCount(): number
  latestRequested(kind: MediaKind): RequestContext | null
  recoveryEligible(
    request: Pick<
      RequestContext,
      'generation' | 'epoch' | 'representation' | 'authorityRevision' | 'routePolicyRevision'
    >,
  ): boolean
  recognizesMedia(url: string): boolean
  isBilibiliMedia(url: string): boolean
  inspectOriginal(url: string): AppliedRouteDecision
  startupOptions(
    url: string,
    catalogCursor?: number,
    requestBytes?: number | null,
  ): StartupOptions | null
  observePlaybackFacts(facts: RoutePlaybackFacts | null, revision?: number): void
  completionBudget(
    representation: RepresentationId,
    requestBytes: number | null,
    timingBasis?: TimingBasis,
  ): CompletionBudget | null
  startupDemand(candidate: StartupCandidate): PlaybackDemand | null
  startupCapacity(
    candidate: StartupCandidate,
    sample: EvidenceSample | null,
  ): EvidenceMetrics | null
  startupFallback(url: string, excludedHosts: ReadonlySet<string>): StartupCandidate | null
  noteStartupProbeResult(candidate: StartupCandidate, status: number | null): void
  commitStartupChoice(
    url: string,
    selected: StartupCandidate | null,
    reason: string,
  ): RouteDecision | null
  recordStartupSuccess(
    candidate: StartupCandidate,
    bytes: number,
    elapsedMs: number,
    ttfbMs: number | null,
    workCurrent?: () => boolean,
    measurement?: Pick<TransportObservation, 'timingBasis' | 'speedEligible'>,
  ): Promise<void>
  unlockNative(representation: RepresentationId, host: string): void
  plan(
    representation: RepresentationId,
    demand: PlaybackDemand,
    boundary:
      'startup' | 'new-epoch' | 'representation' | 'verified-failure' | 'watchdog' | 'user-setting',
    failedHost?: string | null,
    requestBytes?: number | null,
    timingBasis?: TimingBasis,
  ): RouteDecision
  recover(
    representation: RepresentationId,
    demand: PlaybackDemand,
    boundary: 'verified-failure' | 'watchdog',
    failedHost: string | null,
    requestBytes?: number | null,
    timingBasis?: TimingBasis,
  ): RouteDecision
  recoverStartup(
    representation: RepresentationId,
    demand: PlaybackDemand,
    failedHost: string,
    preferredHosts: readonly string[],
  ): RouteDecision | null
  apply(
    url: string,
    kindHint?: MediaKind | null,
    demand?: PlaybackDemand,
    trustedPlayurl?: boolean,
    requestBytes?: number | null,
    timingBasis?: TimingBasis,
  ): AppliedRouteDecision
  decisionRecord(id: DecisionId | null): DecisionRecord | null
  opaqueOutput(
    representation: RepresentationId,
    original: string,
    originals: readonly string[],
    source: 'trusted-api' | 'page-hint',
  ): { primary: string; backups: readonly string[] }
  playerOutput(
    representation: RepresentationId,
    original: string,
    decision: RouteDecision,
    originals: readonly string[],
    source?: 'trusted-api' | 'page-hint',
    recordOutput?: boolean,
  ): { primary: string; backups: readonly string[] }
  challenge(
    representation: RepresentationId,
    _demand: PlaybackDemand,
    preferNative: boolean,
    excludedHosts?: ReadonlySet<string>,
    catalogCursor?: number,
  ): AppliedRouteDecision | null
  proposeChallenge(
    representation: RepresentationId,
    demand: PlaybackDemand,
    preferNative: boolean,
    excludedHosts?: ReadonlySet<string>,
    catalogCursor?: number,
    priority?: ChallengePriority,
  ): ChallengeProposal | null
  commitChallenge(
    proposal: ChallengeProposal,
    priorityClaimed?: boolean,
  ): AppliedRouteDecision | null
  recordChallenge(
    applied: AppliedRouteDecision,
    bytes: number,
    elapsedMs: number,
    ttfbMs: number | null,
    outcome: 'success' | 'failure',
    failureKind: FailureKind | null,
    workCurrent?: () => boolean,
    measurement?: Pick<TransportObservation, 'timingBasis' | 'speedEligible'>,
  ): Promise<void>
  observe(observation: TransportObservation): Promise<void>
  snapshot(): RouteSnapshot
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
