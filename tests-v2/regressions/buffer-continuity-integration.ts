import { test } from 'node:test'
import assert from 'node:assert/strict'
import { continuityCases } from '../../scripts/evaluation/buffer-shadow/continuity-inputs.mts'
import { runContinuityScenario } from '../support/buffer-continuity-scenarios.ts'
import { runScenario } from '../support/buffer-shadow-scenarios.ts'

for (const c of continuityCases)
  for (const rate of [1, 2] as const)
    test(`buffer-v6 I-N ${c.id} rate=${rate}`, { timeout: 5000 }, async (t) => {
      const r = await runContinuityScenario(c, rate, t)
      for (const a of r.assertions)
        assert.equal(a.verdict, 'pass', `${a.id}: ${JSON.stringify(a.actual)}`)
      assert.deepEqual(r.cleanup, { timers: 0, subscriptions: 0 })
    })
for (const c of continuityCases.filter((c) => c.pair && c.profile.stallAt !== null))
  for (const rate of [1, 2] as const)
    test(`buffer-v6 I-N shared prefix ${c.id} rate=${rate}`, { timeout: 5000 }, async (t) => {
      const normal = continuityCases.find((n) => n.id === c.pair)!
      const a = await runContinuityScenario(c, rate, t),
        b = await runContinuityScenario(normal, rate, t)
      assert.deepEqual(
        a.rows.filter((row) => row.at < normal.refillAt!),
        b.rows.filter((row) => row.at < normal.refillAt!),
      )
    })
for (const rate of [1, 2] as const)
  test(
    `buffer-v6 I-B two hours bounded tail and transport rate=${rate}`,
    { timeout: 5000 },
    async (t) => {
      const micro = continuityCases.find((c) => c.id === 'tail-normal-microdecline')!.profile
      const result = await runScenario('two-hour-bounds', rate, t, {
        profile: {
          ...micro,
          samples: Array.from({ length: 7200 }, (_, i) => ({
            buffer: i % 60 < 30 ? micro.samples[i % 60]!.buffer : 1,
            progress: true,
            ms: 1000,
          })),
        },
        target: {},
      })
      assert.equal(result.verdict, 'pass')
      assert.ok(result.rows.some((r) => r.reason === 'low-buffer-tail'))
      assert.deepEqual(result.effects, [])
      assert.deepEqual(result.cleanup, { timers: 0, subscriptions: 0 })
      assert.ok(
        result.bounds.maxSamples <= 32 &&
          result.bounds.maxCompletions <= 128 &&
          result.bounds.maxTrendRecords <= 32 &&
          result.bounds.maxTrendBytes <= 8192 &&
          result.bounds.maxReportBytes <= 98304,
      )
      t.diagnostic(
        JSON.stringify({
          source: 'buffer-v6 I-B',
          rate,
          bounds: result.bounds,
          cleanup: result.cleanup,
        }),
      )
    },
  )
