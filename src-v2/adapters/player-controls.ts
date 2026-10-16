import type { PlayerControlSnapshot, TimeoutSchedulerPort } from '../application/ports.ts'
import { safeCall } from './player-sdk.ts'
import type { UnknownRecord } from './player-sdk.ts'
import { observeMethod } from './player-method.ts'
import type { ResumePositionCapture } from '../application/recovery-ports.ts'
import { playbackTimeAdvanced, playbackFramesAdvanced } from '../domain/playback-progress.ts'

export interface PlayerControlEnvironment {
  readonly scheduler: TimeoutSchedulerPort
  readonly isActuallyVisible: () => boolean
  readonly subscribeControlLoss: (listener: () => void) => () => void
  readonly now?: () => number
}
interface ProgressDrag {
  readonly pointerId: number
  readonly video: HTMLVideoElement
  readonly player: UnknownRecord | null
  readonly lifecycle: string
  readonly position: number
}
interface PendingGoal {
  readonly proof: object
  readonly video: HTMLVideoElement
  readonly player: UnknownRecord | null
  readonly lifecycle: string
  readonly core: unknown
  readonly position: number
  userRevision: number
  completed: boolean
  baseline: { position: number; frames: number | null; at: number } | null
  progress: number
  initialization: { revision: number; seekRevision: number; position: number } | null
}
interface KeyboardSeek {
  readonly event: KeyboardEvent
  readonly video: HTMLVideoElement
  readonly player: UnknownRecord | null
  readonly lifecycle: string
  readonly position: number
  readonly core: unknown
  readonly revision: number
  stop: () => void
}
interface KeyboardPlayback {
  readonly event: KeyboardEvent
  readonly video: HTMLVideoElement
  readonly player: UnknownRecord | null
  readonly core: unknown
  readonly lifecycle: string
  readonly paused: boolean
  readonly rate: number
  readonly kind: 'pause' | 'rate'
  readonly revision: number
  stop: () => void
}
interface OwnedReload {
  readonly revision: number
  readonly video: HTMLVideoElement
  readonly player: UnknownRecord
  readonly lifecycle: string
  readonly userRevision: number
  readonly sourceCore: unknown
  replacement: unknown
  sawNull: boolean
  stable: boolean
  cancel: () => void
}
interface NativePosition {
  readonly video: HTMLVideoElement
  readonly player: UnknownRecord | null
  readonly lifecycle: string
  readonly position: number
  readonly readyState: number
}

interface ControlSources {
  video(): HTMLVideoElement | null
  player(): UnknownRecord | null
  lifecycleKey(): string
}

// One owner coordinates input revisions, observation and bounded reload proof.
export class PlayerControlObserver {
  #objects = new WeakMap<object, number>()
  #objectSerial = 0
  #seekRevision = 0
  #userRevision = 0
  #drag: ProgressDrag | null = null
  #pointerRevision = 0
  #targetSec: number | null = null
  #internalSeek = 0
  #pendingSeek: number | null = null
  #controlStops: (() => void)[] = []
  #controlVideo: HTMLVideoElement | null = null
  #seekOwner: UnknownRecord | null = null
  #reloadRevision = 0
  #coreReloadRevision = 0
  #internalReload = 0
  #reloadCore: unknown = null
  #awaitReloadCore = false
  #keyboardSeek: KeyboardSeek | null = null
  #keyboardPlayback: KeyboardPlayback | null = null
  #keyboardRevision = 0
  #ownedReload: OwnedReload | null = null
  #nativePosition: NativePosition | null = null
  #controlRevision = 0
  #goal: PendingGoal | null = null
  constructor(
    private readonly sources: ControlSources,
    private readonly environment: PlayerControlEnvironment,
  ) {}

