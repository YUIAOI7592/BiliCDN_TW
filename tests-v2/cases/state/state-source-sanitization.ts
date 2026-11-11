import { CatalogSettingsStore } from '../../support/catalog-settings.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { type TestContext } from 'node:test'
import { PlayurlController } from '../../../src-v2/application/playurl/playurl-controller.ts'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import { SignedRouteVault } from '../../../src-v2/state/signed-route-vault.ts'
import { RestrictionStore } from '../../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../../src-v2/state/evidence-store.ts'
import { SettingsStore } from '../../../src-v2/state/settings-store.ts'
import { SessionStore } from '../../../src-v2/state/session-store.ts'
import { RouteCoordinator } from '../../../src-v2/application/routing/route-coordinator.ts'
import { PlayurlAdapter } from '../../../src-v2/adapters/playurl/playurl.ts'
import { FakeStorage } from '../../support/storage.ts'
import { testScope } from '../../support/scope.ts'

async function createNativeOnPageHintInitiallyPreservesItsOriginalURL15Context13(t: TestContext) {
  const scope = testScope(t)
  const now = 2_000_000_000_000
  const clock = { now: () => now }
  const reuseStorage = new FakeStorage()
  const reuseSettings = scope.own(new SettingsStore(reuseStorage, () => now))
  const reuseSession = new SessionStore()
  const reuseState = reuseSession.beginGeneration(false)
  const reuseVault = new SignedRouteVault()
  reuseVault.reset(reuseState.generation, reuseState.epoch)
  const reuseRoutes = new RouteCoordinator(
    clock,
    reuseSession,
    reuseSettings,
    scope.own(new RestrictionStore(reuseStorage, () => now)),
    scope.own(new EvidenceStore(reuseStorage, () => now)),
    reuseVault,
    createRuntimeIds(),
  )
  const reusePlayurl = new PlayurlAdapter(
    new PlayurlController(reuseSession, reuseVault, reuseRoutes),
  )
  const reusedPageRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/reuse/page.m4s?signature=page'
  const reusedPagePayload = {
    data: {
      dash: {
        video: [
          {
            id: 80,
            codecid: 13,
            height: 1080,
            bandwidth: 1_000_000,
            base_url: reusedPageRoot,
            backup_url: [] as string[],
          },
        ],
        audio: [],
      },
    },
  }
  assert.equal(reuseSettings.get().considerNativeSources, true)
  assert.equal(reusePlayurl.transform(reusedPagePayload, 'page-hint').accepted, true)
  return {
    clock,
    now,
    reusePlayurl,
    reuseRoutes,
    reuseSettings,
    reusedPagePayload,
    reusedPageRoot,
    scope,
  }
}

async function checkNativeOnPageHintInitiallyPreservesItsOriginalURL15(
  t: TestContext,
): Promise<void> {
  const base = await createNativeOnPageHintInitiallyPreservesItsOriginalURL15Context13(t)

  assert.strictEqual(
    base.reusedPagePayload.data.dash.video[0]?.base_url,
    base.reusedPageRoot,
    'Native-on page hint initially preserves its original URL',
  )
  await base.reuseSettings.update({ considerNativeSources: false })
  base.reuseRoutes.invalidateForUserSetting()
  base.reusePlayurl.transform(base.reusedPagePayload, 'page-hint')
  assert.ok(
    TRUSTED_CATALOG.includes(
      new URL(base.reusedPagePayload.data.dash.video[0]?.base_url ?? '')
        .host as (typeof TRUSTED_CATALOG)[number],
    ),
    'same-generation seen page hint is reprocessed to Catalog after Native switch turns off',
  )
  await base.reuseSettings.update({ considerNativeSources: true })
  await base.reuseSettings.update({ considerNativeSources: false })
  base.reusedPagePayload.data.dash.video[0]!.base_url = base.reusedPageRoot
  base.reusePlayurl.transform(base.reusedPagePayload, 'page-hint')
  assert.ok(
    TRUSTED_CATALOG.includes(
      new URL(base.reusedPagePayload.data.dash.video[0]?.base_url ?? '')
        .host as (typeof TRUSTED_CATALOG)[number],
    ),
    'OFF-to-ON-to-OFF transition without intermediate transform cannot reuse unsafe page-hint cache',
  )
  const mutatedPageRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/reuse/page-mutated.m4s?signature=changed'
  base.reusedPagePayload.data.dash.video[0]!.base_url = mutatedPageRoot
  base.reusePlayurl.transform(base.reusedPagePayload, 'page-hint')
  assert.ok(
    TRUSTED_CATALOG.includes(
      new URL(base.reusedPagePayload.data.dash.video[0]?.base_url ?? '')
        .host as (typeof TRUSTED_CATALOG)[number],
    ),
    'mutated same-object page hint is re-sanitized while Native stays OFF',
  )
  assert.strictEqual(
    new URL(base.reusedPagePayload.data.dash.video[0]?.base_url ?? '').search,
    new URL(mutatedPageRoot).search,
    'same-object page hint mutation preserves its newly requested query during Catalog rewrite',
  )
  await base.reuseSettings.update({ considerNativeSources: true })
  base.reuseRoutes.invalidateForUserSetting()
  const reusedApiRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/reuse/api.m4s?signature=api'
  const reusedApiPayload = {
    data: {
      dash: {
        video: [
          {
            id: 64,
            codecid: 13,
            height: 720,
            bandwidth: 1_000_000,
            base_url: reusedApiRoot,
            backup_url: [] as string[],
          },
        ],
        audio: [],
      },
    },
  }
  base.reusePlayurl.transform(reusedApiPayload, 'trusted-api', 'reuse-api-response')
  assert.strictEqual(
    reusedApiPayload.data.dash.video[0]?.base_url,
    reusedApiRoot,
    'Native-on trusted response initially preserves its original URL',
  )
  await base.reuseSettings.update({ considerNativeSources: false })
  base.reuseRoutes.invalidateForUserSetting()
  base.reusePlayurl.transform(reusedApiPayload, 'trusted-api', 'reuse-api-response')
  assert.ok(
    TRUSTED_CATALOG.includes(
      new URL(reusedApiPayload.data.dash.video[0]?.base_url ?? '')
        .host as (typeof TRUSTED_CATALOG)[number],
    ),
    'same-generation response key is reprocessed to Catalog after Native switch turns off',
  )
  await base.reuseSettings.update({ considerNativeSources: true })
  await base.reuseSettings.update({ considerNativeSources: false })
  reusedApiPayload.data.dash.video[0]!.base_url = reusedApiRoot
  base.reusePlayurl.transform(reusedApiPayload, 'trusted-api', 'reuse-api-response')
  assert.ok(
    TRUSTED_CATALOG.includes(
      new URL(reusedApiPayload.data.dash.video[0]?.base_url ?? '')
        .host as (typeof TRUSTED_CATALOG)[number],
    ),
    'OFF-to-ON-to-OFF transition without intermediate transform cannot reuse unsafe responseKey cache',
  )
  const mutatedApiRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/reuse/api-mutated.m4s?signature=changed-api'
  reusedApiPayload.data.dash.video[0]!.base_url = mutatedApiRoot
  base.reusePlayurl.transform(reusedApiPayload, 'trusted-api', 'reuse-api-response')

  assert.ok(
    TRUSTED_CATALOG.includes(
      new URL(reusedApiPayload.data.dash.video[0]?.base_url ?? '')
        .host as (typeof TRUSTED_CATALOG)[number],
    ),
    'mutated same-object trusted payload is re-sanitized despite an already-seen responseKey',
  )
}

