import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { createVideoResolver } from '../../src/playback/video-resolver.mjs'

const require = createRequire(import.meta.url)
const { loadUserscript } = require('../harness/userscript-vm')
const target = require('../harness/current-script')
const epoch = 1_800_000_000_000
const ali = 'upos-sz-mirrorali.bilivideo.com'
const seed = {
    disabled: false,
    blicdnVersion: '1.9.2',
    throughputSchema: 3,
    probeCache_v1: JSON.stringify({ t: epoch, list: [ali] }),
}
const load = options => loadUserscript(target, { now: epoch, gmSeed: seed, ...(options || {}) })
const restrictionReads = h => h.gmReads.filter(({ key }) => key === 'cdnBlacklist' || key === 'knownDeadHosts_v1')
const restrictionWrites = h => h.gmWrites.filter(({ key }) => key === 'cdnBlacklist' || key === 'knownDeadHosts_v1')

test('v193 restriction freshness gate coalesces selectors, snapshot and the one-second state cycle', async () => {
    const h = load()
    const beforeReads = restrictionReads(h).length
    const beforeWrites = restrictionWrites(h).length

    h.evaluate(`getHealthyCdnList(); getHealthyCdnList(); refreshPublicDiagnosticSnapshot(); getCdnShortName('${ali}')`)
    assert.equal(restrictionReads(h).length, beforeReads)
    assert.equal(restrictionWrites(h).length, beforeWrites)

    await h.timers.advanceAsync(1000)
    const delta = restrictionReads(h).slice(beforeReads)
    assert.equal(delta.filter(({ key }) => key === 'cdnBlacklist').length, 1)
    assert.equal(delta.filter(({ key }) => key === 'knownDeadHosts_v1').length, 1)
    assert.equal(restrictionWrites(h).length, beforeWrites)
})

test('v193 shared-GM restrictions arrive within one state tick and exact expiry bypasses the gate', async () => {
    const h = load()
    await h.timers.advanceAsync(1000)
    const expireAt = h.clock.now + 1500
    h.gm.set('knownDeadHosts_v1', JSON.stringify([{ host: ali, expireAt, reason: 'timeout-shared' }]))

    assert.equal(h.evaluate(`getHealthyCdnList().includes('${ali}')`), true)
    await h.timers.advanceAsync(1000)
    assert.equal(h.evaluate(`knownDeadHosts.has('${ali}')`), true)
    assert.equal(h.evaluate(`getHealthyCdnList().includes('${ali}')`), false)

    h.clock.advance(500)
    assert.equal(h.evaluate(`getHealthyCdnList().includes('${ali}')`), true)
    assert.equal(h.evaluate(`knownDeadHosts.has('${ali}')`), false)
})

test('v193 video resolver retains a connected zero-size player and prefers a newly visible player', () => {
    const first = { isConnected: true, clientWidth: 1920, clientHeight: 1080 }
    const next = { isConnected: true, clientWidth: 0, clientHeight: 0 }
    let videos = [first, next]
    const resolver = createVideoResolver({ queryVideos: () => videos })

    assert.equal(resolver.get(), first)
    first.clientWidth = first.clientHeight = 0
    assert.equal(resolver.get(), first)
    next.clientWidth = 1280; next.clientHeight = 720
    assert.equal(resolver.get(), next)
    next.clientWidth = next.clientHeight = 0
    assert.equal(resolver.get(), next)
    next.isConnected = false
    assert.equal(resolver.get(), first)
    resolver.reset()
    videos = [next, first]
    assert.equal(resolver.get(), first)
})

test('v193 Watchdog and SPA use the shared video resolver including zero-size fallback and reset', async () => {
    const h = load()
    const oldVideo = h.document.createElement('video')
    Object.assign(oldVideo, { isConnected: true, clientWidth: 0, clientHeight: 0 })
    const newVideo = h.document.createElement('video')
    Object.assign(newVideo, { isConnected: true, clientWidth: 0, clientHeight: 0 })
    let videos = [oldVideo]
    const nativeQuery = h.document.querySelectorAll.bind(h.document)
    h.document.querySelectorAll = selector => selector === 'video' ? videos : nativeQuery(selector)

    assert.equal(h.evaluate('Watchdog.getVideo()'), oldVideo)
    newVideo.clientWidth = 1280; newVideo.clientHeight = 720
    videos = [oldVideo, newVideo]
    assert.equal(h.evaluate('Watchdog.getVideo()'), newVideo)

    newVideo.clientWidth = 640; newVideo.clientHeight = 360
    const spaVideo = h.document.createElement('video')
    Object.assign(spaVideo, { isConnected: true, clientWidth: 1920, clientHeight: 1080 })
    videos = [spaVideo]
    h.pageWindow.history.pushState({}, '', '/video/BVv193next')
    await h.timers.advanceAsync(0)
    assert.equal(h.evaluate('Watchdog.getVideo()'), spaVideo)
})

test('v193 removes the ineffective BroadcastChannel bridge while retaining Web Locks routing', () => {
    const h = load()
    assert.equal(h.broadcastChannelCount, 0)
    const application = readFileSync('src/runtime/application.mjs', 'utf8')
    const bakeoff = readFileSync('src/routing/bakeoff.mjs', 'utf8')
    assert.doesNotMatch(application, /BroadcastChannel|crossTabShouldBakeoff|onBakeoffStart/)
    assert.doesNotMatch(bakeoff, /BroadcastChannel|crossTabShouldBakeoff|onBakeoffStart/)
    assert.match(bakeoff, /navigator\.locks\.request/)
})
