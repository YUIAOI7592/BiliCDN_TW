// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createHealth(deps) {
const BLACKLIST_EXPIRE_MS = 24 * 60 * 60 * 1000

const CDN_FAIL_THRESHOLD  = 2

const HARD_FAIL_STATUSES  = new Set([403, 451, 959])

const CDN_SOFT_BLOCK_MS   = 10 * 60 * 1000

const CDN_SOFT_BLOCK_ESCALATE = 3

const CDN_HEALTH_KEY = 'cdnHealth_v1'

const CDN_HEALTH_TTL = 6 * 60 * 60 * 1000

const createRestrictionStore = (key, hostField, ttlFor) => {
    const records = new Map(), index = new Set()
    let nextExpiryAt = Infinity
    const read = () => {
        let rawValue, raw
        try { rawValue = GM_getValue(key) } catch { rawValue = undefined }
        const rawText = typeof rawValue === 'string' ? rawValue : (rawValue == null ? '[]' : String(rawValue))
        try { raw = JSON.parse(rawText) } catch { raw = [] }
        const entries = new Map(), now = Date.now()
        if (Array.isArray(raw)) for (const entry of raw) {
            const host = entry?.[hostField]
            if (!deps.TRUSTED_CDN_CATALOG_SET.has(host) || !Number.isFinite(entry.expireAt)) continue
            const reason = typeof entry.reason === 'string' ? entry.reason.slice(0, 64) : 'unknown'
            const expireAt = Math.min(entry.expireAt, now + ttlFor(reason))
            if (expireAt <= now) continue
            const value = hostField === 'host' ? { host, expireAt, reason } : { cdn: host, expireAt }
            if (!entries.has(host) || expireAt > entries.get(host).expireAt) entries.set(host, value)
        }
        return { entries, rawText }
    }
    const adopt = (next) => {
        records.clear(); index.clear()
        nextExpiryAt = Infinity
        for (const [host, entry] of next) {
            records.set(host, entry)
            index.add(host)
            if (entry.expireAt < nextExpiryAt) nextExpiryAt = entry.expireAt
        }
    }
    const persist = (next, observedRawText) => {
        const serialized = JSON.stringify([...next.values()])
        try { if (observedRawText !== serialized) GM_setValue(key, serialized) } catch {}
        adopt(next)
    }
    const refresh = (write = true) => {
        // Re-read immediately before expiry cleanup: another tab may have extended a restriction.
        const observed = read()
        if (write) persist(observed.entries, observed.rawText)
        else adopt(observed.entries)
    }
    const remove = (host) => {
        const observed = read()
        observed.entries.delete(host)
        persist(observed.entries, observed.rawText)
    }
    const add = (host, reason = 'unknown') => {
        if (!deps.TRUSTED_CDN_CATALOG_SET.has(host)) return
        const observed = read(), next = observed.entries
        if (!next.has(host)) next.set(host, hostField === 'host'
            ? { host, expireAt: Date.now() + ttlFor(reason), reason }
            : { cdn: host, expireAt: Date.now() + ttlFor(reason) })
        persist(next, observed.rawText)
    }
    refresh(false)
    return {
        records, index, refresh, add, remove,
        clear: () => {
            const observed = read()
            persist(new Map(), observed.rawText)
        },
        nextExpiryAt: () => nextExpiryAt,
    }
}

const blacklistRecords = createRestrictionStore('cdnBlacklist', 'cdn', () => BLACKLIST_EXPIRE_MS)

const blacklistSet = blacklistRecords.index

const DEAD_HOSTS_KEY = 'knownDeadHosts_v1'

const DEAD_HOSTS_TTL = 7 * 24 * 60 * 60 * 1000

const DEAD_HOSTS_DNS_TTL = 30 * 24 * 60 * 60 * 1000

const DEAD_HOSTS_TIMEOUT_TTL = 24 * 60 * 60 * 1000

const isDnsReason     = (reason) => typeof reason === 'string' && reason.indexOf('DNS') === 0

const isTimeoutReason = (reason) => typeof reason === 'string' && reason.indexOf('timeout') === 0

const deadTtlFor = (reason) =>
    isDnsReason(reason)     ? DEAD_HOSTS_DNS_TTL
  : isTimeoutReason(reason) ? DEAD_HOSTS_TIMEOUT_TTL
  : DEAD_HOSTS_TTL

const deadHostRecords = createRestrictionStore(DEAD_HOSTS_KEY, 'host', deadTtlFor)

const knownDeadHosts = deadHostRecords.index

try {
    const installedVersion = GM_getValue('blicdnVersion')
    if (installedVersion !== deps.VERSION) {
        // v1.7.0 已移除 Worker 攔截；舊統計只在版本遷移時最佳努力清除。
        // 刪除失敗不得影響播放，也不新增持久 migration key。
        if (!installedVersion || !deps.verGte(installedVersion, '1.7.0')) {
            try { GM_deleteValue('workerStats_v1') } catch {}
        }
        // 1.1.0+ 改用實測下載速度挑節點；舊 probe 快取是延遲排序，一律清掉重學
        GM_deleteValue('probeCache_v1')
        // 舊版殘留的 '4.4.6'..'4.7.0' 字串跟本專案 1.x 版本序列對不上（疑似複製自其他腳本），
        // 一律視為「≥1.0.0 就是安全版本」：用語意化比較取代硬編碼清單。
        if (!installedVersion || !deps.verGte(installedVersion, '1.0.0')) {
            GM_setValue('cdnBlacklist', '[]')
            GM_deleteValue('probeCache_v1')
        }
        GM_setValue('blicdnVersion', deps.VERSION)
    }
} catch {}

const markHostDead = (host, reason) => {
    if (!deps.isValidCustomCdnHost(host) || knownDeadHosts.has(host)) return
    deadHostRecords.add(host, reason || 'unknown')
    const idx = activeCdnList.indexOf(host)
    if (idx !== -1) activeCdnList.splice(idx, 1)
}

const listDeadHosts = () => [...deadHostRecords.records.values()].map(e => ({
    host: e.host, reason: e.reason || 'unknown', daysLeft: +Math.max(0, (e.expireAt - Date.now()) / 86400000).toFixed(1),
}))

const reviveDeadHost = (host) => {
    if (!host) return false
    deadHostRecords.remove(host)
    const h = cdnHealth[host]
    if (h) { h.probeTimeouts = 0; h.failures = 0 }
    if (!activeCdnList.includes(host) && !blacklistSet.has(host) && deps.PREFERRED_CDN_LIST.includes(host)) {
        activeCdnList.push(host)
    }
    delete cdnFailCount[host]
    delete cdnSoftBlockUntil[host]
    // 探測快取裡存的是「救回之前」的候選清單，不清掉的話下次載入又會照著舊清單重建，
    // 這個節點要等最多兩小時才回得來——等於 revive 當下看起來有效、重整後又不見了。
    try { GM_deleteValue(deps.PROBE_CACHE_KEY) } catch {}
    scheduleCdnHealthSave()
    return true
}

