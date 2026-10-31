import { extendFixture } from '../support/fixture-context.ts'
import { CatalogSettingsStore } from '../support/catalog-settings.ts'
import { createRuntimeIds } from '../../src-v2/platform/runtime-ids.ts'
import '../regressions/functional-races/routing-modularization.ts'
import '../regressions/functional-races/routing-convergence.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { RuntimeController } from '../../src-v2/application/runtime-controller.ts'
import { RouteCoordinator } from '../../src-v2/application/route-coordinator.ts'
import { MeasurementController } from '../../src-v2/application/measurement-controller.ts'
import { TRUSTED_CATALOG, DEFAULT_UNAVAILABLE_HOSTS } from '../../src-v2/domain/catalog.ts'
import { parseMediaUrl } from '../../src-v2/domain/url-policy.ts'
import { SignedRouteVault } from '../../src-v2/state/signed-route-vault.ts'
import { SessionStore } from '../../src-v2/state/session-store.ts'
import { RestrictionStore } from '../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../src-v2/state/evidence-store.ts'
import { MeasurementMetaStore } from '../../src-v2/state/measurement-meta-store.ts'
import { FakeStorage } from '../support/storage.ts'
import { testScope } from '../support/scope.ts'
import { FakeClock } from '../support/clock.ts'
import { measurementRoutes } from '../support/controllers.ts'

// Named scenarios create only their prerequisite state; resources belong to this test.
async function createProgressiveRoutingScenario(_t: TestContext) {
  return extendFixture({}, {} as const)
}

async function createScopeContext1(t: TestContext) {
  const scope = testScope(t)
  const now = 2_000_000_000_000
  const storage = new FakeStorage()
  const settings = scope.own(new CatalogSettingsStore(storage, () => now))
  const restrictions = scope.own(new RestrictionStore(storage, () => now))
  const evidence = scope.own(new EvidenceStore(storage, () => now))
  const session = new SessionStore()
  const state = session.beginGeneration(false)
  const vault = new SignedRouteVault()
  vault.reset(state.generation, state.epoch)
  const routes = new RouteCoordinator(
    { now: () => now },
    session,
    settings,
    restrictions,
    evidence,
    vault,
    createRuntimeIds(),
  )
  const demand = { kind: 'video' as const, requiredMbps: 4, highDemand: false }
  const opaque =
    'https://upos-hz-mirrorakam.akamaized.net/opaque/progressive/segment-1?token=opaque'
  const segment1 =
    'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/progressive/segment-1.mp4?token=backup&part=1'
  const segment2 =
    'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/progressive/segment-2.flv?token=backup&part=2'
  const rep1 = vault.register({
    generation: state.generation,
    epoch: state.epoch,
    kind: 'video',
    key: 'durl:q80:0',
    height: 0,
    codec: 'mp4',
    bandwidth: 0,
    urls: [opaque, segment1],
    source: 'trusted-api',
  })
  const rep2 = vault.register({
    generation: state.generation,
    epoch: state.epoch,
    kind: 'video',
    key: 'durl:q80:1',
    height: 0,
    codec: 'flv',
    bandwidth: 0,
    urls: [segment2],
    source: 'trusted-api',
  })
  return extendFixture({}, {
    scope,
    now,
    settings,
    session,
    state,
    vault,
    routes,
    demand,
    opaque,
    segment1,
    segment2,
    rep1,
    rep2,
  } as const)
}

