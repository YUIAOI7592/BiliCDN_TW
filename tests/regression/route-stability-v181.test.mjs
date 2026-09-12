import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createNativeRoutes } from '../../src/routing/native-routes.mjs'

const require = createRequire(import.meta.url)
const { loadUserscript } = require('../harness/userscript-vm')
const target = require('../harness/current-script')

const CATALOG = 'upos-sz-mirrorali.bilivideo.com'
const AKAMAI = 'upos-hz-mirrorakam.akamaized.net'
const api = 'https://api.bilibili.com/x/player/wbi/playurl?bvid=BVroute181'
const signed = (host, name = 'video') => `https://${host}/upgcxcode/01/23/${name}.m4s?deadline=999&token=secret`

function payload() {
    return { code: 0, data: { dash: {
        video: [{ id: 80, height: 1080, width: 1920, bandwidth: 4_000_000,
            codecs: 'av01.0.08M.08', mimeType: 'video/mp4', frameRate: '30',
            base_url: signed(CATALOG), backup_url: [signed(AKAMAI)] }],
        audio: [],
    } } }
}

function makeHarness() {
    let epoch = 7
    const activations = []
    const deps = {
        gmGet: () => null, gmSet() {}, gmDelete() {},
        TRUSTED_CDN_CATALOG_SET: new Set([CATALOG]),
        parseMediaHttpUrl: value => { try { return new URL(value, 'https://www.bilibili.com/video/BV1') } catch { return null } },
        classifyMediaDelivery: value => ({ kind: 'native', host: new URL(value).hostname }),
        mediaUrlPolicy: {
            decide: () => ({ action: 'rewrite', reason: 'media' }),
            isMediaPath: path => path.startsWith('/upgcxcode/'),
        },
        isMediaSegmentUrl: value => new URL(value).pathname.startsWith('/upgcxcode/'),
        normalizeCodecName: item => item.codecs?.startsWith('av01') ? 'av1' : 'hevc',
        get playinfoEpoch() { return epoch },
        resolvedCdn: null, disabled: false,
        peekCurrentCdn: () => CATALOG,
        getRequiredStreamMbps: () => 4,
        getCdnHealthScore: () => 0.3,
        scoreRouteHealth: record => Math.min(1, (record?.ewmaMbps || 0) / 8),
        replaceUrlHost: (value, host) => { const url = new URL(value); url.hostname = host; return url.href },
        cdnHealth: { [CATALOG]: { ewmaMbps: 10, samples: 3, lastThroughputAt: Date.now() } },
        playbackRateState: { effectiveRate: 2 },
        getVideo: () => ({ videoHeight: 1080 }),
        DiagnosticLog: { fault() {} },
        onActiveRepresentation: (...args) => activations.push(args),
    }
    return { routes: createNativeRoutes(deps), deps, activations, setEpoch(value) { epoch = value } }
}

test('v180 reproduction: representation transition is wired directly to Watchdog CDN-switch handling', () => {
    const source = readFileSync('Release/v1.8.0/v1.7.0_to_v1.8.0.patch.diff', 'utf8')
    assert.match(source, /transition\?\.switched[\s\S]{0,100}Watchdog\.noteCdnSwitched/)
    const current = readFileSync('src/main.mjs', 'utf8')
    assert.doesNotMatch(current, /transition\?\.switched[\s\S]{0,100}Watchdog\.noteCdnSwitched/)
})

