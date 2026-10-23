/** Evaluation facts, never an alternative implementation of the product's buffer algorithm. */
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
] as const
export type ScenarioName = (typeof scenarioNames)[number]
export interface EvidenceRow {
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
export function parseEvaluationArgs(args: readonly string[]) {
  if (new Set(args).size !== args.length || args.some((a) => a !== '--json' && a !== '--cost'))
    throw Error('Usage: npm run evaluate:buffer-shadow -- [--json] [--cost]')
  return { json: args.includes('--json'), cost: args.includes('--cost') }
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
    if (
      !Number.isFinite(row.at) ||
      row.at <= previousAt ||
      !Number.isSafeInteger(row.seq) ||
      row.seq <= previousSeq ||
      !row.owner ||
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
    if (open && (gap || ownerChanged || row.candidate === null)) close(previous!.at, true)
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
