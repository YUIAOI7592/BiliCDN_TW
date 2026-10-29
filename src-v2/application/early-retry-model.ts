import type { PlaybackDemand, RequestContext } from '../domain/model.ts'
import type { PlayerControlSnapshot, VideoSnapshot } from './ports.ts'

/** Adapter-owned qualified request; no URL, Range or native object crosses this port. */
export interface InFlightVideoSample {
  readonly request: RequestContext
  readonly loadedBytes: number
  readonly totalBytes: number
  /** Non-null only after a trusted/native observation window of one to two seconds. */
  readonly recentBytesPerSec: number | null
}

export interface EarlyRetryAlternative {
  readonly host: string
  readonly safeMbps: number
  readonly ttfbMs: number
  readonly successCount: number
  readonly oldestAt: number
}

export interface EarlyRetryPermit {
  readonly id: string
  readonly expiresAt: number
}

export type EarlyRetryActionState =
  'pending' | 'timedout' | 'dispatched' | 'succeeded' | 'failed' | 'expired'

export interface EarlyRetryStatus {
  readonly enabled: boolean
  readonly disabled: boolean
  readonly originalComparison: boolean
  readonly catalogOnly: boolean
  readonly fixedHost: boolean
  readonly visible: boolean
  readonly recovering: boolean
  readonly stableProgressSec: number
  readonly video: VideoSnapshot
  readonly controls: PlayerControlSnapshot
  readonly demand: PlaybackDemand | null
}

export interface EarlyRetrySnapshot {
  readonly state:
    'idle' | 'waiting' | 'armed' | 'dispatched' | 'complete' | 'cancelled' | 'suspended'
  readonly reason: string
  readonly host: string | null
  readonly attempts: number
  readonly history: readonly {
    readonly at: number
    readonly state: EarlyRetrySnapshot['state']
    readonly reason: string
    readonly host: string | null
  }[]
}
