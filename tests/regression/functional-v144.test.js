'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { loadUserscript } = require('../harness/userscript-vm')

const root = path.resolve(__dirname, '../..')
const archive = path.join(root, 'tests', 'fixtures')
const v143 = path.join(archive, 'BiliCDN_TW_1.4.3.user.js')
const v144 = require('../harness/current-script')
const UI_HOST_ID = 'bilicdn-trusted-menu-ui'
const cosov = 'upos-sz-mirrorcosov.bilivideo.com'

const settleTurns = async (count = 5) => {
    for (let i = 0; i < count; i++) await new Promise(resolve => setImmediate(resolve))
}

const menu = (h, text) => {
    const found = h.menus.find(entry => entry.label.includes(text))
    if (found) return found
    // Historical action names are reached through the actual single control-center menu.
    const paths = { '重置': ['maintenance','reset-all'], '顯示診斷': ['diagnostics'],
        '複製診斷': ['diagnostics','copy'], '立即測速': ['reassess'], '手動延遲': ['reassess'],
        '固定 CDN': ['routing'], '切換 catalog': ['routing'], verbose: ['advanced','verbose-toggle'],
        'Worker 使用量': ['advanced','worker-stats'], 'soft block': ['maintenance','clear-soft'],
        '救回單一': ['maintenance','revive-dead'] }
    assert.ok(paths[text], 'unknown historical action')
    return { callback() {
        h.__historicalAction = text
        h.menus[0].callback()
        for (const name of paths[text]) {
            const node = uiRoot(h).querySelector('[data-ui-action="' + name + '"]')
            if (!node && !h.context.crypto) return // secure-randomness refusal is itself asserted
            assert.ok(node, 'missing control-center route: ' + name)
            trusted(h, node)
        }
    } }
}

const uiRoot = h => {
    const host = h.document.getElementById(UI_HOST_ID)
    assert.ok(host, 'trusted UI host should exist')
    assert.equal(host.shadowRoot, null, 'closed shadow root must not be page-readable')
    const shadow = h.getClosedShadowRoot(host)
    assert.ok(shadow, 'test harness should retain the closed root')
    return shadow
}

const action = (h, name) => {
    if (h.__historicalAction === '固定 CDN') name = name.replace('choice-', 'route-')
    if (h.__historicalAction === '切換 catalog') {
        name = name.replace('choice-', 'catalog-')
        if (name === 'secondary') name = 'routing-defaults'
    }
    const found = uiRoot(h).querySelector(`[data-ui-action="${name}"]`)
    assert.ok(found, `missing UI action: ${name}`)
    return found
}

const trusted = (h, element, type = 'click') => element.dispatchEvent(
    new h.context.Event(type, { isTrusted: true })
)

const treeText = node => [node && node.textContent || '', ...(node && node.children || []).map(treeText)].join('\n')

test('v1.4.3 reproduction: new menu commands provide no visible page feedback', () => {
    const h = loadUserscript(v143, { gmSeed: { disabled: true } })
    for (const label of ['verbose', 'Worker 使用量', 'soft block']) menu(h, label).callback()
    assert.equal(h.document.getElementById(UI_HOST_ID), null)
    assert.ok(h.logs.length > 0)
})

test('v1.4.3 reproduction: unavailable prompt leaves selection menus without visible feedback', () => {
    const now = 1_000_000
    const h = loadUserscript(v143, {
        now,
        gmSeed: {
            disabled: true,
            knownDeadHosts_v1: JSON.stringify([{ host: cosov, reason: 'timeout-probe', expireAt: now + 60_000 }]),
        },
        promptResult: null,
    })
    for (const label of ['固定 CDN', '救回單一', '切換 catalog']) menu(h, label).callback()
    assert.equal(h.promptCalls.length, 3)
    assert.equal(h.document.getElementById(UI_HOST_ID), null)
})

test('v1.4.3 reproduction: clipboard rejection is only reported to console', async () => {
    const h = loadUserscript(v143, {
        gmSeed: { disabled: true },
        clipboardImpl: async () => { throw new DOMException('denied', 'NotAllowedError') },
    })
    menu(h, '複製診斷').callback()
    await settleTurns()
    assert.equal(h.document.getElementById(UI_HOST_ID), null)
    assert.ok(h.logs.some(entry => entry.args.some(arg => String(arg).includes('剪貼簿複製失敗'))))
})

