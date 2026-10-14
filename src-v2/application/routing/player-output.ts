import { TRUSTED_CATALOG, isCatalogHost } from '../../domain/catalog.ts'
import {
  originalOutputPlan,
  backupOutputPlan,
  catalogOutputPlan,
} from '../../domain/player-output-plan.ts'
import { mediaIdentity, parseMediaUrl, replaceUrlHost } from '../../domain/url-policy.ts'
import type { RepresentationId, RouteDecision, RouteIdentity } from '../../domain/model.ts'
import type { RoutingPolicyReader } from './routing-ports.ts'

export interface PlayerOutputUrls {
  readonly primary: string
  readonly backups: readonly string[]
}
export type OutputEligibility = (url: string) => boolean

export function outputAllowed(
  policy: RoutingPolicyReader,
  representation: RepresentationId,
  context: RouteIdentity,
  url: string,
): boolean {
  const parsed = parseMediaUrl(url)
  const match = parsed?.kind === 'unknown' ? policy.vault.match(url) : null
  const exactOpaque = match?.source === 'exact' && match.context?.representation === representation
  return (
    !!parsed &&
    (parsed.kind === 'normal' || exactOpaque) &&
    !policy.hardRestriction(parsed.host, context.kind) &&
    !policy.vault.isInvalid(representation, parsed.host)
  )
}

export function opaquePlayerOutput(
  policy: RoutingPolicyReader,
  representation: RepresentationId,
  context: RouteIdentity,
  originals: readonly string[],
): PlayerOutputUrls {
  const permitted = [...new Set(originals)].filter((url) => {
    const parsed = parseMediaUrl(url),
      match = policy.vault.match(url)
    return (
      !!parsed &&
      match.source === 'exact' &&
      match.context?.representation === representation &&
      !policy.hardRestriction(parsed.host, context.kind) &&
      !policy.vault.isInvalid(representation, parsed.host)
    )
  })
  return { primary: permitted[0] ?? '', backups: permitted.slice(1, 6) }
}

export function comparisonOutput(
  originals: readonly string[],
  allowed: OutputEligibility,
): PlayerOutputUrls & { readonly permitted: readonly string[] } {
  const unique = [...new Set(originals)]
  const candidates = unique.map((url, index) => ({
    index,
    host: parseMediaUrl(url)?.host ?? '',
    allowed: allowed(url),
  }))
  const plan = originalOutputPlan(candidates)
  const permitted = candidates
    .filter((candidate) => candidate.allowed)
    .map((candidate) => unique[candidate.index]!)
  const primary = plan.primary === null ? '' : unique[plan.primary]!,
    backups = plan.backups.map((index) => unique[index]!)
  return { primary, backups, permitted }
}

export function catalogPlayerOutput(
  sourceUrl: string | null,
  decision: RouteDecision,
  allowed: OutputEligibility,
  incompatible: (url: string, host: string) => boolean,
): PlayerOutputUrls | null {
  if (
    !sourceUrl ||
    decision.action !== 'rewrite' ||
    decision.candidate.type !== 'catalog-generated' ||
    !isCatalogHost(decision.host)
  )
    return null
  const primary = replaceUrlHost(sourceUrl, decision.host)
  if (!primary || !allowed(primary) || incompatible(sourceUrl, decision.host)) return null
  const preferred = decision.ranking
    .filter((row) => row.eligible && row.candidate.type === 'catalog-generated')
    .map((row) => row.candidate.host)
  const unavailable = new Set(
    TRUSTED_CATALOG.filter(
      (host) => incompatible(sourceUrl, host) || !allowed(replaceUrlHost(sourceUrl, host) ?? ''),
    ),
  )
  const backups = catalogOutputPlan(decision.host, preferred, unavailable).flatMap((host) => {
    const url = replaceUrlHost(sourceUrl, host)
    return url ? [url] : []
  })
  return { primary, backups }
}

export function normalPlayerOutput(
  representation: RepresentationId,
  original: string,
  decision: RouteDecision,
  originals: readonly string[],
  stream: string | null,
  policy: RoutingPolicyReader,
  allowed: OutputEligibility,
  hostLocked: (stream: string) => boolean,
  materialize: () => string | null,
): PlayerOutputUrls | null {
  const lockedOriginal = stream && hostLocked(stream) ? policy.vault.rootUrl(representation) : null
  const primary = lockedOriginal && allowed(lockedOriginal) ? lockedOriginal : materialize()
  if (!primary || !allowed(primary)) return null
  const locked = mediaIdentity(original)
  const generated =
    locked && hostLocked(locked)
      ? []
      : decision.ranking
          .filter(
            (row) =>
              row.eligible &&
              row.candidate.type === 'catalog-generated' &&
              !policy.incompatible(original, row.candidate.host),
          )
          .flatMap((row) => {
            const url = replaceUrlHost(original, row.candidate.host)
            return url && allowed(url) ? [url] : []
          })
  const primaryHost = parseMediaUrl(primary)?.host
  const urls = [...new Set([...originals, ...generated])].filter((url) => url !== primary)
  const candidates = urls.map((url, index) => ({
    index,
    host: parseMediaUrl(url)?.host ?? '',
    allowed: allowed(url),
  }))
  const backups = backupOutputPlan(primaryHost ?? null, candidates, !!lockedOriginal).map(
    (index) => urls[index]!,
  )
  return { primary, backups }
}
