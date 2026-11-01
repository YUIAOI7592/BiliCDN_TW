export interface FlowTransition<S, E> {
  readonly next: S
  readonly effects: readonly E[]
  readonly reason: 'accepted' | 'illegal-event' | 'terminal'
}

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

export type RestoreStage =
  'position' | 'rate' | 'play' | 'progress' | 'complete' | 'failed' | 'cancelled'
export type RestoreEvent = 'verified' | 'progress-confirmed' | 'fail' | 'cancel'
export function restoreTransition(
  stage: RestoreStage,
  event: RestoreEvent,
): FlowTransition<RestoreStage, 'restore-rate' | 'play' | 'confirm-progress' | 'finish'> {
  if (stage === 'complete' || stage === 'failed' || stage === 'cancelled')
    return { next: stage, effects: [], reason: 'terminal' }
  if (event === 'cancel' || event === 'fail')
    return {
      next: event === 'cancel' ? 'cancelled' : 'failed',
      effects: ['finish'],
      reason: 'accepted',
    }
  if (event === 'verified') {
    if (stage === 'position') return { next: 'rate', effects: ['restore-rate'], reason: 'accepted' }
    if (stage === 'rate') return { next: 'play', effects: ['play'], reason: 'accepted' }
    if (stage === 'play')
      return { next: 'progress', effects: ['confirm-progress'], reason: 'accepted' }
  }
  if (stage === 'progress' && event === 'progress-confirmed')
    return { next: 'complete', effects: ['finish'], reason: 'accepted' }
  return { next: stage, effects: [], reason: 'illegal-event' }
}

export type StallProgress =
  | { readonly phase: 'stalled'; readonly ticks: 0 }
  | { readonly phase: 'confirming'; readonly ticks: 1 }
  | { readonly phase: 'settling'; readonly ticks: number }
export function stallProgressTransition(
  state: StallProgress,
  event: 'progress' | 'stalled',
  bufferSec: number,
): { readonly next: StallProgress; readonly complete: boolean } {
  if (event === 'stalled') return { next: { phase: 'stalled', ticks: 0 }, complete: false }
  const ticks = Math.min(10, state.ticks + 1)
  return {
    next: ticks === 1 ? { phase: 'confirming', ticks: 1 } : { phase: 'settling', ticks },
    complete: ticks === 10 && Number.isFinite(bufferSec) && bufferSec >= 10,
  }
}
