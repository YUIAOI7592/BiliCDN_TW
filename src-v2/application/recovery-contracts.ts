import { type DomainEvent } from '../domain/model.ts'
import { type PlayerPort, type VideoSnapshot, type PlayerControlSnapshot } from './ports.ts'
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
  readonly restoration?: {
    readonly phase: 'position' | 'rate' | 'progress'
    readonly channel: 'sdk' | 'native' | 'none'
    readonly result: 'pending' | 'unknown' | 'verified' | 'mismatch'
  }
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

export interface ResumePositionCapture {
  readonly positionSec: number
  readonly proof: object | null
}

export interface RestoreCommand {
  readonly kind: 'position' | 'rate'
  readonly value: number
  readonly at: number
}
export interface RestoreGuard {
  readonly reloadRevision: number
  readonly valid: () => boolean
  readonly now: () => number
}
export interface RestoreAttempt {
  readonly kind: RestoreCommand['kind']
  readonly proof: object
}
export type RestoreReadMode = 'command' | 'progress'
export interface RestoreReadback {
  readonly owned: boolean
  readonly channel: 'sdk' | 'native' | 'none'
  readonly status: 'pending' | 'settled' | 'rejected'
  readonly positionSec: number | null
  readonly rate: number | null
  readonly paused: boolean | null
  readonly seeking: boolean | null
  readonly readyState: number | null
  readonly landing: { readonly positionSec: number; readonly at: number } | null
}

export interface RecoveryPlayerPort extends Pick<
  PlayerPort,
  | 'controls'
  | 'currentTime'
  | 'observePlayIntent'
  | 'play'
  | 'playbackRate'
  | 'reload'
  | 'ownedReload'
  | 'seek'
  | 'setRate'
  | 'snapshot'
> {
  captureResumePosition(): ResumePositionCapture
  validateResumePosition(capture: ResumePositionCapture, initializationRevision?: number): boolean
  performRestore(command: RestoreCommand, guard: RestoreGuard): RestoreAttempt
  readRestore(attempt: RestoreAttempt, mode?: RestoreReadMode): RestoreReadback
  correctRestore(attempt: RestoreAttempt): void
}
export interface RecoveryPort {
  subscribe(listener: (event: DomainEvent) => void): () => void
  snapshot(): RecoverySnapshot
  isRecovering(): boolean
  ongoingStallReload(id: number, snapshot: VideoSnapshot, controls: PlayerControlSnapshot): boolean
  reset(): void
  armRouteFailure(
    source: 'route-failure' | 'watchdog',
    snapshot: VideoSnapshot,
    valid?: () => boolean,
  ): void
  armStall(snapshot: VideoSnapshot, intent: StallRecoveryIntent): void
  cancelStall(id: number): void
  rejectStall(): void
  armStartupFailure(snapshot: VideoSnapshot, valid?: () => boolean): void
  tick(snapshot: VideoSnapshot): void
  dispose(): void
}
