import {
  PlayerInputBindings,
  isControlKeyboard,
  isEditableTarget,
  progressPointerId,
} from './input-bindings.ts'
import { type PlayerControlSnapshot } from '../../application/playback/player-contracts.ts'
import { type TimeoutSchedulerPort } from '../../application/scheduler-contracts.ts'
import { safeCall, type UnknownRecord, observeMethod } from './player-sdk.ts'
import {
  type ResumePositionCapture,
  type RestoreCommand,
  type RestoreGuard,
  type RestoreAttempt,
  type RestoreReadback,
  type RestoreReadMode,
} from '../../application/playback/recovery-contracts.ts'
import { playbackTimeAdvanced, playbackFramesAdvanced } from '../../domain/playback-progress.ts'
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

interface RestoreRecord {
  readonly command: RestoreCommand
  readonly guard: RestoreGuard
  readonly attempt: RestoreAttempt
  readonly localCurrent: () => boolean
  channel: RestoreReadback['channel']
  status: RestoreReadback['status']
  landing: RestoreReadback['landing']
  readonly originPosition: number | null
  inCall: boolean
}

interface SeekState {
  revision: number
  drag: ProgressDrag | null
  pointerRevision: number
  targetSec: number | null
  internalDepth: number
  pending: number | null
  keyboard: KeyboardSeek | null
  goal: PendingGoal | null
  nativePosition: NativePosition | null
}
interface ReloadOwnershipState {
  revision: number
  coreRevision: number
  internalDepth: number
  core: unknown
  awaitCore: boolean
  owned: OwnedReload | null
}
interface RestoreRecords {
  position: RestoreRecord | null
  rate: RestoreRecord | null
}

