import { createRuntimeIds } from "../../src-v2/platform/runtime-ids.ts"
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { signedRouteHandle } from '../../src-v2/domain/model.ts'
import { PlayurlController } from '../../src-v2/application/playurl-controller.ts'
import { decisionId, epochId, generationId, requestId } from '../../src-v2/domain/model.ts'
import { TRUSTED_CATALOG } from '../../src-v2/domain/catalog.ts'
import { SignedRouteVault } from '../../src-v2/state/signed-route-vault.ts'
import { RestrictionStore } from '../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../src-v2/state/evidence-store.ts'
import { SettingsStore } from '../../src-v2/state/settings-store.ts'
import { SessionStore } from '../../src-v2/state/session-store.ts'
import { RouteCoordinator } from '../../src-v2/application/route-coordinator.ts'
import { PlayurlAdapter } from '../../src-v2/adapters/playurl.ts'
import { FakeStorage, DelayedSettingsStorage } from '../support/storage.ts'
import { testScope } from '../support/scope.ts'

// Each call creates fresh resources and replays only this fixture's prerequisite transitions.
// Earlier expectations run in their own cases; no mutable state crosses a test boundary.
async function fixture(t: TestContext, scenario: number, parameter = 0): Promise<() => Promise<void>> {
  const scope = testScope(t)
const now = 2_000_000_000_000
const clock = { now: () => now }
const vault = new SignedRouteVault(), generation = generationId(1), epoch = epochId(1)
vault.reset(generation, epoch)
const rep = vault.register({ generation, epoch, kind: 'video', key: '80:av1', height: 1080, codec: 'av1', bandwidth: 4_000_000,
  urls: ['https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/1.m4s?token=secret'], source: 'trusted-api' })
if (scenario === 0) return async () => {
assert.ok(rep, 'signed route registered')
assert.strictEqual(vault.register({ generation, epoch, kind: 'video', key: '80:av1', height: 1080, codec: 'av1', bandwidth: 4_000_000,
  urls: ['https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/1.m4s?token=secret'], source: 'player-mpd' }), rep,
  'repeated manifest ingestion preserves representation identity')
const authorityVault = new SignedRouteVault();
authorityVault.reset(generation, epoch)
const hintedUrl = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/hint.m4s?token=hint'
const trustedUrl = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/api.m4s?token=api'
const hintedRep = authorityVault.register({ generation, epoch, kind: 'video', key: '80:av1', height: 1080,
  codec: 'av1', bandwidth: 4_000_000, urls: [hintedUrl], source: 'page-hint' })
assert.ok(hintedRep, 'page hint establishes a provisional group')
const hintedIdentity = hintedRep ? authorityVault.identity(hintedRep) : null
const hintedHandle = hintedRep ? authorityVault.candidates(hintedRep, new Set()).native[0]?.handle : null
const trustedRep = authorityVault.register({ generation, epoch, kind: 'video', key: '80:av1', height: 1080,
  codec: 'av1', bandwidth: 4_000_000, urls: [trustedUrl], source: 'trusted-api' })
assert.ok(trustedRep, 'trusted API adopts the representation')
assert.strictEqual(trustedRep ? authorityVault.rootUrl(trustedRep) : null, trustedUrl,
  'trusted API root replaces the provisional page URL')
assert.ok(!trustedRep || !authorityVault.candidates(trustedRep, new Set()).native.some(route => route.host === 'upos-hz-mirrorakam.akamaized.net'),
  'page-hint Native route cannot remain selectable after trusted API adoption')
assert.strictEqual(hintedHandle && hintedRep ? authorityVault.resolve(hintedHandle, authorityVault.identity(hintedRep)!) : null, null,
  'trusted API adoption revokes the earlier hint handle')
assert.ok(!hintedIdentity || !authorityVault.isCurrentIdentity(hintedIdentity),
  'an in-flight page-hint identity is retired on trusted API adoption')
}
void (rep);
void (vault.register({ generation, epoch, kind: 'video', key: '80:av1', height: 1080, codec: 'av1', bandwidth: 4_000_000,
  urls: ['https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/1.m4s?token=secret'], source: 'player-mpd' }));
void (rep);
const authorityVault = new SignedRouteVault();
authorityVault.reset(generation, epoch)
const hintedUrl = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/hint.m4s?token=hint'
const trustedUrl = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/api.m4s?token=api'
const hintedRep = authorityVault.register({ generation, epoch, kind: 'video', key: '80:av1', height: 1080,
  codec: 'av1', bandwidth: 4_000_000, urls: [hintedUrl], source: 'page-hint' })
void (hintedRep);
const hintedIdentity = hintedRep ? authorityVault.identity(hintedRep) : null
const hintedHandle = hintedRep ? authorityVault.candidates(hintedRep, new Set()).native[0]?.handle : null
const trustedRep = authorityVault.register({ generation, epoch, kind: 'video', key: '80:av1', height: 1080,
  codec: 'av1', bandwidth: 4_000_000, urls: [trustedUrl], source: 'trusted-api' })
void (trustedRep);
void (trustedRep ? authorityVault.rootUrl(trustedRep) : null);
void (trustedUrl);
void (!trustedRep || !authorityVault.candidates(trustedRep, new Set()).native.some(route => route.host === 'upos-hz-mirrorakam.akamaized.net'));
void (hintedHandle && hintedRep ? authorityVault.resolve(hintedHandle, authorityVault.identity(hintedRep)!) : null);
void (null);
void (!hintedIdentity || !authorityVault.isCurrentIdentity(hintedIdentity));
const trustedIdentity = trustedRep ? authorityVault.identity(trustedRep) : null
const lateHintUrl = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/late.m4s?token=late'
authorityVault.register({ generation, epoch, kind: 'video', key: '80:av1', height: 1080,
  codec: 'av1', bandwidth: 4_000_000, urls: [lateHintUrl], source: 'page-hint' })
if (scenario === 1) return async () => {
assert.strictEqual(trustedRep ? authorityVault.rootUrl(trustedRep) : null, trustedUrl,
  'late page hints cannot replace the trusted root')
assert.ok(!trustedRep || !authorityVault.candidates(trustedRep, new Set()).native.some(route => route.host === 'upos-hz-mirrorakam.akamaized.net'),
  'late page hints cannot become Native candidates')
authorityVault.register({ generation, epoch, kind: 'video', key: '80:av1', height: 1080,
  codec: 'av1', bandwidth: 4_000_000, urls: [trustedUrl], source: 'trusted-api' })
assert.strictEqual(trustedRep ? authorityVault.identity(trustedRep) : null, trustedIdentity,
  'repeated identical trusted data does not invalidate active work')
const duplicateHintRep = authorityVault.register({ generation, epoch, kind: 'video', key: '999:av1', height: 1080,
  codec: 'av1', bandwidth: 4_000_000, urls: [trustedUrl], source: 'player-mpd' })
assert.strictEqual(duplicateHintRep, trustedRep, 'later different-key hint cannot duplicate a trusted exact URL')
assert.strictEqual(authorityVault.match(trustedUrl).context, trustedIdentity,
  'trusted exact URL remains unambiguous after a different-key hint')
const crossKeyVault = new SignedRouteVault();
crossKeyVault.reset(generation, epoch)
const crossKeyHint = crossKeyVault.register({ generation, epoch, kind: 'video', key: '999:av1', height: 1080,
  codec: 'av1', bandwidth: 4_000_000, urls: [trustedUrl], source: 'page-hint' })
const crossKeyTrusted = crossKeyVault.register({ generation, epoch, kind: 'video', key: '80:av1', height: 1080,
  codec: 'av1', bandwidth: 4_000_000, urls: [trustedUrl], source: 'trusted-api' })
assert.strictEqual(crossKeyVault.match(trustedUrl).context?.representation, crossKeyTrusted,
  'trusted API revokes a different-key hint that duplicates its exact URL')
assert.strictEqual(crossKeyHint ? crossKeyVault.identity(crossKeyHint) : null, null,
  'different-key provisional group is retired after trusted API adoption')
const invalidHintVault = new SignedRouteVault();
invalidHintVault.reset(generation, epoch)
const invalidHintHost = 'upos-hz-mirrorakam.akamaized.net'
const invalidHintRep = invalidHintVault.register({ generation, epoch, kind: 'video', key: '80:av1', height: 1080,
  codec: 'av1', bandwidth: 4_000_000, urls: [hintedUrl], source: 'page-hint' })
assert.ok(invalidHintRep, 'provisional route exists before its host is invalidated')
}
void (trustedRep ? authorityVault.rootUrl(trustedRep) : null);
void (trustedUrl);
void (!trustedRep || !authorityVault.candidates(trustedRep, new Set()).native.some(route => route.host === 'upos-hz-mirrorakam.akamaized.net'));
authorityVault.register({ generation, epoch, kind: 'video', key: '80:av1', height: 1080,
  codec: 'av1', bandwidth: 4_000_000, urls: [trustedUrl], source: 'trusted-api' })
void (trustedRep ? authorityVault.identity(trustedRep) : null);
void (trustedIdentity);
const duplicateHintRep = authorityVault.register({ generation, epoch, kind: 'video', key: '999:av1', height: 1080,
  codec: 'av1', bandwidth: 4_000_000, urls: [trustedUrl], source: 'player-mpd' })
void (duplicateHintRep);
void (trustedRep);
void (authorityVault.match(trustedUrl).context);
void (trustedIdentity);
const crossKeyVault = new SignedRouteVault();
crossKeyVault.reset(generation, epoch)
const crossKeyHint = crossKeyVault.register({ generation, epoch, kind: 'video', key: '999:av1', height: 1080,
  codec: 'av1', bandwidth: 4_000_000, urls: [trustedUrl], source: 'page-hint' })
const crossKeyTrusted = crossKeyVault.register({ generation, epoch, kind: 'video', key: '80:av1', height: 1080,
  codec: 'av1', bandwidth: 4_000_000, urls: [trustedUrl], source: 'trusted-api' })
void (crossKeyVault.match(trustedUrl).context?.representation);
void (crossKeyTrusted);
void (crossKeyHint ? crossKeyVault.identity(crossKeyHint) : null);
void (null);
const invalidHintVault = new SignedRouteVault();
invalidHintVault.reset(generation, epoch)
const invalidHintHost = 'upos-hz-mirrorakam.akamaized.net'
const invalidHintRep = invalidHintVault.register({ generation, epoch, kind: 'video', key: '80:av1', height: 1080,
  codec: 'av1', bandwidth: 4_000_000, urls: [hintedUrl], source: 'page-hint' })
void (invalidHintRep);
invalidHintVault.invalidate(invalidHintRep!, invalidHintHost)
const sameHostTrustedUrl = `https://${invalidHintHost}/upgcxcode/a/b/trusted.m4s?token=trusted`
const invalidHintTrustedRep = invalidHintVault.register({ generation, epoch, kind: 'video', key: '80:av1', height: 1080,
  codec: 'av1', bandwidth: 4_000_000, urls: [sameHostTrustedUrl], source: 'trusted-api' })
if (scenario === 2) return async () => {
assert.ok(invalidHintTrustedRep, 'trusted API replaces invalidated provisional route on the same host')
assert.ok(!invalidHintVault.isInvalid(invalidHintTrustedRep!, invalidHintHost),
  'provisional host invalidation does not poison newly trusted exact URL')
assert.strictEqual(invalidHintVault.candidates(invalidHintTrustedRep!, new Set()).native[0]?.host, invalidHintHost,
  'newly trusted Native URL remains selectable after lower-trust promotion')
const authoritySession = new SessionStore();
authoritySession.beginGeneration(false)
const authorityState = authoritySession.beginEpoch(), authorityStorage = new FakeStorage()
const authoritySettings = scope.own(new SettingsStore(authorityStorage, () => now))
await authoritySettings.update({ considerNativeSources: true })
const authorityRestrictions = scope.own(new RestrictionStore(authorityStorage, () => now))
const authorityEvidence = scope.own(new EvidenceStore(authorityStorage, () => now))
const plannedVault = new SignedRouteVault();
plannedVault.reset(authorityState.generation, authorityState.epoch)
const plannedRep = plannedVault.register({ generation: authorityState.generation, epoch: authorityState.epoch,
  kind: 'video', key: '80:av1:1080', height: 1080, codec: 'av1', bandwidth: 4_000_000,
  urls: [hintedUrl], source: 'page-hint' })
assert.ok(plannedRep, 'provisional route can be planned before the API arrives')
const plannedRoutes = new RouteCoordinator(clock, authoritySession, authoritySettings, authorityRestrictions, authorityEvidence, plannedVault, createRuntimeIds())
const plannedDemand = { kind: 'video' as const, requiredMbps: 8, highDemand: false }
assert.strictEqual(plannedRep ? plannedRoutes.plan(plannedRep, plannedDemand, 'startup').host : null,
  'upos-hz-mirrorakam.akamaized.net', 'provisional startup initially follows its signed root')
const staleStartup = plannedRoutes.startupOptions(hintedUrl)?.candidates[0] ?? null
const staleChallenge = plannedRep ? plannedRoutes.challenge(plannedRep, plannedDemand, false) : null
const plannedAdapter = new PlayurlAdapter(new PlayurlController(authoritySession, plannedVault, plannedRoutes, authoritySettings))
const trustedPayload = { data: { dash: { video: [{ id: 80, height: 1080, codecs: 'av01', bandwidth: 4_000_000,
  base_url: trustedUrl, backup_url: [] as string[] }], audio: [] } } }
assert.ok(plannedAdapter.transform(trustedPayload, 'trusted-api').accepted, 'trusted API playurl is adopted')
assert.strictEqual(plannedRep ? plannedVault.rootUrl(plannedRep) : null, trustedUrl, 'trusted playurl replaces hint root in the live adapter')
assert.strictEqual(plannedRep ? plannedRoutes.plan(plannedRep, plannedDemand, 'startup').host : null,
  'upos-sz-mirrorali.bilivideo.com', 'previous provisional plan is invalidated at trusted API adoption')
}
void (invalidHintTrustedRep);
void (!invalidHintVault.isInvalid(invalidHintTrustedRep!, invalidHintHost));
void (invalidHintVault.candidates(invalidHintTrustedRep!, new Set()).native[0]?.host);
void (invalidHintHost);
const authoritySession = new SessionStore();
authoritySession.beginGeneration(false)
const authorityState = authoritySession.beginEpoch(), authorityStorage = new FakeStorage()
const authoritySettings = scope.own(new SettingsStore(authorityStorage, () => now))
await authoritySettings.update({ considerNativeSources: true })
const authorityRestrictions = scope.own(new RestrictionStore(authorityStorage, () => now))
const authorityEvidence = scope.own(new EvidenceStore(authorityStorage, () => now))
const plannedVault = new SignedRouteVault();
plannedVault.reset(authorityState.generation, authorityState.epoch)
const plannedRep = plannedVault.register({ generation: authorityState.generation, epoch: authorityState.epoch,
  kind: 'video', key: '80:av1:1080', height: 1080, codec: 'av1', bandwidth: 4_000_000,
  urls: [hintedUrl], source: 'page-hint' })
void (plannedRep);
const plannedRoutes = new RouteCoordinator(clock, authoritySession, authoritySettings, authorityRestrictions, authorityEvidence, plannedVault, createRuntimeIds())
const plannedDemand = { kind: 'video' as const, requiredMbps: 8, highDemand: false }
void (plannedRep ? plannedRoutes.plan(plannedRep, plannedDemand, 'startup').host : null);
void ('upos-hz-mirrorakam.akamaized.net');
const staleStartup = plannedRoutes.startupOptions(hintedUrl)?.candidates[0] ?? null
const staleChallenge = plannedRep ? plannedRoutes.challenge(plannedRep, plannedDemand, false) : null
const plannedAdapter = new PlayurlAdapter(new PlayurlController(authoritySession, plannedVault, plannedRoutes, authoritySettings))
const trustedPayload = { data: { dash: { video: [{ id: 80, height: 1080, codecs: 'av01', bandwidth: 4_000_000,
  base_url: trustedUrl, backup_url: [] as string[] }], audio: [] } } }
void (plannedAdapter.transform(trustedPayload, 'trusted-api').accepted);
void (plannedRep ? plannedVault.rootUrl(plannedRep) : null);
void (trustedUrl);
void (plannedRep ? plannedRoutes.plan(plannedRep, plannedDemand, 'startup').host : null);
void ('upos-sz-mirrorali.bilivideo.com');
const lateHintPayload = { data: { dash: { video: [{ id: 80, height: 1080, codecs: 'av01', bandwidth: 4_000_000,
  base_url: lateHintUrl, backup_url: [] as string[] }], audio: [] } } }
plannedAdapter.transform(lateHintPayload, 'page-hint')
if (scenario === 3) return async () => {
assert.strictEqual(lateHintPayload.data.dash.video[0]?.base_url, lateHintUrl,
  'late lower-trust page hint does not rewrite or merge into trusted API output')
}
void (lateHintPayload.data.dash.video[0]?.base_url);
void (lateHintUrl);

if (scenario === 4) return async () => {
if (staleStartup) {
  await plannedRoutes.recordStartupSuccess(staleStartup, 70 * 1024, 100, 10)
  assert.strictEqual(authorityEvidence.get(staleStartup.host, 'video'), null,
    'late preflight result from the retired hint cannot create health evidence')
}
}
if (staleStartup) {
  await plannedRoutes.recordStartupSuccess(staleStartup, 70 * 1024, 100, 10)
void (authorityEvidence.get(staleStartup.host, 'video'));
void (null);
}

if (scenario === 5) return async () => {
if (staleChallenge) {
  await plannedRoutes.recordChallenge(staleChallenge, 70 * 1024, 100, 10, 'success', null)
  assert.strictEqual(authorityEvidence.get(staleChallenge.decision.host ?? '', 'video'), null,
    'late challenger result from the retired hint cannot create health evidence')
}
}
if (staleChallenge) {
  await plannedRoutes.recordChallenge(staleChallenge, 70 * 1024, 100, 10, 'success', null)
void (authorityEvidence.get(staleChallenge.decision.host ?? '', 'video'));
void (null);
}

if (scenario === 6) return async () => {
if (plannedRep) {
  const staleRequest = { requestId: requestId('retired-hint'), generation: authorityState.generation, epoch: authorityState.epoch,
    decisionId: decisionId('retired-hint'), representation: plannedRep, authorityRevision: 1, routePolicyRevision: plannedRoutes.policyRevision(), kind: 'video' as const,
    attributionStatus: 'matched' as const, attributionSource: 'exact' as const, decisionStage: 'request' as const,
    routeType: 'root-original' as const, originalHost: 'upos-hz-mirrorakam.akamaized.net',
    targetHost: 'upos-hz-mirrorakam.akamaized.net', sourceHost: 'upos-hz-mirrorakam.akamaized.net',
    playurlHostChanged: false, playurlOutput: null, urlChanged: false, hostChanged: false, startedAt: now }
  await plannedRoutes.observe({ request: staleRequest, generation: authorityState.generation, epoch: authorityState.epoch,
    decisionId: staleRequest.decisionId, representation: plannedRep, kind: 'video', routeType: 'root-original',
    originalHost: staleRequest.originalHost, targetHost: staleRequest.targetHost, finalHost: staleRequest.targetHost,
    streamKey: 'retired-hint', status: 500, bytes: 0, ttfbMs: 10, elapsedMs: 100, completedAt: now + 100,
    outcome: 'failure', failureKind: 'http-5xx' })
  assert.strictEqual(authorityEvidence.get(staleRequest.targetHost, 'video'), null,
    'retired page-hint transport does not punish its old host after API adoption')
}
}
if (plannedRep) {
  const staleRequest = { requestId: requestId('retired-hint'), generation: authorityState.generation, epoch: authorityState.epoch,
    decisionId: decisionId('retired-hint'), representation: plannedRep, authorityRevision: 1, routePolicyRevision: plannedRoutes.policyRevision(), kind: 'video' as const,
    attributionStatus: 'matched' as const, attributionSource: 'exact' as const, decisionStage: 'request' as const,
    routeType: 'root-original' as const, originalHost: 'upos-hz-mirrorakam.akamaized.net',
    targetHost: 'upos-hz-mirrorakam.akamaized.net', sourceHost: 'upos-hz-mirrorakam.akamaized.net',
    playurlHostChanged: false, playurlOutput: null, urlChanged: false, hostChanged: false, startedAt: now }
  await plannedRoutes.observe({ request: staleRequest, generation: authorityState.generation, epoch: authorityState.epoch,
    decisionId: staleRequest.decisionId, representation: plannedRep, kind: 'video', routeType: 'root-original',
    originalHost: staleRequest.originalHost, targetHost: staleRequest.targetHost, finalHost: staleRequest.targetHost,
    streamKey: 'retired-hint', status: 500, bytes: 0, ttfbMs: 10, elapsedMs: 100, completedAt: now + 100,
    outcome: 'failure', failureKind: 'http-5xx' })
void (authorityEvidence.get(staleRequest.targetHost, 'video'));
void (null);
}
const context = vault.contextForUrl('https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/1.m4s?token=secret')
if (scenario === 7) return async () => {
assert.strictEqual(context?.epoch, epoch, 'exact signed route maps to current epoch')
const protectedUrl = 'https://upos-hz-mirrorakam.akamaized.net/opaque/signed-segment?token=secret'
const protectedRep = vault.register({ generation, epoch, kind: 'audio', key: '30280:opaque', height: 0, codec: 'other', bandwidth: 192_000,
  urls: [protectedUrl], source: 'trusted-api' })
assert.ok(protectedRep, 'current-epoch signed URL without a known media suffix is retained')
assert.strictEqual(vault.match(protectedUrl).context?.kind, 'audio', 'exact protected signed URL is recognized as audio')
assert.strictEqual(protectedRep ? vault.candidates(protectedRep, new Set()).native.length : -1, 0,
  'opaque protected URL is observation-only, not a Native selection capability')
const externalOpaque = 'https://media.example.org/private/chunk?signature=private'
const externalRep = vault.register({ generation, epoch, kind: 'audio', key: 'external:opaque', height: 0, codec: 'other', bandwidth: 192_000,
  urls: [externalOpaque], source: 'page-hint' })
assert.ok(externalRep, 'current-epoch external signed URL can be observed without active capability')
assert.strictEqual(externalRep ? vault.candidates(externalRep, new Set()).native.length : -1, 0, 'external opaque URL never enters Native selection')
const native = rep ? vault.candidates(rep, new Set()).native[0] : null
assert.strictEqual(native?.host, 'upos-hz-mirrorakam.akamaized.net', 'known native family can be explored')
}
void (context?.epoch);
void (epoch);
const protectedUrl = 'https://upos-hz-mirrorakam.akamaized.net/opaque/signed-segment?token=secret'
const protectedRep = vault.register({ generation, epoch, kind: 'audio', key: '30280:opaque', height: 0, codec: 'other', bandwidth: 192_000,
  urls: [protectedUrl], source: 'trusted-api' })
void (protectedRep);
void (vault.match(protectedUrl).context?.kind);
void ('audio');
void (protectedRep ? vault.candidates(protectedRep, new Set()).native.length : -1);
void (0);
const externalOpaque = 'https://media.example.org/private/chunk?signature=private'
const externalRep = vault.register({ generation, epoch, kind: 'audio', key: 'external:opaque', height: 0, codec: 'other', bandwidth: 192_000,
  urls: [externalOpaque], source: 'page-hint' })
void (externalRep);
void (externalRep ? vault.candidates(externalRep, new Set()).native.length : -1);
void (0);
const native = rep ? vault.candidates(rep, new Set()).native[0] : null
void (native?.host);
void ('upos-hz-mirrorakam.akamaized.net');

if (scenario === 8) return async () => {
if (rep && native) {
  assert.strictEqual(vault.resolve(native.handle, native.route)?.includes('token=secret'), true, 'opaque handle resolves inside vault')
  vault.invalidate(rep, native.host)
  assert.strictEqual(vault.candidates(rep, new Set()).native.length, 0, 'epoch invalidation removes native candidate')
}
}
if (rep && native) {
void (vault.resolve(native.handle, native.route)?.includes('token=secret'));
void (true);
  vault.invalidate(rep, native.host)
void (vault.candidates(rep, new Set()).native.length);
void (0);
}
vault.reset(generationId(2), epochId(0))
if (scenario === 9) return async () => {
assert.strictEqual(context ? vault.resolve(native?.handle ?? signedRouteHandle('missing'), context) : null, null, 'signed route never crosses generation')
const pcdnUrl = 'https://x.szbdyd.com/a.m4s'
const pcdnRep = vault.register({ generation: generationId(2), epoch: epochId(0), kind: 'video', key: 'pcdn', height: 720, codec: 'avc', bandwidth: 1,
  urls: [pcdnUrl], source: 'trusted-api' })
assert.ok(pcdnRep, 'safe exact PCDN source is held privately for Catalog generation')
}
void (context ? vault.resolve(native?.handle ?? signedRouteHandle('missing'), context) : null);
void (null);
const pcdnUrl = 'https://x.szbdyd.com/a.m4s'
const pcdnRep = vault.register({ generation: generationId(2), epoch: epochId(0), kind: 'video', key: 'pcdn', height: 720, codec: 'avc', bandwidth: 1,
  urls: [pcdnUrl], source: 'trusted-api' })
void (pcdnRep);

if (scenario === 10) return async () => {
if (pcdnRep) {
  const identity = vault.identity(pcdnRep), handle = vault.catalogSourceHandle(pcdnRep)
  assert.strictEqual(identity && handle ? vault.resolve(handle, identity) : null, pcdnUrl,
    'PCDN Catalog source handle resolves only the current exact signed URL')
  assert.strictEqual(vault.match(pcdnUrl).context?.representation, pcdnRep, 'exact PCDN source is attributable')
  assert.strictEqual(vault.candidates(pcdnRep, new Set()).native.length, 0, 'PCDN source never becomes an active Native candidate')
  assert.strictEqual(vault.candidates(pcdnRep, new Set()).root, null, 'PCDN source never becomes an original fallback')
}
}
if (pcdnRep) {
  const identity = vault.identity(pcdnRep), handle = vault.catalogSourceHandle(pcdnRep)
void (identity && handle ? vault.resolve(handle, identity) : null);
void (pcdnUrl);
void (vault.match(pcdnUrl).context?.representation);
void (pcdnRep);
void (vault.candidates(pcdnRep, new Set()).native.length);
void (0);
void (vault.candidates(pcdnRep, new Set()).root);
void (null);
}
const storage = new FakeStorage(), restrictions = scope.own(new RestrictionStore(storage, () => now))
await restrictions.add({ host: TRUSTED_CATALOG[0], type: 'black', kind: 'all', reason: 'test', expireAt: now + 1000 })
if (scenario === 11) return async () => {
assert.strictEqual(restrictions.has(TRUSTED_CATALOG[0], 'audio', 'black'), true, 'restriction applies to audio')
storage.remote('bilicdn.v2.restrictions', { schema: 2, records: [], updatedAt: now + 1 })
assert.strictEqual(restrictions.has(TRUSTED_CATALOG[0], 'video'), false, 'newer remote removal replaces stale restriction state')
await restrictions.add({ host: TRUSTED_CATALOG[0], type: 'black', kind: 'all', reason: 'test', expireAt: now + 1000 })
await restrictions.remove(TRUSTED_CATALOG[0], 'black')
assert.strictEqual(restrictions.has(TRUSTED_CATALOG[0], 'video'), false, 'restriction removal applies immediately')
const legacyUserRestriction = new FakeStorage()
legacyUserRestriction.set('bilicdn.v2.restrictions', { schema: 2, updatedAt: now, records: [{ host: TRUSTED_CATALOG[0],
  type: 'black', kind: 'video', reason: 'user', createdAt: now, updatedAt: now, expireAt: now + 60_000 }] })
const restoredUserRestriction = scope.own(new RestrictionStore(legacyUserRestriction, () => now))
assert.strictEqual(restoredUserRestriction.has(TRUSTED_CATALOG[0], 'audio', 'black'), true,
  'existing user-created video blacklist also protects audio after update')
assert.strictEqual(restoredUserRestriction.list()[0]?.kind, 'all', 'existing user-created blacklist displays its effective scope')
const settings = scope.own(new SettingsStore(storage, () => now)), evidenceStore = scope.own(new EvidenceStore(storage, () => now)), session = new SessionStore()
await settings.update({ considerNativeSources: true })
await evidenceStore.record(TRUSTED_CATALOG[0], 'video', { requestId: 'remote-clear', at: now, source: 'transport', outcome: 'success', throughputMbps: 8, ttfbMs: 20, failureKind: null })
assert.ok(evidenceStore.get(TRUSTED_CATALOG[0], 'video'), 'evidence store records local result')
storage.remote('bilicdn.v2.routeEvidence', { schema: 2, records: {}, updatedAt: now + 1 })
assert.strictEqual(evidenceStore.get(TRUSTED_CATALOG[0], 'video'), null, 'newer remote clear removes stale evidence')
const legacyOnly = new FakeStorage();
legacyOnly.set('cdnHealth', { poisoned: true });
legacyOnly.set('workerStats_v1', { created: 99 })
const freshSettings = scope.own(new SettingsStore(legacyOnly, () => now))
assert.strictEqual(freshSettings.get().codec, 'av1', 'v2 settings ignore every v1 key')
assert.strictEqual([...legacyOnly.values.keys()].includes('bilicdn.v2.settings'), false, 'reading defaults does not migrate legacy data')
assert.strictEqual(freshSettings.get().considerNativeSources, false, 'Native source use defaults off without stored v2 settings')
}
void (restrictions.has(TRUSTED_CATALOG[0], 'audio', 'black'));
void (true);
storage.remote('bilicdn.v2.restrictions', { schema: 2, records: [], updatedAt: now + 1 })
void (restrictions.has(TRUSTED_CATALOG[0], 'video'));
void (false);
await restrictions.add({ host: TRUSTED_CATALOG[0], type: 'black', kind: 'all', reason: 'test', expireAt: now + 1000 })
await restrictions.remove(TRUSTED_CATALOG[0], 'black')
void (restrictions.has(TRUSTED_CATALOG[0], 'video'));
void (false);
const legacyUserRestriction = new FakeStorage()
legacyUserRestriction.set('bilicdn.v2.restrictions', { schema: 2, updatedAt: now, records: [{ host: TRUSTED_CATALOG[0],
  type: 'black', kind: 'video', reason: 'user', createdAt: now, updatedAt: now, expireAt: now + 60_000 }] })
const restoredUserRestriction = scope.own(new RestrictionStore(legacyUserRestriction, () => now))
void (restoredUserRestriction.has(TRUSTED_CATALOG[0], 'audio', 'black'));
void (true);
void (restoredUserRestriction.list()[0]?.kind);
void ('all');
const settings = scope.own(new SettingsStore(storage, () => now)), evidenceStore = scope.own(new EvidenceStore(storage, () => now)), session = new SessionStore()
await settings.update({ considerNativeSources: true })
await evidenceStore.record(TRUSTED_CATALOG[0], 'video', { requestId: 'remote-clear', at: now, source: 'transport', outcome: 'success', throughputMbps: 8, ttfbMs: 20, failureKind: null })
void (evidenceStore.get(TRUSTED_CATALOG[0], 'video'));
storage.remote('bilicdn.v2.routeEvidence', { schema: 2, records: {}, updatedAt: now + 1 })
void (evidenceStore.get(TRUSTED_CATALOG[0], 'video'));
void (null);
const legacyOnly = new FakeStorage();
legacyOnly.set('cdnHealth', { poisoned: true });
legacyOnly.set('workerStats_v1', { created: 99 })
const freshSettings = scope.own(new SettingsStore(legacyOnly, () => now))
void (freshSettings.get().codec);
void ('av1');
void ([...legacyOnly.values.keys()].includes('bilicdn.v2.settings'));
void (false);
void (freshSettings.get().considerNativeSources);
void (false);
const nativeSettingStorage = new FakeStorage()
nativeSettingStorage.set('bilicdn.v2.settings', { schema: 2, disabled: false, codec: 'hevc', updatedAt: now - 10 })
const nativeSettings = scope.own(new SettingsStore(nativeSettingStorage, () => now))
if (scenario === 12) return async () => {
assert.strictEqual(nativeSettings.get().considerNativeSources, false, 'existing schema 2 settings without Native toggle default off')
assert.strictEqual(nativeSettings.get().codec, 'hevc', 'missing Native toggle preserves existing schema 2 preferences')
await nativeSettings.update({ considerNativeSources: true })
assert.strictEqual(nativeSettings.get().considerNativeSources, true, 'Native source permission can be enabled')
const nativeOtherTab = scope.own(new SettingsStore(nativeSettingStorage, () => now))
assert.strictEqual(nativeOtherTab.get().considerNativeSources, true,
  'Native source permission persists for another tab')
nativeSettingStorage.remote('bilicdn.v2.settings', { ...nativeSettings.get(), considerNativeSources: false,
  updatedAt: nativeSettings.get().updatedAt + 1 })
assert.strictEqual(nativeSettings.get().considerNativeSources, false, 'remote settings can turn Native source use off')
assert.strictEqual(nativeOtherTab.get().considerNativeSources, false, 'remote Native switch reaches another open tab')
nativeSettingStorage.remote('bilicdn.v2.settings', { ...nativeSettings.get(), considerNativeSources: 'true',
  updatedAt: nativeSettings.get().updatedAt + 1 })
assert.strictEqual(nativeSettings.get().considerNativeSources, false, 'non-boolean stored Native permission cannot enable Native use')
await nativeSettings.reset()
assert.strictEqual(nativeSettings.get().considerNativeSources, false, 'settings reset leaves Native source use off')
}
void (nativeSettings.get().considerNativeSources);
void (false);
void (nativeSettings.get().codec);
void ('hevc');
await nativeSettings.update({ considerNativeSources: true })
void (nativeSettings.get().considerNativeSources);
void (true);
const nativeOtherTab = scope.own(new SettingsStore(nativeSettingStorage, () => now))
void (nativeOtherTab.get().considerNativeSources);
void (true);
nativeSettingStorage.remote('bilicdn.v2.settings', { ...nativeSettings.get(), considerNativeSources: false,
  updatedAt: nativeSettings.get().updatedAt + 1 })
void (nativeSettings.get().considerNativeSources);
void (false);
void (nativeOtherTab.get().considerNativeSources);
void (false);
nativeSettingStorage.remote('bilicdn.v2.settings', { ...nativeSettings.get(), considerNativeSources: 'true',
  updatedAt: nativeSettings.get().updatedAt + 1 })
void (nativeSettings.get().considerNativeSources);
void (false);
await nativeSettings.reset()
void (nativeSettings.get().considerNativeSources);
void (false);
const futureSettingsStorage = new FakeStorage()
const futureResetTab = scope.own(new SettingsStore(futureSettingsStorage, () => now))
const futureOtherTab = scope.own(new SettingsStore(futureSettingsStorage, () => now))
futureSettingsStorage.remote('bilicdn.v2.settings', {
  ...futureResetTab.get(), considerNativeSources: true, updatedAt: now + 60_000,
})
if (scenario === 13) return async () => {
assert.strictEqual(futureOtherTab.get().considerNativeSources, true,
  'other tab receives a Native-on setting with a future timestamp')
await futureResetTab.reset()
futureSettingsStorage.remote('bilicdn.v2.settings', futureSettingsStorage.get('bilicdn.v2.settings', null))
assert.strictEqual(futureOtherTab.get().considerNativeSources, false,
  'settings reset propagates Native-off across tabs even after a future timestamp')
const delayedStorage = new DelayedSettingsStorage(), delayedSettings = scope.own(new SettingsStore(delayedStorage, () => now))
await delayedSettings.update({ considerNativeSources: true })
const delayedSession = new SessionStore(), delayedState = delayedSession.beginGeneration(false)
const delayedVault = new SignedRouteVault();
delayedVault.reset(delayedState.generation, delayedState.epoch)
const delayedRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/delayed/video.m4s?signature=delayed'
delayedVault.register({ generation: delayedState.generation, epoch: delayedState.epoch,
  kind: 'video', key: 'delayed', height: 1080, codec: 'av1', bandwidth: 1_000_000,
  urls: [delayedRoot], source: 'trusted-api' })
const delayedRoutes = new RouteCoordinator(clock, delayedSession, delayedSettings,
  scope.own(new RestrictionStore(delayedStorage, () => now)), scope.own(new EvidenceStore(delayedStorage, () => now)), delayedVault, createRuntimeIds())
assert.strictEqual(delayedRoutes.apply(delayedRoot).decision.routeType, 'root-original',
  'delayed-lock fixture initially permits Native-on original')
delayedStorage.holdNextSettingsLock = true
const pendingNativeOff = delayedSettings.update({ considerNativeSources: false })
assert.strictEqual(delayedSettings.get().considerNativeSources, false,
  'turning Native off takes effect before storage lock callback completes')
assert.strictEqual(delayedRoutes.apply(delayedRoot).decision.routeType, 'catalog-generated',
  'pre-dispatch routing obeys pending Native-off update')
delayedStorage.remote('bilicdn.v2.settings', { ...delayedSettings.get(), considerNativeSources: true, updatedAt: now + 100 })
assert.strictEqual(delayedSettings.get().considerNativeSources, false,
  'remote Native-on update cannot reopen Native while a local OFF write is pending')
delayedStorage.releaseSettingsLock()
await pendingNativeOff
assert.strictEqual(delayedSettings.get().considerNativeSources, false, 'pending Native-off write completes with OFF state')
await delayedSettings.update({ considerNativeSources: true })
delayedStorage.holdNextSettingsLock = true
const pendingNativeReset = delayedSettings.reset()
assert.strictEqual(delayedSettings.get().considerNativeSources, false,
  'settings reset defaults Native use OFF before storage lock callback completes')
assert.strictEqual(delayedRoutes.apply(delayedRoot).decision.routeType, 'catalog-generated',
  'pre-dispatch routing obeys pending settings reset')
}
void (futureOtherTab.get().considerNativeSources);
void (true);
await futureResetTab.reset()
futureSettingsStorage.remote('bilicdn.v2.settings', futureSettingsStorage.get('bilicdn.v2.settings', null))
void (futureOtherTab.get().considerNativeSources);
void (false);
const delayedStorage = new DelayedSettingsStorage(), delayedSettings = scope.own(new SettingsStore(delayedStorage, () => now))
await delayedSettings.update({ considerNativeSources: true })
const delayedSession = new SessionStore(), delayedState = delayedSession.beginGeneration(false)
const delayedVault = new SignedRouteVault();
delayedVault.reset(delayedState.generation, delayedState.epoch)
const delayedRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/delayed/video.m4s?signature=delayed'
delayedVault.register({ generation: delayedState.generation, epoch: delayedState.epoch,
  kind: 'video', key: 'delayed', height: 1080, codec: 'av1', bandwidth: 1_000_000,
  urls: [delayedRoot], source: 'trusted-api' })
const delayedRoutes = new RouteCoordinator(clock, delayedSession, delayedSettings,
  scope.own(new RestrictionStore(delayedStorage, () => now)), scope.own(new EvidenceStore(delayedStorage, () => now)), delayedVault, createRuntimeIds())
void (delayedRoutes.apply(delayedRoot).decision.routeType);
void ('root-original');
delayedStorage.holdNextSettingsLock = true
const pendingNativeOff = delayedSettings.update({ considerNativeSources: false })
void (delayedSettings.get().considerNativeSources);
void (false);
void (delayedRoutes.apply(delayedRoot).decision.routeType);
void ('catalog-generated');
delayedStorage.remote('bilicdn.v2.settings', { ...delayedSettings.get(), considerNativeSources: true, updatedAt: now + 100 })
void (delayedSettings.get().considerNativeSources);
void (false);
delayedStorage.releaseSettingsLock()
await pendingNativeOff
void (delayedSettings.get().considerNativeSources);
void (false);
await delayedSettings.update({ considerNativeSources: true })
delayedStorage.holdNextSettingsLock = true
const pendingNativeReset = delayedSettings.reset()
void (delayedSettings.get().considerNativeSources);
void (false);
void (delayedRoutes.apply(delayedRoot).decision.routeType);
void ('catalog-generated');
delayedStorage.releaseSettingsLock()
await pendingNativeReset
const reuseStorage = new FakeStorage(), reuseSettings = scope.own(new SettingsStore(reuseStorage, () => now))
await reuseSettings.update({ considerNativeSources: true })
const reuseSession = new SessionStore(), reuseState = reuseSession.beginGeneration(false)
const reuseVault = new SignedRouteVault();
reuseVault.reset(reuseState.generation, reuseState.epoch)
const reuseRoutes = new RouteCoordinator(clock, reuseSession, reuseSettings,
  scope.own(new RestrictionStore(reuseStorage, () => now)), scope.own(new EvidenceStore(reuseStorage, () => now)), reuseVault, createRuntimeIds())
const reusePlayurl = new PlayurlAdapter(new PlayurlController(reuseSession, reuseVault, reuseRoutes, reuseSettings))
const reusedPageRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/reuse/page.m4s?signature=page'
const reusedPagePayload = { data: { dash: { video: [{ id: 80, codecid: 13, height: 1080,
  bandwidth: 1_000_000, base_url: reusedPageRoot, backup_url: [] as string[] }], audio: [] } } }
reusePlayurl.transform(reusedPagePayload, 'page-hint')
if (scenario === 14) return async () => {
assert.strictEqual(reusedPagePayload.data.dash.video[0]?.base_url, reusedPageRoot,
  'Native-on page hint initially preserves its original URL')
await reuseSettings.update({ considerNativeSources: false })
reuseRoutes.invalidateForUserSetting()
reusePlayurl.transform(reusedPagePayload, 'page-hint')
assert.ok(TRUSTED_CATALOG.includes(new URL(reusedPagePayload.data.dash.video[0]?.base_url ?? '').host as typeof TRUSTED_CATALOG[number]),
  'same-generation seen page hint is reprocessed to Catalog after Native switch turns off')
await reuseSettings.update({ considerNativeSources: true })
await reuseSettings.update({ considerNativeSources: false })
reusedPagePayload.data.dash.video[0]!.base_url = reusedPageRoot
reusePlayurl.transform(reusedPagePayload, 'page-hint')
assert.ok(TRUSTED_CATALOG.includes(new URL(reusedPagePayload.data.dash.video[0]?.base_url ?? '').host as typeof TRUSTED_CATALOG[number]),
  'OFF-to-ON-to-OFF transition without intermediate transform cannot reuse unsafe page-hint cache')
const mutatedPageRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/reuse/page-mutated.m4s?signature=changed'
reusedPagePayload.data.dash.video[0]!.base_url = mutatedPageRoot
reusePlayurl.transform(reusedPagePayload, 'page-hint')
assert.ok(TRUSTED_CATALOG.includes(new URL(reusedPagePayload.data.dash.video[0]?.base_url ?? '').host as typeof TRUSTED_CATALOG[number]),
  'mutated same-object page hint is re-sanitized while Native stays OFF')
assert.strictEqual(new URL(reusedPagePayload.data.dash.video[0]?.base_url ?? '').search, new URL(mutatedPageRoot).search,
  'same-object page hint mutation preserves its newly requested query during Catalog rewrite')
await reuseSettings.update({ considerNativeSources: true })
reuseRoutes.invalidateForUserSetting()
const reusedApiRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/reuse/api.m4s?signature=api'
const reusedApiPayload = { data: { dash: { video: [{ id: 64, codecid: 13, height: 720,
  bandwidth: 1_000_000, base_url: reusedApiRoot, backup_url: [] as string[] }], audio: [] } } }
reusePlayurl.transform(reusedApiPayload, 'trusted-api', 'reuse-api-response')
assert.strictEqual(reusedApiPayload.data.dash.video[0]?.base_url, reusedApiRoot,
  'Native-on trusted response initially preserves its original URL')
await reuseSettings.update({ considerNativeSources: false })
reuseRoutes.invalidateForUserSetting()
reusePlayurl.transform(reusedApiPayload, 'trusted-api', 'reuse-api-response')
assert.ok(TRUSTED_CATALOG.includes(new URL(reusedApiPayload.data.dash.video[0]?.base_url ?? '').host as typeof TRUSTED_CATALOG[number]),
  'same-generation response key is reprocessed to Catalog after Native switch turns off')
await reuseSettings.update({ considerNativeSources: true })
await reuseSettings.update({ considerNativeSources: false })
reusedApiPayload.data.dash.video[0]!.base_url = reusedApiRoot
reusePlayurl.transform(reusedApiPayload, 'trusted-api', 'reuse-api-response')
assert.ok(TRUSTED_CATALOG.includes(new URL(reusedApiPayload.data.dash.video[0]?.base_url ?? '').host as typeof TRUSTED_CATALOG[number]),
  'OFF-to-ON-to-OFF transition without intermediate transform cannot reuse unsafe responseKey cache')
}
void (reusedPagePayload.data.dash.video[0]?.base_url);
void (reusedPageRoot);
await reuseSettings.update({ considerNativeSources: false })
reuseRoutes.invalidateForUserSetting()
reusePlayurl.transform(reusedPagePayload, 'page-hint')
void (TRUSTED_CATALOG.includes(new URL(reusedPagePayload.data.dash.video[0]?.base_url ?? '').host as typeof TRUSTED_CATALOG[number]));
await reuseSettings.update({ considerNativeSources: true })
await reuseSettings.update({ considerNativeSources: false })
reusedPagePayload.data.dash.video[0]!.base_url = reusedPageRoot
reusePlayurl.transform(reusedPagePayload, 'page-hint')
void (TRUSTED_CATALOG.includes(new URL(reusedPagePayload.data.dash.video[0]?.base_url ?? '').host as typeof TRUSTED_CATALOG[number]));
const mutatedPageRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/reuse/page-mutated.m4s?signature=changed'
reusedPagePayload.data.dash.video[0]!.base_url = mutatedPageRoot
reusePlayurl.transform(reusedPagePayload, 'page-hint')
void (TRUSTED_CATALOG.includes(new URL(reusedPagePayload.data.dash.video[0]?.base_url ?? '').host as typeof TRUSTED_CATALOG[number]));
void (new URL(reusedPagePayload.data.dash.video[0]?.base_url ?? '').search);
void (new URL(mutatedPageRoot).search);
await reuseSettings.update({ considerNativeSources: true })
reuseRoutes.invalidateForUserSetting()
const reusedApiRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/reuse/api.m4s?signature=api'
const reusedApiPayload = { data: { dash: { video: [{ id: 64, codecid: 13, height: 720,
  bandwidth: 1_000_000, base_url: reusedApiRoot, backup_url: [] as string[] }], audio: [] } } }
reusePlayurl.transform(reusedApiPayload, 'trusted-api', 'reuse-api-response')
void (reusedApiPayload.data.dash.video[0]?.base_url);
void (reusedApiRoot);
await reuseSettings.update({ considerNativeSources: false })
reuseRoutes.invalidateForUserSetting()
reusePlayurl.transform(reusedApiPayload, 'trusted-api', 'reuse-api-response')
void (TRUSTED_CATALOG.includes(new URL(reusedApiPayload.data.dash.video[0]?.base_url ?? '').host as typeof TRUSTED_CATALOG[number]));
await reuseSettings.update({ considerNativeSources: true })
await reuseSettings.update({ considerNativeSources: false })
reusedApiPayload.data.dash.video[0]!.base_url = reusedApiRoot
reusePlayurl.transform(reusedApiPayload, 'trusted-api', 'reuse-api-response')
void (TRUSTED_CATALOG.includes(new URL(reusedApiPayload.data.dash.video[0]?.base_url ?? '').host as typeof TRUSTED_CATALOG[number]));
const mutatedApiRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/reuse/api-mutated.m4s?signature=changed-api'
reusedApiPayload.data.dash.video[0]!.base_url = mutatedApiRoot
reusePlayurl.transform(reusedApiPayload, 'trusted-api', 'reuse-api-response')
if (scenario === 15) return async () => {
assert.ok(TRUSTED_CATALOG.includes(new URL(reusedApiPayload.data.dash.video[0]?.base_url ?? '').host as typeof TRUSTED_CATALOG[number]),
  'mutated same-object trusted payload is re-sanitized despite an already-seen responseKey')
const epochReuseStorage = new FakeStorage(), epochReuseSettings = scope.own(new SettingsStore(epochReuseStorage, () => now))
const epochReuseSession = new SessionStore(), epochReuseState = epochReuseSession.beginGeneration(false)
const epochReuseVault = new SignedRouteVault();
epochReuseVault.reset(epochReuseState.generation, epochReuseState.epoch)
const epochReuseRoutes = new RouteCoordinator(clock, epochReuseSession, epochReuseSettings,
  scope.own(new RestrictionStore(epochReuseStorage, () => now)), scope.own(new EvidenceStore(epochReuseStorage, () => now)), epochReuseVault, createRuntimeIds())
const epochReuseAdapter = new PlayurlAdapter(new PlayurlController(epochReuseSession, epochReuseVault, epochReuseRoutes, epochReuseSettings))
const oldEpochRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/epoch-reuse/old/video.m4s?signature=old-epoch'
const newEpochRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/epoch-reuse/new/video.m4s?signature=new-epoch'
const oldEpochPayload = { data: { dash: { video: [{ id: 80, codecid: 13, height: 1080,
  bandwidth: 1_000_000, base_url: oldEpochRoot, backup_url: [] as string[] }], audio: [] } } }
assert.ok(epochReuseAdapter.transform(oldEpochPayload, 'trusted-api').accepted, 'old trusted payload registers a representation')
const oldEpochRep = epochReuseVault.match(oldEpochRoot).context?.representation
assert.ok(oldEpochRep, 'old trusted payload has a vault identity before epoch reset')
const nextEpochState = epochReuseSession.beginEpoch()
epochReuseVault.reset(nextEpochState.generation, nextEpochState.epoch);
epochReuseRoutes.resetEpoch()
const newEpochRep = epochReuseVault.register({ generation: nextEpochState.generation, epoch: nextEpochState.epoch,
  kind: 'video', key: 'new-epoch', height: 1080, codec: 'av1', bandwidth: 1_000_000,
  urls: [newEpochRoot], source: 'trusted-api' })
assert.strictEqual(newEpochRep, oldEpochRep, 'vault representation IDs are reused in a later epoch')
epochReuseAdapter.transform(oldEpochPayload, 'trusted-api')
const oldEpochOutput = oldEpochPayload.data.dash.video[0]?.base_url ?? ''
assert.ok(!oldEpochOutput.includes('new-epoch') && (oldEpochOutput === ''
  || (TRUSTED_CATALOG.includes(new URL(oldEpochOutput).host as typeof TRUSTED_CATALOG[number])
    && new URL(oldEpochOutput).pathname === new URL(oldEpochRoot).pathname)),
  'reused old trusted payload cannot inherit a new epoch representation root')
}
void (TRUSTED_CATALOG.includes(new URL(reusedApiPayload.data.dash.video[0]?.base_url ?? '').host as typeof TRUSTED_CATALOG[number]));
const epochReuseStorage = new FakeStorage(), epochReuseSettings = scope.own(new SettingsStore(epochReuseStorage, () => now))
const epochReuseSession = new SessionStore(), epochReuseState = epochReuseSession.beginGeneration(false)
const epochReuseVault = new SignedRouteVault();
epochReuseVault.reset(epochReuseState.generation, epochReuseState.epoch)
const epochReuseRoutes = new RouteCoordinator(clock, epochReuseSession, epochReuseSettings,
  scope.own(new RestrictionStore(epochReuseStorage, () => now)), scope.own(new EvidenceStore(epochReuseStorage, () => now)), epochReuseVault, createRuntimeIds())
const epochReuseAdapter = new PlayurlAdapter(new PlayurlController(epochReuseSession, epochReuseVault, epochReuseRoutes, epochReuseSettings))
const oldEpochRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/epoch-reuse/old/video.m4s?signature=old-epoch'
const newEpochRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/epoch-reuse/new/video.m4s?signature=new-epoch'
const oldEpochPayload = { data: { dash: { video: [{ id: 80, codecid: 13, height: 1080,
  bandwidth: 1_000_000, base_url: oldEpochRoot, backup_url: [] as string[] }], audio: [] } } }
void (epochReuseAdapter.transform(oldEpochPayload, 'trusted-api').accepted);
const oldEpochRep = epochReuseVault.match(oldEpochRoot).context?.representation
void (oldEpochRep);
const nextEpochState = epochReuseSession.beginEpoch()
epochReuseVault.reset(nextEpochState.generation, nextEpochState.epoch);
epochReuseRoutes.resetEpoch()
const newEpochRep = epochReuseVault.register({ generation: nextEpochState.generation, epoch: nextEpochState.epoch,
  kind: 'video', key: 'new-epoch', height: 1080, codec: 'av1', bandwidth: 1_000_000,
  urls: [newEpochRoot], source: 'trusted-api' })
void (newEpochRep);
void (oldEpochRep);
epochReuseAdapter.transform(oldEpochPayload, 'trusted-api')
const oldEpochOutput = oldEpochPayload.data.dash.video[0]?.base_url ?? ''
void (!oldEpochOutput.includes('new-epoch') && (oldEpochOutput === ''
  || (TRUSTED_CATALOG.includes(new URL(oldEpochOutput).host as typeof TRUSTED_CATALOG[number])
    && new URL(oldEpochOutput).pathname === new URL(oldEpochRoot).pathname)));
throw Error('Unknown fixture scenario')
}

