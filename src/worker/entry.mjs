import { createMediaUrlPolicy } from '../policy/url-policy.mjs';
export function installWorker(configuration) {

const BILICDN_BASE = configuration.originalUrl;
const BILICDN_BOOTSTRAP_TOKEN = configuration.capability;
const BILICDN_CATALOG = Object.freeze(configuration.catalog);
const BILICDN_CATALOG_SET = new Set(BILICDN_CATALOG);
const BILICDN_PCDN_SUFFIXES = Object.freeze(configuration.suffixes);
const BILICDN_PCDN_HOSTS = new Set(configuration.hosts);
const BILICDN_URL_MAX = 16 * 1024;
const BILICDN_BYTES_MAX = 256 * 1024 * 1024;
const BILICDN_STAT_MAX = 10000;
const BILICDN_REPORT_MS = 200;
let BILICDN_TARGET_HOST = configuration.target;
let BILICDN_FORCE = configuration.force;
let BILICDN_PREFERRED = configuration.preferred;
let BILICDN_EXCLUDED = configuration.excluded;
let BILICDN_DISABLED = false;
let BILICDN_CONTROL_PORT = null;
let BILICDN_STAT = { netCalls: 0, mediaSeen: 0, rewrites: 0 };
let BILICDN_STAT_TIMER = null;
const BILICDN_NATIVE_ADD_EVENT = self.addEventListener.bind(self);
const BILICDN_NATIVE_REMOVE_EVENT = self.removeEventListener.bind(self);
const BILICDN_NATIVE_STOP_IMMEDIATE = typeof Event !== 'undefined'
    && Event.prototype && Event.prototype.stopImmediatePropagation;
const biliCdnCatalogArray = (value) => {
    if (!Array.isArray(value) || value.length > BILICDN_CATALOG.length) return null;
    const out = [];
    for (const entry of value) {
        if (typeof entry !== 'string') return null;
        const host = entry.trim().toLowerCase();
        if (!BILICDN_CATALOG_SET.has(host)) return null;
        if (out.indexOf(host) === -1) out.push(host);
    }
    return out;
};
const biliCdnApplyPolicy = (data) => {
    if (!data || data.version !== 1 || data.type !== 'policy'
        || typeof data.target !== 'string' || !BILICDN_CATALOG_SET.has(data.target)
        || typeof data.disabled !== 'boolean') return false;
    const preferredNext = biliCdnCatalogArray(data.preferred);
    const forceNext = biliCdnCatalogArray(data.force);
    const excludedNext = biliCdnCatalogArray(data.excluded);
    if (!preferredNext || !forceNext || !excludedNext) return false;
    BILICDN_TARGET_HOST = data.target;
    BILICDN_PREFERRED = preferredNext;
    BILICDN_FORCE = forceNext;
    BILICDN_EXCLUDED = excludedNext;
    BILICDN_DISABLED = data.disabled;
    return true;
};
const biliCdnPostPrivate = (message) => {
    if (!BILICDN_CONTROL_PORT) return false;
    try { BILICDN_CONTROL_PORT.postMessage(message); return true; } catch (e) { return false; }
};
const biliCdnFlushStat = () => {
    if (!BILICDN_STAT.netCalls && !BILICDN_STAT.mediaSeen && !BILICDN_STAT.rewrites) return;
    if (biliCdnPostPrivate({
        version: 1, type: 'stats',
        netCalls: BILICDN_STAT.netCalls,
        mediaSeen: BILICDN_STAT.mediaSeen,
        rewrites: BILICDN_STAT.rewrites,
    })) BILICDN_STAT = { netCalls: 0, mediaSeen: 0, rewrites: 0 };
};
const biliCdnBumpStat = (key) => {
    if (!Object.prototype.hasOwnProperty.call(BILICDN_STAT, key)) return;
    BILICDN_STAT[key] = Math.min(BILICDN_STAT_MAX, BILICDN_STAT[key] + 1);
    if (!BILICDN_STAT_TIMER) {
        BILICDN_STAT_TIMER = setTimeout(() => { BILICDN_STAT_TIMER = null; biliCdnFlushStat(); }, BILICDN_REPORT_MS);
    }
};
const biliCdnBootstrap = (event) => {
    const data = event && event.data;
    const ports = event && event.ports;
    if (BILICDN_CONTROL_PORT || !data || data.__biliCdnBootstrap !== BILICDN_BOOTSTRAP_TOKEN
        || !ports || ports.length !== 1 || !ports[0]) return;
    try {
        if (typeof BILICDN_NATIVE_STOP_IMMEDIATE === 'function') BILICDN_NATIVE_STOP_IMMEDIATE.call(event);
        else event.stopImmediatePropagation();
    } catch (e) {
        try { event.stopImmediatePropagation(); } catch (e2) {}
    }
    BILICDN_CONTROL_PORT = ports[0];
    BILICDN_CONTROL_PORT.onmessage = (portEvent) => { biliCdnApplyPolicy(portEvent && portEvent.data); };
    try { BILICDN_CONTROL_PORT.start(); } catch (e) {}
    BILICDN_NATIVE_REMOVE_EVENT('message', biliCdnBootstrap);
    biliCdnPostPrivate({ version: 1, type: 'ready' });
    biliCdnFlushStat();
};
BILICDN_NATIVE_ADD_EVENT('message', biliCdnBootstrap);
// Worker 被包成 blob 之後 self.location 會變成 blob:https://...，相對 URL 必須用原 script 當基準。
const biliCdnAbs = (url) => {
    const raw = String(url);
    if (!raw || raw.length > BILICDN_URL_MAX) return null;
    try { return new URL(raw, BILICDN_BASE).href; } catch { return null; }
};
const biliCdnHostSuffix = (host, suffix) => host === suffix || host.endsWith('.' + suffix);
const biliCdnIsUnstable = (host) => {
    if (!host) return false;
    const normalized = String(host).toLowerCase();
    const first = normalized.split('.')[0];
    return /\.mcdn\.bilivideo\.(cn|com|net)$/i.test(normalized)
        || BILICDN_PCDN_SUFFIXES.some((suffix) => biliCdnHostSuffix(normalized, suffix))
        || BILICDN_PCDN_HOSTS.has(normalized)
        || (first.startsWith('upos-') && first.includes('302'))
        || (/^cn-[a-z]{2,8}-/i.test(normalized) && normalized.endsWith('.bilivideo.com'));
};
const BILICDN_MEDIA_POLICY = (createMediaUrlPolicy)();
const biliCdnClassify = (url) => BILICDN_MEDIA_POLICY.classify(url).kind;
const biliCdnNoteSeg = (url, bytes) => {
    if (!Number.isFinite(bytes) || !Number.isInteger(bytes) || bytes <= 0 || bytes > BILICDN_BYTES_MAX) return;
    try {
        const host = new URL(url).hostname.toLowerCase();
        if (BILICDN_CATALOG_SET.has(host)) {
            biliCdnPostPrivate({ version: 1, type: 'bytes', host, bytes });
        }
    } catch (e) {}
};
const biliCdnIsMedia = (url) => {
    if (typeof url !== 'string' || !url || url.length > BILICDN_URL_MAX) return false;
    try {
        const u = new URL(url);
        const host = u.hostname;
        const verdict = biliCdnClassify(url);
        if (verdict === 'pcdn' || verdict === 'suspected-pcdn' || verdict === 'live') return true;
        if (!(host.endsWith('.bilivideo.com') || host.endsWith('.bilivideo.cn') || host.endsWith('.bilivideo.net'))) return false;
        return /\.(m4s|mp4|flv|m3u8)$/i.test(u.pathname) || u.pathname.includes('/upgcxcode/');
    } catch { return false; }
};
const biliCdnNeedsRedirect = (host, verdict) =>
    !!host && (verdict === 'pcdn' || biliCdnIsUnstable(host) || BILICDN_EXCLUDED.indexOf(host) !== -1
        || BILICDN_FORCE.indexOf(host) !== -1
        || BILICDN_PREFERRED.indexOf(host) === -1);
const biliCdnRewrite = (url) => {
    try {
        if (BILICDN_DISABLED) return url;
        biliCdnBumpStat('netCalls');
        const absolute = biliCdnAbs(url);
        if (!absolute || !biliCdnIsMedia(absolute)) return url;
        biliCdnBumpStat('mediaSeen');
        const parsed = new URL(absolute);
        const verdict = biliCdnClassify(absolute);
        if (BILICDN_MEDIA_POLICY.decide(absolute).action !== 'rewrite') return url;
        // /v1/resource 是 PCDN 專用簽名路徑；target 則在真正的 URL.hostname sink 再驗證一次。
        if (/^\/v1\/resource/.test(parsed.pathname)) return absolute;
        if (!biliCdnNeedsRedirect(parsed.hostname, verdict) || parsed.hostname === BILICDN_TARGET_HOST) return absolute;
        if (!BILICDN_CATALOG_SET.has(BILICDN_TARGET_HOST)) return absolute;
        parsed.hostname = BILICDN_TARGET_HOST;
        parsed.port = '';
        if (parsed.href.length > BILICDN_URL_MAX) return url;
        biliCdnBumpStat('rewrites');
        return parsed.toString();
    } catch { return url; }
};
if (self.fetch) {
    const OriginalFetch = self.fetch.bind(self);
    const biliCdnCloneResponse = (resp, body) => {
        const out = new Response(body, { status: resp.status, statusText: resp.statusText, headers: resp.headers });
        ['url', 'redirected', 'type'].forEach((key) => {
            try { Object.defineProperty(out, key, { value: resp[key], configurable: true }); } catch (e) {}
        });
        return out;
    };
    self.fetch = (input, init) => {
        const url = input instanceof Request ? input.url : String(input);
        const rewritten = biliCdnRewrite(url);
        if (rewritten !== url && input instanceof Request) {
            input = new Request(rewritten, {
                method: input.method,
                headers: input.headers,
                body: (input.method === 'GET' || input.method === 'HEAD') ? undefined : input.body,
                mode: input.mode === 'navigate' ? 'same-origin' : input.mode,
                credentials: input.credentials,
                cache: input.cache,
                redirect: input.redirect,
                referrer: input.referrer,
                referrerPolicy: input.referrerPolicy,
                integrity: input.integrity,
                keepalive: input.keepalive,
                signal: input.signal,
            });
        } else if (rewritten !== url) {
            input = rewritten;
        }
        return OriginalFetch(input, init).then((resp) => {
            try {
                const mediaUrl = resp && (resp.url || rewritten);
                if (!resp || !resp.body || typeof resp.body.getReader !== 'function'
                    || typeof ReadableStream === 'undefined' || !biliCdnIsMedia(mediaUrl)) return resp;

                // 不使用 tee()：呼叫端取消 body 時直接 cancel 原始 reader，避免 Worker
                // 量測分支在 seek 後繼續把舊 segment 讀完。
                const reader = resp.body.getReader();
                let pending = 0, lastReport = 0;
                const flush = (force) => {
                    const now = Date.now();
                    if (!pending) return;
                    if (!force && now - lastReport < BILICDN_REPORT_MS) return;
                    lastReport = now;
                    biliCdnNoteSeg(mediaUrl, pending);
                    pending = 0;
                };
                const body = new ReadableStream({
                    pull(controller) {
                        return reader.read().then(({ done, value }) => {
                            if (done) { flush(true); controller.close(); return; }
                            if (value && value.byteLength) { pending += value.byteLength; flush(false); }
                            if (value !== undefined) controller.enqueue(value);
                        }).catch((error) => { flush(true); controller.error(error); });
                    },
                    cancel(reason) {
                        flush(true);
                        try { return Promise.resolve(reader.cancel(reason)).catch(() => {}); }
                        catch (e) { return Promise.resolve(); }
                    },
                });
                return biliCdnCloneResponse(resp, body);
            } catch (e) {
                return resp;
            }
        });
    };
}
if (self.XMLHttpRequest) {
    const OriginalXHR = self.XMLHttpRequest;
    self.XMLHttpRequest = class XMLHttpRequest extends OriginalXHR {
        open(method, url, ...rest) {
            const rewritten = biliCdnRewrite(String(url));
            try {
                let lastLoaded = 0;
                // XHR 的 'load' 要等整包下載完才觸發，跟主執行緒同樣的問題：大 segment 下載
                // 期間主執行緒完全看不到進度。改掛 'progress'，用累計 loaded 的增量即時回報。
                this.addEventListener('progress', (e) => {
                    try {
                        if (!e || e.isTrusted !== true) return;
                        if (!biliCdnIsMedia(rewritten)) return;
                        const loaded = (e && e.loaded) || 0;
                        const delta = loaded - lastLoaded;
                        if (delta > 0) { lastLoaded = loaded; biliCdnNoteSeg(rewritten, delta); }
                    } catch (e) {}
                });
                this.addEventListener('load', (e) => {
                    try {
                        if (!e || e.isTrusted !== true) return;
                        if (!biliCdnIsMedia(rewritten)) return;
                        const cl = this.getResponseHeader && this.getResponseHeader('content-length');
                        let n = cl ? parseInt(cl, 10) : 0;
                        if (!n && this.response) {
                            if (this.response.byteLength) n = this.response.byteLength;
                            else if (typeof this.response === 'string') n = this.response.length;
                        }
                        // progress 已經逐步報過 lastLoaded，這裡只補沒被 progress 算到的尾巴，避免重複入帳
                        const remaining = Math.max(0, n - lastLoaded);
                        if (remaining) biliCdnNoteSeg(rewritten, remaining);
                    } catch (e) {}
                });
            } catch (e) {}
            return super.open(method, rewritten, ...rest);
        }
    };
}

}
installWorker(__BiliCDNWorkerConfiguration);
