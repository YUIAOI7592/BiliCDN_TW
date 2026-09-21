import type { PlaybackDemand } from '../domain/model.ts'
import type { RouteCoordinator } from '../application/route-coordinator.ts'
import type { SessionStore } from '../state/session-store.ts'
import type { SignedRouteVault } from '../state/signed-route-vault.ts'
import type { SettingsStore, CodecPreference } from '../state/settings-store.ts'

type UnknownRecord = Record<string, unknown>
const isRecord = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object' && !Array.isArray(value)
const finite = (value: unknown): number => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0
const text = (value: unknown): string => typeof value === 'string' ? value : ''

const baseUrl = (item: UnknownRecord): string => text(item.baseUrl || item.base_url)
const backupUrls = (item: UnknownRecord): string[] => {
  const value = item.backupUrl || item.backup_url
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}
const codecName = (item: UnknownRecord): string => {
  const codec = text(item.codecs || item.codec).toLowerCase()
  const id = finite(item.codecid || item.codec_id || item.codecId)
  if (codec.includes('av01') || id === 13) return 'av1'
  if (codec.includes('hev1') || codec.includes('hvc1') || id === 12) return 'hevc'
  if (codec.includes('avc1') || id === 7) return 'avc'
  return 'other'
}

const rewriteItem = (item: UnknownRecord, primary: string, backups: readonly string[]): void => {
  if ('baseUrl' in item) item.baseUrl = primary
  else item.base_url = primary
  if ('backupUrl' in item) item.backupUrl = [...backups]
  else item.backup_url = [...backups]
}

const collectDash = (payload: unknown): { readonly video: UnknownRecord[]; readonly audio: UnknownRecord[] } | null => {
  const root = isRecord(payload) ? payload : null
  const data = root && isRecord(root.data) ? root.data : root && isRecord(root.result) ? root.result : root
  const dash = data && isRecord(data.dash) ? data.dash : data && isRecord(data.video_info) && isRecord(data.video_info.dash) ? data.video_info.dash : null
  if (!dash) return null
  return { video: Array.isArray(dash.video) ? dash.video.filter(isRecord) : [], audio: Array.isArray(dash.audio) ? dash.audio.filter(isRecord) : [] }
}

export class PlayurlAdapter {
  #seenTrusted = new WeakSet<object>()
  #seenPage = new WeakMap<object, number>()
  #responses = new Set<string>()
  #generation = -1
  #contentKey = ''
  constructor(private readonly session: SessionStore, private readonly vault: SignedRouteVault,
    private readonly routes: RouteCoordinator, private readonly settings: SettingsStore) {}

  lifecycleKey(): string { const s = this.session.get(); return `${s.generation}:${s.epoch}` }

  transform(payload: unknown, source: 'trusted-api' | 'player-mpd' | 'page-hint' = 'trusted-api', responseKey?: string): boolean {
    if (this.session.get().disabled) return false
    if (this.#generation !== Number(this.session.get().generation)) {
      this.#generation = Number(this.session.get().generation); this.#responses.clear(); this.#contentKey = ''; this.#seenTrusted = new WeakSet()
    }
    if (responseKey && this.#responses.has(responseKey)) return true
    const dash = collectDash(payload)
    if (!dash || (!dash.video.length && !dash.audio.length)) return false
    if (payload && typeof payload === 'object') {
      if (source === 'trusted-api') {
        if (this.#seenTrusted.has(payload)) return true
        this.#seenTrusted.add(payload)
      } else if (source === 'page-hint') {
        const generation = Number(this.session.get().generation)
        if (this.#seenPage.get(payload) === generation) return true
        this.#seenPage.set(payload, generation)
      }
    }
    this.#sortCodecGroups(dash.video, this.settings.get().codec)
    let contentKey = ''
    try { const pathname = new URL(baseUrl(dash.video[0] ?? dash.audio[0] ?? {})).pathname; contentKey = pathname.slice(0, pathname.lastIndexOf('/')) } catch { /* no trusted media identity */ }
    if (source === 'trusted-api' && this.#contentKey && contentKey && contentKey !== this.#contentKey) {
      this.session.beginEpoch()
      const state = this.session.get()
      this.vault.reset(state.generation, state.epoch)
      this.routes.resetEpoch()
    }
    if (source === 'trusted-api' && contentKey) this.#contentKey = contentKey
    if (responseKey) { this.#responses.add(responseKey); while (this.#responses.size > 128) this.#responses.delete(this.#responses.values().next().value as string) }
    const state = this.session.get()
    for (const [kind, items] of [['video', dash.video], ['audio', dash.audio]] as const) {
      items.forEach((item, index) => {
        const primary = baseUrl(item), urls = [primary, ...backupUrls(item)].filter(Boolean)
        const bandwidth = finite(item.bandwidth)
        const rep = this.vault.register({ generation: state.generation, epoch: state.epoch, kind,
          key: `${String(item.id ?? index)}:${codecName(item)}:${finite(item.height)}`, height: finite(item.height), codec: codecName(item),
          bandwidth, urls, source })
        if (!rep) {
          if (source !== 'player-mpd') {
            const primaryOutput = this.routes.apply(primary)
            const backups = primaryOutput.url ? [...new Set(urls.map(url => this.routes.apply(url).url).filter((url): url is string => !!url && url !== primaryOutput.url))].slice(0, 5) : []
            rewriteItem(item, primaryOutput.url ?? '', backups)
          }
          return
        }
        if (source === 'player-mpd') return
        const requiredMbps = Math.max(kind === 'audio' ? 0.5 : 2,
          ((bandwidth || (kind === 'audio' ? 192_000 : 4_000_000)) / 1_000_000) * this.routes.playbackRate() * 1.25)
        const demand: PlaybackDemand = { kind, requiredMbps, highDemand: requiredMbps >= 12 }
        const decision = this.routes.plan(rep, demand, this.session.get().affinity ? 'representation' : 'startup')
        const output = this.routes.playerOutput(rep, primary, decision, urls)
        rewriteItem(item, output.primary, output.backups)
      })
    }
    return true
  }

  #sortCodecGroups(items: UnknownRecord[], preference: CodecPreference): void {
    if (preference === 'auto' || items.length < 2) return
    const rank = (codec: string): number => {
      const order: Record<Exclude<CodecPreference, 'auto'>, readonly string[]> = {
        av1: ['av1', 'hevc', 'avc', 'other'], hevc: ['hevc', 'av1', 'avc', 'other'], avc: ['avc', 'hevc', 'av1', 'other'],
      }
      const index = order[preference].indexOf(codec)
      return index < 0 ? 99 : index
    }
    const positions = new Map<string, number>()
    items.forEach((item, index) => { const key = String(item.id ?? item.quality ?? index); if (!positions.has(key)) positions.set(key, positions.size) })
    items.sort((a, b) => {
      const aKey = String(a.id ?? a.quality ?? ''), bKey = String(b.id ?? b.quality ?? '')
      const group = (positions.get(aKey) ?? 0) - (positions.get(bKey) ?? 0)
      return group || rank(codecName(a)) - rank(codecName(b))
    })
  }

}
