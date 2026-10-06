import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { PlayurlController } from '../../src-v2/application/playurl-controller.ts'
import { decisionId, epochId, generationId, requestId } from '../../src-v2/domain/model.ts'
import { TRUSTED_CATALOG } from '../../src-v2/domain/catalog.ts'
import { SignedRouteVault } from '../../src-v2/state/signed-route-vault.ts'
import { RestrictionStore } from '../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../src-v2/state/evidence-store.ts'
import { SettingsStore } from '../../src-v2/state/settings-store.ts'
import { SessionStore } from '../../src-v2/state/session-store.ts'
import { RouteCoordinator } from '../../src-v2/application/route-coordinator.ts'
import type { TransportObservation } from '../../src-v2/domain/model.ts'
import { PlayurlAdapter } from '../../src-v2/adapters/playurl.ts'
import { FakeStorage } from '../support/storage.ts'
import { testScope } from '../support/scope.ts'

// Each call creates fresh resources and replays only this fixture's prerequisite transitions.
// Earlier expectations run in their own cases; no mutable state crosses a test boundary.
async function fixture(t: TestContext, scenario: number, parameter = 0): Promise<() => Promise<void>> {
  const scope = testScope(t)
const now = 2_000_000_000_000
const clock = { now: () => now }
const healthyObservation: TransportObservation = { generation: generationId(1), epoch: epochId(1), decisionId: decisionId('aggregate'),
  representation: null, kind: 'video', routeType: 'catalog-generated', originalHost: 'a.example', targetHost: 'b.example', finalHost: 'b.example',
  status: 206, bytes: 100_000, ttfbMs: 20, elapsedMs: 100, completedAt: now, outcome: 'success', streamKey: 'aggregate' }
// Post-release report: a second representation must not revive a startup plan
// after the active video has confirmed a working player fallback.
const transitionStorage = new FakeStorage(), transitionSession = new SessionStore()
const transitionState = transitionSession.beginGeneration(false), transitionVault = new SignedRouteVault()
transitionVault.reset(transitionState.generation, transitionState.epoch)
const transitionSettings = scope.own(new SettingsStore(transitionStorage, () => now))
await transitionSettings.update({ considerNativeSources: true })
const transitionRestrictions = scope.own(new RestrictionStore(transitionStorage, () => now))
const transitionRoutes = new RouteCoordinator(clock, transitionSession, transitionSettings,
  transitionRestrictions, scope.own(new EvidenceStore(transitionStorage, () => now)), transitionVault)
const transitionAdapter = new PlayurlAdapter(new PlayurlController(transitionSession, transitionVault, transitionRoutes, transitionSettings))
const transitionItems = [1080, 720].map((height, index) => ({ id: 80 - index * 16, codecid: 13, height,
  bandwidth: 1_000_000, base_url: `https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/transition/${height}/1.m4s?k=1`,
  backup_url: [`https://upos-hz-mirrorakam.akamaized.net/upgcxcode/transition/${height}/1.m4s?k=2`] }))
transitionAdapter.transform({ data: { dash: { video: transitionItems, audio: [] } } })
const firstTransition = transitionItems[0]!, nextTransition = transitionItems[1]!
const transitionNative = firstTransition.backup_url.find(url => url.includes('.akamaized.net'))!
const transitionApplied = transitionRoutes.apply(transitionNative)
for (let index = 0; index < 2; index++) await transitionRoutes.observe({ ...healthyObservation,
  generation: transitionState.generation, epoch: transitionState.epoch,
  decisionId: transitionApplied.decision.id, representation: transitionApplied.context!.representation,
  routeType: 'native-signed', originalHost: 'upos-hz-mirrorakam.akamaized.net',
  targetHost: 'upos-hz-mirrorakam.akamaized.net', finalHost: 'upos-hz-mirrorakam.akamaized.net', completedAt: now + index })
if (scenario === 0) return async () => {
assert.strictEqual(transitionSession.get().affinity?.host, 'upos-hz-mirrorakam.akamaized.net', 'first group establishes observed Native affinity')
const nextTransitionApplied = transitionRoutes.apply(nextTransition.base_url)
assert.strictEqual(nextTransitionApplied.url, nextTransition.backup_url.find(url => url.includes('.akamaized.net')),
  'new quality uses its own exact Native URL instead of reviving its startup Catalog plan')
assert.strictEqual(transitionSession.get().affinity?.representation, transitionApplied.context!.representation,
  'planning another quality does not fabricate observed affinity')
const missingNativeItem = { id: 32, codecid: 13, height: 480, bandwidth: 500_000,
  base_url: 'https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/transition/480/1.m4s?k=1', backup_url: [] as string[] }
transitionAdapter.transform({ data: { dash: { video: [missingNativeItem], audio: [] } } })
const missingNativeApplied = transitionRoutes.apply(missingNativeItem.base_url)
assert.ok(missingNativeApplied.url && !missingNativeApplied.url.includes('.akamaized.net'),
  'quality missing an exact Native capability falls back without synthesizing Native URL')
const observedTransitionHost = new URL(nextTransitionApplied.url!).host
await transitionSettings.update({ fixedHost: TRUSTED_CATALOG[3] })
transitionRoutes.invalidateForUserSetting()
assert.strictEqual(transitionRoutes.apply(nextTransition.base_url).decision.host, TRUSTED_CATALOG[3],
  'explicit fixed CDN overrides inherited Native affinity')
assert.ok(observedTransitionHost !== TRUSTED_CATALOG[3], 'fixed-mode test uses a genuinely different host')
await transitionSettings.update({ fixedHost: null })
transitionRoutes.invalidateForUserSetting()
for (let index = 0; index < 2; index++) await transitionRoutes.observe({ ...healthyObservation,
  generation: transitionState.generation, epoch: transitionState.epoch,
  decisionId: transitionApplied.decision.id, representation: transitionApplied.context!.representation,
  routeType: 'native-signed', targetHost: observedTransitionHost, finalHost: observedTransitionHost, completedAt: now + 10 + index })
const restrictedTransition = { id: 16, codecid: 13, height: 360, bandwidth: 300_000,
  base_url: 'https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/transition/360/1.m4s?k=1',
  backup_url: ['https://upos-hz-mirrorakam.akamaized.net/upgcxcode/transition/360/1.m4s?k=2'] }
transitionAdapter.transform({ data: { dash: { video: [restrictedTransition], audio: [] } } })
await transitionRestrictions.add({ host: observedTransitionHost, type: 'black', kind: 'all', reason: 'regression', expireAt: now + 60_000 })
assert.ok(transitionRoutes.apply(restrictedTransition.base_url).decision.host !== observedTransitionHost,
  'first-use affinity inheritance cannot bypass a newly blacklisted Native host')
// Native source permission is a routing boundary, including URLs the player already received.
const catalogStorage = new FakeStorage(), catalogSettings = scope.own(new SettingsStore(catalogStorage, () => now))
const catalogSession = new SessionStore(), catalogState = catalogSession.beginGeneration(false)
const catalogVault = new SignedRouteVault();
catalogVault.reset(catalogState.generation, catalogState.epoch)
const catalogRestrictions = scope.own(new RestrictionStore(catalogStorage, () => now))
const catalogEvidence = scope.own(new EvidenceStore(catalogStorage, () => now))
const catalogRoutes = new RouteCoordinator(clock, catalogSession, catalogSettings, catalogRestrictions, catalogEvidence, catalogVault)
const catalogAdapter = new PlayurlAdapter(new PlayurlController(catalogSession, catalogVault, catalogRoutes, catalogSettings))
const catalogVideoRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/catalog-only/video.m4s?signature=video-root'
const catalogVideoBackup = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/catalog-only/backup/video-alt.m4s?signature=video-backup&part=2'
const catalogAudioRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/catalog-only/audio.m4s?signature=audio-root'
const catalogVideo = { id: 80, codecid: 13, height: 1080, bandwidth: 2_000_000,
  base_url: catalogVideoRoot, backup_url: [catalogVideoBackup] }
const catalogAudio = { id: 30280, bandwidth: 192_000, base_url: catalogAudioRoot,
  backup_url: [] as string[] }
assert.ok(catalogAdapter.transform({ data: { dash: { video: [catalogVideo], audio: [catalogAudio] } } }).accepted,
  'Catalog-only fixture adopts trusted video and audio playurl')
}
void (transitionSession.get().affinity?.host);
void ('upos-hz-mirrorakam.akamaized.net');
const nextTransitionApplied = transitionRoutes.apply(nextTransition.base_url)
void (nextTransitionApplied.url);
void (nextTransition.backup_url.find(url => url.includes('.akamaized.net')));
void (transitionSession.get().affinity?.representation);
void (transitionApplied.context!.representation);
const missingNativeItem = { id: 32, codecid: 13, height: 480, bandwidth: 500_000,
  base_url: 'https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/transition/480/1.m4s?k=1', backup_url: [] as string[] }
transitionAdapter.transform({ data: { dash: { video: [missingNativeItem], audio: [] } } })
const missingNativeApplied = transitionRoutes.apply(missingNativeItem.base_url)
void (missingNativeApplied.url && !missingNativeApplied.url.includes('.akamaized.net'));
const observedTransitionHost = new URL(nextTransitionApplied.url!).host
await transitionSettings.update({ fixedHost: TRUSTED_CATALOG[3] })
transitionRoutes.invalidateForUserSetting()
void (transitionRoutes.apply(nextTransition.base_url).decision.host);
void (TRUSTED_CATALOG[3]);
void (observedTransitionHost !== TRUSTED_CATALOG[3]);
await transitionSettings.update({ fixedHost: null })
transitionRoutes.invalidateForUserSetting()
for (let index = 0; index < 2; index++) await transitionRoutes.observe({ ...healthyObservation,
  generation: transitionState.generation, epoch: transitionState.epoch,
  decisionId: transitionApplied.decision.id, representation: transitionApplied.context!.representation,
  routeType: 'native-signed', targetHost: observedTransitionHost, finalHost: observedTransitionHost, completedAt: now + 10 + index })
const restrictedTransition = { id: 16, codecid: 13, height: 360, bandwidth: 300_000,
  base_url: 'https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/transition/360/1.m4s?k=1',
  backup_url: ['https://upos-hz-mirrorakam.akamaized.net/upgcxcode/transition/360/1.m4s?k=2'] }
transitionAdapter.transform({ data: { dash: { video: [restrictedTransition], audio: [] } } })
await transitionRestrictions.add({ host: observedTransitionHost, type: 'black', kind: 'all', reason: 'regression', expireAt: now + 60_000 })
void (transitionRoutes.apply(restrictedTransition.base_url).decision.host !== observedTransitionHost);
// Native source permission is a routing boundary, including URLs the player already received.
const catalogStorage = new FakeStorage(), catalogSettings = scope.own(new SettingsStore(catalogStorage, () => now))
const catalogSession = new SessionStore(), catalogState = catalogSession.beginGeneration(false)
const catalogVault = new SignedRouteVault();
catalogVault.reset(catalogState.generation, catalogState.epoch)
const catalogRestrictions = scope.own(new RestrictionStore(catalogStorage, () => now))
const catalogEvidence = scope.own(new EvidenceStore(catalogStorage, () => now))
const catalogRoutes = new RouteCoordinator(clock, catalogSession, catalogSettings, catalogRestrictions, catalogEvidence, catalogVault)
const catalogAdapter = new PlayurlAdapter(new PlayurlController(catalogSession, catalogVault, catalogRoutes, catalogSettings))
const catalogVideoRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/catalog-only/video.m4s?signature=video-root'
const catalogVideoBackup = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/catalog-only/backup/video-alt.m4s?signature=video-backup&part=2'
const catalogAudioRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/catalog-only/audio.m4s?signature=audio-root'
const catalogVideo = { id: 80, codecid: 13, height: 1080, bandwidth: 2_000_000,
  base_url: catalogVideoRoot, backup_url: [catalogVideoBackup] }
const catalogAudio = { id: 30280, bandwidth: 192_000, base_url: catalogAudioRoot,
  backup_url: [] as string[] }
void (catalogAdapter.transform({ data: { dash: { video: [catalogVideo], audio: [catalogAudio] } } }).accepted);
const catalogVideoRep = catalogVault.contextForUrl(catalogVideoRoot)?.representation
const catalogAudioRep = catalogVault.contextForUrl(catalogAudioRoot)?.representation
if (scenario === 1) return async () => {
assert.ok(catalogVideoRep && catalogAudioRep, 'Catalog-only fixture retains both original URLs privately for attribution')
}
void (catalogVideoRep && catalogAudioRep);
const catalogDemand = { kind: 'video' as const, requiredMbps: 5, highDemand: false }
if (scenario === 2) return async () => {
if (catalogVideoRep && catalogAudioRep) {
  const options = catalogRoutes.startupOptions(catalogVideoRoot)
  assert.ok(options && options.candidates.length > 0, 'Catalog-only startup has legal candidates')
  assert.ok(options?.candidates.every(candidate => candidate.type === 'catalog-generated' && !candidate.original),
    'Catalog-only startup never probes original or Native backup')
  const catalogPlan = catalogRoutes.plan(catalogVideoRep, catalogDemand, 'startup')
  assert.strictEqual(catalogPlan.routeType, 'catalog-generated', 'Catalog-only startup plan never chooses Native')
  assert.strictEqual(catalogRoutes.apply(catalogVideoRoot).decision.routeType, 'catalog-generated',
    'Catalog-only video request uses a Catalog decision')
  assert.strictEqual(catalogRoutes.apply(catalogAudioRoot).decision.routeType, 'catalog-generated',
    'Catalog-only audio request uses a Catalog decision')
  assert.ok([catalogVideo.base_url, ...catalogVideo.backup_url, catalogAudio.base_url, ...catalogAudio.backup_url]
    .every(url => !!url && TRUSTED_CATALOG.includes(new URL(url).host as typeof TRUSTED_CATALOG[number])),
  'Catalog-only player primary and backup URLs all use built-in Catalog hosts')
  assert.ok(![catalogVideo.base_url, ...catalogVideo.backup_url].includes(catalogVideoBackup),
    'Catalog-only player output does not reuse the exact signed Native backup')
  const signedBackupApplied = catalogRoutes.apply(catalogVideoBackup)
  assert.ok(signedBackupApplied.url && signedBackupApplied.decision.routeType === 'catalog-generated',
    'current-epoch signed backup is reselected through a Catalog decision')
  if (signedBackupApplied.url) {
    const requested = new URL(catalogVideoBackup), sent = new URL(signedBackupApplied.url)
    assert.strictEqual(`${sent.pathname}${sent.search}`, `${requested.pathname}${requested.search}`,
      'Catalog rewrite of signed backup preserves the requested backup path and query')
  }
  const deliveredCatalogBackup = catalogVideo.backup_url.find(url => new URL(url).host !== new URL(catalogVideo.base_url).host)
  assert.ok(deliveredCatalogBackup, 'Catalog-only playurl delivers a distinct Catalog backup')
  if (deliveredCatalogBackup) {
    const deliveredApplied = catalogRoutes.apply(deliveredCatalogBackup)
    assert.strictEqual(deliveredApplied.decision.routeType, 'catalog-generated', 'delivered Catalog backup retains Catalog provenance')
    assert.strictEqual(deliveredApplied.url, deliveredCatalogBackup,
      'delivered Catalog backup stays on the URL the player requested')
  }
  const challenger = catalogRoutes.challenge(catalogVideoRep, catalogDemand, true)
  assert.strictEqual(challenger?.decision.routeType, 'catalog-generated', 'prefer-Native healthy exploration remains Catalog-only')
  const failedCatalog = options?.candidates.find(candidate => candidate.type === 'catalog-generated')
  if (failedCatalog) {
    catalogRoutes.noteStartupProbeResult(failedCatalog, 403)
    assert.ok(!catalogRoutes.startupOptions(catalogVideoRoot)?.candidates.some(candidate => candidate.host === failedCatalog.host),
      'Catalog 403 removes that stream-host pairing from Catalog-only preflight')
    assert.ok(catalogRoutes.plan(catalogVideoRep, catalogDemand, 'new-epoch').host !== failedCatalog.host,
      'Catalog-only ranking does not revive a Catalog 403 host')
  }
}
}
if (catalogVideoRep && catalogAudioRep) {
  const options = catalogRoutes.startupOptions(catalogVideoRoot)
void (options && options.candidates.length > 0);
void (options?.candidates.every(candidate => candidate.type === 'catalog-generated' && !candidate.original));
  const catalogPlan = catalogRoutes.plan(catalogVideoRep, catalogDemand, 'startup')
void (catalogPlan.routeType);
void ('catalog-generated');
void (catalogRoutes.apply(catalogVideoRoot).decision.routeType);
void ('catalog-generated');
void (catalogRoutes.apply(catalogAudioRoot).decision.routeType);
void ('catalog-generated');
void ([catalogVideo.base_url, ...catalogVideo.backup_url, catalogAudio.base_url, ...catalogAudio.backup_url]
    .every(url => !!url && TRUSTED_CATALOG.includes(new URL(url).host as typeof TRUSTED_CATALOG[number])));
void (![catalogVideo.base_url, ...catalogVideo.backup_url].includes(catalogVideoBackup));
  const signedBackupApplied = catalogRoutes.apply(catalogVideoBackup)
void (signedBackupApplied.url && signedBackupApplied.decision.routeType === 'catalog-generated');
  if (signedBackupApplied.url) {
    const requested = new URL(catalogVideoBackup), sent = new URL(signedBackupApplied.url)
void (`${sent.pathname}${sent.search}`);
void (`${requested.pathname}${requested.search}`);
  }
  const deliveredCatalogBackup = catalogVideo.backup_url.find(url => new URL(url).host !== new URL(catalogVideo.base_url).host)
void (deliveredCatalogBackup);
  if (deliveredCatalogBackup) {
    const deliveredApplied = catalogRoutes.apply(deliveredCatalogBackup)
void (deliveredApplied.decision.routeType);
void ('catalog-generated');
void (deliveredApplied.url);
void (deliveredCatalogBackup);
  }
  const challenger = catalogRoutes.challenge(catalogVideoRep, catalogDemand, true)
void (challenger?.decision.routeType);
void ('catalog-generated');
  const failedCatalog = options?.candidates.find(candidate => candidate.type === 'catalog-generated')
  if (failedCatalog) {
    catalogRoutes.noteStartupProbeResult(failedCatalog, 403)
void (!catalogRoutes.startupOptions(catalogVideoRoot)?.candidates.some(candidate => candidate.host === failedCatalog.host));
void (catalogRoutes.plan(catalogVideoRep, catalogDemand, 'new-epoch').host !== failedCatalog.host);
  }
}
const opaqueCatalogUrl = 'https://upos-hz-mirrorakam.akamaized.net/opaque/catalog-only-audio?signature=opaque'
const opaqueCatalogItem = { id: 30281, bandwidth: 192_000, base_url: opaqueCatalogUrl, backup_url: [] as string[] }
catalogAdapter.transform({ data: { dash: { video: [], audio: [opaqueCatalogItem] } } }, 'page-hint')
if (scenario === 3) return async () => {
assert.strictEqual(opaqueCatalogItem.base_url, '', 'opaque signed B station audio is removed from Catalog-only player output')
assert.strictEqual(catalogRoutes.apply(opaqueCatalogUrl).decision.reason, 'catalog-unreplaceable',
  'opaque signed B station audio blocks rather than passing its Native URL')
assert.strictEqual(catalogRoutes.inspectOriginal(catalogVideoRoot).decision.reason, 'catalog-only-non-get',
  'recognized non-GET B station media cannot pass its Native URL')
assert.strictEqual(catalogRoutes.apply('https://upos-hz-mirrorakam.akamaized.net/live-bvc/catalog-only.m4s').decision.reason,
  'catalog-unreplaceable', 'non-replaceable B station media cannot pass its Native URL')
assert.strictEqual(catalogRoutes.apply('https://cdn.example.net/unrelated/media.bin').decision.action, 'pass',
  'unattributed third-party media keeps its original route')
await catalogSettings.update({ fixedHost: TRUSTED_CATALOG[3] })
catalogRoutes.invalidateForUserSetting()
assert.strictEqual(catalogRoutes.apply(catalogVideoRoot).decision.host, TRUSTED_CATALOG[3],
  'Catalog-only fixed host selects the requested legal Catalog node')
await catalogSettings.update({ fixedHost: null, catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map(host => [host, false])) })
catalogRoutes.invalidateForUserSetting()
assert.strictEqual(catalogRoutes.apply(catalogVideoRoot).decision.reason, 'catalog-unavailable',
  'no legal Catalog candidate blocks the original media request')
}
void (opaqueCatalogItem.base_url);
void ('');
void (catalogRoutes.apply(opaqueCatalogUrl).decision.reason);
void ('catalog-unreplaceable');
void (catalogRoutes.inspectOriginal(catalogVideoRoot).decision.reason);
void ('catalog-only-non-get');
void (catalogRoutes.apply('https://upos-hz-mirrorakam.akamaized.net/live-bvc/catalog-only.m4s').decision.reason);
void ('catalog-unreplaceable');
void (catalogRoutes.apply('https://cdn.example.net/unrelated/media.bin').decision.action);
void ('pass');
await catalogSettings.update({ fixedHost: TRUSTED_CATALOG[3] })
catalogRoutes.invalidateForUserSetting()
void (catalogRoutes.apply(catalogVideoRoot).decision.host);
void (TRUSTED_CATALOG[3]);
await catalogSettings.update({ fixedHost: null, catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map(host => [host, false])) })
catalogRoutes.invalidateForUserSetting()
void (catalogRoutes.apply(catalogVideoRoot).decision.reason);
void ('catalog-unavailable');

