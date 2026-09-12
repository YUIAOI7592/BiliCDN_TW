// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createProbe(deps) {
let reorderRunning = false

const PROBE_DEFER_CHECK_MS = 2000

const MAX_PROBE_DEFERS     = 6

let deferStartupProbes = true

let probeDeferCount    = 0

let probeDeferTimer    = null

const hasUsableCdnHealth = () => deps.activeCdnList.some(c => {
    const h = deps.cdnHealth[c]
    return !!h && h.samples > 0 && !deps.knownDeadHosts.has(c) && !deps.blacklistSet.has(c)
})

const scheduleDeferredLatencyProbe = () => {
    if (probeDeferTimer) return
    if (probeDeferCount >= MAX_PROBE_DEFERS) {
        // 讓夠了。放行，交給之後自然會發生的觸發點（換片、卡頓、週期性重評估）。
        deferStartupProbes = false
        return
    }
    probeDeferCount++
    probeDeferTimer = deps.scheduleRuntimeTimeout(() => {
        probeDeferTimer = null
        if (deps.isStartupBuffering()) { scheduleDeferredLatencyProbe(); return }
        deferStartupProbes = false
        reorderCdnsByLatency().catch(deps.reportMeasurementFailure())
    }, PROBE_DEFER_CHECK_MS)
}

const reorderCdnsByLatency = async (force) => {
    if (deps.disabled) return
    const runtimeToken = deps.captureRuntimeGeneration()
    if (!deps.isRuntimeGenerationActive(runtimeToken)) return
    if (deps.resolvedCdn) { deps.preconnectCdn(deps.resolvedCdn); return }
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
    if (reorderRunning || deps.bakeoffRunning || (!force && deps.inSeekGrace())) {
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
                const cached = JSON.parse(GM_getValue(deps.PROBE_CACHE_KEY) || 'null')
                if (cached && (Date.now() - cached.t) < deps.PROBE_CACHE_TTL && Array.isArray(cached.list)) {
                    // 快取只決定「順序」，不決定「成員」。
                    // 舊版是照著快取清單重建 activeCdnList，於是某一輪縮水後的結果會被
                    // 醃在快取裡整整兩小時：之後每次載入都照著那份短清單重建，池子再也長不回來
                    //（使用者實測回報 active 只剩 1 個節點，就是這樣來的）。
                    // 現在快取裡有的照原順序放前面，其餘「當下沒有任何理由排除」的候選補在後面。
                    const usable = (c) => (!deps.isHostAllowed || deps.isHostAllowed(c)) && !deps.blacklistSet.has(c) && !deps.knownDeadHosts.has(c)
                        && !deps.isCdnSoftBlocked(c) && deps.PREFERRED_CDN_LIST.includes(c)
                    deps.activeCdnList.length = 0
                    cached.list.forEach(c => { if (usable(c)) deps.activeCdnList.push(c) })
                    deps.PREFERRED_CDN_LIST.forEach(c => {
                        if (usable(c) && !deps.activeCdnList.includes(c)) deps.activeCdnList.push(c)
                    })
                    if (deps.activeCdnList.length) {
                        probeDeferCount = 0
                        deps.promoteBestCdnNow()
                        deps.preconnectBatch(deps.activeCdnList.slice(0, 3))
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

        const candidates = deps.PREFERRED_CDN_LIST.filter(h => {
            if (deps.isHostAllowed && !deps.isHostAllowed(h)) return false
            if (deps.knownDeadHosts.has(h) || deps.isCdnSoftBlocked(h)) return false
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
            if (deps.isPresumedDnsFailHost(h)) return false
            return true
        })
        const results = await Promise.all(candidates.map(cdn => deps.probeCdnLatency(cdn, runtimeToken)))
        if (!deps.isRuntimeGenerationActive(runtimeToken)) return
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
            const hh = deps.cdnHealth[r.cdn]
            return (hh && hh.latencyMs) ? hh.latencyMs : r.ms
        }
        results.sort((a, b) => sortKey(a) - sortKey(b))

        // probeCdnLatency 回傳的 reason（'DNS' / 'timeout'）過去只被寫入、沒有任何地方讀，
        // 是不折不扣的死屬性。選擇補上這行輸出而不是刪掉它：使用者在 console 看到
        // ERR_NAME_NOT_RESOLVED 時，最想知道的就是「腳本有沒有認出這件事、認成什麼」，
        // 而這正是唯一能回答的地方。輸出受 Config.verbose 控制，預設靜音。
        const failed = results.filter(r => r.reason)
        if (failed.length) {
            deps.log('[探測] 判定不可用：' + failed.map(r => r.cdn.split('.')[0] + '(' + r.reason + ')').join('、'))
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
        deps.activeCdnList.length = 0
        for (const r of results) {
            if (!deps.blacklistSet.has(r.cdn) && !deps.knownDeadHosts.has(r.cdn)
                && !deps.isPresumedDnsFailHost(r.cdn) && r.ms !== Infinity) {
                deps.activeCdnList.push(r.cdn)
            }
        }
        if (deps.activeCdnList.length === 0) {
            deps.PREFERRED_CDN_LIST.forEach(c => {
                if (!deps.blacklistSet.has(c) && !deps.knownDeadHosts.has(c) && !deps.isPresumedDnsFailHost(c)) {
                    deps.activeCdnList.push(c)
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
        const ranked = deps.getHealthyCdnList()
        if (ranked.length) {
            const rest = deps.activeCdnList.filter(c => !ranked.includes(c))
            deps.activeCdnList.length = 0
            ranked.forEach(c => deps.activeCdnList.push(c))
            rest.forEach(c => deps.activeCdnList.push(c))
        }

        if (!deps.isRuntimeGenerationActive(runtimeToken)) return
        try {
            GM_setValue(deps.PROBE_CACHE_KEY, JSON.stringify({ t: Date.now(), list: [...deps.activeCdnList] }))
        } catch {}

        probeDeferCount = 0
        if (deps.activeCdnList[0]) {
            deps.preconnectBatch(deps.activeCdnList.slice(0, 3), force)
        }
    } finally {
        reorderRunning = false
    }
}
return { /* TEST_EXPORTS:probe */
get reorderRunning() { return reorderRunning; }, set reorderRunning(value) { reorderRunning = value; },
get probeDeferCount() { return probeDeferCount; }, set probeDeferCount(value) { probeDeferCount = value; },
get probeDeferTimer() { return probeDeferTimer; }, set probeDeferTimer(value) { probeDeferTimer = value; },
get reorderCdnsByLatency() { return reorderCdnsByLatency; }
};
}
