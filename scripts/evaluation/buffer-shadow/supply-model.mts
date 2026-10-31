export interface SupplyCompletion {
  readonly at: number
  readonly segment: number
  readonly bytes: number
  readonly mediaMs: number
  readonly outcome: 'success' | 'failure' | 'abort'
}
export interface SupplyState {
  readonly at: number
  readonly bufferMs: number
  readonly positionMs: number
  readonly stalledMs: number
  readonly acceptedBytes: number
  readonly nextSegment: number
  readonly pending: readonly SupplyCompletion[]
}
export function createSupply(initialWallSec: number, rate: 1 | 2): SupplyState {
  if (
    !Number.isFinite(initialWallSec) ||
    initialWallSec < 0 ||
    initialWallSec > 3600 ||
    ![1, 2].includes(rate)
  )
    throw Error('Invalid supply baseline')
  return Object.freeze({
    at: 0,
    bufferMs: initialWallSec * rate * 1000,
    positionMs: 100000,
    stalledMs: 0,
    acceptedBytes: 0,
    nextSegment: 0,
    pending: Object.freeze([]),
  })
}
/** Accepted contiguous segments supply media; SDK calls are intentionally not inputs. */
export function advanceSupply(
  state: SupplyState,
  until: number,
  rate: 1 | 2,
  completions: readonly SupplyCompletion[],
  paused = false,
): SupplyState {
  if (
    ![1, 2].includes(rate) ||
    !Number.isFinite(until) ||
    until < state.at ||
    completions.length > 128 ||
    state.pending.length > 128 ||
    completions.some(
      (c, i) =>
        !Number.isFinite(c.at) ||
        c.at < state.at ||
        c.at > until ||
        (i > 0 && c.at < completions[i - 1]!.at) ||
        !Number.isSafeInteger(c.segment) ||
        c.segment < 0 ||
        !Number.isSafeInteger(c.bytes) ||
        c.bytes < 0 ||
        !Number.isFinite(c.mediaMs) ||
        c.mediaMs < 0 ||
        !['success', 'failure', 'abort'].includes(c.outcome),
    )
  )
    throw Error('Invalid supply input')
  let at = state.at,
    bufferMs = state.bufferMs,
    positionMs = state.positionMs,
    stalledMs = state.stalledMs,
    acceptedBytes = state.acceptedBytes,
    nextSegment = state.nextSegment
  const pending = state.pending.slice()
  const consume = (to: number) => {
    if (!paused) {
      const elapsed = to - at,
        playedMs = Math.min(elapsed, bufferMs / rate)
      positionMs += playedMs * rate
      bufferMs = Math.max(0, bufferMs - playedMs * rate)
      stalledMs += elapsed - playedMs
    }
    at = to
  }
  for (const c of completions) {
    consume(c.at)
    if (
      c.outcome !== 'success' ||
      c.bytes === 0 ||
      c.mediaMs === 0 ||
      c.segment < nextSegment ||
      pending.some((p) => p.segment === c.segment)
    )
      continue
    if (pending.length >= 128) throw Error('Supply reorder capacity exceeded')
    pending.push(Object.freeze({ ...c }))
    for (;;) {
      const index = pending.findIndex((p) => p.segment === nextSegment)
      if (index < 0) break
      const completed = pending.splice(index, 1)[0]!
      bufferMs += completed.mediaMs
      acceptedBytes += completed.bytes
      nextSegment++
    }
  }
  consume(until)
  if (
    ![bufferMs, positionMs, stalledMs, acceptedBytes, nextSegment].every(Number.isFinite) ||
    !Number.isSafeInteger(acceptedBytes)
  )
    throw Error('Supply model overflow')
  return Object.freeze({
    at,
    bufferMs,
    positionMs,
    stalledMs,
    acceptedBytes,
    nextSegment,
    pending: Object.freeze(pending),
  })
}
