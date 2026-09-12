import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { loadUserscript } = require('../harness/userscript-vm')
const target = require('../harness/current-script')

const host = name => `${name}.bilivideo.com`
const mediaUrl = (cdn, name) => `https://${cdn}/upgcxcode/01/23/${name}.m4s?token=fixture`
const playinfo = (cdn, name, height = 1080) => ({ code: 0, data: { dash: {
    video: [{ id: 80, height, width: height === 1080 ? 1920 : 1280, bandwidth: 4_000_000,
        codecs: 'av01.0.08M.08', base_url: mediaUrl(cdn, name), backup_url: [] }],
    audio: [],
} } })

const initial = () => playinfo(host('upos-sz-mirrorali'), 'first')
const next = () => playinfo(host('upos-sz-mirroralib'), 'next', 720)

const load = (file = target) => loadUserscript(file, {
    now: 1_800_000_000_000,
    instrument: file === target,
    pageGlobals: { __playinfo__: initial() },
    gmSeed: { disabled: false, blicdnVersion: '1.8.4' },
})

test('v184 reproduction: an initially present __playinfo__ is not observed after SPA replacement', async () => {
    const h = load('Release/v1.8.4/BiliCDN_TW.user.js')
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.pageGroups, 1)

    h.pageWindow.history.pushState({}, '', '/video/BVnext')
    await h.timers.advanceAsync(0)
    h.pageWindow.__playinfo__ = next()
    await h.timers.advanceAsync(1000)

    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.pageGroups, 0)
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.waitingReason, 'no-playinfo')
})

test('v185 observes a new __playinfo__ assigned after the SPA reset', async () => {
    const h = load()
    h.pageWindow.history.pushState({}, '', '/video/BVnext')
    await h.timers.advanceAsync(0)
    h.pageWindow.__playinfo__ = next()
    h.evaluate('refreshPublicDiagnosticSnapshot()')

    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.pageGroups, 1)
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.waitingReason, 'awaiting-video-completion')
})

test('v185 preserves a new __playinfo__ assigned synchronously after pushState but before SPA reset', async () => {
    const h = load()
    h.pageWindow.history.pushState({}, '', '/video/BVnext')
    h.pageWindow.__playinfo__ = next()
    await h.timers.advanceAsync(0)
    h.evaluate('refreshPublicDiagnosticSnapshot()')

    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.pageGroups, 1)
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.waitingReason, 'awaiting-video-completion')
})

test('v185 reproduction: a new __playinfo__ assigned before pushState is cleared by the SPA reset', async () => {
    const h = load('Release/v1.8.5/BiliCDN_TW.user.js')
    h.pageWindow.__playinfo__ = next()
    h.pageWindow.history.pushState({}, '', '/video/BVnext')
    await h.timers.advanceAsync(0)

    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.pageGroups, 0)
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.waitingReason, 'no-playinfo')
})

test('v186 carries a same-task pre-history assignment into the new generation', async () => {
    const h = load()
    h.pageWindow.__playinfo__ = next()
    h.pageWindow.history.pushState({}, '', '/video/BVnext')
    await h.timers.advanceAsync(0)
    h.evaluate('refreshPublicDiagnosticSnapshot()')

    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.pageGroups, 1)
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.waitingReason, 'awaiting-video-completion')
    assert.deepEqual(JSON.parse(JSON.stringify(h.pageWindow.BiliCDN.nativeRouting.playinfoLifecycle)), {
        state: 'adopted', timing: 'before-history', applied: true, updatedAt: 1800000000000,
    })
})

test('v186 settles an earlier same-page assignment and never reuses it on a later SPA', async () => {
    const h = load()
    h.pageWindow.__playinfo__ = next()
    await h.timers.advanceAsync(0)
    h.pageWindow.history.pushState({}, '', '/video/BVlater')
    await h.timers.advanceAsync(0)
    h.evaluate('refreshPublicDiagnosticSnapshot()')

    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.pageGroups, 0)
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.waitingReason, 'no-playinfo')
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.playinfoLifecycle.state, 'no-new-assignment')
})

test('v186 only adopts the newest assignment across rapid SPA transitions', async () => {
    const h = load()
    h.pageWindow.__playinfo__ = next()
    h.pageWindow.history.pushState({}, '', '/video/BVmiddle')
    h.pageWindow.__playinfo__ = playinfo(host('upos-tf-all-tx'), 'final', 1080)
    h.pageWindow.history.pushState({}, '', '/video/BVfinal')
    await h.timers.advanceAsync(0)
    h.evaluate('refreshPublicDiagnosticSnapshot()')

    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.pageGroups, 1)
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.playinfoLifecycle.state, 'adopted')
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.playinfoLifecycle.timing, 'before-history')
})

test('v185 does not repopulate an SPA route pool from the previous page value', async () => {
    const h = load()
    h.pageWindow.history.pushState({}, '', '/video/BVnext')
    await h.timers.advanceAsync(0)
    h.evaluate('refreshPublicDiagnosticSnapshot()')

    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.pageGroups, 0)
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.waitingReason, 'no-playinfo')
})

test('v185 state cycle re-arms the hook when the page replaces the configurable data property', async () => {
    const h = load()
    h.pageWindow.history.pushState({}, '', '/video/BVnext')
    await h.timers.advanceAsync(0)
    Object.defineProperty(h.pageWindow, '__playinfo__', {
        value: next(), writable: true, configurable: true,
    })
    await h.timers.advanceAsync(1000)

    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.pageGroups, 1)
    assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.waitingReason, 'awaiting-video-completion')
})
