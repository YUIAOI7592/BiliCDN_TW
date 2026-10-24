import { projectLiveSample } from './live-model.mts'
import type { LiveSample } from './live-model.mts'

export interface OpportunityProbe {
  readonly level: 'synthetic' | 'installed'
  readonly sample: LiveSample
  readonly request: {
    readonly at: number
    readonly owner: number
    readonly kind: 'video' | 'audio'
    readonly phase: 'before-dispatch' | 'started'
  } | null
  readonly evidence: {
    readonly at: number
    readonly owner: number
    readonly content: number
    readonly rate: 1 | 2
    readonly catalogLegal: boolean | null
    readonly restrictionsClear: boolean | null
    readonly authorityCurrent: boolean | null
    readonly successTimes: readonly number[] | null
    readonly demandRatio: number | null
  } | null
}
/** A tool assessment is never an authorization or a retained route index. */
export function assessOpportunity(input: OpportunityProbe) {
  if (!projectLiveSample(input.sample) || !['synthetic', 'installed'].includes(input.level))
    throw Error('Invalid opportunity sample')
  const r = input.sample,
    e = input.evidence,
    q = input.request
  const result = (status: 'known-pass' | 'known-fail' | 'unknown', reason: string) => ({
    status,
    reason,
    level: input.level,
    productActionAuthorized: false as const,
  })
  if (
    !r.qualified ||
    r.rescue ||
    !r.automatic ||
    r.candidate !== true ||
    r.bufferSec === null ||
    r.bufferSec <= 1 ||
    r.bufferSec > 4 ||
    r.reason === 'low-buffer-tail'
  )
    return result('known-fail', 'sample-not-actionable')
  if (!q || q.phase !== 'before-dispatch') return result('unknown', 'predispatch-unobserved')
  if (
    !Number.isFinite(q.at) ||
    q.at < r.at ||
    q.at - r.at > 1500 ||
    q.owner !== r.owner ||
    q.kind !== 'video'
  )
    return result('known-fail', 'request-not-current-video')
  if (!e) return result('unknown', 'alternative-unobserved')
  if (
    !Number.isFinite(e.at) ||
    e.at > r.at ||
    r.at - e.at > 1500 ||
    e.owner !== r.owner ||
    e.content !== r.content ||
    e.rate !== r.rate
  )
    return result('unknown', 'evidence-not-current')
  if ([e.catalogLegal, e.restrictionsClear, e.authorityCurrent].some((v) => v === false))
    return result('known-fail', 'alternative-disallowed')
  if (
    [e.catalogLegal, e.restrictionsClear, e.authorityCurrent].some((v) => v !== true) ||
    e.successTimes === null ||
    e.demandRatio === null
  )
    return result('unknown', 'qualification-incomplete')
  if (!Number.isFinite(e.demandRatio) || e.demandRatio < 1.35)
    return result('known-fail', 'demand-ratio-insufficient')
  if (
    e.successTimes.length > 128 ||
    e.successTimes.some((t) => !Number.isFinite(t) || t < 0 || t > r.at || r.at - t > 60000)
  )
    return result('unknown', 'success-evidence-not-fresh')
  if (new Set(e.successTimes).size < 2) return result('known-fail', 'success-evidence-insufficient')
  return result('known-pass', 'provided-readonly-conditions-match')
}

export function auditRouteObservability(input: unknown) {
  const object = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !Array.isArray(v)
  const snapshot = object(input) ? input : {},
    requested = object(snapshot.requested) ? snapshot.requested.video : null
  const identityAvailable =
    object(requested) &&
    ['generation', 'epoch', 'routePolicyRevision', 'authorityRevision'].every(
      (k) => Number.isSafeInteger(requested[k]) && Number(requested[k]) >= 0,
    ) &&
    typeof requested.representation === 'string' &&
    requested.representation.length > 0
  const plan = object(snapshot.activePlan) ? snapshot.activePlan : null
  return {
    schemaVersion: 1 as const,
    requestIdentity: identityAvailable ? 'observed' : 'unknown',
    cachedRanking:
      plan && Array.isArray(plan.ranking) && plan.ranking.length <= 12 ? 'observed' : 'unknown',
    freshAlternativeSuccesses: 'unknown',
    currentProhibitions: 'unknown',
    currentAlternativeAuthority: 'unknown',
    beforeDispatch: 'unknown',
    alternativeQualification: 'unknown',
    productActionAuthorized: false as const,
  }
}
