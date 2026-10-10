import type { PlayurlPort, VideoSnapshot, PlayerControlSnapshot, SchedulerPort } from '../application/ports.ts'

type UnknownRecord = Record<string, unknown>
const isRecord = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object'
const safeCall = (target: unknown, name: string, ...args: unknown[]): unknown => {
  if (!isRecord(target)) return undefined
  try { const fn = target[name]; return typeof fn === 'function' ? Reflect.apply(fn, target, args) : undefined } catch { return undefined }
}
const safeNumber = (value: unknown): number | null => Number.isFinite(Number(value)) ? Number(value) : null
const sameDescriptor = (left: PropertyDescriptor | undefined, right: PropertyDescriptor | undefined): boolean =>
  left === undefined || right === undefined ? left === right
    : left.value === right.value && left.get === right.get && left.set === right.set
      && left.writable === right.writable && left.enumerable === right.enumerable && left.configurable === right.configurable

// Use the SDK's setter when present. Cleanup owns both the method and its
// descriptor, and removes a shadow created over an inherited data method.
const observeMethod = (target: UnknownRecord, name: string, original: unknown, wrapped: unknown): (() => void) => {
  const before = Object.getOwnPropertyDescriptor(target, name)
  target[name] = wrapped
  const installed = Object.getOwnPropertyDescriptor(target, name)
  return () => {
    try {
      if (!sameDescriptor(Object.getOwnPropertyDescriptor(target, name), installed) || target[name] !== wrapped
        || !sameDescriptor(Object.getOwnPropertyDescriptor(target, name), installed)) return
      if (!before && installed) Reflect.deleteProperty(target, name)
      else if (before && 'value' in before) Object.defineProperty(target, name, before)
      else target[name] = original
    } catch { /* a newer SDK or script owns the method */ }
  }
}

interface ControlEnvironment {
  readonly scheduler: Pick<SchedulerPort, 'timeout'>
  readonly isActuallyVisible: () => boolean
  readonly subscribeControlLoss: (listener: () => void) => () => void
}
interface ProgressDrag {
  readonly pointerId: number
  readonly video: HTMLVideoElement
  readonly player: UnknownRecord | null
  readonly lifecycle: string
}
interface KeyboardSeek {
  readonly event: KeyboardEvent
  readonly video: HTMLVideoElement
  readonly player: UnknownRecord | null
  readonly lifecycle: string
  readonly position: number
  stop: () => void
}
interface KeyboardPlayback {
  readonly event: KeyboardEvent
  readonly video: HTMLVideoElement
  readonly player: UnknownRecord | null
  readonly core: unknown
  readonly lifecycle: string
  readonly paused: boolean
  readonly rate: number
  readonly kind: 'pause' | 'rate'
  readonly revision: number
  stop: () => void
}
interface OwnedReload {
  readonly revision: number
  readonly video: HTMLVideoElement
  readonly player: UnknownRecord
  readonly lifecycle: string
  readonly userRevision: number
  readonly sourceCore: unknown
  replacement: unknown
  sawNull: boolean
  cancel: () => void
}

export class PlayerAdapter {
  #cachedVideo: HTMLVideoElement | null = null
  #manifestFingerprint = ''
  #objects = new WeakMap<object, number>()
  #objectSerial = 0
  #seekRevision = 0
  #userRevision = 0
  #drag: ProgressDrag | null = null
  #pointerRevision = 0
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
  #keyboardPlayback: KeyboardPlayback | null = null
  #keyboardRevision = 0
  #ownedReload: OwnedReload | null = null
  constructor(private readonly playurl: PlayurlPort & { lifecycleKey(): string }, private readonly environment: ControlEnvironment) {}

  protected player(): UnknownRecord | null { try { return isRecord(unsafeWindow.player) ? unsafeWindow.player : null } catch { return null } }

