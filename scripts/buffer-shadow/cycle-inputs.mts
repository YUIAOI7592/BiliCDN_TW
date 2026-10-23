import { observationNames, observationInput } from './observation-inputs.mts'
import type { ObservationTarget } from './observation-inputs.mts'
import type { CandidateProfile } from './candidate-inputs.mts'

/** External inputs and acceptance gates fixed before the v4 prototype. */
export const cycleReserveNames = Object.freeze([
  'reserve-2s-95pct',
  'reserve-3s-85pct',
  'reserve-variable-75pct',
  'reserve-irregular-80pct',
  'reserve-near-full-6s',
  'reserve-full-offset',
])
export const cycleNames: readonly string[] = Object.freeze([
  ...observationNames,
  ...[2, 3, 4, 5, 6, 7].flatMap((cycle) =>
    [60, 75, 90].map((percent) => `cycle-${cycle}s-${percent}pct`),
  ),
  ...cycleReserveNames,
])
export interface CycleTarget extends ObservationTarget {
  readonly maximumLastLeadMs?: number
}
export function cycleInput(name: string): {
  readonly profile: CandidateProfile
  readonly target: CycleTarget
} {
  if (cycleReserveNames.includes(name)) {
    let buffer = 12,
      elapsed = 0,
      stallAt: number | null = null,
      index = 0,
      cycleIndex = 0,
      spent = 0
    const samples: CandidateProfile['samples'][number][] = []
    for (let second = 1; second <= 600; second++) {
      const cycle =
        name === 'reserve-variable-75pct'
          ? [2, 5, 3, 7][cycleIndex % 4]!
          : name === 'reserve-2s-95pct'
            ? 2
            : name === 'reserve-3s-85pct'
              ? 3
              : name === 'reserve-irregular-80pct'
                ? 4
                : 6
      const ms =
        name === 'reserve-irregular-80pct' ? [900, 1100, 1500, 500][(second - 1) % 4]! : 1000
      const fraction =
        name === 'reserve-2s-95pct'
          ? 0.95
          : name === 'reserve-3s-85pct'
            ? 0.85
            : name === 'reserve-variable-75pct'
              ? 0.75
              : name === 'reserve-irregular-80pct'
                ? 0.8
                : 1 - 1e-9
      elapsed += ms
      index++
      if (name === 'reserve-full-offset') buffer = 12 - ((second + 3) % 6)
      else if (stallAt !== null) buffer = 0
      else if (index === cycle) {
        buffer += spent * fraction
        spent = 0
      } else {
        buffer = Math.max(0, buffer - ms / 1000)
        spent += ms / 1000
      }
      if (index === cycle) {
        index = 0
        cycleIndex++
      }
      if (buffer === 0 && stallAt === null) stallAt = elapsed
      samples.push(Object.freeze({ buffer, progress: stallAt === null, ms }))
    }
    return Object.freeze({
      profile: Object.freeze({
        samples: Object.freeze(samples),
        stallAt,
        cycleMs: null,
        fullRepayment: false,
      }),
      target: Object.freeze(
        name === 'reserve-near-full-6s' || name === 'reserve-full-offset'
          ? { maximumCandidateMs: 2000 }
          : { minimumLeadMs: 3000, maximumLastLeadMs: 5000 },
      ),
    })
  }
  const existing = observationNames.find((n) => n === name)
  if (existing) {
    const input = observationInput(existing)
    return Object.freeze({
      profile: input.profile,
      target: Object.freeze({
        ...input.target,
        ...(name === 'full-refill-6s' ? { maximumCandidateMs: 2000 } : {}),
        ...(name === 'full-refill-7s' ? { maximumCandidateMs: 3000 } : {}),
        ...(input.profile.stallAt === null ? {} : { maximumLastLeadMs: 5000 }),
      }),
    })
  }
  const match = /^cycle-([2-7])s-(60|75|90)pct$/.exec(name)
  if (!match) throw Error('Unknown cycle input')
  const cycle = Number(match[1]),
    fraction = Number(match[2]) / 100
  let buffer = 12,
    stallAt: number | null = null
  const samples: CandidateProfile['samples'][number][] = []
  for (let second = 1; second <= 240; second++) {
    buffer =
      stallAt !== null ? 0 : Math.max(0, buffer + (second % cycle ? -1 : (cycle - 1) * fraction))
    if (buffer === 0 && stallAt === null) stallAt = second * 1000
    samples.push(Object.freeze({ buffer, progress: stallAt === null, ms: 1000 }))
  }
  return Object.freeze({
    profile: Object.freeze({
      samples: Object.freeze(samples),
      stallAt,
      cycleMs: cycle * 1000,
      fullRepayment: false,
    }),
    target: Object.freeze({ minimumLeadMs: 3000, maximumLastLeadMs: 5000 }),
  })
}
