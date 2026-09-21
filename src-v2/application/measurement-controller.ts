import type { AppliedRouteDecision, RouteCoordinator, StartupCandidate, StartupOptions } from './route-coordinator.ts'
import type { FailureKind, PlaybackDemand, RepresentationId } from '../domain/model.ts'
import type { StoragePort } from '../platform/storage.ts'

const META_KEY = 'bilicdn.v2.meta'
const COOLDOWN_MS = 10 * 60_000
const TIMEOUT_MS = 3000

interface MeasurementStatus {
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

export interface MeasurementSnapshot {
  readonly state: 'idle' | 'waiting' | 'running' | 'complete' | 'failed' | 'cancelled'
  readonly reason: string
  readonly lastAttemptAt: number
  readonly host: string | null
  readonly startup?: { readonly state: string; readonly reason: string; readonly candidates: number; readonly selectedHost: string | null;
    readonly delayed: boolean; readonly results?: readonly { readonly host: string; readonly type: string; readonly valid: boolean;
      readonly safeMbps: number | null; readonly status: number | null; readonly reason: string }[] }
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

export class MeasurementController {
  #running: { readonly controller: AbortController; readonly marker: number } | null = null
  #planning = false
  #manualRequested = false
  #preferNative = false
  #marker = 0
  #lastStatus: MeasurementStatus | null = null
  #startupUsed = false
  #startupPending: Promise<void> | null = null
  #startupController: AbortController | null = null
  #startupQualifiedHosts: readonly string[] = []
  #startupState: NonNullable<MeasurementSnapshot['startup']> = Object.freeze({
    state: 'idle', reason: 'not-requested', candidates: 0, selectedHost: null, delayed: false,
  })
  #snapshot: MeasurementSnapshot = Object.freeze({ state: 'idle', reason: 'startup', lastAttemptAt: 0, host: null })

  constructor(
    private readonly routes: RouteCoordinator,
    private readonly storage: StoragePort,
    private readonly nativeFetch: typeof fetch,
    private readonly now: () => number,
  ) {}

