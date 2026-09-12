'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const F = require('../harness/v153-fixture')

test('v153 fixed v152 reproduction: generic 30fps queries and stale historical capability', async () => {
    const calls = [], completions = []
    const h = F.load({ mediaCapabilities: { decodingInfo(config) {
        calls.push(config); return new Promise(resolve => completions.push(resolve))
    } } }, F.previous)
    await F.prime(h)
    assert.equal(calls.length, 4); assert.ok(calls.every(c => c.video.framerate === 30))
    completions.forEach(resolve => resolve({ supported: true, smooth: true, powerEfficient: true }))
    await F.settle()
    assert.equal(h.evaluate("getCodecCapabilityState('av1',2160)"), 'good')
    assert.equal(F.json(h, 'lastCodecDecision').groups[0].capability, 'unknown')
})

test('v153 fixed v152 reproduction: cross-view Escape loses page focus', () => {
    const h = F.load({ gmSeed: { disabled: true } }, F.previous)
    const prior = h.document.createElement('button'); h.document.body.appendChild(prior); prior.focus()
    h.menus[0].callback(); F.click(h, 'diagnostics')
    F.ui(h).dispatchEvent(new F.FakeEvent('keydown', { key: 'Escape', isTrusted: true }))
    assert.notEqual(h.document.activeElement, prior)
})

test('v153 codec: actual configuration, nonblocking response and current versus historical result', async () => {
    const calls = []; let complete
    const h = F.load({ mediaCapabilities: { decodingInfo(config) {
        calls.push(config); return new Promise(resolve => { complete = resolve })
    } } })
    assert.equal(calls.length, 0)
    await F.prime(h)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].video.contentType, 'video/mp4; codecs="av01.0.12M.08"')
    assert.equal(calls[0].video.framerate, 60000 / 1001)
    assert.equal(calls[0].video.bitrate, 9000000)
    assert.equal(calls[0].keySystemConfiguration, undefined)
    complete({ supported: true, smooth: true, powerEfficient: true }); await F.settle()
    assert.equal(F.json(h, 'lastCodecDecision').groups[0].capability, 'unknown')
    assert.equal(F.json(h, 'getCurrentCodecDiagnostics()')[0].capability, 'good')
    await F.prime(h); assert.equal(calls.length, 1)
    assert.equal(F.json(h, 'lastCodecDecision').groups[0].capability, 'good')
})

test('v160 UI: menu navigation stays in one session and Escape restores the original focus', () => {
    const h = F.load({ gmSeed: { disabled: true } })
    const prior = h.document.createElement('button'); h.document.body.appendChild(prior); prior.focus()
    h.menus[0].callback(); F.click(h, 'maintenance'); F.click(h, 'back'); F.click(h, 'diagnostics')
    F.ui(h).dispatchEvent(new F.FakeEvent('keydown', { key: 'Escape', isTrusted: true }))
    assert.equal(h.document.activeElement === prior, true)
    h.menus[0].callback(); F.click(h, 'diagnostics'); F.click(h, 'text-action')
    assert.equal(F.ui(h).querySelector('h2').textContent, 'BiliCDN 診斷資訊')
    F.ui(h).dispatchEvent(new F.FakeEvent('keydown', { key: 'Escape', isTrusted: true }))
    assert.equal(h.document.activeElement === prior, true)
})

test('v153 codec: two native calls maximum, single flight and invalid metadata fail open', async () => {
    const calls = [], pending = []
    const p = F.payload(); p.data.dash.video = [F.rep(), F.rep('hevc'), { ...F.rep('av1', F.ali, 'different'), frame_rate: 30 }]
    const h = F.load({ payload: p, mediaCapabilities: { decodingInfo(config) {
        calls.push(config); return new Promise(resolve => pending.push(resolve))
    } } })
    await F.prime(h); await F.prime(h)
    assert.equal(calls.length, 2)
    pending.shift()({ supported: true, smooth: true, powerEfficient: true }); await F.settle()
    assert.equal(calls.length, 3)
    const missing = F.payload(); delete missing.data.dash.video[0].frame_rate
    let invalidCalls = 0
    const invalid = F.load({ payload: missing, mediaCapabilities: { decodingInfo() { invalidCalls++; return Promise.resolve({}) } } })
    await F.prime(invalid)
    assert.equal(invalidCalls, 0)
    assert.equal(F.json(invalid, 'getCurrentCodecDiagnostics()')[0].reason, 'missing-or-invalid-metadata')
})

