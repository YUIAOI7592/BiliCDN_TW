import type { RequestContext } from '../domain/model.ts'
import type { EarlyRetryPermit } from './early-retry-model.ts'
import type { AppliedRouteDecision } from './route-model.ts'

/** Only the XHR adapter may apply a permit after its private exact Range comparison. */
export interface EarlyRetryRoutingPort {
  applyEarlyRetry(url: string, permit: EarlyRetryPermit): AppliedRouteDecision | null
  acceptEarlyRetry(permit: EarlyRetryPermit, request: RequestContext): boolean
  revokeEarlyRetry(permit: EarlyRetryPermit): void
  earlyRetryRequestCurrent(request: RequestContext): boolean
}

/** A tool-owned, in-memory scope; never exposed through diagnostics, DOM or page messages. */
export interface EarlyRetryEvidenceControlPort {
  suppressEarlyRetryEvidence(requestIds: readonly string[]): () => void
}
