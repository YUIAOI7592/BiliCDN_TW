export interface TrustedSeekObservation {
  draggingObserved: boolean
  beforeRevision: number
  targetSec: number
  goal: {
    value: number
    proof: boolean
    native: {
      seeking: boolean
      paused: boolean
      ended: boolean
      error: boolean
      visible: boolean
      position: number
      controls: { dragging: boolean; userRevision: number }
    }
  }
}

// A native seeking target is legal even when there is no PendingGoal proof.
// PlayerControlObserver.validateResumePosition explicitly accepts proof=null.
export function trustedSeekReady(observation: TrustedSeekObservation): boolean {
  const { goal, targetSec, draggingObserved, beforeRevision } = observation
  const native = goal.native
  return (
    draggingObserved &&
    Number.isFinite(goal.value) &&
    Number.isFinite(native.position) &&
    Math.abs(goal.value - targetSec) <= 1 &&
    Math.abs(native.position - goal.value) <= 1 &&
    native.seeking &&
    !native.controls.dragging &&
    native.controls.userRevision > beforeRevision &&
    !native.paused &&
    !native.ended &&
    !native.error &&
    native.visible
  )
}
