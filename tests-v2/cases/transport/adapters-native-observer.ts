import { createMutablePlaybackResources } from '../../support/player.ts'
import { CatalogSettingsStore } from '../../support/catalog-settings.ts'
import { currentResumePlayer } from '../../support/player.ts'
import { installProgressEvent } from '../../support/progress-event.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { type TestContext } from 'node:test'
import { playurlResult } from '../../support/playurl.ts'
import { PlayurlController } from '../../../src-v2/application/playurl/playurl-controller.ts'
import { decisionId, epochId, generationId } from '../../../src-v2/domain/model.ts'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import { RestrictionStore } from '../../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../../src-v2/state/evidence-store.ts'
import { RouteCoordinator } from '../../../src-v2/application/routing/route-coordinator.ts'
import { TransportAdapter } from '../../../src-v2/adapters/transport/transport.ts'
import { type AppliedRouteDecision } from '../../../src-v2/application/routing/route-contracts.ts'
import { type TransportObservation } from '../../../src-v2/domain/transport-model.ts'
import { RecoveryController } from '../../../src-v2/application/playback/recovery-controller.ts'
import { PlayerAdapter } from '../../../src-v2/adapters/player/player.ts'
import { PlayurlAdapter } from '../../../src-v2/adapters/playurl/playurl.ts'
import { testScope } from '../../support/scope.ts'
import {
  createTransportHookResources,
  createNativeControlSources,
  createOpaqueControlSources,
  createOutputStores,
} from './adapters-resources.ts'

async function createHealthyCustomRateContext12(t: TestContext) {
  const scope = testScope(t)
  installProgressEvent(scope)
  const now = 2_000_000_000_000
  const clock = { now: () => now }
  const block3 = createMutablePlaybackResources()
  const { recoveryPlayer } = block3
  const healthyCustomRate = { ...block3.playerSnapshot, playbackRate: 1.5, effectiveRate: 1.5 }
  const healthyObservation: TransportObservation = {
    generation: generationId(1),
    epoch: epochId(1),
    decisionId: decisionId('aggregate'),
    representation: null,
    kind: 'video',
    routeType: 'catalog-generated',
    originalHost: 'a.example',
    targetHost: 'b.example',
    finalHost: 'b.example',
    status: 206,
    bytes: 100_000,
    ttfbMs: 20,
    elapsedMs: 100,
    completedAt: now,
    outcome: 'success',
    streamKey: 'aggregate',
  }
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
  const fallbackApplied = outputRoutes.apply(alternateOutput ?? '')
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
  const outputRep = outputVault.contextForUrl(outputItem.base_url)!.representation
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
  const unknownQuery = alternateOutput!.replace('k=1', 'k=unknown')
  return {
    get coreClock() {
      return coreClock
    },
    set coreClock(value: typeof coreClock) {
      coreClock = value
    },
    deadPaused,
    fallbackApplied,
    forbiddenUrl,
    healthyCustomRate,
    healthyObservation,
    now,
    outputAdapter,
    outputEvidence,
    outputItem,
    outputRep,
    outputRoutes,
    outputSession,
    outputSettings,
    recoveryPlayer,
    scope,
    unknownQuery,
  }
}

async function createXHRDoesNotSendDefaultUnavailablePCDNMarkedMedia15Context14(t: TestContext) {
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
  outputRoutes.invalidateForUserSetting()
  const realAdapter = scope.own(
    new TransportAdapter(
      outputSession,
      outputSettings,
      outputRoutes,
      outputAdapter,
      measurementStub,
      () => now,
      createRuntimeIds(),
      undefined,
      () => now,
    ),
  )
  realAdapter.install()
  const tracedXhr = new FakeXhr()
  tracedXhr.open('GET', outputItem.base_url)
  tracedXhr.send()
  await Promise.resolve()
  outputRoutes.snapshot().latest.video
  const actualXhr = new FakeXhr()
  actualXhr.open('GET', forbiddenUrl)
  actualXhr.send()
  await outputSettings.update({
    catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map((host) => [host, false])),
  })
  const blockedXhr = new FakeXhr()
  blockedXhr.open('GET', forbiddenUrl)
  blockedXhr.send()
  const exceptionalXhr = new FakeXhr()
  exceptionalXhr.open('GET', exceptionalForbidden)
  exceptionalXhr.send()
  return {
    FakeXhr,
    exceptionalForbidden,
    exceptionalXhr,
    fakeWindow,
    forbiddenUrl,
    get nativeFetchCalls() {
      return block1.nativeFetchCalls
    },
    set nativeFetchCalls(value: typeof block1.nativeFetchCalls) {
      block1.nativeFetchCalls = value
    },
    outputSettings,
  }
}

