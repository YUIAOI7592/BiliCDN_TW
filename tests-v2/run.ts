import { addEvidenceSample, emptyEvidence, evidenceMetrics } from '../src-v2/domain/evidence.ts'
import { chooseRoute, rankRoutes } from '../src-v2/domain/routing.ts'
import { decisionId, epochId, generationId, representationId } from '../src-v2/domain/model.ts'
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
import type { DomainEvent, TransportObservation } from '../src-v2/domain/model.ts'
import { RecoveryController } from '../src-v2/application/recovery-controller.ts'
import { MeasurementController } from '../src-v2/application/measurement-controller.ts'
import { PlayerMonitor } from '../src-v2/application/player-monitor.ts'
import { PlayerAdapter } from '../src-v2/adapters/player.ts'
import { PlayurlAdapter } from '../src-v2/adapters/playurl.ts'
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
await evidenceStore.record(TRUSTED_CATALOG[0], 'video', { requestId: 'remote-clear', at: now, source: 'transport', outcome: 'success', throughputMbps: 8, ttfbMs: 20, failureKind: null })
check(evidenceStore.get(TRUSTED_CATALOG[0], 'video'), 'evidence store records local result')
storage.remote('bilicdn.v2.routeEvidence', { schema: 2, records: {}, updatedAt: now + 1 })
equal(evidenceStore.get(TRUSTED_CATALOG[0], 'video'), null, 'newer remote clear removes stale evidence')
const legacyOnly = new FakeStorage(); legacyOnly.set('cdnHealth', { poisoned: true }); legacyOnly.set('workerStats_v1', { created: 99 })
const freshSettings = new SettingsStore(legacyOnly, () => now)
equal(freshSettings.get().codec, 'av1', 'v2 settings ignore every v1 key')
equal([...legacyOnly.values.keys()].includes('bilicdn.v2.settings'), false, 'reading defaults does not migrate legacy data')
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
  recognizesMedia(url: string): boolean { return parseMediaUrl(url)?.kind !== 'unknown' },
  inspectOriginal(url: string): AppliedRouteDecision { return this.apply(url) },
  apply(url: string): AppliedRouteDecision { return { ...passDecision, url } },
  async observe(observation: TransportObservation): Promise<void> { observations.push(observation) },
}
let transformed = 0
const playurlStub = { transform(): boolean { transformed++; return true } }
let disabled = false, blockHttpDns = true
const settingsStub = { get: () => ({ disabled, blockHttpDns }) }
let nativeFetchCalls = 0, cancelReason: unknown = null
const nativeFetchUrls: string[] = []
const nativeFetch = async (input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
  nativeFetchCalls++
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  nativeFetchUrls.push(url)
  if (url.includes('/player/wbi/playurl')) return new Response(JSON.stringify({ code: 0, data: { dash: { video: [], audio: [] } } }), { status: 200 })
  let emitted = false
  return new Response(new ReadableStream<Uint8Array>({
    pull(controller) { if (!emitted) { emitted = true; controller.enqueue(new Uint8Array(70 * 1024)) } },
    cancel(reason) { cancelReason = reason },
  }), { status: 206, headers: { 'content-type': 'video/mp4' } })
}

