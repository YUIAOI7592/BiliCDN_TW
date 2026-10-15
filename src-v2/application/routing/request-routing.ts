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
