import { createRuntimeIds } from "../../src-v2/platform/runtime-ids.ts"
import { FakeClock } from '../support/clock.ts'
import { deferred, countdown } from '../support/deferred.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { playurlResult } from '../support/playurl.ts'
import { measurementRoutes, monitorRoutes, monitorMeasurement, monitorRecovery } from '../support/controllers.ts'
import { RangeProbeAdapter } from '../../src-v2/adapters/range-probe.ts'
import { MeasurementMetaStore } from '../../src-v2/state/measurement-meta-store.ts'
import { decisionId, epochId, generationId, representationId, requestId } from '../../src-v2/domain/model.ts'
import { TRUSTED_CATALOG } from '../../src-v2/domain/catalog.ts'
import { SignedRouteVault } from '../../src-v2/state/signed-route-vault.ts'
import { RestrictionStore } from '../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../src-v2/state/evidence-store.ts'
import { SettingsStore } from '../../src-v2/state/settings-store.ts'
import { SessionStore } from '../../src-v2/state/session-store.ts'
import { RouteCoordinator } from '../../src-v2/application/route-coordinator.ts'
import type { AppliedRouteDecision } from '../../src-v2/application/route-coordinator.ts'
import { RecoveryController } from '../../src-v2/application/recovery-controller.ts'
import { MeasurementController } from '../../src-v2/application/measurement-controller.ts'
import { PlayerMonitor } from '../../src-v2/application/player-monitor.ts'
import { PlayerAdapter } from '../../src-v2/adapters/player.ts'
import type { PlayerPort, VideoSnapshot } from '../../src-v2/application/ports.ts'
import { FakeStorage } from '../support/storage.ts'
import { testScope } from '../support/scope.ts'
import { BrowserScheduler } from '../../src-v2/adapters/scheduler.ts'

