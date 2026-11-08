import { createMutablePlaybackResources } from '../../support/player.ts'
import { CatalogSettingsStore } from '../../support/catalog-settings.ts'
import { currentResumePlayer } from '../../support/player.ts'
import { installProgressEvent } from '../../support/progress-event.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { type TestContext } from 'node:test'
import { PlayurlController } from '../../../src-v2/application/playurl/playurl-controller.ts'
import { RestrictionStore } from '../../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../../src-v2/state/evidence-store.ts'
import { RouteCoordinator } from '../../../src-v2/application/routing/route-coordinator.ts'
import { type AppliedRouteDecision } from '../../../src-v2/application/routing/route-contracts.ts'
import { RecoveryController } from '../../../src-v2/application/playback/recovery-controller.ts'
import { PlayurlAdapter } from '../../../src-v2/adapters/playurl/playurl.ts'
import { testScope } from '../../support/scope.ts'
import { createOpaqueControlSources, createOutputStores } from './adapters-resources.ts'

async function createHealthyObservationContext6(t: TestContext) {
  const scope = testScope(t)
  installProgressEvent(scope)
  const now = 2_000_000_000_000
  const clock = { now: () => now }
  const block7 = createOutputStores()
  const { outputVault, outputState, outputStorage, outputSession } = block7
  outputVault.reset(outputState.generation, outputState.epoch)
  const outputSettings = scope.own(new CatalogSettingsStore(outputStorage, () => now))
  await outputSettings.update({ considerNativeSources: true })
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
  return {
    forbiddenUrl,
    outputAdapter,
    outputItem,
    outputRoutes,
  }
}

async function createExceptionalForbiddenContext7(t: TestContext) {
  const scope = testScope(t)
  installProgressEvent(scope)
  const now = 2_000_000_000_000
  const clock = { now: () => now }
  const block7 = createOutputStores()
  const { outputVault, outputState, outputStorage, outputSession } = block7
  outputVault.reset(outputState.generation, outputState.epoch)
  const outputSettings = scope.own(new CatalogSettingsStore(outputStorage, () => now))
  await outputSettings.update({ considerNativeSources: true })
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
  const opaqueLineage = outputRoutes.apply(opaquePrimary)
  return {
    now,
    opaqueBackup,
    opaqueItem,
    opaqueLineage,
    opaquePrimary,
    outputAdapter,
    outputItem,
    outputRestrictions,
    outputRoutes,
  }
}

async function createPausedDeadCoreWithoutIntentNeverReloads8Context8(t: TestContext) {
  const scope = testScope(t)
  installProgressEvent(scope)
  const now = 2_000_000_000_000
  const clock = { now: () => now }
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
  void outputItem.backup_url.find((url) => new URL(url).host !== new URL(outputItem.base_url).host)
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
  const deadPaused = {
    ...block3.playerSnapshot,
    paused: true,
    readyState: 0,
    width: 0,
    height: 0,
    frames: 0,
    coreInitialized: false,
  }
  coreObserver.tick({
    ...block3.playerSnapshot,
    paused: false,
    readyState: 4,
    width: 1920,
    height: 1080,
  })
  for (let tick = 0; tick < 5; tick++) {
    coreClock += 1000
    coreObserver.tick(deadPaused)
  }
  return {
    get coreClock() {
      return coreClock
    },
    set coreClock(value: typeof coreClock) {
      coreClock = value
    },
    coreObserver,
    get coreReloads() {
      return coreReloads
    },
    set coreReloads(value: typeof coreReloads) {
      coreReloads = value
    },
    deadPaused,
    outputItem,
    outputRoutes,
    outputVault,
  }
}

async function checkPausedDeadCoreWithoutIntentNeverReloads8(t: TestContext): Promise<void> {
  const base = await createPausedDeadCoreWithoutIntentNeverReloads8Context8(t)
  assert.strictEqual(base.coreReloads, 0, 'dead paused core without play intent never reloads')
  base.coreClock += 31_000
  for (let tick = 0; tick < 100; tick++) {
    base.coreClock += 1000
    base.coreObserver.tick(base.deadPaused)
  }
  base.outputVault.contextForUrl(base.outputItem.base_url)!.representation
  const playurlLineage = (
    base.outputRoutes.apply(base.outputItem.base_url) as AppliedRouteDecision & {
      playurlOutput?: {
        originalHost: string
        outputHost: string
        source: string
        decisionId: string
        role: string
      }
    }
  ).playurlOutput
  assert.strictEqual(
    playurlLineage?.originalHost,
    'upos-sz-mirrorcosov.bilivideo.com',
    'playurl lineage retains the original host without retaining a signed URL',
  )
  assert.strictEqual(
    playurlLineage?.outputHost,
    new URL(base.outputItem.base_url).host,
    'playurl lineage names the host actually offered to the player',
  )
  assert.strictEqual(
    playurlLineage?.source,
    'trusted-api',
    'playurl lineage identifies trusted API output separately from page hints',
  )
  assert.ok(
    !!playurlLineage?.decisionId && playurlLineage.role === 'primary',
    'playurl output links its plan to a primary request',
  )
}

