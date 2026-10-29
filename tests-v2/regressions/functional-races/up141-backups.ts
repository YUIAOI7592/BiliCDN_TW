import { test } from 'node:test'
import assert from 'node:assert/strict'
import { testScope } from '../../support/scope.ts'
import {
  TRUSTED_CATALOG,
  DEFAULT_UNAVAILABLE_HOSTS,
  isCatalogHost,
} from '../../../src-v2/domain/catalog.ts'
import { catalogCandidates } from '../../../src-v2/domain/route-policy.ts'
import {
  backupOutputPlan,
  originalOutputPlan,
  catalogHostFamily,
} from '../../../src-v2/domain/player-output-plan.ts'
import {
  decisionId,
  type RouteDecision,
  type RouteRankingEntry,
} from '../../../src-v2/domain/model.ts'
import {
  catalogPlayerOutput,
  comparisonOutput,
} from '../../../src-v2/application/routing/player-output.ts'

const ali = 'upos-sz-mirroraliov.bilivideo.com'
const ali2 = 'upos-sz-mirrorali.bilivideo.com'
const alib = 'upos-sz-mirroralib.bilivideo.com'
const bos = 'upos-sz-mirrorbos.bilivideo.com'
const tx = 'upos-tf-all-tx.bilivideo.com'
const cos = 'upos-sz-mirrorcos.bilivideo.com'

function ranked(host: string, ratio: number | null, eligible = true): RouteRankingEntry {
  return {
    candidate: {
      type: 'catalog-generated',
      host,
      kind: 'video',
      catalogIndex: TRUSTED_CATALOG.indexOf(host as (typeof TRUSTED_CATALOG)[number]),
    },
    state: ratio === null ? 'unknown' : 'proven',
    eligible,
    reasons: eligible ? [] : ['black'],
    safeThroughputMbps: ratio === null ? null : ratio * 10,
    demandRatio: ratio,
    medianTtfbMs: ratio === null ? null : 50,
    successCount: ratio === null ? 0 : 2,
    failureCount: 0,
  }
}

function decision(rows: readonly RouteRankingEntry[]): RouteDecision {
  return {
    action: 'rewrite',
    id: decisionId('up141-backup'),
    reason: 'healthy-affinity',
    routeType: 'catalog-generated',
    host: ali,
    candidate: { type: 'catalog-generated', host: ali, kind: 'video', catalogIndex: 0 },
    ranking: rows,
  }
}

function output(rows: readonly RouteRankingEntry[], blocked = new Set<string>()) {
  const result = catalogPlayerOutput(
    'https://upos.example.akamaized.net/upgcxcode/fixture/video.m4s?token=private',
    decision(rows),
    (url) => !blocked.has(new URL(url).hostname),
    (_url, host) => blocked.has(host),
  )
  assert.ok(result)
  return result
}

test('UP141-ROUTE measured sufficient backups diversify families before same-family headroom', (t) => {
  testScope(t)
  const result = output([
    ranked(ali2, 3),
    ranked(alib, 2.5),
    ranked(cos, null),
    ranked(bos, 1.6),
    ranked(tx, 1.4),
  ])
  assert.deepEqual(
    result.backups.map((url) => new URL(url).hostname),
    [bos, tx, ali2, alib, cos],
  )
  assert.equal(new URL(result.primary).hostname, ali)
  for (const url of [result.primary, ...result.backups]) {
    assert.equal(new URL(url).pathname, '/upgcxcode/fixture/video.m4s')
    assert.equal(new URL(url).search, '?token=private')
  }
})

test('UP141-ROUTE unmeasured or insufficient diverse host cannot outrank sufficient same-family host', (t) => {
  testScope(t)
  const result = output([ranked(cos, null), ranked(bos, 1.349), ranked(ali2, 1.35)])
  assert.equal(new URL(result.backups[0]!).hostname, ali2)
  assert.equal(new URL(result.backups[1]!).hostname, cos)
})

test('UP141-ROUTE forbidden and incompatible rows never gain diversity admission', (t) => {
  testScope(t)
  const blocked = new Set([bos, tx])
  const result = output([ranked(bos, 4, false), ranked(tx, 3), ranked(ali2, 2)], blocked)
  assert.equal(new URL(result.backups[0]!).hostname, ali2)
  assert.ok(result.backups.every((url) => !blocked.has(new URL(url).hostname)))
  assert.ok(result.backups.length <= 5)
})

