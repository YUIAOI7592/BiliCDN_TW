import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture as fullRuntime, media } from '../support/runtime-fixture.ts'
import { FakeStorage } from '../support/storage.ts'
import { continuityCases } from '../../scripts/evaluation/buffer-shadow/continuity-inputs.mts'

for (const rate of [1, 2])
  for (const mode of ['steady', 'tail'] as const) {
    test(`buffer-${mode === 'tail' ? 'v6' : 'v5'} I-R ${mode} candidate with real Routes Recovery Runtime Recorder rate=${rate}`, async (t) => {
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
        bufferAheadSec: (mode === 'tail' ? 1 : 4.8) * rate,
        playableBufferSec: mode === 'tail' ? 1 : 4.8,
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
      for (let i = 1; i <= 60; i++) {
        f.setVideo({ ...f.video(), currentTime: 120 + i * rate, frames: i * 30 })
        f.clock.advance(1000)
      }
      const before = {
        writes: storage.writes,
        calls: structuredClone(f.calls),
        affinity: f.routes.snapshot().affinity,
        plans: f.routes.snapshot().planCount,
      }
      const buffers =
        mode === 'tail'
          ? continuityCases
              .find((c) => c.id === 'tail-normal-microdecline')!
              .profile.samples.slice(0, 18)
              .map((s) => s.buffer)
          : Array.from({ length: 10 }, (_, i) => 4.8 - (i + 1) / 10)
      for (const [index, buffer] of buffers.entries()) {
        const i = index + 1
        f.setVideo({
          ...f.video(),
          currentTime: 120 + (60 + i) * rate,
          frames: (60 + i) * 30,
          bufferAheadSec: buffer * rate,
          playableBufferSec: buffer,
        })
        f.clock.advance(1000)
      }
      assert.equal(f.diagnostics.snapshot().bufferTrend.latest!.candidate, true)
      assert.equal(
        f.diagnostics.snapshot().bufferTrend.latest!.reason,
        mode === 'tail' ? 'low-buffer-tail' : 'low-buffer-steady',
      )
      assert.equal(f.diagnostics.snapshot().bufferTrend.latest!.transport.completedBytes, 0)
      assert.equal(storage.writes, before.writes)
      assert.deepEqual(f.calls, before.calls)
      assert.deepEqual(f.routes.snapshot().affinity, before.affinity)
      assert.equal(f.routes.snapshot().planCount, before.plans)
      assert.deepEqual(events, ['transport-completed', 'route-confirmed'])
      assert.equal(f.routes.latestRequested('video')!.decisionId, request.decisionId)
      if (mode === 'tail') {
        f.diagnostics.clear()
        f.setVideo({
          ...f.video(),
          currentTime: f.video().currentTime + rate,
          frames: f.video().frames! + 30,
          bufferAheadSec: 0.52 * rate,
          playableBufferSec: 0.52,
        })
        f.clock.advance(1000)
        assert.equal(f.diagnostics.snapshot().bufferTrend.latest!.candidate, false)
        assert.equal(f.diagnostics.snapshot().bufferTrend.latest!.lowBuffer!.tailUsed, true)
        assert.deepEqual(f.calls, before.calls)
        assert.equal(storage.writes, before.writes)
      }
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
  }
