import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bufferMonitor } from '../support/buffer-monitor.ts'
import { requestId, representationId, epochId } from '../../src-v2/domain/model.ts'
import type { DomainEvent } from '../../src-v2/domain/model.ts'
import type { PlaybackDiagnosticSample } from '../../src-v2/domain/diagnostic-model.ts'
import { RuntimeController } from '../../src-v2/application/runtime-controller.ts'
import { defaultSettings } from '../../src-v2/state/settings-store.ts'

for (const rate of [1, 2])
  test(`U-N00 baseline buffer decline preserves calls and media reads rate=${rate}`, (t) => {
    const f = bufferMonitor(t, rate)
    f.monitor.tick()
    for (let i = 1; i <= 8; i++) f.step(12 - i / 2)
    assert.deepEqual(f.effects, [])
    assert.deepEqual(f.reads, { media: 10, controls: 9, measurement: 9 })
    assert.equal(f.monitor.snapshot().stableProgressSec, 8)
    assert.equal(f.clock.pendingCount, 0)
  })

for (const rate of [1, 2]) {
  test(`I-N01 Runtime forwards only attributed current video completions rate=${rate}`, (t) => {
    const f = bufferMonitor(t, rate),
      samples: PlaybackDiagnosticSample[] = []
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
      { ...f.routes, subscribe, latestRequested: f.request, invalidateForUserSetting() {} },
      { ...f.player, reset() {} },
      f.monitor,
      { reset() {} },
      { subscribe, reset() {}, armRouteFailure() {} },
      { setEnabled() {} },
      {
        record() {},
        recordPlayer: (s) => {
          samples.push(s)
        },
      },
      f.clock.now,
      { subscribeEpoch: subscribe },
    )
    runtime.install()
    f.scope.defer(() => {
      runtime.dispose()
      assert.equal(subscriptions, 0)
    })
    f.monitor.tick()
    for (const kind of ['audio', 'video'] as const) {
      const request = { ...f.request(), kind, requestId: requestId(kind) }
      const event: DomainEvent = {
        type: 'transport-completed',
        at: f.clock.now(),
        detached: false,
        observation: {
          ...request,
          request,
          kind,
          decisionId: request.decisionId,
          finalHost: request.targetHost,
          streamKey: null,
          status: 206,
          bytes: 100,
          ttfbMs: 1,
          elapsedMs: 10,
          completedAt: f.clock.now(),
          outcome: 'success',
        },
      }
      runtime.record(event)
      runtime.record({ ...event, detached: true })
      runtime.record({
        ...event,
        observation: {
          ...event.observation,
          request: { ...request, attributionStatus: 'weak', requestId: requestId('weak-' + kind) },
        },
      })
    }
    for (let i = 1; i <= 8; i++) f.step(12 - i / 2)
    assert.equal(samples.at(-1)!.bufferTrend!.candidate, true)
    assert.equal(samples.at(-1)!.bufferTrend!.transport.completedBytes, 100)
    assert.equal(samples.at(-1)!.bufferTrend!.transport.successes, 1)
    assert.deepEqual(f.effects, [])
    runtime.dispose()
    const count = samples.length
    f.step(7.5)
    assert.equal(samples.length, count)
  })
  test(`U-T02 completion deduplication outcomes and bounded coverage rate=${rate}`, (t) => {
    const f = bufferMonitor(t, rate)
    f.monitor.tick()
    const observation = {
      request: f.request(),
      startedAt: f.clock.now() - 9000,
      completedAt: f.clock.now(),
      bytes: 100,
      status: 206,
      outcome: 'success' as const,
    }
    f.monitor.observeTransport(observation)
    f.monitor.observeTransport(observation)
    for (let i = 1; i < 130; i++)
      f.monitor.observeTransport({
        ...observation,
        request: { ...f.request(), requestId: requestId('completion-' + i) },
        outcome: i === 1 ? 'abort' : i === 2 ? 'failure' : 'success',
      })
    f.step(11.5)
    const data = f.monitor.snapshot().bufferTrend!.transport
    assert.deepEqual([data.successes, data.failures, data.aborts], [126, 1, 1])
    assert.equal(data.completedBytes, 12600)
    assert.equal(data.crossWindow, 128)
    assert.equal(data.dropped, 2)
    assert.equal(data.coverage, 'partial')
    for (let i = 0; i < 9; i++) f.step(11)
    assert.equal(f.monitor.snapshot().bufferTrend!.transport.coverage, 'none-observed')
  })
  for (const invalid of [
    'epoch',
    'policy',
    'authority',
    'representation',
    'host',
    'future',
    'old',
    'bytes',
    'ineligible',
  ] as const)
    test(`U-T03 rejects ${invalid} completion rate=${rate}`, (t) => {
      const f = bufferMonitor(t, rate)
      f.monitor.tick()
      const request = {
        ...f.request(),
        ...(invalid === 'epoch'
          ? { epoch: epochId(2) }
          : invalid === 'policy'
            ? { routePolicyRevision: 9 }
            : invalid === 'authority'
              ? { authorityRevision: 9 }
              : invalid === 'representation'
                ? { representation: representationId('other') }
                : invalid === 'host'
                  ? { targetHost: 'other.example' }
                  : {}),
      }
      if (invalid === 'ineligible') f.flags.eligible = false
      f.monitor.observeTransport({
        request,
        startedAt: f.clock.now() - 10000,
        completedAt: f.clock.now() + (invalid === 'future' ? 1 : invalid === 'old' ? -8001 : 0),
        bytes: invalid === 'bytes' ? NaN : 100,
        status: 206,
        outcome: 'success',
      })
      f.step(11.5)
      assert.equal(f.monitor.snapshot().bufferTrend!.transport.completedBytes, 0)
    })
  test(`U-O02 synchronous reset during qualification cannot publish the old window rate=${rate}`, (t) => {
    const f = bufferMonitor(t, rate)
    f.monitor.tick()
    for (let i = 1; i <= 8; i++) f.step(12 - i / 2)
    f.onQualification(() => {
      f.onQualification()
      f.monitor.reset()
    })
    f.step(7)
    assert.notEqual(f.monitor.snapshot().bufferTrend?.candidate, true)
    assert.deepEqual(f.effects, [])
  })
  for (const context of ['epoch', 'representation', 'policy', 'rate'] as const)
    test(`U-O03 ${context} cannot reuse a prior window rate=${rate}`, (t) => {
      const f = bufferMonitor(t, rate)
      f.monitor.tick()
      for (let i = 1; i <= 8; i++) f.step(12 - i / 2)
      if (context === 'epoch') f.state.epoch = epochId(2)
      if (context === 'representation')
        f.changeRequest({ representation: representationId('other') })
      if (context === 'policy') f.changeRequest({ routePolicyRevision: 1 })
      if (context === 'rate') f.video.playbackRate = rate === 1 ? 2 : 1
      f.step(7)
      assert.equal(f.monitor.snapshot().bufferTrend?.reason, 'context-changed')
      assert.equal(f.monitor.snapshot().bufferTrend?.candidate, null)
    })
  test(`U-N01 declining buffer has a candidate without any completed transport rate=${rate}`, (t) => {
    const f = bufferMonitor(t, rate)
    f.monitor.tick()
    for (let i = 1; i <= 8; i++) f.step(12 - i / 2)
    assert.equal(f.monitor.snapshot().bufferTrend?.candidate, true)
    assert.equal(f.monitor.snapshot().bufferTrend?.transport.coverage, 'none-observed')
    assert.deepEqual(f.effects, [])
  })
  for (const [flag, reason] of [
    ['paused', 'paused'],
    ['seeking', 'seeking'],
    ['mediaError', 'error'],
    ['ended', 'ended'],
    ['bufferedToEnd', 'buffered-to-end'],
  ] as const)
    test(`U-P03 ${flag} invalidates the diagnostic window rate=${rate}`, (t) => {
      const f = bufferMonitor(t, rate)
      f.monitor.tick()
      for (let i = 1; i <= 8; i++) f.step(12 - i / 2)
      f.video[flag] = true
      f.step(7)
      assert.equal(f.monitor.snapshot().bufferTrend?.state, 'ineligible')
      assert.equal(f.monitor.snapshot().bufferTrend?.reason, reason)
      assert.equal(f.monitor.snapshot().bufferTrend?.candidate, null)
    })
  for (const flag of ['visible', 'comparison', 'disabled', 'recovering'] as const)
    test(`U-P04 ${flag} blocks candidates rate=${rate}`, (t) => {
      const f = bufferMonitor(t, rate)
      f.flags[flag] = flag !== 'visible'
      f.monitor.tick()
      assert.equal(f.monitor.snapshot().bufferTrend?.state, 'ineligible')
    })
  for (const field of [
    'mediaId',
    'coreId',
    'seekRevision',
    'userRevision',
    'reloadRevision',
  ] as const)
    test(`U-O01 ${field} starts a fresh diagnostic window rate=${rate}`, (t) => {
      const f = bufferMonitor(t, rate)
      f.monitor.tick()
      for (let i = 1; i <= 8; i++) f.step(12 - i / 2)
      f.controls[field]++
      f.step(7)
      assert.equal(f.monitor.snapshot().bufferTrend?.reason, 'context-changed')
      assert.equal(f.monitor.snapshot().bufferTrend?.candidate, null)
    })
  test(`U-A01 stop reset and dispose discard observations rate=${rate}`, (t) => {
    const f = bufferMonitor(t, rate)
    f.monitor.start()
    f.clock.advance(1000)
    f.monitor.stop()
    assert.equal(f.clock.pendingCount, 0)
    assert.equal(f.monitor.snapshot().bufferTrend?.reason, 'stopped')
    f.monitor.reset()
    assert.equal(f.monitor.snapshot().bufferTrend?.reason, 'reset')
    f.monitor.start()
    assert.equal(f.monitor.snapshot().bufferTrend?.candidate, null)
    f.monitor.dispose()
    assert.equal(f.clock.pendingCount, 0)
  })
}