test('v153 codec: negative actual configuration only affects subsequent playurl ordering', async () => {
    const p = F.payload(); p.data.dash.video = [F.rep(), F.rep('hevc'), F.rep('avc')]
    const h = F.load({ payload: p, mediaCapabilities: { decodingInfo(config) {
        return Promise.resolve({ supported: true, smooth: true, powerEfficient: !config.video.contentType.includes('av01') })
    } } })
    const first = await (await h.pageWindow.fetch(F.playurl)).json()
    assert.equal(first.data.dash.video[0].codecs, F.rep().codecs)
    await F.settle()
    assert.equal(first.data.dash.video[0].codecs, F.rep().codecs)
    const second = await (await h.pageWindow.fetch(F.playurl)).json()
    assert.equal(second.data.dash.video[0].codecs, F.rep('hevc').codecs)
    assert.equal(h.pageWindow.location.reloadCalls, 0)
})

test('v153 codec: stale native queries keep slots through SPA/disable and cannot publish old results', async () => {
    const calls = [], pending = []
    const p = F.payload(); p.data.dash.video.push(F.rep('hevc'))
    const h = F.load({ payload: p, sourceTransform: source => source.replace('const setRuntimeDisabled = (nextDisabled) => {',
        'const setRuntimeDisabled = globalThis.testToggle = (nextDisabled) => {'),
    mediaCapabilities: { decodingInfo(config) { calls.push(config); return new Promise(resolve => pending.push(resolve)) } } })
    await F.prime(h); assert.equal(calls.length, 2)
    await F.spa(h); await F.prime(h)
    assert.equal(calls.length, 2)
    pending.shift()({ supported: false, smooth: false, powerEfficient: false }); await F.settle()
    assert.equal(calls.length, 3)
    assert.equal(F.json(h, 'getCurrentCodecDiagnostics()')[0].capability, 'unknown')
    h.context.testToggle(true)
    pending.splice(0).forEach(resolve => resolve({ supported: true, smooth: true, powerEfficient: true }))
    await F.settle()
    assert.equal(calls.length, 3); assert.equal(h.evaluate('codecQueriesInFlight'), 0)
    h.context.testToggle(false); await F.settle()
    assert.equal(calls.length, 5)
})

test('v153 codec: cache bounds, no retry storm, missing/API rejection and hostile getters stay unknown', async () => {
    const p = F.payload(); p.data.dash.video = Array.from({ length: 150 }, (_, n) => ({ ...F.rep('av1', F.ali, 'v' + n), bandwidth: 1000000 + n }))
    let calls = 0
    const h = F.load({ payload: p, mediaCapabilities: { decodingInfo() { calls++; return Promise.resolve({ supported: true, smooth: true, powerEfficient: true }) } } })
    await F.prime(h); await F.settle()
    assert.equal(calls, 128); assert.equal(h.evaluate('codecCapability.size'), 128)
    await F.prime(h); await F.settle(); assert.equal(calls, 128)
    for (const mediaCapabilities of [null, { decodingInfo() { return Promise.reject(new Error('fixture')) } },
        { decodingInfo() { return Promise.resolve({ get supported() { throw new Error('getter') } }) } }]) {
        const invalid = F.load({ mediaCapabilities }); await F.prime(invalid); await F.settle()
        assert.equal(F.json(invalid, 'getCurrentCodecDiagnostics()')[0].capability, 'unknown')
        assert.equal(invalid.evaluate('codecQueriesInFlight'), 0)
    }
})

