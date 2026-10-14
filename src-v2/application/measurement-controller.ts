import type {
  AppliedRouteDecision,
  RouteCoordinator,
  StartupCandidate,
  StartupOptions,
} from './route-coordinator.ts'
import type { FailureKind, PlaybackDemand, RepresentationId } from '../domain/model.ts'
import type { MeasurementMetaStore } from '../state/measurement-meta-store.ts'
import type { RangeProbePort, SchedulerPort } from './ports.ts'

const COOLDOWN_MS = 10 * 60_000
const TIMEOUT_MS = 3000
const cancellationReason = (signal: AbortSignal): unknown =>
  'reason' in signal ? signal.reason : new DOMException('Aborted', 'AbortError')
export interface MeasurementStatus {
  readonly generationActive: boolean
  readonly representation: RepresentationId | null
  readonly demand: PlaybackDemand | null
  readonly stableProgressSec: number
  readonly playableBufferSec: number
  readonly visible: boolean
  readonly seeking: boolean
  readonly recovering: boolean
  readonly disabled: boolean
}

export interface MeasurementRoutes extends Pick<
  RouteCoordinator,
  | 'startupOptions'
  | 'noteStartupProbeResult'
  | 'recordStartupSuccess'
  | 'challenge'
  | 'isCatalogOnly'
  | 'recordChallenge'
> {
  commitStartupChoice(
    ...args: Parameters<RouteCoordinator['commitStartupChoice']>
  ): { readonly host: string | null } | null
}

export interface MeasurementSnapshot {
  readonly state: 'idle' | 'waiting' | 'running' | 'complete' | 'failed' | 'cancelled'
  readonly reason: string
  readonly lastAttemptAt: number
  readonly host: string | null
  readonly startup?: {
    readonly state: string
    readonly reason: string
    readonly candidates: number
    readonly selectedHost: string | null
    readonly delayed: boolean
    readonly results?: readonly {
      readonly host: string
      readonly type: string
      readonly valid: boolean
      readonly safeMbps: number | null
      readonly status: number | null
      readonly reason: string
    }[]
  }
}

interface ProbeResult {
  readonly candidate: StartupCandidate
  readonly valid: boolean
  readonly safeMbps: number | null
  readonly bytes: number
  readonly elapsedMs: number
  readonly ttfbMs: number | null
  readonly status: number | null
  readonly reason: string
}

interface MeasurementWork {
  readonly controller: AbortController
  readonly marker: number
}

