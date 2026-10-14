import type { RouteCoordinatorPort } from './route-ports.ts'
import type { MeasurementMetaPort } from '../state/measurement-meta-ports.ts'
import type { MeasurementStatus, MeasurementSnapshot } from './measurement-model.ts'

export interface MeasurementRoutes extends Pick<
  RouteCoordinatorPort,
  | 'startupOptions'
  | 'noteStartupProbeResult'
  | 'recordStartupSuccess'
  | 'challenge'
  | 'isCatalogOnly'
  | 'recordChallenge'
> {
  commitStartupChoice(
    ...args: Parameters<RouteCoordinatorPort['commitStartupChoice']>
  ): { readonly host: string | null } | null
}
export interface MeasurementMetadataPort extends Pick<
  MeasurementMetaPort,
  'get' | 'update' | 'withLock'
> {}
export interface MeasurementPort {
  snapshot(): MeasurementSnapshot
  reset(): void
  requestManual(): void
  dispose(): void
  startupFallbackHosts(): readonly string[]
  cancel(reason: string): void
  willGateStartup(url: string): boolean
  prepareStartup(url: string, signal?: AbortSignal | null): Promise<void>
  noteUnpreflighted(reason: string): void
  tick(status: MeasurementStatus): void
}
