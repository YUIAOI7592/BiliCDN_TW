import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const F = require('../harness/v153-fixture')
const target = require('../harness/current-script')
const previous = 'Release/v1.8.5/BiliCDN_TW.user.js'

const load = file => F.load({ instrument: file === target, gmSeed: { verbose: true } }, file)

const shortVideo = h => {
    const v = F.video(h, 1080)
    Object.assign(v, {
        paused: false,
        currentTime: 82.762031,
        duration: 86.8,
        readyState: 4,
    })
    v.setAhead(86.8 - 82.762031)
    return v
}

test('v185 reproduction: a fully buffered short-video tail starts an unnecessary recovery', async () => {
    const h = load(previous)
    shortVideo(h)
    await h.timers.advanceAsync(8000)
    assert.ok(h.pageWindow.BiliCDN.buffer.switchCount > 0)
})

test('v186 treats a contiguous range reaching duration as buffered to end', async () => {
    const h = load(target)
    shortVideo(h)
    await h.timers.advanceAsync(8000)

    const stats = F.json(h, 'Watchdog.stats()')
    const decision = F.json(h, 'DiagnosticLog.snapshot().decision')
    assert.equal(stats.switchCount, 0)
    assert.equal(stats.recoveryAttemptCount, 0)
    assert.equal(stats.stallCount, 0)
    assert.equal(decision.reason, 'buffered-to-end')
    assert.ok(Math.abs(decision.remainingSec - (86.8 - 82.762031)) < 0.001)
})

test('v186 resumes ordinary monitoring when duration later extends', async () => {
    const h = load(target)
    const v = shortVideo(h)
    await h.timers.advanceAsync(6000)
    assert.equal(F.json(h, 'DiagnosticLog.snapshot().decision').reason, 'buffered-to-end')

    v.duration = 100
    await h.timers.advanceAsync(3000)
    assert.notEqual(F.json(h, 'DiagnosticLog.snapshot().decision').reason, 'buffered-to-end')
    assert.ok(h.evaluate('Watchdog.stats().switchCount') > 0)
})

test('v186 does not treat a non-contiguous final range as buffered to end', async () => {
    const h = load(target)
    const v = shortVideo(h)
    v.buffered = {
        length: 2,
        start: index => index === 0 ? 0 : 84,
        end: index => index === 0 ? 82 : 86.8,
    }
    await h.timers.advanceAsync(8000)

    assert.notEqual(F.json(h, 'DiagnosticLog.snapshot().decision').reason, 'buffered-to-end')
    assert.ok(h.evaluate('Watchdog.stats().switchCount') > 0)
})

test('v186 ignores non-finite live duration for the terminal buffer guard', async () => {
    const h = load(target)
    const v = shortVideo(h)
    v.duration = Infinity
    await h.timers.advanceAsync(8000)

    assert.notEqual(F.json(h, 'DiagnosticLog.snapshot().decision').reason, 'buffered-to-end')
})