if (scenario === 4) return async () => {
if (catalogVideoRep) assert.strictEqual(catalogRoutes.challenge(catalogVideoRep, catalogDemand, true), null,
  'no legal Catalog candidate starts no healthy probe')
}
if (catalogVideoRep)
{void (catalogRoutes.challenge(catalogVideoRep, catalogDemand, true));
void (null);}
const noCatalogOutput = { id: 80, codecid: 13, height: 1080, bandwidth: 2_000_000,
  base_url: catalogVideoRoot, backup_url: [catalogVideoBackup] }
catalogAdapter.transform({ data: { dash: { video: [noCatalogOutput], audio: [] } } })
if (scenario === 5) return async () => {
assert.strictEqual(noCatalogOutput.base_url, '', 'no legal Catalog candidate emits no player primary')
assert.strictEqual(noCatalogOutput.backup_url.length, 0, 'no legal Catalog candidate emits no player backups')
catalogRoutes.setOriginalComparison(true)
assert.strictEqual(catalogRoutes.apply(catalogVideoRoot).url, catalogVideoRoot,
  'per-tab original comparison overrides saved Catalog-only mode')
}
void (noCatalogOutput.base_url);
void ('');
void (noCatalogOutput.backup_url.length);
void (0);
catalogRoutes.setOriginalComparison(true)
void (catalogRoutes.apply(catalogVideoRoot).url);
void (catalogVideoRoot);
catalogRoutes.setOriginalComparison(false)
await catalogSettings.update({ considerNativeSources: true, catalogOverrides: {} })
catalogRoutes.invalidateForUserSetting()
if (scenario === 6) return async () => {
if (catalogVideoRep) {
  const legacyPlan = catalogRoutes.plan(catalogVideoRep, catalogDemand, 'startup')
  assert.strictEqual(legacyPlan.routeType, 'root-original', 'enabling Native sources preserves cold-start original route')
  const nativeStartup = catalogRoutes.startupOptions(catalogVideoRoot)?.candidates.find(candidate => candidate.original)
  assert.ok(nativeStartup, 'enabled Native mode includes the original in preflight')
  const enabledOutput = catalogRoutes.playerOutput(catalogVideoRep, catalogVideoRoot, legacyPlan,
    [catalogVideoRoot, catalogVideoBackup])
  assert.strictEqual(enabledOutput.primary, catalogVideoRoot, 'enabled Native mode may offer the exact original primary')
  assert.ok(enabledOutput.backups.includes(catalogVideoBackup), 'enabled Native mode may offer an exact Native backup')
  await catalogSettings.update({ considerNativeSources: false })
  catalogRoutes.invalidateForUserSetting()
  assert.strictEqual(catalogRoutes.commitStartupChoice(catalogVideoRoot, nativeStartup ?? null, 'late-preflight'), null,
    'late Native startup result cannot commit after switch to Catalog-only')
  if (nativeStartup) {
    await catalogRoutes.recordStartupSuccess(nativeStartup, 70 * 1024, 100, 10)
    assert.strictEqual(catalogEvidence.get(nativeStartup.host, 'video'), null,
      'late Native preflight cannot add new health evidence after switch')
  }
  assert.strictEqual(catalogRoutes.apply(catalogVideoBackup).decision.routeType, 'catalog-generated',
    'old player Native backup is rechecked as a Catalog decision after switch')
  assert.strictEqual(catalogSession.get().affinity, null, 'Native permission switch invalidates route affinity')
}
}
if (catalogVideoRep) {
  const legacyPlan = catalogRoutes.plan(catalogVideoRep, catalogDemand, 'startup')
void (legacyPlan.routeType);
void ('root-original');
  const nativeStartup = catalogRoutes.startupOptions(catalogVideoRoot)?.candidates.find(candidate => candidate.original)
void (nativeStartup);
  const enabledOutput = catalogRoutes.playerOutput(catalogVideoRep, catalogVideoRoot, legacyPlan,
    [catalogVideoRoot, catalogVideoBackup])
void (enabledOutput.primary);
void (catalogVideoRoot);
void (enabledOutput.backups.includes(catalogVideoBackup));
  await catalogSettings.update({ considerNativeSources: false })
  catalogRoutes.invalidateForUserSetting()
void (catalogRoutes.commitStartupChoice(catalogVideoRoot, nativeStartup ?? null, 'late-preflight'));
void (null);
  if (nativeStartup) {
    await catalogRoutes.recordStartupSuccess(nativeStartup, 70 * 1024, 100, 10)
void (catalogEvidence.get(nativeStartup.host, 'video'));
void (null);
  }
void (catalogRoutes.apply(catalogVideoBackup).decision.routeType);
void ('catalog-generated');
void (catalogSession.get().affinity);
void (null);
}
const overlapStorage = new FakeStorage(), overlapSession = new SessionStore()
const overlapState = overlapSession.beginGeneration(false), overlapVault = new SignedRouteVault()
overlapVault.reset(overlapState.generation, overlapState.epoch)
const overlapRoot = `https://${TRUSTED_CATALOG[0]}/upgcxcode/catalog-overlap/video.m4s?signature=same-url`
const overlapRep = overlapVault.register({ generation: overlapState.generation, epoch: overlapState.epoch,
  kind: 'video', key: 'overlap', height: 1080, codec: 'av1', bandwidth: 1_000_000,
  urls: [overlapRoot], source: 'trusted-api' })
