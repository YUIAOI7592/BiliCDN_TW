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
] as const)

export type CatalogHost = (typeof TRUSTED_CATALOG)[number]
export const TRUSTED_CATALOG_SET: ReadonlySet<string> = new Set(TRUSTED_CATALOG)

export const DEFAULT_UNAVAILABLE_HOSTS: ReadonlySet<string> = new Set([
  'upos-sz-mirrorcosov.bilivideo.com',
  'upos-sz-mirrorhwov.bilivideo.com',
  'upos-sz-mirrorhw.bilivideo.com',
  'upos-hz-mirroraliov.bilivideo.com',
])

export const isCatalogHost = (host: string): host is CatalogHost => TRUSTED_CATALOG_SET.has(host.toLowerCase())

export const catalogIndex = (host: string): number => {
  const index = TRUSTED_CATALOG.indexOf(host.toLowerCase() as CatalogHost)
  return index < 0 ? Number.MAX_SAFE_INTEGER : index
}

export const PLAYURL_PATH = /\/player\/.*playurl/i
export const isPlayurlApi = (value: string): boolean => {
  try {
    const url = new URL(value, location.href)
    return url.hostname === 'api.bilibili.com' && PLAYURL_PATH.test(url.pathname)
  } catch {
    return false
  }
}
