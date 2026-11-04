import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evidenceMetrics, emptyEvidence } from '../../src-v2/domain/evidence.ts'
import { orderCapacityRows } from '../../src-v2/domain/route-capacity.ts'
import { evaluateEarlyRetry } from '../../src-v2/domain/early-retry.ts'

for (const basis of ['fetch-consumer', 'xhr-terminal', 'probe-reader'] as const)
  test(`V230 completion samples match only ${basis}`, () => {
    const samples = (['fetch-consumer', 'xhr-terminal', 'probe-reader'] as const).map(
      (timingBasis, i) => ({
        requestId: String(i),
        at: 1000,
        source: 'transport' as const,
        outcome: 'success' as const,
        throughputMbps: 10,
        ttfbMs: 10,
        failureKind: null,
        bytes: 1_000_000,
        elapsedMs: 110 + i * 100,
        timingBasis,
      }),
    )
    const metrics = evidenceMetrics({ ...emptyEvidence('a', 'video'), samples }, 1000, basis)
    assert.equal(
      metrics.safePayloadMbps,
      (8_000 / (100 + samples.findIndex((s) => s.timingBasis === basis) * 100)) * 0.7,
    )
    assert.equal(metrics.freshSpeedCount, 3, 'capacity keeps the same twelve-sample window')
  })
test('V230 legacy timing cannot qualify a completion comparison', () => {
  const sample = {
    requestId: 'old',
    at: 1000,
    source: 'transport' as const,
    outcome: 'success' as const,
    throughputMbps: 10,
    ttfbMs: 10,
    failureKind: null,
    bytes: 1_000_000,
    elapsedMs: 110,
  }
  const metrics = evidenceMetrics(
    { ...emptyEvidence('a', 'video'), samples: [sample] },
    1000,
    'xhr-terminal',
  )
  assert.equal(metrics.safeThroughputMbps, 7)
  assert.equal(metrics.safePayloadMbps, null)
})
function rows() {
  return [
    {
      candidateOrder: 0,
      capacityConfidence: 'sufficient' as const,
      safeThroughputMbps: 20,
      demandRatio: 4,
      safePayloadMbps: 20,
      predictionTtfbMs: 800,
    },
    {
      candidateOrder: 1,
      capacityConfidence: 'provisional' as const,
      safeThroughputMbps: 10,
      demandRatio: 2,
      safePayloadMbps: 10,
      predictionTtfbMs: 10,
    },
  ]
}
test('V230 adequate provisional and sufficient candidates share a complete time cohort', () => {
  const ranked = orderCapacityRows(
    rows(),
    { requestBytes: 65536, playableBufferSec: 4, sampledAt: 1000 },
    1000,
  )
  assert.equal(ranked[0]!.candidateOrder, 1)
  assert.equal(ranked[0]!.comparisonMode, 'completion')
})
test('V230 incomplete adequate cohort restores every original tier', () => {
  const source = rows()
  source[0]!.safePayloadMbps = null as unknown as number
  const ranked = orderCapacityRows(
    source,
    { requestBytes: 65536, playableBufferSec: 4, sampledAt: 1000 },
    1000,
  )
  assert.equal(ranked[0]!.candidateOrder, 0)
  assert.ok(ranked.every((r) => r.comparisonMode === 'throughput'))
})
test('V230 equal completion prefers sufficient evidence before fixed candidate order', () => {
  const source = rows().map((r) => ({ ...r, safePayloadMbps: 10, predictionTtfbMs: 10 }))
  source.reverse()
  assert.equal(
    orderCapacityRows(
      source,
      { requestBytes: 65536, playableBufferSec: 4, sampledAt: 1000 },
      1000,
    )[0]!.capacityConfidence,
    'sufficient',
  )
})
for (const buffer of [1, 2, 3, 4, 5])
  test(`V230 retry reserves two seconds before ${buffer}s buffer deadline`, () => {
    const result = evaluateEarlyRetry({
      now: 2000,
      startedAt: 0,
      currentHost: 'old',
      loadedBytes: 100000,
      totalBytes: 1000000,
      recentBytesPerSec: 10000,
      playableBufferSec: buffer,
      requiredMbps: 1,
      alternative: {
        host: 'next',
        safeMbps: 16,
        safePayloadMbps: 16,
        ttfbMs: 100,
        successCount: 2,
        oldestAt: 1000,
      },
    })
    assert.equal(result.eligible, 2.6 <= 0.8 * buffer)
    if (result.eligible) assert.equal(result.alternativeSec, 2.6)
  })

for (const ageMs of [1499, 1500, NaN, -1])
  test(`V230 retry age uses independent monotonic observation ${String(ageMs)}`, () => {
    const result = evaluateEarlyRetry({
      now: 100000,
      startedAt: 1,
      ageMs,
      currentHost: 'old',
      loadedBytes: 100000,
      totalBytes: 1000000,
      recentBytesPerSec: 10000,
      playableBufferSec: 4,
      requiredMbps: 1,
      alternative: {
        host: 'next',
        safeMbps: 16,
        safePayloadMbps: 16,
        ttfbMs: 100,
        successCount: 2,
        oldestAt: 99999,
      },
    })
    assert.equal(result.eligible, ageMs === 1500)
  })