  controls(): PlayerControlSnapshot {
    const reloadOwner = this.#ownedReload
    const video = this.sources.video(),
      player = this.sources.player(),
      core = safeCall(player, '__core')
    if (video !== this.#controlVideo || player !== this.#seekOwner)
      this.#observeControls(video, player)
    this.#validateDrag()
    this.#confirmKeyboardSeek()
    this.#confirmKeyboardPlayback()
    if (video) this.#observeNativePosition(video, player)
    if (
      video?.seeking &&
      Number.isFinite(video.currentTime) &&
      video.currentTime !== this.#targetSec
    ) {
      this.#targetSec = video.currentTime
      if (!this.#internalSeek && this.#pendingSeek !== video.currentTime) this.#seekRevision++
    }
    const identity = (object: unknown): number => {
      if (!object || (typeof object !== 'object' && typeof object !== 'function')) return 0
      let id = this.#objects.get(object)
      if (id === undefined) {
        id = ++this.#objectSerial
        this.#objects.set(object, id)
      }
      return id
    }
    if (reloadOwner) this.#validateOwnedReload(video, player, core, reloadOwner)
    else if (!this.#ownedReload && !this.#awaitReloadCore && core !== this.#reloadCore)
      this.#coreReloadRevision = 0
    this.#reloadCore = core
    return Object.freeze({
      mediaId: identity(video),
      coreId: identity(core),
      seekRevision: this.#seekRevision,
      userRevision: this.#userRevision,
      dragging: this.#drag !== null,
      targetSec: this.#targetSec,
      pendingSeekGoal: !!this.#goal && !this.#goal.completed,
      reloadRevision: this.#reloadRevision,
      coreReloadRevision: this.#coreReloadRevision,
    })
  }

  captureResumePosition(readCurrent: () => number): ResumePositionCapture {
    this.controls()
    const before = this.#goal
    const current = readCurrent()
    this.controls()
    const goal = this.#goal
    return Object.freeze(
      goal && goal === before && !goal.completed && this.#goalCurrent(goal)
        ? { positionSec: goal.position, proof: goal.proof }
        : { positionSec: current, proof: null },
    )
  }

  validateResumePosition(capture: ResumePositionCapture, initializationRevision?: number): boolean {
    this.controls()
    if (capture.proof === null) return initializationRevision === undefined
    const goal = this.#goal
    return (
      !!goal &&
      goal.proof === capture.proof &&
      goal.position === capture.positionSec &&
      this.#goalCurrent(goal) &&
      (initializationRevision === undefined ||
        goal.initialization?.revision === initializationRevision)
    )
  }

  #goalCurrent(goal: PendingGoal): boolean {
    const video = this.sources.video(),
      player = this.sources.player(),
      lifecycle = this.sources.lifecycleKey(),
      core = safeCall(player, '__core')
    const reload = this.#ownedReload
    if (reload) this.#validateOwnedReload(video, player, core, reload)
    return (
      this.#goal === goal &&
      goal.video === video &&
      goal.player === player &&
      goal.lifecycle === lifecycle &&
      goal.userRevision === this.#userRevision &&
      this.environment.isActuallyVisible() &&
      (core === goal.core ||
        (!!reload &&
          this.#ownedReload === reload &&
          (core === null || core === undefined || core === reload.replacement))) &&
      video === this.sources.video() &&
      player === this.sources.player() &&
      lifecycle === this.sources.lifecycleKey() &&
      this.#goal === goal &&
      goal.userRevision === this.#userRevision
    )
  }

  #setGoal(video: HTMLVideoElement, position: number): void {
    if (!Number.isFinite(position)) return
    const revision = this.#userRevision,
      controlRevision = this.#controlRevision
    const old = this.#goal
    if (
      old &&
      old.position === position &&
      old.video === video &&
      old.userRevision === this.#userRevision &&
      this.#goalCurrent(old)
    )
      return
    const player = this.sources.player(),
      lifecycle = this.sources.lifecycleKey(),
      core = safeCall(player, '__core')
    if (
      video !== this.sources.video() ||
      player !== this.sources.player() ||
      lifecycle !== this.sources.lifecycleKey() ||
      revision !== this.#userRevision ||
      controlRevision !== this.#controlRevision
    )
      return
    this.#goal = {
      proof: Object.freeze({}),
      video,
      player,
      lifecycle,
      core,
      position,
      userRevision: revision,
      completed: false,
      baseline: null,
      progress: 0,
      initialization: null,
    }
  }

