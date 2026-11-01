import { start, finish } from '../support/route-dispatch.ts'
// V226 desired behavior converted from preserved v2.2.5 counterexamples.
import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, media, dash } from './functional-races/routing-fixture.ts'
import { testScope } from '../support/scope.ts'
import { MeasurementController } from '../../src-v2/application/measurement-controller.ts'
import { MeasurementMetaStore } from '../../src-v2/state/measurement-meta-store.ts'

function setup(t: TestContext) {
  return { scope: testScope(t) }
}

for (const safeMbps of [12, 20]) {
  test(
    `V226 S10: successful candidate safe=${safeMbps} demand=10`,
    { timeout: 10000 },
    async (t) => {
      const { scope } = setup(t),
        f = fixture(scope)
      await f.settings.update({ considerNativeSources: true })
      const url = media('rigor-startup', 'video.m4s')
      assert.equal(f.adapter.transform(dash(url)).accepted, true)
      const options = f.routes.startupOptions(url)!
      assert.equal(options.demand.requiredMbps, 10)
      assert.equal(options.candidates.length, 3)
      const original = options.candidates.find((c) => c.original)!
      const successful = options.candidates.find((c) => !c.original)!
      const controller = scope.own(
        new MeasurementController(
          f.routes,
          new MeasurementMetaStore(f.storage, f.clock.now),
          {
            read: async ({ host }) =>
              host === successful.host
                ? {
                    bytes: 65536,
                    elapsedMs: (65536 * 8 * 0.7) / (safeMbps * 1000),
                    ttfbMs: 1,
                    status: 206,
                    directRange: true,
                    reason: 'measured',
                  }
                : {
                    bytes: 0,
                    elapsedMs: 3000,
                    ttfbMs: null,
                    status: 0,
                    directRange: false,
                    reason: 'timeout',
                  },
          },
          f.clock.now,
          f.clock,
          undefined,
          () => 0,
          f.settings,
        ),
      )
      await controller.prepareStartup(url)
      const expected = successful.host
      assert.equal(controller.snapshot().startup?.selectedHost, expected)
      assert.equal(f.routes.apply(url).decision.host, expected)
      assert.equal(
        controller.snapshot().startup?.results?.find((r) => r.host === original.host)?.valid,
        false,
      )
      assert.equal(f.clock.pendingCount, 0)
    },
  )
}

for (const newContent of [false, true]) {
  test(
    `V226 L02: late A transfers after confirmed B; newContent=${newContent}`,
    { timeout: 10000 },
    async (t) => {
      const { scope } = setup(t),
        f = fixture(scope)
      const body = dash(media('rigor-quality', 'a.m4s'))
      body.data.dash.video.push({
        ...body.data.dash.video[0]!,
        id: 120,
        height: 2160,
        bandwidth: 8000000,
        base_url: media('rigor-quality', 'b.m4s'),
      })
      assert.equal(
        f.adapter.transform(body, 'trusted-api', undefined, { contentId: '101' }).accepted,
        true,
      )
      const a = body.data.dash.video[0]!.base_url,
        b = body.data.dash.video[1]!.base_url
      await finish(f, start(f, a, 1))
      await finish(f, start(f, a, 2))
      const old1 = start(f, a, 3),
        old2 = start(f, a, 4)
      const next1 = start(f, b, 5),
        next2 = start(f, b, 6)
      assert.notEqual(old1.request.representation, next1.request.representation)
      await finish(f, next1)
      await finish(f, next2)
      assert.equal(f.session.get().representation, next2.request.representation)
      if (newContent) {
        assert.equal(
          f.adapter.transform(dash(media('rigor-next', 'c.m4s')), 'trusted-api', undefined, {
            contentId: '102',
          }).accepted,
          true,
        )
        assert.equal(f.vault.isCurrentIdentity(old1.applied.context!), false)
      }
      await finish(f, old1)
      await finish(f, old2)
      if (newContent) {
        assert.equal(f.session.get().representation, null)
        assert.equal(f.routes.snapshot().latest.video, undefined)
      } else {
        assert.equal(f.session.get().representation, next2.request.representation)
        assert.equal(
          f.routes.latestRequested('video')?.representation,
          next2.request.representation,
        )
        assert.equal(
          f.routes.snapshot().currentCapacity?.representation,
          next2.request.representation,
        )
      }
    },
  )
}

test(
  'V226 T02: 4Mbps video at rate 2 uses the same 10Mbps demand for failure recovery',
  { timeout: 10000 },
  async (t) => {
    const { scope } = setup(t),
      f = fixture(scope),
      body = dash(media('rigor-demand', 'v.m4s'))
    assert.equal(f.adapter.transform(body).accepted, true)
    f.routes.observePlaybackRate(2)
    const work = start(f, body.data.dash.video[0]!.base_url, 1)
    const bandwidth = f.vault.groupSummary(work.request.representation!)!.bandwidth
    assert.equal(Math.max(2, (bandwidth / 1000000) * f.routes.playbackRate() * 1.25), 10)
    const recover = f.routes.recover.bind(f.routes)
    let observed: number | null = null
    f.routes.recover = (rep, demand, boundary, failed) => {
      observed = demand.requiredMbps
      return recover(rep, demand, boundary, failed)
    }
    await finish(f, work, true)
    assert.equal(observed, 10)
  },
)

