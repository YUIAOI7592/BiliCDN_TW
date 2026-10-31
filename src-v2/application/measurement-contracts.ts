import { type PlaybackDemand, type RepresentationId } from '../domain/model.ts'
import { type RouteCoordinatorPort } from './route-contracts.ts'
import { type MeasurementMetaPort } from '../state/measurement-meta-ports.ts'
import { type SignedRouteVaultPort } from '../state/vault-contracts.ts'
export interface MeasurementStatus {
  readonly generationActive: boolean
  readonly representation: RepresentationId | null
  readonly demand: PlaybackDemand | null
  readonly stableProgressSec: number
  readonly playableBufferSec: number
  readonly visible: boolean
  readonly seeking: boolean
  readonly recovering: boolean
  readonly disabled: boolean
}
export interface MeasurementSnapshot {
  readonly state: 'idle' | 'waiting' | 'running' | 'complete' | 'failed' | 'cancelled'
  readonly reason: string
  readonly lastAttemptAt: number
  readonly host: string | null
  readonly range?: { readonly mode: 'head' | 'middle'; readonly sizeKnown: boolean }
  readonly startup?: {
    readonly state: string
    readonly reason: string
    readonly candidates: number
    readonly selectedHost: string | null
    readonly delayed: boolean
    readonly elapsedMs?: number
    readonly results?: readonly {
      readonly host: string
      readonly type: string
      readonly valid: boolean
      readonly safeMbps: number | null
      readonly status: number | null
      readonly reason: string
    }[]
  }
}

export interface MeasurementRangeMetadataPort extends Pick<
  SignedRouteVaultPort,
  'catalogSourceHandle' | 'resolve' | 'rangeSize' | 'recordRangeSize'
> {}

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
  dispose(): void
  startupFallbackHosts(): readonly string[]
  cancel(reason: string): void
  willGateStartup(url: string): boolean
  prepareStartup(url: string, signal?: AbortSignal | null): Promise<void>
  noteUnpreflighted(reason: string): void
  tick(status: MeasurementStatus): void
}
