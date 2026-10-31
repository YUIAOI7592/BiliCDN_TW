import { recoveryActionId, type DomainEvent, type RecoveryActionId } from '../domain/model.ts'
import type { VideoSnapshot, PlayerControlSnapshot } from './ports.ts'
import {
  comparePlaybackControls,
  playbackTimeAdvanced,
  playbackFramesAdvanced,
} from '../domain/playback-progress.ts'

interface ResumeToken {
  readonly positionCapture: ResumePositionCapture
  readonly id: RecoveryActionId
  readonly source: RecoverySource
  readonly startedAt: number
  readonly savedPositionSec: number
  readonly savedRate: number
  readonly wasPlaying: boolean
  readonly baselinePositionSec: number
  readonly baselineFrames: number | null
  reloadingAt: number
  restored: boolean
  reloadRevision: number | null
  restorePosition: boolean
  controls: PlayerControlSnapshot
  valid: () => boolean
  stall: StallRecoveryIntent | null
  firstProgressAt: number | null
  readonly initiallyPaused: boolean
  restore: RestorePlan | null
  restoredAt: number
  restoreBaseline: { readonly positionSec: number; readonly at: number } | null
}

interface RestorePlan {
  readonly targetSec: number
  phase: 'position' | 'rate'
  attempt: RestoreAttempt | null
  positionAttempt: RestoreAttempt | null
  issuedAt: number
  positionNativeUsed: boolean
  rateNativeUsed: boolean
  channel: RestoreReadback['channel']
  result: NonNullable<RecoverySnapshot['restoration']>['result']
}

interface RestoreProgressObservation {
  readonly attempt: RestoreAttempt
  readonly controls: PlayerControlSnapshot
  readonly positionSec: number
  readonly at: number
  readonly rate: number
}

