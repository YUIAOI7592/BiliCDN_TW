import { assessAdoption } from './live-model.mts'
import type { AdoptionFacts } from './live-model.mts'

export interface ReadinessInput {
  readonly real: AdoptionFacts
  readonly warningFeasible: boolean | null
  readonly warningUtilityPassed: boolean | null
  readonly alternative: 'known-pass' | 'known-fail' | 'unknown'
}
export function assessReadiness(input: ReadinessInput) {
  if (
    ![true, false, null].includes(input.warningFeasible) ||
    ![true, false, null].includes(input.warningUtilityPassed) ||
    !['known-pass', 'known-fail', 'unknown'].includes(input.alternative)
  )
    throw Error('Invalid readiness evidence')
  const live = assessAdoption(input.real)
  const reasons = [
    ...(input.warningFeasible === false
      ? ['sampled-warning-constraints-conflict']
      : input.warningFeasible === null
        ? ['warning-evidence-unknown']
        : []),
    ...(input.warningUtilityPassed === true
      ? []
      : [
          input.warningUtilityPassed === false
            ? 'warning-utility-failed'
            : 'warning-utility-unknown',
        ]),
    ...(input.alternative === 'unknown'
      ? ['alternative-qualification-unknown']
      : input.alternative === 'known-fail'
        ? ['alternative-disallowed']
        : []),
    ...(live.decision === 'prototype' ? [] : ['real-evidence-' + live.decision]),
  ]
  const ready = reasons.length === 0
  return {
    schemaVersion: 1 as const,
    recommendation: ready ? 'recommend-controlled-prototype' : 'do-not-adopt-now',
    reasons,
    underlyingLiveDecision: live.decision,
    liveChecks: live.checks,
    stages: {
      warning:
        input.warningFeasible === null
          ? 'unknown'
          : input.warningFeasible
            ? 'feasible'
            : 'constraints-conflict',
      warningUtility:
        input.warningUtilityPassed === null
          ? 'unknown'
          : input.warningUtilityPassed
            ? 'pass'
            : 'fail',
      alternative: input.alternative,
      realAdoption: live.decision,
      prototype: ready ? 'eligible-for-contracts' : 'not-executed-gate-failed',
      release: 'not-authorized-by-evaluation',
    },
    productActionAuthorized: false as const,
  }
}