test('v1.5.3: every Tampermonkey menu produces a toast or dialog without console', async () => {
    const labels = ['重置', '顯示診斷', '複製診斷', '立即測速', '手動延遲', '固定 CDN',
        'verbose', 'Worker 使用量', 'soft block', '救回單一', '切換 catalog']
    for (const label of labels) {
        const h = loadUserscript(v144, { gmSeed: { disabled: true } })
        menu(h, label).callback()
        await settleTurns()
        const shadow = uiRoot(h)
        const visible = shadow.querySelectorAll('[data-ui-kind="toast"]')
            .concat(shadow.querySelectorAll('[data-ui-kind="dialog"]'))
        assert.ok(visible.length > 0, `${label} should have visible feedback`)
    }
})

test('v1.5.3: untrusted clicks cannot confirm reset and a trusted capability is one-shot', () => {
    const h = loadUserscript(v144, { gmSeed: { disabled: true } })
    menu(h, '重置').callback()
    const confirm = action(h, 'confirm')
    const writesBefore = h.gmWrites.length
    confirm.click()
    assert.equal(h.gmWrites.length, writesBefore)
    trusted(h, confirm)
    const writesAfter = h.gmWrites.length
    assert.ok(writesAfter > writesBefore)
    trusted(h, confirm)
    assert.equal(h.gmWrites.length, writesAfter)
    h.timers.runTimers(1000)
    assert.equal(h.location.reloadCalls, 1)
})

test('v1.5.3: fixed CDN and catalog dialogs map trusted indices to exact catalog hosts', () => {
    const fixedHarness = loadUserscript(v144, { gmSeed: { disabled: true } })
    menu(fixedHarness, '固定 CDN').callback()
    trusted(fixedHarness, action(fixedHarness, 'choice-2'))
    trusted(fixedHarness, action(fixedHarness, 'confirm'))
    assert.equal(fixedHarness.gm.get('CustomCDN'), cosov)

    const catalogHarness = loadUserscript(v144, { gmSeed: { disabled: true } })
    menu(catalogHarness, '切換 catalog').callback()
    trusted(catalogHarness, action(catalogHarness, 'choice-1'))
    trusted(catalogHarness, action(catalogHarness, 'confirm'))
    assert.equal(catalogHarness.gm.get('catalogOverrides_v1')[cosov], true)
    assert.equal(Object.values(catalogHarness.pageWindow.BiliCDN).some(value => typeof value === 'function'), false)
})

test('v1.5.3: clipboard uses GM, navigator, then a manual-copy dialog', async () => {
    const gm = loadUserscript(v144, { gmSeed: { disabled: true } })
    menu(gm, '複製診斷').callback()
    await settleTurns()
    assert.equal(gm.clipboardWrites[0].via, 'gm')
    assert.equal(gm.clipboardWrites.some(entry => entry.via === 'navigator'), false)
    assert.match(treeText(uiRoot(gm)), /已複製/)

    const nav = loadUserscript(v144, {
        gmSeed: { disabled: true },
        gmClipboardImpl: () => { throw new Error('GM denied') },
    })
    menu(nav, '複製診斷').callback()
    await settleTurns()
    assert.deepEqual(nav.clipboardWrites.map(entry => entry.via), ['gm', 'navigator'])
    assert.match(treeText(uiRoot(nav)), /已複製/)

    const manual = loadUserscript(v144, {
        gmSeed: { disabled: true },
        gmClipboardImpl: () => { throw new Error('GM denied') },
        clipboardImpl: async () => { throw new DOMException('denied', 'NotAllowedError') },
    })
    menu(manual, '複製診斷').callback()
    await settleTurns()
    assert.ok(uiRoot(manual).querySelector('[data-ui-action="manual-copy-text"]'))
    assert.match(treeText(uiRoot(manual)), /手動複製/)
})

test('v1.5.3: a missing GM clipboard callback times out into the standard API', async () => {
    const h = loadUserscript(v144, {
        gmSeed: { disabled: true },
        gmClipboardImpl: () => undefined,
    })
    const pending = menu(h, '複製診斷').callback()
    h.timers.runTimers(1500)
    await pending
    await settleTurns()
    assert.match(treeText(uiRoot(h)), /已複製/)
    assert.deepEqual(h.clipboardWrites.map(entry => entry.via), ['gm', 'navigator'])
})

