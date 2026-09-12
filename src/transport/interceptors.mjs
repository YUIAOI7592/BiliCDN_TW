import { createXhrFacade } from './xhr-facade.mjs'
// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createTransport(deps) {
const invoke = Reflect.apply
const interceptNetResponse = (function (theWindow) {
    const interceptors = []
    const interceptNetResponse = (handler) => interceptors.push(handler)
    const handleInterceptedResponse = (response, url, valid = () => !deps.disabled) =>
        interceptors.reduce((m, h) => {
            let r
            if (!valid()) return m
            try { r = h(m, url, valid) } catch { deps.DiagnosticLog.fault('interceptor'); return m }
            return r !== undefined ? r : m
        }, response)

    // playurl 回應的改寫成本不低（JSON.parse → sanitizePlayInfoUrls 走訪整包幾百個字串
    // 欄位 → JSON.stringify；4K 多畫質 + 多 backup 的回應可以到幾百 KB），而
    // responseText / response 是 **getter** —— 播放器每讀一次屬性就整套重跑一次。
    // 兩個後果都不能接受：
    //   1. 速度：這段完全落在起播的關鍵路徑上（playurl 到手到第一個 segment 發出之間），
    //      讀兩次就是兩倍成本，而播放器「先看長度／try 一次 parse／再正式 parse」這種
    //      多次讀取的寫法非常常見。
    //   2. 正確性：redirectStats 的計數（含診斷面板拿來判讀的 pcdnSkipped）會按
    //      「被讀幾次」而不是「有幾包回應」累加，被不明倍率灌水，失去判讀價值。
    // 以「原始值」當 key 記憶化：同一個 XHR 實例、同一份原始回應只轉換一次。
    // responseText 與 response 各自存一格——它們可能被交替讀取，共用一格會互相沖掉，
    // 反而每次都 miss。
    const playurlRequests = new WeakMap()
    const mediaRequests = new WeakMap()
    const diagnosticRequests = new WeakMap()
    const mediaListenerCleanup = new WeakMap()
    const mediaSendInFlight = new WeakSet()
    const playurlResponseValid = (runtime, url, signal = null) => {
        if (signal?.aborted) return false
        if (deps.isRuntimeGenerationActive(runtime)) return true
        // Bilibili can start the next video's playurl request immediately before
        // pushState. Its body then arrives after the SPA boundary has invalidated
        // the request's generation. The application only grants this narrow
        // exception when the request identifies the current page exactly and the
        // token belongs to the immediately preceding SPA generation.
        try { return deps.canAdoptSpaPlayurl?.(url, runtime) === true } catch { return false }
    }
    const transformPlayurlOnce = (xhr, kind, raw) => {
        const context = playurlRequests.get(xhr)
        const valid = () => !!context && playurlRequests.get(xhr) === context
            && playurlResponseValid(context.runtime, context.url)
        if (!valid()) return raw
        // text and response (text mode) share a cache; JSON never mutates the browser-owned object.
        const cached = context.cache
        if (cached && cached.raw === raw) return cached.out
        let input = raw
        if (raw && typeof raw === 'object') {
            try { input = JSON.parse(JSON.stringify(raw)) } catch { deps.DiagnosticLog.fault('transform'); return raw }
        }
        if (!valid()) return raw
        const out = handleInterceptedResponse(input, context.url, valid)
        if (!valid()) return raw
        context.cache = { raw, out }
        return out
    }

    // ── XHR ──────────────────────────────────────────────────
    const OriginalXMLHttpRequest = theWindow.XMLHttpRequest
    const nativeGetters = Object.create(null)
    for (const key of ['readyState', 'status', 'responseURL', 'response', 'responseText']) {
        for (let proto = OriginalXMLHttpRequest.prototype; proto; proto = Object.getPrototypeOf(proto)) {
            const descriptor = Object.getOwnPropertyDescriptor(proto, key)
            if (descriptor) { nativeGetters[key] = descriptor.get; break }
        }
    }
    const readNative = (xhr, key) => { try {
        const getter = nativeGetters[key]
        return getter ? invoke(getter, xhr, []) : undefined
    } catch { return undefined } }
    const nativeHeader = OriginalXMLHttpRequest.prototype.getResponseHeader
    const nativeOpen = OriginalXMLHttpRequest.prototype.open
    const nativeAddListener = OriginalXMLHttpRequest.prototype.addEventListener
    const nativeRemoveListener = OriginalXMLHttpRequest.prototype.removeEventListener
    const ownedOpen = new WeakSet(), observedXhr = new WeakMap()
    const clearOpenObserver = xhr => {
        const listener = observedXhr.get(xhr)
        if (listener) invoke(nativeRemoveListener, xhr, ['readystatechange', listener])
        observedXhr.delete(xhr)
    }
    const openNative = (xhr, method, url, rest) => {
        clearOpenObserver(xhr)
        if (mediaRequests.get(xhr)?.route?.source === 'page-hint') {
            const listener = event => {
                // A caller can invoke the original prototype directly. A new native
                // OPENED outside our open() invalidates, rather than reuses, authority.
                if (event?.isTrusted === true && readNative(xhr, 'readyState') === 1 && !ownedOpen.has(xhr)) {
                    mediaListenerCleanup.get(xhr)?.()
                    clearOpenObserver(xhr)
                    mediaRequests.delete(xhr); playurlRequests.delete(xhr)
                }
            }
            observedXhr.set(xhr, listener)
            invoke(nativeAddListener, xhr, ['readystatechange', listener])
        }
        ownedOpen.add(xhr)
        try { return invoke(nativeOpen, xhr, [method, url, ...rest]) } finally { ownedOpen.delete(xhr) }
    }
    const arrayBufferSize = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength')?.get
    const blobSize = typeof Blob === 'function' ? Object.getOwnPropertyDescriptor(Blob.prototype, 'size')?.get : null
    const nativeEvidence = xhr => {
        const response = readNative(xhr, 'response')
        let size = 0, length = null
        try { size = invoke(arrayBufferSize, response, []) } catch {}
        if (!size && blobSize) { try { size = invoke(blobSize, response, []) || 0 } catch {} }
        if (!size) { const text = readNative(xhr, 'responseText'); if (typeof text === 'string') size = text.length }
        try { length = invoke(nativeHeader, xhr, ['content-length']) } catch {}
        return { responseURL: readNative(xhr, 'responseURL'), response: { byteLength: size }, verifiedPayloadBytes: size,
            getResponseHeader: () => length }
    }
    class XMLHttpRequest extends OriginalXMLHttpRequest {
        open(method, url, ...rest) {
            mediaListenerCleanup.get(this)?.()
            deps.DiagnosticLog.updateRequest(diagnosticRequests.get(this), 'reopened')
            diagnosticRequests.delete(this)
            const urlStr = String(url)
            const nativeMethod = String(method)
            playurlRequests.set(this, { runtime: deps.captureRuntimeGeneration(), url: urlStr, cache: null })
            mediaRequests.set(this, deps.captureMediaRequest(urlStr))
            mediaRequests.get(this).method = 'xhr'
            const requestState = { originalUrl: urlStr, interceptUrl: urlStr, originCdn: null,
                targetCdn: null, hostRewriteAttempt: false, httpMethod: nativeMethod.toUpperCase() }
            mediaRequests.get(this).transport = requestState
            mediaRequests.get(this).httpMethod = requestState.httpMethod
            // XMLHttpRequest 物件可被重複 open()。每次請求都要清掉上一輪的自訂狀態，
            // 否則先前的 HTTPDNS abort、重導 host 或 response 快取會污染下一個 URL。
            if (this._blockedTimer) { clearTimeout(this._blockedTimer); this._blockedTimer = null }
            this._biliRequestSeq = (this._biliRequestSeq || 0) + 1
            this._blockAbort = false
            this._blockedDone = false
            this._blockedBody = ''
            this._localBlocked = false
            this._localBlockDone = false
            this._localBlockSent = false
            this._openArgs = [nativeMethod, urlStr, rest]
            this._savedHeaders = []
            this._originCdn = null
            this._redirectedCdn = null
            this._originalUrl = urlStr
            this._hostRewriteAttempt = false
            this._restoredOriginal = false
            this._interceptUrl = urlStr
            this._biliPlayurlCache_text = null
            this._biliPlayurlCache_response = null
            this._biliJsonMetadata = deps.isBiliJsonMetadataApi(urlStr)

            if (deps.disabled) {
                this._interceptUrl = urlStr
                return openNative(this, nativeMethod, url, rest)
            }

            // Non-GET requests keep their original URL/body and cannot become
            // routing, media health, or active-measurement evidence.
            if (requestState.httpMethod !== 'GET' && deps.isMediaSegmentUrl(urlStr)) {
                if (deps.isHostAllowed && !deps.isHostAllowed(deps.parseMediaHttpUrl(urlStr)?.hostname)) this._localBlocked = true
                return openNative(this, nativeMethod, url, rest)
            }

            // HTTPDNS 依 true / false / auto 判斷是否直接 abort
            if (deps.isHttpDnsUrl(urlStr) && deps.shouldBlockHttpDns()) {
                this._blockAbort   = true
                this._interceptUrl = urlStr
                deps.redirectStats.httpdns++
                return openNative(this, nativeMethod, urlStr, rest)
            }
            if (deps.isHttpDnsUrl(urlStr)) {
                deps.redirectStats.httpdnsAllowed++
            }

            if (!deps.disabled && deps.isMediaSegmentUrl(urlStr)) {
                const mappedOriginalUrl = deps.getOriginalStreamUrl(urlStr)
                this._originalUrl = mappedOriginalUrl
                this._hostRewriteAttempt = mappedOriginalUrl !== urlStr
                requestState.originalUrl = mappedOriginalUrl
                requestState.hostRewriteAttempt = mappedOriginalUrl !== urlStr
                const nativeRoute = deps.resolveRequestRoute(urlStr, mediaRequests.get(this))
                if (nativeRoute?.action === 'block') {
                    this._localBlocked = true
                    return openNative(this, nativeMethod, urlStr, rest)
                }
                mediaRequests.get(this).routeDecision = nativeRoute ? { type: nativeRoute.type, host: nativeRoute.host, changed: nativeRoute.url !== urlStr } : null
                const norm = nativeRoute
                    ? { url: nativeRoute.url, changed: nativeRoute.url !== urlStr, originCdn: deps.parseMediaHttpUrl(urlStr)?.hostname,
                        targetCdn: nativeRoute.host, nativeRoute: nativeRoute.type === 'native-signed', restoredOriginal: nativeRoute.action === 'restore' }
                    : deps.normalizeMediaUrl(urlStr)
                this._originCdn = norm.originCdn || deps.getBiliVideoCdn(urlStr)
                requestState.originCdn = norm.originCdn || deps.getBiliVideoCdn(urlStr)
                if (norm.changed) {
                    this._redirectedCdn = norm.targetCdn
                    this._restoredOriginal = !!norm.restoredOriginal
                    // 復原到原始簽名 URL 不是「再改一次 host」，後續 403 應按原 host 真實失敗處理。
                    this._hostRewriteAttempt = !norm.restoredOriginal && !norm.nativeRoute
                    requestState.targetCdn = norm.targetCdn
                    requestState.hostRewriteAttempt = !norm.restoredOriginal && !norm.nativeRoute
                    url = norm.url
                }
            }

            this._interceptUrl = String(url)
            requestState.interceptUrl = String(url)
            return openNative(this, nativeMethod, url, rest)
        }

        _deliverBlockedHttpDns() {
            const body = '{"code":-1,"message":"blocked by BiliCDN","data":null}'
            const requestSeq = this._biliRequestSeq
            this._blockedBody = body
            this._blockedTimer = setTimeout(() => {
                this._blockedTimer = null
                if (this._biliRequestSeq !== requestSeq || !this._blockAbort) return
                this._blockedDone = true
                try {
                    this.dispatchEvent(new Event('readystatechange'))
                    const detail = { lengthComputable: true, loaded: body.length, total: body.length }
                    this.dispatchEvent(new ProgressEvent('load', detail))
                    this.dispatchEvent(new ProgressEvent('loadend', detail))
                } catch (e) { deps.err('HTTPDNS 阻擋回應派送失敗：', e) }
            }, 0)
        }
        abort() {
            mediaListenerCleanup.get(this)?.()
            clearOpenObserver(this)
            deps.DiagnosticLog.updateRequest(diagnosticRequests.get(this), 'abort')
            diagnosticRequests.delete(this)
            playurlRequests.delete(this)
            mediaRequests.delete(this)
            if (this._blockedTimer) { clearTimeout(this._blockedTimer); this._blockedTimer = null }
            this._blockAbort = false
            this._blockedDone = false
            this._blockedBody = ''
            this._localBlocked = false
            this._localBlockDone = false
            this._localBlockSent = false
            this._biliRequestSeq = (this._biliRequestSeq || 0) + 1
            return super.abort()
        }
        get readyState()  { return this._localBlockDone ? 4 : this._blockedDone ? 4 : super.readyState }
        get status()      { return this._localBlocked ? 0 : this._blockedDone ? 503 : super.status }
        get statusText()  { return this._localBlocked ? '' : this._blockedDone ? 'Service Unavailable' : super.statusText }
        get responseURL() { return this._localBlocked ? '' : this._blockedDone ? (this._interceptUrl || '') : super.responseURL }
        getResponseHeader(name) {
            if (this._localBlocked) return null
            if (!this._blockedDone) return super.getResponseHeader(name)
            return String(name).toLowerCase() === 'content-type' ? 'application/json' : null
        }
        getAllResponseHeaders() {
            if (this._localBlocked) return ''
            return this._blockedDone ? 'content-type: application/json\r\n' : super.getAllResponseHeaders()
        }

        setRequestHeader(name, value) {
            super.setRequestHeader(name, value)
            this._savedHeaders?.push([String(name), String(value)])
        }
        _deliverLocalBlock() {
            if (this._localBlockSent) throw new DOMException('Request already sent', 'InvalidStateError')
            this._localBlockSent = true
            const seq = this._biliRequestSeq
            const finish = () => {
                this._blockedTimer = null
                if (seq !== this._biliRequestSeq || !this._localBlocked) return
                this._localBlockDone = true
                deps.DiagnosticLog.record('route-blocked', { reason: 'host-restricted', method: 'xhr' }, true)
                for (const type of ['readystatechange', 'error', 'loadend']) {
                    this.dispatchEvent(new Event(type))
                    if (seq !== this._biliRequestSeq || !this._localBlocked) break
                }
            }
            if (this._openArgs?.[2]?.[0] === false) {
                this._localBlockDone = true
                throw new DOMException('BiliCDN host restricted', 'NetworkError')
            }
            this._blockedTimer = setTimeout(finish, 0)
        }
        send(...args) {
            // Revalidate between open and send without touching any in-flight request.
            if (!mediaSendInFlight.has(this) && this._openArgs && !this._blockAbort) {
                const currentHost = deps.parseMediaHttpUrl(this._interceptUrl)?.hostname
                if (this._localBlocked || (!deps.disabled && deps.isHostAllowed && !deps.isHostAllowed(currentHost)
                    && deps.isMediaSegmentUrl(this._interceptUrl))) {
                    if (this._localBlockSent) throw new DOMException('Request already sent', 'InvalidStateError')
                    const [method, original, rest] = this._openArgs
                    const decision = deps.disabled ? { url: original }
                        : method.toUpperCase() !== 'GET' ? { url: original, action: deps.isHostAllowed(deps.parseMediaHttpUrl(original)?.hostname) ? 'pass' : 'block' }
                        : deps.resolveRequestRoute(original, mediaRequests.get(this))
                    this._localBlocked = decision?.action === 'block'
                    if (this._localBlocked) return this._deliverLocalBlock()
                    const next = decision?.url || original
                    const headers = [...this._savedHeaders]
                    openNative(this, method, next, rest)
                    for (const [name,value] of headers) super.setRequestHeader(name,value)
                    this._interceptUrl = next
                    const state = mediaRequests.get(this)?.transport
                    if (state) {
                        state.interceptUrl = next; state.targetCdn = deps.parseMediaHttpUrl(next)?.hostname
                        state.hostRewriteAttempt = next !== state.originalUrl && decision?.type !== 'native-signed' && decision?.action !== 'restore'
                        this._hostRewriteAttempt = state.hostRewriteAttempt
                        this._redirectedCdn = state.targetCdn
                        mediaRequests.get(this).routeDecision = { type: decision?.type, host: state.targetCdn, changed: next !== original }
                    }
                }
            }
            if (this._biliJsonMetadata && !deps.disabled) {
                try { this.setRequestHeader('Accept', 'application/json, text/plain, */*') } catch {}
            }

            if (this._blockAbort) {
                this._deliverBlockedHttpDns()
                return
            }

            // status=0 本身不代表失敗：等待原生 error/timeout/abort 區分原因。
            // 每輪 open/send 只結算一次；取消、舊 generation/epoch 不產生健康副作用。
            const requestState = mediaRequests.get(this)?.transport
            if (requestState?.originCdn) {
                // 原生 XHR 會拒絕同一次 open 的重複 send。讓它直接拋回呼叫端，不能先覆蓋
                // 第一個仍在途請求的 listener/診斷 owner，否則之後 open() 無法完整清理。
                if (mediaSendInFlight.has(this)) return super.send(...args)
                const cdn  = requestState.targetCdn || requestState.originCdn
                const self = this
                const mediaContext = mediaRequests.get(this)
                const requestRuntimeToken = mediaContext?.runtime || deps.captureRuntimeGeneration()
                const diagnosticId = deps.DiagnosticLog.request('xhr', mediaContext, requestState.originalUrl, requestState.interceptUrl)
                diagnosticRequests.set(this, diagnosticId)
                const segStartedAt = Date.now()
                const segStartedMonotonic = performance.now()
                let firstByteAt = 0
                let progressEvents = 0
                let settled = false
                let lastProgressLoaded = 0
                const listeners = []
                const cleanup = () => {
                    settled = true
                    mediaSendInFlight.delete(self)
                    clearOpenObserver(self)
                    listeners.forEach(([type, listener]) => invoke(nativeRemoveListener, self, [type, listener]))
                    if (mediaListenerCleanup.get(self) === cleanup) mediaListenerCleanup.delete(self)
                }
                mediaListenerCleanup.set(self, cleanup)
                const active = () => !settled && mediaRequests.get(self) === mediaContext && deps.mediaContextActive(mediaContext)
                const listen = (type, callback) => {
                    const listener = e => {
                        if (e?.isTrusted !== true) return
                        if (!active()) { cleanup(); return }
                        try { callback(e) } catch { deps.DiagnosticLog.fault('interceptor') }
                    }
                    listeners.push([type, listener]); invoke(nativeAddListener, self, [type, listener])
                }
                listen('abort', () => { cleanup(); deps.DiagnosticLog.updateRequest(diagnosticId, 'abort') })
                const fail = kind => {
                    cleanup()
                    deps.DiagnosticLog.updateRequest(diagnosticId, 'network-error', { reason: kind, bytes: lastProgressLoaded })
                    // OPENED -> OPENED native reopen may emit no event. Without a
                    // current intrinsic URL there is no proof this failure belongs
                    // to the page candidate. Keep the error observation, not a penalty.
                    if (mediaContext?.route?.source === 'page-hint'
                        && readNative(self, 'responseURL') !== deps.parseMediaHttpUrl(requestState.interceptUrl)?.href) return
                    deps.noteNativeRouteFailure(mediaContext, requestState.interceptUrl, 0, kind)
                    deps.handleVerifiedSegmentFailure({
                        cdn,
                        url: requestState.interceptUrl,
                        kind,
                        bytesReceived: lastProgressLoaded,
                        requestElapsedMs: Math.max(0, performance.now() - segStartedMonotonic),
                        timeoutEvidence: kind === 'timeout' ? deps.TRUSTED_XHR_TIMEOUT_EVIDENCE : null,
                        hostRewriteAttempt: requestState.hostRewriteAttempt,
                        originalUrl: requestState.originalUrl,
                    })
                }
                listen('error', () => fail('network-error'))
                listen('timeout', () => fail('timeout'))
                // XHR 的 'load'/readystatechange DONE 要等整包下載完才觸發，大 segment（4K/
                // 無損）下載期間 Watchdog 完全看不到進度，容易在中段誤判「好幾秒 0 位元組」。
                // 用 progress 事件的累計 loaded 算出每次的增量，即時餵給 Watchdog，
                // 讓面板/停滯偵測看到的下載節奏跟真實網路一致。
                listen('progress', (e) => {
                    if (!firstByteAt) firstByteAt = Date.now()   // 純傳輸時間的起點，扣掉連線/排隊的 TTFB
                    progressEvents++
                    const loaded = (e && e.loaded) || 0
                    deps.DiagnosticLog.updateRequest(diagnosticId, 'body', { bytes: loaded })
                    const delta = loaded - lastProgressLoaded
                    if (delta > 0) {
                        lastProgressLoaded = loaded
                        const finalUrl = readNative(self, 'responseURL')
                        deps.observeMediaTransfer(mediaContext, finalUrl || requestState.interceptUrl, delta, 'xhr')
                        deps.Watchdog.noteExternalBytes(cdn, delta)
                        // 邊下載邊刷新去重標記（而不是只在下載完當下標一次）：
                        // 大 segment 下載期間，PerformanceObserver 的 resource-timing entry
                        // 理論上要等整包傳完才會送達，但送達時機沒有跟我們的量測同步保證，
                        // 持續刷新能避免「量測還沒完成、entry 卻先到」造成 onEntry() 重複入帳，
                        // 也避免下載耗時超過去重視窗（5s）導致標記提早過期。
                        deps.noteSegmentAccounted(requestState.interceptUrl)
                        if (finalUrl && finalUrl !== requestState.interceptUrl) {
                            deps.noteSegmentAccounted(finalUrl)
                        }
                    }
                })
                listen('readystatechange', () => {
                    const readyState = readNative(self, 'readyState'), status = readNative(self, 'status')
                    const finalUrl = readNative(self, 'responseURL')
                    if (readyState === 2) deps.DiagnosticLog.updateRequest(diagnosticId, 'headers', { status, finalHost: finalUrl || requestState.interceptUrl })
                    if (readyState !== 4) return
                    // status 0 DONE precedes native error/abort in browsers: do not prematurely settle it.
                    if (!Number.isFinite(status) || status <= 0) return
                    cleanup()
                    deps.DiagnosticLog.updateRequest(diagnosticId, status >= 400 ? 'http' : 'eof', {
                        status, finalHost: finalUrl || requestState.interceptUrl, bytes: lastProgressLoaded,
                    })
                    if (mediaContext?.route?.source === 'page-hint'
                        && (!finalUrl || finalUrl !== deps.parseMediaHttpUrl(requestState.interceptUrl)?.href)) return
                    if (deps.HARD_FAIL_STATUSES.has(status)) {
                        deps.noteNativeRouteFailure(mediaContext, requestState.interceptUrl, status, 'http')
                        deps.handleVerifiedSegmentFailure({
                            cdn,
                            url: requestState.interceptUrl,
                            status,
                            hostRewriteAttempt: requestState.hostRewriteAttempt,
                            originalUrl: requestState.originalUrl,
                        })
                    } else if (status >= 500) {
                        deps.noteNativeRouteFailure(mediaContext, requestState.interceptUrl, status, 'http')
                        deps.handleVerifiedSegmentFailure({
                            cdn,
                            url: requestState.interceptUrl,
                            status,
                            hostRewriteAttempt: requestState.hostRewriteAttempt,
                            originalUrl: requestState.originalUrl,
                        })
                    } else if (status >= 200 && status < 400) {
                        const evidence = nativeEvidence(self)
                        if (mediaContext?.route?.source === 'page-hint'
                            && (requestState.httpMethod !== 'GET' || !(evidence.verifiedPayloadBytes > 0))) return
                        deps.recordCdnSuccess(cdn, segStartedAt)
                        // 只有觀察到 ≥2 次 progress（真的分批收到）才信任「扣掉 TTFB」的起點；
                        // 小 segment 常常一個 read 就整包到齊，firstByteAt 幾乎等於下載完成時間，
                        // 相減會逼近 0ms，Math.max(1,...) 的下限反而把 Mbps 撐爆成離譜的天文數字。
                        // 這種情況退回含 TTFB 的完整耗時，寧可略為低估也不要產生失真的極端值。
                        const durationBase = progressEvents >= 2 ? (firstByteAt || segStartedAt) : segStartedAt
                        deps.noteSegmentBytes(cdn, evidence, durationBase, requestState.interceptUrl, lastProgressLoaded, requestRuntimeToken, mediaContext)
                    }
                })
                mediaSendInFlight.add(this)
            }

            try { return super.send(...args) }
            catch (error) {
                mediaListenerCleanup.get(this)?.()
                deps.DiagnosticLog.updateRequest(diagnosticRequests.get(this), 'network-error'); throw error
            }
        }

        get responseText() {
            if (this._localBlocked) return ''
            if (this._blockedDone) return this._blockedBody
            if (this.readyState !== this.DONE) return super.responseText
            if (deps.disabled) return super.responseText
            if (!deps.isPlayUrlApi(this._interceptUrl || this.responseURL)) return super.responseText
            return transformPlayurlOnce(this, 'text', super.responseText)
        }
        get response() {
            if (this._localBlocked) return this.responseType === '' || this.responseType === 'text' ? '' : null
            if (this._blockedDone) {
                if (this.responseType === 'json') {
                    try { return JSON.parse(this._blockedBody) } catch { return null }
                }
                return this.responseType === '' || this.responseType === 'text' ? this._blockedBody : null
            }
            if (this.readyState !== this.DONE) return super.response
            if (deps.disabled) return super.response
            if (!deps.isPlayUrlApi(this._interceptUrl || this.responseURL)) return super.response
            return transformPlayurlOnce(this, 'response', super.response)
        }
    }
    theWindow.XMLHttpRequest = createXhrFacade(XMLHttpRequest, OriginalXMLHttpRequest)

    // ── Fetch ────────────────────────────────────────────────
    const OriginalFetch = theWindow.fetch
    const NativeRequest = Request
    const requestUrlGetter = Object.getOwnPropertyDescriptor(NativeRequest.prototype, 'url').get
    const requestMethodGetter = Object.getOwnPropertyDescriptor(NativeRequest.prototype, 'method').get

    const cloneResponseWithBody = (source, body, preserveEntityHeaders = true) => {
        const headers = new Headers(source.headers)
        if (!preserveEntityHeaders) {
            // response.text() 已解碼，且改寫後長度／實體標記可能不同，不能沿用原值。
            ;['content-length', 'content-encoding', 'content-range', 'etag', 'content-md5']
                .forEach(name => { try { headers.delete(name) } catch {} })
        }
        const out = new Response(body, {
            status: source.status,
            statusText: source.statusText,
            headers,
        })
        // new Response() 不會保留這些唯讀 metadata；部分播放器會依 response.url 判斷來源。
        ;['url', 'redirected', 'type'].forEach(key => {
            try { Object.defineProperty(out, key, { value: source[key], configurable: true }) } catch {}
        })
        return out
    }

    // 用單一路徑 ReadableStream 包裝 body：播放器讀多少就量多少；播放器 seek/切畫質
    // 取消時，cancel() 直接傳給原始 reader。舊版 tee() 的計數分支會繼續把舊 segment
    // 讀完，使取消失效並在 seek 後持續搶頻寬。
    const wrapMeasuredFetchResponse = (res, cdn, effectiveUrl, fetchStartedAt, failureContext, requestRuntimeToken, mediaContext, diagnosticId) => {
        if (!res.body || typeof res.body.getReader !== 'function' || typeof ReadableStream === 'undefined') {
            deps.DiagnosticLog.updateRequest(diagnosticId, 'no-body')
            if (deps.isRuntimeGenerationActive(requestRuntimeToken)) {
                deps.recordCdnSuccess(cdn, fetchStartedAt)
            }
            return res
        }

        const reader = res.body.getReader()
        let counted = 0
        let firstChunkAt = 0
        let chunkCount = 0
        let cancelled = false
        let settled = false

        const finishSuccess = () => {
            if (settled || cancelled) return
            settled = true
            deps.DiagnosticLog.updateRequest(diagnosticId, 'eof', { bytes: counted })
            if (!deps.isRuntimeGenerationActive(requestRuntimeToken)) return
            if (counted) {
                const durationBase = chunkCount >= 2 ? (firstChunkAt || fetchStartedAt) : fetchStartedAt
                const durationMs = Math.max(1, Date.now() - durationBase)
                deps.recordCdnThroughput(cdn, counted, durationMs, deps.playbackRateState.effectiveRate)
                deps.recordNativeThroughput(mediaContext, res.url || effectiveUrl, counted, durationMs,
                    deps.playbackRateState.effectiveRate, 'transport')
                if (mediaContext?.pageCompleted) deps.observeMediaTransfer(mediaContext, res.url || effectiveUrl, counted, 'fetch')
            }
            deps.recordCdnSuccess(cdn, fetchStartedAt)
        }

        const finishError = (error) => {
            if (settled || cancelled) return
            settled = true
            deps.DiagnosticLog.updateRequest(diagnosticId, error && error.name === 'AbortError' ? 'abort' : 'body-error', { bytes: counted })
            if (!deps.isRuntimeGenerationActive(requestRuntimeToken)) return
            if (error && error.name === 'AbortError') return
            deps.noteNativeRouteFailure(mediaContext, effectiveUrl, 0, 'body-error')
            deps.handleVerifiedSegmentFailure({
                ...(failureContext || {}),
                cdn,
                url: effectiveUrl,
                kind: 'body-error',
                bytesReceived: counted,
            })
        }

        const body = new ReadableStream({
            async pull(controller) {
                try {
                    const { done, value } = await reader.read()
                    if (done) {
                        finishSuccess()
                        controller.close()
                        return
                    }
                    if (value && value.byteLength) {
                        if (!firstChunkAt) firstChunkAt = Date.now()
                        chunkCount++
                        counted += value.byteLength
                        deps.DiagnosticLog.updateRequest(diagnosticId, 'body', { bytes: counted })
                        try {
                            if (deps.isRuntimeGenerationActive(requestRuntimeToken)) {
                                deps.observeMediaTransfer(mediaContext, res.url || effectiveUrl, value.byteLength, 'fetch')
                            }
                            if (!deps.isRuntimeGenerationActive(requestRuntimeToken)) throw new Error('stale runtime')
                            deps.Watchdog.noteExternalBytes(cdn, value.byteLength)
                            deps.noteSegmentAccounted(effectiveUrl)
                            if (res.url && res.url !== effectiveUrl) deps.noteSegmentAccounted(res.url)
                        } catch {}
                    }
                    if (value !== undefined) controller.enqueue(value)
                } catch (error) {
                    finishError(error)
                    controller.error(error)
                }
            },
            cancel(reason) {
                cancelled = true
                settled = true
                deps.DiagnosticLog.updateRequest(diagnosticId, 'abort', { bytes: counted })
                try { return Promise.resolve(reader.cancel(reason)).catch(() => {}) } catch { return Promise.resolve() }
            },
        })
        return cloneResponseWithBody(res, body)
    }

    theWindow.fetch = (input, init) => {
        if (deps.disabled) return OriginalFetch(input, init)
        const urlStr = (input instanceof NativeRequest) ? invoke(requestUrlGetter, input, []) : String(input)

        if (deps.isHttpDnsUrl(urlStr) && deps.shouldBlockHttpDns()) {
            deps.redirectStats.httpdns++
            // 合成一個可解析的失敗回應，避免未處理的 rejected promise 汙染 console。
            try {
                return Promise.resolve(new Response(
                    '{"code":-1,"message":"blocked by BiliCDN","data":null}',
                    { status: 503, statusText: 'Service Unavailable',
                      headers: { 'Content-Type': 'application/json' } }
                ))
            } catch {
                return Promise.reject(new DOMException('BiliCDN blocked httpdns', 'AbortError'))
            }
        }
        if (deps.isHttpDnsUrl(urlStr)) deps.redirectStats.httpdnsAllowed++

        if (deps.isBiliJsonMetadataApi(urlStr)) {
            const headers = new Headers(
                init && init.headers
                    ? init.headers
                    : (input instanceof Request ? input.headers : undefined)
            )
            headers.set('Accept', 'application/json, text/plain, */*')
            if (input instanceof Request) input = new Request(input, { headers })
            else init = Object.assign({}, init, { headers })
        }

        if (deps.isMediaSegmentUrl(urlStr)) {
            // Normalize once with native Request semantics (including init
            // precedence and getters), then dispatch exactly that snapshot.
            let normalized
            const wasRequest = input instanceof NativeRequest
            try { normalized = new NativeRequest(wasRequest ? input : new URL(urlStr, location.href).href, init) }
            catch (error) { return Promise.reject(error) }
            const normalizedMethod = invoke(requestMethodGetter, normalized, [])
            if (normalizedMethod !== 'GET') {
                if (deps.isHostAllowed && !deps.isHostAllowed(deps.parseMediaHttpUrl(urlStr)?.hostname)) {
                    deps.noteHostRestriction?.(deps.parseMediaHttpUrl(urlStr)?.hostname, null)
                    deps.DiagnosticLog.record('route-blocked', { reason: 'host-restricted', method: 'fetch' }, true)
                    return Promise.reject(new TypeError('BiliCDN host restricted'))
                }
                return OriginalFetch(normalized)
            }
            if (wasRequest) { input = normalized; init = undefined }
            else init = { method: normalizedMethod, headers: normalized.headers, signal: normalized.signal,
                credentials: normalized.credentials, mode: normalized.mode, cache: normalized.cache,
                redirect: normalized.redirect, referrer: normalized.referrer,
                referrerPolicy: normalized.referrerPolicy, integrity: normalized.integrity, keepalive: normalized.keepalive }
            const requestRuntimeToken = deps.captureRuntimeGeneration()
            const mediaContext = deps.captureMediaRequest(urlStr, requestRuntimeToken)
            mediaContext.method = 'fetch'
            mediaContext.httpMethod = 'GET'
            const mappedOriginalUrl = deps.getOriginalStreamUrl(urlStr)
            const nativeRoute = deps.resolveRequestRoute(urlStr, mediaContext)
            if (nativeRoute?.action === 'block') {
                deps.DiagnosticLog.record('route-blocked', { reason: 'host-restricted', method: 'fetch' }, true)
                return Promise.reject(new TypeError('BiliCDN host restricted'))
            }
            mediaContext.routeDecision = nativeRoute ? { type: nativeRoute.type, host: nativeRoute.host, changed: nativeRoute.url !== urlStr } : null
            const norm = nativeRoute
                ? { url: nativeRoute.url, changed: nativeRoute.url !== urlStr, originCdn: deps.parseMediaHttpUrl(urlStr)?.hostname,
                    targetCdn: nativeRoute.host, nativeRoute: nativeRoute.type === 'native-signed', restoredOriginal: nativeRoute.action === 'restore' }
                : deps.normalizeMediaUrl(urlStr)
            const hostRewriteAttempt = !norm.restoredOriginal
                && !norm.nativeRoute && (norm.changed || mappedOriginalUrl !== urlStr)
            const targetCdn = norm.targetCdn || norm.originCdn || deps.getBiliVideoCdn(urlStr)
            const effectiveUrl = norm.changed ? norm.url : urlStr

            const fetchInput = (input instanceof NativeRequest)
                ? new NativeRequest(effectiveUrl, {
                    // normalizedMethod was read through the captured native
                    // getter above.  Never re-enter the page-mutable Request
                    // prototype after that trust decision.
                    method:         normalizedMethod,
                    headers:        input.headers,
                    body:           undefined,
                    mode:           input.mode === 'navigate' ? 'same-origin' : input.mode,
                    credentials:    input.credentials,
                    cache:          input.cache,
                    redirect:       input.redirect,
                    referrer:       input.referrer,
                    referrerPolicy: input.referrerPolicy,
                    integrity:      input.integrity,
                    keepalive:      input.keepalive,
                    signal:         input.signal,
                  })
                : effectiveUrl

            const fetchStartedAt = Date.now()
            const diagnosticId = deps.DiagnosticLog.request('fetch', mediaContext, mappedOriginalUrl, effectiveUrl)
            return OriginalFetch(fetchInput, init).then(res => {
                deps.DiagnosticLog.updateRequest(diagnosticId, 'headers', { status: res.status, finalHost: res.url || effectiveUrl })
                const failureContext = { hostRewriteAttempt, originalUrl: mappedOriginalUrl }
                if (res.ok) return wrapMeasuredFetchResponse(res, targetCdn, effectiveUrl, fetchStartedAt, failureContext, requestRuntimeToken, mediaContext, diagnosticId)
                deps.DiagnosticLog.updateRequest(diagnosticId, 'http')

                if (deps.isRuntimeGenerationActive(requestRuntimeToken)) {
                    deps.noteNativeRouteFailure(mediaContext, effectiveUrl, res.status, 'http')
                    deps.handleVerifiedSegmentFailure({
                    ...failureContext,
                    cdn: targetCdn,
                    url: effectiveUrl,
                    status: res.status,
                    })
                }
                return res
            }).catch(error => {
                deps.DiagnosticLog.updateRequest(diagnosticId, error && error.name === 'AbortError' ? 'abort' : 'network-error')
                if (error && error.name === 'AbortError') throw error
                if (deps.isRuntimeGenerationActive(requestRuntimeToken)) {
                    deps.noteNativeRouteFailure(mediaContext, effectiveUrl, 0, 'network-error')
                    deps.handleVerifiedSegmentFailure({
                    cdn: targetCdn,
                    url: effectiveUrl,
                    kind: 'network-error',
                    hostRewriteAttempt,
                    originalUrl: mappedOriginalUrl,
                    })
                }
                throw error
            })
        }

        // playurl API 回應攔截。直接串接 response.text()，讀取失敗時 Promise 會正常 reject；
        // 舊版另外包一層只有 resolve、沒有 reject 的 Promise，可能永久停在 pending。
        if (!deps.isPlayUrlApi(urlStr)) return OriginalFetch(input, init)
        const playurlRuntime = deps.captureRuntimeGeneration()
        const playurlSignal = init?.signal || (input instanceof Request ? input.signal : null)
        const valid = () => playurlResponseValid(playurlRuntime, urlStr, playurlSignal)
        return OriginalFetch(input, init).then(response => {
            if (!valid()) return response
            return response.text().then(text => {
                let out = text
                try {
                    const transformed = valid() ? handleInterceptedResponse(text, urlStr, valid) : text
                    if (typeof transformed === 'string') out = transformed
                } catch { deps.DiagnosticLog.fault('transform') }
                const nullBody = response.status === 204 || response.status === 205 || response.status === 304
                try {
                    return cloneResponseWithBody(response, nullBody ? null : out, out === text)
                } catch (e) {
                    deps.DiagnosticLog.fault('playurl-clone')
                    return new Response(nullBody ? null : text, { status: response.status || 200 })
                }
            }, error => { if (valid()) deps.DiagnosticLog.fault('playurl-body'); throw error })
        })
    }

    // 測速（probeCdnThroughput/confirmHostReachable）也是用 fetch 發請求，Tampermonkey
    // sandbox 模式下 window.fetch 會轉發到這裡被改寫的 unsafeWindow.fetch——測速請求會
    // 被自己的攔截層改寫到別的節點，量出來的速度記到錯的 CDN 頭上。掛出原生 fetch 供繞過。
    interceptNetResponse.rawFetch = (...args) => invoke(OriginalFetch, theWindow, args)
    return interceptNetResponse
})(unsafeWindow)
return { /* TEST_EXPORTS:transport */
get interceptNetResponse() { return interceptNetResponse; }
};
}
