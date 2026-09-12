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
const BILICDN_BOOTSTRAP_TIMEOUT_MS = 1000;
const BILICDN_MODULE_WORKER = configuration.moduleWorker === true;
let BILICDN_TARGET_HOST = configuration.target;
let BILICDN_FORCE = configuration.force;
let BILICDN_PREFERRED = configuration.preferred;
let BILICDN_EXCLUDED = configuration.excluded;
let BILICDN_DISABLED = configuration.disabled === true;
let BILICDN_CONTROL_PORT = null;
let BILICDN_CONTROL_SEND = null;
let BILICDN_STAT = { netCalls: 0, mediaSeen: 0, rewrites: 0 };
let BILICDN_STAT_TIMER = null;
let BILICDN_ORIGINAL_STARTED = false;
let BILICDN_PENDING_MESSAGES_ACTIVE = true;
let BILICDN_PENDING_MESSAGES = [];
let BILICDN_BOOTSTRAP_FALLBACK = false;
let BILICDN_BOOTSTRAP_TIMER = null;
const BILICDN_NATIVE_ADD_EVENT = self.addEventListener.bind(self);
const BILICDN_NATIVE_REMOVE_EVENT = self.removeEventListener.bind(self);
const BILICDN_NATIVE_DISPATCH_EVENT = self.dispatchEvent.bind(self);
const BILICDN_NATIVE_REFLECT_APPLY = Reflect.apply;
const BILICDN_NATIVE_MESSAGE_EVENT = typeof MessageEvent === 'function' ? MessageEvent : null;
const BILICDN_NATIVE_STOP_IMMEDIATE = typeof Event !== 'undefined'
    && Event.prototype && Event.prototype.stopImmediatePropagation;
const BILICDN_NATIVE_MESSAGE_DATA_GETTER = typeof MessageEvent === 'function'
    && MessageEvent.prototype
    ? Object.getOwnPropertyDescriptor(MessageEvent.prototype, 'data')?.get
    : null;
const BILICDN_NATIVE_MESSAGE_PORTS_GETTER = typeof MessageEvent === 'function'
    && MessageEvent.prototype
    ? Object.getOwnPropertyDescriptor(MessageEvent.prototype, 'ports')?.get
    : null;
const BILICDN_NATIVE_PORT_CLOSE = typeof MessagePort === 'function'
    && MessagePort.prototype && typeof MessagePort.prototype.close === 'function'
    ? MessagePort.prototype.close
    : null;
const biliCdnReadMessageData = (event) => {
    if (!event) return undefined;
    if (typeof BILICDN_NATIVE_MESSAGE_DATA_GETTER === 'function') {
        try {
            const value = BILICDN_NATIVE_REFLECT_APPLY(BILICDN_NATIVE_MESSAGE_DATA_GETTER, event, []);
            if (value !== undefined) return value;
        } catch (e) {}
    }
    return event.data;
};
const biliCdnReadMessagePorts = (event) => {
    if (!event) return undefined;
    if (typeof BILICDN_NATIVE_MESSAGE_PORTS_GETTER === 'function') {
        try {
            const value = BILICDN_NATIVE_REFLECT_APPLY(BILICDN_NATIVE_MESSAGE_PORTS_GETTER, event, []);
            if (value !== undefined) return value;
        } catch (e) {}
    }
    return event.ports;
};
const biliCdnStopMessage = (event) => {
    try {
        if (typeof BILICDN_NATIVE_STOP_IMMEDIATE === 'function') {
            BILICDN_NATIVE_REFLECT_APPLY(BILICDN_NATIVE_STOP_IMMEDIATE, event, []);
        } else event.stopImmediatePropagation();
        return true;
    } catch (e) {
        try { event.stopImmediatePropagation(); return true; } catch (e2) { return false; }
    }
};
const biliCdnCloseTransferredPort = (port) => {
    try {
        if (port && typeof BILICDN_NATIVE_PORT_CLOSE === 'function') {
            BILICDN_NATIVE_REFLECT_APPLY(BILICDN_NATIVE_PORT_CLOSE, port, []);
        } else if (port && typeof port.close === 'function') port.close();
    } catch (e) {}
};
const biliCdnDisablePrivatePolicy = () => {
    // 沒有 authenticated private port 時，wrapper 只能作原 Worker 的透明載入器。
    // 清掉初始 policy，避免 controller 已放棄追蹤後仍留下不可停用的改寫能力。
    BILICDN_DISABLED = true;
    BILICDN_TARGET_HOST = '';
    BILICDN_FORCE = [];
    BILICDN_PREFERRED = [];
    BILICDN_EXCLUDED = [];
    BILICDN_CONTROL_PORT = null;
    BILICDN_CONTROL_SEND = null;
};
const BILICDN_NATIVE_IMPORT_SCRIPTS = !BILICDN_MODULE_WORKER && typeof self.importScripts === 'function'
    ? self.importScripts.bind(self)
    : null;
