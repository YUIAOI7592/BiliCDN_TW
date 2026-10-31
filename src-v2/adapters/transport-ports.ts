import type { RouteCoordinatorPort } from '../application/route-contracts.ts'
import type { MeasurementPort } from '../application/measurement-contracts.ts'
import type { SessionPort } from '../state/session-contracts.ts'
import type { SettingsState } from '../state/settings-contracts.ts'

export interface TransportRoutes extends Pick<
  RouteCoordinatorPort,
  | 'policyRevision'
  | 'isCatalogOnly'
  | 'recognizesMedia'
  | 'isBilibiliMedia'
  | 'apply'
  | 'inspectOriginal'
  | 'requestStarted'
  | 'observe'
> {}
export interface TransportSessionPort extends Pick<SessionPort, 'get' | 'isGeneration'> {}
export interface TransportSettings {
  get(): Pick<SettingsState, 'disabled' | 'blockHttpDns'> &
    Partial<Pick<SettingsState, 'earlyRetryEnabled'>>
}
export interface StartupGate extends Pick<
  MeasurementPort,
  'willGateStartup' | 'prepareStartup' | 'noteUnpreflighted'
> {}
export interface HookInstallation {
  restore(): void
  isInstalled(): boolean
}