async function createPlayObserverInstalledOnFirstPausedTickNotThirtySecondsLaterContext15(
  t: TestContext,
) {
  const scope = testScope(t)
  installProgressEvent(scope)
  const now = 2_000_000_000_000
  const clock = { now: () => now }
  const block1 = await createTransportHookResources()
  const { fakeWindow } = block1
  scope.defineGlobal('unsafeWindow', { configurable: true, value: fakeWindow })
  scope.defineGlobal('location', {
    configurable: true,
    value: new URL('https://www.bilibili.com/video/BVtest/'),
  })
  const block3 = createMutablePlaybackResources()
  const { recoveryPlayer } = block3
  const healthyCustomRate = { ...block3.playerSnapshot, playbackRate: 1.5, effectiveRate: 1.5 }
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
  await outputRestrictions.remove('upos-hz-mirrorakam.akamaized.net', 'black')
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
  let intentClock = now
  let intentReloads = 0
  let activation = false
  let intentVideo = { ...healthyCustomRate }
  const intentTarget = { play: () => 'original-result' }
  return {
    get activation() {
      return activation
    },
    set activation(value: typeof activation) {
      activation = value
    },
    deadPaused,
    fakeWindow,
    get intentClock() {
      return intentClock
    },
    set intentClock(value: typeof intentClock) {
      intentClock = value
    },
    get intentReloads() {
      return intentReloads
    },
    set intentReloads(value: typeof intentReloads) {
      intentReloads = value
    },
    intentTarget,
    get intentVideo() {
      return intentVideo
    },
    set intentVideo(value: typeof intentVideo) {
      intentVideo = value
    },
    outputAdapter,
    outputRoutes,
    outputSession,
    outputSettings,
    outputVault,
    recoveryPlayer,
    scope,
  }
}

async function checkPlayObserverInstalledOnFirstPausedTickNotThirtySecondsLater(
  t: TestContext,
): Promise<void> {
  const base = await createPlayObserverInstalledOnFirstPausedTickNotThirtySecondsLaterContext15(t)

  const originalIntentPlay = base.intentTarget.play
  Object.defineProperty(base.fakeWindow, 'navigator', {
    configurable: true,
    value: {
      userActivation: {
        get isActive() {
          return base.activation
        },
      },
    },
  })
  class IntentAdapter extends PlayerAdapter {
    protected override player(): Record<string, unknown> {
      return base.intentTarget
    }
  }
  const intentAdapter = new IntentAdapter(
    { transform: () => playurlResult(false), lifecycleKey: () => 'test' },
    {
      scheduler: { timeout: () => () => undefined },
      isActuallyVisible: () => true,
      subscribeControlLoss: () => () => undefined,
    },
  )
  const intentRecovery = base.scope.own(
    new RecoveryController(
      currentResumePlayer({
        ...base.recoveryPlayer,
        observePlayIntent: (listener) => intentAdapter.observePlayIntent(listener),
        snapshot: () => base.intentVideo,
        reload: () => {
          base.intentReloads++
        },
        playbackRate: () => 1.5,
      }),
      () => base.intentClock,
    ),
  )
  intentRecovery.tick(base.intentVideo)
  base.intentVideo = { ...base.deadPaused }
  base.intentClock += 1000
  intentRecovery.tick(base.intentVideo)

  assert.ok(
    base.intentTarget.play !== originalIntentPlay,
    'play observer installed on first paused tick, not thirty seconds later',
  )
  base.intentClock += 31_000
  assert.strictEqual(
    base.intentTarget.play(),
    'original-result',
    'play observer preserves original return',
  )
  assert.strictEqual(intentRecovery.isRecovering(), false, 'untrusted play call never arms reload')
  base.activation = true
  base.intentTarget.play()
  assert.strictEqual(
    intentRecovery.isRecovering(),
    true,
    'trusted long-pause request arms intent while video stays paused',
  )
  for (let tick = 0; tick < 4; tick++) {
    base.intentClock += 1000
    intentRecovery.tick(base.intentVideo)
  }
  assert.strictEqual(base.intentReloads, 1, 'dead paused video with valid intent reloads once')
  base.intentClock += 1000
  intentRecovery.tick(base.intentVideo)
  assert.strictEqual(base.intentReloads, 1, 'repeated dead ticks cannot loop reload')
  intentRecovery.reset()
  assert.strictEqual(
    base.intentTarget.play,
    originalIntentPlay,
    'generation reset restores owned play method',
  )
}

