'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const { loadUserscript } = require('../harness/userscript-vm')

const root = path.resolve(__dirname, '../..')
const v140 = path.join(root, 'baseline', 'BiliCDN_TW_1.3.4.original.user.js')
const fixedVersion = '1.5.2'
const v141 = require('../harness/current-script')
const cdn = 'upos-sz-mirroraliov.bilivideo.com'

const snapshot = h => h.evaluate(`({
    fail: cdnFailCount[${JSON.stringify(cdn)}] || 0,
    soft: !!cdnSoftBlockUntil[${JSON.stringify(cdn)}],
    forced: forcedRedirectHosts.size,
    bakeoff: getLastBakeoffAt()
})`)

test('CS-002 reproduction: v1.4.0 trusts a forged console error', () => {
    const h = loadUserscript(v140, { gmSeed: { disabled: false } })
    const before = snapshot(h)
    h.context.console.error({ code: 4105, url: `https://${cdn}/fake.m4s` })
    const after = snapshot(h)
    assert.ok(after.fail > before.fail)
    assert.equal(after.soft, true)
    assert.ok(after.forced > before.forced)
})

test('CS-002 fixed: forged console output has no routing side effects', { skip: !fs.existsSync(v141) }, () => {
    const h = loadUserscript(v141, { gmSeed: { disabled: false } })
    const before = snapshot(h)
    const fetchCount = h.fetchCalls.length
    h.context.console.error({ code: 4105, url: `https://${cdn}/fake.m4s` })
    assert.deepEqual(snapshot(h), before)
    assert.equal(h.fetchCalls.length, fetchCount)
})

test('CS-002 fixed: verified Fetch rejection still penalizes and redirects a catalog CDN', { skip: !fs.existsSync(v141) }, async () => {
    const h = loadUserscript(v141, {
        gmSeed: { disabled: false },
        fetchImpl: async input => {
            const url = input instanceof Request ? input.url : String(input)
            if (url.includes('.m4s')) throw new TypeError('network failed')
            return new Response('', { status: 204 })
        },
    })
    await assert.rejects(h.pageWindow.fetch(`https://${cdn}/video.m4s`))
    const after = snapshot(h)
    assert.ok(after.fail > 0)
    assert.equal(after.soft, true)
    assert.ok(after.forced > 0)
})

test('CS-002 fixed: verified XHR error is handled, while Fetch AbortError is ignored', { skip: !fs.existsSync(v141) }, async () => {
    const xhrHarness = loadUserscript(v141, { gmSeed: { disabled: false } })
    const xhr = new xhrHarness.pageWindow.XMLHttpRequest()
    xhr.open('GET', `https://${cdn}/video.m4s`)
    xhr.send()
    const beforeForged = snapshot(xhrHarness)
    xhr.dispatchEvent(new xhrHarness.context.ProgressEvent('progress', { loaded: 256 * 1024 }))
    xhr.dispatchEvent(new xhrHarness.context.Event('error'))
    assert.deepEqual(snapshot(xhrHarness), beforeForged)
    assert.equal(xhrHarness.evaluate('Watchdog.stats().totalMB'), 0)

    xhr.progress(256 * 1024)
    assert.equal(xhrHarness.evaluate('Watchdog.stats().totalMB'), 0.25)
    xhr.fail()
    assert.ok(snapshot(xhrHarness).fail > 0)

    const abortHarness = loadUserscript(v141, {
        gmSeed: { disabled: false },
        fetchImpl: async input => {
            const url = input instanceof Request ? input.url : String(input)
            if (url.includes('.m4s')) throw new DOMException('cancelled', 'AbortError')
            return new Response('', { status: 204 })
        },
    })
    const before = snapshot(abortHarness)
    await assert.rejects(abortHarness.pageWindow.fetch(`https://${cdn}/video.m4s`), { name: 'AbortError' })
    assert.deepEqual(snapshot(abortHarness), before)
})

test('CS-002 fixed: rewritten 403 learns host-lock without penalizing target', { skip: !fs.existsSync(v141) }, async () => {
    const originalCdn = 'upos-sz-mirrorali.bilivideo.com'
    const originalUrl = `https://${originalCdn}/video/locked.m4s?token=signed`
    const h = loadUserscript(v141, {
        gmSeed: { disabled: false },
        fetchImpl: async input => {
            const url = input instanceof Request ? input.url : String(input)
            if (url.includes('.m4s')) return new Response('', { status: 403 })
            return new Response('', { status: 204 })
        },
    })
    h.evaluate(`addForcedRedirect(${JSON.stringify(originalCdn)})`)
    await h.pageWindow.fetch(originalUrl)
    assert.equal(h.evaluate(`isHostLockedStream(${JSON.stringify(originalUrl)})`), true)
    assert.equal(snapshot(h).fail, 0)
})

test('CS-002 fixed: forced redirect storage rejects arbitrary hosts and sweeps expiry', { skip: !fs.existsSync(v141) }, () => {
    const h = loadUserscript(v141, { gmSeed: { disabled: true } })
    const result = h.evaluate(`(() => {
        const rejected = addForcedRedirect('attacker.example')
        TRUSTED_CDN_CATALOG.forEach(host => addForcedRedirect(host))
        const bounded = forcedRedirectHosts.size <= FORCED_REDIRECT_MAX
        const first = TRUSTED_CDN_CATALOG[0]
        forcedRedirectHosts.set(first, Date.now() - 1)
        sweepForcedRedirectHosts()
        return { rejected, bounded, expiredGone: !forcedRedirectHosts.has(first) }
    })()`)
    assert.equal(result.rejected, false)
    assert.equal(result.bounded, true)
    assert.equal(result.expiredGone, true)
})
