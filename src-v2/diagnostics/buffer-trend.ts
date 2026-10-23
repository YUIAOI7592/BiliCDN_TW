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
    value.schemaVersion !== 1 ||
    value.algorithm !== 'buffer-window-v1' ||
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
    schemaVersion: 1,
    algorithm: 'buffer-window-v1',
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