const clearDeadHosts = () => {
    deadHostRecords.clear()
    try { GM_deleteValue(deps.PROBE_CACHE_KEY) } catch {}   // 同 reviveDeadHost：舊快取會把節點擋在外面
    deps.PREFERRED_CDN_LIST.forEach(c => {
        if (!activeCdnList.includes(c) && !blacklistSet.has(c)) activeCdnList.push(c)
    })
    activeCdnList.sort((a, b) => deps.PREFERRED_CDN_LIST.indexOf(a) - deps.PREFERRED_CDN_LIST.indexOf(b))
    deps.log('[死節點] 已清除，所有白名單節點重新啟用')
}

const activeCdnList = deps.PREFERRED_CDN_LIST.filter(c => !blacklistSet.has(c) && !knownDeadHosts.has(c))

let refreshingRestrictions = false
let lastRestrictionRefreshAt = 0
const RESTRICTION_REFRESH_MS = 1000

const refreshExpiredRestrictions = (force = false) => {
    if (deps.disabled || refreshingRestrictions) return false
    const now = Date.now()
    const expiryDue = Math.min(blacklistRecords.nextExpiryAt(), deadHostRecords.nextExpiryAt()) <= now
    if (!force && !expiryDue && now - lastRestrictionRefreshAt < RESTRICTION_REFRESH_MS) return false
    refreshingRestrictions = true
    try {
        const before = new Set([...blacklistSet, ...knownDeadHosts])
        blacklistRecords.refresh()
        deadHostRecords.refresh()
        lastRestrictionRefreshAt = now
        for (let i = activeCdnList.length - 1; i >= 0; i--) {
            if (blacklistSet.has(activeCdnList[i]) || knownDeadHosts.has(activeCdnList[i])) activeCdnList.splice(i, 1)
        }
        for (const host of before) {
            if (!blacklistSet.has(host) && !knownDeadHosts.has(host)
                && deps.PREFERRED_CDN_LIST.includes(host) && !activeCdnList.includes(host)) activeCdnList.push(host)
        }
        return true
    } finally { refreshingRestrictions = false }
}

const countUsableCandidates = (excluding) => deps.PREFERRED_CDN_LIST.filter(c =>
    c !== excluding
    && !deps.matchesExclude(c)
    && !knownDeadHosts.has(c)
    && !blacklistSet.has(c)
    && !isPresumedDnsFailHost(c)
).length

const MIN_USABLE_POOL = 2

const addToBlacklist = (cdn) => {
    if (!cdn || blacklistSet.has(cdn)) return
    // ★ 懲罰的力道要跟「候選池有多大」成比例。
    // 黑名單是 24 小時的重罰，這個設計預設池子夠大、關掉一個的代價很小。但台灣環境的
    // 實際可用候選常常只有 3 個（cosov 被排除、hwov/hz-aliov 是 NXDOMAIN、hw 連不上），
    // 而升級到黑名單的門檻只是 `cdnFailCount >= 2`——**一次 Wi-Fi 斷線或 VPN 重連就能讓
    // 每個正在用的節點各記 2 次失敗**，把整個池子一次關光，接下來 24 小時無節點可用。
    //
    // 所以這裡加一道與池子大小連動的煞車：如果關掉這個之後，可用節點會少於
    // MIN_USABLE_POOL，就**不關**，降級成一次軟隔離（現在的軟隔離是真的會到期的，
    // 見 softBlockCdn 的說明）。這樣「這個節點目前表現不好」仍然被表達出來——選路會
    // 排開它——但不會演變成「整天都沒有節點可用」。
    //
    // 這條規則跟使用者的網路環境無關：不管誰的機器上哪一台最快，池子見底時的正確反應
    // 都是「降級處分」而不是「繼續關人」。
    if (countUsableCandidates(cdn) < MIN_USABLE_POOL) {
        const now = Date.now()
        cdnSoftBlockUntil[cdn] = now + CDN_SOFT_BLOCK_MS
        const h = ensureCdnHealth(cdn)
        if (h) {
            h.softBlocks++
            h.lastSoftBlockAt = now
            h.lastSoftBlockReason = 'pool-protect'
            h.lastSeen = now
            scheduleCdnHealthSave()
        }
        deps.log('[黑名單] 略過 ' + cdn.split('.')[0]
            + '：關掉它會讓可用節點少於 ' + MIN_USABLE_POOL + ' 個，改為短期軟隔離')
        return
    }
    blacklistRecords.add(cdn)
    delete cdnSoftBlockUntil[cdn]
    const idx = activeCdnList.indexOf(cdn)
    if (idx !== -1) activeCdnList.splice(idx, 1)
}

const clearBlacklist = () => {
    blacklistRecords.clear()
    Object.keys(cdnSoftBlockUntil).forEach(c => delete cdnSoftBlockUntil[c])
    deps.PREFERRED_CDN_LIST.forEach(c => {
        if (!activeCdnList.includes(c)) activeCdnList.push(c)
    })
    activeCdnList.sort((a, b) => deps.PREFERRED_CDN_LIST.indexOf(a) - deps.PREFERRED_CDN_LIST.indexOf(b))
    deps.log('[黑名單] 已全部清除，所有白名單節點重新啟用')
}

const cdnFailCount = {}

const cdnSoftBlockUntil = {}

const THROUGHPUT_SCHEMA_KEY = 'throughputSchema'

const THROUGHPUT_SCHEMA_VER = 3

const CDN_HEALTH_CAPS = Object.freeze({
    samples: 12,
    successes: 12,
    failures: 2,
    slowSamples: 3,
    probeTimeouts: 3,
    probeSlows: 3,
})

const throughputSchemaStale = (() => {
    try {
        if ((+GM_getValue(THROUGHPUT_SCHEMA_KEY) || 0) >= THROUGHPUT_SCHEMA_VER) return false
        GM_setValue(THROUGHPUT_SCHEMA_KEY, THROUGHPUT_SCHEMA_VER)
        return true
    } catch { return false }
})()