async function checkEligibleNativeBackupUsesItsOwnFullSignedURL17(t: TestContext): Promise<void> {
  const base = await createPlayObserverInstalledOnFirstPausedTickNotThirtySecondsLaterContext15(t)

  Object.defineProperty(base.fakeWindow, 'navigator', {
    configurable: true,
    value: {
      userActivation: {
        get isActive() {
          return base.activation
        },
      },
    },
  })
  class IntentAdapter extends PlayerAdapter {
    protected override player(): Record<string, unknown> {
      return base.intentTarget
    }
  }
  const intentAdapter = new IntentAdapter(
    { transform: () => playurlResult(false), lifecycleKey: () => 'test' },
    {
      scheduler: { timeout: () => () => undefined },
      isActuallyVisible: () => true,
      subscribeControlLoss: () => () => undefined,
    },
  )
  const intentRecovery = base.scope.own(
    new RecoveryController(
      currentResumePlayer({
        ...base.recoveryPlayer,
        observePlayIntent: (listener) => intentAdapter.observePlayIntent(listener),
        snapshot: () => base.intentVideo,
        reload: () => {
          base.intentReloads++
        },
        playbackRate: () => 1.5,
      }),
      () => base.intentClock,
    ),
  )
  intentRecovery.tick(base.intentVideo)
  base.intentVideo = { ...base.deadPaused }
  base.intentClock += 1000
  intentRecovery.tick(base.intentVideo)
  base.intentClock += 31_000
  base.activation = true
  base.intentTarget.play()
  for (let tick = 0; tick < 4; tick++) {
    base.intentClock += 1000
    intentRecovery.tick(base.intentVideo)
  }
  base.intentClock += 1000
  intentRecovery.tick(base.intentVideo)
  intentRecovery.reset()
  await base.outputSettings.update({
    considerNativeSources: true,
    disabled: false,
    catalogOverrides: {},
    fixedHost: null,
  })
  base.outputRoutes.invalidateForUserSetting()
  const nativeAudioUrl =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/test/output/audio.m4s?s=exact'
  const audioItem = {
    id: 30280,
    base_url: nativeAudioUrl,
    backup_url: [],
    bandwidth: 100_000,
  }
  base.outputAdapter.transform({ data: { dash: { video: [], audio: [audioItem] } } })
  const beforeAudioAffinity = base.outputSession.get().affinity
  const nativeAudioApplied = base.outputRoutes.apply(nativeAudioUrl)

  assert.strictEqual(
    nativeAudioApplied.url,
    nativeAudioUrl,
    'eligible Native backup uses its own full signed URL',
  )
  assert.strictEqual(
    nativeAudioApplied.decision.routeType,
    'root-original',
    'cold-start signed original remains unchanged before preflight',
  )
  assert.strictEqual(
    base.outputSession.get().affinity,
    beforeAudioAffinity,
    'audio backup request does not alter video affinity',
  )
  const audioRep = nativeAudioApplied.context!.representation
  base.outputVault.invalidate(audioRep, new URL(nativeAudioUrl).host)
  assert.ok(
    base.outputRoutes.apply(nativeAudioUrl).url !== nativeAudioUrl,
    'invalid Native cannot return through existing backup role',
  )
  const repeatAudio = {
    id: 30280,
    base_url: nativeAudioUrl,
    backup_url: [nativeAudioUrl],
    bandwidth: 100_000,
  }
  base.outputAdapter.transform({ data: { dash: { video: [], audio: [repeatAudio] } } })
  assert.ok(
    ![repeatAudio.base_url, ...repeatAudio.backup_url].includes(nativeAudioUrl),
    'invalid Native is removed from refreshed player outputs',
  )
  const nextGeneration = base.outputSession.beginGeneration(false)
  base.outputVault.reset(nextGeneration.generation, nextGeneration.epoch)
  base.outputRoutes.resetEpoch()
  assert.strictEqual(
    base.outputVault.outputRole(audioRep, nativeAudioUrl),
    null,
    'generation reset discards output roles',
  )
  const resetSnapshot = base.outputRoutes.snapshot()
  assert.deepEqual(resetSnapshot.latest, {}, 'generation reset drops old response attribution')
  assert.deepEqual(resetSnapshot.requested, {}, 'generation reset drops old requests')
  assert.equal(resetSnapshot.currentCapacity, null, 'generation reset drops old capacity')
}

