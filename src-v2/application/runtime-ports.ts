import type { DomainEvent } from '../domain/model.ts'
import type { PlaybackDiagnosticSample } from '../domain/diagnostic-model.ts'
import type { SessionPort } from '../state/session-ports.ts'
import type { SettingsPort } from '../state/settings-ports.ts'
import type { PlayerPort } from './ports.ts'
import type { RouteCoordinatorPort } from './route-ports.ts'
import type { MeasurementPort } from './measurement-ports.ts'
import type { RecoveryPort } from './recovery-ports.ts'
import type { MonitorPort } from './monitor-ports.ts'
import type { PlayurlControllerPort } from './playurl-ports.ts'

export interface RuntimeDiagnosticPort {
  record(event: DomainEvent, routeObservationEnabled: boolean): void
  recordPlayer(sample: PlaybackDiagnosticSample): void
}
export interface RuntimeSessionPort extends Pick<SessionPort, 'get'> {}
export interface RuntimeSettingsPort extends Pick<SettingsPort, 'get' | 'subscribe'> {}
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
