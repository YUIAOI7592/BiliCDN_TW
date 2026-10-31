import type { SettingsReader, SettingsObserver } from '../state/settings-contracts.ts'
import { sameRouteSettings } from '../state/settings-policy.ts'
import type { DomainEvent } from '../domain/model.ts'
import type { EarlyRetryPort } from './early-retry-contracts.ts'
import type {
  RuntimePort,
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
    this.#stops.push(
      this.content.subscribeEpoch(() => this.reset()),
      this.routes.subscribe((event) => this.handleRouteEvent(event)),
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
    this.earlyRetry?.dispose()
    for (const stop of this.#stops.splice(0).reverse()) stop()
  }
}
