import type { DomainEvent, RouteDecision, TransportObservation } from '../domain/model.ts'
import { isCatalogHost } from '../domain/catalog.ts'
import { isKnownNativeFamily } from '../domain/url-policy.ts'

const CONTEXT_MS = 60_000
const INCIDENT_AFTER_MS = 30_000
const INCIDENT_MAX_MS = 90_000
const MAX_EVENTS_BYTES = 64 * 1024
const MAX_REPORT_BYTES = 96 * 1024

interface SafeEvent { readonly at: number; readonly type: string; readonly data: Readonly<Record<string, unknown>> }
interface FlowAggregate { requests: number; successes: number; aborts: number; failures: number; bytes: number; lastAt: number; maxElapsedMs: number; maxTtfbMs: number }
interface Incident { readonly id: string; readonly reason: string; readonly startedAt: number; captureUntil: number; state: 'capturing' | 'frozen'; events: SafeEvent[] }

const boundedText = (value: unknown, max = 64): string => String(value ?? '').slice(0, max)
const safeDecision = (decision: RouteDecision, safeHost: (host: string | null) => string | null): Record<string, unknown> => ({
  id: decision.id,
  action: decision.action,
  reason: decision.reason,
  routeType: decision.routeType,
  host: safeHost(decision.host),
  ranking: decision.ranking.slice(0, 12).map(row => ({ host: safeHost(row.candidate.host), type: row.candidate.type,
    state: row.state, eligible: row.eligible, reasons: row.reasons, safeMbps: row.safeThroughputMbps,
    ratio: row.demandRatio, ttfbMs: row.medianTtfbMs })),
})

const safeTransport = (observation: TransportObservation, safeHost: (host: string | null) => string | null): Record<string, unknown> => ({
  decisionId: observation.decisionId,
  representation: observation.representation,
  kind: observation.kind,
  routeType: observation.routeType,
  originalHost: safeHost(observation.originalHost),
  targetHost: safeHost(observation.targetHost),
  finalHost: safeHost(observation.finalHost),
  status: observation.status,
  bytes: observation.bytes,
  ttfbMs: observation.ttfbMs,
  elapsedMs: observation.elapsedMs,
  outcome: observation.outcome,
  failureKind: observation.failureKind ?? null,
})

export class DiagnosticRecorder {
  #events: SafeEvent[] = []
  #flow = new Map<string, FlowAggregate>()
  #incident: Incident | null = null
  #incidentSerial = 0
  #incidentReplaced = 0
  #evicted = 0
  #externalAliases = new Map<string, string>()

  constructor(private readonly now: () => number, private readonly verbose: () => boolean) {}

