import test from 'node:test'
import assert from 'node:assert/strict'
import { createNativeRoutes } from '../../src/routing/native-routes.mjs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const F = require('../harness/v153-fixture')

const CATALOG = 'upos-sz-mirrorali.bilivideo.com'
const NATIVE = 'upos-hz-mirrorakam.akamaized.net'
const EXCLUDED = 'upos-sz-mirrorcosov.bilivideo.com'
const mediaUrl = host => `https://${host}/upgcxcode/01/23/video.m4s?token=private`

function harness({ excluded = null } = {}) {
    let epoch = 1
    let scheduled = 0
    const deps = {
        gmGet: () => null, gmSet() {}, gmDelete() {},
        TRUSTED_CDN_CATALOG_SET: new Set([CATALOG]),
        parseMediaHttpUrl: value => new URL(value, 'https://www.bilibili.com/'),
        classifyMediaDelivery: () => ({ kind: 'native' }),
        mediaUrlPolicy: { decide: () => ({ action: 'rewrite' }), isMediaPath: path => path.startsWith('/upgcxcode/') },
        normalizeCodecName: () => 'av1', get playinfoEpoch() { return epoch },
        resolvedCdn: null, disabled: false, peekCurrentCdn: () => CATALOG,
        getHealthyCdnList: () => [CATALOG], getRequiredStreamMbps: () => 4,
        getCdnHealthScore: () => 0.3, scoreRouteHealth: () => 0.2,
        replaceUrlHost(value, host) { const parsed = new URL(value); parsed.hostname = host; return parsed.href },
        playbackRateState: { effectiveRate: 2 }, getVideo: () => ({ videoHeight: 1080 }),
        scheduleObservedSample: () => { scheduled++ }, DiagnosticLog: { fault() {} },
        onActiveRepresentation() {}, cdnHealth: {},
        isHostAllowed: host => !!host && host !== excluded,
        noteHostRestriction() {},
    }
    const routes = createNativeRoutes(deps)
    return { routes, deps, get scheduled() { return scheduled }, setEpoch(value) { epoch = value } }
}

function pageGroup(h, host = NATIVE) {
    const item = { height: 1080, bandwidth: 4_000_000, codecs: 'av01.0.08M.08', base_url: mediaUrl(host), backup_url: [] }
    const id = h.routes.registerSignedRouteGroup(item, true, 'video', 'page-hint')
    return { id, item }
}

test('v184 Watchdog recovery affinity overrides an exact pending Native URL until the epoch changes', () => {
    const h = harness()
    pageGroup(h)
    const before = { route: h.routes.captureRouteContext(mediaUrl(NATIVE)), method: 'xhr', httpMethod: 'GET' }
    assert.equal(h.routes.resolveRequestRoute(mediaUrl(NATIVE), before).url, mediaUrl(NATIVE))

    assert.deepEqual(h.routes.beginRouteRecovery('watchdog', null), { type: 'catalog-generated', host: CATALOG })
    const request = { route: h.routes.captureRouteContext(mediaUrl(NATIVE)), method: 'xhr', httpMethod: 'GET' }
    const decision = h.routes.resolveRequestRoute(mediaUrl(NATIVE), request)
    request.routeDecision = { type: decision.type, host: decision.host, changed: decision.url !== mediaUrl(NATIVE) }
    assert.equal(decision.url, mediaUrl(CATALOG))

    assert.equal(h.routes.recordNativeThroughput(request, decision.url, 131072, 100, 2, 'transport').status, 'catalog-observed')
    const diagnostics = h.routes.diagnostics()
    assert.equal(diagnostics.active.height, 1080)
    assert.equal(diagnostics.routeAffinity.type, 'catalog-generated')
    assert.equal(diagnostics.admission.unlockedUrls, 0, 'Catalog success must not unlock the original Native URL')
    assert.equal(diagnostics.admission.catalogVerifiedUrls, 1)
    assert.equal(h.routes.resolveRequestRoute(mediaUrl(NATIVE), {
        route: h.routes.captureRouteContext(mediaUrl(NATIVE)), method: 'xhr', httpMethod: 'GET',
    }).url, mediaUrl(CATALOG), 'the next repeated Range must remain on the recovery route')
})

test('v184 an emitted Catalog URL keeps page representation provenance and becomes active only after completion', () => {
    const h = harness({ excluded: EXCLUDED })
    const { item } = pageGroup(h, EXCLUDED)
    h.routes.applySignedRoutePlan(item, true, h.routes.captureRouteContext(mediaUrl(EXCLUDED)).groupId)
    assert.equal(item.base_url, mediaUrl(CATALOG))

    const context = { route: h.routes.captureRouteContext(item.base_url), method: 'fetch', httpMethod: 'GET' }
    assert.ok(context.route)
    assert.equal(context.route.generated, true)
    assert.equal(h.routes.pageRepresentation(context), null, 'emission alone is not completion evidence')
    assert.equal(h.routes.recordNativeThroughput(context, item.base_url, 131072, 100, 2, 'transport').status, 'catalog-observed')
    assert.equal(h.routes.pageRepresentation(context).kind, 'video')

    const diagnostics = h.routes.diagnostics()
    assert.equal(diagnostics.active.height, 1080)
    assert.equal(diagnostics.currentRouteType, 'catalog-generated')
    assert.equal(diagnostics.admission.catalogVerifiedUrls, 1)
    assert.equal(diagnostics.admission.unlockedUrls, 0)
    assert.equal(h.scheduled, 1)
})

