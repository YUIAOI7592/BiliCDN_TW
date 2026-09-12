'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { loadUserscript } = require('../harness/userscript-vm')
const root = path.resolve(__dirname, '../..')
const target = require('../harness/current-script')
const previous = path.join(root, 'tests/fixtures/BiliCDN_TW_1.5.1.user.js')
const ali = 'upos-sz-mirroraliov.bilivideo.com'
const other = 'upos-sz-mirrorali02.bilivideo.com'
const epoch = 1800000000000
const settle = () => new Promise(resolve => setImmediate(resolve))
const exposeToggle = source => source.replace('const setRuntimeDisabled = (nextDisabled) => {',
    'const setRuntimeDisabled = globalThis.testToggle = (nextDisabled) => {')
const load = (options = {}, file = target) => loadUserscript(file, {
    now: epoch, ...options, gmSeed: { disabled: false, blicdnVersion: file === previous ? '1.5.1' : '1.5.2', throughputSchema: 3,
        probeCache_v1: JSON.stringify({ t: epoch, list: [ali, other] }), ...(options.gmSeed || {}) },
})
const playurl = 'https://api.bilibili.com/x/player/playurl?cid='
const segment = `https://${ali}/upgcxcode/fixture.m4s?sig=test`
const body = (bandwidth = 2000000) => ({ code: 0, data: { dash: {
    video: [{ id: 80, height: 1080, bandwidth, codecs: 'avc1.640028', base_url: segment }], audio: [],
} } })
const spa = async h => { h.pageWindow.history.pushState({}, '', '/video/BVnext?p=2'); await h.timers.advanceAsync(0) }
const setVideo = (h, rate = 2) => {
    const v = h.document.createElement('video')
    Object.assign(v, { playbackRate: rate, currentTime: 0, videoHeight: 1080, readyState: 4,
        paused: false, seeking: false, ended: false, isConnected: true, clientWidth: 1920, clientHeight: 1080 })
    let ahead = 60
    v.buffered = { length: 1, start: () => 0, end: () => v.currentTime + ahead }
    v.setAhead = n => { ahead = n }
    const old = h.document.querySelectorAll.bind(h.document)
    h.document.querySelectorAll = selector => selector === 'video' ? [v] : old(selector)
    return v
}

test('R1/R2 URL limits, protocol-relative and media guards remain enforced at the real main Fetch sink', async () => {
    const h = load()
    const prefix = 'https://node.mountaintoys.cn/upgcxcode/a.m4s?sig='
    for (const url of [
        `//${other}:8443/upgcxcode/a.m4s`, `//${other}/live-bvc/a.m3u8`,
        `//${other}/v1/resource/a.m4s`, 'ftp://node.mountaintoys.cn/upgcxcode/a.m4s',
        prefix + 'x'.repeat(16385 - prefix.length), `https://${other}/not-media.txt`,
    ]) {
        await h.pageWindow.fetch(url)
        assert.equal(h.fetchCalls.at(-1).url, url)
    }
    for (const url of ['//node.mountaintoys.cn/upgcxcode/a.m4s?sig=x',
        `https://${'long'.repeat(20)}.mountaintoys.cn/upgcxcode/a.m4s?sig=` + 'x'.repeat(16190 - 80)]) {
        await h.pageWindow.fetch(url)
        assert.equal(h.evaluate(`TRUSTED_CDN_CATALOG_SET.has(${JSON.stringify(new URL(h.fetchCalls.at(-1).url).hostname)})`), true)
    }
    const source = `https://${other}/upgcxcode/a.m4s?sig=`
    const boundary = source + 'x'.repeat(16384 - source.length)
    assert.equal(h.evaluate(`mediaUrlPolicy.decide(${JSON.stringify(boundary)}).action`), 'rewrite')
    assert.equal(h.evaluate(`mediaUrlPolicy.decide(${JSON.stringify(boundary + 'x')}).action`), 'pass')
    assert.equal(h.evaluate('rewrittenStreamOrigins.size <= 512'), true)
})

