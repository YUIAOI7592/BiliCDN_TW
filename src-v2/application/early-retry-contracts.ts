import { type PlaybackDemand, type RequestContext } from '../domain/model.ts'
import { type PlayerControlSnapshot, type VideoSnapshot } from './ports.ts'
import { type AppliedRouteDecision } from './route-contracts.ts'
/** Adapter-owned qualified request; no URL, Range or native object crosses this port. */
export interface InFlightVideoSample {
  readonly request: RequestContext
  readonly loadedBytes: number
  readonly totalBytes: number
  /** Non-null only after a trusted/native observation window of one to two seconds. */
  readonly recentBytesPerSec: number | null
}

export interface EarlyRetryAlternative {
  readonly host: string
  readonly safeMbps: number
  readonly ttfbMs: number
  readonly successCount: number
  readonly oldestAt: number
}

export interface EarlyRetryPermit {
  readonly id: string
  readonly expiresAt: number
}

export type EarlyRetryActionState =
  'pending' | 'timedout' | 'dispatched' | 'succeeded' | 'failed' | 'expired'

export interface EarlyRetryStatus {
  readonly enabled: boolean
  readonly disabled: boolean
  readonly originalComparison: boolean
  readonly catalogOnly: boolean
  readonly fixedHost: boolean
  readonly visible: boolean
  readonly recovering: boolean
  readonly stableProgressSec: number
  readonly video: VideoSnapshot
  readonly controls: PlayerControlSnapshot
  readonly demand: PlaybackDemand | null
}

export interface EarlyRetrySnapshot {
  readonly state: import('../domain/early-retry-diagnostic.ts').EarlyRetryState
  readonly reason: string
  readonly host: string | null
  readonly attempts: number
  readonly history: readonly {
    readonly at: number
    readonly state: EarlyRetrySnapshot['state']
    readonly reason: string
    readonly host: string | null
  }[]
}

export interface EarlyRetryObservation {
  readonly at: number
  readonly state: 'timedout' | 'claimed'
}

export interface InFlightVideoPort {
  observations?(permit: EarlyRetryPermit): readonly EarlyRetryObservation[]
  samples(now: number): readonly InFlightVideoSample[]
  arm(requestId: string, permit: EarlyRetryPermit): boolean
  state(permit: EarlyRetryPermit): EarlyRetryActionState | null
  cancel(permit?: EarlyRetryPermit): void
}

export interface RouteEarlyRetryPort {
  alternative(request: RequestContext, demand: PlaybackDemand): EarlyRetryAlternative | null
  prepare(request: RequestContext, host: string, demand: PlaybackDemand): EarlyRetryPermit | null
  revoke(permit: EarlyRetryPermit): void
}

export interface EarlyRetryPort {
  tick(status: EarlyRetryStatus): void
  reset(): void
  cancel(reason?: string): void
  dispose(): void
  snapshot(): EarlyRetrySnapshot
  subscribe(listener: (snapshot: EarlyRetrySnapshot) => void): () => void
}

/** Only the XHR adapter may apply a permit after its private exact Range comparison. */
export interface EarlyRetryRoutingPort {
  applyEarlyRetry(url: string, permit: EarlyRetryPermit): AppliedRouteDecision | null
  acceptEarlyRetry(permit: EarlyRetryPermit, request: RequestContext): boolean
  revokeEarlyRetry(permit: EarlyRetryPermit): void
  earlyRetryRequestCurrent(request: RequestContext): boolean
}

/** A tool-owned, in-memory scope; never exposed through diagnostics, DOM or page messages. */
export interface EarlyRetryEvidenceControlPort {
  suppressEarlyRetryEvidence(requestIds: readonly string[]): () => void
}
