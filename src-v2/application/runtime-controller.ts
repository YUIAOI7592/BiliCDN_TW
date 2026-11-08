import { type SettingsReader, type SettingsObserver } from '../state/settings-contracts.ts'
import { sameRouteSettings } from '../state/settings-policy.ts'
import { type DomainEvent, type RouteCoordinatorPort } from './routing/route-contracts.ts'
import { type EarlyRetryPort } from './routing/early-retry-contracts.ts'
import { type PlayerPort } from './playback/player-contracts.ts'
import { type MeasurementPort } from './measurement/measurement-contracts.ts'
import { type RecoveryPort } from './playback/recovery-contracts.ts'
import { type MonitorPort } from './playback/monitor-contracts.ts'
import { type PlayurlControllerPort } from './playurl/playurl-contracts.ts'
export class RuntimeController implements RuntimePort {
  #running = false
  #stops: (() => void)[] = []
  constructor(
    private readonly settings: SettingsReader & SettingsObserver,
    private readonly routes: RuntimeRoutesPort,
    private readonly player: RuntimePlayerPort,
    private readonly monitor: RuntimeMonitorPort,
    private readonly measurement: RuntimeMeasurementPort,
    private readonly recovery: RuntimeRecoveryPort,
    private readonly visibility: { setEnabled(enabled: boolean): void },
    private readonly content: RuntimeContentPort,
    private readonly earlyRetry?: EarlyRetryPort,
  ) {}
  install(): void {
    if (this.#stops.length) return
    if (this.player.observePlaybackInvalidation)
      this.#stops.push(
        this.player.observePlaybackInvalidation((revision) =>
          this.routes.observePlaybackFacts(null, revision),
        ),
      )
    this.#stops.push(
      this.content.subscribeEpoch(() => this.reset()),
      this.routes.subscribe((event) => this.handleRouteEvent(event)),
      this.monitor.subscribe((snapshot) => {
        if (this.#stops.length && this.#running)
          this.routes.observePlaybackFacts(snapshot.routingPlayback ?? null)
      }),
    )
    this.visibility.setEnabled(!this.settings.get().disabled)
    let routeSettings = this.settings.get()
    this.#stops.push(
      this.settings.subscribe((state) => {
        if (!state.earlyRetryEnabled || state.disabled) this.earlyRetry?.cancel('settings')
        this.visibility.setEnabled(!state.disabled)
        if (!sameRouteSettings(state, routeSettings)) {
          this.earlyRetry?.cancel('route-policy')
          routeSettings = state
          this.routes.invalidateForUserSetting()
          this.measurement.reset()
          this.recovery.reset()
        }
      }),
    )
  }
  handleRouteEvent(event: DomainEvent): void {
    if (
      event.type === 'recovery' &&
      event.action.action === 'route-fallback' &&
      event.action.kind === 'video'
    ) {
      const snapshot = this.player.snapshot()
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
    this.#running = true
    this.monitor.start()
  }
  stop(): void {
    this.#running = false
    this.routes.observePlaybackFacts(null)
    this.monitor.stop()
  }
  reset(): void {
    this.routes.observePlaybackFacts(null)
    this.monitor.reset()
    this.measurement.reset()
    this.recovery.reset()
    this.player.reset()
  }
  dispose(): void {
    this.#running = false
    this.routes.observePlaybackFacts(null)
    this.earlyRetry?.dispose()
    for (const stop of this.#stops.splice(0).reverse()) stop()
  }
}

interface RuntimeRoutesPort extends Pick<
  RouteCoordinatorPort,
  | 'subscribe'
  | 'invalidateForUserSetting'
  | 'latestRequested'
  | 'recoveryEligible'
  | 'observePlaybackFacts'
> {}
interface RuntimePlayerPort extends Pick<
  PlayerPort,
  'snapshot' | 'reset' | 'observePlaybackInvalidation'
> {}
interface RuntimeMonitorPort extends Pick<MonitorPort, 'start' | 'stop' | 'reset' | 'subscribe'> {}
interface RuntimeMeasurementPort extends Pick<MeasurementPort, 'reset'> {}
interface RuntimeRecoveryPort extends Pick<RecoveryPort, 'reset' | 'armRouteFailure'> {}
interface RuntimeContentPort extends Pick<PlayurlControllerPort, 'subscribeEpoch'> {}
interface RuntimePort {
  install(): void
  handleRouteEvent(event: DomainEvent): void
  start(): void
  stop(): void
  reset(): void
  dispose(): void
}
