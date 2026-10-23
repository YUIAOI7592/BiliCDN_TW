import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scenarioNames } from '../../scripts/buffer-shadow/model.mts'
import { runScenario } from './buffer-shadow-scenarios.ts'
import {
  observationNames,
  observationInput,
} from '../../scripts/buffer-shadow/observation-inputs.mts'
import { cycleNames, cycleInput } from '../../scripts/buffer-shadow/cycle-inputs.mts'

const [name, rate, mode] = process.argv.slice(2)
const scenario = scenarioNames.find((n) => n === name)
const observation = observationNames.find((n) => n === name)
const cycle = mode === 'cycle' ? cycleNames.find((n) => n === name) : undefined
if (
  (!scenario && !observation && !cycle) ||
  (mode !== undefined && mode !== 'cycle') ||
  (rate !== '1' && rate !== '2')
)
  throw Error('Invalid evaluation worker invocation')
let result: Awaited<ReturnType<typeof runScenario>> | undefined
await test(`buffer-shadow integration ${name} rate=${rate}`, { timeout: 5000 }, async (t) => {
  result = await runScenario(
    cycle ? 'observation-holdout' : (scenario ?? 'observation-holdout'),
    Number(rate) as 1 | 2,
    t,
    cycle ? cycleInput(cycle) : observation ? observationInput(observation) : undefined,
  )
  for (const a of result.assertions)
    assert.equal(
      a.verdict,
      'pass',
      `${a.id}: expected ${JSON.stringify(a.expected)}, actual ${JSON.stringify(a.actual)}`,
    )
})
if (result) process.stdout.write('SHADOW_RESULT ' + JSON.stringify(result) + '\n')
