export interface RescueProgressSample {
  readonly at: number
  readonly position: number
  readonly frames: number | null
  readonly rate: number
  readonly owner: string
  readonly paused: boolean
  readonly seeking: boolean
  readonly ended: boolean
  readonly error: boolean
  readonly reloadCount: number
}

// Acceptance evidence only. This helper does not control runtime recovery policy.
export function sustainedPlayback(samples: readonly RescueProgressSample[], rate: number): boolean {
  if (samples.length !== 16) return false
  const first = samples[0]!
  for (let i = 0; i < samples.length; i++) {
    const current = samples[i]!,
      previous = samples[i - 1]
    if (
      !Number.isFinite(current.at) ||
      !Number.isFinite(current.position) ||
      current.position < 0 ||
      (current.frames !== null && (!Number.isFinite(current.frames) || current.frames < 0)) ||
      current.rate !== rate ||
      current.owner !== first.owner ||
      current.paused ||
      current.seeking ||
      current.ended ||
      current.error ||
      current.reloadCount !== first.reloadCount
    )
      return false
    if (
      previous &&
      (current.at - previous.at !== 1000 ||
        current.position - previous.position <= 0.05 ||
        (current.frames !== null &&
          (previous.frames === null || current.frames <= previous.frames)))
    )
      return false
  }
  return true
}

export function restoredPosition(
  position: number,
  target: number,
  rate: number,
  elapsedMs: number,
): boolean {
  return (
    [position, target, rate, elapsedMs].every(Number.isFinite) &&
    position >= 0 &&
    target >= 0 &&
    rate > 0 &&
    elapsedMs >= 0 &&
    Math.abs(position - (target + (rate * elapsedMs) / 1000)) <= 1
  )
}
