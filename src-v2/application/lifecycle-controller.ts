import { type DomainEvent } from '../domain/model.ts'
import type { PagePlayinfoPort, PlayurlPort } from './ports.ts'
import type { PlayerMonitor } from './player-monitor.ts'
import type { RouteCoordinator } from './route-coordinator.ts'
import type { SessionStore } from '../state/session-store.ts'
import type { SettingsStore } from '../state/settings-store.ts'
import type { SignedRouteVault } from '../state/signed-route-vault.ts'

interface PendingAssignment { readonly payload: unknown; readonly serial: number; readonly assignedAt: number; readonly pageKey: string; appliedGeneration: number }

export class LifecycleController {
  #listeners = new Set<(event: DomainEvent) => void>()
  #restores: (() => void)[] = []
  #pending: PendingAssignment | null = null
  #pageKey = ''

  constructor(
    private readonly session: SessionStore,
    private readonly settings: SettingsStore,
    private readonly vault: SignedRouteVault,
    private readonly routes: RouteCoordinator,
    private readonly playurl: PlayurlPort,
    private readonly pagePlayinfo: PagePlayinfoPort,
    private readonly monitor: PlayerMonitor,
    private readonly now: () => number,
  ) {}

  subscribe(listener: (event: DomainEvent) => void): () => void { this.#listeners.add(listener); return () => this.#listeners.delete(listener) }

  start(): void {
    if (this.#restores.length) return
    this.#pageKey = this.#key()
    this.#beginGeneration('startup')
    this.pagePlayinfo.install()
    const push = history.pushState, replace = history.replaceState
    const after = (): void => queueMicrotask(() => this.#checkNavigation())
    const wrappedPush: History['pushState'] = function(this: History, ...args: Parameters<History['pushState']>): void { Reflect.apply(push, this, args); after() }
    const wrappedReplace: History['replaceState'] = function(this: History, ...args: Parameters<History['replaceState']>): void { Reflect.apply(replace, this, args); after() }
    history.pushState = wrappedPush
    history.replaceState = wrappedReplace
    const pop = (): void => this.#checkNavigation()
    addEventListener('popstate', pop)
    this.#restores.push(() => { if (history.pushState === wrappedPush) history.pushState = push })
    this.#restores.push(() => { if (history.replaceState === wrappedReplace) history.replaceState = replace })
    this.#restores.push(() => removeEventListener('popstate', pop))
    this.#restores.push(this.settings.subscribe(state => {
      if (state.disabled !== this.session.get().disabled) this.#beginGeneration(state.disabled ? 'disabled' : 'enabled')
    }))
  }

  acceptPageAssignment(payload: unknown, serial: number): void {
    this.#pending = { payload, serial, assignedAt: this.now(), pageKey: this.#pageKey, appliedGeneration: -1 }
    this.#applyPending()
    queueMicrotask(() => this.#applyPending())
  }

  dispose(): void {
    for (const restore of this.#restores.splice(0).reverse()) { try { restore() } catch { /* site owns API */ } }
    this.pagePlayinfo.dispose(); this.monitor.stop(); this.#listeners.clear()
  }

  #checkNavigation(): void {
    const key = this.#key()
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
    if (state.disabled) this.monitor.stop(); else this.monitor.start()
    this.#emit({ type: 'lifecycle', at: this.now(), generation: state.generation, epoch: state.epoch, reason })
  }

  #applyPending(): void {
    const pending = this.#pending, state = this.session.get()
    if (!pending || state.disabled || pending.appliedGeneration === Number(state.generation)) return
    const age = this.now() - pending.assignedAt
    if (age > 5000 || (pending.pageKey !== this.#pageKey && age > 250)) return
    if (this.playurl.transform(pending.payload, 'page-hint')) pending.appliedGeneration = Number(state.generation)
  }

  #key(): string { return `${location.pathname}${location.search}`.slice(0, 512) }
  #emit(event: DomainEvent): void { for (const listener of this.#listeners) listener(event) }
}
