import { recoveryActionId, type DomainEvent, type RecoveryActionId } from '../domain/model.ts'
import type { PlayerPort, VideoSnapshot } from './ports.ts'

interface ResumeToken {
  readonly id: RecoveryActionId
  readonly source: 'trusted-player-play' | 'paused-transition' | 'route-failure' | 'watchdog'
  readonly startedAt: number
  readonly savedPositionSec: number
  readonly savedRate: number
  readonly wasPlaying: boolean
  readonly baselinePositionSec: number
  readonly baselineFrames: number | null
  reloadingAt: number
  restored: boolean
}

export interface RecoverySnapshot {
  readonly state: 'healthy' | 'pause-armed' | 'play-intent' | 'waiting' | 'reloading' | 'recovered' | 'recovered-paused' | 'failed' | 'breaker'
  readonly source: ResumeToken['source'] | null
  readonly pauseSec: number
  readonly reloadCount: number
  readonly breakerSec: number
}

export class RecoveryController {
  #listeners = new Set<(event: DomainEvent) => void>()
  #pauseAt = 0
  #hadHealthy = false
  #lastHealthyTime = 0
  #lastHealthyRate = 2
  #token: ResumeToken | null = null
  #serial = 0
  #reloadCount = 0
  #breakerUntil = 0
  #hookedPlayer: Record<string, unknown> | null = null
  #originalPlay: ((...args: unknown[]) => unknown) | null = null
  #wrappedPlay: ((...args: unknown[]) => unknown) | null = null
  #suppress = false
  #state: RecoverySnapshot = Object.freeze({ state: 'healthy', source: null, pauseSec: 0, reloadCount: 0, breakerSec: 0 })

