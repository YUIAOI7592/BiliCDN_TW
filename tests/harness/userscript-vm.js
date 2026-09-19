'use strict'

const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { MessageChannel: NodeMessageChannel } = require('node:worker_threads')
const { webcrypto } = require('node:crypto')

class FakeEventTarget {
    constructor() { this._listeners = new Map() }
    addEventListener(type, listener, options) {
        if (typeof listener !== 'function') return
        const list = this._listeners.get(type) || []
        list.push({ listener, once: !!(options && options.once) })
        this._listeners.set(type, list)
    }
    removeEventListener(type, listener) {
        const list = this._listeners.get(type) || []
        this._listeners.set(type, list.filter(entry => entry.listener !== listener))
    }
    dispatchEvent(event) {
        if (!event || !event.type) return true
        if (!event.target) {
            try { Object.defineProperty(event, 'target', { value: this, configurable: true }) } catch {}
        }
        const list = [...(this._listeners.get(event.type) || [])]
        for (const entry of list) {
            entry.listener.call(this, event)
            if (entry.once) this.removeEventListener(event.type, entry.listener)
            if (event.__stopImmediate) break
        }
        const handler = this['on' + event.type]
        if (!event.__stopImmediate && typeof handler === 'function') handler.call(this, event)
        return !event.defaultPrevented
    }
}

class FakeEvent {
    constructor(type, init = {}) {
        this.type = type
        this.defaultPrevented = false
        this.isTrusted = !!init.isTrusted
        this.key = init.key || ''
        this.shiftKey = !!init.shiftKey
    }
    preventDefault() { this.defaultPrevented = true }
    stopPropagation() { this.__stopPropagation = true }
    stopImmediatePropagation() { this.__stopImmediate = true }
    get data() { return this._data }
    set data(value) { this._data = value }
}

class FakeProgressEvent extends FakeEvent {
    constructor(type, init = {}) { super(type, init); this.loaded = Number(init.loaded) || 0 }
}

class FakeMessageEvent extends FakeEvent {
    constructor(type, init = {}) {
        super(type, init)
        this.data = init.data
        this.ports = init.ports || []
    }
    get data() { return this._data }
    set data(value) { this._data = value }
}

class FakeElement extends FakeEventTarget {
    constructor(tagName = 'div', ownerDocument = null) {
        super()
        this.tagName = String(tagName).toUpperCase()
        this.ownerDocument = ownerDocument
        this.children = []
        this.style = {}
        this.dataset = {}
        this.attributes = {}
        this.parentNode = null
        this.shadowRoot = null
        this.id = ''
        this.className = ''
        this.innerHTML = ''
        this.textContent = ''
        this.value = ''
        this.type = ''
        this.name = ''
        this.checked = false
        this.disabled = false
        this.tabIndex = -1
        this.offsetParent = {}
    }
    appendChild(child) { child.parentNode = this; this.children.push(child); return child }
    append(...children) { children.forEach(child => this.appendChild(child)); }
    replaceChildren(...children) {
        this.children.forEach(child => { child.parentNode = null })
        this.children = []
        this.append(...children)
    }
    remove() {
        if (!this.parentNode) return
        this.parentNode.children = this.parentNode.children.filter(child => child !== this)
        this.parentNode = null
    }
    setAttribute(name, value) { this.attributes[name] = String(value) }
    getAttribute(name) { return this.attributes[name] }
    removeAttribute(name) { delete this.attributes[name] }
    attachShadow({ mode } = {}) {
        const root = new FakeShadowRoot(this, mode || 'open', this.ownerDocument)
        if (root.mode === 'open') this.shadowRoot = root
        else if (this.ownerDocument) this.ownerDocument._closedShadowRoots.set(this, root)
        return root
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null }
    querySelectorAll(selector) {
        const out = []
        const matches = node => {
            if (!node || typeof selector !== 'string') return false
            if (selector.startsWith('#')) return node.id === selector.slice(1)
            const data = selector.match(/^\[data-([a-z0-9-]+)="([^"]*)"\]$/i)
            if (data) {
                const key = data[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase())
                return String(node.dataset && node.dataset[key]) === data[2]
            }
            return node.tagName === selector.toUpperCase()
        }
        const visit = node => {
            for (const child of node.children || []) {
                if (matches(child)) out.push(child)
                visit(child)
            }
        }
        visit(this)
        return out
    }
    closest() { return null }
    focus() {
        if (!this.ownerDocument) return
        let parent = this.parentNode
        while (parent && !(parent instanceof FakeShadowRoot)) parent = parent.parentNode
        if (parent) parent.activeElement = this
        this.ownerDocument.activeElement = this
    }
    select() { this.selected = true }
    click() { this.dispatchEvent(new FakeEvent('click', { isTrusted: false })) }
}

