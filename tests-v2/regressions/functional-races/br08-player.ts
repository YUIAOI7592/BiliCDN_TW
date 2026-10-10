import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { PlayerAdapter } from '../../../src-v2/adapters/player.ts'
import { VisibilityAdapter } from '../../../src-v2/adapters/visibility.ts'
import { FakeClock } from '../../support/clock.ts'
import { testScope } from '../../support/scope.ts'

// This model searches ancestors only, as DOM closest() does. Real trusted
// pointer dispatch and native hidden/blur are recorded separately in Chrome.
class Target extends EventTarget {
  readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject | null>>()
  override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void {
    super.addEventListener(type, listener, options)
    const entries = this.listeners.get(type) ?? new Set(); entries.add(listener); this.listeners.set(type, entries)
  }
  override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void {
    super.removeEventListener(type, listener, options); this.listeners.get(type)?.delete(listener)
  }
  count(): number { return [...this.listeners.values()].reduce((total, entries) => total + entries.size, 0) }
}

function fixture(t: TestContext) {
  const scope = testScope(t), clock = scope.own(new FakeClock()), window = new Target()
  let hidden = false, lifecycle = '1:0', notificationCount = 0
  let visibilityRead: () => void = () => undefined
  class Document extends Target {
    get hidden(): boolean { return hidden }
    get visibilityState(): DocumentVisibilityState { return hidden ? 'hidden' : 'visible' }
  }
  const document = new Document()
  class Element extends Target {
    currentTime = 0
    seeking = false
    parentElement: Element | null = null
    readonly classes = new Set<string>()
    role = ''
    onClosest: (() => void) | null = null
    onContains: (() => void) | null = null
    constructor(className = '', parent: Element | null = null) {
      super(); if (className) this.classes.add(className); this.parentElement = parent
    }
    contains(target: unknown): boolean {
      this.onContains?.()
      for (let current = target instanceof Element ? target : null; current; current = current.parentElement) if (current === this) return true
      return false
    }
    closest(selector: string): Element | null {
      this.onClosest?.()
      const selectors = selector.split(',').map(value => value.trim())
      for (let current: Element | null = this; current; current = current.parentElement) {
        if (selectors.some(value => value.startsWith('.') ? current!.classes.has(value.slice(1)) : value === '[role="slider"]' && current!.role === 'slider')) return current
      }
      return null
    }
  }
  class Pointer extends Event {
    constructor(type: string, readonly pointerId: number, private readonly receiver: Element, private readonly trusted = true) { super(type) }
    override get target(): EventTarget { return this.receiver }
    override get isTrusted(): boolean { return this.trusted }
  }
  class ControlEvent extends Event {
    constructor(type: string, private readonly trusted = true) { super(type) }
    override get isTrusted(): boolean { return this.trusted }
  }
  const body = new Element(), region = new Element('bpx-player-container', body), video = new Element('', region)
  const wrapper = new Element('bpx-player-progress-wrap', region), inner = new Element('bpx-player-progress', wrapper)
  const child = new Element('', wrapper), outside = new Element('', body), nonProgress = new Element('', region)
  let currentVideo = video, owner = { __core: () => core, seek() {}, reload() {} }, core: object = {}
  for (const [name, value] of Object.entries({ document, window, Document, Node: Element, Element, HTMLElement: Element, PointerEvent: Pointer }))
    scope.defineGlobal(name, { configurable: true, value })
  const visibility = scope.own(new VisibilityAdapter()); visibility.install()
  const subscribeControlLoss = (listener: () => void): (() => void) =>
    visibility.subscribeControlLoss(() => { notificationCount++; listener() })
  class Player extends PlayerAdapter {
    protected override player() { return owner }
    override video(): HTMLVideoElement { return currentVideo as unknown as HTMLVideoElement }
  }
  const environment = { scheduler: clock, isActuallyVisible: () => { visibilityRead(); return visibility.isActuallyVisible() }, subscribeControlLoss }
  const player = new Player({ lifecycleKey: () => lifecycle, transform: () => ({ accepted: true, formats: [],
    videoCount: 0, audioCount: 0, segmentCount: 0, upstreamCode: 0, reason: null }) }, environment)
  scope.defer(() => player.reset()); player.controls()
  return { player, visibility, document, window, video, region, wrapper, inner, child, nonProgress, outside, body,
    subscribeControlLoss, notificationCount: () => notificationCount,
    pointer: (type: string, target = wrapper, pointerId = 1, trusted = true) => document.dispatchEvent(new Pointer(type, pointerId, target, trusted)),
    blur: (trusted = true) => window.dispatchEvent(new ControlEvent('blur', trusted)),
    hidden: (value: boolean) => { hidden = value },
    visibilityEvent: (type = 'visibilitychange', trusted = true) => document.dispatchEvent(new ControlEvent(type, trusted)),
    onVisibility: (callback: () => void) => { visibilityRead = callback },
    lifecycle: (value: string) => { lifecycle = value },
    replaceVideo: () => { currentVideo = new Element('', region) }, replacePlayer: () => { owner = { ...owner } },
    listen: (target: Target, type: string, listener: EventListener) => { target.addEventListener(type, listener); scope.defer(() => target.removeEventListener(type, listener)) } }
}