test('v153 codec: initial __playinfo__ queries belong to the started generation', async () => {
    let calls = 0
    const h = F.load({ pageGlobals: { __playinfo__: F.payload() }, mediaCapabilities: {
        decodingInfo() { calls++; return Promise.resolve({ supported: true, smooth: true, powerEfficient: true }) },
    } })
    await F.settle()
    assert.equal(calls, 1)
    assert.equal(F.json(h, 'getCurrentCodecDiagnostics()')[0].capability, 'good')
})

test('v153 quality: one-second sampling, dropped frames, reset and absent API remain read-only', async () => {
    const h = F.load({ gmSeed: { CustomCDN: F.ali } }); const v = F.video(h)
    let total = 1000, dropped = 10
    v.getVideoPlaybackQuality = () => ({ totalVideoFrames: total, droppedVideoFrames: dropped })
    await F.prime(h); await h.timers.advanceAsync(1000)
    const before = h.fetchCalls.length
    total += 100; dropped += 5; await h.timers.advanceAsync(1000)
    assert.equal(h.pageWindow.BiliCDN.playbackQuality.totalFrames, 100)
    assert.equal(h.pageWindow.BiliCDN.playbackQuality.droppedPercent, 5)
    assert.equal(h.fetchCalls.length, before)
    assert.equal(h.evaluate('Watchdog.stats().switchCount'), 0)
    total = 1; dropped = 0; await h.timers.advanceAsync(1000)
    assert.equal(h.pageWindow.BiliCDN.playbackQuality.totalFrames, 0)
    dropped = 2; await h.timers.advanceAsync(1000)
    assert.equal(h.pageWindow.BiliCDN.playbackQuality.available, false)
    delete v.getVideoPlaybackQuality; await h.timers.advanceAsync(1000)
    assert.equal(h.pageWindow.BiliCDN.playbackQuality.available, false)
})

test('v153 UI: Tab cycles privately, stale buttons cannot act, and removed origin falls back to video/body', () => {
    const h = F.load({ gmSeed: { disabled: true } }); const v = F.video(h)
    const prior = h.document.createElement('button'); h.document.body.appendChild(prior); prior.focus()
    h.menus[0].callback()
    const shadow = F.ui(h)
    const first = shadow.querySelector('[data-ui-action="cancel"]')
    const last = shadow.querySelector('[data-ui-action="cancel-secondary"]')
    first.focus()
    shadow.dispatchEvent(new F.FakeEvent('keydown', { key: 'Tab', shiftKey: true, isTrusted: true }))
    assert.equal(h.document.activeElement === last, true)
    shadow.dispatchEvent(new F.FakeEvent('keydown', { key: 'Tab', isTrusted: true }))
    assert.equal(h.document.activeElement === first, true)
    const stale = F.click(h, 'diagnostics'); const writes = h.gmWrites.length
    stale.dispatchEvent(new F.FakeEvent('click', { isTrusted: true }))
    assert.equal(h.gmWrites.length, writes)
    prior.remove(); shadow.dispatchEvent(new F.FakeEvent('keydown', { key: 'Escape', isTrusted: true }))
    assert.equal(h.document.activeElement === v, true)
    h.menus[0].callback(); v.remove()
    shadow.dispatchEvent(new F.FakeEvent('keydown', { key: 'Escape', isTrusted: true }))
    assert.equal(h.document.activeElement === h.document.body, true)
    assert.equal(h.document.body.getAttribute('tabindex'), undefined)
})

test('v153 UI: late clipboard fallback cannot resurrect a view after navigation or SPA', async () => {
    for (const navigate of ['new-view', 'spa']) {
        let rejectCopy
        const h = F.load({ gmClipboardImpl() { throw new Error('unavailable') },
            clipboardImpl() { return new Promise((resolve, reject) => { rejectCopy = reject }) } })
        h.menus[0].callback(); F.click(h, 'diagnostics'); F.click(h, 'copy'); await F.settle()
        if (navigate === 'new-view') { h.menus[0].callback(); F.click(h, 'routing') }
        else await F.spa(h)
        const before = F.ui(h).querySelector('[data-ui-kind="dialog"]')
        rejectCopy(new Error('denied')); await F.settle()
        assert.equal(F.ui(h).querySelector('[data-ui-kind="dialog"]') === before, true)
    }
})

