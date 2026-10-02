import { PlayurlController } from '../../src-v2/application/playurl-controller.ts'
import { decisionId } from '../../src-v2/domain/model.ts'
import { TRUSTED_CATALOG } from '../../src-v2/domain/catalog.ts'
import { parseMediaUrl } from '../../src-v2/domain/url-policy.ts'
import { SignedRouteVault } from '../../src-v2/state/signed-route-vault.ts'
import { RestrictionStore } from '../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../src-v2/state/evidence-store.ts'
import { SettingsStore } from '../../src-v2/state/settings-store.ts'
import { SessionStore } from '../../src-v2/state/session-store.ts'
import { RouteCoordinator } from '../../src-v2/application/route-coordinator.ts'
import { TransportAdapter } from '../../src-v2/adapters/transport.ts'
import type { AppliedRouteDecision } from '../../src-v2/application/route-coordinator.ts'
import type { TransportObservation } from '../../src-v2/domain/model.ts'
import { PlayurlAdapter } from '../../src-v2/adapters/playurl.ts'
import { PagePlayinfoAdapter } from '../../src-v2/adapters/page-playinfo.ts'

import { check, equal, assertionCount } from '../support/assert.ts'
import { FakeStorage } from '../support/storage.ts'
import { testScope } from '../support/scope.ts'
const scope = testScope()
try {
const now = 2_000_000_000_000
const clock = { now: () => now }
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
const dispatchStorage = new FakeStorage(), dispatchSettings = scope.own(new SettingsStore(dispatchStorage, () => now))
await dispatchSettings.update({ considerNativeSources: true })
const dispatchSession = new SessionStore(), dispatchState = dispatchSession.beginGeneration(false)
const dispatchVault = new SignedRouteVault(); dispatchVault.reset(dispatchState.generation, dispatchState.epoch)
const dispatchEvidence = scope.own(new EvidenceStore(dispatchStorage, () => now))
const dispatchRoutes = new RouteCoordinator(clock, dispatchSession, dispatchSettings,
  scope.own(new RestrictionStore(dispatchStorage, () => now)), dispatchEvidence, dispatchVault)
const dispatchPlayurl = new PlayurlAdapter(new PlayurlController(dispatchSession, dispatchVault, dispatchRoutes, dispatchSettings))
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
const dispatchTransport = scope.own(new TransportAdapter(dispatchSession, dispatchSettings, dispatchRoutes,
  dispatchPlayurl, dispatchMeasurement, () => now))
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

const emittedBackupStorage = new FakeStorage(), emittedBackupSettings = scope.own(new SettingsStore(emittedBackupStorage, () => now))
await emittedBackupSettings.update({ considerNativeSources: true })
const emittedBackupSession = new SessionStore(), emittedBackupState = emittedBackupSession.beginGeneration(false)
const emittedBackupVault = new SignedRouteVault(); emittedBackupVault.reset(emittedBackupState.generation, emittedBackupState.epoch)
const emittedBackupRoutes = new RouteCoordinator(clock, emittedBackupSession, emittedBackupSettings,
  scope.own(new RestrictionStore(emittedBackupStorage, () => now)), scope.own(new EvidenceStore(emittedBackupStorage, () => now)), emittedBackupVault)
const emittedBackupPlayurl = new PlayurlAdapter(new PlayurlController(emittedBackupSession, emittedBackupVault, emittedBackupRoutes, emittedBackupSettings))
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
const emittedBackupTransport = scope.own(new TransportAdapter(emittedBackupSession, emittedBackupSettings, emittedBackupRoutes,
  emittedBackupPlayurl, measurementStub, () => now))
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

const pageStorage = new FakeStorage(), pageSettings = scope.own(new SettingsStore(pageStorage, () => now))
const pageSession = new SessionStore(), pageState = pageSession.beginGeneration(false)
const pageVault = new SignedRouteVault(); pageVault.reset(pageState.generation, pageState.epoch)
const pageRoutes = new RouteCoordinator(clock, pageSession, pageSettings,
  scope.own(new RestrictionStore(pageStorage, () => now)), scope.own(new EvidenceStore(pageStorage, () => now)), pageVault)
const pagePlayurl = new PlayurlAdapter(new PlayurlController(pageSession, pageVault, pageRoutes, pageSettings))
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
const pageInfo = scope.own(new PagePlayinfoAdapter(payload => pagePlayurl.transform(payload, 'page-hint'),
  () => pageRoutes.isCatalogOnly()))
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
const initialPageInfo = scope.own(new PagePlayinfoAdapter(payload => pagePlayurl.transform(payload, 'page-hint'),
  () => pageRoutes.isCatalogOnly()))
initialPageInfo.install()
check(!JSON.stringify(Reflect.get(fakeWindow, '__playinfo__'))?.includes('signature=initial-secret'),
  'Catalog-only installed __playinfo__ getter cannot expose an existing unsupported Native playinfo value')
initialPageInfo.dispose()
Reflect.deleteProperty(fakeWindow, '__playinfo__')
await pageSettings.update({ considerNativeSources: true }); pageRoutes.invalidateForUserSetting()
Object.defineProperty(fakeWindow, '__playinfo__', { configurable: true, writable: true, value: initialUnsupportedPlayinfo })
const nativeOnInitialPageInfo = scope.own(new PagePlayinfoAdapter(payload => pagePlayurl.transform(payload, 'page-hint'),
  () => pageRoutes.isCatalogOnly()))
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
const freshPageInfo = scope.own(new PagePlayinfoAdapter(payload => pagePlayurl.transform(payload, 'page-hint'),
  () => pageRoutes.isCatalogOnly()))
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

const apiFailureStorage = new FakeStorage(), apiFailureSettings = scope.own(new SettingsStore(apiFailureStorage, () => now))
const apiFailureSession = new SessionStore(), apiFailureState = apiFailureSession.beginGeneration(false)
const apiFailureVault = new SignedRouteVault(); apiFailureVault.reset(apiFailureState.generation, apiFailureState.epoch)
const apiFailureRoutes = new RouteCoordinator(clock, apiFailureSession, apiFailureSettings,
  scope.own(new RestrictionStore(apiFailureStorage, () => now)), scope.own(new EvidenceStore(apiFailureStorage, () => now)), apiFailureVault)
const apiFailurePlayurl = new PlayurlAdapter(new PlayurlController(apiFailureSession, apiFailureVault, apiFailureRoutes, apiFailureSettings))
const apiFailureTransport = scope.own(new TransportAdapter(apiFailureSession, apiFailureSettings, apiFailureRoutes,
  apiFailurePlayurl, measurementStub, () => now))
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
const throwingTransport = scope.own(new TransportAdapter(apiFailureSession, apiFailureSettings, apiFailureRoutes,
  throwingPlayurl, measurementStub, () => now))
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

const oversizedStorage = new FakeStorage(), oversizedSettings = scope.own(new SettingsStore(oversizedStorage, () => now))
const oversizedSession = new SessionStore(), oversizedState = oversizedSession.beginGeneration(false)
const oversizedVault = new SignedRouteVault(); oversizedVault.reset(oversizedState.generation, oversizedState.epoch)
const oversizedRoutes = new RouteCoordinator(clock, oversizedSession, oversizedSettings,
  scope.own(new RestrictionStore(oversizedStorage, () => now)), scope.own(new EvidenceStore(oversizedStorage, () => now)), oversizedVault)
const oversizedPlayurl = new PlayurlAdapter(new PlayurlController(oversizedSession, oversizedVault, oversizedRoutes, oversizedSettings))
const oversizedTransport = scope.own(new TransportAdapter(oversizedSession, oversizedSettings, oversizedRoutes,
  oversizedPlayurl, measurementStub, () => now))
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


} finally { scope.dispose() }
console.log('native-transport: ' + assertionCount() + ' assertions')
