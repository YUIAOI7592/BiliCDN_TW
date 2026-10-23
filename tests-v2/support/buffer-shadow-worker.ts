import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scenarioNames } from '../../scripts/buffer-shadow/model.mts'
import { runScenario } from './buffer-shadow-scenarios.ts'

const [name, rate] = process.argv.slice(2)
const scenario = scenarioNames.find((n) => n === name)
if (!scenario || (rate !== '1' && rate !== '2')) throw Error('Invalid evaluation worker invocation')
let result: Awaited<ReturnType<typeof runScenario>> | undefined
await test(`buffer-shadow integration ${scenario} rate=${rate}`, { timeout: 5000 }, async (t) => {
  result = await runScenario(scenario, Number(rate) as 1 | 2, t)
  for (const a of result.assertions)
    assert.equal(
      a.verdict,
      'pass',
      `${a.id}: expected ${JSON.stringify(a.expected)}, actual ${JSON.stringify(a.actual)}`,
    )
})
if (result) process.stdout.write('SHADOW_RESULT ' + JSON.stringify(result) + '\n')
