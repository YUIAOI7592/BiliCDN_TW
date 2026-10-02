import type { PlaybackDemand, RepresentationId, MediaKind, RouteIdentity } from '../domain/model.ts'
import type { RouteCoordinator } from './route-coordinator.ts'
import type { SessionStore } from '../state/session-store.ts'
import type { SignedRouteVault } from '../state/signed-route-vault.ts'
import type { SettingsStore } from '../state/settings-store.ts'
import { parseMediaUrl } from '../domain/url-policy.ts'

export interface PlayurlItem {
  readonly token: object
  readonly key: string
  readonly height: number
  readonly codec: string
  readonly bandwidth: number
  readonly primary: string
  readonly urls: readonly string[]
}
export interface PlayurlInput { readonly token: object; readonly video: readonly PlayurlItem[]; readonly audio: readonly PlayurlItem[] }
export interface PlayurlOutput { readonly token: object; readonly primary: string; readonly backups: readonly string[] }
type WriteOutput = (item: PlayurlItem, primary: string, backups: readonly string[]) => void

export class PlayurlController {
  #seenTrusted = new WeakSet<object>()
  #trustedItems = new WeakMap<object, RouteIdentity>()
  #seenPage = new WeakMap<object, number>()
  #responses = new Set<string>()
  #generation = -1
  #contentKey = ''
  constructor(private readonly session: Pick<SessionStore, 'beginEpoch' | 'get'>,
    private readonly vault: Pick<SignedRouteVault, 'groupSummary' | 'identity' | 'isCurrentIdentity' | 'register' | 'reset' | 'rootUrl' | 'source'>,
    private readonly routes: Pick<RouteCoordinator, 'apply' | 'isBilibiliMedia' | 'isCatalogOnly' | 'opaqueOutput' | 'plan' | 'playbackRate' | 'playerOutput' | 'resetEpoch'>,
    private readonly settings: Pick<SettingsStore, 'get'>) {}

  catalogOnly(): boolean { return this.routes.isCatalogOnly() }
  codecPreference(): ReturnType<SettingsStore['get']>['codec'] { return this.settings.get().codec }
  lifecycleKey(): string { const s = this.session.get(); return `${s.generation}:${s.epoch}` }