test('R1 rewritten XHR 403 restores original backup without target penalty', () => {
    const h = load()
    const original = 'https://node.mountaintoys.cn/upgcxcode/locked.m4s?os=mcdn&sig=x'
    const x = new h.pageWindow.XMLHttpRequest()
    x.open('GET', original); x.send(); const rewritten = x.url
    x.respond({ status: 403 })
    assert.equal(h.evaluate(`cdnFailCount['${ali}'] || 0`), 0)
    x.open('GET', rewritten)
    assert.equal(x.url, original)
    const object = h.evaluate(`({ primary: ${JSON.stringify(rewritten)}, backup: [${JSON.stringify(original)}] })`)
    h.context.testObject = object
    h.evaluate('sanitizePlayInfoUrls(testObject)')
    assert.equal(object.primary, original)
    assert.equal(object.backup[0], original)
})

test('R1 root registry is bounded after 513 real PCDN Fetch rewrites', async () => {
    const h = load()
    for (let n = 0; n < 513; n++) await h.pageWindow.fetch(`https://node.mountaintoys.cn/upgcxcode/${n}.m4s`)
    assert.equal(h.evaluate('rewrittenStreamOrigins.size'), 512)
})

test('R5 Fetch body finishing after SPA returns original bytes and preserves response metadata', async () => {
    let controller
    const h = load({ fetchImpl: async input => String(input).endsWith('old')
        ? Object.defineProperty(new Response(new ReadableStream({ start(c) { controller = c } }),
            { headers: { 'x-test': 'yes' }, status: 200 }), 'url', { value: playurl + 'old' })
        : new Response(JSON.stringify(body())) })
    const old = h.pageWindow.fetch(playurl + 'old')
    await settle(); await spa(h)
    await h.pageWindow.fetch(playurl + 'new')
    const before = h.evaluate('JSON.stringify({ profile:streamProfile, codec:lastCodecDecision, timer:bakeoffTimer })')
    const raw = JSON.stringify(body(18000000))
    controller.enqueue(new TextEncoder().encode(raw)); controller.close()
    const out = await old
    assert.equal(await out.text(), raw)
    assert.equal(out.url, playurl + 'old')
    assert.equal(out.headers.get('x-test'), 'yes')
    assert.equal(h.evaluate('JSON.stringify({ profile:streamProfile, codec:lastCodecDecision, timer:bakeoffTimer })'), before)
})

for (const responseType of ['text', 'json']) {
    test(`R5 XHR ${responseType}: delayed read, same-generation quality, repeat getters and re-open`, async () => {
        const h = load()
        const x = new h.pageWindow.XMLHttpRequest()
        x.open('GET', playurl + 'old'); x.responseType = responseType; x.send()
        const rawObject = body(18000000), raw = responseType === 'json' ? rawObject : JSON.stringify(rawObject)
        x.respond({ response: raw, responseText: typeof raw === 'string' ? raw : '' })
        await spa(h)
        assert.equal(x.response, raw)
        assert.equal(h.evaluate('currentStreamBitsPerSec'), 0)
        x.open('GET', playurl + 'new'); x.send()
        x.respond({ response: raw, responseText: typeof raw === 'string' ? raw : '' })
        const first = x.response
        h.evaluate("representationRegistry.set('test-cache-marker', {})")
        assert.equal(x.response, first)
        if (responseType === 'text') assert.equal(x.responseText, first)
        else { assert.notEqual(first, rawObject); assert.deepEqual(rawObject, body(18000000)) }
        assert.equal(h.evaluate("representationRegistry.has('test-cache-marker')"), true)
        x.open('GET', playurl + 'quality'); x.send()
        const quality = body(9000000)
        x.respond({ response: responseType === 'json' ? quality : JSON.stringify(quality) })
        void x.response
        assert.equal(h.evaluate('currentStreamBitsPerSec'), 9000000)
    })
}