async function checkOpaqueSignedOutputRemainsObservationOnly7(t: TestContext): Promise<void> {
  const base = await createExceptionalForbiddenContext7(t)

  assert.strictEqual(
    base.opaqueLineage.attributionStatus,
    'weak',
    'opaque signed output remains observation-only',
  )
  assert.strictEqual(
    base.opaqueLineage.playurlOutput?.outputHost,
    new URL(base.opaquePrimary).host,
    'an exact opaque output still links playurl delivery to the later segment request by host',
  )
  await base.outputRestrictions.add({
    host: 'upos-hz-mirrorakam.akamaized.net',
    type: 'black',
    kind: 'all',
    reason: 'opaque-output',
    expireAt: base.now + 60_000,
  })
  const opaqueRestricted = {
    ...base.opaqueItem,
    base_url: base.opaquePrimary,
    backup_url: [base.opaqueBackup],
  }
  base.outputAdapter.transform(
    { data: { dash: { video: [opaqueRestricted], audio: [] } } },
    'page-hint',
  )
  assert.strictEqual(
    opaqueRestricted.base_url,
    base.opaqueBackup,
    'opaque signed fallback uses its own exact URL when source is forbidden',
  )
  await base.outputRestrictions.remove('upos-hz-mirrorakam.akamaized.net', 'black')
  const mixedItem = {
    id: 82,
    codecid: 13,
    height: 1080,
    bandwidth: 1_000_000,
    base_url:
      'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/test/mixed/82.m4s?signature=private',
    backup_url: ['https://upos-hz-mirrorakam.akamaized.net/opaque/mixed-82?signature=private'],
  }
  base.outputAdapter.transform({ data: { dash: { video: [mixedItem], audio: [] } } }, 'page-hint')
  assert.ok(
    mixedItem.backup_url.includes(
      'https://upos-hz-mirrorakam.akamaized.net/opaque/mixed-82?signature=private',
    ),
    'normal primary retains a legal exact opaque signed backup',
  )
  const alternateOutput = base.outputItem.backup_url.find(
    (url) => new URL(url).host !== new URL(base.outputItem.base_url).host,
  )
  assert.ok(alternateOutput, 'playurl includes a legal alternate backup')
  const fallbackApplied = base.outputRoutes.apply(alternateOutput ?? '')
  assert.strictEqual(
    fallbackApplied.url,
    alternateOutput,
    'player requested output backup is not pulled back to primary',
  )
  assert.strictEqual(
    fallbackApplied.decision.reason,
    'player-fallback',
    'player backup has explicit coordinated decision',
  )
  assert.strictEqual(
    base.outputRoutes.apply(base.outputItem.base_url).url,
    alternateOutput,
    'subsequent group requests retain adopted backup',
  )
}

async function checkForbiddenOriginalCannotRemainInPlayurlPrimaryOrBackup6(
  t: TestContext,
): Promise<void> {
  const base = await createHealthyObservationContext6(t)

  assert.ok(
    ![base.outputItem.base_url, ...base.outputItem.backup_url].some((url) =>
      url.includes('mirrorcosov'),
    ),
    'forbidden original cannot remain in playurl primary or backup',
  )
  const exceptionalForbidden = `${base.forbiddenUrl}&os=mcdn`
  assert.strictEqual(
    base.outputRoutes.apply(exceptionalForbidden).url,
    null,
    'default-unavailable source cannot pass through PCDN guard',
  )
  assert.strictEqual(
    base.outputRoutes.apply(base.forbiddenUrl.replace('/upgcxcode/', '/live-bvc/')).url,
    null,
    'default-unavailable live source is locally blocked without host replacement',
  )
  assert.strictEqual(
    base.outputRoutes.apply(base.forbiddenUrl.replace('/upgcxcode/', '/v1/resource/')).url,
    null,
    'default-unavailable resource source is locally blocked',
  )
  assert.strictEqual(
    base.outputRoutes.apply(
      'https://upos-sz-mirrorali.bilivideo.com/live-bvc/test/output/1.m4s?k=1',
    ).decision.action,
    'pass',
    'unrestricted live source remains untouched',
  )
  const exceptionalItem = {
    ...base.outputItem,
    id: 180,
    base_url: exceptionalForbidden,
    backup_url: [exceptionalForbidden],
  }
  base.outputAdapter.transform({ data: { dash: { video: [exceptionalItem], audio: [] } } })
  assert.strictEqual(
    exceptionalItem.base_url,
    '',
    'playurl cannot emit a default-unavailable PCDN-marked primary',
  )
  assert.strictEqual(
    exceptionalItem.backup_url.length,
    0,
    'playurl cannot emit a default-unavailable PCDN-marked backup',
  )
  const opaquePrimary =
    'https://upos-hz-mirrorakam.akamaized.net/opaque/video-chunk?signature=private'
  const opaqueBackup =
    'https://upos-sz-mirrorali.bilivideo.com/opaque/video-chunk?signature=private'
  const opaqueItem = {
    id: 81,
    codecid: 13,
    height: 1080,
    bandwidth: 1_000_000,
    base_url: opaquePrimary,
    backup_url: [opaqueBackup],
  }
  base.outputAdapter.transform({ data: { dash: { video: [opaqueItem], audio: [] } } }, 'page-hint')
  assert.strictEqual(
    opaqueItem.base_url,
    opaquePrimary,
    'legal opaque signed primary is not emptied by playurl assembly',
  )
}

test(
  'forbidden original cannot remain in playurl primary or backup [6]',
  { timeout: 5000 },
  async (t) => {
    await checkForbiddenOriginalCannotRemainInPlayurlPrimaryOrBackup6(t)
  },
)

test('opaque signed output remains observation-only [7]', { timeout: 5000 }, async (t) => {
  await checkOpaqueSignedOutputRemainsObservationOnly7(t)
})

test('paused dead core without intent never reloads [8]', { timeout: 5000 }, async (t) => {
  await checkPausedDeadCoreWithoutIntentNeverReloads8(t)
})
