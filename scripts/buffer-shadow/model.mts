/** Evaluation facts, never an alternative implementation of the product's buffer algorithm. */
import { candidateScenarioNames } from './candidate-inputs.mts'

export const scenarioNames = [
  'high-stable',
  'low-stable',
  'jitter-2s',
  'short-stall-5s',
  'burst-refill',
  'drain-refill',
  'low-sawtooth',
  'slow-exhaustion',
  'fast-exhaustion',
  'sudden-loss',
  'pre-window-stall',
  'missing-frames',
  'illegal-buffer',
  'sample-gap',
  'rate-change',
  'representation-change',
  'content-change',
  'new-operation',
  'recovering',
  'media-end',
  'transport-none',
  'transport-success',
  'transport-failure',
  'transport-abort',
  'transport-duplicate',
  'transport-overflow',
  'two-hour-bounds',
  ...candidateScenarioNames,
] as const
export type ScenarioName = (typeof scenarioNames)[number]
/** Preserve each algorithm's original candidate meaning when reading old evidence. */
export function readingVersion(value: unknown): 1 | 2 | 3 | 4 | 5 | 6 | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (row.schemaVersion === 1 && row.algorithm === 'buffer-window-v1') return 1
  if (row.schemaVersion === 2 && row.algorithm === 'buffer-window-v2') return 2
  if (row.schemaVersion === 3 && row.algorithm === 'buffer-window-v3') return 3
  if (row.schemaVersion === 4 && row.algorithm === 'buffer-window-v4') return 4
  if (row.schemaVersion === 5 && row.algorithm === 'buffer-window-v5') return 5
  if (row.schemaVersion === 6 && row.algorithm === 'buffer-window-v6') return 6
  return null
}
export interface EvidenceRow {
  readonly trend?: unknown
  readonly seq: number
  readonly at: number
  readonly owner: string
  readonly candidate: boolean | null
  readonly state: string
  readonly reason: string
  readonly currentTime: number | null
  readonly frames: number | null
  readonly qualified: boolean
  readonly rate: number
}
export interface WindowAnnotation {
  readonly scoreUntil: number
  readonly stallAt: number | null
}
export interface CandidateEpisode {
  readonly start: number
  readonly end: number
  readonly evidence: readonly number[]
  readonly censored: boolean
  readonly followup: 'continued' | 'interrupted' | 'undetermined'
}
export interface WindowScore {
  readonly episodes: readonly CandidateEpisode[]
  readonly firstLeadMs: number | null
  readonly candidateMs: number
  readonly eligibleMs: number
  readonly insufficientMs: number
  readonly ineligibleMs: number
  readonly missingMs: number
  readonly candidateFraction: number | null
}
export interface CostResult {
  readonly version: string
  readonly rate: 1 | 2
  readonly validity: 'valid'
  readonly verdict: 'pass' | 'fail'
  readonly startupMs: number
  readonly tickMs: {
    readonly min: number
    readonly median: number
    readonly p95: number
    readonly max: number
    readonly samples: readonly number[]
  }
  readonly cpuMicroseconds: { readonly user: number; readonly system: number }
  readonly diagnosticClones?: { readonly calls: number; readonly rows: number }
  readonly heapBytes: {
    readonly start: number
    readonly end: number
    readonly peak: number
    readonly delta: number
  }
  readonly calibration: readonly string[]
  readonly measurementMs: number
  readonly effects: readonly unknown[]
  readonly cleanup: {
    readonly before: Readonly<Record<string, number>>
    readonly after: Readonly<Record<string, number>>
    readonly unclassified: number
    readonly callbacksAfterClose: number
  }
}
export function parseEvaluationArgs(args: readonly string[]): {
  json: boolean
  cost: boolean
  comparison?: 'v3' | 'source'
  holdout?: true
  cycleHoldout?: true
  lowBuffer?: true
  continuity?: true
} {
  if (
    new Set(args).size !== args.length ||
    args.some(
      (a) =>
        ![
          '--json',
          '--cost',
          '--cost-v3',
          '--cost-source',
          '--holdout',
          '--cycle-holdout',
          '--low-buffer',
          '--continuity',
        ].includes(a),
    ) ||
    args.filter(
      (a) =>
        a.startsWith('--cost') ||
        a === '--holdout' ||
        a === '--cycle-holdout' ||
        a === '--low-buffer' ||
        a === '--continuity',
    ).length > 1
  )
    throw Error(
      'Usage: npm run evaluate:buffer-shadow -- [--json] [--cost|--cost-v3|--cost-source|--holdout|--cycle-holdout|--low-buffer|--continuity]',
    )
  const comparison = args.includes('--cost-v3')
    ? 'v3'
    : args.includes('--cost-source')
      ? 'source'
      : undefined
  return {
    json: args.includes('--json'),
    cost: args.some((a) => a.startsWith('--cost')),
    ...(comparison ? { comparison } : {}),
    ...(args.includes('--low-buffer') ? { lowBuffer: true as const } : {}),
    ...(args.includes('--continuity') ? { continuity: true as const } : {}),
    ...(args.includes('--holdout') ? { holdout: true as const } : {}),
    ...(args.includes('--cycle-holdout') ? { cycleHoldout: true as const } : {}),
  }
}

