import type { MonitorSnapshot } from '../application/monitor-model.ts'
import type { RecoverySnapshot } from '../application/recovery-model.ts'
import type { MeasurementSnapshot } from '../application/measurement-model.ts'
import type { RouteSnapshot } from '../application/route-model.ts'
import type { TransportSnapshot } from '../domain/transport-model.ts'
import type { evidenceMetrics } from '../domain/evidence.ts'
import type { SettingsState } from '../state/settings-model.ts'
import type { SessionSnapshot } from '../state/session-model.ts'
import type { RestrictionRecord } from '../state/restriction-model.ts'

export interface ControlCenterSnapshot {
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
