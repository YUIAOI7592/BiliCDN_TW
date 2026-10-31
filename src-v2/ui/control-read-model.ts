import { evidenceMetrics } from '../domain/evidence.ts'
import type { ControlModelSources, ControlReadModelPort } from './control-contracts.ts'

export function createControlReadModel(
  sources: ControlModelSources,
  version: string,
): ControlReadModelPort {
  return {
    snapshot(includeEvidence = false) {
      const now = sources.now()
      return Object.freeze({
        version,
        releaseStage: 'stable' as const,
        settings: sources.settings.get(),
        session: sources.session.get(),
        monitor: sources.monitor.snapshot(),
        recovery: sources.recovery.snapshot(),
        measurement: sources.measurement.snapshot(),
        interception: sources.transport.snapshot(),
        routes: sources.routes.snapshot(),
        restrictions: sources.restrictions.list(),
        ...(sources.earlyRetry ? { earlyRetry: sources.earlyRetry.snapshot() } : {}),
        evidence: includeEvidence
          ? sources.evidence
              .list()
              .slice(0, 96)
              .map((row) => ({ host: row.host, kind: row.kind, ...evidenceMetrics(row, now) }))
          : [],
      })
    },
    subscribe(listener) {
      const stops = [sources.settings, sources.monitor, sources.routes].flatMap((source) =>
        source.subscribe ? [source.subscribe(listener)] : [],
      )
      return () => {
        for (const stop of stops) stop()
      }
    },
  }
}