test(
  'V226 R04: valid preferred host survives a different startup cursor',
  { timeout: 10000 },
  async (t) => {
    const { scope } = setup(t),
      f = fixture(scope)
    await f.settings.update({ considerNativeSources: true })
    const url = media('rigor-rescue', 'v.m4s')
    assert.equal(f.adapter.transform(dash(url)).accepted, true)
    const base = f.routes.startupOptions(url, 0)!,
      rotated = f.routes.startupOptions(url, 5)!
    const preferred = rotated.candidates.find(
      (c) => !base.candidates.some((b) => b.host === c.host),
    )!
    assert.ok(preferred)
    await f.evidence.record(preferred.host, 'video', {
      requestId: 'rigor-success',
      at: f.clock.now(),
      source: 'challenge',
      outcome: 'success',
      throughputMbps: 40,
      ttfbMs: 1,
      failureKind: null,
    })
    const original = base.candidates.find((c) => c.original)!
    const result = f.routes.recoverStartup(
      original.context.representation,
      base.demand,
      original.host,
      [preferred.host],
    )
    assert.ok(result)
    assert.equal(result.host, preferred.host)
    assert.ok(rotated.candidates.some((c) => c.host === result.host))
  },
)

test('V226 H01 late old-host success learns without replacing current affinity', async (t) => {
  const scope = testScope(t),
    f = fixture(scope),
    body = dash(media('v226-affinity', 'v.m4s'))
  assert.equal(f.adapter.transform(body).accepted, true)
  const url = body.data.dash.video[0]!.base_url
  await finish(f, start(f, url, 1))
  await finish(f, start(f, url, 2))
  const old = start(f, url, 3),
    previous = old.request.targetHost
  const alternative = f.routes
    .startupOptions(url)!
    .candidates.find((candidate) => candidate.host !== previous)!
  assert.ok(f.routes.commitStartupChoice(url, alternative, 'current-host-switch'))
  const current = start(f, url, 4)
  await finish(f, current)
  assert.equal(f.session.get().affinity?.host, current.request.targetHost)
  await finish(f, old)
  assert.equal(f.session.get().affinity?.host, current.request.targetHost)
  assert.equal(f.routes.snapshot().activePlan?.host, current.request.targetHost)
  assert.equal(f.routes.snapshot().latest.video?.responseHost, current.request.targetHost)
  assert.equal(f.evidence.get(previous, 'video')?.samples.length, 3)
})

test('V226 ownership: a restriction added during dispatch forbids later control confirmation', async (t) => {
  const f = fixture(testScope(t)),
    body = dash(media('restriction', 'video.m4s'))
  assert.equal(f.adapter.transform(body).accepted, true)
  const url = body.data.dash.video[0]!.base_url,
    first = start(f, url, 1),
    second = start(f, url, 2)
  await f.restrictions.add({
    host: first.request.targetHost,
    kind: 'video',
    type: 'black',
    reason: 'current-policy',
    expireAt: f.clock.now() + 60_000,
  })
  await finish(f, first)
  await finish(f, second)
  assert.equal(f.session.get().representation, null)
  assert.equal(f.session.get().affinity, null)
  assert.equal(f.routes.snapshot().currentCapacity, null)
})

test('V226 L02 concurrent requests share selection ownership and a genuine later return is valid', async (t) => {
  const scope = testScope(t),
    f = fixture(scope),
    body = dash(media('v226-return', 'a.m4s'))
  body.data.dash.video.push({
    ...body.data.dash.video[0]!,
    id: 120,
    height: 2160,
    bandwidth: 8000000,
    base_url: media('v226-return', 'b.m4s'),
  })
  assert.equal(f.adapter.transform(body).accepted, true)
  const a = body.data.dash.video[0]!.base_url,
    b = body.data.dash.video[1]!.base_url
  const a1 = start(f, a, 1),
    a2 = start(f, a, 2)
  await finish(f, a1)
  assert.equal(f.session.get().representation, null)
  await finish(f, a2)
  assert.equal(f.session.get().representation, a2.request.representation)
  const b1 = start(f, b, 3),
    b2 = start(f, b, 4)
  assert.equal(f.routes.snapshot().currentCapacity, null, 'pending B cannot show A capacity')
  await finish(f, b1)
  await finish(f, b2)
  assert.equal(f.session.get().representation, b2.request.representation)
  const return1 = start(f, a, 5),
    return2 = start(f, a, 6)
  await finish(f, return1)
  assert.equal(f.session.get().representation, b2.request.representation)
  await finish(f, return2)
  assert.equal(f.session.get().representation, return2.request.representation)
})
