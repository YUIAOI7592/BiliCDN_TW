import { type AppliedRouteDecision } from './route-contracts.ts'
import { type VaultMatch } from '../../state/vault-contracts.ts'
import { type PlayurlOutputSummary } from '../../domain/transport-model.ts'
import { type DeliveryKind } from '../../domain/url-policy.ts'
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

import { TRUSTED_CATALOG } from '../../domain/catalog.ts'
import { parseMediaUrl, replaceUrlHost } from '../../domain/url-policy.ts'
import { type RouteDecision, type RouteIdentity } from '../../domain/route-model.ts'
import { type DecisionEligibility, type RoutingVaultReader } from './routing-ports.ts'
export function materializeRoute(
  original: string,
  decision: RouteDecision,
  context: RouteIdentity | null,
  vault: RoutingVaultReader,
  decisionAllowed: DecisionEligibility,
): string | null {
  if (decision.action === 'block') return null
  if (decision.action === 'pass') {
    if (decision.target.type === 'request') return original
    const candidate = decision.target.candidate
    if (
      !context ||
      candidate.route !== context ||
      !candidate.handle ||
      !decisionAllowed(decision, context, context.kind)
    )
      return null
    const exact = vault.resolve(candidate.handle, context)
    if (!exact || parseMediaUrl(exact)?.host !== decision.host) return null
    // A request already on the selected host keeps its own DASH query string.
    return parseMediaUrl(original)?.host === decision.host ? original : exact
  }
  if (decision.candidate.type === 'catalog-generated')
    return replaceUrlHost(original, decision.host)
  return context ? vault.resolve(decision.candidate.handle, context) : null
}

export function catalogSource(
  vault: RoutingVaultReader,
  context: RouteIdentity,
  requested?: string,
): string | null {
  const handle = vault.catalogSourceHandle(context.representation)
  const source = handle ? vault.resolve(handle, context) : null
  const parsed = source ? parseMediaUrl(source) : null
  const generated = parsed?.replaceable ? replaceUrlHost(parsed.url.href, TRUSTED_CATALOG[0]) : null
  if (!generated || parseMediaUrl(generated)?.kind !== 'normal') return null
  const codec = vault.groupSummary(context.representation)?.codec
  if (requested && codec !== 'mp4' && codec !== 'flv') {
    const parsedRequested = parseMediaUrl(requested),
      match = vault.match(requested)
    if (
      parsedRequested?.kind === 'normal' &&
      parsedRequested.replaceable &&
      match.context?.representation === context.representation &&
      (match.source === 'exact' || match.source === 'catalog-alias')
    )
      return parsedRequested.url.href
  }
  return parsed!.url.href
}
