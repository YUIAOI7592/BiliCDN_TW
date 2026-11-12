import { type SettingsReader, type SettingsObserver } from '../state/settings-contracts.ts'
import { type PagePlayinfoPort, type PlayurlPort } from './playurl/playurl-contracts.ts'
import { type NavigationPort } from './lifecycle-contracts.ts'
import { type SchedulerPort } from './scheduler-contracts.ts'
import { type MonitorPort } from './playback/monitor-contracts.ts'
import { type RouteCoordinatorPort } from './routing/route-contracts.ts'
import { type SessionPort } from '../state/session-contracts.ts'
import { type SignedRouteVaultPort } from '../state/vault-contracts.ts'
interface PendingAssignment {
  readonly payload: unknown
  readonly assignedAt: number
  readonly pageKey: string
  appliedGeneration: number
}

export class LifecycleController implements LifecyclePort {
  #restores: (() => void)[] = []
  #pending: PendingAssignment | null = null
  #pageKey = ''
  #active = false

  constructor(
    private readonly session: LifecycleSessionPort,
    private readonly settings: SettingsReader & SettingsObserver,
    private readonly vault: LifecycleVaultPort,
    private readonly routes: LifecycleRoutesPort,
    private readonly playurl: PlayurlPort,
    private readonly pagePlayinfo: PagePlayinfoPort,
    private readonly monitor: LifecycleMonitorPort,
    private readonly now: () => number,
    private readonly navigation: NavigationPort,
    private readonly scheduler: SchedulerPort,
  ) {}

  start(): void {
    if (this.#restores.length) return
    this.#active = true
    this.#pageKey = this.navigation.key()
    this.#beginGeneration()
    this.pagePlayinfo.install()
    this.#restores.push(this.navigation.subscribe(() => this.#checkNavigation()))
    this.#restores.push(
      this.settings.subscribe((state) => {
        if (state.disabled !== this.session.get().disabled) this.#beginGeneration()
      }),
    )
  }

  acceptPageAssignment(payload: unknown, _serial: number): boolean {
    if (!this.#active) return false
    this.#pending = {
      payload,
      assignedAt: this.now(),
      pageKey: this.#pageKey,
      appliedGeneration: -1,
    }
    const accepted = this.#applyPending()
    this.scheduler.microtask(() => this.#applyPending())
    return accepted
  }

  dispose(): void {
    this.#active = false
    this.#pending = null
    for (const restore of this.#restores.splice(0).reverse()) {
      try {
        restore()
      } catch {
        /* site owns API */
      }
    }
    this.pagePlayinfo.dispose()
    this.monitor.stop()
  }

  #checkNavigation(): void {
    const key = this.navigation.key()
    if (key === this.#pageKey) return
    this.#pageKey = key
    this.#beginGeneration()
    this.#applyPending()
  }

  #beginGeneration(): void {
    const state = this.session.beginGeneration(this.settings.get().disabled)
    this.vault.reset(state.generation, state.epoch)
    this.routes.resetEpoch()
    this.monitor.reset()
    if (state.disabled) this.monitor.stop()
    else this.monitor.start()
  }

  #applyPending(): boolean {
    const pending = this.#pending,
      state = this.session.get()
    if (!this.#active || !pending || state.disabled) return false
    if (pending.appliedGeneration === Number(state.generation)) return true
    const age = this.now() - pending.assignedAt
    if (age > 5000 || (pending.pageKey !== this.#pageKey && age > 250)) return false
    const accepted = this.playurl.transform(pending.payload, 'page-hint').accepted
    if (accepted) pending.appliedGeneration = Number(state.generation)
    return accepted
  }
}

interface LifecycleSessionPort extends Pick<SessionPort, 'beginGeneration' | 'get'> {}
interface LifecycleVaultPort extends Pick<SignedRouteVaultPort, 'reset'> {}
interface LifecycleRoutesPort extends Pick<RouteCoordinatorPort, 'resetEpoch'> {}
interface LifecycleMonitorPort extends Pick<MonitorPort, 'start' | 'stop' | 'reset'> {}
interface LifecyclePort {
  start(): void
  acceptPageAssignment(payload: unknown, serial: number): boolean
  dispose(): void
}
