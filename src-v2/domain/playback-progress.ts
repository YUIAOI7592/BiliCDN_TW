interface PlaybackControlIdentity {
  readonly seekRevision: number
  readonly userRevision: number
  readonly mediaId: number
  readonly coreId: number
}

// These comparisons describe samples only. Eligibility and consecutive-sample
// counters belong to each caller, whose policies intentionally differ.
export function comparePlaybackControls(
  current: PlaybackControlIdentity,
  previous: PlaybackControlIdentity | null,
): 'initial' | 'same' | 'changed' {
  if (previous === null) return 'initial'
  return current.seekRevision !== previous.seekRevision ||
    current.userRevision !== previous.userRevision ||
    current.mediaId !== previous.mediaId ||
    current.coreId !== previous.coreId
    ? 'changed'
    : 'same'
}

export function playbackTimeAdvanced(currentTime: number, previousTime: number): boolean {
  return currentTime - previousTime > 0.05
}

export function playbackFramesAdvanced(currentFrames: number, previousFrames: number): boolean {
  return currentFrames > previousFrames
}

export type ProgressObservation =
  | 'progress'
  | 'gap-progress'
  | 'stalled'
  | 'insufficient'
  | 'duplicate'
  | 'clock-invalid'
  | 'owner-changed'
export interface ProgressSample extends PlaybackControlIdentity {
  readonly at: number | null
  readonly position: number
  readonly frames: number | null
  readonly seeking: boolean
  readonly pendingSeekGoal?: boolean
  readonly active: boolean
  readonly playbackRevision: number
  readonly generation: number
  readonly epoch: number
  readonly representation: string | null
}
export interface ProgressState {
  readonly baseline: ProgressSample | null
  readonly observedAt?: number | null
  readonly ticks: number
  readonly elapsedMs: number
}
export function stableProgress(ticks: number, elapsedMs: number, minimum: number): boolean {
  return (
    Number.isFinite(ticks) &&
    ticks >= minimum &&
    Number.isFinite(elapsedMs) &&
    elapsedMs >= minimum * 1000
  )
}
/** Comparison baseline is retained across short negative and duplicate observations. */
export function samplePlaybackProgress(
  state: ProgressState,
  sample: ProgressSample,
): {
  readonly next: ProgressState
  readonly observation: ProgressObservation
  readonly advanced: boolean
} {
  const previous = state.baseline
  const reset = (observation: ProgressObservation, advanced = false) => ({
    next: { baseline: sample, observedAt: sample.at, ticks: 0, elapsedMs: 0 },
    observation,
    advanced,
  })
  if (
    previous &&
    (comparePlaybackControls(sample, previous) !== 'same' ||
      sample.playbackRevision !== previous.playbackRevision ||
      sample.generation !== previous.generation ||
      sample.epoch !== previous.epoch ||
      sample.representation !== previous.representation ||
      sample.active !== previous.active ||
      sample.seeking !== previous.seeking ||
      sample.pendingSeekGoal !== previous.pendingSeekGoal)
  )
    return reset('owner-changed')
  if (
    sample.at === null ||
    !Number.isFinite(sample.at) ||
    sample.at < 0 ||
    (state.observedAt != null && sample.at < state.observedAt)
  )
    return reset('clock-invalid')
  if (!previous || previous.at === null || !Number.isFinite(previous.at) || previous.at < 0)
    return reset('insufficient')
  const gap = sample.at - (state.observedAt ?? previous.at)
  if (gap === 0) return { next: state, observation: 'duplicate', advanced: false }
  const advanced =
    sample.active &&
    !sample.seeking &&
    !previous.seeking &&
    playbackTimeAdvanced(sample.position, previous.position)
  const progress =
    advanced &&
    (sample.frames === null ||
      (previous.frames !== null && playbackFramesAdvanced(sample.frames, previous.frames)))
  if (progress) {
    if (gap > 2000) return reset('gap-progress', true)
    return {
      next: {
        baseline: sample,
        observedAt: sample.at,
        ticks: state.ticks + 1,
        elapsedMs: state.elapsedMs + gap,
      },
      observation: 'progress',
      advanced,
    }
  }
  if (!sample.active) return reset('insufficient')
  // Keep the no-progress window anchored until motion or an owner change. Later
  // readings confirm the same stall; they never backdate its first detection.
  if (sample.at - previous.at < 1000)
    return { next: { ...state, observedAt: sample.at }, observation: 'insufficient', advanced }
  return {
    next: {
      baseline: { ...sample, at: previous.at },
      observedAt: sample.at,
      ticks: 0,
      elapsedMs: 0,
    },
    observation: 'stalled',
    advanced,
  }
}

export type StallProgress =
  | { readonly phase: 'stalled'; readonly ticks: 0 }
  | { readonly phase: 'confirming'; readonly ticks: 1 }
  | { readonly phase: 'settling'; readonly ticks: number }
  | { readonly phase: 'stable-retained'; readonly ticks: number }
export function stallProgressTransition(
  state: StallProgress,
  event: 'progress' | 'stalled',
  bufferSec: number,
  elapsedMs: number,
): { readonly next: StallProgress; readonly complete: boolean } {
  if (event === 'stalled') return { next: { phase: 'stalled', ticks: 0 }, complete: false }
  const ticks = Math.min(10, state.ticks + 1)
  return {
    next: stableProgress(ticks, elapsedMs, 10)
      ? { phase: 'stable-retained', ticks }
      : ticks === 1
        ? { phase: 'confirming', ticks: 1 }
        : { phase: 'settling', ticks },
    complete: stableProgress(ticks, elapsedMs, 10) && Number.isFinite(bufferSec) && bufferSec >= 10,
  }
}
