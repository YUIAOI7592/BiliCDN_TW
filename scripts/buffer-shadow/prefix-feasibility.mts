import { projectLiveSample } from './live-model.mts'
import type { LiveSample } from './live-model.mts'

export interface PrefixInput {
  readonly exhaustion: readonly LiveSample[]
  readonly normal: readonly LiveSample[]
  readonly from: number
  readonly depletionMs: number
  readonly minimumLeadMs: number
}

export interface PrefixResult {
  readonly validity: 'valid' | 'invalid'
  readonly feasible: boolean | null
  readonly sharedThroughMs: number | null
  readonly earliestAllowedMs: number | null
  readonly maximumLeadMs: number | null
  readonly deadlineMs: number | null
  readonly blockedBySharedPrefix: number
  readonly blockedByRefill: number
}

/** Feasibility of sampled decisions, not another candidate algorithm or a product authorization. */
export function assessPrefixFeasibility(input: PrefixInput): PrefixResult {
  const invalid = (): PrefixResult => ({
    validity: 'invalid',
    feasible: null,
    sharedThroughMs: null,
    earliestAllowedMs: null,
    maximumLeadMs: null,
    deadlineMs: null,
    blockedBySharedPrefix: 0,
    blockedByRefill: 0,
  })
  const { exhaustion, normal, from, depletionMs, minimumLeadMs } = input
  if (
    ![from, depletionMs, minimumLeadMs].every(Number.isFinite) ||
    from < 0 ||
    depletionMs <= 0 ||
    minimumLeadMs < 0 ||
    exhaustion.length < 2 ||
    exhaustion.length > 512 ||
    normal.length !== exhaustion.length
  )
    return invalid()
  const end = from + depletionMs
  if (!Number.isFinite(end) || exhaustion[0]!.at > from || exhaustion.at(-1)!.at < end)
    return invalid()
  if (
    [exhaustion, normal].some((rows) =>
      rows.some((r, i) => !Number.isFinite(r.at) || (i > 0 && r.at <= rows[i - 1]!.at)),
    )
  )
    return invalid()
  const keys = [
    'at',
    'owner',
    'content',
    'rate',
    'bufferSec',
    'currentTime',
    'frames',
    'qualified',
    'rescue',
    'automatic',
    'quality',
  ] as const
  let shared = true,
    sharedThroughMs: number | null = null,
    earliestAllowedMs: number | null = null,
    feasible = false,
    blockedBySharedPrefix = 0,
    blockedByRefill = 0
  for (let i = 0; i < exhaustion.length; i++) {
    const r = exhaustion[i]!,
      n = normal[i]!,
      before = exhaustion[i - 1],
      normalBefore = normal[i - 1]
    if (r.at > end) break
    if (
      !projectLiveSample(r) ||
      !projectLiveSample(n) ||
      r.at !== n.at ||
      r.owner !== n.owner ||
      r.content !== n.content ||
      r.rate !== n.rate ||
      (before && r.at <= before.at)
    )
      return invalid()
    if (
      [r, n].some(
        (s) =>
          s.quality !== 'valid' ||
          (r.at >= from &&
            (!s.qualified ||
              s.rescue ||
              !s.automatic ||
              s.bufferSec === null ||
              s.currentTime === null)),
      ) ||
      (before &&
        (r.at - before.at > 1500 ||
          r.owner !== before.owner ||
          r.content !== before.content ||
          r.rate !== before.rate ||
          n.owner !== normalBefore!.owner ||
          n.content !== normalBefore!.content ||
          n.rate !== normalBefore!.rate))
    )
      return invalid()
    if (
      r.at > from &&
      normalBefore &&
      (n.currentTime === null ||
        normalBefore.currentTime === null ||
        n.currentTime - normalBefore.currentTime <= 0.05 ||
        (n.frames !== null && normalBefore.frames !== null && n.frames <= normalBefore.frames))
    )
      return invalid()
    if (keys.some((k) => r[k] !== n[k])) shared = false
    if (r.at < from) continue
    const relative = r.at - from
    if (shared) {
      sharedThroughMs = relative
      blockedBySharedPrefix++
      continue
    }
    if (
      !before ||
      before.bufferSec === null ||
      r.bufferSec === null ||
      r.bufferSec >= before.bufferSec
    ) {
      blockedByRefill++
      continue
    }
    if (
      r.bufferSec <= 0 ||
      r.currentTime === null ||
      before.currentTime === null ||
      r.currentTime - before.currentTime <= 0.05 ||
      (r.frames !== null && before.frames !== null && r.frames <= before.frames)
    )
      continue
    earliestAllowedMs ??= relative
    if (relative <= depletionMs - minimumLeadMs) feasible = true
  }
  return {
    validity: 'valid',
    feasible,
    sharedThroughMs,
    earliestAllowedMs,
    maximumLeadMs: earliestAllowedMs === null ? null : depletionMs - earliestAllowedMs,
    deadlineMs: depletionMs - minimumLeadMs,
    blockedBySharedPrefix,
    blockedByRefill,
  }
}
