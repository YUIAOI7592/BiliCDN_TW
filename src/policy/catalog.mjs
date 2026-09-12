// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createCatalog(deps) {
const INITIAL_DEAD_HOSTS_TW = [
    'upos-sz-mirrorhwov.bilivideo.com',   // 台灣 DNS 普遍屏蔽
    'upos-sz-mirrorhw.bilivideo.com',     // 台灣 IP 區域拒絕 (HTTP 959)
    'upos-hz-mirroraliov.bilivideo.com',  // 杭州內網域名，台灣 DNS 不解析
]

const PLAYURL_PREFIXES = [
    'https://api.bilibili.com/x/player/wbi/playurl',
    'https://api.bilibili.com/pgc/player/web/v2/playurl',
    'https://api.bilibili.com/x/player/playurl',
    'https://api.bilibili.com/pgc/player/web/playurl',
    'https://api.bilibili.com/pugv/player/web/playurl',
    'https://api.bilibili.com/pugv/player/web/v2/playurl',
    'https://api.bilibili.com/x/player/ugc/playurl',
    'https://api.bilibili.com/x/player/wbi/ugc/playurl',
    'https://api.bilibili.com/x/player/season/playurl',
    'https://api.bilibili.com/x/player/wbi/season/playurl',
]

const isPlayUrlApi = (url) => {
    if (!url) return false
    if (PLAYURL_PREFIXES.some(p => url.startsWith(p))) return true
    try {
        const u = new URL(url)
        return u.hostname === 'api.bilibili.com'
            && /\/player\/.*playurl/.test(u.pathname)
    } catch {
        return false
    }
}

const PREFERRED_CDN_LIST_RAW = [
    // 海外（ov）：對台灣線路最短，兩次獨立量測都最快
    'upos-sz-mirroraliov.bilivideo.com',
    // cosov 留在 RAW 清單但被 ExcludeHostKeywords 預設排除（見上方說明）。
    // 保留在這裡是為了讓使用者可由可信 Tampermonkey 選單明確啟用，不必改原始碼。
    'upos-sz-mirrorcosov.bilivideo.com',
    // 境內鏡像：實測都能服務簽名路徑，快慢因人而異，交給本機資料排序
    'upos-sz-mirrorali.bilivideo.com',
    'upos-sz-mirroralib.bilivideo.com',
    'upos-sz-mirrorali02.bilivideo.com',
    'upos-sz-mirrorbos.bilivideo.com',
    'upos-tf-all-tx.bilivideo.com',
    'upos-sz-mirrorcos.bilivideo.com',
    // 以下三個在台灣已知不可用（INITIAL_DEAD_HOSTS_TW），留在清單裡是為了讓
    // 「本機實測成功過一次就自動解除推定」這條路仍然成立（換電信商/VPN 可能可用）
    'upos-sz-mirrorhwov.bilivideo.com',
    'upos-sz-mirrorhw.bilivideo.com',
    'upos-hz-mirroraliov.bilivideo.com',
]

const TRUSTED_CDN_CATALOG = Object.freeze([...PREFERRED_CDN_LIST_RAW])

const TRUSTED_CDN_CATALOG_SET = new Set(TRUSTED_CDN_CATALOG)

const CATALOG_OVERRIDES_KEY = 'catalogOverrides_v1'

const matchesHeaderExclude = (host) => {
    if (!host) return false
    return deps.ExcludeHostKeywords.some(kw => kw && host.indexOf(kw) !== -1)
}

const catalogOverrides = (() => {
    let raw = GM_getValue(CATALOG_OVERRIDES_KEY, null)
    let parsed = raw
    let dirty = false
    if (typeof raw === 'string') {
        dirty = true
        try { parsed = JSON.parse(raw) } catch { parsed = null; dirty = true }
    }
    const out = Object.create(null)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        Object.entries(parsed).forEach(([host, enabled]) => {
            if (TRUSTED_CDN_CATALOG_SET.has(host) && typeof enabled === 'boolean') out[host] = enabled
            else dirty = true
        })
    } else if (raw != null) {
        dirty = true
    }
    // Even an exhausted persisted selection must not silently re-enable hosts.
    try {
        if (dirty) {
            if (Object.keys(out).length) GM_setValue(CATALOG_OVERRIDES_KEY, { ...out })
            else GM_deleteValue(CATALOG_OVERRIDES_KEY)
        }
    } catch {}
    return out
})()

const isCatalogAutoEnabled = host => {
    if (!TRUSTED_CDN_CATALOG_SET.has(host)) return false
    if (Object.prototype.hasOwnProperty.call(catalogOverrides, host)) return catalogOverrides[host]
    if (INITIAL_DEAD_HOSTS_TW.includes(host)) return false
    return !matchesHeaderExclude(host)
}

const matchesExclude = host => TRUSTED_CDN_CATALOG_SET.has(host)
    ? !isCatalogAutoEnabled(host)
    : matchesHeaderExclude(host)

const isValidCustomCdnHost = (host) => {
    if (!host || typeof host !== 'string') return false
    return TRUSTED_CDN_CATALOG_SET.has(host.trim().toLowerCase())
}

const PREFERRED_CDN_LIST = []

const rebuildPreferredCdnList = () => {
    const next = PREFERRED_CDN_LIST_RAW.filter(isCatalogAutoEnabled)
    PREFERRED_CDN_LIST.splice(0, PREFERRED_CDN_LIST.length, ...next)
}

rebuildPreferredCdnList()
return { /* TEST_EXPORTS:catalog */
get INITIAL_DEAD_HOSTS_TW() { return INITIAL_DEAD_HOSTS_TW; },
get isPlayUrlApi() { return isPlayUrlApi; },
get TRUSTED_CDN_CATALOG() { return TRUSTED_CDN_CATALOG; },
get TRUSTED_CDN_CATALOG_SET() { return TRUSTED_CDN_CATALOG_SET; },
get CATALOG_OVERRIDES_KEY() { return CATALOG_OVERRIDES_KEY; },
get matchesHeaderExclude() { return matchesHeaderExclude; },
get catalogOverrides() { return catalogOverrides; },
get isCatalogAutoEnabled() { return isCatalogAutoEnabled; },
get matchesExclude() { return matchesExclude; },
get isValidCustomCdnHost() { return isValidCustomCdnHost; },
get PREFERRED_CDN_LIST() { return PREFERRED_CDN_LIST; },
get rebuildPreferredCdnList() { return rebuildPreferredCdnList; }
};
}
