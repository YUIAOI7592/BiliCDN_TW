'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const { loadUserscript } = require('../harness/userscript-vm')

const root = path.resolve(__dirname, '../..')
const target = require('../harness/current-script')

test('v1.5.3 static invariants remain present', { skip: !fs.existsSync(target) }, () => {
    const source = fs.readFileSync(target, 'utf8')
    assert.doesNotMatch(source, /\.tee\s*\(/)
    assert.match(source, /cancel\(reason\)[\s\S]{0,220}reader\.cancel\(reason\)/)
    assert.match(source, /PCDN_RESOURCE_PATH/)
    assert.match(source, /mappedOriginalUrl/)
    assert.match(source, /responseType\s*===\s*['"]json['"]/)
    assert.match(source, /buffered\.start\(i\)[\s\S]{0,180}buffered\.end\(i\)/)
    assert.match(source, /var EnableWorkerIntercept = true/)
})

test('two-times playback keeps proportional bitrate requirement', { skip: !fs.existsSync(target) }, () => {
    const h = loadUserscript(target, { gmSeed: { disabled: true } })
    const one = h.evaluate("getRequiredStreamMbps(1, 'steady')")
    const two = h.evaluate("getRequiredStreamMbps(2, 'steady')")
    assert.ok(one > 0)
    assert.ok(two >= one * 1.9)
})

test('Fetch playurl preserves original signed fallback and does not duplicate primary', { skip: !fs.existsSync(target) }, async () => {
    const original = 'https://cn-hk-eq-bcache-01.bilivideo.com/upgcxcode/video.m4s?token=signed&os=cosovbv'
    const api = 'https://api.bilibili.com/x/player/wbi/playurl?bvid=BV1test'
    const h = loadUserscript(target, {
        gmSeed: { disabled: false },
        fetchImpl: async input => {
            const url = input instanceof Request ? input.url : String(input)
            if (url.startsWith(api)) {
                return new Response(JSON.stringify({ code: 0, data: { dash: { video: [{ base_url: original, backup_url: [] }], audio: [] } } }), {
                    status: 200,
                    headers: { 'content-type': 'application/json', 'content-length': '999' },
                })
            }
            return new Response(new Uint8Array([1]), { status: 206 })
        },
    })
    const response = await h.pageWindow.fetch(api)
    const payload = await response.json()
    const item = payload.data.dash.video[0]
    const primary = item.base_url
    assert.equal(h.evaluate(`TRUSTED_CDN_CATALOG_SET.has(${JSON.stringify(new URL(primary).hostname)})`), true)
    assert.equal(item.backup_url.at(-1), original)
    assert.equal(item.backup_url.includes(primary), false)
    assert.equal(new Set(item.backup_url).size, item.backup_url.length)
    assert.equal(response.headers.has('content-length'), false)
})

test('XHR playurl rewrites both text and responseType=json payloads', { skip: !fs.existsSync(target) }, () => {
    const api = 'https://api.bilibili.com/x/player/wbi/playurl?bvid=BV1test'
    const original = 'https://cn-hk-eq-bcache-01.bilivideo.com/upgcxcode/xhr.m4s?token=signed'
    const makePayload = () => ({ code: 0, data: { dash: { video: [{ base_url: original, backup_url: [] }], audio: [] } } })
    const h = loadUserscript(target, { gmSeed: { disabled: false } })

    const textXhr = new h.pageWindow.XMLHttpRequest()
    textXhr.open('GET', api)
    textXhr.respond({ status: 200, responseText: JSON.stringify(makePayload()) })
    const textPayload = JSON.parse(textXhr.responseText)
    assert.notEqual(textPayload.data.dash.video[0].base_url, original)

    const jsonXhr = new h.pageWindow.XMLHttpRequest()
    jsonXhr.responseType = 'json'
    jsonXhr.open('GET', api)
    jsonXhr.respond({ status: 200, response: makePayload() })
    assert.notEqual(jsonXhr.response.data.dash.video[0].base_url, original)
})

test('host-lock restoration, backup ordering, and PCDN guard remain intact', { skip: !fs.existsSync(target) }, () => {
    const h = loadUserscript(target, { gmSeed: { disabled: false } })
    const result = h.evaluate(`(() => {
        const original = 'https://cn-hk-eq-bcache-01.bilivideo.com/upgcxcode/locked.m4s?token=signed&os=lockedbv'
        const item = { base_url: original, backup_url: [] }
        transformStreamItem(item, true)
        const rewritten = item.base_url
        noteHostLockedStream(original)
        const restored = normalizeMediaUrl(rewritten)
        const pcdn = 'https://cn-hk-eq-bcache-01.bilivideo.com/v1/resource/file.m4s?token=pcdn'
        return {
            original,
            rewritten,
            restored: restored.url,
            restoredFlag: restored.restoredOriginal,
            originalLast: item.backup_url[item.backup_url.length - 1] === original,
            primaryAbsent: item.backup_url.indexOf(rewritten) === -1,
            pcdnReplace: replaceUrlHost(pcdn, TRUSTED_CDN_CATALOG[0]),
            pcdnNormalized: normalizeMediaUrl(pcdn).url,
        }
    })()`)
    assert.notEqual(result.rewritten, result.original)
    assert.equal(result.restored, result.original)
    assert.equal(result.restoredFlag, true)
    assert.equal(result.originalLast, true)
    assert.equal(result.primaryAbsent, true)
    assert.equal(result.pcdnReplace, null)
    assert.match(result.pcdnNormalized, /cn-hk-eq-bcache-01\.bilivideo\.com\/v1\/resource/)
})

test('contiguous buffered range and seek grace use the current playback position', { skip: !fs.existsSync(target) }, () => {
    const h = loadUserscript(target, { gmSeed: { disabled: true } })
    const video = {
        currentTime: 12,
        playbackRate: 2,
        readyState: 4,
        paused: false,
        isConnected: true,
        clientWidth: 1920,
        clientHeight: 1080,
        buffered: {
            length: 2,
            start(index) { return [0, 100][index] },
            end(index) { return [15, 200][index] },
        },
    }
    h.document.querySelectorAll = selector => selector === 'video' ? [video] : []
    const stats = h.evaluate('Watchdog.stats()')
    assert.equal(stats.bufferedEndSec, 15)
    assert.equal(stats.bufferAheadSec, 3)
    assert.equal(stats.requiredMbps, +h.evaluate("getRequiredStreamMbps(2, 'steady').toFixed(2)"))
    assert.equal(h.evaluate('inSeekGrace()'), false)
    h.evaluate('bumpSeekGrace()')
    assert.equal(h.evaluate('inSeekGrace()'), true)
    h.evaluate('seekGraceUntil = Date.now() - 1')
    assert.equal(h.evaluate('inSeekGrace()'), false)
})

test('disabled mode leaves Fetch/XHR/Worker untouched and starts no probe or bakeoff', { skip: !fs.existsSync(target) }, async () => {
    const original = 'https://cn-hk-eq-bcache-01.bilivideo.com/upgcxcode/disabled.m4s?token=kept'
    const h = loadUserscript(target, { gmSeed: { disabled: true }, enableWorkerIntercept: true })
    const before = h.fetchCalls.length
    await h.pageWindow.fetch(original)
    assert.equal(h.fetchCalls.at(-1).url, original)
    const xhr = new h.pageWindow.XMLHttpRequest()
    xhr.open('GET', original)
    assert.equal(xhr.url, original)
    const worker = new h.pageWindow.Worker('https://www.bilibili.com/disabled-worker.js')
    assert.equal(worker.scriptURL, 'https://www.bilibili.com/disabled-worker.js')
    await h.evaluate(`Promise.all([
        Promise.resolve(startCdnProbe()),
        Promise.resolve(reorderCdnsByLatency(true)),
        Promise.resolve(runThroughputBakeoff(${JSON.stringify(original)}, false)),
    ])`)
    assert.equal(h.fetchCalls.length, before + 1)
    assert.equal(h.document.head.children.length, 0)
    assert.equal(h.blobStore.size, 0)
})

test('healthy playback performs no more active network calls than official v1.3.4', { skip: !fs.existsSync(target) }, async () => {
    const baseline = path.join(root, 'baseline', 'BiliCDN_TW_1.3.4.original.user.js')
    const host = 'upos-sz-mirroraliov.bilivideo.com'
    const seed = {
        disabled: false,
        probeCache_v1: JSON.stringify({ t: Date.now(), list: [host] }),
    }
    const exercise = async file => {
        const h = loadUserscript(file, { gmSeed: seed })
        await new Promise(resolve => setImmediate(resolve))
        const before = h.fetchCalls.length
        for (let i = 0; i < 3; i++) {
            const response = await h.pageWindow.fetch(`https://${host}/upgcxcode/healthy-${i}.m4s`)
            await response.arrayBuffer()
        }
        return h.fetchCalls.length - before
    }
    const baselineCalls = await exercise(baseline)
    const targetCalls = await exercise(target)
    assert.equal(targetCalls, 3)
    assert.ok(targetCalls <= baselineCalls)
})
