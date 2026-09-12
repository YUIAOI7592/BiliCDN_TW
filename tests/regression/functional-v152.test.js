'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const { createHash } = require('node:crypto')
const { loadUserscript, runGeneratedClassicWorker } = require('../harness/userscript-vm')
const root = path.resolve(__dirname, '../..')
const baseline = path.join(root, 'tests/fixtures/BiliCDN_TW_1.5.1.user.js')
const target = require('../harness/current-script')
const ali = 'upos-sz-mirroraliov.bilivideo.com'
const other = 'upos-sz-mirrorali02.bilivideo.com'
const now = 1800000000000
const settle = () => new Promise(resolve => setImmediate(resolve))
const load = (file = target, options = {}) => loadUserscript(file, {
    now, ...options, gmSeed: { disabled: false, blicdnVersion: file === baseline ? '1.5.1' : '1.5.2', throughputSchema: 3,
        probeCache_v1: JSON.stringify({ t: now, list: [ali, other] }), ...(options.gmSeed || {}) },
})
const payload = (bandwidth, url = `https://${ali}/upgcxcode/${bandwidth}.m4s?sig=fixture`) => ({
    code: 0, data: { dash: { video: [{ id: 80, height: 1080, bandwidth, codecs: 'avc1.640028', base_url: url }], audio: [] } },
})
const spa = async h => {
    h.pageWindow.history.pushState({}, '', '/video/BV2fixture')
    await h.timers.advanceAsync(0)
}
const video = (h, rate = 2) => {
    const v = h.document.createElement('video')
    Object.assign(v, { playbackRate: rate, currentTime: 0, videoHeight: 1080, readyState: 4,
        paused: true, seeking: false, isConnected: true, clientWidth: 1920, clientHeight: 1080,
        buffered: { length: 0, start: () => 0, end: () => 0 } })
    h.document.querySelectorAll = selector => selector === 'video' ? [v] : []
    return v
}

test('v1.5.3 R3 restriction maps admit only exact catalog keys and remain bounded at startup', () => {
    const variants = Array.from({ length: 129 }, (_, i) => ' '.repeat(i + 1) + ali)
    const records = [ali, ali.toUpperCase(), ...variants, 'outside.invalid']
    const h = load(target, { gmSeed: {
        disabled: true,
        cdnBlacklist: JSON.stringify(records.map(cdn => ({ cdn, expireAt: now + 10000 }))),
        knownDeadHosts_v1: JSON.stringify(records.map(host => ({ host, expireAt: now + 10000, reason: 'timeout' }))),
    } })
    assert.equal(h.evaluate('blacklistRecords.records.size'), 1)
    assert.equal(h.evaluate('deadHostRecords.records.size'), 1)
    assert.equal(h.evaluate(`blacklistSet.has('${ali}') && knownDeadHosts.has('${ali}')`), true)
})

test('v1.5.2 immutable v1.5.1 hash and scheduled timer ordering/cancellation', async () => {
    assert.equal(createHash('sha256').update(fs.readFileSync(baseline)).digest('hex'),
        '88f70ad9e01a9a3a54dd19ac5e624c0354b9084c5c6c696069ce9685194d2321')
    const h = load(target, { gmSeed: { disabled: true } })
    const seen = []
    const cancelled = h.context.setTimeout(() => seen.push('cancelled'), 10)
    h.context.setTimeout(() => { h.context.clearTimeout(cancelled); seen.push('first') }, 5)
    h.context.setTimeout(() => { seen.push('outer'); Promise.resolve().then(() => {
        h.context.setTimeout(() => seen.push('inner'), 0)
    }) }, 20)
    await h.timers.advanceAsync(19)
    assert.deepEqual(seen, ['first'])
    await h.timers.advanceAsync(1)
    assert.deepEqual(seen, ['first', 'outer', 'inner'])
})

