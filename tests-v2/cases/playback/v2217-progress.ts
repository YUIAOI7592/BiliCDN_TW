import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rescuePlayerFixture } from '../../support/rescue-player.ts'
import { monitorRoutes, monitorMeasurement } from '../../support/controllers.ts'
import { SessionStore } from '../../../src-v2/state/session-store.ts'
import { PlayerMonitor } from '../../../src-v2/application/playback/player-monitor.ts'
import { EarlyRetryController } from '../../../src-v2/application/routing/early-retry-controller.ts'
import { type EarlyRetryActionState } from '../../../src-v2/application/routing/early-retry-contracts.ts'
import { type MeasurementStatus } from '../../../src-v2/application/measurement/measurement-contracts.ts'
import { type RequestContext } from '../../../src-v2/domain/transport-model.ts'
import { representationId, requestId, decisionId } from '../../../src-v2/domain/model.ts'
import {
  samplePlaybackProgress,
  type ProgressState,
  type ProgressSample,
} from '../../../src-v2/domain/playback-progress.ts'
import { testScope } from '../../support/scope.ts'
import { MeasurementController } from '../../../src-v2/application/measurement/measurement-controller.ts'
import { MeasurementMetaStore } from '../../../src-v2/state/measurement-meta-store.ts'
import { fixture, media, dash } from '../routing/routing-fixture.ts'
import { setImmediate as nextTurn } from 'node:timers/promises'

function playback(t: Parameters<typeof rescuePlayerFixture>[0], buffer = 5) {
  const f = rescuePlayerFixture(t, 1),
    session = new SessionStore()
  const state = session.beginGeneration(false)
  f.player.controls()
  const request: RequestContext = {
    requestId: requestId('v2217-video'),
    decisionId: decisionId('v2217-route'),
    generation: state.generation,
    epoch: state.epoch,
    representation: representationId('video'),
    kind: 'video',
    targetHost: 'upos-sz-mirrorali.bilivideo.com',
    originalHost: 'upos-sz-mirrorali.bilivideo.com',
    sourceHost: 'upos-sz-mirrorali.bilivideo.com',
    routeType: 'catalog-generated',
    routePolicyRevision: 1,
    authorityRevision: 1,
    attributionStatus: 'matched',
    attributionSource: 'exact',
    decisionStage: 'request',
    playurlHostChanged: false,
    playurlOutput: null,
    urlChanged: false,
    hostChanged: false,
    startedAt: f.clock.now() - 3000,
  }
  let arms = 0,
    fallbacks = 0,
    cancels = 0,
    available = true
  let currentRequest = request
  let action: EarlyRetryActionState = 'pending'
  let mono: number | null = 0
  const observed: MeasurementStatus[] = []
  const retry = f.scope.own(
    new EarlyRetryController(
      {
        alternatives: () => [
          {
            host: 'upos-sz-mirrorbos.bilivideo.com',
            safeMbps: 40,
            safePayloadMbps: 40,
            ttfbMs: 100,
            successCount: 2,
            oldestAt: f.clock.now() - 1000,
          },
        ],
        prepare: () => ({ id: `permit-${arms}`, expiresAt: f.clock.now() + 2000 }),
        revoke: () => undefined,
      },
      {
        samples: () =>
          available
            ? [
                {
                  request: currentRequest,
                  loadedBytes: 100_000,
                  totalBytes: 1_000_000,
                  recentBytesPerSec: 50_000,
                },
              ]
            : [],
        arm: () => {
          arms++
          return true
        },
        state: () => action,
        cancel: () => {
          cancels++
        },
      },
      f.clock.now,
    ),
  )
  f.video().buffered = { length: 1, start: () => 0, end: () => f.video().currentTime + buffer }
  const monitor = f.scope.own(
    new PlayerMonitor(
      f.player,
      session,
      { get: () => ({ disabled: false, earlyRetryEnabled: true }) },
      {
        groupSummary: () => ({
          kind: 'video',
          codec: 'avc',
          height: 720,
          bandwidth: 4_000_000,
          routeCount: 2,
        }),
      },
      monitorRoutes({
        latestRequested: () => request,
        recoveryEligible: () => true,
        recover: () => {
          fallbacks++
          return { host: 'upos-sz-mirrorbos.bilivideo.com' }
        },
      }),
      monitorMeasurement({ tick: (s) => observed.push(s) }),
      f.recovery,
      () => true,
      f.clock.now,
      f.clock,
      retry,
      () => mono,
    ),
  )
  monitor.tick()
  return {
    ...f,
    monitor,
    retry,
    observed,
    request,
    step(ms = 1000, progress = true) {
      f.clock.advance(ms)
      if (mono !== null) mono += ms
      if (progress) {
        f.video().currentTime += ms / 1000
        f.video().frames++
      }
      monitor.tick()
    },
    monotonic(value: number | null) {
      mono = value
    },
    buffer(value: number) {
      buffer = value
    },
    traffic(value: boolean) {
      available = value
    },
    newRequest() {
      currentRequest = { ...request, requestId: requestId('v2217-second') }
    },
    result(value: EarlyRetryActionState) {
      action = value
    },
    arms: () => arms,
    fallbacks: () => fallbacks,
    cancels: () => cancels,
  }
}