async function createAResourcePrimaryWithALegalSameSegmentBackupRegisters3Context2(t: TestContext) {
  const base = await createScopeContext1(t)
  if (base.rep1 && base.rep2) {
    const handle = base.vault.catalogSourceHandle(base.rep1)
    void (handle && base.vault.resolve(handle, base.vault.identity(base.rep1)!))
    void base.segment1
    void base.vault.rootUrl(base.rep1)
    void base.opaque
    void base.vault.sourceURLs(base.rep1).join('|')
    void [base.opaque, base.segment1].join('|')

    const planned = base.routes.plan(base.rep1, base.demand, 'startup')
    void planned.routeType
    void 'catalog-generated'
    void planned.ranking.length
    void TRUSTED_CATALOG.length
    void planned.ranking.filter((row) => row.eligible).length
    void (TRUSTED_CATALOG.length - 4)
    const playerUrls = base.routes.playerOutput(base.rep1, base.opaque, planned, [
      base.opaque,
      base.segment1,
    ])
    void (
      playerUrls.primary && new URL(playerUrls.primary).pathname === new URL(base.segment1).pathname
    )
    void playerUrls.backups.length
    void 5
    void new Set([playerUrls.primary, ...playerUrls.backups].map((url) => new URL(url).hostname))
      .size
    void 6
    const applied = base.routes.apply(base.segment1)
    void applied.decision.routeType
    void 'catalog-generated'
    void applied.url
    if (applied.url) {
      void (new URL(applied.url).pathname + new URL(applied.url).search)
      void (new URL(base.segment1).pathname + new URL(base.segment1).search)
    }

    const startup = base.routes.startupOptions(base.opaque)
    void (startup?.candidates.length === 3)
    void startup?.candidates.every(
      (candidate) =>
        candidate.type === 'catalog-generated' &&
        new URL(candidate.url).pathname === new URL(base.segment1).pathname,
    )
    const challenge = base.routes.challenge(base.rep1, base.demand, false)
    void (challenge?.url && new URL(challenge.url).pathname === new URL(base.segment1).pathname)

    const first = startup?.candidates[0]
    if (first) {
      base.routes.noteStartupProbeResult(first, 403)
      void !base.routes
        .startupOptions(base.opaque)
        ?.candidates.some((candidate) => candidate.host === first.host)
      void base.routes
        .startupOptions(base.segment2)
        ?.candidates.some((candidate) => candidate.host === first.host)
    }
    for (const candidate of startup?.candidates.slice(1) ?? [])
      base.routes.noteStartupProbeResult(candidate, 403)
    const afterThree = base.routes.apply(base.segment1)
    void (
      afterThree.url &&
      !startup?.candidates.some((candidate) => candidate.host === afterThree.decision.host)
    )
    const afterThreeOutput = base.routes.playerOutput(base.rep1, base.opaque, afterThree.decision, [
      base.opaque,
      base.segment1,
    ])
    void (
      afterThreeOutput.primary &&
      !startup?.candidates.some(
        (candidate) => candidate.host === new URL(afterThreeOutput.primary).hostname,
      )
    )
    void afterThreeOutput.backups.every(
      (url) => !startup?.candidates.some((candidate) => candidate.host === new URL(url).hostname),
    )
    const rescue = base.routes.recoverStartup(
      base.rep1,
      base.demand,
      startup!.candidates[0]!.host,
      [],
    )
    void (rescue?.host && !startup?.candidates.some((candidate) => candidate.host === rescue.host))

    const lateChoice = base.routes.startupOptions(base.segment2)?.candidates[0] ?? null
    void lateChoice
    const fixedHost = TRUSTED_CATALOG[5]
    await base.settings.update({ fixedHost })
    base.routes.invalidateForUserSetting()
    void base.routes.commitStartupChoice(base.segment2, lateChoice, 'late-preflight')
    void null
    void base.routes.apply(base.segment2).decision.host
    void fixedHost
  }
  const resource =
    'https://upos-hz-mirrorakam.akamaized.net/v1/resource/progressive-segment?token=resource'
  const resourceBackup =
    'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/progressive/resource-backup.mp4?token=valid'
  const resourceRep = base.vault.register({
    generation: base.state.generation,
    epoch: base.state.epoch,
    kind: 'video',
    key: 'durl:q64:0',
    height: 0,
    codec: 'mp4',
    bandwidth: 0,
    urls: [resource, resourceBackup],
    source: 'trusted-api',
  })
  return extendFixture(base, { resource, resourceBackup, resourceRep } as const)
}

async function createResourcePrimaryIsReplacedUsingItsExactLegalBackupSource4Context3(
  t: TestContext,
) {
  const base = await createAResourcePrimaryWithALegalSameSegmentBackupRegisters3Context2(t)
  await base.settings.update({ fixedHost: null })
  base.routes.invalidateForUserSetting()
  return extendFixture(base, {} as const)
}

