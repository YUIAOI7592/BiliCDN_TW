import { test } from 'node:test'
import assert from 'node:assert/strict'
import { frozenCases } from '../../scripts/evaluation/buffer-shadow/low-inputs.mts'
import { runLowScenario } from '../support/buffer-low-scenarios.ts'
import { runScenario } from '../support/buffer-shadow-scenarios.ts'
import { validEvaluationResult } from '../../scripts/evaluation/buffer-shadow-evaluation.mts'

for (const c of frozenCases)
  for (const rate of [1, 2] as const)
    test(`buffer-v5 ${c.group} integration ${c.id} rate=${rate}`, { timeout: 5000 }, async (t) => {
      const result = await runLowScenario(c, rate, t)
      assert.equal(validEvaluationResult(result, false), true)
      for (const a of result.assertions) assert.equal(a.verdict, 'pass', a.id)
      assert.deepEqual(result.cleanup, { timers: 0, subscriptions: 0 })
    })
for (const c of frozenCases.filter((c) => c.pair))
  for (const rate of [1, 2] as const)
    test(`buffer-v5 shared prefix ${c.id} rate=${rate}`, { timeout: 5000 }, async (t) => {
      const normal = frozenCases.find((x) => x.id === c.pair)!
      const a = await runLowScenario(c, rate, t),
        b = await runLowScenario(normal, rate, t)
      assert.deepEqual(
        a.rows.filter((r) => r.at < normal.refillAt!),
        b.rows.filter((r) => r.at < normal.refillAt!),
      )
    })
for (const rate of [1, 2] as const)
  test(
    `buffer-v5 I-B two hours low confirmation and content renewal rate=${rate}`,
    { timeout: 5000 },
    async (t) => {
      const result = await runScenario('two-hour-bounds', rate, t, {
        profile: {
          initialBuffer: 4,
          stallAt: null,
          cycleMs: 20000,
          fullRepayment: true,
          samples: Array.from({ length: 7200 }, (_, i) => ({
            buffer: 4 - ((i + 1) % 20) * 0.05,
            progress: true,
            ms: 1000,
          })),
        },
        target: {},
      })
      assert.equal(result.verdict, 'pass')
      assert.ok(result.score.episodes.length > 0)
      assert.deepEqual(result.effects, [])
      assert.deepEqual(result.cleanup, { timers: 0, subscriptions: 0 })
      assert.ok(
        result.rows.some((r) => r.reason === 'context-changed' || r.reason === 'warming-up'),
      )
      t.diagnostic(
        JSON.stringify({
          source: 'buffer-v5 I-B',
          rate,
          bounds: result.bounds,
          cleanup: result.cleanup,
          episodes: result.score.episodes.length,
          elapsed: result.rows.at(-1)!.at,
        }),
      )
    },
  )
