import type { SettingsState } from '../state/settings-model.ts'
import type { DomainEvent } from '../domain/model.ts'
import type { PlaybackDiagnosticSample } from '../domain/diagnostic-model.ts'

import type { VideoSnapshot } from './ports.ts'

import type {
  RuntimePort,
  RuntimeDiagnosticPort,
  RuntimeSessionPort,
  RuntimeSettingsPort,
  RuntimeRoutesPort,
  RuntimePlayerPort,
  RuntimeMonitorPort,
  RuntimeMeasurementPort,
  RuntimeRecoveryPort,
  RuntimeContentPort,
} from './runtime-ports.ts'
export type {
  RuntimeDiagnosticPort,
  RuntimeSessionPort,
  RuntimeSettingsPort,
  RuntimeRoutesPort,
  RuntimePlayerPort,
  RuntimeMonitorPort,
  RuntimeMeasurementPort,
  RuntimeRecoveryPort,
  RuntimeContentPort,
} from './runtime-ports.ts'

export class RuntimeController implements RuntimePort {
  #stops: (() => void)[] = []
  constructor(
    private readonly session: RuntimeSessionPort,
    private readonly settings: RuntimeSettingsPort,
    private readonly routes: RuntimeRoutesPort,
    private readonly player: RuntimePlayerPort,
    private readonly monitor: RuntimeMonitorPort,
    private readonly measurement: RuntimeMeasurementPort,
    private readonly recovery: RuntimeRecoveryPort,
    private readonly visibility: { setEnabled(enabled: boolean): void },
    private readonly diagnostics: RuntimeDiagnosticPort,
    private readonly now: () => number,
    private readonly content: RuntimeContentPort,
  ) {}
  install(): void {
    if (this.#stops.length) return
    this.#stops.push(
      this.content.subscribeEpoch((state) => {
        this.reset()
        this.record({ type: 'lifecycle', at: this.now(), ...state, reason: 'content-epoch' })
      }),
    )
    this.#stops.push(
      this.routes.subscribe((event) => this.record(event)),
      this.recovery.subscribe((event) => this.record(event)),
      this.monitor.subscribe((snapshot) =>
        this.diagnostics.recordPlayer({
          ...this.#sample(snapshot.video, snapshot.watchdog, this.now()),
          ...(snapshot.bufferTrend ? { bufferTrend: snapshot.bufferTrend } : {}),
        }),
      ),
    )
    this.visibility.setEnabled(!this.settings.get().disabled)
    const signature = (state: SettingsState): string =>
      JSON.stringify([state.fixedHost, state.catalogOverrides, state.considerNativeSources])
    let routeSettings = signature(this.settings.get())
    this.#stops.push(
      this.settings.subscribe((state) => {
        this.visibility.setEnabled(!state.disabled)
        const next = signature(state)
        if (next !== routeSettings) {
          routeSettings = next
          this.routes.invalidateForUserSetting()
          this.measurement.reset()
          this.recovery.reset()
        }
      }),
    )
  }
  record(event: DomainEvent): void {
    this.diagnostics.record(
      event,
      !this.settings.get().disabled && !this.routes.isOriginalComparison(),
    )
    if (event.type === 'transport-completed' && !event.detached) {
      const o = event.observation,
        request = o.request
      if (
        request &&
        request.kind === 'video' &&
        o.kind === 'video' &&
        request.attributionStatus === 'matched' &&
        request.representation === o.representation &&
        request.generation === o.generation &&
        request.epoch === o.epoch &&
        request.targetHost === o.targetHost &&
        (o.outcome !== 'success' ||
          (o.finalHost === o.targetHost && o.responseUrlMatchesRequest !== false))
      )
        this.monitor.observeTransport({
          request: {
            requestId: request.requestId,
            generation: request.generation,
            epoch: request.epoch,
            representation: request.representation,
            routePolicyRevision: request.routePolicyRevision,
            ...(request.authorityRevision !== undefined
              ? { authorityRevision: request.authorityRevision }
              : {}),
            targetHost: request.targetHost,
          },
          startedAt: request.startedAt,
          completedAt: o.completedAt,
          bytes: o.bytes,
          status: o.status,
          outcome: o.outcome,
        })
    }
    if (
      event.type === 'recovery' &&
      event.action.action === 'route-fallback' &&
      event.action.kind === 'video' &&
      !this.routes.isOriginalComparison()
    ) {
      const snapshot = this.player.snapshot()
      this.diagnostics.recordPlayer(
        this.#sample(snapshot, this.monitor.snapshot().watchdog, event.at),
      )
      const request = this.routes.latestRequested('video')
      this.recovery.armRouteFailure(
        'route-failure',
        snapshot,
        () =>
          !!request &&
          this.routes.recoveryEligible(request) &&
          this.routes.latestRequested('video')?.representation === request.representation,
      )
    }
  }
  start(): void {
    this.monitor.start()
  }
  stop(): void {
    this.monitor.stop()
  }
  reset(): void {
    this.monitor.reset()
    this.measurement.reset()
    this.recovery.reset()
    this.player.reset()
  }
  dispose(): void {
    for (const stop of this.#stops.splice(0).reverse()) stop()
  }
  #sample(video: VideoSnapshot, watchdog: string, at: number): PlaybackDiagnosticSample {
    return {
      at,
      generation: this.session.get().generation,
      epoch: this.session.get().epoch,
      enabled: !this.settings.get().disabled,
      originalComparison: this.routes.isOriginalComparison(),
      currentTimeSec: video.currentTime,
      frames: video.frames,
      playableBufferSec: video.playableBufferSec,
      paused: video.paused,
      seeking: video.seeking,
      ended: video.ended,
      readyState: video.readyState,
      coreInitialized: video.coreInitialized,
      watchdog,
    }
  }
}
