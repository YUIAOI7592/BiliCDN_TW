import type { RequestContext, TransportObservation } from '../../domain/transport-model.ts'
import type { TimingBasis } from '../../domain/measurement-time.ts'
import { sampleTiming } from '../../domain/evidence.ts'

interface RetrySuccess {
  readonly request: RequestContext
  readonly at: number
  readonly mbps: number
  readonly payloadMbps: number | null
  readonly timingBasis: TimingBasis | undefined
  readonly ttfbMs: number
}

/** Private bookkeeping only. The coordinator retains all acceptance and permit decisions. */
export class RetryEvidence {
  #successes: RetrySuccess[] = []
  #suppressed = new Map<string, number>()

  reset(): void {
    this.#successes = []
  }

  prune(now: number): void {
    this.#successes = this.#successes.filter((row) => now - row.at <= 60_000 && now >= row.at)
  }

  isSuppressed(id: string): boolean {
    return this.#suppressed.has(id)
  }

  matching(request: RequestContext, host: string): readonly RetrySuccess[] {
    const successes = this.#successes.filter(
      (row) =>
        !this.#suppressed.has(row.request.requestId) &&
        row.request.targetHost === host &&
        row.request.generation === request.generation &&
        row.request.epoch === request.epoch &&
        row.request.representation === request.representation &&
        row.request.authorityRevision === request.authorityRevision &&
        row.request.routePolicyRevision === request.routePolicyRevision &&
        !!request.timingBasis &&
        row.timingBasis === request.timingBasis,
    )
    return [...new Map(successes.map((row) => [row.request.requestId, row])).values()]
  }

  record(request: RequestContext, observation: TransportObservation, now: () => number): void {
    this.#successes = this.#successes.filter(
      (row) => row.request.requestId !== request.requestId && now() - row.at <= 60_000,
    )
    this.#successes.push({
      request,
      at: observation.completedAt,
      timingBasis: observation.timingBasis,
      mbps: (observation.retryVerifiedBytes! * 8) / observation.elapsedMs / 1000,
      payloadMbps: sampleTiming(
        observation.retryVerifiedBytes,
        observation.elapsedMs,
        observation.ttfbMs,
      )
        ? (observation.retryVerifiedBytes! * 8) /
          (observation.elapsedMs - observation.ttfbMs!) /
          1000
        : null,
      ttfbMs: observation.ttfbMs!,
    })
    this.#successes = this.#successes.slice(-32)
  }

  suppress(requestIds: readonly string[]): () => void {
    const ids = [...new Set(requestIds)]
    if (
      ids.length > 32 ||
      ids.some((id) => typeof id !== 'string' || id.length < 1 || id.length > 64) ||
      new Set([...this.#suppressed.keys(), ...ids]).size > 32
    )
      throw new RangeError('Invalid early retry suppression scope')
    for (const id of ids) this.#suppressed.set(id, (this.#suppressed.get(id) ?? 0) + 1)
    this.#successes = this.#successes.filter((row) => !this.#suppressed.has(row.request.requestId))
    let released = false
    return () => {
      if (released) return
      released = true
      for (const id of ids) {
        const count = this.#suppressed.get(id) ?? 0
        if (count > 1) this.#suppressed.set(id, count - 1)
        else this.#suppressed.delete(id)
      }
    }
  }
}
