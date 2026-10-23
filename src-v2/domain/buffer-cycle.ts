import { confirmBufferTrend, emptyBufferTrend, validBufferSample } from './buffer-trend.ts'
import type {
  BufferTrendReason,
  BufferCycleReading,
  BufferCycleInput,
  BufferCycleState,
  BufferCycleReason,
} from './buffer-trend.ts'
export function emptyBufferCycle(
  at: number,
  reason: BufferTrendReason = 'warming-up',
  ineligible = false,
): BufferCycleReading {
  return Object.freeze({
    ...emptyBufferTrend(at, reason, ineligible),
    schemaVersion: 4,
    algorithm: 'buffer-window-v4',
    cycle: null,
  })
}
/** Pure, constant-size evidence. PlayerMonitor owns the returned state and all identity resets. */
export function observeBufferCycle(input: BufferCycleInput): {
  readonly reading: BufferCycleReading
  readonly state: BufferCycleState | null
} {
  const { reading: raw, sample, previous } = input
  const reject = (reason: BufferTrendReason) =>
    Object.freeze({ reading: emptyBufferCycle(sample.at, reason), state: null })
  if (!validBufferSample(sample)) return reject('invalid-sample')
  if (previous && (!validBufferSample(previous) || previous.rate !== sample.rate))
    return reject('context-changed')
  const result = (reading: BufferCycleReading, state: BufferCycleState | null) =>
    Object.freeze({ reading: Object.freeze(reading), state })
  if (previous && sample.at === previous.at) return result(emptyBufferCycle(sample.at), input.state)
  if (previous && sample.at < previous.at) return reject('time-reversed')
  if (previous && sample.at - previous.at > 1500) return reject('sample-gap')
  if (raw.candidate === null)
    return result({ ...raw, schemaVersion: 4, algorithm: 'buffer-window-v4', cycle: null }, null)
  const buffer = sample.bufferAheadSec / sample.rate
  if (raw.at !== sample.at || raw.endBufferSec !== buffer) return reject('invalid-sample')
  const before = previous ? previous.bufferAheadSec / previous.rate : buffer
  const prior = input.state
  const valid =
    prior &&
    previous &&
    prior.at === previous.at &&
    [prior.peakSec, prior.troughSec, prior.netLossSec, prior.at].every(Number.isFinite) &&
    prior.peakSec >= prior.troughSec &&
    prior.troughSec >= 0 &&
    prior.netLossSec >= 0 &&
    prior.netLossSec <= 2 &&
    (prior.phase === 'falling' || prior.phase === 'rising') &&
    (prior.cycleCreditMs === null ||
      (Number.isFinite(prior.cycleCreditMs) &&
        prior.cycleCreditMs >= 0 &&
        prior.cycleCreditMs <= 2000)) &&
    [prior.lastLossAt, prior.lastRefillAt].every(
      (v) => v === null || (Number.isFinite(v) && v >= 0 && v <= prior.at),
    ) &&
    (prior.rangeTroughSec === null ||
      (Number.isFinite(prior.rangeTroughSec) && prior.rangeTroughSec >= 0))
  const state = valid
    ? { ...prior }
    : {
        at: sample.at,
        peakSec: before,
        troughSec: Math.min(before, buffer),
        phase: 'falling' as const,
        netLossSec: 0,
        lastLossAt: null,
        lastRefillAt: null,
        rangeTroughSec: null,
        cycleCreditMs: null,
        confirmation: null,
      }
  if (state.lastLossAt !== null && sample.at - state.lastLossAt > 8000) {
    state.netLossSec = 0
    state.lastLossAt = null
    // A new loss in this same sample must not inherit the expired cycle's credit.
    state.cycleCreditMs = null
  }
  if (state.lastRefillAt !== null && sample.at - state.lastRefillAt > 8000)
    state.rangeTroughSec = null
  if (buffer > before) {
    if (state.phase !== 'rising') state.troughSec = Math.min(state.troughSec, before)
    state.phase = 'rising'
    state.lastRefillAt = sample.at
    if (buffer >= state.peakSec) {
      state.netLossSec = 0
      state.lastLossAt = null
      state.rangeTroughSec = state.troughSec
      state.confirmation = null
    }
  } else if (buffer < before) {
    if (state.phase === 'rising') {
      const loss = state.peakSec - before
      if (loss > 0) {
        state.netLossSec = Math.min(2, state.netLossSec + loss)
        state.lastLossAt = previous!.at
        state.rangeTroughSec = state.netLossSec < 2 ? state.troughSec : null
      } else {
        state.netLossSec = 0
        state.lastLossAt = null
        state.rangeTroughSec = state.troughSec
      }
      state.peakSec = before
      state.troughSec = buffer
      state.phase = 'falling'
    } else state.troughSec = Math.min(state.troughSec, buffer)
  }
  const balanced = state.rangeTroughSec !== null && buffer >= state.rangeTroughSec
  const cycleLow =
    state.netLossSec >= 2 &&
    state.lastLossAt !== null &&
    sample.at - state.lastLossAt <= 8000 &&
    buffer <= 10
  const confirmed = confirmBufferTrend({
    reading: { ...raw, candidate: !balanced && (raw.candidate || cycleLow) },
    sample,
    previous,
    confirmation: state.confirmation,
  })
  if (!cycleLow || balanced) state.cycleCreditMs = null
  else if (buffer < before)
    state.cycleCreditMs =
      state.cycleCreditMs === null
        ? 0
        : Math.min(2000, state.cycleCreditMs + sample.at - previous!.at)
  const cycleCandidate = cycleLow && !balanced && buffer < before && state.cycleCreditMs === 2000
  state.confirmation = confirmed.confirmation
  state.at = sample.at
  const reason: BufferCycleReason =
    balanced && raw.candidate
      ? state.netLossSec > 0
        ? 'cycle-range-pending'
        : 'refill-cycle-balanced'
      : cycleCandidate && !confirmed.reading.candidate
        ? 'cycle-draining-low'
        : cycleLow && !raw.candidate && confirmed.reading.candidate
          ? 'cycle-draining-low'
          : cycleLow &&
              !raw.candidate &&
              (confirmed.reading.reason === 'candidate-confirming' || buffer < before)
            ? 'cycle-loss-confirming'
            : confirmed.reading.reason
  return result(
    {
      ...confirmed.reading,
      candidate: confirmed.reading.candidate || cycleCandidate,
      schemaVersion: 4,
      algorithm: 'buffer-window-v4',
      reason,
      cycle: Object.freeze({
        creditMs: cycleLow
          ? Math.max(state.cycleCreditMs ?? 0, confirmed.confirmation?.creditMs ?? 0)
          : null,
        netLossSec: state.netLossSec,
        lastLossAgeMs: state.lastLossAt === null ? null : sample.at - state.lastLossAt,
        rangeTroughSec: state.rangeTroughSec,
      }),
    },
    Object.freeze(state),
  )
}
