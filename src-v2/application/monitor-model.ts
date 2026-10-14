import type { VideoSnapshot } from './ports.ts'

export interface MonitorSnapshot {
  readonly video: VideoSnapshot
  readonly stableProgressSec: number
  readonly watchdog:
    | 'no-video'
    | 'paused'
    | 'seek-grace'
    | 'buffered-to-end'
    | 'healthy'
    | 'low-buffer'
    | 'recovering'
  readonly stallTicks: number
  readonly startupRescue: {
    readonly state: 'watching' | 'not-needed' | 'fallback-submitted' | 'no-alternative'
    readonly ageSec: number
  }
}
