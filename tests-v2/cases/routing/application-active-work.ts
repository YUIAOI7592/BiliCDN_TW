import { stubChallengeRoutes } from '../../support/challenge.ts'
import { createMutablePlaybackResources, currentResumePlayer } from '../../support/player.ts'
import { CatalogSettingsStore } from '../../support/catalog-settings.ts'
import { FakeClock } from '../../support/clock.ts'
import { deferred, countdown } from '../../support/deferred.ts'
import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import {
  measurementRoutes,
  monitorRoutes,
  monitorMeasurement,
  monitorRecovery,
} from '../../support/controllers.ts'
import { RangeProbeAdapter } from '../../../src-v2/adapters/transport/range-probe.ts'
import { MeasurementMetaStore } from '../../../src-v2/state/measurement-meta-store.ts'
import {
  decisionId,
  epochId,
  generationId,
  representationId,
} from '../../../src-v2/domain/model.ts'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import { type AppliedRouteDecision } from '../../../src-v2/application/routing/route-contracts.ts'
import { RecoveryController } from '../../../src-v2/application/playback/recovery-controller.ts'
import { MeasurementController } from '../../../src-v2/application/measurement/measurement-controller.ts'
import { PlayerMonitor } from '../../../src-v2/application/playback/player-monitor.ts'
import {
  type PlayerPort,
  type VideoSnapshot,
} from '../../../src-v2/application/playback/player-contracts.ts'
import { FakeStorage } from '../../support/storage.ts'
import { testScope } from '../../support/scope.ts'
import { BrowserScheduler } from '../../../src-v2/adapters/scheduler.ts'
import { fixture } from './routing-fixture.ts'

const startupRoot = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/startup/video.m4s?k=1'
const directRangeResponse = (url: string, bytes: number): Response => {
  const response = new Response(new Uint8Array(bytes), { status: 206 })
  Object.defineProperty(response, 'url', { value: url })
  return response
}

function startupFixture(t: TestContext) {
  const scope = testScope(t),
    f = fixture(scope),
    now = f.clock.now()
  const startupGeneration = f.session.get()
  const startupRep = f.vault.register({
    generation: startupGeneration.generation,
    epoch: startupGeneration.epoch,
    kind: 'video',
    key: 'startup:80',
    height: 1080,
    codec: 'av1',
    bandwidth: 3_000_000,
    urls: [startupRoot],
    source: 'trusted-api',
  })
  assert.ok(startupRep)
  return { scope, f, now, startupGeneration, startupRep }
}

function disabledStartupFixture(t: TestContext) {
  const { scope, f, now, startupGeneration, startupRep } = startupFixture(t)
  const { recoveryPlayer, playerSnapshot } = createMutablePlaybackResources()
  let stallNow = now,
    startupReloads = 0
  const deadStartup: VideoSnapshot = {
    ...playerSnapshot,
    currentTime: 0,
    readyState: 0,
    width: 0,
    height: 0,
    frames: 0,
    bufferAheadSec: 0,
    playableBufferSec: 0,
    coreInitialized: false,
    paused: false,
  }
  let originalProbeDisabled = false,
    originalRecoveryTicks = 0,
    originalFallbacks = 0
  const originalMonitor = scope.own(
    new PlayerMonitor(
      { ...recoveryPlayer, snapshot: () => deadStartup, syncManifest: () => true },
      f.session,
      { get: () => ({ disabled: true }) },
      f.vault,
      monitorRoutes({
        observePlaybackRate: () => undefined,
        firstMediaAt: () => now,
        latestRequested: () => ({
          routePolicyRevision: 0,
          targetHost: 'upos-sz-mirrorali.bilivideo.com',
          representation: startupRep,
          generation: startupGeneration.generation,
          epoch: startupGeneration.epoch,
        }),
        recoverStartup: () => {
          originalFallbacks++
          return null
        },
        recover: () => {
          originalFallbacks++
          return null
        },
      }),
      monitorMeasurement({
        tick: (input: { disabled: boolean }) => {
          originalProbeDisabled = input.disabled
        },
      }),
      monitorRecovery({
        tick: () => {
          originalRecoveryTicks++
        },
        isRecovering: () => false,
      }),
      () => true,
      () => now + 16_000,
      new BrowserScheduler(),
      undefined,
      () => now + 16_000,
    ),
  )
  for (let i = 0; i < 17; i++) originalMonitor.tick()
  return {
    scope,
    now,
    recoveryPlayer,
    deadStartup,
    startupRep,
    startupGeneration,
    startupSession: f.session,
    startupVault: f.vault,
    originalProbeDisabled,
    originalRecoveryTicks,
    originalFallbacks,
    get stallNow() {
      return stallNow
    },
    set stallNow(value: number) {
      stallNow = value
    },
    get startupReloads() {
      return startupReloads
    },
    set startupReloads(value: number) {
      startupReloads = value
    },
  }
}

