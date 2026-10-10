import { recoveryActionId, type DomainEvent, type RecoveryActionId } from '../domain/model.ts'
import type { PlayerPort, VideoSnapshot, PlayerControlSnapshot } from './ports.ts'

export interface StallRecoveryIntent {
  readonly id: number
  readonly startedAt: number
  readonly targetSec: number
  readonly valid: () => boolean
}

interface ResumeToken {
  readonly id: RecoveryActionId
  readonly source: 'trusted-player-play' | 'paused-transition' | 'route-failure' | 'watchdog' | 'startup-failure' | 'stall'
  readonly startedAt: number
  readonly savedPositionSec: number
  readonly savedRate: number
  readonly wasPlaying: boolean
  readonly baselinePositionSec: number
  readonly baselineFrames: number | null
  reloadingAt: number
  restored: boolean
  controls: PlayerControlSnapshot
  readonly valid: () => boolean
  readonly stall: StallRecoveryIntent | null
  firstProgressAt: number | null
  readonly initiallyPaused: boolean
}

export interface RecoverySnapshot {
  readonly state: 'healthy' | 'pause-armed' | 'play-intent' | 'waiting' | 'reloading' | 'recovered' | 'recovered-paused' | 'failed' | 'breaker'
  readonly source: ResumeToken['source'] | null
  readonly pauseSec: number
  readonly reloadCount: number
  readonly breakerSec: number
  readonly reason?: string
  readonly savedPositionSec?: number
  readonly savedRate?: number
}

export class RecoveryController {
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
  #lastTickAt = 0
  #deadTicks = 0
  #deadReported = false
  #progressTicks = 0
  #state: RecoverySnapshot = Object.freeze({ state: 'healthy', source: null, pauseSec: 0, reloadCount: 0, breakerSec: 0 })

