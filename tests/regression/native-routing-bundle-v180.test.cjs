'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadUserscript } = require('../harness/userscript-vm')
const target = require('../harness/current-script')

const api = 'https://api.bilibili.com/x/player/wbi/playurl?bvid=BVnative'
const catalog = 'upos-sz-mirrorali.bilivideo.com'
const native = 'upos-sz-newedge.bilivideo.com'
const signed = host => `https://${host}/upgcxcode/01/23/native.m4s?deadline=999&token=super-secret`

const payload = () => ({ code: 0, data: { dash: {
    video: [{ id: 80, height: 1080, width: 1920, bandwidth: 4_000_000,
        codecs: 'av01.0.08M.08', mimeType: 'video/mp4', frameRate: '30',
        base_url: signed(catalog), backup_url: [signed(native)] }],
    audio: [],
} } })

const seed = () => {
    const now = Date.now()
    return {
        disabled: false,
        throughputSchema: 3,
        cdnHealth_v1: JSON.stringify({ [catalog]: {
            ewmaMbps: 10, varMbps: 0, samples: 3, successes: 2, failures: 0, slowSamples: 0,
            lastThroughputAt: now, lastSuccessAt: now, lastSeen: now,
        } }),
        nativeRouteRatings_v1: JSON.stringify({ version: 1, video: { [native]: {
            ewmaMbps: 32, varMbps: 0, samples: 3, probeSamples: 1, transportSamples: 1,
            successes: 1, failures: 0, slowSamples: 0, latencyMs: 20,
            lastSeen: now, lastThroughputAt: now, lastLatencyAt: now, lastSuccessAt: now,
        } }, audio: {} }),
    }
}

test('v180 production entry ranks a confirmed Native signed URL without reconstructing its query', async () => {
    const h = loadUserscript(target, {
        gmSeed: seed(),
        fetchImpl: async input => {
            const url = input instanceof Request ? input.url : String(input)
            if (url.startsWith(api)) return new Response(JSON.stringify(payload()), { status: 200 })
            return new Response(new Uint8Array(128 * 1024), { status: 206 })
        },
    })
    const response = await h.pageWindow.fetch(api)
    const item = (await response.json()).data.dash.video[0]
    assert.equal(item.base_url, signed(native))
    const catalogFallback = item.backup_url.find(url => new URL(url).hostname !== native)
    const request = new Request(catalogFallback)
    const media = await h.pageWindow.fetch(request)
    await media.arrayBuffer()
    assert.equal(h.fetchCalls.at(-1).url, signed(native))
    assert.equal(new URL(h.fetchCalls.at(-1).url).search, '?deadline=999&token=super-secret')
})

test('v180 Native signed 403 invalidates only that epoch route and never creates catalog host-lock', async () => {
    let rejectNative = true
    const h = loadUserscript(target, {
        gmSeed: seed(),
        fetchImpl: async input => {
            const url = input instanceof Request ? input.url : String(input)
            if (url.startsWith(api)) return new Response(JSON.stringify(payload()), { status: 200 })
            if (new URL(url).hostname === native && rejectNative) return new Response('', { status: 403 })
            return new Response(new Uint8Array(128 * 1024), { status: 206 })
        },
    })
    const item = (await (await h.pageWindow.fetch(api)).json()).data.dash.video[0]
    const catalogFallback = item.backup_url.find(url => new URL(url).hostname !== native)
    await h.pageWindow.fetch(catalogFallback)
    rejectNative = false
    const response = await h.pageWindow.fetch(catalogFallback)
    await response.arrayBuffer()
    assert.notEqual(new URL(h.fetchCalls.at(-1).url).hostname, native)
    assert.equal(h.evaluate('hostLockedStreams.size'), 0)
    h.evaluate('refreshPublicDiagnosticSnapshot()')
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.states.invalid, 1)
})

