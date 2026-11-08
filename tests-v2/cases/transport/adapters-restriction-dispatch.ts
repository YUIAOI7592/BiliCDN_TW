import { createMutablePlaybackResources } from '../../support/player.ts'
import { CatalogSettingsStore } from '../../support/catalog-settings.ts'
import { currentResumePlayer } from '../../support/player.ts'
import { installProgressEvent } from '../../support/progress-event.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { type TestContext } from 'node:test'
import { PlayurlController } from '../../../src-v2/application/playurl/playurl-controller.ts'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import { RestrictionStore } from '../../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../../src-v2/state/evidence-store.ts'
import { RouteCoordinator } from '../../../src-v2/application/routing/route-coordinator.ts'
import { TransportAdapter } from '../../../src-v2/adapters/transport/transport.ts'
import { type AppliedRouteDecision } from '../../../src-v2/application/routing/route-contracts.ts'
import { RecoveryController } from '../../../src-v2/application/playback/recovery-controller.ts'
import { PlayurlAdapter } from '../../../src-v2/adapters/playurl/playurl.ts'
import { testScope } from '../../support/scope.ts'
import {
  createTransportHookResources,
  createNativeControlSources,
  createOpaqueControlSources,
  createOutputStores,
} from './adapters-resources.ts'

async function createParameterInvalidatesCachedFallbackOnNextRequest9ParameterParameterContext9(
  t: TestContext,
) {
  const scope = testScope(t)
  installProgressEvent(scope)
  const now = 2_000_000_000_000
  const clock = { now: () => now }
  const block7 = createOutputStores()
  const { outputVault, outputState, outputStorage, outputSession } = block7
  outputVault.reset(outputState.generation, outputState.epoch)
  const outputSettings = scope.own(new CatalogSettingsStore(outputStorage, () => now))
  const outputRestrictions = scope.own(new RestrictionStore(outputStorage, () => now))
  const outputEvidence = scope.own(new EvidenceStore(outputStorage, () => now))
  const outputRoutes = new RouteCoordinator(
    clock,
    outputSession,
    outputSettings,
    outputRestrictions,
    outputEvidence,
    outputVault,
    createRuntimeIds(),
  )
  const outputAdapter = new PlayurlAdapter(
    new PlayurlController(outputSession, outputVault, outputRoutes),
  )
  const forbiddenUrl = 'https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/test/output/1.m4s?k=1'
  const outputItem = {
    id: 80,
    codecid: 13,
    height: 1080,
    bandwidth: 1_000_000,
    base_url: forbiddenUrl,
    backup_url: [forbiddenUrl],
  }
  outputAdapter.transform({ data: { dash: { video: [outputItem], audio: [] } } })
  const alternateOutput = outputItem.backup_url.find(
    (url) => new URL(url).host !== new URL(outputItem.base_url).host,
  )
  const alternateHost = new URL(alternateOutput!).host
  return {
    alternateHost,
    alternateOutput,
    forbiddenUrl,
    now,
    outputAdapter,
    outputItem,
    outputRestrictions,
    outputRoutes,
    outputSettings,
  }
}

async function createNativeControlUrlContext11(t: TestContext) {
  const scope = testScope(t)
  installProgressEvent(scope)
  const now = 2_000_000_000_000
  const clock = { now: () => now }
  const block7 = createOutputStores()
  const { outputVault, outputState, outputStorage, outputSession } = block7
  outputVault.reset(outputState.generation, outputState.epoch)
  const outputSettings = scope.own(new CatalogSettingsStore(outputStorage, () => now))
  const outputRestrictions = scope.own(new RestrictionStore(outputStorage, () => now))
  const outputEvidence = scope.own(new EvidenceStore(outputStorage, () => now))
  const outputRoutes = new RouteCoordinator(
    clock,
    outputSession,
    outputSettings,
    outputRestrictions,
    outputEvidence,
    outputVault,
    createRuntimeIds(),
  )
  const outputAdapter = new PlayurlAdapter(
    new PlayurlController(outputSession, outputVault, outputRoutes),
  )
  const block5 = createNativeControlSources()
  const { controlItem, nativeControlUrl, nativeControlBackup } = block5
  outputAdapter.transform({ data: { dash: { video: [controlItem], audio: [] } } }, 'page-hint')
  const blockedControlItem = {
    ...controlItem,
    base_url: nativeControlUrl,
    backup_url: [nativeControlBackup],
  }
  outputAdapter.transform(
    { data: { dash: { video: [blockedControlItem], audio: [] } } },
    'page-hint',
  )
  void outputVault.contextForUrl(nativeControlBackup)!.representation
  return {
    now,
    outputRestrictions,
    outputRoutes,
    outputSettings,
    outputState,
    outputVault,
  }
}

