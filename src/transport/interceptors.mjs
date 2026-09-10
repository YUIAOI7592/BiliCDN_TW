// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createTransport(deps) {
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
    const transformPlayurlOnce = (xhr, kind, raw) => {
        const context = playurlRequests.get(xhr)
        const valid = () => !!context && playurlRequests.get(xhr) === context
            && deps.isRuntimeGenerationActive(context.runtime)
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
    class XMLHttpRequest extends OriginalXMLHttpRequest {
        open(method, url, ...rest) {
            mediaListenerCleanup.get(this)?.()
            deps.DiagnosticLog.updateRequest(diagnosticRequests.get(this), 'reopened')
            diagnosticRequests.delete(this)
            const urlStr = String(url)
            playurlRequests.set(this, { runtime: deps.captureRuntimeGeneration(), url: urlStr, cache: null })
            mediaRequests.set(this, deps.captureMediaRequest(urlStr))
            // XMLHttpRequest 物件可被重複 open()。每次請求都要清掉上一輪的自訂狀態，
            // 否則先前的 HTTPDNS abort、重導 host 或 response 快取會污染下一個 URL。
            if (this._blockedTimer) { clearTimeout(this._blockedTimer); this._blockedTimer = null }
            this._biliRequestSeq = (this._biliRequestSeq || 0) + 1
            this._blockAbort = false
            this._blockedDone = false
            this._blockedBody = ''
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
                return super.open(method, url, ...rest)
            }

            // HTTPDNS 依 true / false / auto 判斷是否直接 abort
            if (deps.isHttpDnsUrl(urlStr) && deps.shouldBlockHttpDns()) {
                this._blockAbort   = true
                this._interceptUrl = urlStr
                deps.redirectStats.httpdns++
                return super.open(method, urlStr, ...rest)
            }
            if (deps.isHttpDnsUrl(urlStr)) {
                deps.redirectStats.httpdnsAllowed++
            }

            if (!deps.disabled && deps.isMediaSegmentUrl(urlStr)) {
                const mappedOriginalUrl = deps.getOriginalStreamUrl(urlStr)
                this._originalUrl = mappedOriginalUrl
                this._hostRewriteAttempt = mappedOriginalUrl !== urlStr
                const norm = deps.normalizeMediaUrl(urlStr)
                this._originCdn = norm.originCdn || deps.getBiliVideoCdn(urlStr)
                if (norm.changed) {
                    this._redirectedCdn = norm.targetCdn
                    this._restoredOriginal = !!norm.restoredOriginal
                    // 復原到原始簽名 URL 不是「再改一次 host」，後續 403 應按原 host 真實失敗處理。
                    this._hostRewriteAttempt = !norm.restoredOriginal
                    url = norm.url
                }
            }

            this._interceptUrl = String(url)
            return super.open(method, url, ...rest)
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
            deps.DiagnosticLog.updateRequest(diagnosticRequests.get(this), 'abort')
            diagnosticRequests.delete(this)
            playurlRequests.delete(this)
            mediaRequests.delete(this)
            if (this._blockedTimer) { clearTimeout(this._blockedTimer); this._blockedTimer = null }
            this._blockAbort = false
            this._blockedDone = false
            this._blockedBody = ''
            this._biliRequestSeq = (this._biliRequestSeq || 0) + 1
            return super.abort()
        }
        get readyState()  { return this._blockedDone ? 4 : super.readyState }
        get status()      { return this._blockedDone ? 503 : super.status }
        get statusText()  { return this._blockedDone ? 'Service Unavailable' : super.statusText }
        get responseURL() { return this._blockedDone ? (this._interceptUrl || '') : super.responseURL }
        getResponseHeader(name) {
            if (!this._blockedDone) return super.getResponseHeader(name)
            return String(name).toLowerCase() === 'content-type' ? 'application/json' : null
        }
        getAllResponseHeaders() {
            return this._blockedDone ? 'content-type: application/json\r\n' : super.getAllResponseHeaders()
        }

        send(...args) {
            if (this._biliJsonMetadata && !deps.disabled) {
                try { this.setRequestHeader('Accept', 'application/json, text/plain, */*') } catch {}
            }

            if (this._blockAbort) {
                this._deliverBlockedHttpDns()
                return
            }

            // status=0 本身不代表失敗：等待原生 error/timeout/abort 區分原因。
            // 每輪 open/send 只結算一次；取消、舊 generation/epoch 不產生健康副作用。
            if (this._originCdn) {
                // 原生 XHR 會拒絕同一次 open 的重複 send。讓它直接拋回呼叫端，不能先覆蓋
                // 第一個仍在途請求的 listener/診斷 owner，否則之後 open() 無法完整清理。
                if (mediaSendInFlight.has(this)) return super.send(...args)
                const cdn  = this._redirectedCdn || this._originCdn
                const self = this
                const requestSeq = this._biliRequestSeq
                const mediaContext = mediaRequests.get(this)
                const requestRuntimeToken = mediaContext?.runtime || deps.captureRuntimeGeneration()
                const diagnosticId = deps.DiagnosticLog.request('xhr', mediaContext, this._originalUrl || this._interceptUrl, this._interceptUrl)
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
                    listeners.forEach(([type, listener]) => self.removeEventListener(type, listener))
                    if (mediaListenerCleanup.get(self) === cleanup) mediaListenerCleanup.delete(self)
                }
                mediaListenerCleanup.set(self, cleanup)
                const active = () => !settled && self._biliRequestSeq === requestSeq && deps.mediaContextActive(mediaContext)
                const listen = (type, callback) => {
                    const listener = e => {
                        if (e?.isTrusted !== true) return
                        if (!active()) { cleanup(); return }
                        try { callback(e) } catch { deps.DiagnosticLog.fault('interceptor') }
                    }
                    listeners.push([type, listener]); self.addEventListener(type, listener)
                }
                listen('abort', () => { cleanup(); deps.DiagnosticLog.updateRequest(diagnosticId, 'abort') })
                const fail = kind => {
                    cleanup()
                    deps.DiagnosticLog.updateRequest(diagnosticId, 'network-error', { reason: kind, bytes: lastProgressLoaded })
                    deps.handleVerifiedSegmentFailure({
                        cdn,
                        url: self._interceptUrl,
                        kind,
                        bytesReceived: lastProgressLoaded,
                        requestElapsedMs: Math.max(0, performance.now() - segStartedMonotonic),
                        timeoutEvidence: kind === 'timeout' ? deps.TRUSTED_XHR_TIMEOUT_EVIDENCE : null,
                        hostRewriteAttempt: self._hostRewriteAttempt,
                        originalUrl: self._originalUrl,
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
                        deps.observeMediaTransfer(mediaContext, self.responseURL || self._interceptUrl, delta, 'xhr')
                        deps.Watchdog.noteExternalBytes(cdn, delta)
                        // 邊下載邊刷新去重標記（而不是只在下載完當下標一次）：
                        // 大 segment 下載期間，PerformanceObserver 的 resource-timing entry
                        // 理論上要等整包傳完才會送達，但送達時機沒有跟我們的量測同步保證，
                        // 持續刷新能避免「量測還沒完成、entry 卻先到」造成 onEntry() 重複入帳，
                        // 也避免下載耗時超過去重視窗（5s）導致標記提早過期。
                        deps.noteSegmentAccounted(self._interceptUrl)
                        if (self.responseURL && self.responseURL !== self._interceptUrl) {
                            deps.noteSegmentAccounted(self.responseURL)
                        }
                    }
                })
                listen('readystatechange', () => {
                    if (self.readyState === 2) deps.DiagnosticLog.updateRequest(diagnosticId, 'headers', { status: self.status, finalHost: self.responseURL || self._interceptUrl })
                    if (self.readyState !== XMLHttpRequest.DONE) return
                    // status 0 DONE precedes native error/abort in browsers: do not prematurely settle it.
                    if (self.status <= 0) return
                    cleanup()
                    deps.DiagnosticLog.updateRequest(diagnosticId, self.status >= 400 ? 'http' : 'eof', {
                        status: self.status, finalHost: self.responseURL || self._interceptUrl, bytes: lastProgressLoaded,
                    })
                    if (deps.HARD_FAIL_STATUSES.has(self.status)) {
                        deps.handleVerifiedSegmentFailure({
                            cdn,
                            url: self._interceptUrl,
                            status: self.status,
                            hostRewriteAttempt: self._hostRewriteAttempt,
                            originalUrl: self._originalUrl,
                        })
                    } else if (self.status >= 500) {
                        deps.handleVerifiedSegmentFailure({
                            cdn,
                            url: self._interceptUrl,
                            status: self.status,
                            hostRewriteAttempt: self._hostRewriteAttempt,
                            originalUrl: self._originalUrl,
                        })
                    } else if (self.status >= 200 && self.status < 400) {
                        deps.recordCdnSuccess(cdn, segStartedAt)
                        // 只有觀察到 ≥2 次 progress（真的分批收到）才信任「扣掉 TTFB」的起點；
                        // 小 segment 常常一個 read 就整包到齊，firstByteAt 幾乎等於下載完成時間，
                        // 相減會逼近 0ms，Math.max(1,...) 的下限反而把 Mbps 撐爆成離譜的天文數字。
                        // 這種情況退回含 TTFB 的完整耗時，寧可略為低估也不要產生失真的極端值。
                        const durationBase = progressEvents >= 2 ? (firstByteAt || segStartedAt) : segStartedAt
                        deps.noteSegmentBytes(cdn, self, durationBase, self._interceptUrl, lastProgressLoaded, requestRuntimeToken, mediaContext)
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
            if (this._blockedDone) return this._blockedBody
            if (this.readyState !== this.DONE) return super.responseText
            if (deps.disabled) return super.responseText
            if (!deps.isPlayUrlApi(this._interceptUrl || this.responseURL)) return super.responseText
            return transformPlayurlOnce(this, 'text', super.responseText)
        }
        get response() {
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
    theWindow.XMLHttpRequest = XMLHttpRequest

    // ── Fetch ────────────────────────────────────────────────
    const OriginalFetch = theWindow.fetch

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
                deps.recordCdnThroughput(cdn, counted, Math.max(1, Date.now() - durationBase), deps.playbackRateState.effectiveRate)
            }
            deps.recordCdnSuccess(cdn, fetchStartedAt)
        }

        const finishError = (error) => {
            if (settled || cancelled) return
            settled = true
            deps.DiagnosticLog.updateRequest(diagnosticId, error && error.name === 'AbortError' ? 'abort' : 'body-error', { bytes: counted })
            if (!deps.isRuntimeGenerationActive(requestRuntimeToken)) return
            if (error && error.name === 'AbortError') return
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
        const urlStr = (input instanceof Request) ? input.url : String(input)

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
            const mappedOriginalUrl = deps.getOriginalStreamUrl(urlStr)
            const norm = deps.normalizeMediaUrl(urlStr)
            const hostRewriteAttempt = !norm.restoredOriginal
                && (norm.changed || mappedOriginalUrl !== urlStr)
            const targetCdn = norm.targetCdn || norm.originCdn || deps.getBiliVideoCdn(urlStr)
            const effectiveUrl = norm.changed ? norm.url : urlStr

            const fetchInput = (input instanceof Request)
                ? new Request(effectiveUrl, {
                    method:         input.method,
                    headers:        input.headers,
                    body:           (input.method === 'GET' || input.method === 'HEAD') ? undefined : input.body,
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
            const requestRuntimeToken = deps.captureRuntimeGeneration()
            const mediaContext = deps.captureMediaRequest(urlStr, requestRuntimeToken)
            const diagnosticId = deps.DiagnosticLog.request('fetch', mediaContext, mappedOriginalUrl, effectiveUrl)
            return OriginalFetch(fetchInput, init).then(res => {
                deps.DiagnosticLog.updateRequest(diagnosticId, 'headers', { status: res.status, finalHost: res.url || effectiveUrl })
                const failureContext = { hostRewriteAttempt, originalUrl: mappedOriginalUrl }
                if (res.ok) return wrapMeasuredFetchResponse(res, targetCdn, effectiveUrl, fetchStartedAt, failureContext, requestRuntimeToken, mediaContext, diagnosticId)
                deps.DiagnosticLog.updateRequest(diagnosticId, 'http')

                if (deps.isRuntimeGenerationActive(requestRuntimeToken)) deps.handleVerifiedSegmentFailure({
                    ...failureContext,
                    cdn: targetCdn,
                    url: effectiveUrl,
                    status: res.status,
                })
                return res
            }).catch(error => {
                deps.DiagnosticLog.updateRequest(diagnosticId, error && error.name === 'AbortError' ? 'abort' : 'network-error')
                if (error && error.name === 'AbortError') throw error
                if (deps.isRuntimeGenerationActive(requestRuntimeToken)) deps.handleVerifiedSegmentFailure({
                    cdn: targetCdn,
                    url: effectiveUrl,
                    kind: 'network-error',
                    hostRewriteAttempt,
                    originalUrl: mappedOriginalUrl,
                })
                throw error
            })
        }

        // playurl API 回應攔截。直接串接 response.text()，讀取失敗時 Promise 會正常 reject；
        // 舊版另外包一層只有 resolve、沒有 reject 的 Promise，可能永久停在 pending。
        if (!deps.isPlayUrlApi(urlStr)) return OriginalFetch(input, init)
        const playurlRuntime = deps.captureRuntimeGeneration()
        const playurlSignal = init?.signal || (input instanceof Request ? input.signal : null)
        const valid = () => deps.isRuntimeGenerationActive(playurlRuntime) && !playurlSignal?.aborted
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
    interceptNetResponse.rawFetch = OriginalFetch.bind(theWindow)
    return interceptNetResponse
})(unsafeWindow)
return { /* TEST_EXPORTS:transport */
get interceptNetResponse() { return interceptNetResponse; }
};
}
