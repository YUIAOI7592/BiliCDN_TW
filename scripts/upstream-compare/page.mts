import { Script, createContext } from 'node:vm'
import { PageClock } from './model.mts'
import type { Observation, Cleanup, Rate } from './model.mts'

type Listener = (event: PageEvent) => void
export class PageEvent {
  static NONE = 0
  static CAPTURING_PHASE = 1
  static AT_TARGET = 2
  static BUBBLING_PHASE = 3
  readonly isTrusted: boolean
  eventPhase = 0
  target: PageNode | null = null
  currentTarget: PageNode | null = null
  defaultPrevented = false
  stopped = false
  immediate = false
  key = ''
  keyCode = 0
  isComposing = false
  ctrlKey = false
  metaKey = false
  altKey = false
  pointerId = 1
  button = 0
  detail: unknown
  #path: PageNode[] = []
  readonly type: string
  constructor(type: string, options: { trusted?: boolean; key?: string; detail?: unknown } = {}) {
    this.type = type
    this.isTrusted = options.trusted ?? false
    this.key = options.key ?? ''
    this.detail = options.detail
  }
  preventDefault(): void {
    this.defaultPrevented = true
  }
  stopPropagation(): void {
    this.stopped = true
  }
  stopImmediatePropagation(): void {
    this.immediate = true
    this.stopped = true
  }
  composedPath(): PageNode[] {
    return this.#path.slice()
  }
  path(path: PageNode[]): void {
    this.#path = path
  }
}
interface Binding {
  callback: Listener
  capture: boolean
  once: boolean
}
export class PageNode {
  readonly bindings = new Map<string, Binding[]>()
  parentElement: PageNode | null = null
  readonly children: PageNode[] = []
  readonly style: Record<string, string> = {}
  readonly dataset: Record<string, string> = {}
  readonly attributes = new Map<string, string>()
  readonly classList = {
    contains: (name: string) => this.className.split(' ').includes(name),
    add: (...names: string[]) => {
      this.className += ' ' + names.join(' ')
    },
  }
  className = ''
  id = ''
  rel = ''
  href = ''
  textContent = ''
  innerHTML = ''
  isContentEditable = false
  isConnected = true
  clientWidth = 1280
  clientHeight = 720
  readonly tagName: string
  readonly nodes: Set<PageNode> | undefined
  constructor(tagName = 'DIV', nodes?: Set<PageNode>) {
    this.tagName = tagName
    this.nodes = nodes
    nodes?.add(this)
  }
  addEventListener(
    type: string,
    callback: Listener,
    options: boolean | { capture?: boolean; once?: boolean } = false,
  ): void {
    if (typeof callback !== 'function') throw Error('Unmodelled event listener object')
    const capture = typeof options === 'boolean' ? options : !!options.capture
    const rows = this.bindings.get(type) ?? []
    if (!rows.some((e) => e.callback === callback && e.capture === capture))
      rows.push({ callback, capture, once: typeof options === 'object' && !!options.once })
    this.bindings.set(type, rows)
  }
  removeEventListener(
    type: string,
    callback: Listener,
    options: boolean | { capture?: boolean } = false,
  ): void {
    const capture = typeof options === 'boolean' ? options : !!options.capture
    this.bindings.set(
      type,
      (this.bindings.get(type) ?? []).filter(
        (e) => e.callback !== callback || e.capture !== capture,
      ),
    )
  }
  dispatchEvent(event: PageEvent): boolean {
    const path: PageNode[] = []
    for (let p: PageNode | null = this; p; p = p.parentElement) path.push(p)
    event.target = this
    event.path(path)
    const invoke = (node: PageNode, capture: boolean, phase: number): void => {
      event.currentTarget = node
      event.eventPhase = phase
      for (const binding of [...(node.bindings.get(event.type) ?? [])]) {
        if (binding.capture !== capture || !(node.bindings.get(event.type) ?? []).includes(binding))
          continue
        if (binding.once) node.removeEventListener(event.type, binding.callback, capture)
        binding.callback.call(node, event)
        if (event.immediate) break
      }
    }
    try {
      for (const node of path.slice().reverse()) {
        invoke(node, true, node === this ? 2 : 1)
        if (event.stopped) return !event.defaultPrevented
      }
      for (const node of path) {
        invoke(node, false, node === this ? 2 : 3)
        if (event.stopped) break
      }
      return !event.defaultPrevented
    } finally {
      event.eventPhase = 0
      event.currentTarget = null
    }
  }
  contains(target: unknown): boolean {
    for (let p = target instanceof PageNode ? target : null; p; p = p.parentElement)
      if (p === this) return true
    return false
  }
  matches(selector: string): boolean {
    return selector.split(',').some((raw) => {
      const s = raw.trim()
      if (s === '*') return true
      if (s.startsWith('.')) return this.className.split(' ').includes(s.slice(1))
      if (s.startsWith('#')) return this.id === s.slice(1)
      if (s.startsWith('[class*="bpx-player"')) return this.className.includes('bpx-player')
      if (s.startsWith('[id*="bilibili-player"')) return this.id.includes('bilibili-player')
      return s.toUpperCase() === this.tagName
    })
  }
  closest(selector: string): PageNode | null {
    for (let p: PageNode | null = this; p; p = p.parentElement) if (p.matches(selector)) return p
    return null
  }
  querySelectorAll(selector: string): PageNode[] {
    return this.children.flatMap((child) => [
      ...(child.matches(selector) ? [child] : []),
      ...child.querySelectorAll(selector),
    ])
  }
  querySelector(selector: string): PageNode | null {
    return this.querySelectorAll(selector)[0] ?? null
  }
  append(...nodes: PageNode[]): void {
    for (const n of nodes) {
      n.parentElement = this
      this.children.push(n)
    }
  }
  appendChild(node: PageNode): PageNode {
    this.append(node)
    return node
  }
  remove(): void {
    this.isConnected = false
    if (this.parentElement)
      this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1)
    this.parentElement = null
  }
  setAttribute(key: string, value: string): void {
    this.attributes.set(key, value)
    if (key === 'class') this.className = value
  }
  getAttribute(key: string): string | null {
    return this.attributes.get(key) ?? null
  }
  getRootNode(): PageNode {
    let p: PageNode = this
    while (p.parentElement) p = p.parentElement
    return p
  }
  getBoundingClientRect() {
    return {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: this.clientWidth,
      bottom: this.clientHeight,
      width: this.clientWidth,
      height: this.clientHeight,
    }
  }
}

