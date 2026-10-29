import type { AppliedRouteDecision, StartupCandidate, StartupOptions } from './route-model.ts'
import type {
  FailureKind,
  PlaybackDemand,
  RouteIdentity,
  SignedRouteHandle,
} from '../domain/model.ts'
import { probeStartByte } from '../domain/probe-range.ts'
import { mediaIdentity } from '../domain/url-policy.ts'
import { isHkTestCandidate } from '../domain/catalog.ts'
import type { SettingsPort } from '../state/settings-ports.ts'
import type { CatalogValidationContext } from './route-model.ts'

import type { RangeProbePort, SchedulerPort } from './ports.ts'

const COOLDOWN_MS = 10 * 60_000
const TIMEOUT_MS = 3000
const nextCursor = (cursor: number): number =>
  Number.isSafeInteger(cursor) && cursor >= 0 && cursor < Number.MAX_SAFE_INTEGER ? cursor + 1 : 0
const cancellationReason = (signal: AbortSignal): unknown =>
  'reason' in signal ? signal.reason : new DOMException('Aborted', 'AbortError')

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

interface RoundRange {
  readonly identity: RouteIdentity
  readonly handle: SignedRouteHandle
  readonly startByte: number
  readonly sizeKnown: boolean
}

import type {
  MeasurementPort,
  MeasurementRoutes,
  MeasurementMetadataPort,
  MeasurementRangeMetadataPort,
} from './measurement-ports.ts'
export type { MeasurementRoutes, MeasurementMetadataPort } from './measurement-ports.ts'

import type { MeasurementStatus, MeasurementSnapshot } from './measurement-model.ts'
export type { MeasurementStatus, MeasurementSnapshot } from './measurement-model.ts'

