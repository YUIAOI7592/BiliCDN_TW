export const MEDIA_URL_MAX_LENGTH = 16 * 1024
const MEDIA_PATH_RE = /\.(?:m4s|mp4|flv|m3u8)$/i
const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/
const PCDN_SUFFIXES = ['szbdyd.com', 'mountaintoys.cn', 'nexusedgeio.com', 'ahdohpiechei.com'] as const
const PCDN_HOSTS: ReadonlySet<string> = new Set(['upos-sz-mirror14b.bilivideo.com'])

export type DeliveryKind = 'normal' | 'pcdn' | 'suspected-pcdn' | 'live' | 'resource' | 'unknown'

export interface ParsedMediaUrl {
  readonly url: URL
  readonly host: string
  readonly kind: DeliveryKind
  readonly replaceable: boolean
}

const hasSuffix = (host: string, suffix: string): boolean => host === suffix || host.endsWith(`.${suffix}`)
export const isKnownNativeFamily = (host: string): boolean =>
  /\.bilivideo\.(?:com|cn|net)$/i.test(host) || host.endsWith('.akamaized.net')

export const parseMediaUrl = (value: string): ParsedMediaUrl | null => {
  if (!value || value.length > MEDIA_URL_MAX_LENGTH) return null
  let url: URL
  try { url = new URL(value.startsWith('//') ? `https:${value}` : value) } catch { return null }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const host = url.hostname.toLowerCase()
  const mediaPath = MEDIA_PATH_RE.test(url.pathname) || url.pathname.includes('/upgcxcode/')
    || url.pathname.startsWith('/v1/resource') || url.pathname.includes('/live-bvc/')
  if (!mediaPath) return { url, host, kind: 'unknown', replaceable: false }
  if (url.pathname.includes('/live-bvc/')) return { url, host, kind: 'live', replaceable: false }
  if (url.pathname.startsWith('/v1/resource')) return { url, host, kind: 'resource', replaceable: false }
  const label = host.split('.')[0] ?? ''
  const nonDefaultPort = !!url.port && url.port !== '80' && url.port !== '443'
  const pcdn = /\.mcdn\.bilivideo\.(?:com|cn|net)$/i.test(host)
    || PCDN_SUFFIXES.some(suffix => hasSuffix(host, suffix))
    || PCDN_HOSTS.has(host)
    || (label.startsWith('upos-') && label.includes('302'))
    || String(url.searchParams.get('os') ?? '').toLowerCase() === 'mcdn'
    || (IPV4_RE.test(host) && nonDefaultPort)
  if (pcdn) return { url, host, kind: 'pcdn', replaceable: true }
  if (nonDefaultPort || IPV4_RE.test(host)) return { url, host, kind: 'suspected-pcdn', replaceable: false }
  return { url, host, kind: 'normal', replaceable: isKnownNativeFamily(host) }
}

export const replaceUrlHost = (value: string, host: string): string | null => {
  const parsed = parseMediaUrl(value)
  if (!parsed || !parsed.replaceable) return null
  const next = new URL(parsed.url.href)
  next.hostname = host
  next.port = ''
  next.protocol = 'https:'
  return next.href
}

export const mediaIdentity = (value: string): string | null => {
  const parsed = parseMediaUrl(value)
  return parsed ? `${parsed.url.pathname}?${parsed.url.searchParams.toString()}` : null
}

export const isHttpDnsUrl = (value: string): boolean => {
  try { return new URL(value, location.href).hostname === 'httpdns.bilivideo.com' } catch { return false }
}
