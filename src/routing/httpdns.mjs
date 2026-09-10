// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createHttpdns(deps) {
const HTTPDNS_PROFILE_KEY = 'httpdnsProfile_v2'

const HTTPDNS_STATE_KEY   = 'httpdnsAutoState_v2'

const HTTPDNS_TRIAL_MS    = 10 * 60 * 1000

const HTTPDNS_COMMIT_MS   = 6 * 60 * 60 * 1000

const HTTPDNS_PROFILE_TTL = 7 * 24 * 60 * 60 * 1000

const HTTPDNS_SCORE_MARGIN = 10

const normalizeHttpDnsMode = (mode) =>
    (mode === true || mode === false || mode === 'auto') ? mode : 'auto'

let httpDnsMode = normalizeHttpDnsMode(deps.BlockHttpDNS)

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
        const needMbps   = Math.max(1.5, deps.getRequiredStreamMbps())
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
        deps.redirectStats.httpdnsAutoSwitch++
        saveAutoState()
        try { GM_deleteValue(deps.PROBE_CACHE_KEY) } catch {}
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
        deps.redirectStats.httpdnsAutoSwitch++
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
            deps.redirectStats.httpdnsAutoSwitch++
            return true
        }
        if (shouldBlock() && deps.redirectStats.httpdns > 0) {
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
        deps.BlockHttpDNS = httpDnsMode
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
return { /* TEST_EXPORTS:httpdns */
get HttpDnsAutoPilot() { return HttpDnsAutoPilot; },
get getHttpDnsStatus() { return getHttpDnsStatus; },
get shouldBlockHttpDns() { return shouldBlockHttpDns; },
get setHttpDnsMode() { return setHttpDnsMode; }
};
}
