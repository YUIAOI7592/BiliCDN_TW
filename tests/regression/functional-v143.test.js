'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const { loadUserscript } = require('../harness/userscript-vm')

const root = path.resolve(__dirname, '../..')
const archive = path.join(root, 'tests', 'fixtures')
const v142 = path.join(archive, 'BiliCDN_TW_1.4.2.user.js')
const v143 = require('../harness/current-script')
const cdn = 'upos-sz-mirroraliov.bilivideo.com'

const exposeRuntimeStop = source => source.replace(
    'const stopRuntimeFeatures = () => {',
    'const stopRuntimeFeatures = globalThis.__auditStopRuntime = () => { disabled = true;'
)

const settleTurns = async (count = 4) => {
    for (let i = 0; i < count; i++) await new Promise(resolve => setImmediate(resolve))
}

test('v1.4.2 reproduction: disabling leaves pending latency probes alive and able to update health', async () => {
    const pending = []
    const h = loadUserscript(v142, {
        gmSeed: { disabled: false },
        sourceTransform: exposeRuntimeStop,
        fetchImpl: (input, init) => new Promise(resolve => pending.push({ resolve, signal: init && init.signal })),
    })
    assert.ok(pending.length > 0)
    h.context.__auditStopRuntime()
    assert.equal(pending.filter(entry => entry.signal && entry.signal.aborted).length, 0)
    pending.forEach(entry => entry.resolve(new Response(new Uint8Array([1]), { status: 200 })))
    await settleTurns()
    assert.ok(h.evaluate('Object.values(cdnHealth).filter(entry => entry.latencyMs > 0).length') > 0)
})

test('v1.5.3: disabling aborts pending latency probes and rejects stale health writes', { skip: !fs.existsSync(v143) }, async () => {
    const pending = []
    const h = loadUserscript(v143, {
        gmSeed: { disabled: false },
        sourceTransform: exposeRuntimeStop,
        fetchImpl: (input, init) => new Promise((resolve, reject) => {
            const signal = init && init.signal
            if (signal) signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
            pending.push({ resolve, reject, signal })
        }),
    })
    assert.ok(pending.length > 0)
    h.context.__auditStopRuntime()
    assert.equal(pending.filter(entry => entry.signal && entry.signal.aborted).length, pending.length)
    await settleTurns()
    assert.equal(h.evaluate('Object.values(cdnHealth).filter(entry => entry.latencyMs > 0).length'), 0)
})

test('v1.4.2 reproduction: 15 Mbps bakeoff sample is not slow against a 21 Mbps 2x demand', () => {
    const h = loadUserscript(v142, { gmSeed: { disabled: true } })
    h.evaluate(`currentStreamBitsPerSec = 10e6; resetPlaybackRateState(); recordCdnThroughput(${JSON.stringify(cdn)}, 1500000, 800, 1)`)
    assert.equal(h.evaluate(`cdnHealth[${JSON.stringify(cdn)}].slowSamples`), 0)
    assert.equal(h.evaluate('getRequiredStreamMbps()'), 21)
})

test('v1.5.3: bakeoff classifies samples with the effective playback rate', { skip: !fs.existsSync(v143) }, () => {
    const h = loadUserscript(v143, { gmSeed: { disabled: true } })
    assert.match(
        h.evaluate('probeCdnThroughput.toString()'),
        /recordCdnThroughput\(cdn, bytes, durationMs, (?:deps\.)?playbackRateState\.effectiveRate\)/
    )
})

test('v1.4.2 reproduction: same-height bitrate calibration uses the largest codec representation', () => {
    const h = loadUserscript(v142, { gmSeed: { disabled: true } })
    h.evaluate(`streamProfile = {
        reps: [
            { height: 2160, bandwidth: 9e6 },
            { height: 2160, bandwidth: 12e6 },
            { height: 2160, bandwidth: 18e6 }
        ],
        audioBps: 300000
    }; currentStreamBitsPerSec = 0; syncStreamBitrateFromVideo({ videoHeight: 2160 })`)
    assert.equal(h.evaluate('currentStreamBitsPerSec'), 18_300_000)
})