  record(event: DomainEvent): void {
    this.#freezeIfDue()
    if (event.type === 'transport' && event.observation.outcome !== 'failure') {
      this.#aggregate(event.observation)
      if (!this.verbose()) return
    }
    const safe = this.#safeEvent(event)
    this.#events.push(safe)
    this.#prune()
    if (this.#incident?.state === 'capturing') {
      this.#incident.events.push(safe)
      this.#incident.captureUntil = Math.min(this.#incident.startedAt + INCIDENT_MAX_MS,
        Math.max(this.#incident.captureUntil, event.at + INCIDENT_AFTER_MS))
      while (JSON.stringify(this.#incident.events).length > MAX_EVENTS_BYTES && this.#incident.events.length > 1) this.#incident.events.shift()
    }
    const reason = this.#triggerReason(event)
    if (reason) this.#startIncident(reason, event.at)
  }

  mark(reason = 'manual'): void { this.#startIncident(boundedText(reason), this.now()) }
  clear(): void { this.#incident = null }

  snapshot(): Readonly<Record<string, unknown>> {
    this.#freezeIfDue()
    return Object.freeze({
      coverage: { from: this.#events[0]?.at ?? this.now(), to: this.#events.at(-1)?.at ?? this.now() },
      incident: this.#incident ? { id: this.#incident.id, reason: this.#incident.reason, state: this.#incident.state,
        startedAt: this.#incident.startedAt, captureUntil: this.#incident.captureUntil,
        events: Object.freeze(this.#incident.events.map(event => ({ ...event, data: { ...event.data } }))) } : null,
      flow: Object.freeze([...this.#flow.entries()].map(([key, value]) => ({ key, ...value }))),
      events: Object.freeze(this.#events.map(event => ({ ...event, data: { ...event.data } }))),
      counters: { evicted: this.#evicted, incidentReplaced: this.#incidentReplaced },
    })
  }

  buildReport(readModel: Readonly<Record<string, unknown>>): string {
    const recorder = this.snapshot() as Record<string, unknown>
    const payload = {
      title: 'BiliCDN_TW v2 診斷報告',
      generatedAt: new Date(this.now()).toISOString(),
      evidence: this.#incident ? 'frozen-incident' : 'healthy-observation-only',
      current: this.#sanitize(readModel),
      recorder,
    }
    let text = JSON.stringify(payload, null, 2)
    if (new TextEncoder().encode(text).byteLength > MAX_REPORT_BYTES) {
      text = JSON.stringify({ ...payload, recorder: { ...recorder, events: [], flow: [], truncated: true } }, null, 2)
    }
    if (new TextEncoder().encode(text).byteLength > MAX_REPORT_BYTES) {
      const current = this.#essentialReadModel(readModel)
      const incident = recorder['incident'] as { events?: readonly unknown[] } | null
      for (const limit of [32, 16, 8, 4, 1, 0]) {
        text = JSON.stringify({ ...payload, current, recorder: { incident: incident ? { ...incident, events: limit === 0 ? [] : incident.events?.slice(-limit) ?? [] } : null,
          counters: recorder['counters'], truncated: true } }, null, 2)
        if (new TextEncoder().encode(text).byteLength <= MAX_REPORT_BYTES) break
      }
    }
    if (new TextEncoder().encode(text).byteLength > MAX_REPORT_BYTES) {
      text = JSON.stringify({ ...payload, current: this.#essentialReadModel(readModel),
        recorder: { incident: this.#incident ? { id: this.#incident.id, reason: this.#incident.reason,
          state: this.#incident.state, startedAt: this.#incident.startedAt, events: [] } : null,
          counters: recorder['counters'], truncated: true } }, null, 2)
    }
    return text
  }

  #aggregate(observation: TransportObservation): void {
    const bucket = Math.floor(observation.completedAt / 5000), key = `${bucket}:${observation.kind ?? 'unknown'}:${observation.routeType}:${this.#safeHost(observation.targetHost)}:${this.#safeHost(observation.finalHost) ?? ''}`
    const row = this.#flow.get(key) ?? { requests: 0, successes: 0, aborts: 0, failures: 0, bytes: 0, lastAt: 0, maxElapsedMs: 0, maxTtfbMs: 0 }
    row.requests++; row.bytes += observation.bytes; row.lastAt = observation.completedAt
    row.maxElapsedMs = Math.max(row.maxElapsedMs, observation.elapsedMs); row.maxTtfbMs = Math.max(row.maxTtfbMs, observation.ttfbMs ?? 0)
    if (observation.outcome === 'success') row.successes++
    else if (observation.outcome === 'abort') row.aborts++
    else row.failures++
    this.#flow.set(key, row)
    while (this.#flow.size > 96) this.#flow.delete(this.#flow.keys().next().value as string)
  }

  #safeEvent(event: DomainEvent): SafeEvent {
    switch (event.type) {
      case 'route-decision': return Object.freeze({ at: event.at, type: event.type, data: Object.freeze(safeDecision(event.decision, host => this.#safeHost(host))) })
      case 'transport': return Object.freeze({ at: event.at, type: event.type, data: Object.freeze(safeTransport(event.observation, host => this.#safeHost(host))) })
      case 'route-observed': return Object.freeze({ at: event.at, type: event.type, data: Object.freeze({ routeType: event.routeType, host: this.#safeHost(event.host), decisionId: event.decisionId }) })
      case 'recovery': return Object.freeze({ at: event.at, type: event.type, data: Object.freeze({ action: event.action.action, id: event.action.id,
        ...(event.action.action === 'route-fallback' ? { kind: event.action.kind, decision: safeDecision(event.action.decision, host => this.#safeHost(host)) }
          : event.action.action === 'player-reload' ? { savedPositionSec: event.action.savedPositionSec, savedRate: event.action.savedRate }
            : { reason: event.action.reason }) }) })
      case 'core': return Object.freeze({ at: event.at, type: event.type, data: Object.freeze({ state: event.state, actionId: event.actionId }) })
      case 'lifecycle': return Object.freeze({ at: event.at, type: event.type, data: Object.freeze({ generation: event.generation, epoch: event.epoch, reason: boundedText(event.reason) }) })
    }
  }

  #triggerReason(event: DomainEvent): string | null {
    if (event.type === 'transport' && event.observation.outcome === 'failure') return `transport:${event.observation.failureKind ?? 'failure'}`
    if (event.type === 'recovery') return `recovery:${event.action.action}`
    if (event.type === 'core' && ['reloading', 'failed'].includes(event.state)) return `core:${event.state}`
    return null
  }

  #startIncident(reason: string, at: number): void {
    if (this.#incident?.state === 'capturing') {
      this.#incident.captureUntil = Math.min(this.#incident.startedAt + INCIDENT_MAX_MS, Math.max(this.#incident.captureUntil, at + INCIDENT_AFTER_MS))
      return
    }
    if (this.#incident) this.#incidentReplaced++
    this.#incident = { id: `incident-${++this.#incidentSerial}`, reason, startedAt: at,
      captureUntil: at + INCIDENT_AFTER_MS, state: 'capturing', events: this.#events.filter(event => at - event.at <= CONTEXT_MS) }
  }

  #freezeIfDue(): void { if (this.#incident?.state === 'capturing' && this.now() >= this.#incident.captureUntil) this.#incident.state = 'frozen' }
  #prune(): void {
    const floor = this.now() - CONTEXT_MS
    while (this.#events.length && (this.#events[0]?.at ?? 0) < floor) this.#events.shift()
    while (JSON.stringify(this.#events).length > MAX_EVENTS_BYTES && this.#events.length) { this.#events.shift(); this.#evicted++ }
  }

  #safeHost(host: string | null): string | null {
    if (!host || isCatalogHost(host) || isKnownNativeFamily(host)) return host
    const existing = this.#externalAliases.get(host)
    if (existing) return existing
    const alias = `external#${this.#externalAliases.size + 1}`
    this.#externalAliases.set(host, alias)
    return alias
  }

  #essentialReadModel(readModel: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
    const pick = (value: unknown, names: readonly string[]): Record<string, unknown> => {
      if (!value || typeof value !== 'object') return {}
      const source = value as Record<string, unknown>, result: Record<string, unknown> = {}
      for (const name of names) if (name in source) result[name] = source[name]
      return result
    }
    const routes = readModel['routes'] as Record<string, unknown> | undefined
    return this.#sanitize({ version: readModel['version'], session: pick(readModel['session'], ['generation', 'epoch', 'representation', 'affinity', 'disabled', 'recovering']),
      monitor: pick(readModel['monitor'], ['video', 'watchdog', 'stallTicks', 'stableProgressSec']),
      recovery: pick(readModel['recovery'], ['state', 'source', 'reloadCount', 'breakerSec']),
      measurement: pick(readModel['measurement'], ['state', 'reason', 'lastAttemptAt', 'host']),
      routes: { planCount: routes?.['planCount'], activePlan: routes?.['activePlan'], affinity: routes?.['affinity'] },
      evidence: Array.isArray(readModel['evidence']) ? readModel['evidence'].slice(0, 8) : [], truncated: true }) as Record<string, unknown>
  }

  #sanitize(value: unknown, key = '', depth = 0): unknown {
    if (depth > 8) return '[bounded]'
    if (typeof value === 'string') return key.toLowerCase().includes('host') ? this.#safeHost(value) : boundedText(value, 512)
    if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value
    if (Array.isArray(value)) return value.slice(0, 128).map(item => this.#sanitize(item, key, depth + 1))
    if (!value || typeof value !== 'object') return null
    const output: Record<string, unknown> = {}
    for (const [name, item] of Object.entries(value as Record<string, unknown>).slice(0, 128)) output[name.slice(0, 64)] = this.#sanitize(item, name, depth + 1)
    return output
  }
}
