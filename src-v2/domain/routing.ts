import { evidenceMetrics } from './evidence.ts'
import type {
  CatalogCandidate, Clock, DecisionId, PlaybackDemand, RestrictionReason, RouteCandidate, RouteDecision,
  RouteEvidence, RouteRankingEntry, RouteType,
} from './model.ts'

export interface RestrictionSnapshot {
  readonly disabledCatalogHosts: ReadonlySet<string>
  readonly defaultUnavailableHosts: ReadonlySet<string>
  readonly blackHosts: ReadonlySet<string>
  readonly deadHosts: ReadonlySet<string>
  readonly hostLocked: ReadonlySet<string>
}

export interface RankRoutesInput {
  readonly candidates: readonly RouteCandidate[]
  readonly evidenceFor: (host: string, kind: 'video' | 'audio') => RouteEvidence | null
  readonly restrictions: RestrictionSnapshot
  readonly demand: PlaybackDemand
  readonly fixedHost: string | null
  readonly current: { readonly type: RouteType; readonly host: string } | null
  readonly boundary: 'startup' | 'new-epoch' | 'representation' | 'request' | 'verified-failure' | 'watchdog' | 'user-setting'
  readonly failedHost: string | null
}

const restrictionReasons = (candidate: RouteCandidate, input: RankRoutesInput, now: number): RestrictionReason[] => {
  const reasons: RestrictionReason[] = []
  const host = candidate.host
  if (input.restrictions.disabledCatalogHosts.has(host)) reasons.push('catalog-disabled')
  if (input.restrictions.defaultUnavailableHosts.has(host)) reasons.push('default-unavailable')
  if (input.restrictions.blackHosts.has(host)) reasons.push('black')
  if (input.restrictions.deadHosts.has(host)) reasons.push('dead')
  if (input.restrictions.hostLocked.has(host)) reasons.push('host-lock')
  if (input.failedHost === host && (input.boundary === 'verified-failure' || input.boundary === 'watchdog')) reasons.push('circuit-open')
  const evidence = input.evidenceFor(host, candidate.kind)
  if (evidence && evidence.circuitUntil > now) reasons.push('circuit-open')
  return [...new Set(reasons)]
}

const stateRank = (state: RouteRankingEntry['state']): number => ({
  proven: 5, usable: 4, unknown: 3, degraded: 2, 'circuit-open': 1, forbidden: 0,
})[state]

export const rankRoutes = (input: RankRoutesInput, now: number): readonly RouteRankingEntry[] => {
  const entries = input.candidates.map(candidate => {
    const reasons = restrictionReasons(candidate, input, now)
    const metrics = evidenceMetrics(input.evidenceFor(candidate.host, candidate.kind), now)
    const state = reasons.length ? 'forbidden' : metrics.state
    return Object.freeze({
      candidate,
      state,
      eligible: reasons.length === 0,
      reasons: Object.freeze(reasons),
      safeThroughputMbps: metrics.safeThroughputMbps,
      demandRatio: metrics.safeThroughputMbps === null ? null : metrics.safeThroughputMbps / Math.max(0.001, input.demand.requiredMbps),
      medianTtfbMs: metrics.medianTtfbMs,
      successCount: metrics.successCount,
      failureCount: metrics.failureCount,
    }) satisfies RouteRankingEntry
  })
  return Object.freeze(entries.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1
    const fixedA = input.fixedHost === a.candidate.host
    const fixedB = input.fixedHost === b.candidate.host
    if (fixedA !== fixedB) return fixedA ? -1 : 1
    const sufficientA = (a.demandRatio ?? 0) >= 1.35
    const sufficientB = (b.demandRatio ?? 0) >= 1.35
    if (sufficientA !== sufficientB) return sufficientA ? -1 : 1
    if (stateRank(a.state) !== stateRank(b.state)) return stateRank(b.state) - stateRank(a.state)
    if ((a.demandRatio ?? -1) !== (b.demandRatio ?? -1)) return (b.demandRatio ?? -1) - (a.demandRatio ?? -1)
    if ((a.medianTtfbMs ?? Number.MAX_SAFE_INTEGER) !== (b.medianTtfbMs ?? Number.MAX_SAFE_INTEGER)) {
      return (a.medianTtfbMs ?? Number.MAX_SAFE_INTEGER) - (b.medianTtfbMs ?? Number.MAX_SAFE_INTEGER)
    }
    return a.candidate.catalogIndex - b.candidate.catalogIndex
  }))
}

export const chooseRoute = (input: RankRoutesInput, clock: Clock, id: DecisionId): RouteDecision => {
  const ranking = rankRoutes(input, clock.now())
  const current = input.current && ranking.find(row => row.eligible && row.candidate.host === input.current?.host)
  const healthyBoundary = input.boundary !== 'verified-failure' && input.boundary !== 'watchdog' && input.boundary !== 'user-setting'
  if (current && healthyBoundary && input.boundary !== 'new-epoch') {
    const candidate = current.candidate
    if (candidate.type === 'root-original') return { action: 'pass', id, reason: 'healthy-affinity', routeType: 'root-original', host: candidate.host, ranking }
    return { action: 'rewrite', id, reason: 'healthy-affinity', routeType: candidate.type, host: candidate.host, candidate, ranking }
  }
  const fixed = input.fixedHost ? ranking.find(row => row.eligible && row.candidate.host === input.fixedHost) : null
  const selected = fixed ?? ranking.find(row => row.eligible && row.candidate.type !== 'root-original' && (
    row.state === 'proven' && (row.demandRatio ?? 0) >= 1.35
  )) ?? ranking.find(row => row.eligible && row.candidate.type !== 'root-original' && row.successCount > 0)
    ?? ranking.find(row => row.eligible && row.candidate.type === 'catalog-generated')
    ?? ranking.find(row => row.eligible && row.candidate.type === 'root-original')
  if (!selected) {
    const first = ranking[0]
    return { action: 'block', id, reason: first?.reasons[0] ?? 'invalid-url', routeType: first?.candidate.type ?? 'root-original', host: first?.candidate.host ?? null, ranking }
  }
  if (selected.candidate.type === 'root-original') {
    return { action: 'pass', id, reason: 'root-fallback', routeType: 'root-original', host: selected.candidate.host, ranking }
  }
  return { action: 'rewrite', id, reason: fixed ? 'fixed' : selected.state === 'proven' ? 'proven' : selected.successCount ? 'recent-success' : 'catalog-default',
    routeType: selected.candidate.type, host: selected.candidate.host, candidate: selected.candidate as CatalogCandidate | Extract<RouteCandidate, {type: 'native-signed'}>, ranking }
}
