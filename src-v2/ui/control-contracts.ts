import { type ControlCommandPort } from '../application/control-ports.ts'
import { type MonitorSnapshot } from '../application/playback/monitor-contracts.ts'
import { type RecoverySnapshot } from '../application/playback/recovery-contracts.ts'
import { type MeasurementSnapshot } from '../application/measurement/measurement-contracts.ts'
import { type RouteSnapshot } from '../application/routing/route-contracts.ts'
import { type TransportSnapshot } from '../domain/transport-model.ts'
import { type SessionSnapshot } from '../state/session-contracts.ts'
import { type RestrictionRecord } from '../state/restriction-contracts.ts'
import { type SettingsReader, type SettingsState } from '../state/settings-contracts.ts'
import { type EarlyRetrySnapshot } from '../application/routing/early-retry-contracts.ts'
export interface ControlCenterSnapshot {
  readonly earlyRetry?: EarlyRetrySnapshot
  readonly settings: SettingsState
  readonly session: SessionSnapshot
  readonly monitor: MonitorSnapshot
  readonly recovery: RecoverySnapshot
  readonly measurement: MeasurementSnapshot
  readonly interception: TransportSnapshot
  readonly routes: RouteSnapshot
  readonly restrictions: readonly RestrictionRecord[]
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

export interface ControlRouteReader {
  subscribe?(listener: () => void): () => void
  snapshot(): RouteSnapshot
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
  readonly session: ControlSessionReader
  readonly routes: ControlRouteReader
  readonly measurement: ControlMeasurementReader
  readonly monitor: ControlMonitorReader
  readonly recovery: ControlRecoveryReader
  readonly transport: ControlTransportReader
}

export type ControlModelChange = 'settings' | 'monitor' | 'routes'
export interface ControlReadModelPort {
  snapshot(): ControlCenterSnapshot
  subscribe(listener: (source: ControlModelChange) => void): () => void
}
export interface ControlCenterDependencies {
  readonly model: ControlReadModelPort
  readonly version: string
  readonly commands: ControlCommandPort
  readonly now: () => number
}
export type ControlPage = 'overview' | 'cdn' | 'settings'
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