class FakeShadowRoot extends FakeElement {
    constructor(host, mode, ownerDocument) {
        super('#shadow-root', ownerDocument)
        this.host = host
        this.mode = mode
    }
}

class FakeDocument extends FakeEventTarget {
    constructor() {
        super()
        this._closedShadowRoots = new WeakMap()
        this.readyState = 'loading'
        this._hidden = false
        this._visibilityState = 'visible'
        this.activeElement = null
        this.head = new FakeElement('head', this)
        this.body = new FakeElement('body', this)
        this.documentElement = new FakeElement('html', this)
    }
    get hidden() { return this._hidden }
    set hidden(value) { this._hidden = !!value }
    get visibilityState() { return this._visibilityState }
    set visibilityState(value) { this._visibilityState = String(value) }
    createElement(tag) {
        const el = new FakeElement(tag, this)
        if (tag === 'template') el.content = { firstElementChild: new FakeElement('div', this) }
        return el
    }
    querySelector() { return null }
    querySelectorAll() { return [] }
    getElementById(id) {
        const visit = node => {
            if (!node) return null
            if (node.id === id) return node
            for (const child of node.children || []) {
                const found = visit(child)
                if (found) return found
            }
            return null
        }
        return visit(this.head) || visit(this.body) || visit(this.documentElement)
    }
    contains(target) {
        const visit = node => !!node && (node === target || (node.children || []).some(visit))
        return visit(this.head) || visit(this.body) || visit(this.documentElement)
    }
    getClosedShadowRoot(host) { return this._closedShadowRoots.get(host) || null }
}

const xhrBrands = new WeakSet()
class FakeXMLHttpRequest extends FakeEventTarget {
    static DONE = 4
    constructor() {
        super()
        xhrBrands.add(this)
        this.url = ''
        this.method = ''
        this.DONE = FakeXMLHttpRequest.DONE
        this._readyState = 0
        this._status = 0
        this._statusText = ''
        this._responseURL = ''
        this.responseType = ''
        this._responseText = ''
        this._response = null
        this._headers = new Map()
    }
    open(method, url) {
        if (!xhrBrands.has(this)) throw new TypeError('Illegal invocation')
        delete this.sent
        this.method = method
        this.url = String(url)
        this._responseURL = this.url
        this._readyState = 1
    }
    send() {
        if (this.sent && this._readyState !== FakeXMLHttpRequest.DONE) throw new Error('InvalidStateError')
        this.sent = true
    }
    emitNativeEvent(event) { return this.dispatchEvent(event) }
    abort() {
        delete this.sent
        this.aborted = true
        this.dispatchEvent(new FakeProgressEvent('abort', { isTrusted: true }))
    }
    setRequestHeader(name, value) { this._headers.set(String(name).toLowerCase(), String(value)) }
    getResponseHeader(name) { return this._headers.get(String(name).toLowerCase()) || null }
    getAllResponseHeaders() {
        return [...this._headers.entries()].map(([name, value]) => `${name}: ${value}\r\n`).join('')
    }
    get responseText() { return this._responseText }
    get response() { return this._response }
    get readyState() { return this._readyState }
    get status() { return this._status }
    get statusText() { return this._statusText }
    get responseURL() { return this._responseURL }
    respond({ status = 200, statusText = '', responseText = '', response = null, responseURL } = {}) {
        delete this.sent
        this._status = status
        this._statusText = statusText
        this._responseText = responseText
        this._response = response
        this._responseURL = responseURL || this.url
        this._readyState = FakeXMLHttpRequest.DONE
        this.dispatchEvent(new FakeEvent('readystatechange', { isTrusted: true }))
        this.dispatchEvent(new FakeEvent('load', { isTrusted: true }))
        this.dispatchEvent(new FakeEvent('loadend', { isTrusted: true }))
    }
    fail() {
        this.dispatchEvent(new FakeProgressEvent('error', { isTrusted: true }))
        this.dispatchEvent(new FakeProgressEvent('loadend', { isTrusted: true }))
    }
    progress(loaded) { this.dispatchEvent(new FakeProgressEvent('progress', { loaded, isTrusted: true })) }
}

