import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createNativeRoutes } from '../../src/routing/native-routes.mjs'

const CATALOG = 'upos-sz-mirrorali.bilivideo.com'
const NATIVE = 'upos-sz-newedge.bilivideo.com'
const THIRD_PARTY = 'video.example-cdn.test'

function makeHarness(seed = null) {
    let stored = seed
    let epoch = 7
    const catalogHealth = { [CATALOG]: { ewmaMbps: 10, varMbps: 0, samples: 3, lastThroughputAt: Date.now() } }
    let fixed = null
    const deps = {
        gmGet: () => stored,
        gmSet: (_key, value) => { stored = value },
        gmDelete: () => { stored = null },
        TRUSTED_CDN_CATALOG_SET: new Set([CATALOG]),
        parseMediaHttpUrl: value => { try { return new URL(value, 'https://www.bilibili.com/video/BV1') } catch { return null } },
        classifyMediaDelivery: value => {
            const url = new URL(value)
            if (url.pathname.startsWith('/live-bvc/')) return { kind: 'live', host: url.hostname }
            if (url.pathname.startsWith('/v1/resource')) return { kind: 'pcdn', host: url.hostname }
            return { kind: 'native', host: url.hostname }
        },
        mediaUrlPolicy: { decide: value => {
            const url = new URL(value)
            if (url.pathname.startsWith('/live-bvc/')) return { action: 'pass', reason: 'live' }
            if (url.pathname.startsWith('/v1/resource')) return { action: 'pass', reason: 'resource' }
            return { action: 'rewrite', reason: 'media' }
        } },
        isMediaSegmentUrl: value => /\/upgcxcode\/.*\.m4s/.test(new URL(value).pathname),
        normalizeCodecName: item => item.codecs?.startsWith('av01') ? 'av1' : 'hevc',
        get playinfoEpoch() { return epoch },
        get resolvedCdn() { return fixed },
        disabled: false,
        peekCurrentCdn: () => CATALOG,
        getRequiredStreamMbps: () => 4,
        getCdnHealthScore: host => host === CATALOG ? 0.30 : 0,
        scoreRouteHealth: record => Math.min(1, (record?.ewmaMbps || 0) / 8)
            - Math.min(0.6, (record?.failures || 0) * 0.10)
            - (record?.softBlockedUntil > Date.now() ? 1.5 : 0),
        cdnHealth: catalogHealth,
        playbackRateState: { effectiveRate: 2 },
        getVideo: () => ({ videoHeight: 1080 }),
        DiagnosticLog: { fault() {} },
        onActiveRepresentation() {},
    }
    return { routes: createNativeRoutes(deps), deps, catalogHealth, get stored() { return stored },
        setFixed(value) { fixed = value }, setEpoch(value) { epoch = value } }
}

const nativeUrl = host => `https://${host}/upgcxcode/01/23/video.m4s?deadline=999&token=secret`

test('v170 reproduction: no native rating ledger and bakeoff is tied to dash.video[0]', () => {
    const v170 = readFileSync('Release/v1.7.0/BiliCDN_TW.user.js', 'utf8')
    assert.doesNotMatch(v170, /nativeRouteRatings_v1/)
    assert.match(v170, /dash\.video\s*&&\s*dash\.video\[0\]/)
})

test('v180 unknown native signed route stays backup and never expands catalog authority', () => {
    const h = makeHarness()
    const item = { height: 1080, bandwidth: 4_000_000, codecs: 'av01.0.08M.08',
        base_url: nativeUrl(NATIVE), backup_url: [nativeUrl(CATALOG)] }
    const group = h.routes.registerSignedRouteGroup(item, true, 'video')
    item.base_url = nativeUrl(CATALOG); item.backup_url = []
    const plan = h.routes.applySignedRoutePlan(item, true, group)
    assert.equal(plan.primaryType, 'catalog-generated')
    assert.equal(new URL(item.base_url).hostname, CATALOG)
    assert.ok(item.backup_url.some(url => new URL(url).hostname === NATIVE))
    assert.deepEqual([...h.deps.TRUSTED_CDN_CATALOG_SET], [CATALOG])
})