  ingest(payload: PlayurlInput | null, source: 'trusted-api' | 'player-mpd' | 'page-hint' = 'trusted-api', responseKey?: string): readonly PlayurlOutput[] | null {
    const outputs: PlayurlOutput[] = []
    const rewriteItem: WriteOutput = (item, primary, backups) => { outputs.push({ token: item.token, primary, backups }) }
    if (this.session.get().disabled) return null
    if (this.#generation !== Number(this.session.get().generation)) {
      this.#generation = Number(this.session.get().generation); this.#responses.clear(); this.#contentKey = ''
      this.#seenTrusted = new WeakSet(); this.#trustedItems = new WeakMap()
    }
    const catalogOnly = this.routes.isCatalogOnly()
    if (responseKey && this.#responses.has(responseKey) && !catalogOnly) return outputs
    const dash = payload
    if (!dash || (!dash.video.length && !dash.audio.length)) return null
    if (payload && typeof payload === 'object') {
      if (source === 'trusted-api') {
        if (this.#seenTrusted.has(payload.token)) {
          if (catalogOnly) {
            for (const [kind, items] of [['video', dash.video], ['audio', dash.audio]] as const) {
              for (const item of items) {
                const identity = this.#trustedItems.get(item.token)
                if (identity && this.vault.isCurrentIdentity(identity))
                  this.#sanitizeKnownItem(item, identity.representation, kind, 'trusted-api', true, rewriteItem)
                else rewriteItem(item, '', [])
              }
            }
          }
          return outputs
        }
        this.#seenTrusted.add(payload.token)
      } else if (source === 'page-hint') {
        const generation = Number(this.session.get().generation)
        if (this.#seenPage.get(payload.token) === generation && !catalogOnly) return outputs
        this.#seenPage.set(payload.token, generation)
      }
    }
    let contentKey = ''
    try { const pathname = new URL((dash.video[0] ?? dash.audio[0])?.primary ?? '').pathname; contentKey = pathname.slice(0, pathname.lastIndexOf('/')) } catch { /* no trusted media identity */ }
    if (source === 'trusted-api' && this.#contentKey && contentKey && contentKey !== this.#contentKey) {
      this.session.beginEpoch()
      const state = this.session.get()
      this.vault.reset(state.generation, state.epoch)
      this.routes.resetEpoch()
      this.#trustedItems = new WeakMap()
    }
    if (source === 'trusted-api' && contentKey) this.#contentKey = contentKey
    if (responseKey) { this.#responses.add(responseKey); while (this.#responses.size > 128) this.#responses.delete(this.#responses.values().next().value as string) }
    const state = this.session.get()
    for (const [kind, items] of [['video', dash.video], ['audio', dash.audio]] as const) {
      items.forEach(item => {
        const primary = item.primary, urls = item.urls
        if (parseMediaUrl(primary)?.kind === 'unknown') {
          const rep = this.vault.register({ generation: state.generation, epoch: state.epoch, kind,
            key: item.key, height: item.height,
            codec: item.codec, bandwidth: item.bandwidth, urls, source })
          if (rep && source === 'trusted-api') {
            const identity = this.vault.identity(rep)
            if (identity) this.#trustedItems.set(item.token, identity)
          }
          if (rep && source !== 'trusted-api' && this.vault.source(rep) === 'trusted-api') {
            if (source === 'page-hint' && catalogOnly) this.#sanitizeKnownItem(item, rep, kind, 'page-hint', false, rewriteItem)
            return
          }
          if (source !== 'player-mpd') {
            const output = rep ? this.routes.opaqueOutput(rep, primary, urls, source)
              : { primary: '', backups: [] }
            rewriteItem(item, output.primary, output.backups)
          }
          return
        }
        const bandwidth = item.bandwidth
        const rep = this.vault.register({ generation: state.generation, epoch: state.epoch, kind,
          key: item.key, height: item.height, codec: item.codec,
          bandwidth, urls, source })
        if (rep && source === 'trusted-api') {
          const identity = this.vault.identity(rep)
          if (identity) this.#trustedItems.set(item.token, identity)
        }
        if (rep && source !== 'trusted-api' && this.vault.source(rep) === 'trusted-api') {
          if (source === 'page-hint' && catalogOnly) this.#sanitizeKnownItem(item, rep, kind, 'page-hint', false, rewriteItem)
          return
        }
        if (!rep) {
          if (source !== 'player-mpd') {
            const primaryOutput = this.routes.apply(primary, kind, undefined, true)
            const backups = this.routes.isCatalogOnly() ? [] : primaryOutput.url
              ? [...new Set(urls.map(url => this.routes.apply(url).url).filter((url): url is string => !!url && url !== primaryOutput.url))].slice(0, 5) : []
            const safePrimary = primaryOutput.url && (catalogOnly || this.routes.isBilibiliMedia(primaryOutput.url))
              ? primaryOutput.url : ''
            rewriteItem(item, safePrimary, safePrimary
              ? backups.filter(url => catalogOnly || this.routes.isBilibiliMedia(url)) : [])
          }
          return
        }
        if (source === 'player-mpd') return
        const requiredMbps = Math.max(kind === 'audio' ? 0.5 : 2,
          ((bandwidth || (kind === 'audio' ? 192_000 : 4_000_000)) / 1_000_000) * this.routes.playbackRate() * 1.25)
        const demand: PlaybackDemand = { kind, requiredMbps, highDemand: requiredMbps >= 12 }
        const decision = this.routes.plan(rep, demand, this.session.get().affinity ? 'representation' : 'startup')
        const output = this.routes.playerOutput(rep, primary, decision, urls, source)
        rewriteItem(item, output.primary, output.backups)
      })
    }
    return outputs
  }

  #sanitizeKnownItem(item: PlayurlItem, representation: RepresentationId, kind: MediaKind,
    source: 'trusted-api' | 'page-hint', recordOutput: boolean, rewriteItem: WriteOutput): void {
    const original = this.vault.rootUrl(representation)
    if (!original) { rewriteItem(item, '', []); return }
    const bandwidth = this.vault.groupSummary(representation)?.bandwidth ?? 0
    const requiredMbps = Math.max(kind === 'audio' ? 0.5 : 2,
      ((bandwidth || (kind === 'audio' ? 192_000 : 4_000_000)) / 1_000_000) * this.routes.playbackRate() * 1.25)
    const demand: PlaybackDemand = { kind, requiredMbps, highDemand: requiredMbps >= 12 }
    const decision = this.routes.plan(representation, demand, this.session.get().affinity ? 'representation' : 'startup')
    const output = this.routes.playerOutput(representation, original, decision, [original], source, recordOutput)
    rewriteItem(item, output.primary, output.backups)
  }

}