test('v1.5.3: an observed AV1 representation calibrates its own bitrate across host rewrites', { skip: !fs.existsSync(v143) }, () => {
    const av1 = 'https://upos-sz-mirroraliov.bilivideo.com/upgcxcode/av1.m4s?token=kept'
    const rewritten = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/av1.m4s?token=kept'
    const h = loadUserscript(v143, { gmSeed: { disabled: false } })
    h.evaluate(`streamProfile = {
        reps: [
            { height: 2160, bandwidth: 9e6, codec: 'av1', urls: [${JSON.stringify(av1)}] },
            { height: 2160, bandwidth: 18e6, codec: 'avc', urls: ['https://${cdn}/upgcxcode/avc.m4s?token=kept'] }
        ],
        audioBps: 300000
    }; rebuildRepresentationRegistry(); noteObservedVideoRepresentation(${JSON.stringify(rewritten)}); syncStreamBitrateFromVideo({ videoHeight: 2160 })`)
    assert.equal(h.evaluate('currentStreamBitsPerSec'), 9_300_000)
    const estimate = JSON.parse(h.evaluate('JSON.stringify(streamEstimate)'))
    assert.equal(estimate.source, 'observed-representation')
    assert.equal(estimate.codec, 'av1')
    assert.doesNotMatch(JSON.stringify(estimate), /upgcxcode|token=kept/)
})

test('v1.4.2 reproduction: there is no persistent exact-host catalog override control', () => {
    const h = loadUserscript(v142, { gmSeed: { disabled: true } })
    assert.equal(h.evaluate('typeof catalogOverrides'), 'undefined')
    assert.equal(h.menus.some(menu => menu.label.includes('catalog')), false)
})

test('v1.5.3: catalog override storage is normalized to exact hosts and booleans', { skip: !fs.existsSync(v143) }, () => {
    const h = loadUserscript(v143, {
        gmSeed: {
            disabled: true,
            catalogOverrides_v1: {
                'upos-sz-mirroraliov.bilivideo.com': false,
                'httpdns.bilivideo.com': true,
                'upos-sz-mirrorcosov.bilivideo.com': 'yes',
            },
        },
    })
    assert.deepEqual(
        JSON.parse(h.evaluate('JSON.stringify(catalogOverrides)')),
        { 'upos-sz-mirroraliov.bilivideo.com': false }
    )
    assert.equal(
        JSON.stringify(h.gm.get('catalogOverrides_v1')),
        JSON.stringify({ 'upos-sz-mirroraliov.bilivideo.com': false })
    )
})

test('v1.5.3: trusted menu can explicitly enable cosov without exposing a page mutator', { skip: !fs.existsSync(v143) }, () => {
    const h = loadUserscript(v143, { gmSeed: { disabled: true }, promptResult: '2' })
    const menu = h.menus.find(entry => entry.label.includes('控制中心'))
    assert.ok(menu)
    menu.callback()
    const uiHost = h.document.getElementById('bilicdn-trusted-menu-ui')
    const shadow = uiHost && h.getClosedShadowRoot(uiHost)
    shadow.querySelector('[data-ui-action="routing"]').dispatchEvent(new h.context.Event('click', { isTrusted: true }))
    const choice = shadow && shadow.querySelector('[data-ui-action="catalog-1"]')
    const confirm = shadow && shadow.querySelector('[data-ui-action="confirm"]')
    assert.ok(choice && confirm)
    choice.dispatchEvent(new h.context.Event('click', { isTrusted: true }))
    confirm.dispatchEvent(new h.context.Event('click', { isTrusted: true }))
    assert.equal(h.evaluate("PREFERRED_CDN_LIST.includes('upos-sz-mirrorcosov.bilivideo.com')"), true)
    assert.equal(h.gm.get('catalogOverrides_v1')['upos-sz-mirrorcosov.bilivideo.com'], true)
    assert.equal(Object.values(h.pageWindow.BiliCDN).some(value => typeof value === 'function'), false)
})

test('v183: fixed catalog setting is retained but cannot bypass a disabled host', { skip: !fs.existsSync(v143) }, () => {
    const fixed = 'upos-sz-mirrorcosov.bilivideo.com'
    const h = loadUserscript(v143, {
        gmSeed: { disabled: true, catalogOverrides_v1: { [fixed]: false } },
        customCdn: fixed,
    })
    assert.equal(h.evaluate('resolvedCdn'), fixed)
    assert.notEqual(h.evaluate('getCurrentCdn()'), fixed)
})

