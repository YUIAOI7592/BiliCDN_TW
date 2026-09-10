'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const { loadUserscript, FakeEvent } = require('../harness/userscript-vm')

const root = path.resolve(__dirname, '../..')
const v141 = path.join(root, 'baseline', 'BiliCDN_TW_1.3.4.original.user.js')
const v142 = require('../harness/current-script')

const representations = () => [
    { id: 120, height: 2160, bandwidth: 9_000_000, codecs: 'av01.0.12M.08', codecid: 13 },
    { id: 120, height: 2160, bandwidth: 12_000_000, codecs: 'hev1.1.6.L120.90', codecid: 12 },
    { id: 120, height: 2160, bandwidth: 18_000_000, codecs: 'avc1.640033', codecid: 7 },
].map(v => ({ ...v, width: 3840, mime_type: 'video/mp4', frame_rate: 30 }))

const seedCapability = (index, value) => `codecCapability.set(codecConfigurationKey(
    ${JSON.stringify(representations()[index])}), { state: 'complete', value: ${JSON.stringify(value)}, reason: 'completed' })`

test('v1.4.1 reproduction: unavailable playback-rate detection falls back to 1x', () => {
    const h = loadUserscript(v141, { gmSeed: { disabled: true } })
    assert.equal(h.evaluate('latestPlaybackRate'), 1)
    assert.equal(h.evaluate("getRequiredStreamMbps(undefined, 'steady')"), h.evaluate("getRequiredStreamMbps(1, 'steady')"))
})

test('v1.4.1 reproduction: high-bitrate Watchdog threshold omits playback rate', () => {
    const source = fs.readFileSync(v141, 'utf8')
    assert.match(source, /const requiredBps = highBitrate\s*\r?\n\s*\? streamMbps \* 1e6 \/ 8/)
})

test('v1.4.1 reproduction: setting av1 still follows HEVC-first ranking', () => {
    const h = loadUserscript(v141, {
        gmSeed: { disabled: true },
        preferredVideoCodec: 'av1',
        mediaSourceSupport: true,
    })
    const ordered = h.evaluate(`(() => {
        const dash = { video: ${JSON.stringify(representations())} }
        normalizeDashCodecPreference(dash)
        return dash.video.map(normalizeCodecName)
    })()`)
    assert.deepEqual([...ordered], ['hevc', 'avc', 'av1'])
})

test('v1.5.3: unavailable and transient 1x remain assumed 2x', { skip: !fs.existsSync(v142) }, () => {
    const h = loadUserscript(v142, { gmSeed: { disabled: true } })
    assert.deepEqual(JSON.parse(h.evaluate('JSON.stringify(playbackRateState)')), {
        observedRate: 2,
        effectiveRate: 2,
        confirmed: false,
        source: 'assumed',
    })
    h.evaluate("syncPlaybackRateFromVideo({ playbackRate: 1 }, 'initial')")
    assert.equal(h.evaluate('playbackRateState.effectiveRate'), 2)
    assert.equal(h.evaluate('playbackRateState.confirmed'), false)
    h.evaluate("syncPlaybackRateFromVideo(null, 'watchdog')")
    assert.equal(h.evaluate('playbackRateState.effectiveRate'), 2)
})

test('v1.5.3: non-1x observation and ratechange confirm the actual rate', { skip: !fs.existsSync(v142) }, () => {
    const h = loadUserscript(v142, { gmSeed: { disabled: true } })
    h.evaluate("syncPlaybackRateFromVideo({ playbackRate: 1.5 }, 'initial')")
    assert.equal(h.evaluate('playbackRateState.observedRate'), 1.5)
    assert.equal(h.evaluate('playbackRateState.confirmed'), true)
    h.evaluate("syncPlaybackRateFromVideo({ playbackRate: 1 }, 'ratechange')")
    assert.equal(h.evaluate('playbackRateState.observedRate'), 1)
    assert.equal(h.evaluate('playbackRateState.effectiveRate'), 1)
    assert.equal(h.evaluate('playbackRateState.source'), 'ratechange')
})

