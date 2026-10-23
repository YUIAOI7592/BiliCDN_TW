import type { DomainEvent, TransportObservation, RequestContext } from '../domain/model.ts'
import type { PlaybackDiagnosticSample, ReadonlySnapshot } from '../domain/diagnostic-model.ts'
export type { PlaybackDiagnosticSample } from '../domain/diagnostic-model.ts'
export type { DiagnosticSnapshot } from './model.ts'
import type {
  DiagnosticTransport,
  DiagnosticRanking,
  SafeEvent,
  Flow,
  Incident,
  DiagnosticSnapshot,
} from './model.ts'
import type { DiagnosticRecorderPort } from './ports.ts'
import { DiagnosticEventSanitizer, incidentTrigger } from './event-sanitizer.ts'
import { RouteAttemptTracker } from './route-attempt-tracker.ts'
import { serializeDiagnosticReport } from './report.ts'
import { sanitizeBufferTrend } from './buffer-trend.ts'
import type { BufferTrendSnapshot } from '../domain/buffer-trend.ts'
import {
  diagnosticBytes as bytes,
  diagnosticText as text,
  finiteDiagnosticNumber as finite,
} from './values.ts'

export class DiagnosticRecorder implements DiagnosticRecorderPort {
  #bufferTrends: BufferTrendSnapshot[] = []
  #bufferRevision = 0
  #events: SafeEvent[] = []
  #flow = new Map<string, Flow>()
  #pending = new Map<string, RequestContext>()
  #lastSuccess = new Map<string, DiagnosticTransport>()
  #lastConfirmed = new Map<string, string>()
  #lastAttribution = new Map<string, string>()
  #rankings: DiagnosticRanking[] = []
  #incident: Incident | null = null
  #attemptTracker: RouteAttemptTracker
  #recentPlayerTrace: { at: number; row: string }[] = []
  #lastPaused: boolean | null = null
  #lastPlayerFrames: number | null = null
  #serial = 0
  #sanitizer = new DiagnosticEventSanitizer()
  #manualMark: { at: number; reason: string; count: number } | null = null
  #counters = {
    evicted: 0,
    incidentReplaced: 0,
    rankingEvicted: 0,
    flowEvicted: 0,
    incidentEvicted: 0,
    pendingEvicted: 0,
    eventsExpired: 0,
    flowsExpired: 0,
    traceEvicted: 0,
    attemptEvicted: 0,
    bufferTrendEvicted: 0,
    bufferTrendRejected: 0,
  }
  constructor(
    private readonly now: () => number,
    private readonly verbose: () => boolean,
  ) {
    this.#attemptTracker = new RouteAttemptTracker(now)
  }

  tick(): void {
    if (this.#incident?.state === 'capturing' && this.now() >= this.#incident.captureUntil)
      this.#incident.state = 'frozen'
    this.#attemptTracker.tick()
    const floor = this.now() - 60_000
    const events = this.#events.filter((event) => event.at >= floor)
    this.#counters.eventsExpired += this.#events.length - events.length
    this.#events = events
    for (const [key, row] of this.#flow)
      if (row.lastAt < floor) {
        this.#flow.delete(key)
        this.#counters.flowsExpired++
      }
    for (const [key, row] of this.#pending)
      if (this.now() - row.startedAt > 120_000) {
        this.#pending.delete(key)
        this.#counters.pendingEvicted++
      }
  }

  record(event: DomainEvent, routeObservationEnabled = true): void {
    this.tick()
    if (routeObservationEnabled) this.#counters.attemptEvicted += this.#attemptTracker.record(event)
    else this.#attemptTracker.interrupt()
    if (event.type === 'request-started') {
      this.#pending.set(event.request.requestId, event.request)
      while (this.#pending.size > 32) {
        this.#pending.delete(this.#pending.keys().next().value as string)
        this.#counters.pendingEvicted++
      }
      return
    }
    if (event.type === 'route-confirmed') {
      const o = event.observation,
        key = o.kind ?? 'unknown',
        signature = [o.finalHost, o.routeType, o.representation].join(':')
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
        if (o.outcome === 'success' && !(event.type === 'transport-completed' && event.detached))
          this.#lastSuccess.set(o.kind ?? 'unknown', this.#sanitizer.transport(o))
        return
      }
    }
    const safe = this.#event(event)
    this.#events.push(safe)
    this.#trim(this.#events, 24 * 1024, 'evicted')
    const trigger = incidentTrigger(event)
    if (this.#incident?.state === 'capturing') {
      this.#incident.events.push(safe)
      if (trigger)
        this.#incident.captureUntil = Math.min(
          this.#incident.startedAt + 90_000,
          Math.max(this.#incident.captureUntil, event.at + 30_000),
        )
      this.#trim(this.#incident.events, 48 * 1024, 'incidentEvicted')
    } else if (trigger) this.#start(trigger, event.at)
    this.#bound()
  }

  mark(reason = 'manual'): void {
    this.tick()
    this.#manualMark = {
      at: this.now(),
      reason: text(reason),
      count: (this.#manualMark?.count ?? 0) + 1,
    }
    if (!this.#incident) this.#start(text(reason), this.now())
    this.#bound()
  }
  clear(): void {
    this.#bufferRevision++
    this.#bufferTrends = []
    this.#incident = null
    this.#manualMark = null
    this.#attemptTracker.clear()
    this.#recentPlayerTrace = []
    this.#lastPaused = null
    this.#lastPlayerFrames = null
  }
  recordPlayer(sample: PlaybackDiagnosticSample): void {
    this.tick()
    this.#attemptTracker.recordPlayer(sample)
    const flags =
      Number(sample.paused) |
      (Number(sample.seeking) << 1) |
      (Number(sample.ended) << 2) |
      (Number(sample.coreInitialized === false) << 3) |
      (Number(sample.coreInitialized === true) << 4)
    const currentFrames = finite(sample.frames, 0, 2 ** 32 - 1)
    const frameDelta =
      currentFrames !== null && this.#lastPlayerFrames !== null
        ? Math.max(0, currentFrames - this.#lastPlayerFrames)
        : -1
    this.#lastPlayerFrames = currentFrames
    const row = [
      Math.trunc(sample.at),
      Math.round((finite(sample.currentTimeSec, 0, 86400) ?? 0) * 10),
      frameDelta,
      Math.round((finite(sample.playableBufferSec, 0, 86400) ?? 0) * 10),
      Math.max(0, Math.min(4, Math.trunc(sample.readyState))),
      flags,
      text(sample.watchdog, 20),
    ].join(',')
    this.#recentPlayerTrace.push({ at: sample.at, row })
    this.#recentPlayerTrace = this.#recentPlayerTrace
      .filter((item) => item.at >= sample.at - 20_000)
      .slice(-21)
    if (this.#incident?.state === 'capturing' && sample.at <= this.#incident.startedAt + 90_000) {
      this.#incident.playerTrace.push(row)
      while (
        bytes(this.#incident.playerTrace) > 4 * 1024 &&
        this.#incident.playerTrace.length > 1
      ) {
        this.#incident.playerTrace.shift()
        this.#counters.traceEvicted++
      }
    }
    if (this.#lastPaused !== null && this.#lastPaused !== sample.paused) {
      const event: SafeEvent = {
        at: sample.at,
        type: 'player-paused-changed',
        data: { paused: sample.paused },
        important: true,
      }
      this.#events.push(event)
      this.#trim(this.#events, 24 * 1024, 'evicted')
      if (this.#incident?.state === 'capturing') {
        this.#incident.events.push(event)
        this.#trim(this.#incident.events, 48 * 1024, 'incidentEvicted')
      }
    }
    this.#lastPaused = sample.paused
    if (sample.bufferTrend !== undefined) {
      const revision = this.#bufferRevision
      const row = sanitizeBufferTrend(sample.bufferTrend)
      if (revision !== this.#bufferRevision) {
        // A synchronous clear owns the new diagnostic history.
      } else if (!row || row.at === null || row.at > sample.at) this.#counters.bufferTrendRejected++
      else if (this.#bufferTrends.at(-1)?.at !== row.at) {
        if (
          this.#bufferTrends.at(-1)?.at !== undefined &&
          row.at < this.#bufferTrends.at(-1)!.at!
        ) {
          this.#bufferTrends = []
        }
        this.#bufferTrends.push(row)
        while (this.#bufferTrends.length > 32 || bytes(this.#bufferCapture()) > 8 * 1024) {
          this.#bufferTrends.shift()
          this.#counters.bufferTrendEvicted++
        }
      }
    }
    this.#bound()
  }
  #bufferCapture() {
    const history = structuredClone(this.#bufferTrends)
    return {
      schemaVersion: 3 as const,
      algorithm: 'buffer-window-v3' as const,
      latest: history.at(-1) ?? null,
      history,
    }
  }
  snapshot(): ReadonlySnapshot<DiagnosticSnapshot> {
    return this.#capture()
  }
  #capture() {
    return Object.freeze({
      bufferTrend: this.#bufferCapture(),
      coverage: {
        from: this.#events[0]?.at ?? this.now(),
        to: this.#events.at(-1)?.at ?? this.now(),
      },
      incident: this.#incident ? structuredClone(this.#incident) : null,
      manualMark: this.#manualMark ? { ...this.#manualMark } : null,
      flow: this.#flows(),
      lastSuccess: Object.fromEntries(this.#lastSuccess),
      pending: [...this.#pending.values()].map((row) => this.#sanitizer.request(row)),
      events: structuredClone(this.#events),
      rankings: structuredClone(this.#rankings),
      routeRecovery: {
        attempts: this.#attemptTracker.snapshot((host) => this.#sanitizer.host(host)),
      },
      counters: { ...this.#counters },
    })
  }

  buildReport(readModel: object): string {
    const recorder = { ...this.#capture() }
    return serializeDiagnosticReport({
      generatedAt: new Date(this.now()).toISOString(),
      evidence: this.#incident
        ? this.#incident.state + '-incident'
        : this.#lastSuccess.size
          ? 'media-observation-only'
          : 'playback-observation-unattributed',
      recorder,
      current: this.#sanitizer.reportCurrent(readModel),
    })
  }

  #aggregate(o: TransportObservation): void {
    const key = [
      Math.floor(o.completedAt / 5000),
      o.kind ?? 'unknown',
      o.routeType,
      this.#sanitizer.host(o.targetHost),
      this.#sanitizer.host(o.finalHost),
    ].join(':')
    const row = this.#flow.get(key) ?? {
      requests: 0,
      successes: 0,
      failures: 0,
      timeouts: 0,
      aborts: 0,
      zeroByteAborts: 0,
      noResponseAborts: 0,
      bytes: 0,
      lastAt: 0,
      maxElapsedMs: 0,
      maxTtfbMs: 0,
    }
    row.requests++
    row.bytes += o.bytes
    row.lastAt = o.completedAt
    row.maxElapsedMs = Math.max(row.maxElapsedMs, o.elapsedMs)
    row.maxTtfbMs = Math.max(row.maxTtfbMs, o.ttfbMs ?? 0)
    if (o.outcome === 'success') row.successes++
    else if (o.outcome === 'failure') {
      row.failures++
      if (o.failureKind === 'timeout') row.timeouts++
    } else {
      row.aborts++
      if (o.bytes === 0) row.zeroByteAborts++
      if (o.status === 0 && o.finalHost === null) row.noResponseAborts++
    }
    this.#flow.set(key, row)
    while (this.#flow.size > 48 || bytes(this.#flows()) > 12 * 1024) {
      this.#flow.delete(this.#flow.keys().next().value as string)
      this.#counters.flowEvicted++
    }
    this.#bound()
  }
  #flows() {
    return [...this.#flow].map(([key, row]) => ({ key, ...row }))
  }
  #event(event: DomainEvent): SafeEvent {
    const { event: safe, ranking } = this.#sanitizer.event(event, this.verbose)
    if (ranking) {
      const signature = JSON.stringify(ranking.ranking)
      if (!this.#rankings.some((row) => JSON.stringify(row.ranking) === signature))
        this.#rankings.push(ranking)
      while (this.#rankings.length > 4 || bytes(this.#rankings) > 12 * 1024) {
        this.#rankings.shift()
        this.#counters.rankingEvicted++
      }
    }
    return safe
  }
  #start(reason: string, at: number): void {
    if (this.#incident?.state === 'capturing') {
      this.#incident.captureUntil = Math.min(this.#incident.startedAt + 90_000, at + 30_000)
      return
    }
    if (this.#incident) this.#counters.incidentReplaced++
    this.#incident = {
      id: 'incident-' + ++this.#serial,
      reason,
      startedAt: at,
      captureUntil: at + 30_000,
      state: 'capturing',
      events: this.#events
        .filter((event) => at - event.at <= 60_000)
        .map((event) => structuredClone(event)),
      flow: this.#flows(),
      playerTrace: this.#recentPlayerTrace.map((item) => item.row),
      playerTraceFormat:
        'atMs,currentTimeDeciSec,frameDelta,playableBufferDeciSec,readyState,flags,watchdog',
      playerTraceFlags: '1=paused,2=seeking,4=ended,8=coreFalse,16=coreTrue',
    }
  }
  #trim(rows: SafeEvent[], max: number, counter: 'evicted' | 'incidentEvicted'): void {
    while (bytes(rows) > max && rows.length > 1) {
      let index = rows.findIndex((row) => !row.important)
      if (index < 0) index = rows.findIndex((row) => row.at !== this.#incident?.startedAt)
      rows.splice(index < 0 ? 0 : index, 1)
      this.#counters[counter]++
    }
  }
  #bound(): void {
    while (bytes(this.snapshot()) > 128 * 1024) {
      if (this.#bufferTrends.length) {
        this.#bufferTrends.shift()
        this.#counters.bufferTrendEvicted++
      } else if (this.#rankings.length) {
        this.#rankings.shift()
        this.#counters.rankingEvicted++
      } else if (this.#incident?.playerTrace.length) {
        this.#incident.playerTrace.shift()
        this.#counters.traceEvicted++
      } else if (this.#flow.size > 1) {
        this.#flow.delete(this.#flow.keys().next().value as string)
        this.#counters.flowEvicted++
      } else if (this.#events.length > 1) {
        this.#events.shift()
        this.#counters.evicted++
      } else if (this.#pending.size) {
        this.#pending.delete(this.#pending.keys().next().value as string)
        this.#counters.pendingEvicted++
      } else if (this.#incident && this.#incident.events.length > 1) {
        this.#incident.events.shift()
        this.#counters.incidentEvicted++
      } else if (this.#attemptTracker.dropOldest()) {
        this.#counters.attemptEvicted++
      } else break
    }
  }
}