async function createTabLocalOriginalComparisonRetainsTheExactOpaqueOriginal5Context4(
  t: TestContext,
) {
  const base = await createResourcePrimaryIsReplacedUsingItsExactLegalBackupSource4Context3(t)
  if (base.resourceRep) {
    const resourcePlan = base.routes.plan(base.resourceRep, base.demand, 'startup')
    const resourceOutput = base.routes.playerOutput(base.resourceRep, base.resource, resourcePlan, [
      base.resource,
      base.resourceBackup,
    ])
    void (
      resourceOutput.primary &&
      new URL(resourceOutput.primary).pathname === new URL(base.resourceBackup).pathname
    )
    void resourceOutput.backups.every(
      (url) => new URL(url).pathname === new URL(base.resourceBackup).pathname,
    )
    void base.routes.apply(base.resource).decision.reason
    void 'catalog-unreplaceable'
  }
  return extendFixture(base, {} as const)
}

async function createFixedCatalogChangeCancelsAPendingStartupProbe6Context5(t: TestContext) {
  const base = await createTabLocalOriginalComparisonRetainsTheExactOpaqueOriginal5Context4(t)
  if (base.rep1) {
    base.routes.setOriginalComparison(true)
    const comparisonPlan = base.routes.plan(base.rep1, base.demand, 'startup')
    const comparisonOutput = base.routes.playerOutput(base.rep1, base.opaque, comparisonPlan, [
      base.opaque,
      base.segment1,
    ])
    void comparisonOutput.primary
    void base.opaque
    base.routes.setOriginalComparison(false)
  }
  let measurementResets = 0,
    recoveryResets = 0
  const runtime = new RuntimeController(
    base.session,
    base.settings,
    base.routes,
    {
      snapshot: () => {
        throw new Error('snapshot should not be called')
      },
      reset: () => undefined,
    },
    {
      observeTransport() {},
      subscribe: () => () => undefined,
      snapshot: () => {
        throw new Error('monitor snapshot should not be called')
      },
      start: () => undefined,
      stop: () => undefined,
      reset: () => undefined,
    },
    {
      reset: () => {
        measurementResets++
      },
    },
    {
      subscribe: () => () => undefined,
      reset: () => {
        recoveryResets++
      },
      armRouteFailure: () => undefined,
    },
    { setEnabled: () => undefined },
    { record: () => undefined, recordPlayer: () => undefined },
    () => base.now,
    { subscribeEpoch: () => () => undefined },
  )
  runtime.install()
  base.scope.defer(() => runtime.dispose())
  await base.settings.update({ fixedHost: TRUSTED_CATALOG[4] })
  return extendFixture(base, {
    get measurementResets() {
      return measurementResets
    },
    set measurementResets(next: typeof measurementResets) {
      measurementResets = next
    },
    get recoveryResets() {
      return recoveryResets
    },
    set recoveryResets(next: typeof recoveryResets) {
      recoveryResets = next
    },
  } as const)
}