for (const hit of ['wrapper', 'child', 'inner'] as const) {
  test(`BR-08 ${hit} progress hit protects an uncommitted preview immediately`, t => {
    const f = fixture(t), before = f.player.controls().userRevision
    f.pointer('pointerdown', f[hit])
    assert.equal(f.video.seeking, false); assert.equal(f.video.currentTime, 0)
    assert.equal(f.player.controls().dragging, true)
    assert.equal(f.player.controls().userRevision, before + 1, 'pointerdown keeps exactly one existing user revision')
  })
}

for (const selector of ['bilibili-player-video-progress', 'slider']) {
  test(`BR-08 existing ${selector} hit remains a valid drag`, t => {
    const f = fixture(t)
    if (selector === 'slider') f.nonProgress.role = 'slider'; else f.nonProgress.classes.add(selector)
    f.pointer('pointerdown', f.nonProgress); assert.equal(f.player.controls().dragging, true)
  })
}

test('BR-08 an outside slider ancestor cannot grant dragging to an inside nonprogress target', t => {
  const f = fixture(t); f.body.role = 'slider'
  f.pointer('pointerdown', f.nonProgress); assert.equal(f.player.controls().dragging, false)
})

test('BR-08 synthetic and region-external pointerdown do not own controls', t => {
  const f = fixture(t), before = f.player.controls().userRevision
  f.pointer('pointerdown', f.inner, 1, false); f.pointer('pointerdown', f.outside)
  assert.equal(f.player.controls().dragging, false); assert.equal(f.player.controls().userRevision, before)
})

test('BR-08 a nonprogress press preserves the current drag owner', t => {
  const f = fixture(t); f.pointer('pointerdown', f.inner, 7)
  f.pointer('pointerdown', f.nonProgress, 8)
  assert.equal(f.player.controls().dragging, true)
  f.pointer('pointerup', f.outside, 8); assert.equal(f.player.controls().dragging, true)
  f.pointer('pointerup', f.outside, 7); assert.equal(f.player.controls().dragging, false)
})

for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  test(`BR-08 only the current trusted pointer owner can release by ${type}`, t => {
    const f = fixture(t)
    f.pointer('pointerdown', f.inner, 1); f.pointer('pointerdown', f.inner, 2)
    f.pointer(type, f.outside, 1); assert.equal(f.player.controls().dragging, true, 'the old pointer cannot release its replacement')
    f.pointer(type, f.outside, 2, false); assert.equal(f.player.controls().dragging, true, 'synthetic release has no authority')
    f.pointer(type, f.outside, 2); assert.equal(f.player.controls().dragging, false)
  })
}

test('BR-08 a reentrant newer progress press remains the drag owner', t => {
  const f = fixture(t)
  f.inner.onClosest = () => { f.inner.onClosest = null; f.pointer('pointerdown', f.wrapper, 2) }
  f.pointer('pointerdown', f.inner, 1)
  f.pointer('pointerup', f.outside, 1)
  assert.equal(f.player.controls().dragging, true, 'the outer handler cannot overwrite a newer nested gesture')
  f.pointer('pointerup', f.outside, 2); assert.equal(f.player.controls().dragging, false)
})

for (const boundary of ['visibility', 'initial-region', 'matched-hit-region'] as const) {
  test(`BR-08 ${boundary} read reentry cannot overwrite the newer pointer owner`, t => {
    const f = fixture(t)
    const nested = (): void => {
      f.onVisibility(() => undefined); f.region.onContains = null
      f.pointer('pointerdown', f.wrapper, 2)
    }
    if (boundary === 'visibility') f.onVisibility(nested)
    else if (boundary === 'initial-region') f.region.onContains = nested
    else {
      let reads = 0
      f.region.onContains = () => { if (++reads === 2) nested() }
    }
    f.pointer('pointerdown', f.inner, 1)
    f.pointer('pointerup', f.outside, 1)
    assert.equal(f.player.controls().dragging, true, 'the replaced outer preparation cannot claim the nested gesture')
    f.pointer('pointerup', f.outside, 2); assert.equal(f.player.controls().dragging, false)
  })
}