const overlapRoutes = new RouteCoordinator(clock, overlapSession, scope.own(new SettingsStore(overlapStorage, () => now)),
  scope.own(new RestrictionStore(overlapStorage, () => now)), scope.own(new EvidenceStore(overlapStorage, () => now)), overlapVault)
if (scenario === 7) return async () => {
if (overlapRep) {
  const sameUrlCatalog = overlapRoutes.apply(overlapRoot)
  assert.strictEqual(sameUrlCatalog.url, overlapRoot, 'Catalog decision may yield the exact same URL as the original')
  assert.strictEqual(sameUrlCatalog.decision.routeType, 'catalog-generated',
    'same-host overlap is authorized by Catalog provenance, not Native provenance')
  await overlapRoutes.observe({ generation: overlapState.generation, epoch: overlapState.epoch,
    decisionId: sameUrlCatalog.decision.id, representation: overlapRep, kind: 'video', routeType: 'catalog-generated',
    originalHost: new URL(overlapRoot).host, targetHost: sameUrlCatalog.decision.host ?? '',
    finalHost: sameUrlCatalog.decision.host, responseUrlMatchesRequest: true,
    streamKey: sameUrlCatalog.streamKey, status: 403, bytes: 0, ttfbMs: 20, elapsedMs: 100,
    completedAt: now + 1, outcome: 'failure' })
  const afterOverlap403 = overlapRoutes.apply(overlapRoot)
  assert.ok(afterOverlap403.decision.routeType === 'catalog-generated'
    && afterOverlap403.decision.host !== sameUrlCatalog.decision.host,
  'Catalog 403 invalidates stream-host pairing even when original host equals Catalog target')
}
}
if (overlapRep) {
  const sameUrlCatalog = overlapRoutes.apply(overlapRoot)
void (sameUrlCatalog.url);
void (overlapRoot);
void (sameUrlCatalog.decision.routeType);
void ('catalog-generated');
  await overlapRoutes.observe({ generation: overlapState.generation, epoch: overlapState.epoch,
    decisionId: sameUrlCatalog.decision.id, representation: overlapRep, kind: 'video', routeType: 'catalog-generated',
    originalHost: new URL(overlapRoot).host, targetHost: sameUrlCatalog.decision.host ?? '',
    finalHost: sameUrlCatalog.decision.host, responseUrlMatchesRequest: true,
    streamKey: sameUrlCatalog.streamKey, status: 403, bytes: 0, ttfbMs: 20, elapsedMs: 100,
    completedAt: now + 1, outcome: 'failure' })
  const afterOverlap403 = overlapRoutes.apply(overlapRoot)
void (afterOverlap403.decision.routeType === 'catalog-generated'
    && afterOverlap403.decision.host !== sameUrlCatalog.decision.host);
}
const backup403Storage = new FakeStorage(), backup403Session = new SessionStore()
const backup403State = backup403Session.beginGeneration(false), backup403Vault = new SignedRouteVault()
backup403Vault.reset(backup403State.generation, backup403State.epoch)
const backup403Root = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/backup-403/root.m4s?signature=root'
const backup403Url = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/backup-403/other.m4s?signature=backup'
const backup403Rep = backup403Vault.register({ generation: backup403State.generation, epoch: backup403State.epoch,
  kind: 'video', key: 'backup-403', height: 1080, codec: 'av1', bandwidth: 1_000_000,
  urls: [backup403Root, backup403Url], source: 'trusted-api' })