async function healthyProbeFixture(t: TestContext) {
  const scope = testScope(t),
    now = 2_000_000_000_000
  const challengeDone = countdown(3),
    redirectDone = countdown(3),
    mismatchedDone = countdown(3),
    missingDone = countdown(3)
  let challengeCalls = 0
  let challengeFetches = 0
  let challengeRecords = 0
  const challengeApplied: AppliedRouteDecision = {
    decision: {
      action: 'rewrite',
      id: decisionId('challenge'),
      reason: 'test',
      routeType: 'catalog-generated',
      host: TRUSTED_CATALOG[1],
      candidate: {
        type: 'catalog-generated',
        host: TRUSTED_CATALOG[1],
        kind: 'video',
      },
      ranking: [],
    },
    url: `https://${TRUSTED_CATALOG[1]}/upgcxcode/a/b/challenge.m4s`,
    context: {
      generation: generationId(1),
      epoch: epochId(1),
      representation: representationId('video:test'),
      kind: 'video',
      authorityRevision: 1,
    },
    streamKey: 'challenge',
    sourceHost: TRUSTED_CATALOG[0],
  }
  const challengeRoutes = {
    isCatalogOnly: () => false,
    ...stubChallengeRoutes(() => {
      challengeCalls++
      return challengeApplied
    }),
    recordChallenge: async () => {
      challengeRecords++
      challengeDone.complete()
    },
  }
  const challengeFetch = async (): Promise<Response> => {
    challengeFetches++
    return directRangeResponse(challengeApplied.url ?? '', 70 * 1024)
  }
  const measurement = scope.own(
    new MeasurementController(
      measurementRoutes(challengeRoutes),
      new MeasurementMetaStore(new FakeStorage(), () => now),
      new RangeProbeAdapter(challengeFetch as typeof fetch, () => now),
      () => now,
      new BrowserScheduler(),
      undefined,
      undefined,
      undefined,
      () => now,
    ),
  )
  const baseMeasurement = {
    generationActive: true,
    representation: representationId('video:test'),
    demand: { kind: 'video' as const, requiredMbps: 8, highDemand: false },
    stableProgressTicks: 20,
    stableProgressMs: 20_000,
    progressObservation: 'progress' as const,
    playableBufferSec: 29,
    visible: true,
    seeking: false,
    recovering: false,
    disabled: false,
  }
  measurement.tick(baseMeasurement)
  assert.deepEqual(
    [challengeCalls, challengeFetches, challengeRecords],
    [0, 0, 0],
    '29 seconds of playable buffer starts no work',
  )
  measurement.tick({ ...baseMeasurement, playableBufferSec: 30 })
  await challengeDone.promise
  return {
    scope,
    now,
    baseMeasurement,
    challengeApplied,
    challengeCalls,
    challengeFetches,
    challengeRecords,
    redirectDone,
    mismatchedDone,
    missingDone,
  }
}

async function startupProbeFixture(t: TestContext) {
  const { scope, f, now } = startupFixture(t)
  await f.settings.update({ considerNativeSources: true })
  const preflightOptions = f.routes.startupOptions(startupRoot)
  assert.ok(preflightOptions)
  assert.equal(preflightOptions.candidates.length, 3)
  assert.ok(preflightOptions.candidates.some((candidate) => candidate.type === 'catalog-generated'))
  return { scope, now, preflightOptions, startupRoot, directRangeResponse }
}

