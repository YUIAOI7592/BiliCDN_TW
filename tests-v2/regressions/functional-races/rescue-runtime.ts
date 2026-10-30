import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { PlayerMonitor } from '../../../src-v2/application/player-monitor.ts'
import { RuntimeController } from '../../../src-v2/application/runtime-controller.ts'
import { DiagnosticRecorder } from '../../../src-v2/diagnostics/recorder.ts'
import type { RuntimeRoutesPort } from '../../../src-v2/application/runtime-ports.ts'
import type { MonitorRoutes } from '../../../src-v2/application/monitor-ports.ts'
import { defaultSettings } from '../../../src-v2/state/settings-store.ts'
import {
  decisionId,
  epochId,
  generationId,
  representationId,
  requestId,
  recoveryActionId,
  type DomainEvent,
  type RequestContext,
} from '../../../src-v2/domain/model.ts'
import { rescuePlayerFixture } from '../../support/rescue-player.ts'
import { monitorRoutes, monitorMeasurement } from '../../support/controllers.ts'
import { sustainedPlayback, type RescueProgressSample } from '../../support/rescue-acceptance.ts'

function fixture(t: TestContext, rate: number) {
  const f = rescuePlayerFixture(t, rate),
    rep = representationId('video:runtime-rescue')
  const listeners = new Set<(event: DomainEvent) => void>(),
    trace: DomainEvent[] = []
  let subscriptions = 0,
    sequence = 0,
    policyValid = true
  const session = {
    get: () => ({
      generation: generationId(1),
      epoch: epochId(0),
      representation: rep,
      affinity: null,
      disabled: false,
      recovering: false,
      lastDecisionId: null,
    }),
  }
  const settings = {
    get: () => defaultSettings(f.clock.now()),
    subscribe: () => {
      subscriptions++
      return () => {
        subscriptions--
      }
    },
  }
  const request: RequestContext = {
    routePolicyRevision: 0,
    requestId: requestId('fixture'),
    generation: generationId(1),
    epoch: epochId(0),
    decisionId: decisionId('fixture'),
    representation: rep,
    authorityRevision: 1,
    kind: 'video',
    attributionStatus: 'matched',
    attributionSource: 'exact',
    decisionStage: 'request',
    routeType: 'catalog-generated',
    originalHost: 'upos-sz-mirrorali.bilivideo.com',
    targetHost: 'upos-sz-mirrorcos.bilivideo.com',
    sourceHost: null,
    playurlHostChanged: false,
    playurlOutput: null,
    urlChanged: true,
    hostChanged: true,
    startedAt: f.clock.now(),
  }
  const fallback = (kind: 'video' | 'audio') => {
    const event: DomainEvent = {
      type: 'recovery',
      at: f.clock.now(),
      action: {
        action: 'route-fallback',
        id: recoveryActionId('fallback-' + ++sequence),
        kind,
        identity: {
          generation: generationId(1),
          epoch: epochId(0),
          representation: rep,
          kind,
          authorityRevision: 1,
        },
        decision: {
          action: 'rewrite',
          id: decisionId('fallback-' + sequence),
          reason: 'watchdog',
          host: request.targetHost,
          routeType: 'catalog-generated',
          ranking: [],
          candidate: { type: 'catalog-generated', host: request.targetHost, kind, catalogIndex: 0 },
        },
      },
    }
    for (const listener of listeners) listener(event)
  }
  const routes = {
    ...monitorRoutes(),
    subscribe: (fn: (event: DomainEvent) => void) => {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
    invalidateForUserSetting() {},
    latestRequested: () => request,
    recoveryEligible: () => policyValid,
    recover: () => {
      fallback('video')
    },
  } satisfies MonitorRoutes & RuntimeRoutesPort
  const measurement = { ...monitorMeasurement(), reset() {} }
  const diagnostics = new DiagnosticRecorder(f.clock.now)
  const monitor = new PlayerMonitor(
    f.player,
    session,
    settings,
    { groupSummary: () => null },
    routes,
    measurement,
    f.recovery,
    f.environment.isActuallyVisible,
    f.clock.now,
    f.clock,
  )
  const runtime = new RuntimeController(
    session,
    settings,
    routes,
    f.player,
    monitor,
    measurement,
    f.recovery,
    { setEnabled() {} },
    {
      record: (event) => {
        trace.push(event)
        diagnostics.record(event)
      },
      recordPlayer: (sample) => diagnostics.recordPlayer(sample),
    },
    f.clock.now,
    {
      subscribeEpoch: () => {
        subscriptions++
        return () => {
          subscriptions--
        }
      },
    },
  )
  runtime.install()
  f.scope.defer(() => {
    runtime.dispose()
    monitor.dispose()
    assert.equal(subscriptions, 0)
    assert.equal(listeners.size, 0)
    assert.equal(f.clock.pendingCount, 0)
  })
  monitor.tick()
  f.video().currentTime += rate
  f.video().frames += 30
  f.clock.advance(1000)
  monitor.tick()
  const sample = (): RescueProgressSample => {
    const v = f.player.snapshot(),
      c = f.player.controls()
    return {
      at: f.clock.now(),
      position: v.currentTime,
      frames: v.frames,
      rate: v.playbackRate,
      owner: `${c.mediaId}:${c.coreId}:${c.userRevision}:${c.seekRevision}`,
      paused: v.paused,
      seeking: v.seeking,
      ended: v.ended,
      error: v.mediaError,
      reloadCount: f.recovery.snapshot().reloadCount,
    }
  }
  return {
    ...f,
    monitor,
    runtime,
    trace,
    diagnostics,
    fallback,
    sample,
    policy: (value: boolean) => {
      policyValid = value
    },
  }
}

for (const rate of [1, 2]) {
  for (const target of [0, 2811.002824])
    test(`I-R03 full Runtime seek ${target} initializes and sustains 15 seconds rate=${rate}`, (t) => {
      const f = fixture(t, rate)
      f.key(target)
      f.monitor.tick()
      f.returns.reload = () => {
        f.core(null)
        f.video().paused = true
        f.video().seeking = false
        f.video().currentTime = 0
        f.video().readyState = 0
      }
      f.runtime.start()
      f.clock.advance(30_000)
      assert.deepEqual(f.saved(), [target])
      assert.equal(
        f.trace.filter((e) => e.type === 'recovery' && e.action.action === 'route-fallback').length,
        1,
      )
      f.core({ state: { initialized: true }, getMpd: () => ({ video: [{}] }) })
      f.video().readyState = 4
      f.site.seek(3844)
      f.video().seeking = true
      f.video().dispatchEvent(new Event('seeking'))
      f.clock.advance(1000)
      f.video().seeking = false
      f.video().dispatchEvent(new Event('seeked'))
      f.returns.play = () => {
        f.video().paused = false
      }
      const before = f.effects.length
      f.clock.advance(1000)
      assert.deepEqual(
        f.effects.slice(before).map((e) => [e.method, e.args[0]]),
        [
          ['seek', target],
          ['rate', rate],
          ['play', undefined],
        ],
      )
      assert.ok(Math.abs(f.video().currentTime - target) <= 0.000001)
      for (let i = 0; i < 2; i++) {
        f.video().currentTime += rate
        f.video().frames += 30
        f.clock.advance(1000)
      }
      assert.equal(f.recovery.snapshot().state, 'recovered')
      const samples = [f.sample()]
      for (let i = 0; i < 15; i++) {
        f.video().currentTime += rate
        f.video().frames += 30
        f.clock.advance(1000)
        samples.push(f.sample())
      }
      assert.equal(sustainedPlayback(samples, rate), true)
      assert.equal(f.effects.filter((e) => e.method === 'reload').length, 1)
      assert.equal(f.effects.filter((e) => e.method === 'rate').length, 1)
      assert.equal(f.effects.filter((e) => e.method === 'play').length, 1)
      const controls = f.player.controls()
      assert.equal(controls.pendingSeekGoal, false)
      assert.ok(f.diagnostics.snapshot().bufferTrend.history.length > 0)
      assert.equal(f.diagnostics.snapshot().bufferTrend.latest?.candidate === true, false)
    })
  for (const kind of ['audio', 'video'] as const)
    test(`I-R04 Runtime ${kind} fallback eligibility is isolated rate=${rate}`, (t) => {
      const f = fixture(t, rate)
      f.policy(false)
      f.fallback(kind)
      assert.equal(f.recovery.isRecovering(), false)
      f.policy(true)
      f.fallback(kind)
      assert.equal(f.recovery.isRecovering(), kind === 'video')
      assert.equal(f.effects.filter((e) => e.method === 'reload').length, 0)
    })
  for (const boundary of ['seek', 'rate', 'play'] as const)
    for (const operation of ['seek', 'pause', 'rate'] as const)
      test(`I-R05 ${operation} inside restore ${boundary} protects newer intent rate=${rate}`, (t) => {
        const f = fixture(t, rate)
        f.key(978)
        f.recovery.armStall(f.player.snapshot(), {
          id: 1,
          startedAt: f.clock.now(),
          targetSec: 978,
          valid: () => true,
        })
        f.advance(30_000)
        f.core({ state: { initialized: true }, getMpd: () => ({ video: [{}] }) })
        f.video().seeking = false
        const interrupt = () => {
          f.pointer()
          if (operation === 'seek') f.video().currentTime = 400
          if (operation === 'pause') f.video().paused = true
          if (operation === 'rate') f.video().playbackRate = 3
        }
        if (boundary === 'seek') f.returns.seek = interrupt
        if (boundary === 'play') f.returns.play = interrupt
        if (boundary === 'rate') {
          const original = f.site.setPlaybackRate
          f.site.setPlaybackRate = (value) => {
            original(value)
            interrupt()
          }
        }
        const before = f.effects.length
        f.tick()
        assert.deepEqual(
          f.effects.slice(before).map((e) => e.method),
          ['seek', 'rate', 'play'].slice(0, ['seek', 'rate', 'play'].indexOf(boundary) + 1),
        )
        f.tick()
        assert.equal(f.recovery.isRecovering(), false)
        if (operation === 'seek') assert.equal(f.video().currentTime, 400)
        if (operation === 'pause') assert.equal(f.video().paused, true)
        if (operation === 'rate') assert.equal(f.video().playbackRate, 3)
      })
}
