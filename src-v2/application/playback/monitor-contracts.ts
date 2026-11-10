import { type VideoSnapshot, type PlayerPort } from './player-contracts.ts'
import { type RouteCoordinatorPort } from '../routing/route-contracts.ts'
import { type MeasurementPort } from '../measurement/measurement-contracts.ts'
import { type RecoveryPort } from './recovery-contracts.ts'
import { type SessionPort } from '../../state/session-contracts.ts'
import { type SignedRouteVaultPort } from '../../state/vault-contracts.ts'
import { type RequestContext } from '../../domain/transport-model.ts'
import { type RoutePlaybackFacts } from '../../domain/playback-demand.ts'
import { type ProgressObservation } from '../../domain/playback-progress.ts'
export interface MonitorSnapshot {
  readonly routingPlayback?: RoutePlaybackFacts | null
  readonly video: VideoSnapshot
  readonly stableProgressTicks: number
  readonly stableProgressMs: number
  readonly progressObservation: ProgressObservation
  readonly recoveryActive: boolean
  readonly watchdog:
    | 'no-video'
    | 'paused'
    | 'seek-grace'
    | 'buffered-to-end'
    | 'healthy'
    | 'low-buffer'
    | 'recovering'
    | 'observing'
  readonly stall?: {
    readonly id: number
    readonly phase: 'stalled' | 'confirming' | 'settling' | 'stable-retained'
    readonly action: 'waiting' | 'armed' | 'spent'
    readonly startedAt: number
    readonly fallbackAt: number
    readonly reloadAt: number
    readonly fallbackAvailable: boolean
  } | null
  readonly stallTicks: number
  readonly startupRescue: {
    readonly state: 'watching' | 'not-needed' | 'fallback-submitted' | 'no-alternative'
    readonly ageSec: number
  }
}

export interface MonitorRoutes extends Pick<
  RouteCoordinatorPort,
  'observePlaybackRate' | 'firstMediaAt'
> {
  latestRequested(
    kind: 'video' | 'audio',
  ): Pick<
    RequestContext,
    | 'generation'
    | 'epoch'
    | 'representation'
    | 'targetHost'
    | 'routePolicyRevision'
    | 'authorityRevision'
    | 'selectionRevision'
    | 'expectedBytes'
  > | null
  recoveryEligible: RouteCoordinatorPort['recoveryEligible']
  recover(...args: Parameters<RouteCoordinatorPort['recover']>): unknown
  recoverStartup(
    ...args: Parameters<RouteCoordinatorPort['recoverStartup']>
  ): { readonly host: string | null } | null
}
export interface MonitorPlayerPort extends Pick<
  PlayerPort,
  'controls' | 'snapshot' | 'syncManifest' | 'playbackRevision'
> {}
export interface MonitorSessionPort extends Pick<SessionPort, 'get'> {}
export interface MonitorVaultPort extends Pick<SignedRouteVaultPort, 'groupSummary'> {}
export interface MonitorMeasurementPort extends Pick<
  MeasurementPort,
  'tick' | 'cancel' | 'startupFallbackHosts'
> {}
export interface MonitorRecoveryPort extends Pick<
  RecoveryPort,
  | 'tick'
  | 'isRecovering'
  | 'armStartupFailure'
  | 'armStall'
  | 'cancelStall'
  | 'rejectStall'
  | 'snapshot'
  | 'ongoingStallReload'
> {}
export interface MonitorPort {
  start(): void
  stop(): void
  reset(): void
  snapshot(): MonitorSnapshot
  dispose(): void
  subscribe(listener: (snapshot: MonitorSnapshot) => void): () => void
  tick(): void
}