if (scenario === 8) return async () => {
assert.ok(backup403Rep, 'known backup 403 fixture has a current-epoch representation')
const backup403Routes = new RouteCoordinator(clock, backup403Session, scope.own(new SettingsStore(backup403Storage, () => now)),
  scope.own(new RestrictionStore(backup403Storage, () => now)), scope.own(new EvidenceStore(backup403Storage, () => now)), backup403Vault)
const backup403First = backup403Routes.apply(backup403Url)
assert.strictEqual(backup403First.decision.routeType, 'catalog-generated', 'known signed backup initially selects Catalog')
await backup403Routes.observe({ generation: backup403State.generation, epoch: backup403State.epoch,
  decisionId: backup403First.decision.id, representation: backup403Rep, kind: 'video', routeType: 'catalog-generated',
  originalHost: new URL(backup403Url).host, targetHost: backup403First.decision.host ?? '',
  finalHost: backup403First.decision.host, responseUrlMatchesRequest: true,
  streamKey: backup403First.streamKey, status: 403, bytes: 0, ttfbMs: 20, elapsedMs: 100,
  completedAt: now + 2, outcome: 'failure' })
const backup403Next = backup403Routes.apply(backup403Url)
assert.ok(backup403Next.decision.routeType === 'catalog-generated'
  && backup403Next.decision.host !== backup403First.decision.host,
  'known backup request avoids a Catalog host after its own stream gets 403')
const unmatched403Storage = new FakeStorage(), unmatched403Session = new SessionStore()
unmatched403Session.beginGeneration(false)
const unmatched403Vault = new SignedRouteVault()
unmatched403Vault.reset(unmatched403Session.get().generation, unmatched403Session.get().epoch)
const unmatched403Routes = new RouteCoordinator(clock, unmatched403Session, scope.own(new SettingsStore(unmatched403Storage, () => now)),
  scope.own(new RestrictionStore(unmatched403Storage, () => now)), scope.own(new EvidenceStore(unmatched403Storage, () => now)), unmatched403Vault)
const unmatched403Url = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/unmatched-403/video.m4s?signature=unmatched'
const unmatched403First = unmatched403Routes.apply(unmatched403Url)
assert.strictEqual(unmatched403First.decision.routeType, 'catalog-generated', 'unattributed B station stream initially selects Catalog')
await unmatched403Routes.observe({ generation: unmatched403Session.get().generation, epoch: unmatched403Session.get().epoch,
  decisionId: unmatched403First.decision.id, representation: null, kind: 'video', routeType: 'catalog-generated',
  originalHost: new URL(unmatched403Url).host, targetHost: unmatched403First.decision.host ?? '',
  finalHost: unmatched403First.decision.host, responseUrlMatchesRequest: true,
  streamKey: unmatched403First.streamKey, status: 403, bytes: 0, ttfbMs: 20, elapsedMs: 100,
  completedAt: now + 3, outcome: 'failure' })
const unmatched403Next = unmatched403Routes.apply(unmatched403Url)
assert.ok(unmatched403Next.decision.routeType === 'catalog-generated'
  && unmatched403Next.decision.host !== unmatched403First.decision.host,
  'unattributed B station stream avoids a Catalog host after its own 403')
const redirectedStorage = new FakeStorage(), redirectedSession = new SessionStore()
const redirectedState = redirectedSession.beginGeneration(false), redirectedVault = new SignedRouteVault()
redirectedVault.reset(redirectedState.generation, redirectedState.epoch)
const redirectedRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/redirected/video.m4s?signature=source'
const redirectedRep = redirectedVault.register({ generation: redirectedState.generation, epoch: redirectedState.epoch,
  kind: 'video', key: 'redirected', height: 1080, codec: 'av1', bandwidth: 1_000_000,
  urls: [redirectedRoot], source: 'trusted-api' })
assert.ok(redirectedRep, 'redirected XHR fixture has trusted representation')
const redirectedEvidence = scope.own(new EvidenceStore(redirectedStorage, () => now))
const redirectedRoutes = new RouteCoordinator(clock, redirectedSession, scope.own(new SettingsStore(redirectedStorage, () => now)),
  scope.own(new RestrictionStore(redirectedStorage, () => now)), redirectedEvidence, redirectedVault)
const redirectedFirst = redirectedRoutes.apply(redirectedRoot)
assert.strictEqual(redirectedFirst.decision.routeType, 'catalog-generated', 'XHR redirect fixture initially selects Catalog')
const redirectedRequest = { requestId: requestId('catalog-xhr-redirect'), generation: redirectedState.generation,
  epoch: redirectedState.epoch, decisionId: redirectedFirst.decision.id, representation: redirectedRep,
  authorityRevision: redirectedRep ? redirectedVault.identity(redirectedRep)?.authorityRevision ?? null : null,
  kind: 'video' as const, attributionStatus: 'matched' as const, attributionSource: 'exact' as const,
  decisionStage: 'request' as const, routeType: 'catalog-generated' as const,
  originalHost: new URL(redirectedRoot).host, targetHost: redirectedFirst.decision.host ?? '',
  sourceHost: new URL(redirectedRoot).host, playurlHostChanged: false, playurlOutput: null,
  urlChanged: true, hostChanged: true, startedAt: now }
redirectedRoutes.requestStarted(redirectedRequest)
await redirectedRoutes.observe({ request: redirectedRequest, generation: redirectedState.generation,
  epoch: redirectedState.epoch, decisionId: redirectedFirst.decision.id, representation: redirectedRep,
  kind: 'video', routeType: 'catalog-generated', originalHost: new URL(redirectedRoot).host,
  targetHost: redirectedFirst.decision.host ?? '', finalHost: new URL(redirectedRoot).host,
  responseUrlMatchesRequest: false, streamKey: redirectedFirst.streamKey, status: 206,
  bytes: 70 * 1024, ttfbMs: 20, elapsedMs: 100, completedAt: now + 1, outcome: 'success' })
assert.strictEqual(redirectedEvidence.get(new URL(redirectedRoot).host, 'video'), null,
  'XHR redirected to Native host stays detached from successful health evidence')
assert.strictEqual(redirectedSession.get().affinity, null, 'XHR redirected to Native host cannot confirm playback affinity')
}
void (backup403Rep);
const backup403Routes = new RouteCoordinator(clock, backup403Session, scope.own(new SettingsStore(backup403Storage, () => now)),
  scope.own(new RestrictionStore(backup403Storage, () => now)), scope.own(new EvidenceStore(backup403Storage, () => now)), backup403Vault)