test('R5 disabled/re-enabled generation rejects pending Fetch and XHR, without cancelling players', async () => {
    let done
    const h = load({ sourceTransform: exposeToggle, fetchImpl: async () => new Promise(resolve => { done = resolve }) })
    const pending = h.pageWindow.fetch(playurl + 'old')
    const x = new h.pageWindow.XMLHttpRequest(); x.open('GET', playurl + 'old'); x.send()
    h.context.testToggle(true); h.context.testToggle(false)
    const raw = JSON.stringify(body(18000000))
    done(new Response(raw)); x.respond({ responseText: raw, response: raw })
    assert.equal(await (await pending).text(), raw)
    assert.equal(x.responseText, raw)
    assert.equal(h.evaluate('currentStreamBitsPerSec'), 0)
    assert.equal(x.aborted, undefined)
})

test('R4 statuses: exact floor, below floor, short EOF, 200 ignoring Range and oversized chunk', async () => {
    for (const [bytes, cap, status] of [[131071, 786432, 206], [131072,786432,206], [1048576,786432,200], [786432,786432,206]]) {
        let h, cancelCount = 0
        h = load({ fetchImpl: async () => new Response(new ReadableStream({
            async pull(c) { await settle(); h.clock.advance(10); c.enqueue(new Uint8Array(bytes)); c.close() },
            cancel() { cancelCount++ },
        }), { status }) })
        const r = await h.evaluate(`probeCdnThroughput('${other}', '${segment}', ${cap})`)
        assert.equal(r.bytes, Math.min(bytes, cap))
        assert.equal(r.accepted, bytes >= 131072)
        assert.equal(r.completion, 'complete')
        assert.equal(h.evaluate(`(cdnHealth['${other}'] || {}).samples || 0`), bytes >= 131072 ? 1 : 0)
        await h.timers.advanceAsync(3001)
        assert.equal(h.evaluate(`(cdnHealth['${other}'] || {}).samples || 0`), bytes >= 131072 ? 1 : 0)
        assert.ok(cancelCount <= 1)
    }
})

for (const kind of ['external', 'disable', 'spa', '403', 'read-error']) {
    test(`R4 ${kind} completes once and rejects even a sufficient prefix`, async () => {
        let stream
        const h = load({ sourceTransform: exposeToggle, fetchImpl: async () => kind === '403'
            ? new Response('', { status: 403 }) : new Response(new ReadableStream({
                start(c) { stream = c; c.enqueue(new Uint8Array(131072)) },
            }), { status: 206 }) })
        h.context.external = new AbortController()
        const p = h.evaluate(`probeCdnThroughput('${other}', '${segment}', 786432, external.signal)`)
        await settle()
        if (kind === 'external') h.context.external.abort('external-reason')
        if (kind === 'disable') h.context.testToggle(true)
        if (kind === 'spa') await spa(h)
        if (kind === 'read-error') stream.error(new Error('read failed'))
        const result = await p
        assert.equal(result.status, kind === '403' ? 'forbidden' : kind === 'read-error' ? 'failed' : 'cancelled')
        assert.equal(h.evaluate(`(cdnHealth['${other}'] || {}).samples || 0`), 0)
        await h.timers.advanceAsync(3001)
        assert.equal(h.evaluate(`(cdnHealth['${other}'] || {}).samples || 0`), 0)
        assert.equal(h.evaluate('redirectStats.partialProbeSamples'), 0)
    })
}

test('R3 expired black keeps overlapping dead/override/soft and merges a newer shared-GM restriction', async () => {
    const h = load({ gmSeed: {
        cdnBlacklist: JSON.stringify([{ cdn: ali, expireAt: epoch + 1000 }, { cdn: other, expireAt: epoch + 1000 }]),
        knownDeadHosts_v1: JSON.stringify([{ host: ali, expireAt: epoch + 3000, reason: 'timeout' }]),
        catalogOverrides_v1: { [other]: false },
    } })
    h.evaluate(`cdnSoftBlockUntil['${ali}'] = Date.now()+10000`)
    await h.timers.advanceAsync(999)
    assert.equal(h.evaluate(`blacklistSet.has('${ali}')`), true)
    await h.timers.advanceAsync(2)
    assert.equal(h.evaluate(`blacklistSet.has('${ali}')`), false)
    assert.equal(h.evaluate(`knownDeadHosts.has('${ali}')`), true)
    assert.equal(h.evaluate(`getHealthyCdnList().includes('${other}')`), false)
    // Simulates another tab's committed GM update immediately before this tab's expiry sweep.
    h.gm.set('knownDeadHosts_v1', JSON.stringify([{ host: ali, expireAt: epoch + 9000, reason: 'timeout-new' }]))
    await h.timers.advanceAsync(3000)
    assert.equal(h.evaluate(`knownDeadHosts.has('${ali}')`), true)
    assert.equal(JSON.parse(h.gm.get('knownDeadHosts_v1'))[0].expireAt, epoch + 9000)
    const restrictionWrites = () => h.gmWrites.filter(e => /cdnBlacklist|knownDeadHosts/.test(e.key)).length
    const writes = restrictionWrites(), requests = h.fetchCalls.length
    await h.timers.advanceAsync(1000)
    assert.equal(restrictionWrites(), writes)
    assert.equal(h.fetchCalls.length, requests)
})

