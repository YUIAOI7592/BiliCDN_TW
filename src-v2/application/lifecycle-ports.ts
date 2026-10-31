import type { MonitorPort } from './monitor-contracts.ts'
import type { RouteCoordinatorPort } from './route-contracts.ts'
import type { SessionPort } from '../state/session-contracts.ts'
import type { SignedRouteVaultPort } from '../state/vault-contracts.ts'

export interface LifecycleSessionPort extends Pick<SessionPort, 'beginGeneration' | 'get'> {}
export interface LifecycleVaultPort extends Pick<SignedRouteVaultPort, 'reset'> {}
export interface LifecycleRoutesPort extends Pick<RouteCoordinatorPort, 'resetEpoch'> {}
export interface LifecycleMonitorPort extends Pick<MonitorPort, 'start' | 'stop' | 'reset'> {}
export interface LifecyclePort {
  start(): void
  acceptPageAssignment(payload: unknown, serial: number): boolean
  dispose(): void
}