// Each call creates fresh resources and replays only this fixture's prerequisite transitions.
// Earlier expectations run in their own cases; no mutable state crosses a test boundary.
async function fixture(t: TestContext, scenario: number, parameter = 0): Promise<() => Promise<void>> {
  const scope = testScope(t)
  const challengeDone = countdown(3), redirectDone = countdown(3), mismatchedDone = countdown(3), missingDone = countdown(3)
const now = 2_000_000_000_000
const clock = { now: () => now }
const storage = new FakeStorage(), restrictions = scope.own(new RestrictionStore(storage, () => now))
const settings = scope.own(new SettingsStore(storage, () => now)), evidenceStore = scope.own(new EvidenceStore(storage, () => now)), session = new SessionStore()
await settings.update({ considerNativeSources: true })
const liveVault = new SignedRouteVault(), state = session.beginGeneration(false)
liveVault.reset(state.generation, state.epoch)
const liveRep = liveVault.register({ generation: state.generation, epoch: state.epoch, kind: 'video', key: '80:av1', height: 1080,
  codec: 'av1', bandwidth: 3_000_000, urls: ['https://upos-sz-mirrorali.bilivideo.com/upgcxcode/c/d/2.m4s?k=1'], source: 'page-hint' })
if (scenario === 0) return async () => {
assert.ok(liveRep, 'controller fixture representation exists')
const coordinator = new RouteCoordinator(clock, session, settings, restrictions, evidenceStore, liveVault, createRuntimeIds())
const opaqueAudioUrl = 'https://upos-hz-mirrorakam.akamaized.net/opaque/audio-segment?signature=private'
const opaqueAudioRep = liveVault.register({ generation: state.generation, epoch: state.epoch, kind: 'audio', key: 'opaque-audio',
  height: 0, codec: 'other', bandwidth: 192_000, urls: [opaqueAudioUrl], source: 'trusted-api' })
assert.ok(opaqueAudioRep, 'trusted opaque audio URL enters observation-only vault')
assert.strictEqual(coordinator.recognizesMedia(opaqueAudioUrl), true, 'current-epoch opaque signed URL enters the media hook')
assert.strictEqual(coordinator.startupOptions(opaqueAudioUrl), null, 'opaque URL cannot start an active probe')
assert.strictEqual(coordinator.apply(opaqueAudioUrl).attributionStatus, 'weak', 'opaque URL cannot create health evidence')
await restrictions.add({ host: 'upos-hz-mirrorakam.akamaized.net', type: 'black', kind: 'all', reason: 'opaque-test', expireAt: now + 60_000 })
assert.strictEqual(coordinator.apply(opaqueAudioUrl).decision.action, 'block', 'opaque exact URL still obeys the blacklist')
assert.strictEqual(coordinator.inspectOriginal(opaqueAudioUrl).decision.action, 'block', 'non-GET opaque URL obeys the blacklist')
}

const coordinator = new RouteCoordinator(clock, session, settings, restrictions, evidenceStore, liveVault, createRuntimeIds())
const opaqueAudioUrl = 'https://upos-hz-mirrorakam.akamaized.net/opaque/audio-segment?signature=private'
const opaqueAudioRep = liveVault.register({ generation: state.generation, epoch: state.epoch, kind: 'audio', key: 'opaque-audio',
  height: 0, codec: 'other', bandwidth: 192_000, urls: [opaqueAudioUrl], source: 'trusted-api' })




await restrictions.add({ host: 'upos-hz-mirrorakam.akamaized.net', type: 'black', kind: 'all', reason: 'opaque-test', expireAt: now + 60_000 })


await restrictions.remove('upos-hz-mirrorakam.akamaized.net', 'black')
if (scenario === 1) return async () => {
if (liveRep) {
  const plan = coordinator.plan(liveRep, { kind: 'video', requiredMbps: 7.5, highDemand: false }, 'startup')
  assert.strictEqual(plan.action, 'pass', 'cold startup preserves the legal original until preflight completes')
  const startupRoot = liveVault.rootUrl(liveRep) ?? ''
  const catalogChoice = coordinator.startupOptions(startupRoot)?.candidates.find(candidate => candidate.type === 'catalog-generated')
  assert.ok(catalogChoice, 'startup offers a Catalog challenger absent from playinfo')
  if (catalogChoice) coordinator.commitStartupChoice(startupRoot, catalogChoice, 'test-preflight')
  const applied = coordinator.apply(startupRoot)
  assert.strictEqual(applied.decision.action, 'rewrite', 'planned catalog decision is applied')
  assert.ok(applied.url?.includes(catalogChoice?.host ?? ''), 'applied URL uses the preflight winner')
  await coordinator.observe({ generation: state.generation, epoch: state.epoch, decisionId: applied.decision.id,
    representation: liveRep, kind: 'video', routeType: 'catalog-generated', originalHost: applied.sourceHost ?? '',
    targetHost: applied.decision.host ?? '', finalHost: applied.decision.host, streamKey: applied.streamKey,
    status: 403, bytes: 0, ttfbMs: 30, elapsedMs: 60, completedAt: now, outcome: 'failure' })
  const restored = coordinator.apply(applied.url ?? '')
  assert.strictEqual(restored.decision.reason, 'host-locked', '403 host-lock is remembered for the exact stream')
  assert.strictEqual(restored.url, liveVault.rootUrl(liveRep), 'host-lock restores exact root signed URL')
  await restrictions.add({ host: 'upos-sz-mirrorali.bilivideo.com', type: 'black', kind: 'all',
    reason: 'cold-start-test', expireAt: now + 60_000 })
  assert.ok(!coordinator.startupOptions(startupRoot)?.candidates.some(candidate => candidate.host === 'upos-sz-mirrorali.bilivideo.com'),
    'startup preflight never probes a blacklisted original host')
  const restrictedFallback = coordinator.apply(startupRoot)
  assert.ok(restrictedFallback.url !== startupRoot && restrictedFallback.decision.host !== 'upos-sz-mirrorali.bilivideo.com',
    'host-locked blacklisted original uses a different legal fallback')
  await restrictions.remove('upos-sz-mirrorali.bilivideo.com', 'black')
}
}
if (liveRep) {
  const plan = coordinator.plan(liveRep, { kind: 'video', requiredMbps: 7.5, highDemand: false }, 'startup')
  const startupRoot = liveVault.rootUrl(liveRep) ?? ''
  const catalogChoice = coordinator.startupOptions(startupRoot)?.candidates.find(candidate => candidate.type === 'catalog-generated')
  if (catalogChoice) coordinator.commitStartupChoice(startupRoot, catalogChoice, 'test-preflight')
  const applied = coordinator.apply(startupRoot)
  await coordinator.observe({ generation: state.generation, epoch: state.epoch, decisionId: applied.decision.id,
    representation: liveRep, kind: 'video', routeType: 'catalog-generated', originalHost: applied.sourceHost ?? '',
    targetHost: applied.decision.host ?? '', finalHost: applied.decision.host, streamKey: applied.streamKey,
    status: 403, bytes: 0, ttfbMs: 30, elapsedMs: 60, completedAt: now, outcome: 'failure' })
  const restored = coordinator.apply(applied.url ?? '')
  await restrictions.add({ host: 'upos-sz-mirrorali.bilivideo.com', type: 'black', kind: 'all',
    reason: 'cold-start-test', expireAt: now + 60_000 })
  const restrictedFallback = coordinator.apply(startupRoot)
  await restrictions.remove('upos-sz-mirrorali.bilivideo.com', 'black')
}
for (let index = 0; index < 40; index++) {
  const group = liveVault.register({ generation: state.generation, epoch: state.epoch, kind: 'video', key: `diagnostic:${index}`,
    height: 1080, codec: 'av1', bandwidth: 3_000_000,
    urls: [`https://upos-sz-mirrorali.bilivideo.com/upgcxcode/c/d/${index + 100}.m4s?k=1`], source: 'page-hint' })
  if (group) coordinator.plan(group, { kind: 'video', requiredMbps: 7.5, highDemand: false }, 'startup')
}
const routeReadModel = coordinator.snapshot()
if (scenario === 2) return async () => {
assert.ok(routeReadModel.planCount > 30, 'many quality groups still enter the route coordinator')
assert.ok(routeReadModel.recentPlans.length <= 4, 'diagnostic route snapshot bounds inactive plans')
assert.ok(![...storage.values.keys()].some(key => !key.startsWith('bilicdn.v2.')), 'stores only use v2 namespace')
let recoveryNow = now, reloads = 0, seeks: number[] = [], rates: number[] = [], plays = 0
let playerSnapshot: VideoSnapshot = { available: true, paused: false, seeking: false, ended: false, readyState: 4,
  currentTime: 349.434, duration: 900, width: 1920, height: 1080, playbackRate: 2, effectiveRate: 2,
  bufferAheadSec: 30, playableBufferSec: 15, bufferedToEnd: false, frames: 1000, mediaError: false,
  coreInitialized: true, manifestHasVideo: true }
const recoveryPlayer: PlayerPort = {
  controls: idleControls,
  observePlayIntent: () => () => undefined, snapshot: () => playerSnapshot, syncManifest: () => true, reload: () => { reloads++ },
  currentTime: () => 349.434, playbackRate: () => 2, seek: value => { seeks.push(value) }, setRate: value => { rates.push(value) },
  play: () => { plays++; return Promise.resolve() }, reset: () => undefined,
}
const recovery = scope.own(new RecoveryController(recoveryPlayer, () => recoveryNow))
recovery.tick(playerSnapshot)
recovery.armRouteFailure('route-failure', playerSnapshot)
playerSnapshot = { ...playerSnapshot, readyState: 0, width: 0, height: 0, currentTime: 349.434, frames: 1000, coreInitialized: false }
recoveryNow += 4000;
recovery.tick(playerSnapshot)
assert.strictEqual(reloads, 1, 'dead core after committed route recovery reloads exactly once')
recoveryNow += 1000;
recovery.tick(playerSnapshot)
assert.strictEqual(reloads, 1, 'dead core does not loop reload')
playerSnapshot = { ...playerSnapshot, readyState: 3, width: 1920, height: 1080, coreInitialized: true, frames: 1 }
recoveryNow += 1000;
recovery.tick(playerSnapshot)
assert.strictEqual(seeks[0], 349.434, 'core recovery restores saved position')
assert.strictEqual(rates[0], 2, 'core recovery restores 2x')
assert.strictEqual(plays, 1, 'core recovery restores play intent once')
}



let recoveryNow = now, reloads = 0, seeks: number[] = [], rates: number[] = [], plays = 0
let playerSnapshot: VideoSnapshot = { available: true, paused: false, seeking: false, ended: false, readyState: 4,
  currentTime: 349.434, duration: 900, width: 1920, height: 1080, playbackRate: 2, effectiveRate: 2,
  bufferAheadSec: 30, playableBufferSec: 15, bufferedToEnd: false, frames: 1000, mediaError: false,
  coreInitialized: true, manifestHasVideo: true }
const recoveryPlayer: PlayerPort = {
  controls: idleControls,
  observePlayIntent: () => () => undefined, snapshot: () => playerSnapshot, syncManifest: () => true, reload: () => { reloads++ },
  currentTime: () => 349.434, playbackRate: () => 2, seek: value => { seeks.push(value) }, setRate: value => { rates.push(value) },
  play: () => { plays++; return Promise.resolve() }, reset: () => undefined,
}
const recovery = scope.own(new RecoveryController(recoveryPlayer, () => recoveryNow))
recovery.tick(playerSnapshot)
recovery.armRouteFailure('route-failure', playerSnapshot)
playerSnapshot = { ...playerSnapshot, readyState: 0, width: 0, height: 0, currentTime: 349.434, frames: 1000, coreInitialized: false }
recoveryNow += 4000;
recovery.tick(playerSnapshot)

recoveryNow += 1000;
recovery.tick(playerSnapshot)

playerSnapshot = { ...playerSnapshot, readyState: 3, width: 1920, height: 1080, coreInitialized: true, frames: 1 }
recoveryNow += 1000;
recovery.tick(playerSnapshot)



const startupSession = new SessionStore(), startupGeneration = startupSession.beginGeneration(false)
const startupVault = new SignedRouteVault();
startupVault.reset(startupGeneration.generation, startupGeneration.epoch)
const startupRoot = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/startup/video.m4s?k=1'
const startupRep = startupVault.register({ generation: startupGeneration.generation, epoch: startupGeneration.epoch,
  kind: 'video', key: 'startup:80', height: 1080, codec: 'av1', bandwidth: 3_000_000, urls: [startupRoot], source: 'trusted-api' })
if (scenario === 3) return async () => {
assert.ok(startupRep, 'startup stall fixture has a representation')
}

let stallNow = now, startupReloads = 0
const stallEvidence = scope.own(new EvidenceStore(new FakeStorage(), () => stallNow))
const stallRestrictions = scope.own(new RestrictionStore(new FakeStorage(), () => stallNow))
const stallSettings = scope.own(new SettingsStore(new FakeStorage(), () => stallNow))
await stallSettings.update({ considerNativeSources: true })
const stallRoutes = new RouteCoordinator({ now: () => stallNow }, startupSession, stallSettings,
  stallRestrictions, stallEvidence, startupVault, createRuntimeIds())
if (scenario === 4) return async () => {
if (startupRep) {
  const exactCatalogBackup = `https://${TRUSTED_CATALOG[0]}/upgcxcode/startup/video.m4s?k=backup-exact`
  startupVault.register({ generation: startupGeneration.generation, epoch: startupGeneration.epoch, kind: 'video',
    key: 'startup:80', height: 1080, codec: 'av1', bandwidth: 3_000_000, urls: [exactCatalogBackup], source: 'trusted-api' })
  const signedBackup = stallRoutes.startupOptions(startupRoot)?.candidates.find(candidate => candidate.host === TRUSTED_CATALOG[0])
  assert.strictEqual(signedBackup?.type, 'native-signed', 'Catalog-host signed backup competes as its own exact Native URL')
  assert.strictEqual(signedBackup?.url, exactCatalogBackup, 'signed backup retains its original query instead of synthesizing a URL')
  const incompatibleCatalog = stallRoutes.startupOptions(startupRoot)?.candidates.find(candidate => candidate.type === 'catalog-generated')
  if (incompatibleCatalog) {
    stallRoutes.noteStartupProbeResult(incompatibleCatalog, 403)
    assert.ok(!stallRoutes.startupOptions(startupRoot)?.candidates.some(candidate => candidate.host === incompatibleCatalog.host),
      'Catalog 403 excludes only this stream-host pairing from startup fallback')
    await stallEvidence.record(incompatibleCatalog.host, 'video', { requestId: 'prior-fast-stream', at: stallNow,
      source: 'transport', outcome: 'success', throughputMbps: 100, ttfbMs: 10, failureKind: null })
    const laterChoice = stallRoutes.plan(startupRep, { kind: 'video', requiredMbps: 8, highDemand: false }, 'new-epoch')
    assert.ok(laterChoice.host !== incompatibleCatalog.host,
      'this-stream 403 remains ineligible at a later route ranking boundary despite global speed evidence')
  }
  const unmatchedStartup = stallRoutes.apply('https://upos-sz-mirrorali.bilivideo.com/upgcxcode/startup/unmatched.m4s?k=1')
  assert.strictEqual(unmatchedStartup.decision.action, 'pass', 'unattributed first media request never blindly rewrites to first Catalog')
  const initial = stallRoutes.apply(startupRoot)
  const fallback = stallRoutes.recoverStartup(startupRep, { kind: 'video', requiredMbps: 8, highDemand: false },
    initial.decision.host ?? '', [])
  assert.ok(fallback && fallback.host !== initial.decision.host, 'unconfirmed startup stall commits a different legal host')
  assert.strictEqual(stallRoutes.apply(startupRoot).decision.host, fallback?.host, 'next startup request uses committed fallback')
  const firstFairProbe = stallRoutes.challenge(startupRep, { kind: 'video', requiredMbps: 8, highDemand: false }, false)
  const secondFairProbe = stallRoutes.challenge(startupRep, { kind: 'video', requiredMbps: 8, highDemand: false }, false)
  assert.ok(firstFairProbe && secondFairProbe && firstFairProbe.decision.host !== secondFairProbe.decision.host,
    'failed or unmeasured challenger is not selected again in the same round')
  if (firstFairProbe) {
    await stallRoutes.recordChallenge(firstFairProbe, 0, 100, 50, 'failure', null)
    assert.strictEqual(stallRoutes.snapshot().affinity, null, 'active probe failure does not change playback affinity')
  }
  const plannedFallback = (stallRoutes.snapshot().fallback).video
  assert.strictEqual(plannedFallback?.stage, 'planned', 'fallback plan is not reported as a sent request')
  const nextFallback = stallRoutes.apply(startupRoot)
  assert.ok(nextFallback.url && nextFallback.decision.host === fallback?.host, 'fallback remains legal for the next request')
  const fallbackRequest = { routePolicyRevision: stallRoutes.policyRevision(), requestId: requestId('fallback-next'), generation: startupGeneration.generation, epoch: startupGeneration.epoch,
    decisionId: nextFallback.decision.id, representation: startupRep, kind: 'video' as const, attributionStatus: 'matched' as const,
    attributionSource: 'exact' as const, decisionStage: 'request' as const, routeType: nextFallback.decision.routeType,
    originalHost: 'upos-sz-mirrorali.bilivideo.com', targetHost: fallback!.host!, sourceHost: 'upos-sz-mirrorali.bilivideo.com',
    playurlHostChanged: false, playurlOutput: null, urlChanged: true, hostChanged: true, startedAt: stallNow }
  stallRoutes.requestStarted({ ...fallbackRequest, requestId: requestId('unrelated-same-host'), decisionId: decisionId('unrelated') })
  assert.strictEqual((stallRoutes.snapshot().fallback).video?.stage, 'planned',
    'a same-host request from another decision cannot impersonate the submitted fallback')
  stallRoutes.requestStarted(fallbackRequest)
  assert.strictEqual((stallRoutes.snapshot().fallback).video?.stage, 'entered-hook',
    'fallback entering the hook is distinct from observed completion')
  await stallRoutes.observe({ request: fallbackRequest, generation: startupGeneration.generation, epoch: startupGeneration.epoch,
    decisionId: fallbackRequest.decisionId, representation: startupRep, kind: 'video', routeType: nextFallback.decision.routeType,
    originalHost: fallbackRequest.originalHost, targetHost: fallbackRequest.targetHost, finalHost: fallbackRequest.targetHost,
    streamKey: nextFallback.streamKey, status: 206, bytes: 100_000, ttfbMs: 20, elapsedMs: 250,
    completedAt: stallNow + 250, outcome: 'success' })
  assert.strictEqual((stallRoutes.snapshot().fallback).video?.stage, 'response-observed',
    'fallback is observed only after its own transport response')
  for (const host of TRUSTED_CATALOG) await stallRestrictions.add({ host, type: 'black', kind: 'all', reason: 'no-route', expireAt: stallNow + 60_000 })
  const noAlternate = stallRoutes.recover(startupRep, { kind: 'video', requiredMbps: 8, highDemand: false },
    'verified-failure', fallback!.host)
  assert.strictEqual(noAlternate.action, 'block', 'all forbidden alternatives yield a blocked recovery decision')
  assert.strictEqual((stallRoutes.snapshot().fallback).video, undefined,
    'no legal fallback clears an older submitted fallback instead of presenting it as current')
  for (const host of TRUSTED_CATALOG) await stallRestrictions.remove(host, 'black')
}
}
if (startupRep) {
  const exactCatalogBackup = `https://${TRUSTED_CATALOG[0]}/upgcxcode/startup/video.m4s?k=backup-exact`
  startupVault.register({ generation: startupGeneration.generation, epoch: startupGeneration.epoch, kind: 'video',
    key: 'startup:80', height: 1080, codec: 'av1', bandwidth: 3_000_000, urls: [exactCatalogBackup], source: 'trusted-api' })
  const signedBackup = stallRoutes.startupOptions(startupRoot)?.candidates.find(candidate => candidate.host === TRUSTED_CATALOG[0])
  const incompatibleCatalog = stallRoutes.startupOptions(startupRoot)?.candidates.find(candidate => candidate.type === 'catalog-generated')
  if (incompatibleCatalog) {
    stallRoutes.noteStartupProbeResult(incompatibleCatalog, 403)
    await stallEvidence.record(incompatibleCatalog.host, 'video', { requestId: 'prior-fast-stream', at: stallNow,
      source: 'transport', outcome: 'success', throughputMbps: 100, ttfbMs: 10, failureKind: null })
    const laterChoice = stallRoutes.plan(startupRep, { kind: 'video', requiredMbps: 8, highDemand: false }, 'new-epoch')
  }
  const unmatchedStartup = stallRoutes.apply('https://upos-sz-mirrorali.bilivideo.com/upgcxcode/startup/unmatched.m4s?k=1')
  const initial = stallRoutes.apply(startupRoot)
  const fallback = stallRoutes.recoverStartup(startupRep, { kind: 'video', requiredMbps: 8, highDemand: false },
    initial.decision.host ?? '', [])
  const firstFairProbe = stallRoutes.challenge(startupRep, { kind: 'video', requiredMbps: 8, highDemand: false }, false)
  const secondFairProbe = stallRoutes.challenge(startupRep, { kind: 'video', requiredMbps: 8, highDemand: false }, false)
  if (firstFairProbe) {
    await stallRoutes.recordChallenge(firstFairProbe, 0, 100, 50, 'failure', null)
  }
  const plannedFallback = (stallRoutes.snapshot().fallback).video
  const nextFallback = stallRoutes.apply(startupRoot)
  const fallbackRequest = { routePolicyRevision: stallRoutes.policyRevision(), requestId: requestId('fallback-next'), generation: startupGeneration.generation, epoch: startupGeneration.epoch,
    decisionId: nextFallback.decision.id, representation: startupRep, kind: 'video' as const, attributionStatus: 'matched' as const,
    attributionSource: 'exact' as const, decisionStage: 'request' as const, routeType: nextFallback.decision.routeType,
    originalHost: 'upos-sz-mirrorali.bilivideo.com', targetHost: fallback!.host!, sourceHost: 'upos-sz-mirrorali.bilivideo.com',
    playurlHostChanged: false, playurlOutput: null, urlChanged: true, hostChanged: true, startedAt: stallNow }
  stallRoutes.requestStarted({ ...fallbackRequest, requestId: requestId('unrelated-same-host'), decisionId: decisionId('unrelated') })
  stallRoutes.requestStarted(fallbackRequest)
  await stallRoutes.observe({ request: fallbackRequest, generation: startupGeneration.generation, epoch: startupGeneration.epoch,
    decisionId: fallbackRequest.decisionId, representation: startupRep, kind: 'video', routeType: nextFallback.decision.routeType,
    originalHost: fallbackRequest.originalHost, targetHost: fallbackRequest.targetHost, finalHost: fallbackRequest.targetHost,
    streamKey: nextFallback.streamKey, status: 206, bytes: 100_000, ttfbMs: 20, elapsedMs: 250,
    completedAt: stallNow + 250, outcome: 'success' })
  for (const host of TRUSTED_CATALOG) await stallRestrictions.add({ host, type: 'black', kind: 'all', reason: 'no-route', expireAt: stallNow + 60_000 })
  const noAlternate = stallRoutes.recover(startupRep, { kind: 'video', requiredMbps: 8, highDemand: false },
    'verified-failure', fallback!.host)
  for (const host of TRUSTED_CATALOG) await stallRestrictions.remove(host, 'black')
}
const incompatibleSession = new SessionStore(), incompatibleState = incompatibleSession.beginGeneration(false)
const incompatibleVault = new SignedRouteVault();
incompatibleVault.reset(incompatibleState.generation, incompatibleState.epoch)
const incompatibleRoot = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/incompatible/segment.m4s?sig=clip'
const incompatibleRep = incompatibleVault.register({ generation: incompatibleState.generation, epoch: incompatibleState.epoch,
  kind: 'video', key: 'incompatible:80', height: 1080, codec: 'av1', bandwidth: 2_000_000,
  urls: [incompatibleRoot], source: 'trusted-api' })
if (scenario === 5) return async () => {
assert.ok(incompatibleRep, 'Catalog incompatibility fixture has a representation')
}

const incompatibleRoutes = new RouteCoordinator(clock, incompatibleSession, scope.own(new SettingsStore(new FakeStorage(), () => now)),
  scope.own(new RestrictionStore(new FakeStorage(), () => now)), scope.own(new EvidenceStore(new FakeStorage(), () => now)), incompatibleVault, createRuntimeIds())
if (scenario === 6) return async () => {
if (incompatibleRep) {
  const badCatalog = incompatibleRoutes.startupOptions(incompatibleRoot)?.candidates.find(candidate => candidate.type === 'catalog-generated')
  assert.ok(badCatalog, 'a Catalog URL can be checked for this stream')
  incompatibleRoutes.commitStartupChoice(incompatibleRoot, badCatalog ?? null, 'startup-preflight')
  const failed = incompatibleRoutes.apply(incompatibleRoot)
  assert.strictEqual(failed.decision.host, badCatalog?.host, 'first media request uses the tested Catalog host')
  await incompatibleRoutes.observe({ generation: incompatibleState.generation, epoch: incompatibleState.epoch,
    decisionId: failed.decision.id, representation: incompatibleRep, kind: 'video', routeType: 'catalog-generated',
    originalHost: new URL(incompatibleRoot).host, targetHost: badCatalog!.host, finalHost: badCatalog!.host,
    streamKey: failed.streamKey, status: 403, bytes: 0, ttfbMs: 40, elapsedMs: 100,
    completedAt: now + 100, outcome: 'failure', responseUrlMatchesRequest: true })
  const after403 = incompatibleRoutes.apply(incompatibleRoot)
  assert.ok(after403.url && after403.decision.host !== badCatalog?.host,
    'a per-stream Catalog 403 permits the next request to use a different legal host')
  assert.strictEqual(after403.decision.host, (incompatibleRoutes.snapshot().fallback).video?.plannedHost,
    'Catalog incompatibility fallback plan is actually used by the next request')
}
}
if (incompatibleRep) {
  const badCatalog = incompatibleRoutes.startupOptions(incompatibleRoot)?.candidates.find(candidate => candidate.type === 'catalog-generated')
  incompatibleRoutes.commitStartupChoice(incompatibleRoot, badCatalog ?? null, 'startup-preflight')
  const failed = incompatibleRoutes.apply(incompatibleRoot)
  await incompatibleRoutes.observe({ generation: incompatibleState.generation, epoch: incompatibleState.epoch,
    decisionId: failed.decision.id, representation: incompatibleRep, kind: 'video', routeType: 'catalog-generated',
    originalHost: new URL(incompatibleRoot).host, targetHost: badCatalog!.host, finalHost: badCatalog!.host,
    streamKey: failed.streamKey, status: 403, bytes: 0, ttfbMs: 40, elapsedMs: 100,
    completedAt: now + 100, outcome: 'failure', responseUrlMatchesRequest: true })
  const after403 = incompatibleRoutes.apply(incompatibleRoot)
}
const deadStartup: VideoSnapshot = { ...playerSnapshot, currentTime: 0, readyState: 0, width: 0, height: 0,
  frames: 0, bufferAheadSec: 0, playableBufferSec: 0, coreInitialized: false, paused: false }
let originalProbeDisabled = false, originalRecoveryTicks = 0, originalFallbacks = 0
const originalMonitor = scope.own(new PlayerMonitor({ ...recoveryPlayer, snapshot: () => deadStartup, syncManifest: () => true } satisfies PlayerPort, startupSession, { get: () => ({ disabled: false }) }, startupVault, monitorRoutes({ observePlaybackRate: () => undefined, firstMediaAt: () => now,
    latestRequested: () => ({ routePolicyRevision: 0, targetHost: 'upos-sz-mirrorali.bilivideo.com', representation: startupRep,
      generation: startupGeneration.generation, epoch: startupGeneration.epoch }),
    recoverStartup: () => { originalFallbacks++; return null }, recover: () => { originalFallbacks++; return null },
    isOriginalComparison: () => true }), monitorMeasurement({ tick: (input: { disabled: boolean }) => { originalProbeDisabled = input.disabled } }), monitorRecovery({ tick: () => { originalRecoveryTicks++ }, isRecovering: () => false }), () => true, () => now + 16_000, new BrowserScheduler()))
for (let i = 0; i < 17; i++) originalMonitor.tick()
if (scenario === 7) return async () => {
assert.ok(originalProbeDisabled && originalRecoveryTicks === 0 && originalFallbacks === 0,
  'original comparison mode neither probes nor initiates script route/core recovery')
const startupRecovery = scope.own(new RecoveryController({ ...recoveryPlayer, snapshot: () => deadStartup, reload: () => { startupReloads++ },
  currentTime: () => 0, playbackRate: () => 1 } satisfies PlayerPort, () => stallNow))
startupRecovery.armStartupFailure(deadStartup)
stallNow += 4000;
startupRecovery.tick(deadStartup)
assert.strictEqual(startupReloads, 1, 'cold-start dead core reloads once despite no prior healthy frames')
stallNow += 4000;
startupRecovery.tick(deadStartup)
assert.strictEqual(startupReloads, 1, 'startup recovery does not loop reload')
let softFallbacks = 0, startupArms = 0
const stallMonitor = scope.own(new PlayerMonitor({ ...recoveryPlayer, snapshot: () => deadStartup, syncManifest: () => true } satisfies PlayerPort, startupSession, scope.own(new SettingsStore(new FakeStorage(), () => stallNow)), startupVault, monitorRoutes({ firstMediaAt: () => now, latestRequested: () => ({ routePolicyRevision: 0, targetHost: 'upos-sz-mirrorali.bilivideo.com', representation: startupRep,
    generation: startupGeneration.generation, epoch: startupGeneration.epoch }),
    recoverStartup: () => { softFallbacks++; return { host: TRUSTED_CATALOG[0] } },
    observePlaybackRate: () => undefined, isOriginalComparison: () => false }), monitorMeasurement({ tick: () => undefined }), monitorRecovery({ tick: () => undefined, isRecovering: () => false, armStartupFailure: () => { startupArms++ } }), () => true, () => stallNow, new BrowserScheduler()))
stallNow = now + 14_000;
stallMonitor.tick()
assert.strictEqual(softFallbacks, 0, 'unconfirmed startup stall waits fifteen seconds')
stallNow = now + 15_000;
stallMonitor.tick()
assert.strictEqual(softFallbacks, 1, 'unconfirmed startup stall submits one different route')
assert.strictEqual(startupArms, 1, 'unconfirmed startup stall arms bounded player recovery')
stallNow = now + 16_000;
stallMonitor.tick()
assert.strictEqual(softFallbacks, 1, 'startup stall fallback is not repeated each tick')
let challengeCalls = 0, challengeFetches = 0, challengeRecords = 0
const directRangeResponse = (url: string, bytes: number): Response => {
  const response = new Response(new Uint8Array(bytes), { status: 206 })
  Object.defineProperty(response, 'url', { value: url })
  return response
}
const challengeApplied: AppliedRouteDecision = { decision: { action: 'rewrite', id: decisionId('challenge'), reason: 'test',
  routeType: 'catalog-generated', host: TRUSTED_CATALOG[1], candidate: { type: 'catalog-generated', host: TRUSTED_CATALOG[1], kind: 'video', catalogIndex: 1 }, ranking: [] },
  url: `https://${TRUSTED_CATALOG[1]}/upgcxcode/a/b/challenge.m4s`, context: { generation: generationId(1), epoch: epochId(1), representation: representationId('video:test'), kind: 'video', authorityRevision: 1 },
  streamKey: 'challenge', sourceHost: TRUSTED_CATALOG[0] }
const challengeRoutes = { isCatalogOnly: () => false,
  challenge: () => { challengeCalls++; return challengeApplied }, recordChallenge: async () => { challengeRecords++; challengeDone.complete() } }
const challengeFetch = async (): Promise<Response> => { challengeFetches++; return directRangeResponse(challengeApplied.url ?? '', 70 * 1024) }
const measurement = scope.own(new MeasurementController(measurementRoutes(challengeRoutes), new MeasurementMetaStore(new FakeStorage(), () => now), new RangeProbeAdapter(challengeFetch as typeof fetch, () => now), () => now, new BrowserScheduler()))
const baseMeasurement = { generationActive: true, representation: representationId('video:test'), demand: { kind: 'video' as const, requiredMbps: 8, highDemand: false },
  stableProgressSec: 20, playableBufferSec: 29, visible: true, seeking: false, recovering: false, disabled: false }
measurement.tick(baseMeasurement)
assert.strictEqual(challengeCalls, 0, 'low buffer prevents challenger selection and network')
}

const startupRecovery = scope.own(new RecoveryController({ ...recoveryPlayer, snapshot: () => deadStartup, reload: () => { startupReloads++ },
  currentTime: () => 0, playbackRate: () => 1 } satisfies PlayerPort, () => stallNow))
startupRecovery.armStartupFailure(deadStartup)
stallNow += 4000;
startupRecovery.tick(deadStartup)

stallNow += 4000;
startupRecovery.tick(deadStartup)

let softFallbacks = 0, startupArms = 0
const stallMonitor = scope.own(new PlayerMonitor({ ...recoveryPlayer, snapshot: () => deadStartup, syncManifest: () => true } satisfies PlayerPort, startupSession, scope.own(new SettingsStore(new FakeStorage(), () => stallNow)), startupVault, monitorRoutes({ firstMediaAt: () => now, latestRequested: () => ({ routePolicyRevision: 0, targetHost: 'upos-sz-mirrorali.bilivideo.com', representation: startupRep,
    generation: startupGeneration.generation, epoch: startupGeneration.epoch }),
    recoverStartup: () => { softFallbacks++; return { host: TRUSTED_CATALOG[0] } },
    observePlaybackRate: () => undefined, isOriginalComparison: () => false }), monitorMeasurement({ tick: () => undefined }), monitorRecovery({ tick: () => undefined, isRecovering: () => false, armStartupFailure: () => { startupArms++ } }), () => true, () => stallNow, new BrowserScheduler()))
stallNow = now + 14_000;
stallMonitor.tick()

stallNow = now + 15_000;
stallMonitor.tick()


stallNow = now + 16_000;
stallMonitor.tick()

let challengeCalls = 0, challengeFetches = 0, challengeRecords = 0
const directRangeResponse = (url: string, bytes: number): Response => {
  const response = new Response(new Uint8Array(bytes), { status: 206 })
  Object.defineProperty(response, 'url', { value: url })
  return response
}
const challengeApplied: AppliedRouteDecision = { decision: { action: 'rewrite', id: decisionId('challenge'), reason: 'test',
  routeType: 'catalog-generated', host: TRUSTED_CATALOG[1], candidate: { type: 'catalog-generated', host: TRUSTED_CATALOG[1], kind: 'video', catalogIndex: 1 }, ranking: [] },
  url: `https://${TRUSTED_CATALOG[1]}/upgcxcode/a/b/challenge.m4s`, context: { generation: generationId(1), epoch: epochId(1), representation: representationId('video:test'), kind: 'video', authorityRevision: 1 },
  streamKey: 'challenge', sourceHost: TRUSTED_CATALOG[0] }
const challengeRoutes = { isCatalogOnly: () => false,
  challenge: () => { challengeCalls++; return challengeApplied }, recordChallenge: async () => { challengeRecords++; challengeDone.complete() } }
const challengeFetch = async (): Promise<Response> => { challengeFetches++; return directRangeResponse(challengeApplied.url ?? '', 70 * 1024) }
const measurement = scope.own(new MeasurementController(measurementRoutes(challengeRoutes), new MeasurementMetaStore(new FakeStorage(), () => now), new RangeProbeAdapter(challengeFetch as typeof fetch, () => now), () => now, new BrowserScheduler()))
const baseMeasurement = { generationActive: true, representation: representationId('video:test'), demand: { kind: 'video' as const, requiredMbps: 8, highDemand: false },
  stableProgressSec: 20, playableBufferSec: 29, visible: true, seeking: false, recovering: false, disabled: false }
measurement.tick(baseMeasurement)

measurement.tick({ ...baseMeasurement, playableBufferSec: 30 })
await challengeDone.promise
if (scenario === 8) return async () => {
assert.strictEqual(challengeCalls, 3, 'safe playback considers up to three fair challengers')
assert.strictEqual(challengeFetches, 3, 'each safe challenger performs one bounded request')
assert.strictEqual(challengeRecords, 3, 'each valid challenger updates evidence once')
let challengeRedirectSetting: RequestRedirect | undefined
const redirectChallengeFetch = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  challengeRedirectSetting = init?.redirect
  if (init?.redirect === 'error') throw new TypeError('redirect refused')
  return new Response(new Uint8Array(70 * 1024), { status: 206 })
}
let redirectedChallengeSamples = 0
const redirectChallengeRoutes = { isCatalogOnly: () => false, challenge: () => challengeApplied,
  recordChallenge: async (_route: unknown, _bytes: number, _elapsed: number, _ttfb: number | null, outcome: string) => {
    if (outcome === 'success') redirectedChallengeSamples++
    redirectDone.complete()
  } }
const redirectChallenge = scope.own(new MeasurementController(measurementRoutes(redirectChallengeRoutes), new MeasurementMetaStore(new FakeStorage(), () => now), new RangeProbeAdapter(redirectChallengeFetch as typeof fetch, () => now), () => now, new BrowserScheduler()))
redirectChallenge.tick({ ...baseMeasurement, playableBufferSec: 30 })
await redirectDone.promise
assert.strictEqual(challengeRedirectSetting, 'error', 'healthy challenge forbids HTTP redirects')
assert.strictEqual(redirectedChallengeSamples, 0, 'redirected challenge cannot add host evidence')
const redirectedResponse = new Response(new Uint8Array(70 * 1024), { status: 206 })
Object.defineProperty(redirectedResponse, 'url', { value: 'https://upos-sz-mirrorhwov.bilivideo.com/upgcxcode/a/b/redirected.m4s' })
let mismatchedChallengeSuccesses = 0
const mismatchedChallenge = scope.own(new MeasurementController(measurementRoutes({ isCatalogOnly: () => false, challenge: () => challengeApplied,
  recordChallenge: async (_route: unknown, _bytes: number, _elapsed: number, _ttfb: number | null, outcome: string) => {
    if (outcome === 'success') mismatchedChallengeSuccesses++
    mismatchedDone.complete()
  } }), new MeasurementMetaStore(new FakeStorage(), () => now), new RangeProbeAdapter((async () => redirectedResponse) as typeof fetch, () => now), () => now, new BrowserScheduler()))
mismatchedChallenge.tick({ ...baseMeasurement, playableBufferSec: 30 })
await mismatchedDone.promise
assert.strictEqual(mismatchedChallengeSuccesses, 0, 'a mismatched response host cannot be credited to the challenged host')
const missingHostChallenge = scope.own(new MeasurementController(measurementRoutes({ isCatalogOnly: () => false, challenge: () => challengeApplied,
  recordChallenge: async (_route: unknown, _bytes: number, _elapsed: number, _ttfb: number | null, outcome: string) => {
    if (outcome === 'success') mismatchedChallengeSuccesses++
    missingDone.complete()
  } }), new MeasurementMetaStore(new FakeStorage(), () => now), new RangeProbeAdapter((async () => new Response(new Uint8Array(70 * 1024), { status: 206 })) as typeof fetch, () => now), () => now, new BrowserScheduler()))
missingHostChallenge.tick({ ...baseMeasurement, playableBufferSec: 30 })
await missingDone.promise
assert.strictEqual(mismatchedChallengeSuccesses, 0, 'a response with no verifiable host cannot create probe evidence')
const preflightOptions = stallRoutes.startupOptions(startupRoot)
assert.ok(preflightOptions && preflightOptions.candidates.length >= 2, 'preflight offers original and legal Catalog candidate')
}



