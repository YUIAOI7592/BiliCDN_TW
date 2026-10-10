import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { PlayerAdapter } from '../../../src-v2/adapters/player.ts'
import type { PlayerPort } from '../../../src-v2/application/ports.ts'
import { FakeClock } from '../../support/clock.ts'
import { testScope } from '../../support/scope.ts'
import { deferred } from '../../support/deferred.ts'

// Node models the browser dispatch boundary; Chrome separately proves trusted
// BODY Space changes paused during keydown. Native media getters remain intact.
function fixture(t: TestContext) {
  const scope = testScope(t), clock = scope.own(new FakeClock())
  const document = new EventTarget(), window = new EventTarget()
  let visible = true, lifecycle = '1:0'
  class ElementBoundary extends EventTarget {
    parentElement: ElementBoundary | null = null
    tagName = 'DIV'
    role = ''
    id = ''
    isContentEditable = false
    contains(value: unknown): boolean {
      for (let item = value instanceof ElementBoundary ? value : null; item; item = item.parentElement) if (item === this) return true
      return false
    }
    closest(selector: string): ElementBoundary | null {
      for (let item: ElementBoundary | null = this; item; item = item.parentElement) {
        if (selector.includes('.bpx-player-container') && item === region) return item
        if (selector.includes('input') && (['INPUT', 'TEXTAREA', 'SELECT'].includes(item.tagName)
          || item.role === 'textbox' || item.id === 'bilicdn-v2-control-center')) return item
      }
      return null
    }
  }
  class VideoBoundary extends ElementBoundary {
    currentTime = 120
    paused = false
    seeking = false
    ended = false
    readyState = 4
    duration = 3900
    videoWidth = 1920
    videoHeight = 1080
    playbackRate = 1
    error: MediaError | null = null
    buffered = { length: 1, start: (_index: number) => 0, end: (_index: number) => 3000 }
    getVideoPlaybackQuality() { return { totalVideoFrames: 100 } }
  }
  const body = new ElementBoundary(), region = new ElementBoundary(), video = new VideoBoundary()
  body.tagName = 'BODY'; region.parentElement = body; video.parentElement = region
  let currentVideo = video, core: object | null = { state: { initialized: true }, getMpd: () => ({ video: [{}] }) }
  let reloadEffect: () => unknown = () => undefined
  let coreRead: () => void = () => undefined
  class KeyboardBoundary extends Event {
    #dispatching = false
    readonly isComposing: boolean; readonly ctrlKey: boolean; readonly altKey: boolean; readonly metaKey: boolean
    readonly keyCode: number
    constructor(type: string, readonly key: string, private readonly receiver: ElementBoundary,
      private readonly trusted = true, options: { isComposing?: boolean; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean; keyCode?: number } = {}) {
      super(type); this.isComposing = options.isComposing ?? false; this.ctrlKey = options.ctrlKey ?? false
      this.altKey = options.altKey ?? false; this.metaKey = options.metaKey ?? false; this.keyCode = options.keyCode ?? 0
    }
    override get isTrusted(): boolean { return this.trusted }
    override get target(): EventTarget { return this.receiver }
    override get eventPhase(): number { return this.#dispatching ? Event.AT_TARGET : Event.NONE }
    dispatch(): void {
      this.#dispatching = true
      try { document.dispatchEvent(this); window.dispatchEvent(this) }
      finally { this.#dispatching = false }
    }
    async dispatchBetweenListeners(callback: () => void): Promise<void> {
      this.#dispatching = true
      try { document.dispatchEvent(this); await Promise.resolve().then(callback); window.dispatchEvent(this) }
      finally { this.#dispatching = false }
    }
  }
  for (const [name, value] of Object.entries({ document, window, Node: ElementBoundary, Element: ElementBoundary,
    HTMLElement: ElementBoundary, KeyboardEvent: KeyboardBoundary })) scope.defineGlobal(name, { configurable: true, value })
  const site = {
    __core: () => { const observed = core; coreRead(); return observed },
    getCurrentTime: () => currentVideo.currentTime,
    getPlaybackRate: () => currentVideo.playbackRate,
    seek(position: number): void { currentVideo.currentTime = position; currentVideo.seeking = true; currentVideo.dispatchEvent(new Event('seeking')) },
    reload(): unknown { return reloadEffect() },
    play(): void { currentVideo.paused = false },
    setPlaybackRate(rate: number): void { currentVideo.playbackRate = rate },
  }
  let owner = site
  class Player extends PlayerAdapter {
    protected override player() { return owner }
    override video(): HTMLVideoElement { return currentVideo as unknown as HTMLVideoElement }
  }
  const timeoutCallbacks: (() => void)[] = []
  const player = new Player({ lifecycleKey: () => lifecycle, transform: () => ({ accepted: false, formats: [],
    videoCount: 0, audioCount: 0, segmentCount: 0, upstreamCode: 0, reason: null }) }, {
    scheduler: { timeout(callback, delay) { timeoutCallbacks.push(callback); return clock.timeout(callback, delay) } },
    isActuallyVisible: () => visible, subscribeControlLoss: () => () => undefined,
  })
  scope.defer(() => player.reset()); player.controls()
  let effect: (event: KeyboardBoundary) => void = event => {
    if (event.type !== 'keydown') return
    if ([' ', 'k', 'K'].includes(event.key)) currentVideo.paused = !currentVideo.paused
    if (event.key === 'ArrowUp') currentVideo.playbackRate += 0.25
    if (event.key === 'ArrowDown') currentVideo.playbackRate -= 0.25
  }
  const handler: EventListener = event => { if (event instanceof KeyboardBoundary) effect(event) }
  document.addEventListener('keydown', handler); document.addEventListener('keyup', handler)
  scope.defer(() => { document.removeEventListener('keydown', handler); document.removeEventListener('keyup', handler) })
  const port: PlayerPort = player
  return { player, video, site, body, region, clock,
    owned: (revision = player.controls().reloadRevision) => port.ownedReload?.(revision) ?? false,
    onReload: (callback: () => unknown) => { reloadEffect = callback }, clearCore: () => { core = null },
    onCoreRead: (callback: () => void) => { coreRead = callback },
    key: (key = ' ', options: ConstructorParameters<typeof KeyboardBoundary>[4] = {}, trusted = true,
      receiver = body, type = 'keydown') => new KeyboardBoundary(type, key, receiver, trusted, options).dispatch(),
    betweenListeners: (callback: () => void) => new KeyboardBoundary('keydown', ' ', body).dispatchBetweenListeners(callback),
    onKey: (callback: (event: KeyboardBoundary) => void) => { effect = callback },
    replaceVideo: () => { currentVideo = new VideoBoundary(); currentVideo.parentElement = region },
    replacePlayer: () => { owner = { ...site } }, replaceCore: () => { core = { state: { initialized: true } } },
    visible: (value: boolean) => { visible = value }, lifecycle: (value: string) => { lifecycle = value },
    cleanup: (index: number) => timeoutCallbacks[index]?.(),
    listen: (type: string, callback: EventListener) => { document.addEventListener(type, callback); scope.defer(() => document.removeEventListener(type, callback)) },
  }
}

for (const key of [' ', 'k', 'K']) {
  test(`BR-01 reload controls: BODY ${JSON.stringify(key)} actual pause acquires one operation revision`, t => {
    const f = fixture(t), revision = f.player.controls().userRevision
    f.key(key)
    assert.equal(f.video.paused, true)
    assert.equal(f.player.controls().userRevision, revision + 1, 'the new user pause must revoke an owned reload preparation')
  })
}

test('BR-01 reload controls: BODY Space actual resume acquires one operation revision', t => {
  const f = fixture(t); f.video.paused = true
  const revision = f.player.controls().userRevision
  f.key(); assert.equal(f.video.paused, false); assert.equal(f.player.controls().userRevision, revision + 1)
})

for (const key of ['ArrowUp', 'ArrowDown']) {
  test(`BR-01 reload controls: BODY ${key} actual rate change acquires one operation revision`, t => {
    const f = fixture(t), revision = f.player.controls().userRevision
    f.key(key); assert.notEqual(f.video.playbackRate, 1); assert.equal(f.player.controls().userRevision, revision + 1)
  })
}

test('BR-01 reload controls: dispatch controls and bubble observation count a pause once', t => {
  const f = fixture(t), revision = f.player.controls().userRevision
  f.onKey(() => { f.video.paused = true; f.player.controls(); f.player.controls() })
  f.key(); assert.equal(f.player.controls().userRevision, revision + 1)
})

test('BR-01 reload controls: a microtask between listeners can confirm the same live command', async t => {
  const f = fixture(t), revision = f.player.controls().userRevision
  f.onKey(() => undefined)
  await f.betweenListeners(() => { f.video.paused = true; f.player.controls() })
  assert.equal(f.player.controls().userRevision, revision + 1)
})

test('BR-01 reload controls: nested playback command supersedes the outer dispatch', t => {
  const f = fixture(t), revision = f.player.controls().userRevision
  f.onKey(event => { if (event.key === ' ') f.key('k'); else { f.video.paused = true; f.player.controls() } })
  f.key(); assert.equal(f.player.controls().userRevision, revision + 1)
})

test('BR-01 reload controls: a stale cleanup cannot consume the current playback candidate', t => {
  const f = fixture(t), revision = f.player.controls().userRevision
  f.onKey(() => undefined); f.key()
  f.onKey(() => { f.cleanup(0); f.video.paused = true; f.player.controls() })
  f.key(); assert.equal(f.player.controls().userRevision, revision + 1)
})

test('BR-01 reload controls: an ignored BODY command does not invent a user operation', t => {
  const f = fixture(t), revision = f.player.controls().userRevision
  f.onKey(() => undefined); f.key(); assert.equal(f.player.controls().userRevision, revision)
})

test('BR-01 reload controls: synthetic playback command does not acquire ownership', t => {
  const f = fixture(t), revision = f.player.controls().userRevision
  f.key(' ', {}, false); assert.equal(f.video.paused, true); assert.equal(f.player.controls().userRevision, revision)
})

for (const exclusion of ['input', 'editable', 'control-center', 'ime', 'ctrl', 'alt', 'meta', 'hidden'] as const) {
  test(`BR-01 reload controls: ${exclusion} excludes a BODY playback command`, t => {
    const f = fixture(t), revision = f.player.controls().userRevision
    if (exclusion === 'input') f.body.tagName = 'INPUT'
    if (exclusion === 'editable') f.body.isContentEditable = true
    if (exclusion === 'control-center') f.body.id = 'bilicdn-v2-control-center'
    if (exclusion === 'hidden') f.visible(false)
    const options = exclusion === 'ime' ? { isComposing: true } : exclusion === 'ctrl' ? { ctrlKey: true }
      : exclusion === 'alt' ? { altKey: true } : exclusion === 'meta' ? { metaKey: true } : {}
    f.key(' ', options); assert.equal(f.player.controls().userRevision, revision)
  })
}

test('BR-01 reload controls: late paused change after dispatch cannot reuse the candidate', async t => {
  const f = fixture(t), revision = f.player.controls().userRevision
  f.onKey(() => undefined); f.key()
  await Promise.resolve().then(() => { f.video.paused = true; f.player.controls() })
  assert.equal(f.player.controls().userRevision, revision)
})

test('BR-01 reload controls: keyup does not attribute a new playback command', t => {
  const f = fixture(t), revision = f.player.controls().userRevision
  f.onKey(() => { f.video.paused = true }); f.key(' ', {}, true, f.body, 'keyup')
  assert.equal(f.player.controls().userRevision, revision)
})

for (const change of ['media', 'player', 'core', 'lifecycle'] as const) {
  test(`BR-01 reload controls: ${change} replacement prevents stale pause attribution`, t => {
    const f = fixture(t), revision = f.player.controls().userRevision
    f.onKey(() => {
      if (change === 'media') f.replaceVideo()
      if (change === 'player') f.replacePlayer()
      if (change === 'core') f.replaceCore()
      if (change === 'lifecycle') f.lifecycle('1:1')
      f.video.paused = true
    })
    f.key(); assert.equal(f.player.controls().userRevision, revision)
  })
}

for (const operation of ['play', 'setRate', 'seek'] as const) {
  test(`BR-01 reload controls: internal ${operation} cannot consume a trusted playback candidate`, t => {
    const f = fixture(t), revision = f.player.controls().userRevision
    f.video.paused = true
    f.onKey(() => { if (operation === 'play') f.player.play(); else if (operation === 'setRate') f.player.setRate(2); else f.player.seek(0) })
    f.key(); assert.equal(f.player.controls().userRevision, revision)
  })
}

test('BR-01 reload controls: existing in-player non-seek observation remains one revision', t => {
  const f = fixture(t), revision = f.player.controls().userRevision
  f.onKey(() => undefined); f.key(' ', {}, true, f.video)
  assert.equal(f.player.controls().userRevision, revision + 1)
})

test('BR-01 reload controls: owned reload keeps proof across paused same-media null-core preparation', t => {
  const f = fixture(t), before = f.player.controls()
  f.onReload(() => { f.video.paused = true; f.clearCore() })
  f.player.reload()
  const next = f.player.controls()
  assert.equal(next.mediaId, before.mediaId); assert.equal(next.coreId, 0)
  assert.equal(next.reloadRevision, before.reloadRevision + 1)
  assert.equal(f.owned(), true, 'only this marked reload preparation may retain the bounded intent')
})

test('BR-01 reload controls: first owned core replacement is marked and proof survives non-user SDK seek', t => {
  const f = fixture(t)
  f.onReload(() => { f.video.paused = true; f.clearCore() }); f.player.reload(); f.player.controls()
  f.replaceCore(); const marked = f.player.controls()
  assert.equal(marked.coreReloadRevision, marked.reloadRevision)
  f.video.currentTime = 119; f.video.seeking = true; f.video.dispatchEvent(new Event('seeking'))
  assert.ok(f.player.controls().seekRevision > marked.seekRevision)
  assert.equal(f.owned(), true, 'uncertain SDK seek invalidates old restoration without inventing a new user command')
})

test('BR-01 reload controls: owned reload proof expires at 15000 ms without extending on SDK seek', t => {
  const f = fixture(t); f.player.reload(); const revision = f.player.controls().reloadRevision
  f.clock.advance(14999); f.video.currentTime = 119; f.video.seeking = true; f.player.controls()
  assert.equal(f.owned(revision), true)
  f.clock.advance(1); assert.equal(f.owned(revision), false)
})

for (const invalidation of ['second-core', 'external-reload', 'media', 'player', 'lifecycle', 'hidden', 'user-pause', 'reset'] as const) {
  test(`BR-01 reload controls: ${invalidation} permanently revokes owned reload proof`, t => {
    const f = fixture(t); f.player.reload(); const revision = f.player.controls().reloadRevision
    f.replaceCore(); f.player.controls()
    if (invalidation === 'second-core') f.replaceCore()
    if (invalidation === 'external-reload') f.site.reload()
    if (invalidation === 'media') f.replaceVideo()
    if (invalidation === 'player') f.replacePlayer()
    if (invalidation === 'lifecycle') f.lifecycle('1:1')
    if (invalidation === 'hidden') f.visible(false)
    if (invalidation === 'user-pause') f.key()
    if (invalidation === 'reset') f.player.reset()
    assert.equal(f.owned(revision), false)
    f.visible(true); assert.equal(f.owned(revision), false)
  })
}

test('BR-01 reload controls: rejected reload preserves result identity and revokes only its own proof', async t => {
  const f = fixture(t), pending = deferred<void>()
  f.onReload(() => pending.promise); assert.equal(f.player.reload(), pending.promise)
  const revision = f.player.controls().reloadRevision
  assert.equal(f.owned(revision), true)
  pending.reject(new Error('controlled SDK reload rejection')); await Promise.resolve(); await Promise.resolve()
  assert.equal(f.owned(revision), false)
})

test('BR-01 reload controls: a late older rejection cannot revoke a newer owned reload', async t => {
  const f = fixture(t), old = deferred<void>()
  void old.promise.catch(() => undefined)
  f.onReload(() => old.promise); f.player.reload()
  f.onReload(() => undefined); f.player.reload(); const revision = f.player.controls().reloadRevision
  old.reject(new Error('old SDK reload rejection')); await Promise.resolve(); await Promise.resolve()
  assert.equal(f.owned(revision), true)
})

test('BR-01 reload controls: SDK accessor methods retain descriptors and external reload revokes proof', t => {
  const f = fixture(t); f.player.reset()
  let reload = f.site.reload
  const original = reload
  Object.defineProperty(f.site, 'reload', { configurable: true, enumerable: false, get: () => reload,
    set: (value: typeof reload) => { reload = value } })
  const descriptor = Object.getOwnPropertyDescriptor(f.site, 'reload')
  f.player.controls(); f.player.reload(); assert.equal(f.owned(), true)
  f.site.reload(); assert.equal(f.owned(), false)
  f.player.reset()
  assert.deepEqual(Object.getOwnPropertyDescriptor(f.site, 'reload'), descriptor)
  assert.equal(f.site.reload, original)
})

test('BR-01 reload controls: reset removes its inherited-method shadow and reveals the current prototype', t => {
  const f = fixture(t); f.player.reset()
  const prototype = { reload: f.site.reload }
  Reflect.deleteProperty(f.site, 'reload'); Object.setPrototypeOf(f.site, prototype)
  f.player.controls(); assert.equal(Object.hasOwn(f.site, 'reload'), true)
  const newer = () => 'current SDK method'; prototype.reload = newer
  f.player.reset(); assert.equal(Object.hasOwn(f.site, 'reload'), false); assert.equal(f.site.reload, newer)
})

test('BR-01 reload controls: a newer descriptor owner is preserved even when it retains the observed method', t => {
  const f = fixture(t), observed = f.site.reload
  Object.defineProperty(f.site, 'reload', { configurable: true, enumerable: false, writable: true, value: observed })
  const newer = Object.getOwnPropertyDescriptor(f.site, 'reload')
  f.player.reset(); assert.deepEqual(Object.getOwnPropertyDescriptor(f.site, 'reload'), newer)
})

test('BR-01 reload controls: inspecting a returned thenable cannot replace the original method return', async t => {
  const f = fixture(t), result = { get then(): never { throw new Error('then getter rejected') } }
  f.onReload(() => result)
  assert.equal(f.player.reload(), result)
  await Promise.resolve(); await Promise.resolve()
  assert.equal(f.owned(), false)
})

test('BR-01 reload controls: a reentrant SDK method lookup cannot reload after a new user command', t => {
  const f = fixture(t); let calls = 0, reads = 0
  f.onReload(() => { calls++ })
  let original = f.site.reload
  Object.defineProperty(f.site, 'reload', { configurable: true, get: () => {
    reads++; f.key(); return original
  }, set: (value: typeof original) => { original = value } })
  assert.throws(() => f.player.reload(), /ownership ended/)
  assert.equal(reads, 1, 'method lookup is not repeated')
  assert.equal(calls, 0, 'a newly observed user operation revokes the preparation before the SDK side effect')
})

test('BR-01 reload controls: an old core query cannot mark or clear a reentrantly installed reload owner', t => {
  const f = fixture(t); f.player.reload(); const older = f.player.controls().reloadRevision
  f.onCoreRead(() => { f.onCoreRead(() => undefined); f.replaceCore(); f.player.reload() })
  assert.equal(f.owned(older), false)
  const newer = f.player.controls().reloadRevision
  assert.equal(newer, older + 1); assert.equal(f.owned(newer), true)
})

test('BR-01 reload controls: an old controls read cannot consume a newer reload preparation', t => {
  const f = fixture(t); f.player.reload(); const older = f.player.controls().reloadRevision
  f.onCoreRead(() => { f.onCoreRead(() => undefined); f.replaceCore(); f.player.reload() })
  f.player.controls()
  const newer = f.player.controls().reloadRevision
  assert.equal(newer, older + 1); assert.equal(f.owned(newer), true)
})