test('v1.5.3: stale dialog actions are invalidated by SPA navigation', () => {
    const h = loadUserscript(v144, { gmSeed: { disabled: false } })
    menu(h, '固定 CDN').callback()
    const confirm = action(h, 'confirm')
    h.pageWindow.history.pushState({}, '', '?p=2')
    h.timers.runTimers(0)
    const writesBefore = h.gmWrites.length
    trusted(h, confirm)
    assert.equal(h.gmWrites.length, writesBefore)
    assert.equal(uiRoot(h).querySelector('[data-ui-kind="dialog"]'), null)
})

test('v1.5.3: missing secure randomness refuses mutating dialogs without GM writes', () => {
    const h = loadUserscript(v144, { gmSeed: { disabled: true }, cryptoImpl: null })
    const writesBefore = h.gmWrites.length
    menu(h, '固定 CDN').callback()
    assert.equal(h.gmWrites.length, writesBefore)
    assert.equal(uiRoot(h).querySelector('[data-ui-kind="dialog"]'), null)
    assert.match(treeText(uiRoot(h)), /安全亂數|無法開啟/)
})

test('v1.5.3: menu feedback itself performs no active network requests', async () => {
    const h = loadUserscript(v144, { gmSeed: { disabled: true } })
    const before = h.fetchCalls.length
    for (const label of ['顯示診斷', '複製診斷', '固定 CDN', 'verbose', 'Worker 使用量',
        'soft block', '救回單一', '切換 catalog']) {
        menu(h, label).callback()
        await settleTurns()
    }
    assert.equal(h.fetchCalls.length, before)
})

test('v1.5.3: reset cancel is inert while verbose and soft-clear report exact state', () => {
    const h = loadUserscript(v144, { gmSeed: { disabled: true } })
    menu(h, '重置').callback()
    const beforeCancel = h.gmWrites.length
    trusted(h, action(h, 'back'))
    assert.equal(h.gmWrites.length, beforeCancel)
    assert.match(treeText(uiRoot(h)), /節點維護/)

    menu(h, 'verbose').callback()
    assert.equal(h.gm.get('verbose'), true)
    assert.match(treeText(uiRoot(h)), /Verbose 已開啟/)

    h.evaluate(`cdnSoftBlockUntil['${cosov}'] = Date.now() + 60000`)
    menu(h, 'soft block').callback()
    assert.equal(h.evaluate(`isCdnSoftBlocked('${cosov}')`), false)
    assert.match(treeText(uiRoot(h)), /已清除 1 個 soft block/)
})

test('v1.5.3: a trusted dead-host revive is exact and catalog defaults can be restored', () => {
    const now = 1_000_000
    const revive = loadUserscript(v144, {
        now,
        gmSeed: {
            disabled: true,
            knownDeadHosts_v1: JSON.stringify([{ host: cosov, reason: 'timeout-probe', expireAt: now + 60_000 }]),
        },
    })
    menu(revive, '救回單一').callback()
    trusted(revive, action(revive, 'choice-0'))
    trusted(revive, action(revive, 'confirm'))
    assert.equal(revive.evaluate(`knownDeadHosts.has('${cosov}')`), false)
    assert.match(treeText(uiRoot(revive)), /已救回/)

    const defaults = loadUserscript(v144, {
        gmSeed: { disabled: true, catalogOverrides_v1: { [cosov]: true } },
    })
    assert.equal(defaults.evaluate(`isCatalogAutoEnabled('${cosov}')`), true)
    menu(defaults, '切換 catalog').callback()
    trusted(defaults, action(defaults, 'secondary'))
    assert.equal(defaults.gm.has('catalogOverrides_v1'), false)
    assert.equal(defaults.evaluate(`isCatalogAutoEnabled('${cosov}')`), false)
})

test('v1.5.3: zero-candidate catalog update and stale disabled dialog cannot mutate state', () => {
    const transform = source => source.replace(
        'const setRuntimeDisabled = (nextDisabled) => {',
        'const setRuntimeDisabled = globalThis.__auditSetRuntimeDisabled = (nextDisabled) => {'
    )
    const h = loadUserscript(v144, { gmSeed: { disabled: false }, sourceTransform: transform })
    const zero = JSON.parse(h.evaluate('JSON.stringify(applyCatalogSelection([]))'))
    assert.equal(zero.ok, false)
    assert.equal(zero.status, 'zero-candidates')

    menu(h, '固定 CDN').callback()
    const confirm = action(h, 'confirm')
    h.context.__auditSetRuntimeDisabled(true)
    const writesBefore = h.gmWrites.length
    trusted(h, confirm)
    assert.equal(h.gmWrites.length, writesBefore)
    assert.equal(uiRoot(h).querySelector('[data-ui-kind="dialog"]'), null)
})

