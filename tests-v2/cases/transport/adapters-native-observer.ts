import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { createMutablePlaybackResources, currentResumePlayer } from '../../support/player.ts'
import { installProgressEvent } from '../../support/progress-event.ts'
import { playurlResult } from '../../support/playurl.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import { decisionId } from '../../../src-v2/domain/model.ts'
import { type TransportObservation } from '../../../src-v2/domain/transport-model.ts'
import { TransportAdapter } from '../../../src-v2/adapters/transport/transport.ts'
import { RecoveryController } from '../../../src-v2/application/playback/recovery-controller.ts'
import { PlayerAdapter } from '../../../src-v2/adapters/player/player.ts'
import { testScope } from '../../support/scope.ts'
import { fixture, dash, media } from '../routing/routing-fixture.ts'
import { start, finish } from '../../support/route-dispatch.ts'
import { createTransportHookResources } from './adapters-resources.ts'

const forbiddenUrl = 'https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/test/output/1.m4s?k=1'
function outputFixture(t: TestContext) {
  const scope = testScope(t),
    f = fixture(scope)
  const outputItem = {
    id: 80,
    codecid: 13,
    height: 1080,
    bandwidth: 1_000_000,
    base_url: forbiddenUrl,
    backup_url: [forbiddenUrl],
  }
  assert.equal(
    f.adapter.transform({ data: { dash: { video: [outputItem], audio: [] } } }).accepted,
    true,
  )
  return { ...f, scope, outputItem }
}

async function createFallbackObservationContext(t: TestContext) {
  const f = outputFixture(t),
    now = f.clock.now()
  const alternateOutput = f.outputItem.backup_url.find(
    (url) => new URL(url).host !== new URL(f.outputItem.base_url).host,
  )
  assert.ok(alternateOutput)
  const fallbackApplied = f.routes.apply(alternateOutput)
  assert.equal(fallbackApplied.decision.reason, 'player-fallback')
  assert.ok(fallbackApplied.context)
  const outputRep = fallbackApplied.context.representation
  const healthyObservation: TransportObservation = {
    generation: f.session.get().generation,
    epoch: f.session.get().epoch,
    decisionId: decisionId('aggregate'),
    representation: outputRep,
    kind: 'video',
    routeType: 'catalog-generated',
    originalHost: new URL(forbiddenUrl).host,
    targetHost: TRUSTED_CATALOG[2],
    finalHost: TRUSTED_CATALOG[2],
    status: 206,
    bytes: 100_000,
    ttfbMs: 20,
    elapsedMs: 100,
    completedAt: now,
    outcome: 'success',
    streamKey: 'aggregate',
  }
  return {
    scope: f.scope,
    now,
    fallbackApplied,
    healthyObservation,
    outputRep,
    forbiddenUrl,
    unknownQuery: alternateOutput.replace('k=1', 'k=unknown'),
    outputItem: f.outputItem,
    outputAdapter: f.adapter,
    outputRoutes: f.routes,
    outputEvidence: f.evidence,
    outputSettings: f.settings,
    outputSession: f.session,
  }
}

async function createBlockedTransportContext(t: TestContext) {
  const f = outputFixture(t),
    hooks = await createTransportHookResources()
  installProgressEvent(f.scope)
  f.scope.defineGlobal('unsafeWindow', { configurable: true, value: hooks.fakeWindow })
  f.scope.defineGlobal('location', {
    configurable: true,
    value: new URL('https://www.bilibili.com/video/BVtest/'),
  })
  await f.settings.update({
    catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map((host) => [host, false])),
  })
  const adapter = f.scope.own(
    new TransportAdapter(
      f.session,
      f.settings,
      f.routes,
      f.adapter,
      { willGateStartup: () => false, prepareStartup: async () => {}, noteUnpreflighted() {} },
      f.clock.now,
      createRuntimeIds(),
      undefined,
      f.clock.now,
    ),
  )
  adapter.install()
  const exceptionalForbidden = forbiddenUrl + '&os=mcdn',
    exceptionalXhr = new hooks.FakeXhr()
  exceptionalXhr.open('GET', exceptionalForbidden)
  exceptionalXhr.send()
  return {
    FakeXhr: hooks.FakeXhr,
    fakeWindow: hooks.fakeWindow,
    exceptionalForbidden,
    exceptionalXhr,
    forbiddenUrl,
    outputSettings: f.settings,
    get nativeFetchCalls() {
      return hooks.nativeFetchCalls
    },
  }
}

