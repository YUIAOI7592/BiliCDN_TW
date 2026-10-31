import { runScenario } from './buffer-shadow-scenarios.ts'
import {
  measureContinuity,
  revocationAt,
} from '../../scripts/evaluation/buffer-shadow/continuity.mts'
import type { ContinuityCase } from '../../scripts/evaluation/buffer-shadow/continuity-inputs.mts'
import type { testScope } from './scope.ts'
import baseline from '../fixtures/buffer-continuity-v5.json'

export async function runContinuityScenario(
  c: ContinuityCase,
  rate: 1 | 2,
  t: Parameters<typeof testScope>[0],
) {
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
  const continuity = measureContinuity(r.rows, {
    scoreUntil: r.rows.at(-1)!.at,
    stallAt: c.profile.stallAt,
  })
  const original = baseline.cases[c.id as keyof typeof baseline.cases]
  if (!original) throw Error('Missing frozen v5 continuity evidence')
  check(
    'continuity-v5-candidates-retained',
    true,
    original.candidateTimes.every((at) => r.rows.find((row) => row.at === at)?.candidate === true),
  )
  check('continuity-effects-unchanged', original.effects, r.effects)
  if (c.profile.stallAt === null) {
    const cap = c.id === 'tail-normal-plateau' ? 0 : 1000
    check('continuity-normal-added-time', true, r.score.candidateMs <= original.candidateMs + cap)
    check(
      'continuity-normal-added-episodes',
      true,
      r.score.episodes.length <= original.episodes + (cap ? 1 : 0),
    )
  } else {
    check('continuity-first-preserved', original.firstLeadMs, continuity.firstLeadMs)
    check('continuity-gap-not-worse', true, continuity.maximumGapMs <= original.maximumGapMs)
    check(
      'continuity-terminal-not-worse',
      true,
      continuity.terminalFalseMs !== null &&
        continuity.terminalFalseMs <= original.terminalFalseMs!,
    )
  }
  check(
    'continuity-healthy-prelude',
    true,
    r.prelude.every((x) => x.input.buffer === c.profile.initialBuffer),
  )
  if (c.tailAt !== null)
    check('continuity-tail-visible', true, r.rows.find((row) => row.at === c.tailAt)?.candidate)
  if (c.group === 'primary' && c.profile.stallAt !== null) {
    check('continuity-last-lead', 1000, continuity.lastCandidateLeadMs)
    check('continuity-terminal-gap', 0, continuity.terminalFalseMs)
  }
  if (c.profile.stallAt !== null)
    check('continuity-first-lead', true, (continuity.firstLeadMs ?? 0) >= 3000)
  if (c.refillAt !== null) {
    check(
      'continuity-refill-immediate',
      { validity: 'valid', lagMs: 0 },
      revocationAt(r.rows, c.refillAt),
    )
    check(
      'continuity-after-refill',
      true,
      r.rows.filter((row) => row.at >= c.refillAt!).every((row) => row.candidate === false),
    )
  }
  if (c.stableAt !== null) {
    check(
      'continuity-stable-immediate',
      { validity: 'valid', lagMs: 0 },
      revocationAt(r.rows, c.stableAt),
    )
    check(
      'continuity-after-stable',
      true,
      r.rows.filter((row) => row.at >= c.stableAt!).every((row) => row.candidate === false),
    )
  }
  if (c.id === 'tail-normal-plateau') check('continuity-plateau-time', 13000, r.score.candidateMs)
  if (c.id === 'tail-normal-microdecline')
    check(
      'continuity-micro-cost',
      true,
      r.score.candidateMs <= 4000 && r.score.episodes.length <= 2,
    )
  return {
    ...r,
    id: `${c.id}@${rate}x`,
    continuity,
    assertions,
    verdict: assertions.every((a) => a.verdict === 'pass') ? ('pass' as const) : ('fail' as const),
  }
}
