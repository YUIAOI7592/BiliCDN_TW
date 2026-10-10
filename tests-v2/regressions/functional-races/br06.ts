import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { PlayerAdapter } from '../../../src-v2/adapters/player.ts'
import { PlayerMonitor } from '../../../src-v2/application/player-monitor.ts'
import { RecoveryController } from '../../../src-v2/application/recovery-controller.ts'
import type { VideoSnapshot } from '../../../src-v2/application/ports.ts'
import { representationId, generationId, epochId } from '../../../src-v2/domain/model.ts'
import { FakeClock } from '../../support/clock.ts'
import { testScope } from '../../support/scope.ts'
import { monitorRoutes, monitorMeasurement } from '../../support/controllers.ts'
import { deferred } from '../../support/deferred.ts'

// The event type and website command phase are independent. Chrome supplies the
// native trusted-input evidence; Node models the dispatch ownership contract.
function fixture(t: TestContext) {
  const scope = testScope(t), clock = scope.own(new FakeClock())
  const document = new EventTarget(), window = new EventTarget()
  let visible = true, lifecycle = 'fixture'
  let snapshotPatch: Partial<VideoSnapshot> = {}
  class DomElement extends EventTarget {
    currentTime = 120
    seeking = false
    tagName = 'DIV'
    isContentEditable = false
    role = ''
    id = ''
    parentElement: DomElement | null = null
    closest(selector: string): DomElement | null {
      if (selector.includes('input') && (['INPUT', 'TEXTAREA', 'SELECT'].includes(this.tagName)
        || this.role === 'textbox' || this.id === 'bilicdn-v2-control-center')) return this
      return selector.includes('.bpx-player-container') && (this === video || this === region) ? region : null
    }
    contains(target: unknown): boolean { return target === this || (this === region && target === video) }
  }
  const body = new DomElement(), region = new DomElement(), video = new DomElement()
  body.tagName = 'BODY'
  let currentVideo = video
  video.parentElement = region
  class InputEvent extends Event {
    #dispatching = false
    stopped = false
    readonly isComposing: boolean; readonly ctrlKey: boolean; readonly metaKey: boolean; readonly altKey: boolean
    readonly shiftKey: boolean; readonly repeat: boolean; readonly keyCode: number
    constructor(type: string, readonly key: string, private readonly trusted: boolean, private readonly receiver: DomElement,
      options: { isComposing?: boolean; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; shiftKey?: boolean; repeat?: boolean; keyCode?: number } = {}) {
      super(type); this.isComposing = options.isComposing ?? false; this.ctrlKey = options.ctrlKey ?? false
      this.metaKey = options.metaKey ?? false; this.altKey = options.altKey ?? false
      this.shiftKey = options.shiftKey ?? false; this.repeat = options.repeat ?? false; this.keyCode = options.keyCode ?? 0
    }
    override get isTrusted(): boolean { return this.trusted }
    override get target(): EventTarget { return this.receiver }
    // Node clears eventPhase between listeners; the browser's DOM keeps it through dispatch.
    override get eventPhase(): number { return this.#dispatching ? Event.AT_TARGET : Event.NONE }
    override stopPropagation(): void { this.stopped = true; super.stopPropagation() }
    dispatch(): boolean {
      this.#dispatching = true
      try { const result = document.dispatchEvent(this); if (!this.stopped) window.dispatchEvent(this); return result }
      finally { this.#dispatching = false }
    }
    async dispatchWithMicrotask(callback: () => void): Promise<boolean> {
      this.#dispatching = true
      try {
        const result = document.dispatchEvent(this)
        await Promise.resolve().then(callback)
        if (!this.stopped) window.dispatchEvent(this)
        return result
      } finally { this.#dispatching = false }
    }
  }
  for (const [name, value] of Object.entries({ document, window, Node: DomElement, Element: DomElement, HTMLElement: DomElement, KeyboardEvent: InputEvent }))
    scope.defineGlobal(name, { configurable: true, value })
  const effects: { fallbacks: number; reloads: number; reloadPositions: number[] } = { fallbacks: 0, reloads: 0, reloadPositions: [] }
  const timeoutCallbacks: (() => void)[] = []
  let frames = 100
  let seekEffect: (this: unknown, value: number, ...args: unknown[]) => unknown = value => {
    video.currentTime = value; video.seeking = true; video.dispatchEvent(new Event('seeking'))
  }
  let playEffect: () => unknown = () => undefined, reloadEffect: () => unknown = () => undefined
  const site = {
    __core: () => core,
    getCurrentTime: () => video.currentTime,
    getPlaybackRate: () => 1,
    seek(this: unknown, value: number, ...args: unknown[]): unknown { return Reflect.apply(seekEffect, this, [value, ...args]) },
    reload(): unknown { effects.reloads++; return reloadEffect() },
    setPlaybackRate(): void {}, play(): unknown { return playEffect() },
  }
  let core = { state: { initialized: true } }, owner = site
  class Player extends PlayerAdapter {
    protected override player() { return owner }
    override video(): HTMLVideoElement { return currentVideo as unknown as HTMLVideoElement }
    override syncManifest(): boolean { return true }
    override snapshot(): VideoSnapshot {
      return { available: true, paused: false, seeking: video.seeking, ended: false,
        readyState: video.seeking ? 1 : 4, currentTime: video.currentTime, duration: 3910, width: 1280, height: 720,
        playbackRate: 1, effectiveRate: 1, bufferAheadSec: video.seeking ? 0 : 30, playableBufferSec: video.seeking ? 0 : 30,
        bufferedToEnd: false, frames, mediaError: false, coreInitialized: true, manifestHasVideo: true, ...snapshotPatch }
    }
  }
  const player = new Player({ lifecycleKey: () => lifecycle, transform: () => ({ accepted: true, formats: [],
    videoCount: 0, audioCount: 0, segmentCount: 0, upstreamCode: 0, reason: null }) }, {
    scheduler: { timeout(callback, delay) { timeoutCallbacks.push(callback); return clock.timeout(callback, delay) } },
    isActuallyVisible: () => visible, subscribeControlLoss: () => () => undefined })
  scope.defer(() => player.reset())
  const recovery = scope.own(new RecoveryController(player, clock.now, () => visible))
  scope.defer(recovery.subscribe(event => {
    if (event.type === 'recovery' && event.action.action === 'player-reload') effects.reloadPositions.push(event.action.savedPositionSec)
  }))
  const monitor = scope.own(new PlayerMonitor(player,
    { get: () => ({ generation: generationId(1), epoch: epochId(0), representation: representationId('video:fixture'),
      affinity: null, disabled: false, recovering: false, lastDecisionId: null }) },
    { get: () => ({ disabled: false }) },
    { groupSummary: () => ({ kind: 'video', bandwidth: 4_000_000, height: 720, codec: 'avc', routeCount: 1 }) },
    monitorRoutes({ latestRequested: () => ({ generation: generationId(1), epoch: epochId(0), representation: representationId('video:fixture'),
      targetHost: 'upos-sz-mirrorali.bilivideo.com', routePolicyRevision: 0, authorityRevision: 1 }),
      recoveryEligible: () => true, recover() { effects.fallbacks++; recovery.armRouteFailure('watchdog', player.snapshot()) } }),
    monitorMeasurement(), recovery, () => visible, clock.now, clock))
  monitor.tick(); clock.advance(1000); video.currentTime += 1; frames += 30; monitor.tick()
  // Bilibili's confirmed page-level handler runs after the adapter capture listener.
  let keyEffect: (event: InputEvent) => void = event => {
    const delta = ['ArrowLeft', 'j', 'J'].includes(event.key) ? -5 : 5
    if (['ArrowLeft', 'ArrowRight', 'j', 'J', 'l', 'L'].includes(event.key)) site.seek(video.currentTime + delta)
    if (event.key === 'Home') site.seek(0)
    if (event.key === 'End') site.seek(3900)
  }
  let keyupEffect: (event: InputEvent) => void = () => undefined
  const handleKey = (event: Event): void => {
    if (event instanceof InputEvent) (event.type === 'keyup' ? keyupEffect : keyEffect)(event)
  }
  for (const type of ['keydown', 'keyup']) {
    document.addEventListener(type, handleKey)
    scope.defer(() => document.removeEventListener(type, handleKey))
  }
  const pointerSeek = (target: number): void => {
    document.dispatchEvent(new InputEvent('pointerdown', '', true, video)); site.seek(target); monitor.tick()
  }
  return { player, monitor, recovery, clock, effects, pointerSeek, video, body, site, window, document,
    visible: (value: boolean) => { visible = value }, lifecycle: (value: string) => { lifecycle = value },
    patch: (value: Partial<VideoSnapshot>) => { snapshotPatch = { ...snapshotPatch, ...value } },
    replaceVideo: () => { currentVideo = new DomElement() }, replaceOwner: () => { owner = { ...site } },
    replaceCore: () => { core = { state: { initialized: true } } },
    onKey: (value: (event: InputEvent) => void) => { keyEffect = value },
    onKeyup: (value: (event: InputEvent) => void) => { keyupEffect = value },
    onSeek: (value: (this: unknown, position: number, ...args: unknown[]) => unknown) => { seekEffect = value },
    onPlay: (value: () => unknown) => { playEffect = value }, onReload: (value: () => unknown) => { reloadEffect = value },
    fireCleanup: (index: number) => { timeoutCallbacks[index]?.() },
    listen: (target: EventTarget, type: string, listener: EventListener) => {
      target.addEventListener(type, listener); scope.defer(() => target.removeEventListener(type, listener))
    },
    keyBetweenListeners: (type: 'keydown' | 'keyup', callback: () => void) =>
      new InputEvent(type, 'ArrowRight', true, body).dispatchWithMicrotask(callback),
    keyup: (trusted: boolean, inPlayer = false, key = 'ArrowRight', options: ConstructorParameters<typeof InputEvent>[4] = {}) =>
      new InputEvent('keyup', key, trusted, inPlayer ? video : body, options).dispatch(),
    key: (trusted: boolean, inPlayer = false, key = 'ArrowRight', options: ConstructorParameters<typeof InputEvent>[4] = {}) =>
      new InputEvent('keydown', key, trusted, inPlayer ? video : body, options).dispatch() }
}

function rightOnKeyup(t: TestContext) {
  const f = fixture(t)
  f.onKey(() => undefined)
  f.onKeyup(() => {
    f.video.currentTime += 5; f.video.seeking = true
    f.video.dispatchEvent(new Event('seeking'))
  })
  return f
}

test('BR-07 trusted right seek during keyup acquires one new user revision', t => {
  const f = rightOnKeyup(t), before = f.player.controls().userRevision
  f.key(true); f.keyup(true)
  assert.equal(f.video.currentTime, 126)
  assert.equal(f.player.controls().userRevision, before + 1,
    'the actual trusted user seek command must acquire ownership at its website commit boundary')
})

test('BR-07 trusted keyup seek receives a fresh 15000 ms grace', t => {
  const f = rightOnKeyup(t)
  f.pointerSeek(900); f.clock.advance(8000); f.monitor.tick()
  f.key(true); f.keyup(true); f.monitor.tick()
  f.clock.advance(7000); f.monitor.tick()
  assert.equal(f.effects.fallbacks, 0, 'only 7000 ms elapsed since the new trusted right seek')
  f.clock.advance(7999); f.monitor.tick(); assert.equal(f.effects.fallbacks, 0)
  f.clock.advance(1); f.monitor.tick(); assert.equal(f.effects.fallbacks, 1)
})

test('BR-07 control: left committed during keydown grants one revision', t => {
  const f = fixture(t), before = f.player.controls().userRevision
  f.key(true, false, 'ArrowLeft')
  assert.equal(f.player.controls().userRevision, before + 1)
})

test('BR-07 control: pointer seek still grants fresh grace', t => {
  const f = fixture(t)
  f.pointerSeek(900); f.clock.advance(8000); f.monitor.tick(); f.pointerSeek(950)
  f.clock.advance(14999); f.monitor.tick(); assert.equal(f.effects.fallbacks, 0)
  f.clock.advance(1); f.monitor.tick(); assert.equal(f.effects.fallbacks, 1)
})

test('BR-07 control: synthetic keyup cannot acquire user ownership', t => {
  const f = rightOnKeyup(t), before = f.player.controls().userRevision
  f.key(false); f.keyup(false)
  assert.equal(f.player.controls().userRevision, before)
})

test('BR-06 trusted page keyboard seek starts a new user revision', t => {
  const f = fixture(t), before = f.player.controls()
  f.key(true)
  assert.equal(f.player.controls().targetSec, 126)
  assert.equal(f.player.controls().userRevision, before.userRevision + 1,
    'a trusted page keyboard command that actually seeks must acquire new user ownership')
})

test('BR-06 trusted page keyboard seek receives a fresh 15000 ms grace period', t => {
  const f = fixture(t)
  f.pointerSeek(978); f.clock.advance(8000); f.monitor.tick(); f.key(true); f.monitor.tick()
  f.clock.advance(7000); f.monitor.tick()
  assert.equal(f.effects.fallbacks, 0, 'only 7000 ms elapsed since the new keyboard seek')
  f.clock.advance(7999); f.monitor.tick(); assert.equal(f.effects.fallbacks, 0)
  f.clock.advance(1); f.monitor.tick(); assert.equal(f.effects.fallbacks, 1)
})

test('BR-06 control: in-player keyboard seek receives fresh grace', t => {
  const f = fixture(t)
  f.pointerSeek(978); f.clock.advance(8000); f.monitor.tick(); f.key(true, true); f.monitor.tick()
  f.clock.advance(14999); f.monitor.tick(); assert.equal(f.effects.fallbacks, 0)
  f.clock.advance(1); f.monitor.tick(); assert.equal(f.effects.fallbacks, 1)
})

test('BR-06 control: pointer seek receives fresh grace', t => {
  const f = fixture(t)
  f.pointerSeek(978); f.clock.advance(8000); f.monitor.tick(); f.pointerSeek(1900)
  f.clock.advance(14999); f.monitor.tick(); assert.equal(f.effects.fallbacks, 0)
  f.clock.advance(1); f.monitor.tick(); assert.equal(f.effects.fallbacks, 1)
})

test('BR-06 control: synthetic page key cannot extend an existing stall', t => {
  const f = fixture(t)
  f.pointerSeek(978); f.clock.advance(8000); f.monitor.tick()
  const before = f.player.controls().userRevision
  f.key(false); f.monitor.tick()
  assert.equal(f.player.controls().userRevision, before)
  f.clock.advance(7000); f.monitor.tick(); assert.equal(f.effects.fallbacks, 1)
})

for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End', 'j', 'J', 'l', 'L']) {
  test(`BR-06 supported ${key} confirms one actual seek including position zero`, t => {
    const f = fixture(t), before = f.player.controls()
    f.key(true, false, key, { shiftKey: true, repeat: true })
    const after = f.player.controls()
    assert.equal(after.userRevision, before.userRevision + 1)
    assert.ok(after.seekRevision > before.seekRevision)
    assert.equal(after.targetSec, f.video.currentTime)
    if (key === 'Home') assert.equal(after.targetSec, 0)
  })
}

for (const tag of ['INPUT', 'TEXTAREA', 'SELECT', 'editable', 'textbox', 'control-center']) {
  test(`BR-06 ${tag} keyboard cannot grant a fresh stall deadline`, t => {
    const f = fixture(t), before = f.player.controls().userRevision
    if (tag === 'editable') f.body.isContentEditable = true
    else if (tag === 'textbox') f.body.role = 'textbox'
    else if (tag === 'control-center') f.body.id = 'bilicdn-v2-control-center'
    else f.body.tagName = tag
    f.key(true)
    assert.equal(f.player.controls().userRevision, before)
    assert.equal(f.video.currentTime, 126, 'a site command may run without being attributed to this user gesture')
  })
}

for (const options of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { isComposing: true }, { keyCode: 229 }]) {
  test(`BR-06 excluded keyboard context ${Object.keys(options)[0]} cannot grant ownership`, t => {
    const f = fixture(t), before = f.player.controls().userRevision
    f.key(true, false, 'ArrowRight', options)
    assert.equal(f.player.controls().userRevision, before)
  })
}

test('BR-06 ignored and unchanged seek commands do not count as new user actions', t => {
  const f = fixture(t), before = f.player.controls().userRevision
  f.onKey(() => undefined); f.key(true)
  f.onKey(() => f.site.seek(f.video.currentTime)); f.key(true)
  f.onSeek(() => undefined); f.onKey(() => f.site.seek(900)); f.key(true)
  assert.ok(f.clock.pendingCount <= 1, 'at most one cleanup timer exists for the newest candidate')
  assert.equal(f.player.controls().userRevision, before)
  f.clock.advance(0); assert.equal(f.clock.pendingCount, 0)
})

test('BR-06 actual direct media seek is confirmed at window bubble and media duplicates do not double count', t => {
  const f = fixture(t), before = f.player.controls()
  f.onKey(() => { f.video.currentTime = 0; f.video.seeking = true })
  f.key(true)
  assert.equal(f.player.controls().userRevision, before.userRevision + 1)
  assert.ok(f.player.controls().seekRevision > before.seekRevision)
  f.video.dispatchEvent(new Event('seeking')); f.player.controls()
  assert.equal(f.player.controls().userRevision, before.userRevision + 1)
})

test('BR-06 stopped propagation still confirms a synchronous wrapped site seek', t => {
  const f = fixture(t), before = f.player.controls().userRevision
  f.onKey(event => { event.stopPropagation(); f.site.seek(900) })
  f.key(true); assert.equal(f.player.controls().userRevision, before + 1)
})

test('BR-06 a control snapshot between key listeners cannot clear the still-dispatching candidate', t => {
  const f = fixture(t), before = f.player.controls().userRevision
  f.onKey(() => { f.player.controls(); f.site.seek(900) })
  f.key(true); assert.equal(f.player.controls().userRevision, before + 1)
})

test('BR-06 deferred work after dispatch cannot consume a candidate even before its cleanup timer', async t => {
  const f = fixture(t), before = f.player.controls().userRevision, work = deferred<void>()
  f.onKey(() => { void work.promise.then(() => f.site.seek(900)) })
  f.key(true); work.resolve(); await work.promise; await Promise.resolve()
  assert.equal(f.player.controls().userRevision, before)
  assert.equal(f.video.currentTime, 900)
  assert.equal(f.clock.pendingCount, 0)
})

test('BR-06 script restore and later website retries never inherit a keyboard gesture', t => {
  const f = fixture(t), before = f.player.controls().userRevision
  f.onKey(() => f.player.seek(0)); f.key(true)
  assert.equal(f.player.controls().userRevision, before)
  f.site.seek(800); assert.equal(f.player.controls().userRevision, before)
  f.video.dispatchEvent(new Event('seeked'))
  f.onKey(() => undefined); f.key(true); f.clock.advance(0); f.site.seek(900)
  assert.equal(f.player.controls().userRevision, before)
})

test('BR-06 exact site seek result and exception survive keyboard observation', t => {
  const f = fixture(t), result = {}, error = new Error('seek rejected'), before = f.player.controls().userRevision
  f.onSeek(() => { throw error })
  f.onKey(() => assert.throws(() => f.site.seek(900), value => value === error)); f.key(true)
  assert.equal(f.player.controls().userRevision, before)
  f.onSeek(value => { f.video.currentTime = value; f.video.seeking = true; return result })
  f.onKey(() => assert.equal(f.site.seek(0), result)); f.key(true)
  assert.equal(f.player.controls().userRevision, before + 1)
})

for (const invalidation of ['hidden', 'lifecycle', 'media', 'player', 'reset'] as const) {
  test(`BR-06 ${invalidation} invalidates a captured keyboard candidate`, t => {
    const f = fixture(t), before = f.player.controls().userRevision
    f.onKey(() => {
      if (invalidation === 'hidden') f.visible(false)
      if (invalidation === 'lifecycle') f.lifecycle('next')
      if (invalidation === 'media') f.replaceVideo()
      if (invalidation === 'player') f.replaceOwner()
      if (invalidation === 'reset') f.player.reset()
      f.site.seek(900)
    })
    f.key(true)
    assert.equal(f.player.controls().userRevision, before + (invalidation === 'reset' ? 1 : 0))
    assert.equal(f.clock.pendingCount, 0)
  })
}

test('BR-06 nested keys and duplicate callbacks cannot revive the older candidate', t => {
  const f = fixture(t), before = f.player.controls().userRevision
  let nested = false
  f.onKey(() => {
    f.site.seek(f.video.currentTime + 5)
    if (!nested) { nested = true; f.key(true) }
    f.player.controls()
  })
  f.key(true); assert.equal(f.player.controls().userRevision, before + 2)
  assert.equal(f.video.currentTime, 131); assert.equal(f.clock.pendingCount, 0)
})

test('BR-06 new keyboard seek after an old fallback gets new 15/30/15 boundaries and no repeated reload', t => {
  const f = fixture(t)
  f.pointerSeek(978); f.clock.advance(15000); f.monitor.tick(); assert.equal(f.effects.fallbacks, 1)
  f.key(true); f.monitor.tick()
  f.clock.advance(14999); f.monitor.tick(); assert.equal(f.effects.fallbacks, 1)
  f.clock.advance(1); f.monitor.tick(); assert.equal(f.effects.fallbacks, 2)
  f.clock.advance(14999); f.monitor.tick(); assert.equal(f.effects.reloads, 0)
  f.clock.advance(1); f.monitor.tick(); assert.equal(f.effects.reloads, 1)
  f.clock.advance(14999); f.monitor.tick(); assert.equal(f.recovery.isRecovering(), true)
  f.clock.advance(1); f.monitor.tick(); assert.equal(f.recovery.snapshot().reason, 'reload-timeout')
  f.clock.advance(90000); f.monitor.tick(); assert.equal(f.effects.reloads, 1)
})

test('BR-06 a late reload rejection cannot cancel the new keyboard stall owner', async t => {
  const f = fixture(t), reload = deferred<void>()
  f.onReload(() => reload.promise)
  f.pointerSeek(978); f.clock.advance(15000); f.monitor.tick(); f.clock.advance(15000); f.monitor.tick()
  f.key(true); f.monitor.tick(); const before = f.recovery.snapshot()
  reload.reject(new Error('old reload rejected')); await Promise.resolve(); await Promise.resolve()
  assert.equal(f.recovery.snapshot().state, before.state)
  assert.equal(f.recovery.snapshot().reason, before.reason)
  assert.equal(f.video.currentTime, 983)
})

test('BR-06 a late play rejection cannot revive restoration after a new actual keyboard seek', async t => {
  const f = fixture(t), play = deferred<void>()
  f.onPlay(() => play.promise)
  f.pointerSeek(978); f.clock.advance(15000); f.monitor.tick(); f.clock.advance(15000); f.monitor.tick()
  f.replaceCore(); f.video.seeking = false; f.patch({ readyState: 4 }); f.monitor.tick()
  assert.equal(f.recovery.snapshot().state, 'waiting')
  f.key(true); f.monitor.tick(); const before = f.recovery.snapshot()
  play.reject(new Error('old play rejected')); await Promise.resolve(); await Promise.resolve()
  assert.equal(f.recovery.snapshot().state, before.state)
  assert.equal(f.recovery.snapshot().reason, before.reason)
  assert.equal(f.video.currentTime, 983)
})

for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End', 'j', 'J', 'l', 'L']) {
  test(`BR-07 keyup ${key} confirms one actual seek including position zero`, t => {
    const f = fixture(t), before = f.player.controls()
    f.onKey(() => undefined)
    f.onKeyup(event => {
      const target = event.key === 'Home' ? 0 : event.key === 'End' ? 3900
        : f.video.currentTime + (['ArrowLeft', 'j', 'J'].includes(event.key) ? -5 : 5)
      f.site.seek(target)
    })
    f.key(true, false, key); f.keyup(true, false, key, { shiftKey: true })
    const after = f.player.controls()
    assert.equal(after.userRevision, before.userRevision + 1)
    assert.ok(after.seekRevision > before.seekRevision)
    assert.equal(after.targetSec, f.video.currentTime)
    if (key === 'Home') assert.equal(after.targetSec, 0)
  })
}

