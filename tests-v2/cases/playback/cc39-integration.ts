import { CatalogSettingsStore } from '../../support/catalog-settings.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { testScope } from '../../support/scope.ts'
import { FakeStorage, DelayedSettingsStorage } from '../../support/storage.ts'
import { fixture, media, dash } from '../routing/routing-fixture.ts'
import { SettingsStore, SETTINGS_KEY } from '../../../src-v2/state/settings-store.ts'
import { DEFAULT_UNAVAILABLE_HOSTS } from '../../../src-v2/domain/catalog.ts'
import { ControlCommands } from '../../../src-v2/application/control-commands.ts'
import { MeasurementController } from '../../../src-v2/application/measurement/measurement-controller.ts'
import { RouteCoordinator } from '../../../src-v2/application/routing/route-coordinator.ts'
const flags = ['earlyRetryEnabled', 'blockWebRtc', 'blockHttpDns'] as const
const hk = [
  'cn-hk-eq-01-03.bilivideo.com',
  'cn-hk-eq-01-05.bilivideo.com',
  'cn-hk-eq-01-01.bilivideo.com',
]

test('CC39-SETTINGS new and missing settings enable all three retained capabilities', (t) => {
  const scope = testScope(t)
  for (const value of [null, { schema: 2, updatedAt: 1 }]) {
    const storage = new FakeStorage()
    storage.set(SETTINGS_KEY, value)
    const settings = scope.own(new SettingsStore(storage, () => 1000))
    for (const flag of flags) assert.equal(settings.get()[flag], true, flag)
    assert.equal(settings.get().considerNativeSources, true)
  }
})

test('CC39-SETTINGS migration drops codec and verbose while preserving explicit choices', async (t) => {
  const scope = testScope(t),
    storage = new FakeStorage()
  storage.set(SETTINGS_KEY, {
    schema: 2,
    codec: 'av1',
    verbose: true,
    ...Object.fromEntries(flags.map((key) => [key, false])),
    catalogOverrides: { [hk[0]!]: false },
    updatedAt: 1,
  })
  const settings = scope.own(new CatalogSettingsStore(storage, () => 1000))
  for (const flag of flags) assert.equal(settings.get()[flag], false)
  assert.equal('codec' in settings.get(), false)
  assert.equal('verbose' in settings.get(), false)
  await settings.update({ fixedHost: null })
  const saved = storage.get<Record<string, unknown>>(SETTINGS_KEY, {})
  assert.equal(saved.schema, 2)
  assert.equal(saved.earlyRetryEnabled, false)
  assert.equal('codec' in saved, false)
  assert.equal('verbose' in saved, false)
  assert.equal(settings.get().catalogOverrides[hk[0]!], false)
  await settings.update({ earlyRetryEnabled: true })
  assert.equal(storage.get<Record<string, unknown>>(SETTINGS_KEY, {}).earlyRetryEnabled, true)
  await settings.update({ earlyRetryEnabled: false })
  assert.equal(storage.get<Record<string, unknown>>(SETTINGS_KEY, {}).earlyRetryEnabled, false)
  await settings.reset()
  for (const flag of flags) assert.equal(settings.get()[flag], true)
})

test('CC39-SETTINGS pending off wins over a remote on until the locked write completes', async (t) => {
  const scope = testScope(t),
    storage = new DelayedSettingsStorage()
  const settings = scope.own(new CatalogSettingsStore(storage, () => 1000))
  storage.holdNextSettingsLock = true
  scope.defer(() => storage.releaseSettingsLock())
  const pending = settings.update({ earlyRetryEnabled: false })
  assert.equal(
    settings.get().earlyRetryEnabled,
    false,
    'suppression starts before any remote notification',
  )
  storage.remote(SETTINGS_KEY, {
    schema: 2,
    earlyRetryEnabled: true,
    updatedAt: 1001,
  })
  assert.equal(settings.get().earlyRetryEnabled, false)
  storage.releaseSettingsLock()
  await pending
  assert.equal(settings.get().earlyRetryEnabled, false)
  const restored = scope.own(new CatalogSettingsStore(storage, () => 1002))
  assert.equal(restored.get().earlyRetryEnabled, false, 'the locked update persists across reload')
})

for (const host of hk)
  test(
    'CC39-ROUTE Hong Kong default permits a fixed route but never removes a ban: ' + host,
    async (t) => {
      const f = fixture(testScope(t))
      assert.equal(DEFAULT_UNAVAILABLE_HOSTS.has(host), false)
      await f.settings.update({ fixedHost: host })
      const url = media('cc39', 'video.m4s')
      assert.equal(f.adapter.transform(dash(url)).accepted, true)
      assert.equal(f.routes.apply(url).decision.host, host)
      await f.restrictions.add({
        host,
        type: 'black',
        kind: 'all',
        reason: 'user',
        expireAt: f.clock.now() + 10000,
      })
      assert.notEqual(f.routes.apply(url).decision.host, host)
    },
  )

test('CC39-CODEC old AV1 preference leaves website DASH representation order unchanged', (t) => {
  const storage = new FakeStorage()
  storage.set(SETTINGS_KEY, { schema: 2, codec: 'av1' })
  const f = fixture(testScope(t), storage)
  const payload = dash(media('cc39', 'avc.m4s'))
  payload.data.dash.video.push({
    ...payload.data.dash.video[0]!,
    codecs: 'av01.0.08M.08',
    base_url: media('cc39', 'av1.m4s'),
  })
  const expected = payload.data.dash.video.map((item) => item.codecs)
  assert.equal(f.adapter.transform(payload).accepted, true)
  assert.deepEqual(
    payload.data.dash.video.map((item) => item.codecs),
    expected,
  )
  assert.ok(payload.data.dash.video.every((item) => item.base_url.includes('.bilivideo.com/')))
})

test('CC39-CONTROL removed manual capabilities are absent from executable ports', () => {
  for (const name of ['requestMeasurement', 'requestCatalogValidation', 'blacklistLatestVideo'])
    assert.equal(name in ControlCommands.prototype, false, name)
  for (const name of ['requestManual', 'requestCatalogValidation'])
    assert.equal(name in MeasurementController.prototype, false, name)
  assert.equal('catalogValidationContext' in RouteCoordinator.prototype, false)
})
