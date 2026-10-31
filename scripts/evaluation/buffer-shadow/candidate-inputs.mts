/** Frozen external inputs and acceptance annotations, never a candidate implementation. */
export const candidateScenarioNames = [
  'refill-3s',
  'refill-5s',
  'short-plateau',
  'tiny-refill',
  'irregular-confirmation',
  'micro-refill-exhaustion',
  'micro-refill-2s',
  'repayment-2s-1pct',
  'repayment-2s-10pct',
  'repayment-2s-50pct',
  'repayment-2s-100pct',
  'repayment-3s-1pct',
  'repayment-3s-10pct',
  'repayment-3s-50pct',
  'repayment-3s-100pct',
  'repayment-4s-1pct',
  'repayment-4s-10pct',
  'repayment-4s-50pct',
  'repayment-4s-100pct',
  'repayment-5s-1pct',
  'repayment-5s-10pct',
  'repayment-5s-50pct',
  'repayment-5s-100pct',
] as const
export interface CandidateProfileSample {
  readonly buffer: number
  readonly progress: boolean
  readonly ms: number
}
export interface CandidateProfile {
  readonly initialBuffer?: number
  readonly samples: readonly CandidateProfileSample[]
  readonly stallAt: number | null
  readonly cycleMs: number | null
  readonly fullRepayment: boolean
}
export interface CandidateTarget {
  readonly firstMs: number | null
  readonly leadMs?: number
  readonly episodes?: readonly (readonly [number, number])[]
  readonly maxEpisodes?: number
  readonly maxCandidateMs?: number
}
export const candidateTargets: Readonly<Record<string, CandidateTarget>> = Object.freeze({
  'jitter-2s': { firstMs: null, maxCandidateMs: 0 },
  'burst-refill': { firstMs: null, maxCandidateMs: 0 },
  'low-sawtooth': { firstMs: null, maxCandidateMs: 0 },
  'drain-refill': { firstMs: 6000, episodes: [[6000, 9000]] },
  'slow-exhaustion': { firstMs: 22000, leadMs: 18000 },
  'fast-exhaustion': { firstMs: 3000, leadMs: 3000 },
  'refill-3s': { firstMs: null, maxCandidateMs: 0 },
  'refill-5s': { firstMs: 4000, maxEpisodes: 2, maxCandidateMs: 2000 },
  'short-plateau': { firstMs: 4000, maxEpisodes: 2, maxCandidateMs: 4000 },
  'tiny-refill': { firstMs: 4000, maxEpisodes: 2, maxCandidateMs: 4000 },
  'irregular-confirmation': { firstMs: 3100 },
  'micro-refill-exhaustion': { firstMs: 4000, leadMs: 5000 },
  'micro-refill-2s': { firstMs: 7000, leadMs: 5000 },
})

export function candidateProfile(name: string): CandidateProfile | undefined {
  if (!(candidateScenarioNames as readonly string[]).includes(name)) return undefined
  const matrix = /^repayment-([2-5])s-(1|10|50|100)pct$/.exec(name)
  const cycle = matrix ? Number(matrix[1]) : null
  const fraction = matrix ? Number(matrix[2]) / 100 : null
  const samples: CandidateProfileSample[] = []
  let buffer = 12,
    elapsed = 0,
    stallAt: number | null = null
  const values =
    name === 'micro-refill-exhaustion'
      ? [10, 8, 8.1, 6.1, 4.1, 4.2, 2.2, 0.2, 0]
      : name === 'micro-refill-2s'
        ? [10, 10.1, 8.1, 8.2, 6.2, 6.3, 4.3, 4.4, 2.4, 2.5, 0.5, 0]
        : name === 'short-plateau' || name === 'tiny-refill'
          ? [11, 10, 9, 8, name === 'tiny-refill' ? 8.000000001 : 8, 7, 6, 5]
          : name === 'irregular-confirmation'
            ? [10, 9, 8, 7]
            : null
  for (let second = 1; second <= (matrix ? 120 : 45); second++) {
    if (cycle !== null && fraction !== null)
      buffer =
        stallAt !== null ? 0 : Math.max(0, buffer + (second % cycle ? -1 : (cycle - 1) * fraction))
    else if (name === 'refill-3s' || name === 'refill-5s')
      buffer = 12 - (second % (name === 'refill-3s' ? 3 : 5))
    else if (values)
      buffer =
        values[second - 1] ??
        (name.startsWith('micro-') ? 0 : name === 'irregular-confirmation' ? 12 : 5)
    const ms =
      name === 'irregular-confirmation' && second === 2
        ? 1100
        : name === 'irregular-confirmation' && second === 4
          ? 900
          : 1000
    elapsed += ms
    if (buffer === 0 && stallAt === null) stallAt = elapsed
    samples.push(Object.freeze({ buffer, progress: stallAt === null, ms }))
  }
  return Object.freeze({
    samples: Object.freeze(samples),
    stallAt,
    cycleMs: cycle === null ? null : cycle * 1000,
    fullRepayment: fraction === 1,
  })
}
