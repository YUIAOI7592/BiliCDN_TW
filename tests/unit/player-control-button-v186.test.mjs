import test from 'node:test'
import assert from 'node:assert/strict'
import { createPlayerPanel } from '../../src/ui/player-panel.mjs'

class Element {
    constructor(tag = 'div') {
        this.tagName = tag.toUpperCase()
        this.children = []
        this.parentNode = null
        this.style = {}
        this.attributes = {}
        this.listeners = new Map()
        this.id = ''
        this.type = ''
        this.textContent = ''
        this.checked = false
        this.offsetParent = {}
    }
    appendChild(child) { child.parentNode = this; this.children.push(child); return child }
    setAttribute(name, value) { this.attributes[name] = String(value) }
    addEventListener(type, callback) { this.listeners.set(type, callback) }
    dispatchEvent(event) { this.listeners.get(event.type)?.call(this, event) }
    remove() {
        if (!this.parentNode) return
        this.parentNode.children = this.parentNode.children.filter(child => child !== this)
        this.parentNode = null
    }
    querySelector(selector) {
        const match = node => selector.startsWith('#') ? node.id === selector.slice(1)
            : node.tagName === selector.toUpperCase()
        const visit = node => {
            for (const child of node.children) {
                if (match(child)) return child
                const nested = visit(child)
                if (nested) return nested
            }
            return null
        }
        return visit(this)
    }
    querySelectorAll() { return [] }
    closest() { return null }
}

const setup = async (disabled = false) => {
    const body = new Element('body')
    const settings = new Element('section')
    body.appendChild(settings)
    const find = selector => selector === '.bpx-player-ctrl-setting-others' ? settings
        : selector.startsWith('#') ? body.querySelector(selector) : null
    const priorDocument = globalThis.document
    globalThis.document = {
        body,
        createElement: tag => new Element(tag),
        contains: node => node === body || !!node?.parentNode,
        querySelector: find,
        querySelectorAll: selector => selector === '.bpx-player-ctrl-setting-others' ? [settings] : [],
    }
    let opens = 0
    const state = { disabled }
    const panel = createPlayerPanel({
        get uiInjectStatus() { return 'pending' }, set uiInjectStatus(_) {},
        SettingsBarTitle: '攔截修改影片 CDN',
        get disabled() { return state.disabled },
        setRuntimeDisabled(value) { state.disabled = value },
        fromHTML(html) {
            const wrapper = new Element('div')
            if (html.includes('bui-checkbox-input')) wrapper.appendChild(new Element('input'))
            return wrapper
        },
        TrustedMenuUI: { toast() {} },
        openControlCenter() { opens++ },
        Watchdog: { stats: () => ({ readyState: -1, bufferAheadSec: 0 }) },
        describePlaybackBuffer: () => '緩衝：無資料',
        resolvedCdn: '', playbackRateState: { confirmed: true, observedRate: 2 }, ASSUMED_PLAYBACK_RATE: 2,
        cdnSoftBlockUntil: {}, isCdnSoftBlocked: () => false, blacklistSet: new Set(), knownDeadHosts: new Set(),
        getCdnShortName: () => 'upos-sz-mirrorali',
        waitForElm: async () => settings,
        DiagnosticLog: { fault() {} },
    })
    await Promise.resolve()
    return { body, settings, panel, state, get opens() { return opens }, restore() { globalThis.document = priorDocument } }
}

const event = isTrusted => ({ type: 'click', isTrusted, preventDefault() {}, stopPropagation() {} })

test('v186 player settings expose one control-center button while enabled or disabled', async t => {
    for (const disabled of [false, true]) await t.test(disabled ? 'disabled' : 'enabled', async () => {
        const h = await setup(disabled)
        try {
            assert.equal(h.settings.children.filter(node => node.id === 'bilicdn-control-center-button').length, 1)
            assert.equal(h.settings.querySelector('#bilicdn-control-center-button').textContent, '⚙️ 開啟 BiliCDN 控制中心')
        } finally { h.restore() }
    })
})

test('v186 player button opens the internal control center only for a real click', async () => {
    const h = await setup()
    try {
        const button = h.settings.querySelector('#bilicdn-control-center-button')
        button.dispatchEvent(event(false))
        assert.equal(h.opens, 0)
        button.dispatchEvent(event(true))
        assert.equal(h.opens, 1)
    } finally { h.restore() }
})

test('v186 reinjection restores a removed button without duplicating the status panel', async () => {
    const h = await setup()
    try {
        const status = h.settings.querySelector('#bilicdn-status-panel')
        h.settings.querySelector('#bilicdn-control-center-button').remove()
        h.panel.ensureUiPresent()
        assert.equal(h.settings.querySelector('#bilicdn-status-panel'), status)
        assert.equal(h.settings.children.filter(node => node.id === 'bilicdn-control-center-button').length, 1)
    } finally { h.restore() }
})
