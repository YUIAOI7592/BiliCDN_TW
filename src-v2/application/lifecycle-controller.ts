import { type DomainEvent } from '../domain/model.ts'
import type { PagePlayinfoPort, PlayurlPort, NavigationPort, SchedulerPort } from './ports.ts'

interface PendingAssignment {
  readonly payload: unknown
  readonly serial: number
  readonly assignedAt: number
  readonly pageKey: string
  appliedGeneration: number
}

import type {
  LifecyclePort,
  LifecycleSessionPort,
  LifecycleSettingsPort,
  LifecycleVaultPort,
  LifecycleRoutesPort,
  LifecycleMonitorPort,
} from './lifecycle-ports.ts'
export type {
  LifecycleSessionPort,
  LifecycleSettingsPort,
  LifecycleVaultPort,
  LifecycleRoutesPort,
  LifecycleMonitorPort,
} from './lifecycle-ports.ts'

export class LifecycleController implements LifecyclePort {
  #listeners = new Set<(event: DomainEvent) => void>()
  #restores: (() => void)[] = []
  #pending: PendingAssignment | null = null
  #pageKey = ''
  #active = false

  constructor(
    private readonly session: LifecycleSessionPort,
    private readonly settings: LifecycleSettingsPort,
    private readonly vault: LifecycleVaultPort,
    private readonly routes: LifecycleRoutesPort,
    private readonly playurl: PlayurlPort,
    private readonly pagePlayinfo: PagePlayinfoPort,
    private readonly monitor: LifecycleMonitorPort,
    private readonly now: () => number,
    private readonly navigation: NavigationPort,
    private readonly scheduler: SchedulerPort,
  ) {}

  subscribe(listener: (event: DomainEvent) => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  start(): void {
    if (this.#restores.length) return
    this.#active = true
    this.#pageKey = this.navigation.key()
    this.#beginGeneration('startup')
    this.pagePlayinfo.install()
    this.#restores.push(this.navigation.subscribe(() => this.#checkNavigation()))
    this.#restores.push(
      this.settings.subscribe((state) => {
        if (state.disabled !== this.session.get().disabled)
          this.#beginGeneration(state.disabled ? 'disabled' : 'enabled')
      }),
    )
  }

  acceptPageAssignment(payload: unknown, serial: number): boolean {
    if (!this.#active) return false
    this.#pending = {
      payload,
      serial,
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
    this.#listeners.clear()
  }

  #checkNavigation(): void {
    const key = this.navigation.key()
    if (key === this.#pageKey) return
    this.#pageKey = key
    this.#beginGeneration('spa')
    this.#applyPending()
  }

  #beginGeneration(reason: string): void {
    const state = this.session.beginGeneration(this.settings.get().disabled)
    this.vault.reset(state.generation, state.epoch)
    this.routes.resetEpoch()
    this.monitor.reset()
    if (state.disabled) this.monitor.stop()
    else this.monitor.start()
    this.#emit({
      type: 'lifecycle',
      at: this.now(),
      generation: state.generation,
      epoch: state.epoch,
      reason,
    })
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

  #emit(event: DomainEvent): void {
    for (const listener of this.#listeners) listener(event)
  }
}
