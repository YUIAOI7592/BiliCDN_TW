/** Frozen external input and acceptance annotations before any v5 runtime change. */
export interface Profile {
  readonly initialBuffer: number
  readonly samples: readonly {
    readonly buffer: number
    readonly progress: boolean
    readonly ms: number
  }[]
  readonly stallAt: number | null
  readonly cycleMs: number | null
  readonly fullRepayment: boolean
}
export interface Case {
  readonly id: string
  readonly group: 'main' | 'holdout'
  readonly profile: Profile
  readonly firstMs?: number
  readonly minimumLeadMs?: number
  readonly maxCandidateMs?: number
  readonly maxEpisodes?: number
  readonly refillAt?: number
  readonly pair?: string
}
function profile(
  initial: number,
  slope: number | null,
  cycle: number | null,
  fraction: number,
  refillAt?: number,
  irregular = false,
  jitter = false,
): Profile {
  let buffer = initial,
    elapsed = 0,
    stallAt: number | null = null,
    spent = 0
  const samples: Profile['samples'][number][] = []
  for (let i = 1; i <= Math.max(120, slope === null ? 240 : Math.ceil(initial / slope) + 20); i++) {
    const ms = irregular ? [900, 1100, 1500, 500][(i - 1) % 4]! : 1000
    elapsed += ms
    if (refillAt !== undefined && elapsed >= refillAt) buffer = initial
    else if (jitter) buffer = i <= 2 ? initial - i * 0.25 : initial
    else if (stallAt !== null) buffer = 0
    else if (slope !== null) buffer = Math.max(0, initial - (slope * elapsed) / 1000)
    else if (cycle !== null) {
      if (i % cycle === 0) {
        buffer += spent * fraction
        spent = 0
      } else {
        const drop = ms / 1000
        buffer = Math.max(0, buffer - drop)
        spent += drop
      }
    }
    if (buffer === 0 && stallAt === null) stallAt = elapsed
    samples.push(Object.freeze({ buffer, progress: stallAt === null, ms }))
  }
  return Object.freeze({
    initialBuffer: initial,
    samples: Object.freeze(samples),
    stallAt,
    cycleMs: cycle === null ? null : cycle * 1000,
    fullRepayment: refillAt !== undefined || fraction === 1,
  })
}
const cases: Case[] = []
for (const [slope, first, refill] of [
  [0.1, 82, 85],
  [0.2, 42, 45],
  [0.249, 35, 38],
] as const) {
  const id = `slow-${slope}`
  cases.push({
    id,
    group: 'main',
    profile: profile(12, slope, null, 0),
    firstMs: first * 1000,
    minimumLeadMs: 3000,
    pair: id + '-normal',
  })
  cases.push({
    id: id + '-normal',
    group: 'main',
    profile: profile(12, slope, null, 0, refill * 1000),
    firstMs: first * 1000,
    maxCandidateMs: 3000,
    maxEpisodes: 1,
    refillAt: refill * 1000,
  })
}
for (const [cycle, first, refill] of [
  [3, 8, 10],
  [4, 7, 9],
] as const) {
  const id = `low4-cycle${cycle}-75`
  cases.push({
    id,
    group: 'main',
    profile: profile(4, null, cycle, 0.75),
    firstMs: first * 1000,
    minimumLeadMs: 3000,
    pair: id + '-normal',
  })
  cases.push({
    id: id + '-normal',
    group: 'main',
    profile: profile(4, null, cycle, 0.75, refill * 1000),
    firstMs: first * 1000,
    maxCandidateMs: 3000,
    maxEpisodes: 1,
    refillAt: refill * 1000,
  })
}
for (const initial of [4.5, 5])
  for (const cycle of [3, 4])
    for (const fraction of [0.6, 0.85, 0.95])
      cases.push({
        id: `reserve-${initial}-cycle${cycle}-${fraction}`,
        group: 'holdout',
        profile: profile(initial, null, cycle, fraction),
        minimumLeadMs: 3000,
      })
for (const initial of [7, 12])
  for (const slope of [0.125, 0.175])
    cases.push({
      id: `reserve-${initial}-slow${slope}`,
      group: 'holdout',
      profile: profile(initial, slope, null, 0),
      minimumLeadMs: 3000,
    })
for (const initial of [4, 4.5, 5])
  for (const cycle of [3, 4])
    cases.push({
      id: `reserve-${initial}-full${cycle}`,
      group: 'holdout',
      profile: profile(initial, null, cycle, 1),
      maxCandidateMs: 0,
      maxEpisodes: 0,
    })
cases.push({
  id: 'reserve-low-jitter',
  group: 'holdout',
  profile: profile(4, null, null, 0, undefined, false, true),
  maxCandidateMs: 0,
  maxEpisodes: 0,
})
cases.push({
  id: 'reserve-irregular-slow',
  group: 'holdout',
  profile: profile(7, 0.175, null, 0, undefined, true),
  minimumLeadMs: 3000,
})
export const frozenCases: readonly Case[] = Object.freeze(cases.map((c) => Object.freeze(c)))
