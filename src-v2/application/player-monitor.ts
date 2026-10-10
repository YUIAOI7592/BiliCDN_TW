import type { PlayerPort, VideoSnapshot, SchedulerPort, PlayerControlSnapshot } from './ports.ts'
import type { RouteCoordinator } from './route-coordinator.ts'
import type { MeasurementController } from './measurement-controller.ts'
import type { RecoveryController } from './recovery-controller.ts'
import type { SessionStore } from '../state/session-store.ts'
import type { SignedRouteVault } from '../state/signed-route-vault.ts'
import type { PlaybackDemand } from '../domain/model.ts'
import type { RequestContext } from '../domain/model.ts'

export interface MonitorRoutes extends Pick<RouteCoordinator, 'observePlaybackRate' | 'isOriginalComparison' | 'firstMediaAt'> {
  latestRequested(kind: 'video' | 'audio'): Pick<RequestContext, 'generation' | 'epoch' | 'representation' | 'targetHost' | 'routePolicyRevision' | 'authorityRevision'> | null
  recoveryEligible: RouteCoordinator['recoveryEligible']
  recover(...args: Parameters<RouteCoordinator['recover']>): unknown
  recoverStartup(...args: Parameters<RouteCoordinator['recoverStartup']>): { readonly host: string | null } | null
}

interface StallEpisode {
  readonly id: number
  readonly startedAt: number
  readonly userRevision: number
  targetSec: number
  seekRevision: number
  request: ReturnType<MonitorRoutes['latestRequested']>
  fallbackAttempted: boolean
  armed: boolean
  finished: boolean
  progressEnded: boolean
  readonly reloadCount: number
}

export interface MonitorSnapshot {
  readonly video: VideoSnapshot
  readonly stableProgressSec: number
  readonly watchdog: 'no-video' | 'paused' | 'seek-grace' | 'buffered-to-end' | 'healthy' | 'low-buffer' | 'recovering'
  readonly stallTicks: number
  readonly startupRescue: { readonly state: 'watching' | 'not-needed' | 'fallback-submitted' | 'no-alternative'; readonly ageSec: number }
}

export class PlayerMonitor {
  #timer: (() => void) | null = null
  #lastTime: number | null = null
  #stableProgressSec = 0
  #stallTicks = 0
  #lastRecoveryAt = 0
  #seekGraceUntil = 0
  #manifestTick = 0
  #manifestReady = false
  #startupRescueAttempted = false
  #startupObservedProgress = false
  #lastFrames: number | null = null
  #startupRescueState: MonitorSnapshot['startupRescue']['state'] = 'watching'
  #snapshot: MonitorSnapshot
  #controls: PlayerControlSnapshot | null = null
  #lastSeeking = false
  #stall: StallEpisode | null = null
  #stallSerial = 0
  #listeners = new Set<(snapshot: MonitorSnapshot) => void>()

