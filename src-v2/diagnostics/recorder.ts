import type { DomainEvent, RouteDecision, TransportObservation, RequestContext, RouteIdentity } from '../domain/model.ts'
import { assessDemandRatio } from '../domain/routing.ts'
import { isCatalogHost } from '../domain/catalog.ts'
import { isKnownNativeFamily } from '../domain/url-policy.ts'

interface SafeEvent { at: number; type: string; data: Record<string, unknown>; important: boolean }
interface Flow { requests: number; successes: number; failures: number; timeouts: number; aborts: number; zeroByteAborts: number; noResponseAborts: number; bytes: number; lastAt: number; maxElapsedMs: number; maxTtfbMs: number }
interface Incident { id: string; reason: string; startedAt: number; captureUntil: number; state: 'capturing' | 'frozen'; events: SafeEvent[]; flow: Record<string, unknown>[]; playerTrace: string[];
  playerTraceFormat: string; playerTraceFlags: string }
export interface PlaybackDiagnosticSample {
  readonly at: number; readonly generation: number; readonly epoch: number; readonly enabled: boolean; readonly originalComparison: boolean
  readonly currentTimeSec: number; readonly frames: number | null; readonly playableBufferSec: number
  readonly paused: boolean; readonly seeking: boolean; readonly ended: boolean; readonly readyState: number
  readonly coreInitialized: boolean | null; readonly watchdog: string
}
type AttemptStage = 'planned' | 'sent' | 'progress-unconfirmed' | 'response-observed' | 'playback-observed' | 'mixed-evidence' | 'unconfirmed' | 'superseded' | 'interrupted'
interface RouteAttempt {
  actionId: string; decisionId: string; host: string; identity: RouteIdentity; at: number; stage: AttemptStage
  baselinePositionSec: number | null; baselineEndSec: number | null; baselineCaptured: boolean
  requestAt: number | null; responseAt: number | null; playbackAt: number | null
  requests: number; successes: number; failures: number; aborts: number; zeroByteAborts: number; noResponseAborts: number
  lastOutcomeAt: number | null; lastFailureKind: string | null; mixed: boolean; progressTicks: number; lastProgressAt: number | null
  lastPositionSec: number | null; requestIds: Set<string>; responseIds: Set<string>
}
const bytes = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).byteLength
const text = (value: unknown, max = 96): string => String(value ?? '').slice(0, max)

export class DiagnosticRecorder {
  #events: SafeEvent[] = []
  #flow = new Map<string, Flow>()
  #pending = new Map<string, RequestContext>()
  #lastSuccess = new Map<string, Record<string, unknown>>()
  #lastConfirmed = new Map<string, string>()
  #lastAttribution = new Map<string, string>()
  #rankings: Record<string, unknown>[] = []
  #incident: Incident | null = null
  #attempts: RouteAttempt[] = []
  #recentPlayerTrace: { at: number; row: string }[] = []
  #lastPaused: boolean | null = null
  #lastPlayerFrames: number | null = null
  #serial = 0
  #aliases = new Map<string, string>()
  #manualMark: { at: number; reason: string; count: number } | null = null
  #counters = { evicted: 0, incidentReplaced: 0, rankingEvicted: 0, flowEvicted: 0, incidentEvicted: 0, pendingEvicted: 0, eventsExpired: 0, flowsExpired: 0, traceEvicted: 0, attemptEvicted: 0 }
  constructor(private readonly now: () => number, private readonly verbose: () => boolean) {}