test('v1.5.3: invalid rates reset to assumed 2x and demand is bounded', { skip: !fs.existsSync(v142) }, () => {
    const h = loadUserscript(v142, { gmSeed: { disabled: true } })
    h.evaluate("syncPlaybackRateFromVideo({ playbackRate: 2 }, 'ratechange')")
    h.evaluate("syncPlaybackRateFromVideo({ playbackRate: Infinity }, 'watchdog')")
    assert.equal(h.evaluate('playbackRateState.effectiveRate'), 2)
    assert.equal(h.evaluate('playbackRateState.confirmed'), false)
    h.evaluate("syncPlaybackRateFromVideo({ playbackRate: 8 }, 'ratechange')")
    assert.equal(h.evaluate('playbackRateState.observedRate'), 8)
    assert.equal(h.evaluate('playbackRateState.effectiveRate'), 4)
    h.evaluate("syncPlaybackRateFromVideo(Object.defineProperty({}, 'playbackRate', { get() { throw new Error('blocked') } }), 'watchdog')")
    assert.equal(h.evaluate('playbackRateState.effectiveRate'), 2)
    assert.equal(h.evaluate('playbackRateState.confirmed'), false)
})

test('v1.5.3: SPA stream reset does not retain the previous video rate', { skip: !fs.existsSync(v142) }, () => {
    const h = loadUserscript(v142, { gmSeed: { disabled: true } })
    h.evaluate("syncPlaybackRateFromVideo({ playbackRate: 1 }, 'ratechange')")
    assert.equal(h.evaluate('playbackRateState.effectiveRate'), 1)
    h.evaluate('resetStreamProfile()')
    assert.deepEqual(JSON.parse(h.evaluate('JSON.stringify(playbackRateState)')), {
        observedRate: 2,
        effectiveRate: 2,
        confirmed: false,
        source: 'assumed',
    })
})

test('v1.5.3: high-bitrate 1x threshold is unchanged and 2x doubles it', { skip: !fs.existsSync(v142) }, () => {
    const h = loadUserscript(v142, { gmSeed: { disabled: true } })
    const one = h.evaluate('getWatchdogRequiredBps(20, 1, true)')
    const two = h.evaluate('getWatchdogRequiredBps(20, 2, true)')
    assert.equal(one, 20 * 1e6 / 8)
    assert.equal(two, one * 2)
    h.evaluate('setBufferTargetFromBitrate(12e6, true)')
    const bufferOne = h.evaluate('getBufferTargetBytes(1)')
    const bufferTwo = h.evaluate('getBufferTargetBytes(2)')
    assert.equal(bufferTwo, bufferOne * 2)
})

const makeWatchdogVideo = (h, aheadRef) => {
    const video = h.document.createElement('video')
    Object.assign(video, {
        playbackRate: 2,
        currentTime: 0,
        videoHeight: 2160,
        readyState: 4,
        paused: false,
        seeking: false,
        ended: false,
        isConnected: true,
        clientWidth: 3840,
        clientHeight: 2160,
        buffered: {
        length: 1,
        start() { return 0 },
        end() { return this.video.currentTime + aheadRef.value },
        video: null,
        },
    })
    return video
}

const runWatchdogSeconds = (h, video, seconds) => {
    for (let i = 0; i < seconds; i++) {
        h.clock.advance(1000)
        video.currentTime += video.playbackRate
        h.timers.runTimers(1000)
    }
}

test('v1.5.3: normal 2x progress is not misclassified as seek and stable buffer does not switch', { skip: !fs.existsSync(v142) }, () => {
    const now = 1_700_000_000_000
    const host = 'upos-sz-mirroraliov.bilivideo.com'
    const h = loadUserscript(v142, {
        now,
        gmSeed: { disabled: false, probeCache_v1: JSON.stringify({ t: now, list: [host] }) },
    })
    const ahead = { value: 8 }
    const video = makeWatchdogVideo(h, ahead)
    video.buffered.video = video
    h.document.querySelectorAll = selector => selector === 'video' ? [video] : []
    h.evaluate('currentStreamBitsPerSec = 20e6')
    h.evaluate(`Watchdog.noteExternalBytes(${JSON.stringify(host)}, 1000000)`)
    runWatchdogSeconds(h, video, 9)
    assert.equal(h.evaluate('inSeekGrace()'), false)
    assert.equal(h.evaluate('Watchdog.stats().switchCount'), 0)
})

