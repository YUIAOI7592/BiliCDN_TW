// Privileged application commands. UI receives these designated actions, never GM or evidence tokens.
export function createControls(deps) {
const controlResult = (ok, status, message, data = null) => Object.freeze({
    ok: !!ok,
    status: String(status || (ok ? 'ok' : 'error')).slice(0, 48),
    message: String(message || '').slice(0, 500),
    data,
})

const copyDiagReport = async () => {
    const uiContext = deps.TrustedMenuUI.captureContext()
    const valid = () => deps.TrustedMenuUI.isContextCurrent(uiContext)
    const cancelled = () => controlResult(false, 'cancelled', '原操作視窗已結束')
    const text = deps.buildDiagReport()
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
        deps.TrustedMenuUI.toast('診斷報告已複製到剪貼簿', 'success')
        return controlResult(true, 'copied-gm', '診斷報告已複製', { method: 'gm' })
    } catch (gmError) {
        if (!valid()) return cancelled()
        deps.DiagnosticLog.fault('clipboard-gm')
        try {
            if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') throw gmError
            await navigator.clipboard.writeText(text)
            if (!valid()) return cancelled()
            deps.TrustedMenuUI.toast('診斷報告已複製到剪貼簿', 'success')
            return controlResult(true, 'copied-navigator', '診斷報告已複製', { method: 'navigator' })
        } catch (clipboardError) {
            if (!valid()) return cancelled()
            deps.DiagnosticLog.fault('clipboard-standard')
            const fallbackText = deps.buildDiagReport()
            deps.log(fallbackText)
            deps.TrustedMenuUI.openText({
                title: '手動複製診斷報告',
                paragraphs: ['自動寫入剪貼簿被瀏覽器拒絕。請在下方文字框按 Ctrl+A、Ctrl+C。'],
                text: fallbackText,
            })
            return controlResult(false, 'manual-copy', '請在視窗中手動複製', { method: 'manual' })
        }
    }
}

