import type { SettingsState } from '../state/settings-model.ts'

import type {
  ControlCommandPort,
  SettingsChange,
  ControlSettingsPort,
  ControlRestrictionsPort,
  ControlEvidencePort,
  ControlMetaPort,
  ControlRoutesPort,
  ControlMeasurementPort,
  ControlRecoveryPort,
} from './control-ports.ts'
export type {
  SettingsChange,
  ControlCommandPort,
  ControlSettingsPort,
  ControlRestrictionsPort,
  ControlEvidencePort,
  ControlMetaPort,
  ControlRoutesPort,
  ControlMeasurementPort,
  ControlRecoveryPort,
} from './control-ports.ts'

export class ControlCommands implements ControlCommandPort {
  constructor(
    private readonly settings: ControlSettingsPort,
    private readonly restrictions: ControlRestrictionsPort,
    private readonly evidence: ControlEvidencePort,
    private readonly meta: ControlMetaPort,
    private readonly routes: ControlRoutesPort,
    private readonly measurement: ControlMeasurementPort,
    private readonly recovery: ControlRecoveryPort,
    private readonly now: () => number,
  ) {}
  updateSettings(change: SettingsChange): Promise<SettingsState> {
    return this.settings.update(change)
  }
  setCatalogEnabled(host: string, enabled: boolean): Promise<SettingsState> {
    return this.settings.setCatalogEnabled(host, enabled)
  }
  setOriginalComparison(enabled: boolean): void {
    this.routes.setOriginalComparison(enabled)
    this.measurement.reset()
    this.recovery.reset()
  }
  requestMeasurement(): void {
    this.measurement.requestManual()
  }
  async blacklistLatestVideo(): Promise<void> {
    const host = this.routes.latestVideoHost()
    if (host)
      await this.restrictions.add({
        host,
        type: 'black',
        kind: 'all',
        reason: 'user',
        expireAt: this.now() + 24 * 60 * 60 * 1000,
      })
    this.routes.invalidateForUserSetting()
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