test('v181 a same-height codec prefetch remains tentative until consecutive transport evidence', () => {
    const h = makeHarness()
    const av1 = { height: 1080, bandwidth: 4_000_000, codecs: 'av01.0.08M.08', base_url: signed(AKAMAI, 'av1'), backup_url: [] }
    const hevc = { height: 1080, bandwidth: 4_000_000, codecs: 'hev1.1.6.L120', base_url: signed('upos-hz-alt.akamaized.net', 'hevc'), backup_url: [] }
    const av1Group = h.routes.registerSignedRouteGroup(av1, true, 'video')
    const hevcGroup = h.routes.registerSignedRouteGroup(hevc, true, 'video')
    const av1Context = { route: h.routes.captureRouteContext(av1.base_url) }
    h.routes.observeTransport(av1Context, av1.base_url, 128 * 1024, 'xhr')
    assert.equal(h.routes.diagnostics().active?.codec, 'av1')

    const hevcContext = { route: h.routes.captureRouteContext(hevc.base_url) }
    h.routes.observeTransport(hevcContext, hevc.base_url, 128 * 1024, 'xhr')
    assert.equal(h.routes.diagnostics().active?.codec, 'av1')
    assert.equal(h.routes.diagnostics().tentative?.codec, 'hevc')
    assert.equal(h.routes.groups.get(av1Group).id, av1Group)
    assert.equal(h.routes.groups.get(hevcGroup).id, hevcGroup)
})

test('v181 a healthy Native probe updates rating but cannot alter the next request route', () => {
    const h = makeHarness()
    const native = signed(AKAMAI)
    const catalog = signed(CATALOG)
    const item = { height: 1080, bandwidth: 4_000_000, codecs: 'av01.0.08M.08', base_url: native, backup_url: [catalog] }
    const group = h.routes.registerSignedRouteGroup(item, true, 'video')
    item.base_url = catalog; item.backup_url = []
    h.routes.applySignedRoutePlan(item, true, group)
    const context = { route: h.routes.captureRouteContext(catalog) }
    h.routes.observeTransport(context, catalog, 128 * 1024, 'xhr')
    const candidate = h.routes.getNativeProbeCandidate(catalog)
    assert.equal(candidate.host, AKAMAI)
    const result = h.routes.recordNativeProbe(candidate,
        { accepted: true, bytes: 384 * 1024, durationMs: 100, mbps: 31.4 }, 20)
    assert.equal(result.accepted, true)
    const unchanged = h.routes.resolveRequestRoute(catalog, context)
    assert.equal(unchanged.host, CATALOG)
    assert.equal(unchanged.url, catalog)
    assert.equal(h.routes.diagnostics().suppressedSwitches.probeHealthy, 1)
})

test('v181 page-compatible __playinfo__ transformation cannot erase a trusted Akamai route pool', async () => {
    const h = loadUserscript(target, { initialUrl: 'https://www.bilibili.com/video/BVroute181', fetchImpl: async input => {
        const url = input instanceof Request ? input.url : String(input)
        return url.startsWith(api) ? new Response(JSON.stringify(payload())) : new Response(new Uint8Array(1024))
    } })
    await (await h.pageWindow.fetch(api)).json()
    h.evaluate('refreshPublicDiagnosticSnapshot()')
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.states.unknown, 1)

    h.pageWindow.__playinfo__ = payload()
    h.evaluate('refreshPublicDiagnosticSnapshot()')
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.states.unknown, 1)
})

test('v181 a legal recovery boundary may adopt an exact rated Native route and a failure returns to Catalog', () => {
    const h = makeHarness()
    const native = signed(AKAMAI)
    const catalog = signed(CATALOG)
    const item = { height: 1080, bandwidth: 4_000_000, codecs: 'av01.0.08M.08',
        base_url: native, backup_url: [catalog] }
    const group = h.routes.registerSignedRouteGroup(item, true, 'video')
    item.base_url = catalog; item.backup_url = []
    h.routes.applySignedRoutePlan(item, true, group)
    const catalogContext = { route: h.routes.captureRouteContext(catalog) }
    h.routes.observeTransport(catalogContext, catalog, 128 * 1024, 'xhr')
    const candidate = h.routes.getNativeProbeCandidate(catalog)
    h.routes.recordNativeProbe(candidate, { accepted: true, bytes: 384 * 1024, durationMs: 100 }, 20)

    assert.deepEqual(h.routes.beginRouteRecovery('watchdog', CATALOG),
        { type: 'native-signed', host: AKAMAI })
    assert.equal(h.routes.resolveRequestRoute(catalog, catalogContext).url, native)

    const nativeContext = { route: h.routes.captureRouteContext(native) }
    assert.equal(h.routes.noteNativeFailure(nativeContext, native, 503, 'http'), true)
    assert.equal(h.routes.diagnostics().plannedRoute.type, 'catalog-generated')
    assert.equal(h.routes.diagnostics().plannedRoute.host, CATALOG)
    assert.equal(h.routes.resolveRequestRoute(native, nativeContext).host, CATALOG)
})

