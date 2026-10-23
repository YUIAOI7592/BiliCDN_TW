import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DiagnosticRecorder } from '../../src-v2/diagnostics/recorder.ts'
import type { PlaybackDiagnosticSample } from '../../src-v2/domain/diagnostic-model.ts'
import type { BufferTrendSnapshot } from '../../src-v2/domain/buffer-trend.ts'
import { testScope } from '../support/scope.ts'
import { serializeDiagnosticReport } from '../../src-v2/diagnostics/report.ts'
import type { DiagnosticReportCapture } from '../../src-v2/diagnostics/report.ts'

function trend(at: number): BufferTrendSnapshot {
  return {
    schemaVersion: 4,
    algorithm: 'buffer-window-v4',
    cycle: null,
    at,
    from: at - 8000,
    spanMs: 8000,
    sampleCount: 9,
    interpolated: false,
    progressQuality: 'frames',
    state: 'draining',
    reason: 'draining-low',
    candidate: true,
    rate: 2,
    startBufferSec: 12,
    endBufferSec: 8,
    deltaSec: -4,
    slopeSecPerSec: -0.5,
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
function sample(at: number, bufferTrend = trend(at)): PlaybackDiagnosticSample {
  return {
    at,
    generation: 1,
    epoch: 1,
    enabled: true,
    originalComparison: false,
    currentTimeSec: 100,
    frames: 100,
    playableBufferSec: 8,
    paused: false,
    seeking: false,
    ended: false,
    readyState: 4,
    coreInitialized: true,
    watchdog: 'healthy',
    bufferTrend,
  }
}

for (const reason of [
  'candidate-confirming',
  'partial-refill',
  'not-decreasing',
  'above-prior-low',
  'candidate-repaid',
  'candidate-expired',
] as const)
  test(`buffer-v3 diagnostic ${reason} requires false and keeps private evidence out`, () => {
    const recorder = new DiagnosticRecorder(
      () => 10001,
      () => false,
    )
    const input = { ...trend(10000), reason, candidate: false }
    Object.assign(input, { confirmation: { anchorSec: 12, secret: 'private-marker' } })
    recorder.recordPlayer(sample(10000, input))
    assert.equal(recorder.snapshot().bufferTrend.latest!.reason, reason)
    assert.equal(recorder.buildReport({}).includes('private-marker'), false)
    assert.equal(recorder.buildReport({}).includes('anchorSec'), false)
    Object.assign(input, { candidate: true })
    recorder.recordPlayer(sample(10001, { ...input, at: 10001, from: 2001 }))
    assert.equal(recorder.snapshot().counters.bufferTrendRejected, 1)
  })

for (const version of [1, 2, 3])
  test(`buffer-v3 recorder rejects legacy version ${version} from live producers`, () => {
    const recorder = new DiagnosticRecorder(
      () => 10000,
      () => false,
    )
    const input = Object.assign(trend(10000), {
      schemaVersion: version,
      algorithm: `buffer-window-v${version}`,
    })
    recorder.recordPlayer(sample(10000, input))
    assert.equal(recorder.snapshot().bufferTrend.latest, null)
    assert.equal(recorder.snapshot().counters.bufferTrendRejected, 1)
  })
test('U-D01 reports a detached whitelisted shadow candidate without an incident', (t) => {
  testScope(t)
  const recorder = new DiagnosticRecorder(
    () => 10000,
    () => false,
  )
  const input = trend(10000)
  Object.assign(input, { url: 'https://secret.example/?token=private', media: { secret: true } })
  Object.assign(input.transport, { requestId: 'private-request-id' })
  recorder.recordPlayer(sample(10000, input))
  const report = recorder.buildReport({})
  assert.equal(report.includes('private'), false)
  const data = JSON.parse(report)
  assert.equal(data.recorder.bufferTrend.latest.candidate, true)
  assert.equal(data.recorder.bufferTrend.schemaVersion, 4)
  assert.equal(data.recorder.incident, null)
  Object.assign(input, { candidate: false })
  assert.equal(recorder.snapshot().bufferTrend!.latest!.candidate, true)
  const copy = recorder.snapshot().bufferTrend!
  Object.assign(copy.latest!, { candidate: false })
  assert.equal(recorder.snapshot().bufferTrend!.latest!.candidate, true)
})
for (const invalid of ['NaN', 'reason', 'future', 'candidate', 'count', 'overflow'] as const)
  test(`U-D02 rejects ${invalid} trend data`, (t) => {
    testScope(t)
    const recorder = new DiagnosticRecorder(
        () => 10000,
        () => false,
      ),
      input = trend(10000)
    Object.assign(
      input,
      invalid === 'NaN'
        ? { deltaSec: NaN }
        : invalid === 'reason'
          ? { reason: 'https://secret.example/token' }
          : invalid === 'future'
            ? { at: 10001 }
            : invalid === 'candidate'
              ? { candidate: 'true' }
              : invalid === 'count'
                ? { sampleCount: 1000 }
                : { endBufferSec: Infinity },
    )
    recorder.recordPlayer(sample(10000, input))
    assert.equal(recorder.snapshot().bufferTrend!.latest, null)
    assert.equal(recorder.snapshot().counters.bufferTrendRejected, 1)
  })
test('U-D03 history includes latest within 32 rows and 8 KiB; clear leaves no trend', (t) => {
  testScope(t)
  let now = 10000
  const recorder = new DiagnosticRecorder(
    () => now,
    () => false,
  )
  for (let i = 0; i < 100; i++) {
    now += 1000
    recorder.recordPlayer(sample(now))
  }
  const data = recorder.snapshot().bufferTrend!
  assert.ok(data.history.length <= 32)
  assert.ok(new TextEncoder().encode(JSON.stringify(data)).byteLength <= 8192)
  assert.equal(data.latest!.at, now)
  assert.ok(recorder.snapshot().counters.bufferTrendEvicted > 0)
  assert.ok(new TextEncoder().encode(JSON.stringify(recorder.snapshot())).byteLength <= 128 * 1024)
  recorder.clear()
  assert.equal(recorder.snapshot().bufferTrend!.latest, null)
  assert.deepEqual(recorder.snapshot().bufferTrend!.history, [])
})
test('U-D04 clear reentry while projecting a trend cannot resurrect old rows', (t) => {
  testScope(t)
  const recorder = new DiagnosticRecorder(
    () => 10000,
    () => false,
  )
  const input = trend(10000)
  Object.defineProperty(input, 'candidate', {
    get: () => {
      recorder.clear()
      return true
    },
  })
  recorder.recordPlayer(sample(10000, input))
  assert.equal(recorder.snapshot().bufferTrend.latest, null)
})
test('U-D05 duplicate and extra event samples do not create a trend tick', (t) => {
  testScope(t)
  const recorder = new DiagnosticRecorder(
    () => 10000,
    () => false,
  )
  recorder.recordPlayer(sample(10000))
  recorder.recordPlayer(sample(10000))
  const { bufferTrend: _trend, ...extra } = sample(10000)
  recorder.recordPlayer(extra)
  assert.equal(recorder.snapshot().bufferTrend.history.length, 1)
  assert.equal(recorder.snapshot().bufferTrend.latest!.at, 10000)
})
test('U-D06 export sheds trend history first and remains within 96 KiB', (t) => {
  testScope(t)
  const history = Array.from({ length: 32 }, (_, i) => trend(10000 + i))
  const captured = {
    coverage: { from: 10000, to: 10000 },
    manualMark: null,
    incident: null,
    flow: [],
    events: [],
    rankings: [],
    pending: [],
    lastSuccess: {},
    routeRecovery: { attempts: [] },
    counters: {
      evicted: 0,
      incidentReplaced: 0,
      rankingEvicted: 0,
      flowEvicted: 0,
      incidentEvicted: 0,
      pendingEvicted: 0,
      eventsExpired: 0,
      flowsExpired: 0,
      traceEvicted: 0,
      attemptEvicted: 0,
      bufferTrendEvicted: 0,
      bufferTrendRejected: 0,
    },
    bufferTrend: {
      schemaVersion: 4,
      algorithm: 'buffer-window-v4',
      history,
      latest: history.at(-1)!,
    },
  } satisfies DiagnosticReportCapture
  const output = serializeDiagnosticReport({
    generatedAt: '2026-10-23',
    evidence: 'synthetic',
    recorder: captured,
    current: { current: 'x'.repeat(88000), reduced: () => null, emergency: () => null },
  })
  const report = JSON.parse(output)
  assert.ok(new TextEncoder().encode(output).byteLength <= 96 * 1024)
  assert.ok(report.export.bufferTrendDropped > 0)
  assert.equal(report.export.contextDropped, 0)
  assert.equal(report.export.currentReduced, false)
})
test('U-D07 recorder is the only report authority for buffer trends', (t) => {
  testScope(t)
  const recorder = new DiagnosticRecorder(
    () => 10000,
    () => false,
  )
  const input = Object.assign(trend(10000), { secretUrl: 'https://secret.example/private' })
  recorder.recordPlayer(sample(10000))
  const report = recorder.buildReport({ monitor: { bufferTrend: input } })
  assert.equal(report.includes('secret'), false)
  assert.equal(JSON.parse(report).current.monitor.bufferTrend, undefined)
  assert.equal(JSON.parse(report).recorder.bufferTrend.latest.candidate, true)
})

for (const rate of [1, 2] as const)
  test(`U-D08 bounded recorder retains exact order and detached aliases rate=${rate}`, (t) => {
    testScope(t)
    let now = 10000
    const recorder = new DiagnosticRecorder(
      () => now,
      () => false,
    )
    for (let i = 0; i < 100; i++) {
      now += 1000
      const input = { ...trend(now), rate }
      recorder.recordPlayer(sample(now, input))
      const before = recorder.snapshot()
      const history = before.bufferTrend.history
      assert.ok(Buffer.byteLength(JSON.stringify(before.bufferTrend)) <= 8192)
      assert.ok(Buffer.byteLength(JSON.stringify(before)) <= 128 * 1024)
      assert.equal(before.counters.bufferTrendEvicted, i + 1 - history.length)
      assert.equal(before.bufferTrend.latest, history.at(-1))
      assert.deepEqual(
        history.map((r) => r.at),
        Array.from({ length: history.length }, (_, n) => now - (history.length - n - 1) * 1000),
      )
      const report = recorder.buildReport({ title: '中文與😀多位元組' })
      assert.ok(Buffer.byteLength(report) <= 96 * 1024)
      assert.deepEqual(recorder.snapshot(), before)
      Object.assign(history.at(-1)!.transport, { dropped: 12 })
      assert.equal(recorder.snapshot().bufferTrend.latest!.transport.dropped, 0)
    }
    recorder.clear()
    assert.equal(recorder.snapshot().bufferTrend.latest, null)
    now += 1000
    recorder.recordPlayer(sample(now, { ...trend(now), rate }))
    assert.equal(recorder.snapshot().bufferTrend.history.length, 1)
  })

test('U-D09 UTF-8 export and snapshots keep the same truncation and diagnostic state', (t) => {
  testScope(t)
  let now = 10000
  const recorder = new DiagnosticRecorder(
    () => now,
    () => false,
  )
  recorder.mark('中文與😀診斷')
  for (let i = 0; i < 60; i++) {
    now += 1000
    recorder.recordPlayer({ ...sample(now), watchdog: '中文😀'.repeat(10) })
  }
  const before = recorder.snapshot()
  const a = recorder.buildReport({ note: '中文😀'.repeat(15000) })
  const b = recorder.buildReport({ note: '中文😀'.repeat(15000) })
  assert.equal(a, b)
  assert.ok(Buffer.byteLength(a) <= 96 * 1024)
  assert.deepEqual(recorder.snapshot(), before)
  const output = JSON.parse(a)
  assert.ok(output.export.bufferTrendDropped >= 0)
  assert.equal(
    output.recorder.bufferTrend.latest?.at ?? null,
    output.recorder.bufferTrend.history.at(-1)?.at ?? null,
  )
})

for (const rate of [1, 2])
  test(`buffer-v4 U-D cycle-only evidence is detached, bounded and whitelisted rate=${rate}`, () => {
    const recorder = new DiagnosticRecorder(
      () => 10000,
      () => false,
    )
    const input = {
      ...trend(10000),
      rate,
      state: 'stable' as const,
      reason: 'cycle-draining-low' as const,
      startBufferSec: 9,
      endBufferSec: 8,
      deltaSec: -1,
      slopeSecPerSec: -0.125,
      cycle: { netLossSec: 2, creditMs: 2000, lastLossAgeMs: 1000, rangeTroughSec: null },
    }
    Object.assign(input.cycle, { token: 'private-cycle-token', url: 'https://sensitive.invalid/' })
    recorder.recordPlayer(sample(10000, input))
    const copy = recorder.snapshot().bufferTrend.latest!
    assert.equal(copy.candidate, true)
    assert.deepEqual(copy.cycle, {
      netLossSec: 2,
      creditMs: 2000,
      lastLossAgeMs: 1000,
      rangeTroughSec: null,
    })
    assert.equal(recorder.buildReport({}).includes('private-cycle-token'), false)
    assert.equal(recorder.buildReport({}).includes('sensitive.invalid'), false)
    Object.assign(copy.cycle!, { creditMs: 0 })
    assert.equal(recorder.snapshot().bufferTrend.latest!.cycle!.creditMs, 2000)
  })

for (const fault of [
  'debt',
  'credit',
  'missing-age',
  'expired-age',
  'high-buffer',
  'wrong-verdict',
  'throwing-field',
] as const)
  test(`buffer-v4 U-D rejects invalid cycle proof ${fault}`, () => {
    const recorder = new DiagnosticRecorder(
      () => 10000,
      () => false,
    )
    const input = {
      ...trend(10000),
      state: 'stable' as const,
      reason: 'cycle-draining-low' as const,
      startBufferSec: 9,
      endBufferSec: 8,
      deltaSec: -1,
      slopeSecPerSec: -0.125,
      cycle: {
        netLossSec: 2,
        creditMs: 2000,
        lastLossAgeMs: 1000 as number | null,
        rangeTroughSec: null,
      },
    }
    if (fault === 'debt') input.cycle.netLossSec = 1.999999
    if (fault === 'credit') input.cycle.creditMs = 1999
    if (fault === 'missing-age') input.cycle.lastLossAgeMs = null
    if (fault === 'expired-age') input.cycle.lastLossAgeMs = 8001
    if (fault === 'high-buffer') input.endBufferSec = 10.000001
    if (fault === 'wrong-verdict') input.candidate = false
    if (fault === 'throwing-field')
      Object.defineProperty(input.cycle, 'creditMs', {
        get() {
          throw Error('private getter')
        },
      })
    recorder.recordPlayer(sample(10000, input))
    assert.equal(recorder.snapshot().bufferTrend.latest, null)
    assert.equal(recorder.snapshot().counters.bufferTrendRejected, 1)
  })