const backup403First = backup403Routes.apply(backup403Url)
void (backup403First.decision.routeType);
void ('catalog-generated');
await backup403Routes.observe({ generation: backup403State.generation, epoch: backup403State.epoch,
  decisionId: backup403First.decision.id, representation: backup403Rep, kind: 'video', routeType: 'catalog-generated',
  originalHost: new URL(backup403Url).host, targetHost: backup403First.decision.host ?? '',
  finalHost: backup403First.decision.host, responseUrlMatchesRequest: true,
  streamKey: backup403First.streamKey, status: 403, bytes: 0, ttfbMs: 20, elapsedMs: 100,
  completedAt: now + 2, outcome: 'failure' })
const backup403Next = backup403Routes.apply(backup403Url)
void (backup403Next.decision.routeType === 'catalog-generated'
  && backup403Next.decision.host !== backup403First.decision.host);
const unmatched403Storage = new FakeStorage(), unmatched403Session = new SessionStore()
unmatched403Session.beginGeneration(false)
const unmatched403Vault = new SignedRouteVault()
unmatched403Vault.reset(unmatched403Session.get().generation, unmatched403Session.get().epoch)
const unmatched403Routes = new RouteCoordinator(clock, unmatched403Session, scope.own(new SettingsStore(unmatched403Storage, () => now)),
  scope.own(new RestrictionStore(unmatched403Storage, () => now)), scope.own(new EvidenceStore(unmatched403Storage, () => now)), unmatched403Vault)
