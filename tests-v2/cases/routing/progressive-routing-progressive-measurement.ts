import { CatalogSettingsStore } from '../../support/catalog-settings.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { type TestContext } from 'node:test'
import { RuntimeController } from '../../../src-v2/application/runtime-controller.ts'
import { RouteCoordinator } from '../../../src-v2/application/routing/route-coordinator.ts'
import { MeasurementController } from '../../../src-v2/application/measurement/measurement-controller.ts'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import { parseMediaUrl } from '../../../src-v2/domain/url-policy.ts'
import { SignedRouteVault } from '../../../src-v2/state/signed-route-vault.ts'
import { SessionStore } from '../../../src-v2/state/session-store.ts'
import { RestrictionStore } from '../../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../../src-v2/state/evidence-store.ts'
import { MeasurementMetaStore } from '../../../src-v2/state/measurement-meta-store.ts'
import { FakeStorage } from '../../support/storage.ts'
import { testScope } from '../../support/scope.ts'
import { FakeClock } from '../../support/clock.ts'
import { measurementRoutes } from '../../support/controllers.ts'
import { createRoutingResources } from './progressive-routing-resources.ts'

async function createFixedCatalogChangeCancelsAPendingStartupProbe6Context5(t: TestContext) {
  const resources = await createRoutingResources(t)
  const { settings, routes, scope } = resources

  let measurementResets = 0
  let recoveryResets = 0
  const runtime = new RuntimeController(
    settings,
    routes,
    {
      snapshot: () => {
        throw new Error('snapshot should not be called')
      },
      reset: () => undefined,
    },
    {
      start: () => undefined,
      stop: () => undefined,
      reset: () => undefined,
      subscribe: () => () => undefined,
    },
    {
      reset: () => {
        measurementResets++
      },
    },
    {
      reset: () => {
        recoveryResets++
      },
      armRouteFailure: () => undefined,
    },
    { setEnabled: () => undefined },
    { subscribeEpoch: () => () => undefined },
  )
  runtime.install()
  scope.defer(() => runtime.dispose())
  await settings.update({ fixedHost: TRUSTED_CATALOG[4] })
  return {
    get measurementResets() {
      return measurementResets
    },
    get recoveryResets() {
      return recoveryResets
    },
    scope,
    settings,
  }
}

async function createCatalogSourceHandleResolvesExactCurrentEpochPCDNSource7Context6(
  t: TestContext,
) {
  const scope = testScope(t)
  const now = 2_000_000_000_000
  const demand = { kind: 'video' as const, requiredMbps: 4, highDemand: false }
  const pcdnStorage = new FakeStorage()
  const pcdnSettings = scope.own(new CatalogSettingsStore(pcdnStorage, () => now))
  const pcdnSession = new SessionStore()
  const pcdnState = pcdnSession.beginGeneration(false)
  const pcdnVault = new SignedRouteVault()
  pcdnVault.reset(pcdnState.generation, pcdnState.epoch)
  const pcdnRestrictions = scope.own(new RestrictionStore(pcdnStorage, () => now))
  const pcdnRoutes = new RouteCoordinator(
    { now: () => now, monotonicNow: () => now },
    pcdnSession,
    pcdnSettings,
    pcdnRestrictions,
    scope.own(new EvidenceStore(pcdnStorage, () => now)),
    pcdnVault,
    createRuntimeIds(),
  )
  const pcdnSource =
    'https://upos-pc.mcdn.bilivideo.com/upgcxcode/progressive/pcdn-source.mp4?token=pcdn'
  const pcdnRep = pcdnVault.register({
    generation: pcdnState.generation,
    epoch: pcdnState.epoch,
    kind: 'video',
    key: 'durl:q80:pcdn',
    height: 0,
    codec: 'mp4',
    bandwidth: 0,
    urls: [pcdnSource],
    source: 'trusted-api',
  })
  return {
    demand,
    now,
    pcdnRep,
    pcdnRestrictions,
    pcdnRoutes,
    pcdnSettings,
    pcdnSource,
    pcdnVault,
  }
}

