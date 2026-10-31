import type { DiagnosticRecorderPort } from '../../src-v2/diagnostics/contracts.ts'
import type { BufferTrendSnapshot } from '../../src-v2/domain/buffer-trend.ts'
import type { Workload } from '../../scripts/evaluation/diagnostics-cost/model.mts'
export function exercise(
  recorder: DiagnosticRecorderPort,
  workload: Workload,
  at: number,
  i: number,
  rate: 1 | 2,
) {
  if (i === 0 || i === 300) recorder.mark('中文😀\\\"\n事故')
  const bufferTrend: BufferTrendSnapshot = {
    schemaVersion: 6,
    algorithm: 'buffer-window-v6',
    cycle: null,
    lowBuffer: null,
    at,
    from: at - 8000,
    spanMs: 8000,
    sampleCount: 9,
    interpolated: false,
    progressQuality: 'frames',
    state: 'stable',
    reason: 'not-decreasing',
    candidate: false,
    rate,
    startBufferSec: 30,
    endBufferSec: 30,
    deltaSec: 0,
    slopeSecPerSec: 0,
    transport: {
      coverage: 'none-observed',
      successes: 0,
      failures: 0,
      aborts: 0,
      completedBytes: 0,
      crossWindow: 0,
      dropped: 0,
    },
  }
  recorder.recordPlayer({
    at,
    generation: 1,
    epoch: 1,
    enabled: true,
    originalComparison: false,
    currentTimeSec: 100 + i * rate,
    frames: 100 + i * 30,
    playableBufferSec: 30,
    paused: i % 3 === 0,
    seeking: false,
    ended: false,
    readyState: 4,
    coreInitialized: true,
    watchdog: '中文😀\\\"\n'.repeat(8),
    bufferTrend,
  })
  if (workload === 'capacity') {
    for (let j = 0; j < 8; j++)
      recorder.record({
        type: 'core',
        at,
        state: 'waiting',
        actionId: null,
        reason: '中文😀\\\"\n'.repeat(80),
      })
  }
  if (workload === 'export' && i % 30 === 0)
    recorder.record({
      type: 'core',
      at,
      state: 'waiting',
      actionId: null,
      reason: '中文😀\\\"\n'.repeat(8000),
    })
  if (i === 299) recorder.clear()
  const before = recorder.snapshot()
  const report = recorder.buildReport(
    workload === 'export'
      ? {
          version: 'fixed-input',
          monitor: { watchdog: 'healthy' },
          padding: '中文😀\\\"\n'.repeat(8000),
        }
      : { version: 'fixed-input' },
  )
  return { before, report, after: recorder.snapshot() }
}