async function createInitialDeadLookingStartupWithoutPreviousHealthIsNotAnIncidentContext13(
  t: TestContext,
) {
  const scope = testScope(t)
  installProgressEvent(scope)
  const now = 2_000_000_000_000
  const clock = { now: () => now }
  const block1 = await createTransportHookResources()
  const { fakeWindow, FakeXhr } = block1
  scope.defineGlobal('unsafeWindow', { configurable: true, value: fakeWindow })
  scope.defineGlobal('location', {
    configurable: true,
    value: new URL('https://www.bilibili.com/video/BVtest/'),
  })
  const measurementStub = {
    willGateStartup: (): boolean => false,
    prepareStartup: async (): Promise<void> => {},
    noteUnpreflighted(_reason: string): void {},
  }
  const block3 = createMutablePlaybackResources()
  const { recoveryPlayer } = block3
  const block7 = createOutputStores()
  const { outputVault, outputState, outputStorage, outputSession } = block7
  outputVault.reset(outputState.generation, outputState.epoch)
  const outputSettings = scope.own(new CatalogSettingsStore(outputStorage, () => now))
  const outputRestrictions = scope.own(new RestrictionStore(outputStorage, () => now))
  const outputEvidence = scope.own(new EvidenceStore(outputStorage, () => now))
  const outputRoutes = new RouteCoordinator(
    clock,
    outputSession,
    outputSettings,
    outputRestrictions,
    outputEvidence,
    outputVault,
    createRuntimeIds(),
  )
  const outputAdapter = new PlayurlAdapter(
    new PlayurlController(outputSession, outputVault, outputRoutes),
  )
  const forbiddenUrl = 'https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/test/output/1.m4s?k=1'
  const outputItem = {
    id: 80,
    codecid: 13,
    height: 1080,
    bandwidth: 1_000_000,
    base_url: forbiddenUrl,
    backup_url: [forbiddenUrl],
  }
  outputAdapter.transform({ data: { dash: { video: [outputItem], audio: [] } } })
  const exceptionalForbidden = `${forbiddenUrl}&os=mcdn`
  const exceptionalItem = {
    ...outputItem,
    id: 180,
    base_url: exceptionalForbidden,
    backup_url: [exceptionalForbidden],
  }
  outputAdapter.transform({ data: { dash: { video: [exceptionalItem], audio: [] } } })
  const block6 = createOpaqueControlSources()
  const { opaqueItem, opaquePrimary, opaqueBackup } = block6
  outputAdapter.transform({ data: { dash: { video: [opaqueItem], audio: [] } } }, 'page-hint')
  void outputRoutes.apply(opaquePrimary)
  const opaqueRestricted = {
    ...opaqueItem,
    base_url: opaquePrimary,
    backup_url: [opaqueBackup],
  }
  outputAdapter.transform({ data: { dash: { video: [opaqueRestricted], audio: [] } } }, 'page-hint')
  const mixedItem = {
    id: 82,
    codecid: 13,
    height: 1080,
    bandwidth: 1_000_000,
    base_url:
      'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/test/mixed/82.m4s?signature=private',
    backup_url: ['https://upos-hz-mirrorakam.akamaized.net/opaque/mixed-82?signature=private'],
  }
  outputAdapter.transform({ data: { dash: { video: [mixedItem], audio: [] } } }, 'page-hint')
  const alternateOutput = outputItem.backup_url.find(
    (url) => new URL(url).host !== new URL(outputItem.base_url).host,
  )
  void outputRoutes.apply(alternateOutput ?? '')
  let coreClock = now
  let coreReloads = 0
  const coreObserver = scope.own(
    new RecoveryController(
      currentResumePlayer({
        ...recoveryPlayer,
        reload: () => {
          coreReloads++
        },
      }),
      () => coreClock,
    ),
  )
  coreObserver.tick({
    ...block3.playerSnapshot,
    paused: false,
    readyState: 4,
    width: 1920,
    height: 1080,
  })
  const deadPaused = {
    ...block3.playerSnapshot,
    paused: true,
    readyState: 0,
    width: 0,
    height: 0,
    frames: 0,
    coreInitialized: false,
  }
  for (let tick = 0; tick < 5; tick++) {
    coreClock += 1000
    coreObserver.tick(deadPaused)
  }
  coreClock += 31_000
  for (let tick = 0; tick < 100; tick++) {
    coreClock += 1000
    coreObserver.tick(deadPaused)
  }
  void outputVault.contextForUrl(outputItem.base_url)!.representation
  ;(
    outputRoutes.apply(outputItem.base_url) as AppliedRouteDecision & {
      playurlOutput?: {
        originalHost: string
        outputHost: string
        source: string
        decisionId: string
        role: string
      }
    }
  ).playurlOutput
  const alternateHost = new URL(alternateOutput!).host
  for (const type of ['black', 'dead'] as const) {
    await outputRestrictions.add({
      host: alternateHost,
      type,
      kind: 'all',
      reason: 'regression',
      expireAt: now + 60_000,
    })
    await outputSettings.update({ fixedHost: alternateHost })
    outputRoutes.invalidateForUserSetting()
    const item = { ...outputItem, base_url: forbiddenUrl, backup_url: [alternateOutput!] }
    outputAdapter.transform({ data: { dash: { video: [item], audio: [] } } })
    await outputRestrictions.remove(alternateHost, type)
  }
  outputRoutes.invalidateForUserSetting()
  const block5 = createNativeControlSources()
  const { controlItem, nativeControlUrl, nativeControlBackup } = block5
  outputAdapter.transform({ data: { dash: { video: [controlItem], audio: [] } } }, 'page-hint')
  const blockedControlItem = {
    ...controlItem,
    base_url: nativeControlUrl,
    backup_url: [nativeControlBackup],
  }
  outputAdapter.transform(
    { data: { dash: { video: [blockedControlItem], audio: [] } } },
    'page-hint',
  )
  void outputVault.contextForUrl(nativeControlBackup)!.representation
  const ungroupedHost = TRUSTED_CATALOG[0]
  const audioScopedUrl = `https://${ungroupedHost}/upgcxcode/test/audio/1.m4s?k=1`
  outputVault.register({
    generation: outputState.generation,
    epoch: outputState.epoch,
    kind: 'audio',
    key: 'scope-audio',
    height: 0,
    codec: 'other',
    bandwidth: 128_000,
    urls: [audioScopedUrl],
    source: 'trusted-api',
  })
  for (const type of ['black', 'dead'] as const) {
    await outputRestrictions.add({
      host: ungroupedHost,
      type,
      kind: 'all',
      reason: 'exceptional',
      expireAt: now + 60_000,
    })
    await outputRestrictions.remove(ungroupedHost, type)
  }
  void alternateOutput!.replace('k=1', 'k=unknown')
  void outputSession.get()
  const gapRecovery = scope.own(
    new RecoveryController(currentResumePlayer(recoveryPlayer), () => coreClock),
  )
  gapRecovery.reset()
  return {
    FakeXhr,
    forbiddenUrl,
    measurementStub,
    now,
    outputAdapter,
    outputItem,
    outputRestrictions,
    outputRoutes,
    outputSession,
    outputSettings,
    scope,
  }
}