test('v180 new third-party host requires a real attributed transfer before ledger admission', () => {
    const h = makeHarness()
    const url = nativeUrl(THIRD_PARTY)
    const item = { height: 1080, bandwidth: 4_000_000, codecs: 'av01.0.08M.08', base_url: url, backup_url: [] }
    h.routes.registerSignedRouteGroup(item, true, 'video')
    assert.equal(h.routes.ledgers.video.has(THIRD_PARTY), false)
    const context = { route: h.routes.captureRouteContext(url) }
    h.routes.observeTransport(context, url, 128 * 1024, 'xhr')
    assert.equal(h.routes.ledgers.video.has(THIRD_PARTY), false)
    h.routes.recordNativeThroughput(context, url, 128 * 1024, 100, 2, 'transport')
    assert.equal(h.routes.ledgers.video.get(THIRD_PARTY).transportSamples, 1)
})

test('v181 a clearly superior known-family probe is rating-only during healthy playback', () => {
    const h = makeHarness()
    const original = nativeUrl(NATIVE)
    const catalog = nativeUrl(CATALOG)
    const item = { height: 1080, bandwidth: 4_000_000, codecs: 'av01.0.08M.08', base_url: original, backup_url: [catalog] }
    const group = h.routes.registerSignedRouteGroup(item, true, 'video')
    item.base_url = catalog; item.backup_url = []
    h.routes.applySignedRoutePlan(item, true, group)
    const context = { route: h.routes.captureRouteContext(catalog) }
    h.routes.observeTransport(context, catalog, 64 * 1024, 'xhr')
    const candidate = h.routes.getNativeProbeCandidate(catalog)
    assert.equal(candidate.host, NATIVE)
    const result = h.routes.recordNativeProbe(candidate, { accepted: true, bytes: 384 * 1024, durationMs: 100 }, 20)
    assert.equal(result.accepted, true)
    assert.equal(h.routes.resolveRequestRoute(catalog, context), null)
    assert.equal(h.routes.diagnostics().counts.probeQualified, 1)
})

test('v180 fixed catalog mode disables native primary while retaining signed fallback', () => {
    const h = makeHarness(); h.setFixed(CATALOG)
    const item = { height: 1080, bandwidth: 4_000_000, codecs: 'av01.0.08M.08', base_url: nativeUrl(NATIVE), backup_url: [] }
    const group = h.routes.registerSignedRouteGroup(item, true, 'video')
    item.base_url = nativeUrl(CATALOG); item.backup_url = []
    h.routes.applySignedRoutePlan(item, true, group)
    const context = { route: h.routes.captureRouteContext(item.base_url) }
    assert.equal(h.routes.resolveRequestRoute(item.base_url, context), null)
    assert.ok(item.backup_url.some(url => new URL(url).hostname === NATIVE))
})

test('v180 rejects PCDN/resource/live/special-port routes before pool admission', () => {
    const h = makeHarness()
    for (const url of [
        `https://${NATIVE}:8443/upgcxcode/a.m4s`,
        `https://${NATIVE}/v1/resource/a.m4s`,
        `https://${NATIVE}/live-bvc/a.m4s`,
    ]) {
        const item = { height: 1080, bandwidth: 1_000_000, base_url: url, backup_url: [] }
        assert.equal(h.routes.registerSignedRouteGroup(item, true, 'video'), null)
    }
})

test('v180 ledger load rejects catalog, expired, malformed, and unproven third-party entries', () => {
    const now = Date.now()
    const seed = JSON.stringify({ version: 1, video: {
        [CATALOG]: { lastSeen: now, transportSamples: 2 },
        'expired.bilivideo.com': { lastSeen: now - 7 * 60 * 60 * 1000, transportSamples: 1 },
        'unproven.example.test': { lastSeen: now, samples: 2, transportSamples: 0 },
        'good.example.test': { lastSeen: now, samples: 2, transportSamples: 1, ewmaMbps: 12, lastThroughputAt: now },
        'bad host': { lastSeen: now, transportSamples: 1 },
    }, audio: {} })
    const h = makeHarness(seed)
    assert.deepEqual([...h.routes.ledgers.video.keys()], ['good.example.test'])
    assert.ok(h.routes.diagnostics().ledger.rejected >= 4)
})

