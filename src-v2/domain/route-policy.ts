import { DEFAULT_UNAVAILABLE_HOSTS, TRUSTED_CATALOG } from './catalog.ts'
import { type CatalogCandidate } from './route-model.ts'
import { type MediaKind } from './model.ts'
export interface RestrictionFacts {
  readonly black: boolean
  readonly dead: boolean
  readonly catalogDisabled: boolean
  readonly defaultUnavailable: boolean
  readonly hostLocked?: boolean
  readonly circuitOpen: boolean
}

export const orderedRestrictions = (facts: RestrictionFacts) =>
  Object.freeze([
    ...(facts.black ? ['black' as const] : []),
    ...(facts.dead ? ['dead' as const] : []),
    ...(facts.catalogDisabled ? ['catalog-disabled' as const] : []),
    ...(facts.defaultUnavailable ? ['default-unavailable' as const] : []),
    ...(facts.hostLocked ? ['host-lock' as const] : []),
    ...(facts.circuitOpen ? ['circuit-open' as const] : []),
  ])

export type HardRestriction =
  'black' | 'dead' | 'catalog-disabled' | 'default-unavailable' | 'circuit-open'
export interface CatalogRestrictions {
  readonly disabledCatalogHosts: ReadonlySet<string>
  readonly defaultUnavailableHosts: ReadonlySet<string>
}
export const catalogRestrictions = (
  overrides: Readonly<Record<string, boolean>>,
): CatalogRestrictions => ({
  disabledCatalogHosts: new Set(TRUSTED_CATALOG.filter((host) => overrides[host] === false)),
  defaultUnavailableHosts: new Set(
    TRUSTED_CATALOG.filter(
      (host) => DEFAULT_UNAVAILABLE_HOSTS.has(host) && overrides[host] !== true,
    ),
  ),
})
export const catalogCandidates = (
  kind: MediaKind,
  excluded: ReadonlySet<string> = new Set(),
): CatalogCandidate[] =>
  TRUSTED_CATALOG.map((host) => ({
    type: 'catalog-generated' as const,
    host,
    kind,
  })).filter((candidate) => !excluded.has(candidate.host))

export function hardRestriction(
  host: string,
  input: {
    readonly blackHosts: ReadonlySet<string>
    readonly deadHosts: ReadonlySet<string>
    readonly overrides: Readonly<Record<string, boolean>>
    readonly circuitUntil: number
  },
  now: number,
): HardRestriction | null {
  return (
    (orderedRestrictions({
      black: input.blackHosts.has(host),
      dead: input.deadHosts.has(host),
      catalogDisabled: input.overrides[host] === false,
      defaultUnavailable: DEFAULT_UNAVAILABLE_HOSTS.has(host) && input.overrides[host] !== true,
      circuitOpen: input.circuitUntil > now,
    })[0] as HardRestriction | undefined) ?? null
  )
}
