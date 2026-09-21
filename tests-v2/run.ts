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
if (liveRep) {
  const plan = coordinator.plan(liveRep, { kind: 'video', requiredMbps: 7.5, highDemand: false }, 'startup')
  equal(plan.host, TRUSTED_CATALOG[0], 'coordinator cold plan uses first available catalog')
  const applied = coordinator.apply(liveVault.rootUrl(liveRep) ?? '')
  equal(applied.decision.action, 'rewrite', 'planned catalog decision is applied')
  check(applied.url?.includes(TRUSTED_CATALOG[0]), 'applied URL uses planned host')
  await coordinator.observe({ generation: state.generation, epoch: state.epoch, decisionId: applied.decision.id,
    representation: liveRep, kind: 'video', routeType: 'catalog-generated', originalHost: applied.sourceHost ?? '',
    targetHost: applied.decision.host ?? '', finalHost: applied.decision.host, streamKey: applied.streamKey,
    status: 403, bytes: 0, ttfbMs: 30, elapsedMs: 60, completedAt: now, outcome: 'failure' })
  const restored = coordinator.apply(applied.url ?? '')
  equal(restored.decision.reason, 'host-locked', '403 host-lock is remembered for the exact stream')
  equal(restored.url, liveVault.rootUrl(liveRep), 'host-lock restores exact root signed URL')
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
  apply(url: string): AppliedRouteDecision { return { ...passDecision, url } },
  async observe(observation: TransportObservation): Promise<void> { observations.push(observation) },
}
let transformed = 0
const playurlStub = { transform(): boolean { transformed++; return true } }
let disabled = false, blockHttpDns = true
const settingsStub = { get: () => ({ disabled, blockHttpDns }) }
let nativeFetchCalls = 0, cancelReason: unknown = null
const nativeFetch = async (input: RequestInfo | URL): Promise<Response> => {
  nativeFetchCalls++
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.includes('/player/wbi/playurl')) return new Response(JSON.stringify({ code: 0, data: { dash: { video: [], audio: [] } } }), { status: 200 })
  let emitted = false
  return new Response(new ReadableStream<Uint8Array>({
    pull(controller) { if (!emitted) { emitted = true; controller.enqueue(new Uint8Array(70 * 1024)) } },
    cancel(reason) { cancelReason = reason },
  }), { status: 206, headers: { 'content-type': 'video/mp4' } })
}

class FakeXhr extends EventTarget {
  method = ''; url = ''; readyState = 0; status = 200; responseURL = ''; responseType: XMLHttpRequestResponseType = ''
  payload: unknown = { ok: true }; nativeSends = 0
  get response(): unknown { return this.payload }
  get responseText(): string { return JSON.stringify(this.payload) }
  open(method: string, url: string | URL): void { this.method = method; this.url = String(url); this.responseURL = this.url; this.readyState = 1 }
  send(): void { this.nativeSends++; this.readyState = 4; this.dispatchEvent(new Event('readystatechange')); this.dispatchEvent(new Event('load')); this.dispatchEvent(new Event('loadend')) }
  abort(): void { this.dispatchEvent(new Event('abort')) }
}

const originalWorker = function WorkerIdentity() { return undefined }
const fakeWindow = { fetch: nativeFetch, XMLHttpRequest: FakeXhr, Worker: originalWorker, navigator: globalThis.navigator }
Object.defineProperty(globalThis, 'unsafeWindow', { configurable: true, value: fakeWindow })
Object.defineProperty(globalThis, 'location', { configurable: true, value: new URL('https://www.bilibili.com/video/BVtest/') })
const transport = new TransportAdapter(runtimeSession, settingsStub as never, routeStub as never, playurlStub as never, () => now)
transport.install()
const mediaResponse = await fakeWindow.fetch(passDecision.url ?? '')
const mediaReader = mediaResponse.body?.getReader()
check(mediaReader, 'fetch wrapper returns a readable body')
await mediaReader?.read()
await mediaReader?.cancel('caller-cancel')
equal(cancelReason, 'caller-cancel', 'fetch cancel reason reaches original reader')
equal(observations.at(-1)?.outcome, 'abort', 'cancel settles as abort once')
const beforeHttpDns = nativeFetchCalls
const blockedDns = await fakeWindow.fetch('https://httpdns.bilivideo.com/resolve')
equal(blockedDns.status, 503, 'HTTPDNS manual block returns local response')
equal(nativeFetchCalls, beforeHttpDns, 'HTTPDNS block performs no native request')
disabled = true
await fakeWindow.fetch('https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/disabled.m4s')
equal(nativeFetchCalls, beforeHttpDns + 1, 'disabled mode passes site fetch through')
disabled = false
const xhr = new FakeXhr()
xhr.responseType = 'json'
xhr.payload = { code: 0, data: { dash: { video: [], audio: [] } } }
xhr.open('GET', 'https://api.bilibili.com/x/player/wbi/playurl')
xhr.send()
void xhr.response
equal(transformed, 1, 'XHR JSON playurl is transformed lazily once')
equal(fakeWindow.Worker, originalWorker, 'Worker constructor identity is untouched')
transport.dispose()

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
equal(challengeCalls, 1, 'safe playback selects one challenger')
equal(challengeFetches, 1, 'safe challenger performs one bounded request')
equal(challengeRecords, 1, 'challenge updates evidence once')

// Observing playback must never override the user's speed selection.
let selectedRate = 1, rateWrites = 0, observedRate = 0
const ratePlayer: PlayerPort = { ...recoveryPlayer,
  snapshot: () => ({ ...playerSnapshot, playbackRate: selectedRate, effectiveRate: selectedRate, currentTime: 50 }),
  playbackRate: () => selectedRate, setRate: () => { rateWrites++ },
}
const rateMonitor = new PlayerMonitor(ratePlayer, session, settings, vault,
  { observePlaybackRate: (rate: number) => { observedRate = rate } } as never,
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

console.log(`v2 domain and controller tests passed: ${passed}`)
