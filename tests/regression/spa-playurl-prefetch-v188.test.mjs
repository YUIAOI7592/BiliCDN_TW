import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { loadUserscript } = require('../harness/userscript-vm')
const target = require('../harness/current-script')
const root = path.resolve(import.meta.dirname, '../..')
const previous = path.join(root, 'Release/v1.8.7/BiliCDN_TW.user.js')

const original = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/01/23/prefetch.m4s?token=fixture'
const payload = () => ({ code: 0, data: { dash: {
    video: [{ id: 80, height: 1080, width: 1920, bandwidth: 3_000_000,
        codecs: 'av01.0.08M.08', base_url: original, backup_url: [] }],
    audio: [],
} } })

const refresh = h => h.evaluate('refreshPublicDiagnosticSnapshot()')

test('v187 reproduction: a playurl completed before SPA is discarded when that navigation later clears the route pool', async () => {
    const h = loadUserscript(previous, {
        initialUrl: 'https://www.bilibili.com/video/BVold',
        instrument: false,
        gmSeed: { disabled: false, blicdnVersion: '1.8.7' },
        fetchImpl: async () => new Response(JSON.stringify(payload()), { status: 200 }),
    })

    const response = await h.pageWindow.fetch('https://api.bilibili.com/x/player/wbi/playurl?bvid=BVnext')
    assert.notEqual((await response.json()).data.dash.video[0].base_url, original)
    h.pageWindow.history.pushState({}, '', '/video/BVnext')
    await h.timers.advanceAsync(0)
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.trustedGroups, 0)
})

test('a completed Fetch prefetch is staged until its exact SPA destination becomes current', async () => {
    const h = loadUserscript(target, {
        initialUrl: 'https://www.bilibili.com/video/BVold',
        instrument: true,
        gmSeed: { disabled: false, blicdnVersion: '1.8.7' },
        fetchImpl: async () => new Response(JSON.stringify(payload()), { status: 200 }),
    })

    const response = await h.pageWindow.fetch('https://api.bilibili.com/x/player/wbi/playurl?bvid=BVnext')
    const prefetched = await response.json()
    refresh(h)
    assert.equal(prefetched.data.dash.video[0].base_url, original)
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.trustedGroups, 0)

    h.pageWindow.history.pushState({}, '', '/video/BVnext')
    await h.timers.advanceAsync(0)
    refresh(h)
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.trustedGroups, 1)
})

test('a completed XHR prefetch is staged and adopted by the matching later SPA', async () => {
    const h = loadUserscript(target, {
        initialUrl: 'https://www.bilibili.com/video/BVold',
        instrument: true,
        gmSeed: { disabled: false, blicdnVersion: '1.8.7' },
    })
    const xhr = new h.pageWindow.XMLHttpRequest()
    xhr.open('GET', 'https://api.bilibili.com/x/player/wbi/playurl?bvid=BVnext')
    xhr.send()
    xhr.respond({ status: 200, responseText: JSON.stringify(payload()) })
    assert.equal(JSON.parse(xhr.responseText).data.dash.video[0].base_url, original)

    h.pageWindow.history.pushState({}, '', '/video/BVnext')
    await h.timers.advanceAsync(0)
    refresh(h)
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.trustedGroups, 1)
})

test('a completed XHR prefetch is staged even when the player has not read a response getter before SPA', async () => {
    const h = loadUserscript(target, {
        initialUrl: 'https://www.bilibili.com/video/BVold',
        instrument: true,
        gmSeed: { disabled: false, blicdnVersion: '1.8.8' },
    })
    const xhr = new h.pageWindow.XMLHttpRequest()
    xhr.open('GET', 'https://api.bilibili.com/x/player/wbi/playurl?bvid=BVnext')
    xhr.send()
    xhr.respond({ status: 200, responseText: JSON.stringify(payload()) })

    // Match the real player ordering: the native request has completed, but the
    // application navigates before consulting responseText/response.
    h.pageWindow.history.pushState({}, '', '/video/BVnext')
    await h.timers.advanceAsync(0)
    refresh(h)
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.trustedGroups, 1)
})

test('an unread JSON XHR prefetch is staged without mutating the browser-owned response object', async () => {
    const raw = payload()
    const h = loadUserscript(target, {
        initialUrl: 'https://www.bilibili.com/video/BVold',
        instrument: true,
        gmSeed: { disabled: false, blicdnVersion: '1.8.8' },
    })
    const xhr = new h.pageWindow.XMLHttpRequest()
    xhr.open('GET', 'https://api.bilibili.com/x/player/wbi/playurl?bvid=BVnext')
    xhr.responseType = 'json'
    xhr.send()
    xhr.respond({ status: 200, response: raw })

    assert.equal(raw.data.dash.video[0].base_url, original)
    h.pageWindow.history.pushState({}, '', '/video/BVnext')
    await h.timers.advanceAsync(0)
    refresh(h)
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.trustedGroups, 1)
})

test('staged playinfo cannot populate a different SPA destination', async () => {
    const h = loadUserscript(target, {
        initialUrl: 'https://www.bilibili.com/video/BVold',
        instrument: true,
        gmSeed: { disabled: false, blicdnVersion: '1.8.7' },
        fetchImpl: async () => new Response(JSON.stringify(payload()), { status: 200 }),
    })
    await (await h.pageWindow.fetch('https://api.bilibili.com/x/player/wbi/playurl?bvid=BVstaged')).json()

    h.pageWindow.history.pushState({}, '', '/video/BVother')
    await h.timers.advanceAsync(0)
    refresh(h)
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.trustedGroups, 0)
})

test('disabling clears completed prefetch staging', async () => {
    const h = loadUserscript(target, {
        initialUrl: 'https://www.bilibili.com/video/BVold',
        instrument: true,
        gmSeed: { disabled: false, blicdnVersion: '1.8.7' },
        fetchImpl: async () => new Response(JSON.stringify(payload()), { status: 200 }),
    })
    await (await h.pageWindow.fetch('https://api.bilibili.com/x/player/wbi/playurl?bvid=BVnext')).json()
    h.evaluate('setRuntimeDisabled(true)')
    h.evaluate('setRuntimeDisabled(false)')

    h.pageWindow.history.pushState({}, '', '/video/BVnext')
    await h.timers.advanceAsync(0)
    refresh(h)
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.trustedGroups, 0)
})
