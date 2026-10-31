import type { CandidateProfile } from './candidate-inputs.mts'

export interface ContinuityCase {
  readonly id: string
  readonly profile: CandidateProfile & { readonly initialBuffer: number }
  readonly group: 'primary' | 'matrix' | 'normal'
  readonly pair: string | null
  readonly refillAt: number | null
  readonly tailAt: number | null
  readonly stableAt: number | null
}

function cycle(initial: number, period: number, fraction: number): ContinuityCase['profile'] {
  let buffer = initial,
    spent = 0,
    stallAt: number | null = null
  const samples = []
  for (let second = 1; second <= 240; second++) {
    if (stallAt !== null) buffer = 0
    else if (second % period === 0) {
      buffer += spent * fraction
      spent = 0
    } else {
      buffer = Math.max(0, buffer - 1)
      spent++
    }
    if (buffer === 0 && stallAt === null) stallAt = second * 1000
    samples.push(Object.freeze({ buffer, progress: stallAt === null, ms: 1000 }))
  }
  return Object.freeze({
    initialBuffer: initial,
    samples: Object.freeze(samples),
    stallAt,
    cycleMs: period * 1000,
    fullRepayment: false,
  })
}

const cases: ContinuityCase[] = []
function pair(
  initial: number,
  period: number,
  fraction: number,
  group: 'primary' | 'matrix',
  tailAt: number | null = null,
) {
  const id = `tail-${group}-${initial}-${period}-${fraction}`,
    profile = cycle(initial, period, fraction)
  if (profile.stallAt === null) throw Error('Frozen exhaustion input never reaches zero')
  cases.push({ id, group, profile, pair: `${id}-normal`, refillAt: null, tailAt, stableAt: null })
  cases.push({
    id: `${id}-normal`,
    group,
    pair: id,
    refillAt: profile.stallAt,
    tailAt,
    stableAt: null,
    profile: Object.freeze({
      ...profile,
      stallAt: null,
      fullRepayment: true,
      samples: Object.freeze(
        profile.samples.map((s, i) =>
          (i + 1) * 1000 >= profile.stallAt!
            ? Object.freeze({ ...s, buffer: initial, progress: true })
            : s,
        ),
      ),
    }),
  })
}
for (const [initial, fraction, tail] of [
  [4, 0.75, 10],
  [4.5, 0.85, 18],
  [4.5, 0.95, 42],
  [5, 0.85, 22],
  [5, 0.95, 58],
] as const)
  pair(initial, 4, fraction, 'primary', tail * 1000)
for (const initial of [4.25, 4.75, 5.25])
  for (const period of [3, 4, 5])
    for (const fraction of [0.65, 0.9, 0.975]) pair(initial, period, fraction, 'matrix')

const micro = [
  0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.55, 0.54, 0.53, 0.52,
  0.51, 0.5, 0.49, 0.48, 0.47, 0.46,
]
cases.push({
  id: 'tail-normal-microdecline',
  group: 'normal',
  pair: null,
  refillAt: null,
  tailAt: 18000,
  stableAt: 26000,
  profile: {
    initialBuffer: 1,
    stallAt: null,
    cycleMs: null,
    fullRepayment: false,
    samples: Array.from({ length: 120 }, (_, i) => ({
      buffer: micro[i] ?? 0.46,
      progress: true,
      ms: 1000,
    })),
  },
})
cases.push({
  id: 'tail-normal-plateau',
  group: 'normal',
  pair: null,
  refillAt: null,
  tailAt: null,
  stableAt: 19000,
  profile: {
    initialBuffer: 12,
    stallAt: null,
    cycleMs: null,
    fullRepayment: false,
    samples: Array.from({ length: 120 }, (_, i) => ({
      buffer: Math.max(3, 12 - (i + 1) * 0.5),
      progress: true,
      ms: 1000,
    })),
  },
})
/** Inputs and annotations are fixed independently of the product and never use future outcomes. */
export const continuityCases: readonly ContinuityCase[] = Object.freeze(
  cases.map((c) =>
    Object.freeze({
      ...c,
      profile: Object.freeze({
        ...c.profile,
        samples: Object.freeze(c.profile.samples.map((s) => Object.freeze(s))),
      }),
    }),
  ),
)
