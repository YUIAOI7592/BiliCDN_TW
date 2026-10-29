import { evaluateEarlyRetry } from '../domain/early-retry.ts'
import { earlyRetryReason } from '../domain/early-retry-diagnostic.ts'
import type { RequestContext } from '../domain/model.ts'
import type { PlayerControlSnapshot } from './ports.ts'
import type { EarlyRetryPermit, EarlyRetrySnapshot, EarlyRetryStatus } from './early-retry-model.ts'
import type { EarlyRetryPort, InFlightVideoPort, RouteEarlyRetryPort } from './early-retry-ports.ts'

interface Pending {
  observed: number
  readonly permit: EarlyRetryPermit
  readonly request: RequestContext
  readonly controls: PlayerControlSnapshot
  dispatchedAt: number | null
}

export class EarlyRetryController implements EarlyRetryPort {
  #pending: Pending | null = null
  #attempted = new WeakSet<object>()
  #attemptTimes: number[] = []
  #hostLast = new Map<string, number>()
  #attemptCount = 0
  #episodeUsed = false
  #healthyTicks = 0
  #healthyAt: number | null = null
  #breaker = false
  #disposed = false
  #revision = 0
  #listeners = new Set<(snapshot: EarlyRetrySnapshot) => void>()
  #snapshot: EarlyRetrySnapshot = Object.freeze({
    state: 'idle',
    reason: 'not-started',
    host: null,
    attempts: 0,
    history: Object.freeze([]),
  })

  constructor(
    private readonly routes: RouteEarlyRetryPort,
    private readonly flight: InFlightVideoPort,
    private readonly now: () => number,
  ) {}

  tick(status: EarlyRetryStatus): void {
    if (this.#disposed || this.#breaker) return
    const revision = ++this.#revision
    try {
      const now = this.now()
      const unsafe = this.#unsafe(status)
      if (unsafe) {
        this.cancel(unsafe)
        return
      }
      this.#observeHealthy(status, now)
      const pending = this.#pending
      if (pending) {
        if (!this.#sameControls(pending.controls, status.controls)) {
          this.cancel('owner-changed')
          return
        }
        const observations = this.flight.observations?.(pending.permit) ?? []
        for (const event of observations.slice(pending.observed, 2)) {
          pending.observed++
          this.#publish(
            event.state,
            event.state === 'timedout' ? 'native-timeout-observed' : 'website-retry-claimed',
            pending.request.targetHost,
            event.at,
          )
          if (revision !== this.#revision || this.#pending !== pending) return
        }
        const state = this.flight.state(pending.permit)
        if (revision !== this.#revision || this.#pending !== pending) return
        if (state === 'succeeded') {
          this.#release()
          this.#publish('complete', 'website-retry-succeeded', pending.request.targetHost)
        } else if (state === 'dispatched') {
          pending.dispatchedAt ??= now
          if (now - pending.dispatchedAt >= 15_000) this.#suspend('retry-completion-timeout')
          else this.#publish('dispatched', 'website-retry-dispatched', pending.request.targetHost)
        } else if (state === 'failed' || state === 'expired' || state === null) {
          this.#suspend(state === 'failed' ? 'website-retry-failed' : 'handoff-lost')
        } else if (now >= pending.permit.expiresAt) this.#suspend('handoff-expired')
        return
      }
      if (status.stableProgressSec < 10 || !Number.isFinite(status.stableProgressSec)) {
        this.#publish('waiting', 'stable-progress', null)
        return
      }
      if (this.#episodeUsed) {
        this.#publish('waiting', 'episode-used', null)
        return
      }
      this.#attemptTimes = this.#attemptTimes.filter((at) => now - at < 30_000)
      for (const [host, at] of this.#hostLast) if (now - at >= 30_000) this.#hostLast.delete(host)
      if (this.#attemptTimes.length >= 3) {
        this.#publish('waiting', 'document-quota', null)
        return
      }
      const demand = status.demand!
      let waitingReason = 'no-qualified-request'
      for (const sample of this.flight.samples(now).slice(0, 16)) {
        if (revision !== this.#revision) return
        const request = sample.request
        if (
          request.kind !== 'video' ||
          request.routeType !== 'catalog-generated' ||
          request.attributionStatus !== 'matched' ||
          !request.representation ||
          this.#attempted.has(request) ||
          now - (this.#hostLast.get(request.targetHost) ?? -Infinity) < 8000
        )
          continue
        const alternative = this.routes.alternative(request, demand)
        if (revision !== this.#revision) return
        if (!alternative) {
          waitingReason = 'no-alternative'
          continue
        }
        const assessment = evaluateEarlyRetry({
          now,
          startedAt: request.startedAt,
          currentHost: request.targetHost,
          loadedBytes: sample.loadedBytes,
          totalBytes: sample.totalBytes,
          recentBytesPerSec: sample.recentBytesPerSec,
          playableBufferSec: status.video.playableBufferSec,
          requiredMbps: demand.requiredMbps,
          alternative,
        })
        if (!assessment.eligible) {
          waitingReason = assessment.reason
          continue
        }
        const permit = this.routes.prepare(request, alternative.host, demand)
        if (!permit) continue
        if (
          revision !== this.#revision ||
          !Number.isFinite(permit.expiresAt) ||
          permit.expiresAt <= this.now() ||
          permit.expiresAt > this.now() + 2000
        ) {
          this.routes.revoke(permit)
          return
        }
        const attempt: Pending = {
          observed: 0,
          permit,
          request,
          controls: Object.freeze({ ...status.controls }),
          dispatchedAt: null,
        }
        this.#pending = attempt
        this.#attempted.add(request)
        this.#attemptTimes.push(now)
        this.#hostLast.set(request.targetHost, now)
        this.#attemptCount = Math.min(1_000_000_000, this.#attemptCount + 1)
        this.#episodeUsed = true
        if (!this.flight.arm(request.requestId, permit)) {
          if (this.#pending === attempt) this.#suspend('native-timeout-unavailable')
          return
        }
        if (revision !== this.#revision || this.#pending !== attempt) return
        this.#publish('armed', 'native-timeout-armed', request.targetHost)
        return
      }
      this.#publish('waiting', waitingReason, null)
    } catch {
      this.#suspend('port-failure')
    }
  }

  #unsafe(status: EarlyRetryStatus): string | null {
    if (!status.enabled) return 'disabled-setting'
    if (status.disabled) return 'disabled'
    if (status.originalComparison || !status.catalogOnly || status.fixedHost) return 'route-mode'
    if (!status.visible) return 'hidden'
    if (status.recovering) return 'recovering'
    const video = status.video
    if (
      !video.available ||
      video.paused ||
      video.seeking ||
      video.ended ||
      video.mediaError ||
      video.coreInitialized !== true ||
      !video.manifestHasVideo ||
      video.bufferedToEnd
    )
      return 'playback-state'
    if (status.controls.dragging || status.controls.pendingSeekGoal) return 'user-operation'
    if (!status.demand || status.demand.kind !== 'video') return 'unknown-demand'
    return null
  }

  #sameControls(a: PlayerControlSnapshot, b: PlayerControlSnapshot): boolean {
    return (
      a.mediaId === b.mediaId &&
      a.coreId === b.coreId &&
      a.seekRevision === b.seekRevision &&
      a.userRevision === b.userRevision &&
      a.reloadRevision === b.reloadRevision &&
      a.coreReloadRevision === b.coreReloadRevision
    )
  }

  #observeHealthy(status: EarlyRetryStatus, now: number): void {
    if (
      !Number.isFinite(status.video.playableBufferSec) ||
      !Number.isFinite(status.stableProgressSec) ||
      status.video.playableBufferSec < 10 ||
      status.stableProgressSec < 10
    ) {
      this.#healthyAt = null
      this.#healthyTicks = 0
      return
    }
    if (this.#healthyAt === now) return
    const gap = this.#healthyAt === null ? 0 : now - this.#healthyAt
    if (gap > 0 && gap < 1000) return
    this.#healthyTicks = gap >= 1000 && gap <= 2000 ? this.#healthyTicks + 1 : 1
    this.#healthyAt = now
    if (this.#healthyTicks >= 10) this.#episodeUsed = false
  }

  #release(): void {
    const pending = this.#pending
    this.#pending = null
    if (!pending) return
    try {
      this.flight.cancel(pending.permit)
    } finally {
      this.routes.revoke(pending.permit)
    }
  }

  #suspend(reason: string): void {
    this.#breaker = true
    this.#revision++
    const host = this.#pending?.request.targetHost ?? null
    try {
      this.#release()
    } catch {
      /* ownership has already been revoked locally */
    }
    this.#publish('suspended', reason, host)
  }

  cancel(reason = 'cancelled'): void {
    this.#revision++
    this.#healthyAt = null
    this.#healthyTicks = 0
    try {
      this.#release()
    } catch {
      this.#breaker = true
    }
    if (!this.#breaker) this.#publish('cancelled', reason, null)
  }

  reset(): void {
    this.cancel('lifecycle-reset')
  }
  dispose(): void {
    this.cancel('disposed')
    this.#disposed = true
    this.#listeners.clear()
  }
  snapshot(): EarlyRetrySnapshot {
    return this.#snapshot
  }
  subscribe(listener: (snapshot: EarlyRetrySnapshot) => void): () => void {
    if (this.#disposed) return () => undefined
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
  #publish(
    state: EarlyRetrySnapshot['state'],
    reason: string,
    host: string | null,
    at = this.now(),
  ): void {
    reason = earlyRetryReason(reason)
    if (
      this.#snapshot.state === state &&
      this.#snapshot.reason === reason &&
      this.#snapshot.host === host &&
      this.#snapshot.attempts === this.#attemptCount
    )
      return
    const event = Object.freeze({ at, state, reason, host })
    this.#snapshot = Object.freeze({
      state,
      reason,
      host,
      attempts: this.#attemptCount,
      history: Object.freeze([...this.#snapshot.history, event].slice(-16)),
    })
    for (const listener of this.#listeners) listener(this.#snapshot)
  }
}
