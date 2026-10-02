/** Bounded observations shared by application producers and diagnostic consumers. */
export interface PlaybackDiagnosticSample {
  readonly at: number; readonly generation: number; readonly epoch: number; readonly enabled: boolean; readonly originalComparison: boolean
  readonly currentTimeSec: number; readonly frames: number | null; readonly playableBufferSec: number
  readonly paused: boolean; readonly seeking: boolean; readonly ended: boolean; readonly readyState: number
  readonly coreInitialized: boolean | null; readonly watchdog: string
}

export type ReadonlySnapshot<T> = T extends string | number | boolean | null | undefined ? T
  : T extends readonly (infer Item)[] ? readonly ReadonlySnapshot<Item>[]
  : { readonly [Key in keyof T]: ReadonlySnapshot<T[Key]> }