test('BR-07 separate keydown and keyup seeks each acquire their own revision', t => {
  const f = fixture(t), before = f.player.controls().userRevision
  f.onKeyup(() => f.site.seek(f.video.currentTime + 5))
  f.key(true); assert.equal(f.player.controls().userRevision, before + 1)
  f.keyup(true); assert.equal(f.player.controls().userRevision, before + 2)
})

test('BR-07 keyup without a new seek does not count an earlier keydown twice', t => {
  const f = fixture(t), before = f.player.controls().userRevision
  f.key(true); f.keyup(true)
  assert.equal(f.player.controls().userRevision, before + 1)
  assert.equal(f.video.currentTime, 126)
  f.clock.advance(0); assert.equal(f.clock.pendingCount, 0)
})

test('BR-07 every repeated dispatch that changes the target acquires new ownership', t => {
  const f = fixture(t), before = f.player.controls().userRevision
  f.key(true); f.key(true, false, 'ArrowRight', { repeat: true })
  f.key(true, false, 'ArrowRight', { repeat: true })
  f.onKeyup(() => f.site.seek(f.video.currentTime + 5)); f.keyup(true)
  assert.equal(f.player.controls().userRevision, before + 4)
  assert.equal(f.video.currentTime, 141)
})

test('BR-07 repeated ignored dispatches cannot extend a stall', t => {
  const f = rightOnKeyup(t)
  f.pointerSeek(900); const before = f.player.controls().userRevision
  f.onKeyup(() => undefined)
  for (let index = 0; index < 3; index++) {
    f.clock.advance(4000); f.keyup(true, false, 'ArrowRight', { repeat: true }); f.monitor.tick()
  }
  assert.equal(f.player.controls().userRevision, before)
  f.clock.advance(3000); f.monitor.tick(); assert.equal(f.effects.fallbacks, 1)
})

