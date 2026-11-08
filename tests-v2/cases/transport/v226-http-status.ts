import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyTransportResult } from '../../../src-v2/application/routing/transport-result.ts'
import { epochId, generationId } from '../../../src-v2/domain/model.ts'
import { type TransportObservation } from '../../../src-v2/domain/transport-model.ts'
import { fixture, media } from '../routing/routing-fixture.ts'
import { testScope } from '../../support/scope.ts'
import { start } from '../../support/route-dispatch.ts'
for (const status of [400, 404, 408, 410, 429]) {
  test(`V226 T03: Catalog ${status} is an explicit bounded resource result`, () => {
    const observation: TransportObservation = {
      generation: generationId(1),
      epoch: epochId(1),
      decisionId: null,
      representation: null,
      kind: 'video',
      routeType: 'catalog-generated',
      originalHost: 'origin',
      targetHost: 'catalog',
      finalHost: 'catalog',
      streamKey: 'resource',
      status,
      bytes: 0,
      ttfbMs: 1,
      elapsedMs: 1,
      completedAt: 1,
      outcome: 'failure',
    }
    assert.equal(
      classifyTransportResult(observation).type,
      [404, 410].includes(status) ? 'catalog-resource-missing' : 'request-rejected',
    )
    assert.equal(classifyTransportResult({ ...observation, outcome: 'abort' }).type, 'ignore')
  })
}

for (const status of [404, 410, 429])
  test(`V226 T03: resource status ${status} cannot kill an unrelated resource on the same host`, async (t) => {
    const f = fixture(testScope(t)),
      state = f.session.get()
    const a = media('resource-a', 'v.m4s'),
      b = media('resource-b', 'v.m4s')
    for (const [key, url] of [
      ['a', a],
      ['b', b],
    ])
      assert.ok(
        f.vault.register({
          generation: state.generation,
          epoch: state.epoch,
          kind: 'video',
          key: key!,
          height: 1080,
          codec: 'avc',
          bandwidth: 4_000_000,
          urls: [url!],
          source: 'trusted-api',
        }),
      )
    const work = start(f, a, 1),
      other = f.routes.apply(b, 'video'),
      request = work.request
    assert.equal(other.decision.host, request.targetHost)
    await f.routes.observe({
      request,
      generation: request.generation,
      epoch: request.epoch,
      representation: request.representation,
      decisionId: request.decisionId,
      kind: 'video',
      routeType: request.routeType,
      originalHost: request.originalHost,
      targetHost: request.targetHost,
      finalHost: request.targetHost,
      streamKey: work.applied.streamKey,
      status,
      bytes: 0,
      ttfbMs: 1,
      elapsedMs: 1,
      completedAt: f.clock.now(),
      outcome: 'failure',
    })
    assert.equal(f.evidence.get(request.targetHost, 'video'), null)
    assert.deepEqual(f.restrictions.list(), [])
    assert.equal(f.routes.apply(b, 'video').decision, other.decision)
    if (status === 429) assert.equal(f.routes.apply(a, 'video').decision.id, request.decisionId)
    else assert.notEqual(f.routes.apply(a, 'video').decision.host, request.targetHost)
  })