async function checkAlreadyAbortedPlayerRequestRejectsStartupGate10(t: TestContext): Promise<void> {
  const base = await startupProbeFixture(t)
  const preflightSettings = base.scope.own(
    new CatalogSettingsStore(new FakeStorage(), () => base.now),
  )
  const preflightOptions = base.preflightOptions
  assert.ok(preflightOptions)

  if (preflightOptions) {
    let preflightFetches = 0,
      committedHost: string | null = null,
      startupSamples = 0
    const preflightRoutes = {
      isCatalogOnly: () => false,
      startupOptions: () => preflightOptions,
      commitStartupChoice: (_url: string, candidate: { host: string } | null) => {
        committedHost = candidate?.host ?? null
        return candidate ? { host: candidate.host } : null
      },
      recordStartupSuccess: async () => {
        startupSamples++
      },
      noteStartupProbeResult: () => undefined,
    }
    const preflightFetch = async (input: RequestInfo | URL): Promise<Response> => {
      preflightFetches++
      const host = new URL(String(input)).host
      const length =
        host ===
        preflightOptions.candidates.find((candidate) => candidate.type === 'catalog-generated')
          ?.host
          ? 256 * 1024
          : 70 * 1024
      return base.directRangeResponse(String(input), length)
    }
    const preflight = base.scope.own(
      new MeasurementController(
        measurementRoutes(preflightRoutes),
        new MeasurementMetaStore(new FakeStorage(), () => base.now),
        new RangeProbeAdapter(
          preflightFetch as typeof fetch,
          (() => {
            let tick = 0
            return () => tick++
          })(),
        ),
        () => base.now,
        new BrowserScheduler(),
        undefined,
        undefined,
        preflightSettings,
        () => base.now,
      ),
    )
    const abortedStartup = new AbortController()
    abortedStartup.abort()
    let abortRejected = false
    try {
      await preflight.prepareStartup(base.startupRoot, abortedStartup.signal)
    } catch {
      abortRejected = true
    }
    assert.strictEqual(abortRejected, true, 'already-aborted player request rejects startup gate')
    assert.strictEqual(preflightFetches, 0, 'already-aborted player request starts no probe')
    await preflight.prepareStartup(base.startupRoot)
    assert.strictEqual(
      committedHost,
      preflightOptions.candidates[0]?.host,
      'first qualified candidate releases bounded preflight',
    )
    assert.strictEqual(
      preflightFetches,
      preflightOptions.candidates.length,
      'cold window probes no more than three distinct routes',
    )
    assert.ok(startupSamples > 0, 'valid full startup sample contributes to later evidence')
    await preflight.prepareStartup(base.startupRoot)
    assert.strictEqual(
      preflightFetches,
      preflightOptions.candidates.length,
      'startup preflight runs only once per tab',
    )
    const timeoutRoutes = {
      ...preflightRoutes,
      commitStartupChoice: (_url: string, candidate: { host: string } | null) => {
        committedHost = candidate?.host ?? null
        return candidate ? { host: candidate.host } : null
      },
    }
    let hangingProbes = 0
    const probesStarted = deferred<void>(),
      deadlineClock = base.scope.own(new FakeClock())
    const hangingFetch = async (
      _input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      hangingProbes++
      if (hangingProbes === preflightOptions.candidates.length) probesStarted.resolve()
      return await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        )
      })
    }
    committedHost = null
    const timedPreflight = base.scope.own(
      new MeasurementController(
        measurementRoutes(timeoutRoutes),
        new MeasurementMetaStore(new FakeStorage(), () => base.now),
        new RangeProbeAdapter(hangingFetch as typeof fetch, deadlineClock.now),
        deadlineClock.now,
        deadlineClock,
        undefined,
        undefined,
        undefined,
        deadlineClock.now,
      ),
    )
    let gateSettled = false
    const pendingGate = timedPreflight.prepareStartup(base.startupRoot).then(() => {
      gateSettled = true
    })
    await probesStarted.promise
    deadlineClock.advance(2999)
    await Promise.resolve()
    assert.strictEqual(gateSettled, false, 'startup remains pending at 2999 ms')
    deadlineClock.advance(1)
    await pendingGate
    assert.strictEqual(gateSettled, true, 'startup completes at 3000 ms')
    assert.strictEqual(
      deadlineClock.now(),
      2_000_000_003_000,
      'cold preflight releases a hanging player request within the three-second window',
    )
    assert.strictEqual(
      hangingProbes,
      preflightOptions.candidates.length,
      'startup deadline bounds all parallel probes in one window',
    )
    assert.strictEqual(
      committedHost,
      null,
      'inconclusive window without an untested candidate never selects a tested failure',
    )
    const cachedHost = preflightOptions.candidates.find(
      (candidate) => candidate.type === 'catalog-generated',
    )?.host
    const cachedOptions = {
      ...preflightOptions,
      candidates: preflightOptions.candidates.map((candidate) =>
        candidate.host === cachedHost ? { ...candidate, cachedSafeMbps: 1000 } : candidate,
      ),
    }
    const ranges = new Map<string, string>()
    const compatibilityFetch = async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      const host = new URL(String(input)).host
      ranges.set(host, String((init?.headers as Record<string, string> | undefined)?.Range ?? ''))
      return base.directRangeResponse(String(input), host === cachedHost ? 16 * 1024 : 70 * 1024)
    }
    const cachedPreflight = base.scope.own(
      new MeasurementController(
        measurementRoutes({ ...preflightRoutes, startupOptions: () => cachedOptions }),
        new MeasurementMetaStore(new FakeStorage(), () => base.now),
        new RangeProbeAdapter(compatibilityFetch as typeof fetch, () => base.now),
        () => base.now,
        new BrowserScheduler(),
        undefined,
        undefined,
        undefined,
        () => base.now,
      ),
    )
    await cachedPreflight.prepareStartup(base.startupRoot)
    assert.strictEqual(
      ranges.get(cachedHost ?? ''),
      'bytes=0-16383',
      'cross-tab Catalog evidence requires only a 16 KiB current-URL compatibility range',
    )
    assert.strictEqual(
      committedHost,
      cachedHost,
      'compatible recent Catalog sample can win without redownloading a full throughput sample',
    )
    let startupRedirectMode: RequestRedirect | undefined,
      redirectStartupSamples = 0
    const redirectStartup = base.scope.own(
      new MeasurementController(
        measurementRoutes({
          ...preflightRoutes,
          recordStartupSuccess: async () => {
            redirectStartupSamples++
          },
        }),
        new MeasurementMetaStore(new FakeStorage(), () => base.now),
        new RangeProbeAdapter(
          (async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            startupRedirectMode = init?.redirect
            if (init?.redirect === 'error') throw new TypeError('redirect refused')
            return new Response(new Uint8Array(70 * 1024), { status: 206 })
          }) as typeof fetch,
          () => base.now,
        ),
        () => base.now,
        new BrowserScheduler(),
        undefined,
        undefined,
        undefined,
        () => base.now,
      ),
    )
    await redirectStartup.prepareStartup(base.startupRoot)
    assert.strictEqual(startupRedirectMode, 'error', 'startup probes forbid HTTP redirects')
    assert.strictEqual(
      redirectStartupSamples,
      0,
      'redirected startup probes create no throughput evidence',
    )
    assert.strictEqual(
      committedHost,
      null,
      'redirected startup without an untested fallback cannot select a failed original',
    )
    const wrongHostStartup = base.scope.own(
      new MeasurementController(
        measurementRoutes({
          ...preflightRoutes,
          recordStartupSuccess: async () => {
            redirectStartupSamples++
          },
        }),
        new MeasurementMetaStore(new FakeStorage(), () => base.now),
        new RangeProbeAdapter(
          (async (): Promise<Response> => {
            const response = new Response(new Uint8Array(70 * 1024), { status: 206 })
            Object.defineProperty(response, 'url', {
              value: 'https://upos-sz-mirrorhwov.bilivideo.com/upgcxcode/a/b/redirected.m4s',
            })
            return response
          }) as typeof fetch,
          () => base.now,
        ),
        () => base.now,
        new BrowserScheduler(),
        undefined,
        undefined,
        undefined,
        () => base.now,
      ),
    )
    await wrongHostStartup.prepareStartup(base.startupRoot)
    assert.strictEqual(
      redirectStartupSamples,
      0,
      'mismatched startup response host creates no throughput evidence',
    )
  }
}