  controls(): PlayerControlSnapshot {
    const reloadOwner = this.#ownedReload
    const video = this.video(), player = this.player(), core = safeCall(player, '__core')
    if (video !== this.#controlVideo || player !== this.#seekOwner) this.#observeControls(video, player)
    this.#validateDrag()
    this.#confirmKeyboardSeek()
    this.#confirmKeyboardPlayback()
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
    if (reloadOwner) this.#validateOwnedReload(video, player, core, reloadOwner)
    else if (!this.#ownedReload && !this.#awaitReloadCore && core !== this.#reloadCore) this.#coreReloadRevision = 0
    this.#reloadCore = core
    return Object.freeze({ mediaId: identity(video), coreId: identity(core), seekRevision: this.#seekRevision,
      userRevision: this.#userRevision, dragging: this.#drag !== null, targetSec: this.#targetSec,
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
      if (!event.isTrusted) return
      const revision = ++this.#pointerRevision
      if (!this.environment.isActuallyVisible() || !inRegion(event) || revision !== this.#pointerRevision) return
      this.#clearKeyboardSeek()
      this.#clearKeyboardPlayback()
      this.#advanceUser()
      const lifecycle = this.playurl.lifecycleKey()
      const hit = event.target instanceof Element
        ? event.target.closest('.bpx-player-progress-wrap, .bpx-player-progress, .bilibili-player-video-progress, [role="slider"]') : null
      if (!hit || !region?.contains(hit) || typeof PointerEvent !== 'function' || !(event instanceof PointerEvent)) return
      const pointerId = event.pointerId
      if (!Number.isInteger(pointerId)) return
      const current = video === this.video() && player === this.player() && lifecycle === this.playurl.lifecycleKey()
        && this.environment.isActuallyVisible()
      if (!current || video !== this.#controlVideo || player !== this.#seekOwner || revision !== this.#pointerRevision) return
      this.#drag = { pointerId, video, player, lifecycle }
    })
    const release: EventListener = event => {
      const drag = this.#drag
      if (!drag || !event.isTrusted || typeof PointerEvent !== 'function' || !(event instanceof PointerEvent)
        || event.pointerId !== drag.pointerId) return
      if (this.#drag === drag) { this.#drag = null; this.#pointerRevision++ }
    }
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(document, type, release)
    const controlLoss = (): void => {
      this.#drag = null; this.#pointerRevision++; this.#clearKeyboardSeek(); this.#clearKeyboardPlayback(); this.#clearOwnedReload()
    }
    listen(window, 'blur', event => { if (event.isTrusted) controlLoss() })
    this.#controlStops.push(this.environment.subscribeControlLoss(controlLoss))
    const observeKeyboard: EventListener = event => {
      const revision = ++this.#keyboardRevision
      this.#clearKeyboardSeek()
      this.#clearKeyboardPlayback()
      if (!(event instanceof KeyboardEvent) || !event.isTrusted || event.isComposing || event.keyCode === 229
        || event.ctrlKey || event.metaKey || event.altKey || !this.environment.isActuallyVisible()) return
      const editable = (target: EventTarget): boolean => target instanceof Element
        && (!!target.closest('input, textarea, select, [role="textbox"], #bilicdn-v2-control-center')
          || target instanceof HTMLElement && target.isContentEditable)
      if (event.composedPath().some(editable) || event.target && editable(event.target)) return
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'j', 'J', 'l', 'L'].includes(event.key)) {
        this.#beginKeyboardSeek(event, video, player)
      } else if (event.type === 'keydown' && ['ArrowUp', 'ArrowDown', ' ', 'k', 'K'].includes(event.key)) {
        const inside = inRegion(event)
        if (revision !== this.#keyboardRevision) return
        if (inside) this.#advanceUser()
        else this.#beginKeyboardPlayback(event, video, player, revision)
      }
    }
    for (const type of ['keydown', 'keyup']) listen(document, type, observeKeyboard)
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
        if (!adapter.#internalReload) { adapter.#seekRevision++; adapter.#clearOwnedReload() }
        return Reflect.apply(reload, this, args)
      }
      try {
        this.#controlStops.push(observeMethod(player, 'reload', reload, wrapped))
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
        this.#controlStops.push(observeMethod(player, 'seek', original, wrapped))
      } catch { /* observation through media events remains available */ }
    }
  }

  #beginKeyboardSeek(event: KeyboardEvent, video: HTMLVideoElement, player: UnknownRecord | null): void {
    if (!Number.isFinite(video.currentTime)) return
    const candidate: KeyboardSeek = { event, video, player, lifecycle: this.playurl.lifecycleKey(),
      position: video.currentTime, stop: () => undefined }
    this.#keyboardSeek = candidate
    // A late bubble observer covers direct currentTime writes without wrapping media accessors.
    const type = event.type
    const finish = (observed: Event): void => {
      if (observed === event && this.#keyboardSeek === candidate) this.#confirmKeyboardSeek()
    }
    window.addEventListener(type, finish)
    const cancel = this.environment.scheduler.timeout(() => {
      if (this.#keyboardSeek === candidate) this.#clearKeyboardSeek()
    }, 0)
    candidate.stop = () => { cancel(); window.removeEventListener(type, finish) }
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
      this.#advanceUser()
      this.#clearKeyboardSeek()
    } catch { this.#clearKeyboardSeek() }
  }

  #clearKeyboardSeek(): void {
    const candidate = this.#keyboardSeek
    this.#keyboardSeek = null
    candidate?.stop()
  }

  #beginKeyboardPlayback(event: KeyboardEvent, video: HTMLVideoElement, player: UnknownRecord | null, revision: number): void {
    const candidate: KeyboardPlayback = { event, video, player, core: safeCall(player, '__core'),
      lifecycle: this.playurl.lifecycleKey(), paused: video.paused, rate: video.playbackRate,
      kind: [' ', 'k', 'K'].includes(event.key) ? 'pause' : 'rate', revision, stop: () => undefined }
    if (revision !== this.#keyboardRevision || video !== this.#controlVideo || player !== this.#seekOwner) return
    this.#keyboardPlayback = candidate
    const finish = (observed: Event): void => {
      if (observed === event && this.#keyboardPlayback === candidate) this.#confirmKeyboardPlayback()
    }
    window.addEventListener(event.type, finish)
    const cancel = this.environment.scheduler.timeout(() => {
      if (this.#keyboardPlayback === candidate) this.#clearKeyboardPlayback()
    }, 0)
    candidate.stop = () => { cancel(); window.removeEventListener(event.type, finish) }
  }

  #confirmKeyboardPlayback(): void {
    const candidate = this.#keyboardPlayback
    if (!candidate) return
    try {
      const eligible = candidate.event.eventPhase !== Event.NONE && candidate.revision === this.#keyboardRevision
        && candidate.video === this.#controlVideo && candidate.player === this.#seekOwner
        && candidate.video === this.video() && candidate.player === this.player()
        && candidate.core === safeCall(candidate.player, '__core') && candidate.lifecycle === this.playurl.lifecycleKey()
        && this.environment.isActuallyVisible()
      const changed = candidate.kind === 'pause' ? candidate.video.paused !== candidate.paused
        : Number.isFinite(candidate.video.playbackRate) && candidate.video.playbackRate !== candidate.rate
      if (this.#keyboardPlayback !== candidate || candidate.revision !== this.#keyboardRevision) return
      if (!eligible) { this.#clearKeyboardPlayback(); return }
      if (changed) { this.#advanceUser(); this.#clearKeyboardPlayback() }
    } catch { if (this.#keyboardPlayback === candidate) this.#clearKeyboardPlayback() }
  }

  #clearKeyboardPlayback(): void {
    const candidate = this.#keyboardPlayback
    this.#keyboardPlayback = null
    candidate?.stop()
  }

  #advanceUser(): void { this.#userRevision++; this.#clearOwnedReload() }

  #clearOwnedReload(): void {
    const owner = this.#ownedReload
    this.#ownedReload = null; this.#awaitReloadCore = false; this.#coreReloadRevision = 0
    owner?.cancel()
  }

  #validateOwnedReload(video: HTMLVideoElement | null, player: UnknownRecord | null, core: unknown, owner: OwnedReload): void {
    if (this.#ownedReload !== owner) return
    const valid = video === owner.video && player === owner.player && owner.revision === this.#reloadRevision
      && owner.lifecycle === this.playurl.lifecycleKey() && owner.userRevision === this.#userRevision
      && this.environment.isActuallyVisible()
    if (this.#ownedReload !== owner) return
    if (!valid) { this.#clearOwnedReload(); return }
    if (owner.replacement) {
      if (core !== owner.replacement) this.#clearOwnedReload()
      return
    }
    if (!core) { owner.sawNull = true; return }
    if (core === owner.sourceCore) {
      if (owner.sawNull) this.#clearOwnedReload()
      return
    }
    owner.replacement = core; this.#coreReloadRevision = owner.revision; this.#awaitReloadCore = false
  }

  ownedReload(revision: number): boolean {
    this.#confirmKeyboardPlayback()
    const owner = this.#ownedReload
    if (!owner || owner.revision !== revision) return false
    this.#validateOwnedReload(this.video(), this.player(), safeCall(owner.player, '__core'), owner)
    return this.#ownedReload === owner
  }

  #validateDrag(): void {
    const drag = this.#drag
    if (!drag) return
    if (drag.video !== this.#controlVideo || drag.player !== this.#seekOwner || drag.video !== this.video()
      || drag.player !== this.player() || drag.lifecycle !== this.playurl.lifecycleKey() || !this.environment.isActuallyVisible()) {
      if (this.#drag === drag) { this.#drag = null; this.#pointerRevision++ }
    }
  }

  #clearControls(): void {
    this.#clearKeyboardSeek()
    this.#clearKeyboardPlayback(); this.#keyboardRevision++; this.#clearOwnedReload()
    for (const stop of this.#controlStops.splice(0).reverse()) stop()
    this.#controlVideo = null; this.#seekOwner = null; this.#drag = null; this.#pointerRevision++; this.#pendingSeek = null
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
    try { return observeMethod(target, 'play', original, wrapped) } catch { return () => undefined }
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
    this.#clearKeyboardPlayback()
    const userRevision = this.#userRevision, beforeRevision = this.#reloadRevision
    const player = this.player(), video = this.video(), lifecycle = this.playurl.lifecycleKey()
    const sourceCore = safeCall(player, '__core'), reload = player?.reload
    if (!player || typeof reload !== 'function') throw new Error('player.reload unavailable')
    const currentPlayer = this.player(), currentVideo = this.video(), currentCore = safeCall(player, '__core')
    const visible = this.environment.isActuallyVisible(), currentLifecycle = this.playurl.lifecycleKey()
    if (userRevision !== this.#userRevision || beforeRevision !== this.#reloadRevision || currentPlayer !== player
      || currentVideo !== video || currentCore !== sourceCore || currentLifecycle !== lifecycle || !visible) {
      throw new Error('player.reload ownership ended')
    }
    this.#clearOwnedReload()
    this.#reloadCore = sourceCore; const revision = ++this.#reloadRevision
    const owner: OwnedReload | null = video ? { revision, video, player, lifecycle, userRevision,
      sourceCore: this.#reloadCore, replacement: null, sawNull: false, cancel: () => undefined } : null
    this.#ownedReload = owner; this.#awaitReloadCore = owner !== null
    if (owner) owner.cancel = this.environment.scheduler.timeout(() => {
      if (this.#ownedReload === owner) this.#clearOwnedReload()
    }, 15_000)
    if (this.#ownedReload !== owner || this.#reloadRevision !== revision || this.#userRevision !== userRevision) {
      if (this.#ownedReload === owner) this.#clearOwnedReload()
      throw new Error('player.reload ownership ended')
    }
    this.#internalReload++
    try {
      const result: unknown = Reflect.apply(reload, player, [])
      if (result && (typeof result === 'object' || typeof result === 'function')) void Promise.resolve(result).catch(() => {
        if (this.#ownedReload === owner) this.#clearOwnedReload()
      })
      return result
    }
    catch (error) { if (this.#ownedReload === owner) this.#clearOwnedReload(); throw error }
    finally { this.#internalReload-- }
  }
  currentTime(): number { return safeNumber(safeCall(this.player(), 'getCurrentTime')) ?? this.snapshot().currentTime }
  playbackRate(): number {
    const rate = safeNumber(safeCall(this.player(), 'getPlaybackRate'))
    return rate !== null && rate > 0 ? rate : this.snapshot().playbackRate
  }
  seek(value: number): void {
    this.#clearKeyboardSeek()
    this.#clearKeyboardPlayback()
    this.#internalSeek++; this.#pendingSeek = value
    try {
      const player = this.player(), method = player?.seek
      if (player && typeof method === 'function') { Reflect.apply(method, player, [value]); return }
      const video = this.video(); if (video) video.currentTime = value
    } finally { this.#internalSeek-- }
  }
  setRate(value: number): void {
    this.#clearKeyboardPlayback()
    const player = this.player(), method = player?.setPlaybackRate
    if (player && typeof method === 'function') { try { Reflect.apply(method, player, [value]); return } catch { /* fallback */ } }
    const video = this.video(); if (video) video.playbackRate = value
  }
  play(): unknown { this.#clearKeyboardPlayback(); const player = this.player(); if (!player || typeof player.play !== 'function') throw new Error('player.play unavailable'); return Reflect.apply(player.play, player, []) }
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
