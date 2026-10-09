import type { PlayurlTransformResult, PlayurlRequestContext } from '../domain/playurl-model.ts'

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
  observePlayIntent(listener: () => void): () => void
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
  transform(payload: unknown, source: 'trusted-api' | 'player-mpd' | 'page-hint', responseKey?: string, context?: PlayurlRequestContext): PlayurlTransformResult
}

export interface SchedulerPort {
  timeout(task: () => void, delayMs: number): () => void
  interval(task: () => void, delayMs: number): () => void
  microtask(task: () => void): void
}

export interface NavigationPort {
  key(): string
  subscribe(listener: () => void): () => void
}

export interface RangeProbeInput {
  readonly url: string
  readonly host: string | null
  readonly limit: number
  readonly signal: AbortSignal
  readonly completionReason: string
}
export interface RangeProbeResult {
  readonly bytes: number
  readonly elapsedMs: number
  readonly ttfbMs: number | null
  readonly status: number | null
  readonly directRange: boolean
  readonly reason: string
}
export interface RangeProbePort { read(input: RangeProbeInput): Promise<RangeProbeResult> }

export interface PagePlayinfoPort {
  install(): void
  dispose(): void
}