test('v1.5.3: disabling does not cancel a player Fetch body and suppresses its stale statistics', { skip: !fs.existsSync(v143) }, async () => {
    let mediaController
    let mediaCancelled = false
    const mediaUrl = `https://${cdn}/upgcxcode/lifecycle.m4s?token=kept`
    const h = loadUserscript(v143, {
        gmSeed: { disabled: false },
        sourceTransform: exposeRuntimeStop,
        fetchImpl: input => {
            const url = input instanceof Request ? input.url : String(input)
            if (url.includes('/crossdomain.xml')) return Promise.resolve(new Response(new Uint8Array([1]), { status: 200 }))
            return Promise.resolve(new Response(new ReadableStream({
                start(controller) { mediaController = controller },
                cancel() { mediaCancelled = true },
            }), { status: 206 }))
        },
    })
    const response = await h.pageWindow.fetch(mediaUrl)
    const before = h.evaluate(`(cdnHealth[${JSON.stringify(cdn)}] || {}).successes || 0`)
    h.context.__auditStopRuntime()
    mediaController.enqueue(new Uint8Array([7, 8, 9]))
    mediaController.close()
    const reader = response.body.getReader()
    const first = await reader.read()
    const end = await reader.read()
    assert.deepEqual([...first.value], [7, 8, 9])
    assert.equal(end.done, true)
    assert.equal(mediaCancelled, false)
    assert.equal(h.evaluate(`(cdnHealth[${JSON.stringify(cdn)}] || {}).successes || 0`), before)
})

test('v1.5.3: pushState, replaceState, and popstate reset per-video state and runtime generation', { skip: !fs.existsSync(v143) }, async () => {
    const h = loadUserscript(v143, { gmSeed: { disabled: false } })
    const resetFixture = () => h.evaluate(`streamProfile = { reps: [{ height: 1080, bandwidth: 8e6, codec: 'av1', urls: [] }], audioBps: 1e5 };
        playbackRateState.observedRate = 1; playbackRateState.effectiveRate = 1; playbackRateState.confirmed = true`)
    let generation = h.evaluate('runtimeGeneration')

    resetFixture()
    h.pageWindow.history.pushState({}, '', '?p=2')
    h.timers.runTimers(0)
    await settleTurns()
    assert.ok(h.evaluate('runtimeGeneration') > generation)
    assert.equal(h.evaluate('streamProfile'), null)
    assert.equal(h.evaluate('playbackRateState.effectiveRate'), 2)

    generation = h.evaluate('runtimeGeneration')
    resetFixture()
    h.pageWindow.history.replaceState({}, '', '?p=3')
    h.timers.runTimers(0)
    await settleTurns()
    assert.ok(h.evaluate('runtimeGeneration') > generation)
    assert.equal(h.evaluate('streamProfile'), null)

    generation = h.evaluate('runtimeGeneration')
    resetFixture()
    h.location.search = '?p=4'
    h.location.href = 'https://www.bilibili.com/video/BV1test?p=4'
    h.pageWindow.dispatchEvent(new h.context.Event('popstate'))
    h.timers.runTimers(0)
    await settleTurns()
    assert.ok(h.evaluate('runtimeGeneration') > generation)
    assert.equal(h.evaluate('streamProfile'), null)
})

test('v1.5.3: WebRTC blocking is restored on stop and re-applied on start', { skip: !fs.existsSync(v143) }, () => {
    function OriginalRtc() {}
    const transform = source => source.replace('const stopRuntimeFeatures = () => {', 'const stopRuntimeFeatures = globalThis.__auditStopRuntime = () => {')
        .replace('const startRuntimeFeatures = () => {', 'const startRuntimeFeatures = globalThis.__auditStartRuntime = () => {')
    const h = loadUserscript(v143, {
        gmSeed: { disabled: false },
        pageGlobals: { RTCPeerConnection: OriginalRtc },
        sourceTransform: transform,
    })
    assert.equal(h.pageWindow.RTCPeerConnection, undefined)
    h.context.__auditStopRuntime()
    assert.equal(h.pageWindow.RTCPeerConnection, OriginalRtc)
    h.evaluate('disabled = false')
    h.context.__auditStartRuntime()
    assert.equal(h.pageWindow.RTCPeerConnection, undefined)
})

