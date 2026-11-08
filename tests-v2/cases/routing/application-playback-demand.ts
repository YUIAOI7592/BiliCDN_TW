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

async function createRateMonitorResources(t: TestContext) {
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
    set observedRate(value: typeof observedRate) {
      observedRate = value
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

async function createRepeatedMonitoringNeverWritesPlaybackSpeed12Context11(t: TestContext) {
  const resources = await createRateMonitorResources(t)
  for (const rate of [1, 1.5, 0.75, 2, 1]) {
    resources.selectedRate = rate
    resources.rateMonitor.tick()
    resources.rateMonitor.tick()
  }
  return {
    get rateWrites() {
      return resources.rateWrites
    },
    get rateSamples() {
      return resources.rateSamples
    },
  }
}

async function createRateAdapterContext13(t: TestContext) {
  const scope = testScope(t)
  const now = 2_000_000_000_000
  const block1 = createMutablePlaybackResources()
  const { recoveryPlayer } = block1
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
  return {
    adapterVideo,
    now,
    get playerSnapshot() {
      return block1.playerSnapshot
    },
    set playerSnapshot(value: typeof block1.playerSnapshot) {
      block1.playerSnapshot = value
    },
    rateAdapter,
    recoveryPlayer,
    scope,
  }
}

async function checkAdapterUsesRealParameterXForDemand13ParameterParameter(
  t: TestContext,
  parameter = 0,
): Promise<void> {
  const base = await createRateAdapterContext13(t)

  let iteration = 0
  for (const rate of [1, 1.5, 2, 0.75]) {
    if (iteration++ === parameter) {
      base.adapterVideo.playbackRate = rate
      assert.strictEqual(
        base.rateAdapter.snapshot().effectiveRate,
        rate,
        `adapter uses real ${rate}x for demand`,
      )
      assert.strictEqual(
        base.rateAdapter.snapshot().playableBufferSec,
        60 / rate,
        `buffer duration respects ${rate}x`,
      )
      assert.strictEqual(
        base.rateAdapter.playbackRate(),
        rate,
        'unavailable player API falls back to video rate',
      )

      return
    }
  }
  throw Error('Unknown fixture parameter')
}

async function check2xIsOnlyTheUnknownRatePlanningFallback14(t: TestContext): Promise<void> {
  const base = await createRateAdapterContext13(t)

  for (const rate of [1, 1.5, 2, 0.75]) {
    base.adapterVideo.playbackRate = rate
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
}

async function checkRepeatedMonitoringNeverWritesPlaybackSpeed12(t: TestContext): Promise<void> {
  const base = await createRepeatedMonitoringNeverWritesPlaybackSpeed12Context11(t)

  assert.strictEqual(base.rateSamples, 10, 'all ten monitoring ticks reach the rate observer')
  assert.strictEqual(base.rateWrites, 0, 'repeated monitoring never writes playback speed')
}

async function checkMonitorObservesSelectedParameterX11ParameterParameter(
  t: TestContext,
  parameter = 0,
): Promise<void> {
  const base = await createRateMonitorResources(t)

  let iteration = 0
  for (const rate of [1, 1.5, 0.75, 2, 1]) {
    if (iteration++ === parameter) {
      base.selectedRate = rate
      base.rateMonitor.tick()
      base.rateMonitor.tick()
      assert.strictEqual(base.observedRate, rate, `monitor observes selected ${rate}x`)

      return
    }
  }
  throw Error('Unknown fixture parameter')
}

{
  let parameter = 0
  for (const rate of [1, 1.5, 0.75, 2, 1]) {
    const selected = parameter++
    test(
      '`monitor observes selected ${rate}x` [11]' + ` / ${String(rate)} / ${selected}`,
      { timeout: 5000 },
      async (t) => {
        await checkMonitorObservesSelectedParameterX11ParameterParameter(t, selected)
      },
    )
  }
}

test('repeated monitoring never writes playback speed [12]', { timeout: 5000 }, async (t) => {
  await checkRepeatedMonitoringNeverWritesPlaybackSpeed12(t)
})

{
  let parameter = 0
  for (const rate of [1, 1.5, 2, 0.75]) {
    const selected = parameter++
    test(
      '`adapter uses real ${rate}x for demand` [13]' + ` / ${String(rate)} / ${selected}`,
      { timeout: 5000 },
      async (t) => {
        await checkAdapterUsesRealParameterXForDemand13ParameterParameter(t, selected)
      },
    )
  }
}

test('2x is only the unknown-rate planning fallback [14]', { timeout: 5000 }, async (t) => {
  await check2xIsOnlyTheUnknownRatePlanningFallback14(t)
})
