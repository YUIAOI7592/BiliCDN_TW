import type { TimingBasis } from '../../domain/measurement-time.ts'
import type {
  FailureKind,
  CapacityConfidence,
  EvidenceMetrics,
} from '../../domain/evidence-model.ts'
import { orderCapacityRows, type ComparedCapacity } from '../../domain/route-capacity.ts'
import type { CompletionBudget } from '../../domain/route-completion.ts'
import type { AppliedRouteDecision, StartupCandidate } from '../routing/route-contracts.ts'
import type { RangeProbeResult } from './measurement-contracts.ts'
export interface ProbeResult {
  readonly timingBasis?: TimingBasis
  readonly speedEligible?: boolean
  readonly candidate: StartupCandidate
  readonly valid: boolean
  readonly safeMbps: number | null
  readonly capacityConfidence: CapacityConfidence
  readonly safePayloadMbps: number | null
  readonly predictionTtfbMs: number | null
  readonly bytes: number
  readonly elapsedMs: number
  readonly ttfbMs: number | null
  readonly status: number | null
  readonly reason: string
}

export function probeResultUsable(candidate: StartupCandidate, result: RangeProbeResult): boolean {
  return (
    result.directRange &&
    Number.isSafeInteger(result.bytes) &&
    Number.isFinite(result.elapsedMs) &&
    (candidate.cachedSafeMbps !== null ||
      (result.elapsedMs > 0 && result.speedEligible !== false)) &&
    result.payloadValid !== false &&
    (candidate.cachedSafeMbps !== null ? result.bytes >= 16 * 1024 : result.bytes >= 64 * 1024)
  )
}
export function evaluatedProbeResult(
  candidate: StartupCandidate,
  result: RangeProbeResult,
  rangeValid: boolean,
  metrics: EvidenceMetrics | null,
): ProbeResult {
  const valid =
    rangeValid &&
    !!metrics &&
    ['sufficient', 'provisional'].includes(metrics.capacityConfidence) &&
    metrics.safeThroughputMbps !== null
  return {
    candidate,
    ...result,
    valid,
    safeMbps: valid ? metrics!.safeThroughputMbps : null,
    capacityConfidence: metrics?.capacityConfidence ?? 'missing',
    safePayloadMbps: metrics?.safePayloadMbps ?? null,
    predictionTtfbMs: metrics?.predictionTtfbMs ?? null,
    reason: result.directRange ? (valid ? 'measured' : 'short-response') : result.reason,
  }
}
interface StartupRankRow extends ComparedCapacity {
  readonly result: ProbeResult
}
export function rankStartupResults(
  rows: readonly StartupRankRow[],
  qualified: readonly ProbeResult[],
  budget: CompletionBudget | null,
  now: number,
) {
  const ordered = orderCapacityRows(rows, budget, now).map((row) => row.result)
  const compare = (a: ProbeResult, b: ProbeResult) => ordered.indexOf(a) - ordered.indexOf(b)
  const ranked = [...qualified].sort(compare)
  const fastestValid = rows.map((row) => row.result).sort(compare)[0]?.candidate ?? null
  return { ranked, fastestValid, compare }
}
export function classifyProbeOutcome(applied: AppliedRouteDecision, result: RangeProbeResult) {
  const ok = result.directRange && result.payloadValid !== false && result.bytes >= 64 * 1024
  const failure: FailureKind | null =
    applied.decision.routeType === 'native-signed' && [403, 451, 959].includes(result.status ?? 0)
      ? 'native-invalid'
      : result.reason === 'timeout'
        ? 'timeout'
        : result.reason === 'network'
          ? 'network'
          : null

  return { ok, failure }
}
