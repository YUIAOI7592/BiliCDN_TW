import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, dash, media } from './routing-fixture.ts'
import { testScope } from '../../support/scope.ts'
import { start, finish } from '../../support/route-dispatch.ts'
import { fixture as runtimeFixture, media as runtimeMedia } from '../../support/runtime-fixture.ts'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'

for (const boundary of ['fresh', 'expired', 'policy', 'selection'] as const) {
  test(`V227 completion owner: ${boundary} playback facts do not invent ownership`, async (t) => {
    const f = fixture(testScope(t)),
      url = media('v227-budget', 'video.m4s')
    assert.equal(f.adapter.transform(dash(url)).accepted, true)
    await finish(f, start(f, url, 1))
    await finish(f, start(f, url, 2))
    const request = f.routes.latestRequested('video')!
    assert.ok(request.representation)
    assert.ok(typeof request.authorityRevision === 'number')
    assert.ok(typeof request.selectionRevision === 'number')
    const facts = {
      generation: request.generation,
      epoch: request.epoch,
      representation: request.representation,
      authorityRevision: request.authorityRevision,
      routePolicyRevision: request.routePolicyRevision,
      selectionRevision: request.selectionRevision,
      sampledAt: f.clock.now(),
      sampledTick: f.clock.monotonicNow(),
      playbackRate: 2,
      bufferAheadSec: 4,
      playbackRevision: 0,
      playableBufferSec: 2,
    }
    Reflect.get(f.routes, 'observePlaybackFacts').call(f.routes, facts)
    const session = f.session.get(),
      values = structuredClone([...f.storage.values])
    if (boundary === 'expired') f.clock.advance(2001)
    if (boundary === 'policy') f.routes.invalidateForUserSetting()
    if (boundary === 'selection')
      Reflect.get(f.routes, 'observePlaybackFacts').call(f.routes, {
        ...facts,
        selectionRevision: (facts.selectionRevision ?? 0) + 1,
      })
    const budget = Reflect.get(f.routes, 'completionBudget').call(
      f.routes,
      request.representation,
      65536,
    )
    assert.equal(budget !== null, boundary === 'fresh')
    if (boundary === 'fresh') {
      assert.ok(budget)
      assert.equal(budget.requestBytes, 65536)
      assert.equal(budget.playableBufferSec, 2)
      assert.equal(f.session.get(), session)
      assert.deepEqual([...f.storage.values], values)
    }
  })
}
test('V227 completion owner: real monitor and runtime forward buffer facts and stop revokes them', async (t) => {
  const f = runtimeFixture(t),
    body = runtimeMedia(227)
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
  const rep = f.session.get().representation!
  f.setVideo({
    ...f.video(),
    readyState: 4,
    width: 1920,
    height: 1080,
    playableBufferSec: 4,
    bufferAheadSec: 8,
  })
  f.deps.monitor.tick()
  assert.equal(f.routes.completionBudget(rep, 65536)?.playableBufferSec, 4)
  f.runtime.stop()
  f.deps.monitor.tick()
  assert.equal(f.routes.completionBudget(rep, 65536), null)
})
test('V227 completion owner: forced recovery ranks actual evidence using the owned playback budget', async (t) => {
  const f = fixture(testScope(t)),
    url = media('v227-recovery-budget', 'video.m4s')
  assert.equal(f.adapter.transform(dash(url)).accepted, true)
  await finish(f, start(f, url, 1))
  await finish(f, start(f, url, 2))
  const request = f.routes.latestRequested('video')!,
    a = TRUSTED_CATALOG[2],
    b = TRUSTED_CATALOG[3]
  for (const [host, overall, latency, duration] of [
    [a, 10, 10, 800],
    [b, 20, 300, 400],
  ] as const)
    for (let i = 0; i < 2; i++) {
      await f.evidence.record(host, 'video', {
        requestId: host + i,
        at: f.clock.now(),
        source: 'transport',
        outcome: 'success',
        throughputMbps: overall,
        ttfbMs: latency,
        failureKind: null,
        bytes: 1_000_000,
        elapsedMs: duration,
        timingBasis: 'xhr-terminal',
      })
    }
  f.routes.observePlaybackFacts({
    generation: request.generation,
    epoch: request.epoch,
    representation: request.representation,
    authorityRevision: request.authorityRevision!,
    routePolicyRevision: request.routePolicyRevision,
    selectionRevision: request.selectionRevision!,
    sampledAt: f.clock.now(),
    sampledTick: f.clock.monotonicNow(),
    playbackRate: 2,
    bufferAheadSec: 2,
    playbackRevision: 0,
    playableBufferSec: 1,
  })
  const decision = f.routes.recover(
    request.representation!,
    { kind: 'video', requiredMbps: 5, highDemand: false },
    'watchdog',
    request.targetHost,
    65536,
    'xhr-terminal',
  )
  assert.equal(decision.host, a)
  assert.equal(
    decision.ranking.find((row) => row.candidate.host === a)?.comparisonMode,
    'completion',
  )
  assert.equal(f.routes.snapshot().fallback.video?.plannedHost, a)
})