import type {
  RecoveryPort,
  RecoveryPlayerPort,
  ResumePositionCapture,
  RestoreAttempt,
  RestoreReadback,
} from './recovery-contracts.ts'
import type { StallRecoveryIntent, RecoverySnapshot, RecoverySource } from './recovery-contracts.ts'
export class RecoveryController implements RecoveryPort {
  #listeners = new Set<(event: DomainEvent) => void>()
  #pauseAt = 0
  #hadHealthy = false
  #lastHealthyTime = 0
  #lastHealthyRate = 1
  #startupReloaded = false
  #token: ResumeToken | null = null
  #serial = 0
  #reloadCount = 0
  #breakerUntil = 0
  #stopIntent: (() => void) | null = null
  #suppress = false
  #lifecycleSerial = 0
  #lastFrames: number | null = null
  #lastSnapshot: VideoSnapshot | null = null
  #lastControls: PlayerControlSnapshot | null = null
  #lastTickAt = 0
  #deadTicks = 0
  #deadReported = false
  #progressTicks = 0
  #failedRestore: RestoreProgressObservation | null = null
  #state: RecoverySnapshot = Object.freeze({
    state: 'healthy',
    source: null,
    pauseSec: 0,
    reloadCount: 0,
    breakerSec: 0,
  })

  constructor(
    private readonly player: RecoveryPlayerPort,
    private readonly now: () => number,
    private readonly isActive: () => boolean = () => true,
    private readonly captureEligibility: () => () => boolean = () => () => true,
  ) {}
  subscribe(listener: (event: DomainEvent) => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
  snapshot(): RecoverySnapshot {
    const restoration = this.#restoration()
    if (restoration) return Object.freeze({ ...this.#state, restoration })
    return this.#state
  }

  #restoration(): RecoverySnapshot['restoration'] {
    const token = this.#token,
      plan = token?.restore
    return plan
      ? Object.freeze({
          phase: token?.restored ? 'progress' : plan.phase,
          channel: plan.channel,
          result: plan.result,
        })
      : undefined
  }
  isRecovering(): boolean {
    return !!this.#token
  }

  ongoingStallReload(
    id: number,
    snapshot: VideoSnapshot,
    controls: PlayerControlSnapshot,
  ): boolean {
    const token = this.#token
    return (
      !!token &&
      token.stall?.id === id &&
      this.isActive() &&
      !snapshot.ended &&
      !snapshot.mediaError &&
      (this.#ownedReload(token, controls) ||
        this.#acceptedReloadProgress(token, snapshot, controls))
    )
  }

  reset(): void {
    if (this.#token) this.#finish('failed', 'lifecycle-ended')
    this.#lifecycleSerial++
    this.#lastFrames = null
    this.#lastSnapshot = null
    this.#lastControls = null
    this.#lastTickAt = 0
    this.#deadTicks = 0
    this.#deadReported = false
    this.#progressTicks = 0
    this.#failedRestore = null
    this.#unhook()
    this.#pauseAt = 0
    this.#hadHealthy = false
    this.#lastHealthyTime = 0
    this.#token = null
    this.#reloadCount = 0
    this.#breakerUntil = 0
    this.#startupReloaded = false
    this.#lastHealthyRate = 1
    this.#state = Object.freeze({
      state: 'healthy',
      source: null,
      pauseSec: 0,
      reloadCount: 0,
      breakerSec: 0,
    })
  }

  armRouteFailure(
    source: 'route-failure' | 'watchdog',
    snapshot: VideoSnapshot,
    valid: () => boolean = () => true,
  ): void {
    if (
      this.#token ||
      snapshot.paused ||
      snapshot.seeking ||
      snapshot.ended ||
      snapshot.mediaError ||
      !this.#hadHealthy
    )
      return
    this.#begin(source, true, valid)
  }

  armStall(snapshot: VideoSnapshot, intent: StallRecoveryIntent): void {
    if (this.#token?.stall?.id === intent.id) return
    const token = this.#token
    if (
      token &&
      !token.stall &&
      ['route-failure', 'watchdog'].includes(token.source) &&
      snapshot.readyState === 0 &&
      snapshot.width === 0 &&
      snapshot.height === 0 &&
      snapshot.coreInitialized === false &&
      snapshot.manifestHasVideo &&
      this.#owns(token, this.player.controls())
    )
      return
    if (
      token &&
      !token.stall &&
      !snapshot.seeking &&
      ['route-failure', 'watchdog'].includes(token.source) &&
      intent.valid() &&
      this.#owns(token, this.player.controls()) &&
      this.#token === token
    ) {
      const previousValid = token.valid
      token.stall = intent
      token.valid = () => previousValid() && intent.valid()
      return
    }
    if (this.#token !== token) return
    if (this.#token) this.#finish('failed', 'superseded-by-stall')
    if (!intent.valid() || snapshot.paused || snapshot.ended || snapshot.mediaError) return
    this.#begin('stall', true, intent.valid, intent)
  }

  cancelStall(id: number): void {
    if (this.#token?.stall?.id === id) this.#finish('failed', 'stall-ended')
  }

  rejectStall(): void {
    this.#finish('failed', 'no-legal-video-route')
  }

  armStartupFailure(
    snapshot: VideoSnapshot,
    valid: () => boolean = this.captureEligibility(),
  ): void {
    if (
      this.#token ||
      this.#startupReloaded ||
      snapshot.paused ||
      snapshot.seeking ||
      snapshot.ended ||
      snapshot.mediaError ||
      !snapshot.available ||
      snapshot.playableBufferSec >= 1
    )
      return
    this.#begin('startup-failure', true, valid)
  }

  tick(snapshot: VideoSnapshot): void {
    const now = this.now()
    const previous = this.#lastSnapshot,
      controls = this.player.controls()
    if (
      this.#failedRestore &&
      comparePlaybackControls(controls, this.#failedRestore.controls) !== 'same'
    )
      this.#failedRestore = null
    const token = this.#token,
      plan = token?.restore
    const observation: RestoreProgressObservation | null =
      token?.restored && plan?.attempt && token.restoreBaseline
        ? {
            attempt: plan.attempt,
            controls: token.controls,
            positionSec: token.restoreBaseline.positionSec,
            at: token.restoreBaseline.at,
            rate: token.savedRate,
          }
        : this.#failedRestore
    const native = observation ? this.player.readRestore(observation.attempt, 'progress') : null
    let known =
      !observation ||
      (!!native?.owned &&
        native.positionSec !== null &&
        native.rate !== null &&
        native.paused !== null &&
        native.seeking !== null)
    const observed =
      native && known
        ? {
            ...snapshot,
            currentTime: native.positionSec!,
            playbackRate: native.rate!,
            paused: native.paused!,
            seeking: native.seeking!,
          }
        : snapshot
    if (observation && !token && known && !this.#matchesRestoreProgress(observation, observed))
      known = false
    if (token?.restored && plan)
      plan.result = !known
        ? 'unknown'
        : this.#matchesRestoreProgress(observation!, observed)
          ? 'verified'
          : 'mismatch'
    const { progress, newFrames } = this.#recordProgress(observed, previous, controls, known)
    if (this.#endInvalidToken(observed, controls, now)) return
    const healthy = this.#observeCoreHealth(observed, newFrames, now)
    if (healthy && known) this.#acceptHealthy(observed, controls)
    this.#observePause(observed, healthy, now)
    this.#advanceToken(observed, progress, now, known)
  }

  #recordProgress(
    snapshot: VideoSnapshot,
    previous: VideoSnapshot | null,
    controls: PlayerControlSnapshot,
    known = true,
  ): { readonly progress: boolean; readonly newFrames: boolean } {
    const sameControls = comparePlaybackControls(controls, this.#lastControls) === 'same'
    const newFrames =
      snapshot.frames !== null &&
      this.#lastFrames !== null &&
      playbackFramesAdvanced(snapshot.frames, this.#lastFrames)
    const progress =
      known &&
      !!previous &&
      sameControls &&
      !previous.seeking &&
      !snapshot.seeking &&
      !snapshot.paused &&
      !snapshot.ended &&
      !snapshot.mediaError &&
      playbackTimeAdvanced(snapshot.currentTime, previous.currentTime) &&
      (snapshot.frames === null || newFrames)
    this.#progressTicks = progress ? this.#progressTicks + 1 : 0
    this.#lastFrames = known ? snapshot.frames : null
    this.#lastSnapshot = known ? snapshot : null
    this.#lastControls = controls
    return { progress, newFrames }
  }

  #endInvalidToken(snapshot: VideoSnapshot, controls: PlayerControlSnapshot, now: number): boolean {
    if (
      this.#token &&
      (snapshot.mediaError ||
        (snapshot.seeking &&
          !this.#token.stall &&
          !this.#initializationOwned(this.#token, controls)) ||
        snapshot.ended)
    ) {
      this.#finish(
        'failed',
        snapshot.mediaError ? 'media-error' : snapshot.seeking ? 'seek-interrupted' : 'ended',
      )
      return true
    }
    if (
      this.#token?.reloadingAt &&
      this.#token.firstProgressAt === null &&
      now - this.#token.reloadingAt >= 15_000
    ) {
      this.#breakerUntil = now + 90_000
      this.#finish('failed', 'reload-timeout')
      return true
    }
    if (this.#token && (!this.isActive() || !this.#owns(this.#token, controls))) {
      this.#finish('failed', 'ownership-ended')
      return true
    }
    return false
  }

  #observeCoreHealth(snapshot: VideoSnapshot, newFrames: boolean, now: number): boolean {
    const healthy =
      snapshot.available &&
      !snapshot.mediaError &&
      (snapshot.readyState >= 2 || snapshot.width > 0 || snapshot.height > 0 || newFrames)
    const deadObservation =
      this.#hadHealthy &&
      snapshot.available &&
      !snapshot.seeking &&
      !snapshot.ended &&
      !snapshot.mediaError &&
      snapshot.readyState === 0 &&
      snapshot.width === 0 &&
      snapshot.height === 0 &&
      snapshot.manifestHasVideo &&
      snapshot.coreInitialized === false &&
      !newFrames
    const gap = now - this.#lastTickAt
    this.#lastTickAt = now
    this.#deadTicks = deadObservation ? (gap > 0 && gap <= 2000 ? this.#deadTicks + 1 : 1) : 0
    if (healthy) this.#deadReported = false
    if (this.#deadTicks >= 4 && !this.#deadReported) {
      this.#deadReported = true
      this.#emit({
        type: 'core-uninitialized',
        at: now,
        paused: snapshot.paused,
        intentPending: !!this.#token,
        consecutiveTicks: this.#deadTicks,
      })
    }
    return healthy
  }

  #acceptHealthy(snapshot: VideoSnapshot, controls: PlayerControlSnapshot): void {
    this.#hadHealthy = true
    this.#lastHealthyTime = snapshot.currentTime
    this.#lastHealthyRate = snapshot.playbackRate > 0 ? snapshot.playbackRate : 2
    if (
      !this.#token &&
      this.#progressTicks >= 2 &&
      ['failed', 'breaker'].includes(this.#state.state)
    )
      this.#finish('recovered', 'playback-progress-observed')
    if (this.#token) {
      const ownedReload = this.#ownedReload(this.#token, controls)
      const restoreReady =
        (!this.#token.positionCapture.proof || !snapshot.seeking) &&
        (!ownedReload ||
          (controls.coreId !== 0 &&
            controls.coreReloadRevision === this.#token.reloadRevision &&
            snapshot.coreInitialized !== false))
      if (this.#token.reloadingAt && !this.#token.restored && restoreReady)
        this.#restore(this.#token, snapshot)
      else if (
        this.#progressTicks >= 2 &&
        (!this.#token.reloadingAt || this.#token.restored) &&
        this.#restoredProgressValid(this.#token, snapshot)
      )
        this.#finish('recovered')
    }
  }

  #observePause(snapshot: VideoSnapshot, healthy: boolean, now: number): void {
    if (
      snapshot.paused &&
      !snapshot.seeking &&
      !snapshot.ended &&
      this.#hadHealthy &&
      !this.#token
    ) {
      if (!this.#pauseAt) this.#pauseAt = now
      this.#hook()
      if (!['failed', 'breaker'].includes(this.#state.state))
        this.#state = Object.freeze({
          state: 'pause-armed',
          source: null,
          pauseSec: Math.floor((now - this.#pauseAt) / 1000),
          reloadCount: this.#reloadCount,
          breakerSec: Math.max(0, Math.ceil((this.#breakerUntil - now) / 1000)),
        })
      else
        this.#state = Object.freeze({
          ...this.#state,
          breakerSec: Math.max(0, Math.ceil((this.#breakerUntil - now) / 1000)),
        })
    } else if (!snapshot.paused && this.#pauseAt && !this.#token) {
      const wasLong = now - this.#pauseAt >= 30_000
      this.#pauseAt = 0
      this.#unhook()
      if (wasLong) this.#begin('paused-transition', true)
      else if (healthy && this.#state.state === 'pause-armed')
        this.#state = Object.freeze({
          state: 'healthy',
          source: null,
          pauseSec: 0,
          reloadCount: this.#reloadCount,
          breakerSec: Math.max(0, Math.ceil((this.#breakerUntil - now) / 1000)),
        })
    }
  }

  #advanceToken(
    snapshot: VideoSnapshot,
    progress: boolean,
    now: number,
    restoreKnown = true,
  ): void {
    const token = this.#token
    if (!token) return
    if (
      snapshot.mediaError ||
      (snapshot.seeking &&
        !token.stall &&
        !this.#initializationOwned(token, this.player.controls())) ||
      snapshot.ended
    ) {
      this.#finish(
        'failed',
        snapshot.mediaError ? 'media-error' : snapshot.seeking ? 'seek-interrupted' : 'ended',
      )
      return
    }
    if (snapshot.paused && token.stall && !this.#ownedReload(token, this.player.controls())) {
      this.#finish('failed', 'paused')
      return
    }
    // This tick's supplied snapshot predates any seek/rate/play performed above.
    // It cannot verify or reject the native result of that just-finished restore.
    if (token.restored && now <= token.restoredAt) return
    if (token.reloadingAt && !token.restored) progress = false
    if (token.restored && restoreKnown && !this.#restoredProgressValid(token, snapshot)) {
      this.#finish('failed', 'restore-mismatch')
      return
    }
    if (progress && (!token.restored || now > token.restoredAt)) {
      token.firstProgressAt ??= now
      return
    }
    if (token.firstProgressAt !== null) {
      if (now - token.firstProgressAt >= 15_000) this.#finish('failed', 'progress-not-sustained')
      return
    }
    const dead =
      snapshot.readyState === 0 &&
      snapshot.width === 0 &&
      snapshot.height === 0 &&
      snapshot.manifestHasVideo &&
      snapshot.coreInitialized === false
    const startupStalled =
      token.source === 'startup-failure' &&
      snapshot.readyState < 2 &&
      snapshot.playableBufferSec < 1 &&
      snapshot.currentTime <= token.baselinePositionSec + 0.05 &&
      (snapshot.frames === null ||
        token.baselineFrames === null ||
        snapshot.frames <= token.baselineFrames)
    if (
      !token.reloadingAt &&
      (token.stall
        ? now - token.stall.startedAt >= (token.stall.reloadAfterMs ?? 30_000)
        : ((dead || startupStalled) && now - token.startedAt >= 4000) ||
          now - token.startedAt >= 30_000)
    )
      this.#reload(token)
    if (token.reloadingAt && now - token.reloadingAt >= 15_000) {
      this.#breakerUntil = now + 90_000
      this.#finish('failed', 'reload-timeout')
    }
  }

  dispose(): void {
    this.reset()
    this.#listeners.clear()
  }

  #hook(): void {
    this.#unhook()
    this.#stopIntent = this.player.observePlayIntent(() => {
      if (!this.#suppress && this.#pauseAt && this.now() - this.#pauseAt >= 30_000)
        this.#begin('trusted-player-play', true)
    })
  }

  #unhook(): void {
    this.#stopIntent?.()
    this.#stopIntent = null
  }

  #begin(
    source: ResumeToken['source'],
    wasPlaying: boolean,
    valid: () => boolean = this.captureEligibility(),
    stall: StallRecoveryIntent | null = null,
  ): void {
    const lifecycle = this.#lifecycleSerial,
      before = this.player.controls()
    if (
      this.#token ||
      before.dragging ||
      !this.isActive() ||
      !valid() ||
      this.now() < this.#breakerUntil ||
      this.#reloadCount >= 2
    )
      return
    // Adapter reads can synchronously run site code. Collect each saved value once,
    // then validate the preparation owner before committing a recovery action.
    const positionCapture = this.player.captureResumePosition(),
      position = positionCapture.proof
        ? positionCapture.positionSec
        : (stall?.targetSec ?? positionCapture.positionSec),
      rate = this.player.playbackRate()
    const snapshot = this.player.snapshot(),
      now = this.now()
    const positionValid = this.player.validateResumePosition(positionCapture),
      controls = this.player.controls(),
      eligible = positionValid && this.isActive() && valid()
    if (
      !eligible ||
      this.#lifecycleSerial !== lifecycle ||
      this.#token ||
      controls.dragging ||
      now < this.#breakerUntil ||
      this.#reloadCount >= 2 ||
      snapshot.ended ||
      snapshot.mediaError ||
      controls.mediaId !== before.mediaId ||
      controls.coreId !== before.coreId ||
      controls.seekRevision !== before.seekRevision ||
      controls.userRevision !== before.userRevision
    )
      return
    this.#failedRestore = null
    this.#token = {
      positionCapture,
      id: recoveryActionId(`core-${++this.#serial}`),
      source,
      startedAt: now,
      savedPositionSec: Math.max(0, Number.isFinite(position) ? position : this.#lastHealthyTime),
      savedRate: rate > 0 ? rate : this.#lastHealthyRate || 1,
      wasPlaying,
      baselinePositionSec: snapshot.currentTime,
      baselineFrames: snapshot.frames,
      reloadingAt: 0,
      restored: false,
      controls,
      valid,
      stall,
      firstProgressAt: null,
      initiallyPaused: snapshot.paused,
      reloadRevision: null,
      restorePosition: true,
      restore: null,
      restoredAt: 0,
      restoreBaseline: null,
    }
    this.#state = Object.freeze({
      state: 'play-intent',
      source,
      pauseSec: this.#pauseAt ? Math.floor((now - this.#pauseAt) / 1000) : 0,
      reloadCount: this.#reloadCount,
      breakerSec: 0,
    })
  }

  #reload(token: ResumeToken): void {
    if (!this.#owns(token, this.player.controls()) || !this.isActive()) {
      this.#finish('failed', 'ownership-ended')
      return
    }
    if (this.now() < this.#breakerUntil || this.#reloadCount >= 2) {
      this.#finish('breaker')
      return
    }
    token.reloadingAt = this.now()
    this.#reloadCount++
    if (token.source === 'startup-failure') this.#startupReloaded = true
    this.#breakerUntil = this.now() + 90_000
    this.#emit({
      type: 'recovery',
      at: this.now(),
      action: {
        action: 'player-reload',
        id: token.id,
        savedPositionSec: token.savedPositionSec,
        savedRate: token.savedRate,
      },
    })
    this.#emit({
      type: 'core',
      at: this.now(),
      state: 'reloading',
      actionId: token.id,
      source: token.source,
      savedPositionSec: token.savedPositionSec,
      savedRate: token.savedRate,
      readyState: this.#lastSnapshot?.readyState ?? 0,
      coreInitialized: this.#lastSnapshot?.coreInitialized ?? null,
    })
    const lifecycle = this.#lifecycleSerial
    if (!this.#owns(token, this.player.controls())) return
    try {
      const before = this.player.controls()
      if (!this.#owns(token, before)) return
      token.reloadRevision = Number.isSafeInteger(before.reloadRevision)
        ? before.reloadRevision + 1
        : null
      const result = this.player.reload()
      if (result !== null && (typeof result === 'object' || typeof result === 'function'))
        void Promise.resolve(result).catch(() => {
          if (this.#lifecycleSerial === lifecycle && this.#token === token)
            this.#finish('failed', 'reload-rejected')
        })
    } catch (error) {
      if (this.#token === token)
        this.#finish(
          'failed',
          error instanceof Error && error.message === 'player.reload unavailable'
            ? 'reload-unavailable'
            : 'reload-threw',
        )
      return
    }
    if (this.#token === token && this.#owns(token, this.player.controls()))
      this.#state = Object.freeze({
        state: 'reloading',
        source: token.source,
        pauseSec: 0,
        reloadCount: this.#reloadCount,
        breakerSec: 0,
      })
  }

  #restoreReady(token: ResumeToken): boolean {
    if (this.now() - token.reloadingAt >= 15000) {
      this.#breakerUntil = this.now() + 90000
      this.#finish('failed', 'reload-timeout')
      return false
    }
    if (this.#token !== token || !this.isActive() || !this.#owns(token, this.player.controls())) {
      if (this.#token === token) this.#finish('failed', 'ownership-ended')
      return false
    }
    return true
  }

  #positionMatches(reading: RestoreReadback): boolean {
    if (
      !reading.landing ||
      reading.positionSec === null ||
      reading.seeking !== false ||
      reading.paused === null
    )
      return false
    if (!reading.paused && reading.rate === null) return false
    const expected =
      reading.landing.positionSec +
      (reading.paused ? 0 : (reading.rate! * Math.max(0, this.now() - reading.landing.at)) / 1000)
    return Math.abs(reading.positionSec - expected) <= 1
  }

  #restore(token: ResumeToken, snapshot: VideoSnapshot): void {
    if (!this.#restoreReady(token)) return
    token.restore ??= {
      targetSec: snapshot.duration
        ? Math.min(token.savedPositionSec, Math.max(0, snapshot.duration - 0.1))
        : token.savedPositionSec,
      phase: token.restorePosition ? 'position' : 'rate',
      attempt: null,
      positionAttempt: null,
      issuedAt: 0,
      positionNativeUsed: false,
      rateNativeUsed: false,
      channel: 'none',
      result: 'unknown',
    }
    const plan = token.restore
    const valid = () =>
      this.#token === token &&
      this.isActive() &&
      this.now() - token.reloadingAt < 15000 &&
      this.#owns(token, this.player.controls())
    try {
      for (let step = 0; step < 2; step++) {
        if (!this.#restoreReady(token)) return
        if (!token.restorePosition && plan.phase === 'position') {
          plan.phase = 'rate'
          plan.attempt = null
        }
        if (!plan.attempt) {
          plan.issuedAt = this.now()
          plan.attempt = this.player.performRestore(
            {
              kind: plan.phase,
              value: plan.phase === 'position' ? plan.targetSec : token.savedRate,
              at: plan.issuedAt,
            },
            { reloadRevision: token.reloadRevision ?? -1, valid, now: this.now },
          )
          if (plan.phase === 'position') plan.positionAttempt = plan.attempt
        }
        if (!this.#restoreReady(token)) return
        let reading = this.player.readRestore(plan.attempt)
        plan.channel = reading.channel
        plan.result = reading.status === 'pending' ? 'pending' : 'unknown'
        if (!reading.owned || !this.#restoreReady(token)) return
        const correct = () =>
          plan.phase === 'position'
            ? this.#positionMatches(reading)
            : reading.rate === token.savedRate &&
              reading.seeking === false &&
              reading.positionSec !== null
        if (!correct()) {
          if (reading.positionSec !== null && reading.rate !== null && reading.status !== 'pending')
            plan.result = 'mismatch'
          if (reading.status === 'rejected') {
            this.#finish('failed', 'restore-threw')
            return
          }
          if (reading.channel === 'native') {
            if (plan.phase === 'position') plan.positionNativeUsed = true
            else plan.rateNativeUsed = true
          }
          const used = plan.phase === 'position' ? plan.positionNativeUsed : plan.rateNativeUsed
          const known =
            plan.phase === 'position'
              ? reading.positionSec !== null &&
                reading.paused !== null &&
                (reading.paused || reading.rate !== null) &&
                Math.abs(
                  reading.positionSec -
                    (reading.landing
                      ? reading.landing.positionSec +
                        (reading.paused
                          ? 0
                          : (reading.rate! * Math.max(0, this.now() - reading.landing.at)) / 1000)
                      : plan.targetSec),
                ) > 1
              : reading.rate !== null && reading.rate !== token.savedRate
          if (
            !used &&
            known &&
            reading.status !== 'pending' &&
            reading.seeking === false &&
            reading.readyState !== null &&
            reading.readyState >= 1 &&
            this.now() - plan.issuedAt >= 1000
          ) {
            if (plan.phase === 'position') plan.positionNativeUsed = true
            else plan.rateNativeUsed = true
            if (!this.#restoreReady(token)) return
            this.player.correctRestore(plan.attempt)
            if (!this.#restoreReady(token)) return
            reading = this.player.readRestore(plan.attempt)
            plan.channel = reading.channel
          }
          if (!reading.owned || !correct()) return
        }
        plan.result = 'verified'
        if (plan.phase === 'position') {
          plan.phase = 'rate'
          plan.attempt = null
          continue
        }
        if (
          plan.positionAttempt &&
          !this.#positionMatches(this.player.readRestore(plan.positionAttempt))
        )
          return
        this.#resumeVerified(token, plan.attempt)
        return
      }
    } catch {
      if (this.#token === token) this.#finish('failed', 'restore-threw')
    }
  }

  #resumeVerified(token: ResumeToken, rateAttempt: RestoreAttempt): void {
    if (!this.#restoreReady(token)) return
    const beforePlay = this.player.readRestore(rateAttempt)
    if (
      !beforePlay.owned ||
      beforePlay.positionSec === null ||
      beforePlay.rate !== token.savedRate ||
      beforePlay.paused === null ||
      beforePlay.seeking !== false ||
      !this.#restoreReady(token)
    )
      return
    const playAt = this.now()
    const lifecycle = this.#lifecycleSerial
    let playResult: unknown
    if (token.wasPlaying) {
      this.#suppress = true
      try {
        playResult = this.player.play(() => this.#restoreReady(token))
      } catch {
        if (this.#token === token) this.#finish('recovered-paused', 'play-threw')
        return
      } finally {
        this.#suppress = false
      }
    }
    if (playResult !== null && (typeof playResult === 'object' || typeof playResult === 'function'))
      void Promise.resolve(playResult).catch(() => {
        if (
          this.#lifecycleSerial !== lifecycle ||
          this.#token !== token ||
          !this.#owns(token, this.player.controls())
        )
          return
        this.#finish('recovered-paused', 'play-rejected')
      })
    if (!this.#restoreReady(token)) return
    const reading = this.player.readRestore(rateAttempt)
    if (
      !reading.owned ||
      (reading.rate !== null && reading.rate !== token.savedRate) ||
      (reading.positionSec !== null &&
        Math.abs(
          reading.positionSec -
            beforePlay.positionSec -
            (reading.paused ? 0 : (token.savedRate * Math.max(0, this.now() - playAt)) / 1000),
        ) > 1)
    ) {
      if (this.#token === token) this.#finish('failed', 'restore-mismatch')
      return
    }
    const baseline = this.player.snapshot(),
      controls = this.player.controls()
    if (!this.#restoreReady(token)) return
    token.restored = true
    token.restoredAt = this.now()
    token.restoreBaseline = { positionSec: beforePlay.positionSec, at: playAt }
    token.restore!.result =
      reading.positionSec === null || reading.rate === null ? 'unknown' : 'verified'
    this.#lastSnapshot = {
      ...baseline,
      currentTime: reading.positionSec ?? beforePlay.positionSec,
      playbackRate: token.savedRate,
    }
    this.#lastFrames = baseline.frames
    this.#lastControls = controls
    this.#progressTicks = 0
    this.#state = Object.freeze({
      state: 'waiting',
      source: token.source,
      pauseSec: 0,
      reloadCount: this.#reloadCount,
      breakerSec: 0,
      savedPositionSec: token.savedPositionSec,
      savedRate: token.savedRate,
    })
  }

  #restoredProgressValid(token: ResumeToken, snapshot: VideoSnapshot): boolean {
    if (!token.restored || !token.restoreBaseline) return true
    return this.#matchesRestoreProgress(
      {
        attempt: token.restore!.attempt!,
        controls: token.controls,
        positionSec: token.restoreBaseline.positionSec,
        at: token.restoreBaseline.at,
        rate: token.savedRate,
      },
      snapshot,
    )
  }

  #matchesRestoreProgress(baseline: RestoreProgressObservation, snapshot: VideoSnapshot): boolean {
    const elapsed = Math.max(0, this.now() - baseline.at) / 1000
    return (
      snapshot.playbackRate === baseline.rate &&
      Number.isFinite(snapshot.currentTime) &&
      snapshot.currentTime >= baseline.positionSec - 1 &&
      snapshot.currentTime <= baseline.positionSec + baseline.rate * elapsed + 1
    )
  }

  #owns(token: ResumeToken, _observed: PlayerControlSnapshot): boolean {
    const snapshot = this.player.snapshot()
    const eligible = this.isActive() && token.valid(),
      controls = this.player.controls()
    const ownedReload = this.#ownedReload(token, controls)
    const stillEligible = this.isActive() && token.valid(),
      positionValid = this.player.validateResumePosition(token.positionCapture),
      current = this.player.controls()
    // Every adapter read may invoke SDK code. Reject control changes during the
    // reads rather than committing ownership from a pre-getter snapshot.
    if (
      this.#token !== token ||
      !eligible ||
      !stillEligible ||
      !positionValid ||
      controls.userRevision !== current.userRevision ||
      controls.seekRevision !== current.seekRevision ||
      controls.mediaId !== current.mediaId ||
      controls.coreId !== current.coreId ||
      controls.reloadRevision !== current.reloadRevision ||
      current.dragging
    )
      return false
    if (ownedReload) {
      // Without a current goal proof, SDK initialization invalidates the saved
      // target. A proved first initialization may wait within this same action.
      // Null core is a gap; only its marked replacement can own restoration.
      if (
        controls.seekRevision !== token.controls.seekRevision &&
        !this.#initializationOwned(token, controls)
      )
        token.restorePosition = false
      token.controls = {
        ...controls,
        coreId: controls.coreId === 0 ? token.controls.coreId : controls.coreId,
      }
    }
    return (
      this.#token === token &&
      eligible &&
      !controls.dragging &&
      !snapshot.ended &&
      !snapshot.mediaError &&
      (!snapshot.paused || token.initiallyPaused || ownedReload) &&
      controls.mediaId === token.controls.mediaId &&
      (controls.coreId === token.controls.coreId || ownedReload) &&
      controls.userRevision === token.controls.userRevision &&
      controls.seekRevision === token.controls.seekRevision
    )
  }

  #ownedReload(token: ResumeToken, controls: PlayerControlSnapshot): boolean {
    const revision = token.reloadRevision
    return (
      this.#token === token &&
      !!token.reloadingAt &&
      revision !== null &&
      controls.reloadRevision === revision &&
      controls.mediaId === token.controls.mediaId &&
      controls.userRevision === token.controls.userRevision &&
      !controls.dragging &&
      (controls.coreId === token.controls.coreId ||
        controls.coreId === 0 ||
        controls.coreReloadRevision === revision) &&
      this.player.ownedReload?.(revision) === true &&
      this.#token === token
    )
  }

  #initializationOwned(token: ResumeToken, controls: PlayerControlSnapshot): boolean {
    return (
      token.positionCapture.proof !== null &&
      token.reloadRevision !== null &&
      this.#ownedReload(token, controls) &&
      this.player.validateResumePosition(token.positionCapture, token.reloadRevision)
    )
  }

  #acceptedReloadProgress(
    token: ResumeToken,
    snapshot: VideoSnapshot,
    controls: PlayerControlSnapshot,
  ): boolean {
    // The adapter's paused/gap lease remains finite. Once restore and genuine
    // progress are accepted, confirmation uses only that exact stable owner;
    // it grants no seek/rate/play side effects or new core adoption.
    return (
      this.#token === token &&
      token.restored &&
      token.firstProgressAt !== null &&
      token.reloadRevision !== null &&
      this.now() - token.firstProgressAt <= 15_000 &&
      snapshot.available &&
      !snapshot.paused &&
      !snapshot.seeking &&
      !snapshot.ended &&
      !snapshot.mediaError &&
      !controls.dragging &&
      controls.coreId !== 0 &&
      controls.mediaId === token.controls.mediaId &&
      controls.coreId === token.controls.coreId &&
      controls.userRevision === token.controls.userRevision &&
      controls.seekRevision === token.controls.seekRevision &&
      controls.reloadRevision === token.reloadRevision
    )
  }

  #finish(state: RecoverySnapshot['state'], reason: string = state): void {
    const token = this.#token
    const observedRestoration = this.#restoration()
    const restoration =
      observedRestoration && reason === 'restore-mismatch'
        ? Object.freeze({ ...observedRestoration, result: 'mismatch' as const })
        : observedRestoration
    this.#failedRestore =
      state === 'failed' && token?.restore?.attempt
        ? Object.freeze({
            attempt: token.restore.attempt,
            controls: Object.freeze({ ...token.controls }),
            positionSec: token.restoreBaseline?.positionSec ?? token.restore.targetSec,
            at: token.restoreBaseline?.at ?? token.restore.issuedAt,
            rate: token.savedRate,
          })
        : null
    this.#token = null
    this.#pauseAt = 0
    this.#unhook()
    this.#state = Object.freeze({
      state,
      reason,
      ...(token ? { savedPositionSec: token.savedPositionSec, savedRate: token.savedRate } : {}),
      ...(restoration ? { restoration } : {}),
      source: token?.source ?? null,
      pauseSec: 0,
      reloadCount: this.#reloadCount,
      breakerSec: Math.max(0, Math.ceil((this.#breakerUntil - this.now()) / 1000)),
    })
    if (token && ['failed', 'recovered', 'recovered-paused'].includes(state))
      this.#emit({
        type: 'core',
        at: this.now(),
        state: state as 'failed' | 'recovered' | 'recovered-paused',
        actionId: token.id,
        reason,
        source: token.source,
        savedPositionSec: token.savedPositionSec,
        savedRate: token.savedRate,
        readyState: this.#lastSnapshot?.readyState ?? 0,
        coreInitialized: this.#lastSnapshot?.coreInitialized ?? null,
      })
  }
  #emit(event: DomainEvent): void {
    for (const listener of this.#listeners) listener(event)
  }
}