  constructor(private readonly player: PlayerPort, private readonly now: () => number) {}
  subscribe(listener: (event: DomainEvent) => void): () => void { this.#listeners.add(listener); return () => this.#listeners.delete(listener) }
  snapshot(): RecoverySnapshot { return this.#state }
  isRecovering(): boolean { return !!this.#token }

  reset(): void {
    this.#unhook(); this.#pauseAt = 0; this.#hadHealthy = false; this.#lastHealthyTime = 0; this.#token = null
    this.#reloadCount = 0; this.#breakerUntil = 0
    this.#state = Object.freeze({ state: 'healthy', source: null, pauseSec: 0, reloadCount: 0, breakerSec: 0 })
  }

  armRouteFailure(source: 'route-failure' | 'watchdog', snapshot: VideoSnapshot): void {
    if (this.#token || snapshot.paused || snapshot.seeking || snapshot.ended || snapshot.mediaError || !this.#hadHealthy) return
    this.#begin(source, true)
  }

  tick(snapshot: VideoSnapshot): void {
    const now = this.now()
    const healthy = snapshot.available && !snapshot.mediaError && (snapshot.readyState >= 2 || snapshot.width > 0 || snapshot.height > 0 || (snapshot.frames ?? 0) > 0)
    if (healthy) {
      this.#hadHealthy = true; this.#lastHealthyTime = snapshot.currentTime; this.#lastHealthyRate = snapshot.playbackRate > 0 ? snapshot.playbackRate : 2
      if (this.#token) {
        if (this.#token.reloadingAt && !this.#token.restored) this.#restore(this.#token, snapshot)
        else if (!this.#token.reloadingAt && (snapshot.currentTime > this.#token.baselinePositionSec + 0.05
          || (snapshot.frames !== null && this.#token.baselineFrames !== null && snapshot.frames > this.#token.baselineFrames))) this.#finish('recovered')
      }
    }
    if (snapshot.paused && !snapshot.seeking && !snapshot.ended && this.#hadHealthy && !this.#token) {
      if (!this.#pauseAt) this.#pauseAt = now
      if (now - this.#pauseAt >= 30_000) this.#hook()
      this.#state = Object.freeze({ state: 'pause-armed', source: null, pauseSec: Math.floor((now - this.#pauseAt) / 1000),
        reloadCount: this.#reloadCount, breakerSec: Math.max(0, Math.ceil((this.#breakerUntil - now) / 1000)) })
    } else if (!snapshot.paused && this.#pauseAt && !this.#token) {
      const wasLong = now - this.#pauseAt >= 30_000
      this.#pauseAt = 0; this.#unhook()
      if (wasLong) this.#begin('paused-transition', true)
    }
    const token = this.#token
    if (!token) return
    if (snapshot.mediaError || snapshot.seeking || snapshot.ended) { this.#finish('failed'); return }
    if (healthy && !token.reloadingAt && (snapshot.currentTime > token.baselinePositionSec + 0.05
      || (snapshot.frames !== null && token.baselineFrames !== null && snapshot.frames > token.baselineFrames))) { this.#finish('recovered'); return }
    const dead = snapshot.readyState === 0 && snapshot.width === 0 && snapshot.height === 0 && snapshot.manifestHasVideo
      && snapshot.coreInitialized === false
    if (!token.reloadingAt && dead && now - token.startedAt >= 4000) this.#reload(token)
    if (token.reloadingAt && now - token.reloadingAt >= 15_000) { this.#breakerUntil = now + 90_000; this.#finish('failed') }
  }

  dispose(): void { this.#unhook(); this.#listeners.clear() }

  #hook(): void {
    const target = this.player.player(), current = target?.play
    if (!target || typeof current !== 'function' || (this.#hookedPlayer === target && this.#wrappedPlay === current)) return
    this.#unhook()
    const original = current as (...args: unknown[]) => unknown, self = this
    const wrapped = function(this: unknown, ...args: unknown[]): unknown {
      if (!self.#suppress) {
        let active = false
        try { active = unsafeWindow.navigator.userActivation?.isActive === true } catch { /* unsupported */ }
        if (active && self.#pauseAt && self.now() - self.#pauseAt >= 30_000) self.#begin('trusted-player-play', true)
      }
      return Reflect.apply(original, this, args)
    }
    try {
      target.play = wrapped
      this.#hookedPlayer = target; this.#originalPlay = original; this.#wrappedPlay = wrapped
    } catch { this.#hookedPlayer = null }
  }

  #unhook(): void {
    if (this.#hookedPlayer && this.#originalPlay && this.#wrappedPlay && this.#hookedPlayer.play === this.#wrappedPlay) {
      try { this.#hookedPlayer.play = this.#originalPlay } catch { /* site owns method */ }
    }
    this.#hookedPlayer = null; this.#originalPlay = null; this.#wrappedPlay = null
  }

  #begin(source: ResumeToken['source'], wasPlaying: boolean): void {
    const now = this.now()
    if (this.#token || now < this.#breakerUntil || this.#reloadCount >= 2) return
    const snapshot = this.player.snapshot()
    this.#token = { id: recoveryActionId(`core-${++this.#serial}`), source, startedAt: now,
      savedPositionSec: Math.max(0, this.player.currentTime() || this.#lastHealthyTime),
      savedRate: Math.max(0.25, Math.min(4, this.player.playbackRate() || this.#lastHealthyRate || 2)),
      wasPlaying, baselinePositionSec: snapshot.currentTime, baselineFrames: snapshot.frames, reloadingAt: 0, restored: false }
    this.#state = Object.freeze({ state: 'play-intent', source, pauseSec: this.#pauseAt ? Math.floor((now - this.#pauseAt) / 1000) : 0,
      reloadCount: this.#reloadCount, breakerSec: 0 })
  }

  #reload(token: ResumeToken): void {
    if (this.now() < this.#breakerUntil || this.#reloadCount >= 2) { this.#finish('breaker'); return }
    token.reloadingAt = this.now(); this.#reloadCount++
    this.#emit({ type: 'recovery', at: this.now(), action: { action: 'player-reload', id: token.id,
      savedPositionSec: token.savedPositionSec, savedRate: token.savedRate } })
    this.#emit({ type: 'core', at: this.now(), state: 'reloading', actionId: token.id })
    try { this.player.reload() } catch { this.#breakerUntil = this.now() + 90_000; this.#finish('failed'); return }
    this.#state = Object.freeze({ state: 'reloading', source: token.source, pauseSec: 0, reloadCount: this.#reloadCount, breakerSec: 0 })
  }

  #restore(token: ResumeToken, snapshot: VideoSnapshot): void {
    token.restored = true
    const position = snapshot.duration ? Math.min(token.savedPositionSec, Math.max(0, snapshot.duration - 0.1)) : token.savedPositionSec
    this.player.seek(position); this.player.setRate(token.savedRate)
    if (token.wasPlaying) {
      this.#suppress = true
      try { const result = this.player.play(); if (result && typeof (result as Promise<unknown>).catch === 'function') void (result as Promise<unknown>).catch(() => undefined) }
      finally { this.#suppress = false }
    }
    this.#emit({ type: 'core', at: this.now(), state: 'recovered', actionId: token.id })
    this.#finish(token.wasPlaying ? 'recovered' : 'recovered-paused')
  }

  #finish(state: RecoverySnapshot['state']): void {
    const token = this.#token
    if (state === 'failed' && token) this.#emit({ type: 'core', at: this.now(), state: 'failed', actionId: token.id })
    this.#token = null; this.#pauseAt = 0; this.#unhook()
    this.#state = Object.freeze({ state, source: token?.source ?? null, pauseSec: 0, reloadCount: this.#reloadCount,
      breakerSec: Math.max(0, Math.ceil((this.#breakerUntil - this.now()) / 1000)) })
  }
  #emit(event: DomainEvent): void { for (const listener of this.#listeners) listener(event) }
}