test("signed route registered [1]", { timeout: 5000 }, async t => { await (await fixture(t, 0))() })
test("late page hints cannot replace the trusted root [2]", { timeout: 5000 }, async t => { await (await fixture(t, 1))() })
test("trusted API replaces invalidated provisional route on the same host [3]", { timeout: 5000 }, async t => { await (await fixture(t, 2))() })
test("late lower-trust page hint does not rewrite or merge into trusted API output [4]", { timeout: 5000 }, async t => { await (await fixture(t, 3))() })
test("late preflight result from the retired hint cannot create health evidence [5]", { timeout: 5000 }, async t => { await (await fixture(t, 4))() })
test("late challenger result from the retired hint cannot create health evidence [6]", { timeout: 5000 }, async t => { await (await fixture(t, 5))() })
test("retired page-hint transport does not punish its old host after API adoption [7]", { timeout: 5000 }, async t => { await (await fixture(t, 6))() })
test("exact signed route maps to current epoch [8]", { timeout: 5000 }, async t => { await (await fixture(t, 7))() })
test("opaque handle resolves inside vault [9]", { timeout: 5000 }, async t => { await (await fixture(t, 8))() })
test("signed route never crosses generation [10]", { timeout: 5000 }, async t => { await (await fixture(t, 9))() })
test("PCDN Catalog source handle resolves only the current exact signed URL [11]", { timeout: 5000 }, async t => { await (await fixture(t, 10))() })
test("restriction applies to audio [12]", { timeout: 5000 }, async t => { await (await fixture(t, 11))() })
test("existing schema 2 settings without Native toggle default off [13]", { timeout: 5000 }, async t => { await (await fixture(t, 12))() })
test("other tab receives a Native-on setting with a future timestamp [14]", { timeout: 5000 }, async t => { await (await fixture(t, 13))() })
test("Native-on page hint initially preserves its original URL [15]", { timeout: 5000 }, async t => { await (await fixture(t, 14))() })
test("mutated same-object trusted payload is re-sanitized despite an already-seen responseKey [16]", { timeout: 5000 }, async t => { await (await fixture(t, 15))() })