async function createMeasurementFixtureHasTwoIndependentProgressiveSegments8Context7(
  t: TestContext,
) {
  const scope = testScope(t)
  const probeClock = scope.own(new FakeClock())
  const probeStorage = new FakeStorage()
  const probeSettings = scope.own(new CatalogSettingsStore(probeStorage, probeClock.now))
  const probeSession = new SessionStore()
  const probeState = probeSession.beginGeneration(false)
  const probeVault = new SignedRouteVault()
  probeVault.reset(probeState.generation, probeState.epoch)
  const probeRoutes = new RouteCoordinator(
    { now: probeClock.now, monotonicNow: probeClock.now },
    probeSession,
    probeSettings,
    scope.own(new RestrictionStore(probeStorage, probeClock.now)),
    scope.own(new EvidenceStore(probeStorage, probeClock.now)),
    probeVault,
    createRuntimeIds(),
  )
  const probeFirst =
    'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/progressive/probe-1.mp4?segment=1'
  const probeSecond =
    'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/progressive/probe-2.mp4?segment=2'
  const probeRep1 = probeVault.register({
    generation: probeState.generation,
    epoch: probeState.epoch,
    kind: 'video',
    key: 'durl:probe:0',
    height: 0,
    codec: 'mp4',
    bandwidth: 0,
    urls: [probeFirst],
    source: 'trusted-api',
  })
  const probeRep2 = probeVault.register({
    generation: probeState.generation,
    epoch: probeState.epoch,
    kind: 'video',
    key: 'durl:probe:1',
    height: 0,
    codec: 'mp4',
    bandwidth: 0,
    urls: [probeSecond],
    source: 'trusted-api',
  })
  return {
    probeClock,
    probeFirst,
    probeRep1,
    probeRep2,
    probeRoutes,
    probeSecond,
    scope,
  }
}

async function checkMeasurementFixtureHasTwoIndependentProgressiveSegments8(
  t: TestContext,
): Promise<void> {
  const base = await createMeasurementFixtureHasTwoIndependentProgressiveSegments8Context7(t)

  assert.ok(
    base.probeRep1 && base.probeRep2,
    'measurement fixture has two independent progressive segments',
  )
  const initialCandidates = base.probeRoutes.startupOptions(base.probeFirst)?.candidates ?? []
  assert.strictEqual(
    initialCandidates.length,
    3,
    'startup fixture presents exactly three parallel Catalog candidates',
  )
  let inconclusiveCommits = 0,
    attempted = 0
  const invalidProbe = base.scope.own(
    new MeasurementController(
      measurementRoutes({
        isCatalogOnly: () => true,
        startupOptions: (url) => base.probeRoutes.startupOptions(url),
        startupFallback: (url, excluded) => base.probeRoutes.startupFallback(url, excluded),
        noteStartupProbeResult: (candidate, status) =>
          base.probeRoutes.noteStartupProbeResult(candidate, status),
        commitStartupChoice: (...args) => {
          inconclusiveCommits++
          return base.probeRoutes.commitStartupChoice(...args)
        },
      }),
      new MeasurementMetaStore(new FakeStorage(), base.probeClock.now),
      {
        read: async () => {
          attempted++
          return {
            bytes: 0,
            elapsedMs: 20,
            ttfbMs: null,
            status: 403,
            directRange: false,
            reason: 'http-403',
          }
        },
      },
      base.probeClock.now,
      base.probeClock,
      undefined,
      undefined,
      undefined,
      base.probeClock.now,
    ),
  )
  await invalidProbe.prepareStartup(base.probeFirst)
  assert.strictEqual(attempted, 3, 'cold startup probes only three Catalog candidates')
  assert.strictEqual(
    inconclusiveCommits,
    1,
    'Catalog-only startup commits one untested fallback when every probe is invalid',
  )
  assert.ok(
    base.probeRoutes.apply(base.probeFirst).url &&
      !initialCandidates.some(
        (candidate) => candidate.host === base.probeRoutes.apply(base.probeFirst).decision.host,
      ),
    'after three Catalog 403s, ordinary dispatch selects a still-legal host from the full pool',
  )
  assert.ok(
    base.probeRoutes
      .startupOptions(base.probeSecond)
      ?.candidates.some((candidate) => candidate.host === initialCandidates[0]?.host),
    'startup 403 exclusion applies to one progressive segment, not the next',
  )
  await invalidProbe.prepareStartup(base.probeSecond)
  assert.strictEqual(
    attempted,
    3,
    'the next progressive segment shares the one-time startup window',
  )
}

