import { addEvidenceSample, emptyEvidence, evidenceMetrics } from '../src-v2/domain/evidence.ts'
import { assessDemandRatio, chooseRoute, rankRoutes } from '../src-v2/domain/routing.ts'
import { decisionId, epochId, generationId, recoveryActionId, representationId, requestId } from '../src-v2/domain/model.ts'
import { TRUSTED_CATALOG } from '../src-v2/domain/catalog.ts'
import { parseMediaUrl, replaceUrlHost } from '../src-v2/domain/url-policy.ts'
import { SignedRouteVault } from '../src-v2/state/signed-route-vault.ts'
import { RestrictionStore } from '../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../src-v2/state/evidence-store.ts'
import { SettingsStore } from '../src-v2/state/settings-store.ts'
import { SessionStore } from '../src-v2/state/session-store.ts'
import { RouteCoordinator } from '../src-v2/application/route-coordinator.ts'
import type { StoragePort } from '../src-v2/platform/storage.ts'
import { TransportAdapter } from '../src-v2/adapters/transport.ts'
import { DiagnosticRecorder } from '../src-v2/diagnostics/recorder.ts'
import type { AppliedRouteDecision } from '../src-v2/application/route-coordinator.ts'
import type { DomainEvent, RouteDecision, TransportObservation } from '../src-v2/domain/model.ts'
import { RecoveryController } from '../src-v2/application/recovery-controller.ts'
import { MeasurementController } from '../src-v2/application/measurement-controller.ts'
import { PlayerMonitor } from '../src-v2/application/player-monitor.ts'
import { PlayerAdapter } from '../src-v2/adapters/player.ts'
import { PlayurlAdapter } from '../src-v2/adapters/playurl.ts'
import { PagePlayinfoAdapter } from '../src-v2/adapters/page-playinfo.ts'
import type { PlayerPort, VideoSnapshot } from '../src-v2/application/ports.ts'

let passed = 0
const check = (condition: unknown, message: string): void => { if (!condition) throw new Error(message); passed++ }
const equal = (actual: unknown, expected: unknown, message: string): void => check(Object.is(actual, expected), `${message}: ${String(actual)} !== ${String(expected)}`)

class FakeStorage implements StoragePort {
  readonly values = new Map<string, unknown>()
  readonly listeners = new Map<string, Set<(value: unknown, remote: boolean) => void>>()
  get<T>(key: string, fallback: T): T { return (this.values.has(key) ? this.values.get(key) : fallback) as T }
  set<T>(key: string, value: T): void { this.values.set(key, structuredClone(value)); for (const listener of this.listeners.get(key) ?? []) listener(value, false) }
  delete(key: string): void { this.values.delete(key) }
  listen<T>(key: string, listener: (value: T, remote: boolean) => void): () => void {
    const rows = this.listeners.get(key) ?? new Set(); rows.add(listener as (value: unknown, remote: boolean) => void); this.listeners.set(key, rows)
    return () => rows.delete(listener as (value: unknown, remote: boolean) => void)
  }
  async withLock<T>(_name: string, task: () => Promise<T> | T): Promise<T> { return await task() }
  remote<T>(key: string, value: T): void { this.values.set(key, structuredClone(value)); for (const listener of this.listeners.get(key) ?? []) listener(value, true) }
}

class DelayedSettingsStorage extends FakeStorage {
  holdNextSettingsLock = false
  releaseSettingsLock: () => void = () => undefined
  override async withLock<T>(name: string, task: () => Promise<T> | T): Promise<T> {
    if (name === 'settings' && this.holdNextSettingsLock) {
      this.holdNextSettingsLock = false
      await new Promise<void>(resolve => { this.releaseSettingsLock = resolve })
    }
    return await super.withLock(name, task)
  }
}

const now = 2_000_000_000_000
const clock = { now: () => now }

const evidence = addEvidenceSample(emptyEvidence('a.example', 'video'), {
  requestId: '1', at: now, source: 'transport', outcome: 'success', throughputMbps: 10, ttfbMs: 80, failureKind: null,
}, now)
equal(evidenceMetrics(evidence, now).safeThroughputMbps, 7, 'one sample uses 70 percent')
const second = addEvidenceSample(evidence, {
  requestId: '2', at: now + 1, source: 'transport', outcome: 'success', throughputMbps: 6, ttfbMs: 40, failureKind: null,
}, now + 1)
equal(evidenceMetrics(second, now + 1).safeThroughputMbps, 6, 'two samples use minimum')
equal(evidenceMetrics(second, now + 1).state, 'proven', 'two quiet successes are proven')
const failed = addEvidenceSample(second, {
  requestId: '3', at: now + 2, source: 'transport', outcome: 'failure', throughputMbps: null, ttfbMs: null, failureKind: 'timeout',
}, now + 2)
equal(evidenceMetrics(failed, now + 2).state, 'circuit-open', 'verified failure opens circuit')
equal(failed.circuitUntil - (now + 2), 10 * 60_000, 'first circuit backoff is ten minutes')
let stepped = failed
for (let level = 2; level <= 4; level++) {
  stepped = addEvidenceSample(stepped, { requestId: `failure-${level}`, at: now + level, source: 'transport', outcome: 'failure',
    throughputMbps: null, ttfbMs: null, failureKind: 'network' }, now + level)
}
equal(stepped.circuitUntil - (now + 4), 6 * 60 * 60_000, 'circuit backoff caps at six hours')
let bounded = emptyEvidence('bounded.example', 'video')
for (let index = 0; index < 20; index++) bounded = addEvidenceSample(bounded, { requestId: String(index), at: now + index,
  source: 'transport', outcome: 'success', throughputMbps: index + 1, ttfbMs: index, failureKind: null }, now + index)
equal(bounded.samples.length, 12, 'evidence window retains at most twelve samples')

const candidate = { type: 'catalog-generated' as const, host: TRUSTED_CATALOG[0], kind: 'video' as const, catalogIndex: 0 }
const restrictionInput = {
  candidates: [candidate], evidenceFor: () => null,
  restrictions: { disabledCatalogHosts: new Set<string>(), defaultUnavailableHosts: new Set<string>(), blackHosts: new Set([candidate.host]), deadHosts: new Set<string>(), hostLocked: new Set<string>() },
  demand: { kind: 'video' as const, requiredMbps: 8, highDemand: false }, fixedHost: candidate.host,
  current: null, boundary: 'startup' as const, failedHost: null,
}
const restricted = rankRoutes(restrictionInput, now)[0]
equal(restricted?.eligible, false, 'black precedes fixed host')
check(restricted?.reasons.includes('black'), 'black reason retained')
equal(chooseRoute(restrictionInput, clock, decisionId('d1')).action, 'block', 'forbidden-only route blocks')

const coldInput = { ...restrictionInput, restrictions: { ...restrictionInput.restrictions, blackHosts: new Set<string>() }, fixedHost: null }
const cold = chooseRoute(coldInput, clock, decisionId('d2'))
equal(cold.action, 'rewrite', 'cold start rewrites to catalog default')
equal(cold.host, candidate.host, 'cold start chooses first eligible catalog')
const coldRoot = { type: 'root-original' as const, host: 'upos-hz-mirrorakam.akamaized.net', kind: 'video' as const,
  catalogIndex: Number.MAX_SAFE_INTEGER, route: null, handle: null }
const coldWithRoot = chooseRoute({ ...coldInput, candidates: [candidate, coldRoot] }, clock, decisionId('d2-root'))
equal(coldWithRoot.action, 'pass', 'cold start with a legal signed original does not blindly use first Catalog')
const secondCatalog = { type: 'catalog-generated' as const, host: TRUSTED_CATALOG[1], kind: 'video' as const, catalogIndex: 1 }
const measured = new Map<string, ReturnType<typeof addEvidenceSample>>([
  [candidate.host, addEvidenceSample(emptyEvidence(candidate.host, 'video'), { requestId: 'catalog-first', at: now,
    source: 'challenge', outcome: 'success', throughputMbps: 20, ttfbMs: 20, failureKind: null }, now)],
  [secondCatalog.host, addEvidenceSample(emptyEvidence(secondCatalog.host, 'video'), { requestId: 'catalog-second', at: now,
    source: 'challenge', outcome: 'success', throughputMbps: 40, ttfbMs: 40, failureKind: null }, now)],
])
const fairDecision = chooseRoute({ ...coldInput, candidates: [candidate, secondCatalog, coldRoot],
  evidenceFor: host => measured.get(host) ?? null, boundary: 'new-epoch' }, clock, decisionId('fair-selection'))
equal(fairDecision.host, secondCatalog.host, 'new epoch ranks measured safety margin before Catalog static order')
const insufficientDecision = chooseRoute({ ...coldInput, candidates: [candidate, coldRoot],
  evidenceFor: host => host === candidate.host ? addEvidenceSample(emptyEvidence(host, 'video'), { requestId: 'slow', at: now,
    source: 'challenge', outcome: 'success', throughputMbps: 5, ttfbMs: 10, failureKind: null }, now) : null,
  boundary: 'new-epoch' }, clock, decisionId('insufficient-selection'))
equal(insufficientDecision.action, 'pass', 'insufficient measured throughput preserves the legal original')

const parsed = parseMediaUrl('https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/1.m4s?token=x')
equal(parsed?.kind, 'normal', 'media URL recognized')
check(replaceUrlHost(parsed?.url.href ?? '', TRUSTED_CATALOG[3])?.includes(TRUSTED_CATALOG[3]), 'catalog replacement preserves a valid media URL')
equal(parseMediaUrl('https://1.2.3.4:8080/a.m4s')?.kind, 'pcdn', 'special-port IP rejected as PCDN')
equal(parseMediaUrl('https://x.example/live-bvc/a.m4s')?.kind, 'live', 'live route identified')

const vault = new SignedRouteVault(), generation = generationId(1), epoch = epochId(1)
vault.reset(generation, epoch)
const rep = vault.register({ generation, epoch, kind: 'video', key: '80:av1', height: 1080, codec: 'av1', bandwidth: 4_000_000,
  urls: ['https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/1.m4s?token=secret'], source: 'trusted-api' })
check(rep, 'signed route registered')
equal(vault.register({ generation, epoch, kind: 'video', key: '80:av1', height: 1080, codec: 'av1', bandwidth: 4_000_000,
  urls: ['https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/1.m4s?token=secret'], source: 'player-mpd' }), rep,
  'repeated manifest ingestion preserves representation identity')
const authorityVault = new SignedRouteVault(); authorityVault.reset(generation, epoch)
const hintedUrl = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/hint.m4s?token=hint'
const trustedUrl = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/api.m4s?token=api'
const hintedRep = authorityVault.register({ generation, epoch, kind: 'video', key: '80:av1', height: 1080,
  codec: 'av1', bandwidth: 4_000_000, urls: [hintedUrl], source: 'page-hint' })
check(hintedRep, 'page hint establishes a provisional group')
const hintedIdentity = hintedRep ? authorityVault.identity(hintedRep) : null
const hintedHandle = hintedRep ? authorityVault.candidates(hintedRep, new Set()).native[0]?.handle : null
const trustedRep = authorityVault.register({ generation, epoch, kind: 'video', key: '80:av1', height: 1080,
  codec: 'av1', bandwidth: 4_000_000, urls: [trustedUrl], source: 'trusted-api' })
check(trustedRep, 'trusted API adopts the representation')
equal(trustedRep ? authorityVault.rootUrl(trustedRep) : null, trustedUrl,
  'trusted API root replaces the provisional page URL')
check(!trustedRep || !authorityVault.candidates(trustedRep, new Set()).native.some(route => route.host === 'upos-hz-mirrorakam.akamaized.net'),
  'page-hint Native route cannot remain selectable after trusted API adoption')
equal(hintedHandle && hintedRep ? authorityVault.resolve(hintedHandle, authorityVault.identity(hintedRep)!) : null, null,
  'trusted API adoption revokes the earlier hint handle')
check(!hintedIdentity || !authorityVault.isCurrentIdentity(hintedIdentity),
  'an in-flight page-hint identity is retired on trusted API adoption')
const trustedIdentity = trustedRep ? authorityVault.identity(trustedRep) : null
const lateHintUrl = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/late.m4s?token=late'
authorityVault.register({ generation, epoch, kind: 'video', key: '80:av1', height: 1080,
  codec: 'av1', bandwidth: 4_000_000, urls: [lateHintUrl], source: 'page-hint' })
equal(trustedRep ? authorityVault.rootUrl(trustedRep) : null, trustedUrl,
  'late page hints cannot replace the trusted root')
check(!trustedRep || !authorityVault.candidates(trustedRep, new Set()).native.some(route => route.host === 'upos-hz-mirrorakam.akamaized.net'),
  'late page hints cannot become Native candidates')
authorityVault.register({ generation, epoch, kind: 'video', key: '80:av1', height: 1080,
  codec: 'av1', bandwidth: 4_000_000, urls: [trustedUrl], source: 'trusted-api' })
equal(trustedRep ? authorityVault.identity(trustedRep) : null, trustedIdentity,
  'repeated identical trusted data does not invalidate active work')
const duplicateHintRep = authorityVault.register({ generation, epoch, kind: 'video', key: '999:av1', height: 1080,
  codec: 'av1', bandwidth: 4_000_000, urls: [trustedUrl], source: 'player-mpd' })
equal(duplicateHintRep, trustedRep, 'later different-key hint cannot duplicate a trusted exact URL')
equal(authorityVault.match(trustedUrl).context, trustedIdentity,
  'trusted exact URL remains unambiguous after a different-key hint')
const crossKeyVault = new SignedRouteVault(); crossKeyVault.reset(generation, epoch)
const crossKeyHint = crossKeyVault.register({ generation, epoch, kind: 'video', key: '999:av1', height: 1080,
  codec: 'av1', bandwidth: 4_000_000, urls: [trustedUrl], source: 'page-hint' })
const crossKeyTrusted = crossKeyVault.register({ generation, epoch, kind: 'video', key: '80:av1', height: 1080,
  codec: 'av1', bandwidth: 4_000_000, urls: [trustedUrl], source: 'trusted-api' })
equal(crossKeyVault.match(trustedUrl).context?.representation, crossKeyTrusted,
  'trusted API revokes a different-key hint that duplicates its exact URL')
equal(crossKeyHint ? crossKeyVault.identity(crossKeyHint) : null, null,
  'different-key provisional group is retired after trusted API adoption')
const invalidHintVault = new SignedRouteVault(); invalidHintVault.reset(generation, epoch)
const invalidHintHost = 'upos-hz-mirrorakam.akamaized.net'
const invalidHintRep = invalidHintVault.register({ generation, epoch, kind: 'video', key: '80:av1', height: 1080,
  codec: 'av1', bandwidth: 4_000_000, urls: [hintedUrl], source: 'page-hint' })
check(invalidHintRep, 'provisional route exists before its host is invalidated')
invalidHintVault.invalidate(invalidHintRep!, invalidHintHost)
const sameHostTrustedUrl = `https://${invalidHintHost}/upgcxcode/a/b/trusted.m4s?token=trusted`
const invalidHintTrustedRep = invalidHintVault.register({ generation, epoch, kind: 'video', key: '80:av1', height: 1080,
  codec: 'av1', bandwidth: 4_000_000, urls: [sameHostTrustedUrl], source: 'trusted-api' })
check(invalidHintTrustedRep, 'trusted API replaces invalidated provisional route on the same host')
check(!invalidHintVault.isInvalid(invalidHintTrustedRep!, invalidHintHost),
  'provisional host invalidation does not poison newly trusted exact URL')
equal(invalidHintVault.candidates(invalidHintTrustedRep!, new Set()).native[0]?.host, invalidHintHost,
  'newly trusted Native URL remains selectable after lower-trust promotion')
const authoritySession = new SessionStore(); authoritySession.beginGeneration(false)
const authorityState = authoritySession.beginEpoch(), authorityStorage = new FakeStorage()
const authoritySettings = new SettingsStore(authorityStorage, () => now)
await authoritySettings.update({ considerNativeSources: true })
const authorityRestrictions = new RestrictionStore(authorityStorage, () => now)
const authorityEvidence = new EvidenceStore(authorityStorage, () => now)
const plannedVault = new SignedRouteVault(); plannedVault.reset(authorityState.generation, authorityState.epoch)
const plannedRep = plannedVault.register({ generation: authorityState.generation, epoch: authorityState.epoch,
  kind: 'video', key: '80:av1:1080', height: 1080, codec: 'av1', bandwidth: 4_000_000,
  urls: [hintedUrl], source: 'page-hint' })
check(plannedRep, 'provisional route can be planned before the API arrives')
const plannedRoutes = new RouteCoordinator(clock, authoritySession, authoritySettings, authorityRestrictions, authorityEvidence, plannedVault)
const plannedDemand = { kind: 'video' as const, requiredMbps: 8, highDemand: false }
equal(plannedRep ? plannedRoutes.plan(plannedRep, plannedDemand, 'startup').host : null,
  'upos-hz-mirrorakam.akamaized.net', 'provisional startup initially follows its signed root')
const staleStartup = plannedRoutes.startupOptions(hintedUrl)?.candidates[0] ?? null
const staleChallenge = plannedRep ? plannedRoutes.challenge(plannedRep, plannedDemand, false) : null
const plannedAdapter = new PlayurlAdapter(authoritySession, plannedVault, plannedRoutes, authoritySettings)
const trustedPayload = { data: { dash: { video: [{ id: 80, height: 1080, codecs: 'av01', bandwidth: 4_000_000,
  base_url: trustedUrl, backup_url: [] as string[] }], audio: [] } } }
check(plannedAdapter.transform(trustedPayload, 'trusted-api'), 'trusted API playurl is adopted')
equal(plannedRep ? plannedVault.rootUrl(plannedRep) : null, trustedUrl, 'trusted playurl replaces hint root in the live adapter')
equal(plannedRep ? plannedRoutes.plan(plannedRep, plannedDemand, 'startup').host : null,
  'upos-sz-mirrorali.bilivideo.com', 'previous provisional plan is invalidated at trusted API adoption')
const lateHintPayload = { data: { dash: { video: [{ id: 80, height: 1080, codecs: 'av01', bandwidth: 4_000_000,
  base_url: lateHintUrl, backup_url: [] as string[] }], audio: [] } } }
plannedAdapter.transform(lateHintPayload, 'page-hint')
equal(lateHintPayload.data.dash.video[0]?.base_url, lateHintUrl,
  'late lower-trust page hint does not rewrite or merge into trusted API output')
if (staleStartup) {
  await plannedRoutes.recordStartupSuccess(staleStartup, 70 * 1024, 100, 10)
  equal(authorityEvidence.get(staleStartup.host, 'video'), null,
    'late preflight result from the retired hint cannot create health evidence')
}
if (staleChallenge) {
  await plannedRoutes.recordChallenge(staleChallenge, 70 * 1024, 100, 10, 'success', null)
  equal(authorityEvidence.get(staleChallenge.decision.host ?? '', 'video'), null,
    'late challenger result from the retired hint cannot create health evidence')
}
if (plannedRep) {
  const staleRequest = { requestId: requestId('retired-hint'), generation: authorityState.generation, epoch: authorityState.epoch,
    decisionId: decisionId('retired-hint'), representation: plannedRep, authorityRevision: 1, kind: 'video' as const,
    attributionStatus: 'matched' as const, attributionSource: 'exact' as const, decisionStage: 'request' as const,
    routeType: 'root-original' as const, originalHost: 'upos-hz-mirrorakam.akamaized.net',
    targetHost: 'upos-hz-mirrorakam.akamaized.net', sourceHost: 'upos-hz-mirrorakam.akamaized.net',
    playurlHostChanged: false, playurlOutput: null, urlChanged: false, hostChanged: false, startedAt: now }
  await plannedRoutes.observe({ request: staleRequest, generation: authorityState.generation, epoch: authorityState.epoch,
    decisionId: staleRequest.decisionId, representation: plannedRep, kind: 'video', routeType: 'root-original',
    originalHost: staleRequest.originalHost, targetHost: staleRequest.targetHost, finalHost: staleRequest.targetHost,
    streamKey: 'retired-hint', status: 500, bytes: 0, ttfbMs: 10, elapsedMs: 100, completedAt: now + 100,
    outcome: 'failure', failureKind: 'http-5xx' })
  equal(authorityEvidence.get(staleRequest.targetHost, 'video'), null,
    'retired page-hint transport does not punish its old host after API adoption')
}
const context = vault.contextForUrl('https://upos-hz-mirrorakam.akamaized.net/upgcxcode/a/b/1.m4s?token=secret')
equal(context?.epoch, epoch, 'exact signed route maps to current epoch')
const protectedUrl = 'https://upos-hz-mirrorakam.akamaized.net/opaque/signed-segment?token=secret'
const protectedRep = vault.register({ generation, epoch, kind: 'audio', key: '30280:opaque', height: 0, codec: 'other', bandwidth: 192_000,
  urls: [protectedUrl], source: 'trusted-api' })
check(protectedRep, 'current-epoch signed URL without a known media suffix is retained')
equal(vault.match(protectedUrl).context?.kind, 'audio', 'exact protected signed URL is recognized as audio')
equal(protectedRep ? vault.candidates(protectedRep, new Set()).native.length : -1, 0,
  'opaque protected URL is observation-only, not a Native selection capability')
const externalOpaque = 'https://media.example.org/private/chunk?signature=private'
const externalRep = vault.register({ generation, epoch, kind: 'audio', key: 'external:opaque', height: 0, codec: 'other', bandwidth: 192_000,
  urls: [externalOpaque], source: 'page-hint' })
check(externalRep, 'current-epoch external signed URL can be observed without active capability')
equal(externalRep ? vault.candidates(externalRep, new Set()).native.length : -1, 0, 'external opaque URL never enters Native selection')
const native = rep ? vault.candidates(rep, new Set()).native[0] : null
equal(native?.host, 'upos-hz-mirrorakam.akamaized.net', 'known native family can be explored')
if (rep && native) {
  equal(vault.resolve(native.handle, native.route)?.includes('token=secret'), true, 'opaque handle resolves inside vault')
  vault.invalidate(rep, native.host)
  equal(vault.candidates(rep, new Set()).native.length, 0, 'epoch invalidation removes native candidate')
}
vault.reset(generationId(2), epochId(0))
equal(context ? vault.resolve(native?.handle ?? ('' as never), context) : null, null, 'signed route never crosses generation')
equal(vault.register({ generation: generationId(2), epoch: epochId(0), kind: 'video', key: 'pcdn', height: 720, codec: 'avc', bandwidth: 1,
  urls: ['https://x.szbdyd.com/a.m4s'], source: 'trusted-api' }), null, 'PCDN never enters signed route vault')

const storage = new FakeStorage(), restrictions = new RestrictionStore(storage, () => now)
await restrictions.add({ host: TRUSTED_CATALOG[0], type: 'black', kind: 'all', reason: 'test', expireAt: now + 1000 })
equal(restrictions.has(TRUSTED_CATALOG[0], 'audio', 'black'), true, 'restriction applies to audio')
storage.remote('bilicdn.v2.restrictions', { schema: 2, records: [], updatedAt: now + 1 })
equal(restrictions.has(TRUSTED_CATALOG[0], 'video'), false, 'newer remote removal replaces stale restriction state')
await restrictions.add({ host: TRUSTED_CATALOG[0], type: 'black', kind: 'all', reason: 'test', expireAt: now + 1000 })
await restrictions.remove(TRUSTED_CATALOG[0], 'black')
equal(restrictions.has(TRUSTED_CATALOG[0], 'video'), false, 'restriction removal applies immediately')
const legacyUserRestriction = new FakeStorage()
legacyUserRestriction.set('bilicdn.v2.restrictions', { schema: 2, updatedAt: now, records: [{ host: TRUSTED_CATALOG[0],
  type: 'black', kind: 'video', reason: 'user', createdAt: now, updatedAt: now, expireAt: now + 60_000 }] })