const BiliCDNControls = {
    diag() {
        try { console.log(deps.buildDiagReport()) } catch {}
        return {
            active:  [...deps.activeCdnList],
            black:   [...deps.blacklistSet],
            soft:    Object.fromEntries(Object.entries(deps.cdnSoftBlockUntil).filter(([cdn]) => deps.isCdnSoftBlocked(cdn))),
            dead:    deps.listDeadHosts(),
            // 已知在台灣不解析、但還沒有實測證據可以標死的節點。它們不會被選路、
            // 不會進 backup_url、不會被賽馬碰到，但也還沒被判死刑。
            presumed: deps.PREFERRED_CDN_LIST.filter(deps.isPresumedDnsFailHost),
            fail:    { ...deps.cdnFailCount },
            health:  Object.fromEntries(
                Object.entries(deps.cdnHealth).map(([k, h]) => [k, { ...h, score: deps.getCdnHealthScore(k) }])
            ),
            playback: { ...deps.playbackRateState },
            streamEstimate: { ...deps.streamEstimate },
            mediaDelivery: deps.getMediaDeliverySnapshot(),
            playbackQuality: { ...deps.playbackQualitySnapshot },
            currentCodecConfigurations: deps.getCurrentCodecDiagnostics(),
            codec: {
                preference: deps.resolvedVideoCodecPreference,
                capabilities: {
                    av1_1080: deps.getCodecCapabilityState('av1', 1080),
                    av1_2160: deps.getCodecCapabilityState('av1', 2160),
                    hevc_1080: deps.getCodecCapabilityState('hevc', 1080),
                    hevc_2160: deps.getCodecCapabilityState('hevc', 2160),
                },
                groups: deps.lastCodecDecision.groups.map(group => ({ ...group })),
            },
            verbose: deps.Config.verbose,
            redirects: { ...deps.redirectStats },
            discovered: deps.pageDiscoveredCdn,
            httpdns: deps.getHttpDnsStatus(),
            uiInjectStatus: deps.uiInjectStatus,
        }
    },
    // 診斷報告一鍵複製（改進工單 F）：回報問題時直接貼給開發者，省掉來回追問。
    // 不含完整影片網址／cookie／IP，只有 host 與統計數字。
    report() {
        return copyDiagReport()
    },
    // 注意：這是**改寫統計**，不是 Watchdog 的播放統計。換節點次數 / 卡頓次數 /
    // 斷路器狀態在內部 buffer 診斷；改寫統計與播放統計是不同入口。
    stats() {
        console.log('[BiliCDN] 改寫統計:', deps.redirectStats,
            '| HTTPDNS:', deps.getHttpDnsStatus(),
            '| 頁面 CDN:', deps.pageDiscoveredCdn ? deps.pageDiscoveredCdn.split('.')[0] : '—')
            console.log('（換節點/卡頓/斷路器已包含在「顯示診斷資訊」輸出）')
        return { ...deps.redirectStats, pageDiscoveredCdn: deps.pageDiscoveredCdn, httpdns: deps.getHttpDnsStatus() }
    },
    // 手動觸發吞吐量賽馬（用最近一次播放抓到的真實 segment）；忽略冷卻
    async bakeoff() {
        if (deps.disabled) return controlResult(false, 'disabled', 'CDN 改寫目前已停用')
        if (deps.resolvedCdn) return controlResult(false, 'fixed-cdn', '目前使用固定 CDN；恢復自動選路後才能測速選節點')
        if (!deps.lastSampleSegmentUrl) return controlResult(false, 'no-sample', '尚無 segment 樣本，請先播放影片數秒')
        if (deps.inSeekGrace()) return controlResult(false, 'seek-grace', '正在 seek 保護期，請稍候再測速')
        if (deps.bakeoffRunning) return controlResult(false, 'running', '已有一輪測速正在進行')
        const now = Date.now()
        if (now - (deps.trustedBakeoffLastAt.menu || 0) < deps.TRUSTED_BAKEOFF_MIN_GAP.menu) {
            return controlResult(false, 'cooldown', '手動測速冷卻中，請 5 秒後再試')
        }
        console.log('[BiliCDN] 開始吞吐量賽馬…（約 1~5 秒）')
        // 使用者手動要求的，不能被「現用節點目前還算快」的捷徑靜默跳過。
        const round = await deps.runThroughputBakeoff(deps.lastSampleSegmentUrl, false, deps.trustedBakeoffRequest('menu'))
        const samples = Object.entries(deps.cdnHealth)
            .filter(([host, h]) => h.samples > 0 && round?.outcomes?.some(r => r.host === host && r.accepted))
            .slice(0, deps.TRUSTED_CDN_CATALOG.length)
            .map(([host, h]) => ({
                host,
                mbps: +h.ewmaMbps.toFixed(2),
                score: +deps.getCdnHealthScore(host).toFixed(2),
            }))
        console.log('[BiliCDN] 賽馬結果:', samples, '| 目前最佳:', deps.getCdnShortName())
        const status = round?.status || (deps.disabled ? 'cancelled' : deps.isHostLockedStream(deps.lastSampleSegmentUrl) ? 'forbidden' : 'unavailable')
        const messages = { 'latency-only': '僅取得延遲；資料量或傳輸時間不足，不計吞吐樣本',
            forbidden: '串流拒絕換 host（403），保留原始網址', cancelled: '測速已取消，未提交過期結果',
            failed: '本輪未取得有效吞吐樣本', 'no-candidates': '本輪沒有可量測候選',
            unavailable: '本輪無法開始；可能正由其他分頁測速' }
        return controlResult(status === 'completed' || status === 'latency-only', status,
            status === 'completed' ? ('測速完成；目前最佳：' + deps.getCdnShortName()) : (messages[status] || messages.failed), {
                best: deps.getCdnShortName(), samples,
            })
    },
    verbose(on) {
        if (typeof on !== 'boolean') {
            console.log('[BiliCDN] Verbose =', deps.Config.verbose,
                '\n請由控制中心「進階」切換')
            return controlResult(true, 'current', 'Verbose 目前' + (deps.Config.verbose ? '已開啟' : '已關閉'), {
                enabled: deps.Config.verbose,
            })
        }
        deps.Config.verbose = on
        let persisted = null
        try {
            GM_setValue('verbose', on)
            try {
                persisted = GM_getValue('verbose') === on
                if (!persisted) deps.DiagnosticLog.record('settings-verify', {}, true)
            } catch { deps.DiagnosticLog.record('settings-verify', {}, true) }
        } catch { persisted = false; deps.DiagnosticLog.record('settings-write', {}, true) }
        deps.DiagnosticLog.verbose(persisted)
        const message = 'Verbose 已' + (on ? '開啟' : '關閉')
            + (persisted === true ? '，設定已確認儲存' : '；本分頁已套用，未確認儲存，重整後可能失效')
        deps.log(message)
        return controlResult(persisted === true, persisted === true ? (on ? 'enabled' : 'disabled') : 'applied-session-only',
            message, { enabled: on, persisted })
    },
    reset() {
        deps.clearBlacklist()
        deps.clearDeadHosts()
        Object.keys(deps.cdnFailCount).forEach(k => delete deps.cdnFailCount[k])
        Object.keys(deps.cdnHealth).forEach(k => delete deps.cdnHealth[k])
        try { GM_setValue(deps.CDN_HEALTH_KEY, '{}') } catch {}
        deps.lastChosenCdn = null
        Object.assign(deps.redirectStats, {
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
        deps.HttpDnsAutoPilot.reset()
        deps.hostLockedStreams.clear()
        deps.preservedOriginalStreamUrls.clear()
        deps.rewrittenStreamOrigins.clear()
        deps.clearNativeRouteLedger()
        deps.pageDiscoveredCdn = null
        try { GM_deleteValue(deps.PROBE_CACHE_KEY) } catch {}
        deps.Watchdog.reset()
        deps.log('已重置：黑名單、軟隔離、持久死節點、失敗計數、健康分數、probe 快取、改寫統計、Watchdog')
        return controlResult(true, 'reset', '所有學習狀態已重置')
    },
    httpdns(mode) {
        if (mode === undefined) {
            const status = deps.getHttpDnsStatus()
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
            return deps.getHttpDnsStatus()
        }
        return deps.setHttpDnsMode(mode)
    },
    // 手動重跑延遲探測（force：忽略 2 小時快取與起播讓路；presumed 節點仍刻意略過）。
    // 程式碼註解與 CHANGELOG 都提到過這個入口，但先前並沒有真的實作出來。
    // 使用者明確要求的手動探測：忽略 2 小時快取與起播讓路，重新量一次所有**可用**節點。
    // 不會去打 presumed 節點（已知在台灣不可用的那幾台）——那一發請求換不到任何能用來
    // 做決定的資訊（no-cors 讀不到狀態碼），只會在 console 留一行紅字。它們的狀態改用
    // 已知資訊列出來，並告知唯一真正能翻案的作法。
    async probe() {
        if (deps.disabled) return controlResult(false, 'disabled', 'CDN 改寫目前已停用')
        if (deps.resolvedCdn) return controlResult(false, 'fixed-cdn', '目前使用固定 CDN；恢復自動選路後才能重新排序')
        if (deps.reorderRunning) return controlResult(false, 'running', '延遲探測已在進行中')
        const now = Date.now()
        if (now - (this._lastManualProbeAt || 0) < 10000) {
            console.log('[BiliCDN] 手動探測冷卻中，請稍候再試')
            return controlResult(false, 'cooldown', '手動延遲探測冷卻中，請 10 秒後再試')
        }
        this._lastManualProbeAt = now
        try { GM_deleteValue(deps.PROBE_CACHE_KEY) } catch {}
        await deps.reorderCdnsByLatency(true)
        const order = [...deps.activeCdnList].slice(0, deps.TRUSTED_CDN_CATALOG.length)
        console.log('[BiliCDN] 探測完成，候選順序：', order.map(c => c.split('.')[0]))
        // 這幾台這一輪**刻意沒有被探測**（見候選過濾處說明）。仍然把它們列出來，
        // 否則使用者只會看到「清單裡少了幾台」而不知道發生什麼事。
        const skipped = deps.PREFERRED_CDN_LIST.filter(deps.isPresumedDnsFailHost)
        if (skipped.length) {
            const dead = deps.listDeadHosts()
            console.log('[BiliCDN] 以下節點已知在台灣不可用，本次未探測（避免無謂的失敗請求）：',
                Object.fromEntries(skipped.map(c => {
                    const d = dead.find(x => x.host === c)
                    return [c.split('.')[0], d ? (d.reason + '，剩 ' + d.daysLeft + 'd') : '預設清單推定']
                })))
        }
        return controlResult(true, order.length ? 'completed' : 'no-candidates',
            order.length ? ('延遲探測完成；目前最佳：' + deps.getCdnShortName()) : '沒有可探測候選', {
                best: deps.getCdnShortName(), order, skipped: skipped.slice(0, deps.TRUSTED_CDN_CATALOG.length),
            })
    },
    clearDead() { deps.clearDeadHosts(); return this.diag() },
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
        const full = deps.TRUSTED_CDN_CATALOG.find(c => c === host || shortOf(c) === host || codeOf(c) === host)
        if (!full || !deps.TRUSTED_CDN_CATALOG_SET.has(full)) {
            console.warn('[BiliCDN] 找不到符合的 catalog 節點：' + host)
            return controlResult(false, 'invalid-host', '選擇的節點不在可信 catalog')
        }
        if (!deps.knownDeadHosts.has(full)) return controlResult(false, 'not-dead', '該節點目前不在 dead 清單')
        deps.reviveDeadHost(full)
        deps.promoteBestCdnNow()
        console.log('[BiliCDN] 已救回：' + full)
        return controlResult(true, 'revived', '已救回：' + full, { host: full })
    },
    clearSoft() {
        const cleared = Object.keys(deps.cdnSoftBlockUntil).filter(deps.isCdnSoftBlocked).length
        Object.keys(deps.cdnSoftBlockUntil).forEach(c => delete deps.cdnSoftBlockUntil[c])
        Object.values(deps.cdnHealth).forEach(h => {
            h.softBlocks = 0
            h.lastSoftBlockAt = 0
            h.lastSoftBlockReason = ''
        })
        deps.scheduleCdnHealthSave()
        deps.promoteBestCdnNow()
        return controlResult(true, cleared ? 'cleared' : 'empty',
            cleared ? ('已清除 ' + cleared + ' 個 soft block') : '目前沒有 soft block', { cleared })
    },
    dead() {
        try {
            const raw = JSON.parse(GM_getValue(deps.DEAD_HOSTS_KEY) || '[]')
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
        if (!deps.isValidCustomCdnHost(host)) {
            console.error('[BiliCDN] [安全] 拒絕設定：「' + host
                + '」不在可信 CDN catalog')
            return controlResult(false, 'invalid-host', '拒絕設定：節點不在可信 catalog')
        }
        GM_setValue('CustomCDN', host)
        console.log('[BiliCDN] 已固定 CDN 為 ' + host + '（重整頁面生效）')
        return controlResult(true, 'fixed', '已固定 CDN；重新載入後生效', { host })
    },
    buf() {
        const s = deps.Watchdog.stats()
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
        start: () => deps.Watchdog.start(),
        stop:  () => deps.Watchdog.stop(),
        // 跟 SPA 換片時的處理方式一致：Watchdog.reset() 會讓累計位元組歸零，若當下
        // HTTPDNS AutoPilot 正在 trial-allow，沒有同步通知它就會拿舊的大 baseline
        // 對歸零後的小 sample 相減，trial 被誤判失敗——見 onWatchdogReset 註解。
        reset: () => { deps.Watchdog.reset(); try { deps.HttpDnsAutoPilot.onWatchdogReset() } catch {} },
    },
    // 動態排除/恢復 host 關鍵字（即時生效不需重整）
    exclude(kw) {
        if (!kw || typeof kw !== 'string') {
            console.log('請使用控制中心「CDN 選路」')
            return [...deps.ExcludeHostKeywords]
        }
        if (!deps.ExcludeHostKeywords.includes(kw)) deps.ExcludeHostKeywords.push(kw)
        deps.rebuildPreferredCdnList()
        for (let i = deps.activeCdnList.length - 1; i >= 0; i--) {
            if (!deps.PREFERRED_CDN_LIST.includes(deps.activeCdnList[i])) deps.activeCdnList.splice(i, 1)
        }
        if (deps.lastChosenCdn && !deps.PREFERRED_CDN_LIST.includes(deps.lastChosenCdn)) deps.lastChosenCdn = null
        if (deps.pageDiscoveredCdn && deps.matchesExclude(deps.pageDiscoveredCdn)) deps.pageDiscoveredCdn = null
        try { GM_deleteValue(deps.PROBE_CACHE_KEY) } catch {}
        deps.log('已加入排除：' + kw + '，剩餘：'
            + deps.activeCdnList.map(c => c.split('.')[0]).join(', '))
        return [...deps.ExcludeHostKeywords]
    },
    include(kw) {
        const idx = deps.ExcludeHostKeywords.indexOf(kw)
        if (idx === -1) { deps.log('排除清單中沒有：' + kw); return [...deps.ExcludeHostKeywords] }
        deps.ExcludeHostKeywords.splice(idx, 1)
        deps.rebuildPreferredCdnList()
        // 把所有新恢復且目前可用的 host 依 RAW 順序放回；不只處理字面上含 kw 的一台，
        // 因為多個排除關鍵字可能互相重疊。
        deps.PREFERRED_CDN_LIST.forEach(h => {
            if (!deps.activeCdnList.includes(h) && !deps.blacklistSet.has(h) && !deps.knownDeadHosts.has(h)) {
                deps.activeCdnList.push(h)
            }
        })
        const ranked = deps.getHealthyCdnList()
        if (ranked.length) {
            const rest = deps.activeCdnList.filter(h => !ranked.includes(h))
            deps.activeCdnList.splice(0, deps.activeCdnList.length, ...ranked, ...rest)
        }
        try { GM_deleteValue(deps.PROBE_CACHE_KEY) } catch {}
        deps.log('已移除排除：' + kw + '，當前：'
            + deps.activeCdnList.map(c => c.split('.')[0]).join(', '))
        return [...deps.ExcludeHostKeywords]
    },
    excludes() { return [...deps.ExcludeHostKeywords] },
}
return { /* TEST_EXPORTS:controls */
get controlResult() { return controlResult; },
get copyDiagReport() { return copyDiagReport; },
get BiliCDNControls() { return BiliCDNControls; }
};
}
