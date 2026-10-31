import type { DomainEvent } from '../domain/model.ts'
import type { PlayerPort } from './ports.ts'
import type { RouteCoordinatorPort } from './route-contracts.ts'
import type { MeasurementPort } from './measurement-contracts.ts'
import type { RecoveryPort } from './recovery-contracts.ts'
import type { MonitorPort } from './monitor-contracts.ts'
import type { PlayurlControllerPort } from './playurl-contracts.ts'

export interface RuntimeRoutesPort extends Pick<
  RouteCoordinatorPort,
  'subscribe' | 'invalidateForUserSetting' | 'latestRequested' | 'recoveryEligible'
> {}
export interface RuntimePlayerPort extends Pick<PlayerPort, 'snapshot' | 'reset'> {}
export interface RuntimeMonitorPort extends Pick<MonitorPort, 'start' | 'stop' | 'reset'> {}
export interface RuntimeMeasurementPort extends Pick<MeasurementPort, 'reset'> {}
export interface RuntimeRecoveryPort extends Pick<RecoveryPort, 'reset' | 'armRouteFailure'> {}
export interface RuntimeContentPort extends Pick<PlayurlControllerPort, 'subscribeEpoch'> {}
export interface RuntimePort {
  install(): void
  handleRouteEvent(event: DomainEvent): void
  start(): void
  stop(): void
  reset(): void
  dispose(): void
}
