import type { VideoSnapshot, SchedulerPort, PlayerControlSnapshot } from './ports.ts'

import type { PlaybackDemand } from '../domain/model.ts'
import {
  comparePlaybackControls,
  playbackTimeAdvanced,
  playbackFramesAdvanced,
} from '../domain/playback-progress.ts'

interface StallEpisode {
  readonly id: number
  readonly startedAt: number
  readonly userRevision: number
  readonly mediaId: number
  targetSec: number
  longSeek: boolean
  seekRevision: number
  request: ReturnType<MonitorRoutes['latestRequested']>
  fallbackAttempted: boolean
  armed: boolean
  finished: boolean
  progressEnded: boolean
  readonly reloadCount: number
}

import type {
  MonitorPort,
  MonitorRoutes,
  MonitorPlayerPort,
  MonitorSessionPort,
  MonitorVaultPort,
  MonitorMeasurementPort,
  MonitorRecoveryPort,
} from './monitor-ports.ts'
export type {
  MonitorRoutes,
  MonitorPlayerPort,
  MonitorSessionPort,
  MonitorVaultPort,
  MonitorMeasurementPort,
  MonitorRecoveryPort,
} from './monitor-ports.ts'

import type { MonitorSnapshot } from './monitor-model.ts'
export type { MonitorSnapshot } from './monitor-model.ts'

export class PlayerMonitor implements MonitorPort {
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
  #failedStall: { readonly userRevision: number; readonly mediaId: number } | null = null
  #listeners = new Set<(snapshot: MonitorSnapshot) => void>()

