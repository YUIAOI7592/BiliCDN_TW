import { test } from 'node:test'
import assert from 'node:assert/strict'
import { testScope } from '../support/scope.ts'
import { FakeStorage, DelayedSettingsStorage } from '../support/storage.ts'
import { fixture, media, dash } from './functional-races/routing-fixture.ts'
import { SettingsStore, SETTINGS_KEY } from '../../src-v2/state/settings-store.ts'
import { DEFAULT_UNAVAILABLE_HOSTS } from '../../src-v2/domain/catalog.ts'
import { ControlCommands } from '../../src-v2/application/control-commands.ts'
import { MeasurementController } from '../../src-v2/application/measurement-controller.ts'
import { RouteCoordinator } from '../../src-v2/application/route-coordinator.ts'
import { DiagnosticRecorder } from '../../src-v2/diagnostics/recorder.ts'

const flags = [
  'startupEarlyReleaseEnabled',
  'healthMiddleRangeEnabled',
  'backupFamilyDiversityEnabled',
  'earlyRetryEnabled',
  'blockWebRtc',
  'blockHttpDns',
] as const
const hk = [
  'cn-hk-eq-01-03.bilivideo.com',
  'cn-hk-eq-01-05.bilivideo.com',
  'cn-hk-eq-01-01.bilivideo.com',
]

test('CC39-SETTINGS new and missing settings enable all six real capabilities', (t) => {
  const scope = testScope(t)
  for (const value of [null, { schema: 2, updatedAt: 1 }]) {
    const storage = new FakeStorage()
    storage.set(SETTINGS_KEY, value)
    const settings = scope.own(new SettingsStore(storage, () => 1000))
    for (const flag of flags) assert.equal(settings.get()[flag], true, flag)
    assert.equal(settings.get().considerNativeSources, false)
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
  const settings = scope.own(new SettingsStore(storage, () => 1000))
  for (const flag of flags) assert.equal(settings.get()[flag], false)
  assert.equal('codec' in settings.get(), false)
  assert.equal('verbose' in settings.get(), false)
  await settings.update({ fixedHost: null })
  const saved = storage.get<Record<string, unknown>>(SETTINGS_KEY, {})
  assert.equal('codec' in saved, false)
  assert.equal('verbose' in saved, false)
  assert.equal(settings.get().catalogOverrides[hk[0]!], false)
  await settings.reset()
  for (const flag of flags) assert.equal(settings.get()[flag], true)
})

test('CC39-SETTINGS pending off wins over a remote on until the locked write completes', async (t) => {
  const scope = testScope(t),
    storage = new DelayedSettingsStorage()
  const settings = scope.own(new SettingsStore(storage, () => 1000))
  const controlled = flags.slice(0, 4)
  storage.holdNextSettingsLock = true
  scope.defer(() => storage.releaseSettingsLock())
  const pending = settings.update(Object.fromEntries(controlled.map((key) => [key, false])))
  storage.remote(SETTINGS_KEY, {
    schema: 2,
    ...Object.fromEntries(controlled.map((key) => [key, true])),
    updatedAt: 1001,
  })
  for (const key of controlled) assert.equal(settings.get()[key], false)
  storage.releaseSettingsLock()
  await pending
  for (const key of controlled) assert.equal(settings.get()[key], false)
})

for (const host of hk)
  test(
    'CC39-ROUTE Hong Kong default permits a fixed route but never removes a ban: ' + host,
    async (t) => {
      const f = fixture(testScope(t))
      assert.equal(DEFAULT_UNAVAILABLE_HOSTS.has(host), false)
      await f.settings.update({ fixedHost: host })
      const url = media('cc39', 'video.m4s')
      f.adapter.transform(dash(url))
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
  f.adapter.transform(payload)
  assert.deepEqual(
    payload.data.dash.video.map((item) => item.codecs),
    expected,
  )
  assert.ok(payload.data.dash.video.every((item) => item.base_url.includes('.bilivideo.com/')))
})

test('CC39-CONTROL removed manual capabilities are absent from executable ports', (t) => {
  testScope(t)
  for (const name of ['requestMeasurement', 'requestCatalogValidation', 'blacklistLatestVideo'])
    assert.equal(name in ControlCommands.prototype, false, name)
  for (const name of ['requestManual', 'requestCatalogValidation'])
    assert.equal(name in MeasurementController.prototype, false, name)
  assert.equal('catalogValidationContext' in RouteCoordinator.prototype, false)
})

test('CC39-DIAG legacy verbose arguments cannot collect candidate ranking history', (t) => {
  const f = fixture(testScope(t)),
    url = media('cc39', 'video.m4s')
  f.adapter.transform(dash(url))
  const recorder = Reflect.construct(DiagnosticRecorder, [
    f.clock.now,
    () => true,
  ]) as DiagnosticRecorder
  recorder.record({
    type: 'route-decision',
    at: f.clock.now(),
    decision: f.routes.apply(url).decision,
  })
  assert.deepEqual(recorder.snapshot().rankings, [])
  assert.equal(recorder.snapshot().counters.rankingEvicted, 0)
})
