import type { SettingsState, SettingsStore } from '../state/settings-store.ts'
import type { RestrictionStore } from '../state/restriction-store.ts'
import type { EvidenceStore } from '../state/evidence-store.ts'
import type { MeasurementMetaStore } from '../state/measurement-meta-store.ts'
import type { RouteCoordinator } from './route-coordinator.ts'
import type { MeasurementController } from './measurement-controller.ts'
import type { RecoveryController } from './recovery-controller.ts'

export type SettingsChange = Partial<Omit<SettingsState, 'schema' | 'updatedAt'>>
export interface ControlCommandPort {
  updateSettings(change: SettingsChange): Promise<SettingsState>
  setOriginalComparison(enabled: boolean): void
  requestMeasurement(): void
  blacklistLatestVideo(): Promise<void>
  clearLearning(): Promise<void>
  resetSettings(): Promise<void>
}
export class ControlCommands implements ControlCommandPort {
  constructor(private readonly settings: Pick<SettingsStore, 'update' | 'reset'>,
    private readonly restrictions: Pick<RestrictionStore, 'add' | 'clear'>,
    private readonly evidence: Pick<EvidenceStore, 'clear'>,
    private readonly meta: Pick<MeasurementMetaStore, 'clear'>,
    private readonly routes: Pick<RouteCoordinator, 'latestVideoHost' | 'invalidateForUserSetting' | 'setOriginalComparison'>,
    private readonly measurement: Pick<MeasurementController, 'requestManual' | 'reset'>,
    private readonly recovery: Pick<RecoveryController, 'reset'>,
    private readonly now: () => number) {}
  updateSettings(change: SettingsChange): Promise<SettingsState> { return this.settings.update(change) }
  setOriginalComparison(enabled: boolean): void {
    this.routes.setOriginalComparison(enabled); this.measurement.reset(); this.recovery.reset()
  }
  requestMeasurement(): void { this.measurement.requestManual() }
  async blacklistLatestVideo(): Promise<void> {
    const host = this.routes.latestVideoHost()
    if (host) await this.restrictions.add({ host, type: 'black', kind: 'all', reason: 'user', expireAt: this.now() + 24 * 60 * 60 * 1000 })
    this.routes.invalidateForUserSetting()
  }
  async clearLearning(): Promise<void> {
    await this.evidence.clear(); await this.restrictions.clear(); this.meta.clear()
  }
  async resetSettings(): Promise<void> { await this.settings.reset(); this.routes.invalidateForUserSetting() }
}