  constructor(
    private readonly player: MonitorPlayerPort,
    private readonly session: MonitorSessionPort,
    private readonly settings: { get(): { readonly disabled: boolean } },
    private readonly vault: MonitorVaultPort,
    private readonly routes: MonitorRoutes,
    private readonly measurement: MonitorMeasurementPort,
    private readonly recovery: MonitorRecoveryPort,
    private readonly isVisible: () => boolean,
    private readonly now: () => number,
    private readonly scheduler: SchedulerPort,
  ) {
    this.#snapshot = Object.freeze({
      video: player.snapshot(),
      stableProgressSec: 0,
      watchdog: 'no-video',
      stallTicks: 0,
      startupRescue: { state: 'watching' as const, ageSec: 0 },
    })
  }

  start(): void {
    if (this.#timer === null) {
      this.#timer = this.scheduler.interval(() => this.tick(), 1000)
      this.tick()
    }
  }
  stop(): void {
    this.#timer?.()
    this.#timer = null
    this.#endStall()
    this.measurement.cancel('monitor-stop')
  }
  reset(): void {
    this.#lastTime = null
    this.#stableProgressSec = 0
    this.#stallTicks = 0
    this.#lastRecoveryAt = 0
    this.#seekGraceUntil = 0
    this.#manifestTick = 0
    this.#manifestReady = false
    this.#startupRescueAttempted = false
    this.#startupObservedProgress = false
    this.#lastFrames = null
    this.#startupRescueState = 'watching'
    this.#endStall()
    this.#controls = null
    this.#lastSeeking = false
    this.#failedStall = null
  }
  snapshot(): MonitorSnapshot {
    return this.#snapshot
  }
  dispose(): void {
    this.stop()
    this.#listeners.clear()
  }
  subscribe(listener: (snapshot: MonitorSnapshot) => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  tick(): void {
    const video = this.player.snapshot(),
      controls = this.player.controls(),
      now = this.now(),
      disabled = this.settings.get().disabled
    const originalMode = this.routes.isOriginalComparison()
    const visible = this.isVisible()
    this.routes.observePlaybackRate(video.available ? video.playbackRate : 0)
    if (!this.#manifestReady || this.#manifestTick++ % 5 === 0)
      this.#manifestReady = this.player.syncManifest()
    const { advanced, progress } = this.#sampleProgress(video, controls)
    const { active, ownedReload } = this.#advanceStall(
      video,
      controls,
      now,
      disabled,
      originalMode,
      visible,
      progress,
    )
    const firstMediaAt = this.routes.firstMediaAt()
    const watchdog = this.#observeWatchdog(video, controls, now, progress, advanced, ownedReload)
    if (
      !this.#stall &&
      !this.#failedStall &&
      !this.recovery.isRecovering() &&
      !controls.dragging &&
      !disabled &&
      !originalMode &&
      visible &&
      watchdog === 'recovering' &&
      (this.#startupObservedProgress || !firstMediaAt) &&
      now - this.#lastRecoveryAt >= 30_000
    ) {
      const state = this.session.get(),
        rep = state.representation
      if (rep) {
        this.routes.recover(rep, this.#demand(video), 'watchdog', state.affinity?.host ?? null)
        this.#lastRecoveryAt = now
      }
    }
    const startupAge = this.#observeStartup(
      video,
      controls,
      now,
      disabled,
      originalMode,
      visible,
      firstMediaAt,
    )
    const demand = this.#demand(video)
    this.measurement.tick({
      generationActive: true,
      representation: this.session.get().representation,
      demand,
      stableProgressSec: this.#stableProgressSec,
      playableBufferSec: video.playableBufferSec,
      visible,
      seeking: video.seeking || now < this.#seekGraceUntil,
      recovering: this.recovery.isRecovering(),
      disabled: disabled || originalMode,
    })
    this.#publishSnapshot(video, controls, active, watchdog, startupAge)
  }

  #sampleProgress(
    video: VideoSnapshot,
    controls: PlayerControlSnapshot,
  ): { readonly advanced: boolean; readonly progress: boolean } {
    const controlChanged = comparePlaybackControls(controls, this.#controls) === 'changed'
    const advanced =
      video.available &&
      !video.seeking &&
      !this.#lastSeeking &&
      !video.paused &&
      !video.ended &&
      !video.mediaError &&
      !controlChanged &&
      this.#lastTime !== null &&
      playbackTimeAdvanced(video.currentTime, this.#lastTime)
    const newFrames =
      video.frames !== null &&
      this.#lastFrames !== null &&
      playbackFramesAdvanced(video.frames, this.#lastFrames)
    const progress = advanced && (video.frames === null || newFrames)
    if (progress || (!video.seeking && video.playableBufferSec >= 1)) {
      this.#startupObservedProgress = true
      if (!this.#startupRescueAttempted) this.#startupRescueState = 'not-needed'
    }
    if (progress) this.#stableProgressSec++
    else this.#stableProgressSec = 0
    return { advanced, progress }
  }

  #advanceStall(
    video: VideoSnapshot,
    controls: PlayerControlSnapshot,
    now: number,
    disabled: boolean,
    originalMode: boolean,
    visible: boolean,
    progress: boolean,
  ): { readonly active: boolean; readonly ownedReload: boolean } {
    // An existing action owns its terminal deadline. Settle it before a paused
    // SDK transition can make the monitor cancel the same action generically.
    const recoveryTicked =
      !disabled && !originalMode && !!this.#stall?.armed && this.recovery.isRecovering()
    if (recoveryTicked) this.recovery.tick(video)
    if (
      this.#stall?.armed &&
      !this.recovery.isRecovering() &&
      this.recovery.snapshot().reloadCount > this.#stall.reloadCount &&
      ['failed', 'breaker', 'recovered-paused'].includes(this.recovery.snapshot().state)
    ) {
      this.#failedStall = { userRevision: this.#stall.userRevision, mediaId: this.#stall.mediaId }
    }
    if (
      progress ||
      (this.#failedStall &&
        (this.#failedStall.userRevision !== controls.userRevision ||
          this.#failedStall.mediaId !== controls.mediaId))
    )
      this.#failedStall = null
    const ownedReload =
      !!this.#stall && this.recovery.ongoingStallReload(this.#stall.id, video, controls)
    const active =
      !disabled &&
      !originalMode &&
      visible &&
      video.available &&
      (!video.paused || ownedReload) &&
      !video.ended &&
      !video.mediaError &&
      !controls.dragging
    if (!active) this.#endStall()
    else if (progress) this.#endStall(true)
    else if (
      !ownedReload &&
      (this.#startupObservedProgress || video.seeking || controls.pendingSeekGoal)
    )
      this.#observeStall(video, controls, now)
    if (!disabled && !originalMode && !recoveryTicked) this.recovery.tick(video)
    if (this.#stall?.armed && !this.recovery.isRecovering()) this.#stall.finished = true
    return { active, ownedReload }
  }

  #observeWatchdog(
    video: VideoSnapshot,
    controls: PlayerControlSnapshot,
    now: number,
    progress: boolean,
    advanced: boolean,
    ownedReload: boolean,
  ): MonitorSnapshot['watchdog'] {
    const fallbackAfter = this.#stall?.longSeek === false ? 6000 : 15_000
    let watchdog: MonitorSnapshot['watchdog'] = 'healthy'
    if (!video.available) {
      watchdog = 'no-video'
      this.#stallTicks = 0
    } else if (controls.dragging) {
      watchdog = 'seek-grace'
      this.#stallTicks = 0
    } else if (progress) {
      watchdog = 'healthy'
      this.#stallTicks = 0
    } else if (ownedReload) {
      watchdog = 'recovering'
      this.#stallTicks = 0
    } else if (video.paused || video.ended) {
      watchdog = 'paused'
      this.#stallTicks = 0
    } else if (video.seeking && (!this.#stall || now - this.#stall.startedAt < fallbackAfter)) {
      watchdog = 'seek-grace'
      this.#stallTicks = 0
    } else if (this.#stall && now - this.#stall.startedAt >= fallbackAfter) {
      watchdog = 'recovering'
      this.#stallTicks = Math.floor((now - this.#stall.startedAt) / 1000)
    } else if (video.bufferedToEnd) {
      watchdog = 'buffered-to-end'
      this.#stallTicks = 0
    } else if (advanced || video.playableBufferSec >= 2 || video.readyState >= 3) {
      watchdog = 'healthy'
      this.#stallTicks = 0
    } else {
      this.#stallTicks++
      watchdog = this.#stallTicks >= 6 ? 'recovering' : 'low-buffer'
    }
    return watchdog
  }

  #observeStartup(
    video: VideoSnapshot,
    controls: PlayerControlSnapshot,
    now: number,
    disabled: boolean,
    originalMode: boolean,
    visible: boolean,
    firstMediaAt: number,
  ): number {
    const startupAge = firstMediaAt ? Math.max(0, now - firstMediaAt) : 0
    if (
      !controls.dragging &&
      !disabled &&
      !originalMode &&
      visible &&
      firstMediaAt &&
      startupAge >= 15_000 &&
      !this.#startupRescueAttempted &&
      !this.#startupObservedProgress &&
      video.available &&
      !video.paused &&
      !video.seeking &&
      !video.ended &&
      !video.mediaError &&
      video.playableBufferSec < 1 &&
      (video.readyState <= 1 || (video.width === 0 && video.height === 0)) &&
      !this.recovery.isRecovering() &&
      now >= this.#seekGraceUntil
    ) {
      const requested = this.routes.latestRequested('video')
      if (
        requested?.representation &&
        requested.epoch === this.session.get().epoch &&
        requested.generation === this.session.get().generation
      ) {
        this.#startupRescueAttempted = true
        const fallback = this.routes.recoverStartup(
          requested.representation,
          this.#demand(video),
          requested.targetHost,
          this.measurement.startupFallbackHosts?.() ?? [],
        )
        this.#startupRescueState = fallback ? 'fallback-submitted' : 'no-alternative'
        if (fallback) this.recovery.armStartupFailure(video)
      }
    }
    return startupAge
  }

  #publishSnapshot(
    video: VideoSnapshot,
    controls: PlayerControlSnapshot,
    active: boolean,
    watchdog: MonitorSnapshot['watchdog'],
    startupAge: number,
  ): void {
    this.#lastTime = video.available ? video.currentTime : null
    this.#lastFrames = video.frames
    this.#lastSeeking = video.seeking
    this.#controls = controls
    if (!active) {
      this.#lastTime = null
      this.#lastFrames = null
    }
    this.#snapshot = Object.freeze({
      video,
      stableProgressSec: this.#stableProgressSec,
      watchdog,
      stallTicks: this.#stallTicks,
      startupRescue: { state: this.#startupRescueState, ageSec: Math.floor(startupAge / 1000) },
    })
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
    if (this.#failedStall) return
    const requested = this.routes.latestRequested('video'),
      state = this.session.get()
    if (
      this.#stall &&
      (this.#stall.userRevision !== controls.userRevision ||
        this.#controls?.mediaId !== controls.mediaId)
    )
      this.#endStall()
    if (!this.#stall)
      this.#stall = {
        id: ++this.#stallSerial,
        startedAt: now,
        userRevision: controls.userRevision,
        mediaId: controls.mediaId,
        seekRevision: controls.seekRevision,
        targetSec: video.currentTime,
        longSeek: video.seeking || controls.pendingSeekGoal === true,
        request: requested,
        fallbackAttempted:
          this.recovery.isRecovering() &&
          ['route-failure', 'watchdog'].includes(this.recovery.snapshot().source ?? ''),
        armed: false,
        finished: false,
        progressEnded: false,
        reloadCount: this.recovery.snapshot().reloadCount,
      }
    const stall = this.#stall
    const routeIntent =
      this.recovery.isRecovering() &&
      ['route-failure', 'watchdog'].includes(this.recovery.snapshot().source ?? '')
    if (routeIntent) stall.fallbackAttempted = true
    const deadCore =
      video.readyState === 0 &&
      video.width === 0 &&
      video.height === 0 &&
      video.coreInitialized === false &&
      video.manifestHasVideo
    const joinRouteIntent = routeIntent && !video.seeking && !deadCore
    if (this.recovery.snapshot().reloadCount > stall.reloadCount) stall.finished = true
    if (!stall.longSeek && (video.seeking || controls.pendingSeekGoal)) {
      stall.longSeek = true
      if (stall.armed) {
        this.recovery.cancelStall(stall.id)
        stall.armed = false
      }
    }
    const rebound =
      stall.seekRevision !== controls.seekRevision ||
      stall.request?.representation !== requested?.representation ||
      stall.request?.authorityRevision !== requested?.authorityRevision ||
      stall.request?.routePolicyRevision !== requested?.routePolicyRevision
    if (rebound) {
      this.recovery.cancelStall(stall.id)
      stall.finished ||= this.recovery.snapshot().reloadCount > stall.reloadCount
      stall.armed = false
      stall.seekRevision = controls.seekRevision
      stall.request = requested
      stall.targetSec = video.currentTime
    }
    if (video.seeking) stall.targetSec = video.currentTime
    const fallbackAfter = stall.longSeek ? 15_000 : 6000
    if (
      (now - stall.startedAt < fallbackAfter && !joinRouteIntent) ||
      stall.finished ||
      stall.armed
    )
      return
    if (
      !requested?.representation ||
      requested.generation !== state.generation ||
      requested.epoch !== state.epoch ||
      !this.routes.recoveryEligible(requested)
    ) {
      stall.finished = true
      this.recovery.rejectStall()
      return
    }
    const request = requested,
      revision = controls.seekRevision,
      mediaId = controls.mediaId
    const valid = (): boolean => {
      const current = this.player.controls(),
        latest = this.routes.latestRequested('video')
      if (
        (this.#stall !== stall && !stall.progressEnded) ||
        !this.isVisible() ||
        this.settings.get().disabled ||
        this.routes.isOriginalComparison() ||
        current.userRevision !== stall.userRevision ||
        current.mediaId !== mediaId
      )
        return false
      if (this.recovery.ongoingStallReload(stall.id, this.player.snapshot(), current))
        return (
          !!latest &&
          latest.generation === request.generation &&
          latest.epoch === request.epoch &&
          latest.routePolicyRevision === request.routePolicyRevision &&
          this.routes.recoveryEligible(latest)
        )
      return (
        current.seekRevision === revision &&
        latest?.representation === request.representation &&
        this.routes.recoveryEligible(request)
      )
    }
    stall.armed = true
    this.recovery.armStall(video, {
      id: stall.id,
      startedAt: stall.startedAt,
      targetSec: stall.targetSec,
      reloadAfterMs: stall.longSeek ? 30_000 : 12_000,
      valid,
    })
    if (!stall.fallbackAttempted) {
      stall.fallbackAttempted = true
      this.routes.recover(
        requested.representation,
        this.#demand(video),
        'watchdog',
        requested.targetHost,
      )
    }
  }

  #demand(video: VideoSnapshot): PlaybackDemand {
    const rep =
        this.routes.latestRequested('video')?.representation ?? this.session.get().representation,
      summary = rep ? this.vault.groupSummary(rep) : null
    const base = summary?.bandwidth
      ? summary.bandwidth / 1_000_000
      : summary?.kind === 'audio'
        ? 0.192
        : 4
    const kind = summary?.kind ?? 'video',
      requiredMbps = Math.max(kind === 'audio' ? 0.5 : 2, base * video.effectiveRate * 1.25)
    return { kind, requiredMbps, highDemand: requiredMbps >= 12 }
  }
}