test('UP141-ROUTE normal backup plan preserves locks and distinct-host priority', (t) => {
  testScope(t)
  const candidates = [
    { index: 0, host: ali2, allowed: true, meetsHeadroom: true },
    { index: 1, host: alib, allowed: true, meetsHeadroom: true },
    { index: 2, host: bos, allowed: true, meetsHeadroom: true },
    { index: 3, host: tx, allowed: true, meetsHeadroom: true },
    { index: 4, host: 'unknown.example.invalid', allowed: true, meetsHeadroom: false },
    { index: 5, host: bos, allowed: true, meetsHeadroom: true },
    { index: 6, host: cos, allowed: false, meetsHeadroom: true },
  ]
  assert.deepEqual(backupOutputPlan(ali, candidates, false), [2, 3, 0, 1, 4])
  assert.deepEqual(backupOutputPlan(ali, candidates, true), [])
})

test('UP141-ROUTE unknown family gets no inferred diversity bonus', (t) => {
  testScope(t)
  const candidates = [
    { index: 0, host: ali2, allowed: true, meetsHeadroom: true },
    { index: 1, host: 'unknown.example.invalid', allowed: true, meetsHeadroom: true },
    { index: 2, host: bos, allowed: true, meetsHeadroom: true },
  ]
  assert.deepEqual(backupOutputPlan(ali, candidates, false), [2, 0, 1])
})

test('UP141-ROUTE family labels require exact built-in hosts and make no location claim', (t) => {
  testScope(t)
  assert.equal(catalogHostFamily(ali.toUpperCase()), 'ali')
  assert.equal(catalogHostFamily('cn-hk-eq-01-03.bilivideo.com'), null)
  assert.equal(catalogHostFamily('cn-hk-eq-01-05.bilivideo.com'), null)
  assert.equal(catalogHostFamily(`${ali}.evil.invalid`), null)
  assert.equal(catalogHostFamily('cn-hk-eq-01-99.bilivideo.com'), null)
  assert.equal(catalogHostFamily('__proto__'), null)
})

test('UP141-ROUTE invalid or success-free evidence cannot gain measured backup priority', (t) => {
  testScope(t)
  const result = output([
    { ...ranked(cos, 5), successCount: 0 },
    { ...ranked(bos, 5), demandRatio: Number.POSITIVE_INFINITY },
    { ...ranked(tx, 5), safeThroughputMbps: Number.NaN },
    ranked(ali2, 1.35),
  ])
  assert.equal(new URL(result.backups[0]!).hostname, ali2)
  assert.equal(new URL(result.backups[1]!).hostname, cos)
})

test('UP141-ROUTE original comparison retains exact input order and five backups', (t) => {
  testScope(t)
  const urls = [ali, ali2, alib, bos, tx, cos].map(
    (host, index) => `https://${host}/upgcxcode/a.m4s?key=${index}`,
  )
  assert.deepEqual(
    comparisonOutput(urls, () => true),
    {
      primary: urls[0],
      backups: urls.slice(1),
      permitted: urls,
    },
  )
  assert.deepEqual(
    originalOutputPlan(
      urls.map((url, index) => ({ index, host: new URL(url).hostname, allowed: true })),
    ),
    {
      primary: 0,
      backups: [1, 2, 3, 4, 5],
    },
  )
})

test('UP141-ROUTE unqualified HK candidates are not admitted to the formal eleven-host Catalog', (t) => {
  testScope(t)
  const hk = [
    'cn-hk-eq-01-03.bilivideo.com',
    'cn-hk-eq-01-05.bilivideo.com',
    'cn-hk-eq-01-01.bilivideo.com',
  ]
  for (const host of hk) {
    assert.equal(isCatalogHost(host), false)
    assert.equal(DEFAULT_UNAVAILABLE_HOSTS.has(host), false)
    assert.equal(
      catalogCandidates('video').some((candidate) => candidate.host === host),
      false,
    )
    assert.equal(catalogHostFamily(host), null)
  }
  assert.equal(TRUSTED_CATALOG.length, 11)
  assert.equal(DEFAULT_UNAVAILABLE_HOSTS.size, 4)
  for (const host of [
    'upos-sz-mirrorcosov.bilivideo.com',
    'upos-sz-mirrorhwov.bilivideo.com',
    'upos-sz-mirrorhw.bilivideo.com',
    'upos-hz-mirroraliov.bilivideo.com',
  ])
    assert.ok(DEFAULT_UNAVAILABLE_HOSTS.has(host))
})
