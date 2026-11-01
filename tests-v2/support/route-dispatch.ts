import assert from 'node:assert/strict'
import type { fixture } from '../regressions/functional-races/routing-fixture.ts'
import {
  requestId,
  type RequestContext,
  type TransportObservation,
} from '../../src-v2/domain/model.ts'
import type { AppliedRouteDecision } from '../../src-v2/application/route-contracts.ts'
export function start(f: ReturnType<typeof fixture>, url: string, serial: number) {
  const applied: AppliedRouteDecision = f.routes.apply(url, 'video')
  assert.ok(applied.url && applied.context)
  const identity = applied.context
  const request: RequestContext = {
    requestId: requestId(`rigor-${serial}`),
    generation: identity.generation,
    epoch: identity.epoch,
    representation: identity.representation,
    authorityRevision: identity.authorityRevision,
    routePolicyRevision: f.routes.policyRevision(),
    kind: 'video',
    attributionStatus: 'matched',
    attributionSource: 'exact',
    decisionStage: 'request',
    decisionId: applied.decision.id,
    routeType: applied.decision.routeType,
    originalHost: applied.sourceHost ?? applied.decision.host!,
    targetHost: applied.decision.host!,
    sourceHost: applied.sourceHost,
    playurlHostChanged: false,
    playurlOutput: null,
    urlChanged: false,
    hostChanged: false,
    startedAt: f.clock.now(),
  }
  f.routes.requestStarted(request)
  return { applied, request }
}

export async function finish(
  f: ReturnType<typeof fixture>,
  work: ReturnType<typeof start>,
  failure = false,
) {
  f.clock.advance(100)
  const r = work.request
  const observation: TransportObservation = {
    request: r,
    generation: r.generation,
    epoch: r.epoch,
    representation: r.representation,
    kind: 'video',
    decisionId: r.decisionId,
    routeType: r.routeType,
    originalHost: r.originalHost,
    targetHost: r.targetHost,
    finalHost: failure ? null : r.targetHost,
    streamKey: work.applied.streamKey,
    status: failure ? 0 : 206,
    bytes: failure ? 0 : 131072,
    ttfbMs: failure ? null : 10,
    elapsedMs: f.clock.now() - r.startedAt,
    completedAt: f.clock.now(),
    outcome: failure ? 'failure' : 'success',
    ...(failure ? { failureKind: 'network' as const } : {}),
  }
  await f.routes.observe(observation)
}
