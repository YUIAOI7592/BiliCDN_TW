import { createMediaUrlPolicy } from './url-policy.mjs';
// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createMediaPolicy(deps) {
const SettingsBarTitle = (() => {
    const lang = ((navigator.languages || [navigator.language || 'en'])[0]).substring(0, 2)
    return ({ zh: '攔截修改影片 CDN', ja: 'CDNスイッチャー' })[lang] || 'CDN Switcher (TW)'
})()

const mediaUrlPolicy = createMediaUrlPolicy()

const MEDIA_URL_MAX_LENGTH = mediaUrlPolicy.maxLength

const PCDN_SOURCE_SUFFIXES = mediaUrlPolicy.suffixes

const PCDN_SOURCE_HOSTS = mediaUrlPolicy.hosts

const hostHasSuffix = mediaUrlPolicy.hostHasSuffix

const parseMediaHttpUrl = mediaUrlPolicy.parse

const classifyMediaDelivery = mediaUrlPolicy.classify

const isMediaDeliveryPath = mediaUrlPolicy.isMediaPath

const isAkamaiUrl = (url) => {
    const u = parseMediaHttpUrl(url)
    return !!(u && u.hostname.endsWith('.akamaized.net'))
}

const isBiliVideoUrl = (url) => {
    const u = parseMediaHttpUrl(url)
    if (!u) return false
    const h = u.hostname.toLowerCase()
    return h.endsWith('.bilivideo.com') || h.endsWith('.bilivideo.cn') || h.endsWith('.bilivideo.net')
        || PCDN_SOURCE_SUFFIXES.some(suffix => hostHasSuffix(h, suffix)) || PCDN_SOURCE_HOSTS.has(h)
}

const getBiliVideoCdn = (url) => {
    const u = parseMediaHttpUrl(url)
    if (!u) return null
    const h = u.hostname.toLowerCase()
    return (h.endsWith('.bilivideo.com') || h.endsWith('.bilivideo.cn') || h.endsWith('.bilivideo.net')) ? h : null
}

const isHttpDnsUrl = (url) => {
    try { return new URL(url).hostname === 'httpdns.bilivideo.com' } catch { return false }
}

const isBiliJsonMetadataApi = (url) => {
    try {
        const u = new URL(url, location.href)
        if (u.hostname !== 'api.bilibili.com') return false
        // 注意：/x/v2/dm/web/view 官方回傳 Protobuf 二進位（高能進度條開關等資訊即在此包內），
        // 強制改寫 Accept 為 JSON 會讓格式與播放器的 arraybuffer 解析不一致，
        // 造成該包解析失敗 → 高能進度條消失（但不影響 playurl 走的影片播放本身）。
        // 只有 subtitle/web/view 本身就是 JSON，才需要這個 header 修正。
        return u.pathname === '/x/v2/subtitle/web/view'
    } catch {
        return false
    }
}

let pageDiscoveredCdn = null

const discoverCdnFromPage = () => {
    try {
        const html = (document.head && document.head.innerHTML) || ''
        const m = html.match(/up[\w-]+\.bilivideo\.com/)
        if (!m || !m[0]) return
        if (deps.matchesExclude(m[0]) || deps.knownDeadHosts.has(m[0]) || deps.blacklistSet.has(m[0]) || deps.isCdnSoftBlocked(m[0])) return
        pageDiscoveredCdn = m[0]
        if (deps.isValidCustomCdnHost(m[0])) deps.preconnectCdn(m[0])
    } catch {}
}

const noteDiscoveredCdn = (host) => {
    if (!host || !host.endsWith('.bilivideo.com')) return
    if (deps.matchesExclude(host) || deps.knownDeadHosts.has(host) || deps.blacklistSet.has(host) || deps.isCdnSoftBlocked(host)) return
    if (isUnstableCdnHost(host)) return
    pageDiscoveredCdn = host
    if (deps.isValidCustomCdnHost(host)) deps.preconnectCdn(host)
}

const isUnstableCdnHost = (host) => {
    if (!host) return false
    const normalized = String(host).toLowerCase()
    if (/\.mcdn\.bilivideo\.(cn|com|net)$/i.test(normalized)) return true
    if (PCDN_SOURCE_SUFFIXES.some(suffix => hostHasSuffix(normalized, suffix))) return true
    if (PCDN_SOURCE_HOSTS.has(normalized)) return true
    const firstLabel = normalized.split('.')[0]
    if (firstLabel.startsWith('upos-') && firstLabel.includes('302')) return true
    // BCache（B 站自建機房）：地區代碼長度不固定，實際看過 cn-tj-cu-01（2 碼）、
    // cn-hbwh-cm-01-11（4 碼）、cn-jxnc-cmcc-bcache-06（4 碼）等寫法。
    // 舊的 [a-z]{2} 只吃得下兩碼，四碼的一律漏判 —— 漏判不會讓它逃過改寫
    // （這些 host 不在白名單，needsRedirect 照樣成立），但會讓 isMediaSegmentUrl、
    // seek 期間的 mustFix、以及 Watchdog 挑「元兇」時的排除條件全部對它失效。
    if (/^cn-[a-z]{2,8}-/i.test(host) && host.endsWith('.bilivideo.com')) return true
    return false
}