const restoredUserRestriction = new RestrictionStore(legacyUserRestriction, () => now)
equal(restoredUserRestriction.has(TRUSTED_CATALOG[0], 'audio', 'black'), true,
  'existing user-created video blacklist also protects audio after update')
equal(restoredUserRestriction.list()[0]?.kind, 'all', 'existing user-created blacklist displays its effective scope')

const settings = new SettingsStore(storage, () => now), evidenceStore = new EvidenceStore(storage, () => now), session = new SessionStore()
await settings.update({ considerNativeSources: true })
await evidenceStore.record(TRUSTED_CATALOG[0], 'video', { requestId: 'remote-clear', at: now, source: 'transport', outcome: 'success', throughputMbps: 8, ttfbMs: 20, failureKind: null })
check(evidenceStore.get(TRUSTED_CATALOG[0], 'video'), 'evidence store records local result')
storage.remote('bilicdn.v2.routeEvidence', { schema: 2, records: {}, updatedAt: now + 1 })
equal(evidenceStore.get(TRUSTED_CATALOG[0], 'video'), null, 'newer remote clear removes stale evidence')
const legacyOnly = new FakeStorage(); legacyOnly.set('cdnHealth', { poisoned: true }); legacyOnly.set('workerStats_v1', { created: 99 })
const freshSettings = new SettingsStore(legacyOnly, () => now)
equal(freshSettings.get().codec, 'av1', 'v2 settings ignore every v1 key')
equal([...legacyOnly.values.keys()].includes('bilicdn.v2.settings'), false, 'reading defaults does not migrate legacy data')
equal(freshSettings.get().considerNativeSources, false, 'Native source use defaults off without stored v2 settings')
const nativeSettingStorage = new FakeStorage()
nativeSettingStorage.set('bilicdn.v2.settings', { schema: 2, disabled: false, codec: 'hevc', updatedAt: now - 10 })
const nativeSettings = new SettingsStore(nativeSettingStorage, () => now)
equal(nativeSettings.get().considerNativeSources, false, 'existing schema 2 settings without Native toggle default off')
equal(nativeSettings.get().codec, 'hevc', 'missing Native toggle preserves existing schema 2 preferences')
await nativeSettings.update({ considerNativeSources: true })
equal(nativeSettings.get().considerNativeSources, true, 'Native source permission can be enabled')
const nativeOtherTab = new SettingsStore(nativeSettingStorage, () => now)
equal(nativeOtherTab.get().considerNativeSources, true,
  'Native source permission persists for another tab')
nativeSettingStorage.remote('bilicdn.v2.settings', { ...nativeSettings.get(), considerNativeSources: false,
  updatedAt: nativeSettings.get().updatedAt + 1 })
equal(nativeSettings.get().considerNativeSources, false, 'remote settings can turn Native source use off')
equal(nativeOtherTab.get().considerNativeSources, false, 'remote Native switch reaches another open tab')
nativeSettingStorage.remote('bilicdn.v2.settings', { ...nativeSettings.get(), considerNativeSources: 'true',
  updatedAt: nativeSettings.get().updatedAt + 1 })
equal(nativeSettings.get().considerNativeSources, false, 'non-boolean stored Native permission cannot enable Native use')
await nativeSettings.reset()
equal(nativeSettings.get().considerNativeSources, false, 'settings reset leaves Native source use off')
const futureSettingsStorage = new FakeStorage()
const futureResetTab = new SettingsStore(futureSettingsStorage, () => now)
const futureOtherTab = new SettingsStore(futureSettingsStorage, () => now)
futureSettingsStorage.remote('bilicdn.v2.settings', {
  ...futureResetTab.get(), considerNativeSources: true, updatedAt: now + 60_000,
})
equal(futureOtherTab.get().considerNativeSources, true,
  'other tab receives a Native-on setting with a future timestamp')
await futureResetTab.reset()
futureSettingsStorage.remote('bilicdn.v2.settings', futureSettingsStorage.get('bilicdn.v2.settings', null))
equal(futureOtherTab.get().considerNativeSources, false,
  'settings reset propagates Native-off across tabs even after a future timestamp')
const delayedStorage = new DelayedSettingsStorage(), delayedSettings = new SettingsStore(delayedStorage, () => now)
await delayedSettings.update({ considerNativeSources: true })
const delayedSession = new SessionStore(), delayedState = delayedSession.beginGeneration(false)
const delayedVault = new SignedRouteVault(); delayedVault.reset(delayedState.generation, delayedState.epoch)
const delayedRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/delayed/video.m4s?signature=delayed'
delayedVault.register({ generation: delayedState.generation, epoch: delayedState.epoch,
  kind: 'video', key: 'delayed', height: 1080, codec: 'av1', bandwidth: 1_000_000,
  urls: [delayedRoot], source: 'trusted-api' })
const delayedRoutes = new RouteCoordinator(clock, delayedSession, delayedSettings,
  new RestrictionStore(delayedStorage, () => now), new EvidenceStore(delayedStorage, () => now), delayedVault)
equal(delayedRoutes.apply(delayedRoot).decision.routeType, 'root-original',
  'delayed-lock fixture initially permits Native-on original')
delayedStorage.holdNextSettingsLock = true
const pendingNativeOff = delayedSettings.update({ considerNativeSources: false })
equal(delayedSettings.get().considerNativeSources, false,
  'turning Native off takes effect before storage lock callback completes')
equal(delayedRoutes.apply(delayedRoot).decision.routeType, 'catalog-generated',
  'pre-dispatch routing obeys pending Native-off update')
delayedStorage.remote('bilicdn.v2.settings', { ...delayedSettings.get(), considerNativeSources: true, updatedAt: now + 100 })
equal(delayedSettings.get().considerNativeSources, false,
  'remote Native-on update cannot reopen Native while a local OFF write is pending')
delayedStorage.releaseSettingsLock()
await pendingNativeOff
equal(delayedSettings.get().considerNativeSources, false, 'pending Native-off write completes with OFF state')
await delayedSettings.update({ considerNativeSources: true })
delayedStorage.holdNextSettingsLock = true
const pendingNativeReset = delayedSettings.reset()
equal(delayedSettings.get().considerNativeSources, false,
  'settings reset defaults Native use OFF before storage lock callback completes')
equal(delayedRoutes.apply(delayedRoot).decision.routeType, 'catalog-generated',
  'pre-dispatch routing obeys pending settings reset')
delayedStorage.releaseSettingsLock()
await pendingNativeReset
const reuseStorage = new FakeStorage(), reuseSettings = new SettingsStore(reuseStorage, () => now)
await reuseSettings.update({ considerNativeSources: true })
const reuseSession = new SessionStore(), reuseState = reuseSession.beginGeneration(false)
const reuseVault = new SignedRouteVault(); reuseVault.reset(reuseState.generation, reuseState.epoch)
const reuseRoutes = new RouteCoordinator(clock, reuseSession, reuseSettings,
  new RestrictionStore(reuseStorage, () => now), new EvidenceStore(reuseStorage, () => now), reuseVault)
const reusePlayurl = new PlayurlAdapter(reuseSession, reuseVault, reuseRoutes, reuseSettings)
const reusedPageRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/reuse/page.m4s?signature=page'
const reusedPagePayload = { data: { dash: { video: [{ id: 80, codecid: 13, height: 1080,
  bandwidth: 1_000_000, base_url: reusedPageRoot, backup_url: [] as string[] }], audio: [] } } }
reusePlayurl.transform(reusedPagePayload, 'page-hint')
equal(reusedPagePayload.data.dash.video[0]?.base_url, reusedPageRoot,
  'Native-on page hint initially preserves its original URL')
await reuseSettings.update({ considerNativeSources: false })
reuseRoutes.invalidateForUserSetting()
reusePlayurl.transform(reusedPagePayload, 'page-hint')
check(TRUSTED_CATALOG.includes(new URL(reusedPagePayload.data.dash.video[0]?.base_url ?? '').host as typeof TRUSTED_CATALOG[number]),
  'same-generation seen page hint is reprocessed to Catalog after Native switch turns off')
await reuseSettings.update({ considerNativeSources: true })
await reuseSettings.update({ considerNativeSources: false })
reusedPagePayload.data.dash.video[0]!.base_url = reusedPageRoot
reusePlayurl.transform(reusedPagePayload, 'page-hint')
check(TRUSTED_CATALOG.includes(new URL(reusedPagePayload.data.dash.video[0]?.base_url ?? '').host as typeof TRUSTED_CATALOG[number]),
  'OFF-to-ON-to-OFF transition without intermediate transform cannot reuse unsafe page-hint cache')
const mutatedPageRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/reuse/page-mutated.m4s?signature=changed'
reusedPagePayload.data.dash.video[0]!.base_url = mutatedPageRoot
reusePlayurl.transform(reusedPagePayload, 'page-hint')
check(TRUSTED_CATALOG.includes(new URL(reusedPagePayload.data.dash.video[0]?.base_url ?? '').host as typeof TRUSTED_CATALOG[number]),
  'mutated same-object page hint is re-sanitized while Native stays OFF')
equal(new URL(reusedPagePayload.data.dash.video[0]?.base_url ?? '').search, new URL(mutatedPageRoot).search,
  'same-object page hint mutation preserves its newly requested query during Catalog rewrite')
await reuseSettings.update({ considerNativeSources: true })
reuseRoutes.invalidateForUserSetting()
const reusedApiRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/reuse/api.m4s?signature=api'
const reusedApiPayload = { data: { dash: { video: [{ id: 64, codecid: 13, height: 720,
  bandwidth: 1_000_000, base_url: reusedApiRoot, backup_url: [] as string[] }], audio: [] } } }
reusePlayurl.transform(reusedApiPayload, 'trusted-api', 'reuse-api-response')
equal(reusedApiPayload.data.dash.video[0]?.base_url, reusedApiRoot,
  'Native-on trusted response initially preserves its original URL')
await reuseSettings.update({ considerNativeSources: false })
reuseRoutes.invalidateForUserSetting()
reusePlayurl.transform(reusedApiPayload, 'trusted-api', 'reuse-api-response')
check(TRUSTED_CATALOG.includes(new URL(reusedApiPayload.data.dash.video[0]?.base_url ?? '').host as typeof TRUSTED_CATALOG[number]),
  'same-generation response key is reprocessed to Catalog after Native switch turns off')
await reuseSettings.update({ considerNativeSources: true })
await reuseSettings.update({ considerNativeSources: false })
reusedApiPayload.data.dash.video[0]!.base_url = reusedApiRoot
reusePlayurl.transform(reusedApiPayload, 'trusted-api', 'reuse-api-response')
check(TRUSTED_CATALOG.includes(new URL(reusedApiPayload.data.dash.video[0]?.base_url ?? '').host as typeof TRUSTED_CATALOG[number]),
  'OFF-to-ON-to-OFF transition without intermediate transform cannot reuse unsafe responseKey cache')
const mutatedApiRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/reuse/api-mutated.m4s?signature=changed-api'
reusedApiPayload.data.dash.video[0]!.base_url = mutatedApiRoot
reusePlayurl.transform(reusedApiPayload, 'trusted-api', 'reuse-api-response')
check(TRUSTED_CATALOG.includes(new URL(reusedApiPayload.data.dash.video[0]?.base_url ?? '').host as typeof TRUSTED_CATALOG[number]),
  'mutated same-object trusted payload is re-sanitized despite an already-seen responseKey')
const epochReuseStorage = new FakeStorage(), epochReuseSettings = new SettingsStore(epochReuseStorage, () => now)
const epochReuseSession = new SessionStore(), epochReuseState = epochReuseSession.beginGeneration(false)
const epochReuseVault = new SignedRouteVault(); epochReuseVault.reset(epochReuseState.generation, epochReuseState.epoch)
const epochReuseRoutes = new RouteCoordinator(clock, epochReuseSession, epochReuseSettings,
  new RestrictionStore(epochReuseStorage, () => now), new EvidenceStore(epochReuseStorage, () => now), epochReuseVault)
const epochReuseAdapter = new PlayurlAdapter(epochReuseSession, epochReuseVault, epochReuseRoutes, epochReuseSettings)
const oldEpochRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/epoch-reuse/old/video.m4s?signature=old-epoch'
const newEpochRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/epoch-reuse/new/video.m4s?signature=new-epoch'
const oldEpochPayload = { data: { dash: { video: [{ id: 80, codecid: 13, height: 1080,
  bandwidth: 1_000_000, base_url: oldEpochRoot, backup_url: [] as string[] }], audio: [] } } }
check(epochReuseAdapter.transform(oldEpochPayload, 'trusted-api'), 'old trusted payload registers a representation')
const oldEpochRep = epochReuseVault.match(oldEpochRoot).context?.representation
check(oldEpochRep, 'old trusted payload has a vault identity before epoch reset')
const nextEpochState = epochReuseSession.beginEpoch()
epochReuseVault.reset(nextEpochState.generation, nextEpochState.epoch); epochReuseRoutes.resetEpoch()
const newEpochRep = epochReuseVault.register({ generation: nextEpochState.generation, epoch: nextEpochState.epoch,
  kind: 'video', key: 'new-epoch', height: 1080, codec: 'av1', bandwidth: 1_000_000,
  urls: [newEpochRoot], source: 'trusted-api' })
equal(newEpochRep, oldEpochRep, 'vault representation IDs are reused in a later epoch')
epochReuseAdapter.transform(oldEpochPayload, 'trusted-api')
const oldEpochOutput = oldEpochPayload.data.dash.video[0]?.base_url ?? ''
check(!oldEpochOutput.includes('new-epoch') && (oldEpochOutput === ''
  || (TRUSTED_CATALOG.includes(new URL(oldEpochOutput).host as typeof TRUSTED_CATALOG[number])
    && new URL(oldEpochOutput).pathname === new URL(oldEpochRoot).pathname)),
  'reused old trusted payload cannot inherit a new epoch representation root')
const liveVault = new SignedRouteVault(), state = session.beginGeneration(false)
liveVault.reset(state.generation, state.epoch)
const liveRep = liveVault.register({ generation: state.generation, epoch: state.epoch, kind: 'video', key: '80:av1', height: 1080,
  codec: 'av1', bandwidth: 3_000_000, urls: ['https://upos-sz-mirrorali.bilivideo.com/upgcxcode/c/d/2.m4s?k=1'], source: 'page-hint' })
check(liveRep, 'controller fixture representation exists')
const coordinator = new RouteCoordinator(clock, session, settings, restrictions, evidenceStore, liveVault)
const opaqueAudioUrl = 'https://upos-hz-mirrorakam.akamaized.net/opaque/audio-segment?signature=private'
const opaqueAudioRep = liveVault.register({ generation: state.generation, epoch: state.epoch, kind: 'audio', key: 'opaque-audio',
  height: 0, codec: 'other', bandwidth: 192_000, urls: [opaqueAudioUrl], source: 'trusted-api' })
check(opaqueAudioRep, 'trusted opaque audio URL enters observation-only vault')
equal(coordinator.recognizesMedia(opaqueAudioUrl), true, 'current-epoch opaque signed URL enters the media hook')
equal(coordinator.startupOptions(opaqueAudioUrl), null, 'opaque URL cannot start an active probe')
equal(coordinator.apply(opaqueAudioUrl).attributionStatus, 'weak', 'opaque URL cannot create health evidence')
await restrictions.add({ host: 'upos-hz-mirrorakam.akamaized.net', type: 'black', kind: 'all', reason: 'opaque-test', expireAt: now + 60_000 })
equal(coordinator.apply(opaqueAudioUrl).decision.action, 'block', 'opaque exact URL still obeys the blacklist')
equal(coordinator.inspectOriginal(opaqueAudioUrl).decision.action, 'block', 'non-GET opaque URL obeys the blacklist')
await restrictions.remove('upos-hz-mirrorakam.akamaized.net', 'black')
if (liveRep) {
  const plan = coordinator.plan(liveRep, { kind: 'video', requiredMbps: 7.5, highDemand: false }, 'startup')
  equal(plan.action, 'pass', 'cold startup preserves the legal original until preflight completes')
  const startupRoot = liveVault.rootUrl(liveRep) ?? ''
  const catalogChoice = coordinator.startupOptions(startupRoot)?.candidates.find(candidate => candidate.type === 'catalog-generated')
  check(catalogChoice, 'startup offers a Catalog challenger absent from playinfo')
  if (catalogChoice) coordinator.commitStartupChoice(startupRoot, catalogChoice, 'test-preflight')
  const applied = coordinator.apply(startupRoot)
  equal(applied.decision.action, 'rewrite', 'planned catalog decision is applied')
  check(applied.url?.includes(catalogChoice?.host ?? ''), 'applied URL uses the preflight winner')
  await coordinator.observe({ generation: state.generation, epoch: state.epoch, decisionId: applied.decision.id,
    representation: liveRep, kind: 'video', routeType: 'catalog-generated', originalHost: applied.sourceHost ?? '',
    targetHost: applied.decision.host ?? '', finalHost: applied.decision.host, streamKey: applied.streamKey,
    status: 403, bytes: 0, ttfbMs: 30, elapsedMs: 60, completedAt: now, outcome: 'failure' })
  const restored = coordinator.apply(applied.url ?? '')
  equal(restored.decision.reason, 'host-locked', '403 host-lock is remembered for the exact stream')
  equal(restored.url, liveVault.rootUrl(liveRep), 'host-lock restores exact root signed URL')
  await restrictions.add({ host: 'upos-sz-mirrorali.bilivideo.com', type: 'black', kind: 'all',
    reason: 'cold-start-test', expireAt: now + 60_000 })
  check(!coordinator.startupOptions(startupRoot)?.candidates.some(candidate => candidate.host === 'upos-sz-mirrorali.bilivideo.com'),
    'startup preflight never probes a blacklisted original host')
  const restrictedFallback = coordinator.apply(startupRoot)
  check(restrictedFallback.url !== startupRoot && restrictedFallback.decision.host !== 'upos-sz-mirrorali.bilivideo.com',
    'host-locked blacklisted original uses a different legal fallback')
  await restrictions.remove('upos-sz-mirrorali.bilivideo.com', 'black')
}
for (let index = 0; index < 40; index++) {
  const group = liveVault.register({ generation: state.generation, epoch: state.epoch, kind: 'video', key: `diagnostic:${index}`,
    height: 1080, codec: 'av1', bandwidth: 3_000_000,
    urls: [`https://upos-sz-mirrorali.bilivideo.com/upgcxcode/c/d/${index + 100}.m4s?k=1`], source: 'page-hint' })
  if (group) coordinator.plan(group, { kind: 'video', requiredMbps: 7.5, highDemand: false }, 'startup')
}
const routeReadModel = coordinator.snapshot() as { planCount: number; recentPlans: readonly unknown[] }
check(routeReadModel.planCount > 30, 'many quality groups still enter the route coordinator')
check(routeReadModel.recentPlans.length <= 4, 'diagnostic route snapshot bounds inactive plans')
check(![...storage.values.keys()].some(key => !key.startsWith('bilicdn.v2.')), 'stores only use v2 namespace')