test('R3 disabled expiry does not persist until re-enable, fixed CDN remains fixed', async () => {
    const h = load({ sourceTransform: exposeToggle, customCdn: ali, gmSeed: {
        knownDeadHosts_v1: JSON.stringify([{ host: other, expireAt: epoch + 1000, reason: 'timeout' }]),
    } })
    h.context.testToggle(true)
    const writes = h.gmWrites.length
    await h.timers.advanceAsync(2000)
    assert.equal(h.gmWrites.length, writes)
    h.context.testToggle(false)
    assert.equal(h.evaluate(`knownDeadHosts.has('${other}')`), false)
    assert.equal(h.evaluate('getCurrentCdn()'), ali)
})

test('R6 hidden panel snapshot and buffer seconds do not pretend cumulative MB is buffered', async () => {
    const h = load()
    const v = setVideo(h, 8)
    await h.timers.advanceAsync(1000)
    h.evaluate(`Watchdog.noteExternalBytes('${ali}',100*1024*1024)`)
    v.setAhead(16)
    await h.timers.advanceAsync(1000)
    const snapshot = h.pageWindow.BiliCDN
    assert.equal(snapshot.playback.effectiveRate, 4)
    assert.equal(snapshot.buffer.playableSec, 2, 'display uses observed 8x, not 4x network clamp')
    assert.equal(snapshot.buffer.downloadedMB, 100)
    v.setAhead(4)
    await h.timers.advanceAsync(1000)
    assert.equal(h.pageWindow.BiliCDN.buffer.playableSec, 0.5)
    assert.equal(h.pageWindow.BiliCDN.buffer.downloadedMB, 100)
    assert.equal(Object.isFrozen(h.pageWindow.BiliCDN.buffer), true)
    const cached = h.pageWindow.BiliCDN, writes = h.gmWrites.length, calls = h.fetchCalls.length
    for (let i = 0; i < 1000; i++) assert.equal(h.pageWindow.BiliCDN, cached)
    assert.equal(h.gmWrites.length, writes); assert.equal(h.fetchCalls.length, calls)
    assert.doesNotMatch(h.evaluate('describePlaybackBuffer(Watchdog.stats())'), /MB|%|已滿/)
})

test('R6 no video is unavailable, and SPA/toggle publish immediately', async () => {
    const h = load({ sourceTransform: exposeToggle })
    assert.equal(h.pageWindow.BiliCDN.buffer.available, false)
    assert.equal(h.pageWindow.BiliCDN.buffer.playableSec, null)
    assert.match(h.evaluate('describePlaybackBuffer(Watchdog.stats())'), /無資料/)
    const v = setVideo(h, 1.5); await h.timers.advanceAsync(1000)
    h.context.testToggle(true)
    assert.equal(h.pageWindow.BiliCDN.disabled, true)
    h.context.testToggle(false)
    assert.equal(h.pageWindow.BiliCDN.disabled, false)
    v.playbackRate = 1 // New video's transient 1x, before the companion script applies 2x.
    await spa(h)
    assert.equal(h.pageWindow.BiliCDN.playback.confirmed, false)
    assert.equal(h.pageWindow.BiliCDN.playback.effectiveRate, 2)
})

