import type { PlayurlEndpointKind } from './playurl-model.ts'

export const HK_TEST_CANDIDATES = Object.freeze([
  'cn-hk-eq-01-03.bilivideo.com',
  'cn-hk-eq-01-05.bilivideo.com',
  'cn-hk-eq-01-01.bilivideo.com',
] as const)
export const isHkTestCandidate = (host: string): boolean =>
  (HK_TEST_CANDIDATES as readonly string[]).includes(host)

export const TRUSTED_CATALOG = Object.freeze([
  'upos-sz-mirroraliov.bilivideo.com',
  'upos-sz-mirrorcosov.bilivideo.com',
  'upos-sz-mirrorali.bilivideo.com',
  'upos-sz-mirroralib.bilivideo.com',
  'upos-sz-mirrorali02.bilivideo.com',
  'upos-sz-mirrorbos.bilivideo.com',
  'upos-tf-all-tx.bilivideo.com',
  'upos-sz-mirrorcos.bilivideo.com',
  'upos-sz-mirrorhwov.bilivideo.com',
  'upos-sz-mirrorhw.bilivideo.com',
  'upos-hz-mirroraliov.bilivideo.com',
  ...HK_TEST_CANDIDATES,
] as const)

export type CatalogHost = (typeof TRUSTED_CATALOG)[number]
export const TRUSTED_CATALOG_SET: ReadonlySet<string> = new Set(TRUSTED_CATALOG)

export const DEFAULT_UNAVAILABLE_HOSTS: ReadonlySet<string> = new Set([
  'upos-sz-mirrorcosov.bilivideo.com',
  'upos-sz-mirrorhwov.bilivideo.com',
  'upos-sz-mirrorhw.bilivideo.com',
  'upos-hz-mirroraliov.bilivideo.com',
])

export const isCatalogHost = (host: string): host is CatalogHost =>
  TRUSTED_CATALOG_SET.has(host.toLowerCase())

export const catalogIndex = (host: string): number => {
  const index = TRUSTED_CATALOG.indexOf(host.toLowerCase() as CatalogHost)
  return index < 0 ? Number.MAX_SAFE_INTEGER : index
}

export const PLAYURL_PATH = /\/player\/.*playurl/i
export const classifyPlayurlApi = (value: string, baseUrl?: string): PlayurlEndpointKind | null => {
  try {
    const url = new URL(value, baseUrl)
    if (url.hostname !== 'api.bilibili.com') return null
    // Preserve admission for the existing endpoints. New OGV endpoints have
    // exact paths and a narrower transport boundary.
    if (PLAYURL_PATH.test(url.pathname)) return 'playurl'
    if (url.protocol !== 'https:' || url.port || url.username || url.password) return null
    if (url.pathname === '/ogv/player/playview') return 'ogv-playview'
    if (url.pathname === '/ogv/player/pre/check/drm') return 'ogv-precheck'
    return null
  } catch {
    return null
  }
}
export const isPlayurlApi = (value: string, baseUrl?: string): boolean => {
  const endpoint = classifyPlayurlApi(value, baseUrl)
  return endpoint !== null && endpoint !== 'ogv-precheck'
}
