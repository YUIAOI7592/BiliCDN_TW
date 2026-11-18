import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import { TampermonkeyStorage } from '../../../src-v2/platform/storage.ts'
import { WebRtcAdapter } from '../../../src-v2/adapters/webrtc.ts'
import {
  defaultSettings,
  SettingsStore,
  SETTINGS_KEY,
} from '../../../src-v2/state/settings-store.ts'
import { type SettingsState } from '../../../src-v2/state/settings-contracts.ts'
import { FakeStorage, DelayedSettingsStorage } from '../../support/storage.ts'
import { deferred } from '../../support/deferred.ts'
import { testScope } from '../../support/scope.ts'

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
  storage.set = () => {
    throw new Error('controlled write failure')
  }
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

for (const command of ['update', 'catalog', 'reset'] as const) {
  test(`V2221 settings ${command} preserves stored settings when the locked read fails`, async (t) => {
    const scope = testScope(t)
    const [fixedHost, changedHost] = TRUSTED_CATALOG
    const saved: SettingsState = {
      ...defaultSettings(900),
      disabled: true,
      earlyRetryEnabled: false,
      fixedHost,
      catalogOverrides: { [fixedHost]: true, [changedHost]: false },
      blockHttpDns: false,
    }
    let persisted = saved,
      failRead = false,
      writes = 0
    scope.defineGlobal('navigator', { configurable: true, value: {} })
    scope.defineGlobal('GM_addValueChangeListener', { configurable: true, value: undefined })
    scope.defineGlobal('GM_getValue', {
      configurable: true,
      value: () => {
        if (failRead) throw new Error('controlled read failure')
        return persisted
      },
    })
    scope.defineGlobal('GM_setValue', {
      configurable: true,
      value: (key: string, value: SettingsState) => {
        assert.equal(key, SETTINGS_KEY)
        persisted = value
        writes++
      },
    })
    const settings = scope.own(new SettingsStore(new TampermonkeyStorage(), () => 1000))
    const run =
      command === 'update'
        ? () => settings.update({ blockWebRtc: false, considerNativeSources: false })
        : command === 'catalog'
          ? () => settings.setCatalogEnabled(changedHost, true)
          : () => settings.reset()
    failRead = true
    await assert.rejects(run(), /settings/i)
    assert.equal(writes, 0)
    assert.deepEqual(settings.get(), saved)
    assert.equal(persisted, saved)

    failRead = false
    const expected =
      command === 'update'
        ? { ...saved, blockWebRtc: false, considerNativeSources: false, updatedAt: 1000 }
        : command === 'catalog'
          ? {
              ...saved,
              catalogOverrides: { [fixedHost]: true, [changedHost]: true },
              updatedAt: 1000,
            }
          : defaultSettings(1000)
    assert.deepEqual(await run(), expected)
    assert.deepEqual(settings.get(), expected)
    assert.deepEqual(persisted, expected)
    assert.equal(writes, 1)
  })
}

test('V2221 a settings subscriber failure cannot strand restrictive updates or hide notifications', async (t) => {
  const scope = testScope(t)
  const storage = new FakeStorage()
  const settings = scope.own(new SettingsStore(storage, () => 1000))
  scope.defer(
    settings.subscribe(() => {
      throw new Error('controlled subscriber failure')
    }),
  )
  const observed: boolean[][] = []
  scope.defer(
    settings.subscribe(({ earlyRetryEnabled, considerNativeSources }) => {
      observed.push([earlyRetryEnabled, considerNativeSources])
    }),
  )

  const off = await settings.update({ earlyRetryEnabled: false, considerNativeSources: false })
  assert.equal(off.earlyRetryEnabled, false)
  assert.equal(off.considerNativeSources, false)
  assert.deepEqual(observed[0], [false, true])
  assert.deepEqual(observed.at(-1), [false, false])
  assert.deepEqual(storage.get(SETTINGS_KEY, null), off)

  const enabled = await settings.update({ earlyRetryEnabled: true, considerNativeSources: true })
  assert.deepEqual(settings.get(), enabled)
  assert.deepEqual(storage.get(SETTINGS_KEY, null), enabled)
  assert.deepEqual(observed.at(-1), [true, true])
})

test('V2221 settings can save a genuinely missing record', async (t) => {
  const storage = new FakeStorage()
  const settings = testScope(t).own(new SettingsStore(storage, () => 1000))
  const saved = await settings.update({ blockWebRtc: false })
  assert.deepEqual(saved, { ...defaultSettings(1000), blockWebRtc: false, updatedAt: 1001 })
  assert.deepEqual(storage.get(SETTINGS_KEY, null), saved)
})

for (const change of ['local update', 'remote notification'] as const) {
  test(`V2222 reset preserves a newer ${change} after saving`, async (t) => {
    const scope = testScope(t)
    const committed = deferred<void>(),
      resumeReset = deferred<void>()
    const storage = new FakeStorage()
    storage.set(SETTINGS_KEY, { ...defaultSettings(900), blockWebRtc: false })
    const withLock = storage.withLock.bind(storage)
    let hold = true,
      writes = 0
    const set = storage.set.bind(storage)
    storage.set = (key, value) => {
      writes++
      set(key, value)
    }
    storage.withLock = async (name, task) => {
      const wait = hold && name === 'settings'
      if (wait) hold = false
      const result = await withLock(name, task)
      if (wait) {
        committed.resolve()
        await resumeReset.promise
      }
      return result
    }
    const settings = scope.own(new SettingsStore(storage, () => 1000))
    class NativePeerConnection {}
    const page = { RTCPeerConnection: NativePeerConnection }
    scope.defineGlobal('unsafeWindow', { configurable: true, value: page })
    scope.own(new WebRtcAdapter(settings)).install()
    const observed: SettingsState[] = []
    scope.defer(settings.subscribe((value) => observed.push(value)))
    const pending = settings.reset()
    scope.defer(async () => {
      resumeReset.resolve()
      await pending
    })

    await committed.promise
    assert.deepEqual(storage.get(SETTINGS_KEY, null), defaultSettings(1000))
    assert.equal(settings.get().considerNativeSources, false)
    assert.equal(settings.get().earlyRetryEnabled, false)
    const newer = { ...defaultSettings(1001), blockWebRtc: false }
    if (change === 'local update') await settings.update({ blockWebRtc: false })
    else storage.remote(SETTINGS_KEY, newer)
    assert.equal(settings.get().updatedAt, 1001)
    assert.equal(page.RTCPeerConnection, NativePeerConnection)

    resumeReset.resolve()
    assert.deepEqual(await pending, newer)
    assert.deepEqual(settings.get(), newer)
    assert.deepEqual(storage.get(SETTINGS_KEY, null), newer)
    assert.deepEqual(observed.at(-1), newer)
    assert.equal(
      observed.some((value) => value.updatedAt === 1000),
      false,
    )
    assert.equal(page.RTCPeerConnection, NativePeerConnection)
    assert.equal(writes, change === 'local update' ? 2 : 1)
  })
}
