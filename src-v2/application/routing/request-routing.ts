import type { AppliedRouteDecision } from '../route-contracts.ts'
import type { VaultMatch } from '../../state/vault-contracts.ts'
import type { PlayurlOutputSummary } from '../../domain/model.ts'

/** Assemble observations only; this never selects or authorizes a route. */
export function appliedRoute(
  decision: AppliedRouteDecision['decision'],
  url: string | null,
  context: AppliedRouteDecision['context'],
  streamKey: string | null,
  sourceHost: string | null,
  match: VaultMatch,
  output: PlayurlOutputSummary | null,
): AppliedRouteDecision {
  return {
    decision,
    url,
    context,
    streamKey,
    sourceHost,
    attributionStatus: match.status,
    attributionSource: match.source,
    playurlHostChanged: output?.hostChanged ?? false,
    ...(output ? { playurlOutput: output } : {}),
  }
}

import type { DeliveryKind } from '../../domain/url-policy.ts'

export interface RequestSourceFacts {
  readonly kind: DeliveryKind
}

export type RequestSourceClassification =
  | { readonly type: 'opaque' }
  | {
      readonly type: 'unreplaceable'
      readonly reason: 'live' | 'resource' | 'pcdn' | 'suspected-pcdn'
    }
  | { readonly type: 'normal' }

export function classifyRequestSource(facts: RequestSourceFacts): RequestSourceClassification {
  if (facts.kind === 'unknown') return { type: 'opaque' }
  if (facts.kind !== 'normal') return { type: 'unreplaceable', reason: facts.kind }
  return { type: 'normal' }
}

export interface CatalogRequestFacts {
  readonly kind: DeliveryKind
  readonly replaceable: boolean
  readonly exactPcdn: boolean
  readonly hasContext: boolean
  readonly hasSource: boolean
}

export function catalogRequestEligible(facts: CatalogRequestFacts): boolean {
  return (
    (facts.kind === 'normal' || facts.exactPcdn) &&
    facts.replaceable &&
    (!facts.hasContext || facts.hasSource)
  )
}