const getFallbackCdnHost = () => {
    const discovered = pageDiscoveredCdn
        && deps.isValidCustomCdnHost(pageDiscoveredCdn)
        && !deps.matchesExclude(pageDiscoveredCdn)
        && !deps.knownDeadHosts.has(pageDiscoveredCdn)
        && !deps.blacklistSet.has(pageDiscoveredCdn)
        && !deps.isCdnSoftBlocked(pageDiscoveredCdn)
        && !isUnstableCdnHost(pageDiscoveredCdn)
        ? pageDiscoveredCdn
        : null
    return deps.resolvedCdn || discovered || deps.getCurrentCdn() || deps.activeCdnList[0] || deps.PREFERRED_CDN_LIST[0] || null
}

const PCDN_RESOURCE_PATH = /^\/v1\/resource/

const isPcdnResourceUrl = (urlStr) => {
    if (!urlStr || urlStr.indexOf('/v1/resource') === -1) return false
    const u = parseMediaHttpUrl(urlStr)
    return !!(u && PCDN_RESOURCE_PATH.test(u.pathname))
}

const isLiveBvcUrl = (urlStr) => {
    if (!urlStr || urlStr.indexOf('/live-bvc/') === -1) return false
    const u = parseMediaHttpUrl(urlStr)
    return !!(u && u.pathname.includes('/live-bvc/'))
}

const rewriteUnstableMediaUrl = (urlStr) => {
    if (!urlStr) return null
    try {
        const u = parseMediaHttpUrl(urlStr)
        if (!u || deps.decideMediaRewrite(urlStr).action !== 'rewrite') return null
        const delivery = classifyMediaDelivery(urlStr)
        if (delivery.kind === 'suspected-pcdn') {
            deps.redirectStats.pcdnSuspectedPort = Math.min(10000, (deps.redirectStats.pcdnSuspectedPort || 0) + 1)
            return null
        }
        if (delivery.kind === 'live') return null
        if (delivery.kind !== 'pcdn' && !isUnstableCdnHost(u.hostname)) return null
        if (delivery.kind === 'pcdn') deps.redirectStats.pcdnExplicit = Math.min(10000, (deps.redirectStats.pcdnExplicit || 0) + 1)

        // ★ v1.3.3：PCDN 特化路徑不可改寫（見上方說明），放行並計數供診斷觀察
        if (PCDN_RESOURCE_PATH.test(u.pathname)) {
            deps.redirectStats.pcdnSkipped++
            return null
        }

        let targetHost = getFallbackCdnHost()

        if (u.hostname.endsWith('.szbdyd.com')) {
            const usource = u.searchParams.get('xy_usource')
            if (usource) {
                let h = usource.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0]
                if (deps.isValidCustomCdnHost(h) && !isUnstableCdnHost(h) && !deps.needsRedirect(h)) targetHost = h
            }
        }

        if (!deps.isValidCustomCdnHost(targetHost)) return null
        return deps.replaceUrlHost(urlStr, targetHost)
    } catch {
        return null
    }
}
return { /* TEST_EXPORTS:mediaPolicy */
get SettingsBarTitle() { return SettingsBarTitle; },
get mediaUrlPolicy() { return mediaUrlPolicy; },
get MEDIA_URL_MAX_LENGTH() { return MEDIA_URL_MAX_LENGTH; },
get PCDN_SOURCE_SUFFIXES() { return PCDN_SOURCE_SUFFIXES; },
get PCDN_SOURCE_HOSTS() { return PCDN_SOURCE_HOSTS; },
get parseMediaHttpUrl() { return parseMediaHttpUrl; },
get classifyMediaDelivery() { return classifyMediaDelivery; },
get isAkamaiUrl() { return isAkamaiUrl; },
get isBiliVideoUrl() { return isBiliVideoUrl; },
get getBiliVideoCdn() { return getBiliVideoCdn; },
get isHttpDnsUrl() { return isHttpDnsUrl; },
get isBiliJsonMetadataApi() { return isBiliJsonMetadataApi; },
get pageDiscoveredCdn() { return pageDiscoveredCdn; }, set pageDiscoveredCdn(value) { pageDiscoveredCdn = value; },
get discoverCdnFromPage() { return discoverCdnFromPage; },
get noteDiscoveredCdn() { return noteDiscoveredCdn; },
get isUnstableCdnHost() { return isUnstableCdnHost; },
get rewriteUnstableMediaUrl() { return rewriteUnstableMediaUrl; }
};
}
