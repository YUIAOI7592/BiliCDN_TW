import type { ControlModelSources, ControlReadModelPort } from './control-contracts.ts'

export function createControlReadModel(sources: ControlModelSources): ControlReadModelPort {
  return {
    snapshot() {
      return Object.freeze({
        settings: sources.settings.get(),
        session: sources.session.get(),
        monitor: sources.monitor.snapshot(),
        recovery: sources.recovery.snapshot(),
        measurement: sources.measurement.snapshot(),
        interception: sources.transport.snapshot(),
        routes: sources.routes.snapshot(),
        restrictions: sources.restrictions.list(),
        ...(sources.earlyRetry ? { earlyRetry: sources.earlyRetry.snapshot() } : {}),
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
