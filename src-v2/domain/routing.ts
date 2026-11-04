import { evidenceMetrics } from './evidence.ts'
import {
  orderCapacityRows,
  adequateCapacity,
  recentCapacity,
  ROUTE_HEADROOM,
} from './route-capacity.ts'
import type {
  Clock,
  CompletionBudget,
  DecisionId,
  PlaybackDemand,
  RestrictionReason,
  RouteCandidate,
  RouteDecision,
  RouteEvidence,
  RouteRankingEntry,
  RouteType,
} from './model.ts'

export interface RestrictionSnapshot {
  readonly disabledCatalogHosts: ReadonlySet<string>
  readonly defaultUnavailableHosts: ReadonlySet<string>
  readonly blackHosts: ReadonlySet<string>
  readonly deadHosts: ReadonlySet<string>
  readonly hostLocked: ReadonlySet<string>
}

export interface RankRoutesInput {
  readonly completionBudget?: CompletionBudget | null
  readonly candidates: readonly RouteCandidate[]
  readonly evidenceFor: (host: string, kind: 'video' | 'audio') => RouteEvidence | null
  readonly restrictions: RestrictionSnapshot
  readonly demand: PlaybackDemand
  readonly fixedHost: string | null
  readonly current: { readonly type: RouteType; readonly host: string } | null
  readonly boundary:
    | 'startup'
    | 'new-epoch'
    | 'representation'
    | 'request'
    | 'verified-failure'
    | 'watchdog'
    | 'user-setting'
  readonly failedHost: string | null
}

const restrictionReasons = (
  candidate: RouteCandidate,
  input: RankRoutesInput,
  now: number,
): RestrictionReason[] => {
  const reasons: RestrictionReason[] = []
  const host = candidate.host
  if (input.restrictions.disabledCatalogHosts.has(host)) reasons.push('catalog-disabled')
  if (input.restrictions.defaultUnavailableHosts.has(host)) reasons.push('default-unavailable')
  if (input.restrictions.blackHosts.has(host)) reasons.push('black')
  if (input.restrictions.deadHosts.has(host)) reasons.push('dead')
  if (input.restrictions.hostLocked.has(host)) reasons.push('host-lock')
  if (
    input.failedHost === host &&
    (input.boundary === 'verified-failure' || input.boundary === 'watchdog')
  )
    reasons.push('circuit-open')
  const evidence = input.evidenceFor(host, candidate.kind)
  if (evidence && evidence.circuitUntil > now) reasons.push('circuit-open')
  return [...new Set(reasons)]
}

export const assessDemandRatio = (
  ratio: number | null,
): 'unknown' | 'below-required' | 'meets-headroom' =>
  ratio === null || !Number.isFinite(ratio)
    ? 'unknown'
    : ratio < ROUTE_HEADROOM
      ? 'below-required'
      : 'meets-headroom'

export const rankRoutes = (input: RankRoutesInput, now: number): readonly RouteRankingEntry[] => {
  const entries = input.candidates.map((candidate, candidateOrder) => {
    const reasons = restrictionReasons(candidate, input, now)
    const metrics = evidenceMetrics(
      input.evidenceFor(candidate.host, candidate.kind),
      now,
      input.completionBudget?.timingBasis,
    )
    return Object.freeze({
      candidate,
      candidateOrder,
      state: reasons.length ? 'forbidden' : metrics.state,
      eligible: reasons.length === 0,
      reasons: Object.freeze(reasons),
      safeThroughputMbps: metrics.safeThroughputMbps,
      demandRatio:
        metrics.safeThroughputMbps === null
          ? null
          : metrics.safeThroughputMbps / Math.max(0.001, input.demand.requiredMbps),
      medianTtfbMs: metrics.medianTtfbMs,
      successCount: metrics.successCount,
      failureCount: metrics.failureCount,
      capacityConfidence: metrics.capacityConfidence,
      freshSpeedCount: metrics.freshSpeedCount,
      newestSpeedAt: metrics.newestSpeedAt,
      safePayloadMbps: metrics.safePayloadMbps,
      predictionTtfbMs: metrics.predictionTtfbMs,
    })
  })
  const ranked = orderCapacityRows(entries, input.completionBudget, now)
  return Object.freeze(
    [...ranked].sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1
      const fixedA = input.fixedHost === a.candidate.host,
        fixedB = input.fixedHost === b.candidate.host
      return Number(fixedB) - Number(fixedA)
    }),
  )
}

/** A current legal route remains stable unless fresh inadequacy has a fresh adequate replacement. */
export function retainedRoute(
  input: RankRoutesInput,
  ranking: readonly RouteRankingEntry[],
): RouteRankingEntry | undefined {
  if (
    !input.current ||
    ['verified-failure', 'watchdog', 'user-setting', 'new-epoch'].includes(input.boundary)
  )
    return
  const current = ranking.find((row) => row.eligible && row.candidate.host === input.current!.host)
  const fixed = ranking.find((row) => row.eligible && row.candidate.host === input.fixedHost)
  if (!current || (fixed && fixed.candidate.host !== current.candidate.host)) return
  if (
    recentCapacity(current) &&
    (current.demandRatio ?? 0) < ROUTE_HEADROOM &&
    ranking.some(
      (row) =>
        row.eligible && row.candidate.host !== current.candidate.host && adequateCapacity(row),
    )
  )
    return
  return current
}
export const chooseRoute = (
  input: RankRoutesInput,
  clock: Clock,
  id: DecisionId,
  rows?: readonly RouteRankingEntry[],
): RouteDecision => {
  const ranking = rows ?? rankRoutes(input, clock.now())
  const fixed = ranking.find((row) => row.eligible && row.candidate.host === input.fixedHost)
  const retained = retainedRoute(input, ranking)
  const selected = fixed ?? retained ?? ranking.find((row) => row.eligible)
  if (!selected) {
    const first = ranking[0]
    return {
      action: 'block',
      id,
      reason: first?.reasons[0] ?? 'invalid-url',
      routeType: first?.candidate.type ?? 'root-original',
      host: first?.candidate.host ?? null,
      ranking,
    }
  }
  const candidate = selected.candidate
  const reason = fixed
    ? 'fixed'
    : retained
      ? adequateCapacity(retained)
        ? 'healthy-affinity'
        : 'retained-unverified'
      : selected.capacityConfidence === 'sufficient'
        ? 'proven'
        : selected.capacityConfidence === 'provisional'
          ? 'recent-success'
          : selected.capacityConfidence === 'historical'
            ? 'historical-estimate'
            : selected.capacityConfidence === 'revalidation'
              ? 'revalidation-fallback'
              : 'unverified-fallback'
  if (candidate.type === 'root-original')
    return {
      action: 'pass',
      target: { type: 'selected-original', candidate },
      id,
      reason,
      routeType: 'root-original',
      host: candidate.host,
      ranking,
    }
  return {
    action: 'rewrite',
    id,
    reason,
    routeType: candidate.type,
    host: candidate.host,
    candidate,
    ranking,
  }
}
