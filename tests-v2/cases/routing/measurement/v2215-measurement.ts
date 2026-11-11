import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  probeResultUsable,
  rankStartupResults,
  type ProbeResult,
} from '../../../../src-v2/application/measurement/startup-evaluation.ts'
import { epochId, generationId, representationId } from '../../../../src-v2/domain/model.ts'
import type { StartupCandidate } from '../../../../src-v2/application/routing/route-contracts.ts'
import type { RangeProbeResult } from '../../../../src-v2/application/measurement/measurement-contracts.ts'

const candidate = (host: string, cachedSafeMbps: number | null = null): StartupCandidate => ({
  host,
  type: 'catalog-generated',
  url: `https://${host}/upgcxcode/a/b/test.m4s`,
  original: false,
  cachedSafeMbps,
  context: {
    generation: generationId(1),
    epoch: epochId(1),
    representation: representationId('probe-video'),
    kind: 'video',
    authorityRevision: 1,
  },
})
test('V2215 probe evaluation keeps short cache validation distinct from a fresh speed sample', () => {
  const result: RangeProbeResult = {
    bytes: 16384,
    elapsedMs: 0,
    ttfbMs: 0,
    status: 206,
    directRange: true,
    reason: 'complete',
    speedEligible: false,
  }
  assert.equal(probeResultUsable(candidate('upos-sz-mirrorali.bilivideo.com'), result), false)
  assert.equal(probeResultUsable(candidate('upos-sz-mirrorali.bilivideo.com', 20), result), true)
  assert.equal(
    probeResultUsable(candidate('upos-sz-mirrorali.bilivideo.com', 20), {
      ...result,
      payloadValid: false,
    }),
    false,
  )
})
test('V2215 startup evaluation breaks equal results by original candidate order without mutating input', () => {
  const make = (host: string): ProbeResult => ({
    candidate: candidate(host),
    valid: true,
    safeMbps: 20,
    capacityConfidence: 'sufficient',
    safePayloadMbps: null,
    predictionTtfbMs: null,
    bytes: 131072,
    elapsedMs: 100,
    ttfbMs: 10,
    status: 206,
    reason: 'measured',
  })
  const first = make('upos-sz-mirrorali.bilivideo.com'),
    second = make('upos-sz-mirrorcos.bilivideo.com')
  const rows = [second, first].map((result) => ({
    result,
    candidateOrder: result === first ? 0 : 1,
    capacityConfidence: result.capacityConfidence,
    safeThroughputMbps: result.safeMbps,
    demandRatio: 2,
    safePayloadMbps: null,
    predictionTtfbMs: null,
  }))
  const qualified = [second, first],
    before = structuredClone({ rows, qualified }),
    ranked = rankStartupResults(rows, qualified, null, 1000)
  assert.deepEqual(ranked.ranked, [first, second])
  assert.strictEqual(ranked.fastestValid, first.candidate)
  assert.deepEqual({ rows, qualified }, before)
})
