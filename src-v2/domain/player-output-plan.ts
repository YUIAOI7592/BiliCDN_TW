import { TRUSTED_CATALOG, isCatalogHost } from './catalog.ts'

/** Plans opaque input indexes; signed URLs never enter this policy module. */
export interface OutputCandidate {
  readonly index: number
  readonly host: string
  readonly allowed: boolean
  readonly meetsHeadroom?: boolean
}

export type CatalogFamily = 'ali' | 'cos' | 'hw' | 'bos' | 'tx'

// Naming/provider families are a conservative preference, not proof of separate data centers.
const CATALOG_FAMILIES: Readonly<Record<string, CatalogFamily>> = Object.freeze({
  'upos-sz-mirroraliov.bilivideo.com': 'ali',
  'upos-sz-mirrorali.bilivideo.com': 'ali',
  'upos-sz-mirroralib.bilivideo.com': 'ali',
  'upos-sz-mirrorali02.bilivideo.com': 'ali',
  'upos-hz-mirroraliov.bilivideo.com': 'ali',
  'upos-sz-mirrorcosov.bilivideo.com': 'cos',
  'upos-sz-mirrorcos.bilivideo.com': 'cos',
  'upos-sz-mirrorhwov.bilivideo.com': 'hw',
  'upos-sz-mirrorhw.bilivideo.com': 'hw',
  'upos-sz-mirrorbos.bilivideo.com': 'bos',
  'upos-tf-all-tx.bilivideo.com': 'tx',
})

export function catalogHostFamily(host: string): CatalogFamily | null {
  const normalized = host.toLowerCase()
  return isCatalogHost(normalized) && Object.hasOwn(CATALOG_FAMILIES, normalized)
    ? CATALOG_FAMILIES[normalized]!
    : null
}

function measuredBackupOrder<T extends { readonly host: string; readonly meetsHeadroom?: boolean }>(
  primaryHost: string | null,
  candidates: readonly T[],
): readonly T[] {
  const sufficient = candidates.filter((candidate) => candidate.meetsHeadroom === true)
  const used = new Set<CatalogFamily>()
  const primaryFamily = primaryHost ? catalogHostFamily(primaryHost) : null
  if (primaryFamily) used.add(primaryFamily)
  const selected: T[] = []
  while (sufficient.length) {
    const diverse = sufficient.findIndex((candidate) => {
      const family = catalogHostFamily(candidate.host)
      return family !== null && !used.has(family)
    })
    const candidate = sufficient.splice(diverse < 0 ? 0 : diverse, 1)[0]!
    selected.push(candidate)
    const family = catalogHostFamily(candidate.host)
    if (family) used.add(family)
  }
  return [...selected, ...candidates.filter((candidate) => candidate.meetsHeadroom !== true)]
}
export function originalOutputPlan(candidates: readonly OutputCandidate[]) {
  const allowed = candidates.filter((candidate) => candidate.allowed)
  return {
    primary: allowed[0]?.index ?? null,
    backups: allowed.slice(1, 6).map((candidate) => candidate.index),
  }
}
export function backupOutputPlan(
  primaryHost: string | null,
  candidates: readonly OutputCandidate[],
  locked: boolean,
): readonly number[] {
  if (locked) return []
  const used = new Set(primaryHost ? [primaryHost] : []),
    distinct: OutputCandidate[] = [],
    same: number[] = []
  for (const candidate of candidates) {
    if (!candidate.allowed || !candidate.host) continue
    if (used.has(candidate.host)) same.push(candidate.index)
    else {
      used.add(candidate.host)
      distinct.push(candidate)
    }
  }
  return [
    ...measuredBackupOrder(primaryHost, distinct).map((candidate) => candidate.index),
    ...same,
  ].slice(0, 5)
}
export function catalogOutputPlan(
  primaryHost: string,
  preferred: readonly string[],
  unavailable: ReadonlySet<string>,
  measuredSufficient: ReadonlySet<string> = new Set(),
): readonly string[] {
  const candidates = [...new Set([...preferred, ...TRUSTED_CATALOG])]
    .filter((host) => isCatalogHost(host) && host !== primaryHost && !unavailable.has(host))
    .map((host) => ({ host, meetsHeadroom: measuredSufficient.has(host) }))
  return measuredBackupOrder(primaryHost, candidates)
    .map((candidate) => candidate.host)
    .slice(0, 5)
}
