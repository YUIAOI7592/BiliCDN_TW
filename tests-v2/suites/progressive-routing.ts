import { RuntimeController } from '../../src-v2/application/runtime-controller.ts'
import { RouteCoordinator } from '../../src-v2/application/route-coordinator.ts'
import { MeasurementController } from '../../src-v2/application/measurement-controller.ts'
import { TRUSTED_CATALOG } from '../../src-v2/domain/catalog.ts'
import { parseMediaUrl } from '../../src-v2/domain/url-policy.ts'
import { SignedRouteVault } from '../../src-v2/state/signed-route-vault.ts'
import { SessionStore } from '../../src-v2/state/session-store.ts'
import { SettingsStore } from '../../src-v2/state/settings-store.ts'
import { RestrictionStore } from '../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../src-v2/state/evidence-store.ts'
import { MeasurementMetaStore } from '../../src-v2/state/measurement-meta-store.ts'
import { check, equal, assertionCount } from '../support/assert.ts'
import { FakeStorage } from '../support/storage.ts'
import { testScope } from '../support/scope.ts'
import { FakeClock } from '../support/clock.ts'
import { measurementRoutes } from '../support/controllers.ts'

const scope = testScope()
try {
  const now = 2_000_000_000_000
  const storage = new FakeStorage()
  const settings = scope.own(new SettingsStore(storage, () => now))
  const restrictions = scope.own(new RestrictionStore(storage, () => now))
  const evidence = scope.own(new EvidenceStore(storage, () => now))
  const session = new SessionStore()
  const state = session.beginGeneration(false)
  const vault = new SignedRouteVault()
  vault.reset(state.generation, state.epoch)
  const routes = new RouteCoordinator({ now: () => now }, session, settings, restrictions, evidence, vault)
  const demand = { kind: 'video' as const, requiredMbps: 4, highDemand: false }
  const opaque = 'https://upos-hz-mirrorakam.akamaized.net/opaque/progressive/segment-1?token=opaque'
  const segment1 = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/progressive/segment-1.mp4?token=backup&part=1'
  const segment2 = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/progressive/segment-2.flv?token=backup&part=2'
  const rep1 = vault.register({ generation: state.generation, epoch: state.epoch, kind: 'video', key: 'durl:q80:0',
    height: 0, codec: 'mp4', bandwidth: 0, urls: [opaque, segment1], source: 'trusted-api' })
  const rep2 = vault.register({ generation: state.generation, epoch: state.epoch, kind: 'video', key: 'durl:q80:1',
    height: 0, codec: 'flv', bandwidth: 0, urls: [segment2], source: 'trusted-api' })
  check(rep1 && rep2, 'two progressive segments register as separate video representations')
  if (rep1 && rep2) {
    const handle = vault.catalogSourceHandle(rep1)
    equal(handle && vault.resolve(handle, vault.identity(rep1)!), segment1,
      'Catalog source resolves the first legal same-segment backup when the declared root is opaque')
    equal(vault.rootUrl(rep1), opaque, 'canonical Catalog promotion does not change the original route order')
    equal(vault.sourceURLs(rep1).join('|'), [opaque, segment1].join('|'),
      'Vault exposes only exact current-group originals in source order for Native pruning')

    const planned = routes.plan(rep1, demand, 'startup')
    equal(planned.routeType, 'catalog-generated', 'opaque root with a legal backup can plan Catalog')
    equal(planned.ranking.length, TRUSTED_CATALOG.length, 'ranking considers the complete built-in Catalog')
    equal(planned.ranking.filter(row => row.eligible).length, TRUSTED_CATALOG.length - 4,
      'the four default-unavailable hosts remain excluded until enabled')
    const playerUrls = routes.playerOutput(rep1, opaque, planned, [opaque, segment1])
    check(playerUrls.primary && new URL(playerUrls.primary).pathname === new URL(segment1).pathname,
      'Catalog-only player output promotes the legal backup instead of exposing an opaque primary')
    equal(playerUrls.backups.length, 5, 'Catalog-only player output keeps five legal distinct Catalog backups')
    equal(new Set([playerUrls.primary, ...playerUrls.backups].map(url => new URL(url).hostname)).size, 6,
      'Catalog-only player output backup hosts are distinct')
    const applied = routes.apply(segment1)
    equal(applied.decision.routeType, 'catalog-generated', 'request for the legal backup uses Catalog')
    check(applied.url, 'request for the legal backup has a materialized destination')
    if (applied.url) equal(new URL(applied.url).pathname + new URL(applied.url).search,
      new URL(segment1).pathname + new URL(segment1).search, 'Catalog rewrite retains the promoted segment path and query')

    const startup = routes.startupOptions(opaque)
    check(startup?.candidates.length === 3, 'opaque original uses its canonical backup for bounded Catalog preflight')
    check(startup?.candidates.every(candidate => candidate.type === 'catalog-generated'
      && new URL(candidate.url).pathname === new URL(segment1).pathname),
    'all startup probes use the promoted segment path')
    const challenge = routes.challenge(rep1, demand, false)
    check(challenge?.url && new URL(challenge.url).pathname === new URL(segment1).pathname,
      'healthy Catalog challenge uses the promoted segment source')

    const first = startup?.candidates[0]
    if (first) {
      routes.noteStartupProbeResult(first, 403)
      check(!routes.startupOptions(opaque)?.candidates.some(candidate => candidate.host === first.host),
        'Catalog 403 excludes the tested stream-host pair')
      check(routes.startupOptions(segment2)?.candidates.some(candidate => candidate.host === first.host),
        'a Catalog 403 for one progressive segment does not exclude another segment')
    }
    for (const candidate of startup?.candidates.slice(1) ?? []) routes.noteStartupProbeResult(candidate, 403)
    const afterThree = routes.apply(segment1)
    check(afterThree.url && !startup?.candidates.some(candidate => candidate.host === afterThree.decision.host),
      'dispatch can select a still-legal fourth Catalog after all three bounded probes return 403')
    const afterThreeOutput = routes.playerOutput(rep1, opaque, afterThree.decision, [opaque, segment1])
    check(afterThreeOutput.primary && !startup?.candidates.some(candidate => candidate.host === new URL(afterThreeOutput.primary).hostname),
      'Catalog player primary excludes all three tested 403 stream-host pairs')
    check(afterThreeOutput.backups.every(url => !startup?.candidates.some(candidate => candidate.host === new URL(url).hostname)),
      'Catalog player backups exclude all three tested 403 stream-host pairs')
    const rescue = routes.recoverStartup(rep1, demand, startup!.candidates[0]!.host, [])
    check(rescue?.host && !startup?.candidates.some(candidate => candidate.host === rescue.host),
      'bounded startup recovery can use a new legal candidate from the promoted source')

    const lateChoice = routes.startupOptions(segment2)?.candidates[0] ?? null
    check(lateChoice, 'a second segment has a legal pending startup candidate')
    const fixedHost = TRUSTED_CATALOG[5]
    await settings.update({ fixedHost })
    routes.invalidateForUserSetting()
    equal(routes.commitStartupChoice(segment2, lateChoice, 'late-preflight'), null,
      'a pending startup candidate cannot override a newly selected fixed Catalog host')
    equal(routes.apply(segment2).decision.host, fixedHost,
      'the current fixed Catalog host wins at final request dispatch')
  }

  const resource = 'https://upos-hz-mirrorakam.akamaized.net/v1/resource/progressive-segment?token=resource'
  const resourceBackup = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/progressive/resource-backup.mp4?token=valid'
  const resourceRep = vault.register({ generation: state.generation, epoch: state.epoch, kind: 'video', key: 'durl:q64:0',
    height: 0, codec: 'mp4', bandwidth: 0, urls: [resource, resourceBackup], source: 'trusted-api' })
  check(resourceRep, 'a resource primary with a legal same-segment backup registers')
  await settings.update({ fixedHost: null })
  routes.invalidateForUserSetting()
  if (resourceRep) {
    const resourcePlan = routes.plan(resourceRep, demand, 'startup')
    const resourceOutput = routes.playerOutput(resourceRep, resource, resourcePlan, [resource, resourceBackup])
    check(resourceOutput.primary && new URL(resourceOutput.primary).pathname === new URL(resourceBackup).pathname,
      'resource primary is replaced using its exact legal backup source')
    check(resourceOutput.backups.every(url => new URL(url).pathname === new URL(resourceBackup).pathname),
      'every Catalog fallback retains the promoted backup path and query')
    equal(routes.apply(resource).decision.reason, 'catalog-unreplaceable',
      'an old resource URL remains blocked at request dispatch despite same-segment source promotion')
  }
  if (rep1) {
    routes.setOriginalComparison(true)
    const comparisonPlan = routes.plan(rep1, demand, 'startup')
    const comparisonOutput = routes.playerOutput(rep1, opaque, comparisonPlan, [opaque, segment1])
    equal(comparisonOutput.primary, opaque, 'tab-local original comparison retains the exact opaque original')
    routes.setOriginalComparison(false)
  }

  let measurementResets = 0, recoveryResets = 0
  const runtime = new RuntimeController(session, settings, routes,
    { snapshot: () => { throw new Error('snapshot should not be called') }, reset: () => undefined },
    { subscribe: () => () => undefined, snapshot: () => { throw new Error('monitor snapshot should not be called') },
      start: () => undefined, stop: () => undefined, reset: () => undefined },
    { reset: () => { measurementResets++ } },
    { subscribe: () => () => undefined, reset: () => { recoveryResets++ }, armRouteFailure: () => undefined },
    { setEnabled: () => undefined }, { record: () => undefined, recordPlayer: () => undefined }, () => now)
  runtime.install()
  scope.defer(() => runtime.dispose())
  await settings.update({ fixedHost: TRUSTED_CATALOG[4] })
  equal(measurementResets, 1, 'fixed Catalog change cancels a pending startup probe')
  equal(recoveryResets, 1, 'fixed Catalog change clears pending route recovery')
  await settings.update({ catalogOverrides: { [TRUSTED_CATALOG[0]]: false } })
  equal(measurementResets, 2, 'Catalog restrictions change cancels a pending startup probe')
  equal(recoveryResets, 2, 'Catalog restrictions change clears pending route recovery')

  const pcdnStorage = new FakeStorage(), pcdnSettings = scope.own(new SettingsStore(pcdnStorage, () => now))
  const pcdnSession = new SessionStore(), pcdnState = pcdnSession.beginGeneration(false)
  const pcdnVault = new SignedRouteVault(); pcdnVault.reset(pcdnState.generation, pcdnState.epoch)
  const pcdnRestrictions = scope.own(new RestrictionStore(pcdnStorage, () => now))
  const pcdnRoutes = new RouteCoordinator({ now: () => now }, pcdnSession, pcdnSettings, pcdnRestrictions,
    scope.own(new EvidenceStore(pcdnStorage, () => now)), pcdnVault)
  const pcdnSource = 'https://upos-pc.mcdn.bilivideo.com/upgcxcode/progressive/pcdn-source.mp4?token=pcdn'
  equal(parseMediaUrl(pcdnSource)?.kind, 'pcdn', 'fixture is a recognized PCDN media source')
  const pcdnRep = pcdnVault.register({ generation: pcdnState.generation, epoch: pcdnState.epoch, kind: 'video',
    key: 'durl:q80:pcdn', height: 0, codec: 'mp4', bandwidth: 0, urls: [pcdnSource], source: 'trusted-api' })
  check(pcdnRep, 'exact PCDN source is retained privately for safe Catalog generation')
  if (pcdnRep) {
    const identity = pcdnVault.identity(pcdnRep)!
    equal(pcdnVault.resolve(pcdnVault.catalogSourceHandle(pcdnRep)!, identity), pcdnSource,
      'Catalog source handle resolves exact current-epoch PCDN source')
    equal(pcdnVault.candidates(pcdnRep, new Set()).native.length, 0,
      'PCDN source creates no selectable Native route')
    equal(pcdnVault.candidates(pcdnRep, new Set()).root, null,
      'PCDN source creates no original fallback route')
    const plan = pcdnRoutes.plan(pcdnRep, demand, 'startup')
    const output = pcdnRoutes.playerOutput(pcdnRep, pcdnSource, plan, [pcdnSource])
    check(output.primary && parseMediaUrl(output.primary)?.kind === 'normal'
      && TRUSTED_CATALOG.includes(new URL(output.primary).hostname as typeof TRUSTED_CATALOG[number]),
    'PCDN source yields a normal built-in Catalog player destination')
    check(output.backups.every(url => parseMediaUrl(url)?.kind === 'normal'),
      'PCDN source yields only normal Catalog backups')
    const dispatched = pcdnRoutes.apply(pcdnSource)
    check(dispatched.url && parseMediaUrl(dispatched.url)?.kind === 'normal'
      && dispatched.decision.routeType === 'catalog-generated',
    'exact PCDN request is safely rewritten to a normal Catalog destination')
    await pcdnRestrictions.add({ host: new URL(pcdnSource).hostname, type: 'black', kind: 'all',
      reason: 'source-only', expireAt: now + 60_000 })
    pcdnRoutes.invalidateForUserSetting()
    check(pcdnRoutes.playerOutput(pcdnRep, pcdnSource, pcdnRoutes.plan(pcdnRep, demand, 'startup'), [pcdnSource]).primary,
      'blacklisted source host does not deny an allowed generated Catalog destination')
    await pcdnSettings.update({ considerNativeSources: true })
    pcdnRoutes.invalidateForUserSetting()
    equal(pcdnVault.candidates(pcdnRep, new Set()).native.length, 0,
      'enabling Native mode still does not authorize the PCDN source')
  }

  const probeClock = scope.own(new FakeClock()), probeStorage = new FakeStorage()
  const probeSettings = scope.own(new SettingsStore(probeStorage, probeClock.now))
  const probeSession = new SessionStore(), probeState = probeSession.beginGeneration(false)
  const probeVault = new SignedRouteVault(); probeVault.reset(probeState.generation, probeState.epoch)
  const probeRoutes = new RouteCoordinator({ now: probeClock.now }, probeSession, probeSettings,
    scope.own(new RestrictionStore(probeStorage, probeClock.now)),
    scope.own(new EvidenceStore(probeStorage, probeClock.now)), probeVault)
  const probeFirst = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/progressive/probe-1.mp4?segment=1'
  const probeSecond = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/progressive/probe-2.mp4?segment=2'
  const probeRep1 = probeVault.register({ generation: probeState.generation, epoch: probeState.epoch, kind: 'video',
    key: 'durl:probe:0', height: 0, codec: 'mp4', bandwidth: 0, urls: [probeFirst], source: 'trusted-api' })
  const probeRep2 = probeVault.register({ generation: probeState.generation, epoch: probeState.epoch, kind: 'video',
    key: 'durl:probe:1', height: 0, codec: 'mp4', bandwidth: 0, urls: [probeSecond], source: 'trusted-api' })
  check(probeRep1 && probeRep2, 'measurement fixture has two independent progressive segments')
  const initialCandidates = probeRoutes.startupOptions(probeFirst)?.candidates ?? []
  equal(initialCandidates.length, 3, 'startup fixture presents exactly three parallel Catalog candidates')
  let inconclusiveCommits = 0, attempted = 0
  const invalidProbe = scope.own(new MeasurementController(measurementRoutes({
    isCatalogOnly: () => true, startupOptions: url => probeRoutes.startupOptions(url),
    noteStartupProbeResult: (candidate, status) => probeRoutes.noteStartupProbeResult(candidate, status),
    commitStartupChoice: (...args) => { inconclusiveCommits++; return probeRoutes.commitStartupChoice(...args) },
  }), new MeasurementMetaStore(new FakeStorage(), probeClock.now), {
    read: async () => { attempted++; return { bytes: 0, elapsedMs: 20, ttfbMs: null, status: 403,
      directRange: false, reason: 'http-403' } },
  }, probeClock.now, probeClock))
  await invalidProbe.prepareStartup(probeFirst)
  equal(attempted, 3, 'cold startup probes only three Catalog candidates')
  equal(inconclusiveCommits, 0, 'Catalog-only startup commits no candidate when every probe is invalid')
  check(probeRoutes.apply(probeFirst).url && !initialCandidates.some(candidate => candidate.host === probeRoutes.apply(probeFirst).decision.host),
    'after three Catalog 403s, ordinary dispatch selects a still-legal host from the full pool')
  check(probeRoutes.startupOptions(probeSecond)?.candidates.some(candidate => candidate.host === initialCandidates[0]?.host),
    'startup 403 exclusion applies to one progressive segment, not the next')
  await invalidProbe.prepareStartup(probeSecond)
  equal(attempted, 3, 'the next progressive segment shares the one-time startup window')

  const timeoutClock = scope.own(new FakeClock())
  let hangingReads = 0, timeoutCommits = 0
  const beforeTimeout = probeRoutes.startupOptions(probeFirst)?.candidates.map(candidate => candidate.host).join('|')
  const timedProbe = scope.own(new MeasurementController(measurementRoutes({
    isCatalogOnly: () => true, startupOptions: url => probeRoutes.startupOptions(url),
    noteStartupProbeResult: (candidate, status) => probeRoutes.noteStartupProbeResult(candidate, status),
    commitStartupChoice: (...args) => { timeoutCommits++; return probeRoutes.commitStartupChoice(...args) },
  }), new MeasurementMetaStore(new FakeStorage(), timeoutClock.now), {
    read: input => new Promise(resolve => { hangingReads++
      input.signal.addEventListener('abort', () => resolve({ bytes: 0, elapsedMs: 3000, ttfbMs: null,
        status: null, directRange: false, reason: 'timeout' }), { once: true }) }),
  }, timeoutClock.now, timeoutClock))
  let timeoutSettled = false
  const timed = timedProbe.prepareStartup(probeFirst).then(() => { timeoutSettled = true })
  equal(hangingReads, 3, 'all three startup probes begin in parallel')
  timeoutClock.advance(2999)
  await Promise.resolve()
  equal(timeoutSettled, false, 'startup gate remains bounded but open before its deadline')
  timeoutClock.advance(1)
  await timed
  equal(timeoutSettled, true, 'startup gate releases at the three-second deadline')
  equal(timeoutCommits, 0, 'timed-out Catalog probes commit no route')
  equal(probeRoutes.startupOptions(probeFirst)?.candidates.map(candidate => candidate.host).join('|'), beforeTimeout,
    'timeouts alone do not mark otherwise legal Catalog hosts dead')

  const belowOptions = probeRoutes.startupOptions(probeSecond)!
  let belowWinner: string | null = null
  const belowProbe = scope.own(new MeasurementController(measurementRoutes({
    isCatalogOnly: () => true, startupOptions: () => ({ ...belowOptions,
      demand: { kind: 'video', requiredMbps: 100, highDemand: true } }),
    commitStartupChoice: (_url, candidate) => { belowWinner = candidate?.host ?? null; return candidate ? { host: candidate.host } : null },
  }), new MeasurementMetaStore(new FakeStorage(), probeClock.now), {
    read: async input => ({ bytes: 70 * 1024, elapsedMs: input.host === belowOptions.candidates[1]?.host ? 200 : 100,
      ttfbMs: 10, status: 206, directRange: true, reason: 'measured' }),
  }, probeClock.now, probeClock))
  await belowProbe.prepareStartup(probeSecond)
  equal(belowWinner, belowOptions.candidates[0]?.host,
    'fastest valid Catalog 206 wins when no sample meets 1.35 times playback demand')

  const nativeOriginal = { ...belowOptions.candidates[0]!, type: 'root-original' as const, original: true }
  let nativeWinner: string | null = null
  const nativeProbe = scope.own(new MeasurementController(measurementRoutes({
    isCatalogOnly: () => false, startupOptions: () => ({ ...belowOptions,
      candidates: [nativeOriginal, ...belowOptions.candidates.slice(1)] }),
    commitStartupChoice: (_url, candidate) => { nativeWinner = candidate?.host ?? null; return candidate ? { host: candidate.host } : null },
  }), new MeasurementMetaStore(new FakeStorage(), probeClock.now), {
    read: async () => ({ bytes: 0, elapsedMs: 50, ttfbMs: null, status: null, directRange: false, reason: 'network' }),
  }, probeClock.now, probeClock))
  await nativeProbe.prepareStartup(probeSecond)
  equal(nativeWinner, nativeOriginal.host, 'Native-enabled inconclusive startup retains its original fallback')

  console.log(`progressive-routing: ${assertionCount()} assertions passed`)
} finally { scope.dispose() }