  snapshot(): MeasurementSnapshot { return Object.freeze({ ...this.#snapshot, startup: this.#startupState }) }
  reset(): void {
    this.cancel('generation')
    this.#startupController?.abort('generation')
    this.#startupController = null
    this.#startupPending = null
    this.#startupQualifiedHosts = []
    this.#marker++
    this.#manualRequested = false
    this.#snapshot = Object.freeze({ state: 'idle', reason: 'generation', lastAttemptAt: 0, host: null })
  }
  requestManual(): void { this.#manualRequested = true }
  startupFallbackHosts(): readonly string[] { return this.#startupQualifiedHosts }
  cancel(reason: string): void { this.#running?.controller.abort(reason); this.#running = null }
  willGateStartup(url: string): boolean {
    return !this.#startupUsed && (!!this.#startupPending || !!this.routes.startupOptions(url)?.candidates.length)
  }

  /** The player request, never a page hint, authorizes this one bounded startup window. */
  async prepareStartup(url: string, signal: AbortSignal | null = null): Promise<void> {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    if (this.#startupUsed) return
    if (!this.#startupPending) {
      const cursor = Math.max(0, Number(this.#meta().catalogCursor) || 0)
      const options = this.routes.startupOptions(url, cursor)
      if (!options?.candidates.length) {
        this.noteUnpreflighted('unsupported-or-no-legal-candidate')
        return
      }
      const controller = new AbortController(), marker = this.#marker
      this.#startupController = controller
      this.#startupState = Object.freeze({ state: 'running', reason: 'player-media-request',
        candidates: options.candidates.length, selectedHost: null, delayed: true })
      this.#startupPending = this.#runStartup(url, options, controller, marker).catch(() => {
        if (marker === this.#marker) this.#startupState = Object.freeze({ state: 'skipped', reason: 'preflight-error',
          candidates: options.candidates.length, selectedHost: null, delayed: true })
      }).finally(() => {
        if (this.#startupController === controller) this.#startupController = null
        if (marker === this.#marker) this.#startupPending = null
      })
      void this.storage.withLock('measurement', () => {
        const meta = this.#meta()
        this.storage.set(META_KEY, { ...meta, schema: 2, catalogCursor: cursor + 1, updatedAt: this.now() })
      }).catch(() => undefined)
    }
    const pending = this.#startupPending
    if (!pending) return
    if (!signal) { await pending; return }
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    let onAbort: (() => void) | null = null
    try {
      await Promise.race([pending, new Promise<never>((_resolve, reject) => {
        onAbort = () => reject(new DOMException('Aborted', 'AbortError'))
        signal.addEventListener('abort', onAbort, { once: true })
      })])
    } finally { if (onAbort) signal.removeEventListener('abort', onAbort) }
  }

  noteUnpreflighted(reason: string): void {
    if (this.#startupUsed || this.#startupPending) return
    this.#startupState = Object.freeze({ state: 'skipped', reason: reason.slice(0, 48),
      candidates: 0, selectedHost: null, delayed: false })
  }

  async #runStartup(url: string, options: StartupOptions, controller: AbortController, marker: number): Promise<void> {
    const results: ProbeResult[] = []
    let timer: ReturnType<typeof setTimeout> | null = null
    const deadline = new Promise<void>(resolve => {
      timer = setTimeout(() => { controller.abort('startup-deadline'); resolve() }, TIMEOUT_MS)
    })
    const complete = Promise.all(options.candidates.map(async candidate => {
      const result = await this.#probeStartup(candidate, options.demand, controller.signal)
      if (marker === this.#marker) results.push(result)
    })).then(() => undefined)
    await Promise.race([complete, deadline])
    if (timer !== null) clearTimeout(timer)
    controller.abort('startup-complete')
    if (marker !== this.#marker) return
    for (const result of results) this.routes.noteStartupProbeResult(result.candidate, result.status)
    const valid = results.filter(result => result.valid && result.safeMbps !== null)
    const qualified = valid.filter(result => (result.safeMbps ?? 0) / options.demand.requiredMbps >= 1.35)
    const ranked = [...qualified].sort((a, b) => (b.safeMbps ?? 0) - (a.safeMbps ?? 0))
    let winner = ranked[0]?.candidate ?? options.candidates.find(candidate => candidate.original)
      ?? [...valid].sort((a, b) => (b.safeMbps ?? 0) - (a.safeMbps ?? 0))[0]?.candidate ?? options.candidates[0] ?? null
    const original = valid.find(result => result.candidate.original)
    if (winner && original && !winner.original && (original.safeMbps ?? 0) >= (ranked[0]?.safeMbps ?? 0) * 0.9) winner = original.candidate
    const decision = this.routes.commitStartupChoice(url, winner, valid.length ? 'startup-preflight' : 'startup-inconclusive')
    this.#startupQualifiedHosts = Object.freeze([...valid].sort((a, b) => (b.safeMbps ?? 0) - (a.safeMbps ?? 0)).map(result => result.candidate.host))
    this.#startupUsed = true
    this.#startupState = Object.freeze({ state: decision ? 'complete' : 'skipped',
      reason: valid.length ? 'measured' : 'inconclusive', candidates: options.candidates.length,
      selectedHost: decision?.host ?? null, delayed: true,
      results: Object.freeze(results.slice(0, 3).map(result => Object.freeze({ host: result.candidate.host,
        type: result.candidate.type, valid: result.valid, safeMbps: result.safeMbps, status: result.status, reason: result.reason }))) })
    for (const result of valid) if (result.candidate.cachedSafeMbps === null) {
      void this.routes.recordStartupSuccess(result.candidate, result.bytes, result.elapsedMs, result.ttfbMs).catch(() => undefined)
    }
  }

  async #probeStartup(candidate: StartupCandidate, demand: PlaybackDemand, signal: AbortSignal): Promise<ProbeResult> {
    const startedAt = this.now()
    const limit = candidate.cachedSafeMbps !== null ? 16 * 1024 : demand.highDemand ? 512 * 1024 : 256 * 1024
    let bytes = 0, responseAt = 0
    try {
      const response = await this.nativeFetch(candidate.url, { method: 'GET',
        headers: { Range: 'bytes=0-' + (limit - 1) }, credentials: 'omit', cache: 'no-store', signal })
      responseAt = this.now()
      if (response.status !== 206 || !response.body) {
        if (response.body) await response.body.cancel('range-required')
        return { candidate, valid: false, safeMbps: null, bytes: 0,
          elapsedMs: Math.max(1, this.now() - startedAt), ttfbMs: responseAt - startedAt,
          status: response.status, reason: 'http-' + response.status }
      }
      const reader = response.body.getReader()
      try {
        while (bytes < limit && !signal.aborted) {
          const item = await reader.read()
          if (item.done) break
          bytes = Math.min(limit, bytes + item.value.byteLength)
          if (bytes >= limit) { await reader.cancel('startup-sample-complete'); break }
        }
      } finally { try { reader.releaseLock() } catch { /* browser-owned */ } }
      const valid = candidate.cachedSafeMbps !== null ? bytes > 0 : bytes >= 64 * 1024
      const elapsedMs = Math.max(1, this.now() - startedAt)
      return { candidate, valid, safeMbps: valid ? candidate.cachedSafeMbps ?? bytes * 8 / elapsedMs / 1000 * 0.7 : null,
        bytes, elapsedMs, ttfbMs: responseAt - startedAt, status: response.status, reason: valid ? 'measured' : 'short-response' }
    } catch {
      return { candidate, valid: false, safeMbps: null, bytes, elapsedMs: Math.max(1, this.now() - startedAt),
        ttfbMs: responseAt ? responseAt - startedAt : null, status: null, reason: signal.aborted ? 'cancelled' : 'network' }
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
      this.#snapshot = Object.freeze({ ...this.#snapshot, state: 'waiting',
        reason: this.#manualRequested ? 'manual-' + unsafe : unsafe })
      return
    }
    void this.#tryStart(status)
  }

  async #tryStart(status: MeasurementStatus): Promise<void> {
    if (!status.representation || !status.demand || this.#running || this.#planning) return
    this.#planning = true
    try {
      const at = this.now()
      let first: AppliedRouteDecision | null = null, cursor = 0
      await this.storage.withLock('measurement', () => {
        const meta = this.#meta()
        if (at - (Number(meta.lastChallengeAt) || 0) < COOLDOWN_MS) return
        cursor = Math.max(0, Number(meta.catalogCursor) || 0)
        first = this.routes.challenge(status.representation!, status.demand!, this.#preferNative, new Set(), cursor)
        if (!first?.url) return
        this.storage.set(META_KEY, { ...meta, schema: 2, lastChallengeAt: at, catalogCursor: cursor + 1, updatedAt: at })
      })
      const planned = first as AppliedRouteDecision | null
      if (!planned?.url) {
        const cooldown = at - (Number(this.#meta().lastChallengeAt) || 0) < COOLDOWN_MS
        this.#snapshot = Object.freeze({ ...this.#snapshot, state: 'waiting',
          reason: cooldown ? 'cross-tab-cooldown' : 'no-stale-candidate' })
        return
      }
      this.#preferNative = !this.#preferNative
      this.#manualRequested = false
      const controller = new AbortController(), marker = this.#marker
      this.#running = { controller, marker }
      await this.#runRound(planned, status, controller, marker, cursor)
    } finally { this.#planning = false }
  }

  async #runRound(first: AppliedRouteDecision, status: MeasurementStatus, controller: AbortController,
    marker: number, cursor: number): Promise<void> {
    const excluded = new Set<string>()
    let catalogCount = 0, nativeCount = 0
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
      this.#snapshot = Object.freeze({ state: 'running', reason: 'candidate-' + (index + 1),
        lastAttemptAt: this.now(), host: applied.decision.host })
      await this.#runCandidate(applied, status.demand!, controller, marker)
      if (index === 2 || controller.signal.aborted) break
      next = this.routes.challenge(status.representation!, status.demand!,
        nativeCount === 0 && catalogCount >= 2, excluded, cursor + index + 1)
      if (nativeCount >= 1 && next?.decision.routeType === 'native-signed') next = null
    }
    if (this.#running?.marker === marker) this.#running = null
    if (controller.signal.aborted && marker === this.#marker) this.#snapshot = Object.freeze({ ...this.#snapshot,
      state: 'cancelled', reason: String(controller.signal.reason ?? 'cancelled').slice(0, 48) })
  }

  async #runCandidate(applied: AppliedRouteDecision, demand: PlaybackDemand, round: AbortController, marker: number): Promise<void> {
    const startedAt = this.now(), limit = demand.highDemand ? 768 * 1024 : 384 * 1024
    const controller = new AbortController()
    const cancel = (): void => controller.abort(round.signal.reason)
    round.signal.addEventListener('abort', cancel, { once: true })
    const timeout = setTimeout(() => controller.abort('timeout'), TIMEOUT_MS)
    let bytes = 0, responseAt = 0, failure: FailureKind | null = null, ok = false, reason = 'http-status'
    try {
      const response = await this.nativeFetch(applied.url ?? '', { method: 'GET',
        headers: { Range: 'bytes=0-' + (limit - 1) }, credentials: 'omit', cache: 'no-store', signal: controller.signal })
      responseAt = this.now()
      if (response.status !== 206 || !response.body) {
        reason = 'http-' + response.status
        if (response.body) await response.body.cancel('range-required')
        if (applied.decision.routeType === 'native-signed' && [403,451,959].includes(response.status)) failure = 'native-invalid'
      } else {
        const reader = response.body.getReader()
        try {
          while (bytes < limit) {
            const item = await reader.read()
            if (item.done) break
            bytes = Math.min(limit, bytes + item.value.byteLength)
            if (bytes >= limit) { await reader.cancel('sample-complete'); break }
          }
          ok = bytes >= 64 * 1024
          if (!ok) reason = 'short-response'
        } finally { try { reader.releaseLock() } catch { /* browser-owned */ } }
      }
    } catch {
      if (controller.signal.aborted && controller.signal.reason !== 'timeout') return
      failure = controller.signal.reason === 'timeout' ? 'timeout' : 'network'
      reason = failure
    } finally { clearTimeout(timeout); round.signal.removeEventListener('abort', cancel) }
    if (marker !== this.#marker) return
    const elapsed = Math.max(1, this.now() - startedAt)
    await this.routes.recordChallenge(applied, bytes, elapsed, responseAt ? responseAt - startedAt : null,
      ok ? 'success' : 'failure', failure)
    this.#snapshot = Object.freeze({ state: ok ? 'complete' : 'failed', reason: ok ? 'sample-recorded' : reason,
      lastAttemptAt: startedAt, host: applied.decision.host })
  }

  #meta(): Record<string, unknown> {
    const raw = this.storage.get<unknown>(META_KEY, null)
    return raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  }

  #unsafeReason(status: MeasurementStatus): string | null {
    if (status.disabled) return 'disabled'
    if (!status.generationActive || !status.representation || !status.demand) return 'no-representation'
    if (!status.visible) return 'hidden'
    if (status.seeking) return 'seeking'
    if (status.recovering) return 'recovering'
    if (status.stableProgressSec < 20) return 'awaiting-progress'
    if (status.playableBufferSec < 30) return 'low-buffer'
    return null
  }
}
