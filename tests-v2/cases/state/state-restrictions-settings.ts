import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { type TestContext } from 'node:test'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import { SignedRouteVault } from '../../../src-v2/state/signed-route-vault.ts'
import { RestrictionStore } from '../../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../../src-v2/state/evidence-store.ts'
import { SettingsStore } from '../../../src-v2/state/settings-store.ts'
import { SessionStore } from '../../../src-v2/state/session-store.ts'
import { RouteCoordinator } from '../../../src-v2/application/routing/route-coordinator.ts'
import { FakeStorage, DelayedSettingsStorage } from '../../support/storage.ts'
import { testScope } from '../../support/scope.ts'

async function createRestrictionAppliesToAudio12Context10(t: TestContext) {
  const scope = testScope(t)
  const now = 2_000_000_000_000
  const storage = new FakeStorage()
  const restrictions = scope.own(new RestrictionStore(storage, () => now))
  await restrictions.add({
    host: TRUSTED_CATALOG[0],
    type: 'black',
    kind: 'all',
    reason: 'test',
    expireAt: now + 1000,
  })
  return {
    now,
    restrictions,
    scope,
    storage,
  }
}

async function createExistingSchema2SettingsWithoutNativeToggleDefaultOn13Context11(
  t: TestContext,
) {
  const scope = testScope(t)
  const now = 2_000_000_000_000
  const nativeSettingStorage = new FakeStorage()
  nativeSettingStorage.set('bilicdn.v2.settings', {
    schema: 2,
    disabled: false,
    codec: 'hevc',
    updatedAt: now - 10,
  })
  const nativeSettings = scope.own(new SettingsStore(nativeSettingStorage, () => now))
  return {
    nativeSettingStorage,
    nativeSettings,
    now,
    scope,
  }
}

async function createOtherTabReceivesANativeOnSettingWithAFutureTimestampContext12(t: TestContext) {
  const scope = testScope(t)
  const now = 2_000_000_000_000
  const clock = { now: () => now }
  const futureSettingsStorage = new FakeStorage()
  futureSettingsStorage.set('bilicdn.v2.settings', {
    schema: 2,
    considerNativeSources: false,
    updatedAt: now - 1,
  })
  const futureResetTab = scope.own(new SettingsStore(futureSettingsStorage, () => now))
  const futureOtherTab = scope.own(new SettingsStore(futureSettingsStorage, () => now))
  futureSettingsStorage.remote('bilicdn.v2.settings', {
    ...futureResetTab.get(),
    considerNativeSources: true,
    updatedAt: now + 60_000,
  })
  return {
    clock,
    futureOtherTab,
    futureResetTab,
    futureSettingsStorage,
    now,
    scope,
  }
}