function createIntentContext(t: TestContext) {
  const scope = testScope(t),
    resources = createMutablePlaybackResources()
  let intentClock = 2_000_000_000_000,
    intentReloads = 0,
    activation = false
  let intentVideo = { ...resources.playerSnapshot, playbackRate: 1.5, effectiveRate: 1.5 }
  const deadPaused = {
    ...intentVideo,
    paused: true,
    readyState: 0,
    width: 0,
    height: 0,
    frames: 0,
    coreInitialized: false,
  }
  const intentTarget = { play: () => 'original-result' }
  const fakeWindow = { navigator: globalThis.navigator }
  scope.defineGlobal('unsafeWindow', { configurable: true, value: fakeWindow })
  return {
    scope,
    fakeWindow,
    intentTarget,
    deadPaused,
    recoveryPlayer: resources.recoveryPlayer,
    get intentClock() {
      return intentClock
    },
    set intentClock(v: number) {
      intentClock = v
    },
    get intentReloads() {
      return intentReloads
    },
    set intentReloads(v: number) {
      intentReloads = v
    },
    get intentVideo() {
      return intentVideo
    },
    set intentVideo(v: typeof intentVideo) {
      intentVideo = v
    },
    get activation() {
      return activation
    },
    set activation(v: boolean) {
      activation = v
    },
  }
}

async function checkPlayObserverInstalledOnFirstPausedTickNotThirtySecondsLater(
  t: TestContext,
): Promise<void> {
  const base = createIntentContext(t)

  const originalIntentPlay = base.intentTarget.play
  Object.defineProperty(base.fakeWindow, 'navigator', {
    configurable: true,
    value: {
      userActivation: {
        get isActive() {
          return base.activation
        },
      },
    },
  })
  class IntentAdapter extends PlayerAdapter {
    protected override player(): Record<string, unknown> {
      return base.intentTarget
    }
  }
  const intentAdapter = new IntentAdapter(
    { transform: () => playurlResult(false), lifecycleKey: () => 'test' },
    {
      scheduler: { timeout: () => () => undefined },
      isActuallyVisible: () => true,
      subscribeControlLoss: () => () => undefined,
    },
  )
  const intentRecovery = base.scope.own(
    new RecoveryController(
      currentResumePlayer({
        ...base.recoveryPlayer,
        observePlayIntent: (listener) => intentAdapter.observePlayIntent(listener),
        snapshot: () => base.intentVideo,
        reload: () => {
          base.intentReloads++
        },
        playbackRate: () => 1.5,
      }),
      () => base.intentClock,
    ),
  )
  intentRecovery.tick(base.intentVideo)
  base.intentVideo = { ...base.deadPaused }
  base.intentClock += 1000
  intentRecovery.tick(base.intentVideo)

  assert.ok(
    base.intentTarget.play !== originalIntentPlay,
    'play observer installed on first paused tick, not thirty seconds later',
  )
  base.intentClock += 31_000
  assert.strictEqual(
    base.intentTarget.play(),
    'original-result',
    'play observer preserves original return',
  )
  assert.strictEqual(intentRecovery.isRecovering(), false, 'untrusted play call never arms reload')
  base.activation = true
  base.intentTarget.play()
  assert.strictEqual(
    intentRecovery.isRecovering(),
    true,
    'trusted long-pause request arms intent while video stays paused',
  )
  for (let tick = 0; tick < 4; tick++) {
    base.intentClock += 1000
    intentRecovery.tick(base.intentVideo)
  }
  assert.strictEqual(base.intentReloads, 1, 'dead paused video with valid intent reloads once')
  base.intentClock += 1000
  intentRecovery.tick(base.intentVideo)
  assert.strictEqual(base.intentReloads, 1, 'repeated dead ticks cannot loop reload')
  intentRecovery.reset()
  assert.strictEqual(
    base.intentTarget.play,
    originalIntentPlay,
    'generation reset restores owned play method',
  )
}