test('R4 playurl interception plus trusted reassess completes full-budget probes and shows a result before timeout', async () => {
    let h
    const cancelled = []
    h = load({ fetchImpl: async (input, init = {}) => {
        if (String(input).startsWith(playurl)) return new Response(JSON.stringify(body()))
        if (!init.headers?.Range) return new Response('ok')
        const bytes = +init.headers.Range.split('-')[1] + 1
        return new Response(new ReadableStream({
            pull(c) { h.clock.advance(10); c.enqueue(new Uint8Array(bytes)) },
            cancel(reason) { cancelled.push(reason) },
        }, { highWaterMark: 0 }), { status: 206 })
    } })
    setVideo(h, 2)
    await h.pageWindow.fetch(playurl + 'manual-budget')
    h.menus[0].callback()
    const host = h.document.getElementById('bilicdn-trusted-menu-ui')
    const shadow = h.getClosedShadowRoot(host)
    const action = shadow.querySelector('[data-ui-action="reassess"]')
    assert.ok(action)
    action.click() // Page synthetic click cannot initiate a measurement.
    await settle()
    assert.equal(h.fetchCalls.filter(c => c.init?.headers?.Range).length, 0)
    action.dispatchEvent(new h.context.Event('click', { isTrusted: true }))
    for (let i = 0; i < 15; i++) await settle()
    const probes = h.fetchCalls.filter(c => c.init?.headers?.Range)
    assert.ok(probes.length > 0 && probes.length <= 4)
    assert.equal(cancelled.length, probes.length)
    assert.ok(cancelled.every(reason => reason === 'complete'))
    assert.equal(h.evaluate('bakeoffRunning'), false)
    assert.ok(probes.every(c => h.evaluate(`cdnHealth[${JSON.stringify(new URL(c.url).hostname)}].samples`) > 0))
    const text = node => [node.textContent || '', ...node.children.map(text)].join('\n')
    assert.match(text(shadow), /測速完成/)
    assert.ok(h.clock.now - epoch < 3000, 'no internal timeout or extra EOF read was needed')
})

test('R1-R6 healthy 2x replay through startup, 90 seconds and four-minute bakeoff stays within v1.5.1 traffic', async t => {
    const run = async file => {
        let h
        h = load({ fetchImpl: async (input, init = {}) => {
            if (String(input).startsWith(playurl)) return new Response(JSON.stringify(body()))
            if (String(input).includes('crossdomain')) return new Response('ok')
            const count = init.headers?.Range ? +init.headers.Range.split('-')[1] + 1 : 256 * 1024
            return new Response(new ReadableStream({ async start(c) {
                await settle(); h.clock.advance(10); c.enqueue(new Uint8Array(count)); c.close()
            } }), { status: 206 })
        } }, file)
        const v = setVideo(h, 2)
        await h.pageWindow.fetch(playurl + 'healthy')
        const checkpoints = []
        for (let seconds = 5; seconds <= 250; seconds += 5) {
            await (await h.pageWindow.fetch(segment)).arrayBuffer()
            v.currentTime += 10
            await h.timers.advanceAsync(5000)
            if ([5,90,240,250].includes(seconds)) checkpoints.push({
                at: seconds,
                player: h.fetchCalls.filter(c => !c.init?.headers?.Range && !c.url.includes('crossdomain')).length,
                probes: h.fetchCalls.filter(c => c.init?.headers?.Range).length,
                bytes: h.fetchCalls.reduce((sum,c) => sum + (c.init?.headers?.Range ? +c.init.headers.Range.split('-')[1] + 1 : 0), 0),
            })
        }
        return checkpoints
    }
    const old = await run(previous), current = await run(target)
    t.diagnostic('Healthy 2x replay (requested Range bytes, not wire bytes): ' + JSON.stringify({ old, current }))
    for (let i = 0; i < old.length; i++) {
        assert.equal(current[i].player, old[i].player)
        assert.ok(current[i].probes <= old[i].probes, JSON.stringify({ old, current }))
        assert.ok(current[i].bytes <= old[i].bytes, JSON.stringify({ old, current }))
    }
})