let challengeRedirectSetting: RequestRedirect | undefined
const redirectChallengeFetch = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  challengeRedirectSetting = init?.redirect
  if (init?.redirect === 'error') throw new TypeError('redirect refused')
  return new Response(new Uint8Array(70 * 1024), { status: 206 })
}
let redirectedChallengeSamples = 0
const redirectChallengeRoutes = { isCatalogOnly: () => false, challenge: () => challengeApplied,
  recordChallenge: async (_route: unknown, _bytes: number, _elapsed: number, _ttfb: number | null, outcome: string) => {
    if (outcome === 'success') redirectedChallengeSamples++
    redirectDone.complete()
  } }
const redirectChallenge = scope.own(new MeasurementController(measurementRoutes(redirectChallengeRoutes), new MeasurementMetaStore(new FakeStorage(), () => now), new RangeProbeAdapter(redirectChallengeFetch as typeof fetch, () => now), () => now, new BrowserScheduler()))
redirectChallenge.tick({ ...baseMeasurement, playableBufferSec: 30 })
await redirectDone.promise


const redirectedResponse = new Response(new Uint8Array(70 * 1024), { status: 206 })
Object.defineProperty(redirectedResponse, 'url', { value: 'https://upos-sz-mirrorhwov.bilivideo.com/upgcxcode/a/b/redirected.m4s' })
let mismatchedChallengeSuccesses = 0
const mismatchedChallenge = scope.own(new MeasurementController(measurementRoutes({ isCatalogOnly: () => false, challenge: () => challengeApplied,
  recordChallenge: async (_route: unknown, _bytes: number, _elapsed: number, _ttfb: number | null, outcome: string) => {
    if (outcome === 'success') mismatchedChallengeSuccesses++
    mismatchedDone.complete()
  } }), new MeasurementMetaStore(new FakeStorage(), () => now), new RangeProbeAdapter((async () => redirectedResponse) as typeof fetch, () => now), () => now, new BrowserScheduler()))
