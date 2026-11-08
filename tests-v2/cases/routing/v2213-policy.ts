import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rankRoutes } from '../../../src-v2/domain/routing.ts'
import { hardRestriction } from '../../../src-v2/domain/route-policy.ts'
import { emptyEvidence } from '../../../src-v2/domain/evidence.ts'

test('V2213 policy: ranking and dispatch share restriction precedence', () => {
  const host = 'upos-sz-mirrorali.bilivideo.com'
  const blackHosts = new Set([host]),
    deadHosts = new Set([host])
  const ranking = rankRoutes(
    {
      candidates: [{ type: 'catalog-generated', host, kind: 'video', catalogIndex: 0 }],
      evidenceFor: () => ({ ...emptyEvidence(host, 'video'), circuitUntil: 2000 }),
      restrictions: {
        blackHosts,
        deadHosts,
        disabledCatalogHosts: new Set([host]),
        defaultUnavailableHosts: new Set([host]),
        hostLocked: new Set([host]),
      },
      demand: { kind: 'video', requiredMbps: 5, highDemand: false },
      fixedHost: host,
      current: null,
      boundary: 'startup',
      failedHost: null,
    },
    1000,
  )
  assert.equal(
    hardRestriction(
      host,
      { blackHosts, deadHosts, overrides: { [host]: false }, circuitUntil: 2000 },
      1000,
    ),
    'black',
  )
  assert.deepEqual(ranking[0]!.reasons, [
    'black',
    'dead',
    'catalog-disabled',
    'default-unavailable',
    'host-lock',
    'circuit-open',
  ])
  assert.equal(ranking[0]!.eligible, false)
})
