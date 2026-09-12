import { createPlayerPanel } from '../ui/player-panel.mjs';
// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createApplication(deps) {

    'use strict'

    // 攔截 playurl API 回應，改寫 base_url + backup_url
    deps.interceptNetResponse((response, url, valid) => {
        if (deps.disabled || !valid() || !deps.isPlayUrlApi(url)) return
        if (response === null || response === undefined) return
        try {
            // XHR responseType='json' 會直接提供物件；舊版一律 JSON.parse(object) 而跳過改寫。
            if (Object.prototype.toString.call(response) === '[object Object]') {
                deps.playInfoTransformer(response, { trustedTransport: true })
                return response
            }
            if (typeof response !== 'string') return response
            const playInfo = JSON.parse(response)
            deps.playInfoTransformer(playInfo, { trustedTransport: true })
            return JSON.stringify(playInfo)
        } catch { deps.DiagnosticLog.fault('transform') }
    })

    const WEBRTC_APIS = ['RTCPeerConnection', 'mozRTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel']
    const webRtcOriginalDescriptors = new Map()
    const blockWebRtc = () => {
        if (!deps.BlockWebRTC || deps.disabled) return
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
        if (deps.disabled) return
        const safeTransform = (value) => {
            try { deps.playInfoTransformer(value, { trustedTransport: false }) }
            catch { deps.DiagnosticLog.fault('transform') }
        }
        if (unsafeWindow.__playinfo__) {
            safeTransform(unsafeWindow.__playinfo__)
        } else {
            let internal = unsafeWindow.__playinfo__
            Object.defineProperty(unsafeWindow, '__playinfo__', {
                get: () => internal,
                set: v => { if (!deps.disabled) safeTransform(v); internal = v },
                configurable: true
            })
        }
    }

    // ── 背景續播：偽裝 Page Visibility ──────────────────────────────────
    // 切換視窗/分頁時，瀏覽器會送 visibilitychange=hidden，bili 播放器收到後
    // 常只續傳音訊、停止補視訊 segment；加上背景 timer 節流，緩衝被耗盡，
    // 切回時就得重新加載。這裡讓頁面「永遠看起來是前景可見」，
    // 並吞掉 visibilitychange / blur，避免播放器自行降級或暫停拉流。
    let backgroundPlaybackEnabled = !deps.disabled
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
        deps.readDiagnosticHidden = () => realState() !== 'visible'
        tabReallyHidden = realState() !== 'visible'

        const def = (key, spoofed, real) => {
            try {
                Object.defineProperty(doc, key, {
                    configurable: true,
                    get: () => backgroundPlaybackEnabled ? spoofed : real(),
                })
            } catch (e) { deps.err('visibility spoof 失敗 (' + key + '):', e) }
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
                const hosts = [...new Set([deps.resolvedCdn, ...deps.activeCdnList].filter(Boolean))].slice(0, 3)
                try { deps.preconnectBatch(hosts, true) } catch {}
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
        deps.crossTabShouldBakeoff = () => true
        deps.onBakeoffStart = () => { try { crossTabChannel.postMessage({ type: 'bakeoff', id: TAB_ID }) } catch {} }
    }
    const closeCrossTab = () => {
        if (crossTabChannel) {
            try { crossTabChannel.close() } catch {}
            crossTabChannel = null
        }
        foreignBakeoffAt = 0
        deps.crossTabShouldBakeoff = () => true
        deps.onBakeoffStart = () => {}
    }

    let pageHooksApplied = false
    const applyPageHooks = () => {
        if (deps.disabled || pageHooksApplied) return
        const step = (name, fn) => {
            try { fn() } catch { deps.DiagnosticLog.fault('page-hook') }
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
                if (deps.isValidCustomCdnHost(h) && (h === deps.resolvedCdn || !deps.matchesExclude(h))
                    && hosts.length < 3 && !hosts.includes(h)) hosts.push(h)
            }
            push(deps.getPlayingCdnHost())
            // 第三順位補上「主流真的失敗時會跳過去」的 backup 候選，順序跟 buildBackupUrls
            // 一致，這樣 seek 之後就算主流出事，備援也是熱的。
            deps.getHealthyCdnList(deps.STARTUP_PICK).forEach(push)
            return hosts
        }

        // force=false：seek 中只補缺 link，避免重複重建提示；不假定能控制現有連線。
        const warmupSeek = () => {
            if (deps.disabled) return
            if (Date.now() - lastSeekWarmAt < SEEK_WARM_GAP_MS) return
            lastSeekWarmAt = Date.now()
            deps.preconnectBatch(seekWarmHosts(), false)
        }

        const scheduleSeekWarmup = () => {
            if (deps.disabled) return
            deps.Watchdog.noteSeek()
            deps.bumpSeekGrace()
            warmupSeek()
        }

        const onSeeked = () => {
            if (deps.disabled) return
            deps.bumpSeekGrace()
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
            deps.syncPlaybackRateFromVideo(v, 'initial')
            // rearmSeekPrewarm() 只重置 attached，不代表 DOM 換了新的 <video> 元素——
            // 有些情境（同一元素僅換 src）換片後還是同一個節點，若不擋，每次換片都會對
            // 同一個 <video> 重複掛一輪監聽，seek 一次觸發 N 次 warmup/Watchdog.noteSeek。
            if (!v.__biliCdnSeekBound) {
                v.__biliCdnSeekBound = true
                v.addEventListener('seeking', scheduleSeekWarmup)
                v.addEventListener('seeked', onSeeked)
                v.addEventListener('ratechange', () => {
                    if (deps.disabled) return
                    const rateState = deps.syncPlaybackRateFromVideo(v, 'ratechange')
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
        console.warn('[' + deps.PluginName + ']: 這個頁面的網址取不到影片識別碼（'
            + location.pathname + '），SPA 換片偵測可能失效；CDN 改寫本身仍可正常運作。')
    }
    let currentVideoKey = getVideoKey()
    let spaHooked = false
    const onSpaNavigate = () => {
        const key = getVideoKey()
        warnIfVideoKeyUnresolvable()
        if (key === currentVideoKey) return
        currentVideoKey = key
        deps.DiagnosticLog.record('runtime', { reason: 'spa' }, true)
        deps.TrustedMenuUI.invalidate()
        deps.stopRuntimeGeneration()
        deps.cdnProbeStarted = false
        closeCrossTab()
        if (stopSeekPrewarm) stopSeekPrewarm()
        deps.clearRuntimeConnectionHints()
        deps.forcedRedirectHosts.clear()
        deps.resetStreamProfile()        // v1.3.3：舊片碼率不能留給新片（見該函式說明）
        deps.bakeoffStartupDefers = 0    // v1.3.3：新片重新給滿起播讓路的額度
        deps.setLastBakeoffAt(0)           // 解除冷卻，新片可立即賽馬
        deps.lastSampleSegmentUrl = null
        // 放棄舊片還沒發出/還在跑的賽馬，把名額讓給新片：
        // - 還沒發出（排程中）：epoch 不符，scheduleBakeoff 的 timeout 觸發時直接跳過。
        // - 已經在跑：epoch 不符讓迴圈提早跳出 + abort 訊號讓當前這顆 probe 立刻斷線，
        //   不用等滿 3s timeout，bakeoffRunning 才能盡快讓新片的賽馬排得進去。
        deps.bakeoffEpoch++
        if (deps.bakeoffTimer) { clearTimeout(deps.bakeoffTimer); deps.bakeoffTimer = null }
        if (deps.bakeoffAbortController) { try { deps.bakeoffAbortController.abort() } catch {} ; deps.bakeoffAbortController = null }
        try { deps.Watchdog.reset() } catch {}
        try { deps.HttpDnsAutoPilot.onWatchdogReset() } catch {}
        if (!deps.disabled) {
            deps.beginRuntimeGeneration()
            setupCrossTab()
            deps.startCdnProbe()
            setupSeekPrewarm()
        }
        deps.refreshPublicDiagnosticSnapshot()
        deps.log('[SPA] 換片：' + key + '，重置選節點狀態')
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
        if (runtimeStarted || deps.disabled) return
        runtimeStarted = true
        deps.beginRuntimeGeneration()
        deps.refreshExpiredRestrictions()
        backgroundPlaybackEnabled = true
        applyPageHooks()
        if (deps.codecResumeItems.length) deps.prepareCodecConfigurations(deps.codecResumeItems)
        blockWebRtc() // applyPageHooks 只跑一次；重新啟用時仍要再次套用
        deps.startCdnProbe()
        deps.Watchdog.start()
        hookHistory()
        setupCrossTab()
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', deps.discoverCdnFromPage, { once: true })
        } else {
            deps.discoverCdnFromPage()
        }
        setupSeekPrewarm()
        // 保留每 25 秒刷新 catalog Top 3 的提示；不保證瀏覽器建立或持續保留連線。
        if (!keepWarmTimer) {
            keepWarmTimer = setInterval(() => {
                if (deps.disabled) return
                const hosts = [...new Set([deps.resolvedCdn, ...deps.activeCdnList].filter(Boolean))].slice(0, 3)
                deps.preconnectBatch(hosts, !deps.inSeekGrace())
            }, 25000)
        }
        // 週期性賽馬：跨國擁塞會隨時段漂移，每 4 分鐘重評估一次（受 90s 冷卻保護），
        // 找到明顯更快的節點就中途切換 → 播放中持續維持在最佳節點。
        if (!periodicBakeoffTimer) {
            periodicBakeoffTimer = setInterval(() => {
                if (deps.disabled || deps.resolvedCdn || !deps.lastSampleSegmentUrl) return
                // 背景分頁不主動週期賽馬：player 仍靠偽裝續播，省頻寬並避免多分頁互搶
                if (tabReallyHidden) return
                // 這裡就是專門為了「現用節點目前還算快，但擁塞會隨時段漂移，
                // 說不定有更快的」而存在的，不能被同一個理由的捷徑自己擋掉自己。
                deps.runThroughputBakeoff(deps.lastSampleSegmentUrl, false).catch(deps.reportMeasurementFailure())
            }, 4 * 60 * 1000)
        }
    }
    const stopRuntimeFeatures = () => {
        runtimeStarted = false
        deps.stopRuntimeGeneration()
        deps.cdnProbeStarted = false
        backgroundPlaybackEnabled = false
        restoreWebRtc()
        deps.Watchdog.stop()
        deps.bakeoffEpoch++
        if (deps.bakeoffTimer) { deps.clearRuntimeTimeout(deps.bakeoffTimer); deps.bakeoffTimer = null }
        if (deps.bakeoffAbortController) { try { deps.bakeoffAbortController.abort() } catch {}; deps.bakeoffAbortController = null }
        if (deps.probeDeferTimer) { deps.clearRuntimeTimeout(deps.probeDeferTimer); deps.probeDeferTimer = null }
        deps.probeDeferCount = 0
        deps.clearRuntimeConnectionHints()
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
    }
    const setRuntimeDisabled = (nextDisabled) => {
        deps.TrustedMenuUI.invalidate()
        deps.disabled = !!nextDisabled
        GM_setValue('disabled', deps.disabled)
        if (deps.disabled) stopRuntimeFeatures()
        else startRuntimeFeatures()
        deps.refreshPublicDiagnosticSnapshot()
        return deps.disabled
    }
    startRuntimeFeatures()

    const panel = createPlayerPanel({
get uiInjectStatus(){return deps.uiInjectStatus},set uiInjectStatus(v){deps.uiInjectStatus=v},
get fromHTML(){return deps.fromHTML},
get SettingsBarTitle(){return deps.SettingsBarTitle},
get disabled(){return deps.disabled},
get setRuntimeDisabled(){return setRuntimeDisabled},
get TrustedMenuUI(){return deps.TrustedMenuUI},
get Watchdog(){return { stats: deps.Watchdog.stats }},
get describePlaybackBuffer(){return deps.describePlaybackBuffer},
get resolvedCdn(){return deps.resolvedCdn},
get playbackRateState(){return {...deps.playbackRateState}},
get ASSUMED_PLAYBACK_RATE(){return deps.ASSUMED_PLAYBACK_RATE},
get cdnSoftBlockUntil(){return {...deps.cdnSoftBlockUntil}},
get isCdnSoftBlocked(){return deps.isCdnSoftBlocked},
get blacklistSet(){return new Set(deps.blacklistSet)},
get knownDeadHosts(){return new Set(deps.knownDeadHosts)},
get getCdnShortName(){return deps.getCdnShortName},
get waitForElm(){return deps.waitForElm},
get DiagnosticLog(){return deps.DiagnosticLog},
});
    // One shared state cycle, independent of panel injection/visibility. No active networking here.
    setInterval(() => {
        deps.refreshExpiredRestrictions()
        deps.samplePlaybackQuality()
        if (!deps.disabled) deps.DiagnosticLog.sample(deps.readPlaybackDiagnostic())
        deps.refreshPublicDiagnosticSnapshot()
        panel.renderVisibleStatus()
    }, 1000)
    deps.refreshPublicDiagnosticSnapshot()
    setInterval(panel.ensureUiPresent, 1500)


return { /* TEST_EXPORTS:application */

};
}
