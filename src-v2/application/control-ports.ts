import type { SettingsChange, SettingsState } from '../state/settings-contracts.ts'
import type { SettingsPort } from '../state/settings-contracts.ts'
import type { RestrictionPort } from '../state/restriction-contracts.ts'
import type { EvidencePort } from '../state/evidence-ports.ts'
import type { MeasurementMetaPort } from '../state/measurement-meta-ports.ts'
import type { RouteCoordinatorPort } from './route-contracts.ts'
import type { MeasurementPort } from './measurement-contracts.ts'
import type { RecoveryPort } from './recovery-contracts.ts'

export interface ControlCommandPort {
  updateSettings(change: SettingsChange): Promise<SettingsState>
  setCatalogEnabled(host: string, enabled: boolean): Promise<SettingsState>
  setOriginalComparison(enabled: boolean): void
  clearLearning(): Promise<void>
  resetSettings(): Promise<void>
}
export interface ControlSettingsPort extends Pick<
  SettingsPort,
  'update' | 'reset' | 'setCatalogEnabled'
> {}
export interface ControlRestrictionsPort extends Pick<RestrictionPort, 'clear'> {}
export interface ControlEvidencePort extends Pick<EvidencePort, 'clear'> {}
export interface ControlMetaPort extends Pick<MeasurementMetaPort, 'clear'> {}
export interface ControlRoutesPort extends Pick<
  RouteCoordinatorPort,
  'invalidateForUserSetting' | 'setOriginalComparison'
> {}
export interface ControlMeasurementPort extends Pick<MeasurementPort, 'reset'> {}
export interface ControlRecoveryPort extends Pick<RecoveryPort, 'reset'> {}
