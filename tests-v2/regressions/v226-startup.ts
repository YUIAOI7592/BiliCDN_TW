import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, media, dash } from './functional-races/routing-fixture.ts'
import { testScope } from '../support/scope.ts'
import { MeasurementController } from '../../src-v2/application/measurement-controller.ts'
import { MeasurementMetaStore } from '../../src-v2/state/measurement-meta-store.ts'
import type { RangeProbePort } from '../../src-v2/application/ports.ts'
import { TRUSTED_CATALOG } from '../../src-v2/domain/catalog.ts'
import { deferred } from '../support/deferred.ts'

function measurement(t: TestContext, f: ReturnType<typeof fixture>, probe: RangeProbePort) {
  const scope = testScope(t)
  return scope.own(
    new MeasurementController(
      f.routes,
      new MeasurementMetaStore(f.storage, f.clock.now),
      probe,
      f.clock.now,
      f.clock,
      undefined,
      () => 0,
      f.settings,
    ),
  )
}

test('V226 S07 mixed inventory reserves the single startup window for video', async (t) => {
  const scope = testScope(t),
    f = fixture(scope)
  const body = dash(media('v226-owner', 'v.m4s'))
  const audio = {
    id: 30280,
    bandwidth: 192000,
    base_url: media('v226-owner', 'a.m4s'),
    backup_url: [],
  }
  const mixed = { code: 0, data: { dash: { ...body.data.dash, audio: [audio] } } }
  assert.equal(f.adapter.transform(mixed).accepted, true)
  let probes = 0
  const controller = measurement(t, f, {
    read: async () => {
      probes++
      return {
        bytes: 262144,
        elapsedMs: 100,
        ttfbMs: 1,
        status: 206,
        directRange: true,
        reason: 'measured',
      }
    },
  })
  await controller.prepareStartup(audio.base_url)
  assert.equal(probes, 0)
  assert.equal(controller.snapshot().startup?.reason, 'video-priority')
  await controller.prepareStartup(body.data.dash.video[0]!.base_url)
  assert.equal(probes, 3)
  await controller.prepareStartup(body.data.dash.video[0]!.base_url)
  assert.equal(probes, 3)
})

test('V226 S07 trusted audio-only inventory can use the same single budget', async (t) => {
  const scope = testScope(t),
    f = fixture(scope)
  const audio = {
    id: 30280,
    bandwidth: 192000,
    base_url: media('v226-radio', 'a.m4s'),
    backup_url: [],
  }
  assert.equal(
    f.adapter.transform({ code: 0, data: { dash: { video: [], audio: [audio] } } }).accepted,
    true,
  )
  let probes = 0
  const controller = measurement(t, f, {
    read: async () => {
      probes++
      return {
        bytes: 262144,
        elapsedMs: 100,
        ttfbMs: 1,
        status: 206,
        directRange: true,
        reason: 'measured',
      }
    },
  })
  await controller.prepareStartup(audio.base_url)
  assert.equal(probes, 3)
})

test('V226 S07: trusted audio-only ownership overrides a provisional video inventory', async (t) => {
  const f = fixture(testScope(t)),
    state = f.session.get()
  assert.ok(
    f.vault.register({
      generation: state.generation,
      epoch: state.epoch,
      kind: 'video',
      key: 'provisional',
      height: 1080,
      codec: 'avc',
      bandwidth: 4_000_000,
      urls: [media('provisional', 'v.m4s')],
      source: 'page-hint',
    }),
  )
  const audio = {
    id: 30280,
    bandwidth: 192_000,
    base_url: media('audio-only', 'a.m4s'),
    backup_url: [],
  }
  assert.equal(
    f.adapter.transform({ code: 0, data: { dash: { video: [], audio: [audio] } } }).accepted,
    true,
  )
  let probes = 0
  const controller = measurement(t, f, {
    read: async () => {
      probes++
      return {
        bytes: 262144,
        elapsedMs: 100,
        ttfbMs: 1,
        status: 206,
        directRange: true,
        reason: 'measured',
      }
    },
  })
  await controller.prepareStartup(audio.base_url)
  assert.equal(probes, 3)
})

test('V226 S13 unsuccessful probes select one legal untested fallback without more probes', async (t) => {
  const scope = testScope(t),
    f = fixture(scope)
  const body = dash(media('v226-fallback', 'v.m4s'))
  assert.equal(f.adapter.transform(body).accepted, true)
  const url = body.data.dash.video[0]!.base_url
  const tested = f.routes.startupOptions(url)!.candidates.map((c) => c.host)
  let probes = 0
  const controller = measurement(t, f, {
    read: async () => {
      probes++
      return {
        bytes: 0,
        elapsedMs: 3000,
        ttfbMs: null,
        status: 0,
        directRange: false,
        reason: 'timeout',
      }
    },
  })
  await controller.prepareStartup(url)
  const selected = controller.snapshot().startup?.selectedHost
  assert.ok(selected)
  assert.equal(tested.includes(selected), false)
  assert.equal(controller.snapshot().startup?.result, 'unverified')
  assert.equal(probes, 3)
  controller.reset()
  await controller.prepareStartup(url)
  assert.equal(probes, 3)
})

test('V226 S13 exhausted Catalog window cannot revive the old unverified plan', async (t) => {
  const scope = testScope(t),
    f = fixture(scope)
  await f.settings.update({
    catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map((host, i) => [host, i < 3])),
  })
  const body = dash(media('v226-exhausted', 'v.m4s'))
  assert.equal(f.adapter.transform(body).accepted, true)
  const url = body.data.dash.video[0]!.base_url
  const controller = measurement(t, f, {
    read: async () => ({
      bytes: 0,
      elapsedMs: 3000,
      ttfbMs: null,
      status: 0,
      directRange: false,
      reason: 'timeout',
    }),
  })
  await controller.prepareStartup(url)
  assert.equal(controller.snapshot().startup?.result, 'none')
  assert.equal(f.routes.apply(url).decision.action, 'block')
})

test('V226 startup cancellation closes its lease and never remains visibly running', async (t) => {
  const scope = testScope(t),
    f = fixture(scope),
    pending = deferred<Awaited<ReturnType<RangeProbePort['read']>>>()
  const body = dash(media('v226-cancelled', 'v.m4s'))
  assert.equal(f.adapter.transform(body).accepted, true)
  const controller = measurement(t, f, { read: async () => pending.promise })
  const work = controller.prepareStartup(body.data.dash.video[0]!.base_url)
  controller.reset()
  const after = controller.snapshot()
  assert.notEqual(after.startup?.state, 'running')
  pending.resolve({
    bytes: 262144,
    elapsedMs: 100,
    ttfbMs: 1,
    status: 206,
    directRange: true,
    reason: 'measured',
  })
  await work
  assert.deepEqual(controller.snapshot(), after)
})
