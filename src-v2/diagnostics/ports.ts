import type { DomainEvent } from '../domain/model.ts'
import type { PlaybackDiagnosticSample, ReadonlySnapshot } from '../domain/diagnostic-model.ts'
import type { DiagnosticSnapshot } from './model.ts'

/** Read and local incident controls exposed to the control center. */
export interface DiagnosticViewPort {
  snapshot(): ReadonlySnapshot<DiagnosticSnapshot>
  buildReport(readModel: object): string
  mark(reason?: string): void
  clear(): void
}

/** Typed observation sink; recording cannot select routes or start network work. */
export interface DiagnosticRecorderPort extends DiagnosticViewPort {
  tick(): void
  record(event: DomainEvent, routeObservationEnabled?: boolean): void
  recordPlayer(sample: PlaybackDiagnosticSample): void
}
