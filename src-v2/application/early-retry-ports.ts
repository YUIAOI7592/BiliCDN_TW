import type { PlaybackDemand, RequestContext } from '../domain/model.ts'
import type {
  EarlyRetryActionState,
  EarlyRetryAlternative,
  EarlyRetryPermit,
  EarlyRetrySnapshot,
  EarlyRetryStatus,
  InFlightVideoSample,
} from './early-retry-model.ts'

export interface InFlightVideoPort {
  samples(now: number): readonly InFlightVideoSample[]
  arm(requestId: string, permit: EarlyRetryPermit): boolean
  state(permit: EarlyRetryPermit): EarlyRetryActionState | null
  cancel(permit?: EarlyRetryPermit): void
}

export interface RouteEarlyRetryPort {
  alternative(request: RequestContext, demand: PlaybackDemand): EarlyRetryAlternative | null
  prepare(request: RequestContext, host: string, demand: PlaybackDemand): EarlyRetryPermit | null
  revoke(permit: EarlyRetryPermit): void
}

export interface EarlyRetryPort {
  tick(status: EarlyRetryStatus): void
  reset(): void
  cancel(reason?: string): void
  dispose(): void
  snapshot(): EarlyRetrySnapshot
  subscribe(listener: (snapshot: EarlyRetrySnapshot) => void): () => void
}
