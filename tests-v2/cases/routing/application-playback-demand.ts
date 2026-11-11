import { createMutablePlaybackResources } from '../../support/player.ts'
import { CatalogSettingsStore } from '../../support/catalog-settings.ts'
import { currentResumePlayer } from '../../support/player.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { type TestContext } from 'node:test'
import { playurlResult } from '../../support/playurl.ts'
import { monitorRoutes, monitorMeasurement, monitorRecovery } from '../../support/controllers.ts'
import { SignedRouteVault } from '../../../src-v2/state/signed-route-vault.ts'
import { SessionStore } from '../../../src-v2/state/session-store.ts'
import { RecoveryController } from '../../../src-v2/application/playback/recovery-controller.ts'
import { PlayerMonitor } from '../../../src-v2/application/playback/player-monitor.ts'
import { PlayerAdapter } from '../../../src-v2/adapters/player/player.ts'
import { type PlayerPort } from '../../../src-v2/application/playback/player-contracts.ts'
import { FakeStorage } from '../../support/storage.ts'
import { testScope } from '../../support/scope.ts'
import { BrowserScheduler } from '../../../src-v2/adapters/scheduler.ts'

// Named scenarios create only their prerequisite state; resources belong to this test.

function createRateMonitorResources(t: TestContext) {
  const scope = testScope(t)
  const now = 2_000_000_000_000
  const storage = new FakeStorage()
  const settings = scope.own(new CatalogSettingsStore(storage, () => now))
  const session = new SessionStore()
  void session.beginGeneration(false)
  const block1 = createMutablePlaybackResources()
  const { recoveryPlayer } = block1
  let selectedRate = 1
  let rateWrites = 0
  let observedRate = 0
  let rateSamples = 0
  const ratePlayer: PlayerPort = {
    ...recoveryPlayer,
    snapshot: () => ({
      ...block1.playerSnapshot,
      playbackRate: selectedRate,
      effectiveRate: selectedRate,
      currentTime: 50,
    }),
    playbackRate: () => selectedRate,
    setRate: () => {
      rateWrites++
    },
  }
  const rateMonitor = scope.own(
    new PlayerMonitor(
      ratePlayer,
      session,
      settings,
      new SignedRouteVault(),
      monitorRoutes({
        observePlaybackRate: (rate: number) => {
          observedRate = rate
          rateSamples++
        },
        firstMediaAt: () => 0,
      }),
      monitorMeasurement({ tick: () => undefined }),
      monitorRecovery({ tick: () => undefined, isRecovering: () => false }),
      () => true,
      () => now,
      new BrowserScheduler(),
      undefined,
      () => now,
    ),
  )
  return {
    get rateWrites() {
      return rateWrites
    },
    get rateSamples() {
      return rateSamples
    },
    get observedRate() {
      return observedRate
    },
    rateMonitor,
    get selectedRate() {
      return selectedRate
    },
    set selectedRate(value: typeof selectedRate) {
      selectedRate = value
    },
  }
}

function rateAdapterFixture(t: TestContext) {
  const scope = testScope(t)
  const adapterVideo = {
    isConnected: true,
    paused: false,
    seeking: false,
    ended: false,
    readyState: 4,
    currentTime: 10,
    duration: 100,
    videoWidth: 1920,
    videoHeight: 1080,
    playbackRate: 1,
    buffered: { length: 1, start: () => 0, end: () => 70 },
    error: null,
  } as unknown as HTMLVideoElement
  class RateAdapter extends PlayerAdapter {
    override controls() {
      return {
        mediaId: 1,
        coreId: 1,
        seekRevision: 0,
        userRevision: 0,
        dragging: false,
        targetSec: null,
        reloadRevision: 0,
        coreReloadRevision: 0,
      }
    }
    override video(): HTMLVideoElement {
      return adapterVideo
    }
    override player(): Record<string, unknown> {
      return { getPlaybackRate: () => null }
    }
  }
  const rateAdapter = new RateAdapter(
    { transform: () => playurlResult(false), lifecycleKey: () => 'test' },
    {
      scheduler: { timeout: () => () => undefined },
      isActuallyVisible: () => true,
      subscribeControlLoss: () => () => undefined,
    },
  )
  scope.defer(() => rateAdapter.reset())
  return { adapterVideo, rateAdapter, scope }
}

test('monitor observes selected rates without writing playback speed [11-12]', (t) => {
  const f = createRateMonitorResources(t)
  let ticks = 0
  for (const rate of [1, 1.5, 0.75, 2, 1]) {
    f.selectedRate = rate
    for (let i = 0; i < 2; i++) {
      f.rateMonitor.tick()
      assert.equal(f.observedRate, rate)
      assert.equal(f.rateSamples, ++ticks)
      assert.equal(f.rateWrites, 0)
    }
  }
})

test('adapter uses each real rate for demand and playable buffer [13]', (t) => {
  const f = rateAdapterFixture(t)
  for (const rate of [1, 1.5, 2, 0.75]) {
    f.adapterVideo.playbackRate = rate
    const snapshot = f.rateAdapter.snapshot()
    assert.equal(snapshot.effectiveRate, rate)
    assert.equal(snapshot.playableBufferSec, 60 / rate)
    assert.equal(f.rateAdapter.playbackRate(), rate)
  }
})

test('unknown rate uses 2x planning; recovery preserves the saved user rate [14]', (t) => {
  const adapter = rateAdapterFixture(t),
    block = createMutablePlaybackResources()
  const base = {
    ...adapter,
    now: 2_000_000_000_000,
    playerSnapshot: block.playerSnapshot,
    recoveryPlayer: block.recoveryPlayer,
  }
  base.adapterVideo.playbackRate = Number.NaN

  assert.strictEqual(
    base.rateAdapter.snapshot().effectiveRate,
    2,
    '2x is only the unknown-rate planning fallback',
  )
  let savedRateRestored = 0,
    rateRecoveryNow = base.now
  const customRatePlayer: PlayerPort = {
    ...base.recoveryPlayer,
    playbackRate: () => 1.5,
    setRate: (value) => {
      savedRateRestored = value
    },
  }
  const customRateRecovery = base.scope.own(
    new RecoveryController(currentResumePlayer(customRatePlayer), () => rateRecoveryNow),
  )
  const healthyCustomRate = {
    ...base.playerSnapshot,
    playbackRate: 1.5,
    effectiveRate: 1.5,
  }
  customRateRecovery.tick(healthyCustomRate)
  customRateRecovery.armRouteFailure('route-failure', healthyCustomRate)
  rateRecoveryNow += 4000
  customRateRecovery.tick({
    ...healthyCustomRate,
    readyState: 0,
    width: 0,
    height: 0,
    coreInitialized: false,
  })
  rateRecoveryNow += 1000
  customRateRecovery.tick({ ...healthyCustomRate, frames: 2 })
  assert.strictEqual(
    savedRateRestored,
    1.5,
    'core recovery restores the saved user rate, not forced 2x',
  )
})
