// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createRewrite(deps) {
const normalizeMediaUrl = (urlStr) => {
    const decision = decideMediaRewrite(urlStr, true)
    if (decision.action !== 'rewrite') {
        if (decision.reason === 'live') deps.redirectStats.liveSkipped = Math.min(10000, deps.redirectStats.liveSkipped + 1)
        if (decision.reason === 'suspected-pcdn') deps.redirectStats.pcdnSuspectedPort = Math.min(10000, deps.redirectStats.pcdnSuspectedPort + 1)
        return { url: decision.url, changed: decision.action === 'restore', restoredOriginal: decision.action === 'restore',
            originCdn: deps.parseMediaHttpUrl(urlStr)?.hostname, targetCdn: deps.parseMediaHttpUrl(decision.url)?.hostname }
    }

    const delivery = deps.classifyMediaDelivery(urlStr)
    if (delivery.kind === 'live') {
        deps.redirectStats.liveSkipped = Math.min(10000, (deps.redirectStats.liveSkipped || 0) + 1)
        return { url: urlStr, changed: false, originCdn: delivery.host, liveSkipped: true }
    }

    const mappedOriginalUrl = getOriginalStreamUrl(urlStr)
    if (mappedOriginalUrl !== urlStr && isHostLockedStream(mappedOriginalUrl)) {
        const originCdn = (() => { try { return new URL(urlStr).hostname } catch { return null } })()
        const targetCdn = (() => { try { return new URL(mappedOriginalUrl).hostname } catch { return null } })()
        return {
            url: mappedOriginalUrl,
            changed: true,
            originCdn,
            targetCdn,
            restoredOriginal: true,
        }
    }

    const unstableUrl = deps.rewriteUnstableMediaUrl(urlStr)
    if (unstableUrl && unstableUrl !== urlStr) {
        deps.redirectStats.unstable++
        let originCdn = '?', targetCdn = '?'
        try {
            originCdn = new URL(urlStr).hostname
            targetCdn = new URL(unstableUrl).hostname
        } catch {}
        logRedirect('不穩定', originCdn, targetCdn, 'MCDN/PCDN')
        return { url: unstableUrl, changed: true, originCdn, targetCdn }
    }

    if (deps.isAkamaiUrl(urlStr)) {
        let originCdn = null
        try { originCdn = new URL(urlStr).hostname } catch {}
        if (!originCdn || !deps.isForcedRedirect(originCdn)) return { url: urlStr, changed: false, originCdn }
        const bestCdn = deps.getCurrentCdn()
        const newUrl = bestCdn ? replaceUrlHost(urlStr, bestCdn) : null
        if (!newUrl || newUrl === urlStr) return { url: urlStr, changed: false, originCdn }
        deps.redirectStats.whitelist++
        logRedirect('Transport', originCdn, bestCdn, 'Akamai 失敗後改寫')
        return { url: newUrl, changed: true, originCdn, targetCdn: bestCdn }
    }

    if (!deps.isBiliFragmentUrl(urlStr)) return { url: urlStr, changed: false }

    const originCdn = deps.getBiliVideoCdn(urlStr)
    if (!needsRedirect(originCdn)) return { url: urlStr, changed: false, originCdn }

    // seek 期間：只改寫「必須改」的 host（排除/黑名單/死節點/不穩定），
    // 其餘 backup 先放行，避免改 host 導致 player abort 再重拉（log 裡 FragmentLoadingAbandoned 連發的主因之一）。
    if (deps.inSeekGrace()) {
        const mustFix = deps.matchesExclude(originCdn) || deps.knownDeadHosts.has(originCdn)
            || deps.blacklistSet.has(originCdn) || deps.isUnstableCdnHost(originCdn)
            || deps.isForcedRedirect(originCdn)
        if (!mustFix) return { url: urlStr, changed: false, originCdn }
    }

    const bestCdn = deps.getCurrentCdn()
    if (!bestCdn || bestCdn === originCdn) return { url: urlStr, changed: false, originCdn }

    const newUrl = replaceUrlHost(urlStr, bestCdn)
    if (!newUrl || newUrl === urlStr) return { url: urlStr, changed: false, originCdn }

    deps.redirectStats.whitelist++
    logRedirect('Transport', originCdn, bestCdn,
        deps.blacklistSet.has(originCdn) ? '黑名單' : '非白名單')
    return { url: newUrl, changed: true, originCdn, targetCdn: bestCdn }
}

