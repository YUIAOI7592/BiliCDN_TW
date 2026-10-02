import { TRUSTED_CATALOG, isCatalogHost } from './catalog.ts'

/** Plans opaque input indexes; signed URLs never enter this policy module. */
export interface OutputCandidate { readonly index: number; readonly host: string; readonly allowed: boolean }
export function originalOutputPlan(candidates: readonly OutputCandidate[]) {
  const allowed = candidates.filter(candidate => candidate.allowed)
  return { primary: allowed[0]?.index ?? null, backups: allowed.slice(1, 6).map(candidate => candidate.index) }
}
export function backupOutputPlan(primaryHost: string | null, candidates: readonly OutputCandidate[], locked: boolean): readonly number[] {
  if (locked) return []
  const used = new Set(primaryHost ? [primaryHost] : []), distinct: number[] = [], same: number[] = []
  for (const candidate of candidates) {
    if (!candidate.allowed || !candidate.host) continue
    if (used.has(candidate.host)) same.push(candidate.index)
    else { used.add(candidate.host); distinct.push(candidate.index) }
  }
  return [...distinct, ...same].slice(0, 5)
}
export function catalogOutputPlan(primaryHost: string, preferred: readonly string[], unavailable: ReadonlySet<string>): readonly string[] {
  return [...new Set([...preferred, ...TRUSTED_CATALOG])]
    .filter(host => isCatalogHost(host) && host !== primaryHost && !unavailable.has(host)).slice(0, 5)
}
