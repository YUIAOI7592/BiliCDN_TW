import type { AppliedRouteDecision, RouteCoordinator } from './route-coordinator.ts'
import type { FailureKind, PlaybackDemand, RepresentationId } from '../domain/model.ts'
import type { StoragePort } from '../platform/storage.ts'

const META_KEY = 'bilicdn.v2.meta'
const CHALLENGE_COOLDOWN_MS = 10 * 60 * 1000
const CHALLENGE_TIMEOUT_MS = 3000

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
}

export class MeasurementController {
  #running: { readonly controller: AbortController; readonly generationMarker: number } | null = null
  #manualRequested = false
  #preferNative = false
  #generationMarker = 0
  #snapshot: MeasurementSnapshot = Object.freeze({ state: 'idle', reason: 'startup', lastAttemptAt: 0, host: null })

  constructor(
    private readonly routes: RouteCoordinator,
    private readonly storage: StoragePort,
    private readonly nativeFetch: typeof fetch,
    private readonly now: () => number,
  ) {}

  snapshot(): MeasurementSnapshot { return this.#snapshot }
  reset(): void { this.cancel('generation'); this.#generationMarker++; this.#manualRequested = false; this.#snapshot = Object.freeze({ state: 'idle', reason: 'generation', lastAttemptAt: 0, host: null }) }
  requestManual(): void { this.#manualRequested = true }
  cancel(reason: string): void { if (this.#running) this.#running.controller.abort(reason); this.#running = null }

  tick(status: MeasurementStatus): void {
    const unsafe = this.#unsafeReason(status)
    if (this.#running && unsafe) { this.cancel(unsafe); this.#snapshot = Object.freeze({ ...this.#snapshot, state: 'cancelled', reason: unsafe }); return }
    if (this.#running) return
    if (unsafe) { this.#snapshot = Object.freeze({ ...this.#snapshot, state: 'waiting', reason: unsafe }); return }
    void this.#tryStart(status)
  }

  async #tryStart(status: MeasurementStatus): Promise<void> {
    if (!status.representation || !status.demand || this.#running) return
    const now = this.now()
    let claimed = false
    await this.storage.withLock('measurement', () => {
      const raw = this.storage.get<unknown>(META_KEY, null)
      const meta = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
      const last = Number(meta.lastChallengeAt) || 0
      if (now - last < CHALLENGE_COOLDOWN_MS) return
      this.storage.set(META_KEY, { schema: 2, lastChallengeAt: now, updatedAt: now })
      claimed = true
    })
    if (!claimed) { this.#snapshot = Object.freeze({ ...this.#snapshot, state: 'waiting', reason: 'cross-tab-cooldown' }); return }
    const applied = this.routes.challenge(status.representation, status.demand, this.#preferNative)
    this.#preferNative = !this.#preferNative
    this.#manualRequested = false
    if (!applied?.url) { this.#snapshot = Object.freeze({ state: 'complete', reason: 'no-stale-candidate', lastAttemptAt: now, host: null }); return }
    const controller = new AbortController(), marker = this.#generationMarker
    this.#running = { controller, generationMarker: marker }
    this.#snapshot = Object.freeze({ state: 'running', reason: 'safe-challenger', lastAttemptAt: now, host: applied.decision.host })
    await this.#run(applied, status.demand, controller, marker)
  }

  async #run(applied: AppliedRouteDecision, demand: PlaybackDemand, controller: AbortController, marker: number): Promise<void> {
    const startedAt = this.now(), maxBytes = demand.highDemand ? 768 * 1024 : 384 * 1024
    const timeout = setTimeout(() => controller.abort('timeout'), CHALLENGE_TIMEOUT_MS)
    let bytes = 0, responseAt = 0, failure: FailureKind | null = null, ok = false
    try {
      const response = await this.nativeFetch(applied.url ?? '', {
        method: 'GET', headers: { Range: `bytes=0-${maxBytes - 1}` }, credentials: 'omit', cache: 'no-store', signal: controller.signal,
      })
      responseAt = this.now()
      if (!response.ok || !response.body) {
        failure = applied.decision.routeType === 'native-signed' && [403,451,959].includes(response.status)
          ? 'native-invalid' : response.status >= 500 ? 'http-5xx' : null
      }
      else {
        const reader = response.body.getReader()
        try {
          while (bytes < maxBytes) {
            const item = await reader.read()
            if (item.done) break
            bytes += item.value.byteLength
            if (bytes >= maxBytes) { await reader.cancel('sample-complete'); break }
          }
          ok = bytes >= 64 * 1024
          if (!ok) failure = 'body'
        } finally { try { reader.releaseLock() } catch { /* browser-owned */ } }
      }
    } catch (error) {
      if (controller.signal.aborted && controller.signal.reason !== 'timeout') {
        this.#snapshot = Object.freeze({ state: 'cancelled', reason: String(controller.signal.reason || 'cancelled').slice(0, 48), lastAttemptAt: startedAt, host: applied.decision.host })
        return
      }
      failure = controller.signal.reason === 'timeout' ? 'timeout' : 'network'
    } finally {
      clearTimeout(timeout)
      if (this.#running?.generationMarker === marker) this.#running = null
    }
    if (marker !== this.#generationMarker) return
    const elapsed = Math.max(1, this.now() - startedAt), ttfb = responseAt ? responseAt - startedAt : null
    await this.routes.recordChallenge(applied, bytes, elapsed, ttfb, ok ? 'success' : 'failure', failure)
    this.#snapshot = Object.freeze({ state: ok ? 'complete' : 'failed', reason: ok ? 'sample-recorded' : failure ?? 'http-status', lastAttemptAt: startedAt, host: applied.decision.host })
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
