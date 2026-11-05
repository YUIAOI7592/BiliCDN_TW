import type { CircuitControlStamp } from './model.ts'

export const CIRCUIT_OBSERVATION_MS = 300_000
export const CIRCUIT_SUCCESS_GAP_MS = 120_000
export const CIRCUIT_SETTLEMENT_GRACE_MS = 60_000
export const CIRCUIT_PENDING_LIMIT = 64
export const CIRCUIT_BACKOFF_MS = Object.freeze([600_000, 1_800_000, 7_200_000, 21_600_000])

export interface CircuitWindow {
  readonly id: string
  readonly stamp: CircuitControlStamp
  readonly start: number
  readonly deadline: number
  readonly hardDeadline: number
  readonly lastSuccess: number
}
export const sameCircuitStamp = (
  a: CircuitControlStamp | null,
  b: CircuitControlStamp | null,
): boolean =>
  !!a &&
  !!b &&
  a.generation === b.generation &&
  a.recordId === b.recordId &&
  a.revision === b.revision

export const startCircuitWindow = (
  id: string,
  stamp: CircuitControlStamp,
  now: number,
): CircuitWindow =>
  Object.freeze({
    id,
    stamp,
    start: now,
    deadline: now + CIRCUIT_OBSERVATION_MS,
    hardDeadline: now + CIRCUIT_OBSERVATION_MS + CIRCUIT_SETTLEMENT_GRACE_MS,
    lastSuccess: now,
  })

export function advanceCircuitWindow(period: CircuitWindow | null, now: number) {
  if (!period) return { period: null, reason: 'awaiting-new-transfer' }
  const reason =
    !Number.isFinite(now) || now < period.lastSuccess
      ? 'clock-invalid'
      : now >= period.hardDeadline
        ? 'settlement-expired'
        : now - period.lastSuccess > CIRCUIT_SUCCESS_GAP_MS
          ? 'success-gap-expired'
          : null
  return { period: reason ? null : period, reason }
}

export const circuitWindowReady = (period: CircuitWindow, now: number, pending: number): boolean =>
  advanceCircuitWindow(period, now).period !== null &&
  now >= period.deadline &&
  period.lastSuccess >= period.deadline &&
  pending === 0

export function failedCircuit(level: number, until: number, now: number) {
  const next = Math.min(4, Math.max(0, Math.ceil(level)) + 1)
  return { circuitLevel: next, circuitUntil: Math.max(until, now + CIRCUIT_BACKOFF_MS[next - 1]!) }
}
