import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { loadUserscript } = require('../harness/userscript-vm')
const target = require('../harness/current-script')
const root = path.resolve(import.meta.dirname, '../..')
const previous = path.join(root, 'Release/v1.8.6/BiliCDN_TW.user.js')
const settle = () => new Promise(resolve => setImmediate(resolve))

const original = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/01/23/spa.m4s?token=fixture'
const payload = () => ({ code: 0, data: { dash: {
    video: [{ id: 80, height: 1080, width: 1920, bandwidth: 3_000_000,
        codecs: 'av01.0.08M.08', base_url: original, backup_url: [] }],
    audio: [],
} } })

const loadDeferred = (file = target, initialUrl = 'https://www.bilibili.com/video/BVold') => {
    let resolveResponse
    const h = loadUserscript(file, {
        initialUrl,
        instrument: file === target,
        gmSeed: { disabled: false, blicdnVersion: '1.8.6' },
        fetchImpl: async () => new Promise(resolve => { resolveResponse = resolve }),
    })
    return { h, respond: value => resolveResponse(value) }
}

test('v186 reproduction: matching playurl begun before pushState is discarded after the SPA generation changes', async () => {
    const { h, respond } = loadDeferred(previous)
    const request = h.pageWindow.fetch('https://api.bilibili.com/x/player/wbi/playurl?bvid=BVnext')
    await settle()
    h.pageWindow.history.pushState({}, '', '/video/BVnext')
    await h.timers.advanceAsync(0)
    respond(new Response(JSON.stringify(payload()), { status: 200 }))
    const body = await (await request).json()

    assert.equal(body.data.dash.video[0].base_url, original)
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.trustedGroups, 0)
})

test('matching Fetch playurl begun immediately before SPA is adopted by the new generation', async () => {
    const { h, respond } = loadDeferred()
    const request = h.pageWindow.fetch('https://api.bilibili.com/x/player/wbi/playurl?bvid=BVnext')
    await settle()
    h.pageWindow.history.pushState({}, '', '/video/BVnext')
    await h.timers.advanceAsync(0)
    respond(new Response(JSON.stringify(payload()), { status: 200 }))
    const body = await (await request).json()
    h.evaluate('refreshPublicDiagnosticSnapshot()')

    assert.notEqual(body.data.dash.video[0].base_url, original)
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.trustedGroups, 1)
})

test('matching XHR playurl begun immediately before SPA is adopted by the new generation', async () => {
    const h = loadUserscript(target, {
        initialUrl: 'https://www.bilibili.com/video/BVold',
        instrument: true,
        gmSeed: { disabled: false, blicdnVersion: '1.8.6' },
    })
    const xhr = new h.pageWindow.XMLHttpRequest()
    xhr.open('GET', 'https://api.bilibili.com/x/player/wbi/playurl?bvid=BVnext')
    xhr.send()
    h.pageWindow.history.pushState({}, '', '/video/BVnext')
    await h.timers.advanceAsync(0)
    xhr.respond({ status: 200, responseText: JSON.stringify(payload()) })
    const body = JSON.parse(xhr.responseText)
    h.evaluate('refreshPublicDiagnosticSnapshot()')

    assert.notEqual(body.data.dash.video[0].base_url, original)
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.trustedGroups, 1)
})

test('late playurl for a different video remains isolated from the current SPA generation', async () => {
    const { h, respond } = loadDeferred()
    const request = h.pageWindow.fetch('https://api.bilibili.com/x/player/wbi/playurl?bvid=BVstale')
    await settle()
    h.pageWindow.history.pushState({}, '', '/video/BVnext')
    await h.timers.advanceAsync(0)
    respond(new Response(JSON.stringify(payload()), { status: 200 }))
    const body = await (await request).json()
    h.evaluate('refreshPublicDiagnosticSnapshot()')

    assert.equal(body.data.dash.video[0].base_url, original)
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.trustedGroups, 0)
})

test('a bvid-only request cannot be cross-generation adopted across a multi-P boundary', async () => {
    const { h, respond } = loadDeferred(target, 'https://www.bilibili.com/video/BVparts?p=1')
    const request = h.pageWindow.fetch('https://api.bilibili.com/x/player/wbi/playurl?bvid=BVparts')
    await settle()
    h.pageWindow.history.pushState({}, '', '/video/BVparts?p=2')
    await h.timers.advanceAsync(0)
    respond(new Response(JSON.stringify(payload()), { status: 200 }))
    const body = await (await request).json()

    assert.equal(body.data.dash.video[0].base_url, original)
})