  constructor(
    private readonly player: Pick<PlayerPort, 'controls' | 'snapshot' | 'syncManifest'>,
    private readonly session: Pick<SessionStore, 'get'>,
    private readonly settings: { get(): { readonly disabled: boolean } },
    private readonly vault: Pick<SignedRouteVault, 'groupSummary'>,
    private readonly routes: MonitorRoutes,
    private readonly measurement: Pick<MeasurementController, 'tick' | 'cancel' | 'startupFallbackHosts'>,
    private readonly recovery: Pick<RecoveryController, 'tick' | 'isRecovering' | 'armStartupFailure' | 'armStall' | 'cancelStall' | 'rejectStall' | 'snapshot'>,
    private readonly isVisible: () => boolean,
    private readonly now: () => number,
    private readonly scheduler: SchedulerPort,
  ) {
    this.#snapshot = Object.freeze({ video: player.snapshot(), stableProgressSec: 0, watchdog: 'no-video', stallTicks: 0,
      startupRescue: { state: 'watching' as const, ageSec: 0 } })
  }

  start(): void { if (this.#timer === null) { this.#timer = this.scheduler.interval(() => this.tick(), 1000); this.tick() } }
  stop(): void { this.#timer?.(); this.#timer = null; this.#endStall(); this.measurement.cancel('monitor-stop') }
  reset(): void { this.#lastTime = null; this.#stableProgressSec = 0; this.#stallTicks = 0; this.#lastRecoveryAt = 0; this.#seekGraceUntil = 0; this.#manifestTick = 0; this.#manifestReady = false;
    this.#startupRescueAttempted = false; this.#startupObservedProgress = false; this.#lastFrames = null; this.#startupRescueState = 'watching'
    this.#endStall(); this.#controls = null; this.#lastSeeking = false
  }
  snapshot(): MonitorSnapshot { return this.#snapshot }
  dispose(): void { this.stop(); this.#listeners.clear() }
  subscribe(listener: (snapshot: MonitorSnapshot) => void): () => void { this.#listeners.add(listener); return () => this.#listeners.delete(listener) }

  tick(): void {
    const video = this.player.snapshot(), controls = this.player.controls(), now = this.now(), disabled = this.settings.get().disabled
    const originalMode = this.routes.isOriginalComparison()
    const visible = this.isVisible()
    this.routes.observePlaybackRate(video.available ? video.playbackRate : 0)
    if (!this.#manifestReady || this.#manifestTick++ % 5 === 0) this.#manifestReady = this.player.syncManifest()
    const controlChanged = this.#controls !== null && (controls.seekRevision !== this.#controls.seekRevision
      || controls.userRevision !== this.#controls.userRevision || controls.mediaId !== this.#controls.mediaId)
    const advanced = video.available && !video.seeking && !this.#lastSeeking && !video.paused && !video.ended && !video.mediaError
      && !controlChanged && this.#lastTime !== null && video.currentTime - this.#lastTime > 0.05
    const newFrames = video.frames !== null && this.#lastFrames !== null && video.frames > this.#lastFrames
    const progress = advanced && (video.frames === null || newFrames)
    if (progress || (!video.seeking && video.playableBufferSec >= 1)) {
      this.#startupObservedProgress = true
      if (!this.#startupRescueAttempted) this.#startupRescueState = 'not-needed'
    }
    if (progress) this.#stableProgressSec++
    else this.#stableProgressSec = 0
    const active = !disabled && !originalMode && visible && video.available && !video.paused && !video.ended && !video.mediaError && !controls.dragging
    if (!active) this.#endStall()
    else if (progress) this.#endStall(true)
    else if (this.#startupObservedProgress || video.seeking) this.#observeStall(video, controls, now)
    if (!disabled && !originalMode) this.recovery.tick(video)
    if (this.#stall?.armed && !this.recovery.isRecovering()) this.#stall.finished = true
    const firstMediaAt = this.routes.firstMediaAt()
    let watchdog: MonitorSnapshot['watchdog'] = 'healthy'
    if (!video.available) { watchdog = 'no-video'; this.#stallTicks = 0 }
    else if (video.paused || video.ended) { watchdog = 'paused'; this.#stallTicks = 0 }
    else if (video.seeking && (!this.#stall || now - this.#stall.startedAt < 15_000)) { watchdog = 'seek-grace'; this.#stallTicks = 0 }
    else if (this.#stall && now - this.#stall.startedAt >= 15_000) { watchdog = 'recovering'; this.#stallTicks = Math.floor((now - this.#stall.startedAt) / 1000) }
    else if (video.bufferedToEnd) { watchdog = 'buffered-to-end'; this.#stallTicks = 0 }
    else if (advanced || video.playableBufferSec >= 2 || video.readyState >= 3) { watchdog = 'healthy'; this.#stallTicks = 0 }
    else { this.#stallTicks++; watchdog = this.#stallTicks >= 6 ? 'recovering' : 'low-buffer' }
    if (!this.#stall && !disabled && !originalMode && visible && watchdog === 'recovering' && (this.#startupObservedProgress || !firstMediaAt)
      && now - this.#lastRecoveryAt >= 30_000) {
      const state = this.session.get(), rep = state.representation
      if (rep) {
        this.routes.recover(rep, this.#demand(video), 'watchdog', state.affinity?.host ?? null)
        this.#lastRecoveryAt = now
      }
    }
    const startupAge = firstMediaAt ? Math.max(0, now - firstMediaAt) : 0
    if (!disabled && !originalMode && visible && firstMediaAt && startupAge >= 15_000 && !this.#startupRescueAttempted && !this.#startupObservedProgress
      && video.available && !video.paused && !video.seeking && !video.ended && !video.mediaError
      && video.playableBufferSec < 1 && (video.readyState <= 1 || (video.width === 0 && video.height === 0))
      && !this.recovery.isRecovering() && now >= this.#seekGraceUntil) {
      const requested = this.routes.latestRequested('video')
      if (requested?.representation && requested.epoch === this.session.get().epoch
        && requested.generation === this.session.get().generation) {
        this.#startupRescueAttempted = true
        const fallback = this.routes.recoverStartup(requested.representation, this.#demand(video), requested.targetHost,
          this.measurement.startupFallbackHosts?.() ?? [])
        this.#startupRescueState = fallback ? 'fallback-submitted' : 'no-alternative'
        if (fallback) this.recovery.armStartupFailure(video)
      }
    }
    const demand = this.#demand(video)
    this.measurement.tick({ generationActive: true, representation: this.session.get().representation, demand,
      stableProgressSec: this.#stableProgressSec, playableBufferSec: video.playableBufferSec,
      visible, seeking: video.seeking || now < this.#seekGraceUntil,
      recovering: this.recovery.isRecovering(), disabled: disabled || originalMode })
    this.#lastTime = video.available ? video.currentTime : null
    this.#lastFrames = video.frames
    this.#lastSeeking = video.seeking; this.#controls = controls
    if (!active) { this.#lastTime = null; this.#lastFrames = null }
    this.#snapshot = Object.freeze({ video, stableProgressSec: this.#stableProgressSec, watchdog, stallTicks: this.#stallTicks,
      startupRescue: { state: this.#startupRescueState, ageSec: Math.floor(startupAge / 1000) } })
    for (const listener of this.#listeners) listener(this.#snapshot)
  }

  #endStall(progress = false): void {
    if (this.#stall) {
      this.#stall.progressEnded = progress
      if (!progress) this.recovery.cancelStall(this.#stall.id)
    }
    this.#stall = null
  }

  #observeStall(video: VideoSnapshot, controls: PlayerControlSnapshot, now: number): void {
    const requested = this.routes.latestRequested('video'), state = this.session.get()
    if (this.#stall && (this.#stall.userRevision !== controls.userRevision
      || this.#controls?.mediaId !== controls.mediaId)) this.#endStall()
    if (!this.#stall) this.#stall = { id: ++this.#stallSerial, startedAt: now, userRevision: controls.userRevision,
      seekRevision: controls.seekRevision, targetSec: video.currentTime, request: requested, fallbackAttempted: false,
      armed: false, finished: false, progressEnded: false, reloadCount: this.recovery.snapshot().reloadCount }
    const stall = this.#stall
    if (this.recovery.snapshot().reloadCount > stall.reloadCount) stall.finished = true
    const rebound = stall.seekRevision !== controls.seekRevision || stall.request?.representation !== requested?.representation
      || stall.request?.authorityRevision !== requested?.authorityRevision || stall.request?.routePolicyRevision !== requested?.routePolicyRevision
    if (rebound) {
      this.recovery.cancelStall(stall.id)
      stall.finished ||= this.recovery.snapshot().reloadCount > stall.reloadCount
      stall.armed = false; stall.seekRevision = controls.seekRevision; stall.request = requested; stall.targetSec = video.currentTime
    }
    if (video.seeking) stall.targetSec = video.currentTime
    if (now - stall.startedAt < 15_000 || stall.finished || stall.armed) return
    if (!requested?.representation || requested.generation !== state.generation || requested.epoch !== state.epoch
      || !this.routes.recoveryEligible(requested)) { stall.finished = true; this.recovery.rejectStall(); return }
    const request = requested, revision = controls.seekRevision
    const valid = (): boolean => (this.#stall === stall || stall.progressEnded) && this.isVisible() && !this.settings.get().disabled
      && !this.routes.isOriginalComparison() && this.player.controls().userRevision === stall.userRevision
      && this.player.controls().seekRevision === revision && this.routes.latestRequested('video')?.representation === request.representation
      && this.routes.recoveryEligible(request)
    stall.armed = true
    this.recovery.armStall(video, { id: stall.id, startedAt: stall.startedAt, targetSec: stall.targetSec, valid })
    if (!stall.fallbackAttempted) {
      stall.fallbackAttempted = true
      this.routes.recover(requested.representation, this.#demand(video), 'watchdog', requested.targetHost)
    }
  }

  #demand(video: VideoSnapshot): PlaybackDemand {
    const rep = this.routes.latestRequested('video')?.representation ?? this.session.get().representation, summary = rep ? this.vault.groupSummary(rep) : null
    const base = summary?.bandwidth ? summary.bandwidth / 1_000_000 : summary?.kind === 'audio' ? 0.192 : 4
    const kind = summary?.kind ?? 'video', requiredMbps = Math.max(kind === 'audio' ? 0.5 : 2, base * video.effectiveRate * 1.25)
    return { kind, requiredMbps, highDemand: requiredMbps >= 12 }
  }
}
