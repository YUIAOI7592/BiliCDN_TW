import { type TimingBasis } from './measurement-time.ts'
/** A request hint only; this never grants route or transport authority. */
export function closedRangeLength(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const match = /^bytes=(\d+)-(\d+)$/i.exec(value.trim())
  if (!match) return null
  const start = Number(match[1]),
    end = Number(match[2]),
    length = end - start + 1
  return Number.isSafeInteger(start) &&
    Number.isSafeInteger(end) &&
    start >= 0 &&
    end >= start &&
    Number.isSafeInteger(length) &&
    length > 0
    ? length
    : null
}
export function completionReason(
  budget: CompletionBudget | null | undefined,
  now: number,
): PredictionReason {
  if (!budget || !Number.isSafeInteger(budget.requestBytes) || (budget.requestBytes ?? 0) <= 0)
    return 'unknown-size'
  if (
    budget.playableBufferSec === null ||
    !Number.isFinite(budget.playableBufferSec) ||
    budget.playableBufferSec < 0
  )
    return 'unknown-buffer'
  const age = budget.ageMs ?? now - budget.sampledAt
  if (!Number.isFinite(budget.sampledAt) || !Number.isFinite(age) || age < 0 || age > 2000)
    return 'stale-playback'
  return 'available'
}
export function predictCompletionMs(
  requestBytes: number | null,
  safePayloadMbps: number | null,
  ttfbMs: number | null,
): number | null {
  if (
    !Number.isSafeInteger(requestBytes) ||
    (requestBytes ?? 0) <= 0 ||
    safePayloadMbps === null ||
    !Number.isFinite(safePayloadMbps) ||
    safePayloadMbps <= 0 ||
    ttfbMs === null ||
    !Number.isFinite(ttfbMs) ||
    ttfbMs < 0
  )
    return null
  const bodyMs = (requestBytes! * 8) / (safePayloadMbps * 1000),
    totalMs = ttfbMs + bodyMs
  return Number.isFinite(bodyMs) && bodyMs >= 2 ** -1022 && Number.isFinite(totalMs) && totalMs > 0
    ? totalMs
    : null
}

export interface CompletionBudget {
  readonly timingBasis?: TimingBasis
  readonly ageMs?: number
  readonly requestBytes: number | null
  readonly playableBufferSec: number | null
  readonly sampledAt: number
}

export type PredictionReason =
  | 'available'
  | 'unknown-size'
  | 'unknown-buffer'
  | 'stale-playback'
  | 'unknown-body-rate'
  | 'cohort-incomplete'
