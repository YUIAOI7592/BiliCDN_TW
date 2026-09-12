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
const WORKER_INSTALL_STATES = new Set([
    'disabled', 'pending', 'installing', 'installed', 'unavailable', 'already-patched', 'invalid-target', 'failed', 'replaced',
])
const WORKER_DIAGNOSTIC_COUNTERS = Object.freeze({
    'install-attempt': 'installAttempts',
    'install-failure': 'installFailures',
    'no-worker': 'noWorker',
    'constructor-call': 'constructorCalls',
    'wrapped': 'created',
    'bootstrap-ready': 'bootstrapReady',
    'bootstrap-timeout': 'bootstrapTimeouts',
    'bypass-disabled': 'bypassDisabled',
    'bypass-blob': 'bypassBlob',
    'bypass-data': 'bypassData',
    'bypass-cross-origin-module': 'bypassCrossOriginModule',
    'bypass-no-random': 'bypassNoRandom',
    'bypass-no-blob-api': 'bypassNoBlobApi',
    'bypass-no-message-channel': 'bypassNoMessageChannel',
    'resolve-failure': 'resolveFailures',
    'build-failure': 'buildFailures',
    'constructor-failure': 'constructorFailures',
    'register-failure': 'registerFailures',
    'port-failure': 'portFailures',
    'constructor-replaced': 'replacements',
})
const WORKER_COUNTER_KEYS = Object.freeze([...new Set([
    'created', 'netCalls', 'mediaSeen', 'rewrites', 'bytes', ...Object.values(WORKER_DIAGNOSTIC_COUNTERS),
])])

const sanitizeWorkerCounter = value => Number.isFinite(+value)
    ? Math.max(0, Math.min(WORKER_STAT_COUNTER_MAX, Math.trunc(+value))) : 0
const sanitizeWorkerTimestamp = value => Number.isFinite(+value) ? Math.max(0, Math.trunc(+value)) : 0
const sanitizeWorkerSample = value => {
    try {
        const host = new URL(String(value)).hostname.toLowerCase()
        return host.length <= 253 && /^[a-z0-9.-]+$/.test(host) ? host : null
    } catch { return null }
}
const emptyWorkerStats = () => ({
    ...Object.fromEntries(WORKER_COUNTER_KEYS.map(key => [key, 0])), firstAt: 0, lastAt: 0, samples: [],
})
const workerStats = (() => {
    try {
        const raw = JSON.parse(GM_getValue(WORKER_STATS_KEY) || '{}') || {}
        return {
            ...Object.fromEntries(WORKER_COUNTER_KEYS.map(key => [key, sanitizeWorkerCounter(raw[key])])),
            firstAt: sanitizeWorkerTimestamp(raw.firstAt),
            lastAt: sanitizeWorkerTimestamp(raw.lastAt),
            samples: Array.isArray(raw.samples)
                ? raw.samples.map(sanitizeWorkerSample).filter(Boolean).slice(0, WORKER_STATS_MAX_SAMPLES) : [],
        }
    } catch { return emptyWorkerStats() }
})()
const sessionWorkerStats = {
    installState: deps.EnableWorkerIntercept ? 'pending' : 'disabled',
    ...Object.fromEntries(WORKER_COUNTER_KEYS.map(key => [key, 0])),
}

let workerStatsSaveTimer = null
const flushWorkerStats = () => {
    if (workerStatsSaveTimer) { clearTimeout(workerStatsSaveTimer); workerStatsSaveTimer = null }
    try { GM_setValue(WORKER_STATS_KEY, JSON.stringify(workerStats)) } catch {}
}
const scheduleWorkerStatsSave = () => {
    if (workerStatsSaveTimer) return
    workerStatsSaveTimer = setTimeout(() => { workerStatsSaveTimer = null; flushWorkerStats() }, WORKER_STATS_SAVE_MS)
}
const bumpWorkerStats = patch => {
    if (!patch || typeof patch !== 'object') return
    const now = Date.now()
    if (!workerStats.firstAt) workerStats.firstAt = now
    workerStats.lastAt = now
    WORKER_COUNTER_KEYS.forEach(key => {
        const delta = sanitizeWorkerCounter(patch[key])
        if (!delta) return
        workerStats[key] = Math.min(WORKER_STAT_COUNTER_MAX, workerStats[key] + delta)
        if (['netCalls', 'mediaSeen', 'rewrites', 'bytes'].includes(key)) {
            sessionWorkerStats[key] = Math.min(WORKER_STAT_COUNTER_MAX, sessionWorkerStats[key] + delta)
        }
    })
    const sample = sanitizeWorkerSample(patch.sample)
    if (sample && !workerStats.samples.includes(sample)) {
        workerStats.samples.push(sample)
        if (workerStats.samples.length > WORKER_STATS_MAX_SAMPLES) workerStats.samples.shift()
    }
    scheduleWorkerStatsSave()
}
const setWorkerInstallState = state => {
    if (!WORKER_INSTALL_STATES.has(state)) return false
    sessionWorkerStats.installState = state
    return true
}
const noteWorkerDiagnostic = (code, sample) => {
    const key = WORKER_DIAGNOSTIC_COUNTERS[code]
    if (!key) return false
    sessionWorkerStats[key] = Math.min(WORKER_STAT_COUNTER_MAX, sessionWorkerStats[key] + 1)
    bumpWorkerStats({ [key]: 1, ...(code === 'wrapped' ? { sample } : {}) })
    return true
}

