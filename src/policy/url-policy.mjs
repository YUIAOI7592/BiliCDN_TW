export function createMediaUrlPolicy() {
const MEDIA_URL_MAX_LENGTH = 16 * 1024
const PCDN_SOURCE_SUFFIXES = Object.freeze([
    'szbdyd.com',
    'mountaintoys.cn',
    'nexusedgeio.com',
    'ahdohpiechei.com',
])
const PCDN_SOURCE_HOSTS = Object.freeze(new Set([
    'upos-sz-mirror14b.bilivideo.com',
]))
const IPV4_HOST_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/
const MEDIA_PATH_RE = /\.(?:m4s|mp4|flv|m3u8)$/i
const hostHasSuffix = (host, suffix) => host === suffix || host.endsWith('.' + suffix)
const parseMediaHttpUrl = (value) => {
    if (typeof value !== 'string' || !value || value.length > MEDIA_URL_MAX_LENGTH) return null
    try {
        const u = new URL(value.startsWith('//') ? 'https:' + value : value)
        return (u.protocol === 'http:' || u.protocol === 'https:') ? u : null
    } catch { return null }
}
const isMediaDeliveryPath = (path) => !!path && (MEDIA_PATH_RE.test(path)
    || path.includes('/upgcxcode/') || path.startsWith('/v1/resource') || path.includes('/live-bvc/'))

// PCDN/MCDN 只是一種「不可信來源」分類，永遠不會擴充可改寫目的地 catalog。
// 單獨的非標準 port 只列入診斷；沒有其他明確訊號時不主動改寫。
const classifyMediaDelivery = (value) => {
    const u = parseMediaHttpUrl(value)
    if (!u || !isMediaDeliveryPath(u.pathname)) return Object.freeze({ kind: 'unknown', reason: 'invalid-or-non-media', host: '' })
    const host = u.hostname.toLowerCase()
    if (u.pathname.includes('/live-bvc/')) return Object.freeze({ kind: 'live', reason: 'live-bvc', host })
    const firstLabel = host.split('.')[0]
    const mcdn = /\.mcdn\.bilivideo\.(?:cn|com|net)$/i.test(host)
    const knownSuffix = PCDN_SOURCE_SUFFIXES.some(suffix => hostHasSuffix(host, suffix))
    const knownHost = PCDN_SOURCE_HOSTS.has(host)
    const redirectHost = firstLabel.startsWith('upos-') && firstLabel.includes('302')
    const querySignal = String(u.searchParams.get('os') || '').toLowerCase() === 'mcdn'
    const nonDefaultPort = !!u.port && u.port !== '80' && u.port !== '443'
    const ipPort = IPV4_HOST_RE.test(host) && nonDefaultPort
    if (mcdn || knownSuffix || knownHost || redirectHost || querySignal || ipPort) {
        const reason = mcdn ? 'mcdn-host' : knownSuffix ? 'known-pcdn-suffix'
            : knownHost ? 'known-pcdn-host' : redirectHost ? 'upos-302'
                : querySignal ? 'os-mcdn' : 'ip-port'
        return Object.freeze({ kind: 'pcdn', reason, host })
    }
    if (nonDefaultPort) return Object.freeze({ kind: 'suspected-pcdn', reason: 'non-default-port', host })
    return Object.freeze({ kind: 'normal', reason: 'normal', host })
}

const decide = (value) => {
    const parsed = parseMediaHttpUrl(value)
    const delivery = classifyMediaDelivery(value)
    if (!parsed || delivery.kind === 'unknown') return { action: 'pass', reason: 'invalid-or-non-media', delivery }
    if (parsed.pathname.startsWith('/v1/resource')) return { action: 'pass', reason: 'resource', delivery }
    if (delivery.kind === 'live' || delivery.kind === 'suspected-pcdn') return { action: 'pass', reason: delivery.kind, delivery }
    const host = parsed.hostname
    const sourceAllowed = delivery.kind === 'pcdn' || /\.bilivideo\.(?:com|cn|net)$/i.test(host) || host.endsWith('.akamaized.net')
    return { action: sourceAllowed ? 'rewrite' : 'pass', reason: sourceAllowed ? 'media' : 'unknown-source', delivery }
}
return { parse: parseMediaHttpUrl, classify: classifyMediaDelivery, decide, isMediaPath: isMediaDeliveryPath,
    suffixes: PCDN_SOURCE_SUFFIXES, hosts: PCDN_SOURCE_HOSTS, hostHasSuffix, maxLength: MEDIA_URL_MAX_LENGTH, mediaPathPattern: MEDIA_PATH_RE }
}
