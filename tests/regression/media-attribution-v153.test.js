'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { createHash } = require('node:crypto')
const F = require('../harness/v153-fixture')

test('v153 fixed v152 reproduction: immutable SHA and audio replaces video CDN', async () => {
    assert.equal(createHash('sha256').update(fs.readFileSync(F.previous)).digest('hex'),
        'd04509d69bf48950de496d480590181e6d874c6e03e379560196044a0931bfe3')
    const h = F.load({}, F.previous)
    F.video(h); await F.prime(h)
    await F.consume(h, F.mediaUrl('av1')); assert.equal(h.evaluate('getPlayingCdnHost()'), F.ali)
    await F.consume(h, F.mediaUrl('audio', F.other)); assert.equal(h.evaluate('getPlayingCdnHost()'), F.other)
})

test('v153 media: real Fetch video/audio/unknown observations stay separate', async () => {
    const h = F.load(); F.video(h); await F.prime(h)
    await F.consume(h, F.mediaUrl('av1'))
    await F.consume(h, F.mediaUrl('audio', F.other))
    await F.consume(h, F.mediaUrl('unregistered', F.other))
    assert.equal(h.evaluate('getPlayingCdnHost()'), F.ali)
    const d = F.json(h, 'getMediaDeliverySnapshot()')
    assert.equal(d.video.host, F.ali); assert.equal(d.audio.host, F.other)
    assert.equal(d.video.source, 'fetch'); assert.equal(d.video.fresh, true)
    assert.equal(h.evaluate('Watchdog.stats().totalMB'), +(3072 / 1024 / 1024).toFixed(2))
    assert.equal(h.evaluate('getAttributedVideoHost()'), F.ali)
    h.clock.advance(30001)
    assert.equal(h.evaluate('getAttributedVideoHost()'), null)
    assert.equal(F.json(h, 'getMediaDeliverySnapshot()').video.fresh, false)
})

test('v153 media: audio extras, backups, protocol relative and identity collisions', async () => {
    const p = F.payload()
    p.data.dash.video[0].backup_url = ['//' + F.other + '/upgcxcode/backup.m4s?sig=fixture']
    p.data.dash.flac = { audio: { bandwidth: 1000000, base_url: F.mediaUrl('flac', F.other) } }
    p.data.dash.dolby = { audio: [{ bandwidth: 300000, base_url: F.mediaUrl('dolby', F.other) }] }
    const h = F.load({ payload: p }); F.video(h); await F.prime(h)
    await F.consume(h, F.mediaUrl('backup', F.other))
    assert.equal(h.evaluate('getAttributedVideoHost()'), F.other)
    for (const name of ['flac', 'dolby']) {
        await F.consume(h, F.mediaUrl(name, F.other))
        assert.equal(F.json(h, 'getMediaDeliverySnapshot()').audio.host, F.other)
    }
    p.data.dash.audio[0].base_url = F.mediaUrl('av1', F.other)
    const conflict = F.load({ payload: p }); F.video(conflict); await F.prime(conflict)
    await F.consume(conflict, F.mediaUrl('av1'))
    assert.equal(conflict.evaluate('getAttributedVideoHost()'), null)
})

test('v153 media: XHR progress and repeated open retain kind and request epoch', async () => {
    const h = F.load(); F.video(h); await F.prime(h)
    const x = new h.pageWindow.XMLHttpRequest()
    x.open('GET', F.mediaUrl('av1')); x.send(); x.progress(512)
    assert.equal(h.evaluate('getAttributedVideoHost()'), F.ali)
    x.respond({ response: new Uint8Array(1024).buffer, headers: { 'content-length': '1024' } })
    x.open('GET', F.mediaUrl('audio', F.other)); x.send(); x.progress(512)
    assert.equal(h.evaluate('getAttributedVideoHost()'), F.ali)
    const old = new h.pageWindow.XMLHttpRequest()
    old.open('GET', F.mediaUrl('av1')); old.send()
    await F.prime(h)
    old.progress(4096)
    assert.equal(h.evaluate('getAttributedVideoHost()'), null)
    x.open('GET', F.mediaUrl('av1')); x.send(); x.progress(2048)
    assert.equal(h.evaluate('getAttributedVideoHost()'), F.ali)
})

