import type { PlayerPort, VideoSnapshot } from './ports.ts'
import type { RouteCoordinator } from './route-coordinator.ts'
import type { MeasurementController } from './measurement-controller.ts'
import type { RecoveryController } from './recovery-controller.ts'
import type { SessionStore } from '../state/session-store.ts'
import type { SettingsStore } from '../state/settings-store.ts'
import type { SignedRouteVault } from '../state/signed-route-vault.ts'
import type { PlaybackDemand } from '../domain/model.ts'

export interface MonitorSnapshot {
  readonly video: VideoSnapshot
  readonly stableProgressSec: number
  readonly watchdog: 'no-video' | 'paused' | 'seek-grace' | 'buffered-to-end' | 'healthy' | 'low-buffer' | 'recovering'
  readonly stallTicks: number
  readonly startupRescue: { readonly state: 'watching' | 'not-needed' | 'fallback-submitted' | 'no-alternative'; readonly ageSec: number }
}

export class PlayerMonitor {
  #timer: number | null = null
  #lastTime = 0
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
  #listeners = new Set<(snapshot: MonitorSnapshot) => void>()

  constructor(
    private readonly player: PlayerPort,
    private readonly session: SessionStore,
    private readonly settings: SettingsStore,
    private readonly vault: SignedRouteVault,
    private readonly routes: RouteCoordinator,
    private readonly measurement: MeasurementController,
    private readonly recovery: RecoveryController,
    private readonly isVisible: () => boolean,
    private readonly now: () => number,
  ) {
    this.#snapshot = Object.freeze({ video: player.snapshot(), stableProgressSec: 0, watchdog: 'no-video', stallTicks: 0,
      startupRescue: { state: 'watching' as const, ageSec: 0 } })
  }

  start(): void { if (this.#timer === null) { this.#timer = window.setInterval(() => this.tick(), 1000); this.tick() } }
  stop(): void { if (this.#timer !== null) clearInterval(this.#timer); this.#timer = null; this.measurement.cancel('monitor-stop') }
  reset(): void { this.#lastTime = 0; this.#stableProgressSec = 0; this.#stallTicks = 0; this.#lastRecoveryAt = 0; this.#seekGraceUntil = 0; this.#manifestTick = 0; this.#manifestReady = false;
    this.#startupRescueAttempted = false; this.#startupObservedProgress = false; this.#lastFrames = null; this.#startupRescueState = 'watching'
    this.measurement.reset(); this.recovery.reset(); this.player.reset() }
  snapshot(): MonitorSnapshot { return this.#snapshot }
  subscribe(listener: (snapshot: MonitorSnapshot) => void): () => void { this.#listeners.add(listener); return () => this.#listeners.delete(listener) }

  tick(): void {
    const video = this.player.snapshot(), now = this.now(), disabled = this.settings.get().disabled
    this.routes.observePlaybackRate(video.available ? video.playbackRate : 0)
    if (!this.#manifestReady || this.#manifestTick++ % 5 === 0) this.#manifestReady = this.player.syncManifest()
    if (video.seeking) this.#seekGraceUntil = now + (this.#demand(video).highDemand ? 8000 : 5000)
    const advanced = video.currentTime - this.#lastTime > 0.05
    const newFrames = video.frames !== null && this.#lastFrames !== null && video.frames > this.#lastFrames
    if (advanced || newFrames || video.playableBufferSec >= 1) {
      this.#startupObservedProgress = true
      if (!this.#startupRescueAttempted) this.#startupRescueState = 'not-needed'
    }
    if (video.available && !video.paused && !video.seeking && advanced) this.#stableProgressSec++
    else this.#stableProgressSec = 0
    this.recovery.tick(video)
    const firstMediaAt = this.routes.firstMediaAt()
    let watchdog: MonitorSnapshot['watchdog'] = 'healthy'
    if (!video.available) { watchdog = 'no-video'; this.#stallTicks = 0 }
    else if (video.paused || video.ended) { watchdog = 'paused'; this.#stallTicks = 0 }
    else if (video.seeking || now < this.#seekGraceUntil) { watchdog = 'seek-grace'; this.#stallTicks = 0 }
    else if (video.bufferedToEnd) { watchdog = 'buffered-to-end'; this.#stallTicks = 0 }
    else if (advanced || video.playableBufferSec >= 2 || video.readyState >= 3) { watchdog = 'healthy'; this.#stallTicks = 0 }
    else { this.#stallTicks++; watchdog = this.#stallTicks >= 6 ? 'recovering' : 'low-buffer' }
    if (!disabled && watchdog === 'recovering' && (this.#startupObservedProgress || !firstMediaAt)
      && now - this.#lastRecoveryAt >= 30_000) {
      const state = this.session.get(), rep = state.representation
      if (rep) {
        this.routes.recover(rep, this.#demand(video), 'watchdog', state.affinity?.host ?? null)
        this.#lastRecoveryAt = now
      }
    }
    const startupAge = firstMediaAt ? Math.max(0, now - firstMediaAt) : 0
    if (!disabled && firstMediaAt && startupAge >= 15_000 && !this.#startupRescueAttempted && !this.#startupObservedProgress
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
      visible: this.isVisible(), seeking: video.seeking || now < this.#seekGraceUntil,
      recovering: this.recovery.isRecovering(), disabled })
    this.#lastTime = video.currentTime
    this.#lastFrames = video.frames
    this.#snapshot = Object.freeze({ video, stableProgressSec: this.#stableProgressSec, watchdog, stallTicks: this.#stallTicks,
      startupRescue: { state: this.#startupRescueState, ageSec: Math.floor(startupAge / 1000) } })
    for (const listener of this.#listeners) listener(this.#snapshot)
  }

  #demand(video: VideoSnapshot): PlaybackDemand {
    const rep = this.session.get().representation, summary = rep ? this.vault.groupSummary(rep) : null
    const base = summary?.bandwidth ? summary.bandwidth / 1_000_000 : summary?.kind === 'audio' ? 0.192 : 4
    const kind = summary?.kind ?? 'video', requiredMbps = Math.max(kind === 'audio' ? 0.5 : 2, base * video.effectiveRate * 1.25)
    return { kind, requiredMbps, highDemand: requiredMbps >= 12 }
  }
}
