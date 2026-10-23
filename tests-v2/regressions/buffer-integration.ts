import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RuntimeController } from '../../src-v2/application/runtime-controller.ts'
import { DiagnosticRecorder } from '../../src-v2/diagnostics/recorder.ts'
import { defaultSettings } from '../../src-v2/state/settings-store.ts'
import { bufferMonitor } from '../support/buffer-monitor.ts'
import { fixture as fullRuntime, media } from '../support/runtime-fixture.ts'
import { FakeStorage } from '../support/storage.ts'

for (const rate of [1, 2]) {
  test(`I-N03 real route evidence stays separate from shadow observations rate=${rate}`, async (t) => {
    class CountingStorage extends FakeStorage {
      writes = 0
      override set<T>(key: string, value: T): void {
        this.writes++
        super.set(key, value)
      }
    }
    const storage = new CountingStorage(),
      f = fullRuntime(t, storage),
      input = media(501)
    assert.equal(f.playurl.transform(input, 'trusted-api').accepted, true)
    f.setVideo({
      ...f.video(),
      readyState: 4,
      width: 1920,
      height: 1080,
      coreInitialized: true,
      playbackRate: rate,
      effectiveRate: rate,
      bufferAheadSec: 12 * rate,
      playableBufferSec: 12,
    })
    f.request(input.data.dash.video[0]!.base_url)
    f.deps.monitor.tick()
    const request = f.routes.latestRequested('video')!
    assert.equal(f.routes.recoveryEligible(request), true)
    const events: string[] = []
    f.scope.defer(
      f.routes.subscribe((event) => {
        events.push(event.type)
      }),
    )
    await f.routes.observe({
      request,
      generation: request.generation,
      epoch: request.epoch,
      decisionId: request.decisionId,
      representation: request.representation,
      kind: 'video',
      routeType: request.routeType,
      originalHost: request.originalHost,
      targetHost: request.targetHost,
      finalHost: request.targetHost,
      responseUrlMatchesRequest: true,
      streamKey: null,
      status: 206,
      bytes: 100000,
      ttfbMs: 10,
      elapsedMs: 100,
      completedAt: f.clock.now(),
      outcome: 'success',
    })
    const before = {
      writes: storage.writes,
      calls: structuredClone(f.calls),
      affinity: f.routes.snapshot().affinity,
      plans: f.routes.snapshot().planCount,
    }
    for (let i = 1; i <= 8; i++) {
      f.setVideo({
        ...f.video(),
        currentTime: 120 + i * rate,
        frames: i * 30,
        bufferAheadSec: (12 - i / 2) * rate,
        playableBufferSec: 12 - i / 2,
      })
      f.clock.advance(1000)
    }
    assert.equal(f.diagnostics.snapshot().bufferTrend.latest!.candidate, false)
    assert.equal(f.diagnostics.snapshot().bufferTrend.latest!.reason, 'candidate-confirming')
    assert.equal(f.diagnostics.snapshot().bufferTrend.latest!.transport.completedBytes, 100000)
    assert.equal(storage.writes, before.writes)
    assert.deepEqual(f.calls, before.calls)
    assert.deepEqual(f.routes.snapshot().affinity, before.affinity)
    assert.equal(f.routes.snapshot().planCount, before.plans)
    assert.deepEqual(events, ['transport-completed', 'route-confirmed'])
    assert.equal(f.routes.latestRequested('video')!.decisionId, request.decisionId)
    f.lifecycle.dispose()
    f.runtime.dispose()
    f.deps.monitor.dispose()
    f.recovery.dispose()
    f.settings.dispose()
    f.deps.restrictions.dispose()
    f.deps.evidence.dispose()
    assert.equal(f.clock.pendingCount, 0)
    assert.equal(
      [...storage.listeners.values()].reduce((sum, rows) => sum + rows.size, 0),
      0,
    )
  })
  for (const scenario of [
    'normal',
    'jitter-2s',
    'pause-5s',
    'burst-refill',
    'drain-refill',
    'drain-no-completions',
  ] as const)
    test(`I-N02 ${scenario} real Monitor Runtime Recorder rate=${rate}`, (t) => {
      const f = bufferMonitor(t, rate),
        recorder = new DiagnosticRecorder(f.clock.now, () => false)
      let subscriptions = 0
      const subscribe = () => {
        subscriptions++
        return () => {
          subscriptions--
        }
      }
      const runtime = new RuntimeController(
        f.session,
        { get: () => defaultSettings(f.clock.now()), subscribe },
        { ...f.routes, latestRequested: f.request, subscribe, invalidateForUserSetting() {} },
        { ...f.player, reset() {} },
        f.monitor,
        { reset() {} },
        { subscribe, reset() {}, armRouteFailure() {} },
        { setEnabled() {} },
        recorder,
        f.clock.now,
        { subscribeEpoch: subscribe },
      )
      runtime.install()
      f.scope.defer(() => {
        runtime.dispose()
        assert.equal(subscriptions, 0)
      })
      f.monitor.tick()
      for (let i = 0; i < 60; i++) f.step(12)
      const start = f.clock.now(),
        rows = []
      for (let i = 1; i <= 20; i++) {
        const buffer =
          scenario === 'jitter-2s'
            ? i <= 2
              ? 12 - i
              : 12
            : scenario === 'burst-refill'
              ? 12 - (i % 4)
              : scenario === 'drain-refill'
                ? i <= 8
                  ? 12 - i / 2
                  : Math.min(14, 8 + (i - 8) / 2)
                : scenario === 'drain-no-completions'
                  ? Math.max(2, 12 - i / 2)
                  : 12
        f.step(buffer, 1000, scenario !== 'pause-5s' || i > 5)
        const current = f.monitor.snapshot().bufferTrend!
        rows.push({ elapsedMs: f.clock.now() - start, ...current })
        const report = JSON.parse(recorder.buildReport({}))
        assert.equal(report.recorder.bufferTrend.latest.candidate, current.candidate)
        assert.equal(report.recorder.incident, null)
        assert.deepEqual(f.effects, [])
      }
      const candidates = rows.filter((row) => row.candidate).map((row) => row.elapsedMs)
      if (scenario === 'drain-no-completions') assert.equal(candidates[0], 6000)
      else if (scenario === 'drain-refill') {
        assert.equal(candidates[0], 6000)
        assert.equal(rows[15]!.state, 'filling')
      } else assert.deepEqual(candidates, [])
      const before = { ...f.reads }
      recorder.clear()
      recorder.buildReport({})
      recorder.snapshot()
      assert.deepEqual(f.reads, before)
      assert.equal(recorder.snapshot().bufferTrend.latest, null)
      assert.equal(f.monitor.snapshot().bufferTrend!.at, f.clock.now())
      assert.equal(f.clock.pendingCount, 0)
      runtime.dispose()
      f.monitor.dispose()
      assert.equal(subscriptions, 0)
      assert.equal(f.clock.pendingCount, 0)
      t.diagnostic(
        'BUFFER_EVIDENCE ' +
          JSON.stringify({
            scenario,
            rate,
            rows,
            effects: f.effects,
            cleanup: { timers: f.clock.pendingCount, subscriptions },
          }),
      )
    })
}