test('BR-07 keyup wrapped seek, media events, controls and bubble count once per dispatch', t => {
  const f = fixture(t), before = f.player.controls().userRevision
  f.onKeyup(() => {
    f.site.seek(0); f.video.dispatchEvent(new Event('seeking')); f.player.controls()
    f.site.seek(900); f.player.controls()
  })
  f.keyup(true); f.video.dispatchEvent(new Event('seeking')); f.player.controls()
  assert.equal(f.player.controls().userRevision, before + 1)
  assert.equal(f.player.controls().targetSec, 900)
})

test('BR-07 direct keyup media seek is observed at the matching window bubble', t => {
  const f = fixture(t), before = f.player.controls().userRevision
  f.onKeyup(() => { f.video.currentTime = 0; f.video.seeking = true })
  f.keyup(true)
  assert.equal(f.player.controls().userRevision, before + 1)
  assert.equal(f.player.controls().targetSec, 0)
})

for (const tag of ['INPUT', 'TEXTAREA', 'SELECT', 'editable', 'textbox', 'control-center']) {
  test(`BR-07 keyup ${tag} cannot grant a fresh stall deadline`, t => {
    const f = rightOnKeyup(t), before = f.player.controls().userRevision
    if (tag === 'editable') f.body.isContentEditable = true
    else if (tag === 'textbox') f.body.role = 'textbox'
    else if (tag === 'control-center') f.body.id = 'bilicdn-v2-control-center'
    else f.body.tagName = tag
    f.keyup(true)
    assert.equal(f.video.currentTime, 126)
    assert.equal(f.player.controls().userRevision, before)
  })
}

