import type {
  CapacityConfidence,
  EvidenceMetrics,
  EvidenceSample,
  MediaKind,
  RouteEvidence,
  RouteState,
  TimingBasis,
} from './model.ts'

export const EVIDENCE_TTL_MS = 24 * 60 * 60 * 1000
export const FRESH_EVIDENCE_MS = 5 * 60 * 1000
export const MAX_EVIDENCE_SAMPLES = 12
export const MIN_THROUGHPUT_BYTES = 64 * 1024
const PROVEN_FAILURE_QUIET_MS = 30 * 60 * 1000
export const CIRCUIT_BACKOFF_MS = Object.freeze([
  10 * 60_000,
  30 * 60_000,
  2 * 3_600_000,
  6 * 3_600_000,
])
const positive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
const speed = (value: number | null): number | null =>
  positive(value) ? Math.min(100_000, value) : null

/** Optional measurement facts; legacy rates remain usable without these facts. */
export function sampleTiming(
  bytes: unknown,
  elapsedMs: unknown,
  ttfbMs: unknown,
): Readonly<{ bytes: number; elapsedMs: number }> | null {
  if (!Number.isSafeInteger(bytes) || !positive(bytes) || !positive(elapsedMs)) return null
  if (
    ttfbMs != null &&
    (typeof ttfbMs !== 'number' || !Number.isFinite(ttfbMs) || ttfbMs < 0 || ttfbMs >= elapsedMs)
  )
    return null
  return { bytes, elapsedMs }
}
export const emptyEvidence = (host: string, kind: MediaKind): RouteEvidence => ({
  host,
  kind,
  samples: Object.freeze([]),
  circuitLevel: 0,
  circuitUntil: 0,
  updatedAt: 0,
})
export const pruneSamples = (
  samples: readonly EvidenceSample[],
  now: number,
): readonly EvidenceSample[] =>
  Object.freeze(
    samples
      .filter(
        (sample) =>
          Number.isFinite(sample.at) && sample.at <= now && now - sample.at <= EVIDENCE_TTL_MS,
      )
      .sort(
        (a, b) =>
          a.at - b.at || (a.requestId < b.requestId ? -1 : a.requestId > b.requestId ? 1 : 0),
      )
      .slice(-MAX_EVIDENCE_SAMPLES),
  )
const hasSpeed = (sample: EvidenceSample): boolean =>
  sample.outcome === 'success' &&
  speed(sample.throughputMbps) !== null &&
  (sample.bytes === undefined || sample.bytes >= MIN_THROUGHPUT_BYTES)

export const addEvidenceSample = (
  evidence: RouteEvidence,
  sample: EvidenceSample,
  now: number,
): RouteEvidence => {
  const samples = pruneSamples([...evidence.samples, Object.freeze({ ...sample })], now)
  const failed = sample.outcome === 'failure',
    verified = hasSpeed(sample)
  const level = failed
    ? Math.min(CIRCUIT_BACKOFF_MS.length, evidence.circuitLevel + 1)
    : verified
      ? Math.max(0, evidence.circuitLevel - 1)
      : evidence.circuitLevel
  const circuitUntil = failed
    ? now + (CIRCUIT_BACKOFF_MS[level - 1] ?? CIRCUIT_BACKOFF_MS.at(-1) ?? 0)
    : verified && evidence.circuitUntil <= now
      ? 0
      : evidence.circuitUntil
  return Object.freeze({ ...evidence, samples, circuitLevel: level, circuitUntil, updatedAt: now })
}

/** Sample-count half lives; idle time is freshness, never a fabricated rate. */
export function conservativeEwma(values: readonly number[]): number | null {
  if (!values.length) return null
  let fast = values[0]!,
    slow = fast
  for (const value of values.slice(1)) {
    fast += (1 - 2 ** (-1 / 2)) * (value - fast)
    slow += (1 - 2 ** (-1 / 5)) * (value - slow)
  }
  return speed(Math.min(fast, slow, values.at(-1)!) * (values.length === 1 ? 0.7 : 1))
}
export const evidenceMetrics = (
  evidence: RouteEvidence | null,
  now: number,
  basis?: TimingBasis,
): EvidenceMetrics => {
  const unique = new Map<string, EvidenceSample>()
  for (const sample of pruneSamples(evidence?.samples ?? [], now))
    unique.set(sample.requestId || `${sample.at}:${sample.source}:${sample.outcome}`, sample)
  const samples = [...unique.values()]
  const successes = samples.filter((sample) => sample.outcome === 'success')
  const failures = samples.filter((sample) => sample.outcome === 'failure')
  const throughput = successes.filter(hasSpeed)
  const fresh = throughput.filter((sample) => now - sample.at <= FRESH_EVIDENCE_MS)
  const freshCount = new Set(
    fresh.filter((sample) => sample.requestId).map((sample) => sample.requestId),
  ).size
  const ttfb = successes
    .map((sample) => sample.ttfbMs)
    .filter((value): value is number => value !== null && Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b)
  const payload = fresh.flatMap((sample) => {
    if (!basis || sample.timingBasis !== basis) return []
    const timing = sampleTiming(sample.bytes, sample.elapsedMs, sample.ttfbMs)
    if (!timing || sample.ttfbMs === null) return []
    const rate = speed((timing.bytes * 8) / (timing.elapsedMs - sample.ttfbMs) / 1000)
    return rate === null ? [] : [{ rate, ttfb: sample.ttfbMs }]
  })
  const revalidationRequired = !!evidence?.circuitUntil && evidence.circuitUntil <= now
  const recentFailure = failures.some((sample) => now - sample.at < PROVEN_FAILURE_QUIET_MS)
  const state: RouteState =
    evidence && evidence.circuitUntil > now
      ? 'circuit-open'
      : successes.length >= 2 && !recentFailure
        ? 'proven'
        : successes.length
          ? 'usable'
          : failures.length
            ? 'degraded'
            : 'unknown'
  const capacityConfidence: CapacityConfidence = revalidationRequired
    ? 'revalidation'
    : freshCount >= 2
      ? 'sufficient'
      : freshCount === 1
        ? 'provisional'
        : throughput.length
          ? 'historical'
          : 'missing'
  return {
    state,
    capacityConfidence,
    revalidationRequired,
    safeThroughputMbps: conservativeEwma(throughput.map((sample) => sample.throughputMbps!)),
    medianTtfbMs: ttfb.length ? ttfb[Math.floor((ttfb.length - 1) / 2)]! : null,
    successCount: successes.length,
    failureCount: failures.length,
    speedSampleCount: throughput.length,
    freshSpeedCount: freshCount,
    newestSpeedAt: throughput.at(-1)?.at ?? null,
    safePayloadMbps: conservativeEwma(payload.map((row) => row.rate)),
    predictionTtfbMs: payload.length ? Math.max(...payload.map((row) => row.ttfb)) : null,
  }
}
