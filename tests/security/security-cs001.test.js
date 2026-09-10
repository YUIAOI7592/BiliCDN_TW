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
const hasTrustedUi = true

const trustedUiAction = (h, name) => {
    const host = h.document.getElementById('bilicdn-trusted-menu-ui')
    assert.ok(host)
    assert.equal(host.shadowRoot, null)
    const shadow = h.getClosedShadowRoot(host)
    const action = shadow && shadow.querySelector(`[data-ui-action="${name}"]`)
    assert.ok(action, `missing trusted UI action ${name}`)
    action.dispatchEvent(new h.context.Event('click', { isTrusted: true }))
}

test('CS-001 reproduction: v1.4.0 page API persists a non-catalog bilivideo host', () => {
    const h = loadUserscript(v140, { gmSeed: { disabled: true } })
    assert.equal(typeof h.pageWindow.BiliCDN.setCdn, 'function')
    h.pageWindow.BiliCDN.setCdn('httpdns.bilivideo.com')
    assert.equal(h.gm.get('CustomCDN'), 'httpdns.bilivideo.com')
})

test('CS-001 reproduction: v1.4.0 menu callbacks dereference the page global', () => {
    const h = loadUserscript(v140, { gmSeed: { disabled: true } })
    let hijacked = false
    h.pageWindow.BiliCDN = { reset() { hijacked = true } }
    const reset = h.menus.find(menu => menu.label.includes('重置'))
    assert.ok(reset)
    reset.callback()
    assert.equal(hijacked, true)
})

test('CS-001 fixed: v1.5.3 exposes only immutable data and rejects non-catalog CustomCDN', { skip: !fs.existsSync(v141) }, () => {
    const h = loadUserscript(v141, { gmSeed: { disabled: true, CustomCDN: 'httpdns.bilivideo.com' } })
    assert.equal(Object.values(h.pageWindow.BiliCDN).some(value => typeof value === 'function'), false)
    assert.equal(h.evaluate("isValidCustomCdnHost('httpdns.bilivideo.com')"), false)
    assert.equal(h.gm.has('CustomCDN'), false)
    const before = h.pageWindow.BiliCDN
    assert.throws(() => { h.pageWindow.BiliCDN = { setCdn() {} } }, TypeError)
    assert.equal(h.pageWindow.BiliCDN, before)
    assert.equal(Object.isFrozen(h.pageWindow.BiliCDN), true)
})

test('CS-001 fixed: menu is closure-backed and catalog selection remains functional', { skip: !fs.existsSync(v141) }, () => {
    const h = loadUserscript(v141, { gmSeed: { disabled: true }, promptResult: '1' })
    const before = h.pageWindow.BiliCDN
    const fake = { reset() { throw new Error('page global hijack') } }
    try { h.pageWindow.BiliCDN = fake } catch {}
    const cdnMenu = h.menus.find(menu => menu.label.includes('控制中心'))
    assert.ok(cdnMenu)
    cdnMenu.callback()
    if (hasTrustedUi) {
        trustedUiAction(h, 'routing')
        trustedUiAction(h, 'route-1')
        trustedUiAction(h, 'confirm')
    }
    assert.equal(h.gm.get('CustomCDN'), h.evaluate('PREFERRED_CDN_LIST_RAW[0]'))
    assert.notEqual(h.pageWindow.BiliCDN, fake)
    assert.equal(Object.values(h.pageWindow.BiliCDN).some(value => typeof value === 'function'), false)
    assert.equal(Object.isFrozen(h.pageWindow.BiliCDN), true)
})

test('CS-001 fixed: auto/invalid menu input and preconnect remain catalog-locked', { skip: !fs.existsSync(v141) }, () => {
    const auto = loadUserscript(v141, {
        gmSeed: { disabled: true, CustomCDN: 'upos-sz-mirroraliov.bilivideo.com' },
        promptResult: '0',
    })
    auto.menus.find(menu => menu.label.includes('控制中心')).callback()
    if (hasTrustedUi) {
        trustedUiAction(auto, 'routing')
        trustedUiAction(auto, 'route-0')
        trustedUiAction(auto, 'confirm')
    }
    assert.equal(auto.gm.has('CustomCDN'), false)

    const invalid = loadUserscript(v141, { gmSeed: { disabled: true }, promptResult: '999' })
    const beforeWrites = invalid.gmWrites.length
    invalid.menus.find(menu => menu.label.includes('控制中心')).callback()
    if (hasTrustedUi) {
        const host = invalid.document.getElementById('bilicdn-trusted-menu-ui')
        const shadow = invalid.getClosedShadowRoot(host)
        shadow.querySelector('[data-ui-action="routing"]').dispatchEvent(new invalid.context.Event('click', { isTrusted: true }))
        shadow.querySelector('[data-ui-action="route-1"]').click()
        shadow.querySelector('[data-ui-action="confirm"]').click()
    }
    assert.equal(invalid.gmWrites.length, beforeWrites)
    assert.equal(invalid.evaluate("replaceUrlHost('https://upos-sz-mirroraliov.bilivideo.com/video.m4s?token=1', 'httpdns.bilivideo.com')"), null)
    invalid.evaluate("preconnectCdn('httpdns.bilivideo.com')")
    invalid.evaluate("noteDiscoveredCdn('page-controlled.bilivideo.com')")
    assert.equal(invalid.document.head.children.length, 0)
})

test('CS-001 fixed: public diagnostics are bounded data without URL/network identifiers', { skip: !fs.existsSync(v141) }, () => {
    const h = loadUserscript(v141, { gmSeed: { disabled: true } })
    const json = JSON.stringify(h.pageWindow.BiliCDN)
    assert.equal(json.includes('userAgent'), false)
    assert.equal(json.includes('networkKey'), false)
    assert.equal(json.includes('cookie'), false)
    assert.equal(json.includes('https://'), false)
    assert.equal(Object.values(h.pageWindow.BiliCDN).some(value => typeof value === 'function'), false)
    assert.ok(json.length < 20_000)
})