class FakeMutationObserver { constructor(callback) { this.callback = callback } observe() {} disconnect() {} }
class FakePerformanceObserver { constructor(callback) { this.callback = callback } observe() {} disconnect() {} }

const createTimerHarness = (clock = null) => {
    let nextId = 1
    const timers = new Map()
    const set = (kind, fn, delay, args) => {
        const id = nextId++
        const ms = Math.max(0, Number(delay) || 0)
        timers.set(id, { kind, fn, delay: ms, args, dueAt: (clock ? clock.now : 0) + ms })
        return id
    }
    return {
        timers,
        setTimeout: (fn, delay, ...args) => set('timeout', fn, delay, args),
        clearTimeout: id => timers.delete(id),
        setInterval: (fn, delay, ...args) => set('interval', fn, delay, args),
        clearInterval: id => timers.delete(id),
        runTimers(maxDelay = Infinity) {
            const ready = [...timers.entries()].filter(([, timer]) => timer.delay <= maxDelay)
            for (const [id, timer] of ready) {
                if (!timers.has(id)) continue
                if (timer.kind === 'timeout') timers.delete(id)
                else if (clock) timer.dueAt = clock.now + Math.max(1, timer.delay)
                timer.fn(...timer.args)
            }
        },
        // Opt-in deterministic scheduling. Legacy runTimers callers keep their API.
        async advanceAsync(ms) {
            if (!clock) throw new Error('Scheduled time requires a clock')
            const target = clock.now + Math.max(0, Number(ms) || 0)
            const flush = () => new Promise(resolve => setImmediate(resolve))
            await flush()
            let callbacks = 0
            for (;;) {
                const next = [...timers.entries()]
                    .filter(([, timer]) => timer.dueAt <= target)
                    .sort((a, b) => a[1].dueAt - b[1].dueAt || a[0] - b[0])[0]
                if (!next) {
                    clock.set(Math.max(clock.now, target))
                    await flush()
                    if (![...timers.values()].some(timer => timer.dueAt <= target)) return
                    continue
                }
                if (++callbacks > 100000) throw new Error('Runaway scheduled timer')
                const [id, timer] = next
                clock.set(Math.max(clock.now, timer.dueAt))
                if (timer.kind === 'timeout') timers.delete(id)
                else timer.dueAt = clock.now + Math.max(1, timer.delay)
                timer.fn(...timer.args)
                await flush()
            }
        },
    }
}

class HarnessBlob {
    constructor(parts, options = {}) { this.parts = parts; this.type = options.type || ''; this.size = parts.reduce((n, p) => n + String(p).length, 0) }
    text() { return Promise.resolve(this.parts.map(String).join('')) }
}

const makeTestURL = blobStore => class TestURL extends URL {
    static createObjectURL(blob) {
        const url = 'blob:https://www.bilibili.com/test-' + (blobStore.size + 1)
        blobStore.set(url, blob)
        return url
    }
    static revokeObjectURL(url) { blobStore.delete(url) }
}

const makeConsole = logs => {
    const out = {}
    for (const name of ['log', 'warn', 'error', 'group', 'groupEnd', 'info']) {
        out[name] = (...args) => { logs.push({ name, args }) }
    }
    return out
}

