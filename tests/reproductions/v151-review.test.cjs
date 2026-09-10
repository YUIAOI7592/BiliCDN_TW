'use strict'

// Diagnostic reproductions, NOT acceptance tests for a repaired release.
// Load the unchanged delivered userscript. No requests reach the real network.
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const { createHash } = require('node:crypto')
const { loadUserscript } = require('../harness/userscript-vm')
const source = path.resolve(__dirname, '../fixtures/BiliCDN_TW_1.5.1.user.js')
const host = 'upos-sz-mirroraliov.bilivideo.com'
const other = 'upos-sz-mirrorali02.bilivideo.com'
const settle = () => new Promise(resolve => setImmediate(resolve))
const load = options => loadUserscript(source, options)

test('review target is immutable delivered v1.5.1', () => {
    assert.equal(createHash('sha256').update(fs.readFileSync(source)).digest('hex'),
        '88f70ad9e01a9a3a54dd19ac5e624c0354b9084c5c6c696069ce9685194d2321')
})

test('R1: actual Fetch retries a PCDN host rewrite even after its 403 taught host-lock', async () => {
    const h = load({ gmSeed: { disabled: false }, fetchImpl: async () => new Response('', { status: 403 }) })
    const url = 'https://node.mountaintoys.cn/upgcxcode/locked.m4s?os=mcdn&sig=fixture'
    await h.pageWindow.fetch(url)
    assert.equal(h.evaluate(`isHostLockedStream(${JSON.stringify(url)})`), true)
    await h.pageWindow.fetch(url)
    const attempts = h.fetchCalls.filter(c => c.url.includes('/locked.m4s'))
    assert.equal(attempts.length, 2)
    assert.equal(new URL(attempts[0].url).hostname, host)
    assert.equal(new URL(attempts[1].url).hostname, host)
    assert.notEqual(h.evaluate(`getOriginalStreamUrl(${JSON.stringify(attempts[0].url)})`), url)
})

test('R2: a suspected port-only endpoint still reaches other rewrite paths', () => {
    const h = load({ gmSeed: { disabled: false } })
    const url = 'https://upos-sz-unlisted.bilivideo.com:8443/upgcxcode/port.m4s?sig=fixture'
    const result = h.evaluate(`(() => {
        const url = ${JSON.stringify(url)}
        return { kind: classifyMediaDelivery(url).kind, norm: normalizeMediaUrl(url), sink: replaceUrlHost(url, '${host}') }
    })()`)
    assert.equal(result.kind, 'suspected-pcdn')
    assert.equal(result.norm.changed, true)
    assert.equal(new URL(result.sink).hostname, host)
    assert.equal(new URL(result.sink).port, '')
})

test('R3: expired dead/black nodes disappear from dead diagnostics but remain excluded in a live session', () => {
    const now = 1_800_000_000_000
    const h = load({ now, gmSeed: {
        disabled: true, blicdnVersion: '1.5.1', throughputSchema: 3,
        knownDeadHosts_v1: JSON.stringify([{ host, expireAt: now + 1000, reason: 'timeout' }]),
        cdnBlacklist: JSON.stringify([{ cdn: other, expireAt: now + 1000 }]),
    } })
    h.clock.advance(2000)
    const result = h.evaluate(`({ listedDead: listDeadHosts().length, dead: knownDeadHosts.has('${host}'),
        black: blacklistSet.has('${other}'), available: getHealthyCdnList() })`)
    assert.equal(result.listedDead, 0)
    assert.equal(result.dead, true)
    assert.equal(result.black, true)
    assert.equal(result.available.includes(host), false)
})

const hangingProbe = (chunkBytes) => {
    const h = load({ gmSeed: { disabled: false }, fetchImpl: async (input, init = {}) => {
        if (!String(input).includes('/probe-review.m4s')) return new Response('ok')
        return new Response(new ReadableStream({ start(controller) {
            controller.enqueue(new Uint8Array(chunkBytes))
            init.signal.addEventListener('abort', () => {
                try { controller.error(new DOMException('aborted', 'AbortError')) } catch {}
            }, { once: true })
        } }), { status: 206 })
    } })
    return h
}