mismatchedChallenge.tick({ ...baseMeasurement, playableBufferSec: 30 })
await mismatchedDone.promise

const missingHostChallenge = scope.own(new MeasurementController(measurementRoutes({ isCatalogOnly: () => false, challenge: () => challengeApplied,
  recordChallenge: async (_route: unknown, _bytes: number, _elapsed: number, _ttfb: number | null, outcome: string) => {
    if (outcome === 'success') mismatchedChallengeSuccesses++
    missingDone.complete()
  } }), new MeasurementMetaStore(new FakeStorage(), () => now), new RangeProbeAdapter((async () => new Response(new Uint8Array(70 * 1024), { status: 206 })) as typeof fetch, () => now), () => now, new BrowserScheduler()))
missingHostChallenge.tick({ ...baseMeasurement, playableBufferSec: 30 })
await missingDone.promise

const preflightOptions = stallRoutes.startupOptions(startupRoot)


if (scenario === 9) return async () => {
if (preflightOptions) {
  let preflightFetches = 0, committedHost: string | null = null, startupSamples = 0
  const preflightRoutes = { isCatalogOnly: () => false, startupOptions: () => preflightOptions,
    commitStartupChoice: (_url: string, candidate: { host: string } | null) => {
      committedHost = candidate?.host ?? null
      return candidate ? { host: candidate.host } : null
    }, recordStartupSuccess: async () => { startupSamples++ }, noteStartupProbeResult: () => undefined }
  const preflightFetch = async (input: RequestInfo | URL): Promise<Response> => {
    preflightFetches++
    const host = new URL(String(input)).host
    const length = host === preflightOptions.candidates.find(candidate => candidate.type === 'catalog-generated')?.host ? 256 * 1024 : 70 * 1024
    return directRangeResponse(String(input), length)
  }
  const preflight = scope.own(new MeasurementController(measurementRoutes(preflightRoutes), new MeasurementMetaStore(new FakeStorage(), () => now), new RangeProbeAdapter(preflightFetch as typeof fetch, () => now), () => now, new BrowserScheduler()))
  const abortedStartup = new AbortController(); abortedStartup.abort()
  let abortRejected = false
  try { await preflight.prepareStartup(startupRoot, abortedStartup.signal) } catch { abortRejected = true }
  assert.strictEqual(abortRejected, true, 'already-aborted player request rejects startup gate')
  assert.strictEqual(preflightFetches, 0, 'already-aborted player request starts no probe')
  await preflight.prepareStartup(startupRoot)
  assert.strictEqual(committedHost, preflightOptions.candidates.find(candidate => candidate.type === 'catalog-generated')?.host,
    'faster qualified Catalog wins bounded preflight')
  assert.strictEqual(preflightFetches, preflightOptions.candidates.length, 'cold window probes no more than three distinct routes')
  assert.ok(startupSamples > 0, 'valid full startup sample contributes to later evidence')
  await preflight.prepareStartup(startupRoot)
  assert.strictEqual(preflightFetches, preflightOptions.candidates.length, 'startup preflight runs only once per tab')
  const timeoutRoutes = { ...preflightRoutes, commitStartupChoice: (_url: string, candidate: { host: string } | null) => {
    committedHost = candidate?.host ?? null
    return candidate ? { host: candidate.host } : null
  } }
  let hangingProbes = 0
  const probesStarted = deferred<void>(), deadlineClock = scope.own(new FakeClock())
  const hangingFetch = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    hangingProbes++
    if (hangingProbes === preflightOptions.candidates.length) probesStarted.resolve()
    return await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    })
  }
  const timedPreflight = scope.own(new MeasurementController(measurementRoutes(timeoutRoutes), new MeasurementMetaStore(new FakeStorage(), () => now), new RangeProbeAdapter(hangingFetch as typeof fetch, deadlineClock.now), deadlineClock.now, deadlineClock))
  let gateSettled = false
  const pendingGate = timedPreflight.prepareStartup(startupRoot).then(() => { gateSettled = true })
  await probesStarted.promise
  deadlineClock.advance(2999)
  await Promise.resolve()
  assert.strictEqual(gateSettled, false, 'startup remains pending at 2999 ms')
  deadlineClock.advance(1)
  await pendingGate
  assert.strictEqual(gateSettled, true, 'startup completes at 3000 ms')
  assert.strictEqual(deadlineClock.now(), 2_000_000_003_000, 'cold preflight releases a hanging player request within the three-second window')
  assert.strictEqual(hangingProbes, preflightOptions.candidates.length, 'startup deadline bounds all parallel probes in one window')
  assert.strictEqual(committedHost, preflightOptions.candidates.find(candidate => candidate.original)?.host,
    'inconclusive preflight releases the legal original')
  const cachedHost = preflightOptions.candidates.find(candidate => candidate.type === 'catalog-generated')?.host
  const cachedOptions = { ...preflightOptions, candidates: preflightOptions.candidates.map(candidate =>
    candidate.host === cachedHost ? { ...candidate, cachedSafeMbps: 1000 } : candidate) }
  const ranges = new Map<string, string>()
  const compatibilityFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const host = new URL(String(input)).host
    ranges.set(host, String((init?.headers as Record<string, string> | undefined)?.Range ?? ''))
    return directRangeResponse(String(input), host === cachedHost ? 16 * 1024 : 70 * 1024)
  }
  const cachedPreflight = scope.own(new MeasurementController(measurementRoutes({ ...preflightRoutes, startupOptions: () => cachedOptions }), new MeasurementMetaStore(new FakeStorage(), () => now), new RangeProbeAdapter(compatibilityFetch as typeof fetch, () => now), () => now, new BrowserScheduler()))
  await cachedPreflight.prepareStartup(startupRoot)
  assert.strictEqual(ranges.get(cachedHost ?? ''), 'bytes=0-16383', 'cross-tab Catalog evidence requires only a 16 KiB current-URL compatibility range')
  assert.strictEqual(committedHost, cachedHost, 'compatible recent Catalog sample can win without redownloading a full throughput sample')
  let startupRedirectMode: RequestRedirect | undefined, redirectStartupSamples = 0
  const redirectStartup = scope.own(new MeasurementController(measurementRoutes({ ...preflightRoutes,
    recordStartupSuccess: async () => { redirectStartupSamples++ } }), new MeasurementMetaStore(new FakeStorage(), () => now), new RangeProbeAdapter((async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      startupRedirectMode = init?.redirect
      if (init?.redirect === 'error') throw new TypeError('redirect refused')
      return new Response(new Uint8Array(70 * 1024), { status: 206 })
    }) as typeof fetch, () => now), () => now, new BrowserScheduler()))
  await redirectStartup.prepareStartup(startupRoot)
  assert.strictEqual(startupRedirectMode, 'error', 'startup probes forbid HTTP redirects')
  assert.strictEqual(redirectStartupSamples, 0, 'redirected startup probes create no throughput evidence')
  assert.strictEqual(committedHost, preflightOptions.candidates.find(candidate => candidate.original)?.host,
    'inconclusive redirected startup releases the legal original')
  const wrongHostStartup = scope.own(new MeasurementController(measurementRoutes({ ...preflightRoutes,
    recordStartupSuccess: async () => { redirectStartupSamples++ } }), new MeasurementMetaStore(new FakeStorage(), () => now), new RangeProbeAdapter((async (): Promise<Response> => {
      const response = new Response(new Uint8Array(70 * 1024), { status: 206 })
      Object.defineProperty(response, 'url', { value: 'https://upos-sz-mirrorhwov.bilivideo.com/upgcxcode/a/b/redirected.m4s' })
      return response
    }) as typeof fetch, () => now), () => now, new BrowserScheduler()))
  await wrongHostStartup.prepareStartup(startupRoot)
  assert.strictEqual(redirectStartupSamples, 0, 'mismatched startup response host creates no throughput evidence')
}
}
if (preflightOptions) {
  let preflightFetches = 0, committedHost: string | null = null, startupSamples = 0
  const preflightRoutes = { isCatalogOnly: () => false, startupOptions: () => preflightOptions,
    commitStartupChoice: (_url: string, candidate: { host: string } | null) => {
      committedHost = candidate?.host ?? null
      return candidate ? { host: candidate.host } : null
    }, recordStartupSuccess: async () => { startupSamples++ }, noteStartupProbeResult: () => undefined }
  const preflightFetch = async (input: RequestInfo | URL): Promise<Response> => {
    preflightFetches++
    const host = new URL(String(input)).host
    const length = host === preflightOptions.candidates.find(candidate => candidate.type === 'catalog-generated')?.host ? 256 * 1024 : 70 * 1024
    return directRangeResponse(String(input), length)
  }
  const preflight = scope.own(new MeasurementController(measurementRoutes(preflightRoutes), new MeasurementMetaStore(new FakeStorage(), () => now), new RangeProbeAdapter(preflightFetch as typeof fetch, () => now), () => now, new BrowserScheduler()))
  const abortedStartup = new AbortController(); abortedStartup.abort()
  let abortRejected = false
  try { await preflight.prepareStartup(startupRoot, abortedStartup.signal) } catch { abortRejected = true }
  await preflight.prepareStartup(startupRoot)
  await preflight.prepareStartup(startupRoot)
  const timeoutRoutes = { ...preflightRoutes, commitStartupChoice: (_url: string, candidate: { host: string } | null) => {
    committedHost = candidate?.host ?? null
    return candidate ? { host: candidate.host } : null
  } }
  let hangingProbes = 0
  const probesStarted = deferred<void>(), deadlineClock = scope.own(new FakeClock())
  const hangingFetch = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    hangingProbes++
    if (hangingProbes === preflightOptions.candidates.length) probesStarted.resolve()
    return await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    })
  }
  const timedPreflight = scope.own(new MeasurementController(measurementRoutes(timeoutRoutes), new MeasurementMetaStore(new FakeStorage(), () => now), new RangeProbeAdapter(hangingFetch as typeof fetch, deadlineClock.now), deadlineClock.now, deadlineClock))
  let gateSettled = false
  const pendingGate = timedPreflight.prepareStartup(startupRoot).then(() => { gateSettled = true })
  await probesStarted.promise
  deadlineClock.advance(2999)
  await Promise.resolve()
  assert.strictEqual(gateSettled, false, 'startup remains pending at 2999 ms')
  deadlineClock.advance(1)
  await pendingGate
  assert.strictEqual(gateSettled, true, 'startup completes at 3000 ms')
  const cachedHost = preflightOptions.candidates.find(candidate => candidate.type === 'catalog-generated')?.host
  const cachedOptions = { ...preflightOptions, candidates: preflightOptions.candidates.map(candidate =>
    candidate.host === cachedHost ? { ...candidate, cachedSafeMbps: 1000 } : candidate) }
  const ranges = new Map<string, string>()
  const compatibilityFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const host = new URL(String(input)).host
    ranges.set(host, String((init?.headers as Record<string, string> | undefined)?.Range ?? ''))
    return directRangeResponse(String(input), host === cachedHost ? 16 * 1024 : 70 * 1024)
  }
  const cachedPreflight = scope.own(new MeasurementController(measurementRoutes({ ...preflightRoutes, startupOptions: () => cachedOptions }), new MeasurementMetaStore(new FakeStorage(), () => now), new RangeProbeAdapter(compatibilityFetch as typeof fetch, () => now), () => now, new BrowserScheduler()))
  await cachedPreflight.prepareStartup(startupRoot)
  let startupRedirectMode: RequestRedirect | undefined, redirectStartupSamples = 0
  const redirectStartup = scope.own(new MeasurementController(measurementRoutes({ ...preflightRoutes,
    recordStartupSuccess: async () => { redirectStartupSamples++ } }), new MeasurementMetaStore(new FakeStorage(), () => now), new RangeProbeAdapter((async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      startupRedirectMode = init?.redirect
      if (init?.redirect === 'error') throw new TypeError('redirect refused')
      return new Response(new Uint8Array(70 * 1024), { status: 206 })
    }) as typeof fetch, () => now), () => now, new BrowserScheduler()))
  await redirectStartup.prepareStartup(startupRoot)
  const wrongHostStartup = scope.own(new MeasurementController(measurementRoutes({ ...preflightRoutes,
    recordStartupSuccess: async () => { redirectStartupSamples++ } }), new MeasurementMetaStore(new FakeStorage(), () => now), new RangeProbeAdapter((async (): Promise<Response> => {
      const response = new Response(new Uint8Array(70 * 1024), { status: 206 })
      Object.defineProperty(response, 'url', { value: 'https://upos-sz-mirrorhwov.bilivideo.com/upgcxcode/a/b/redirected.m4s' })
      return response
    }) as typeof fetch, () => now), () => now, new BrowserScheduler()))
  await wrongHostStartup.prepareStartup(startupRoot)
}
// Observing playback must never override the user's speed selection.
let selectedRate = 1, rateWrites = 0, observedRate = 0
const ratePlayer: PlayerPort = { ...recoveryPlayer,
  snapshot: () => ({ ...playerSnapshot, playbackRate: selectedRate, effectiveRate: selectedRate, currentTime: 50 }),
  playbackRate: () => selectedRate, setRate: () => { rateWrites++ },
}
const rateMonitor = scope.own(new PlayerMonitor(ratePlayer, session, settings, new SignedRouteVault(), monitorRoutes({ observePlaybackRate: (rate: number) => { observedRate = rate }, firstMediaAt: () => 0,
    isOriginalComparison: () => false }), monitorMeasurement({ tick: () => undefined }), monitorRecovery({ tick: () => undefined, isRecovering: () => false }), () => true, () => now, new BrowserScheduler()))
