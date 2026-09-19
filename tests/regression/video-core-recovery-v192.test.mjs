import test from 'node:test'
import assert from 'node:assert/strict'
import { createVideoCoreRecovery } from '../../src/playback/video-core-recovery.mjs'

function fixture({ fixed = false, reloadAvailable = true } = {}) {
    let now = 1_000_000
    let generation = 1
    let liveness = { coreInitialized: true, coreRevision: 1, videoGroups: 3, audioGroups: 1 }
    const media = {
        video: { host: 'video.example', source: 'xhr', bytes: 100, ageSec: 0, fresh: true },
        audio: { host: 'audio.example', source: 'xhr', bytes: 100, ageSec: 0, fresh: true },
    }
    const quality = { available: true, totalFrames: 100 }
    const events = [], routes = [], calls = []
    const player = {
        ...(reloadAvailable ? { reload() { calls.push(['reload']); return Promise.resolve() } } : {}),
        seek(value) { calls.push(['seek', value]) },
        setPlaybackRate(value) { calls.push(['rate', value]) },
        play() { calls.push(['play']); return Promise.resolve() },
    }
    const recovery = createVideoCoreRecovery({
        now: () => now,
        get runtimeGeneration() { return generation },
        get playinfoEpoch() { return 2 },
        getMediaDeliverySnapshot: () => media,
        get playbackQualitySnapshot() { return quality },
        inspectPlayerLiveness: () => liveness,
        getPlayer: () => player,
        beginRouteRecovery: (...args) => routes.push(args),
        getNativeRouteDiagnostics: () => ({ currentHost: 'video.example' }),
        getAttributedVideoHost: () => 'video.example',
        get resolvedCdn() { return fixed ? 'fixed.example' : null },
        DiagnosticLog: { record: (code, data) => events.push({ code, data }) },
    })
    const video = { videoWidth: 1920, videoHeight: 1080, duration: 600 }
    const playback = { available: true, valid: true, paused: false, seeking: false, ended: false,
        errorCode: 0, readyState: 4, currentTime: 80, duration: 600, bufferAheadSec: 20, effectiveRate: 2 }
    return {
        recovery, video, playback, media, quality, player, calls, routes, events,
        advance(ms) { now += ms },
        setLiveness(next) { liveness = { ...liveness, ...next } },
        setGeneration(next) { generation = next },
    }
}

function enterLongResume(f) {
    f.recovery.tick(f.video, f.playback)
    f.advance(1000)
    f.playback.paused = true
    f.recovery.tick(f.video, f.playback)
    f.advance(30_001)
    f.playback.paused = false
    f.playback.readyState = 0
    f.playback.bufferAheadSec = 5
    f.video.videoWidth = 0
    f.video.videoHeight = 0
    f.setLiveness({ coreInitialized: false })
    f.recovery.tick(f.video, f.playback)
}

test('long-pause audio-only dead core reloads once and restores time, rate, and play intent', async () => {
    const f = fixture()
    enterLongResume(f)
    f.advance(10_000)
    f.media.audio.bytes += 100
    f.recovery.tick(f.video, f.playback)
    await Promise.resolve()

    assert.equal(f.calls.filter(call => call[0] === 'reload').length, 1)
    assert.equal(f.routes.length, 1)
    assert.equal(f.routes[0][0], 'video-init-dead')
    assert.equal(f.routes[0][2].temporaryMs, 120_000)
    assert.equal(f.recovery.summary().state, 'reloading')

    f.advance(1000)
    f.playback.readyState = 1
    f.video.videoWidth = 1920
    f.video.videoHeight = 1080
    f.setLiveness({ coreInitialized: true, coreRevision: 2 })
    f.recovery.tick(f.video, f.playback)

    assert.deepEqual(f.calls.slice(-3), [['seek', 80], ['rate', 2], ['play']])
    assert.equal(f.recovery.summary().state, 'recovered')
})

test('initial startup and a short pause never enter the reload path', () => {
    const f = fixture()
    f.playback.readyState = 0
    f.video.videoWidth = 0
    f.video.videoHeight = 0
    f.setLiveness({ coreInitialized: false })
    f.recovery.tick(f.video, f.playback)
    f.advance(20_000)
    f.recovery.tick(f.video, f.playback)
    assert.equal(f.calls.length, 0)

    f.playback.readyState = 4
    f.video.videoWidth = 1920
    f.video.videoHeight = 1080
    f.recovery.tick(f.video, f.playback)
    f.playback.paused = true
    f.recovery.tick(f.video, f.playback)
    f.advance(5000)
    f.playback.paused = false
    f.playback.readyState = 0
    f.video.videoWidth = 0
    f.video.videoHeight = 0
    f.recovery.tick(f.video, f.playback)
    f.advance(20_000)
    f.recovery.tick(f.video, f.playback)
    assert.equal(f.calls.length, 0)
})

test('fresh video evidence cancels a pending long-resume diagnosis', () => {
    const f = fixture()
    enterLongResume(f)
    f.advance(5000)
    f.media.video.bytes += 100
    f.recovery.tick(f.video, f.playback)
    f.advance(10_000)
    f.recovery.tick(f.video, f.playback)
    assert.equal(f.calls.length, 0)
    assert.equal(f.recovery.summary().state, 'healthy')
})

test('fixed mode reloads the player without changing route affinity', () => {
    const f = fixture({ fixed: true })
    enterLongResume(f)
    f.advance(10_000)
    f.media.audio.bytes += 100
    f.recovery.tick(f.video, f.playback)
    assert.equal(f.calls.filter(call => call[0] === 'reload').length, 1)
    assert.equal(f.routes.length, 0)
})

test('missing reload API fails open and enters the breaker without looping', () => {
    const f = fixture({ reloadAvailable: false })
    enterLongResume(f)
    f.advance(10_000)
    f.media.audio.bytes += 100
    f.recovery.tick(f.video, f.playback)
    f.advance(30_000)
    f.recovery.tick(f.video, f.playback)
    assert.equal(f.calls.length, 0)
    assert.equal(f.recovery.summary().state, 'reload-failed')
    assert.ok(f.recovery.summary().breakerSec > 0)
})

test('missing initialized signal requires 15 seconds and continued audio progress', () => {
    const f = fixture()
    enterLongResume(f)
    f.setLiveness({ coreInitialized: null })
    f.advance(10_000)
    f.recovery.tick(f.video, f.playback)
    assert.equal(f.calls.length, 0)
    f.advance(5000)
    f.media.audio.bytes += 100
    f.recovery.tick(f.video, f.playback)
    assert.equal(f.calls.filter(call => call[0] === 'reload').length, 1)
})

test('reload timeout enters a 90-second breaker and cannot loop', () => {
    const f = fixture()
    enterLongResume(f)
    f.advance(10_000)
    f.media.audio.bytes += 100
    f.recovery.tick(f.video, f.playback)
    assert.equal(f.calls.filter(call => call[0] === 'reload').length, 1)
    f.advance(15_000)
    f.recovery.tick(f.video, f.playback)
    assert.equal(f.recovery.summary().state, 'reload-failed')
    assert.equal(f.recovery.summary().breakerSec, 90)
    f.playback.paused = true
    f.recovery.tick(f.video, f.playback)
    f.advance(30_001)
    f.playback.paused = false
    f.recovery.tick(f.video, f.playback)
    assert.equal(f.calls.filter(call => call[0] === 'reload').length, 1)
})