const buildContext = ({
    gmSeed = {}, fetchImpl, promptResult = null, cryptoImpl = webcrypto,
    clipboardImpl = null, gmClipboardImpl = null,
    mediaCapabilities = null, mediaSourceSupport = null, now = Date.now(),
    gmContext = null, locks = null, pageGlobals = {}, initialUrl = 'https://www.bilibili.com/video/BV1test',
    messageChannelImpl = undefined, blobImpl = undefined,
} = {}) => {
    const gm = gmContext && gmContext.gm instanceof Map ? gmContext.gm : new Map()
    Object.entries(gmSeed).forEach(([key, value]) => { if (!gm.has(key)) gm.set(key, value) })
    const gmReads = gmContext && Array.isArray(gmContext.gmReads) ? gmContext.gmReads : []
    const gmWrites = gmContext && Array.isArray(gmContext.gmWrites) ? gmContext.gmWrites : []
    const menus = []
    const logs = []
    const promptCalls = []
    const clipboardWrites = []
    const fetchCalls = []
    const preconnects = []
    const workerInstances = []
    const performanceObservers = []
    const blobStore = new Map()
    let messageChannelCount = 0
    let broadcastChannelCount = 0
    const HarnessMessageChannel = function MessageChannel() {
        messageChannelCount++
        return new NodeMessageChannel()
    }
    const clock = {
        now: Number.isFinite(Number(now)) ? Number(now) : Date.now(),
        advance(ms) { this.now += Number(ms) || 0; return this.now },
        set(value) { this.now = Number(value); return this.now },
    }
    const timerHarness = createTimerHarness(clock)
    class HarnessDate extends Date {
        constructor(...args) { super(...(args.length ? args : [clock.now])) }
        static now() { return clock.now }
    }
    const document = new FakeDocument()
    const initial = new URL(initialUrl)
    const location = {
        href: initial.href,
        origin: initial.origin,
        pathname: initial.pathname,
        search: initial.search,
        reloadCalls: 0,
        reload() { this.reloadCalls++ },
    }
    const applyHistoryUrl = value => {
        if (value == null || value === '') return
        const next = new URL(String(value), location.href)
        location.href = next.href
        location.origin = next.origin
        location.pathname = next.pathname
        location.search = next.search
    }
    const eventBus = new FakeEventTarget()
    const pageWindow = new FakeEventTarget()
    const TestURL = makeTestURL(blobStore)
    const HarnessMediaSource = mediaSourceSupport === null ? null : class MediaSource {
        static isTypeSupported(mime) {
            return typeof mediaSourceSupport === 'function'
                ? !!mediaSourceSupport(String(mime))
                : !!mediaSourceSupport
        }
    }
    class HarnessPerformanceObserver extends FakePerformanceObserver {
        constructor(callback) {
            super(callback)
            performanceObservers.push(this)
        }
    }

    const baseFetch = async (input, init) => {
        const url = input instanceof Request ? input.url : String(input)
        fetchCalls.push({ url, input, init })
        if (fetchImpl) return fetchImpl(input, init)
        return new Response(new Uint8Array([1, 2, 3, 4]), { status: 206, headers: { 'content-length': '4' } })
    }

    class FakeWorker extends FakeEventTarget {
        constructor(scriptURL, options) {
            super()
            this.scriptURL = String(scriptURL)
            this.options = options
            this.messages = []
            this.terminated = false
            workerInstances.push(this)
        }
        postMessage(data, transfer = []) { this.messages.push({ data, transfer }) }
        terminate() { this.terminated = true }
    }

    Object.assign(pageWindow, {
        fetch: baseFetch,
        XMLHttpRequest: FakeXMLHttpRequest,
        Worker: FakeWorker,
        ...(HarnessMediaSource ? { MediaSource: HarnessMediaSource } : {}),
        document,
        location,
        history: {
            pushState(state, title, url) { applyHistoryUrl(url) },
            replaceState(state, title, url) { applyHistoryUrl(url) },
        },
        addEventListener: pageWindow.addEventListener.bind(pageWindow),
        removeEventListener: pageWindow.removeEventListener.bind(pageWindow),
        dispatchEvent: pageWindow.dispatchEvent.bind(pageWindow),
        ...pageGlobals,
    })

    const context = {
        console: makeConsole(logs),
        unsafeWindow: pageWindow,
        document,
        location,
        navigator: {
            language: 'zh-TW', languages: ['zh-TW'], userAgent: 'BiliCDN-VM-Test',
            mediaCapabilities, locks, clipboard: {
                writeText: async text => {
                    clipboardWrites.push({ via: 'navigator', text: String(text) })
                    if (clipboardImpl) return clipboardImpl(String(text))
                },
            },
        },
        performance: { now: () => clock.now, getEntriesByType: () => [] },
        Date: HarnessDate,
        crypto: cryptoImpl,
        URL: TestURL,
        URLSearchParams,
        Headers,
        Request,
        Response,
        ReadableStream,
        AbortController,
        DOMException,
        Event: FakeEvent,
        MessageEvent: typeof MessageEvent === 'function' ? MessageEvent : FakeMessageEvent,
        ProgressEvent: FakeProgressEvent,
        EventTarget: FakeEventTarget,
        Document: FakeDocument,
        Element: FakeElement,
        HTMLElement: FakeElement,
        Node: FakeElement,
        MutationObserver: FakeMutationObserver,
        PerformanceObserver: HarnessPerformanceObserver,
        BroadcastChannel: class extends FakeEventTarget {
            constructor(...args) { super(...args); broadcastChannelCount++ }
            postMessage() {}
            close() {}
        },
        MessageChannel: messageChannelImpl === undefined ? HarnessMessageChannel : messageChannelImpl,
        Blob: blobImpl === undefined ? HarnessBlob : blobImpl,
        TextEncoder,
        TextDecoder,
        structuredClone,
        GM_info: { script: { version: '1.4.0' } },
        GM_getValue(key, fallback) { gmReads.push({ key }); return gm.has(key) ? gm.get(key) : fallback },
        GM_setValue(key, value) { gmWrites.push({ op: 'set', key, value }); gm.set(key, value) },
        GM_deleteValue(key) { gmWrites.push({ op: 'delete', key }); gm.delete(key) },
        GM_registerMenuCommand(label, callback) { menus.push({ label, callback }); return menus.length },
        GM_setClipboard(data, info, callback) {
            clipboardWrites.push({ via: 'gm', text: String(data), info })
            if (gmClipboardImpl) return gmClipboardImpl(String(data), info, callback)
            if (typeof callback === 'function') callback()
        },
        prompt(...args) { promptCalls.push(args); return promptResult },
        fetch: baseFetch,
        XMLHttpRequest: FakeXMLHttpRequest,
        Worker: FakeWorker,
        ...(HarnessMediaSource ? { MediaSource: HarnessMediaSource } : {}),
        ...timerHarness,
    }
    context.window = context
    context.self = context
    context.globalThis = context
    context.addEventListener = eventBus.addEventListener.bind(eventBus)
    context.removeEventListener = eventBus.removeEventListener.bind(eventBus)
    context.dispatchEvent = eventBus.dispatchEvent.bind(eventBus)

    return {
        context,
        pageWindow,
        document,
        location,
        gm,
        gmReads,
        gmWrites,
        menus,
        logs,
        promptCalls,
        clipboardWrites,
        fetchCalls,
        preconnects,
        workerInstances,
        performanceObservers,
        blobStore,
        get broadcastChannelCount() { return broadcastChannelCount },
        emitPerformanceEntries(entries) {
            const list = { getEntries: () => Array.from(entries || []) }
            performanceObservers.forEach(observer => observer.callback(list))
        },
        getClosedShadowRoot: host => document.getClosedShadowRoot(host),
        getMessageChannelCount: () => messageChannelCount,
        timers: timerHarness,
        clock,
    }
}