async function createCatalogSourceHandleResolvesExactCurrentEpochPCDNSource7Context6(
  t: TestContext,
) {
  const base = await createFixedCatalogChangeCancelsAPendingStartupProbe6Context5(t)
  const pcdnStorage = new FakeStorage(),
    pcdnSettings = base.scope.own(new CatalogSettingsStore(pcdnStorage, () => base.now))
  const pcdnSession = new SessionStore(),
    pcdnState = pcdnSession.beginGeneration(false)
  const pcdnVault = new SignedRouteVault()
  pcdnVault.reset(pcdnState.generation, pcdnState.epoch)
  const pcdnRestrictions = base.scope.own(new RestrictionStore(pcdnStorage, () => base.now))
  const pcdnRoutes = new RouteCoordinator(
    { now: () => base.now },
    pcdnSession,
    pcdnSettings,
    pcdnRestrictions,
    base.scope.own(new EvidenceStore(pcdnStorage, () => base.now)),
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
  return extendFixture(base, {
    pcdnSettings,
    pcdnVault,
    pcdnRestrictions,
    pcdnRoutes,
    pcdnSource,
    pcdnRep,
  } as const)
}

async function createMeasurementFixtureHasTwoIndependentProgressiveSegments8Context7(
  t: TestContext,
) {
  const base = await createCatalogSourceHandleResolvesExactCurrentEpochPCDNSource7Context6(t)
  const probeClock = base.scope.own(new FakeClock()),
    probeStorage = new FakeStorage()
  const probeSettings = base.scope.own(new CatalogSettingsStore(probeStorage, probeClock.now))
  const probeSession = new SessionStore(),
    probeState = probeSession.beginGeneration(false)
  const probeVault = new SignedRouteVault()
  probeVault.reset(probeState.generation, probeState.epoch)
  const probeRoutes = new RouteCoordinator(
    { now: probeClock.now },
    probeSession,
    probeSettings,
    base.scope.own(new RestrictionStore(probeStorage, probeClock.now)),
    base.scope.own(new EvidenceStore(probeStorage, probeClock.now)),
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
  return extendFixture(base, {
    probeClock,
    probeRoutes,
    probeFirst,
    probeSecond,
    probeRep1,
    probeRep2,
  } as const)
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
    ),
  )
  await invalidProbe.prepareStartup(base.probeFirst)
  assert.strictEqual(attempted, 3, 'cold startup probes only three Catalog candidates')
  assert.strictEqual(
    inconclusiveCommits,
    0,
    'Catalog-only startup commits no candidate when every probe is invalid',
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
  const timeoutClock = base.scope.own(new FakeClock())
  let hangingReads = 0,
    timeoutCommits = 0
  base.probeRoutes
    .startupOptions(base.probeFirst)
    ?.candidates.map((candidate) => candidate.host)
    .join('|')
  const timedProbe = base.scope.own(
    new MeasurementController(
      measurementRoutes({
        isCatalogOnly: () => true,
        startupOptions: (url) => base.probeRoutes.startupOptions(url),
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
    ),
  )
  false
  timedProbe.prepareStartup(base.probeFirst).then(() => {
    true
  })
  assert.strictEqual(hangingReads, 3, 'all three startup probes begin in parallel')
}

async function checkStartupGateRemainsBoundedButOpenBeforeItsDeadline9(
  t: TestContext,
): Promise<void> {
  const base = await createMeasurementFixtureHasTwoIndependentProgressiveSegments8Context7(t)

  const initialCandidates = base.probeRoutes.startupOptions(base.probeFirst)?.candidates ?? []
  let inconclusiveCommits = 0,
    attempted = 0
  const invalidProbe = base.scope.own(
    new MeasurementController(
      measurementRoutes({
        isCatalogOnly: () => true,
        startupOptions: (url) => base.probeRoutes.startupOptions(url),
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
    ),
  )
  await invalidProbe.prepareStartup(base.probeFirst)
  void (
    base.probeRoutes.apply(base.probeFirst).url &&
    !initialCandidates.some(
      (candidate) => candidate.host === base.probeRoutes.apply(base.probeFirst).decision.host,
    )
  )
  void base.probeRoutes
    .startupOptions(base.probeSecond)
    ?.candidates.some((candidate) => candidate.host === initialCandidates[0]?.host)
  await invalidProbe.prepareStartup(base.probeSecond)
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
    ),
  )
  let timeoutSettled = false
  const timed = timedProbe.prepareStartup(base.probeFirst).then(() => {
    timeoutSettled = true
  })
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
  assert.strictEqual(timeoutCommits, 0, 'timed-out Catalog probes commit no route')
  assert.strictEqual(
    base.probeRoutes
      .startupOptions(base.probeFirst)
      ?.candidates.map((candidate) => candidate.host)
      .join('|'),
    beforeTimeout,
    'timeouts alone do not mark otherwise legal Catalog hosts dead',
  )
  const belowOptions = base.probeRoutes.startupOptions(base.probeSecond)!
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
    ),
  )
  await belowProbe.prepareStartup(base.probeSecond)
  assert.strictEqual(
    belowWinner,
    belowOptions.candidates[0]?.host,
    'fastest valid Catalog 206 wins when no sample meets 1.35 times playback demand',
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
    ),
  )
  await nativeProbe.prepareStartup(base.probeSecond)
  assert.strictEqual(
    nativeWinner,
    nativeOriginal.host,
    'Native-enabled inconclusive startup retains its original fallback',
  )
}

