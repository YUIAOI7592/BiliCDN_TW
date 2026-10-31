import {
  type AttributionSource,
  type AttributionStatus,
  type DecisionId,
  type EpochId,
  type GenerationId,
  type MediaKind,
  type NativeCandidate,
  type RepresentationId,
  type RootCandidate,
  type RouteIdentity,
  type SignedRouteHandle,
} from '../domain/model.ts'
export interface RegisterRepresentationInput {
  readonly generation: GenerationId
  readonly epoch: EpochId
  readonly kind: MediaKind
  readonly key: string
  readonly height: number
  readonly codec: string
  readonly bandwidth: number
  readonly urls: readonly string[]
  readonly source: 'trusted-api' | 'player-mpd' | 'page-hint' | 'transport'
  readonly refreshTrustedSources?: boolean
}

export interface OutputRole {
  readonly representation: RepresentationId
  readonly role: 'primary' | 'backup'
  readonly hostChanged: boolean
  readonly originalHost: string
  readonly outputHost: string
  readonly source: 'trusted-api' | 'page-hint'
  readonly decisionId: DecisionId
  readonly catalogGenerated: boolean
}

export interface VaultGroupSnapshot {
  readonly kind: MediaKind
  readonly height: number
  readonly codec: string
  readonly bandwidth: number
  readonly routeCount: number
}

export interface VaultMatch {
  readonly context: RouteIdentity | null
  readonly status: AttributionStatus
  readonly source: AttributionSource
}

export interface VaultCandidates {
  readonly native: readonly NativeCandidate[]
  readonly root: RootCandidate | null
}

export interface SignedRouteVaultPort {
  reset(generation: GenerationId, epoch: EpochId): void
  register(input: RegisterRepresentationInput): RepresentationId | null
  source(representation: RepresentationId): RegisterRepresentationInput['source'] | null
  isCurrentIdentity(identity: RouteIdentity): boolean
  contextForUrl(url: string): RouteIdentity | null
  match(url: string): VaultMatch
  registerAlias(rep: RepresentationId, url: string): void
  registerOutput(
    rep: RepresentationId,
    original: string,
    primary: string,
    backups: readonly string[],
    decisionId: DecisionId,
    source: 'trusted-api' | 'page-hint',
    catalogGenerated?: boolean,
  ): void
  outputRole(rep: RepresentationId, url: string): Omit<OutputRole, 'representation'> | null
  wasPlayerOutput(url: string): boolean
  candidates(representation: RepresentationId, unlockedHosts: ReadonlySet<string>): VaultCandidates
  identity(representation: RepresentationId): RouteIdentity | null
  hosts(representation: RepresentationId): readonly string[]
  invalidate(representation: RepresentationId, host: string): void
  isInvalid(representation: RepresentationId, host: string): boolean
  rootUrl(representation: RepresentationId): string | null
  catalogSourceHandle(representation: RepresentationId): SignedRouteHandle | null
  sourceURLs(representation: RepresentationId): readonly string[]
  resolve(handle: SignedRouteHandle, identity: RouteIdentity): string | null
  groupSummary(representation: RepresentationId): VaultGroupSnapshot | null
  rangeSize(identity: RouteIdentity, handle: SignedRouteHandle): number | null
  recordRangeSize(
    identity: RouteIdentity,
    handle: SignedRouteHandle,
    totalBytes: number | null,
  ): void
}
