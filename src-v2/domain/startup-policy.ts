import { type FlowTransition } from './model.ts'
import {
  capacityPriority,
  adequateCapacity,
  recentCapacity,
  type ComparedCapacity,
} from './route-capacity.ts'
export type StartupStage =
  | 'available'
  | 'reserved'
  | 'probing'
  | 'adequate'
  | 'insufficient'
  | 'unverified'
  | 'exhausted'
  | 'cancelled'
export type StartupEvent =
  'reserve' | 'probe' | 'adequate' | 'insufficient' | 'unverified' | 'exhausted' | 'cancel'
export type StartupEffect = 'reserve-window' | 'probe-window' | 'commit-selection' | 'seal-window'
export function startupTransition(
  stage: StartupStage,
  event: StartupEvent,
): FlowTransition<StartupStage, StartupEffect> {
  if (!['available', 'reserved', 'probing'].includes(stage))
    return { next: stage, effects: [], reason: 'terminal' }
  if (event === 'cancel' && stage !== 'available')
    return { next: 'cancelled', effects: ['seal-window'], reason: 'accepted' }
  if (stage === 'available' && event === 'reserve')
    return { next: 'reserved', effects: ['reserve-window'], reason: 'accepted' }
  if (stage === 'reserved' && event === 'probe')
    return { next: 'probing', effects: ['probe-window'], reason: 'accepted' }
  if (
    stage === 'probing' &&
    ['adequate', 'insufficient', 'unverified', 'exhausted'].includes(event)
  )
    return {
      next: event as 'adequate' | 'insufficient' | 'unverified' | 'exhausted',
      effects: event === 'exhausted' ? ['seal-window'] : ['commit-selection', 'seal-window'],
      reason: 'accepted',
    }
  return { next: stage, effects: [], reason: 'illegal-event' }
}

/** Exploration uses admitted cursor order and shares the existing three-slot budget. */
export function startupCapacityPool<
  T extends ComparedCapacity & { readonly revalidationRequired: boolean },
>(rows: readonly T[]) {
  const ranked = [...rows].sort(
    (a, b) =>
      capacityPriority(a) - capacityPriority(b) ||
      (b.safeThroughputMbps ?? -1) - (a.safeThroughputMbps ?? -1) ||
      a.candidateOrder - b.candidateOrder,
  )
  const exploration = ranked.some(adequateCapacity)
    ? ([...ranked]
        .filter((row) => !recentCapacity(row))
        .sort((a, b) => {
          const priority = (row: T) =>
            row.revalidationRequired ? 0 : row.capacityConfidence === 'missing' ? 1 : 2
          return priority(a) - priority(b) || a.candidateOrder - b.candidateOrder
        })[0] ?? null)
    : null
  return { ranked, exploration }
}
export function startupSelection<T>(
  ranked: readonly T[],
  exploration: T | null | undefined,
): readonly T[] {
  const selected = exploration
    ? [...ranked.filter((row) => row !== exploration).slice(0, 2), exploration]
    : ranked.slice(0, 3)
  return ranked.filter((row) => selected.includes(row))
}
