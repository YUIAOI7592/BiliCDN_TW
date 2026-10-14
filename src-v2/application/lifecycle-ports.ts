import type { DomainEvent } from '../domain/model.ts'
import type { MonitorPort } from './monitor-ports.ts'
import type { RouteCoordinatorPort } from './route-ports.ts'
import type { SessionPort } from '../state/session-ports.ts'
import type { SettingsPort } from '../state/settings-ports.ts'
import type { SignedRouteVaultPort } from '../state/vault-ports.ts'

export interface LifecycleSessionPort extends Pick<SessionPort, 'beginGeneration' | 'get'> {}
export interface LifecycleSettingsPort extends Pick<SettingsPort, 'get' | 'subscribe'> {}
export interface LifecycleVaultPort extends Pick<SignedRouteVaultPort, 'reset'> {}
export interface LifecycleRoutesPort extends Pick<RouteCoordinatorPort, 'resetEpoch'> {}
export interface LifecycleMonitorPort extends Pick<MonitorPort, 'start' | 'stop' | 'reset'> {}
export interface LifecyclePort {
  subscribe(listener: (event: DomainEvent) => void): () => void
  start(): void
  acceptPageAssignment(payload: unknown, serial: number): boolean
  dispose(): void
}