if (scenario === 10) {
 let iteration = 0
for (const rate of [1, 1.5, 0.75, 2, 1]) {
 if (iteration++ === parameter) return async () => {
  selectedRate = rate
  rateMonitor.tick(); rateMonitor.tick()
  assert.strictEqual(observedRate, rate, `monitor observes selected ${rate}x`)
}
 }
 throw Error('Unknown fixture parameter')
}
for (const rate of [1, 1.5, 0.75, 2, 1]) {
  selectedRate = rate
  rateMonitor.tick(); rateMonitor.tick()
}

if (scenario === 11) return async () => {
assert.strictEqual(rateWrites, 0, 'repeated monitoring never writes playback speed')
}

const adapterVideo = { isConnected: true, paused: false, seeking: false, ended: false, readyState: 4,
  currentTime: 10, duration: 100, videoWidth: 1920, videoHeight: 1080, playbackRate: 1,
  buffered: { length: 1, start: () => 0, end: () => 70 }, error: null,
} as unknown as HTMLVideoElement
class RateAdapter extends PlayerAdapter {
  override video(): HTMLVideoElement { return adapterVideo }
  override player(): Record<string, unknown> { return { getPlaybackRate: () => null } }
}
const rateAdapter = new RateAdapter({ transform: () => playurlResult(false), lifecycleKey: () => 'test' },
  { scheduler: { timeout: () => () => undefined }, isActuallyVisible: () => true, subscribeControlLoss: () => () => undefined })
