import type { PlaybackDemand, RepresentationId } from '../domain/model.ts'

export interface MeasurementStatus {
  readonly generationActive: boolean
  readonly representation: RepresentationId | null
  readonly demand: PlaybackDemand | null
  readonly stableProgressSec: number
  readonly playableBufferSec: number
  readonly visible: boolean
  readonly seeking: boolean
  readonly recovering: boolean
  readonly disabled: boolean
}
export interface MeasurementSnapshot {
  readonly state: 'idle' | 'waiting' | 'running' | 'complete' | 'failed' | 'cancelled'
  readonly reason: string
  readonly lastAttemptAt: number
  readonly host: string | null
  readonly startup?: {
    readonly state: string
    readonly reason: string
    readonly candidates: number
    readonly selectedHost: string | null
    readonly delayed: boolean
    readonly results?: readonly {
      readonly host: string
      readonly type: string
      readonly valid: boolean
      readonly safeMbps: number | null
      readonly status: number | null
      readonly reason: string
    }[]
  }
}
