import test from 'node:test'
import assert from 'node:assert/strict'
import { createVideoCoreRecovery } from '../../src/playback/video-core-recovery.mjs'

function fixture({ fixed = false, reloadAvailable = true } = {}) {
    let now = 1_000_000
    let generation = 1
    let userActivation = false
    let liveness = { coreInitialized: true, coreRevision: 1, videoGroups: 3, audioGroups: 1 }
    const media = {
        video: { host: 'video.example', source: 'xhr', bytes: 100, ageSec: 0, fresh: true },
        audio: { host: 'audio.example', source: 'xhr', bytes: 100, ageSec: 0, fresh: true },
    }
    const quality = { available: true, totalFrames: 100 }
    const events = [], routes = [], calls = [], mediaCalls = []
    let playerTime = 80, playerRate = 2
    const player = {
        ...(reloadAvailable ? { reload() { calls.push(['reload']); return Promise.resolve() } } : {}),
        seek(value) { calls.push(['seek', value]) },
        setPlaybackRate(value) { calls.push(['rate', value]) },
        play() { calls.push(['play']); return Promise.resolve() },
        getCurrentTime() { return playerTime },
        getPlaybackRate() { return playerRate },
    }
    let currentPlayer = player
    const recovery = createVideoCoreRecovery({
        now: () => now,
        get runtimeGeneration() { return generation },
        get playinfoEpoch() { return 2 },
        getMediaDeliverySnapshot: () => media,
        get playbackQualitySnapshot() { return quality },
        inspectPlayerLiveness: () => liveness,
        getPlayer: () => currentPlayer,
        isUserActivationActive: () => userActivation,
        beginRouteRecovery: (...args) => routes.push(args),
        getNativeRouteDiagnostics: () => ({ currentHost: 'video.example' }),
        getAttributedVideoHost: () => 'video.example',
        get resolvedCdn() { return fixed ? 'fixed.example' : null },
        DiagnosticLog: { record: (code, data) => events.push({ code, data }) },
    })
    const video = {
        videoWidth: 1920, videoHeight: 1080, duration: 600,
        play(...args) { mediaCalls.push({ receiver: this, args }); return Promise.resolve() },
    }
    const playback = { available: true, valid: true, paused: false, seeking: false, ended: false,
        errorCode: 0, readyState: 4, currentTime: 80, duration: 600, bufferAheadSec: 20, effectiveRate: 2 }
    return {
        recovery, video, playback, media, quality, player, calls, mediaCalls, routes, events,
        advance(ms) { now += ms },
        setLiveness(next) { liveness = { ...liveness, ...next } },
        setGeneration(next) { generation = next },
        setUserActivation(next) { userActivation = next },
        setPlayerTime(next) { playerTime = next },
        setPlayerRate(next) { playerRate = next },
        setPlayer(next) { currentPlayer = next },
    }
}

function enterLongPause(f) {
    f.recovery.tick(f.video, f.playback)
    f.advance(1000)
    f.playback.paused = true
    f.recovery.tick(f.video, f.playback)
    f.advance(30_001)
    f.playback.readyState = 0
    f.playback.bufferAheadSec = 5
    f.video.videoWidth = 0
    f.video.videoHeight = 0
    f.setLiveness({ coreInitialized: false })
}

function enterLongResume(f) {
    enterLongPause(f)
    f.playback.paused = false
    f.recovery.tick(f.video, f.playback)
}

function trustedPlayWhileDead(f) {
    f.setUserActivation(true)
    const result = f.video.play('resume')
    f.setUserActivation(false)
    f.recovery.tick(f.video, f.playback)
    return result
}

test('trusted media play recovers the observed paused dead-core shape and preserves wrapper time', async () => {
    const f = fixture()
    f.playback.currentTime = 349.434
    f.setPlayerTime(349.434)
    enterLongPause(f)
    f.playback.currentTime = 0
    trustedPlayWhileDead(f)
    assert.equal(f.playback.paused, true)
    assert.equal(f.recovery.summary().intentSource, 'trusted-media-play')
    assert.equal(f.recovery.summary().savedPositionSec, 349.434)

    f.advance(4000)
    f.recovery.tick(f.video, f.playback)
    await Promise.resolve()
    assert.equal(f.calls.filter(call => call[0] === 'reload').length, 1)
    assert.equal(f.routes.length, 0)

    f.advance(1000)
    f.playback.readyState = 1
    f.video.videoWidth = 1920
    f.video.videoHeight = 1080
    f.setLiveness({ coreInitialized: true, coreRevision: 2 })
    f.recovery.tick(f.video, f.playback)
    await Promise.resolve()
    assert.deepEqual(f.calls.slice(-3), [['seek', 349.434], ['rate', 2], ['play']])
    assert.equal(f.recovery.summary().postReloadPlayOutcome, 'resolved')
})

test('temporary play wrapper preserves receiver, arguments, return value, and synchronous throws', () => {
    const f = fixture()
    const returned = { exact: true }
    let received = null
    f.video.play = function (...args) { received = { receiver: this, args }; return returned }
    enterLongPause(f)
    f.setUserActivation(true)
    assert.equal(f.video.play('a', 2), returned)
    f.setUserActivation(false)
    assert.equal(received.receiver, f.video)
    assert.deepEqual(received.args, ['a', 2])

    const thrown = new Error('original-play-error')
    const g = fixture()
    g.video.play = function () { throw thrown }
    enterLongPause(g)
    g.setUserActivation(true)
    assert.throws(() => g.video.play(), error => error === thrown)
    g.setUserActivation(false)
    assert.equal(g.recovery.summary().intentSource, 'trusted-media-play')
})

