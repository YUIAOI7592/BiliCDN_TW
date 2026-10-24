/** Read-only evidence contracts. No product action or candidate calculation lives here. */
export const liveReasons = Object.freeze([
  'warming-up',
  'invalid-sample',
  'sample-gap',
  'time-reversed',
  'sample-overflow',
  'context-changed',
  'stopped',
  'reset',
  'no-progress',
  'unavailable',
  'paused',
  'seeking',
  'dragging',
  'hidden',
  'disabled',
  'original-comparison',
  'error',
  'ended',
  'buffered-to-end',
  'recovering',
  'stable',
  'filling',
  'draining-low',
  'draining-high',
  'candidate-confirming',
  'partial-refill',
  'not-decreasing',
  'above-prior-low',
  'candidate-repaid',
  'candidate-expired',
  'cycle-draining-low',
  'cycle-loss-confirming',
  'refill-cycle-balanced',
  'cycle-range-pending',
  'low-buffer-confirming',
  'low-buffer-steady',
  'low-buffer-cycle',
  'low-buffer-tail',
  'low-buffer-tail-used',
])
export interface LiveSample {
  readonly at: number
  readonly owner: number
  readonly content: number
  readonly rate: 1 | 2
  readonly candidate: boolean | null
  readonly reason: string
  readonly bufferSec: number | null
  readonly currentTime: number | null
  readonly frames: number | null
  readonly qualified: boolean
  readonly rescue: boolean
  readonly automatic: boolean
  /** Null means fresh alternate authorization was not observable. Never infer it from ranking. */
  readonly alternative: boolean | null
  readonly cachedAlternatives?: number | null
  readonly quality: 'valid' | 'invalid'
}
export interface LiveEvent {
  readonly at: number
  readonly type: 'request-started' | 'transport-completed' | 'recovery' | 'lifecycle'
  readonly owner: number
  readonly request: number | null
  readonly kind: 'video' | 'audio' | 'other'
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
const nullableNumber = (v: unknown): v is number | null => v === null || number(v)
const candidateConsistent = (v: Record<string, unknown>): boolean =>
  v.candidate !== true ||
  (typeof v.bufferSec === 'number' &&
    ((['draining-low', 'cycle-draining-low'].includes(String(v.reason)) && v.bufferSec <= 10) ||
      (['low-buffer-steady', 'low-buffer-cycle'].includes(String(v.reason)) && v.bufferSec <= 4) ||
      (v.reason === 'low-buffer-tail' && v.bufferSec > 0 && v.bufferSec <= 1)))
export function projectLiveSample(input: unknown): LiveSample | null {
  if (!record(input)) return null
  const v = input
  if (
    !number(v.at) ||
    !Number.isSafeInteger(v.owner) ||
    Number(v.owner) < 1 ||
    !Number.isSafeInteger(v.content) ||
    Number(v.content) < 1 ||
    (v.rate !== 1 && v.rate !== 2) ||
    (v.candidate !== null && typeof v.candidate !== 'boolean') ||
    typeof v.reason !== 'string' ||
    !liveReasons.includes(v.reason) ||
    !nullableNumber(v.bufferSec) ||
    !nullableNumber(v.currentTime) ||
    !nullableNumber(v.frames) ||
    (v.frames !== null && !Number.isSafeInteger(v.frames)) ||
    !candidateConsistent(v) ||
    typeof v.qualified !== 'boolean' ||
    typeof v.rescue !== 'boolean' ||
    typeof v.automatic !== 'boolean' ||
    (v.alternative !== null && typeof v.alternative !== 'boolean') ||
    (v.cachedAlternatives !== undefined &&
      v.cachedAlternatives !== null &&
      (!Number.isSafeInteger(v.cachedAlternatives) ||
        Number(v.cachedAlternatives) < 0 ||
        Number(v.cachedAlternatives) > 12)) ||
    (v.quality !== 'valid' && v.quality !== 'invalid') ||
    (v.candidate === true &&
      (v.quality !== 'valid' || !v.qualified || v.rescue || v.bufferSec === null))
  )
    return null
  return {
    at: v.at,
    owner: Number(v.owner),
    content: Number(v.content),
    rate: Number(v.rate) as 1 | 2,
    candidate: v.candidate,
    reason: v.reason,
    bufferSec: v.bufferSec,
    currentTime: v.currentTime,
    frames: v.frames,
    qualified: v.qualified,
    rescue: v.rescue,
    automatic: v.automatic,
    alternative: v.alternative,
    cachedAlternatives:
      v.cachedAlternatives === undefined ? null : (v.cachedAlternatives as number | null),
    quality: v.quality,
  }
}
export function projectLiveEvent(input: unknown): LiveEvent | null {
  if (
    !record(input) ||
    !number(input.at) ||
    !Number.isSafeInteger(input.owner) ||
    Number(input.owner) < 1 ||
    !['request-started', 'transport-completed', 'recovery', 'lifecycle'].includes(
      String(input.type),
    ) ||
    !['video', 'audio', 'other'].includes(String(input.kind)) ||
    (input.request !== null && (!Number.isSafeInteger(input.request) || Number(input.request) < 1))
  )
    return null
  return {
    at: input.at,
    owner: Number(input.owner),
    type: input.type as LiveEvent['type'],
    kind: input.kind as LiveEvent['kind'],
    request: input.request as number | null,
  }
}
const contiguous = (a: LiveSample, b: LiveSample): boolean =>
  b.at > a.at &&
  b.at - a.at <= 1500 &&
  a.owner === b.owner &&
  a.rate === b.rate &&
  a.quality === 'valid' &&
  b.quality === 'valid' &&
  a.qualified &&
  b.qualified &&
  !a.rescue &&
  !b.rescue
const progressing = (a: LiveSample, b: LiveSample): boolean =>
  a.currentTime !== null &&
  b.currentTime !== null &&
  b.currentTime - a.currentTime > 0.05 &&
  (a.frames === null || b.frames === null || b.frames > a.frames)
export interface LiveOpportunity {
  readonly at: number
  readonly owner: number
  readonly rate: 1 | 2
  readonly content: number
  readonly eligible: boolean
  readonly followup15: 'continued' | 'interrupted' | 'undetermined'
  readonly followup60: 'continued' | 'interrupted' | 'undetermined'
  readonly nextRequestAt: number | null
  readonly alternative: boolean | null
}
export function scoreLiveWindow(
  rows: readonly LiveSample[],
  events: readonly LiveEvent[],
  interval: { from: number; until: number },
) {
  if (
    !number(interval.from) ||
    !number(interval.until) ||
    interval.until <= interval.from ||
    rows.some((r, i) => !projectLiveSample(r) || (i > 0 && r.at <= rows[i - 1]!.at)) ||
    events.some((e) => !projectLiveEvent(e))
  )
    throw Error('Invalid live evidence')
  const interruptions: { at: number; owner: number; rate: 1 | 2 }[] = []
  let stalledSince: number | null = null,
    reported = false,
    eligibleMs = 0,
    candidateMs = 0,
    missingMs = 0
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1]!,
      b = rows[i]!,
      ms = Math.max(0, Math.min(b.at, interval.until) - Math.max(a.at, interval.from))
    if (!contiguous(a, b)) {
      stalledSince = null
      reported = false
      missingMs += ms
      continue
    }
    if (progressing(a, b)) eligibleMs += ms
    if (a.candidate === true) candidateMs += ms
    if (progressing(a, b)) {
      stalledSince = null
      reported = false
      continue
    }
    stalledSince ??= a.at
    if (!reported && b.at - stalledSince >= 2000) {
      interruptions.push({ at: stalledSince, owner: b.owner, rate: b.rate })
      reported = true
    }
  }
  const followup = (index: number, horizon: number): LiveOpportunity['followup15'] => {
    const first = rows[index]!,
      end = first.at + horizon
    for (let i = index + 1; i < rows.length; i++) {
      const a = rows[i - 1]!,
        b = rows[i]!
      if (!contiguous(a, b)) return 'undetermined'
      if (
        interruptions.some(
          (e) => e.owner === first.owner && e.at >= first.at && e.at <= end && e.at + 2000 <= b.at,
        )
      )
        return 'interrupted'
      if (b.at >= end) return 'continued'
    }
    return 'undetermined'
  }
  const opportunities: LiveOpportunity[] = []
  const eligible = (r: LiveSample): boolean =>
    r.candidate === true &&
    r.qualified &&
    !r.rescue &&
    r.automatic &&
    r.bufferSec !== null &&
    r.bufferSec > 1 &&
    r.bufferSec <= 4 &&
    r.reason !== 'low-buffer-tail'
  let previous: LiveSample | undefined
  rows.forEach((r, i) => {
    const onset =
      r.candidate === true &&
      (!previous ||
        !contiguous(previous, r) ||
        previous.candidate !== true ||
        (eligible(r) && !eligible(previous)))
    if (onset && r.at >= interval.from && r.at < interval.until) {
      // Separate nearby onsets remain visible in raw episodes; one outcome opportunity per 15s group.
      const last = opportunities.findLast((o) => o.eligible === eligible(r))
      if (!last || last.owner !== r.owner || r.at - last.at >= 15000)
        opportunities.push({
          at: r.at,
          owner: r.owner,
          content: r.content,
          rate: r.rate,
          eligible: eligible(r),
          followup15: followup(i, 15000),
          followup60: followup(i, 60000),
          nextRequestAt:
            events.find(
              (e) =>
                e.type === 'request-started' &&
                e.kind === 'video' &&
                e.owner === r.owner &&
                e.at >= r.at &&
                e.at - r.at <= 1500,
            )?.at ?? null,
          alternative: r.alternative,
        })
    }
    previous = r
  })
  const pairs: { opportunity: number; interruption: number; leadMs: number }[] = []
  const used = new Set<number>()
  opportunities.forEach((o, i) => {
    if (!o.eligible || o.followup60 !== 'interrupted') return
    const index = interruptions.findIndex(
      (s, j) => !used.has(j) && s.owner === o.owner && s.at >= o.at && s.at - o.at <= 60000,
    )
    if (index >= 0) {
      used.add(index)
      pairs.push({ opportunity: i, interruption: index, leadMs: interruptions[index]!.at - o.at })
    }
  })
  return {
    opportunities,
    interruptions: interruptions.filter((s) => s.at >= interval.from && s.at < interval.until),
    pairs: pairs.map((p) => ({ ...p, interruptionAt: interruptions[p.interruption]!.at })),
    eligibleMs,
    candidateMs,
    missingMs,
    from: interval.from,
    until: interval.until,
  }
}
export interface AdoptionFacts {
  readonly windows: number
  readonly combinations: number
  readonly observedMs: number
  readonly eligibleMs: number
  readonly opportunities: number
  readonly interruptions: number
  readonly clipsWithInterruptions: number
  readonly interruptionsByRate: readonly [number, number]
  readonly matched: number
  readonly warned: number
  readonly timely: number
  readonly actionable: number
  readonly actionableRates: number
  readonly normalMs: number
  readonly unnecessary: number
  readonly unknown: number
  readonly integrity: boolean
}
export function assessAdoption(f: AdoptionFacts) {
  const valid =
    Object.entries(f)
      .filter(([key]) => key !== 'integrity' && key !== 'interruptionsByRate')
      .every(
        ([, value]) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0,
      ) &&
    f.interruptionsByRate.length === 2 &&
    f.interruptionsByRate.every((n) => Number.isSafeInteger(n) && n >= 0) &&
    f.eligibleMs <= f.observedMs &&
    f.warned <= f.interruptions &&
    f.matched <= f.opportunities &&
    f.timely <= f.matched &&
    f.actionable <= f.matched &&
    f.unnecessary <= f.opportunities
  const checks = [
    {
      id: 'coverage',
      enough: f.windows === 12 && f.combinations === 6 && f.observedMs >= 3600000,
      pass: f.eligibleMs >= f.observedMs * 0.9,
    },
    {
      id: 'events',
      enough:
        f.opportunities >= 10 &&
        f.interruptions >= 10 &&
        f.clipsWithInterruptions >= 2 &&
        f.interruptionsByRate.every((n) => n >= 3),
      pass: true,
    },
    { id: 'association', enough: f.opportunities >= 10, pass: f.matched / f.opportunities >= 0.8 },
    {
      id: 'coverage-warning',
      enough: f.interruptions >= 10,
      pass: f.warned / f.interruptions >= 0.7,
    },
    { id: 'timing', enough: f.matched > 0, pass: f.timely / f.matched >= 0.8 },
    { id: 'dispatch', enough: f.unknown === 0, pass: f.actionable >= 5 && f.actionableRates === 2 },
    { id: 'normal-cost', enough: f.normalMs >= 1800000, pass: f.unnecessary <= 1 },
  ]
  const decision =
    !valid || !f.integrity
      ? 'blocked'
      : checks.some((c) => !c.enough)
        ? 'insufficient'
        : checks.some((c) => !c.pass)
          ? 'do-not-adopt'
          : 'prototype'
  return {
    schemaVersion: 1 as const,
    decision,
    checks,
    facts: { ...f, interruptionsByRate: [...f.interruptionsByRate] },
    productActionAuthorized: false as const,
  }
}