async function checkOtherTabReceivesANativeOnSettingWithAFutureTimestamp(
  t: TestContext,
): Promise<void> {
  const base = await createOtherTabReceivesANativeOnSettingWithAFutureTimestampContext12(t)
  assert.equal(base.futureOtherTab.get().updatedAt, base.now + 60_000)

  assert.strictEqual(
    base.futureOtherTab.get().considerNativeSources,
    true,
    'other tab receives a Native-on setting with a future timestamp',
  )
  await base.futureResetTab.reset()
  base.futureSettingsStorage.remote(
    'bilicdn.v2.settings',
    base.futureSettingsStorage.get('bilicdn.v2.settings', null),
  )
  assert.strictEqual(
    base.futureOtherTab.get().considerNativeSources,
    true,
    'settings reset propagates Native-on across tabs even after a future timestamp',
  )
  const delayedStorage = new DelayedSettingsStorage(),
    delayedSettings = base.scope.own(new SettingsStore(delayedStorage, () => base.now))
  await delayedSettings.update({ considerNativeSources: true })
  const delayedSession = new SessionStore(),
    delayedState = delayedSession.beginGeneration(false)
  const delayedVault = new SignedRouteVault()
  delayedVault.reset(delayedState.generation, delayedState.epoch)
  const delayedRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/delayed/video.m4s?signature=delayed'
  delayedVault.register({
    generation: delayedState.generation,
    epoch: delayedState.epoch,
    kind: 'video',
    key: 'delayed',
    height: 1080,
    codec: 'av1',
    bandwidth: 1_000_000,
    urls: [delayedRoot],
    source: 'trusted-api',
  })
  const delayedRoutes = new RouteCoordinator(
    base.clock,
    delayedSession,
    delayedSettings,
    base.scope.own(new RestrictionStore(delayedStorage, () => base.now)),
    base.scope.own(new EvidenceStore(delayedStorage, () => base.now)),
    delayedVault,
    createRuntimeIds(),
  )
  assert.strictEqual(
    delayedRoutes.apply(delayedRoot).decision.routeType,
    'root-original',
    'delayed-lock fixture initially permits Native-on original',
  )
  delayedStorage.holdNextSettingsLock = true
  const pendingNativeOff = delayedSettings.update({
    considerNativeSources: false,
  })
  assert.strictEqual(
    delayedSettings.get().considerNativeSources,
    false,
    'turning Native off takes effect before storage lock callback completes',
  )
  assert.strictEqual(
    delayedRoutes.apply(delayedRoot).decision.routeType,
    'catalog-generated',
    'pre-dispatch routing obeys pending Native-off update',
  )
  delayedStorage.remote('bilicdn.v2.settings', {
    ...delayedSettings.get(),
    considerNativeSources: true,
    updatedAt: base.now + 100,
  })
  assert.strictEqual(
    delayedSettings.get().considerNativeSources,
    false,
    'remote Native-on update cannot reopen Native while a local OFF write is pending',
  )
  delayedStorage.releaseSettingsLock()
  await pendingNativeOff
  assert.strictEqual(
    delayedSettings.get().considerNativeSources,
    false,
    'pending Native-off write completes with OFF state',
  )
  await delayedSettings.update({ considerNativeSources: true })
  delayedStorage.holdNextSettingsLock = true
  delayedSettings.reset()
  assert.strictEqual(
    delayedSettings.get().considerNativeSources,
    false,
    'settings reset defaults Native use OFF before storage lock callback completes',
  )
  assert.strictEqual(
    delayedRoutes.apply(delayedRoot).decision.routeType,
    'catalog-generated',
    'pre-dispatch routing obeys pending settings reset',
  )
}

async function checkExistingSchema2SettingsWithoutNativeToggleDefaultOn13(
  t: TestContext,
): Promise<void> {
  const base = await createExistingSchema2SettingsWithoutNativeToggleDefaultOn13Context11(t)

  assert.strictEqual(
    base.nativeSettings.get().considerNativeSources,
    true,
    'existing schema 2 settings without Native toggle default on',
  )
  assert.strictEqual(
    'codec' in base.nativeSettings.get(),
    false,
    'obsolete codec preference is ignored without changing Native permission',
  )
  await base.nativeSettings.update({ considerNativeSources: true })
  assert.strictEqual(
    base.nativeSettings.get().considerNativeSources,
    true,
    'Native source permission can be enabled',
  )
  const nativeOtherTab = base.scope.own(
    new SettingsStore(base.nativeSettingStorage, () => base.now),
  )
  assert.strictEqual(
    nativeOtherTab.get().considerNativeSources,
    true,
    'Native source permission persists for another tab',
  )
  base.nativeSettingStorage.remote('bilicdn.v2.settings', {
    ...base.nativeSettings.get(),
    considerNativeSources: false,
    updatedAt: base.nativeSettings.get().updatedAt + 1,
  })
  assert.strictEqual(
    base.nativeSettings.get().considerNativeSources,
    false,
    'remote settings can turn Native source use off',
  )
  assert.strictEqual(
    nativeOtherTab.get().considerNativeSources,
    false,
    'remote Native switch reaches another open tab',
  )
  base.nativeSettingStorage.remote('bilicdn.v2.settings', {
    ...base.nativeSettings.get(),
    considerNativeSources: 'true',
    updatedAt: base.nativeSettings.get().updatedAt + 1,
  })
  assert.strictEqual(
    base.nativeSettings.get().considerNativeSources,
    true,
    'non-boolean stored Native permission uses the enabled default',
  )
  await base.nativeSettings.reset()
  assert.strictEqual(
    base.nativeSettings.get().considerNativeSources,
    true,
    'settings reset enables Native source use',
  )
}

