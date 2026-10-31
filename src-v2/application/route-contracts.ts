import {
  type AttributionSource,
  type AttributionStatus,
  type DecisionId,
  type MediaKind,
  type PlaybackDemand,
  type PlayurlOutputSummary,
  type RecoveryActionId,
  type RepresentationId,
  type RequestContext,
  type RouteDecision,
  type RouteIdentity,
  type RouteType,
  type TransportObservation,
  type DomainEvent,
  type FailureKind,
} from '../domain/model.ts'
import { type SessionSnapshot, type SessionPort } from '../state/session-contracts.ts'
import { type VaultGroupSnapshot, type SignedRouteVaultPort } from '../state/vault-contracts.ts'
import { type EvidencePort } from '../state/evidence-ports.ts'
import { type RestrictionPort } from '../state/restriction-contracts.ts'
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

export interface RouteSessionPort extends Pick<
  SessionPort,
  'get' | 'noteDecision' | 'setAffinity' | 'setRepresentation'
> {}
export interface RouteRestrictionsPort extends Pick<RestrictionPort, 'snapshot'> {}
export interface RouteEvidencePort extends Pick<EvidencePort, 'get' | 'record'> {}
export interface RouteVaultPort extends Pick<
  SignedRouteVaultPort,
  | 'candidates'
  | 'catalogSourceHandle'
  | 'groupSummary'
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
  isOriginalComparison(): boolean
  policyRevision(): number
  isCatalogOnly(): boolean
  setOriginalComparison(enabled: boolean): void
  requestStarted(request: RequestContext): void
  observePlaybackRate(rate: number): void
  playbackRate(): number
  firstMediaAt(): number
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
  startupOptions(url: string, catalogCursor?: number): StartupOptions | null
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
  ): Promise<void>
  latestVideoHost(): string | null
  unlockNative(representation: RepresentationId, host: string): void
  plan(
    representation: RepresentationId,
    demand: PlaybackDemand,
    boundary:
      'startup' | 'new-epoch' | 'representation' | 'verified-failure' | 'watchdog' | 'user-setting',
    failedHost?: string | null,
  ): RouteDecision
  recover(
    representation: RepresentationId,
    demand: PlaybackDemand,
    boundary: 'verified-failure' | 'watchdog',
    failedHost: string | null,
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
  recordChallenge(
    applied: AppliedRouteDecision,
    bytes: number,
    elapsedMs: number,
    ttfbMs: number | null,
    outcome: 'success' | 'failure',
    failureKind: FailureKind | null,
    workCurrent?: () => boolean,
  ): Promise<void>
  observe(observation: TransportObservation): Promise<void>
  snapshot(): RouteSnapshot
}