test('v153 codec: real 1080/2160, 30/60/fractional profiles stay distinct; auto order is untouched', async () => {
    const p = F.payload()
    p.data.dash.video = [F.rep('hevc'), F.rep('avc'), F.rep(),
        { ...F.rep(), height: 1080, width: 1920, frame_rate: 30, codecs: 'av01.0.08M.08' },
        { ...F.rep(), height: 1080, width: 1920, frame_rate: 60, codecs: 'av01.0.08M.08' }]
    const calls = []
    const h = F.load({ payload: p, preferredVideoCodec: 'auto', mediaCapabilities: { decodingInfo(config) {
        calls.push(config); return Promise.resolve({ supported: true, smooth: config.video.framerate !== 60, powerEfficient: true })
    } } })
    const first = await (await h.pageWindow.fetch(F.playurl)).json(); await F.settle()
    const second = await (await h.pageWindow.fetch(F.playurl)).json()
    assert.deepEqual(first.data.dash.video.map(v => v.codecs), p.data.dash.video.map(v => v.codecs))
    assert.deepEqual(second.data.dash.video.map(v => v.codecs), p.data.dash.video.map(v => v.codecs))
    assert.equal(calls.length, 4)
    assert.equal(h.evaluate("getCodecCapabilityState('av1',1080)"), 'unknown')
    assert.equal(h.evaluate("getCodecCapabilityState('av1',2160)"), 'good')
    const callCount = calls.length; h.evaluate('buildDiagReport(); refreshPublicDiagnosticSnapshot()')
    for (let i = 0; i < 100; i++) void h.pageWindow.BiliCDN
    assert.equal(calls.length, callCount)
    assert.equal(Object.isFrozen(h.pageWindow.BiliCDN.currentCodecConfigurations), true)
    for (const [field, value] of [['width', 0], ['height', -1], ['bandwidth', Infinity], ['frame_rate', '1/0'],
        ['frame_rate', '60;fetch(1)'], ['mime_type', ''], ['codecs', '']]) {
        const item = { ...F.rep(), [field]: value }
        h.context.invalidItem = item
        assert.equal(h.evaluate('getRepresentationCodecConfig(invalidItem)'), null, field)
    }
})

test('v153 quality and UI: replaced video resets frame baseline, invalid API and synthetic Tab are inert', async () => {
    const h = F.load({ gmSeed: { CustomCDN: F.ali } }); const a = F.video(h)
    a.getVideoPlaybackQuality = () => ({ totalVideoFrames: 100, droppedVideoFrames: 1 })
    await h.timers.advanceAsync(1000)
    const b = F.video(h)
    b.getVideoPlaybackQuality = () => ({ totalVideoFrames: 500, droppedVideoFrames: 10 })
    a.remove(); await h.timers.advanceAsync(1000)
    assert.equal(h.pageWindow.BiliCDN.playbackQuality.totalFrames, 0)
    b.getVideoPlaybackQuality = () => { throw new Error('fixture') }
    await h.timers.advanceAsync(1000)
    assert.equal(h.pageWindow.BiliCDN.playbackQuality.available, false)
    h.menus[0].callback(); const shadow = F.ui(h)
    const cancel = shadow.querySelector('[data-ui-action="cancel"]'); cancel.focus()
    shadow.dispatchEvent(new F.FakeEvent('keydown', { key: 'Tab', isTrusted: false }))
    assert.equal(h.document.activeElement === cancel, true)
    const skip = shadow.querySelector('[data-ui-action="reassess"]'); skip.disabled = true
    shadow.dispatchEvent(new F.FakeEvent('keydown', { key: 'Tab', isTrusted: true }))
    assert.equal(h.document.activeElement === shadow.querySelector('[data-ui-action="routing"]'), true)
})
