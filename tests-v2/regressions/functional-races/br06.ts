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

// This typed event boundary models the actual Chrome input-keydown record:
// isTrusted=true, key=ArrowRight, target=BODY outside the player region.
// It does not claim that Node creates a trusted browser event.
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
  }
  for (const [name, value] of Object.entries({ document, window, Node: DomElement, Element: DomElement, HTMLElement: DomElement, KeyboardEvent: InputEvent }))
    scope.defineGlobal(name, { configurable: true, value })
  const effects = { fallbacks: 0, reloads: 0 }
  let frames = 100
  let seekEffect: (value: number) => unknown = value => {
    video.currentTime = value; video.seeking = true; video.dispatchEvent(new Event('seeking'))
  }
  let playEffect: () => unknown = () => undefined, reloadEffect: () => unknown = () => undefined
  const site = {
    __core: () => core,
    getCurrentTime: () => video.currentTime,
    getPlaybackRate: () => 1,
    seek(value: number): unknown { return seekEffect(value) },
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
    videoCount: 0, audioCount: 0, segmentCount: 0, upstreamCode: 0, reason: null }) }, { scheduler: clock, isActuallyVisible: () => visible })
  scope.defer(() => player.reset())
  const recovery = scope.own(new RecoveryController(player, clock.now, () => visible))
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
  const handleKey = (event: Event): void => { if (event instanceof InputEvent) keyEffect(event) }
  document.addEventListener('keydown', handleKey)
  scope.defer(() => document.removeEventListener('keydown', handleKey))
  const pointerSeek = (target: number): void => {
    document.dispatchEvent(new InputEvent('pointerdown', '', true, video)); site.seek(target); monitor.tick()
  }
  return { player, monitor, recovery, clock, effects, pointerSeek, video, body, site, window, document,
    visible: (value: boolean) => { visible = value }, lifecycle: (value: string) => { lifecycle = value },
    patch: (value: Partial<VideoSnapshot>) => { snapshotPatch = { ...snapshotPatch, ...value } },
    replaceVideo: () => { currentVideo = new DomElement() }, replaceOwner: () => { owner = { ...site } },
    replaceCore: () => { core = { state: { initialized: true } } },
    onKey: (value: (event: InputEvent) => void) => { keyEffect = value },
    onSeek: (value: (position: number) => unknown) => { seekEffect = value },
    onPlay: (value: () => unknown) => { playEffect = value }, onReload: (value: () => unknown) => { reloadEffect = value },
    key: (trusted: boolean, inPlayer = false, key = 'ArrowRight', options: ConstructorParameters<typeof InputEvent>[4] = {}) =>
      new InputEvent('keydown', key, trusted, inPlayer ? video : body, options).dispatch() }
}

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
  f.video.seeking = false; f.patch({ readyState: 4 }); f.monitor.tick()
  assert.equal(f.recovery.snapshot().state, 'waiting')
  f.key(true); f.monitor.tick(); const before = f.recovery.snapshot()
  play.reject(new Error('old play rejected')); await Promise.resolve(); await Promise.resolve()
  assert.equal(f.recovery.snapshot().state, before.state)
  assert.equal(f.recovery.snapshot().reason, before.reason)
  assert.equal(f.video.currentTime, 983)
})
