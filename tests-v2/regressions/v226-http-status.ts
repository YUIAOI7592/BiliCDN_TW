import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyTransportResult } from '../../src-v2/application/routing/transport-result.ts'
import { epochId, generationId, type TransportObservation } from '../../src-v2/domain/model.ts'
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