export class ComparisonPage {
  readonly clock = new PageClock()
  readonly observations: Observation[] = []
  readonly nodes = new Set<PageNode>()
  readonly subscriptions = new Set<number>()
  readonly memory = new Map<string, unknown>()
  readonly requests = new Map<number, () => void>()
  readonly invalid: string[] = []
  readonly window: PageNode & Record<string, unknown>
  readonly document: PageNode & Record<string, unknown>
  readonly region: PageNode
  readonly button: PageNode
  readonly video: PageNode & {
    currentTime: number
    playbackRate: number
    paused: boolean
    seeking: boolean
    ended: boolean
    readyState: number
    duration: number
    videoWidth: number
    videoHeight: number
    error: null
    frames: number
    buffer: number
    buffered: { length: number; start: () => number; end: () => number }
    getVideoPlaybackQuality: () => { totalVideoFrames: number; droppedVideoFrames: number }
  }
  readonly player: Record<string, unknown> & {
    seek: (value: number) => void
    play: () => Promise<void>
    pause: () => void
    setPlaybackRate: (value: number) => void
    reload: () => Promise<void>
  }
  readonly context: ReturnType<typeof createContext>
  #origin: Observation['origin'] = 'product'
  #expectedInput: string | null = null
  #serial = 0
  #sequence = 0
  #closed = false
  #cleanup: Cleanup | null = null
  #nativeFetch: typeof globalThis.fetch
  #nativeOpen: unknown
  #observers = new Set<{
    active: boolean
    callback: (list: { getEntries: () => unknown[] }) => void
  }>()
  heldUntil = 0
  latencyMs = 20
  reloadMode = false
  core: unknown
  readonly rate: Rate
  readonly hosts: readonly string[]
  constructor(rate: Rate, hosts: readonly string[]) {
    this.rate = rate
    this.hosts = hosts
    const page = this
    class Document extends PageNode {
      get hidden() {
        return false
      }
      get visibilityState() {
        return 'visible'
      }
    }
    const win = new PageNode('WINDOW', this.nodes) as typeof this.window
    const doc = new Document('DOCUMENT', this.nodes) as unknown as typeof this.document
    const head = new PageNode('HEAD', this.nodes),
      body = new PageNode('BODY', this.nodes)
    const region = new PageNode('DIV', this.nodes),
      button = new PageNode('BUTTON', this.nodes)
    region.className = 'bpx-player-container'
    button.className = 'bpx-player-ctrl-play'
    this.window = win
    this.document = doc
    this.region = region
    this.button = button
    win.append(doc)
    doc.append(head, body)
    body.append(region)
    region.append(button)
    this.video = Object.assign(new PageNode('VIDEO', this.nodes), {
      currentTime: 120,
      playbackRate: rate,
      paused: false,
      seeking: false,
      ended: false,
      readyState: 4,
      duration: 3600,
      videoWidth: 1280,
      videoHeight: 720,
      error: null,
      frames: 100,
      buffer: 40 * rate,
      buffered: {
        length: 1,
        start: () => 0,
        end: () => page.video.currentTime + page.video.buffer,
      },
      getVideoPlaybackQuality: () => ({
        totalVideoFrames: page.video.frames,
        droppedVideoFrames: 0,
      }),
    })
    region.append(this.video)
    const appendHead = head.appendChild.bind(head)
    head.appendChild = (node) => {
      if (node.tagName === 'LINK') page.record('connection-hint', node.rel)
      return appendHead(node)
    }
    Object.assign(doc, {
      head,
      body,
      documentElement: body,
      readyState: 'complete',
      activeElement: body,
      createElement: (tag: string) => {
        const node = new PageNode(tag.toUpperCase(), page.nodes)
        return node
      },
      getElementById: (id: string) => doc.querySelector('#' + id),
      hasFocus: () => true,
    })
    this.core = this.makeCore()
    this.player = {
      __core: () => this.core,
      getCurrentTime: () => this.video.currentTime,
      getPlaybackRate: () => this.video.playbackRate,
      getDuration: () => this.video.duration,
      isPaused: () => this.video.paused,
      seek(value: number) {
        page.record('seek', value)
        page.video.currentTime = value
        page.video.seeking = true
        page.video.dispatchEvent(new PageEvent('seeking'))
      },
      setPlaybackRate(value: number) {
        page.record('setRate', value)
        page.video.playbackRate = value
        page.video.dispatchEvent(new PageEvent('ratechange'))
      },
      play() {
        page.record('play')
        page.video.paused = false
        page.video.dispatchEvent(new PageEvent('play'))
        return Promise.resolve()
      },
      pause() {
        page.record('pause')
        page.video.paused = true
        page.video.dispatchEvent(new PageEvent('pause'))
      },
      reload() {
        page.record('reload')
        if (page.reloadMode) {
          page.core = null
          page.video.paused = true
          page.clock.set(() => {
            page.core = page.makeCore()
            page.input(() => page.record('sdk-initialization-input'))
            page.siteCall('seek', () => page.player.seek(0))
            page.clock.set(() => {
              page.video.readyState = 4
              page.video.videoWidth = 1280
              page.video.videoHeight = 720
              page.video.seeking = false
              page.video.dispatchEvent(new PageEvent('seeked'))
            }, 100)
          }, 100)
        }
        return Promise.resolve()
      },
    }
    class Xhr extends PageNode {
      static UNSENT = 0
      static OPENED = 1
      static HEADERS_RECEIVED = 2
      static LOADING = 3
      static DONE = 4
      #readyState = 0
      get readyState(): number {
        return this.#readyState
      }
      status = 0
      statusText = ''
      responseType = ''
      responseURL = ''
      timeout = 0
      withCredentials = false
      onreadystatechange: Listener | null = null
      onload: Listener | null = null
      #url = ''
      #response: unknown = ''
      #abort: AbortController | null = null
      constructor() {
        super('XHR', page.nodes)
      }
      get response(): unknown {
        return this.#response
      }
      get responseText(): string {
        return String(this.#response)
      }
      open(_method: string, url: string): void {
        this.#url = String(url)
        this.#readyState = 1
        this.#emit('readystatechange')
      }
      setRequestHeader(_name: string, _value: string): void {
        /* fixtures do not send custom XHR headers */
      }
      getAllResponseHeaders(): string {
        return 'content-type: application/octet-stream\r\ncontent-length: 65536\r\n'
      }
      getResponseHeader(name: string): string | null {
        return name.toLowerCase() === 'content-length' ? '65536' : null
      }
      send(): void {
        this.#abort = new AbortController()
        void page
          .fetch(this.#url, { signal: this.#abort.signal })
          .then(async (response) => {
            this.status = response.status
            this.responseURL = response.url
            this.#response =
              this.responseType === 'arraybuffer'
                ? await response.arrayBuffer()
                : await response.text()
            this.#readyState = 4
            this.#emit('readystatechange')
            this.#emit('load')
            this.#emit('loadend')
          })
          .catch(() => {
            this.#emit('abort')
            this.#emit('loadend')
          })
      }
      abort(): void {
        this.#abort?.abort()
        this.#readyState = 0
      }
      #emit(type: string): void {
        const event = new PageEvent(type)
        this.dispatchEvent(event)
        if (type === 'readystatechange') this.onreadystatechange?.call(this, event)
        if (type === 'load') this.onload?.call(this, event)
      }
    }
    class Observer {
      #entry: { active: boolean; callback: (list: { getEntries: () => unknown[] }) => void }
      constructor(callback: (list: { getEntries: () => unknown[] }) => void) {
        this.#entry = { active: false, callback }
      }
      observe(): void {
        this.#entry.active = true
        page.#observers.add(this.#entry)
      }
      disconnect(): void {
        this.#entry.active = false
        page.#observers.delete(this.#entry)
      }
    }
    const nativeFetch = this.fetch.bind(this)
    this.#nativeFetch = nativeFetch
    this.#nativeOpen = Xhr.prototype.open
    const menu = new Map<string, unknown>()
    const dateOrigin = this.clock.start
    class VirtualDate extends Date {
      constructor(value?: string | number) {
        super(value ?? page.clock.now())
      }
      static override now(): number {
        return page.clock.now()
      }
    }
    Object.assign(win, {
      window: win,
      self: win,
      top: win,
      unsafeWindow: win,
      document: doc,
      location: {
        href: 'https://www.bilibili.com/video/BV1tFZZBQE57',
        origin: 'https://www.bilibili.com',
        pathname: '/video/BV1tFZZBQE57',
        search: '',
        hostname: 'www.bilibili.com',
      },
      history: { pushState() {}, replaceState() {} },
      player: this.player,
      console: Object.fromEntries(
        [
          'log',
          'warn',
          'error',
          'info',
          'debug',
          'table',
          'group',
          'groupEnd',
          'groupCollapsed',
        ].map((key) => [key, () => undefined]),
      ),
      Date: VirtualDate,
      performance: {
        now: () => page.clock.now() - dateOrigin,
        getEntriesByType: () => [],
        clearResourceTimings() {},
      },
      navigator: {
        userAgent: 'BiliCDN offline comparison',
        language: 'zh-TW',
        hardwareConcurrency: 4,
        userActivation: { isActive: false },
        locks: {
          request: async (
            _name: string,
            options: unknown,
            callback?: (lock: object) => unknown,
          ) => {
            const task =
              typeof options === 'function' ? (options as (lock: object) => unknown) : callback
            if (!task) throw Error('Invalid model lock callback')
            return await task({})
          },
        },
        mediaCapabilities: {
          decodingInfo: async () => ({ supported: true, smooth: true, powerEfficient: true }),
        },
      },
      setTimeout: (run: () => void, ms = 0) => page.clock.set(run, Number(ms)),
      setInterval: (run: () => void, ms = 0) => page.clock.set(run, Number(ms), true),
      clearTimeout: page.clock.clear,
      clearInterval: page.clock.clear,
      queueMicrotask: page.clock.microtask,
      requestAnimationFrame: (run: (at: number) => void) =>
        page.clock.set(() => run(page.clock.relative()), 16),
      cancelAnimationFrame: page.clock.clear,
      fetch: nativeFetch,
      XMLHttpRequest: Xhr,
      Request,
      Response,
      Headers,
      URL,
      URLSearchParams,
      AbortController,
      AbortSignal,
      TextDecoder,
      TextEncoder,
      Blob,
      ReadableStream,
      Uint8Array,
      ArrayBuffer,
      structuredClone,
      DOMException,
      FormData,
      crypto: {
        randomUUID: () => '00000000-0000-4000-8000-000000000001',
        getRandomValues: (bytes: Uint8Array) => {
          for (let i = 0; i < bytes.length; i++) bytes[i] = (i + page.#serial++) % 256
          return bytes
        },
      },
      Event: PageEvent,
      KeyboardEvent: PageEvent,
      PointerEvent: PageEvent,
      CustomEvent: PageEvent,
      ProgressEvent: PageEvent,
      Element: PageNode,
      HTMLElement: PageNode,
      HTMLVideoElement: PageNode,
      HTMLMediaElement: PageNode,
      Document,
      Node: PageNode,
      PerformanceObserver: Observer,
      MutationObserver: class {
        observe() {}
        disconnect() {}
      },
      GM_info: { script: { version: 'offline' }, scriptHandler: 'model' },
      GM_getValue: (key: string, fallback: unknown) =>
        page.memory.has(key) ? structuredClone(page.memory.get(key)) : fallback,
      GM_setValue: (key: string, value: unknown) => {
        page.memory.set(key, structuredClone(value))
        page.record('storage-write', key)
      },
      GM_deleteValue: (key: string) => {
        page.memory.delete(key)
        page.record('storage-delete', key)
      },
      GM_registerMenuCommand: (name: string, callback: unknown) => menu.set(name, callback),
      GM_addValueChangeListener: () => {
        const id = ++page.#serial
        page.subscriptions.add(id)
        return id
      },
      GM_removeValueChangeListener: (id: number) => page.subscriptions.delete(id),
      addEventListener: win.addEventListener.bind(win),
      removeEventListener: win.removeEventListener.bind(win),
      dispatchEvent: win.dispatchEvent.bind(win),
    })
    this.context = createContext(win, { codeGeneration: { strings: true, wasm: false } })
  }
  record(
    kind: string,
    value?: Observation['value'],
    media?: Observation['media'],
    host?: string,
    origin = this.#origin,
  ): void {
    if (this.#closed) {
      this.invalid.push('callback-after-page-close')
      return
    }
    if (['seek', 'reload', 'play', 'setRate', 'pause'].includes(kind)) {
      origin = this.#expectedInput === kind ? 'input' : 'product'
      if (this.#expectedInput === kind) this.#expectedInput = null
    }
    this.observations.push({
      seq: ++this.#sequence,
      at: this.clock.relative(),
      origin,
      kind,
      ...(value === undefined ? {} : { value }),
      ...(media ? { media } : {}),
      ...(host ? { host } : {}),
    })
  }
  input(run: () => void): void {
    const origin = this.#origin
    this.#origin = 'input'
    try {
      run()
    } finally {
      this.#origin = origin
    }
  }
  siteCall(kind: string, run: () => void): void {
    if (this.#expectedInput) throw Error('Nested unconsumed website command')
    this.#expectedInput = kind
    try {
      run()
    } finally {
      this.#expectedInput = null
    }
  }
  load(source: string, version: string): void {
    const info = this.window.GM_info as { script: { version: string } }
    info.script.version = version
    new Script(source, { filename: `immutable-${version}.user.js` }).runInContext(this.context, {
      timeout: 1000,
    })
    this.record('script-loaded', version, undefined, undefined, 'platform')
  }
  hooksInstalled(): boolean {
    const xhr = this.window.XMLHttpRequest as { prototype: { open: unknown } }
    return this.window.fetch !== this.#nativeFetch && xhr.prototype.open !== this.#nativeOpen
  }
  makeCore(): object {
    return { state: { initialized: true }, getMpd: () => this.manifest() }
  }
  invalidateCore(): void {
    const core = this.core as { state: { initialized: boolean } }
    core.state.initialized = false
    this.video.videoWidth = 0
    this.video.videoHeight = 0
  }
  manifest(): object {
    const item = (audio: boolean) => ({
      id: audio ? 30280 : 80,
      codecid: audio ? 0 : 7,
      codecs: audio ? 'mp4a.40.2' : 'avc1.640028',
      bandwidth: audio ? 64000 : 128000,
      width: audio ? 0 : 1280,
      height: audio ? 0 : 720,
      base_url: this.mediaUrl(audio ? 'audio' : 'video'),
      backup_url: [this.mediaUrl(audio ? 'audio' : 'video', this.hosts[1])],
      mime_type: audio ? 'audio/mp4' : 'video/mp4',
    })
    return { duration: 3600, video: [item(false)], audio: [item(true)] }
  }
  mediaUrl(media: 'video' | 'audio', host = this.hosts[0]): string {
    return `https://${host}/upgcxcode/01/02/100001/100001-1-${media === 'video' ? '30080' : '30280'}.m4s`
  }
  async fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    const request = new Request(input, init),
      url = new URL(request.url)
    const media = url.pathname.includes('30080')
      ? 'video'
      : url.pathname.includes('30280')
        ? 'audio'
        : 'other'
    const role = request.headers.get('x-comparison-role') === 'website' ? 'website' : 'probe'
    this.record('dispatch', role, media, url.hostname, 'platform')
    if (
      !this.hosts.includes(url.hostname) &&
      url.hostname !== 'api.bilibili.com' &&
      !url.pathname.endsWith('crossdomain.xml')
    ) {
      // Other built-in probe candidates get deterministic fixture replies too; never network.
      if (!url.hostname.endsWith('.bilivideo.com')) {
        this.invalid.push('unmodelled-network-destination')
        throw Error('Unmodelled fixture destination')
      }
    }
    return await new Promise<Response>((resolve, reject) => {
      const id = ++this.#serial
      let timer = 0,
        done = false
      const finish = (): boolean => {
        if (done) return false
        done = true
        this.requests.delete(id)
        this.clock.clear(timer)
        request.signal.removeEventListener('abort', abort)
        return true
      }
      const abort = (): void => {
        if (!finish()) return
        this.record('abort', role, media, url.hostname, 'platform')
        reject(request.signal.reason ?? new Error('Page request cancelled'))
      }
      this.requests.set(id, abort)
      request.signal.addEventListener('abort', abort, { once: true })
      const delay =
        media === 'video' && role === 'website'
          ? Math.max(this.latencyMs, this.heldUntil - this.clock.relative())
          : 20
      timer = this.clock.set(
        () => {
          if (!finish()) return
          const api = url.hostname === 'api.bilibili.com'
          const body = api
            ? JSON.stringify({ code: 0, data: { dash: this.manifest() } })
            : new Uint8Array(65536)
          const response = new Response(body, {
            status: api ? 200 : 206,
            headers: {
              'content-type': api ? 'application/json' : 'application/octet-stream',
              'content-length': String(
                typeof body === 'string' ? Buffer.byteLength(body) : body.byteLength,
              ),
              'content-range': 'bytes 0-65535/1048576',
              'accept-ranges': 'bytes',
            },
          })
          Object.defineProperty(response, 'url', { value: request.url })
          this.record('complete', role, media, url.hostname, 'platform')
          const entry = {
            name: request.url,
            transferSize: 65536,
            encodedBodySize: 65536,
            decodedBodySize: 65536,
            duration: delay,
            responseStart: this.clock.relative() - delay + 1,
            responseEnd: this.clock.relative() + 1,
            initiatorType: 'fetch',
          }
          for (const observer of this.#observers)
            if (observer.active) observer.callback({ getEntries: () => [entry] })
          resolve(response)
        },
        Math.max(0, delay),
      )
      if (request.signal.aborted) abort()
    })
  }
  keyboard(key: string, action: () => void): void {
    const body = this.document.body as PageNode
    const listener = (): void =>
      this.siteCall(key === 'k' ? 'pause' : key === 'ArrowUp' ? 'setRate' : 'seek', action)
    // Website's default action runs after document capture, before document bubble.
    body.addEventListener('keydown', listener, { once: true })
    this.input(() => this.record('trusted-key-model', key))
    body.dispatchEvent(new PageEvent('keydown', { trusted: true, key }))
  }
  counts() {
    return {
      timers: this.clock.pendingCount,
      listeners: [...this.nodes].reduce(
        (sum, n) => sum + [...n.bindings.values()].reduce((s, list) => s + list.length, 0),
        0,
      ),
      requests: this.requests.size,
      subscriptions: this.subscriptions.size + this.#observers.size,
    }
  }
  async close(): Promise<Cleanup> {
    if (this.#cleanup) return this.#cleanup
    const before = this.counts()
    // Page-lifetime timers/listeners/subscriptions are declared environment-owned.
    // Network work must already have completed before page destruction.
    const unclassified = before.requests
    for (const stop of [...this.requests.values()]) stop()
    await this.clock.advance(0)
    for (const node of this.nodes) node.bindings.clear()
    this.subscriptions.clear()
    this.#observers.clear()
    this.clock.close()
    const after = this.counts()
    this.#closed = true
    this.clock.dispose()
    return (this.#cleanup = {
      before,
      after,
      unclassified,
      callbacksAfterClose: this.clock.callbacksAfterClose,
    })
  }
}