async function checkParameterBlocksPCDNMarkedCatalogHost12ParameterParameter(
  t: TestContext,
  parameter = 0,
): Promise<void> {
  const base = await createNativeControlUrlContext11(t)

  await base.outputRestrictions.remove('upos-sz-mirrorali.bilivideo.com', 'black')
  await base.outputSettings.update({ considerNativeSources: false })
  const ungroupedHost = TRUSTED_CATALOG[0]
  const ungroupedUrl = `https://${ungroupedHost}/upgcxcode/test/ungrouped/1.m4s?k=1`
  await base.outputRestrictions.add({
    host: ungroupedHost,
    type: 'black',
    kind: 'audio',
    reason: 'ungrouped-audio',
    expireAt: base.now + 60_000,
  })
  await base.outputRestrictions.remove(ungroupedHost, 'black')
  const audioScopedUrl = `https://${ungroupedHost}/upgcxcode/test/audio/1.m4s?k=1`
  base.outputVault.register({
    generation: base.outputState.generation,
    epoch: base.outputState.epoch,
    kind: 'audio',
    key: 'scope-audio',
    height: 0,
    codec: 'other',
    bandwidth: 128_000,
    urls: [audioScopedUrl],
    source: 'trusted-api',
  })
  await base.outputRestrictions.add({
    host: ungroupedHost,
    type: 'black',
    kind: 'all',
    reason: 'user',
    expireAt: base.now + 60_000,
  })
  await base.outputRestrictions.remove(ungroupedHost, 'black')

  let iteration = 0
  for (const type of ['black', 'dead'] as const) {
    if (iteration++ === parameter) {
      await base.outputRestrictions.add({
        host: ungroupedHost,
        type,
        kind: 'all',
        reason: 'exceptional',
        expireAt: base.now + 60_000,
      })
      assert.strictEqual(
        base.outputRoutes.apply(`${ungroupedUrl}&os=mcdn`).url,
        null,
        `${type} blocks PCDN-marked Catalog host`,
      )
      await base.outputRestrictions.remove(ungroupedHost, type)

      return
    }
  }
  throw Error('Unknown fixture parameter')
}