for (const options of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { isComposing: true }, { keyCode: 229 }]) {
  test(`BR-07 keyup excluded ${Object.keys(options)[0]} cannot grant ownership`, t => {
    const f = rightOnKeyup(t), before = f.player.controls().userRevision
    f.keyup(true, false, 'ArrowRight', options)
    assert.equal(f.video.currentTime, 126)
    assert.equal(f.player.controls().userRevision, before)
  })
}

test('BR-07 non-seek commands remain keydown-only', t => {
  const f = fixture(t), before = f.player.controls().userRevision
  for (const key of ['ArrowUp', 'ArrowDown', ' ', 'k', 'K']) {
    f.key(true, true, key); f.keyup(true, true, key)
  }
  assert.equal(f.player.controls().userRevision, before + 5)
})

test('BR-07 synthetic keyup revokes an older candidate without acquiring ownership', t => {
  const f = fixture(t), before = f.player.controls().userRevision
  f.onKey(() => { f.keyup(false); f.site.seek(900) })
  f.key(true)
  assert.equal(f.player.controls().userRevision, before)
  assert.equal(f.video.currentTime, 900)
  assert.equal(f.clock.pendingCount, 0)
})

test('BR-07 nested non-seek keyup revokes the older seek candidate', t => {
  const f = fixture(t), before = f.player.controls().userRevision
  f.onKey(() => { f.keyup(true, false, 'x'); f.site.seek(900) })
  f.key(true)
  assert.equal(f.player.controls().userRevision, before)
})

