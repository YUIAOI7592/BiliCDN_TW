import type { CapacityConfidence, CompletionBudget, PredictionReason } from './model.ts'
import { completionReason, predictCompletionMs } from './route-completion.ts'

export const ROUTE_HEADROOM = 1
export const EARLY_RETRY_HEADROOM = 1.35
export interface CapacityFacts {
  readonly capacityConfidence: CapacityConfidence
  readonly safeThroughputMbps: number | null
  readonly demandRatio: number | null
}
export function recentCapacity(row: Pick<CapacityFacts, 'capacityConfidence'>): boolean {
  return row.capacityConfidence === 'sufficient' || row.capacityConfidence === 'provisional'
}
export function adequateCapacity(row: CapacityFacts): boolean {
  return (
    recentCapacity(row) &&
    row.safeThroughputMbps !== null &&
    Number.isFinite(row.safeThroughputMbps) &&
    row.safeThroughputMbps > 0 &&
    Number.isFinite(row.demandRatio) &&
    (row.demandRatio ?? 0) >= ROUTE_HEADROOM
  )
}
export function capacityPriority(row: CapacityFacts): number {
  if (adequateCapacity(row)) return row.capacityConfidence === 'sufficient' ? 0 : 1
  if (recentCapacity(row) && row.safeThroughputMbps !== null) return 2
  if (
    row.safeThroughputMbps !== null &&
    Number.isFinite(row.safeThroughputMbps) &&
    row.safeThroughputMbps > 0
  )
    return 3
  return 4
}

interface ComparedCapacity extends CapacityFacts {
  readonly eligible?: boolean
  readonly candidateOrder: number
  readonly safePayloadMbps: number | null
  readonly predictionTtfbMs: number | null
}
export function orderCapacityRows<T extends ComparedCapacity>(
  rows: readonly T[],
  budget: CompletionBudget | null | undefined,
  now: number,
): readonly (T & {
  readonly comparisonMode: 'throughput' | 'completion'
  readonly predictionReason: PredictionReason
  readonly estimatedCompletionMs: number | null
})[] {
  const reason = completionReason(budget, now)
  const predicted = rows.map((row) => ({
    row,
    time:
      reason === 'available' && recentCapacity(row)
        ? predictCompletionMs(budget!.requestBytes, row.safePayloadMbps, row.predictionTtfbMs)
        : null,
  }))
  const complete = new Map<number, boolean>()
  for (const item of predicted) {
    if (item.row.eligible === false) continue
    const tier = capacityPriority(item.row)
    complete.set(tier, (complete.get(tier) ?? true) && item.time !== null)
  }
  const decorated = predicted.map(({ row, time }) =>
    Object.freeze({
      ...row,
      estimatedCompletionMs: time,
      comparisonMode:
        row.eligible !== false && complete.get(capacityPriority(row)) === true
          ? ('completion' as const)
          : ('throughput' as const),
      predictionReason:
        reason !== 'available'
          ? reason
          : time === null
            ? ('unknown-body-rate' as const)
            : complete.get(capacityPriority(row))
              ? ('available' as const)
              : ('cohort-incomplete' as const),
    }),
  )
  return Object.freeze(
    decorated.sort((a, b) => {
      if (a.eligible !== false && b.eligible === false) return -1
      if (a.eligible === false && b.eligible !== false) return 1
      const tier = capacityPriority(a) - capacityPriority(b)
      if (tier) return tier
      if (a.comparisonMode === 'completion' && b.comparisonMode === 'completion') {
        const deadline = budget!.playableBufferSec! * 1000
        const fitsA = a.estimatedCompletionMs! <= deadline,
          fitsB = b.estimatedCompletionMs! <= deadline
        return (
          Number(fitsB) - Number(fitsA) ||
          a.estimatedCompletionMs! - b.estimatedCompletionMs! ||
          a.candidateOrder - b.candidateOrder
        )
      }
      return (
        (b.safeThroughputMbps ?? -1) - (a.safeThroughputMbps ?? -1) ||
        a.candidateOrder - b.candidateOrder
      )
    }),
  )
}
