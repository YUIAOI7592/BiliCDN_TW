import assert from 'node:assert/strict'
import { test } from 'node:test'
import { WebRtcAdapter } from '../src-v2/adapters/webrtc.ts'
import { defaultSettings, SETTINGS_KEY, SettingsStore } from '../src-v2/state/settings-store.ts'
import { createControlReadModel } from '../src-v2/ui/control-read-model.ts'
import { overviewPresentation } from '../src-v2/ui/overview-presentation.ts'
import { fixture, media } from './cases/routing/routing-fixture.ts'
import { exerciseEntryStartup } from './support/entry-startup.ts'
import { finish, start } from './support/route-dispatch.ts'
import { fixture as runtimeFixture } from './support/runtime-fixture.ts'
import { testScope } from './support/scope.ts'
import { FakeStorage } from './support/storage.ts'

// These reproduce unresolved product defects. Select npm test -- deferred-product explicitly.
test('startup control installs transport, document listeners and the control menu', async (t) => {
  const result = await exerciseEntryStartup(t, 'none')
  assert.equal(result.escaped, undefined)
  assert.notEqual(result.window.fetch, result.nativeFetch)
  assert.notEqual(result.NativeXhr.prototype.send, result.native.send?.value)
  assert.deepEqual(result.resources.documentEvents, ['visibilitychange', 'webkitvisibilitychange'])
  assert.equal(result.resources.menus, 1)
})

test('visibility registration failure rolls back all resources acquired by the entry', async (t) => {
  const result = await exerciseEntryStartup(t, 'visibility')
  assert.deepEqual(
    {
      ...result.resources,
      escaped: result.escaped,
      fetchRestored: result.window.fetch === result.nativeFetch,
      xhrRestored: result.NativeXhr.prototype.send === result.native.send?.value,
      webRtcRestored: result.window.RTCPeerConnection === result.NativePeer,
    },
    {
      timers: 0,
      storage: 0,
      documentEvents: [],
      windowEvents: [],
      navigationEvents: [],
      panels: 0,
      menus: 0,
      visibilityShadow: false,
      escaped: undefined,
      fetchRestored: true,
      xhrRestored: true,
      webRtcRestored: true,
    },
  )
})

test('entry rollback keeps the latest website playinfo assignment', async (t) => {
  const result = await exerciseEntryStartup(t, 'page-assignment')
  assert.equal(result.installedBeforeFailure, true)
  assert.equal(result.escaped, undefined)
  assert.equal(result.window.fetch, result.nativeFetch)
  assert.deepEqual(Object.getOwnPropertyDescriptors(result.NativeXhr.prototype), result.native)
  assert.equal(result.resources.storage, 0)
  assert.deepEqual(Object.getOwnPropertyDescriptor(result.window, '__playinfo__'), {
    configurable: true,
    enumerable: false,
    writable: true,
    value: result.pageAfter,
  })
  assert.equal(Reflect.get(result.window, '__playinfo__'), result.pageAfter)
})

test('reset after a wall-clock correction converges in storage, both stores and WebRTC', async (t) => {
  const scope = testScope(t)
  let now = 2_000_000
  const storage = new FakeStorage()
  storage.set(SETTINGS_KEY, { ...defaultSettings(now), blockWebRtc: false })
  let writes = 0
  const save = storage.set.bind(storage)
  storage.set = (key, value) => {
    writes++
    save(key, value)
  }

  const local = scope.own(new SettingsStore(storage, () => now))
  const remote = scope.own(new SettingsStore(storage, () => now))
  class NativePeerConnection {}
  const page = { RTCPeerConnection: NativePeerConnection }
  scope.defineGlobal('unsafeWindow', { configurable: true, value: page })
  scope.own(new WebRtcAdapter(local)).install()
  assert.equal(page.RTCPeerConnection, NativePeerConnection)

  now -= 1_800_000
  const returned = await local.reset()
  const persisted = storage.get(SETTINGS_KEY, defaultSettings(now))
  storage.remote(SETTINGS_KEY, persisted)
  assert.equal(writes, 1)
  assert.equal(persisted.blockWebRtc, true)
  assert.deepEqual(
    {
      returned,
      local: local.get(),
      remote: remote.get(),
      blocked: page.RTCPeerConnection === undefined,
    },
    { returned: persisted, local: persisted, remote: persisted, blocked: true },
  )
})

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