const loadUserscript = (scriptPath, options = {}) => {
    const absolute = path.resolve(scriptPath)
    let source = fs.readFileSync(absolute, 'utf8')
    const modular = source.includes('function createSettings(')
    if (modular && options.instrument !== false) {
        const built = fs.readFileSync(path.resolve(__dirname, '../../dist/BiliCDN_TW.user.js'), 'utf8')
        if (source !== built) throw new Error('Instrumented target does not match the current production build')
        if (typeof options.sourceTransform === 'function') {
            const { execFileSync } = require('node:child_process')
            source = execFileSync(process.execPath, [path.resolve(__dirname, '../../scripts/build-test-case.mjs')], {
                input: options.sourceTransform.toString(), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
                cwd: path.resolve(__dirname, '../..'),
            })
        } else {
            source = fs.readFileSync(path.resolve(__dirname, '../../dist/BiliCDN_TW.test.user.js'), 'utf8')
        }
    }
    if (typeof options.enableWorkerIntercept === 'boolean') {
        source = source.replace(
            /var EnableWorkerIntercept = (?:true|false)/,
            `var EnableWorkerIntercept = ${options.enableWorkerIntercept}`,
        )
    }
    if (Object.prototype.hasOwnProperty.call(options, 'customCdn')) {
        source = source.replace("var CustomCDN = ''", `var CustomCDN = ${JSON.stringify(options.customCdn)}`)
    }
    if (Object.prototype.hasOwnProperty.call(options, 'preferredVideoCodec')) {
        source = source.replace(/var PreferredVideoCodec = '[^']+'/, `var PreferredVideoCodec = ${JSON.stringify(options.preferredVideoCodec)}`)
    }
    if (typeof options.sourceTransform === 'function' && !(modular && options.instrument !== false)) {
        source = String(options.sourceTransform(source))
    }
    const harness = buildContext(options)
    const metadataVersion = source.match(/^\/\/\s*@version\s+([^\s]+)$/m)
    if (metadataVersion) harness.context.GM_info.script.version = metadataVersion[1]
    vm.createContext(harness.context)
    vm.runInContext(source, harness.context, { filename: absolute })
    harness.evaluate = expression => vm.runInContext(expression, harness.context)
    harness.source = source
    return harness
}

