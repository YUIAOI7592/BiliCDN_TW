import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { getEventListeners } from 'node:events'
import { PlayerAdapter } from '../../../src-v2/adapters/player.ts'
import { RecoveryController } from '../../../src-v2/application/recovery-controller.ts'
import { FakeClock } from '../../support/clock.ts'
import { testScope } from '../../support/scope.ts'
import { playurlResult } from '../../support/playurl.ts'

function fixture(t: TestContext) {
  const scope = testScope(t),
    clock = scope.own(new FakeClock())
  class Element extends EventTarget {
    parentElement: Element | null = null
    constructor(readonly classes: readonly string[] = []) {
      super()
    }
    closest(selector: string): Element | null {
      for (let item: Element | null = this; item; item = item.parentElement)
        if (
          selector
            .split(',')
            .some((s) => s.trim().startsWith('.') && item!.classes.includes(s.trim().slice(1)))
        )
          return item
      return null
    }
    contains(target: unknown): boolean {
      for (let item = target instanceof Element ? target : null; item; item = item.parentElement)
        if (item === this) return true
      return false
    }
  }
  class Media extends Element {
    currentTime = 120
    paused = false
    seeking = false
    ended = false
    readyState = 4
    duration = 3910
    videoWidth = 1280
    videoHeight = 720
    playbackRate = 2
    frames = 100
    error: MediaError | null = null
    isConnected = true
    clientWidth = 1280
    clientHeight = 720
    buffered: TimeRanges = {
      length: 0,
      start() {
        throw new RangeError()
      },
      end() {
        throw new RangeError()
      },
    }
    getVideoPlaybackQuality(): VideoPlaybackQuality {
      return {
        creationTime: 0,
        droppedVideoFrames: 0,
        corruptedVideoFrames: 0,
        totalVideoFrames: this.frames,
      }
    }
  }
  const document = new EventTarget(),
    window = new EventTarget(),
    region = new Element(['bpx-player-container'])
  const button = new Element(['bpx-player-ctrl-play']),
    icon = new Element(),
    outside = new Element(['bpx-player-ctrl-play'])
  const video = new Media()
  video.parentElement = region
  button.parentElement = region
  icon.parentElement = button
  class ClickBoundary extends Event {
    constructor(
      readonly hit: EventTarget,
      readonly trusted: boolean,
    ) {
      super('click')
    }
    override get isTrusted(): boolean {
      return this.trusted
    }
    override get target(): EventTarget {
      return this.hit
    }
    override composedPath(): EventTarget[] {
      return [this.hit, document, window]
    }
  }
  let visible = true,
    lifecycle = 'one',
    currentVideo = video,
    activation = false,
    onVisibility = () => {}
  const core = { state: { initialized: true }, getMpd: () => ({ video: [{}] }) }
  const effects = { reloads: 0, plays: 0, seeks: [] as number[] }
  const site = {
    __core: () => core,
    getCurrentTime: () => video.currentTime,
    getPlaybackRate: () => video.playbackRate,
    play(..._args: unknown[]) {
      effects.plays++
      return 'sdk-result'
    },
    seek(value: number) {
      effects.seeks.push(value)
      video.currentTime = value
    },
    setPlaybackRate(value: number) {
      video.playbackRate = value
    },
    reload() {
      effects.reloads++
    },
  }
  for (const [name, value] of Object.entries({
    document,
    window,
    Node: Element,
    Element,
    HTMLElement: Element,
    location: new URL('https://www.bilibili.com/video/synthetic'),
    unsafeWindow: {
      player: site,
      navigator: {
        userActivation: {
          get isActive() {
            return activation
          },
        },
      },
    },
  }))
    scope.defineGlobal(name, { configurable: true, value })
  class Player extends PlayerAdapter {
    protected override player() {
      return site
    }
    override video(): HTMLVideoElement {
      return currentVideo as unknown as HTMLVideoElement
    }
  }
  const player = new Player(
    { transform: () => playurlResult(false), lifecycleKey: () => lifecycle },
    {
      scheduler: clock,
      isActuallyVisible: () => {
        onVisibility()
        return visible
      },
      subscribeControlLoss: () => () => undefined,
    },
  )
  scope.defer(() => player.reset())
  const recovery = scope.own(new RecoveryController(player, clock.now, () => visible))
  const tick = () => recovery.tick(player.snapshot())
  const advance = (ms: number) => {
    clock.advance(ms)
    tick()
  }
  tick()
  video.currentTime++
  video.frames += 30
  advance(1000)
  const pause = (dead = true) => {
    video.paused = true
    if (dead) {
      core.state.initialized = false
      video.readyState = 0
      video.videoWidth = 0
      video.videoHeight = 0
    }
    advance(1000)
  }
  const click = (target: EventTarget = icon, trusted = true) =>
    document.dispatchEvent(new ClickBoundary(target, trusted))
  return {
    player,
    recovery,
    video,
    site,
    effects,
    clock,
    advance,
    tick,
    pause,
    click,
    button,
    outside,
    scope,
    clickListenerCount: () => getEventListeners(document, 'click').length,
    visible: (value: boolean) => {
      visible = value
    },
    lifecycle: () => {
      lifecycle = 'two'
    },
    replaceVideo: () => {
      currentVideo = new Media()
      currentVideo.parentElement = region
    },
    onVisibility: (listener: () => void) => {
      onVisibility = listener
    },
    activation: (value: boolean) => {
      activation = value
    },
  }
}

