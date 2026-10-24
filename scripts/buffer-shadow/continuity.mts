import { scoreWindow } from './model.mts'
import type { EvidenceRow, WindowAnnotation } from './model.mts'

export interface ContinuityInterval {
  readonly from: number
  readonly to: number
  readonly ms: number
}
/** Evidence intervals, not an alternative candidate algorithm. Unknown intervals are censored. */
export function measureContinuity(rows: readonly EvidenceRow[], annotation: WindowAnnotation) {
  const score = scoreWindow(rows, annotation)
  const until = Math.min(annotation.scoreUntil, annotation.stallAt ?? annotation.scoreUntil)
  const intervals: ContinuityInterval[] = []
  let open: { from: number; to: number; owner: string } | null = null
  let hasCandidate = false,
    priorOwner: string | null = null
  let lastContinuousCandidateAt: number | null = null
  let prefixMs = 0,
    lateFalseMs = 0,
    lateEligibleMs = 0,
    lateUnknownMs = 0
  const close = () => {
    if (open) intervals.push({ from: open.from, to: open.to, ms: open.to - open.from })
    open = null
  }
  for (let i = 0; i + 1 < rows.length; i++) {
    const row = rows[i]!,
      next = rows[i + 1]!
    if (row.at >= until) break
    const end = Math.min(next.at, until),
      span = end - row.at
    const valid =
      row.owner === next.owner &&
      span > 0 &&
      next.at - row.at <= 1500 &&
      row.qualified &&
      row.candidate !== null
    if (priorOwner !== row.owner) {
      close()
      hasCandidate = false
      lastContinuousCandidateAt = null
    }
    priorOwner = row.owner
    const late = Math.max(0, end - Math.max(row.at, until - 15000))
    if (!valid) {
      close()
      hasCandidate = false
      lastContinuousCandidateAt = null
      lateUnknownMs += late
      continue
    }
    lateEligibleMs += late
    if (row.candidate) {
      close()
      hasCandidate = true
      lastContinuousCandidateAt = row.at
    } else {
      lateFalseMs += late
      if (!hasCandidate) prefixMs += span
      else if (open && open.to === row.at && open.owner === row.owner) open.to = end
      else {
        close()
        open = { from: row.at, to: end, owner: row.owner }
      }
    }
  }
  close()
  const tail = intervals.at(-1)
  const last = rows.filter((r) => r.at < until).at(-1)
  const endpoint = rows.find((r) => r.at === until)
  const endCovered =
    !!last &&
    !!endpoint &&
    endpoint.owner === last.owner &&
    until - last.at <= 1500 &&
    last.qualified &&
    last.candidate !== null
  return Object.freeze({
    firstLeadMs: score.firstLeadMs,
    lastCandidateLeadMs:
      annotation.stallAt !== null && endCovered && lastContinuousCandidateAt !== null
        ? annotation.stallAt - lastContinuousCandidateAt
        : null,
    candidateMs: score.candidateMs,
    candidateEpisodes: score.episodes.length,
    gaps: Object.freeze(intervals.map(Object.freeze)),
    maximumGapMs: intervals.length ? Math.max(...intervals.map((i) => i.ms)) : 0,
    terminalFalseMs:
      annotation.stallAt === null || !endCovered || !hasCandidate
        ? null
        : tail?.to === until
          ? tail.ms
          : 0,
    beforeFirstOrAfterCensorMs: prefixMs,
    late15: Object.freeze({
      eligibleMs: lateEligibleMs,
      falseMs: lateFalseMs,
      unknownMs: lateUnknownMs,
    }),
  })
}

export function revocationAt(
  rows: readonly EvidenceRow[],
  at: number,
): {
  readonly validity: 'valid' | 'invalid'
  readonly lagMs: number | null
} {
  scoreWindow(rows, { scoreUntil: rows.at(-1)?.at ?? 0, stallAt: null })
  const index = rows.findIndex((r) => r.at === at)
  const initial = rows[index]
  if (!initial || !initial.qualified || initial.candidate === null)
    return { validity: 'invalid', lagMs: null }
  for (let i = index; i < rows.length; i++) {
    const row = rows[i]!,
      previous = rows[i - 1]
    if (
      row.owner !== initial.owner ||
      !row.qualified ||
      row.candidate === null ||
      (i > index && previous && row.at - previous.at > 1500)
    )
      return { validity: 'invalid', lagMs: null }
    if (row.candidate === false) return { validity: 'valid', lagMs: row.at - at }
  }
  return { validity: 'invalid', lagMs: null }
}
