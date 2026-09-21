import type { DomainEvent, RouteDecision, TransportObservation, RequestContext } from '../domain/model.ts'
import { isCatalogHost } from '../domain/catalog.ts'
import { isKnownNativeFamily } from '../domain/url-policy.ts'

interface SafeEvent { at: number; type: string; data: Record<string, unknown>; important: boolean }
interface Flow { requests: number; successes: number; aborts: number; bytes: number; lastAt: number; maxElapsedMs: number; maxTtfbMs: number }
interface Incident { id: string; reason: string; startedAt: number; captureUntil: number; state: 'capturing' | 'frozen'; events: SafeEvent[]; flow: Record<string, unknown>[] }
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
  #serial = 0
  #aliases = new Map<string, string>()
  #manualMark: { at: number; reason: string; count: number } | null = null
  #counters = { evicted: 0, incidentReplaced: 0, rankingEvicted: 0, flowEvicted: 0, incidentEvicted: 0, pendingEvicted: 0, eventsExpired: 0, flowsExpired: 0 }
  constructor(private readonly now: () => number, private readonly verbose: () => boolean) {}

  tick(): void {
    if (this.#incident?.state === 'capturing' && this.now() >= this.#incident.captureUntil) this.#incident.state = 'frozen'
    const floor = this.now() - 60_000
    const events = this.#events.filter(event => event.at >= floor)
    this.#counters.eventsExpired += this.#events.length - events.length
    this.#events = events
    for (const [key, row] of this.#flow) if (row.lastAt < floor) { this.#flow.delete(key); this.#counters.flowsExpired++ }
    for (const [key, row] of this.#pending) if (this.now() - row.startedAt > 120_000) { this.#pending.delete(key); this.#counters.pendingEvicted++ }
  }

  record(event: DomainEvent): void {
    this.tick()
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
      if (o.outcome !== 'failure') {
        this.#aggregate(o)
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
  clear(): void { this.#incident = null; this.#manualMark = null }
  snapshot(): Readonly<Record<string, unknown>> {
    return Object.freeze({ coverage: { from: this.#events[0]?.at ?? this.now(), to: this.#events.at(-1)?.at ?? this.now() },
      incident: this.#incident ? structuredClone(this.#incident) : null, manualMark: this.#manualMark ? { ...this.#manualMark } : null,
      flow: this.#flows(), lastSuccess: Object.fromEntries(this.#lastSuccess), pending: [...this.#pending.values()].map(row => this.#sanitize(row)),
      events: structuredClone(this.#events), rankings: structuredClone(this.#rankings), counters: { ...this.#counters } })
  }

  buildReport(readModel: Readonly<Record<string, unknown>>): string {
    const recorder = this.snapshot() as Record<string, unknown>
    const payload = { title: 'BiliCDN_TW v2 診斷報告', generatedAt: new Date(this.now()).toISOString(),
      evidence: this.#incident ? this.#incident.state + '-incident' : this.#lastSuccess.size ? 'media-observation-only' : 'playback-observation-unattributed',
      current: this.#sanitize(readModel), recorder, export: { truncated: false, rankingDropped: 0, contextDropped: 0, flowDropped: 0 } }
    let output = JSON.stringify(payload, null, 2)
    if (new TextEncoder().encode(output).byteLength <= 96 * 1024) return output
    payload.export.truncated = true; payload.export.rankingDropped = this.#rankings.length
    recorder.rankings = []
    const m = readModel, r = m.routes as Record<string, unknown> | undefined
    payload.current = this.#sanitize({ version: m.version, session: m.session, monitor: m.monitor, recovery: m.recovery, measurement: m.measurement,
      routes: { planCount: r?.planCount, activePlan: r?.activePlan, affinity: r?.affinity, latest: r?.latest, representation: r?.representation, attribution: r?.attribution },
      evidence: m.evidence, truncated: true })
    output = JSON.stringify(payload)
    const events = recorder.events as SafeEvent[], flows = recorder.flow as unknown[]
    while (new TextEncoder().encode(output).byteLength > 96 * 1024 && (events.length > 1 || flows.length > 1)) {
      if (events.length > 1) { const i = events.findIndex(row => !row.important); events.splice(i >= 0 ? i : 0, 1); payload.export.contextDropped++ }
      else { flows.shift(); payload.export.flowDropped++ }
      output = JSON.stringify(payload)
    }
    return output
  }

  #aggregate(o: TransportObservation): void {
    const key = [Math.floor(o.completedAt / 5000), o.kind ?? 'unknown', o.routeType, this.#host(o.targetHost), this.#host(o.finalHost)].join(':')
    const row = this.#flow.get(key) ?? { requests: 0, successes: 0, aborts: 0, bytes: 0, lastAt: 0, maxElapsedMs: 0, maxTtfbMs: 0 }
    row.requests++; row.bytes += o.bytes; row.lastAt = o.completedAt
    row.maxElapsedMs = Math.max(row.maxElapsedMs, o.elapsedMs); row.maxTtfbMs = Math.max(row.maxTtfbMs, o.ttfbMs ?? 0)
    if (o.outcome === 'success') row.successes++; else row.aborts++
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
    return { decisionStage: 'plan', id: d.id, action: d.action, reason: d.reason, routeType: d.routeType, host: this.#host(d.host) }
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
        ...(event.action.action === 'route-fallback' ? { kind: event.action.kind, decision: this.#decision(event.action.decision) }
          : event.action.action === 'player-reload' ? { savedPositionSec: event.action.savedPositionSec, savedRate: event.action.savedRate } : { reason: event.action.reason }) }; important = true; break
      case 'core': case 'core-uninitialized': data = { ...event }; important = true; break
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
      events: this.#events.filter(event => at - event.at <= 60_000).map(event => structuredClone(event)), flow: this.#flows() }
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
      else if (this.#flow.size > 1) { this.#flow.delete(this.#flow.keys().next().value as string); this.#counters.flowEvicted++ }
      else if (this.#events.length > 1) { this.#events.shift(); this.#counters.evicted++ }
      else if (this.#pending.size) { this.#pending.delete(this.#pending.keys().next().value as string); this.#counters.pendingEvicted++ }
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
