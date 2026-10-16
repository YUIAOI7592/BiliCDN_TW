import type { DomainEvent } from '../domain/model.ts'
import type { PlayerPort, VideoSnapshot, PlayerControlSnapshot } from './ports.ts'
import type { StallRecoveryIntent, RecoverySnapshot } from './recovery-model.ts'

export interface ResumePositionCapture {
  readonly positionSec: number
  readonly proof: object | null
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