  tick(): void {
    if (this.#incident?.state === 'capturing' && this.now() >= this.#incident.captureUntil) this.#incident.state = 'frozen'
    const active = this.#activeAttempt()
    if (active && this.now() - active.at >= 30_000 && !['playback-observed', 'mixed-evidence'].includes(active.stage)) active.stage = 'unconfirmed'
    const floor = this.now() - 60_000
    const events = this.#events.filter(event => event.at >= floor)
    this.#counters.eventsExpired += this.#events.length - events.length
    this.#events = events
    for (const [key, row] of this.#flow) if (row.lastAt < floor) { this.#flow.delete(key); this.#counters.flowsExpired++ }
    for (const [key, row] of this.#pending) if (this.now() - row.startedAt > 120_000) { this.#pending.delete(key); this.#counters.pendingEvicted++ }
  }

  record(event: DomainEvent, routeObservationEnabled = true): void {
    this.tick()
    if (routeObservationEnabled) this.#observeAttempt(event)
    else { const active = this.#activeAttempt(); if (active) active.stage = 'interrupted' }
    if (event.type === 'request-started') {
      this.#pending.set(event.request.requestId, event.request)
      while (this.#pending.size > 32) { this.#pending.delete(this.#pending.keys().next().value as string); this.#counters.pendingEvicted++ }
      return
    }
    if (event.type === 'route-confirmed') {
      const o = event.observation, key = o.kind ?? 'unknown', signature = [o.finalHost, o.routeType, o.representation].join(':')
      if (this.#lastConfirmed.get(key) === signature) return
      this.#lastConfirmed.set(key, signature)
    }
    if (event.type === 'attribution-changed') {
      const key = event.kind ?? 'unknown'
      if (this.#lastAttribution.get(key) === event.status) return
      this.#lastAttribution.set(key, event.status)
    }
    if (event.type === 'transport' || event.type === 'transport-completed') {
      const o = event.observation
      if (o.request) this.#pending.delete(o.request.requestId)
      this.#aggregate(o)
      if (o.outcome !== 'failure') {
        if (o.outcome === 'success' && !(event.type === 'transport-completed' && event.detached)) this.#lastSuccess.set(o.kind ?? 'unknown', this.#transport(o))
        return
      }
    }
    const safe = this.#event(event)
    this.#events.push(safe)
    this.#trim(this.#events, 24 * 1024, 'evicted')
    const trigger = this.#trigger(event)
    if (this.#incident?.state === 'capturing') {
      this.#incident.events.push(safe)
      if (trigger) this.#incident.captureUntil = Math.min(this.#incident.startedAt + 90_000, Math.max(this.#incident.captureUntil, event.at + 30_000))
      this.#trim(this.#incident.events, 48 * 1024, 'incidentEvicted')
    } else if (trigger) this.#start(trigger, event.at)
    this.#bound()
  }

  mark(reason = 'manual'): void {
    this.tick()
    this.#manualMark = { at: this.now(), reason: text(reason), count: (this.#manualMark?.count ?? 0) + 1 }
    if (!this.#incident) this.#start(text(reason), this.now())
    this.#bound()
  }
  clear(): void { this.#incident = null; this.#manualMark = null; this.#attempts = []; this.#recentPlayerTrace = []; this.#lastPaused = null; this.#lastPlayerFrames = null }
  recordPlayer(sample: PlaybackDiagnosticSample): void {
    this.tick()
    const active = this.#activeAttempt()
    if (active) {
      if (!sample.enabled || sample.originalComparison || sample.generation !== active.identity.generation || sample.epoch !== active.identity.epoch) {
        active.stage = 'interrupted'
      } else if (sample.seeking || sample.ended) {
        active.stage = 'interrupted'
      } else {
        if (!active.baselineCaptured) {
          active.baselineCaptured = true
          active.baselinePositionSec = this.#finite(sample.currentTimeSec, 0, 86400)
          const buffer = this.#finite(sample.playableBufferSec, 0, 86400)
          active.baselineEndSec = active.baselinePositionSec !== null && buffer !== null ? active.baselinePositionSec + buffer : null
        }
        const position = this.#finite(sample.currentTimeSec, 0, 86400)
        const progressing = !sample.paused && !sample.seeking && !sample.ended && position !== null && active.lastPositionSec !== null
          && position > active.lastPositionSec + 0.05
        if (progressing && active.responseAt === null && active.stage !== 'mixed-evidence') active.stage = 'progress-unconfirmed'
        if (active.responseAt !== null && !active.mixed && active.stage !== 'playback-observed' && active.stage !== 'unconfirmed') {
          const beyond = progressing && active.baselineEndSec !== null && position > active.baselineEndSec + 0.1
          const contiguous = active.lastProgressAt !== null && sample.at > active.lastProgressAt && sample.at - active.lastProgressAt <= 2000
          active.progressTicks = beyond ? (contiguous ? active.progressTicks + 1 : 1) : 0
          active.lastProgressAt = beyond ? sample.at : null
          if (active.progressTicks >= 2) { active.stage = 'playback-observed'; active.playbackAt = sample.at }
        }
        active.lastPositionSec = position
      }
    }
    const flags = Number(sample.paused) | (Number(sample.seeking) << 1) | (Number(sample.ended) << 2)
      | (Number(sample.coreInitialized === false) << 3) | (Number(sample.coreInitialized === true) << 4)
    const currentFrames = this.#finite(sample.frames, 0, 2 ** 32 - 1)
    const frameDelta = currentFrames !== null && this.#lastPlayerFrames !== null ? Math.max(0, currentFrames - this.#lastPlayerFrames) : -1
    this.#lastPlayerFrames = currentFrames
    const row = [Math.trunc(sample.at), Math.round((this.#finite(sample.currentTimeSec, 0, 86400) ?? 0) * 10),
      frameDelta, Math.round((this.#finite(sample.playableBufferSec, 0, 86400) ?? 0) * 10),
      Math.max(0, Math.min(4, Math.trunc(sample.readyState))), flags, text(sample.watchdog, 20)].join(',')
    this.#recentPlayerTrace.push({ at: sample.at, row })
    this.#recentPlayerTrace = this.#recentPlayerTrace.filter(item => item.at >= sample.at - 20_000).slice(-21)
    if (this.#incident?.state === 'capturing' && sample.at <= this.#incident.startedAt + 90_000) {
      this.#incident.playerTrace.push(row)
      while (bytes(this.#incident.playerTrace) > 4 * 1024 && this.#incident.playerTrace.length > 1) {
        this.#incident.playerTrace.shift(); this.#counters.traceEvicted++
      }
    }
    if (this.#lastPaused !== null && this.#lastPaused !== sample.paused) {
      const event: SafeEvent = { at: sample.at, type: 'player-paused-changed', data: { paused: sample.paused }, important: true }
      this.#events.push(event); this.#trim(this.#events, 24 * 1024, 'evicted')
      if (this.#incident?.state === 'capturing') { this.#incident.events.push(event); this.#trim(this.#incident.events, 48 * 1024, 'incidentEvicted') }
    }
    this.#lastPaused = sample.paused
    this.#bound()
  }
  snapshot(): Readonly<Record<string, unknown>> {
    return Object.freeze({ coverage: { from: this.#events[0]?.at ?? this.now(), to: this.#events.at(-1)?.at ?? this.now() },
      incident: this.#incident ? structuredClone(this.#incident) : null, manualMark: this.#manualMark ? { ...this.#manualMark } : null,
      flow: this.#flows(), lastSuccess: Object.fromEntries(this.#lastSuccess), pending: [...this.#pending.values()].map(row => this.#sanitize(row)),
      events: structuredClone(this.#events), rankings: structuredClone(this.#rankings), routeRecovery: { attempts: this.#attempts.map(row => this.#attemptSummary(row)) }, counters: { ...this.#counters } })
  }

  buildReport(readModel: Readonly<Record<string, unknown>>): string {
    const recorder = { ...this.snapshot() } as Record<string, unknown>
    const payload = { title: 'BiliCDN_TW v2 診斷報告', generatedAt: new Date(this.now()).toISOString(),
      evidence: this.#incident ? this.#incident.state + '-incident' : this.#lastSuccess.size ? 'media-observation-only' : 'playback-observation-unattributed',
      current: this.#sanitize(readModel), recorder, export: { truncated: false, rankingDropped: 0, traceDropped: 0, contextDropped: 0, flowDropped: 0, incidentDropped: 0,
        currentReduced: false, emergencySummary: false } }
    let output = JSON.stringify(payload, null, 2)
    if (new TextEncoder().encode(output).byteLength <= 96 * 1024) return output
    payload.export.truncated = true
    output = JSON.stringify(payload)
    if (new TextEncoder().encode(output).byteLength <= 96 * 1024) return output
    payload.export.rankingDropped = this.#rankings.length
    recorder.rankings = []
    output = JSON.stringify(payload)
    const events = recorder.events as SafeEvent[], flows = recorder.flow as unknown[], incident = recorder.incident as Incident | null
    while (new TextEncoder().encode(output).byteLength > 96 * 1024 && (incident?.playerTrace.length || events.length > 1 || flows.length > 1 || (incident?.events.length ?? 0) > 1)) {
      if (incident?.playerTrace.length) { incident.playerTrace.shift(); payload.export.traceDropped++ }
      else if (events.length > 1) { const i = events.findIndex(row => !row.important); events.splice(i >= 0 ? i : 0, 1); payload.export.contextDropped++ }
      else if (flows.length > 1) { flows.shift(); payload.export.flowDropped++ }
      else if (incident && incident.events.length > 1) { const i = incident.events.findIndex(row => !row.important); incident.events.splice(i >= 0 ? i : 0, 1); payload.export.incidentDropped++ }
      output = JSON.stringify(payload)
    }
    if (new TextEncoder().encode(output).byteLength <= 96 * 1024) return output
    const m = readModel, r = m.routes as Record<string, unknown> | undefined
    payload.current = this.#sanitize({ version: m.version, session: m.session, monitor: m.monitor, recovery: m.recovery, measurement: m.measurement,
      interception: m.interception,
      routes: { planCount: r?.planCount, activePlan: r?.activePlan, affinity: r?.affinity, latest: r?.latest, representation: r?.representation, attribution: r?.attribution },
      truncated: true })
    payload.export.currentReduced = true
    output = JSON.stringify(payload)
    if (new TextEncoder().encode(output).byteLength <= 96 * 1024) return output
    const latest = (recorder.routeRecovery as { attempts: Record<string, unknown>[] }).attempts.at(-1)
    const summary = { title: payload.title, generatedAt: payload.generatedAt, evidence: payload.evidence,
      current: this.#sanitize({ version: m.version, monitor: { watchdog: (m.monitor as Record<string, unknown> | undefined)?.watchdog }, truncated: true }),
      recorder: { incident: incident && { id: incident.id, reason: incident.reason, startedAt: incident.startedAt, state: incident.state },
        routeRecovery: { attempts: latest ? [{ actionId: latest.actionId, decisionId: latest.decisionId, host: latest.host, stage: latest.stage }] : [] } },
      export: { ...payload.export, emergencySummary: true } }
    return JSON.stringify(summary)
  }

  #activeAttempt(): RouteAttempt | null {
    const row = this.#attempts.at(-1)
    return row && !['mixed-evidence', 'unconfirmed', 'superseded', 'interrupted'].includes(row.stage)
      && !(row.stage === 'playback-observed' && this.now() - row.at >= 30_000) ? row : null
  }
  #finite(value: unknown, min: number, max: number): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null
  }
  #matches(request: RequestContext | undefined, attempt: RouteAttempt): boolean {
    return !!request && request.kind === 'video' && request.attributionStatus === 'matched'
      && request.generation === attempt.identity.generation && request.epoch === attempt.identity.epoch
      && request.representation === attempt.identity.representation && request.authorityRevision === attempt.identity.authorityRevision
      && request.decisionId === attempt.decisionId && request.targetHost === attempt.host && request.startedAt >= attempt.at
  }
  #observeAttempt(event: DomainEvent): void {
    if (event.type === 'recovery' && event.action.action === 'route-fallback' && event.action.kind === 'video') {
      const active = this.#activeAttempt()
      if (active && active.stage !== 'playback-observed') active.stage = 'superseded'
      this.#attempts.push({ actionId: event.action.id, decisionId: event.action.decision.id,
        host: event.action.decision.host ?? '', identity: event.action.identity, at: event.at, stage: 'planned',
        baselinePositionSec: null, baselineEndSec: null, baselineCaptured: false,
        requestAt: null, responseAt: null, playbackAt: null, requests: 0, successes: 0, failures: 0, aborts: 0,
        zeroByteAborts: 0, noResponseAborts: 0, lastOutcomeAt: null, lastFailureKind: null,
        mixed: false, progressTicks: 0, lastProgressAt: null, lastPositionSec: null,
        requestIds: new Set<string>(), responseIds: new Set<string>() })
      while (this.#attempts.length > 6) { this.#attempts.shift(); this.#counters.attemptEvicted++ }
      return
    }
    const active = this.#activeAttempt()
    if (!active) return
    if (event.type === 'lifecycle') {
      if (event.generation !== active.identity.generation || event.epoch !== active.identity.epoch) active.stage = 'interrupted'
      return
    }
    if (event.type === 'request-started') {
      if (!this.#matches(event.request, active)) return
      if (active.requestIds.size >= 32) active.requestIds.delete(active.requestIds.values().next().value as string)
      active.requestIds.add(event.request.requestId)
      active.requests++
      active.requestAt ??= event.at
      if (active.stage === 'planned') active.stage = 'sent'
      return
    }
    if (event.type !== 'transport-completed' && event.type !== 'route-confirmed') return
    const observation = event.observation
    if (observation.kind === 'video' && observation.outcome === 'success' && observation.bytes > 0
      && observation.generation === active.identity.generation && observation.epoch === active.identity.epoch
      && observation.representation === active.identity.representation && observation.finalHost
      && observation.finalHost !== active.host && event.type === 'route-confirmed') {
      active.mixed = true; active.stage = 'mixed-evidence'
      return
    }
    if (!this.#matches(observation.request, active) || !active.requestIds.has(observation.request!.requestId)) return
    if (event.type === 'transport-completed') {
      if (event.detached) return
      active.lastOutcomeAt = observation.completedAt
      if (observation.outcome === 'abort') {
        active.aborts++
        if (observation.bytes === 0) active.zeroByteAborts++
        if (observation.status === 0 && observation.finalHost === null) active.noResponseAborts++
      } else if (observation.outcome === 'failure') {
        active.failures++; active.lastFailureKind = observation.failureKind ?? 'unknown'
      } else active.successes++
      return
    }
    if (observation.outcome !== 'success' || observation.status !== 206 || observation.bytes <= 0
      || observation.finalHost !== active.host || observation.responseUrlMatchesRequest !== true
      || active.responseIds.has(observation.request!.requestId)) return
    active.responseIds.add(observation.request!.requestId)
    active.responseAt ??= event.at
    active.stage = 'response-observed'
    active.progressTicks = 0; active.lastProgressAt = null
  }
  #attemptSummary(row: RouteAttempt): Record<string, unknown> {
    return { actionId: text(row.actionId), decisionId: text(row.decisionId), host: this.#host(row.host),
      generation: row.identity.generation, epoch: row.identity.epoch, representation: text(row.identity.representation),
      authorityRevision: row.identity.authorityRevision, at: row.at, stage: row.stage,
      baselinePositionSec: row.baselinePositionSec, baselineEndSec: row.baselineEndSec,
      requestAt: row.requestAt, responseAt: row.responseAt, playbackAt: row.playbackAt,
      requests: row.requests, successes: row.successes, failures: row.failures, aborts: row.aborts,
      zeroByteAborts: row.zeroByteAborts, noResponseAborts: row.noResponseAborts,
      lastOutcomeAt: row.lastOutcomeAt, lastFailureKind: row.lastFailureKind, mixed: row.mixed }
  }

  #aggregate(o: TransportObservation): void {
    const key = [Math.floor(o.completedAt / 5000), o.kind ?? 'unknown', o.routeType, this.#host(o.targetHost), this.#host(o.finalHost)].join(':')
    const row = this.#flow.get(key) ?? { requests: 0, successes: 0, failures: 0, timeouts: 0, aborts: 0, zeroByteAborts: 0, noResponseAborts: 0, bytes: 0, lastAt: 0, maxElapsedMs: 0, maxTtfbMs: 0 }
    row.requests++; row.bytes += o.bytes; row.lastAt = o.completedAt
    row.maxElapsedMs = Math.max(row.maxElapsedMs, o.elapsedMs); row.maxTtfbMs = Math.max(row.maxTtfbMs, o.ttfbMs ?? 0)
    if (o.outcome === 'success') row.successes++
    else if (o.outcome === 'failure') { row.failures++; if (o.failureKind === 'timeout') row.timeouts++ }
    else {
      row.aborts++
      if (o.bytes === 0) row.zeroByteAborts++
      if (o.status === 0 && o.finalHost === null) row.noResponseAborts++
    }
    this.#flow.set(key, row)
    while (this.#flow.size > 48 || bytes(this.#flows()) > 12 * 1024) { this.#flow.delete(this.#flow.keys().next().value as string); this.#counters.flowEvicted++ }
    this.#bound()
  }
  #flows(): Record<string, unknown>[] { return [...this.#flow].map(([key, row]) => ({ key, ...row })) }
  #transport(o: TransportObservation): Record<string, unknown> {
    return { ...(o.request ? this.#sanitize(o.request) as Record<string, unknown> : {}),
      decisionId: o.decisionId, generation: o.generation, epoch: o.epoch, kind: o.kind, representation: o.representation,
      routeType: o.routeType, originalHost: this.#host(o.originalHost), targetHost: this.#host(o.targetHost), responseHost: this.#host(o.finalHost),
      status: o.status, bytes: o.bytes, ttfbMs: o.ttfbMs, elapsedMs: o.elapsedMs, completedAt: o.completedAt, outcome: o.outcome, failureKind: o.failureKind ?? null }
  }
  #decision(d: RouteDecision): Record<string, unknown> {
    const chosen = d.ranking.find(row => row.candidate.host === d.host && row.candidate.type === d.routeType)
    return { decisionStage: 'plan', id: d.id, action: d.action, reason: d.reason, routeType: d.routeType, host: this.#host(d.host),
      demandRatio: chosen?.demandRatio ?? null, capacityAssessment: assessDemandRatio(chosen?.demandRatio ?? null) }
  }
  #event(event: DomainEvent): SafeEvent {
    let data: Record<string, unknown> = {}, important = false
    switch (event.type) {
      case 'route-decision': case 'route-planned': {
        data = this.#decision(event.decision)
        if (this.verbose()) {
          const ranking = { ...data, ranking: event.decision.ranking.slice(0, 12).map(row => ({ host: this.#host(row.candidate.host),
            state: row.state, eligible: row.eligible, reasons: row.reasons, safeMbps: row.safeThroughputMbps, demandRatio: row.demandRatio, ttfbMs: row.medianTtfbMs })) }
          const signature = JSON.stringify(ranking.ranking)
          if (!this.#rankings.some(row => JSON.stringify(row.ranking) === signature)) this.#rankings.push(ranking)
          while (this.#rankings.length > 4 || bytes(this.#rankings) > 12 * 1024) { this.#rankings.shift(); this.#counters.rankingEvicted++ }
        }
        break
      }
      case 'transport': case 'transport-completed': data = { ...this.#transport(event.observation), detached: event.type === 'transport-completed' && event.detached }; important = true; break
      case 'route-confirmed': data = this.#transport(event.observation); important = true; break
      case 'route-observed': data = { routeType: event.routeType, host: this.#host(event.host), decisionId: event.decisionId }; important = true; break
      case 'request-started': data = this.#sanitize(event.request) as Record<string, unknown>; break
      case 'attribution-changed': data = { requestId: event.requestId, status: event.status, kind: event.kind }; break
      case 'recovery': data = { action: event.action.action, actionId: event.action.id,
        ...(event.action.action === 'route-fallback' ? { kind: event.action.kind, identity: event.action.identity, decision: this.#decision(event.action.decision) }
          : event.action.action === 'player-reload' ? { savedPositionSec: event.action.savedPositionSec, savedRate: event.action.savedRate } : { reason: event.action.reason }) }; important = true; break
      case 'core': case 'core-uninitialized': data = { ...event,
        ...(event.type === 'core' && event.state === 'recovered' ? { meaning: 'player-core-progress-only' } : {}) }; important = true; break
      case 'lifecycle': data = { generation: event.generation, epoch: event.epoch, reason: event.reason }; important = true; break
    }
    return { at: event.at, type: event.type, data, important }
  }
  #trigger(event: DomainEvent): string | null {
    if (event.type === 'core-uninitialized') return 'core:uninitialized'
    if ((event.type === 'transport' || event.type === 'transport-completed') && event.observation.outcome === 'failure'
      && !(event.type === 'transport-completed' && event.detached)) return 'transport:' + (event.observation.failureKind ?? 'failure')
    if (event.type === 'recovery') return 'recovery:' + event.action.action
    if (event.type === 'core' && ['reloading', 'failed'].includes(event.state)) return 'core:' + event.state
    return null
  }
  #start(reason: string, at: number): void {
    if (this.#incident?.state === 'capturing') { this.#incident.captureUntil = Math.min(this.#incident.startedAt + 90_000, at + 30_000); return }
    if (this.#incident) this.#counters.incidentReplaced++
    this.#incident = { id: 'incident-' + (++this.#serial), reason, startedAt: at, captureUntil: at + 30_000, state: 'capturing',
      events: this.#events.filter(event => at - event.at <= 60_000).map(event => structuredClone(event)), flow: this.#flows(),
      playerTrace: this.#recentPlayerTrace.map(item => item.row),
      playerTraceFormat: 'atMs,currentTimeDeciSec,frameDelta,playableBufferDeciSec,readyState,flags,watchdog',
      playerTraceFlags: '1=paused,2=seeking,4=ended,8=coreFalse,16=coreTrue' }
  }
  #trim(rows: SafeEvent[], max: number, counter: 'evicted' | 'incidentEvicted'): void {
    while (bytes(rows) > max && rows.length > 1) {
      let index = rows.findIndex(row => !row.important)
      if (index < 0) index = rows.findIndex(row => row.at !== this.#incident?.startedAt)
      rows.splice(index < 0 ? 0 : index, 1); this.#counters[counter]++
    }
  }
  #bound(): void {
    while (bytes(this.snapshot()) > 128 * 1024) {
      if (this.#rankings.length) { this.#rankings.shift(); this.#counters.rankingEvicted++ }
      else if (this.#incident?.playerTrace.length) { this.#incident.playerTrace.shift(); this.#counters.traceEvicted++ }
      else if (this.#flow.size > 1) { this.#flow.delete(this.#flow.keys().next().value as string); this.#counters.flowEvicted++ }
      else if (this.#events.length > 1) { this.#events.shift(); this.#counters.evicted++ }
      else if (this.#pending.size) { this.#pending.delete(this.#pending.keys().next().value as string); this.#counters.pendingEvicted++ }
      else if (this.#incident && this.#incident.events.length > 1) { this.#incident.events.shift(); this.#counters.incidentEvicted++ }
      else if (this.#attempts.length > 1) { this.#attempts.shift(); this.#counters.attemptEvicted++ }
      else break
    }
  }
  #host(host: string | null): string | null {
    if (!host || isCatalogHost(host) || isKnownNativeFamily(host)) return host
    if (this.#aliases.has(host)) return this.#aliases.get(host) ?? 'external'
    if (this.#aliases.size >= 64) return 'external#overflow'
    const alias = 'external#' + (this.#aliases.size + 1); this.#aliases.set(host, alias); return alias
  }
  #sanitize(value: unknown, key = '', depth = 0): unknown {
    if (depth > 7) return '[bounded]'
    if (typeof value === 'string') return key.toLowerCase().includes('host') ? this.#host(value) : text(value, 160)
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return value
    if (Array.isArray(value)) return value.slice(0, 48).map(item => this.#sanitize(item, key, depth + 1))
    if (!value || typeof value !== 'object') return null
    return Object.fromEntries(Object.entries(value).slice(0, 48).filter(([name]) => !['streamKey', 'url', 'path', 'query', 'token'].includes(name))
      .map(([name, item]) => [name, this.#sanitize(item, name, depth + 1)]))
  }
}
