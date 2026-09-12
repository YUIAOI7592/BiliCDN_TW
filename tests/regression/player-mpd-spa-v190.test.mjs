import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { loadUserscript } = require('../harness/userscript-vm')
const target = require('../harness/current-script')
const root = path.resolve(import.meta.dirname, '../..')
const previous = path.join(root, 'Release/v1.8.9/BiliCDN_TW.user.js')

const OLD = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/10/10/old.m4s?token=old'
const NEXT = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/20/20/next.m4s?token=next'
const AUDIO = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/20/20/audio.m4s?token=audio'
const FINAL = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/30/30/final.m4s?token=final'
const STALE_CURRENT = 'https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/20/20/next.m4s?token=next'

const item = (url, id, height = 1080, codecs = 'av01.0.08M.08') => ({
    id, height, width: height === 1080 ? 1920 : 0, bandwidth: height ? 3_000_000 : 128_000,
    codecs, mimeType: height ? 'video/mp4' : 'audio/mp4', frameRate: height ? '60000/1001' : undefined,
    base_url: url, baseUrl: url, backup_url: [], backupUrl: [],
})
const playinfo = url => ({ code: 0, data: { dash: { video: [item(url, 80)], audio: [] } } })
const mpd = url => ({
    minBufferTime: 1.5,
    video: [item(url, 80)],
    audio: [item(AUDIO, 30280, 0, 'mp4a.40.2')],
})

function setup(file = target, { disabled = false } = {}) {
    let manifest = { bvid: 'BVold', cid: 1, p: 1 }
    let core = { getMpd: () => mpd(OLD) }
    const player = {
        getManifest: () => manifest,
        __core: () => core,
        getMediaInfo: () => ({ playUrl: null }),
    }
    const h = loadUserscript(file, {
        initialUrl: 'https://www.bilibili.com/video/BVold',
        instrument: file === target,
        gmSeed: { disabled, blicdnVersion: '1.8.9' },
        pageGlobals: { __playinfo__: playinfo(OLD), player },
    })
    return {
        h,
        switchCore(bvid = 'BVnext', url = NEXT, cid = 2) {
            manifest = { bvid, cid, p: 1 }
            core = { getMpd: () => mpd(url) }
        },
        setPlayerAvailable(available) { h.pageWindow.player = available ? player : null },
    }
}

test('v189 reproduction: stale __playinfo__ and no playurl leave the SPA route pool empty despite a current player MPD', async () => {
    const { h, switchCore } = setup(previous)
    h.pageWindow.history.pushState({}, '', '/video/BVnext')
    await h.timers.advanceAsync(200)
    switchCore()
    await h.timers.advanceAsync(1500)
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.trustedGroups, 0)
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.pageGroups, 0)
})

test('current player MPD rebuilds the matching SPA pool before the first media XHR', async () => {
    const { h, switchCore } = setup()
    h.pageWindow.history.pushState({}, '', '/video/BVnext')
    await h.timers.advanceAsync(200)
    switchCore()
    await h.timers.advanceAsync(400)
    h.evaluate('refreshPublicDiagnosticSnapshot()')

    assert.equal(h.pageWindow.BiliCDN.nativeRouting.playerManifest.state, 'adopted')
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.playerManifest.source, 'player-mpd')
    assert.ok(h.pageWindow.BiliCDN.nativeRouting.admission.playerMpdGroups >= 1)
    assert.ok(h.fetchCalls.every(call => !String(call.url).includes('/20/20/')),
        'reading player state must not request the MPD media URLs')

    const xhr = new h.pageWindow.XMLHttpRequest()
    xhr.open('GET', NEXT)
    assert.notEqual(xhr.url, NEXT, 'the first media request should already have route context')
    assert.match(xhr.url, /\.bilivideo\.(?:com|cn|net)\//)
})

test('a context miss performs one last synchronous MPD reconciliation before routing', async () => {
    const { h, switchCore } = setup()
    h.pageWindow.history.pushState({}, '', '/video/BVnext')
    await h.timers.advanceAsync(0)
    switchCore()

    const xhr = new h.pageWindow.XMLHttpRequest()
    xhr.open('GET', NEXT)
    h.evaluate('refreshPublicDiagnosticSnapshot()')
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.playerManifest.state, 'adopted')
    assert.notEqual(xhr.url, NEXT)
})

test('a mismatched player manifest is never adopted and exact transport bootstrap remains bounded', async () => {
    const { h } = setup()
    h.pageWindow.history.pushState({}, '', '/video/BVnext')
    await h.timers.advanceAsync(1500)

    const xhr = new h.pageWindow.XMLHttpRequest()
    xhr.open('GET', NEXT)
    h.evaluate('refreshPublicDiagnosticSnapshot()')
    assert.notEqual(h.pageWindow.BiliCDN.nativeRouting.playerManifest.state, 'adopted')
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.transportGroups, 1)
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.playerManifest.transportBootstrapCount, 1)
    assert.ok(h.fetchCalls.every(call => !String(call.url).includes('/20/20/')))
})

