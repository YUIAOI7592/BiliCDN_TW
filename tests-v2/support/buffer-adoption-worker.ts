import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runAdoptionPair } from './buffer-adoption-pair.ts'

const rate = Number(process.argv[2])
if (rate !== 1 && rate !== 2) throw Error('Invalid adoption pair rate')
await test(
  `adoption I-W01 warning at least 3000ms with zero-candidate paired normal rate=${rate}`,
  { timeout: 5000 },
  async (t) => {
    const pair = await runAdoptionPair(rate, t)
    const normalCandidates = pair.normal.rows.filter(
      (r) => r.at >= 60000 && r.candidate === true,
    ).length
    const assertions = [
      {
        id: 'normal-candidate-cost',
        expected: 0,
        actual: normalCandidates,
        pass: normalCandidates === 0,
      },
      {
        id: 'projection',
        expected: true,
        actual: pair.exhaustion.projectionMatches && pair.normal.projectionMatches,
        pass: pair.exhaustion.projectionMatches && pair.normal.projectionMatches,
      },
      {
        id: 'capacity',
        expected: true,
        actual: [pair.exhaustion, pair.normal].every(
          (r) =>
            r.bounds.maxSamples <= 32 &&
            r.bounds.maxTrendRecords <= 32 &&
            r.bounds.maxTrendBytes <= 8192,
        ),
        pass: [pair.exhaustion, pair.normal].every(
          (r) =>
            r.bounds.maxSamples <= 32 &&
            r.bounds.maxTrendRecords <= 32 &&
            r.bounds.maxTrendBytes <= 8192,
        ),
      },
      {
        id: 'minimum-warning',
        expected: 3000,
        actual: pair.exhaustion.firstLeadMs,
        pass: pair.exhaustion.firstLeadMs !== null && pair.exhaustion.firstLeadMs >= 3000,
      },
    ]
    process.stdout.write('ADOPTION_PAIR ' + JSON.stringify({ ...pair, assertions }) + '\n')
    for (const a of assertions)
      assert.equal(a.pass, true, a.id + ': expected ' + a.expected + ', actual ' + a.actual)
  },
)
