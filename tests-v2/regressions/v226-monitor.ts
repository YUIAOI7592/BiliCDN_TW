import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rescuePlayerFixture } from '../support/rescue-player.ts'
import { monitorRoutes, monitorMeasurement, monitorRecovery } from '../support/controllers.ts'
import { SessionStore } from '../../src-v2/state/session-store.ts'
import { PlayerMonitor } from '../../src-v2/application/playback/player-monitor.ts'
import { representationId } from '../../src-v2/domain/model.ts'

function monitor(t: Parameters<typeof rescuePlayerFixture>[0], candidate = true) {
  const f = rescuePlayerFixture(t, 1),
    session = new SessionStore(),
    state = session.beginGeneration(false)
  let attempts = 0,
    arms = 0,
    authority = 1,
    inventory = 1,
    eligible = true
  const firstAt = f.clock.now()
  const request = () => ({
    ...state,
    representation: representationId('video'),
    targetHost: 'old',
    authorityRevision: authority,
    routePolicyRevision: 1,
  })
  const observed: number[] = []
  const m = f.scope.own(
    new PlayerMonitor(
      f.player,
      session,
      { get: () => ({ disabled: false }) },
      {
        groupSummary: () => ({
          kind: 'video',
          codec: 'avc',
          height: 720,
          bandwidth: 4_000_000,
          routeCount: inventory,
        }),
      },
      monitorRoutes({
        firstMediaAt: () => firstAt,
        latestRequested: () => request(),
        recoveryEligible: () => eligible,
        recover: () => ({ host: 'next' }),
        recoverStartup: () => {
          attempts++
          return candidate ? { host: 'next' } : null
        },
      }),
      monitorMeasurement({
        tick: (s) => {
          observed.push(s.stableProgressTicks)
        },
      }),
      monitorRecovery({
        armStartupFailure: () => {
          arms++
        },
      }),
      () => true,
      f.clock.now,
      f.clock,
      undefined,
      f.clock.now,
    ),
  )
  const tick = (ms = 1000) => {
    f.clock.advance(ms)
    m.tick()
  }
  return {
    ...f,
    m,
    tick,
    attempts: () => attempts,
    arms: () => arms,
    observed,
    changeAuthority: () => {
      authority++
    },
    addSource: () => {
      inventory++
    },
    revoke: () => {
      eligible = false
    },
  }
}

test('V226 R03: readyState two and existing dimensions do not hide a cold-start stall', (t) => {
  const f = monitor(t)
  f.video().readyState = 2
  f.m.tick()
  f.tick(15_000)
  assert.equal(f.attempts(), 1)
  assert.equal(f.arms(), 1)
  f.tick(30_000)
  assert.equal(f.attempts(), 1)
})

test('V226 R02: no candidate waits for a changed qualification without consuming a commit', (t) => {
  const f = monitor(t, false)
  f.video().readyState = 0
  f.video().videoWidth = f.video().videoHeight = 0
  f.m.tick()
  f.tick(15_000)
  f.tick()
  f.tick()
  assert.equal(f.attempts(), 1)
  assert.equal(f.arms(), 0)
  f.changeAuthority()
  f.tick()
  assert.equal(f.attempts(), 2)
  assert.equal(f.m.snapshot().startupRescue.ageSec, 18)
})

test('V226 R02: newly admitted sources permit one preparation under the original cold deadline', (t) => {
  const f = monitor(t, false)
  f.m.tick()
  f.tick(15_000)
  f.tick()
  assert.equal(f.attempts(), 1)
  f.addSource()
  f.tick()
  assert.equal(f.attempts(), 2)
  f.tick()
  assert.equal(f.attempts(), 2)
  assert.equal(f.m.snapshot().startupRescue.ageSec, 18)
})

test('V226 R02: a revoked dispatched request cannot prepare a cold rescue', (t) => {
  const f = monitor(t)
  f.m.tick()
  f.revoke()
  f.tick(15_000)
  assert.equal(f.attempts(), 0)
  assert.equal(f.arms(), 0)
})

test('V226 H03: progress ticks are time-qualified and duplicate calls do not accumulate stability', (t) => {
  const f = monitor(t)
  f.m.tick()
  for (let i = 0; i < 25; i++) {
    f.video().currentTime++
    f.video().frames++
    f.m.tick()
  }
  assert.equal(f.observed.at(-1), 0)
  for (let i = 0; i < 20; i++) {
    f.video().currentTime++
    f.video().frames++
    f.tick()
  }
  assert.equal(f.observed.at(-1), 20)
  f.video().currentTime += 10
  f.video().frames += 10
  f.tick(10_000)
  assert.ok(f.observed.at(-1)! < 20)
})

test('V226 R05 H02: isolated progress preserves one stall id deadline and fallback quota', (t) => {
  const f = monitor(t)
  f.m.tick()
  f.video().currentTime++
  f.video().frames++
  f.tick()
  f.tick()
  const episode = f.m.snapshot().stall!
  assert.ok(episode)
  f.tick(6000)
  assert.equal(f.m.snapshot().stall?.fallbackAvailable, false)
  for (let i = 0; i < 5; i++) {
    f.video().currentTime++
    f.video().frames++
    f.tick()
    assert.equal(f.m.snapshot().stall?.phase, 'confirming')
    f.tick()
    assert.equal(f.m.snapshot().stall?.id, episode.id)
    assert.equal(f.m.snapshot().stall?.reloadAt, episode.reloadAt)
    assert.equal(f.m.snapshot().stall?.fallbackAvailable, false)
  }
  f.video().buffered = { length: 1, start: () => 0, end: () => f.video().currentTime + 100 }
  for (let i = 0; i < 9; i++) {
    f.video().currentTime++
    f.video().frames++
    f.tick()
  }
  assert.equal(f.m.snapshot().stall?.id, episode.id)
  f.video().currentTime++
  f.video().frames++
  f.tick()
  assert.equal(f.m.snapshot().stall, null)
})