test('v1.5.3: the checkbox lifecycle handler persists disable and creates a fresh generation on re-enable', { skip: !fs.existsSync(v143) }, () => {
    const transform = source => source.replace(
        'const setRuntimeDisabled = (nextDisabled) => {',
        'const setRuntimeDisabled = globalThis.__auditSetRuntimeDisabled = (nextDisabled) => {'
    )
    const h = loadUserscript(v143, { gmSeed: { disabled: false }, sourceTransform: transform })
    const firstGeneration = h.evaluate('runtimeGeneration')
    assert.equal(h.context.__auditSetRuntimeDisabled(true), true)
    assert.equal(h.gm.get('disabled'), true)
    assert.equal(h.evaluate('runtimeAbortController'), null)
    assert.equal(h.context.__auditSetRuntimeDisabled(false), false)
    assert.equal(h.gm.get('disabled'), false)
    assert.ok(h.evaluate('runtimeGeneration') > firstGeneration)
    assert.equal(h.evaluate('runtimeAbortController.signal.aborted'), false)
    assert.equal(typeof h.pageWindow.BiliCDN.setRuntimeDisabled, 'undefined')
})

test('v1.5.3: visibility interception is gated off when runtime is disabled', { skip: !fs.existsSync(v143) }, () => {
    const transform = source => source.replace(
        'const setRuntimeDisabled = (nextDisabled) => {',
        'const setRuntimeDisabled = globalThis.__auditSetRuntimeDisabled = (nextDisabled) => {'
    )
    const h = loadUserscript(v143, { gmSeed: { disabled: false }, sourceTransform: transform })
    const activeEvent = new h.context.Event('visibilitychange')
    h.document.dispatchEvent(activeEvent)
    assert.equal(activeEvent.__stopImmediate, true)
    h.context.__auditSetRuntimeDisabled(true)
    const disabledEvent = new h.context.Event('visibilitychange')
    h.document.dispatchEvent(disabledEvent)
    assert.equal(disabledEvent.__stopImmediate, undefined)
})

test('v1.5.3: HTTPDNS AutoPilot performs a trial and commits a healthy allow result', { skip: !fs.existsSync(v143) }, () => {
    const h = loadUserscript(v143, { gmSeed: { disabled: true } })
    const began = h.evaluate(`redirectStats.httpdns = 1; HttpDnsAutoPilot.onStall('test', {
        totalBytes: 0, stallEvents: 0, switchCount: 0, hardFailCount: 0, elapsedSec: 30
    })`)
    assert.equal(began, true)
    assert.equal(h.evaluate('HttpDnsAutoPilot.getStatus().mode'), 'auto-trial-allow')
    h.evaluate(`HttpDnsAutoPilot.onTargetReached({
        totalBytes: 200 * 1024 * 1024, stallEvents: 0, switchCount: 0,
        hardFailCount: 0, elapsedSec: 60, reachedTarget: true
    })`)
    assert.match(h.evaluate('HttpDnsAutoPilot.getStatus().mode'), /^auto-allow/)
})

test('v1.5.3: session health counters are capped and field timestamps survive shared-GM merges', { skip: !fs.existsSync(v143) }, () => {
    const shared = { gm: new Map(), gmWrites: [] }
    const seed = { disabled: true, throughputSchema: 3, blicdnVersion: '1.4.3' }
    const a = loadUserscript(v143, { gmSeed: seed, gmContext: shared, now: 1000 })
    const b = loadUserscript(v143, { gmSeed: seed, gmContext: shared, now: 1000 })

    a.evaluate(`for (let i = 0; i < 40; i++) recordCdnHealthSuccess(${JSON.stringify(cdn)}, 0)`)
    assert.equal(a.evaluate(`cdnHealth[${JSON.stringify(cdn)}].successes`), 12)
    a.timers.runTimers(1000)

    b.clock.set(2000)
    b.evaluate(`recordCdnPenalty(${JSON.stringify(cdn)}, true)`)
    b.timers.runTimers(1000)

    a.clock.set(3000)
    a.evaluate(`recordCdnLatency(${JSON.stringify(cdn)}, 123)`)
    a.timers.runTimers(1000)

    const stored = JSON.parse(shared.gm.get('cdnHealth_v1'))[cdn]
    assert.equal(stored.successes, 12)
    assert.equal(stored.failures, 2)
    assert.equal(stored.latencyMs, 123)
    assert.equal(stored.lastSuccessAt, 1000)
    assert.equal(stored.lastFailureAt, 2000)
    assert.equal(stored.lastLatencyAt, 3000)
})