test('R4a: accepted 64 KiB partial timeout has no throughput sample or slow sample', async () => {
    const h = hangingProbe(64 * 1024)
    const pending = h.evaluate(`probeCdnThroughput('${host}', 'https://${other}/upgcxcode/probe-review.m4s', 768 * 1024)`)
    await settle()
    h.clock.advance(3000)
    h.timers.runTimers(3000)
    assert.equal((await pending).partial, true)
    assert.equal(h.evaluate(`cdnHealth['${host}'].samples`), 0)
    assert.equal(h.evaluate(`cdnHealth['${host}'].slowSamples`), 0)
    assert.equal(h.evaluate('redirectStats.partialProbeSamples'), 1)
})

test('R4b: receiving the full byte budget still waits for another read until timeout', async () => {
    const h = hangingProbe(768 * 1024)
    let settled = false
    const pending = h.evaluate(`probeCdnThroughput('${host}', 'https://${other}/upgcxcode/probe-review.m4s', 768 * 1024)`)
        .then(r => { settled = true; return r })
    await settle()
    assert.equal(settled, false)
    h.clock.advance(3000)
    h.timers.runTimers(3000)
    assert.equal((await pending).partial, true)
})

test('R5: a previous-page Fetch playurl completion overwrites the new-page stream profile', async () => {
    const payload = bandwidth => JSON.stringify({ code: 0, data: { dash: {
        video: [{ id: 80, height: 1080, bandwidth, codecs: 'avc1.640028',
            base_url: `https://${host}/upgcxcode/${bandwidth}.m4s` }], audio: [],
    } } })
    let completeOld
    const h = load({ gmSeed: { disabled: false }, fetchImpl: async input => {
        const url = String(input)
        if (url.includes('/x/player/playurl?cid=old')) return new Promise(resolve => { completeOld = resolve })
        if (url.includes('/x/player/playurl?cid=new')) return new Response(payload(2_000_000))
        return new Response('ok')
    } })
    const old = h.pageWindow.fetch('https://api.bilibili.com/x/player/playurl?cid=old')
    const generation = h.evaluate('runtimeGeneration')
    h.pageWindow.history.pushState({}, '', '/video/BV2review')
    h.timers.runTimers(0)
    assert.ok(h.evaluate('runtimeGeneration') > generation)
    await h.pageWindow.fetch('https://api.bilibili.com/x/player/playurl?cid=new')
    assert.equal(h.evaluate('currentStreamBitsPerSec'), 2_000_000)
    completeOld(new Response(payload(18_000_000)))
    await old
    assert.equal(h.evaluate('currentStreamBitsPerSec'), 18_000_000)
})

test('R6: the public snapshot stays at assumed 2x when no player settings panel is injected', () => {
    const h = load({ gmSeed: { disabled: false } })
    const video = h.document.createElement('video')
    Object.assign(video, { playbackRate: 1.5, currentTime: 0, videoHeight: 1080,
        readyState: 4, paused: true, seeking: false, isConnected: true,
        clientWidth: 1920, clientHeight: 1080,
        buffered: { length: 0, start: () => 0, end: () => 0 } })
    h.document.querySelectorAll = selector => selector === 'video' ? [video] : []
    h.clock.advance(1000)
    h.timers.runTimers(1000)
    assert.equal(h.evaluate('playbackRateState.effectiveRate'), 1.5)
    assert.equal(h.pageWindow.BiliCDN.playback.effectiveRate, 2)
    assert.equal(h.pageWindow.BiliCDN.playback.confirmed, false)
})

test('R7: the latest audio-sized transfer replaces the host used as the currently-playing CDN', async () => {
    const h = load({ gmSeed: { disabled: false } })
    await (await h.pageWindow.fetch(`https://${host}/upgcxcode/video-review.m4s`)).arrayBuffer()
    assert.equal(h.evaluate('getPlayingCdnHost()'), host)
    await (await h.pageWindow.fetch(`https://${other}/upgcxcode/audio-review.m4s`)).arrayBuffer()
    assert.equal(h.evaluate('getPlayingCdnHost()'), other)
})