async function checkXHRDoesNotSendDefaultUnavailablePCDNMarkedMedia15(
  t: TestContext,
): Promise<void> {
  const base = await createXHRDoesNotSendDefaultUnavailablePCDNMarkedMedia15Context14(t)

  assert.strictEqual(
    base.exceptionalXhr.nativeSends,
    0,
    'XHR does not send default-unavailable PCDN-marked media',
  )
  const fetchCountBeforeBlock = base.nativeFetchCalls
  let fetchBlocked = false
  try {
    await base.fakeWindow.fetch(base.forbiddenUrl)
  } catch {
    fetchBlocked = true
  }
  assert.ok(fetchBlocked, 'no-alternative Fetch rejects locally')
  assert.strictEqual(
    base.nativeFetchCalls,
    fetchCountBeforeBlock,
    'blocked Fetch sends no native request',
  )
  let exceptionalFetchBlocked = false
  try {
    await base.fakeWindow.fetch(base.exceptionalForbidden)
  } catch {
    exceptionalFetchBlocked = true
  }
  assert.ok(exceptionalFetchBlocked, 'Fetch does not send default-unavailable PCDN-marked media')
  assert.strictEqual(
    base.nativeFetchCalls,
    fetchCountBeforeBlock,
    'exceptional Fetch does not reach native transport',
  )
  await base.outputSettings.update({ disabled: true })
  const enabledAfterOpen = new base.FakeXhr()
  enabledAfterOpen.open('GET', base.forbiddenUrl)
  await base.outputSettings.update({ disabled: false })
  enabledAfterOpen.send()
  assert.strictEqual(
    enabledAfterOpen.nativeSends,
    0,
    'XHR opened while disabled rechecks restriction when enabled before send',
  )
  await base.outputSettings.update({ disabled: true })
  const disabledXhr = new base.FakeXhr()
  disabledXhr.open('GET', base.forbiddenUrl)
  disabledXhr.send()
  assert.strictEqual(
    disabledXhr.url,
    base.forbiddenUrl,
    'disabled adapter preserves website original request',
  )
  assert.strictEqual(disabledXhr.nativeSends, 1, 'disabled adapter sends website request once')
}

