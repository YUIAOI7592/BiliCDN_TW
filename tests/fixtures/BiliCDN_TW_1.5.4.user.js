// ==UserScript==
// @name         Bilibili CDN 台灣優化
// @namespace    BiliCDN_TW
// @version      1.5.4
// @description  改善台灣網路觀看 Bilibili 影片時的 CDN 連線穩定度，支援自動切換與卡頓監測
// @author       jiyunshi <chocosensei214@gmail.com>
// @license      MIT
// @icon         https://i0.hdslb.com/bfs/static/jinkela/long/images/512.png
// @run-at       document-start
// @match        https://www.bilibili.com/video/*
// @match        https://www.bilibili.com/bangumi/play/*
// @match        https://www.bilibili.com/list/*
// @match        https://www.bilibili.com/festival/*
// @match        https://www.bilibili.com/medialist/play/*
// @match        https://www.bilibili.com/watchlater/*
// @match        https://www.bilibili.com/blackboard/*
// @match        https://www.bilibili.com/mooc/*
// @match        https://www.bilibili.com/cheese/*
// @match        https://www.bilibili.com/v/*
// @match        https://www.bilibili.com/documentary/*
// @match        https://www.bilibili.com/variety/*
// @match        https://www.bilibili.com/tv/*
// @match        https://www.bilibili.com/guochuang/*
// @match        https://www.bilibili.com/movie/*
// @match        https://www.bilibili.com/anime/*
// @match        https://www.bilibili.com/match/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @grant        GM_info
// @grant        unsafeWindow
// ==/UserScript==

// 本機優化版：不保留遠端自動更新網址，避免自訂修正被其他版本覆蓋。

// ── 使用者設定 ────────────────────────────────────────────────────────
// 一般使用者不需要修改；安裝後重整 Bilibili 影片頁即可使用。
// CustomCDN：留空 = 自動輪換；填 host = 固定該 CDN；填 'null' = 清除 GM 設定
var CustomCDN = ''

// ExcludeHostKeywords：host 名稱含這些子字串就不會被選用/probe/重導向
// 例：['cosov']、['cos']（含 cosov）、['ov.bilivideo']（不建議，海外節點全排）
// 動態調整請使用 Tampermonkey「BiliCDN 控制中心 → CDN 選路」。
//
// 2026-08-20：cosov 維持排除。中間一度以「一次 16KB range 請求回 206」為由解除，
// 隨即被實機推翻——**單次小範圍請求不等於持續播放**。實際開影片時 cosov 會：
//   (1) 對 PROBE_PATH（/crossdomain.xml）**必定**回 403 → 每輪探測固定產生一行紅字；
//   (2) 對真實 m4s 回 `ERR_FAILED 514` 且**不帶 Access-Control-Allow-Origin**，
//       瀏覽器直接報 CORS 錯誤（實測 URL 上是 os=cosovbv、bw=22M 的 4K/HDR 串流）。
// 同一批 log 裡另外四個新增鏡像（alib / ali02 / bos / tf-all-tx）零錯誤，所以問題確實
// 只在 cosov。詳見 CHANGELOG 實驗記錄實驗 4 與實驗 5。
var ExcludeHostKeywords = ['cosov']

// BlockHttpDNS：true = 永遠阻擋；false = 永遠放行；'auto' = 短測 + 評分 + 記憶網路環境
var BlockHttpDNS = 'auto'

// PreferredVideoCodec：'av1' = 相同畫質優先 AV1，再退回 HEVC、AVC；'hevc' = 優先 HEVC；
// 'avc' = 最保守、優先 AVC；'auto' = 完全保留 Bilibili 原順序。AV1 只有在 representation
// 帶有實際 codec string 且 MediaSource/canPlayType 回報可播放時才會主動提升；Media Capabilities
// 明確回報不支援、不順暢或非節能解碼時，AV1/HEVC 會降到 AVC 後面。
var PreferredVideoCodec = 'av1'

// BlockWebRTC：true = 阻擋 WebRTC（擋 Bilibili PCDN/P2P 傳輸，跨國連線建議開）；
// false = 放行（頁面其他功能，或其他擴充功能，若也用到 WebRTC 才需要關）
var BlockWebRTC = true

// EnableWorkerIntercept：是否攔截 new Worker() 並改寫其內部 segment 請求的 CDN host。
// 這段機制涉及動態 Worker 包裝，對目前播放器是否真的有作用仍需實測；v1.4.0 預設 false，
// 先避免實驗性攔截影響播放。要驗證時可暫時改成 true，播放數部影片後查看
// 控制中心「進階 → 顯示 Worker 使用量」中 mediaSeen > 0 才代表 Worker 真的抓過影片分段。
// 設定面板 checkbox 控制的是整體 CDN 改寫；這個變數則控制 Worker 攔截機制本身。
var EnableWorkerIntercept = false

// ── 版本號 ────────────────────────────────────────────────────────────
// 單一事實來源：優先讀 Tampermonkey 注入的 GM_info（跟著 @version 走，改版不用四處手動同步）。
const VERSION = (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) || '1.5.4'
const parseVer = (v) => String(v || '0').split('.').map(n => parseInt(n, 10) || 0)
const verGte = (a, b) => {
    const A = parseVer(a), B = parseVer(b)
    for (let i = 0; i < 3; i++) { if ((A[i] || 0) !== (B[i] || 0)) return (A[i] || 0) > (B[i] || 0) }
    return true
}

// ── 診斷輸出 ──────────────────────────────────────────────────────────
// 預設不輸出背景 log；需要排查時可由 Tampermonkey 選單切換 verbose。
const PluginName = 'BiliCDN_TW_v' + VERSION
const Config = { verbose: false }
// Local-only, typed evidence. Never ingest console, arbitrary errors, URLs or page messages.
const DiagnosticLog = (() => {
    const critical = [], detail = [], pending = new Map()
    const TTL = 15 * 60 * 1000
    const encoder = new TextEncoder()
    const codes = new Set(('runtime verbose settings-read settings-write settings-verify exception '
        + 'request headers body eof no-body http network-error body-error abort reopened detached '
        + 'rewrite measurement watchdog recovery breaker host-lock clipboard sample').split(' '))
    const enums = new Set(('fetch xhr video audio muxed unknown non-catalog headers body '
        + 'settings-read settings-write settings-verify startup active disabled spa epoch '
        + 'interceptor transform fetch-body playurl-body playurl-clone measurement watchdog snapshot '
        + 'health-save clipboard-gm clipboard-standard clipboard-manual page-hook ui '
        + 'no-video invalid-state no-metadata media-error ended paused seeking seek-grace '
        + 'background-gap player-nudge nudge-grace startup-grace switch-grace target-reached '
        + 'healthy low-data buffered-stall too-slow stall-count cooldown breaker '
        + 'attempt progress no-progress interrupted no-attribution attributed httpdns '
        + 'accepted skipped complete cancelled failed timeout partial latency-only '
        + 'http network-error body-error abort eof no-body reopened detached automatic manual '
        + 'fixed no-segment busy hidden not-applicable host-lock forbidden insufficient ineligible').split(' '))
    const keys = new Set(('generation epoch id method kind originalHost targetHost finalHost host '
        + 'status bytes startAt responseAt endAt ageMs phase stage reason enabled persisted '
        + 'readyState networkState currentTime duration bufferAheadSec observedRate effectiveRate '
        + 'paused seeking ended available valid errorCode hidden waitMs count remainingMs '
        + 'punished reselected preconnect requested received switchCount stallCount breakerSec '
        + 'outcome actionId').split(' '))
    const state = { startedAt: Date.now(), verboseChangedAt: Date.now(), persisted: null,
        evicted: 0, expired: 0, rejected: 0, pendingEvicted: 0, failures: 0 }
    let seq = 0, nextRequest = 0, lastSampleAt = 0
    let context = { generation: 0, epoch: 0 }
    let decision = null
    const size = text => encoder.encode(text).byteLength
    const finite = x => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= Number.MAX_SAFE_INTEGER
    const host = value => {
        try {
            const h = typeof value === 'string' && value.length <= 16384
                ? (value.includes('/') ? new URL(value, 'https://www.bilibili.com').hostname : value) : ''
            return TRUSTED_CDN_CATALOG_SET.has(h) ? h : 'non-catalog'
        } catch { return 'non-catalog' }
    }
    const clean = data => {
        const out = {}
        for (const key of Object.keys(data).slice(0, 40)) {
            if (!keys.has(key)) continue
            const value = data[key]
            if (/Host$/.test(key) || key === 'host') out[key] = value === null ? null : host(value)
            else if (value === null || typeof value === 'boolean' || finite(value)) out[key] = value
            else if (typeof value === 'string' && enums.has(value)) out[key] = value
        }
        return out
    }
    const prune = () => {
        const cutoff = Date.now() - TTL
        for (const ring of [critical, detail]) {
            while (ring.length && ring[0].lastAt < cutoff) { ring.shift(); state.expired++ }
        }
    }
    const record = (code, data = {}, important = false) => {
        try {
            if (!codes.has(code)) { state.rejected++; return }
            if (!important && !Config.verbose) return
            prune()
            const fields = { ...context, ...clean(data) }
            const now = Date.now(), ring = important ? critical : detail
            const previous = ring[ring.length - 1]
            if (previous && previous.seq === seq && previous.code === code
                && JSON.stringify(previous.data) === JSON.stringify(fields)) {
                previous.lastAt = now; previous.count = Math.min(10000, previous.count + 1); return
            }
            const entry = { seq: ++seq, firstAt: now, lastAt: now, count: 1, code, data: fields }
            if (size(JSON.stringify(entry)) > 1024) { state.rejected++; return }
            ring.push(entry)
            if (ring.length > (important ? 64 : 192)) { ring.shift(); state.evicted++ }
            try { if (Config.verbose) console.log('[BiliCDN evidence]', JSON.stringify(entry)) } catch {}
        } catch { state.failures++ }
    }
    const fault = stage => record('exception', { stage }, true)
    const requestActive = r => r && r.generation === context.generation && r.epoch === context.epoch
    const request = (method, media, original, target) => {
        try {
            if (!mediaContextActive(media)) return null
            const r = { id: ++nextRequest, generation: media.runtime.generation, epoch: media.epoch,
                method, kind: media.rep?.kind || 'unknown', originalHost: host(original),
                targetHost: host(target), finalHost: null, startAt: Date.now(), responseAt: null,
                bytes: 0, status: null, phase: 'headers' }
            pending.set(r.id, r)
            if (pending.size > 64) { pending.delete(pending.keys().next().value); state.pendingEvicted++ }
            record('request', r)
            return r.id
        } catch { state.failures++; return null }
    }
    const updateRequest = (id, code, data = {}) => {
        try {
            const r = pending.get(id)
            if (!requestActive(r)) return
            Object.assign(r, clean(data))
            if (code === 'headers') { r.responseAt = Date.now(); r.phase = 'body' }
            if (code === 'body') return // Counters only: no per-chunk events.
            const terminal = code !== 'headers'
            if (terminal) { r.endAt = Date.now(); pending.delete(id) }
            record(code, r, ['http', 'network-error', 'body-error'].includes(code))
        } catch { state.failures++ }
    }
    const boundary = (generation, epoch, reason) => {
        try {
            for (const id of [...pending.keys()]) updateRequest(id, 'detached')
            context = { generation, epoch }
            record('runtime', { reason }, true)
        } catch { state.failures++ }
    }
    const setDecision = (reason, data = {}) => {
        try {
            const next = { ...context, reason, ...clean(data) }
            if (!decision || decision.reason !== reason || decision.generation !== context.generation) record('watchdog', next, reason === 'low-data')
            decision = { ...next, updatedAt: Date.now() }
        } catch { state.failures++ }
    }
    return Object.freeze({
        record, fault, request, updateRequest, boundary, setDecision, host, size,
        verbose(persisted) { state.persisted = persisted; state.verboseChangedAt = Date.now(); record('verbose', { enabled: Config.verbose, persisted }, true) },
        sample(data) { if (Date.now() - lastSampleAt >= 5000) { lastSampleAt = Date.now(); record('sample', data) } },
        summary() { prune(); return { ...state, verbose: Config.verbose, critical: critical.length, detail: detail.length, pending: pending.size } },
        snapshot() { prune(); return JSON.parse(JSON.stringify({ ...state, verbose: Config.verbose, decision,
            critical, detail, pending: [...pending.values()].map(r => ({ ...r, ageMs: Math.max(0, Date.now() - r.startAt) })) })) },
    })
})()
try { Config.verbose = !!GM_getValue('verbose'); DiagnosticLog.verbose(true) }
catch { DiagnosticLog.record('settings-read', {}, true); DiagnosticLog.verbose(null) }
const log = (...args) => { try { if (Config.verbose) console.log('[' + PluginName + ']:', ...args) } catch {} }
const err = (...args) => { try { if (Config.verbose) console.error('[' + PluginName + ']:', ...args) } catch {} }

let disabled = !!GM_getValue('disabled')
// 只管理腳本主動發出的量測／預熱工作；播放器自己的 XHR／Fetch 絕不掛到這個 signal。
// generation 讓停用或 SPA 換片前已經開始的非同步 callback 失去寫入健康狀態的資格。
let runtimeGeneration = 0
let runtimeAbortController = null
const runtimeTimeouts = new Set()
const clearRuntimeTimeout = (timer) => {
    if (timer == null) return
    clearTimeout(timer)
    runtimeTimeouts.delete(timer)
}
const scheduleRuntimeTimeout = (callback, delay) => {
    const generation = runtimeGeneration
    const timer = setTimeout(() => {
        runtimeTimeouts.delete(timer)
        if (disabled || generation !== runtimeGeneration) return
        callback()
    }, delay)
    runtimeTimeouts.add(timer)
    return timer
}
const stopRuntimeGeneration = () => {
    runtimeGeneration++
    DiagnosticLog.boundary(runtimeGeneration, playinfoEpoch, disabled ? 'disabled' : 'active')
    resetMediaDelivery()
    invalidateCodecQueries()
    resetPlaybackQuality()
    if (runtimeAbortController) {
        try { runtimeAbortController.abort() } catch {}
        runtimeAbortController = null
    }
    runtimeTimeouts.forEach(timer => clearTimeout(timer))
    runtimeTimeouts.clear()
}
const beginRuntimeGeneration = () => {
    stopRuntimeGeneration()
    if (disabled) return null
    try { runtimeAbortController = new AbortController() } catch { runtimeAbortController = null }
    return runtimeAbortController
        ? { generation: runtimeGeneration, signal: runtimeAbortController.signal }
        : { generation: runtimeGeneration, signal: null }
}
const captureRuntimeGeneration = () => ({
    generation: runtimeGeneration,
    signal: runtimeAbortController ? runtimeAbortController.signal : null,
})
const isRuntimeGenerationActive = token => !!token && !disabled
    && token.generation === runtimeGeneration
    && (!token.signal || !token.signal.aborted)
const reportMeasurementFailure = () => {
    const token = captureRuntimeGeneration(), epoch = playinfoEpoch
    return () => { if (isRuntimeGenerationActive(token) && epoch === playinfoEpoch) DiagnosticLog.fault('measurement') }
}
// 面板注入狀態：預設不輸出 log（Config.verbose 只有排查時才開），如果 Bilibili
// 改版導致 .bpx-player-ctrl-setting-others 選擇器失效，使用者不會看到任何錯誤，
// 只會覺得「面板消失了」卻無從查起。CDN 改寫核心不依賴這個選擇器，會照常運作，
// 但至少讓控制中心的「診斷」能一眼看出「是選擇器找不到面板，還是真的沒問題」。
let uiInjectStatus = 'pending'   // 'pending' | 'ok' | 'timeout'

// ── 台灣常見不可用節點 ────────────────────────────────────────────────
// 這些節點在台灣常見 DNS 失敗或區域拒絕，預設先避開以減少無效連線。
const INITIAL_DEAD_HOSTS_TW = [
    'upos-sz-mirrorhwov.bilivideo.com',   // 台灣 DNS 普遍屏蔽
    'upos-sz-mirrorhw.bilivideo.com',     // 台灣 IP 區域拒絕 (HTTP 959)
    'upos-hz-mirroraliov.bilivideo.com',  // 杭州內網域名，台灣 DNS 不解析
]

// ── playurl API 前綴 ──────────────────────────────────────────────────
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

// ── CDN 候選清單（台灣優化）───────────────────────────────────────────
// 順序由台灣常見可用性排列，實際播放時仍會依探測與下載速度自動調整。
// 這個順序只是**沒有任何本機資料時**的起跑序（getHealthyCdnList 在無樣本時的最後退路），
// 一旦有實測延遲/吞吐量就完全由資料接管——所以它不需要、也不應該精準反映某一台機器的
// 排名。2026-08-19 新增的四個鏡像（alib / ali02 / bos / tf-all-tx）與解除排除的 cosov，
// 都是用**真實簽名的 m4s 網址**實測回 206 + 完整位元組才加入的（見 CHANGELOG 實驗記錄
// 實驗 4）；`/crossdomain.xml` 回 200 只證明 host 活著，不足以當作加入的依據。
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

// 唯一可被拿來承接其他媒體 URL path/query 的可信 CDN catalog。這份清單是靜態、
// 可審查的程式設定；頁面發現值、console、Worker message 與 GM 儲存都不能擴充它。
const TRUSTED_CDN_CATALOG = Object.freeze([...PREFERRED_CDN_LIST_RAW])
const TRUSTED_CDN_CATALOG_SET = new Set(TRUSTED_CDN_CATALOG)

const CATALOG_OVERRIDES_KEY = 'catalogOverrides_v1'
const matchesHeaderExclude = (host) => {
    if (!host) return false
    return ExcludeHostKeywords.some(kw => kw && host.indexOf(kw) !== -1)
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
    // 正常選單不會產生「所有可用節點都關閉」；若 GM 被外部手動改成這種狀態，回到檔頭預設。
    const nonPresumed = TRUSTED_CDN_CATALOG.filter(host => !INITIAL_DEAD_HOSTS_TW.includes(host))
    const hasUsable = nonPresumed.some(host => Object.prototype.hasOwnProperty.call(out, host)
        ? out[host]
        : !matchesHeaderExclude(host))
    if (!hasUsable) {
        Object.keys(out).forEach(host => delete out[host])
        dirty = true
    }
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
    return !matchesHeaderExclude(host)
}
const matchesExclude = host => TRUSTED_CDN_CATALOG_SET.has(host)
    ? !isCatalogAutoEnabled(host)
    : matchesHeaderExclude(host)

// 固定 CDN 會直接成為 segment 改寫目標，因此只接受靜態可信 catalog 的 exact host。
// 控制只存在於 sandbox 閉包與 Tampermonkey 選單；頁面的 unsafeWindow.BiliCDN 沒有 mutator。
const isValidCustomCdnHost = (host) => {
    if (!host || typeof host !== 'string') return false
    return TRUSTED_CDN_CATALOG_SET.has(host.trim().toLowerCase())
}

// v1.4.0：白名單必須能隨 include()/exclude() 即時重建。舊版在啟動時只算一次，
// include("cosov") 雖然會把 host 塞回 activeCdnList，needsRedirect() 仍會因它不在
// PREFERRED_CDN_LIST 而再次改寫掉，形成「介面說已恢復、實際仍不放行」的不一致。
const PREFERRED_CDN_LIST = []
const rebuildPreferredCdnList = () => {
    const next = PREFERRED_CDN_LIST_RAW.filter(isCatalogAutoEnabled)
    PREFERRED_CDN_LIST.splice(0, PREFERRED_CDN_LIST.length, ...next)
}
rebuildPreferredCdnList()

// ── 黑名單（24h，session 失敗累積觸發）+ HARD 失敗碼 ─────────────────
// HARD 狀態碼 = 區域/權限永久拒絕，一次就黑名單 + 標死節點
const BLACKLIST_EXPIRE_MS = 24 * 60 * 60 * 1000
const CDN_FAIL_THRESHOLD  = 2
const HARD_FAIL_STATUSES  = new Set([403, 451, 959]) // 959：Bilibili 對台灣 IP 的區域拒絕自訂碼（非標準 HTTP 狀態碼，實測於台灣網路環境觀察到）
const CDN_SOFT_BLOCK_MS   = 10 * 60 * 1000
const CDN_SOFT_BLOCK_ESCALATE = 3
const CDN_HEALTH_KEY = 'cdnHealth_v1'
const CDN_HEALTH_TTL = 6 * 60 * 60 * 1000

// Expiry-bearing maps are authoritative; Sets are synchronized membership indexes only.
const createRestrictionStore = (key, hostField, ttlFor) => {
    const records = new Map(), index = new Set()
    const read = () => {
        let raw
        try { raw = JSON.parse(GM_getValue(key) || '[]') } catch { raw = [] }
        const entries = new Map(), now = Date.now()
        if (Array.isArray(raw)) for (const entry of raw) {
            const host = entry?.[hostField]
            if (!TRUSTED_CDN_CATALOG_SET.has(host) || !Number.isFinite(entry.expireAt)) continue
            const reason = typeof entry.reason === 'string' ? entry.reason.slice(0, 64) : 'unknown'
            const expireAt = Math.min(entry.expireAt, now + ttlFor(reason))
            if (expireAt <= now) continue
            const value = hostField === 'host' ? { host, expireAt, reason } : { cdn: host, expireAt }
            if (!entries.has(host) || expireAt > entries.get(host).expireAt) entries.set(host, value)
        }
        return entries
    }
    const adopt = (next) => {
        records.clear(); index.clear()
        for (const [host, entry] of next) { records.set(host, entry); index.add(host) }
    }
    const persist = (next) => {
        const serialized = JSON.stringify([...next.values()])
        try { if ((GM_getValue(key) || '[]') !== serialized) GM_setValue(key, serialized) } catch {}
        adopt(next)
    }
    const refresh = (write = true) => {
        // Re-read immediately before expiry cleanup: another tab may have extended a restriction.
        const next = read()
        if (write) persist(next)
        else adopt(next)
    }
    const remove = (host) => { const next = read(); next.delete(host); persist(next) }
    const add = (host, reason = 'unknown') => {
        if (!TRUSTED_CDN_CATALOG_SET.has(host)) return
        const next = read()
        if (!next.has(host)) next.set(host, hostField === 'host'
            ? { host, expireAt: Date.now() + ttlFor(reason), reason }
            : { cdn: host, expireAt: Date.now() + ttlFor(reason) })
        persist(next)
    }
    refresh(false)
    return { records, index, refresh, add, remove, clear: () => persist(new Map()) }
}
const blacklistRecords = createRestrictionStore('cdnBlacklist', 'cdn', () => BLACKLIST_EXPIRE_MS)
const blacklistSet = blacklistRecords.index

// ── 持久死節點（逾時 1d / 一般 7d / DNS 類 30d，跨 session）───────────
// 跳過所有 probe / preconnect / 賽馬 / 選路，徹底消除 console 紅字
//（任何失敗請求瀏覽器都會印紅字，唯一根治就是「不發」）
// 標記時機：探測 fetch 被 reject（DNS / 連線被拒 / TLS）、探測逾時且確認不可達、
//          HARD 失敗碼（403/451/959）、segment 連線層失敗且確認不可達
const DEAD_HOSTS_KEY = 'knownDeadHosts_v1'
const DEAD_HOSTS_TTL = 7 * 24 * 60 * 60 * 1000
// DNS 解析失敗跟其他失敗不是同一種東西：403、逾時、連線被拒都可能是暫時的（節點壅塞、
// 區域策略調整、對方在維護），7 天後重試一次很合理；但 NXDOMAIN 是「這個網域在這個
// 解析器上不存在」，是穩定事實，7 天後重試只會得到完全一樣的結果 —— 代價是每週一次
// 必定失敗的請求，以及 console 一行紅字。拉長到 30 天。
const DEAD_HOSTS_DNS_TTL = 30 * 24 * 60 * 60 * 1000
// 反過來，「逾時」是這三種死因裡**證據最弱**的一種：它只代表「在我們給的窗口內沒回應」，
// 而沒回應的原因可能是節點壞了，也可能只是冷 TLS 握手比窗口慢（實測上界 8.8 秒）、
// 或起播當下自己在搶連線配額。證據強度要配得上刑期——判 7 天太重，降到 1 天：
// 真的壞掉的節點隔天照樣會再被判一次（成本是一輪探測），誤殺的好節點則隔天就回得來。
const DEAD_HOSTS_TIMEOUT_TTL = 24 * 60 * 60 * 1000
const isDnsReason     = (reason) => typeof reason === 'string' && reason.indexOf('DNS') === 0
const isTimeoutReason = (reason) => typeof reason === 'string' && reason.indexOf('timeout') === 0
const deadTtlFor = (reason) =>
    isDnsReason(reason)     ? DEAD_HOSTS_DNS_TTL
  : isTimeoutReason(reason) ? DEAD_HOSTS_TIMEOUT_TTL
  : DEAD_HOSTS_TTL

// 讀取時順便**依現行規則重算刑期**。這一步是必要的，不是保險：`markHostDead()` 對已經在
// 清單裡的 host 幾乎不會再被呼叫到（probeCdnLatency 與 handleSegmentConnError 開頭都有
// `knownDeadHosts.has(cdn)` 提前 return），所以「改了刑期規則」如果只改寫入端，
// **既有紀錄會一直用舊規則服完刑**。2026-08-19 使用者機器上實測到的就是這個：
// 4 筆死節點全是 7 天，v1.3.3 宣稱的「DNS 類 30 天」從來沒有對它們生效過。
//
// 只往「縮短」的方向校正（超過現行 TTL 就夾回去），不延長：規則放寬（timeout 7d → 1d）要能立刻把
// 誤殺的節點放回候選池；規則收緊則不該追溯加重一個當初依舊規則判下去的刑期。
const deadHostRecords = createRestrictionStore(DEAD_HOSTS_KEY, 'host', deadTtlFor)
const knownDeadHosts = deadHostRecords.index

// 升級/首次安裝：清掉舊黑名單 + probe 快取
try {
    const installedVersion = GM_getValue('blicdnVersion')
    if (installedVersion !== VERSION) {
        // 1.1.0+ 改用實測下載速度挑節點；舊 probe 快取是延遲排序，一律清掉重學
        GM_deleteValue('probeCache_v1')
        // 舊版殘留的 '4.4.6'..'4.7.0' 字串跟本專案 1.x 版本序列對不上（疑似複製自其他腳本），
        // 一律視為「≥1.0.0 就是安全版本」：用語意化比較取代硬編碼清單。
        if (!installedVersion || !verGte(installedVersion, '1.0.0')) {
            GM_setValue('cdnBlacklist', '[]')
            GM_deleteValue('probeCache_v1')
        }
        GM_setValue('blicdnVersion', VERSION)
    }
} catch {}

const markHostDead = (host, reason) => {
    if (!isValidCustomCdnHost(host) || knownDeadHosts.has(host)) return
    deadHostRecords.add(host, reason || 'unknown')
    const idx = activeCdnList.indexOf(host)
    if (idx !== -1) activeCdnList.splice(idx, 1)
}

// 死節點的「死因 + 還剩多久」。knownDeadHosts 只是個 Set，看不出任何前因後果——
// 而一個好節點被誤殺 7~30 天，使用者唯一能察覺的徵兆就是這份清單多了一筆。
// 診斷輸出一定要能回答「為什麼死的」，否則只能靠猜。
const listDeadHosts = () => [...deadHostRecords.records.values()].map(e => ({
    host: e.host, reason: e.reason || 'unknown', daysLeft: +Math.max(0, (e.expireAt - Date.now()) / 86400000).toFixed(1),
}))

// 單獨救回一個節點，不動其他學習狀態。clearDead() 是全清（連真的壞掉的也一起放回去，
// 下一輪探測又會重新撞一次、再印一次紅字），誤殺單一節點時用這個精準得多。
const reviveDeadHost = (host) => {
    if (!host) return false
    deadHostRecords.remove(host)
    const h = cdnHealth[host]
    if (h) { h.probeTimeouts = 0; h.failures = 0 }
    if (!activeCdnList.includes(host) && !blacklistSet.has(host) && PREFERRED_CDN_LIST.includes(host)) {
        activeCdnList.push(host)
    }
    delete cdnFailCount[host]
    delete cdnSoftBlockUntil[host]
    // 探測快取裡存的是「救回之前」的候選清單，不清掉的話下次載入又會照著舊清單重建，
    // 這個節點要等最多兩小時才回得來——等於 revive 當下看起來有效、重整後又不見了。
    try { GM_deleteValue(PROBE_CACHE_KEY) } catch {}
    scheduleCdnHealthSave()
    return true
}

const clearDeadHosts = () => {
    deadHostRecords.clear()
    try { GM_deleteValue(PROBE_CACHE_KEY) } catch {}   // 同 reviveDeadHost：舊快取會把節點擋在外面
    PREFERRED_CDN_LIST.forEach(c => {
        if (!activeCdnList.includes(c) && !blacklistSet.has(c)) activeCdnList.push(c)
    })
    activeCdnList.sort((a, b) => PREFERRED_CDN_LIST.indexOf(a) - PREFERRED_CDN_LIST.indexOf(b))
    log('[死節點] 已清除，所有白名單節點重新啟用')
}

// session 動態健康清單；啟動時排除黑名單（24h）+ 死節點（1~30d，依死因）
const activeCdnList = PREFERRED_CDN_LIST.filter(c => !blacklistSet.has(c) && !knownDeadHosts.has(c))
let refreshingRestrictions = false
const refreshExpiredRestrictions = () => {
    if (disabled || refreshingRestrictions) return
    refreshingRestrictions = true
    try {
        const before = new Set([...blacklistSet, ...knownDeadHosts])
        blacklistRecords.refresh()
        deadHostRecords.refresh()
        for (let i = activeCdnList.length - 1; i >= 0; i--) {
            if (blacklistSet.has(activeCdnList[i]) || knownDeadHosts.has(activeCdnList[i])) activeCdnList.splice(i, 1)
        }
        for (const host of before) {
            if (!blacklistSet.has(host) && !knownDeadHosts.has(host)
                && PREFERRED_CDN_LIST.includes(host) && !activeCdnList.includes(host)) activeCdnList.push(host)
        }
    } finally { refreshingRestrictions = false }
}


// 加入黑名單：對任意 bilivideo.com hostname 有效（不限白名單）
// 候選池還剩幾個「真的可以拿來用」的節點。用 PREFERRED_CDN_LIST 而不是 activeCdnList，
// 因為要算的是母體上限，不受當下排序或暫時性狀態影響。
const countUsableCandidates = (excluding) => PREFERRED_CDN_LIST.filter(c =>
    c !== excluding
    && !matchesExclude(c)
    && !knownDeadHosts.has(c)
    && !blacklistSet.has(c)
    && !isPresumedDnsFailHost(c)
).length

// 黑名單至少要留這麼多個可用節點。低於它就不准再關人。
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
        log('[黑名單] 略過 ' + cdn.split('.')[0]
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
    PREFERRED_CDN_LIST.forEach(c => {
        if (!activeCdnList.includes(c)) activeCdnList.push(c)
    })
    activeCdnList.sort((a, b) => PREFERRED_CDN_LIST.indexOf(a) - PREFERRED_CDN_LIST.indexOf(b))
    log('[黑名單] 已全部清除，所有白名單節點重新啟用')
}

// session 失敗計數；HARD 失敗一次就黑名單 + 標死節點
const cdnFailCount = {}
const cdnSoftBlockUntil = {}

// 實際 segment 吞吐評分：probe 只決定初始順序，播放後改由真實下載速度接管。
// 吞吐量取樣規則改版時，既有的 ewmaMbps / samples 是用**舊規則**算出來的，留著會繼續
// 影響選路——修了規則不代表被規則汙染的資料會自己乾淨（這個專案已經踩過好幾次）。
// v2：加入最小樣本門檻（見 recordCdnThroughput）。在那之前，init segment 與 HTTP 快取
// 命中都會被當成「一次量測」，算出 200+ Mbps 的假值。只清吞吐量相關欄位，
// 保留 successes / failures / latencyMs（那幾項不受這條規則影響，清掉等於白白丟資料）。
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
            if (!cdn || !h || !TRUSTED_CDN_CATALOG_SET.has(cdn)) return
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
let currentStreamBitsPerSec = 0
// v1.3.3：這支片提供的所有畫質（height + bandwidth），用來把 currentStreamBitsPerSec
// 校正成「實際正在播的畫質」而不是「清單裡最高的畫質」。見 syncStreamBitrateFromVideo。
let streamProfile = null
let cdnHealthSaveTimer = null
// 另一支 userscript 會把播放器預設設為 2x；新 <video> 剛建立時常先短暫回報 1x。
// 在 ratechange 或非 1x 直接觀察確認之前，以 2x 規劃頻寬與緩衝，避免初始化順序造成低估。
const ASSUMED_PLAYBACK_RATE = 2
const MAX_NETWORK_PLAYBACK_RATE = 4
const playbackRateState = {
    observedRate: ASSUMED_PLAYBACK_RATE,
    effectiveRate: ASSUMED_PLAYBACK_RATE,
    confirmed: false,
    source: 'assumed',
}
const resetPlaybackRateState = () => {
    playbackRateState.observedRate = ASSUMED_PLAYBACK_RATE
    playbackRateState.effectiveRate = ASSUMED_PLAYBACK_RATE
    playbackRateState.confirmed = false
    playbackRateState.source = 'assumed'
    return playbackRateState
}
const getEffectivePlaybackRate = value => {
    const numeric = value === undefined ? playbackRateState.effectiveRate : Number(value)
    if (!Number.isFinite(numeric) || numeric <= 0) return ASSUMED_PLAYBACK_RATE
    return Math.max(1, Math.min(MAX_NETWORK_PLAYBACK_RATE, numeric))
}
const syncPlaybackRateFromVideo = (video, source = 'watchdog') => {
    let numeric
    try { numeric = Number(video && video.playbackRate) } catch { return resetPlaybackRateState() }
    if (!Number.isFinite(numeric) || numeric <= 0) return resetPlaybackRateState()
    // 初始 1x 可能只是另一支腳本還沒套用預設；標準 ratechange 則是使用者/播放器的明確決定。
    if (!playbackRateState.confirmed && numeric === 1 && source !== 'ratechange') return playbackRateState
    playbackRateState.observedRate = numeric
    playbackRateState.effectiveRate = getEffectivePlaybackRate(numeric)
    playbackRateState.confirmed = true
    playbackRateState.source = String(source || 'watchdog').slice(0, 24)
    return playbackRateState
}

// seek 保護窗：拖時間軸後一段時間內不換 CDN、不測速、不強制改寫 segment，
// 避免 seek _recovery 期間 abort 重拉造成「緩衝加載更多次」與 Stuck:Rescue。
let seekGraceUntil = 0
const getSeekGraceMs = () => (currentStreamBitsPerSec / 1e6 >= 12) ? 8000 : 5000
const bumpSeekGrace = () => {
    seekGraceUntil = Math.max(seekGraceUntil, Date.now() + getSeekGraceMs())
}
const inSeekGrace = () => Date.now() < seekGraceUntil

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
                if (!TRUSTED_CDN_CATALOG_SET.has(cdn)) return
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
        } catch { DiagnosticLog.fault('health-save') }
    }, 1000)
}

// mode='startup'：起播/緩衝充足，下載到碼率的 75% 就算夠快，可以容忍短暫低於碼率。
// mode='steady'（預設）：緩衝已經打平的穩態播放，長期低於碼率必定慢慢吃完緩衝，
// 「夠不夠快」是物理事實，門檻要跟真實碼率一致（留 5% 餘裕）——不該套用起播時的寬鬆係數。
const getRequiredStreamMbps = (playbackRate, mode) => {
    const rate = getEffectivePlaybackRate(playbackRate)
    const streamMbps = currentStreamBitsPerSec > 0 ? currentStreamBitsPerSec / 1e6 : 4
    const factor = mode === 'startup' ? 0.75 : 1.05
    return Math.max(1.5, streamMbps * rate * factor)
}

const ensureCdnHealth = (cdn) => {
    // health 只屬於可被選路的可信目的地；PCDN、頁面發現 host 與 Akamai 來源不得擴充候選資料面。
    if (!cdn || !TRUSTED_CDN_CATALOG_SET.has(cdn)) return null
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

// 台灣不可用清單是「特定時空、特定 ISP」的觀察，不同電信商/VPN 路由差異很大，
// Bilibili 的 CDN 分配也會變。直接標死 7 天等於剝奪部分使用者用到最快節點的機會。
// 改成「起跑墊底」：仍在探索池內、仍會被 reorderCdnsByLatency 探測一次，
// 真的探測失敗時既有邏輯（probe timeout / DNS 失敗）自然會把它升級成標死。
//
// v1.3.3：觸發條件從「首次安裝或從 <1.0.0 升級」（shouldSeedInitialHosts）改成
// 「這個 host 在本機還沒有任何實測樣本」。舊條件對早就裝過的使用者實際上從來沒生效過，
// 這幾個 host 就以「零紀錄」的身分待在候選池裡——而零紀錄在 UCB 計分裡是「有探索加成」的，
// 反而比有幾次成功紀錄的節點更容易在起播那一刻被選中。
// 一旦有了真實資料（successes/samples > 0）就完全不干預，
// 使用者自己的實測永遠優先於這份清單。
if (INITIAL_DEAD_HOSTS_TW.length) {
    INITIAL_DEAD_HOSTS_TW.forEach(h => {
        const existing = cdnHealth[h]
        if (existing && ((existing.successes || 0) > 0 || (existing.samples || 0) > 0)) return
        const c = ensureCdnHealth(h)
        if (c) { const now = Date.now(); c.failures = Math.max(c.failures || 0, 1); c.lastFailureAt = now; c.lastSeen = now }
    })
}

// ── 已知在台灣不解析的節點：省掉「再確認一次」的那個請求 ──────────────
// 探測失敗時預設會再呼叫一次 confirmHostReachable() 確認，避免一次瞬間拖動就把
// 好節點標死 7~30 天。但對 INITIAL_DEAD_HOSTS_TW 這幾個「已知在台灣就是不解析」、
// 而且本機從來沒有任何成功紀錄的 host，那次確認換不到新資訊（答案幾乎確定是
// DNS 失敗），只會在 console 多印一行紅字 —— 使用者回報過的 `?_c=...` 那行就是它。
//
// 「本機從來沒有成功紀錄」這個條件很重要 —— 它保留了 v1.3.0 的設計意圖：不同電信商 /
// VPN 路由差異很大，只要這個 host 在**你的**網路上真的成功過一次，就不再套用這條捷徑，
// 一律走完整的確認流程。
const KNOWN_BAD_TW_HOSTS = new Set(INITIAL_DEAD_HOSTS_TW)
const isPresumedDnsFailHost = (host) => {
    if (!host || !KNOWN_BAD_TW_HOSTS.has(host)) return false
    const h = cdnHealth[host]
    return !h || ((h.successes || 0) === 0 && (h.samples || 0) === 0)
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

// 吞吐量取樣的最小門檻。128KB 這個值本來就存在（舊版只拿它判 slowSamples），
// 現在提升為「算不算一次量測」的共同門檻；5ms 則是用來排除 HTTP 快取命中
// （durationMs 會被 Math.max(1, …) 夾成 1ms，除出來是天文數字）。
const MIN_THROUGHPUT_SAMPLE_BYTES = 128 * 1024
const MIN_THROUGHPUT_SAMPLE_MS    = 5

const recordCdnThroughput = (cdn, bytes, durationMs, playbackRate) => {
    if (!cdn || !bytes || !durationMs || durationMs <= 0) return { accepted: false, status: 'ineligible' }
    if (blacklistSet.has(cdn) || knownDeadHosts.has(cdn) || isUnstableCdnHost(cdn)) return { accepted: false, status: 'ineligible' }
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
    // 只有在失敗／軟隔離之後才新發出的請求成功，才允許清除處分；避免隔離前已在途的
    // 舊請求稍後完成，反過來把剛下的新處分與失敗計數立刻撤銷。
    if (mayRecover && requestStartedAt >= (h.lastSoftBlockAt || 0) && cdnSoftBlockUntil[cdn]) {
        delete cdnSoftBlockUntil[cdn]
        h.lastSoftBlockReason = ''
    }
    scheduleCdnHealthSave()
    return mayRecover
}

// 跨國選節點 = 非平穩多臂老虎機：用 Discounted-UCB 近似最優 online 策略。
// exploit 項：吞吐量 EWMA 隨時間半衰（舊樣本信心打折，貼近擁塞變動）。
// explore 項：低樣本節點給樂觀加成，促使週期性重評估，避免鎖死在次優解。
//
// reward 正規化到 0~1（UCB1 的數學前提），懲罰項也換算成同一級距，否則探索強度會跟
// 節點快慢反著跑：節點很快時 explore 加成被吞吐量淹沒（不再探索），節點很慢時
// explore 加成反而主導排序（過度探索）——跟「越不確定越該試」的設計意圖相反。
const UCB_EXPLORE_C          = 0.6          // 探索強度（0~1 級距下的常數），越大越積極試新節點
const THROUGHPUT_HALFLIFE_MS = 8 * 60 * 1000 // 吞吐量樣本半衰期
// 抖動懲罰的權重／上限：以「最穩定、不卡頓」為最高原則，寧可選一個均速略低但穩定
// 的節點，也不要選均速高但忽快忽慢的節點——0.35 上限跟 slowPenalty 同量級（兩者都是
// 「無法穩定供應緩衝」的懲罰，只是一個看瞬間門檻、一個看長期離散度），但不到 softPenalty
// 那種「直接排到最後」的強度，避免單純因為波動被誤判成壞節點。
// 數值來源：用模擬器跑過「30 分鐘播放、含真實換節點延遲代價」的緊繃/寬鬆/4K 三種情境
// 網格搜尋（不是憑感覺猜）——單獨調這兩個值效果很小且不穩定，關鍵是要先有 CDN_STICKY_MARGIN
// 的滯後保護（見 getHealthyCdnList），兩者一起才會讓卡頓次數穩定下降。
const JITTER_WEIGHT      = 0.4
const JITTER_PENALTY_CAP = 0.35
const JITTER_PRIOR_CV     = 0.25  // 低樣本節點的悲觀先驗抖動假設
const JITTER_PRIOR_WEIGHT = 2     // 先驗的「等效樣本數」，樣本數遠大於這個值後才主要信任實測

// 有效樣本數：跟 reward 用同一個半衰因子折舊。Discounted-UCB 的標準實作要點是分子
// （累積 reward）和分母（樣本數）必須同步打折——只折分子的話，久沒用的好節點雖然
// 吞吐量衰減到接近 0，但因為 samples 還是原本的大數字，explore 加成也很小，
// 分數永遠很低、永遠不會被重新測試，即使它現在其實是最快的。
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

// opts.exploit = true：關閉 UCB 的探索加成，只用「已經實測到的表現」排名。
//
// 為什麼要分兩種模式（v1.3.3）：exploreBonus 是多臂拉霸機的標準設計，會刻意給
// 「樣本少的節點」加分，讓它有機會被選中去累積樣本 —— 這在長期是對的，但代價是
// 「偶爾會中獎選到一個沒把握的節點」。問題在於這個代價會落在最禁不起出事的地方：
// playurl 改寫的當下（也就是使用者剛點進影片、正要起播的那一刻）。
//
// 而探索其實已經有專屬管道了：賽馬（doBakeoff）本來就會挑「缺新鮮樣本」的候選去
// 實測，用 384KB~768KB 的 ranged GET 拿樣本。用賽馬探索的成本是幾百 KB 的背景流量，
// 用起播探索的成本是使用者盯著轉圈圈 —— 沒有理由選後者。
//
// 所以：起播路徑（transformStreamItem / buildBackupUrls）用 exploit 模式，
// 其餘情境（Watchdog 卡頓後換節點、賽馬後重排序）維持完整 UCB —— 那些情境本來就
// 是「現在這個已經不行了，該去試點別的」，探索加成正好派上用場。
const getCdnHealthScore = (cdn, opts) => {
    const h = cdnHealth[cdn]
    const required = getRequiredStreamMbps(undefined, 'steady')

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
    const nEff  = getEffectiveSamples(cdn)
    const total = getTotalEffectiveSamples()
    const exploreBonus = (opts && opts.exploit)
        ? 0
        : UCB_EXPLORE_C * Math.sqrt(Math.log(total + 1) / (nEff + 1))

    // ── penalty：同樣換算到 0~1 級距，延遲探測（探測 RTT，資訊量低）權重壓到最多 10%
    const failPenalty    = Math.min(0.6, ((cdnFailCount[cdn] || 0) * 0.15) + (h ? h.failures * 0.10 : 0))
    const slowPenalty    = Math.min(0.4, h ? h.slowSamples * 0.10 : 0)
    const softPenalty    = isCdnSoftBlocked(cdn) ? 1.5 : 0   // 大於 1：一定排到最後
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

// 黏著滯後：getBestCdn() 過去完全沒有「換節點的保護」，每個 segment 都重新算一次
// 最高分，任何分數雜訊（包括下面 jitterPenalty 帶來的）都會在下一個 segment 立刻
// 觸發換節點——但換節點要重新 TCP/TLS 握手，這個代價往往比「換到分數高一點點的
// 節點」換來的好處更大。模擬過（30 分鐘播放、含真實換節點延遲代價）：加上這個
// 滯後讓卡頓次數直接減少 5~6 成，比單獨調 jitterPenalty 的權重有效得多；而且加了
// 滯後之後，jitterPenalty 才真的能發揮作用，不然它造成的額外換節點會抵銷掉它想
// 帶來的穩定度好處。只保護「還在候選池裡」的節點——真的被 isCdnStronglyBad 或
// 失敗次數踢出候選池的節點不受保護，該換照樣換。
//
// 注意：黏著狀態（lastChosenCdn）只能由「真的決定接下來要用哪個節點」的 getBestCdn()
// 讀寫。getHealthyCdnList() 本身保持單純的排序函式——它也被 buildBackupUrls()、
// switchCdn() 算 warmTargets、fragment-error 之後的 preconnect 熱身等「只是要看排名 /
// 順便熱身，不代表接下來真的會拉這個節點的 segment」的場合呼叫，如果那些呼叫也
// 順手把 lastChosenCdn 覆寫掉，黏著保護會被錨定到從未真正服務過 segment 的節點上，
// 跟實際播放路徑（誰在拉 segment）脫鉤。
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
    const all = activeCdnList.map(mk)
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
        const salvaged = PREFERRED_CDN_LIST
            .filter(c => !isPresumedDnsFailHost(c) && !knownDeadHosts.has(c) && !matchesExclude(c))
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

// 403 突發偵測：playurl 簽名（deadline/upsig）過期時，播放器對所有 backup_url 重試，
// 短時間內會有多個不同 host 各拿一次 403——這不是節點壞掉，是「門票」全體失效。
// 若照舊把每個 host 都當硬失敗標死 7 天，會在簽名過期的瞬間把所有候選節點一次封光。
const recent403 = new Map()          // host -> ts
const GLOBAL_403_WINDOW_MS = 15000   // 15 秒內
const GLOBAL_403_HOSTS     = 2       // 有 2 個以上不同 host 都 403 → 判定為簽名過期
const isGlobal403Burst = (host) => {
    const now = Date.now()
    recent403.set(host, now)
    for (const [h, t] of recent403) if (now - t > GLOBAL_403_WINDOW_MS) recent403.delete(h)
    return recent403.size >= GLOBAL_403_HOSTS
}

// 突發偵測需要看到「第 2 個」不同 host 才判得出來，所以同一波簽名過期裡最先 403
// 的那個 host 一定會在偵測到突發之前，先走一次「單一 host」分支被軟隔離。等真的
// 確認是突發時，把這波窗口內已經被誤罰的 host 全部補救回來，才符合「不處罰任何
// 節點」的設計目標，不然第一個中獎的 host 永遠會被冤枉 10 分鐘。
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
            && PREFERRED_CDN_LIST.includes(host)) {
            activeCdnList.push(host)
        }
    }
}

const recordCdnFailure = (cdn, hard, status) => {
    if (!cdn) return
    if (blacklistSet.has(cdn) || knownDeadHosts.has(cdn)) return

    if (status === 403) {
        if (isGlobal403Burst(cdn)) {
            log('[403] 偵測到多節點同時 403，判定為 playurl 簽名過期，不標記死節點：' + cdn.split('.')[0])
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
        try { Watchdog.noteHardFail() } catch {}
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

// 純查詢版：供診斷、UI 與 Worker 同步使用，不重置失敗計數、不清黑名單，
// 也不覆寫 lastChosenCdn。讀取狀態不應反過來改變播放決策。
const peekBestCdn = (opts) => {
    const healthy = getHealthyCdnList(opts)
    if (!healthy.length) return activeCdnList[0] || null
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
    if (activeCdnList.length > 0) {
        activeCdnList.forEach(c => { cdnFailCount[c] = 0 })
        return activeCdnList[0]
    }
    err('[警告] 所有白名單節點均失效，自動重置黑名單')
    clearBlacklist()
    if (activeCdnList.length > 0) return activeCdnList[0]
    // 連黑名單清掉後仍無節點 → 代表白名單幾乎全被標死（網路/VPN 變動或誤判殘留）。
    // 救回非預設（學習而來）的死節點，避免完全沒節點可用而失效。
    const allPreferredDead = PREFERRED_CDN_LIST.every(c => knownDeadHosts.has(c) || blacklistSet.has(c))
    if (allPreferredDead) {
        err('[警告] 白名單全數標死，自動清除死節點重新啟用')
        clearDeadHosts()
    }
    return activeCdnList[0] || null
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
    try { playingNow = getWarmCdnHost() } catch {}   // 極早期呼叫時尚未定義，忽略即可
    const warmList = activeCdnList.slice(0, 3)
    preconnectBatch(warmList.filter(h => h !== playingNow), !inSeekGrace())
    if (playingNow) preconnectCdn(playingNow, false)
    syncWorkerCdnTarget()
    return best
}

// 解析固定 CDN（CustomCDN 變數 vs GM 儲存）
const resolvedCdn = (() => {
    const normalize = value => typeof value === 'string' ? value.trim().toLowerCase() : ''
    const storedRaw = GM_getValue('CustomCDN')
    const stored = normalize(storedRaw)
    const configured = normalize(CustomCDN)

    if (CustomCDN === null || configured === 'null') {
        if (storedRaw != null) GM_deleteValue('CustomCDN')
        return null
    }

    if (configured) {
        if (!isValidCustomCdnHost(configured)) {
            console.error('[' + PluginName + ']: [安全] CustomCDN 不在可信 CDN catalog，已忽略：' + configured)
            return null
        }
        if (configured !== stored) GM_setValue('CustomCDN', configured)
        return configured
    }

    if (!stored) return null
    if (!isValidCustomCdnHost(stored)) {
        // 清除舊版可能透過頁面全域 API 寫入的寬鬆 suffix-only 值，避免每次載入都重新讀到。
        GM_deleteValue('CustomCDN')
        console.error('[' + PluginName + ']: [安全] 已清除不在可信 CDN catalog 的 CustomCDN：' + stored)
        return null
    }
    return stored
})()

const getCurrentCdn   = (opts) => resolvedCdn || getBestCdn(opts)
const peekCurrentCdn  = (opts) => resolvedCdn || peekBestCdn(opts)
const getCdnShortName = () => { const c = peekCurrentCdn(); return c ? c.split('.')[0] : 'N/A' }

// 起播（playurl 改寫）專用的計分模式：只信實測表現，不做探索。見 getCdnHealthScore 說明。
const STARTUP_PICK = { exploit: true }

// UI 標題（依瀏覽器語言）
const SettingsBarTitle = (() => {
    const lang = ((navigator.languages || [navigator.language || 'en'])[0]).substring(0, 2)
    return ({ zh: '攔截修改影片 CDN', ja: 'CDNスイッチャー' })[lang] || 'CDN Switcher (TW)'
})()

// ── URL 工具 ──────────────────────────────────────────────────────────
function createMediaUrlPolicy() {
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

// 頁面 / playurl 曾出現過的穩定 upos host（MCDN/PCDN fallback 用）
let pageDiscoveredCdn = null

const discoverCdnFromPage = () => {
    try {
        const html = (document.head && document.head.innerHTML) || ''
        const m = html.match(/up[\w-]+\.bilivideo\.com/)
        if (!m || !m[0]) return
        if (matchesExclude(m[0]) || knownDeadHosts.has(m[0]) || blacklistSet.has(m[0]) || isCdnSoftBlocked(m[0])) return
        pageDiscoveredCdn = m[0]
        if (isValidCustomCdnHost(m[0])) preconnectCdn(m[0])
    } catch {}
}

const noteDiscoveredCdn = (host) => {
    if (!host || !host.endsWith('.bilivideo.com')) return
    if (matchesExclude(host) || knownDeadHosts.has(host) || blacklistSet.has(host) || isCdnSoftBlocked(host)) return
    if (isUnstableCdnHost(host)) return
    pageDiscoveredCdn = host
    if (isValidCustomCdnHost(host)) preconnectCdn(host)
}

// MCDN / PCDN / 區域自建節點（常見海外卡頓來源）
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
        && isValidCustomCdnHost(pageDiscoveredCdn)
        && !matchesExclude(pageDiscoveredCdn)
        && !knownDeadHosts.has(pageDiscoveredCdn)
        && !blacklistSet.has(pageDiscoveredCdn)
        && !isCdnSoftBlocked(pageDiscoveredCdn)
        && !isUnstableCdnHost(pageDiscoveredCdn)
        ? pageDiscoveredCdn
        : null
    return resolvedCdn || discovered || getCurrentCdn() || activeCdnList[0] || PREFERRED_CDN_LIST[0] || null
}

// PCDN 特化路徑：路徑以 /v1/resource 開頭的 MCDN / IP:Port 型連結，是 B 站專門發給
// PCDN 節點用的網址格式，缺少 trid 等參數，換掉 host 之後正規 CDN 一律拒絕
// （無法靠改 host 重組成正常的 upos 網址）。
//
// 這裡原本沒有判斷路徑，只要 host 命中 mcdn/szbdyd 就直接換 host —— 換出來的網址
// 必定失敗，播放器要等這次請求失敗、再依序去試 backup_url，起播因此多等好幾秒。
// 症狀正好是「偶爾某幾部影片點進去特別慢」（B 站分配 PCDN 是隨機的，只有被分到
// PCDN 的片子會中）。
//
// 正確處理：直接放行不改寫，讓播放器自己走它原本的 backup 流程 —— 那條路徑至少
// 網址是合法的，比我們改出一條必死的網址快得多。真正的解法是在 playurl 階段就從
// backup_url 挑一條原生 Mirror 型連結當主流（未實作，見改進工單）。
const PCDN_RESOURCE_PATH = /^\/v1\/resource/

// v1.3.3：抽成共用判斷式。守門一定要放在「所有改 host 的唯一出入口」，只在
// rewriteUnstableMediaUrl 擋一次是不夠的 —— 同一條網址走到 normalizeMediaUrl 的
// 「一般白名單」分支照樣會被改壞：/v1/resource/xxx.m4s 的路徑以 .m4s 結尾，
// isBiliFragmentUrl() 會成立，接著 needsRedirect() 也成立（PCDN host 本來就不在
// 白名單），於是又被 replaceUrlHost 改了一次。playurl 層（transformStreamItem）
// 更是完全不經過 rewriteUnstableMediaUrl，有同樣的漏洞。
// indexOf 快篩很重要：sanitizePlayInfoUrls 會走訪整包 playurl 回應的幾百個字串欄位，
// 每個都做 new URL() 成本會被放大。
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
        if (!u || decideMediaRewrite(urlStr).action !== 'rewrite') return null
        const delivery = classifyMediaDelivery(urlStr)
        if (delivery.kind === 'suspected-pcdn') {
            redirectStats.pcdnSuspectedPort = Math.min(10000, (redirectStats.pcdnSuspectedPort || 0) + 1)
            return null
        }
        if (delivery.kind === 'live') return null
        if (delivery.kind !== 'pcdn' && !isUnstableCdnHost(u.hostname)) return null
        if (delivery.kind === 'pcdn') redirectStats.pcdnExplicit = Math.min(10000, (redirectStats.pcdnExplicit || 0) + 1)

        // ★ v1.3.3：PCDN 特化路徑不可改寫（見上方說明），放行並計數供診斷觀察
        if (PCDN_RESOURCE_PATH.test(u.pathname)) {
            redirectStats.pcdnSkipped++
            return null
        }

        let targetHost = getFallbackCdnHost()

        if (u.hostname.endsWith('.szbdyd.com')) {
            const usource = u.searchParams.get('xy_usource')
            if (usource) {
                let h = usource.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0]
                if (isValidCustomCdnHost(h) && !isUnstableCdnHost(h) && !needsRedirect(h)) targetHost = h
            }
        }

        if (!isValidCustomCdnHost(targetHost)) return null
        return replaceUrlHost(urlStr, targetHost)
    } catch {
        return null
    }
}

const redirectStats = {
    unstable: 0,
    pcdnExplicit: 0,
    pcdnSuspectedPort: 0,
    liveSkipped: 0,
    partialProbeSamples: 0,
    // v1.3.3：命中 /v1/resource 而「刻意不改寫」的次數。數字持續增加代表你的網路
    // 環境常被分配到 PCDN —— 這正是舊版會改壞、造成偶發起播變慢的那類連結。
    pcdnSkipped: 0,
    // 2026-08-20：這條串流「換 host 會被 403 拒絕」而刻意不改寫、也不賽馬的次數。
    // 數字 > 0 代表你遇到了 os=<節點>bv 這種綁定節點的簽名（見 hostLockedStreams）。
    hostLocked: 0,
    whitelist: 0,
    httpdns: 0,
    httpdnsAllowed: 0,
    httpdnsAutoSwitch: 0,
    quietRedirects: 0,
}

// ── Segment 位元組計數去重 ────────────────────────────────────────────
// 實測：bilivideo.com 的 m4s/flv 走 Range/206 跨源 XHR，Chrome 在這個情境下
// PerformanceResourceTiming 的 transferSize/encodedBodySize 經常回報 0（即使伺服器
// 有送 Timing-Allow-Origin），導致 Watchdog 完全抓不到下載量 → 面板永遠「緩衝 0%」、
// bps 判斷永遠對 4K 半盲、CDN 吞吐評分永遠沒有真實樣本。改為在 XHR/fetch 攔截層直接
// 用 content-length / response 大小量測真實位元組（見下方 send()/fetch() 攔截），
// PerformanceObserver 僅作為那條路徑量到值時的補位，用這組去重避免同一個 segment 被算兩次。
const segmentByteAccountedUrls = new Map()
const SEGMENT_DEDUP_WINDOW_MS = 5000
const segmentDedupKey = (url) => {
    try { return new URL(url).href } catch { return String(url || '') }
}
const noteSegmentAccounted = (url) => {
    if (!url) return
    const now = Date.now()
    segmentByteAccountedUrls.set(segmentDedupKey(url), now)
    if (segmentByteAccountedUrls.size > 64) {
        segmentByteAccountedUrls.forEach((t, u) => {
            if (now - t > SEGMENT_DEDUP_WINDOW_MS) segmentByteAccountedUrls.delete(u)
        })
    }
}
const wasSegmentAccounted = (url) => {
    const t = url && segmentByteAccountedUrls.get(segmentDedupKey(url))
    return !!t && (Date.now() - t < SEGMENT_DEDUP_WINDOW_MS)
}

// XHR 版：直接從 response 量真實位元組（content-length 優先，量不到才退回 response 大小），
// 不依賴不可靠的 PerformanceResourceTiming。同時餵給 Watchdog（面板 MB/bps 判斷）與
// recordCdnThroughput（CDN 吞吐評分），並標記去重避免 onEntry() 又重算一次。
// alreadyReportedBytes：send() 裡的 progress 事件已經即時、逐步回報過的量（見下方），
// 這裡只把「還沒被 progress 算過的尾巴」補給 Watchdog，避免同一個 segment 被算兩次；
// recordCdnThroughput 仍用完整 bytes + 真正的下載耗時（startedAt→現在）算吞吐分數。
const noteSegmentBytes = (cdn, xhr, startedAt, url, alreadyReportedBytes, runtimeToken, mediaContext) => {
    if (!cdn || disabled || (runtimeToken && !isRuntimeGenerationActive(runtimeToken))) return
    try {
        let bytes = 0
        const cl = xhr.getResponseHeader && xhr.getResponseHeader('content-length')
        if (cl) bytes = parseInt(cl, 10) || 0
        if (!bytes) {
            try {
                const r = xhr.response
                if (r && typeof r.byteLength === 'number') bytes = r.byteLength
                else if (r && typeof r.size === 'number') bytes = r.size // Blob（responseType: 'blob'）
                else if ((xhr.responseType === '' || xhr.responseType === 'text') && typeof xhr.responseText === 'string') {
                    bytes = xhr.responseText.length
                }
            } catch {}
        }
        if (!bytes) return
        const durationMs = Math.max(1, Date.now() - startedAt)
        const remaining  = Math.max(0, bytes - (alreadyReportedBytes || 0))
        if (remaining) {
            observeMediaTransfer(mediaContext, xhr.responseURL || url, remaining, 'xhr')
            Watchdog.noteExternalBytes(cdn, remaining)
        }
        recordCdnThroughput(cdn, bytes, durationMs, playbackRateState.effectiveRate)
        noteSegmentAccounted(url)
        if (xhr.responseURL && xhr.responseURL !== url) noteSegmentAccounted(xhr.responseURL)
    } catch {}
}

// 緩衝目標依碼率動態調整；未知碼率時使用保守預設。
const DEFAULT_BUFFER_TARGET_BYTES = 20 * 1024 * 1024
const MIN_BUFFER_TARGET_BYTES = 16 * 1024 * 1024
const MAX_BUFFER_TARGET_BYTES = 160 * 1024 * 1024
let baseBufferTargetBytes = DEFAULT_BUFFER_TARGET_BYTES

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const setBufferTargetFromBitrate = (totalBitsPerSec, isHighBitrate) => {
    if (!totalBitsPerSec || !Number.isFinite(totalBitsPerSec)) return
    currentStreamBitsPerSec = totalBitsPerSec
    // 高碼率（4K/高 fps）多存一點，下載速度暫時掉下去也有緩衝可以撐
    const targetSeconds = isHighBitrate ? 45 : 20
    baseBufferTargetBytes = clamp(
        (totalBitsPerSec / 8) * targetSeconds,
        MIN_BUFFER_TARGET_BYTES,
        MAX_BUFFER_TARGET_BYTES
    )
}

const getBufferTargetBytes = (playbackRate) => {
    const rate = getEffectivePlaybackRate(playbackRate)
    return clamp(baseBufferTargetBytes * rate, MIN_BUFFER_TARGET_BYTES, MAX_BUFFER_TARGET_BYTES)
}

// 高碼率分支在 v1.4.1 只使用原始串流碼率，2x 時會低估一半；保持 1x 完全不變，只補倍速因子。
const getWatchdogRequiredBps = (streamMbps, playbackRate, highBitrate) => highBitrate
    ? Math.max(0, Number(streamMbps) || 0) * getEffectivePlaybackRate(playbackRate) * 1e6 / 8
    : getRequiredStreamMbps(playbackRate, 'steady') * 1e6 / 8

// ── 實際播放畫質的碼率校正（v1.3.3）───────────────────────────────────
// 問題：currentStreamBitsPerSec 過去是用 playurl 清單裡「最高畫質」的 bandwidth 設定的
// （maxV + maxA），但那不是使用者實際在看的畫質。只要這支片「有提供」4K，即使實際播
// 1080p，這個值也會是 4K 的碼率。後果是連鎖的，而且全部指向同一個方向 —— 誤判：
//
//   1. Watchdog 的 highBitrate 恆為 true → 套用 4K 專用的嚴格門檻
//      （緩衝要 30 秒才算夠、連續 2 tick 就換節點）。
//   2. minBps 直接等於 4K 碼率 ÷ 8（約 2.5~4 MB/s）。實際播 1080p 的播放器
//      穩態只會拉約 0.5 MB/s —— 永遠低於門檻，tooSlow 恆成立。
//   3. 於是每隔幾秒就觸發一次 switchCdn：把當前節點軟隔離 10 分鐘、記一次 failures、
//      清掉 probe 快取、重建連線。連續幾輪就能把手上所有好節點依序全部軟隔離掉。
//   4. 軟隔離會持續 10 分鐘、健康分數的懲罰更久 —— 所以災情會延續到「之後幾部片」，
//      表現出來就是「偶爾有幾部影片點進去特別慢」。
//
// 修法：用 <video>.videoHeight 反查對應的 representation 碼率。videoHeight 是播放器
// 實際解出來的畫面高度，切畫質、ABR 自動降級都會即時反映，比任何清單推測都準。
const REPRESENTATION_REGISTRY_MAX = 128
const AUDIO_REGISTRY_MAX = 64
const REPRESENTATION_OBSERVATION_TTL_MS = 30 * 1000
const representationRegistry = new Map()
const audioRepresentationRegistry = new Map()
const muxedRepresentationRegistry = new Map()
let playinfoEpoch = 0
let mediaObservations = { video: null, audio: null, muxed: null, unknown: null }
let lastVideoTransportObservation = null
let observedVideoRepresentation = null
let streamEstimate = { source: 'unknown', codec: 'other', height: 0, videoMbps: 0, audioMbps: 0 }
const resetMediaDelivery = () => {
    mediaObservations = { video: null, audio: null, muxed: null, unknown: null }
    lastVideoTransportObservation = null
    observedVideoRepresentation = null
}
const resetRepresentationRegistry = () => {
    playinfoEpoch++
    DiagnosticLog.boundary(runtimeGeneration, playinfoEpoch, 'epoch')
    representationRegistry.clear()
    audioRepresentationRegistry.clear()
    muxedRepresentationRegistry.clear()
    resetMediaDelivery()
}
const representationIdentity = (url) => {
    if (typeof url !== 'string' || !url || url.length > 16 * 1024) return ''
    try {
        const parsed = new URL(url, location.href)
        if (!/^https?:$/.test(parsed.protocol) || !isMediaSegmentUrl(parsed.href)) return ''
        return parsed.pathname + parsed.search
    } catch { return '' }
}
const registerMediaRepresentation = (registry, rep, kind, limit) => {
    const safeRep = {
        kind, height: Number.isFinite(+rep.height) ? Math.max(0, Math.trunc(+rep.height)) : 0,
        bandwidth: Number.isFinite(+rep.bandwidth) ? Math.max(0, +rep.bandwidth) : 0,
        codec: ['av1', 'hevc', 'avc'].includes(rep.codec) ? rep.codec : 'other',
    }
    ;(Array.isArray(rep.urls) ? rep.urls : []).forEach(url => {
        const key = representationIdentity(url)
        if (!key) return
        if (!registry.has(key) && registry.size >= limit) registry.delete(registry.keys().next().value)
        // Ambiguous identities remain unknown, even when repeated later in this epoch.
        if (registry.has(key) && JSON.stringify(registry.get(key)) !== JSON.stringify(safeRep)) registry.set(key, null)
        else registry.set(key, safeRep)
    })
}
const rebuildRepresentationRegistry = () => {
    resetRepresentationRegistry()
    if (!streamProfile || !Array.isArray(streamProfile.reps)) return
    streamProfile.reps.forEach(rep => {
        if (!rep || !Number.isFinite(+rep.bandwidth) || +rep.bandwidth <= 0) return
        registerMediaRepresentation(representationRegistry, rep, 'video', REPRESENTATION_REGISTRY_MAX)
    })
    ;(streamProfile.audioReps || []).forEach(rep => registerMediaRepresentation(audioRepresentationRegistry, rep, 'audio', AUDIO_REGISTRY_MAX))
}
const lookupMediaRepresentation = (url) => {
    const key = representationIdentity(url)
    if (!key) return null
    const matches = [representationRegistry, audioRepresentationRegistry, muxedRepresentationRegistry].filter(map => map.has(key))
    return matches.length === 1 ? matches[0].get(key) : null
}
const captureMediaRequest = (url, runtime = captureRuntimeGeneration()) => ({
    runtime, epoch: playinfoEpoch, rep: lookupMediaRepresentation(url),
})
const mediaContextActive = context => !!context && context.epoch === playinfoEpoch && isRuntimeGenerationActive(context.runtime)
const mediaHeightMatches = rep => {
    try {
        const video = Watchdog.getVideo()
        return !video || !video.videoHeight || !rep.height || Math.abs(rep.height - video.videoHeight) <= 16
    } catch { return false }
}
const noteObservedVideoRepresentation = (url, context = captureMediaRequest(url)) => {
    if (!mediaContextActive(context)) return false
    const rep = context.rep
    if (rep && rep.kind !== 'video') return false
    if (!rep) return false
    observedVideoRepresentation = {
        height: rep.height,
        bandwidth: rep.bandwidth,
        codec: rep.codec,
        observedAt: Date.now(),
    }
    return true
}
const observeMediaTransfer = (context, url, bytes, source) => {
    if (!mediaContextActive(context) || !Number.isSafeInteger(bytes) || bytes <= 0 || bytes > 256 * 1024 * 1024) return
    let host = '', classification = 'non-catalog'
    try {
        const parsed = new URL(url, location.href)
        if (!representationIdentity(parsed.href)) return
        host = parsed.hostname
        classification = classifyMediaDelivery(parsed.href).kind || 'non-catalog'
    } catch { return }
    const trustedHost = TRUSTED_CDN_CATALOG_SET.has(host) ? host : null
    // A redirect to an unrelated resource is not evidence for the original representation.
    const rep = lookupMediaRepresentation(url) === context.rep ? context.rep : null
    const kind = rep && ['video', 'audio', 'muxed'].includes(rep.kind) ? rep.kind : 'unknown'
    const observation = { host: trustedHost, classification: trustedHost ? 'catalog' :
        (classification === 'pcdn' || classification === 'suspected-pcdn' ? classification : 'non-catalog'),
        source, kind, height: rep?.height || 0, observedAt: Date.now(), bytes,
        generation: context.runtime.generation, epoch: context.epoch }
    const previous = mediaObservations[kind]
    if (previous && previous.host === observation.host && previous.source === source) {
        observation.bytes = Math.min(Number.MAX_SAFE_INTEGER, previous.bytes + bytes)
    }
    mediaObservations[kind] = observation
    if (kind === 'video' && mediaHeightMatches(rep)) {
        noteObservedVideoRepresentation(url, context)
        if (source === 'fetch' || source === 'xhr') lastVideoTransportObservation = observation
    }
}
const freshMediaObservation = observation => !!observation && !disabled
    && observation.generation === runtimeGeneration && observation.epoch === playinfoEpoch
    && Date.now() - observation.observedAt >= 0 && Date.now() - observation.observedAt <= REPRESENTATION_OBSERVATION_TTL_MS
    && (observation.kind !== 'video' || mediaHeightMatches(observation))
const getAttributedVideoHost = () => freshMediaObservation(lastVideoTransportObservation)
    ? lastVideoTransportObservation.host : null
const getMediaDeliverySnapshot = () => Object.fromEntries(Object.entries(mediaObservations).map(([kind, observation]) => [kind,
    observation ? { host: observation.host, classification: observation.classification, source: observation.source,
        ageSec: Math.max(0, Math.round((Date.now() - observation.observedAt) / 1000)),
        bytes: observation.bytes, fresh: freshMediaObservation(observation) }
        : { host: null, classification: 'unknown', source: 'none', ageSec: null, bytes: 0, fresh: false },
]))
let playbackQualityBaseline = null
let playbackQualitySnapshot = { available: false, totalFrames: null, droppedFrames: null, droppedPercent: null }
const resetPlaybackQuality = () => {
    playbackQualityBaseline = null
    playbackQualitySnapshot = { available: false, totalFrames: null, droppedFrames: null, droppedPercent: null }
}
const samplePlaybackQuality = () => {
    if (disabled) { resetPlaybackQuality(); return }
    try {
        const video = Watchdog.getVideo()
        if (!video || typeof video.getVideoPlaybackQuality !== 'function') { resetPlaybackQuality(); return }
        const result = video.getVideoPlaybackQuality()
        const total = result.totalVideoFrames, dropped = result.droppedVideoFrames
        if (![total, dropped].every(n => Number.isSafeInteger(n) && n >= 0) || dropped > total) {
            resetPlaybackQuality(); return
        }
        let baseline = playbackQualityBaseline
        if (!baseline || baseline.video !== video || baseline.generation !== runtimeGeneration
            || total < baseline.lastTotal || dropped < baseline.lastDropped) {
            baseline = playbackQualityBaseline = { video, generation: runtimeGeneration, total, dropped,
                lastTotal: total, lastDropped: dropped, since: Date.now() }
        }
        baseline.lastTotal = total; baseline.lastDropped = dropped
        const totalFrames = total - baseline.total, droppedFrames = dropped - baseline.dropped
        if (droppedFrames > totalFrames) { resetPlaybackQuality(); return }
        playbackQualitySnapshot = { available: true, totalFrames, droppedFrames,
            droppedPercent: totalFrames ? +(droppedFrames * 100 / totalFrames).toFixed(3) : 0,
            observedSec: Math.max(0, Math.round((Date.now() - baseline.since) / 1000)) }
    } catch { resetPlaybackQuality() }
}
const syncStreamBitrateFromVideo = (videoEl) => {
    if (!streamProfile || !streamProfile.reps.length || !videoEl) return
    const h = videoEl.videoHeight || 0
    if (!h) return   // 起播初期還沒解出畫面，維持原估計值（Watchdog 此時也還在 grace 期）

    let bestDiff = Infinity, bestBps = 0, selectedCodec = 'other', estimateSource = 'conservative-height-max'
    const observed = observedVideoRepresentation
    if (observed && Date.now() - observed.observedAt <= REPRESENTATION_OBSERVATION_TTL_MS
        && Math.abs(observed.height - h) <= 16) {
        bestDiff = Math.abs(observed.height - h)
        bestBps = observed.bandwidth
        selectedCodec = observed.codec
        estimateSource = 'observed-representation'
    }
    for (const r of streamProfile.reps) {
        const diff = Math.abs(r.height - h)
        // 同一個高度可能有多個 codec（AVC/HEVC/AV1）碼率不同；取較大的那個，
        // 寧可略為高估也不要低估到讓 Watchdog 對真正的卡頓變遲鈍。
        if (estimateSource !== 'observed-representation'
            && (diff < bestDiff || (diff === bestDiff && r.bandwidth > bestBps))) {
            bestDiff = diff
            bestBps  = r.bandwidth
            selectedCodec = ['av1', 'hevc', 'avc'].includes(r.codec) ? r.codec : 'other'
        }
    }
    if (!bestBps) return

    const total = bestBps + (streamProfile.audioBps || 0)
    streamEstimate = {
        source: estimateSource,
        codec: selectedCodec,
        height: Math.max(0, Math.trunc(h)),
        videoMbps: +(bestBps / 1e6).toFixed(3),
        audioMbps: +((streamProfile.audioBps || 0) / 1e6).toFixed(3),
    }
    // 變動小於 5% 就不動，避免每秒重算緩衝目標造成 reached 狀態抖動
    if (currentStreamBitsPerSec > 0 && Math.abs(total - currentStreamBitsPerSec) < currentStreamBitsPerSec * 0.05) return
    setBufferTargetFromBitrate(total, total > 12e6)
}

// SPA 換片時呼叫：舊片的碼率不能留給新片用。從 4K 片切到低碼率片而沒重置的話，
// 新片會沿用舊片的高門檻，重演上面那串誤判；反之從低碼率切到 4K 則會反應遲鈍。
const resetStreamProfile = () => {
    clearCodecPlayinfo()
    // 綁定節點是「這支影片這次簽發」的性質，換片就要重新給機會，不能一路沿用
    hostLockedStreams.clear()
    preservedOriginalStreamUrls.clear()
    rewrittenStreamOrigins.clear()
    resetRepresentationRegistry()
    streamEstimate = { source: 'unknown', codec: 'other', height: 0, videoMbps: 0, audioMbps: 0 }
    streamProfile = null
    currentStreamBitsPerSec = 0
    baseBufferTargetBytes = DEFAULT_BUFFER_TARGET_BYTES
    seekGraceUntil = 0
    resetPlaybackRateState()
}

// ── HTTPDNS AutoPilot：短測 10 分鐘 → 評分 → 記憶網路環境（最長 6 小時）────────
const HTTPDNS_PROFILE_KEY = 'httpdnsProfile_v2'
const HTTPDNS_STATE_KEY   = 'httpdnsAutoState_v2'
const HTTPDNS_TRIAL_MS    = 10 * 60 * 1000
const HTTPDNS_COMMIT_MS   = 6 * 60 * 60 * 1000
const HTTPDNS_PROFILE_TTL = 7 * 24 * 60 * 60 * 1000
const HTTPDNS_SCORE_MARGIN = 10   // 在新的 0~100+ 級距下 = 滿分的 10%，才有實際判斷意義

const normalizeHttpDnsMode = (mode) =>
    (mode === true || mode === false || mode === 'auto') ? mode : 'auto'

let httpDnsMode = normalizeHttpDnsMode(BlockHttpDNS)

const HttpDnsAutoPilot = (() => {
    const getNetworkKey = () => {
        const tz = (() => {
            try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown' } catch { return 'unknown' }
        })()
        const lang = (navigator.language || 'en').slice(0, 5)
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection
        const type = conn ? (conn.effectiveType || conn.type || 'unknown') : 'unknown'
        const downlink = conn && conn.downlink ? String(Math.round(conn.downlink)) : 'x'
        return [tz, lang, type, downlink].join('|')
    }

    // 改成「達成率」而非絕對速度：直接用 Mbps×100 當分數時，正常 4K 播放輕鬆到 300~500 分，
    // 卡頓只扣 50 分等於總分的 10~15%——代價太便宜；而且高碼率片跟低碼率片的分數天生不可比，
    // 混在同一個 blockAvg/allowAvg 平均裡會失真。改成相對於「這支片子實際需要的速度」計算。
    const computeScore = (m) => {
        const elapsedSec = Math.max(1, m.elapsedSec || 1)
        const actualMbps = ((m.totalBytes || 0) * 8) / 1e6 / elapsedSec   // 之前誤標成 Mbps 的其實是 MiB/s
        const needMbps   = Math.max(1.5, getRequiredStreamMbps())
        // 達成率封頂 1.2（超過需求 20% 就算滿分），避免高碼率片主導平均
        const ratio = Math.min(1.2, actualMbps / needMbps)
        const score = ratio * 100
            - (m.stallEvents   || 0) * 25
            - (m.hardFailCount || 0) * 40
            - (m.switchCount   || 0) * 15
            + (m.reachedTarget ? 10 : 0)
        return Math.round(score * 10) / 10
    }

    const emptyProfile = (networkKey) => ({
        networkKey,
        blockAvg: 0,
        allowAvg: 0,
        blockSamples: 0,
        allowSamples: 0,
        decision: 'undecided',
        decisionUntil: 0,
        updatedAt: Date.now(),
    })

    const loadProfile = () => {
        const networkKey = getNetworkKey()
        try {
            const raw = JSON.parse(GM_getValue(HTTPDNS_PROFILE_KEY) || '{}')
            if (raw.networkKey === networkKey && (Date.now() - (raw.updatedAt || 0)) < HTTPDNS_PROFILE_TTL) {
                return raw
            }
        } catch {}
        return emptyProfile(networkKey)
    }

    let profile = loadProfile()

    const saveProfile = () => {
        profile.updatedAt = Date.now()
        profile.networkKey = getNetworkKey()
        try { GM_setValue(HTTPDNS_PROFILE_KEY, JSON.stringify(profile)) } catch {}
    }

    const loadAutoState = () => {
        try {
            const raw = JSON.parse(GM_getValue(HTTPDNS_STATE_KEY) || '{}')
            return {
                phase:           raw.phase || 'none',
                allowUntil:      Number(raw.allowUntil) || 0,
                trialStartedAt:  Number(raw.trialStartedAt) || 0,
                trialScore:      Number(raw.trialScore) || 0,
                lastReason:      raw.lastReason || '',
                lastChangedAt:   Number(raw.lastChangedAt) || 0,
            }
        } catch {
            return { phase: 'none', allowUntil: 0, trialStartedAt: 0, trialScore: 0, lastReason: '', lastChangedAt: 0 }
        }
    }

    let autoState = loadAutoState()

    const saveAutoState = () => {
        try { GM_setValue(HTTPDNS_STATE_KEY, JSON.stringify(autoState)) } catch {}
    }

    // 進入 trial-allow 時記錄 watchdog 累計快照，
    // 結算時用 delta 算分，避免混入 trial 之前的播放數據。
    let trialBaseline = null

    const subtractBaseline = (sample, baseline) => {
        if (!baseline) return sample
        // SPA 換片時 Watchdog.reset() 會把累計數字歸零，sample 會比換片前的 baseline 還小；
        // 相減後全部被 Math.max(0, ...) 夾成 0，trial 必定判定失敗。偵測到這種情況直接用
        // sample 原值（等於放棄扣除舊 baseline，換片後的這一小段當作獨立樣本看待）。
        if ((sample.totalBytes || 0) < (baseline.totalBytes || 0)) return sample
        return {
            totalBytes:    Math.max(0, (sample.totalBytes    || 0) - (baseline.totalBytes    || 0)),
            stallEvents:   Math.max(0, (sample.stallEvents   || 0) - (baseline.stallEvents   || 0)),
            switchCount:   Math.max(0, (sample.switchCount   || 0) - (baseline.switchCount   || 0)),
            hardFailCount: Math.max(0, (sample.hardFailCount || 0) - (baseline.hardFailCount || 0)),
            elapsedSec:    Math.max(1, (sample.elapsedSec    || 1) - (baseline.elapsedSec    || 0)),
            reachedTarget: !!sample.reachedTarget,
        }
    }

    const mergeAvg = (prevAvg, prevN, score) => {
        const n = prevN + 1
        return { avg: Math.round(((prevAvg * prevN) + score) / n * 10) / 10, n }
    }

    const recordSample = (strategy, sample) => {
        const score = computeScore(sample)
        if (strategy === 'allow') {
            const m = mergeAvg(profile.allowAvg, profile.allowSamples, score)
            profile.allowAvg = m.avg
            profile.allowSamples = m.n
        } else {
            const m = mergeAvg(profile.blockAvg, profile.blockSamples, score)
            profile.blockAvg = m.avg
            profile.blockSamples = m.n
        }
        saveProfile()
        return score
    }

    const commitDecision = (decision, reason, score) => {
        profile.decision = decision
        profile.decisionUntil = Date.now() + HTTPDNS_COMMIT_MS
        profile.updatedAt = Date.now()
        saveProfile()
        autoState = {
            phase: decision === 'allow' ? 'committed-allow' : 'none',
            allowUntil: decision === 'allow' ? profile.decisionUntil : 0,
            trialStartedAt: 0,
            trialScore: score || 0,
            lastReason: reason,
            lastChangedAt: Date.now(),
        }
        saveAutoState()
    }

    const startTrialAllow = (reason, baseline) => {
        trialBaseline = baseline ? { ...baseline } : null
        autoState = {
            phase: 'trial-allow',
            allowUntil: Date.now() + HTTPDNS_TRIAL_MS,
            trialStartedAt: Date.now(),
            trialScore: 0,
            lastReason: reason || 'playback-stall',
            lastChangedAt: Date.now(),
        }
        redirectStats.httpdnsAutoSwitch++
        saveAutoState()
        try { GM_deleteValue(PROBE_CACHE_KEY) } catch {}
    }

    const endTrialAllow = (reason, sample) => {
        const trialSample = subtractBaseline(sample, trialBaseline)
        const allowScore = recordSample('allow', trialSample)
        autoState.trialScore = allowScore
        const blockRef = profile.blockAvg || 0
        const pass = allowScore >= blockRef + HTTPDNS_SCORE_MARGIN
        if (pass) {
            commitDecision('allow', 'trial-pass:' + (reason || 'score'), allowScore)
        } else {
            commitDecision('block', 'trial-fail:' + (reason || 'score'), allowScore)
        }
        trialBaseline = null
        redirectStats.httpdnsAutoSwitch++
    }

    const isTrialAllowing = () =>
        httpDnsMode === 'auto'
        && (autoState.phase === 'trial-allow' || autoState.phase === 'committed-allow')
        && autoState.allowUntil > Date.now()

    const isProfileAllowing = () =>
        httpDnsMode === 'auto'
        && profile.decision === 'allow'
        && profile.decisionUntil > Date.now()

    const shouldBlock = () => {
        if (httpDnsMode === true) return true
        if (httpDnsMode === false) return false
        if (isTrialAllowing() || isProfileAllowing()) return false
        return true
    }

    const getStatus = () => {
        const networkKey = getNetworkKey()
        if (httpDnsMode === true) {
            return { mode: 'force-block', block: true, ttlMin: 0, networkKey, scores: { block: profile.blockAvg, allow: profile.allowAvg } }
        }
        if (httpDnsMode === false) {
            return { mode: 'force-allow', block: false, ttlMin: 0, networkKey, scores: { block: profile.blockAvg, allow: profile.allowAvg } }
        }
        const ttlMin = autoState.allowUntil > Date.now()
            ? Math.max(0, Math.ceil((autoState.allowUntil - Date.now()) / 60000))
            : (profile.decisionUntil > Date.now()
                ? Math.max(0, Math.ceil((profile.decisionUntil - Date.now()) / 60000))
                : 0)
        let mode = 'auto-block'
        if (autoState.phase === 'trial-allow' && isTrialAllowing()) mode = 'auto-trial-allow'
        else if (autoState.phase === 'committed-allow' && isTrialAllowing()) mode = 'auto-allow'
        else if (isProfileAllowing()) mode = 'auto-allow-memory'
        return {
            mode,
            block: shouldBlock(),
            ttlMin,
            reason: autoState.lastReason || profile.decision,
            networkKey,
            scores: {
                block: profile.blockAvg,
                allow: profile.allowAvg,
                blockSamples: profile.blockSamples,
                allowSamples: profile.allowSamples,
                trial: autoState.trialScore || null,
            },
            decision: profile.decision,
        }
    }

    const onStall = (reason, watchdogStats) => {
        if (httpDnsMode !== 'auto') return false
        const sample = {
            totalBytes: watchdogStats.totalBytes || 0,
            stallEvents: (watchdogStats.stallEvents || 0) + 1,
            switchCount: watchdogStats.switchCount || 0,
            hardFailCount: watchdogStats.hardFailCount || 0,
            elapsedSec: watchdogStats.elapsedSec || 1,
            reachedTarget: false,
        }
        if (isTrialAllowing()) {
            // trial 期間又卡頓：用 delta 結算 allow 分數後立刻判 block
            const trialSample = subtractBaseline(sample, trialBaseline)
            const score = recordSample('allow', trialSample)
            autoState.trialScore = score
            commitDecision('block', 'trial-stall:' + reason, score)
            trialBaseline = null
            redirectStats.httpdnsAutoSwitch++
            return true
        }
        if (shouldBlock() && redirectStats.httpdns > 0) {
            // 先把目前 block 期間累計值入帳，再以此為 baseline 啟動 trial allow
            recordSample('block', sample)
            startTrialAllow(reason, sample)
            return true
        }
        return false
    }

    const onTargetReached = (watchdogStats) => {
        if (httpDnsMode !== 'auto') return
        const sample = {
            totalBytes: watchdogStats.totalBytes || 0,
            stallEvents: watchdogStats.stallEvents || 0,
            switchCount: watchdogStats.switchCount || 0,
            hardFailCount: watchdogStats.hardFailCount || 0,
            elapsedSec: watchdogStats.elapsedSec || 1,
            reachedTarget: true,
        }
        if (autoState.phase === 'trial-allow' && autoState.trialStartedAt > 0) {
            endTrialAllow('target-reached', sample)
            return
        }
        // 非 trial：直接以 watchdog 累計值（自 start 起）做粗略 sample 記分
        recordSample(shouldBlock() ? 'block' : 'allow', sample)
    }

    const tick = (watchdogStats) => {
        if (httpDnsMode !== 'auto') return
        if (autoState.phase !== 'trial-allow') return
        if (autoState.allowUntil > Date.now()) return
        const sample = {
            totalBytes: watchdogStats.totalBytes || 0,
            stallEvents: watchdogStats.stallEvents || 0,
            switchCount: watchdogStats.switchCount || 0,
            hardFailCount: watchdogStats.hardFailCount || 0,
            elapsedSec: watchdogStats.elapsedSec || 1,
            reachedTarget: watchdogStats.reachedTarget || false,
        }
        endTrialAllow('trial-timeout', sample)
    }

    const reset = () => {
        profile = emptyProfile(getNetworkKey())
        saveProfile()
        autoState = { phase: 'none', allowUntil: 0, trialStartedAt: 0, trialScore: 0, lastReason: '', lastChangedAt: Date.now() }
        saveAutoState()
        trialBaseline = null
    }

    const setMode = (mode) => {
        httpDnsMode = normalizeHttpDnsMode(mode)
        BlockHttpDNS = httpDnsMode
        if (httpDnsMode !== 'auto') reset()
        return getStatus()
    }

    // SPA 換片時 Watchdog.reset() 會把累計數字歸零；trial-allow 期間如果不管它，
    // 下一次結算會拿「換片前的大 baseline」對「換片後才剛開始累計的小 sample」相減，
    // trial 幾乎必然被判定失敗。換片時把這場 trial 的 baseline 歸零重打、觀察窗往後
    // 延一整個 HTTPDNS_TRIAL_MS，讓新片有完整的觀察時間，而不是被腰斬。
    //
    // 但這個展延不能無上限：如果使用者一直看短片、換片間隔小於 HTTPDNS_TRIAL_MS，
    // 每次換片都會把 allowUntil 再往後推一整輪，trial-allow 可能永遠展延、永遠
    // 走不到 tick() 的逾時判斷，autopilot 對這種使用模式就永遠學不到 allow/block
    // 決策（期間會一直維持在「允許 HTTPDNS」，即使實際上該擋）。改成從「這場 trial
    // 最早開始」算起設一個總長上限，展延到頂了就讓它照原訂時間結算，用當下這小段
    // 的樣本判一次，總比永遠卡在 trial-allow 不結算好。
    const HTTPDNS_TRIAL_MAX_MS = HTTPDNS_TRIAL_MS * 3
    const onWatchdogReset = () => {
        if (autoState.phase !== 'trial-allow') return
        trialBaseline = { totalBytes: 0, stallEvents: 0, switchCount: 0, hardFailCount: 0, elapsedSec: 0 }
        const trialStart = autoState.trialStartedAt || Date.now()
        autoState.allowUntil = Math.min(Date.now() + HTTPDNS_TRIAL_MS, trialStart + HTTPDNS_TRIAL_MAX_MS)
        autoState.trialStartedAt = trialStart
        saveAutoState()
    }

    return {
        shouldBlock,
        getStatus,
        onStall,
        onTargetReached,
        tick,
        reset,
        setMode,
        onWatchdogReset,
    }
})()

const getHttpDnsStatus = () => HttpDnsAutoPilot.getStatus()
const shouldBlockHttpDns = () => HttpDnsAutoPilot.shouldBlock()
const setHttpDnsMode = (mode) => HttpDnsAutoPilot.setMode(mode)

// 重導 media segment URL（不穩定節點 → 白名單）
const normalizeMediaUrl = (urlStr) => {
    const decision = decideMediaRewrite(urlStr, true)
    if (decision.action !== 'rewrite') {
        if (decision.reason === 'live') redirectStats.liveSkipped = Math.min(10000, redirectStats.liveSkipped + 1)
        if (decision.reason === 'suspected-pcdn') redirectStats.pcdnSuspectedPort = Math.min(10000, redirectStats.pcdnSuspectedPort + 1)
        return { url: decision.url, changed: decision.action === 'restore', restoredOriginal: decision.action === 'restore',
            originCdn: parseMediaHttpUrl(urlStr)?.hostname, targetCdn: parseMediaHttpUrl(decision.url)?.hostname }
    }

    const delivery = classifyMediaDelivery(urlStr)
    if (delivery.kind === 'live') {
        redirectStats.liveSkipped = Math.min(10000, (redirectStats.liveSkipped || 0) + 1)
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

    const unstableUrl = rewriteUnstableMediaUrl(urlStr)
    if (unstableUrl && unstableUrl !== urlStr) {
        redirectStats.unstable++
        let originCdn = '?', targetCdn = '?'
        try {
            originCdn = new URL(urlStr).hostname
            targetCdn = new URL(unstableUrl).hostname
        } catch {}
        logRedirect('不穩定', originCdn, targetCdn, 'MCDN/PCDN')
        return { url: unstableUrl, changed: true, originCdn, targetCdn }
    }

    if (isAkamaiUrl(urlStr)) {
        let originCdn = null
        try { originCdn = new URL(urlStr).hostname } catch {}
        if (!originCdn || !isForcedRedirect(originCdn)) return { url: urlStr, changed: false, originCdn }
        const bestCdn = getCurrentCdn()
        const newUrl = bestCdn ? replaceUrlHost(urlStr, bestCdn) : null
        if (!newUrl || newUrl === urlStr) return { url: urlStr, changed: false, originCdn }
        redirectStats.whitelist++
        logRedirect('Transport', originCdn, bestCdn, 'Akamai 失敗後改寫')
        return { url: newUrl, changed: true, originCdn, targetCdn: bestCdn }
    }

    if (!isBiliFragmentUrl(urlStr)) return { url: urlStr, changed: false }

    const originCdn = getBiliVideoCdn(urlStr)
    if (!needsRedirect(originCdn)) return { url: urlStr, changed: false, originCdn }

    // seek 期間：只改寫「必須改」的 host（排除/黑名單/死節點/不穩定），
    // 其餘 backup 先放行，避免改 host 導致 player abort 再重拉（log 裡 FragmentLoadingAbandoned 連發的主因之一）。
    if (inSeekGrace()) {
        const mustFix = matchesExclude(originCdn) || knownDeadHosts.has(originCdn)
            || blacklistSet.has(originCdn) || isUnstableCdnHost(originCdn)
            || isForcedRedirect(originCdn)
        if (!mustFix) return { url: urlStr, changed: false, originCdn }
    }

    const bestCdn = getCurrentCdn()
    if (!bestCdn || bestCdn === originCdn) return { url: urlStr, changed: false, originCdn }

    const newUrl = replaceUrlHost(urlStr, bestCdn)
    if (!newUrl || newUrl === urlStr) return { url: urlStr, changed: false, originCdn }

    redirectStats.whitelist++
    logRedirect('Transport', originCdn, bestCdn,
        blacklistSet.has(originCdn) ? '黑名單' : '非白名單')
    return { url: newUrl, changed: true, originCdn, targetCdn: bestCdn }
}

const isMediaSegmentUrl = (url) => {
    if (!url) return false
    const delivery = classifyMediaDelivery(url)
    if (delivery.kind === 'pcdn' || delivery.kind === 'suspected-pcdn' || delivery.kind === 'live') return true
    if (isBiliFragmentUrl(url)) return true
    try {
        const u = parseMediaHttpUrl(url)
        if (!u) return false
        const host = u.hostname
        if (isUnstableCdnHost(host)) return true
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

// 重導向 log 節流：同 channel|origin|target 5 秒內只印一次，累計次數
const _redirectLogTs = {}
const _redirectLogTotal = {}
const REDIRECT_LOG_COOLDOWN = 5000
const QUIET_REDIRECT_AFTER = 3
const QUIET_REDIRECT_EVERY = 25
const logRedirect = (channel, originCdn, targetCdn, reason) => {
    DiagnosticLog.record('rewrite', { originalHost: originCdn, targetHost: targetCdn })
    const key = channel + '|' + (originCdn || '?') + '|' + targetCdn
    const now = Date.now()
    const last = _redirectLogTs[key] || 0
    const total = (_redirectLogTotal[key] || 0) + 1
    _redirectLogTotal[key] = total
    if (channel === 'Transport' && total > QUIET_REDIRECT_AFTER && total % QUIET_REDIRECT_EVERY !== 0) {
        redirectStats.quietRedirects++
        return
    }
    if (now - last < REDIRECT_LOG_COOLDOWN) return
    _redirectLogTs[key] = now
    // 這行原本漏掉了：整個函式維護了節流狀態（_redirectLogTs / _redirectLogTotal）、
    // 累計了 quietRedirects，卻從來沒有真的輸出過任何東西 —— 上面所有機制等於空轉，
    // reason 參數也完全沒被用到。log() 本身受 Config.verbose 控制，預設靜音，
    // 只有使用者主動由 Tampermonkey 選單開啟 verbose 排查時才會出現。
    log('[' + channel + '] ' + String(originCdn || '?').split('.')[0]
        + ' → ' + String(targetCdn || '?').split('.')[0]
        + '（' + reason + '，累計 ' + total + ' 次）')
}

// 非白名單 / 已黑名單 / 命中排除關鍵字 → 重導向
const needsRedirect = (cdn) => {
    if (!cdn) return false
    if (resolvedCdn && cdn === resolvedCdn) return false
    if (matchesExclude(cdn)) return true
    if (isForcedRedirect(cdn)) return true
    return knownDeadHosts.has(cdn) || blacklistSet.has(cdn) || isCdnStronglyBad(cdn) || !PREFERRED_CDN_LIST.includes(cdn)
}

// ── 綁定節點的串流（host-locked）────────────────────────────────────
// 有些 playurl 簽發的網址是**綁定特定節點**的：URL 上會帶 `os=<節點>bv`（例如 os=cosovbv），
// 換掉 host 之後**每一台都回 403**。使用者 2026-08-20 實測回報的就是這種串流：
// 賽馬把同一條 URL 換到 aliov / ali / cosov 三台，三台全部 403；而正常播放的改寫同樣會
// 403，播放器只能一路重試 backup_url —— 表現出來就是「十分不穩定」。
//
// 沒有辦法在**事前**可靠地判斷（實測過 os= 不同值時換 host 是可行的，並非全部綁定），
// 所以改成**學習**：任何一次「換 host 之後拿到 403」就把這條串流登記起來，
// 之後對它完全不改寫、也不賽馬，交還播放器用 B 站原本給的網址跑。
//
// key 優先用 `os` 參數（同一支影片的各種畫質共用同一個 os，一次學習全部適用），
// 沒有 os 就退回 pathname。SPA 換片時清空（新影片要重新給機會）。
const hostLockedStreams = new Set()
// 被選為改寫來源的原始 Bilibili URL 會保留在 backup_url 最後一位。若改寫後才學到
// host-locked，播放器仍有原始簽名 URL 可以退回；sanitizePlayInfoUrls 不得再把它改掉。
const preservedOriginalStreamUrls = new Set()
const rewrittenStreamOrigins = new Map()
const REWRITTEN_STREAM_ORIGIN_MAX = 512
const streamUrlIdentity = (urlStr) => {
    return parseMediaHttpUrl(urlStr)?.href || String(urlStr || '')
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
        const u = parseMediaHttpUrl(urlStr)
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
    redirectStats.hostLocked = (redirectStats.hostLocked || 0) + 1
    log('[綁定節點] 這條串流換 host 會被拒絕（403），之後不再改寫也不賽馬：' + k)
    return true
}

// Stateful main-thread decision; Worker uses the exact same stateless URL policy.
const decideMediaRewrite = (urlStr, preserveFallback = false) => {
    const decision = mediaUrlPolicy.decide(urlStr)
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
    const host = targetHost || getCurrentCdn()
    if (!isValidCustomCdnHost(host)) return null
    const u = parseMediaHttpUrl(urlStr)
    if (u.hostname === host) return urlStr
    u.hostname = host
    u.port = ''
    if (u.href.length > MEDIA_URL_MAX_LENGTH) return null
    return rememberRewrittenStreamUrl(u.toString(), urlStr)
}

// 建構 backup_url 陣列（Akamai 為主時也保留，player primary fail 才切）
const buildBackupUrls = (biliSrcUrl, primaryUrl) => {
    if (!biliSrcUrl || decideMediaRewrite(biliSrcUrl).action !== 'rewrite') return []
    let primaryHost, sourceHost
    try { primaryHost = new URL(primaryUrl || biliSrcUrl).hostname } catch { primaryHost = '' }
    try { sourceHost = new URL(biliSrcUrl).hostname } catch { sourceHost = '' }
    if (resolvedCdn) {
        const u = rememberRewrittenStreamUrl(replaceUrlHost(biliSrcUrl, resolvedCdn), biliSrcUrl)
        return u && u !== primaryUrl ? [u] : []
    }
    // backup 也用起播模式：主流失敗時會直接切到這裡，同樣禁不起「探索中獎」。
    return getHealthyCdnList(STARTUP_PICK)
        // 原始 host 由 withOriginalStreamFallback 保留在最後，不占用兩個替代 CDN 名額。
        .filter(cdn => cdn !== primaryHost && cdn !== sourceHost)
        .filter(cdn => !matchesExclude(cdn) && !knownDeadHosts.has(cdn) && !blacklistSet.has(cdn))
        .slice(0, 2)
        .map(cdn => rememberRewrittenStreamUrl(replaceUrlHost(biliSrcUrl, cdn), biliSrcUrl))
        .filter(Boolean)
}

// B 站長片/4K 有時會在深層欄位保留原始 backup URL；
// seek 到未載入區段時 player 會直接拿那些 URL 打，導致 Transport 連續補救。
const sanitizePlayInfoUrls = (root) => {
    const seen = new WeakSet()
    let changed = 0

    const rewrite = (value) => {
        if (typeof value !== 'string' || value.length < 12) return value
        // 便宜快篩：涵蓋 Bilibili CDN 與已知 PCDN 家族，省下對其餘文字欄位 new URL() 的成本。
        // playurl 回應在 4K 多畫質 + 多 backup 時可能有幾百個字串欄位，這個成本會被放大。
        if (!/(?:\.bilivideo\.|szbdyd\.com|mountaintoys\.cn|nexusedgeio\.com|ahdohpiechei\.com)/i.test(value)) return value
        const decision = decideMediaRewrite(value, true)
        if (decision.action !== 'rewrite') return decision.url
        if (!isBiliVideoUrl(value) || isAkamaiUrl(value)) return value
        const host = getBiliVideoCdn(value)
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

// 純函式：從 playurl API 回傳的 dash/durl item 找出候選網址（不含任何副作用/模組狀態，
// 只靠 isAkamaiUrl/isBiliVideoUrl 兩個同樣是純函式的判斷式）。改進工單 E：Bilibili 改版
// 最容易壞的就是這裡的欄位形狀（base_url/baseUrl、backup_url/backupUrl 是否為陣列、
// 是否存在），特地切成純函式，改版後能直接用單元測試 3 秒內確認沒把 dash/durl 其中一種
// 格式弄壞，不用等真的連上 Bilibili 播放才發現。
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
    const akamaiUrl  = validUrls.find(u => isAkamaiUrl(u) && mediaUrlPolicy.decide(u).action === 'rewrite')
    // v1.3.3：挑「要拿來改 host 的來源」時分兩段挑，對應社群整理的處理順序
    // （先找備援裡現成的 Mirror 型，找不到才退而求其次去改 host）：
    //   第一順位：不是 PCDN 特化路徑、host 也不是 MCDN/BCache 的 —— 這就是 Mirror 型，
    //             改 host 最安全，而且往往 backup_url 裡本來就有一條現成的。
    //   第二順位：至少路徑可改寫的（例如 BCache 型，改 host 是有效的）。
    // 兩者都沒有（整包只剩 /v1/resource 的 PCDN 特化網址）→ undefined，
    // transformStreamItem 就整個不動這個 item，讓播放器照它原本的流程走。
    const isRewritable = (u) => mediaUrlPolicy.decide(u).action === 'rewrite' && !isAkamaiUrl(u)
    const biliSrcUrl =
        validUrls.find(u => {
            if (!isRewritable(u)) return false
            try { return !isUnstableCdnHost(new URL(u).hostname) } catch { return false }
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

// 改寫 dash/durl item 的 base_url + backup_url
// 4K/高碼率：白名單 CDN 為主、Akamai 放 backup，避免首段大 fragment 卡在單一 Akamai。
// 一般碼率：來源含 Akamai 時仍優先 Akamai，純 bilivideo 則換成最佳白名單。
const transformStreamItem = (item, isDash) => {
    if (!item) return false
    isDash = isDash !== false

    const { validUrls, akamaiUrl, biliSrcUrl, preferWhitelistPrimary } = pickStreamUrls(item, isDash)

    validUrls.forEach(u => {
        try {
            const h = new URL(u).hostname
            if (!isUnstableCdnHost(h) && (h.endsWith('.bilivideo.com') || h.endsWith('.bilivideo.cn'))) {
                noteDiscoveredCdn(h)
            }
        } catch {}
    })

    if (!akamaiUrl && biliSrcUrl) {
        try {
            const srcHost = new URL(biliSrcUrl).hostname
            noteDiscoveredCdn(srcHost)
        } catch {}
    }

    if (akamaiUrl && !preferWhitelistPrimary) {
        if (isDash) { item.base_url = akamaiUrl; item.baseUrl = akamaiUrl }
        else         { item.url = akamaiUrl }
        // v1.3.3：buildBackupUrls 可能回空陣列（沒有可用的白名單候選、或來源是
        // 不可改寫的 PCDN 特化網址）。舊寫法會直接把空陣列蓋上去，等於把 B 站原本
        // 給的備援流全部刪掉 —— 主流一失敗就無路可退。空的就不動。
        const backups = withOriginalStreamFallback(buildBackupUrls(biliSrcUrl, akamaiUrl), biliSrcUrl, akamaiUrl)
        if (backups.length) {
            item.backup_url = backups
            item.backupUrl  = backups
        }
    } else if (biliSrcUrl) {
        // v1.3.3：這裡就是「使用者剛點進影片、正要起播」的那一刻，
        // 用 exploit 模式挑節點，不讓 UCB 的探索加成拿起播當賭注。
        const bestCdn = getCurrentCdn(STARTUP_PICK)
        const primUrl = bestCdn
            ? rememberRewrittenStreamUrl(replaceUrlHost(biliSrcUrl, bestCdn), biliSrcUrl)
            : biliSrcUrl
        if (primUrl) {
            if (isDash) { item.base_url = primUrl; item.baseUrl = primUrl }
            else         { item.url = primUrl }
        }
        // v1.3.3：同上，空陣列不覆蓋（見 Akamai 分支的說明）。
        let backups = buildBackupUrls(biliSrcUrl, primUrl || biliSrcUrl)
        if (akamaiUrl && !backups.includes(akamaiUrl)) {
            backups.unshift(akamaiUrl)
        }
        backups = withOriginalStreamFallback(backups, biliSrcUrl, primUrl || biliSrcUrl)
        if (backups.length) {
            item.backup_url = backups
            item.backupUrl  = backups
        }
    } else {
        return false
    }

    return !!akamaiUrl
}

const getDashCodecString = (item) => {
    const direct = String((item && (item.codecs || item.codec)) || '').trim()
    if (direct) return direct
    const mime = String((item && (item.mime_type || item.mimeType)) || '')
    const match = mime.match(/codecs\s*=\s*["']?\s*([^"',;\s]+)/i)
    return match ? match[1] : ''
}
const normalizeCodecName = (item) => {
    const codec = String(getDashCodecString(item)
        || (item && (item.mime_type || item.mimeType)) || '').toLowerCase()
    const codecid = Number(item && (item.codecid || item.codec_id || item.codecId))
    if (codec.includes('av01') || codecid === 13) return 'av1'
    if (codec.includes('hev1') || codec.includes('hvc1') || codecid === 12) return 'hevc'
    if (codec.includes('avc1') || codecid === 7) return 'avc'
    return 'other'
}

// MediaSource/canPlayType 回答 representation 能不能播；Media Capabilities 則補充是否
// supported/smooth/powerEfficient。後者缺失或尚未完成時維持「未知」，只有明確 false 才降級，
// 不用 UA 或顯卡型號猜測硬解能力。
const VIDEO_CODEC_PREFERENCES = Object.freeze(['av1', 'hevc', 'avc', 'auto'])
const resolvedVideoCodecPreference = VIDEO_CODEC_PREFERENCES.includes(PreferredVideoCodec)
    ? PreferredVideoCodec
    : 'hevc'
const CODEC_CAPABILITY_MAX = 128
const codecCapability = new Map() // Exact content configuration only; never URLs or GM data.
let codecQueryQueue = []
let codecQueriesInFlight = 0
let activeCodecConfigurations = []
let codecResumeItems = []
let lastCodecDecision = { preference: resolvedVideoCodecPreference, groups: [] }
const parseRepresentationFrameRate = value => {
    if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null
    if (typeof value !== 'string' || value.length > 64) return null
    const parts = value.trim().match(/^(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?$/)
    if (!parts) return null
    const n = Number(parts[1]) / (parts[2] === undefined ? 1 : Number(parts[2]))
    return Number.isFinite(n) && n > 0 ? n : null
}
const getRepresentationCodecConfig = item => {
    try {
        if (!item || typeof item !== 'object') return null
        const codec = getDashCodecString(item)
        const mime = String(item.mime_type || item.mimeType || '').split(';')[0].trim().toLowerCase()
        if (!codec || codec.length > 256 || !/^[a-z0-9._-]+$/i.test(codec)
            || mime.length > 128 || !/^video\/[a-z0-9.+-]+$/.test(mime)) return null
        const width = Number(item.width), height = Number(item.height), bitrate = Number(item.bandwidth)
        const framerate = parseRepresentationFrameRate(item.frame_rate ?? item.frameRate ?? item.framerate)
        if (![width, height, bitrate].every(n => Number.isSafeInteger(n) && n > 0)
            || width > 0xffffffff || height > 0xffffffff || !framerate) return null
        return { type: 'media-source', video: { contentType: mime + '; codecs="' + codec + '"', width, height, bitrate, framerate } }
    } catch { return null }
}
const codecConfigurationKey = item => {
    const config = getRepresentationCodecConfig(item)
    return config ? JSON.stringify(config) : ''
}
const summarizeCodecCapability = value => {
    if (!value || typeof value !== 'object') return 'unknown'
    if (value.supported === false || value.smooth === false || value.powerEfficient === false) return 'bad'
    return value.supported === true && value.smooth === true && value.powerEfficient === true ? 'good' : 'unknown'
}
const getRepresentationCapability = item => {
    const kind = normalizeCodecName(item)
    if (kind !== 'av1' && kind !== 'hevc') return { capability: 'not-applicable', reason: 'not-applicable' }
    const key = codecConfigurationKey(item)
    if (!key) return { capability: 'unknown', reason: 'missing-or-invalid-metadata' }
    const entry = codecCapability.get(key)
    return entry && entry.state === 'complete'
        ? { capability: summarizeCodecCapability(entry.value), reason: entry.reason }
        : { capability: 'unknown', reason: entry?.state || (disabled ? 'disabled' : 'not-requested') }
}
const invalidateCodecQueries = () => {
    codecQueryQueue.forEach(entry => { if (codecCapability.get(entry.key) === entry) codecCapability.delete(entry.key) })
    codecQueryQueue = []
    activeCodecConfigurations = []
    lastCodecDecision = { preference: resolvedVideoCodecPreference, groups: [] }
    // Native decodingInfo has no AbortSignal: pending entries retain their slots until settlement.
}
const pumpCodecQueries = () => {
    while (!disabled && codecQueriesInFlight < 2 && codecQueryQueue.length) {
        const entry = codecQueryQueue.shift()
        if (codecCapability.get(entry.key) !== entry || !isRuntimeGenerationActive(entry.runtime)) continue
        entry.state = 'pending'
        codecQueriesInFlight++
        const finish = (value, reason) => {
            codecQueriesInFlight--
            if (codecCapability.get(entry.key) === entry) {
                if (isRuntimeGenerationActive(entry.runtime)) {
                    entry.state = 'complete'
                    entry.value = value ? {
                        supported: typeof value.supported === 'boolean' ? value.supported : null,
                        smooth: typeof value.smooth === 'boolean' ? value.smooth : null,
                        powerEfficient: typeof value.powerEfficient === 'boolean' ? value.powerEfficient : null,
                    } : null
                    entry.reason = reason
                } else codecCapability.delete(entry.key)
            }
            // Only configurations requested by the current playinfo may occupy the freed slot.
            const retry = activeCodecConfigurations.find(row => row.key === entry.key)
            if (retry && !isRuntimeGenerationActive(entry.runtime)) enqueueCodecQuery(retry, false)
            pumpCodecQueries()
        }
        Promise.resolve().then(() => isRuntimeGenerationActive(entry.runtime)
            ? navigator.mediaCapabilities.decodingInfo(entry.config) : null)
            .then(value => {
                let safe = null, reason = 'query-failed'
                try {
                    if (value && typeof value === 'object') {
                        safe = { supported: value.supported, smooth: value.smooth, powerEfficient: value.powerEfficient }
                        reason = summarizeCodecCapability(safe) === 'unknown' ? 'incomplete-result' : 'completed'
                    }
                } catch {}
                finish(safe, reason)
            }, () => finish(null, 'query-failed'))
    }
}
const clearCodecPlayinfo = () => { invalidateCodecQueries(); codecResumeItems = [] }
const enqueueCodecQuery = (row, pump = true) => {
    if (disabled || !row.key || (row.kind !== 'av1' && row.kind !== 'hevc') || codecCapability.has(row.key)) return
    if (codecCapability.size >= CODEC_CAPABILITY_MAX) {
        const activeKeys = new Set(activeCodecConfigurations.map(row => row.key))
        const removable = [...codecCapability].find(([key, entry]) => entry.state === 'complete' && !activeKeys.has(key))
        if (!removable) return
        codecCapability.delete(removable[0])
    }
    let available = false
    try { available = typeof navigator.mediaCapabilities?.decodingInfo === 'function' } catch {}
    const entry = { key: row.key, config: row.config, runtime: captureRuntimeGeneration(),
        state: available ? 'queued' : 'complete', reason: available ? 'queued' : 'api-unavailable', value: null }
    codecCapability.set(row.key, entry)
    if (available) codecQueryQueue.push(entry)
    if (pump) pumpCodecQueries()
}
const prepareCodecConfigurations = videoItems => {
    activeCodecConfigurations = videoItems.slice(0, CODEC_CAPABILITY_MAX).map(item => {
        const config = getRepresentationCodecConfig(item)
        const snapshot = { codecs: getDashCodecString(item).slice(0, 256),
            mime_type: String(item?.mime_type || item?.mimeType || '').slice(0, 128),
            width: Number(item?.width), height: Number(item?.height), bandwidth: Number(item?.bandwidth),
            frame_rate: config ? config.video.framerate : null,
            codecid: Number(item?.codecid || item?.codec_id || item?.codecId) }
        return { item: Object.freeze(snapshot), kind: normalizeCodecName(item), key: config ? JSON.stringify(config) : '', config }
    })
    codecResumeItems = activeCodecConfigurations.map(row => row.item)
    const keys = new Set(activeCodecConfigurations.map(row => row.key))
    codecQueryQueue = codecQueryQueue.filter(entry => {
        if (keys.has(entry.key) && isRuntimeGenerationActive(entry.runtime)) return true
        if (codecCapability.get(entry.key) === entry) codecCapability.delete(entry.key)
        return false
    })
    activeCodecConfigurations.forEach(row => enqueueCodecQuery(row, false))
    pumpCodecQueries()
}
const getCurrentCodecDiagnostics = () => activeCodecConfigurations.slice(0, 8).map(row => ({
    codec: row.kind, height: row.config?.video.height || 0, width: row.config?.video.width || 0,
    frameRate: row.config?.video.framerate || null, ...getRepresentationCapability(row.item),
}))
const getCodecCapabilityState = (kind, height) => {
    if (kind !== 'hevc' && kind !== 'av1') return 'not-applicable'
    const states = activeCodecConfigurations.filter(row => row.kind === kind
        && ((Number(row.item.height) || 0) >= 2160 ? 2160 : 1080) === (height >= 2160 ? 2160 : 1080))
        .map(row => getRepresentationCapability(row.item).capability)
    return states.length && states.every(state => state === states[0]) ? states[0] : 'unknown'
}

const canPlayDashVideoItem = (() => {
    const cache = {}
    let testVideo = null

    const canPlayCodecString = (codec) => {
        if (!codec) return null
        const key = codec.toLowerCase()
        if (key in cache) return cache[key]
        const mime = 'video/mp4; codecs="' + codec + '"'
        let ok = false
        try {
            const MS = unsafeWindow.MediaSource || (typeof MediaSource !== 'undefined' ? MediaSource : null)
            ok = !!(MS && MS.isTypeSupported && MS.isTypeSupported(mime))
        } catch {}
        if (!ok) {
            try {
                if (!testVideo) testVideo = document.createElement('video')
                ok = !!(testVideo.canPlayType && testVideo.canPlayType(mime))
            } catch {}
        }
        cache[key] = ok
        return ok
    }

    return (item) => {
        const kind = normalizeCodecName(item)
        const codec = getDashCodecString(item)
        const explicit = canPlayCodecString(codec)
        if (explicit !== null) return explicit
        if (kind === 'av1') return false
        return true
    }
})()

const normalizeDashCodecPreference = (dash) => {
    if (!dash || !Array.isArray(dash.video)) return
    prepareCodecConfigurations(dash.video)
    if (resolvedVideoCodecPreference === 'auto') {
        lastCodecDecision = { preference: 'auto', groups: [] }
        return
    }

    const codecRank = (item) => {
        const kind = normalizeCodecName(item)
        if (resolvedVideoCodecPreference === 'avc') {
            if (kind === 'avc') return 0
            if (kind === 'hevc') return 1
            if (kind === 'av1') return 2
            return 3
        }
        const capability = getRepresentationCapability(item).capability
        const suitable = capability !== 'bad'
        if (resolvedVideoCodecPreference === 'av1') {
            if (kind === 'av1')  return suitable ? 0 : 3
            if (kind === 'hevc') return suitable ? 1 : 4
            if (kind === 'avc')  return 2
            return 5
        }
        // 'hevc' 模式維持 v1.4.1 的相對順序；只有 Media Capabilities 明確否定時
        // 才把 HEVC/AV1 降到 AVC 後面。
        if (kind === 'hevc') return suitable ? 0 : 2
        if (kind === 'avc')  return 1
        if (kind === 'av1')  return suitable ? 1.5 : 3
        return 4
    }

    const groups = []
    const byQuality = new Map()
    dash.video.forEach((item, originalIndex) => {
        const quality = String(item && (item.id || item.quality || item.qn || originalIndex))
        if (!byQuality.has(quality)) {
            const group = { quality, items: [] }
            byQuality.set(quality, group)
            groups.push(group)
        }
        byQuality.get(quality).items.push({ item, originalIndex })
    })

    const normalized = []
    const decisions = []
    groups.forEach(group => {
        let entries = group.items
        const supported = entries.filter(entry => canPlayDashVideoItem(entry.item))
        if (supported.length) entries = supported
        entries.sort((a, b) => {
            const rankDiff = codecRank(a.item) - codecRank(b.item)
            return rankDiff || (a.originalIndex - b.originalIndex)
        })
        entries.forEach(entry => normalized.push(entry.item))
        const selected = entries[0] && entries[0].item
        if (decisions.length < 8 && selected) {
            const height = ((selected && selected.height) || 0) >= 2160 ? 2160 : 1080
            const kind = normalizeCodecName(selected)
            decisions.push({
                quality: String(group.quality).slice(0, 16),
                selected: kind,
                capability: getRepresentationCapability(selected).capability,
            })
        }
    })

    if (normalized.length) dash.video = normalized
    lastCodecDecision = { preference: resolvedVideoCodecPreference, groups: decisions }
}

// 處理整個 playInfo（dash / durl / durls 三種格式）
const playInfoTransformer = (playInfo) => {
    if (!playInfo) return
    if (playInfo.code !== undefined && playInfo.code !== 0) {
        return
    }
    // 每包新的 playinfo 都是一個 representation epoch；不可讓前一包 URL identity 汙染判讀。
    clearCodecPlayinfo()
    resetRepresentationRegistry()
    streamEstimate = { source: 'unknown', codec: 'other', height: 0, videoMbps: 0, audioMbps: 0 }
    streamProfile = null
    currentStreamBitsPerSec = 0
    baseBufferTargetBytes = DEFAULT_BUFFER_TARGET_BYTES

    // 三個呼叫端都不接回傳值，原本回傳的 { total, akamai } 只是白算一輪。
    // 只保留真正需要的副作用：逐個 item 改寫。
    const transformList = (list, isDash) => {
        if (!Array.isArray(list)) return
        list.forEach(item => {
            if (!isDash) registerMediaRepresentation(muxedRepresentationRegistry,
                { urls: pickStreamUrls(item, false).validUrls }, 'muxed', AUDIO_REGISTRY_MAX)
            transformStreamItem(item, isDash)
        })
    }

    let video_info
    if (playInfo.result) {
        video_info = playInfo.result.dash === undefined ? playInfo.result.video_info : playInfo.result
        if (!video_info || !video_info.dash) {
            if (playInfo.result.durl || playInfo.result.durls) video_info = playInfo.result
            if (video_info && video_info.durl) transformList(video_info.durl, false)
            if (video_info && video_info.durls) video_info.durls.forEach(d => transformList(d.durl, false))
            sanitizePlayInfoUrls(video_info || playInfo.result)
            return
        }
    } else {
        video_info = playInfo.data
    }

    try {
        const dash = video_info && video_info.dash
        if (dash) {
            normalizeDashCodecPreference(dash)

            // 只動 minBufferTime；不能加 maxBufferLength —
            // 4K AV1 + FLAC 設大會觸發 SourceBuffer QuotaExceeded → DecodeError 6003
            // 4K/高碼率用 2s：4.0 會讓 seek 後多等 ~2s 才開播（長片拖曳特明顯）
            try {
                const vids = (dash.video || [])
                const auds = (dash.audio || [])
                const maxV = vids.reduce((m, v) => Math.max(m, v.bandwidth || 0), 0)
                const maxA = auds.reduce((m, a) => Math.max(m, a.bandwidth || 0), 0)
                const is4K = vids.some(v => (v.height || 0) >= 2160 || (v.bandwidth || 0) > 12e6)
                // 4K：首播先讓畫面更快進入 canplay；穩定度交給 Watchdog/HEVC/CDN 切換處理。
                const minBuf = is4K ? 1.0 : 3.0
                // v1.3.3：記下完整畫質清單，讓 Watchdog 之後能用實際播放的畫質校正碼率
                // （見 syncStreamBitrateFromVideo）。這裡的 maxV 只當起播前的初估值，
                // 起播那 3~5 秒 Watchdog 本來就在 grace 期不判定，校正得及。
                streamProfile = {
                    reps: vids
                        .map(v => ({
                            height: v.height || 0,
                            bandwidth: v.bandwidth || 0,
                            codec: normalizeCodecName(v),
                            // 登記改寫前的 base/backup；identity 只取 pathname+search，換 host 後仍能命中。
                            urls: pickStreamUrls(v, true).validUrls,
                        }))
                        .filter(r => r.bandwidth > 0 && r.height > 0),
                    audioBps: maxA,
                    audioReps: [...auds, ...[].concat(dash.flac?.audio || []), ...[].concat(dash.dolby?.audio || [])]
                        .filter(a => a && typeof a === 'object')
                        .map(a => ({ bandwidth: a.bandwidth || 0, urls: pickStreamUrls(a, true).validUrls })),
                }
                rebuildRepresentationRegistry()
                setBufferTargetFromBitrate(maxV + maxA, is4K || (maxV + maxA) > 12e6)
                dash.minBufferTime   = minBuf
                dash.min_buffer_time = minBuf
            } catch {}

            const extras = []
            if (dash.flac  && dash.flac.audio)  [].concat(dash.flac.audio).forEach(i  => extras.push(i))
            if (dash.dolby && dash.dolby.audio)  [].concat(dash.dolby.audio).forEach(i => extras.push(i))

            transformList(dash.video, true)
            transformList(dash.audio, true)
            transformList(extras,     true)
            sanitizePlayInfoUrls(dash)

            // 拿一條真實視訊 segment 當賽馬樣本（純 bilivideo 來源時才跑；Akamai 為主不適用）
            try {
                const sample = dash.video && dash.video[0] && (dash.video[0].base_url || dash.video[0].baseUrl)
                if (sample && isBiliVideoUrl(sample) && !isAkamaiUrl(sample)) scheduleBakeoff(sample)
            } catch {}

        } else if (video_info && (video_info.durl || video_info.durls)) {
            transformList(video_info.durl, false)
            ;(video_info.durls || []).forEach(d => transformList(d.durl, false))
            sanitizePlayInfoUrls(video_info)
        }
    } catch (e) {
        if (video_info && video_info.durl) transformList(video_info.durl, false)
        else err('playInfoTransformer 例外：', e)
    }
}

// 是否為影片 m4s / flv segment
const isBiliFragmentUrl = (url) => {
    if (!url || !isBiliVideoUrl(url)) return false
    try {
        const parsed = parseMediaHttpUrl(url)
        if (!parsed) return false
        const path = parsed.pathname
        return mediaUrlPolicy.mediaPathPattern.test(path) || path.includes('/upgcxcode/') || path.startsWith('/v1/resource')
    } catch {
        return /bilivideo\.com|bilivideo\.cn/.test(url) &&
               (url.includes('.m4s') || url.includes('.flv') || url.includes('/upgcxcode/'))
    }
}

// ── Network 攔截（XHR + Fetch）─────────────────────────────────────────
// 兩層攔截：
//   1. playurl API 層 (XHR responseText/response、Fetch response) → 改寫 base_url + backup_url
//   2. Transport 層 (m4s/flv segment) → 非白名單/黑名單 CDN 即時改寫成最佳白名單
const interceptNetResponse = (function (theWindow) {
    const interceptors = []
    const interceptNetResponse = (handler) => interceptors.push(handler)
    const handleInterceptedResponse = (response, url, valid = () => !disabled) =>
        interceptors.reduce((m, h) => {
            let r
            if (!valid()) return m
            try { r = h(m, url, valid) } catch { DiagnosticLog.fault('interceptor'); return m }
            return r !== undefined ? r : m
        }, response)

    // playurl 回應的改寫成本不低（JSON.parse → sanitizePlayInfoUrls 走訪整包幾百個字串
    // 欄位 → JSON.stringify；4K 多畫質 + 多 backup 的回應可以到幾百 KB），而
    // responseText / response 是 **getter** —— 播放器每讀一次屬性就整套重跑一次。
    // 兩個後果都不能接受：
    //   1. 速度：這段完全落在起播的關鍵路徑上（playurl 到手到第一個 segment 發出之間），
    //      讀兩次就是兩倍成本，而播放器「先看長度／try 一次 parse／再正式 parse」這種
    //      多次讀取的寫法非常常見。
    //   2. 正確性：redirectStats 的計數（含診斷面板拿來判讀的 pcdnSkipped）會按
    //      「被讀幾次」而不是「有幾包回應」累加，被不明倍率灌水，失去判讀價值。
    // 以「原始值」當 key 記憶化：同一個 XHR 實例、同一份原始回應只轉換一次。
    // responseText 與 response 各自存一格——它們可能被交替讀取，共用一格會互相沖掉，
    // 反而每次都 miss。
    const playurlRequests = new WeakMap()
    const mediaRequests = new WeakMap()
    const diagnosticRequests = new WeakMap()
    const transformPlayurlOnce = (xhr, kind, raw) => {
        const context = playurlRequests.get(xhr)
        const valid = () => !!context && playurlRequests.get(xhr) === context
            && isRuntimeGenerationActive(context.runtime)
        if (!valid()) return raw
        // text and response (text mode) share a cache; JSON never mutates the browser-owned object.
        const cached = context.cache
        if (cached && cached.raw === raw) return cached.out
        let input = raw
        if (raw && typeof raw === 'object') {
            try { input = JSON.parse(JSON.stringify(raw)) } catch { DiagnosticLog.fault('transform'); return raw }
        }
        if (!valid()) return raw
        const out = handleInterceptedResponse(input, context.url, valid)
        if (!valid()) return raw
        context.cache = { raw, out }
        return out
    }

    // ── XHR ──────────────────────────────────────────────────
    const OriginalXMLHttpRequest = theWindow.XMLHttpRequest
    class XMLHttpRequest extends OriginalXMLHttpRequest {
        open(method, url, ...rest) {
            DiagnosticLog.updateRequest(diagnosticRequests.get(this), 'reopened')
            diagnosticRequests.delete(this)
            const urlStr = String(url)
            playurlRequests.set(this, { runtime: captureRuntimeGeneration(), url: urlStr, cache: null })
            mediaRequests.set(this, captureMediaRequest(urlStr))
            // XMLHttpRequest 物件可被重複 open()。每次請求都要清掉上一輪的自訂狀態，
            // 否則先前的 HTTPDNS abort、重導 host 或 response 快取會污染下一個 URL。
            if (this._blockedTimer) { clearTimeout(this._blockedTimer); this._blockedTimer = null }
            this._biliRequestSeq = (this._biliRequestSeq || 0) + 1
            this._blockAbort = false
            this._blockedDone = false
            this._blockedBody = ''
            this._originCdn = null
            this._redirectedCdn = null
            this._originalUrl = urlStr
            this._hostRewriteAttempt = false
            this._restoredOriginal = false
            this._interceptUrl = urlStr
            this._biliPlayurlCache_text = null
            this._biliPlayurlCache_response = null
            this._biliJsonMetadata = isBiliJsonMetadataApi(urlStr)

            if (disabled) {
                this._interceptUrl = urlStr
                return super.open(method, url, ...rest)
            }

            // HTTPDNS 依 true / false / auto 判斷是否直接 abort
            if (isHttpDnsUrl(urlStr) && shouldBlockHttpDns()) {
                this._blockAbort   = true
                this._interceptUrl = urlStr
                redirectStats.httpdns++
                return super.open(method, urlStr, ...rest)
            }
            if (isHttpDnsUrl(urlStr)) {
                redirectStats.httpdnsAllowed++
            }

            if (!disabled && isMediaSegmentUrl(urlStr)) {
                const mappedOriginalUrl = getOriginalStreamUrl(urlStr)
                this._originalUrl = mappedOriginalUrl
                this._hostRewriteAttempt = mappedOriginalUrl !== urlStr
                const norm = normalizeMediaUrl(urlStr)
                this._originCdn = norm.originCdn || getBiliVideoCdn(urlStr)
                if (norm.changed) {
                    this._redirectedCdn = norm.targetCdn
                    this._restoredOriginal = !!norm.restoredOriginal
                    // 復原到原始簽名 URL 不是「再改一次 host」，後續 403 應按原 host 真實失敗處理。
                    this._hostRewriteAttempt = !norm.restoredOriginal
                    url = norm.url
                }
            }

            this._interceptUrl = String(url)
            return super.open(method, url, ...rest)
        }

        _deliverBlockedHttpDns() {
            const body = '{"code":-1,"message":"blocked by BiliCDN","data":null}'
            const requestSeq = this._biliRequestSeq
            this._blockedBody = body
            this._blockedTimer = setTimeout(() => {
                this._blockedTimer = null
                if (this._biliRequestSeq !== requestSeq || !this._blockAbort) return
                this._blockedDone = true
                try {
                    this.dispatchEvent(new Event('readystatechange'))
                    const detail = { lengthComputable: true, loaded: body.length, total: body.length }
                    this.dispatchEvent(new ProgressEvent('load', detail))
                    this.dispatchEvent(new ProgressEvent('loadend', detail))
                } catch (e) { err('HTTPDNS 阻擋回應派送失敗：', e) }
            }, 0)
        }
        abort() {
            DiagnosticLog.updateRequest(diagnosticRequests.get(this), 'abort')
            diagnosticRequests.delete(this)
            playurlRequests.delete(this)
            mediaRequests.delete(this)
            if (this._blockedTimer) { clearTimeout(this._blockedTimer); this._blockedTimer = null }
            this._blockAbort = false
            this._blockedDone = false
            this._blockedBody = ''
            this._biliRequestSeq = (this._biliRequestSeq || 0) + 1
            return super.abort()
        }
        get readyState()  { return this._blockedDone ? 4 : super.readyState }
        get status()      { return this._blockedDone ? 503 : super.status }
        get statusText()  { return this._blockedDone ? 'Service Unavailable' : super.statusText }
        get responseURL() { return this._blockedDone ? (this._interceptUrl || '') : super.responseURL }
        getResponseHeader(name) {
            if (!this._blockedDone) return super.getResponseHeader(name)
            return String(name).toLowerCase() === 'content-type' ? 'application/json' : null
        }
        getAllResponseHeaders() {
            return this._blockedDone ? 'content-type: application/json\r\n' : super.getAllResponseHeaders()
        }

        send(...args) {
            if (this._biliJsonMetadata && !disabled) {
                try { this.setRequestHeader('Accept', 'application/json, text/plain, */*') } catch {}
            }

            if (this._blockAbort) {
                this._deliverBlockedHttpDns()
                return
            }

            // 只在真正的網路錯誤（error 事件）或 4xx/5xx 計失敗
            // status=0 多半是 player 主動 abort（seek/換畫質），不計失敗
            if (this._originCdn) {
                const cdn  = this._redirectedCdn || this._originCdn
                const self = this
                const requestSeq = this._biliRequestSeq
                const mediaContext = mediaRequests.get(this)
                const requestRuntimeToken = mediaContext?.runtime || captureRuntimeGeneration()
                const diagnosticId = DiagnosticLog.request('xhr', mediaContext, this._originalUrl || this._interceptUrl, this._interceptUrl)
                diagnosticRequests.set(this, diagnosticId)
                const segStartedAt = Date.now()
                let firstByteAt = 0
                let progressEvents = 0
                let aborted = false
                let lastProgressLoaded = 0
                this.addEventListener('abort', (e) => {
                    if (e && e.isTrusted === true && self._biliRequestSeq === requestSeq) {
                        aborted = true; DiagnosticLog.updateRequest(diagnosticId, 'abort')
                    }
                }, { once: true })
                this.addEventListener('error', (e) => {
                    if (!e || e.isTrusted !== true) return
                    if (self._biliRequestSeq !== requestSeq || aborted || !isRuntimeGenerationActive(requestRuntimeToken)) return
                    DiagnosticLog.updateRequest(diagnosticId, 'network-error', { bytes: lastProgressLoaded })
                    handleVerifiedSegmentFailure({
                        cdn,
                        url: self._interceptUrl,
                        kind: 'network-error',
                        bytesReceived: lastProgressLoaded,
                        hostRewriteAttempt: self._hostRewriteAttempt,
                        originalUrl: self._originalUrl,
                    })
                })
                this.addEventListener('timeout', e => {
                    if (e?.isTrusted === true && self._biliRequestSeq === requestSeq && !aborted)
                        DiagnosticLog.updateRequest(diagnosticId, 'network-error', { reason: 'timeout', bytes: lastProgressLoaded })
                }, { once: true })
                // XHR 的 'load'/readystatechange DONE 要等整包下載完才觸發，大 segment（4K/
                // 無損）下載期間 Watchdog 完全看不到進度，容易在中段誤判「好幾秒 0 位元組」。
                // 用 progress 事件的累計 loaded 算出每次的增量，即時餵給 Watchdog，
                // 讓面板/停滯偵測看到的下載節奏跟真實網路一致。
                this.addEventListener('progress', (e) => {
                    if (!e || e.isTrusted !== true) return
                    if (self._biliRequestSeq !== requestSeq || aborted || !isRuntimeGenerationActive(requestRuntimeToken)) return
                    if (!firstByteAt) firstByteAt = Date.now()   // 純傳輸時間的起點，扣掉連線/排隊的 TTFB
                    progressEvents++
                    const loaded = (e && e.loaded) || 0
                    DiagnosticLog.updateRequest(diagnosticId, 'body', { bytes: loaded })
                    const delta = loaded - lastProgressLoaded
                    if (delta > 0) {
                        lastProgressLoaded = loaded
                        observeMediaTransfer(mediaContext, self.responseURL || self._interceptUrl, delta, 'xhr')
                        Watchdog.noteExternalBytes(cdn, delta)
                        // 邊下載邊刷新去重標記（而不是只在下載完當下標一次）：
                        // 大 segment 下載期間，PerformanceObserver 的 resource-timing entry
                        // 理論上要等整包傳完才會送達，但送達時機沒有跟我們的量測同步保證，
                        // 持續刷新能避免「量測還沒完成、entry 卻先到」造成 onEntry() 重複入帳，
                        // 也避免下載耗時超過去重視窗（5s）導致標記提早過期。
                        noteSegmentAccounted(self._interceptUrl)
                        if (self.responseURL && self.responseURL !== self._interceptUrl) {
                            noteSegmentAccounted(self.responseURL)
                        }
                    }
                })
                this.addEventListener('readystatechange', function (e) {
                    if (!e || e.isTrusted !== true) return
                    if (self._biliRequestSeq !== requestSeq || !isRuntimeGenerationActive(requestRuntimeToken)) return
                    if (self.readyState === 2) DiagnosticLog.updateRequest(diagnosticId, 'headers', { status: self.status, finalHost: self.responseURL || self._interceptUrl })
                    if (self.readyState !== XMLHttpRequest.DONE) return
                    if (aborted) return
                    // status 0 DONE precedes native error/abort in browsers: do not prematurely settle it.
                    if (self.status > 0) DiagnosticLog.updateRequest(diagnosticId, self.status >= 400 ? 'http' : 'eof', {
                        status: self.status, finalHost: self.responseURL || self._interceptUrl, bytes: lastProgressLoaded,
                    })
                    if (HARD_FAIL_STATUSES.has(self.status)) {
                        handleVerifiedSegmentFailure({
                            cdn,
                            url: self._interceptUrl,
                            status: self.status,
                            hostRewriteAttempt: self._hostRewriteAttempt,
                            originalUrl: self._originalUrl,
                        })
                    } else if (self.status >= 500) {
                        handleVerifiedSegmentFailure({
                            cdn,
                            url: self._interceptUrl,
                            status: self.status,
                            hostRewriteAttempt: self._hostRewriteAttempt,
                            originalUrl: self._originalUrl,
                        })
                    } else if (self.status >= 200 && self.status < 400) {
                        recordCdnSuccess(cdn, segStartedAt)
                        // 只有觀察到 ≥2 次 progress（真的分批收到）才信任「扣掉 TTFB」的起點；
                        // 小 segment 常常一個 read 就整包到齊，firstByteAt 幾乎等於下載完成時間，
                        // 相減會逼近 0ms，Math.max(1,...) 的下限反而把 Mbps 撐爆成離譜的天文數字。
                        // 這種情況退回含 TTFB 的完整耗時，寧可略為低估也不要產生失真的極端值。
                        const durationBase = progressEvents >= 2 ? (firstByteAt || segStartedAt) : segStartedAt
                        noteSegmentBytes(cdn, self, durationBase, self._interceptUrl, lastProgressLoaded, requestRuntimeToken, mediaContext)
                    }
                })
            }

            try { return super.send(...args) }
            catch (error) { DiagnosticLog.updateRequest(diagnosticRequests.get(this), 'network-error'); throw error }
        }

        get responseText() {
            if (this._blockedDone) return this._blockedBody
            if (this.readyState !== this.DONE) return super.responseText
            if (disabled) return super.responseText
            if (!isPlayUrlApi(this._interceptUrl || this.responseURL)) return super.responseText
            return transformPlayurlOnce(this, 'text', super.responseText)
        }
        get response() {
            if (this._blockedDone) {
                if (this.responseType === 'json') {
                    try { return JSON.parse(this._blockedBody) } catch { return null }
                }
                return this.responseType === '' || this.responseType === 'text' ? this._blockedBody : null
            }
            if (this.readyState !== this.DONE) return super.response
            if (disabled) return super.response
            if (!isPlayUrlApi(this._interceptUrl || this.responseURL)) return super.response
            return transformPlayurlOnce(this, 'response', super.response)
        }
    }
    theWindow.XMLHttpRequest = XMLHttpRequest

    // ── Fetch ────────────────────────────────────────────────
    const OriginalFetch = theWindow.fetch

    const cloneResponseWithBody = (source, body, preserveEntityHeaders = true) => {
        const headers = new Headers(source.headers)
        if (!preserveEntityHeaders) {
            // response.text() 已解碼，且改寫後長度／實體標記可能不同，不能沿用原值。
            ;['content-length', 'content-encoding', 'content-range', 'etag', 'content-md5']
                .forEach(name => { try { headers.delete(name) } catch {} })
        }
        const out = new Response(body, {
            status: source.status,
            statusText: source.statusText,
            headers,
        })
        // new Response() 不會保留這些唯讀 metadata；部分播放器會依 response.url 判斷來源。
        ;['url', 'redirected', 'type'].forEach(key => {
            try { Object.defineProperty(out, key, { value: source[key], configurable: true }) } catch {}
        })
        return out
    }

    // 用單一路徑 ReadableStream 包裝 body：播放器讀多少就量多少；播放器 seek/切畫質
    // 取消時，cancel() 直接傳給原始 reader。舊版 tee() 的計數分支會繼續把舊 segment
    // 讀完，使取消失效並在 seek 後持續搶頻寬。
    const wrapMeasuredFetchResponse = (res, cdn, effectiveUrl, fetchStartedAt, failureContext, requestRuntimeToken, mediaContext, diagnosticId) => {
        if (!res.body || typeof res.body.getReader !== 'function' || typeof ReadableStream === 'undefined') {
            DiagnosticLog.updateRequest(diagnosticId, 'no-body')
            if (isRuntimeGenerationActive(requestRuntimeToken)) {
                recordCdnSuccess(cdn, fetchStartedAt)
            }
            return res
        }

        const reader = res.body.getReader()
        let counted = 0
        let firstChunkAt = 0
        let chunkCount = 0
        let cancelled = false
        let settled = false

        const finishSuccess = () => {
            if (settled || cancelled) return
            settled = true
            DiagnosticLog.updateRequest(diagnosticId, 'eof', { bytes: counted })
            if (!isRuntimeGenerationActive(requestRuntimeToken)) return
            if (counted) {
                const durationBase = chunkCount >= 2 ? (firstChunkAt || fetchStartedAt) : fetchStartedAt
                recordCdnThroughput(cdn, counted, Math.max(1, Date.now() - durationBase), playbackRateState.effectiveRate)
            }
            recordCdnSuccess(cdn, fetchStartedAt)
        }

        const finishError = (error) => {
            if (settled || cancelled) return
            settled = true
            DiagnosticLog.updateRequest(diagnosticId, error && error.name === 'AbortError' ? 'abort' : 'body-error', { bytes: counted })
            if (!isRuntimeGenerationActive(requestRuntimeToken)) return
            if (error && error.name === 'AbortError') return
            handleVerifiedSegmentFailure({
                ...(failureContext || {}),
                cdn,
                url: effectiveUrl,
                kind: 'body-error',
                bytesReceived: counted,
            })
        }

        const body = new ReadableStream({
            async pull(controller) {
                try {
                    const { done, value } = await reader.read()
                    if (done) {
                        finishSuccess()
                        controller.close()
                        return
                    }
                    if (value && value.byteLength) {
                        if (!firstChunkAt) firstChunkAt = Date.now()
                        chunkCount++
                        counted += value.byteLength
                        DiagnosticLog.updateRequest(diagnosticId, 'body', { bytes: counted })
                        try {
                            if (isRuntimeGenerationActive(requestRuntimeToken)) {
                                observeMediaTransfer(mediaContext, res.url || effectiveUrl, value.byteLength, 'fetch')
                            }
                            if (!isRuntimeGenerationActive(requestRuntimeToken)) throw new Error('stale runtime')
                            Watchdog.noteExternalBytes(cdn, value.byteLength)
                            noteSegmentAccounted(effectiveUrl)
                            if (res.url && res.url !== effectiveUrl) noteSegmentAccounted(res.url)
                        } catch {}
                    }
                    if (value !== undefined) controller.enqueue(value)
                } catch (error) {
                    finishError(error)
                    controller.error(error)
                }
            },
            cancel(reason) {
                cancelled = true
                settled = true
                DiagnosticLog.updateRequest(diagnosticId, 'abort', { bytes: counted })
                try { return Promise.resolve(reader.cancel(reason)).catch(() => {}) } catch { return Promise.resolve() }
            },
        })
        return cloneResponseWithBody(res, body)
    }

    theWindow.fetch = (input, init) => {
        if (disabled) return OriginalFetch(input, init)
        const urlStr = (input instanceof Request) ? input.url : String(input)

        if (isHttpDnsUrl(urlStr) && shouldBlockHttpDns()) {
            redirectStats.httpdns++
            // 合成一個可解析的失敗回應，避免未處理的 rejected promise 汙染 console。
            try {
                return Promise.resolve(new Response(
                    '{"code":-1,"message":"blocked by BiliCDN","data":null}',
                    { status: 503, statusText: 'Service Unavailable',
                      headers: { 'Content-Type': 'application/json' } }
                ))
            } catch {
                return Promise.reject(new DOMException('BiliCDN blocked httpdns', 'AbortError'))
            }
        }
        if (isHttpDnsUrl(urlStr)) redirectStats.httpdnsAllowed++

        if (isBiliJsonMetadataApi(urlStr)) {
            const headers = new Headers(
                init && init.headers
                    ? init.headers
                    : (input instanceof Request ? input.headers : undefined)
            )
            headers.set('Accept', 'application/json, text/plain, */*')
            if (input instanceof Request) input = new Request(input, { headers })
            else init = Object.assign({}, init, { headers })
        }

        if (isMediaSegmentUrl(urlStr)) {
            const mappedOriginalUrl = getOriginalStreamUrl(urlStr)
            const norm = normalizeMediaUrl(urlStr)
            const hostRewriteAttempt = !norm.restoredOriginal
                && (norm.changed || mappedOriginalUrl !== urlStr)
            const targetCdn = norm.targetCdn || norm.originCdn || getBiliVideoCdn(urlStr)
            const effectiveUrl = norm.changed ? norm.url : urlStr

            const fetchInput = (input instanceof Request)
                ? new Request(effectiveUrl, {
                    method:         input.method,
                    headers:        input.headers,
                    body:           (input.method === 'GET' || input.method === 'HEAD') ? undefined : input.body,
                    mode:           input.mode === 'navigate' ? 'same-origin' : input.mode,
                    credentials:    input.credentials,
                    cache:          input.cache,
                    redirect:       input.redirect,
                    referrer:       input.referrer,
                    referrerPolicy: input.referrerPolicy,
                    integrity:      input.integrity,
                    keepalive:      input.keepalive,
                    signal:         input.signal,
                  })
                : effectiveUrl

            const fetchStartedAt = Date.now()
            const requestRuntimeToken = captureRuntimeGeneration()
            const mediaContext = captureMediaRequest(urlStr, requestRuntimeToken)
            const diagnosticId = DiagnosticLog.request('fetch', mediaContext, mappedOriginalUrl, effectiveUrl)
            return OriginalFetch(fetchInput, init).then(res => {
                DiagnosticLog.updateRequest(diagnosticId, 'headers', { status: res.status, finalHost: res.url || effectiveUrl })
                const failureContext = { hostRewriteAttempt, originalUrl: mappedOriginalUrl }
                if (res.ok) return wrapMeasuredFetchResponse(res, targetCdn, effectiveUrl, fetchStartedAt, failureContext, requestRuntimeToken, mediaContext, diagnosticId)
                DiagnosticLog.updateRequest(diagnosticId, 'http')

                if (isRuntimeGenerationActive(requestRuntimeToken)) handleVerifiedSegmentFailure({
                    ...failureContext,
                    cdn: targetCdn,
                    url: effectiveUrl,
                    status: res.status,
                })
                return res
            }).catch(error => {
                DiagnosticLog.updateRequest(diagnosticId, error && error.name === 'AbortError' ? 'abort' : 'network-error')
                if (error && error.name === 'AbortError') throw error
                if (isRuntimeGenerationActive(requestRuntimeToken)) handleVerifiedSegmentFailure({
                    cdn: targetCdn,
                    url: effectiveUrl,
                    kind: 'network-error',
                    hostRewriteAttempt,
                    originalUrl: mappedOriginalUrl,
                })
                throw error
            })
        }

        // playurl API 回應攔截。直接串接 response.text()，讀取失敗時 Promise 會正常 reject；
        // 舊版另外包一層只有 resolve、沒有 reject 的 Promise，可能永久停在 pending。
        if (!isPlayUrlApi(urlStr)) return OriginalFetch(input, init)
        const playurlRuntime = captureRuntimeGeneration()
        const playurlSignal = init?.signal || (input instanceof Request ? input.signal : null)
        const valid = () => isRuntimeGenerationActive(playurlRuntime) && !playurlSignal?.aborted
        return OriginalFetch(input, init).then(response => {
            if (!valid()) return response
            return response.text().then(text => {
                let out = text
                try {
                    const transformed = valid() ? handleInterceptedResponse(text, urlStr, valid) : text
                    if (typeof transformed === 'string') out = transformed
                } catch { DiagnosticLog.fault('transform') }
                const nullBody = response.status === 204 || response.status === 205 || response.status === 304
                try {
                    return cloneResponseWithBody(response, nullBody ? null : out, out === text)
                } catch (e) {
                    DiagnosticLog.fault('playurl-clone')
                    return new Response(nullBody ? null : text, { status: response.status || 200 })
                }
            }, error => { if (valid()) DiagnosticLog.fault('playurl-body'); throw error })
        })
    }

    // 測速（probeCdnThroughput/confirmHostReachable）也是用 fetch 發請求，Tampermonkey
    // sandbox 模式下 window.fetch 會轉發到這裡被改寫的 unsafeWindow.fetch——測速請求會
    // 被自己的攔截層改寫到別的節點，量出來的速度記到錯的 CDN 頭上。掛出原生 fetch 供繞過。
    interceptNetResponse.rawFetch = OriginalFetch.bind(theWindow)
    return interceptNetResponse
})(unsafeWindow)

// 若播放器把 segment 請求放進 Worker，補一層輕量 fetch/XHR host 改寫。
// classic Worker 用 importScripts；module Worker 僅包同源 script，避免跨源 module import 破壞 player。
const biliCdnWorkers = new Set()
const workerControlPorts = new WeakMap()
const getWorkerCdnTarget = () => [resolvedCdn, lastChosenCdn, peekBestCdn(), activeCdnList[0], PREFERRED_CDN_LIST[0]]
    .find(isValidCustomCdnHost) || ''

// ── Worker 攔截有效性量測（改進工單 B）───────────────────────────────────
// 這 250 行是全檔最複雜、最脆弱的部分（動態組字串 + importScripts 遠端網址），
// 且下方 new Worker 攔截處自己都不確定播放器是否真的用 Worker 抓 segment。埋四個分層指標，
// 用真實數據決定去留：created（攔到幾次 new Worker）→ netCalls（Worker 內
// 發了幾次網路請求）→ mediaSeen（其中幾次是影片分段）→ rewrites（實際改寫
// 了幾次）。隱私聲明：所有計數只存在使用者本機（GM_setValue），腳本不會
// 自動上傳任何資料，回報完全靠使用者從可信 Tampermonkey 診斷選單複製貼上。
const WORKER_STATS_KEY = 'workerStats_v1'
const WORKER_STATS_SAVE_MS = 5000
const WORKER_STATS_MAX_SAMPLES = 5
const WORKER_STAT_COUNTER_MAX = 1000000000
const sanitizeWorkerCounter = value => Number.isFinite(+value)
    ? Math.max(0, Math.min(WORKER_STAT_COUNTER_MAX, Math.trunc(+value)))
    : 0
const sanitizeWorkerTimestamp = value => Number.isFinite(+value)
    ? Math.max(0, Math.trunc(+value))
    : 0
const sanitizeWorkerSample = value => {
    try {
        const host = new URL(String(value)).hostname.toLowerCase()
        return host.length <= 253 && /^[a-z0-9.-]+$/.test(host) ? host : null
    } catch { return null }
}
const workerStats = (() => {
    try {
        const raw = JSON.parse(GM_getValue(WORKER_STATS_KEY) || '{}') || {}
        return {
            created: sanitizeWorkerCounter(raw.created),
            netCalls: sanitizeWorkerCounter(raw.netCalls),
            mediaSeen: sanitizeWorkerCounter(raw.mediaSeen),
            rewrites: sanitizeWorkerCounter(raw.rewrites),
            bytes: sanitizeWorkerCounter(raw.bytes),
            firstAt: sanitizeWorkerTimestamp(raw.firstAt),
            lastAt: sanitizeWorkerTimestamp(raw.lastAt),
            samples: Array.isArray(raw.samples)
                ? raw.samples.map(sanitizeWorkerSample).filter(Boolean).slice(0, WORKER_STATS_MAX_SAMPLES)
                : [],
        }
    } catch {
        return { created: 0, netCalls: 0, mediaSeen: 0, rewrites: 0, bytes: 0, firstAt: 0, lastAt: 0, samples: [] }
    }
})()
let workerStatsSaveTimer = null
const flushWorkerStats = () => {
    if (workerStatsSaveTimer) { clearTimeout(workerStatsSaveTimer); workerStatsSaveTimer = null }
    try { GM_setValue(WORKER_STATS_KEY, JSON.stringify(workerStats)) } catch {}
}
const scheduleWorkerStatsSave = () => {
    if (workerStatsSaveTimer) return
    workerStatsSaveTimer = setTimeout(() => { workerStatsSaveTimer = null; flushWorkerStats() }, WORKER_STATS_SAVE_MS)
}
// patch 可含 created/netCalls/mediaSeen/rewrites/bytes（累加）與 sample（只保留 hostname）。
const bumpWorkerStats = (patch) => {
    if (!patch || typeof patch !== 'object') return
    const now = Date.now()
    if (!workerStats.firstAt) workerStats.firstAt = now
    workerStats.lastAt = now
    ;['created', 'netCalls', 'mediaSeen', 'rewrites', 'bytes'].forEach(k => {
        const delta = sanitizeWorkerCounter(patch[k])
        if (delta) workerStats[k] = Math.min(WORKER_STAT_COUNTER_MAX, workerStats[k] + delta)
    })
    const sample = sanitizeWorkerSample(patch.sample)
    if (sample && !workerStats.samples.includes(sample)) {
        workerStats.samples.push(sample)
        if (workerStats.samples.length > WORKER_STATS_MAX_SAMPLES) workerStats.samples.shift()
    }
    scheduleWorkerStatsSave()
}
window.addEventListener('pagehide', flushWorkerStats)
// 判讀規則見改進工單 B：created=0 → 可砍；netCalls=0 → 可砍；mediaSeen=0 → 可砍；
// mediaSeen>0 → 保留（rewrites=0 時也保留，代表當時剛好不需改寫，不代表沒作用）。
const summarizeWorkerStats = () => {
    const days = workerStats.firstAt ? Math.max(1, Math.round((Date.now() - workerStats.firstAt) / 86400000)) : 0
    let verdict = EnableWorkerIntercept
        ? '尚無資料（先播放影片數分鐘再查）'
        : 'Worker 攔截目前停用；要量測需將 EnableWorkerIntercept 改為 true 後重整'
    if (workerStats.firstAt) {
        if (workerStats.created === 0) verdict = '完全沒攔到 Worker → 可考慮移除'
        else if (workerStats.netCalls === 0) verdict = '有 Worker 但從未發出網路請求 → 可考慮移除'
        else if (workerStats.mediaSeen === 0) verdict = '有網路請求但都不是影片分段 → 可考慮移除'
        else verdict = '有攔到影片分段 → 建議保留'
    }
    return {
        created: workerStats.created,
        netCalls: workerStats.netCalls,
        mediaSeen: workerStats.mediaSeen,
        rewrites: workerStats.rewrites,
        bytesMB: +((workerStats.bytes || 0) / 1024 / 1024).toFixed(2),
        observedDays: days,
        samples: [...workerStats.samples],
        verdict,
    }
}

// worker 強制改寫清單：soft-block / strongly-bad 的 preferred 主機（worker 預設不認這些），
// 外加賽馬勝者切換時明確指定的舊主機。讓中途切換對 worker segment 流量也生效。
// 用有時效的 Map 而非永久 Set：一次偶發錯誤不該讓某個 host 整支長片都被流放，
// softBlockCdn 早就有 TTL 的設計，這裡跟它保持一致。
const forcedRedirectHosts = new Map()   // host -> expireAt
const FORCED_REDIRECT_TTL = 10 * 60 * 1000
const FORCED_REDIRECT_MAX = Math.min(32, TRUSTED_CDN_CATALOG.length)
const sweepForcedRedirectHosts = () => {
    const now = Date.now()
    for (const [host, expireAt] of forcedRedirectHosts) {
        if (!isValidCustomCdnHost(host) || !Number.isFinite(expireAt) || expireAt <= now) {
            forcedRedirectHosts.delete(host)
        }
    }
}
const addForcedRedirect = (host, ttl) => {
    host = typeof host === 'string' ? host.trim().toLowerCase() : ''
    if (!isValidCustomCdnHost(host)) return false
    sweepForcedRedirectHosts()
    if (!forcedRedirectHosts.has(host) && forcedRedirectHosts.size >= FORCED_REDIRECT_MAX) {
        let oldestHost = null, oldestExpiry = Infinity
        for (const [candidate, expireAt] of forcedRedirectHosts) {
            if (expireAt < oldestExpiry) { oldestHost = candidate; oldestExpiry = expireAt }
        }
        if (oldestHost) forcedRedirectHosts.delete(oldestHost)
    }
    const duration = Number.isFinite(+ttl)
        ? Math.max(1000, Math.min(FORCED_REDIRECT_TTL, +ttl))
        : FORCED_REDIRECT_TTL
    forcedRedirectHosts.set(host, Date.now() + duration)
    return true
}
const isForcedRedirect = (host) => {
    sweepForcedRedirectHosts()
    if (!isValidCustomCdnHost(host)) return false
    const t = forcedRedirectHosts.get(host)
    if (!t) return false
    return true
}
const getWorkerForceList = () => {
    sweepForcedRedirectHosts()
    const out = new Set([...forcedRedirectHosts.keys()].filter(isForcedRedirect))
    PREFERRED_CDN_LIST.forEach(h => {
        if (isCdnSoftBlocked(h) || isCdnStronglyBad(h)) out.add(h)
    })
    out.delete(getWorkerCdnTarget())
    return [...out]
}

// 只有攔截器實際觀察到的 XHR/Fetch 狀態或 body 讀取錯誤能進入此處。console、頁面事件與
// 一般 Worker message 都沒有呼叫能力；sink 仍再次驗證媒體 URL 與 catalog host。
const handleVerifiedSegmentFailure = ({
    cdn, url, status = 0, kind = 'http', bytesReceived = 0,
    hostRewriteAttempt = false, originalUrl = '',
} = {}) => {
    if (disabled) return false
    cdn = typeof cdn === 'string' ? cdn.trim().toLowerCase() : ''
    if (!isValidCustomCdnHost(cdn)) return false
    if (typeof url !== 'string' || url.length > 16 * 1024 || !isMediaSegmentUrl(url)) return false
    const numericStatus = Number.isFinite(+status) ? Math.trunc(+status) : 0

    if (numericStatus === 403 && hostRewriteAttempt) {
        DiagnosticLog.record('host-lock', { host: cdn, status: 403 }, true)
        noteHostLockedStream(originalUrl || url)
        return true
    }

    const isNetworkError = kind === 'network-error' || kind === 'body-error'
    if (HARD_FAIL_STATUSES.has(numericStatus)) {
        recordCdnFailure(cdn, true, numericStatus)
    } else if (numericStatus >= 500) {
        recordCdnFailure(cdn, false, numericStatus)
    } else if (isNetworkError) {
        recordCdnFailure(cdn)
        handleSegmentConnError(cdn, Math.max(0, publicFinite(bytesReceived)))
    } else {
        return false
    }

    addForcedRedirect(cdn)
    DiagnosticLog.record('recovery', { host: cdn, reason: isNetworkError ? kind : 'http', status: numericStatus,
        punished: true, reselected: true, preconnect: true }, true)
    promoteBestCdnNow()
    preconnectBatch(getHealthyCdnList().slice(0, 3), true)
    syncWorkerCdnTarget()
    if (lastSampleSegmentUrl && (currentStreamBitsPerSec / 1e6 >= 12 || playbackRateState.effectiveRate >= 1.75)) {
        runThroughputBakeoff(lastSampleSegmentUrl, false, trustedBakeoffRequest('verified-failure')).catch(reportMeasurementFailure())
    }
    return true
}

const buildWorkerPolicy = () => {
    const target = getWorkerCdnTarget()
    if (!isValidCustomCdnHost(target)) return null
    const catalogSubset = values => [...new Set(values.filter(isValidCustomCdnHost))]
    return {
        version: 1,
        type: 'policy',
        target,
        force: catalogSubset(getWorkerForceList()),
        preferred: catalogSubset(PREFERRED_CDN_LIST),
        excluded: catalogSubset(TRUSTED_CDN_CATALOG.filter(matchesExclude)),
        disabled: !!disabled,
    }
}
const syncWorkerCdnTarget = () => {
    const message = buildWorkerPolicy()
    if (!message) return
    biliCdnWorkers.forEach(worker => {
        const record = workerControlPorts.get(worker)
        try {
            if (!record || !record.port) throw new Error('missing private Worker control port')
            record.port.postMessage(message)
        } catch {
            try { record && record.port && record.port.close() } catch {}
            biliCdnWorkers.delete(worker)
        }
    })
}

// 使用者透過設定面板 checkbox 停用/啟用時同步通知既有 Worker，
// 否則已建立的 Worker 會在「停用」後仍持續改寫 segment host（disabled 只擋新建 Worker）。
const syncWorkerDisabledState = () => {
    syncWorkerCdnTarget()
}

const setupClassicWorkerIntercept = () => {
    // 安全開關。關閉時整段攔截機制不生效，biliCdnWorkers
    // 維持空 Set——syncWorkerCdnTarget()/syncWorkerDisabledState() 的 forEach 在空 Set
    // 上單純不做事，不會因為開關關閉而丟例外。程式碼刻意保留不刪，等 workerStats()
    // 數據確認這段真的沒用後，才在未來版本整段移除（見 CHANGELOG）。
    if (!EnableWorkerIntercept) return
    try {
        const OriginalWorker = unsafeWindow.Worker
        if (!OriginalWorker || OriginalWorker.__biliCdnPatched) return

        const preferred = [...new Set(PREFERRED_CDN_LIST.filter(isValidCustomCdnHost))]
        const targetHost = getWorkerCdnTarget()
        if (!isValidCustomCdnHost(targetHost)) return
        const forceList = getWorkerForceList()

        const sharedWorkerPatch = (originalUrl, capability) => `
const BILICDN_BASE = ${JSON.stringify(originalUrl)};
const BILICDN_BOOTSTRAP_TOKEN = ${JSON.stringify(capability)};
const BILICDN_CATALOG = Object.freeze(${JSON.stringify([...TRUSTED_CDN_CATALOG])});
const BILICDN_CATALOG_SET = new Set(BILICDN_CATALOG);
const BILICDN_PCDN_SUFFIXES = Object.freeze(${JSON.stringify([...PCDN_SOURCE_SUFFIXES])});
const BILICDN_PCDN_HOSTS = new Set(${JSON.stringify([...PCDN_SOURCE_HOSTS])});
const BILICDN_URL_MAX = 16 * 1024;
const BILICDN_BYTES_MAX = 256 * 1024 * 1024;
const BILICDN_STAT_MAX = 10000;
const BILICDN_REPORT_MS = 200;
let BILICDN_TARGET_HOST = ${JSON.stringify(targetHost)};
let BILICDN_FORCE = ${JSON.stringify(forceList)};
let BILICDN_PREFERRED = ${JSON.stringify(preferred)};
let BILICDN_EXCLUDED = ${JSON.stringify(TRUSTED_CDN_CATALOG.filter(matchesExclude))};
let BILICDN_DISABLED = false;
let BILICDN_CONTROL_PORT = null;
let BILICDN_STAT = { netCalls: 0, mediaSeen: 0, rewrites: 0 };
let BILICDN_STAT_TIMER = null;
const BILICDN_NATIVE_ADD_EVENT = self.addEventListener.bind(self);
const BILICDN_NATIVE_REMOVE_EVENT = self.removeEventListener.bind(self);
const BILICDN_NATIVE_STOP_IMMEDIATE = typeof Event !== 'undefined'
    && Event.prototype && Event.prototype.stopImmediatePropagation;
const biliCdnCatalogArray = (value) => {
    if (!Array.isArray(value) || value.length > BILICDN_CATALOG.length) return null;
    const out = [];
    for (const entry of value) {
        if (typeof entry !== 'string') return null;
        const host = entry.trim().toLowerCase();
        if (!BILICDN_CATALOG_SET.has(host)) return null;
        if (out.indexOf(host) === -1) out.push(host);
    }
    return out;
};
const biliCdnApplyPolicy = (data) => {
    if (!data || data.version !== 1 || data.type !== 'policy'
        || typeof data.target !== 'string' || !BILICDN_CATALOG_SET.has(data.target)
        || typeof data.disabled !== 'boolean') return false;
    const preferredNext = biliCdnCatalogArray(data.preferred);
    const forceNext = biliCdnCatalogArray(data.force);
    const excludedNext = biliCdnCatalogArray(data.excluded);
    if (!preferredNext || !forceNext || !excludedNext) return false;
    BILICDN_TARGET_HOST = data.target;
    BILICDN_PREFERRED = preferredNext;
    BILICDN_FORCE = forceNext;
    BILICDN_EXCLUDED = excludedNext;
    BILICDN_DISABLED = data.disabled;
    return true;
};
const biliCdnPostPrivate = (message) => {
    if (!BILICDN_CONTROL_PORT) return false;
    try { BILICDN_CONTROL_PORT.postMessage(message); return true; } catch (e) { return false; }
};
const biliCdnFlushStat = () => {
    if (!BILICDN_STAT.netCalls && !BILICDN_STAT.mediaSeen && !BILICDN_STAT.rewrites) return;
    if (biliCdnPostPrivate({
        version: 1, type: 'stats',
        netCalls: BILICDN_STAT.netCalls,
        mediaSeen: BILICDN_STAT.mediaSeen,
        rewrites: BILICDN_STAT.rewrites,
    })) BILICDN_STAT = { netCalls: 0, mediaSeen: 0, rewrites: 0 };
};
const biliCdnBumpStat = (key) => {
    if (!Object.prototype.hasOwnProperty.call(BILICDN_STAT, key)) return;
    BILICDN_STAT[key] = Math.min(BILICDN_STAT_MAX, BILICDN_STAT[key] + 1);
    if (!BILICDN_STAT_TIMER) {
        BILICDN_STAT_TIMER = setTimeout(() => { BILICDN_STAT_TIMER = null; biliCdnFlushStat(); }, BILICDN_REPORT_MS);
    }
};
const biliCdnBootstrap = (event) => {
    const data = event && event.data;
    const ports = event && event.ports;
    if (BILICDN_CONTROL_PORT || !data || data.__biliCdnBootstrap !== BILICDN_BOOTSTRAP_TOKEN
        || !ports || ports.length !== 1 || !ports[0]) return;
    try {
        if (typeof BILICDN_NATIVE_STOP_IMMEDIATE === 'function') BILICDN_NATIVE_STOP_IMMEDIATE.call(event);
        else event.stopImmediatePropagation();
    } catch (e) {
        try { event.stopImmediatePropagation(); } catch (e2) {}
    }
    BILICDN_CONTROL_PORT = ports[0];
    BILICDN_CONTROL_PORT.onmessage = (portEvent) => { biliCdnApplyPolicy(portEvent && portEvent.data); };
    try { BILICDN_CONTROL_PORT.start(); } catch (e) {}
    BILICDN_NATIVE_REMOVE_EVENT('message', biliCdnBootstrap);
    biliCdnFlushStat();
};
BILICDN_NATIVE_ADD_EVENT('message', biliCdnBootstrap);
// Worker 被包成 blob 之後 self.location 會變成 blob:https://...，相對 URL 必須用原 script 當基準。
const biliCdnAbs = (url) => {
    const raw = String(url);
    if (!raw || raw.length > BILICDN_URL_MAX) return null;
    try { return new URL(raw, BILICDN_BASE).href; } catch { return null; }
};
const biliCdnHostSuffix = (host, suffix) => host === suffix || host.endsWith('.' + suffix);
const biliCdnIsUnstable = (host) => {
    if (!host) return false;
    const normalized = String(host).toLowerCase();
    const first = normalized.split('.')[0];
    return /\\.mcdn\\.bilivideo\\.(cn|com|net)$/i.test(normalized)
        || BILICDN_PCDN_SUFFIXES.some((suffix) => biliCdnHostSuffix(normalized, suffix))
        || BILICDN_PCDN_HOSTS.has(normalized)
        || (first.startsWith('upos-') && first.includes('302'))
        || (/^cn-[a-z]{2,8}-/i.test(normalized) && normalized.endsWith('.bilivideo.com'));
};
const BILICDN_MEDIA_POLICY = (${createMediaUrlPolicy.toString()})();
const biliCdnClassify = (url) => BILICDN_MEDIA_POLICY.classify(url).kind;
const biliCdnNoteSeg = (url, bytes) => {
    if (!Number.isFinite(bytes) || !Number.isInteger(bytes) || bytes <= 0 || bytes > BILICDN_BYTES_MAX) return;
    try {
        const host = new URL(url).hostname.toLowerCase();
        if (BILICDN_CATALOG_SET.has(host)) {
            biliCdnPostPrivate({ version: 1, type: 'bytes', host, bytes });
        }
    } catch (e) {}
};
const biliCdnIsMedia = (url) => {
    if (typeof url !== 'string' || !url || url.length > BILICDN_URL_MAX) return false;
    try {
        const u = new URL(url);
        const host = u.hostname;
        const verdict = biliCdnClassify(url);
        if (verdict === 'pcdn' || verdict === 'suspected-pcdn' || verdict === 'live') return true;
        if (!(host.endsWith('.bilivideo.com') || host.endsWith('.bilivideo.cn') || host.endsWith('.bilivideo.net'))) return false;
        return /\\.(m4s|mp4|flv|m3u8)$/i.test(u.pathname) || u.pathname.includes('/upgcxcode/');
    } catch { return false; }
};
const biliCdnNeedsRedirect = (host, verdict) =>
    !!host && (verdict === 'pcdn' || biliCdnIsUnstable(host) || BILICDN_EXCLUDED.indexOf(host) !== -1
        || BILICDN_FORCE.indexOf(host) !== -1
        || BILICDN_PREFERRED.indexOf(host) === -1);
const biliCdnRewrite = (url) => {
    try {
        if (BILICDN_DISABLED) return url;
        biliCdnBumpStat('netCalls');
        const absolute = biliCdnAbs(url);
        if (!absolute || !biliCdnIsMedia(absolute)) return url;
        biliCdnBumpStat('mediaSeen');
        const parsed = new URL(absolute);
        const verdict = biliCdnClassify(absolute);
        if (BILICDN_MEDIA_POLICY.decide(absolute).action !== 'rewrite') return url;
        // /v1/resource 是 PCDN 專用簽名路徑；target 則在真正的 URL.hostname sink 再驗證一次。
        if (/^\\/v1\\/resource/.test(parsed.pathname)) return absolute;
        if (!biliCdnNeedsRedirect(parsed.hostname, verdict) || parsed.hostname === BILICDN_TARGET_HOST) return absolute;
        if (!BILICDN_CATALOG_SET.has(BILICDN_TARGET_HOST)) return absolute;
        parsed.hostname = BILICDN_TARGET_HOST;
        parsed.port = '';
        if (parsed.href.length > BILICDN_URL_MAX) return url;
        biliCdnBumpStat('rewrites');
        return parsed.toString();
    } catch { return url; }
};
if (self.fetch) {
    const OriginalFetch = self.fetch.bind(self);
    const biliCdnCloneResponse = (resp, body) => {
        const out = new Response(body, { status: resp.status, statusText: resp.statusText, headers: resp.headers });
        ['url', 'redirected', 'type'].forEach((key) => {
            try { Object.defineProperty(out, key, { value: resp[key], configurable: true }); } catch (e) {}
        });
        return out;
    };
    self.fetch = (input, init) => {
        const url = input instanceof Request ? input.url : String(input);
        const rewritten = biliCdnRewrite(url);
        if (rewritten !== url && input instanceof Request) {
            input = new Request(rewritten, {
                method: input.method,
                headers: input.headers,
                body: (input.method === 'GET' || input.method === 'HEAD') ? undefined : input.body,
                mode: input.mode === 'navigate' ? 'same-origin' : input.mode,
                credentials: input.credentials,
                cache: input.cache,
                redirect: input.redirect,
                referrer: input.referrer,
                referrerPolicy: input.referrerPolicy,
                integrity: input.integrity,
                keepalive: input.keepalive,
                signal: input.signal,
            });
        } else if (rewritten !== url) {
            input = rewritten;
        }
        return OriginalFetch(input, init).then((resp) => {
            try {
                const mediaUrl = resp && (resp.url || rewritten);
                if (!resp || !resp.body || typeof resp.body.getReader !== 'function'
                    || typeof ReadableStream === 'undefined' || !biliCdnIsMedia(mediaUrl)) return resp;

                // 不使用 tee()：呼叫端取消 body 時直接 cancel 原始 reader，避免 Worker
                // 量測分支在 seek 後繼續把舊 segment 讀完。
                const reader = resp.body.getReader();
                let pending = 0, lastReport = 0;
                const flush = (force) => {
                    const now = Date.now();
                    if (!pending) return;
                    if (!force && now - lastReport < BILICDN_REPORT_MS) return;
                    lastReport = now;
                    biliCdnNoteSeg(mediaUrl, pending);
                    pending = 0;
                };
                const body = new ReadableStream({
                    pull(controller) {
                        return reader.read().then(({ done, value }) => {
                            if (done) { flush(true); controller.close(); return; }
                            if (value && value.byteLength) { pending += value.byteLength; flush(false); }
                            if (value !== undefined) controller.enqueue(value);
                        }).catch((error) => { flush(true); controller.error(error); });
                    },
                    cancel(reason) {
                        flush(true);
                        try { return Promise.resolve(reader.cancel(reason)).catch(() => {}); }
                        catch (e) { return Promise.resolve(); }
                    },
                });
                return biliCdnCloneResponse(resp, body);
            } catch (e) {
                return resp;
            }
        });
    };
}
if (self.XMLHttpRequest) {
    const OriginalXHR = self.XMLHttpRequest;
    self.XMLHttpRequest = class XMLHttpRequest extends OriginalXHR {
        open(method, url, ...rest) {
            const rewritten = biliCdnRewrite(String(url));
            try {
                let lastLoaded = 0;
                // XHR 的 'load' 要等整包下載完才觸發，跟主執行緒同樣的問題：大 segment 下載
                // 期間主執行緒完全看不到進度。改掛 'progress'，用累計 loaded 的增量即時回報。
                this.addEventListener('progress', (e) => {
                    try {
                        if (!e || e.isTrusted !== true) return;
                        if (!biliCdnIsMedia(rewritten)) return;
                        const loaded = (e && e.loaded) || 0;
                        const delta = loaded - lastLoaded;
                        if (delta > 0) { lastLoaded = loaded; biliCdnNoteSeg(rewritten, delta); }
                    } catch (e) {}
                });
                this.addEventListener('load', (e) => {
                    try {
                        if (!e || e.isTrusted !== true) return;
                        if (!biliCdnIsMedia(rewritten)) return;
                        const cl = this.getResponseHeader && this.getResponseHeader('content-length');
                        let n = cl ? parseInt(cl, 10) : 0;
                        if (!n && this.response) {
                            if (this.response.byteLength) n = this.response.byteLength;
                            else if (typeof this.response === 'string') n = this.response.length;
                        }
                        // progress 已經逐步報過 lastLoaded，這裡只補沒被 progress 算到的尾巴，避免重複入帳
                        const remaining = Math.max(0, n - lastLoaded);
                        if (remaining) biliCdnNoteSeg(rewritten, remaining);
                    } catch (e) {}
                });
            } catch (e) {}
            return super.open(method, rewritten, ...rest);
        }
    };
}
`

        const classicWorkerPatch = (originalUrl, capability) => `
(() => {
${sharedWorkerPatch(originalUrl, capability)}
const BiliCdnOriginalImportScripts = self.importScripts.bind(self);
self.importScripts = (...urls) => BiliCdnOriginalImportScripts(...urls.map((url) => {
    try { return new URL(url, BILICDN_ORIGINAL).href; } catch { return url; }
}));
const BILICDN_ORIGINAL = ${JSON.stringify(originalUrl)};
BiliCdnOriginalImportScripts(BILICDN_ORIGINAL);
})();
`

        const moduleWorkerPatch = (originalUrl, capability) => `
(() => {
${sharedWorkerPatch(originalUrl, capability)}
})();
import(${JSON.stringify(originalUrl)}).catch((e) => { try { console.error('[BiliCDN] worker module import 失敗', e); } catch (e2) {} });
`

        const OriginalWorkerPostMessage = OriginalWorker.prototype.postMessage
        const OriginalWorkerTerminate = OriginalWorker.prototype.terminate
        const NativeMessageChannel = typeof MessageChannel === 'function' ? MessageChannel : null
        const NativeBlob = typeof Blob === 'function' ? Blob : null
        const NativeCreateObjectURL = URL && typeof URL.createObjectURL === 'function'
            ? URL.createObjectURL.bind(URL)
            : null
        const NativeRevokeObjectURL = URL && typeof URL.revokeObjectURL === 'function'
            ? URL.revokeObjectURL.bind(URL)
            : null
        const NativeGetRandomValues = typeof crypto !== 'undefined' && crypto
            && typeof crypto.getRandomValues === 'function'
            ? crypto.getRandomValues.bind(crypto)
            : null

        const createWorkerCapability = () => {
            if (!NativeGetRandomValues) return null
            try {
                const bytes = new Uint8Array(16)
                NativeGetRandomValues(bytes)
                return [...bytes].map(value => value.toString(16).padStart(2, '0')).join('')
            } catch { return null }
        }

        const isBoundedWorkerStat = value => Number.isInteger(value) && value >= 0 && value <= 10000
        const hasExactWorkerKeys = (value, keys) => {
            if (!value || typeof value !== 'object' || Array.isArray(value)) return false
            const actual = Object.keys(value).sort()
            const expected = [...keys].sort()
            return actual.length === expected.length && actual.every((key, index) => key === expected[index])
        }
        const handlePrivateWorkerReport = data => {
            if (disabled) return false
            if (hasExactWorkerKeys(data, ['version', 'type', 'host', 'bytes'])
                && data.version === 1 && data.type === 'bytes'
                && isValidCustomCdnHost(data.host)
                && Number.isInteger(data.bytes) && data.bytes > 0 && data.bytes <= 256 * 1024 * 1024) {
                if (Watchdog && Watchdog.noteExternalBytes) Watchdog.noteExternalBytes(data.host, data.bytes)
                // The existing Worker protocol carries no representation identity or kind.
                mediaObservations.unknown = { host: data.host, classification: 'catalog', source: 'worker', kind: 'unknown',
                    height: 0, observedAt: Date.now(), bytes: data.bytes, generation: runtimeGeneration, epoch: playinfoEpoch }
                bumpWorkerStats({ bytes: data.bytes })
                return true
            }
            if (hasExactWorkerKeys(data, ['version', 'type', 'netCalls', 'mediaSeen', 'rewrites'])
                && data.version === 1 && data.type === 'stats'
                && isBoundedWorkerStat(data.netCalls)
                && isBoundedWorkerStat(data.mediaSeen)
                && isBoundedWorkerStat(data.rewrites)) {
                bumpWorkerStats({
                    netCalls: data.netCalls,
                    mediaSeen: data.mediaSeen,
                    rewrites: data.rewrites,
                })
                return true
            }
            return false
        }

        const cleanupWorker = worker => {
            const record = workerControlPorts.get(worker)
            biliCdnWorkers.delete(worker)
            workerControlPorts.delete(worker)
            if (!record) return
            try { if (record.revokeTimer) clearTimeout(record.revokeTimer) } catch {}
            try { if (record.port) record.port.close() } catch {}
            try { if (record.blobUrl && NativeRevokeObjectURL) NativeRevokeObjectURL(record.blobUrl) } catch {}
        }

        const registerWorker = (worker, capability, blobUrl) => {
            if (!NativeMessageChannel || typeof OriginalWorkerPostMessage !== 'function') return false
            let channel = null
            try {
                channel = new NativeMessageChannel()
                const record = { port: channel.port1, blobUrl, revokeTimer: null }
                workerControlPorts.set(worker, record)
                biliCdnWorkers.add(worker)
                channel.port1.onmessage = event => { handlePrivateWorkerReport(event && event.data) }
                try { channel.port1.start() } catch {}
                OriginalWorkerPostMessage.call(worker, { __biliCdnBootstrap: capability }, [channel.port2])
                const policy = buildWorkerPolicy()
                if (!policy) throw new Error('invalid initial Worker policy')
                channel.port1.postMessage(policy)
                record.revokeTimer = setTimeout(() => {
                    record.revokeTimer = null
                    try { if (NativeRevokeObjectURL) NativeRevokeObjectURL(blobUrl) } catch {}
                    record.blobUrl = ''
                }, 5 * 60 * 1000)
                return true
            } catch {
                try { if (channel && channel.port1) channel.port1.close() } catch {}
                try { if (channel && channel.port2) channel.port2.close() } catch {}
                cleanupWorker(worker)
                return false
            }
        }

        unsafeWindow.Worker = class Worker extends OriginalWorker {
            constructor(scriptURL, options) {
                if (disabled) return super(scriptURL, options)
                let originalUrl, source, blobUrl, capability
                try {
                    originalUrl = new URL(String(scriptURL), location.href).href
                    if (originalUrl.startsWith('blob:') || originalUrl.startsWith('data:')) {
                        return super(scriptURL, options)
                    }
                    const isModule = !!(options && options.type === 'module')
                    if (isModule && new URL(originalUrl).origin !== location.origin) {
                        return super(scriptURL, options)
                    }
                    capability = createWorkerCapability()
                    // 安全亂數、Blob 或私有 MessagePort 任一不可用時，不做功能較弱的降級攔截。
                    if (!capability || !NativeBlob || !NativeCreateObjectURL || !NativeMessageChannel) {
                        return super(scriptURL, options)
                    }
                    log('[Worker] patched: ' + originalUrl)
                    source = isModule
                        ? moduleWorkerPatch(originalUrl, capability)
                        : classicWorkerPatch(originalUrl, capability)
                    const blob = new NativeBlob([source], { type: 'application/javascript' })
                    blobUrl = NativeCreateObjectURL(blob)
                } catch {
                    return super(scriptURL, options)
                }
                const worker = super(blobUrl, options)
                if (!registerWorker(worker, capability, blobUrl)) {
                    try {
                        if (typeof OriginalWorkerTerminate === 'function') OriginalWorkerTerminate.call(worker)
                    } catch {}
                    try { if (NativeRevokeObjectURL) NativeRevokeObjectURL(blobUrl) } catch {}
                    return new OriginalWorker(scriptURL, options)
                }
                bumpWorkerStats({ created: 1, sample: originalUrl })
                return worker
            }

            terminate() {
                cleanupWorker(this)
                if (typeof OriginalWorkerTerminate === 'function') {
                    return OriginalWorkerTerminate.call(this)
                }
            }
        }
        unsafeWindow.Worker.__biliCdnPatched = true
    } catch (e) {}
}
setupClassicWorkerIntercept()

// DOM 工具
const waitForElm = (selector, timeoutMs) => new Promise((resolve, reject) => {
    const ele = document.querySelector(selector)
    if (ele) return resolve(ele)
    let timer = null
    const observer = new MutationObserver(() => {
        const found = document.querySelector(selector)
        if (found) {
            observer.disconnect()
            if (timer) clearTimeout(timer)
            resolve(found)
        }
    })
    observer.observe(document.documentElement, { childList: true, subtree: true })
    if (timeoutMs) {
        timer = setTimeout(() => {
            observer.disconnect()
            reject(new Error('等待元素逾時：' + selector))
        }, timeoutMs)
    }
})

function fromHTML(html) {
    const template = document.createElement('template')
    template.innerHTML = html
    const result = template.content.children
    return result.length === 1 ? result[0] : result
}

// ── CDN 延遲探測 ──────────────────────────────────────────────────────
// 1. 結果快取 2h，保留穩定排序但避免網路環境變動後卡太久
// 2. 已知死節點 short-circuit，不發任何請求（任何失敗請求瀏覽器都會印紅字，
//    唯一根治就是「不發」）
// 3. 探測路徑用 /crossdomain.xml —— 這是關鍵，見下面 PROBE_PATH 的說明
// 4. 單一 no-cors fetch 同時取得「可達性」與「延遲」：resolve = 伺服器有回應
//    （含 4xx/5xx，opaque response 讀不到狀態碼但那不重要）；reject = 網路層
//    失敗（DNS / 連線被拒 / TLS）。不再需要「Image 探測 + 另一發確認請求」兩步。
//
// ★ 為什麼是 /crossdomain.xml 而不是 /favicon.ico
// 舊版探測 /favicon.ico，但 upos CDN 上**沒有這個檔案**：實測 aliov / cos 回 403、
// ali 回 405。也就是說每一輪探測都會對每個「健康的」節點打出一個必定失敗的請求，
// 而瀏覽器對任何非 2xx 的子資源都會在 console 印一行紅字
// （`Failed to load resource: the server responded with a status of 403`）。
// 使用者看到的紅字有一大半是探測機制自己製造的，跟節點好壞完全無關。
//
// /crossdomain.xml 是 Flash 時代留下來的跨網域政策檔，這些 CDN 至今仍然供應，
// 實測 aliov / ali / cos 以及 Akamai 都回 200（約 250~950 bytes，帶 cache-buster
// 查詢參數也照樣 200）。改用它之後，健康節點的探測是安靜的 —— 紅字只會出現在
// 「這個節點真的有問題」的時候，那時候印出來反而是有用的訊號。
// （upos-sz-mirrorhw 是 TCP 連線直接被丟掉、10 秒不回應，跟路徑無關，本來就該被標死。）
const PROBE_PATH       = '/crossdomain.xml'
const PROBE_CACHE_KEY  = 'probeCache_v1'
const PROBE_CACHE_TTL  = 2 * 60 * 60 * 1000
// 從 1200ms → 2000ms → 8000ms。前兩次都調得不夠，而且不夠的理由一樣：拿**暖機**
// 往返時間去訂一個**永遠發生在冷連線上**的窗口。探測之所以要探測，正是因為那個 host
// 當下沒有熱連線，所以它遇到的必然是冷路徑。curl 實測冷 TLS 握手：ali 6.4 秒、
// 08c 7.9 秒、hw 8.8 秒（暖機後 ali 才 0.35~0.56 秒）。2000ms 的窗對 ali 是**必定逾時**，
// 於是每輪探測都把一台好節點丟進 5 分鐘軟隔離——使用者實測回報的
// `軟隔離（session）: ['upos-sz-mirrorali', ...]` 就是它。
// 8000ms 涵蓋真實候選節點的冷握手，又低於 CONFIRM_TIMEOUT_MS（10 秒）保留確認空間。
// 探測不在起播關鍵路徑上（見 deferStartupProbes）且各候選並行，多等這幾秒沒有代價。
const PROBE_TIMEOUT_MS = 8000
// 「連得到、但比探測窗還慢」要連續兩輪才軟隔離。一次慢有太多無辜的原因（冷握手、
// 頁面自己正在搶連線配額），而軟隔離 5 分鐘等於這段時間完全不考慮這個節點。
// 跟 PROBE_TIMEOUT_STRIKES 同一個原則：證據強度要配得上處分。
const PROBE_SLOW_STRIKES = 2
// 探測逾時 + 確認也連不到 = 完全沒有回應。這是「很可能壞了」，但不是鐵證：
// 起播當下頁面自己也在搶頻寬與連線配額，偶爾整個窗口都撞上並非不可能。
// 而標死的代價是不再使用一個**好**節點——使用者實測回報過 upos-sz-mirrorali 被這樣
// 誤殺（它 DNS 解得到、/crossdomain.xml 回 200）。
// 改成多次才定罪：前幾次只軟隔離觀察 10 分鐘，任何一次成功都會把計數歸零。
// 注意這只放寬「逾時」這條路——fetch 被 reject（DNS/連線被拒/TLS）本來就是明確的網路層
// 失敗，而且已經另外再確認過一次，維持一次定罪。
//
// ★ 2026-08-19 實測修正：舊值（strikes=2、confirm 4 秒 ⇒ 單輪預算 2+4=6 秒）**還是不夠**，
// 而且不夠的方式是系統性的。用 curl 從台灣量到的是：暖機後 ali 約 0.35~0.56 秒沒錯，
// 但**冷 TLS 握手** ali 要 6.4 秒、08c 7.9 秒、hw 8.8 秒。也就是說只要探測撞上冷連線，
// 2 秒的探測窗與 4 秒的確認窗會**一起**爆掉，兩輪就湊滿 2 strike 判死 7 天——
// 使用者瀏覽器裡當場就是這個狀態（dead 清單有 ali，reason=timeout）。
// 調參原則：**判死的時間預算必須大於冷 TLS 的實測上界，而不是大於暖機 RTT。**
const PROBE_TIMEOUT_STRIKES = 3
// 確認窗。要大於冷 TLS 的實測上界（8.8 秒），否則確認本身就會把冷連線判成不可達。
const CONFIRM_TIMEOUT_MS = 10000

// 確認 host 是否真的連得到：no-cors fetch 在「伺服器有回應（含 4xx/5xx）」時 resolve，
// 只有「DNS 失敗 / 連線被拒 / TLS 失敗」等網路層錯誤才 reject。
// 用來在「探測失敗了，但到底是節點壞了還是只是這次不順」之間做最後判斷，避免誤殺好節點。
// 路徑跟 probeCdnLatency 一樣走 PROBE_PATH（見上面說明）：對健康節點是 200，不印紅字。
const confirmHostReachable = (cdn, timeoutMs, runtimeToken = captureRuntimeGeneration()) => new Promise((resolve) => {
    if (!isRuntimeGenerationActive(runtimeToken)) return resolve(null)
    let settled = false
    let to = null
    let detachRuntimeAbort = () => {}
    const done = (v) => {
        if (settled) return
        settled = true
        clearRuntimeTimeout(to)
        detachRuntimeAbort()
        resolve(v)
    }
    let ctrl = null
    try { ctrl = new AbortController() } catch {}
    const onRuntimeAbort = () => { try { ctrl && ctrl.abort() } catch {} ; done(null) }
    if (runtimeToken.signal) {
        if (runtimeToken.signal.aborted) return done(null)
        runtimeToken.signal.addEventListener('abort', onRuntimeAbort, { once: true })
        detachRuntimeAbort = () => runtimeToken.signal.removeEventListener('abort', onRuntimeAbort)
    }
    to = scheduleRuntimeTimeout(() => { try { ctrl && ctrl.abort() } catch {} ; done(false) }, timeoutMs || 4000)
    interceptNetResponse.rawFetch('https://' + cdn + PROBE_PATH + '?_c=' + Date.now(), {
        method: 'GET', mode: 'no-cors', cache: 'no-store',
        credentials: 'omit', referrerPolicy: 'no-referrer',
        signal: ctrl ? ctrl.signal : undefined,
    }).then(() => { done(isRuntimeGenerationActive(runtimeToken) ? true : null) })
      .catch(() => { done(isRuntimeGenerationActive(runtimeToken) ? false : null) })
})

// ── segment 連線層失敗處理（v1.3.3）──────────────────────────────────
// XHR 的 error 事件與 fetch 的 reject 都拿不到瀏覽器的真實原因——ERR_NAME_NOT_RESOLVED
// 這類訊息只會印在 console，程式讀不到，status 一律是 0。唯一能用的線索是
// 「一個位元組都沒收到」：那代表連線根本沒建立（DNS／連線被拒／TLS），而不是傳到一半斷掉。
//
// 這種失敗跟壅塞的性質完全不同：它 100% 會重演。既有的 recordCdnFailure() 只會軟隔離
// 兩分鐘，等於每次起播、每次 seek 都要再撞一次同一顆爛節點，播放器得先等這次失敗才會
// 去試 backup_url——使用者看到的就是轉圈圈。所以這裡確認真的連不到就直接標死（30 天，
// 之後 needsRedirect() 會讓所有指向它的 segment 自動改寫掉），並立刻重排候選、預連線。
const segConnCheckAt = new Map()   // host -> 上次確認時間
const SEG_CONN_CHECK_COOLDOWN = 30 * 1000
const handleSegmentConnError = (cdn, bytesReceived) => {
    if (disabled || !cdn) return
    const runtimeToken = captureRuntimeGeneration()
    if (!isRuntimeGenerationActive(runtimeToken)) return
    // 收過位元組 = 連線建立過，是傳輸中斷（網路抖動、切畫質、播放器自己取消），
    // 不屬於這裡要處理的情況，交還既有的軟懲罰。
    if (bytesReceived > 0) return
    if (knownDeadHosts.has(cdn) || blacklistSet.has(cdn)) return
    // 起播時播放器會同時併發好幾顆 segment，全部失敗 → 不做節流會一次打出十幾個確認請求。
    const now  = Date.now()
    const last = segConnCheckAt.get(cdn) || 0
    if (now - last < SEG_CONN_CHECK_COOLDOWN) return
    segConnCheckAt.set(cdn, now)
    // 同上：已知不解析的 host 不必再確認一次。
    if (isPresumedDnsFailHost(cdn)) {
        markHostDead(cdn, 'DNS-segment')
        log('[死節點] 已知在台灣不解析的節點又被指派到 segment，直接標死：' + cdn.split('.')[0])
        promoteBestCdnNow()
        return
    }
    // 2026-08-19：確認窗從 2 秒拉到 CONFIRM_TIMEOUT_MS。冷 TLS 握手實測上界 8.8 秒，
    // 2 秒的窗會把「還在握手」的好節點判成「連不到」然後標死 30 天。見 PROBE_TIMEOUT_STRIKES。
    confirmHostReachable(cdn, CONFIRM_TIMEOUT_MS, runtimeToken).then((reachable) => {
        if (!isRuntimeGenerationActive(runtimeToken) || reachable == null) return
        // 連得到 → 只是這一次請求出事（伺服器主動斷線之類），recordCdnFailure 已經記過帳，
        // 不需要也不應該升級成標死。
        if (reachable) return
        markHostDead(cdn, 'DNS-segment')
        log('[死節點] segment 連線層失敗且確認連不到，標死 30 天：' + cdn.split('.')[0])
        promoteBestCdnNow()
    })
}

const probeCdnLatency = (cdn, runtimeToken = captureRuntimeGeneration()) => new Promise((resolve) => {
    if (!isRuntimeGenerationActive(runtimeToken)) return resolve({ cdn, ms: Infinity, cancelled: true })
    if (knownDeadHosts.has(cdn)) return resolve({ cdn, ms: Infinity })

    const t0 = performance.now()
    let done = false
    let timedOut = false
    let timer = null
    let detachRuntimeAbort = () => {}
    const finish = (result) => {
        if (done) return
        done = true
        clearRuntimeTimeout(timer)
        detachRuntimeAbort()
        if (isRuntimeGenerationActive(runtimeToken)) DiagnosticLog.record('measurement', {
            host: cdn, reason: Number.isFinite(result.ms) ? 'latency-only' : result.cancelled ? 'cancelled' : 'failed',
            waitMs: Number.isFinite(result.ms) ? result.ms : null,
        })
        resolve(Object.assign({ cdn }, result))
    }
    let ctrl = null
    try { ctrl = new AbortController() } catch {}
    const onRuntimeAbort = () => { try { ctrl && ctrl.abort() } catch {} ; finish({ ms: Infinity, cancelled: true }) }
    if (runtimeToken.signal) {
        runtimeToken.signal.addEventListener('abort', onRuntimeAbort, { once: true })
        detachRuntimeAbort = () => runtimeToken.signal.removeEventListener('abort', onRuntimeAbort)
    }
    timer = scheduleRuntimeTimeout(() => {
        if (!isRuntimeGenerationActive(runtimeToken)) return finish({ ms: Infinity, cancelled: true })
        timedOut = true
        try { ctrl && ctrl.abort() } catch {}
        // 逾時不直接標死：可能只是當下壅塞。再用較長時間確認真的連不到才標死。
        // 10 秒（不是 4 秒）：實測冷 TLS 握手的上界約 8.8 秒（hw）／6.4 秒（ali），
        // 確認窗必須完整涵蓋它，否則「冷連線」會被當成「連不到」。見 PROBE_TIMEOUT_STRIKES。
        confirmHostReachable(cdn, CONFIRM_TIMEOUT_MS, runtimeToken).then((reachable) => {
            if (!isRuntimeGenerationActive(runtimeToken) || reachable == null) {
                finish({ ms: Infinity, cancelled: true })
                return
            }
            if (reachable) {
                // 確認成功 = 這台其實連得到，只是比探測窗慢。
                // 記錄**真實耗時**而不是捏造一個平坦的 PROBE_TIMEOUT_MS：後者會讓所有
                // 逾時節點看起來一樣慢，也讓 EWMA 收到一個假數字（使用者實測看到的
                // `ali: latency 1701` 就是這樣被摻出來的，那不是任何一次真實量測）。
                const slowMs = Math.max(performance.now() - t0, PROBE_TIMEOUT_MS)
                recordCdnLatency(cdn, slowMs)
                // recordCdnLatency 會重置 probeTimeouts，所以慢速計數要另外記、且在它之後加。
                const hs = ensureCdnHealth(cdn)
                hs.probeSlows = Math.min(CDN_HEALTH_CAPS.probeSlows, (hs.probeSlows || 0) + 1)
                hs.lastProbeAt = Date.now()
                scheduleCdnHealthSave()
                if (hs.probeSlows >= PROBE_SLOW_STRIKES) {
                    softBlockCdn(cdn, 'probe-slow', 5 * 60 * 1000)
                }
                finish({ ms: slowMs })
            } else {
                const h = ensureCdnHealth(cdn)
                h.probeTimeouts = Math.min(CDN_HEALTH_CAPS.probeTimeouts, (h.probeTimeouts || 0) + 1)
                h.lastProbeAt = Date.now()
                scheduleCdnHealthSave()
                if (h.probeTimeouts >= PROBE_TIMEOUT_STRIKES) {
                    markHostDead(cdn, 'timeout')
                    finish({ ms: Infinity, reason: 'timeout' })
                } else {
                    // 第一次：只軟隔離觀察，仍留在候選池裡等下一輪重新評估。
                    softBlockCdn(cdn, 'probe-timeout', 10 * 60 * 1000)
                    finish({ ms: PROBE_TIMEOUT_MS, reason: 'timeout-1st' })
                }
            }
        })
    }, PROBE_TIMEOUT_MS)

    interceptNetResponse.rawFetch('https://' + cdn + PROBE_PATH + '?_t=' + Date.now(), {
        method: 'GET', mode: 'no-cors', cache: 'no-store',
        credentials: 'omit', referrerPolicy: 'no-referrer',
        signal: ctrl ? ctrl.signal : undefined,
    }).then(() => {
        // resolve = 伺服器有回應（健康節點是 200，安靜）→ 可達，這段時間就是延遲。
        if (timedOut) return
        if (!isRuntimeGenerationActive(runtimeToken)) return finish({ ms: Infinity, cancelled: true })
        const ms = Math.max(performance.now() - t0, 1)
        recordCdnLatency(cdn, ms)
        // 這一輪在窗內回應了 → 連續慢速計數歸零（跟 probeTimeouts 的處理方式一致）。
        const hf = cdnHealth[cdn]
        if (hf && hf.probeSlows) { hf.probeSlows = 0; scheduleCdnHealthSave() }
        finish({ ms })
    }).catch(() => {
        // reject = 網路層失敗（DNS / 連線被拒 / TLS）。
        if (timedOut) return
        if (!isRuntimeGenerationActive(runtimeToken)) return finish({ ms: Infinity, cancelled: true })
        // 已知在台灣不解析、本機又從無成功紀錄 → 直接判定，不必再確認一次。
        if (isPresumedDnsFailHost(cdn)) {
            markHostDead(cdn, 'DNS')
            finish({ ms: Infinity, reason: 'DNS' })
            return
        }
        // 其他 host 再確認一次才標死：單一次網路層失敗也可能只是瞬間抖動，
        // 而標死的代價是 7~30 天不再使用這個節點，誤判的傷害遠大於多發一個請求。
        // 這個情境下 console 本來就已經有一行紅字了，多一行不改變什麼。
        // 同上：2.5 秒不足以涵蓋冷 TLS 握手（實測上界 8.8 秒），改用 CONFIRM_TIMEOUT_MS。
        confirmHostReachable(cdn, CONFIRM_TIMEOUT_MS, runtimeToken).then((reachable) => {
            if (!isRuntimeGenerationActive(runtimeToken) || reachable == null) {
                finish({ ms: Infinity, cancelled: true })
                return
            }
            if (reachable) {
                const ms = Math.max(performance.now() - t0, 1)
                recordCdnLatency(cdn, ms)
                finish({ ms })
            } else {
                markHostDead(cdn, 'DNS')
                finish({ ms: Infinity, reason: 'DNS' })
            }
        })
    })
})

// ── CDN 吞吐量賽馬（informed init）─────────────────────────────────────
// 延遲（探測 RTT）≠ 下載速度；跨國選節點真正決定卡不卡的是吞吐量。
// 拿攔截到的「真實 segment URL」對候選做小範圍 ranged GET，量實際 Mbps，
// seed 進 cdnHealth.ewmaMbps，讓 getHealthyCdnList 直接選到真最快的節點。
const THRPT_PROBE_BYTES      = 384 * 1024
const THRPT_PROBE_MIN_BYTES  = 64 * 1024     // 樣本太小（slow-start 未展開）不採信
const THRPT_PROBE_TIMEOUT    = 3000
const THRPT_BAKEOFF_COOLDOWN = 90 * 1000     // 兩次賽馬最短間隔
const THRPT_SAMPLE_FRESH_MS  = 60 * 1000     // 此時間內已有真實樣本就跳過該節點
// 固定門檻沒考慮樣本信心：一次 384KB 探測可能剛好碰到 TCP slow-start 未展開或網路瞬間
// 空檔，偏差就很大。樣本數越少，門檻拉得越高，越可信才敢用比較低的門檻。
const switchMarginFor = (samples) => {
    if (samples >= 4) return 1.15
    if (samples >= 2) return 1.30
    return 1.60
}

// ★ 跨分頁共用。舊版這是純記憶體變數，於是**每個分頁各跑一場獨立的賽馬**——
// 每場最多 4 顆候選 × 最多 768KB、每 90 秒一輪。開 5 個 bilibili 分頁就是 5 倍的背景
// 流量在跟正在播的影片搶頻寬，使用者回報的「多開分頁會不穩定」主要來自這裡。
// 賽馬量到的結果本來就寫進共用的 cdnHealth，所以同一個時間窗內**只需要有一個分頁去測**。
//
// 注意這跟既有的 Web Locks / BroadcastChannel 互斥**不重複，是互補的**：
// 那兩者擋的是「同時」（兩個分頁不會同一秒一起測），但擋不住「頻率」——A 分頁測完
// 釋放鎖之後，B 分頁的 90 秒冷卻是它自己記憶體裡的 0，於是立刻接著測，C 分頁再接著測。
// N 個分頁只是把 N 場賽馬**排隊跑完**，總流量一點都沒省。冷卻時間戳必須放在
// 所有分頁看得到的地方（GM storage）才能真正收斂成「每 90 秒全域一場」。
const BAKEOFF_TS_KEY = 'lastBakeoffAt_v1'
const TRUSTED_BAKEOFF_CAPABILITY = Symbol('BiliCDN trusted bakeoff')
const TRUSTED_BAKEOFF_MIN_GAP = Object.freeze({ menu: 5000, watchdog: 30000, 'verified-failure': 30000 })
const trustedBakeoffLastAt = Object.create(null)
const trustedBakeoffRequest = (reason) => ({ capability: TRUSTED_BAKEOFF_CAPABILITY, reason })
const getLastBakeoffAt = () => {
    try { return +GM_getValue(BAKEOFF_TS_KEY, 0) || 0 } catch { return 0 }
}
const setLastBakeoffAt = (ts) => {
    try { GM_setValue(BAKEOFF_TS_KEY, ts) } catch {}
}
let bakeoffRunning       = false
let bakeoffTimer         = null
let lastSampleSegmentUrl = null
let bakeoffNullStreak    = 0   // 連續幾輪賽馬「有候選但全部測速失敗」，用來偵測測速機制被防盜鏈整批擋下
// SPA 換片時遞增；讓仍在跑/排程中的舊片賽馬盡快自我放棄，把頻寬讓給新片。
// 沒有這個機制時，切到重片（4K/長片/無損）當下若剛好卡在舊片的賽馬排程或執行中，
// 舊片會佔住 bakeoffTimer/bakeoffRunning 整個週期（最長可到 ~4s 排程 + 最多 4 顆候選 ×3s
// probe timeout ≈ 12s），新片完全搶不到賽馬，只能沿用舊片留下的健康分數起步，加載明顯變慢。
let bakeoffEpoch         = 0
let bakeoffAbortController = null

// 多分頁協調鉤子（預設放行；Main IIFE 啟動跨分頁協調後覆寫）。
// 多開分頁時若多個分頁同時賽馬會互搶台灣上行頻寬而互相低估吞吐量，故需互斥。
let crossTabShouldBakeoff = () => true
let onBakeoffStart        = () => {}

// 對單一候選量吞吐量：ranged GET，扣掉 TTFB 只算純下載時間，降低 slow-start 偏差。
// probeBytes 可調：高碼率（4K）用較大量，讓 TCP 慢啟動展開、節點之間分得出快慢。
const probeCdnThroughput = (cdn, sampleUrl, probeBytes, externalSignal) => new Promise((resolve) => {
    const runtimeToken = captureRuntimeGeneration()
    const eligible = isRuntimeGenerationActive(runtimeToken) && isValidCustomCdnHost(cdn)
        && !blacklistSet.has(cdn) && !knownDeadHosts.has(cdn) && !matchesExclude(cdn) && !isPresumedDnsFailHost(cdn)
    const decision = decideMediaRewrite(sampleUrl)
    const target = eligible && decision.action === 'rewrite' ? replaceUrlHost(sampleUrl, cdn) : null
    if (!target) return resolve({ status: 'ineligible', accepted: false, bytes: 0 })
    const wantBytes = Math.min(probeBytes || THRPT_PROBE_BYTES, 768 * 1024)
    const ctrl = new AbortController()
    const t0 = performance.now()
    let ttfb = 0, bytes = 0, settled = false, reader = null, to = null, successResponse = false
    const signals = [...new Set([externalSignal, runtimeToken.signal].filter(Boolean))]
    const active = () => isRuntimeGenerationActive(runtimeToken) && !signals.some(signal => signal.aborted)
    const finish = (completion) => {
        if (settled) return
        settled = true
        clearRuntimeTimeout(to)
        signals.forEach(signal => signal.removeEventListener('abort', onAbort))
        // Complete independently of the transport's reaction to abort/cancel.
        try { Promise.resolve(reader?.cancel(completion)).catch(() => {}) } catch {}
        try { ctrl.abort(completion) } catch {}
        let result = { status: completion, completion, accepted: false, bytes }
        if (!active()) result.status = result.completion = 'cancelled'
        else if (completion === 'forbidden') result.forbidden = true
        else if (successResponse && (completion === 'complete' || completion === 'timeout')) {
            const durationMs = Math.max(1, performance.now() - t0 - ttfb)
            let sample = { accepted: false }
            if (bytes >= THRPT_PROBE_MIN_BYTES) {
                sample = recordCdnThroughput(cdn, bytes, durationMs, playbackRateState.effectiveRate)
                recordCdnLatency(cdn, Math.max(1, ttfb))
            }
            result.status = sample.accepted ? (completion === 'timeout' ? 'partial' : 'complete')
                : bytes >= THRPT_PROBE_MIN_BYTES ? 'latency-only' : 'insufficient'
            result.accepted = !!sample.accepted
            if (sample.accepted) {
                result.cdn = cdn
                result.partial = completion === 'timeout'
                if (result.partial) redirectStats.partialProbeSamples = Math.min(10000, redirectStats.partialProbeSamples + 1)
            }
        }
        if (active()) DiagnosticLog.record('measurement', { host: cdn, reason: result.status, bytes, received: result.accepted })
        resolve(result)
    }
    const onAbort = () => finish('cancelled')
    if (!active()) return finish('cancelled')
    signals.forEach(signal => signal.addEventListener('abort', onAbort, { once: true }))
    to = scheduleRuntimeTimeout(() => finish('timeout'), THRPT_PROBE_TIMEOUT)
    Promise.resolve().then(() => {
        if (settled || !active()) return null
        return interceptNetResponse.rawFetch(target, {
            method: 'GET', headers: { Range: 'bytes=0-' + (wantBytes - 1) },
            mode: 'cors', credentials: 'omit', cache: 'no-store', signal: ctrl.signal,
            referrerPolicy: 'strict-origin-when-cross-origin',
        })
    }).then(async resp => {
        if (settled) { try { await resp?.body?.cancel() } catch {} return }
        if (!active()) return finish('cancelled')
        if (resp?.status === 403) return finish('forbidden')
        if (!resp || !resp.ok || !resp.body?.getReader) return finish('failed')
        successResponse = true
        reader = resp.body.getReader()
        ttfb = performance.now() - t0
        while (!settled) {
            const { done, value } = await reader.read()
            if (settled) return
            if (!active()) return finish('cancelled')
            // Count only this round's budget. A browser-buffered chunk may exceed wire budget.
            bytes += Math.min(value?.byteLength || 0, Math.max(0, wantBytes - bytes))
            if (bytes >= wantBytes || done) return finish('complete')
        }
    }).catch(error => finish(error?.name === 'AbortError' ? 'cancelled' : 'failed'))
})

// 序列探測（非並行）避免候選互搶台灣上行頻寬而互相低估。只測「缺新樣本」的候選。
// skipIfFast：現用節點已經跑得夠快時要不要直接跳過整輪賽馬。
//   true（預設，換片/換畫質起播時用）：夠快就跳過，把頻寬留給正在起播的緩衝。
//   false（Watchdog 偵測到真的卡頓/fragment 錯誤/週期重評估/手動觸發時用）：
//   這些情境代表「已經出事」或「就是要主動找有沒有更好的」，不該再被這個捷徑擋掉。
// 新鮮、同 epoch 且高度相符的影片 Fetch/XHR bytes；不是播放器消費或解碼證明。
// 建議節點只能用作預热退路，不能冒充傳輸歸因或成為 Watchdog 懲罰對象。
const getPlayingCdnHost = () => {
    return getAttributedVideoHost()
}
const getWarmCdnHost = () => getPlayingCdnHost() || resolvedCdn || lastChosenCdn || activeCdnList[0] || null

// v1.3.3：起播緩衝還沒建立起來時，賽馬會直接跟「正在拉的第一批 segment」搶頻寬 ——
// 這正是「開頭加載變慢」最直接的來源。賽馬本身不急，晚幾秒跑結果一樣，但起播慢
// 使用者是立刻看得到的。只延後「起播排程」那種賽馬；Watchdog 偵測到真的卡頓、
// 或週期性重評估（skipIfFast=false）不受影響 —— 那些情境代表已經出事，不能再等。
const STARTUP_MIN_BUFFER_SEC = 12
const MAX_STARTUP_DEFERS     = 3
let bakeoffStartupDefers     = 0
const isStartupBuffering = () => {
    try {
        const st = Watchdog.stats()
        if (!st || st.readyState < 0) return false   // 頁面上沒有播放器，無從判斷
        if (st.paused) return false                  // 使用者還沒開始播，賽馬不會跟誰搶
        return st.bufferAheadSec < STARTUP_MIN_BUFFER_SEC
    } catch { return false }
}

const runThroughputBakeoff = async (sampleUrl, skipIfFast = true, trustedRequest = null) => {
    const skipped = reason => { DiagnosticLog.record('measurement', { reason, requested: false }); return undefined }
    if (disabled || resolvedCdn || bakeoffRunning) return skipped(disabled ? 'disabled' : resolvedCdn ? 'fixed' : 'busy')
    if (inSeekGrace()) return skipped('seek-grace')
    if (!sampleUrl || !isBiliVideoUrl(sampleUrl)) return skipped('no-segment')
    // 綁定節點的串流換 host 必定 403，測了也拿不到任何有效樣本（見 hostLockedStreams）
    if (isHostLockedStream(sampleUrl)) return skipped('host-lock')
    const runtimeToken = captureRuntimeGeneration()
    if (!isRuntimeGenerationActive(runtimeToken)) return
    const now = Date.now()
    const trustedReason = trustedRequest && trustedRequest.capability === TRUSTED_BAKEOFF_CAPABILITY
        && Object.prototype.hasOwnProperty.call(TRUSTED_BAKEOFF_MIN_GAP, trustedRequest.reason)
        ? trustedRequest.reason
        : null
    if (trustedReason) {
        const last = trustedBakeoffLastAt[trustedReason] || 0
        if (now - last < TRUSTED_BAKEOFF_MIN_GAP[trustedReason]) return skipped('cooldown')
        trustedBakeoffLastAt[trustedReason] = now
    } else if (now - getLastBakeoffAt() < THRPT_BAKEOFF_COOLDOWN) {
        // 一般自動路徑維持既有 90 秒全域冷卻；只有閉包內 capability 能走受限緊急路徑。
        return skipped('cooldown')
    }

    // ★ 起播保護：緩衝還沒到 STARTUP_MIN_BUFFER_SEC 就先讓路，每 2 秒再看一次。
    // 有上限（MAX_STARTUP_DEFERS）—— 否則遇到「怎麼都緩衝不起來」的爛節點時，
    // 這個保護反而會讓賽馬永遠不跑，錯過換掉爛節點的機會。
    if (skipIfFast && bakeoffStartupDefers < MAX_STARTUP_DEFERS && isStartupBuffering()) {
        bakeoffStartupDefers++
        const deferEpoch = bakeoffEpoch
        if (!bakeoffTimer) {
            bakeoffTimer = scheduleRuntimeTimeout(() => {
                bakeoffTimer = null
                if (deferEpoch !== bakeoffEpoch) return
                runThroughputBakeoff(lastSampleSegmentUrl).catch(reportMeasurementFailure())
            }, 2000)
        }
        return
    }

    // 現用節點剛好有新鮮的真實吞吐樣本、且遠高於這支片子實際需要的速度時，
    // 賽馬本身（連續打 1~4 顆候選、每顆最多 768KB）沒有急迫性，反而會在換片起播
    // 最搶頻寬的當下再搶一手頻寬（4K/長片/無損正是這種最禁不起搶的情境）。跳過。
    const preCheckHost = getPlayingCdnHost() || getWarmCdnHost()
    const preHealth    = preCheckHost && cdnHealth[preCheckHost]
    if (skipIfFast && preHealth && preHealth.samples && preHealth.lastThroughputAt
        && (Date.now() - preHealth.lastThroughputAt) < THRPT_SAMPLE_FRESH_MS
        && preHealth.ewmaMbps >= getRequiredStreamMbps(undefined, 'startup') * 1.5) {
        return
    }

    // 多分頁互斥：優先用 Web Locks API（同源真互斥鎖，跨分頁跨 Worker 都有效，分頁關閉
    // 時瀏覽器自動釋放）。原本只用 BroadcastChannel 心跳判斷「其他分頁是否在測速」，
    // 但那只能盡量避免——兩個分頁幾乎同時決定要測速時，心跳訊息還沒送達對方就都已經
    // 開始了。ifAvailable:true 拿不到鎖立刻回呼 null，不排隊等待。
    if (navigator.locks && navigator.locks.request) {
        return navigator.locks.request('bilicdn-bakeoff', { ifAvailable: true }, (lock) => {
            if (!lock) return skipped('busy')
            if (!isRuntimeGenerationActive(runtimeToken)) return
            return doBakeoff(sampleUrl, runtimeToken)
        })
    }
    if (!crossTabShouldBakeoff()) return  // 沒有 Web Locks：只保留既有提示，不冒充權威互斥
    return doBakeoff(sampleUrl, runtimeToken)
}

const doBakeoff = async (sampleUrl, runtimeToken = captureRuntimeGeneration()) => {
    if (!isRuntimeGenerationActive(runtimeToken)) return
    DiagnosticLog.record('measurement', { reason: 'accepted', requested: true })
    bakeoffRunning = true
    // 先寫再測：把時間戳提早寫進共用儲存，其他分頁在這一輪還沒跑完時就會被冷卻擋下，
    // GM 時間戳不是原子鎖；跨分頁互斥仍由外層 Web Locks 提供。
    setLastBakeoffAt(Date.now())
    // 記下這輪賽馬所屬的片子；換片時 bakeoffEpoch 會遞增，讓下面迴圈提早放棄，
    // 不用等滿整批候選（最多 4 顆 ×3s timeout）才把 bakeoffRunning 讓出來給新片。
    const myEpoch = bakeoffEpoch
    bakeoffAbortController = new AbortController()
    const mySignal = bakeoffAbortController.signal
    const onRuntimeAbort = () => { try { bakeoffAbortController && bakeoffAbortController.abort() } catch {} }
    if (runtimeToken.signal) runtimeToken.signal.addEventListener('abort', onRuntimeAbort, { once: true })
    onBakeoffStart()                      // 通知其他分頁本分頁開始賽馬
    // 註：不在此 clear forcedRedirectHosts。它是有 10 分鐘 TTL 的 Map（見上方宣告處），
    // 到期會自然過期讓該節點重新進入候選池，不需要也不該在賽馬時手動清空——
    // 手動清空只在 SPA 換片（新的 base_url，舊節點的改寫紀錄已經沒有意義）時做。

    try {
        const now         = Date.now()
        const playingHost = getPlayingCdnHost()
        const candidates  = PREFERRED_CDN_LIST
            .filter(c => !blacklistSet.has(c) && !knownDeadHosts.has(c) && !isCdnSoftBlocked(c) && !matchesExclude(c))
            // ★ 這一行是使用者實測回報的 bug 修正：賽馬只擋 knownDeadHosts，但「已知在台灣
            // 不解析、還沒被標死」的節點不在其中，於是賽馬會拿**真實 segment URL**去打它們，
            // console 出現 ERR_NAME_NOT_RESOLVED（堆疊 doBakeoff → probeCdnThroughput）。
            // 而且傷害不只是紅字：下面那個迴圈是**逐一 await**，每顆死節點都要卡滿
            // THRPT_PROBE_TIMEOUT（3 秒）才輪到下一顆 —— 兩顆就是 6 秒，這 6 秒本來
            // 應該用來測真正可用的節點，時機還正好落在起播附近。
            .filter(c => !isPresumedDnsFailHost(c))
            .filter(c => {
                if (c === playingHost) return false // 正在播放的節點已由實際 segment 量測取樣
                const h = cdnHealth[c]
                return !(h && h.samples && h.lastThroughputAt
                    && (now - h.lastThroughputAt) < THRPT_SAMPLE_FRESH_MS)
            })
            // v1.4.0：先測從未量過的節點，其次測最久沒有吞吐樣本的節點。
            // 舊版直接 slice 前四名；90 秒冷卻大於 60 秒 freshness，前四名每輪都會重新入選，
            // 排在後面的候選可能永遠拿不到一次樣本。
            .sort((a, b) => {
                const ah = cdnHealth[a], bh = cdnHealth[b]
                const aNever = !(ah && ah.samples && ah.lastThroughputAt)
                const bNever = !(bh && bh.samples && bh.lastThroughputAt)
                if (aNever !== bNever) return aNever ? -1 : 1
                return ((ah && ah.lastThroughputAt) || 0) - ((bh && bh.lastThroughputAt) || 0)
            })
            .slice(0, 4)

        // 高碼率（4K）用較大測速量，分得出節點快慢；一般畫質維持小量省頻寬
        const probeBytes = (currentStreamBitsPerSec / 1e6 >= 12) ? 768 * 1024 : THRPT_PROBE_BYTES
        const ok = []
        const outcomes = []
        for (const c of candidates) {
            if (!isRuntimeGenerationActive(runtimeToken) || myEpoch !== bakeoffEpoch) break
            // 這條串流已知綁定節點 → 剩下的候選不用試了，每一台都會 403（見 hostLockedStreams）
            if (isHostLockedStream(sampleUrl)) break
            const r = await probeCdnThroughput(c, sampleUrl, probeBytes, mySignal)
            // 換 host 拿到 403：登記這條串流，立刻中止本輪。不中止的話剩下的候選會
            // 一顆一顆各再產生一行 403 紅字（使用者實測一輪就看到 3 行）。
            if (!isRuntimeGenerationActive(runtimeToken) || myEpoch !== bakeoffEpoch) return { status: 'cancelled', outcomes }
            if (r) outcomes.push({ host: c, ...r })
            if (r && r.forbidden) { noteHostLockedStream(sampleUrl); break }
            if (r && r.accepted) ok.push(r)
        }

        // 測速被防盜鏈擋掉時 probeCdnThroughput 只會靜默回 null，賽馬形同失效但完全沒有
        // 訊息。連續 3 輪「有候選但全部失敗」才示警，避免單次網路抖動誤報。
        if (!isRuntimeGenerationActive(runtimeToken)) return
        if (candidates.length) {
            if (ok.length === 0) {
                bakeoffNullStreak++
                if (bakeoffNullStreak === 3) {
                    err('[Bakeoff] 連續 3 輪測速全部失敗，可能被 CDN 防盜鏈擋下。'
                        + '可由 Tampermonkey 選單開啟 verbose 觀察，或回報此訊息。')
                }
            } else {
                bakeoffNullStreak = 0
            }
        }

        // 這輪賽馬所屬的片子已經被切掉了：拿到的樣本仍照樣入帳（對 CDN 的真實吞吐量測量，
        // 換到哪片都算數），但跳過「中途切換舊主機」這步——playingHost 是舊片的、新片可能
        // 早就用別的 CDN，逼著重導反而多繞一手。新片自己的 scheduleBakeoff 會另外排一輪。
        const stale = myEpoch !== bakeoffEpoch || !isRuntimeGenerationActive(runtimeToken)
        if (stale) return

        // 確保探到的候選在 activeCdnList 內，否則 getHealthyCdnList 不會納入排序
        ok.forEach(r => {
            if (!activeCdnList.includes(r.cdn) && !blacklistSet.has(r.cdn) && !knownDeadHosts.has(r.cdn)) {
                activeCdnList.push(r.cdn)
            }
        })

        // 只重新排序，不縮減集合 —— 跟 reorderCdnsByLatency 裡同一個修正
        //（getHealthyCdnList 的瞬時篩選條件不該寫回候選池母體，否則池子只會越來越薄）。
        // 這裡當初漏改了，是候選池即使修過還是會變薄的第二個來源。
        const ranked = getHealthyCdnList()
        if (ranked.length) {
            const rest = activeCdnList.filter(c => !ranked.includes(c))
            activeCdnList.length = 0
            ranked.forEach(c => activeCdnList.push(c))
            rest.forEach(c => activeCdnList.push(c))
        }

        if (!stale) {
            const best = activeCdnList[0]
            // 勝者明顯比現用節點快 → 強制 worker 把舊主機改寫到勝者（中途切換、不 reload）
            if (best && playingHost && best !== playingHost) {
                const hb = cdnHealth[best], ho = cdnHealth[playingHost]
                const mb = (hb && hb.samples) ? hb.ewmaMbps : 0
                const mo = (ho && ho.samples) ? ho.ewmaMbps : 0
                if (getAttributedVideoHost() === playingHost && mb > 0 && mb > mo * switchMarginFor(hb ? hb.samples : 0)) {
                    addForcedRedirect(playingHost)
                    // 跟 Watchdog 換節點一樣要給新連線寬限，否則會出現使用者 log 裡那種
                    // 「賽馬切到 cos → 下一個 tick 就懲罰 cos」的序列。
                    try { Watchdog.noteCdnSwitched() } catch {}
                    log('[Bakeoff] 中途切換 ' + playingHost.split('.')[0] + ' → ' + best.split('.')[0]
                        + '（' + mo.toFixed(1) + '→' + mb.toFixed(1) + ' Mbps）')
                }
            }
        }

        promoteBestCdnNow()
        try { GM_setValue(PROBE_CACHE_KEY, JSON.stringify({ t: Date.now(), list: [...activeCdnList] })) } catch {}
        const status = ok.length ? 'completed' : outcomes.some(r => r.forbidden) ? 'forbidden'
            : outcomes.some(r => r.status === 'latency-only') ? 'latency-only'
            : candidates.length ? 'failed' : 'no-candidates'
        return { status, outcomes, samples: ok.length }
    } finally {
        if (runtimeToken.signal) runtimeToken.signal.removeEventListener('abort', onRuntimeAbort)
        bakeoffRunning = false
        if (bakeoffAbortController && bakeoffAbortController.signal === mySignal) bakeoffAbortController = null
    }
}

const scheduleBakeoff = (sampleUrl) => {
    if (sampleUrl) lastSampleSegmentUrl = sampleUrl
    if (disabled || resolvedCdn || bakeoffTimer) return
    // 4K 開播當下最吃頻寬，測速會跟「初始緩衝」搶頻寬而拖慢起播 →
    // 4K 改為延後較久（先讓畫面開起來、緩衝拉起再測速）；一般畫質維持較短延遲。
    const highBitrate = currentStreamBitsPerSec / 1e6 >= 12
    const myEpoch = bakeoffEpoch
    bakeoffTimer = scheduleRuntimeTimeout(() => {
        bakeoffTimer = null
        // 換片會在 onSpaNavigate 主動清掉這個 timer，理論上不會用過期 epoch 觸發；
        // 這裡多一層防呆，避免任何遺漏路徑用舊片樣本跑掉這一輪賽馬名額。
        if (myEpoch !== bakeoffEpoch) return
        // 一律用當下最新樣本（而非排程當下 closure 住的那個），避免同一支片內
        // 中途換畫質/CDN 導致 sampleUrl 過期時仍打舊 URL。
        runThroughputBakeoff(lastSampleSegmentUrl).catch(reportMeasurementFailure())
    }, highBitrate ? 4000 : 1500)
}

// 對 host 發 <link rel=preconnect>（同時 dns-prefetch 對較舊瀏覽器雙保險）
// force=true 會 remove 後重插，hint 瀏覽器重評估連線（用於 keep-warm）
const runtimeHintIds = new Set()
const preconnectCdn = (cdn, force) => {
    try {
        if (!isValidCustomCdnHost(cdn)) return
        // presumed（已知在台灣不解析、本機從無成功紀錄）也要擋：preconnect 走的一樣是
        // DNS 解析，對 NXDOMAIN 的 host 熱身換不到任何東西。這裡的呼叫端目前都先經過
        // getHealthyCdnList()（會濾掉 presumed），但那是呼叫端的性質、不是這個函式的保證——
        // 死節點機制的設計目標寫的是「跳過所有 probe/preconnect」，就該在這裡也守住。
        const fixedTarget = (() => { try { return !!resolvedCdn && cdn === resolvedCdn } catch { return false } })()
        if (!fixedTarget && (knownDeadHosts.has(cdn) || blacklistSet.has(cdn) || isCdnSoftBlocked(cdn)
            || matchesExclude(cdn) || isPresumedDnsFailHost(cdn))) return
        const id = 'bilicdn-preconn-' + cdn
        const existing = document.getElementById(id)
        if (existing) {
            if (!force) return
            existing.remove()
        }
        const link = document.createElement('link')
        link.id   = id
        link.rel  = 'preconnect'
        link.href = 'https://' + cdn
        link.crossOrigin = 'anonymous'
        ;(document.head || document.documentElement).appendChild(link)
        runtimeHintIds.add(id)

        const dnsId = 'bilicdn-dns-' + cdn
        if (!document.getElementById(dnsId)) {
            const dns = document.createElement('link')
            dns.id   = dnsId
            dns.rel  = 'dns-prefetch'
            dns.href = 'https://' + cdn
            ;(document.head || document.documentElement).appendChild(dns)
            runtimeHintIds.add(dnsId)
        }
    } catch {}
}

const preconnectBatch = (hosts, force) => {
    ;[...new Set(hosts || [])].forEach(h => h && preconnectCdn(h, force))
}

const clearRuntimeConnectionHints = () => {
    runtimeHintIds.forEach(id => {
        try {
            const node = document.getElementById(id)
            if (node) node.remove()
        } catch {}
    })
    runtimeHintIds.clear()
}

// document-start 階段就 preconnect（不等 probe，seek 第一刀已來不及）——這件事現在由
// 下方的 startCdnProbe() 負責，這裡刻意不再做。
//
// v1.3.3：舊版在這裡對「整份白名單」無差別開連線（扣掉死節點與排除關鍵字還有 6 個），
// 但一次播放最多只會用到 3 個（primary + 2 個 backup）。多出來的 3 條全是純浪費，
// 而且浪費的時機正是最不該浪費的 document-start —— 頁面 HTML/JS/CSS 還在下載、
// playurl 正要發出。跨海連線一條 preconnect 是 DNS + TCP(1 RTT) + TLS(約 2 RTT)，
// 六條同時開會佔滿 DNS 解析器與 socket 配額，跟真正要用的那幾條互搶。
// 更糟的是它連「解析不出來的 host」也照開（例如台灣的 upos-hz-mirroraliov），
// 在首次升級、還沒被標死之前，等於在起播當下白白排隊等一次 DNS 失敗。
//
// 改由 startCdnProbe() 用 getCurrentCdn(STARTUP_PICK) + getHealthyCdnList(STARTUP_PICK)
// 精準熱身「playurl 這次真的會寫進去」的那 3 個。兩者中間只有同步的模組初始化，
// 不會有任何網路行為，所以時機完全沒有損失；順帶修掉「腳本已停用（disabled）時
// 這行照樣開六條連線」的舊行為。

// reorderCdnsByLatency 自己的重入旗標：原本完全沒有防呆，兩個 reorderCdnsByLatency(true)
// 幾乎同時觸發時（例如卡頓 switchCdn 與週期性重評估疊在一起）會交錯清空/填入
// activeCdnList，後完成的一個覆蓋先完成的結果。也順便避開跟 runThroughputBakeoff 同時
// 動 activeCdnList——只在這個方向擋（bakeoff 執行中就不搶著跑 reorder），因為
// switchCdn 是先發 reorder 再發 bakeoff，若反向互擋，bakeoff 會被剛啟動的 reorder
// 立刻擋掉，等於卡頓時「立刻實測」這個功能被靜默失效。
let reorderRunning = false
// ── 起播期間不跑全量延遲探測（v1.3.3）────────────────────────────────
// reorderCdnsByLatency 在探測快取沒命中時，會對每個候選發一次 Image 探測（v1.3.3 之後
// 還多一次可達性確認 fetch），而它被呼叫的時機是 document-start —— 頁面 HTML/JS/CSS
// 還在下載、playurl 正要發出的當下。等於在最搶頻寬與 DNS 解析器的那一刻，多打十幾個
// 跟這次播放無關的請求。
//
// 說「無關」是有根據的：這份排序的產物（activeCdnList 的 index 順序）在
// getHealthyCdnList() 裡**只是「所有候選都沒有實測樣本」時的退路**——只要有任何一個
// 候選有 samples，排序就完全由 score 決定，index 只當同分時的 tie-break。也就是說對
// 已經用過一陣子的使用者，這批探測請求對「這次要選哪個節點」毫無貢獻。
//
// 改成：已經有健康資料就延後到起播緩衝建立之後再跑；完全沒有樣本（全新安裝、或剛
// 由可信選單重置學習狀態）才立刻跑，因為那時候真的只能靠延遲排序決定順序。
// 代價：死節點偵測（DNS 解析失敗）也跟著延後。可以接受——handleSegmentConnError 會在
// 第一次真的失敗時就確認並標死，不必等這輪探測；而且探測快取在版本升級時已被清掉，
// 延後的那一輪照樣會把死節點掃出來。
const PROBE_DEFER_CHECK_MS = 2000
const MAX_PROBE_DEFERS     = 6      // 最多讓路 12 秒
let deferStartupProbes = true
let probeDeferCount    = 0
let probeDeferTimer    = null

const hasUsableCdnHealth = () => activeCdnList.some(c => {
    const h = cdnHealth[c]
    return !!h && h.samples > 0 && !knownDeadHosts.has(c) && !blacklistSet.has(c)
})

// 讓路 / 重排共用同一個有界計數器。兩種情況都會走到這裡：
//   1. 還在起播緩衝階段 → 讓路，等一下再看
//   2. reorderCdnsByLatency 被 reorderRunning / bakeoffRunning 擋下 → 重排，不能丟掉
// 兩者都必須有上限：情況 1 沒上限會讓「怎麼都緩衝不起來」的爛節點永遠不被掃出來；
// 情況 2 沒上限的話，萬一 bakeoffRunning 因故卡住，就會變成每 2 秒空轉一次的無窮迴圈。
const scheduleDeferredLatencyProbe = () => {
    if (probeDeferTimer) return
    if (probeDeferCount >= MAX_PROBE_DEFERS) {
        // 讓夠了。放行，交給之後自然會發生的觸發點（換片、卡頓、週期性重評估）。
        deferStartupProbes = false
        return
    }
    probeDeferCount++
    probeDeferTimer = scheduleRuntimeTimeout(() => {
        probeDeferTimer = null
        if (isStartupBuffering()) { scheduleDeferredLatencyProbe(); return }
        deferStartupProbes = false
        reorderCdnsByLatency().catch(reportMeasurementFailure())
    }, PROBE_DEFER_CHECK_MS)
}

const reorderCdnsByLatency = async (force) => {
    if (disabled) return
    const runtimeToken = captureRuntimeGeneration()
    if (!isRuntimeGenerationActive(runtimeToken)) return
    if (resolvedCdn) { preconnectCdn(resolvedCdn); return }
    // ★ seek 保護窗：拖時間軸之後播放器要把新位置的 segment 全部重抓，那是全片最吃
    // 頻寬的一刻。這一輪探測會同時對 4~6 個候選各發一個請求，跟 seek 的 segment 直接互搶
    // —— 使用者實測回報「跳轉緩衝變慢」。
    //
    // 這條規則在這支腳本裡本來就成立（賽馬 runThroughputBakeoff、Watchdog 的
    // scheduleDelayedReorder、keep-warm 的 preconnectBatch 都各自檢查 inSeekGrace()），
    // 只有延遲探測漏掉了 —— 因為它以前跑在 document-start，那時候使用者根本還不可能 seek。
    // 改成延後執行之後才暴露出這個缺口。
    //
    // force=true 不受限（使用者由 Tampermonkey 選單手動探測、或 Watchdog 判定已經出事而主動重評估，
    // 那些情境本來就該立刻跑，而且呼叫端自己已經檢查過 seek 狀態）。
    if (reorderRunning || bakeoffRunning || (!force && inSeekGrace())) {
        // 舊版在這裡直接 return，等於把這一輪**永久丟掉**。配合延後探測的設計，
        // 這會變成：延後排程好不容易等到緩衝建立、卻剛好撞上正在跑的賽馬 → 探測整輪消失，
        // 於是「該被標死的節點永遠沒機會被標死」，賽馬每 90 秒又去打它一次。
        // 使用者回報的 ERR_NAME_NOT_RESOLVED 會反覆出現，這是其中一環。改成重新排程。
        // 不看 deferStartupProbes：延後的那一輪自己會先把它設成 false，若在這裡才撞上賽馬，
        // 加上判斷等於又把它丟掉一次。scheduleDeferredLatencyProbe 自己有次數上限。
        scheduleDeferredLatencyProbe()
        return
    }
    reorderRunning = true

    try {
        // Cache hit → 完全不發探測請求
        if (!force) {
            try {
                const cached = JSON.parse(GM_getValue(PROBE_CACHE_KEY) || 'null')
                if (cached && (Date.now() - cached.t) < PROBE_CACHE_TTL && Array.isArray(cached.list)) {
                    // 快取只決定「順序」，不決定「成員」。
                    // 舊版是照著快取清單重建 activeCdnList，於是某一輪縮水後的結果會被
                    // 醃在快取裡整整兩小時：之後每次載入都照著那份短清單重建，池子再也長不回來
                    //（使用者實測回報 active 只剩 1 個節點，就是這樣來的）。
                    // 現在快取裡有的照原順序放前面，其餘「當下沒有任何理由排除」的候選補在後面。
                    const usable = (c) => !blacklistSet.has(c) && !knownDeadHosts.has(c)
                        && !isCdnSoftBlocked(c) && PREFERRED_CDN_LIST.includes(c)
                    activeCdnList.length = 0
                    cached.list.forEach(c => { if (usable(c)) activeCdnList.push(c) })
                    PREFERRED_CDN_LIST.forEach(c => {
                        if (usable(c) && !activeCdnList.includes(c)) activeCdnList.push(c)
                    })
                    if (activeCdnList.length) {
                        probeDeferCount = 0
                        promoteBestCdnNow()
                        preconnectBatch(activeCdnList.slice(0, 3))
                        syncWorkerCdnTarget()
                        return
                    }
                }
            } catch {}
        }

        // ★ 起播讓路：快取沒命中、但已經有健康資料足以決定節點時，把「真的發探測請求」
        // 延後到起播緩衝建立之後（見上方 deferStartupProbes 說明）。
        if (deferStartupProbes && !force && hasUsableCdnHealth()) {
            scheduleDeferredLatencyProbe()
            return
        }
        // presumed 節點現在一律跳過探測（見下方候選過濾），不再需要區分「是不是起播那一輪」，
        // 原本的 isStartupRun 也就沒有讀者了，一併移除。
        deferStartupProbes = false

        const candidates = PREFERRED_CDN_LIST.filter(h => {
            if (knownDeadHosts.has(h) || isCdnSoftBlocked(h)) return false
            // 已知在台灣不解析的節點一律不發探測請求：那個請求**必定**失敗、必定在
            // console 印一行 ERR_NAME_NOT_RESOLVED，而它換不到任何新資訊——
            // isPresumedDnsFailHost() 的定義本來就是「在已知壞清單裡，而且本機從來沒有
            // 成功過」，答案已經確定了，再打一次只是把它重新確認一遍。
            //
            // ★ 2026-08-19 修正：舊條件是 `isStartupRun && !force && ...`，有兩個洞，
            // 使用者實測回報的紅字就是從這兩個洞出來的：
            //   1. `!force` —— Watchdog 判定卡頓後會呼叫 reorderCdnsByLatency(true)
            //      重新評估（見 switchCdn），那也是 force=true，於是每次卡頓都繞過這道
            //      過濾、對 hwov / hz-aliov 各打一發必定失敗的請求。這才是紅字的主要來源，
            //      頻率遠高於原本以為的「30 天一次」。
            //   2. `isStartupRun` —— 只擋起播那一輪，延後的那一輪照打不誤。
            // 改成**一律跳過，沒有例外**。曾經留過一個 includePresumed 出口讓
            // 即使由可信選單強制 probe，它仍是 no-cors、讀不到
            // 狀態碼，量到的數字本來就不足以讓節點重回候選池（見候選池重建處的說明）——
            // 於是那一發請求換不到任何能拿來做決定的資訊，只剩下 console 一行紅字。
            // 使用者實測回報 `upos-sz-mirrorhw ... 959` 那行就是它。偵測機制本身不該是噪音來源。
            // 想確認某個節點在你的網路上到底行不行，唯一有意義的作法是讓它**真的去服務
            // segment**：由 Tampermonkey 選單固定該 catalog host，成功後 successes/samples 會寫入，
            // isPresumedDnsFailHost() 自動失效。
            //
            // 跳過探測不會讓它們被誤用：getHealthyCdnList() 在選路時本來就會濾掉 presumed
            // 節點，diag() 也有專屬的「已知不解析、暫不使用（presumed）」欄位交代原因；
            // 萬一真的被指派到 segment，handleSegmentConnError 會立刻收拾。
            if (isPresumedDnsFailHost(h)) return false
            return true
        })
        const results = await Promise.all(candidates.map(cdn => probeCdnLatency(cdn, runtimeToken)))
        if (!isRuntimeGenerationActive(runtimeToken)) return
        // ★ 排序用「跨輪平滑後的估計值」，不是這一輪的原始值。
        // 單輪的 r.ms 幾乎完全由「這條連線當下是冷是熱」決定（實測冷熱差距：ali 冷 6.4s
        // vs 暖 0.4s，超過十倍），拿它當唯一依據等於讓節點順序隨機跳動。而 activeCdnList
        // 的順序在「所有節點都還沒有吞吐量樣本」時，正是 getHealthyCdnList() 的排序依據
        // （見該函式結尾的 a.index - b.index），所以這個雜訊會一路傳到選路。
        //
        // 使用者實測（2026-08-19，吞吐量資料剛重置、samples 全為 0 的狀態）：
        // 這一輪排出 [ali, cos, aliov]，aliov 敬陪末座——但同一份診斷裡 aliov 的
        // latencyMs 是 142ms、cos 是 516ms，curl 實測 TTFB 更是 aliov ~70ms / ali ~560ms /
        // cos ~1000ms。等於把最快的節點排到最後，而且下次重整可能又換一個順序。
        //
        // cdnHealth[].latencyMs 是 recordCdnLatency() 維護的 EWMA（本輪的值已經併進去了），
        // 天生就是為了吸收這種抖動而存在的，先前卻沒有被排序用到。
        const sortKey = (r) => {
            if (!Number.isFinite(r.ms)) return Infinity
            const hh = cdnHealth[r.cdn]
            return (hh && hh.latencyMs) ? hh.latencyMs : r.ms
        }
        results.sort((a, b) => sortKey(a) - sortKey(b))

        // probeCdnLatency 回傳的 reason（'DNS' / 'timeout'）過去只被寫入、沒有任何地方讀，
        // 是不折不扣的死屬性。選擇補上這行輸出而不是刪掉它：使用者在 console 看到
        // ERR_NAME_NOT_RESOLVED 時，最想知道的就是「腳本有沒有認出這件事、認成什麼」，
        // 而這正是唯一能回答的地方。輸出受 Config.verbose 控制，預設靜音。
        const failed = results.filter(r => r.reason)
        if (failed.length) {
            log('[探測] 判定不可用：' + failed.map(r => r.cdn.split('.')[0] + '(' + r.reason + ')').join('、'))
        }

        // ★ 探測「量到了」不等於「可以用」。`confirmHostReachable()` 與 `probeCdnLatency()`
        // 都是 no-cors fetch，拿到的是 opaque response —— **讀不到狀態碼**。所以對一個
        // 回 959（Bilibili 對台灣 IP 的區域拒絕，本來就在 HARD_FAIL_STATUSES 裡）的節點，
        // 探測層看到的只是「伺服器有回應」＝可達，於是給它一個有限的延遲值。
        // 使用者實測（2026-08-19）手動探測時就撞到這個：`upos-sz-mirrorhw`
        // 回 959，卻被判成可達，**重新回到 activeCdnList 第 4 位**（只被軟隔離 5 分鐘）。
        //
        // 所以候選池重建要把 presumed 節點濾掉：一次 `/crossdomain.xml` 的 opaque 回應
        // 根本回答不了「這台能不能服務影片」這個問題，沒有資格解除「已知在台灣不可用」的
        // 推定。真正有資格解除它的是**實際服務過 segment**（那會寫進 successes/samples，
        // isPresumedDnsFailHost() 隨即轉為 false），而不是一次探測。
        activeCdnList.length = 0
        for (const r of results) {
            if (!blacklistSet.has(r.cdn) && !knownDeadHosts.has(r.cdn)
                && !isPresumedDnsFailHost(r.cdn) && r.ms !== Infinity) {
                activeCdnList.push(r.cdn)
            }
        }
        if (activeCdnList.length === 0) {
            PREFERRED_CDN_LIST.forEach(c => {
                if (!blacklistSet.has(c) && !knownDeadHosts.has(c) && !isPresumedDnsFailHost(c)) {
                    activeCdnList.push(c)
                }
            })
        }
        // 只重新排序，**不縮減集合**。getHealthyCdnList() 會濾掉「此時此刻」失敗次數
        // 超標 / 分數過差 / 已知不解析的節點，那是選路當下該有的判斷；但 activeCdnList
        // 是整個 session 的候選池母體，被它濾掉的節點若就此從母體消失，一次瞬間的壞狀態
        // 就會變成「接下來兩小時都不再考慮這個節點」——要等下一輪探測（PROBE_CACHE_TTL
        // 兩小時）從 PREFERRED_CDN_LIST 重建才回得來。這是個單向棘輪，候選池只會越來越薄，
        // 也是診斷面板裡「白名單順序」有時只剩一兩個節點的成因。
        // 排到的照 ranked 順序放前面，沒排到的維持在後面備用。
        const ranked = getHealthyCdnList()
        if (ranked.length) {
            const rest = activeCdnList.filter(c => !ranked.includes(c))
            activeCdnList.length = 0
            ranked.forEach(c => activeCdnList.push(c))
            rest.forEach(c => activeCdnList.push(c))
        }

        if (!isRuntimeGenerationActive(runtimeToken)) return
        try {
            GM_setValue(PROBE_CACHE_KEY, JSON.stringify({ t: Date.now(), list: [...activeCdnList] }))
        } catch {}

        probeDeferCount = 0
        if (activeCdnList[0]) {
            preconnectBatch(activeCdnList.slice(0, 3), force)
            syncWorkerCdnTarget()
        }
    } finally {
        reorderRunning = false
    }
}

// ── 緩衝 Watchdog ─────────────────────────────────────────────────────
// 用 PerformanceObserver 累計 m4s/flv 下載量，每 1 秒檢查 buffered 是否成長
// 連續 STALL_MAX tick 卡頓 → 黑名單當前 CDN + 重 probe（讓攔截層自動切）
// 達到動態緩衝目標後停止監測，避免跟 player 自救邏輯互相干擾
const Watchdog = (() => {
    const TICK_MS           = 1000
    const STALL_MAX         = 3
    const MIN_BPS_FLOOR     = 350 * 1024
    const URGENT_BUFFER_SEC = 5
    // ★ 換節點的**危險線**，跟上面的目標線是兩回事。
    // minAheadEff（高碼率 30 秒）是「我們希望存這麼多」的目標；換節點是很貴的動作
    // （丟掉熱連線、重做 TCP+TLS、懲罰殘留 10 分鐘），只有在緩衝真的快撐不住時才該做。
    //
    // 用目標線當觸發條件會產生**結構性誤判**：B 站播放器抓 segment 是一陣一陣的
    //（抓一批 → 閒置等緩衝被播掉 → 再抓一批）。閒置期間 buffered.end 不動、
    // bufferAhead 持續下降 —— 完全正常，但這跟「停滯 + 緩衝流失」的特徵一模一樣。
    // 只要播放器自己的穩態緩衝低於我們的目標線（4K 幾乎必然如此），**每一個閒置週期
    // 都會被判成卡頓**，於是每隔幾秒就換一次節點。
    //
    // 使用者實測 log 的鐵證：賽馬量到 cos 有 29.3 Mbps（高於該片需求的 25.65 Mbps），
    // 卻照樣被判「buffered 停滯」並懲罰。速度明明夠，問題出在判定條件。
    const STALL_DANGER_SEC  = 10
    const REACHED_RECHECK_BUFFER_SEC = 10
    const SWITCH_COOL       = 5000
    // 剛 reset（開播/換片）那幾秒，TCP/TLS 連線還在 slow-start，量到的瞬時 bps 天生偏低，
    // 不是 CDN 真的慢。尤其高碼率（4K/長片/無損）換片後最需要這段緩衝時間才能量出真實速度，
    // 太早判定反而白白觸發一次換節點（重新 DNS/TCP/TLS 又更慢）。高碼率多給一點餘裕。
    const STARTUP_GRACE_MS       = 3000
    const STARTUP_GRACE_MS_HIGH  = 5000

    let totalBytes        = 0
    let lastBufferedEnd   = 0
    let lastCurrentTime   = 0
    let stallCount        = 0
    // v1.3.3：bps 與緩衝趨勢的滑動視窗（見 tick 內說明）。長度必須大於「播放器抓一段
    // 的週期」，否則視窗頭尾會落在週期的不同相位，量到的是取樣假象而不是真實趨勢。
    // B 站的 segment 約 4~6 秒，取 8 秒可以穩定跨過一個完整週期；再長則對真正的
    // 卡頓反應會變遲鈍（stallMax 本來就還要連續數個 tick 才動作）。
    const BPS_WINDOW_MS   = 8000
    let byteSamples       = []
    let lastSwitchAt      = 0
    // ── 換節點斷路器 ────────────────────────────────────────────────
    // 舊版 switchCdn 只有 SWITCH_COOL（兩次切換間隔 5 秒）這一道防線，
    // sessionSwitchCount 雖然有累加卻從來沒被拿來當煞車。後果在使用者實測 log 裡很清楚：
    // buffered 停滯持續成立 → 每 5 秒懲罰一個節點 → aliov、cos、hwov、hw 輪流中槍 →
    // 白名單全被封光 → 觸發緊急「已全部清除」→ 從頭再來一輪，一直循環。
    //
    // 但這種情況下瓶頸根本不在節點：那支片需要 25.65 Mbps（4K），跨境線路或使用者頻寬
    // 撐不住時，換到哪個節點都一樣。而繼續換只會更糟——每換一次就丟掉一條熱連線、
    // 重做一次 TCP+TLS 握手，懲罰還會殘留 10 分鐘以上，連帶拖累接下來幾部片。
    //
    // 斷路器：觀察窗內連續切換達到上限就停手一段時間，並**收回這一波的懲罰**
    // （既然判定不是節點的錯，就不該讓它們背這個鍋去影響之後的選路）。
    const SWITCH_BURST_MAX    = 3
    const SWITCH_BURST_WINDOW = 60 * 1000
    const SWITCH_BREAKER_MS   = 90 * 1000
    let switchTimes        = []
    let switchBreakerUntil = 0
    let burstPunished      = []

    const retractBurstPenalties = () => {
        const hosts = [...new Set(burstPunished)]
        burstPunished = []
        hosts.forEach(host => {
            const h = cdnHealth[host]
            if (h && h.failures > 0) h.failures--
            if (cdnSoftBlockUntil[host]) {
                delete cdnSoftBlockUntil[host]
                if (h) {
                    h.lastSoftBlockReason = ''
                    if (h.softBlocks > 0) h.softBlocks--
                }
            }
            if (!activeCdnList.includes(host) && !blacklistSet.has(host)
                && !knownDeadHosts.has(host) && PREFERRED_CDN_LIST.includes(host)) {
                activeCdnList.push(host)
            }
        })
        if (hosts.length) {
            scheduleCdnHealthSave()
            promoteBestCdnNow()
        }
        return hosts
    }
    let lastNudgeDetectAt = 0
    let lastTickAt        = 0
    let observer          = null
    let timer             = null
    let started           = false
    let startedAt         = 0
    // 剛換過節點：新連線要重做 TCP+TLS 並經歷 slow-start，這段期間量到的速度天生偏低、
    // buffered.end 也還沒開始動。不給寬限的話會出現使用者 log 裡那種
    // 「賽馬切到 cos → 下一個 tick 就懲罰 cos」的荒謬序列 —— 新節點根本還沒機會表現。
    let switchGraceUntil  = 0
    let reached           = false
    let sessionSwitchCount = 0
    let sessionStallCount  = 0
    let sessionHardFailCount = 0
    let recoveryObservation = null
    let recoverySequence = 0
    const interruptRecovery = () => {
        if (recoveryObservation) DiagnosticLog.record('recovery', { ...recoveryObservation, outcome: 'interrupted' }, true)
        recoveryObservation = null
    }
    const observeRecovery = (state, now) => {
        const r = recoveryObservation
        if (!r) return
        if (r.generation !== runtimeGeneration || r.epoch !== playinfoEpoch
            || !state.valid || state.paused || state.seeking || state.ended || state.errorCode || inSeekGrace()) {
            interruptRecovery(); return
        }
        if (now < switchGraceUntil) return
        r.count++
        const progress = state.currentTime > r.currentTime + 0.05 || state.bufferAheadSec > r.bufferAheadSec + 0.05
        if (progress || r.count >= 3) {
            DiagnosticLog.record('recovery', { ...r, outcome: progress ? 'progress' : 'no-progress' }, true)
            recoveryObservation = null
        }
    }
    const perCdnBytes     = {}
    // Resource Timing 是頁面也能間接製造的觀察訊號，只允許它提供有界的成功／吞吐樣本。
    // 它不能把任意 hostname 寫入 CDN health，也不能藉由 Infinity／超大值污染 Watchdog。
    const PERFORMANCE_ENTRY_URL_MAX = 16 * 1024
    const PERFORMANCE_ENTRY_BYTES_MAX = 256 * 1024 * 1024
    const PERFORMANCE_ENTRY_DURATION_MAX_MS = 10 * 60 * 1000

    const getWatchdogSample = () => ({
        totalBytes,
        stallEvents: sessionStallCount,
        switchCount: sessionSwitchCount,
        hardFailCount: sessionHardFailCount,
        elapsedSec: Math.max(1, (Date.now() - startedAt) / 1000),
        reachedTarget: reached,
    })

    const onEntry = (entry) => {
        if (disabled || !entry || typeof entry.name !== 'string'
            || !entry.name || entry.name.length > PERFORMANCE_ENTRY_URL_MAX) return
        if (!/\.m4s($|\?)/i.test(entry.name) && !/\.flv($|\?)/i.test(entry.name)) return
        // 這個 segment 若已經被 XHR/fetch 攔截層直接量過真實位元組（見 noteSegmentBytes /
        // fetch 攔截的 content-length 分支），這裡就跳過，避免同一包重複計入兩次。
        // 這條路徑只在對方量不到時（例如非我方攔截的請求）當備援。
        if (wasSegmentAccounted(entry.name)) return
        const bytes = Number(entry.transferSize || entry.encodedBodySize || 0)
        if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > PERFORMANCE_ENTRY_BYTES_MAX) return
        try {
            const h = new URL(entry.name).hostname
            if (!TRUSTED_CDN_CATALOG_SET.has(h)) return
            observeMediaTransfer(captureMediaRequest(entry.name), entry.name, bytes, 'performance')
            totalBytes = Math.min(Number.MAX_SAFE_INTEGER, totalBytes + bytes)
            perCdnBytes[h] = Math.min(Number.MAX_SAFE_INTEGER, (perCdnBytes[h] || 0) + bytes)
            // 用最新觀察到的播放倍速計算 required Mbps，避免倍速下少抓 slow
            const v = getVideo()
            const rate = v
                ? syncPlaybackRateFromVideo(v, 'performance').effectiveRate
                : playbackRateState.effectiveRate
            // entry.duration 含 redirect/DNS/TCP/TLS/TTFB，跟 XHR/fetch 路徑（只算純傳輸時間）
            // 量綱不一致，混在同一個 EWMA 裡會系統性高估這條路徑的速度。優先用
            // responseEnd-responseStart（純傳輸），兩者缺一（未送 Timing-Allow-Origin）才退回 duration。
            const dur = (entry.responseEnd && entry.responseStart)
                ? (entry.responseEnd - entry.responseStart)
                : (entry.duration || 0)
            if (Number.isFinite(dur) && dur > 0 && dur <= PERFORMANCE_ENTRY_DURATION_MAX_MS) {
                recordCdnThroughput(h, bytes, dur, rate)
            }
        } catch {}
    }

    // onEntry() 每個 segment 都呼叫一次 getVideo()，4K 下可能每秒好幾次全文件 querySelectorAll。
    // 快取命中的 video 元素，只有它被拔掉（換片重建播放器）才重新掃描。
    let cachedVideo = null
    const getVideo = () => {
        if (cachedVideo && cachedVideo.isConnected && cachedVideo.clientWidth) return cachedVideo
        let best = null, bestArea = 0
        document.querySelectorAll('video').forEach(v => {
            const a = (v.clientWidth || 0) * (v.clientHeight || 0)
            if (a > bestArea) { bestArea = a; best = v }
        })
        cachedVideo = best
        return best
    }

    const bufferedEnd = (v) => {
        try {
            if (!v) return 0
            const now = v.currentTime || 0
            if (!v.buffered || v.buffered.length === 0) return now
            // 只取包含 currentTime 的連續 range。seek 後可能殘留遠端 range，直接拿最後一段
            // 會把 3 秒真實緩衝誤報成數百秒，Watchdog 因而完全不救援。
            for (let i = 0; i < v.buffered.length; i++) {
                const start = v.buffered.start(i)
                const end = v.buffered.end(i)
                if (now >= start - 0.05 && now <= end + 0.05) return end
            }
            return now
        } catch { return v ? (v.currentTime || 0) : 0 }
    }

    const fmtMB = (b) => (b / 1024 / 1024).toFixed(2)

    const noteSeek = () => {
        stallCount = 0
        bumpSeekGrace()
    }

    // 任何「換到另一個節點」之後都該呼叫：重置停滯累計與 buffered 基準，
    // 並給新連線一段寬限。Watchdog 自己換節點時會呼叫，賽馬中途切換也會（見 doBakeoff）。
    const noteCdnSwitched = () => {
        stallCount = 0
        lastBufferedEnd = 0
        byteSamples = []
        switchGraceUntil = Date.now()
            + ((currentStreamBitsPerSec / 1e6 >= 12) ? STARTUP_GRACE_MS_HIGH : STARTUP_GRACE_MS)
    }

    const switchCdn = (reason) => {
        if (inSeekGrace()) { DiagnosticLog.setDecision('seek-grace'); return }
        const nowSw = Date.now()
        if (nowSw < switchBreakerUntil) { DiagnosticLog.setDecision('breaker', { remainingMs: switchBreakerUntil - nowSw }); return }
        if (nowSw - lastSwitchAt < SWITCH_COOL) { DiagnosticLog.setDecision('cooldown', { remainingMs: SWITCH_COOL - (nowSw - lastSwitchAt) }); return }

        // 斷路器（見上方宣告處的完整說明）：短時間內已經換過太多次還是沒改善，
        // 代表問題不在節點，停手並收回這一波的懲罰。
        switchTimes = switchTimes.filter(t => nowSw - t < SWITCH_BURST_WINDOW)
        if (switchTimes.length >= SWITCH_BURST_MAX) {
            switchBreakerUntil = nowSw + SWITCH_BREAKER_MS
            switchTimes = []
            const retracted = retractBurstPenalties()
            DiagnosticLog.record('breaker', { remainingMs: SWITCH_BREAKER_MS, count: retracted.length }, true)
            log('[Watchdog] ' + Math.round(SWITCH_BURST_WINDOW / 1000) + ' 秒內已切換 '
                + SWITCH_BURST_MAX + ' 次後未觀察到改善，原因尚未確認；暫停切換 '
                + Math.round(SWITCH_BREAKER_MS / 1000) + ' 秒'
                + (retracted.length ? '；收回本波懲罰：' + retracted.map(h => h.split('.')[0]).join('、') : ''))
            return
        }
        switchTimes.push(nowSw)
        lastSwitchAt = nowSw
        sessionSwitchCount++
        // 換完之後給新連線一段 slow-start 寬限，別讓下一個 tick 立刻又判它有罪。
        noteCdnSwitched()
        interruptRecovery()
        const recoveryState = readPlaybackDiagnostic()
        recoveryObservation = { actionId: ++recoverySequence, generation: runtimeGeneration, epoch: playinfoEpoch,
            count: 0, currentTime: recoveryState.currentTime, bufferAheadSec: recoveryState.bufferAheadSec }
        DiagnosticLog.record('recovery', { ...recoveryObservation, outcome: 'attempt' }, true)

        if (HttpDnsAutoPilot.onStall(reason, getWatchdogSample())) {
            DiagnosticLog.record('recovery', { actionId: recoverySequence, reason: 'httpdns', reselected: true }, true)
            promoteBestCdnNow()
            reorderCdnsByLatency(true).catch(reportMeasurementFailure())
            return
        }

        // 只懲罰「最近實際在拉 segment」的元兇，避免歷史用過的 CDN 被連坐。
        // 排除 Akamai/MCDN/PCDN/已黑名單/已標死 等本來就會走 fallback 的 host。
        const playingHost = getAttributedVideoHost()
        const culprit = playingHost && !isUnstableCdnHost(playingHost)
            && !blacklistSet.has(playingHost) && !knownDeadHosts.has(playingHost) ? playingHost : null

        if (culprit) {
            recordCdnPenalty(culprit, false)
            softBlockCdn(culprit, reason, CDN_SOFT_BLOCK_MS)
            burstPunished.push(culprit)   // 斷路器跳脫時要能把這一波的懲罰收回去
            log('[Watchdog] 切換觸發：' + reason + '，懲罰 ' + culprit.split('.')[0])
        }
        DiagnosticLog.record('recovery', { actionId: recoverySequence, reason: culprit ? 'attributed' : 'no-attribution',
            host: culprit, punished: !!culprit, reselected: true, preconnect: true }, true)

        try { GM_deleteValue(PROBE_CACHE_KEY) } catch {}
        promoteBestCdnNow()
        // 保留原本的預熱提示數與時機。現用／建議節點只補缺提示；
        // 是否建立或保留連線由瀏覽器決定，不把 DOM 操作當 socket 控制。
        const warmHost = playingHost || getWarmCdnHost()
        const warmTargets = getHealthyCdnList().slice(0, 3).filter(h => h !== warmHost)
        preconnectBatch(warmTargets, true)
        if (warmHost) preconnectCdn(warmHost, false)
        // 延遲探測（探測 RTT）本身也在搶頻寬，且卡頓當下最有參考價值的是賽馬（真實 segment）。
        // 延後 10 秒、且確認不在 seek 預熱窗內才跑，讓賽馬/換節點先把頻寬用在刀口上。
        // reorderCdnsByLatency 內部有 bakeoffRunning 互斥（見該函式），4K 賽馬最長可能跑
        // 到 ~12 秒，剛好可能跟這裡的 10 秒延遲重疊——若當下還在跑，reorderCdnsByLatency
        // 會直接靜默放棄且不會重試。這裡補一次有限重試，避免整個延遲探測憑運氣决定有沒有跑。
        // seek 預熱窗（inSeekGrace）撞上同一個時間點時道理相同，一併納入重試，不然使用者
        // 剛好在第 10 秒拖曳時間軸，這次延遲探測就會被無聲放棄、不會像 bakeoffRunning
        // 那樣有重試機會。
        const scheduleDelayedReorder = (retriesLeft) => {
            scheduleRuntimeTimeout(() => {
                if ((inSeekGrace() || bakeoffRunning) && retriesLeft > 0) { scheduleDelayedReorder(retriesLeft - 1); return }
                if (inSeekGrace()) return
                reorderCdnsByLatency(true).catch(reportMeasurementFailure())
            }, 10000)
        }
        scheduleDelayedReorder(2)
        // 4K：卡頓多半是節點速度不夠，立刻實測各節點下載速度，確保切到真的夠快的節點
        // Watchdog 已經判定停滯才會走到這裡，不能被「現用節點目前還算快」的捷徑擋掉。
        if (currentStreamBitsPerSec / 1e6 >= 12 && lastSampleSegmentUrl) {
            runThroughputBakeoff(lastSampleSegmentUrl, false, trustedBakeoffRequest('watchdog')).catch(reportMeasurementFailure())
        }
        // 不 nudge currentTime：跟 bili player 內建 Stuck:Rescue 搶會 buffer 抖動
        // 軟封鎖 + 下次 segment 走攔截層改 host 就夠
    }

    const tick = () => {
        if (disabled) { DiagnosticLog.setDecision('disabled'); return }
        const v = getVideo()
        if (!v) { resetPlaybackRateState(); stallCount = 0; interruptRecovery(); DiagnosticLog.setDecision('no-video'); return }
        const playback = readPlaybackDiagnostic(v)
        const unavailable = !playback.valid ? 'invalid-state'
            : playback.errorCode ? 'media-error'
            : playback.ended || (playback.duration > 0 && playback.currentTime >= playback.duration) ? 'ended'
            : playback.paused ? 'paused' : playback.seeking ? 'seeking'
            : playback.readyState === 0 ? 'no-metadata' : null
        if (unavailable) {
            stallCount = 0; lastCurrentTime = playback.currentTime || 0
            lastBufferedEnd = playback.currentTime || 0; lastTickAt = Date.now()
            byteSamples = []; interruptRecovery(); DiagnosticLog.setDecision(unavailable, playback); return
        }

        // v1.3.3：先把碼率校正成「實際正在播的畫質」，下面所有門檻
        // （highBitrate / minBps / minAheadEff / targetBytes）才會是對的。
        syncStreamBitrateFromVideo(v)

        // 背景分頁偵測：瀏覽器會把 timer 節流（背景 ≥1/min、5 分後更嚴）。
        // tick 間隔遠大於 1s 代表剛從背景切回，期間 bps/buffered 取樣全部失真，
        // 此時若照常判定會誤以為 CDN 變慢而切換 → 切回前景反而 reload。
        // 只重設基準、清 stallCount，跳過這一輪。
        const nowTick   = Date.now()
        const sinceLast = lastTickAt ? nowTick - lastTickAt : TICK_MS
        lastTickAt      = nowTick
        if (sinceLast > TICK_MS * 3) {
            byteSamples     = []   // v1.3.3：背景節流期間的取樣全部失真，整批丟掉重來
            lastCurrentTime = v.currentTime
            lastBufferedEnd = bufferedEnd(v)
            stallCount      = 0
            DiagnosticLog.setDecision('background-gap', { waitMs: sinceLast })
            return
        }

        const be  = bufferedEnd(v)
        // v1.3.3：bps 改用滑動視窗，不再用「單一 tick 的位元組差」。
        // 播放器抓 segment 是一陣一陣的：抓完一段就閒置好幾秒，再抓下一段。
        // 用單秒差值來看，這些「正常的段間空檔」會被算成 bps≈0，而 stallMaxEff 在
        // 高碼率下只有 2 —— 也就是「連續兩秒沒下載」就換節點。但連續兩三秒沒下載
        // 對分段下載來說完全正常，於是好節點會被無故懲罰、軟隔離、換掉。
        // 改成看最近 BPS_WINDOW_MS 的平均，跨過段間空檔，量到的才是真實吞吐。
        byteSamples.push({ t: nowTick, bytes: totalBytes, ahead: Math.max(0, be - v.currentTime) })
        while (byteSamples.length > 1 && nowTick - byteSamples[0].t > BPS_WINDOW_MS) byteSamples.shift()
        const oldestSample = byteSamples[0]
        const bpsSpanSec = Math.max(0.2, (nowTick - oldestSample.t) / 1000)
        const bps = (totalBytes - oldestSample.bytes) / bpsSpanSec
        const rateState = syncPlaybackRateFromVideo(v, 'watchdog')
        const playRate = rateState.observedRate
        const targetBytes = getBufferTargetBytes(rateState.effectiveRate)

        if (!reached && totalBytes >= targetBytes) {
            reached = true
            HttpDnsAutoPilot.onTargetReached(getWatchdogSample())
        }

        HttpDnsAutoPilot.tick(getWatchdogSample())

        // 偵測 bili player [Stuck:Rescue]：
        // 1x 正常播放每秒 ctDelta ≈ 1.0，舊邏輯 ctDelta>0.1 && <1.5 會把它誤判為 nudge，
        // 導致 stallCount 永遠被歸零、watchdog 失效。
        // 改成「實際前進量 - 預期前進量」大於 0.15s 才視為 player 自救跳轉。
        const ct           = v.currentTime
        const ctDeltaRaw   = ct - lastCurrentTime
        const ctDeltaAbs   = Math.abs(ctDeltaRaw)
        const expectedDelta = (v.paused || v.seeking) ? 0 : playRate * (sinceLast / 1000)
        const nudgeOver    = ctDeltaRaw - expectedDelta
        // Stuck:Rescue 通常一次跳 0.1~1.5 秒，外加正常前進量
        const playerNudge  = !v.paused && nudgeOver > 0.15 && nudgeOver < 1.6
        // 倍速播放本來每 tick 就可能前進 2~4 秒；只有相對「倍速 × 實際 tick 間隔」
        // 額外多跳至少 0.75 秒，或發生倒帶，才視為 user seek。
        const userSeek     = ctDeltaRaw < -0.1
            || (ctDeltaAbs >= 2 && nudgeOver >= 0.75)
        lastCurrentTime = ct

        if (userSeek) noteSeek()

        if (playerNudge) {
            lastNudgeDetectAt = Date.now()
            stallCount = 0
            lastBufferedEnd = be
            DiagnosticLog.setDecision('player-nudge')
            return
        }
        // seek 到未載入區段時，播放器通常會 abort 舊請求並重建新 segment；
        // 這段時間 bps=0 是正常狀態，不能當作 CDN 卡頓。
        if (inSeekGrace()) {
            stallCount = 0
            lastBufferedEnd = be
            interruptRecovery(); DiagnosticLog.setDecision('seek-grace')
            return
        }
        // 自救後短時間內不重複判定卡頓
        if (Date.now() - lastNudgeDetectAt < 3000) {
            stallCount = 0
            lastBufferedEnd = be
            DiagnosticLog.setDecision('nudge-grace', { remainingMs: 3000 - (Date.now() - lastNudgeDetectAt) })
            return
        }

        // buffered.end 在超前緩衝充足時播放中常不變（僅 start 前移），勿當停滯
        const bufferAhead = Math.max(0, be - ct)
        const playing = !v.paused && !v.seeking && v.readyState >= 2

        // 高碼率（4K / 高 fps）：下載速度只要低於即時碼率，緩衝就會慢慢被吃完最後卡住。
        // 對 4K 更快反應（stallMaxEff 較小）、達標後也更早恢復監看（recheckEff 較大）。
        // 註：這裡原本還有一個 minAheadEff（高碼率 30 秒），它是「希望存這麼多緩衝」的
        // 目標線，卻被拿來當「該不該換節點」的觸發條件 —— 那正是「一直換節點」的根因
        //（見 STALL_DANGER_SEC 的完整說明）。觸發條件改用危險線之後它就沒有讀者了，
        // 一併刪除，不留下「看起來還有作用其實沒有」的變數。
        const streamMbps  = currentStreamBitsPerSec / 1e6
        const highBitrate = streamMbps >= 12
        const recheckEff  = highBitrate ? 20 : REACHED_RECHECK_BUFFER_SEC
        const stallMaxEff = highBitrate ? 2 : STALL_MAX

        // 剛開播/換片幾秒內的 slow-start 緩衝期：只累積 lastBufferedEnd 基準，不判定停滯，
        // 讓連線先把速度跑起來，避免才剛連上就急著換節點。
        const graceMs = highBitrate ? STARTUP_GRACE_MS_HIGH : STARTUP_GRACE_MS
        if (Date.now() - startedAt < graceMs || Date.now() < switchGraceUntil) {
            stallCount = 0
            lastBufferedEnd = be
            DiagnosticLog.setDecision(Date.now() < switchGraceUntil ? 'switch-grace' : 'startup-grace', {
                remainingMs: Math.max(startedAt + graceMs, switchGraceUntil) - Date.now(),
            })
            return
        }
        observeRecovery(playback, nowTick)

        // 只有進了危險線才考慮換節點（見 STALL_DANGER_SEC 的說明）。
        // 註：原本這裡還有一個 needMoreBuffer = bufferAhead < minAheadEff，它是舊的觸發條件。
        // 「要不要繼續積極監看」其實是由下面的 monitorAfterReached 在管，跟它無關，
        // 所以連同 minAheadEff 一起刪掉，不留下「看起來還有作用其實沒有」的變數。
        const inDanger = bufferAhead < STALL_DANGER_SEC
        const urgentBuffer = bufferAhead < URGENT_BUFFER_SEC
        const monitorAfterReached = reached && bufferAhead < recheckEff
        if (reached && !monitorAfterReached) {
            stallCount = 0
            lastBufferedEnd = be
            DiagnosticLog.setDecision('target-reached')
            return
        }
        // 4K：門檻 = 即時碼率本身（下載低於它必定耗盡緩衝）；其他畫質沿用較寬鬆的需求值
        const requiredBps = getWatchdogRequiredBps(streamMbps, rateState.effectiveRate, highBitrate)
        // v1.3.3：MIN_BPS_FLOOR 這個絕對下限，本來只是為了「碼率未知時不要訂出荒謬的
        // 低門檻」。但碼率已經知道、而且很低時（480p 只需要約 0.11 MB/s），
        // 350 KB/s 的下限反而變成一個跟這支片無關的高門檻 —— 播放器穩態根本不會拉到
        // 那麼快，於是低碼率影片被永久誤判成「太慢」。下限不該超過實際需求的 1.2 倍。
        const effFloor = requiredBps > 0 ? Math.min(MIN_BPS_FLOOR, requiredBps * 1.2) : MIN_BPS_FLOOR
        const minBps = Math.max(effFloor, requiredBps)
        // v1.3.3：緩衝存量的趨勢才是「跟不跟得上」的物理事實。
        // 只看 bps 對不對得上估算門檻，會有一整類系統性誤判：播放器在穩態下只會拉
        // 「剛好等於碼率」的量（它本來就不該把頻寬吃滿），而門檻是碼率 ×1.05 —— 
        // 於是只要緩衝低於 minAheadEff，bps 就結構性地永遠略低於門檻，判定必然成立。
        // 但如果緩衝存量並沒有在減少，那就代表下載其實跟得上，不管估算門檻怎麼說。
        // 例外：緩衝已經進入危險區（urgentBuffer）時不套用這個條件 —— 那時候就算
        // 打平也只差一次抖動就斷了，該換還是要換。
        const oldestAhead = oldestSample.ahead
        const bufferDraining = typeof oldestAhead === 'number'
            ? (bufferAhead < oldestAhead - 0.5)
            : true
        // stalled（buffered.end 不再前進）有完全一樣的結構性誤判：播放器抓完一段就
        // 閒置到下一段，這段期間 buffered.end 本來就不會動 —— 但播放時間持續前進，
        // 連續 2~3 個 tick 就達到 stallMax。所以它同樣要用「整個視窗看緩衝有沒有真的
        // 在流失」來把關，而不是用 tick 對 tick 的瞬間值。
        const stalled = inDanger
            && (be <= lastBufferedEnd + 0.05)
            && playing
            && (urgentBuffer || bufferDraining)
        const tooSlow = inDanger
            && bps < (urgentBuffer ? minBps * 1.2 : minBps)
            && playing
            && totalBytes > 0
            && (urgentBuffer || bufferDraining)
        const lowData = v.readyState === 1 && urgentBuffer
            && ctDeltaRaw <= 0.05 && be <= lastBufferedEnd + 0.05
        lastBufferedEnd = be

        if (stalled || tooSlow || lowData) {
            stallCount += urgentBuffer ? 2 : 1
            DiagnosticLog.setDecision(lowData ? 'low-data' : stalled ? 'buffered-stall' : 'too-slow', {
                stallCount, bufferAheadSec: bufferAhead, readyState: v.readyState,
            })
            if (stallCount >= stallMaxEff) {
                stallCount = 0
                sessionStallCount++
                switchCdn(lowData ? 'low-data：資料不足且播放進度停滯' : stalled ? 'buffered 停滯' : 'bps=' + Math.round(bps / 1024) + 'KB/s 低於需求')
            }
        } else {
            stallCount = 0
            DiagnosticLog.setDecision('healthy', { bufferAheadSec: bufferAhead })
        }
    }

    return {
        // 由 Worker 透過 MessagePort 回報的 segment 下載量（主執行緒 PerformanceObserver 看不到 Worker 流量）。
        // 無 duration 故不更新單節點吞吐 EWMA，但計入總量讓面板 MB 正確、Watchdog 的 bps 判斷不再對 4K 半盲。
        noteExternalBytes(host, bytes) {
            if (disabled || !Number.isSafeInteger(bytes) || bytes <= 0 || bytes > 256 * 1024 * 1024) return
            totalBytes = Math.min(Number.MAX_SAFE_INTEGER, totalBytes + bytes)
            if (TRUSTED_CDN_CATALOG_SET.has(host)) {
                perCdnBytes[host] = Math.min(Number.MAX_SAFE_INTEGER, (perCdnBytes[host] || 0) + bytes)
            }
        },
        // recordCdnFailure 的 hard-fail 分支呼叫；getWatchdogSample() 的 hardFailCount
        // 過去永遠回 0（沒有任何地方會遞增它），導致 HTTPDNS computeScore 裡的
        // hardFailCount 懲罰項形同虛設。
        noteHardFail() {
            sessionHardFailCount++
        },
        start() {
            if (started) return
            started   = true
            startedAt = Date.now()
            try {
                observer = new PerformanceObserver((list) => list.getEntries().forEach(onEntry))
                observer.observe({ type: 'resource', buffered: true })
            } catch { DiagnosticLog.fault('watchdog') }
            timer = setInterval(() => { try { tick() } catch { DiagnosticLog.fault('watchdog') } }, TICK_MS)
        },
        stop() {
            interruptRecovery()
            if (observer) { try { observer.disconnect() } catch {} ; observer = null }
            if (timer) { clearInterval(timer); timer = null }
            started = false
        },
        reset() {
            interruptRecovery()
            totalBytes = 0; lastBufferedEnd = 0; stallCount = 0
            lastCurrentTime = 0; lastNudgeDetectAt = 0; lastTickAt = 0
            byteSamples = []
            reached = false; startedAt = Date.now()
            sessionSwitchCount = 0; sessionStallCount = 0; sessionHardFailCount = 0
            resetMediaDelivery()
            switchTimes = []; switchBreakerUntil = 0; burstPunished = []; switchGraceUntil = 0
            cachedVideo = null
            Object.keys(perCdnBytes).forEach(k => delete perCdnBytes[k])
        },
        stats() {
            const state = readPlaybackDiagnostic()
            const targetBytes = getBufferTargetBytes()
            const videoTimeSec = +(state.currentTime || 0).toFixed(2)
            const bufferedEndSec = +(videoTimeSec + (state.bufferAheadSec || 0)).toFixed(2)
            const bufferAheadSec = +Math.max(0, bufferedEndSec - videoTimeSec).toFixed(2)
            return {
                totalMB:       +fmtMB(totalBytes),
                targetMB:      +fmtMB(targetBytes),
                reachedTarget: reached,
                // bufferedSec 保留為相容別名；新程式請用語意明確的 bufferedEndSec / bufferAheadSec。
                bufferedSec:   bufferedEndSec,
                bufferedEndSec,
                bufferAheadSec,
                videoTimeSec,
                readyState:    state.readyState === null ? -1 : state.readyState,
                paused:        state.paused,
                perCdnMB:      Object.fromEntries(
                    Object.entries(perCdnBytes).map(([k, b]) => [k.split('.')[0], +fmtMB(b)])
                ),
                perCdnMbps:    Object.fromEntries(
                    Object.entries(cdnHealth)
                        .filter(([, h]) => h.samples > 0)
                        .map(([k, h]) => [k.split('.')[0], +h.ewmaMbps.toFixed(2)])
                ),
                requiredMbps:  +getRequiredStreamMbps().toFixed(2),
                cdnScore:      Object.fromEntries(
                    Object.keys(cdnHealth)
                        .filter(k => cdnHealth[k].samples > 0)
                        .map(k => [k.split('.')[0], +getCdnHealthScore(k).toFixed(2)])
                ),
                elapsedSec:    Math.round((Date.now() - startedAt) / 1000),
                // 換節點次數與斷路器狀態。使用者回報「畫面一直卡、log 一直在換節點」時，
                // 這兩個數字是最直接的判讀依據：switchCount 一直漲代表 Watchdog 認為節點有問題；
                // breakerSec > 0 代表已經判定「換也沒用」而停手，瓶頸在頻寬/碼率/跨境線路。
                switchCount:   sessionSwitchCount,
                stallCount:    sessionStallCount,
                breakerSec:    Math.max(0, Math.round((switchBreakerUntil - Date.now()) / 1000)),
            }
        },
        noteSeek,
        // 相容內部名稱：現在只回傳新鮮、已辨識的影片 Transport host，不能用音訊或排名猜測。
        getLastSegmentCdn: getAttributedVideoHost,
        getVideo,
        noteCdnSwitched,
    }
})()

// ── Tampermonkey 可信選單 UI ──────────────────────────────────────────
// 頁面本身是不可信來源。UI 雖然渲染在頁面 DOM，真正的控制仍只存在於 sandbox 閉包：
// - closed ShadowRoot 讓頁面拿不到內部按鈕；
// - 所有控制按鈕只接受瀏覽器產生的 isTrusted 事件；
// - 每個 mutator dialog 都有 crypto.getRandomValues 建立的一次性 capability；
// - 選擇結果只回傳閉包內 index，不解析頁面可改寫的 host 字串。
const TrustedMenuUI = (() => {
    const HOST_ID = 'bilicdn-trusted-menu-ui'
    const MAX_TOASTS = 3
    const TONE_TTL = Object.freeze({ success: 3000, info: 3000, warning: 5000, error: 5000 })
    const bounded = (value, max = 2000) => String(value == null ? '' : value).slice(0, max)
    const call = fn => Function.call.bind(fn)
    const dom = {
        create: document.createElement.bind(document),
        append: call(Node.prototype.appendChild),
        remove: Element.prototype.remove ? call(Element.prototype.remove) : node => {
            if (node && node.parentNode) node.parentNode.removeChild(node)
        },
        attachShadow: call(Element.prototype.attachShadow),
        addEvent: call(EventTarget.prototype.addEventListener),
        focus: HTMLElement.prototype.focus ? call(HTMLElement.prototype.focus) : () => {},
    }

    let host = null
    let shadow = null
    let toastLayer = null
    let modalLayer = null
    let activeModal = null
    let activeCapability = null
    let uiSession = null
    let sessionRevision = 0
    let serial = 0
    const toastEntries = []

    const make = (tag, text, attrs = {}) => {
        const node = dom.create(tag)
        if (text != null) node.textContent = bounded(text, attrs.maxText || 2000)
        if (attrs.className) node.className = attrs.className
        if (attrs.kind) node.dataset.uiKind = attrs.kind
        if (attrs.action) node.dataset.uiAction = attrs.action
        if (attrs.role) node.setAttribute('role', attrs.role)
        if (attrs.ariaLabel) node.setAttribute('aria-label', bounded(attrs.ariaLabel, 200))
        return node
    }

    const ensure = () => {
        if (host && shadow && host.parentNode) return true
        try {
            host = make('div')
            host.id = HOST_ID
            host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;'
            shadow = dom.attachShadow(host, { mode: 'closed' })
            const style = make('style', `
                :host{all:initial;color-scheme:dark}
                *{box-sizing:border-box}
                .toasts{position:fixed;top:18px;right:18px;width:min(380px,calc(100vw - 36px));display:grid;gap:8px;pointer-events:none;font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
                .toast{border:1px solid #4b5563;border-left:4px solid #38bdf8;border-radius:8px;background:#111827;color:#f9fafb;padding:10px 12px;box-shadow:0 8px 28px #0009;white-space:pre-wrap;overflow-wrap:anywhere}
                .toast.success{border-left-color:#4ade80}.toast.warning{border-left-color:#fbbf24}.toast.error{border-left-color:#fb7185}
                .modal-layer{position:fixed;inset:0;pointer-events:none;font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
                .backdrop{position:absolute;inset:0;background:#0009;display:grid;place-items:center;padding:20px;pointer-events:auto}
                .dialog{width:min(640px,100%);max-height:min(82vh,760px);display:flex;flex-direction:column;overflow:hidden;border:1px solid #4b5563;border-radius:12px;background:#111827;color:#f9fafb;box-shadow:0 18px 64px #000c}
                .head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 18px;border-bottom:1px solid #374151}
                .title{margin:0;font-size:18px;line-height:1.35}.body{padding:16px 18px;overflow:auto;display:grid;gap:12px}
                .text{margin:0;color:#d1d5db;white-space:pre-wrap;overflow-wrap:anywhere}.detail{font-size:12px;color:#9ca3af}
                .choices{display:grid;gap:8px}.choice{width:100%;text-align:left;border:1px solid #4b5563;border-radius:8px;background:#1f2937;color:#f9fafb;padding:9px 11px;cursor:pointer}
                .choice.selected{border-color:#38bdf8;background:#0c4a6e}.choice:disabled{opacity:.55;cursor:not-allowed}
                .choice-main{display:block}.choice-detail{display:block;margin-top:2px;font-size:12px;color:#cbd5e1}
                .section-title{margin:4px 0 0;font-size:13px;color:#7dd3fc}.action-list{display:grid;gap:8px}.action-list .btn{text-align:left;padding:10px 12px}
                .report{width:100%;min-height:260px;resize:vertical;border:1px solid #4b5563;border-radius:8px;background:#030712;color:#e5e7eb;padding:10px;font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace}
                .actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;padding:13px 18px;border-top:1px solid #374151}
                button{font:inherit}.btn{border:1px solid #4b5563;border-radius:7px;background:#1f2937;color:#f9fafb;padding:7px 13px;cursor:pointer}.btn.primary{border-color:#0284c7;background:#0369a1}.btn.danger{border-color:#be123c;background:#9f1239}.btn:disabled{opacity:.45;cursor:not-allowed}
                @media(max-width:600px){.toasts{top:10px;right:10px;width:calc(100vw - 20px)}.backdrop{padding:10px}.dialog{max-height:90vh}}
                @media(prefers-reduced-motion:no-preference){.toast,.dialog{animation:biliCdnIn .14s ease-out}@keyframes biliCdnIn{from{opacity:.25;transform:translateY(-5px)}to{opacity:1;transform:none}}}
            `, { maxText: 12000 })
            toastLayer = make('div', null, { className: 'toasts', role: 'status', ariaLabel: 'BiliCDN 操作訊息' })
            toastLayer.setAttribute('aria-live', 'polite')
            toastLayer.setAttribute('aria-atomic', 'false')
            modalLayer = make('div', null, { className: 'modal-layer' })
            dom.append(shadow, style)
            dom.append(shadow, toastLayer)
            dom.append(shadow, modalLayer)
            dom.addEvent(shadow, 'keydown', event => {
                if (!event || !event.isTrusted || !activeModal) return
                if (event.key === 'Escape') {
                    event.preventDefault(); event.stopPropagation(); closeDialog()
                } else if (event.key === 'Tab') {
                    const targets = []
                    const visit = node => {
                        if (!node || node.hidden || node.style?.display === 'none' || node.style?.visibility === 'hidden'
                            || node.getAttribute?.('aria-hidden') === 'true') return
                        const tab = node.getAttribute?.('tabindex')
                        if (!node.disabled && (tab == null || Number(tab) >= 0)
                            && (['BUTTON', 'TEXTAREA', 'INPUT', 'SELECT'].includes(node.tagName) || (tab != null && Number(tab) >= 0))) targets.push(node)
                        ;[...(node.children || [])].forEach(visit)
                    }
                    visit(activeModal)
                    if (targets.length) {
                        const focused = shadow.activeElement || document.activeElement
                        const index = targets.indexOf(focused)
                        const next = index < 0 ? (event.shiftKey ? targets.length - 1 : 0)
                            : (index + (event.shiftKey ? -1 : 1) + targets.length) % targets.length
                        event.preventDefault(); event.stopPropagation(); dom.focus(targets[next])
                    }
                }
            })
            dom.append(document.documentElement, host)
            return true
        } catch (e) {
            try { console.error('[BiliCDN] 無法建立可信選單 UI：', e) } catch {}
            host = shadow = toastLayer = modalLayer = null
            return false
        }
    }

    const removeToastEntry = entry => {
        const index = toastEntries.indexOf(entry)
        if (index >= 0) toastEntries.splice(index, 1)
        if (entry.timer) clearTimeout(entry.timer)
        try { if (entry.node) dom.remove(entry.node) } catch {}
        entry.node = null
    }

    const toast = (message, tone = 'info', options = {}) => {
        if (!ensure()) return Object.freeze({ update: () => {}, close: () => {} })
        const normalizedTone = Object.prototype.hasOwnProperty.call(TONE_TTL, tone) ? tone : 'info'
        const node = make('div', bounded(message, 500), {
            className: 'toast ' + normalizedTone,
            kind: 'toast',
            role: normalizedTone === 'error' ? 'alert' : 'status',
        })
        dom.append(toastLayer, node)
        const entry = { node, timer: null, tone: normalizedTone }
        toastEntries.push(entry)
        while (toastEntries.length > MAX_TOASTS) removeToastEntry(toastEntries[0])
        const arm = () => {
            if (entry.timer) clearTimeout(entry.timer)
            if (!options.sticky) entry.timer = setTimeout(() => removeToastEntry(entry), TONE_TTL[entry.tone])
        }
        arm()
        return Object.freeze({
            update(nextMessage, nextTone = entry.tone, sticky = false) {
                if (!entry.node) return
                entry.tone = Object.prototype.hasOwnProperty.call(TONE_TTL, nextTone) ? nextTone : 'info'
                entry.node.className = 'toast ' + entry.tone
                entry.node.textContent = bounded(nextMessage, 500)
                options.sticky = !!sticky
                arm()
            },
            close() { removeToastEntry(entry) },
        })
    }

    const mintCapability = () => {
        try {
            if (!crypto || typeof crypto.getRandomValues !== 'function') return null
            const bytes = new Uint8Array(16)
            crypto.getRandomValues(bytes)
            return Object.freeze({ serial: ++serial, bytes })
        } catch { return null }
    }

    const closeView = () => {
        activeCapability = null
        if (activeModal) {
            try { dom.remove(activeModal) } catch {}
            activeModal = null
        }
    }
    const restoreSessionFocus = session => {
        if (!session) return
        try {
            const video = Watchdog.getVideo()
            const target = session.focus && document.contains(session.focus) ? session.focus
                : video && document.contains(video) ? video : document.body
            if (!target) return
            if (target === document.body) {
                const oldTab = target.getAttribute('tabindex')
                target.setAttribute('tabindex', '-1')
                try { dom.focus(target, { preventScroll: true }) }
                finally { if (oldTab == null) target.removeAttribute('tabindex'); else target.setAttribute('tabindex', oldTab) }
            } else dom.focus(target, { preventScroll: true })
        } catch {}
    }
    const closeDialog = (restoreFocus = true) => {
        const session = uiSession
        closeView()
        uiSession = null
        sessionRevision++
        if (restoreFocus) restoreSessionFocus(session)
    }

    const beginDialog = ({ title, paragraphs = [], requiresCapability = false }) => {
        if (!ensure()) return null
        // Tampermonkey 可在前一個 dialog 尚未關閉時再開啟另一個 menu。保留最初的頁面
        // 焦點，不要把已移除 dialog 的關閉按鈕當成 Escape 後的回復目標。
        if (!uiSession) { uiSession = { focus: document.activeElement }; sessionRevision++ }
        closeView()
        const capability = requiresCapability ? mintCapability() : Object.freeze({ readOnly: true, serial: ++serial })
        if (!capability) {
            closeDialog()
            toast('安全亂數不可用，無法開啟會修改設定的對話框', 'error')
            return null
        }
        activeCapability = capability
        const backdrop = make('div', null, { className: 'backdrop', kind: 'dialog', role: 'presentation' })
        const panel = make('section', null, { className: 'dialog', role: 'dialog', ariaLabel: bounded(title, 120) })
        panel.setAttribute('aria-modal', 'true')
        const head = make('div', null, { className: 'head' })
        const heading = make('h2', title, { className: 'title', maxText: 160 })
        const close = make('button', '關閉', { className: 'btn', action: 'cancel', ariaLabel: '關閉對話框' })
        close.type = 'button'
        dom.addEvent(close, 'click', event => {
            if (!event || !event.isTrusted || activeCapability !== capability) return
            closeDialog()
        })
        dom.append(head, heading)
        dom.append(head, close)
        const body = make('div', null, { className: 'body' })
        ;[].concat(paragraphs || []).slice(0, 24).forEach(text => dom.append(body, make('p', text, { className: 'text' })))
        const actions = make('div', null, { className: 'actions' })
        dom.append(panel, head)
        dom.append(panel, body)
        dom.append(panel, actions)
        dom.append(backdrop, panel)
        dom.append(modalLayer, backdrop)
        activeModal = backdrop
        try { dom.focus(close) } catch {}
        return { capability, backdrop, panel, body, actions, close }
    }

    const addAction = (dialog, { label, action, tone = '', onActivate, closeOnActivate = true }) => {
        const button = make('button', label, {
            className: 'btn' + (tone ? ' ' + tone : ''),
            action,
            maxText: 100,
        })
        button.type = 'button'
        dom.addEvent(button, 'click', event => {
            if (!event || !event.isTrusted || activeCapability !== dialog.capability) return
            if (closeOnActivate) closeDialog(true)
            onActivate()
        })
        dom.append(dialog.actions, button)
        return button
    }

    const openConfirm = ({ title, paragraphs, confirmLabel = '確認', danger = false, onConfirm }) => {
        const dialog = beginDialog({ title, paragraphs, requiresCapability: true })
        if (!dialog) return false
        addAction(dialog, { label: '取消', action: 'cancel-secondary', onActivate: () => {} })
        addAction(dialog, {
            label: confirmLabel,
            action: 'confirm',
            tone: danger ? 'danger' : 'primary',
            onActivate: () => { if (typeof onConfirm === 'function') onConfirm() },
        })
        return true
    }

    const openChoice = ({
        title, paragraphs, choices = [], multiple = false, selected = [], confirmLabel = '套用',
        onConfirm, secondaryLabel = '', onSecondary,
    }) => {
        const dialog = beginDialog({ title, paragraphs, requiresCapability: true })
        if (!dialog) return false
        const safeChoices = choices.slice(0, 64).map(choice => ({
            label: bounded(choice && choice.label, 300),
            detail: bounded(choice && choice.detail, 500),
            disabled: !!(choice && choice.disabled),
        }))
        const picked = new Set([].concat(selected || []).filter(index => Number.isInteger(index)
            && index >= 0 && index < safeChoices.length))
        if (!multiple && picked.size > 1) {
            const first = picked.values().next().value
            picked.clear(); picked.add(first)
        }
        const list = make('div', null, { className: 'choices' })
        safeChoices.forEach((choice, index) => {
            const button = make('button', null, { className: 'choice', action: 'choice-' + index })
            button.type = 'button'
            button.disabled = choice.disabled
            const main = make('span', '', { className: 'choice-main' })
            const detail = make('span', choice.detail, { className: 'choice-detail' })
            const render = () => {
                const isPicked = picked.has(index)
                button.className = 'choice' + (isPicked ? ' selected' : '')
                main.textContent = (multiple ? (isPicked ? '☑ ' : '☐ ') : (isPicked ? '◉ ' : '○ ')) + choice.label
            }
            render()
            dom.append(button, main)
            if (choice.detail) dom.append(button, detail)
            dom.addEvent(button, 'click', event => {
                if (!event || !event.isTrusted || activeCapability !== dialog.capability || choice.disabled) return
                if (multiple) {
                    if (picked.has(index)) picked.delete(index); else picked.add(index)
                } else {
                    picked.clear(); picked.add(index)
                    safeChoices.forEach((_, other) => {
                        const otherButton = list.children && list.children[other]
                        if (!otherButton || !otherButton.children || !otherButton.children[0]) return
                        const on = picked.has(other)
                        otherButton.className = 'choice' + (on ? ' selected' : '')
                        otherButton.children[0].textContent = (on ? '◉ ' : '○ ') + safeChoices[other].label
                    })
                }
                render()
            })
            dom.append(list, button)
        })
        dom.append(dialog.body, list)
        addAction(dialog, { label: '取消', action: 'cancel-secondary', onActivate: () => {} })
        if (secondaryLabel && typeof onSecondary === 'function') {
            addAction(dialog, { label: secondaryLabel, action: 'secondary', onActivate: onSecondary })
        }
        addAction(dialog, {
            label: confirmLabel,
            action: 'confirm',
            tone: 'primary',
            onActivate: () => { if (typeof onConfirm === 'function') onConfirm([...picked].sort((a, b) => a - b)) },
        })
        return true
    }

    const openText = ({ title, paragraphs, text = '', copyLabel = '', onCopy }) => {
        const dialog = beginDialog({ title, paragraphs, requiresCapability: false })
        if (!dialog) return false
        const area = make('textarea', bounded(text, 48 * 1024), { action: 'manual-copy-text', maxText: 48 * 1024 })
        area.className = 'report'
        area.value = bounded(text, 48 * 1024)
        area.readOnly = true
        area.setAttribute('readonly', '')
        dom.append(dialog.body, area)
        addAction(dialog, { label: '關閉', action: 'cancel-secondary', onActivate: () => {} })
        if (copyLabel && typeof onCopy === 'function') {
            addAction(dialog, { label: copyLabel, action: 'copy', tone: 'primary', onActivate: onCopy })
        }
        return true
    }

    const openActions = ({ title, paragraphs, items = [] }) => {
        const dialog = beginDialog({ title, paragraphs, requiresCapability: true })
        if (!dialog) return false
        const list = make('div', null, { className: 'action-list' })
        items.slice(0, 16).forEach(item => {
            const button = make('button', item.label, { className: 'btn', action: item.action, maxText: 120 })
            button.type = 'button'
            dom.addEvent(button, 'click', event => {
                if (!event || !event.isTrusted || activeCapability !== dialog.capability) return
                const session = uiSession
                closeView()
                try { if (typeof item.onActivate === 'function') item.onActivate() }
                finally { if (!activeModal && uiSession === session) closeDialog() }
            })
            dom.append(list, button)
        })
        dom.append(dialog.body, list)
        addAction(dialog, { label: '關閉', action: 'cancel-secondary', onActivate: () => {} })
        return true
    }

    const openRouting = ({ title, paragraphs, routes = [], fixedSelected = 0, catalogSelected = [], onConfirm, onDefaults }) => {
        const dialog = beginDialog({ title, paragraphs, requiresCapability: true })
        if (!dialog) return false
        let routeIndex = Number.isInteger(fixedSelected) ? fixedSelected : 0
        const enabled = new Set([].concat(catalogSelected || []).filter(Number.isInteger))
        const routeList = make('div', null, { className: 'choices' })
        dom.append(dialog.body, make('h3', '模式與固定節點', { className: 'section-title' }))
        routes.slice(0, 64).forEach((route, index) => {
            const button = make('button', null, { className: 'choice', action: 'route-' + index })
            button.type = 'button'
            const main = make('span', '', { className: 'choice-main' })
            const detail = make('span', route.detail || '', { className: 'choice-detail' })
            const render = () => {
                const selected = routeIndex === index
                button.className = 'choice' + (selected ? ' selected' : '')
                main.textContent = (selected ? '◉ ' : '○ ') + bounded(route.label, 300)
            }
            render(); dom.append(button, main); if (route.detail) dom.append(button, detail)
            dom.addEvent(button, 'click', event => {
                if (!event || !event.isTrusted || activeCapability !== dialog.capability) return
                routeIndex = index
                ;[...(routeList.children || [])].forEach((node, other) => {
                    if (!node.children || !node.children[0]) return
                    const selected = other === routeIndex
                    node.className = 'choice' + (selected ? ' selected' : '')
                    node.children[0].textContent = (selected ? '◉ ' : '○ ') + bounded(routes[other].label, 300)
                })
            })
            dom.append(routeList, button)
        })
        dom.append(dialog.body, routeList)
        dom.append(dialog.body, make('h3', '自動選路候選', { className: 'section-title' }))
        const catalogList = make('div', null, { className: 'choices' })
        routes.slice(1, 65).forEach((route, index) => {
            const button = make('button', null, { className: 'choice', action: 'catalog-' + index })
            button.type = 'button'
            const main = make('span', '', { className: 'choice-main' })
            const detail = make('span', route.detail || '', { className: 'choice-detail' })
            const render = () => {
                const selected = enabled.has(index)
                button.className = 'choice' + (selected ? ' selected' : '')
                main.textContent = (selected ? '☑ ' : '☐ ') + bounded(route.label, 300)
            }
            render(); dom.append(button, main); if (route.detail) dom.append(button, detail)
            dom.addEvent(button, 'click', event => {
                if (!event || !event.isTrusted || activeCapability !== dialog.capability) return
                if (enabled.has(index)) enabled.delete(index); else enabled.add(index)
                render()
            })
            dom.append(catalogList, button)
        })
        dom.append(dialog.body, catalogList)
        addAction(dialog, { label: '取消', action: 'cancel-secondary', onActivate: () => {} })
        if (typeof onDefaults === 'function') addAction(dialog, {
            label: '恢復自動預設', action: 'routing-defaults', onActivate: onDefaults,
        })
        addAction(dialog, {
            label: '套用', action: 'confirm', tone: 'primary',
            onActivate: () => { if (typeof onConfirm === 'function') onConfirm({ routeIndex, enabled: [...enabled].sort((a, b) => a - b) }) },
        })
        return true
    }

    const invalidate = ({ clearToasts = true } = {}) => {
        closeDialog(false)
        activeCapability = null
        serial++
        if (clearToasts) [...toastEntries].forEach(removeToastEntry)
    }

    const captureContext = () => ({ revision: sessionRevision, serial })
    const isContextCurrent = context => !!context && context.revision === sessionRevision && context.serial === serial
    return Object.freeze({ toast, openConfirm, openChoice, openText, openActions, openRouting, closeDialog, invalidate,
        captureContext, isContextCurrent })
})()

// 頁面型態（改進工單 F 用）：只取路徑的類別區段（video/bangumi/play/cheese...），
// 不含 BV 號、ep 號等具體影片識別碼。
const getPageTypeLabel = () => {
    const path = location.pathname
    const m = path.match(/^\/([a-z]+)(?:\/([a-z]+))?/)
    if (!m) return path || '/'
    return '/' + [m[1], m[2]].filter(Boolean).join('/')
}

// 診斷報告一鍵複製（改進工單 F）：組出一段純文字讓使用者回報問題時直接貼上，省掉
// 來回追問版本/狀態的往返。刻意只放 host 與統計數字——不含完整影片網址、cookie、
// IP 等任何可識別使用者身分或觀看紀錄的資訊。
let readDiagnosticHidden = () => null
const readPlaybackDiagnostic = (v) => {
    const out = { available: false, valid: false, paused: null, seeking: null, ended: null,
        readyState: null, networkState: null, currentTime: null, duration: null,
        bufferAheadSec: null, errorCode: null, hidden: null,
        observedRate: playbackRateState.observedRate, effectiveRate: playbackRateState.effectiveRate }
    try {
        out.hidden = readDiagnosticHidden()
        if (v === undefined) v = Watchdog.getVideo()
        if (!v) return out
        out.available = true
        for (const key of ['paused', 'seeking', 'ended']) out[key] = typeof v[key] === 'boolean' ? v[key] : null
        for (const key of ['readyState', 'networkState', 'currentTime', 'duration']) {
            const value = v[key]
            out[key] = typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
        }
        const error = v.error
        out.errorCode = !error ? 0 : Number.isInteger(error.code) && error.code >= 1 && error.code <= 4 ? error.code : null
        if (out.currentTime === null || !v.buffered) return out
        let end = out.currentTime
        for (let i = 0; i < v.buffered.length; i++) {
            const a = v.buffered.start(i), b = v.buffered.end(i)
            if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return out
            if (out.currentTime >= a - 0.05 && out.currentTime <= b + 0.05) { end = b; break }
        }
        out.bufferAheadSec = Math.max(0, end - out.currentTime)
        out.valid = out.paused !== null && out.seeking !== null && out.ended !== null
            && Number.isInteger(out.readyState) && out.readyState <= 4 && out.errorCode !== null
    } catch { DiagnosticLog.fault('snapshot') }
    return out
}
const buildDiagReport = () => {
    const ws = summarizeWorkerStats()
    const buffer = Watchdog.stats()
    const httpDns = getHttpDnsStatus()
    const lines = [
        '[BiliCDN_TW 診斷報告]',
        '版本：' + VERSION,
        '頁面型態：' + getPageTypeLabel(),
        'UA：' + navigator.userAgent,
        '面板注入狀態：' + uiInjectStatus,
        '停用狀態：' + disabled,
        'Worker 攔截開關：' + EnableWorkerIntercept,
        '候選順序：' + (activeCdnList.map(c => c.split('.')[0]).join(' > ') || '（無）'),
        '真正可選節點：' + (getHealthyCdnList().map(c => c.split('.')[0]).join(' > ') || '（無）'),
        '黑名單（24h）：' + ([...blacklistSet].map(c => c.split('.')[0]).join(', ') || '（無）'),
        '持久死節點：' + (listDeadHosts()
            .map(e => e.host.split('.')[0] + '(' + e.reason + '，剩 ' + e.daysLeft + 'd)')
            .join(', ') || '（無）'),
        '選路建議：' + getCdnShortName(),
        ...['video', 'audio'].map(kind => {
            const entry = getMediaDeliverySnapshot()[kind]
            return (kind === 'video' ? '最近影片 CDN：' : '最近音訊 CDN：')
                + (entry.fresh ? (entry.host ? entry.host.split('.')[0] : entry.classification) : '無新鮮資料')
                + '（觀察到的請求；來源=' + entry.source + '；年齡=' + (entry.ageSec == null ? '無資料' : entry.ageSec + '秒') + '）'
        }),
        describePlaybackBuffer(buffer),
        '累計下載（非目前緩衝）：' + buffer.totalMB + ' MB',
        '播放倍速：' + playbackRateState.effectiveRate + 'x（'
            + (playbackRateState.confirmed ? '已確認' : '假定') + '，來源=' + playbackRateState.source + '）',
        'Codec 偏好：' + resolvedVideoCodecPreference + '；最近排序首位=' + JSON.stringify(lastCodecDecision.groups),
        '目前配置能力（非硬解證明）：' + JSON.stringify(getCurrentCodecDiagnostics()),
        '串流估計（觀察到的 representation）：' + JSON.stringify(streamEstimate),
        '播放影格（自本次觀察起；唯讀）：' + (playbackQualitySnapshot.available ? JSON.stringify(playbackQualitySnapshot) : '無資料'),
        '頁面發現 CDN：' + (pageDiscoveredCdn ? pageDiscoveredCdn.split('.')[0] : '（無）'),
        '改寫統計：' + JSON.stringify(redirectStats),
        'HTTPDNS：' + httpDns.mode + (httpDns.ttlMin ? '（' + httpDns.ttlMin + 'm）' : ''),
        'Worker 量測：created=' + ws.created + ' netCalls=' + ws.netCalls + ' mediaSeen=' + ws.mediaSeen
            + ' rewrites=' + ws.rewrites + ' 觀察' + ws.observedDays + '天 判讀=' + ws.verdict,
    ]
    const history = DiagnosticLog.snapshot()
    lines.splice(5, 0,
        'Verbose：' + (Config.verbose ? '已開啟' : '已關閉') + '；' + (history.persisted === true ? '設定已確認儲存' : '本分頁已套用，未確認儲存'),
        '紀錄：僅本分頁記憶體，重整清空；起點=' + history.startedAt + '；Verbose 最近切換=' + history.verboseChangedAt,
        '播放器現況：' + JSON.stringify(readPlaybackDiagnostic()),
        'Watchdog 決策：' + JSON.stringify(history.decision),
        'Watchdog 統計：' + JSON.stringify({ switchCount: buffer.switchCount, stallCount: buffer.stallCount, breakerSec: buffer.breakerSec }),
        '紀錄容量：' + JSON.stringify({ evicted: history.evicted, expired: history.expired, rejected: history.rejected,
            pendingEvicted: history.pendingEvicted, recorderFailures: history.failures }),
    )
    // Priority: current state, critical history, pending requests, then newest detail.
    const limit = 64 * 1024, reserve = 256
    let text = lines.join('\n'), omitted = 0
    if (DiagnosticLog.size(text) > limit / 2) { text = text.slice(0, 8000); omitted++ }
    const append = line => {
        if (DiagnosticLog.size(text) + DiagnosticLog.size(line) + 1 > limit - reserve) { omitted++; return }
        text += '\n' + line
    }
    append('近期關鍵事件（新到舊）：')
    history.critical.slice().reverse().forEach(e => append(JSON.stringify(e)))
    append('等待中的請求（非完整網路面板；不包含已脫離 generation 的請求）：')
    history.pending.forEach(e => append(JSON.stringify(e)))
    append('Verbose 近期細節（新到舊；開啟前未收集的細節無法補回）：')
    history.detail.slice().reverse().forEach(e => append(JSON.stringify(e)))
    return text + '\n匯出截斷：' + (omitted ? omitted + ' 筆／區段未匯出' : '無')
}

const controlResult = (ok, status, message, data = null) => Object.freeze({
    ok: !!ok,
    status: String(status || (ok ? 'ok' : 'error')).slice(0, 48),
    message: String(message || '').slice(0, 500),
    data,
})

// 從 Tampermonkey menu callback 進入時，頁面常沒有 Clipboard API 所要求的 transient
// activation。優先讓 userscript manager 寫入；仍失敗才退回標準 API，最後一定提供 closed
// Shadow DOM 內的唯讀文字框，不能再只把失敗藏在 DevTools console。
const copyDiagReport = async () => {
    const uiContext = TrustedMenuUI.captureContext()
    const valid = () => TrustedMenuUI.isContextCurrent(uiContext)
    const cancelled = () => controlResult(false, 'cancelled', '原操作視窗已結束')
    const text = buildDiagReport()
    const viaGm = () => new Promise((resolve, reject) => {
        if (typeof GM_setClipboard !== 'function') return reject(new Error('GM_setClipboard unavailable'))
        let settled = false
        let timer = null
        const done = (ok, error) => {
            if (settled) return
            settled = true
            if (timer) clearTimeout(timer)
            if (ok) resolve(true); else reject(error || new Error('GM_setClipboard failed'))
        }
        try {
            const returned = GM_setClipboard(text, { type: 'text', mimetype: 'text/plain' }, () => done(true))
            if (returned && typeof returned.then === 'function') returned.then(() => done(true), error => done(false, error))
            if (!settled) timer = setTimeout(() => done(false, new Error('GM_setClipboard callback timeout')), 1500)
        } catch (error) { done(false, error) }
    })
    try {
        await viaGm()
        if (!valid()) return cancelled()
        TrustedMenuUI.toast('診斷報告已複製到剪貼簿', 'success')
        return controlResult(true, 'copied-gm', '診斷報告已複製', { method: 'gm' })
    } catch (gmError) {
        if (!valid()) return cancelled()
        DiagnosticLog.fault('clipboard-gm')
        try {
            if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') throw gmError
            await navigator.clipboard.writeText(text)
            if (!valid()) return cancelled()
            TrustedMenuUI.toast('診斷報告已複製到剪貼簿', 'success')
            return controlResult(true, 'copied-navigator', '診斷報告已複製', { method: 'navigator' })
        } catch (clipboardError) {
            if (!valid()) return cancelled()
            DiagnosticLog.fault('clipboard-standard')
            const fallbackText = buildDiagReport()
            log(fallbackText)
            TrustedMenuUI.openText({
                title: '手動複製診斷報告',
                paragraphs: ['自動寫入剪貼簿被瀏覽器拒絕。請在下方文字框按 Ctrl+A、Ctrl+C。'],
                text: fallbackText,
            })
            return controlResult(false, 'manual-copy', '請在視窗中手動複製', { method: 'manual' })
        }
    }
}

// ── 內部可信診斷控制面（只供 Tampermonkey 選單閉包呼叫）──────────────
const BiliCDNControls = {
    diag() {
        try { console.log(buildDiagReport()) } catch {}
        return {
            active:  [...activeCdnList],
            black:   [...blacklistSet],
            soft:    Object.fromEntries(Object.entries(cdnSoftBlockUntil).filter(([cdn]) => isCdnSoftBlocked(cdn))),
            dead:    listDeadHosts(),
            // 已知在台灣不解析、但還沒有實測證據可以標死的節點。它們不會被選路、
            // 不會進 backup_url、不會被賽馬碰到，但也還沒被判死刑。
            presumed: PREFERRED_CDN_LIST.filter(isPresumedDnsFailHost),
            fail:    { ...cdnFailCount },
            health:  Object.fromEntries(
                Object.entries(cdnHealth).map(([k, h]) => [k, { ...h, score: getCdnHealthScore(k) }])
            ),
            playback: { ...playbackRateState },
            streamEstimate: { ...streamEstimate },
            mediaDelivery: getMediaDeliverySnapshot(),
            playbackQuality: { ...playbackQualitySnapshot },
            currentCodecConfigurations: getCurrentCodecDiagnostics(),
            codec: {
                preference: resolvedVideoCodecPreference,
                capabilities: {
                    av1_1080: getCodecCapabilityState('av1', 1080),
                    av1_2160: getCodecCapabilityState('av1', 2160),
                    hevc_1080: getCodecCapabilityState('hevc', 1080),
                    hevc_2160: getCodecCapabilityState('hevc', 2160),
                },
                groups: lastCodecDecision.groups.map(group => ({ ...group })),
            },
            verbose: Config.verbose,
            redirects: { ...redirectStats },
            discovered: pageDiscoveredCdn,
            httpdns: getHttpDnsStatus(),
            uiInjectStatus,
            workerStats: summarizeWorkerStats(),
        }
    },
    // Worker 攔截有效性量測（改進工單 B）：用真實數據決定 setupClassicWorkerIntercept()
    // 這 250 行的去留。所有數字只存在本機，回報請直接複製本方法輸出貼給開發者。
    workerStats() {
        const s = summarizeWorkerStats()
        console.group('[BiliCDN] Worker 攔截量測')
        console.log('created（攔到幾次 new Worker）:', s.created)
        console.log('netCalls（Worker 內發出幾次網路請求）:', s.netCalls)
        console.log('mediaSeen（其中幾次是影片分段）:', s.mediaSeen)
        console.log('rewrites（實際改寫幾次）:', s.rewrites)
        console.log('累計位元組:', s.bytesMB + ' MB')
        console.log('已觀察天數:', s.observedDays)
        console.log('Worker script hostname 樣本:', s.samples)
        console.log('判讀:', s.verdict)
        console.groupEnd()
        return s
    },
    // 診斷報告一鍵複製（改進工單 F）：回報問題時直接貼給開發者，省掉來回追問。
    // 不含完整影片網址／cookie／IP，只有 host 與統計數字。
    report() {
        return copyDiagReport()
    },
    // 注意：這是**改寫統計**，不是 Watchdog 的播放統計。換節點次數 / 卡頓次數 /
    // 斷路器狀態在內部 buffer 診斷；改寫統計與播放統計是不同入口。
    stats() {
        console.log('[BiliCDN] 改寫統計:', redirectStats,
            '| HTTPDNS:', getHttpDnsStatus(),
            '| 頁面 CDN:', pageDiscoveredCdn ? pageDiscoveredCdn.split('.')[0] : '—')
            console.log('（換節點/卡頓/斷路器已包含在「顯示診斷資訊」輸出）')
        return { ...redirectStats, pageDiscoveredCdn, httpdns: getHttpDnsStatus() }
    },
    // 手動觸發吞吐量賽馬（用最近一次播放抓到的真實 segment）；忽略冷卻
    async bakeoff() {
        if (disabled) return controlResult(false, 'disabled', 'CDN 改寫目前已停用')
        if (resolvedCdn) return controlResult(false, 'fixed-cdn', '目前使用固定 CDN；恢復自動選路後才能測速選節點')
        if (!lastSampleSegmentUrl) return controlResult(false, 'no-sample', '尚無 segment 樣本，請先播放影片數秒')
        if (inSeekGrace()) return controlResult(false, 'seek-grace', '正在 seek 保護期，請稍候再測速')
        if (bakeoffRunning) return controlResult(false, 'running', '已有一輪測速正在進行')
        const now = Date.now()
        if (now - (trustedBakeoffLastAt.menu || 0) < TRUSTED_BAKEOFF_MIN_GAP.menu) {
            return controlResult(false, 'cooldown', '手動測速冷卻中，請 5 秒後再試')
        }
        console.log('[BiliCDN] 開始吞吐量賽馬…（約 1~5 秒）')
        // 使用者手動要求的，不能被「現用節點目前還算快」的捷徑靜默跳過。
        const round = await runThroughputBakeoff(lastSampleSegmentUrl, false, trustedBakeoffRequest('menu'))
        const samples = Object.entries(cdnHealth)
            .filter(([host, h]) => h.samples > 0 && round?.outcomes?.some(r => r.host === host && r.accepted))
            .slice(0, TRUSTED_CDN_CATALOG.length)
            .map(([host, h]) => ({
                host,
                mbps: +h.ewmaMbps.toFixed(2),
                score: +getCdnHealthScore(host).toFixed(2),
            }))
        console.log('[BiliCDN] 賽馬結果:', samples, '| 目前最佳:', getCdnShortName())
        const status = round?.status || (disabled ? 'cancelled' : isHostLockedStream(lastSampleSegmentUrl) ? 'forbidden' : 'unavailable')
        const messages = { 'latency-only': '僅取得延遲；資料量或傳輸時間不足，不計吞吐樣本',
            forbidden: '串流拒絕換 host（403），保留原始網址', cancelled: '測速已取消，未提交過期結果',
            failed: '本輪未取得有效吞吐樣本', 'no-candidates': '本輪沒有可量測候選',
            unavailable: '本輪無法開始；可能正由其他分頁測速' }
        return controlResult(status === 'completed' || status === 'latency-only', status,
            status === 'completed' ? ('測速完成；目前最佳：' + getCdnShortName()) : (messages[status] || messages.failed), {
                best: getCdnShortName(), samples,
            })
    },
    verbose(on) {
        if (typeof on !== 'boolean') {
            console.log('[BiliCDN] Verbose =', Config.verbose,
                '\n請由控制中心「進階」切換')
            return controlResult(true, 'current', 'Verbose 目前' + (Config.verbose ? '已開啟' : '已關閉'), {
                enabled: Config.verbose,
            })
        }
        Config.verbose = on
        let persisted = null
        try {
            GM_setValue('verbose', on)
            try {
                persisted = GM_getValue('verbose') === on
                if (!persisted) DiagnosticLog.record('settings-verify', {}, true)
            } catch { DiagnosticLog.record('settings-verify', {}, true) }
        } catch { persisted = false; DiagnosticLog.record('settings-write', {}, true) }
        DiagnosticLog.verbose(persisted)
        const message = 'Verbose 已' + (on ? '開啟' : '關閉')
            + (persisted === true ? '，設定已確認儲存' : '；本分頁已套用，未確認儲存，重整後可能失效')
        log(message)
        return controlResult(persisted === true, persisted === true ? (on ? 'enabled' : 'disabled') : 'applied-session-only',
            message, { enabled: on, persisted })
    },
    reset() {
        clearBlacklist()
        clearDeadHosts()
        Object.keys(cdnFailCount).forEach(k => delete cdnFailCount[k])
        Object.keys(cdnHealth).forEach(k => delete cdnHealth[k])
        try { GM_setValue(CDN_HEALTH_KEY, '{}') } catch {}
        lastChosenCdn = null
        Object.assign(redirectStats, {
            unstable: 0,
            pcdnSkipped: 0,
            pcdnExplicit: 0,
            pcdnSuspectedPort: 0,
            liveSkipped: 0,
            partialProbeSamples: 0,
            hostLocked: 0,
            whitelist: 0,
            httpdns: 0,
            httpdnsAllowed: 0,
            httpdnsAutoSwitch: 0,
            quietRedirects: 0,
        })
        HttpDnsAutoPilot.reset()
        hostLockedStreams.clear()
        preservedOriginalStreamUrls.clear()
        rewrittenStreamOrigins.clear()
        pageDiscoveredCdn = null
        try { GM_deleteValue(PROBE_CACHE_KEY) } catch {}
        Watchdog.reset()
        log('已重置：黑名單、軟隔離、持久死節點、失敗計數、健康分數、probe 快取、改寫統計、Watchdog')
        return controlResult(true, 'reset', '所有學習狀態已重置')
    },
    httpdns(mode) {
        if (mode === undefined) {
            const status = getHttpDnsStatus()
            console.group('[BiliCDN] HTTPDNS AutoPilot')
            console.log('模式:', status.mode, '| 目前阻擋:', status.block)
            if (status.ttlMin) console.log('剩餘:', status.ttlMin + ' 分鐘')
            if (status.reason) console.log('原因:', status.reason)
            if (status.networkKey) console.log('網路鍵:', status.networkKey)
            if (status.scores) {
                console.log('評分 block≈', status.scores.block, '(' + status.scores.blockSamples + ' 次)',
                    '| allow≈', status.scores.allow, '(' + status.scores.allowSamples + ' 次)')
                if (status.scores.trial != null) console.log('短測分數:', status.scores.trial)
            }
            console.log('HTTPDNS 模式請由檔頭 BlockHttpDNS 設定後重新載入')
            console.groupEnd()
            return status
        }
        if (mode !== true && mode !== false && mode !== 'auto') {
            console.log('HTTPDNS 模式請由檔頭 BlockHttpDNS 設定後重新載入')
            return getHttpDnsStatus()
        }
        return setHttpDnsMode(mode)
    },
    // 手動重跑延遲探測（force：忽略 2 小時快取與起播讓路；presumed 節點仍刻意略過）。
    // 程式碼註解與 CHANGELOG 都提到過這個入口，但先前並沒有真的實作出來。
    // 使用者明確要求的手動探測：忽略 2 小時快取與起播讓路，重新量一次所有**可用**節點。
    // 不會去打 presumed 節點（已知在台灣不可用的那幾台）——那一發請求換不到任何能用來
    // 做決定的資訊（no-cors 讀不到狀態碼），只會在 console 留一行紅字。它們的狀態改用
    // 已知資訊列出來，並告知唯一真正能翻案的作法。
    async probe() {
        if (disabled) return controlResult(false, 'disabled', 'CDN 改寫目前已停用')
        if (resolvedCdn) return controlResult(false, 'fixed-cdn', '目前使用固定 CDN；恢復自動選路後才能重新排序')
        if (reorderRunning) return controlResult(false, 'running', '延遲探測已在進行中')
        const now = Date.now()
        if (now - (this._lastManualProbeAt || 0) < 10000) {
            console.log('[BiliCDN] 手動探測冷卻中，請稍候再試')
            return controlResult(false, 'cooldown', '手動延遲探測冷卻中，請 10 秒後再試')
        }
        this._lastManualProbeAt = now
        try { GM_deleteValue(PROBE_CACHE_KEY) } catch {}
        await reorderCdnsByLatency(true)
        const order = [...activeCdnList].slice(0, TRUSTED_CDN_CATALOG.length)
        console.log('[BiliCDN] 探測完成，候選順序：', order.map(c => c.split('.')[0]))
        // 這幾台這一輪**刻意沒有被探測**（見候選過濾處說明）。仍然把它們列出來，
        // 否則使用者只會看到「清單裡少了幾台」而不知道發生什麼事。
        const skipped = PREFERRED_CDN_LIST.filter(isPresumedDnsFailHost)
        if (skipped.length) {
            const dead = listDeadHosts()
            console.log('[BiliCDN] 以下節點已知在台灣不可用，本次未探測（避免無謂的失敗請求）：',
                Object.fromEntries(skipped.map(c => {
                    const d = dead.find(x => x.host === c)
                    return [c.split('.')[0], d ? (d.reason + '，剩 ' + d.daysLeft + 'd') : '預設清單推定']
                })))
        }
        return controlResult(true, order.length ? 'completed' : 'no-candidates',
            order.length ? ('延遲探測完成；目前最佳：' + getCdnShortName()) : '沒有可探測候選', {
                best: getCdnShortName(), order, skipped: skipped.slice(0, TRUSTED_CDN_CATALOG.length),
            })
    },
    clearDead() { clearDeadHosts(); return this.diag() },
    // 內部精準救回單一被誤殺節點；對外只由可信 Tampermonkey 編號選單呼叫。
    revive(host) {
        if (!host) {
            console.log('請使用控制中心「節點維護 → 救回單一 dead catalog 節點」')
            return controlResult(false, 'missing-host', '請先選擇要救回的節點')
        }
        // 三種寫法都接受，規則明確不靠巧合：完整 host、去掉網域的短名、去掉
        // upos-{sz|hz}-mirror 前綴的節點代號（'ali' / 'aliov' / 'cos'）。
        // 一定要用完全相等而不是 endsWith——'ali' 用 endsWith 會同時命中 'aliov'。
        const shortOf = (c) => c.split('.')[0]
        const codeOf  = (c) => shortOf(c).replace(/^upos-(sz|hz)-mirror/, '')
        const full = TRUSTED_CDN_CATALOG.find(c => c === host || shortOf(c) === host || codeOf(c) === host)
        if (!full || !TRUSTED_CDN_CATALOG_SET.has(full)) {
            console.warn('[BiliCDN] 找不到符合的 catalog 節點：' + host)
            return controlResult(false, 'invalid-host', '選擇的節點不在可信 catalog')
        }
        if (!knownDeadHosts.has(full)) return controlResult(false, 'not-dead', '該節點目前不在 dead 清單')
        reviveDeadHost(full)
        promoteBestCdnNow()
        console.log('[BiliCDN] 已救回：' + full)
        return controlResult(true, 'revived', '已救回：' + full, { host: full })
    },
    clearSoft() {
        const cleared = Object.keys(cdnSoftBlockUntil).filter(isCdnSoftBlocked).length
        Object.keys(cdnSoftBlockUntil).forEach(c => delete cdnSoftBlockUntil[c])
        Object.values(cdnHealth).forEach(h => {
            h.softBlocks = 0
            h.lastSoftBlockAt = 0
            h.lastSoftBlockReason = ''
        })
        scheduleCdnHealthSave()
        promoteBestCdnNow()
        return controlResult(true, cleared ? 'cleared' : 'empty',
            cleared ? ('已清除 ' + cleared + ' 個 soft block') : '目前沒有 soft block', { cleared })
    },
    dead() {
        try {
            const raw = JSON.parse(GM_getValue(DEAD_HOSTS_KEY) || '[]')
            console.group('[BiliCDN] 持久死節點清單')
            raw.forEach(e => {
                const leftMs = e.expireAt - Date.now()
                const leftH  = Math.max(0, Math.round(leftMs / 3600000))
                console.log(e.host.split('.')[0] + '  reason=' + e.reason + '  剩餘 ' + leftH + 'h')
            })
            console.groupEnd()
            return raw
        } catch { return [] }
    },
    setCdn(host) {
        if (host == null) host = ''
        host = String(host).trim().toLowerCase()
        if (!host || host === 'null') {
            GM_deleteValue('CustomCDN')
            console.log('[BiliCDN] 已清除固定 CDN（重整頁面生效）')
            return controlResult(true, 'auto', '已恢復自動選路；重新載入後生效', { host: null })
        }
        if (!isValidCustomCdnHost(host)) {
            console.error('[BiliCDN] [安全] 拒絕設定：「' + host
                + '」不在可信 CDN catalog')
            return controlResult(false, 'invalid-host', '拒絕設定：節點不在可信 catalog')
        }
        GM_setValue('CustomCDN', host)
        console.log('[BiliCDN] 已固定 CDN 為 ' + host + '（重整頁面生效）')
        return controlResult(true, 'fixed', '已固定 CDN；重新載入後生效', { host })
    },
    buf() {
        const s = Watchdog.stats()
        console.group('[BiliCDN] 緩衝狀態')
        console.log('累計下載:', s.totalMB + 'MB / ' + s.targetMB + 'MB',
            s.reachedTarget ? '✓ 已達標' : '⌛ 未達標')
        console.log('buffer ahead:', s.bufferAheadSec + 's | buffered end:', s.bufferedEndSec + 's'
            + ' | currentTime:', s.videoTimeSec + 's',
            '| readyState:', s.readyState, '| paused:', s.paused)
        console.log('各 CDN 下載量:', s.perCdnMB)
        console.log('各 CDN 速度:', s.perCdnMbps)
        console.log('最低需求 Mbps:', s.requiredMbps)
        console.log('各 CDN 評分:', s.cdnScore)
        console.log('已運行:', s.elapsedSec + 's')
        // 這三個以前只在回傳值裡、沒有印出來——但它們正是「畫面一直卡、log 一直在換節點」
        // 時最直接的判讀依據，只放在回傳物件裡等於使用者看不到。
        console.log('換節點次數:', s.switchCount, '| 卡頓判定次數:', s.stallCount,
            '| 換節點斷路器:', s.breakerSec > 0
                ? ('已跳脫，' + s.breakerSec + 's 後恢復（換也沒用，瓶頸在頻寬/碼率/跨境線路）')
                : '未跳脫')
        console.groupEnd()
        return s
    },
    watchdog: {
        start: () => Watchdog.start(),
        stop:  () => Watchdog.stop(),
        // 跟 SPA 換片時的處理方式一致：Watchdog.reset() 會讓累計位元組歸零，若當下
        // HTTPDNS AutoPilot 正在 trial-allow，沒有同步通知它就會拿舊的大 baseline
        // 對歸零後的小 sample 相減，trial 被誤判失敗——見 onWatchdogReset 註解。
        reset: () => { Watchdog.reset(); try { HttpDnsAutoPilot.onWatchdogReset() } catch {} },
    },
    // 動態排除/恢復 host 關鍵字（即時生效不需重整）
    exclude(kw) {
        if (!kw || typeof kw !== 'string') {
            console.log('請使用控制中心「CDN 選路」')
            return [...ExcludeHostKeywords]
        }
        if (!ExcludeHostKeywords.includes(kw)) ExcludeHostKeywords.push(kw)
        rebuildPreferredCdnList()
        for (let i = activeCdnList.length - 1; i >= 0; i--) {
            if (!PREFERRED_CDN_LIST.includes(activeCdnList[i])) activeCdnList.splice(i, 1)
        }
        if (lastChosenCdn && !PREFERRED_CDN_LIST.includes(lastChosenCdn)) lastChosenCdn = null
        if (pageDiscoveredCdn && matchesExclude(pageDiscoveredCdn)) pageDiscoveredCdn = null
        try { GM_deleteValue(PROBE_CACHE_KEY) } catch {}
        syncWorkerCdnTarget()
        log('已加入排除：' + kw + '，剩餘：'
            + activeCdnList.map(c => c.split('.')[0]).join(', '))
        return [...ExcludeHostKeywords]
    },
    include(kw) {
        const idx = ExcludeHostKeywords.indexOf(kw)
        if (idx === -1) { log('排除清單中沒有：' + kw); return [...ExcludeHostKeywords] }
        ExcludeHostKeywords.splice(idx, 1)
        rebuildPreferredCdnList()
        // 把所有新恢復且目前可用的 host 依 RAW 順序放回；不只處理字面上含 kw 的一台，
        // 因為多個排除關鍵字可能互相重疊。
        PREFERRED_CDN_LIST.forEach(h => {
            if (!activeCdnList.includes(h) && !blacklistSet.has(h) && !knownDeadHosts.has(h)) {
                activeCdnList.push(h)
            }
        })
        const ranked = getHealthyCdnList()
        if (ranked.length) {
            const rest = activeCdnList.filter(h => !ranked.includes(h))
            activeCdnList.splice(0, activeCdnList.length, ...ranked, ...rest)
        }
        try { GM_deleteValue(PROBE_CACHE_KEY) } catch {}
        syncWorkerCdnTarget()
        log('已移除排除：' + kw + '，當前：'
            + activeCdnList.map(c => c.split('.')[0]).join(', '))
        return [...ExcludeHostKeywords]
    },
    excludes() { return [...ExcludeHostKeywords] },
}

// 頁面環境只能讀取這份有界、不可變、沒有任何函式的診斷快照。快照由 sandbox 主動更新；
// getter 本身只回傳快取，不會因頁面反覆讀取而觸發 GM、網路或重新計算。
const describePlaybackBuffer = (stats) => {
    if (stats.readyState < 0) return '緩衝：無資料（尚無影片）'
    const rate = playbackRateState.confirmed ? playbackRateState.observedRate : ASSUMED_PLAYBACK_RATE
    return '連續前方緩衝：' + stats.bufferAheadSec + ' 秒｜約可播放 ' + (stats.bufferAheadSec / rate).toFixed(1)
        + ' 秒' + (playbackRateState.confirmed ? '' : '（未確認，按 2x 估算）')
}
const PUBLIC_DIAG_HOST_MAX = 32
const publicFinite = (value, fallback = 0) => Number.isFinite(+value) ? +value : fallback
const publicHost = (value) => {
    const host = typeof value === 'string' ? value.trim().toLowerCase() : ''
    return host.length <= 253 && /^[a-z0-9.-]+$/.test(host) ? host : null
}
const deepFreezePublic = (value, seen = new WeakSet()) => {
    if (!value || typeof value !== 'object' || seen.has(value)) return value
    seen.add(value)
    Object.values(value).forEach(child => deepFreezePublic(child, seen))
    return Object.freeze(value)
}
const buildPublicDiagnosticSnapshot = () => {
    const ws = summarizeWorkerStats()
    const wd = Watchdog.stats()
    const hd = getHttpDnsStatus()
    const health = {}
    TRUSTED_CDN_CATALOG.slice(0, PUBLIC_DIAG_HOST_MAX).forEach(host => {
        const h = cdnHealth[host]
        if (!h) return
        health[host] = {
            mbps: publicFinite(h.ewmaMbps),
            latencyMs: publicFinite(h.latencyMs),
            samples: Math.max(0, Math.min(10000, Math.trunc(publicFinite(h.samples)))),
            failures: Math.max(0, Math.min(10000, Math.trunc(publicFinite(h.failures)))),
            slowSamples: Math.max(0, Math.min(10000, Math.trunc(publicFinite(h.slowSamples)))),
            softBlocked: !!isCdnSoftBlocked(host),
        }
    })
    const scores = hd && hd.scores ? {
        block: publicFinite(hd.scores.block),
        allow: publicFinite(hd.scores.allow),
        blockSamples: Math.max(0, Math.trunc(publicFinite(hd.scores.blockSamples))),
        allowSamples: Math.max(0, Math.trunc(publicFinite(hd.scores.allowSamples))),
        trial: hd.scores.trial == null ? null : publicFinite(hd.scores.trial),
    } : null
    return deepFreezePublic({
        version: VERSION,
        updatedAt: Date.now(),
        diagnostics: DiagnosticLog.summary(),
        disabled: !!disabled,
        currentCdn: publicHost(peekCurrentCdn()),
        active: activeCdnList.map(publicHost).filter(Boolean).slice(0, PUBLIC_DIAG_HOST_MAX),
        selectable: getHealthyCdnList().map(publicHost).filter(Boolean).slice(0, PUBLIC_DIAG_HOST_MAX),
        catalog: TRUSTED_CDN_CATALOG.slice(0, PUBLIC_DIAG_HOST_MAX).map(host => ({
            host,
            autoEnabled: !!isCatalogAutoEnabled(host),
            overridden: Object.prototype.hasOwnProperty.call(catalogOverrides, host),
        })),
        black: [...blacklistSet].map(publicHost).filter(Boolean).slice(0, PUBLIC_DIAG_HOST_MAX),
        soft: Object.keys(cdnSoftBlockUntil).filter(isCdnSoftBlocked)
            .map(publicHost).filter(Boolean).slice(0, PUBLIC_DIAG_HOST_MAX),
        dead: listDeadHosts().slice(0, PUBLIC_DIAG_HOST_MAX).map(entry => ({
            host: publicHost(entry.host),
            reason: String(entry.reason || 'unknown').slice(0, 64),
            daysLeft: Math.max(0, publicFinite(entry.daysLeft)),
        })).filter(entry => entry.host),
        health,
        discovered: publicHost(pageDiscoveredCdn),
        redirects: Object.fromEntries(Object.entries(redirectStats)
            .map(([key, value]) => [String(key).slice(0, 40), Math.max(0, publicFinite(value))])),
        buffer: {
            totalMB: Math.max(0, publicFinite(wd.totalMB)), // compatibility alias: cumulative downloaded MB, NOT buffered MB
            downloadedMB: Math.max(0, publicFinite(wd.totalMB)),
            available: wd.readyState >= 0,
            playableSec: wd.readyState >= 0 ? +(wd.bufferAheadSec / (playbackRateState.confirmed ? playbackRateState.observedRate : ASSUMED_PLAYBACK_RATE)).toFixed(2) : null,
            targetMB: Math.max(0, publicFinite(wd.targetMB)),
            bufferAheadSec: Math.max(0, publicFinite(wd.bufferAheadSec)),
            bufferedEndSec: Math.max(0, publicFinite(wd.bufferedEndSec)),
            videoTimeSec: Math.max(0, publicFinite(wd.videoTimeSec)),
            requiredMbps: Math.max(0, publicFinite(wd.requiredMbps)),
            switchCount: Math.max(0, Math.trunc(publicFinite(wd.switchCount))),
            stallCount: Math.max(0, Math.trunc(publicFinite(wd.stallCount))),
            breakerSec: Math.max(0, Math.trunc(publicFinite(wd.breakerSec))),
        },
        playback: {
            observedRate: Math.max(0, publicFinite(playbackRateState.observedRate, ASSUMED_PLAYBACK_RATE)),
            effectiveRate: getEffectivePlaybackRate(playbackRateState.effectiveRate),
            confirmed: !!playbackRateState.confirmed,
            source: ['assumed', 'initial', 'ratechange', 'watchdog', 'performance'].includes(playbackRateState.source)
                ? playbackRateState.source
                : 'assumed',
        },
        mediaDelivery: getMediaDeliverySnapshot(),
        playbackQuality: { ...playbackQualitySnapshot },
        currentCodecConfigurations: getCurrentCodecDiagnostics(),
        streamEstimate: {
            source: streamEstimate.source === 'observed-representation'
                ? 'observed-representation'
                : (streamEstimate.source === 'conservative-height-max' ? 'conservative-height-max' : 'unknown'),
            codec: ['av1', 'hevc', 'avc', 'other'].includes(streamEstimate.codec) ? streamEstimate.codec : 'other',
            height: Math.max(0, Math.trunc(publicFinite(streamEstimate.height))),
            videoMbps: Math.max(0, publicFinite(streamEstimate.videoMbps)),
            audioMbps: Math.max(0, publicFinite(streamEstimate.audioMbps)),
        },
        codec: {
            preference: resolvedVideoCodecPreference,
            selectedMeaning: 'sorting-first',
            capabilities: {
                av1_1080: getCodecCapabilityState('av1', 1080),
                av1_2160: getCodecCapabilityState('av1', 2160),
                hevc_1080: getCodecCapabilityState('hevc', 1080),
                hevc_2160: getCodecCapabilityState('hevc', 2160),
            },
            groups: lastCodecDecision.groups.slice(0, 8).map(group => ({
                quality: String(group.quality || '').slice(0, 16),
                selected: ['av1', 'hevc', 'avc', 'other'].includes(group.selected) ? group.selected : 'other',
                capability: ['good', 'bad', 'unknown', 'not-applicable'].includes(group.capability)
                    ? group.capability
                    : 'unknown',
            })),
        },
        httpdns: {
            mode: hd && (hd.mode === true || hd.mode === false || hd.mode === 'auto') ? hd.mode : 'auto',
            block: !!(hd && hd.block),
            ttlMin: Math.max(0, publicFinite(hd && hd.ttlMin)),
            decision: String((hd && hd.decision) || '').slice(0, 32),
            scores,
        },
        worker: {
            enabled: !!EnableWorkerIntercept,
            created: Math.max(0, Math.trunc(publicFinite(ws.created))),
            netCalls: Math.max(0, Math.trunc(publicFinite(ws.netCalls))),
            mediaSeen: Math.max(0, Math.trunc(publicFinite(ws.mediaSeen))),
            rewrites: Math.max(0, Math.trunc(publicFinite(ws.rewrites))),
            bytesMB: Math.max(0, publicFinite(ws.bytesMB)),
        },
        uiInjectStatus: String(uiInjectStatus || 'pending').slice(0, 32),
    })
}
let publicDiagnosticSnapshot = deepFreezePublic({ version: VERSION, disabled: !!disabled })
const refreshPublicDiagnosticSnapshot = () => {
    try { publicDiagnosticSnapshot = buildPublicDiagnosticSnapshot() } catch { DiagnosticLog.fault('snapshot') }
    return publicDiagnosticSnapshot
}
refreshPublicDiagnosticSnapshot()
try {
    Object.defineProperty(unsafeWindow, 'BiliCDN', {
        enumerable: true,
        configurable: false,
        get: () => publicDiagnosticSnapshot,
    })
} catch (e) {
    err('[安全] 無法安裝唯讀診斷快照：', e)
}

// 非同步 probe，不阻塞 main；停用狀態下延到使用者重新啟用後再跑
let cdnProbeStarted = false
const startCdnProbe = () => {
    if (cdnProbeStarted || disabled) return
    cdnProbeStarted = true
    // v1.3.3：先立刻對「這次最可能用到的節點」開連線。延遲探測要跑一秒以上才排得完序，
    // 但 playurl 可能更早到 —— 那樣第一個 segment 就得從零做 DNS + TCP + TLS 握手，
    // 跨國情境下這段就是好幾百毫秒的起播延遲。preconnect 幾乎零成本（沒用到的連線
    // 閒置一陣子就被瀏覽器回收），先開一定比等排序完再開好。
    try {
        // 對準「playurl 這次真的會寫進去」的那組 host：primary 用 getCurrentCdn(STARTUP_PICK)、
        // backup 用 getHealthyCdnList(STARTUP_PICK).slice(0,2)，跟 transformStreamItem /
        // buildBackupUrls 完全一致。舊版 backup 那兩顆取自 activeCdnList 的 index 順序，
        // 而 index 只是「沒有樣本時」的退路排序，跟實際會被寫進 backup_url 的節點常常不同
        // —— 等於熱身了兩條用不到的連線，真正的 backup 反而是冷的。
        // ★ 順序：先剔除 primary、再 slice(2)——不能反過來。buildBackupUrls 就是這樣做的
        // （它 filter(cdn !== primaryHost) 之後才 slice(0, 2)），而 primary 幾乎總是排名第一，
        // 所以先 slice 再交給 Set 去重的話，backup 的第一顆會跟 primary 重複被吃掉，
        // 只剩 2 個 host 被熱身——真正的第二顆 backup 反而是冷的。它正是「primary 失敗後
        // 播放器第二個會試」的節點，起播失敗時要靠它救場，卻得從零做 DNS + TCP + TLS。
        const primary = getCurrentCdn(STARTUP_PICK)
        const backups = getHealthyCdnList(STARTUP_PICK)
            .filter(c => c !== primary)
            .slice(0, 2)
        preconnectBatch([primary, ...backups].filter(Boolean), false)
    } catch {}
    reorderCdnsByLatency().catch(reportMeasurementFailure())
}

// ── Tampermonkey 選單 ────────────────────────────────────────────────
// 所有控制原本都要開 DevTools console 打指令，對非開發者的一般使用者門檻很高。
const persistCatalogOverrides = () => {
    try {
        const payload = Object.fromEntries(Object.entries(catalogOverrides)
            .filter(([host, enabled]) => TRUSTED_CDN_CATALOG_SET.has(host) && typeof enabled === 'boolean'))
        if (Object.keys(payload).length) GM_setValue(CATALOG_OVERRIDES_KEY, payload)
        else GM_deleteValue(CATALOG_OVERRIDES_KEY)
    } catch {}
}
const reconcileCatalogCandidates = () => {
    rebuildPreferredCdnList()
    for (let i = activeCdnList.length - 1; i >= 0; i--) {
        if (!PREFERRED_CDN_LIST.includes(activeCdnList[i])) activeCdnList.splice(i, 1)
    }
    PREFERRED_CDN_LIST.forEach(host => {
        if (!activeCdnList.includes(host) && !blacklistSet.has(host) && !knownDeadHosts.has(host)) {
            activeCdnList.push(host)
        }
    })
    const ranked = getHealthyCdnList()
    if (ranked.length) {
        const rest = activeCdnList.filter(host => !ranked.includes(host))
        activeCdnList.splice(0, activeCdnList.length, ...ranked, ...rest)
    }
    if (lastChosenCdn && !PREFERRED_CDN_LIST.includes(lastChosenCdn)) lastChosenCdn = null
    if (pageDiscoveredCdn && TRUSTED_CDN_CATALOG_SET.has(pageDiscoveredCdn)
        && !PREFERRED_CDN_LIST.includes(pageDiscoveredCdn)) pageDiscoveredCdn = null
    try { GM_deleteValue(PROBE_CACHE_KEY) } catch {}
    clearRuntimeConnectionHints()
    promoteBestCdnNow()
    if (!disabled) preconnectBatch(getHealthyCdnList().slice(0, 3), false)
    syncWorkerCdnTarget()
    refreshPublicDiagnosticSnapshot()
}
const setCatalogOverride = (host, enabled) => {
    if (!TRUSTED_CDN_CATALOG_SET.has(host) || typeof enabled !== 'boolean') return false
    const next = Object.assign(Object.create(null), catalogOverrides, { [host]: enabled })
    const usable = TRUSTED_CDN_CATALOG.some(candidate => {
        const candidateEnabled = Object.prototype.hasOwnProperty.call(next, candidate)
            ? next[candidate]
            : !matchesHeaderExclude(candidate)
        return candidateEnabled && !isPresumedDnsFailHost(candidate)
    })
    if (!usable) {
        console.error('[BiliCDN] 拒絕：自動選路至少要保留一個非 presumed 候選')
        return false
    }
    catalogOverrides[host] = enabled
    persistCatalogOverrides()
    reconcileCatalogCandidates()
    return true
}
const resetCatalogOverrides = () => {
    Object.keys(catalogOverrides).forEach(host => delete catalogOverrides[host])
    persistCatalogOverrides()
    reconcileCatalogCandidates()
    return controlResult(true, 'defaults-restored', '已恢復檔頭的 catalog 預設')
}
const applyCatalogSelection = selectedIndices => {
    if (!Array.isArray(selectedIndices)) return controlResult(false, 'invalid-selection', 'Catalog 選擇格式不合法')
    const selected = new Set(selectedIndices.filter(index => Number.isInteger(index)
        && index >= 0 && index < TRUSTED_CDN_CATALOG.length))
    const usable = TRUSTED_CDN_CATALOG.some((host, index) => selected.has(index) && !isPresumedDnsFailHost(host))
    if (!usable) return controlResult(false, 'zero-candidates', '自動選路至少要保留一個非 presumed 候選')
    Object.keys(catalogOverrides).forEach(host => delete catalogOverrides[host])
    TRUSTED_CDN_CATALOG.forEach((host, index) => {
        const enabled = selected.has(index)
        const headerDefault = !matchesHeaderExclude(host)
        if (enabled !== headerDefault) catalogOverrides[host] = enabled
    })
    persistCatalogOverrides()
    reconcileCatalogCandidates()
    return controlResult(true, 'catalog-updated', 'Catalog 自動選路設定已套用', {
        enabled: TRUSTED_CDN_CATALOG.filter((host, index) => selected.has(index)).length,
    })
}
const reloadAfterFeedback = () => setTimeout(() => { try { location.reload() } catch {} }, 450)

const showResetLearningDialog = () => TrustedMenuUI.openConfirm({
    title: '重置所有學習狀態？',
    paragraphs: [
        '將清除 CDN health、blacklist、dead／soft block、probe cache、HTTPDNS 學習及 Watchdog 統計。',
        '固定 CDN 與 catalog override 不會被清除。此操作無法復原。',
    ],
    confirmLabel: '確認重置',
    danger: true,
    onConfirm: () => {
        const result = BiliCDNControls.reset()
        refreshPublicDiagnosticSnapshot()
        TrustedMenuUI.toast(result.message + '，正在重新載入…', 'success')
        reloadAfterFeedback()
    },
})

const showDiagnosticDialog = () => {
    BiliCDNControls.diag()
    refreshPublicDiagnosticSnapshot()
    return TrustedMenuUI.openText({
        title: 'BiliCDN 診斷資訊',
        paragraphs: ['「排序首位」不等於已確認解碼 codec；此報告包含 UA，但不含影片 URL、cookie 或 IP。'],
        text: buildDiagReport(),
        copyLabel: '複製報告',
        onCopy: () => { copyDiagReport().catch(() => {}) },
    })
}

const showDeadReviveDialog = () => {
    const dead = listDeadHosts().map(entry => entry.host).filter(host => TRUSTED_CDN_CATALOG_SET.has(host))
    if (!dead.length) {
        TrustedMenuUI.toast('目前沒有可救回的 dead catalog 節點', 'info')
        return false
    }
    return TrustedMenuUI.openChoice({
        title: '救回單一 dead catalog 節點',
        paragraphs: ['只解除所選節點的持久 dead 判定；不修改 catalog override。'],
        choices: dead.map(host => ({
            label: host,
            detail: (listDeadHosts().find(entry => entry.host === host) || {}).reason || 'dead',
        })),
        selected: [0],
        confirmLabel: '救回節點',
        onConfirm: picked => {
            const index = picked[0]
            const host = Number.isInteger(index) ? dead[index] : null
            const stillDead = host && listDeadHosts().some(entry => entry.host === host)
            const result = stillDead && TRUSTED_CDN_CATALOG_SET.has(host)
                ? BiliCDNControls.revive(host)
                : controlResult(false, 'stale', '節點狀態已改變，請重新開啟選單')
            syncWorkerCdnTarget()
            refreshPublicDiagnosticSnapshot()
            TrustedMenuUI.toast(result.message, result.ok ? 'success' : 'warning')
        },
    })
}

const showWorkerStatsDialog = () => {
    const stats = BiliCDNControls.workerStats()
    const lines = [
        'Worker 攔截：' + (EnableWorkerIntercept ? '已開啟' : '預設關閉（目前數值為 0 屬正常）'),
        'created=' + stats.created,
        'netCalls=' + stats.netCalls,
        'mediaSeen=' + stats.mediaSeen,
        'rewrites=' + stats.rewrites,
        'bytes=' + stats.bytesMB + ' MB',
        '觀察天數=' + stats.observedDays,
        '判讀=' + stats.verdict,
    ]
    return TrustedMenuUI.openText({ title: 'Worker 使用量', text: lines.join('\n') })
}

const showAsyncControlResult = async (startMessage, operation) => {
    const progress = TrustedMenuUI.toast(startMessage, 'info', { sticky: true })
    try {
        const result = await operation()
        progress.update(result.message, result.ok ? 'success' : (result.status === 'disabled' ? 'warning' : 'info'))
        return result
    } catch (error) {
        const result = controlResult(false, 'error', '操作失敗：' + (error && error.message ? error.message : '未知錯誤'))
        progress.update(result.message, 'error')
        return result
    }
}

const runSmartReassessment = () => {
    if (lastSampleSegmentUrl) {
        return showAsyncControlResult('開始以目前影片分段重新測速…', () => BiliCDNControls.bakeoff())
    }
    return showAsyncControlResult('尚無影片分段，改用延遲探測…', async () => {
        const result = await BiliCDNControls.probe()
        return result && result.ok
            ? controlResult(true, result.status, '尚無影片分段；' + result.message, result.data)
            : result
    })
}

const showRoutingCenter = () => {
    const routes = [
        { label: '自動選路', detail: resolvedCdn ? '重新載入後恢復自動' : '目前模式' },
        ...TRUSTED_CDN_CATALOG.map(host => ({
            label: host,
            detail: [
                host === resolvedCdn ? '目前固定' : '',
                '檔頭預設=' + (matchesHeaderExclude(host) ? '停用' : '啟用'),
                Object.prototype.hasOwnProperty.call(catalogOverrides, host) ? 'override' : '',
                knownDeadHosts.has(host) ? 'dead' : '',
                isPresumedDnsFailHost(host) ? 'presumed' : '',
            ].filter(Boolean).join('；') || '可信 catalog 節點',
        })),
    ]
    const fixedSelected = resolvedCdn ? Math.max(1, TRUSTED_CDN_CATALOG.indexOf(resolvedCdn) + 1) : 0
    const catalogSelected = TRUSTED_CDN_CATALOG
        .map((host, index) => isCatalogAutoEnabled(host) ? index : -1)
        .filter(index => index >= 0)
    return TrustedMenuUI.openRouting({
        title: 'CDN 選路',
        paragraphs: [resolvedCdn
            ? '目前使用固定 CDN；候選勾選會保留，恢復自動後生效。'
            : '固定節點優先於候選設定。至少保留一個非 presumed 自動候選。'],
        routes,
        fixedSelected,
        catalogSelected,
        onDefaults: () => {
            GM_deleteValue('CustomCDN')
            const result = resetCatalogOverrides()
            refreshPublicDiagnosticSnapshot()
            TrustedMenuUI.toast('已恢復自動選路與檔頭預設；正在重新載入…', result.ok ? 'success' : 'error')
            if (result.ok) reloadAfterFeedback()
        },
        onConfirm: ({ routeIndex, enabled }) => {
            if (!Number.isInteger(routeIndex) || routeIndex < 0 || routeIndex > TRUSTED_CDN_CATALOG.length) {
                TrustedMenuUI.toast('固定節點選擇不合法', 'error')
                return
            }
            const catalogResult = applyCatalogSelection(enabled)
            if (!catalogResult.ok) {
                TrustedMenuUI.toast(catalogResult.message, 'error')
                return
            }
            const host = routeIndex === 0 ? null : TRUSTED_CDN_CATALOG[routeIndex - 1]
            const routeResult = BiliCDNControls.setCdn(host)
            refreshPublicDiagnosticSnapshot()
            TrustedMenuUI.toast(routeResult.ok ? '選路設定已套用；正在重新載入…' : routeResult.message,
                routeResult.ok ? 'success' : 'error')
            if (routeResult.ok) reloadAfterFeedback()
        },
    })
}

const showMaintenanceCenter = () => {
    const softCount = Object.keys(cdnSoftBlockUntil).filter(isCdnSoftBlocked).length
    const deadCount = listDeadHosts().filter(entry => TRUSTED_CDN_CATALOG_SET.has(entry.host)).length
    const blackCount = blacklistSet.size
    return TrustedMenuUI.openActions({
        title: '節點維護',
        paragraphs: ['soft=' + softCount + '、dead=' + deadCount + '、black=' + blackCount],
        items: [
            {
                label: '清除所有 soft block', action: 'clear-soft', onActivate: () => {
                    const result = BiliCDNControls.clearSoft()
                    refreshPublicDiagnosticSnapshot()
                    TrustedMenuUI.toast(result.message, result.status === 'empty' ? 'info' : 'success')
                },
            },
            { label: '救回單一 dead catalog 節點', action: 'revive-dead', onActivate: showDeadReviveDialog },
            { label: '重置所有學習狀態', action: 'reset-all', onActivate: showResetLearningDialog },
            { label: '返回控制中心', action: 'back', onActivate: () => showControlCenter() },
        ],
    })
}

const showAdvancedCenter = () => TrustedMenuUI.openActions({
    title: '進階',
    paragraphs: [
        'Verbose 目前' + (Config.verbose ? '已開啟' : '已關閉') + '。',
        'Worker 攔截只能在檔頭設定；此處僅顯示使用量。',
    ],
    items: [
        {
            label: Config.verbose ? '關閉 verbose' : '開啟 verbose', action: 'verbose-toggle', onActivate: () => {
                const result = BiliCDNControls.verbose(!Config.verbose)
                refreshPublicDiagnosticSnapshot()
                TrustedMenuUI.toast(result.message, result.ok ? 'success' : 'warning')
            },
        },
        { label: '顯示 Worker 使用量', action: 'worker-stats', onActivate: showWorkerStatsDialog },
        { label: '返回控制中心', action: 'back', onActivate: () => showControlCenter() },
    ],
})

function showControlCenter() {
    const stats = Watchdog.stats()
    const worker = summarizeWorkerStats()
    const httpdns = getHttpDnsStatus()
    const abnormal = blacklistSet.size + knownDeadHosts.size
        + Object.keys(cdnSoftBlockUntil).filter(isCdnSoftBlocked).length
    const codecLead = lastCodecDecision.groups && lastCodecDecision.groups[0]
        ? (lastCodecDecision.groups[0].selected || '未知')
        : '尚無資料'
    return TrustedMenuUI.openActions({
        title: 'BiliCDN 控制中心',
        paragraphs: [
            '狀態：' + (disabled ? '停用' : '啟用') + '｜模式：' + (resolvedCdn ? '固定' : '自動')
                + '｜選路建議：' + getCdnShortName(),
            '倍速：' + playbackRateState.effectiveRate + 'x（' + (playbackRateState.confirmed ? '已確認' : '假定')
                + '）｜' + describePlaybackBuffer(stats),
            '串流：' + streamEstimate.videoMbps + '+' + streamEstimate.audioMbps + ' Mbps｜codec 排序首位：' + codecLead,
            '異常節點：' + abnormal + '｜HTTPDNS：' + httpdns.mode + '｜Worker：'
                + (EnableWorkerIntercept ? ('created=' + worker.created + ' rewrites=' + worker.rewrites) : '停用'),
        ],
        items: [
            { label: '重新評估節點', action: 'reassess', onActivate: runSmartReassessment },
            { label: 'CDN 選路', action: 'routing', onActivate: showRoutingCenter },
            { label: '診斷', action: 'diagnostics', onActivate: showDiagnosticDialog },
            { label: '節點維護', action: 'maintenance', onActivate: showMaintenanceCenter },
            { label: '進階', action: 'advanced', onActivate: showAdvancedCenter },
        ],
    })
}

if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('⚙️ 開啟 BiliCDN 控制中心', showControlCenter)
}

// ── Main ──────────────────────────────────────────────────────────────
;(function () {
    'use strict'

    // 攔截 playurl API 回應，改寫 base_url + backup_url
    interceptNetResponse((response, url, valid) => {
        if (disabled || !valid() || !isPlayUrlApi(url)) return
        if (response === null || response === undefined) return
        try {
            // XHR responseType='json' 會直接提供物件；舊版一律 JSON.parse(object) 而跳過改寫。
            if (Object.prototype.toString.call(response) === '[object Object]') {
                playInfoTransformer(response)
                return response
            }
            if (typeof response !== 'string') return response
            const playInfo = JSON.parse(response)
            playInfoTransformer(playInfo)
            return JSON.stringify(playInfo)
        } catch { DiagnosticLog.fault('transform') }
    })

    const WEBRTC_APIS = ['RTCPeerConnection', 'mozRTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel']
    const webRtcOriginalDescriptors = new Map()
    const blockWebRtc = () => {
        if (!BlockWebRTC || disabled) return
        WEBRTC_APIS.forEach(api => {
            try {
                if (!webRtcOriginalDescriptors.has(api)) {
                    webRtcOriginalDescriptors.set(api, Object.getOwnPropertyDescriptor(unsafeWindow, api) || null)
                }
                Object.defineProperty(unsafeWindow, api, {
                    get: () => undefined, set: () => {}, configurable: true
                })
            } catch {}
        })
    }
    const restoreWebRtc = () => {
        webRtcOriginalDescriptors.forEach((descriptor, api) => {
            try {
                if (descriptor) Object.defineProperty(unsafeWindow, api, descriptor)
                else delete unsafeWindow[api] // 恢復由 Window prototype 提供的原始 API
            } catch {}
        })
    }

    const transformInitialPlayInfo = () => {
        if (disabled) return
        const safeTransform = (value) => {
            try { playInfoTransformer(value) }
            catch { DiagnosticLog.fault('transform') }
        }
        if (unsafeWindow.__playinfo__) {
            safeTransform(unsafeWindow.__playinfo__)
        } else {
            let internal = unsafeWindow.__playinfo__
            Object.defineProperty(unsafeWindow, '__playinfo__', {
                get: () => internal,
                set: v => { if (!disabled) safeTransform(v); internal = v },
                configurable: true
            })
        }
    }

    // ── 背景續播：偽裝 Page Visibility ──────────────────────────────────
    // 切換視窗/分頁時，瀏覽器會送 visibilitychange=hidden，bili 播放器收到後
    // 常只續傳音訊、停止補視訊 segment；加上背景 timer 節流，緩衝被耗盡，
    // 切回時就得重新加載。這裡讓頁面「永遠看起來是前景可見」，
    // 並吞掉 visibilitychange / blur，避免播放器自行降級或暫停拉流。
    let backgroundPlaybackEnabled = !disabled
    let visibilitySpoofInstalled  = false
    let tabReallyHidden           = false  // 真實（非偽裝）可見狀態，供多分頁協調與省頻寬判斷
    const installVisibilitySpoof = () => {
        if (visibilitySpoofInstalled) return
        visibilitySpoofInstalled = true
        const doc = unsafeWindow.document

        const origHidden = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden')
        const origState  = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState')
        const realHidden = () => (origHidden && origHidden.get) ? origHidden.get.call(doc) : false
        const realState  = () => (origState && origState.get) ? origState.get.call(doc) : 'visible'
        readDiagnosticHidden = () => realState() !== 'visible'
        tabReallyHidden = realState() !== 'visible'

        const def = (key, spoofed, real) => {
            try {
                Object.defineProperty(doc, key, {
                    configurable: true,
                    get: () => backgroundPlaybackEnabled ? spoofed : real(),
                })
            } catch (e) { err('visibility spoof 失敗 (' + key + '):', e) }
        }
        def('hidden',                false,    realHidden)
        def('webkitHidden',          false,    realHidden)
        def('visibilityState',      'visible', realState)
        def('webkitVisibilityState','visible', realState)

        // capture 階段攔截：阻止事件傳到播放器自己的 listener；
        // 同時利用「真實」可見狀態，在切回前景時立即補連線（背景閒置連線約 30s 被斷）。
        const onVisRaw = (e) => {
            tabReallyHidden = realState() !== 'visible'
            if (!backgroundPlaybackEnabled) return
            if (!tabReallyHidden) {
                const hosts = [...new Set([resolvedCdn, ...activeCdnList].filter(Boolean))].slice(0, 3)
                try { preconnectBatch(hosts, true) } catch {}
            }
            e.stopImmediatePropagation()
        }
        doc.addEventListener('visibilitychange', onVisRaw, true)
        doc.addEventListener('webkitvisibilitychange', onVisRaw, true)
        unsafeWindow.addEventListener('blur', (e) => {
            if (backgroundPlaybackEnabled) e.stopImmediatePropagation()
        }, true)
    }

    // ── 多分頁協調（BroadcastChannel）──────────────────────────────────
    // 多開分頁時，真正的互斥只交給 runThroughputBakeoff 內的 navigator.locks。
    // BroadcastChannel 是頁面可偽造的來源，只保留為診斷提示，不能決定是否允許賽馬。
    const TAB_ID = Math.random().toString(36).slice(2) + Date.now().toString(36)
    const FOREIGN_BAKEOFF_QUIET = 8000
    let crossTabChannel = null
    let foreignBakeoffAt = 0

    const setupCrossTab = () => {
        if (crossTabChannel || typeof BroadcastChannel === 'undefined') return
        try { crossTabChannel = new BroadcastChannel('bilicdn_tw') } catch { return }
        crossTabChannel.onmessage = (ev) => {
            const d = ev && ev.data
            if (!d || d.id === TAB_ID) return
            if (d.type === 'bakeoff') foreignBakeoffAt = Date.now()
        }
        crossTabShouldBakeoff = () => true
        onBakeoffStart = () => { try { crossTabChannel.postMessage({ type: 'bakeoff', id: TAB_ID }) } catch {} }
    }
    const closeCrossTab = () => {
        if (crossTabChannel) {
            try { crossTabChannel.close() } catch {}
            crossTabChannel = null
        }
        foreignBakeoffAt = 0
        crossTabShouldBakeoff = () => true
        onBakeoffStart = () => {}
    }

    let pageHooksApplied = false
    const applyPageHooks = () => {
        if (disabled || pageHooksApplied) return
        const step = (name, fn) => {
            try { fn() } catch { DiagnosticLog.fault('page-hook') }
        }
        step('transformInitialPlayInfo', transformInitialPlayInfo)
        step('blockWebRtc', blockWebRtc)
        step('installVisibilitySpoof', installVisibilitySpoof)
        pageHooksApplied = true
    }
    // 以下 UI / Watchdog / Prewarm 過去用一個寫死的 isVideoPage 網址判斷式做閘門，
    // 只認 /video/ 與 /bangumi/play/ 兩種網址——但 userscript header 的 @match 其實
    // 涵蓋了電影、紀錄片、劇集、課程、國創等共 13 種路徑，CDN 改寫核心在那些頁面上
    // 照常運作，面板、卡頓自動換源、SPA 換片狀態重置、seek 預熱卻完全不會啟動。
    // 與其維護第二份「該不該啟動」的網址清單（正是這次會漏掉的原因——兩份清單改
    // 一份忘改一份，以後新增 @match 也很容易再犯一次），直接拿掉這個閘門：下面每個
    // 子系統本來就各自能安全處理「頁面上暫時／永遠沒有播放器」——waitForElm 逾時後
    // 自然放棄（見檔案末尾 .catch）、Watchdog.tick() 找不到 <video> 直接 no-op、
    // setupSeekPrewarm 自己有 30 秒的 attach 重試迴圈——不需要額外的頁面類型白名單。

    // Seek 預熱：僅 seeking（不在 waiting 做 DOM/拆連線，避免卡 seek 主路徑）
    let seekPrewarmStarted = false
    // SPA 換片後 player 常換掉 <video> 元素；attach 成功後 tryAttach 的 interval 就停了，
    // 若不重新武裝，換片後新 <video> 永遠收不到 seek 預熱監聽（見 onSpaNavigate 呼叫）。
    let rearmSeekPrewarm = null
    let stopSeekPrewarm = null
    const setupSeekPrewarm = () => {
        if (seekPrewarmStarted) return
        seekPrewarmStarted = true
        let attached = null
        let lastSeekWarmAt = 0
        const SEEK_WARM_GAP_MS = 400
        const ATTACH_TIMEOUT_MS = 30000
        let attachStartedAt = Date.now()
        let attachTimer = null

        const findVideo = () => {
            let best = null, bestArea = 0
            document.querySelectorAll('video').forEach(v => {
                const a = (v.clientWidth || 0) * (v.clientHeight || 0)
                if (a > bestArea) { bestArea = a; best = v }
            })
            return best
        }

        // 優先提示最近觀察到的影片 Fetch/XHR 節點，音訊不覆蓋此來源。
        // 無新鮮影片觀察時維持選路候選預熱；preconnect 只是瀏覽器提示，
        // 不保證建立、保留或拆除任何 socket，也不是播放器消費該影片的證明。
        const seekWarmHosts = () => {
            const hosts = []
            const push = (h) => {
                if (isValidCustomCdnHost(h) && (h === resolvedCdn || !matchesExclude(h))
                    && hosts.length < 3 && !hosts.includes(h)) hosts.push(h)
            }
            push(getPlayingCdnHost())
            // 第三順位補上「主流真的失敗時會跳過去」的 backup 候選，順序跟 buildBackupUrls
            // 一致，這樣 seek 之後就算主流出事，備援也是熱的。
            getHealthyCdnList(STARTUP_PICK).forEach(push)
            return hosts
        }

        // force=false：seek 中只補缺 link，避免重複重建提示；不假定能控制現有連線。
        const warmupSeek = () => {
            if (disabled) return
            if (Date.now() - lastSeekWarmAt < SEEK_WARM_GAP_MS) return
            lastSeekWarmAt = Date.now()
            preconnectBatch(seekWarmHosts(), false)
        }

        const scheduleSeekWarmup = () => {
            if (disabled) return
            Watchdog.noteSeek()
            bumpSeekGrace()
            warmupSeek()
        }

        const onSeeked = () => {
            if (disabled) return
            bumpSeekGrace()
            warmupSeek()
        }

        const tryAttach = () => {
            const v = findVideo()
            if (!v && Date.now() - attachStartedAt > ATTACH_TIMEOUT_MS) {
                clearInterval(attachTimer)
                attachTimer = null
                return
            }
            if (!v || v === attached) return
            attached = v
            try { v.preload = 'auto' } catch {}
            syncPlaybackRateFromVideo(v, 'initial')
            // rearmSeekPrewarm() 只重置 attached，不代表 DOM 換了新的 <video> 元素——
            // 有些情境（同一元素僅換 src）換片後還是同一個節點，若不擋，每次換片都會對
            // 同一個 <video> 重複掛一輪監聽，seek 一次觸發 N 次 warmup/Watchdog.noteSeek。
            if (!v.__biliCdnSeekBound) {
                v.__biliCdnSeekBound = true
                v.addEventListener('seeking', scheduleSeekWarmup)
                v.addEventListener('seeked', onSeeked)
                v.addEventListener('ratechange', () => {
                    if (disabled) return
                    const rateState = syncPlaybackRateFromVideo(v, 'ratechange')
                    if (rateState.effectiveRate > 1.5) warmupSeek()
                })
            }
            clearInterval(attachTimer)
            attachTimer = null
        }
        attachTimer = setInterval(tryAttach, 800)
        tryAttach()

        rearmSeekPrewarm = () => {
            attached = null
            attachStartedAt = Date.now()
            if (!attachTimer) attachTimer = setInterval(tryAttach, 800)
        }
        stopSeekPrewarm = () => {
            if (attachTimer) clearInterval(attachTimer)
            attachTimer = null
            attached = null
            seekPrewarmStarted = false
            rearmSeekPrewarm = null
            stopSeekPrewarm = null
        }
    }

    // ── SPA 換片偵測 ────────────────────────────────────────────────────
    // B 站換影片不重載頁面（pushState）；換片＝新的 base_url，須清掉舊片殘留：
    // 解除舊強制改寫、重置賽馬冷卻與 Watchdog，讓新影片重新選最佳節點。
    let videoKeyUsedFallback = false
    const getVideoKey = () => {
        let params
        try { params = new URLSearchParams(location.search) } catch { params = new URLSearchParams('') }
        const m = location.pathname.match(/\/(BV[0-9A-Za-z]+|ep\d+|ss\d+|av\d+)/i)
        const fromQuery = m ? '' : (params.get('bvid')
            || (params.get('epid') ? 'ep' + params.get('epid') : '')
            || (params.get('oid') ? 'av' + params.get('oid') : '')
            || (params.get('aid') ? 'av' + params.get('aid') : ''))
        videoKeyUsedFallback = !m && !fromQuery
        const base = (m ? m[1] : (fromQuery || location.pathname)).toLowerCase()
        // v1.3.3：多 P 影片切換分集只會改 ?p=，pathname 一個字都不變 —— 不納入的話
        // 換分集不算換片，新分集會整包沿用上一集的碼率、賽馬冷卻與 Watchdog 狀態
        // （長片合集、課程、紀錄片這類多 P 內容最容易中）。
        const part = params.get('p') || ''
        return part ? base + '#p' + part : base
    }
    let videoKeyFallbackWarned = false
    const warnIfVideoKeyUnresolvable = () => {
        if (!videoKeyUsedFallback || videoKeyFallbackWarned) return
        videoKeyFallbackWarned = true
        console.warn('[' + PluginName + ']: 這個頁面的網址取不到影片識別碼（'
            + location.pathname + '），SPA 換片偵測可能失效；CDN 改寫本身仍可正常運作。')
    }
    let currentVideoKey = getVideoKey()
    let spaHooked = false
    const onSpaNavigate = () => {
        const key = getVideoKey()
        warnIfVideoKeyUnresolvable()
        if (key === currentVideoKey) return
        currentVideoKey = key
        DiagnosticLog.record('runtime', { reason: 'spa' }, true)
        TrustedMenuUI.invalidate()
        stopRuntimeGeneration()
        cdnProbeStarted = false
        closeCrossTab()
        if (stopSeekPrewarm) stopSeekPrewarm()
        clearRuntimeConnectionHints()
        forcedRedirectHosts.clear()
        resetStreamProfile()        // v1.3.3：舊片碼率不能留給新片（見該函式說明）
        bakeoffStartupDefers = 0    // v1.3.3：新片重新給滿起播讓路的額度
        setLastBakeoffAt(0)           // 解除冷卻，新片可立即賽馬
        lastSampleSegmentUrl = null
        // 放棄舊片還沒發出/還在跑的賽馬，把名額讓給新片：
        // - 還沒發出（排程中）：epoch 不符，scheduleBakeoff 的 timeout 觸發時直接跳過。
        // - 已經在跑：epoch 不符讓迴圈提早跳出 + abort 訊號讓當前這顆 probe 立刻斷線，
        //   不用等滿 3s timeout，bakeoffRunning 才能盡快讓新片的賽馬排得進去。
        bakeoffEpoch++
        if (bakeoffTimer) { clearTimeout(bakeoffTimer); bakeoffTimer = null }
        if (bakeoffAbortController) { try { bakeoffAbortController.abort() } catch {} ; bakeoffAbortController = null }
        try { Watchdog.reset() } catch {}
        try { HttpDnsAutoPilot.onWatchdogReset() } catch {}
        syncWorkerCdnTarget()
        if (!disabled) {
            beginRuntimeGeneration()
            setupCrossTab()
            startCdnProbe()
            setupSeekPrewarm()
        }
        refreshPublicDiagnosticSnapshot()
        log('[SPA] 換片：' + key + '，重置選節點狀態')
    }
    const hookHistory = () => {
        if (spaHooked) return
        spaHooked = true
        const h = unsafeWindow.history
        ;['pushState', 'replaceState'].forEach(name => {
            const orig = h[name]
            if (!orig || orig.__biliCdnHooked) return
            const wrapped = function (...args) {
                const r = orig.apply(this, args)
                try { setTimeout(onSpaNavigate, 0) } catch {}
                return r
            }
            wrapped.__biliCdnHooked = true
            h[name] = wrapped
        })
        unsafeWindow.addEventListener('popstate', () => setTimeout(onSpaNavigate, 0))
    }

    let runtimeStarted = false
    let keepWarmTimer = null
    let periodicBakeoffTimer = null
    const startRuntimeFeatures = () => {
        if (runtimeStarted || disabled) return
        runtimeStarted = true
        beginRuntimeGeneration()
        refreshExpiredRestrictions()
        backgroundPlaybackEnabled = true
        applyPageHooks()
        if (codecResumeItems.length) prepareCodecConfigurations(codecResumeItems)
        blockWebRtc() // applyPageHooks 只跑一次；重新啟用時仍要再次套用
        startCdnProbe()
        Watchdog.start()
        hookHistory()
        setupCrossTab()
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', discoverCdnFromPage, { once: true })
        } else {
            discoverCdnFromPage()
        }
        setupSeekPrewarm()
        // 保留每 25 秒刷新 catalog Top 3 的提示；不保證瀏覽器建立或持續保留連線。
        if (!keepWarmTimer) {
            keepWarmTimer = setInterval(() => {
                if (disabled) return
                const hosts = [...new Set([resolvedCdn, ...activeCdnList].filter(Boolean))].slice(0, 3)
                preconnectBatch(hosts, !inSeekGrace())
            }, 25000)
        }
        // 週期性賽馬：跨國擁塞會隨時段漂移，每 4 分鐘重評估一次（受 90s 冷卻保護），
        // 找到明顯更快的節點就中途切換 → 播放中持續維持在最佳節點。
        if (!periodicBakeoffTimer) {
            periodicBakeoffTimer = setInterval(() => {
                if (disabled || resolvedCdn || !lastSampleSegmentUrl) return
                // 背景分頁不主動週期賽馬：player 仍靠偽裝續播，省頻寬並避免多分頁互搶
                if (tabReallyHidden) return
                // 這裡就是專門為了「現用節點目前還算快，但擁塞會隨時段漂移，
                // 說不定有更快的」而存在的，不能被同一個理由的捷徑自己擋掉自己。
                runThroughputBakeoff(lastSampleSegmentUrl, false).catch(reportMeasurementFailure())
            }, 4 * 60 * 1000)
        }
    }
    const stopRuntimeFeatures = () => {
        runtimeStarted = false
        stopRuntimeGeneration()
        cdnProbeStarted = false
        backgroundPlaybackEnabled = false
        restoreWebRtc()
        Watchdog.stop()
        bakeoffEpoch++
        if (bakeoffTimer) { clearRuntimeTimeout(bakeoffTimer); bakeoffTimer = null }
        if (bakeoffAbortController) { try { bakeoffAbortController.abort() } catch {}; bakeoffAbortController = null }
        if (probeDeferTimer) { clearRuntimeTimeout(probeDeferTimer); probeDeferTimer = null }
        probeDeferCount = 0
        clearRuntimeConnectionHints()
        closeCrossTab()
        if (stopSeekPrewarm) stopSeekPrewarm()
        if (keepWarmTimer) {
            clearInterval(keepWarmTimer)
            keepWarmTimer = null
        }
        if (periodicBakeoffTimer) {
            clearInterval(periodicBakeoffTimer)
            periodicBakeoffTimer = null
        }
        syncWorkerDisabledState()
    }
    const setRuntimeDisabled = (nextDisabled) => {
        TrustedMenuUI.invalidate()
        disabled = !!nextDisabled
        GM_setValue('disabled', disabled)
        if (disabled) stopRuntimeFeatures()
        else startRuntimeFeatures()
        syncWorkerDisabledState()
        refreshPublicDiagnosticSnapshot()
        return disabled
    }
    startRuntimeFeatures()

    // 只認 class，不鎖死中間包裝層數：bangumi/play（OGV 播放器）在 setting box 內部的
    // wrapper 層數與 video（UGC 播放器）不同，鎖死完整路徑會導致 waitForElm 逾時、
    // 「攔截修改影片 CDN」選項在番劇頁完全不出現（且預設不 verbose，使用者看不到任何錯誤）。
    // 只認 class 換來的代價：若頁面同時存在一個以上 .bpx-player-ctrl-setting-others
    // （例如浮動小視窗播放器、續播預覽卡用了同一套播放器元件），document.querySelector
    // 只會拿到 DOM 順序第一個，不一定是實際在播放的主播放器。有多個候選時，挑「最近的
    // <video> 面積最大」那個，跟 findVideo()/getVideo() 判斷主播放器的方式一致。
    const pickMainSettingsAnchor = (first) => {
        const all = document.querySelectorAll('.bpx-player-ctrl-setting-others')
        if (all.length <= 1) return first
        let best = first, bestArea = -1
        all.forEach(node => {
            const root = node.closest('[id*="bilibili-player"], [class*="bpx-player"]') || node
            const video = root.querySelector && root.querySelector('video')
            const area = video ? (video.clientWidth || 0) * (video.clientHeight || 0) : 0
            if (area > bestArea) { bestArea = area; best = node }
        })
        return best
    }
    // Bilibili 換片是 SPA 導航，不會整頁重載，播放器常把設定面板整個重建，
    // 注入的 UI 會被連根拔起。buildUI 抽成可重入函式、由 statusTimer 常駐偵測，
    // 面板消失時直接重建，取代原本「只注入一次、掉了就再也回不來」的作法。
    let renderVisibleStatus = () => {}
    const buildUI = (settingsBar) => {
        if (!settingsBar || settingsBar.querySelector('#bilicdn-status-panel')) return
        uiInjectStatus = 'ok'

        settingsBar.appendChild(fromHTML(
            '<div class="bpx-player-ctrl-setting-others-title">' + SettingsBarTitle + '</div>'
        ))

        const checkBoxWrapper = fromHTML(
            '<div class="bpx-player-ctrl-setting-checkbox bpx-player-ctrl-setting-blackgap bui bui-checkbox bui-dark">' +
            '<div class="bui-area">' +
            '<input class="bui-checkbox-input" type="checkbox" checked aria-label="自訂影片 CDN">' +
            '<label class="bui-checkbox-label">' +
            '<span class="bui-checkbox-icon bui-checkbox-icon-default">' +
            '<svg xmlns="http://www.w3.org/2000/svg" data-pointer="none" viewBox="0 0 32 32"><path d="M8 6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H8zm0-2h16c2.21 0 4 1.79 4 4v16c0 2.21-1.79 4-4 4H8c-2.21 0-4-1.79-4-4V8c0-2.21 1.79-4 4-4z"></path></svg>' +
            '</span>' +
            '<span class="bui-checkbox-icon bui-checkbox-icon-selected">' +
            '<svg xmlns="http://www.w3.org/2000/svg" data-pointer="none" viewBox="0 0 32 32"><path d="m13 18.25-1.8-1.8c-.6-.6-1.65-.6-2.25 0s-.6 1.5 0 2.25l2.85 2.85c.318.318.762.468 1.2.448.438.02.882-.13 1.2-.448l8.85-8.85c.6-.6.6-1.65 0-2.25s-1.65-.6-2.25 0l-7.8 7.8zM8 4h16c2.21 0 4 1.79 4 4v16c0 2.21-1.79 4-4 4H8c-2.21 0-4-1.79-4-4V8c0-2.21 1.79-4 4-4z"></path></svg>' +
            '</span>' +
            '<span class="bui-checkbox-name">' + SettingsBarTitle + '</span>' +
            '</label></div></div>'
        )

        const checkBox = checkBoxWrapper.querySelector('input')
        checkBox.checked = !disabled
        checkBox.addEventListener('change', (event) => {
            if (!event || !event.isTrusted) {
                checkBox.checked = !disabled
                return
            }
            setRuntimeDisabled(!checkBox.checked)
            updateStatusPanel()
            TrustedMenuUI.toast(disabled ? 'CDN 改寫與主動量測已停用' : 'CDN 改寫已啟用', disabled ? 'warning' : 'success')
        })

        // 狀態面板（白名單 + 緩衝進度 + 黑名單/死節點）
        const statusPanel = document.createElement('div')
        statusPanel.id = 'bilicdn-status-panel'
        statusPanel.style.cssText = 'font-size:10px;padding:2px 0 6px;line-height:1.6;'
        let lastStatusHtml = ''

        const renderStatusHtml = (html) => {
            if (html === lastStatusHtml) return
            lastStatusHtml = html
            statusPanel.innerHTML = html
        }

        const updateStatusPanel = () => {
            if (disabled) {
                renderStatusHtml('<span style="color:#aaa;">CDN 切換已停用</span>')
                return
            }
            const s = Watchdog.stats()
            const bufferText = describePlaybackBuffer(s)
            const mode = resolvedCdn ? '固定' : '自動'
            const rate = (playbackRateState.confirmed ? playbackRateState.observedRate : ASSUMED_PLAYBACK_RATE) + 'x' + (playbackRateState.confirmed ? '' : '（未確認，按 2x 估算）')
            const softCount = Object.keys(cdnSoftBlockUntil).filter(isCdnSoftBlocked).length
            const abnormalCount = blacklistSet.size + knownDeadHosts.size + softCount
            let html = '<div style="color:#4fc3f7;">'
                + mode + '｜' + getCdnShortName() + '｜' + rate
                + '</div>'
                + '<div style="margin-top:3px;color:#90caf9;font-size:10px;">'
                + bufferText + '</div>'
            if (abnormalCount > 0) {
                html += '<div style="color:#ffb74d;margin-top:2px;">異常節點：' + abnormalCount
                    + '（請由控制中心查看）</div>'
            }

            renderStatusHtml(html)
        }

        updateStatusPanel()
        renderVisibleStatus = () => {
            if (!document.contains(statusPanel) || statusPanel.offsetParent === null) return
            updateStatusPanel()
        }

        settingsBar.appendChild(checkBoxWrapper)
        settingsBar.appendChild(statusPanel)
    }

    // 常駐看門狗：waitForElm 只重試 30 秒，若第一次就逾時（網路慢、番劇頁載入久），
    // buildUI 從未執行過，statusTimer 也就從未誕生，面板會永遠不出現。這顆看門狗
    // 不受那次逾時影響，持續每 1.5 秒檢查一次；面板存在時直接休眠 no-op，
    // 面板消失（含「從未建立」與「被拔掉」兩種情況）時才動手找錨點重建。
    const ensureUiPresent = () => {
        if (document.querySelector('#bilicdn-status-panel')) return
        const bar = pickMainSettingsAnchor(document.querySelector('.bpx-player-ctrl-setting-others'))
        if (bar) buildUI(bar)   // buildUI 開頭已有防重入判斷，找到錨點但面板已存在時會自行 no-op
    }

    waitForElm('.bpx-player-ctrl-setting-others', 30000)
        .then(found => buildUI(pickMainSettingsAnchor(found)))
        .catch(() => { uiInjectStatus = 'timeout'; DiagnosticLog.fault('ui') })

    // One shared state cycle, independent of panel injection/visibility. No active networking here.
    setInterval(() => {
        refreshExpiredRestrictions()
        samplePlaybackQuality()
        if (!disabled) DiagnosticLog.sample(readPlaybackDiagnostic())
        refreshPublicDiagnosticSnapshot()
        renderVisibleStatus()
    }, 1000)
    refreshPublicDiagnosticSnapshot()
    setInterval(ensureUiPresent, 1500)

})()
