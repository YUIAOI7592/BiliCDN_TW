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
