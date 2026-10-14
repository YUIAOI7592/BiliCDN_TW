import { TRUSTED_CATALOG } from '../../domain/catalog.ts'
import { parseMediaUrl, replaceUrlHost } from '../../domain/url-policy.ts'
import type { RouteDecision, RouteIdentity } from '../../domain/model.ts'
import type { DecisionEligibility, RoutingVaultReader } from './routing-ports.ts'

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