async function checkColdNativeAudioUsesItsFullSignedURL(t: TestContext): Promise<void> {
  const f = fixture(testScope(t))
  await f.settings.update({ considerNativeSources: true })
  const base = {
    outputAdapter: f.adapter,
    outputSession: f.session,
    outputRoutes: f.routes,
    outputVault: f.vault,
  }
  const nativeAudioUrl =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/test/output/audio.m4s?s=exact'
  const audioItem = {
    id: 30280,
    base_url: nativeAudioUrl,
    backup_url: [],
    bandwidth: 100_000,
  }
  const videoUrl = media('native-audio-isolation', 'video.m4s')
  const video = dash(videoUrl).data.dash.video
  assert.equal(
    base.outputAdapter.transform({ data: { dash: { video, audio: [audioItem] } } }).accepted,
    true,
  )
  await finish(f, start(f, videoUrl, 1))
  await finish(f, start(f, videoUrl, 2))
  const beforeAudioAffinity = base.outputSession.get().affinity
  assert.ok(beforeAudioAffinity, 'audio isolation is checked against an established video affinity')
  const nativeAudioApplied = base.outputRoutes.apply(nativeAudioUrl)

  assert.strictEqual(
    nativeAudioApplied.url,
    nativeAudioUrl,
    'cold Native audio preserves its full signed URL',
  )
  assert.strictEqual(
    nativeAudioApplied.decision.routeType,
    'root-original',
    'cold-start signed original remains unchanged before preflight',
  )
  assert.strictEqual(
    base.outputSession.get().affinity,
    beforeAudioAffinity,
    'audio original request does not alter video affinity',
  )
  assert.ok(nativeAudioApplied.context)
  const audioRep = nativeAudioApplied.context.representation
  assert.ok(
    base.outputVault.outputRole(audioRep, nativeAudioUrl),
    'the signed source has an output role before invalidation',
  )
  base.outputVault.invalidate(audioRep, new URL(nativeAudioUrl).host)
  assert.ok(
    base.outputRoutes.apply(nativeAudioUrl).url !== nativeAudioUrl,
    'invalid Native cannot return through existing backup role',
  )
  const repeatAudio = {
    id: 30280,
    base_url: nativeAudioUrl,
    backup_url: [nativeAudioUrl],
    bandwidth: 100_000,
  }
  base.outputAdapter.transform({ data: { dash: { video, audio: [repeatAudio] } } })
  assert.ok(
    ![repeatAudio.base_url, ...repeatAudio.backup_url].includes(nativeAudioUrl),
    'invalid Native is removed from refreshed player outputs',
  )
}

async function checkBlockedTransport(t: TestContext): Promise<void> {
  const base = await createBlockedTransportContext(t)

  assert.strictEqual(
    base.exceptionalXhr.nativeSends,
    0,
    'XHR does not send default-unavailable PCDN-marked media',
  )
  const fetchCountBeforeBlock = base.nativeFetchCalls
  let fetchBlocked = false
  try {
    await base.fakeWindow.fetch(base.forbiddenUrl)
  } catch {
    fetchBlocked = true
  }
  assert.ok(fetchBlocked, 'no-alternative Fetch rejects locally')
  assert.strictEqual(
    base.nativeFetchCalls,
    fetchCountBeforeBlock,
    'blocked Fetch sends no native request',
  )
  let exceptionalFetchBlocked = false
  try {
    await base.fakeWindow.fetch(base.exceptionalForbidden)
  } catch {
    exceptionalFetchBlocked = true
  }
  assert.ok(exceptionalFetchBlocked, 'Fetch does not send default-unavailable PCDN-marked media')
  assert.strictEqual(
    base.nativeFetchCalls,
    fetchCountBeforeBlock,
    'exceptional Fetch does not reach native transport',
  )
  await base.outputSettings.update({ disabled: true })
  const enabledAfterOpen = new base.FakeXhr()
  enabledAfterOpen.open('GET', base.forbiddenUrl)
  await base.outputSettings.update({ disabled: false })
  enabledAfterOpen.send()
  assert.strictEqual(
    enabledAfterOpen.nativeSends,
    0,
    'XHR opened while disabled rechecks restriction when enabled before send',
  )
  await base.outputSettings.update({ disabled: true })
  const disabledXhr = new base.FakeXhr()
  disabledXhr.open('GET', base.forbiddenUrl)
  disabledXhr.send()
  assert.strictEqual(
    disabledXhr.url,
    base.forbiddenUrl,
    'disabled adapter preserves website original request',
  )
  assert.strictEqual(disabledXhr.nativeSends, 1, 'disabled adapter sends website request once')
}

