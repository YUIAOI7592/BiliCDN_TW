import type { SupplyCompletion } from './supply-model.mts'

export const riskNames = [
  'high-stable',
  'low-stable',
  'jitter-refill',
  'full-cycle',
  'slow-deficit',
  'partial-cycle',
  'low-partial-cycle',
  'no-next-request',
  'unwarnable-outage',
  'pre-window-outage',
] as const
export type RiskName = (typeof riskNames)[number]
export interface RiskScenario {
  readonly name: RiskName
  readonly annotationRevision: 1 | 2
  readonly rate: 1 | 2
  readonly initialWallSec: number
  readonly warmupMs: 60000
  readonly durationMs: 120000
  readonly firstDepletionMs: number | null
  readonly minimumLeadMs: number | null
  readonly maximumCandidateMs: number | null
  readonly requests: boolean
  readonly resetAtStart: boolean
  readonly completions: readonly SupplyCompletion[]
}
/** Frozen external supply. No product result or candidate enters this schedule. */
export function riskScenario(name: RiskName, rate: 1 | 2): RiskScenario {
  if (!riskNames.includes(name) || ![1, 2].includes(rate)) throw Error('Invalid risk scenario')
  const initialWallSec =
    name === 'low-stable'
      ? 3
      : name === 'low-partial-cycle'
        ? 4
        : name.includes('outage')
          ? 1
          : ['full-cycle', 'partial-cycle', 'no-next-request'].includes(name)
            ? 8
            : 12
  const completions: SupplyCompletion[] = []
  let segment = 0
  const add = (second: number, wallSeconds: number) =>
    completions.push(
      Object.freeze({
        at: second * 1000,
        segment: segment++,
        bytes: Math.round(wallSeconds * rate * 100000),
        mediaMs: wallSeconds * rate * 1000,
        outcome: 'success' as const,
      }),
    )
  for (let second = 1; second <= 60; second++) add(second, 1)
  for (let second = 1; second <= 120; second++) {
    if (name === 'no-next-request' || name.includes('outage')) continue
    if (name === 'jitter-refill' && second <= 2) continue
    if (name === 'full-cycle') {
      if (second % 4 === 0) add(60 + second, 4)
      continue
    }
    if (name === 'partial-cycle' || name === 'low-partial-cycle') {
      if (second % 4 === 0 && second <= 32) add(60 + second, 3.25)
      continue
    }
    if (name === 'slow-deficit') {
      if (second <= 60) add(60 + second, 0.8)
      continue
    }
    add(60 + second, name === 'jitter-refill' && second === 3 ? 3 : 1)
  }
  // 0.8s arrives at each whole second. At t=56, 0.8s remains after delivery;
  // it runs out at 56.8s, before the next delivery. Continuous-flow arithmetic
  // cannot label a discrete append schedule. Revision 1's 59.2s is preserved in evidence.
  const firstDepletionMs =
    name === 'slow-deficit'
      ? 56800
      : name === 'partial-cycle'
        ? 27500
        : name === 'low-partial-cycle'
          ? 7250
          : name === 'no-next-request'
            ? 8000
            : name.includes('outage')
              ? 1000
              : null
  return Object.freeze({
    name,
    annotationRevision: name === 'slow-deficit' ? 2 : 1,
    rate,
    initialWallSec,
    warmupMs: 60000,
    durationMs: 120000,
    firstDepletionMs,
    minimumLeadMs: firstDepletionMs === null || name.includes('outage') ? null : 3000,
    maximumCandidateMs: firstDepletionMs === null ? 0 : null,
    requests: name !== 'no-next-request',
    resetAtStart: name === 'pre-window-outage',
    completions: Object.freeze(completions),
  })
}
