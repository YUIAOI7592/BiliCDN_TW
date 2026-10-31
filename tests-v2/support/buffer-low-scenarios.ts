import { runScenario } from './buffer-shadow-scenarios.ts'
import type { ScenarioResult } from './buffer-shadow-scenarios.ts'
import type { Case } from '../../scripts/evaluation/buffer-shadow/low-inputs.mts'
import type { testScope } from './scope.ts'

export async function runLowScenario(
  c: Case,
  rate: 1 | 2,
  t: Parameters<typeof testScope>[0],
): Promise<ScenarioResult> {
  const r = await runScenario('observation-holdout', rate, t, { profile: c.profile, target: {} })
  const assertions = [...r.assertions]
  const check = (id: string, expected: unknown, actual: unknown) =>
    assertions.push({
      id,
      expected,
      actual,
      evidence: r.rows.map((row) => row.seq),
      verdict: JSON.stringify(expected) === JSON.stringify(actual) ? 'pass' : 'fail',
    })
  check(
    'initial-buffer-prelude',
    true,
    r.prelude.every((x) => x.input.buffer === c.profile.initialBuffer),
  )
  if (c.firstMs !== undefined)
    check('low-first-candidate', c.firstMs, r.score.episodes[0]?.start ?? null)
  if (c.minimumLeadMs !== undefined)
    check(
      'low-minimum-lead',
      true,
      r.score.firstLeadMs !== null && r.score.firstLeadMs >= c.minimumLeadMs,
    )
  if (c.maxCandidateMs !== undefined)
    check('low-normal-time', true, r.score.candidateMs <= c.maxCandidateMs)
  if (c.maxEpisodes !== undefined)
    check('low-normal-episodes', true, r.score.episodes.length <= c.maxEpisodes)
  if (c.refillAt !== undefined)
    check(
      'low-refill-no-recurrence',
      true,
      r.rows.filter((x) => x.at >= c.refillAt!).every((x) => x.candidate === false),
    )
  return {
    ...r,
    id: `${c.id}@${rate}x`,
    assertions,
    verdict: assertions.every((a) => a.verdict === 'pass') ? 'pass' : 'fail',
  }
}