test('v180 public snapshot and report expose bounded route state without signed URL material', async () => {
    const h = loadUserscript(target, { gmSeed: seed(), fetchImpl: async url => String(url).startsWith(api)
        ? new Response(JSON.stringify(payload())) : new Response(new Uint8Array(1024)) })
    await (await h.pageWindow.fetch(api)).json()
    const publicText = JSON.stringify(h.pageWindow.BiliCDN)
    const report = h.evaluate('buildDiagReport()')
    assert.match(publicText, /nativeRouting/)
    assert.match(report, /Native Route/)
    for (const output of [publicText, report]) assert.doesNotMatch(output, /upgcxcode|deadline=|token=|super-secret/)
})

test('v180 Native route never enters catalog, preconnect, or forced-redirect authority', async () => {
    const h = loadUserscript(target, { gmSeed: seed(), fetchImpl: async url => String(url).startsWith(api)
        ? new Response(JSON.stringify(payload())) : new Response(new Uint8Array(1024)) })
    await (await h.pageWindow.fetch(api)).json()
    assert.equal(h.evaluate(`TRUSTED_CDN_CATALOG_SET.has('${native}')`), false)
    assert.equal(h.evaluate(`addForcedRedirect('${native}')`), false)
    assert.equal(h.evaluate(`preconnectCdn('${native}')`), undefined)
    assert.equal(h.document.getElementById(`bilicdn-preconn-${native}`), null)
})

test('v180 forged page-global playinfo cannot admit Native routes or schedule active exploration', () => {
    const h = loadUserscript(target, { gmSeed: seed(), pageGlobals: { __playinfo__: payload() } })
    h.evaluate('refreshPublicDiagnosticSnapshot()')
    assert.equal(JSON.stringify(h.pageWindow.BiliCDN.nativeRouting.states),
        JSON.stringify({ unknown: 0, provisional: 0, confirmed: 0, invalid: 0 }))
    assert.equal(h.gmWrites.some(write => write.key === 'nativeRouteRatings_v1'), false)
    assert.equal(h.evaluate('bakeoffTimer'), null)
})

test('v180 a completed non-catalog XHR can passively admit its signed host without catalog authority', async () => {
    const thirdParty = 'edge.example.test'
    const customPayload = payload()
    customPayload.data.dash.video[0].backup_url = [signed(thirdParty)]
    const h = loadUserscript(target, { gmSeed: seed(), fetchImpl: async input => {
        const url = input instanceof Request ? input.url : String(input)
        return url.startsWith(api) ? new Response(JSON.stringify(customPayload)) : new Response(new Uint8Array(1024))
    } })
    const item = (await (await h.pageWindow.fetch(api)).json()).data.dash.video[0]
    const nativeBackup = item.backup_url.find(url => new URL(url).hostname === thirdParty)
    const xhr = new h.pageWindow.XMLHttpRequest()
    xhr.open('GET', nativeBackup); xhr.send()
    xhr.respond({ status: 206, response: new Uint8Array(128 * 1024).buffer,
        responseURL: nativeBackup })
    h.evaluate('refreshPublicDiagnosticSnapshot()')
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.ledgerSize.video, 2)
    assert.equal(h.evaluate(`TRUSTED_CDN_CATALOG_SET.has('${thirdParty}')`), false)
})

test('v180 Native exploration replaces one existing bakeoff slot and keeps the four-candidate cap', async () => {
    const initial = seed()
    initial.nativeRouteRatings_v1 = JSON.stringify({ version: 1, video: {}, audio: {} })
    const h = loadUserscript(target, { gmSeed: initial, fetchImpl: async input => {
        const url = input instanceof Request ? input.url : String(input)
        if (url.startsWith(api)) return new Response(JSON.stringify(payload()))
        return new Response(new Uint8Array(384 * 1024), { status: 206 })
    } })
    const item = (await (await h.pageWindow.fetch(api)).json()).data.dash.video[0]
    await (await h.pageWindow.fetch(item.base_url)).arrayBuffer()
    await (await h.pageWindow.fetch(item.base_url)).arrayBuffer()
    const before = h.fetchCalls.length
    await h.evaluate(`doBakeoff(${JSON.stringify(item.base_url)}, captureRuntimeGeneration())`)
    const probes = h.fetchCalls.slice(before).filter(call => call.init?.headers?.Range)
    assert.equal(probes.length, 4)
    assert.equal(probes.filter(call => new URL(call.url).hostname === native).length, 1)
})
