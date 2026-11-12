import {
  restoreTransition,
  restorePositionMatches,
  restorePositionMismatch,
  restoreProgressMatches,
} from '../../domain/restore-policy.ts'
import { type VideoSnapshot, type PlayerControlSnapshot } from './player-contracts.ts'
import {
  comparePlaybackControls,
  playbackTimeAdvanced,
  playbackFramesAdvanced,
} from '../../domain/playback-progress.ts'
import {
  type RecoveryPort,
  type RecoveryPlayerPort,
  type ResumePositionCapture,
  type RestoreAttempt,
  type RestoreReadback,
  type StallRecoveryIntent,
  type RecoverySnapshot,
  type RecoverySource,
} from './recovery-contracts.ts'
type ReloadState =
  | { readonly phase: 'waiting'; readonly revision: null }
  | { readonly phase: 'prepared'; readonly revision: number | null }
  | { readonly phase: 'submitted'; readonly revision: number | null; readonly at: number }

interface ResumeToken {
  readonly positionCapture: ResumePositionCapture
  readonly source: RecoverySource
  readonly startedAt: number
  readonly savedPositionSec: number
  readonly savedRate: number
  readonly wasPlaying: boolean
  readonly baselinePositionSec: number
  readonly baselineFrames: number | null
  reload: ReloadState
  restorePosition: boolean
  controls: PlayerControlSnapshot
  valid: () => boolean
  stall: StallRecoveryIntent | null
  firstProgressAt: number | null
  readonly initiallyPaused: boolean
  restore: RestorePlan | null
}

interface RestoreCommandStep {
  phase: 'position' | 'rate'
  attempt: RestoreAttempt | null
  positionAttempt: RestoreAttempt | null
  positionBaseline: { positionSec: number; at: number; rate: number; paused: boolean } | null
  issuedAt: number
}
interface RestorePlayStep {
  readonly phase: 'play'
  readonly attempt: RestoreAttempt
  readonly issuedAt: number
}
interface RestoreProgressStep {
  readonly phase: 'progress'
  readonly attempt: RestoreAttempt
  readonly issuedAt: number
  readonly progress: {
    readonly positionSec: number
    readonly at: number
    readonly restoredAt: number
  }
}
type RestoreStep = RestoreCommandStep | RestorePlayStep | RestoreProgressStep

interface RestorePlan {
  readonly targetSec: number
  step: RestoreStep
  nativeUsed: Record<'position' | 'rate', boolean>
  channel: RestoreReadback['channel']
  result: NonNullable<RecoverySnapshot['restoration']>['result']
}

function restored(
  token: ResumeToken | null | undefined,
): token is ResumeToken & { restore: RestorePlan & { step: RestoreProgressStep } } {
  return token?.restore?.step.phase === 'progress'
}

interface RestoreProgressObservation {
  readonly attempt: RestoreAttempt
  readonly controls: PlayerControlSnapshot
  readonly positionSec: number
  readonly at: number
  readonly rate: number
}

