// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createWorkerStats(deps) {
const biliCdnWorkers = new Set()

const workerControlPorts = new WeakMap()

const getWorkerCdnTarget = () => [deps.resolvedCdn, deps.lastChosenCdn, deps.peekBestCdn(), deps.activeCdnList[0], deps.PREFERRED_CDN_LIST[0]]
    .find(deps.isValidCustomCdnHost) || ''

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

const summarizeWorkerStats = () => {
    const days = workerStats.firstAt ? Math.max(1, Math.round((Date.now() - workerStats.firstAt) / 86400000)) : 0
    let verdict = deps.EnableWorkerIntercept
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
return { /* TEST_EXPORTS:workerStats */
get biliCdnWorkers() { return biliCdnWorkers; },
get workerControlPorts() { return workerControlPorts; },
get getWorkerCdnTarget() { return getWorkerCdnTarget; },
get bumpWorkerStats() { return bumpWorkerStats; },
get summarizeWorkerStats() { return summarizeWorkerStats; }
};
}
