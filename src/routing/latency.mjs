// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createLatency(deps) {
const PROBE_PATH       = '/crossdomain.xml'

const PROBE_CACHE_KEY  = 'probeCache_v1'

const PROBE_CACHE_TTL  = 2 * 60 * 60 * 1000

const PROBE_TIMEOUT_MS = 8000

const PROBE_SLOW_STRIKES = 2

const PROBE_TIMEOUT_STRIKES = 3

const CONFIRM_TIMEOUT_MS = 10000

const confirmHostReachable = (cdn, timeoutMs, runtimeToken = deps.captureRuntimeGeneration()) => new Promise((resolve) => {
    if (deps.isHostAllowed && !deps.isHostAllowed(cdn)) return resolve(null)
    if (!deps.isRuntimeGenerationActive(runtimeToken)) return resolve(null)
    let settled = false
    let to = null
    let detachRuntimeAbort = () => {}
    const done = (v) => {
        if (settled) return
        settled = true
        deps.clearRuntimeTimeout(to)
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
    to = deps.scheduleRuntimeTimeout(() => { try { ctrl && ctrl.abort() } catch {} ; done(false) }, timeoutMs || 4000)
    deps.interceptNetResponse.rawFetch('https://' + cdn + PROBE_PATH + '?_c=' + Date.now(), {
        method: 'GET', mode: 'no-cors', cache: 'no-store',
        credentials: 'omit', referrerPolicy: 'no-referrer',
        signal: ctrl ? ctrl.signal : undefined,
    }).then(() => { done(deps.isRuntimeGenerationActive(runtimeToken) ? true : null) })
      .catch(() => { done(deps.isRuntimeGenerationActive(runtimeToken) ? false : null) })
})

const segConnCheckAt = new Map()

const SEG_CONN_CHECK_COOLDOWN = 30 * 1000

const handleSegmentConnError = (cdn, bytesReceived) => {
    if (deps.disabled || !cdn) return
    const runtimeToken = deps.captureRuntimeGeneration()
    if (!deps.isRuntimeGenerationActive(runtimeToken)) return
    // 收過位元組 = 連線建立過，是傳輸中斷（網路抖動、切畫質、播放器自己取消），
    // 不屬於這裡要處理的情況，交還既有的軟懲罰。
    if (bytesReceived > 0) return
    if (deps.knownDeadHosts.has(cdn) || deps.blacklistSet.has(cdn)) return
    // 起播時播放器會同時併發好幾顆 segment，全部失敗 → 不做節流會一次打出十幾個確認請求。
    const now  = Date.now()
    const last = segConnCheckAt.get(cdn) || 0
    if (now - last < SEG_CONN_CHECK_COOLDOWN) return
    segConnCheckAt.set(cdn, now)
    // 同上：已知不解析的 host 不必再確認一次。
    if (deps.isPresumedDnsFailHost(cdn)) {
        deps.markHostDead(cdn, 'DNS-segment')
        deps.log('[死節點] 已知在台灣不解析的節點又被指派到 segment，直接標死：' + cdn.split('.')[0])
        deps.promoteBestCdnNow()
        return
    }
    // 2026-08-19：確認窗從 2 秒拉到 CONFIRM_TIMEOUT_MS。冷 TLS 握手實測上界 8.8 秒，
    // 2 秒的窗會把「還在握手」的好節點判成「連不到」然後標死 30 天。見 PROBE_TIMEOUT_STRIKES。
    confirmHostReachable(cdn, CONFIRM_TIMEOUT_MS, runtimeToken).then((reachable) => {
        if (!deps.isRuntimeGenerationActive(runtimeToken) || reachable == null) return
        // 連得到 → 只是這一次請求出事（伺服器主動斷線之類），recordCdnFailure 已經記過帳，
        // 不需要也不應該升級成標死。
        if (reachable) return
        deps.markHostDead(cdn, 'DNS-segment')
        deps.log('[死節點] segment 連線層失敗且確認連不到，標死 30 天：' + cdn.split('.')[0])
        deps.promoteBestCdnNow()
    })
}

const probeCdnLatency = (cdn, runtimeToken = deps.captureRuntimeGeneration()) => new Promise((resolve) => {
    if (deps.isHostAllowed && !deps.isHostAllowed(cdn)) return resolve({ cdn, ms: Infinity, reason: 'ineligible' })
    if (!deps.isRuntimeGenerationActive(runtimeToken)) return resolve({ cdn, ms: Infinity, cancelled: true })
    if (deps.knownDeadHosts.has(cdn)) return resolve({ cdn, ms: Infinity })

    const t0 = performance.now()
    let done = false
    let timedOut = false
    let timer = null
    let detachRuntimeAbort = () => {}
    const finish = (result) => {
        if (done) return
        done = true
        deps.clearRuntimeTimeout(timer)
        detachRuntimeAbort()
        if (deps.isRuntimeGenerationActive(runtimeToken)) deps.DiagnosticLog.record('measurement', {
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
    timer = deps.scheduleRuntimeTimeout(() => {
        if (!deps.isRuntimeGenerationActive(runtimeToken)) return finish({ ms: Infinity, cancelled: true })
        timedOut = true
        try { ctrl && ctrl.abort() } catch {}
        // 逾時不直接標死：可能只是當下壅塞。再用較長時間確認真的連不到才標死。
        // 10 秒（不是 4 秒）：實測冷 TLS 握手的上界約 8.8 秒（hw）／6.4 秒（ali），
        // 確認窗必須完整涵蓋它，否則「冷連線」會被當成「連不到」。見 PROBE_TIMEOUT_STRIKES。
        confirmHostReachable(cdn, CONFIRM_TIMEOUT_MS, runtimeToken).then((reachable) => {
            if (!deps.isRuntimeGenerationActive(runtimeToken) || reachable == null) {
                finish({ ms: Infinity, cancelled: true })
                return
            }
            if (reachable) {
                // 確認成功 = 這台其實連得到，只是比探測窗慢。
                // 記錄**真實耗時**而不是捏造一個平坦的 PROBE_TIMEOUT_MS：後者會讓所有
                // 逾時節點看起來一樣慢，也讓 EWMA 收到一個假數字（使用者實測看到的
                // `ali: latency 1701` 就是這樣被摻出來的，那不是任何一次真實量測）。
                const slowMs = Math.max(performance.now() - t0, PROBE_TIMEOUT_MS)
                deps.recordCdnLatency(cdn, slowMs)
                // recordCdnLatency 會重置 probeTimeouts，所以慢速計數要另外記、且在它之後加。
                const hs = deps.ensureCdnHealth(cdn)
                hs.probeSlows = Math.min(deps.CDN_HEALTH_CAPS.probeSlows, (hs.probeSlows || 0) + 1)
                hs.lastProbeAt = Date.now()
                deps.scheduleCdnHealthSave()
                if (hs.probeSlows >= PROBE_SLOW_STRIKES) {
                    deps.softBlockCdn(cdn, 'probe-slow', 5 * 60 * 1000)
                }
                finish({ ms: slowMs })
            } else {
                const h = deps.ensureCdnHealth(cdn)
                h.probeTimeouts = Math.min(deps.CDN_HEALTH_CAPS.probeTimeouts, (h.probeTimeouts || 0) + 1)
                h.lastProbeAt = Date.now()
                deps.scheduleCdnHealthSave()
                if (h.probeTimeouts >= PROBE_TIMEOUT_STRIKES) {
                    deps.markHostDead(cdn, 'timeout')
                    finish({ ms: Infinity, reason: 'timeout' })
                } else {
                    // 第一次：只軟隔離觀察，仍留在候選池裡等下一輪重新評估。
                    deps.softBlockCdn(cdn, 'probe-timeout', 10 * 60 * 1000)
                    finish({ ms: PROBE_TIMEOUT_MS, reason: 'timeout-1st' })
                }
            }
        })
    }, PROBE_TIMEOUT_MS)

    deps.interceptNetResponse.rawFetch('https://' + cdn + PROBE_PATH + '?_t=' + Date.now(), {
        method: 'GET', mode: 'no-cors', cache: 'no-store',
        credentials: 'omit', referrerPolicy: 'no-referrer',
        signal: ctrl ? ctrl.signal : undefined,
    }).then(() => {
        // resolve = 伺服器有回應（健康節點是 200，安靜）→ 可達，這段時間就是延遲。
        if (timedOut) return
        if (!deps.isRuntimeGenerationActive(runtimeToken)) return finish({ ms: Infinity, cancelled: true })
        const ms = Math.max(performance.now() - t0, 1)
        deps.recordCdnLatency(cdn, ms)
        // 這一輪在窗內回應了 → 連續慢速計數歸零（跟 probeTimeouts 的處理方式一致）。
        const hf = deps.cdnHealth[cdn]
        if (hf && hf.probeSlows) { hf.probeSlows = 0; deps.scheduleCdnHealthSave() }
        finish({ ms })
    }).catch(() => {
        // reject = 網路層失敗（DNS / 連線被拒 / TLS）。
        if (timedOut) return
        if (!deps.isRuntimeGenerationActive(runtimeToken)) return finish({ ms: Infinity, cancelled: true })
        // 已知在台灣不解析、本機又從無成功紀錄 → 直接判定，不必再確認一次。
        if (deps.isPresumedDnsFailHost(cdn)) {
            deps.markHostDead(cdn, 'DNS')
            finish({ ms: Infinity, reason: 'DNS' })
            return
        }
        // 其他 host 再確認一次才標死：單一次網路層失敗也可能只是瞬間抖動，
        // 而標死的代價是 7~30 天不再使用這個節點，誤判的傷害遠大於多發一個請求。
        // 這個情境下 console 本來就已經有一行紅字了，多一行不改變什麼。
        // 同上：2.5 秒不足以涵蓋冷 TLS 握手（實測上界 8.8 秒），改用 CONFIRM_TIMEOUT_MS。
        confirmHostReachable(cdn, CONFIRM_TIMEOUT_MS, runtimeToken).then((reachable) => {
            if (!deps.isRuntimeGenerationActive(runtimeToken) || reachable == null) {
                finish({ ms: Infinity, cancelled: true })
                return
            }
            if (reachable) {
                const ms = Math.max(performance.now() - t0, 1)
                deps.recordCdnLatency(cdn, ms)
                finish({ ms })
            } else {
                deps.markHostDead(cdn, 'DNS')
                finish({ ms: Infinity, reason: 'DNS' })
            }
        })
    })
})
return { /* TEST_EXPORTS:latency */
get PROBE_CACHE_KEY() { return PROBE_CACHE_KEY; },
get PROBE_CACHE_TTL() { return PROBE_CACHE_TTL; },
get handleSegmentConnError() { return handleSegmentConnError; },
get probeCdnLatency() { return probeCdnLatency; }
};
}