const unmatched403Url = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/unmatched-403/video.m4s?signature=unmatched'
const unmatched403First = unmatched403Routes.apply(unmatched403Url)
void (unmatched403First.decision.routeType);
void ('catalog-generated');
await unmatched403Routes.observe({ generation: unmatched403Session.get().generation, epoch: unmatched403Session.get().epoch,
  decisionId: unmatched403First.decision.id, representation: null, kind: 'video', routeType: 'catalog-generated',
  originalHost: new URL(unmatched403Url).host, targetHost: unmatched403First.decision.host ?? '',
  finalHost: unmatched403First.decision.host, responseUrlMatchesRequest: true,
  streamKey: unmatched403First.streamKey, status: 403, bytes: 0, ttfbMs: 20, elapsedMs: 100,
  completedAt: now + 3, outcome: 'failure' })
const unmatched403Next = unmatched403Routes.apply(unmatched403Url)
void (unmatched403Next.decision.routeType === 'catalog-generated'
  && unmatched403Next.decision.host !== unmatched403First.decision.host);
const redirectedStorage = new FakeStorage(), redirectedSession = new SessionStore()
const redirectedState = redirectedSession.beginGeneration(false), redirectedVault = new SignedRouteVault()
redirectedVault.reset(redirectedState.generation, redirectedState.epoch)
const redirectedRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/redirected/video.m4s?signature=source'
const redirectedRep = redirectedVault.register({ generation: redirectedState.generation, epoch: redirectedState.epoch,
  kind: 'video', key: 'redirected', height: 1080, codec: 'av1', bandwidth: 1_000_000,
  urls: [redirectedRoot], source: 'trusted-api' })
void (redirectedRep);
const redirectedEvidence = scope.own(new EvidenceStore(redirectedStorage, () => now))
const redirectedRoutes = new RouteCoordinator(clock, redirectedSession, scope.own(new SettingsStore(redirectedStorage, () => now)),
  scope.own(new RestrictionStore(redirectedStorage, () => now)), redirectedEvidence, redirectedVault)
const redirectedFirst = redirectedRoutes.apply(redirectedRoot)
void (redirectedFirst.decision.routeType);
void ('catalog-generated');
const redirectedRequest = { requestId: requestId('catalog-xhr-redirect'), generation: redirectedState.generation,
  epoch: redirectedState.epoch, decisionId: redirectedFirst.decision.id, representation: redirectedRep,
  authorityRevision: redirectedRep ? redirectedVault.identity(redirectedRep)?.authorityRevision ?? null : null,
  kind: 'video' as const, attributionStatus: 'matched' as const, attributionSource: 'exact' as const,
  decisionStage: 'request' as const, routeType: 'catalog-generated' as const,
  originalHost: new URL(redirectedRoot).host, targetHost: redirectedFirst.decision.host ?? '',
  sourceHost: new URL(redirectedRoot).host, playurlHostChanged: false, playurlOutput: null,
  urlChanged: true, hostChanged: true, startedAt: now }
redirectedRoutes.requestStarted(redirectedRequest)
await redirectedRoutes.observe({ request: redirectedRequest, generation: redirectedState.generation,
  epoch: redirectedState.epoch, decisionId: redirectedFirst.decision.id, representation: redirectedRep,
  kind: 'video', routeType: 'catalog-generated', originalHost: new URL(redirectedRoot).host,
  targetHost: redirectedFirst.decision.host ?? '', finalHost: new URL(redirectedRoot).host,
  responseUrlMatchesRequest: false, streamKey: redirectedFirst.streamKey, status: 206,
  bytes: 70 * 1024, ttfbMs: 20, elapsedMs: 100, completedAt: now + 1, outcome: 'success' })
