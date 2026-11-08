import {
  stallProgressTransition,
  type StallProgress,
  comparePlaybackControls,
  playbackTimeAdvanced,
  playbackFramesAdvanced,
} from '../../domain/playback-progress.ts'
import { type VideoSnapshot, type PlayerControlSnapshot } from './player-contracts.ts'
import { type SchedulerPort } from '../scheduler-contracts.ts'
import { type EarlyRetryPort } from '../routing/early-retry-contracts.ts'
import { controlPlaybackDemand, type PlaybackDemand } from '../../domain/playback-demand.ts'
import { readMonotonic } from '../../domain/measurement-time.ts'
import {
  type MonitorPort,
  type MonitorRoutes,
  type MonitorPlayerPort,
  type MonitorSessionPort,
  type MonitorVaultPort,
  type MonitorMeasurementPort,
  type MonitorRecoveryPort,
  type MonitorSnapshot,
} from './monitor-contracts.ts'
interface StallEpisode {
  readonly id: number
  readonly startedAt: number
  readonly userRevision: number
  readonly mediaId: number
  targetSec: number
  longSeek: boolean
  seekRevision: number
  request: ReturnType<MonitorRoutes['latestRequested']>
  fallback: 'available' | 'submitted'
  action: 'waiting' | 'armed' | 'spent'
  progress: StallProgress
  readonly reloadCount: number
}

