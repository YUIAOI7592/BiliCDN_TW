import { type TimingBasis } from './measurement-time.ts'
import { type MediaKind } from './model.ts'
export type RouteState = 'unknown' | 'usable' | 'proven' | 'degraded' | 'circuit-open' | 'forbidden'

export type EvidenceSource = 'transport' | 'challenge'

export type CapacityConfidence =
  'missing' | 'provisional' | 'sufficient' | 'historical' | 'revalidation'

export type FailureKind = 'network' | 'body' | 'timeout' | 'http-5xx' | 'native-invalid'

export interface EvidenceSample {
  readonly timingBasis?: TimingBasis
  readonly requestId: string
  readonly at: number
  readonly source: EvidenceSource
  readonly outcome: 'success' | 'failure'
  readonly throughputMbps: number | null
  readonly ttfbMs: number | null
  readonly failureKind: FailureKind | null
  readonly bytes?: number
  readonly elapsedMs?: number
}

export interface CircuitControlStamp {
  readonly generation: string
  readonly recordId: string
  readonly revision: number
}

export interface CircuitRecordControl {
  readonly recordId: string
  readonly revision: number
  readonly lastCommitId: string | null
}

export interface CircuitObservationSnapshot {
  readonly host: string
  readonly kind: MediaKind
  readonly level: number
  readonly until: number
  readonly phase: 'clear' | 'isolated' | 'awaiting' | 'observing' | 'settling'
  readonly reason: string
  readonly progressSec: number
  readonly remainingSec: number | null
}

export interface RouteEvidence {
  readonly circuitControl?: CircuitRecordControl
  readonly host: string
  readonly kind: MediaKind
  readonly samples: readonly EvidenceSample[]
  readonly circuitLevel: number
  readonly circuitUntil: number
  readonly updatedAt: number
}

export interface EvidenceMetrics {
  readonly state: RouteState
  readonly safeThroughputMbps: number | null
  readonly medianTtfbMs: number | null
  readonly successCount: number
  readonly failureCount: number
  readonly speedSampleCount: number
  readonly freshSpeedCount: number
  readonly capacityConfidence: CapacityConfidence
  readonly newestSpeedAt: number | null
  readonly revalidationRequired: boolean
  readonly safePayloadMbps: number | null
  readonly predictionTtfbMs: number | null
}