const cdnHealth = (() => {
    try {
        const raw = JSON.parse(GM_getValue(CDN_HEALTH_KEY) || '{}')
        const now = Date.now()
        const out = {}
        Object.entries(raw).forEach(([cdn, h]) => {
            if (!cdn || !h || !deps.TRUSTED_CDN_CATALOG_SET.has(cdn)) return
            if (knownDeadHosts.has(cdn) || blacklistSet.has(cdn)) return
            if (!h.lastSeen || now - h.lastSeen > CDN_HEALTH_TTL) return
            // v3 吞吐資料一定要有自己的時間戳。這也防止「schema 版本已先寫成 3，
            // 但瀏覽器在清理後尚未存回 cdnHealth 就關閉」時，下一次把 v2 舊樣本復活。
            const hasCurrentThroughput = !throughputSchemaStale && (+h.lastThroughputAt || 0) > 0
            out[cdn] = {
                ewmaMbps: hasCurrentThroughput ? (+h.ewmaMbps || 0) : 0,
                varMbps:  hasCurrentThroughput ? (+h.varMbps || 0) : 0,
                samples:  hasCurrentThroughput ? Math.min(+h.samples || 0, CDN_HEALTH_CAPS.samples) : 0,
                bytes: +h.bytes || 0,
                failures: Math.min(+h.failures || 0, CDN_HEALTH_CAPS.failures),
                successes: Math.min(+h.successes || 0, CDN_HEALTH_CAPS.successes),
                slowSamples: hasCurrentThroughput ? Math.min(+h.slowSamples || 0, CDN_HEALTH_CAPS.slowSamples) : 0,
                // ★ 兩個 strike 計數必須讀回來，否則「連續 N 輪才定罪」只在單一頁面
                // session 內成立——重整一次就歸零，等於門檻永遠達不到。
                // probeTimeouts 是既有欄位（有寫入存檔卻從沒被讀回，是個只寫不讀的欄位）；
                // probeSlows 是 2026-08-19 新增時漏接的。兩者都用小上限夾住，
                // 避免任何殘留的異常值一載入就直接把節點定罪。
                // 上限寫字面量而不是引用 PROBE_*_STRIKES：那兩個常數定義在本檔案更後面，
                // 這裡是載入期就會執行的 IIFE，引用會踩到 TDZ。
                probeTimeouts: Math.min(+h.probeTimeouts || 0, CDN_HEALTH_CAPS.probeTimeouts),
                probeSlows: Math.min(+h.probeSlows || 0, CDN_HEALTH_CAPS.probeSlows),
                softBlocks: 0,
                latencyMs: +h.latencyMs || 0,
                // v1.4.0：吞吐、延遲、成功、失敗各自有時間戳。lastSeen 只負責資料 TTL，
                // 不再被拿來替舊吞吐樣本「續命」。schema v3 會清除舊版受污染的吞吐資料。
                lastThroughputAt: hasCurrentThroughput ? (+h.lastThroughputAt || 0) : 0,
                lastLatencyAt: +h.lastLatencyAt || 0,
                lastSuccessAt: +h.lastSuccessAt || 0,
                lastFailureAt: +h.lastFailureAt || 0,
                lastProbeAt: +h.lastProbeAt || 0,
                lastSeen: +h.lastSeen || 0,
                lastSlowAt: +h.lastSlowAt || 0,
                lastSoftBlockAt: 0,
                lastSoftBlockReason: '',
            }
        })
        return out
    } catch {
        return {}
    }
})()

const CDN_THROUGHPUT_ALPHA = 0.35

let cdnHealthSaveTimer = null

const scheduleCdnHealthSave = () => {
    if (cdnHealthSaveTimer) return
    cdnHealthSaveTimer = setTimeout(() => {
        cdnHealthSaveTimer = null
        try {
            const now = Date.now()
            // 多分頁共用 GM 儲存。v1.4.0 不再以單一 lastSeen 整筆二選一：
            // 另一分頁剛做延遲探測，不應覆蓋本分頁更新得更晚的吞吐量 EWMA。
            let stored = {}
            try { stored = JSON.parse(GM_getValue(CDN_HEALTH_KEY) || '{}') || {} } catch {}
            const payload = {}
            const allCdns = new Set([...Object.keys(stored), ...Object.keys(cdnHealth)])
            const newerBy = (a, b, key) => {
                if (!a) return b || null
                if (!b) return a
                return (+a[key] || 0) >= (+b[key] || 0) ? a : b
            }
            allCdns.forEach(cdn => {
                if (!deps.TRUSTED_CDN_CATALOG_SET.has(cdn)) return
                if (knownDeadHosts.has(cdn) || blacklistSet.has(cdn)) return
                const mine = cdnHealth[cdn]
                const theirs = stored[cdn]
                const state = newerBy(mine, theirs, 'lastSeen')
                const throughput = newerBy(mine, theirs, 'lastThroughputAt') || state
                const latency = newerBy(mine, theirs, 'lastLatencyAt') || state
                const success = newerBy(mine, theirs, 'lastSuccessAt') || state
                const failure = newerBy(mine, theirs, 'lastFailureAt') || state
                const probe = newerBy(mine, theirs, 'lastProbeAt') || state
                if (!state || !state.lastSeen || now - state.lastSeen > CDN_HEALTH_TTL) return
                const hasThroughput = !!(throughput && +throughput.lastThroughputAt > 0)
                payload[cdn] = {
                    ewmaMbps: hasThroughput ? (+throughput.ewmaMbps || 0) : 0,
                    varMbps: hasThroughput ? (+throughput.varMbps || 0) : 0,
                    samples: hasThroughput ? Math.min(+throughput.samples || 0, CDN_HEALTH_CAPS.samples) : 0,
                    // bytes 是各分頁的本機累計，無法安全相加（可能含共同舊基準），取最大值避免重複灌水。
                    bytes: Math.max(+(mine && mine.bytes) || 0, +(theirs && theirs.bytes) || 0),
                    failures: Math.min(+failure.failures || 0, CDN_HEALTH_CAPS.failures),
                    successes: Math.min(+success.successes || 0, CDN_HEALTH_CAPS.successes),
                    slowSamples: hasThroughput ? Math.min(+throughput.slowSamples || 0, CDN_HEALTH_CAPS.slowSamples) : 0,
                    probeTimeouts: Math.min(+probe.probeTimeouts || 0, CDN_HEALTH_CAPS.probeTimeouts),
                    probeSlows: Math.min(+probe.probeSlows || 0, CDN_HEALTH_CAPS.probeSlows),
                    latencyMs: +latency.latencyMs || 0,
                    lastThroughputAt: hasThroughput ? (+throughput.lastThroughputAt || 0) : 0,
                    lastLatencyAt: Math.max(+(mine && mine.lastLatencyAt) || 0, +(theirs && theirs.lastLatencyAt) || 0),
                    lastSuccessAt: Math.max(+(mine && mine.lastSuccessAt) || 0, +(theirs && theirs.lastSuccessAt) || 0),
                    lastFailureAt: Math.max(+(mine && mine.lastFailureAt) || 0, +(theirs && theirs.lastFailureAt) || 0),
                    lastProbeAt: Math.max(+(mine && mine.lastProbeAt) || 0, +(theirs && theirs.lastProbeAt) || 0),
                    lastSeen: Math.max(+(mine && mine.lastSeen) || 0, +(theirs && theirs.lastSeen) || 0),
                    lastSlowAt: +throughput.lastSlowAt || 0,
                }
            })
            GM_setValue(CDN_HEALTH_KEY, JSON.stringify(payload))
        } catch { deps.DiagnosticLog.fault('health-save') }
    }, 1000)
}