const pagePayload = host => ({ code: 0, data: { dash: { video: [{
    id: 80, height: 1080, width: 1920, bandwidth: 4_000_000,
    codecs: 'av01.0.08M.08', mimeType: 'video/mp4', frameRate: '30',
    base_url: mediaUrl(host), backup_url: [],
}], audio: [] } } })

test('v184 release bundle attributes an excluded page URL after its generated Catalog response completes', async () => {
    const payload = pagePayload(EXCLUDED)
    const h = F.load({ instrument: false, pageGlobals: { __playinfo__: payload },
        fetchImpl: async () => new Response(new Uint8Array(131072), { status: 206 }) })
    F.video(h, 1080).paused = false
    const emitted = payload.data.dash.video[0].base_url
    assert.notEqual(new URL(emitted).hostname, EXCLUDED)
    await F.consume(h, emitted)
    await h.timers.advanceAsync(1000)
    const diagnostics = h.pageWindow.BiliCDN.nativeRouting
    assert.equal(diagnostics.activeRepresentation.height, 1080)
    assert.equal(diagnostics.selectedRouteType, 'catalog-generated')
    assert.equal(diagnostics.admission.catalogVerifiedUrls, 1)
    assert.equal(diagnostics.admission.unlockedUrls, 0)
    assert.equal(h.pageWindow.BiliCDN.mediaDelivery.video.metadataSource, 'page-hint')
})

test('v184 release bundle attributes the real XHR path used by generated Catalog media', async () => {
    const payload = pagePayload(EXCLUDED)
    const h = F.load({ instrument: false, pageGlobals: { __playinfo__: payload } })
    F.video(h, 1080).paused = false
    const emitted = payload.data.dash.video[0].base_url
    const xhr = new h.pageWindow.XMLHttpRequest()
    xhr.open('GET', emitted)
    xhr.send()
    xhr.respond({ status: 206, response: new Uint8Array(131072).buffer, responseURL: emitted })
    await h.timers.advanceAsync(1000)
    const diagnostics = h.pageWindow.BiliCDN.nativeRouting
    assert.equal(diagnostics.activeRepresentation.height, 1080)
    assert.equal(diagnostics.selectedRouteType, 'catalog-generated')
    assert.equal(diagnostics.admission.catalogVerifiedUrls, 1)
    assert.equal(h.pageWindow.BiliCDN.mediaDelivery.video.metadataSource, 'page-hint')
})

test('v184 release bundle makes a no-attribution Watchdog recovery affect the next repeated player request', async () => {
    const payload = pagePayload(NATIVE)
    const h = F.load({ instrument: false, pageGlobals: { __playinfo__: payload },
        fetchImpl: async () => new Response(new Uint8Array(131072), { status: 206 }) })
    const video = F.video(h, 1080)
    video.paused = false
    video.setAhead(0)
    await F.consume(h, mediaUrl(NATIVE))
    await h.timers.advanceAsync(7000)
    await F.consume(h, mediaUrl(NATIVE))
    const playerCalls = h.fetchCalls.filter(call => new URL(call.url).pathname.startsWith('/upgcxcode/')
        && !new Headers(call.init?.headers).has('Range'))
    assert.equal(new URL(playerCalls[0].url).hostname, NATIVE)
    assert.notEqual(new URL(playerCalls.at(-1).url).hostname, NATIVE)
    assert.match(new URL(playerCalls.at(-1).url).hostname, /\.bilivideo\.com$/)
    assert.ok(h.pageWindow.BiliCDN.buffer.switchCount > 0)
})

test('v184 XHR recovery stops reopening the same Native Range after Watchdog chooses Catalog', async () => {
    const payload = pagePayload(NATIVE)
    const h = F.load({ instrument: false, pageGlobals: { __playinfo__: payload } })
    const video = F.video(h, 1080)
    video.paused = false
    video.setAhead(0)
    const first = new h.pageWindow.XMLHttpRequest()
    first.open('GET', mediaUrl(NATIVE))
    first.send()
    first.respond({ status: 206, response: new Uint8Array(131072).buffer, responseURL: mediaUrl(NATIVE) })
    await h.timers.advanceAsync(7000)

    const repeated = new h.pageWindow.XMLHttpRequest()
    repeated.open('GET', mediaUrl(NATIVE))
    assert.notEqual(new URL(repeated.url).hostname, NATIVE)
    assert.match(new URL(repeated.url).hostname, /\.bilivideo\.com$/)
    assert.ok(h.pageWindow.BiliCDN.buffer.switchCount > 0)
})