const isMediaSegmentUrl = (url) => {
    if (!url) return false
    if (deps.isProtectedSignedUrl(url)) return true
    const delivery = deps.classifyMediaDelivery(url)
    if (delivery.kind === 'pcdn' || delivery.kind === 'suspected-pcdn' || delivery.kind === 'live') return true
    if (deps.isBiliFragmentUrl(url)) return true
    try {
        const u = deps.parseMediaHttpUrl(url)
        if (!u) return false
        const host = u.hostname
        if (deps.isUnstableCdnHost(host)) return true
        // Akamai 是 Bilibili 對台灣/海外流量常見的合法 fallback CDN，不是只有被
        // isForcedRedirect 標記過才算「媒體片段」——舊判斷只在已經決定要把它改寫
        // 掉之後才承認它是 segment，導致第一次播放（尚未 forced-redirect）完全
        // 跳過 XHR/fetch 攔截層的位元組計算監聽器（見 send() 的 `if (this._originCdn)`
        // 分支）。實際影響：只要這支影片被分到 Akamai 節點，Watchdog 面板的緩衝
        // 進度條就整支片子動不了（totalMB 永遠 0），即使播放本身完全正常。
        // normalizeMediaUrl() 的 isAkamaiUrl 分支本來就只有 isForcedRedirect 才會
        // 真的改寫網址，這裡放寬只是讓「量測」對 Akamai 節點也生效，不影響改寫邏輯。
        if (host.endsWith('.akamaized.net')) {
            const path = u.pathname
            return path.endsWith('.m4s') || path.endsWith('.flv') || path.includes('/upgcxcode/')
        }
        return false
    } catch { return false }
}

const _redirectLogTs = {}

const _redirectLogTotal = {}

const REDIRECT_LOG_COOLDOWN = 5000

const QUIET_REDIRECT_AFTER = 3

const QUIET_REDIRECT_EVERY = 25

const logRedirect = (channel, originCdn, targetCdn, reason) => {
    deps.DiagnosticLog.record('rewrite', { originalHost: originCdn, targetHost: targetCdn })
    const key = channel + '|' + (originCdn || '?') + '|' + targetCdn
    const now = Date.now()
    const last = _redirectLogTs[key] || 0
    const total = (_redirectLogTotal[key] || 0) + 1
    _redirectLogTotal[key] = total
    if (channel === 'Transport' && total > QUIET_REDIRECT_AFTER && total % QUIET_REDIRECT_EVERY !== 0) {
        deps.redirectStats.quietRedirects++
        return
    }
    if (now - last < REDIRECT_LOG_COOLDOWN) return
    _redirectLogTs[key] = now
    // 這行原本漏掉了：整個函式維護了節流狀態（_redirectLogTs / _redirectLogTotal）、
    // 累計了 quietRedirects，卻從來沒有真的輸出過任何東西 —— 上面所有機制等於空轉，
    // reason 參數也完全沒被用到。log() 本身受 Config.verbose 控制，預設靜音，
    // 只有使用者主動由 Tampermonkey 選單開啟 verbose 排查時才會出現。
    deps.log('[' + channel + '] ' + String(originCdn || '?').split('.')[0]
        + ' → ' + String(targetCdn || '?').split('.')[0]
        + '（' + reason + '，累計 ' + total + ' 次）')
}

const needsRedirect = (cdn) => {
    if (!cdn) return false
    if (deps.resolvedCdn && cdn === deps.resolvedCdn) return false
    if (deps.matchesExclude(cdn)) return true
    if (deps.isForcedRedirect(cdn)) return true
    return deps.knownDeadHosts.has(cdn) || deps.blacklistSet.has(cdn) || deps.isCdnStronglyBad(cdn) || !deps.PREFERRED_CDN_LIST.includes(cdn)
}

const hostLockedStreams = new Set()

const preservedOriginalStreamUrls = new Set()

const rewrittenStreamOrigins = new Map()

const REWRITTEN_STREAM_ORIGIN_MAX = 512

const streamUrlIdentity = (urlStr) => {
    return deps.parseMediaHttpUrl(urlStr)?.href || String(urlStr || '')
}

const rememberRewrittenStreamUrl = (rewrittenUrl, originalUrl) => {
    if (!rewrittenUrl || !originalUrl || rewrittenUrl === originalUrl) return rewrittenUrl
    const originalKey = streamUrlIdentity(originalUrl)
    const rootOriginal = rewrittenStreamOrigins.get(originalKey) || originalUrl
    rewrittenStreamOrigins.set(streamUrlIdentity(rewrittenUrl), rootOriginal)
    if (rewrittenStreamOrigins.size > REWRITTEN_STREAM_ORIGIN_MAX) {
        rewrittenStreamOrigins.delete(rewrittenStreamOrigins.keys().next().value)
    }
    return rewrittenUrl
}

const getOriginalStreamUrl = (urlStr) =>
    rewrittenStreamOrigins.get(streamUrlIdentity(urlStr)) || urlStr

