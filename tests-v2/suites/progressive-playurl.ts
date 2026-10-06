import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PlayurlAdapter } from '../../src-v2/adapters/playurl.ts'
import { PlayurlController } from '../../src-v2/application/playurl-controller.ts'
import { RouteCoordinator } from '../../src-v2/application/route-coordinator.ts'
import { isCatalogHost, TRUSTED_CATALOG } from '../../src-v2/domain/catalog.ts'
import { EvidenceStore } from '../../src-v2/state/evidence-store.ts'
import { RestrictionStore } from '../../src-v2/state/restriction-store.ts'
import { SessionStore } from '../../src-v2/state/session-store.ts'
import { SettingsStore } from '../../src-v2/state/settings-store.ts'
import { SignedRouteVault } from '../../src-v2/state/signed-route-vault.ts'
import { testScope } from '../support/scope.ts'
import { FakeStorage } from '../support/storage.ts'
type TestScope = ReturnType<typeof testScope>
const now = 2_000_000_000_000
const media = (name: string, host = 'upos-hz-mirrorakam.akamaized.net'): string =>
  `https://${host}/upgcxcode/progressive-fixture/${name}?fixture=synthetic`
interface Segment {
  order?: number
  length: number
  size: number
  url: string
  backup_url: string[]
}
const segment = (name: string, order?: number, extension = 'mp4'): Segment => ({
  ...(order === undefined ? {} : { order }), length: 1000, size: 8192,
  url: media(`${name}.${extension}`), backup_url: [],
})
const dashItem = (name: string, kind: 'video' | 'audio' = 'video') => ({
  id: kind === 'video' ? 80 : 30280, height: kind === 'video' ? 1080 : 0,
  bandwidth: kind === 'video' ? 4_000_000 : 192_000, codecs: 'avc1.640028',
  base_url: media(`${name}.m4s`), backup_url: [] as string[],
})
const catalogURLs = (urls: readonly string[], message: string): void => {
  assert.ok(urls.length > 0 && urls.every(url => !!url && isCatalogHost(new URL(url).hostname)), message)
}
const segmentMetadata = (items: readonly Segment[]): string => JSON.stringify(items.map(({ order, length, size }) => ({ order, length, size })))
const fixture = (scope: TestScope) => {
  const storage = new FakeStorage(), session = new SessionStore(), vault = new SignedRouteVault()
  const state = session.beginGeneration(false)
  vault.reset(state.generation, state.epoch)
  const settings = scope.own(new SettingsStore(storage, () => now))
  const restrictions = scope.own(new RestrictionStore(storage, () => now))
  const evidence = scope.own(new EvidenceStore(storage, () => now))
  const routes = new RouteCoordinator({ now: () => now }, session, settings, restrictions, evidence, vault)
  const adapter = new PlayurlAdapter(new PlayurlController(session, vault, routes, settings))
  return { adapter, storage, session, vault, settings, restrictions, evidence, routes }
}
test("HTTP 200/code 0 MP4 durl is accepted [1]", { timeout: 5000 }, async t => {
 const scope=testScope(t)
{
    const context = fixture(scope)
    const original = segment('single', 1)
    const payload = { code: 0, data: { format: 'mp4', durl: [original] } }
    const result = context.adapter.transform(payload)
    assert.strictEqual(result.accepted, true, 'HTTP 200/code 0 MP4 durl is accepted')
    assert.strictEqual(result.upstreamCode, 0, 'successful upstream code is retained')
    assert.strictEqual(JSON.stringify(result.formats), JSON.stringify(['mp4']), 'MP4 format is reported')
    assert.strictEqual(result.videoCount, 1, 'a progressive segment counts as a video representation')
    assert.strictEqual(result.audioCount, 0, 'MP4 creates no synthetic audio representation')
    assert.strictEqual(result.segmentCount, 1, 'MP4 segment count is reported')
    catalogURLs([original.url, ...original.backup_url], 'Catalog-only MP4 rewrites every playback URL to Catalog')
    const attribution = context.vault.match(original.url)
    assert.strictEqual(attribution.status, 'matched', 'rewritten progressive primary remains attributable')
    assert.strictEqual(attribution.context?.kind, 'video', 'progressive primary is attributed to video')
    assert.ok(!JSON.stringify([...context.storage.values.values()]).includes('progressive-fixture'), 'signed progressive URLs are not persisted')
  }
})
test("multi-segment FLV is accepted [2]", { timeout: 5000 }, async t => {
 const scope=testScope(t)
{
    const context = fixture(scope)
    const first = segment('flv-first', 3, 'flv'), second = segment('flv-second', 1, 'flv'), third = segment('flv-third', 2, 'flv')
    first.length = 2200; second.size = 27000
    const payload = { code: 0, result: { format: 'flv', durl: [first, second, third] } }
    const metadata = segmentMetadata(payload.result.durl)
    const references = [...payload.result.durl]
    const result = context.adapter.transform(payload)
    assert.strictEqual(result.accepted, true, 'multi-segment FLV is accepted')
    assert.strictEqual(JSON.stringify(result.formats), JSON.stringify(['flv']), 'FLV format is reported')
    assert.strictEqual(result.videoCount, 3, 'each FLV segment has a video group')
    assert.strictEqual(result.audioCount, 0, 'FLV creates no synthetic audio group')
    assert.strictEqual(result.segmentCount, 3, 'FLV segment count is complete')
    assert.strictEqual(segmentMetadata(payload.result.durl), metadata, 'segment order, length and size remain unchanged')
    assert.ok(payload.result.durl.every((item, index) => item === references[index]), 'segment object order is immutable')
    const identities = payload.result.durl.map(item => context.vault.match(item.url).context)
    assert.ok(identities.every(identity => identity?.kind === 'video'), 'all FLV groups are video groups')
    assert.strictEqual(new Set(identities.map(identity => identity?.representation)).size, 3, 'FLV segments have separate representation identities')
    for (const item of payload.result.durl) catalogURLs([item.url, ...item.backup_url], 'every FLV segment output is Catalog-only')
  }
})
for (const order of [undefined, 1]) {
test("missing or duplicate order is accepted without merging segments [3]" + " / " + String(order), { timeout: 5000 }, async t => {
 const scope=testScope(t)
{
    const context = fixture(scope)
    const firstSegment = segment(`order-${String(order)}-first`, order), secondSegment = segment(`order-${String(order)}-second`, order)
    const payload = { code: 0, data: { format: 'mp4', durl: [firstSegment, secondSegment] } }
    const result = context.adapter.transform(payload)
    assert.strictEqual(result.accepted, true, 'missing or duplicate order is accepted without merging segments')
    const first = context.vault.match(firstSegment.url).context
    const second = context.vault.match(secondSegment.url).context
    assert.ok(first && second && first.representation !== second.representation, 'array position distinguishes missing or duplicate order values')
  }
})
}
test("mixed data/result/video_info DASH and durl are accepted together [4]", { timeout: 5000 }, async t => {
 const scope=testScope(t)
{
    const context = fixture(scope)
    const mp4 = segment('mixed-mp4', 1), flv = segment('mixed-flv', 1, 'flv')
    const video = dashItem('mixed-video'), audio = dashItem('mixed-audio', 'audio')
    const nestedVideo = dashItem('mixed-nested-video'), nestedAudio = dashItem('mixed-nested-audio', 'audio')
    const payload = { code: 0,
      data: { format: 'mp4', dash: { video: [video], audio: [audio] }, durl: [mp4] },
      result: { video_info: { format: 'flv', dash: { video: [nestedVideo], audio: [nestedAudio] }, durl: [flv] } },
    }
    const result = context.adapter.transform(payload)
    assert.strictEqual(result.accepted, true, 'mixed data/result/video_info DASH and durl are accepted together')
    assert.strictEqual([...result.formats].sort().join(','), 'dash,flv,mp4', 'mixed formats are reported once each')
    assert.strictEqual(result.videoCount, 4, 'mixed video count includes DASH and progressive groups')
    assert.strictEqual(result.audioCount, 2, 'mixed audio count includes only DASH audio groups')
    assert.strictEqual(result.segmentCount, 2, 'mixed progressive segment count is complete')
    for (const item of [video, audio, nestedVideo, nestedAudio])
      catalogURLs([item.base_url, ...item.backup_url], 'all DASH URLs across wrappers are rewritten')
    for (const item of [mp4, flv]) catalogURLs([item.url, ...item.backup_url], 'all progressive URLs across wrappers are rewritten')
    const videoGroups = [video, nestedVideo].map(item => context.vault.match(item.base_url).context?.representation)
    assert.strictEqual(new Set(videoGroups).size, 2, 'equal DASH ids in different wrappers do not collapse representations')
  }
})
test("otherwise valid payload without an upstream code is accepted [5]", { timeout: 5000 }, async t => {
 const scope=testScope(t)
{
    const context = fixture(scope)
    const payload = { data: { format: 'mp4', durl: [segment('no-upstream-code', 1)] } }
    const result = context.adapter.transform(payload)
    assert.strictEqual(result.accepted, true, 'otherwise valid payload without an upstream code is accepted')
    assert.strictEqual(result.upstreamCode, null, 'missing upstream code is explicitly null')
  }
})
test("optional null DASH, Dolby and FLAC audio do not reject playable media [6]", { timeout: 5000 }, async t => {
 const scope=testScope(t)
{
    const context = fixture(scope)
    const video = dashItem('null-audio-video'), item = segment('null-audio-progressive', 1)
    const payload = { code: 0, data: { format: 'mp4', durl: [item], dash: {
      video: [video], audio: null, dolby: { audio: null }, flac: { audio: null },
    } } }
    const result = context.adapter.transform(payload)
    assert.strictEqual(result.accepted, true, 'optional null DASH, Dolby and FLAC audio do not reject playable media')
    assert.strictEqual(result.audioCount, 0, 'optional null audio creates no audio representation')
    assert.strictEqual(result.videoCount, 2, 'optional null audio preserves DASH and progressive video groups')
    catalogURLs([video.base_url, ...video.backup_url, item.url, ...item.backup_url], 'video URLs are rewritten with optional null audio')
    assert.strictEqual(payload.data.dash.audio, null, 'null DASH audio metadata is preserved')
    assert.strictEqual(payload.data.dash.dolby.audio, null, 'null Dolby audio metadata is preserved')
    assert.strictEqual(payload.data.dash.flac.audio, null, 'null FLAC audio metadata is preserved')
  }
})
test("required durl null is malformed even with valid DASH data [7]", { timeout: 5000 }, async t => {
 const scope=testScope(t)
{
    const context = fixture(scope)
    const payload = { code: 0, data: { format: 'mp4', dash: { video: [dashItem('required-durl-null')], audio: [] }, durl: null } }
    const before = JSON.stringify(payload), result = context.adapter.transform(payload)
    assert.strictEqual(result.accepted, false, 'required durl null is malformed even with valid DASH data')
    assert.strictEqual(result.reason, 'malformed-payload', 'required null durl reports malformed payload')
    assert.strictEqual(JSON.stringify(payload), before, 'required null durl rejection leaves mixed payload unchanged')
  }
})
test("nonzero upstream code prevents rewriting [8]", { timeout: 5000 }, async t => {
 const scope=testScope(t)
{
    const context = fixture(scope)
    const payload = { code: -404, message: 'synthetic upstream failure', data: { format: 'mp4', durl: [segment('upstream-error', 1)] } }
    const before = JSON.stringify(payload), result = context.adapter.transform(payload)
    assert.strictEqual(result.accepted, false, 'nonzero upstream code prevents rewriting')
    assert.strictEqual(result.reason, 'upstream-error', 'nonzero upstream code has an explicit rejection reason')
    assert.strictEqual(result.upstreamCode, -404, 'upstream failure code is retained')
    assert.strictEqual(JSON.stringify(payload), before, 'upstream failure payload is unchanged')
  }
})
test("unsupported progressive format is rejected [9]", { timeout: 5000 }, async t => {
 const scope=testScope(t)
{
    const context = fixture(scope)
    const payload = { code: 0, data: { format: 'm3u8', durl: [{ ...segment('unsupported', 1), url: media('unsupported.m3u8') }] } }
    const before = JSON.stringify(payload), result = context.adapter.transform(payload)
    assert.strictEqual(result.accepted, false, 'unsupported progressive format is rejected')
    assert.strictEqual(result.reason, 'unsupported-format', 'unsupported format has a bounded reason')
    assert.strictEqual(JSON.stringify(payload), before, 'unsupported payload is unchanged')
  }
})
test("a bad middle segment rejects the complete mixed payload [10]", { timeout: 5000 }, async t => {
 const scope=testScope(t)
{
    const context = fixture(scope)
    const avc = dashItem('atomic-avc'), av1 = { ...dashItem('atomic-av1'), codecs: 'av01.0.08M.08' }
    const payload = { code: 0, data: { format: 'mp4', dash: { video: [avc, av1], audio: [] }, durl: [
      segment('atomic-first', 1), { ...segment('atomic-bad', 2), url: 7 }, segment('atomic-last', 3),
    ] } }
    const before = JSON.stringify(payload), result = context.adapter.transform(payload)
    assert.strictEqual(result.accepted, false, 'a bad middle segment rejects the complete mixed payload')
    assert.strictEqual(result.reason, 'malformed-payload', 'invalid segment field has a bounded malformed reason')
    assert.strictEqual(JSON.stringify(payload), before, 'bad middle segment causes no URL or codec-order mutation')
    assert.strictEqual(payload.data.dash.video[0], avc, 'rejected payload retains its original first codec object')
  }
})
test("unreplaceable middle segment rejects the complete payload [11]", { timeout: 5000 }, async t => {
 const scope=testScope(t)
{
    const context = fixture(scope)
    const unreplaceable = { ...segment('unreplaceable-middle', 2), url: 'https://upos-hz-mirrorakam.akamaized.net/v1/resource/synthetic.mp4' }
    const payload = { code: 0, data: { format: 'mp4', durl: [segment('legal-first', 1), unreplaceable, segment('legal-last', 3)] } }
    const before = JSON.stringify(payload), result = context.adapter.transform(payload)
    assert.strictEqual(result.accepted, false, 'unreplaceable middle segment rejects the complete payload')
    assert.strictEqual(result.reason, 'unreplaceable-source', 'unreplaceable segment reports its reason')
    assert.strictEqual(JSON.stringify(payload), before, 'unreplaceable middle segment causes no partial mutation')
  }
})
test("129 progressive groups exceed the per-payload limit [12]", { timeout: 5000 }, async t => {
 const scope=testScope(t)
{
    const context = fixture(scope)
    const payload = { code: 0, data: { format: 'mp4', durl: Array.from({ length: 129 }, (_, index) => segment(`cap-${index}`, index + 1)) } }
    const before = JSON.stringify(payload), result = context.adapter.transform(payload)
    assert.strictEqual(result.accepted, false, '129 progressive groups exceed the per-payload limit')
    assert.strictEqual(result.reason, 'malformed-payload', 'excessive segment count is a malformed payload')
    assert.strictEqual(JSON.stringify(payload), before, 'segment cap rejection leaves the complete payload unchanged')
  }
})
test("no legal Catalog route rejects progressive output [13]", { timeout: 5000 }, async t => {
 const scope=testScope(t)
{
    const context = fixture(scope)
    await context.settings.update({ catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map(host => [host, false])) })
    const payload = { code: 0, data: { format: 'mp4', durl: [segment('no-route', 1)] } }
    const before = JSON.stringify(payload), result = context.adapter.transform(payload)
    assert.strictEqual(result.accepted, false, 'no legal Catalog route rejects progressive output')
    assert.strictEqual(result.reason, 'no-legal-route', 'no legal route has an explicit rejection reason')
    assert.strictEqual(JSON.stringify(payload), before, 'no-route rejection does not clear or partially rewrite fields')
  }
})
test("a legal same-segment backup supplies Catalog materialization [14]", { timeout: 5000 }, async t => {
 const scope=testScope(t)
{
    const context = fixture(scope)
    const legalBackup = media('promoted-backup.mp4')
    const item = { ...segment('promoted-root', 1), url: 'https://upos-hz-mirrorakam.akamaized.net/v1/resource/promoted-root.mp4', backup_url: [legalBackup] }
    const payload = { code: 0, data: { format: 'mp4', durl: [item] } }
    const result = context.adapter.transform(payload)
    assert.strictEqual(result.accepted, true, 'a legal same-segment backup supplies Catalog materialization')
    catalogURLs([item.url, ...item.backup_url], 'promoted backup produces only Catalog output')
    assert.strictEqual(new URL(item.url).pathname, new URL(legalBackup).pathname, 'promoted output retains the legal backup path')
    assert.strictEqual(new URL(item.url).search, new URL(legalBackup).search, 'promoted output retains the legal backup query')
    assert.strictEqual(context.vault.match(item.url).context?.kind, 'video', 'promoted backup remains in a video group')
  }
})
for (const comparison of [false, true]) {
test("Native or original-comparison mode accepts progressive data [15]" + " / " + String(comparison), { timeout: 5000 }, async t => {
 const scope=testScope(t)
{
    const context = fixture(scope)
    await context.settings.update({ considerNativeSources: !comparison })
    context.routes.setOriginalComparison(comparison)
    const primary = media('native-limit.mp4', 'fixture-native-0.bilivideo.com')
    const excluded = media('native-limit.mp4', 'fixture-native-4.bilivideo.com')
    const originals = Array.from({ length: 5 }, (_, index) => media('native-limit.mp4', `fixture-native-${index}.bilivideo.com`))
    const item = { ...segment('native-limit', 1), url: primary, backup_url: originals.slice(1) }
    const payload = { code: 0, data: { format: 'mp4', durl: [item] } }
    const result = context.adapter.transform(payload)
    assert.strictEqual(result.accepted, true, 'Native or original-comparison mode accepts progressive data')
    const identity = context.vault.match(primary).context
    assert.ok(identity, 'the original progressive source has an identity')
    if (!identity) throw new Error('Missing progressive Native identity')
    assert.strictEqual(context.vault.groupSummary(identity.representation)?.routeCount, 4, 'Native selection authority has at most four exact sources')
    const candidates = context.vault.candidates(identity.representation, new Set())
    const resolved = candidates.native.map(candidate => context.vault.resolve(candidate.handle, identity))
    assert.ok(resolved.every(url => url !== null && originals.slice(0, 4).includes(url)), 'every Native candidate resolves to an authorized original source')
    assert.ok(!resolved.includes(excluded), 'fifth source receives no Native selection authority')
    if (comparison) {
      assert.ok([item.url, ...item.backup_url].every(url => originals.slice(0, 4).includes(url)), 'original comparison emits only exact authorized original sources')
      assert.strictEqual(item.url, primary, 'original comparison retains the exact primary source')
    }
  }
})
}
test("initial progressive response is accepted [16]", { timeout: 5000 }, async t => {
 const scope=testScope(t)
{
    const context = fixture(scope)
    const original = media('repeat-original.mp4'), injected = media('repeat-injected.mp4')
    const item = { ...segment('repeat-original', 1), backup_url: [media('repeat-backup.mp4')] }
    const payload = { code: 0, data: { format: 'mp4', durl: [item] } }
    assert.strictEqual(context.adapter.transform(payload).accepted, true, 'initial progressive response is accepted')
    const identity = context.vault.match(original).context
    assert.ok(identity, 'initial progressive source has an identity for repeated processing')
    if (!identity) throw new Error('Missing repeated progressive identity')
    const sources = JSON.stringify(context.vault.sourceURLs(identity.representation))
    assert.strictEqual(context.adapter.transform(payload).accepted, true, 'same progressive payload can be processed repeatedly')
    item.url = injected; item.backup_url = [injected]
    assert.strictEqual(context.adapter.transform(payload).accepted, true, 'repeated trusted object is sanitized through its recorded identity')
    assert.strictEqual(new URL(item.url).pathname, new URL(original).pathname, 'repeated payload uses its original authorized source path')
    catalogURLs([item.url, ...item.backup_url], 'repeated payload remains Catalog-only')
    assert.strictEqual(JSON.stringify(context.vault.sourceURLs(identity.representation)), sources, 'repeated processing cannot add page-edited sources to Native authority')
    assert.ok(context.vault.match(injected).source !== 'exact', 'injected source receives no exact attribution')
  }
})
test("page hint can provisionally register a progressive segment [17]", { timeout: 5000 }, async t => {
 const scope=testScope(t)
{
    const context = fixture(scope)
    const primary = media('promotion-shared.mp4'), provisional = media('promotion-provisional.mp4'), authoritative = media('promotion-authoritative.mp4')
    const pageItem = { ...segment('promotion-shared', 1), backup_url: [provisional] }
    const page = { code: 0, data: { format: 'mp4', durl: [pageItem] } }
    assert.strictEqual(context.adapter.transform(page, 'page-hint').accepted, true, 'page hint can provisionally register a progressive segment')
    const provisionalIdentity = context.vault.match(primary).context
    assert.ok(provisionalIdentity, 'page hint creates a provisional identity')
    if (!provisionalIdentity) throw new Error('Missing provisional progressive identity')
    const trusted = { code: 0, data: { format: 'mp4', durl: [{ ...segment('promotion-shared', 1), backup_url: [authoritative] }] } }
    assert.strictEqual(context.adapter.transform(trusted).accepted, true, 'trusted progressive response promotes the provisional group')
    const identity = context.vault.match(primary).context
    assert.ok(identity, 'trusted promotion retains a current identity')
    if (!identity) throw new Error('Missing promoted progressive identity')
    assert.strictEqual(context.vault.source(identity.representation), 'trusted-api', 'progressive source becomes authoritative')
    assert.ok(!context.vault.isCurrentIdentity(provisionalIdentity), 'trusted promotion revokes the old authority revision')
    assert.strictEqual(JSON.stringify(context.vault.sourceURLs(identity.representation)), JSON.stringify([primary, authoritative]), 'trusted promotion retains only exact trusted sources')
    assert.ok(context.vault.match(provisional).source !== 'exact', 'provisional backup loses exact authority')
    pageItem.url = provisional; pageItem.backup_url = [provisional]
    assert.strictEqual(context.adapter.transform(page, 'page-hint').accepted, true, 'repeated page hint uses promoted progressive authority')
    assert.strictEqual(new URL(pageItem.url).pathname, new URL(primary).pathname, 'page hint cannot restore the revoked provisional path')
    assert.strictEqual(JSON.stringify(context.vault.sourceURLs(identity.representation)), JSON.stringify([primary, authoritative]), 'repeated page hint cannot extend trusted source authority')
  }
})
test("first SPA progressive content is accepted [18]", { timeout: 5000 }, async t => {
 const scope=testScope(t)
{
    const context = fixture(scope)
    const oldSource = media('spa-old.mp4'), nextSource = media('spa-new.mp4').replace('/progressive-fixture/', '/progressive-next/')
    const oldItem = segment('spa-old', 1), nextItem = { ...segment('spa-new', 1), url: nextSource }
    const oldPayload = { code: 0, data: { format: 'mp4', durl: [oldItem] } }
    assert.strictEqual(context.adapter.transform(oldPayload).accepted, true, 'first SPA progressive content is accepted')
    const oldIdentity = context.vault.match(oldSource).context
    assert.ok(oldIdentity, 'first SPA content has an identity')
    if (!oldIdentity) throw new Error('Missing old SPA progressive identity')
    const priorEpoch = context.session.get().epoch
    assert.strictEqual(context.adapter.transform({ code: 0, data: { format: 'mp4', durl: [nextItem] } }).accepted, true, 'new SPA content is accepted')
    assert.ok(context.session.get().epoch !== priorEpoch, 'new progressive content directory advances the epoch')
    assert.ok(!context.vault.isCurrentIdentity(oldIdentity), 'SPA epoch switch revokes the old identity')
    assert.ok(context.vault.match(oldSource).source !== 'exact', 'SPA epoch switch removes old exact source authority')
    const oldBefore = JSON.stringify(oldPayload)
    assert.strictEqual(context.adapter.transform(oldPayload).accepted, false, 'old cached payload cannot restore a prior epoch')
    assert.strictEqual(JSON.stringify(oldPayload), oldBefore, 'rejected prior-epoch payload remains unchanged')
    const nextState = context.session.beginGeneration(false)
    context.vault.reset(nextState.generation, nextState.epoch); context.routes.resetEpoch()
    const fresh = { code: 0, data: { format: 'mp4', durl: [segment('fresh-generation', 1)] } }
    assert.strictEqual(context.adapter.transform(fresh).accepted, true, 'fresh progressive response is admitted after a generation reset')
  }
})
for (const occupied of [127, 128]) {
test("capacity fixture fills existing video groups successfully [19]" + " / " + String(occupied), { timeout: 5000 }, async t => {
 const scope=testScope(t)
{
    const context = fixture(scope), state = context.session.get()
    const seeded = Array.from({ length: occupied }, (_, index) => context.vault.register({
      generation: state.generation, epoch: state.epoch, kind: 'video', key: `occupied:${index}`,
      height: 0, codec: 'mp4', bandwidth: 0, urls: [media(`occupied-${index}.mp4`)], source: 'trusted-api',
    }))
    assert.ok(seeded.every(Boolean), 'capacity fixture fills existing video groups successfully')
    const payload = { code: 0, data: { format: 'mp4', durl: [segment('capacity-first', 1), segment('capacity-second', 2)] } }
    const before = JSON.stringify(payload), result = context.adapter.transform(payload)
    assert.strictEqual(result.accepted, false, 'existing vault capacity prevents incomplete progressive admission')
    assert.strictEqual(result.reason, 'no-legal-route', 'existing vault capacity reports unavailable routing')
    assert.strictEqual(JSON.stringify(payload), before, 'vault exhaustion leaves all progressive segments unchanged')
  }
})
}
test("progressive URL aliases are sanitized together [20]", { timeout: 5000 }, async t => {
 const scope=testScope(t)
{
    const context = fixture(scope)
    const item = { ...segment('alias-source', 1), baseUrl: media('alias-extra.mp4'), base_url: media('alias-extra-snake.mp4'),
      backupUrl: [media('alias-camel.mp4'), 'javascript:synthetic-invalid'], backup_url: [media('alias-snake.mp4')] }
    const payload = { code: 0, data: { format: 'mp4', durl: [item] } }
    assert.strictEqual(context.adapter.transform(payload).accepted, true, 'progressive URL aliases are sanitized together')
    catalogURLs([item.url, item.baseUrl, item.base_url, ...item.backupUrl, ...item.backup_url], 'every existing progressive URL alias is Catalog-only')
    assert.strictEqual(item.baseUrl, item.url, 'camel primary alias matches progressive output')
    assert.strictEqual(item.base_url, item.url, 'snake primary alias matches progressive output')
    assert.strictEqual(JSON.stringify(item.backupUrl), JSON.stringify(item.backup_url), 'backup aliases receive identical sanitized output')
  }
})
for (const alias of ['backupUrl', 'backup_url'] as const) {
test("malformed progressive backup alias rejects every payload branch [21]" + " / " + String(alias), { timeout: 5000 }, async t => {
 const scope=testScope(t)
{
    const context = fixture(scope)
    const item = { ...segment(`malformed-${alias}`, 1), [alias]: 'invalid-array' }
    const payload = { code: 0, data: { format: 'mp4', durl: [segment('valid-branch', 1)] },
      result: { video_info: { format: 'mp4', dash: { video: [dashItem('mixed-invalid-backup')], audio: [] }, durl: [item] } } }
    const before = JSON.stringify(payload), result = context.adapter.transform(payload)
    assert.strictEqual(result.accepted, false, 'malformed progressive backup alias rejects every payload branch')
    assert.strictEqual(result.reason, 'malformed-payload', 'malformed progressive backup alias has an explicit reason')
    assert.strictEqual(JSON.stringify(payload), before, 'malformed alias causes no partial mutation across data/result/video_info')
  }
})
}
test("fifth raw source cannot supply Catalog authority beyond the four-source limit [22]", { timeout: 5000 }, async t => {
 const scope=testScope(t)
{
    const context = fixture(scope)
    const item = { ...segment('fifth-source', 1), url: 'https://upos-hz-mirrorakam.akamaized.net/v1/resource/first.mp4',
      backup_url: [1, 2, 3].map(index => `https://upos-hz-mirrorakam.akamaized.net/v1/resource/unreplaceable-${index}.mp4`).concat(media('fifth-legal.mp4')) }
    const payload = { code: 0, data: { format: 'mp4', durl: [item] } }
    const before = JSON.stringify(payload), result = context.adapter.transform(payload)
    assert.strictEqual(result.accepted, false, 'fifth raw source cannot supply Catalog authority beyond the four-source limit')
    assert.strictEqual(JSON.stringify(payload), before, 'source-cap rejection leaves progressive payload unchanged')
  }
})
test("disabled application does not admit progressive data [23]", { timeout: 5000 }, async t => {
 const scope=testScope(t)
{
    const context = fixture(scope)
    await context.settings.update({ disabled: true })
    context.session.beginGeneration(true)
    const payload = { code: 0, data: { format: 'mp4', durl: [segment('disabled', 1)] } }
    const before = JSON.stringify(payload), result = context.adapter.transform(payload)
    assert.strictEqual(result.accepted, false, 'disabled application does not admit progressive data')
    assert.strictEqual(result.reason, 'inactive', 'disabled progressive rewrite reports inactive')
    assert.strictEqual(JSON.stringify(payload), before, 'disabled application leaves progressive payload untouched')
  }
})
