import type { PlayurlPort, VideoSnapshot, PlayerControlSnapshot, SchedulerPort } from '../application/ports.ts'

type UnknownRecord = Record<string, unknown>
const isRecord = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object'
const safeCall = (target: unknown, name: string, ...args: unknown[]): unknown => {
  if (!isRecord(target)) return undefined
  try { const fn = target[name]; return typeof fn === 'function' ? Reflect.apply(fn, target, args) : undefined } catch { return undefined }
}
const safeNumber = (value: unknown): number | null => Number.isFinite(Number(value)) ? Number(value) : null

interface ControlEnvironment {
  readonly scheduler: Pick<SchedulerPort, 'timeout'>
  readonly isActuallyVisible: () => boolean
}
interface KeyboardSeek {
  readonly event: KeyboardEvent
  readonly video: HTMLVideoElement
  readonly player: UnknownRecord | null
  readonly lifecycle: string
  readonly position: number
  stop: () => void
}

export class PlayerAdapter {
  #cachedVideo: HTMLVideoElement | null = null
  #manifestFingerprint = ''
  #objects = new WeakMap<object, number>()
  #objectSerial = 0
  #seekRevision = 0
  #userRevision = 0
  #dragging = false
  #targetSec: number | null = null
  #internalSeek = 0
  #pendingSeek: number | null = null
  #controlStops: (() => void)[] = []
  #controlVideo: HTMLVideoElement | null = null
  #seekOwner: UnknownRecord | null = null
  #reloadRevision = 0
  #coreReloadRevision = 0
  #internalReload = 0
  #reloadCore: unknown = null
  #awaitReloadCore = false
  #keyboardSeek: KeyboardSeek | null = null
  constructor(private readonly playurl: PlayurlPort & { lifecycleKey(): string }, private readonly environment: ControlEnvironment) {}

  protected player(): UnknownRecord | null { try { return isRecord(unsafeWindow.player) ? unsafeWindow.player : null } catch { return null } }

