import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, dash, media } from './functional-races/routing-fixture.ts'
import { testScope } from '../support/scope.ts'
import { MeasurementController } from '../../src-v2/application/measurement-controller.ts'
import { MeasurementMetaStore } from '../../src-v2/state/measurement-meta-store.ts'
import { deferred } from '../support/deferred.ts'
import type { RangeProbeResult } from '../../src-v2/application/ports.ts'
for (const native of [false, true])
  for (const early of [false, true])
    test(`V230 startup early release native=${native} enabled=${early}`, async (t) => {
      const scope = testScope(t),
        f = fixture(scope),
        url = media('v230-early', 'video.m4s')
      await f.settings.update({ considerNativeSources: native, startupEarlyReleaseEnabled: early })
      assert.equal(f.adapter.transform(dash(url)).accepted, true)
      const pending = new Map<string, ReturnType<typeof deferred<RangeProbeResult>>>(),
        controller = scope.own(
          new MeasurementController(
            f.routes,
            new MeasurementMetaStore(f.storage, f.clock.now),
            {
              read: async (input) => {
                const d = deferred<RangeProbeResult>()
                pending.set(input.host!, d)
                return d.promise
              },
            },
            f.clock.now,
            f.clock,
            undefined,
            () => 0,
            f.settings,
            f.clock.now,
          ),
        )
      let done = false
      const gate = controller.prepareStartup(url).then(() => {
        done = true
      })
      assert.equal(pending.size, 3)
      const first = [...pending.values()][0]!
      first.resolve({
        bytes: 262144,
        elapsedMs: 50,
        ttfbMs: 1,
        status: 206,
        directRange: true,
        reason: 'measured',
        timingBasis: 'probe-reader',
        speedEligible: true,
      })
      for (let i = 0; i < 16; i++) await Promise.resolve()
      assert.equal(done, early)
      if (early) assert.equal(controller.snapshot().startup?.reason, 'qualified-early')
      else {
        f.clock.advance(3000)
        await gate
        assert.equal(done, true)
      }
    })

for (const type of ['root-original', 'native-signed', 'catalog-generated'] as const)
  test(`V230 first adequate ${type} seals the shared startup window`, async (t) => {
    const scope = testScope(t),
      f = fixture(scope),
      url = media('v230-source', 'video.m4s'),
      body = dash(url),
      backup = new URL(url)
    backup.hostname = 'upos-sz-mirrorbos.bilivideo.com'
    body.data.dash.video[0]!.backup_url.push(backup.href)
    await f.settings.update({ considerNativeSources: true })
    assert.equal(f.adapter.transform(body).accepted, true)
    const candidate = f.routes.startupOptions(url)!.candidates.find((c) => c.type === type)
    assert.ok(candidate)
    const pending = new Map<string, ReturnType<typeof deferred<RangeProbeResult>>>(),
      signals: AbortSignal[] = []
    const controller = scope.own(
      new MeasurementController(
        f.routes,
        new MeasurementMetaStore(f.storage, f.clock.now),
        {
          read: async (input) => {
            const d = deferred<RangeProbeResult>()
            pending.set(input.host!, d)
            signals.push(input.signal)
            return d.promise
          },
        },
        f.clock.now,
        f.clock,
        undefined,
        () => 0,
        f.settings,
        f.clock.now,
      ),
    )
    let done = false
    const gate = controller.prepareStartup(url).then(() => {
      done = true
    })
    pending.get(candidate.host)!.resolve({
      bytes: 262144,
      elapsedMs: 50,
      ttfbMs: 1,
      status: 206,
      directRange: true,
      reason: 'measured',
      timingBasis: 'probe-reader',
      speedEligible: true,
    })
    for (let i = 0; i < 16; i++) await Promise.resolve()
    assert.equal(done, true)
    await gate
    assert.equal(controller.snapshot().startup?.selectedHost, candidate.host)
    assert.ok(signals.every((s) => s.aborted))
    assert.equal(f.clock.pendingCount, 0)
    const saved = controller.snapshot()
    for (const d of pending.values())
      d.resolve({
        bytes: 524288,
        elapsedMs: 1,
        ttfbMs: 0,
        status: 206,
        directRange: true,
        reason: 'late',
        timingBasis: 'probe-reader',
      })
    for (let i = 0; i < 8; i++) await Promise.resolve()
    assert.deepEqual(
      controller.snapshot(),
      saved,
      'late fastest result cannot replace the first adequate winner',
    )
  })

test('V230 startup rechecks changed playback demand without reopening its deadline', async (t) => {
  const scope = testScope(t),
    f = fixture(scope),
    url = media('v230-rate', 'video.m4s')
  assert.equal(f.adapter.transform(dash(url)).accepted, true)
  f.routes.observePlaybackRate(1)
  const pending: ReturnType<typeof deferred<RangeProbeResult>>[] = []
  const controller = scope.own(
    new MeasurementController(
      f.routes,
      new MeasurementMetaStore(f.storage, f.clock.now),
      {
        read: async () => {
          const d = deferred<RangeProbeResult>()
          pending.push(d)
          return d.promise
        },
      },
      f.clock.now,
      f.clock,
      undefined,
      () => 0,
      f.settings,
      f.clock.now,
    ),
  )
  let done = false
  const gate = controller.prepareStartup(url).then(() => {
    done = true
  })
  f.routes.observePlaybackRate(2)
  pending[0]!.resolve({
    bytes: 65536,
    elapsedMs: 50,
    ttfbMs: 1,
    status: 206,
    directRange: true,
    reason: 'measured',
    timingBasis: 'probe-reader',
    speedEligible: true,
  })
  for (let i = 0; i < 16; i++) await Promise.resolve()
  assert.equal(done, false)
  f.clock.advance(3000)
  await gate
  assert.equal(controller.snapshot().startup?.result, 'insufficient')
  assert.equal(controller.snapshot().startup?.elapsedMs, 3000)
})
