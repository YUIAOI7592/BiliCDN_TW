import type { ProbeRange } from './probe-model.ts'

export function parseProbeRange(
  value: string,
  startByte: number,
  limit: number,
): ProbeRange | null {
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(value)
  if (!match) return null
  const start = Number(match[1]),
    end = Number(match[2]),
    total = Number(match[3])
  if (
    ![start, end, total].every(Number.isSafeInteger) ||
    start < 0 ||
    total <= 0 ||
    end < start ||
    end >= total ||
    start !== startByte ||
    end !== Math.min(total - 1, startByte + limit - 1)
  )
    return null
  return Object.freeze({ startByte: start, endByte: end, totalBytes: total })
}

/** One injected draw per round; no inferred size and no extra size request. */
export function probeStartByte(totalBytes: number | null, limit: number, draw: number): number {
  const minimum = 1024 * 1024,
    alignment = 64 * 1024
  if (
    !Number.isSafeInteger(totalBytes) ||
    totalBytes === null ||
    !Number.isSafeInteger(limit) ||
    limit <= 0 ||
    !Number.isFinite(draw) ||
    draw < 0 ||
    draw >= 1 ||
    totalBytes - limit < minimum
  )
    return 0
  const slots = Math.floor((totalBytes - limit - minimum) / alignment) + 1
  return minimum + Math.floor(draw * slots) * alignment
}