test('a briefly stale MPD cannot disable legacy routing for the first current segment', async () => {
    const { h, switchCore } = setup()
    h.pageWindow.history.pushState({}, '', '/video/BVnext')
    await h.timers.advanceAsync(0)
    // The outer manifest has switched, but the new core still exposes the old
    // representation for a moment.  This ordering was observed during SPA.
    switchCore('BVnext', OLD, 2)
    await h.timers.advanceAsync(100)

    const xhr = new h.pageWindow.XMLHttpRequest()
    xhr.open('GET', STALE_CURRENT)
    h.evaluate('refreshPublicDiagnosticSnapshot()')
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.transportGroups, 1)
    assert.notEqual(xhr.url, STALE_CURRENT, 'transport bootstrap must retain the pre-v1.8 Catalog rewrite behavior')
})

test('a temporarily unavailable player is retried and adopted without an extra API request', async () => {
    const { h, switchCore, setPlayerAvailable } = setup()
    h.pageWindow.history.pushState({}, '', '/video/BVnext')
    setPlayerAvailable(false)
    await h.timers.advanceAsync(200)
    switchCore()
    setPlayerAvailable(true)
    await h.timers.advanceAsync(800)
    h.evaluate('refreshPublicDiagnosticSnapshot()')

    assert.equal(h.pageWindow.BiliCDN.nativeRouting.playerManifest.state, 'adopted')
    assert.ok(h.pageWindow.BiliCDN.nativeRouting.playerManifest.attempts > 1)
    assert.ok(h.fetchCalls.every(call => !String(call.url).includes('/20/20/')))
})

test('rapid consecutive SPA changes adopt only the final player core', async () => {
    const { h, switchCore } = setup()
    h.pageWindow.history.pushState({}, '', '/video/BVnext')
    switchCore()
    h.pageWindow.history.pushState({}, '', '/video/BVfinal')
    switchCore('BVfinal', FINAL, 3)
    await h.timers.advanceAsync(1600)
    h.evaluate('refreshPublicDiagnosticSnapshot()')

    assert.equal(h.pageWindow.BiliCDN.nativeRouting.playerManifest.state, 'adopted')
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.playerMpdGroups, 2)
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.transportGroups, 0)
    const xhr = new h.pageWindow.XMLHttpRequest()
    xhr.open('GET', FINAL)
    assert.notEqual(xhr.url, FINAL)
})

test('the first Fetch context miss is reconciled from the player MPD before native fetch', async () => {
    const { h, switchCore } = setup()
    h.pageWindow.history.pushState({}, '', '/video/BVnext')
    await h.timers.advanceAsync(0)
    switchCore()
    const before = h.fetchCalls.length

    await h.pageWindow.fetch(NEXT)
    assert.equal(h.fetchCalls.length, before + 1)
    assert.notEqual(h.fetchCalls[before].url, NEXT)
    assert.match(h.fetchCalls[before].url, /\.bilivideo\.(?:com|cn|net)\//)
})

test('a later trusted playurl response supersedes player MPD state', async () => {
    const { h } = setup()
    h.evaluate('refreshPublicDiagnosticSnapshot()')
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.playerManifest.state, 'adopted')

    const xhr = new h.pageWindow.XMLHttpRequest()
    xhr.open('GET', 'https://api.bilibili.com/x/player/wbi/playurl?bvid=BVold&cid=1')
    xhr.send()
    xhr.respond({ status: 200, responseText: JSON.stringify(playinfo(OLD)) })
    void JSON.parse(xhr.responseText)
    h.evaluate('refreshPublicDiagnosticSnapshot()')

    assert.equal(h.pageWindow.BiliCDN.nativeRouting.playerManifest.state, 'superseded')
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.trustedGroups, 1)
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.playerMpdGroups, 0)
})

test('disabled mode never reads the player MPD and public diagnostics contain no signed URL', async () => {
    let manifestReads = 0
    const player = {
        getManifest() { manifestReads++; return { bvid: 'BVold', cid: 1, p: 1 } },
        __core: () => ({ getMpd: () => mpd(OLD) }),
    }
    const h = loadUserscript(target, {
        initialUrl: 'https://www.bilibili.com/video/BVold',
        instrument: true,
        gmSeed: { disabled: true, blicdnVersion: '1.8.9' },
        pageGlobals: { __playinfo__: playinfo(OLD), player },
    })
    assert.equal(manifestReads, 0)
    await h.pageWindow.fetch(OLD)
    assert.equal(h.fetchCalls.at(-1).url, OLD)

    const publicText = JSON.stringify(h.pageWindow.BiliCDN)
    assert.doesNotMatch(publicText, /token=(?:old|next|audio|final)/)
    assert.doesNotMatch(publicText, /upgcxcode\/\d+\/\d+/)
})