const getRequiredStreamMbps = (playbackRate, mode) => {
    const rate = deps.getEffectivePlaybackRate(playbackRate)
    const streamMbps = deps.currentStreamBitsPerSec > 0 ? deps.currentStreamBitsPerSec / 1e6 : 4
    const factor = mode === 'startup' ? 0.75 : 1.05
    return Math.max(1.5, streamMbps * rate * factor)
}

const ensureCdnHealth = (cdn) => {
    // health 只屬於可被選路的可信目的地；PCDN、頁面發現 host 與 Akamai 來源不得擴充候選資料面。
    if (!cdn || !deps.TRUSTED_CDN_CATALOG_SET.has(cdn)) return null
    if (!cdnHealth[cdn]) {
        cdnHealth[cdn] = {
            ewmaMbps: 0,
            varMbps: 0,
            samples: 0,
            bytes: 0,
            failures: 0,
            successes: 0,
            slowSamples: 0,
            softBlocks: 0,
            probeTimeouts: 0,
            probeSlows: 0,
            latencyMs: 0,
            lastThroughputAt: 0,
            lastLatencyAt: 0,
            lastSuccessAt: 0,
            lastFailureAt: 0,
            lastProbeAt: 0,
            lastSeen: 0,
            lastSlowAt: 0,
            lastSoftBlockAt: 0,
            lastSoftBlockReason: '',
        }
    }
    return cdnHealth[cdn]
}

if (deps.INITIAL_DEAD_HOSTS_TW.length) {
    deps.INITIAL_DEAD_HOSTS_TW.forEach(h => {
        const existing = cdnHealth[h]
        if (existing && ((existing.successes || 0) > 0 || (existing.samples || 0) > 0)) return
        const c = ensureCdnHealth(h)
        if (c) { const now = Date.now(); c.failures = Math.max(c.failures || 0, 1); c.lastFailureAt = now; c.lastSeen = now }
    })
}

const KNOWN_BAD_TW_HOSTS = new Set(deps.INITIAL_DEAD_HOSTS_TW)

const isPresumedDnsFailHost = (host) => {
    if (!host || !KNOWN_BAD_TW_HOSTS.has(host)) return false
    return deps.catalogOverrides?.[host] !== true
}

const isCdnSoftBlocked = (cdn) => {
    const until = cdnSoftBlockUntil[cdn] || 0
    if (!until) return false
    if (until <= Date.now()) {
        delete cdnSoftBlockUntil[cdn]
        return false
    }
    return true
}

const recordCdnLatency = (cdn, latencyMs) => {
    if (!cdn || !Number.isFinite(latencyMs) || latencyMs <= 0) return
    const h = ensureCdnHealth(cdn)
    if (!h) return
    if (h.probeTimeouts) h.probeTimeouts = 0   // 這一輪探測有回應了，逾時計數歸零
    h.latencyMs = h.latencyMs
        ? (h.latencyMs * 0.65) + (latencyMs * 0.35)
        : latencyMs
    const now = Date.now()
    h.lastLatencyAt = now
    h.lastProbeAt = now
    h.lastSeen = now
    scheduleCdnHealthSave()
}

const softBlockCdn = (cdn, reason, durationMs) => {
    if (!cdn || blacklistSet.has(cdn) || knownDeadHosts.has(cdn)) return
    const h = ensureCdnHealth(cdn)
    if (!h) return
    h.softBlocks++
    h.lastSoftBlockAt = Date.now()
    h.lastSoftBlockReason = reason || 'slow'
    cdnSoftBlockUntil[cdn] = Date.now() + (durationMs || CDN_SOFT_BLOCK_MS)
    // ★ 刻意**不動** activeCdnList。舊版在這裡 splice 掉這個 host，於是一個號稱
    // 「2~10 分鐘」的暫時處分，實際效果是**把節點移出候選池直到兩小時後的下一輪探測**
    // ——到期時只有 isCdnSoftBlocked() 變回 false，沒有任何路徑把它放回池子
    // （只有 403-single 與斷路器 retraction 兩個窄分支會還原，一般的 probe-slow /
    // probe-timeout / net-fail / fragment-error 都不會）。而被移出池子就選不到，
    // 選不到就不會成功，不成功就更不會有人把它放回來。
    //
    // 這是這份腳本反覆出現的同一個錯誤：**用「此時此刻的狀態」去編輯「整個 session 的
    // 候選池母體」**（reorderCdnsByLatency 與 doBakeoff 的單向棘輪已經各修過一次，
    // 註解就寫在那裡：「只重新排序，不縮減集合」）。軟隔離同樣是瞬時狀態，該由過濾層
    // 表達，不該改變成員資格。
    //
    // 移除 splice 不會讓被隔離的節點被選中——它已經被三層獨立地擋住：
    //   1. isCdnStronglyBad() 內含 isCdnSoftBlocked() → getHealthyCdnList 的 usable 濾掉它
    //   2. getCdnHealthScore() 的 softPenalty = 1.5（大於 1，一定排到最後）
    //   3. getBestCdn / preconnectCdn / 賽馬候選 等處各自都有 isCdnSoftBlocked() 檢查
    // 差別只在於：到期之後它會**自己回到可選狀態**，而不是要等下一輪探測重建。
    // 另外，全部節點都被隔離時 usable 為空會退回 pool（照分數排序），
    // 這比「候選池被掏空」健康得多。
    if (h.softBlocks >= CDN_SOFT_BLOCK_ESCALATE && h.failures >= 2) addToBlacklist(cdn)
    scheduleCdnHealthSave()
}

const MIN_THROUGHPUT_SAMPLE_BYTES = 128 * 1024

const MIN_THROUGHPUT_SAMPLE_MS    = 5

const XHR_TIMEOUT_MIN_ELAPSED_MS = 3000

const XHR_TIMEOUT_HOST_GAP_MS = 30 * 1000

const TRUSTED_XHR_TIMEOUT_EVIDENCE = Symbol('BiliCDN native XHR timeout evidence')

