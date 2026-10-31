import { type ControlCommandPort } from '../application/control-ports.ts'
import { type MonitorSnapshot } from '../application/monitor-contracts.ts'
import { type RecoverySnapshot } from '../application/recovery-contracts.ts'
import { type MeasurementSnapshot } from '../application/measurement-contracts.ts'
import { type RouteSnapshot } from '../application/route-contracts.ts'
import { type TransportSnapshot } from '../domain/transport-model.ts'
import { type RouteEvidence } from '../domain/model.ts'
import { type DiagnosticViewPort } from '../diagnostics/contracts.ts'
import { type SessionSnapshot } from '../state/session-contracts.ts'
import { type RestrictionRecord } from '../state/restriction-contracts.ts'
import { type SettingsReader, type SettingsState } from '../state/settings-contracts.ts'
import { type evidenceMetrics } from '../domain/evidence.ts'
import { type EarlyRetrySnapshot } from '../application/early-retry-contracts.ts'
export interface ControlCenterSnapshot {
  readonly releaseStage: 'test' | 'stable'
  readonly earlyRetry?: EarlyRetrySnapshot
  readonly version: string
  readonly settings: SettingsState
  readonly session: SessionSnapshot
  readonly monitor: MonitorSnapshot
  readonly recovery: RecoverySnapshot
  readonly measurement: MeasurementSnapshot
  readonly interception: TransportSnapshot
  readonly routes: RouteSnapshot
  readonly restrictions: readonly RestrictionRecord[]
  readonly evidence: readonly Readonly<
    ReturnType<typeof evidenceMetrics> & { host: string; kind: 'video' | 'audio' }
  >[]
}

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
  subscribe?(listener: () => void): () => void
  snapshot(): RouteSnapshot
  isOriginalComparison(): boolean
}

export interface ControlMonitorReader {
  subscribe?(listener: () => void): () => void
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

export interface ControlModelSources {
  readonly earlyRetry?: { snapshot(): EarlyRetrySnapshot }
  readonly settings: SettingsReader & { subscribe?(listener: () => void): () => void }
  readonly restrictions: ControlRestrictionReader
  readonly evidence: ControlEvidenceReader
  readonly session: ControlSessionReader
  readonly routes: ControlRouteReader
  readonly measurement: ControlMeasurementReader
  readonly monitor: ControlMonitorReader
  readonly recovery: ControlRecoveryReader
  readonly transport: ControlTransportReader
  readonly now: () => number
}

export interface ControlReadModelPort {
  snapshot(includeEvidence?: boolean): ControlCenterSnapshot
  subscribe(listener: () => void): () => void
}
export interface ControlCenterDependencies {
  readonly model: ControlReadModelPort
  readonly version: string
  readonly clipboard: (
    text: string,
    ownsView: () => boolean,
  ) => Promise<'native' | 'manager' | null>
  readonly diagnostics: DiagnosticViewPort
  readonly commands: ControlCommandPort
  readonly now: () => number
}
export type ControlPage = 'overview' | 'cdn' | 'settings' | 'diagnostics'
export interface ControlViewFrame {
  readonly body: HTMLDivElement
  readonly foot: HTMLElement
}
export interface ControlViewBinding {
  refresh(model: ControlCenterSnapshot): void
  dispose?(): void
}
/** The modal owns subscriptions and asynchronous command lifetimes. */
export interface ControlViewActions {
  ownsView(): boolean
  refresh(): void
  refreshAfter(command: Promise<unknown>, settled?: () => void): Promise<void>
}
export type ReportCopyAction = (
  report: HTMLTextAreaElement,
  button: HTMLButtonElement,
  status: HTMLElement,
) => Promise<void>
export interface DiagnosticViewActions extends ControlViewActions {
  report(): string
  copy: ReportCopyAction
}
