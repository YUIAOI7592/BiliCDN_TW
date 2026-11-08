import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  circuitCreditEligible,
  retryTransportEligible,
  classifyTransportResult,
} from '../../../src-v2/application/routing/transport-result.ts'
import { fixture, dash, media } from './routing-fixture.ts'
import { start } from '../../support/route-dispatch.ts'
import { testScope } from '../../support/scope.ts'
import {
  type RequestContext,
  type TransportObservation,
} from '../../../src-v2/domain/transport-model.ts'

function observation(request: RequestContext): TransportObservation {
  return {
    request,
    generation: request.generation,
    epoch: request.epoch,
    representation: request.representation,
    kind: request.kind,
    decisionId: request.decisionId,
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
    completedAt: 1000,
    outcome: 'success',
    responseUrlMatchesRequest: true,
  }
}

test('V2216 admission: health samples, circuit credit and retry proof have separate qualifications', (t) => {
  const f = fixture(testScope(t)),
    url = media('admission', 'a.m4s')
  f.adapter.transform(dash(url))
  const request = start(f, url, 1).request,
    ordinary = observation(request)
  const result = classifyTransportResult(ordinary)
  assert.equal(result.type, 'success')
  if (result.type !== 'success') throw Error('Expected success sample')
  assert.equal(circuitCreditEligible(ordinary, result.sample), true)
  assert.equal(retryTransportEligible(request, ordinary), true)
  const { retryVerifiedBytes: verifiedBytes, ...withoutProof } = ordinary
  assert.equal(verifiedBytes, ordinary.bytes)
  const untrusted = { ...withoutProof, circuitVerified: false }
  assert.equal(classifyTransportResult(untrusted).type, 'success')
  assert.equal(circuitCreditEligible(untrusted, result.sample), false)
  assert.equal(retryTransportEligible(request, untrusted), false)
  assert.equal(circuitCreditEligible({ ...ordinary, status: 200 }, result.sample), true)
  assert.equal(retryTransportEligible(request, { ...ordinary, status: 200 }), false)
  assert.equal(circuitCreditEligible(ordinary, { ...result.sample, bytes: 65535 }), false)
  assert.equal(retryTransportEligible(request, { ...ordinary, finalHost: 'other.example' }), false)
})

test('V2216 admission: static predicates preserve short-circuit reads', (t) => {
  const f = fixture(testScope(t)),
    url = media('admission', 'b.m4s')
  f.adapter.transform(dash(url))
  const request = start(f, url, 1).request,
    ordinary = observation(request)
  const result = classifyTransportResult(ordinary)
  if (result.type !== 'success') throw Error('Expected sample')
  const sample = {
    ...result.sample,
    get bytes(): number {
      throw Error('Late bytes read')
    },
  }
  assert.equal(circuitCreditEligible({ ...ordinary, circuitVerified: false }, sample), false)
  const unverified = {
    ...ordinary,
    retryVerifiedBytes: 0,
    get generation(): RequestContext['generation'] {
      throw Error('Late identity read')
    },
  }
  assert.equal(retryTransportEligible(request, unverified), false)
})