const acceptedXhrTimeoutAt = new Map()

const recordCdnThroughput = (cdn, bytes, durationMs, playbackRate) => {
    if (!cdn || !bytes || !durationMs || durationMs <= 0) return { accepted: false, status: 'ineligible' }
    if (blacklistSet.has(cdn) || knownDeadHosts.has(cdn) || deps.isUnstableCdnHost(cdn)) return { accepted: false, status: 'ineligible' }
    const mbps = (bytes * 8) / durationMs / 1000
    if (!Number.isFinite(mbps) || mbps <= 0) return { accepted: false, status: 'ineligible' }
    const h = ensureCdnHealth(cdn)
    if (!h) return { accepted: false, status: 'ineligible' }
    h.bytes += bytes
    h.lastSeen = Date.now()

    // ★ 最小樣本門檻。舊版把**每一筆**傳輸都餵進 ewmaMbps，包含 init segment（~1KB）、
    // 小段 Range 請求，以及**從 HTTP 快取回來的回應**（durationMs 被 Math.max(1,…) 夾成
    // 1ms）。這些算出來的不是頻寬，是除以趨近零的分母：64KB / 2ms = 262 Mbps。
    // 使用者實測回報 `cos: {mbps: 201.32, samples: 98}` 就是這樣堆出來的——而
    // ewmaMbps 是選路計分的主要項，於是 `目前最佳` 被推成 cos，儘管同一份診斷裡
    // cos 的 latency 是 516ms、aliov 只有 142ms（curl 實測 TTFB 亦然：cos ~1000ms、
    // aliov ~70ms）。等於「誰剛好命中快取，誰就被判定為最快的節點」。
    //
    // 吞吐量只有在「傳輸夠大、久到脫離 slow-start 並攤平 TTFB」時才有意義。不夠大的
    // 傳輸仍然計入 h.bytes（面板的累計下載量要準），但**不進 ewmaMbps、不算一個樣本**
    // ——samples 的語意就是「有幾次有效的吞吐量量測」，計分與抖動估計都靠它加權。
    if (bytes < MIN_THROUGHPUT_SAMPLE_BYTES || durationMs < MIN_THROUGHPUT_SAMPLE_MS) {
        scheduleCdnHealthSave()
        return { accepted: false, status: 'insufficient', bytes, durationMs }
    }
    h.lastThroughputAt = h.lastSeen
    // 均值之外同步追蹤「抖動」：緩衝夠不夠是看均速，卡不卡頓看的是穩不穩——同樣均速
    // 15~35 Mbps 抖動的節點，比穩定在 20 Mbps 的節點更容易讓緩衝瞬間見底。用標準的
    // EWMA 變異數遞增公式（跟均值同一個 alpha，兩者衰減步調一致），第一個樣本沒有
    // 離散度資訊，變異數維持 0（不因為只有一筆樣本就誤判抖動）。
    if (h.samples) {
        const diff = mbps - h.ewmaMbps
        const incr = CDN_THROUGHPUT_ALPHA * diff
        h.ewmaMbps += incr
        h.varMbps = (1 - CDN_THROUGHPUT_ALPHA) * ((h.varMbps || 0) + diff * incr)
    } else {
        h.ewmaMbps = mbps
        h.varMbps = 0
    }
    h.samples = Math.min(CDN_HEALTH_CAPS.samples, h.samples + 1)
    // 走到這裡代表已經通過最小樣本門檻（見上），所以不必再判一次大小。
    // 用真實 playbackRate 計算需求；倍速時 required 等比例放大
    const required = getRequiredStreamMbps(playbackRate, 'steady')
    if (mbps < required) {
        h.slowSamples = Math.min(CDN_HEALTH_CAPS.slowSamples, h.slowSamples + 1)
        h.lastSlowAt = h.lastSeen
    } else {
        h.slowSamples = Math.max(0, h.slowSamples - 1)
    }
    scheduleCdnHealthSave()
    return { accepted: true, status: 'throughput', bytes, durationMs, mbps }
}

const recordCdnPenalty = (cdn, hard) => {
    const h = ensureCdnHealth(cdn)
    if (!h) return
    h.failures = Math.min(CDN_HEALTH_CAPS.failures, h.failures + (hard ? 3 : 1))
    const now = Date.now()
    h.lastFailureAt = now
    h.lastSeen = now
    scheduleCdnHealthSave()
}

const recordCdnHealthSuccess = (cdn, requestStartedAt) => {
    const h = ensureCdnHealth(cdn)
    if (!h) return false
    const mayRecover = !requestStartedAt || requestStartedAt >= (h.lastFailureAt || 0)
    h.successes = Math.min(CDN_HEALTH_CAPS.successes, h.successes + 1)
    if (mayRecover) h.failures = Math.max(0, h.failures - 1)
    const now = Date.now()
    h.lastSuccessAt = now
    h.lastSeen = now
    // v1.4.0：成功只證明「連得通」，不代表速度夠快，因此不再遞減 slowSamples。
    // 既有在途請求完成也不能解除處分；到期或明確維護操作才解除。
    // Success updates observations, never revokes an active restriction.
    scheduleCdnHealthSave()
    return mayRecover
}

const UCB_EXPLORE_C          = 0.6

const THROUGHPUT_HALFLIFE_MS = 8 * 60 * 1000

const JITTER_WEIGHT      = 0.4

const JITTER_PENALTY_CAP = 0.35

const JITTER_PRIOR_CV     = 0.25

const JITTER_PRIOR_WEIGHT = 2

const getEffectiveSamples = (cdn) => {
    const h = cdnHealth[cdn]
    if (!h || !h.samples) return 0
    const age = Math.max(0, Date.now() - (h.lastThroughputAt || 0))
    return h.samples * Math.pow(0.5, age / THROUGHPUT_HALFLIFE_MS)
}

const getTotalEffectiveSamples = () => {
    let n = 0
    for (const k in cdnHealth) n += getEffectiveSamples(k)
    return n
}

