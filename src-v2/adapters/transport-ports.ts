import type { RouteCoordinatorPort } from '../application/route-ports.ts'
import type { MeasurementPort } from '../application/measurement-ports.ts'
import type { SessionPort } from '../state/session-ports.ts'
import type { SettingsState } from '../state/settings-model.ts'

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
  get(): Pick<SettingsState, 'disabled' | 'blockHttpDns'>
}
export interface StartupGate extends Pick<
  MeasurementPort,
  'willGateStartup' | 'prepareStartup' | 'noteUnpreflighted'
> {}
export interface HookInstallation {
  restore(): void
  isInstalled(): boolean
}