async function checkSafePlaybackConsidersUpToThreeFairChallengers9(t: TestContext): Promise<void> {
  const base = await healthyProbeFixture(t)

  assert.strictEqual(base.challengeCalls, 3, 'safe playback considers up to three fair challengers')
  assert.strictEqual(base.challengeFetches, 3, 'each safe challenger performs one bounded request')
  assert.strictEqual(base.challengeRecords, 3, 'each valid challenger updates evidence once')
  let challengeRedirectSetting: RequestRedirect | undefined
  const redirectChallengeFetch = async (
    _input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    challengeRedirectSetting = init?.redirect
    if (init?.redirect === 'error') throw new TypeError('redirect refused')
    return new Response(new Uint8Array(70 * 1024), { status: 206 })
  }
  let redirectedChallengeSamples = 0
  const redirectChallengeRoutes = {
    isCatalogOnly: () => false,
    ...stubChallengeRoutes(() => base.challengeApplied),
    recordChallenge: async (
      _route: unknown,
      _bytes: number,
      _elapsed: number,
      _ttfb: number | null,
      outcome: string,
    ) => {
      if (outcome === 'success') redirectedChallengeSamples++
      base.redirectDone.complete()
    },
  }
  const redirectChallenge = base.scope.own(
    new MeasurementController(
      measurementRoutes(redirectChallengeRoutes),
      new MeasurementMetaStore(new FakeStorage(), () => base.now),
      new RangeProbeAdapter(redirectChallengeFetch as typeof fetch, () => base.now),
      () => base.now,
      new BrowserScheduler(),
      undefined,
      undefined,
      undefined,
      () => base.now,
    ),
  )
  redirectChallenge.tick({ ...base.baseMeasurement, playableBufferSec: 30 })
  await base.redirectDone.promise
  assert.strictEqual(challengeRedirectSetting, 'error', 'healthy challenge forbids HTTP redirects')
  assert.strictEqual(redirectedChallengeSamples, 0, 'redirected challenge cannot add host evidence')
  const redirectedResponse = new Response(new Uint8Array(70 * 1024), { status: 206 })
  Object.defineProperty(redirectedResponse, 'url', {
    value: 'https://upos-sz-mirrorhwov.bilivideo.com/upgcxcode/a/b/redirected.m4s',
  })
  let mismatchedChallengeSuccesses = 0
  const mismatchedChallenge = base.scope.own(
    new MeasurementController(
      measurementRoutes({
        isCatalogOnly: () => false,
        ...stubChallengeRoutes(() => base.challengeApplied),
        recordChallenge: async (
          _route: unknown,
          _bytes: number,
          _elapsed: number,
          _ttfb: number | null,
          outcome: string,
        ) => {
          if (outcome === 'success') mismatchedChallengeSuccesses++
          base.mismatchedDone.complete()
        },
      }),
      new MeasurementMetaStore(new FakeStorage(), () => base.now),
      new RangeProbeAdapter((async () => redirectedResponse) as typeof fetch, () => base.now),
      () => base.now,
      new BrowserScheduler(),
      undefined,
      undefined,
      undefined,
      () => base.now,
    ),
  )
  mismatchedChallenge.tick({ ...base.baseMeasurement, playableBufferSec: 30 })
  await base.mismatchedDone.promise
  assert.strictEqual(
    mismatchedChallengeSuccesses,
    0,
    'a mismatched response host cannot be credited to the challenged host',
  )
  const missingHostChallenge = base.scope.own(
    new MeasurementController(
      measurementRoutes({
        isCatalogOnly: () => false,
        ...stubChallengeRoutes(() => base.challengeApplied),
        recordChallenge: async (
          _route: unknown,
          _bytes: number,
          _elapsed: number,
          _ttfb: number | null,
          outcome: string,
        ) => {
          if (outcome === 'success') mismatchedChallengeSuccesses++
          base.missingDone.complete()
        },
      }),
      new MeasurementMetaStore(new FakeStorage(), () => base.now),
      new RangeProbeAdapter(
        (async () => new Response(new Uint8Array(70 * 1024), { status: 206 })) as typeof fetch,
        () => base.now,
      ),
      () => base.now,
      new BrowserScheduler(),
      undefined,
      undefined,
      undefined,
      () => base.now,
    ),
  )
  missingHostChallenge.tick({ ...base.baseMeasurement, playableBufferSec: 30 })
  await base.missingDone.promise
  assert.strictEqual(
    mismatchedChallengeSuccesses,
    0,
    'a response with no verifiable host cannot create probe evidence',
  )
}

