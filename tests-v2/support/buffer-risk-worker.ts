import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runRiskScenario } from './buffer-risk-scenario.ts'
import { riskNames, riskScenario } from '../../scripts/evaluation/buffer-shadow/risk-inputs.mts'
import { measureRiskCoverage } from '../../scripts/evaluation/buffer-shadow/risk-coverage.mts'
import { scoreLiveWindow } from '../../scripts/evaluation/buffer-shadow/live-model.mts'
import { assessOpportunity } from '../../scripts/evaluation/buffer-shadow/actionability.mts'

const [name, rate] = process.argv.slice(2)
const scenario = riskNames.find((n) => n === name)
if (!scenario || (rate !== '1' && rate !== '2')) throw Error('Invalid supply worker arguments')
const input = riskScenario(scenario, Number(rate) as 1 | 2)
let output: unknown
await test(`risk supply ${scenario} rate=${rate}`, { timeout: 5000 }, async (t) => {
  const r = await runRiskScenario(input, true, t)
  const coverage = measureRiskCoverage(r.rows, { from: 60000, until: 180000 })
  const score = scoreLiveWindow(r.rows, r.events, { from: 60000, until: 180000 })
  const assertions = [
    {
      id: 'external-depletion',
      expected: input.firstDepletionMs,
      actual: r.firstDepletionMs,
      pass:
        input.firstDepletionMs === null
          ? r.firstDepletionMs === null
          : r.firstDepletionMs !== null &&
            Math.abs(r.firstDepletionMs - input.firstDepletionMs) <= 0.000001,
    },
    { id: 'projection', expected: true, actual: r.projectionMatches, pass: r.projectionMatches },
    {
      id: 'capacity',
      expected: true,
      actual: r.bounds,
      pass:
        r.bounds.maxSamples <= 32 &&
        r.bounds.maxTrendRecords <= 32 &&
        r.bounds.maxTrendBytes <= 8192,
    },
    ...(input.minimumLeadMs === null
      ? []
      : [
          {
            id: 'minimum-warning',
            expected: input.minimumLeadMs,
            actual: r.firstLeadMs,
            pass: r.firstLeadMs !== null && r.firstLeadMs >= input.minimumLeadMs,
          },
        ]),
    ...(input.maximumCandidateMs === null
      ? []
      : [
          {
            id: 'normal-candidate-cost',
            expected: input.maximumCandidateMs,
            actual: coverage.candidateMs,
            pass: coverage.candidateMs <= input.maximumCandidateMs,
          },
        ]),
  ]
  const opportunityChecks = score.opportunities
    .filter((o) => o.eligible)
    .map((o) => {
      const sample = r.rows.find((s) => s.at === o.at)!
      const request = r.events.find(
        (e) =>
          e.at >= o.at &&
          e.at - o.at <= 1500 &&
          e.type === 'request-started' &&
          e.kind === 'video' &&
          e.owner === o.owner,
      )
      return {
        at: o.at,
        status: assessOpportunity({
          level: 'synthetic',
          sample,
          request: request
            ? { at: request.at, owner: request.owner, kind: 'video', phase: 'started' }
            : null,
          evidence: null,
        }),
      }
    })
  output = {
    schemaVersion: 1,
    ...(({ effects: _effects, ...rest }) => rest)(r),
    validity:
      r.rows.length === 180 && r.rows.every((s) => s.quality === 'valid') ? 'valid' : 'invalid',
    verdict: assertions.every((a) => a.pass) ? 'pass' : 'fail',
    frozenInput: input,
    assertions,
    coverage,
    score,
    opportunityChecks,
    productActionAuthorized: false,
  }
  // Print the full result even when an independent utility contract is red.
  process.stdout.write('RISK_RESULT ' + JSON.stringify(output) + '\n')
  for (const a of assertions)
    assert.equal(
      a.pass,
      true,
      `${a.id}: expected ${JSON.stringify(a.expected)}, actual ${JSON.stringify(a.actual)}`,
    )
})
