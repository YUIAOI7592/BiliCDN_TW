import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, media } from '../../support/runtime-fixture.ts'
import { createControlReadModel } from '../../../src-v2/ui/control-read-model.ts'
import { overviewPresentation } from '../../../src-v2/ui/overview-presentation.ts'

for (const state of ['recent', 'provisional', 'historical', 'revalidation'] as const) {
  test(`V227 overview: ${state} capacity retains numbers and identifies its evidence`, async (t) => {
    const f = fixture(t),
      body = media(227)
    assert.equal(f.playurl.transform(body).accepted, true)
    const url = body.data.dash.video[0]!.base_url
    for (let i = 0; i < 2; i++) {
      f.request(url)
      const request = f.routes.latestRequested('video')!
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
        streamKey: null,
        status: 206,
        bytes: 131072,
        ttfbMs: 10,
        elapsedMs: 100,
        completedAt: f.clock.now(),
        outcome: 'success',
      })
    }
    f.runtime.stop()
    const host = f.routes.latestRequested('video')!.targetHost
    if (state === 'provisional') {
      await f.deps.evidence.clear()
      await f.deps.evidence.record(host, 'video', {
        requestId: 'single',
        at: f.clock.now(),
        source: 'transport',
        outcome: 'success',
        throughputMbps: 20,
        ttfbMs: 10,
        failureKind: null,
      })
    }
    if (state === 'historical') f.clock.advance(300_001)
    if (state === 'revalidation') {
      await f.deps.evidence.record(host, 'video', {
        requestId: 'failed',
        at: f.clock.now(),
        source: 'transport',
        outcome: 'failure',
        throughputMbps: null,
        ttfbMs: null,
        failureKind: 'timeout',
      })
      f.clock.advance(600_000)
    }
    const model = createControlReadModel(f.deps).snapshot(),
      result = overviewPresentation(model, f.clock.now())
    assert.ok(result.safeMbps !== null)
    const expected = {
      recent: '近期容量',
      provisional: '單筆試用',
      historical: '歷史估計',
      revalidation: '待再驗證',
    }[state]
    assert.ok(result.speedHint.includes(expected), result.speedHint)
    if (state === 'historical' || state === 'revalidation')
      assert.ok(result.marginHint.includes('歷史估計'), result.marginHint)
  })
}
