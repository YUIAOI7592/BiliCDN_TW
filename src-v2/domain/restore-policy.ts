import { type FlowTransition } from './model.ts'

export interface RestorePositionFacts {
  readonly positionSec: number | null
  readonly rate: number | null
  readonly paused: boolean | null
  readonly seeking: boolean | null
  readonly landing: { readonly positionSec: number; readonly at: number } | null
}
interface PositionBaseline {
  readonly positionSec: number
  readonly at: number
  readonly rate: number
  readonly paused: boolean
}

/** Supplied observations only; no command, owner or correction allowance is created here. */
export function restorePositionMatches(
  reading: RestorePositionFacts,
  anchor: PositionBaseline | null | undefined,
  now: () => number,
): boolean {
  if (anchor) {
    if (
      reading.positionSec === null ||
      reading.rate === null ||
      reading.paused === null ||
      reading.seeking !== false
    )
      return false
    const elapsed = Math.max(0, now() - anchor.at) / 1000
    const oldRate = anchor.paused ? 0 : anchor.rate
    const nextRate = reading.paused ? 0 : reading.rate
    const low = anchor.positionSec + Math.min(oldRate, nextRate) * elapsed - 1
    const high = anchor.positionSec + Math.max(oldRate, nextRate) * elapsed + 1
    return (
      Number.isFinite(low) &&
      Number.isFinite(high) &&
      reading.positionSec >= low &&
      reading.positionSec <= high
    )
  }
  if (
    !reading.landing ||
    reading.positionSec === null ||
    reading.seeking !== false ||
    reading.paused === null
  )
    return false
  if (!reading.paused && reading.rate === null) return false
  const expected =
    reading.landing.positionSec +
    (reading.paused ? 0 : (reading.rate! * Math.max(0, now() - reading.landing.at)) / 1000)
  return Math.abs(reading.positionSec - expected) <= 1
}

export function restorePositionMismatch(
  reading: RestorePositionFacts,
  targetSec: number,
  now: () => number,
): boolean {
  return (
    reading.positionSec !== null &&
    reading.paused !== null &&
    (reading.paused || reading.rate !== null) &&
    Math.abs(
      reading.positionSec -
        (reading.landing
          ? reading.landing.positionSec +
            (reading.paused ? 0 : (reading.rate! * Math.max(0, now() - reading.landing.at)) / 1000)
          : targetSec),
    ) > 1
  )
}

export function restoreProgressMatches(
  baseline: { readonly positionSec: number; readonly at: number; readonly rate: number },
  snapshot: { readonly currentTime: number; readonly playbackRate: number },
  now: () => number,
): boolean {
  const elapsed = Math.max(0, now() - baseline.at) / 1000
  return (
    snapshot.playbackRate === baseline.rate &&
    Number.isFinite(snapshot.currentTime) &&
    snapshot.currentTime >= baseline.positionSec - 1 &&
    snapshot.currentTime <= baseline.positionSec + baseline.rate * elapsed + 1
  )
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
