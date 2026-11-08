import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rankRoutes, type RankRoutesInput } from '../../../src-v2/domain/routing.ts'
import { emptyEvidence } from '../../../src-v2/domain/evidence.ts'
import { evaluateEarlyRetry } from '../../../src-v2/domain/early-retry.ts'
import { type RouteEvidence } from '../../../src-v2/domain/evidence-model.ts'
import { closedRangeLength, predictCompletionMs } from '../../../src-v2/domain/route-completion.ts'

const now = 2_000_000_000_000
function facts(incomplete = false, age = 0, requestBytes: number | null = 65536): RankRoutesInput {
  const rows = new Map<string, RouteEvidence>(
    ['fast-start.example', 'fast-body.example'].map((host, index) => [
      host,
      {
        ...emptyEvidence(host, 'video'),
        samples: [0, 1].map((i) => ({
          requestId: host + i,
          at: now,
          source: 'transport' as const,
          outcome: 'success' as const,
          throughputMbps: index === 0 ? 10 : 20,
          ttfbMs: index === 0 ? 10 : 300,
          failureKind: null,
          timingBasis: 'xhr-terminal' as const,
          ...(incomplete && index === 0
            ? {}
            : { bytes: 1_000_000, elapsedMs: index === 0 ? 800 : 400 }),
        })),
        updatedAt: now,
      },
    ]),
  )
  return {
    candidates: [...rows.keys()].map((host, catalogIndex) => ({
      host,
      catalogIndex,
      type: 'catalog-generated' as const,
      kind: 'video' as const,
    })),
    evidenceFor: (host: string) => rows.get(host) ?? null,
    restrictions: {
      disabledCatalogHosts: new Set<string>(),
      defaultUnavailableHosts: new Set<string>(),
      blackHosts: new Set<string>(),
      deadHosts: new Set<string>(),
      hostLocked: new Set<string>(),
    },
    demand: { kind: 'video' as const, requiredMbps: 5, highDemand: false },
    fixedHost: null,
    current: null,
    boundary: 'startup' as const,
    failedHost: null,
    completionBudget: {
      requestBytes,
      playableBufferSec: 1,
      sampledAt: now - age,
      timingBasis: 'xhr-terminal',
    },
  }
}
test('V227 completion: a small request prefers fast response over greater body capacity', () => {
  const rows = rankRoutes(facts(), now)
  assert.equal(rows[0]?.candidate.host, 'fast-start.example')
  assert.equal(Reflect.get(rows[0]!, 'comparisonMode'), 'completion')
})
test('V227 completion: an incomplete candidate switches its entire cohort to throughput comparison', () => {
  const rows = rankRoutes(facts(true), now)
  assert.equal(rows[0]?.candidate.host, 'fast-body.example')
  assert.ok(rows.every((row) => Reflect.get(row, 'comparisonMode') === 'throughput'))
})
for (const [age, host] of [
  [2000, 'fast-start.example'],
  [2001, 'fast-body.example'],
] as const) {
  test(`V227 completion: playback fact age ${age}ms is bounded`, () => {
    assert.equal(rankRoutes(facts(false, age), now)[0]?.candidate.host, host)
  })
}
test('V227 completion: missing size keeps throughput ordering without fabricating bytes', () => {
  assert.equal(rankRoutes(facts(false, 0, null), now)[0]?.candidate.host, 'fast-body.example')
})
test('V227 completion: a larger request selects body capacity using the same time model', () => {
  assert.equal(rankRoutes(facts(false, 0, 10_000_000), now)[0]?.candidate.host, 'fast-body.example')
})
test('V227 completion: early retry adds TTFB only to body transfer time', () => {
  const result = evaluateEarlyRetry({
    now: 2000,
    startedAt: 0,
    currentHost: 'old.example',
    loadedBytes: 100_000,
    totalBytes: 1_000_000,
    recentBytesPerSec: 10_000,
    playableBufferSec: 4,
    requiredMbps: 1,
    alternative: {
      host: 'next.example',
      safeMbps: 8 / 3,
      ttfbMs: 2500,
      successCount: 2,
      oldestAt: 1000,
      ...{ safePayloadMbps: 16 },
    },
  })
  assert.equal(predictCompletionMs(1_000_000, 16, 2500), 3000, 'TTFB is included exactly once')
  assert.equal(
    result.eligible,
    false,
    'three-second delivery plus two-second handoff exceeds 80% of four seconds',
  )
  assert.equal(result.reason, 'alternative-late')
  const eligible = evaluateEarlyRetry({
    now: 2000,
    startedAt: 0,
    currentHost: 'old.example',
    loadedBytes: 100_000,
    totalBytes: 1_000_000,
    recentBytesPerSec: 10_000,
    playableBufferSec: 4,
    requiredMbps: 1,
    alternative: {
      host: 'next.example',
      safeMbps: 8 / 3,
      safePayloadMbps: 16,
      ttfbMs: 500,
      successCount: 2,
      oldestAt: 1000,
    },
  })
  assert.equal(eligible.eligible, true)
  assert.equal(eligible.remainingSec, 90, 'remaining bytes exclude the already delivered bytes')
  assert.equal(eligible.alternativeSec, 3, 'two-second handoff plus one-second complete retry')
})
for (const [value, length] of [
  ['bytes=0-0', 1],
  ['bytes=10-65545', 65536],
  [' bytes=0-99 ', 100],
  ['bytes=1-', null],
  ['bytes=-100', null],
  ['bytes=0-1,3-4', null],
  ['bytes=10-9', null],
  ['bytes=0-9007199254740992', null],
  ['bytes=0-9007199254740991', null],
  ['', null],
] as const) {
  test(`V227 completion: closed Range ${value} yields only a bounded exact length`, () =>
    assert.equal(closedRangeLength(value), length))
}
test('V227 completion: unknown body timing cannot acquire an early retry assessment', () => {
  const result = evaluateEarlyRetry({
    now: 2000,
    startedAt: 0,
    currentHost: 'old.example',
    loadedBytes: 100_000,
    totalBytes: 1_000_000,
    recentBytesPerSec: 10_000,
    playableBufferSec: 4,
    requiredMbps: 1,
    alternative: {
      host: 'next.example',
      safeMbps: 20,
      ttfbMs: 10,
      successCount: 2,
      oldestAt: 1000,
    },
  })
  assert.equal(result.eligible, false)
  assert.equal(result.reason, 'alternative-timing')
})
