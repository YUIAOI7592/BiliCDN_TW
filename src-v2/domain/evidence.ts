import type { EvidenceSample, MediaKind, RouteEvidence, RouteState } from './model.ts'

export const EVIDENCE_TTL_MS = 24 * 60 * 60 * 1000
export const EVIDENCE_HALF_LIFE_MS = 2 * 60 * 60 * 1000
export const MAX_EVIDENCE_SAMPLES = 12
export const MIN_THROUGHPUT_BYTES = 64 * 1024
const PROVEN_FAILURE_QUIET_MS = 30 * 60 * 1000
export const CIRCUIT_BACKOFF_MS = Object.freeze([10 * 60_000, 30 * 60_000, 2 * 3_600_000, 6 * 3_600_000])

const finite = (value: number, min: number, max: number): number =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min

export const emptyEvidence = (host: string, kind: MediaKind): RouteEvidence => ({
  host,
  kind,
  samples: Object.freeze([]),
  circuitLevel: 0,
  circuitUntil: 0,
  updatedAt: 0,
})

export const pruneSamples = (samples: readonly EvidenceSample[], now: number): readonly EvidenceSample[] =>
  Object.freeze(samples.filter(sample => now - sample.at <= EVIDENCE_TTL_MS).slice(-MAX_EVIDENCE_SAMPLES))

export const addEvidenceSample = (evidence: RouteEvidence, sample: EvidenceSample, now: number): RouteEvidence => {
  const samples = pruneSamples([...evidence.samples, Object.freeze({ ...sample })], now)
  const failed = sample.outcome === 'failure'
  const level = failed ? Math.min(CIRCUIT_BACKOFF_MS.length, evidence.circuitLevel + 1) : Math.max(0, evidence.circuitLevel - 1)
  const circuitUntil = failed ? now + (CIRCUIT_BACKOFF_MS[level - 1] ?? CIRCUIT_BACKOFF_MS.at(-1) ?? 0)
    : evidence.circuitUntil > now ? evidence.circuitUntil : 0
  return Object.freeze({ ...evidence, samples, circuitLevel: level, circuitUntil, updatedAt: now })
}

interface WeightedValue { readonly value: number; readonly weight: number }
const weightedQuantile = (rows: readonly WeightedValue[], quantile: number): number | null => {
  if (!rows.length) return null
  const sorted = [...rows].sort((a, b) => a.value - b.value)
  const total = sorted.reduce((sum, row) => sum + row.weight, 0)
  const target = total * quantile
  let seen = 0
  for (const row of sorted) {
    seen += row.weight
    if (seen >= target) return row.value
  }
  return sorted.at(-1)?.value ?? null
}

export const evidenceMetrics = (evidence: RouteEvidence | null, now: number): {
  readonly state: RouteState
  readonly safeThroughputMbps: number | null
  readonly medianTtfbMs: number | null
  readonly successCount: number
  readonly failureCount: number
} => {
  if (!evidence) return { state: 'unknown', safeThroughputMbps: null, medianTtfbMs: null, successCount: 0, failureCount: 0 }
  const samples = pruneSamples(evidence.samples, now)
  const successes = samples.filter(sample => sample.outcome === 'success')
  const failures = samples.filter(sample => sample.outcome === 'failure')
  const throughput = successes.filter(sample => sample.throughputMbps !== null && sample.throughputMbps > 0)
  let safe: number | null = null
  if (throughput.length === 1) safe = (throughput[0]?.throughputMbps ?? 0) * 0.7
  else if (throughput.length === 2) safe = Math.min(...throughput.map(sample => sample.throughputMbps ?? 0))
  else if (throughput.length >= 3) {
    safe = weightedQuantile(throughput.map(sample => ({
      value: sample.throughputMbps ?? 0,
      weight: Math.pow(0.5, Math.max(0, now - sample.at) / EVIDENCE_HALF_LIFE_MS),
    })), 0.25)
  }
  const ttfb = successes.map(sample => sample.ttfbMs).filter((value): value is number => value !== null && value >= 0).sort((a, b) => a - b)
  const median = ttfb.length ? ttfb[Math.floor((ttfb.length - 1) / 2)] ?? null : null
  const recentFailure = failures.some(sample => now - sample.at < PROVEN_FAILURE_QUIET_MS)
  let state: RouteState = 'unknown'
  if (evidence.circuitUntil > now) state = 'circuit-open'
  else if (successes.length >= 2 && !recentFailure) state = 'proven'
  else if (successes.length) state = 'usable'
  else if (failures.length) state = 'degraded'
  return {
    state,
    safeThroughputMbps: safe === null ? null : finite(safe, 0, 100_000),
    medianTtfbMs: median,
    successCount: successes.length,
    failureCount: failures.length,
  }
}