const scoreRouteHealth = (h, { required, failureCount = 0, softBlocked = false, exploreBonus = 0 } = {}) => {
    required = Number.isFinite(required) && required > 0 ? required : getRequiredStreamMbps(undefined, 'steady')
    // ── reward：正規化到 0~1（達到 2 倍需求速度即視為滿分，避免高速節點之間的絕對差距
    // 把分數尺度撐爆，導致 explore 項在快節點之間完全失去作用）
    let throughput = (h && h.samples && h.lastThroughputAt) ? h.ewmaMbps : 0
    if (h && h.samples && h.lastThroughputAt) {
        const age = Date.now() - h.lastThroughputAt
        if (age > 0) throughput *= Math.pow(0.5, age / THROUGHPUT_HALFLIFE_MS)
    }
    const reward = Math.min(1, throughput / Math.max(1, required * 2))

    // ── explore：標準 UCB1，用折舊後的有效樣本數，讓久沒用的節點自然回到探索池
    // exploit 模式（起播）直接歸零：見上方 getCdnHealthScore 的完整說明。
    // ── penalty：同樣換算到 0~1 級距，延遲探測（探測 RTT，資訊量低）權重壓到最多 10%
    const failPenalty    = Math.min(0.6, ((failureCount || 0) * 0.15) + (h ? h.failures * 0.10 : 0))
    const slowPenalty    = Math.min(0.4, h ? h.slowSamples * 0.10 : 0)
    const softPenalty    = softBlocked ? 1.5 : 0   // 大於 1：一定排到最後
    const latencyPenalty = h && h.latencyMs ? Math.min(0.10, h.latencyMs / 3000) : 0
    // ── 抖動懲罰：緩衝夠不夠看均速，卡不卡頓看的是穩不穩定。同樣均速 20Mbps，
    // 15~35 抖動的節點比穩定 18~22 的節點更容易讓緩衝瞬間見底、觸發卡頓。用變異係數
    // （標準差/均值，無因次，不受節點快慢的絕對量綱影響）換算成跟其他懲罰同級距的分數。
    // 低樣本節點不能假設「零抖動」——那等於暗示「沒測過＝最穩定」，會誘使演算法為了
    // 避開已知節點的抖動懲罰而不斷去測新節點，反而更不穩定（用模擬跑過 900 個 segment
    // 驗證過這個反效果）。改用信賴度加權的悲觀先驗：樣本少時假設中等抖動
    // （JITTER_PRIOR_CV），隨樣本數增加才逐漸信任實測值。
    const measuredCv = h && h.samples ? Math.sqrt(h.varMbps || 0) / Math.max(1e-6, h.ewmaMbps) : JITTER_PRIOR_CV
    const blendedCv = (JITTER_PRIOR_CV * JITTER_PRIOR_WEIGHT + measuredCv * (h ? h.samples : 0))
        / (JITTER_PRIOR_WEIGHT + (h ? h.samples : 0))
    const jitterPenalty = (h && h.ewmaMbps > 0)
        ? Math.min(JITTER_PENALTY_CAP, blendedCv * JITTER_WEIGHT)
        : 0

    return reward + exploreBonus - failPenalty - slowPenalty - softPenalty - latencyPenalty - jitterPenalty
}

const getCdnHealthScore = (cdn, opts) => {
    const h = cdnHealth[cdn]
    const nEff  = getEffectiveSamples(cdn)
    const total = getTotalEffectiveSamples()
    const exploreBonus = (opts && opts.exploit)
        ? 0
        : UCB_EXPLORE_C * Math.sqrt(Math.log(total + 1) / (nEff + 1))
    return scoreRouteHealth(h, {
        required: getRequiredStreamMbps(undefined, 'steady'),
        failureCount: cdnFailCount[cdn] || 0,
        softBlocked: isCdnSoftBlocked(cdn),
        exploreBonus,
    })
}

const isCdnStronglyBad = (cdn) => {
    if (!cdn) return false
    if (knownDeadHosts.has(cdn)) return true
    if (isCdnSoftBlocked(cdn)) return true
    if ((cdnFailCount[cdn] || 0) >= CDN_FAIL_THRESHOLD) return true
    const h = cdnHealth[cdn]
    if (!h) return false
    if (h.failures >= 2 && h.successes === 0) return true
    if (getEffectiveSamples(cdn) >= 2 && h.slowSamples >= 2 && h.ewmaMbps < getRequiredStreamMbps(undefined, 'steady') * 0.85) return true
    return h.failures >= 3 && h.failures > h.successes
}

let lastChosenCdn = null

const CDN_STICKY_MARGIN = 0.20

const getHealthyCdnList = (opts) => {
    refreshExpiredRestrictions()
    // ★ 過濾的**順序**是關鍵，不能只看每一層各自的邏輯。
    // isPresumedDnsFailHost 是「已知連不到」（必定失敗），cdnFailCount 是「最近表現不好」
    // （只是慢）。必須先整批拿掉前者，再談失敗次數——反過來寫的話，當所有可達節點都因為
    // 失敗次數超標被濾掉時，剩下的就只有那些「從沒被用過、所以也從沒失敗過」的不可達節點，
    // 選路會直接把 segment 導去 NXDOMAIN。使用者實測 log 出現過：
    //   [Transport] upos-sz-mirrorcosov → upos-sz-mirrorhwov（非白名單，累計 1 次）
    // 「被懲罰過但連得到」永遠優於「乾淨但連不到」。
    const mk = (cdn, index) => ({ cdn, index, health: cdnHealth[cdn], score: getCdnHealthScore(cdn, opts) })
    const all = activeCdnList.filter(c => !deps.isHostAllowed || deps.isHostAllowed(c)).map(mk)
    const reachable  = all.filter(item => !isPresumedDnsFailHost(item.cdn))
    // ★ 上面那條「可達優先於乾淨」的規則有個更上游的漏洞：cdnFailCount 只是「記帳」，
    // 但累積到 CDN_FAIL_THRESHOLD（2 次）就會 addToBlacklist()，而黑名單是直接把節點
    // **從 activeCdnList 移除**的。也就是說一次網路斷線（Wi-Fi 掉線、VPN 重連、切換網路）
    // 就能讓每個正在用的節點各記 2 次失敗，把所有可達節點一次清出候選池——池子裡就只剩
    // 那幾個「從沒被用過、所以也從沒失敗過」的已知不解析節點。接著 base 退回 all，
    // 選路開始把每一顆 segment 都改寫到 NXDOMAIN，而黑名單一綁就是 24 小時：
    // 使用者看到的是「整天都完全播不出來 + console 滿滿 ERR_NAME_NOT_RESOLVED」。
    // 排序層修好了，但成員層還會被掏空——所以退路也要補在成員層。
    // 這裡只在「候選池裡連一個可達節點都不剩」時才啟用，正常情況完全不受影響：
    // 寧可用一個被黑名單過、但至少解得到 IP 的節點，也不要用一個必定失敗的。
    let base = reachable
    if (!base.length) {
        const salvaged = deps.PREFERRED_CDN_LIST
            .filter(c => !isPresumedDnsFailHost(c) && !knownDeadHosts.has(c) && !blacklistSet.has(c)
                && !deps.matchesExclude(c) && !isCdnSoftBlocked(c) && (!deps.isHostAllowed || deps.isHostAllowed(c)))
            .map(mk)
        base = salvaged.length ? salvaged : all
    }
    const notFailing = base.filter(item => (cdnFailCount[item.cdn] || 0) < CDN_FAIL_THRESHOLD)
    const pool       = notFailing.length ? notFailing : base
    const usable     = pool.filter(item => !isCdnStronglyBad(item.cdn))
    const indexed    = usable.length ? usable : pool

    indexed.sort((a, b) => {
        const aHasSamples = !!(a.health && a.health.samples)
        const bHasSamples = !!(b.health && b.health.samples)
        if (aHasSamples || bHasSamples) {
            if (a.score !== b.score) return b.score - a.score
            if ((a.health ? a.health.ewmaMbps : 0) !== (b.health ? b.health.ewmaMbps : 0)) {
                return (b.health ? b.health.ewmaMbps : 0) - (a.health ? a.health.ewmaMbps : 0)
            }
        }
        // 都還沒有吞吐量樣本（全新安裝、或吞吐量資料剛被重置）時，先比**實測延遲**再退回
        // index。舊版直接退回 index，隱含假設「activeCdnList 的順序就是延遲順序」——
        // 但那只在剛跑完探測時成立：黑名單還原、死節點救回等路徑是照
        // PREFERRED_CDN_LIST.indexOf 重排的，那是一份寫死的靜態順序，跟這台機器的實測
        // 快慢無關。於是在「沒有吞吐量樣本」這段期間（正是起播最需要選對節點的時候），
        // 選路可能完全忽略我們明明已經量到的延遲差距。
        const aMs = (a.health && a.health.latencyMs) || 0
        const bMs = (b.health && b.health.latencyMs) || 0
        if (aMs && bMs && aMs !== bMs) return aMs - bMs
        if (aMs && !bMs) return -1      // 有實測資料的優先於完全沒量過的
        if (!aMs && bMs) return 1
        return a.index - b.index
    })

    return indexed.map(i => i.cdn)
}