for (const [file, repaired] of [[baseline, false], [target, true]]) {
    test(`v1.5.${repaired ? '2' : '1 reproduction'} R1 PCDN 403 retry via Fetch`, async () => {
        const h = load(file, { fetchImpl: async () => new Response('', { status: 403 }) })
        const url = 'https://node.mountaintoys.cn/upgcxcode/lock.m4s?os=mcdn&sig=fixture'
        await h.pageWindow.fetch(url)
        assert.equal(h.evaluate(`isHostLockedStream(${JSON.stringify(url)})`), true)
        const first = h.fetchCalls.at(-1).url
        await h.pageWindow.fetch(url)
        assert.equal(h.fetchCalls.at(-1).url === url, repaired)
        assert.equal(h.evaluate(`getOriginalStreamUrl(${JSON.stringify(first)})`) === url, repaired)
        assert.equal(h.evaluate(`cdnFailCount['${ali}'] || 0`), 0)
    })
    test(`v1.5.${repaired ? '2' : '1 reproduction'} R5 stale Fetch playurl cannot commit`, async () => {
        let completeOld
        const h = load(file, { fetchImpl: async input => String(input).includes('cid=old')
            ? new Promise(resolve => { completeOld = resolve })
            : new Response(JSON.stringify(payload(2000000))) })
        const old = h.pageWindow.fetch('https://api.bilibili.com/x/player/playurl?cid=old')
        await spa(h)
        await h.pageWindow.fetch('https://api.bilibili.com/x/player/playurl?cid=new')
        assert.equal(h.evaluate('currentStreamBitsPerSec'), 2000000)
        completeOld(new Response(JSON.stringify(payload(18000000))))
        await old
        assert.equal(h.evaluate('currentStreamBitsPerSec'), repaired ? 2000000 : 18000000)
    })
    test(`v1.5.${repaired ? '2' : '1 reproduction'} R3 expired restrictions restore candidate membership`, async () => {
        const h = load(file, { gmSeed: {
            knownDeadHosts_v1: JSON.stringify([{ host: ali, expireAt: now + 1000, reason: 'timeout' }]),
            cdnBlacklist: JSON.stringify([{ cdn: other, expireAt: now + 1000 }]),
        } })
        await h.timers.advanceAsync(2000)
        assert.equal(h.evaluate(`knownDeadHosts.has('${ali}')`), !repaired)
        assert.equal(h.evaluate(`blacklistSet.has('${other}')`), !repaired)
        assert.equal(h.evaluate(`getHealthyCdnList().includes('${ali}')`), repaired)
    })
    test(`v1.5.${repaired ? '2' : '1 reproduction'} R6 snapshot updates without settings panel`, async () => {
        const h = load(file)
        video(h, 1.5)
        await h.timers.advanceAsync(1000)
        assert.equal(h.evaluate('playbackRateState.effectiveRate'), 1.5)
        assert.equal(h.pageWindow.BiliCDN.playback.effectiveRate, repaired ? 1.5 : 2)
        if (repaired) assert.equal(h.pageWindow.BiliCDN.updatedAt, h.clock.now)
    })
}

test('v1.5.3 R1/R2 normal mp4 and m3u8 still enter main Fetch/XHR interception after policy extraction', async () => {
    for (const file of [baseline, target]) {
        const h = load(file)
        for (const extension of ['mp4', 'm3u8']) {
            const url = `https://upos-sz-mirrorcosov.bilivideo.com/video/normal.${extension}?sig=test`
            await h.pageWindow.fetch(url)
            assert.notEqual(new URL(h.fetchCalls.at(-1).url).hostname, 'upos-sz-mirrorcosov.bilivideo.com', file)
            const xhr = new h.pageWindow.XMLHttpRequest()
            xhr.open('GET', url)
            assert.notEqual(new URL(xhr.url).hostname, 'upos-sz-mirrorcosov.bilivideo.com', file)
        }
    }
    // Negative control reproduces the scoped-constant mistake found during pre-release review.
    const broken = load(target, { sourceTransform: source => source.replace(
        'mediaUrlPolicy.mediaPathPattern.test(path)', 'MEDIA_PATH_RE.test(path)') })
    const url = 'https://upos-sz-mirrorcosov.bilivideo.com/video/normal.mp4?sig=test'
    await broken.pageWindow.fetch(url)
    assert.equal(broken.fetchCalls.at(-1).url, url)
})

