import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addEvidenceSample, emptyEvidence, evidenceMetrics, EVIDENCE_TTL_MS } from '../../src-v2/domain/evidence.ts'
import type { EvidenceSample, RouteEvidence } from '../../src-v2/domain/model.ts'

const now = 2_000_000_000_000
const sample = (id: string, speed: number | null, at = now): EvidenceSample => ({
  requestId: id, at, source: 'transport', outcome: 'success', throughputMbps: speed,
  ttfbMs: 100, failureKind: null,
})
const evidence = (samples: readonly EvidenceSample[]): RouteEvidence => ({
  ...emptyEvidence('cdn.example', 'video'), samples, updatedAt: now,
})
const metric = (row: RouteEvidence, key: string, at = now): unknown => Reflect.get(evidenceMetrics(row, at), key)

test('V227 evidence: dual EWMA permits a slow bounded recovery instead of retaining the minimum', () => {
  const row = evidence([sample('first', 100, now - 1), sample('second', 200)])
  const expected = 100 + (1 - 2 ** (-1 / 5)) * 100
  assert.ok(Math.abs(evidenceMetrics(row, now).safeThroughputMbps! - expected) < 1e-10)
})
test('V227 evidence: a new low immediately bounds both EWMA lines', () => {
  const row = evidence([sample('first', 100, now - 2), sample('second', 200, now - 1), sample('third', 5)])
  assert.equal(evidenceMetrics(row, now).safeThroughputMbps, 5)
})
test('V227 evidence: one sample retains the seventy percent discount and provisional capacity', () => {
  const row = evidence([sample('one', 10)])
  assert.equal(evidenceMetrics(row, now).safeThroughputMbps, 7)
  assert.equal(metric(row, 'capacityConfidence'), 'provisional')
  assert.equal(metric(row, 'freshSpeedCount'), 1)
})
test('V227 evidence: reachability successes do not grant sufficient capacity', () => {
  const row = evidence([sample('one', null), sample('two', null)])
  assert.equal(evidenceMetrics(row, now).state, 'proven')
  assert.equal(metric(row, 'capacityConfidence'), 'missing')
  assert.equal(metric(row, 'speedSampleCount'), 0)
})
test('V227 evidence: repeated request identifiers cannot grant sufficient capacity', () => {
  const row = evidence([sample('same', 10, now - 1), sample('same', 20)])
  assert.equal(metric(row, 'freshSpeedCount'), 1)
  assert.equal(metric(row, 'capacityConfidence'), 'provisional')
})
for (const [age, confidence] of [[300_000, 'sufficient'], [300_001, 'historical']] as const) {
  test(`V227 evidence: freshness boundary ${age}ms uses sample times instead of updatedAt`, () => {
    const row = evidence([sample('one', 10, now - age), sample('two', 20, now - age)])
    assert.equal(metric(row, 'capacityConfidence'), confidence)
    assert.ok(evidenceMetrics(row, now).safeThroughputMbps! > 0)
  })
}
for (const [age, available] of [[EVIDENCE_TTL_MS, true], [EVIDENCE_TTL_MS + 1, false]] as const) {
  test(`V227 evidence: retained speed TTL boundary ${age}ms`, () => {
    const row = evidence([sample('one', 10, now - age)])
    assert.equal(evidenceMetrics(row, now).safeThroughputMbps !== null, available)
  })
}
test('V227 evidence: future samples do not create current capacity', () => {
  assert.equal(evidenceMetrics(evidence([sample('future', 100, now + 1)]), now).safeThroughputMbps, null)
})
test('V227 evidence: equal timestamps have a stable request-id ordering', () => {
  const a = sample('a', 5), b = sample('b', 20), c = sample('c', 100)
  assert.deepEqual(evidenceMetrics(evidence([c, a, b]), now), evidenceMetrics(evidence([a, b, c]), now))
})
test('V227 evidence: valid body timing is separate from end-to-end throughput', () => {
  const s = Object.assign(sample('body', 8), {bytes: 1_000_000, elapsedMs: 1000, ttfbMs: 500})
  const row = evidence([s])
  assert.equal(evidenceMetrics(row, now).safeThroughputMbps, 5.6)
  assert.equal(metric(row, 'safePayloadMbps'), 11.2)
})
for (const elapsedMs of [0, 100, Infinity, NaN]) {
  test(`V227 evidence: invalid or zero body interval ${String(elapsedMs)} cannot predict completion`, () => {
    const row = evidence([Object.assign(sample('body', 8), {bytes: 1_000_000, elapsedMs})])
    assert.equal(metric(row, 'safePayloadMbps'), null)
    assert.equal(evidenceMetrics(row, now).safeThroughputMbps, 5.6)
  })
}
test('V227 evidence: circuit expiry requires capacity revalidation and a short success cannot clear it', () => {
  const expired = {...evidence([sample('old', 100, now - 2000)]), circuitLevel: 2, circuitUntil: now - 1000}
  const short = addEvidenceSample(expired, sample('short', null), now)
  assert.equal(short.circuitUntil, expired.circuitUntil)
  assert.equal(metric(short, 'revalidationRequired'), true)
  assert.equal(metric(short, 'capacityConfidence'), 'revalidation')
  const verified = addEvidenceSample(short, Object.assign(sample('full', 8), {bytes: 1_000_000, elapsedMs: 1000}), now)
  assert.equal(verified.circuitUntil, 0)
  assert.equal(metric(verified, 'revalidationRequired'), false)
})
test('V227 evidence: a failure after circuit expiry retains the original bounded backoff progression', () => {
  const expired = {...emptyEvidence('cdn.example', 'video'), circuitLevel: 2, circuitUntil: now - 1}
  const failed = addEvidenceSample(expired, {...sample('failure', null), outcome:'failure', failureKind:'timeout'}, now)
  assert.equal(failed.circuitLevel, 3)
  assert.equal(failed.circuitUntil, now + 2 * 3_600_000)
})
