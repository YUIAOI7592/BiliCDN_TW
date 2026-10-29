export interface EarlyRetryCapacity {
  readonly host: string
  readonly safeMbps: number
  readonly ttfbMs: number
  readonly successCount: number
  readonly oldestAt: number
}

export interface EarlyRetryFacts {
  readonly now: number
  readonly startedAt: number
  readonly currentHost: string
  readonly loadedBytes: number
  readonly totalBytes: number
  readonly recentBytesPerSec: number | null
  readonly playableBufferSec: number
  readonly requiredMbps: number
  readonly alternative: EarlyRetryCapacity
}

export interface EarlyRetryAssessment {
  readonly eligible: boolean
  readonly reason: string
  readonly remainingSec: number | null
  readonly alternativeSec: number | null
}

/** Supplied facts only. The route owner, never this predicate, authorizes an alternative. */
export function evaluateEarlyRetry(input: EarlyRetryFacts): EarlyRetryAssessment {
  const reject = (reason: string): EarlyRetryAssessment => ({
    eligible: false,
    reason,
    remainingSec: null,
    alternativeSec: null,
  })
  const { now, startedAt, loadedBytes, totalBytes, playableBufferSec, requiredMbps, alternative } =
    input
  if (
    !Number.isFinite(now) ||
    !Number.isFinite(startedAt) ||
    startedAt < 0 ||
    now < startedAt ||
    !Number.isSafeInteger(loadedBytes) ||
    loadedBytes < 0 ||
    !Number.isSafeInteger(totalBytes) ||
    totalBytes <= 0 ||
    loadedBytes > totalBytes ||
    !Number.isFinite(playableBufferSec) ||
    !Number.isFinite(requiredMbps) ||
    requiredMbps <= 0
  )
    return reject('invalid-input')
  if (now - startedAt < 1500) return reject('request-young')
  if (loadedBytes / totalBytes >= 0.8) return reject('mostly-complete')
  if (playableBufferSec <= 0 || playableBufferSec >= 6) return reject('buffer-window')
  const rate = input.recentBytesPerSec
  if (rate === null || !Number.isFinite(rate) || rate < 0) return reject('unknown-rate')
  if ((rate * 8) / 1_000_000 >= requiredMbps) return reject('adequate-current')
  if (
    !alternative.host ||
    alternative.host === input.currentHost ||
    !Number.isSafeInteger(alternative.successCount) ||
    alternative.successCount < 2 ||
    !Number.isFinite(alternative.oldestAt) ||
    alternative.oldestAt < 0 ||
    alternative.oldestAt > now ||
    now - alternative.oldestAt > 60_000
  )
    return reject('alternative-evidence')
  if (
    !Number.isFinite(alternative.safeMbps) ||
    alternative.safeMbps / requiredMbps < 1.35 ||
    !Number.isFinite(alternative.ttfbMs) ||
    alternative.ttfbMs < 0
  )
    return reject('alternative-capacity')
  const alternativeSec =
    alternative.ttfbMs / 1000 + (totalBytes * 8) / (alternative.safeMbps * 1_000_000)
  if (!Number.isFinite(alternativeSec) || alternativeSec > 0.8 * playableBufferSec)
    return reject('alternative-late')
  // A zero-byte observation is an actual no-progress interval, not an unknown sample.
  const remainingSec = rate === 0 ? null : (totalBytes - loadedBytes) / rate
  if (
    remainingSec !== null &&
    (!Number.isFinite(remainingSec) || remainingSec <= 0.8 * playableBufferSec)
  )
    return reject('current-finishes-in-time')
  if (remainingSec !== null && remainingSec - alternativeSec < 1)
    return reject('insufficient-benefit')
  return { eligible: true, reason: 'eligible', remainingSec, alternativeSec }
}