  #pointerGoal(video: HTMLVideoElement): void {
    const drag = this.#drag,
      revision = this.#pointerRevision,
      position = video.currentTime
    if (
      drag &&
      drag.video === video &&
      drag.player === this.sources.player() &&
      drag.lifecycle === this.sources.lifecycleKey() &&
      this.environment.isActuallyVisible() &&
      Number.isFinite(position) &&
      position !== drag.position &&
      this.#drag === drag &&
      revision === this.#pointerRevision
    )
      this.#setGoal(video, position)
  }

  #initializationSeek(position: number): boolean {
    const goal = this.#goal,
      reload = this.#ownedReload
    if (
      !goal ||
      goal.completed ||
      !Number.isFinite(position) ||
      !reload ||
      reload.stable ||
      goal.initialization ||
      !this.#goalCurrent(goal) ||
      (!this.#internalReload && !reload.replacement)
    )
      return false
    goal.initialization = { revision: reload.revision, seekRevision: this.#seekRevision, position }
    goal.baseline = null
    goal.progress = 0
    return true
  }

  #sampleGoal(video: HTMLVideoElement, position: number): void {
    const goal = this.#goal
    if (!goal) return
    if (!this.#goalCurrent(goal)) {
      if (this.#goal === goal) this.#goal = null
      return
    }
    if (goal.completed || video.readyState < 2 || video.seeking || video.ended || video.error)
      return
    const reload = this.#ownedReload
    if (reload?.replacement && !video.paused) reload.stable = true
    let frames: number | null = null
    try {
      const value = video.getVideoPlaybackQuality?.().totalVideoFrames
      if (typeof value === 'number' && Number.isFinite(value)) frames = value
    } catch {
      /* Missing frame information keeps the existing time-only policy. */
    }
    const at = this.environment.now?.() ?? Date.now(),
      before = goal.baseline
    if (this.#goal !== goal || !this.#goalCurrent(goal)) return
    if (!before) {
      if (Math.abs(position - goal.position) <= 1) goal.baseline = { position, frames, at }
      else if (position !== goal.initialization?.position && this.#goal === goal) this.#goal = null
      return
    }
    if (at <= before.at) return
    const delta = position - before.position,
      maxAdvance = Math.max(1, (Math.max(0, video.playbackRate) * (at - before.at)) / 1000 + 1)
    const progress =
      !video.paused &&
      playbackTimeAdvanced(position, before.position) &&
      (frames === null || (before.frames !== null && playbackFramesAdvanced(frames, before.frames)))
    if (this.#goal !== goal || !this.#goalCurrent(goal)) return
    if (delta < 0 || delta > maxAdvance) {
      this.#goal = null
      return
    }
    goal.progress = progress ? goal.progress + 1 : 0
    goal.baseline = { position, frames, at }
    if (goal.progress >= 2) goal.completed = true
  }

  #observeNativePosition(
    video: HTMLVideoElement,
    player: UnknownRecord | null,
    knownReloadZero = false,
  ): void {
    const before = this.#nativePosition,
      revision = this.#controlRevision
    const seekRevision = this.#seekRevision,
      userRevision = this.#userRevision,
      pendingSeek = this.#pendingSeek
    const lifecycle = this.sources.lifecycleKey(),
      position = video.currentTime,
      readyState = video.readyState
    const currentVideo = this.sources.video(),
      currentPlayer = this.sources.player(),
      currentLifecycle = this.sources.lifecycleKey()
    if (
      revision !== this.#controlRevision ||
      this.#nativePosition !== before ||
      video !== this.#controlVideo ||
      player !== this.#seekOwner ||
      currentVideo !== video ||
      currentPlayer !== player ||
      lifecycle !== currentLifecycle ||
      seekRevision !== this.#seekRevision ||
      userRevision !== this.#userRevision ||
      pendingSeek !== this.#pendingSeek ||
      !Number.isFinite(position)
    )
      return
    this.#nativePosition = { video, player, lifecycle, position, readyState }
    this.#pointerGoal(video)
    this.#sampleGoal(video, position)
    if (
      !before ||
      before.video !== video ||
      before.player !== player ||
      before.lifecycle !== lifecycle ||
      readyState !== 0 ||
      before.position === position
    )
      return
    const owner = this.#ownedReload
    // Native load() resets to zero without seeking. Only this call's initial
    // reset is exempt; an observed later target (including zero) revokes restore.
    const initialReloadZero =
      position === 0 &&
      owner?.video === video &&
      owner.player === player &&
      owner.lifecycle === lifecycle &&
      (knownReloadZero || (this.#internalReload > 0 && before.readyState !== 0))
    if (initialReloadZero) return
    const goal = this.#goal
    if (
      goal &&
      position !== goal.position &&
      !(position === 0 && before.readyState !== 0 && !this.#ownedReload) &&
      position !== goal.initialization?.position
    )
      this.#goal = null
    const alreadyObserved = this.#targetSec === position
    this.#targetSec = position
    if (!this.#internalSeek && position !== this.#pendingSeek) {
      this.#pendingSeek = null
      if (!alreadyObserved) this.#seekRevision++
    }
  }

  #observeControls(video: HTMLVideoElement | null, player: UnknownRecord | null): void {
    this.#clearControls()
    this.#controlVideo = video
    this.#seekOwner = player
    if (!video) return
    const region = video.closest('.bpx-player-container, .bilibili-player') ?? video.parentElement
    const inRegion = (event: Event): boolean =>
      event.target instanceof Node && !!region?.contains(event.target)
    this.#bindPointerControls(video, player, region, inRegion)
    this.#bindControlLoss()
    this.#bindKeyboardControls(video, player, inRegion)
    this.#bindMediaControls(video)
    this.#bindSdkControls(player)
  }

  #listen(target: EventTarget, type: string, listener: EventListener): void {
    target.addEventListener(type, listener, true)
    this.#controlStops.push(() => target.removeEventListener(type, listener, true))
  }

  #bindPointerControls(
    video: HTMLVideoElement,
    player: UnknownRecord | null,
    region: Element | null,
    inRegion: (event: Event) => boolean,
  ): void {
    this.#listen(document, 'pointerdown', (event) => {
      if (!event.isTrusted) return
      const revision = ++this.#pointerRevision
      if (
        !this.environment.isActuallyVisible() ||
        !inRegion(event) ||
        revision !== this.#pointerRevision
      )
        return
      this.#clearKeyboardSeek()
      this.#clearKeyboardPlayback()
      const playTarget =
        event.target instanceof Element && event.target.closest('.bpx-player-ctrl-play')
      if (!this.#advanceUser(!!playTarget && video.paused)) return
      const lifecycle = this.sources.lifecycleKey()
      const hit =
        event.target instanceof Element
          ? event.target.closest(
              '.bpx-player-progress-wrap, .bpx-player-progress, .bilibili-player-video-progress, [role="slider"]',
            )
          : null
      if (
        !hit ||
        !region?.contains(hit) ||
        typeof PointerEvent !== 'function' ||
        !(event instanceof PointerEvent)
      )
        return
      const pointerId = event.pointerId
      if (!Number.isInteger(pointerId)) return
      const current =
        video === this.sources.video() &&
        player === this.sources.player() &&
        lifecycle === this.sources.lifecycleKey() &&
        this.environment.isActuallyVisible()
      if (
        !current ||
        video !== this.#controlVideo ||
        player !== this.#seekOwner ||
        revision !== this.#pointerRevision
      )
        return
      this.#drag = { pointerId, video, player, lifecycle, position: video.currentTime }
    })
    const release: EventListener = (event) => {
      const drag = this.#drag
      if (
        !drag ||
        !event.isTrusted ||
        typeof PointerEvent !== 'function' ||
        !(event instanceof PointerEvent) ||
        event.pointerId !== drag.pointerId
      )
        return
      if (this.#drag === drag) {
        this.#pointerGoal(video)
        this.#drag = null
        this.#pointerRevision++
      }
    }
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
      this.#listen(document, type, release)
  }

  #bindControlLoss(): void {
    const controlLoss = (): void => {
      this.#drag = null
      this.#pointerRevision++
      this.#clearKeyboardSeek()
      this.#clearKeyboardPlayback()
      this.#clearOwnedReload()
      this.#goal = null
    }
    this.#listen(window, 'blur', (event) => {
      if (event.isTrusted) controlLoss()
    })
    this.#controlStops.push(this.environment.subscribeControlLoss(controlLoss))
  }

  #bindKeyboardControls(
    video: HTMLVideoElement,
    player: UnknownRecord | null,
    inRegion: (event: Event) => boolean,
  ): void {
    const observeKeyboard: EventListener = (event) => {
      const revision = ++this.#keyboardRevision
      this.#clearKeyboardSeek()
      this.#clearKeyboardPlayback()
      if (
        !(event instanceof KeyboardEvent) ||
        !event.isTrusted ||
        event.isComposing ||
        event.keyCode === 229 ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        !this.environment.isActuallyVisible()
      )
        return
      const editable = (target: EventTarget): boolean =>
        target instanceof Element &&
        (!!target.closest(
          'input, textarea, select, [role="textbox"], #bilicdn-v2-control-center',
        ) ||
          (target instanceof HTMLElement && target.isContentEditable))
      if (event.composedPath().some(editable) || (event.target && editable(event.target))) return
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'j', 'J', 'l', 'L'].includes(event.key)) {
        this.#beginKeyboardSeek(event, video, player, revision)
      } else if (
        event.type === 'keydown' &&
        ['ArrowUp', 'ArrowDown', ' ', 'k', 'K'].includes(event.key)
      ) {
        const inside = inRegion(event)
        if (revision !== this.#keyboardRevision) return
        if (inside) this.#advanceUser(video.paused && [' ', 'k', 'K'].includes(event.key))
        else this.#beginKeyboardPlayback(event, video, player, revision)
      }
    }
    for (const type of ['keydown', 'keyup']) this.#listen(document, type, observeKeyboard)
  }

  #bindMediaControls(video: HTMLVideoElement): void {
    this.#listen(video, 'seeking', () => {
      const position = Number.isFinite(video.currentTime) ? video.currentTime : null
      if (!this.#internalSeek && position !== this.#pendingSeek) this.#seekRevision++
      this.#targetSec = position
      this.#confirmKeyboardSeek()
      this.#pointerGoal(video)
      const goal = this.#goal
      if (
        !this.#internalSeek &&
        goal &&
        position !== goal.position &&
        position !== goal.initialization?.position
      )
        this.#goal = null
    })
    this.#listen(video, 'seeked', () => {
      this.#pendingSeek = null
      this.#sampleGoal(video, video.currentTime)
    })
  }

  #bindSdkControls(player: UnknownRecord | null): void {
    const original = player?.seek,
      observer = this
    const reload = player?.reload
    if (player && typeof reload === 'function') {
      const wrapped = function (this: unknown, ...args: unknown[]): unknown {
        if (!observer.#internalReload) {
          observer.#seekRevision++
          observer.#clearOwnedReload()
          observer.#goal = null
        }
        return Reflect.apply(reload, this, args)
      }
      try {
        this.#controlStops.push(observeMethod(player, 'reload', reload, wrapped))
      } catch {
        /* core identity still revokes unmarked replacements */
      }
    }
    if (player && typeof original === 'function') {
      const wrapped = function (this: unknown, ...args: unknown[]): unknown {
        if (!observer.#internalSeek) {
          observer.#seekRevision++
          observer.#pendingSeek = null
          observer.#targetSec =
            typeof args[0] === 'number' && Number.isFinite(args[0]) ? Math.max(0, args[0]) : null
          if (!observer.#initializationSeek(observer.#targetSec ?? NaN)) observer.#goal = null
        }
        try {
          return Reflect.apply(original, this, args)
        } finally {
          observer.#confirmKeyboardSeek()
          const video = observer.sources.video()
          if (video) observer.#pointerGoal(video)
        }
      }
      try {
        this.#controlStops.push(observeMethod(player, 'seek', original, wrapped))
      } catch {
        /* observation through media events remains available */
      }
    }
  }

  #beginKeyboardSeek(
    event: KeyboardEvent,
    video: HTMLVideoElement,
    player: UnknownRecord | null,
    revision: number,
  ): void {
    const position = video.currentTime,
      core = safeCall(player, '__core'),
      lifecycle = this.sources.lifecycleKey()
    if (
      !Number.isFinite(position) ||
      revision !== this.#keyboardRevision ||
      video !== this.#controlVideo ||
      player !== this.#seekOwner
    )
      return
    const candidate: KeyboardSeek = {
      event,
      video,
      player,
      lifecycle: this.sources.lifecycleKey(),
      position,
      core,
      revision,
      stop: () => undefined,
    }
    if (lifecycle !== candidate.lifecycle || revision !== this.#keyboardRevision) return
    this.#keyboardSeek = candidate
    // A late bubble observer covers direct currentTime writes without wrapping media accessors.
    const type = event.type
    const finish = (observed: Event): void => {
      if (observed === event && this.#keyboardSeek === candidate) this.#confirmKeyboardSeek()
    }
    window.addEventListener(type, finish)
    const cancel = this.environment.scheduler.timeout(() => {
      if (this.#keyboardSeek === candidate) this.#clearKeyboardSeek()
    }, 0)
    candidate.stop = () => {
      cancel()
      window.removeEventListener(type, finish)
    }
  }

  #confirmKeyboardSeek(): void {
    const candidate = this.#keyboardSeek
    if (!candidate) return
    try {
      // A timer only releases references. Dispatch ownership, not elapsed time, grants attribution.
      if (
        candidate.event.eventPhase === Event.NONE ||
        candidate.revision !== this.#keyboardRevision ||
        candidate.video !== this.#controlVideo ||
        candidate.player !== this.#seekOwner ||
        candidate.video !== this.sources.video() ||
        candidate.player !== this.sources.player() ||
        candidate.lifecycle !== this.sources.lifecycleKey() ||
        !this.environment.isActuallyVisible()
      ) {
        if (this.#keyboardSeek === candidate) this.#clearKeyboardSeek()
        return
      }
      const position = candidate.video.currentTime,
        seeking = candidate.video.seeking,
        readyState = candidate.video.readyState
      const core = safeCall(candidate.player, '__core')
      // HAVE_NOTHING stores a finite seek target without emitting seeking.
      // Only the same trusted dispatch and unchanged core can attribute that
      // target; playback increments and SDK reload resets are not user seeks.
      const actualSeek =
        seeking || (readyState === 0 && core === candidate.core && !this.#internalReload)
      if (this.#keyboardSeek !== candidate || candidate.revision !== this.#keyboardRevision) return
      if (
        candidate.event.eventPhase === Event.NONE ||
        candidate.video !== this.#controlVideo ||
        candidate.player !== this.#seekOwner ||
        candidate.video !== this.sources.video() ||
        candidate.player !== this.sources.player() ||
        candidate.lifecycle !== this.sources.lifecycleKey() ||
        !this.environment.isActuallyVisible()
      ) {
        if (this.#keyboardSeek === candidate) this.#clearKeyboardSeek()
        return
      }
      if (
        this.#keyboardSeek !== candidate ||
        candidate.revision !== this.#keyboardRevision ||
        this.#internalSeek ||
        !actualSeek ||
        !Number.isFinite(position) ||
        position === candidate.position ||
        position === this.#pendingSeek
      )
        return
      if (this.#targetSec !== position) this.#seekRevision++
      this.#targetSec = position
      if (!this.#advanceUser()) return
      this.#setGoal(candidate.video, position)
      this.#clearKeyboardSeek()
    } catch {
      if (this.#keyboardSeek === candidate) this.#clearKeyboardSeek()
    }
  }

  #clearKeyboardSeek(): void {
    const candidate = this.#keyboardSeek
    this.#keyboardSeek = null
    candidate?.stop()
  }

  #beginKeyboardPlayback(
    event: KeyboardEvent,
    video: HTMLVideoElement,
    player: UnknownRecord | null,
    revision: number,
  ): void {
    const candidate: KeyboardPlayback = {
      event,
      video,
      player,
      core: safeCall(player, '__core'),
      lifecycle: this.sources.lifecycleKey(),
      paused: video.paused,
      rate: video.playbackRate,
      kind: [' ', 'k', 'K'].includes(event.key) ? 'pause' : 'rate',
      revision,
      stop: () => undefined,
    }
    if (
      revision !== this.#keyboardRevision ||
      video !== this.#controlVideo ||
      player !== this.#seekOwner
    )
      return
    this.#keyboardPlayback = candidate
    const finish = (observed: Event): void => {
      if (observed === event && this.#keyboardPlayback === candidate)
        this.#confirmKeyboardPlayback()
    }
    window.addEventListener(event.type, finish)
    const cancel = this.environment.scheduler.timeout(() => {
      if (this.#keyboardPlayback === candidate) this.#clearKeyboardPlayback()
    }, 0)
    candidate.stop = () => {
      cancel()
      window.removeEventListener(event.type, finish)
    }
  }

  #confirmKeyboardPlayback(): void {
    const candidate = this.#keyboardPlayback
    if (!candidate) return
    try {
      const eligible =
        candidate.event.eventPhase !== Event.NONE &&
        candidate.revision === this.#keyboardRevision &&
        candidate.video === this.#controlVideo &&
        candidate.player === this.#seekOwner &&
        candidate.video === this.sources.video() &&
        candidate.player === this.sources.player() &&
        candidate.core === safeCall(candidate.player, '__core') &&
        candidate.lifecycle === this.sources.lifecycleKey() &&
        this.environment.isActuallyVisible()
      const changed =
        candidate.kind === 'pause'
          ? candidate.video.paused !== candidate.paused
          : Number.isFinite(candidate.video.playbackRate) &&
            candidate.video.playbackRate !== candidate.rate
      if (this.#keyboardPlayback !== candidate || candidate.revision !== this.#keyboardRevision)
        return
      if (!eligible) {
        this.#clearKeyboardPlayback()
        return
      }
      if (changed) {
        this.#advanceUser(candidate.kind === 'pause' && candidate.paused)
        this.#clearKeyboardPlayback()
      }
    } catch {
      if (this.#keyboardPlayback === candidate) this.#clearKeyboardPlayback()
    }
  }

  #clearKeyboardPlayback(): void {
    const candidate = this.#keyboardPlayback
    this.#keyboardPlayback = null
    candidate?.stop()
  }

  #advanceUser(keepGoal = false): boolean {
    const goal = this.#goal,
      revision = this.#userRevision
    const valid = keepGoal && !!goal && !goal.completed && this.#goalCurrent(goal)
    if (revision !== this.#userRevision) return false
    this.#userRevision++
    this.#clearOwnedReload()
    if (valid && this.#goal === goal) goal.userRevision = this.#userRevision
    else this.#goal = null
    return true
  }

  #clearOwnedReload(): void {
    const owner = this.#ownedReload
    this.#ownedReload = null
    this.#awaitReloadCore = false
    this.#coreReloadRevision = 0
    owner?.cancel()
  }

  #validateOwnedReload(
    video: HTMLVideoElement | null,
    player: UnknownRecord | null,
    core: unknown,
    owner: OwnedReload,
  ): void {
    if (this.#ownedReload !== owner) return
    const valid =
      video === owner.video &&
      player === owner.player &&
      owner.revision === this.#reloadRevision &&
      owner.lifecycle === this.sources.lifecycleKey() &&
      owner.userRevision === this.#userRevision &&
      this.environment.isActuallyVisible()
    if (this.#ownedReload !== owner) return
    if (!valid) {
      this.#clearOwnedReload()
      return
    }
    if (owner.replacement) {
      if (core !== owner.replacement) this.#clearOwnedReload()
      return
    }
    if (!core) {
      owner.sawNull = true
      return
    }
    if (core === owner.sourceCore) {
      if (owner.sawNull) this.#clearOwnedReload()
      return
    }
    owner.replacement = core
    this.#coreReloadRevision = owner.revision
    this.#awaitReloadCore = false
  }

  ownedReload(revision: number): boolean {
    this.#confirmKeyboardPlayback()
    const owner = this.#ownedReload
    if (!owner || owner.revision !== revision) return false
    this.#validateOwnedReload(
      this.sources.video(),
      this.sources.player(),
      safeCall(owner.player, '__core'),
      owner,
    )
    return this.#ownedReload === owner
  }

  #validateDrag(): void {
    const drag = this.#drag
    if (!drag) return
    if (
      drag.video !== this.#controlVideo ||
      drag.player !== this.#seekOwner ||
      drag.video !== this.sources.video() ||
      drag.player !== this.sources.player() ||
      drag.lifecycle !== this.sources.lifecycleKey() ||
      !this.environment.isActuallyVisible()
    ) {
      if (this.#drag === drag) {
        this.#drag = null
        this.#pointerRevision++
      }
    }
  }

  #clearControls(): void {
    this.#goal = null
    this.#controlRevision++
    this.#nativePosition = null
    this.#clearKeyboardSeek()
    this.#clearKeyboardPlayback()
    this.#keyboardRevision++
    this.#clearOwnedReload()
    for (const stop of this.#controlStops.splice(0).reverse()) stop()
    this.#controlVideo = null
    this.#seekOwner = null
    this.#drag = null
    this.#pointerRevision++
    this.#pendingSeek = null
  }

  observePlayIntent(listener: () => void): () => void {
    const target = this.sources.player(),
      original = target?.play
    let stopped = false
    const stops: (() => void)[] = []
    if (target && typeof original === 'function') {
      const wrapped = function (this: unknown, ...args: unknown[]): unknown {
        let active = false
        try {
          active = unsafeWindow.navigator.userActivation?.isActive === true
        } catch {
          /* unsupported */
        }
        if (!stopped && active) listener()
        return Reflect.apply(original, this, args)
      }
      try {
        stops.push(observeMethod(target, 'play', original, wrapped))
      } catch {
        /* UI observation remains available */
      }
    }
    // An uninitialized website core can ignore its own play button without
    // calling the public SDK method. The trusted control still expresses play
    // intent; the controller retains all pause, route, quota and deadline checks.
    try {
      const video = this.sources.video(),
        lifecycle = this.sources.lifecycleKey()
      const region =
        video?.closest('.bpx-player-container, .bilibili-player') ?? video?.parentElement
      const controlRevision = this.#controlRevision
      if (video && target && region) {
        const ownerDocument = document
        const click = (event: Event): void => {
          if (stopped || !event.isTrusted || !(event.target instanceof Element)) return
          const userRevision = this.#userRevision
          const button = event.target.closest('.bpx-player-ctrl-play')
          if (
            !button ||
            !region.contains(button) ||
            !this.environment.isActuallyVisible() ||
            video !== this.sources.video() ||
            target !== this.sources.player() ||
            lifecycle !== this.sources.lifecycleKey() ||
            !video.paused ||
            video.ended ||
            video.error
          )
            return
          // DOM/SDK reads may reenter cleanup or replace the observed owner.
          if (
            stopped ||
            controlRevision !== this.#controlRevision ||
            userRevision !== this.#userRevision ||
            video !== this.sources.video() ||
            target !== this.sources.player() ||
            lifecycle !== this.sources.lifecycleKey() ||
            !this.environment.isActuallyVisible() ||
            lifecycle !== this.sources.lifecycleKey() ||
            stopped ||
            controlRevision !== this.#controlRevision ||
            userRevision !== this.#userRevision
          )
            return
          listener()
        }
        ownerDocument.addEventListener('click', click, { capture: true })
        stops.push(() => ownerDocument.removeEventListener('click', click, { capture: true }))
      }
    } catch {
      /* A missing DOM does not remove the existing SDK observer. */
    }
    return () => {
      if (!stopped) {
        stopped = true
        for (const stop of stops.reverse()) stop()
      }
    }
  }

  reload(): unknown {
    this.#clearKeyboardPlayback()
    const userRevision = this.#userRevision,
      beforeRevision = this.#reloadRevision
    const player = this.sources.player(),
      video = this.sources.video(),
      lifecycle = this.sources.lifecycleKey()
    const sourceCore = safeCall(player, '__core'),
      reload = player?.reload
    if (!player || typeof reload !== 'function') throw new Error('player.reload unavailable')
    const currentPlayer = this.sources.player(),
      currentVideo = this.sources.video(),
      currentCore = safeCall(player, '__core')
    const visible = this.environment.isActuallyVisible(),
      currentLifecycle = this.sources.lifecycleKey()
    if (
      userRevision !== this.#userRevision ||
      beforeRevision !== this.#reloadRevision ||
      currentPlayer !== player ||
      currentVideo !== video ||
      currentCore !== sourceCore ||
      currentLifecycle !== lifecycle ||
      !visible
    ) {
      throw new Error('player.reload ownership ended')
    }
    this.#clearOwnedReload()
    this.#reloadCore = sourceCore
    const revision = ++this.#reloadRevision
    const owner: OwnedReload | null = video
      ? {
          revision,
          video,
          player,
          lifecycle,
          userRevision,
          sourceCore: this.#reloadCore,
          replacement: null,
          sawNull: false,
          stable: false,
          cancel: () => undefined,
        }
      : null
    this.#ownedReload = owner
    this.#awaitReloadCore = owner !== null
    if (owner)
      owner.cancel = this.environment.scheduler.timeout(() => {
        if (this.#ownedReload === owner) this.#clearOwnedReload()
      }, 15_000)
    if (
      this.#ownedReload !== owner ||
      this.#reloadRevision !== revision ||
      this.#userRevision !== userRevision
    ) {
      if (this.#ownedReload === owner) this.#clearOwnedReload()
      throw new Error('player.reload ownership ended')
    }
    this.#internalReload++
    const beforePosition = this.#nativePosition
    try {
      const result: unknown = Reflect.apply(reload, player, [])
      if (result && (typeof result === 'object' || typeof result === 'function'))
        void Promise.resolve(result).catch(() => {
          if (this.#ownedReload === owner) this.#clearOwnedReload()
        })
      return result
    } catch (error) {
      if (this.#ownedReload === owner) this.#clearOwnedReload()
      throw error
    } finally {
      try {
        if (video && this.#ownedReload === owner)
          this.#observeNativePosition(video, player, this.#nativePosition === beforePosition)
      } catch {
        // An observation failure must not replace the SDK's result/exception
        // or retain our method-source marker. The saved position is uncertain.
        if (this.#ownedReload === owner) this.#seekRevision++
      } finally {
        this.#internalReload--
      }
    }
  }

  seek(value: number): void {
    this.#clearKeyboardSeek()
    this.#clearKeyboardPlayback()
    this.#internalSeek++
    this.#pendingSeek = value
    try {
      const player = this.sources.player(),
        method = player?.seek
      if (player && typeof method === 'function') {
        Reflect.apply(method, player, [value])
        return
      }
      const video = this.sources.video()
      if (video) video.currentTime = value
    } finally {
      this.#internalSeek--
    }
  }

  setRate(value: number): void {
    this.#clearKeyboardPlayback()
    const player = this.sources.player(),
      method = player?.setPlaybackRate
    if (player && typeof method === 'function') {
      try {
        Reflect.apply(method, player, [value])
        return
      } catch {
        /* fallback */
      }
    }
    const video = this.sources.video()
    if (video) video.playbackRate = value
  }

  play(): unknown {
    this.#clearKeyboardPlayback()
    const player = this.sources.player()
    if (!player || typeof player.play !== 'function') throw new Error('player.play unavailable')
    return Reflect.apply(player.play, player, [])
  }

  reset(): void {
    this.#clearControls()
    this.#awaitReloadCore = false
    this.#coreReloadRevision = 0
    this.#seekRevision++
    this.#userRevision++
    this.#targetSec = null
  }
}