async function checkDisabledModeNeitherProbesNorInitiatesScriptRouteCoreRecovery(
  t: TestContext,
): Promise<void> {
  const base = disabledStartupFixture(t)

  assert.ok(
    base.originalProbeDisabled && base.originalRecoveryTicks === 0 && base.originalFallbacks === 0,
    'disabled mode neither probes nor initiates script route/core recovery',
  )
  const startupRecovery = base.scope.own(
    new RecoveryController(
      currentResumePlayer({
        ...base.recoveryPlayer,
        snapshot: () => base.deadStartup,
        reload: () => {
          base.startupReloads++
        },
        currentTime: () => 0,
        playbackRate: () => 1,
      } satisfies PlayerPort),
      () => base.stallNow,
    ),
  )
  startupRecovery.armStartupFailure(base.deadStartup)
  base.stallNow += 4000
  startupRecovery.tick(base.deadStartup)
  assert.strictEqual(
    base.startupReloads,
    1,
    'cold-start dead core reloads once despite no prior healthy frames',
  )
  base.stallNow += 4000
  startupRecovery.tick(base.deadStartup)
  assert.strictEqual(base.startupReloads, 1, 'startup recovery does not loop reload')
  let softFallbacks = 0,
    startupArms = 0
  const stallMonitor = base.scope.own(
    new PlayerMonitor(
      {
        ...base.recoveryPlayer,
        snapshot: () => base.deadStartup,
        syncManifest: () => true,
      } satisfies PlayerPort,
      base.startupSession,
      base.scope.own(new CatalogSettingsStore(new FakeStorage(), () => base.stallNow)),
      base.startupVault,
      monitorRoutes({
        recoveryEligible: () => true,
        firstMediaAt: () => base.now,
        latestRequested: () => ({
          routePolicyRevision: 0,
          targetHost: 'upos-sz-mirrorali.bilivideo.com',
          representation: base.startupRep,
          generation: base.startupGeneration.generation,
          epoch: base.startupGeneration.epoch,
        }),
        recoverStartup: () => {
          softFallbacks++
          return { host: TRUSTED_CATALOG[0] }
        },
        observePlaybackRate: () => undefined,
      }),
      monitorMeasurement({ tick: () => undefined }),
      monitorRecovery({
        tick: () => undefined,
        isRecovering: () => false,
        armStartupFailure: () => {
          startupArms++
        },
      }),
      () => true,
      () => base.stallNow,
      new BrowserScheduler(),
      undefined,
      () => base.stallNow,
    ),
  )
  base.stallNow = base.now + 14_000
  stallMonitor.tick()
  assert.strictEqual(softFallbacks, 0, 'unconfirmed startup stall waits fifteen seconds')
  base.stallNow = base.now + 15_000
  stallMonitor.tick()
  assert.strictEqual(softFallbacks, 1, 'unconfirmed startup stall submits one different route')
  assert.strictEqual(startupArms, 1, 'unconfirmed startup stall arms bounded player recovery')
  base.stallNow = base.now + 16_000
  stallMonitor.tick()
  assert.strictEqual(softFallbacks, 1, 'startup stall fallback is not repeated each tick')
}

test(
  'disabled mode neither probes nor initiates script route/core recovery [8]',
  { timeout: 5000 },
  async (t) => {
    await checkDisabledModeNeitherProbesNorInitiatesScriptRouteCoreRecovery(t)
  },
)

test('safe playback considers up to three fair challengers [9]', { timeout: 5000 }, async (t) => {
  await checkSafePlaybackConsidersUpToThreeFairChallengers9(t)
})

test('already-aborted player request rejects startup gate [10]', { timeout: 5000 }, async (t) => {
  await checkAlreadyAbortedPlayerRequestRejectsStartupGate10(t)
})
