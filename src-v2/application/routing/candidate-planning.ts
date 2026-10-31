import { TRUSTED_CATALOG } from '../../domain/catalog.ts'
import { catalogCandidates } from '../../domain/route-policy.ts'
import { evidenceMetrics } from '../../domain/evidence.ts'
import { mediaIdentity, parseMediaUrl, replaceUrlHost } from '../../domain/url-policy.ts'
import type {
  Clock,
  MediaKind,
  RouteCandidate,
  RouteIdentity,
  RouteType,
} from '../../domain/model.ts'
import type { VaultCandidates } from '../../state/vault-contracts.ts'
import type { StartupCandidate } from '../route-contracts.ts'
import type {
  RoutingEvidenceReader,
  RoutingPolicyReader,
  RoutingVaultReader,
} from './routing-ports.ts'

export interface StartupAssemblyInput {
  readonly clock: Clock
  readonly evidence: RoutingEvidenceReader
  readonly policy: RoutingPolicyReader
  readonly context: RouteIdentity
  readonly parsed: NonNullable<ReturnType<typeof parseMediaUrl>>
  readonly source: string
  readonly catalogCursor: number
}

// Yield each admitted candidate before reading the next one. The coordinator
// assigns its work ID at the original point, without moving the ID ledger here.
export function* startupCandidates(input: StartupAssemblyInput): Generator<StartupCandidate> {
  const { clock, evidence, policy, context, parsed, source, catalogCursor } = input
  const candidates: StartupCandidate[] = []
  const add = (
    host: string,
    type: RouteType,
    candidateUrl: string,
    original: boolean,
  ): StartupCandidate | null => {
    if (
      candidates.length >= 3 ||
      candidates.some((candidate) => candidate.host === host) ||
      policy.hardRestriction(host, context.kind) ||
      policy.vault.isInvalid(context.representation, host)
    )
      return null
    const checked = parseMediaUrl(candidateUrl)
    if (!checked || checked.kind !== 'normal' || checked.host !== host) return null
    const key = mediaIdentity(candidateUrl)
    if (key && policy.incompatible(candidateUrl, host)) return null
    const prior = evidence.get(host, context.kind)
    const cachedSafeMbps =
      type === 'catalog-generated' && prior && clock.now() - prior.updatedAt <= 5 * 60_000
        ? evidenceMetrics(prior, clock.now()).safeThroughputMbps
        : null
    return { host, type, url: candidateUrl, original, cachedSafeMbps, context }
  }
  if (!policy.isCatalogOnly()) {
    const original = add(parsed.host, 'root-original', parsed.url.href, true)
    if (original) {
      yield original
      candidates.push(original)
    }
    const native = policy.vault.candidates(
      context.representation,
      policy.unlockedNative(context.representation),
    ).native
    for (const route of native) {
      const exact = policy.vault.resolve(route.handle, context)
      if (exact && route.host !== parsed.host) {
        const candidate = add(route.host, 'native-signed', exact, false)
        if (candidate) {
          yield candidate
          candidates.push(candidate)
        }
        break
      }
    }
  }
  const catalog = TRUSTED_CATALOG.filter((host) => !policy.hardRestriction(host, context.kind))
  for (let offset = 0; offset < catalog.length && candidates.length < 3; offset++) {
    const host = catalog[(catalogCursor + offset) % catalog.length]
    if (!host) continue
    const generated = replaceUrlHost(source, host)
    if (!generated) continue
    const candidate = add(host, 'catalog-generated', generated, false)
    if (candidate) {
      yield candidate
      candidates.push(candidate)
    }
  }
}

export function selectionCandidates(
  context: RouteIdentity,
  root: string,
  routes: VaultCandidates,
  vault: RoutingVaultReader,
  catalogOnly: () => boolean,
  incompatible: (url: string, host: string) => boolean,
): RouteCandidate[] {
  const catalog = catalogCandidates(context.kind).filter(
    (candidate) =>
      !vault.isInvalid(context.representation, candidate.host) &&
      !incompatible(root, candidate.host),
  )
  return catalogOnly()
    ? catalog
    : [...catalog, ...routes.native, ...(routes.root ? [routes.root] : [])]
}

export function challengerCandidates(
  kind: MediaKind,
  native: VaultCandidates['native'],
  preferNative: boolean,
  catalogCursor: number,
) {
  const catalog = catalogCandidates(kind)
  const rotated = [
    ...catalog.slice(catalogCursor % catalog.length),
    ...catalog.slice(0, catalogCursor % catalog.length),
  ]
  return preferNative ? [...native, ...rotated] : [...rotated, ...native]
}