async function checkCatalogSourceHandleResolvesExactCurrentEpochPCDNSource7(
  t: TestContext,
): Promise<void> {
  const base = await createCatalogSourceHandleResolvesExactCurrentEpochPCDNSource7Context6(t)

  if (base.pcdnRep) {
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

  assert.strictEqual(
    base.measurementResets,
    1,
    'fixed Catalog change cancels a pending startup probe',
  )
  assert.strictEqual(base.recoveryResets, 1, 'fixed Catalog change clears pending route recovery')
  await base.settings.update({ catalogOverrides: { [TRUSTED_CATALOG[0]]: false } })
  assert.strictEqual(
    base.measurementResets,
    2,
    'Catalog restrictions change cancels a pending startup probe',
  )
  assert.strictEqual(
    base.recoveryResets,
    2,
    'Catalog restrictions change clears pending route recovery',
  )
  const pcdnStorage = new FakeStorage(),
    pcdnSettings = base.scope.own(new CatalogSettingsStore(pcdnStorage, () => base.now))
  const pcdnSession = new SessionStore(),
    pcdnState = pcdnSession.beginGeneration(false)
  const pcdnVault = new SignedRouteVault()
  pcdnVault.reset(pcdnState.generation, pcdnState.epoch)
  const pcdnRestrictions = base.scope.own(new RestrictionStore(pcdnStorage, () => base.now))
  new RouteCoordinator(
    { now: () => base.now },
    pcdnSession,
    pcdnSettings,
    pcdnRestrictions,
    base.scope.own(new EvidenceStore(pcdnStorage, () => base.now)),
    pcdnVault,
    createRuntimeIds(),
  )
  const pcdnSource =
    'https://upos-pc.mcdn.bilivideo.com/upgcxcode/progressive/pcdn-source.mp4?token=pcdn'
  assert.strictEqual(
    parseMediaUrl(pcdnSource)?.kind,
    'pcdn',
    'fixture is a recognized PCDN media source',
  )
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
  assert.ok(pcdnRep, 'exact PCDN source is retained privately for safe Catalog generation')
}

async function checkTabLocalOriginalComparisonRetainsTheExactOpaqueOriginal5(
  t: TestContext,
): Promise<void> {
  const base = await createTabLocalOriginalComparisonRetainsTheExactOpaqueOriginal5Context4(t)

  if (base.rep1) {
    base.routes.setOriginalComparison(true)
    const comparisonPlan = base.routes.plan(base.rep1, base.demand, 'startup')
    const comparisonOutput = base.routes.playerOutput(base.rep1, base.opaque, comparisonPlan, [
      base.opaque,
      base.segment1,
    ])
    assert.strictEqual(
      comparisonOutput.primary,
      base.opaque,
      'tab-local original comparison retains the exact opaque original',
    )
    base.routes.setOriginalComparison(false)
  }
}

async function checkResourcePrimaryIsReplacedUsingItsExactLegalBackupSource4(
  t: TestContext,
): Promise<void> {
  const base = await createResourcePrimaryIsReplacedUsingItsExactLegalBackupSource4Context3(t)

  if (base.resourceRep) {
    const resourcePlan = base.routes.plan(base.resourceRep, base.demand, 'startup')
    const resourceOutput = base.routes.playerOutput(base.resourceRep, base.resource, resourcePlan, [
      base.resource,
      base.resourceBackup,
    ])
    assert.ok(
      resourceOutput.primary &&
        new URL(resourceOutput.primary).pathname === new URL(base.resourceBackup).pathname,
      'resource primary is replaced using its exact legal backup source',
    )
    assert.ok(
      resourceOutput.backups.every(
        (url) => new URL(url).pathname === new URL(base.resourceBackup).pathname,
      ),
      'every Catalog fallback retains the promoted backup path and query',
    )
    assert.strictEqual(
      base.routes.apply(base.resource).decision.reason,
      'catalog-unreplaceable',
      'an old resource URL remains blocked at request dispatch despite same-segment source promotion',
    )
  }
}

async function checkAResourcePrimaryWithALegalSameSegmentBackupRegisters3(
  t: TestContext,
): Promise<void> {
  const base = await createAResourcePrimaryWithALegalSameSegmentBackupRegisters3Context2(t)

  assert.ok(base.resourceRep, 'a resource primary with a legal same-segment backup registers')
}

async function checkCatalogSourceResolvesTheFirstLegalSameSegmentBackupWhenThe(
  t: TestContext,
): Promise<void> {
  const base = await createScopeContext1(t)

  if (base.rep1 && base.rep2) {
    const handle = base.vault.catalogSourceHandle(base.rep1)
    assert.strictEqual(
      handle && base.vault.resolve(handle, base.vault.identity(base.rep1)!),
      base.segment1,
      'Catalog source resolves the first legal same-segment backup when the declared root is opaque',
    )
    assert.strictEqual(
      base.vault.rootUrl(base.rep1),
      base.opaque,
      'canonical Catalog promotion does not change the original route order',
    )
    assert.strictEqual(
      base.vault.sourceURLs(base.rep1).join('|'),
      [base.opaque, base.segment1].join('|'),
      'Vault exposes only exact current-group originals in source order for Native pruning',
    )

    const planned = base.routes.plan(base.rep1, base.demand, 'startup')
    assert.strictEqual(
      planned.routeType,
      'catalog-generated',
      'opaque root with a legal backup can plan Catalog',
    )
    assert.strictEqual(
      planned.ranking.length,
      TRUSTED_CATALOG.length,
      'ranking considers the complete built-in Catalog',
    )
    assert.strictEqual(
      planned.ranking.filter((row) => row.eligible).length,
      TRUSTED_CATALOG.length - DEFAULT_UNAVAILABLE_HOSTS.size,
      'default-unavailable hosts remain excluded until enabled',
    )
    const playerUrls = base.routes.playerOutput(base.rep1, base.opaque, planned, [
      base.opaque,
      base.segment1,
    ])
    assert.ok(
      playerUrls.primary &&
        new URL(playerUrls.primary).pathname === new URL(base.segment1).pathname,
      'Catalog-only player output promotes the legal backup instead of exposing an opaque primary',
    )
    assert.strictEqual(
      playerUrls.backups.length,
      5,
      'Catalog-only player output keeps five legal distinct Catalog backups',
    )
    assert.strictEqual(
      new Set([playerUrls.primary, ...playerUrls.backups].map((url) => new URL(url).hostname)).size,
      6,
      'Catalog-only player output backup hosts are distinct',
    )
    const applied = base.routes.apply(base.segment1)
    assert.strictEqual(
      applied.decision.routeType,
      'catalog-generated',
      'request for the legal backup uses Catalog',
    )
    assert.ok(applied.url, 'request for the legal backup has a materialized destination')
    if (applied.url)
      assert.strictEqual(
        new URL(applied.url).pathname + new URL(applied.url).search,
        new URL(base.segment1).pathname + new URL(base.segment1).search,
        'Catalog rewrite retains the promoted segment path and query',
      )

    const startup = base.routes.startupOptions(base.opaque)
    assert.ok(
      startup?.candidates.length === 3,
      'opaque original uses its canonical backup for bounded Catalog preflight',
    )
    assert.ok(
      startup?.candidates.every(
        (candidate) =>
          candidate.type === 'catalog-generated' &&
          new URL(candidate.url).pathname === new URL(base.segment1).pathname,
      ),
      'all startup probes use the promoted segment path',
    )
    const challenge = base.routes.challenge(base.rep1, base.demand, false)
    assert.ok(
      challenge?.url && new URL(challenge.url).pathname === new URL(base.segment1).pathname,
      'healthy Catalog challenge uses the promoted segment source',
    )

    const first = startup?.candidates[0]
    if (first) {
      base.routes.noteStartupProbeResult(first, 403)
      assert.ok(
        !base.routes
          .startupOptions(base.opaque)
          ?.candidates.some((candidate) => candidate.host === first.host),
        'Catalog 403 excludes the tested stream-host pair',
      )
      assert.ok(
        base.routes
          .startupOptions(base.segment2)
          ?.candidates.some((candidate) => candidate.host === first.host),
        'a Catalog 403 for one progressive segment does not exclude another segment',
      )
    }
    for (const candidate of startup?.candidates.slice(1) ?? [])
      base.routes.noteStartupProbeResult(candidate, 403)
    const afterThree = base.routes.apply(base.segment1)
    assert.ok(
      afterThree.url &&
        !startup?.candidates.some((candidate) => candidate.host === afterThree.decision.host),
      'dispatch can select a still-legal fourth Catalog after all three bounded probes return 403',
    )
    const afterThreeOutput = base.routes.playerOutput(base.rep1, base.opaque, afterThree.decision, [
      base.opaque,
      base.segment1,
    ])
    assert.ok(
      afterThreeOutput.primary &&
        !startup?.candidates.some(
          (candidate) => candidate.host === new URL(afterThreeOutput.primary).hostname,
        ),
      'Catalog player primary excludes all three tested 403 stream-host pairs',
    )
    assert.ok(
      afterThreeOutput.backups.every(
        (url) => !startup?.candidates.some((candidate) => candidate.host === new URL(url).hostname),
      ),
      'Catalog player backups exclude all three tested 403 stream-host pairs',
    )
    const rescue = base.routes.recoverStartup(
      base.rep1,
      base.demand,
      startup!.candidates[0]!.host,
      [],
    )
    assert.ok(
      rescue?.host && !startup?.candidates.some((candidate) => candidate.host === rescue.host),
      'bounded startup recovery can use a new legal candidate from the promoted source',
    )

    const lateChoice = base.routes.startupOptions(base.segment2)?.candidates[0] ?? null
    assert.ok(lateChoice, 'a second segment has a legal pending startup candidate')
    const fixedHost = TRUSTED_CATALOG[5]
    await base.settings.update({ fixedHost })
    base.routes.invalidateForUserSetting()
    assert.strictEqual(
      base.routes.commitStartupChoice(base.segment2, lateChoice, 'late-preflight'),
      null,
      'a pending startup candidate cannot override a newly selected fixed Catalog host',
    )
    assert.strictEqual(
      base.routes.apply(base.segment2).decision.host,
      fixedHost,
      'the current fixed Catalog host wins at final request dispatch',
    )
  }
}

async function checkTwoProgressiveSegmentsRegisterAsSeparateVideoRepresentations1(
  t: TestContext,
): Promise<void> {
  await createProgressiveRoutingScenario(t)

  const session = new SessionStore()
  const state = session.beginGeneration(false)
  const vault = new SignedRouteVault()
  vault.reset(state.generation, state.epoch)
  const opaque =
    'https://upos-hz-mirrorakam.akamaized.net/opaque/progressive/segment-1?token=opaque'
  const segment1 =
    'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/progressive/segment-1.mp4?token=backup&part=1'
  const segment2 =
    'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/progressive/segment-2.flv?token=backup&part=2'
  const rep1 = vault.register({
    generation: state.generation,
    epoch: state.epoch,
    kind: 'video',
    key: 'durl:q80:0',
    height: 0,
    codec: 'mp4',
    bandwidth: 0,
    urls: [opaque, segment1],
    source: 'trusted-api',
  })
  const rep2 = vault.register({
    generation: state.generation,
    epoch: state.epoch,
    kind: 'video',
    key: 'durl:q80:1',
    height: 0,
    codec: 'flv',
    bandwidth: 0,
    urls: [segment2],
    source: 'trusted-api',
  })

  assert.ok(rep1 && rep2, 'two progressive segments register as separate video representations')
}

test(
  'two progressive segments register as separate video representations [1]',
  { timeout: 5000 },
  async (t) => {
    await checkTwoProgressiveSegmentsRegisterAsSeparateVideoRepresentations1(t)
  },
)
test(
  'Catalog source resolves the first legal same-segment backup when the declared root is opaque [2]',
  { timeout: 5000 },
  async (t) => {
    await checkCatalogSourceResolvesTheFirstLegalSameSegmentBackupWhenThe(t)
  },
)
test(
  'a resource primary with a legal same-segment backup registers [3]',
  { timeout: 5000 },
  async (t) => {
    await checkAResourcePrimaryWithALegalSameSegmentBackupRegisters3(t)
  },
)
test(
  'resource primary is replaced using its exact legal backup source [4]',
  { timeout: 5000 },
  async (t) => {
    await checkResourcePrimaryIsReplacedUsingItsExactLegalBackupSource4(t)
  },
)
test(
  'tab-local original comparison retains the exact opaque original [5]',
  { timeout: 5000 },
  async (t) => {
    await checkTabLocalOriginalComparisonRetainsTheExactOpaqueOriginal5(t)
  },
)
test('fixed Catalog change cancels a pending startup probe [6]', { timeout: 5000 }, async (t) => {
  await checkFixedCatalogChangeCancelsAPendingStartupProbe6(t)
})
test(
  'Catalog source handle resolves exact current-epoch PCDN source [7]',
  { timeout: 5000 },
  async (t) => {
    await checkCatalogSourceHandleResolvesExactCurrentEpochPCDNSource7(t)
  },
)
test(
  'measurement fixture has two independent progressive segments [8]',
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
import '../regressions/functional-races/routing.ts'
import '../regressions/functional-races/cr-routing.ts'
