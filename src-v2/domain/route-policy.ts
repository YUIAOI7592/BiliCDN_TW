import { DEFAULT_UNAVAILABLE_HOSTS, TRUSTED_CATALOG } from './catalog.ts'
import type { CatalogCandidate, MediaKind } from './model.ts'

export type HardRestriction = 'black' | 'dead' | 'catalog-disabled' | 'default-unavailable' | 'circuit-open'
export interface CatalogRestrictions {
  readonly disabledCatalogHosts: ReadonlySet<string>
  readonly defaultUnavailableHosts: ReadonlySet<string>
}
export const catalogRestrictions = (overrides: Readonly<Record<string, boolean>>): CatalogRestrictions => ({
  disabledCatalogHosts: new Set(TRUSTED_CATALOG.filter(host => overrides[host] === false)),
  defaultUnavailableHosts: new Set(TRUSTED_CATALOG.filter(host => DEFAULT_UNAVAILABLE_HOSTS.has(host) && overrides[host] !== true)),
})
export const catalogCandidates = (kind: MediaKind, excluded: ReadonlySet<string> = new Set()): CatalogCandidate[] =>
  TRUSTED_CATALOG.map((host, catalogIndex) => ({ type: 'catalog-generated' as const, host, kind, catalogIndex }))
    .filter(candidate => !excluded.has(candidate.host))

export function hardRestriction(host: string, input: {
  readonly blackHosts: ReadonlySet<string>; readonly deadHosts: ReadonlySet<string>
  readonly overrides: Readonly<Record<string, boolean>>; readonly circuitUntil: number
}, now: number): HardRestriction | null {
  if (input.blackHosts.has(host)) return 'black'
  if (input.deadHosts.has(host)) return 'dead'
  if (input.overrides[host] === false) return 'catalog-disabled'
  if (DEFAULT_UNAVAILABLE_HOSTS.has(host) && input.overrides[host] !== true) return 'default-unavailable'
  return input.circuitUntil > now ? 'circuit-open' : null
}
