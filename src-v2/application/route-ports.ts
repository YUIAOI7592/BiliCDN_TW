import type {
  DecisionId,
  DomainEvent,
  FailureKind,
  MediaKind,
  PlaybackDemand,
  RepresentationId,
  RouteDecision,
  TransportObservation,
  RequestContext,
} from '../domain/model.ts'
import type { EvidencePort } from '../state/evidence-ports.ts'
import type { RestrictionPort } from '../state/restriction-ports.ts'
import type { SessionPort } from '../state/session-ports.ts'
import type { SettingsPort } from '../state/settings-ports.ts'
import type { SignedRouteVaultPort } from '../state/vault-ports.ts'
import type {
  AppliedRouteDecision,
  DecisionRecord,
  RouteSnapshot,
  StartupCandidate,
  StartupOptions,
} from './route-model.ts'

export interface RouteSessionPort extends Pick<
  SessionPort,
  'get' | 'noteDecision' | 'setAffinity' | 'setRepresentation'
> {}
export interface RouteSettingsPort extends Pick<SettingsPort, 'get'> {}
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