test('v1.5.3: sustained 2x buffer loss with insufficient throughput still triggers repair', { skip: !fs.existsSync(v142) }, () => {
    const now = 1_700_000_000_000
    const host = 'upos-sz-mirroraliov.bilivideo.com'
    const h = loadUserscript(v142, {
        now,
        gmSeed: { disabled: false, probeCache_v1: JSON.stringify({ t: now, list: [host] }) },
    })
    const ahead = { value: 9 }
    const video = makeWatchdogVideo(h, ahead)
    video.buffered.video = video
    h.document.querySelectorAll = selector => selector === 'video' ? [video] : []
    h.evaluate('currentStreamBitsPerSec = 20e6')
    h.evaluate(`Watchdog.noteExternalBytes(${JSON.stringify(host)}, 1000000)`)
    for (let i = 0; i < 8; i++) {
        ahead.value = Math.max(3, ahead.value - 0.75)
        runWatchdogSeconds(h, video, 1)
    }
    assert.ok(h.evaluate('Watchdog.stats().stallCount') > 0)
    assert.ok(h.evaluate('Watchdog.stats().switchCount') > 0)
})

test('v1.5.3: AV1 preference selects capable AV1 and tolerates unknown capability', { skip: !fs.existsSync(v142) }, () => {
    const h = loadUserscript(v142, {
        gmSeed: { disabled: true },
        preferredVideoCodec: 'av1',
        mediaSourceSupport: true,
    })
    const unknown = h.evaluate(`(() => {
        codecCapability.clear()
        const dash = { video: ${JSON.stringify(representations())} }
        normalizeDashCodecPreference(dash)
        return dash.video.map(normalizeCodecName)
    })()`)
    assert.equal(unknown[0], 'av1')
    const good = h.evaluate(`(() => {
        ${seedCapability(0, { supported: true, smooth: true, powerEfficient: true })}
        ${seedCapability(1, { supported: true, smooth: true, powerEfficient: true })}
        const dash = { video: ${JSON.stringify(representations())} }
        normalizeDashCodecPreference(dash)
        return dash.video.map(normalizeCodecName)
    })()`)
    assert.deepEqual([...good], ['av1', 'hevc', 'avc'])
})

test('v1.5.3: AV1 explicit negative capability falls back HEVC then AVC', { skip: !fs.existsSync(v142) }, () => {
    const h = loadUserscript(v142, {
        gmSeed: { disabled: true },
        preferredVideoCodec: 'av1',
        mediaSourceSupport: true,
    })
    const ordered = h.evaluate(`(() => {
        ${seedCapability(0, { supported: true, smooth: false, powerEfficient: true })}
        ${seedCapability(1, { supported: true, smooth: true, powerEfficient: true })}
        const dash = { video: ${JSON.stringify(representations())} }
        normalizeDashCodecPreference(dash)
        return dash.video.map(normalizeCodecName)
    })()`)
    assert.deepEqual([...ordered], ['hevc', 'avc', 'av1'])
})

test('v1.5.3: every explicit negative Media Capabilities field lowers AV1 priority', { skip: !fs.existsSync(v142) }, () => {
    for (const field of ['supported', 'smooth', 'powerEfficient']) {
        const h = loadUserscript(v142, {
            gmSeed: { disabled: true },
            preferredVideoCodec: 'av1',
            mediaSourceSupport: true,
        })
        const order = h.evaluate(`(() => {
            codecCapability.clear()
            ${seedCapability(0, { supported: true, smooth: true, powerEfficient: true, [field]: false })}
            ${seedCapability(1, { supported: true, smooth: true, powerEfficient: true })}
            const dash = { video: ${JSON.stringify(representations())} }
            normalizeDashCodecPreference(dash)
            return dash.video.map(normalizeCodecName)
        })()`)
        assert.deepEqual([...order], ['hevc', 'avc', 'av1'], field)
    }
})