const runtimeSession = new SessionStore(); runtimeSession.beginGeneration(false)
const passDecision: AppliedRouteDecision = { decision: { action: 'pass', id: decisionId('runtime-pass'), reason: 'test', routeType: 'root-original',
  host: 'upos-sz-mirrorali.bilivideo.com', ranking: [] }, url: 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/runtime.m4s', context: null, streamKey: 'runtime', sourceHost: 'upos-sz-mirrorali.bilivideo.com' }
const observations: TransportObservation[] = []
const routeStub = {
  requestStarted(): void {},
  isCatalogOnly(): boolean { return false },
  isBilibiliMedia(url: string): boolean { return /\.bilivideo\.com\/|\.akamaized\.net\//.test(url) },
  recognizesMedia(url: string): boolean { return parseMediaUrl(url)?.kind !== 'unknown' },
  inspectOriginal(url: string): AppliedRouteDecision { return this.apply(url) },
  apply(url: string): AppliedRouteDecision { return { ...passDecision, url } },
  async observe(observation: TransportObservation): Promise<void> { observations.push(observation) },
}
let transformed = 0
const playurlStub = { transform(): boolean { transformed++; return true } }
let disabled = false, blockHttpDns = true
const settingsStub = { get: () => ({ disabled, blockHttpDns, considerNativeSources: true }) }
let nativeFetchCalls = 0, cancelReason: unknown = null
let playurlFetchBody = JSON.stringify({ code: 0, data: { dash: { video: [], audio: [] } } })
let playurlFetchOverride: Response | null = null
const nativeFetchUrls: string[] = []
const nativeFetchMethods: string[] = []
const nativeFetchRedirects: RequestRedirect[] = []
const nativeFetchHeaders: (string | null)[] = []
let streamedRequestBody = ''
const nativeFetch = async (input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
  nativeFetchCalls++
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  nativeFetchUrls.push(url)
  nativeFetchMethods.push(input instanceof Request ? input.method : String(_init?.method ?? 'GET'))
  nativeFetchRedirects.push(input instanceof Request ? input.redirect : String(_init?.redirect ?? 'follow') as RequestRedirect)
  nativeFetchHeaders.push(input instanceof Request ? input.headers.get('x-bilicdn-test') : null)
  if (url.includes('/stream-body.m4s') && input instanceof Request) streamedRequestBody = await input.text()
  if (url.includes('/player/wbi/playurl')) return playurlFetchOverride ?? new Response(playurlFetchBody, { status: 200 })
  let emitted = false
  return new Response(new ReadableStream<Uint8Array>({
    pull(controller) { if (!emitted) { emitted = true; controller.enqueue(new Uint8Array(70 * 1024)) } },
    cancel(reason) { cancelReason = reason },
  }), { status: 206, headers: { 'content-type': 'video/mp4' } })
}

class FakeXhr extends EventTarget {
  method = ''; url = ''; readyState = 0; status = 200; responseURL = ''; responseType: XMLHttpRequestResponseType = ''
  finalResponseUrl: string | null = null
  rawResponseText: string | null = null
  holdAtLoading = false
  timeout = 0; withCredentials = false
  payload: unknown = { ok: true }; nativeSends = 0
  get response(): unknown { return this.payload }
  get responseText(): string { return this.rawResponseText ?? JSON.stringify(this.payload) }
  open(method: string, url: string | URL): void { this.method = method; this.url = String(url); this.responseURL = this.url; this.readyState = 1 }
  send(): void { this.nativeSends++; if (this.finalResponseUrl) this.responseURL = this.finalResponseUrl;
    this.readyState = this.holdAtLoading ? 3 : 4
    this.dispatchEvent(new Event('readystatechange'))
    if (!this.holdAtLoading) { this.dispatchEvent(new Event('load')); this.dispatchEvent(new Event('loadend')) } }
  abort(): void { this.dispatchEvent(new Event('abort')) }
  setRequestHeader(_name: string, _value: string): void {}
}

const originalWorker = function WorkerIdentity() { return undefined }
const fakeWindow = { fetch: nativeFetch, XMLHttpRequest: FakeXhr, Worker: originalWorker, navigator: globalThis.navigator }
Object.defineProperty(globalThis, 'unsafeWindow', { configurable: true, value: fakeWindow })
Object.defineProperty(globalThis, 'location', { configurable: true, value: new URL('https://www.bilibili.com/video/BVtest/') })
let skippedPreflightReason = ''
const measurementStub = { willGateStartup: (): boolean => false, prepareStartup: async (): Promise<void> => {},
  noteUnpreflighted(reason: string): void { skippedPreflightReason = reason } }
const transport = new TransportAdapter(runtimeSession, settingsStub as never, routeStub as never, playurlStub as never, measurementStub as never, () => now)
transport.install()
equal(transport.snapshot().hookState, 'installed', 'Fetch and XHR hook assignments are verified')
const mediaResponse = await fakeWindow.fetch(passDecision.url ?? '')
const firstIntercept = transport.snapshot().lastMediaRequest as { hookEntered: boolean; mediaRecognized: boolean; nativeCalled: boolean; responseObserved: boolean }
check(firstIntercept.hookEntered && firstIntercept.mediaRecognized && firstIntercept.nativeCalled && firstIntercept.responseObserved,
  'diagnostic stages distinguish hook entry, media recognition, native invocation and response')
const mediaReader = mediaResponse.body?.getReader()
check(mediaReader, 'fetch wrapper returns a readable body')
await mediaReader?.read()
await mediaReader?.cancel('caller-cancel')
equal(cancelReason, 'caller-cancel', 'fetch cancel reason reaches original reader')
equal(observations.at(-1)?.outcome, 'abort', 'cancel settles as abort once')
equal(observations.at(-1)?.finalHost, null, 'empty response URL never invents a response host')
const beforeHttpDns = nativeFetchCalls
const blockedDns = await fakeWindow.fetch('https://httpdns.bilivideo.com/resolve')
equal(blockedDns.status, 503, 'HTTPDNS manual block returns local response')
equal(nativeFetchCalls, beforeHttpDns, 'HTTPDNS block performs no native request')
disabled = true
await fakeWindow.fetch('https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/disabled.m4s')
equal(nativeFetchCalls, beforeHttpDns + 1, 'disabled mode passes site fetch through')
disabled = false
const gatedUrl = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/gated.m4s'
const gateControl: { release: () => void } = { release: () => undefined }
let gateReady = false
measurementStub.willGateStartup = () => true
measurementStub.prepareStartup = async () => { await new Promise<void>(resolve => { gateControl.release = resolve }); gateReady = true }
routeStub.apply = (url: string): AppliedRouteDecision => gateReady ? { ...passDecision,
  decision: { action: 'rewrite', id: decisionId('gated-rewrite'), reason: 'preflight', routeType: 'catalog-generated',
    host: TRUSTED_CATALOG[0], candidate: { type: 'catalog-generated', host: TRUSTED_CATALOG[0], kind: 'video', catalogIndex: 0 }, ranking: [] },
  url: url.replace('upos-sz-mirrorali.bilivideo.com', TRUSTED_CATALOG[0]) } : { ...passDecision, url }
const beforeGate = nativeFetchCalls
const gatedFetch = fakeWindow.fetch(gatedUrl)
equal(nativeFetchCalls, beforeGate, 'Fetch player request waits before native dispatch')
gateControl.release()
await gatedFetch
equal(new URL(nativeFetchUrls.at(-1) ?? '').host, TRUSTED_CATALOG[0], 'Fetch dispatch uses preflight winner')
gateReady = false
const mutableMediaUrl = new URL(gatedUrl)
const mutableInit: RequestInit = { method: 'GET' }
const beforeLifecycleGate = nativeFetchCalls
const lifecycleFetch = fakeWindow.fetch(mutableMediaUrl, mutableInit)
equal(nativeFetchCalls, beforeLifecycleGate, 'generation-switch Fetch waits at the same startup boundary')
mutableMediaUrl.hostname = 'upos-sz-mirrorcosov.bilivideo.com'
mutableInit.method = 'POST'
runtimeSession.beginGeneration(false)
gateControl.release()
await lifecycleFetch
equal(nativeFetchUrls.at(-1), gatedUrl, 'generation-switch Fetch sends the checked URL, not mutated input')
equal(nativeFetchMethods.at(-1), 'GET', 'generation-switch Fetch sends the checked method, not mutated init')
const originalInspect = routeStub.inspectOriginal
const staleForbiddenUrl = 'https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/a/b/stale.m4s'
routeStub.inspectOriginal = (url: string): AppliedRouteDecision => url === staleForbiddenUrl
  ? { ...passDecision, url: null, decision: { action: 'block', id: decisionId('stale-black'), reason: 'black',
    routeType: 'root-original', host: 'upos-sz-mirrorcosov.bilivideo.com', ranking: [] } }
  : { ...passDecision, url }
gateReady = false
const beforeStaleForbidden = nativeFetchCalls
const staleForbiddenFetch = fakeWindow.fetch(staleForbiddenUrl)
runtimeSession.beginGeneration(false)
gateControl.release()
await staleForbiddenFetch.then(() => { throw new Error('stale generation must still block restricted original') }, () => undefined)
equal(nativeFetchCalls, beforeStaleForbidden, 'stale generation cannot dispatch a restricted original media host')
routeStub.inspectOriginal = originalInspect
const requestInput = new Request(gatedUrl, { method: 'GET' })
measurementStub.willGateStartup = () => false
await fakeWindow.fetch(requestInput)
equal(new URL(nativeFetchUrls.at(-1) ?? '').host, TRUSTED_CATALOG[0], 'Fetch Request input dispatch uses the selected host')
const headerRequest = new Request(gatedUrl, { headers: { 'x-bilicdn-test': 'kept' } })
await fakeWindow.fetch(headerRequest)
equal(nativeFetchHeaders.at(-1), 'kept', 'rewritten Request preserves request headers')
await fakeWindow.fetch(new URL(gatedUrl))
equal(new URL(nativeFetchUrls.at(-1) ?? '').host, TRUSTED_CATALOG[0], 'URL object is normalized before rewrite')
measurementStub.willGateStartup = () => true
gateReady = false
const gatedXhr = new FakeXhr()
gatedXhr.open('GET', gatedUrl)
gatedXhr.send()
equal(gatedXhr.nativeSends, 0, 'async XHR send waits before native dispatch')
gateControl.release()
await new Promise(resolve => setTimeout(resolve, 0))
equal(gatedXhr.nativeSends, 1, 'async XHR sends exactly once after preflight')
equal(new URL(gatedXhr.url).host, TRUSTED_CATALOG[0], 'XHR dispatch uses preflight winner')
gateReady = false
const abortedXhr = new FakeXhr()
abortedXhr.open('GET', gatedUrl); abortedXhr.send(); abortedXhr.abort()
gateControl.release()
await new Promise(resolve => setTimeout(resolve, 0))
equal(abortedXhr.nativeSends, 0, 'XHR abort during preflight never dispatches the website request')
const finiteTimeoutXhr = new FakeXhr(); finiteTimeoutXhr.timeout = 5000
finiteTimeoutXhr.open('GET', gatedUrl); finiteTimeoutXhr.send()
equal(finiteTimeoutXhr.nativeSends, 1, 'explicit XHR timeout bypasses delay to preserve native timeout semantics')
equal(skippedPreflightReason, 'preflight-skipped:xhr-explicit-timeout', 'XHR timeout is labelled as skipped preflight, not skipped interception')
const forbiddenNonGetUrl = 'https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/a/b/forbidden.m4s'
routeStub.apply = (url: string): AppliedRouteDecision => ({ ...passDecision, url: url === forbiddenNonGetUrl ? null : url,
  decision: url === forbiddenNonGetUrl ? { action: 'block', id: decisionId('blocked-non-get'), reason: 'black',
    routeType: 'root-original', host: 'upos-sz-mirrorcosov.bilivideo.com', ranking: [] } : passDecision.decision })
const beforeForbidden = nativeFetchCalls
await fakeWindow.fetch(forbiddenNonGetUrl, { method: 'POST' }).then(() => { throw new Error('blacklisted POST Fetch must reject locally') }, () => undefined)
equal(nativeFetchCalls, beforeForbidden, 'blacklisted non-GET Fetch never reaches native fetch')
const forbiddenXhr = new FakeXhr(); forbiddenXhr.open('POST', forbiddenNonGetUrl); forbiddenXhr.send()
equal(forbiddenXhr.nativeSends, 0, 'blacklisted non-GET XHR never reaches native send')
equal((transport.snapshot().lastBlocked as { reason: string }).reason, 'black', 'local block diagnostics retain the reason without a URL')
const forbiddenRequest = new Request(forbiddenNonGetUrl, { method: 'POST' })
await fakeWindow.fetch(forbiddenRequest).then(() => { throw new Error('blacklisted Request object must reject locally') }, () => undefined)
equal(nativeFetchCalls, beforeForbidden, 'blacklisted Request object never reaches native fetch')
const spoofedRequest = new Request(forbiddenNonGetUrl, { method: 'POST' })
Object.defineProperty(spoofedRequest, 'href', { value: 'https://upos-sz-mirrorali.bilivideo.com/live-bvc/allowed.m4s' })
await fakeWindow.fetch(spoofedRequest).then(() => { throw new Error('forged Request.href must not bypass blocked POST') }, () => undefined)
equal(nativeFetchCalls, beforeForbidden, 'Fetch checks the Request internal URL, not a forged href expando')
measurementStub.willGateStartup = () => false
const converseRequest = new Request(passDecision.url ?? '')
Object.defineProperty(converseRequest, 'href', { value: forbiddenNonGetUrl })
await fakeWindow.fetch(converseRequest)
equal(nativeFetchUrls.at(-1), passDecision.url, 'forged forbidden href cannot block an allowed Request')
const beforeDnsRequest = nativeFetchCalls
const spoofedDns = new Request('https://httpdns.bilivideo.com/resolve')
Object.defineProperty(spoofedDns, 'href', { value: passDecision.url })
const spoofedDnsResponse = await fakeWindow.fetch(spoofedDns)
equal(spoofedDnsResponse.status, 503, 'forged Request.href cannot bypass HTTPDNS block')
equal(nativeFetchCalls, beforeDnsRequest, 'blocked HTTPDNS Request never reaches native fetch')
routeStub.inspectOriginal = (url: string): AppliedRouteDecision => ({ ...passDecision, url })
const overrideRequest = new Request(gatedUrl, { method: 'GET' })
await fakeWindow.fetch(overrideRequest, { method: 'POST' })
equal(nativeFetchMethods.at(-1), 'POST', 'init.method override is preserved for native Fetch')
equal(nativeFetchUrls.at(-1), gatedUrl, 'non-GET method override is not rewritten as a GET')
const streamBody = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode('stream-ok')); controller.close() } })
await fakeWindow.fetch(new Request('https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/stream-body.m4s',
  { method: 'POST', body: streamBody, duplex: 'half' } as RequestInit))
equal(streamedRequestBody, 'stream-ok', 'normalized POST Request preserves a streaming body')
measurementStub.willGateStartup = () => false
const xhr = new FakeXhr()
xhr.responseType = 'json'
xhr.payload = { code: 0, data: { dash: { video: [], audio: [] } } }
xhr.open('GET', 'https://api.bilibili.com/x/player/wbi/playurl')
xhr.send()
void xhr.response
equal(transformed, 1, 'XHR JSON playurl is transformed lazily once')
equal(fakeWindow.Worker, originalWorker, 'Worker constructor identity is untouched')
transport.dispose()
class UnpatchableXhr extends FakeXhr {}
Object.defineProperty(UnpatchableXhr.prototype, 'send', { value: FakeXhr.prototype.send, writable: false, configurable: true })
const partialWindow = { fetch: nativeFetch, XMLHttpRequest: UnpatchableXhr }
Object.defineProperty(globalThis, 'unsafeWindow', { configurable: true, value: partialWindow })
const originalPartialOpen = UnpatchableXhr.prototype.open
const partialTransport = new TransportAdapter(runtimeSession, settingsStub as never, routeStub as never, playurlStub as never,
  measurementStub as never, () => now)
partialTransport.install()
equal(partialTransport.snapshot().hookState, 'failed', 'partial hook installation is reported as failed')
equal(partialWindow.fetch, nativeFetch, 'partial XHR install failure restores fetch')
equal(UnpatchableXhr.prototype.open, originalPartialOpen, 'partial XHR install failure restores open')
Object.defineProperty(globalThis, 'unsafeWindow', { configurable: true, value: fakeWindow })

const recorder = new DiagnosticRecorder(() => now, () => false)
const healthyObservation: TransportObservation = { generation: generationId(1), epoch: epochId(1), decisionId: decisionId('aggregate'),
  representation: null, kind: 'video', routeType: 'catalog-generated', originalHost: 'a.example', targetHost: 'b.example', finalHost: 'b.example',
  status: 206, bytes: 100_000, ttfbMs: 20, elapsedMs: 100, completedAt: now, outcome: 'success', streamKey: 'aggregate' }
for (let index = 0; index < 1000; index++) recorder.record({ type: 'transport', at: now, observation: { ...healthyObservation, completedAt: now + index } })
const recorderSnapshot = recorder.snapshot() as { flow: readonly unknown[]; events: readonly unknown[] }
check(recorderSnapshot.flow.length <= 96, '1000 successes remain bounded aggregates')
equal(recorderSnapshot.events.length, 0, 'healthy requests do not create verbose events when disabled')
const failureEvent: DomainEvent = { type: 'transport', at: now + 2000, observation: { ...healthyObservation, completedAt: now + 2000,
  outcome: 'failure', failureKind: 'network', status: 0 } }
recorder.record(failureEvent)
check((recorder.snapshot() as { incident: unknown }).incident, 'verified failure freezes an incident timeline')
const report = JSON.parse(recorder.buildReport({ version: '2.0.0', session: session.get(), routes: routeReadModel,
  monitor: { watchdog: 'healthy', video: { currentTime: 90, bufferAheadSec: 70 } } })) as {
  current: { routes?: { planCount: number }; monitor?: { watchdog: string }; truncated?: boolean }; recorder: { truncated?: boolean }
}
equal(report.current.routes?.planCount, routeReadModel.planCount, 'incident report retains route state with many groups')
equal(report.current.monitor?.watchdog, 'healthy', 'incident report retains player state with many groups')
check(report.current.truncated !== true, 'capacity fallback never discards the complete current state')
const oversizedReport = JSON.parse(recorder.buildReport({ version: '2.0.0', session: session.get(),
  routes: { ...routeReadModel, plans: Array.from({ length: 128 }, () => 'p'.repeat(1000)),
    ranking: Array.from({ length: 128 }, () => 'r'.repeat(1000)) },
  monitor: { watchdog: 'healthy', video: { currentTime: 90, bufferAheadSec: 70 } } })) as {
  current: { routes?: { planCount: number }; monitor?: { watchdog: string }; truncated?: boolean };
  recorder: { incident?: { reason: string } | null; truncated?: boolean }
}
equal(oversizedReport.current.routes?.planCount, routeReadModel.planCount, 'oversized route read model retains bounded current summary')
equal(oversizedReport.current.monitor?.watchdog, 'healthy', 'oversized report keeps current playback state')
check(oversizedReport.recorder.incident?.reason.startsWith('transport:'), 'oversized report keeps incident cause')
check(((oversizedReport.recorder as { flow?: unknown[] }).flow?.length ?? 0) > 0, 'oversized report preserves successful transport summaries')

const trace = new DiagnosticRecorder(() => traceNow, () => false)
let traceNow = now
const traceRep = representationId('trace-rep'), traceHostA = TRUSTED_CATALOG[0], traceHostB = TRUSTED_CATALOG[1]
const traceIdentity = { generation: generationId(2), epoch: epochId(3), representation: traceRep, kind: 'video' as const,
  authorityRevision: 4 }
const traceDecision = (id: string, host: string): RouteDecision => ({ action: 'rewrite', id: decisionId(id), reason: 'proven',
  routeType: 'catalog-generated', host, candidate: { type: 'catalog-generated', host, kind: 'video', catalogIndex: 0 }, ranking: [] })
const traceSample = (time: number, buffer: number, frames: number, paused = false) => ({ at: traceNow,
  generation: traceIdentity.generation, epoch: traceIdentity.epoch, enabled: true, originalComparison: false,
  currentTimeSec: time, frames, playableBufferSec: buffer, paused, seeking: false, ended: false,
  readyState: 4, coreInitialized: true, watchdog: 'healthy' as const })
const attemptRows = () => (trace.snapshot() as { routeRecovery: { attempts: Array<{ stage: string; zeroByteAborts: number; noResponseAborts: number }> } }).routeRecovery.attempts
trace.recordPlayer(traceSample(100, 4, 100))
trace.record({ type: 'recovery', at: traceNow, action: { action: 'route-fallback', id: recoveryActionId('first'),
  kind: 'video', identity: traceIdentity, decision: traceDecision('first-decision', traceHostA) } })
trace.recordPlayer(traceSample(100, 4, 100))
traceNow += 1000; trace.recordPlayer(traceSample(101, 3, 125))
equal(attemptRows().at(-1)?.stage, 'progress-unconfirmed', 'old buffered playback does not verify a fallback')
const traceRequest = (id: string, decision: string, host: string) => ({ requestId: requestId(id), generation: traceIdentity.generation,
  epoch: traceIdentity.epoch, decisionId: decisionId(decision), representation: traceRep, authorityRevision: 4,
  kind: 'video' as const, attributionStatus: 'matched' as const, attributionSource: 'exact' as const,
  decisionStage: 'request' as const, routeType: 'catalog-generated' as const, originalHost: traceHostA,
  targetHost: host, sourceHost: traceHostA, playurlHostChanged: false, playurlOutput: null,
  urlChanged: false, hostChanged: true, startedAt: traceNow })
for (let index = 0; index < 11; index++) {
  const request = traceRequest(`abort-${index}`, 'first-decision', traceHostA)
  trace.record({ type: 'request-started', at: traceNow, request })
  trace.record({ type: 'transport-completed', at: traceNow, detached: false, observation: {
    ...healthyObservation, request, generation: traceIdentity.generation, epoch: traceIdentity.epoch,
    representation: traceRep, decisionId: request.decisionId, targetHost: traceHostA, finalHost: null,
    status: 0, bytes: 0, outcome: 'abort', completedAt: traceNow } })
}
equal(attemptRows().at(-1)?.zeroByteAborts, 11, 'abort wave is counted per fallback decision')
equal(attemptRows().at(-1)?.noResponseAborts, 11, 'pre-response abort wave is distinguished from timeout')
equal(attemptRows().at(-1)?.stage, 'progress-unconfirmed', 'aborts do not confirm or fail a route')
const timeoutRequest = traceRequest('timeout-after-aborts', 'first-decision', traceHostA)
trace.record({ type: 'request-started', at: traceNow, request: timeoutRequest })
trace.record({ type: 'transport-completed', at: traceNow, detached: false, observation: {
  ...healthyObservation, request: timeoutRequest, generation: traceIdentity.generation, epoch: traceIdentity.epoch,
  representation: traceRep, decisionId: timeoutRequest.decisionId, targetHost: traceHostA, finalHost: null,
  status: 0, bytes: 0, outcome: 'failure', failureKind: 'timeout', completedAt: traceNow } })
const timedOutAttempt = attemptRows().at(-1) as { aborts: number; failures: number; lastFailureKind: string } | undefined
equal(timedOutAttempt?.aborts, 11, 'timeout does not increase the abort count')
equal(timedOutAttempt?.failures, 1, 'timeout is a separate fallback failure')
equal(timedOutAttempt?.lastFailureKind, 'timeout', 'fallback preserves the timeout category')
const timedOutFlow = (trace.snapshot() as { flow: Array<{ aborts: number; failures: number; timeouts: number }> }).flow
equal(timedOutFlow.reduce((sum, row) => sum + row.aborts, 0), 11, 'flow summary counts only abort terminal events as aborts')
equal(timedOutFlow.reduce((sum, row) => sum + row.failures, 0), 1, 'flow summary retains the failed request')
equal(timedOutFlow.reduce((sum, row) => sum + row.timeouts, 0), 1, 'flow summary distinguishes timeout from abort')
trace.record({ type: 'recovery', at: traceNow, action: { action: 'route-fallback', id: recoveryActionId('second'),
  kind: 'video', identity: traceIdentity, decision: traceDecision('second-decision', traceHostB) } })
trace.recordPlayer(traceSample(101, 0.5, 125))
equal(attemptRows()[0]?.stage, 'superseded', 'new fallback supersedes unconfirmed old attempt')
const secondRequest = traceRequest('second-request', 'second-decision', traceHostB)
trace.record({ type: 'request-started', at: traceNow, request: secondRequest })
const secondSuccess = { ...healthyObservation, request: secondRequest, generation: traceIdentity.generation,
  epoch: traceIdentity.epoch, representation: traceRep, decisionId: secondRequest.decisionId,
  targetHost: traceHostB, finalHost: traceHostB, responseUrlMatchesRequest: true, completedAt: traceNow }
trace.record({ type: 'route-confirmed', at: traceNow, observation: { ...secondSuccess, bytes: 10_000 } })
equal(attemptRows().at(-1)?.stage, 'response-observed', 'direct nonempty 206 advances to network evidence')
traceNow += 1000; trace.recordPlayer(traceSample(101.7, 1, 132))
equal(attemptRows().at(-1)?.stage, 'response-observed', 'one player tick is insufficient')
traceNow += 1000; trace.recordPlayer(traceSample(102.2, 1, 156))
equal(attemptRows().at(-1)?.stage, 'playback-observed', 'two ticks beyond original buffer record playback evidence')
equal(assessDemandRatio(0.55), 'below-required', 'sub-demand route is labeled without changing selection')
equal(assessDemandRatio(1.2), 'below-headroom', 'partial headroom is labeled')
equal(assessDemandRatio(1.35), 'meets-headroom', 'sufficient headroom is labeled')
equal(assessDemandRatio(null), 'unknown', 'missing throughput is labeled unknown')
const invalidTransfers = [
  { name: 'wrong host', request: { targetHost: traceHostA } },
  { name: 'wrong decision', request: { decisionId: decisionId('unrelated') } },
  { name: 'stale epoch', request: { epoch: epochId(2) } },
  { name: 'stale authority', request: { authorityRevision: 3 } },
  { name: 'audio transfer', request: { kind: 'audio' as const } },
  { name: 'HTTP 200', observation: { status: 200 } },
  { name: 'empty 206', observation: { bytes: 0 } },
  { name: 'redirected response', observation: { finalHost: traceHostA } },
  { name: 'same-host redirect', observation: { responseUrlMatchesRequest: false } },
]
for (const invalid of invalidTransfers) {
  const fixture = new DiagnosticRecorder(() => traceNow, () => false)
  fixture.record({ type: 'recovery', at: traceNow, action: { action: 'route-fallback', id: recoveryActionId('invalid'),
    kind: 'video', identity: traceIdentity, decision: traceDecision('second-decision', traceHostB) } })
  fixture.recordPlayer(traceSample(10, 0, 1))
  const request = { ...traceRequest('invalid-request', 'second-decision', traceHostB), ...invalid.request }
  fixture.record({ type: 'request-started', at: traceNow, request })
  fixture.record({ type: 'route-confirmed', at: traceNow, observation: { ...secondSuccess, request,
    decisionId: request.decisionId, epoch: request.epoch, kind: request.kind,
    targetHost: request.targetHost, finalHost: request.targetHost, ...invalid.observation } })
  const stage = ((fixture.snapshot() as { routeRecovery: { attempts: Array<{ stage: string }> } }).routeRecovery.attempts.at(-1)?.stage)
  check(stage !== 'response-observed' && stage !== 'playback-observed', `${invalid.name} cannot confirm fallback transfer`)
}
const pausedTrace = new DiagnosticRecorder(() => traceNow, () => false)
pausedTrace.record({ type: 'recovery', at: traceNow, action: { action: 'route-fallback', id: recoveryActionId('paused'),
  kind: 'video', identity: traceIdentity, decision: traceDecision('second-decision', traceHostB) } })
pausedTrace.recordPlayer(traceSample(50, 0.5, 10))
const pausedRequest = traceRequest('paused-request', 'second-decision', traceHostB)
pausedTrace.record({ type: 'request-started', at: traceNow, request: pausedRequest })
pausedTrace.record({ type: 'route-confirmed', at: traceNow, observation: { ...secondSuccess, request: pausedRequest } })
traceNow += 1000; pausedTrace.recordPlayer(traceSample(51, 0, 12, true))
traceNow += 1000; pausedTrace.recordPlayer(traceSample(52, 0, 13, true))
equal(((pausedTrace.snapshot() as { routeRecovery: { attempts: Array<{ stage: string }> } }).routeRecovery.attempts.at(-1)?.stage),
  'response-observed', 'paused player cannot confirm fallback playback')
pausedTrace.recordPlayer({ ...traceSample(52, 0, 13), seeking: true })
equal(((pausedTrace.snapshot() as { routeRecovery: { attempts: Array<{ stage: string }> } }).routeRecovery.attempts.at(-1)?.stage),
  'interrupted', 'seek invalidates the old buffer boundary')
