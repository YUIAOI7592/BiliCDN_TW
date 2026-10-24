import { test } from 'node:test'
import assert from 'node:assert/strict'
import { candidateScenarioNames } from '../../scripts/buffer-shadow/candidate-inputs.mts'
import { runScenario } from '../support/buffer-shadow-scenarios.ts'
import { readingVersion } from '../../scripts/buffer-shadow/model.mts'
import { validEvaluationResult } from '../../scripts/buffer-shadow-evaluation.mts'

test('buffer-v3 tooling preserves version meanings and rejects mixed worker evidence', async (t) => {
  for (const version of [1, 2, 3, 4, 5]) {
    const reading = {
      schemaVersion: version,
      algorithm: `buffer-window-v${version}`,
      candidate: version !== 2,
    }
    const before = structuredClone(reading)
    assert.equal(readingVersion(reading), version)
    assert.deepEqual(reading, before)
    assert.equal(readingVersion({ ...reading, algorithm: 'buffer-window-v99' }), null)
  }
  const result = await runScenario('high-stable', 1, t)
  assert.equal(validEvaluationResult(result, false), true)
  const mixed = structuredClone(result)
  Object.assign(mixed.rows[1]!.trend, { schemaVersion: 1, algorithm: 'buffer-window-v1' })
  assert.equal(validEvaluationResult(mixed, false), false)
  Object.assign(mixed.rows[1]!.trend, { schemaVersion: 4, algorithm: 'buffer-window-v4' })
  Object.assign(mixed.prelude[0]!.trend, { schemaVersion: 2, algorithm: 'buffer-window-v2' })
  assert.equal(validEvaluationResult(mixed, false), false)
})

for (const rate of [1, 2] as const)
  for (const name of [
    'jitter-2s',
    'burst-refill',
    'low-sawtooth',
    'drain-refill',
    'slow-exhaustion',
    'fast-exhaustion',
    ...candidateScenarioNames,
  ] as const)
    test(`buffer-v3 integration ${name} rate=${rate}`, { timeout: 5000 }, async (t) => {
      const result = await runScenario(name, rate, t)
      for (const assertion of result.assertions)
        assert.equal(
          assertion.verdict,
          'pass',
          `${assertion.id}: expected ${JSON.stringify(assertion.expected)}, actual ${JSON.stringify(assertion.actual)}`,
        )
      assert.equal(result.cleanup.timers, 0)
      assert.equal(result.cleanup.subscriptions, 0)
      if (name === 'drain-refill') assert.equal(result.score.episodes[0]!.followup, 'continued')
    })