export class MeasurementController {
  #running: MeasurementWork | null = null
  #failedAt: number | null = null
  #planning: object | null = null
  #manualRequested = false
  #preferNative = false
  #marker = 0
  #lastStatus: MeasurementStatus | null = null
  #startupUsed = false
  #startupPending: Promise<void> | null = null
  #startupController: AbortController | null = null
  #startupQualifiedHosts: readonly string[] = []
  #startupState: NonNullable<MeasurementSnapshot['startup']> = Object.freeze({
    state: 'idle',
    reason: 'not-requested',
    candidates: 0,
    selectedHost: null,
    delayed: false,
  })
  #snapshot: MeasurementSnapshot = Object.freeze({
    state: 'idle',
    reason: 'startup',
    lastAttemptAt: 0,
    host: null,
  })

  constructor(
    private readonly routes: MeasurementRoutes,
    private readonly meta: Pick<MeasurementMetaStore, 'get' | 'update' | 'withLock'>,
    private readonly probe: RangeProbePort,
    private readonly now: () => number,
    private readonly scheduler: SchedulerPort,
  ) {}

  snapshot(): MeasurementSnapshot {
    return Object.freeze({ ...this.#snapshot, startup: this.#startupState })
  }
  reset(): void {
    this.cancel('generation')
    this.#startupController?.abort('generation')
    this.#startupController = null
    this.#startupPending = null
    this.#startupQualifiedHosts = []
    this.#marker++
    this.#manualRequested = false
    this.#failedAt = null
    this.#snapshot = Object.freeze({
      state: 'idle',
      reason: 'generation',
      lastAttemptAt: 0,
      host: null,
    })
  }
  requestManual(): void {
    this.#manualRequested = true
  }
  dispose(): void {
    this.reset()
  }
  startupFallbackHosts(): readonly string[] {
    return this.#startupQualifiedHosts
  }
  cancel(reason: string): void {
    const running = this.#running
    this.#planning = null
    this.#running = null
    running?.controller.abort(reason)
  }
  willGateStartup(url: string): boolean {
    return (
      !!this.#startupPending ||
      (!this.#startupUsed && !!this.routes.startupOptions(url)?.candidates.length)
    )
  }

  /** The player request, never a page hint, authorizes this one bounded startup window. */
  async prepareStartup(url: string, signal: AbortSignal | null = null): Promise<void> {
    if (signal?.aborted) throw cancellationReason(signal)
    if (!this.#startupPending) {
      if (this.#startupUsed) return
      const cursor = Math.max(0, Number(this.meta.get().catalogCursor) || 0)
      const options = this.routes.startupOptions(url, cursor)
      if (!options?.candidates.length) {
        this.noteUnpreflighted('unsupported-or-no-legal-candidate')
        return
      }
      const controller = new AbortController(),
        marker = this.#marker
      this.#startupUsed = true
      this.#startupController = controller
      this.#startupState = Object.freeze({
        state: 'running',
        reason: 'player-media-request',
        candidates: options.candidates.length,
        selectedHost: null,
        delayed: true,
      })
      let release!: () => void
      this.#startupPending = new Promise<void>((resolve) => {
        release = resolve
      })
      void this.#runStartup(url, options, controller, marker)
        .catch(() => {
          if (marker === this.#marker)
            this.#startupState = Object.freeze({
              state: 'skipped',
              reason: 'preflight-error',
              candidates: options.candidates.length,
              selectedHost: null,
              delayed: true,
            })
        })
        .finally(() => {
          if (this.#startupController === controller) this.#startupController = null
          if (marker === this.#marker) this.#startupPending = null
          release()
        })
      void this.meta
        .withLock(() => {
          if (marker !== this.#marker) return
          this.meta.update({ catalogCursor: cursor + 1 })
        })
        .catch(() => undefined)
    }
    const pending = this.#startupPending
    if (!pending) return
    if (!signal) {
      await pending
      return
    }
    if (signal.aborted) throw cancellationReason(signal)
    let onAbort: (() => void) | null = null
    try {
      await Promise.race([
        pending,
        new Promise<never>((_resolve, reject) => {
          onAbort = () => reject(cancellationReason(signal))
          signal.addEventListener('abort', onAbort, { once: true })
        }),
      ])
    } finally {
      if (onAbort) signal.removeEventListener('abort', onAbort)
    }
  }

  noteUnpreflighted(reason: string): void {
    if (this.#startupUsed || this.#startupPending) return
    this.#startupState = Object.freeze({
      state: 'skipped',
      reason: reason.slice(0, 48),
      candidates: 0,
      selectedHost: null,
      delayed: false,
    })
  }

  async #runStartup(
    url: string,
    options: StartupOptions,
    controller: AbortController,
    marker: number,
  ): Promise<void> {
    const results: ProbeResult[] = []
    let timer: (() => void) | null = null
    const deadline = new Promise<void>((resolve) => {
      timer = this.scheduler.timeout(() => {
        controller.abort('startup-deadline')
        resolve()
      }, TIMEOUT_MS)
    })
    const complete = Promise.all(
      options.candidates.map(async (candidate) => {
        const result = await this.#probeStartup(candidate, options.demand, controller.signal)
        if (marker === this.#marker) results.push(result)
      }),
    ).then(() => undefined)
    try {
      await Promise.race([complete, deadline])
    } finally {
      if (timer !== null) (timer as () => void)()
      controller.abort('startup-complete')
    }
    if (marker !== this.#marker) return
    for (const result of results)
      this.routes.noteStartupProbeResult(result.candidate, result.status)
    const valid = results.filter((result) => result.valid && result.safeMbps !== null)
    const qualified = valid.filter(
      (result) => (result.safeMbps ?? 0) / options.demand.requiredMbps >= 1.35,
    )
    const ranked = [...qualified].sort((a, b) => (b.safeMbps ?? 0) - (a.safeMbps ?? 0))
    const catalogOnly = this.routes.isCatalogOnly()
    const fastestValid =
      [...valid].sort((a, b) => (b.safeMbps ?? 0) - (a.safeMbps ?? 0))[0]?.candidate ?? null
    let winner =
      ranked[0]?.candidate ??
      (!catalogOnly ? options.candidates.find((candidate) => candidate.original) : null) ??
      fastestValid ??
      (!catalogOnly ? options.candidates[0] : null) ??
      null
    const original = valid.find((result) => result.candidate.original)
    if (
      !catalogOnly &&
      winner &&
      original &&
      !winner.original &&
      (original.safeMbps ?? 0) >= (ranked[0]?.safeMbps ?? 0) * 0.9
    )
      winner = original.candidate
    const decision = winner
      ? this.routes.commitStartupChoice(
          url,
          winner,
          valid.length ? 'startup-preflight' : 'startup-inconclusive',
        )
      : null
    this.#startupQualifiedHosts = Object.freeze(
      [...valid]
        .sort((a, b) => (b.safeMbps ?? 0) - (a.safeMbps ?? 0))
        .map((result) => result.candidate.host),
    )
    this.#startupState = Object.freeze({
      state: decision ? 'complete' : 'skipped',
      reason: valid.length ? 'measured' : 'inconclusive',
      candidates: options.candidates.length,
      selectedHost: decision?.host ?? null,
      delayed: true,
      results: Object.freeze(
        results.slice(0, 3).map((result) =>
          Object.freeze({
            host: result.candidate.host,
            type: result.candidate.type,
            valid: result.valid,
            safeMbps: result.safeMbps,
            status: result.status,
            reason: result.reason,
          }),
        ),
      ),
    })
    for (const result of valid)
      if (result.candidate.cachedSafeMbps === null) {
        void this.routes
          .recordStartupSuccess(result.candidate, result.bytes, result.elapsedMs, result.ttfbMs)
          .catch(() => undefined)
      }
  }

  async #probeStartup(
    candidate: StartupCandidate,
    demand: PlaybackDemand,
    signal: AbortSignal,
  ): Promise<ProbeResult> {
    const limit =
      candidate.cachedSafeMbps !== null ? 16 * 1024 : demand.highDemand ? 512 * 1024 : 256 * 1024
    const result = await this.probe.read({
      url: candidate.url,
      host: candidate.host,
      limit,
      signal,
      completionReason: 'startup-sample-complete',
    })
    const valid =
      result.directRange &&
      (candidate.cachedSafeMbps !== null ? result.bytes > 0 : result.bytes >= 64 * 1024)
    return {
      candidate,
      ...result,
      valid,
      safeMbps: valid
        ? (candidate.cachedSafeMbps ?? ((result.bytes * 8) / result.elapsedMs / 1000) * 0.7)
        : null,
      reason: result.directRange ? (valid ? 'measured' : 'short-response') : result.reason,
    }
  }

  tick(status: MeasurementStatus): void {
    this.#lastStatus = status
    const unsafe = this.#unsafeReason(status)
    if (this.#running && unsafe) {
      this.cancel(unsafe)
      this.#snapshot = Object.freeze({ ...this.#snapshot, state: 'cancelled', reason: unsafe })
      return
    }
    if (this.#running || this.#planning) return
    if (unsafe) {
      this.#snapshot = Object.freeze({
        ...this.#snapshot,
        state: 'waiting',
        reason: this.#manualRequested ? 'manual-' + unsafe : unsafe,
      })
      return
    }
    if (this.#failedAt !== null && this.now() - this.#failedAt < COOLDOWN_MS) return
    void this.#tryStart(status)
  }

  async #tryStart(status: MeasurementStatus): Promise<void> {
    if (!status.representation || !status.demand || this.#running || this.#planning) return
    const planning = {}
    this.#planning = planning
    const planningMarker = this.#marker
    let running: MeasurementWork | null = null
    try {
      let at = this.now()
      let first: AppliedRouteDecision | null = null,
        cursor = 0
      await this.meta.withLock(() => {
        if (planningMarker !== this.#marker || this.#planning !== planning) return
        const current = this.#lastStatus
        if (
          !current ||
          this.#unsafeReason(current) ||
          current.representation !== status.representation ||
          !current.demand
        )
          return
        at = this.now()
        const meta = this.meta.get()
        if (at - (Number(meta.lastChallengeAt) || 0) < COOLDOWN_MS) return
        cursor = Math.max(0, Number(meta.catalogCursor) || 0)
        first = this.routes.challenge(
          current.representation!,
          current.demand,
          this.#preferNative,
          new Set(),
          cursor,
        )
        if (!first?.url) return
        if (
          planningMarker !== this.#marker ||
          this.#planning !== planning ||
          (this.routes.isCatalogOnly() && first.decision.routeType !== 'catalog-generated')
        )
          return
        this.meta.update({ lastChallengeAt: at, catalogCursor: cursor + 1 })
      })
      if (planningMarker !== this.#marker || this.#planning !== planning) return
      const current = this.#lastStatus
      if (
        !current ||
        this.#unsafeReason(current) ||
        current.representation !== status.representation
      )
        return
      const planned = first as AppliedRouteDecision | null
      if (
        planned &&
        this.routes.isCatalogOnly() &&
        planned.decision.routeType !== 'catalog-generated'
      )
        return
      if (!planned?.url) {
        const cooldown = at - (Number(this.meta.get().lastChallengeAt) || 0) < COOLDOWN_MS
        this.#snapshot = Object.freeze({
          ...this.#snapshot,
          state: 'waiting',
          reason: cooldown ? 'cross-tab-cooldown' : 'no-stale-candidate',
        })
        return
      }
      this.#preferNative = !this.#preferNative
      this.#manualRequested = false
      const controller = new AbortController(),
        marker = this.#marker
      running = { controller, marker }
      this.#running = running
      await this.#runRound(planned, status, controller, marker, cursor)
    } catch {
      if (
        planningMarker === this.#marker &&
        this.#planning === planning &&
        (!running || (this.#running === running && !running.controller.signal.aborted))
      ) {
        this.#failedAt = this.now()
        this.#snapshot = Object.freeze({
          ...this.#snapshot,
          state: 'failed',
          reason: 'measurement-error',
          lastAttemptAt: this.#failedAt,
        })
      }
    } finally {
      if (running && this.#running === running) this.#running = null
      if (this.#planning === planning) this.#planning = null
    }
  }

  async #runRound(
    first: AppliedRouteDecision,
    status: MeasurementStatus,
    controller: AbortController,
    marker: number,
    cursor: number,
  ): Promise<void> {
    const excluded = new Set<string>()
    let catalogCount = 0,
      nativeCount = 0
    let next: AppliedRouteDecision | null = first
    for (let index = 0; index < 3 && next?.url && !controller.signal.aborted; index++) {
      const current = this.#lastStatus ?? status
      const unsafe = this.#unsafeReason(current)
      if (unsafe || marker !== this.#marker || current.representation !== status.representation) {
        controller.abort(unsafe ?? 'representation-changed')
        break
      }
      const applied: AppliedRouteDecision = next
      if (applied.decision.host) excluded.add(applied.decision.host)
      if (applied.decision.routeType === 'native-signed') nativeCount++
      else catalogCount++
      this.#snapshot = Object.freeze({
        state: 'running',
        reason: 'candidate-' + (index + 1),
        lastAttemptAt: this.now(),
        host: applied.decision.host,
      })
      await this.#runCandidate(applied, status.demand!, controller, marker)
      if (
        index === 2 ||
        controller.signal.aborted ||
        marker !== this.#marker ||
        this.#running?.controller !== controller
      )
        break
      next = this.routes.challenge(
        status.representation!,
        status.demand!,
        nativeCount === 0 && catalogCount >= 2,
        excluded,
        cursor + index + 1,
      )
      if (nativeCount >= 1 && next?.decision.routeType === 'native-signed') next = null
    }
    if (
      controller.signal.aborted &&
      marker === this.#marker &&
      this.#running?.controller === controller
    )
      this.#snapshot = Object.freeze({
        ...this.#snapshot,
        state: 'cancelled',
        reason: String(controller.signal.reason ?? 'cancelled').slice(0, 48),
      })
  }

  async #runCandidate(
    applied: AppliedRouteDecision,
    demand: PlaybackDemand,
    round: AbortController,
    marker: number,
  ): Promise<void> {
    const startedAt = this.now(),
      limit = demand.highDemand ? 768 * 1024 : 384 * 1024
    const controller = new AbortController()
    const cancel = (): void => controller.abort(round.signal.reason)
    round.signal.addEventListener('abort', cancel, { once: true })
    const stopTimeout = this.scheduler.timeout(() => controller.abort('timeout'), TIMEOUT_MS)
    let result
    try {
      result = await this.probe.read({
        url: applied.url ?? '',
        host: applied.decision.host,
        limit,
        signal: controller.signal,
        completionReason: 'sample-complete',
      })
    } finally {
      stopTimeout()
      round.signal.removeEventListener('abort', cancel)
    }
    if (
      marker !== this.#marker ||
      this.#running?.controller !== round ||
      round.signal.aborted ||
      (controller.signal.aborted && controller.signal.reason !== 'timeout')
    )
      return
    const ok = result.directRange && result.bytes >= 64 * 1024
    const failure: FailureKind | null =
      applied.decision.routeType === 'native-signed' && [403, 451, 959].includes(result.status ?? 0)
        ? 'native-invalid'
        : result.reason === 'timeout'
          ? 'timeout'
          : result.reason === 'network'
            ? 'network'
            : null
    await this.routes.recordChallenge(
      applied,
      result.bytes,
      result.elapsedMs,
      result.ttfbMs,
      ok ? 'success' : 'failure',
      failure,
    )
    if (marker !== this.#marker || this.#running?.controller !== round || round.signal.aborted)
      return
    this.#snapshot = Object.freeze({
      state: ok ? 'complete' : 'failed',
      reason: ok ? 'sample-recorded' : result.directRange ? 'short-response' : result.reason,
      lastAttemptAt: startedAt,
      host: applied.decision.host,
    })
  }

  #unsafeReason(status: MeasurementStatus): string | null {
    if (status.disabled) return 'disabled'
    if (!status.generationActive || !status.representation || !status.demand)
      return 'no-representation'
    if (!status.visible) return 'hidden'
    if (status.seeking) return 'seeking'
    if (status.recovering) return 'recovering'
    if (status.stableProgressSec < 20) return 'awaiting-progress'
    if (status.playableBufferSec < 30) return 'low-buffer'
    return null
  }
}
