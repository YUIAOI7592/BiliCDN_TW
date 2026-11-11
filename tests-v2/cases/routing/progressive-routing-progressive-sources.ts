import { test } from 'node:test'
import assert from 'node:assert/strict'
import { type TestContext } from 'node:test'
import { TRUSTED_CATALOG, DEFAULT_UNAVAILABLE_HOSTS } from '../../../src-v2/domain/catalog.ts'
import {
  createProgressiveSourceUrls,
  createRoutingResources,
} from './progressive-routing-resources.ts'

async function createProgressiveRoutingResources(t: TestContext) {
  const resources = await createRoutingResources(t)
  const { vault, state, routes, settings } = resources

  const demand = { kind: 'video' as const, requiredMbps: 4, highDemand: false }
  const block1 = createProgressiveSourceUrls()
  const { opaque, segment1, segment2 } = block1
  const rep1 = vault.register({
    generation: state.generation,
    epoch: state.epoch,
    kind: 'video',
    key: 'durl:q80:0',
    height: 0,
    codec: 'mp4',
    bandwidth: 0,
    urls: [opaque, segment1],
    source: 'trusted-api',
  })
  const rep2 = vault.register({
    generation: state.generation,
    epoch: state.epoch,
    kind: 'video',
    key: 'durl:q80:1',
    height: 0,
    codec: 'flv',
    bandwidth: 0,
    urls: [segment2],
    source: 'trusted-api',
  })
  return {
    demand,
    opaque,
    rep1,
    rep2,
    routes,
    segment1,
    segment2,
    settings,
    vault,
  }
}

async function createResourcePrimaryIsReplacedUsingItsExactLegalBackupSource4Context3(
  t: TestContext,
) {
  const resources = await createRoutingResources(t)
  const { vault, state, routes } = resources

  const demand = { kind: 'video' as const, requiredMbps: 4, highDemand: false }
  const resource =
    'https://upos-hz-mirrorakam.akamaized.net/v1/resource/progressive-segment?token=resource'
  const resourceBackup =
    'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/progressive/resource-backup.mp4?token=valid'
  const resourceRep = vault.register({
    generation: state.generation,
    epoch: state.epoch,
    kind: 'video',
    key: 'durl:q64:0',
    height: 0,
    codec: 'mp4',
    bandwidth: 0,
    urls: [resource, resourceBackup],
    source: 'trusted-api',
  })
  return {
    demand,
    resource,
    resourceBackup,
    resourceRep,
    routes,
  }
}

async function checkResourcePrimaryIsReplacedUsingItsExactLegalBackupSource4(
  t: TestContext,
): Promise<void> {
  const base = await createResourcePrimaryIsReplacedUsingItsExactLegalBackupSource4Context3(t)

  assert.ok(base.resourceRep, 'behavior requires its fixture prerequisites')
  {
    const resourcePlan = base.routes.plan(base.resourceRep, base.demand, 'startup')
    const resourceOutput = base.routes.playerOutput(base.resourceRep, base.resource, resourcePlan, [
      base.resource,
      base.resourceBackup,
    ])
    assert.ok(
      resourceOutput.primary &&
        new URL(resourceOutput.primary).pathname + new URL(resourceOutput.primary).search ===
          new URL(base.resourceBackup).pathname + new URL(base.resourceBackup).search,
      'resource primary is replaced using its exact legal backup source',
    )
    assert.strictEqual(
      resourceOutput.backups.length,
      5,
      'legal resource source retains five Catalog backups',
    )
    assert.ok(
      resourceOutput.backups.every(
        (url) =>
          new URL(url).pathname + new URL(url).search ===
          new URL(base.resourceBackup).pathname + new URL(base.resourceBackup).search,
      ),
      'every Catalog fallback retains the promoted backup path and query',
    )
    assert.strictEqual(
      base.routes.apply(base.resource).decision.reason,
      'catalog-unreplaceable',
      'an old resource URL remains blocked at request dispatch despite same-segment source promotion',
    )
  }
}