test('BR-07 nested seek dispatches consume each candidate once and never restore the older one', t => {
  const f = fixture(t), before = f.player.controls().userRevision
  f.onKeyup(() => { f.site.seek(900); f.key(true); f.site.seek(1000); f.player.controls() })
  f.keyup(true)
  assert.equal(f.player.controls().userRevision, before + 2)
  assert.equal(f.video.currentTime, 1000)
  assert.equal(f.clock.pendingCount, 0)
})

test('BR-07 a newer dispatch before the outer seek keeps exclusive candidate ownership', t => {
  const f = fixture(t), before = f.player.controls().userRevision
  f.onKeyup(() => { f.key(true); f.site.seek(900) })
  f.keyup(true)
  assert.equal(f.player.controls().userRevision, before + 1)
  assert.equal(f.video.currentTime, 900)
})

test('BR-07 an old cancelled cleanup cannot clear a newer keyup candidate', t => {
  const f = fixture(t), before = f.player.controls().userRevision
  f.onKey(() => undefined); f.key(true)
  f.onKeyup(() => { f.fireCleanup(0); f.site.seek(900) })
  f.keyup(true)
  assert.equal(f.player.controls().userRevision, before + 1)
  assert.equal(f.clock.pendingCount, 0)
})

test('BR-07 a stopped keyup still confirms a synchronous wrapped seek', t => {
  const f = fixture(t), before = f.player.controls().userRevision
  f.onKeyup(event => { event.stopPropagation(); f.site.seek(900) })
  f.keyup(true)
  assert.equal(f.player.controls().userRevision, before + 1)
})

