import type {
  DomainEvent,
  RouteDecision,
  TransportObservation,
  RequestContext,
  RouteIdentity,
} from '../domain/model.ts'
import type { assessDemandRatio } from '../domain/routing.ts'
import type { ReadonlySnapshot } from '../domain/diagnostic-model.ts'
import type { BufferTrendSnapshot } from '../domain/buffer-trend.ts'

export type SanitizedValue =
  | string
  | number
  | boolean
  | null
  | readonly SanitizedValue[]
  | { readonly [key: string]: SanitizedValue }
export interface DiagnosticReportCurrent {
  readonly current: SanitizedValue
  reduced(): SanitizedValue
  emergency(): SanitizedValue
}

export interface DiagnosticRequest extends Omit<
  RequestContext,
  'originalHost' | 'targetHost' | 'requestId' | 'decisionId' | 'representation'
> {
  readonly originalHost: string | null
  readonly targetHost: string | null
  readonly requestId: string
  readonly decisionId: string
  readonly representation: string | null
}
export interface DiagnosticTransport extends Partial<Omit<DiagnosticRequest, 'decisionId'>> {
  readonly decisionId: string | null
  readonly generation: RequestContext['generation']
  readonly epoch: RequestContext['epoch']
  readonly kind: TransportObservation['kind']
  readonly representation: string | null
  readonly routeType: TransportObservation['routeType']
  readonly originalHost: string | null
  readonly targetHost: string | null
  readonly responseHost: string | null
  readonly status: number
  readonly bytes: number
  readonly ttfbMs: number | null
  readonly elapsedMs: number
  readonly completedAt: number
  readonly outcome: TransportObservation['outcome']
  readonly failureKind: TransportObservation['failureKind'] | null
}
export interface DiagnosticDecision {
  readonly decisionStage: 'plan'
  readonly id: string
  readonly action: RouteDecision['action']
  readonly reason: string
  readonly routeType: RouteDecision['routeType']
  readonly host: string | null
  readonly demandRatio: number | null
  readonly capacityAssessment: ReturnType<typeof assessDemandRatio>
}
export interface DiagnosticRanking extends DiagnosticDecision {
  readonly ranking: readonly {
    readonly host: string | null
    readonly state: RouteDecision['ranking'][number]['state']
    readonly eligible: boolean
    readonly reasons: readonly string[]
    readonly safeMbps: number | null
    readonly demandRatio: number | null
    readonly ttfbMs: number | null
  }[]
}
export type EventOf<Type extends DomainEvent['type']> = Extract<DomainEvent, { type: Type }>
export type DiagnosticEventData =
  | DiagnosticDecision
  | DiagnosticRequest
  | (DiagnosticTransport & { detached?: boolean })
  | { routeType: RequestContext['routeType']; host: string | null; decisionId: string | null }
  | Pick<EventOf<'attribution-changed'>, 'requestId' | 'status' | 'kind'>
  | {
      action: EventOf<'recovery'>['action']['action']
      actionId: string
      kind?: RequestContext['kind']
      identity?: RouteIdentity
      decision?: DiagnosticDecision
      savedPositionSec?: number
      savedRate?: number
      reason?: string
    }
  | (EventOf<'core' | 'core-uninitialized'> & { meaning?: string })
  | Pick<EventOf<'lifecycle'>, 'generation' | 'epoch' | 'reason'>
  | { paused: boolean }
export interface SafeEvent {
  at: number
  type: string
  data: DiagnosticEventData
  important: boolean
}
export interface Flow {
  requests: number
  successes: number
  failures: number
  timeouts: number
  aborts: number
  zeroByteAborts: number
  noResponseAborts: number
  bytes: number
  lastAt: number
  maxElapsedMs: number
  maxTtfbMs: number
}
export interface Incident {
  id: string
  reason: string
  startedAt: number
  captureUntil: number
  state: 'capturing' | 'frozen'
  events: SafeEvent[]
  flow: (Flow & { key: string })[]
  playerTrace: string[]
  playerTraceFormat: string
  playerTraceFlags: string
}
export type AttemptStage =
  | 'planned'
  | 'sent'
  | 'progress-unconfirmed'
  | 'response-observed'
  | 'playback-observed'
  | 'mixed-evidence'
  | 'unconfirmed'
  | 'superseded'
  | 'interrupted'
export interface RouteAttemptSummary {
  readonly actionId: string
  readonly decisionId: string
  readonly host: string | null
  readonly generation: number
  readonly epoch: number
  readonly representation: string
  readonly authorityRevision: number
  readonly at: number
  readonly stage: AttemptStage
  readonly baselinePositionSec: number | null
  readonly baselineEndSec: number | null
  readonly requestAt: number | null
  readonly responseAt: number | null
  readonly playbackAt: number | null
  readonly requests: number
  readonly successes: number
  readonly failures: number
  readonly aborts: number
  readonly zeroByteAborts: number
  readonly noResponseAborts: number
  readonly lastOutcomeAt: number | null
  readonly lastFailureKind: string | null
  readonly mixed: boolean
}

/** Public queries retain the concrete, readonly snapshot shape. */
export interface DiagnosticSnapshot {
  readonly bufferTrend: {
    readonly schemaVersion: 3
    readonly algorithm: 'buffer-window-v3'
    readonly latest: BufferTrendSnapshot | null
    readonly history: readonly BufferTrendSnapshot[]
  }
  readonly coverage: { readonly from: number; readonly to: number }
  readonly incident: ReadonlySnapshot<Incident> | null
  readonly manualMark: Readonly<{ at: number; reason: string; count: number }> | null
  readonly flow: readonly Readonly<Flow & { key: string }>[]
  readonly lastSuccess: Readonly<Record<string, DiagnosticTransport>>
  readonly pending: readonly DiagnosticRequest[]
  readonly events: readonly ReadonlySnapshot<SafeEvent>[]
  readonly rankings: readonly DiagnosticRanking[]
  readonly routeRecovery: {
    readonly attempts: readonly RouteAttemptSummary[]
  }
  readonly counters: Readonly<
    Record<
      | 'evicted'
      | 'incidentReplaced'
      | 'rankingEvicted'
      | 'flowEvicted'
      | 'incidentEvicted'
      | 'pendingEvicted'
      | 'eventsExpired'
      | 'flowsExpired'
      | 'traceEvicted'
      | 'attemptEvicted'
      | 'bufferTrendEvicted'
      | 'bufferTrendRejected',
      number
    >
  >
}
