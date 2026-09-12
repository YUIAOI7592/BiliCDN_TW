// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createBakeoff(deps) {
const THRPT_PROBE_BYTES      = 384 * 1024

const THRPT_PROBE_MIN_BYTES  = 64 * 1024

const THRPT_PROBE_TIMEOUT    = 3000

const THRPT_BAKEOFF_COOLDOWN = 90 * 1000

const THRPT_SAMPLE_FRESH_MS  = 60 * 1000

const switchMarginFor = (samples) => {
    if (samples >= 4) return 1.15
    if (samples >= 2) return 1.30
    return 1.60
}

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

let bakeoffNullStreak    = 0

let bakeoffEpoch         = 0

let bakeoffAbortController = null

let crossTabShouldBakeoff = () => true

let onBakeoffStart        = () => {}

const probeRouteThroughput = (candidate, sampleUrl, probeBytes, externalSignal, recordSample = null) => new Promise((resolve) => {
    const runtimeToken = deps.captureRuntimeGeneration()
    const cdn = candidate?.host
    const native = candidate?.type === 'native-signed'
    const sample = native ? candidate.url : sampleUrl
    const sampleContext = native ? candidate : deps.captureRouteContext(sample)
    const sampleAllowed = () => deps.isRouteSampleAllowed(sample, sampleContext)
    const eligible = deps.isRuntimeGenerationActive(runtimeToken) && (native || (deps.isValidCustomCdnHost(cdn)
        && !deps.blacklistSet.has(cdn) && !deps.knownDeadHosts.has(cdn) && !deps.matchesExclude(cdn) && !deps.isPresumedDnsFailHost(cdn)))
    const decision = native ? null : deps.decideMediaRewrite(sampleUrl)
    // Native routes are exact signed URLs from the current representation group. Never synthesize them.
    const target = eligible && sampleAllowed()
        ? native ? candidate.url : decision.action === 'rewrite' ? deps.replaceUrlHost(sampleUrl, cdn) : null : null
    if (!target) return resolve({ status: 'ineligible', accepted: false, bytes: 0 })
    const wantBytes = Math.min(probeBytes || THRPT_PROBE_BYTES, 768 * 1024)
    const ctrl = new AbortController()
    const t0 = performance.now()
    let ttfb = 0, bytes = 0, settled = false, reader = null, to = null, successResponse = false
    const signals = [...new Set([externalSignal, runtimeToken.signal].filter(Boolean))]
    const active = () => deps.isRuntimeGenerationActive(runtimeToken) && sampleAllowed() && !signals.some(signal => signal.aborted)
    const finish = (completion) => {
        if (settled) return
        settled = true
        deps.clearRuntimeTimeout(to)
        signals.forEach(signal => signal.removeEventListener('abort', onAbort))
        // Complete independently of the transport's reaction to abort/cancel.
        try { Promise.resolve(reader?.cancel(completion)).catch(() => {}) } catch {}
        try { ctrl.abort(completion) } catch {}
        let result = { status: completion, completion, accepted: false, bytes }
        if (!active()) result.status = result.completion = 'cancelled'
        else if (completion === 'forbidden') result.forbidden = true
        else if (successResponse && (completion === 'complete' || completion === 'timeout')) {
            const durationMs = Math.max(1, performance.now() - t0 - ttfb)
            let sample = native
                ? { accepted: bytes >= 128 * 1024 && durationMs >= 5, bytes, durationMs,
                    mbps: bytes * 8 / durationMs / 1000 }
                : { accepted: false }
            if (!native && bytes >= THRPT_PROBE_MIN_BYTES && recordSample) sample = recordSample(cdn, bytes, durationMs, Math.max(1, ttfb))
            result.status = sample.accepted ? (completion === 'timeout' ? 'partial' : 'complete')
                : bytes >= THRPT_PROBE_MIN_BYTES ? 'latency-only' : 'insufficient'
            result.accepted = !!sample.accepted
            if (sample.accepted) {
                result.cdn = cdn
                result.host = cdn
                result.type = native ? 'native-signed' : 'catalog-generated'
                result.durationMs = durationMs
                result.mbps = sample.mbps
                result.ttfbMs = Math.max(1, ttfb)
                result.partial = completion === 'timeout'
                if (result.partial) deps.redirectStats.partialProbeSamples = Math.min(10000, deps.redirectStats.partialProbeSamples + 1)
            }
        }
        if (active()) deps.DiagnosticLog.record('measurement', { host: cdn, reason: result.status, bytes, received: result.accepted })
        resolve(result)
    }
    const onAbort = () => finish('cancelled')
    if (!active()) return finish('cancelled')
    signals.forEach(signal => signal.addEventListener('abort', onAbort, { once: true }))
    to = deps.scheduleRuntimeTimeout(() => finish('timeout'), THRPT_PROBE_TIMEOUT)
    Promise.resolve().then(() => {
        if (settled || !active()) return null
        return deps.interceptNetResponse.rawFetch(target, {
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

// Historical test/debug name retained for the catalog-only probe contract.
const probeCdnThroughput = (cdn, sampleUrl, probeBytes, externalSignal) =>
    probeRouteThroughput({ type: 'catalog-generated', host: cdn }, sampleUrl, probeBytes, externalSignal,
        (_host, bytes, durationMs, ttfb) => {
            const sample = deps.recordCdnThroughput(cdn, bytes, durationMs, deps.playbackRateState.effectiveRate)
            deps.recordCdnLatency(cdn, ttfb)
            return sample
        })

const getPlayingCdnHost = () => {
    return deps.getObservedRouteHost() || deps.getAttributedVideoHost()
}

const getWarmCdnHost = () => getPlayingCdnHost() || deps.resolvedCdn || deps.lastChosenCdn || deps.activeCdnList[0] || null

const STARTUP_MIN_BUFFER_SEC = 12

const MAX_STARTUP_DEFERS     = 3

let bakeoffStartupDefers     = 0

const isStartupBuffering = () => {
    try {
        const st = deps.Watchdog.stats()
        if (!st || st.readyState < 0) return false   // 頁面上沒有播放器，無從判斷
        if (st.paused) return false                  // 使用者還沒開始播，賽馬不會跟誰搶
        return st.bufferAheadSec < STARTUP_MIN_BUFFER_SEC
    } catch { return false }
}

const runThroughputBakeoff = async (sampleUrl, skipIfFast = true, trustedRequest = null) => {
    const skipped = reason => { deps.DiagnosticLog.record('measurement', { reason, requested: false }); return undefined }
    if (deps.disabled || deps.resolvedCdn || bakeoffRunning) return skipped(deps.disabled ? 'disabled' : deps.resolvedCdn ? 'fixed' : 'busy')
    if (deps.inSeekGrace()) return skipped('seek-grace')
    if (!sampleUrl || !deps.isRouteSampleAllowed(sampleUrl)) return skipped('no-segment')
    const sampleContext = deps.captureRouteContext(sampleUrl)
    // 綁定節點的串流換 host 必定 403，測了也拿不到任何有效樣本（見 hostLockedStreams）
    if (deps.isHostLockedStream(sampleUrl)) return skipped('host-lock')
    const runtimeToken = deps.captureRuntimeGeneration()
    if (!deps.isRuntimeGenerationActive(runtimeToken)) return
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
            bakeoffTimer = deps.scheduleRuntimeTimeout(() => {
                bakeoffTimer = null
                if (deferEpoch !== bakeoffEpoch) return
                runThroughputBakeoff(lastSampleSegmentUrl).catch(deps.reportMeasurementFailure())
            }, 2000)
        }
        return
    }

    // 現用節點剛好有新鮮的真實吞吐樣本、且遠高於這支片子實際需要的速度時，
    // 賽馬本身（連續打 1~4 顆候選、每顆最多 768KB）沒有急迫性，反而會在換片起播
    // 最搶頻寬的當下再搶一手頻寬（4K/長片/無損正是這種最禁不起搶的情境）。跳過。
    const preCheckHost = getPlayingCdnHost() || getWarmCdnHost()
    const preHealth    = preCheckHost && deps.cdnHealth[preCheckHost]
    if (skipIfFast && preHealth && preHealth.samples && preHealth.lastThroughputAt
        && (Date.now() - preHealth.lastThroughputAt) < THRPT_SAMPLE_FRESH_MS
        && preHealth.ewmaMbps >= deps.getRequiredStreamMbps(undefined, 'startup') * 1.5) {
        return skipped('healthy-cache')
    }

    // 多分頁互斥：優先用 Web Locks API（同源真互斥鎖，分頁關閉
    // 時瀏覽器自動釋放）。原本只用 BroadcastChannel 心跳判斷「其他分頁是否在測速」，
    // 但那只能盡量避免——兩個分頁幾乎同時決定要測速時，心跳訊息還沒送達對方就都已經
    // 開始了。ifAvailable:true 拿不到鎖立刻回呼 null，不排隊等待。
    if (navigator.locks && navigator.locks.request) {
        return navigator.locks.request('bilicdn-bakeoff', { ifAvailable: true }, (lock) => {
            if (!lock) return skipped('busy')
            if (!deps.isRuntimeGenerationActive(runtimeToken)) return
            return doBakeoff(sampleUrl, runtimeToken, sampleContext)
        })
    }
    if (!crossTabShouldBakeoff()) return  // 沒有 Web Locks：只保留既有提示，不冒充權威互斥
    return doBakeoff(sampleUrl, runtimeToken, sampleContext)
}

const doBakeoff = async (sampleUrl, runtimeToken = deps.captureRuntimeGeneration(), sampleContext = deps.captureRouteContext(sampleUrl)) => {
    if (!deps.isRuntimeGenerationActive(runtimeToken) || !deps.isRouteSampleAllowed(sampleUrl, sampleContext)) return
    deps.DiagnosticLog.record('measurement', { reason: 'accepted', requested: true })
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
        const catalogCandidates  = deps.PREFERRED_CDN_LIST
            .filter(c => !deps.blacklistSet.has(c) && !deps.knownDeadHosts.has(c) && !deps.isCdnSoftBlocked(c) && !deps.matchesExclude(c))
            // ★ 這一行是使用者實測回報的 bug 修正：賽馬只擋 knownDeadHosts，但「已知在台灣
            // 不解析、還沒被標死」的節點不在其中，於是賽馬會拿**真實 segment URL**去打它們，
            // console 出現 ERR_NAME_NOT_RESOLVED（堆疊 doBakeoff → probeCdnThroughput）。
            // 而且傷害不只是紅字：下面那個迴圈是**逐一 await**，每顆死節點都要卡滿
            // THRPT_PROBE_TIMEOUT（3 秒）才輪到下一顆 —— 兩顆就是 6 秒，這 6 秒本來
            // 應該用來測真正可用的節點，時機還正好落在起播附近。
            .filter(c => !deps.isPresumedDnsFailHost(c))
            .filter(c => {
                if (c === playingHost) return false // 正在播放的節點已由實際 segment 量測取樣
                const h = deps.cdnHealth[c]
                return !(h && h.samples && h.lastThroughputAt
                    && (now - h.lastThroughputAt) < THRPT_SAMPLE_FRESH_MS)
            })
            // v1.4.0：先測從未量過的節點，其次測最久沒有吞吐樣本的節點。
            // 舊版直接 slice 前四名；90 秒冷卻大於 60 秒 freshness，前四名每輪都會重新入選，
            // 排在後面的候選可能永遠拿不到一次樣本。
            .sort((a, b) => {
                const ah = deps.cdnHealth[a], bh = deps.cdnHealth[b]
                const aNever = !(ah && ah.samples && ah.lastThroughputAt)
                const bNever = !(bh && bh.samples && bh.lastThroughputAt)
                if (aNever !== bNever) return aNever ? -1 : 1
                return ((ah && ah.lastThroughputAt) || 0) - ((bh && bh.lastThroughputAt) || 0)
            })
        const nativeCandidate = deps.getNativeProbeCandidate(sampleUrl)
        // Exploration consumes one existing slot; total candidate count remains capped at four.
        const candidates = catalogCandidates.slice(0, nativeCandidate ? 3 : 4)
            .map(host => ({ type: 'catalog-generated', host }))
        if (nativeCandidate) candidates.push(nativeCandidate)

        // 高碼率（4K）用較大測速量，分得出節點快慢；一般畫質維持小量省頻寬
        const probeBytes = (deps.currentStreamBitsPerSec / 1e6 >= 12) ? 768 * 1024 : THRPT_PROBE_BYTES
        const ok = []
        const outcomes = []
        for (const candidate of candidates) {
            if (!deps.isRuntimeGenerationActive(runtimeToken) || myEpoch !== bakeoffEpoch || !deps.isRouteSampleAllowed(sampleUrl, sampleContext)) break
            // 這條串流已知綁定節點 → 剩下的候選不用試了，每一台都會 403（見 hostLockedStreams）
            if (deps.isHostLockedStream(sampleUrl)) break
            const r = candidate.type === 'native-signed'
                ? await probeRouteThroughput(candidate, sampleUrl, probeBytes, mySignal)
                : await probeCdnThroughput(candidate.host, sampleUrl, probeBytes, mySignal)
            // 換 host 拿到 403：登記這條串流，立刻中止本輪。不中止的話剩下的候選會
            // 一顆一顆各再產生一行 403 紅字（使用者實測一輪就看到 3 行）。
            if (!deps.isRuntimeGenerationActive(runtimeToken) || myEpoch !== bakeoffEpoch || !deps.isRouteSampleAllowed(sampleUrl, sampleContext)) return { status: 'cancelled', outcomes }
            if (r) outcomes.push({ type: candidate.type, host: candidate.host, ...r })
            if (r && r.forbidden) {
                if (candidate.type === 'native-signed') deps.noteNativeRouteFailure({ route: candidate }, candidate.url, 403, 'http')
                else { deps.noteHostLockedStream(sampleUrl); break }
            }
            if (r && r.accepted) {
                if (candidate.type === 'native-signed') {
                    const recorded = deps.recordNativeProbe(candidate, r, r.ttfbMs)
                    if (recorded?.accepted) ok.push({ ...r, native: true })
                } else ok.push(r)
            }
        }

        // 測速被防盜鏈擋掉時 probeCdnThroughput 只會靜默回 null，賽馬形同失效但完全沒有
        // 訊息。連續 3 輪「有候選但全部失敗」才示警，避免單次網路抖動誤報。
        if (!deps.isRuntimeGenerationActive(runtimeToken)) return
        if (candidates.length) {
            if (ok.length === 0) {
                bakeoffNullStreak++
                if (bakeoffNullStreak === 3) {
                    deps.err('[Bakeoff] 連續 3 輪測速全部失敗，可能被 CDN 防盜鏈擋下。'
                        + '可由 Tampermonkey 選單開啟 verbose 觀察，或回報此訊息。')
                }
            } else {
                bakeoffNullStreak = 0
            }
        }

        // 這輪賽馬所屬的片子已經被切掉了：拿到的樣本仍照樣入帳（對 CDN 的真實吞吐量測量，
        // 換到哪片都算數），但跳過「中途切換舊主機」這步——playingHost 是舊片的、新片可能
        // 早就用別的 CDN，逼著重導反而多繞一手。新片自己的 scheduleBakeoff 會另外排一輪。
        const stale = myEpoch !== bakeoffEpoch || !deps.isRuntimeGenerationActive(runtimeToken)
        if (stale) return

        // 確保探到的候選在 activeCdnList 內，否則 getHealthyCdnList 不會納入排序
        ok.filter(r => !r.native).forEach(r => {
            if (!deps.activeCdnList.includes(r.cdn) && !deps.blacklistSet.has(r.cdn) && !deps.knownDeadHosts.has(r.cdn)) {
                deps.activeCdnList.push(r.cdn)
            }
        })

        // 只重新排序，不縮減集合 —— 跟 reorderCdnsByLatency 裡同一個修正
        //（getHealthyCdnList 的瞬時篩選條件不該寫回候選池母體，否則池子只會越來越薄）。
        // 這裡當初漏改了，是候選池即使修過還是會變薄的第二個來源。
        const ranked = deps.getHealthyCdnList()
        if (ranked.length) {
            const rest = deps.activeCdnList.filter(c => !ranked.includes(c))
            deps.activeCdnList.length = 0
            ranked.forEach(c => deps.activeCdnList.push(c))
            rest.forEach(c => deps.activeCdnList.push(c))
        }

        // Measurements update ranking for the next legal selection boundary.
        // A faster result is not evidence that a healthy, buffered stream should
        // be disrupted, so bakeoff never creates a forced redirect or grants
        // switch grace. Verified transport failure and Watchdog recovery retain
        // their existing authority to change the route.
        try { GM_setValue(deps.PROBE_CACHE_KEY, JSON.stringify({ t: Date.now(), list: [...deps.activeCdnList] })) } catch {}
        const status = ok.length ? 'completed' : outcomes.some(r => r.forbidden) ? 'forbidden'
            : outcomes.some(r => r.status === 'latency-only') ? 'latency-only'
            : candidates.length ? 'failed' : 'no-candidates'
        deps.setNativeBakeoffDiagnostics(outcomes)
        return { status, outcomes, samples: ok.length }
    } finally {
        if (runtimeToken.signal) runtimeToken.signal.removeEventListener('abort', onRuntimeAbort)
        bakeoffRunning = false
        if (bakeoffAbortController && bakeoffAbortController.signal === mySignal) bakeoffAbortController = null
    }
}

const scheduleBakeoff = (sampleUrl) => {
    if (sampleUrl) lastSampleSegmentUrl = sampleUrl
    if (deps.disabled || deps.resolvedCdn || bakeoffTimer) return
    // 4K 開播當下最吃頻寬，測速會跟「初始緩衝」搶頻寬而拖慢起播 →
    // 4K 改為延後較久（先讓畫面開起來、緩衝拉起再測速）；一般畫質維持較短延遲。
    const highBitrate = deps.currentStreamBitsPerSec / 1e6 >= 12
    const myEpoch = bakeoffEpoch
    bakeoffTimer = deps.scheduleRuntimeTimeout(() => {
        bakeoffTimer = null
        // 換片會在 onSpaNavigate 主動清掉這個 timer，理論上不會用過期 epoch 觸發；
        // 這裡多一層防呆，避免任何遺漏路徑用舊片樣本跑掉這一輪賽馬名額。
        if (myEpoch !== bakeoffEpoch) return
        // 一律用當下最新樣本（而非排程當下 closure 住的那個），避免同一支片內
        // 中途換畫質/CDN 導致 sampleUrl 過期時仍打舊 URL。
        runThroughputBakeoff(lastSampleSegmentUrl).catch(deps.reportMeasurementFailure())
    }, highBitrate ? 4000 : 1500)
}
const noteActiveSample = (sampleUrl) => {
    if (typeof sampleUrl === 'string' && sampleUrl) lastSampleSegmentUrl = sampleUrl
}
return { /* TEST_EXPORTS:bakeoff */
get TRUSTED_BAKEOFF_MIN_GAP() { return TRUSTED_BAKEOFF_MIN_GAP; },
get trustedBakeoffLastAt() { return trustedBakeoffLastAt; },
get trustedBakeoffRequest() { return trustedBakeoffRequest; },
get setLastBakeoffAt() { return setLastBakeoffAt; },
get bakeoffRunning() { return bakeoffRunning; }, set bakeoffRunning(value) { bakeoffRunning = value; },
get bakeoffTimer() { return bakeoffTimer; }, set bakeoffTimer(value) { bakeoffTimer = value; },
get lastSampleSegmentUrl() { return lastSampleSegmentUrl; }, set lastSampleSegmentUrl(value) { lastSampleSegmentUrl = value; },
get bakeoffEpoch() { return bakeoffEpoch; }, set bakeoffEpoch(value) { bakeoffEpoch = value; },
get bakeoffAbortController() { return bakeoffAbortController; }, set bakeoffAbortController(value) { bakeoffAbortController = value; },
get crossTabShouldBakeoff() { return crossTabShouldBakeoff; }, set crossTabShouldBakeoff(value) { crossTabShouldBakeoff = value; },
get onBakeoffStart() { return onBakeoffStart; }, set onBakeoffStart(value) { onBakeoffStart = value; },
get getPlayingCdnHost() { return getPlayingCdnHost; },
get getWarmCdnHost() { return getWarmCdnHost; },
get bakeoffStartupDefers() { return bakeoffStartupDefers; }, set bakeoffStartupDefers(value) { bakeoffStartupDefers = value; },
get isStartupBuffering() { return isStartupBuffering; },
get runThroughputBakeoff() { return runThroughputBakeoff; },
get noteActiveSample() { return noteActiveSample; },
get scheduleBakeoff() { return scheduleBakeoff; }
};
}
