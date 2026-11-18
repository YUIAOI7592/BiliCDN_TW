import { type ControlModelSources, type ControlReadModelPort } from './control-contracts.ts'
import { EMPTY_ROUTE_SNAPSHOT } from '../application/routing/route-contracts.ts'
export function createControlReadModel(sources: ControlModelSources): ControlReadModelPort {
  const read = () =>
    Object.freeze({
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
  return {
    snapshot() {
      const first = read()
      let session = sources.session.get()
      if (first.session.generation === session.generation && first.session.epoch === session.epoch)
        return first
      const second = read()
      session = sources.session.get()
      if (
        second.session.generation === session.generation &&
        second.session.epoch === session.epoch
      )
        return second
      return Object.freeze({
        ...second,
        session: Object.freeze({
          ...session,
          representation: null,
          affinity: null,
          lastDecisionId: null,
        }),
        routes: EMPTY_ROUTE_SNAPSHOT,
      })
    },
    subscribe(listener) {
      const stops = (['settings', 'monitor', 'routes'] as const).flatMap((kind) => {
        const source = sources[kind]
        return source.subscribe ? [source.subscribe(() => listener(kind))] : []
      })
      return () => {
        for (const stop of stops) stop()
      }
    },
  }
}
