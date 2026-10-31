import type { CandidateProfile } from './candidate-inputs.mts'

/** Frozen before execution. These are external playback inputs, not a predictor. */
export const observationNames = [
  'full-refill-6s',
  'full-refill-7s',
  'partial-2s-75pct',
  'partial-3s-20pct',
  'partial-4s-40pct',
  'partial-5s-75pct',
  'plateau-refill',
  'tiny-noise-refill',
  'irregular-drain',
  'gap-drain',
  'prefix-normal',
  'prefix-exhaustion',
] as const
export type ObservationName = (typeof observationNames)[number]
export interface ObservationTarget {
  readonly minimumLeadMs?: number
  readonly maximumCandidateMs?: number
  readonly maximumCycleCandidateMs?: number
  readonly requiresInsufficient?: boolean
}
export function observationInput(name: ObservationName): {
  readonly profile: CandidateProfile
  readonly target: ObservationTarget
} {
  const partial = /^partial-(\d)s-(\d+)pct$/.exec(name)
  const full = /^full-refill-(\d)s$/.exec(name)
  const cycle = partial ? Number(partial[1]) : full ? Number(full[1]) : null
  const fraction = partial ? Number(partial[2]) / 100 : 1
  let buffer = 12,
    elapsed = 0,
    stallAt: number | null = null
  const samples: CandidateProfile['samples'][number][] = []
  for (let second = 1; second <= 120; second++) {
    const ms =
      name === 'irregular-drain'
        ? [900, 1100, 1500, 500][(second - 1) % 4]!
        : name === 'gap-drain' && second === 2
          ? 1501
          : 1000
    elapsed += ms
    if (cycle !== null)
      buffer =
        stallAt !== null ? 0 : Math.max(0, buffer + (second % cycle ? -1 : (cycle - 1) * fraction))
    else if (name === 'plateau-refill' || name === 'tiny-noise-refill') {
      const values = [11, 10, 9, 8, 8, 7, 6, 5, 12]
      buffer = values[second - 1] ?? 12
      if (name === 'tiny-noise-refill' && second === 5) buffer += 0.000000001
    } else if (name.startsWith('prefix-'))
      buffer = name === 'prefix-normal' && second >= 9 ? 12 : Math.max(0, 12 - second)
    else buffer = Math.max(0, buffer - ms / 2000)
    if (buffer === 0 && stallAt === null) stallAt = elapsed
    samples.push(Object.freeze({ buffer, progress: stallAt === null, ms }))
  }
  const target: ObservationTarget = full
    ? { maximumCycleCandidateMs: (cycle! - 4) * 1000 }
    : name === 'plateau-refill' || name === 'tiny-noise-refill'
      ? { maximumCandidateMs: 4000 }
      : name === 'prefix-normal'
        ? { maximumCandidateMs: 5000 }
        : { minimumLeadMs: 3000, ...(name === 'gap-drain' ? { requiresInsufficient: true } : {}) }
  return Object.freeze({
    profile: Object.freeze({
      samples: Object.freeze(samples),
      stallAt,
      cycleMs: cycle === null ? null : cycle * 1000,
      fullRepayment: full !== null,
    }),
    target: Object.freeze(target),
  })
}
