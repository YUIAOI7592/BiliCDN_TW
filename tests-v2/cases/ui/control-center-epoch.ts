import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createControlReadModel } from '../../../src-v2/ui/control-read-model.ts'
import { overviewPresentation } from '../../../src-v2/ui/overview-presentation.ts'
import { fixture, media } from '../routing/routing-fixture.ts'
import { finish, start } from '../../support/route-dispatch.ts'
import { fixture as runtimeFixture } from '../../support/runtime-fixture.ts'
import { FakeStorage } from '../../support/storage.ts'

for (const trigger of ['none', 'capacity', 'circuit-list', 'circuit-lock'] as const) {
  test(`route and overview snapshot stay in the current epoch during ${trigger} read`, async (t) => {
    const browser = runtimeFixture(t)
    const storage = Object.assign(new FakeStorage(), { sharedLockAvailable: () => true })
    const f = fixture(browser.scope, storage)
    const url = media('snapshot', 'base.m4s')
    const state = f.session.get()
    f.vault.register({
      generation: state.generation,
      epoch: state.epoch,
      kind: 'video',
      key: 'snapshot',
      codec: 'avc',
      height: 720,
      bandwidth: 4_000_000,
      urls: [url],
      source: 'trusted-api',
    })
    await finish(f, start(f, url, 1))
    await finish(f, start(f, url, 2))
    if (trigger === 'circuit-lock')
      await f.evidence.record('upos-hz-mirrorakam.akamaized.net', 'audio', {
        requestId: 'circuit-failure',
        at: f.clock.now(),
        source: 'transport',
        outcome: 'failure',
        throughputMbps: null,
        ttfbMs: null,
        failureKind: 'network',
      })

    assert.equal(f.routes.snapshot().currentCapacity?.safeMbps, 10.48576)
    let invalidated = false
    function invalidate() {
      if (invalidated) return
      invalidated = true
      const next = f.session.beginEpoch()
      f.vault.reset(next.generation, next.epoch)
      f.routes.resetEpoch()
    }
    if (trigger === 'capacity') {
      const get = f.evidence.get.bind(f.evidence)
      f.evidence.get = (...args) => {
        const row = get(...args)
        invalidate()
        return row
      }
    }
    if (trigger === 'circuit-list') {
      const list = f.evidence.list.bind(f.evidence)
      f.evidence.list = () => {
        const rows = list()
        invalidate()
        return rows
      }
    }
    if (trigger === 'circuit-lock')
      storage.sharedLockAvailable = () => {
        invalidate()
        return true
      }

    const model = createControlReadModel({ ...browser.deps, ...f }).snapshot()
    const routes = model.routes
    const overview = overviewPresentation(model, f.clock.now())
    const currentEpoch = f.session.get().epoch
    assert.equal(invalidated, trigger !== 'none', 'reentry must have occurred at the selected read')
    assert.equal(currentEpoch, state.epoch + (trigger === 'none' ? 0 : 1))
    if (trigger !== 'none') {
      assert.deepEqual(routes.requested, {})
      assert.deepEqual(routes.latest, {})
      assert.deepEqual(routes.fallback, {})
    }
    assert.deepEqual(
      {
        epoch: model.session.epoch,
        plan: Boolean(routes.activePlan),
        selection: routes.selection?.phase ?? null,
        representation: Boolean(routes.representation),
        attribution: routes.attribution,
        affinity: Boolean(routes.affinity),
        throughput: routes.currentCapacity?.safeMbps ?? null,
        overviewThroughput: overview.safeMbps,
      },
      trigger === 'none'
        ? {
            epoch: currentEpoch,
            plan: true,
            selection: 'confirmed',
            representation: true,
            attribution: 'confirmed',
            affinity: true,
            throughput: 10.48576,
            overviewThroughput: 10.48576,
          }
        : {
            epoch: currentEpoch,
            plan: false,
            selection: null,
            representation: false,
            attribution: 'awaiting-matched-video',
            affinity: false,
            throughput: null,
            overviewThroughput: null,
          },
    )
  })
}

test('route and overview snapshot discard a frame after two invalidations', (t) => {
  const f = runtimeFixture(t)
  const initial = f.session.get().epoch
  let reads = 0
  const model = createControlReadModel({
    ...f.deps,
    restrictions: {
      list: () => {
        reads++
        const next = f.session.beginEpoch()
        f.vault.reset(next.generation, next.epoch)
        f.routes.resetEpoch()
        return []
      },
    },
  }).snapshot()
  assert.equal(reads, 2)
  assert.equal(model.session.epoch, Number(initial) + 2)
  assert.equal(model.routes.attribution, 'awaiting-matched-video')
  assert.equal(overviewPresentation(model, f.clock.now()).safeMbps, null)
})
