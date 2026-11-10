import { type ProbeRange } from '../../domain/probe-range.ts'
import { type ProgressObservation } from '../../domain/playback-progress.ts'
import { type TimingBasis } from '../../domain/measurement-time.ts'
import { type PlaybackDemand } from '../../domain/playback-demand.ts'
import { type RepresentationId } from '../../domain/model.ts'
import { type RouteCoordinatorPort } from '../routing/route-contracts.ts'
import { type MeasurementMetaPort } from '../../state/measurement-meta-ports.ts'
import { type SignedRouteVaultPort } from '../../state/vault-contracts.ts'
export interface MeasurementStatus {
  readonly generationActive: boolean
  readonly representation: RepresentationId | null
  readonly demand: PlaybackDemand | null
  readonly stableProgressTicks: number
  readonly stableProgressMs: number
  readonly progressObservation: ProgressObservation
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
    readonly state: 'idle' | 'reserved' | 'running' | 'complete' | 'skipped' | 'cancelled'
    readonly result?: 'adequate' | 'insufficient' | 'unverified' | 'none'
    readonly deadlineAt?: number
    readonly remainingProbes?: number
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
  | 'startupCapacity'
  | 'startupDemand'
  | 'completionBudget'
  | 'startupFallback'
  | 'noteStartupProbeResult'
  | 'recordStartupSuccess'
  | 'challenge'
  | 'isCatalogOnly'
  | 'recordChallenge'
> {
  proposeChallenge?: RouteCoordinatorPort['proposeChallenge']
  commitChallenge?: RouteCoordinatorPort['commitChallenge']
  commitStartupChoice(
    ...args: Parameters<RouteCoordinatorPort['commitStartupChoice']>
  ): { readonly host: string | null } | null
}
export interface MeasurementMetadataPort extends Pick<
  MeasurementMetaPort,
  'get' | 'update' | 'withLock' | 'coordination' | 'coordinationCurrent' | 'claimRevalidation'
> {}
export interface MeasurementPort {
  snapshot(): MeasurementSnapshot
  reset(): void
  dispose(): void
  startupFallbackHosts(): readonly string[]
  cancel(reason: string): void
  willGateStartup(url: string): boolean
  prepareStartup(
    url: string,
    signal?: AbortSignal | null,
    requestBytes?: number | null,
  ): Promise<void>
  noteUnpreflighted(reason: string): void
  tick(status: MeasurementStatus): void
}

export interface RangeProbeInput {
  readonly url: string
  readonly host: string | null
  readonly limit: number
  readonly startByte?: number
  readonly signal: AbortSignal
  readonly completionReason: string
}

export interface RangeProbeResult {
  readonly receivedBytes?: number
  readonly payloadValid?: boolean
  readonly speedEligible?: boolean
  readonly timingBasis?: TimingBasis
  readonly range?: ProbeRange | null
  readonly bytes: number
  readonly elapsedMs: number
  readonly ttfbMs: number | null
  readonly status: number | null
  readonly directRange: boolean
  readonly reason: string
}

export interface RangeProbePort {
  read(input: RangeProbeInput): Promise<RangeProbeResult>
}
