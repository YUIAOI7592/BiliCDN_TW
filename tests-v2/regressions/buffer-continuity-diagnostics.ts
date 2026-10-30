import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeBufferTrend } from '../../src-v2/diagnostics/buffer-trend.ts'
import { DiagnosticRecorder } from '../../src-v2/diagnostics/recorder.ts'
import type { BufferTrendSnapshot } from '../../src-v2/domain/buffer-trend.ts'
import { testScope } from '../support/scope.ts'

function trend(used = false): BufferTrendSnapshot {
  return {
    schemaVersion: 6,
    algorithm: 'buffer-window-v6',
    at: 20000,
    from: 12000,
    spanMs: 8000,
    sampleCount: 9,
    interpolated: false,
    progressQuality: 'frames',
    state: 'stable',
    candidate: !used,
    reason: used ? 'low-buffer-tail-used' : 'low-buffer-tail',
    rate: 1,
    startBufferSec: 1,
    endBufferSec: 0.5,
    deltaSec: -0.5,
    slopeSecPerSec: -0.0625,
    lowBuffer: { basis: 'partial-cycle', creditMs: 2000, declineCoverageMs: 2000, tailUsed: true },
    cycle: { netLossSec: 0.5, creditMs: null, lastLossAgeMs: 1000, rangeTroughSec: 0.1 },
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
}
for (const used of [false, true]) {
  test(`buffer-v6 U-D reason and isolated whitelist used=${used}`, () => {
    const input = trend(used)
    Object.assign(input.lowBuffer!, {
      token: 'secret-token',
      core: {},
      url: 'https://secret.invalid',
    })
    const result = sanitizeBufferTrend(input)!
    assert.ok(result)
    assert.notEqual(result.lowBuffer, input.lowBuffer)
    assert.equal(result.candidate, !used)
    assert.equal(JSON.stringify(result).includes('secret'), false)
    Object.assign(input.lowBuffer!, { tailUsed: false })
    assert.equal(result.lowBuffer!.tailUsed, true)
  })
  for (const fault of [
    'missing',
    'unspent',
    'flag-type',
    'credit',
    'coverage',
    'zero',
    'high',
    'basis',
    'debt',
    'expired',
    'candidate',
    'version',
    'algorithm',
  ] as const)
    test(`buffer-v6 U-D rejects ${fault} used=${used}`, () => {
      const input = trend(used)
      if (fault === 'missing') Object.assign(input, { lowBuffer: null })
      if (fault === 'unspent') Object.assign(input.lowBuffer!, { tailUsed: false })
      if (fault === 'flag-type') Object.assign(input.lowBuffer!, { tailUsed: 'true' })
      if (fault === 'credit') Object.assign(input.lowBuffer!, { creditMs: 1999 })
      if (fault === 'coverage') Object.assign(input.lowBuffer!, { declineCoverageMs: 1999 })
      if (fault === 'zero' || fault === 'high')
        Object.assign(input, { endBufferSec: fault === 'zero' ? 0 : 1.000001 })
      if (fault === 'basis')
        Object.assign(input.lowBuffer!, { basis: 'steady-decline', declineCoverageMs: 8000 })
      if (fault === 'debt') Object.assign(input.cycle!, { netLossSec: 0 })
      if (fault === 'expired') Object.assign(input.cycle!, { lastLossAgeMs: 8001 })
      if (fault === 'candidate') Object.assign(input, { candidate: used })
      if (fault === 'version') Object.assign(input, { schemaVersion: 5 })
      if (fault === 'algorithm') Object.assign(input, { algorithm: 'buffer-window-v5' })
      assert.equal(sanitizeBufferTrend(input), null)
    })
}
test('buffer-v6 U-D Recorder caps and clears projections without producer mutation', (t) => {
  testScope(t)
  let now = 20000
  const recorder = new DiagnosticRecorder(() => now),
    source = trend()
  for (let i = 0; i < 200; i++) {
    now += 1000
    recorder.recordPlayer({
      at: now,
      generation: 1,
      epoch: 1,
      enabled: true,
      originalComparison: false,
      currentTimeSec: i,
      frames: i * 30,
      playableBufferSec: 0.5,
      paused: false,
      seeking: false,
      ended: false,
      readyState: 4,
      coreInitialized: true,
      watchdog: 'healthy',
      bufferTrend: { ...source, at: now, from: now - 8000 },
    })
  }
  const snapshot = recorder.snapshot()
  assert.ok(snapshot.bufferTrend.history.length <= 32)
  assert.ok(Buffer.byteLength(JSON.stringify(snapshot.bufferTrend.history)) <= 8192)
  assert.ok(Buffer.byteLength(recorder.buildReport({})) <= 98304)
  assert.ok(snapshot.counters.bufferTrendEvicted > 0)
  recorder.clear()
  assert.equal(recorder.snapshot().bufferTrend.latest, null)
  assert.equal(source.lowBuffer!.tailUsed, true)
})
