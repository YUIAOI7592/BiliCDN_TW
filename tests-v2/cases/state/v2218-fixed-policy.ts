import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SettingsStore, SETTINGS_KEY } from '../../../src-v2/state/settings-store.ts'
import { sameMeasurementSettings } from '../../../src-v2/state/settings-policy.ts'
import { FakeStorage } from '../../support/storage.ts'
import { testScope } from '../../support/scope.ts'

const retired = [
  'startupEarlyReleaseEnabled',
  'healthMiddleRangeEnabled',
  'backupFamilyDiversityEnabled',
] as const
for (const value of [true, false, undefined, 'false', null])
  test(`V2218 retired policies ignore legacy ${typeof value}:${String(value)} without read-time writes`, async (t) => {
    const storage = new FakeStorage()
    const legacy = Object.fromEntries(retired.map((key) => [key, value]))
    storage.set(SETTINGS_KEY, {
      schema: 2,
      ...legacy,
      earlyRetryEnabled: false,
      considerNativeSources: false,
      blockHttpDns: false,
    })
    const before = structuredClone([...storage.values])
    const settings = testScope(t).own(new SettingsStore(storage, () => 1000))
    for (const key of retired) assert.equal(Object.hasOwn(settings.get(), key), false)
    assert.equal(settings.get().earlyRetryEnabled, false)
    assert.equal(settings.get().considerNativeSources, false)
    assert.equal(settings.get().blockHttpDns, false)
    assert.deepEqual([...storage.values], before)
    const previous = settings.get()
    storage.remote(SETTINGS_KEY, { ...previous, ...legacy, updatedAt: 1001 })
    assert.equal(sameMeasurementSettings(previous, settings.get()), true)
    await settings.update({ blockWebRtc: false, ...legacy })
    const saved = storage.get<Record<string, unknown>>(SETTINGS_KEY, {})
    for (const key of retired) assert.equal(Object.hasOwn(saved, key), false)
    assert.equal(saved.earlyRetryEnabled, false)
    assert.equal(saved.considerNativeSources, false)
  })