async function checkStartupGateRemainsBoundedButOpenBeforeItsDeadline9(
  t: TestContext,
): Promise<void> {
  const base = await createMeasurementFixtureHasTwoIndependentProgressiveSegments8Context7(t)

  const timeoutClock = base.scope.own(new FakeClock())
  let hangingReads = 0,
    timeoutCommits = 0
  const beforeTimeout = base.probeRoutes
    .startupOptions(base.probeFirst)
    ?.candidates.map((candidate) => candidate.host)
    .join('|')
  const timedProbe = base.scope.own(
    new MeasurementController(
      measurementRoutes({
        isCatalogOnly: () => true,
        startupOptions: (url) => base.probeRoutes.startupOptions(url),
        startupFallback: (url, excluded) => base.probeRoutes.startupFallback(url, excluded),
        noteStartupProbeResult: (candidate, status) =>
          base.probeRoutes.noteStartupProbeResult(candidate, status),
        commitStartupChoice: (...args) => {
          timeoutCommits++
          return base.probeRoutes.commitStartupChoice(...args)
        },
      }),
      new MeasurementMetaStore(new FakeStorage(), timeoutClock.now),
      {
        read: (input) =>
          new Promise((resolve) => {
            hangingReads++
            input.signal.addEventListener(
              'abort',
              () =>
                resolve({
                  bytes: 0,
                  elapsedMs: 3000,
                  ttfbMs: null,
                  status: null,
                  directRange: false,
                  reason: 'timeout',
                }),
              { once: true },
            )
          }),
      },
      timeoutClock.now,
      timeoutClock,
      undefined,
      undefined,
      undefined,
      timeoutClock.now,
    ),
  )
  let timeoutSettled = false
  const timed = timedProbe.prepareStartup(base.probeFirst).then(() => {
    timeoutSettled = true
  })
  assert.strictEqual(hangingReads, 3, 'all three startup probes begin in parallel')
  timeoutClock.advance(2999)
  await Promise.resolve()

  assert.strictEqual(
    timeoutSettled,
    false,
    'startup gate remains bounded but open before its deadline',
  )
  timeoutClock.advance(1)
  await timed
  assert.strictEqual(timeoutSettled, true, 'startup gate releases at the three-second deadline')
  assert.strictEqual(
    timeoutCommits,
    1,
    'timed-out probes commit one untested route without a new probe',
  )
  assert.strictEqual(
    base.probeRoutes
      .startupOptions(base.probeFirst)
      ?.candidates.map((candidate) => candidate.host)
      .join('|'),
    beforeTimeout,
    'timeouts alone do not mark otherwise legal Catalog hosts dead',
  )
  const belowOptions = base.probeRoutes.startupOptions(base.probeSecond)!
  assert.strictEqual(belowOptions.candidates.length, 3)
  let belowWinner: string | null = null
  const belowProbe = base.scope.own(
    new MeasurementController(
      measurementRoutes({
        isCatalogOnly: () => true,
        startupOptions: () => ({
          ...belowOptions,
          demand: { kind: 'video', requiredMbps: 100, highDemand: true },
        }),
        commitStartupChoice: (_url, candidate) => {
          belowWinner = candidate?.host ?? null
          return candidate ? { host: candidate.host } : null
        },
      }),
      new MeasurementMetaStore(new FakeStorage(), base.probeClock.now),
      {
        read: async (input) => ({
          bytes: 70 * 1024,
          elapsedMs: input.host === belowOptions.candidates[1]?.host ? 200 : 100,
          ttfbMs: 10,
          status: 206,
          directRange: true,
          reason: 'measured',
        }),
      },
      base.probeClock.now,
      base.probeClock,
      undefined,
      undefined,
      undefined,
      base.probeClock.now,
    ),
  )
  await belowProbe.prepareStartup(base.probeSecond)
  assert.strictEqual(
    belowWinner,
    belowOptions.candidates[0]?.host,
    'fastest valid Catalog 206 wins when no sample meets playback demand',
  )
  const nativeOriginal = {
    ...belowOptions.candidates[0]!,
    type: 'root-original' as const,
    original: true,
  }
  let nativeWinner: string | null = null
  const nativeProbe = base.scope.own(
    new MeasurementController(
      measurementRoutes({
        isCatalogOnly: () => false,
        startupOptions: () => ({
          ...belowOptions,
          candidates: [nativeOriginal, ...belowOptions.candidates.slice(1)],
        }),
        commitStartupChoice: (_url, candidate) => {
          nativeWinner = candidate?.host ?? null
          return candidate ? { host: candidate.host } : null
        },
      }),
      new MeasurementMetaStore(new FakeStorage(), base.probeClock.now),
      {
        read: async () => ({
          bytes: 0,
          elapsedMs: 50,
          ttfbMs: null,
          status: null,
          directRange: false,
          reason: 'network',
        }),
      },
      base.probeClock.now,
      base.probeClock,
      undefined,
      undefined,
      undefined,
      base.probeClock.now,
    ),
  )
  await nativeProbe.prepareStartup(base.probeSecond)
  assert.strictEqual(
    nativeWinner,
    null,
    'Native-enabled inconclusive startup cannot select a failed candidate as a measured winner',
  )
  assert.equal(nativeProbe.snapshot().startup?.result, 'none')
}

