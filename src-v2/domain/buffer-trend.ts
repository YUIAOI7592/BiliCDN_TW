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
  | 'candidate-confirming'
  | 'partial-refill'
  | 'not-decreasing'
  | 'above-prior-low'
  | 'candidate-repaid'
  | 'candidate-expired'
  | 'cycle-draining-low'
  | 'cycle-loss-confirming'
  | 'refill-cycle-balanced'
  | 'cycle-range-pending'
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
export interface BufferTrendFacts {
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
export interface BufferWindowReading extends BufferTrendFacts {
  readonly schemaVersion: 1
  readonly algorithm: 'buffer-window-v1'
}
export interface BufferTrendReading extends BufferTrendFacts {
  readonly schemaVersion: 3
  readonly algorithm: 'buffer-window-v3'
}
export interface BufferCandidateConfirmation {
  readonly anchorSec: number
  readonly lowSec: number
  readonly creditMs: number
  readonly at: number
  readonly lastLowAt: number
}
export interface BufferConfirmationInput {
  readonly reading: BufferTrendFacts
  readonly sample: BufferTrendSample
  readonly previous: BufferTrendSample | undefined
  readonly confirmation: BufferCandidateConfirmation | null
}
export interface BufferConfirmationResult {
  readonly reading: BufferTrendReading
  readonly confirmation: BufferCandidateConfirmation | null
}
export type BufferCycleReason = BufferTrendReason
export interface BufferCycleEvidence {
  readonly creditMs: number | null
  readonly netLossSec: number
  readonly lastLossAgeMs: number | null
  readonly rangeTroughSec: number | null
}
export interface BufferCycleReading extends Omit<BufferTrendFacts, 'reason'> {
  readonly schemaVersion: 4
  readonly algorithm: 'buffer-window-v4'
  readonly reason: BufferCycleReason
  readonly cycle: BufferCycleEvidence | null
}
export interface BufferCycleState {
  readonly cycleCreditMs: number | null
  readonly at: number
  readonly peakSec: number
  readonly troughSec: number
  readonly phase: 'falling' | 'rising'
  readonly netLossSec: number
  readonly lastLossAt: number | null
  readonly lastRefillAt: number | null
  readonly rangeTroughSec: number | null
  readonly confirmation: BufferCandidateConfirmation | null
}
export interface BufferCycleInput {
  readonly reading: BufferTrendFacts
  readonly sample: BufferTrendSample
  readonly previous: BufferTrendSample | undefined
  readonly state: BufferCycleState | null
}
export interface BufferTrendSnapshot extends BufferCycleReading {
  readonly transport: BufferTransportSummary
}
export function emptyBufferTrend(
  at: number,
  reason: BufferTrendReason = 'warming-up',
  ineligible = false,
): BufferTrendReading {
  return Object.freeze({
    schemaVersion: 3,
    algorithm: 'buffer-window-v3',
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
): BufferWindowReading {
  const empty = (reason: BufferTrendReason): BufferWindowReading =>
    Object.freeze({
      ...emptyBufferTrend(now, reason),
      schemaVersion: 1,
      algorithm: 'buffer-window-v1',
    })
  if (samples.length > BUFFER_SAMPLE_LIMIT) return empty('sample-overflow')
  if (!Number.isFinite(now) || now < 0 || samples.some((s) => !validBufferSample(s)))
    return empty('invalid-sample')
  const last = samples.at(-1)
  if (!last || last.at !== now) return empty('warming-up')
  if (samples.some((s) => s.rate !== last.rate)) return empty('context-changed')
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
/** Pure transition; only PlayerMonitor retains the returned bounded evidence. */
export function confirmBufferTrend(input: BufferConfirmationInput): BufferConfirmationResult {
  const { reading: raw, sample, previous } = input
  const current: BufferTrendReading = Object.freeze({
    ...raw,
    schemaVersion: 3,
    algorithm: 'buffer-window-v3',
  })
  const finish = (
    reading: BufferTrendReading,
    confirmation: BufferCandidateConfirmation | null,
  ): BufferConfirmationResult => Object.freeze({ reading, confirmation })
  const reject = (reason: BufferTrendReason) => finish(emptyBufferTrend(sample.at, reason), null)
  if (!validBufferSample(sample)) return reject('invalid-sample')
  if (previous && (!validBufferSample(previous) || previous.rate !== sample.rate))
    return reject('context-changed')
  let state = input.confirmation
  if (
    state &&
    (!previous ||
      state.at !== previous.at ||
      ![state.anchorSec, state.lowSec, state.creditMs, state.at, state.lastLowAt].every(
        Number.isFinite,
      ) ||
      state.lowSec < 0 ||
      state.anchorSec < state.lowSec ||
      state.creditMs < 0 ||
      state.creditMs > 2000 ||
      state.lastLowAt < 0 ||
      state.lastLowAt > state.at)
  )
    state = null
  if (previous && sample.at === previous.at)
    return finish(emptyBufferTrend(sample.at, 'warming-up'), state)
  if (previous && sample.at < previous.at) return reject('time-reversed')
  if (previous && sample.at - previous.at > 1500) return reject('sample-gap')
  if (raw.candidate === null) return finish(current, null)
  if (raw.at !== sample.at || raw.endBufferSec !== sample.bufferAheadSec / sample.rate)
    return reject('invalid-sample')
  if (!raw.candidate) return finish(current, null)
  const buffer = sample.bufferAheadSec / sample.rate
  const before = previous ? previous.bufferAheadSec / previous.rate : null
  const expired = state !== null && sample.at - state.lastLowAt > BUFFER_WINDOW_MS
  if (expired) state = null
  const result = (
    reason: BufferTrendReason,
    candidate: boolean,
    next: BufferCandidateConfirmation | null,
  ) => finish(Object.freeze({ ...current, candidate, reason }), next)
  if (!state) {
    const next =
      before !== null && buffer < before
        ? Object.freeze({
            anchorSec: before,
            lowSec: buffer,
            creditMs: 0,
            at: sample.at,
            lastLowAt: sample.at,
          })
        : null
    return result(
      expired
        ? 'candidate-expired'
        : before !== null && buffer > before
          ? 'partial-refill'
          : before === buffer
            ? 'not-decreasing'
            : 'candidate-confirming',
      false,
      next,
    )
  }
  if (buffer >= state.anchorSec) return result('candidate-repaid', false, null)
  if (buffer < state.lowSec) {
    const creditMs = Math.min(2000, state.creditMs + sample.at - previous!.at)
    const next = Object.freeze({
      ...state,
      lowSec: buffer,
      creditMs,
      at: sample.at,
      lastLowAt: sample.at,
    })
    return result(
      creditMs >= 2000 ? 'draining-low' : 'candidate-confirming',
      creditMs >= 2000,
      next,
    )
  }
  return result(
    buffer > before! ? 'partial-refill' : buffer === before ? 'not-decreasing' : 'above-prior-low',
    false,
    Object.freeze({ ...state, at: sample.at }),
  )
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
  let unavailable = dropped
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
      else unavailable = Math.min(Number.MAX_SAFE_INTEGER, unavailable + 1)
    } else if (row.outcome === 'failure') failures++
    else aborts++
    if (row.startedAt < now - BUFFER_WINDOW_MS) crossWindow++
  }
  return Object.freeze({
    coverage: unavailable
      ? 'partial'
      : successes + failures + aborts
        ? 'observed-completions'
        : 'none-observed',
    successes,
    failures,
    aborts,
    completedBytes,
    crossWindow,
    dropped: unavailable,
  })
}
