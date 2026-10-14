import type { DomainEvent, RequestContext, RouteIdentity } from '../domain/model.ts'
import type { PlaybackDiagnosticSample } from '../domain/diagnostic-model.ts'
import type { AttemptStage, RouteAttemptSummary } from './model.ts'
import { diagnosticText as text, finiteDiagnosticNumber as finite } from './values.ts'

interface RouteAttempt {
  actionId: string
  decisionId: string
  host: string
  identity: RouteIdentity
  at: number
  stage: AttemptStage
  baselinePositionSec: number | null
  baselineEndSec: number | null
  baselineCaptured: boolean
  requestAt: number | null
  responseAt: number | null
  playbackAt: number | null
  requests: number
  successes: number
  failures: number
  aborts: number
  zeroByteAborts: number
  noResponseAborts: number
  lastOutcomeAt: number | null
  lastFailureKind: string | null
  mixed: boolean
  progressTicks: number
  lastProgressAt: number | null
  lastPositionSec: number | null
  requestIds: Set<string>
  responseIds: Set<string>
}
/** Owns bounded attribution evidence, without emitting events or holding URL authority. */
export class RouteAttemptTracker {
  #attempts: RouteAttempt[] = []
  #evictions = 0
  constructor(private readonly now: () => number) {}
  tick(): void {
    const active = this.#activeAttempt()
    if (
      active &&
      this.now() - active.at >= 30_000 &&
      !['playback-observed', 'mixed-evidence'].includes(active.stage)
    )
      active.stage = 'unconfirmed'
  }
  record(event: DomainEvent): number {
    const before = this.#evictions
    this.#observeEvent(event)
    return this.#evictions - before
  }
  interrupt(): void {
    const active = this.#activeAttempt()
    if (active) active.stage = 'interrupted'
  }
  recordPlayer(sample: PlaybackDiagnosticSample): void {
    const active = this.#activeAttempt()
    if (active) {
      if (
        !sample.enabled ||
        sample.originalComparison ||
        sample.generation !== active.identity.generation ||
        sample.epoch !== active.identity.epoch
      ) {
        active.stage = 'interrupted'
      } else if (sample.seeking || sample.ended) {
        active.stage = 'interrupted'
      } else {
        if (!active.baselineCaptured) {
          active.baselineCaptured = true
          active.baselinePositionSec = finite(sample.currentTimeSec, 0, 86400)
          const buffer = finite(sample.playableBufferSec, 0, 86400)
          active.baselineEndSec =
            active.baselinePositionSec !== null && buffer !== null
              ? active.baselinePositionSec + buffer
              : null
        }
        const position = finite(sample.currentTimeSec, 0, 86400)
        const progressing =
          !sample.paused &&
          !sample.seeking &&
          !sample.ended &&
          position !== null &&
          active.lastPositionSec !== null &&
          position > active.lastPositionSec + 0.05
        if (progressing && active.responseAt === null && active.stage !== 'mixed-evidence')
          active.stage = 'progress-unconfirmed'
        if (
          active.responseAt !== null &&
          !active.mixed &&
          active.stage !== 'playback-observed' &&
          active.stage !== 'unconfirmed'
        ) {
          const beyond =
            progressing && active.baselineEndSec !== null && position > active.baselineEndSec + 0.1
          const contiguous =
            active.lastProgressAt !== null &&
            sample.at > active.lastProgressAt &&
            sample.at - active.lastProgressAt <= 2000
          active.progressTicks = beyond ? (contiguous ? active.progressTicks + 1 : 1) : 0
          active.lastProgressAt = beyond ? sample.at : null
          if (active.progressTicks >= 2) {
            active.stage = 'playback-observed'
            active.playbackAt = sample.at
          }
        }
        active.lastPositionSec = position
      }
    }
  }
  clear(): void {
    this.#attempts = []
  }
  dropOldest(): boolean {
    if (this.#attempts.length <= 1) return false
    this.#attempts.shift()
    return true
  }
  snapshot(projectHost: (host: string | null) => string | null): RouteAttemptSummary[] {
    return this.#attempts.map((row) => this.#attemptSummary(row, projectHost))
  }
  #activeAttempt(): RouteAttempt | null {
    const row = this.#attempts.at(-1)
    return row &&
      !['mixed-evidence', 'unconfirmed', 'superseded', 'interrupted'].includes(row.stage) &&
      !(row.stage === 'playback-observed' && this.now() - row.at >= 30_000)
      ? row
      : null
  }
  #matches(request: RequestContext | undefined, attempt: RouteAttempt): boolean {
    return (
      !!request &&
      request.kind === 'video' &&
      request.attributionStatus === 'matched' &&
      request.generation === attempt.identity.generation &&
      request.epoch === attempt.identity.epoch &&
      request.representation === attempt.identity.representation &&
      request.authorityRevision === attempt.identity.authorityRevision &&
      request.decisionId === attempt.decisionId &&
      request.targetHost === attempt.host &&
      request.startedAt >= attempt.at
    )
  }
  #observeEvent(event: DomainEvent): void {
    if (
      event.type === 'recovery' &&
      event.action.action === 'route-fallback' &&
      event.action.kind === 'video'
    ) {
      const active = this.#activeAttempt()
      if (active && active.stage !== 'playback-observed') active.stage = 'superseded'
      this.#attempts.push({
        actionId: event.action.id,
        decisionId: event.action.decision.id,
        host: event.action.decision.host ?? '',
        identity: event.action.identity,
        at: event.at,
        stage: 'planned',
        baselinePositionSec: null,
        baselineEndSec: null,
        baselineCaptured: false,
        requestAt: null,
        responseAt: null,
        playbackAt: null,
        requests: 0,
        successes: 0,
        failures: 0,
        aborts: 0,
        zeroByteAborts: 0,
        noResponseAborts: 0,
        lastOutcomeAt: null,
        lastFailureKind: null,
        mixed: false,
        progressTicks: 0,
        lastProgressAt: null,
        lastPositionSec: null,
        requestIds: new Set<string>(),
        responseIds: new Set<string>(),
      })
      while (this.#attempts.length > 6) {
        this.#attempts.shift()
        this.#evictions++
      }
      return
    }
    const active = this.#activeAttempt()
    if (!active) return
    if (event.type === 'lifecycle') {
      if (event.generation !== active.identity.generation || event.epoch !== active.identity.epoch)
        active.stage = 'interrupted'
      return
    }
    if (event.type === 'request-started') {
      if (!this.#matches(event.request, active)) return
      if (active.requestIds.size >= 32)
        active.requestIds.delete(active.requestIds.values().next().value as string)
      active.requestIds.add(event.request.requestId)
      active.requests++
      active.requestAt ??= event.at
      if (active.stage === 'planned') active.stage = 'sent'
      return
    }
    if (event.type !== 'transport-completed' && event.type !== 'route-confirmed') return
    const observation = event.observation
    if (
      observation.kind === 'video' &&
      observation.outcome === 'success' &&
      observation.bytes > 0 &&
      observation.generation === active.identity.generation &&
      observation.epoch === active.identity.epoch &&
      observation.representation === active.identity.representation &&
      observation.finalHost &&
      observation.finalHost !== active.host &&
      event.type === 'route-confirmed'
    ) {
      active.mixed = true
      active.stage = 'mixed-evidence'
      return
    }
    if (
      !this.#matches(observation.request, active) ||
      !active.requestIds.has(observation.request!.requestId)
    )
      return
    if (event.type === 'transport-completed') {
      if (event.detached) return
      active.lastOutcomeAt = observation.completedAt
      if (observation.outcome === 'abort') {
        active.aborts++
        if (observation.bytes === 0) active.zeroByteAborts++
        if (observation.status === 0 && observation.finalHost === null) active.noResponseAborts++
      } else if (observation.outcome === 'failure') {
        active.failures++
        active.lastFailureKind = observation.failureKind ?? 'unknown'
      } else active.successes++
      return
    }
    if (
      observation.outcome !== 'success' ||
      observation.status !== 206 ||
      observation.bytes <= 0 ||
      observation.finalHost !== active.host ||
      observation.responseUrlMatchesRequest !== true ||
      active.responseIds.has(observation.request!.requestId)
    )
      return
    active.responseIds.add(observation.request!.requestId)
    if (active.responseAt === null) {
      active.responseAt = event.at
      active.stage = 'response-observed'
      active.progressTicks = 0
      active.lastProgressAt = null
    }
  }
  #attemptSummary(row: RouteAttempt, projectHost: (host: string | null) => string | null) {
    return {
      actionId: text(row.actionId),
      decisionId: text(row.decisionId),
      host: projectHost(row.host),
      generation: row.identity.generation,
      epoch: row.identity.epoch,
      representation: text(row.identity.representation),
      authorityRevision: row.identity.authorityRevision,
      at: row.at,
      stage: row.stage,
      baselinePositionSec: row.baselinePositionSec,
      baselineEndSec: row.baselineEndSec,
      requestAt: row.requestAt,
      responseAt: row.responseAt,
      playbackAt: row.playbackAt,
      requests: row.requests,
      successes: row.successes,
      failures: row.failures,
      aborts: row.aborts,
      zeroByteAborts: row.zeroByteAborts,
      noResponseAborts: row.noResponseAborts,
      lastOutcomeAt: row.lastOutcomeAt,
      lastFailureKind: row.lastFailureKind,
      mixed: row.mixed,
    }
  }
}