test('v1.5.3: bakeoff and probe return bounded reasons for inactive states', async () => {
    const disabledHarness = loadUserscript(v144, { gmSeed: { disabled: true } })
    const bakeDisabled = await disabledHarness.evaluate('BiliCDNControls.bakeoff()')
    const probeDisabled = await disabledHarness.evaluate('BiliCDNControls.probe()')
    assert.equal(bakeDisabled.status, 'disabled')
    assert.equal(probeDisabled.status, 'disabled')

    const fixed = loadUserscript(v144, { gmSeed: { disabled: false }, customCdn: cosov })
    const bakeFixed = await fixed.evaluate('BiliCDNControls.bakeoff()')
    const probeFixed = await fixed.evaluate('BiliCDNControls.probe()')
    assert.equal(bakeFixed.status, 'fixed-cdn')
    assert.equal(probeFixed.status, 'fixed-cdn')

    const noSample = loadUserscript(v144, { gmSeed: { disabled: false } })
    assert.equal((await noSample.evaluate('BiliCDNControls.bakeoff()')).status, 'no-sample')
})

test('v1.5.3 component regression: diagnostic dialog is bounded and Escape restores its entry focus', () => {
    const h = loadUserscript(v144, { gmSeed: { disabled: true } })
    const prior = h.document.createElement('button')
    h.document.body.appendChild(prior)
    prior.focus()
    h.evaluate('showDiagnosticDialog()')
    const text = action(h, 'manual-copy-text').value
    assert.doesNotMatch(text, /https:\/\/|token=|networkKey|cookie/i)
    assert.ok(text.length < 48 * 1024)
    uiRoot(h).dispatchEvent(new h.context.Event('keydown', { isTrusted: true, key: 'Escape' }))
    assert.equal(uiRoot(h).querySelector('[data-ui-kind="dialog"]'), null)
    assert.equal(h.document.activeElement, prior)
})

test('v1.5.3: replacing an open dialog preserves the original focus target', () => {
    const h = loadUserscript(v144, { gmSeed: { disabled: true } })
    const prior = h.document.createElement('button')
    h.document.body.appendChild(prior)
    prior.focus()
    h.evaluate('showDiagnosticDialog()')
    h.evaluate('showWorkerStatsDialog()')
    uiRoot(h).dispatchEvent(new h.context.Event('keydown', { isTrusted: true, key: 'Escape' }))
    assert.equal(h.document.activeElement, prior)
})

test('v1.5.3: toast queue is bounded and timers remove completed feedback', () => {
    const h = loadUserscript(v144, { gmSeed: { disabled: true } })
    for (let i = 0; i < 5; i++) menu(h, 'verbose').callback()
    assert.equal(uiRoot(h).querySelectorAll('[data-ui-kind="toast"]').length, 3)
    h.timers.runTimers(5000)
    assert.equal(uiRoot(h).querySelectorAll('[data-ui-kind="toast"]').length, 0)
})

test('v1.5.3: player-panel mutators statically require trusted events', () => {
    const source = require('node:fs').readFileSync(v144, 'utf8')
    assert.match(source, /checkBox\.addEventListener\(['"]change['"],[\s\S]{0,180}!event\.isTrusted/)
    assert.doesNotMatch(source, /(?:resetBtn|reportBtn)\.addEventListener/)
})

test('current routing, playback, codec, probe, and bakeoff constants match v1.5.2 except the deliberate Worker default', () => {
    const readConfig = file => {
        const h = loadUserscript(file, { gmSeed: { disabled: true } })
        return JSON.parse(h.evaluate(`JSON.stringify({
            codec: PreferredVideoCodec,
            worker: EnableWorkerIntercept,
            ucb: UCB_EXPLORE_C,
            probeTimeout: PROBE_TIMEOUT_MS,
            confirmTimeout: CONFIRM_TIMEOUT_MS,
            bakeoffBytes: THRPT_PROBE_BYTES,
            bakeoffCooldown: THRPT_BAKEOFF_COOLDOWN,
            catalog: TRUSTED_CDN_CATALOG,
        })`))
    }
    const current = readConfig(v144)
    const previous = readConfig(v143)
    assert.equal(current.worker, true)
    assert.equal(previous.worker, false)
    delete current.worker
    delete previous.worker
    assert.deepEqual(current, previous)
})
