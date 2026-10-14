import type {
  AttributionSource,
  AttributionStatus,
  DecisionId,
  EpochId,
  GenerationId,
  MediaKind,
  NativeCandidate,
  RepresentationId,
  RootCandidate,
  RouteIdentity,
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