test('v1.5.3: unsupported AV1 is not promoted; legacy preferences remain stable', { skip: !fs.existsSync(v142) }, () => {
    const support = mime => !mime.includes('av01')
    const av1 = loadUserscript(v142, { gmSeed: { disabled: true }, preferredVideoCodec: 'av1', mediaSourceSupport: support })
    const av1Order = av1.evaluate(`(() => {
        const dash = { video: ${JSON.stringify(representations())} }
        normalizeDashCodecPreference(dash)
        return dash.video.map(normalizeCodecName)
    })()`)
    assert.equal(av1Order.includes('av1'), false)
    assert.equal(av1Order[0], 'hevc')

    const hevc = loadUserscript(v142, { gmSeed: { disabled: true }, preferredVideoCodec: 'hevc', mediaSourceSupport: true })
    const hevcOrder = hevc.evaluate(`(() => { const dash = { video: ${JSON.stringify(representations())} }; normalizeDashCodecPreference(dash); return dash.video.map(normalizeCodecName) })()`)
    assert.deepEqual([...hevcOrder], ['hevc', 'avc', 'av1'])

    const avc = loadUserscript(v142, { gmSeed: { disabled: true }, preferredVideoCodec: 'avc', mediaSourceSupport: true })
    const avcOrder = avc.evaluate(`(() => { const dash = { video: ${JSON.stringify(representations())} }; normalizeDashCodecPreference(dash); return dash.video.map(normalizeCodecName) })()`)
    assert.deepEqual([...avcOrder], ['avc', 'hevc', 'av1'])

    const auto = loadUserscript(v142, { gmSeed: { disabled: true }, preferredVideoCodec: 'auto', mediaSourceSupport: true })
    const autoOrder = auto.evaluate(`(() => { const dash = { video: ${JSON.stringify(representations())} }; normalizeDashCodecPreference(dash); return dash.video.map(normalizeCodecName) })()`)
    assert.deepEqual([...autoOrder], ['av1', 'hevc', 'avc'])

    const invalid = loadUserscript(v142, { gmSeed: { disabled: true }, preferredVideoCodec: 'bogus', mediaSourceSupport: true })
    assert.equal(invalid.evaluate('resolvedVideoCodecPreference'), 'hevc')
    const invalidOrder = invalid.evaluate(`(() => { const dash = { video: ${JSON.stringify(representations())} }; normalizeDashCodecPreference(dash); return dash.video.map(normalizeCodecName) })()`)
    assert.deepEqual([...invalidOrder], ['hevc', 'avc', 'av1'])
})

test('v1.5.3: MIME codec strings qualify for exact support and diagnostics stay read-only', { skip: !fs.existsSync(v142) }, () => {
    const h = loadUserscript(v142, {
        gmSeed: { disabled: true },
        preferredVideoCodec: 'av1',
        mediaSourceSupport: mime => mime.includes('av01') || mime.includes('hev1') || mime.includes('avc1'),
    })
    const order = h.evaluate(`(() => {
        codecCapability.clear()
        const dash = { video: [
            { id: 80, height: 1080, mimeType: 'video/mp4; codecs="av01.0.08M.08"', codecid: 13 },
            { id: 80, height: 1080, codecs: 'hev1.1.6.L93.B0', codecid: 12 },
            { id: 80, height: 1080, codecs: 'avc1.640028', codecid: 7 }
        ] }
        normalizeDashCodecPreference(dash)
        syncPlaybackRateFromVideo({ playbackRate: 2 }, 'ratechange')
        refreshPublicDiagnosticSnapshot()
        return dash.video.map(normalizeCodecName)
    })()`)
    assert.deepEqual([...order], ['av1', 'hevc', 'avc'])
    const snapshot = h.pageWindow.BiliCDN
    assert.equal(snapshot.playback.effectiveRate, 2)
    assert.equal(snapshot.playback.confirmed, true)
    assert.equal(snapshot.codec.preference, 'av1')
    assert.equal(snapshot.codec.groups[0].selected, 'av1')
    assert.equal(Object.isFrozen(snapshot.playback), true)
    assert.equal(Object.isFrozen(snapshot.codec), true)
})

test('v1.5.3: ratechange event can explicitly confirm 1x after assumed startup', { skip: !fs.existsSync(v142) }, () => {
    const h = loadUserscript(v142, { gmSeed: { disabled: false } })
    const video = h.document.createElement('video')
    Object.assign(video, {
        playbackRate: 1,
        currentTime: 0,
        videoHeight: 1080,
        readyState: 4,
        paused: false,
        seeking: false,
        isConnected: true,
        clientWidth: 1920,
        clientHeight: 1080,
        buffered: { length: 0, start() { return 0 }, end() { return 0 } },
    })
    h.document.querySelectorAll = selector => selector === 'video' ? [video] : []
    h.timers.runTimers(800)
    assert.equal(h.evaluate('playbackRateState.effectiveRate'), 2)
    video.dispatchEvent(new FakeEvent('ratechange'))
    assert.equal(h.evaluate('playbackRateState.effectiveRate'), 1)
    assert.equal(h.evaluate('playbackRateState.confirmed'), true)
})