// One owner coordinates input revisions, observation and bounded reload proof.
export class PlayerControlObserver {
  readonly #seek: SeekState = {
    revision: 0,
    drag: null,
    pointerRevision: 0,
    targetSec: null,
    internalDepth: 0,
    pending: null,
    keyboard: null,
    goal: null,
    nativePosition: null,
  }
  readonly #reload: ReloadOwnershipState = {
    revision: 0,
    coreRevision: 0,
    internalDepth: 0,
    core: null,
    awaitCore: false,
    owned: null,
  }
  readonly #restores: RestoreRecords = { position: null, rate: null }
  #objects = new WeakMap<object, number>()
  #objectSerial = 0
  #userRevision = 0
  #inputs = new PlayerInputBindings()
  #controlVideo: HTMLVideoElement | null = null
  #seekOwner: UnknownRecord | null = null
  #keyboardPlayback: KeyboardPlayback | null = null
  #keyboardRevision = 0
  #controlRevision = 0
  #playbackRevision = 0
  readonly #playbackListeners = new Set<(revision: number) => void>()
  playbackRevision(): number {
    return this.#playbackRevision
  }
  observePlaybackInvalidation(listener: (revision: number) => void): () => void {
    this.#playbackListeners.add(listener)
    this.controls()
    return () => this.#playbackListeners.delete(listener)
  }
  #invalidatePlayback(): void {
    const revision = ++this.#playbackRevision
    for (const listener of this.#playbackListeners) {
      try {
        listener(revision)
      } catch {
        /* a readonly consumer cannot break player observation */
      }
    }
  }
  constructor(
    private readonly sources: ControlSources,
    private readonly environment: PlayerControlEnvironment,
  ) {}

  controls(): PlayerControlSnapshot {
    const reloadOwner = this.#reload.owned
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
      video.currentTime !== this.#seek.targetSec
    ) {
      this.#seek.targetSec = video.currentTime
      if (
        !this.#seek.internalDepth &&
        this.#seek.pending !== video.currentTime &&
        !this.#pendingRestoreSeek(video.currentTime)
      )
        this.#seek.revision++
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
    else if (!this.#reload.owned && !this.#reload.awaitCore && core !== this.#reload.core)
      this.#reload.coreRevision = 0
    this.#reload.core = core
    return Object.freeze({
      mediaId: identity(video),
      coreId: identity(core),
      seekRevision: this.#seek.revision,
      userRevision: this.#userRevision,
      dragging: this.#seek.drag !== null,
      targetSec: this.#seek.targetSec,
      pendingSeekGoal: !!this.#seek.goal && !this.#seek.goal.completed,
      reloadRevision: this.#reload.revision,
      coreReloadRevision: this.#reload.coreRevision,
    })
  }

  captureResumePosition(readCurrent: () => number): ResumePositionCapture {
    this.controls()
    const before = this.#seek.goal
    const current = readCurrent()
    this.controls()
    const goal = this.#seek.goal
    return Object.freeze(
      goal && goal === before && !goal.completed && this.#goalCurrent(goal)
        ? { positionSec: goal.position, proof: goal.proof }
        : { positionSec: current, proof: null },
    )
  }

  validateResumePosition(capture: ResumePositionCapture, initializationRevision?: number): boolean {
    this.controls()
    if (capture.proof === null) return initializationRevision === undefined
    const goal = this.#seek.goal
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
    const reload = this.#reload.owned
    if (reload) this.#validateOwnedReload(video, player, core, reload)
    return (
      this.#seek.goal === goal &&
      goal.video === video &&
      goal.player === player &&
      goal.lifecycle === lifecycle &&
      goal.userRevision === this.#userRevision &&
      this.environment.isActuallyVisible() &&
      (core === goal.core ||
        (!!reload &&
          this.#reload.owned === reload &&
          (core === null || core === undefined || core === reload.replacement))) &&
      video === this.sources.video() &&
      player === this.sources.player() &&
      lifecycle === this.sources.lifecycleKey() &&
      this.#seek.goal === goal &&
      goal.userRevision === this.#userRevision
    )
  }

  #setGoal(video: HTMLVideoElement, position: number): void {
    if (!Number.isFinite(position)) return
    const revision = this.#userRevision,
      controlRevision = this.#controlRevision
    const old = this.#seek.goal
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
    this.#seek.goal = {
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
    const drag = this.#seek.drag,
      revision = this.#seek.pointerRevision,
      position = video.currentTime
    if (
      drag &&
      drag.video === video &&
      drag.player === this.sources.player() &&
      drag.lifecycle === this.sources.lifecycleKey() &&
      this.environment.isActuallyVisible() &&
      Number.isFinite(position) &&
      position !== drag.position &&
      this.#seek.drag === drag &&
      revision === this.#seek.pointerRevision
    )
      this.#setGoal(video, position)
  }

  #initializationSeek(position: number): boolean {
    const goal = this.#seek.goal,
      reload = this.#reload.owned
    if (
      !goal ||
      goal.completed ||
      !Number.isFinite(position) ||
      !reload ||
      reload.stable ||
      goal.initialization ||
      !this.#goalCurrent(goal) ||
      (!this.#reload.internalDepth && !reload.replacement)
    )
      return false
    goal.initialization = { revision: reload.revision, seekRevision: this.#seek.revision, position }
    goal.baseline = null
    goal.progress = 0
    return true
  }

  #sampleGoal(video: HTMLVideoElement, position: number): void {
    const goal = this.#seek.goal
    if (!goal) return
    if (!this.#goalCurrent(goal)) {
      if (this.#seek.goal === goal) this.#seek.goal = null
      return
    }
    if (goal.completed || video.readyState < 2 || video.seeking || video.ended || video.error)
      return
    const reload = this.#reload.owned
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
    if (this.#seek.goal !== goal || !this.#goalCurrent(goal)) return
    if (!before) {
      if (Math.abs(position - goal.position) <= 1) goal.baseline = { position, frames, at }
      else if (position !== goal.initialization?.position && this.#seek.goal === goal)
        this.#seek.goal = null
      return
    }
    if (at <= before.at) return
    const delta = position - before.position,
      maxAdvance = Math.max(1, (Math.max(0, video.playbackRate) * (at - before.at)) / 1000 + 1)
    const progress =
      !video.paused &&
      playbackTimeAdvanced(position, before.position) &&
      (frames === null || (before.frames !== null && playbackFramesAdvanced(frames, before.frames)))
    if (this.#seek.goal !== goal || !this.#goalCurrent(goal)) return
    if (
      delta < 0 ||
      delta > maxAdvance ||
      (video.paused && delta !== 0 && !this.#seek.internalDepth)
    ) {
      this.#seek.goal = null
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
    const before = this.#seek.nativePosition,
      revision = this.#controlRevision
    const seekRevision = this.#seek.revision,
      userRevision = this.#userRevision,
      pendingSeek = this.#seek.pending
    const lifecycle = this.sources.lifecycleKey(),
      position = video.currentTime,
      readyState = video.readyState
    const currentVideo = this.sources.video(),
      currentPlayer = this.sources.player(),
      currentLifecycle = this.sources.lifecycleKey()
    if (
      revision !== this.#controlRevision ||
      this.#seek.nativePosition !== before ||
      video !== this.#controlVideo ||
      player !== this.#seekOwner ||
      currentVideo !== video ||
      currentPlayer !== player ||
      lifecycle !== currentLifecycle ||
      seekRevision !== this.#seek.revision ||
      userRevision !== this.#userRevision ||
      pendingSeek !== this.#seek.pending ||
      !Number.isFinite(position)
    )
      return
    this.#seek.nativePosition = { video, player, lifecycle, position, readyState }
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
    const owner = this.#reload.owned
    // Native load() resets to zero without seeking. Only this call's initial
    // reset is exempt; an observed later target (including zero) revokes restore.
    const initialReloadZero =
      position === 0 &&
      owner?.video === video &&
      owner.player === player &&
      owner.lifecycle === lifecycle &&
      (knownReloadZero || (this.#reload.internalDepth > 0 && before.readyState !== 0))
    if (initialReloadZero) return
    const goal = this.#seek.goal
    if (
      goal &&
      position !== goal.position &&
      !(position === 0 && before.readyState !== 0 && !this.#reload.owned) &&
      position !== goal.initialization?.position
    )
      this.#seek.goal = null
    const alreadyObserved = this.#seek.targetSec === position
    this.#seek.targetSec = position
    if (!this.#seek.internalDepth && position !== this.#seek.pending) {
      this.#seek.pending = null
      if (!alreadyObserved) this.#seek.revision++
    }
  }

  #observeControls(video: HTMLVideoElement | null, player: UnknownRecord | null): void {
    this.#invalidatePlayback()
    this.#clearControls()
    this.#controlVideo = video
    this.#seekOwner = player
    if (!video) return
    this.#inputs.playback(video, () => this.#invalidatePlayback())
    const region = video.closest('.bpx-player-container, .bilibili-player') ?? video.parentElement
    const inRegion = (event: Event): boolean =>
      event.target instanceof Node && !!region?.contains(event.target)
    this.#bindPointerControls(video, player, region, inRegion)
    this.#bindControlLoss()
    this.#bindKeyboardControls(video, player, inRegion)
    this.#bindMediaControls(video)
    this.#bindSdkControls(player)
  }

  #bindPointerControls(
    video: HTMLVideoElement,
    player: UnknownRecord | null,
    region: Element | null,
    inRegion: (event: Event) => boolean,
  ): void {
    this.#inputs.trusted(document, 'pointerdown', (event) => {
      const revision = ++this.#seek.pointerRevision
      if (
        !this.environment.isActuallyVisible() ||
        !inRegion(event) ||
        revision !== this.#seek.pointerRevision
      )
        return
      this.#clearKeyboardSeek()
      this.#clearKeyboardPlayback()
      const playTarget =
        event.target instanceof Element && event.target.closest('.bpx-player-ctrl-play')
      if (!this.#advanceUser(!!playTarget && video.paused)) return
      const lifecycle = this.sources.lifecycleKey()
      const pointerId = progressPointerId(event, region)
      if (pointerId === null) return
      const current =
        video === this.sources.video() &&
        player === this.sources.player() &&
        lifecycle === this.sources.lifecycleKey() &&
        this.environment.isActuallyVisible()
      if (
        !current ||
        video !== this.#controlVideo ||
        player !== this.#seekOwner ||
        revision !== this.#seek.pointerRevision
      )
        return
      this.#seek.drag = { pointerId, video, player, lifecycle, position: video.currentTime }
    })
    const release: EventListener = (event) => {
      const drag = this.#seek.drag
      if (
        !drag ||
        !event.isTrusted ||
        typeof PointerEvent !== 'function' ||
        !(event instanceof PointerEvent) ||
        event.pointerId !== drag.pointerId
      )
        return
      if (this.#seek.drag === drag) {
        this.#pointerGoal(video)
        this.#seek.drag = null
        this.#seek.pointerRevision++
      }
    }
    this.#inputs.pointerRelease(release)
  }

  #bindControlLoss(): void {
    const controlLoss = (): void => {
      this.#seek.drag = null
      this.#seek.pointerRevision++
      this.#clearKeyboardSeek()
      this.#clearKeyboardPlayback()
      this.#clearOwnedReload()
      this.#seek.goal = null
    }
    this.#inputs.trusted(window, 'blur', (event) => {
      if (event.target === window) controlLoss()
    })
    this.#inputs.own(this.environment.subscribeControlLoss(controlLoss))
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
      if (!isControlKeyboard(event) || !this.environment.isActuallyVisible()) return
      if (
        event.composedPath().some(isEditableTarget) ||
        (event.target && isEditableTarget(event.target))
      )
        return
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
    this.#inputs.keyboard(observeKeyboard)
  }

  #bindMediaControls(video: HTMLVideoElement): void {
    this.#inputs.listen(video, 'seeking', () => {
      const position = Number.isFinite(video.currentTime) ? video.currentTime : null
      if (
        !this.#seek.internalDepth &&
        position !== this.#seek.pending &&
        !this.#pendingRestoreSeek(position)
      )
        this.#seek.revision++
      this.#seek.targetSec = position
      this.#confirmKeyboardSeek()
      this.#pointerGoal(video)
      const goal = this.#seek.goal
      if (
        !this.#seek.internalDepth &&
        !this.#pendingRestoreSeek(position) &&
        goal &&
        position !== goal.position &&
        position !== goal.initialization?.position
      )
        this.#seek.goal = null
    })
    this.#inputs.listen(video, 'seeked', () => {
      this.#seek.pending = null
      this.#sampleGoal(video, video.currentTime)
      this.#noteRestoreLanding()
    })
  }

  #bindSdkControls(player: UnknownRecord | null): void {
    const original = player?.seek,
      observer = this
    const reload = player?.reload
    if (player && typeof reload === 'function') {
      const wrapped = function (this: unknown, ...args: unknown[]): unknown {
        if (!observer.#reload.internalDepth) {
          observer.#seek.revision++
          observer.#clearOwnedReload()
          observer.#seek.goal = null
        }
        return Reflect.apply(reload, this, args)
      }
      try {
        this.#inputs.own(observeMethod(player, 'reload', reload, wrapped))
      } catch {
        /* core identity still revokes unmarked replacements */
      }
    }
    if (player && typeof original === 'function') {
      const wrapped = function (this: unknown, ...args: unknown[]): unknown {
        if (!observer.#seek.internalDepth) {
          observer.#seek.revision++
          observer.#seek.pending = null
          observer.#seek.targetSec =
            typeof args[0] === 'number' && Number.isFinite(args[0]) ? Math.max(0, args[0]) : null
          if (!observer.#initializationSeek(observer.#seek.targetSec ?? NaN))
            observer.#seek.goal = null
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
        this.#inputs.own(observeMethod(player, 'seek', original, wrapped))
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
    this.#seek.keyboard = candidate
    // A late bubble observer covers direct currentTime writes without wrapping media accessors.
    const type = event.type
    const finish = (observed: Event): void => {
      if (observed === event && this.#seek.keyboard === candidate) this.#confirmKeyboardSeek()
    }
    window.addEventListener(type, finish)
    const cancel = this.environment.scheduler.timeout(() => {
      if (this.#seek.keyboard === candidate) this.#clearKeyboardSeek()
    }, 0)
    candidate.stop = () => {
      cancel()
      window.removeEventListener(type, finish)
    }
  }

  #confirmKeyboardSeek(): void {
    const candidate = this.#seek.keyboard
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
        if (this.#seek.keyboard === candidate) this.#clearKeyboardSeek()
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
        seeking || (readyState === 0 && core === candidate.core && !this.#reload.internalDepth)
      if (this.#seek.keyboard !== candidate || candidate.revision !== this.#keyboardRevision) return
      if (
        candidate.event.eventPhase === Event.NONE ||
        candidate.video !== this.#controlVideo ||
        candidate.player !== this.#seekOwner ||
        candidate.video !== this.sources.video() ||
        candidate.player !== this.sources.player() ||
        candidate.lifecycle !== this.sources.lifecycleKey() ||
        !this.environment.isActuallyVisible()
      ) {
        if (this.#seek.keyboard === candidate) this.#clearKeyboardSeek()
        return
      }
      if (
        this.#seek.keyboard !== candidate ||
        candidate.revision !== this.#keyboardRevision ||
        this.#seek.internalDepth ||
        !actualSeek ||
        !Number.isFinite(position) ||
        position === candidate.position ||
        position === this.#seek.pending
      )
        return
      if (this.#seek.targetSec !== position) this.#seek.revision++
      this.#seek.targetSec = position
      if (!this.#advanceUser()) return
      this.#setGoal(candidate.video, position)
      this.#clearKeyboardSeek()
    } catch {
      if (this.#seek.keyboard === candidate) this.#clearKeyboardSeek()
    }
  }

  #clearKeyboardSeek(): void {
    const candidate = this.#seek.keyboard
    this.#seek.keyboard = null
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
    const goal = this.#seek.goal,
      revision = this.#userRevision
    const valid = keepGoal && !!goal && !goal.completed && this.#goalCurrent(goal)
    if (revision !== this.#userRevision) return false
    this.#userRevision++
    this.#invalidatePlayback()
    this.#clearOwnedReload()
    if (valid && this.#seek.goal === goal) goal.userRevision = this.#userRevision
    else this.#seek.goal = null
    return true
  }

  #clearOwnedReload(): void {
    const owner = this.#reload.owned
    this.#reload.owned = null
    this.#reload.awaitCore = false
    this.#reload.coreRevision = 0
    owner?.cancel()
  }

  #validateOwnedReload(
    video: HTMLVideoElement | null,
    player: UnknownRecord | null,
    core: unknown,
    owner: OwnedReload,
  ): void {
    if (this.#reload.owned !== owner) return
    const valid =
      video === owner.video &&
      player === owner.player &&
      owner.revision === this.#reload.revision &&
      owner.lifecycle === this.sources.lifecycleKey() &&
      owner.userRevision === this.#userRevision &&
      this.environment.isActuallyVisible()
    if (this.#reload.owned !== owner) return
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
    this.#reload.coreRevision = owner.revision
    this.#reload.awaitCore = false
  }

  ownedReload(revision: number): boolean {
    this.#confirmKeyboardPlayback()
    const owner = this.#reload.owned
    if (!owner || owner.revision !== revision) return false
    this.#validateOwnedReload(
      this.sources.video(),
      this.sources.player(),
      safeCall(owner.player, '__core'),
      owner,
    )
    return this.#reload.owned === owner
  }

  #validateDrag(): void {
    const drag = this.#seek.drag
    if (!drag) return
    if (
      drag.video !== this.#controlVideo ||
      drag.player !== this.#seekOwner ||
      drag.video !== this.sources.video() ||
      drag.player !== this.sources.player() ||
      drag.lifecycle !== this.sources.lifecycleKey() ||
      !this.environment.isActuallyVisible()
    ) {
      if (this.#seek.drag === drag) {
        this.#seek.drag = null
        this.#seek.pointerRevision++
      }
    }
  }

  #clearControls(): void {
    this.#restores.position = null
    this.#restores.rate = null
    this.#seek.goal = null
    this.#controlRevision++
    this.#seek.nativePosition = null
    this.#clearKeyboardSeek()
    this.#clearKeyboardPlayback()
    this.#keyboardRevision++
    this.#clearOwnedReload()
    this.#inputs.clear()
    this.#controlVideo = null
    this.#seekOwner = null
    this.#seek.drag = null
    this.#seek.pointerRevision++
    this.#seek.pending = null
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
    const prepared = this.prepareReload()
    if (!prepared) throw new Error('player.reload unavailable')
    return prepared.dispatch(() => true)
  }

  prepareReload(): { valid(): boolean; dispatch(commit: () => boolean): unknown } | null {
    const userRevision = this.#userRevision,
      beforeRevision = this.#reload.revision,
      seekRevision = this.#seek.revision,
      controlRevision = this.#controlRevision
    const player = this.sources.player(),
      video = this.sources.video(),
      lifecycle = this.sources.lifecycleKey()
    const sourceCore = safeCall(player, '__core'),
      reload = player?.reload
    if (!player || typeof reload !== 'function') return null
    let dispatched = false
    const revisionsMatch = () =>
      userRevision === this.#userRevision &&
      beforeRevision === this.#reload.revision &&
      seekRevision === this.#seek.revision &&
      controlRevision === this.#controlRevision
    const valid = (): boolean => {
      if (dispatched || !revisionsMatch()) return false
      const currentPlayer = this.sources.player(),
        currentVideo = this.sources.video(),
        currentCore = safeCall(player, '__core')
      const visible = this.environment.isActuallyVisible(),
        currentLifecycle = this.sources.lifecycleKey()
      if (
        userRevision !== this.#userRevision ||
        beforeRevision !== this.#reload.revision ||
        currentPlayer !== player ||
        currentVideo !== video ||
        currentCore !== sourceCore ||
        currentLifecycle !== lifecycle ||
        !visible
      )
        return false
      return revisionsMatch()
    }
    if (!valid()) throw new Error('player.reload ownership ended')
    return Object.freeze({
      valid,
      dispatch: (commit: () => boolean) => {
        if (!valid() || !commit() || !revisionsMatch())
          throw new Error('player.reload ownership ended')
        dispatched = true
        this.#clearKeyboardPlayback()
        this.#clearOwnedReload()
        this.#reload.core = sourceCore
        const revision = ++this.#reload.revision
        const owner: OwnedReload | null = video
          ? {
              revision,
              video,
              player,
              lifecycle,
              userRevision,
              sourceCore: this.#reload.core,
              replacement: null,
              sawNull: false,
              stable: false,
              cancel: () => undefined,
            }
          : null
        this.#reload.owned = owner
        this.#reload.awaitCore = owner !== null
        if (owner)
          owner.cancel = this.environment.scheduler.timeout(() => {
            if (this.#reload.owned === owner) this.#clearOwnedReload()
          }, 15_000)
        if (
          this.#reload.owned !== owner ||
          this.#reload.revision !== revision ||
          this.#seek.revision !== seekRevision ||
          this.#controlRevision !== controlRevision ||
          this.#userRevision !== userRevision
        ) {
          if (this.#reload.owned === owner) this.#clearOwnedReload()
          throw new Error('player.reload ownership ended')
        }
        this.#reload.internalDepth++
        const beforePosition = this.#seek.nativePosition
        try {
          const result: unknown = Reflect.apply(reload, player, [])
          if (result && (typeof result === 'object' || typeof result === 'function'))
            void Promise.resolve(result).catch(() => {
              if (this.#reload.owned === owner) this.#clearOwnedReload()
            })
          return result
        } catch (error) {
          if (this.#reload.owned === owner) this.#clearOwnedReload()
          throw error
        } finally {
          try {
            if (video && this.#reload.owned === owner)
              this.#observeNativePosition(
                video,
                player,
                this.#seek.nativePosition === beforePosition,
              )
          } catch {
            // An observation failure must not replace the SDK's result/exception
            // or retain our method-source marker. The saved position is uncertain.
            if (this.#reload.owned === owner) this.#seek.revision++
          } finally {
            this.#reload.internalDepth--
          }
        }
      },
    })
  }

  #nativeWriteGuard(canCommit: () => boolean): () => boolean {
    const revision = this.#controlRevision,
      user = this.#userRevision,
      seek = this.#seek.revision,
      reload = this.#reload.revision,
      video = this.sources.video(),
      player = this.sources.player(),
      lifecycle = this.sources.lifecycleKey(),
      core = safeCall(player, '__core')
    const revisionsMatch = () =>
      revision === this.#controlRevision &&
      user === this.#userRevision &&
      seek === this.#seek.revision &&
      reload === this.#reload.revision
    return () => {
      try {
        if (!canCommit() || !revisionsMatch()) return false
        const same =
          video === this.sources.video() &&
          player === this.sources.player() &&
          lifecycle === this.sources.lifecycleKey() &&
          core === safeCall(player, '__core') &&
          this.environment.isActuallyVisible()
        return same && canCommit() && revisionsMatch()
      } catch {
        return false
      }
    }
  }

  seek(value: number, canCommit: () => boolean = () => true): void {
    this.#seekCommand(value, canCommit)
  }

  #seekCommand(
    value: number,
    canCommit: () => boolean,
  ): { channel: RestoreReadback['channel']; result: unknown } {
    this.#invalidatePlayback()
    this.#clearKeyboardSeek()
    this.#clearKeyboardPlayback()
    const nativeCurrent = this.#nativeWriteGuard(canCommit)
    if (this.#seek.goal?.position === value) {
      this.#seek.goal.baseline = null
      this.#seek.goal.progress = 0
    }
    this.#seek.internalDepth++
    this.#seek.pending = value
    try {
      const player = this.sources.player(),
        method = player?.seek
      const dispatched = this.#sdkCommand(player, method, value, nativeCurrent)
      if (dispatched) return dispatched
      const video = this.sources.video()
      if (video && nativeCurrent()) {
        video.currentTime = value
        return { channel: 'native', result: undefined }
      }
      return { channel: 'none', result: undefined }
    } finally {
      this.#seek.internalDepth--
    }
  }

  setRate(value: number, canCommit: () => boolean = () => true): void {
    this.#rateCommand(value, canCommit)
  }

  #rateCommand(
    value: number,
    canCommit: () => boolean,
    fallbackOnThrow = true,
  ): { channel: RestoreReadback['channel']; result: unknown } {
    this.#invalidatePlayback()
    this.#clearKeyboardPlayback()
    const nativeCurrent = this.#nativeWriteGuard(canCommit)
    const player = this.sources.player(),
      method = player?.setPlaybackRate
    try {
      const dispatched = this.#sdkCommand(player, method, value, nativeCurrent)
      if (dispatched) return dispatched
    } catch (error) {
      if (!fallbackOnThrow) throw error
    }
    const video = this.sources.video()
    if (video && nativeCurrent()) {
      video.playbackRate = value
      return { channel: 'native', result: undefined }
    }
    return { channel: 'none', result: undefined }
  }

  #sdkCommand(
    player: UnknownRecord | null,
    method: unknown,
    value: number,
    current: () => boolean,
  ): { channel: RestoreReadback['channel']; result: unknown } | null {
    if (!player || typeof method !== 'function') return null
    if (!current()) return { channel: 'none', result: undefined }
    return { channel: 'sdk', result: Reflect.apply(method, player, [value]) }
  }

  #restoreRecord(attempt: RestoreAttempt): RestoreRecord | null {
    const record = attempt.kind === 'position' ? this.#restores.position : this.#restores.rate
    return record?.attempt.proof === attempt.proof ? record : null
  }

  #restoreCurrent(record: RestoreRecord, policy = true): boolean {
    return (
      this.#restoreRecord(record.attempt) === record &&
      (!policy || record.guard.valid()) &&
      this.ownedReload(record.guard.reloadRevision) &&
      record.localCurrent() &&
      this.#restoreRecord(record.attempt) === record
    )
  }

  #settleRestore(attempt: RestoreAttempt, rejected: boolean): void {
    const record = this.#restoreRecord(attempt)
    if (record && this.#restoreCurrent(record, false))
      record.status = rejected ? 'rejected' : 'settled'
  }

  #pendingRestoreSeek(position: number | null): boolean {
    const record = this.#restores.position
    return (
      !!record &&
      (record.inCall || record.status === 'pending') &&
      (position === record.originPosition || position === record.command.value) &&
      this.#restoreCurrent(record, false)
    )
  }

  #watchRestoreResult(attempt: RestoreAttempt, result: unknown): void {
    const record = this.#restoreRecord(attempt)
    if (!record) return
    if (result !== null && (typeof result === 'object' || typeof result === 'function')) {
      record.status = 'pending'
      void Promise.resolve(result).then(
        () => this.#settleRestore(attempt, false),
        () => this.#settleRestore(attempt, true),
      )
    }
  }

  performRestore(command: RestoreCommand, guard: RestoreGuard): RestoreAttempt {
    if (
      !Number.isFinite(command.value) ||
      command.value < 0 ||
      (command.kind === 'rate' && command.value === 0) ||
      !Number.isFinite(command.at)
    )
      throw Error('invalid restore command')
    const attempt = Object.freeze({ kind: command.kind, proof: Object.freeze({}) })
    const origin = this.sources.video()?.currentTime
    const record: RestoreRecord = {
      command: Object.freeze({ ...command }),
      guard,
      attempt,
      localCurrent: this.#nativeWriteGuard(() => true),
      channel: 'none',
      status: 'settled',
      landing: null,
      originPosition: typeof origin === 'number' && Number.isFinite(origin) ? origin : null,
      inCall: true,
    }
    if (command.kind === 'position') this.#restores.position = record
    else this.#restores.rate = record
    const current = () => this.#restoreCurrent(record)
    let applied: { channel: RestoreReadback['channel']; result: unknown }
    try {
      applied =
        command.kind === 'position'
          ? this.#seekCommand(command.value, current)
          : this.#rateCommand(command.value, current, false)
    } catch {
      record.channel = 'sdk'
      record.status = 'rejected'
      return attempt
    } finally {
      record.inCall = false
    }
    if (this.#restoreRecord(attempt) === record) {
      record.channel = applied.channel
      this.#watchRestoreResult(attempt, applied.result)
    }
    return attempt
  }

  #noteRestoreLanding(): void {
    const record = this.#restores.position
    if (!record || record.landing || !this.#restoreCurrent(record, false)) return
    try {
      const video = this.sources.video(),
        at = record.guard.now()
      if (!video) return
      const positionSec = video.currentTime
      if (
        video.seeking ||
        video.readyState < 1 ||
        !Number.isFinite(positionSec) ||
        !Number.isFinite(at) ||
        Math.abs(positionSec - record.command.value) > 1
      )
        return
      if (this.#restoreCurrent(record, false)) record.landing = Object.freeze({ positionSec, at })
    } catch {
      /* unavailable native facts cannot acknowledge a command */
    }
  }

  readRestore(attempt: RestoreAttempt, mode: RestoreReadMode = 'command'): RestoreReadback {
    const unknown = (): RestoreReadback => ({
      owned: false,
      channel: 'none',
      status: 'settled',
      positionSec: null,
      rate: null,
      paused: null,
      seeking: null,
      readyState: null,
      landing: null,
    })
    const record = this.#restoreRecord(attempt)
    if (!record) return unknown()
    // Progress-only observation never extends the reload/command write lease.
    // The controller separately enforces its stable-owner confirmation policy.
    const current = () =>
      mode === 'progress'
        ? this.#restoreRecord(attempt) === record &&
          record.localCurrent() &&
          this.#restoreRecord(attempt) === record
        : this.#restoreCurrent(record)
    if (!current()) return unknown()
    try {
      this.#noteRestoreLanding()
      const video = this.sources.video()
      if (!video) return unknown()
      const position = video.currentTime,
        rate = video.playbackRate,
        paused = video.paused,
        seeking = video.seeking,
        ready = video.readyState
      if (!current()) return unknown()
      return Object.freeze({
        owned: true,
        channel: record.channel,
        status: record.status,
        positionSec:
          typeof position === 'number' && Number.isFinite(position) && position >= 0
            ? position
            : null,
        rate: typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? rate : null,
        paused: typeof paused === 'boolean' ? paused : null,
        seeking: typeof seeking === 'boolean' ? seeking : null,
        readyState: Number.isInteger(ready) && ready >= 0 && ready <= 4 ? ready : null,
        landing: record.landing ? Object.freeze({ ...record.landing }) : null,
      })
    } catch {
      return {
        ...unknown(),
        owned: current(),
        channel: record.channel,
        status: record.status,
      }
    }
  }

  correctRestore(attempt: RestoreAttempt): void {
    const record = this.#restoreRecord(attempt)
    if (
      !record ||
      record.channel === 'native' ||
      record.status === 'pending' ||
      record.guard.now() - record.command.at < 1000 ||
      !this.#restoreCurrent(record)
    )
      return
    const video = this.sources.video()
    if (!video || video.seeking || video.readyState < 1 || !this.#restoreCurrent(record)) return
    record.channel = 'native'
    record.status = 'settled'
    if (record.command.kind === 'position') {
      record.landing = null
      this.#seek.pending = record.command.value
      this.#seek.internalDepth++
      try {
        if (this.#restoreCurrent(record)) video.currentTime = record.command.value
      } catch {
        /* consumed correction remains unverified until the original deadline */
      } finally {
        this.#seek.internalDepth--
      }
    } else {
      try {
        if (this.#restoreCurrent(record)) video.playbackRate = record.command.value
      } catch {
        /* consumed correction remains unverified until the original deadline */
      }
    }
  }

  play(canCommit: () => boolean = () => true): unknown {
    this.#invalidatePlayback()
    this.#clearKeyboardPlayback()
    const current = this.#nativeWriteGuard(canCommit)
    const player = this.sources.player(),
      method = player?.play
    if (!player || typeof method !== 'function') throw new Error('player.play unavailable')
    if (!current()) return undefined
    return Reflect.apply(method, player, [])
  }

  reset(): void {
    this.#invalidatePlayback()
    this.#clearControls()
    this.#reload.awaitCore = false
    this.#reload.coreRevision = 0
    this.#seek.revision++
    this.#userRevision++
    this.#seek.targetSec = null
  }
}
