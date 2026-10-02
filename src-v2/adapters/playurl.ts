import type { PlayurlController, PlayurlItem } from '../application/playurl-controller.ts'
import type { CodecPreference } from '../state/settings-store.ts'

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
  if ('base_url' in item || !('baseUrl' in item)) item.base_url = primary
  if ('backupUrl' in item) item.backupUrl = [...backups]
  if ('backup_url' in item || !('backupUrl' in item)) item.backup_url = [...backups]
}

const collectDash = (payload: unknown, catalogOnly: boolean): { readonly video: UnknownRecord[]; readonly audio: UnknownRecord[] } | null => {
  const root = isRecord(payload) ? payload : null
  const data = root && isRecord(root.data) ? root.data : root && isRecord(root.result) ? root.result : root
  const dash = data && isRecord(data.dash) ? data.dash : data && isRecord(data.video_info) && isRecord(data.video_info.dash) ? data.video_info.dash : null
  if (!dash) return null
  const audio = Array.isArray(dash.audio) ? dash.audio.filter(isRecord) : []
  if (catalogOnly) {
    for (const key of ['dolby', 'flac'] as const) {
      const variant = isRecord(dash[key]) ? dash[key] : null
      const nested = variant?.audio
      if (Array.isArray(nested)) audio.push(...nested.filter(isRecord))
      else if (isRecord(nested)) audio.push(nested)
    }
  }
  return { video: Array.isArray(dash.video) ? dash.video.filter(isRecord) : [], audio }
}


export class PlayurlAdapter {
  constructor(private readonly controller: Pick<PlayurlController, 'lifecycleKey' | 'catalogOnly' | 'codecPreference' | 'ingest'>) {}
  lifecycleKey(): string { return this.controller.lifecycleKey() }
  transform(payload: unknown, source: 'trusted-api' | 'player-mpd' | 'page-hint' = 'trusted-api', responseKey?: string): boolean {
    const dash = collectDash(payload, this.controller.catalogOnly())
    if (dash) this.#sortCodecGroups(dash.video, this.controller.codecPreference())
    const normalize = (items: UnknownRecord[]): PlayurlItem[] => items.map((item, index) => ({
      token: item, key: `${String(item.id ?? index)}:${codecName(item)}:${finite(item.height)}`,
      height: finite(item.height), codec: codecName(item), bandwidth: finite(item.bandwidth),
      primary: baseUrl(item), urls: [baseUrl(item), ...backupUrls(item)].filter(Boolean),
    }))
    const outputs = this.controller.ingest(dash && isRecord(payload)
      ? { token: payload, video: normalize(dash.video), audio: normalize(dash.audio) } : null, source, responseKey)
    if (!outputs) return false
    for (const output of outputs) if (isRecord(output.token)) rewriteItem(output.token, output.primary, output.backups)
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
