import type { TestContext } from 'node:test'
import { adoptionPair } from '../../scripts/evaluation/buffer-shadow/adoption-inputs.mts'
import { runRiskScenario } from './buffer-risk-scenario.ts'

export async function runAdoptionPair(rate: 1 | 2, t: TestContext, observed = true) {
  const input = adoptionPair(rate)
  const exhaustion = await runRiskScenario(input.exhaustion, observed, t)
  const normal = await runRiskScenario(input.normal, observed, t)
  const project = (r: typeof exhaustion) => ({
    rows: r.rows,
    events: r.events,
    balances: r.balances,
    firstDepletionMs: r.firstDepletionMs,
    firstLeadMs: r.firstLeadMs,
    projectionMatches: r.projectionMatches,
    bounds: r.bounds,
    effectsHash: r.effectsHash,
    cleanup: r.cleanup,
    scenarioHash: r.scenarioHash,
  })
  return { rate, frozenInput: input, exhaustion: project(exhaustion), normal: project(normal) }
}
