import type { PlayurlController, PlayurlItem } from '../application/playurl-controller.ts'
import type { CodecPreference } from '../state/settings-store.ts'
import type { PlayurlFormat, PlayurlRejection, PlayurlTransformResult } from '../domain/playurl-model.ts'
import { parseMediaUrl } from '../domain/url-policy.ts'

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
  if ('url' in item) item.url = primary
  if ('baseUrl' in item) item.baseUrl = primary
  if ('base_url' in item || (!('baseUrl' in item) && !('url' in item))) item.base_url = primary
  if ('backupUrl' in item) item.backupUrl = [...backups]
  if ('backup_url' in item || !('backupUrl' in item)) item.backup_url = [...backups]
}

export class PlayurlAdapter {
  constructor(private readonly controller: Pick<PlayurlController, 'lifecycleKey' | 'catalogOnly' | 'codecPreference' | 'ingest' | 'active'>) {}
  lifecycleKey(): string { return this.controller.lifecycleKey() }
  transform(payload: unknown, source: 'trusted-api' | 'player-mpd' | 'page-hint' = 'trusted-api', responseKey?: string): PlayurlTransformResult {
    const root = isRecord(payload) ? payload : null
    const code = root?.code
    const upstreamCode = typeof code === 'number' && Number.isInteger(code) && code >= -2147483648 && code <= 2147483647 ? code : null
    const formats: PlayurlFormat[] = [], video: PlayurlItem[] = [], audio: PlayurlItem[] = [], sorts: UnknownRecord[][] = []
    let segmentCount = 0, failure: PlayurlRejection | null = null
    const result = (reason: PlayurlRejection | null): PlayurlTransformResult => Object.freeze({ accepted: reason === null,
      formats: Object.freeze([...formats]), videoCount: video.length, audioCount: audio.length, segmentCount, upstreamCode, reason })
    if (!this.controller.active()) return result('inactive')
    if (!root || ('code' in root && upstreamCode === null)) return result('malformed-payload')
    if (upstreamCode !== null && upstreamCode !== 0) return result('upstream-error')
    const visited = new Set<object>()
    const primaryBranch = isRecord(root.data) ? 'root.data' : isRecord(root.result) ? 'root.result' : 'root'
    const addFormat = (format: PlayurlFormat): void => { if (!formats.includes(format)) formats.push(format) }
    const normalize = (item: UnknownRecord, index: number, branch: string, progressive = false, format?: PlayurlFormat): PlayurlItem => {
      const primary = progressive ? text(item.url) : baseUrl(item)
      return { token: item, key: progressive ? `${branch}:${format}:${finite(item.quality)}:${index}`
        : `${branch ? branch + ':' : ''}${String(item.id ?? index)}:${codecName(item)}:${finite(item.height)}`,
        height: finite(item.height), codec: progressive ? format ?? 'other' : codecName(item), bandwidth: finite(item.bandwidth),
        primary, urls: [primary, ...backupUrls(item)].filter(Boolean), ...(progressive ? { progressive: true } : {}) }
    }
    const records = (value: unknown, required = false): UnknownRecord[] => {
      if ((value === undefined || value === null) && !required) return []
      if (!Array.isArray(value) || value.some(item => !isRecord(item))) { failure = 'malformed-payload'; return [] }
      return value as UnknownRecord[]
    }
    const collect = (data: UnknownRecord, branch: string, depth: number): void => {
      if (visited.has(data)) return
      visited.add(data)
      if ('dash' in data) {
        if (!isRecord(data.dash)) failure = 'malformed-payload'
        else {
          const dash = data.dash, videos = records(dash.video), audios = records(dash.audio)
          const dashBranch = branch === primaryBranch || branch === `${primaryBranch}.video_info` ? '' : `${branch}.dash`
          addFormat('dash'); sorts.push(videos)
          video.push(...videos.map((item, index) => normalize(item, index, dashBranch)))
          audio.push(...audios.map((item, index) => normalize(item, index, dashBranch)))
          // Every recognized audio alias is planned before any payload field is changed.
          for (const key of ['dolby', 'flac'] as const) {
            const variant = isRecord(dash[key]) ? dash[key] : null, nested = variant?.audio
            const items = isRecord(nested) ? [nested] : records(nested)
            audio.push(...items.map((item, index) => normalize(item, index, `${dashBranch}.${key}`)))
          }
        }
      }
      if ('durl' in data) {
        const segments = records(data.durl, true)
        if (!segments.length) failure = 'malformed-payload'
        for (const [index, item] of segments.entries()) {
          if (typeof item.url !== 'string' || !item.url || ('backup_url' in item && !Array.isArray(item.backup_url))
            || ('backupUrl' in item && !Array.isArray(item.backupUrl))) { failure = 'malformed-payload'; continue }
          const declared = text(data.format).toLowerCase(), parsed = parseMediaUrl(item.url)
          const extension = parsed?.url.pathname.match(/\.(mp4|flv)$/i)?.[1]?.toLowerCase()
          const format = extension === 'mp4' || extension === 'flv' ? extension : declared.startsWith('mp4') ? 'mp4' : declared.startsWith('flv') ? 'flv' : null
          if (!format || (declared && !declared.startsWith('mp4') && !declared.startsWith('flv'))) { failure = 'unsupported-format'; continue }
          addFormat(format); segmentCount++
          const entry = normalize(item, index, `${branch}.durl:${finite(data.quality)}`, true, format)
          video.push(entry)
          if (this.controller.catalogOnly() && !entry.urls.some(url => parseMediaUrl(url)?.replaceable)) failure = 'unreplaceable-source'
        }
      }
      if (depth < 2) for (const key of ['data', 'result', 'video_info']) if (isRecord(data[key])) collect(data[key], `${branch}.${key}`, depth + 1)
    }
    collect(root, 'root', 0)
    if (failure) return result(failure)
    if (video.length > 128 || audio.length > 64) return result('malformed-payload')
    if (!video.length && !audio.length) return result('unsupported-format')
    const outputs = this.controller.ingest({ token: root, video, audio }, source, responseKey)
    if (!outputs) return result(this.controller.active() ? 'no-legal-route' : 'inactive')
    if (this.controller.catalogOnly() && outputs.some(output => !output.primary)) {
      // DASH page hints retain their existing cleared-field safety contract.
      // Progressive and mixed responses require an intact, atomic rejection.
      if (!segmentCount) for (const output of outputs) if (isRecord(output.token)) rewriteItem(output.token, output.primary, output.backups)
      return result('no-legal-route')
    }
    if (segmentCount && outputs.some(output => !output.primary && video.some(item => item.progressive && item.token === output.token))) return result('no-legal-route')
    // Atomic writeback keeps all required segments and aliases intact on rejection.
    for (const output of outputs) if (isRecord(output.token)) rewriteItem(output.token, output.primary, output.backups)
    for (const items of sorts) this.#sortCodecGroups(items, this.controller.codecPreference())
    return result(null)
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
