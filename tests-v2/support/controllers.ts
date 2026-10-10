import type { MeasurementRoutes } from '../../src-v2/application/measurement-controller.ts'
import type { MonitorRoutes, PlayerMonitor } from '../../src-v2/application/player-monitor.ts'

export const measurementRoutes = (overrides: Partial<MeasurementRoutes> = {}): MeasurementRoutes => ({
  isCatalogOnly: () => false, startupOptions: () => null, noteStartupProbeResult: () => undefined,
  commitStartupChoice: () => null, recordStartupSuccess: async () => undefined,
  challenge: () => null, recordChallenge: async () => undefined, ...overrides,
} satisfies MeasurementRoutes)
export const monitorRoutes = (overrides: Partial<MonitorRoutes> = {}): MonitorRoutes => ({
  observePlaybackRate: () => undefined, isOriginalComparison: () => false, firstMediaAt: () => 0,
  latestRequested: () => null, recover: () => undefined, recoverStartup: () => null,
  recoveryEligible: () => false, ...overrides,
} satisfies MonitorRoutes)
type MonitorMeasurement = ConstructorParameters<typeof PlayerMonitor>[5]
type MonitorRecovery = ConstructorParameters<typeof PlayerMonitor>[6]
export const monitorMeasurement = (overrides: Partial<MonitorMeasurement> = {}): MonitorMeasurement => ({
  tick: () => undefined, cancel: () => undefined, startupFallbackHosts: () => [], ...overrides,
} satisfies MonitorMeasurement)
export const monitorRecovery = (overrides: Partial<MonitorRecovery> = {}): MonitorRecovery => ({
  tick: () => undefined, isRecovering: () => false, armStartupFailure: () => undefined,
  armStall: () => undefined, cancelStall: () => undefined,
  rejectStall: () => undefined,
  snapshot: () => ({ state: 'healthy', source: null, pauseSec: 0, reloadCount: 0, breakerSec: 0 }), ...overrides,
} satisfies MonitorRecovery)
