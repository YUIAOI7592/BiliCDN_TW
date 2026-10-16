export type RecoverySource =
  | 'trusted-player-play'
  | 'paused-transition'
  | 'route-failure'
  | 'watchdog'
  | 'startup-failure'
  | 'stall'
export interface StallRecoveryIntent {
  readonly id: number
  readonly startedAt: number
  readonly targetSec: number
  readonly reloadAfterMs?: number
  readonly valid: () => boolean
}
export interface RecoverySnapshot {
  readonly state:
    | 'healthy'
    | 'pause-armed'
    | 'play-intent'
    | 'waiting'
    | 'reloading'
    | 'recovered'
    | 'recovered-paused'
    | 'failed'
    | 'breaker'
  readonly source: RecoverySource | null
  readonly pauseSec: number
  readonly reloadCount: number
  readonly breakerSec: number
  readonly reason?: string
  readonly savedPositionSec?: number
  readonly savedRate?: number
}
