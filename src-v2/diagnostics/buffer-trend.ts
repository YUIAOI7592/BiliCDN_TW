import type { BufferTrendSnapshot, BufferTrendReason } from '../domain/buffer-trend.ts'

const reasons = [
  'warming-up',
  'invalid-sample',
  'sample-gap',
  'time-reversed',
  'sample-overflow',
  'context-changed',
  'stopped',
  'reset',
  'no-progress',
  'unavailable',
  'paused',
  'seeking',
  'dragging',
  'hidden',
  'disabled',
  'original-comparison',
  'error',
  'ended',
  'buffered-to-end',
  'recovering',
  'stable',
  'filling',
  'draining-low',
  'draining-high',
  'candidate-confirming',
  'partial-refill',
  'not-decreasing',
  'above-prior-low',
  'candidate-repaid',
  'candidate-expired',
  'cycle-draining-low',
  'cycle-loss-confirming',
  'refill-cycle-balanced',
  'cycle-range-pending',
  'low-buffer-confirming',
  'low-buffer-steady',
  'low-buffer-cycle',
] as const satisfies readonly BufferTrendReason[]
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function member<const T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return values.some((v) => value === v)
}
function number(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : undefined
}
function nullable(value: unknown, min = 0): number | null | undefined {
  return value === null ? null : number(value, min)
}
/** Reconstruct a bounded numeric/enum projection. Never clone arbitrary producer fields. */
export function sanitizeBufferTrend(value: unknown): BufferTrendSnapshot | null {
  try {
    return read(value)
  } catch {
    return null
  }
}
function read(value: unknown): BufferTrendSnapshot | null {
  if (
    !object(value) ||
    value.schemaVersion !== 5 ||
    value.algorithm !== 'buffer-window-v5' ||
    !member(value.state, ['insufficient', 'ineligible', 'stable', 'filling', 'draining']) ||
    !member(value.reason, reasons) ||
    !member(value.progressQuality, ['none', 'frames', 'time-only']) ||
    typeof value.interpolated !== 'boolean' ||
    (value.candidate !== null && typeof value.candidate !== 'boolean') ||
    !object(value.transport)
  )
    return null
  const at = nullable(value.at),
    from = nullable(value.from),
    spanMs = number(value.spanMs, 0, 8000),
    sampleCount = number(value.sampleCount, 0, 32),
    rate = nullable(value.rate),
    startBufferSec = nullable(value.startBufferSec),
    endBufferSec = nullable(value.endBufferSec),
    deltaSec = nullable(value.deltaSec, -Number.MAX_SAFE_INTEGER),
    slopeSecPerSec = nullable(value.slopeSecPerSec, -Number.MAX_SAFE_INTEGER)
  if (
    at === undefined ||
    from === undefined ||
    spanMs === undefined ||
    sampleCount === undefined ||
    !Number.isInteger(sampleCount) ||
    rate === undefined ||
    (rate !== null && rate <= 0) ||
    startBufferSec === undefined ||
    endBufferSec === undefined ||
    deltaSec === undefined ||
    slopeSecPerSec === undefined ||
    (from !== null && (at === null || from > at))
  )
    return null
  const insufficient = value.state === 'insufficient' || value.state === 'ineligible'
  if (
    insufficient
      ? value.candidate !== null
      : typeof value.candidate !== 'boolean' ||
        at === null ||
        from === null ||
        rate === null ||
        spanMs !== 8000 ||
        sampleCount < 2 ||
        at - from !== 8000 ||
        startBufferSec === null ||
        endBufferSec === null ||
        deltaSec === null ||
        slopeSecPerSec === null
  )
    return null
  let cycle: BufferTrendSnapshot['cycle'] = null
  if (value.cycle !== null) {
    if (!object(value.cycle)) return null
    const c = value.cycle,
      creditMs = nullable(c.creditMs),
      netLossSec = number(c.netLossSec, 0, 2),
      lastLossAgeMs = nullable(c.lastLossAgeMs),
      rangeTroughSec = nullable(c.rangeTroughSec)
    if (
      creditMs === undefined ||
      (creditMs !== null && creditMs > 2000) ||
      netLossSec === undefined ||
      lastLossAgeMs === undefined ||
      (lastLossAgeMs !== null && lastLossAgeMs > 8000) ||
      rangeTroughSec === undefined ||
      (netLossSec > 0 && lastLossAgeMs === null) ||
      insufficient
    )
      return null
    cycle = Object.freeze({ creditMs, netLossSec, lastLossAgeMs, rangeTroughSec })
  }
  let lowBuffer: BufferTrendSnapshot['lowBuffer'] = null
  if (value.lowBuffer !== null) {
    if (!object(value.lowBuffer)) return null
    const l = value.lowBuffer
    const creditMs = number(l.creditMs, 0, 2000),
      declineCoverageMs = number(l.declineCoverageMs, 0, 8000)
    if (
      !member(l.basis, ['steady-decline', 'partial-cycle']) ||
      creditMs === undefined ||
      declineCoverageMs === undefined ||
      insufficient ||
      endBufferSec === null ||
      endBufferSec > 4 ||
      (l.basis === 'steady-decline'
        ? declineCoverageMs !== 8000
        : !cycle || cycle.netLossSec <= 0 || cycle.lastLossAgeMs === null)
    )
      return null
    lowBuffer = Object.freeze({ basis: l.basis, creditMs, declineCoverageMs })
  }
  const lowReason = value.reason === 'low-buffer-steady' || value.reason === 'low-buffer-cycle'
  if (
    lowReason &&
    (value.candidate !== true ||
      lowBuffer?.creditMs !== 2000 ||
      lowBuffer.basis !==
        (value.reason === 'low-buffer-steady' ? 'steady-decline' : 'partial-cycle'))
  )
    return null
  if (value.reason === 'low-buffer-confirming' && (value.candidate !== false || lowBuffer === null))
    return null
  const shortLow =
    value.state === 'draining' &&
    deltaSec !== null &&
    deltaSec <= -2 &&
    endBufferSec !== null &&
    endBufferSec <= 10
  const cycleLow =
    cycle !== null &&
    cycle.netLossSec === 2 &&
    cycle.lastLossAgeMs !== null &&
    endBufferSec !== null &&
    endBufferSec <= 10
  if (
    value.reason === 'cycle-draining-low' &&
    (!cycleLow || cycle?.creditMs !== 2000 || value.candidate !== true)
  )
    return null
  if (value.reason === 'cycle-loss-confirming' && (!cycleLow || value.candidate !== false))
    return null
  if (
    (value.reason === 'refill-cycle-balanced' || value.reason === 'cycle-range-pending') &&
    (!shortLow ||
      cycle?.rangeTroughSec === null ||
      cycle === null ||
      endBufferSec! < cycle.rangeTroughSec! ||
      value.candidate !== false)
  )
    return null
  const confirmationReason = [
    'candidate-confirming',
    'partial-refill',
    'not-decreasing',
    'above-prior-low',
    'candidate-repaid',
    'candidate-expired',
  ].includes(value.reason)
  if (
    (value.candidate === true &&
      !lowReason &&
      value.reason !== 'cycle-draining-low' &&
      (value.reason !== 'draining-low' || !shortLow)) ||
    (value.reason === 'draining-low' && (value.candidate !== true || !shortLow)) ||
    (confirmationReason && (value.candidate !== false || (!shortLow && !cycleLow)))
  )
    return null
  const t = value.transport,
    successes = number(t.successes, 0, 128),
    failures = number(t.failures, 0, 128),
    aborts = number(t.aborts, 0, 128),
    completedBytes = number(t.completedBytes),
    crossWindow = number(t.crossWindow, 0, 128),
    dropped = number(t.dropped)
  if (
    successes === undefined ||
    failures === undefined ||
    aborts === undefined ||
    completedBytes === undefined ||
    crossWindow === undefined ||
    dropped === undefined ||
    ![successes, failures, aborts, completedBytes, crossWindow, dropped].every(
      Number.isSafeInteger,
    ) ||
    successes + failures + aborts > 128 ||
    crossWindow > successes + failures + aborts ||
    !member(t.coverage, ['none-observed', 'observed-completions', 'partial']) ||
    t.coverage !==
      (dropped
        ? 'partial'
        : successes + failures + aborts
          ? 'observed-completions'
          : 'none-observed')
  )
    return null
  return Object.freeze({
    schemaVersion: 5,
    algorithm: 'buffer-window-v5',
    cycle,
    lowBuffer,
    at,
    from,
    spanMs,
    sampleCount,
    interpolated: value.interpolated,
    progressQuality: value.progressQuality,
    state: value.state,
    reason: value.reason,
    candidate: value.candidate,
    rate,
    startBufferSec,
    endBufferSec,
    deltaSec,
    slopeSecPerSec,
    transport: Object.freeze({
      coverage: t.coverage,
      successes,
      failures,
      aborts,
      completedBytes,
      crossWindow,
      dropped,
    }),
  })
}
