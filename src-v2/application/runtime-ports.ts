import type { DomainEvent } from '../domain/model.ts'
import type { PlaybackDiagnosticSample } from '../domain/diagnostic-model.ts'
import type { SessionPort } from '../state/session-contracts.ts'
import type { PlayerPort } from './ports.ts'
import type { RouteCoordinatorPort } from './route-contracts.ts'
import type { MeasurementPort } from './measurement-contracts.ts'
import type { RecoveryPort } from './recovery-contracts.ts'
import type { MonitorPort } from './monitor-contracts.ts'
import type { PlayurlControllerPort } from './playurl-contracts.ts'

export interface RuntimeDiagnosticPort {
  record(event: DomainEvent, routeObservationEnabled: boolean): void
  recordPlayer(sample: PlaybackDiagnosticSample): void
}
export interface RuntimeSessionPort extends Pick<SessionPort, 'get'> {}
export interface RuntimeRoutesPort extends Pick<
  RouteCoordinatorPort,
  | 'subscribe'
  | 'isOriginalComparison'
  | 'invalidateForUserSetting'
  | 'latestRequested'
  | 'recoveryEligible'
> {}
export interface RuntimePlayerPort extends Pick<PlayerPort, 'snapshot' | 'reset'> {}
export interface RuntimeMonitorPort extends Pick<
  MonitorPort,
  'subscribe' | 'snapshot' | 'start' | 'stop' | 'reset' | 'observeTransport'
> {}
export interface RuntimeMeasurementPort extends Pick<MeasurementPort, 'reset'> {}
export interface RuntimeRecoveryPort extends Pick<
  RecoveryPort,
  'subscribe' | 'reset' | 'armRouteFailure'
> {}
export interface RuntimeContentPort extends Pick<PlayurlControllerPort, 'subscribeEpoch'> {}
export interface RuntimePort {
  install(): void
  record(event: DomainEvent): void
  start(): void
  stop(): void
  reset(): void
  dispose(): void
}
