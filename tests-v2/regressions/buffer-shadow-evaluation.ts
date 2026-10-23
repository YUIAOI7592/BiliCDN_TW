import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scoreWindow, parseEvaluationArgs } from '../../scripts/buffer-shadow/model.mts'
import type { EvidenceRow } from '../../scripts/buffer-shadow/model.mts'
import { scenarioNames } from '../../scripts/buffer-shadow/model.mts'
import { runScenario } from '../support/buffer-shadow-scenarios.ts'
import { validEvaluationResult } from '../../scripts/buffer-shadow-evaluation.mts'

const row = (
  at: number,
  candidate: boolean | null,
  patch: Partial<EvidenceRow> = {},
): EvidenceRow => ({
  seq: at / 1000 + 1,
  at,
  owner: 'owner-1',
  candidate,
  state: candidate === null ? 'insufficient' : 'draining',
  reason: 'fixture',
  currentTime: 100 + at / 1000,
  frames: (at / 1000) * 30,
  qualified: true,
  rate: 1,
  ...patch,
})

test('shadow evaluator merges episodes and records false endings without mutating input', () => {
  const rows = [row(0, false), row(1000, true), row(2000, true), row(3000, false)]
  const before = structuredClone(rows)
  const result = scoreWindow(rows, { scoreUntil: 3000, stallAt: 5000 })
  assert.deepEqual(
    result.episodes.map((e) => [e.start, e.end, e.censored]),
    [[1000, 3000, false]],
  )
  assert.equal(result.firstLeadMs, 4000)
  assert.equal(result.candidateMs, 2000)
  assert.deepEqual(rows, before)
})

for (const kind of ['null', 'gap', 'owner'] as const)
  test(`shadow evaluator censors on ${kind} instead of claiming healthy continuation`, () => {
    const rows = [
      row(0, true),
      row(
        kind === 'gap' ? 2000 : 1000,
        kind === 'null' ? null : true,
        kind === 'owner' ? { owner: 'owner-2' } : {},
      ),
    ]
    const result = scoreWindow(rows, { scoreUntil: 2000, stallAt: null })
    assert.equal(result.episodes[0]!.censored, true)
    assert.equal(result.episodes[0]!.followup, 'undetermined')
  })

test('shadow evaluator accepts exactly fifteen seconds and detects two-second interruption', () => {
  const rows = Array.from({ length: 16 }, (_, i) =>
    row(i * 1000, i === 0, { currentTime: i < 4 ? 100 + i : 103, frames: i < 4 ? i * 30 : 90 }),
  )
  assert.equal(
    scoreWindow(rows, { scoreUntil: 0, stallAt: 4000 }).episodes[0]!.followup,
    'interrupted',
  )
  const healthy = rows.map((r, i) => ({ ...r, currentTime: 100 + i, frames: i * 30 }))
  assert.equal(
    scoreWindow(healthy, { scoreUntil: 0, stallAt: null }).episodes[0]!.followup,
    'continued',
  )
  assert.equal(
    scoreWindow(healthy.slice(0, 15), { scoreUntil: 0, stallAt: null }).episodes[0]!.followup,
    'undetermined',
  )
})

for (const kind of ['duplicate', 'reversed', 'nan', 'missing', 'rate'] as const)
  test(`shadow evaluator rejects invalid ${kind} evidence`, () => {
    const rows = [row(0, false), row(1000, true)]
    if (kind === 'duplicate') rows[1] = row(0, true)
    if (kind === 'reversed') rows[1] = row(-1, true)
    if (kind === 'nan') rows[1] = row(NaN, true)
    if (kind === 'missing') rows[1] = row(1000, true, { owner: '' })
    if (kind === 'rate') rows[1] = row(1000, true, { rate: NaN })
    assert.throws(() => scoreWindow(rows, { scoreUntil: 1000, stallAt: null }), /Invalid evidence/)
  })

test('shadow evaluator validates CLI independently of execution', () => {
  assert.deepEqual(parseEvaluationArgs(['--json', '--cost']), { json: true, cost: true })
  for (const args of [['--bad'], ['--json', '--json'], ['case']])
    assert.throws(() => parseEvaluationArgs(args))
})

for (const rate of [1, 2] as const)
  for (const name of scenarioNames)
    test(
      `shadow evaluation integration ${name} after healthy 60s rate=${rate}`,
      { timeout: 5000 },
      async (t) => {
        const result = await runScenario(name, rate, t)
        for (const a of result.assertions)
          assert.equal(a.verdict, 'pass', `${a.id}: ${JSON.stringify(a.actual)}`)
        assert.equal(validEvaluationResult(result, false), true)
      },
    )

for (const rate of [1, 2] as const)
  test(
    `shadow transport evidence does not change candidate trajectory rate=${rate}`,
    { timeout: 5000 },
    async (t) => {
      const baseline = await runScenario('transport-none', rate, t)
      for (const name of [
        'transport-success',
        'transport-failure',
        'transport-abort',
        'transport-duplicate',
        'transport-overflow',
      ] as const) {
        const result = await runScenario(name, rate, t)
        assert.deepEqual(
          result.rows.map((r) => r.candidate),
          baseline.rows.map((r) => r.candidate),
        )
      }
    },
  )

test('shadow evaluator rejects malformed worker reports', () => {
  for (const value of [null, {}, { validity: 'valid', verdict: 'pass' }])
    assert.equal(validEvaluationResult(value, false), false)
})