const streamLockKey = (urlStr) => {
    try {
        const u = deps.parseMediaHttpUrl(urlStr)
        return u ? u.searchParams.get('os') || u.pathname : String(urlStr)
    } catch { return String(urlStr) }
}

const isHostLockedStream = (urlStr) => {
    if (!hostLockedStreams.size || !urlStr) return false
    return hostLockedStreams.has(streamLockKey(urlStr))
}

const noteHostLockedStream = (urlStr) => {
    const k = streamLockKey(urlStr)
    if (!k || hostLockedStreams.has(k)) return false
    hostLockedStreams.add(k)
    deps.redirectStats.hostLocked = (deps.redirectStats.hostLocked || 0) + 1
    deps.log('[綁定節點] 這條串流換 host 會被拒絕（403），之後不再改寫也不賽馬：' + k)
    return true
}

const decideMediaRewrite = (urlStr, preserveFallback = false) => {
    const decision = deps.mediaUrlPolicy.decide(urlStr)
    if (decision.action === 'pass') return { ...decision, url: urlStr }
    const original = getOriginalStreamUrl(urlStr)
    if (isHostLockedStream(original)) {
        return { action: original !== urlStr ? 'restore' : 'pass', reason: 'host-locked', url: original }
    }
    if (preserveFallback && preservedOriginalStreamUrls.has(urlStr)) return { action: 'pass', reason: 'original-backup', url: urlStr }
    return { ...decision, url: urlStr }
}

const replaceUrlHost = (urlStr, targetHost) => {
    const decision = decideMediaRewrite(urlStr)
    if (decision.action === 'restore') return decision.url
    if (decision.action !== 'rewrite') return null
    const host = targetHost || deps.getCurrentCdn()
    if (!deps.isValidCustomCdnHost(host)) return null
    const u = deps.parseMediaHttpUrl(urlStr)
    if (u.hostname === host) return urlStr
    u.hostname = host
    u.port = ''
    if (u.href.length > deps.MEDIA_URL_MAX_LENGTH) return null
    return rememberRewrittenStreamUrl(u.toString(), urlStr)
}

const buildBackupUrls = (biliSrcUrl, primaryUrl) => {
    if (!biliSrcUrl || decideMediaRewrite(biliSrcUrl).action !== 'rewrite') return []
    let primaryHost, sourceHost
    try { primaryHost = new URL(primaryUrl || biliSrcUrl).hostname } catch { primaryHost = '' }
    try { sourceHost = new URL(biliSrcUrl).hostname } catch { sourceHost = '' }
    if (deps.resolvedCdn) {
        const u = rememberRewrittenStreamUrl(replaceUrlHost(biliSrcUrl, deps.resolvedCdn), biliSrcUrl)
        return u && u !== primaryUrl ? [u] : []
    }
    // backup 也用起播模式：主流失敗時會直接切到這裡，同樣禁不起「探索中獎」。
    return deps.getHealthyCdnList(deps.STARTUP_PICK)
        // 原始 host 由 withOriginalStreamFallback 保留在最後，不占用兩個替代 CDN 名額。
        .filter(cdn => cdn !== primaryHost && cdn !== sourceHost)
        .filter(cdn => !deps.matchesExclude(cdn) && !deps.knownDeadHosts.has(cdn) && !deps.blacklistSet.has(cdn))
        .slice(0, 2)
        .map(cdn => rememberRewrittenStreamUrl(replaceUrlHost(biliSrcUrl, cdn), biliSrcUrl))
        .filter(Boolean)
}

const sanitizePlayInfoUrls = (root) => {
    const seen = new WeakSet()
    let changed = 0

    const rewrite = (value) => {
        if (typeof value !== 'string' || value.length < 12) return value
        // Native signed routes are exact, current-epoch URLs. They may appear in the final
        // route plan as a primary or backup and must not be converted into a catalog URL.
        if (deps.isProtectedSignedUrl(value)) return value
        // 便宜快篩：涵蓋 Bilibili CDN 與已知 PCDN 家族，省下對其餘文字欄位 new URL() 的成本。
        // playurl 回應在 4K 多畫質 + 多 backup 時可能有幾百個字串欄位，這個成本會被放大。
        if (!/(?:\.bilivideo\.|szbdyd\.com|mountaintoys\.cn|nexusedgeio\.com|ahdohpiechei\.com)/i.test(value)) return value
        const decision = decideMediaRewrite(value, true)
        if (decision.action !== 'rewrite') return decision.url
        if (!deps.isBiliVideoUrl(value) || deps.isAkamaiUrl(value)) return value
        const host = deps.getBiliVideoCdn(value)
        if (!needsRedirect(host)) return value
        const next = rememberRewrittenStreamUrl(replaceUrlHost(value), getOriginalStreamUrl(value))
        if (next && next !== value) {
            changed++
            return next
        }
        return value
    }

    const walk = (node) => {
        if (!node || typeof node !== 'object') return
        if (seen.has(node)) return
        seen.add(node)

        if (Array.isArray(node)) {
            for (let i = 0; i < node.length; i++) {
                if (typeof node[i] === 'string') node[i] = rewrite(node[i])
                else walk(node[i])
            }
            return
        }

        Object.keys(node).forEach(k => {
            const value = node[k]
            if (typeof value === 'string') node[k] = rewrite(value)
            else walk(value)
        })
    }

    walk(root)
    return changed
}