for (const gaps of [[999, 1001], [990, 1010], [999], [1000]]) {
  test(`V2217 progress: continuous playback at ${gaps.join('/')} ms never creates a stall`, (t) => {
    const f = playback(t, 40)
    for (let i = 0; i < 30; i++) {
      f.step(gaps[i % gaps.length])
      assert.equal(f.monitor.snapshot().stall, null)
    }
    assert.equal(f.monitor.snapshot().stableProgressTicks, 30)
    assert.equal(f.fallbacks(), 0)
    assert.equal(f.effects.filter((e) => e.method === 'reload').length, 0)
  })
}

test('V2217 progress: ten short observations cannot acquire retry before ten seconds', (t) => {
  const f = playback(t)
  for (let i = 0; i < 10; i++) f.step(999)
  assert.equal(f.arms(), 0)
  f.step(999)
  assert.equal(f.arms(), 1)
})

test('V2217 progress: stable low buffer retains the stall budget without suppressing retry', (t) => {
  const f = playback(t)
  f.step()
  f.step(1000, false)
  const episode = f.monitor.snapshot().stall!
  assert.ok(episode)
  for (let i = 0; i < 9; i++) f.step()
  assert.equal(f.arms(), 0)
  f.step()
  assert.equal(f.arms(), 1)
  assert.equal(f.monitor.snapshot().stall?.id, episode.id)
  assert.equal(f.monitor.snapshot().stall?.reloadAt, episode.reloadAt)
  f.result('succeeded')
  f.step()
  f.step(1000, false)
  assert.equal(f.monitor.snapshot().stall?.id, episode.id)
  assert.equal(f.arms(), 1)
})

test('V2217 progress: one short no-progress sample waits for a full comparison interval', (t) => {
  const f = playback(t)
  f.step()
  f.step(500, false)
  assert.equal(f.monitor.snapshot().stall, null)
  f.step(500, false)
  assert.equal(f.monitor.snapshot().stall?.startedAt, f.clock.now())
})

test('V2217 progress: duplicate calls preserve a pending permit and its original expiry', (t) => {
  const f = playback(t)
  for (let i = 0; i < 10; i++) f.step()
  assert.equal(f.arms(), 1)
  f.monitor.tick()
  assert.equal(f.cancels(), 0)
  assert.equal(f.monitor.snapshot().stall, null)
  f.step(2000)
  assert.equal(f.retry.snapshot().reason, 'handoff-expired')
  assert.equal(f.arms(), 1)
})