test('v1.5.3: observed HEVC/AVC are codec-specific and stale or mismatched observations fall back conservatively', { skip: !fs.existsSync(v143) }, () => {
    const h = loadUserscript(v143, { gmSeed: { disabled: false }, now: 1000 })
    h.evaluate(`streamProfile = {
        reps: [
            { height: 1080, bandwidth: 6e6, codec: 'hevc', urls: ['https://${cdn}/rep/hevc.m4s?q=1'] },
            { height: 1080, bandwidth: 10e6, codec: 'avc', urls: ['https://${cdn}/rep/avc.m4s?q=1'] },
            { height: 2160, bandwidth: 18e6, codec: 'avc', urls: ['https://${cdn}/rep/4k.m4s?q=1'] }
        ], audioBps: 2e5
    }; rebuildRepresentationRegistry()`)
    h.evaluate(`noteObservedVideoRepresentation('https://upos-sz-mirrorali.bilivideo.com/rep/hevc.m4s?q=1'); currentStreamBitsPerSec = 0; syncStreamBitrateFromVideo({ videoHeight: 1080 })`)
    assert.equal(h.evaluate('currentStreamBitsPerSec'), 6_200_000)
    assert.equal(h.evaluate('streamEstimate.codec'), 'hevc')

    h.evaluate(`noteObservedVideoRepresentation('https://upos-sz-mirrorali.bilivideo.com/rep/avc.m4s?q=1'); currentStreamBitsPerSec = 0; syncStreamBitrateFromVideo({ videoHeight: 1080 })`)
    assert.equal(h.evaluate('currentStreamBitsPerSec'), 10_200_000)
    assert.equal(h.evaluate('streamEstimate.codec'), 'avc')

    h.clock.advance(31_000)
    h.evaluate('currentStreamBitsPerSec = 0; syncStreamBitrateFromVideo({ videoHeight: 1080 })')
    assert.equal(h.evaluate('currentStreamBitsPerSec'), 10_200_000)
    assert.equal(h.evaluate('streamEstimate.source'), 'conservative-height-max')

    h.clock.set(40_000)
    h.evaluate(`noteObservedVideoRepresentation('https://${cdn}/rep/4k.m4s?q=1'); currentStreamBitsPerSec = 0; syncStreamBitrateFromVideo({ videoHeight: 1080 })`)
    assert.equal(h.evaluate('currentStreamBitsPerSec'), 10_200_000)
    assert.equal(h.evaluate('streamEstimate.source'), 'conservative-height-max')
    assert.doesNotMatch(JSON.stringify(h.pageWindow.BiliCDN.streamEstimate), /\/rep\/|\?q=/)
})

test('v1.5.3: shared Web Lock prevents two tabs from running bakeoff concurrently', { skip: !fs.existsSync(v143) }, async () => {
    let held = false
    const locks = {
        request(name, options, callback) {
            if (held) return Promise.resolve(callback(null))
            held = true
            return Promise.resolve(callback({ name })).finally(() => { held = false })
        },
    }
    const now = 100_000
    const cache = JSON.stringify({ t: now, list: [cdn] })
    const pending = []
    const a = loadUserscript(v143, {
        now,
        locks,
        gmSeed: { disabled: false, probeCache_v1: cache },
        sourceTransform: exposeRuntimeStop,
        fetchImpl: (input, init) => new Promise((resolve, reject) => {
            if (init && init.signal) init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
            pending.push({ resolve, reject })
        }),
    })
    const b = loadUserscript(v143, {
        now,
        locks,
        gmSeed: { disabled: false, probeCache_v1: cache },
    })
    await settleTurns()
    const sample = `https://${cdn}/upgcxcode/lock-test.m4s?token=kept`
    const aRun = a.evaluate(`runThroughputBakeoff(${JSON.stringify(sample)}, false)`)
    await settleTurns()
    assert.equal(held, true)
    assert.ok(pending.length > 0)

    const before = b.fetchCalls.length
    await b.evaluate(`runThroughputBakeoff(${JSON.stringify(sample)}, false)`)
    await settleTurns()
    assert.equal(b.fetchCalls.length, before)

    a.context.__auditStopRuntime()
    await aRun
    assert.equal(held, false)
})