async function checkOldPayloadCannotInheritLaterEpoch(t: TestContext): Promise<void> {
  const scope = testScope(t),
    now = 2_000_000_000_000,
    clock = { now: () => now }
  const epochReuseStorage = new FakeStorage(),
    epochReuseSettings = scope.own(new CatalogSettingsStore(epochReuseStorage, () => now))
  const epochReuseSession = new SessionStore(),
    epochReuseState = epochReuseSession.beginGeneration(false)
  const epochReuseVault = new SignedRouteVault()
  epochReuseVault.reset(epochReuseState.generation, epochReuseState.epoch)
  const epochReuseRoutes = new RouteCoordinator(
    clock,
    epochReuseSession,
    epochReuseSettings,
    scope.own(new RestrictionStore(epochReuseStorage, () => now)),
    scope.own(new EvidenceStore(epochReuseStorage, () => now)),
    epochReuseVault,
    createRuntimeIds(),
  )
  const epochReuseAdapter = new PlayurlAdapter(
    new PlayurlController(epochReuseSession, epochReuseVault, epochReuseRoutes),
  )
  const oldEpochRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/epoch-reuse/old/video.m4s?signature=old-epoch'
  const newEpochRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/epoch-reuse/new/video.m4s?signature=new-epoch'
  const oldEpochPayload = {
    data: {
      dash: {
        video: [
          {
            id: 80,
            codecid: 13,
            height: 1080,
            bandwidth: 1_000_000,
            base_url: oldEpochRoot,
            backup_url: [] as string[],
          },
        ],
        audio: [],
      },
    },
  }
  assert.ok(
    epochReuseAdapter.transform(oldEpochPayload, 'trusted-api').accepted,
    'old trusted payload registers a representation',
  )
  const oldEpochRep = epochReuseVault.match(oldEpochRoot).context?.representation
  assert.ok(oldEpochRep, 'old trusted payload has a vault identity before epoch reset')
  const nextEpochState = epochReuseSession.beginEpoch()
  epochReuseVault.reset(nextEpochState.generation, nextEpochState.epoch)
  epochReuseRoutes.resetEpoch()
  const newEpochRep = epochReuseVault.register({
    generation: nextEpochState.generation,
    epoch: nextEpochState.epoch,
    kind: 'video',
    key: 'new-epoch',
    height: 1080,
    codec: 'av1',
    bandwidth: 1_000_000,
    urls: [newEpochRoot],
    source: 'trusted-api',
  })
  assert.strictEqual(
    newEpochRep,
    oldEpochRep,
    'vault representation IDs are reused in a later epoch',
  )
  epochReuseAdapter.transform(oldEpochPayload, 'trusted-api')
  const oldEpochOutput = oldEpochPayload.data.dash.video[0]?.base_url ?? ''
  assert.ok(
    !oldEpochOutput.includes('new-epoch') &&
      (oldEpochOutput === '' ||
        (TRUSTED_CATALOG.includes(
          new URL(oldEpochOutput).host as (typeof TRUSTED_CATALOG)[number],
        ) &&
          new URL(oldEpochOutput).pathname === new URL(oldEpochRoot).pathname)),
    'reused old trusted payload cannot inherit a new epoch representation root',
  )
}

test(
  'Native settings changes and same-object mutations re-sanitize cached playurl [15]',
  { timeout: 5000 },
  async (t) => {
    await checkNativeOnPageHintInitiallyPreservesItsOriginalURL15(t)
  },
)

test(
  'reused old trusted payload cannot inherit a later epoch identity [16]',
  { timeout: 5000 },
  async (t) => {
    await checkOldPayloadCannotInheritLaterEpoch(t)
  },
)