async function checkCatalogSourceHandleResolvesExactCurrentEpochPCDNSource7(
  t: TestContext,
): Promise<void> {
  const base = await createCatalogSourceHandleResolvesExactCurrentEpochPCDNSource7Context6(t)

  assert.strictEqual(
    parseMediaUrl(base.pcdnSource)?.kind,
    'pcdn',
    'fixture is a recognized PCDN media source',
  )
  assert.ok(base.pcdnRep, 'exact PCDN source is retained for Catalog generation')
  {
    const identity = base.pcdnVault.identity(base.pcdnRep)!
    assert.strictEqual(
      base.pcdnVault.resolve(base.pcdnVault.catalogSourceHandle(base.pcdnRep)!, identity),
      base.pcdnSource,
      'Catalog source handle resolves exact current-epoch PCDN source',
    )
    assert.strictEqual(
      base.pcdnVault.candidates(base.pcdnRep, new Set()).native.length,
      0,
      'PCDN source creates no selectable Native route',
    )
    assert.strictEqual(
      base.pcdnVault.candidates(base.pcdnRep, new Set()).root,
      null,
      'PCDN source creates no original fallback route',
    )
    const plan = base.pcdnRoutes.plan(base.pcdnRep, base.demand, 'startup')
    const output = base.pcdnRoutes.playerOutput(base.pcdnRep, base.pcdnSource, plan, [
      base.pcdnSource,
    ])
    assert.ok(
      output.primary &&
        parseMediaUrl(output.primary)?.kind === 'normal' &&
        TRUSTED_CATALOG.includes(
          new URL(output.primary).hostname as (typeof TRUSTED_CATALOG)[number],
        ),
      'PCDN source yields a normal built-in Catalog player destination',
    )
    assert.ok(
      output.backups.every((url) => parseMediaUrl(url)?.kind === 'normal'),
      'PCDN source yields only normal Catalog backups',
    )
    const dispatched = base.pcdnRoutes.apply(base.pcdnSource)
    assert.ok(
      dispatched.url &&
        parseMediaUrl(dispatched.url)?.kind === 'normal' &&
        dispatched.decision.routeType === 'catalog-generated',
      'exact PCDN request is safely rewritten to a normal Catalog destination',
    )
    await base.pcdnRestrictions.add({
      host: new URL(base.pcdnSource).hostname,
      type: 'black',
      kind: 'all',
      reason: 'source-only',
      expireAt: base.now + 60_000,
    })
    base.pcdnRoutes.invalidateForUserSetting()
    assert.ok(
      base.pcdnRoutes.playerOutput(
        base.pcdnRep,
        base.pcdnSource,
        base.pcdnRoutes.plan(base.pcdnRep, base.demand, 'startup'),
        [base.pcdnSource],
      ).primary,
      'blacklisted source host does not deny an allowed generated Catalog destination',
    )
    await base.pcdnSettings.update({ considerNativeSources: true })
    base.pcdnRoutes.invalidateForUserSetting()
    assert.strictEqual(
      base.pcdnVault.candidates(base.pcdnRep, new Set()).native.length,
      0,
      'enabling Native mode still does not authorize the PCDN source',
    )
  }
}

async function checkFixedCatalogChangeCancelsAPendingStartupProbe6(t: TestContext): Promise<void> {
  const base = await createFixedCatalogChangeCancelsAPendingStartupProbe6Context5(t)

  assert.strictEqual(base.measurementResets, 1, 'fixed Catalog change requests measurement reset')
  assert.strictEqual(base.recoveryResets, 1, 'fixed Catalog change requests recovery reset')
  await base.settings.update({ catalogOverrides: { [TRUSTED_CATALOG[0]]: false } })
  assert.strictEqual(
    base.measurementResets,
    2,
    'Catalog restrictions change requests measurement reset',
  )
  assert.strictEqual(base.recoveryResets, 2, 'Catalog restrictions change requests recovery reset')
}

test(
  'fixed Catalog and restriction changes reset measurement and recovery [6]',
  { timeout: 5000 },
  async (t) => {
    await checkFixedCatalogChangeCancelsAPendingStartupProbe6(t)
  },
)

test(
  'Catalog source handle resolves exact current-epoch PCDN source [7]',
  { timeout: 5000 },
  async (t) => {
    await checkCatalogSourceHandleResolvesExactCurrentEpochPCDNSource7(t)
  },
)

test(
  'progressive 403 probes stay bounded and isolate segment exclusions [8]',
  { timeout: 5000 },
  async (t) => {
    await checkMeasurementFixtureHasTwoIndependentProgressiveSegments8(t)
  },
)

test(
  'startup gate remains bounded but open before its deadline [9]',
  { timeout: 5000 },
  async (t) => {
    await checkStartupGateRemainsBoundedButOpenBeforeItsDeadline9(t)
  },
)