const BILICDN_NATIVE_URL = URL;
if (BILICDN_NATIVE_IMPORT_SCRIPTS) {
    self.importScripts = (...urls) => BILICDN_NATIVE_IMPORT_SCRIPTS(...urls.map((url) => {
        try { return new BILICDN_NATIVE_URL(String(url), BILICDN_BASE).href; } catch { return url; }
    }));
}
const biliCdnQueuePendingMessage = (event) => {
    if (!BILICDN_PENDING_MESSAGES_ACTIVE) return;
    if (!biliCdnStopMessage(event)) return;
    BILICDN_PENDING_MESSAGES.push(event);
};
const biliCdnFinishPendingMessages = (replay) => {
    if (!BILICDN_PENDING_MESSAGES_ACTIVE) return;
    BILICDN_PENDING_MESSAGES_ACTIVE = false;
    BILICDN_NATIVE_REMOVE_EVENT('message', biliCdnQueuePendingMessage);
    const pending = BILICDN_PENDING_MESSAGES;
    BILICDN_PENDING_MESSAGES = [];
    if (!replay) return;
    for (const event of pending) {
        try {
            const replayEvent = BILICDN_NATIVE_MESSAGE_EVENT
                ? new BILICDN_NATIVE_MESSAGE_EVENT('message', {
                    data: biliCdnReadMessageData(event),
                    ports: biliCdnReadMessagePorts(event) || [],
                })
                : event;
            BILICDN_NATIVE_DISPATCH_EVENT(replayEvent);
        } catch (e) {}
    }
};
const biliCdnStartOriginal = () => {
    if (BILICDN_ORIGINAL_STARTED) return;
    BILICDN_ORIGINAL_STARTED = true;
    if (BILICDN_MODULE_WORKER) {
        import(BILICDN_BASE).then(
            () => { biliCdnFinishPendingMessages(true); },
            (e) => {
                biliCdnFinishPendingMessages(false);
                try { console.error('[BiliCDN] worker module import 失敗', e); } catch (e2) {}
            });
        return;
    }
    try {
        if (BILICDN_NATIVE_IMPORT_SCRIPTS) BILICDN_NATIVE_IMPORT_SCRIPTS(BILICDN_BASE);
        biliCdnFinishPendingMessages(!!BILICDN_NATIVE_IMPORT_SCRIPTS);
    } catch (e) {
        biliCdnFinishPendingMessages(false);
        throw e;
    }
};
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
    if (!BILICDN_CONTROL_PORT || !BILICDN_CONTROL_SEND) return false;
    try { BILICDN_CONTROL_SEND(message); return true; } catch (e) { return false; }
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
    const data = biliCdnReadMessageData(event);
    const ports = biliCdnReadMessagePorts(event);
    if (BILICDN_CONTROL_PORT || !data || data.__biliCdnBootstrap !== BILICDN_BOOTSTRAP_TOKEN
        || !ports || ports.length !== 1 || !ports[0]) return;
    biliCdnStopMessage(event);
    if (BILICDN_BOOTSTRAP_FALLBACK) {
        // 原始 Worker 已由 timeout fail-open 啟動。遲到的 capability/port 仍須攔下，
        // 但不再建立控制通道，避免原始程式在同 realm 取得 transferred port。
        BILICDN_NATIVE_REMOVE_EVENT('message', biliCdnBootstrap);
        biliCdnCloseTransferredPort(ports[0]);
        return;
    }
    if (BILICDN_BOOTSTRAP_TIMER) { clearTimeout(BILICDN_BOOTSTRAP_TIMER); BILICDN_BOOTSTRAP_TIMER = null; }
    const controlPort = ports[0];
    const controlSend = typeof controlPort.postMessage === 'function'
        ? controlPort.postMessage.bind(controlPort)
        : null;
    if (!controlSend) {
        BILICDN_NATIVE_REMOVE_EVENT('message', biliCdnBootstrap);
        biliCdnCloseTransferredPort(controlPort);
        BILICDN_BOOTSTRAP_FALLBACK = true;
        biliCdnDisablePrivatePolicy();
        biliCdnStartOriginal();
        return;
    }
    BILICDN_CONTROL_PORT = controlPort;
    BILICDN_CONTROL_SEND = controlSend;
    BILICDN_CONTROL_PORT.onmessage = (portEvent) => { biliCdnApplyPolicy(biliCdnReadMessageData(portEvent)); };
    try { BILICDN_CONTROL_PORT.start(); } catch (e) {}
    BILICDN_NATIVE_REMOVE_EVENT('message', biliCdnBootstrap);
    biliCdnPostPrivate({ version: 1, type: 'ready' });
    biliCdnFlushStat();
    // 私有 port、handler 與原生 send 已先固定；原始 Worker 到這裡才取得執行權，
    // 無法在 bootstrap 前透過 prototype poisoning 竊取 capability/MessagePort。
    biliCdnStartOriginal();
};
BILICDN_NATIVE_ADD_EVENT('message', biliCdnBootstrap);
BILICDN_NATIVE_ADD_EVENT('message', biliCdnQueuePendingMessage);
BILICDN_BOOTSTRAP_TIMER = setTimeout(() => {
    BILICDN_BOOTSTRAP_TIMER = null;
    if (BILICDN_CONTROL_PORT || BILICDN_ORIGINAL_STARTED) return;
    BILICDN_BOOTSTRAP_FALLBACK = true;
    // 安全通道建立失敗時以可用性優先：清除初始 policy 後只啟動原 Worker，
    // 不保留改寫、stats 或任何 controller 已無法撤銷的能力。
    biliCdnDisablePrivatePolicy();
    biliCdnStartOriginal();
}, BILICDN_BOOTSTRAP_TIMEOUT_MS);
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
