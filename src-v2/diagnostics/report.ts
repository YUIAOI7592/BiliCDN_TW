import type {
  DiagnosticSnapshot,
  DiagnosticReportCurrent,
  DiagnosticRanking,
  Flow,
  Incident,
  SafeEvent,
} from './model.ts'
import type { BufferTrendSnapshot } from '../domain/buffer-trend.ts'

/** A detached capture whose arrays may be reduced while preparing an export. */
export type DiagnosticReportCapture = Omit<
  DiagnosticSnapshot,
  'incident' | 'flow' | 'events' | 'rankings' | 'bufferTrend'
> & {
  bufferTrend: {
    schemaVersion: 5
    algorithm: 'buffer-window-v5'
    latest: BufferTrendSnapshot | null
    history: BufferTrendSnapshot[]
  }
  incident: Incident | null
  flow: (Flow & { key: string })[]
  events: SafeEvent[]
  rankings: DiagnosticRanking[]
}
export interface DiagnosticReportInput {
  readonly generatedAt: string
  readonly evidence: string
  readonly recorder: DiagnosticReportCapture
  readonly current: DiagnosticReportCurrent
}

export function serializeDiagnosticReport(input: DiagnosticReportInput): string {
  const { recorder } = input
  const payload = {
    title: 'BiliCDN_TW v2 診斷報告',
    generatedAt: input.generatedAt,
    evidence: input.evidence,
    current: input.current.current,
    recorder,
    export: {
      truncated: false,
      rankingDropped: 0,
      traceDropped: 0,
      contextDropped: 0,
      flowDropped: 0,
      incidentDropped: 0,
      bufferTrendDropped: 0,
      currentReduced: false,
      emergencySummary: false,
    },
  }
  let output = JSON.stringify(payload, null, 2)
  if (new TextEncoder().encode(output).byteLength <= 96 * 1024) return output
  payload.export.truncated = true
  output = JSON.stringify(payload)
  if (new TextEncoder().encode(output).byteLength <= 96 * 1024) return output
  while (
    new TextEncoder().encode(output).byteLength > 96 * 1024 &&
    recorder.bufferTrend.history.length
  ) {
    recorder.bufferTrend.history.shift()
    recorder.bufferTrend.latest = recorder.bufferTrend.history.at(-1) ?? null
    payload.export.bufferTrendDropped++
    output = JSON.stringify(payload)
  }
  if (new TextEncoder().encode(output).byteLength <= 96 * 1024) return output
  payload.export.rankingDropped = recorder.rankings.length
  recorder.rankings = []
  output = JSON.stringify(payload)
  const { events, flow: flows, incident } = recorder
  while (
    new TextEncoder().encode(output).byteLength > 96 * 1024 &&
    (incident?.playerTrace.length ||
      events.length > 1 ||
      flows.length > 1 ||
      (incident?.events.length ?? 0) > 1)
  ) {
    if (incident?.playerTrace.length) {
      incident.playerTrace.shift()
      payload.export.traceDropped++
    } else if (events.length > 1) {
      const i = events.findIndex((row) => !row.important)
      events.splice(i >= 0 ? i : 0, 1)
      payload.export.contextDropped++
    } else if (flows.length > 1) {
      flows.shift()
      payload.export.flowDropped++
    } else if (incident && incident.events.length > 1) {
      const i = incident.events.findIndex((row) => !row.important)
      incident.events.splice(i >= 0 ? i : 0, 1)
      payload.export.incidentDropped++
    }
    output = JSON.stringify(payload)
  }
  if (new TextEncoder().encode(output).byteLength <= 96 * 1024) return output
  payload.current = input.current.reduced()
  payload.export.currentReduced = true
  output = JSON.stringify(payload)
  if (new TextEncoder().encode(output).byteLength <= 96 * 1024) return output
  const latest = recorder.routeRecovery.attempts.at(-1)
  const summary = {
    title: payload.title,
    generatedAt: payload.generatedAt,
    evidence: payload.evidence,
    current: input.current.emergency(),
    recorder: {
      incident: incident && {
        id: incident.id,
        reason: incident.reason,
        startedAt: incident.startedAt,
        state: incident.state,
      },
      routeRecovery: {
        attempts: latest
          ? [
              {
                actionId: latest.actionId,
                decisionId: latest.decisionId,
                host: latest.host,
                stage: latest.stage,
              },
            ]
          : [],
      },
    },
    export: { ...payload.export, emergencySummary: true },
  }
  return JSON.stringify(summary)
}