const mixedTrace = new DiagnosticRecorder(() => traceNow, () => false)
mixedTrace.record({ type: 'recovery', at: traceNow, action: { action: 'route-fallback', id: recoveryActionId('mixed'),
  kind: 'video', identity: traceIdentity, decision: traceDecision('second-decision', traceHostB) } })
mixedTrace.recordPlayer(traceSample(60, 0.2, 20))
mixedTrace.record({ type: 'route-confirmed', at: traceNow, observation: { ...secondSuccess,
  request: traceRequest('competing', 'other-decision', traceHostA), decisionId: decisionId('other-decision'),
  targetHost: traceHostA, finalHost: traceHostA } })
equal(((mixedTrace.snapshot() as { routeRecovery: { attempts: Array<{ stage: string }> } }).routeRecovery.attempts.at(-1)?.stage),
  'mixed-evidence', 'another successful video host makes playback attribution ambiguous')
const disabledTrace = new DiagnosticRecorder(() => traceNow, () => false)
disabledTrace.record({ type: 'recovery', at: traceNow, action: { action: 'route-fallback', id: recoveryActionId('disabled'),
  kind: 'video', identity: traceIdentity, decision: traceDecision('second-decision', traceHostB) } })
disabledTrace.record({ type: 'route-confirmed', at: traceNow, observation: secondSuccess }, false)
equal(((disabledTrace.snapshot() as { routeRecovery: { attempts: Array<{ stage: string }> } }).routeRecovery.attempts.at(-1)?.stage),
  'interrupted', 'comparison or disabled mode stops route attribution immediately')
const staleTrace = new DiagnosticRecorder(() => traceNow, () => false)
staleTrace.record({ type: 'recovery', at: traceNow, action: { action: 'route-fallback', id: recoveryActionId('stale'),
  kind: 'video', identity: traceIdentity, decision: traceDecision('second-decision', traceHostB) } })
staleTrace.record({ type: 'lifecycle', at: traceNow, generation: generationId(3), epoch: epochId(4), reason: 'spa' })
equal(((staleTrace.snapshot() as { routeRecovery: { attempts: Array<{ stage: string }> } }).routeRecovery.attempts.at(-1)?.stage),
  'interrupted', 'new generation closes stale fallback attribution')
trace.record({ type: 'core', at: traceNow, state: 'recovered', actionId: recoveryActionId('core'), source: 'route-failure' })
const traceReport = trace.buildReport({ url: 'https://example.invalid/video?token=secret' })
check(new TextEncoder().encode(traceReport).length <= 96 * 1024, 'fallback trace preserves report limit')
check(!traceReport.includes('token=secret'), 'fallback trace report excludes sensitive test query')
check(traceReport.includes('player-core-progress-only'), 'core progress is explicitly scoped below route confirmation')
const saturatedReport = JSON.parse(trace.buildReport({ version: '2.1.4', monitor: { watchdog: 'healthy' },
  evidence: Array.from({ length: 48 }, () => Array.from({ length: 48 }, () => 'x'.repeat(160))) })) as {
  current: { monitor?: { watchdog?: string } }; recorder: { routeRecovery?: { attempts?: unknown[] } }
}
check(new TextEncoder().encode(JSON.stringify(saturatedReport)).length <= 96 * 1024,
  'oversized current evidence still honors the absolute report limit')
equal(saturatedReport.current.monitor?.watchdog, 'healthy', 'size fallback retains current playback watchdog')
check((saturatedReport.recorder.routeRecovery?.attempts?.length ?? 0) >= 1, 'size fallback retains latest fallback assessment')

let recoveryNow = now, reloads = 0, seeks: number[] = [], rates: number[] = [], plays = 0
let playerSnapshot: VideoSnapshot = { available: true, paused: false, seeking: false, ended: false, readyState: 4,
  currentTime: 349.434, duration: 900, width: 1920, height: 1080, playbackRate: 2, effectiveRate: 2,
  bufferAheadSec: 30, playableBufferSec: 15, bufferedToEnd: false, frames: 1000, mediaError: false,
  coreInitialized: true, manifestHasVideo: true }
const recoveryPlayer: PlayerPort = {
  player: () => null, snapshot: () => playerSnapshot, syncManifest: () => true, reload: () => { reloads++ },
  currentTime: () => 349.434, playbackRate: () => 2, seek: value => { seeks.push(value) }, setRate: value => { rates.push(value) },
  play: () => { plays++; return Promise.resolve() }, reset: () => undefined,
}
const recovery = new RecoveryController(recoveryPlayer, () => recoveryNow)
recovery.tick(playerSnapshot)
recovery.armRouteFailure('route-failure', playerSnapshot)
playerSnapshot = { ...playerSnapshot, readyState: 0, width: 0, height: 0, currentTime: 349.434, frames: 1000, coreInitialized: false }
recoveryNow += 4000; recovery.tick(playerSnapshot)
equal(reloads, 1, 'dead core after committed route recovery reloads exactly once')
recoveryNow += 1000; recovery.tick(playerSnapshot)
equal(reloads, 1, 'dead core does not loop reload')
playerSnapshot = { ...playerSnapshot, readyState: 3, width: 1920, height: 1080, coreInitialized: true, frames: 1 }
recoveryNow += 1000; recovery.tick(playerSnapshot)
equal(seeks[0], 349.434, 'core recovery restores saved position')
equal(rates[0], 2, 'core recovery restores 2x')
equal(plays, 1, 'core recovery restores play intent once')

const startupSession = new SessionStore(), startupGeneration = startupSession.beginGeneration(false)
const startupVault = new SignedRouteVault(); startupVault.reset(startupGeneration.generation, startupGeneration.epoch)
const startupRoot = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/startup/video.m4s?k=1'
const startupRep = startupVault.register({ generation: startupGeneration.generation, epoch: startupGeneration.epoch,
  kind: 'video', key: 'startup:80', height: 1080, codec: 'av1', bandwidth: 3_000_000, urls: [startupRoot], source: 'trusted-api' })
check(startupRep, 'startup stall fixture has a representation')
let stallNow = now, startupReloads = 0
const stallEvidence = new EvidenceStore(new FakeStorage(), () => stallNow)
const stallRestrictions = new RestrictionStore(new FakeStorage(), () => stallNow)
const stallSettings = new SettingsStore(new FakeStorage(), () => stallNow)
await stallSettings.update({ considerNativeSources: true })
const stallRoutes = new RouteCoordinator({ now: () => stallNow }, startupSession, stallSettings,
  stallRestrictions, stallEvidence, startupVault)
if (startupRep) {
  const exactCatalogBackup = `https://${TRUSTED_CATALOG[0]}/upgcxcode/startup/video.m4s?k=backup-exact`
  startupVault.register({ generation: startupGeneration.generation, epoch: startupGeneration.epoch, kind: 'video',
    key: 'startup:80', height: 1080, codec: 'av1', bandwidth: 3_000_000, urls: [exactCatalogBackup], source: 'trusted-api' })
  const signedBackup = stallRoutes.startupOptions(startupRoot)?.candidates.find(candidate => candidate.host === TRUSTED_CATALOG[0])
  equal(signedBackup?.type, 'native-signed', 'Catalog-host signed backup competes as its own exact Native URL')
  equal(signedBackup?.url, exactCatalogBackup, 'signed backup retains its original query instead of synthesizing a URL')
  const incompatibleCatalog = stallRoutes.startupOptions(startupRoot)?.candidates.find(candidate => candidate.type === 'catalog-generated')
  if (incompatibleCatalog) {
    stallRoutes.noteStartupProbeResult(incompatibleCatalog, 403)
    check(!stallRoutes.startupOptions(startupRoot)?.candidates.some(candidate => candidate.host === incompatibleCatalog.host),
      'Catalog 403 excludes only this stream-host pairing from startup fallback')
    await stallEvidence.record(incompatibleCatalog.host, 'video', { requestId: 'prior-fast-stream', at: stallNow,
      source: 'transport', outcome: 'success', throughputMbps: 100, ttfbMs: 10, failureKind: null })
    const laterChoice = stallRoutes.plan(startupRep, { kind: 'video', requiredMbps: 8, highDemand: false }, 'new-epoch')
    check(laterChoice.host !== incompatibleCatalog.host,
      'this-stream 403 remains ineligible at a later route ranking boundary despite global speed evidence')
  }
  const unmatchedStartup = stallRoutes.apply('https://upos-sz-mirrorali.bilivideo.com/upgcxcode/startup/unmatched.m4s?k=1')
  equal(unmatchedStartup.decision.action, 'pass', 'unattributed first media request never blindly rewrites to first Catalog')
  const initial = stallRoutes.apply(startupRoot)
  const fallback = stallRoutes.recoverStartup(startupRep, { kind: 'video', requiredMbps: 8, highDemand: false },
    initial.decision.host ?? '', [])
  check(fallback && fallback.host !== initial.decision.host, 'unconfirmed startup stall commits a different legal host')
  equal(stallRoutes.apply(startupRoot).decision.host, fallback?.host, 'next startup request uses committed fallback')
  const firstFairProbe = stallRoutes.challenge(startupRep, { kind: 'video', requiredMbps: 8, highDemand: false }, false)
  const secondFairProbe = stallRoutes.challenge(startupRep, { kind: 'video', requiredMbps: 8, highDemand: false }, false)
  check(firstFairProbe && secondFairProbe && firstFairProbe.decision.host !== secondFairProbe.decision.host,
    'failed or unmeasured challenger is not selected again in the same round')
  if (firstFairProbe) {
    await stallRoutes.recordChallenge(firstFairProbe, 0, 100, 50, 'failure', null)
    equal(stallRoutes.snapshot().affinity, null, 'active probe failure does not change playback affinity')
  }
  const plannedFallback = (stallRoutes.snapshot().fallback as Record<string, { stage: string }>).video
  equal(plannedFallback?.stage, 'planned', 'fallback plan is not reported as a sent request')
  const nextFallback = stallRoutes.apply(startupRoot)
  check(nextFallback.url && nextFallback.decision.host === fallback?.host, 'fallback remains legal for the next request')
  const fallbackRequest = { requestId: requestId('fallback-next'), generation: startupGeneration.generation, epoch: startupGeneration.epoch,
    decisionId: nextFallback.decision.id, representation: startupRep, kind: 'video' as const, attributionStatus: 'matched' as const,
    attributionSource: 'exact' as const, decisionStage: 'request' as const, routeType: nextFallback.decision.routeType,
    originalHost: 'upos-sz-mirrorali.bilivideo.com', targetHost: fallback!.host!, sourceHost: 'upos-sz-mirrorali.bilivideo.com',
    playurlHostChanged: false, playurlOutput: null, urlChanged: true, hostChanged: true, startedAt: stallNow }
  stallRoutes.requestStarted({ ...fallbackRequest, requestId: requestId('unrelated-same-host'), decisionId: decisionId('unrelated') })
  equal((stallRoutes.snapshot().fallback as Record<string, { stage: string }>).video?.stage, 'planned',
    'a same-host request from another decision cannot impersonate the submitted fallback')
  stallRoutes.requestStarted(fallbackRequest)
  equal((stallRoutes.snapshot().fallback as Record<string, { stage: string }>).video?.stage, 'entered-hook',
    'fallback entering the hook is distinct from observed completion')
  await stallRoutes.observe({ request: fallbackRequest, generation: startupGeneration.generation, epoch: startupGeneration.epoch,
    decisionId: fallbackRequest.decisionId, representation: startupRep, kind: 'video', routeType: nextFallback.decision.routeType,
    originalHost: fallbackRequest.originalHost, targetHost: fallbackRequest.targetHost, finalHost: fallbackRequest.targetHost,
    streamKey: nextFallback.streamKey, status: 206, bytes: 100_000, ttfbMs: 20, elapsedMs: 250,
    completedAt: stallNow + 250, outcome: 'success' })
  equal((stallRoutes.snapshot().fallback as Record<string, { stage: string }>).video?.stage, 'response-observed',
    'fallback is observed only after its own transport response')
  for (const host of TRUSTED_CATALOG) await stallRestrictions.add({ host, type: 'black', kind: 'all', reason: 'no-route', expireAt: stallNow + 60_000 })
  const noAlternate = stallRoutes.recover(startupRep, { kind: 'video', requiredMbps: 8, highDemand: false },
    'verified-failure', fallback!.host)
  equal(noAlternate.action, 'block', 'all forbidden alternatives yield a blocked recovery decision')
  equal((stallRoutes.snapshot().fallback as Record<string, unknown>).video, undefined,
    'no legal fallback clears an older submitted fallback instead of presenting it as current')
  for (const host of TRUSTED_CATALOG) await stallRestrictions.remove(host, 'black')
}
const incompatibleSession = new SessionStore(), incompatibleState = incompatibleSession.beginGeneration(false)
const incompatibleVault = new SignedRouteVault(); incompatibleVault.reset(incompatibleState.generation, incompatibleState.epoch)
const incompatibleRoot = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/incompatible/segment.m4s?sig=clip'
const incompatibleRep = incompatibleVault.register({ generation: incompatibleState.generation, epoch: incompatibleState.epoch,
  kind: 'video', key: 'incompatible:80', height: 1080, codec: 'av1', bandwidth: 2_000_000,
  urls: [incompatibleRoot], source: 'trusted-api' })
check(incompatibleRep, 'Catalog incompatibility fixture has a representation')
const incompatibleRoutes = new RouteCoordinator(clock, incompatibleSession, new SettingsStore(new FakeStorage(), () => now),
  new RestrictionStore(new FakeStorage(), () => now), new EvidenceStore(new FakeStorage(), () => now), incompatibleVault)
if (incompatibleRep) {
  const badCatalog = incompatibleRoutes.startupOptions(incompatibleRoot)?.candidates.find(candidate => candidate.type === 'catalog-generated')
  check(badCatalog, 'a Catalog URL can be checked for this stream')
  incompatibleRoutes.commitStartupChoice(incompatibleRoot, badCatalog ?? null, 'startup-preflight')
  const failed = incompatibleRoutes.apply(incompatibleRoot)
  equal(failed.decision.host, badCatalog?.host, 'first media request uses the tested Catalog host')
  await incompatibleRoutes.observe({ generation: incompatibleState.generation, epoch: incompatibleState.epoch,
    decisionId: failed.decision.id, representation: incompatibleRep, kind: 'video', routeType: 'catalog-generated',
    originalHost: new URL(incompatibleRoot).host, targetHost: badCatalog!.host, finalHost: badCatalog!.host,
    streamKey: failed.streamKey, status: 403, bytes: 0, ttfbMs: 40, elapsedMs: 100,
    completedAt: now + 100, outcome: 'failure', responseUrlMatchesRequest: true })
  const after403 = incompatibleRoutes.apply(incompatibleRoot)
  check(after403.url && after403.decision.host !== badCatalog?.host,
    'a per-stream Catalog 403 permits the next request to use a different legal host')
  equal(after403.decision.host, (incompatibleRoutes.snapshot().fallback as Record<string, { plannedHost: string }>).video?.plannedHost,
    'Catalog incompatibility fallback plan is actually used by the next request')
}
const deadStartup: VideoSnapshot = { ...playerSnapshot, currentTime: 0, readyState: 0, width: 0, height: 0,
  frames: 0, bufferAheadSec: 0, playableBufferSec: 0, coreInitialized: false, paused: false }
let originalProbeDisabled = false, originalRecoveryTicks = 0, originalFallbacks = 0
const originalMonitor = new PlayerMonitor({ ...recoveryPlayer, snapshot: () => deadStartup, syncManifest: () => true } as PlayerPort,
  startupSession, { get: () => ({ disabled: false }) } as never, startupVault,
  { observePlaybackRate: () => undefined, playbackRate: () => 2, firstMediaAt: () => now,
    latestRequested: () => ({ targetHost: 'upos-sz-mirrorali.bilivideo.com', representation: startupRep,
      generation: startupGeneration.generation, epoch: startupGeneration.epoch }), pendingMediaCount: () => 0,
    recoverStartup: () => { originalFallbacks++; return null }, recover: () => { originalFallbacks++; return null },
    isOriginalComparison: () => true } as never,
  { tick: (input: { disabled: boolean }) => { originalProbeDisabled = input.disabled } } as never,
  { tick: () => { originalRecoveryTicks++ }, isRecovering: () => false } as never, () => true, () => now + 16_000)
for (let i = 0; i < 17; i++) originalMonitor.tick()
check(originalProbeDisabled && originalRecoveryTicks === 0 && originalFallbacks === 0,
  'original comparison mode neither probes nor initiates script route/core recovery')
const startupRecovery = new RecoveryController({ ...recoveryPlayer, snapshot: () => deadStartup, reload: () => { startupReloads++ },
  currentTime: () => 0, playbackRate: () => 1 } as PlayerPort, () => stallNow)
startupRecovery.armStartupFailure(deadStartup)
stallNow += 4000; startupRecovery.tick(deadStartup)
equal(startupReloads, 1, 'cold-start dead core reloads once despite no prior healthy frames')
stallNow += 4000; startupRecovery.tick(deadStartup)
equal(startupReloads, 1, 'startup recovery does not loop reload')
let softFallbacks = 0, startupArms = 0
const stallMonitor = new PlayerMonitor({ ...recoveryPlayer, snapshot: () => deadStartup, syncManifest: () => true } as PlayerPort,
  startupSession, new SettingsStore(new FakeStorage(), () => stallNow), startupVault,
  { firstMediaAt: () => now, latestRequested: () => ({ targetHost: 'upos-sz-mirrorali.bilivideo.com', representation: startupRep,
    generation: startupGeneration.generation, epoch: startupGeneration.epoch }),
    recoverStartup: () => { softFallbacks++; return { host: TRUSTED_CATALOG[0] } }, pendingMediaCount: () => 0,
    observePlaybackRate: () => undefined, isOriginalComparison: () => false } as never,
  { tick: () => undefined } as never,
  { tick: () => undefined, isRecovering: () => false, armStartupFailure: () => { startupArms++ } } as never,
  () => true, () => stallNow)
stallNow = now + 14_000; stallMonitor.tick()
equal(softFallbacks, 0, 'unconfirmed startup stall waits fifteen seconds')
stallNow = now + 15_000; stallMonitor.tick()
equal(softFallbacks, 1, 'unconfirmed startup stall submits one different route')
equal(startupArms, 1, 'unconfirmed startup stall arms bounded player recovery')
stallNow = now + 16_000; stallMonitor.tick()
equal(softFallbacks, 1, 'startup stall fallback is not repeated each tick')

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
  challenge: () => { challengeCalls++; return challengeApplied }, recordChallenge: async () => { challengeRecords++ } }
const challengeFetch = async (): Promise<Response> => { challengeFetches++; return directRangeResponse(challengeApplied.url ?? '', 70 * 1024) }
const measurement = new MeasurementController(challengeRoutes as never, new FakeStorage(), challengeFetch as typeof fetch, () => now)
const baseMeasurement = { generationActive: true, representation: representationId('video:test'), demand: { kind: 'video' as const, requiredMbps: 8, highDemand: false },
  stableProgressSec: 20, playableBufferSec: 29, visible: true, seeking: false, recovering: false, disabled: false }
measurement.tick(baseMeasurement)
equal(challengeCalls, 0, 'low buffer prevents challenger selection and network')
measurement.tick({ ...baseMeasurement, playableBufferSec: 30 })
await new Promise(resolve => setTimeout(resolve, 0))
equal(challengeCalls, 3, 'safe playback considers up to three fair challengers')
equal(challengeFetches, 3, 'each safe challenger performs one bounded request')
equal(challengeRecords, 3, 'each valid challenger updates evidence once')
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
  } }
const redirectChallenge = new MeasurementController(redirectChallengeRoutes as never, new FakeStorage(),
  redirectChallengeFetch as typeof fetch, () => now)
redirectChallenge.tick({ ...baseMeasurement, playableBufferSec: 30 })
await new Promise(resolve => setTimeout(resolve, 0))
equal(challengeRedirectSetting, 'error', 'healthy challenge forbids HTTP redirects')
equal(redirectedChallengeSamples, 0, 'redirected challenge cannot add host evidence')
const redirectedResponse = new Response(new Uint8Array(70 * 1024), { status: 206 })
Object.defineProperty(redirectedResponse, 'url', { value: 'https://upos-sz-mirrorhwov.bilivideo.com/upgcxcode/a/b/redirected.m4s' })
let mismatchedChallengeSuccesses = 0
const mismatchedChallenge = new MeasurementController({ isCatalogOnly: () => false, challenge: () => challengeApplied,
  recordChallenge: async (_route: unknown, _bytes: number, _elapsed: number, _ttfb: number | null, outcome: string) => {
    if (outcome === 'success') mismatchedChallengeSuccesses++
  } } as never, new FakeStorage(), (async () => redirectedResponse) as typeof fetch, () => now)
mismatchedChallenge.tick({ ...baseMeasurement, playableBufferSec: 30 })
await new Promise(resolve => setTimeout(resolve, 0))
equal(mismatchedChallengeSuccesses, 0, 'a mismatched response host cannot be credited to the challenged host')
const missingHostChallenge = new MeasurementController({ isCatalogOnly: () => false, challenge: () => challengeApplied,
  recordChallenge: async (_route: unknown, _bytes: number, _elapsed: number, _ttfb: number | null, outcome: string) => {
    if (outcome === 'success') mismatchedChallengeSuccesses++
  } } as never, new FakeStorage(), (async () => new Response(new Uint8Array(70 * 1024), { status: 206 })) as typeof fetch, () => now)
missingHostChallenge.tick({ ...baseMeasurement, playableBufferSec: 30 })
await new Promise(resolve => setTimeout(resolve, 0))
equal(mismatchedChallengeSuccesses, 0, 'a response with no verifiable host cannot create probe evidence')

const preflightOptions = stallRoutes.startupOptions(startupRoot)
check(preflightOptions && preflightOptions.candidates.length >= 2, 'preflight offers original and legal Catalog candidate')
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
  const preflight = new MeasurementController(preflightRoutes as never, new FakeStorage(), preflightFetch as typeof fetch, () => now)
  const abortedStartup = new AbortController(); abortedStartup.abort()
  let abortRejected = false
  try { await preflight.prepareStartup(startupRoot, abortedStartup.signal) } catch { abortRejected = true }
  equal(abortRejected, true, 'already-aborted player request rejects startup gate')
  equal(preflightFetches, 0, 'already-aborted player request starts no probe')
  await preflight.prepareStartup(startupRoot)
  equal(committedHost, preflightOptions.candidates.find(candidate => candidate.type === 'catalog-generated')?.host,
    'faster qualified Catalog wins bounded preflight')
  equal(preflightFetches, preflightOptions.candidates.length, 'cold window probes no more than three distinct routes')
  check(startupSamples > 0, 'valid full startup sample contributes to later evidence')
  await preflight.prepareStartup(startupRoot)
  equal(preflightFetches, preflightOptions.candidates.length, 'startup preflight runs only once per tab')
  const timeoutRoutes = { ...preflightRoutes, commitStartupChoice: (_url: string, candidate: { host: string } | null) => {
    committedHost = candidate?.host ?? null
    return candidate ? { host: candidate.host } : null
  } }
  let hangingProbes = 0
  const hangingFetch = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    hangingProbes++
    return await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    })
  }
  const timedPreflight = new MeasurementController(timeoutRoutes as never, new FakeStorage(), hangingFetch as typeof fetch, () => now)
  const gateStarted = Date.now()
  await timedPreflight.prepareStartup(startupRoot)
  check(Date.now() - gateStarted < 3500, 'cold preflight releases a hanging player request within the three-second window')
  equal(hangingProbes, preflightOptions.candidates.length, 'startup deadline bounds all parallel probes in one window')
  equal(committedHost, preflightOptions.candidates.find(candidate => candidate.original)?.host,
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
  const cachedPreflight = new MeasurementController({ ...preflightRoutes, startupOptions: () => cachedOptions } as never,
    new FakeStorage(), compatibilityFetch as typeof fetch, () => now)
  await cachedPreflight.prepareStartup(startupRoot)
  equal(ranges.get(cachedHost ?? ''), 'bytes=0-16383', 'cross-tab Catalog evidence requires only a 16 KiB current-URL compatibility range')
  equal(committedHost, cachedHost, 'compatible recent Catalog sample can win without redownloading a full throughput sample')
  let startupRedirectMode: RequestRedirect | undefined, redirectStartupSamples = 0
  const redirectStartup = new MeasurementController({ ...preflightRoutes,
    recordStartupSuccess: async () => { redirectStartupSamples++ } } as never, new FakeStorage(),
    (async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      startupRedirectMode = init?.redirect
      if (init?.redirect === 'error') throw new TypeError('redirect refused')
      return new Response(new Uint8Array(70 * 1024), { status: 206 })
    }) as typeof fetch, () => now)
  await redirectStartup.prepareStartup(startupRoot)
  equal(startupRedirectMode, 'error', 'startup probes forbid HTTP redirects')
  equal(redirectStartupSamples, 0, 'redirected startup probes create no throughput evidence')
  equal(committedHost, preflightOptions.candidates.find(candidate => candidate.original)?.host,
    'inconclusive redirected startup releases the legal original')
  const wrongHostStartup = new MeasurementController({ ...preflightRoutes,
    recordStartupSuccess: async () => { redirectStartupSamples++ } } as never, new FakeStorage(),
    (async (): Promise<Response> => {
      const response = new Response(new Uint8Array(70 * 1024), { status: 206 })
      Object.defineProperty(response, 'url', { value: 'https://upos-sz-mirrorhwov.bilivideo.com/upgcxcode/a/b/redirected.m4s' })
      return response
    }) as typeof fetch, () => now)
  await wrongHostStartup.prepareStartup(startupRoot)
  equal(redirectStartupSamples, 0, 'mismatched startup response host creates no throughput evidence')
}