if (scenario === 12) {
 let iteration = 0
for (const rate of [1, 1.5, 2, 0.75]) {
 if (iteration++ === parameter) return async () => {
  adapterVideo.playbackRate = rate
  assert.strictEqual(rateAdapter.snapshot().effectiveRate, rate, `adapter uses real ${rate}x for demand`)
  assert.strictEqual(rateAdapter.snapshot().playableBufferSec, 60 / rate, `buffer duration respects ${rate}x`)
  assert.strictEqual(rateAdapter.playbackRate(), rate, 'unavailable player API falls back to video rate')
}
 }
 throw Error('Unknown fixture parameter')
}
for (const rate of [1, 1.5, 2, 0.75]) {
  adapterVideo.playbackRate = rate
}
adapterVideo.playbackRate = Number.NaN
if (scenario === 13) return async () => {
assert.strictEqual(rateAdapter.snapshot().effectiveRate, 2, '2x is only the unknown-rate planning fallback')
let savedRateRestored = 0, rateRecoveryNow = now
const customRatePlayer: PlayerPort = { ...recoveryPlayer, playbackRate: () => 1.5,
  setRate: value => { savedRateRestored = value } }
const customRateRecovery = scope.own(new RecoveryController(customRatePlayer, () => rateRecoveryNow))
const healthyCustomRate = { ...playerSnapshot, playbackRate: 1.5, effectiveRate: 1.5 }
customRateRecovery.tick(healthyCustomRate)
customRateRecovery.armRouteFailure('route-failure', healthyCustomRate)
rateRecoveryNow += 4000
customRateRecovery.tick({ ...healthyCustomRate, readyState: 0, width: 0, height: 0, coreInitialized: false })
rateRecoveryNow += 1000
customRateRecovery.tick({ ...healthyCustomRate, frames: 2 })
assert.strictEqual(savedRateRestored, 1.5, 'core recovery restores the saved user rate, not forced 2x')
}

