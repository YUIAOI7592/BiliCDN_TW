import type { RouteDecision, RouteRankingEntry } from '../../domain/route-model.ts'
import type { EvidenceMetrics, RouteEvidence } from '../../domain/evidence-model.ts'
import { EVIDENCE_TTL_MS } from '../../domain/evidence.ts'
import {
  completionReason,
  predictCompletionMs,
  type CompletionBudget,
} from '../../domain/route-completion.ts'
import type { CurrentRouteCapacity, RoutePlanSummary } from './route-contracts.ts'

export function planSummary(decision: RouteDecision): RoutePlanSummary {
  return Object.freeze({
    id: decision.id,
    action: decision.action,
    reason: decision.reason,
    routeType: decision.routeType,
    host: decision.host,
  })
}

export function rankingSummary(ranking: readonly RouteRankingEntry[]) {
  return Object.freeze(
    ranking.slice(0, 12).map((row) =>
      Object.freeze({
        host: row.candidate.host,
        type: row.candidate.type,
        state: row.state,
        eligible: row.eligible,
        reasons: row.reasons,
        safeMbps: row.safeThroughputMbps,
        ratio: row.demandRatio,
        ttfbMs: row.medianTtfbMs,
      }),
    ),
  )
}

/** Numeric assembly only; ownership checks and fresh external reads stay with the coordinator. */
export function capacityNumbers(
  evidence: RouteEvidence | null,
  metrics: EvidenceMetrics,
  now: number,
  budget: CompletionBudget | null,
  requestBytes: number | null,
) {
  const speed = metrics.safeThroughputMbps
  const estimatedCompletionMs = budget
    ? predictCompletionMs(budget.requestBytes, metrics.safePayloadMbps, metrics.predictionTtfbMs)
    : null
  const unavailable = completionReason(
    budget ?? { requestBytes, playableBufferSec: null, sampledAt: now },
    now,
  )
  const predictionReason: CurrentRouteCapacity['predictionReason'] =
    estimatedCompletionMs !== null
      ? 'available'
      : unavailable === 'available'
        ? 'unknown-body-rate'
        : unavailable
  const safeMbps = speed !== null && Number.isFinite(speed) && speed > 0 ? speed : null
  const speeds =
    evidence?.samples.filter(
      (sample) =>
        sample.outcome === 'success' &&
        sample.throughputMbps !== null &&
        Number.isFinite(sample.throughputMbps) &&
        sample.throughputMbps > 0,
    ) ?? []
  const sampleStatus: CurrentRouteCapacity['sampleStatus'] =
    safeMbps !== null
      ? 'available'
      : speeds.length > 0 && speeds.every((sample) => now - sample.at > EVIDENCE_TTL_MS)
        ? 'expired'
        : 'missing'
  return { estimatedCompletionMs, predictionReason, safeMbps, speeds, sampleStatus }
}
