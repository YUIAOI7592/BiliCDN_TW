import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SettingsStore, SETTINGS_KEY } from '../../src-v2/state/settings-store.ts'
import { FakeStorage, DelayedSettingsStorage } from '../support/storage.ts'
import { testScope } from '../support/scope.ts'

for (const [label, value, expected] of [
  ['new installation', undefined, true],
  ['missing field', { schema: 2 }, true],
  ['invalid field', { schema: 2, considerNativeSources: 'false' }, true],
  ['saved false', { schema: 2, considerNativeSources: false }, false],
  ['saved true', { schema: 2, considerNativeSources: true }, true],
] as const) {
  test(`V220 settings ${label} preserves preference without migration writes`, (t) => {
    const storage = new FakeStorage()
    if (value !== undefined) storage.set(SETTINGS_KEY, value)
    const before = structuredClone([...storage.values])
    const settings = testScope(t).own(new SettingsStore(storage, () => 1000))
    assert.equal(settings.get().considerNativeSources, expected)
    assert.deepEqual([...storage.values], before)
  })
}

test('V220 reset enables Native only after its storage lock commits', async (t) => {
  const storage = new DelayedSettingsStorage()
  storage.set(SETTINGS_KEY, { schema: 2, considerNativeSources: false })
  const settings = testScope(t).own(new SettingsStore(storage, () => 1000))
  storage.holdNextSettingsLock = true
  const pending = settings.reset()
  assert.equal(settings.get().considerNativeSources, false)
  storage.releaseSettingsLock()
  await pending
  assert.equal(settings.get().considerNativeSources, true)
})

test('V220 failed reset retains the existing Native preference and releases suppression', async (t) => {
  const storage = new FakeStorage()
  storage.set(SETTINGS_KEY, { schema: 2, considerNativeSources: true })
  const settings = testScope(t).own(new SettingsStore(storage, () => 1000))
  storage.set = () => { throw new Error('controlled write failure') }
  await assert.rejects(settings.reset(), /controlled write failure/)
  assert.equal(settings.get().considerNativeSources, true)
})

test('V220 remote Native false and overlapping restrictive writes retain their owner', async (t) => {
  const storage = new DelayedSettingsStorage()
  const settings = testScope(t).own(new SettingsStore(storage, () => 1000))
  storage.holdNextSettingsLock = true
  const pending = settings.update({ considerNativeSources: false })
  assert.equal(settings.get().considerNativeSources, false)
  await settings.update({ considerNativeSources: true })
  assert.equal(settings.get().considerNativeSources, false)
  storage.releaseSettingsLock()
  await pending
  assert.equal(settings.get().considerNativeSources, false)
  storage.remote(SETTINGS_KEY, { schema: 2, considerNativeSources: true, updatedAt: 2000 })
  assert.equal(settings.get().considerNativeSources, true)
  storage.remote(SETTINGS_KEY, { schema: 2, considerNativeSources: false, updatedAt: 2001 })
  assert.equal(settings.get().considerNativeSources, false)
})