// Observing playback must never override the user's speed selection.
let selectedRate = 1, rateWrites = 0, observedRate = 0
const ratePlayer: PlayerPort = { ...recoveryPlayer,
  snapshot: () => ({ ...playerSnapshot, playbackRate: selectedRate, effectiveRate: selectedRate, currentTime: 50 }),
  playbackRate: () => selectedRate, setRate: () => { rateWrites++ },
}
const rateMonitor = new PlayerMonitor(ratePlayer, session, settings, vault,
  { observePlaybackRate: (rate: number) => { observedRate = rate }, firstMediaAt: () => 0,
    isOriginalComparison: () => false } as never,
  { tick: () => undefined } as never, { tick: () => undefined, isRecovering: () => false } as never,
  () => true, () => now)
for (const rate of [1, 1.5, 0.75, 2, 1]) {
  selectedRate = rate
  rateMonitor.tick(); rateMonitor.tick()
  equal(observedRate, rate, `monitor observes selected ${rate}x`)
}
equal(rateWrites, 0, 'repeated monitoring never writes playback speed')

const adapterVideo = { isConnected: true, paused: false, seeking: false, ended: false, readyState: 4,
  currentTime: 10, duration: 100, videoWidth: 1920, videoHeight: 1080, playbackRate: 1,
  buffered: { length: 1, start: () => 0, end: () => 70 }, error: null,
} as unknown as HTMLVideoElement
class RateAdapter extends PlayerAdapter {
  override video(): HTMLVideoElement { return adapterVideo }
  override player(): Record<string, unknown> { return { getPlaybackRate: () => null } }
}
const rateAdapter = new RateAdapter({} as never)
for (const rate of [1, 1.5, 2, 0.75]) {
  adapterVideo.playbackRate = rate
  equal(rateAdapter.snapshot().effectiveRate, rate, `adapter uses real ${rate}x for demand`)
  equal(rateAdapter.snapshot().playableBufferSec, 60 / rate, `buffer duration respects ${rate}x`)
  equal(rateAdapter.playbackRate(), rate, 'unavailable player API falls back to video rate')
}
adapterVideo.playbackRate = Number.NaN
equal(rateAdapter.snapshot().effectiveRate, 2, '2x is only the unknown-rate planning fallback')

let savedRateRestored = 0, rateRecoveryNow = now
const customRatePlayer: PlayerPort = { ...recoveryPlayer, playbackRate: () => 1.5,
  setRate: value => { savedRateRestored = value } }
const customRateRecovery = new RecoveryController(customRatePlayer, () => rateRecoveryNow)
const healthyCustomRate = { ...playerSnapshot, playbackRate: 1.5, effectiveRate: 1.5 }
customRateRecovery.tick(healthyCustomRate)
customRateRecovery.armRouteFailure('route-failure', healthyCustomRate)
rateRecoveryNow += 4000
customRateRecovery.tick({ ...healthyCustomRate, readyState: 0, width: 0, height: 0, coreInitialized: false })
rateRecoveryNow += 1000
customRateRecovery.tick({ ...healthyCustomRate, frames: 2 })
equal(savedRateRestored, 1.5, 'core recovery restores the saved user rate, not forced 2x')

const outputStorage = new FakeStorage(), outputSession = new SessionStore()
const outputState = outputSession.beginGeneration(false), outputVault = new SignedRouteVault()
outputVault.reset(outputState.generation, outputState.epoch)
const outputSettings = new SettingsStore(outputStorage, () => now)
await outputSettings.update({ considerNativeSources: true })
const outputRestrictions = new RestrictionStore(outputStorage, () => now)
const outputEvidence = new EvidenceStore(outputStorage, () => now)
const outputRoutes = new RouteCoordinator(clock, outputSession, outputSettings, outputRestrictions, outputEvidence, outputVault)
const outputAdapter = new PlayurlAdapter(outputSession, outputVault, outputRoutes, outputSettings)
const forbiddenUrl = 'https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/test/output/1.m4s?k=1'
const outputItem = { id: 80, codecid: 13, height: 1080, bandwidth: 1_000_000, base_url: forbiddenUrl, backup_url: [forbiddenUrl] }
outputAdapter.transform({ data: { dash: { video: [outputItem], audio: [] } } })
check(![outputItem.base_url, ...outputItem.backup_url].some(url => url.includes('mirrorcosov')), 'forbidden original cannot remain in playurl primary or backup')
const exceptionalForbidden = `${forbiddenUrl}&os=mcdn`
equal(outputRoutes.apply(exceptionalForbidden).url, null, 'default-unavailable source cannot pass through PCDN guard')
equal(outputRoutes.apply(forbiddenUrl.replace('/upgcxcode/', '/live-bvc/')).url, null, 'default-unavailable live source is locally blocked without host replacement')
equal(outputRoutes.apply(forbiddenUrl.replace('/upgcxcode/', '/v1/resource/')).url, null, 'default-unavailable resource source is locally blocked')
equal(outputRoutes.apply('https://upos-sz-mirrorali.bilivideo.com/live-bvc/test/output/1.m4s?k=1').decision.action, 'pass', 'unrestricted live source remains untouched')
const exceptionalItem = { ...outputItem, base_url: exceptionalForbidden, backup_url: [exceptionalForbidden] }
outputAdapter.transform({ data: { dash: { video: [exceptionalItem], audio: [] } } })
equal(exceptionalItem.base_url, '', 'playurl cannot emit a default-unavailable PCDN-marked primary')
equal(exceptionalItem.backup_url.length, 0, 'playurl cannot emit a default-unavailable PCDN-marked backup')
const opaquePrimary = 'https://upos-hz-mirrorakam.akamaized.net/opaque/video-chunk?signature=private'
const opaqueBackup = 'https://upos-sz-mirrorali.bilivideo.com/opaque/video-chunk?signature=private'
const opaqueItem = { id: 81, codecid: 13, height: 1080, bandwidth: 1_000_000, base_url: opaquePrimary, backup_url: [opaqueBackup] }
outputAdapter.transform({ data: { dash: { video: [opaqueItem], audio: [] } } }, 'page-hint')
equal(opaqueItem.base_url, opaquePrimary, 'legal opaque signed primary is not emptied by playurl assembly')
const opaqueLineage = outputRoutes.apply(opaquePrimary)
equal(opaqueLineage.attributionStatus, 'weak', 'opaque signed output remains observation-only')
equal(opaqueLineage.playurlOutput?.outputHost, new URL(opaquePrimary).host,
  'an exact opaque output still links playurl delivery to the later segment request by host')
await outputRestrictions.add({ host: 'upos-hz-mirrorakam.akamaized.net', type: 'black', kind: 'all', reason: 'opaque-output', expireAt: now + 60_000 })
const opaqueRestricted = { ...opaqueItem, base_url: opaquePrimary, backup_url: [opaqueBackup] }
outputAdapter.transform({ data: { dash: { video: [opaqueRestricted], audio: [] } } }, 'page-hint')
equal(opaqueRestricted.base_url, opaqueBackup, 'opaque signed fallback uses its own exact URL when source is forbidden')
await outputRestrictions.remove('upos-hz-mirrorakam.akamaized.net', 'black')
const mixedItem = { id: 82, codecid: 13, height: 1080, bandwidth: 1_000_000,
  base_url: 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/test/mixed/82.m4s?signature=private',
  backup_url: ['https://upos-hz-mirrorakam.akamaized.net/opaque/mixed-82?signature=private'] }
outputAdapter.transform({ data: { dash: { video: [mixedItem], audio: [] } } }, 'page-hint')
check(mixedItem.backup_url.includes('https://upos-hz-mirrorakam.akamaized.net/opaque/mixed-82?signature=private'),
  'normal primary retains a legal exact opaque signed backup')
const alternateOutput = outputItem.backup_url.find(url => new URL(url).host !== new URL(outputItem.base_url).host)
check(alternateOutput, 'playurl includes a legal alternate backup')
const fallbackApplied = outputRoutes.apply(alternateOutput ?? '')
equal(fallbackApplied.url, alternateOutput, 'player requested output backup is not pulled back to primary')
equal(fallbackApplied.decision.reason, 'player-fallback', 'player backup has explicit coordinated decision')
equal(outputRoutes.apply(outputItem.base_url).url, alternateOutput, 'subsequent group requests retain adopted backup')

let coreClock = now, coreReloads = 0
const coreRecorder = new DiagnosticRecorder(() => coreClock, () => false)
const coreObserver = new RecoveryController({ ...recoveryPlayer, reload: () => { coreReloads++ } }, () => coreClock)
coreObserver.subscribe(event => coreRecorder.record(event))
coreObserver.tick({ ...playerSnapshot, paused: false, readyState: 4, width: 1920, height: 1080 })
const deadPaused = { ...playerSnapshot, paused: true, readyState: 0, width: 0, height: 0, frames: 0, coreInitialized: false }
for (let tick = 0; tick < 5; tick++) { coreClock += 1000; coreObserver.tick(deadPaused) }
check(coreRecorder.snapshot().incident, 'paused dead core automatically captures an incident')
equal(coreReloads, 0, 'dead paused core without play intent never reloads')
coreClock += 31_000; coreRecorder.tick()
const frozenCore = coreRecorder.snapshot().incident as { id: string; reason: string }
coreRecorder.mark()
equal((coreRecorder.snapshot().incident as { id: string }).id, frozenCore.id, 'late manual mark preserves frozen automatic incident')
for (let tick = 0; tick < 100; tick++) { coreClock += 1000; coreObserver.tick(deadPaused) }
equal((coreRecorder.snapshot().incident as { id: string }).id, frozenCore.id, 'continuous dead core does not replace its own incident')

const outputRep = outputVault.contextForUrl(outputItem.base_url)!.representation
const playurlLineage = (outputRoutes.apply(outputItem.base_url) as AppliedRouteDecision & {
  playurlOutput?: { originalHost: string; outputHost: string; source: string; decisionId: string; role: string }
}).playurlOutput
equal(playurlLineage?.originalHost, 'upos-sz-mirrorcosov.bilivideo.com', 'playurl lineage retains the original host without retaining a signed URL')
equal(playurlLineage?.outputHost, new URL(outputItem.base_url).host, 'playurl lineage names the host actually offered to the player')
equal(playurlLineage?.source, 'trusted-api', 'playurl lineage identifies trusted API output separately from page hints')
check(!!playurlLineage?.decisionId && playurlLineage.role === 'primary', 'playurl output links its plan to a primary request')
const alternateHost = new URL(alternateOutput!).host
for (const type of ['black', 'dead'] as const) {
  await outputRestrictions.add({ host: alternateHost, type, kind: 'all', reason: 'regression', expireAt: now + 60_000 })
  check(outputRoutes.apply(alternateOutput!).decision.host !== alternateHost, `${type} invalidates cached fallback on next request`)
  await outputSettings.update({ fixedHost: alternateHost })
  outputRoutes.invalidateForUserSetting()
  check(outputRoutes.apply(alternateOutput!).decision.host !== alternateHost, `fixed CDN cannot bypass ${type}`)
  const item = { ...outputItem, base_url: forbiddenUrl, backup_url: [alternateOutput!] }
  outputAdapter.transform({ data: { dash: { video: [item], audio: [] } } })
  check(![item.base_url, ...item.backup_url].some(url => url && new URL(url).host === alternateHost), `${type} filtered from all playurl outputs`)
  await outputRestrictions.remove(alternateHost, type)
}
await outputSettings.update({ fixedHost: null })
outputRoutes.invalidateForUserSetting()
outputRoutes.setOriginalComparison(true)
equal(outputSettings.get().fixedHost, null, 'per-tab original comparison does not overwrite saved routing settings')
const nativeControlUrl = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/control/clip.m4s?signature=private'
const nativeControlBackup = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/control/clip.m4s?signature=other'
const controlItem = { id: 240, codecid: 13, height: 1080, bandwidth: 1_000_000,
  base_url: nativeControlUrl, backup_url: [nativeControlBackup] }
outputAdapter.transform({ data: { dash: { video: [controlItem], audio: [] } } }, 'page-hint')
equal(controlItem.base_url, nativeControlUrl, 'original comparison mode does not rewrite a legal playurl primary')
equal(controlItem.backup_url[0], nativeControlBackup, 'original comparison mode preserves the exact legal signed backup')
equal(outputRoutes.apply(nativeControlUrl).url, nativeControlUrl, 'original comparison mode passes the exact segment URL')
equal(outputRoutes.startupOptions(nativeControlUrl), null, 'original comparison mode does not launch cold preflight')
equal(outputRoutes.challenge(outputVault.contextForUrl(nativeControlUrl)!.representation,
  { kind: 'video', requiredMbps: 3, highDemand: false }, false), null, 'original comparison mode starts no healthy probe')
await outputRestrictions.add({ host: 'upos-sz-mirrorali.bilivideo.com', type: 'black', kind: 'all', reason: 'original-mode', expireAt: now + 60_000 })
equal(outputRoutes.apply(nativeControlUrl).url, null, 'original comparison mode does not bypass a prohibited original host')
const blockedControlItem = { ...controlItem, base_url: nativeControlUrl, backup_url: [nativeControlBackup] }
outputAdapter.transform({ data: { dash: { video: [blockedControlItem], audio: [] } } }, 'page-hint')
equal(blockedControlItem.base_url, nativeControlBackup, 'original comparison promotes an exact legal signed backup when primary is forbidden')
const promotedRep = outputVault.contextForUrl(nativeControlBackup)!.representation
const promotedPlan = outputRoutes.snapshot().recentPlans as { id: string; host: string; action: string; reason: string }[]
check(promotedPlan.some(row => row.host === new URL(nativeControlBackup).host && row.action === 'pass' && row.reason === 'original-backup'),
  'the reported plan names the backup actually offered to the player, not the blocked primary')
equal(outputVault.outputRole(promotedRep, nativeControlBackup)?.decisionId,
  promotedPlan.find(row => row.host === new URL(nativeControlBackup).host && row.reason === 'original-backup')?.id,
  'promoted backup lineage points to its accurate route decision')
await outputRestrictions.remove('upos-sz-mirrorali.bilivideo.com', 'black')
outputRoutes.setOriginalComparison(false)
const ungroupedHost = TRUSTED_CATALOG[0]
const ungroupedUrl = `https://${ungroupedHost}/upgcxcode/test/ungrouped/1.m4s?k=1`
await outputRestrictions.add({ host: ungroupedHost, type: 'black', kind: 'audio', reason: 'ungrouped-audio', expireAt: now + 60_000 })
check(outputRoutes.apply(ungroupedUrl).decision.host !== ungroupedHost,
  'ungrouped media cannot use a host with an audio-only blacklist')
await outputRestrictions.remove(ungroupedHost, 'black')
const audioScopedUrl = `https://${ungroupedHost}/upgcxcode/test/audio/1.m4s?k=1`
const audioScopedRep = outputVault.register({ generation: outputState.generation, epoch: outputState.epoch, kind: 'audio',
  key: 'scope-audio', height: 0, codec: 'other', bandwidth: 128_000, urls: [audioScopedUrl], source: 'trusted-api' })
check(audioScopedRep, 'matched audio representation exists for blacklist coverage')
await outputRestrictions.add({ host: ungroupedHost, type: 'black', kind: 'all', reason: 'user', expireAt: now + 60_000 })
check(outputRoutes.apply(audioScopedUrl).decision.host !== ungroupedHost, 'user-wide blacklist excludes matched audio route')
equal(outputRoutes.apply(`${audioScopedUrl}&os=mcdn`).url, null, 'user-wide blacklist locally blocks an exceptional audio route')
await outputRestrictions.remove(ungroupedHost, 'black')
for (const type of ['black', 'dead'] as const) {
  await outputRestrictions.add({ host: ungroupedHost, type, kind: 'all', reason: 'exceptional', expireAt: now + 60_000 })
  equal(outputRoutes.apply(`${ungroupedUrl}&os=mcdn`).url, null, `${type} blocks PCDN-marked Catalog host`)
  await outputRestrictions.remove(ungroupedHost, type)
}
const unknownQuery = alternateOutput!.replace('k=1', 'k=unknown')
check(outputRoutes.apply(unknownQuery).decision.reason !== 'player-fallback', 'weak query match is not a backup capability')
await outputEvidence.record(TRUSTED_CATALOG[0], 'video', { requestId: 'fresh-challenger', at: now, source: 'transport', outcome: 'success', throughputMbps: 10, ttfbMs: 1, failureKind: null })
check(outputRoutes.challenge(outputRep, { kind: 'video', requiredMbps: 3, highDemand: false }, false)?.decision.host !== TRUSTED_CATALOG[1], 'challenger never selects default unavailable cosov')

const beforeGeneration = outputSession.get()
await outputRoutes.observe({ ...healthyObservation, generation: beforeGeneration.generation, epoch: beforeGeneration.epoch, representation: outputRep,
  originalHost: forbiddenUrl, targetHost: TRUSTED_CATALOG[2], finalHost: TRUSTED_CATALOG[2], completedAt: now, decisionId: fallbackApplied.decision.id })
await outputRoutes.observe({ ...healthyObservation, generation: beforeGeneration.generation, epoch: beforeGeneration.epoch, representation: outputRep,
  targetHost: TRUSTED_CATALOG[2], finalHost: null, outcome: 'abort', status: 0, completedAt: now + 1 })
equal(outputRoutes.latestVideoHost(), TRUSTED_CATALOG[2], 'latest abort does not erase last successful video host')
await outputRoutes.observe({ ...healthyObservation, generation: beforeGeneration.generation, epoch: beforeGeneration.epoch, representation: outputRep,
  targetHost: TRUSTED_CATALOG[3], finalHost: null, outcome: 'failure', failureKind: 'network', status: 0, completedAt: now + 2 })
check(outputEvidence.get(TRUSTED_CATALOG[3], 'video')?.circuitUntil! > now, 'no-response network failure still attributed to sent target')

await outputSettings.update({ catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map(host => [host, false])) })
outputRoutes.invalidateForUserSetting()
equal(outputRoutes.apply(forbiddenUrl).url, null, 'no legal alternative blocks forbidden source')
const noOutput = { ...outputItem, base_url: forbiddenUrl, backup_url: [forbiddenUrl] }
outputAdapter.transform({ data: { dash: { video: [noOutput], audio: [] } } })
equal(noOutput.base_url, '', 'blocked playurl does not leak original primary')
equal(noOutput.backup_url.length, 0, 'blocked playurl does not leak original backup')

const gapRecorder = new DiagnosticRecorder(() => coreClock, () => false)
const gapRecovery = new RecoveryController(recoveryPlayer, () => coreClock)
gapRecovery.subscribe(event => gapRecorder.record(event))
gapRecovery.tick(healthyCustomRate)
for (let i = 0; i < 5; i++) { coreClock += 10_000; gapRecovery.tick(deadPaused) }
equal(gapRecorder.snapshot().incident, null, 'background timer gaps do not count as continuous dead-core ticks')
gapRecovery.reset()
for (let i = 0; i < 5; i++) { coreClock += 1000; gapRecovery.tick(deadPaused) }
equal(gapRecorder.snapshot().incident, null, 'initial dead-looking startup without previous health is not an incident')

await outputSettings.update({ catalogOverrides: {}, fixedHost: null })
outputRoutes.invalidateForUserSetting()
const realAdapter = new TransportAdapter(outputSession, outputSettings, outputRoutes, outputAdapter, measurementStub as never, () => now)
realAdapter.install()
const tracedXhr = new FakeXhr(); tracedXhr.open('GET', outputItem.base_url); tracedXhr.send()
await Promise.resolve()
const tracedVideo = (outputRoutes.snapshot().latest as Record<string, Record<string, unknown>>).video
equal(tracedXhr.nativeSends, 1, 'playurl output is sent through the native XHR method exactly once')
equal(tracedVideo?.targetHost, new URL(tracedXhr.url).host, 'route report target matches the URL received by native XHR')
equal((tracedVideo?.playurlOutput as Record<string, unknown>)?.originalHost, 'upos-sz-mirrorcosov.bilivideo.com',
  'the completed native request retains the original playurl host lineage')
const actualXhr = new FakeXhr()
actualXhr.open('GET', forbiddenUrl)
check(!actualXhr.url.includes('mirrorcosov'), 'native XHR open receives rewritten legal host')
const initiallySentHost = new URL(actualXhr.url).host
await outputRestrictions.add({ host: initiallySentHost, type: 'black', kind: 'all', reason: 'before-send', expireAt: now + 60_000 })
actualXhr.send()
equal(actualXhr.nativeSends, 1, 'XHR sends one replacement request')
check(new URL(actualXhr.url).host !== initiallySentHost, 'restriction added after open is rechecked before native send')
await outputSettings.update({ catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map(host => [host, false])) })
const blockedXhr = new FakeXhr(); blockedXhr.open('GET', forbiddenUrl); blockedXhr.send()
equal(blockedXhr.nativeSends, 0, 'no-alternative XHR never sends forbidden native request')
const exceptionalXhr = new FakeXhr(); exceptionalXhr.open('GET', exceptionalForbidden); exceptionalXhr.send()
equal(exceptionalXhr.nativeSends, 0, 'XHR does not send default-unavailable PCDN-marked media')
const fetchCountBeforeBlock = nativeFetchCalls
let fetchBlocked = false
try { await fakeWindow.fetch(forbiddenUrl) } catch { fetchBlocked = true }
check(fetchBlocked, 'no-alternative Fetch rejects locally')
equal(nativeFetchCalls, fetchCountBeforeBlock, 'blocked Fetch sends no native request')
let exceptionalFetchBlocked = false
try { await fakeWindow.fetch(exceptionalForbidden) } catch { exceptionalFetchBlocked = true }
check(exceptionalFetchBlocked, 'Fetch does not send default-unavailable PCDN-marked media')
equal(nativeFetchCalls, fetchCountBeforeBlock, 'exceptional Fetch does not reach native transport')
await outputSettings.update({ disabled: true })
const enabledAfterOpen = new FakeXhr(); enabledAfterOpen.open('GET', forbiddenUrl)
await outputSettings.update({ disabled: false })
enabledAfterOpen.send()
equal(enabledAfterOpen.nativeSends, 0, 'XHR opened while disabled rechecks restriction when enabled before send')
await outputSettings.update({ disabled: true })
const disabledXhr = new FakeXhr(); disabledXhr.open('GET', forbiddenUrl); disabledXhr.send()
equal(disabledXhr.url, forbiddenUrl, 'disabled adapter preserves website original request')
equal(disabledXhr.nativeSends, 1, 'disabled adapter sends website request once')
realAdapter.dispose()