test('v181 auto-quality carries Native affinity only through each group exact signed URL', () => {
    const h = makeHarness()
    const firstNative = signed(AKAMAI, 'av1-1080')
    const secondNative = signed(AKAMAI, 'av1-720')
    const firstCatalog = signed(CATALOG, 'av1-1080')
    const secondCatalog = signed(CATALOG, 'av1-720')
    const first = { height: 1080, bandwidth: 4_000_000, codecs: 'av01.0.08M.08',
        base_url: firstNative, backup_url: [firstCatalog] }
    const second = { height: 720, bandwidth: 2_000_000, codecs: 'av01.0.05M.08',
        base_url: secondNative, backup_url: [secondCatalog] }
    const firstGroup = h.routes.registerSignedRouteGroup(first, true, 'video')
    const secondGroup = h.routes.registerSignedRouteGroup(second, true, 'video')
    first.base_url = firstCatalog; first.backup_url = []
    second.base_url = secondCatalog; second.backup_url = []
    h.routes.applySignedRoutePlan(first, true, firstGroup)
    const context = { route: h.routes.captureRouteContext(firstCatalog) }
    h.routes.observeTransport(context, firstCatalog, 128 * 1024, 'xhr')
    const candidate = h.routes.getNativeProbeCandidate(firstCatalog)
    h.routes.recordNativeProbe(candidate, { accepted: true, bytes: 384 * 1024, durationMs: 100 }, 20)
    h.routes.beginRouteRecovery('verified-transport', CATALOG)

    const plan = h.routes.applySignedRoutePlan(second, true, secondGroup)
    assert.equal(plan.primaryType, 'native-signed')
    assert.equal(second.base_url, secondNative)
    assert.notEqual(second.base_url, firstNative)
})

test('v181 missing Native affinity in a new representation downgrades the epoch to Catalog without bouncing back', () => {
    const h = makeHarness()
    const native = signed(AKAMAI, 'av1-1080')
    const firstCatalog = signed(CATALOG, 'av1-1080')
    const secondCatalog = signed(CATALOG, 'av1-720')
    const first = { height: 1080, bandwidth: 4_000_000, codecs: 'av01.0.08M.08',
        base_url: native, backup_url: [firstCatalog] }
    const second = { height: 720, bandwidth: 2_000_000, codecs: 'av01.0.05M.08',
        base_url: secondCatalog, backup_url: [] }
    const firstGroup = h.routes.registerSignedRouteGroup(first, true, 'video')
    const secondGroup = h.routes.registerSignedRouteGroup(second, true, 'video')
    first.base_url = firstCatalog; first.backup_url = []
    h.routes.applySignedRoutePlan(first, true, firstGroup)
    const context = { route: h.routes.captureRouteContext(firstCatalog) }
    h.routes.observeTransport(context, firstCatalog, 128 * 1024, 'xhr')
    const candidate = h.routes.getNativeProbeCandidate(firstCatalog)
    h.routes.recordNativeProbe(candidate, { accepted: true, bytes: 384 * 1024, durationMs: 100 }, 20)
    h.routes.beginRouteRecovery('watchdog', CATALOG)

    h.routes.applySignedRoutePlan(second, true, secondGroup)
    assert.equal(h.routes.diagnostics().plannedRoute.type, 'catalog-generated')
    assert.equal(new URL(second.base_url).hostname, CATALOG)

    const firstAgain = { height: 1080, bandwidth: 4_000_000, codecs: 'av01.0.08M.08',
        base_url: native, backup_url: [firstCatalog] }
    const firstAgainGroup = h.routes.registerSignedRouteGroup(firstAgain, true, 'video')
    firstAgain.base_url = firstCatalog; firstAgain.backup_url = []
    const plan = h.routes.applySignedRoutePlan(firstAgain, true, firstAgainGroup)
    assert.equal(plan.primaryType, 'catalog-generated')
})
