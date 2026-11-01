import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { isPlayurlApi } from '../src-v2/domain/catalog.ts'
import { isHttpDnsUrl } from '../src-v2/domain/url-policy.ts'
import {
  TRUSTED_CATALOG,
  DEFAULT_UNAVAILABLE_HOSTS,
  isCatalogHost,
} from '../src-v2/domain/catalog.ts'
import {
  catalogRestrictions,
  catalogCandidates,
  hardRestriction,
} from '../src-v2/domain/route-policy.ts'
import { backupOutputPlan, catalogOutputPlan } from '../src-v2/domain/player-output-plan.ts'
import { testScope } from './support/scope.ts'

async function checkExplicitUrlBases(t: TestContext): Promise<void> {
  testScope(t)
  assert.strictEqual(typeof location, 'undefined', 'domain suite has no browser location')
  assert.strictEqual(
    isPlayurlApi('https://api.bilibili.com/x/player/wbi/playurl'),
    true,
    'absolute playurl classification is independent of browser globals',
  )
  assert.strictEqual(
    isHttpDnsUrl('https://httpdns.bilivideo.com/resolve'),
    true,
    'absolute HTTPDNS classification is independent of browser globals',
  )
  assert.strictEqual(
    isPlayurlApi('/x/player/wbi/playurl', 'https://api.bilibili.com/'),
    true,
    'relative playurl uses explicit base',
  )
  assert.strictEqual(
    isPlayurlApi('/x/player/wbi/playurl', 'https://www.bilibili.com/'),
    false,
    'base host does not grant API authority',
  )
  assert.strictEqual(
    isHttpDnsUrl('/resolve', 'https://httpdns.bilivideo.com/'),
    true,
    'relative HTTPDNS uses explicit base',
  )
  assert.strictEqual(isHttpDnsUrl('/resolve'), false, 'relative URL without base is not admitted')
  const primary = TRUSTED_CATALOG[0]!
  TRUSTED_CATALOG[1]!
  const unavailable = [...DEFAULT_UNAVAILABLE_HOSTS][0]!
  const restrictions = catalogRestrictions({ [primary]: false, [unavailable]: true })
  assert.strictEqual(
    restrictions.disabledCatalogHosts.has(primary),
    true,
    'explicit Catalog disable enters the restriction snapshot',
  )
  assert.strictEqual(
    restrictions.defaultUnavailableHosts.has(unavailable),
    false,
    'explicit Catalog enable removes only the default restriction',
  )
  assert.strictEqual(
    catalogCandidates('audio', new Set([primary])).every(
      (row) => row.kind === 'audio' && row.host !== primary,
    ),
    true,
    'candidate construction preserves media kind and exclusions',
  )
}

async function checkRestrictionPrecedence(t: TestContext): Promise<void> {
  testScope(t)
  const primary = TRUSTED_CATALOG[0]!,
    next = TRUSTED_CATALOG[1]!
  const restrictionInput = {
    blackHosts: new Set([primary]),
    deadHosts: new Set([primary]),
    overrides: { [primary]: false },
    circuitUntil: 101,
  }
  assert.strictEqual(
    hardRestriction(primary, restrictionInput, 100),
    'black',
    'blacklist takes priority over other restrictions',
  )
  assert.strictEqual(
    hardRestriction(primary, { ...restrictionInput, blackHosts: new Set() }, 100),
    'dead',
    'dead restriction precedes Catalog settings',
  )
  assert.strictEqual(
    hardRestriction(
      primary,
      { ...restrictionInput, blackHosts: new Set(), deadHosts: new Set() },
      100,
    ),
    'catalog-disabled',
    'explicit Catalog restriction precedes circuit',
  )
  assert.strictEqual(
    hardRestriction(
      primary,
      { blackHosts: new Set(), deadHosts: new Set(), overrides: {}, circuitUntil: 100 },
      100,
    ),
    null,
    'expired circuit does not block a legal route',
  )
  const candidates = [
    { index: 0, host: primary, allowed: false },
    { index: 1, host: next, allowed: true },
    { index: 2, host: primary, allowed: true },
    { index: 3, host: next, allowed: true },
  ]
  assert.strictEqual(
    backupOutputPlan(primary, candidates, false).join(','),
    '1,2,3',
    'backup policy prioritizes distinct hosts before same-host entries',
  )
  assert.strictEqual(
    backupOutputPlan(primary, candidates, true).length,
    0,
    'host-locked stream has no generated backup candidates',
  )
}

async function checkCatalogBackupOrder(t: TestContext): Promise<void> {
  testScope(t)
  const primary = TRUSTED_CATALOG[0]!,
    next = TRUSTED_CATALOG[1]!
  const catalog = catalogOutputPlan(
    primary,
    ['not-catalog.example', next, next],
    new Set([primary]),
  )
  assert.strictEqual(catalog[0], next, 'Catalog backup preferences retain stable first occurrence')
  assert.strictEqual(
    catalog.length <= 5 && catalog.every((host) => host !== primary && isCatalogHost(host)),
    true,
    'Catalog output plan is bounded and only returns built-in hosts',
  )
}

test('domain suite has no browser location [1]', { timeout: 5000 }, async (t) => {
  await checkExplicitUrlBases(t)
})
test('blacklist takes priority over other restrictions [2]', { timeout: 5000 }, async (t) => {
  await checkRestrictionPrecedence(t)
})
test(
  'Catalog backup preferences retain stable first occurrence [3]',
  { timeout: 5000 },
  async (t) => {
    await checkCatalogBackupOrder(t)
  },
)