const recent403 = new Map()

const GLOBAL_403_WINDOW_MS = 15000

const GLOBAL_403_HOSTS     = 2

const isGlobal403Burst = (host) => {
    const now = Date.now()
    recent403.set(host, now)
    for (const [h, t] of recent403) if (now - t > GLOBAL_403_WINDOW_MS) recent403.delete(h)
    return recent403.size >= GLOBAL_403_HOSTS
}

const retract403Penalty = (host) => {
    // 不管有沒有真的收回懲罰，這個 host 在這次突發事件裡已經處理過了，从 recent403
    // 移除——否則它會一直留在窗口內（最長到 15 秒後才被自然過期），若之後又對同一個
    // host 記錄一次全新、不相關的單一 403（重新軟隔離、reason 又變回 '403-single'），
    // 剩餘窗口內若再確認一次突發，會把這筆新的、不相關的軟隔離也一併誤收回。
    recent403.delete(host)
    const h = cdnHealth[host]
    // 只收回「這次 403-single 分支造成」的懲罰，不要誤觸該節點因為別的原因
    // （例如吞吐量太慢）本來就存在的軟隔離——用 lastSoftBlockReason 當精確判斷依據，
    // 而不是「只要現在有 soft block 就收回」。
    if (!h || h.lastSoftBlockReason !== '403-single') return
    if (h.failures > 0) h.failures--
    if (cdnSoftBlockUntil[host]) {
        delete cdnSoftBlockUntil[host]
        h.lastSoftBlockReason = ''
        if (h.softBlocks > 0) h.softBlocks--
        if (!activeCdnList.includes(host) && !blacklistSet.has(host) && !knownDeadHosts.has(host)
            && deps.PREFERRED_CDN_LIST.includes(host)) {
            activeCdnList.push(host)
        }
    }
}

const recordCdnFailure = (cdn, hard, status) => {
    if (!cdn) return
    if (blacklistSet.has(cdn) || knownDeadHosts.has(cdn)) return

    if (status === 403) {
        if (isGlobal403Burst(cdn)) {
            deps.log('[403] 偵測到多節點同時 403，判定為 playurl 簽名過期，不標記死節點：' + cdn.split('.')[0])
            for (const h of recent403.keys()) retract403Penalty(h)
            return
        }
        // 只有單一 host 403：先軟隔離觀察，不直接標死（可能只是該節點區域拒絕，也可能是巧合）
        recordCdnPenalty(cdn, false)
        softBlockCdn(cdn, '403-single', 10 * 60 * 1000)
        return
    }

    recordCdnPenalty(cdn, hard)
    if (hard) {
        cdnFailCount[cdn] = CDN_FAIL_THRESHOLD
        addToBlacklist(cdn)
        markHostDead(cdn, 'HARD-fail')
        try { deps.Watchdog.noteHardFail() } catch {}
        return
    }
    cdnFailCount[cdn] = (cdnFailCount[cdn] || 0) + 1
    if (cdnFailCount[cdn] >= CDN_FAIL_THRESHOLD) addToBlacklist(cdn)
    else softBlockCdn(cdn, 'net-fail', 2 * 60 * 1000)
}

const recordCdnSuccess = (cdn, requestStartedAt) => {
    const mayRecover = recordCdnHealthSuccess(cdn, requestStartedAt)
    if (mayRecover && cdn && cdnFailCount[cdn]) cdnFailCount[cdn] = 0
    // 只有新於最近失敗的成功請求，才足以把逾時計數歸零。
    const h = cdn && cdnHealth[cdn]
    if (mayRecover && h && h.probeTimeouts) h.probeTimeouts = 0
}

const peekBestCdn = (opts) => {
    const healthy = getHealthyCdnList(opts)
    if (!healthy.length) return null
    let pick = healthy[0]
    if (lastChosenCdn && lastChosenCdn !== pick && healthy.includes(lastChosenCdn)) {
        const curScore = getCdnHealthScore(lastChosenCdn, opts)
        const topScore = getCdnHealthScore(pick, opts)
        if (curScore >= topScore - CDN_STICKY_MARGIN) pick = lastChosenCdn
    }
    return pick
}

const getBestCdn = (opts) => {
    const healthy = getHealthyCdnList(opts)
    if (healthy.length) {
        let pick = healthy[0]
        // 黏著滯後：現用節點（lastChosenCdn）沒輸最高分超過 CDN_STICKY_MARGIN、且還在
        // 候選池裡，就留著不換（見上方 lastChosenCdn 宣告處的完整說明）。這是唯一
        // 讀寫 lastChosenCdn 的地方——getHealthyCdnList() 本身保持單純排序，不受
        // 「誰呼叫它」影響黏著狀態。
        if (lastChosenCdn && lastChosenCdn !== pick && healthy.includes(lastChosenCdn)) {
            // 兩邊必須用同一種計分模式，否則一邊有探索加成、一邊沒有，
            // CDN_STICKY_MARGIN 的滯後保護會被這個系統性偏差整個吃掉。
            const curScore = getCdnHealthScore(lastChosenCdn, opts)
            const topScore = getCdnHealthScore(pick, opts)
            if (curScore >= topScore - CDN_STICKY_MARGIN) pick = lastChosenCdn
        }
        lastChosenCdn = pick
        return pick
    }
    // Exhaustion is not authority to erase a restriction.
    return null
}