test('v153 media: performance and Worker bytes cannot establish punitive video evidence', async () => {
    const h = F.load(); F.video(h); await F.prime(h)
    h.emitPerformanceEntries([{ name: F.mediaUrl('av1'), transferSize: 256000, duration: 100, responseStart: 1, responseEnd: 101 }])
    assert.equal(h.evaluate('getAttributedVideoHost()'), null)
    h.evaluate(`Watchdog.noteExternalBytes('${F.other}', 1024)`)
    assert.equal(h.evaluate('getAttributedVideoHost()'), null)
    await F.consume(h, F.mediaUrl('av1'))
    h.evaluate(`Watchdog.noteExternalBytes('${F.other}', 1024)`)
    assert.equal(h.evaluate('getAttributedVideoHost()'), F.ali)
    await F.spa(h)
    assert.equal(h.evaluate('getAttributedVideoHost()'), null)
})

test('v153 media: registries are bounded and audio never evicts video', async () => {
    const p = F.payload()
    p.data.dash.video = Array.from({ length: 130 }, (_, n) => F.rep('av1', F.ali, 'v' + n))
    p.data.dash.audio = Array.from({ length: 80 }, (_, n) => ({ bandwidth: 128000, base_url: F.mediaUrl('a' + n, F.other) }))
    const h = F.load({ payload: p }); F.video(h); await F.prime(h)
    assert.equal(h.evaluate('representationRegistry.size'), 128)
    assert.equal(h.evaluate('audioRepresentationRegistry.size'), 64)
    await F.consume(h, F.mediaUrl('v129'))
    assert.equal(h.evaluate('getAttributedVideoHost()'), F.ali)
    const report = h.evaluate('buildDiagReport()')
    assert.doesNotMatch(report, /upgcxcode|sig=fixture|https:\/\//)
})

test('v153 media: DURL is muxed, mismatched video height is not punitive, delayed Fetch epoch stays stale', async () => {
    const durl = { code: 0, data: { durl: [{ url: F.mediaUrl('muxed'), backup_url: [] }] } }
    const muxed = F.load({ payload: durl }); F.video(muxed); await F.prime(muxed)
    await F.consume(muxed, F.mediaUrl('muxed'))
    assert.equal(F.json(muxed, 'getMediaDeliverySnapshot()').muxed.host, F.ali)
    assert.equal(muxed.evaluate('getAttributedVideoHost()'), null)
    let send
    const h = F.load({ fetchImpl: async url => String(url).includes('/x/player/playurl')
        ? new Response(JSON.stringify(F.payload()))
        : new Response(new ReadableStream({ start(controller) { send = controller } })) })
    F.video(h, 1080); await F.prime(h)
    const response = await h.pageWindow.fetch(F.mediaUrl('av1'))
    const reading = response.arrayBuffer()
    await F.prime(h)
    send.enqueue(new Uint8Array(128)); send.close(); await reading
    assert.equal(h.evaluate('getAttributedVideoHost()'), null)
    assert.equal(h.evaluate('observedVideoRepresentation'), null)
})

test('v153 media: Watchdog punishes identified video only, never audio, performance or rank fallback', async () => {
    const options = { sourceTransform: source => source.replace('const switchCdn = (reason) => {',
        'const switchCdn = globalThis.testWatchdogSwitch = (reason) => {') }
    for (const mode of ['video-audio', 'unknown', 'performance']) {
        const h = F.load(options); F.video(h); await F.prime(h)
        if (mode === 'video-audio') {
            await F.consume(h, F.mediaUrl('av1')); await F.consume(h, F.mediaUrl('audio', F.other))
        } else if (mode === 'unknown') await F.consume(h, F.mediaUrl('unknown', F.other))
        else h.emitPerformanceEntries([{ name: F.mediaUrl('av1'), transferSize: 256000, duration: 100 }])
        h.context.testWatchdogSwitch('fixture-stall')
        assert.equal(h.evaluate(`cdnHealth['${F.ali}']?.failures || 0`), mode === 'video-audio' ? 1 : 0)
        assert.equal(h.evaluate(`cdnHealth['${F.other}']?.failures || 0`), 0)
        assert.equal(h.evaluate('Watchdog.stats().switchCount'), 1)
    }
})

test('v153 media: real audio rejection is handled immediately without video penalty; abort is exempt', async () => {
    for (const errorName of ['TypeError', 'AbortError']) {
        const h = F.load({ fetchImpl: async url => {
            if (String(url).includes('/x/player/playurl')) return new Response(JSON.stringify(F.payload()))
            if (String(url).includes('audio.m4s')) { const e = new Error('fixture'); e.name = errorName; throw e }
            return new Response(new Uint8Array(1024))
        } }); F.video(h); await F.prime(h); await F.consume(h, F.mediaUrl('av1'))
        await assert.rejects(h.pageWindow.fetch(F.mediaUrl('audio', F.other)))
        assert.equal(h.evaluate(`cdnHealth['${F.ali}']?.failures || 0`), 0)
        assert.equal(h.evaluate(`(cdnHealth['${F.other}']?.failures || 0) > 0`), errorName === 'TypeError')
    }
})

test('v153 media: concurrent responses, unrelated redirect, same-host audio and height mismatch stay correctly attributed', async () => {
    const pending = new Map()
    const h = F.load({ fetchImpl: async url => {
        if (String(url).includes('/x/player/playurl')) return new Response(JSON.stringify(F.payload()))
        const response = new Response(new ReadableStream({ start(c) { pending.set(String(url), c) } }))
        if (String(url).includes('unregistered')) Object.defineProperty(response, 'url', { value: F.mediaUrl('unrelated') })
        return response
    } }); const v = F.video(h); await F.prime(h)
    const video = F.consume(h, F.mediaUrl('av1')), audio = F.consume(h, F.mediaUrl('audio', F.ali))
    await F.settle()
    pending.get(F.mediaUrl('av1')).enqueue(new Uint8Array(256)); pending.get(F.mediaUrl('av1')).close(); await video
    pending.get(F.mediaUrl('audio', F.ali)).enqueue(new Uint8Array(256)); pending.get(F.mediaUrl('audio', F.ali)).close(); await audio
    assert.equal(h.evaluate('getAttributedVideoHost()'), F.ali)
    assert.equal(F.json(h, 'getMediaDeliverySnapshot()').audio.host, F.ali)
    v.videoHeight = 1080
    assert.equal(h.evaluate('getAttributedVideoHost()'), null)
    const redirect = F.consume(h, F.mediaUrl('unregistered')); await F.settle()
    pending.get(F.mediaUrl('unregistered')).enqueue(new Uint8Array(256)); pending.get(F.mediaUrl('unregistered')).close(); await redirect
    assert.equal(F.json(h, 'getMediaDeliverySnapshot()').unknown.host, F.ali)
})

test('v153 media: redirected registered video to an unknown identity is not punitive evidence', async () => {
    const h = F.load({ fetchImpl: async url => {
        if (String(url).includes('/x/player/playurl')) return new Response(JSON.stringify(F.payload()))
        const response = new Response(new Uint8Array(1024))
        Object.defineProperty(response, 'url', { value: F.mediaUrl('not-in-playurl', F.other) })
        return response
    } }); F.video(h); await F.prime(h); await F.consume(h, F.mediaUrl('av1'))
    assert.equal(h.evaluate('getAttributedVideoHost()'), null)
    assert.equal(F.json(h, 'getMediaDeliverySnapshot()').unknown.host, F.other)
})

test('v153 2x dual-CDN replay through 90s and 4 minutes does not increase requests or measurement budgets', async t => {
    const replay = async file => {
        let h
        h = F.load({ locks: { request: async (name, options, callback) => callback({ name }) },
            fetchImpl: async (url, init = {}) => {
                if (String(url).includes('/x/player/playurl')) return new Response(JSON.stringify(F.payload()))
                if (String(url).includes('crossdomain')) return new Response('ok')
                const count = init.headers?.Range ? +init.headers.Range.split('-')[1] + 1 : 262144
                return new Response(new ReadableStream({ async start(c) {
                    await F.settle(); h.clock.advance(10); c.enqueue(new Uint8Array(count)); c.close()
                } }), { status: 206 })
            } }, file)
        const v = F.video(h); v.paused = false; await F.prime(h)
        await h.timers.advanceAsync(2500); await F.settle()
        const checkpoints = []
        for (let seconds = 5; seconds <= 250; seconds += 5) {
            await F.consume(h, F.mediaUrl('av1')); await F.consume(h, F.mediaUrl('audio', F.other))
            v.currentTime += 10
            if (seconds === 120) { v.seeking = true; v.dispatchEvent(new F.FakeEvent('seeking', { isTrusted: true })); v.currentTime += 40 }
            if (seconds === 125) { v.seeking = false; v.dispatchEvent(new F.FakeEvent('seeked', { isTrusted: true })) }
            await h.timers.advanceAsync(5000)
            if ([5,90,240,250].includes(seconds)) checkpoints.push({ at: seconds,
                player: h.fetchCalls.filter(c => !c.init?.headers?.Range && !c.url.includes('crossdomain')).length,
                probes: h.fetchCalls.filter(c => c.init?.headers?.Range).length,
                bytes: h.fetchCalls.reduce((n,c) => n + (c.init?.headers?.Range ? +c.init.headers.Range.split('-')[1] + 1 : 0), 0),
            })
        }
        return checkpoints
    }
    const old = await replay(F.previous), current = await replay(F.target)
    t.diagnostic('Dual-CDN 2x replay (Range budget, not wire bytes): ' + JSON.stringify({ old, current }))
    assert.ok(old[0].probes > 0, 'startup measurement must actually run in this comparison')
    for (let i = 0; i < old.length; i++) {
        assert.equal(current[i].player, old[i].player)
        assert.ok(current[i].probes <= old[i].probes)
        assert.ok(current[i].bytes <= old[i].bytes)
    }
})

test('v153 transport: identified audio and video failures have no added wait versus v152', async t => {
    const results = []
    for (const file of [F.previous, F.target]) for (const kind of ['av1', 'audio']) {
        const h = F.load({ fetchImpl: async url => {
            if (String(url).includes('/x/player/playurl')) return new Response(JSON.stringify(F.payload()))
            if (String(url).includes('crossdomain')) return new Response('ok')
            throw new TypeError('verified network failure')
        } }, file); F.video(h); await F.prime(h)
        const host = kind === 'audio' ? F.other : F.ali, started = h.clock.now
        await assert.rejects(h.pageWindow.fetch(F.mediaUrl(kind, host)), TypeError)
        assert.ok(h.evaluate(`cdnHealth['${host}'].failures`) > 0)
        results.push({ version: file === F.previous ? 'v152' : 'v153', kind, elapsed: h.clock.now - started })
    }
    t.diagnostic('Verified failure bookkeeping elapsed VM ms: ' + JSON.stringify(results))
    assert.ok(results[2].elapsed <= results[0].elapsed); assert.ok(results[3].elapsed <= results[1].elapsed)
})

test('v153 2x draining-buffer tick repairs with video attribution, without blaming the interleaved audio', async () => {
    const h = F.load(); const v = F.video(h); v.paused = false
    await F.prime(h)
    let repaired = false
    for (let sec = 1; sec <= 30; sec++) {
        await F.consume(h, F.mediaUrl('av1')); await F.consume(h, F.mediaUrl('audio', F.other))
        v.currentTime += 2; v.setAhead(Math.max(2, 15 - sec * 0.5))
        await h.timers.advanceAsync(1000)
        if (h.evaluate('Watchdog.stats().switchCount') > 0) { repaired = true; break }
    }
    assert.equal(repaired, true)
    assert.ok(h.evaluate(`cdnHealth['${F.ali}']?.failures || 0`) > 0)
    assert.equal(h.evaluate(`cdnHealth['${F.other}']?.failures || 0`), 0)
})