async function checkFallbackObservation(t: TestContext): Promise<void> {
  const base = await createFallbackObservationContext(t)

  assert.ok(
    base.outputRoutes.apply(base.unknownQuery).decision.reason !== 'player-fallback',
    'weak query match is not a backup capability',
  )
  await base.outputEvidence.record(TRUSTED_CATALOG[0], 'video', {
    requestId: 'fresh-challenger',
    at: base.now,
    source: 'transport',
    outcome: 'success',
    throughputMbps: 10,
    ttfbMs: 1,
    failureKind: null,
  })
  const challenger = base.outputRoutes.challenge(
    base.outputRep,
    { kind: 'video', requiredMbps: 3, highDemand: false },
    false,
  )
  assert.ok(challenger, 'automatic routing reaches an eligible challenger')
  assert.notEqual(
    challenger.decision.host,
    TRUSTED_CATALOG[1],
    'default-unavailable cosov is excluded',
  )
  assert.notEqual(
    challenger.decision.host,
    TRUSTED_CATALOG[0],
    'fresh evidence is not immediately re-probed',
  )
  const beforeGeneration = base.outputSession.get()
  await base.outputRoutes.observe({
    ...base.healthyObservation,
    generation: beforeGeneration.generation,
    epoch: beforeGeneration.epoch,
    representation: base.outputRep,
    originalHost: base.forbiddenUrl,
    targetHost: TRUSTED_CATALOG[2],
    finalHost: TRUSTED_CATALOG[2],
    completedAt: base.now,
    decisionId: base.fallbackApplied.decision.id,
  })
  const savedSuccess = structuredClone(base.outputEvidence.get(TRUSTED_CATALOG[2], 'video'))
  assert.ok(savedSuccess)
  assert.ok(
    savedSuccess.samples.some(
      (sample) =>
        sample.requestId ===
          `${Number(beforeGeneration.generation)}:${Number(beforeGeneration.epoch)}:${base.now}:${TRUSTED_CATALOG[2]}` &&
        sample.outcome === 'success' &&
        sample.bytes === base.healthyObservation.bytes &&
        sample.throughputMbps === 8 &&
        sample.at === base.now,
    ),
    'the exact successful transfer was persisted before abort',
  )
  await base.outputRoutes.observe({
    ...base.healthyObservation,
    generation: beforeGeneration.generation,
    epoch: beforeGeneration.epoch,
    representation: base.outputRep,
    targetHost: TRUSTED_CATALOG[2],
    finalHost: null,
    outcome: 'abort',
    status: 0,
    completedAt: base.now + 1,
  })
  assert.deepEqual(
    base.outputEvidence.get(TRUSTED_CATALOG[2], 'video'),
    savedSuccess,
    'abort does not change the successfully committed health evidence',
  )
  await base.outputRoutes.observe({
    ...base.healthyObservation,
    generation: beforeGeneration.generation,
    epoch: beforeGeneration.epoch,
    representation: base.outputRep,
    targetHost: TRUSTED_CATALOG[3],
    finalHost: null,
    outcome: 'failure',
    failureKind: 'network',
    status: 0,
    completedAt: base.now + 2,
  })
  assert.ok(
    base.outputEvidence.get(TRUSTED_CATALOG[3], 'video')?.circuitUntil! > base.now,
    'no-response network failure still attributed to sent target',
  )
  await base.outputSettings.update({
    catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map((host) => [host, false])),
  })
  base.outputRoutes.invalidateForUserSetting()
  assert.strictEqual(
    base.outputRoutes.apply(base.forbiddenUrl).url,
    null,
    'no legal alternative blocks forbidden source',
  )
  const noOutput = {
    ...base.outputItem,
    base_url: base.forbiddenUrl,
    backup_url: [base.forbiddenUrl],
  }
  base.outputAdapter.transform({ data: { dash: { video: [noOutput], audio: [] } } })
  assert.strictEqual(noOutput.base_url, '', 'blocked playurl does not leak original primary')
  assert.strictEqual(noOutput.backup_url.length, 0, 'blocked playurl does not leak original backup')
}

test('weak query match is not a backup capability [13]', { timeout: 5000 }, async (t) => {
  await checkFallbackObservation(t)
})

test(
  'XHR does not send default-unavailable PCDN-marked media [15]',
  { timeout: 5000 },
  async (t) => {
    await checkBlockedTransport(t)
  },
)

test(
  'play observer installed on first paused tick, not thirty seconds later [16]',
  { timeout: 5000 },
  async (t) => {
    await checkPlayObserverInstalledOnFirstPausedTickNotThirtySecondsLater(t)
  },
)

test(
  'cold Native audio preserves its signed URL and invalidation [17]',
  { timeout: 5000 },
  async (t) => {
    await checkColdNativeAudioUsesItsFullSignedURL(t)
  },
)