test('v180 diagnostics and persisted ledger contain hosts only, never signed paths or tokens', () => {
    const h = makeHarness()
    const url = nativeUrl(THIRD_PARTY)
    const item = { height: 1080, bandwidth: 4_000_000, codecs: 'av01.0.08M.08', base_url: url, backup_url: [] }
    h.routes.registerSignedRouteGroup(item, true, 'video')
    const context = { route: h.routes.captureRouteContext(url) }
    h.routes.observeTransport(context, url, 128 * 1024, 'xhr')
    h.routes.recordNativeThroughput(context, url, 128 * 1024, 100, 2, 'transport')
    h.routes.flushLedger()
    const exported = JSON.stringify(h.routes.diagnostics()) + String(h.stored)
    assert.doesNotMatch(exported, /upgcxcode|deadline|token|secret/)
    assert.match(String(h.stored), /video\.example-cdn\.test/)
})

test('v180 playinfo epoch reset discards every exact signed URL and active route plan', () => {
    const h = makeHarness()
    const url = nativeUrl(NATIVE)
    const item = { height: 1080, bandwidth: 4_000_000, base_url: url, backup_url: [] }
    h.routes.registerSignedRouteGroup(item, true, 'video')
    assert.equal(h.routes.isProtectedSignedUrl(url), true)
    h.routes.resetPool()
    assert.equal(h.routes.isProtectedSignedUrl(url), false)
    assert.equal(h.routes.groups.size, 0)
    assert.equal(h.routes.diagnostics().active, null)
})

test('v180 route pool retains at most four exact signed hosts and protects only retained URLs', () => {
    const h = makeHarness()
    const urls = Array.from({ length: 6 }, (_, index) => nativeUrl(`edge-${index}.bilivideo.com`))
    const item = { height: 1080, bandwidth: 4_000_000, base_url: urls[0], backup_url: urls.slice(1) }
    const group = h.routes.registerSignedRouteGroup(item, true, 'video')
    assert.equal(h.routes.groups.get(group).routes.length, 4)
    assert.equal(h.routes.isProtectedSignedUrl(urls[3]), true)
    assert.equal(h.routes.isProtectedSignedUrl(urls[4]), false)
})

test('v181 auto-quality change requires consecutive transport evidence after initial activation', () => {
    let height = 0
    const h = makeHarness()
    h.deps.getVideo = () => ({ videoHeight: height })
    const firstUrl = nativeUrl('first.bilivideo.com').replace('video.m4s', 'video-1080.m4s')
    const secondUrl = nativeUrl('second.bilivideo.com').replace('video.m4s', 'video-720.m4s')
    const first = { height: 1080, bandwidth: 4_000_000, base_url: firstUrl, backup_url: [] }
    const second = { height: 720, bandwidth: 2_000_000, base_url: secondUrl, backup_url: [] }
    h.routes.registerSignedRouteGroup(first, true, 'video')
    h.routes.registerSignedRouteGroup(second, true, 'video')
    const firstA = { route: h.routes.captureRouteContext(firstUrl) }
    h.routes.observeTransport(firstA, firstUrl, 64 * 1024, 'xhr')
    assert.equal(h.routes.diagnostics().active, null)
    const firstB = { route: h.routes.captureRouteContext(firstUrl) }
    h.routes.observeTransport(firstB, firstUrl, 64 * 1024, 'xhr')
    assert.equal(h.routes.diagnostics().active.height, 1080)
    height = 720
    const secondContext = { route: h.routes.captureRouteContext(secondUrl) }
    h.routes.observeTransport(secondContext, secondUrl, 64 * 1024, 'fetch')
    assert.equal(h.routes.diagnostics().active.height, 1080)
    assert.equal(h.routes.diagnostics().tentative.height, 720)
    const secondContext2 = { route: h.routes.captureRouteContext(secondUrl) }
    h.routes.observeTransport(secondContext2, secondUrl, 64 * 1024, 'fetch')
    assert.equal(h.routes.diagnostics().active.height, 720)
    assert.equal(h.routes.diagnostics().autoQualityReason, 'consecutive-video-transfers')
})