const promoteBestCdnNow = () => {
    const best = getBestCdn()
    if (!best) return null
    const idx = activeCdnList.indexOf(best)
    if (idx > 0) {
        activeCdnList.splice(idx, 1)
        activeCdnList.unshift(best)
    } else if (idx === -1 && !blacklistSet.has(best) && !knownDeadHosts.has(best) && !isCdnSoftBlocked(best)) {
        activeCdnList.unshift(best)
    }
    // preconnect 只提供提示；移除 link 並不是拆除 socket 的 API。
    // 保留既有提示時機：seek 保護窗內不重建，近期影片節點只補缺少的提示。
    let playingNow = null
    try { playingNow = deps.getWarmCdnHost() } catch {}   // 極早期呼叫時尚未定義，忽略即可
    const warmList = activeCdnList.slice(0, 3)
    deps.preconnectBatch(warmList.filter(h => h !== playingNow), !deps.inSeekGrace())
    if (playingNow) deps.preconnectCdn(playingNow, false)
    return best
}

const resolvedCdn = (() => {
    const normalize = value => typeof value === 'string' ? value.trim().toLowerCase() : ''
    const storedRaw = GM_getValue('CustomCDN')
    const stored = normalize(storedRaw)
    const configured = normalize(deps.CustomCDN)

    if (deps.CustomCDN === null || configured === 'null') {
        if (storedRaw != null) GM_deleteValue('CustomCDN')
        return null
    }

    if (configured) {
        if (!deps.isValidCustomCdnHost(configured)) {
            console.error('[' + deps.PluginName + ']: [安全] CustomCDN 不在可信 CDN catalog，已忽略：' + configured)
            return null
        }
        if (configured !== stored) GM_setValue('CustomCDN', configured)
        return configured
    }

    if (!stored) return null
    if (!deps.isValidCustomCdnHost(stored)) {
        // 清除舊版可能透過頁面全域 API 寫入的寬鬆 suffix-only 值，避免每次載入都重新讀到。
        GM_deleteValue('CustomCDN')
        console.error('[' + deps.PluginName + ']: [安全] 已清除不在可信 CDN catalog 的 CustomCDN：' + stored)
        return null
    }
    return stored
})()

const getCurrentCdn   = (opts) => resolvedCdn && (!deps.isHostAllowed || deps.isHostAllowed(resolvedCdn)) ? resolvedCdn : getBestCdn(opts)

const peekCurrentCdn  = (opts) => resolvedCdn && (!deps.isHostAllowed || deps.isHostAllowed(resolvedCdn)) ? resolvedCdn : peekBestCdn(opts)

const getCdnShortName = () => { const c = peekCurrentCdn(); return c ? c.split('.')[0] : 'N/A' }

const STARTUP_PICK = { exploit: true }
return { /* TEST_EXPORTS:health */
get HARD_FAIL_STATUSES() { return HARD_FAIL_STATUSES; },
get CDN_SOFT_BLOCK_MS() { return CDN_SOFT_BLOCK_MS; },
get CDN_HEALTH_KEY() { return CDN_HEALTH_KEY; },
get blacklistSet() { return blacklistSet; },
get DEAD_HOSTS_KEY() { return DEAD_HOSTS_KEY; },
get knownDeadHosts() { return knownDeadHosts; },
get markHostDead() { return markHostDead; },
get listDeadHosts() { return listDeadHosts; },
get reviveDeadHost() { return reviveDeadHost; },
get clearDeadHosts() { return clearDeadHosts; },
get activeCdnList() { return activeCdnList; },
get refreshExpiredRestrictions() { return refreshExpiredRestrictions; },
get clearBlacklist() { return clearBlacklist; },
get cdnFailCount() { return cdnFailCount; },
get cdnSoftBlockUntil() { return cdnSoftBlockUntil; },
get CDN_HEALTH_CAPS() { return CDN_HEALTH_CAPS; },
get cdnHealth() { return cdnHealth; },
get scheduleCdnHealthSave() { return scheduleCdnHealthSave; },
get getRequiredStreamMbps() { return getRequiredStreamMbps; },
get ensureCdnHealth() { return ensureCdnHealth; },
get isPresumedDnsFailHost() { return isPresumedDnsFailHost; },
get isCdnSoftBlocked() { return isCdnSoftBlocked; },
get recordCdnLatency() { return recordCdnLatency; },
get softBlockCdn() { return softBlockCdn; },
get MIN_THROUGHPUT_SAMPLE_BYTES() { return MIN_THROUGHPUT_SAMPLE_BYTES; },
get XHR_TIMEOUT_MIN_ELAPSED_MS() { return XHR_TIMEOUT_MIN_ELAPSED_MS; },
get XHR_TIMEOUT_HOST_GAP_MS() { return XHR_TIMEOUT_HOST_GAP_MS; },
get TRUSTED_XHR_TIMEOUT_EVIDENCE() { return TRUSTED_XHR_TIMEOUT_EVIDENCE; },
get acceptedXhrTimeoutAt() { return acceptedXhrTimeoutAt; },
get recordCdnThroughput() { return recordCdnThroughput; },
get recordCdnPenalty() { return recordCdnPenalty; },
get scoreRouteHealth() { return scoreRouteHealth; },
get getCdnHealthScore() { return getCdnHealthScore; },
get isCdnStronglyBad() { return isCdnStronglyBad; },
get lastChosenCdn() { return lastChosenCdn; }, set lastChosenCdn(value) { lastChosenCdn = value; },
get getHealthyCdnList() { return getHealthyCdnList; },
get recordCdnFailure() { return recordCdnFailure; },
get recordCdnSuccess() { return recordCdnSuccess; },
get peekBestCdn() { return peekBestCdn; },
get promoteBestCdnNow() { return promoteBestCdnNow; },
get resolvedCdn() { return resolvedCdn; },
get getCurrentCdn() { return getCurrentCdn; },
get peekCurrentCdn() { return peekCurrentCdn; },
get getCdnShortName() { return getCdnShortName; },
get STARTUP_PICK() { return STARTUP_PICK; }
};
}
