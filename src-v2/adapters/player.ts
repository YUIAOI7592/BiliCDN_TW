import type {
  LifecyclePlayurlPort,
  PlayerControlSnapshot,
  VideoSnapshot,
} from '../application/ports.ts'
import { PlayerControlObserver } from './player-controls.ts'
import type { PlayerControlEnvironment } from './player-controls.ts'
import { PlayerMediaReader, readVideoSnapshot, clonePlayerManifest } from './player-media.ts'
import { isRecord, safeCall, safeNumber } from './player-sdk.ts'
import type { UnknownRecord } from './player-sdk.ts'
import type { ResumePositionCapture } from '../application/recovery-ports.ts'

export class PlayerAdapter {
  readonly #media = new PlayerMediaReader()
  readonly #controls: PlayerControlObserver
  #manifestFingerprint = ''

  constructor(
    private readonly playurl: LifecyclePlayurlPort,
    environment: PlayerControlEnvironment,
  ) {
    this.#controls = new PlayerControlObserver(
      {
        video: () => this.video(),
        player: () => this.player(),
        lifecycleKey: () => this.playurl.lifecycleKey(),
      },
      environment,
    )
  }

  protected player(): UnknownRecord | null {
    try {
      return isRecord(unsafeWindow.player) ? unsafeWindow.player : null
    } catch {
      return null
    }
  }

  controls(): PlayerControlSnapshot {
    return this.#controls.controls()
  }
  captureResumePosition(): ResumePositionCapture {
    return this.#controls.captureResumePosition(() => this.currentTime())
  }
  validateResumePosition(capture: ResumePositionCapture, initializationRevision?: number): boolean {
    return this.#controls.validateResumePosition(capture, initializationRevision)
  }
  ownedReload(revision: number): boolean {
    return this.#controls.ownedReload(revision)
  }
  observePlayIntent(listener: () => void): () => void {
    return this.#controls.observePlayIntent(listener)
  }
  video(): HTMLVideoElement | null {
    return this.#media.video()
  }
  snapshot(): VideoSnapshot {
    return readVideoSnapshot(this.video(), this.player())
  }

  syncManifest(): boolean {
    const player = this.player(),
      core = safeCall(player, '__core'),
      mpd = safeCall(core, 'getMpd')
    if (!isRecord(mpd)) return false
    const cloned = clonePlayerManifest(mpd)
    if (!cloned) return false
    const fingerprint = `${this.playurl.lifecycleKey()}:${JSON.stringify(cloned)}`
    if (fingerprint === this.#manifestFingerprint) return true
    const accepted = this.playurl.transform(
      { code: 0, data: { dash: cloned } },
      'player-mpd',
    ).accepted
    if (accepted) this.#manifestFingerprint = fingerprint
    return accepted
  }

  reload(): unknown {
    return this.#controls.reload()
  }

  currentTime(): number {
    const video = this.video()
    try {
      // HAVE_NOTHING can already hold a new native seek target while the SDK
      // reader still returns its cached pre-seek time. Zero is a valid target.
      if (video?.readyState === 0) {
        const position = video.currentTime
        if (Number.isFinite(position)) return position
      }
    } catch {
      /* preserve the SDK fallback when native observation is unavailable */
    }
    return safeNumber(safeCall(this.player(), 'getCurrentTime')) ?? this.snapshot().currentTime
  }

  playbackRate(): number {
    const rate = safeNumber(safeCall(this.player(), 'getPlaybackRate'))
    return rate !== null && rate > 0 ? rate : this.snapshot().playbackRate
  }

  seek(value: number, canCommit?: () => boolean): void {
    this.#controls.seek(value, canCommit)
  }
  setRate(value: number, canCommit?: () => boolean): void {
    this.#controls.setRate(value, canCommit)
  }
  play(): unknown {
    return this.#controls.play()
  }
  reset(): void {
    this.#controls.reset()
    this.#media.reset()
    this.#manifestFingerprint = ''
  }
}
