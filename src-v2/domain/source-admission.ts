import { TRUSTED_CATALOG } from './catalog.ts'
import { isKnownNativeFamily, parseMediaUrl, replaceUrlHost } from './url-policy.ts'
export const MAX_EXACT_SOURCES = 4
export const TRUSTED_SOURCE_SCAN = 16
export const PROVISIONAL_SOURCE_SCAN = 4

export interface AdmittedSource {
  readonly url: string
  readonly host: string
  readonly rawIndex: number
  readonly selectable: boolean
  readonly activelyExplorable: boolean
}

/** Bounded input selection only; the Vault alone creates exact-route authority. */
export function admitSources(urls: readonly string[], trusted: boolean): readonly AdmittedSource[] {
  const candidates: AdmittedSource[] = []
  const seen = new Set<string>()
  const limit = trusted ? TRUSTED_SOURCE_SCAN : PROVISIONAL_SOURCE_SCAN
  for (let rawIndex = 0; rawIndex < Math.min(limit, urls.length); rawIndex++) {
    const raw = urls[rawIndex]
    if (typeof raw !== 'string') continue
    const parsed = parseMediaUrl(raw)
    if (!parsed) continue
    const opaque = parsed.kind === 'unknown' && parsed.url.protocol === 'https:' && !parsed.url.port
    const generated = parsed.kind === 'pcdn' ? replaceUrlHost(raw, TRUSTED_CATALOG[0]) : null
    const pcdnSource = generated !== null && parseMediaUrl(generated)?.kind === 'normal'
    if (parsed.kind !== 'normal' && !opaque && !pcdnSource) continue
    const url = parsed.url.href
    if (seen.has(url)) continue
    seen.add(url)
    candidates.push(
      Object.freeze({
        url,
        host: parsed.host,
        rawIndex,
        selectable: !opaque && !pcdnSource,
        activelyExplorable: !opaque && !pcdnSource && isKnownNativeFamily(parsed.host),
      }),
    )
  }
  const selected: AdmittedSource[] = []
  const primary = candidates.find((row) => row.rawIndex === 0)
  if (primary) selected.push(primary)
  for (const selectable of [true, false]) {
    const remaining = candidates.filter((row) => row !== primary && row.selectable === selectable)
    for (const row of remaining)
      if (selected.length < MAX_EXACT_SOURCES && !selected.some((prior) => prior.host === row.host))
        selected.push(row)
    for (const row of remaining)
      if (selected.length < MAX_EXACT_SOURCES && !selected.includes(row)) selected.push(row)
  }
  return Object.freeze(selected)
}
