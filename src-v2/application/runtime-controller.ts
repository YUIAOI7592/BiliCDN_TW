import type { DomainEvent } from '../domain/model.ts'
import type { PlaybackDiagnosticSample } from '../domain/diagnostic-model.ts'
import type { SessionStore } from '../state/session-store.ts'
import type { SettingsStore } from '../state/settings-store.ts'
import type { PlayerPort, VideoSnapshot } from './ports.ts'
import type { RouteCoordinator } from './route-coordinator.ts'
import type { MeasurementController } from './measurement-controller.ts'
import type { RecoveryController } from './recovery-controller.ts'
import type { PlayerMonitor } from './player-monitor.ts'
import type { PlayurlController } from './playurl-controller.ts'

export interface RuntimeDiagnosticPort {
  record(event: DomainEvent, routeObservationEnabled: boolean): void
  recordPlayer(sample: PlaybackDiagnosticSample): void
}
export class RuntimeController {
  #stops: (() => void)[] = []
  constructor(private readonly session: Pick<SessionStore, 'get'>,
    private readonly settings: Pick<SettingsStore, 'get' | 'subscribe'>,
    private readonly routes: Pick<RouteCoordinator, 'subscribe' | 'isOriginalComparison' | 'invalidateForUserSetting' | 'latestRequested' | 'recoveryEligible'>,
    private readonly player: Pick<PlayerPort, 'snapshot' | 'reset'>,
    private readonly monitor: Pick<PlayerMonitor, 'subscribe' | 'snapshot' | 'start' | 'stop' | 'reset'>,
    private readonly measurement: Pick<MeasurementController, 'reset'>,
    private readonly recovery: Pick<RecoveryController, 'subscribe' | 'reset' | 'armRouteFailure'>,
    private readonly visibility: { setEnabled(enabled: boolean): void },
    private readonly diagnostics: RuntimeDiagnosticPort, private readonly now: () => number,
    private readonly content: Pick<PlayurlController, 'subscribeEpoch'>) {}
  install(): void {
    if (this.#stops.length) return
    this.#stops.push(this.content.subscribeEpoch(state => {
      this.reset()
      this.record({ type: 'lifecycle', at: this.now(), ...state, reason: 'content-epoch' })
    }))
    this.#stops.push(this.routes.subscribe(event => this.record(event)), this.recovery.subscribe(event => this.record(event)),
      this.monitor.subscribe(snapshot => this.diagnostics.recordPlayer(this.#sample(snapshot.video, snapshot.watchdog, this.now()))))
    this.visibility.setEnabled(!this.settings.get().disabled)
    const signature = (state: ReturnType<SettingsStore['get']>): string => JSON.stringify([state.fixedHost, state.catalogOverrides, state.considerNativeSources])
    let routeSettings = signature(this.settings.get())
    this.#stops.push(this.settings.subscribe(state => {
      this.visibility.setEnabled(!state.disabled)
      const next = signature(state)
      if (next !== routeSettings) {
        routeSettings = next
        this.routes.invalidateForUserSetting()
        this.measurement.reset()
        this.recovery.reset()
      }
    }))
  }
  record(event: DomainEvent): void {
    this.diagnostics.record(event, !this.settings.get().disabled && !this.routes.isOriginalComparison())
    if (event.type === 'recovery' && event.action.action === 'route-fallback' && event.action.kind === 'video' && !this.routes.isOriginalComparison()) {
      const snapshot = this.player.snapshot()
      this.diagnostics.recordPlayer(this.#sample(snapshot, this.monitor.snapshot().watchdog, event.at))
      const request = this.routes.latestRequested('video')
      this.recovery.armRouteFailure('route-failure', snapshot, () => !!request && this.routes.recoveryEligible(request)
        && this.routes.latestRequested('video')?.representation === request.representation)
    }
  }
  start(): void { this.monitor.start() }
  stop(): void { this.monitor.stop() }
  reset(): void { this.monitor.reset(); this.measurement.reset(); this.recovery.reset(); this.player.reset() }
  dispose(): void { for (const stop of this.#stops.splice(0).reverse()) stop() }
  #sample(video: VideoSnapshot, watchdog: string, at: number): PlaybackDiagnosticSample {
    return { at, generation: this.session.get().generation, epoch: this.session.get().epoch,
      enabled: !this.settings.get().disabled, originalComparison: this.routes.isOriginalComparison(),
      currentTimeSec: video.currentTime, frames: video.frames, playableBufferSec: video.playableBufferSec,
      paused: video.paused, seeking: video.seeking, ended: video.ended, readyState: video.readyState,
      coreInitialized: video.coreInitialized, watchdog }
  }
}