const runGeneratedClassicWorker = (source, { fetchImpl, onImport } = {}) => {
    // 每個生成 Worker 使用獨立的 MessageEvent prototype，讓 prototype-poisoning
    // 安全測試不會在 Node 平行執行其他測試檔時互相污染。
    class HarnessWorkerMessageEvent extends FakeMessageEvent {
        get data() { return super.data }
        set data(value) { super.data = value }
    }
    const self = new FakeEventTarget()
    const fetchCalls = []
    const imports = []
    const timerHarness = createTimerHarness()
    const baseFetch = async (input, init) => {
        const url = input instanceof Request ? input.url : String(input)
        fetchCalls.push({ url, input, init })
        if (fetchImpl) return fetchImpl(input, init)
        return new Response(new Uint8Array([1, 2, 3, 4]), {
            status: 206,
            headers: { 'content-length': '4' },
        })
    }
    self.self = self
    self.fetch = baseFetch
    self.XMLHttpRequest = FakeXMLHttpRequest
    self.importScripts = (...urls) => {
        imports.push(...urls.map(String))
        if (typeof onImport === 'function') onImport(self, urls)
    }
    self.addEventListener = self.addEventListener.bind(self)
    self.removeEventListener = self.removeEventListener.bind(self)
    self.dispatchEvent = self.dispatchEvent.bind(self)

    const context = {
        self,
        console: makeConsole([]),
        URL,
        Headers,
        Request,
        Response,
        ReadableStream,
        Event: FakeEvent,
        MessageEvent: HarnessWorkerMessageEvent,
        ProgressEvent: FakeProgressEvent,
        XMLHttpRequest: FakeXMLHttpRequest,
        ...timerHarness,
    }
    context.globalThis = context
    vm.createContext(context)
    vm.runInContext(String(source), context, { filename: 'generated-classic-worker.js' })

    return {
        context,
        self,
        fetchCalls,
        imports,
        timers: timerHarness,
        dispatchMessage(data, ports = []) {
            const event = new HarnessWorkerMessageEvent('message', { data, ports })
            self.dispatchEvent(event)
            return event
        },
    }
}

module.exports = {
    FakeEvent,
    FakeProgressEvent,
    FakeXMLHttpRequest,
    loadUserscript,
    runGeneratedClassicWorker,
}
