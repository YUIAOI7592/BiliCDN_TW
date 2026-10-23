import type { PlayerPort } from './ports.ts'
import type { RouteCoordinatorPort } from './route-ports.ts'
import type { MeasurementPort } from './measurement-ports.ts'
import type { RecoveryPort } from './recovery-ports.ts'
import type { SessionPort } from '../state/session-ports.ts'
import type { SignedRouteVaultPort } from '../state/vault-ports.ts'
import type { RequestContext } from '../domain/model.ts'
import type { MonitorSnapshot } from './monitor-model.ts'
import type { BufferCompletion } from '../domain/buffer-trend.ts'

export interface ObservedVideoCompletion extends BufferCompletion {
  readonly request: Pick<
    RequestContext,
    | 'requestId'
    | 'generation'
    | 'epoch'
    | 'representation'
    | 'routePolicyRevision'
    | 'authorityRevision'
    | 'targetHost'
  >
}

export interface MonitorRoutes extends Pick<
  RouteCoordinatorPort,
  'observePlaybackRate' | 'isOriginalComparison' | 'firstMediaAt'
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
  > | null
  recoveryEligible: RouteCoordinatorPort['recoveryEligible']
  recover(...args: Parameters<RouteCoordinatorPort['recover']>): unknown
  recoverStartup(
    ...args: Parameters<RouteCoordinatorPort['recoverStartup']>
  ): { readonly host: string | null } | null
}
export interface MonitorPlayerPort extends Pick<
  PlayerPort,
  'controls' | 'snapshot' | 'syncManifest'
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
  observeTransport(observation: ObservedVideoCompletion): void
  start(): void
  stop(): void
  reset(): void
  snapshot(): MonitorSnapshot
  dispose(): void
  subscribe(listener: (snapshot: MonitorSnapshot) => void): () => void
  tick(): void
}
