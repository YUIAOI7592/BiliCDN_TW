import { test } from 'node:test'
import assert from 'node:assert/strict'
import { testScope } from '../../tests-v2/support/scope.ts'
import { inputs, loadInput, commonHosts } from './inputs.mts'
import { scenarios } from './model.mts'
import type { CaseResult, Version, Scenario, Rate } from './model.mts'
import { runCase } from './cases.mts'

const [version, scenario, rate, mode] = process.argv.slice(2)
if (
  !inputs.some((e) => e.version === version) ||
  !scenarios.includes(scenario as Scenario) ||
  !['1', '2'].includes(rate ?? '') ||
  !['calibration', 'compare'].includes(mode ?? '')
)
  throw Error('Invalid private worker invocation')
let result: CaseResult | undefined
await test(`${scenario} at ${rate}x / full ${version}`, { timeout: 5000 }, async (t) => {
  const scope = testScope(t)
  result = await runCase(
    loadInput(version as Version),
    version as Version,
    scenario as Scenario,
    Number(rate) as Rate,
    commonHosts(),
    mode === 'calibration',
    scope,
  )
  assert.equal(result.validity, 'valid', result.reasons.join(', '))
  for (const assertion of result.assertions)
    if (assertion.applicability === 'applicable')
      assert.equal(assertion.verdict, 'pass', assertion.id)
})
if (result) process.stdout.write('COMPARISON_RESULT ' + JSON.stringify(result) + '\n')