test('BR-07 a stopped direct keyup can be confirmed by a sample in the same dispatch', t => {
  const f = fixture(t), before = f.player.controls().userRevision
  f.onKeyup(event => {
    event.stopPropagation(); f.video.currentTime = 0; f.video.seeking = true; f.player.controls()
  })
  f.keyup(true)
  assert.equal(f.player.controls().userRevision, before + 1)
})

test('BR-07 an inter-listener microtask retains the still-dispatching keyup candidate', async t => {
  const f = fixture(t), before = f.player.controls().userRevision
  await f.keyBetweenListeners('keyup', () => { f.player.controls(); f.site.seek(900) })
  assert.equal(f.player.controls().userRevision, before + 1)
})

test('BR-07 keyup Promise work after Event.NONE cannot consume a candidate', async t => {
  const f = fixture(t), before = f.player.controls().userRevision, work = deferred<void>()
  f.onKeyup(() => { void work.promise.then(() => f.site.seek(900)) })
  f.keyup(true); work.resolve(); await work.promise; await Promise.resolve()
  assert.equal(f.video.currentTime, 900)
  assert.equal(f.player.controls().userRevision, before)
  assert.equal(f.clock.pendingCount, 0)
})

test('BR-07 keyup timer work after dispatch never inherits the user revision', t => {
  const f = fixture(t), before = f.player.controls().userRevision
  f.onKeyup(() => f.clock.timeout(() => f.site.seek(900), 0))
  f.keyup(true); f.clock.advance(0)
  assert.equal(f.video.currentTime, 900)
  assert.equal(f.player.controls().userRevision, before)
  assert.equal(f.clock.pendingCount, 0)
})