void (redirectedEvidence.get(new URL(redirectedRoot).host, 'video'));
void (null);
void (redirectedSession.get().affinity);
void (null);
const redirectedNext = redirectedRoutes.apply(redirectedRoot)
if (scenario === 9) return async () => {
assert.ok(redirectedNext.decision.routeType === 'catalog-generated'
  && redirectedNext.decision.host !== redirectedFirst.decision.host,
  'XHR redirect away from Catalog invalidates that Catalog host for the same stream')
const aliasStorage = new FakeStorage(), aliasSession = new SessionStore()
const aliasState = aliasSession.beginGeneration(false), aliasVault = new SignedRouteVault()
aliasVault.reset(aliasState.generation, aliasState.epoch)
const aliasSettings = scope.own(new SettingsStore(aliasStorage, () => now))
const aliasRoutes = new RouteCoordinator(clock, aliasSession, aliasSettings,
  scope.own(new RestrictionStore(aliasStorage, () => now)), scope.own(new EvidenceStore(aliasStorage, () => now)), aliasVault)
const aliasAdapter = new PlayurlAdapter(new PlayurlController(aliasSession, aliasVault, aliasRoutes, aliasSettings))
const aliasRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/aliases/primary.m4s?signature=primary'
const aliasBackup = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/aliases/backup.m4s?signature=backup'
const aliasItem = { id: 90, codecid: 13, height: 1080, bandwidth: 1_000_000,
  baseUrl: aliasRoot, base_url: aliasRoot, backupUrl: [aliasBackup], backup_url: [aliasBackup] }
assert.ok(aliasAdapter.transform({ data: { dash: { video: [aliasItem], audio: [] } } }).accepted,
  'playurl with both field spellings is transformed')
assert.strictEqual(aliasItem.baseUrl, aliasItem.base_url,
  'Catalog-only playurl rewrites both primary field spellings to the same URL')
assert.strictEqual(JSON.stringify(aliasItem.backupUrl), JSON.stringify(aliasItem.backup_url),
  'Catalog-only playurl rewrites both backup field spellings to the same URLs')
assert.ok([aliasItem.baseUrl, aliasItem.base_url, ...aliasItem.backupUrl, ...aliasItem.backup_url]
  .every(url => !!url && TRUSTED_CATALOG.includes(new URL(url).host as typeof TRUSTED_CATALOG[number])),
  'no Native signed URL remains in either playurl field spelling')
const nestedStorage = new FakeStorage(), nestedSettings = scope.own(new SettingsStore(nestedStorage, () => now))
await nestedSettings.update({ considerNativeSources: true })
const nestedSession = new SessionStore(), nestedState = nestedSession.beginGeneration(false)
const nestedVault = new SignedRouteVault();
nestedVault.reset(nestedState.generation, nestedState.epoch)
const nestedRoutes = new RouteCoordinator(clock, nestedSession, nestedSettings,
  scope.own(new RestrictionStore(nestedStorage, () => now)), scope.own(new EvidenceStore(nestedStorage, () => now)), nestedVault)
const nestedAdapter = new PlayurlAdapter(new PlayurlController(nestedSession, nestedVault, nestedRoutes, nestedSettings))
const nestedVideoRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/nested/video.m4s?signature=video'
const dolbyRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/nested/dolby.m4s?signature=dolby'
const dolbyBackup = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/nested/dolby-backup.m4s?signature=dolby-backup'
const flacRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/nested/flac.m4s?signature=flac'
const flacBackup = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/nested/flac-backup.m4s?signature=flac-backup'
const nestedPayload = () => ({ data: { dash: {
  video: [{ id: 80, codecid: 13, height: 1080, bandwidth: 1_000_000, base_url: nestedVideoRoot, backup_url: [] as string[] }],
  audio: [] as unknown[],
  dolby: { audio: [{ id: 30280, bandwidth: 448_000, base_url: dolbyRoot, backup_url: [dolbyBackup] }] },
  flac: { audio: { id: 30251, bandwidth: 1_000_000, base_url: flacRoot, backup_url: [flacBackup] } },
} } })
const nativeOnNested = nestedPayload()
assert.ok(nestedAdapter.transform(nativeOnNested, 'trusted-api').accepted, 'Native-on nested audio fixture accepts valid DASH video')
assert.strictEqual(nativeOnNested.data.dash.dolby.audio[0]?.base_url, dolbyRoot, 'Native-on preserves legacy Dolby audio URL')
assert.strictEqual(nativeOnNested.data.dash.flac.audio.base_url, flacRoot, 'Native-on preserves legacy FLAC audio URL')
}
void (redirectedNext.decision.routeType === 'catalog-generated'
  && redirectedNext.decision.host !== redirectedFirst.decision.host);
const aliasStorage = new FakeStorage(), aliasSession = new SessionStore()
const aliasState = aliasSession.beginGeneration(false), aliasVault = new SignedRouteVault()
aliasVault.reset(aliasState.generation, aliasState.epoch)
const aliasSettings = scope.own(new SettingsStore(aliasStorage, () => now))
const aliasRoutes = new RouteCoordinator(clock, aliasSession, aliasSettings,
  scope.own(new RestrictionStore(aliasStorage, () => now)), scope.own(new EvidenceStore(aliasStorage, () => now)), aliasVault)
const aliasAdapter = new PlayurlAdapter(new PlayurlController(aliasSession, aliasVault, aliasRoutes, aliasSettings))
const aliasRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/aliases/primary.m4s?signature=primary'
const aliasBackup = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/aliases/backup.m4s?signature=backup'
const aliasItem = { id: 90, codecid: 13, height: 1080, bandwidth: 1_000_000,
  baseUrl: aliasRoot, base_url: aliasRoot, backupUrl: [aliasBackup], backup_url: [aliasBackup] }
void (aliasAdapter.transform({ data: { dash: { video: [aliasItem], audio: [] } } }).accepted);
void (aliasItem.baseUrl);
void (aliasItem.base_url);
void (JSON.stringify(aliasItem.backupUrl));
void (JSON.stringify(aliasItem.backup_url));
void ([aliasItem.baseUrl, aliasItem.base_url, ...aliasItem.backupUrl, ...aliasItem.backup_url]
  .every(url => !!url && TRUSTED_CATALOG.includes(new URL(url).host as typeof TRUSTED_CATALOG[number])));
const nestedStorage = new FakeStorage(), nestedSettings = scope.own(new SettingsStore(nestedStorage, () => now))
await nestedSettings.update({ considerNativeSources: true })
const nestedSession = new SessionStore(), nestedState = nestedSession.beginGeneration(false)
const nestedVault = new SignedRouteVault();
nestedVault.reset(nestedState.generation, nestedState.epoch)
const nestedRoutes = new RouteCoordinator(clock, nestedSession, nestedSettings,
  scope.own(new RestrictionStore(nestedStorage, () => now)), scope.own(new EvidenceStore(nestedStorage, () => now)), nestedVault)
const nestedAdapter = new PlayurlAdapter(new PlayurlController(nestedSession, nestedVault, nestedRoutes, nestedSettings))
const nestedVideoRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/nested/video.m4s?signature=video'
const dolbyRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/nested/dolby.m4s?signature=dolby'
const dolbyBackup = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/nested/dolby-backup.m4s?signature=dolby-backup'
const flacRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/nested/flac.m4s?signature=flac'
const flacBackup = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/nested/flac-backup.m4s?signature=flac-backup'
const nestedPayload = () => ({ data: { dash: {
  video: [{ id: 80, codecid: 13, height: 1080, bandwidth: 1_000_000, base_url: nestedVideoRoot, backup_url: [] as string[] }],
  audio: [] as unknown[],
  dolby: { audio: [{ id: 30280, bandwidth: 448_000, base_url: dolbyRoot, backup_url: [dolbyBackup] }] },
  flac: { audio: { id: 30251, bandwidth: 1_000_000, base_url: flacRoot, backup_url: [flacBackup] } },
} } })
const nativeOnNested = nestedPayload()
void (nestedAdapter.transform(nativeOnNested, 'trusted-api').accepted);
void (nativeOnNested.data.dash.dolby.audio[0]?.base_url);
void (dolbyRoot);
void (nativeOnNested.data.dash.flac.audio.base_url);
void (flacRoot);
await nestedSettings.update({ considerNativeSources: false });
nestedRoutes.invalidateForUserSetting()
const strictNested = nestedPayload()
if (scenario === 10) return async () => {
assert.ok(nestedAdapter.transform(strictNested, 'trusted-api').accepted, 'Catalog-only nested audio fixture accepts valid DASH video')
const nestedAudioUrls = [strictNested.data.dash.dolby.audio[0]?.base_url ?? '',
  ...strictNested.data.dash.dolby.audio[0]!.backup_url, strictNested.data.dash.flac.audio.base_url,
  ...strictNested.data.dash.flac.audio.backup_url]
assert.ok(nestedAudioUrls.every(url => url === '' || TRUSTED_CATALOG.includes(new URL(url).host as typeof TRUSTED_CATALOG[number])),
  'Catalog-only playurl rewrites or clears every nested Dolby and FLAC audio primary and backup URL')
}
void (nestedAdapter.transform(strictNested, 'trusted-api').accepted);
const nestedAudioUrls = [strictNested.data.dash.dolby.audio[0]?.base_url ?? '',
  ...strictNested.data.dash.dolby.audio[0]!.backup_url, strictNested.data.dash.flac.audio.base_url,
  ...strictNested.data.dash.flac.audio.backup_url]