  constructor(private readonly player: Pick<PlayerPort, 'controls' | 'currentTime' | 'observePlayIntent' | 'play' | 'playbackRate' | 'reload' | 'seek' | 'setRate' | 'snapshot'>,
    private readonly now: () => number, private readonly isActive: () => boolean = () => true,
    private readonly captureEligibility: () => (() => boolean) = () => () => true) {}
  subscribe(listener: (event: DomainEvent) => void): () => void { this.#listeners.add(listener); return () => this.#listeners.delete(listener) }
  snapshot(): RecoverySnapshot { return this.#state }
  isRecovering(): boolean { return !!this.#token }

  reset(): void {
    if (this.#token) this.#finish('failed', 'lifecycle-ended')
    this.#lifecycleSerial++; this.#lastFrames = null; this.#lastSnapshot = null
    this.#lastTickAt = 0; this.#deadTicks = 0; this.#deadReported = false; this.#progressTicks = 0
    this.#unhook(); this.#pauseAt = 0; this.#hadHealthy = false; this.#lastHealthyTime = 0; this.#token = null
    this.#reloadCount = 0; this.#breakerUntil = 0; this.#startupReloaded = false; this.#lastHealthyRate = 1
    this.#state = Object.freeze({ state: 'healthy', source: null, pauseSec: 0, reloadCount: 0, breakerSec: 0 })
  }

  armRouteFailure(source: 'route-failure' | 'watchdog', snapshot: VideoSnapshot, valid: () => boolean = () => true): void {
    if (this.#token || snapshot.paused || snapshot.seeking || snapshot.ended || snapshot.mediaError || !this.#hadHealthy) return
    this.#begin(source, true, valid)
  }

  armStall(snapshot: VideoSnapshot, intent: StallRecoveryIntent): void {
    if (this.#token?.stall?.id === intent.id) return
    if (this.#token) this.#finish('failed', 'superseded-by-stall')
    if (!intent.valid() || snapshot.paused || snapshot.ended || snapshot.mediaError) return
    this.#begin('stall', true, intent.valid, intent)
  }

  cancelStall(id: number): void {
    if (this.#token?.stall?.id === id) this.#finish('failed', 'stall-ended')
  }

  rejectStall(): void { this.#finish('failed', 'no-legal-video-route') }

  armStartupFailure(snapshot: VideoSnapshot, valid: () => boolean = this.captureEligibility()): void {
    if (this.#token || this.#startupReloaded || snapshot.paused || snapshot.seeking || snapshot.ended || snapshot.mediaError
      || !snapshot.available || snapshot.playableBufferSec >= 1) return
    this.#begin('startup-failure', true, valid)
  }

  tick(snapshot: VideoSnapshot): void {
    const now = this.now()
    const previous = this.#lastSnapshot, controls = this.player.controls()
    const newFrames = snapshot.frames !== null && this.#lastFrames !== null && snapshot.frames > this.#lastFrames
    const progress = !!previous && !previous.seeking && !snapshot.seeking && !snapshot.paused && !snapshot.ended && !snapshot.mediaError
      && snapshot.currentTime - previous.currentTime > 0.05 && (snapshot.frames === null || newFrames)
    this.#progressTicks = progress ? this.#progressTicks + 1 : 0
    this.#lastFrames = snapshot.frames; this.#lastSnapshot = snapshot
    if (this.#token && (snapshot.mediaError || (snapshot.seeking && !this.#token.stall) || snapshot.ended)) {
      this.#finish('failed', snapshot.mediaError ? 'media-error' : snapshot.seeking ? 'seek-interrupted' : 'ended')
      return
    }
    if (this.#token && (!this.isActive() || !this.#owns(this.#token, controls))) {
      this.#finish('failed', 'ownership-ended'); return
    }
    const healthy = snapshot.available && !snapshot.mediaError && (snapshot.readyState >= 2 || snapshot.width > 0 || snapshot.height > 0 || newFrames)
    const deadObservation = this.#hadHealthy && snapshot.available && !snapshot.seeking && !snapshot.ended && !snapshot.mediaError
      && snapshot.readyState === 0 && snapshot.width === 0 && snapshot.height === 0 && snapshot.manifestHasVideo && snapshot.coreInitialized === false && !newFrames
    const gap = now - this.#lastTickAt
    this.#lastTickAt = now
    this.#deadTicks = deadObservation ? (gap > 0 && gap <= 2000 ? this.#deadTicks + 1 : 1) : 0
    if (healthy) this.#deadReported = false
    if (this.#deadTicks >= 4 && !this.#deadReported) {
      this.#deadReported = true
      this.#emit({ type: 'core-uninitialized', at: now, paused: snapshot.paused, intentPending: !!this.#token, consecutiveTicks: this.#deadTicks })
    }
    if (healthy) {
      this.#hadHealthy = true; this.#lastHealthyTime = snapshot.currentTime; this.#lastHealthyRate = snapshot.playbackRate > 0 ? snapshot.playbackRate : 2
      if (!this.#token && this.#progressTicks >= 2 && ['failed', 'breaker'].includes(this.#state.state)) this.#finish('recovered', 'playback-progress-observed')
      if (this.#token) {
        if (this.#token.reloadingAt && !this.#token.restored) this.#restore(this.#token, snapshot)
        else if (this.#progressTicks >= 2) this.#finish('recovered')
      }
    }
    if (snapshot.paused && !snapshot.seeking && !snapshot.ended && this.#hadHealthy && !this.#token) {
      if (!this.#pauseAt) this.#pauseAt = now
      this.#hook()
      if (!['failed', 'breaker'].includes(this.#state.state)) this.#state = Object.freeze({ state: 'pause-armed', source: null, pauseSec: Math.floor((now - this.#pauseAt) / 1000),
        reloadCount: this.#reloadCount, breakerSec: Math.max(0, Math.ceil((this.#breakerUntil - now) / 1000)) })
      else this.#state = Object.freeze({ ...this.#state, breakerSec: Math.max(0, Math.ceil((this.#breakerUntil - now) / 1000)) })
    } else if (!snapshot.paused && this.#pauseAt && !this.#token) {
      const wasLong = now - this.#pauseAt >= 30_000
      this.#pauseAt = 0; this.#unhook()
      if (wasLong) this.#begin('paused-transition', true)
      else if (healthy && this.#state.state === 'pause-armed') this.#state = Object.freeze({
        state: 'healthy', source: null, pauseSec: 0, reloadCount: this.#reloadCount,
        breakerSec: Math.max(0, Math.ceil((this.#breakerUntil - now) / 1000)),
      })
    }
    const token = this.#token
    if (!token) return
    if (snapshot.mediaError || (snapshot.seeking && !token.stall) || snapshot.ended) { this.#finish('failed', snapshot.mediaError ? 'media-error' : snapshot.seeking ? 'seek-interrupted' : 'ended'); return }
    if (snapshot.paused && token.stall) { this.#finish('failed', 'paused'); return }
    if (progress) { token.firstProgressAt ??= now; return }
    if (token.firstProgressAt !== null) {
      if (now - token.firstProgressAt >= 15_000) this.#finish('failed', 'progress-not-sustained')
      return
    }
    const dead = snapshot.readyState === 0 && snapshot.width === 0 && snapshot.height === 0 && snapshot.manifestHasVideo
      && snapshot.coreInitialized === false
    const startupStalled = token.source === 'startup-failure' && snapshot.readyState < 2 && snapshot.playableBufferSec < 1
      && snapshot.currentTime <= token.baselinePositionSec + 0.05
      && (snapshot.frames === null || token.baselineFrames === null || snapshot.frames <= token.baselineFrames)
    if (!token.reloadingAt && (token.stall ? now - token.stall.startedAt >= 30_000
      : ((dead || startupStalled) && now - token.startedAt >= 4000) || now - token.startedAt >= 30_000)) this.#reload(token)
    if (token.reloadingAt && now - token.reloadingAt >= 15_000) { this.#breakerUntil = now + 90_000; this.#finish('failed', 'reload-timeout') }
  }

  dispose(): void { this.reset(); this.#listeners.clear() }

  #hook(): void {
    this.#unhook()
    this.#stopIntent = this.player.observePlayIntent(() => {
      if (!this.#suppress && this.#pauseAt && this.now() - this.#pauseAt >= 30_000) this.#begin('trusted-player-play', true)
    })
  }

  #unhook(): void { this.#stopIntent?.(); this.#stopIntent = null }

  #begin(source: ResumeToken['source'], wasPlaying: boolean, valid: () => boolean = this.captureEligibility(), stall: StallRecoveryIntent | null = null): void {
    const lifecycle = this.#lifecycleSerial, before = this.player.controls()
    if (this.#token || before.dragging || !this.isActive() || !valid()
      || this.now() < this.#breakerUntil || this.#reloadCount >= 2) return
    // Adapter reads can synchronously run site code. Collect each saved value once,
    // then validate the preparation owner before committing a recovery action.
    const position = stall?.targetSec ?? this.player.currentTime(), rate = this.player.playbackRate()
    const snapshot = this.player.snapshot(), controls = this.player.controls(), now = this.now()
    const eligible = this.isActive() && valid()
    if (!eligible || this.#lifecycleSerial !== lifecycle || this.#token || controls.dragging
      || now < this.#breakerUntil || this.#reloadCount >= 2 || snapshot.ended || snapshot.mediaError
      || controls.mediaId !== before.mediaId || controls.coreId !== before.coreId
      || controls.seekRevision !== before.seekRevision || controls.userRevision !== before.userRevision) return
    this.#token = { id: recoveryActionId(`core-${++this.#serial}`), source, startedAt: now,
      savedPositionSec: Math.max(0, Number.isFinite(position) ? position : this.#lastHealthyTime),
      savedRate: rate > 0 ? rate : this.#lastHealthyRate || 1,
      wasPlaying, baselinePositionSec: snapshot.currentTime, baselineFrames: snapshot.frames, reloadingAt: 0, restored: false,
      controls, valid, stall, firstProgressAt: null, initiallyPaused: snapshot.paused }
    this.#state = Object.freeze({ state: 'play-intent', source, pauseSec: this.#pauseAt ? Math.floor((now - this.#pauseAt) / 1000) : 0,
      reloadCount: this.#reloadCount, breakerSec: 0 })
  }

  #reload(token: ResumeToken): void {
    if (!this.#owns(token, this.player.controls()) || !this.isActive()) { this.#finish('failed', 'ownership-ended'); return }
    if (this.now() < this.#breakerUntil || this.#reloadCount >= 2) { this.#finish('breaker'); return }
    token.reloadingAt = this.now(); this.#reloadCount++
    if (token.source === 'startup-failure') this.#startupReloaded = true
    this.#breakerUntil = this.now() + 90_000
    this.#emit({ type: 'recovery', at: this.now(), action: { action: 'player-reload', id: token.id,
      savedPositionSec: token.savedPositionSec, savedRate: token.savedRate } })
    this.#emit({ type: 'core', at: this.now(), state: 'reloading', actionId: token.id, source: token.source,
      savedPositionSec: token.savedPositionSec, savedRate: token.savedRate, readyState: this.#lastSnapshot?.readyState ?? 0,
      coreInitialized: this.#lastSnapshot?.coreInitialized ?? null })
    const lifecycle = this.#lifecycleSerial
    if (!this.#owns(token, this.player.controls())) return
    try {
      const result = this.player.reload()
      if (this.#token === token) {
        const next = this.player.controls()
        if (next.userRevision === token.controls.userRevision && next.seekRevision === token.controls.seekRevision) token.controls = next
      }
      if (result && typeof (result as Promise<unknown>).then === 'function') void Promise.resolve(result).catch(() => {
        if (this.#lifecycleSerial === lifecycle && this.#token === token) this.#finish('failed', 'reload-rejected')
      })
    } catch (error) { if (this.#token === token) this.#finish('failed', error instanceof Error && error.message === 'player.reload unavailable' ? 'reload-unavailable' : 'reload-threw'); return }
    if (this.#token === token && this.#owns(token, this.player.controls())) this.#state = Object.freeze({ state: 'reloading', source: token.source, pauseSec: 0, reloadCount: this.#reloadCount, breakerSec: 0 })
  }

  #restore(token: ResumeToken, snapshot: VideoSnapshot): void {
    if (!this.#owns(token, this.player.controls()) || !this.isActive()) { this.#finish('failed', 'ownership-ended'); return }
    token.restored = true
    const position = snapshot.duration ? Math.min(token.savedPositionSec, Math.max(0, snapshot.duration - 0.1)) : token.savedPositionSec
    try {
      this.player.seek(position)
      if (!this.#owns(token, this.player.controls()) || !this.isActive()) { if (this.#token === token) this.#finish('failed', 'ownership-ended'); return }
      this.player.setRate(token.savedRate)
    } catch { if (this.#token === token) this.#finish('failed', 'restore-threw'); return }
    const lifecycle = this.#lifecycleSerial
    let playResult: unknown
    if (token.wasPlaying) {
      if (!this.#owns(token, this.player.controls()) || !this.isActive()) { if (this.#token === token) this.#finish('failed', 'ownership-ended'); return }
      this.#suppress = true
      try { playResult = this.player.play() }
      catch { if (this.#token === token) this.#finish('recovered-paused', 'play-threw'); return }
      finally { this.#suppress = false }
    }
    if (this.#token !== token || !this.#owns(token, this.player.controls())) return
    this.#progressTicks = 0
    this.#state = Object.freeze({ state: 'waiting', source: token.source, pauseSec: 0, reloadCount: this.#reloadCount, breakerSec: 0,
      savedPositionSec: token.savedPositionSec, savedRate: token.savedRate })
    if (playResult && typeof (playResult as Promise<unknown>).then === 'function') void Promise.resolve(playResult).catch(() => {
      if (this.#lifecycleSerial !== lifecycle || this.#token !== token || !this.#owns(token, this.player.controls())) return
      this.#finish('recovered-paused', 'play-rejected')
    })
  }

  #owns(token: ResumeToken, controls: PlayerControlSnapshot): boolean {
    const snapshot = this.player.snapshot()
    if (this.#token === token && token.reloadingAt && !token.restored && controls.coreId !== token.controls.coreId
      && controls.coreReloadRevision !== 0 && controls.coreReloadRevision === token.controls.reloadRevision
      && controls.userRevision === token.controls.userRevision && controls.seekRevision === token.controls.seekRevision) token.controls = controls
    return this.#token === token && this.isActive() && token.valid() && !controls.dragging
      && !snapshot.ended && !snapshot.mediaError && (!snapshot.paused || token.initiallyPaused)
      && controls.mediaId === token.controls.mediaId && controls.coreId === token.controls.coreId
      && controls.userRevision === token.controls.userRevision && controls.seekRevision === token.controls.seekRevision
  }

  #finish(state: RecoverySnapshot['state'], reason: string = state): void {
    const token = this.#token
    this.#token = null; this.#pauseAt = 0; this.#unhook()
    this.#state = Object.freeze({ state, reason, ...(token ? { savedPositionSec: token.savedPositionSec, savedRate: token.savedRate } : {}), source: token?.source ?? null, pauseSec: 0, reloadCount: this.#reloadCount,
      breakerSec: Math.max(0, Math.ceil((this.#breakerUntil - this.now()) / 1000)) })
    if (token && ['failed', 'recovered', 'recovered-paused'].includes(state)) this.#emit({ type: 'core', at: this.now(),
      state: state as 'failed' | 'recovered' | 'recovered-paused', actionId: token.id, reason, source: token.source,
      savedPositionSec: token.savedPositionSec, savedRate: token.savedRate, readyState: this.#lastSnapshot?.readyState ?? 0,
      coreInitialized: this.#lastSnapshot?.coreInitialized ?? null })
  }
  #emit(event: DomainEvent): void { for (const listener of this.#listeners) listener(event) }
}
