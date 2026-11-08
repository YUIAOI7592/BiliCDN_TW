import {
  type SettingsChange,
  type SettingsState,
  type SettingsPort,
} from '../state/settings-contracts.ts'
import { type RestrictionPort } from '../state/restriction-contracts.ts'
import { type EvidencePort } from '../state/evidence-ports.ts'
import { type MeasurementMetaPort } from '../state/measurement-meta-ports.ts'
import { type RouteCoordinatorPort } from './routing/route-contracts.ts'
export interface ControlCommandPort {
  updateSettings(change: SettingsChange): Promise<SettingsState>
  setCatalogEnabled(host: string, enabled: boolean): Promise<SettingsState>
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
export interface ControlRoutesPort extends Pick<RouteCoordinatorPort, 'invalidateForUserSetting'> {}
