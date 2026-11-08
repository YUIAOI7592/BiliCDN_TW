import { type PlaybackDemand } from '../../domain/playback-demand.ts'
import { type RequestContext } from '../../domain/transport-model.ts'
import { type PlayerControlSnapshot, type VideoSnapshot } from '../playback/player-contracts.ts'
import { type AppliedRouteDecision } from './route-contracts.ts'
/** Adapter-owned qualified request; no URL, Range or native object crosses this port. */
export interface InFlightVideoSample {
  readonly ageMs?: number
  readonly request: RequestContext
  readonly loadedBytes: number
  readonly totalBytes: number
  /** Non-null only after a trusted/native observation window of one to two seconds. */
  readonly recentBytesPerSec: number | null
}

export interface EarlyRetryAlternative {
  readonly safePayloadMbps?: number | null
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
  readonly catalogOnly: boolean
  readonly fixedHost: boolean
  readonly visible: boolean
  readonly recovering: boolean
  readonly stableProgressTicks: number
  readonly video: VideoSnapshot
  readonly controls: PlayerControlSnapshot
  readonly demand: PlaybackDemand | null
}

export interface EarlyRetrySnapshot {
  readonly state: EarlyRetryState
  readonly reason: string
  readonly host: string | null
  readonly attempts: number
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
  alternatives(request: RequestContext, demand: PlaybackDemand): readonly EarlyRetryAlternative[]
  prepare(request: RequestContext, host: string, demand: PlaybackDemand): EarlyRetryPermit | null
  revoke(permit: EarlyRetryPermit): void
}

export interface EarlyRetryPort {
  tick(status: EarlyRetryStatus): void
  reset(): void
  cancel(reason?: string): void
  dispose(): void
  snapshot(): EarlyRetrySnapshot
}

/** Only the XHR adapter may apply a permit after its private exact Range comparison. */
export interface EarlyRetryRoutingPort {
  applyEarlyRetry(url: string, permit: EarlyRetryPermit): AppliedRouteDecision | null
  acceptEarlyRetry(permit: EarlyRetryPermit, request: RequestContext): boolean
  revokeEarlyRetry(permit: EarlyRetryPermit): void
  earlyRetryRequestCurrent(request: RequestContext): boolean
}

export const EARLY_RETRY_STATES = Object.freeze([
  'idle',
  'waiting',
  'armed',
  'timedout',
  'claimed',
  'dispatched',
  'complete',
  'cancelled',
  'suspended',
] as const)
export type EarlyRetryState = (typeof EARLY_RETRY_STATES)[number]
const reasons: readonly string[] = Object.freeze([
  'not-started',
  'stable-progress',
  'episode-used',
  'document-quota',
  'no-qualified-request',
  'no-alternative',
  'invalid-input',
  'request-young',
  'mostly-complete',
  'buffer-window',
  'unknown-rate',
  'adequate-current',
  'alternative-evidence',
  'alternative-capacity',
  'alternative-timing',
  'alternative-late',
  'current-finishes-in-time',
  'insufficient-benefit',
  'eligible',
  'native-timeout-armed',
  'native-timeout-observed',
  'website-retry-claimed',
  'website-retry-dispatched',
  'website-retry-succeeded',
  'website-retry-failed',
  'retry-completion-timeout',
  'handoff-lost',
  'handoff-expired',
  'native-timeout-unavailable',
  'port-failure',
  'owner-changed',
  'disabled-setting',
  'disabled',
  'route-mode',
  'hidden',
  'recovering',
  'playback-state',
  'user-operation',
  'unknown-demand',
  'cancelled',
  'lifecycle-reset',
  'disposed',
  'settings',
  'route-policy',
  'monitor-stop',
])
export const earlyRetryReason = (value: string): string =>
  reasons.includes(value) ? value : 'unknown'