void (nestedAudioUrls.every(url => url === '' || TRUSTED_CATALOG.includes(new URL(url).host as typeof TRUSTED_CATALOG[number])));
const failureStorage = new FakeStorage(), failureSession = new SessionStore()
const failureState = failureSession.beginGeneration(false), failureVault = new SignedRouteVault()
failureVault.reset(failureState.generation, failureState.epoch)
const failureEvidence = scope.own(new EvidenceStore(failureStorage, () => now))
const failureRoutes = new RouteCoordinator(clock, failureSession, scope.own(new SettingsStore(failureStorage, () => now)),
  scope.own(new RestrictionStore(failureStorage, () => now)), failureEvidence, failureVault)
const failureRoots = {
  video: 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/catalog-failure/video.m4s?signature=video',
  audio: 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/catalog-failure/audio.m4s?signature=audio',
}
if (scenario === 11) {
 let iteration = 0
for (const kind of ['video', 'audio'] as const) {
 if (iteration++ === parameter) return async () => {
  const root = failureRoots[kind]
  const rep = failureVault.register({ generation: failureState.generation, epoch: failureState.epoch,
    kind, key: `failure:${kind}`, height: kind === 'video' ? 1080 : 0, codec: kind === 'video' ? 'av1' : 'other',
    bandwidth: kind === 'video' ? 2_000_000 : 192_000, urls: [root], source: 'trusted-api' })
  assert.ok(rep, `Catalog failure fixture registers ${kind}`)
  const applied = failureRoutes.apply(root)
  assert.strictEqual(applied.decision.routeType, 'catalog-generated', `${kind} failure fixture targets Catalog`)
  const targetHost = applied.decision.host ?? ''
  const observed: TransportObservation = { generation: failureState.generation, epoch: failureState.epoch,
    decisionId: applied.decision.id, representation: rep, kind, routeType: 'catalog-generated',
    originalHost: new URL(root).host, targetHost, finalHost: null, responseUrlMatchesRequest: false,
    streamKey: applied.streamKey, status: 0, bytes: 0, ttfbMs: null, elapsedMs: 100,
    completedAt: now + (kind === 'video' ? 1 : 2), outcome: 'failure', failureKind: 'network' }
  const { failureKind: _failureKind, ...redirected } = observed
  await failureRoutes.observe({ ...redirected, finalHost: new URL(root).host, status: 206,
    bytes: 70 * 1024, outcome: 'success' })
  assert.strictEqual(failureEvidence.get(new URL(root).host, kind), null,
    `${kind} response redirected to Native host cannot gain success evidence`)
  assert.strictEqual(failureSession.get().affinity, null, 'detached response cannot establish playback affinity')
  await failureRoutes.observe(observed)
  assert.ok(failureEvidence.get(targetHost, kind)?.samples.some(sample => sample.outcome === 'failure'),
    `${kind} Catalog network failure without response host still records transport failure`)
  assert.ok((failureRoutes.snapshot().fallback)[kind],
    `${kind} Catalog network failure without response host still plans recovery`)
}
 }
 throw Error('Unknown fixture parameter')
}
for (const kind of ['video', 'audio'] as const) {
  const root = failureRoots[kind]
  const rep = failureVault.register({ generation: failureState.generation, epoch: failureState.epoch,
    kind, key: `failure:${kind}`, height: kind === 'video' ? 1080 : 0, codec: kind === 'video' ? 'av1' : 'other',
    bandwidth: kind === 'video' ? 2_000_000 : 192_000, urls: [root], source: 'trusted-api' })
void (rep);
  const applied = failureRoutes.apply(root)
void (applied.decision.routeType);
void ('catalog-generated');
  const targetHost = applied.decision.host ?? ''
  const observed: TransportObservation = { generation: failureState.generation, epoch: failureState.epoch,
    decisionId: applied.decision.id, representation: rep, kind, routeType: 'catalog-generated',
    originalHost: new URL(root).host, targetHost, finalHost: null, responseUrlMatchesRequest: false,
    streamKey: applied.streamKey, status: 0, bytes: 0, ttfbMs: null, elapsedMs: 100,
    completedAt: now + (kind === 'video' ? 1 : 2), outcome: 'failure', failureKind: 'network' }
  const { failureKind: _failureKind, ...redirected } = observed
  await failureRoutes.observe({ ...redirected, finalHost: new URL(root).host, status: 206,
    bytes: 70 * 1024, outcome: 'success' })
void (failureEvidence.get(new URL(root).host, kind));
void (null);
void (failureSession.get().affinity);
void (null);
  await failureRoutes.observe(observed)
void (failureEvidence.get(targetHost, kind)?.samples.some(sample => sample.outcome === 'failure'));
void ((failureRoutes.snapshot().fallback)[kind]);
}
throw Error('Unknown fixture scenario')
}

test("first group establishes observed Native affinity [1]", { timeout: 5000 }, async t => { await (await fixture(t, 0))() })
test("Catalog-only fixture retains both original URLs privately for attribution [2]", { timeout: 5000 }, async t => { await (await fixture(t, 1))() })
test("Catalog-only startup has legal candidates [3]", { timeout: 5000 }, async t => { await (await fixture(t, 2))() })
test("opaque signed B station audio is removed from Catalog-only player output [4]", { timeout: 5000 }, async t => { await (await fixture(t, 3))() })
test("no legal Catalog candidate starts no healthy probe [5]", { timeout: 5000 }, async t => { await (await fixture(t, 4))() })
test("no legal Catalog candidate emits no player primary [6]", { timeout: 5000 }, async t => { await (await fixture(t, 5))() })
test("enabling Native sources preserves cold-start original route [7]", { timeout: 5000 }, async t => { await (await fixture(t, 6))() })
test("Catalog decision may yield the exact same URL as the original [8]", { timeout: 5000 }, async t => { await (await fixture(t, 7))() })
test("known backup 403 fixture has a current-epoch representation [9]", { timeout: 5000 }, async t => { await (await fixture(t, 8))() })
test("XHR redirect away from Catalog invalidates that Catalog host for the same stream [10]", { timeout: 5000 }, async t => { await (await fixture(t, 9))() })
test("Catalog-only nested audio fixture accepts valid DASH video [11]", { timeout: 5000 }, async t => { await (await fixture(t, 10))() })
{
 let parameter = 0
for (const kind of ['video', 'audio'] as const) {
 const selected = parameter++
 test("`Catalog failure fixture registers ${kind}` [12]" + ` / ${String(kind)} / ${selected}`, { timeout: 5000 }, async t => { await (await fixture(t, 11, selected))() })
}
}