test('V2217 progress: late progress rebuilds stability without creating a false stall', (t) => {
  const f = playback(t, 40)
  for (let i = 0; i < 15; i++) f.step()
  f.step(2001)
  assert.equal(f.monitor.snapshot().stall, null)
  assert.equal(f.monitor.snapshot().stableProgressTicks, 0)
  f.step()
  assert.equal(f.monitor.snapshot().stableProgressTicks, 1)
})

for (const bad of [null, Number.NaN, Infinity, -1, 5000]) {
  test(`V2217 progress: invalid or backward monotonic ${String(bad)} revokes pending without resetting quota`, (t) => {
    const f = playback(t)
    for (let i = 0; i < 10; i++) f.step()
    assert.equal(f.arms(), 1)
    f.monotonic(bad)
    f.monitor.tick()
    assert.equal(f.cancels(), 1)
    assert.equal(f.monitor.snapshot().stableProgressTicks, 0)
    assert.equal(f.monitor.snapshot().stall, null)
    f.monotonic(11_000)
    f.monitor.tick()
    f.newRequest()
    for (let i = 0; i < 15; i++) f.step()
    assert.equal(f.arms(), 1)
    assert.equal(f.retry.snapshot().reason, 'episode-used')
  })
}

test('V2217 progress: wall-clock jumps do not create monotonic stability or stalls', (t) => {
  const f = playback(t, 40)
  f.step()
  f.clock.advance(3600_000)
  f.monitor.tick()
  assert.equal(f.monitor.snapshot().stableProgressTicks, 1)
  assert.equal(f.monitor.snapshot().progressObservation, 'duplicate')
  assert.equal(f.monitor.snapshot().stall, null)
  f.step()
  assert.equal(f.monitor.snapshot().stableProgressMs, 2000)
})

test('V2217 progress: health quota starts at the first high-buffer observation and requires ten seconds', (t) => {
  const f = playback(t)
  for (let i = 0; i < 10; i++) f.step()
  f.result('succeeded')
  f.step()
  f.newRequest()
  for (let i = 0; i < 20; i++) f.step()
  assert.equal(f.arms(), 1)
  f.buffer(10)
  for (let i = 0; i < 10; i++) f.step(999)
  f.buffer(5)
  f.step()
  assert.equal(f.arms(), 1, 'nine seconds of high buffer cannot reopen the episode')
  f.buffer(10)
  for (let i = 0; i < 12; i++) f.step(999)
  f.buffer(5)
  f.result('pending')
  f.step()
  assert.equal(f.arms(), 2)
})

test('V2217 progress: unknown subsecond intervals cannot refill the retry episode time credit', (t) => {
  const f = playback(t)
  for (let i = 0; i < 10; i++) f.step()
  f.result('succeeded')
  f.step()
  f.newRequest()
  f.buffer(10)
  f.step()
  for (let i = 0; i < 10; i++) {
    f.step(500, false)
    f.step(500)
  }
  f.buffer(5)
  f.step()
  assert.equal(f.arms(), 1)
  assert.equal(f.retry.snapshot().reason, 'episode-used')
})

test('V2217 progress: a real recovery token suppresses a stable retained episode until recovery completes', (t) => {
  const f = playback(t)
  f.step()
  f.step(1000, false)
  f.traffic(false)
  for (let i = 0; i < 10; i++) f.step()
  assert.equal(f.monitor.snapshot().stall?.phase, 'stable-retained')
  f.recovery.tick(f.player.snapshot()) // A route failure follows a no-progress recovery observation.
  f.recovery.armRouteFailure('route-failure', f.player.snapshot())
  assert.equal(f.recovery.isRecovering(), true)
  f.traffic(true)
  f.step()
  assert.equal(f.arms(), 0)
  assert.equal(f.retry.snapshot().reason, 'recovering')
  f.step()
  assert.equal(f.recovery.isRecovering(), false)
  assert.equal(f.arms(), 1)
  const before = f.monitor.snapshot().stall!
  f.result('succeeded')
  f.step()
  f.buffer(10)
  f.step()
  assert.equal(f.monitor.snapshot().stall, null)
  assert.equal(f.arms(), 1)
  assert.ok(before.reloadAt > before.startedAt)
})

