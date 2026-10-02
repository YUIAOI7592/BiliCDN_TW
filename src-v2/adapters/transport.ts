import type { SessionStore } from '../state/session-store.ts'
import type { PlayurlPort } from '../application/ports.ts'
import { TransportContext, type TransportRoutes, type TransportSettings, type StartupGate, type HookInstallation, type TransportSnapshot } from './transport-context.ts'
import { FetchHookAdapter } from './fetch-hook.ts'
import { XhrHookAdapter } from './xhr-hook.ts'
export type { TransportSnapshot } from './transport-context.ts'

export class TransportAdapter {
  #fetch: HookInstallation | null = null
  #xhr: HookInstallation | null = null
  #hookState: 'not-installed' | 'installed' | 'failed' = 'not-installed'
  #hookReason = 'not-attempted'
  readonly #context: TransportContext
  constructor(session: Pick<SessionStore, 'get' | 'isGeneration'>, settings: TransportSettings, routes: TransportRoutes,
    playurl: PlayurlPort, measurement: StartupGate, now: () => number) {
    this.#context = new TransportContext(session, settings, routes, playurl, measurement, now)
  }
  install(): void {
    if (this.#fetch && this.#xhr) return
    try { this.#fetch = new FetchHookAdapter(this.#context).install() } catch { /* host-owned API */ }
    if (!this.#fetch) { this.#hookState = 'failed'; this.#hookReason = 'fetch-install-unavailable'; return }
    try { this.#xhr = new XhrHookAdapter(this.#context).install() } catch { /* host-owned API */ }
    if (!this.#xhr) {
      try { this.#fetch.restore() } catch { /* host-owned API */ }
      this.#fetch = null; this.#hookState = 'failed'; this.#hookReason = 'xhr-install-unavailable'; return
    }
    this.#hookState = 'installed'; this.#hookReason = 'fetch-and-xhr-verified'
  }
  snapshot(): TransportSnapshot {
    let fetchInstalled = false, xhrInstalled = false
    try { fetchInstalled = this.#fetch?.isInstalled() ?? false } catch { /* host-owned API */ }
    try { xhrInstalled = this.#xhr?.isInstalled() ?? false } catch { /* host-owned API */ }
    return Object.freeze({ hookState: this.#hookState === 'installed' && (!fetchInstalled || !xhrInstalled) ? 'degraded' : this.#hookState,
      hookReason: this.#hookReason, fetchInstalled, xhrInstalled, ...this.#context.snapshot(),
      note: 'Native call is a script observation, not Chrome Network confirmation.' })
  }
  dispose(): void {
    for (const hook of [this.#xhr, this.#fetch]) { try { hook?.restore() } catch { /* best effort */ } }
    this.#xhr = null; this.#fetch = null; this.#hookState = 'not-installed'; this.#hookReason = 'disposed'
  }
}