let savedRateRestored = 0, rateRecoveryNow = now
const customRatePlayer: PlayerPort = { ...recoveryPlayer, playbackRate: () => 1.5,
  setRate: value => { savedRateRestored = value } }
const customRateRecovery = scope.own(new RecoveryController(customRatePlayer, () => rateRecoveryNow))
const healthyCustomRate = { ...playerSnapshot, playbackRate: 1.5, effectiveRate: 1.5 }
customRateRecovery.tick(healthyCustomRate)
customRateRecovery.armRouteFailure('route-failure', healthyCustomRate)
rateRecoveryNow += 4000
customRateRecovery.tick({ ...healthyCustomRate, readyState: 0, width: 0, height: 0, coreInitialized: false })
rateRecoveryNow += 1000
customRateRecovery.tick({ ...healthyCustomRate, frames: 2 })


if (scenario === 14) return async () => {
if (liveRep) {
  const root = liveVault.rootUrl(liveRep)!, lockedHost = new URL(root).host
  await restrictions.add({ host: lockedHost, type: 'dead', kind: 'all', reason: 'host-lock-test', expireAt: now + 60_000 })
  const deadRootFallback = coordinator.apply(root)
  assert.ok(deadRootFallback.url !== root && deadRootFallback.decision.host !== lockedHost,
    'host-lock never restores a dead root and may choose a legal alternative')
  const lockedPlan = coordinator.plan(liveRep, { kind: 'video', requiredMbps: 3, highDemand: false }, 'startup')
  assert.ok(coordinator.playerOutput(liveRep, root, lockedPlan, [root]).primary !== root,
    'host-locked dead root cannot leak through playurl output')
}
}
if (liveRep) {
  const root = liveVault.rootUrl(liveRep)!, lockedHost = new URL(root).host
  await restrictions.add({ host: lockedHost, type: 'dead', kind: 'all', reason: 'host-lock-test', expireAt: now + 60_000 })
  const deadRootFallback = coordinator.apply(root)
  const lockedPlan = coordinator.plan(liveRep, { kind: 'video', requiredMbps: 3, highDemand: false }, 'startup')
}
let shortResumeNow = now
const shortResume = scope.own(new RecoveryController(recoveryPlayer, () => shortResumeNow))
shortResume.tick({ ...playerSnapshot, paused: false })
shortResumeNow += 1000;
shortResume.tick({ ...playerSnapshot, paused: true })
shortResumeNow += 1000;
shortResume.tick({ ...playerSnapshot, paused: false, frames: 100 })
if (scenario === 15) return async () => {
assert.strictEqual(shortResume.snapshot().state, 'healthy', 'normal short resume clears pause-armed diagnostic state')
}

