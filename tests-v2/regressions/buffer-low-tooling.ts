import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { frozenCases } from '../../scripts/buffer-shadow/low-inputs.mts'
import { parseEvaluationArgs } from '../../scripts/buffer-shadow/model.mts'
import { validEvaluationResult } from '../../scripts/buffer-shadow-evaluation.mts'
import { runLowScenario } from '../support/buffer-low-scenarios.ts'
test('buffer-v5 tooling input freeze and exclusive CLI mode', () => {
  assert.equal(
    createHash('sha256')
      .update(JSON.stringify(frozenCases, null, 2))
      .digest('hex'),
    '9fd9fce86dc0e84736f6ae06a2acad26b5fce29c4311770ce00916690aef9e17',
  )
  assert.deepEqual(parseEvaluationArgs(['--low-buffer', '--json']), {
    json: true,
    cost: false,
    lowBuffer: true,
  })
  for (const flag of [
    '--cost',
    '--cost-v3',
    '--cost-source',
    '--holdout',
    '--cycle-holdout',
    '--low-buffer',
  ])
    assert.throws(() => parseEvaluationArgs(['--low-buffer', flag]))
})
for (const fault of [
  'missing',
  'credit',
  'basis',
  'coverage',
  'reason',
  'version',
  'debt',
  'mixed',
] as const)
  test(`buffer-v5 tooling rejects ${fault} evidence`, { timeout: 5000 }, async (t) => {
    const c = frozenCases.find((c) => c.id === (fault === 'debt' ? 'low4-cycle3-75' : 'slow-0.1'))!
    const result = await runLowScenario(c, 1, t)
    assert.equal(validEvaluationResult(result, false), true)
    const row = result.rows.find((r) => r.candidate === true)!
    if (fault === 'missing') Object.assign(row.trend, { lowBuffer: null })
    if (fault === 'credit') Object.assign(row.trend.lowBuffer!, { creditMs: 1999 })
    if (fault === 'basis') Object.assign(row.trend.lowBuffer!, { basis: 'unknown' })
    if (fault === 'coverage') Object.assign(row.trend.lowBuffer!, { declineCoverageMs: 7999 })
    if (fault === 'reason') Object.assign(row.trend, { reason: 'low-buffer-confirming' })
    if (fault === 'version') Object.assign(row.trend, { schemaVersion: 4 })
    if (fault === 'debt') Object.assign(row.trend.cycle!, { netLossSec: 0 })
    if (fault === 'mixed')
      Object.assign(result.prelude[0]!.trend, { schemaVersion: 4, algorithm: 'buffer-window-v4' })
    assert.equal(validEvaluationResult(result, false), false)
  })