async function checkRestrictionAppliesToAudio12(t: TestContext): Promise<void> {
  const base = await createRestrictionAppliesToAudio12Context10(t)

  assert.strictEqual(
    base.restrictions.has(TRUSTED_CATALOG[0], 'audio', 'black'),
    true,
    'restriction applies to audio',
  )
  base.storage.remote('bilicdn.v2.restrictions', {
    schema: 2,
    records: [],
    updatedAt: base.now + 1,
  })
  assert.strictEqual(
    base.restrictions.has(TRUSTED_CATALOG[0], 'video'),
    false,
    'newer remote removal replaces stale restriction state',
  )
  await base.restrictions.add({
    host: TRUSTED_CATALOG[0],
    type: 'black',
    kind: 'all',
    reason: 'test',
    expireAt: base.now + 1000,
  })
  await base.restrictions.remove(TRUSTED_CATALOG[0], 'black')
  assert.strictEqual(
    base.restrictions.has(TRUSTED_CATALOG[0], 'video'),
    false,
    'restriction removal applies immediately',
  )
  const legacyUserRestriction = new FakeStorage()
  legacyUserRestriction.set('bilicdn.v2.restrictions', {
    schema: 2,
    updatedAt: base.now,
    records: [
      {
        host: TRUSTED_CATALOG[0],
        type: 'black',
        kind: 'video',
        reason: 'user',
        createdAt: base.now,
        updatedAt: base.now,
        expireAt: base.now + 60_000,
      },
    ],
  })
  const restoredUserRestriction = base.scope.own(
    new RestrictionStore(legacyUserRestriction, () => base.now),
  )
  assert.strictEqual(
    restoredUserRestriction.has(TRUSTED_CATALOG[0], 'audio', 'black'),
    true,
    'existing user-created video blacklist also protects audio after update',
  )
  assert.strictEqual(
    restoredUserRestriction.list()[0]?.kind,
    'all',
    'existing user-created blacklist displays its effective scope',
  )
  const settings = base.scope.own(new SettingsStore(base.storage, () => base.now))
  const evidenceStore = base.scope.own(new EvidenceStore(base.storage, () => base.now))
  new SessionStore()
  await settings.update({ considerNativeSources: true })
  await evidenceStore.record(TRUSTED_CATALOG[0], 'video', {
    requestId: 'remote-clear',
    at: base.now,
    source: 'transport',
    outcome: 'success',
    throughputMbps: 8,
    ttfbMs: 20,
    failureKind: null,
  })
  assert.ok(evidenceStore.get(TRUSTED_CATALOG[0], 'video'), 'evidence store records local result')
  base.storage.remote('bilicdn.v2.routeEvidence', {
    schema: 2,
    records: {},
    updatedAt: base.now + 1,
  })
  assert.strictEqual(
    evidenceStore.get(TRUSTED_CATALOG[0], 'video'),
    null,
    'newer remote clear removes stale evidence',
  )
  const legacyOnly = new FakeStorage()
  legacyOnly.set('cdnHealth', { poisoned: true })
  legacyOnly.set('workerStats_v1', { created: 99 })
  const freshSettings = base.scope.own(new SettingsStore(legacyOnly, () => base.now))
  assert.strictEqual(freshSettings.get().earlyRetryEnabled, true, 'v2 settings ignore every v1 key')
  assert.strictEqual(
    [...legacyOnly.values.keys()].includes('bilicdn.v2.settings'),
    false,
    'reading defaults does not migrate legacy data',
  )
  assert.strictEqual(
    freshSettings.get().considerNativeSources,
    true,
    'Native source use defaults on without stored v2 settings',
  )
}

test('restriction applies to audio [12]', { timeout: 5000 }, async (t) => {
  await checkRestrictionAppliesToAudio12(t)
})

test(
  'existing schema 2 settings without Native toggle default on [13]',
  { timeout: 5000 },
  async (t) => {
    await checkExistingSchema2SettingsWithoutNativeToggleDefaultOn13(t)
  },
)

test(
  'other tab receives a Native-on setting with a future timestamp [14]',
  { timeout: 5000 },
  async (t) => {
    await checkOtherTabReceivesANativeOnSettingWithAFutureTimestamp(t)
  },
)