test('v1.5.3 R2 protected URL matrix reaches Fetch, XHR, playurl and sink unchanged', async () => {
    const h = load()
    // Forbidden hosts are separately covered by v183: protected paths cannot
    // be rewritten, so they must locally fail instead of using an excluded host.
    const hosts = [ali, 'upos-sz-mirrorcos.bilivideo.com', 'upos-sz-unlisted.bilivideo.com']
    const urls = hosts.flatMap(host => [
        `https://${host}:8443/upgcxcode/guard.m4s?sig=x`,
        `https://${host}/live-bvc/1/guard.m3u8`,
        `https://${host}/v1/resource/guard.m4s`,
    ])
    for (const url of urls) {
        assert.equal(h.evaluate(`replaceUrlHost(${JSON.stringify(url)}, '${other}')`), null)
        await h.pageWindow.fetch(url)
        assert.equal(h.fetchCalls.at(-1).url, url)
        const xhr = new h.pageWindow.XMLHttpRequest()
        xhr.open('GET', url)
        assert.equal(xhr.url, url)
        const item = h.evaluate(`(() => { const i={base_url:${JSON.stringify(url)},backup_url:[]}; transformStreamItem(i,true);return i })()`)
        assert.equal(item.base_url, url)
    }
})

test('v1.5.3 R1 original backup and root mapping survive repeated normalization', async () => {
    const original = 'https://node.nexusedgeio.com/upgcxcode/original.m4s?os=mcdn&sig=x'
    const h = load()
    const item = h.evaluate(`(() => { const i={base_url:${JSON.stringify(original)},backup_url:[]};playInfoTransformer({data:{dash:{video:[i],audio:[]}}},{trustedTransport:true});return i })()`)
    assert.equal(item.backup_url.at(-1), original)
    await h.pageWindow.fetch(original)
    assert.equal(h.fetchCalls.at(-1).url, original)
    const again = h.evaluate(`replaceUrlHost(${JSON.stringify(item.base_url)}, '${other}')`)
    assert.equal(h.evaluate(`getOriginalStreamUrl(${JSON.stringify(again)})`), original)
})

test('v1.5.3 R4 partial sampling uses the common 128 KiB floor', async () => {
    for (const bytes of [1024, 64 * 1024, 128 * 1024]) {
        const h = load(target, { fetchImpl: async () => new Response(new ReadableStream({
            start(c) { c.enqueue(new Uint8Array(bytes)) },
        }), { status: 206 }) })
        const pending = h.evaluate(`probeCdnThroughput('${other}','https://${ali}/upgcxcode/probe.m4s',768*1024)`)
        await h.timers.advanceAsync(3000)
        const result = await pending
        const accepted = bytes >= 128 * 1024
        assert.equal(h.evaluate(`(cdnHealth['${other}'] || {}).samples || 0`), accepted ? 1 : 0)
        assert.equal(h.evaluate('redirectStats.partialProbeSamples || 0'), accepted ? 1 : 0)
        assert.equal(result.status, accepted ? 'partial' : bytes >= 64 * 1024 ? 'latency-only' : 'insufficient')
    }
})

test('v1.5.3 R4 cap completion cancels reader immediately without a second read', async () => {
    let cancelCount = 0
    const h = load(target, { fetchImpl: async () => new Response(new ReadableStream({
        start(c) { c.enqueue(new Uint8Array(768 * 1024)) }, cancel() { cancelCount++ },
    }), { status: 206 }) })
    const pending = h.evaluate(`probeCdnThroughput('${other}','https://${ali}/upgcxcode/cap.m4s',768*1024)`)
    const result = await pending
    assert.equal(result.completion, 'complete')
    assert.equal(result.bytes, 768 * 1024)
    assert.equal(cancelCount, 1)
    assert.equal(h.evaluate('redirectStats.partialProbeSamples || 0'), 0)
})
