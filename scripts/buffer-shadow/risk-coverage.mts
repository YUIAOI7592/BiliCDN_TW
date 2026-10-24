import { projectLiveSample } from './live-model.mts'
import type { LiveSample } from './live-model.mts'

export function measureRiskCoverage(
  rows: readonly LiveSample[],
  interval: { readonly from: number; readonly until: number },
) {
  const { from, until } = interval
  if (
    !Number.isFinite(from) ||
    from < 0 ||
    !Number.isFinite(until) ||
    until <= from ||
    rows.some((r, i) => !projectLiveSample(r) || (i > 0 && r.at <= rows[i - 1]!.at))
  )
    throw Error('Invalid risk coverage input')
  const bands = { above10: 0, fourTo10: 0, oneTo4: 0, zeroTo1: 0, zero: 0 }
  let coveredMs = 0,
    missingMs = 0,
    insufficientMs = 0,
    ineligibleMs = 0,
    progressMs = 0,
    candidateMs = 0
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1]!,
      b = rows[i]!,
      ms = Math.max(0, Math.min(until, b.at) - Math.max(from, a.at))
    if (!ms) continue
    coveredMs += ms
    if (
      b.at - a.at > 1500 ||
      a.owner !== b.owner ||
      a.content !== b.content ||
      a.rate !== b.rate ||
      a.quality !== 'valid' ||
      b.quality !== 'valid'
    ) {
      missingMs += ms
      continue
    }
    if (!a.qualified || !b.qualified || a.rescue || b.rescue) {
      ineligibleMs += ms
      continue
    }
    if (
      a.currentTime !== null &&
      b.currentTime !== null &&
      b.currentTime - a.currentTime > 0.05 &&
      (a.frames === null || b.frames === null || b.frames > a.frames)
    )
      progressMs += ms
    if (a.candidate === null || a.bufferSec === null) {
      insufficientMs += ms
      continue
    }
    const key =
      a.bufferSec > 10
        ? 'above10'
        : a.bufferSec > 4
          ? 'fourTo10'
          : a.bufferSec > 1
            ? 'oneTo4'
            : a.bufferSec > 0
              ? 'zeroTo1'
              : 'zero'
    bands[key] += ms
    if (a.candidate) candidateMs += ms
  }
  missingMs += until - from - coveredMs
  return {
    schemaVersion: 1 as const,
    interval: { from, until },
    method: 'left-sample-interval' as const,
    bands,
    missingMs,
    insufficientMs,
    ineligibleMs,
    progressMs,
    candidateMs,
    riskExposure:
      bands.oneTo4 + bands.zeroTo1 + bands.zero > 0 ? 'low-buffer-covered' : 'not-exposed',
  }
}