test('BR-08 a nested synthetic press cannot revoke a trusted pending gesture', t => {
  const f = fixture(t)
  f.onVisibility(() => {
    f.onVisibility(() => undefined); f.pointer('pointerdown', f.wrapper, 2, false)
  })
  f.pointer('pointerdown', f.inner, 1)
  assert.equal(f.player.controls().dragging, true)
  f.pointer('pointerup', f.outside, 2); assert.equal(f.player.controls().dragging, true)
  f.pointer('pointerup', f.outside, 1); assert.equal(f.player.controls().dragging, false)
})

test('BR-08 trusted blur reaches the player before VisibilityAdapter blocks the site event', t => {
  const f = fixture(t); let siteBlur = 0
  f.listen(f.window, 'blur', () => siteBlur++)
  f.pointer('pointerdown', f.inner); assert.equal(f.player.controls().dragging, true)
  f.blur()
  assert.equal(siteBlur, 0, 'the existing event guard still blocks the site listener')
  assert.equal(f.player.controls().dragging, false, 'control loss must be delivered before stopImmediatePropagation')
  assert.ok(f.notificationCount() > 0)
})

for (const type of ['visibilitychange', 'webkitvisibilitychange']) {
  test(`BR-08 native hidden ${type} releases controls before the visibility guard`, t => {
    const f = fixture(t); let siteHidden = 0
    f.listen(f.document, type, () => siteHidden++)
    f.pointer('pointerdown', f.inner); f.hidden(true); f.visibilityEvent(type)
    assert.equal(siteHidden, 0); assert.equal(f.document.visibilityState, 'visible', 'the spoof stays unchanged')
    f.hidden(false)
    assert.equal(f.player.controls().dragging, false, 'a quick return cannot revive the hidden gesture')
  })
}

test('BR-08 synthetic blur cannot revoke a trusted visible gesture', t => {
  const f = fixture(t); f.pointer('pointerdown', f.inner); f.blur(false)
  assert.equal(f.player.controls().dragging, true)
})

test('BR-08 actual visibility sampling clears a gesture even without an event', t => {
  const f = fixture(t); f.pointer('pointerdown', f.inner); f.hidden(true)
  assert.equal(f.player.controls().dragging, false)
  f.hidden(false); assert.equal(f.player.controls().dragging, false)
})

test('BR-08 a hidden pointerdown cannot establish a drag or user revision', t => {
  const f = fixture(t), before = f.player.controls().userRevision; f.hidden(true)
  f.pointer('pointerdown', f.inner)
  assert.equal(f.player.controls().dragging, false); assert.equal(f.player.controls().userRevision, before)
})

for (const change of ['lifecycle', 'video', 'player', 'reset'] as const) {
  test(`BR-08 ${change} invalidation clears the owned drag and does not revive it`, t => {
    const f = fixture(t); f.pointer('pointerdown', f.inner)
    if (change === 'lifecycle') f.lifecycle('1:1')
    if (change === 'video') f.replaceVideo()
    if (change === 'player') f.replacePlayer()
    if (change === 'reset') f.player.reset()
    assert.equal(f.player.controls().dragging, false)
    f.pointer('pointerup', f.outside); assert.equal(f.player.controls().dragging, false)
  })
}

test('BR-08 control-loss subscriber failures do not interrupt later listeners or the guard', t => {
  const f = fixture(t); let calls = 0, siteBlur = 0
  const cancelFailure = f.subscribeControlLoss(() => { throw new Error('controlled listener failure') })
  const cancelCount = f.subscribeControlLoss(() => calls++)
  testScope(t).defer(() => { cancelCount(); cancelFailure() })
  f.listen(f.window, 'blur', () => siteBlur++)
  assert.doesNotThrow(() => f.blur()); assert.equal(calls, 1); assert.equal(siteBlur, 0)
  cancelCount(); f.blur(); assert.equal(calls, 1, 'cancelled listener is no longer called')
})

test('BR-08 resetting player unsubscribes control loss and restores only its own site methods', t => {
  const f = fixture(t), before = f.notificationCount()
  f.player.reset(); f.blur(); assert.equal(f.notificationCount(), before)
  assert.equal(f.video.count(), 0)
  assert.equal(f.document.count(), 2, 'only the VisibilityAdapter guards remain')
  assert.equal(f.window.count(), 1, 'only the existing blur guard remains')
})

test('BR-08 visibility disable and reinstall preserve control-loss subscriptions and native descriptors', t => {
  const f = fixture(t); let calls = 0
  const cancel = f.subscribeControlLoss(() => calls++); testScope(t).defer(cancel)
  f.visibility.dispose(); assert.equal(f.document.visibilityState, 'visible')
  f.visibility.install(); f.blur(); assert.equal(calls, 1)
  f.hidden(true); assert.equal(f.visibility.isActuallyVisible(), false)
  f.visibility.dispose(); assert.equal(f.document.visibilityState, 'hidden')
})