export class MeasurementController implements MeasurementPort {
  #validation: (CatalogValidationContext & { readonly hosts: readonly string[] }) | null = null
  #validationState: MeasurementSnapshot['validation']
  #stopSettings: (() => void) | null = null
  #disposed = false
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
    private readonly meta: MeasurementMetadataPort,
    private readonly probe: RangeProbePort,
    private readonly now: () => number,
    private readonly scheduler: SchedulerPort,
    private readonly rangeMetadata?: MeasurementRangeMetadataPort,
    private readonly random: () => number = () => 0,
    private readonly settings?: Pick<SettingsPort, 'get' | 'subscribe'>,
  ) {
    if (settings) {
      const signature = () => {
        const s = settings.get()
        return JSON.stringify([
          s.disabled,
          s.fixedHost,
          s.considerNativeSources,
          s.catalogOverrides,
          s.startupEarlyReleaseEnabled,
          s.healthMiddleRangeEnabled,
        ])
      }
      let previous = signature()
      this.#stopSettings = settings.subscribe(() => {
        const next = signature()
        if (previous === next) return
        previous = next
        this.#marker++
        this.cancel('test-policy-changed')
        this.#startupController?.abort('test-policy-changed')
      })
    }
  }

  snapshot(): MeasurementSnapshot {
    return Object.freeze({
      ...this.#snapshot,
      startup: this.#startupState,
      ...(this.#validationState ? { validation: this.#validationState } : {}),
    })
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
  requestCatalogValidation(hosts: readonly string[]): void {
    const settings = this.settings?.get()
    const representation = this.#lastStatus?.representation
    if (
      this.#disposed ||
      !settings ||
      !representation ||
      hosts.length < 1 ||
      hosts.length > 3 ||
      new Set(hosts).size !== hosts.length ||
      hosts.some((host) => !isHkTestCandidate(host) || settings.catalogOverrides[host] !== true)
    )
      throw new TypeError('Select enabled HK test candidates in a current video')
    const context = this.routes.catalogValidationContext(representation)
    if (!context) throw new TypeError('Catalog validation requires automatic Catalog video mode')
    if (this.#running || this.#planning || this.#validation) return
    this.#validation = Object.freeze({ ...context, hosts: Object.freeze([...hosts]) })
    this.#validationState = Object.freeze({
      state: 'queued',
      reason: 'awaiting-eligible-round',
      hosts: this.#validation.hosts,
      results: Object.freeze([]),
    })
  }
  #validationCurrent(): boolean {
    const pending = this.#validation
    if (!pending) return true
    if (this.#lastStatus?.representation !== pending.identity.representation) return false
    const current = this.routes.catalogValidationContext(pending.identity.representation)
    return (
      !!current &&
      current.identity === pending.identity &&
      current.policyRevision === pending.policyRevision
    )
  }
  dispose(): void {
    this.#disposed = true
    this.#stopSettings?.()
    this.#stopSettings = null
    this.reset()
  }
  startupFallbackHosts(): readonly string[] {
    return this.#startupQualifiedHosts
  }
  cancel(reason: string): void {
    if (this.#validation) {
      this.#validation = null
      if (this.#validationState)
        this.#validationState = Object.freeze({
          ...this.#validationState,
          state: 'cancelled',
          reason,
        })
    }
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
          const currentCursor = this.meta.get().catalogCursor
          if (marker !== this.#marker) return
          this.meta.update({ catalogCursor: nextCursor(currentCursor) })
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
    const startedAt = this.now(),
      catalogOnlyAtStart = this.routes.isCatalogOnly()
    let timer: (() => void) | null = null
    let sealed = false,
      releaseReason = 'complete',
      remaining = options.candidates.length
    let resolveWindow!: () => void, rejectWindow!: (error: unknown) => void
    const completion = new Promise<void>((resolve, reject) => {
      resolveWindow = resolve
      rejectWindow = reject
    })
    const finish = (reason: string): void => {
      if (sealed) return
      sealed = true
      releaseReason = reason
      resolveWindow()
    }
    const aborted = (): void => finish('cancelled')
    controller.signal.addEventListener('abort', aborted, { once: true })
    timer = this.scheduler.timeout(() => {
      finish('deadline')
      controller.abort('startup-deadline')
    }, TIMEOUT_MS)
    for (const candidate of options.candidates) {
      if (sealed || controller.signal.aborted) break
      void this.#probeStartup(candidate, options.demand, controller.signal).then(
        (result) => {
          if (sealed || marker !== this.#marker) return
          results.push(result)
          if (
            catalogOnlyAtStart &&
            this.settings?.get().startupEarlyReleaseEnabled !== false &&
            this.routes.isCatalogOnly() &&
            candidate.type === 'catalog-generated' &&
            result.valid &&
            (result.safeMbps ?? 0) / options.demand.requiredMbps >= 1.35
          )
            finish('qualified-early')
          else if (--remaining === 0) finish('complete')
        },
        (error: unknown) => {
          if (sealed) return
          sealed = true
          rejectWindow(error)
        },
      )
    }
    try {
      await completion
    } finally {
      sealed = true
      if (timer !== null) (timer as () => void)()
      controller.signal.removeEventListener('abort', aborted)
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
      reason:
        releaseReason === 'qualified-early'
          ? releaseReason
          : valid.length
            ? 'measured'
            : 'inconclusive',
      candidates: options.candidates.length,
      selectedHost: decision?.host ?? null,
      delayed: true,
      elapsedMs: Math.max(0, this.now() - startedAt),
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
          .recordStartupSuccess(
            result.candidate,
            result.bytes,
            result.elapsedMs,
            result.ttfbMs,
            () => !this.#disposed && marker === this.#marker,
          )
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
      (candidate.cachedSafeMbps !== null ? result.bytes >= 16 * 1024 : result.bytes >= 64 * 1024)
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
    if (this.#disposed) return
    this.#lastStatus = status
    if (!this.#validationCurrent()) this.cancel('validation-context-changed')
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
    const validation = this.#validation
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
        if (validation) {
          if (this.#validation !== validation || !this.#validationCurrent()) return
          for (const host of validation.hosts) {
            first = this.routes.challenge(
              current.representation!,
              current.demand,
              false,
              new Set(),
              cursor,
              { ...validation, host },
            )
            if (first?.url) break
          }
        } else
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
        this.meta.update({ lastChallengeAt: at, catalogCursor: nextCursor(cursor) })
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
        if (validation && !cooldown) this.cancel('no-legal-validation-target')
        return
      }
      this.#preferNative = !this.#preferNative
      this.#manualRequested = false
      const controller = new AbortController(),
        marker = this.#marker
      running = { controller, marker }
      this.#running = running
      if (validation && this.#validationState)
        this.#validationState = Object.freeze({
          ...this.#validationState,
          state: 'running',
          reason: 'probing',
        })
      await this.#runRound(planned, status, controller, marker, cursor, validation)
      if (validation && this.#validation === validation && controller.signal.aborted)
        this.cancel('validation-round-cancelled')
      if (
        validation &&
        this.#validation === validation &&
        !controller.signal.aborted &&
        this.#validationState
      ) {
        this.#validationState = Object.freeze({
          ...this.#validationState,
          state: 'complete',
          reason: 'round-complete',
        })
        this.#validation = null
      }
    } catch {
      if (
        planningMarker === this.#marker &&
        this.#planning === planning &&
        (!running || (this.#running === running && !running.controller.signal.aborted))
      ) {
        this.#failedAt = this.now()
        if (validation && this.#validation === validation) this.cancel('measurement-error')
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
    validation: (CatalogValidationContext & { readonly hosts: readonly string[] }) | null,
  ): Promise<void> {
    const context = first.context
    const handle =
      context && this.routes.isCatalogOnly()
        ? (this.rangeMetadata?.catalogSourceHandle(context.representation) ?? null)
        : null
    const totalBytes =
      context && handle ? (this.rangeMetadata?.rangeSize(context, handle) ?? null) : null
    const range: RoundRange | null =
      context && handle
        ? {
            identity: context,
            handle,
            sizeKnown: totalBytes !== null,
            startByte: probeStartByte(
              this.settings?.get().healthMiddleRangeEnabled === false ? null : totalBytes,
              status.demand!.highDemand ? 768 * 1024 : 384 * 1024,
              totalBytes === null ? 0 : this.random(),
            ),
          }
        : null
    const excluded = new Set<string>()
    let catalogCount = 0,
      nativeCount = 0
    let next: AppliedRouteDecision | null = first
    for (let index = 0; index < 3 && next?.url && !controller.signal.aborted; index++) {
      const current = this.#lastStatus ?? status
      const unsafe = this.#unsafeReason(current)
      if (
        unsafe ||
        marker !== this.#marker ||
        current.representation !== status.representation ||
        (validation && (this.#validation !== validation || !this.#validationCurrent()))
      ) {
        controller.abort(unsafe ?? 'representation-changed')
        break
      }
      const applied: AppliedRouteDecision = next
      if (
        range &&
        (!this.rangeMetadata?.resolve(range.handle, range.identity) ||
          this.rangeMetadata.catalogSourceHandle(range.identity.representation) !== range.handle)
      ) {
        controller.abort('source-changed')
        break
      }
      if (applied.decision.host) excluded.add(applied.decision.host)
      if (applied.decision.routeType === 'native-signed') nativeCount++
      else catalogCount++
      this.#snapshot = Object.freeze({
        state: 'running',
        reason: 'candidate-' + (index + 1),
        lastAttemptAt: this.now(),
        host: applied.decision.host,
        range: {
          mode: range?.startByte ? ('middle' as const) : ('head' as const),
          sizeKnown: range?.sizeKnown ?? false,
        },
      })
      await this.#runCandidate(applied, status.demand!, controller, marker, range)
      if (
        index === 2 ||
        controller.signal.aborted ||
        marker !== this.#marker ||
        this.#running?.controller !== controller
      )
        break
      cursor = nextCursor(cursor)
      if (validation) {
        next = null
        for (const host of validation.hosts) {
          if (excluded.has(host)) continue
          next = this.routes.challenge(
            status.representation!,
            status.demand!,
            false,
            excluded,
            cursor,
            { ...validation, host },
          )
          if (next?.url) break
        }
      } else
        next = this.routes.challenge(
          status.representation!,
          status.demand!,
          nativeCount === 0 && catalogCount >= 2,
          excluded,
          cursor,
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
    range: RoundRange | null,
  ): Promise<void> {
    const startedAt = this.now(),
      limit = demand.highDemand ? 768 * 1024 : 384 * 1024
    const controller = new AbortController()
    const cancel = (): void => controller.abort(round.signal.reason)
    round.signal.addEventListener('abort', cancel, { once: true })
    const stopTimeout = this.scheduler.timeout(() => controller.abort('timeout'), TIMEOUT_MS)
    let result
    const source = range ? this.rangeMetadata?.resolve(range.handle, range.identity) : null
    const usesRange =
      !!source &&
      !!applied.url &&
      applied.decision.routeType === 'catalog-generated' &&
      mediaIdentity(source) === mediaIdentity(applied.url!)
    const startByte = usesRange ? range!.startByte : 0
    try {
      result = await this.probe.read({
        url: applied.url ?? '',
        host: applied.decision.host,
        limit,
        startByte,
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
    if (!this.#validationCurrent()) {
      this.cancel('validation-context-changed')
      return
    }
    if (
      usesRange &&
      range &&
      this.rangeMetadata?.resolve(range.handle, range.identity) &&
      this.rangeMetadata.catalogSourceHandle(range.identity.representation) === range.handle
    ) {
      if (result.status === 416)
        this.rangeMetadata.recordRangeSize(range.identity, range.handle, null)
      else if (result.directRange && result.range)
        this.rangeMetadata.recordRangeSize(range.identity, range.handle, result.range.totalBytes)
    }
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
      () =>
        !this.#disposed &&
        marker === this.#marker &&
        this.#running?.controller === round &&
        !round.signal.aborted &&
        this.#validationCurrent(),
    )
    if (marker !== this.#marker || this.#running?.controller !== round || round.signal.aborted)
      return
    if (this.#validationState?.state === 'running') {
      this.#validationState = Object.freeze({
        ...this.#validationState,
        results: Object.freeze(
          [
            ...this.#validationState.results,
            Object.freeze({
              host: applied.decision.host ?? '',
              valid: ok,
              safeMbps:
                ok && result.elapsedMs > 0
                  ? ((result.bytes * 8) / result.elapsedMs / 1000) * 0.7
                  : null,
              bytes: result.bytes,
              status: result.status,
            }),
          ].slice(0, 3),
        ),
      })
    }
    this.#snapshot = Object.freeze({
      state: ok ? 'complete' : 'failed',
      reason: ok ? 'sample-recorded' : result.directRange ? 'short-response' : result.reason,
      lastAttemptAt: startedAt,
      host: applied.decision.host,
      range: {
        mode: startByte > 0 ? ('middle' as const) : ('head' as const),
        sizeKnown: !!result.range || (usesRange && range!.sizeKnown),
      },
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
