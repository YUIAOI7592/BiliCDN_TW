export type TimingBasis = 'fetch-consumer' | 'xhr-terminal' | 'probe-reader'

export interface FrozenMeasurement {
  readonly completedAt: number
  readonly elapsedMs: number
  readonly ttfbMs: number | null
  readonly timingBasis: TimingBasis
  readonly speedEligible: boolean
}
