export interface MeasurementMeta {
  readonly catalogCursor: number
  readonly lastChallengeAt: number
}

export interface MeasurementMetaPort {
  get(): MeasurementMeta
  update(change: Partial<MeasurementMeta>): void
  withLock<T>(task: (lock?: StorageLock) => Promise<T> | T): Promise<T>
  /** Optional on narrow implementations which only support ordinary exploration. */
  coordination?(lock?: StorageLock): MeasurementCoordination | null
  claimRevalidation?(generation: string, claim: RevalidationClaim): boolean
  coordinationCurrent?(generation: string): boolean
  clear(): Promise<void> | void
}
import type { CircuitControlStamp, MediaKind } from '../domain/model.ts'
import type { StorageLock } from '../platform/storage-port.ts'

export interface RevalidationClaim {
  readonly host: string
  readonly kind: MediaKind
  readonly stamp: CircuitControlStamp
  readonly claimId: string
  readonly roundId: string
}
export interface MeasurementCoordination {
  readonly generation: string
  readonly claims: readonly RevalidationClaim[]
}
