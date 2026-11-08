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

export interface PlayerControlSnapshot {
  readonly mediaId: number
  readonly coreId: number
  readonly seekRevision: number
  readonly userRevision: number
  readonly dragging: boolean
  readonly targetSec: number | null
  readonly pendingSeekGoal?: boolean
  readonly reloadRevision: number
  readonly coreReloadRevision: number
}

export interface PlayerPort {
  readonly observePlaybackInvalidation?: (listener: (revision: number) => void) => () => void
  readonly playbackRevision?: () => number
  controls(): PlayerControlSnapshot
  readonly ownedReload?: (revision: number) => boolean
  observePlayIntent(listener: () => void): () => void
  snapshot(): VideoSnapshot
  syncManifest(): boolean
  reload(): unknown
  currentTime(): number
  playbackRate(): number
  seek(value: number, canCommit?: () => boolean): void
  setRate(value: number, canCommit?: () => boolean): void
  play(canCommit?: () => boolean): unknown
  reset(): void
}