throw Error('Unknown fixture scenario')
}

test("controller fixture representation exists [1]", { timeout: 5000 }, async t => { await (await fixture(t, 0))() })
test("cold startup preserves the legal original until preflight completes [2]", { timeout: 5000 }, async t => { await (await fixture(t, 1))() })
test("many quality groups still enter the route coordinator [3]", { timeout: 5000 }, async t => { await (await fixture(t, 2))() })
test("startup stall fixture has a representation [4]", { timeout: 5000 }, async t => { await (await fixture(t, 3))() })
test("Catalog-host signed backup competes as its own exact Native URL [5]", { timeout: 5000 }, async t => { await (await fixture(t, 4))() })
test("Catalog incompatibility fixture has a representation [6]", { timeout: 5000 }, async t => { await (await fixture(t, 5))() })
test("a Catalog URL can be checked for this stream [7]", { timeout: 5000 }, async t => { await (await fixture(t, 6))() })
test("original comparison mode neither probes nor initiates script route/core recovery [8]", { timeout: 5000 }, async t => { await (await fixture(t, 7))() })
test("safe playback considers up to three fair challengers [9]", { timeout: 5000 }, async t => { await (await fixture(t, 8))() })
test("already-aborted player request rejects startup gate [10]", { timeout: 5000 }, async t => { await (await fixture(t, 9))() })
{
 let parameter = 0
for (const rate of [1, 1.5, 0.75, 2, 1]) {
 const selected = parameter++
 test("`monitor observes selected ${rate}x` [11]" + ` / ${String(rate)} / ${selected}`, { timeout: 5000 }, async t => { await (await fixture(t, 10, selected))() })
}
}
test("repeated monitoring never writes playback speed [12]", { timeout: 5000 }, async t => { await (await fixture(t, 11))() })
{
 let parameter = 0
for (const rate of [1, 1.5, 2, 0.75]) {
 const selected = parameter++
 test("`adapter uses real ${rate}x for demand` [13]" + ` / ${String(rate)} / ${selected}`, { timeout: 5000 }, async t => { await (await fixture(t, 12, selected))() })
}
}
test("2x is only the unknown-rate planning fallback [14]", { timeout: 5000 }, async t => { await (await fixture(t, 13))() })
test("host-lock never restores a dead root and may choose a legal alternative [15]", { timeout: 5000 }, async t => { await (await fixture(t, 14))() })
test("normal short resume clears pause-armed diagnostic state [16]", { timeout: 5000 }, async t => { await (await fixture(t, 15))() })
import '../regressions/functional-races/recovery.ts'
import '../regressions/functional-races/br01.ts'
import '../regressions/functional-races/br06.ts'
import '../regressions/functional-races/br08.ts'
import { idleControls } from "../support/player.ts"