test('V2217 progress policy: interval boundaries have explicit observation and time credit', () => {
  const first: ProgressSample = {
    at: 0,
    position: 1,
    frames: 10,
    active: true,
    seeking: false,
    seekRevision: 0,
    userRevision: 0,
    mediaId: 1,
    coreId: 1,
    playbackRevision: 0,
    generation: 1,
    epoch: 1,
    representation: 'video',
  }
  const initial: ProgressState = { baseline: null, ticks: 0, elapsedMs: 0 }
  const base = samplePlaybackProgress(initial, first).next
  for (const [gap, observation, ticks, elapsedMs] of [
    [0, 'duplicate', 0, 0],
    [999, 'progress', 1, 999],
    [1000, 'progress', 1, 1000],
    [2000, 'progress', 1, 2000],
    [2001, 'gap-progress', 0, 0],
  ] as const) {
    const result = samplePlaybackProgress(base, { ...first, at: gap, position: 2, frames: 11 })
    assert.deepEqual(
      [result.observation, result.next.ticks, result.next.elapsedMs],
      [observation, ticks, elapsedMs],
      'interval ' + gap,
    )
    if (gap === 0) assert.equal(result.next.baseline, first)
  }
  const owner = samplePlaybackProgress(base, { ...first, mediaId: 2 })
  assert.equal(
    owner.observation,
    'owner-changed',
    'owner revocation precedes timestamp deduplication',
  )
})

test('V2217 progress: an invalid negative baseline cannot earn credit on returning to zero', () => {
  const sample: ProgressSample = {
    at: -1,
    position: 1,
    frames: 1,
    active: true,
    seeking: false,
    seekRevision: 0,
    userRevision: 0,
    mediaId: 1,
    coreId: 1,
    playbackRevision: 0,
    generation: 1,
    epoch: 1,
    representation: 'video',
  }
  const invalid = samplePlaybackProgress({ baseline: null, ticks: 0, elapsedMs: 0 }, sample)
  assert.equal(invalid.observation, 'clock-invalid')
  const next = samplePlaybackProgress(invalid.next, { ...sample, at: 0, position: 2, frames: 2 })
  assert.equal(next.observation, 'insufficient')
  assert.equal(next.next.ticks, 0)
  assert.equal(next.next.elapsedMs, 0)
})

test('V2217 health: actual Measurement waits for twenty observations and twenty monotonic seconds', async (t) => {
  const scope = testScope(t),
    routes = fixture(scope)
  const url = media('v2217-health', 'video.m4s')
  assert.equal(routes.adapter.transform(dash(url)).accepted, true)
  const rep = routes.vault.match(url).context!.representation
  const f = playback(t, 40)
  let probes = 0
  const controller = scope.own(
    new MeasurementController(
      routes.routes,
      new MeasurementMetaStore(routes.storage, routes.clock.now),
      {
        read: async () => {
          probes++
          return {
            bytes: 262144,
            elapsedMs: 100,
            ttfbMs: 5,
            status: 206,
            directRange: true,
            reason: 'measured',
          }
        },
      },
      routes.clock.now,
      routes.clock,
      undefined,
      undefined,
      undefined,
      routes.clock.now,
    ),
  )
  for (let i = 0; i < 20; i++) {
    f.step(999)
    controller.tick({ ...f.observed.at(-1)!, representation: rep })
    await nextTurn()
    assert.equal(probes, 0)
  }
  f.step(999)
  controller.tick({ ...f.observed.at(-1)!, representation: rep })
  await nextTurn()
  assert.equal(probes, 3, 'the eligible round probes all three available candidates')
  const count = probes
  f.monitor.tick()
  controller.tick({ ...f.observed.at(-1)!, representation: rep })
  await nextTurn()
  assert.equal(probes, count)
})
