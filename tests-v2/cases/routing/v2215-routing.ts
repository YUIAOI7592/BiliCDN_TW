import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RetryEvidence } from '../../../src-v2/application/routing/retry-evidence.ts'
import { capacityNumbers } from '../../../src-v2/application/routing/route-projection.ts'
import { fixture, media, dash } from './routing-fixture.ts'
import { start } from '../../support/route-dispatch.ts'
import { testScope } from '../../support/scope.ts'
import { requestId } from '../../../src-v2/domain/model.ts'
import type {
  RequestContext,
  TransportObservation,
} from '../../../src-v2/domain/transport-model.ts'
import {
  addEvidenceSample,
  emptyEvidence,
  evidenceMetrics,
  EVIDENCE_TTL_MS,
} from '../../../src-v2/domain/evidence.ts'

function observation(request: RequestContext, at: number): TransportObservation {
  return {
    request,
    generation: request.generation,
    epoch: request.epoch,
    decisionId: request.decisionId,
    representation: request.representation,
    kind: 'video',
    routeType: request.routeType,
    originalHost: request.originalHost,
    targetHost: request.targetHost,
    finalHost: request.targetHost,
    streamKey: null,
    status: 206,
    bytes: 131072,
    retryVerifiedBytes: 131072,
    elapsedMs: 100,
    ttfbMs: 10,
    completedAt: at,
    timingBasis: 'xhr-terminal',
    outcome: 'success',
  }
}

test('V2215 retry ledger preserves request identity, TTL, overlapping suppression and reset', (t) => {
  const f = fixture(testScope(t)),
    payload = dash(media('ledger', 'video.m4s'))
  assert.equal(f.adapter.transform(payload, 'trusted-api').accepted, true)
  start(f, payload.data.dash.video[0]!.base_url, 1)
  const base = f.routes.latestRequested('video')!
  const a: RequestContext = {
    ...base,
    requestId: requestId('ledger-a'),
    timingBasis: 'xhr-terminal',
  }
  const b: RequestContext = { ...a, requestId: requestId('ledger-b') }
  const ledger = new RetryEvidence()
  ledger.record(a, observation(a, 1000), () => 1000)
  ledger.record(a, observation(a, 1001), () => 1001)
  ledger.record(b, observation(b, 1001), () => 1001)
  assert.deepEqual(
    ledger.matching(a, a.targetHost).map((x) => [x.request.requestId, x.at]),
    [
      ['ledger-a', 1001],
      ['ledger-b', 1001],
    ],
  )
  assert.equal(ledger.matching({ ...a, timingBasis: 'fetch-consumer' }, a.targetHost).length, 0)
  const first = ledger.suppress(['ledger-a']),
    second = ledger.suppress(['ledger-a'])
  first()
  first()
  assert.equal(ledger.isSuppressed('ledger-a'), true)
  assert.deepEqual(
    ledger.matching(a, a.targetHost).map((x) => x.request.requestId),
    ['ledger-b'],
  )
  ledger.reset()
  assert.deepEqual(ledger.matching(a, a.targetHost), [])
  assert.equal(ledger.isSuppressed('ledger-a'), true)
  second()
  assert.equal(ledger.isSuppressed('ledger-a'), false)
  ledger.record(b, observation(b, 1001), () => 1001)
  ledger.prune(61001)
  assert.equal(ledger.matching(a, a.targetHost).length, 1)
  ledger.prune(61002)
  assert.equal(ledger.matching(a, a.targetHost).length, 0)
  assert.throws(
    () => ledger.suppress(Array.from({ length: 33 }, (_, i) => `scope-${i}`)),
    RangeError,
  )
})

test('V2215 capacity projection preserves independent speed, missing demand and expired evidence', () => {
  const at = 1000,
    evidence = addEvidenceSample(
      emptyEvidence('upos-sz-mirrorali.bilivideo.com', 'video'),
      {
        requestId: 'projection-sample',
        at,
        source: 'transport',
        outcome: 'success',
        throughputMbps: 20,
        ttfbMs: 10,
        failureKind: null,
      },
      at,
    )
  const before = JSON.stringify(evidence),
    metrics = evidenceMetrics(evidence, at)
  const value = capacityNumbers(evidence, metrics, at, null, null)
  assert.ok(metrics.safeThroughputMbps !== null && metrics.safeThroughputMbps > 0)
  assert.equal(value.safeMbps, metrics.safeThroughputMbps)
  assert.equal(value.sampleStatus, 'available')
  assert.equal(value.predictionReason, 'unknown-size')
  const expired = capacityNumbers(
    evidence,
    evidenceMetrics(evidence, at + EVIDENCE_TTL_MS + 1),
    at + EVIDENCE_TTL_MS + 1,
    null,
    null,
  )
  assert.equal(expired.safeMbps, null)
  assert.equal(expired.sampleStatus, 'expired')
  assert.equal(JSON.stringify(evidence), before)
})
