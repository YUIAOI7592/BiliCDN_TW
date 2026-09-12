// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createWatchdog(deps) {
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
    // 多次嘗試不代表播放器已換路，也不能證明問題不在 CDN。保留有限嘗試預算，
    // 僅撤回仍由本輪 Watchdog 擁有的推測性健康變更，不能覆蓋較新的 Transport 失敗。
    // 選路/預連線是建議，不保證瀏覽器建立或拆除 socket。
    const SWITCH_BURST_MAX    = 3
    const SWITCH_BURST_WINDOW = 60 * 1000
    const SWITCH_BREAKER_MS   = 90 * 1000
    let switchTimes        = []
    let switchBreakerUntil = 0
    let burstPunished      = []

    const penaltyFields = ['failures', 'lastFailureAt', 'softBlocks', 'lastSoftBlockAt', 'lastSoftBlockReason']
    const penaltyState = host => ({ ...Object.fromEntries(penaltyFields.map(k => [k, deps.cdnHealth[host]?.[k]])),
        until: deps.cdnSoftBlockUntil[host] })
    const retractBurstPenalties = () => {
        const records = burstPunished; burstPunished = []
        const hosts = new Set()
        records.reverse().forEach(({ host, before, after, at }) => {
            if (Date.now() - at >= SWITCH_BURST_WINDOW) return
            const current = penaltyState(host), h = deps.cdnHealth[host]
            if (!h || [...penaltyFields, 'until'].some(k => current[k] !== after[k])) return
            penaltyFields.forEach(k => { if (before[k] === undefined) delete h[k]; else h[k] = before[k] })
            if (before.until === undefined) delete deps.cdnSoftBlockUntil[host]
            else deps.cdnSoftBlockUntil[host] = before.until
            hosts.add(host)
            if (!deps.activeCdnList.includes(host) && !deps.blacklistSet.has(host)
                && !deps.knownDeadHosts.has(host) && deps.PREFERRED_CDN_LIST.includes(host)) {
                deps.activeCdnList.push(host)
            }
        })
        if (hosts.size) {
            deps.scheduleCdnHealthSave()
            deps.promoteBestCdnNow()
        }
        return [...hosts]
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
    let observedSwitchCount = 0
    let sessionStallCount  = 0
    let sessionHardFailCount = 0
    let recoveryObservation = null
    let recoverySequence = 0
    const noteVideoTransport = (previous, observation) => {
        if (!deps.freshMediaObservation(previous) || !observation.host || !previous.host || observation.host === previous.host) return
        observedSwitchCount = Math.min(Number.MAX_SAFE_INTEGER, observedSwitchCount + 1)
        deps.DiagnosticLog.record('recovery', { reason: 'received', originalHost: previous.host, finalHost: observation.host })
    }
    const interruptRecovery = () => {
        if (recoveryObservation) deps.DiagnosticLog.record('recovery', { ...recoveryObservation, outcome: 'interrupted' }, true)
        recoveryObservation = null
    }
    const observeRecovery = (state, now) => {
        const r = recoveryObservation
        if (!r) return
        if (r.generation !== deps.runtimeGeneration || r.epoch !== deps.playinfoEpoch
            || !state.valid || state.paused || state.seeking || state.ended || state.errorCode || deps.inSeekGrace()) {
            interruptRecovery(); return
        }
        if (now < switchGraceUntil) return
        r.count++
        const progress = state.currentTime > r.currentTime + 0.05 || state.bufferAheadSec > r.bufferAheadSec + 0.05
        if (progress || r.count >= 3) {
            deps.DiagnosticLog.record('recovery', { ...r, currentTime: state.currentTime, bufferAheadSec: state.bufferAheadSec,
                finalHost: deps.getAttributedVideoHost(), outcome: progress ? 'progress' : 'no-progress' }, true)
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
        if (deps.disabled || !entry || typeof entry.name !== 'string'
            || !entry.name || entry.name.length > PERFORMANCE_ENTRY_URL_MAX) return
        if (!/\.m4s($|\?)/i.test(entry.name) && !/\.flv($|\?)/i.test(entry.name)) return
        // 這個 segment 若已經被 XHR/fetch 攔截層直接量過真實位元組（見 noteSegmentBytes /
        // fetch 攔截的 content-length 分支），這裡就跳過，避免同一包重複計入兩次。
        // 這條路徑只在對方量不到時（例如非我方攔截的請求）當備援。
        if (deps.wasSegmentAccounted(entry.name)) return
        const bytes = Number(entry.transferSize || entry.encodedBodySize || 0)
        if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > PERFORMANCE_ENTRY_BYTES_MAX) return
        try {
            const h = new URL(entry.name).hostname
            if (!deps.TRUSTED_CDN_CATALOG_SET.has(h)) return
            deps.observeMediaTransfer(deps.captureMediaRequest(entry.name), entry.name, bytes, 'performance')
            totalBytes = Math.min(Number.MAX_SAFE_INTEGER, totalBytes + bytes)
            perCdnBytes[h] = Math.min(Number.MAX_SAFE_INTEGER, (perCdnBytes[h] || 0) + bytes)
            // 用最新觀察到的播放倍速計算 required Mbps，避免倍速下少抓 slow
            const v = getVideo()
            const rate = v
                ? deps.syncPlaybackRateFromVideo(v, 'performance').effectiveRate
                : deps.playbackRateState.effectiveRate
            // entry.duration 含 redirect/DNS/TCP/TLS/TTFB，跟 XHR/fetch 路徑（只算純傳輸時間）
            // 量綱不一致，混在同一個 EWMA 裡會系統性高估這條路徑的速度。優先用
            // responseEnd-responseStart（純傳輸），兩者缺一（未送 Timing-Allow-Origin）才退回 duration。
            const dur = (entry.responseEnd && entry.responseStart)
                ? (entry.responseEnd - entry.responseStart)
                : (entry.duration || 0)
            if (Number.isFinite(dur) && dur > 0 && dur <= PERFORMANCE_ENTRY_DURATION_MAX_MS) {
                deps.recordCdnThroughput(h, bytes, dur, rate)
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
        deps.bumpSeekGrace()
    }

    // 任何「換到另一個節點」之後都該呼叫：重置停滯累計與 buffered 基準，
    // 並給新連線一段寬限。Watchdog 自己換節點時會呼叫，賽馬中途切換也會（見 doBakeoff）。
    const noteCdnSwitched = () => {
        stallCount = 0
        lastBufferedEnd = 0
        byteSamples = []
        switchGraceUntil = Date.now()
            + ((deps.currentStreamBitsPerSec / 1e6 >= 12) ? STARTUP_GRACE_MS_HIGH : STARTUP_GRACE_MS)
    }

    const switchCdn = (reason) => {
        if (deps.inSeekGrace()) { deps.DiagnosticLog.setDecision('seek-grace'); return }
        const nowSw = Date.now()
        if (nowSw < switchBreakerUntil) { deps.DiagnosticLog.setDecision('breaker', { remainingMs: switchBreakerUntil - nowSw }); return }
        if (nowSw - lastSwitchAt < SWITCH_COOL) { deps.DiagnosticLog.setDecision('cooldown', { remainingMs: SWITCH_COOL - (nowSw - lastSwitchAt) }); return }

        // 相同的嘗試預算；沒有觀察到換路時也不能無限重試。已驗證的 Transport 失敗另走受限修復。
        switchTimes = switchTimes.filter(t => nowSw - t < SWITCH_BURST_WINDOW)
        if (switchTimes.length >= SWITCH_BURST_MAX) {
            switchBreakerUntil = nowSw + SWITCH_BREAKER_MS
            switchTimes = []
            const retracted = retractBurstPenalties()
            deps.DiagnosticLog.record('breaker', { remainingMs: SWITCH_BREAKER_MS, count: retracted.length }, true)
            deps.log('[Watchdog] ' + Math.round(SWITCH_BURST_WINDOW / 1000) + ' 秒內已嘗試修復 '
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
        const recoveryState = deps.readPlaybackDiagnostic()
        recoveryObservation = { actionId: ++recoverySequence, generation: deps.runtimeGeneration, epoch: deps.playinfoEpoch,
            count: 0, currentTime: recoveryState.currentTime, bufferAheadSec: recoveryState.bufferAheadSec,
            originalHost: deps.getAttributedVideoHost() }
        deps.DiagnosticLog.record('recovery', { ...recoveryObservation, outcome: 'attempt' }, true)

        if (deps.HttpDnsAutoPilot.onStall(reason, getWatchdogSample())) {
            deps.DiagnosticLog.record('recovery', { actionId: recoverySequence, reason: 'httpdns', reselected: true }, true)
            deps.promoteBestCdnNow()
            deps.beginRouteRecovery?.('watchdog-httpdns', deps.getAttributedVideoHost())
            deps.reorderCdnsByLatency(true).catch(deps.reportMeasurementFailure())
            return
        }

        // 只懲罰「最近實際在拉 segment」的元兇，避免歷史用過的 CDN 被連坐。
        // 排除 Akamai/MCDN/PCDN/已黑名單/已標死 等本來就會走 fallback 的 host。
        const playingHost = deps.getAttributedVideoHost()
        const culprit = playingHost && !deps.isUnstableCdnHost(playingHost)
            && !deps.blacklistSet.has(playingHost) && !deps.knownDeadHosts.has(playingHost) ? playingHost : null

        if (culprit) {
            const before = penaltyState(culprit)
            deps.recordCdnPenalty(culprit, false)
            deps.softBlockCdn(culprit, reason, deps.CDN_SOFT_BLOCK_MS)
            burstPunished = burstPunished.filter(p => nowSw - p.at < SWITCH_BURST_WINDOW)
            burstPunished.push({ host: culprit, before, after: penaltyState(culprit), at: nowSw })
            if (burstPunished.length > SWITCH_BURST_MAX) burstPunished.shift()
            deps.log('[Watchdog] 切換觸發：' + reason + '，懲罰 ' + culprit.split('.')[0])
        }
        deps.DiagnosticLog.record('recovery', { actionId: recoverySequence, reason: culprit ? 'attributed' : 'no-attribution',
            host: culprit, punished: !!culprit, reselected: true, preconnect: true }, true)

        try { GM_deleteValue(deps.PROBE_CACHE_KEY) } catch {}
        deps.promoteBestCdnNow()
        deps.beginRouteRecovery?.('watchdog', playingHost)
        // 保留原本的預熱提示數與時機。現用／建議節點只補缺提示；
        // 是否建立或保留連線由瀏覽器決定，不把 DOM 操作當 socket 控制。
        const warmHost = playingHost || deps.getWarmCdnHost()
        const warmTargets = deps.getHealthyCdnList().slice(0, 3).filter(h => h !== warmHost)
        deps.preconnectBatch(warmTargets, true)
        if (warmHost) deps.preconnectCdn(warmHost, false)
        // 延遲探測（探測 RTT）本身也在搶頻寬，且卡頓當下最有參考價值的是賽馬（真實 segment）。
        // 延後 10 秒、且確認不在 seek 預熱窗內才跑，讓賽馬/換節點先把頻寬用在刀口上。
        // reorderCdnsByLatency 內部有 bakeoffRunning 互斥（見該函式），4K 賽馬最長可能跑
        // 到 ~12 秒，剛好可能跟這裡的 10 秒延遲重疊——若當下還在跑，reorderCdnsByLatency
        // 會直接靜默放棄且不會重試。這裡補一次有限重試，避免整個延遲探測憑運氣决定有沒有跑。
        // seek 預熱窗（inSeekGrace）撞上同一個時間點時道理相同，一併納入重試，不然使用者
        // 剛好在第 10 秒拖曳時間軸，這次延遲探測就會被無聲放棄、不會像 bakeoffRunning
        // 那樣有重試機會。
        const scheduleDelayedReorder = (retriesLeft) => {
            deps.scheduleRuntimeTimeout(() => {
                if ((deps.inSeekGrace() || deps.bakeoffRunning) && retriesLeft > 0) { scheduleDelayedReorder(retriesLeft - 1); return }
                if (deps.inSeekGrace()) return
                deps.reorderCdnsByLatency(true).catch(deps.reportMeasurementFailure())
            }, 10000)
        }
        scheduleDelayedReorder(2)
        // 4K：卡頓多半是節點速度不夠，立刻實測各節點下載速度，確保切到真的夠快的節點
        // Watchdog 已經判定停滯才會走到這裡，不能被「現用節點目前還算快」的捷徑擋掉。
        if (deps.currentStreamBitsPerSec / 1e6 >= 12 && deps.lastSampleSegmentUrl) {
            deps.runThroughputBakeoff(deps.lastSampleSegmentUrl, false, deps.trustedBakeoffRequest('watchdog')).catch(deps.reportMeasurementFailure())
        }
        // 不 nudge currentTime：跟 bili player 內建 Stuck:Rescue 搶會 buffer 抖動
        // 軟封鎖 + 下次 segment 走攔截層改 host 就夠
    }

    const tick = () => {
        if (deps.disabled) { deps.DiagnosticLog.setDecision('disabled'); return }
        const v = getVideo()
        if (!v) { deps.resetPlaybackRateState(); stallCount = 0; interruptRecovery(); deps.DiagnosticLog.setDecision('no-video'); return }
        const playback = deps.readPlaybackDiagnostic(v)
        const unavailable = !playback.valid ? 'invalid-state'
            : playback.errorCode ? 'media-error'
            : playback.ended || (playback.duration > 0 && playback.currentTime >= playback.duration) ? 'ended'
            : playback.paused ? 'paused' : playback.seeking ? 'seeking'
            : playback.readyState === 0 ? 'no-metadata' : null
        if (unavailable) {
            stallCount = 0; lastCurrentTime = playback.currentTime || 0
            lastBufferedEnd = playback.currentTime || 0; lastTickAt = Date.now()
            byteSamples = []; interruptRecovery(); deps.DiagnosticLog.setDecision(unavailable, playback); return
        }

        // v1.3.3：先把碼率校正成「實際正在播的畫質」，下面所有門檻
        // （highBitrate / minBps / minAheadEff / targetBytes）才會是對的。
        deps.syncStreamBitrateFromVideo(v)

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
            deps.DiagnosticLog.setDecision('background-gap', { waitMs: sinceLast })
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
        const rateState = deps.syncPlaybackRateFromVideo(v, 'watchdog')
        const playRate = rateState.observedRate
        const targetBytes = deps.getBufferTargetBytes(rateState.effectiveRate)

        if (!reached && totalBytes >= targetBytes) {
            reached = true
            deps.HttpDnsAutoPilot.onTargetReached(getWatchdogSample())
        }

        deps.HttpDnsAutoPilot.tick(getWatchdogSample())

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
            deps.DiagnosticLog.setDecision('player-nudge')
            return
        }
        // seek 到未載入區段時，播放器通常會 abort 舊請求並重建新 segment；
        // 這段時間 bps=0 是正常狀態，不能當作 CDN 卡頓。
        if (deps.inSeekGrace()) {
            stallCount = 0
            lastBufferedEnd = be
            interruptRecovery(); deps.DiagnosticLog.setDecision('seek-grace')
            return
        }
        // 自救後短時間內不重複判定卡頓
        if (Date.now() - lastNudgeDetectAt < 3000) {
            stallCount = 0
            lastBufferedEnd = be
            deps.DiagnosticLog.setDecision('nudge-grace', { remainingMs: 3000 - (Date.now() - lastNudgeDetectAt) })
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
        const streamMbps  = deps.currentStreamBitsPerSec / 1e6
        const highBitrate = streamMbps >= 12
        const recheckEff  = highBitrate ? 20 : REACHED_RECHECK_BUFFER_SEC
        const stallMaxEff = highBitrate ? 2 : STALL_MAX

        // 剛開播/換片幾秒內的 slow-start 緩衝期：只累積 lastBufferedEnd 基準，不判定停滯，
        // 讓連線先把速度跑起來，避免才剛連上就急著換節點。
        const graceMs = highBitrate ? STARTUP_GRACE_MS_HIGH : STARTUP_GRACE_MS
        if (Date.now() - startedAt < graceMs || Date.now() < switchGraceUntil) {
            stallCount = 0
            lastBufferedEnd = be
            deps.DiagnosticLog.setDecision(Date.now() < switchGraceUntil ? 'switch-grace' : 'startup-grace', {
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
            deps.DiagnosticLog.setDecision('target-reached')
            return
        }
        // 4K：門檻 = 即時碼率本身（下載低於它必定耗盡緩衝）；其他畫質沿用較寬鬆的需求值
        const requiredBps = deps.getWatchdogRequiredBps(streamMbps, rateState.effectiveRate, highBitrate)
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
            deps.DiagnosticLog.setDecision(lowData ? 'low-data' : stalled ? 'buffered-stall' : 'too-slow', {
                stallCount, bufferAheadSec: bufferAhead, readyState: v.readyState,
            })
            if (stallCount >= stallMaxEff) {
                stallCount = 0
                sessionStallCount++
                switchCdn(lowData ? 'low-data：資料不足且播放進度停滯' : stalled ? 'buffered 停滯' : 'bps=' + Math.round(bps / 1024) + 'KB/s 低於需求')
            }
        } else {
            stallCount = 0
            deps.DiagnosticLog.setDecision('healthy', { bufferAheadSec: bufferAhead })
        }
    }

    return {
        // Fetch／XHR 的進度位元組沒有完整 duration，故不更新單節點吞吐 EWMA；
        // 仍計入總量，讓媒體位元組觀察與 Watchdog 的 bps 判斷保持一致。
        // 瀏覽器快取重送也可能出現在這裡，因此它不是 wire bytes 計數器。
        noteExternalBytes(host, bytes) {
            if (deps.disabled || !Number.isSafeInteger(bytes) || bytes <= 0 || bytes > 256 * 1024 * 1024) return
            totalBytes = Math.min(Number.MAX_SAFE_INTEGER, totalBytes + bytes)
            if (deps.TRUSTED_CDN_CATALOG_SET.has(host)) {
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
            } catch { deps.DiagnosticLog.fault('watchdog') }
            timer = setInterval(() => { try { tick() } catch { deps.DiagnosticLog.fault('watchdog') } }, TICK_MS)
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
            sessionSwitchCount = 0; observedSwitchCount = 0; sessionStallCount = 0; sessionHardFailCount = 0
            deps.resetMediaDelivery()
            switchTimes = []; switchBreakerUntil = 0; burstPunished = []; switchGraceUntil = 0
            cachedVideo = null
            Object.keys(perCdnBytes).forEach(k => delete perCdnBytes[k])
        },
        stats() {
            const state = deps.readPlaybackDiagnostic()
            const targetBytes = deps.getBufferTargetBytes()
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
                    Object.entries(deps.cdnHealth)
                        .filter(([, h]) => h.samples > 0)
                        .map(([k, h]) => [k.split('.')[0], +h.ewmaMbps.toFixed(2)])
                ),
                requiredMbps:  +deps.getRequiredStreamMbps().toFixed(2),
                cdnScore:      Object.fromEntries(
                    Object.keys(deps.cdnHealth)
                        .filter(k => deps.cdnHealth[k].samples > 0)
                        .map(k => [k.split('.')[0], +deps.getCdnHealthScore(k).toFixed(2)])
                ),
                elapsedSec:    Math.round((Date.now() - startedAt) / 1000),
                // switchCount 是相容欄位，計的是嘗試；影片請求換 host 另行計數，不宣稱已消費/解碼。
                switchCount:   sessionSwitchCount,
                recoveryAttemptCount: sessionSwitchCount,
                observedSwitchCount,
                stallCount:    sessionStallCount,
                breakerSec:    Math.max(0, Math.round((switchBreakerUntil - Date.now()) / 1000)),
            }
        },
        noteSeek,
        // 相容內部名稱：現在只回傳新鮮、已辨識的影片 Transport host，不能用音訊或排名猜測。
        getLastSegmentCdn: deps.getAttributedVideoHost,
        getVideo,
        noteCdnSwitched,
        noteVideoTransport,
    }
})()
return { /* TEST_EXPORTS:watchdog */
get Watchdog() { return Watchdog; }
};
}