const pickStreamUrls = (item, isDash) => {
    if (!item) return { validUrls: [], akamaiUrl: undefined, biliSrcUrl: undefined, highBitrateItem: false, preferWhitelistPrimary: false }
    const rawUrls = isDash
        ? [item.base_url, item.baseUrl]
            .concat(Array.isArray(item.backup_url) ? item.backup_url : [])
            .concat(Array.isArray(item.backupUrl) ? item.backupUrl : [])
        : [item.url]
            .concat(Array.isArray(item.backup_url) ? item.backup_url : [])
            .concat(Array.isArray(item.backupUrl) ? item.backupUrl : [])

    const validUrls  = rawUrls.filter(u => u && typeof u === 'string')
    const akamaiUrl  = validUrls.find(u => deps.isAkamaiUrl(u) && deps.mediaUrlPolicy.decide(u).action === 'rewrite')
    // v1.3.3：挑「要拿來改 host 的來源」時分兩段挑，對應社群整理的處理順序
    // （先找備援裡現成的 Mirror 型，找不到才退而求其次去改 host）：
    //   第一順位：不是 PCDN 特化路徑、host 也不是 MCDN/BCache 的 —— 這就是 Mirror 型，
    //             改 host 最安全，而且往往 backup_url 裡本來就有一條現成的。
    //   第二順位：至少路徑可改寫的（例如 BCache 型，改 host 是有效的）。
    // 兩者都沒有（整包只剩 /v1/resource 的 PCDN 特化網址）→ undefined，
    // transformStreamItem 就整個不動這個 item，讓播放器照它原本的流程走。
    const isRewritable = (u) => deps.mediaUrlPolicy.decide(u).action === 'rewrite' && !deps.isAkamaiUrl(u)
    const biliSrcUrl =
        validUrls.find(u => {
            if (!isRewritable(u)) return false
            try { return !deps.isUnstableCdnHost(new URL(u).hostname) } catch { return false }
        })
        || validUrls.find(isRewritable)
    const highBitrateItem = isDash && ((item.bandwidth || 0) > 12e6 || (item.height || 0) >= 2160)
    const preferWhitelistPrimary = highBitrateItem && biliSrcUrl

    return { validUrls, akamaiUrl, biliSrcUrl, highBitrateItem, preferWhitelistPrimary }
}

const withOriginalStreamFallback = (generated, originalUrl, primaryUrl) => {
    originalUrl = getOriginalStreamUrl(originalUrl)
    const out = [...new Set((generated || []).filter(Boolean))]
    if (originalUrl && originalUrl !== primaryUrl) {
        const existing = out.indexOf(originalUrl)
        if (existing !== -1) out.splice(existing, 1)
        preservedOriginalStreamUrls.add(originalUrl)
        if (preservedOriginalStreamUrls.size > REWRITTEN_STREAM_ORIGIN_MAX) preservedOriginalStreamUrls.delete(preservedOriginalStreamUrls.values().next().value)
        out.push(originalUrl)
    }
    return out
}

// Parsing only. Route coordination owns primary and backup selection.
const transformStreamItem = (item, isDash = true) => pickStreamUrls(item, isDash)
return { /* TEST_EXPORTS:rewrite */
get normalizeMediaUrl() { return normalizeMediaUrl; },
get isMediaSegmentUrl() { return isMediaSegmentUrl; },
get needsRedirect() { return needsRedirect; },
get hostLockedStreams() { return hostLockedStreams; },
get preservedOriginalStreamUrls() { return preservedOriginalStreamUrls; },
get rewrittenStreamOrigins() { return rewrittenStreamOrigins; },
get getOriginalStreamUrl() { return getOriginalStreamUrl; },
get isHostLockedStream() { return isHostLockedStream; },
get noteHostLockedStream() { return noteHostLockedStream; },
get decideMediaRewrite() { return decideMediaRewrite; },
get replaceUrlHost() { return replaceUrlHost; },
get withOriginalStreamFallback() { return withOriginalStreamFallback; },
get buildBackupUrls() { return buildBackupUrls; },
get sanitizePlayInfoUrls() { return sanitizePlayInfoUrls; },
get pickStreamUrls() { return pickStreamUrls; },
get transformStreamItem() { return transformStreamItem; }
};
}