async function checkParameterInvalidatesCachedFallbackOnNextRequest9ParameterParameter(
  t: TestContext,
  parameter = 0,
): Promise<void> {
  const base =
    await createParameterInvalidatesCachedFallbackOnNextRequest9ParameterParameterContext9(t)

  let iteration = 0
  for (const type of ['black', 'dead'] as const) {
    if (iteration++ === parameter) {
      await base.outputRestrictions.add({
        host: base.alternateHost,
        type,
        kind: 'all',
        reason: 'regression',
        expireAt: base.now + 60_000,
      })
      assert.ok(
        base.outputRoutes.apply(base.alternateOutput!).decision.host !== base.alternateHost,
        `${type} invalidates cached fallback on next request`,
      )
      await base.outputSettings.update({ fixedHost: base.alternateHost })
      base.outputRoutes.invalidateForUserSetting()
      assert.ok(
        base.outputRoutes.apply(base.alternateOutput!).decision.host !== base.alternateHost,
        `fixed CDN cannot bypass ${type}`,
      )
      const item = {
        ...base.outputItem,
        base_url: base.forbiddenUrl,
        backup_url: [base.alternateOutput!],
      }
      base.outputAdapter.transform({ data: { dash: { video: [item], audio: [] } } })
      assert.ok(
        ![item.base_url, ...item.backup_url].some(
          (url) => url && new URL(url).host === base.alternateHost,
        ),
        `${type} filtered from all playurl outputs`,
      )
      await base.outputRestrictions.remove(base.alternateHost, type)

      return
    }
  }
  throw Error('Unknown fixture parameter')
}

{
  let parameter = 0
  for (const type of ['black', 'dead'] as const) {
    const selected = parameter++
    test(
      '`${type} invalidates cached fallback on next request` [9]' +
        ` / ${String(type)} / ${selected}`,
      { timeout: 5000 },
      async (t) => {
        await checkParameterInvalidatesCachedFallbackOnNextRequest9ParameterParameter(t, selected)
      },
    )
  }
}

{
  let parameter = 0
  for (const type of ['black', 'dead'] as const) {
    const selected = parameter++
    test(
      '`${type} blocks PCDN-marked Catalog host` [12]' + ` / ${String(type)} / ${selected}`,
      { timeout: 5000 },
      async (t) => {
        await checkParameterBlocksPCDNMarkedCatalogHost12ParameterParameter(t, selected)
      },
    )
  }
}