test('v180 provisional promotion requires a comparable fresh Catalog sample and expires locally', () => {
    const h = makeHarness()
    h.catalogHealth[CATALOG].samples = 0
    const original = nativeUrl(NATIVE), catalog = nativeUrl(CATALOG)
    const item = { height: 1080, bandwidth: 4_000_000, base_url: original, backup_url: [catalog] }
    const group = h.routes.registerSignedRouteGroup(item, true, 'video')
    item.base_url = catalog; item.backup_url = []
    h.routes.applySignedRoutePlan(item, true, group)
    const first = { route: h.routes.captureRouteContext(catalog) }
    const second = { route: h.routes.captureRouteContext(catalog) }
    h.routes.observeTransport(first, catalog, 64 * 1024, 'xhr')
    h.routes.observeTransport(second, catalog, 64 * 1024, 'xhr')
    const candidate = h.routes.getNativeProbeCandidate(catalog)
    h.routes.recordNativeProbe(candidate, { accepted: true, bytes: 384 * 1024, durationMs: 100 }, 20)
    assert.equal(h.routes.resolveRequestRoute(catalog, first), null)
    h.catalogHealth[CATALOG].samples = 3
    h.catalogHealth[CATALOG].lastThroughputAt = Date.now()
    const later = h.routes.getNativeProbeCandidate(catalog)
    assert.equal(later, null, 'fresh Native sample waits for a later existing bakeoff cycle')
})

test('v180 URL admission supports protocol-relative media and enforces the exact 16 KiB ceiling', () => {
    const h = makeHarness()
    const protocolRelative = `//${NATIVE}/upgcxcode/a.m4s?token=relative`
    const relativeItem = { height: 1080, bandwidth: 1_000_000, base_url: protocolRelative, backup_url: [] }
    const relativeGroup = h.routes.registerSignedRouteGroup(relativeItem, true, 'video')
    assert.equal(h.routes.groups.get(relativeGroup).routes[0].url.startsWith('https://'), true)
    const prefix = `https://${NATIVE}/upgcxcode/`, suffix = '.m4s'
    const exact = prefix + 'a'.repeat(16 * 1024 - prefix.length - suffix.length) + suffix
    const over = exact + 'x'
    assert.ok(h.routes.registerSignedRouteGroup({ height: 720, base_url: exact, backup_url: [] }, true, 'video'))
    assert.equal(h.routes.registerSignedRouteGroup({ height: 480, base_url: over, backup_url: [] }, true, 'video'), null)
})

test('v180 Native ledger expires at six hours and evicts oldest video hosts above 48', () => {
    const now = Date.now()
    const video = Object.fromEntries(Array.from({ length: 50 }, (_, index) => [`edge-${index}.bilivideo.com`, {
        ewmaMbps: 10 + index, samples: 1, transportSamples: 1,
        lastThroughputAt: now - index * 1000, lastSuccessAt: now - index * 1000,
        lastSeen: now - index * 1000,
    }]))
    video['expired.bilivideo.com'] = { transportSamples: 1, lastSeen: now - 6 * 60 * 60 * 1000 - 1 }
    const h = makeHarness(JSON.stringify({ version: 1, video, audio: {} }))
    assert.equal(h.routes.ledgers.video.size, 48)
    assert.equal(h.routes.ledgers.video.has('expired.bilivideo.com'), false)
    assert.equal(h.routes.ledgers.video.has('edge-49.bilivideo.com'), false)
    assert.ok(h.routes.diagnostics().ledger.evicted >= 2)
})
