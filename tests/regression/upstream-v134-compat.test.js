'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadUserscript } = require('../harness/userscript-vm')

const root = path.resolve(__dirname, '../..')
const baseline = path.join(root, 'baseline', 'BiliCDN_TW_1.3.4.original.user.js')
const target = require('../harness/current-script')
const host = 'upos-sz-mirroraliov.bilivideo.com'
const playurl = 'https://api.bilibili.com/x/player/playurl?cid=1'
const quietSeed = {
    disabled: false,
    probeCache_v1: JSON.stringify({ t: 1_000, list: [host] }),
}

test('official v1.3.4 baseline reproduces the selected transport and playback gaps', () => {
    const source = fs.readFileSync(baseline, 'utf8')
    assert.match(source, /\.tee\s*\(/)
    assert.match(source, /if \(response === null\) return true/)
    assert.match(source, /var EnableWorkerIntercept = true/)
    assert.match(source, /let latestPlaybackRate = 1/)
    assert.doesNotMatch(source, /TRUSTED_CDN_CATALOG/)
})

test('v1.5.3 retains every official v1.3.4 page match', () => {
    const source = fs.readFileSync(target, 'utf8')
    for (const route of ['/list/*', '/festival/*', '/medialist/play/*', '/watchlater/*']) {
        assert.match(source, new RegExp('^// @match\\s+https://www\\.bilibili\\.com' + route.replaceAll('/', '\\/').replace('*', '\\*') + '$', 'm'))
    }
})

test('v1.5.3 preserves official catalog, UCB, probe, Watchdog, and bakeoff limits', () => {
    const readConfig = file => {
        const h = loadUserscript(file, { gmSeed: { disabled: true } })
        return JSON.parse(h.evaluate(`JSON.stringify({
            catalog: typeof TRUSTED_CDN_CATALOG === 'undefined' ? PREFERRED_CDN_LIST_RAW : TRUSTED_CDN_CATALOG,
            ucb: UCB_EXPLORE_C,
            probeTimeout: PROBE_TIMEOUT_MS,
            confirmTimeout: CONFIRM_TIMEOUT_MS,
            bakeoffTimeout: THRPT_PROBE_TIMEOUT,
            bakeoffBytes: THRPT_PROBE_BYTES,
            bakeoffCooldown: THRPT_BAKEOFF_COOLDOWN,
        })`))
    }
    assert.deepEqual(readConfig(target), readConfig(baseline))
    const source = fs.readFileSync(target, 'utf8')
    assert.match(source, /const STALL_DANGER_SEC\s*=\s*10/)
    assert.match(source, /\.slice\(0, 4\)/)
    assert.match(source, /768 \* 1024/)
})

test('v1.5.3 isolates interceptor exceptions and returns the original playurl payload', async () => {
    const payload = JSON.stringify({ code: 0, data: {} })
    const h = loadUserscript(target, {
        now: 1_000,
        gmSeed: { ...quietSeed, verbose: true },
        fetchImpl: async input => {
            const url = input instanceof Request ? input.url : String(input)
            if (url.includes('/x/player/playurl')) return new Response(payload, { status: 200 })
            return new Response(new Uint8Array([1]), { status: 206 })
        },
    })
    h.evaluate("interceptNetResponse(() => { throw new Error('injected interceptor failure') })")
    const response = await h.pageWindow.fetch(playurl)
    assert.equal(await response.text(), payload)
    assert.match(h.evaluate('buildDiagReport()'), /interceptor/)
})

test('v1.5.3 propagates playurl body-read rejection instead of leaving a pending promise', async () => {
    const h = loadUserscript(target, {
        now: 1_000,
        gmSeed: quietSeed,
        fetchImpl: async input => {
            const url = input instanceof Request ? input.url : String(input)
            if (url.includes('/x/player/playurl')) {
                const response = new Response('{}', { status: 200 })
                response.text = () => Promise.reject(new Error('body read failed'))
                return response
            }
            return new Response(new Uint8Array([1]), { status: 206 })
        },
    })
    await assert.rejects(h.pageWindow.fetch(playurl), /body read failed/)
})

test('v1.5.3 main Fetch uses one reader and forwards the player cancel reason', async () => {
    let cancelledWith = null
    let delivered = false
    const originalBody = new ReadableStream({
        pull(controller) {
            if (!delivered) {
                delivered = true
                controller.enqueue(new Uint8Array([1, 2, 3]))
            }
        },
        cancel(reason) { cancelledWith = reason },
    })
    const h = loadUserscript(target, {
        now: 1_000,
        gmSeed: quietSeed,
        fetchImpl: async input => {
            const url = input instanceof Request ? input.url : String(input)
            if (url.includes('.m4s')) return new Response(originalBody, { status: 206 })
            return new Response(new Uint8Array([1]), { status: 206 })
        },
    })
    const response = await h.pageWindow.fetch(`https://${host}/upgcxcode/cancel.m4s`)
    const reader = response.body.getReader()
    await reader.read()
    await reader.cancel('seek-cancel')
    assert.equal(cancelledWith, 'seek-cancel')
})

test('v1.5.3 main Fetch body-read error is a verified failure, while AbortError remains exempt', async () => {
    const bodyError = new ReadableStream({ pull(controller) { controller.error(new Error('segment body failed')) } })
    const failing = loadUserscript(target, {
        now: 1_000,
        gmSeed: quietSeed,
        fetchImpl: async input => {
            const url = input instanceof Request ? input.url : String(input)
            if (url.includes('.m4s')) return new Response(bodyError, { status: 206 })
            return new Response(new Uint8Array([1]), { status: 206 })
        },
    })
    const response = await failing.pageWindow.fetch(`https://${host}/upgcxcode/body-error.m4s`)
    await assert.rejects(response.arrayBuffer(), /segment body failed/)
    assert.equal(failing.evaluate(`cdnFailCount[${JSON.stringify(host)}] || 0`), 1)

    const abortedBody = new ReadableStream({ pull(controller) { controller.error(new DOMException('cancelled', 'AbortError')) } })
    const aborted = loadUserscript(target, {
        now: 1_000,
        gmSeed: quietSeed,
        fetchImpl: async input => {
            const url = input instanceof Request ? input.url : String(input)
            if (url.includes('.m4s')) return new Response(abortedBody, { status: 206 })
            return new Response(new Uint8Array([1]), { status: 206 })
        },
    })
    const abortedResponse = await aborted.pageWindow.fetch(`https://${host}/upgcxcode/abort-body.m4s`)
    await assert.rejects(abortedResponse.arrayBuffer(), { name: 'AbortError' })
    assert.equal(aborted.evaluate(`cdnFailCount[${JSON.stringify(host)}] || 0`), 0)
})

test('v1.5.3 treats null XHR playurl response as fail-open', () => {
    const h = loadUserscript(target, { now: 1_000, gmSeed: quietSeed })
    const xhr = new h.pageWindow.XMLHttpRequest()
    xhr.open('GET', playurl)
    xhr.respond({ status: 200, response: null, responseURL: playurl })
    assert.equal(xhr.response, null)
})

test('v1.5.3 HTTPDNS XHR blocking is a completed synthetic 503 JSON response', () => {
    const h = loadUserscript(target, {
        now: 1_000,
        gmSeed: quietSeed,
        sourceTransform: source => source.replace("var BlockHttpDNS = 'auto'", 'var BlockHttpDNS = true'),
    })
    const xhr = new h.pageWindow.XMLHttpRequest()
    xhr.responseType = 'json'
    xhr.open('GET', 'https://httpdns.bilivideo.com/query?host=example')
    xhr.send()
    h.timers.runTimers(0)
    assert.equal(xhr.sent, undefined)
    assert.equal(xhr.readyState, 4)
    assert.equal(xhr.status, 503)
    assert.equal(xhr.getResponseHeader('content-type'), 'application/json')
    assert.equal(xhr.response.code, -1)
})

test('v1.5.3 accepts only bounded catalog PerformanceObserver throughput samples', () => {
    const h = loadUserscript(target, { now: 1_000, gmSeed: quietSeed })
    assert.ok(h.performanceObservers.length > 0)
    h.evaluate(`representationRegistry.set('/upgcxcode/fake.m4s', { height: 1080, bandwidth: 9e6, codec: 'av1' })`)
    h.emitPerformanceEntries([
        { name: 'https://httpdns.bilivideo.com/upgcxcode/fake.m4s', transferSize: 256 * 1024, responseStart: 10, responseEnd: 20 },
        { name: `https://${host}/upgcxcode/infinite.m4s`, transferSize: Infinity, duration: 10 },
        { name: `https://${host}/upgcxcode/oversized.m4s`, transferSize: 256 * 1024 * 1024 + 1, duration: 10 },
    ])
    assert.equal(h.evaluate(`Object.prototype.hasOwnProperty.call(cdnHealth, 'httpdns.bilivideo.com')`), false)
    assert.equal(h.evaluate(`Object.prototype.hasOwnProperty.call(cdnHealth, ${JSON.stringify(host)})`), false)
    assert.equal(h.evaluate('Watchdog.stats().totalMB'), 0)
    assert.equal(h.evaluate('observedVideoRepresentation'), null)

    h.emitPerformanceEntries([
        { name: `https://${host}/upgcxcode/valid.m4s`, transferSize: 256 * 1024, responseStart: 10, responseEnd: 20 },
    ])
    assert.equal(h.evaluate(`cdnHealth[${JSON.stringify(host)}].samples`), 1)
    assert.equal(h.evaluate('Watchdog.stats().totalMB'), 0.25)
})

test('v1.5.3 HTTPDNS synthetic completion cannot cross a later open or abort', () => {
    const h = loadUserscript(target, {
        now: 1_000,
        gmSeed: quietSeed,
        sourceTransform: source => source.replace("var BlockHttpDNS = 'auto'", 'var BlockHttpDNS = true'),
    })
    const reopened = new h.pageWindow.XMLHttpRequest()
    let reopenedLoads = 0
    reopened.addEventListener('load', () => { reopenedLoads++ })
    reopened.open('GET', 'https://httpdns.bilivideo.com/query?host=stale')
    reopened.send()
    reopened.open('GET', 'https://api.bilibili.com/x/player/v2')
    reopened.send()
    h.timers.runTimers(0)
    assert.equal(reopened.readyState, 1)
    assert.equal(reopened.status, 0)
    assert.equal(reopenedLoads, 0)

    const aborted = new h.pageWindow.XMLHttpRequest()
    let abortedLoads = 0
    aborted.addEventListener('load', () => { abortedLoads++ })
    aborted.open('GET', 'https://httpdns.bilivideo.com/query?host=aborted')
    aborted.send()
    aborted.abort()
    h.timers.runTimers(0)
    assert.equal(aborted.status, 0)
    assert.equal(abortedLoads, 0)
})

test('v1.5.3 __playinfo__ setter stores the original value even when transformation throws', () => {
    const h = loadUserscript(target, { now: 1_000, gmSeed: quietSeed })
    assert.equal(h.evaluate(`(() => {
        const value = {}
        Object.defineProperty(value, 'result', { get() { throw new Error('malformed playinfo') } })
        unsafeWindow.__playinfo__ = value
        return unsafeWindow.__playinfo__ === value
    })()`), true)
})

test('v1.5.3 SPA identity covers bvid, epid, oid, aid, and p query changes', () => {
    const h = loadUserscript(target, {
        now: 1_000,
        gmSeed: quietSeed,
        initialUrl: 'https://www.bilibili.com/list/watchlater?bvid=BV1ABC&p=2',
        sourceTransform: source => source.replace(
            'let currentVideoKey = getVideoKey()',
            "let currentVideoKey = getVideoKey(); Object.defineProperty(globalThis, '__auditCurrentVideoKey', { get: () => currentVideoKey })"
        ),
    })
    assert.equal(h.evaluate('__auditCurrentVideoKey'), 'bv1abc#p2')
    h.pageWindow.history.pushState(null, '', '?oid=12345&p=3')
    h.timers.runTimers(0)
    assert.equal(h.evaluate('__auditCurrentVideoKey'), 'av12345#p3')
    h.pageWindow.history.replaceState(null, '', '?epid=77')
    h.timers.runTimers(0)
    assert.equal(h.evaluate('__auditCurrentVideoKey'), 'ep77')
    h.pageWindow.history.pushState(null, '', '?aid=99')
    h.timers.runTimers(0)
    assert.equal(h.evaluate('__auditCurrentVideoKey'), 'av99')
})
