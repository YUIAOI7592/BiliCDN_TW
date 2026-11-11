import { createMutablePlaybackResources } from '../../support/player.ts'
import { CatalogSettingsStore } from '../../support/catalog-settings.ts'
import { currentResumePlayer } from '../../support/player.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { type TestContext } from 'node:test'
import { PlayurlController } from '../../../src-v2/application/playurl/playurl-controller.ts'
import { RestrictionStore } from '../../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../../src-v2/state/evidence-store.ts'
import { RouteCoordinator } from '../../../src-v2/application/routing/route-coordinator.ts'
import { RecoveryController } from '../../../src-v2/application/playback/recovery-controller.ts'
import { PlayurlAdapter } from '../../../src-v2/adapters/playurl/playurl.ts'
import { testScope } from '../../support/scope.ts'
import { createOpaqueControlSources, createOutputStores } from './adapters-resources.ts'

async function createOutputContext(t: TestContext) {
  const scope = testScope(t),
    now = 2_000_000_000_000,
    clock = { now: () => now }
  const { outputVault, outputState, outputStorage, outputSession } = createOutputStores()
  outputVault.reset(outputState.generation, outputState.epoch)
  const outputSettings = scope.own(new CatalogSettingsStore(outputStorage, () => now))
  await outputSettings.update({ considerNativeSources: true })
  const outputRestrictions = scope.own(new RestrictionStore(outputStorage, () => now)),
    outputEvidence = scope.own(new EvidenceStore(outputStorage, () => now))
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
  assert.equal(
    outputAdapter.transform({ data: { dash: { video: [outputItem], audio: [] } } }).accepted,
    true,
  )
  return { now, forbiddenUrl, outputAdapter, outputItem, outputRoutes, outputRestrictions }
}

async function checkPausedDeadCoreWithoutIntentNeverReloads8(t: TestContext): Promise<void> {
  const scope = testScope(t),
    resources = createMutablePlaybackResources()
  let now = 2_000_000_000_000,
    reloads = 0
  const observer = scope.own(
    new RecoveryController(
      currentResumePlayer({
        ...resources.recoveryPlayer,
        reload: () => {
          reloads++
        },
      }),
      () => now,
    ),
  )
  observer.tick(resources.playerSnapshot)
  const deadPaused = {
    ...resources.playerSnapshot,
    paused: true,
    readyState: 0,
    width: 0,
    height: 0,
    frames: 0,
    coreInitialized: false,
  }
  resources.playerSnapshot = deadPaused
  for (let tick = 0; tick < 5; tick++) {
    now += 1000
    observer.tick(deadPaused)
  }
  assert.equal(reloads, 0, 'paused dead core cannot reload without play intent')
  now += 31_000
  for (let tick = 0; tick < 100; tick++) {
    now += 1000
    observer.tick(deadPaused)
  }
  assert.equal(reloads, 0, 'long pause and repeated observations still grant no reload intent')
}

async function checkOpaqueSignedOutputRemainsObservationOnly7(t: TestContext): Promise<void> {
  const base = await createOutputContext(t)
  const { opaqueItem, opaquePrimary, opaqueBackup } = createOpaqueControlSources()
  base.outputAdapter.transform({ data: { dash: { video: [opaqueItem], audio: [] } } }, 'page-hint')
  const opaqueLineage = base.outputRoutes.apply(opaquePrimary)

  assert.strictEqual(
    opaqueLineage.attributionStatus,
    'weak',
    'opaque signed output remains observation-only',
  )
  assert.strictEqual(
    opaqueLineage.playurlOutput?.outputHost,
    new URL(opaquePrimary).host,
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
    ...opaqueItem,
    base_url: opaquePrimary,
    backup_url: [opaqueBackup],
  }
  base.outputAdapter.transform(
    { data: { dash: { video: [opaqueRestricted], audio: [] } } },
    'page-hint',
  )
  assert.strictEqual(
    opaqueRestricted.base_url,
    opaqueBackup,
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
  const base = await createOutputContext(t)
  const applied = base.outputRoutes.apply(base.outputItem.base_url),
    lineage = applied.playurlOutput
  assert.ok(lineage)
  assert.equal(lineage.originalHost, 'upos-sz-mirrorcosov.bilivideo.com')
  assert.equal(lineage.outputHost, new URL(base.outputItem.base_url).host)
  assert.equal(lineage.source, 'trusted-api')
  assert.equal(lineage.role, 'primary')
  assert.ok(lineage.decisionId)

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