test('programmatic play without transient user activation cannot trigger reload', () => {
    const f = fixture()
    enterLongPause(f)
    f.video.play()
    f.advance(20_000)
    f.media.audio.bytes += 100
    f.recovery.tick(f.video, f.playback)
    assert.equal(f.recovery.summary().resumeToken, 0)
    assert.equal(f.calls.filter(call => call[0] === 'reload').length, 0)
})

test('short pause play is passed through but cannot create a recovery token', () => {
    const f = fixture()
    f.recovery.tick(f.video, f.playback)
    f.advance(1000)
    f.playback.paused = true
    f.recovery.tick(f.video, f.playback)
    f.advance(29_000)
    f.setUserActivation(true)
    f.video.play()
    f.setUserActivation(false)
    assert.equal(f.recovery.summary().resumeToken, 0)
    assert.equal(f.calls.filter(call => call[0] === 'reload').length, 0)
})

test('seek, ended, and media-error pauses never arm the play-intent hook', () => {
    for (const blocked of [{ seeking: true }, { ended: true }, { errorCode: 3 }]) {
        const f = fixture()
        f.recovery.tick(f.video, f.playback)
        f.advance(1000)
        Object.assign(f.playback, blocked, { paused: true })
        f.recovery.tick(f.video, f.playback)
        f.advance(30_001)
        f.recovery.tick(f.video, f.playback)
        assert.equal(f.recovery.summary().playHookState, 'not-installed')
        assert.equal(f.recovery.summary().resumeToken, 0)
    }
})

test('hook restoration never overwrites a site replacement and reset restores an owned hook', () => {
    const f = fixture()
    const original = f.video.play
    f.recovery.tick(f.video, f.playback)
    f.playback.paused = true
    f.recovery.tick(f.video, f.playback)
    assert.notEqual(f.video.play, original)
    f.recovery.reset()
    assert.equal(f.video.play, original)

    const g = fixture()
    g.recovery.tick(g.video, g.playback)
    g.playback.paused = true
    g.recovery.tick(g.video, g.playback)
    const replacement = () => 'site-replacement'
    g.video.play = replacement
    g.playback.paused = false
    g.recovery.tick(g.video, g.playback)
    assert.equal(g.video.play, replacement)
})

test('a replacement outer player is adopted on the next paused tick', () => {
    const f = fixture()
    f.recovery.tick(f.video, f.playback)
    f.playback.paused = true
    f.recovery.tick(f.video, f.playback)
    f.advance(30_001)
    const replacementPlayer = {
        getCurrentTime: () => 321.25,
        getPlaybackRate: () => 1.5,
        reload: () => Promise.resolve(),
        play: () => Promise.resolve(),
    }
    f.setPlayer(replacementPlayer)
    f.recovery.tick(f.video, f.playback)
    f.setUserActivation(true)
    f.video.play()
    f.setUserActivation(false)
    assert.equal(f.recovery.summary().savedPositionSec, 321.25)
    assert.equal(f.recovery.summary().savedRate, 1.5)
})

test('non-writable play method fails open without altering the media element', () => {
    const f = fixture()
    const original = f.video.play
    Object.defineProperty(f.video, 'play', { value: original, configurable: false, writable: false })
    f.recovery.tick(f.video, f.playback)
    f.playback.paused = true
    f.recovery.tick(f.video, f.playback)
    assert.equal(f.video.play, original)
    assert.equal(f.recovery.summary().state, 'hook-unavailable')
    assert.equal(f.recovery.summary().playHookState, 'unavailable')
})

test('post-reload play rejection reports recovered-paused and never retries', async () => {
    const f = fixture()
    f.player.play = function () {
        f.calls.push(['play'])
        return Promise.reject(new Error('autoplay-rejected'))
    }
    enterLongPause(f)
    trustedPlayWhileDead(f)
    f.advance(4000)
    f.recovery.tick(f.video, f.playback)
    f.advance(1000)
    f.playback.readyState = 1
    f.video.videoWidth = 1920
    f.video.videoHeight = 1080
    f.setLiveness({ coreInitialized: true, coreRevision: 2 })
    f.recovery.tick(f.video, f.playback)
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(f.recovery.summary().state, 'recovered-paused')
    assert.equal(f.recovery.summary().postReloadPlayOutcome, 'rejected')
    assert.equal(f.calls.filter(entry => entry[0] === 'play').length, 1)
})

test('paused-transition fallback reloads once and restores time, rate, and play intent', async () => {
    const f = fixture()
    enterLongResume(f)
    f.advance(10_000)
    f.media.audio.bytes += 100
    f.recovery.tick(f.video, f.playback)
    await Promise.resolve()

    assert.equal(f.calls.filter(call => call[0] === 'reload').length, 1)
    assert.equal(f.routes.length, 0)
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

test('player-core recovery never changes route affinity', () => {
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
