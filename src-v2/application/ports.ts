export interface VideoSnapshot {
  readonly available: boolean
  readonly paused: boolean
  readonly seeking: boolean
  readonly ended: boolean
  readonly readyState: number
  readonly currentTime: number
  readonly duration: number | null
  readonly width: number
  readonly height: number
  readonly playbackRate: number
  readonly effectiveRate: number
  readonly bufferAheadSec: number
  readonly playableBufferSec: number
  readonly bufferedToEnd: boolean
  readonly frames: number | null
  readonly mediaError: boolean
  readonly coreInitialized: boolean | null
  readonly manifestHasVideo: boolean
}

export interface PlayerPort {
  player(): Record<string, unknown> | null
  snapshot(): VideoSnapshot
  syncManifest(): boolean
  reload(): unknown
  currentTime(): number
  playbackRate(): number
  seek(value: number): void
  setRate(value: number): void
  play(): unknown
  reset(): void
}

export interface PlayurlPort {
  transform(payload: unknown, source: 'trusted-api' | 'player-mpd' | 'page-hint'): boolean
}

export interface PagePlayinfoPort {
  install(): void
  dispose(): void
}