async function checkWeakQueryMatchIsNotABackupCapability13(t: TestContext): Promise<void> {
  const base = await createHealthyCustomRateContext12(t)

  assert.ok(
    base.outputRoutes.apply(base.unknownQuery).decision.reason !== 'player-fallback',
    'weak query match is not a backup capability',
  )
  await base.outputEvidence.record(TRUSTED_CATALOG[0], 'video', {
    requestId: 'fresh-challenger',
    at: base.now,
    source: 'transport',
    outcome: 'success',
    throughputMbps: 10,
    ttfbMs: 1,
    failureKind: null,
  })
  assert.ok(
    base.outputRoutes.challenge(
      base.outputRep,
      { kind: 'video', requiredMbps: 3, highDemand: false },
      false,
    )?.decision.host !== TRUSTED_CATALOG[1],
    'challenger never selects default unavailable cosov',
  )
  const beforeGeneration = base.outputSession.get()
  await base.outputRoutes.observe({
    ...base.healthyObservation,
    generation: beforeGeneration.generation,
    epoch: beforeGeneration.epoch,
    representation: base.outputRep,
    originalHost: base.forbiddenUrl,
    targetHost: TRUSTED_CATALOG[2],
    finalHost: TRUSTED_CATALOG[2],
    completedAt: base.now,
    decisionId: base.fallbackApplied.decision.id,
  })
  const savedSuccess = structuredClone(base.outputEvidence.get(TRUSTED_CATALOG[2], 'video'))
  assert.ok(savedSuccess)
  assert.ok(
    savedSuccess.samples.some(
      (sample) =>
        sample.requestId ===
          `${Number(beforeGeneration.generation)}:${Number(beforeGeneration.epoch)}:${base.now}:${TRUSTED_CATALOG[2]}` &&
        sample.outcome === 'success' &&
        sample.bytes === base.healthyObservation.bytes &&
        sample.throughputMbps === 8 &&
        sample.at === base.now,
    ),
    'the exact successful transfer was persisted before abort',
  )
  await base.outputRoutes.observe({
    ...base.healthyObservation,
    generation: beforeGeneration.generation,
    epoch: beforeGeneration.epoch,
    representation: base.outputRep,
    targetHost: TRUSTED_CATALOG[2],
    finalHost: null,
    outcome: 'abort',
    status: 0,
    completedAt: base.now + 1,
  })
  assert.deepEqual(
    base.outputEvidence.get(TRUSTED_CATALOG[2], 'video'),
    savedSuccess,
    'abort does not change the successfully committed health evidence',
  )
  await base.outputRoutes.observe({
    ...base.healthyObservation,
    generation: beforeGeneration.generation,
    epoch: beforeGeneration.epoch,
    representation: base.outputRep,
    targetHost: TRUSTED_CATALOG[3],
    finalHost: null,
    outcome: 'failure',
    failureKind: 'network',
    status: 0,
    completedAt: base.now + 2,
  })
  assert.ok(
    base.outputEvidence.get(TRUSTED_CATALOG[3], 'video')?.circuitUntil! > base.now,
    'no-response network failure still attributed to sent target',
  )
  await base.outputSettings.update({
    catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map((host) => [host, false])),
  })
  base.outputRoutes.invalidateForUserSetting()
  assert.strictEqual(
    base.outputRoutes.apply(base.forbiddenUrl).url,
    null,
    'no legal alternative blocks forbidden source',
  )
  const noOutput = {
    ...base.outputItem,
    base_url: base.forbiddenUrl,
    backup_url: [base.forbiddenUrl],
  }
  base.outputAdapter.transform({ data: { dash: { video: [noOutput], audio: [] } } })
  assert.strictEqual(noOutput.base_url, '', 'blocked playurl does not leak original primary')
  assert.strictEqual(noOutput.backup_url.length, 0, 'blocked playurl does not leak original backup')
  const gapRecovery = base.scope.own(
    new RecoveryController(currentResumePlayer(base.recoveryPlayer), () => base.coreClock),
  )
  gapRecovery.tick(base.healthyCustomRate)
  for (let i = 0; i < 5; i++) {
    base.coreClock += 10_000
    gapRecovery.tick(base.deadPaused)
  }
}

test('weak query match is not a backup capability [13]', { timeout: 5000 }, async (t) => {
  await checkWeakQueryMatchIsNotABackupCapability13(t)
})

test(
  'XHR does not send default-unavailable PCDN-marked media [15]',
  { timeout: 5000 },
  async (t) => {
    await checkXHRDoesNotSendDefaultUnavailablePCDNMarkedMedia15(t)
  },
)

test(
  'play observer installed on first paused tick, not thirty seconds later [16]',
  { timeout: 5000 },
  async (t) => {
    await checkPlayObserverInstalledOnFirstPausedTickNotThirtySecondsLater(t)
  },
)

test('eligible Native backup uses its own full signed URL [17]', { timeout: 5000 }, async (t) => {
  await checkEligibleNativeBackupUsesItsOwnFullSignedURL17(t)
})
