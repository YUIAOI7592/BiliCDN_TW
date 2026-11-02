import type { CapacityConfidence } from './model.ts'

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
  return recentCapacity(row) && row.safeThroughputMbps !== null && Number.isFinite(row.safeThroughputMbps) && row.safeThroughputMbps > 0 && Number.isFinite(row.demandRatio) && (row.demandRatio ?? 0) >= ROUTE_HEADROOM
}
export function capacityPriority(row: CapacityFacts): number {
  if (adequateCapacity(row)) return row.capacityConfidence === 'sufficient' ? 0 : 1
  if (recentCapacity(row) && row.safeThroughputMbps !== null) return 2
  if (row.safeThroughputMbps !== null && Number.isFinite(row.safeThroughputMbps) && row.safeThroughputMbps > 0) return 3
  return 4
}