test('BR-07 keyup preserves seek receiver, every argument, exact result and exception', t => {
  const f = fixture(t), receiver = {}, marker = {}, result = {}, error = new Error('keyup seek rejected')
  const before = f.player.controls().userRevision
  f.onSeek(function(value, ...args) {
    assert.equal(this, receiver); assert.equal(value, 0); assert.deepEqual(args, [marker, false])
    f.video.currentTime = value; f.video.seeking = true; return result
  })
  f.onKeyup(() => assert.equal(Reflect.apply(f.site.seek, receiver, [0, marker, false]), result))
  f.keyup(true); assert.equal(f.player.controls().userRevision, before + 1)
  f.onSeek(() => { throw error })
  f.onKeyup(() => assert.throws(() => f.site.seek(900), value => value === error))
  f.keyup(true); assert.equal(f.player.controls().userRevision, before + 1)
})

test('BR-07 a seek that changes media before throwing preserves both the change and original exception', t => {
  const f = fixture(t), before = f.player.controls().userRevision, error = new Error('after real seek')
  f.onSeek(value => { f.video.currentTime = value; f.video.seeking = true; throw error })
  f.onKeyup(() => assert.throws(() => f.site.seek(0), value => value === error)); f.keyup(true)
  assert.equal(f.player.controls().userRevision, before + 1)
  assert.equal(f.video.currentTime, 0)
})

test('BR-07 keyup ignored, unchanged, non-finite and unstarted seeks do not grant ownership', t => {
  const f = fixture(t), before = f.player.controls().userRevision
  f.onKeyup(() => undefined); f.keyup(true)
  f.onKeyup(() => f.site.seek(f.video.currentTime)); f.keyup(true)
  f.onSeek(() => undefined); f.onKeyup(() => f.site.seek(900)); f.keyup(true)
  f.onKeyup(() => { f.video.currentTime = Number.NaN; f.video.seeking = true }); f.keyup(true)
  f.video.currentTime = 121; f.video.seeking = false
  f.onKeyup(() => { f.video.currentTime = 900 }); f.keyup(true)
  assert.equal(f.player.controls().userRevision, before)
  f.clock.advance(0); assert.equal(f.clock.pendingCount, 0)
})

test('BR-07 internal restore and its pending media event cannot acquire keyup ownership', t => {
  const f = fixture(t), before = f.player.controls().userRevision
  f.onKeyup(() => f.player.seek(0)); f.keyup(true)
  f.video.dispatchEvent(new Event('seeking')); f.player.controls()
  assert.equal(f.player.controls().userRevision, before)
  assert.equal(f.player.controls().targetSec, 0)
})

test('BR-07 an ambiguous direct return to an internal pending target is conservatively unowned', t => {
  const f = fixture(t), before = f.player.controls().userRevision
  f.player.seek(0)
  f.video.currentTime = 20
  f.onKeyup(() => { f.video.currentTime = 0; f.video.seeking = true; f.video.dispatchEvent(new Event('seeking')) })
  f.keyup(true)
  assert.equal(f.player.controls().userRevision, before)
  f.video.dispatchEvent(new Event('seeked'))
  f.onKeyup(() => { f.video.currentTime = 5; f.video.seeking = true; f.video.dispatchEvent(new Event('seeking')) })
  f.keyup(true); assert.equal(f.player.controls().userRevision, before + 1)
})

test('BR-07 a wrapped external keyup seek can supersede an internal pending target', t => {
  const f = fixture(t), before = f.player.controls().userRevision
  f.player.seek(0); f.video.currentTime = 20
  f.onKeyup(() => f.site.seek(0)); f.keyup(true)
  assert.equal(f.player.controls().userRevision, before + 1)
})