export class PlayerMonitor implements MonitorPort {
  #timer: (() => void) | null = null
  #lastTime: number | null = null
  #stableProgressTicks = 0
  #sampleAt: number | null = null
  #stallTicks = 0
  #lastRecoveryAt = 0
  #seekGraceUntil = 0
  #manifestTick = 0
  #manifestReady = false
  #startupRescue:
    { phase: 'available' } | { phase: 'waiting'; qualification: string } | { phase: 'committed' } =
    { phase: 'available' }
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
    private readonly settings: {
      get(): {
        readonly disabled: boolean
        readonly earlyRetryEnabled?: boolean
        readonly fixedHost?: string | null
        readonly considerNativeSources?: boolean
      }
    },
    private readonly vault: MonitorVaultPort,
    private readonly routes: MonitorRoutes,
    private readonly measurement: MonitorMeasurementPort,
    private readonly recovery: MonitorRecoveryPort,
    private readonly isVisible: () => boolean,
    private readonly now: () => number,
    private readonly scheduler: SchedulerPort,
    private readonly earlyRetry?: EarlyRetryPort,
    private readonly monotonicNow: () => number | null = () => null,
  ) {
    this.#snapshot = Object.freeze({
      video: player.snapshot(),
      stableProgressTicks: 0,
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
    this.earlyRetry?.cancel('monitor-stop')
    this.#timer?.()
    this.#timer = null
    this.#endStall()
    this.measurement.cancel('monitor-stop')
  }
  reset(): void {
    this.earlyRetry?.reset()
    this.#lastTime = null
    this.#stableProgressTicks = 0
    this.#stallTicks = 0
    this.#lastRecoveryAt = 0
    this.#seekGraceUntil = 0
    this.#manifestTick = 0
    this.#manifestReady = false
    this.#startupRescue = { phase: 'available' }
    this.#sampleAt = null
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
    const playbackOwner = this.session.get(),
      playbackRequest = this.routes.latestRequested('video')
    const sampledTick = readMonotonic(this.monotonicNow),
      playbackRevision = this.player.playbackRevision?.() ?? 0
    const video = this.player.snapshot(),
      controls = this.player.controls(),
      now = this.now(),
      disabled = this.settings.get().disabled
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
      visible,
      progress,
    )
    const firstMediaAt = this.routes.firstMediaAt('video')
    const watchdog = this.#observeWatchdog(video, controls, now, progress, advanced, ownedReload)
    if (
      !this.#stall &&
      !this.#failedStall &&
      !this.recovery.isRecovering() &&
      !controls.dragging &&
      !disabled &&
      visible &&
      watchdog === 'recovering' &&
      (this.#startupObservedProgress || !firstMediaAt) &&
      now - this.#lastRecoveryAt >= 30_000
    ) {
      const state = this.session.get(),
        rep = state.representation
      if (rep) {
        this.routes.recover(
          rep,
          this.#demand(video),
          'watchdog',
          state.affinity?.host ?? null,
          this.routes.latestRequested('video')?.expectedBytes ?? null,
        )
        this.#lastRecoveryAt = now
      }
    }
    const startupAge = this.#observeStartup(video, controls, now, disabled, visible, firstMediaAt)
    const demand = this.#demand(video)
    this.measurement.tick({
      generationActive: true,
      representation: this.session.get().representation,
      demand,
      stableProgressTicks: this.#stableProgressTicks,
      playableBufferSec: video.playableBufferSec,
      visible,
      seeking: video.seeking || now < this.#seekGraceUntil,
      recovering: this.recovery.isRecovering(),
      disabled,
    })
    const retrySettings = this.settings.get()
    this.earlyRetry?.tick({
      enabled: retrySettings.earlyRetryEnabled === true,
      disabled,
      catalogOnly: !retrySettings.considerNativeSources,
      fixedHost: !!retrySettings.fixedHost,
      visible,
      recovering: this.recovery.isRecovering() || !!this.#stall,
      stableProgressTicks: this.#stableProgressTicks,
      video,
      controls,
      demand,
    })
    const routingPlayback =
      sampledTick !== null &&
      playbackRevision === (this.player.playbackRevision?.() ?? 0) &&
      Number.isFinite(video.playbackRate) &&
      video.playbackRate > 0 &&
      !disabled &&
      visible &&
      video.available &&
      !video.paused &&
      !video.seeking &&
      !video.ended &&
      !video.mediaError &&
      !controls.dragging &&
      playbackRequest &&
      playbackOwner === this.session.get() &&
      playbackOwner.representation === playbackRequest.representation
        ? {
            generation: playbackRequest.generation,
            epoch: playbackRequest.epoch,
            representation: playbackRequest.representation,
            routePolicyRevision: playbackRequest.routePolicyRevision,
            ...(playbackRequest.authorityRevision !== undefined
              ? { authorityRevision: playbackRequest.authorityRevision }
              : {}),
            ...(playbackRequest.selectionRevision !== undefined
              ? { selectionRevision: playbackRequest.selectionRevision }
              : {}),
            sampledAt: now,
            sampledTick,
            playbackRate: video.playbackRate,
            bufferAheadSec: video.bufferAheadSec,
            playbackRevision,
            playableBufferSec: video.playableBufferSec,
          }
        : null
    this.#publishSnapshot(video, controls, active, watchdog, startupAge, routingPlayback)
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
    if (progress) {
      this.#startupObservedProgress = true
      if (this.#startupRescue.phase !== 'committed') this.#startupRescueState = 'not-needed'
    }
    const now = this.now(),
      gap = this.#sampleAt === null ? null : now - this.#sampleAt
    if (gap !== null && gap <= 0) return { advanced, progress: false }
    this.#sampleAt = now
    if (progress)
      this.#stableProgressTicks =
        gap !== null && gap >= 1000 && gap <= 2000 ? this.#stableProgressTicks + 1 : 1
    else this.#stableProgressTicks = 0
    return { advanced, progress: progress && gap !== null && gap >= 1000 && gap <= 2000 }
  }

  #advanceStall(
    video: VideoSnapshot,
    controls: PlayerControlSnapshot,
    now: number,
    disabled: boolean,
    visible: boolean,
    progress: boolean,
  ): { readonly active: boolean; readonly ownedReload: boolean } {
    // An existing action owns its terminal deadline. Settle it before a paused
    // SDK transition can make the monitor cancel the same action generically.
    const recoveryTicked =
      !disabled && this.#stall?.action === 'armed' && this.recovery.isRecovering()
    if (recoveryTicked) this.recovery.tick(video)
    if (
      this.#stall?.action === 'armed' &&
      !this.recovery.isRecovering() &&
      this.recovery.snapshot().reloadCount > this.#stall.reloadCount &&
      ['failed', 'breaker', 'recovered-paused'].includes(this.recovery.snapshot().state)
    ) {
      this.#failedStall = { userRevision: this.#stall.userRevision, mediaId: this.#stall.mediaId }
    }
    if (
      (progress && this.#stableProgressTicks >= 10 && video.playableBufferSec >= 10) ||
      (this.#failedStall &&
        (this.#failedStall.userRevision !== controls.userRevision ||
          this.#failedStall.mediaId !== controls.mediaId))
    )
      this.#failedStall = null
    const ownedReload =
      !!this.#stall && this.recovery.ongoingStallReload(this.#stall.id, video, controls)
    const active =
      !disabled &&
      visible &&
      video.available &&
      (!video.paused || ownedReload) &&
      !video.ended &&
      !video.mediaError &&
      !controls.dragging
    if (!active) this.#endStall()
    else if (progress) {
      if (this.#stall) {
        const stall = this.#stall
        const transition = stallProgressTransition(
          stall.progress,
          'progress',
          video.playableBufferSec,
        )
        stall.progress = transition.next
        if (transition.complete) this.#endStall()
      }
    } else if (
      !ownedReload &&
      (this.#startupObservedProgress || video.seeking || controls.pendingSeekGoal)
    )
      this.#observeStall(video, controls, now)
    if (!disabled && !recoveryTicked) this.recovery.tick(video)
    if (this.#stall?.action === 'armed' && !this.recovery.isRecovering())
      this.#stall.action = 'spent'
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
    visible: boolean,
    firstMediaAt: number,
  ): number {
    const startupAge = firstMediaAt ? Math.max(0, now - firstMediaAt) : 0
    if (
      !controls.dragging &&
      !disabled &&
      visible &&
      firstMediaAt &&
      startupAge >= 15_000 &&
      this.#startupRescue.phase !== 'committed' &&
      !this.#startupObservedProgress &&
      video.available &&
      !video.paused &&
      !video.seeking &&
      !video.ended &&
      !video.mediaError &&
      video.playableBufferSec < 1 &&
      !this.recovery.isRecovering() &&
      now >= this.#seekGraceUntil
    ) {
      const requested = this.routes.latestRequested('video')
      if (
        requested?.representation &&
        requested.epoch === this.session.get().epoch &&
        requested.generation === this.session.get().generation &&
        this.routes.recoveryEligible(requested)
      ) {
        const qualification = [
          requested.generation,
          requested.epoch,
          requested.representation,
          requested.authorityRevision,
          requested.routePolicyRevision,
          requested.targetHost,
          this.vault.groupSummary(requested.representation)?.routeCount ?? 0,
        ].join(':')
        if (
          this.#startupRescue.phase === 'waiting' &&
          this.#startupRescue.qualification === qualification
        )
          return startupAge
        if (!this.routes.recoveryEligible(requested)) return startupAge
        this.#startupRescue = { phase: 'waiting', qualification }
        const fallback = this.routes.recoverStartup(
          requested.representation,
          this.#demand(video),
          requested.targetHost,
          this.measurement.startupFallbackHosts?.() ?? [],
        )
        this.#startupRescueState = fallback ? 'fallback-submitted' : 'no-alternative'
        if (fallback) {
          this.#startupRescue = { phase: 'committed' }
          this.recovery.armStartupFailure(video)
        }
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
    routingPlayback: import('../../domain/playback-demand.ts').RoutePlaybackFacts | null,
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
      routingPlayback,
      stableProgressTicks: this.#stableProgressTicks,
      watchdog,
      stallTicks: this.#stallTicks,
      stall: this.#stall
        ? Object.freeze({
            id: this.#stall.id,
            phase: this.#stall.progress.phase,
            action: this.#stall.action,
            startedAt: this.#stall.startedAt,
            fallbackAt: this.#stall.startedAt + (this.#stall.longSeek ? 15_000 : 6000),
            reloadAt: this.#stall.startedAt + (this.#stall.longSeek ? 30_000 : 12_000),
            fallbackAvailable: this.#stall.fallback === 'available',
          })
        : null,
      startupRescue: { state: this.#startupRescueState, ageSec: Math.floor(startupAge / 1000) },
    })
    for (const listener of this.#listeners) listener(this.#snapshot)
  }

  #endStall(): void {
    if (this.#stall) this.recovery.cancelStall(this.#stall.id)
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
        fallback:
          this.recovery.isRecovering() &&
          ['route-failure', 'watchdog'].includes(this.recovery.snapshot().source ?? '')
            ? 'submitted'
            : 'available',
        action: 'waiting',
        progress: { phase: 'stalled', ticks: 0 },
        reloadCount: this.recovery.snapshot().reloadCount,
      }
    const stall = this.#stall
    stall.progress = stallProgressTransition(
      stall.progress,
      'stalled',
      video.playableBufferSec,
    ).next
    const routeIntent =
      this.recovery.isRecovering() &&
      ['route-failure', 'watchdog'].includes(this.recovery.snapshot().source ?? '')
    if (routeIntent) stall.fallback = 'submitted'
    const deadCore =
      video.readyState === 0 &&
      video.width === 0 &&
      video.height === 0 &&
      video.coreInitialized === false &&
      video.manifestHasVideo
    const joinRouteIntent = routeIntent && !video.seeking && !deadCore
    if (this.recovery.snapshot().reloadCount > stall.reloadCount && stall.action !== 'armed')
      stall.action = 'spent'
    if (!stall.longSeek && (video.seeking || controls.pendingSeekGoal)) {
      stall.longSeek = true
      if (stall.action === 'armed') {
        this.recovery.cancelStall(stall.id)
        stall.action = 'waiting'
      }
    }
    const rebound =
      stall.seekRevision !== controls.seekRevision ||
      stall.request?.representation !== requested?.representation ||
      stall.request?.authorityRevision !== requested?.authorityRevision ||
      stall.request?.routePolicyRevision !== requested?.routePolicyRevision
    if (rebound) {
      this.recovery.cancelStall(stall.id)
      stall.action = this.recovery.snapshot().reloadCount > stall.reloadCount ? 'spent' : 'waiting'
      stall.seekRevision = controls.seekRevision
      stall.request = requested
      stall.targetSec = video.currentTime
    }
    if (video.seeking) stall.targetSec = video.currentTime
    const fallbackAfter = stall.longSeek ? 15_000 : 6000
    if (
      (now - stall.startedAt < fallbackAfter && !joinRouteIntent) ||
      stall.action === 'spent' ||
      stall.action === 'armed'
    )
      return
    if (
      !requested?.representation ||
      requested.generation !== state.generation ||
      requested.epoch !== state.epoch ||
      !this.routes.recoveryEligible(requested)
    ) {
      stall.action = 'spent'
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
        this.#stall !== stall ||
        !this.isVisible() ||
        this.settings.get().disabled ||
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
    stall.action = 'armed'
    this.recovery.armStall(video, {
      id: stall.id,
      startedAt: stall.startedAt,
      targetSec: stall.targetSec,
      reloadAfterMs: stall.longSeek ? 30_000 : 12_000,
      valid,
    })
    if (stall.fallback === 'available') {
      const decision = this.routes.recover(
        requested.representation,
        this.#demand(video),
        'watchdog',
        requested.targetHost,
        requested.expectedBytes ?? null,
      )
      if (
        decision &&
        typeof decision === 'object' &&
        'host' in decision &&
        decision.host &&
        decision.host !== requested.targetHost
      )
        stall.fallback = 'submitted'
    }
  }

  #demand(video: VideoSnapshot): PlaybackDemand {
    const rep =
        this.routes.latestRequested('video')?.representation ?? this.session.get().representation,
      summary = rep ? this.vault.groupSummary(rep) : null
    return controlPlaybackDemand(summary?.kind ?? 'video', summary?.bandwidth, video.playbackRate)
  }
}