class FakeXhr extends EventTarget {
  method = ''; url = ''; readyState = 0; status = 200; responseURL = ''; responseType: XMLHttpRequestResponseType = ''
  timeout = 0; withCredentials = false
  payload: unknown = { ok: true }; nativeSends = 0
  get response(): unknown { return this.payload }
  get responseText(): string { return JSON.stringify(this.payload) }
  open(method: string, url: string | URL): void { this.method = method; this.url = String(url); this.responseURL = this.url; this.readyState = 1 }
  send(): void { this.nativeSends++; this.readyState = 4; this.dispatchEvent(new Event('readystatechange')); this.dispatchEvent(new Event('load')); this.dispatchEvent(new Event('loadend')) }
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
const requestInput = new Request(gatedUrl, { method: 'GET' })
measurementStub.willGateStartup = () => false
await fakeWindow.fetch(requestInput)
equal(new URL(nativeFetchUrls.at(-1) ?? '').host, TRUSTED_CATALOG[0], 'Fetch Request input dispatch uses the selected host')
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
const stallRoutes = new RouteCoordinator({ now: () => stallNow }, startupSession, new SettingsStore(new FakeStorage(), () => stallNow),
  new RestrictionStore(new FakeStorage(), () => stallNow), new EvidenceStore(new FakeStorage(), () => stallNow), startupVault)
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
}
const deadStartup: VideoSnapshot = { ...playerSnapshot, currentTime: 0, readyState: 0, width: 0, height: 0,
  frames: 0, bufferAheadSec: 0, playableBufferSec: 0, coreInitialized: false, paused: false }
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
    observePlaybackRate: () => undefined } as never,
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
const challengeApplied: AppliedRouteDecision = { decision: { action: 'rewrite', id: decisionId('challenge'), reason: 'test',
  routeType: 'catalog-generated', host: TRUSTED_CATALOG[1], candidate: { type: 'catalog-generated', host: TRUSTED_CATALOG[1], kind: 'video', catalogIndex: 1 }, ranking: [] },
  url: `https://${TRUSTED_CATALOG[1]}/upgcxcode/a/b/challenge.m4s`, context: { generation: generationId(1), epoch: epochId(1), representation: representationId('video:test'), kind: 'video' },
  streamKey: 'challenge', sourceHost: TRUSTED_CATALOG[0] }
const challengeRoutes = { challenge: () => { challengeCalls++; return challengeApplied }, recordChallenge: async () => { challengeRecords++ } }
const challengeFetch = async (): Promise<Response> => { challengeFetches++; return new Response(new Uint8Array(70 * 1024), { status: 206 }) }
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

const preflightOptions = stallRoutes.startupOptions(startupRoot)
check(preflightOptions && preflightOptions.candidates.length >= 2, 'preflight offers original and legal Catalog candidate')
if (preflightOptions) {
  let preflightFetches = 0, committedHost: string | null = null, startupSamples = 0
  const preflightRoutes = { startupOptions: () => preflightOptions,
    commitStartupChoice: (_url: string, candidate: { host: string } | null) => {
      committedHost = candidate?.host ?? null
      return candidate ? { host: candidate.host } : null
    }, recordStartupSuccess: async () => { startupSamples++ }, noteStartupProbeResult: () => undefined }
  const preflightFetch = async (input: RequestInfo | URL): Promise<Response> => {
    preflightFetches++
    const host = new URL(String(input)).host
    const length = host === preflightOptions.candidates.find(candidate => candidate.type === 'catalog-generated')?.host ? 256 * 1024 : 70 * 1024
    return new Response(new Uint8Array(length), { status: 206 })
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
    return new Response(new Uint8Array(host === cachedHost ? 16 * 1024 : 70 * 1024), { status: 206 })
  }
  const cachedPreflight = new MeasurementController({ ...preflightRoutes, startupOptions: () => cachedOptions } as never,
    new FakeStorage(), compatibilityFetch as typeof fetch, () => now)
  await cachedPreflight.prepareStartup(startupRoot)
  equal(ranges.get(cachedHost ?? ''), 'bytes=0-16383', 'cross-tab Catalog evidence requires only a 16 KiB current-URL compatibility range')
  equal(committedHost, cachedHost, 'compatible recent Catalog sample can win without redownloading a full throughput sample')
}

// Observing playback must never override the user's speed selection.
let selectedRate = 1, rateWrites = 0, observedRate = 0
const ratePlayer: PlayerPort = { ...recoveryPlayer,
  snapshot: () => ({ ...playerSnapshot, playbackRate: selectedRate, effectiveRate: selectedRate, currentTime: 50 }),
  playbackRate: () => selectedRate, setRate: () => { rateWrites++ },
}
const rateMonitor = new PlayerMonitor(ratePlayer, session, settings, vault,
  { observePlaybackRate: (rate: number) => { observedRate = rate }, firstMediaAt: () => 0 } as never,
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

let shortResumeNow = now
const shortResume = new RecoveryController(recoveryPlayer, () => shortResumeNow)
shortResume.tick({ ...playerSnapshot, paused: false })
shortResumeNow += 1000; shortResume.tick({ ...playerSnapshot, paused: true })
shortResumeNow += 1000; shortResume.tick({ ...playerSnapshot, paused: false, frames: 100 })
equal(shortResume.snapshot().state, 'healthy', 'normal short resume clears pause-armed diagnostic state')

console.log(`v2 domain and controller tests passed: ${passed}`)
