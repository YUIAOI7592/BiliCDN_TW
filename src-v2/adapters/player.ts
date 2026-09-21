import type { PlayurlAdapter } from './playurl.ts'
import type { VideoSnapshot } from '../application/ports.ts'

type UnknownRecord = Record<string, unknown>
const isRecord = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object'
const safeCall = (target: unknown, name: string, ...args: unknown[]): unknown => {
  if (!isRecord(target)) return undefined
  try { const fn = target[name]; return typeof fn === 'function' ? Reflect.apply(fn, target, args) : undefined } catch { return undefined }
}
const safeNumber = (value: unknown): number | null => Number.isFinite(Number(value)) ? Number(value) : null

export class PlayerAdapter {
  #cachedVideo: HTMLVideoElement | null = null
  #manifestFingerprint = ''
  constructor(private readonly playurl: PlayurlAdapter) {}

  player(): UnknownRecord | null { try { return isRecord(unsafeWindow.player) ? unsafeWindow.player : null } catch { return null } }

  video(): HTMLVideoElement | null {
    if (this.#cachedVideo?.isConnected && this.#area(this.#cachedVideo) > 0) return this.#cachedVideo
    const videos = [...document.querySelectorAll('video')]
    const connected = videos.filter(video => video.isConnected)
    const best = connected.sort((a, b) => this.#area(b) - this.#area(a))[0] ?? null
    if (best && this.#area(best) > 0) this.#cachedVideo = best
    else if (!this.#cachedVideo?.isConnected) this.#cachedVideo = best
    return this.#cachedVideo
  }

  snapshot(): VideoSnapshot {
    const video = this.video(), player = this.player(), core = safeCall(player, '__core')
    let coreInitialized: boolean | null = null, manifestHasVideo = false
    try { const value = isRecord(core) && isRecord(core.state) ? core.state.initialized : null; coreInitialized = typeof value === 'boolean' ? value : null } catch { /* unknown */ }
    const mpd = safeCall(core, 'getMpd')
    if (isRecord(mpd)) manifestHasVideo = Array.isArray(mpd.video) && mpd.video.length > 0
    if (!video) return { available: false, paused: true, seeking: false, ended: false, readyState: 0, currentTime: 0,
      duration: null, width: 0, height: 0, playbackRate: 1, effectiveRate: 2, bufferAheadSec: 0, playableBufferSec: 0,
      bufferedToEnd: false, frames: null, mediaError: false, coreInitialized, manifestHasVideo }
    const currentTime = safeNumber(video.currentTime) ?? 0, durationRaw = safeNumber(video.duration)
    const duration = durationRaw !== null && durationRaw > 0 ? durationRaw : null
    let end = currentTime
    try {
      for (let index = 0; index < video.buffered.length; index++) {
        const start = video.buffered.start(index), rangeEnd = video.buffered.end(index)
        if (start <= currentTime + 0.05 && rangeEnd >= currentTime - 0.05) { end = Math.max(end, rangeEnd); break }
      }
    } catch { /* empty range */ }
    const rate = safeNumber(video.playbackRate) ?? 0, effectiveRate = rate > 0 ? rate : 2
    let frames: number | null = null
    try { frames = video.getVideoPlaybackQuality?.().totalVideoFrames ?? null } catch { /* unavailable */ }
    return { available: true, paused: video.paused, seeking: video.seeking, ended: video.ended, readyState: video.readyState,
      currentTime, duration, width: video.videoWidth, height: video.videoHeight, playbackRate: rate, effectiveRate,
      bufferAheadSec: Math.max(0, end - currentTime), playableBufferSec: Math.max(0, end - currentTime) / effectiveRate,
      bufferedToEnd: duration !== null && end >= duration - 0.1, frames,
      mediaError: !!video.error, coreInitialized, manifestHasVideo }
  }

  syncManifest(): boolean {
    const player = this.player(), core = safeCall(player, '__core'), mpd = safeCall(core, 'getMpd')
    if (!isRecord(mpd)) return false
    const cloned = this.#cloneMpd(mpd)
    if (!cloned) return false
    const fingerprint = `${this.playurl.lifecycleKey()}:${JSON.stringify(cloned)}`
    if (fingerprint === this.#manifestFingerprint) return true
    const accepted = this.playurl.transform({ code: 0, data: { dash: cloned } }, 'player-mpd')
    if (accepted) this.#manifestFingerprint = fingerprint
    return accepted
  }

  reload(): unknown {
    const player = this.player(), reload = player?.reload
    if (!player || typeof reload !== 'function') throw new Error('player.reload unavailable')
    return Reflect.apply(reload, player, [])
  }
  currentTime(): number { return safeNumber(safeCall(this.player(), 'getCurrentTime')) ?? this.snapshot().currentTime }
  playbackRate(): number {
    const rate = safeNumber(safeCall(this.player(), 'getPlaybackRate'))
    return rate !== null && rate > 0 ? rate : this.snapshot().playbackRate
  }
  seek(value: number): void {
    const player = this.player(), method = player?.seek
    if (player && typeof method === 'function') { try { Reflect.apply(method, player, [value]); return } catch { /* fallback */ } }
    const video = this.video(); if (video) video.currentTime = value
  }
  setRate(value: number): void {
    const player = this.player(), method = player?.setPlaybackRate
    if (player && typeof method === 'function') { try { Reflect.apply(method, player, [value]); return } catch { /* fallback */ } }
    const video = this.video(); if (video) video.playbackRate = value
  }
  play(): unknown { const player = this.player(); if (!player || typeof player.play !== 'function') throw new Error('player.play unavailable'); return Reflect.apply(player.play, player, []) }
  reset(): void { this.#cachedVideo = null; this.#manifestFingerprint = '' }

  #area(video: HTMLVideoElement): number { return Math.max(0, video.clientWidth) * Math.max(0, video.clientHeight) }
  #cloneMpd(mpd: UnknownRecord): UnknownRecord | null {
    const cloneList = (value: unknown, limit: number): UnknownRecord[] => (Array.isArray(value) ? value : []).slice(0, limit).flatMap((item): UnknownRecord[] => {
      if (!isRecord(item)) return []
      const base = typeof item.baseUrl === 'string' ? item.baseUrl : typeof item.base_url === 'string' ? item.base_url : typeof item.url === 'string' ? item.url : ''
      const backups = Array.isArray(item.backupUrl) ? item.backupUrl : Array.isArray(item.backup_url) ? item.backup_url : []
      const urls = [base, ...backups].filter((url): url is string => typeof url === 'string' && url.length > 0 && url.length <= 16 * 1024).slice(0, 4)
      if (!urls.length) return []
      return [{ base_url: urls[0], backup_url: urls.slice(1), id: item.id, codecid: item.codecid ?? item.codecId,
        codecs: item.codecs ?? item.codec, width: item.width, height: item.height, bandwidth: item.bandwidth ?? item.bitrate }]
    })
    const video = cloneList(mpd.video, 128), audio = cloneList(mpd.audio, 64)
    return video.length || audio.length ? { video, audio } : null
  }
}
