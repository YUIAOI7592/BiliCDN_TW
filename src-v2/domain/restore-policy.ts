import { type FlowTransition } from './model.ts'
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