if (liveRep) {
  const root = liveVault.rootUrl(liveRep)!, lockedHost = new URL(root).host
  await restrictions.add({ host: lockedHost, type: 'dead', kind: 'all', reason: 'host-lock-test', expireAt: now + 60_000 })
  const deadRootFallback = coordinator.apply(root)
  check(deadRootFallback.url !== root && deadRootFallback.decision.host !== lockedHost,
    'host-lock never restores a dead root and may choose a legal alternative')
  const lockedPlan = coordinator.plan(liveRep, { kind: 'video', requiredMbps: 3, highDemand: false }, 'startup')
  check(coordinator.playerOutput(liveRep, root, lockedPlan, [root]).primary !== root,
    'host-locked dead root cannot leak through playurl output')
}

let intentClock = now, intentReloads = 0, activation = false
let intentVideo = { ...healthyCustomRate }
const intentTarget = { play: () => 'original-result' }
const originalIntentPlay = intentTarget.play
Object.defineProperty(fakeWindow, 'navigator', { configurable: true, value: { userActivation: { get isActive() { return activation } } } })
const intentRecovery = new RecoveryController({ ...recoveryPlayer, player: () => intentTarget, snapshot: () => intentVideo,
  reload: () => { intentReloads++ }, playbackRate: () => 1.5 }, () => intentClock)
intentRecovery.tick(intentVideo)
intentVideo = { ...deadPaused }; intentClock += 1000; intentRecovery.tick(intentVideo)
check(intentTarget.play !== originalIntentPlay, 'play observer installed on first paused tick, not thirty seconds later')
intentClock += 31_000
equal(intentTarget.play(), 'original-result', 'play observer preserves original return')
equal(intentRecovery.isRecovering(), false, 'untrusted play call never arms reload')
activation = true; intentTarget.play()
equal(intentRecovery.isRecovering(), true, 'trusted long-pause request arms intent while video stays paused')
for (let tick = 0; tick < 4; tick++) { intentClock += 1000; intentRecovery.tick(intentVideo) }
equal(intentReloads, 1, 'dead paused video with valid intent reloads once')
intentClock += 1000; intentRecovery.tick(intentVideo)
equal(intentReloads, 1, 'repeated dead ticks cannot loop reload')
intentRecovery.reset()
equal(intentTarget.play, originalIntentPlay, 'generation reset restores owned play method')

for (let i = 0; i < 1000; i++) coreRecorder.record({ type: 'transport', at: coreClock, observation: { ...healthyObservation, completedAt: coreClock } })
equal((coreRecorder.snapshot().incident as { id: string }).id, frozenCore.id, 'one thousand successes retain frozen core incident')
check(new TextEncoder().encode(JSON.stringify(coreRecorder.snapshot())).length <= 128 * 1024, 'recorder remains within 128 KiB')
check(new TextEncoder().encode(coreRecorder.buildReport({})).length <= 96 * 1024, 'report remains within 96 KiB')
check(!coreRecorder.buildReport({}).includes('token=secret'), 'incident report contains no test signed query')

await outputSettings.update({ disabled: false, catalogOverrides: {}, fixedHost: null })
outputRoutes.invalidateForUserSetting()
const nativeAudioUrl = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/test/output/audio.m4s?s=exact'
const audioItem = { id: 30280, base_url: nativeAudioUrl, backup_url: [], bandwidth: 100_000 }
outputAdapter.transform({ data: { dash: { video: [], audio: [audioItem] } } })
const beforeAudioAffinity = outputSession.get().affinity
const nativeAudioApplied = outputRoutes.apply(nativeAudioUrl)
equal(nativeAudioApplied.url, nativeAudioUrl, 'eligible Native backup uses its own full signed URL')
equal(nativeAudioApplied.decision.routeType, 'root-original', 'cold-start signed original remains unchanged before preflight')
equal(outputSession.get().affinity, beforeAudioAffinity, 'audio backup request does not alter video affinity')
const audioRep = nativeAudioApplied.context!.representation
outputVault.invalidate(audioRep, new URL(nativeAudioUrl).host)
check(outputRoutes.apply(nativeAudioUrl).url !== nativeAudioUrl, 'invalid Native cannot return through existing backup role')
const repeatAudio = { id: 30280, base_url: nativeAudioUrl, backup_url: [nativeAudioUrl], bandwidth: 100_000 }
outputAdapter.transform({ data: { dash: { video: [], audio: [repeatAudio] } } })
check(![repeatAudio.base_url, ...repeatAudio.backup_url].includes(nativeAudioUrl), 'invalid Native is removed from refreshed player outputs')
const nextGeneration = outputSession.beginGeneration(false)
outputVault.reset(nextGeneration.generation, nextGeneration.epoch); outputRoutes.resetEpoch()
equal(outputVault.outputRole(audioRep, nativeAudioUrl), null, 'generation reset discards output roles')
equal(outputRoutes.latestVideoHost(), null, 'generation reset drops old successful host')

// Post-release report: a second representation must not revive a startup plan
// after the active video has confirmed a working player fallback.
const transitionStorage = new FakeStorage(), transitionSession = new SessionStore()
const transitionState = transitionSession.beginGeneration(false), transitionVault = new SignedRouteVault()
transitionVault.reset(transitionState.generation, transitionState.epoch)
const transitionSettings = new SettingsStore(transitionStorage, () => now)
await transitionSettings.update({ considerNativeSources: true })
const transitionRestrictions = new RestrictionStore(transitionStorage, () => now)
const transitionRoutes = new RouteCoordinator(clock, transitionSession, transitionSettings,
  transitionRestrictions, new EvidenceStore(transitionStorage, () => now), transitionVault)
const transitionAdapter = new PlayurlAdapter(transitionSession, transitionVault, transitionRoutes, transitionSettings)
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
equal(transitionSession.get().affinity?.host, 'upos-hz-mirrorakam.akamaized.net', 'first group establishes observed Native affinity')
const nextTransitionApplied = transitionRoutes.apply(nextTransition.base_url)
equal(nextTransitionApplied.url, nextTransition.backup_url.find(url => url.includes('.akamaized.net')),
  'new quality uses its own exact Native URL instead of reviving its startup Catalog plan')
equal(transitionSession.get().affinity?.representation, transitionApplied.context!.representation,
  'planning another quality does not fabricate observed affinity')
const missingNativeItem = { id: 32, codecid: 13, height: 480, bandwidth: 500_000,
  base_url: 'https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/transition/480/1.m4s?k=1', backup_url: [] as string[] }
transitionAdapter.transform({ data: { dash: { video: [missingNativeItem], audio: [] } } })
const missingNativeApplied = transitionRoutes.apply(missingNativeItem.base_url)
check(missingNativeApplied.url && !missingNativeApplied.url.includes('.akamaized.net'),
  'quality missing an exact Native capability falls back without synthesizing Native URL')
const observedTransitionHost = new URL(nextTransitionApplied.url!).host
await transitionSettings.update({ fixedHost: TRUSTED_CATALOG[3] })
transitionRoutes.invalidateForUserSetting()
equal(transitionRoutes.apply(nextTransition.base_url).decision.host, TRUSTED_CATALOG[3],
  'explicit fixed CDN overrides inherited Native affinity')
check(observedTransitionHost !== TRUSTED_CATALOG[3], 'fixed-mode test uses a genuinely different host')
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
check(transitionRoutes.apply(restrictedTransition.base_url).decision.host !== observedTransitionHost,
  'first-use affinity inheritance cannot bypass a newly blacklisted Native host')

// Native source permission is a routing boundary, including URLs the player already received.
const catalogStorage = new FakeStorage(), catalogSettings = new SettingsStore(catalogStorage, () => now)
const catalogSession = new SessionStore(), catalogState = catalogSession.beginGeneration(false)
const catalogVault = new SignedRouteVault(); catalogVault.reset(catalogState.generation, catalogState.epoch)
const catalogRestrictions = new RestrictionStore(catalogStorage, () => now)
const catalogEvidence = new EvidenceStore(catalogStorage, () => now)
const catalogRoutes = new RouteCoordinator(clock, catalogSession, catalogSettings, catalogRestrictions, catalogEvidence, catalogVault)
const catalogAdapter = new PlayurlAdapter(catalogSession, catalogVault, catalogRoutes, catalogSettings)
const catalogVideoRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/catalog-only/video.m4s?signature=video-root'
const catalogVideoBackup = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/catalog-only/backup/video-alt.m4s?signature=video-backup&part=2'
const catalogAudioRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/catalog-only/audio.m4s?signature=audio-root'
const catalogVideo = { id: 80, codecid: 13, height: 1080, bandwidth: 2_000_000,
  base_url: catalogVideoRoot, backup_url: [catalogVideoBackup] }
const catalogAudio = { id: 30280, bandwidth: 192_000, base_url: catalogAudioRoot,
  backup_url: [] as string[] }
check(catalogAdapter.transform({ data: { dash: { video: [catalogVideo], audio: [catalogAudio] } } }),
  'Catalog-only fixture adopts trusted video and audio playurl')
const catalogVideoRep = catalogVault.contextForUrl(catalogVideoRoot)?.representation
const catalogAudioRep = catalogVault.contextForUrl(catalogAudioRoot)?.representation
check(catalogVideoRep && catalogAudioRep, 'Catalog-only fixture retains both original URLs privately for attribution')
const catalogDemand = { kind: 'video' as const, requiredMbps: 5, highDemand: false }
if (catalogVideoRep && catalogAudioRep) {
  const options = catalogRoutes.startupOptions(catalogVideoRoot)
  check(options && options.candidates.length > 0, 'Catalog-only startup has legal candidates')
  check(options?.candidates.every(candidate => candidate.type === 'catalog-generated' && !candidate.original),
    'Catalog-only startup never probes original or Native backup')
  const catalogPlan = catalogRoutes.plan(catalogVideoRep, catalogDemand, 'startup')
  equal(catalogPlan.routeType, 'catalog-generated', 'Catalog-only startup plan never chooses Native')
  equal(catalogRoutes.apply(catalogVideoRoot).decision.routeType, 'catalog-generated',
    'Catalog-only video request uses a Catalog decision')
  equal(catalogRoutes.apply(catalogAudioRoot).decision.routeType, 'catalog-generated',
    'Catalog-only audio request uses a Catalog decision')
  check([catalogVideo.base_url, ...catalogVideo.backup_url, catalogAudio.base_url, ...catalogAudio.backup_url]
    .every(url => !!url && TRUSTED_CATALOG.includes(new URL(url).host as typeof TRUSTED_CATALOG[number])),
  'Catalog-only player primary and backup URLs all use built-in Catalog hosts')
  check(![catalogVideo.base_url, ...catalogVideo.backup_url].includes(catalogVideoBackup),
    'Catalog-only player output does not reuse the exact signed Native backup')
  const signedBackupApplied = catalogRoutes.apply(catalogVideoBackup)
  check(signedBackupApplied.url && signedBackupApplied.decision.routeType === 'catalog-generated',
    'current-epoch signed backup is reselected through a Catalog decision')
  if (signedBackupApplied.url) {
    const requested = new URL(catalogVideoBackup), sent = new URL(signedBackupApplied.url)
    equal(`${sent.pathname}${sent.search}`, `${requested.pathname}${requested.search}`,
      'Catalog rewrite of signed backup preserves the requested backup path and query')
  }
  const deliveredCatalogBackup = catalogVideo.backup_url.find(url => new URL(url).host !== new URL(catalogVideo.base_url).host)
  check(deliveredCatalogBackup, 'Catalog-only playurl delivers a distinct Catalog backup')
  if (deliveredCatalogBackup) {
    const deliveredApplied = catalogRoutes.apply(deliveredCatalogBackup)
    equal(deliveredApplied.decision.routeType, 'catalog-generated', 'delivered Catalog backup retains Catalog provenance')
    equal(deliveredApplied.url, deliveredCatalogBackup,
      'delivered Catalog backup stays on the URL the player requested')
  }
  const challenger = catalogRoutes.challenge(catalogVideoRep, catalogDemand, true)
  equal(challenger?.decision.routeType, 'catalog-generated', 'prefer-Native healthy exploration remains Catalog-only')
  const failedCatalog = options?.candidates.find(candidate => candidate.type === 'catalog-generated')
  if (failedCatalog) {
    catalogRoutes.noteStartupProbeResult(failedCatalog, 403)
    check(!catalogRoutes.startupOptions(catalogVideoRoot)?.candidates.some(candidate => candidate.host === failedCatalog.host),
      'Catalog 403 removes that stream-host pairing from Catalog-only preflight')
    check(catalogRoutes.plan(catalogVideoRep, catalogDemand, 'new-epoch').host !== failedCatalog.host,
      'Catalog-only ranking does not revive a Catalog 403 host')
  }
}
const opaqueCatalogUrl = 'https://upos-hz-mirrorakam.akamaized.net/opaque/catalog-only-audio?signature=opaque'
const opaqueCatalogItem = { id: 30281, bandwidth: 192_000, base_url: opaqueCatalogUrl, backup_url: [] as string[] }
catalogAdapter.transform({ data: { dash: { video: [], audio: [opaqueCatalogItem] } } }, 'page-hint')
equal(opaqueCatalogItem.base_url, '', 'opaque signed B station audio is removed from Catalog-only player output')
equal(catalogRoutes.apply(opaqueCatalogUrl).decision.reason, 'catalog-unreplaceable',
  'opaque signed B station audio blocks rather than passing its Native URL')
equal(catalogRoutes.inspectOriginal(catalogVideoRoot).decision.reason, 'catalog-only-non-get',
  'recognized non-GET B station media cannot pass its Native URL')
equal(catalogRoutes.apply('https://upos-hz-mirrorakam.akamaized.net/live-bvc/catalog-only.m4s').decision.reason,
  'catalog-unreplaceable', 'non-replaceable B station media cannot pass its Native URL')
equal(catalogRoutes.apply('https://cdn.example.net/unrelated/media.bin').decision.action, 'pass',
  'unattributed third-party media keeps its original route')
await catalogSettings.update({ fixedHost: TRUSTED_CATALOG[3] })
catalogRoutes.invalidateForUserSetting()
equal(catalogRoutes.apply(catalogVideoRoot).decision.host, TRUSTED_CATALOG[3],
  'Catalog-only fixed host selects the requested legal Catalog node')
await catalogSettings.update({ fixedHost: null, catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map(host => [host, false])) })
catalogRoutes.invalidateForUserSetting()
equal(catalogRoutes.apply(catalogVideoRoot).decision.reason, 'catalog-unavailable',
  'no legal Catalog candidate blocks the original media request')
if (catalogVideoRep) equal(catalogRoutes.challenge(catalogVideoRep, catalogDemand, true), null,
  'no legal Catalog candidate starts no healthy probe')
const noCatalogOutput = { id: 80, codecid: 13, height: 1080, bandwidth: 2_000_000,
  base_url: catalogVideoRoot, backup_url: [catalogVideoBackup] }
catalogAdapter.transform({ data: { dash: { video: [noCatalogOutput], audio: [] } } })
equal(noCatalogOutput.base_url, '', 'no legal Catalog candidate emits no player primary')
equal(noCatalogOutput.backup_url.length, 0, 'no legal Catalog candidate emits no player backups')
catalogRoutes.setOriginalComparison(true)
equal(catalogRoutes.apply(catalogVideoRoot).url, catalogVideoRoot,
  'per-tab original comparison overrides saved Catalog-only mode')
catalogRoutes.setOriginalComparison(false)
await catalogSettings.update({ considerNativeSources: true, catalogOverrides: {} })
catalogRoutes.invalidateForUserSetting()
if (catalogVideoRep) {
  const legacyPlan = catalogRoutes.plan(catalogVideoRep, catalogDemand, 'startup')
  equal(legacyPlan.routeType, 'root-original', 'enabling Native sources preserves cold-start original route')
  const nativeStartup = catalogRoutes.startupOptions(catalogVideoRoot)?.candidates.find(candidate => candidate.original)
  check(nativeStartup, 'enabled Native mode includes the original in preflight')
  const enabledOutput = catalogRoutes.playerOutput(catalogVideoRep, catalogVideoRoot, legacyPlan,
    [catalogVideoRoot, catalogVideoBackup])
  equal(enabledOutput.primary, catalogVideoRoot, 'enabled Native mode may offer the exact original primary')
  check(enabledOutput.backups.includes(catalogVideoBackup), 'enabled Native mode may offer an exact Native backup')
  await catalogSettings.update({ considerNativeSources: false })
  catalogRoutes.invalidateForUserSetting()
  equal(catalogRoutes.commitStartupChoice(catalogVideoRoot, nativeStartup ?? null, 'late-preflight'), null,
    'late Native startup result cannot commit after switch to Catalog-only')
  if (nativeStartup) {
    await catalogRoutes.recordStartupSuccess(nativeStartup, 70 * 1024, 100, 10)
    equal(catalogEvidence.get(nativeStartup.host, 'video'), null,
      'late Native preflight cannot add new health evidence after switch')
  }
  equal(catalogRoutes.apply(catalogVideoBackup).decision.routeType, 'catalog-generated',
    'old player Native backup is rechecked as a Catalog decision after switch')
  equal(catalogSession.get().affinity, null, 'Native permission switch invalidates route affinity')
}

const overlapStorage = new FakeStorage(), overlapSession = new SessionStore()
const overlapState = overlapSession.beginGeneration(false), overlapVault = new SignedRouteVault()
overlapVault.reset(overlapState.generation, overlapState.epoch)
const overlapRoot = `https://${TRUSTED_CATALOG[0]}/upgcxcode/catalog-overlap/video.m4s?signature=same-url`
const overlapRep = overlapVault.register({ generation: overlapState.generation, epoch: overlapState.epoch,
  kind: 'video', key: 'overlap', height: 1080, codec: 'av1', bandwidth: 1_000_000,
  urls: [overlapRoot], source: 'trusted-api' })
const overlapRoutes = new RouteCoordinator(clock, overlapSession, new SettingsStore(overlapStorage, () => now),
  new RestrictionStore(overlapStorage, () => now), new EvidenceStore(overlapStorage, () => now), overlapVault)
if (overlapRep) {
  const sameUrlCatalog = overlapRoutes.apply(overlapRoot)
  equal(sameUrlCatalog.url, overlapRoot, 'Catalog decision may yield the exact same URL as the original')
  equal(sameUrlCatalog.decision.routeType, 'catalog-generated',
    'same-host overlap is authorized by Catalog provenance, not Native provenance')
  await overlapRoutes.observe({ generation: overlapState.generation, epoch: overlapState.epoch,
    decisionId: sameUrlCatalog.decision.id, representation: overlapRep, kind: 'video', routeType: 'catalog-generated',
    originalHost: new URL(overlapRoot).host, targetHost: sameUrlCatalog.decision.host ?? '',
    finalHost: sameUrlCatalog.decision.host, responseUrlMatchesRequest: true,
    streamKey: sameUrlCatalog.streamKey, status: 403, bytes: 0, ttfbMs: 20, elapsedMs: 100,
    completedAt: now + 1, outcome: 'failure' })
  const afterOverlap403 = overlapRoutes.apply(overlapRoot)
  check(afterOverlap403.decision.routeType === 'catalog-generated'
    && afterOverlap403.decision.host !== sameUrlCatalog.decision.host,
  'Catalog 403 invalidates stream-host pairing even when original host equals Catalog target')
}

const backup403Storage = new FakeStorage(), backup403Session = new SessionStore()
const backup403State = backup403Session.beginGeneration(false), backup403Vault = new SignedRouteVault()
backup403Vault.reset(backup403State.generation, backup403State.epoch)
const backup403Root = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/backup-403/root.m4s?signature=root'
const backup403Url = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/backup-403/other.m4s?signature=backup'
const backup403Rep = backup403Vault.register({ generation: backup403State.generation, epoch: backup403State.epoch,
  kind: 'video', key: 'backup-403', height: 1080, codec: 'av1', bandwidth: 1_000_000,
  urls: [backup403Root, backup403Url], source: 'trusted-api' })
check(backup403Rep, 'known backup 403 fixture has a current-epoch representation')
const backup403Routes = new RouteCoordinator(clock, backup403Session, new SettingsStore(backup403Storage, () => now),
  new RestrictionStore(backup403Storage, () => now), new EvidenceStore(backup403Storage, () => now), backup403Vault)
const backup403First = backup403Routes.apply(backup403Url)
equal(backup403First.decision.routeType, 'catalog-generated', 'known signed backup initially selects Catalog')
await backup403Routes.observe({ generation: backup403State.generation, epoch: backup403State.epoch,
  decisionId: backup403First.decision.id, representation: backup403Rep, kind: 'video', routeType: 'catalog-generated',
  originalHost: new URL(backup403Url).host, targetHost: backup403First.decision.host ?? '',
  finalHost: backup403First.decision.host, responseUrlMatchesRequest: true,
  streamKey: backup403First.streamKey, status: 403, bytes: 0, ttfbMs: 20, elapsedMs: 100,
  completedAt: now + 2, outcome: 'failure' })
const backup403Next = backup403Routes.apply(backup403Url)
check(backup403Next.decision.routeType === 'catalog-generated'
  && backup403Next.decision.host !== backup403First.decision.host,
  'known backup request avoids a Catalog host after its own stream gets 403')

const unmatched403Storage = new FakeStorage(), unmatched403Session = new SessionStore()
unmatched403Session.beginGeneration(false)
const unmatched403Vault = new SignedRouteVault()
unmatched403Vault.reset(unmatched403Session.get().generation, unmatched403Session.get().epoch)
const unmatched403Routes = new RouteCoordinator(clock, unmatched403Session, new SettingsStore(unmatched403Storage, () => now),
  new RestrictionStore(unmatched403Storage, () => now), new EvidenceStore(unmatched403Storage, () => now), unmatched403Vault)
const unmatched403Url = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/unmatched-403/video.m4s?signature=unmatched'
const unmatched403First = unmatched403Routes.apply(unmatched403Url)
equal(unmatched403First.decision.routeType, 'catalog-generated', 'unattributed B station stream initially selects Catalog')
await unmatched403Routes.observe({ generation: unmatched403Session.get().generation, epoch: unmatched403Session.get().epoch,
  decisionId: unmatched403First.decision.id, representation: null, kind: 'video', routeType: 'catalog-generated',
  originalHost: new URL(unmatched403Url).host, targetHost: unmatched403First.decision.host ?? '',
  finalHost: unmatched403First.decision.host, responseUrlMatchesRequest: true,
  streamKey: unmatched403First.streamKey, status: 403, bytes: 0, ttfbMs: 20, elapsedMs: 100,
  completedAt: now + 3, outcome: 'failure' })
const unmatched403Next = unmatched403Routes.apply(unmatched403Url)
check(unmatched403Next.decision.routeType === 'catalog-generated'
  && unmatched403Next.decision.host !== unmatched403First.decision.host,
  'unattributed B station stream avoids a Catalog host after its own 403')

const redirectedStorage = new FakeStorage(), redirectedSession = new SessionStore()
const redirectedState = redirectedSession.beginGeneration(false), redirectedVault = new SignedRouteVault()
redirectedVault.reset(redirectedState.generation, redirectedState.epoch)
const redirectedRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/redirected/video.m4s?signature=source'
const redirectedRep = redirectedVault.register({ generation: redirectedState.generation, epoch: redirectedState.epoch,
  kind: 'video', key: 'redirected', height: 1080, codec: 'av1', bandwidth: 1_000_000,
  urls: [redirectedRoot], source: 'trusted-api' })