test('BR-07 reset cancels keyup cleanup without replacing a newer site seek wrapper', t => {
  const f = fixture(t), previous = f.site.seek
  f.keyup(true); assert.equal(f.clock.pendingCount, 1)
  const newer = function(this: unknown, ...args: Parameters<typeof previous>): unknown { return Reflect.apply(previous, this, args) }
  f.site.seek = newer; f.player.reset()
  assert.equal(f.site.seek, newer)
  assert.equal(f.clock.pendingCount, 0)
})

for (const invalidation of ['hidden', 'lifecycle', 'media', 'player', 'reset'] as const) {
  test(`BR-07 ${invalidation} invalidates a captured keyup candidate`, t => {
    const f = fixture(t), before = f.player.controls().userRevision
    f.onKeyup(() => {
      if (invalidation === 'hidden') f.visible(false)
      if (invalidation === 'lifecycle') f.lifecycle('next')
      if (invalidation === 'media') f.replaceVideo()
      if (invalidation === 'player') f.replaceOwner()
      if (invalidation === 'reset') f.player.reset()
      f.site.seek(900)
    })
    f.keyup(true)
    assert.equal(f.player.controls().userRevision, before + (invalidation === 'reset' ? 1 : 0))
    assert.equal(f.clock.pendingCount, 0)
  })
}

test('BR-07 actual keyup seek starts precise 15/30/15 boundaries and releases the stalled token', t => {
  const f = rightOnKeyup(t)
  f.pointerSeek(900); f.clock.advance(8000); f.monitor.tick(); f.key(true); f.keyup(true); f.monitor.tick()
  f.clock.advance(14999); f.monitor.tick(); assert.equal(f.effects.fallbacks, 0)
  f.clock.advance(1); f.monitor.tick(); assert.equal(f.effects.fallbacks, 1)
  f.clock.advance(14999); f.monitor.tick(); assert.equal(f.effects.reloads, 0)
  f.clock.advance(1); f.monitor.tick(); assert.equal(f.effects.reloads, 1)
  f.clock.advance(14999); f.monitor.tick(); assert.equal(f.recovery.isRecovering(), true)
  f.clock.advance(1); f.monitor.tick()
  assert.equal(f.recovery.snapshot().reason, 'reload-timeout')
  assert.equal(f.recovery.isRecovering(), false)
  f.clock.advance(90000); f.monitor.tick(); assert.equal(f.effects.reloads, 1)
})

test('BR-07 keyup after old fallback starts a new stage allowance and saves the latest position', t => {
  const f = rightOnKeyup(t)
  f.pointerSeek(900); f.clock.advance(15000); f.monitor.tick(); assert.equal(f.effects.fallbacks, 1)
  f.keyup(true); f.monitor.tick()
  f.clock.advance(14999); f.monitor.tick(); assert.equal(f.effects.fallbacks, 1)
  f.clock.advance(1); f.monitor.tick(); assert.equal(f.effects.fallbacks, 2)
  f.clock.advance(15000); f.monitor.tick(); assert.equal(f.effects.reloads, 1)
  assert.deepEqual(f.effects.reloadPositions, [905])
})

test('BR-07 later website seeking updates the target without extending the keyup deadline', t => {
  const f = rightOnKeyup(t)
  f.keyup(true); f.monitor.tick(); f.clock.advance(8000)
  f.site.seek(900); f.monitor.tick()
  f.clock.advance(7000); f.monitor.tick(); assert.equal(f.effects.fallbacks, 1)
  f.clock.advance(15000); f.monitor.tick(); assert.equal(f.effects.reloads, 1)
  assert.deepEqual(f.effects.reloadPositions, [900])
})

for (const outcome of ['fulfilled', 'rejected'] as const) {
  test(`BR-07 late reload ${outcome} cannot cancel the new keyup stall owner`, async t => {
    const f = rightOnKeyup(t), reload = deferred<void>()
    f.onReload(() => reload.promise)
    f.pointerSeek(900); f.clock.advance(15000); f.monitor.tick(); f.clock.advance(15000); f.monitor.tick()
    f.keyup(true); f.monitor.tick(); const before = f.recovery.snapshot()
    if (outcome === 'fulfilled') reload.resolve(); else reload.reject(new Error('old reload rejected'))
    await Promise.resolve(); await Promise.resolve()
    assert.equal(f.recovery.snapshot().state, before.state)
    assert.equal(f.recovery.snapshot().reason, before.reason)
    assert.equal(f.video.currentTime, 905)
  })

  test(`BR-07 late play ${outcome} cannot revive restoration after a new keyup seek`, async t => {
    const f = rightOnKeyup(t), play = deferred<void>()
    f.onPlay(() => play.promise)
    f.pointerSeek(900); f.clock.advance(15000); f.monitor.tick(); f.clock.advance(15000); f.monitor.tick()
    f.replaceCore(); f.video.seeking = false; f.patch({ readyState: 4 }); f.monitor.tick()
    assert.equal(f.recovery.snapshot().state, 'waiting')
    f.keyup(true); f.monitor.tick(); const before = f.recovery.snapshot()
    if (outcome === 'fulfilled') play.resolve(); else play.reject(new Error('old play rejected'))
    await Promise.resolve(); await Promise.resolve()
    assert.equal(f.recovery.snapshot().state, before.state)
    assert.equal(f.recovery.snapshot().reason, before.reason)
    assert.equal(f.video.currentTime, 905)
  })
}