window.addEventListener('pagehide', flushWorkerStats)

const summarizeWorkerStats = () => {
    const days = workerStats.firstAt ? Math.max(1, Math.round((Date.now() - workerStats.firstAt) / 86400000)) : 0
    const s = sessionWorkerStats
    const bypassTotal = s.bypassDisabled + s.bypassBlob + s.bypassData + s.bypassCrossOriginModule
        + s.bypassNoRandom + s.bypassNoBlobApi + s.bypassNoMessageChannel
    const failureTotal = s.installFailures + s.resolveFailures + s.buildFailures + s.constructorFailures
        + s.registerFailures + s.portFailures + s.bootstrapTimeouts
    let verdict = 'Worker 攔截目前停用；開啟後重整才能量測'
    if (deps.EnableWorkerIntercept) {
        if (s.installState === 'unavailable') verdict = '此頁載入時沒有可攔截的 Worker constructor'
        else if (s.installState === 'already-patched') verdict = 'Worker 已被其他實例標記為攔截；本實例無法判讀其內部活動'
        else if (s.installState === 'invalid-target') verdict = '沒有合法 catalog target，攔截器未安裝'
        else if (s.installState === 'failed') verdict = '攔截器安裝失敗；請複製診斷報告'
        else if (s.installState === 'replaced') verdict = '攔截器安裝後被頁面替換，後續 Worker 不在量測範圍'
        else if (s.constructorCalls === 0) verdict = '攔截器已安裝，但本分頁尚未呼叫可見的 Worker constructor'
        else if (s.created === 0 && bypassTotal > 0) verdict = '已看見 Worker 呼叫，但全部依安全／來源規則原樣放行'
        else if (s.created === 0 && failureTotal > 0) verdict = '已看見 Worker 呼叫，但包裝或私有通道建立失敗'
        else if (s.created > 0 && s.bootstrapReady === 0) verdict = '已建立包裝 Worker，但尚未收到私有 bootstrap 確認'
        else if (s.netCalls === 0) verdict = '本分頁已確認包裝 Worker，但尚未觀察到其網路請求'
        else if (s.mediaSeen === 0) verdict = '本分頁 Worker 有網路請求，但尚未觀察到媒體分段'
        else verdict = 'Worker 已觀察到媒體分段；攔截功能在此頁有實際用途'
    }
    return {
        installState: s.installState,
        session: {
            constructorCalls: s.constructorCalls,
            wrapped: s.created,
            bootstrapReady: s.bootstrapReady,
            bypass: {
                disabled: s.bypassDisabled, blob: s.bypassBlob, data: s.bypassData,
                crossOriginModule: s.bypassCrossOriginModule, noRandom: s.bypassNoRandom,
                noBlobApi: s.bypassNoBlobApi, noMessageChannel: s.bypassNoMessageChannel,
            },
            failures: {
                install: s.installFailures, resolve: s.resolveFailures, build: s.buildFailures,
                constructor: s.constructorFailures, register: s.registerFailures, port: s.portFailures,
                bootstrap: s.bootstrapTimeouts,
            },
            replacements: s.replacements,
            netCalls: s.netCalls,
            mediaSeen: s.mediaSeen,
            rewrites: s.rewrites,
            bytesMB: +((s.bytes || 0) / 1024 / 1024).toFixed(2),
        },
        created: workerStats.created,
        bootstrapReady: workerStats.bootstrapReady,
        constructorCalls: workerStats.constructorCalls,
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
get setWorkerInstallState() { return setWorkerInstallState; },
get noteWorkerDiagnostic() { return noteWorkerDiagnostic; },
get summarizeWorkerStats() { return summarizeWorkerStats; }
};
}
