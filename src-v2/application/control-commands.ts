import type { SettingsState } from '../state/settings-contracts.ts'
import type { EarlyRetryPort } from './early-retry-contracts.ts'

import type {
  ControlCommandPort,
  ControlSettingsPort,
  ControlRestrictionsPort,
  ControlEvidencePort,
  ControlMetaPort,
  ControlRoutesPort,
  ControlMeasurementPort,
  ControlRecoveryPort,
} from './control-ports.ts'
import type { SettingsChange } from '../state/settings-contracts.ts'
export class ControlCommands implements ControlCommandPort {
  constructor(
    private readonly settings: ControlSettingsPort,
    private readonly restrictions: ControlRestrictionsPort,
    private readonly evidence: ControlEvidencePort,
    private readonly meta: ControlMetaPort,
    private readonly routes: ControlRoutesPort,
    private readonly measurement: ControlMeasurementPort,
    private readonly recovery: ControlRecoveryPort,
    private readonly earlyRetry?: EarlyRetryPort,
  ) {}
  updateSettings(change: SettingsChange): Promise<SettingsState> {
    return this.settings.update(change)
  }
  setCatalogEnabled(host: string, enabled: boolean): Promise<SettingsState> {
    return this.settings.setCatalogEnabled(host, enabled)
  }
  setOriginalComparison(enabled: boolean): void {
    this.earlyRetry?.cancel('comparison-setting')
    this.routes.setOriginalComparison(enabled)
    this.measurement.reset()
    this.recovery.reset()
  }
  async clearLearning(): Promise<void> {
    await this.evidence.clear()
    await this.restrictions.clear()
    this.meta.clear()
  }
  async resetSettings(): Promise<void> {
    await this.settings.reset()
    this.routes.invalidateForUserSetting()
  }
}
