/** Completed delivery bytes must agree with every visible length declaration. */
export function measuredPayload(
  bytes: number,
  length: string | null,
  range: string | null,
): boolean {
  if (!Number.isSafeInteger(bytes) || bytes < 0) return false
  if (
    length !== null &&
    (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)) || Number(length) !== bytes)
  )
    return false
  if (range === null) return true
  const match = /^bytes (\d+)-(\d+)\/(\d+|\*)$/i.exec(range)
  if (!match) return false
  const start = Number(match[1]),
    end = Number(match[2]),
    total = match[3] === '*' ? null : Number(match[3])
  return (
    Number.isSafeInteger(start) &&
    Number.isSafeInteger(end) &&
    start >= 0 &&
    end >= start &&
    end - start + 1 === bytes &&
    (total === null || (Number.isSafeInteger(total) && total > end))
  )
}

export const timingBasis = (value: unknown): TimingBasis | undefined =>
  value === 'fetch-consumer' || value === 'xhr-terminal' || value === 'probe-reader'
    ? value
    : undefined

/** Both endpoints must belong to the same injected monotonic clock. */
export function measuredTiming(start: number | null, response: number | null, end: number | null) {
  const valid = (value: number | null): value is number =>
    value !== null && Number.isFinite(value) && value >= 0
  const elapsedMs = valid(start) && valid(end) && end >= start ? end - start : 0
  const ttfbMs =
    valid(start) && valid(response) && valid(end) && response >= start && response <= end
      ? response - start
      : null
  return Object.freeze({
    elapsedMs,
    ttfbMs,
    speedEligible: elapsedMs > 0 && ttfbMs !== null && ttfbMs < elapsedMs,
  })
}

export function readMonotonic(now: () => number | null): number | null {
  try {
    const value = now()
    return value !== null && Number.isFinite(value) && value >= 0 ? value : null
  } catch {
    return null
  }
}

export type TimingBasis = 'fetch-consumer' | 'xhr-terminal' | 'probe-reader'

export interface FrozenMeasurement {
  readonly completedAt: number
  readonly elapsedMs: number
  readonly ttfbMs: number | null
  readonly timingBasis: TimingBasis
  readonly speedEligible: boolean
}
