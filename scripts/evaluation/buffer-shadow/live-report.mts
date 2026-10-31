import {
  assessAdoption,
  projectLiveSample,
  projectLiveEvent,
  scoreLiveWindow,
} from './live-model.mts'
import type { LiveSample, LiveEvent, AdoptionFacts } from './live-model.mts'
import { measureContinuity } from './continuity.mts'
import { scoreWindow } from './model.mts'
export interface LiveWindow {
  readonly id: string
  readonly clip: string
  readonly part: number
  readonly rate: 1 | 2
  readonly repeat: 1 | 2
  readonly validity: 'valid' | 'invalid' | 'not-executed'
  readonly reason:
    'complete' | 'calibration-blocked' | 'clip-coverage' | 'collector-invalid' | 'budget-exhausted'
  readonly scoreFrom: number
  readonly rows: readonly LiveSample[]
  readonly events: readonly LiveEvent[]
  readonly clean: boolean
}
export function evaluateLiveWindows(windows: readonly LiveWindow[]) {
  if (windows.length > 12) throw Error('Invalid live window count')
  const ids = new Set<string>(),
    combinations = new Set<string>(),
    clips = new Set<string>()
  const repeats = new Set<string>()
  const interruptionClips = new Set<string>(),
    actionableRates = new Set<number>()
  const byRate: [number, number] = [0, 0]
  let observedMs = 0,
    eligibleMs = 0,
    opportunities = 0,
    interruptions = 0,
    matched = 0,
    warned = 0,
    timely = 0,
    actionable = 0,
    normalMs = 0,
    unnecessary = 0,
    unknown = 0,
    integrity = true
  const scores = windows.map((w) => {
    const repeat = `${w.clip}:${w.part}:${w.rate}:${w.repeat}`
    if (
      !/^[a-zA-Z0-9-]{1,80}$/.test(w.id) ||
      ids.has(w.id) ||
      repeats.has(repeat) ||
      !/^BV[a-zA-Z0-9]{10}$/.test(w.clip) ||
      !Number.isSafeInteger(w.part) ||
      w.part < 1 ||
      ![1, 2].includes(w.rate) ||
      ![1, 2].includes(w.repeat) ||
      !Number.isFinite(w.scoreFrom) ||
      w.scoreFrom < 0 ||
      typeof w.clean !== 'boolean' ||
      !['valid', 'invalid', 'not-executed'].includes(w.validity) ||
      ![
        'complete',
        'calibration-blocked',
        'clip-coverage',
        'collector-invalid',
        'budget-exhausted',
      ].includes(w.reason) ||
      !Array.isArray(w.rows) ||
      !Array.isArray(w.events)
    )
      throw Error('Invalid live window identity')
    ids.add(w.id)
    repeats.add(repeat)
    if (w.validity !== 'valid') {
      if (!w.clean) integrity = false
      return { id: w.id, validity: w.validity, reason: w.reason, score: null }
    }
    const from = w.scoreFrom,
      until = from + 300000
    const prelude = w.rows.filter((r) => r.at <= from)
    const healthyPrelude =
      prelude.length > 1 &&
      from - prelude[0]!.at >= 60000 &&
      prelude.every(
        (b, i) =>
          b.qualified &&
          !b.rescue &&
          (i === 0 ||
            (b.owner === prelude[i - 1]!.owner &&
              b.currentTime !== null &&
              prelude[i - 1]!.currentTime !== null &&
              b.currentTime - prelude[i - 1]!.currentTime! > 0.05 &&
              (b.frames === null ||
                prelude[i - 1]!.frames === null ||
                b.frames > prelude[i - 1]!.frames!))),
      )
    if (
      !healthyPrelude ||
      !w.clean ||
      !w.rows.length ||
      w.rows.some(
        (r, i) =>
          !projectLiveSample(r) ||
          r.rate !== w.rate ||
          r.quality !== 'valid' ||
          (i > 0 && (r.at <= w.rows[i - 1]!.at || r.at - w.rows[i - 1]!.at > 1500)),
      ) ||
      w.rows[0]!.at > from ||
      w.rows.at(-1)!.at < until + 65000 ||
      w.events.some((e) => !projectLiveEvent(e))
    ) {
      integrity = false
      return {
        id: w.id,
        validity: 'invalid' as const,
        reason: 'collector-invalid' as const,
        score: null,
      }
    }
    const s = scoreLiveWindow(w.rows, w.events, { from, until })
    combinations.add(`${w.clip}:${w.part}:${w.rate}`)
    clips.add(w.clip)
    observedMs += 300000
    eligibleMs += Math.floor(s.eligibleMs)
    const candidateOpportunities = s.opportunities.filter((o) => o.eligible)
    opportunities += candidateOpportunities.length
    interruptions += s.interruptions.length
    byRate[w.rate - 1]! += s.interruptions.length
    if (s.interruptions.length) interruptionClips.add(w.clip)
    const eligiblePairs = s.pairs.filter((p) => s.opportunities[p.opportunity]!.eligible)
    matched += eligiblePairs.length
    warned += s.interruptions.filter((e) =>
      eligiblePairs.some((p) => p.interruptionAt === e.at && p.leadMs >= 3000),
    ).length
    timely += eligiblePairs.filter((p) => p.leadMs >= 3000 && p.leadMs <= 15000).length
    // A per-window tool allowance is conservative only within that observed page/content.
    // The first submitted prediction consumes the content budget even if it later proves unnecessary.
    const usedContents = new Set<number>()
    let lastActionAt = -Infinity
    for (const o of candidateOpportunities) {
      if (o.alternative === null) {
        unknown++
        continue
      }
      if (
        !o.alternative ||
        o.nextRequestAt === null ||
        usedContents.has(o.content) ||
        o.nextRequestAt - lastActionAt < 90000
      )
        continue
      usedContents.add(o.content)
      lastActionAt = o.nextRequestAt
      const p = eligiblePairs.find((pair) => s.opportunities[pair.opportunity] === o)
      if (p && p.interruptionAt - o.nextRequestAt >= 3000) {
        actionable++
        actionableRates.add(w.rate)
      } else if (o.followup60 === 'continued') unnecessary++
      else if (o.followup60 === 'undetermined') unknown++
    }
    // Only continuous 60s progress qualifies a scored interval as a normal control.
    for (let i = 0; i + 1 < w.rows.length; i++) {
      const r = w.rows[i]!,
        next = w.rows[i + 1]!
      if (r.at < from || next.at > until) continue
      const endIndex = w.rows.findIndex((x, j) => j > i && x.at >= r.at + 60000)
      if (endIndex < 0) continue
      const tail = w.rows.slice(i, endIndex + 1)
      if (
        tail.every(
          (b, j) =>
            j === 0 ||
            (b.owner === r.owner &&
              b.qualified &&
              !b.rescue &&
              b.currentTime !== null &&
              tail[j - 1]!.currentTime !== null &&
              b.currentTime - tail[j - 1]!.currentTime! > 0.05 &&
              (b.frames === null ||
                tail[j - 1]!.frames === null ||
                b.frames > tail[j - 1]!.frames!)),
        )
      )
        normalMs += next.at - r.at
    }
    const metricRows = w.rows
      .filter((r) => r.at >= from)
      .map((r, i) => ({
        seq: i + 1,
        at: r.at,
        owner: `owner-${r.owner}`,
        rate: r.rate,
        candidate: r.candidate,
        state: r.candidate === null ? 'insufficient' : 'draining',
        reason: r.reason,
        qualified: r.qualified,
        currentTime: r.currentTime,
        frames: r.frames,
      }))
    const raw = scoreWindow(metricRows, { scoreUntil: until, stallAt: null })
    const continuity = s.interruptions.map((e) => ({
      at: e.at,
      owner: e.owner,
      metrics: measureContinuity(
        metricRows.filter((r) => r.owner === `owner-${e.owner}`),
        { scoreUntil: e.at, stallAt: e.at },
      ),
    }))
    return {
      id: w.id,
      validity: 'valid' as const,
      reason: w.reason,
      score: { ...s, raw, continuity },
    }
  })
  if (
    clips.size > 3 ||
    combinations.size > 6 ||
    (scores.filter((s) => s.validity === 'valid').length === 12 && !clips.has('BV1tFZZBQE57'))
  )
    integrity = false
  const facts: AdoptionFacts = {
    windows: scores.filter((s) => s.validity === 'valid').length,
    combinations: combinations.size,
    observedMs,
    eligibleMs,
    opportunities,
    interruptions,
    clipsWithInterruptions: interruptionClips.size,
    interruptionsByRate: byRate,
    matched,
    warned,
    timely,
    actionable,
    actionableRates: actionableRates.size,
    normalMs: Math.floor(normalMs),
    unnecessary,
    unknown,
    integrity,
  }
  return {
    schemaVersion: 1 as const,
    scores,
    adoption: assessAdoption(facts),
    exitCode:
      scores.length !== 12 || scores.some((s) => s.validity !== 'valid') || !integrity ? 1 : 0,
    limitations: [
      'Observational association is not causal route benefit.',
      'No private route state or fresh authorization is inferred from cached ranking.',
    ],
  }
}
