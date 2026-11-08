import {
  type PlayurlItem,
  type PlayurlControllerPort,
} from '../../application/playurl/playurl-contracts.ts'
import { type MediaKind } from '../../domain/model.ts'
import { declaredFrameRate } from '../../domain/frame-rate.ts'
import {
  type PlayurlFormat,
  type PlayurlRejection,
  type PlayurlTransformResult,
  type PlayurlRequestContext,
} from '../../domain/playurl-model.ts'
import { parseMediaUrl } from '../../domain/url-policy.ts'
import { PROVISIONAL_SOURCE_SCAN, TRUSTED_SOURCE_SCAN } from '../../domain/source-admission.ts'
export interface PlayurlIngestionPort extends Pick<
  PlayurlControllerPort,
  'lifecycleKey' | 'catalogOnly' | 'ingest' | 'active' | 'acceptResponse'
> {}

type UnknownRecord = Record<string, unknown>
const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const finite = (value: unknown): number =>
  Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0
const text = (value: unknown): string => (typeof value === 'string' ? value : '')

const baseUrl = (item: UnknownRecord): string => text(item.baseUrl || item.base_url)
const backupUrls = (item: UnknownRecord, limit: number): string[] => {
  const value = item.backupUrl || item.backup_url
  return Array.isArray(value)
    ? value.slice(0, limit - 1).map((entry) => (typeof entry === 'string' ? entry : ''))
    : []
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
  constructor(private readonly controller: PlayurlIngestionPort) {}
  lifecycleKey(): string {
    return this.controller.lifecycleKey()
  }
  transform(
    payload: unknown,
    source: 'trusted-api' | 'player-mpd' | 'page-hint' = 'trusted-api',
    responseKey?: string,
    context?: PlayurlRequestContext,
  ): PlayurlTransformResult {
    const root = isRecord(payload) ? payload : null
    const code = root?.code
    const upstreamCode =
      typeof code === 'number' &&
      Number.isInteger(code) &&
      code >= -2147483648 &&
      code <= 2147483647
        ? code
        : null
    const formats: PlayurlFormat[] = [],
      video: PlayurlItem[] = [],
      audio: PlayurlItem[] = []
    let segmentCount = 0,
      failure: PlayurlRejection | null = null
    const result = (reason: PlayurlRejection | null): PlayurlTransformResult =>
      Object.freeze({
        accepted: reason === null,
        formats: Object.freeze([...formats]),
        videoCount: video.length,
        audioCount: audio.length,
        segmentCount,
        upstreamCode,
        reason,
      })
    if (!this.controller.active()) return result('inactive')
    if (!root || ('code' in root && upstreamCode === null)) return result('malformed-payload')
    if (upstreamCode !== null && upstreamCode !== 0) return result('upstream-error')
    const visited = new Set<object>()
    const primaryBranch = isRecord(root.data)
      ? 'root.data'
      : isRecord(root.result)
        ? 'root.result'
        : 'root'
    const addFormat = (format: PlayurlFormat): void => {
      if (!formats.includes(format)) formats.push(format)
    }
    const normalize = (
      item: UnknownRecord,
      index: number,
      branch: string,
      progressive = false,
      format?: PlayurlFormat,
    ): PlayurlItem => {
      const primary = progressive ? text(item.url) : baseUrl(item)
      const frameRate = declaredFrameRate(item.frame_rate ?? item.frameRate)
      return {
        token: item,
        key: progressive
          ? `${branch}:${format}:${finite(item.quality)}:${index}`
          : `${branch ? branch + ':' : ''}${String(item.id ?? index)}:${codecName(item)}:${finite(item.height)}`,
        height: finite(item.height),
        codec: progressive ? (format ?? 'other') : codecName(item),
        bandwidth: finite(item.bandwidth),
        ...(frameRate !== undefined ? { frameRate } : {}),
        primary,
        urls: [
          primary,
          ...backupUrls(
            item,
            source === 'trusted-api' ? TRUSTED_SOURCE_SCAN : PROVISIONAL_SOURCE_SCAN,
          ),
        ],
        ...(progressive ? { progressive: true } : {}),
      }
    }
    const inventory: {
      readonly items: readonly unknown[]
      readonly count: number
      readonly kind: MediaKind
      readonly branch: string
      readonly progressive: boolean
      readonly container: UnknownRecord
    }[] = []
    let videoLength = 0,
      audioLength = 0
    const queue = (
      value: unknown,
      kind: MediaKind,
      branch: string,
      container: UnknownRecord,
      progressive = false,
    ): void => {
      if ((value === undefined || value === null) && !progressive) return
      if (!Array.isArray(value)) {
        failure = 'malformed-payload'
        return
      }
      const count = value.length
      if (!Number.isSafeInteger(count) || count < 0 || (progressive && !count)) {
        failure = 'malformed-payload'
        return
      }
      if (kind === 'video') videoLength += count
      else audioLength += count
      if (videoLength > 128 || audioLength > 64) {
        failure = 'malformed-payload'
        return
      }
      inventory.push({ items: value, count, kind, branch, progressive, container })
    }
    const collect = (data: UnknownRecord, branch: string, depth: number): void => {
      if (visited.has(data)) return
      visited.add(data)
      if ('dash' in data) {
        if (!isRecord(data.dash)) failure = 'malformed-payload'
        else {
          const dash = data.dash
          const dashBranch =
            branch === primaryBranch || branch === `${primaryBranch}.video_info`
              ? ''
              : `${branch}.dash`
          addFormat('dash')

          queue(dash.video, 'video', dashBranch, data)
          queue(dash.audio, 'audio', dashBranch, data)
          // Every recognized audio alias is planned before any payload field is changed.
          for (const key of ['dolby', 'flac'] as const) {
            const variant = isRecord(dash[key]) ? dash[key] : null,
              nested = variant?.audio
            queue(isRecord(nested) ? [nested] : nested, 'audio', `${dashBranch}.${key}`, data)
          }
        }
      }
      if ('durl' in data) {
        queue(data.durl, 'video', `${branch}.durl`, data, true)
      }
      if (depth < 2)
        for (const key of ['data', 'result', 'video_info'])
          if (isRecord(data[key])) collect(data[key], `${branch}.${key}`, depth + 1)
    }
    collect(root, 'root', 0)
    if (failure) return result(failure)
    // Check every bounded container's length before touching any representation fields.
    for (const group of inventory) {
      for (let index = 0; index < group.count; index++) {
        const item = group.items[index]
        if (!isRecord(item)) {
          failure = 'malformed-payload'
          continue
        }
        if (group.progressive) {
          if (
            typeof item.url !== 'string' ||
            !item.url ||
            ('backup_url' in item && !Array.isArray(item.backup_url)) ||
            ('backupUrl' in item && !Array.isArray(item.backupUrl))
          ) {
            failure = 'malformed-payload'
            continue
          }
          const declared = text(group.container.format).toLowerCase(),
            parsed = parseMediaUrl(item.url)
          const extension = parsed?.url.pathname.match(/\.(mp4|flv)$/i)?.[1]?.toLowerCase()
          const format =
            extension === 'mp4' || extension === 'flv'
              ? extension
              : declared.startsWith('mp4')
                ? 'mp4'
                : declared.startsWith('flv')
                  ? 'flv'
                  : null
          if (!format || (declared && !declared.startsWith('mp4') && !declared.startsWith('flv'))) {
            failure = 'unsupported-format'
            continue
          }
          addFormat(format)
          segmentCount++
          const entry = normalize(
            item,
            index,
            `${group.branch}:${finite(group.container.quality)}`,
            true,
            format,
          )
          video.push(entry)
          if (
            this.controller.catalogOnly() &&
            !entry.urls.some((url) => parseMediaUrl(url)?.replaceable)
          )
            failure = 'unreplaceable-source'
        } else (group.kind === 'video' ? video : audio).push(normalize(item, index, group.branch))
      }
    }
    if (failure) return result(failure)
    if (!video.length && !audio.length) return result('unsupported-format')
    const outputs = this.controller.ingest(
      { token: root, video, audio },
      source,
      responseKey,
      context,
    )
    if (!outputs) return result(this.controller.active() ? 'no-legal-route' : 'inactive')
    if (this.controller.catalogOnly() && outputs.some((output) => !output.primary)) {
      // DASH page hints retain their existing cleared-field safety contract.
      // Progressive and mixed responses require an intact, atomic rejection.
      if (!segmentCount)
        for (const output of outputs)
          if (isRecord(output.token)) rewriteItem(output.token, output.primary, output.backups)
      return result('no-legal-route')
    }
    if (
      segmentCount &&
      outputs.some(
        (output) =>
          !output.primary && video.some((item) => item.progressive && item.token === output.token),
      )
    )
      return result('no-legal-route')
    // Atomic writeback keeps all required segments and aliases intact on rejection.
    for (const output of outputs)
      if (isRecord(output.token)) rewriteItem(output.token, output.primary, output.backups)
    if (source === 'trusted-api') this.controller.acceptResponse(context)
    return result(null)
  }
}