check(redirectedRep, 'redirected XHR fixture has trusted representation')
const redirectedEvidence = new EvidenceStore(redirectedStorage, () => now)
const redirectedRoutes = new RouteCoordinator(clock, redirectedSession, new SettingsStore(redirectedStorage, () => now),
  new RestrictionStore(redirectedStorage, () => now), redirectedEvidence, redirectedVault)
const redirectedFirst = redirectedRoutes.apply(redirectedRoot)
equal(redirectedFirst.decision.routeType, 'catalog-generated', 'XHR redirect fixture initially selects Catalog')
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
equal(redirectedEvidence.get(new URL(redirectedRoot).host, 'video'), null,
  'XHR redirected to Native host stays detached from successful health evidence')
equal(redirectedSession.get().affinity, null, 'XHR redirected to Native host cannot confirm playback affinity')
const redirectedNext = redirectedRoutes.apply(redirectedRoot)
check(redirectedNext.decision.routeType === 'catalog-generated'
  && redirectedNext.decision.host !== redirectedFirst.decision.host,
  'XHR redirect away from Catalog invalidates that Catalog host for the same stream')

const aliasStorage = new FakeStorage(), aliasSession = new SessionStore()
const aliasState = aliasSession.beginGeneration(false), aliasVault = new SignedRouteVault()
aliasVault.reset(aliasState.generation, aliasState.epoch)
const aliasSettings = new SettingsStore(aliasStorage, () => now)
const aliasRoutes = new RouteCoordinator(clock, aliasSession, aliasSettings,
  new RestrictionStore(aliasStorage, () => now), new EvidenceStore(aliasStorage, () => now), aliasVault)
const aliasAdapter = new PlayurlAdapter(aliasSession, aliasVault, aliasRoutes, aliasSettings)
const aliasRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/aliases/primary.m4s?signature=primary'
const aliasBackup = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/aliases/backup.m4s?signature=backup'
const aliasItem = { id: 90, codecid: 13, height: 1080, bandwidth: 1_000_000,
  baseUrl: aliasRoot, base_url: aliasRoot, backupUrl: [aliasBackup], backup_url: [aliasBackup] }
check(aliasAdapter.transform({ data: { dash: { video: [aliasItem], audio: [] } } }),
  'playurl with both field spellings is transformed')
equal(aliasItem.baseUrl, aliasItem.base_url,
  'Catalog-only playurl rewrites both primary field spellings to the same URL')
equal(JSON.stringify(aliasItem.backupUrl), JSON.stringify(aliasItem.backup_url),
  'Catalog-only playurl rewrites both backup field spellings to the same URLs')
check([aliasItem.baseUrl, aliasItem.base_url, ...aliasItem.backupUrl, ...aliasItem.backup_url]
  .every(url => !!url && TRUSTED_CATALOG.includes(new URL(url).host as typeof TRUSTED_CATALOG[number])),
  'no Native signed URL remains in either playurl field spelling')

const nestedStorage = new FakeStorage(), nestedSettings = new SettingsStore(nestedStorage, () => now)
await nestedSettings.update({ considerNativeSources: true })
const nestedSession = new SessionStore(), nestedState = nestedSession.beginGeneration(false)
const nestedVault = new SignedRouteVault(); nestedVault.reset(nestedState.generation, nestedState.epoch)
const nestedRoutes = new RouteCoordinator(clock, nestedSession, nestedSettings,
  new RestrictionStore(nestedStorage, () => now), new EvidenceStore(nestedStorage, () => now), nestedVault)
const nestedAdapter = new PlayurlAdapter(nestedSession, nestedVault, nestedRoutes, nestedSettings)
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
check(nestedAdapter.transform(nativeOnNested, 'trusted-api'), 'Native-on nested audio fixture accepts valid DASH video')
equal(nativeOnNested.data.dash.dolby.audio[0]?.base_url, dolbyRoot, 'Native-on preserves legacy Dolby audio URL')
equal(nativeOnNested.data.dash.flac.audio.base_url, flacRoot, 'Native-on preserves legacy FLAC audio URL')
await nestedSettings.update({ considerNativeSources: false }); nestedRoutes.invalidateForUserSetting()
const strictNested = nestedPayload()
check(nestedAdapter.transform(strictNested, 'trusted-api'), 'Catalog-only nested audio fixture accepts valid DASH video')
const nestedAudioUrls = [strictNested.data.dash.dolby.audio[0]?.base_url ?? '',
  ...strictNested.data.dash.dolby.audio[0]!.backup_url, strictNested.data.dash.flac.audio.base_url,
  ...strictNested.data.dash.flac.audio.backup_url]
check(nestedAudioUrls.every(url => url === '' || TRUSTED_CATALOG.includes(new URL(url).host as typeof TRUSTED_CATALOG[number])),
  'Catalog-only playurl rewrites or clears every nested Dolby and FLAC audio primary and backup URL')

const failureStorage = new FakeStorage(), failureSession = new SessionStore()
const failureState = failureSession.beginGeneration(false), failureVault = new SignedRouteVault()
failureVault.reset(failureState.generation, failureState.epoch)
const failureEvidence = new EvidenceStore(failureStorage, () => now)
const failureRoutes = new RouteCoordinator(clock, failureSession, new SettingsStore(failureStorage, () => now),
  new RestrictionStore(failureStorage, () => now), failureEvidence, failureVault)
const failureRoots = {
  video: 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/catalog-failure/video.m4s?signature=video',
  audio: 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/catalog-failure/audio.m4s?signature=audio',
}
for (const kind of ['video', 'audio'] as const) {
  const root = failureRoots[kind]
  const rep = failureVault.register({ generation: failureState.generation, epoch: failureState.epoch,
    kind, key: `failure:${kind}`, height: kind === 'video' ? 1080 : 0, codec: kind === 'video' ? 'av1' : 'other',
    bandwidth: kind === 'video' ? 2_000_000 : 192_000, urls: [root], source: 'trusted-api' })
  check(rep, `Catalog failure fixture registers ${kind}`)
  const applied = failureRoutes.apply(root)
  equal(applied.decision.routeType, 'catalog-generated', `${kind} failure fixture targets Catalog`)
  const targetHost = applied.decision.host ?? ''
  const observed: TransportObservation = { generation: failureState.generation, epoch: failureState.epoch,
    decisionId: applied.decision.id, representation: rep, kind, routeType: 'catalog-generated',
    originalHost: new URL(root).host, targetHost, finalHost: null, responseUrlMatchesRequest: false,
    streamKey: applied.streamKey, status: 0, bytes: 0, ttfbMs: null, elapsedMs: 100,
    completedAt: now + (kind === 'video' ? 1 : 2), outcome: 'failure', failureKind: 'network' }
  const { failureKind: _failureKind, ...redirected } = observed
  await failureRoutes.observe({ ...redirected, finalHost: new URL(root).host, status: 206,
    bytes: 70 * 1024, outcome: 'success' })
  equal(failureEvidence.get(new URL(root).host, kind), null,
    `${kind} response redirected to Native host cannot gain success evidence`)
  equal(failureSession.get().affinity, null, 'detached response cannot establish playback affinity')
  await failureRoutes.observe(observed)
  check(failureEvidence.get(targetHost, kind)?.samples.some(sample => sample.outcome === 'failure'),
    `${kind} Catalog network failure without response host still records transport failure`)
  check((failureRoutes.snapshot().fallback as Record<string, unknown>)[kind],
    `${kind} Catalog network failure without response host still plans recovery`)
}

const dispatchStorage = new FakeStorage(), dispatchSettings = new SettingsStore(dispatchStorage, () => now)
await dispatchSettings.update({ considerNativeSources: true })
const dispatchSession = new SessionStore(), dispatchState = dispatchSession.beginGeneration(false)
const dispatchVault = new SignedRouteVault(); dispatchVault.reset(dispatchState.generation, dispatchState.epoch)
const dispatchEvidence = new EvidenceStore(dispatchStorage, () => now)
const dispatchRoutes = new RouteCoordinator(clock, dispatchSession, dispatchSettings,
  new RestrictionStore(dispatchStorage, () => now), dispatchEvidence, dispatchVault)
const dispatchPlayurl = new PlayurlAdapter(dispatchSession, dispatchVault, dispatchRoutes, dispatchSettings)
const dispatchRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/dispatch/video.m4s?signature=private'
const dispatchNativeBackup = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/dispatch/video.m4s?signature=backup'
const dispatchItem = { id: 80, codecid: 13, height: 1080, bandwidth: 1_000_000,
  base_url: dispatchRoot, backup_url: [dispatchNativeBackup] }
dispatchPlayurl.transform({ data: { dash: { video: [dispatchItem], audio: [] } } })
let gateDispatch = true
const dispatchGate: { release: () => void } = { release: () => undefined }
const dispatchMeasurement = { willGateStartup: () => gateDispatch,
  prepareStartup: async (): Promise<void> => { await new Promise<void>(resolve => { dispatchGate.release = resolve }) },
  noteUnpreflighted: (_reason: string): void => undefined }
const dispatchTransport = new TransportAdapter(dispatchSession, dispatchSettings, dispatchRoutes,
  dispatchPlayurl, dispatchMeasurement as never, () => now)
dispatchTransport.install()
equal(dispatchTransport.snapshot().hookState, 'installed', 'Catalog-only dispatch fixture installs Fetch and XHR hooks')
const beforeToggleFetch = nativeFetchCalls
const pendingToggleFetch = fakeWindow.fetch(dispatchRoot)
equal(nativeFetchCalls, beforeToggleFetch, 'Native-on Fetch can wait for startup before send')
await dispatchSettings.update({ considerNativeSources: false })
dispatchRoutes.invalidateForUserSetting()
dispatchGate.release()
await pendingToggleFetch
check(TRUSTED_CATALOG.includes(new URL(nativeFetchUrls.at(-1) ?? '').host as typeof TRUSTED_CATALOG[number]),
  'Fetch rechecks Catalog-only mode after startup wait before native send')
equal(nativeFetchRedirects.at(-1), 'error', 'Catalog-only Fetch media request rejects redirects')
await dispatchSettings.update({ considerNativeSources: true })
dispatchRoutes.invalidateForUserSetting()
const pendingToggleXhr = new FakeXhr(); pendingToggleXhr.open('GET', dispatchRoot); pendingToggleXhr.send()
equal(pendingToggleXhr.nativeSends, 0, 'Native-on XHR can wait for startup before send')
await dispatchSettings.update({ considerNativeSources: false })
dispatchRoutes.invalidateForUserSetting()
dispatchGate.release()
await new Promise(resolve => setTimeout(resolve, 0))
equal(pendingToggleXhr.nativeSends, 1, 'XHR waiting across Native switch still sends only once')
check(TRUSTED_CATALOG.includes(new URL(pendingToggleXhr.url).host as typeof TRUSTED_CATALOG[number]),
  'XHR rechecks Catalog-only mode after startup wait before native send')
gateDispatch = false
const beforeNonGetFetch = nativeFetchCalls
await fakeWindow.fetch(dispatchRoot, { method: 'POST' }).then(
  () => { throw new Error('Catalog-only POST Fetch must reject locally') }, () => undefined)
equal(nativeFetchCalls, beforeNonGetFetch, 'Catalog-only non-GET Fetch never reaches native fetch')
const directCatalogFetch = await fakeWindow.fetch(dispatchNativeBackup)
check(directCatalogFetch.status === 206 && TRUSTED_CATALOG.includes(new URL(nativeFetchUrls.at(-1) ?? '').host as typeof TRUSTED_CATALOG[number]),
  'old Native player backup is rechecked at Fetch dispatch')
equal(nativeFetchRedirects.at(-1), 'error', 'old player backup Fetch also rejects redirects')
const blockedPostXhr = new FakeXhr(); blockedPostXhr.open('POST', dispatchRoot); blockedPostXhr.send()
equal(blockedPostXhr.nativeSends, 0, 'Catalog-only non-GET XHR never reaches native send')
const catalogXhr = new FakeXhr(); catalogXhr.open('GET', dispatchRoot); catalogXhr.send()
equal(catalogXhr.nativeSends, 1, 'Catalog-only XHR sends once')
check(TRUSTED_CATALOG.includes(new URL(catalogXhr.url).host as typeof TRUSTED_CATALOG[number]),
  'Catalog-only XHR checks its final native send URL')
const redirectedXhr = new FakeXhr(); redirectedXhr.finalResponseUrl = dispatchRoot
redirectedXhr.open('GET', dispatchRoot); redirectedXhr.send()
await Promise.resolve()
equal(dispatchEvidence.get(new URL(dispatchRoot).host, 'video'), null,
  'XHR response on a non-Catalog host does not establish successful Native health')
await dispatchSettings.update({ considerNativeSources: true })
dispatchRoutes.invalidateForUserSetting()
const staleOpaqueUrl = 'https://upos-hz-mirrorakam.akamaized.net/opaque/stale-audio?signature=private'
dispatchVault.register({ generation: dispatchSession.get().generation, epoch: dispatchSession.get().epoch,
  kind: 'audio', key: 'stale-opaque', height: 0, codec: 'other', bandwidth: 192_000,
  urls: [staleOpaqueUrl], source: 'trusted-api' })
const staleOpaqueXhr = new FakeXhr(); staleOpaqueXhr.open('GET', staleOpaqueUrl)
await dispatchSettings.update({ considerNativeSources: false })
dispatchRoutes.invalidateForUserSetting()
const nextDispatchState = dispatchSession.beginGeneration(false)
dispatchVault.reset(nextDispatchState.generation, nextDispatchState.epoch); dispatchRoutes.resetEpoch()
staleOpaqueXhr.send()
equal(staleOpaqueXhr.nativeSends, 0,
  'XHR opened for opaque Native media cannot leak after Catalog-only switch and SPA generation reset')
await dispatchSettings.update({ disabled: true })
const disabledDispatch = new FakeXhr(); disabledDispatch.open('GET', dispatchRoot); disabledDispatch.send()
equal(disabledDispatch.url, dispatchRoot, 'disabled script preserves website Native XHR URL')
equal(disabledDispatch.nativeSends, 1, 'disabled script still sends website XHR')
dispatchTransport.dispose()

const emittedBackupStorage = new FakeStorage(), emittedBackupSettings = new SettingsStore(emittedBackupStorage, () => now)
await emittedBackupSettings.update({ considerNativeSources: true })
const emittedBackupSession = new SessionStore(), emittedBackupState = emittedBackupSession.beginGeneration(false)
const emittedBackupVault = new SignedRouteVault(); emittedBackupVault.reset(emittedBackupState.generation, emittedBackupState.epoch)
const emittedBackupRoutes = new RouteCoordinator(clock, emittedBackupSession, emittedBackupSettings,
  new RestrictionStore(emittedBackupStorage, () => now), new EvidenceStore(emittedBackupStorage, () => now), emittedBackupVault)
const emittedBackupPlayurl = new PlayurlAdapter(emittedBackupSession, emittedBackupVault, emittedBackupRoutes, emittedBackupSettings)
const emittedBackupRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/emitted-backup/root.m4s?signature=root'
const emittedThirdPartyBackup = 'https://cdn.example.net/upgcxcode/emitted-backup/final.m4s?signature=old-player-backup'
const emittedBackupItem = { id: 80, codecid: 13, height: 1080, bandwidth: 1_000_000,
  base_url: emittedBackupRoot, backup_url: [
    'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/emitted-backup/first.m4s?signature=first',
    'https://upos-sz-mirroralib.bilivideo.com/upgcxcode/emitted-backup/second.m4s?signature=second',
    'https://upos-sz-mirrorali02.bilivideo.com/upgcxcode/emitted-backup/third.m4s?signature=third',
    emittedThirdPartyBackup,
  ] }
check(emittedBackupPlayurl.transform({ data: { dash: { video: [emittedBackupItem], audio: [] } } }, 'trusted-api'),
  'Native-on playurl fixture accepts primary plus four backups')
check(emittedBackupItem.backup_url.includes(emittedThirdPartyBackup),
  'Native-on player output can emit a fifth signed route on an arbitrary host')
const emittedBackupTransport = new TransportAdapter(emittedBackupSession, emittedBackupSettings, emittedBackupRoutes,
  emittedBackupPlayurl, measurementStub as never, () => now)
emittedBackupTransport.install()
await emittedBackupSettings.update({ considerNativeSources: false }); emittedBackupRoutes.invalidateForUserSetting()
const beforeEmittedBackupFetch = nativeFetchCalls
let emittedBackupFetchBlocked = false
try { await fakeWindow.fetch(emittedThirdPartyBackup) } catch { emittedBackupFetchBlocked = true }
check(emittedBackupFetchBlocked,
  'Catalog-only Fetch blocks an old emitted Native player backup absent from the current exact vault index')
equal(nativeFetchCalls, beforeEmittedBackupFetch, 'old emitted player backup never reaches native Fetch after Native is turned off')
const emittedBackupXhr = new FakeXhr(); emittedBackupXhr.open('GET', emittedThirdPartyBackup); emittedBackupXhr.send()
equal(emittedBackupXhr.nativeSends, 0, 'Catalog-only XHR blocks an old emitted Native player backup before native send')
const unrelatedThirdPartyUrl = 'https://media.other-example.org/unrelated/video.m4s?source=site'
const beforeUnrelatedFetch = nativeFetchCalls
await fakeWindow.fetch(unrelatedThirdPartyUrl)
equal(nativeFetchCalls, beforeUnrelatedFetch + 1, 'unrelated third-party media Fetch remains website-owned')
const unrelatedThirdPartyXhr = new FakeXhr(); unrelatedThirdPartyXhr.open('GET', unrelatedThirdPartyUrl); unrelatedThirdPartyXhr.send()
equal(unrelatedThirdPartyXhr.nativeSends, 1, 'unrelated third-party media XHR remains website-owned')
await emittedBackupSettings.update({ considerNativeSources: true }); emittedBackupRoutes.invalidateForUserSetting()
const outputCapRep = emittedBackupVault.contextForUrl(emittedBackupRoot)?.representation
check(outputCapRep, 'Native-on output-cap fixture retains a current representation')
for (let index = 0; index < 1200; index++) {
  const fillerUrl = `https://fill.example.net/upgcxcode/output-cap/${index}.m4s?signature=filler`
  emittedBackupVault.registerAlias(outputCapRep!, fillerUrl)
  emittedBackupVault.registerOutput(outputCapRep!, emittedBackupRoot, fillerUrl, [],
    decisionId('output-cap-fill'), 'trusted-api')
}
const cappedBackupRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/emitted-backup/capped-root.m4s?signature=capped-root'
const cappedThirdPartyBackup = 'https://cdn.example.net/upgcxcode/emitted-backup/capped-final.m4s?signature=capped-old-backup'
const cappedBackupItem = { id: 90, codecid: 13, height: 720, bandwidth: 1_000_000,
  base_url: cappedBackupRoot, backup_url: [
    'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/emitted-backup/capped-first.m4s?signature=first',
    'https://upos-sz-mirroralib.bilivideo.com/upgcxcode/emitted-backup/capped-second.m4s?signature=second',
    'https://upos-sz-mirrorali02.bilivideo.com/upgcxcode/emitted-backup/capped-third.m4s?signature=third',
    cappedThirdPartyBackup,
  ] }
check(emittedBackupPlayurl.transform({ data: { dash: { video: [cappedBackupItem], audio: [] } } }, 'trusted-api'),
  'Native-on output-cap fixture accepts another representation in the current epoch')
check(!cappedBackupItem.backup_url.includes(cappedThirdPartyBackup),
  'Native-on player omits an external backup that bounded provenance indexes cannot retain')
await emittedBackupSettings.update({ considerNativeSources: false }); emittedBackupRoutes.invalidateForUserSetting()
const beforeCappedBackupFetch = nativeFetchCalls
await fakeWindow.fetch(cappedThirdPartyBackup)
equal(nativeFetchCalls, beforeCappedBackupFetch + 1,
  'a backup withheld from player output remains an unattributable third-party website request')
const cappedBackupXhr = new FakeXhr(); cappedBackupXhr.open('GET', cappedThirdPartyBackup); cappedBackupXhr.send()
equal(cappedBackupXhr.nativeSends, 1, 'XHR also leaves an unattributable third-party website request unchanged')
emittedBackupTransport.dispose()

const pageStorage = new FakeStorage(), pageSettings = new SettingsStore(pageStorage, () => now)
const pageSession = new SessionStore(), pageState = pageSession.beginGeneration(false)
const pageVault = new SignedRouteVault(); pageVault.reset(pageState.generation, pageState.epoch)
const pageRoutes = new RouteCoordinator(clock, pageSession, pageSettings,
  new RestrictionStore(pageStorage, () => now), new EvidenceStore(pageStorage, () => now), pageVault)
const pagePlayurl = new PlayurlAdapter(pageSession, pageVault, pageRoutes, pageSettings)
const assignedAtSetter: string[] = []
const assignedPayloadAtSetter: string[] = []
let pageOwnedPlayinfo: unknown = undefined
Object.defineProperty(fakeWindow, '__playinfo__', { configurable: true,
  get: () => pageOwnedPlayinfo,
  set: (value: unknown) => {
    const item = (value as { data?: { dash?: { video?: { base_url?: string }[] } } })?.data?.dash?.video?.[0]
    assignedAtSetter.push(item?.base_url ?? '')
    assignedPayloadAtSetter.push(JSON.stringify(value))
    pageOwnedPlayinfo = value
  } })
const pageInfo = new PagePlayinfoAdapter(payload => pagePlayurl.transform(payload, 'page-hint'),
  () => pageRoutes.isCatalogOnly())
pageInfo.install()
const earlyPageUrl = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/page-hint/early.m4s?signature=early'
const earlyPagePayload = { data: { dash: { video: [{ id: 80, codecid: 13, height: 1080,
  bandwidth: 1_000_000, base_url: earlyPageUrl, backup_url: [] as string[] }], audio: [] } } }
Reflect.set(fakeWindow, '__playinfo__', earlyPagePayload)
check(TRUSTED_CATALOG.includes(new URL(assignedAtSetter.at(-1) ?? '').host as typeof TRUSTED_CATALOG[number]),
  'page-owned configurable setter synchronously receives Catalog-rewritten playinfo in OFF mode')
equal(assignedAtSetter.at(-1), earlyPagePayload.data.dash.video[0]?.base_url,
  'setter observes the same sanitized page-hint payload that remains on the page')
const trustedPageUrl = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/page-hint/trusted.m4s?signature=trusted'
const trustedPagePayload = { data: { dash: { video: [{ id: 80, codecid: 13, height: 1080,
  bandwidth: 1_000_000, base_url: trustedPageUrl, backup_url: [] as string[] }], audio: [] } } }
pagePlayurl.transform(trustedPagePayload, 'trusted-api')
const trustedPageRep = pageVault.contextForUrl(trustedPageUrl)?.representation
check(trustedPageRep, 'trusted API adopts the page-hint representation')
const trustedPageOutput = trustedPagePayload.data.dash.video[0]?.base_url ?? ''
const trustedOutputRole = trustedPageRep ? pageVault.outputRole(trustedPageRep, trustedPageOutput) : null
equal(trustedOutputRole?.source, 'trusted-api', 'trusted Catalog output records API provenance before later hints')
const latePageUrl = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/page-hint/late.m4s?signature=late'
const latePagePayload = { data: { dash: { video: [{ id: 80, codecid: 13, height: 1080,
  bandwidth: 1_000_000, base_url: latePageUrl, backup_url: [] as string[] }], audio: [] } } }
Reflect.set(fakeWindow, '__playinfo__', latePagePayload)
check(TRUSTED_CATALOG.includes(new URL(assignedAtSetter.at(-1) ?? '').host as typeof TRUSTED_CATALOG[number]),
  'late page-hint setter synchronously receives a Catalog URL after trusted API adoption')
check(latePagePayload.data.dash.video[0]?.base_url !== latePageUrl,
  'late lower-trust hint is sanitized in its own object before page consumption')