async function checkCatalogSourceResolvesTheFirstLegalSameSegmentBackupWhenThe(
  t: TestContext,
): Promise<void> {
  const base = await createProgressiveRoutingResources(t)

  assert.ok(base.rep1 && base.rep2, 'behavior requires its fixture prerequisites')
  {
    const handle = base.vault.catalogSourceHandle(base.rep1)
    assert.strictEqual(
      handle && base.vault.resolve(handle, base.vault.identity(base.rep1)!),
      base.segment1,
      'Catalog source resolves the first legal same-segment backup when the declared root is opaque',
    )
    assert.strictEqual(
      base.vault.rootUrl(base.rep1),
      base.opaque,
      'canonical Catalog promotion does not change the original route order',
    )
    assert.strictEqual(
      base.vault.sourceURLs(base.rep1).join('|'),
      [base.opaque, base.segment1].join('|'),
      'Vault exposes only exact current-group originals in source order for Native pruning',
    )

    const planned = base.routes.plan(base.rep1, base.demand, 'startup')
    assert.strictEqual(
      planned.routeType,
      'catalog-generated',
      'opaque root with a legal backup can plan Catalog',
    )
    assert.strictEqual(
      planned.ranking.length,
      TRUSTED_CATALOG.length,
      'ranking considers the complete built-in Catalog',
    )
    assert.strictEqual(
      planned.ranking.filter((row) => row.eligible).length,
      TRUSTED_CATALOG.length - DEFAULT_UNAVAILABLE_HOSTS.size,
      'default-unavailable hosts remain excluded until enabled',
    )
    const playerUrls = base.routes.playerOutput(base.rep1, base.opaque, planned, [
      base.opaque,
      base.segment1,
    ])
    assert.ok(
      playerUrls.primary &&
        new URL(playerUrls.primary).pathname === new URL(base.segment1).pathname,
      'Catalog-only player output promotes the legal backup instead of exposing an opaque primary',
    )
    assert.strictEqual(
      playerUrls.backups.length,
      5,
      'Catalog-only player output keeps five legal distinct Catalog backups',
    )
    assert.strictEqual(
      new Set([playerUrls.primary, ...playerUrls.backups].map((url) => new URL(url).hostname)).size,
      6,
      'Catalog-only player output backup hosts are distinct',
    )
    const applied = base.routes.apply(base.segment1)
    assert.strictEqual(
      applied.decision.routeType,
      'catalog-generated',
      'request for the legal backup uses Catalog',
    )
    assert.ok(applied.url, 'request for the legal backup has a materialized destination')
    if (applied.url)
      assert.strictEqual(
        new URL(applied.url).pathname + new URL(applied.url).search,
        new URL(base.segment1).pathname + new URL(base.segment1).search,
        'Catalog rewrite retains the promoted segment path and query',
      )

    const startup = base.routes.startupOptions(base.opaque)
    assert.ok(
      startup?.candidates.length === 3,
      'opaque original uses its canonical backup for bounded Catalog preflight',
    )
    assert.ok(
      startup?.candidates.every(
        (candidate) =>
          candidate.type === 'catalog-generated' &&
          new URL(candidate.url).pathname === new URL(base.segment1).pathname,
      ),
      'all startup probes use the promoted segment path',
    )
    const challenge = base.routes.challenge(base.rep1, base.demand, false)
    assert.ok(
      challenge?.url && new URL(challenge.url).pathname === new URL(base.segment1).pathname,
      'healthy Catalog challenge uses the promoted segment source',
    )

    const first = startup?.candidates[0]
    if (first) {
      base.routes.noteStartupProbeResult(first, 403)
      assert.ok(
        !base.routes
          .startupOptions(base.opaque)
          ?.candidates.some((candidate) => candidate.host === first.host),
        'Catalog 403 excludes the tested stream-host pair',
      )
      assert.ok(
        base.routes
          .startupOptions(base.segment2)
          ?.candidates.some((candidate) => candidate.host === first.host),
        'a Catalog 403 for one progressive segment does not exclude another segment',
      )
    }
    for (const candidate of startup?.candidates.slice(1) ?? [])
      base.routes.noteStartupProbeResult(candidate, 403)
    const afterThree = base.routes.apply(base.segment1)
    assert.ok(
      afterThree.url &&
        !startup?.candidates.some((candidate) => candidate.host === afterThree.decision.host),
      'dispatch can select a still-legal fourth Catalog after all three bounded probes return 403',
    )
    const afterThreeOutput = base.routes.playerOutput(base.rep1, base.opaque, afterThree.decision, [
      base.opaque,
      base.segment1,
    ])
    assert.ok(
      afterThreeOutput.primary &&
        !startup?.candidates.some(
          (candidate) => candidate.host === new URL(afterThreeOutput.primary).hostname,
        ),
      'Catalog player primary excludes all three tested 403 stream-host pairs',
    )
    assert.ok(
      afterThreeOutput.backups.every(
        (url) => !startup?.candidates.some((candidate) => candidate.host === new URL(url).hostname),
      ),
      'Catalog player backups exclude all three tested 403 stream-host pairs',
    )
    const rescue = base.routes.recoverStartup(
      base.rep1,
      base.demand,
      startup!.candidates[0]!.host,
      [],
    )
    assert.ok(
      rescue?.host && !startup?.candidates.some((candidate) => candidate.host === rescue.host),
      'bounded startup recovery can use a new legal candidate from the promoted source',
    )

    const lateChoice = base.routes.startupOptions(base.segment2)?.candidates[0] ?? null
    assert.ok(lateChoice, 'a second segment has a legal pending startup candidate')
    const fixedHost = TRUSTED_CATALOG[5]
    await base.settings.update({ fixedHost })
    base.routes.invalidateForUserSetting()
    assert.strictEqual(
      base.routes.commitStartupChoice(base.segment2, lateChoice, 'late-preflight'),
      null,
      'a pending startup candidate cannot override a newly selected fixed Catalog host',
    )
    assert.strictEqual(
      base.routes.apply(base.segment2).decision.host,
      fixedHost,
      'the current fixed Catalog host wins at final request dispatch',
    )
  }
}

test(
  'Catalog source resolves the first legal same-segment backup when the declared root is opaque [2]',
  { timeout: 5000 },
  async (t) => {
    await checkCatalogSourceResolvesTheFirstLegalSameSegmentBackupWhenThe(t)
  },
)

test(
  'resource primary is replaced using its exact legal backup source [4]',
  { timeout: 5000 },
  async (t) => {
    await checkResourcePrimaryIsReplacedUsingItsExactLegalBackupSource4(t)
  },
)
