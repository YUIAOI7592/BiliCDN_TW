import { evidenceMetrics, emptyEvidence, addEvidenceSample } from '../../src-v2/domain/evidence.ts'
import type { MeasurementRoutes } from '../../src-v2/application/measurement-contracts.ts'
import type { PlayerMonitor } from '../../src-v2/application/player-monitor.ts'
import type { MonitorRoutes } from '../../src-v2/application/monitor-contracts.ts'
export const measurementRoutes = (overrides: Partial<MeasurementRoutes> = {}): MeasurementRoutes =>
  ({
    isCatalogOnly: () => false,
    startupOptions: () => null,
    startupCapacity: (candidate, sample) =>
      sample
        ? evidenceMetrics(
            addEvidenceSample(
              emptyEvidence(candidate.host, candidate.context.kind),
              sample,
              sample.at,
            ),
            sample.at,
          )
        : {
            ...evidenceMetrics(null, 0),
            safeThroughputMbps: candidate.cachedSafeMbps,
            capacityConfidence: 'sufficient',
            freshSpeedCount: 2,
          },
    completionBudget: () => null,
    startupFallback: () => null,
    noteStartupProbeResult: () => undefined,
    commitStartupChoice: () => null,
    recordStartupSuccess: async () => undefined,
    challenge: () => null,
    recordChallenge: async () => undefined,
    ...overrides,
  }) satisfies MeasurementRoutes
export const monitorRoutes = (overrides: Partial<MonitorRoutes> = {}): MonitorRoutes =>
  ({
    observePlaybackRate: () => undefined,
    firstMediaAt: () => 0,
    latestRequested: () => null,
    recover: () => undefined,
    recoverStartup: () => null,
    recoveryEligible: () => false,
    ...overrides,
  }) satisfies MonitorRoutes
type MonitorMeasurement = ConstructorParameters<typeof PlayerMonitor>[5]
type MonitorRecovery = ConstructorParameters<typeof PlayerMonitor>[6]
export const monitorMeasurement = (
  overrides: Partial<MonitorMeasurement> = {},
): MonitorMeasurement =>
  ({
    tick: () => undefined,
    cancel: () => undefined,
    startupFallbackHosts: () => [],
    ...overrides,
  }) satisfies MonitorMeasurement
export const monitorRecovery = (overrides: Partial<MonitorRecovery> = {}): MonitorRecovery =>
  ({
    tick: () => undefined,
    isRecovering: () => false,
    armStartupFailure: () => undefined,
    armStall: () => undefined,
    cancelStall: () => undefined,
    ongoingStallReload: () => false,
    rejectStall: () => undefined,
    snapshot: () => ({
      state: 'healthy',
      source: null,
      pauseSec: 0,
      reloadCount: 0,
      breakerSec: 0,
    }),
    ...overrides,
  }) satisfies MonitorRecovery
