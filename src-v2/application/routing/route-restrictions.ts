import { isCatalogHost } from '../../domain/catalog.ts'
import { hardRestriction } from '../../domain/route-policy.ts'
import { parseMediaUrl } from '../../domain/url-policy.ts'
import type { HardRestriction } from '../../domain/route-policy.ts'
import type { MediaKind, RouteDecision, RouteIdentity } from '../../domain/model.ts'
import type { RestrictionSnapshot } from '../../state/restriction-model.ts'
import type {
  RoutingEnvironmentReader,
  RoutingPolicyReader,
  RoutingRestrictionsReader,
} from './routing-ports.ts'

export function restrictionSnapshot(
  restrictions: RoutingRestrictionsReader,
  kind: MediaKind | null,
): RestrictionSnapshot {
  if (kind) return restrictions.snapshot(kind)
  const video = restrictions.snapshot('video'),
    audio = restrictions.snapshot('audio')
  return {
    blackHosts: new Set([...video.blackHosts, ...audio.blackHosts]),
    deadHosts: new Set([...video.deadHosts, ...audio.deadHosts]),
  }
}

export function restrictedHost(
  input: RoutingEnvironmentReader,
  host: string,
  kind: MediaKind | null,
): HardRestriction | null {
  const settings = input.settings.get(),
    restriction = restrictionSnapshot(input.restrictions, kind),
    evidence = kind ? input.evidence.get(host, kind) : null
  return hardRestriction(
    host,
    {
      ...restriction,
      overrides: settings.catalogOverrides,
      circuitUntil: evidence?.circuitUntil ?? 0,
    },
    input.clock.now(),
  )
}

export function canUseDecision(
  policy: RoutingPolicyReader,
  decision: RouteDecision,
  context: RouteIdentity | null,
  kind: MediaKind | null,
): boolean {
  if (decision.action === 'block' || !decision.host || policy.hardRestriction(decision.host, kind))
    return false
  const source = context && policy.isCatalogOnly() ? policy.catalogSource(context) : null
  if (policy.isCatalogOnly())
    return (
      decision.action === 'rewrite' &&
      decision.candidate.type === 'catalog-generated' &&
      isCatalogHost(decision.host) &&
      (!context || (!!source && !policy.incompatible(source, decision.host)))
    )
  if (decision.action === 'pass') {
    if (context && policy.vault.isInvalid(context.representation, decision.host)) return false
    if (decision.target.type === 'request') return true
    const candidate = decision.target.candidate
    return (
      !!context &&
      candidate.route === context &&
      !!candidate.handle &&
      parseMediaUrl(policy.vault.resolve(candidate.handle, context) ?? '')?.host === decision.host
    )
  }
  const candidate = decision.candidate
  if (candidate.type === 'catalog-generated')
    return (
      !context ||
      !policy.incompatible(policy.vault.rootUrl(context.representation) ?? '', decision.host)
    )
  if (!context) return false
  return policy.vault
    .candidates(context.representation, policy.unlockedNative(context.representation))
    .native.some((route) => route.handle === candidate.handle && route.host === decision.host)
}
