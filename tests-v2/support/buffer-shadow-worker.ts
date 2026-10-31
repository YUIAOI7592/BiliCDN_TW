import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scenarioNames } from '../../scripts/evaluation/buffer-shadow/model.mts'
import { runScenario } from './buffer-shadow-scenarios.ts'
import {
  observationNames,
  observationInput,
} from '../../scripts/evaluation/buffer-shadow/observation-inputs.mts'
import { cycleNames, cycleInput } from '../../scripts/evaluation/buffer-shadow/cycle-inputs.mts'

import { frozenCases } from '../../scripts/evaluation/buffer-shadow/low-inputs.mts'
import { runLowScenario } from './buffer-low-scenarios.ts'
import { continuityCases } from '../../scripts/evaluation/buffer-shadow/continuity-inputs.mts'
import { runContinuityScenario } from './buffer-continuity-scenarios.ts'
const [name, rate, mode] = process.argv.slice(2)
const scenario = scenarioNames.find((n) => n === name)
const observation = observationNames.find((n) => n === name)
const cycle = mode === 'cycle' ? cycleNames.find((n) => n === name) : undefined
const low = mode === 'low' ? frozenCases.find((c) => c.id === name) : undefined
const continuity = mode === 'continuity' ? continuityCases.find((c) => c.id === name) : undefined
if (
  (!scenario && !observation && !cycle && !low && !continuity) ||
  (mode !== undefined && mode !== 'cycle' && mode !== 'low' && mode !== 'continuity') ||
  (rate !== '1' && rate !== '2')
)
  throw Error('Invalid evaluation worker invocation')
let result: Awaited<ReturnType<typeof runScenario>> | undefined
await test(`buffer-shadow integration ${name} rate=${rate}`, { timeout: 5000 }, async (t) => {
  result = continuity
    ? await runContinuityScenario(continuity, Number(rate) as 1 | 2, t)
    : low
      ? await runLowScenario(low, Number(rate) as 1 | 2, t)
      : await runScenario(
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