equal(latePagePayload.data.dash.video[0]?.base_url, trustedPageOutput,
  'late hint reuses the existing trusted Catalog output URL')
const roleAfterLateHint = trustedPageRep ? pageVault.outputRole(trustedPageRep, trustedPageOutput) : null
equal(roleAfterLateHint?.source, trustedOutputRole?.source,
  'late page hint cannot replace trusted API output source for the same Catalog URL')
equal(roleAfterLateHint?.decisionId, trustedOutputRole?.decisionId,
  'late page hint cannot replace trusted API output decision for the same Catalog URL')
equal(trustedPageRep ? pageVault.rootUrl(trustedPageRep) : null, trustedPageUrl,
  'late hint cannot replace trusted API root authority')
check(!trustedPageRep || !pageVault.candidates(trustedPageRep, new Set()).native.some(route => route.host === new URL(latePageUrl).host),
  'sanitizing late page hint grants no new Native candidate')
const affinityPageRoot = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/page-hint/affinity.m4s?signature=affinity'
const affinityPageRep = pageVault.register({ generation: pageSession.get().generation, epoch: pageSession.get().epoch,
  kind: 'video', key: 'affinity:64', height: 720, codec: 'av1', bandwidth: 1_000_000,
  urls: [affinityPageRoot], source: 'trusted-api' })
check(affinityPageRep, 'separate video representation can establish observed affinity')
const affinityChoice = pageRoutes.startupOptions(affinityPageRoot)?.candidates.find(candidate =>
  candidate.type === 'catalog-generated' && candidate.host !== new URL(trustedPageOutput).host)
check(affinityChoice, 'affinity fixture has a different legal Catalog host')
pageRoutes.commitStartupChoice(affinityPageRoot, affinityChoice ?? null, 'test-observed-affinity')
const affinityApplied = pageRoutes.apply(affinityPageRoot)
equal(affinityApplied.decision.host, affinityChoice?.host, 'separate representation sends its selected Catalog host')
for (let index = 0; index < 2; index++) await pageRoutes.observe({ generation: pageSession.get().generation,
  epoch: pageSession.get().epoch, decisionId: affinityApplied.decision.id, representation: affinityPageRep,
  kind: 'video', routeType: 'catalog-generated', originalHost: new URL(affinityPageRoot).host,
  targetHost: affinityApplied.decision.host ?? '', finalHost: affinityApplied.decision.host,
  responseUrlMatchesRequest: true, streamKey: affinityApplied.streamKey, status: 206,
  bytes: 70 * 1024, ttfbMs: 20, elapsedMs: 100, completedAt: now + index + 1, outcome: 'success' })
equal(pageSession.get().affinity?.host, affinityChoice?.host, 'two observed requests confirm a different Catalog affinity')
equal(pageRoutes.apply(trustedPageOutput).decision.host, affinityChoice?.host,
  'sanitizing late page hint does not consume the trusted representation first-use affinity decision')
const unsupportedPageUrl = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/page-hint/unsupported.m4s?signature=unsupported-secret'
const unsupportedPagePayload = { data: { durl: [{ url: unsupportedPageUrl }] } }
Reflect.set(fakeWindow, '__playinfo__', unsupportedPagePayload)
check(!assignedPayloadAtSetter.at(-1)?.includes('signature=unsupported-secret'),
  'Catalog-only configurable page setter never receives raw signed URL from non-DASH playinfo')
pageInfo.dispose()
Reflect.deleteProperty(fakeWindow, '__playinfo__')
const initialUnsupportedUrl = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/page-hint/initial.m4s?signature=initial-secret'
const initialUnsupportedPlayinfo = { data: { durl: [{ url: initialUnsupportedUrl }] } }
Object.defineProperty(fakeWindow, '__playinfo__', { configurable: true, writable: true, value: initialUnsupportedPlayinfo })
const initialPageInfo = new PagePlayinfoAdapter(payload => pagePlayurl.transform(payload, 'page-hint'),
  () => pageRoutes.isCatalogOnly())
initialPageInfo.install()
check(!JSON.stringify(Reflect.get(fakeWindow, '__playinfo__'))?.includes('signature=initial-secret'),
  'Catalog-only installed __playinfo__ getter cannot expose an existing unsupported Native playinfo value')
initialPageInfo.dispose()
Reflect.deleteProperty(fakeWindow, '__playinfo__')
await pageSettings.update({ considerNativeSources: true }); pageRoutes.invalidateForUserSetting()
Object.defineProperty(fakeWindow, '__playinfo__', { configurable: true, writable: true, value: initialUnsupportedPlayinfo })
const nativeOnInitialPageInfo = new PagePlayinfoAdapter(payload => pagePlayurl.transform(payload, 'page-hint'),
  () => pageRoutes.isCatalogOnly())
nativeOnInitialPageInfo.install()
equal(Reflect.get(fakeWindow, '__playinfo__'), initialUnsupportedPlayinfo,
  'Native-on installed __playinfo__ getter preserves an existing unsupported website value')
nativeOnInitialPageInfo.dispose()
Reflect.deleteProperty(fakeWindow, '__playinfo__')
await pageSettings.update({ considerNativeSources: false }); pageRoutes.invalidateForUserSetting()
let freshPlayinfoReads = 0
Object.defineProperty(fakeWindow, '__playinfo__', { configurable: true, get: () => ({ data: { durl: [{
  url: `https://upos-hz-mirrorakam.akamaized.net/upgcxcode/page-hint/fresh.m4s?signature=fresh-${++freshPlayinfoReads}`,
}] } }) })
const freshPageInfo = new PagePlayinfoAdapter(payload => pagePlayurl.transform(payload, 'page-hint'),
  () => pageRoutes.isCatalogOnly())
freshPageInfo.install()
for (let read = 0; read < 2; read++) {
  check(!JSON.stringify(Reflect.get(fakeWindow, '__playinfo__'))?.includes('signature=fresh-'),
    'Catalog-only __playinfo__ accessor getter sanitizes every fresh unsupported Native value')
}
await pageSettings.update({ considerNativeSources: true }); pageRoutes.invalidateForUserSetting()
check(JSON.stringify(Reflect.get(fakeWindow, '__playinfo__'))?.includes('signature=fresh-'),
  'Native-on __playinfo__ accessor getter preserves fresh website value')
freshPageInfo.dispose()
Reflect.deleteProperty(fakeWindow, '__playinfo__')

const apiFailureStorage = new FakeStorage(), apiFailureSettings = new SettingsStore(apiFailureStorage, () => now)
const apiFailureSession = new SessionStore(), apiFailureState = apiFailureSession.beginGeneration(false)
const apiFailureVault = new SignedRouteVault(); apiFailureVault.reset(apiFailureState.generation, apiFailureState.epoch)
const apiFailureRoutes = new RouteCoordinator(clock, apiFailureSession, apiFailureSettings,
  new RestrictionStore(apiFailureStorage, () => now), new EvidenceStore(apiFailureStorage, () => now), apiFailureVault)
const apiFailurePlayurl = new PlayurlAdapter(apiFailureSession, apiFailureVault, apiFailureRoutes, apiFailureSettings)
const apiFailureTransport = new TransportAdapter(apiFailureSession, apiFailureSettings, apiFailureRoutes,
  apiFailurePlayurl, measurementStub as never, () => now)
apiFailureTransport.install()
const apiEndpoint = 'https://api.bilibili.com/x/player/wbi/playurl?cid=contract'
const leakedNativeUrl = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/api-failure/video.m4s?signature=raw-secret'
const malformedApi = `{"data":{"dash":{"video":[{"base_url":"${leakedNativeUrl}"}`
const unsupportedApi = { code: 0, data: { sources: [{ url: leakedNativeUrl }] } }
const assertNoRawNative = async (read: () => unknown | Promise<unknown>, message: string): Promise<void> => {
  let value: unknown = null, rejected = false
  try { value = await read() } catch { rejected = true }
  check(rejected || !JSON.stringify(value)?.includes('signature=raw-secret'), message)
}
playurlFetchBody = malformedApi
await assertNoRawNative(async () => await (await fakeWindow.fetch(apiEndpoint)).text(),
  'Catalog-only Fetch does not expose a malformed HTTP-200 playurl carrying a signed Native URL')
playurlFetchBody = JSON.stringify(unsupportedApi)
await assertNoRawNative(async () => await (await fakeWindow.fetch(apiEndpoint)).text(),
  'Catalog-only Fetch does not expose a non-DASH HTTP-200 playurl carrying a signed Native URL')
const malformedTextXhr = new FakeXhr(); malformedTextXhr.responseType = 'text'
malformedTextXhr.payload = malformedApi; malformedTextXhr.rawResponseText = malformedApi
malformedTextXhr.open('GET', apiEndpoint); malformedTextXhr.send()
await assertNoRawNative(() => malformedTextXhr.responseText,
  'Catalog-only XHR text response does not expose malformed playurl signed Native URL')
await assertNoRawNative(() => malformedTextXhr.response,
  'Catalog-only XHR response getter does not expose malformed playurl signed Native URL')
const unsupportedTextXhr = new FakeXhr(); unsupportedTextXhr.responseType = 'text'
unsupportedTextXhr.payload = JSON.stringify(unsupportedApi); unsupportedTextXhr.rawResponseText = JSON.stringify(unsupportedApi)
unsupportedTextXhr.open('GET', apiEndpoint); unsupportedTextXhr.send()
await assertNoRawNative(() => unsupportedTextXhr.responseText,
  'Catalog-only XHR text response does not expose non-DASH playurl signed Native URL')
const unsupportedJsonXhr = new FakeXhr(); unsupportedJsonXhr.responseType = 'json'; unsupportedJsonXhr.payload = unsupportedApi
unsupportedJsonXhr.open('GET', apiEndpoint); unsupportedJsonXhr.send()
await assertNoRawNative(() => unsupportedJsonXhr.response,
  'Catalog-only XHR JSON response does not expose non-DASH playurl signed Native URL')
for (const responseType of ['blob', 'arraybuffer'] as const) {
  const binaryXhr = new FakeXhr(); binaryXhr.responseType = responseType
  binaryXhr.open('GET', apiEndpoint); binaryXhr.send()
  equal(binaryXhr.nativeSends, 0,
    `Catalog-only XHR ${responseType} playurl is blocked before native send because its response cannot be sanitized`)
}
const loadingSignedText = `{"data":{"dash":{"video":[{"base_url":"${leakedNativeUrl}"`
const loadingTextXhr = new FakeXhr(); loadingTextXhr.responseType = 'text'; loadingTextXhr.holdAtLoading = true
loadingTextXhr.payload = loadingSignedText; loadingTextXhr.rawResponseText = loadingSignedText
loadingTextXhr.open('GET', apiEndpoint); loadingTextXhr.send()
equal(loadingTextXhr.readyState, 3, 'partial playurl XHR fixture is still loading')
await assertNoRawNative(() => loadingTextXhr.responseText,
  'Catalog-only XHR LOADING responseText cannot expose a partial signed Native playurl')
await assertNoRawNative(() => loadingTextXhr.response,
  'Catalog-only XHR LOADING text response cannot expose a partial signed Native playurl')
const delayedSitePlayurl = JSON.stringify({ code: 0, data: { dash: { video: [{ id: 80, codecid: 13,
  height: 1080, bandwidth: 1_000_000, base_url: leakedNativeUrl, backup_url: [] }], audio: [] } } }, null, 2)
const stalePlayurlTextXhr = new FakeXhr(); stalePlayurlTextXhr.responseType = 'text'
stalePlayurlTextXhr.payload = delayedSitePlayurl; stalePlayurlTextXhr.rawResponseText = delayedSitePlayurl
stalePlayurlTextXhr.open('GET', apiEndpoint); stalePlayurlTextXhr.send()
const stalePlayurlJsonXhr = new FakeXhr(); stalePlayurlJsonXhr.responseType = 'json'
stalePlayurlJsonXhr.payload = JSON.parse(delayedSitePlayurl) as unknown
stalePlayurlJsonXhr.open('GET', apiEndpoint); stalePlayurlJsonXhr.send()
const nextApiFailureState = apiFailureSession.beginGeneration(false)
apiFailureVault.reset(nextApiFailureState.generation, nextApiFailureState.epoch); apiFailureRoutes.resetEpoch()
await assertNoRawNative(() => stalePlayurlTextXhr.responseText,
  'Catalog-only XHR text opened in an old SPA generation never exposes a signed Native playurl after generation reset')
await assertNoRawNative(() => stalePlayurlTextXhr.response,
  'Catalog-only XHR response opened in an old SPA generation never exposes a signed Native playurl after generation reset')
await assertNoRawNative(() => stalePlayurlJsonXhr.response,
  'Catalog-only XHR JSON opened in an old SPA generation never exposes a signed Native playurl after generation reset')
let releaseDelayedPlayurl: () => void = () => undefined
playurlFetchOverride = new Response(new ReadableStream<Uint8Array>({ start(controller) {
  releaseDelayedPlayurl = () => { controller.enqueue(new TextEncoder().encode(delayedSitePlayurl)); controller.close() }
} }), { status: 201, headers: { 'x-website-playurl': 'original' } })
let delayedPlayurlSettled = false
const delayedPlayurlFetch = fakeWindow.fetch(apiEndpoint).then(response => { delayedPlayurlSettled = true; return response })
await new Promise(resolve => setTimeout(resolve, 0))
equal(delayedPlayurlSettled, false, 'website playurl response body remains pending before script is disabled')
await apiFailureSettings.update({ disabled: true })
releaseDelayedPlayurl()
const disabledDuringResponse = await delayedPlayurlFetch
equal(disabledDuringResponse.status, 201, 'disabled script preserves pending website playurl status')
equal(disabledDuringResponse.headers.get('x-website-playurl'), 'original',
  'disabled script preserves pending website playurl headers')
equal(await disabledDuringResponse.text(), delayedSitePlayurl,
  'disabled script passes the original pending website playurl body through unchanged')
playurlFetchOverride = null
await apiFailureSettings.update({ disabled: false })
apiFailureTransport.dispose()
const throwingPlayurl = { transform: (): boolean => { throw new Error('synthetic transform failure') } }
const throwingTransport = new TransportAdapter(apiFailureSession, apiFailureSettings, apiFailureRoutes,
  throwingPlayurl as never, measurementStub as never, () => now)
throwingTransport.install()
const transformFailurePayload = { code: 0, data: { dash: { video: [{ id: 80, codecid: 13, height: 1080,
  bandwidth: 1_000_000, base_url: leakedNativeUrl, backup_url: [] }], audio: [] } } }
playurlFetchBody = JSON.stringify(transformFailurePayload)
await assertNoRawNative(async () => await (await fakeWindow.fetch(apiEndpoint)).text(),
  'Catalog-only Fetch does not expose signed Native URL after transform throws')
const throwingTextXhr = new FakeXhr(); throwingTextXhr.responseType = 'text'
throwingTextXhr.payload = JSON.stringify(transformFailurePayload)
throwingTextXhr.rawResponseText = JSON.stringify(transformFailurePayload)
throwingTextXhr.open('GET', apiEndpoint); throwingTextXhr.send()
await assertNoRawNative(() => throwingTextXhr.responseText,
  'Catalog-only XHR text does not expose signed Native URL after transform throws')
const throwingJsonXhr = new FakeXhr(); throwingJsonXhr.responseType = 'json'; throwingJsonXhr.payload = transformFailurePayload
throwingJsonXhr.open('GET', apiEndpoint); throwingJsonXhr.send()
await assertNoRawNative(() => throwingJsonXhr.response,
  'Catalog-only XHR JSON does not expose signed Native URL after transform throws')
await apiFailureSettings.update({ considerNativeSources: true })
apiFailureRoutes.invalidateForUserSetting()
playurlFetchBody = malformedApi
equal(await (await fakeWindow.fetch(apiEndpoint)).text(), malformedApi,
  'Native-on Fetch preserves malformed website playurl response')
const nativeOnXhr = new FakeXhr(); nativeOnXhr.responseType = 'text'
nativeOnXhr.payload = malformedApi; nativeOnXhr.rawResponseText = malformedApi
nativeOnXhr.open('GET', apiEndpoint); nativeOnXhr.send()
equal(nativeOnXhr.responseText, malformedApi, 'Native-on XHR preserves malformed website playurl response')
const nativeOnLoadingXhr = new FakeXhr(); nativeOnLoadingXhr.responseType = 'text'; nativeOnLoadingXhr.holdAtLoading = true
nativeOnLoadingXhr.payload = loadingSignedText; nativeOnLoadingXhr.rawResponseText = loadingSignedText
nativeOnLoadingXhr.open('GET', apiEndpoint); nativeOnLoadingXhr.send()
equal(nativeOnLoadingXhr.responseText, loadingSignedText, 'Native-on XHR LOADING responseText preserves website partial playurl')
equal(nativeOnLoadingXhr.response, loadingSignedText, 'Native-on XHR LOADING text response preserves website partial playurl')
for (const responseType of ['blob', 'arraybuffer'] as const) {
  const binaryXhr = new FakeXhr(); binaryXhr.responseType = responseType
  binaryXhr.open('GET', apiEndpoint); binaryXhr.send()
  equal(binaryXhr.nativeSends, 1, `Native-on XHR ${responseType} playurl retains website dispatch`)
}
await apiFailureSettings.update({ disabled: true, considerNativeSources: false })
equal(await (await fakeWindow.fetch(apiEndpoint)).text(), malformedApi,
  'disabled script preserves malformed website Fetch playurl response')
const disabledApiXhr = new FakeXhr(); disabledApiXhr.responseType = 'text'
disabledApiXhr.payload = malformedApi; disabledApiXhr.rawResponseText = malformedApi
disabledApiXhr.open('GET', apiEndpoint); disabledApiXhr.send()
equal(disabledApiXhr.responseText, malformedApi, 'disabled script preserves malformed website XHR playurl response')
const disabledLoadingXhr = new FakeXhr(); disabledLoadingXhr.responseType = 'text'; disabledLoadingXhr.holdAtLoading = true
disabledLoadingXhr.payload = loadingSignedText; disabledLoadingXhr.rawResponseText = loadingSignedText
disabledLoadingXhr.open('GET', apiEndpoint); disabledLoadingXhr.send()
equal(disabledLoadingXhr.responseText, loadingSignedText, 'disabled script preserves website partial playurl responseText')
equal(disabledLoadingXhr.response, loadingSignedText, 'disabled script preserves website partial playurl text response')
for (const responseType of ['blob', 'arraybuffer'] as const) {
  const binaryXhr = new FakeXhr(); binaryXhr.responseType = responseType
  binaryXhr.open('GET', apiEndpoint); binaryXhr.send()
  equal(binaryXhr.nativeSends, 1, `disabled script preserves website XHR ${responseType} playurl dispatch`)
}
throwingTransport.dispose()
playurlFetchBody = JSON.stringify({ code: 0, data: { dash: { video: [], audio: [] } } })

const oversizedStorage = new FakeStorage(), oversizedSettings = new SettingsStore(oversizedStorage, () => now)
const oversizedSession = new SessionStore(), oversizedState = oversizedSession.beginGeneration(false)
const oversizedVault = new SignedRouteVault(); oversizedVault.reset(oversizedState.generation, oversizedState.epoch)
const oversizedRoutes = new RouteCoordinator(clock, oversizedSession, oversizedSettings,
  new RestrictionStore(oversizedStorage, () => now), new EvidenceStore(oversizedStorage, () => now), oversizedVault)
const oversizedPlayurl = new PlayurlAdapter(oversizedSession, oversizedVault, oversizedRoutes, oversizedSettings)
const oversizedTransport = new TransportAdapter(oversizedSession, oversizedSettings, oversizedRoutes,
  oversizedPlayurl, measurementStub as never, () => now)
oversizedTransport.install()
for (const suffix of ['szbdyd.com', 'mountaintoys.cn', 'nexusedgeio.com', 'ahdohpiechei.com']) {
  const knownPcdnUrl = `https://node.${suffix}/video.m4s?signature=pcdn-secret`
  const beforePcdnFetch = nativeFetchCalls
  let pcdnFetchBlocked = false
  try { await fakeWindow.fetch(knownPcdnUrl) } catch { pcdnFetchBlocked = true }
  check(pcdnFetchBlocked, `Catalog-only Fetch blocks known B station PCDN suffix ${suffix} before native dispatch`)
  equal(nativeFetchCalls, beforePcdnFetch, `known PCDN suffix ${suffix} never reaches native Fetch`)
  const pcdnXhr = new FakeXhr(); pcdnXhr.open('GET', knownPcdnUrl); pcdnXhr.send()
  equal(pcdnXhr.nativeSends, 0, `Catalog-only XHR blocks known B station PCDN suffix ${suffix} before native send`)
}
const thirdPartyMedia = 'https://cdn.example.net/video.m4s?signature=outside'
const beforeThirdPartyFetch = nativeFetchCalls
await fakeWindow.fetch(thirdPartyMedia)
equal(nativeFetchCalls, beforeThirdPartyFetch + 1, 'unattributed third-party .m4s Fetch remains website-owned')
const thirdPartyXhr = new FakeXhr(); thirdPartyXhr.open('GET', thirdPartyMedia); thirdPartyXhr.send()
equal(thirdPartyXhr.nativeSends, 1, 'unattributed third-party .m4s XHR remains website-owned')
const oversizedBilibiliMedia = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/video.m4s?signature=oversized-secret-'
  + 'x'.repeat(17 * 1024)
const beforeOversizedFetch = nativeFetchCalls
let oversizedFetchBlocked = false
try { await fakeWindow.fetch(oversizedBilibiliMedia) } catch { oversizedFetchBlocked = true }
check(oversizedFetchBlocked, 'Catalog-only oversized recognizable B station media Fetch rejects before native dispatch')
equal(nativeFetchCalls, beforeOversizedFetch,
  'Catalog-only oversized recognizable B station media Fetch never calls native fetch')
const oversizedXhr = new FakeXhr(); oversizedXhr.open('GET', oversizedBilibiliMedia); oversizedXhr.send()
equal(oversizedXhr.nativeSends, 0,
  'Catalog-only oversized recognizable B station media XHR never calls native send')
check(!JSON.stringify(oversizedTransport.snapshot()).includes('oversized-secret'),
  'oversized media block diagnostics never include the signed URL or query')
await oversizedSettings.update({ considerNativeSources: true }); oversizedRoutes.invalidateForUserSetting()
const beforeOversizedNativeOn = nativeFetchCalls
await fakeWindow.fetch(oversizedBilibiliMedia)
equal(nativeFetchCalls, beforeOversizedNativeOn + 1, 'Native-on oversized website Fetch preserves native dispatch')
const nativeOnOversizedXhr = new FakeXhr(); nativeOnOversizedXhr.open('GET', oversizedBilibiliMedia); nativeOnOversizedXhr.send()
equal(nativeOnOversizedXhr.nativeSends, 1, 'Native-on oversized website XHR preserves native dispatch')
await oversizedSettings.update({ disabled: true, considerNativeSources: false })
const beforeDisabledOversized = nativeFetchCalls
await fakeWindow.fetch(oversizedBilibiliMedia)
equal(nativeFetchCalls, beforeDisabledOversized + 1, 'disabled script preserves oversized website Fetch dispatch')
const disabledOversizedXhr = new FakeXhr(); disabledOversizedXhr.open('GET', oversizedBilibiliMedia); disabledOversizedXhr.send()
equal(disabledOversizedXhr.nativeSends, 1, 'disabled script preserves oversized website XHR dispatch')
oversizedTransport.dispose()

let shortResumeNow = now
const shortResume = new RecoveryController(recoveryPlayer, () => shortResumeNow)
shortResume.tick({ ...playerSnapshot, paused: false })
shortResumeNow += 1000; shortResume.tick({ ...playerSnapshot, paused: true })
shortResumeNow += 1000; shortResume.tick({ ...playerSnapshot, paused: false, frames: 100 })
equal(shortResume.snapshot().state, 'healthy', 'normal short resume clears pause-armed diagnostic state')

console.log(`v2 domain and controller tests passed: ${passed}`)