/** Additional timing facts; no merging of candidate pulses or reinterpretation of old scores. */
export function candidateContinuity(rows: readonly EvidenceRow[], annotation: WindowAnnotation) {
  const score = scoreWindow(rows, annotation)
  const candidates = rows.filter((r) => r.at <= annotation.scoreUntil && r.candidate === true)
  return Object.freeze({
    firstLeadMs: score.firstLeadMs,
    lastCandidateLeadMs:
      candidates.length && annotation.stallAt !== null
        ? annotation.stallAt - candidates.at(-1)!.at
        : null,
    candidateGapsMs: score.episodes.slice(1).map((e, i) => e.start - score.episodes[i]!.end),
    externallyAnnotatedStallAt: annotation.stallAt,
  })
}

/** A complete followup must belong to one owner. No interpolation of missing evidence. */
function followup(rows: readonly EvidenceRow[], start: number): CandidateEpisode['followup'] {
  const first = rows[start]!,
    end = first.at + 15000
  let last = first,
    interruptionStart: number | null = null,
    interrupted = false
  for (let i = start + 1; i < rows.length; i++) {
    const next = rows[i]!
    if (
      next.owner !== first.owner ||
      next.at - last.at > 1500 ||
      !next.qualified ||
      !last.qualified
    )
      return 'undetermined'
    const advanced =
      next.currentTime !== null &&
      last.currentTime !== null &&
      next.currentTime - last.currentTime > 0.05 &&
      (next.frames === null || last.frames === null || next.frames > last.frames)
    if (advanced) interruptionStart = null
    else {
      interruptionStart ??= last.at
      if (next.at - interruptionStart >= 2000) interrupted = true
    }
    if (next.at >= end) return interrupted ? 'interrupted' : 'continued'
    last = next
  }
  return 'undetermined'
}

