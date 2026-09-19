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
                if (!handleTrustedPlayurlResponse(response, url)) return response
                return response
            }
            if (typeof response !== 'string') return response
            const playInfo = JSON.parse(response)
            if (!handleTrustedPlayurlResponse(playInfo, url)) return response
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

    // __playinfo__ may already exist when Tampermonkey starts this script. The old
    // branch transformed that one value but installed no setter, so a later SPA
    // assignment was invisible. Keep a best-effort accessor plus a polling fallback
    // for pages that replace the configurable data property with defineProperty().
    let pagePlayInfoGetter = null
    let pagePlayInfoSetter = null
    let lastObservedPagePlayInfo = null
    let hasObservedPagePlayInfo = false
    let pagePlayInfoAssignmentSerial = 0
    let lastSpaBoundaryAssignmentSerial = 0
    let latestPagePlayInfoAssignment = null
    let pagePlayInfoSettleTimer = null
    let pagePlayInfoLifecycle = Object.freeze({ state: 'no-new-assignment', timing: 'initial', updatedAt: Date.now() })

    const setPagePlayInfoLifecycle = (state, timing, applied = null) => {
        pagePlayInfoLifecycle = Object.freeze({
            state: ['pending', 'adopted', 'superseded', 'no-new-assignment'].includes(state) ? state : 'no-new-assignment',
            timing: ['initial', 'current-page', 'before-history', 'after-history', 'post-reset', 'polled', 'none'].includes(timing)
                ? timing : 'none',
            ...(typeof applied === 'boolean' ? { applied } : {}),
            updatedAt: Date.now(),
        })
    }
    const clearPagePlayInfoSettleTimer = () => {
        if (!pagePlayInfoSettleTimer) return
        clearTimeout(pagePlayInfoSettleTimer)
        pagePlayInfoSettleTimer = null
    }

    const readPagePlayInfo = () => {
        try { return unsafeWindow.__playinfo__ }
        catch { deps.DiagnosticLog.fault('page-hook'); return undefined }
    }
    const transformPagePlayInfo = (value, force = false) => {
        if (deps.disabled || value === null || value === undefined) return false
        if (!force && hasObservedPagePlayInfo && value === lastObservedPagePlayInfo) return false
        hasObservedPagePlayInfo = true
        lastObservedPagePlayInfo = value
        try {
            deps.playInfoTransformer(value, { trustedTransport: false })
            return true
        } catch {
            deps.DiagnosticLog.fault('transform')
            return false
        }
    }
    const notePagePlayInfoAssignment = (value) => {
        let key = null
        try { key = getVideoKey() } catch {}
        if (latestPagePlayInfoAssignment?.state === 'pending') {
            latestPagePlayInfoAssignment.state = 'superseded'
            setPagePlayInfoLifecycle('superseded', latestPagePlayInfoAssignment.timing)
        }
        clearPagePlayInfoSettleTimer()
        const assignment = {
            value,
            observedKey: key,
            destinationKey: key !== currentVideoKey ? key : null,
            serial: ++pagePlayInfoAssignmentSerial,
            state: 'pending',
            timing: key === currentVideoKey ? 'current-page' : 'after-history',
        }
        latestPagePlayInfoAssignment = assignment
        setPagePlayInfoLifecycle('pending', assignment.timing)
        // pushState schedules the SPA reset for the next task. If Bilibili assigns
        // the new value synchronously in between, defer transformation until that
        // reset has established the new generation and empty route pool.
        let applied = false
        if (!deps.disabled && key === currentVideoKey) applied = transformPagePlayInfo(value, true)
        // Keep a same-task assignment available to the history wrapper. A normal
        // same-page assignment settles on the next task so a later unrelated SPA
        // cannot reuse it. If history already attached a destination key, the SPA
        // boundary owns settlement instead.
        pagePlayInfoSettleTimer = setTimeout(() => {
            pagePlayInfoSettleTimer = null
            if (latestPagePlayInfoAssignment !== assignment || assignment.state !== 'pending') return
            if (assignment.destinationKey && assignment.destinationKey !== currentVideoKey) return
            assignment.state = 'settled'
            latestPagePlayInfoAssignment = null
            setPagePlayInfoLifecycle('adopted', assignment.timing, applied)
        }, 0)
    }
    const installPagePlayInfoHook = () => {
        let descriptor
        try { descriptor = Object.getOwnPropertyDescriptor(unsafeWindow, '__playinfo__') }
        catch { return readPagePlayInfo() }
        if (descriptor?.get === pagePlayInfoGetter && descriptor?.set === pagePlayInfoSetter) {
            return readPagePlayInfo()
        }

        const current = readPagePlayInfo()
        // Do not replace an unrelated accessor or a non-configurable/non-writable
        // data property. The shared one-second state cycle still observes identity
        // changes without altering the page's descriptor semantics.
        const isData = !descriptor || Object.prototype.hasOwnProperty.call(descriptor, 'value')
        if (!isData || descriptor?.configurable === false || descriptor?.writable === false) return current

        let internal = current
        pagePlayInfoGetter = () => internal
        pagePlayInfoSetter = value => {
            internal = value // store first: transformation failure must remain fail-open
            notePagePlayInfoAssignment(value)
        }
        try {
            Object.defineProperty(unsafeWindow, '__playinfo__', {
                configurable: true,
                enumerable: !!descriptor?.enumerable,
                get: pagePlayInfoGetter,
                set: pagePlayInfoSetter,
            })
        } catch { deps.DiagnosticLog.fault('page-hook') }
        return current
    }
    const observePagePlayInfo = () => {
        if (deps.disabled) return false
        const current = installPagePlayInfoHook()
        const hadObserved = hasObservedPagePlayInfo
        const transformed = transformPagePlayInfo(current)
        if (transformed && (!latestPagePlayInfoAssignment || latestPagePlayInfoAssignment.value !== current)) {
            setPagePlayInfoLifecycle('adopted', hadObserved ? 'polled' : 'initial', true)
        }
        return transformed
    }
    const transformInitialPlayInfo = () => observePagePlayInfo()

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
                // Hidden transitions remain isolated so background video keeps
                // downloading.  The genuine visible transition is allowed to
                // reach Bilibili, whose player uses it to resume/rebuild media.
                try { deps.noteForegroundVisible?.() } catch {}
                try { deps.wakeWatchdog?.() } catch {}
                return
            }
            e.stopImmediatePropagation()
        }
        doc.addEventListener('visibilitychange', onVisRaw, true)
        doc.addEventListener('webkitvisibilitychange', onVisRaw, true)
        unsafeWindow.addEventListener('blur', (e) => {
            if (backgroundPlaybackEnabled) e.stopImmediatePropagation()
        }, true)
    }

    let pageHooksApplied = false
    const applyPageHooks = () => {
        if (deps.disabled) return
        const step = (name, fn) => {
            try { fn() } catch { deps.DiagnosticLog.fault('page-hook') }
        }
        step('transformInitialPlayInfo', transformInitialPlayInfo)
        if (pageHooksApplied) return
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

        const findVideo = () => deps.getPrimaryVideo()

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
    let lastSpaPlayurlAdoption = null
    // Bilibili may finish fetching a recommended video's playurl before the
    // user clicks the card. That response belongs to a future SPA boundary:
    // applying it immediately would overwrite the current video's pool, while
    // discarding it leaves the next page with no route/representation data.
    // Keep a small in-memory, identifier-keyed staging area. It contains no GM
    // persistence and is cleared by stop/disable; only the exact destination
    // key can consume it at a later SPA boundary.
    const STAGED_PLAYINFO_MAX = 8
    const STAGED_PLAYINFO_ENTRY_MAX = 1024 * 1024
    const STAGED_PLAYINFO_TOTAL_MAX = 2 * 1024 * 1024
    const stagedTrustedPlayinfos = new Map()
    let stagedTrustedPlayinfoBytes = 0
    let spaHooked = false
    const playurlRequestVideoKey = requestUrl => {
        let request
        try { request = new URL(String(requestUrl), location.href) } catch { return null }
        const part = String(request.searchParams.get('p') || '')
        const suffix = part ? '#p' + part : ''
        const bvid = String(request.searchParams.get('bvid') || '').toLowerCase()
        if (/^bv[0-9a-z]+$/i.test(bvid)) return bvid + suffix
        const aid = String(request.searchParams.get('avid') || request.searchParams.get('aid') || '')
        if (/^\d+$/.test(aid)) return 'av' + aid + suffix
        const epid = String(request.searchParams.get('ep_id') || request.searchParams.get('epid') || '')
        if (/^\d+$/.test(epid)) return 'ep' + epid + suffix
        return null
    }
    const clearStagedTrustedPlayinfos = () => {
        stagedTrustedPlayinfos.clear()
        stagedTrustedPlayinfoBytes = 0
    }
    const stageTrustedPlayinfo = (targetKey, playInfo) => {
        if (!targetKey || targetKey === currentVideoKey || !playInfo) return false
        let serialized
        try { serialized = JSON.stringify(playInfo) } catch { return false }
        const bytes = serialized.length
        if (!bytes || bytes > STAGED_PLAYINFO_ENTRY_MAX) return false
        const previous = stagedTrustedPlayinfos.get(targetKey)
        if (previous) stagedTrustedPlayinfoBytes -= previous.bytes
        stagedTrustedPlayinfos.delete(targetKey)
        while (stagedTrustedPlayinfos.size >= STAGED_PLAYINFO_MAX
            || stagedTrustedPlayinfoBytes + bytes > STAGED_PLAYINFO_TOTAL_MAX) {
            const oldestKey = stagedTrustedPlayinfos.keys().next().value
            if (!oldestKey) break
            const oldest = stagedTrustedPlayinfos.get(oldestKey)
            stagedTrustedPlayinfoBytes -= oldest?.bytes || 0
            stagedTrustedPlayinfos.delete(oldestKey)
        }
        if (stagedTrustedPlayinfoBytes + bytes > STAGED_PLAYINFO_TOTAL_MAX) return false
        stagedTrustedPlayinfos.set(targetKey, { serialized, bytes })
        stagedTrustedPlayinfoBytes += bytes
        return true
    }
    const takeStagedTrustedPlayinfo = targetKey => {
        const staged = stagedTrustedPlayinfos.get(targetKey)
        if (!staged) return null
        stagedTrustedPlayinfos.delete(targetKey)
        stagedTrustedPlayinfoBytes -= staged.bytes
        try { return JSON.parse(staged.serialized) } catch { return null }
    }
    const handleTrustedPlayurlResponse = (playInfo, requestUrl) => {
        const targetKey = playurlRequestVideoKey(requestUrl)
        // Unidentified responses keep the existing same-generation behavior.
        // Identified future-video responses are returned untouched and staged;
        // the matching SPA boundary will build its trusted state from a clone.
        if (targetKey && targetKey !== currentVideoKey) {
            stageTrustedPlayinfo(targetKey, playInfo)
            return false
        }
        deps.supersedePlayerManifestSync('trusted-api')
        deps.playInfoTransformer(playInfo, { trustedTransport: true })
        return true
    }
    const playurlTargetsVideoKey = (requestUrl, videoKey) => {
        const requestKey = playurlRequestVideoKey(requestUrl)
        const normalizedVideoKey = String(videoKey || '').toLowerCase()
        if (!requestKey || !normalizedVideoKey) return false
        // A bvid-only request cannot distinguish parts of a multi-P video.
        if (normalizedVideoKey.includes('#p') && !requestKey.includes('#p')) return false
        return requestKey === normalizedVideoKey
    }
    const canAdoptSpaPlayurl = (requestUrl, requestRuntime) => {
        if (deps.disabled || !requestRuntime || !lastSpaPlayurlAdoption) return false
        const currentRuntime = deps.captureRuntimeGeneration()
        if (!deps.isRuntimeGenerationActive(currentRuntime)) return false
        const adoption = lastSpaPlayurlAdoption
        return requestRuntime.generation === adoption.fromGeneration
            && currentRuntime.generation === adoption.toGeneration
            && currentVideoKey === adoption.videoKey
            && playurlTargetsVideoKey(requestUrl, currentVideoKey)
    }
    const attachPendingAssignmentToNavigation = (beforeKey, afterKey) => {
        const assigned = latestPagePlayInfoAssignment
        if (!assigned || assigned.state !== 'pending' || assigned.observedKey !== beforeKey) return false
        if (assigned.value !== readPagePlayInfo()) return false
        assigned.destinationKey = afterKey
        assigned.timing = 'before-history'
        setPagePlayInfoLifecycle('pending', assigned.timing)
        return true
    }
    const onSpaNavigate = () => {
        const key = getVideoKey()
        warnIfVideoKeyUnresolvable()
        if (key === currentVideoKey) return
        const assigned = latestPagePlayInfoAssignment
        const currentValue = readPagePlayInfo()
        const pendingPagePlayInfo = assigned
            && assigned.state === 'pending'
            && assigned.serial > lastSpaBoundaryAssignmentSerial
            && assigned.value === currentValue
            && assigned.destinationKey === key
            ? currentValue : null
        const pendingTiming = pendingPagePlayInfo ? assigned.timing : 'none'
        lastSpaBoundaryAssignmentSerial = pagePlayInfoAssignmentSerial
        clearPagePlayInfoSettleTimer()
        if (assigned) {
            assigned.state = pendingPagePlayInfo ? 'adopted' : 'superseded'
            latestPagePlayInfoAssignment = null
        }
        const previousRuntime = deps.captureRuntimeGeneration()
        currentVideoKey = key
        lastSpaPlayurlAdoption = null
        deps.DiagnosticLog.record('runtime', { reason: 'spa' }, true)
        deps.TrustedMenuUI.invalidate()
        deps.cancelPlayerManifestSync('spa')
        deps.stopRuntimeGeneration()
        deps.resetPrimaryVideo()
        deps.cdnProbeStarted = false
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
            const nextRuntime = deps.beginRuntimeGeneration()
            if (nextRuntime) {
                lastSpaPlayurlAdoption = {
                    fromGeneration: previousRuntime.generation,
                    toGeneration: nextRuntime.generation,
                    videoKey: key,
                }
            }
            // A recommended-video playurl may have completed while the previous
            // page was still active. Adopt only the entry keyed to this exact SPA
            // destination, after the old generation and pool have been cleared.
            const stagedTrustedPlayInfo = takeStagedTrustedPlayinfo(key)
            if (stagedTrustedPlayInfo) {
                try {
                    deps.supersedePlayerManifestSync('trusted-api')
                    deps.playInfoTransformer(stagedTrustedPlayInfo, { trustedTransport: true })
                }
                catch { deps.DiagnosticLog.fault('transform') }
            }
            // A new value may have been assigned after pushState but before this
            // delayed SPA boundary. Rebuild it only after the old pool is cleared;
            // never repopulate from an unchanged value belonging to the prior page.
            if (pendingPagePlayInfo) {
                const applied = transformPagePlayInfo(pendingPagePlayInfo, true)
                setPagePlayInfoLifecycle('adopted', pendingTiming, applied)
            } else {
                setPagePlayInfoLifecycle(assigned ? 'superseded' : 'no-new-assignment', 'none')
            }
            if (!stagedTrustedPlayInfo) deps.startPlayerManifestSync(key, 'spa')
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
                let beforeKey = null
                try { beforeKey = getVideoKey() } catch {}
                const r = orig.apply(this, args)
                try {
                    const afterKey = getVideoKey()
                    if (afterKey !== beforeKey) attachPendingAssignmentToNavigation(beforeKey, afterKey)
                } catch {}
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
        deps.resetPrimaryVideo()
        deps.beginRuntimeGeneration()
        deps.refreshExpiredRestrictions(true)
        backgroundPlaybackEnabled = true
        applyPageHooks()
        deps.startPlayerManifestSync(currentVideoKey, 'initial')
        if (deps.codecResumeItems.length) deps.prepareCodecConfigurations(deps.codecResumeItems)
        blockWebRtc() // applyPageHooks 只跑一次；重新啟用時仍要再次套用
        deps.startCdnProbe()
        deps.Watchdog.start()
        hookHistory()
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
        lastSpaPlayurlAdoption = null
        clearStagedTrustedPlayinfos()
        clearPagePlayInfoSettleTimer()
        if (latestPagePlayInfoAssignment) latestPagePlayInfoAssignment.state = 'superseded'
        latestPagePlayInfoAssignment = null
        deps.cancelPlayerManifestSync('disabled')
        deps.stopRuntimeGeneration()
        deps.resetPrimaryVideo()
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
get openControlCenter(){return deps.openControlCenter},
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
        // Bilibili occasionally replaces the __playinfo__ data property during
        // SPA navigation. Re-arm the accessor or observe a new value without
        // introducing another timer or any network activity.
        observePagePlayInfo()
        deps.samplePlaybackQuality()
        if (!deps.disabled) {
            const playback = deps.readPlaybackDiagnostic()
            deps.startup.update(deps.Watchdog.getVideo(), playback)
            deps.DiagnosticLog.sample(playback)
        }
        deps.refreshPublicDiagnosticSnapshot()
        panel.renderVisibleStatus()
    }, 1000)
    deps.refreshPublicDiagnosticSnapshot()
    setInterval(panel.ensureUiPresent, 1500)


return { /* TEST_EXPORTS:application */
get getPagePlayInfoLifecycle() { return () => ({ ...pagePlayInfoLifecycle }); },
get canAdoptSpaPlayurl() { return canAdoptSpaPlayurl; },
get setRuntimeDisabled() { return setRuntimeDisabled; },
};
}