test('BR-01 play intent: trusted play control reaches recovery when a dead SDK ignores the click', (t) => {
  const f = fixture(t)
  f.pause()
  f.advance(30_000)
  f.click()
  assert.equal(
    f.effects.plays,
    0,
    'the website ignores this click rather than calling its public SDK',
  )
  assert.equal(
    f.recovery.isRecovering(),
    true,
    'an explicit play command still grants the existing bounded recovery intent',
  )
  f.advance(3999)
  assert.equal(f.effects.reloads, 0)
  f.advance(1)
  assert.equal(f.effects.reloads, 1)
})

test('BR-01 play intent: no input and short pauses cannot create a recovery action', (t) => {
  const f = fixture(t)
  f.pause()
  f.advance(29_999)
  f.click()
  assert.equal(f.recovery.isRecovering(), false)
  f.advance(60_000)
  assert.equal(f.effects.reloads, 0)
})

test('BR-01 play intent: synthetic and outside play controls cannot grant an intent', (t) => {
  const f = fixture(t)
  f.pause()
  f.advance(30_000)
  f.click(f.button, false)
  f.click(f.outside)
  assert.equal(f.recovery.isRecovering(), false)
})

test('BR-01 play intent: an ordinary successful resume does not reload a healthy core', (t) => {
  const f = fixture(t)
  f.pause(false)
  f.advance(30_000)
  f.click()
  assert.equal(f.recovery.isRecovering(), true)
  f.video.paused = false
  for (let i = 0; i < 3; i++) {
    f.video.currentTime++
    f.video.frames += 30
    f.advance(1000)
  }
  assert.equal(f.recovery.snapshot().state, 'recovered')
  assert.equal(f.effects.reloads, 0)
})

test('BR-01 play intent: a control click while playing is not a request to resume', (t) => {
  const f = fixture(t)
  let calls = 0
  f.scope.defer(f.player.observePlayIntent(() => calls++))
  f.click()
  assert.equal(calls, 0)
})

test('BR-01 play intent: hidden, replaced media and old lifecycle clicks are ignored', (t) => {
  const f = fixture(t)
  f.pause()
  let calls = 0
  f.scope.defer(f.player.observePlayIntent(() => calls++))
  f.visible(false)
  f.click()
  f.visible(true)
  f.lifecycle()
  f.click()
  f.replaceVideo()
  f.click()
  assert.equal(calls, 0)
})

test('BR-01 play intent: disposal removes the UI observer and preserves a newer SDK wrapper', (t) => {
  const f = fixture(t)
  f.pause()
  let calls = 0
  const stop = f.player.observePlayIntent(() => calls++),
    newer = () => 'newer'
  f.site.play = newer
  stop()
  f.click()
  assert.equal(calls, 0)
  assert.equal(f.site.play, newer)
})

test('BR-01 play intent: SDK arguments receiver and result stay intact', (t) => {
  const f = fixture(t)
  const original = f.site.play
  const receiver = f.site
  const args: unknown[] = [{ token: 'synthetic' }, 0]
  let actualThis: unknown,
    actualArgs: unknown[] = []
  f.site.play = function (...values) {
    actualThis = this
    actualArgs = values
    return 'kept'
  }
  let calls = 0
  const stop = f.player.observePlayIntent(() => calls++)
  f.scope.defer(stop)
  f.activation(true)
  assert.equal(f.site.play(...args), 'kept')
  assert.equal(actualThis, receiver)
  assert.deepEqual(actualArgs, args)
  assert.equal(calls, 1)
  stop()
  f.site.play = original
})

test('BR-01 play intent: one click plus SDK forwarding cannot consume two reloads', (t) => {
  const f = fixture(t)
  f.pause()
  f.advance(30_000)
  f.activation(true)
  f.click()
  f.site.play()
  f.advance(4000)
  assert.equal(f.effects.reloads, 1)
  f.advance(15_000)
  assert.equal(f.recovery.isRecovering(), false)
  assert.equal(f.recovery.snapshot().reason, 'reload-timeout')
  f.advance(5000)
  assert.equal(f.effects.reloads, 1)
})

test('BR-01 play intent: current native zero is preserved for a new explicit command', (t) => {
  const f = fixture(t)
  let saved: number | null = null
  f.scope.defer(
    f.recovery.subscribe((event) => {
      if (event.type === 'recovery' && event.action.action === 'player-reload')
        saved = event.action.savedPositionSec
    }),
  )
  f.pause()
  f.video.currentTime = 0
  f.advance(30_000)
  f.click()
  f.advance(4000)
  assert.equal(f.effects.reloads, 1)
  assert.equal(saved, 0)
})

test('BR-01 play intent: synchronous cleanup during visibility read revokes the click', (t) => {
  const f = fixture(t)
  f.pause()
  let calls = 0
  const stop = f.player.observePlayIntent(() => calls++)
  f.scope.defer(stop)
  f.onVisibility(stop)
  f.click()
  assert.equal(calls, 0)
})

test('BR-01 play intent: reset invalidates an observer even when the same video remains', (t) => {
  const f = fixture(t)
  f.pause()
  let calls = 0
  f.scope.defer(f.player.observePlayIntent(() => calls++))
  f.player.reset()
  f.click()
  assert.equal(calls, 0)
})

test('BR-01 play intent: original SDK exceptions retain their identity', (t) => {
  const f = fixture(t)
  const error = new Error('synthetic SDK failure')
  f.site.play = () => {
    throw error
  }
  f.scope.defer(f.player.observePlayIntent(() => undefined))
  f.activation(true)
  assert.throws(
    () => f.site.play(),
    (thrown) => thrown === error,
  )
})

test('BR-01 play intent: repeated paused ticks retain one listener and reset removes it', (t) => {
  const f = fixture(t)
  f.pause()
  for (let i = 0; i < 100; i++) f.advance(1000)
  assert.equal(f.clickListenerCount(), 1)
  f.recovery.reset()
  assert.equal(f.clickListenerCount(), 0)
})
