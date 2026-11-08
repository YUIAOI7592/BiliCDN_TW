import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chooseRoute, rankRoutes, type RankRoutesInput } from '../../src-v2/domain/routing.ts'
import { emptyEvidence } from '../../src-v2/domain/evidence.ts'
import { decisionId } from '../../src-v2/domain/model.ts'
import { type RouteCandidate } from '../../src-v2/domain/route-model.ts'
import { type RouteEvidence } from '../../src-v2/domain/evidence-model.ts'

const now = 2_000_000_000_000,
  clock = { now: () => now }
const catalog: RouteCandidate = {
  type: 'catalog-generated',
  kind: 'video',
  host: 'catalog.example',
  catalogIndex: 0,
}
const original: RouteCandidate = {
  type: 'root-original',
  kind: 'video',
  host: 'original.example',
  catalogIndex: 1,
  route: null,
  handle: null,
}
function input(
  a: number,
  b: number,
  options: Partial<RankRoutesInput> = {},
  age = 0,
): RankRoutesInput {
  const rows = new Map<string, RouteEvidence>(
    [
      [original.host, a],
      [catalog.host, b],
    ].map(([host, value]) => [
      String(host),
      {
        ...emptyEvidence(String(host), 'video'),
        samples: [0, 1].map((i) => ({
          requestId: String(i),
          at: now - age,
          source: 'transport' as const,
          outcome: 'success' as const,
          throughputMbps: Number(value),
          ttfbMs: 50,
          failureKind: null,
        })),
        updatedAt: now,
      },
    ]),
  )
  return {
    candidates: [catalog, original],
    evidenceFor: (host) => rows.get(host) ?? null,
    restrictions: {
      disabledCatalogHosts: new Set(),
      defaultUnavailableHosts: new Set(),
      blackHosts: new Set(),
      deadHosts: new Set(),
      hostLocked: new Set(),
    },
    demand: { kind: 'video', requiredMbps: 10, highDemand: false },
    fixedHost: null,
    current: null,
    boundary: 'startup',
    failedHost: null,
    ...options,
  }
}
test('V227 routing: a faster equally qualified original wins without a source-type downgrade', () => {
  const facts = input(30, 20),
    ranked = rankRoutes(facts, now),
    result = chooseRoute(facts, clock, decisionId('equal-source'))
  assert.equal(ranked[0]?.candidate.host, original.host)
  assert.equal(result.host, original.host)
  assert.equal(result.action, 'pass')
})
test('V227 routing: sufficient fresh capacity precedes faster one-sample provisional capacity', () => {
  const facts = input(15, 100),
    base = facts.evidenceFor(catalog.host, 'video')!
  const f = {
    ...facts,
    evidenceFor: (host: string) =>
      host === catalog.host
        ? { ...base, samples: base.samples.slice(0, 1) }
        : facts.evidenceFor(host, 'video'),
  }
  assert.equal(rankRoutes(f, now)[0]?.candidate.host, original.host)
  assert.equal(chooseRoute(f, clock, decisionId('confidence')).host, original.host)
})
test('V227 routing: a 1.2 ratio is adequate and retains the healthy current host', () => {
  const f = input(12, 20, {
    current: { type: 'root-original', host: original.host },
    boundary: 'request',
  })
  assert.equal(chooseRoute(f, clock, decisionId('one-margin')).host, original.host)
})
test('V227 routing: insufficient current capacity stays when no recent adequate replacement exists', () => {
  const f = input(5, 8, {
    current: { type: 'root-original', host: original.host },
    boundary: 'request',
  })
  assert.equal(chooseRoute(f, clock, decisionId('no-adequate')).host, original.host)
})
test('V227 routing: aging evidence alone does not displace the current host', () => {
  const f = input(
    5,
    80,
    { current: { type: 'root-original', host: original.host }, boundary: 'request' },
    300_001,
  )
  assert.equal(chooseRoute(f, clock, decisionId('aged-current')).host, original.host)
})
test('V227 routing: fresh inadequacy yields to a fresh adequate alternative', () => {
  const f = input(5, 20, {
    current: { type: 'root-original', host: original.host },
    boundary: 'request',
  })
  assert.equal(chooseRoute(f, clock, decisionId('needs-capacity')).host, catalog.host)
})
test('V227 routing: provisional inadequacy reselects only when a recent adequate alternative exists', () => {
  const f = input(10.5, 20, {
      current: { type: 'root-original', host: original.host },
      boundary: 'request',
    }),
    originalReader = f.evidenceFor
  const provisional = {
    ...f,
    evidenceFor: (host: string) => {
      const row = originalReader(host, 'video')
      return host === original.host && row ? { ...row, samples: row.samples.slice(0, 1) } : row
    },
  }
  assert.equal(
    chooseRoute(provisional, clock, decisionId('provisional-stability')).host,
    catalog.host,
  )
  assert.equal(
    chooseRoute(
      {
        ...provisional,
        restrictions: { ...provisional.restrictions, blackHosts: new Set([catalog.host]) },
      },
      clock,
      decisionId('no-alternative'),
    ).host,
    original.host,
  )
})
test('V227 routing: legal fixed selection precedes fresh evidence and all restrictions still win', () => {
  const f = input(5, 20, {
    fixedHost: original.host,
    current: { type: 'catalog-generated', host: catalog.host },
    boundary: 'request',
  })
  assert.equal(chooseRoute(f, clock, decisionId('fixed')).host, original.host)
  const blocked = {
    ...f,
    restrictions: { ...f.restrictions, blackHosts: new Set([original.host]) },
  }
  assert.equal(chooseRoute(blocked, clock, decisionId('blocked-fixed')).host, catalog.host)
})
