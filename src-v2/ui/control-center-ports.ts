import type { ControlCommandPort } from '../application/control-ports.ts'
import type { MonitorSnapshot } from '../application/monitor-model.ts'
import type { RecoverySnapshot } from '../application/recovery-model.ts'
import type { MeasurementSnapshot } from '../application/measurement-model.ts'
import type { RouteSnapshot } from '../application/route-model.ts'
import type { TransportSnapshot } from '../domain/transport-model.ts'
import type { RouteEvidence } from '../domain/model.ts'
import type { DiagnosticViewPort } from '../diagnostics/ports.ts'
import type { SessionSnapshot } from '../state/session-model.ts'
import type { RestrictionRecord } from '../state/restriction-model.ts'
import type { SettingsReader } from '../state/settings-ports.ts'

export interface ShowControlCenterPort {
  show(opener?: HTMLElement | null): void
}

export interface ControlSessionReader {
  get(): SessionSnapshot
}

export interface ControlRestrictionReader {
  list(): readonly RestrictionRecord[]
}

export interface ControlEvidenceReader {
  list(): readonly RouteEvidence[]
}

export interface ControlRouteReader {
  snapshot(): RouteSnapshot
  isOriginalComparison(): boolean
  latestVideoHost(): string | null
}

export interface ControlMonitorReader {
  snapshot(): MonitorSnapshot
}

export interface ControlRecoveryReader {
  snapshot(): RecoverySnapshot
}

export interface ControlMeasurementReader {
  snapshot(): MeasurementSnapshot
}

export interface ControlTransportReader {
  snapshot(): TransportSnapshot
}

export interface ControlCenterDependencies {
  readonly settings: SettingsReader
  readonly restrictions: ControlRestrictionReader
  readonly evidence: ControlEvidenceReader
  readonly session: ControlSessionReader
  readonly routes: ControlRouteReader
  readonly measurement: ControlMeasurementReader
  readonly monitor: ControlMonitorReader
  readonly recovery: ControlRecoveryReader
  readonly diagnostics: DiagnosticViewPort
  readonly transport: ControlTransportReader
  readonly commands: ControlCommandPort
  readonly now: () => number
}