export class RecoveryController implements RecoveryPort {
  #pauseAt = 0
  #hadHealthy = false
  #lastHealthyTime = 0
  #lastHealthyRate = 1
  #startupReloaded = false
  #token: ResumeToken | null = null
  #reloadCount = 0
  #breakerUntil = 0
  #stopIntent: (() => void) | null = null
  #suppress = false
  #lifecycleSerial = 0
  #lastFrames: number | null = null
  #lastSnapshot: VideoSnapshot | null = null
  #lastControls: PlayerControlSnapshot | null = null
  #progressTicks = 0
  #failedRestore: RestoreProgressObservation | null = null
  #state: RecoverySnapshot = Object.freeze({
    state: 'healthy',
    source: null,
    reloadCount: 0,
  })

  constructor(
    private readonly player: RecoveryPlayerPort,
    private readonly now: () => number,
    private readonly isActive: () => boolean = () => true,
    private readonly captureEligibility: () => () => boolean = () => () => true,
  ) {}
  snapshot(): RecoverySnapshot {
    const restoration = this.#restoration()
    const token = this.#token
    return Object.freeze({
      ...this.#state,
      ...(restoration ? { restoration } : {}),
      remainingReloads: Math.max(0, 2 - this.#reloadCount),
      deadlineAt: token
        ? token.firstProgressAt !== null
          ? token.firstProgressAt + 15_000
          : token.reload.phase === 'submitted'
            ? token.reload.at + 15_000
            : token.stall
              ? token.stall.startedAt + (token.stall.reloadAfterMs ?? 30_000)
              : token.startedAt + (token.source === 'startup-failure' ? 4000 : 30_000)
        : undefined,
      nextAction: token
        ? token.restore?.step.phase === 'play'
          ? 'await-play'
          : token.restore
            ? 'verify-restore'
            : token.reload.phase === 'submitted'
              ? 'await-core'
              : 'await-reload-deadline'
        : 'none',
    })
  }

  #restoration(): RecoverySnapshot['restoration'] {
    const token = this.#token,
      plan = token?.restore
    return plan
      ? Object.freeze({
          phase: plan.step.phase,
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
      reloadCount: 0,
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
    const observation: RestoreProgressObservation | null = restored(token)
      ? {
          attempt: token.restore.step.attempt,
          controls: token.controls,
          positionSec: token.restore.step.progress.positionSec,
          at: token.restore.step.progress.at,
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
    if (restored(token) && plan)
      plan.result = !known
        ? 'unknown'
        : this.#matchesRestoreProgress(observation!, observed)
          ? 'verified'
          : 'mismatch'
    const { progress, newFrames } = this.#recordProgress(observed, previous, controls, known)
    if (this.#endInvalidToken(observed, controls, now)) return
    if (
      this.#token?.firstProgressAt !== null &&
      this.#token?.firstProgressAt !== undefined &&
      now - this.#token.firstProgressAt >= 15_000
    ) {
      this.#finish('failed', 'progress-not-sustained')
      return
    }
    const healthy = this.#observeCoreHealth(observed, newFrames)
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
      this.#token?.reload.phase === 'submitted' &&
      this.#token.firstProgressAt === null &&
      now - this.#token.reload.at >= 15_000
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

  #observeCoreHealth(snapshot: VideoSnapshot, newFrames: boolean): boolean {
    const healthy =
      snapshot.available &&
      !snapshot.mediaError &&
      (snapshot.readyState >= 2 || snapshot.width > 0 || snapshot.height > 0 || newFrames)
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
            controls.coreReloadRevision === this.#token.reload.revision &&
            snapshot.coreInitialized !== false))
      if (this.#token.reload.phase === 'submitted' && !restored(this.#token) && restoreReady)
        this.#restore(this.#token, snapshot)
      else if (
        this.#progressTicks >= 2 &&
        (this.#token.reload.phase !== 'submitted' || restored(this.#token)) &&
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
          reloadCount: this.#reloadCount,
        })
      else
        this.#state = Object.freeze({
          ...this.#state,
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
          reloadCount: this.#reloadCount,
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
    if (restored(token) && now <= token.restore.step.progress.restoredAt) return
    if (token.reload.phase === 'submitted' && !restored(token)) progress = false
    if (restored(token) && restoreKnown && !this.#restoredProgressValid(token, snapshot)) {
      this.#finish('failed', 'restore-mismatch')
      return
    }
    if (progress && (!restored(token) || now > token.restore.step.progress.restoredAt)) {
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
      snapshot.playableBufferSec < 1 &&
      snapshot.currentTime <= token.baselinePositionSec + 0.05 &&
      (snapshot.frames === null ||
        token.baselineFrames === null ||
        snapshot.frames <= token.baselineFrames)
    if (
      token.reload.phase !== 'submitted' &&
      (token.stall
        ? now - token.stall.startedAt >= (token.stall.reloadAfterMs ?? 30_000)
        : ((dead || startupStalled) && now - token.startedAt >= 4000) ||
          now - token.startedAt >= 30_000)
    )
      this.#reload(token)
    if (token.reload.phase === 'submitted' && now - token.reload.at >= 15_000) {
      this.#breakerUntil = now + 90_000
      this.#finish('failed', 'reload-timeout')
    }
  }

  dispose(): void {
    this.reset()
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
      source,
      startedAt: now,
      savedPositionSec: Math.max(0, Number.isFinite(position) ? position : this.#lastHealthyTime),
      savedRate: rate > 0 ? rate : this.#lastHealthyRate || 1,
      wasPlaying,
      baselinePositionSec: snapshot.currentTime,
      baselineFrames: snapshot.frames,
      reload: { phase: 'waiting', revision: null },
      controls,
      valid,
      stall,
      firstProgressAt: null,
      initiallyPaused: snapshot.paused,
      restorePosition: true,
      restore: null,
    }
    this.#state = Object.freeze({
      state: 'play-intent',
      source,
      reloadCount: this.#reloadCount,
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
    let prepared: ReturnType<RecoveryPlayerPort['prepareReload']>
    try {
      prepared = this.player.prepareReload()
    } catch (error) {
      if (this.#token === token)
        this.#finish(
          'failed',
          error instanceof Error && error.message.includes('ownership ended')
            ? 'ownership-ended'
            : 'reload-unavailable',
        )
      return
    }
    const ready = (): boolean => {
      try {
        return prepared?.valid() === true
      } catch {
        return false
      }
    }
    if (this.#token !== token) return
    if (!prepared || !ready()) {
      if (this.#token === token) this.#finish('failed', 'reload-unavailable')
      return
    }
    if (!this.#owns(token, this.player.controls()) || !this.isActive() || !ready()) {
      if (this.#token === token) this.#finish('failed', 'ownership-ended')
      return
    }
    const lifecycle = this.#lifecycleSerial
    if (!this.#owns(token, this.player.controls())) return
    try {
      const before = this.player.controls()
      if (!this.#owns(token, before)) return
      token.reload = {
        phase: 'prepared',
        revision: Number.isSafeInteger(before.reloadRevision) ? before.reloadRevision + 1 : null,
      }
      const result = prepared.dispatch(() => {
        if (
          !this.#owns(token, this.player.controls()) ||
          !this.isActive() ||
          !ready() ||
          this.#token !== token
        )
          return false
        token.reload = { phase: 'submitted', revision: token.reload.revision, at: this.now() }
        this.#reloadCount++
        if (token.source === 'startup-failure') this.#startupReloaded = true
        this.#breakerUntil = this.now() + 90_000
        return true
      })
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
        savedPositionSec: token.savedPositionSec,
        savedRate: token.savedRate,
        source: token.source,
        reloadCount: this.#reloadCount,
      })
  }

  #restoreReady(token: ResumeToken): boolean {
    if (token.reload.phase !== 'submitted') return false
    if (this.now() - token.reload.at >= 15000) {
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

  #advanceRestore(plan: RestorePlan, next: RestoreStep): boolean {
    const transition = restoreTransition(plan.step.phase, 'verified')
    if (transition.reason !== 'accepted' || transition.next !== next.phase) return false
    plan.step = next
    return true
  }

  #positionMatches(reading: RestoreReadback, plan?: RestorePlan): boolean {
    const anchor = plan?.step.phase === 'rate' ? plan.step.positionBaseline : null
    return restorePositionMatches(reading, anchor, () => this.now())
  }

  #restore(token: ResumeToken, snapshot: VideoSnapshot): void {
    if (!this.#restoreReady(token)) return
    token.restore ??= {
      targetSec: snapshot.duration
        ? Math.min(token.savedPositionSec, Math.max(0, snapshot.duration - 0.1))
        : token.savedPositionSec,
      step: {
        phase: token.restorePosition ? 'position' : 'rate',
        attempt: null,
        positionAttempt: null,
        positionBaseline: null,
        issuedAt: 0,
      },
      nativeUsed: { position: false, rate: false },
      channel: 'none',
      result: 'unknown',
    }
    const plan = token.restore
    if (plan.step.phase === 'progress' || plan.step.phase === 'play') return
    const valid = () =>
      this.#token === token &&
      this.isActive() &&
      token.reload.phase === 'submitted' &&
      this.now() - token.reload.at < 15000 &&
      this.#owns(token, this.player.controls())
    try {
      for (let step = 0; step < 2; step++) {
        if (!this.#restoreReady(token)) return
        if (plan.step.phase !== 'position' && plan.step.phase !== 'rate') return
        if (!token.restorePosition && plan.step.phase === 'position') {
          if (!this.#advanceRestore(plan, { ...plan.step, phase: 'rate', attempt: null })) return
        }
        if (!plan.step.attempt) {
          if (plan.step.phase === 'rate' && plan.step.positionAttempt) {
            const beforeRate = this.player.readRestore(plan.step.positionAttempt)
            if (
              !beforeRate.owned ||
              !this.#positionMatches(beforeRate, plan) ||
              !this.#restoreReady(token) ||
              beforeRate.positionSec === null ||
              beforeRate.rate === null ||
              beforeRate.paused === null
            )
              return
            plan.step.positionBaseline = {
              positionSec: beforeRate.positionSec,
              at: this.now(),
              rate: beforeRate.rate,
              paused: beforeRate.paused,
            }
          }
          plan.step.issuedAt = this.now()
          plan.step.attempt = this.player.performRestore(
            {
              kind: plan.step.phase,
              value: plan.step.phase === 'position' ? plan.targetSec : token.savedRate,
              at: plan.step.issuedAt,
            },
            { reloadRevision: token.reload.revision ?? -1, valid, now: this.now },
          )
          if (plan.step.phase === 'position') plan.step.positionAttempt = plan.step.attempt
        }
        if (!this.#restoreReady(token)) return
        let reading = this.player.readRestore(plan.step.attempt)
        plan.channel = reading.channel
        plan.result = reading.status === 'pending' ? 'pending' : 'unknown'
        if (!reading.owned || !this.#restoreReady(token)) return
        const correct = () =>
          plan.step.phase === 'position'
            ? this.#positionMatches(reading)
            : reading.rate === token.savedRate &&
              reading.seeking === false &&
              reading.positionSec !== null
        if (!correct()) {
          if (reading.positionSec !== null && reading.rate !== null && reading.status !== 'pending')
            plan.result = 'mismatch'
          if (reading.channel === 'native') {
            plan.nativeUsed[plan.step.phase] = true
          }
          const used = plan.nativeUsed[plan.step.phase]
          const known =
            plan.step.phase === 'position'
              ? restorePositionMismatch(reading, plan.targetSec, () => this.now())
              : reading.rate !== null && reading.rate !== token.savedRate
          if (
            !used &&
            known &&
            (plan.step.phase === 'position' || this.#positionMatches(reading, plan)) &&
            reading.status !== 'pending' &&
            reading.seeking === false &&
            reading.readyState !== null &&
            reading.readyState >= 1 &&
            this.now() - plan.step.issuedAt >= 1000
          ) {
            plan.nativeUsed[plan.step.phase] = true
            if (!this.#restoreReady(token)) return
            this.player.correctRestore(plan.step.attempt)
            if (!this.#restoreReady(token)) return
            reading = this.player.readRestore(plan.step.attempt)
            plan.channel = reading.channel
          }
          if (!reading.owned || !correct()) return
        }
        plan.result = 'verified'
        if (plan.step.phase === 'position') {
          if (reading.positionSec === null || reading.rate === null || reading.paused === null)
            return
          plan.step.positionBaseline = {
            positionSec: reading.positionSec,
            at: this.now(),
            rate: reading.rate,
            paused: reading.paused,
          }
          if (!this.#advanceRestore(plan, { ...plan.step, phase: 'rate', attempt: null })) return
          continue
        }
        if (
          plan.step.positionAttempt &&
          !this.#positionMatches(this.player.readRestore(plan.step.positionAttempt), plan)
        )
          return
        if (reading.positionSec === null || reading.rate === null || reading.paused === null) return
        plan.step.positionBaseline = {
          positionSec: reading.positionSec,
          at: this.now(),
          rate: reading.rate,
          paused: reading.paused,
        }
        this.#resumeVerified(token, plan.step.attempt)
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
    const beforePosition = beforePlay.positionSec
    if (
      !this.#advanceRestore(token.restore!, {
        phase: 'play',
        attempt: rateAttempt,
        issuedAt: token.restore!.step.issuedAt,
      })
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
    const complete = (): void => {
      if (token.restore?.step.phase !== 'play' || !this.#restoreReady(token)) return
      const reading = this.player.readRestore(rateAttempt)
      if (
        !reading.owned ||
        (reading.rate !== null && reading.rate !== token.savedRate) ||
        (reading.positionSec !== null &&
          Math.abs(
            reading.positionSec -
              beforePosition -
              (reading.paused ? 0 : (token.savedRate * Math.max(0, this.now() - playAt)) / 1000),
          ) > 1)
      ) {
        if (this.#token === token) this.#finish('failed', 'restore-mismatch')
        return
      }
      const baseline = this.player.snapshot(),
        controls = this.player.controls()
      if (!this.#restoreReady(token)) return
      const restoredAt = this.now()
      if (
        !this.#advanceRestore(token.restore!, {
          phase: 'progress',
          attempt: rateAttempt,
          issuedAt: token.restore!.step.issuedAt,
          progress: { positionSec: beforePosition, at: playAt, restoredAt },
        })
      )
        return
      token.restore!.result =
        reading.positionSec === null || reading.rate === null ? 'unknown' : 'verified'
      this.#lastSnapshot = {
        ...baseline,
        currentTime: reading.positionSec ?? beforePosition,
        playbackRate: token.savedRate,
      }
      this.#lastFrames = baseline.frames
      this.#lastControls = controls
      this.#progressTicks = 0
      this.#state = Object.freeze({
        state: 'waiting',
        source: token.source,
        reloadCount: this.#reloadCount,
        savedPositionSec: token.savedPositionSec,
        savedRate: token.savedRate,
      })
    }
    if (
      playResult !== null &&
      (typeof playResult === 'object' || typeof playResult === 'function')
    ) {
      token.restore!.result = 'pending'
      this.#state = Object.freeze({ ...this.#state, state: 'waiting' })
      void Promise.resolve(playResult).then(
        () => {
          if (
            this.#lifecycleSerial === lifecycle &&
            this.#token === token &&
            this.#owns(token, this.player.controls())
          )
            complete()
        },
        () => {
          if (
            this.#lifecycleSerial === lifecycle &&
            this.#token === token &&
            this.#owns(token, this.player.controls())
          )
            this.#finish('recovered-paused', 'play-rejected')
        },
      )
      const actual = this.player.readRestore(rateAttempt)
      if (
        actual.owned &&
        actual.paused === false &&
        actual.rate === token.savedRate &&
        actual.positionSec !== null
      )
        complete()
      return
    }
    complete()
  }

  #restoredProgressValid(token: ResumeToken, snapshot: VideoSnapshot): boolean {
    if (!restored(token)) return true
    return this.#matchesRestoreProgress(
      {
        attempt: token.restore.step.attempt,
        controls: token.controls,
        positionSec: token.restore.step.progress.positionSec,
        at: token.restore.step.progress.at,
        rate: token.savedRate,
      },
      snapshot,
    )
  }

  #matchesRestoreProgress(baseline: RestoreProgressObservation, snapshot: VideoSnapshot): boolean {
    return restoreProgressMatches(baseline, snapshot, () => this.now())
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
    const revision = token.reload.revision
    return (
      this.#token === token &&
      token.reload.phase === 'submitted' &&
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
      token.reload.revision !== null &&
      this.#ownedReload(token, controls) &&
      this.player.validateResumePosition(token.positionCapture, token.reload.revision)
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
      restored(token) &&
      token.firstProgressAt !== null &&
      token.reload.revision !== null &&
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
      controls.reloadRevision === token.reload.revision
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
      state === 'failed' && token?.restore?.step.attempt
        ? Object.freeze({
            attempt: token.restore.step.attempt,
            controls: Object.freeze({ ...token.controls }),
            positionSec:
              token.restore.step.phase === 'progress'
                ? token.restore.step.progress.positionSec
                : token.restore.targetSec,
            at:
              token.restore.step.phase === 'progress'
                ? token.restore.step.progress.at
                : token.restore.step.issuedAt,
            rate: token.savedRate,
          })
        : null
    this.#token = null
    this.#pauseAt = 0
    this.#unhook()
    const snapshot: RecoverySnapshot = {
      state,
      reason,
      ...(token ? { savedPositionSec: token.savedPositionSec, savedRate: token.savedRate } : {}),
      ...(restoration ? { restoration } : {}),
      source: token?.source ?? null,
      reloadCount: this.#reloadCount,
    }
    // Preserve the injected clock read before publishing the terminal snapshot.
    this.now()
    this.#state = Object.freeze(snapshot)
  }
}