  controls(): PlayerControlSnapshot {
    const video = this.video(), player = this.player(), core = safeCall(player, '__core')
    if (video !== this.#controlVideo || player !== this.#seekOwner) this.#observeControls(video, player)
    this.#confirmKeyboardSeek()
    if (video?.seeking && Number.isFinite(video.currentTime) && video.currentTime !== this.#targetSec) {
      this.#targetSec = video.currentTime
      if (!this.#internalSeek && this.#pendingSeek !== video.currentTime) this.#seekRevision++
    }
    const identity = (object: unknown): number => {
      if (!object || (typeof object !== 'object' && typeof object !== 'function')) return 0
      let id = this.#objects.get(object)
      if (id === undefined) { id = ++this.#objectSerial; this.#objects.set(object, id) }
      return id
    }
    if (this.#awaitReloadCore && core && core !== this.#reloadCore) {
      this.#coreReloadRevision = this.#reloadRevision; this.#awaitReloadCore = false
    } else if (!this.#awaitReloadCore && core !== this.#reloadCore) this.#coreReloadRevision = 0
    this.#reloadCore = core
    return Object.freeze({ mediaId: identity(video), coreId: identity(core), seekRevision: this.#seekRevision,
      userRevision: this.#userRevision, dragging: this.#dragging, targetSec: this.#targetSec,
      reloadRevision: this.#reloadRevision, coreReloadRevision: this.#coreReloadRevision })
  }

  #observeControls(video: HTMLVideoElement | null, player: UnknownRecord | null): void {
    this.#clearControls(); this.#controlVideo = video; this.#seekOwner = player
    if (!video) return
    const listen = (target: EventTarget, type: string, listener: EventListener): void => {
      target.addEventListener(type, listener, true)
      this.#controlStops.push(() => target.removeEventListener(type, listener, true))
    }
    const region = video.closest('.bpx-player-container, .bilibili-player') ?? video.parentElement
    const inRegion = (event: Event): boolean => event.target instanceof Node && !!region?.contains(event.target)
    listen(document, 'pointerdown', event => {
      if (!event.isTrusted || !inRegion(event)) return
      this.#clearKeyboardSeek()
      this.#userRevision++
      this.#dragging = event.target instanceof Element && !!event.target.closest('.bpx-player-progress, .bilibili-player-video-progress, [role="slider"]')
    })
    const release = (): void => { this.#dragging = false }
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur']) listen(type === 'blur' ? window : document, type, release)
    listen(document, 'keydown', event => {
      this.#clearKeyboardSeek()
      if (!(event instanceof KeyboardEvent) || !event.isTrusted || event.isComposing || event.keyCode === 229
        || event.ctrlKey || event.metaKey || event.altKey || !this.environment.isActuallyVisible()) return
      const editable = (target: EventTarget): boolean => target instanceof Element
        && (!!target.closest('input, textarea, select, [role="textbox"], #bilicdn-v2-control-center')
          || target instanceof HTMLElement && target.isContentEditable)
      if (event.composedPath().some(editable) || event.target && editable(event.target)) return
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'j', 'J', 'l', 'L'].includes(event.key)) {
        this.#beginKeyboardSeek(event, video, player)
      } else if (inRegion(event) && ['ArrowUp', 'ArrowDown', ' ', 'k', 'K'].includes(event.key)) this.#userRevision++
    })
    listen(video, 'seeking', () => {
      const position = Number.isFinite(video.currentTime) ? video.currentTime : null
      if (!this.#internalSeek && position !== this.#pendingSeek) this.#seekRevision++
      this.#targetSec = position
      this.#confirmKeyboardSeek()
    })
    listen(video, 'seeked', () => { this.#pendingSeek = null })
    const original = player?.seek, adapter = this
    const reload = player?.reload
    if (player && typeof reload === 'function') {
      const wrapped = function(this: unknown, ...args: unknown[]): unknown {
        if (!adapter.#internalReload) { adapter.#seekRevision++; adapter.#awaitReloadCore = false; adapter.#coreReloadRevision = 0 }
        return Reflect.apply(reload, this, args)
      }
      try {
        player.reload = wrapped
        this.#controlStops.push(() => { try { if (player.reload === wrapped) player.reload = reload } catch { /* newer owner */ } })
      } catch { /* core identity still revokes unmarked replacements */ }
    }
    if (player && typeof original === 'function') {
      const wrapped = function(this: unknown, ...args: unknown[]): unknown {
        if (!adapter.#internalSeek) {
          adapter.#seekRevision++
          adapter.#pendingSeek = null
          adapter.#targetSec = typeof args[0] === 'number' && Number.isFinite(args[0]) ? Math.max(0, args[0]) : null
        }
        try { return Reflect.apply(original, this, args) }
        finally { adapter.#confirmKeyboardSeek() }
      }
      try {
        player.seek = wrapped
        this.#controlStops.push(() => { try { if (player.seek === wrapped) player.seek = original } catch { /* newer owner */ } })
      } catch { /* observation through media events remains available */ }
    }
  }

  #beginKeyboardSeek(event: KeyboardEvent, video: HTMLVideoElement, player: UnknownRecord | null): void {
    if (!Number.isFinite(video.currentTime)) return
    const candidate: KeyboardSeek = { event, video, player, lifecycle: this.playurl.lifecycleKey(),
      position: video.currentTime, stop: () => undefined }
    this.#keyboardSeek = candidate
    // A late bubble observer covers direct currentTime writes without wrapping media accessors.
    const finish = (observed: Event): void => { if (observed === event) this.#confirmKeyboardSeek() }
    window.addEventListener('keydown', finish)
    const cancel = this.environment.scheduler.timeout(() => {
      if (this.#keyboardSeek === candidate) this.#clearKeyboardSeek()
    }, 0)
    candidate.stop = () => { cancel(); window.removeEventListener('keydown', finish) }
  }

  #confirmKeyboardSeek(): void {
    const candidate = this.#keyboardSeek
    if (!candidate) return
    try {
      // A timer only releases references. Dispatch ownership, not elapsed time, grants attribution.
      if (candidate.event.eventPhase === Event.NONE || candidate.video !== this.#controlVideo
        || candidate.player !== this.#seekOwner || candidate.video !== this.video() || candidate.player !== this.player()
        || candidate.lifecycle !== this.playurl.lifecycleKey() || !this.environment.isActuallyVisible()) {
        this.#clearKeyboardSeek(); return
      }
      if (this.#internalSeek || !candidate.video.seeking || !Number.isFinite(candidate.video.currentTime)
        || candidate.video.currentTime === candidate.position || candidate.video.currentTime === this.#pendingSeek) return
      if (this.#targetSec !== candidate.video.currentTime) this.#seekRevision++
      this.#targetSec = candidate.video.currentTime
      this.#userRevision++
      this.#clearKeyboardSeek()
    } catch { this.#clearKeyboardSeek() }
  }

  #clearKeyboardSeek(): void {
    const candidate = this.#keyboardSeek
    this.#keyboardSeek = null
    candidate?.stop()
  }

  #clearControls(): void {
    this.#clearKeyboardSeek()
    for (const stop of this.#controlStops.splice(0).reverse()) stop()
    this.#controlVideo = null; this.#seekOwner = null; this.#dragging = false; this.#pendingSeek = null
  }

  observePlayIntent(listener: () => void): () => void {
    const target = this.player(), original = target?.play
    if (!target || typeof original !== 'function') return () => undefined
    const wrapped = function(this: unknown, ...args: unknown[]): unknown {
      let active = false
      try { active = unsafeWindow.navigator.userActivation?.isActive === true } catch { /* unsupported */ }
      if (active) listener()
      return Reflect.apply(original, this, args)
    }
    try { target.play = wrapped } catch { return () => undefined }
    return () => {
      try { if (target.play === wrapped) target.play = original } catch { /* site owns method */ }
    }
  }

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
    const accepted = this.playurl.transform({ code: 0, data: { dash: cloned } }, 'player-mpd').accepted
    if (accepted) this.#manifestFingerprint = fingerprint
    return accepted
  }

  reload(): unknown {
    const player = this.player(), reload = player?.reload
    if (!player || typeof reload !== 'function') throw new Error('player.reload unavailable')
    this.#reloadCore = safeCall(player, '__core'); this.#reloadRevision++; this.#awaitReloadCore = true; this.#internalReload++
    try { return Reflect.apply(reload, player, []) }
    catch (error) { this.#awaitReloadCore = false; throw error }
    finally { this.#internalReload-- }
  }
  currentTime(): number { return safeNumber(safeCall(this.player(), 'getCurrentTime')) ?? this.snapshot().currentTime }
  playbackRate(): number {
    const rate = safeNumber(safeCall(this.player(), 'getPlaybackRate'))
    return rate !== null && rate > 0 ? rate : this.snapshot().playbackRate
  }
  seek(value: number): void {
    this.#clearKeyboardSeek()
    this.#internalSeek++; this.#pendingSeek = value
    try {
      const player = this.player(), method = player?.seek
      if (player && typeof method === 'function') { Reflect.apply(method, player, [value]); return }
      const video = this.video(); if (video) video.currentTime = value
    } finally { this.#internalSeek-- }
  }
  setRate(value: number): void {
    const player = this.player(), method = player?.setPlaybackRate
    if (player && typeof method === 'function') { try { Reflect.apply(method, player, [value]); return } catch { /* fallback */ } }
    const video = this.video(); if (video) video.playbackRate = value
  }
  play(): unknown { const player = this.player(); if (!player || typeof player.play !== 'function') throw new Error('player.play unavailable'); return Reflect.apply(player.play, player, []) }
  reset(): void { this.#clearControls(); this.#awaitReloadCore = false; this.#coreReloadRevision = 0; this.#seekRevision++; this.#userRevision++; this.#targetSec = null; this.#cachedVideo = null; this.#manifestFingerprint = '' }

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
