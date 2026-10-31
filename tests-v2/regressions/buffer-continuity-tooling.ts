import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  measureContinuity,
  revocationAt,
} from '../../scripts/evaluation/buffer-shadow/continuity.mts'
import { continuityCases } from '../../scripts/evaluation/buffer-shadow/continuity-inputs.mts'
import type { EvidenceRow } from '../../scripts/evaluation/buffer-shadow/model.mts'
import { parseEvaluationArgs } from '../../scripts/evaluation/buffer-shadow/model.mts'
import { validEvaluationResult } from '../../scripts/evaluation/buffer-shadow-evaluation.mts'
import { runContinuityScenario } from '../support/buffer-continuity-scenarios.ts'
function rows(values: readonly (boolean | null)[]): EvidenceRow[] {
  return values.map((candidate, i) => ({
    seq: i + 1,
    at: i * 1000,
    owner: 'owner-1',
    candidate,
    state: candidate === null ? 'insufficient' : 'draining',
    reason: 'fixture',
    currentTime: i,
    frames: i * 30,
    qualified: true,
    rate: 1,
  }))
}
test('buffer-v6 U-M frozen external profiles', () => {
  assert.equal(
    createHash('sha256').update(JSON.stringify(continuityCases)).digest('hex'),
    '586fef8f888dd53b7fa1def6745617356bf7c772e88f1505a66bcc02f3d9fa09',
  )
})
test('buffer-v6 U-M last sample distance and terminal false duration differ', () => {
  const input = rows([true, false, false, false, null]),
    before = structuredClone(input)
  const r = measureContinuity(input, { scoreUntil: 4000, stallAt: 4000 })
  assert.equal(r.lastCandidateLeadMs, 4000)
  assert.equal(r.terminalFalseMs, 3000)
  assert.equal(r.maximumGapMs, 3000)
  assert.deepEqual(input, before)
})
for (const kind of ['null', 'owner', 'gap', 'unqualified'] as const)
  test(`buffer-v6 U-M ${kind} censors a candidate gap`, () => {
    const input = rows([true, false, false, false, false, true])
    if (kind === 'null') Object.assign(input[2]!, { candidate: null, state: 'insufficient' })
    if (kind === 'owner') Object.assign(input[2]!, { owner: 'owner-2' })
    if (kind === 'gap')
      for (let i = 2; i < input.length; i++) Object.assign(input[i]!, { at: input[i]!.at + 1000 })
    if (kind === 'unqualified') Object.assign(input[2]!, { qualified: false })
    const r = measureContinuity(input, { scoreUntil: input.at(-1)!.at, stallAt: null })
    assert.ok(r.maximumGapMs <= 1000)
    assert.ok(r.late15.unknownMs > 0)
  })
for (const lag of [0, 1000, 2000])
  test(`buffer-v6 U-M observed revocation delay ${lag}`, () => {
    const input = rows([true, ...Array(lag / 1000).fill(true), false, false])
    assert.deepEqual(revocationAt(input, 1000), { validity: 'valid', lagMs: lag })
  })
test('buffer-v6 U-M missing endpoint and duplicate times cannot manufacture coverage', () => {
  const input = rows([true, false, false])
  assert.equal(measureContinuity(input, { scoreUntil: 3000, stallAt: 3000 }).terminalFalseMs, null)
  assert.deepEqual(revocationAt(input, 500), { validity: 'invalid', lagMs: null })
  Object.assign(input[1]!, { at: 0 })
  assert.throws(() => measureContinuity(input, { scoreUntil: 2000, stallAt: null }))
})
test('buffer-v6 U-M censored tail without a new candidate stays undetermined', () => {
  const input = rows([true, null, false, false, null])
  const result = measureContinuity(input, { scoreUntil: 4000, stallAt: 4000 })
  assert.equal(result.terminalFalseMs, null)
  assert.equal(result.lastCandidateLeadMs, null)
})
test('buffer-v6 tooling continuity mode remains exclusive', () => {
  assert.deepEqual(parseEvaluationArgs(['--continuity', '--json']), {
    json: true,
    cost: false,
    continuity: true,
  })
  for (const flag of [
    '--continuity',
    '--cost',
    '--cost-v3',
    '--cost-source',
    '--low-buffer',
    '--holdout',
    '--cycle-holdout',
  ])
    assert.throws(() => parseEvaluationArgs(['--continuity', flag]))
})
for (const fault of [
  'flag',
  'credit',
  'coverage',
  'basis',
  'zero',
  'debt',
  'expired',
  'reason',
  'legacy',
] as const)
  test(`buffer-v6 tooling rejects ${fault} tail proof`, { timeout: 5000 }, async (t) => {
    const result = await runContinuityScenario(continuityCases[0]!, 1, t)
    assert.equal(validEvaluationResult(result, false), true)
    const row = result.rows.find((r) => r.reason === 'low-buffer-tail')!
    if (fault === 'flag') Object.assign(row.trend.lowBuffer!, { tailUsed: false })
    if (fault === 'credit') Object.assign(row.trend.lowBuffer!, { creditMs: 1999 })
    if (fault === 'coverage') Object.assign(row.trend.lowBuffer!, { declineCoverageMs: 1999 })
    if (fault === 'basis')
      Object.assign(row.trend.lowBuffer!, { basis: 'steady-decline', declineCoverageMs: 8000 })
    if (fault === 'zero') Object.assign(row.trend, { endBufferSec: 0 })
    if (fault === 'debt') Object.assign(row.trend.cycle!, { netLossSec: 0 })
    if (fault === 'expired') Object.assign(row.trend.cycle!, { lastLossAgeMs: 8001 })
    if (fault === 'reason') {
      Object.assign(row, { reason: 'low-buffer-tail-used' })
      Object.assign(row.trend, { reason: 'low-buffer-tail-used' })
    }
    if (fault === 'legacy')
      for (const r of [...result.rows, ...result.prelude])
        Object.assign(r.trend, { schemaVersion: 5, algorithm: 'buffer-window-v5' })
    assert.equal(validEvaluationResult(result, false), false)
  })