test(
  'V221 audio restrictions remain enforced without diagnostic reports',
  { timeout: 5000 },
  async (t) => {
    const base = await createNativeControlUrlContext11(t)
    await base.outputRestrictions.remove('upos-sz-mirrorali.bilivideo.com', 'black')
    await base.outputSettings.update({ considerNativeSources: false })
    const host = TRUSTED_CATALOG[0]
    const ungroupedUrl = `https://${host}/upgcxcode/test/ungrouped/1.m4s?k=1`
    await base.outputRestrictions.add({
      host,
      type: 'black',
      kind: 'audio',
      reason: 'ungrouped-audio',
      expireAt: base.now + 60_000,
    })
    assert.notStrictEqual(
      base.outputRoutes.apply(ungroupedUrl).decision.host,
      host,
      'ungrouped media cannot use a host with an audio-only blacklist',
    )
    await base.outputRestrictions.remove(host, 'black')
    const audioUrl = `https://${host}/upgcxcode/test/audio/1.m4s?k=1`
    assert.ok(
      base.outputVault.register({
        generation: base.outputState.generation,
        epoch: base.outputState.epoch,
        kind: 'audio',
        key: 'scope-audio',
        height: 0,
        codec: 'other',
        bandwidth: 128_000,
        urls: [audioUrl],
        source: 'trusted-api',
      }),
    )
    await base.outputRestrictions.add({
      host,
      type: 'black',
      kind: 'all',
      reason: 'user',
      expireAt: base.now + 60_000,
    })
    assert.notStrictEqual(base.outputRoutes.apply(audioUrl).decision.host, host)
    assert.strictEqual(
      base.outputRoutes.apply(`${audioUrl}&os=mcdn`).url,
      null,
      'user-wide blacklist locally blocks an exceptional audio route',
    )
  },
)

test(
  'V221 XHR retains single dispatch and before-send restriction checks',
  { timeout: 5000 },
  async (t) => {
    const base =
      await createInitialDeadLookingStartupWithoutPreviousHealthIsNotAnIncidentContext13(t)
    await base.outputSettings.update({ catalogOverrides: {}, fixedHost: null })
    base.outputRoutes.invalidateForUserSetting()
    const adapter = base.scope.own(
      new TransportAdapter(
        base.outputSession,
        base.outputSettings,
        base.outputRoutes,
        base.outputAdapter,
        base.measurementStub,
        () => base.now,
        createRuntimeIds(),
        undefined,
        () => base.now,
      ),
    )
    adapter.install()
    const tracedXhr = new base.FakeXhr()
    tracedXhr.open('GET', base.outputItem.base_url)
    tracedXhr.send()
    await Promise.resolve()
    const latest = base.outputRoutes.snapshot().latest.video
    assert.strictEqual(tracedXhr.nativeSends, 1)
    assert.strictEqual(latest?.targetHost, new URL(tracedXhr.url).host)
    assert.strictEqual(latest?.playurlOutput?.originalHost, 'upos-sz-mirrorcosov.bilivideo.com')
    const actualXhr = new base.FakeXhr()
    actualXhr.open('GET', base.forbiddenUrl)
    assert.ok(!actualXhr.url.includes('mirrorcosov'), 'open receives a rewritten legal host')
    const beforeSendHost = new URL(actualXhr.url).host
    await base.outputRestrictions.add({
      host: beforeSendHost,
      type: 'black',
      kind: 'all',
      reason: 'before-send',
      expireAt: base.now + 60_000,
    })
    actualXhr.send()
    assert.strictEqual(actualXhr.nativeSends, 1)
    assert.notStrictEqual(new URL(actualXhr.url).host, beforeSendHost)
    await base.outputSettings.update({
      catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map((host) => [host, false])),
    })
    const blockedXhr = new base.FakeXhr()
    blockedXhr.open('GET', base.forbiddenUrl)
    blockedXhr.send()
    assert.strictEqual(blockedXhr.nativeSends, 0, 'no alternative never sends a forbidden request')
  },
)
