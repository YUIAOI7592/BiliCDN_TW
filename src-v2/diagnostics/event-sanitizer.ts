import type {
  DomainEvent,
  RequestContext,
  TransportObservation,
  RouteDecision,
} from '../domain/model.ts'
import { assessDemandRatio } from '../domain/routing.ts'
import { isCatalogHost } from '../domain/catalog.ts'
import { isKnownNativeFamily } from '../domain/url-policy.ts'
import type {
  DiagnosticRequest,
  DiagnosticTransport,
  DiagnosticDecision,
  DiagnosticRanking,
  DiagnosticEventData,
  SafeEvent,
  SanitizedValue,
  DiagnosticReportCurrent,
} from './model.ts'
import { diagnosticText as text, diagnosticField as field } from './values.ts'

export class DiagnosticEventSanitizer {
  #aliases = new Map<string, string>()
  request(row: RequestContext): DiagnosticRequest {
    return {
      requestId: text(row.requestId, 160),
      generation: row.generation,
      epoch: row.epoch,
      routePolicyRevision: row.routePolicyRevision,
      decisionId: text(row.decisionId, 160),
      representation: row.representation === null ? null : text(row.representation, 160),
      ...(row.authorityRevision !== undefined ? { authorityRevision: row.authorityRevision } : {}),
      kind: row.kind,
      attributionStatus: row.attributionStatus,
      attributionSource: row.attributionSource,
      decisionStage: row.decisionStage,
      routeType: row.routeType,
      originalHost: this.host(row.originalHost),
      targetHost: this.host(row.targetHost),
      sourceHost: this.host(row.sourceHost),
      playurlHostChanged: row.playurlHostChanged,
      playurlOutput: row.playurlOutput
        ? {
            originalHost: this.host(row.playurlOutput.originalHost) ?? '',
            outputHost: this.host(row.playurlOutput.outputHost) ?? '',
            role: row.playurlOutput.role,
            source: row.playurlOutput.source,
            decisionId: row.playurlOutput.decisionId,
            hostChanged: row.playurlOutput.hostChanged,
          }
        : null,
      urlChanged: row.urlChanged,
      hostChanged: row.hostChanged,
      startedAt: row.startedAt,
    }
  }
  transport(o: TransportObservation): DiagnosticTransport {
    return {
      ...(o.request ? this.request(o.request) : {}),
      decisionId: o.decisionId,
      generation: o.generation,
      epoch: o.epoch,
      kind: o.kind,
      representation: o.representation,
      routeType: o.routeType,
      originalHost: this.host(o.originalHost),
      targetHost: this.host(o.targetHost),
      responseHost: this.host(o.finalHost),
      status: o.status,
      bytes: o.bytes,
      ttfbMs: o.ttfbMs,
      elapsedMs: o.elapsedMs,
      completedAt: o.completedAt,
      outcome: o.outcome,
      failureKind: o.failureKind ?? null,
    }
  }
  decision(d: RouteDecision): DiagnosticDecision {
    const chosen = d.ranking.find(
      (row) => row.candidate.host === d.host && row.candidate.type === d.routeType,
    )
    return {
      decisionStage: 'plan',
      id: d.id,
      action: d.action,
      reason: d.reason,
      routeType: d.routeType,
      host: this.host(d.host),
      demandRatio: chosen?.demandRatio ?? null,
      capacityAssessment: assessDemandRatio(chosen?.demandRatio ?? null),
    }
  }
  event(
    event: DomainEvent,
    verbose: () => boolean,
  ): { event: SafeEvent; ranking: DiagnosticRanking | null } {
    let ranking: DiagnosticRanking | null = null
    let data: DiagnosticEventData,
      important = false
    switch (event.type) {
      case 'route-decision':
      case 'route-planned': {
        data = this.decision(event.decision)
        if (verbose()) {
          ranking = {
            ...data,
            ranking: event.decision.ranking.slice(0, 12).map((row) => ({
              host: this.host(row.candidate.host),
              state: row.state,
              eligible: row.eligible,
              reasons: row.reasons,
              safeMbps: row.safeThroughputMbps,
              demandRatio: row.demandRatio,
              ttfbMs: row.medianTtfbMs,
            })),
          }
        }
        break
      }
      case 'transport':
      case 'transport-completed':
        data = {
          ...this.transport(event.observation),
          detached: event.type === 'transport-completed' && event.detached,
        }
        important = true
        break
      case 'route-confirmed':
        data = this.transport(event.observation)
        important = true
        break
      case 'route-observed':
        data = {
          routeType: event.routeType,
          host: this.host(event.host),
          decisionId: event.decisionId,
        }
        important = true
        break
      case 'request-started':
        data = this.request(event.request)
        break
      case 'attribution-changed':
        data = { requestId: event.requestId, status: event.status, kind: event.kind }
        break
      case 'recovery':
        data = {
          action: event.action.action,
          actionId: event.action.id,
          ...(event.action.action === 'route-fallback'
            ? {
                kind: event.action.kind,
                identity: event.action.identity,
                decision: this.decision(event.action.decision),
              }
            : event.action.action === 'player-reload'
              ? {
                  savedPositionSec: event.action.savedPositionSec,
                  savedRate: event.action.savedRate,
                }
              : { reason: event.action.reason }),
        }
        important = true
        break
      case 'core':
      case 'core-uninitialized':
        data = {
          ...event,
          ...(event.type === 'core' && event.state === 'recovered'
            ? { meaning: 'player-core-progress-only' }
            : {}),
        }
        important = true
        break
      case 'lifecycle':
        data = { generation: event.generation, epoch: event.epoch, reason: event.reason }
        important = true
        break
    }
    return { event: { at: event.at, type: event.type, data, important }, ranking }
  }
  host(host: string | null): string | null {
    if (!host || isCatalogHost(host) || isKnownNativeFamily(host)) return host
    if (this.#aliases.has(host)) return this.#aliases.get(host) ?? 'external'
    if (this.#aliases.size >= 64) return 'external#overflow'
    const alias = 'external#' + (this.#aliases.size + 1)
    this.#aliases.set(host, alias)
    return alias
  }
  sanitize(value: unknown, key = '', depth = 0): SanitizedValue {
    if (depth > 7) return '[bounded]'
    if (typeof value === 'string')
      return key.toLowerCase().includes('host') ? this.host(value) : text(value, 160)
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return value
    if (Array.isArray(value))
      return value.slice(0, 48).map((item) => this.sanitize(item, key, depth + 1))
    if (!value || typeof value !== 'object') return null
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 48)
        .filter(
          ([name]) => !['streamKey', 'url', 'path', 'query', 'token', 'bufferTrend'].includes(name),
        )
        .map(([name, item]) => [name, this.sanitize(item, name, depth + 1)]),
    )
  }
  reportCurrent(readModel: object): DiagnosticReportCurrent {
    let retained: {
      version: unknown
      session: unknown
      monitor: unknown
      recovery: unknown
      measurement: unknown
      interception: unknown
    } | null = null
    return {
      current: this.sanitize(readModel),
      reduced: () => {
        const m = {
          version: field(readModel, 'version'),
          session: field(readModel, 'session'),
          monitor: field(readModel, 'monitor'),
          recovery: field(readModel, 'recovery'),
          measurement: field(readModel, 'measurement'),
          interception: field(readModel, 'interception'),
        }
        retained = m
        const r = field(readModel, 'routes')
        return this.sanitize({
          version: m.version,
          session: m.session,
          monitor: m.monitor,
          recovery: m.recovery,
          measurement: m.measurement,
          interception: m.interception,
          routes: {
            planCount: field(r, 'planCount'),
            activePlan: field(r, 'activePlan'),
            affinity: field(r, 'affinity'),
            latest: field(r, 'latest'),
            representation: field(r, 'representation'),
            attribution: field(r, 'attribution'),
          },
          truncated: true,
        })
      },
      emergency: () =>
        this.sanitize({
          version: retained?.version,
          monitor: { watchdog: field(retained?.monitor, 'watchdog') },
          truncated: true,
        }),
    }
  }
}

export const incidentTrigger = (event: DomainEvent): string | null => {
  if (event.type === 'core-uninitialized') return 'core:uninitialized'
  if (
    (event.type === 'transport' || event.type === 'transport-completed') &&
    event.observation.outcome === 'failure' &&
    !(event.type === 'transport-completed' && event.detached)
  )
    return 'transport:' + (event.observation.failureKind ?? 'failure')
  if (event.type === 'recovery') return 'recovery:' + event.action.action
  if (event.type === 'core' && ['reloading', 'failed'].includes(event.state))
    return 'core:' + event.state
  return null
}
