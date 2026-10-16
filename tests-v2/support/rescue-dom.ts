import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { getEventListeners } from 'node:events'
import { FakeClock } from './clock.ts'
import { testScope } from './scope.ts'
import type {
  PlayerControlObserver,
  PlayerControlEnvironment,
} from '../../src-v2/adapters/player-controls.ts'
export function rescueDomFixture(t: TestContext) {
  const scope = testScope(t),
    clock = new FakeClock(),
    targets: Target[] = []
  class Target extends EventTarget {
    types = new Set<string>()
    override addEventListener(
      type: string,
      callback: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) {
      this.types.add(type)
      super.addEventListener(type, callback, options)
    }
    override removeEventListener(
      type: string,
      callback: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions,
    ) {
      super.removeEventListener(
        type,
        callback,
        typeof options === 'boolean' ? { capture: options } : options,
      )
    }
    constructor() {
      super()
      targets.push(this)
    }
  }
  class Element extends Target {
    parentElement: Element | null = null
    isContentEditable = false
    constructor(readonly labels: readonly string[] = []) {
      super()
    }
    contains(target: unknown): boolean {
      for (let p = target instanceof Element ? target : null; p; p = p.parentElement)
        if (p === this) return true
      return false
    }
    closest(selectors: string): Element | null {
      for (let p: Element | null = this; p; p = p.parentElement)
        if (selectors.split(',').some((s) => p!.labels.includes(s.trim()))) return p
      return null
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
    playbackRate = 1
    frames = 100
    error: MediaError | null = null
    isConnected = true
    clientWidth = 1280
    clientHeight = 720
    buffered: TimeRanges = {
      length: 0,
      start() {
        throw Error('empty')
      },
      end() {
        throw Error('empty')
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
  const document = new Target(),
    window = new Target(),
    region = new Element(['.bpx-player-container']),
    body = new Element(),
    button = new Element(['.bpx-player-ctrl-play'])
  let video = new Media(),
    lifecycle = 'one',
    visible = true,
    loss: (() => void) | null = null
  video.parentElement = region
  button.parentElement = region
  const originalCore = { state: { initialized: true }, getMpd: () => ({ video: [{}] }) }
  let core: unknown = originalCore
  const effects: { method: string; args: unknown[]; receiver: unknown }[] = []
  const returns = {
    seek: (): unknown => undefined,
    reload: (): unknown => undefined,
    play: (): unknown => undefined,
  }
  const site = {
    __core: () => core,
    getCurrentTime: () => video.currentTime,
    getPlaybackRate: () => video.playbackRate,
    seek(this: unknown, ...args: unknown[]) {
      effects.push({ method: 'seek', args, receiver: this })
      if (typeof args[0] === 'number') video.currentTime = args[0]
      return returns.seek()
    },
    reload(this: unknown, ...args: unknown[]) {
      effects.push({ method: 'reload', args, receiver: this })
      return returns.reload()
    },
    play(this: unknown, ...args: unknown[]) {
      effects.push({ method: 'play', args, receiver: this })
      return returns.play()
    },
    setPlaybackRate(value: number) {
      effects.push({ method: 'rate', args: [value], receiver: this })
      video.playbackRate = value
    },
  }
  class Input extends Event {
    active = true
    key = 'ArrowRight'
    keyCode = 39
    isComposing = false
    ctrlKey = false
    metaKey = false
    altKey = false
    pointerId = 1
    constructor(
      type: string,
      readonly hit: Element = body,
      readonly trusted = true,
    ) {
      super(type)
    }
    override get isTrusted() {
      return this.trusted
    }
    override get target() {
      return this.hit
    }
    override get eventPhase() {
      return this.active ? Event.AT_TARGET : Event.NONE
    }
    override composedPath(): EventTarget[] {
      return [this.hit, document, window]
    }
  }
  for (const [key, value] of Object.entries({
    document,
    window,
    Node: Element,
    Element,
    HTMLElement: Element,
    KeyboardEvent: Input,
    PointerEvent: Input,
    location: new URL('https://www.bilibili.com/video/synthetic'),
    unsafeWindow: { player: site, navigator: { userActivation: { isActive: false } } },
  }))
    scope.defineGlobal(key, { configurable: true, value })
  scope.defer(() => clock.dispose())
  const sources = {
    video: () => video as unknown as HTMLVideoElement,
    player: () => site,
    lifecycleKey: () => lifecycle,
  } satisfies ConstructorParameters<typeof PlayerControlObserver>[0]
  const environment = {
    scheduler: clock,
    now: clock.now,
    isActuallyVisible: () => visible,
    subscribeControlLoss: (fn: () => void) => {
      loss = fn
      return () => {
        if (loss === fn) loss = null
      }
    },
  } satisfies PlayerControlEnvironment
  const dispatch = (event: Input, action = () => {}) => {
    document.dispatchEvent(event)
    action()
    window.dispatchEvent(event)
    event.active = false
  }
  const key = (target: number, options: Partial<Input> = {}, action?: () => void) => {
    const e = new Input('keyup')
    Object.assign(e, options)
    dispatch(
      e,
      action ??
        (() => {
          site.seek(target)
          video.seeking = true
          video.dispatchEvent(new Event('seeking'))
        }),
    )
    return e
  }
  const check = () => {
    assert.equal(clock.pendingCount, 0)
    assert.equal(loss, null)
    for (const target of targets)
      for (const type of target.types)
        assert.equal(getEventListeners(target, type).length, 0, 'listener ' + type)
  }
  return {
    scope,
    clock,
    document,
    window,
    region,
    body,
    button,
    Element,
    Input,
    sources,
    environment,
    site,
    returns,
    effects,
    originalCore,
    dispatch,
    key,
    check,
    video: () => video,
    core: (value: unknown) => {
      core = value
    },
    visible: (v: boolean) => {
      visible = v
    },
    lifecycle: () => {
      lifecycle = 'two'
    },
    loss: () => loss?.(),
    replaceVideo: () => {
      video = new Media()
      video.parentElement = region
    },
    pointer: () => document.dispatchEvent(new Input('pointerdown', region)),
    click: () => document.dispatchEvent(new Input('click', button)),
  }
}