export function scoreWindow(
  rows: readonly EvidenceRow[],
  annotation: WindowAnnotation,
): WindowScore {
  if (
    !Number.isFinite(annotation.scoreUntil) ||
    annotation.scoreUntil < 0 ||
    (annotation.stallAt !== null &&
      (!Number.isFinite(annotation.stallAt) || annotation.stallAt < 0))
  )
    throw Error('Invalid evidence annotation')
  let previousAt = -1,
    previousSeq = -1
  for (const row of rows) {
    const trend = row.trend as
      | {
          cycle?: { netLossSec?: unknown; lastLossAgeMs?: unknown; creditMs?: unknown }
          lowBuffer?: {
            basis?: unknown
            creditMs?: unknown
            declineCoverageMs?: unknown
            tailUsed?: unknown
          }
          endBufferSec?: unknown
        }
      | undefined
    const cycle = trend?.cycle
    const low = trend?.lowBuffer
    const lowCandidate =
      (readingVersion(row.trend) === 5 || readingVersion(row.trend) === 6) &&
      low?.creditMs === 2000 &&
      typeof trend?.endBufferSec === 'number' &&
      Number.isFinite(trend.endBufferSec) &&
      trend.endBufferSec >= 0 &&
      trend.endBufferSec <= 4 &&
      ((row.reason === 'low-buffer-steady' &&
        low.basis === 'steady-decline' &&
        low.declineCoverageMs === 8000) ||
        ((row.reason === 'low-buffer-cycle' ||
          (readingVersion(row.trend) === 6 &&
            row.reason === 'low-buffer-tail' &&
            low.tailUsed === true &&
            typeof low.declineCoverageMs === 'number' &&
            low.declineCoverageMs >= 2000 &&
            trend.endBufferSec > 0 &&
            trend.endBufferSec <= 1)) &&
          low.basis === 'partial-cycle' &&
          typeof cycle?.netLossSec === 'number' &&
          cycle.netLossSec > 0 &&
          cycle.netLossSec <= 2 &&
          typeof cycle.lastLossAgeMs === 'number' &&
          cycle.lastLossAgeMs >= 0 &&
          cycle.lastLossAgeMs <= 8000))
    const cycleCandidate =
      [4, 5, 6].includes(readingVersion(row.trend) ?? 0) &&
      row.reason === 'cycle-draining-low' &&
      cycle?.netLossSec === 2 &&
      cycle.creditMs === 2000 &&
      typeof cycle?.lastLossAgeMs === 'number' &&
      Number.isFinite(cycle.lastLossAgeMs) &&
      cycle.lastLossAgeMs >= 0 &&
      cycle.lastLossAgeMs <= 8000
    if (
      !Number.isFinite(row.at) ||
      row.at <= previousAt ||
      !Number.isSafeInteger(row.seq) ||
      row.seq < 1 ||
      row.seq <= previousSeq ||
      typeof row.owner !== 'string' ||
      !/^owner-[0-9]+$/.test(row.owner) ||
      typeof row.qualified !== 'boolean' ||
      !['insufficient', 'ineligible', 'stable', 'filling', 'draining'].includes(row.state) ||
      typeof row.reason !== 'string' ||
      !/^[a-z0-9-]{1,64}$/.test(row.reason) ||
      (row.candidate === null) !== ['insufficient', 'ineligible'].includes(row.state) ||
      (row.candidate === true &&
        row.state !== 'draining' &&
        !(['stable', 'filling'].includes(row.state) && (cycleCandidate || lowCandidate))) ||
      !Number.isFinite(row.rate) ||
      row.rate <= 0 ||
      (row.candidate !== null && typeof row.candidate !== 'boolean') ||
      (row.currentTime !== null && !Number.isFinite(row.currentTime)) ||
      (row.frames !== null && (!Number.isSafeInteger(row.frames) || row.frames < 0))
    )
      throw Error('Invalid evidence row')
    previousAt = row.at
    previousSeq = row.seq
  }
  const episodes: CandidateEpisode[] = []
  let open: { start: number; index: number; end: number; evidence: number[] } | null = null
  let candidateMs = 0,
    eligibleMs = 0,
    insufficientMs = 0,
    ineligibleMs = 0,
    missingMs = 0
  const close = (at: number, censored: boolean) => {
    if (!open) return
    episodes.push({
      start: open.start,
      end: at,
      evidence: open.evidence.slice(),
      censored,
      followup: followup(rows, open.index),
    })
    open = null
  }
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!,
      previous = rows[i - 1]
    if (row.at > annotation.scoreUntil) break
    const gap = previous && row.at - previous.at > 1500
    const ownerChanged = previous && row.owner !== previous.owner
    if (open && (gap || ownerChanged || row.candidate === null))
      close(gap || ownerChanged ? previous!.at : row.at, true)
    if (row.candidate === false) close(row.at, false)
    if (row.candidate === true) {
      open ??= { start: row.at, index: i, end: row.at, evidence: [] }
      open.end = row.at
      open.evidence.push(row.seq)
    }
    const next = rows[i + 1]
    const until = Math.min(next?.at ?? row.at, annotation.scoreUntil),
      span = until - row.at
    if (span <= 0) continue
    if (!next || next.at - row.at > 1500 || next.owner !== row.owner) missingMs += span
    else if (row.candidate === null) {
      if (row.state === 'ineligible') ineligibleMs += span
      else insufficientMs += span
    } else {
      eligibleMs += span
      if (row.candidate) candidateMs += span
    }
  }
  if (open) close(open.end, true)
  return Object.freeze({
    episodes,
    firstLeadMs:
      episodes.length && annotation.stallAt !== null
        ? annotation.stallAt - episodes[0]!.start
        : null,
    candidateMs,
    eligibleMs,
    insufficientMs,
    ineligibleMs,
    missingMs,
    candidateFraction: eligibleMs ? candidateMs / eligibleMs : null,
  })
}
