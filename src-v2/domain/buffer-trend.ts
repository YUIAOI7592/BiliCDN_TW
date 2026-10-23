/** Experimental, read-only observations. These thresholds never authorize an action. */
export const BUFFER_WINDOW_MS = 8000
export const BUFFER_SAMPLE_LIMIT = 32
export const BUFFER_COMPLETION_LIMIT = 128
export type BufferTrendReason =
  | 'warming-up'
  | 'invalid-sample'
  | 'sample-gap'
  | 'time-reversed'
  | 'sample-overflow'
  | 'context-changed'
  | 'stopped'
  | 'reset'
  | 'no-progress'
  | 'unavailable'
  | 'paused'
  | 'seeking'
  | 'dragging'
  | 'hidden'
  | 'disabled'
  | 'original-comparison'
  | 'error'
  | 'ended'
  | 'buffered-to-end'
  | 'recovering'
  | 'stable'
  | 'filling'
  | 'draining-low'
  | 'draining-high'
export interface BufferTrendSample {
  readonly at: number
  readonly bufferAheadSec: number
  readonly rate: number
  readonly currentTime: number
  readonly frames: number | null
}
export interface BufferCompletion {
  readonly startedAt: number
  readonly completedAt: number
  readonly bytes: number
  readonly status: number
  readonly outcome: 'success' | 'failure' | 'abort'
}
export interface BufferTransportSummary {
  readonly coverage: 'none-observed' | 'observed-completions' | 'partial'
  readonly successes: number
  readonly failures: number
  readonly aborts: number
  readonly completedBytes: number
  readonly crossWindow: number
  readonly dropped: number
}
export interface BufferTrendReading {
  readonly schemaVersion: 1
  readonly algorithm: 'buffer-window-v1'
  readonly at: number | null
  readonly from: number | null
  readonly spanMs: number
  readonly sampleCount: number
  readonly interpolated: boolean
  readonly progressQuality: 'none' | 'frames' | 'time-only'
  readonly state: 'insufficient' | 'ineligible' | 'stable' | 'filling' | 'draining'
  readonly reason: BufferTrendReason
  readonly candidate: boolean | null
  readonly rate: number | null
  readonly startBufferSec: number | null
  readonly endBufferSec: number | null
  readonly deltaSec: number | null
  readonly slopeSecPerSec: number | null
}
export interface BufferTrendSnapshot extends BufferTrendReading {
  readonly transport: BufferTransportSummary
}
export function emptyBufferTrend(
  at: number,
  reason: BufferTrendReason = 'warming-up',
  ineligible = false,
): BufferTrendReading {
  return Object.freeze({
    schemaVersion: 1,
    algorithm: 'buffer-window-v1',
    at: Number.isFinite(at) && at >= 0 ? at : null,
    from: null,
    spanMs: 0,
    sampleCount: 0,
    interpolated: false,
    progressQuality: 'none',
    state: ineligible ? 'ineligible' : 'insufficient',
    reason,
    candidate: null,
    rate: null,
    startBufferSec: null,
    endBufferSec: null,
    deltaSec: null,
    slopeSecPerSec: null,
  })
}
export function validBufferSample(s: BufferTrendSample): boolean {
  return (
    Number.isFinite(s.at) &&
    s.at >= 0 &&
    Number.isFinite(s.rate) &&
    s.rate > 0 &&
    Number.isFinite(s.bufferAheadSec) &&
    s.bufferAheadSec >= 0 &&
    Number.isFinite(s.bufferAheadSec / s.rate) &&
    Number.isFinite(s.currentTime) &&
    s.currentTime >= 0 &&
    (s.frames === null || (Number.isSafeInteger(s.frames) && s.frames >= 0))
  )
}
export function assessBufferTrend(
  samples: readonly BufferTrendSample[],
  now: number,
): BufferTrendReading {
  const empty = (reason: BufferTrendReason) => emptyBufferTrend(now, reason)
  if (samples.length > BUFFER_SAMPLE_LIMIT) return empty('sample-overflow')
  if (!Number.isFinite(now) || now < 0 || samples.some((s) => !validBufferSample(s)))
    return empty('invalid-sample')
  const last = samples.at(-1)
  if (!last || last.at !== now) return empty('warming-up')
  let quality: BufferTrendReading['progressQuality'] = 'frames'
  for (let i = 1; i < samples.length; i++) {
    const before = samples[i - 1]!,
      after = samples[i]!
    if (after.at <= before.at) return empty('time-reversed')
    if (after.at - before.at > 1500) return empty('sample-gap')
    if (after.rate !== last.rate) return empty('context-changed')
    if (
      after.currentTime - before.currentTime <= 0.05 ||
      (after.frames !== null && before.frames !== null && after.frames <= before.frames)
    )
      return empty('no-progress')
    if (after.frames === null || before.frames === null) quality = 'time-only'
  }
  const from = now - BUFFER_WINDOW_MS
  let index = -1
  for (let i = 0; i < samples.length && samples[i]!.at <= from; i++) index = i
  if (index < 0) return empty('warming-up')
  const left = samples[index]!,
    right = samples[index + 1]
  const interpolated = left.at !== from
  if (interpolated && !right) return empty('warming-up')
  const firstBuffer = left.bufferAheadSec / left.rate
  const startBufferSec =
    interpolated && right
      ? firstBuffer +
        ((right.bufferAheadSec / right.rate - firstBuffer) * (from - left.at)) /
          (right.at - left.at)
      : firstBuffer
  const endBufferSec = last.bufferAheadSec / last.rate,
    deltaSec = endBufferSec - startBufferSec
  const state = deltaSec <= -2 ? 'draining' : deltaSec >= 2 ? 'filling' : 'stable'
  const candidate = state === 'draining' && endBufferSec <= 10
  return Object.freeze({
    schemaVersion: 1,
    algorithm: 'buffer-window-v1',
    at: now,
    from,
    spanMs: BUFFER_WINDOW_MS,
    sampleCount: samples.length,
    interpolated,
    progressQuality: quality,
    state,
    reason: state === 'draining' ? (candidate ? 'draining-low' : 'draining-high') : state,
    candidate,
    rate: last.rate,
    startBufferSec,
    endBufferSec,
    deltaSec,
    slopeSecPerSec: deltaSec / (BUFFER_WINDOW_MS / 1000),
  })
}
export function summarizeBufferTransport(
  rows: readonly BufferCompletion[],
  now: number,
  dropped: number,
): BufferTransportSummary {
  let successes = 0,
    failures = 0,
    aborts = 0,
    completedBytes = 0,
    crossWindow = 0
  for (const row of rows) {
    if (row.completedAt < now - BUFFER_WINDOW_MS || row.completedAt > now) continue
    if (row.outcome === 'success') {
      successes++
      if (
        row.status >= 200 &&
        row.status < 300 &&
        Number.isSafeInteger(row.bytes) &&
        row.bytes >= 0 &&
        Number.isSafeInteger(completedBytes + row.bytes)
      )
        completedBytes += row.bytes
    } else if (row.outcome === 'failure') failures++
    else aborts++
    if (row.startedAt < now - BUFFER_WINDOW_MS) crossWindow++
  }
  return Object.freeze({
    coverage: dropped
      ? 'partial'
      : successes + failures + aborts
        ? 'observed-completions'
        : 'none-observed',
    successes,
    failures,
    aborts,
    completedBytes,
    crossWindow,
    dropped,
  })
}
