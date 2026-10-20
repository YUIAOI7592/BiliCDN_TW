// ==UserScript==
// @name         Bilibili CDN 台灣優化
// @namespace    BiliCDN_TW
// @version      1.8.0
// @description  改善台灣網路觀看 Bilibili 影片時的 CDN 連線穩定度，支援自動切換與卡頓監測
// @author       jiyunshi <chocosensei214@gmail.com>
// @license      MIT
// @homepageURL  https://github.com/YUIAOI7592/BiliCDN_TW
// @supportURL   https://github.com/YUIAOI7592/BiliCDN_TW/issues
// @updateURL    https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js
// @downloadURL  https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js
// @icon         https://i0.hdslb.com/bfs/static/jinkela/long/images/512.png
// @run-at       document-start
// @match        https://www.bilibili.com/video/*
// @match        https://www.bilibili.com/bangumi/play/*
// @match        https://www.bilibili.com/list/*
// @match        https://www.bilibili.com/festival/*
// @match        https://www.bilibili.com/medialist/play/*
// @match        https://www.bilibili.com/watchlater/*
// @match        https://www.bilibili.com/blackboard/*
// @match        https://www.bilibili.com/mooc/*
// @match        https://www.bilibili.com/cheese/*
// @match        https://www.bilibili.com/v/*
// @match        https://www.bilibili.com/documentary/*
// @match        https://www.bilibili.com/variety/*
// @match        https://www.bilibili.com/tv/*
// @match        https://www.bilibili.com/guochuang/*
// @match        https://www.bilibili.com/movie/*
// @match        https://www.bilibili.com/anime/*
// @match        https://www.bilibili.com/match/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @grant        GM_info
// @grant        unsafeWindow
// ==/UserScript==

(function () {
// ── 使用者設定 ────────────────────────────────────────────────────────
// 一般使用者不需要修改；安裝後重整 Bilibili 影片頁即可使用。
// CustomCDN：留空 = 自動輪換；填 host = 固定該 CDN；填 'null' = 清除 GM 設定
var CustomCDN = ''

// ExcludeHostKeywords：host 名稱含這些子字串就不會被選用/probe/重導向
// 例：['cosov']、['cos']（含 cosov）、['ov.bilivideo']（不建議，海外節點全排）
// 動態調整請使用 Tampermonkey「BiliCDN 控制中心 → CDN 選路」。
//
// 2026-08-20：cosov 維持排除。中間一度以「一次 16KB range 請求回 206」為由解除，
// 隨即被實機推翻——**單次小範圍請求不等於持續播放**。實際開影片時 cosov 會：
//   (1) 對 PROBE_PATH（/crossdomain.xml）**必定**回 403 → 每輪探測固定產生一行紅字；
//   (2) 對真實 m4s 回 `ERR_FAILED 514` 且**不帶 Access-Control-Allow-Origin**，
//       瀏覽器直接報 CORS 錯誤（實測 URL 上是 os=cosovbv、bw=22M 的 4K/HDR 串流）。
// 同一批 log 裡另外四個新增鏡像（alib / ali02 / bos / tf-all-tx）零錯誤，所以問題確實
// 只在 cosov。詳見 CHANGELOG 實驗記錄實驗 4 與實驗 5。
var ExcludeHostKeywords = ['cosov']

// BlockHttpDNS：true = 永遠阻擋；false = 永遠放行；'auto' = 短測 + 評分 + 記憶網路環境
var BlockHttpDNS = 'auto'

// PreferredVideoCodec：'av1' = 相同畫質優先 AV1，再退回 HEVC、AVC；'hevc' = 優先 HEVC；
// 'avc' = 最保守、優先 AVC；'auto' = 完全保留 Bilibili 原順序。AV1 只有在 representation
// 帶有實際 codec string 且 MediaSource/canPlayType 回報可播放時才會主動提升；Media Capabilities
// 明確回報不支援、不順暢或非節能解碼時，AV1/HEVC 會降到 AVC 後面。
var PreferredVideoCodec = 'av1'

// BlockWebRTC：true = 阻擋 WebRTC（擋 Bilibili PCDN/P2P 傳輸，跨國連線建議開）；
// false = 放行（頁面其他功能，或其他擴充功能，若也用到 WebRTC 才需要關）
var BlockWebRTC = true

const __BiliCDNSettings = { CustomCDN, ExcludeHostKeywords, BlockHttpDNS, PreferredVideoCodec, BlockWebRTC };
(() => {
  var __defProp = Object.defineProperty;
  var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

  // src/config.mjs
  function createSettings(deps, input) {
    let CustomCDN = input.CustomCDN;
    let ExcludeHostKeywords = input.ExcludeHostKeywords;
    let BlockHttpDNS = input.BlockHttpDNS;
    let PreferredVideoCodec = input.PreferredVideoCodec;
    let BlockWebRTC = input.BlockWebRTC;
    const VERSION = typeof GM_info !== "undefined" && GM_info.script && GM_info.script.version || "1.8.0";
    const parseVer = /* @__PURE__ */ __name((v) => String(v || "0").split(".").map((n) => parseInt(n, 10) || 0), "parseVer");
    const verGte = /* @__PURE__ */ __name((a, b) => {
      const A = parseVer(a), B = parseVer(b);
      for (let i = 0; i < 3; i++) {
        if ((A[i] || 0) !== (B[i] || 0)) return (A[i] || 0) > (B[i] || 0);
      }
      return true;
    }, "verGte");
    return {
      get CustomCDN() {
        return CustomCDN;
      },
      set CustomCDN(value) {
        CustomCDN = value;
      },
      get ExcludeHostKeywords() {
        return ExcludeHostKeywords;
      },
      set ExcludeHostKeywords(value) {
        ExcludeHostKeywords = value;
      },
      get BlockHttpDNS() {
        return BlockHttpDNS;
      },
      set BlockHttpDNS(value) {
        BlockHttpDNS = value;
      },
      get PreferredVideoCodec() {
        return PreferredVideoCodec;
      },
      set PreferredVideoCodec(value) {
        PreferredVideoCodec = value;
      },
      get BlockWebRTC() {
        return BlockWebRTC;
      },
      set BlockWebRTC(value) {
        BlockWebRTC = value;
      },
      get VERSION() {
        return VERSION;
      },
      get verGte() {
        return verGte;
      }
    };
  }
  __name(createSettings, "createSettings");

  // src/diagnostics/events.mjs
  function createEvents(deps) {
    const PluginName = "BiliCDN_TW_v" + deps.VERSION;
    const Config = { verbose: false };
    const DiagnosticLog = (() => {
      const critical = [], detail = [], pending = /* @__PURE__ */ new Map();
      const TTL = 15 * 60 * 1e3;
      const encoder = new TextEncoder();
      const codes = new Set("runtime verbose settings-read settings-write settings-verify exception request headers body eof no-body http network-error body-error abort reopened detached rewrite measurement watchdog recovery breaker host-lock clipboard sample".split(" "));
      const enums = new Set("fetch xhr video audio muxed unknown non-catalog headers body settings-read settings-write settings-verify startup active disabled spa epoch interceptor transform fetch-body playurl-body playurl-clone measurement watchdog snapshot health-save clipboard-gm clipboard-standard clipboard-manual page-hook ui no-video invalid-state no-metadata media-error ended paused seeking seek-grace background-gap player-nudge nudge-grace startup-grace switch-grace target-reached healthy low-data buffered-stall too-slow stall-count cooldown breaker attempt progress no-progress interrupted no-attribution attributed received httpdns accepted skipped complete cancelled failed timeout partial latency-only http network-error body-error abort eof no-body reopened detached automatic manual fixed no-segment busy hidden not-applicable host-lock forbidden insufficient ineligible".split(" "));
      const keys = new Set("generation epoch id method kind originalHost targetHost finalHost host status bytes startAt responseAt endAt ageMs phase stage reason enabled persisted readyState networkState currentTime duration bufferAheadSec observedRate effectiveRate paused seeking ended available valid errorCode hidden waitMs count remainingMs punished reselected preconnect requested received switchCount stallCount breakerSec outcome actionId".split(" "));
      const state = {
        startedAt: Date.now(),
        verboseChangedAt: Date.now(),
        persisted: null,
        evicted: 0,
        expired: 0,
        rejected: 0,
        pendingEvicted: 0,
        failures: 0
      };
      let seq = 0, nextRequest = 0, lastSampleAt = 0;
      let context = { generation: 0, epoch: 0 };
      let decision = null;
      const size = /* @__PURE__ */ __name((text) => encoder.encode(text).byteLength, "size");
      const finite = /* @__PURE__ */ __name((x) => typeof x === "number" && Number.isFinite(x) && Math.abs(x) <= Number.MAX_SAFE_INTEGER, "finite");
      const host = /* @__PURE__ */ __name((value) => {
        try {
          const h = typeof value === "string" && value.length <= 16384 ? value.includes("/") ? new URL(value, "https://www.bilibili.com").hostname : value : "";
          return deps.TRUSTED_CDN_CATALOG_SET.has(h) ? h : "non-catalog";
        } catch {
          return "non-catalog";
        }
      }, "host");
      const clean = /* @__PURE__ */ __name((data) => {
        const out = {};
        for (const key of Object.keys(data).slice(0, 40)) {
          if (!keys.has(key)) continue;
          const value = data[key];
          if (/Host$/.test(key) || key === "host") out[key] = value === null ? null : host(value);
          else if (value === null || typeof value === "boolean" || finite(value)) out[key] = value;
          else if (typeof value === "string" && enums.has(value)) out[key] = value;
        }
        return out;
      }, "clean");
      const prune = /* @__PURE__ */ __name(() => {
        const cutoff = Date.now() - TTL;
        for (const ring of [critical, detail]) {
          while (ring.length && ring[0].lastAt < cutoff) {
            ring.shift();
            state.expired++;
          }
        }
      }, "prune");
      const record = /* @__PURE__ */ __name((code, data = {}, important = false) => {
        try {
          if (!codes.has(code)) {
            state.rejected++;
            return;
          }
          if (!important && !Config.verbose) return;
          prune();
          const fields = { ...context, ...clean(data) };
          const now = Date.now(), ring = important ? critical : detail;
          const previous = ring[ring.length - 1];
          if (previous && previous.seq === seq && previous.code === code && JSON.stringify(previous.data) === JSON.stringify(fields)) {
            previous.lastAt = now;
            previous.count = Math.min(1e4, previous.count + 1);
            return;
          }
          const entry = { seq: ++seq, firstAt: now, lastAt: now, count: 1, code, data: fields };
          if (size(JSON.stringify(entry)) > 1024) {
            state.rejected++;
            return;
          }
          ring.push(entry);
          if (ring.length > (important ? 64 : 192)) {
            ring.shift();
            state.evicted++;
          }
          try {
            if (Config.verbose) console.log("[BiliCDN evidence]", JSON.stringify(entry));
          } catch {
          }
        } catch {
          state.failures++;
        }
      }, "record");
      const fault = /* @__PURE__ */ __name((stage) => record("exception", { stage }, true), "fault");
      const requestActive = /* @__PURE__ */ __name((r) => r && r.generation === context.generation && r.epoch === context.epoch, "requestActive");
      const request = /* @__PURE__ */ __name((method, media, original, target) => {
        try {
          if (!deps.mediaContextActive(media)) return null;
          const r = {
            id: ++nextRequest,
            generation: media.runtime.generation,
            epoch: media.epoch,
            method,
            kind: media.rep?.kind || "unknown",
            originalHost: host(original),
            targetHost: host(target),
            finalHost: null,
            startAt: Date.now(),
            responseAt: null,
            bytes: 0,
            status: null,
            phase: "headers"
          };
          pending.set(r.id, r);
          if (pending.size > 64) {
            pending.delete(pending.keys().next().value);
            state.pendingEvicted++;
          }
          record("request", r);
          return r.id;
        } catch {
          state.failures++;
          return null;
        }
      }, "request");
      const updateRequest = /* @__PURE__ */ __name((id, code, data = {}) => {
        try {
          const r = pending.get(id);
          if (!requestActive(r)) return;
          Object.assign(r, clean(data));
          if (code === "headers") {
            r.responseAt = Date.now();
            r.phase = "body";
          }
          if (code === "body") return;
          const terminal = code !== "headers";
          if (terminal) {
            r.endAt = Date.now();
            pending.delete(id);
          }
          record(code, r, ["http", "network-error", "body-error"].includes(code));
        } catch {
          state.failures++;
        }
      }, "updateRequest");
      const boundary = /* @__PURE__ */ __name((generation, epoch, reason) => {
        try {
          for (const id of [...pending.keys()]) updateRequest(id, "detached");
          context = { generation, epoch };
          record("runtime", { reason }, true);
        } catch {
          state.failures++;
        }
      }, "boundary");
      const setDecision = /* @__PURE__ */ __name((reason, data = {}) => {
        try {
          const next = { ...context, reason, ...clean(data) };
          if (!decision || decision.reason !== reason || decision.generation !== context.generation) record("watchdog", next, reason === "low-data");
          decision = { ...next, updatedAt: Date.now() };
        } catch {
          state.failures++;
        }
      }, "setDecision");
      return Object.freeze({
        record,
        fault,
        request,
        updateRequest,
        boundary,
        setDecision,
        host,
        size,
        verbose(persisted) {
          state.persisted = persisted;
          state.verboseChangedAt = Date.now();
          record("verbose", { enabled: Config.verbose, persisted }, true);
        },
        sample(data) {
          if (Date.now() - lastSampleAt >= 5e3) {
            lastSampleAt = Date.now();
            record("sample", data);
          }
        },
        summary() {
          prune();
          return { ...state, verbose: Config.verbose, critical: critical.length, detail: detail.length, pending: pending.size };
        },
        snapshot() {
          prune();
          return JSON.parse(JSON.stringify({
            ...state,
            verbose: Config.verbose,
            decision,
            critical,
            detail,
            pending: [...pending.values()].map((r) => ({ ...r, ageMs: Math.max(0, Date.now() - r.startAt) }))
          }));
        }
      });
    })();
    try {
      Config.verbose = !!GM_getValue("verbose");
      DiagnosticLog.verbose(true);
    } catch {
      DiagnosticLog.record("settings-read", {}, true);
      DiagnosticLog.verbose(null);
    }
    const log = /* @__PURE__ */ __name((...args) => {
      try {
        if (Config.verbose) console.log("[" + PluginName + "]:", ...args);
      } catch {
      }
    }, "log");
    const err = /* @__PURE__ */ __name((...args) => {
      try {
        if (Config.verbose) console.error("[" + PluginName + "]:", ...args);
      } catch {
      }
    }, "err");
    return {
      get PluginName() {
        return PluginName;
      },
      get Config() {
        return Config;
      },
      get DiagnosticLog() {
        return DiagnosticLog;
      },
      get log() {
        return log;
      },
      get err() {
        return err;
      }
    };
  }
  __name(createEvents, "createEvents");

  // src/runtime/generation.mjs
  function createRuntime(deps) {
    let disabled = !!GM_getValue("disabled");
    let runtimeGeneration = 0;
    let runtimeAbortController = null;
    const runtimeTimeouts = /* @__PURE__ */ new Set();
    const clearRuntimeTimeout = /* @__PURE__ */ __name((timer) => {
      if (timer == null) return;
      clearTimeout(timer);
      runtimeTimeouts.delete(timer);
    }, "clearRuntimeTimeout");
    const scheduleRuntimeTimeout = /* @__PURE__ */ __name((callback, delay) => {
      const generation = runtimeGeneration;
      const timer = setTimeout(() => {
        runtimeTimeouts.delete(timer);
        if (disabled || generation !== runtimeGeneration) return;
        callback();
      }, delay);
      runtimeTimeouts.add(timer);
      return timer;
    }, "scheduleRuntimeTimeout");
    const stopRuntimeGeneration = /* @__PURE__ */ __name(() => {
      runtimeGeneration++;
      deps.DiagnosticLog.boundary(runtimeGeneration, deps.playinfoEpoch, disabled ? "disabled" : "active");
      deps.resetMediaDelivery();
      deps.invalidateCodecQueries();
      deps.resetPlaybackQuality();
      if (runtimeAbortController) {
        try {
          runtimeAbortController.abort();
        } catch {
        }
        runtimeAbortController = null;
      }
      runtimeTimeouts.forEach((timer) => clearTimeout(timer));
      runtimeTimeouts.clear();
    }, "stopRuntimeGeneration");
    const beginRuntimeGeneration = /* @__PURE__ */ __name(() => {
      stopRuntimeGeneration();
      if (disabled) return null;
      try {
        runtimeAbortController = new AbortController();
      } catch {
        runtimeAbortController = null;
      }
      return runtimeAbortController ? { generation: runtimeGeneration, signal: runtimeAbortController.signal } : { generation: runtimeGeneration, signal: null };
    }, "beginRuntimeGeneration");
    const captureRuntimeGeneration = /* @__PURE__ */ __name(() => ({
      generation: runtimeGeneration,
      signal: runtimeAbortController ? runtimeAbortController.signal : null
    }), "captureRuntimeGeneration");
    const isRuntimeGenerationActive = /* @__PURE__ */ __name((token) => !!token && !disabled && token.generation === runtimeGeneration && (!token.signal || !token.signal.aborted), "isRuntimeGenerationActive");
    const reportMeasurementFailure = /* @__PURE__ */ __name(() => {
      const token = captureRuntimeGeneration(), epoch = deps.playinfoEpoch;
      return () => {
        if (isRuntimeGenerationActive(token) && epoch === deps.playinfoEpoch) deps.DiagnosticLog.fault("measurement");
      };
    }, "reportMeasurementFailure");
    let uiInjectStatus = "pending";
    return {
      get disabled() {
        return disabled;
      },
      set disabled(value) {
        disabled = value;
      },
      get runtimeGeneration() {
        return runtimeGeneration;
      },
      set runtimeGeneration(value) {
        runtimeGeneration = value;
      },
      get clearRuntimeTimeout() {
        return clearRuntimeTimeout;
      },
      get scheduleRuntimeTimeout() {
        return scheduleRuntimeTimeout;
      },
      get stopRuntimeGeneration() {
        return stopRuntimeGeneration;
      },
      get beginRuntimeGeneration() {
        return beginRuntimeGeneration;
      },
      get captureRuntimeGeneration() {
        return captureRuntimeGeneration;
      },
      get isRuntimeGenerationActive() {
        return isRuntimeGenerationActive;
      },
      get reportMeasurementFailure() {
        return reportMeasurementFailure;
      },
      get uiInjectStatus() {
        return uiInjectStatus;
      },
      set uiInjectStatus(value) {
        uiInjectStatus = value;
      }
    };
  }
  __name(createRuntime, "createRuntime");

  // src/policy/catalog.mjs
  function createCatalog(deps) {
    const INITIAL_DEAD_HOSTS_TW = [
      "upos-sz-mirrorhwov.bilivideo.com",
      // 台灣 DNS 普遍屏蔽
      "upos-sz-mirrorhw.bilivideo.com",
      // 台灣 IP 區域拒絕 (HTTP 959)
      "upos-hz-mirroraliov.bilivideo.com"
      // 杭州內網域名，台灣 DNS 不解析
    ];
    const PLAYURL_PREFIXES = [
      "https://api.bilibili.com/x/player/wbi/playurl",
      "https://api.bilibili.com/pgc/player/web/v2/playurl",
      "https://api.bilibili.com/x/player/playurl",
      "https://api.bilibili.com/pgc/player/web/playurl",
      "https://api.bilibili.com/pugv/player/web/playurl",
      "https://api.bilibili.com/pugv/player/web/v2/playurl",
      "https://api.bilibili.com/x/player/ugc/playurl",
      "https://api.bilibili.com/x/player/wbi/ugc/playurl",
      "https://api.bilibili.com/x/player/season/playurl",
      "https://api.bilibili.com/x/player/wbi/season/playurl"
    ];
    const isPlayUrlApi = /* @__PURE__ */ __name((url) => {
      if (!url) return false;
      if (PLAYURL_PREFIXES.some((p) => url.startsWith(p))) return true;
      try {
        const u = new URL(url);
        return u.hostname === "api.bilibili.com" && /\/player\/.*playurl/.test(u.pathname);
      } catch {
        return false;
      }
    }, "isPlayUrlApi");
    const PREFERRED_CDN_LIST_RAW = [
      // 海外（ov）：對台灣線路最短，兩次獨立量測都最快
      "upos-sz-mirroraliov.bilivideo.com",
      // cosov 留在 RAW 清單但被 ExcludeHostKeywords 預設排除（見上方說明）。
      // 保留在這裡是為了讓使用者可由可信 Tampermonkey 選單明確啟用，不必改原始碼。
      "upos-sz-mirrorcosov.bilivideo.com",
      // 境內鏡像：實測都能服務簽名路徑，快慢因人而異，交給本機資料排序
      "upos-sz-mirrorali.bilivideo.com",
      "upos-sz-mirroralib.bilivideo.com",
      "upos-sz-mirrorali02.bilivideo.com",
      "upos-sz-mirrorbos.bilivideo.com",
      "upos-tf-all-tx.bilivideo.com",
      "upos-sz-mirrorcos.bilivideo.com",
      // 以下三個在台灣已知不可用（INITIAL_DEAD_HOSTS_TW），留在清單裡是為了讓
      // 「本機實測成功過一次就自動解除推定」這條路仍然成立（換電信商/VPN 可能可用）
      "upos-sz-mirrorhwov.bilivideo.com",
      "upos-sz-mirrorhw.bilivideo.com",
      "upos-hz-mirroraliov.bilivideo.com"
    ];
    const TRUSTED_CDN_CATALOG = Object.freeze([...PREFERRED_CDN_LIST_RAW]);
    const TRUSTED_CDN_CATALOG_SET = new Set(TRUSTED_CDN_CATALOG);
    const CATALOG_OVERRIDES_KEY = "catalogOverrides_v1";
    const matchesHeaderExclude = /* @__PURE__ */ __name((host) => {
      if (!host) return false;
      return deps.ExcludeHostKeywords.some((kw) => kw && host.indexOf(kw) !== -1);
    }, "matchesHeaderExclude");
    const catalogOverrides = (() => {
      let raw = GM_getValue(CATALOG_OVERRIDES_KEY, null);
      let parsed = raw;
      let dirty = false;
      if (typeof raw === "string") {
        dirty = true;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = null;
          dirty = true;
        }
      }
      const out = /* @__PURE__ */ Object.create(null);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        Object.entries(parsed).forEach(([host, enabled]) => {
          if (TRUSTED_CDN_CATALOG_SET.has(host) && typeof enabled === "boolean") out[host] = enabled;
          else dirty = true;
        });
      } else if (raw != null) {
        dirty = true;
      }
      const nonPresumed = TRUSTED_CDN_CATALOG.filter((host) => !INITIAL_DEAD_HOSTS_TW.includes(host));
      const hasUsable = nonPresumed.some((host) => Object.prototype.hasOwnProperty.call(out, host) ? out[host] : !matchesHeaderExclude(host));
      if (!hasUsable) {
        Object.keys(out).forEach((host) => delete out[host]);
        dirty = true;
      }
      try {
        if (dirty) {
          if (Object.keys(out).length) GM_setValue(CATALOG_OVERRIDES_KEY, { ...out });
          else GM_deleteValue(CATALOG_OVERRIDES_KEY);
        }
      } catch {
      }
      return out;
    })();
    const isCatalogAutoEnabled = /* @__PURE__ */ __name((host) => {
      if (!TRUSTED_CDN_CATALOG_SET.has(host)) return false;
      if (Object.prototype.hasOwnProperty.call(catalogOverrides, host)) return catalogOverrides[host];
      return !matchesHeaderExclude(host);
    }, "isCatalogAutoEnabled");
    const matchesExclude = /* @__PURE__ */ __name((host) => TRUSTED_CDN_CATALOG_SET.has(host) ? !isCatalogAutoEnabled(host) : matchesHeaderExclude(host), "matchesExclude");
    const isValidCustomCdnHost = /* @__PURE__ */ __name((host) => {
      if (!host || typeof host !== "string") return false;
      return TRUSTED_CDN_CATALOG_SET.has(host.trim().toLowerCase());
    }, "isValidCustomCdnHost");
    const PREFERRED_CDN_LIST = [];
    const rebuildPreferredCdnList = /* @__PURE__ */ __name(() => {
      const next = PREFERRED_CDN_LIST_RAW.filter(isCatalogAutoEnabled);
      PREFERRED_CDN_LIST.splice(0, PREFERRED_CDN_LIST.length, ...next);
    }, "rebuildPreferredCdnList");
    rebuildPreferredCdnList();
    return {
      get INITIAL_DEAD_HOSTS_TW() {
        return INITIAL_DEAD_HOSTS_TW;
      },
      get isPlayUrlApi() {
        return isPlayUrlApi;
      },
      get TRUSTED_CDN_CATALOG() {
        return TRUSTED_CDN_CATALOG;
      },
      get TRUSTED_CDN_CATALOG_SET() {
        return TRUSTED_CDN_CATALOG_SET;
      },
      get CATALOG_OVERRIDES_KEY() {
        return CATALOG_OVERRIDES_KEY;
      },
      get matchesHeaderExclude() {
        return matchesHeaderExclude;
      },
      get catalogOverrides() {
        return catalogOverrides;
      },
      get isCatalogAutoEnabled() {
        return isCatalogAutoEnabled;
      },
      get matchesExclude() {
        return matchesExclude;
      },
      get isValidCustomCdnHost() {
        return isValidCustomCdnHost;
      },
      get PREFERRED_CDN_LIST() {
        return PREFERRED_CDN_LIST;
      },
      get rebuildPreferredCdnList() {
        return rebuildPreferredCdnList;
      }
    };
  }
  __name(createCatalog, "createCatalog");

  // src/routing/health.mjs
  function createHealth(deps) {
    const BLACKLIST_EXPIRE_MS = 24 * 60 * 60 * 1e3;
    const CDN_FAIL_THRESHOLD = 2;
    const HARD_FAIL_STATUSES = /* @__PURE__ */ new Set([403, 451, 959]);
    const CDN_SOFT_BLOCK_MS = 10 * 60 * 1e3;
    const CDN_SOFT_BLOCK_ESCALATE = 3;
    const CDN_HEALTH_KEY = "cdnHealth_v1";
    const CDN_HEALTH_TTL = 6 * 60 * 60 * 1e3;
    const createRestrictionStore = /* @__PURE__ */ __name((key, hostField, ttlFor) => {
      const records = /* @__PURE__ */ new Map(), index = /* @__PURE__ */ new Set();
      const read = /* @__PURE__ */ __name(() => {
        let raw;
        try {
          raw = JSON.parse(GM_getValue(key) || "[]");
        } catch {
          raw = [];
        }
        const entries = /* @__PURE__ */ new Map(), now = Date.now();
        if (Array.isArray(raw)) for (const entry of raw) {
          const host = entry?.[hostField];
          if (!deps.TRUSTED_CDN_CATALOG_SET.has(host) || !Number.isFinite(entry.expireAt)) continue;
          const reason = typeof entry.reason === "string" ? entry.reason.slice(0, 64) : "unknown";
          const expireAt = Math.min(entry.expireAt, now + ttlFor(reason));
          if (expireAt <= now) continue;
          const value = hostField === "host" ? { host, expireAt, reason } : { cdn: host, expireAt };
          if (!entries.has(host) || expireAt > entries.get(host).expireAt) entries.set(host, value);
        }
        return entries;
      }, "read");
      const adopt = /* @__PURE__ */ __name((next) => {
        records.clear();
        index.clear();
        for (const [host, entry] of next) {
          records.set(host, entry);
          index.add(host);
        }
      }, "adopt");
      const persist = /* @__PURE__ */ __name((next) => {
        const serialized = JSON.stringify([...next.values()]);
        try {
          if ((GM_getValue(key) || "[]") !== serialized) GM_setValue(key, serialized);
        } catch {
        }
        adopt(next);
      }, "persist");
      const refresh = /* @__PURE__ */ __name((write = true) => {
        const next = read();
        if (write) persist(next);
        else adopt(next);
      }, "refresh");
      const remove = /* @__PURE__ */ __name((host) => {
        const next = read();
        next.delete(host);
        persist(next);
      }, "remove");
      const add = /* @__PURE__ */ __name((host, reason = "unknown") => {
        if (!deps.TRUSTED_CDN_CATALOG_SET.has(host)) return;
        const next = read();
        if (!next.has(host)) next.set(host, hostField === "host" ? { host, expireAt: Date.now() + ttlFor(reason), reason } : { cdn: host, expireAt: Date.now() + ttlFor(reason) });
        persist(next);
      }, "add");
      refresh(false);
      return { records, index, refresh, add, remove, clear: /* @__PURE__ */ __name(() => persist(/* @__PURE__ */ new Map()), "clear") };
    }, "createRestrictionStore");
    const blacklistRecords = createRestrictionStore("cdnBlacklist", "cdn", () => BLACKLIST_EXPIRE_MS);
    const blacklistSet = blacklistRecords.index;
    const DEAD_HOSTS_KEY = "knownDeadHosts_v1";
    const DEAD_HOSTS_TTL = 7 * 24 * 60 * 60 * 1e3;
    const DEAD_HOSTS_DNS_TTL = 30 * 24 * 60 * 60 * 1e3;
    const DEAD_HOSTS_TIMEOUT_TTL = 24 * 60 * 60 * 1e3;
    const isDnsReason = /* @__PURE__ */ __name((reason) => typeof reason === "string" && reason.indexOf("DNS") === 0, "isDnsReason");
    const isTimeoutReason = /* @__PURE__ */ __name((reason) => typeof reason === "string" && reason.indexOf("timeout") === 0, "isTimeoutReason");
    const deadTtlFor = /* @__PURE__ */ __name((reason) => isDnsReason(reason) ? DEAD_HOSTS_DNS_TTL : isTimeoutReason(reason) ? DEAD_HOSTS_TIMEOUT_TTL : DEAD_HOSTS_TTL, "deadTtlFor");
    const deadHostRecords = createRestrictionStore(DEAD_HOSTS_KEY, "host", deadTtlFor);
    const knownDeadHosts = deadHostRecords.index;
    try {
      const installedVersion = GM_getValue("blicdnVersion");
      if (installedVersion !== deps.VERSION) {
        if (!installedVersion || !deps.verGte(installedVersion, "1.7.0")) {
          try {
            GM_deleteValue("workerStats_v1");
          } catch {
          }
        }
        GM_deleteValue("probeCache_v1");
        if (!installedVersion || !deps.verGte(installedVersion, "1.0.0")) {
          GM_setValue("cdnBlacklist", "[]");
          GM_deleteValue("probeCache_v1");
        }
        GM_setValue("blicdnVersion", deps.VERSION);
      }
    } catch {
    }
    const markHostDead = /* @__PURE__ */ __name((host, reason) => {
      if (!deps.isValidCustomCdnHost(host) || knownDeadHosts.has(host)) return;
      deadHostRecords.add(host, reason || "unknown");
      const idx = activeCdnList.indexOf(host);
      if (idx !== -1) activeCdnList.splice(idx, 1);
    }, "markHostDead");
    const listDeadHosts = /* @__PURE__ */ __name(() => [...deadHostRecords.records.values()].map((e) => ({
      host: e.host,
      reason: e.reason || "unknown",
      daysLeft: +Math.max(0, (e.expireAt - Date.now()) / 864e5).toFixed(1)
    })), "listDeadHosts");
    const reviveDeadHost = /* @__PURE__ */ __name((host) => {
      if (!host) return false;
      deadHostRecords.remove(host);
      const h = cdnHealth[host];
      if (h) {
        h.probeTimeouts = 0;
        h.failures = 0;
      }
      if (!activeCdnList.includes(host) && !blacklistSet.has(host) && deps.PREFERRED_CDN_LIST.includes(host)) {
        activeCdnList.push(host);
      }
      delete cdnFailCount[host];
      delete cdnSoftBlockUntil[host];
      try {
        GM_deleteValue(deps.PROBE_CACHE_KEY);
      } catch {
      }
      scheduleCdnHealthSave();
      return true;
    }, "reviveDeadHost");
    const clearDeadHosts = /* @__PURE__ */ __name(() => {
      deadHostRecords.clear();
      try {
        GM_deleteValue(deps.PROBE_CACHE_KEY);
      } catch {
      }
      deps.PREFERRED_CDN_LIST.forEach((c) => {
        if (!activeCdnList.includes(c) && !blacklistSet.has(c)) activeCdnList.push(c);
      });
      activeCdnList.sort((a, b) => deps.PREFERRED_CDN_LIST.indexOf(a) - deps.PREFERRED_CDN_LIST.indexOf(b));
      deps.log("[死節點] 已清除，所有白名單節點重新啟用");
    }, "clearDeadHosts");
    const activeCdnList = deps.PREFERRED_CDN_LIST.filter((c) => !blacklistSet.has(c) && !knownDeadHosts.has(c));
    let refreshingRestrictions = false;
    const refreshExpiredRestrictions = /* @__PURE__ */ __name(() => {
      if (deps.disabled || refreshingRestrictions) return;
      refreshingRestrictions = true;
      try {
        const before = /* @__PURE__ */ new Set([...blacklistSet, ...knownDeadHosts]);
        blacklistRecords.refresh();
        deadHostRecords.refresh();
        for (let i = activeCdnList.length - 1; i >= 0; i--) {
          if (blacklistSet.has(activeCdnList[i]) || knownDeadHosts.has(activeCdnList[i])) activeCdnList.splice(i, 1);
        }
        for (const host of before) {
          if (!blacklistSet.has(host) && !knownDeadHosts.has(host) && deps.PREFERRED_CDN_LIST.includes(host) && !activeCdnList.includes(host)) activeCdnList.push(host);
        }
      } finally {
        refreshingRestrictions = false;
      }
    }, "refreshExpiredRestrictions");
    const countUsableCandidates = /* @__PURE__ */ __name((excluding) => deps.PREFERRED_CDN_LIST.filter(
      (c) => c !== excluding && !deps.matchesExclude(c) && !knownDeadHosts.has(c) && !blacklistSet.has(c) && !isPresumedDnsFailHost(c)
    ).length, "countUsableCandidates");
    const MIN_USABLE_POOL = 2;
    const addToBlacklist = /* @__PURE__ */ __name((cdn) => {
      if (!cdn || blacklistSet.has(cdn)) return;
      if (countUsableCandidates(cdn) < MIN_USABLE_POOL) {
        const now = Date.now();
        cdnSoftBlockUntil[cdn] = now + CDN_SOFT_BLOCK_MS;
        const h = ensureCdnHealth(cdn);
        if (h) {
          h.softBlocks++;
          h.lastSoftBlockAt = now;
          h.lastSoftBlockReason = "pool-protect";
          h.lastSeen = now;
          scheduleCdnHealthSave();
        }
        deps.log("[黑名單] 略過 " + cdn.split(".")[0] + "：關掉它會讓可用節點少於 " + MIN_USABLE_POOL + " 個，改為短期軟隔離");
        return;
      }
      blacklistRecords.add(cdn);
      delete cdnSoftBlockUntil[cdn];
      const idx = activeCdnList.indexOf(cdn);
      if (idx !== -1) activeCdnList.splice(idx, 1);
    }, "addToBlacklist");
    const clearBlacklist = /* @__PURE__ */ __name(() => {
      blacklistRecords.clear();
      Object.keys(cdnSoftBlockUntil).forEach((c) => delete cdnSoftBlockUntil[c]);
      deps.PREFERRED_CDN_LIST.forEach((c) => {
        if (!activeCdnList.includes(c)) activeCdnList.push(c);
      });
      activeCdnList.sort((a, b) => deps.PREFERRED_CDN_LIST.indexOf(a) - deps.PREFERRED_CDN_LIST.indexOf(b));
      deps.log("[黑名單] 已全部清除，所有白名單節點重新啟用");
    }, "clearBlacklist");
    const cdnFailCount = {};
    const cdnSoftBlockUntil = {};
    const THROUGHPUT_SCHEMA_KEY = "throughputSchema";
    const THROUGHPUT_SCHEMA_VER = 3;
    const CDN_HEALTH_CAPS = Object.freeze({
      samples: 12,
      successes: 12,
      failures: 2,
      slowSamples: 3,
      probeTimeouts: 3,
      probeSlows: 3
    });
    const throughputSchemaStale = (() => {
      try {
        if ((+GM_getValue(THROUGHPUT_SCHEMA_KEY) || 0) >= THROUGHPUT_SCHEMA_VER) return false;
        GM_setValue(THROUGHPUT_SCHEMA_KEY, THROUGHPUT_SCHEMA_VER);
        return true;
      } catch {
        return false;
      }
    })();
    const cdnHealth = (() => {
      try {
        const raw = JSON.parse(GM_getValue(CDN_HEALTH_KEY) || "{}");
        const now = Date.now();
        const out = {};
        Object.entries(raw).forEach(([cdn, h]) => {
          if (!cdn || !h || !deps.TRUSTED_CDN_CATALOG_SET.has(cdn)) return;
          if (knownDeadHosts.has(cdn) || blacklistSet.has(cdn)) return;
          if (!h.lastSeen || now - h.lastSeen > CDN_HEALTH_TTL) return;
          const hasCurrentThroughput = !throughputSchemaStale && (+h.lastThroughputAt || 0) > 0;
          out[cdn] = {
            ewmaMbps: hasCurrentThroughput ? +h.ewmaMbps || 0 : 0,
            varMbps: hasCurrentThroughput ? +h.varMbps || 0 : 0,
            samples: hasCurrentThroughput ? Math.min(+h.samples || 0, CDN_HEALTH_CAPS.samples) : 0,
            bytes: +h.bytes || 0,
            failures: Math.min(+h.failures || 0, CDN_HEALTH_CAPS.failures),
            successes: Math.min(+h.successes || 0, CDN_HEALTH_CAPS.successes),
            slowSamples: hasCurrentThroughput ? Math.min(+h.slowSamples || 0, CDN_HEALTH_CAPS.slowSamples) : 0,
            // ★ 兩個 strike 計數必須讀回來，否則「連續 N 輪才定罪」只在單一頁面
            // session 內成立——重整一次就歸零，等於門檻永遠達不到。
            // probeTimeouts 是既有欄位（有寫入存檔卻從沒被讀回，是個只寫不讀的欄位）；
            // probeSlows 是 2026-08-19 新增時漏接的。兩者都用小上限夾住，
            // 避免任何殘留的異常值一載入就直接把節點定罪。
            // 上限寫字面量而不是引用 PROBE_*_STRIKES：那兩個常數定義在本檔案更後面，
            // 這裡是載入期就會執行的 IIFE，引用會踩到 TDZ。
            probeTimeouts: Math.min(+h.probeTimeouts || 0, CDN_HEALTH_CAPS.probeTimeouts),
            probeSlows: Math.min(+h.probeSlows || 0, CDN_HEALTH_CAPS.probeSlows),
            softBlocks: 0,
            latencyMs: +h.latencyMs || 0,
            // v1.4.0：吞吐、延遲、成功、失敗各自有時間戳。lastSeen 只負責資料 TTL，
            // 不再被拿來替舊吞吐樣本「續命」。schema v3 會清除舊版受污染的吞吐資料。
            lastThroughputAt: hasCurrentThroughput ? +h.lastThroughputAt || 0 : 0,
            lastLatencyAt: +h.lastLatencyAt || 0,
            lastSuccessAt: +h.lastSuccessAt || 0,
            lastFailureAt: +h.lastFailureAt || 0,
            lastProbeAt: +h.lastProbeAt || 0,
            lastSeen: +h.lastSeen || 0,
            lastSlowAt: +h.lastSlowAt || 0,
            lastSoftBlockAt: 0,
            lastSoftBlockReason: ""
          };
        });
        return out;
      } catch {
        return {};
      }
    })();
    const CDN_THROUGHPUT_ALPHA = 0.35;
    let cdnHealthSaveTimer = null;
    const scheduleCdnHealthSave = /* @__PURE__ */ __name(() => {
      if (cdnHealthSaveTimer) return;
      cdnHealthSaveTimer = setTimeout(() => {
        cdnHealthSaveTimer = null;
        try {
          const now = Date.now();
          let stored = {};
          try {
            stored = JSON.parse(GM_getValue(CDN_HEALTH_KEY) || "{}") || {};
          } catch {
          }
          const payload = {};
          const allCdns = /* @__PURE__ */ new Set([...Object.keys(stored), ...Object.keys(cdnHealth)]);
          const newerBy = /* @__PURE__ */ __name((a, b, key) => {
            if (!a) return b || null;
            if (!b) return a;
            return (+a[key] || 0) >= (+b[key] || 0) ? a : b;
          }, "newerBy");
          allCdns.forEach((cdn) => {
            if (!deps.TRUSTED_CDN_CATALOG_SET.has(cdn)) return;
            if (knownDeadHosts.has(cdn) || blacklistSet.has(cdn)) return;
            const mine = cdnHealth[cdn];
            const theirs = stored[cdn];
            const state = newerBy(mine, theirs, "lastSeen");
            const throughput = newerBy(mine, theirs, "lastThroughputAt") || state;
            const latency = newerBy(mine, theirs, "lastLatencyAt") || state;
            const success = newerBy(mine, theirs, "lastSuccessAt") || state;
            const failure = newerBy(mine, theirs, "lastFailureAt") || state;
            const probe = newerBy(mine, theirs, "lastProbeAt") || state;
            if (!state || !state.lastSeen || now - state.lastSeen > CDN_HEALTH_TTL) return;
            const hasThroughput = !!(throughput && +throughput.lastThroughputAt > 0);
            payload[cdn] = {
              ewmaMbps: hasThroughput ? +throughput.ewmaMbps || 0 : 0,
              varMbps: hasThroughput ? +throughput.varMbps || 0 : 0,
              samples: hasThroughput ? Math.min(+throughput.samples || 0, CDN_HEALTH_CAPS.samples) : 0,
              // bytes 是各分頁的本機累計，無法安全相加（可能含共同舊基準），取最大值避免重複灌水。
              bytes: Math.max(+(mine && mine.bytes) || 0, +(theirs && theirs.bytes) || 0),
              failures: Math.min(+failure.failures || 0, CDN_HEALTH_CAPS.failures),
              successes: Math.min(+success.successes || 0, CDN_HEALTH_CAPS.successes),
              slowSamples: hasThroughput ? Math.min(+throughput.slowSamples || 0, CDN_HEALTH_CAPS.slowSamples) : 0,
              probeTimeouts: Math.min(+probe.probeTimeouts || 0, CDN_HEALTH_CAPS.probeTimeouts),
              probeSlows: Math.min(+probe.probeSlows || 0, CDN_HEALTH_CAPS.probeSlows),
              latencyMs: +latency.latencyMs || 0,
              lastThroughputAt: hasThroughput ? +throughput.lastThroughputAt || 0 : 0,
              lastLatencyAt: Math.max(+(mine && mine.lastLatencyAt) || 0, +(theirs && theirs.lastLatencyAt) || 0),
              lastSuccessAt: Math.max(+(mine && mine.lastSuccessAt) || 0, +(theirs && theirs.lastSuccessAt) || 0),
              lastFailureAt: Math.max(+(mine && mine.lastFailureAt) || 0, +(theirs && theirs.lastFailureAt) || 0),
              lastProbeAt: Math.max(+(mine && mine.lastProbeAt) || 0, +(theirs && theirs.lastProbeAt) || 0),
              lastSeen: Math.max(+(mine && mine.lastSeen) || 0, +(theirs && theirs.lastSeen) || 0),
              lastSlowAt: +throughput.lastSlowAt || 0
            };
          });
          GM_setValue(CDN_HEALTH_KEY, JSON.stringify(payload));
        } catch {
          deps.DiagnosticLog.fault("health-save");
        }
      }, 1e3);
    }, "scheduleCdnHealthSave");
    const getRequiredStreamMbps = /* @__PURE__ */ __name((playbackRate, mode) => {
      const rate = deps.getEffectivePlaybackRate(playbackRate);
      const streamMbps = deps.currentStreamBitsPerSec > 0 ? deps.currentStreamBitsPerSec / 1e6 : 4;
      const factor = mode === "startup" ? 0.75 : 1.05;
      return Math.max(1.5, streamMbps * rate * factor);
    }, "getRequiredStreamMbps");
    const ensureCdnHealth = /* @__PURE__ */ __name((cdn) => {
      if (!cdn || !deps.TRUSTED_CDN_CATALOG_SET.has(cdn)) return null;
      if (!cdnHealth[cdn]) {
        cdnHealth[cdn] = {
          ewmaMbps: 0,
          varMbps: 0,
          samples: 0,
          bytes: 0,
          failures: 0,
          successes: 0,
          slowSamples: 0,
          softBlocks: 0,
          probeTimeouts: 0,
          probeSlows: 0,
          latencyMs: 0,
          lastThroughputAt: 0,
          lastLatencyAt: 0,
          lastSuccessAt: 0,
          lastFailureAt: 0,
          lastProbeAt: 0,
          lastSeen: 0,
          lastSlowAt: 0,
          lastSoftBlockAt: 0,
          lastSoftBlockReason: ""
        };
      }
      return cdnHealth[cdn];
    }, "ensureCdnHealth");
    if (deps.INITIAL_DEAD_HOSTS_TW.length) {
      deps.INITIAL_DEAD_HOSTS_TW.forEach((h) => {
        const existing = cdnHealth[h];
        if (existing && ((existing.successes || 0) > 0 || (existing.samples || 0) > 0)) return;
        const c = ensureCdnHealth(h);
        if (c) {
          const now = Date.now();
          c.failures = Math.max(c.failures || 0, 1);
          c.lastFailureAt = now;
          c.lastSeen = now;
        }
      });
    }
    const KNOWN_BAD_TW_HOSTS = new Set(deps.INITIAL_DEAD_HOSTS_TW);
    const isPresumedDnsFailHost = /* @__PURE__ */ __name((host) => {
      if (!host || !KNOWN_BAD_TW_HOSTS.has(host)) return false;
      const h = cdnHealth[host];
      return !h || (h.successes || 0) === 0 && (h.samples || 0) === 0;
    }, "isPresumedDnsFailHost");
    const isCdnSoftBlocked = /* @__PURE__ */ __name((cdn) => {
      const until = cdnSoftBlockUntil[cdn] || 0;
      if (!until) return false;
      if (until <= Date.now()) {
        delete cdnSoftBlockUntil[cdn];
        return false;
      }
      return true;
    }, "isCdnSoftBlocked");
    const recordCdnLatency = /* @__PURE__ */ __name((cdn, latencyMs) => {
      if (!cdn || !Number.isFinite(latencyMs) || latencyMs <= 0) return;
      const h = ensureCdnHealth(cdn);
      if (!h) return;
      if (h.probeTimeouts) h.probeTimeouts = 0;
      h.latencyMs = h.latencyMs ? h.latencyMs * 0.65 + latencyMs * 0.35 : latencyMs;
      const now = Date.now();
      h.lastLatencyAt = now;
      h.lastProbeAt = now;
      h.lastSeen = now;
      scheduleCdnHealthSave();
    }, "recordCdnLatency");
    const softBlockCdn = /* @__PURE__ */ __name((cdn, reason, durationMs) => {
      if (!cdn || blacklistSet.has(cdn) || knownDeadHosts.has(cdn)) return;
      const h = ensureCdnHealth(cdn);
      if (!h) return;
      h.softBlocks++;
      h.lastSoftBlockAt = Date.now();
      h.lastSoftBlockReason = reason || "slow";
      cdnSoftBlockUntil[cdn] = Date.now() + (durationMs || CDN_SOFT_BLOCK_MS);
      if (h.softBlocks >= CDN_SOFT_BLOCK_ESCALATE && h.failures >= 2) addToBlacklist(cdn);
      scheduleCdnHealthSave();
    }, "softBlockCdn");
    const MIN_THROUGHPUT_SAMPLE_BYTES = 128 * 1024;
    const MIN_THROUGHPUT_SAMPLE_MS = 5;
    const XHR_TIMEOUT_MIN_ELAPSED_MS = 3e3;
    const XHR_TIMEOUT_HOST_GAP_MS = 30 * 1e3;
    const TRUSTED_XHR_TIMEOUT_EVIDENCE = /* @__PURE__ */ Symbol("BiliCDN native XHR timeout evidence");
    const acceptedXhrTimeoutAt = /* @__PURE__ */ new Map();
    const recordCdnThroughput = /* @__PURE__ */ __name((cdn, bytes, durationMs, playbackRate) => {
      if (!cdn || !bytes || !durationMs || durationMs <= 0) return { accepted: false, status: "ineligible" };
      if (blacklistSet.has(cdn) || knownDeadHosts.has(cdn) || deps.isUnstableCdnHost(cdn)) return { accepted: false, status: "ineligible" };
      const mbps = bytes * 8 / durationMs / 1e3;
      if (!Number.isFinite(mbps) || mbps <= 0) return { accepted: false, status: "ineligible" };
      const h = ensureCdnHealth(cdn);
      if (!h) return { accepted: false, status: "ineligible" };
      h.bytes += bytes;
      h.lastSeen = Date.now();
      if (bytes < MIN_THROUGHPUT_SAMPLE_BYTES || durationMs < MIN_THROUGHPUT_SAMPLE_MS) {
        scheduleCdnHealthSave();
        return { accepted: false, status: "insufficient", bytes, durationMs };
      }
      h.lastThroughputAt = h.lastSeen;
      if (h.samples) {
        const diff = mbps - h.ewmaMbps;
        const incr = CDN_THROUGHPUT_ALPHA * diff;
        h.ewmaMbps += incr;
        h.varMbps = (1 - CDN_THROUGHPUT_ALPHA) * ((h.varMbps || 0) + diff * incr);
      } else {
        h.ewmaMbps = mbps;
        h.varMbps = 0;
      }
      h.samples = Math.min(CDN_HEALTH_CAPS.samples, h.samples + 1);
      const required = getRequiredStreamMbps(playbackRate, "steady");
      if (mbps < required) {
        h.slowSamples = Math.min(CDN_HEALTH_CAPS.slowSamples, h.slowSamples + 1);
        h.lastSlowAt = h.lastSeen;
      } else {
        h.slowSamples = Math.max(0, h.slowSamples - 1);
      }
      scheduleCdnHealthSave();
      return { accepted: true, status: "throughput", bytes, durationMs, mbps };
    }, "recordCdnThroughput");
    const recordCdnPenalty = /* @__PURE__ */ __name((cdn, hard) => {
      const h = ensureCdnHealth(cdn);
      if (!h) return;
      h.failures = Math.min(CDN_HEALTH_CAPS.failures, h.failures + (hard ? 3 : 1));
      const now = Date.now();
      h.lastFailureAt = now;
      h.lastSeen = now;
      scheduleCdnHealthSave();
    }, "recordCdnPenalty");
    const recordCdnHealthSuccess = /* @__PURE__ */ __name((cdn, requestStartedAt) => {
      const h = ensureCdnHealth(cdn);
      if (!h) return false;
      const mayRecover = !requestStartedAt || requestStartedAt >= (h.lastFailureAt || 0);
      h.successes = Math.min(CDN_HEALTH_CAPS.successes, h.successes + 1);
      if (mayRecover) h.failures = Math.max(0, h.failures - 1);
      const now = Date.now();
      h.lastSuccessAt = now;
      h.lastSeen = now;
      if (mayRecover && requestStartedAt >= (h.lastSoftBlockAt || 0) && cdnSoftBlockUntil[cdn]) {
        delete cdnSoftBlockUntil[cdn];
        h.lastSoftBlockReason = "";
      }
      scheduleCdnHealthSave();
      return mayRecover;
    }, "recordCdnHealthSuccess");
    const UCB_EXPLORE_C = 0.6;
    const THROUGHPUT_HALFLIFE_MS = 8 * 60 * 1e3;
    const JITTER_WEIGHT = 0.4;
    const JITTER_PENALTY_CAP = 0.35;
    const JITTER_PRIOR_CV = 0.25;
    const JITTER_PRIOR_WEIGHT = 2;
    const getEffectiveSamples = /* @__PURE__ */ __name((cdn) => {
      const h = cdnHealth[cdn];
      if (!h || !h.samples) return 0;
      const age = Math.max(0, Date.now() - (h.lastThroughputAt || 0));
      return h.samples * Math.pow(0.5, age / THROUGHPUT_HALFLIFE_MS);
    }, "getEffectiveSamples");
    const getTotalEffectiveSamples = /* @__PURE__ */ __name(() => {
      let n = 0;
      for (const k in cdnHealth) n += getEffectiveSamples(k);
      return n;
    }, "getTotalEffectiveSamples");
    const scoreRouteHealth = /* @__PURE__ */ __name((h, { required, failureCount = 0, softBlocked = false, exploreBonus = 0 } = {}) => {
      required = Number.isFinite(required) && required > 0 ? required : getRequiredStreamMbps(void 0, "steady");
      let throughput = h && h.samples && h.lastThroughputAt ? h.ewmaMbps : 0;
      if (h && h.samples && h.lastThroughputAt) {
        const age = Date.now() - h.lastThroughputAt;
        if (age > 0) throughput *= Math.pow(0.5, age / THROUGHPUT_HALFLIFE_MS);
      }
      const reward = Math.min(1, throughput / Math.max(1, required * 2));
      const failPenalty = Math.min(0.6, (failureCount || 0) * 0.15 + (h ? h.failures * 0.1 : 0));
      const slowPenalty = Math.min(0.4, h ? h.slowSamples * 0.1 : 0);
      const softPenalty = softBlocked ? 1.5 : 0;
      const latencyPenalty = h && h.latencyMs ? Math.min(0.1, h.latencyMs / 3e3) : 0;
      const measuredCv = h && h.samples ? Math.sqrt(h.varMbps || 0) / Math.max(1e-6, h.ewmaMbps) : JITTER_PRIOR_CV;
      const blendedCv = (JITTER_PRIOR_CV * JITTER_PRIOR_WEIGHT + measuredCv * (h ? h.samples : 0)) / (JITTER_PRIOR_WEIGHT + (h ? h.samples : 0));
      const jitterPenalty = h && h.ewmaMbps > 0 ? Math.min(JITTER_PENALTY_CAP, blendedCv * JITTER_WEIGHT) : 0;
      return reward + exploreBonus - failPenalty - slowPenalty - softPenalty - latencyPenalty - jitterPenalty;
    }, "scoreRouteHealth");
    const getCdnHealthScore = /* @__PURE__ */ __name((cdn, opts) => {
      const h = cdnHealth[cdn];
      const nEff = getEffectiveSamples(cdn);
      const total = getTotalEffectiveSamples();
      const exploreBonus = opts && opts.exploit ? 0 : UCB_EXPLORE_C * Math.sqrt(Math.log(total + 1) / (nEff + 1));
      return scoreRouteHealth(h, {
        required: getRequiredStreamMbps(void 0, "steady"),
        failureCount: cdnFailCount[cdn] || 0,
        softBlocked: isCdnSoftBlocked(cdn),
        exploreBonus
      });
    }, "getCdnHealthScore");
    const isCdnStronglyBad = /* @__PURE__ */ __name((cdn) => {
      if (!cdn) return false;
      if (knownDeadHosts.has(cdn)) return true;
      if (isCdnSoftBlocked(cdn)) return true;
      if ((cdnFailCount[cdn] || 0) >= CDN_FAIL_THRESHOLD) return true;
      const h = cdnHealth[cdn];
      if (!h) return false;
      if (h.failures >= 2 && h.successes === 0) return true;
      if (getEffectiveSamples(cdn) >= 2 && h.slowSamples >= 2 && h.ewmaMbps < getRequiredStreamMbps(void 0, "steady") * 0.85) return true;
      return h.failures >= 3 && h.failures > h.successes;
    }, "isCdnStronglyBad");
    let lastChosenCdn = null;
    const CDN_STICKY_MARGIN = 0.2;
    const getHealthyCdnList = /* @__PURE__ */ __name((opts) => {
      refreshExpiredRestrictions();
      const mk = /* @__PURE__ */ __name((cdn, index) => ({ cdn, index, health: cdnHealth[cdn], score: getCdnHealthScore(cdn, opts) }), "mk");
      const all = activeCdnList.map(mk);
      const reachable = all.filter((item) => !isPresumedDnsFailHost(item.cdn));
      let base = reachable;
      if (!base.length) {
        const salvaged = deps.PREFERRED_CDN_LIST.filter((c) => !isPresumedDnsFailHost(c) && !knownDeadHosts.has(c) && !deps.matchesExclude(c)).map(mk);
        base = salvaged.length ? salvaged : all;
      }
      const notFailing = base.filter((item) => (cdnFailCount[item.cdn] || 0) < CDN_FAIL_THRESHOLD);
      const pool = notFailing.length ? notFailing : base;
      const usable = pool.filter((item) => !isCdnStronglyBad(item.cdn));
      const indexed = usable.length ? usable : pool;
      indexed.sort((a, b) => {
        const aHasSamples = !!(a.health && a.health.samples);
        const bHasSamples = !!(b.health && b.health.samples);
        if (aHasSamples || bHasSamples) {
          if (a.score !== b.score) return b.score - a.score;
          if ((a.health ? a.health.ewmaMbps : 0) !== (b.health ? b.health.ewmaMbps : 0)) {
            return (b.health ? b.health.ewmaMbps : 0) - (a.health ? a.health.ewmaMbps : 0);
          }
        }
        const aMs = a.health && a.health.latencyMs || 0;
        const bMs = b.health && b.health.latencyMs || 0;
        if (aMs && bMs && aMs !== bMs) return aMs - bMs;
        if (aMs && !bMs) return -1;
        if (!aMs && bMs) return 1;
        return a.index - b.index;
      });
      return indexed.map((i) => i.cdn);
    }, "getHealthyCdnList");
    const recent403 = /* @__PURE__ */ new Map();
    const GLOBAL_403_WINDOW_MS = 15e3;
    const GLOBAL_403_HOSTS = 2;
    const isGlobal403Burst = /* @__PURE__ */ __name((host) => {
      const now = Date.now();
      recent403.set(host, now);
      for (const [h, t] of recent403) if (now - t > GLOBAL_403_WINDOW_MS) recent403.delete(h);
      return recent403.size >= GLOBAL_403_HOSTS;
    }, "isGlobal403Burst");
    const retract403Penalty = /* @__PURE__ */ __name((host) => {
      recent403.delete(host);
      const h = cdnHealth[host];
      if (!h || h.lastSoftBlockReason !== "403-single") return;
      if (h.failures > 0) h.failures--;
      if (cdnSoftBlockUntil[host]) {
        delete cdnSoftBlockUntil[host];
        h.lastSoftBlockReason = "";
        if (h.softBlocks > 0) h.softBlocks--;
        if (!activeCdnList.includes(host) && !blacklistSet.has(host) && !knownDeadHosts.has(host) && deps.PREFERRED_CDN_LIST.includes(host)) {
          activeCdnList.push(host);
        }
      }
    }, "retract403Penalty");
    const recordCdnFailure = /* @__PURE__ */ __name((cdn, hard, status) => {
      if (!cdn) return;
      if (blacklistSet.has(cdn) || knownDeadHosts.has(cdn)) return;
      if (status === 403) {
        if (isGlobal403Burst(cdn)) {
          deps.log("[403] 偵測到多節點同時 403，判定為 playurl 簽名過期，不標記死節點：" + cdn.split(".")[0]);
          for (const h of recent403.keys()) retract403Penalty(h);
          return;
        }
        recordCdnPenalty(cdn, false);
        softBlockCdn(cdn, "403-single", 10 * 60 * 1e3);
        return;
      }
      recordCdnPenalty(cdn, hard);
      if (hard) {
        cdnFailCount[cdn] = CDN_FAIL_THRESHOLD;
        addToBlacklist(cdn);
        markHostDead(cdn, "HARD-fail");
        try {
          deps.Watchdog.noteHardFail();
        } catch {
        }
        return;
      }
      cdnFailCount[cdn] = (cdnFailCount[cdn] || 0) + 1;
      if (cdnFailCount[cdn] >= CDN_FAIL_THRESHOLD) addToBlacklist(cdn);
      else softBlockCdn(cdn, "net-fail", 2 * 60 * 1e3);
    }, "recordCdnFailure");
    const recordCdnSuccess = /* @__PURE__ */ __name((cdn, requestStartedAt) => {
      const mayRecover = recordCdnHealthSuccess(cdn, requestStartedAt);
      if (mayRecover && cdn && cdnFailCount[cdn]) cdnFailCount[cdn] = 0;
      const h = cdn && cdnHealth[cdn];
      if (mayRecover && h && h.probeTimeouts) h.probeTimeouts = 0;
    }, "recordCdnSuccess");
    const peekBestCdn = /* @__PURE__ */ __name((opts) => {
      const healthy = getHealthyCdnList(opts);
      if (!healthy.length) return activeCdnList[0] || null;
      let pick = healthy[0];
      if (lastChosenCdn && lastChosenCdn !== pick && healthy.includes(lastChosenCdn)) {
        const curScore = getCdnHealthScore(lastChosenCdn, opts);
        const topScore = getCdnHealthScore(pick, opts);
        if (curScore >= topScore - CDN_STICKY_MARGIN) pick = lastChosenCdn;
      }
      return pick;
    }, "peekBestCdn");
    const getBestCdn = /* @__PURE__ */ __name((opts) => {
      const healthy = getHealthyCdnList(opts);
      if (healthy.length) {
        let pick = healthy[0];
        if (lastChosenCdn && lastChosenCdn !== pick && healthy.includes(lastChosenCdn)) {
          const curScore = getCdnHealthScore(lastChosenCdn, opts);
          const topScore = getCdnHealthScore(pick, opts);
          if (curScore >= topScore - CDN_STICKY_MARGIN) pick = lastChosenCdn;
        }
        lastChosenCdn = pick;
        return pick;
      }
      if (activeCdnList.length > 0) {
        activeCdnList.forEach((c) => {
          cdnFailCount[c] = 0;
        });
        return activeCdnList[0];
      }
      deps.err("[警告] 所有白名單節點均失效，自動重置黑名單");
      clearBlacklist();
      if (activeCdnList.length > 0) return activeCdnList[0];
      const allPreferredDead = deps.PREFERRED_CDN_LIST.every((c) => knownDeadHosts.has(c) || blacklistSet.has(c));
      if (allPreferredDead) {
        deps.err("[警告] 白名單全數標死，自動清除死節點重新啟用");
        clearDeadHosts();
      }
      return activeCdnList[0] || null;
    }, "getBestCdn");
    const promoteBestCdnNow = /* @__PURE__ */ __name(() => {
      const best = getBestCdn();
      if (!best) return null;
      const idx = activeCdnList.indexOf(best);
      if (idx > 0) {
        activeCdnList.splice(idx, 1);
        activeCdnList.unshift(best);
      } else if (idx === -1 && !blacklistSet.has(best) && !knownDeadHosts.has(best) && !isCdnSoftBlocked(best)) {
        activeCdnList.unshift(best);
      }
      let playingNow = null;
      try {
        playingNow = deps.getWarmCdnHost();
      } catch {
      }
      const warmList = activeCdnList.slice(0, 3);
      deps.preconnectBatch(warmList.filter((h) => h !== playingNow), !deps.inSeekGrace());
      if (playingNow) deps.preconnectCdn(playingNow, false);
      return best;
    }, "promoteBestCdnNow");
    const resolvedCdn = (() => {
      const normalize = /* @__PURE__ */ __name((value) => typeof value === "string" ? value.trim().toLowerCase() : "", "normalize");
      const storedRaw = GM_getValue("CustomCDN");
      const stored = normalize(storedRaw);
      const configured = normalize(deps.CustomCDN);
      if (deps.CustomCDN === null || configured === "null") {
        if (storedRaw != null) GM_deleteValue("CustomCDN");
        return null;
      }
      if (configured) {
        if (!deps.isValidCustomCdnHost(configured)) {
          console.error("[" + deps.PluginName + "]: [安全] CustomCDN 不在可信 CDN catalog，已忽略：" + configured);
          return null;
        }
        if (configured !== stored) GM_setValue("CustomCDN", configured);
        return configured;
      }
      if (!stored) return null;
      if (!deps.isValidCustomCdnHost(stored)) {
        GM_deleteValue("CustomCDN");
        console.error("[" + deps.PluginName + "]: [安全] 已清除不在可信 CDN catalog 的 CustomCDN：" + stored);
        return null;
      }
      return stored;
    })();
    const getCurrentCdn = /* @__PURE__ */ __name((opts) => resolvedCdn || getBestCdn(opts), "getCurrentCdn");
    const peekCurrentCdn = /* @__PURE__ */ __name((opts) => resolvedCdn || peekBestCdn(opts), "peekCurrentCdn");
    const getCdnShortName = /* @__PURE__ */ __name(() => {
      const c = peekCurrentCdn();
      return c ? c.split(".")[0] : "N/A";
    }, "getCdnShortName");
    const STARTUP_PICK = { exploit: true };
    return {
      get HARD_FAIL_STATUSES() {
        return HARD_FAIL_STATUSES;
      },
      get CDN_SOFT_BLOCK_MS() {
        return CDN_SOFT_BLOCK_MS;
      },
      get CDN_HEALTH_KEY() {
        return CDN_HEALTH_KEY;
      },
      get blacklistSet() {
        return blacklistSet;
      },
      get DEAD_HOSTS_KEY() {
        return DEAD_HOSTS_KEY;
      },
      get knownDeadHosts() {
        return knownDeadHosts;
      },
      get markHostDead() {
        return markHostDead;
      },
      get listDeadHosts() {
        return listDeadHosts;
      },
      get reviveDeadHost() {
        return reviveDeadHost;
      },
      get clearDeadHosts() {
        return clearDeadHosts;
      },
      get activeCdnList() {
        return activeCdnList;
      },
      get refreshExpiredRestrictions() {
        return refreshExpiredRestrictions;
      },
      get clearBlacklist() {
        return clearBlacklist;
      },
      get cdnFailCount() {
        return cdnFailCount;
      },
      get cdnSoftBlockUntil() {
        return cdnSoftBlockUntil;
      },
      get CDN_HEALTH_CAPS() {
        return CDN_HEALTH_CAPS;
      },
      get cdnHealth() {
        return cdnHealth;
      },
      get scheduleCdnHealthSave() {
        return scheduleCdnHealthSave;
      },
      get getRequiredStreamMbps() {
        return getRequiredStreamMbps;
      },
      get ensureCdnHealth() {
        return ensureCdnHealth;
      },
      get isPresumedDnsFailHost() {
        return isPresumedDnsFailHost;
      },
      get isCdnSoftBlocked() {
        return isCdnSoftBlocked;
      },
      get recordCdnLatency() {
        return recordCdnLatency;
      },
      get softBlockCdn() {
        return softBlockCdn;
      },
      get MIN_THROUGHPUT_SAMPLE_BYTES() {
        return MIN_THROUGHPUT_SAMPLE_BYTES;
      },
      get XHR_TIMEOUT_MIN_ELAPSED_MS() {
        return XHR_TIMEOUT_MIN_ELAPSED_MS;
      },
      get XHR_TIMEOUT_HOST_GAP_MS() {
        return XHR_TIMEOUT_HOST_GAP_MS;
      },
      get TRUSTED_XHR_TIMEOUT_EVIDENCE() {
        return TRUSTED_XHR_TIMEOUT_EVIDENCE;
      },
      get acceptedXhrTimeoutAt() {
        return acceptedXhrTimeoutAt;
      },
      get recordCdnThroughput() {
        return recordCdnThroughput;
      },
      get recordCdnPenalty() {
        return recordCdnPenalty;
      },
      get scoreRouteHealth() {
        return scoreRouteHealth;
      },
      get getCdnHealthScore() {
        return getCdnHealthScore;
      },
      get isCdnStronglyBad() {
        return isCdnStronglyBad;
      },
      get lastChosenCdn() {
        return lastChosenCdn;
      },
      set lastChosenCdn(value) {
        lastChosenCdn = value;
      },
      get getHealthyCdnList() {
        return getHealthyCdnList;
      },
      get recordCdnFailure() {
        return recordCdnFailure;
      },
      get recordCdnSuccess() {
        return recordCdnSuccess;
      },
      get peekBestCdn() {
        return peekBestCdn;
      },
      get promoteBestCdnNow() {
        return promoteBestCdnNow;
      },
      get resolvedCdn() {
        return resolvedCdn;
      },
      get getCurrentCdn() {
        return getCurrentCdn;
      },
      get peekCurrentCdn() {
        return peekCurrentCdn;
      },
      get getCdnShortName() {
        return getCdnShortName;
      },
      get STARTUP_PICK() {
        return STARTUP_PICK;
      }
    };
  }
  __name(createHealth, "createHealth");

  // src/routing/native-routes.mjs
  function createNativeRoutes(deps) {
    const LEDGER_KEY = "nativeRouteRatings_v1";
    const LEDGER_VERSION = 1;
    const VIDEO_LIMIT = 48;
    const AUDIO_LIMIT = 16;
    const VIDEO_GROUP_LIMIT = 128;
    const AUDIO_GROUP_LIMIT = 64;
    const GROUP_ROUTE_LIMIT = 4;
    const POOL_URL_CHARS_MAX = 1024 * 1024;
    const URL_MAX = 16 * 1024;
    const RECORD_TTL_MS = 6 * 60 * 60 * 1e3;
    const SOFT_BLOCK_MS = 10 * 60 * 1e3;
    const PROVISIONAL_TTL_MS = 60 * 1e3;
    const SAMPLE_FRESH_MS = 60 * 1e3;
    const ALPHA = 0.35;
    const MIN_SAMPLE_BYTES = 128 * 1024;
    const MIN_SAMPLE_MS = 5;
    const STICKY_MARGIN = 0.2;
    const finite = /* @__PURE__ */ __name((value, fallback = 0, max = Number.MAX_SAFE_INTEGER) => {
      const n = Number(value);
      return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : fallback;
    }, "finite");
    const int = /* @__PURE__ */ __name((value, max = 1e4) => Math.trunc(finite(value, 0, max)), "int");
    const safeHost = /* @__PURE__ */ __name((value) => {
      const host = typeof value === "string" ? value.trim().toLowerCase() : "";
      const label = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";
      return host.length > 0 && host.length <= 253 && new RegExp(`^${label}(?:\\.${label})*$`).test(host) ? host : "";
    }, "safeHost");
    const isIpLiteral = /* @__PURE__ */ __name((host) => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(":"), "isIpLiteral");
    const isKnownFamily = /* @__PURE__ */ __name((host) => /(?:^|\.)bilivideo\.(?:com|cn|net)$/.test(host) || /(?:^|\.)akamaized\.net$/.test(host), "isKnownFamily");
    const emptyRecord = /* @__PURE__ */ __name((host) => ({
      host,
      ewmaMbps: 0,
      varMbps: 0,
      samples: 0,
      probeSamples: 0,
      transportSamples: 0,
      successes: 0,
      failures: 0,
      slowSamples: 0,
      latencyMs: 0,
      softBlockedUntil: 0,
      lastSeen: 0,
      lastThroughputAt: 0,
      lastLatencyAt: 0,
      lastSuccessAt: 0,
      lastFailureAt: 0,
      lastSlowAt: 0
    }), "emptyRecord");
    const sanitizeRecord = /* @__PURE__ */ __name((host, raw, now = Date.now()) => {
      host = safeHost(host);
      if (!host || !raw || typeof raw !== "object" || isIpLiteral(host)) return null;
      const record = emptyRecord(host);
      record.ewmaMbps = finite(raw.ewmaMbps, 0, 1e5);
      record.varMbps = finite(raw.varMbps, 0, 1e10);
      record.samples = int(raw.samples, 12);
      record.probeSamples = int(raw.probeSamples, 12);
      record.transportSamples = int(raw.transportSamples, 12);
      record.successes = int(raw.successes, 12);
      record.failures = int(raw.failures, 3);
      record.slowSamples = int(raw.slowSamples, 3);
      record.latencyMs = finite(raw.latencyMs, 0, 6e4);
      record.softBlockedUntil = finite(raw.softBlockedUntil, 0, now + SOFT_BLOCK_MS);
      for (const key of ["lastSeen", "lastThroughputAt", "lastLatencyAt", "lastSuccessAt", "lastFailureAt", "lastSlowAt"]) {
        record[key] = finite(raw[key], 0, now);
      }
      if (!record.lastSeen || now - record.lastSeen > RECORD_TTL_MS) return null;
      if (!isKnownFamily(host) && record.transportSamples < 1) return null;
      return record;
    }, "sanitizeRecord");
    const ledgers = { video: /* @__PURE__ */ new Map(), audio: /* @__PURE__ */ new Map() };
    let evicted = 0;
    let loadRejected = 0;
    let saveTimer = null;
    const loadLedger = /* @__PURE__ */ __name(() => {
      let raw = null;
      try {
        raw = JSON.parse(deps.gmGet(LEDGER_KEY) || "null");
      } catch {
        loadRejected++;
      }
      if (!raw || raw.version !== LEDGER_VERSION) return;
      for (const kind of ["video", "audio"]) {
        const source = raw[kind] && typeof raw[kind] === "object" ? raw[kind] : {};
        for (const [host, value] of Object.entries(source)) {
          if (deps.TRUSTED_CDN_CATALOG_SET.has(host)) {
            loadRejected++;
            continue;
          }
          const record = sanitizeRecord(host, value);
          if (record) ledgers[kind].set(host, record);
          else loadRejected++;
        }
      }
    }, "loadLedger");
    const limitFor = /* @__PURE__ */ __name((kind) => kind === "audio" ? AUDIO_LIMIT : VIDEO_LIMIT, "limitFor");
    const trimLedger = /* @__PURE__ */ __name((kind) => {
      const ledger = ledgers[kind];
      const now = Date.now();
      for (const [host, record] of ledger) {
        if (!record.lastSeen || now - record.lastSeen > RECORD_TTL_MS) ledger.delete(host);
      }
      while (ledger.size > limitFor(kind)) {
        const oldest = [...ledger.values()].sort((a, b) => a.lastSeen - b.lastSeen)[0];
        if (!oldest) break;
        ledger.delete(oldest.host);
        evicted++;
      }
    }, "trimLedger");
    loadLedger();
    trimLedger("video");
    trimLedger("audio");
    const serialize = /* @__PURE__ */ __name(() => {
      trimLedger("video");
      trimLedger("audio");
      const out = { version: LEDGER_VERSION, video: {}, audio: {} };
      for (const kind of ["video", "audio"]) for (const [host, record] of ledgers[kind]) out[kind][host] = { ...record };
      return out;
    }, "serialize");
    const mergeRecord = /* @__PURE__ */ __name((mine, theirs) => {
      if (!theirs) return mine;
      if (!mine) return theirs;
      const out = { ...mine.lastSeen >= theirs.lastSeen ? mine : theirs };
      const choose = /* @__PURE__ */ __name((stamp, fields) => {
        const source = (mine[stamp] || 0) >= (theirs[stamp] || 0) ? mine : theirs;
        fields.forEach((key) => {
          out[key] = source[key];
        });
        out[stamp] = source[stamp];
      }, "choose");
      choose("lastThroughputAt", ["ewmaMbps", "varMbps", "samples", "probeSamples", "slowSamples", "lastSlowAt"]);
      choose("lastLatencyAt", ["latencyMs"]);
      choose("lastSuccessAt", ["successes", "transportSamples"]);
      choose("lastFailureAt", ["failures", "softBlockedUntil"]);
      out.lastSeen = Math.max(mine.lastSeen || 0, theirs.lastSeen || 0);
      return out;
    }, "mergeRecord");
    const saveNow = /* @__PURE__ */ __name(() => {
      saveTimer = null;
      try {
        const mine = serialize();
        let stored = null;
        try {
          stored = JSON.parse(deps.gmGet(LEDGER_KEY) || "null");
        } catch {
        }
        for (const kind of ["video", "audio"]) {
          const other = stored?.version === LEDGER_VERSION && stored[kind] && typeof stored[kind] === "object" ? stored[kind] : {};
          for (const [host, raw] of Object.entries(other)) {
            if (deps.TRUSTED_CDN_CATALOG_SET.has(host)) continue;
            const theirs = sanitizeRecord(host, raw);
            if (!theirs) continue;
            const merged = mergeRecord(ledgers[kind].get(host), theirs);
            if (merged) ledgers[kind].set(host, merged);
          }
          trimLedger(kind);
        }
        deps.gmSet(LEDGER_KEY, JSON.stringify(serialize()));
      } catch {
        deps.DiagnosticLog?.fault?.("native-ledger-save");
      }
    }, "saveNow");
    const scheduleSave = /* @__PURE__ */ __name(() => {
      if (saveTimer) return;
      saveTimer = setTimeout(saveNow, 1e3);
    }, "scheduleSave");
    const clearLedger = /* @__PURE__ */ __name(() => {
      ledgers.video.clear();
      ledgers.audio.clear();
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      try {
        deps.gmDelete(LEDGER_KEY);
      } catch {
      }
    }, "clearLedger");
    let groups = /* @__PURE__ */ new Map();
    let identityGroups = /* @__PURE__ */ new Map();
    let protectedUrls = /* @__PURE__ */ new Set();
    let poolChars = 0;
    let groupSeq = 0;
    let routeRevision = 0;
    let activeRepresentation = null;
    let tentativeRepresentation = null;
    let lastAutoQualityReason = "none";
    let lastBakeoff = [];
    const parseEligibleUrl = /* @__PURE__ */ __name((url) => {
      if (typeof url !== "string" || !url || url.length > URL_MAX) return null;
      let parsed;
      try {
        parsed = deps.parseMediaHttpUrl(url);
      } catch {
        return null;
      }
      if (!parsed || !/^https?:$/.test(parsed.protocol)) return null;
      if (parsed.protocol !== "https:" || parsed.port && parsed.port !== "443") return null;
      const host = safeHost(parsed.hostname);
      if (!host || isIpLiteral(host)) return null;
      const delivery = deps.classifyMediaDelivery(parsed.href);
      if (["pcdn", "suspected-pcdn", "live"].includes(delivery?.kind)) return null;
      const decision = deps.mediaUrlPolicy.decide(parsed.href);
      if (decision.action === "pass" && ["resource", "live", "suspected-pcdn", "pcdn"].includes(decision.reason)) return null;
      const mediaPath = deps.mediaUrlPolicy.isMediaPath ? deps.mediaUrlPolicy.isMediaPath(parsed.pathname) : deps.isMediaSegmentUrl(parsed.href);
      if (!mediaPath) return null;
      return { url: parsed.href, host, identity: parsed.pathname + parsed.search };
    }, "parseEligibleUrl");
    const routeState = /* @__PURE__ */ __name((kind, host, group) => {
      const record = ledgers[kind]?.get(host);
      if (group?.invalidHosts?.has(host)) return "invalid";
      if (group?.provisionalHost === host && group.provisionalUntil > Date.now()) return "provisional";
      if (record?.transportSamples > 0) return "confirmed";
      return "unknown";
    }, "routeState");
    const recordFor = /* @__PURE__ */ __name((kind, host, create = false) => {
      if (!["video", "audio"].includes(kind) || deps.TRUSTED_CDN_CATALOG_SET.has(host)) return null;
      let record = ledgers[kind].get(host);
      if (!record && create) {
        if (!isKnownFamily(host)) return null;
        record = emptyRecord(host);
        ledgers[kind].set(host, record);
      }
      return record || null;
    }, "recordFor");
    const isSoftBlocked = /* @__PURE__ */ __name((record) => !!record?.softBlockedUntil && record.softBlockedUntil > Date.now(), "isSoftBlocked");
    const scoreRecord = /* @__PURE__ */ __name((record, required) => {
      if (!record) return 0;
      return deps.scoreRouteHealth(record, { required, softBlocked: isSoftBlocked(record), exploreBonus: 0 });
    }, "scoreRecord");
    const resetPool = /* @__PURE__ */ __name(() => {
      groups = /* @__PURE__ */ new Map();
      identityGroups = /* @__PURE__ */ new Map();
      protectedUrls = /* @__PURE__ */ new Set();
      poolChars = 0;
      groupSeq = 0;
      activeRepresentation = null;
      tentativeRepresentation = null;
      lastAutoQualityReason = "epoch-reset";
      routeRevision++;
    }, "resetPool");
    const rawUrls = /* @__PURE__ */ __name((item, isDash) => isDash ? [item?.base_url, item?.baseUrl, ...Array.isArray(item?.backup_url) ? item.backup_url : [], ...Array.isArray(item?.backupUrl) ? item.backupUrl : []] : [item?.url, ...Array.isArray(item?.backup_url) ? item.backup_url : [], ...Array.isArray(item?.backupUrl) ? item.backupUrl : []], "rawUrls");
    const registerSignedRouteGroup = /* @__PURE__ */ __name((item, isDash, kind = "video") => {
      if (!item || poolChars >= POOL_URL_CHARS_MAX) return null;
      kind = ["video", "audio", "muxed"].includes(kind) ? kind : "unknown";
      const groupLimit = kind === "video" ? VIDEO_GROUP_LIMIT : AUDIO_GROUP_LIMIT;
      if ([...groups.values()].filter((group2) => group2.kind === kind).length >= groupLimit) return null;
      const codec = deps.normalizeCodecName?.(item) || "other";
      const group = {
        id: `${deps.playinfoEpoch}:${kind}:${++groupSeq}`,
        epoch: deps.playinfoEpoch,
        kind,
        height: int(item.height, 1e4),
        codec,
        bandwidth: finite(item.bandwidth, 0, 1e10),
        originalOrder: groupSeq,
        routes: [],
        rootOriginal: null,
        invalidHosts: /* @__PURE__ */ new Set(),
        provisionalHost: null,
        provisionalUntil: 0,
        currentRouteType: "catalog-generated",
        currentHost: null,
        catalogFallback: null,
        transportEvidence: /* @__PURE__ */ new Map(),
        revision: ++routeRevision
      };
      const seenHosts = /* @__PURE__ */ new Set();
      let touchedLedger = false;
      for (const url of rawUrls(item, isDash)) {
        const parsed = parseEligibleUrl(url);
        if (!parsed || poolChars + parsed.url.length > POOL_URL_CHARS_MAX) continue;
        if (seenHosts.has(parsed.host) || group.routes.length >= GROUP_ROUTE_LIMIT) continue;
        if (!group.rootOriginal) group.rootOriginal = parsed.url;
        seenHosts.add(parsed.host);
        poolChars += parsed.url.length;
        group.routes.push({ ...parsed, order: group.routes.length });
        protectedUrls.add(parsed.url);
        if (!identityGroups.has(parsed.identity)) identityGroups.set(parsed.identity, group.id);
        else if (identityGroups.get(parsed.identity) !== group.id) identityGroups.set(parsed.identity, null);
        const ledgerKind = kind === "audio" ? "audio" : "video";
        const historical = ledgers[ledgerKind].get(parsed.host);
        if (historical) {
          historical.lastSeen = Date.now();
          touchedLedger = true;
        }
      }
      if (!group.routes.length) return null;
      groups.set(group.id, group);
      if (touchedLedger) scheduleSave();
      return group.id;
    }, "registerSignedRouteGroup");
    const groupForUrl = /* @__PURE__ */ __name((url) => {
      const parsed = parseEligibleUrl(url);
      const id = parsed && identityGroups.get(parsed.identity);
      return id ? groups.get(id) || null : null;
    }, "groupForUrl");
    const captureRouteContext = /* @__PURE__ */ __name((url) => {
      const group = groupForUrl(url);
      return group ? { groupId: group.id, epoch: group.epoch, revision: group.revision } : null;
    }, "captureRouteContext");
    const routeContextActive = /* @__PURE__ */ __name((context) => !!context && context.epoch === deps.playinfoEpoch && groups.has(context.groupId), "routeContextActive");
    const findNative = /* @__PURE__ */ __name((group, host) => group?.routes.find((route) => route.host === host && !deps.TRUSTED_CDN_CATALOG_SET.has(host)) || null, "findNative");
    const setItemUrls = /* @__PURE__ */ __name((item, isDash, primary, backups) => {
      if (isDash) {
        item.base_url = primary;
        item.baseUrl = primary;
        item.backup_url = backups;
        item.backupUrl = backups;
      } else {
        item.url = primary;
        item.backup_url = backups;
        if ("backupUrl" in item) item.backupUrl = backups;
      }
    }, "setItemUrls");
    const applySignedRoutePlan = /* @__PURE__ */ __name((item, isDash, groupId) => {
      const group = groups.get(groupId);
      if (!group) return null;
      const transformed = rawUrls(item, isDash).filter((value) => typeof value === "string");
      const legacyPrimary = transformed[0] || group.rootOriginal;
      const legacyHost = (() => {
        try {
          return new URL(legacyPrimary).hostname;
        } catch {
          return null;
        }
      })();
      group.catalogFallback = deps.TRUSTED_CDN_CATALOG_SET.has(legacyHost) ? legacyHost : deps.peekCurrentCdn();
      let primary = legacyPrimary;
      let primaryType = deps.TRUSTED_CDN_CATALOG_SET.has(legacyHost) ? "catalog-generated" : "root-original";
      let primaryHost = legacyHost;
      if (!deps.resolvedCdn) {
        const required = deps.getRequiredStreamMbps(void 0, "startup");
        const catalogScore = group.catalogFallback ? deps.getCdnHealthScore(group.catalogFallback, { exploit: true }) : 0;
        const eligible = group.routes.filter((route) => !deps.TRUSTED_CDN_CATALOG_SET.has(route.host) && !group.invalidHosts.has(route.host)).map((route) => ({ route, record: recordFor(group.kind === "audio" ? "audio" : "video", route.host) })).filter((entry) => routeState(group.kind === "audio" ? "audio" : "video", entry.route.host, group) !== "unknown" && !isSoftBlocked(entry.record)).map((entry) => ({ ...entry, score: scoreRecord(entry.record, required) })).sort((a, b) => b.score - a.score || a.route.order - b.route.order);
        const chosen = eligible[0];
        if (chosen && chosen.score >= catalogScore + STICKY_MARGIN) {
          primary = chosen.route.url;
          primaryType = "native-signed";
          primaryHost = chosen.route.host;
        }
      }
      const catalogBackups = transformed.slice(1).filter((url) => {
        try {
          return deps.TRUSTED_CDN_CATALOG_SET.has(new URL(url).hostname);
        } catch {
          return false;
        }
      }).slice(0, 2);
      const nativeBackups = group.routes.filter((route) => !deps.TRUSTED_CDN_CATALOG_SET.has(route.host) && route.url !== primary).sort((a, b) => {
        const ar = recordFor(group.kind === "audio" ? "audio" : "video", a.host);
        const br = recordFor(group.kind === "audio" ? "audio" : "video", b.host);
        return scoreRecord(br, deps.getRequiredStreamMbps(void 0, "startup")) - scoreRecord(ar, deps.getRequiredStreamMbps(void 0, "startup")) || a.order - b.order;
      }).slice(0, 2).map((route) => route.url);
      const backups = [...new Set([...catalogBackups, ...nativeBackups, group.rootOriginal].filter((url) => url && url !== primary))];
      setItemUrls(item, isDash, primary, backups);
      group.currentRouteType = primaryType;
      group.currentHost = primaryHost;
      group.revision = ++routeRevision;
      return { groupId, primaryType, primaryHost, catalogFallback: group.catalogFallback, revision: group.revision };
    }, "applySignedRoutePlan");
    const resolveRequestRoute = /* @__PURE__ */ __name((url, context) => {
      const routeContext = context?.route || context;
      if (deps.resolvedCdn || !routeContextActive(routeContext)) return null;
      const group = groups.get(routeContext.groupId);
      const selected = findNative(group, group.currentRouteType === "native-signed" ? group.currentHost : group.provisionalHost);
      if (!selected || group.invalidHosts.has(selected.host)) return null;
      if (group.provisionalHost === selected.host && group.provisionalUntil <= Date.now()) {
        group.provisionalHost = null;
        group.provisionalUntil = 0;
        if (group.currentRouteType !== "native-signed") return null;
      }
      return { url: selected.url, host: selected.host, type: "native-signed", groupId: group.id, revision: group.revision };
    }, "resolveRequestRoute");
    const isProtectedSignedUrl = /* @__PURE__ */ __name((url) => {
      try {
        return protectedUrls.has(deps.parseMediaHttpUrl(url)?.href);
      } catch {
        return false;
      }
    }, "isProtectedSignedUrl");
    const ensureRecordFromTransport = /* @__PURE__ */ __name((kind, host) => {
      const ledgerKind = kind === "audio" ? "audio" : "video";
      let record = ledgers[ledgerKind].get(host);
      if (!record) {
        record = emptyRecord(host);
        ledgers[ledgerKind].set(host, record);
      }
      return record;
    }, "ensureRecordFromTransport");
    const activateGroup = /* @__PURE__ */ __name((group, reason) => {
      if (!group || group.kind !== "video") return;
      if (!activeRepresentation || activeRepresentation.groupId !== group.id) {
        const switched = !!activeRepresentation;
        activeRepresentation = {
          groupId: group.id,
          height: group.height,
          codec: group.codec,
          bandwidth: group.bandwidth,
          revision: ++routeRevision,
          confirmedAt: Date.now(),
          reason
        };
        group.revision = routeRevision;
        lastAutoQualityReason = reason;
        deps.onActiveRepresentation?.(group.rootOriginal, group.id, { switched });
      }
      tentativeRepresentation = null;
    }, "activateGroup");
    const observeTransport = /* @__PURE__ */ __name((context, url, bytes, source) => {
      const routeContext = context?.route;
      if (!routeContextActive(routeContext) || !Number.isSafeInteger(bytes) || bytes <= 0 || !["xhr", "fetch"].includes(source)) return;
      const group = groups.get(routeContext.groupId);
      const parsed = parseEligibleUrl(url);
      if (!group || !parsed) return;
      const route = findNative(group, parsed.host);
      if (group.kind === "video") {
        let matchesHeight = false;
        try {
          const video = deps.getVideo?.();
          matchesHeight = !!(video?.videoHeight && group.height && Math.abs(video.videoHeight - group.height) <= 16);
        } catch {
        }
        const now = Date.now(), prior = group.transportEvidence.get(parsed.host);
        const evidence = prior && now - prior.firstAt <= 8e3 ? prior : { firstAt: now, count: 0, bytes: 0 };
        if (context.nativeActiveCounted !== group.id) {
          context.nativeActiveCounted = group.id;
          evidence.count++;
        }
        evidence.bytes += bytes;
        evidence.lastAt = now;
        group.transportEvidence.set(parsed.host, evidence);
        tentativeRepresentation = { groupId: group.id, height: group.height, codec: group.codec, reason: matchesHeight ? "height-match" : "transport-observed" };
        if (matchesHeight || evidence.count >= 2) activateGroup(group, matchesHeight ? "video-height-match" : "two-video-transfers");
      }
      if (!route) return;
    }, "observeTransport");
    const updateThroughput = /* @__PURE__ */ __name((kind, host, bytes, durationMs, playbackRate, source) => {
      if (!Number.isSafeInteger(bytes) || bytes < MIN_SAMPLE_BYTES || !Number.isFinite(durationMs) || durationMs < MIN_SAMPLE_MS) return { accepted: false, status: "insufficient" };
      const ledgerKind = kind === "audio" ? "audio" : "video";
      let record = ledgers[ledgerKind].get(host);
      if (!record && isKnownFamily(host)) record = recordFor(ledgerKind, host, true);
      if (!record) return { accepted: false, status: "untrusted" };
      const mbps = bytes * 8 / durationMs / 1e3;
      if (!Number.isFinite(mbps) || mbps <= 0) return { accepted: false, status: "ineligible" };
      if (record.samples) {
        const diff = mbps - record.ewmaMbps, incr = ALPHA * diff;
        record.ewmaMbps += incr;
        record.varMbps = (1 - ALPHA) * ((record.varMbps || 0) + diff * incr);
      } else {
        record.ewmaMbps = mbps;
        record.varMbps = 0;
      }
      record.samples = Math.min(12, record.samples + 1);
      if (source === "probe") record.probeSamples = Math.min(12, record.probeSamples + 1);
      const required = deps.getRequiredStreamMbps(playbackRate, "steady");
      if (mbps < required) {
        record.slowSamples = Math.min(3, record.slowSamples + 1);
        record.lastSlowAt = Date.now();
      } else record.slowSamples = Math.max(0, record.slowSamples - 1);
      record.lastThroughputAt = record.lastSeen = Date.now();
      scheduleSave();
      return { accepted: true, status: "throughput", mbps, bytes, durationMs };
    }, "updateThroughput");
    const recordNativeThroughput = /* @__PURE__ */ __name((context, url, bytes, durationMs, playbackRate, source = "transport") => {
      const routeContext = context?.route;
      if (!routeContextActive(routeContext)) return { accepted: false, status: "stale" };
      const group = groups.get(routeContext.groupId), parsed = parseEligibleUrl(url);
      if (!group || !parsed || !findNative(group, parsed.host)) return { accepted: false, status: "not-native" };
      if (source === "transport" && context.nativeCompletionRecorded !== `${group.id}:${parsed.host}`) {
        context.nativeCompletionRecorded = `${group.id}:${parsed.host}`;
        const kind = group.kind === "audio" ? "audio" : "video";
        const record = ensureRecordFromTransport(kind, parsed.host);
        record.transportSamples = Math.min(12, record.transportSamples + 1);
        record.successes = Math.min(12, record.successes + 1);
        record.failures = Math.max(0, record.failures - 1);
        record.lastSuccessAt = record.lastSeen = Date.now();
        record.softBlockedUntil = 0;
        if (group.provisionalHost === parsed.host) {
          group.provisionalUntil = 0;
          group.currentRouteType = "native-signed";
          group.currentHost = parsed.host;
          group.revision = ++routeRevision;
        }
        scheduleSave();
      }
      return updateThroughput(group.kind, parsed.host, bytes, durationMs, playbackRate, source);
    }, "recordNativeThroughput");
    const recordNativeLatency = /* @__PURE__ */ __name((groupId, host, latencyMs) => {
      const group = groups.get(groupId), route = findNative(group, host);
      if (!group || !route || !Number.isFinite(latencyMs) || latencyMs <= 0) return false;
      const kind = group.kind === "audio" ? "audio" : "video";
      const record = recordFor(kind, host, isKnownFamily(host));
      if (!record) return false;
      record.latencyMs = record.latencyMs ? record.latencyMs * 0.65 + latencyMs * 0.35 : latencyMs;
      record.lastLatencyAt = record.lastSeen = Date.now();
      scheduleSave();
      return true;
    }, "recordNativeLatency");
    const noteNativeFailure = /* @__PURE__ */ __name((context, url, status = 0, failureKind = "http") => {
      const routeContext = context?.route;
      if (!routeContextActive(routeContext)) return false;
      const group = groups.get(routeContext.groupId), parsed = parseEligibleUrl(url);
      if (!group || !parsed || !findNative(group, parsed.host)) return false;
      if ([403, 451, 959].includes(+status)) {
        group.invalidHosts.add(parsed.host);
        if (group.provisionalHost === parsed.host) {
          group.provisionalHost = null;
          group.provisionalUntil = 0;
        }
        if (group.currentHost === parsed.host) {
          group.currentRouteType = "root-original";
          group.currentHost = null;
        }
        group.revision = ++routeRevision;
        return true;
      }
      if (!(+status >= 500 || ["network-error", "body-error", "timeout"].includes(failureKind))) return false;
      const kind = group.kind === "audio" ? "audio" : "video";
      const record = recordFor(kind, parsed.host, isKnownFamily(parsed.host));
      if (!record) return false;
      record.failures = Math.min(3, record.failures + 1);
      record.softBlockedUntil = Date.now() + SOFT_BLOCK_MS;
      record.lastFailureAt = record.lastSeen = Date.now();
      scheduleSave();
      return true;
    }, "noteNativeFailure");
    const getActiveGroup = /* @__PURE__ */ __name((sampleUrl) => {
      if (activeRepresentation?.groupId && groups.has(activeRepresentation.groupId)) return groups.get(activeRepresentation.groupId);
      return null;
    }, "getActiveGroup");
    const getNativeProbeCandidate = /* @__PURE__ */ __name((sampleUrl) => {
      if (deps.resolvedCdn || deps.disabled) return null;
      const group = getActiveGroup(sampleUrl);
      if (!group || group.epoch !== deps.playinfoEpoch) return null;
      const kind = "video";
      const now = Date.now();
      const candidates = group.routes.filter((route2) => !deps.TRUSTED_CDN_CATALOG_SET.has(route2.host) && !group.invalidHosts.has(route2.host) && (isKnownFamily(route2.host) || recordFor(kind, route2.host)?.transportSamples > 0)).filter((route2) => !isSoftBlocked(recordFor(kind, route2.host))).filter((route2) => {
        const record = recordFor(kind, route2.host);
        return !(record?.samples && record.lastThroughputAt && now - record.lastThroughputAt < SAMPLE_FRESH_MS);
      }).sort((a, b) => {
        const ar = recordFor(kind, a.host), br = recordFor(kind, b.host);
        const au = !ar?.samples, bu = !br?.samples;
        if (au !== bu) return au ? -1 : 1;
        return (ar?.lastThroughputAt || 0) - (br?.lastThroughputAt || 0) || a.order - b.order;
      });
      const route = candidates[0];
      return route ? { type: "native-signed", groupId: group.id, epoch: group.epoch, host: route.host, url: route.url } : null;
    }, "getNativeProbeCandidate");
    const recordNativeProbe = /* @__PURE__ */ __name((candidate, result, latencyMs) => {
      const group = candidate && groups.get(candidate.groupId);
      if (!group || candidate.epoch !== deps.playinfoEpoch || !findNative(group, candidate.host)) return { accepted: false, status: "stale" };
      if (latencyMs) recordNativeLatency(group.id, candidate.host, latencyMs);
      if (!result?.accepted) return result || { accepted: false, status: "failed" };
      const sample = updateThroughput("video", candidate.host, result.bytes, result.durationMs, deps.playbackRateState.effectiveRate, "probe");
      if (sample.accepted) considerProvisional(group, candidate.host, sample.mbps);
      return sample;
    }, "recordNativeProbe");
    const considerProvisional = /* @__PURE__ */ __name((group, host, mbps) => {
      if (!activeRepresentation || activeRepresentation.groupId !== group.id) return false;
      const record = recordFor("video", host);
      const currentHost = group.currentHost || group.catalogFallback;
      const current = currentHost && deps.cdnHealth[currentHost];
      const now = Date.now(), required = deps.getRequiredStreamMbps(void 0, "startup");
      if (!record || !current || !current.samples || !current.lastThroughputAt || now - current.lastThroughputAt > SAMPLE_FRESH_MS) return false;
      if (now - record.lastThroughputAt > SAMPLE_FRESH_MS || mbps < required * 1.5 || mbps < current.ewmaMbps * 1.6) return false;
      const nativeScore = scoreRecord(record, deps.getRequiredStreamMbps(void 0, "steady"));
      const currentScore = deps.getCdnHealthScore(currentHost, { exploit: true });
      if (nativeScore < currentScore + STICKY_MARGIN || isSoftBlocked(record)) return false;
      group.provisionalHost = host;
      group.provisionalUntil = now + PROVISIONAL_TTL_MS;
      group.revision = ++routeRevision;
      return true;
    }, "considerProvisional");
    const setLastBakeoff = /* @__PURE__ */ __name((outcomes) => {
      lastBakeoff = (Array.isArray(outcomes) ? outcomes : []).slice(0, 4).map((item) => ({
        type: item.type === "native-signed" ? "native-signed" : "catalog-generated",
        host: safeHost(item.host) || null,
        status: String(item.status || "unknown").slice(0, 32),
        accepted: !!item.accepted
      }));
    }, "setLastBakeoff");
    const diagnostics = /* @__PURE__ */ __name(() => {
      const activeGroup = activeRepresentation && groups.get(activeRepresentation.groupId);
      const allNative = [...groups.values()].flatMap((group) => group.routes.map((route) => ({ group, route }))).filter((entry) => !deps.TRUSTED_CDN_CATALOG_SET.has(entry.route.host));
      const counts = { unknown: 0, provisional: 0, confirmed: 0, invalid: 0 };
      allNative.forEach(({ group, route }) => {
        counts[routeState(group.kind === "audio" ? "audio" : "video", route.host, group)]++;
      });
      return {
        active: activeRepresentation ? {
          height: activeRepresentation.height,
          codec: activeRepresentation.codec,
          revision: activeRepresentation.revision,
          reason: activeRepresentation.reason
        } : null,
        tentative: tentativeRepresentation ? {
          height: tentativeRepresentation.height,
          codec: tentativeRepresentation.codec,
          reason: tentativeRepresentation.reason
        } : null,
        routeRevision,
        currentRouteType: activeGroup?.currentRouteType || "catalog-generated",
        currentHost: activeGroup?.currentHost || null,
        catalogFallback: activeGroup?.catalogFallback || deps.peekCurrentCdn(),
        groupNativeCount: activeGroup ? activeGroup.routes.filter((route) => !deps.TRUSTED_CDN_CATALOG_SET.has(route.host)).length : 0,
        counts,
        ledger: { video: ledgers.video.size, audio: ledgers.audio.size, evicted, rejected: loadRejected },
        lastBakeoff: lastBakeoff.map((item) => ({ ...item })),
        autoQualityReason: lastAutoQualityReason
      };
    }, "diagnostics");
    return {
      LEDGER_KEY,
      resetPool,
      clearLedger,
      registerSignedRouteGroup,
      applySignedRoutePlan,
      captureRouteContext,
      routeContextActive,
      resolveRequestRoute,
      isProtectedSignedUrl,
      observeTransport,
      recordNativeThroughput,
      noteNativeFailure,
      getNativeProbeCandidate,
      recordNativeProbe,
      setLastBakeoff,
      diagnostics,
      flushLedger: saveNow,
      get activeRepresentation() {
        return activeRepresentation;
      },
      get routeRevision() {
        return routeRevision;
      },
      get groups() {
        return groups;
      },
      get ledgers() {
        return ledgers;
      }
    };
  }
  __name(createNativeRoutes, "createNativeRoutes");

  // src/playback/rate.mjs
  function createRate(deps) {
    const ASSUMED_PLAYBACK_RATE = 2;
    const MAX_NETWORK_PLAYBACK_RATE = 4;
    const playbackRateState = {
      observedRate: ASSUMED_PLAYBACK_RATE,
      effectiveRate: ASSUMED_PLAYBACK_RATE,
      confirmed: false,
      source: "assumed"
    };
    const resetPlaybackRateState = /* @__PURE__ */ __name(() => {
      playbackRateState.observedRate = ASSUMED_PLAYBACK_RATE;
      playbackRateState.effectiveRate = ASSUMED_PLAYBACK_RATE;
      playbackRateState.confirmed = false;
      playbackRateState.source = "assumed";
      return playbackRateState;
    }, "resetPlaybackRateState");
    const getEffectivePlaybackRate = /* @__PURE__ */ __name((value) => {
      const numeric = value === void 0 ? playbackRateState.effectiveRate : Number(value);
      if (!Number.isFinite(numeric) || numeric <= 0) return ASSUMED_PLAYBACK_RATE;
      return Math.max(1, Math.min(MAX_NETWORK_PLAYBACK_RATE, numeric));
    }, "getEffectivePlaybackRate");
    const syncPlaybackRateFromVideo = /* @__PURE__ */ __name((video, source = "watchdog") => {
      let numeric;
      try {
        numeric = Number(video && video.playbackRate);
      } catch {
        return resetPlaybackRateState();
      }
      if (!Number.isFinite(numeric) || numeric <= 0) return resetPlaybackRateState();
      if (!playbackRateState.confirmed && numeric === 1 && source !== "ratechange") return playbackRateState;
      playbackRateState.observedRate = numeric;
      playbackRateState.effectiveRate = getEffectivePlaybackRate(numeric);
      playbackRateState.confirmed = true;
      playbackRateState.source = String(source || "watchdog").slice(0, 24);
      return playbackRateState;
    }, "syncPlaybackRateFromVideo");
    let seekGraceUntil = 0;
    const getSeekGraceMs = /* @__PURE__ */ __name(() => deps.currentStreamBitsPerSec / 1e6 >= 12 ? 8e3 : 5e3, "getSeekGraceMs");
    const bumpSeekGrace = /* @__PURE__ */ __name(() => {
      seekGraceUntil = Math.max(seekGraceUntil, Date.now() + getSeekGraceMs());
    }, "bumpSeekGrace");
    const inSeekGrace = /* @__PURE__ */ __name(() => Date.now() < seekGraceUntil, "inSeekGrace");
    return {
      get ASSUMED_PLAYBACK_RATE() {
        return ASSUMED_PLAYBACK_RATE;
      },
      get playbackRateState() {
        return playbackRateState;
      },
      get resetPlaybackRateState() {
        return resetPlaybackRateState;
      },
      get getEffectivePlaybackRate() {
        return getEffectivePlaybackRate;
      },
      get syncPlaybackRateFromVideo() {
        return syncPlaybackRateFromVideo;
      },
      get seekGraceUntil() {
        return seekGraceUntil;
      },
      set seekGraceUntil(value) {
        seekGraceUntil = value;
      },
      get bumpSeekGrace() {
        return bumpSeekGrace;
      },
      get inSeekGrace() {
        return inSeekGrace;
      }
    };
  }
  __name(createRate, "createRate");

  // src/policy/url-policy.mjs
  function createMediaUrlPolicy() {
    const MEDIA_URL_MAX_LENGTH = 16 * 1024;
    const PCDN_SOURCE_SUFFIXES = Object.freeze([
      "szbdyd.com",
      "mountaintoys.cn",
      "nexusedgeio.com",
      "ahdohpiechei.com"
    ]);
    const PCDN_SOURCE_HOSTS = Object.freeze(/* @__PURE__ */ new Set([
      "upos-sz-mirror14b.bilivideo.com"
    ]));
    const IPV4_HOST_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
    const MEDIA_PATH_RE = /\.(?:m4s|mp4|flv|m3u8)$/i;
    const hostHasSuffix = /* @__PURE__ */ __name((host, suffix) => host === suffix || host.endsWith("." + suffix), "hostHasSuffix");
    const parseMediaHttpUrl = /* @__PURE__ */ __name((value) => {
      if (typeof value !== "string" || !value || value.length > MEDIA_URL_MAX_LENGTH) return null;
      try {
        const u = new URL(value.startsWith("//") ? "https:" + value : value);
        return u.protocol === "http:" || u.protocol === "https:" ? u : null;
      } catch {
        return null;
      }
    }, "parseMediaHttpUrl");
    const isMediaDeliveryPath = /* @__PURE__ */ __name((path) => !!path && (MEDIA_PATH_RE.test(path) || path.includes("/upgcxcode/") || path.startsWith("/v1/resource") || path.includes("/live-bvc/")), "isMediaDeliveryPath");
    const classifyMediaDelivery = /* @__PURE__ */ __name((value) => {
      const u = parseMediaHttpUrl(value);
      if (!u || !isMediaDeliveryPath(u.pathname)) return Object.freeze({ kind: "unknown", reason: "invalid-or-non-media", host: "" });
      const host = u.hostname.toLowerCase();
      if (u.pathname.includes("/live-bvc/")) return Object.freeze({ kind: "live", reason: "live-bvc", host });
      const firstLabel = host.split(".")[0];
      const mcdn = /\.mcdn\.bilivideo\.(?:cn|com|net)$/i.test(host);
      const knownSuffix = PCDN_SOURCE_SUFFIXES.some((suffix) => hostHasSuffix(host, suffix));
      const knownHost = PCDN_SOURCE_HOSTS.has(host);
      const redirectHost = firstLabel.startsWith("upos-") && firstLabel.includes("302");
      const querySignal = String(u.searchParams.get("os") || "").toLowerCase() === "mcdn";
      const nonDefaultPort = !!u.port && u.port !== "80" && u.port !== "443";
      const ipPort = IPV4_HOST_RE.test(host) && nonDefaultPort;
      if (mcdn || knownSuffix || knownHost || redirectHost || querySignal || ipPort) {
        const reason = mcdn ? "mcdn-host" : knownSuffix ? "known-pcdn-suffix" : knownHost ? "known-pcdn-host" : redirectHost ? "upos-302" : querySignal ? "os-mcdn" : "ip-port";
        return Object.freeze({ kind: "pcdn", reason, host });
      }
      if (nonDefaultPort) return Object.freeze({ kind: "suspected-pcdn", reason: "non-default-port", host });
      return Object.freeze({ kind: "normal", reason: "normal", host });
    }, "classifyMediaDelivery");
    const decide = /* @__PURE__ */ __name((value) => {
      const parsed = parseMediaHttpUrl(value);
      const delivery = classifyMediaDelivery(value);
      if (!parsed || delivery.kind === "unknown") return { action: "pass", reason: "invalid-or-non-media", delivery };
      if (parsed.pathname.startsWith("/v1/resource")) return { action: "pass", reason: "resource", delivery };
      if (delivery.kind === "live" || delivery.kind === "suspected-pcdn") return { action: "pass", reason: delivery.kind, delivery };
      const host = parsed.hostname;
      const sourceAllowed = delivery.kind === "pcdn" || /\.bilivideo\.(?:com|cn|net)$/i.test(host) || host.endsWith(".akamaized.net");
      return { action: sourceAllowed ? "rewrite" : "pass", reason: sourceAllowed ? "media" : "unknown-source", delivery };
    }, "decide");
    return {
      parse: parseMediaHttpUrl,
      classify: classifyMediaDelivery,
      decide,
      isMediaPath: isMediaDeliveryPath,
      suffixes: PCDN_SOURCE_SUFFIXES,
      hosts: PCDN_SOURCE_HOSTS,
      hostHasSuffix,
      maxLength: MEDIA_URL_MAX_LENGTH,
      mediaPathPattern: MEDIA_PATH_RE
    };
  }
  __name(createMediaUrlPolicy, "createMediaUrlPolicy");

  // src/policy/media.mjs
  function createMediaPolicy(deps) {
    const SettingsBarTitle = (() => {
      const lang = (navigator.languages || [navigator.language || "en"])[0].substring(0, 2);
      return { zh: "攔截修改影片 CDN", ja: "CDNスイッチャー" }[lang] || "CDN Switcher (TW)";
    })();
    const mediaUrlPolicy = createMediaUrlPolicy();
    const MEDIA_URL_MAX_LENGTH = mediaUrlPolicy.maxLength;
    const PCDN_SOURCE_SUFFIXES = mediaUrlPolicy.suffixes;
    const PCDN_SOURCE_HOSTS = mediaUrlPolicy.hosts;
    const hostHasSuffix = mediaUrlPolicy.hostHasSuffix;
    const parseMediaHttpUrl = mediaUrlPolicy.parse;
    const classifyMediaDelivery = mediaUrlPolicy.classify;
    const isMediaDeliveryPath = mediaUrlPolicy.isMediaPath;
    const isAkamaiUrl = /* @__PURE__ */ __name((url) => {
      const u = parseMediaHttpUrl(url);
      return !!(u && u.hostname.endsWith(".akamaized.net"));
    }, "isAkamaiUrl");
    const isBiliVideoUrl = /* @__PURE__ */ __name((url) => {
      const u = parseMediaHttpUrl(url);
      if (!u) return false;
      const h = u.hostname.toLowerCase();
      return h.endsWith(".bilivideo.com") || h.endsWith(".bilivideo.cn") || h.endsWith(".bilivideo.net") || PCDN_SOURCE_SUFFIXES.some((suffix) => hostHasSuffix(h, suffix)) || PCDN_SOURCE_HOSTS.has(h);
    }, "isBiliVideoUrl");
    const getBiliVideoCdn = /* @__PURE__ */ __name((url) => {
      const u = parseMediaHttpUrl(url);
      if (!u) return null;
      const h = u.hostname.toLowerCase();
      return h.endsWith(".bilivideo.com") || h.endsWith(".bilivideo.cn") || h.endsWith(".bilivideo.net") ? h : null;
    }, "getBiliVideoCdn");
    const isHttpDnsUrl = /* @__PURE__ */ __name((url) => {
      try {
        return new URL(url).hostname === "httpdns.bilivideo.com";
      } catch {
        return false;
      }
    }, "isHttpDnsUrl");
    const isBiliJsonMetadataApi = /* @__PURE__ */ __name((url) => {
      try {
        const u = new URL(url, location.href);
        if (u.hostname !== "api.bilibili.com") return false;
        return u.pathname === "/x/v2/subtitle/web/view";
      } catch {
        return false;
      }
    }, "isBiliJsonMetadataApi");
    let pageDiscoveredCdn = null;
    const discoverCdnFromPage = /* @__PURE__ */ __name(() => {
      try {
        const html = document.head && document.head.innerHTML || "";
        const m = html.match(/up[\w-]+\.bilivideo\.com/);
        if (!m || !m[0]) return;
        if (deps.matchesExclude(m[0]) || deps.knownDeadHosts.has(m[0]) || deps.blacklistSet.has(m[0]) || deps.isCdnSoftBlocked(m[0])) return;
        pageDiscoveredCdn = m[0];
        if (deps.isValidCustomCdnHost(m[0])) deps.preconnectCdn(m[0]);
      } catch {
      }
    }, "discoverCdnFromPage");
    const noteDiscoveredCdn = /* @__PURE__ */ __name((host) => {
      if (!host || !host.endsWith(".bilivideo.com")) return;
      if (deps.matchesExclude(host) || deps.knownDeadHosts.has(host) || deps.blacklistSet.has(host) || deps.isCdnSoftBlocked(host)) return;
      if (isUnstableCdnHost(host)) return;
      pageDiscoveredCdn = host;
      if (deps.isValidCustomCdnHost(host)) deps.preconnectCdn(host);
    }, "noteDiscoveredCdn");
    const isUnstableCdnHost = /* @__PURE__ */ __name((host) => {
      if (!host) return false;
      const normalized = String(host).toLowerCase();
      if (/\.mcdn\.bilivideo\.(cn|com|net)$/i.test(normalized)) return true;
      if (PCDN_SOURCE_SUFFIXES.some((suffix) => hostHasSuffix(normalized, suffix))) return true;
      if (PCDN_SOURCE_HOSTS.has(normalized)) return true;
      const firstLabel = normalized.split(".")[0];
      if (firstLabel.startsWith("upos-") && firstLabel.includes("302")) return true;
      if (/^cn-[a-z]{2,8}-/i.test(host) && host.endsWith(".bilivideo.com")) return true;
      return false;
    }, "isUnstableCdnHost");
    const getFallbackCdnHost = /* @__PURE__ */ __name(() => {
      const discovered = pageDiscoveredCdn && deps.isValidCustomCdnHost(pageDiscoveredCdn) && !deps.matchesExclude(pageDiscoveredCdn) && !deps.knownDeadHosts.has(pageDiscoveredCdn) && !deps.blacklistSet.has(pageDiscoveredCdn) && !deps.isCdnSoftBlocked(pageDiscoveredCdn) && !isUnstableCdnHost(pageDiscoveredCdn) ? pageDiscoveredCdn : null;
      return deps.resolvedCdn || discovered || deps.getCurrentCdn() || deps.activeCdnList[0] || deps.PREFERRED_CDN_LIST[0] || null;
    }, "getFallbackCdnHost");
    const PCDN_RESOURCE_PATH = /^\/v1\/resource/;
    const isPcdnResourceUrl = /* @__PURE__ */ __name((urlStr) => {
      if (!urlStr || urlStr.indexOf("/v1/resource") === -1) return false;
      const u = parseMediaHttpUrl(urlStr);
      return !!(u && PCDN_RESOURCE_PATH.test(u.pathname));
    }, "isPcdnResourceUrl");
    const isLiveBvcUrl = /* @__PURE__ */ __name((urlStr) => {
      if (!urlStr || urlStr.indexOf("/live-bvc/") === -1) return false;
      const u = parseMediaHttpUrl(urlStr);
      return !!(u && u.pathname.includes("/live-bvc/"));
    }, "isLiveBvcUrl");
    const rewriteUnstableMediaUrl = /* @__PURE__ */ __name((urlStr) => {
      if (!urlStr) return null;
      try {
        const u = parseMediaHttpUrl(urlStr);
        if (!u || deps.decideMediaRewrite(urlStr).action !== "rewrite") return null;
        const delivery = classifyMediaDelivery(urlStr);
        if (delivery.kind === "suspected-pcdn") {
          deps.redirectStats.pcdnSuspectedPort = Math.min(1e4, (deps.redirectStats.pcdnSuspectedPort || 0) + 1);
          return null;
        }
        if (delivery.kind === "live") return null;
        if (delivery.kind !== "pcdn" && !isUnstableCdnHost(u.hostname)) return null;
        if (delivery.kind === "pcdn") deps.redirectStats.pcdnExplicit = Math.min(1e4, (deps.redirectStats.pcdnExplicit || 0) + 1);
        if (PCDN_RESOURCE_PATH.test(u.pathname)) {
          deps.redirectStats.pcdnSkipped++;
          return null;
        }
        let targetHost = getFallbackCdnHost();
        if (u.hostname.endsWith(".szbdyd.com")) {
          const usource = u.searchParams.get("xy_usource");
          if (usource) {
            let h = usource.replace(/^https?:\/\//i, "").split("/")[0].split(":")[0];
            if (deps.isValidCustomCdnHost(h) && !isUnstableCdnHost(h) && !deps.needsRedirect(h)) targetHost = h;
          }
        }
        if (!deps.isValidCustomCdnHost(targetHost)) return null;
        return deps.replaceUrlHost(urlStr, targetHost);
      } catch {
        return null;
      }
    }, "rewriteUnstableMediaUrl");
    return {
      get SettingsBarTitle() {
        return SettingsBarTitle;
      },
      get mediaUrlPolicy() {
        return mediaUrlPolicy;
      },
      get MEDIA_URL_MAX_LENGTH() {
        return MEDIA_URL_MAX_LENGTH;
      },
      get PCDN_SOURCE_SUFFIXES() {
        return PCDN_SOURCE_SUFFIXES;
      },
      get PCDN_SOURCE_HOSTS() {
        return PCDN_SOURCE_HOSTS;
      },
      get parseMediaHttpUrl() {
        return parseMediaHttpUrl;
      },
      get classifyMediaDelivery() {
        return classifyMediaDelivery;
      },
      get isAkamaiUrl() {
        return isAkamaiUrl;
      },
      get isBiliVideoUrl() {
        return isBiliVideoUrl;
      },
      get getBiliVideoCdn() {
        return getBiliVideoCdn;
      },
      get isHttpDnsUrl() {
        return isHttpDnsUrl;
      },
      get isBiliJsonMetadataApi() {
        return isBiliJsonMetadataApi;
      },
      get pageDiscoveredCdn() {
        return pageDiscoveredCdn;
      },
      set pageDiscoveredCdn(value) {
        pageDiscoveredCdn = value;
      },
      get discoverCdnFromPage() {
        return discoverCdnFromPage;
      },
      get noteDiscoveredCdn() {
        return noteDiscoveredCdn;
      },
      get isUnstableCdnHost() {
        return isUnstableCdnHost;
      },
      get rewriteUnstableMediaUrl() {
        return rewriteUnstableMediaUrl;
      }
    };
  }
  __name(createMediaPolicy, "createMediaPolicy");

  // src/transport/evidence.mjs
  function createEvidence(deps) {
    const redirectStats = {
      unstable: 0,
      pcdnExplicit: 0,
      pcdnSuspectedPort: 0,
      liveSkipped: 0,
      partialProbeSamples: 0,
      // v1.3.3：命中 /v1/resource 而「刻意不改寫」的次數。數字持續增加代表你的網路
      // 環境常被分配到 PCDN —— 這正是舊版會改壞、造成偶發起播變慢的那類連結。
      pcdnSkipped: 0,
      // 2026-08-20：這條串流「換 host 會被 403 拒絕」而刻意不改寫、也不賽馬的次數。
      // 數字 > 0 代表你遇到了 os=<節點>bv 這種綁定節點的簽名（見 hostLockedStreams）。
      hostLocked: 0,
      whitelist: 0,
      httpdns: 0,
      httpdnsAllowed: 0,
      httpdnsAutoSwitch: 0,
      quietRedirects: 0
    };
    const segmentByteAccountedUrls = /* @__PURE__ */ new Map();
    const SEGMENT_DEDUP_WINDOW_MS = 5e3;
    const segmentDedupKey = /* @__PURE__ */ __name((url) => {
      try {
        return new URL(url).href;
      } catch {
        return String(url || "");
      }
    }, "segmentDedupKey");
    const noteSegmentAccounted = /* @__PURE__ */ __name((url) => {
      if (!url) return;
      const now = Date.now();
      segmentByteAccountedUrls.set(segmentDedupKey(url), now);
      if (segmentByteAccountedUrls.size > 64) {
        segmentByteAccountedUrls.forEach((t, u) => {
          if (now - t > SEGMENT_DEDUP_WINDOW_MS) segmentByteAccountedUrls.delete(u);
        });
      }
    }, "noteSegmentAccounted");
    const wasSegmentAccounted = /* @__PURE__ */ __name((url) => {
      const t = url && segmentByteAccountedUrls.get(segmentDedupKey(url));
      return !!t && Date.now() - t < SEGMENT_DEDUP_WINDOW_MS;
    }, "wasSegmentAccounted");
    const noteSegmentBytes = /* @__PURE__ */ __name((cdn, xhr, startedAt, url, alreadyReportedBytes, runtimeToken, mediaContext) => {
      if (deps.disabled || runtimeToken && !deps.isRuntimeGenerationActive(runtimeToken)) return;
      try {
        let bytes = 0;
        const cl = xhr.getResponseHeader && xhr.getResponseHeader("content-length");
        if (cl) bytes = parseInt(cl, 10) || 0;
        if (!bytes) {
          try {
            const r = xhr.response;
            if (r && typeof r.byteLength === "number") bytes = r.byteLength;
            else if (r && typeof r.size === "number") bytes = r.size;
            else if ((xhr.responseType === "" || xhr.responseType === "text") && typeof xhr.responseText === "string") {
              bytes = xhr.responseText.length;
            }
          } catch {
          }
        }
        if (!bytes) return;
        const durationMs = Math.max(1, Date.now() - startedAt);
        const remaining = Math.max(0, bytes - (alreadyReportedBytes || 0));
        if (remaining) {
          deps.observeMediaTransfer(mediaContext, xhr.responseURL || url, remaining, "xhr");
          if (cdn) deps.Watchdog.noteExternalBytes(cdn, remaining);
        }
        if (cdn) deps.recordCdnThroughput(cdn, bytes, durationMs, deps.playbackRateState.effectiveRate);
        deps.recordNativeThroughput(
          mediaContext,
          xhr.responseURL || url,
          bytes,
          durationMs,
          deps.playbackRateState.effectiveRate,
          "transport"
        );
        noteSegmentAccounted(url);
        if (xhr.responseURL && xhr.responseURL !== url) noteSegmentAccounted(xhr.responseURL);
      } catch {
      }
    }, "noteSegmentBytes");
    return {
      get redirectStats() {
        return redirectStats;
      },
      get noteSegmentAccounted() {
        return noteSegmentAccounted;
      },
      get wasSegmentAccounted() {
        return wasSegmentAccounted;
      },
      get noteSegmentBytes() {
        return noteSegmentBytes;
      }
    };
  }
  __name(createEvidence, "createEvidence");

  // src/playback/media.mjs
  function createMedia(deps) {
    let currentStreamBitsPerSec = 0;
    let streamProfile = null;
    const DEFAULT_BUFFER_TARGET_BYTES = 20 * 1024 * 1024;
    const MIN_BUFFER_TARGET_BYTES = 16 * 1024 * 1024;
    const MAX_BUFFER_TARGET_BYTES = 160 * 1024 * 1024;
    let baseBufferTargetBytes = DEFAULT_BUFFER_TARGET_BYTES;
    const clamp = /* @__PURE__ */ __name((value, min, max) => Math.max(min, Math.min(max, value)), "clamp");
    const setBufferTargetFromBitrate = /* @__PURE__ */ __name((totalBitsPerSec, isHighBitrate) => {
      if (!totalBitsPerSec || !Number.isFinite(totalBitsPerSec)) return;
      currentStreamBitsPerSec = totalBitsPerSec;
      const targetSeconds = isHighBitrate ? 45 : 20;
      baseBufferTargetBytes = clamp(
        totalBitsPerSec / 8 * targetSeconds,
        MIN_BUFFER_TARGET_BYTES,
        MAX_BUFFER_TARGET_BYTES
      );
    }, "setBufferTargetFromBitrate");
    const getBufferTargetBytes = /* @__PURE__ */ __name((playbackRate) => {
      const rate = deps.getEffectivePlaybackRate(playbackRate);
      return clamp(baseBufferTargetBytes * rate, MIN_BUFFER_TARGET_BYTES, MAX_BUFFER_TARGET_BYTES);
    }, "getBufferTargetBytes");
    const getWatchdogRequiredBps = /* @__PURE__ */ __name((streamMbps, playbackRate, highBitrate) => highBitrate ? Math.max(0, Number(streamMbps) || 0) * deps.getEffectivePlaybackRate(playbackRate) * 1e6 / 8 : deps.getRequiredStreamMbps(playbackRate, "steady") * 1e6 / 8, "getWatchdogRequiredBps");
    const REPRESENTATION_REGISTRY_MAX = 128;
    const AUDIO_REGISTRY_MAX = 64;
    const REPRESENTATION_OBSERVATION_TTL_MS = 30 * 1e3;
    const representationRegistry = /* @__PURE__ */ new Map();
    const audioRepresentationRegistry = /* @__PURE__ */ new Map();
    const muxedRepresentationRegistry = /* @__PURE__ */ new Map();
    let playinfoEpoch = 0;
    let mediaObservations = { video: null, audio: null, muxed: null, unknown: null };
    let lastVideoTransportObservation = null;
    let observedVideoRepresentation = null;
    let streamEstimate = { source: "unknown", codec: "other", height: 0, videoMbps: 0, audioMbps: 0 };
    const resetMediaDelivery = /* @__PURE__ */ __name(() => {
      mediaObservations = { video: null, audio: null, muxed: null, unknown: null };
      lastVideoTransportObservation = null;
      observedVideoRepresentation = null;
    }, "resetMediaDelivery");
    const resetRepresentationRegistry = /* @__PURE__ */ __name(() => {
      playinfoEpoch++;
      deps.resetNativeRoutePool();
      deps.DiagnosticLog.boundary(deps.runtimeGeneration, playinfoEpoch, "epoch");
      representationRegistry.clear();
      audioRepresentationRegistry.clear();
      muxedRepresentationRegistry.clear();
      resetMediaDelivery();
    }, "resetRepresentationRegistry");
    const representationIdentity = /* @__PURE__ */ __name((url) => {
      if (typeof url !== "string" || !url || url.length > 16 * 1024) return "";
      try {
        const parsed = new URL(url, location.href);
        if (!/^https?:$/.test(parsed.protocol) || !deps.isMediaSegmentUrl(parsed.href)) return "";
        return parsed.pathname + parsed.search;
      } catch {
        return "";
      }
    }, "representationIdentity");
    const registerMediaRepresentation = /* @__PURE__ */ __name((registry, rep, kind, limit) => {
      const safeRep = {
        kind,
        height: Number.isFinite(+rep.height) ? Math.max(0, Math.trunc(+rep.height)) : 0,
        bandwidth: Number.isFinite(+rep.bandwidth) ? Math.max(0, +rep.bandwidth) : 0,
        codec: ["av1", "hevc", "avc"].includes(rep.codec) ? rep.codec : "other"
      };
      (Array.isArray(rep.urls) ? rep.urls : []).forEach((url) => {
        const key = representationIdentity(url);
        if (!key) return;
        if (!registry.has(key) && registry.size >= limit) registry.delete(registry.keys().next().value);
        if (registry.has(key) && JSON.stringify(registry.get(key)) !== JSON.stringify(safeRep)) registry.set(key, null);
        else registry.set(key, safeRep);
      });
    }, "registerMediaRepresentation");
    const rebuildRepresentationRegistry = /* @__PURE__ */ __name(() => {
      resetRepresentationRegistry();
      if (!streamProfile || !Array.isArray(streamProfile.reps)) return;
      streamProfile.reps.forEach((rep) => {
        if (!rep || !Number.isFinite(+rep.bandwidth) || +rep.bandwidth <= 0) return;
        registerMediaRepresentation(representationRegistry, rep, "video", REPRESENTATION_REGISTRY_MAX);
      });
      (streamProfile.audioReps || []).forEach((rep) => registerMediaRepresentation(audioRepresentationRegistry, rep, "audio", AUDIO_REGISTRY_MAX));
    }, "rebuildRepresentationRegistry");
    const lookupMediaRepresentation = /* @__PURE__ */ __name((url) => {
      const key = representationIdentity(url);
      if (!key) return null;
      const matches = [representationRegistry, audioRepresentationRegistry, muxedRepresentationRegistry].filter((map) => map.has(key));
      return matches.length === 1 ? matches[0].get(key) : null;
    }, "lookupMediaRepresentation");
    const captureMediaRequest = /* @__PURE__ */ __name((url, runtime = deps.captureRuntimeGeneration()) => ({
      runtime,
      epoch: playinfoEpoch,
      rep: lookupMediaRepresentation(url),
      route: deps.captureNativeRouteContext(url)
    }), "captureMediaRequest");
    const mediaContextActive = /* @__PURE__ */ __name((context) => !!context && context.epoch === playinfoEpoch && deps.isRuntimeGenerationActive(context.runtime), "mediaContextActive");
    const mediaHeightMatches = /* @__PURE__ */ __name((rep) => {
      try {
        const video = deps.Watchdog.getVideo();
        return !video || !video.videoHeight || !rep.height || Math.abs(rep.height - video.videoHeight) <= 16;
      } catch {
        return false;
      }
    }, "mediaHeightMatches");
    const noteObservedVideoRepresentation = /* @__PURE__ */ __name((url, context = captureMediaRequest(url)) => {
      if (!mediaContextActive(context)) return false;
      const rep = context.rep;
      if (rep && rep.kind !== "video") return false;
      if (!rep) return false;
      observedVideoRepresentation = {
        height: rep.height,
        bandwidth: rep.bandwidth,
        codec: rep.codec,
        observedAt: Date.now()
      };
      return true;
    }, "noteObservedVideoRepresentation");
    const observeMediaTransfer = /* @__PURE__ */ __name((context, url, bytes, source) => {
      if (!mediaContextActive(context) || !Number.isSafeInteger(bytes) || bytes <= 0 || bytes > 256 * 1024 * 1024) return;
      deps.observeNativeTransport(context, url, bytes, source);
      let host = "", classification = "non-catalog";
      try {
        const parsed = new URL(url, location.href);
        if (!representationIdentity(parsed.href)) return;
        host = parsed.hostname;
        classification = deps.classifyMediaDelivery(parsed.href).kind || "non-catalog";
      } catch {
        return;
      }
      const trustedHost = deps.TRUSTED_CDN_CATALOG_SET.has(host) ? host : null;
      const rep = lookupMediaRepresentation(url) === context.rep ? context.rep : null;
      const kind = rep && ["video", "audio", "muxed"].includes(rep.kind) ? rep.kind : "unknown";
      const observation = {
        host: trustedHost,
        classification: trustedHost ? "catalog" : classification === "pcdn" || classification === "suspected-pcdn" ? classification : "non-catalog",
        source,
        kind,
        height: rep?.height || 0,
        observedAt: Date.now(),
        bytes,
        generation: context.runtime.generation,
        epoch: context.epoch
      };
      const previous = mediaObservations[kind];
      if (previous && previous.host === observation.host && previous.source === source) {
        observation.bytes = Math.min(Number.MAX_SAFE_INTEGER, previous.bytes + bytes);
      }
      mediaObservations[kind] = observation;
      if (kind === "video" && mediaHeightMatches(rep)) {
        noteObservedVideoRepresentation(url, context);
        if (source === "fetch" || source === "xhr") {
          deps.Watchdog.noteVideoTransport(lastVideoTransportObservation, observation);
          lastVideoTransportObservation = observation;
        }
      }
    }, "observeMediaTransfer");
    const freshMediaObservation = /* @__PURE__ */ __name((observation) => !!observation && !deps.disabled && observation.generation === deps.runtimeGeneration && observation.epoch === playinfoEpoch && Date.now() - observation.observedAt >= 0 && Date.now() - observation.observedAt <= REPRESENTATION_OBSERVATION_TTL_MS && (observation.kind !== "video" || mediaHeightMatches(observation)), "freshMediaObservation");
    const getAttributedVideoHost = /* @__PURE__ */ __name(() => freshMediaObservation(lastVideoTransportObservation) ? lastVideoTransportObservation.host : null, "getAttributedVideoHost");
    const getMediaDeliverySnapshot = /* @__PURE__ */ __name(() => Object.fromEntries(Object.entries(mediaObservations).map(([kind, observation]) => [
      kind,
      observation ? {
        host: observation.host,
        classification: observation.classification,
        source: observation.source,
        ageSec: Math.max(0, Math.round((Date.now() - observation.observedAt) / 1e3)),
        bytes: observation.bytes,
        fresh: freshMediaObservation(observation)
      } : { host: null, classification: "unknown", source: "none", ageSec: null, bytes: 0, fresh: false }
    ])), "getMediaDeliverySnapshot");
    let playbackQualityBaseline = null;
    let playbackQualitySnapshot = { available: false, totalFrames: null, droppedFrames: null, droppedPercent: null };
    const resetPlaybackQuality = /* @__PURE__ */ __name(() => {
      playbackQualityBaseline = null;
      playbackQualitySnapshot = { available: false, totalFrames: null, droppedFrames: null, droppedPercent: null };
    }, "resetPlaybackQuality");
    const samplePlaybackQuality = /* @__PURE__ */ __name(() => {
      if (deps.disabled) {
        resetPlaybackQuality();
        return;
      }
      try {
        const video = deps.Watchdog.getVideo();
        if (!video || typeof video.getVideoPlaybackQuality !== "function") {
          resetPlaybackQuality();
          return;
        }
        const result = video.getVideoPlaybackQuality();
        const total = result.totalVideoFrames, dropped = result.droppedVideoFrames;
        if (![total, dropped].every((n) => Number.isSafeInteger(n) && n >= 0) || dropped > total) {
          resetPlaybackQuality();
          return;
        }
        let baseline = playbackQualityBaseline;
        if (!baseline || baseline.video !== video || baseline.generation !== deps.runtimeGeneration || total < baseline.lastTotal || dropped < baseline.lastDropped) {
          baseline = playbackQualityBaseline = {
            video,
            generation: deps.runtimeGeneration,
            total,
            dropped,
            lastTotal: total,
            lastDropped: dropped,
            since: Date.now()
          };
        }
        baseline.lastTotal = total;
        baseline.lastDropped = dropped;
        const totalFrames = total - baseline.total, droppedFrames = dropped - baseline.dropped;
        if (droppedFrames > totalFrames) {
          resetPlaybackQuality();
          return;
        }
        playbackQualitySnapshot = {
          available: true,
          totalFrames,
          droppedFrames,
          droppedPercent: totalFrames ? +(droppedFrames * 100 / totalFrames).toFixed(3) : 0,
          observedSec: Math.max(0, Math.round((Date.now() - baseline.since) / 1e3))
        };
      } catch {
        resetPlaybackQuality();
      }
    }, "samplePlaybackQuality");
    const syncStreamBitrateFromVideo = /* @__PURE__ */ __name((videoEl) => {
      if (!streamProfile || !streamProfile.reps.length || !videoEl) return;
      const h = videoEl.videoHeight || 0;
      if (!h) return;
      let bestDiff = Infinity, bestBps = 0, selectedCodec = "other", estimateSource = "conservative-height-max";
      const observed = observedVideoRepresentation;
      if (observed && Date.now() - observed.observedAt <= REPRESENTATION_OBSERVATION_TTL_MS && Math.abs(observed.height - h) <= 16) {
        bestDiff = Math.abs(observed.height - h);
        bestBps = observed.bandwidth;
        selectedCodec = observed.codec;
        estimateSource = "observed-representation";
      }
      for (const r of streamProfile.reps) {
        const diff = Math.abs(r.height - h);
        if (estimateSource !== "observed-representation" && (diff < bestDiff || diff === bestDiff && r.bandwidth > bestBps)) {
          bestDiff = diff;
          bestBps = r.bandwidth;
          selectedCodec = ["av1", "hevc", "avc"].includes(r.codec) ? r.codec : "other";
        }
      }
      if (!bestBps) return;
      const total = bestBps + (streamProfile.audioBps || 0);
      streamEstimate = {
        source: estimateSource,
        codec: selectedCodec,
        height: Math.max(0, Math.trunc(h)),
        videoMbps: +(bestBps / 1e6).toFixed(3),
        audioMbps: +((streamProfile.audioBps || 0) / 1e6).toFixed(3)
      };
      if (currentStreamBitsPerSec > 0 && Math.abs(total - currentStreamBitsPerSec) < currentStreamBitsPerSec * 0.05) return;
      setBufferTargetFromBitrate(total, total > 12e6);
    }, "syncStreamBitrateFromVideo");
    const resetStreamProfile = /* @__PURE__ */ __name(() => {
      deps.clearCodecPlayinfo();
      deps.hostLockedStreams.clear();
      deps.preservedOriginalStreamUrls.clear();
      deps.rewrittenStreamOrigins.clear();
      resetRepresentationRegistry();
      streamEstimate = { source: "unknown", codec: "other", height: 0, videoMbps: 0, audioMbps: 0 };
      streamProfile = null;
      currentStreamBitsPerSec = 0;
      baseBufferTargetBytes = DEFAULT_BUFFER_TARGET_BYTES;
      deps.seekGraceUntil = 0;
      deps.resetPlaybackRateState();
    }, "resetStreamProfile");
    return {
      get currentStreamBitsPerSec() {
        return currentStreamBitsPerSec;
      },
      set currentStreamBitsPerSec(value) {
        currentStreamBitsPerSec = value;
      },
      get streamProfile() {
        return streamProfile;
      },
      set streamProfile(value) {
        streamProfile = value;
      },
      get DEFAULT_BUFFER_TARGET_BYTES() {
        return DEFAULT_BUFFER_TARGET_BYTES;
      },
      get baseBufferTargetBytes() {
        return baseBufferTargetBytes;
      },
      set baseBufferTargetBytes(value) {
        baseBufferTargetBytes = value;
      },
      get setBufferTargetFromBitrate() {
        return setBufferTargetFromBitrate;
      },
      get getBufferTargetBytes() {
        return getBufferTargetBytes;
      },
      get getWatchdogRequiredBps() {
        return getWatchdogRequiredBps;
      },
      get AUDIO_REGISTRY_MAX() {
        return AUDIO_REGISTRY_MAX;
      },
      get muxedRepresentationRegistry() {
        return muxedRepresentationRegistry;
      },
      get playinfoEpoch() {
        return playinfoEpoch;
      },
      set playinfoEpoch(value) {
        playinfoEpoch = value;
      },
      get mediaObservations() {
        return mediaObservations;
      },
      set mediaObservations(value) {
        mediaObservations = value;
      },
      get streamEstimate() {
        return streamEstimate;
      },
      set streamEstimate(value) {
        streamEstimate = value;
      },
      get resetMediaDelivery() {
        return resetMediaDelivery;
      },
      get resetRepresentationRegistry() {
        return resetRepresentationRegistry;
      },
      get registerMediaRepresentation() {
        return registerMediaRepresentation;
      },
      get rebuildRepresentationRegistry() {
        return rebuildRepresentationRegistry;
      },
      get captureMediaRequest() {
        return captureMediaRequest;
      },
      get mediaContextActive() {
        return mediaContextActive;
      },
      get observeMediaTransfer() {
        return observeMediaTransfer;
      },
      get freshMediaObservation() {
        return freshMediaObservation;
      },
      get getAttributedVideoHost() {
        return getAttributedVideoHost;
      },
      get getMediaDeliverySnapshot() {
        return getMediaDeliverySnapshot;
      },
      get playbackQualitySnapshot() {
        return playbackQualitySnapshot;
      },
      set playbackQualitySnapshot(value) {
        playbackQualitySnapshot = value;
      },
      get resetPlaybackQuality() {
        return resetPlaybackQuality;
      },
      get samplePlaybackQuality() {
        return samplePlaybackQuality;
      },
      get syncStreamBitrateFromVideo() {
        return syncStreamBitrateFromVideo;
      },
      get resetStreamProfile() {
        return resetStreamProfile;
      }
    };
  }
  __name(createMedia, "createMedia");

  // src/routing/httpdns.mjs
  function createHttpdns(deps) {
    const HTTPDNS_PROFILE_KEY = "httpdnsProfile_v2";
    const HTTPDNS_STATE_KEY = "httpdnsAutoState_v2";
    const HTTPDNS_TRIAL_MS = 10 * 60 * 1e3;
    const HTTPDNS_COMMIT_MS = 6 * 60 * 60 * 1e3;
    const HTTPDNS_PROFILE_TTL = 7 * 24 * 60 * 60 * 1e3;
    const HTTPDNS_SCORE_MARGIN = 10;
    const normalizeHttpDnsMode = /* @__PURE__ */ __name((mode) => mode === true || mode === false || mode === "auto" ? mode : "auto", "normalizeHttpDnsMode");
    let httpDnsMode = normalizeHttpDnsMode(deps.BlockHttpDNS);
    const HttpDnsAutoPilot = (() => {
      const getNetworkKey = /* @__PURE__ */ __name(() => {
        const tz = (() => {
          try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
          } catch {
            return "unknown";
          }
        })();
        const lang = (navigator.language || "en").slice(0, 5);
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        const type = conn ? conn.effectiveType || conn.type || "unknown" : "unknown";
        const downlink = conn && conn.downlink ? String(Math.round(conn.downlink)) : "x";
        return [tz, lang, type, downlink].join("|");
      }, "getNetworkKey");
      const computeScore = /* @__PURE__ */ __name((m) => {
        const elapsedSec = Math.max(1, m.elapsedSec || 1);
        const actualMbps = (m.totalBytes || 0) * 8 / 1e6 / elapsedSec;
        const needMbps = Math.max(1.5, deps.getRequiredStreamMbps());
        const ratio = Math.min(1.2, actualMbps / needMbps);
        const score = ratio * 100 - (m.stallEvents || 0) * 25 - (m.hardFailCount || 0) * 40 - (m.switchCount || 0) * 15 + (m.reachedTarget ? 10 : 0);
        return Math.round(score * 10) / 10;
      }, "computeScore");
      const emptyProfile = /* @__PURE__ */ __name((networkKey) => ({
        networkKey,
        blockAvg: 0,
        allowAvg: 0,
        blockSamples: 0,
        allowSamples: 0,
        decision: "undecided",
        decisionUntil: 0,
        updatedAt: Date.now()
      }), "emptyProfile");
      const loadProfile = /* @__PURE__ */ __name(() => {
        const networkKey = getNetworkKey();
        try {
          const raw = JSON.parse(GM_getValue(HTTPDNS_PROFILE_KEY) || "{}");
          if (raw.networkKey === networkKey && Date.now() - (raw.updatedAt || 0) < HTTPDNS_PROFILE_TTL) {
            return raw;
          }
        } catch {
        }
        return emptyProfile(networkKey);
      }, "loadProfile");
      let profile = loadProfile();
      const saveProfile = /* @__PURE__ */ __name(() => {
        profile.updatedAt = Date.now();
        profile.networkKey = getNetworkKey();
        try {
          GM_setValue(HTTPDNS_PROFILE_KEY, JSON.stringify(profile));
        } catch {
        }
      }, "saveProfile");
      const loadAutoState = /* @__PURE__ */ __name(() => {
        try {
          const raw = JSON.parse(GM_getValue(HTTPDNS_STATE_KEY) || "{}");
          return {
            phase: raw.phase || "none",
            allowUntil: Number(raw.allowUntil) || 0,
            trialStartedAt: Number(raw.trialStartedAt) || 0,
            trialScore: Number(raw.trialScore) || 0,
            lastReason: raw.lastReason || "",
            lastChangedAt: Number(raw.lastChangedAt) || 0
          };
        } catch {
          return { phase: "none", allowUntil: 0, trialStartedAt: 0, trialScore: 0, lastReason: "", lastChangedAt: 0 };
        }
      }, "loadAutoState");
      let autoState = loadAutoState();
      const saveAutoState = /* @__PURE__ */ __name(() => {
        try {
          GM_setValue(HTTPDNS_STATE_KEY, JSON.stringify(autoState));
        } catch {
        }
      }, "saveAutoState");
      let trialBaseline = null;
      const subtractBaseline = /* @__PURE__ */ __name((sample, baseline) => {
        if (!baseline) return sample;
        if ((sample.totalBytes || 0) < (baseline.totalBytes || 0)) return sample;
        return {
          totalBytes: Math.max(0, (sample.totalBytes || 0) - (baseline.totalBytes || 0)),
          stallEvents: Math.max(0, (sample.stallEvents || 0) - (baseline.stallEvents || 0)),
          switchCount: Math.max(0, (sample.switchCount || 0) - (baseline.switchCount || 0)),
          hardFailCount: Math.max(0, (sample.hardFailCount || 0) - (baseline.hardFailCount || 0)),
          elapsedSec: Math.max(1, (sample.elapsedSec || 1) - (baseline.elapsedSec || 0)),
          reachedTarget: !!sample.reachedTarget
        };
      }, "subtractBaseline");
      const mergeAvg = /* @__PURE__ */ __name((prevAvg, prevN, score) => {
        const n = prevN + 1;
        return { avg: Math.round((prevAvg * prevN + score) / n * 10) / 10, n };
      }, "mergeAvg");
      const recordSample = /* @__PURE__ */ __name((strategy, sample) => {
        const score = computeScore(sample);
        if (strategy === "allow") {
          const m = mergeAvg(profile.allowAvg, profile.allowSamples, score);
          profile.allowAvg = m.avg;
          profile.allowSamples = m.n;
        } else {
          const m = mergeAvg(profile.blockAvg, profile.blockSamples, score);
          profile.blockAvg = m.avg;
          profile.blockSamples = m.n;
        }
        saveProfile();
        return score;
      }, "recordSample");
      const commitDecision = /* @__PURE__ */ __name((decision, reason, score) => {
        profile.decision = decision;
        profile.decisionUntil = Date.now() + HTTPDNS_COMMIT_MS;
        profile.updatedAt = Date.now();
        saveProfile();
        autoState = {
          phase: decision === "allow" ? "committed-allow" : "none",
          allowUntil: decision === "allow" ? profile.decisionUntil : 0,
          trialStartedAt: 0,
          trialScore: score || 0,
          lastReason: reason,
          lastChangedAt: Date.now()
        };
        saveAutoState();
      }, "commitDecision");
      const startTrialAllow = /* @__PURE__ */ __name((reason, baseline) => {
        trialBaseline = baseline ? { ...baseline } : null;
        autoState = {
          phase: "trial-allow",
          allowUntil: Date.now() + HTTPDNS_TRIAL_MS,
          trialStartedAt: Date.now(),
          trialScore: 0,
          lastReason: reason || "playback-stall",
          lastChangedAt: Date.now()
        };
        deps.redirectStats.httpdnsAutoSwitch++;
        saveAutoState();
        try {
          GM_deleteValue(deps.PROBE_CACHE_KEY);
        } catch {
        }
      }, "startTrialAllow");
      const endTrialAllow = /* @__PURE__ */ __name((reason, sample) => {
        const trialSample = subtractBaseline(sample, trialBaseline);
        const allowScore = recordSample("allow", trialSample);
        autoState.trialScore = allowScore;
        const blockRef = profile.blockAvg || 0;
        const pass = allowScore >= blockRef + HTTPDNS_SCORE_MARGIN;
        if (pass) {
          commitDecision("allow", "trial-pass:" + (reason || "score"), allowScore);
        } else {
          commitDecision("block", "trial-fail:" + (reason || "score"), allowScore);
        }
        trialBaseline = null;
        deps.redirectStats.httpdnsAutoSwitch++;
      }, "endTrialAllow");
      const isTrialAllowing = /* @__PURE__ */ __name(() => httpDnsMode === "auto" && (autoState.phase === "trial-allow" || autoState.phase === "committed-allow") && autoState.allowUntil > Date.now(), "isTrialAllowing");
      const isProfileAllowing = /* @__PURE__ */ __name(() => httpDnsMode === "auto" && profile.decision === "allow" && profile.decisionUntil > Date.now(), "isProfileAllowing");
      const shouldBlock = /* @__PURE__ */ __name(() => {
        if (httpDnsMode === true) return true;
        if (httpDnsMode === false) return false;
        if (isTrialAllowing() || isProfileAllowing()) return false;
        return true;
      }, "shouldBlock");
      const getStatus = /* @__PURE__ */ __name(() => {
        const networkKey = getNetworkKey();
        if (httpDnsMode === true) {
          return { mode: "force-block", block: true, ttlMin: 0, networkKey, scores: { block: profile.blockAvg, allow: profile.allowAvg } };
        }
        if (httpDnsMode === false) {
          return { mode: "force-allow", block: false, ttlMin: 0, networkKey, scores: { block: profile.blockAvg, allow: profile.allowAvg } };
        }
        const ttlMin = autoState.allowUntil > Date.now() ? Math.max(0, Math.ceil((autoState.allowUntil - Date.now()) / 6e4)) : profile.decisionUntil > Date.now() ? Math.max(0, Math.ceil((profile.decisionUntil - Date.now()) / 6e4)) : 0;
        let mode = "auto-block";
        if (autoState.phase === "trial-allow" && isTrialAllowing()) mode = "auto-trial-allow";
        else if (autoState.phase === "committed-allow" && isTrialAllowing()) mode = "auto-allow";
        else if (isProfileAllowing()) mode = "auto-allow-memory";
        return {
          mode,
          block: shouldBlock(),
          ttlMin,
          reason: autoState.lastReason || profile.decision,
          networkKey,
          scores: {
            block: profile.blockAvg,
            allow: profile.allowAvg,
            blockSamples: profile.blockSamples,
            allowSamples: profile.allowSamples,
            trial: autoState.trialScore || null
          },
          decision: profile.decision
        };
      }, "getStatus");
      const onStall = /* @__PURE__ */ __name((reason, watchdogStats) => {
        if (httpDnsMode !== "auto") return false;
        const sample = {
          totalBytes: watchdogStats.totalBytes || 0,
          stallEvents: (watchdogStats.stallEvents || 0) + 1,
          switchCount: watchdogStats.switchCount || 0,
          hardFailCount: watchdogStats.hardFailCount || 0,
          elapsedSec: watchdogStats.elapsedSec || 1,
          reachedTarget: false
        };
        if (isTrialAllowing()) {
          const trialSample = subtractBaseline(sample, trialBaseline);
          const score = recordSample("allow", trialSample);
          autoState.trialScore = score;
          commitDecision("block", "trial-stall:" + reason, score);
          trialBaseline = null;
          deps.redirectStats.httpdnsAutoSwitch++;
          return true;
        }
        if (shouldBlock() && deps.redirectStats.httpdns > 0) {
          recordSample("block", sample);
          startTrialAllow(reason, sample);
          return true;
        }
        return false;
      }, "onStall");
      const onTargetReached = /* @__PURE__ */ __name((watchdogStats) => {
        if (httpDnsMode !== "auto") return;
        const sample = {
          totalBytes: watchdogStats.totalBytes || 0,
          stallEvents: watchdogStats.stallEvents || 0,
          switchCount: watchdogStats.switchCount || 0,
          hardFailCount: watchdogStats.hardFailCount || 0,
          elapsedSec: watchdogStats.elapsedSec || 1,
          reachedTarget: true
        };
        if (autoState.phase === "trial-allow" && autoState.trialStartedAt > 0) {
          endTrialAllow("target-reached", sample);
          return;
        }
        recordSample(shouldBlock() ? "block" : "allow", sample);
      }, "onTargetReached");
      const tick = /* @__PURE__ */ __name((watchdogStats) => {
        if (httpDnsMode !== "auto") return;
        if (autoState.phase !== "trial-allow") return;
        if (autoState.allowUntil > Date.now()) return;
        const sample = {
          totalBytes: watchdogStats.totalBytes || 0,
          stallEvents: watchdogStats.stallEvents || 0,
          switchCount: watchdogStats.switchCount || 0,
          hardFailCount: watchdogStats.hardFailCount || 0,
          elapsedSec: watchdogStats.elapsedSec || 1,
          reachedTarget: watchdogStats.reachedTarget || false
        };
        endTrialAllow("trial-timeout", sample);
      }, "tick");
      const reset = /* @__PURE__ */ __name(() => {
        profile = emptyProfile(getNetworkKey());
        saveProfile();
        autoState = { phase: "none", allowUntil: 0, trialStartedAt: 0, trialScore: 0, lastReason: "", lastChangedAt: Date.now() };
        saveAutoState();
        trialBaseline = null;
      }, "reset");
      const setMode = /* @__PURE__ */ __name((mode) => {
        httpDnsMode = normalizeHttpDnsMode(mode);
        deps.BlockHttpDNS = httpDnsMode;
        if (httpDnsMode !== "auto") reset();
        return getStatus();
      }, "setMode");
      const HTTPDNS_TRIAL_MAX_MS = HTTPDNS_TRIAL_MS * 3;
      const onWatchdogReset = /* @__PURE__ */ __name(() => {
        if (autoState.phase !== "trial-allow") return;
        trialBaseline = { totalBytes: 0, stallEvents: 0, switchCount: 0, hardFailCount: 0, elapsedSec: 0 };
        const trialStart = autoState.trialStartedAt || Date.now();
        autoState.allowUntil = Math.min(Date.now() + HTTPDNS_TRIAL_MS, trialStart + HTTPDNS_TRIAL_MAX_MS);
        autoState.trialStartedAt = trialStart;
        saveAutoState();
      }, "onWatchdogReset");
      return {
        shouldBlock,
        getStatus,
        onStall,
        onTargetReached,
        tick,
        reset,
        setMode,
        onWatchdogReset
      };
    })();
    const getHttpDnsStatus = /* @__PURE__ */ __name(() => HttpDnsAutoPilot.getStatus(), "getHttpDnsStatus");
    const shouldBlockHttpDns = /* @__PURE__ */ __name(() => HttpDnsAutoPilot.shouldBlock(), "shouldBlockHttpDns");
    const setHttpDnsMode = /* @__PURE__ */ __name((mode) => HttpDnsAutoPilot.setMode(mode), "setHttpDnsMode");
    return {
      get HttpDnsAutoPilot() {
        return HttpDnsAutoPilot;
      },
      get getHttpDnsStatus() {
        return getHttpDnsStatus;
      },
      get shouldBlockHttpDns() {
        return shouldBlockHttpDns;
      },
      get setHttpDnsMode() {
        return setHttpDnsMode;
      }
    };
  }
  __name(createHttpdns, "createHttpdns");

  // src/policy/rewrite.mjs
  function createRewrite(deps) {
    const normalizeMediaUrl = /* @__PURE__ */ __name((urlStr) => {
      const decision = decideMediaRewrite(urlStr, true);
      if (decision.action !== "rewrite") {
        if (decision.reason === "live") deps.redirectStats.liveSkipped = Math.min(1e4, deps.redirectStats.liveSkipped + 1);
        if (decision.reason === "suspected-pcdn") deps.redirectStats.pcdnSuspectedPort = Math.min(1e4, deps.redirectStats.pcdnSuspectedPort + 1);
        return {
          url: decision.url,
          changed: decision.action === "restore",
          restoredOriginal: decision.action === "restore",
          originCdn: deps.parseMediaHttpUrl(urlStr)?.hostname,
          targetCdn: deps.parseMediaHttpUrl(decision.url)?.hostname
        };
      }
      const delivery = deps.classifyMediaDelivery(urlStr);
      if (delivery.kind === "live") {
        deps.redirectStats.liveSkipped = Math.min(1e4, (deps.redirectStats.liveSkipped || 0) + 1);
        return { url: urlStr, changed: false, originCdn: delivery.host, liveSkipped: true };
      }
      const mappedOriginalUrl = getOriginalStreamUrl(urlStr);
      if (mappedOriginalUrl !== urlStr && isHostLockedStream(mappedOriginalUrl)) {
        const originCdn2 = (() => {
          try {
            return new URL(urlStr).hostname;
          } catch {
            return null;
          }
        })();
        const targetCdn = (() => {
          try {
            return new URL(mappedOriginalUrl).hostname;
          } catch {
            return null;
          }
        })();
        return {
          url: mappedOriginalUrl,
          changed: true,
          originCdn: originCdn2,
          targetCdn,
          restoredOriginal: true
        };
      }
      const unstableUrl = deps.rewriteUnstableMediaUrl(urlStr);
      if (unstableUrl && unstableUrl !== urlStr) {
        deps.redirectStats.unstable++;
        let originCdn2 = "?", targetCdn = "?";
        try {
          originCdn2 = new URL(urlStr).hostname;
          targetCdn = new URL(unstableUrl).hostname;
        } catch {
        }
        logRedirect("不穩定", originCdn2, targetCdn, "MCDN/PCDN");
        return { url: unstableUrl, changed: true, originCdn: originCdn2, targetCdn };
      }
      if (deps.isAkamaiUrl(urlStr)) {
        let originCdn2 = null;
        try {
          originCdn2 = new URL(urlStr).hostname;
        } catch {
        }
        if (!originCdn2 || !deps.isForcedRedirect(originCdn2)) return { url: urlStr, changed: false, originCdn: originCdn2 };
        const bestCdn2 = deps.getCurrentCdn();
        const newUrl2 = bestCdn2 ? replaceUrlHost(urlStr, bestCdn2) : null;
        if (!newUrl2 || newUrl2 === urlStr) return { url: urlStr, changed: false, originCdn: originCdn2 };
        deps.redirectStats.whitelist++;
        logRedirect("Transport", originCdn2, bestCdn2, "Akamai 失敗後改寫");
        return { url: newUrl2, changed: true, originCdn: originCdn2, targetCdn: bestCdn2 };
      }
      if (!deps.isBiliFragmentUrl(urlStr)) return { url: urlStr, changed: false };
      const originCdn = deps.getBiliVideoCdn(urlStr);
      if (!needsRedirect(originCdn)) return { url: urlStr, changed: false, originCdn };
      if (deps.inSeekGrace()) {
        const mustFix = deps.matchesExclude(originCdn) || deps.knownDeadHosts.has(originCdn) || deps.blacklistSet.has(originCdn) || deps.isUnstableCdnHost(originCdn) || deps.isForcedRedirect(originCdn);
        if (!mustFix) return { url: urlStr, changed: false, originCdn };
      }
      const bestCdn = deps.getCurrentCdn();
      if (!bestCdn || bestCdn === originCdn) return { url: urlStr, changed: false, originCdn };
      const newUrl = replaceUrlHost(urlStr, bestCdn);
      if (!newUrl || newUrl === urlStr) return { url: urlStr, changed: false, originCdn };
      deps.redirectStats.whitelist++;
      logRedirect(
        "Transport",
        originCdn,
        bestCdn,
        deps.blacklistSet.has(originCdn) ? "黑名單" : "非白名單"
      );
      return { url: newUrl, changed: true, originCdn, targetCdn: bestCdn };
    }, "normalizeMediaUrl");
    const isMediaSegmentUrl = /* @__PURE__ */ __name((url) => {
      if (!url) return false;
      if (deps.isProtectedSignedUrl(url)) return true;
      const delivery = deps.classifyMediaDelivery(url);
      if (delivery.kind === "pcdn" || delivery.kind === "suspected-pcdn" || delivery.kind === "live") return true;
      if (deps.isBiliFragmentUrl(url)) return true;
      try {
        const u = deps.parseMediaHttpUrl(url);
        if (!u) return false;
        const host = u.hostname;
        if (deps.isUnstableCdnHost(host)) return true;
        if (host.endsWith(".akamaized.net")) {
          const path = u.pathname;
          return path.endsWith(".m4s") || path.endsWith(".flv") || path.includes("/upgcxcode/");
        }
        return false;
      } catch {
        return false;
      }
    }, "isMediaSegmentUrl");
    const _redirectLogTs = {};
    const _redirectLogTotal = {};
    const REDIRECT_LOG_COOLDOWN = 5e3;
    const QUIET_REDIRECT_AFTER = 3;
    const QUIET_REDIRECT_EVERY = 25;
    const logRedirect = /* @__PURE__ */ __name((channel, originCdn, targetCdn, reason) => {
      deps.DiagnosticLog.record("rewrite", { originalHost: originCdn, targetHost: targetCdn });
      const key = channel + "|" + (originCdn || "?") + "|" + targetCdn;
      const now = Date.now();
      const last = _redirectLogTs[key] || 0;
      const total = (_redirectLogTotal[key] || 0) + 1;
      _redirectLogTotal[key] = total;
      if (channel === "Transport" && total > QUIET_REDIRECT_AFTER && total % QUIET_REDIRECT_EVERY !== 0) {
        deps.redirectStats.quietRedirects++;
        return;
      }
      if (now - last < REDIRECT_LOG_COOLDOWN) return;
      _redirectLogTs[key] = now;
      deps.log("[" + channel + "] " + String(originCdn || "?").split(".")[0] + " → " + String(targetCdn || "?").split(".")[0] + "（" + reason + "，累計 " + total + " 次）");
    }, "logRedirect");
    const needsRedirect = /* @__PURE__ */ __name((cdn) => {
      if (!cdn) return false;
      if (deps.resolvedCdn && cdn === deps.resolvedCdn) return false;
      if (deps.matchesExclude(cdn)) return true;
      if (deps.isForcedRedirect(cdn)) return true;
      return deps.knownDeadHosts.has(cdn) || deps.blacklistSet.has(cdn) || deps.isCdnStronglyBad(cdn) || !deps.PREFERRED_CDN_LIST.includes(cdn);
    }, "needsRedirect");
    const hostLockedStreams = /* @__PURE__ */ new Set();
    const preservedOriginalStreamUrls = /* @__PURE__ */ new Set();
    const rewrittenStreamOrigins = /* @__PURE__ */ new Map();
    const REWRITTEN_STREAM_ORIGIN_MAX = 512;
    const streamUrlIdentity = /* @__PURE__ */ __name((urlStr) => {
      return deps.parseMediaHttpUrl(urlStr)?.href || String(urlStr || "");
    }, "streamUrlIdentity");
    const rememberRewrittenStreamUrl = /* @__PURE__ */ __name((rewrittenUrl, originalUrl) => {
      if (!rewrittenUrl || !originalUrl || rewrittenUrl === originalUrl) return rewrittenUrl;
      const originalKey = streamUrlIdentity(originalUrl);
      const rootOriginal = rewrittenStreamOrigins.get(originalKey) || originalUrl;
      rewrittenStreamOrigins.set(streamUrlIdentity(rewrittenUrl), rootOriginal);
      if (rewrittenStreamOrigins.size > REWRITTEN_STREAM_ORIGIN_MAX) {
        rewrittenStreamOrigins.delete(rewrittenStreamOrigins.keys().next().value);
      }
      return rewrittenUrl;
    }, "rememberRewrittenStreamUrl");
    const getOriginalStreamUrl = /* @__PURE__ */ __name((urlStr) => rewrittenStreamOrigins.get(streamUrlIdentity(urlStr)) || urlStr, "getOriginalStreamUrl");
    const streamLockKey = /* @__PURE__ */ __name((urlStr) => {
      try {
        const u = deps.parseMediaHttpUrl(urlStr);
        return u ? u.searchParams.get("os") || u.pathname : String(urlStr);
      } catch {
        return String(urlStr);
      }
    }, "streamLockKey");
    const isHostLockedStream = /* @__PURE__ */ __name((urlStr) => {
      if (!hostLockedStreams.size || !urlStr) return false;
      return hostLockedStreams.has(streamLockKey(urlStr));
    }, "isHostLockedStream");
    const noteHostLockedStream = /* @__PURE__ */ __name((urlStr) => {
      const k = streamLockKey(urlStr);
      if (!k || hostLockedStreams.has(k)) return false;
      hostLockedStreams.add(k);
      deps.redirectStats.hostLocked = (deps.redirectStats.hostLocked || 0) + 1;
      deps.log("[綁定節點] 這條串流換 host 會被拒絕（403），之後不再改寫也不賽馬：" + k);
      return true;
    }, "noteHostLockedStream");
    const decideMediaRewrite = /* @__PURE__ */ __name((urlStr, preserveFallback = false) => {
      const decision = deps.mediaUrlPolicy.decide(urlStr);
      if (decision.action === "pass") return { ...decision, url: urlStr };
      const original = getOriginalStreamUrl(urlStr);
      if (isHostLockedStream(original)) {
        return { action: original !== urlStr ? "restore" : "pass", reason: "host-locked", url: original };
      }
      if (preserveFallback && preservedOriginalStreamUrls.has(urlStr)) return { action: "pass", reason: "original-backup", url: urlStr };
      return { ...decision, url: urlStr };
    }, "decideMediaRewrite");
    const replaceUrlHost = /* @__PURE__ */ __name((urlStr, targetHost) => {
      const decision = decideMediaRewrite(urlStr);
      if (decision.action === "restore") return decision.url;
      if (decision.action !== "rewrite") return null;
      const host = targetHost || deps.getCurrentCdn();
      if (!deps.isValidCustomCdnHost(host)) return null;
      const u = deps.parseMediaHttpUrl(urlStr);
      if (u.hostname === host) return urlStr;
      u.hostname = host;
      u.port = "";
      if (u.href.length > deps.MEDIA_URL_MAX_LENGTH) return null;
      return rememberRewrittenStreamUrl(u.toString(), urlStr);
    }, "replaceUrlHost");
    const buildBackupUrls = /* @__PURE__ */ __name((biliSrcUrl, primaryUrl) => {
      if (!biliSrcUrl || decideMediaRewrite(biliSrcUrl).action !== "rewrite") return [];
      let primaryHost, sourceHost;
      try {
        primaryHost = new URL(primaryUrl || biliSrcUrl).hostname;
      } catch {
        primaryHost = "";
      }
      try {
        sourceHost = new URL(biliSrcUrl).hostname;
      } catch {
        sourceHost = "";
      }
      if (deps.resolvedCdn) {
        const u = rememberRewrittenStreamUrl(replaceUrlHost(biliSrcUrl, deps.resolvedCdn), biliSrcUrl);
        return u && u !== primaryUrl ? [u] : [];
      }
      return deps.getHealthyCdnList(deps.STARTUP_PICK).filter((cdn) => cdn !== primaryHost && cdn !== sourceHost).filter((cdn) => !deps.matchesExclude(cdn) && !deps.knownDeadHosts.has(cdn) && !deps.blacklistSet.has(cdn)).slice(0, 2).map((cdn) => rememberRewrittenStreamUrl(replaceUrlHost(biliSrcUrl, cdn), biliSrcUrl)).filter(Boolean);
    }, "buildBackupUrls");
    const sanitizePlayInfoUrls = /* @__PURE__ */ __name((root) => {
      const seen = /* @__PURE__ */ new WeakSet();
      let changed = 0;
      const rewrite = /* @__PURE__ */ __name((value) => {
        if (typeof value !== "string" || value.length < 12) return value;
        if (deps.isProtectedSignedUrl(value)) return value;
        if (!/(?:\.bilivideo\.|szbdyd\.com|mountaintoys\.cn|nexusedgeio\.com|ahdohpiechei\.com)/i.test(value)) return value;
        const decision = decideMediaRewrite(value, true);
        if (decision.action !== "rewrite") return decision.url;
        if (!deps.isBiliVideoUrl(value) || deps.isAkamaiUrl(value)) return value;
        const host = deps.getBiliVideoCdn(value);
        if (!needsRedirect(host)) return value;
        const next = rememberRewrittenStreamUrl(replaceUrlHost(value), getOriginalStreamUrl(value));
        if (next && next !== value) {
          changed++;
          return next;
        }
        return value;
      }, "rewrite");
      const walk = /* @__PURE__ */ __name((node) => {
        if (!node || typeof node !== "object") return;
        if (seen.has(node)) return;
        seen.add(node);
        if (Array.isArray(node)) {
          for (let i = 0; i < node.length; i++) {
            if (typeof node[i] === "string") node[i] = rewrite(node[i]);
            else walk(node[i]);
          }
          return;
        }
        Object.keys(node).forEach((k) => {
          const value = node[k];
          if (typeof value === "string") node[k] = rewrite(value);
          else walk(value);
        });
      }, "walk");
      walk(root);
      return changed;
    }, "sanitizePlayInfoUrls");
    const pickStreamUrls = /* @__PURE__ */ __name((item, isDash) => {
      if (!item) return { validUrls: [], akamaiUrl: void 0, biliSrcUrl: void 0, highBitrateItem: false, preferWhitelistPrimary: false };
      const rawUrls = isDash ? [item.base_url, item.baseUrl].concat(Array.isArray(item.backup_url) ? item.backup_url : []).concat(Array.isArray(item.backupUrl) ? item.backupUrl : []) : [item.url].concat(Array.isArray(item.backup_url) ? item.backup_url : []).concat(Array.isArray(item.backupUrl) ? item.backupUrl : []);
      const validUrls = rawUrls.filter((u) => u && typeof u === "string");
      const akamaiUrl = validUrls.find((u) => deps.isAkamaiUrl(u) && deps.mediaUrlPolicy.decide(u).action === "rewrite");
      const isRewritable = /* @__PURE__ */ __name((u) => deps.mediaUrlPolicy.decide(u).action === "rewrite" && !deps.isAkamaiUrl(u), "isRewritable");
      const biliSrcUrl = validUrls.find((u) => {
        if (!isRewritable(u)) return false;
        try {
          return !deps.isUnstableCdnHost(new URL(u).hostname);
        } catch {
          return false;
        }
      }) || validUrls.find(isRewritable);
      const highBitrateItem = isDash && ((item.bandwidth || 0) > 12e6 || (item.height || 0) >= 2160);
      const preferWhitelistPrimary = highBitrateItem && biliSrcUrl;
      return { validUrls, akamaiUrl, biliSrcUrl, highBitrateItem, preferWhitelistPrimary };
    }, "pickStreamUrls");
    const withOriginalStreamFallback = /* @__PURE__ */ __name((generated, originalUrl, primaryUrl) => {
      originalUrl = getOriginalStreamUrl(originalUrl);
      const out = [...new Set((generated || []).filter(Boolean))];
      if (originalUrl && originalUrl !== primaryUrl) {
        const existing = out.indexOf(originalUrl);
        if (existing !== -1) out.splice(existing, 1);
        preservedOriginalStreamUrls.add(originalUrl);
        if (preservedOriginalStreamUrls.size > REWRITTEN_STREAM_ORIGIN_MAX) preservedOriginalStreamUrls.delete(preservedOriginalStreamUrls.values().next().value);
        out.push(originalUrl);
      }
      return out;
    }, "withOriginalStreamFallback");
    const transformStreamItem = /* @__PURE__ */ __name((item, isDash) => {
      if (!item) return false;
      isDash = isDash !== false;
      const { validUrls, akamaiUrl, biliSrcUrl, preferWhitelistPrimary } = pickStreamUrls(item, isDash);
      validUrls.forEach((u) => {
        try {
          const h = new URL(u).hostname;
          if (!deps.isUnstableCdnHost(h) && (h.endsWith(".bilivideo.com") || h.endsWith(".bilivideo.cn"))) {
            deps.noteDiscoveredCdn(h);
          }
        } catch {
        }
      });
      if (!akamaiUrl && biliSrcUrl) {
        try {
          const srcHost = new URL(biliSrcUrl).hostname;
          deps.noteDiscoveredCdn(srcHost);
        } catch {
        }
      }
      if (akamaiUrl && !preferWhitelistPrimary) {
        if (isDash) {
          item.base_url = akamaiUrl;
          item.baseUrl = akamaiUrl;
        } else {
          item.url = akamaiUrl;
        }
        const backups = withOriginalStreamFallback(buildBackupUrls(biliSrcUrl, akamaiUrl), biliSrcUrl, akamaiUrl);
        if (backups.length) {
          item.backup_url = backups;
          item.backupUrl = backups;
        }
      } else if (biliSrcUrl) {
        const bestCdn = deps.getCurrentCdn(deps.STARTUP_PICK);
        const primUrl = bestCdn ? rememberRewrittenStreamUrl(replaceUrlHost(biliSrcUrl, bestCdn), biliSrcUrl) : biliSrcUrl;
        if (primUrl) {
          if (isDash) {
            item.base_url = primUrl;
            item.baseUrl = primUrl;
          } else {
            item.url = primUrl;
          }
        }
        let backups = buildBackupUrls(biliSrcUrl, primUrl || biliSrcUrl);
        if (akamaiUrl && !backups.includes(akamaiUrl)) {
          backups.unshift(akamaiUrl);
        }
        backups = withOriginalStreamFallback(backups, biliSrcUrl, primUrl || biliSrcUrl);
        if (backups.length) {
          item.backup_url = backups;
          item.backupUrl = backups;
        }
      } else {
        return false;
      }
      return !!akamaiUrl;
    }, "transformStreamItem");
    return {
      get normalizeMediaUrl() {
        return normalizeMediaUrl;
      },
      get isMediaSegmentUrl() {
        return isMediaSegmentUrl;
      },
      get needsRedirect() {
        return needsRedirect;
      },
      get hostLockedStreams() {
        return hostLockedStreams;
      },
      get preservedOriginalStreamUrls() {
        return preservedOriginalStreamUrls;
      },
      get rewrittenStreamOrigins() {
        return rewrittenStreamOrigins;
      },
      get getOriginalStreamUrl() {
        return getOriginalStreamUrl;
      },
      get isHostLockedStream() {
        return isHostLockedStream;
      },
      get noteHostLockedStream() {
        return noteHostLockedStream;
      },
      get decideMediaRewrite() {
        return decideMediaRewrite;
      },
      get replaceUrlHost() {
        return replaceUrlHost;
      },
      get sanitizePlayInfoUrls() {
        return sanitizePlayInfoUrls;
      },
      get pickStreamUrls() {
        return pickStreamUrls;
      },
      get transformStreamItem() {
        return transformStreamItem;
      }
    };
  }
  __name(createRewrite, "createRewrite");

  // src/playback/codec.mjs
  function createCodec(deps) {
    const getDashCodecString = /* @__PURE__ */ __name((item) => {
      const direct = String(item && (item.codecs || item.codec) || "").trim();
      if (direct) return direct;
      const mime = String(item && (item.mime_type || item.mimeType) || "");
      const match = mime.match(/codecs\s*=\s*["']?\s*([^"',;\s]+)/i);
      return match ? match[1] : "";
    }, "getDashCodecString");
    const normalizeCodecName = /* @__PURE__ */ __name((item) => {
      const codec = String(getDashCodecString(item) || item && (item.mime_type || item.mimeType) || "").toLowerCase();
      const codecid = Number(item && (item.codecid || item.codec_id || item.codecId));
      if (codec.includes("av01") || codecid === 13) return "av1";
      if (codec.includes("hev1") || codec.includes("hvc1") || codecid === 12) return "hevc";
      if (codec.includes("avc1") || codecid === 7) return "avc";
      return "other";
    }, "normalizeCodecName");
    const VIDEO_CODEC_PREFERENCES = Object.freeze(["av1", "hevc", "avc", "auto"]);
    const resolvedVideoCodecPreference = VIDEO_CODEC_PREFERENCES.includes(deps.PreferredVideoCodec) ? deps.PreferredVideoCodec : "hevc";
    const CODEC_CAPABILITY_MAX = 128;
    const codecCapability = /* @__PURE__ */ new Map();
    let codecQueryQueue = [];
    let codecQueriesInFlight = 0;
    let activeCodecConfigurations = [];
    let codecResumeItems = [];
    let lastCodecDecision = { preference: resolvedVideoCodecPreference, groups: [] };
    const parseRepresentationFrameRate = /* @__PURE__ */ __name((value) => {
      if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
      if (typeof value !== "string" || value.length > 64) return null;
      const parts = value.trim().match(/^(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?$/);
      if (!parts) return null;
      const n = Number(parts[1]) / (parts[2] === void 0 ? 1 : Number(parts[2]));
      return Number.isFinite(n) && n > 0 ? n : null;
    }, "parseRepresentationFrameRate");
    const getRepresentationCodecConfig = /* @__PURE__ */ __name((item) => {
      try {
        if (!item || typeof item !== "object") return null;
        const codec = getDashCodecString(item);
        const mime = String(item.mime_type || item.mimeType || "").split(";")[0].trim().toLowerCase();
        if (!codec || codec.length > 256 || !/^[a-z0-9._-]+$/i.test(codec) || mime.length > 128 || !/^video\/[a-z0-9.+-]+$/.test(mime)) return null;
        const width = Number(item.width), height = Number(item.height), bitrate = Number(item.bandwidth);
        const framerate = parseRepresentationFrameRate(item.frame_rate ?? item.frameRate ?? item.framerate);
        if (![width, height, bitrate].every((n) => Number.isSafeInteger(n) && n > 0) || width > 4294967295 || height > 4294967295 || !framerate) return null;
        return { type: "media-source", video: { contentType: mime + '; codecs="' + codec + '"', width, height, bitrate, framerate } };
      } catch {
        return null;
      }
    }, "getRepresentationCodecConfig");
    const codecConfigurationKey = /* @__PURE__ */ __name((item) => {
      const config = getRepresentationCodecConfig(item);
      return config ? JSON.stringify(config) : "";
    }, "codecConfigurationKey");
    const summarizeCodecCapability = /* @__PURE__ */ __name((value) => {
      if (!value || typeof value !== "object") return "unknown";
      if (value.supported === false || value.smooth === false || value.powerEfficient === false) return "bad";
      return value.supported === true && value.smooth === true && value.powerEfficient === true ? "good" : "unknown";
    }, "summarizeCodecCapability");
    const getRepresentationCapability = /* @__PURE__ */ __name((item) => {
      const kind = normalizeCodecName(item);
      if (kind !== "av1" && kind !== "hevc") return { capability: "not-applicable", reason: "not-applicable" };
      const key = codecConfigurationKey(item);
      if (!key) return { capability: "unknown", reason: "missing-or-invalid-metadata" };
      const entry = codecCapability.get(key);
      return entry && entry.state === "complete" ? { capability: summarizeCodecCapability(entry.value), reason: entry.reason } : { capability: "unknown", reason: entry?.state || (deps.disabled ? "disabled" : "not-requested") };
    }, "getRepresentationCapability");
    const invalidateCodecQueries = /* @__PURE__ */ __name(() => {
      codecQueryQueue.forEach((entry) => {
        if (codecCapability.get(entry.key) === entry) codecCapability.delete(entry.key);
      });
      codecQueryQueue = [];
      activeCodecConfigurations = [];
      lastCodecDecision = { preference: resolvedVideoCodecPreference, groups: [] };
    }, "invalidateCodecQueries");
    const pumpCodecQueries = /* @__PURE__ */ __name(() => {
      while (!deps.disabled && codecQueriesInFlight < 2 && codecQueryQueue.length) {
        const entry = codecQueryQueue.shift();
        if (codecCapability.get(entry.key) !== entry || !deps.isRuntimeGenerationActive(entry.runtime)) continue;
        entry.state = "pending";
        codecQueriesInFlight++;
        const finish = /* @__PURE__ */ __name((value, reason) => {
          codecQueriesInFlight--;
          if (codecCapability.get(entry.key) === entry) {
            if (deps.isRuntimeGenerationActive(entry.runtime)) {
              entry.state = "complete";
              entry.value = value ? {
                supported: typeof value.supported === "boolean" ? value.supported : null,
                smooth: typeof value.smooth === "boolean" ? value.smooth : null,
                powerEfficient: typeof value.powerEfficient === "boolean" ? value.powerEfficient : null
              } : null;
              entry.reason = reason;
            } else codecCapability.delete(entry.key);
          }
          const retry = activeCodecConfigurations.find((row) => row.key === entry.key);
          if (retry && !deps.isRuntimeGenerationActive(entry.runtime)) enqueueCodecQuery(retry, false);
          pumpCodecQueries();
        }, "finish");
        Promise.resolve().then(() => deps.isRuntimeGenerationActive(entry.runtime) ? navigator.mediaCapabilities.decodingInfo(entry.config) : null).then((value) => {
          let safe = null, reason = "query-failed";
          try {
            if (value && typeof value === "object") {
              safe = { supported: value.supported, smooth: value.smooth, powerEfficient: value.powerEfficient };
              reason = summarizeCodecCapability(safe) === "unknown" ? "incomplete-result" : "completed";
            }
          } catch {
          }
          finish(safe, reason);
        }, () => finish(null, "query-failed"));
      }
    }, "pumpCodecQueries");
    const clearCodecPlayinfo = /* @__PURE__ */ __name(() => {
      invalidateCodecQueries();
      codecResumeItems = [];
    }, "clearCodecPlayinfo");
    const enqueueCodecQuery = /* @__PURE__ */ __name((row, pump = true) => {
      if (deps.disabled || !row.key || row.kind !== "av1" && row.kind !== "hevc" || codecCapability.has(row.key)) return;
      if (codecCapability.size >= CODEC_CAPABILITY_MAX) {
        const activeKeys = new Set(activeCodecConfigurations.map((row2) => row2.key));
        const removable = [...codecCapability].find(([key, entry2]) => entry2.state === "complete" && !activeKeys.has(key));
        if (!removable) return;
        codecCapability.delete(removable[0]);
      }
      let available = false;
      try {
        available = typeof navigator.mediaCapabilities?.decodingInfo === "function";
      } catch {
      }
      const entry = {
        key: row.key,
        config: row.config,
        runtime: deps.captureRuntimeGeneration(),
        state: available ? "queued" : "complete",
        reason: available ? "queued" : "api-unavailable",
        value: null
      };
      codecCapability.set(row.key, entry);
      if (available) codecQueryQueue.push(entry);
      if (pump) pumpCodecQueries();
    }, "enqueueCodecQuery");
    const prepareCodecConfigurations = /* @__PURE__ */ __name((videoItems) => {
      activeCodecConfigurations = videoItems.slice(0, CODEC_CAPABILITY_MAX).map((item) => {
        const config = getRepresentationCodecConfig(item);
        const snapshot = {
          codecs: getDashCodecString(item).slice(0, 256),
          mime_type: String(item?.mime_type || item?.mimeType || "").slice(0, 128),
          width: Number(item?.width),
          height: Number(item?.height),
          bandwidth: Number(item?.bandwidth),
          frame_rate: config ? config.video.framerate : null,
          codecid: Number(item?.codecid || item?.codec_id || item?.codecId)
        };
        return { item: Object.freeze(snapshot), kind: normalizeCodecName(item), key: config ? JSON.stringify(config) : "", config };
      });
      codecResumeItems = activeCodecConfigurations.map((row) => row.item);
      const keys = new Set(activeCodecConfigurations.map((row) => row.key));
      codecQueryQueue = codecQueryQueue.filter((entry) => {
        if (keys.has(entry.key) && deps.isRuntimeGenerationActive(entry.runtime)) return true;
        if (codecCapability.get(entry.key) === entry) codecCapability.delete(entry.key);
        return false;
      });
      activeCodecConfigurations.forEach((row) => enqueueCodecQuery(row, false));
      pumpCodecQueries();
    }, "prepareCodecConfigurations");
    const getCurrentCodecDiagnostics = /* @__PURE__ */ __name(() => activeCodecConfigurations.slice(0, 8).map((row) => ({
      codec: row.kind,
      height: row.config?.video.height || 0,
      width: row.config?.video.width || 0,
      frameRate: row.config?.video.framerate || null,
      ...getRepresentationCapability(row.item)
    })), "getCurrentCodecDiagnostics");
    const getCodecCapabilityState = /* @__PURE__ */ __name((kind, height) => {
      if (kind !== "hevc" && kind !== "av1") return "not-applicable";
      const states = activeCodecConfigurations.filter((row) => row.kind === kind && ((Number(row.item.height) || 0) >= 2160 ? 2160 : 1080) === (height >= 2160 ? 2160 : 1080)).map((row) => getRepresentationCapability(row.item).capability);
      return states.length && states.every((state) => state === states[0]) ? states[0] : "unknown";
    }, "getCodecCapabilityState");
    const canPlayDashVideoItem = /* @__PURE__ */ (() => {
      const cache = {};
      let testVideo = null;
      const canPlayCodecString = /* @__PURE__ */ __name((codec) => {
        if (!codec) return null;
        const key = codec.toLowerCase();
        if (key in cache) return cache[key];
        const mime = 'video/mp4; codecs="' + codec + '"';
        let ok = false;
        try {
          const MS = unsafeWindow.MediaSource || (typeof MediaSource !== "undefined" ? MediaSource : null);
          ok = !!(MS && MS.isTypeSupported && MS.isTypeSupported(mime));
        } catch {
        }
        if (!ok) {
          try {
            if (!testVideo) testVideo = document.createElement("video");
            ok = !!(testVideo.canPlayType && testVideo.canPlayType(mime));
          } catch {
          }
        }
        cache[key] = ok;
        return ok;
      }, "canPlayCodecString");
      return (item) => {
        const kind = normalizeCodecName(item);
        const codec = getDashCodecString(item);
        const explicit = canPlayCodecString(codec);
        if (explicit !== null) return explicit;
        if (kind === "av1") return false;
        return true;
      };
    })();
    const normalizeDashCodecPreference = /* @__PURE__ */ __name((dash) => {
      if (!dash || !Array.isArray(dash.video)) return;
      prepareCodecConfigurations(dash.video);
      if (resolvedVideoCodecPreference === "auto") {
        lastCodecDecision = { preference: "auto", groups: [] };
        return;
      }
      const codecRank = /* @__PURE__ */ __name((item) => {
        const kind = normalizeCodecName(item);
        if (resolvedVideoCodecPreference === "avc") {
          if (kind === "avc") return 0;
          if (kind === "hevc") return 1;
          if (kind === "av1") return 2;
          return 3;
        }
        const capability = getRepresentationCapability(item).capability;
        const suitable = capability !== "bad";
        if (resolvedVideoCodecPreference === "av1") {
          if (kind === "av1") return suitable ? 0 : 3;
          if (kind === "hevc") return suitable ? 1 : 4;
          if (kind === "avc") return 2;
          return 5;
        }
        if (kind === "hevc") return suitable ? 0 : 2;
        if (kind === "avc") return 1;
        if (kind === "av1") return suitable ? 1.5 : 3;
        return 4;
      }, "codecRank");
      const groups = [];
      const byQuality = /* @__PURE__ */ new Map();
      dash.video.forEach((item, originalIndex) => {
        const quality = String(item && (item.id || item.quality || item.qn || originalIndex));
        if (!byQuality.has(quality)) {
          const group = { quality, items: [] };
          byQuality.set(quality, group);
          groups.push(group);
        }
        byQuality.get(quality).items.push({ item, originalIndex });
      });
      const normalized = [];
      const decisions = [];
      groups.forEach((group) => {
        let entries = group.items;
        const supported = entries.filter((entry) => canPlayDashVideoItem(entry.item));
        if (supported.length) entries = supported;
        entries.sort((a, b) => {
          const rankDiff = codecRank(a.item) - codecRank(b.item);
          return rankDiff || a.originalIndex - b.originalIndex;
        });
        entries.forEach((entry) => normalized.push(entry.item));
        const selected = entries[0] && entries[0].item;
        if (decisions.length < 8 && selected) {
          const height = (selected && selected.height || 0) >= 2160 ? 2160 : 1080;
          const kind = normalizeCodecName(selected);
          decisions.push({
            quality: String(group.quality).slice(0, 16),
            selected: kind,
            capability: getRepresentationCapability(selected).capability
          });
        }
      });
      if (normalized.length) dash.video = normalized;
      lastCodecDecision = { preference: resolvedVideoCodecPreference, groups: decisions };
    }, "normalizeDashCodecPreference");
    return {
      get normalizeCodecName() {
        return normalizeCodecName;
      },
      get resolvedVideoCodecPreference() {
        return resolvedVideoCodecPreference;
      },
      get codecResumeItems() {
        return codecResumeItems;
      },
      set codecResumeItems(value) {
        codecResumeItems = value;
      },
      get lastCodecDecision() {
        return lastCodecDecision;
      },
      set lastCodecDecision(value) {
        lastCodecDecision = value;
      },
      get invalidateCodecQueries() {
        return invalidateCodecQueries;
      },
      get clearCodecPlayinfo() {
        return clearCodecPlayinfo;
      },
      get prepareCodecConfigurations() {
        return prepareCodecConfigurations;
      },
      get getCurrentCodecDiagnostics() {
        return getCurrentCodecDiagnostics;
      },
      get getCodecCapabilityState() {
        return getCodecCapabilityState;
      },
      get normalizeDashCodecPreference() {
        return normalizeDashCodecPreference;
      }
    };
  }
  __name(createCodec, "createCodec");

  // src/playback/playurl.mjs
  function createPlayurl(deps) {
    const playInfoTransformer = /* @__PURE__ */ __name((playInfo, options = null) => {
      if (!playInfo) return;
      if (playInfo.code !== void 0 && playInfo.code !== 0) {
        return;
      }
      deps.clearCodecPlayinfo();
      deps.resetRepresentationRegistry();
      deps.streamEstimate = { source: "unknown", codec: "other", height: 0, videoMbps: 0, audioMbps: 0 };
      deps.streamProfile = null;
      deps.currentStreamBitsPerSec = 0;
      deps.baseBufferTargetBytes = deps.DEFAULT_BUFFER_TARGET_BYTES;
      const nativeTransportSource = options?.trustedTransport === true;
      let startupVideoSampleScheduled = false;
      const transformList = /* @__PURE__ */ __name((list, isDash, kind = "muxed") => {
        if (!Array.isArray(list)) return;
        list.forEach((item) => {
          if (!isDash) deps.registerMediaRepresentation(
            deps.muxedRepresentationRegistry,
            { urls: deps.pickStreamUrls(item, false).validUrls },
            "muxed",
            deps.AUDIO_REGISTRY_MAX
          );
          const routeGroup = nativeTransportSource ? deps.registerSignedRouteGroup(item, isDash, kind) : null;
          deps.transformStreamItem(item, isDash);
          if (routeGroup) deps.applySignedRoutePlan(item, isDash, routeGroup);
          if (nativeTransportSource && kind === "video" && !startupVideoSampleScheduled) {
            const sample = item.base_url || item.baseUrl;
            if (sample && deps.isBiliVideoUrl(sample) && !deps.isAkamaiUrl(sample)) {
              startupVideoSampleScheduled = true;
              deps.scheduleBakeoff(sample);
            }
          }
        });
      }, "transformList");
      let video_info;
      if (playInfo.result) {
        video_info = playInfo.result.dash === void 0 ? playInfo.result.video_info : playInfo.result;
        if (!video_info || !video_info.dash) {
          if (playInfo.result.durl || playInfo.result.durls) video_info = playInfo.result;
          if (video_info && video_info.durl) transformList(video_info.durl, false);
          if (video_info && video_info.durls) video_info.durls.forEach((d) => transformList(d.durl, false));
          deps.sanitizePlayInfoUrls(video_info || playInfo.result);
          return;
        }
      } else {
        video_info = playInfo.data;
      }
      try {
        const dash = video_info && video_info.dash;
        if (dash) {
          deps.normalizeDashCodecPreference(dash);
          try {
            const vids = dash.video || [];
            const auds = dash.audio || [];
            const maxV = vids.reduce((m, v) => Math.max(m, v.bandwidth || 0), 0);
            const maxA = auds.reduce((m, a) => Math.max(m, a.bandwidth || 0), 0);
            const is4K = vids.some((v) => (v.height || 0) >= 2160 || (v.bandwidth || 0) > 12e6);
            const minBuf = is4K ? 1 : 3;
            deps.streamProfile = {
              reps: vids.map((v) => ({
                height: v.height || 0,
                bandwidth: v.bandwidth || 0,
                codec: deps.normalizeCodecName(v),
                // 登記改寫前的 base/backup；identity 只取 pathname+search，換 host 後仍能命中。
                urls: deps.pickStreamUrls(v, true).validUrls
              })).filter((r) => r.bandwidth > 0 && r.height > 0),
              audioBps: maxA,
              audioReps: [...auds, ...[].concat(dash.flac?.audio || []), ...[].concat(dash.dolby?.audio || [])].filter((a) => a && typeof a === "object").map((a) => ({ bandwidth: a.bandwidth || 0, urls: deps.pickStreamUrls(a, true).validUrls }))
            };
            deps.rebuildRepresentationRegistry();
            deps.setBufferTargetFromBitrate(maxV + maxA, is4K || maxV + maxA > 12e6);
            dash.minBufferTime = minBuf;
            dash.min_buffer_time = minBuf;
          } catch {
          }
          const extras = [];
          if (dash.flac && dash.flac.audio) [].concat(dash.flac.audio).forEach((i) => extras.push(i));
          if (dash.dolby && dash.dolby.audio) [].concat(dash.dolby.audio).forEach((i) => extras.push(i));
          transformList(dash.video, true, "video");
          transformList(dash.audio, true, "audio");
          transformList(extras, true, "audio");
          deps.sanitizePlayInfoUrls(dash);
        } else if (video_info && (video_info.durl || video_info.durls)) {
          transformList(video_info.durl, false);
          (video_info.durls || []).forEach((d) => transformList(d.durl, false));
          deps.sanitizePlayInfoUrls(video_info);
        }
      } catch (e) {
        if (video_info && video_info.durl) transformList(video_info.durl, false);
        else deps.err("playInfoTransformer 例外：", e);
      }
    }, "playInfoTransformer");
    const isBiliFragmentUrl = /* @__PURE__ */ __name((url) => {
      if (!url || !deps.isBiliVideoUrl(url)) return false;
      try {
        const parsed = deps.parseMediaHttpUrl(url);
        if (!parsed) return false;
        const path = parsed.pathname;
        return deps.mediaUrlPolicy.mediaPathPattern.test(path) || path.includes("/upgcxcode/") || path.startsWith("/v1/resource");
      } catch {
        return /bilivideo\.com|bilivideo\.cn/.test(url) && (url.includes(".m4s") || url.includes(".flv") || url.includes("/upgcxcode/"));
      }
    }, "isBiliFragmentUrl");
    return {
      get playInfoTransformer() {
        return playInfoTransformer;
      },
      get isBiliFragmentUrl() {
        return isBiliFragmentUrl;
      }
    };
  }
  __name(createPlayurl, "createPlayurl");

  // src/transport/interceptors.mjs
  function createTransport(deps) {
    const interceptNetResponse = (function(theWindow) {
      const interceptors = [];
      const interceptNetResponse2 = /* @__PURE__ */ __name((handler) => interceptors.push(handler), "interceptNetResponse");
      const handleInterceptedResponse = /* @__PURE__ */ __name((response, url, valid = () => !deps.disabled) => interceptors.reduce((m, h) => {
        let r;
        if (!valid()) return m;
        try {
          r = h(m, url, valid);
        } catch {
          deps.DiagnosticLog.fault("interceptor");
          return m;
        }
        return r !== void 0 ? r : m;
      }, response), "handleInterceptedResponse");
      const playurlRequests = /* @__PURE__ */ new WeakMap();
      const mediaRequests = /* @__PURE__ */ new WeakMap();
      const diagnosticRequests = /* @__PURE__ */ new WeakMap();
      const mediaListenerCleanup = /* @__PURE__ */ new WeakMap();
      const mediaSendInFlight = /* @__PURE__ */ new WeakSet();
      const transformPlayurlOnce = /* @__PURE__ */ __name((xhr, kind, raw) => {
        const context = playurlRequests.get(xhr);
        const valid = /* @__PURE__ */ __name(() => !!context && playurlRequests.get(xhr) === context && deps.isRuntimeGenerationActive(context.runtime), "valid");
        if (!valid()) return raw;
        const cached = context.cache;
        if (cached && cached.raw === raw) return cached.out;
        let input = raw;
        if (raw && typeof raw === "object") {
          try {
            input = JSON.parse(JSON.stringify(raw));
          } catch {
            deps.DiagnosticLog.fault("transform");
            return raw;
          }
        }
        if (!valid()) return raw;
        const out = handleInterceptedResponse(input, context.url, valid);
        if (!valid()) return raw;
        context.cache = { raw, out };
        return out;
      }, "transformPlayurlOnce");
      const OriginalXMLHttpRequest = theWindow.XMLHttpRequest;
      const _XMLHttpRequest = class _XMLHttpRequest extends OriginalXMLHttpRequest {
        open(method, url, ...rest) {
          mediaListenerCleanup.get(this)?.();
          deps.DiagnosticLog.updateRequest(diagnosticRequests.get(this), "reopened");
          diagnosticRequests.delete(this);
          const urlStr = String(url);
          playurlRequests.set(this, { runtime: deps.captureRuntimeGeneration(), url: urlStr, cache: null });
          mediaRequests.set(this, deps.captureMediaRequest(urlStr));
          if (this._blockedTimer) {
            clearTimeout(this._blockedTimer);
            this._blockedTimer = null;
          }
          this._biliRequestSeq = (this._biliRequestSeq || 0) + 1;
          this._blockAbort = false;
          this._blockedDone = false;
          this._blockedBody = "";
          this._originCdn = null;
          this._redirectedCdn = null;
          this._originalUrl = urlStr;
          this._hostRewriteAttempt = false;
          this._restoredOriginal = false;
          this._interceptUrl = urlStr;
          this._biliPlayurlCache_text = null;
          this._biliPlayurlCache_response = null;
          this._biliJsonMetadata = deps.isBiliJsonMetadataApi(urlStr);
          if (deps.disabled) {
            this._interceptUrl = urlStr;
            return super.open(method, url, ...rest);
          }
          if (deps.isHttpDnsUrl(urlStr) && deps.shouldBlockHttpDns()) {
            this._blockAbort = true;
            this._interceptUrl = urlStr;
            deps.redirectStats.httpdns++;
            return super.open(method, urlStr, ...rest);
          }
          if (deps.isHttpDnsUrl(urlStr)) {
            deps.redirectStats.httpdnsAllowed++;
          }
          if (!deps.disabled && deps.isMediaSegmentUrl(urlStr)) {
            const mappedOriginalUrl = deps.getOriginalStreamUrl(urlStr);
            this._originalUrl = mappedOriginalUrl;
            this._hostRewriteAttempt = mappedOriginalUrl !== urlStr;
            const nativeRoute = deps.resolveRequestRoute(urlStr, mediaRequests.get(this));
            const norm = nativeRoute ? {
              url: nativeRoute.url,
              changed: nativeRoute.url !== urlStr,
              originCdn: nativeRoute.host,
              targetCdn: nativeRoute.host,
              nativeRoute: true
            } : deps.normalizeMediaUrl(urlStr);
            this._originCdn = norm.originCdn || deps.getBiliVideoCdn(urlStr);
            if (norm.changed) {
              this._redirectedCdn = norm.targetCdn;
              this._restoredOriginal = !!norm.restoredOriginal;
              this._hostRewriteAttempt = !norm.restoredOriginal && !norm.nativeRoute;
              url = norm.url;
            }
          }
          this._interceptUrl = String(url);
          return super.open(method, url, ...rest);
        }
        _deliverBlockedHttpDns() {
          const body = '{"code":-1,"message":"blocked by BiliCDN","data":null}';
          const requestSeq = this._biliRequestSeq;
          this._blockedBody = body;
          this._blockedTimer = setTimeout(() => {
            this._blockedTimer = null;
            if (this._biliRequestSeq !== requestSeq || !this._blockAbort) return;
            this._blockedDone = true;
            try {
              this.dispatchEvent(new Event("readystatechange"));
              const detail = { lengthComputable: true, loaded: body.length, total: body.length };
              this.dispatchEvent(new ProgressEvent("load", detail));
              this.dispatchEvent(new ProgressEvent("loadend", detail));
            } catch (e) {
              deps.err("HTTPDNS 阻擋回應派送失敗：", e);
            }
          }, 0);
        }
        abort() {
          mediaListenerCleanup.get(this)?.();
          deps.DiagnosticLog.updateRequest(diagnosticRequests.get(this), "abort");
          diagnosticRequests.delete(this);
          playurlRequests.delete(this);
          mediaRequests.delete(this);
          if (this._blockedTimer) {
            clearTimeout(this._blockedTimer);
            this._blockedTimer = null;
          }
          this._blockAbort = false;
          this._blockedDone = false;
          this._blockedBody = "";
          this._biliRequestSeq = (this._biliRequestSeq || 0) + 1;
          return super.abort();
        }
        get readyState() {
          return this._blockedDone ? 4 : super.readyState;
        }
        get status() {
          return this._blockedDone ? 503 : super.status;
        }
        get statusText() {
          return this._blockedDone ? "Service Unavailable" : super.statusText;
        }
        get responseURL() {
          return this._blockedDone ? this._interceptUrl || "" : super.responseURL;
        }
        getResponseHeader(name) {
          if (!this._blockedDone) return super.getResponseHeader(name);
          return String(name).toLowerCase() === "content-type" ? "application/json" : null;
        }
        getAllResponseHeaders() {
          return this._blockedDone ? "content-type: application/json\r\n" : super.getAllResponseHeaders();
        }
        send(...args) {
          if (this._biliJsonMetadata && !deps.disabled) {
            try {
              this.setRequestHeader("Accept", "application/json, text/plain, */*");
            } catch {
            }
          }
          if (this._blockAbort) {
            this._deliverBlockedHttpDns();
            return;
          }
          if (this._originCdn) {
            if (mediaSendInFlight.has(this)) return super.send(...args);
            const cdn = this._redirectedCdn || this._originCdn;
            const self = this;
            const requestSeq = this._biliRequestSeq;
            const mediaContext = mediaRequests.get(this);
            const requestRuntimeToken = mediaContext?.runtime || deps.captureRuntimeGeneration();
            const diagnosticId = deps.DiagnosticLog.request("xhr", mediaContext, this._originalUrl || this._interceptUrl, this._interceptUrl);
            diagnosticRequests.set(this, diagnosticId);
            const segStartedAt = Date.now();
            const segStartedMonotonic = performance.now();
            let firstByteAt = 0;
            let progressEvents = 0;
            let settled = false;
            let lastProgressLoaded = 0;
            const listeners = [];
            const cleanup = /* @__PURE__ */ __name(() => {
              settled = true;
              mediaSendInFlight.delete(self);
              listeners.forEach(([type, listener]) => self.removeEventListener(type, listener));
              if (mediaListenerCleanup.get(self) === cleanup) mediaListenerCleanup.delete(self);
            }, "cleanup");
            mediaListenerCleanup.set(self, cleanup);
            const active = /* @__PURE__ */ __name(() => !settled && self._biliRequestSeq === requestSeq && deps.mediaContextActive(mediaContext), "active");
            const listen = /* @__PURE__ */ __name((type, callback) => {
              const listener = /* @__PURE__ */ __name((e) => {
                if (e?.isTrusted !== true) return;
                if (!active()) {
                  cleanup();
                  return;
                }
                try {
                  callback(e);
                } catch {
                  deps.DiagnosticLog.fault("interceptor");
                }
              }, "listener");
              listeners.push([type, listener]);
              self.addEventListener(type, listener);
            }, "listen");
            listen("abort", () => {
              cleanup();
              deps.DiagnosticLog.updateRequest(diagnosticId, "abort");
            });
            const fail = /* @__PURE__ */ __name((kind) => {
              cleanup();
              deps.DiagnosticLog.updateRequest(diagnosticId, "network-error", { reason: kind, bytes: lastProgressLoaded });
              deps.noteNativeRouteFailure(mediaContext, self._interceptUrl, 0, kind);
              deps.handleVerifiedSegmentFailure({
                cdn,
                url: self._interceptUrl,
                kind,
                bytesReceived: lastProgressLoaded,
                requestElapsedMs: Math.max(0, performance.now() - segStartedMonotonic),
                timeoutEvidence: kind === "timeout" ? deps.TRUSTED_XHR_TIMEOUT_EVIDENCE : null,
                hostRewriteAttempt: self._hostRewriteAttempt,
                originalUrl: self._originalUrl
              });
            }, "fail");
            listen("error", () => fail("network-error"));
            listen("timeout", () => fail("timeout"));
            listen("progress", (e) => {
              if (!firstByteAt) firstByteAt = Date.now();
              progressEvents++;
              const loaded = e && e.loaded || 0;
              deps.DiagnosticLog.updateRequest(diagnosticId, "body", { bytes: loaded });
              const delta = loaded - lastProgressLoaded;
              if (delta > 0) {
                lastProgressLoaded = loaded;
                deps.observeMediaTransfer(mediaContext, self.responseURL || self._interceptUrl, delta, "xhr");
                deps.Watchdog.noteExternalBytes(cdn, delta);
                deps.noteSegmentAccounted(self._interceptUrl);
                if (self.responseURL && self.responseURL !== self._interceptUrl) {
                  deps.noteSegmentAccounted(self.responseURL);
                }
              }
            });
            listen("readystatechange", () => {
              if (self.readyState === 2) deps.DiagnosticLog.updateRequest(diagnosticId, "headers", { status: self.status, finalHost: self.responseURL || self._interceptUrl });
              if (self.readyState !== _XMLHttpRequest.DONE) return;
              if (self.status <= 0) return;
              cleanup();
              deps.DiagnosticLog.updateRequest(diagnosticId, self.status >= 400 ? "http" : "eof", {
                status: self.status,
                finalHost: self.responseURL || self._interceptUrl,
                bytes: lastProgressLoaded
              });
              if (deps.HARD_FAIL_STATUSES.has(self.status)) {
                deps.noteNativeRouteFailure(mediaContext, self._interceptUrl, self.status, "http");
                deps.handleVerifiedSegmentFailure({
                  cdn,
                  url: self._interceptUrl,
                  status: self.status,
                  hostRewriteAttempt: self._hostRewriteAttempt,
                  originalUrl: self._originalUrl
                });
              } else if (self.status >= 500) {
                deps.noteNativeRouteFailure(mediaContext, self._interceptUrl, self.status, "http");
                deps.handleVerifiedSegmentFailure({
                  cdn,
                  url: self._interceptUrl,
                  status: self.status,
                  hostRewriteAttempt: self._hostRewriteAttempt,
                  originalUrl: self._originalUrl
                });
              } else if (self.status >= 200 && self.status < 400) {
                deps.recordCdnSuccess(cdn, segStartedAt);
                const durationBase = progressEvents >= 2 ? firstByteAt || segStartedAt : segStartedAt;
                deps.noteSegmentBytes(cdn, self, durationBase, self._interceptUrl, lastProgressLoaded, requestRuntimeToken, mediaContext);
              }
            });
            mediaSendInFlight.add(this);
          }
          try {
            return super.send(...args);
          } catch (error) {
            mediaListenerCleanup.get(this)?.();
            deps.DiagnosticLog.updateRequest(diagnosticRequests.get(this), "network-error");
            throw error;
          }
        }
        get responseText() {
          if (this._blockedDone) return this._blockedBody;
          if (this.readyState !== this.DONE) return super.responseText;
          if (deps.disabled) return super.responseText;
          if (!deps.isPlayUrlApi(this._interceptUrl || this.responseURL)) return super.responseText;
          return transformPlayurlOnce(this, "text", super.responseText);
        }
        get response() {
          if (this._blockedDone) {
            if (this.responseType === "json") {
              try {
                return JSON.parse(this._blockedBody);
              } catch {
                return null;
              }
            }
            return this.responseType === "" || this.responseType === "text" ? this._blockedBody : null;
          }
          if (this.readyState !== this.DONE) return super.response;
          if (deps.disabled) return super.response;
          if (!deps.isPlayUrlApi(this._interceptUrl || this.responseURL)) return super.response;
          return transformPlayurlOnce(this, "response", super.response);
        }
      };
      __name(_XMLHttpRequest, "XMLHttpRequest");
      let XMLHttpRequest = _XMLHttpRequest;
      theWindow.XMLHttpRequest = XMLHttpRequest;
      const OriginalFetch = theWindow.fetch;
      const cloneResponseWithBody = /* @__PURE__ */ __name((source, body, preserveEntityHeaders = true) => {
        const headers = new Headers(source.headers);
        if (!preserveEntityHeaders) {
          ;
          ["content-length", "content-encoding", "content-range", "etag", "content-md5"].forEach((name) => {
            try {
              headers.delete(name);
            } catch {
            }
          });
        }
        const out = new Response(body, {
          status: source.status,
          statusText: source.statusText,
          headers
        });
        ["url", "redirected", "type"].forEach((key) => {
          try {
            Object.defineProperty(out, key, { value: source[key], configurable: true });
          } catch {
          }
        });
        return out;
      }, "cloneResponseWithBody");
      const wrapMeasuredFetchResponse = /* @__PURE__ */ __name((res, cdn, effectiveUrl, fetchStartedAt, failureContext, requestRuntimeToken, mediaContext, diagnosticId) => {
        if (!res.body || typeof res.body.getReader !== "function" || typeof ReadableStream === "undefined") {
          deps.DiagnosticLog.updateRequest(diagnosticId, "no-body");
          if (deps.isRuntimeGenerationActive(requestRuntimeToken)) {
            deps.recordCdnSuccess(cdn, fetchStartedAt);
          }
          return res;
        }
        const reader = res.body.getReader();
        let counted = 0;
        let firstChunkAt = 0;
        let chunkCount = 0;
        let cancelled = false;
        let settled = false;
        const finishSuccess = /* @__PURE__ */ __name(() => {
          if (settled || cancelled) return;
          settled = true;
          deps.DiagnosticLog.updateRequest(diagnosticId, "eof", { bytes: counted });
          if (!deps.isRuntimeGenerationActive(requestRuntimeToken)) return;
          if (counted) {
            const durationBase = chunkCount >= 2 ? firstChunkAt || fetchStartedAt : fetchStartedAt;
            const durationMs = Math.max(1, Date.now() - durationBase);
            deps.recordCdnThroughput(cdn, counted, durationMs, deps.playbackRateState.effectiveRate);
            deps.recordNativeThroughput(
              mediaContext,
              res.url || effectiveUrl,
              counted,
              durationMs,
              deps.playbackRateState.effectiveRate,
              "transport"
            );
          }
          deps.recordCdnSuccess(cdn, fetchStartedAt);
        }, "finishSuccess");
        const finishError = /* @__PURE__ */ __name((error) => {
          if (settled || cancelled) return;
          settled = true;
          deps.DiagnosticLog.updateRequest(diagnosticId, error && error.name === "AbortError" ? "abort" : "body-error", { bytes: counted });
          if (!deps.isRuntimeGenerationActive(requestRuntimeToken)) return;
          if (error && error.name === "AbortError") return;
          deps.noteNativeRouteFailure(mediaContext, effectiveUrl, 0, "body-error");
          deps.handleVerifiedSegmentFailure({
            ...failureContext || {},
            cdn,
            url: effectiveUrl,
            kind: "body-error",
            bytesReceived: counted
          });
        }, "finishError");
        const body = new ReadableStream({
          async pull(controller) {
            try {
              const { done, value } = await reader.read();
              if (done) {
                finishSuccess();
                controller.close();
                return;
              }
              if (value && value.byteLength) {
                if (!firstChunkAt) firstChunkAt = Date.now();
                chunkCount++;
                counted += value.byteLength;
                deps.DiagnosticLog.updateRequest(diagnosticId, "body", { bytes: counted });
                try {
                  if (deps.isRuntimeGenerationActive(requestRuntimeToken)) {
                    deps.observeMediaTransfer(mediaContext, res.url || effectiveUrl, value.byteLength, "fetch");
                  }
                  if (!deps.isRuntimeGenerationActive(requestRuntimeToken)) throw new Error("stale runtime");
                  deps.Watchdog.noteExternalBytes(cdn, value.byteLength);
                  deps.noteSegmentAccounted(effectiveUrl);
                  if (res.url && res.url !== effectiveUrl) deps.noteSegmentAccounted(res.url);
                } catch {
                }
              }
              if (value !== void 0) controller.enqueue(value);
            } catch (error) {
              finishError(error);
              controller.error(error);
            }
          },
          cancel(reason) {
            cancelled = true;
            settled = true;
            deps.DiagnosticLog.updateRequest(diagnosticId, "abort", { bytes: counted });
            try {
              return Promise.resolve(reader.cancel(reason)).catch(() => {
              });
            } catch {
              return Promise.resolve();
            }
          }
        });
        return cloneResponseWithBody(res, body);
      }, "wrapMeasuredFetchResponse");
      theWindow.fetch = (input, init) => {
        if (deps.disabled) return OriginalFetch(input, init);
        const urlStr = input instanceof Request ? input.url : String(input);
        if (deps.isHttpDnsUrl(urlStr) && deps.shouldBlockHttpDns()) {
          deps.redirectStats.httpdns++;
          try {
            return Promise.resolve(new Response(
              '{"code":-1,"message":"blocked by BiliCDN","data":null}',
              {
                status: 503,
                statusText: "Service Unavailable",
                headers: { "Content-Type": "application/json" }
              }
            ));
          } catch {
            return Promise.reject(new DOMException("BiliCDN blocked httpdns", "AbortError"));
          }
        }
        if (deps.isHttpDnsUrl(urlStr)) deps.redirectStats.httpdnsAllowed++;
        if (deps.isBiliJsonMetadataApi(urlStr)) {
          const headers = new Headers(
            init && init.headers ? init.headers : input instanceof Request ? input.headers : void 0
          );
          headers.set("Accept", "application/json, text/plain, */*");
          if (input instanceof Request) input = new Request(input, { headers });
          else init = Object.assign({}, init, { headers });
        }
        if (deps.isMediaSegmentUrl(urlStr)) {
          const requestRuntimeToken = deps.captureRuntimeGeneration();
          const mediaContext = deps.captureMediaRequest(urlStr, requestRuntimeToken);
          const mappedOriginalUrl = deps.getOriginalStreamUrl(urlStr);
          const nativeRoute = deps.resolveRequestRoute(urlStr, mediaContext);
          const norm = nativeRoute ? {
            url: nativeRoute.url,
            changed: nativeRoute.url !== urlStr,
            originCdn: nativeRoute.host,
            targetCdn: nativeRoute.host,
            nativeRoute: true
          } : deps.normalizeMediaUrl(urlStr);
          const hostRewriteAttempt = !norm.restoredOriginal && !norm.nativeRoute && (norm.changed || mappedOriginalUrl !== urlStr);
          const targetCdn = norm.targetCdn || norm.originCdn || deps.getBiliVideoCdn(urlStr);
          const effectiveUrl = norm.changed ? norm.url : urlStr;
          const fetchInput = input instanceof Request ? new Request(effectiveUrl, {
            method: input.method,
            headers: input.headers,
            body: input.method === "GET" || input.method === "HEAD" ? void 0 : input.body,
            mode: input.mode === "navigate" ? "same-origin" : input.mode,
            credentials: input.credentials,
            cache: input.cache,
            redirect: input.redirect,
            referrer: input.referrer,
            referrerPolicy: input.referrerPolicy,
            integrity: input.integrity,
            keepalive: input.keepalive,
            signal: input.signal
          }) : effectiveUrl;
          const fetchStartedAt = Date.now();
          const diagnosticId = deps.DiagnosticLog.request("fetch", mediaContext, mappedOriginalUrl, effectiveUrl);
          return OriginalFetch(fetchInput, init).then((res) => {
            deps.DiagnosticLog.updateRequest(diagnosticId, "headers", { status: res.status, finalHost: res.url || effectiveUrl });
            const failureContext = { hostRewriteAttempt, originalUrl: mappedOriginalUrl };
            if (res.ok) return wrapMeasuredFetchResponse(res, targetCdn, effectiveUrl, fetchStartedAt, failureContext, requestRuntimeToken, mediaContext, diagnosticId);
            deps.DiagnosticLog.updateRequest(diagnosticId, "http");
            if (deps.isRuntimeGenerationActive(requestRuntimeToken)) {
              deps.noteNativeRouteFailure(mediaContext, effectiveUrl, res.status, "http");
              deps.handleVerifiedSegmentFailure({
                ...failureContext,
                cdn: targetCdn,
                url: effectiveUrl,
                status: res.status
              });
            }
            return res;
          }).catch((error) => {
            deps.DiagnosticLog.updateRequest(diagnosticId, error && error.name === "AbortError" ? "abort" : "network-error");
            if (error && error.name === "AbortError") throw error;
            if (deps.isRuntimeGenerationActive(requestRuntimeToken)) {
              deps.noteNativeRouteFailure(mediaContext, effectiveUrl, 0, "network-error");
              deps.handleVerifiedSegmentFailure({
                cdn: targetCdn,
                url: effectiveUrl,
                kind: "network-error",
                hostRewriteAttempt,
                originalUrl: mappedOriginalUrl
              });
            }
            throw error;
          });
        }
        if (!deps.isPlayUrlApi(urlStr)) return OriginalFetch(input, init);
        const playurlRuntime = deps.captureRuntimeGeneration();
        const playurlSignal = init?.signal || (input instanceof Request ? input.signal : null);
        const valid = /* @__PURE__ */ __name(() => deps.isRuntimeGenerationActive(playurlRuntime) && !playurlSignal?.aborted, "valid");
        return OriginalFetch(input, init).then((response) => {
          if (!valid()) return response;
          return response.text().then((text) => {
            let out = text;
            try {
              const transformed = valid() ? handleInterceptedResponse(text, urlStr, valid) : text;
              if (typeof transformed === "string") out = transformed;
            } catch {
              deps.DiagnosticLog.fault("transform");
            }
            const nullBody = response.status === 204 || response.status === 205 || response.status === 304;
            try {
              return cloneResponseWithBody(response, nullBody ? null : out, out === text);
            } catch (e) {
              deps.DiagnosticLog.fault("playurl-clone");
              return new Response(nullBody ? null : text, { status: response.status || 200 });
            }
          }, (error) => {
            if (valid()) deps.DiagnosticLog.fault("playurl-body");
            throw error;
          });
        });
      };
      interceptNetResponse2.rawFetch = OriginalFetch.bind(theWindow);
      return interceptNetResponse2;
    })(unsafeWindow);
    return {
      get interceptNetResponse() {
        return interceptNetResponse;
      }
    };
  }
  __name(createTransport, "createTransport");

  // src/routing/failures.mjs
  function createFailures(deps) {
    const forcedRedirectHosts = /* @__PURE__ */ new Map();
    const FORCED_REDIRECT_TTL = 10 * 60 * 1e3;
    const FORCED_REDIRECT_MAX = Math.min(32, deps.TRUSTED_CDN_CATALOG.length);
    const sweepForcedRedirectHosts = /* @__PURE__ */ __name(() => {
      const now = Date.now();
      for (const [host, expireAt] of forcedRedirectHosts) {
        if (!deps.isValidCustomCdnHost(host) || !Number.isFinite(expireAt) || expireAt <= now) {
          forcedRedirectHosts.delete(host);
        }
      }
    }, "sweepForcedRedirectHosts");
    const addForcedRedirect = /* @__PURE__ */ __name((host, ttl) => {
      host = typeof host === "string" ? host.trim().toLowerCase() : "";
      if (!deps.isValidCustomCdnHost(host)) return false;
      sweepForcedRedirectHosts();
      if (!forcedRedirectHosts.has(host) && forcedRedirectHosts.size >= FORCED_REDIRECT_MAX) {
        let oldestHost = null, oldestExpiry = Infinity;
        for (const [candidate, expireAt] of forcedRedirectHosts) {
          if (expireAt < oldestExpiry) {
            oldestHost = candidate;
            oldestExpiry = expireAt;
          }
        }
        if (oldestHost) forcedRedirectHosts.delete(oldestHost);
      }
      const duration = Number.isFinite(+ttl) ? Math.max(1e3, Math.min(FORCED_REDIRECT_TTL, +ttl)) : FORCED_REDIRECT_TTL;
      forcedRedirectHosts.set(host, Date.now() + duration);
      return true;
    }, "addForcedRedirect");
    const isForcedRedirect = /* @__PURE__ */ __name((host) => {
      sweepForcedRedirectHosts();
      if (!deps.isValidCustomCdnHost(host)) return false;
      const t = forcedRedirectHosts.get(host);
      if (!t) return false;
      return true;
    }, "isForcedRedirect");
    const handleVerifiedSegmentFailure = /* @__PURE__ */ __name(({
      cdn,
      url,
      status = 0,
      kind = "http",
      bytesReceived = 0,
      requestElapsedMs = 0,
      timeoutEvidence = null,
      hostRewriteAttempt = false,
      originalUrl = ""
    } = {}) => {
      if (deps.disabled) return false;
      cdn = typeof cdn === "string" ? cdn.trim().toLowerCase() : "";
      if (!deps.isValidCustomCdnHost(cdn)) return false;
      if (typeof url !== "string" || url.length > 16 * 1024 || !deps.isMediaSegmentUrl(url)) return false;
      const numericStatus = Number.isFinite(+status) ? Math.trunc(+status) : 0;
      if (numericStatus === 403 && hostRewriteAttempt) {
        deps.DiagnosticLog.record("host-lock", { host: cdn, status: 403 }, true);
        deps.noteHostLockedStream(originalUrl || url);
        return true;
      }
      const isNetworkError = kind === "network-error" || kind === "body-error";
      const isTimeout = kind === "timeout";
      if (isTimeout && deps.inSeekGrace()) return false;
      if (isTimeout) {
        const bytes = Number.isFinite(+bytesReceived) ? Math.max(0, Math.trunc(+bytesReceived)) : 0;
        const elapsed = Number.isFinite(+requestElapsedMs) ? Math.max(0, +requestElapsedMs) : 0;
        let admission = "accepted";
        if (timeoutEvidence !== deps.TRUSTED_XHR_TIMEOUT_EVIDENCE || bytes < deps.MIN_THROUGHPUT_SAMPLE_BYTES || elapsed < deps.XHR_TIMEOUT_MIN_ELAPSED_MS) {
          admission = "insufficient";
        } else {
          const now = performance.now();
          for (const [host, acceptedAt] of deps.acceptedXhrTimeoutAt) {
            if (!deps.isValidCustomCdnHost(host) || !Number.isFinite(acceptedAt) || now < acceptedAt || now - acceptedAt >= deps.XHR_TIMEOUT_HOST_GAP_MS) {
              deps.acceptedXhrTimeoutAt.delete(host);
            }
          }
          if (deps.acceptedXhrTimeoutAt.has(cdn)) admission = "cooldown";
          else deps.acceptedXhrTimeoutAt.set(cdn, now);
        }
        if (admission !== "accepted") {
          deps.DiagnosticLog.record("recovery", {
            host: cdn,
            kind: "timeout",
            reason: admission,
            bytes,
            waitMs: elapsed,
            punished: false,
            reselected: false,
            preconnect: false
          }, true);
          return false;
        }
      }
      if (deps.HARD_FAIL_STATUSES.has(numericStatus)) {
        deps.recordCdnFailure(cdn, true, numericStatus);
      } else if (numericStatus >= 500) {
        deps.recordCdnFailure(cdn, false, numericStatus);
      } else if (isNetworkError || isTimeout) {
        deps.recordCdnFailure(cdn);
        if (!isTimeout) deps.handleSegmentConnError(cdn, Math.max(0, deps.publicFinite(bytesReceived)));
      } else {
        return false;
      }
      addForcedRedirect(cdn);
      deps.DiagnosticLog.record("recovery", {
        host: cdn,
        reason: isNetworkError || isTimeout ? kind : "http",
        status: numericStatus,
        punished: true,
        reselected: true,
        preconnect: true
      }, true);
      deps.promoteBestCdnNow();
      deps.preconnectBatch(deps.getHealthyCdnList().slice(0, 3), true);
      if (deps.lastSampleSegmentUrl && (deps.currentStreamBitsPerSec / 1e6 >= 12 || deps.playbackRateState.effectiveRate >= 1.75)) {
        deps.runThroughputBakeoff(deps.lastSampleSegmentUrl, false, deps.trustedBakeoffRequest("verified-failure")).catch(deps.reportMeasurementFailure());
      }
      return true;
    }, "handleVerifiedSegmentFailure");
    return {
      get forcedRedirectHosts() {
        return forcedRedirectHosts;
      },
      get addForcedRedirect() {
        return addForcedRedirect;
      },
      get isForcedRedirect() {
        return isForcedRedirect;
      },
      get handleVerifiedSegmentFailure() {
        return handleVerifiedSegmentFailure;
      }
    };
  }
  __name(createFailures, "createFailures");

  // src/ui/dom.mjs
  function createDom(deps) {
    const waitForElm = /* @__PURE__ */ __name((selector, timeoutMs) => new Promise((resolve, reject) => {
      const ele = document.querySelector(selector);
      if (ele) return resolve(ele);
      let timer = null;
      const observer = new MutationObserver(() => {
        const found = document.querySelector(selector);
        if (found) {
          observer.disconnect();
          if (timer) clearTimeout(timer);
          resolve(found);
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      if (timeoutMs) {
        timer = setTimeout(() => {
          observer.disconnect();
          reject(new Error("等待元素逾時：" + selector));
        }, timeoutMs);
      }
    }), "waitForElm");
    function fromHTML(html) {
      const template = document.createElement("template");
      template.innerHTML = html;
      const result = template.content.children;
      return result.length === 1 ? result[0] : result;
    }
    __name(fromHTML, "fromHTML");
    return {
      get waitForElm() {
        return waitForElm;
      },
      get fromHTML() {
        return fromHTML;
      }
    };
  }
  __name(createDom, "createDom");

  // src/routing/latency.mjs
  function createLatency(deps) {
    const PROBE_PATH = "/crossdomain.xml";
    const PROBE_CACHE_KEY = "probeCache_v1";
    const PROBE_CACHE_TTL = 2 * 60 * 60 * 1e3;
    const PROBE_TIMEOUT_MS = 8e3;
    const PROBE_SLOW_STRIKES = 2;
    const PROBE_TIMEOUT_STRIKES = 3;
    const CONFIRM_TIMEOUT_MS = 1e4;
    const confirmHostReachable = /* @__PURE__ */ __name((cdn, timeoutMs, runtimeToken = deps.captureRuntimeGeneration()) => new Promise((resolve) => {
      if (!deps.isRuntimeGenerationActive(runtimeToken)) return resolve(null);
      let settled = false;
      let to = null;
      let detachRuntimeAbort = /* @__PURE__ */ __name(() => {
      }, "detachRuntimeAbort");
      const done = /* @__PURE__ */ __name((v) => {
        if (settled) return;
        settled = true;
        deps.clearRuntimeTimeout(to);
        detachRuntimeAbort();
        resolve(v);
      }, "done");
      let ctrl = null;
      try {
        ctrl = new AbortController();
      } catch {
      }
      const onRuntimeAbort = /* @__PURE__ */ __name(() => {
        try {
          ctrl && ctrl.abort();
        } catch {
        }
        ;
        done(null);
      }, "onRuntimeAbort");
      if (runtimeToken.signal) {
        if (runtimeToken.signal.aborted) return done(null);
        runtimeToken.signal.addEventListener("abort", onRuntimeAbort, { once: true });
        detachRuntimeAbort = /* @__PURE__ */ __name(() => runtimeToken.signal.removeEventListener("abort", onRuntimeAbort), "detachRuntimeAbort");
      }
      to = deps.scheduleRuntimeTimeout(() => {
        try {
          ctrl && ctrl.abort();
        } catch {
        }
        ;
        done(false);
      }, timeoutMs || 4e3);
      deps.interceptNetResponse.rawFetch("https://" + cdn + PROBE_PATH + "?_c=" + Date.now(), {
        method: "GET",
        mode: "no-cors",
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: ctrl ? ctrl.signal : void 0
      }).then(() => {
        done(deps.isRuntimeGenerationActive(runtimeToken) ? true : null);
      }).catch(() => {
        done(deps.isRuntimeGenerationActive(runtimeToken) ? false : null);
      });
    }), "confirmHostReachable");
    const segConnCheckAt = /* @__PURE__ */ new Map();
    const SEG_CONN_CHECK_COOLDOWN = 30 * 1e3;
    const handleSegmentConnError = /* @__PURE__ */ __name((cdn, bytesReceived) => {
      if (deps.disabled || !cdn) return;
      const runtimeToken = deps.captureRuntimeGeneration();
      if (!deps.isRuntimeGenerationActive(runtimeToken)) return;
      if (bytesReceived > 0) return;
      if (deps.knownDeadHosts.has(cdn) || deps.blacklistSet.has(cdn)) return;
      const now = Date.now();
      const last = segConnCheckAt.get(cdn) || 0;
      if (now - last < SEG_CONN_CHECK_COOLDOWN) return;
      segConnCheckAt.set(cdn, now);
      if (deps.isPresumedDnsFailHost(cdn)) {
        deps.markHostDead(cdn, "DNS-segment");
        deps.log("[死節點] 已知在台灣不解析的節點又被指派到 segment，直接標死：" + cdn.split(".")[0]);
        deps.promoteBestCdnNow();
        return;
      }
      confirmHostReachable(cdn, CONFIRM_TIMEOUT_MS, runtimeToken).then((reachable) => {
        if (!deps.isRuntimeGenerationActive(runtimeToken) || reachable == null) return;
        if (reachable) return;
        deps.markHostDead(cdn, "DNS-segment");
        deps.log("[死節點] segment 連線層失敗且確認連不到，標死 30 天：" + cdn.split(".")[0]);
        deps.promoteBestCdnNow();
      });
    }, "handleSegmentConnError");
    const probeCdnLatency = /* @__PURE__ */ __name((cdn, runtimeToken = deps.captureRuntimeGeneration()) => new Promise((resolve) => {
      if (!deps.isRuntimeGenerationActive(runtimeToken)) return resolve({ cdn, ms: Infinity, cancelled: true });
      if (deps.knownDeadHosts.has(cdn)) return resolve({ cdn, ms: Infinity });
      const t0 = performance.now();
      let done = false;
      let timedOut = false;
      let timer = null;
      let detachRuntimeAbort = /* @__PURE__ */ __name(() => {
      }, "detachRuntimeAbort");
      const finish = /* @__PURE__ */ __name((result) => {
        if (done) return;
        done = true;
        deps.clearRuntimeTimeout(timer);
        detachRuntimeAbort();
        if (deps.isRuntimeGenerationActive(runtimeToken)) deps.DiagnosticLog.record("measurement", {
          host: cdn,
          reason: Number.isFinite(result.ms) ? "latency-only" : result.cancelled ? "cancelled" : "failed",
          waitMs: Number.isFinite(result.ms) ? result.ms : null
        });
        resolve(Object.assign({ cdn }, result));
      }, "finish");
      let ctrl = null;
      try {
        ctrl = new AbortController();
      } catch {
      }
      const onRuntimeAbort = /* @__PURE__ */ __name(() => {
        try {
          ctrl && ctrl.abort();
        } catch {
        }
        ;
        finish({ ms: Infinity, cancelled: true });
      }, "onRuntimeAbort");
      if (runtimeToken.signal) {
        runtimeToken.signal.addEventListener("abort", onRuntimeAbort, { once: true });
        detachRuntimeAbort = /* @__PURE__ */ __name(() => runtimeToken.signal.removeEventListener("abort", onRuntimeAbort), "detachRuntimeAbort");
      }
      timer = deps.scheduleRuntimeTimeout(() => {
        if (!deps.isRuntimeGenerationActive(runtimeToken)) return finish({ ms: Infinity, cancelled: true });
        timedOut = true;
        try {
          ctrl && ctrl.abort();
        } catch {
        }
        confirmHostReachable(cdn, CONFIRM_TIMEOUT_MS, runtimeToken).then((reachable) => {
          if (!deps.isRuntimeGenerationActive(runtimeToken) || reachable == null) {
            finish({ ms: Infinity, cancelled: true });
            return;
          }
          if (reachable) {
            const slowMs = Math.max(performance.now() - t0, PROBE_TIMEOUT_MS);
            deps.recordCdnLatency(cdn, slowMs);
            const hs = deps.ensureCdnHealth(cdn);
            hs.probeSlows = Math.min(deps.CDN_HEALTH_CAPS.probeSlows, (hs.probeSlows || 0) + 1);
            hs.lastProbeAt = Date.now();
            deps.scheduleCdnHealthSave();
            if (hs.probeSlows >= PROBE_SLOW_STRIKES) {
              deps.softBlockCdn(cdn, "probe-slow", 5 * 60 * 1e3);
            }
            finish({ ms: slowMs });
          } else {
            const h = deps.ensureCdnHealth(cdn);
            h.probeTimeouts = Math.min(deps.CDN_HEALTH_CAPS.probeTimeouts, (h.probeTimeouts || 0) + 1);
            h.lastProbeAt = Date.now();
            deps.scheduleCdnHealthSave();
            if (h.probeTimeouts >= PROBE_TIMEOUT_STRIKES) {
              deps.markHostDead(cdn, "timeout");
              finish({ ms: Infinity, reason: "timeout" });
            } else {
              deps.softBlockCdn(cdn, "probe-timeout", 10 * 60 * 1e3);
              finish({ ms: PROBE_TIMEOUT_MS, reason: "timeout-1st" });
            }
          }
        });
      }, PROBE_TIMEOUT_MS);
      deps.interceptNetResponse.rawFetch("https://" + cdn + PROBE_PATH + "?_t=" + Date.now(), {
        method: "GET",
        mode: "no-cors",
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: ctrl ? ctrl.signal : void 0
      }).then(() => {
        if (timedOut) return;
        if (!deps.isRuntimeGenerationActive(runtimeToken)) return finish({ ms: Infinity, cancelled: true });
        const ms = Math.max(performance.now() - t0, 1);
        deps.recordCdnLatency(cdn, ms);
        const hf = deps.cdnHealth[cdn];
        if (hf && hf.probeSlows) {
          hf.probeSlows = 0;
          deps.scheduleCdnHealthSave();
        }
        finish({ ms });
      }).catch(() => {
        if (timedOut) return;
        if (!deps.isRuntimeGenerationActive(runtimeToken)) return finish({ ms: Infinity, cancelled: true });
        if (deps.isPresumedDnsFailHost(cdn)) {
          deps.markHostDead(cdn, "DNS");
          finish({ ms: Infinity, reason: "DNS" });
          return;
        }
        confirmHostReachable(cdn, CONFIRM_TIMEOUT_MS, runtimeToken).then((reachable) => {
          if (!deps.isRuntimeGenerationActive(runtimeToken) || reachable == null) {
            finish({ ms: Infinity, cancelled: true });
            return;
          }
          if (reachable) {
            const ms = Math.max(performance.now() - t0, 1);
            deps.recordCdnLatency(cdn, ms);
            finish({ ms });
          } else {
            deps.markHostDead(cdn, "DNS");
            finish({ ms: Infinity, reason: "DNS" });
          }
        });
      });
    }), "probeCdnLatency");
    return {
      get PROBE_CACHE_KEY() {
        return PROBE_CACHE_KEY;
      },
      get PROBE_CACHE_TTL() {
        return PROBE_CACHE_TTL;
      },
      get handleSegmentConnError() {
        return handleSegmentConnError;
      },
      get probeCdnLatency() {
        return probeCdnLatency;
      }
    };
  }
  __name(createLatency, "createLatency");

  // src/routing/bakeoff.mjs
  function createBakeoff(deps) {
    const THRPT_PROBE_BYTES = 384 * 1024;
    const THRPT_PROBE_MIN_BYTES = 64 * 1024;
    const THRPT_PROBE_TIMEOUT = 3e3;
    const THRPT_BAKEOFF_COOLDOWN = 90 * 1e3;
    const THRPT_SAMPLE_FRESH_MS = 60 * 1e3;
    const switchMarginFor = /* @__PURE__ */ __name((samples) => {
      if (samples >= 4) return 1.15;
      if (samples >= 2) return 1.3;
      return 1.6;
    }, "switchMarginFor");
    const BAKEOFF_TS_KEY = "lastBakeoffAt_v1";
    const TRUSTED_BAKEOFF_CAPABILITY = /* @__PURE__ */ Symbol("BiliCDN trusted bakeoff");
    const TRUSTED_BAKEOFF_MIN_GAP = Object.freeze({ menu: 5e3, watchdog: 3e4, "verified-failure": 3e4 });
    const trustedBakeoffLastAt = /* @__PURE__ */ Object.create(null);
    const trustedBakeoffRequest = /* @__PURE__ */ __name((reason) => ({ capability: TRUSTED_BAKEOFF_CAPABILITY, reason }), "trustedBakeoffRequest");
    const getLastBakeoffAt = /* @__PURE__ */ __name(() => {
      try {
        return +GM_getValue(BAKEOFF_TS_KEY, 0) || 0;
      } catch {
        return 0;
      }
    }, "getLastBakeoffAt");
    const setLastBakeoffAt = /* @__PURE__ */ __name((ts) => {
      try {
        GM_setValue(BAKEOFF_TS_KEY, ts);
      } catch {
      }
    }, "setLastBakeoffAt");
    let bakeoffRunning = false;
    let bakeoffTimer = null;
    let lastSampleSegmentUrl = null;
    let bakeoffNullStreak = 0;
    let bakeoffEpoch = 0;
    let bakeoffAbortController = null;
    let crossTabShouldBakeoff = /* @__PURE__ */ __name(() => true, "crossTabShouldBakeoff");
    let onBakeoffStart = /* @__PURE__ */ __name(() => {
    }, "onBakeoffStart");
    const probeRouteThroughput = /* @__PURE__ */ __name((candidate, sampleUrl, probeBytes, externalSignal, recordSample = null) => new Promise((resolve) => {
      const runtimeToken = deps.captureRuntimeGeneration();
      const cdn = candidate?.host;
      const native = candidate?.type === "native-signed";
      const eligible = deps.isRuntimeGenerationActive(runtimeToken) && (native || deps.isValidCustomCdnHost(cdn) && !deps.blacklistSet.has(cdn) && !deps.knownDeadHosts.has(cdn) && !deps.matchesExclude(cdn) && !deps.isPresumedDnsFailHost(cdn));
      const decision = native ? null : deps.decideMediaRewrite(sampleUrl);
      const target = native ? candidate.url : eligible && decision.action === "rewrite" ? deps.replaceUrlHost(sampleUrl, cdn) : null;
      if (!target) return resolve({ status: "ineligible", accepted: false, bytes: 0 });
      const wantBytes = Math.min(probeBytes || THRPT_PROBE_BYTES, 768 * 1024);
      const ctrl = new AbortController();
      const t0 = performance.now();
      let ttfb = 0, bytes = 0, settled = false, reader = null, to = null, successResponse = false;
      const signals = [...new Set([externalSignal, runtimeToken.signal].filter(Boolean))];
      const active = /* @__PURE__ */ __name(() => deps.isRuntimeGenerationActive(runtimeToken) && !signals.some((signal) => signal.aborted), "active");
      const finish = /* @__PURE__ */ __name((completion) => {
        if (settled) return;
        settled = true;
        deps.clearRuntimeTimeout(to);
        signals.forEach((signal) => signal.removeEventListener("abort", onAbort));
        try {
          Promise.resolve(reader?.cancel(completion)).catch(() => {
          });
        } catch {
        }
        try {
          ctrl.abort(completion);
        } catch {
        }
        let result = { status: completion, completion, accepted: false, bytes };
        if (!active()) result.status = result.completion = "cancelled";
        else if (completion === "forbidden") result.forbidden = true;
        else if (successResponse && (completion === "complete" || completion === "timeout")) {
          const durationMs = Math.max(1, performance.now() - t0 - ttfb);
          let sample = native ? {
            accepted: bytes >= 128 * 1024 && durationMs >= 5,
            bytes,
            durationMs,
            mbps: bytes * 8 / durationMs / 1e3
          } : { accepted: false };
          if (!native && bytes >= THRPT_PROBE_MIN_BYTES && recordSample) sample = recordSample(cdn, bytes, durationMs, Math.max(1, ttfb));
          result.status = sample.accepted ? completion === "timeout" ? "partial" : "complete" : bytes >= THRPT_PROBE_MIN_BYTES ? "latency-only" : "insufficient";
          result.accepted = !!sample.accepted;
          if (sample.accepted) {
            result.cdn = cdn;
            result.host = cdn;
            result.type = native ? "native-signed" : "catalog-generated";
            result.durationMs = durationMs;
            result.mbps = sample.mbps;
            result.ttfbMs = Math.max(1, ttfb);
            result.partial = completion === "timeout";
            if (result.partial) deps.redirectStats.partialProbeSamples = Math.min(1e4, deps.redirectStats.partialProbeSamples + 1);
          }
        }
        if (active()) deps.DiagnosticLog.record("measurement", { host: cdn, reason: result.status, bytes, received: result.accepted });
        resolve(result);
      }, "finish");
      const onAbort = /* @__PURE__ */ __name(() => finish("cancelled"), "onAbort");
      if (!active()) return finish("cancelled");
      signals.forEach((signal) => signal.addEventListener("abort", onAbort, { once: true }));
      to = deps.scheduleRuntimeTimeout(() => finish("timeout"), THRPT_PROBE_TIMEOUT);
      Promise.resolve().then(() => {
        if (settled || !active()) return null;
        return deps.interceptNetResponse.rawFetch(target, {
          method: "GET",
          headers: { Range: "bytes=0-" + (wantBytes - 1) },
          mode: "cors",
          credentials: "omit",
          cache: "no-store",
          signal: ctrl.signal,
          referrerPolicy: "strict-origin-when-cross-origin"
        });
      }).then(async (resp) => {
        if (settled) {
          try {
            await resp?.body?.cancel();
          } catch {
          }
          return;
        }
        if (!active()) return finish("cancelled");
        if (resp?.status === 403) return finish("forbidden");
        if (!resp || !resp.ok || !resp.body?.getReader) return finish("failed");
        successResponse = true;
        reader = resp.body.getReader();
        ttfb = performance.now() - t0;
        while (!settled) {
          const { done, value } = await reader.read();
          if (settled) return;
          if (!active()) return finish("cancelled");
          bytes += Math.min(value?.byteLength || 0, Math.max(0, wantBytes - bytes));
          if (bytes >= wantBytes || done) return finish("complete");
        }
      }).catch((error) => finish(error?.name === "AbortError" ? "cancelled" : "failed"));
    }), "probeRouteThroughput");
    const probeCdnThroughput = /* @__PURE__ */ __name((cdn, sampleUrl, probeBytes, externalSignal) => probeRouteThroughput(
      { type: "catalog-generated", host: cdn },
      sampleUrl,
      probeBytes,
      externalSignal,
      (_host, bytes, durationMs, ttfb) => {
        const sample = deps.recordCdnThroughput(cdn, bytes, durationMs, deps.playbackRateState.effectiveRate);
        deps.recordCdnLatency(cdn, ttfb);
        return sample;
      }
    ), "probeCdnThroughput");
    const getPlayingCdnHost = /* @__PURE__ */ __name(() => {
      return deps.getAttributedVideoHost();
    }, "getPlayingCdnHost");
    const getWarmCdnHost = /* @__PURE__ */ __name(() => getPlayingCdnHost() || deps.resolvedCdn || deps.lastChosenCdn || deps.activeCdnList[0] || null, "getWarmCdnHost");
    const STARTUP_MIN_BUFFER_SEC = 12;
    const MAX_STARTUP_DEFERS = 3;
    let bakeoffStartupDefers = 0;
    const isStartupBuffering = /* @__PURE__ */ __name(() => {
      try {
        const st = deps.Watchdog.stats();
        if (!st || st.readyState < 0) return false;
        if (st.paused) return false;
        return st.bufferAheadSec < STARTUP_MIN_BUFFER_SEC;
      } catch {
        return false;
      }
    }, "isStartupBuffering");
    const runThroughputBakeoff = /* @__PURE__ */ __name(async (sampleUrl, skipIfFast = true, trustedRequest = null) => {
      const skipped = /* @__PURE__ */ __name((reason) => {
        deps.DiagnosticLog.record("measurement", { reason, requested: false });
        return void 0;
      }, "skipped");
      if (deps.disabled || deps.resolvedCdn || bakeoffRunning) return skipped(deps.disabled ? "disabled" : deps.resolvedCdn ? "fixed" : "busy");
      if (deps.inSeekGrace()) return skipped("seek-grace");
      if (!sampleUrl || !deps.isBiliVideoUrl(sampleUrl) && !deps.getNativeProbeCandidate(sampleUrl)) return skipped("no-segment");
      if (deps.isHostLockedStream(sampleUrl)) return skipped("host-lock");
      const runtimeToken = deps.captureRuntimeGeneration();
      if (!deps.isRuntimeGenerationActive(runtimeToken)) return;
      const now = Date.now();
      const trustedReason = trustedRequest && trustedRequest.capability === TRUSTED_BAKEOFF_CAPABILITY && Object.prototype.hasOwnProperty.call(TRUSTED_BAKEOFF_MIN_GAP, trustedRequest.reason) ? trustedRequest.reason : null;
      if (trustedReason) {
        const last = trustedBakeoffLastAt[trustedReason] || 0;
        if (now - last < TRUSTED_BAKEOFF_MIN_GAP[trustedReason]) return skipped("cooldown");
        trustedBakeoffLastAt[trustedReason] = now;
      } else if (now - getLastBakeoffAt() < THRPT_BAKEOFF_COOLDOWN) {
        return skipped("cooldown");
      }
      if (skipIfFast && bakeoffStartupDefers < MAX_STARTUP_DEFERS && isStartupBuffering()) {
        bakeoffStartupDefers++;
        const deferEpoch = bakeoffEpoch;
        if (!bakeoffTimer) {
          bakeoffTimer = deps.scheduleRuntimeTimeout(() => {
            bakeoffTimer = null;
            if (deferEpoch !== bakeoffEpoch) return;
            runThroughputBakeoff(lastSampleSegmentUrl).catch(deps.reportMeasurementFailure());
          }, 2e3);
        }
        return;
      }
      const preCheckHost = getPlayingCdnHost() || getWarmCdnHost();
      const preHealth = preCheckHost && deps.cdnHealth[preCheckHost];
      if (skipIfFast && preHealth && preHealth.samples && preHealth.lastThroughputAt && Date.now() - preHealth.lastThroughputAt < THRPT_SAMPLE_FRESH_MS && preHealth.ewmaMbps >= deps.getRequiredStreamMbps(void 0, "startup") * 1.5) {
        return;
      }
      if (navigator.locks && navigator.locks.request) {
        return navigator.locks.request("bilicdn-bakeoff", { ifAvailable: true }, (lock) => {
          if (!lock) return skipped("busy");
          if (!deps.isRuntimeGenerationActive(runtimeToken)) return;
          return doBakeoff(sampleUrl, runtimeToken);
        });
      }
      if (!crossTabShouldBakeoff()) return;
      return doBakeoff(sampleUrl, runtimeToken);
    }, "runThroughputBakeoff");
    const doBakeoff = /* @__PURE__ */ __name(async (sampleUrl, runtimeToken = deps.captureRuntimeGeneration()) => {
      if (!deps.isRuntimeGenerationActive(runtimeToken)) return;
      deps.DiagnosticLog.record("measurement", { reason: "accepted", requested: true });
      bakeoffRunning = true;
      setLastBakeoffAt(Date.now());
      const myEpoch = bakeoffEpoch;
      bakeoffAbortController = new AbortController();
      const mySignal = bakeoffAbortController.signal;
      const onRuntimeAbort = /* @__PURE__ */ __name(() => {
        try {
          bakeoffAbortController && bakeoffAbortController.abort();
        } catch {
        }
      }, "onRuntimeAbort");
      if (runtimeToken.signal) runtimeToken.signal.addEventListener("abort", onRuntimeAbort, { once: true });
      onBakeoffStart();
      try {
        const now = Date.now();
        const playingHost = getPlayingCdnHost();
        const catalogCandidates = deps.PREFERRED_CDN_LIST.filter((c) => !deps.blacklistSet.has(c) && !deps.knownDeadHosts.has(c) && !deps.isCdnSoftBlocked(c) && !deps.matchesExclude(c)).filter((c) => !deps.isPresumedDnsFailHost(c)).filter((c) => {
          if (c === playingHost) return false;
          const h = deps.cdnHealth[c];
          return !(h && h.samples && h.lastThroughputAt && now - h.lastThroughputAt < THRPT_SAMPLE_FRESH_MS);
        }).sort((a, b) => {
          const ah = deps.cdnHealth[a], bh = deps.cdnHealth[b];
          const aNever = !(ah && ah.samples && ah.lastThroughputAt);
          const bNever = !(bh && bh.samples && bh.lastThroughputAt);
          if (aNever !== bNever) return aNever ? -1 : 1;
          return (ah && ah.lastThroughputAt || 0) - (bh && bh.lastThroughputAt || 0);
        });
        const nativeCandidate = deps.getNativeProbeCandidate(sampleUrl);
        const candidates = catalogCandidates.slice(0, nativeCandidate ? 3 : 4).map((host) => ({ type: "catalog-generated", host }));
        if (nativeCandidate) candidates.push(nativeCandidate);
        const probeBytes = deps.currentStreamBitsPerSec / 1e6 >= 12 ? 768 * 1024 : THRPT_PROBE_BYTES;
        const ok = [];
        const outcomes = [];
        for (const candidate of candidates) {
          if (!deps.isRuntimeGenerationActive(runtimeToken) || myEpoch !== bakeoffEpoch) break;
          if (deps.isHostLockedStream(sampleUrl)) break;
          const r = candidate.type === "native-signed" ? await probeRouteThroughput(candidate, sampleUrl, probeBytes, mySignal) : await probeCdnThroughput(candidate.host, sampleUrl, probeBytes, mySignal);
          if (!deps.isRuntimeGenerationActive(runtimeToken) || myEpoch !== bakeoffEpoch) return { status: "cancelled", outcomes };
          if (r) outcomes.push({ type: candidate.type, host: candidate.host, ...r });
          if (r && r.forbidden) {
            if (candidate.type === "native-signed") deps.noteNativeRouteFailure({ route: candidate }, candidate.url, 403, "http");
            else {
              deps.noteHostLockedStream(sampleUrl);
              break;
            }
          }
          if (r && r.accepted) {
            if (candidate.type === "native-signed") {
              const recorded = deps.recordNativeProbe(candidate, r, r.ttfbMs);
              if (recorded?.accepted) ok.push({ ...r, native: true });
            } else ok.push(r);
          }
        }
        if (!deps.isRuntimeGenerationActive(runtimeToken)) return;
        if (candidates.length) {
          if (ok.length === 0) {
            bakeoffNullStreak++;
            if (bakeoffNullStreak === 3) {
              deps.err("[Bakeoff] 連續 3 輪測速全部失敗，可能被 CDN 防盜鏈擋下。可由 Tampermonkey 選單開啟 verbose 觀察，或回報此訊息。");
            }
          } else {
            bakeoffNullStreak = 0;
          }
        }
        const stale = myEpoch !== bakeoffEpoch || !deps.isRuntimeGenerationActive(runtimeToken);
        if (stale) return;
        ok.filter((r) => !r.native).forEach((r) => {
          if (!deps.activeCdnList.includes(r.cdn) && !deps.blacklistSet.has(r.cdn) && !deps.knownDeadHosts.has(r.cdn)) {
            deps.activeCdnList.push(r.cdn);
          }
        });
        const ranked = deps.getHealthyCdnList();
        if (ranked.length) {
          const rest = deps.activeCdnList.filter((c) => !ranked.includes(c));
          deps.activeCdnList.length = 0;
          ranked.forEach((c) => deps.activeCdnList.push(c));
          rest.forEach((c) => deps.activeCdnList.push(c));
        }
        if (!stale) {
          const best = deps.activeCdnList[0];
          if (best && playingHost && best !== playingHost) {
            const hb = deps.cdnHealth[best], ho = deps.cdnHealth[playingHost];
            const mb = hb && hb.samples ? hb.ewmaMbps : 0;
            const mo = ho && ho.samples ? ho.ewmaMbps : 0;
            if (deps.getAttributedVideoHost() === playingHost && mb > 0 && mb > mo * switchMarginFor(hb ? hb.samples : 0)) {
              deps.addForcedRedirect(playingHost);
              try {
                deps.Watchdog.noteCdnSwitched();
              } catch {
              }
              deps.log("[Bakeoff] 中途切換 " + playingHost.split(".")[0] + " → " + best.split(".")[0] + "（" + mo.toFixed(1) + "→" + mb.toFixed(1) + " Mbps）");
            }
          }
        }
        deps.promoteBestCdnNow();
        try {
          GM_setValue(deps.PROBE_CACHE_KEY, JSON.stringify({ t: Date.now(), list: [...deps.activeCdnList] }));
        } catch {
        }
        const status = ok.length ? "completed" : outcomes.some((r) => r.forbidden) ? "forbidden" : outcomes.some((r) => r.status === "latency-only") ? "latency-only" : candidates.length ? "failed" : "no-candidates";
        deps.setNativeBakeoffDiagnostics(outcomes);
        return { status, outcomes, samples: ok.length };
      } finally {
        if (runtimeToken.signal) runtimeToken.signal.removeEventListener("abort", onRuntimeAbort);
        bakeoffRunning = false;
        if (bakeoffAbortController && bakeoffAbortController.signal === mySignal) bakeoffAbortController = null;
      }
    }, "doBakeoff");
    const scheduleBakeoff = /* @__PURE__ */ __name((sampleUrl) => {
      if (sampleUrl) lastSampleSegmentUrl = sampleUrl;
      if (deps.disabled || deps.resolvedCdn || bakeoffTimer) return;
      const highBitrate = deps.currentStreamBitsPerSec / 1e6 >= 12;
      const myEpoch = bakeoffEpoch;
      bakeoffTimer = deps.scheduleRuntimeTimeout(() => {
        bakeoffTimer = null;
        if (myEpoch !== bakeoffEpoch) return;
        runThroughputBakeoff(lastSampleSegmentUrl).catch(deps.reportMeasurementFailure());
      }, highBitrate ? 4e3 : 1500);
    }, "scheduleBakeoff");
    return {
      get TRUSTED_BAKEOFF_MIN_GAP() {
        return TRUSTED_BAKEOFF_MIN_GAP;
      },
      get trustedBakeoffLastAt() {
        return trustedBakeoffLastAt;
      },
      get trustedBakeoffRequest() {
        return trustedBakeoffRequest;
      },
      get setLastBakeoffAt() {
        return setLastBakeoffAt;
      },
      get bakeoffRunning() {
        return bakeoffRunning;
      },
      set bakeoffRunning(value) {
        bakeoffRunning = value;
      },
      get bakeoffTimer() {
        return bakeoffTimer;
      },
      set bakeoffTimer(value) {
        bakeoffTimer = value;
      },
      get lastSampleSegmentUrl() {
        return lastSampleSegmentUrl;
      },
      set lastSampleSegmentUrl(value) {
        lastSampleSegmentUrl = value;
      },
      get bakeoffEpoch() {
        return bakeoffEpoch;
      },
      set bakeoffEpoch(value) {
        bakeoffEpoch = value;
      },
      get bakeoffAbortController() {
        return bakeoffAbortController;
      },
      set bakeoffAbortController(value) {
        bakeoffAbortController = value;
      },
      get crossTabShouldBakeoff() {
        return crossTabShouldBakeoff;
      },
      set crossTabShouldBakeoff(value) {
        crossTabShouldBakeoff = value;
      },
      get onBakeoffStart() {
        return onBakeoffStart;
      },
      set onBakeoffStart(value) {
        onBakeoffStart = value;
      },
      get getPlayingCdnHost() {
        return getPlayingCdnHost;
      },
      get getWarmCdnHost() {
        return getWarmCdnHost;
      },
      get bakeoffStartupDefers() {
        return bakeoffStartupDefers;
      },
      set bakeoffStartupDefers(value) {
        bakeoffStartupDefers = value;
      },
      get isStartupBuffering() {
        return isStartupBuffering;
      },
      get runThroughputBakeoff() {
        return runThroughputBakeoff;
      },
      get scheduleBakeoff() {
        return scheduleBakeoff;
      }
    };
  }
  __name(createBakeoff, "createBakeoff");

  // src/runtime/connections.mjs
  function createHints(deps) {
    const runtimeHintIds = /* @__PURE__ */ new Set();
    const preconnectCdn = /* @__PURE__ */ __name((cdn, force) => {
      try {
        if (!deps.isValidCustomCdnHost(cdn)) return;
        const fixedTarget = (() => {
          try {
            return !!deps.resolvedCdn && cdn === deps.resolvedCdn;
          } catch {
            return false;
          }
        })();
        if (!fixedTarget && (deps.knownDeadHosts.has(cdn) || deps.blacklistSet.has(cdn) || deps.isCdnSoftBlocked(cdn) || deps.matchesExclude(cdn) || deps.isPresumedDnsFailHost(cdn))) return;
        const id = "bilicdn-preconn-" + cdn;
        const existing = document.getElementById(id);
        if (existing) {
          if (!force) return;
          existing.remove();
        }
        const link = document.createElement("link");
        link.id = id;
        link.rel = "preconnect";
        link.href = "https://" + cdn;
        link.crossOrigin = "anonymous";
        (document.head || document.documentElement).appendChild(link);
        runtimeHintIds.add(id);
        const dnsId = "bilicdn-dns-" + cdn;
        if (!document.getElementById(dnsId)) {
          const dns = document.createElement("link");
          dns.id = dnsId;
          dns.rel = "dns-prefetch";
          dns.href = "https://" + cdn;
          (document.head || document.documentElement).appendChild(dns);
          runtimeHintIds.add(dnsId);
        }
      } catch {
      }
    }, "preconnectCdn");
    const preconnectBatch = /* @__PURE__ */ __name((hosts, force) => {
      ;
      [...new Set(hosts || [])].forEach((h) => h && preconnectCdn(h, force));
    }, "preconnectBatch");
    const clearRuntimeConnectionHints = /* @__PURE__ */ __name(() => {
      runtimeHintIds.forEach((id) => {
        try {
          const node = document.getElementById(id);
          if (node) node.remove();
        } catch {
        }
      });
      runtimeHintIds.clear();
    }, "clearRuntimeConnectionHints");
    return {
      get preconnectCdn() {
        return preconnectCdn;
      },
      get preconnectBatch() {
        return preconnectBatch;
      },
      get clearRuntimeConnectionHints() {
        return clearRuntimeConnectionHints;
      }
    };
  }
  __name(createHints, "createHints");

  // src/routing/probe.mjs
  function createProbe(deps) {
    let reorderRunning = false;
    const PROBE_DEFER_CHECK_MS = 2e3;
    const MAX_PROBE_DEFERS = 6;
    let deferStartupProbes = true;
    let probeDeferCount = 0;
    let probeDeferTimer = null;
    const hasUsableCdnHealth = /* @__PURE__ */ __name(() => deps.activeCdnList.some((c) => {
      const h = deps.cdnHealth[c];
      return !!h && h.samples > 0 && !deps.knownDeadHosts.has(c) && !deps.blacklistSet.has(c);
    }), "hasUsableCdnHealth");
    const scheduleDeferredLatencyProbe = /* @__PURE__ */ __name(() => {
      if (probeDeferTimer) return;
      if (probeDeferCount >= MAX_PROBE_DEFERS) {
        deferStartupProbes = false;
        return;
      }
      probeDeferCount++;
      probeDeferTimer = deps.scheduleRuntimeTimeout(() => {
        probeDeferTimer = null;
        if (deps.isStartupBuffering()) {
          scheduleDeferredLatencyProbe();
          return;
        }
        deferStartupProbes = false;
        reorderCdnsByLatency().catch(deps.reportMeasurementFailure());
      }, PROBE_DEFER_CHECK_MS);
    }, "scheduleDeferredLatencyProbe");
    const reorderCdnsByLatency = /* @__PURE__ */ __name(async (force) => {
      if (deps.disabled) return;
      const runtimeToken = deps.captureRuntimeGeneration();
      if (!deps.isRuntimeGenerationActive(runtimeToken)) return;
      if (deps.resolvedCdn) {
        deps.preconnectCdn(deps.resolvedCdn);
        return;
      }
      if (reorderRunning || deps.bakeoffRunning || !force && deps.inSeekGrace()) {
        scheduleDeferredLatencyProbe();
        return;
      }
      reorderRunning = true;
      try {
        if (!force) {
          try {
            const cached = JSON.parse(GM_getValue(deps.PROBE_CACHE_KEY) || "null");
            if (cached && Date.now() - cached.t < deps.PROBE_CACHE_TTL && Array.isArray(cached.list)) {
              const usable = /* @__PURE__ */ __name((c) => !deps.blacklistSet.has(c) && !deps.knownDeadHosts.has(c) && !deps.isCdnSoftBlocked(c) && deps.PREFERRED_CDN_LIST.includes(c), "usable");
              deps.activeCdnList.length = 0;
              cached.list.forEach((c) => {
                if (usable(c)) deps.activeCdnList.push(c);
              });
              deps.PREFERRED_CDN_LIST.forEach((c) => {
                if (usable(c) && !deps.activeCdnList.includes(c)) deps.activeCdnList.push(c);
              });
              if (deps.activeCdnList.length) {
                probeDeferCount = 0;
                deps.promoteBestCdnNow();
                deps.preconnectBatch(deps.activeCdnList.slice(0, 3));
                return;
              }
            }
          } catch {
          }
        }
        if (deferStartupProbes && !force && hasUsableCdnHealth()) {
          scheduleDeferredLatencyProbe();
          return;
        }
        deferStartupProbes = false;
        const candidates = deps.PREFERRED_CDN_LIST.filter((h) => {
          if (deps.knownDeadHosts.has(h) || deps.isCdnSoftBlocked(h)) return false;
          if (deps.isPresumedDnsFailHost(h)) return false;
          return true;
        });
        const results = await Promise.all(candidates.map((cdn) => deps.probeCdnLatency(cdn, runtimeToken)));
        if (!deps.isRuntimeGenerationActive(runtimeToken)) return;
        const sortKey = /* @__PURE__ */ __name((r) => {
          if (!Number.isFinite(r.ms)) return Infinity;
          const hh = deps.cdnHealth[r.cdn];
          return hh && hh.latencyMs ? hh.latencyMs : r.ms;
        }, "sortKey");
        results.sort((a, b) => sortKey(a) - sortKey(b));
        const failed = results.filter((r) => r.reason);
        if (failed.length) {
          deps.log("[探測] 判定不可用：" + failed.map((r) => r.cdn.split(".")[0] + "(" + r.reason + ")").join("、"));
        }
        deps.activeCdnList.length = 0;
        for (const r of results) {
          if (!deps.blacklistSet.has(r.cdn) && !deps.knownDeadHosts.has(r.cdn) && !deps.isPresumedDnsFailHost(r.cdn) && r.ms !== Infinity) {
            deps.activeCdnList.push(r.cdn);
          }
        }
        if (deps.activeCdnList.length === 0) {
          deps.PREFERRED_CDN_LIST.forEach((c) => {
            if (!deps.blacklistSet.has(c) && !deps.knownDeadHosts.has(c) && !deps.isPresumedDnsFailHost(c)) {
              deps.activeCdnList.push(c);
            }
          });
        }
        const ranked = deps.getHealthyCdnList();
        if (ranked.length) {
          const rest = deps.activeCdnList.filter((c) => !ranked.includes(c));
          deps.activeCdnList.length = 0;
          ranked.forEach((c) => deps.activeCdnList.push(c));
          rest.forEach((c) => deps.activeCdnList.push(c));
        }
        if (!deps.isRuntimeGenerationActive(runtimeToken)) return;
        try {
          GM_setValue(deps.PROBE_CACHE_KEY, JSON.stringify({ t: Date.now(), list: [...deps.activeCdnList] }));
        } catch {
        }
        probeDeferCount = 0;
        if (deps.activeCdnList[0]) {
          deps.preconnectBatch(deps.activeCdnList.slice(0, 3), force);
        }
      } finally {
        reorderRunning = false;
      }
    }, "reorderCdnsByLatency");
    return {
      get reorderRunning() {
        return reorderRunning;
      },
      set reorderRunning(value) {
        reorderRunning = value;
      },
      get probeDeferCount() {
        return probeDeferCount;
      },
      set probeDeferCount(value) {
        probeDeferCount = value;
      },
      get probeDeferTimer() {
        return probeDeferTimer;
      },
      set probeDeferTimer(value) {
        probeDeferTimer = value;
      },
      get reorderCdnsByLatency() {
        return reorderCdnsByLatency;
      }
    };
  }
  __name(createProbe, "createProbe");

  // src/playback/watchdog.mjs
  function createWatchdog(deps) {
    const Watchdog = (() => {
      const TICK_MS = 1e3;
      const STALL_MAX = 3;
      const MIN_BPS_FLOOR = 350 * 1024;
      const URGENT_BUFFER_SEC = 5;
      const STALL_DANGER_SEC = 10;
      const REACHED_RECHECK_BUFFER_SEC = 10;
      const SWITCH_COOL = 5e3;
      const STARTUP_GRACE_MS = 3e3;
      const STARTUP_GRACE_MS_HIGH = 5e3;
      let totalBytes = 0;
      let lastBufferedEnd = 0;
      let lastCurrentTime = 0;
      let stallCount = 0;
      const BPS_WINDOW_MS = 8e3;
      let byteSamples = [];
      let lastSwitchAt = 0;
      const SWITCH_BURST_MAX = 3;
      const SWITCH_BURST_WINDOW = 60 * 1e3;
      const SWITCH_BREAKER_MS = 90 * 1e3;
      let switchTimes = [];
      let switchBreakerUntil = 0;
      let burstPunished = [];
      const penaltyFields = ["failures", "lastFailureAt", "softBlocks", "lastSoftBlockAt", "lastSoftBlockReason"];
      const penaltyState = /* @__PURE__ */ __name((host) => ({
        ...Object.fromEntries(penaltyFields.map((k) => [k, deps.cdnHealth[host]?.[k]])),
        until: deps.cdnSoftBlockUntil[host]
      }), "penaltyState");
      const retractBurstPenalties = /* @__PURE__ */ __name(() => {
        const records = burstPunished;
        burstPunished = [];
        const hosts = /* @__PURE__ */ new Set();
        records.reverse().forEach(({ host, before, after, at }) => {
          if (Date.now() - at >= SWITCH_BURST_WINDOW) return;
          const current = penaltyState(host), h = deps.cdnHealth[host];
          if (!h || [...penaltyFields, "until"].some((k) => current[k] !== after[k])) return;
          penaltyFields.forEach((k) => {
            if (before[k] === void 0) delete h[k];
            else h[k] = before[k];
          });
          if (before.until === void 0) delete deps.cdnSoftBlockUntil[host];
          else deps.cdnSoftBlockUntil[host] = before.until;
          hosts.add(host);
          if (!deps.activeCdnList.includes(host) && !deps.blacklistSet.has(host) && !deps.knownDeadHosts.has(host) && deps.PREFERRED_CDN_LIST.includes(host)) {
            deps.activeCdnList.push(host);
          }
        });
        if (hosts.size) {
          deps.scheduleCdnHealthSave();
          deps.promoteBestCdnNow();
        }
        return [...hosts];
      }, "retractBurstPenalties");
      let lastNudgeDetectAt = 0;
      let lastTickAt = 0;
      let observer = null;
      let timer = null;
      let started = false;
      let startedAt = 0;
      let switchGraceUntil = 0;
      let reached = false;
      let sessionSwitchCount = 0;
      let observedSwitchCount = 0;
      let sessionStallCount = 0;
      let sessionHardFailCount = 0;
      let recoveryObservation = null;
      let recoverySequence = 0;
      const noteVideoTransport = /* @__PURE__ */ __name((previous, observation) => {
        if (!deps.freshMediaObservation(previous) || !observation.host || !previous.host || observation.host === previous.host) return;
        observedSwitchCount = Math.min(Number.MAX_SAFE_INTEGER, observedSwitchCount + 1);
        deps.DiagnosticLog.record("recovery", { reason: "received", originalHost: previous.host, finalHost: observation.host });
      }, "noteVideoTransport");
      const interruptRecovery = /* @__PURE__ */ __name(() => {
        if (recoveryObservation) deps.DiagnosticLog.record("recovery", { ...recoveryObservation, outcome: "interrupted" }, true);
        recoveryObservation = null;
      }, "interruptRecovery");
      const observeRecovery = /* @__PURE__ */ __name((state, now) => {
        const r = recoveryObservation;
        if (!r) return;
        if (r.generation !== deps.runtimeGeneration || r.epoch !== deps.playinfoEpoch || !state.valid || state.paused || state.seeking || state.ended || state.errorCode || deps.inSeekGrace()) {
          interruptRecovery();
          return;
        }
        if (now < switchGraceUntil) return;
        r.count++;
        const progress = state.currentTime > r.currentTime + 0.05 || state.bufferAheadSec > r.bufferAheadSec + 0.05;
        if (progress || r.count >= 3) {
          deps.DiagnosticLog.record("recovery", {
            ...r,
            currentTime: state.currentTime,
            bufferAheadSec: state.bufferAheadSec,
            finalHost: deps.getAttributedVideoHost(),
            outcome: progress ? "progress" : "no-progress"
          }, true);
          recoveryObservation = null;
        }
      }, "observeRecovery");
      const perCdnBytes = {};
      const PERFORMANCE_ENTRY_URL_MAX = 16 * 1024;
      const PERFORMANCE_ENTRY_BYTES_MAX = 256 * 1024 * 1024;
      const PERFORMANCE_ENTRY_DURATION_MAX_MS = 10 * 60 * 1e3;
      const getWatchdogSample = /* @__PURE__ */ __name(() => ({
        totalBytes,
        stallEvents: sessionStallCount,
        switchCount: sessionSwitchCount,
        hardFailCount: sessionHardFailCount,
        elapsedSec: Math.max(1, (Date.now() - startedAt) / 1e3),
        reachedTarget: reached
      }), "getWatchdogSample");
      const onEntry = /* @__PURE__ */ __name((entry) => {
        if (deps.disabled || !entry || typeof entry.name !== "string" || !entry.name || entry.name.length > PERFORMANCE_ENTRY_URL_MAX) return;
        if (!/\.m4s($|\?)/i.test(entry.name) && !/\.flv($|\?)/i.test(entry.name)) return;
        if (deps.wasSegmentAccounted(entry.name)) return;
        const bytes = Number(entry.transferSize || entry.encodedBodySize || 0);
        if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > PERFORMANCE_ENTRY_BYTES_MAX) return;
        try {
          const h = new URL(entry.name).hostname;
          if (!deps.TRUSTED_CDN_CATALOG_SET.has(h)) return;
          deps.observeMediaTransfer(deps.captureMediaRequest(entry.name), entry.name, bytes, "performance");
          totalBytes = Math.min(Number.MAX_SAFE_INTEGER, totalBytes + bytes);
          perCdnBytes[h] = Math.min(Number.MAX_SAFE_INTEGER, (perCdnBytes[h] || 0) + bytes);
          const v = getVideo();
          const rate = v ? deps.syncPlaybackRateFromVideo(v, "performance").effectiveRate : deps.playbackRateState.effectiveRate;
          const dur = entry.responseEnd && entry.responseStart ? entry.responseEnd - entry.responseStart : entry.duration || 0;
          if (Number.isFinite(dur) && dur > 0 && dur <= PERFORMANCE_ENTRY_DURATION_MAX_MS) {
            deps.recordCdnThroughput(h, bytes, dur, rate);
          }
        } catch {
        }
      }, "onEntry");
      let cachedVideo = null;
      const getVideo = /* @__PURE__ */ __name(() => {
        if (cachedVideo && cachedVideo.isConnected && cachedVideo.clientWidth) return cachedVideo;
        let best = null, bestArea = 0;
        document.querySelectorAll("video").forEach((v) => {
          const a = (v.clientWidth || 0) * (v.clientHeight || 0);
          if (a > bestArea) {
            bestArea = a;
            best = v;
          }
        });
        cachedVideo = best;
        return best;
      }, "getVideo");
      const bufferedEnd = /* @__PURE__ */ __name((v) => {
        try {
          if (!v) return 0;
          const now = v.currentTime || 0;
          if (!v.buffered || v.buffered.length === 0) return now;
          for (let i = 0; i < v.buffered.length; i++) {
            const start2 = v.buffered.start(i);
            const end = v.buffered.end(i);
            if (now >= start2 - 0.05 && now <= end + 0.05) return end;
          }
          return now;
        } catch {
          return v ? v.currentTime || 0 : 0;
        }
      }, "bufferedEnd");
      const fmtMB = /* @__PURE__ */ __name((b) => (b / 1024 / 1024).toFixed(2), "fmtMB");
      const noteSeek = /* @__PURE__ */ __name(() => {
        stallCount = 0;
        deps.bumpSeekGrace();
      }, "noteSeek");
      const noteCdnSwitched = /* @__PURE__ */ __name(() => {
        stallCount = 0;
        lastBufferedEnd = 0;
        byteSamples = [];
        switchGraceUntil = Date.now() + (deps.currentStreamBitsPerSec / 1e6 >= 12 ? STARTUP_GRACE_MS_HIGH : STARTUP_GRACE_MS);
      }, "noteCdnSwitched");
      const switchCdn = /* @__PURE__ */ __name((reason) => {
        if (deps.inSeekGrace()) {
          deps.DiagnosticLog.setDecision("seek-grace");
          return;
        }
        const nowSw = Date.now();
        if (nowSw < switchBreakerUntil) {
          deps.DiagnosticLog.setDecision("breaker", { remainingMs: switchBreakerUntil - nowSw });
          return;
        }
        if (nowSw - lastSwitchAt < SWITCH_COOL) {
          deps.DiagnosticLog.setDecision("cooldown", { remainingMs: SWITCH_COOL - (nowSw - lastSwitchAt) });
          return;
        }
        switchTimes = switchTimes.filter((t) => nowSw - t < SWITCH_BURST_WINDOW);
        if (switchTimes.length >= SWITCH_BURST_MAX) {
          switchBreakerUntil = nowSw + SWITCH_BREAKER_MS;
          switchTimes = [];
          const retracted = retractBurstPenalties();
          deps.DiagnosticLog.record("breaker", { remainingMs: SWITCH_BREAKER_MS, count: retracted.length }, true);
          deps.log("[Watchdog] " + Math.round(SWITCH_BURST_WINDOW / 1e3) + " 秒內已嘗試修復 " + SWITCH_BURST_MAX + " 次後未觀察到改善，原因尚未確認；暫停切換 " + Math.round(SWITCH_BREAKER_MS / 1e3) + " 秒" + (retracted.length ? "；收回本波懲罰：" + retracted.map((h) => h.split(".")[0]).join("、") : ""));
          return;
        }
        switchTimes.push(nowSw);
        lastSwitchAt = nowSw;
        sessionSwitchCount++;
        noteCdnSwitched();
        interruptRecovery();
        const recoveryState = deps.readPlaybackDiagnostic();
        recoveryObservation = {
          actionId: ++recoverySequence,
          generation: deps.runtimeGeneration,
          epoch: deps.playinfoEpoch,
          count: 0,
          currentTime: recoveryState.currentTime,
          bufferAheadSec: recoveryState.bufferAheadSec,
          originalHost: deps.getAttributedVideoHost()
        };
        deps.DiagnosticLog.record("recovery", { ...recoveryObservation, outcome: "attempt" }, true);
        if (deps.HttpDnsAutoPilot.onStall(reason, getWatchdogSample())) {
          deps.DiagnosticLog.record("recovery", { actionId: recoverySequence, reason: "httpdns", reselected: true }, true);
          deps.promoteBestCdnNow();
          deps.reorderCdnsByLatency(true).catch(deps.reportMeasurementFailure());
          return;
        }
        const playingHost = deps.getAttributedVideoHost();
        const culprit = playingHost && !deps.isUnstableCdnHost(playingHost) && !deps.blacklistSet.has(playingHost) && !deps.knownDeadHosts.has(playingHost) ? playingHost : null;
        if (culprit) {
          const before = penaltyState(culprit);
          deps.recordCdnPenalty(culprit, false);
          deps.softBlockCdn(culprit, reason, deps.CDN_SOFT_BLOCK_MS);
          burstPunished = burstPunished.filter((p) => nowSw - p.at < SWITCH_BURST_WINDOW);
          burstPunished.push({ host: culprit, before, after: penaltyState(culprit), at: nowSw });
          if (burstPunished.length > SWITCH_BURST_MAX) burstPunished.shift();
          deps.log("[Watchdog] 切換觸發：" + reason + "，懲罰 " + culprit.split(".")[0]);
        }
        deps.DiagnosticLog.record("recovery", {
          actionId: recoverySequence,
          reason: culprit ? "attributed" : "no-attribution",
          host: culprit,
          punished: !!culprit,
          reselected: true,
          preconnect: true
        }, true);
        try {
          GM_deleteValue(deps.PROBE_CACHE_KEY);
        } catch {
        }
        deps.promoteBestCdnNow();
        const warmHost = playingHost || deps.getWarmCdnHost();
        const warmTargets = deps.getHealthyCdnList().slice(0, 3).filter((h) => h !== warmHost);
        deps.preconnectBatch(warmTargets, true);
        if (warmHost) deps.preconnectCdn(warmHost, false);
        const scheduleDelayedReorder = /* @__PURE__ */ __name((retriesLeft) => {
          deps.scheduleRuntimeTimeout(() => {
            if ((deps.inSeekGrace() || deps.bakeoffRunning) && retriesLeft > 0) {
              scheduleDelayedReorder(retriesLeft - 1);
              return;
            }
            if (deps.inSeekGrace()) return;
            deps.reorderCdnsByLatency(true).catch(deps.reportMeasurementFailure());
          }, 1e4);
        }, "scheduleDelayedReorder");
        scheduleDelayedReorder(2);
        if (deps.currentStreamBitsPerSec / 1e6 >= 12 && deps.lastSampleSegmentUrl) {
          deps.runThroughputBakeoff(deps.lastSampleSegmentUrl, false, deps.trustedBakeoffRequest("watchdog")).catch(deps.reportMeasurementFailure());
        }
      }, "switchCdn");
      const tick = /* @__PURE__ */ __name(() => {
        if (deps.disabled) {
          deps.DiagnosticLog.setDecision("disabled");
          return;
        }
        const v = getVideo();
        if (!v) {
          deps.resetPlaybackRateState();
          stallCount = 0;
          interruptRecovery();
          deps.DiagnosticLog.setDecision("no-video");
          return;
        }
        const playback = deps.readPlaybackDiagnostic(v);
        const unavailable = !playback.valid ? "invalid-state" : playback.errorCode ? "media-error" : playback.ended || playback.duration > 0 && playback.currentTime >= playback.duration ? "ended" : playback.paused ? "paused" : playback.seeking ? "seeking" : playback.readyState === 0 ? "no-metadata" : null;
        if (unavailable) {
          stallCount = 0;
          lastCurrentTime = playback.currentTime || 0;
          lastBufferedEnd = playback.currentTime || 0;
          lastTickAt = Date.now();
          byteSamples = [];
          interruptRecovery();
          deps.DiagnosticLog.setDecision(unavailable, playback);
          return;
        }
        deps.syncStreamBitrateFromVideo(v);
        const nowTick = Date.now();
        const sinceLast = lastTickAt ? nowTick - lastTickAt : TICK_MS;
        lastTickAt = nowTick;
        if (sinceLast > TICK_MS * 3) {
          byteSamples = [];
          lastCurrentTime = v.currentTime;
          lastBufferedEnd = bufferedEnd(v);
          stallCount = 0;
          deps.DiagnosticLog.setDecision("background-gap", { waitMs: sinceLast });
          return;
        }
        const be = bufferedEnd(v);
        byteSamples.push({ t: nowTick, bytes: totalBytes, ahead: Math.max(0, be - v.currentTime) });
        while (byteSamples.length > 1 && nowTick - byteSamples[0].t > BPS_WINDOW_MS) byteSamples.shift();
        const oldestSample = byteSamples[0];
        const bpsSpanSec = Math.max(0.2, (nowTick - oldestSample.t) / 1e3);
        const bps = (totalBytes - oldestSample.bytes) / bpsSpanSec;
        const rateState = deps.syncPlaybackRateFromVideo(v, "watchdog");
        const playRate = rateState.observedRate;
        const targetBytes = deps.getBufferTargetBytes(rateState.effectiveRate);
        if (!reached && totalBytes >= targetBytes) {
          reached = true;
          deps.HttpDnsAutoPilot.onTargetReached(getWatchdogSample());
        }
        deps.HttpDnsAutoPilot.tick(getWatchdogSample());
        const ct = v.currentTime;
        const ctDeltaRaw = ct - lastCurrentTime;
        const ctDeltaAbs = Math.abs(ctDeltaRaw);
        const expectedDelta = v.paused || v.seeking ? 0 : playRate * (sinceLast / 1e3);
        const nudgeOver = ctDeltaRaw - expectedDelta;
        const playerNudge = !v.paused && nudgeOver > 0.15 && nudgeOver < 1.6;
        const userSeek = ctDeltaRaw < -0.1 || ctDeltaAbs >= 2 && nudgeOver >= 0.75;
        lastCurrentTime = ct;
        if (userSeek) noteSeek();
        if (playerNudge) {
          lastNudgeDetectAt = Date.now();
          stallCount = 0;
          lastBufferedEnd = be;
          deps.DiagnosticLog.setDecision("player-nudge");
          return;
        }
        if (deps.inSeekGrace()) {
          stallCount = 0;
          lastBufferedEnd = be;
          interruptRecovery();
          deps.DiagnosticLog.setDecision("seek-grace");
          return;
        }
        if (Date.now() - lastNudgeDetectAt < 3e3) {
          stallCount = 0;
          lastBufferedEnd = be;
          deps.DiagnosticLog.setDecision("nudge-grace", { remainingMs: 3e3 - (Date.now() - lastNudgeDetectAt) });
          return;
        }
        const bufferAhead = Math.max(0, be - ct);
        const playing = !v.paused && !v.seeking && v.readyState >= 2;
        const streamMbps = deps.currentStreamBitsPerSec / 1e6;
        const highBitrate = streamMbps >= 12;
        const recheckEff = highBitrate ? 20 : REACHED_RECHECK_BUFFER_SEC;
        const stallMaxEff = highBitrate ? 2 : STALL_MAX;
        const graceMs = highBitrate ? STARTUP_GRACE_MS_HIGH : STARTUP_GRACE_MS;
        if (Date.now() - startedAt < graceMs || Date.now() < switchGraceUntil) {
          stallCount = 0;
          lastBufferedEnd = be;
          deps.DiagnosticLog.setDecision(Date.now() < switchGraceUntil ? "switch-grace" : "startup-grace", {
            remainingMs: Math.max(startedAt + graceMs, switchGraceUntil) - Date.now()
          });
          return;
        }
        observeRecovery(playback, nowTick);
        const inDanger = bufferAhead < STALL_DANGER_SEC;
        const urgentBuffer = bufferAhead < URGENT_BUFFER_SEC;
        const monitorAfterReached = reached && bufferAhead < recheckEff;
        if (reached && !monitorAfterReached) {
          stallCount = 0;
          lastBufferedEnd = be;
          deps.DiagnosticLog.setDecision("target-reached");
          return;
        }
        const requiredBps = deps.getWatchdogRequiredBps(streamMbps, rateState.effectiveRate, highBitrate);
        const effFloor = requiredBps > 0 ? Math.min(MIN_BPS_FLOOR, requiredBps * 1.2) : MIN_BPS_FLOOR;
        const minBps = Math.max(effFloor, requiredBps);
        const oldestAhead = oldestSample.ahead;
        const bufferDraining = typeof oldestAhead === "number" ? bufferAhead < oldestAhead - 0.5 : true;
        const stalled = inDanger && be <= lastBufferedEnd + 0.05 && playing && (urgentBuffer || bufferDraining);
        const tooSlow = inDanger && bps < (urgentBuffer ? minBps * 1.2 : minBps) && playing && totalBytes > 0 && (urgentBuffer || bufferDraining);
        const lowData = v.readyState === 1 && urgentBuffer && ctDeltaRaw <= 0.05 && be <= lastBufferedEnd + 0.05;
        lastBufferedEnd = be;
        if (stalled || tooSlow || lowData) {
          stallCount += urgentBuffer ? 2 : 1;
          deps.DiagnosticLog.setDecision(lowData ? "low-data" : stalled ? "buffered-stall" : "too-slow", {
            stallCount,
            bufferAheadSec: bufferAhead,
            readyState: v.readyState
          });
          if (stallCount >= stallMaxEff) {
            stallCount = 0;
            sessionStallCount++;
            switchCdn(lowData ? "low-data：資料不足且播放進度停滯" : stalled ? "buffered 停滯" : "bps=" + Math.round(bps / 1024) + "KB/s 低於需求");
          }
        } else {
          stallCount = 0;
          deps.DiagnosticLog.setDecision("healthy", { bufferAheadSec: bufferAhead });
        }
      }, "tick");
      return {
        // Fetch／XHR 的進度位元組沒有完整 duration，故不更新單節點吞吐 EWMA；
        // 仍計入總量，讓累計下載與 Watchdog 的 bps 判斷保持一致。
        noteExternalBytes(host, bytes) {
          if (deps.disabled || !Number.isSafeInteger(bytes) || bytes <= 0 || bytes > 256 * 1024 * 1024) return;
          totalBytes = Math.min(Number.MAX_SAFE_INTEGER, totalBytes + bytes);
          if (deps.TRUSTED_CDN_CATALOG_SET.has(host)) {
            perCdnBytes[host] = Math.min(Number.MAX_SAFE_INTEGER, (perCdnBytes[host] || 0) + bytes);
          }
        },
        // recordCdnFailure 的 hard-fail 分支呼叫；getWatchdogSample() 的 hardFailCount
        // 過去永遠回 0（沒有任何地方會遞增它），導致 HTTPDNS computeScore 裡的
        // hardFailCount 懲罰項形同虛設。
        noteHardFail() {
          sessionHardFailCount++;
        },
        start() {
          if (started) return;
          started = true;
          startedAt = Date.now();
          try {
            observer = new PerformanceObserver((list) => list.getEntries().forEach(onEntry));
            observer.observe({ type: "resource", buffered: true });
          } catch {
            deps.DiagnosticLog.fault("watchdog");
          }
          timer = setInterval(() => {
            try {
              tick();
            } catch {
              deps.DiagnosticLog.fault("watchdog");
            }
          }, TICK_MS);
        },
        stop() {
          interruptRecovery();
          if (observer) {
            try {
              observer.disconnect();
            } catch {
            }
            ;
            observer = null;
          }
          if (timer) {
            clearInterval(timer);
            timer = null;
          }
          started = false;
        },
        reset() {
          interruptRecovery();
          totalBytes = 0;
          lastBufferedEnd = 0;
          stallCount = 0;
          lastCurrentTime = 0;
          lastNudgeDetectAt = 0;
          lastTickAt = 0;
          byteSamples = [];
          reached = false;
          startedAt = Date.now();
          sessionSwitchCount = 0;
          observedSwitchCount = 0;
          sessionStallCount = 0;
          sessionHardFailCount = 0;
          deps.resetMediaDelivery();
          switchTimes = [];
          switchBreakerUntil = 0;
          burstPunished = [];
          switchGraceUntil = 0;
          cachedVideo = null;
          Object.keys(perCdnBytes).forEach((k) => delete perCdnBytes[k]);
        },
        stats() {
          const state = deps.readPlaybackDiagnostic();
          const targetBytes = deps.getBufferTargetBytes();
          const videoTimeSec = +(state.currentTime || 0).toFixed(2);
          const bufferedEndSec = +(videoTimeSec + (state.bufferAheadSec || 0)).toFixed(2);
          const bufferAheadSec = +Math.max(0, bufferedEndSec - videoTimeSec).toFixed(2);
          return {
            totalMB: +fmtMB(totalBytes),
            targetMB: +fmtMB(targetBytes),
            reachedTarget: reached,
            // bufferedSec 保留為相容別名；新程式請用語意明確的 bufferedEndSec / bufferAheadSec。
            bufferedSec: bufferedEndSec,
            bufferedEndSec,
            bufferAheadSec,
            videoTimeSec,
            readyState: state.readyState === null ? -1 : state.readyState,
            paused: state.paused,
            perCdnMB: Object.fromEntries(
              Object.entries(perCdnBytes).map(([k, b]) => [k.split(".")[0], +fmtMB(b)])
            ),
            perCdnMbps: Object.fromEntries(
              Object.entries(deps.cdnHealth).filter(([, h]) => h.samples > 0).map(([k, h]) => [k.split(".")[0], +h.ewmaMbps.toFixed(2)])
            ),
            requiredMbps: +deps.getRequiredStreamMbps().toFixed(2),
            cdnScore: Object.fromEntries(
              Object.keys(deps.cdnHealth).filter((k) => deps.cdnHealth[k].samples > 0).map((k) => [k.split(".")[0], +deps.getCdnHealthScore(k).toFixed(2)])
            ),
            elapsedSec: Math.round((Date.now() - startedAt) / 1e3),
            // switchCount 是相容欄位，計的是嘗試；影片請求換 host 另行計數，不宣稱已消費/解碼。
            switchCount: sessionSwitchCount,
            recoveryAttemptCount: sessionSwitchCount,
            observedSwitchCount,
            stallCount: sessionStallCount,
            breakerSec: Math.max(0, Math.round((switchBreakerUntil - Date.now()) / 1e3))
          };
        },
        noteSeek,
        // 相容內部名稱：現在只回傳新鮮、已辨識的影片 Transport host，不能用音訊或排名猜測。
        getLastSegmentCdn: deps.getAttributedVideoHost,
        getVideo,
        noteCdnSwitched,
        noteVideoTransport
      };
    })();
    return {
      get Watchdog() {
        return Watchdog;
      }
    };
  }
  __name(createWatchdog, "createWatchdog");

  // src/ui/trusted.mjs
  function createTrustedUI(deps) {
    const TrustedMenuUI = (() => {
      const HOST_ID = "bilicdn-trusted-menu-ui";
      const MAX_TOASTS = 3;
      const TONE_TTL = Object.freeze({ success: 3e3, info: 3e3, warning: 5e3, error: 5e3 });
      const bounded = /* @__PURE__ */ __name((value, max = 2e3) => String(value == null ? "" : value).slice(0, max), "bounded");
      const call = /* @__PURE__ */ __name((fn) => Function.call.bind(fn), "call");
      const dom = {
        create: document.createElement.bind(document),
        append: call(Node.prototype.appendChild),
        remove: Element.prototype.remove ? call(Element.prototype.remove) : (node) => {
          if (node && node.parentNode) node.parentNode.removeChild(node);
        },
        attachShadow: call(Element.prototype.attachShadow),
        addEvent: call(EventTarget.prototype.addEventListener),
        focus: HTMLElement.prototype.focus ? call(HTMLElement.prototype.focus) : () => {
        }
      };
      let host = null;
      let shadow = null;
      let toastLayer = null;
      let modalLayer = null;
      let activeModal = null;
      let activeCapability = null;
      let uiSession = null;
      let sessionRevision = 0;
      let serial = 0;
      const toastEntries = [];
      const make = /* @__PURE__ */ __name((tag, text, attrs = {}) => {
        const node = dom.create(tag);
        if (text != null) node.textContent = bounded(text, attrs.maxText || 2e3);
        if (attrs.className) node.className = attrs.className;
        if (attrs.kind) node.dataset.uiKind = attrs.kind;
        if (attrs.action) node.dataset.uiAction = attrs.action;
        if (attrs.role) node.setAttribute("role", attrs.role);
        if (attrs.ariaLabel) node.setAttribute("aria-label", bounded(attrs.ariaLabel, 200));
        return node;
      }, "make");
      const ensure = /* @__PURE__ */ __name(() => {
        if (host && shadow && host.parentNode) return true;
        try {
          host = make("div");
          host.id = HOST_ID;
          host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
          shadow = dom.attachShadow(host, { mode: "closed" });
          const style = make("style", `
                :host{all:initial;color-scheme:dark}
                *{box-sizing:border-box}
                .toasts{position:fixed;top:18px;right:18px;width:min(380px,calc(100vw - 36px));display:grid;gap:8px;pointer-events:none;font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
                .toast{border:1px solid #4b5563;border-left:4px solid #38bdf8;border-radius:8px;background:#111827;color:#f9fafb;padding:10px 12px;box-shadow:0 8px 28px #0009;white-space:pre-wrap;overflow-wrap:anywhere}
                .toast.success{border-left-color:#4ade80}.toast.warning{border-left-color:#fbbf24}.toast.error{border-left-color:#fb7185}
                .modal-layer{position:fixed;inset:0;pointer-events:none;font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
                .backdrop{position:absolute;inset:0;background:#0009;display:grid;place-items:center;padding:20px;pointer-events:auto}
                .dialog{width:min(640px,100%);max-height:min(82vh,760px);display:flex;flex-direction:column;overflow:hidden;border:1px solid #4b5563;border-radius:12px;background:#111827;color:#f9fafb;box-shadow:0 18px 64px #000c}
                .head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 18px;border-bottom:1px solid #374151}
                .title{margin:0;font-size:18px;line-height:1.35}.body{padding:16px 18px;overflow:auto;display:grid;gap:12px}
                .text{margin:0;color:#d1d5db;white-space:pre-wrap;overflow-wrap:anywhere}.detail{font-size:12px;color:#9ca3af}
                .choices{display:grid;gap:8px}.choice{width:100%;text-align:left;border:1px solid #4b5563;border-radius:8px;background:#1f2937;color:#f9fafb;padding:9px 11px;cursor:pointer}
                .choice.selected{border-color:#38bdf8;background:#0c4a6e}.choice:disabled{opacity:.55;cursor:not-allowed}
                .choice-main{display:block}.choice-detail{display:block;margin-top:2px;font-size:12px;color:#cbd5e1}
                .section-title{margin:4px 0 0;font-size:13px;color:#7dd3fc}.action-list{display:grid;gap:8px}.action-list .btn{text-align:left;padding:10px 12px}
                .report{width:100%;min-height:260px;resize:vertical;border:1px solid #4b5563;border-radius:8px;background:#030712;color:#e5e7eb;padding:10px;font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace}
                .actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;padding:13px 18px;border-top:1px solid #374151}
                button{font:inherit}.btn{border:1px solid #4b5563;border-radius:7px;background:#1f2937;color:#f9fafb;padding:7px 13px;cursor:pointer}.btn.primary{border-color:#0284c7;background:#0369a1}.btn.danger{border-color:#be123c;background:#9f1239}.btn:disabled{opacity:.45;cursor:not-allowed}
                @media(max-width:600px){.toasts{top:10px;right:10px;width:calc(100vw - 20px)}.backdrop{padding:10px}.dialog{max-height:90vh}}
                @media(prefers-reduced-motion:no-preference){.toast,.dialog{animation:biliCdnIn .14s ease-out}@keyframes biliCdnIn{from{opacity:.25;transform:translateY(-5px)}to{opacity:1;transform:none}}}
            `, { maxText: 12e3 });
          toastLayer = make("div", null, { className: "toasts", role: "status", ariaLabel: "BiliCDN 操作訊息" });
          toastLayer.setAttribute("aria-live", "polite");
          toastLayer.setAttribute("aria-atomic", "false");
          modalLayer = make("div", null, { className: "modal-layer" });
          dom.append(shadow, style);
          dom.append(shadow, toastLayer);
          dom.append(shadow, modalLayer);
          dom.addEvent(shadow, "keydown", (event) => {
            if (!event || !event.isTrusted || !activeModal) return;
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              closeDialog();
            } else if (event.key === "Tab") {
              const targets = [];
              const visit = /* @__PURE__ */ __name((node) => {
                if (!node || node.hidden || node.style?.display === "none" || node.style?.visibility === "hidden" || node.getAttribute?.("aria-hidden") === "true") return;
                const tab = node.getAttribute?.("tabindex");
                if (!node.disabled && (tab == null || Number(tab) >= 0) && (["BUTTON", "TEXTAREA", "INPUT", "SELECT"].includes(node.tagName) || tab != null && Number(tab) >= 0)) targets.push(node);
                [...node.children || []].forEach(visit);
              }, "visit");
              visit(activeModal);
              if (targets.length) {
                const focused = shadow.activeElement || document.activeElement;
                const index = targets.indexOf(focused);
                const next = index < 0 ? event.shiftKey ? targets.length - 1 : 0 : (index + (event.shiftKey ? -1 : 1) + targets.length) % targets.length;
                event.preventDefault();
                event.stopPropagation();
                dom.focus(targets[next]);
              }
            }
          });
          dom.append(document.documentElement, host);
          return true;
        } catch (e) {
          try {
            console.error("[BiliCDN] 無法建立可信選單 UI：", e);
          } catch {
          }
          host = shadow = toastLayer = modalLayer = null;
          return false;
        }
      }, "ensure");
      const removeToastEntry = /* @__PURE__ */ __name((entry) => {
        const index = toastEntries.indexOf(entry);
        if (index >= 0) toastEntries.splice(index, 1);
        if (entry.timer) clearTimeout(entry.timer);
        try {
          if (entry.node) dom.remove(entry.node);
        } catch {
        }
        entry.node = null;
      }, "removeToastEntry");
      const toast = /* @__PURE__ */ __name((message, tone = "info", options = {}) => {
        if (!ensure()) return Object.freeze({ update: /* @__PURE__ */ __name(() => {
        }, "update"), close: /* @__PURE__ */ __name(() => {
        }, "close") });
        const normalizedTone = Object.prototype.hasOwnProperty.call(TONE_TTL, tone) ? tone : "info";
        const node = make("div", bounded(message, 500), {
          className: "toast " + normalizedTone,
          kind: "toast",
          role: normalizedTone === "error" ? "alert" : "status"
        });
        dom.append(toastLayer, node);
        const entry = { node, timer: null, tone: normalizedTone };
        toastEntries.push(entry);
        while (toastEntries.length > MAX_TOASTS) removeToastEntry(toastEntries[0]);
        const arm = /* @__PURE__ */ __name(() => {
          if (entry.timer) clearTimeout(entry.timer);
          if (!options.sticky) entry.timer = setTimeout(() => removeToastEntry(entry), TONE_TTL[entry.tone]);
        }, "arm");
        arm();
        return Object.freeze({
          update(nextMessage, nextTone = entry.tone, sticky = false) {
            if (!entry.node) return;
            entry.tone = Object.prototype.hasOwnProperty.call(TONE_TTL, nextTone) ? nextTone : "info";
            entry.node.className = "toast " + entry.tone;
            entry.node.textContent = bounded(nextMessage, 500);
            options.sticky = !!sticky;
            arm();
          },
          close() {
            removeToastEntry(entry);
          }
        });
      }, "toast");
      const mintCapability = /* @__PURE__ */ __name(() => {
        try {
          if (!crypto || typeof crypto.getRandomValues !== "function") return null;
          const bytes = new Uint8Array(16);
          crypto.getRandomValues(bytes);
          return Object.freeze({ serial: ++serial, bytes });
        } catch {
          return null;
        }
      }, "mintCapability");
      const closeView = /* @__PURE__ */ __name(() => {
        activeCapability = null;
        if (activeModal) {
          try {
            dom.remove(activeModal);
          } catch {
          }
          activeModal = null;
        }
      }, "closeView");
      const restoreSessionFocus = /* @__PURE__ */ __name((session) => {
        if (!session) return;
        try {
          const video = deps.Watchdog.getVideo();
          const target = session.focus && document.contains(session.focus) ? session.focus : video && document.contains(video) ? video : document.body;
          if (!target) return;
          if (target === document.body) {
            const oldTab = target.getAttribute("tabindex");
            target.setAttribute("tabindex", "-1");
            try {
              dom.focus(target, { preventScroll: true });
            } finally {
              if (oldTab == null) target.removeAttribute("tabindex");
              else target.setAttribute("tabindex", oldTab);
            }
          } else dom.focus(target, { preventScroll: true });
        } catch {
        }
      }, "restoreSessionFocus");
      const closeDialog = /* @__PURE__ */ __name((restoreFocus = true) => {
        const session = uiSession;
        closeView();
        uiSession = null;
        sessionRevision++;
        if (restoreFocus) restoreSessionFocus(session);
      }, "closeDialog");
      const beginDialog = /* @__PURE__ */ __name(({ title, paragraphs = [], requiresCapability = false }) => {
        if (!ensure()) return null;
        if (!uiSession) {
          uiSession = { focus: document.activeElement };
          sessionRevision++;
        }
        closeView();
        const capability = requiresCapability ? mintCapability() : Object.freeze({ readOnly: true, serial: ++serial });
        if (!capability) {
          closeDialog();
          toast("安全亂數不可用，無法開啟會修改設定的對話框", "error");
          return null;
        }
        activeCapability = capability;
        const backdrop = make("div", null, { className: "backdrop", kind: "dialog", role: "presentation" });
        const panel = make("section", null, { className: "dialog", role: "dialog", ariaLabel: bounded(title, 120) });
        panel.setAttribute("aria-modal", "true");
        const head = make("div", null, { className: "head" });
        const heading = make("h2", title, { className: "title", maxText: 160 });
        const close = make("button", "關閉", { className: "btn", action: "cancel", ariaLabel: "關閉對話框" });
        close.type = "button";
        dom.addEvent(close, "click", (event) => {
          if (!event || !event.isTrusted || activeCapability !== capability) return;
          closeDialog();
        });
        dom.append(head, heading);
        dom.append(head, close);
        const body = make("div", null, { className: "body" });
        [].concat(paragraphs || []).slice(0, 24).forEach((text) => dom.append(body, make("p", text, { className: "text" })));
        const actions = make("div", null, { className: "actions" });
        dom.append(panel, head);
        dom.append(panel, body);
        dom.append(panel, actions);
        dom.append(backdrop, panel);
        dom.append(modalLayer, backdrop);
        activeModal = backdrop;
        try {
          dom.focus(close);
        } catch {
        }
        return { capability, backdrop, panel, body, actions, close };
      }, "beginDialog");
      const addAction = /* @__PURE__ */ __name((dialog, {
        label,
        action,
        tone = "",
        onActivate,
        closeOnActivate = true,
        navigateOnActivate = false
      }) => {
        const button = make("button", label, {
          className: "btn" + (tone ? " " + tone : ""),
          action,
          maxText: 100
        });
        button.type = "button";
        dom.addEvent(button, "click", (event) => {
          if (!event || !event.isTrusted || activeCapability !== dialog.capability) return;
          if (navigateOnActivate) {
            const session = uiSession;
            closeView();
            try {
              if (typeof onActivate === "function") onActivate();
            } finally {
              if (!activeModal && uiSession === session) closeDialog();
            }
            return;
          }
          if (closeOnActivate) closeDialog(true);
          if (typeof onActivate === "function") onActivate();
        });
        dom.append(dialog.actions, button);
        return button;
      }, "addAction");
      const openConfirm = /* @__PURE__ */ __name(({
        title,
        paragraphs,
        confirmLabel = "確認",
        danger = false,
        onConfirm,
        cancelLabel = "取消",
        onCancel
      }) => {
        const dialog = beginDialog({ title, paragraphs, requiresCapability: true });
        if (!dialog) return false;
        addAction(dialog, {
          label: cancelLabel,
          action: typeof onCancel === "function" ? "back" : "cancel-secondary",
          onActivate: onCancel || (() => {
          }),
          navigateOnActivate: typeof onCancel === "function"
        });
        addAction(dialog, {
          label: confirmLabel,
          action: "confirm",
          tone: danger ? "danger" : "primary",
          onActivate: /* @__PURE__ */ __name(() => {
            if (typeof onConfirm === "function") onConfirm();
          }, "onActivate")
        });
        return true;
      }, "openConfirm");
      const openChoice = /* @__PURE__ */ __name(({
        title,
        paragraphs,
        choices = [],
        multiple = false,
        selected = [],
        confirmLabel = "套用",
        onConfirm,
        secondaryLabel = "",
        onSecondary,
        cancelLabel = "取消",
        onCancel,
        navigateOnConfirm = false
      }) => {
        const dialog = beginDialog({ title, paragraphs, requiresCapability: true });
        if (!dialog) return false;
        const safeChoices = choices.slice(0, 64).map((choice) => ({
          label: bounded(choice && choice.label, 300),
          detail: bounded(choice && choice.detail, 500),
          disabled: !!(choice && choice.disabled)
        }));
        const picked = new Set([].concat(selected || []).filter((index) => Number.isInteger(index) && index >= 0 && index < safeChoices.length));
        if (!multiple && picked.size > 1) {
          const first = picked.values().next().value;
          picked.clear();
          picked.add(first);
        }
        const list = make("div", null, { className: "choices" });
        safeChoices.forEach((choice, index) => {
          const button = make("button", null, { className: "choice", action: "choice-" + index });
          button.type = "button";
          button.disabled = choice.disabled;
          const main = make("span", "", { className: "choice-main" });
          const detail = make("span", choice.detail, { className: "choice-detail" });
          const render = /* @__PURE__ */ __name(() => {
            const isPicked = picked.has(index);
            button.className = "choice" + (isPicked ? " selected" : "");
            main.textContent = (multiple ? isPicked ? "☑ " : "☐ " : isPicked ? "◉ " : "○ ") + choice.label;
          }, "render");
          render();
          dom.append(button, main);
          if (choice.detail) dom.append(button, detail);
          dom.addEvent(button, "click", (event) => {
            if (!event || !event.isTrusted || activeCapability !== dialog.capability || choice.disabled) return;
            if (multiple) {
              if (picked.has(index)) picked.delete(index);
              else picked.add(index);
            } else {
              picked.clear();
              picked.add(index);
              safeChoices.forEach((_, other) => {
                const otherButton = list.children && list.children[other];
                if (!otherButton || !otherButton.children || !otherButton.children[0]) return;
                const on = picked.has(other);
                otherButton.className = "choice" + (on ? " selected" : "");
                otherButton.children[0].textContent = (on ? "◉ " : "○ ") + safeChoices[other].label;
              });
            }
            render();
          });
          dom.append(list, button);
        });
        dom.append(dialog.body, list);
        addAction(dialog, {
          label: cancelLabel,
          action: typeof onCancel === "function" ? "back" : "cancel-secondary",
          onActivate: onCancel || (() => {
          }),
          navigateOnActivate: typeof onCancel === "function"
        });
        if (secondaryLabel && typeof onSecondary === "function") {
          addAction(dialog, { label: secondaryLabel, action: "secondary", onActivate: onSecondary });
        }
        addAction(dialog, {
          label: confirmLabel,
          action: "confirm",
          tone: "primary",
          onActivate: /* @__PURE__ */ __name(() => {
            if (typeof onConfirm === "function") onConfirm([...picked].sort((a, b) => a - b));
          }, "onActivate"),
          navigateOnActivate: navigateOnConfirm
        });
        return true;
      }, "openChoice");
      const openText = /* @__PURE__ */ __name(({
        title,
        paragraphs,
        text = "",
        copyLabel = "",
        onCopy,
        actionLabel = "",
        onAction,
        closeLabel = "關閉",
        onClose
      }) => {
        const hasAction = !!actionLabel && typeof onAction === "function";
        const dialog = beginDialog({ title, paragraphs, requiresCapability: hasAction });
        if (!dialog) return false;
        const area = make("textarea", bounded(text, 48 * 1024), { action: "manual-copy-text", maxText: 48 * 1024 });
        area.className = "report";
        area.value = bounded(text, 48 * 1024);
        area.readOnly = true;
        area.setAttribute("readonly", "");
        dom.append(dialog.body, area);
        addAction(dialog, {
          label: closeLabel,
          action: typeof onClose === "function" ? "back" : "cancel-secondary",
          onActivate: onClose || (() => {
          }),
          navigateOnActivate: typeof onClose === "function"
        });
        if (copyLabel && typeof onCopy === "function") {
          addAction(dialog, {
            label: copyLabel,
            action: "copy",
            tone: "primary",
            onActivate: onCopy,
            closeOnActivate: false
          });
        }
        if (hasAction) {
          addAction(dialog, {
            label: actionLabel,
            action: "text-action",
            onActivate: onAction,
            navigateOnActivate: true
          });
        }
        return true;
      }, "openText");
      const openActions = /* @__PURE__ */ __name(({ title, paragraphs, items = [] }) => {
        const dialog = beginDialog({ title, paragraphs, requiresCapability: true });
        if (!dialog) return false;
        const list = make("div", null, { className: "action-list" });
        items.slice(0, 16).forEach((item) => {
          const button = make("button", item.label, { className: "btn", action: item.action, maxText: 120 });
          button.type = "button";
          dom.addEvent(button, "click", (event) => {
            if (!event || !event.isTrusted || activeCapability !== dialog.capability) return;
            const session = uiSession;
            closeView();
            try {
              if (typeof item.onActivate === "function") item.onActivate();
            } finally {
              if (!activeModal && uiSession === session) closeDialog();
            }
          });
          dom.append(list, button);
        });
        dom.append(dialog.body, list);
        addAction(dialog, { label: "關閉", action: "cancel-secondary", onActivate: /* @__PURE__ */ __name(() => {
        }, "onActivate") });
        return true;
      }, "openActions");
      const openRouting = /* @__PURE__ */ __name(({
        title,
        paragraphs,
        routes = [],
        fixedSelected = 0,
        catalogSelected = [],
        onConfirm,
        onDefaults,
        backLabel = "取消",
        onBack
      }) => {
        const dialog = beginDialog({ title, paragraphs, requiresCapability: true });
        if (!dialog) return false;
        let routeIndex = Number.isInteger(fixedSelected) ? fixedSelected : 0;
        const enabled = new Set([].concat(catalogSelected || []).filter(Number.isInteger));
        const routeList = make("div", null, { className: "choices" });
        dom.append(dialog.body, make("h3", "模式與固定節點", { className: "section-title" }));
        routes.slice(0, 64).forEach((route, index) => {
          const button = make("button", null, { className: "choice", action: "route-" + index });
          button.type = "button";
          const main = make("span", "", { className: "choice-main" });
          const detail = make("span", route.detail || "", { className: "choice-detail" });
          const render = /* @__PURE__ */ __name(() => {
            const selected = routeIndex === index;
            button.className = "choice" + (selected ? " selected" : "");
            main.textContent = (selected ? "◉ " : "○ ") + bounded(route.label, 300);
          }, "render");
          render();
          dom.append(button, main);
          if (route.detail) dom.append(button, detail);
          dom.addEvent(button, "click", (event) => {
            if (!event || !event.isTrusted || activeCapability !== dialog.capability) return;
            routeIndex = index;
            [...routeList.children || []].forEach((node, other) => {
              if (!node.children || !node.children[0]) return;
              const selected = other === routeIndex;
              node.className = "choice" + (selected ? " selected" : "");
              node.children[0].textContent = (selected ? "◉ " : "○ ") + bounded(routes[other].label, 300);
            });
          });
          dom.append(routeList, button);
        });
        dom.append(dialog.body, routeList);
        dom.append(dialog.body, make("h3", "自動選路候選", { className: "section-title" }));
        const catalogList = make("div", null, { className: "choices" });
        routes.slice(1, 65).forEach((route, index) => {
          const button = make("button", null, { className: "choice", action: "catalog-" + index });
          button.type = "button";
          const main = make("span", "", { className: "choice-main" });
          const detail = make("span", route.detail || "", { className: "choice-detail" });
          const render = /* @__PURE__ */ __name(() => {
            const selected = enabled.has(index);
            button.className = "choice" + (selected ? " selected" : "");
            main.textContent = (selected ? "☑ " : "☐ ") + bounded(route.label, 300);
          }, "render");
          render();
          dom.append(button, main);
          if (route.detail) dom.append(button, detail);
          dom.addEvent(button, "click", (event) => {
            if (!event || !event.isTrusted || activeCapability !== dialog.capability) return;
            if (enabled.has(index)) enabled.delete(index);
            else enabled.add(index);
            render();
          });
          dom.append(catalogList, button);
        });
        dom.append(dialog.body, catalogList);
        addAction(dialog, {
          label: backLabel,
          action: typeof onBack === "function" ? "back" : "cancel-secondary",
          onActivate: onBack || (() => {
          }),
          navigateOnActivate: typeof onBack === "function"
        });
        if (typeof onDefaults === "function") addAction(dialog, {
          label: "恢復自動預設",
          action: "routing-defaults",
          onActivate: onDefaults,
          closeOnActivate: false
        });
        addAction(dialog, {
          label: "套用",
          action: "confirm",
          tone: "primary",
          onActivate: /* @__PURE__ */ __name(() => {
            if (typeof onConfirm === "function") onConfirm({ routeIndex, enabled: [...enabled].sort((a, b) => a - b) });
          }, "onActivate"),
          closeOnActivate: false
        });
        return true;
      }, "openRouting");
      const invalidate = /* @__PURE__ */ __name(({ clearToasts = true } = {}) => {
        closeDialog(false);
        activeCapability = null;
        serial++;
        if (clearToasts) [...toastEntries].forEach(removeToastEntry);
      }, "invalidate");
      const captureContext = /* @__PURE__ */ __name(() => ({ revision: sessionRevision, serial }), "captureContext");
      const isContextCurrent = /* @__PURE__ */ __name((context) => !!context && context.revision === sessionRevision && context.serial === serial, "isContextCurrent");
      return Object.freeze({
        toast,
        openConfirm,
        openChoice,
        openText,
        openActions,
        openRouting,
        closeDialog,
        invalidate,
        captureContext,
        isContextCurrent
      });
    })();
    return {
      get TrustedMenuUI() {
        return TrustedMenuUI;
      }
    };
  }
  __name(createTrustedUI, "createTrustedUI");

  // src/diagnostics/report.mjs
  function createReport(deps) {
    const getPageTypeLabel = /* @__PURE__ */ __name(() => {
      const path = location.pathname;
      const m = path.match(/^\/([a-z]+)(?:\/([a-z]+))?/);
      if (!m) return path || "/";
      return "/" + [m[1], m[2]].filter(Boolean).join("/");
    }, "getPageTypeLabel");
    let readDiagnosticHidden = /* @__PURE__ */ __name(() => null, "readDiagnosticHidden");
    const readPlaybackDiagnostic = /* @__PURE__ */ __name((v) => {
      const out = {
        available: false,
        valid: false,
        paused: null,
        seeking: null,
        ended: null,
        readyState: null,
        networkState: null,
        currentTime: null,
        duration: null,
        bufferAheadSec: null,
        errorCode: null,
        hidden: null,
        observedRate: deps.playbackRateState.observedRate,
        effectiveRate: deps.playbackRateState.effectiveRate
      };
      try {
        out.hidden = readDiagnosticHidden();
        if (v === void 0) v = deps.Watchdog.getVideo();
        if (!v) return out;
        out.available = true;
        for (const key of ["paused", "seeking", "ended"]) out[key] = typeof v[key] === "boolean" ? v[key] : null;
        for (const key of ["readyState", "networkState", "currentTime", "duration"]) {
          const value = v[key];
          out[key] = typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
        }
        const error = v.error;
        out.errorCode = !error ? 0 : Number.isInteger(error.code) && error.code >= 1 && error.code <= 4 ? error.code : null;
        if (out.currentTime === null || !v.buffered) return out;
        let end = out.currentTime;
        for (let i = 0; i < v.buffered.length; i++) {
          const a = v.buffered.start(i), b = v.buffered.end(i);
          if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return out;
          if (out.currentTime >= a - 0.05 && out.currentTime <= b + 0.05) {
            end = b;
            break;
          }
        }
        out.bufferAheadSec = Math.max(0, end - out.currentTime);
        out.valid = out.paused !== null && out.seeking !== null && out.ended !== null && Number.isInteger(out.readyState) && out.readyState <= 4 && out.errorCode !== null;
      } catch {
        deps.DiagnosticLog.fault("snapshot");
      }
      return out;
    }, "readPlaybackDiagnostic");
    const buildDiagReport = /* @__PURE__ */ __name(() => {
      const buffer = deps.Watchdog.stats();
      const httpDns = deps.getHttpDnsStatus();
      const native = deps.getNativeRouteDiagnostics();
      const routeHost = native.currentHost ? native.currentHost.split(".")[0] : "（無新鮮後態）";
      const lines = [
        "[BiliCDN_TW 診斷報告]",
        "版本：" + deps.VERSION,
        "頁面型態：" + getPageTypeLabel(),
        "UA：" + navigator.userAgent,
        "面板注入狀態：" + deps.uiInjectStatus,
        "停用狀態：" + deps.disabled,
        "候選順序：" + (deps.activeCdnList.map((c) => c.split(".")[0]).join(" > ") || "（無）"),
        "真正可選節點：" + (deps.getHealthyCdnList().map((c) => c.split(".")[0]).join(" > ") || "（無）"),
        "黑名單（24h）：" + ([...deps.blacklistSet].map((c) => c.split(".")[0]).join(", ") || "（無）"),
        "持久死節點：" + (deps.listDeadHosts().map((e) => e.host.split(".")[0] + "(" + e.reason + "，剩 " + e.daysLeft + "d)").join(", ") || "（無）"),
        "目前請求路線：" + native.currentRouteType + "｜" + routeHost + "（Route Plan 不等於播放器已成功使用）",
        "Catalog 改寫建議：" + deps.getCdnShortName(),
        "目前 representation：" + (native.active ? JSON.stringify(native.active) : "未確認") + "｜tentative=" + (native.tentative ? JSON.stringify(native.tentative) : "無") + "｜routeRevision=" + native.routeRevision,
        "Native Route：當前群組=" + native.groupNativeCount + "｜狀態=" + JSON.stringify(native.counts) + "｜Ledger=" + JSON.stringify(native.ledger),
        "最近 bakeoff 路線結果：" + JSON.stringify(native.lastBakeoff) + "｜自動畫質原因=" + native.autoQualityReason,
        ...["video", "audio"].map((kind) => {
          const entry = deps.getMediaDeliverySnapshot()[kind];
          return (kind === "video" ? "最近影片 CDN：" : "最近音訊 CDN：") + (entry.fresh ? entry.host ? entry.host.split(".")[0] : entry.classification : "無新鮮資料") + "（觀察到的請求；來源=" + entry.source + "；年齡=" + (entry.ageSec == null ? "無資料" : entry.ageSec + "秒") + "）";
        }),
        deps.describePlaybackBuffer(buffer),
        "累計下載（非目前緩衝）：" + buffer.totalMB + " MB",
        "播放倍速：" + deps.playbackRateState.effectiveRate + "x（" + (deps.playbackRateState.confirmed ? "已確認" : "假定") + "，來源=" + deps.playbackRateState.source + "）",
        "Codec 偏好：" + deps.resolvedVideoCodecPreference + "；最近排序首位=" + JSON.stringify(deps.lastCodecDecision.groups),
        "目前配置能力（非硬解證明）：" + JSON.stringify(deps.getCurrentCodecDiagnostics()),
        "串流估計（觀察到的 representation）：" + JSON.stringify(deps.streamEstimate),
        "播放影格（自本次觀察起；唯讀）：" + (deps.playbackQualitySnapshot.available ? JSON.stringify(deps.playbackQualitySnapshot) : "無資料"),
        "頁面發現 CDN：" + (deps.pageDiscoveredCdn ? deps.pageDiscoveredCdn.split(".")[0] : "（無）"),
        "改寫統計：" + JSON.stringify(deps.redirectStats),
        "HTTPDNS：" + httpDns.mode + (httpDns.ttlMin ? "（" + httpDns.ttlMin + "m）" : "")
      ];
      const history = deps.DiagnosticLog.snapshot();
      lines.splice(
        5,
        0,
        "Verbose：" + (deps.Config.verbose ? "已開啟" : "已關閉") + "；" + (history.persisted === true ? "設定已確認儲存" : "本分頁已套用，未確認儲存"),
        "紀錄：僅本分頁記憶體，重整清空；起點=" + history.startedAt + "；Verbose 最近切換=" + history.verboseChangedAt,
        "播放器現況：" + JSON.stringify(readPlaybackDiagnostic()),
        "Watchdog 決策：" + JSON.stringify(history.decision),
        "Watchdog 統計（修復嘗試不等於已換路；影片換 host 只代表觀察到的請求）：" + JSON.stringify({
          switchCount: buffer.switchCount,
          recoveryAttemptCount: buffer.recoveryAttemptCount,
          observedSwitchCount: buffer.observedSwitchCount,
          stallCount: buffer.stallCount,
          breakerSec: buffer.breakerSec
        }),
        "紀錄容量：" + JSON.stringify({
          evicted: history.evicted,
          expired: history.expired,
          rejected: history.rejected,
          pendingEvicted: history.pendingEvicted,
          recorderFailures: history.failures
        })
      );
      const limit = 64 * 1024, reserve = 256;
      let text = lines.join("\n"), omitted = 0;
      if (deps.DiagnosticLog.size(text) > limit / 2) {
        text = text.slice(0, 8e3);
        omitted++;
      }
      const append = /* @__PURE__ */ __name((line) => {
        if (deps.DiagnosticLog.size(text) + deps.DiagnosticLog.size(line) + 1 > limit - reserve) {
          omitted++;
          return;
        }
        text += "\n" + line;
      }, "append");
      append("近期關鍵事件（新到舊）：");
      history.critical.slice().reverse().forEach((e) => append(JSON.stringify(e)));
      append("等待中的請求（非完整網路面板；不包含已脫離 generation 的請求）：");
      history.pending.forEach((e) => append(JSON.stringify(e)));
      append("Verbose 近期細節（新到舊；開啟前未收集的細節無法補回）：");
      history.detail.slice().reverse().forEach((e) => append(JSON.stringify(e)));
      return text + "\n匯出截斷：" + (omitted ? omitted + " 筆／區段未匯出" : "無");
    }, "buildDiagReport");
    return {
      get readDiagnosticHidden() {
        return readDiagnosticHidden;
      },
      set readDiagnosticHidden(value) {
        readDiagnosticHidden = value;
      },
      get readPlaybackDiagnostic() {
        return readPlaybackDiagnostic;
      },
      get buildDiagReport() {
        return buildDiagReport;
      }
    };
  }
  __name(createReport, "createReport");

  // src/runtime/controls.mjs
  function createControls(deps) {
    const controlResult = /* @__PURE__ */ __name((ok, status, message, data = null) => Object.freeze({
      ok: !!ok,
      status: String(status || (ok ? "ok" : "error")).slice(0, 48),
      message: String(message || "").slice(0, 500),
      data
    }), "controlResult");
    const copyDiagReport = /* @__PURE__ */ __name(async () => {
      const uiContext = deps.TrustedMenuUI.captureContext();
      const valid = /* @__PURE__ */ __name(() => deps.TrustedMenuUI.isContextCurrent(uiContext), "valid");
      const cancelled = /* @__PURE__ */ __name(() => controlResult(false, "cancelled", "原操作視窗已結束"), "cancelled");
      const text = deps.buildDiagReport();
      const viaGm = /* @__PURE__ */ __name(() => new Promise((resolve, reject) => {
        if (typeof GM_setClipboard !== "function") return reject(new Error("GM_setClipboard unavailable"));
        let settled = false;
        let timer = null;
        const done = /* @__PURE__ */ __name((ok, error) => {
          if (settled) return;
          settled = true;
          if (timer) clearTimeout(timer);
          if (ok) resolve(true);
          else reject(error || new Error("GM_setClipboard failed"));
        }, "done");
        try {
          const returned = GM_setClipboard(text, { type: "text", mimetype: "text/plain" }, () => done(true));
          if (returned && typeof returned.then === "function") returned.then(() => done(true), (error) => done(false, error));
          if (!settled) timer = setTimeout(() => done(false, new Error("GM_setClipboard callback timeout")), 1500);
        } catch (error) {
          done(false, error);
        }
      }), "viaGm");
      try {
        await viaGm();
        if (!valid()) return cancelled();
        deps.TrustedMenuUI.toast("診斷報告已複製到剪貼簿", "success");
        return controlResult(true, "copied-gm", "診斷報告已複製", { method: "gm" });
      } catch (gmError) {
        if (!valid()) return cancelled();
        deps.DiagnosticLog.fault("clipboard-gm");
        try {
          if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") throw gmError;
          await navigator.clipboard.writeText(text);
          if (!valid()) return cancelled();
          deps.TrustedMenuUI.toast("診斷報告已複製到剪貼簿", "success");
          return controlResult(true, "copied-navigator", "診斷報告已複製", { method: "navigator" });
        } catch (clipboardError) {
          if (!valid()) return cancelled();
          deps.DiagnosticLog.fault("clipboard-standard");
          const fallbackText = deps.buildDiagReport();
          deps.log(fallbackText);
          deps.TrustedMenuUI.openText({
            title: "手動複製診斷報告",
            paragraphs: ["自動寫入剪貼簿被瀏覽器拒絕。請在下方文字框按 Ctrl+A、Ctrl+C。"],
            text: fallbackText
          });
          return controlResult(false, "manual-copy", "請在視窗中手動複製", { method: "manual" });
        }
      }
    }, "copyDiagReport");
    const BiliCDNControls = {
      diag() {
        try {
          console.log(deps.buildDiagReport());
        } catch {
        }
        return {
          active: [...deps.activeCdnList],
          black: [...deps.blacklistSet],
          soft: Object.fromEntries(Object.entries(deps.cdnSoftBlockUntil).filter(([cdn]) => deps.isCdnSoftBlocked(cdn))),
          dead: deps.listDeadHosts(),
          // 已知在台灣不解析、但還沒有實測證據可以標死的節點。它們不會被選路、
          // 不會進 backup_url、不會被賽馬碰到，但也還沒被判死刑。
          presumed: deps.PREFERRED_CDN_LIST.filter(deps.isPresumedDnsFailHost),
          fail: { ...deps.cdnFailCount },
          health: Object.fromEntries(
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
              av1_1080: deps.getCodecCapabilityState("av1", 1080),
              av1_2160: deps.getCodecCapabilityState("av1", 2160),
              hevc_1080: deps.getCodecCapabilityState("hevc", 1080),
              hevc_2160: deps.getCodecCapabilityState("hevc", 2160)
            },
            groups: deps.lastCodecDecision.groups.map((group) => ({ ...group }))
          },
          verbose: deps.Config.verbose,
          redirects: { ...deps.redirectStats },
          discovered: deps.pageDiscoveredCdn,
          httpdns: deps.getHttpDnsStatus(),
          uiInjectStatus: deps.uiInjectStatus
        };
      },
      // 診斷報告一鍵複製（改進工單 F）：回報問題時直接貼給開發者，省掉來回追問。
      // 不含完整影片網址／cookie／IP，只有 host 與統計數字。
      report() {
        return copyDiagReport();
      },
      // 注意：這是**改寫統計**，不是 Watchdog 的播放統計。換節點次數 / 卡頓次數 /
      // 斷路器狀態在內部 buffer 診斷；改寫統計與播放統計是不同入口。
      stats() {
        console.log(
          "[BiliCDN] 改寫統計:",
          deps.redirectStats,
          "| HTTPDNS:",
          deps.getHttpDnsStatus(),
          "| 頁面 CDN:",
          deps.pageDiscoveredCdn ? deps.pageDiscoveredCdn.split(".")[0] : "—"
        );
        console.log("（換節點/卡頓/斷路器已包含在「顯示診斷資訊」輸出）");
        return { ...deps.redirectStats, pageDiscoveredCdn: deps.pageDiscoveredCdn, httpdns: deps.getHttpDnsStatus() };
      },
      // 手動觸發吞吐量賽馬（用最近一次播放抓到的真實 segment）；忽略冷卻
      async bakeoff() {
        if (deps.disabled) return controlResult(false, "disabled", "CDN 改寫目前已停用");
        if (deps.resolvedCdn) return controlResult(false, "fixed-cdn", "目前使用固定 CDN；恢復自動選路後才能測速選節點");
        if (!deps.lastSampleSegmentUrl) return controlResult(false, "no-sample", "尚無 segment 樣本，請先播放影片數秒");
        if (deps.inSeekGrace()) return controlResult(false, "seek-grace", "正在 seek 保護期，請稍候再測速");
        if (deps.bakeoffRunning) return controlResult(false, "running", "已有一輪測速正在進行");
        const now = Date.now();
        if (now - (deps.trustedBakeoffLastAt.menu || 0) < deps.TRUSTED_BAKEOFF_MIN_GAP.menu) {
          return controlResult(false, "cooldown", "手動測速冷卻中，請 5 秒後再試");
        }
        console.log("[BiliCDN] 開始吞吐量賽馬…（約 1~5 秒）");
        const round = await deps.runThroughputBakeoff(deps.lastSampleSegmentUrl, false, deps.trustedBakeoffRequest("menu"));
        const samples = Object.entries(deps.cdnHealth).filter(([host, h]) => h.samples > 0 && round?.outcomes?.some((r) => r.host === host && r.accepted)).slice(0, deps.TRUSTED_CDN_CATALOG.length).map(([host, h]) => ({
          host,
          mbps: +h.ewmaMbps.toFixed(2),
          score: +deps.getCdnHealthScore(host).toFixed(2)
        }));
        console.log("[BiliCDN] 賽馬結果:", samples, "| 目前最佳:", deps.getCdnShortName());
        const status = round?.status || (deps.disabled ? "cancelled" : deps.isHostLockedStream(deps.lastSampleSegmentUrl) ? "forbidden" : "unavailable");
        const messages = {
          "latency-only": "僅取得延遲；資料量或傳輸時間不足，不計吞吐樣本",
          forbidden: "串流拒絕換 host（403），保留原始網址",
          cancelled: "測速已取消，未提交過期結果",
          failed: "本輪未取得有效吞吐樣本",
          "no-candidates": "本輪沒有可量測候選",
          unavailable: "本輪無法開始；可能正由其他分頁測速"
        };
        return controlResult(
          status === "completed" || status === "latency-only",
          status,
          status === "completed" ? "測速完成；目前最佳：" + deps.getCdnShortName() : messages[status] || messages.failed,
          {
            best: deps.getCdnShortName(),
            samples
          }
        );
      },
      verbose(on) {
        if (typeof on !== "boolean") {
          console.log(
            "[BiliCDN] Verbose =",
            deps.Config.verbose,
            "\n請由控制中心「進階」切換"
          );
          return controlResult(true, "current", "Verbose 目前" + (deps.Config.verbose ? "已開啟" : "已關閉"), {
            enabled: deps.Config.verbose
          });
        }
        deps.Config.verbose = on;
        let persisted = null;
        try {
          GM_setValue("verbose", on);
          try {
            persisted = GM_getValue("verbose") === on;
            if (!persisted) deps.DiagnosticLog.record("settings-verify", {}, true);
          } catch {
            deps.DiagnosticLog.record("settings-verify", {}, true);
          }
        } catch {
          persisted = false;
          deps.DiagnosticLog.record("settings-write", {}, true);
        }
        deps.DiagnosticLog.verbose(persisted);
        const message = "Verbose 已" + (on ? "開啟" : "關閉") + (persisted === true ? "，設定已確認儲存" : "；本分頁已套用，未確認儲存，重整後可能失效");
        deps.log(message);
        return controlResult(
          persisted === true,
          persisted === true ? on ? "enabled" : "disabled" : "applied-session-only",
          message,
          { enabled: on, persisted }
        );
      },
      reset() {
        deps.clearBlacklist();
        deps.clearDeadHosts();
        Object.keys(deps.cdnFailCount).forEach((k) => delete deps.cdnFailCount[k]);
        Object.keys(deps.cdnHealth).forEach((k) => delete deps.cdnHealth[k]);
        try {
          GM_setValue(deps.CDN_HEALTH_KEY, "{}");
        } catch {
        }
        deps.lastChosenCdn = null;
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
          quietRedirects: 0
        });
        deps.HttpDnsAutoPilot.reset();
        deps.hostLockedStreams.clear();
        deps.preservedOriginalStreamUrls.clear();
        deps.rewrittenStreamOrigins.clear();
        deps.clearNativeRouteLedger();
        deps.pageDiscoveredCdn = null;
        try {
          GM_deleteValue(deps.PROBE_CACHE_KEY);
        } catch {
        }
        deps.Watchdog.reset();
        deps.log("已重置：黑名單、軟隔離、持久死節點、失敗計數、健康分數、probe 快取、改寫統計、Watchdog");
        return controlResult(true, "reset", "所有學習狀態已重置");
      },
      httpdns(mode) {
        if (mode === void 0) {
          const status = deps.getHttpDnsStatus();
          console.group("[BiliCDN] HTTPDNS AutoPilot");
          console.log("模式:", status.mode, "| 目前阻擋:", status.block);
          if (status.ttlMin) console.log("剩餘:", status.ttlMin + " 分鐘");
          if (status.reason) console.log("原因:", status.reason);
          if (status.networkKey) console.log("網路鍵:", status.networkKey);
          if (status.scores) {
            console.log(
              "評分 block≈",
              status.scores.block,
              "(" + status.scores.blockSamples + " 次)",
              "| allow≈",
              status.scores.allow,
              "(" + status.scores.allowSamples + " 次)"
            );
            if (status.scores.trial != null) console.log("短測分數:", status.scores.trial);
          }
          console.log("HTTPDNS 模式請由檔頭 BlockHttpDNS 設定後重新載入");
          console.groupEnd();
          return status;
        }
        if (mode !== true && mode !== false && mode !== "auto") {
          console.log("HTTPDNS 模式請由檔頭 BlockHttpDNS 設定後重新載入");
          return deps.getHttpDnsStatus();
        }
        return deps.setHttpDnsMode(mode);
      },
      // 手動重跑延遲探測（force：忽略 2 小時快取與起播讓路；presumed 節點仍刻意略過）。
      // 程式碼註解與 CHANGELOG 都提到過這個入口，但先前並沒有真的實作出來。
      // 使用者明確要求的手動探測：忽略 2 小時快取與起播讓路，重新量一次所有**可用**節點。
      // 不會去打 presumed 節點（已知在台灣不可用的那幾台）——那一發請求換不到任何能用來
      // 做決定的資訊（no-cors 讀不到狀態碼），只會在 console 留一行紅字。它們的狀態改用
      // 已知資訊列出來，並告知唯一真正能翻案的作法。
      async probe() {
        if (deps.disabled) return controlResult(false, "disabled", "CDN 改寫目前已停用");
        if (deps.resolvedCdn) return controlResult(false, "fixed-cdn", "目前使用固定 CDN；恢復自動選路後才能重新排序");
        if (deps.reorderRunning) return controlResult(false, "running", "延遲探測已在進行中");
        const now = Date.now();
        if (now - (this._lastManualProbeAt || 0) < 1e4) {
          console.log("[BiliCDN] 手動探測冷卻中，請稍候再試");
          return controlResult(false, "cooldown", "手動延遲探測冷卻中，請 10 秒後再試");
        }
        this._lastManualProbeAt = now;
        try {
          GM_deleteValue(deps.PROBE_CACHE_KEY);
        } catch {
        }
        await deps.reorderCdnsByLatency(true);
        const order = [...deps.activeCdnList].slice(0, deps.TRUSTED_CDN_CATALOG.length);
        console.log("[BiliCDN] 探測完成，候選順序：", order.map((c) => c.split(".")[0]));
        const skipped = deps.PREFERRED_CDN_LIST.filter(deps.isPresumedDnsFailHost);
        if (skipped.length) {
          const dead = deps.listDeadHosts();
          console.log(
            "[BiliCDN] 以下節點已知在台灣不可用，本次未探測（避免無謂的失敗請求）：",
            Object.fromEntries(skipped.map((c) => {
              const d = dead.find((x) => x.host === c);
              return [c.split(".")[0], d ? d.reason + "，剩 " + d.daysLeft + "d" : "預設清單推定"];
            }))
          );
        }
        return controlResult(
          true,
          order.length ? "completed" : "no-candidates",
          order.length ? "延遲探測完成；目前最佳：" + deps.getCdnShortName() : "沒有可探測候選",
          {
            best: deps.getCdnShortName(),
            order,
            skipped: skipped.slice(0, deps.TRUSTED_CDN_CATALOG.length)
          }
        );
      },
      clearDead() {
        deps.clearDeadHosts();
        return this.diag();
      },
      // 內部精準救回單一被誤殺節點；對外只由可信 Tampermonkey 編號選單呼叫。
      revive(host) {
        if (!host) {
          console.log("請使用控制中心「節點維護 → 救回單一 dead catalog 節點」");
          return controlResult(false, "missing-host", "請先選擇要救回的節點");
        }
        const shortOf = /* @__PURE__ */ __name((c) => c.split(".")[0], "shortOf");
        const codeOf = /* @__PURE__ */ __name((c) => shortOf(c).replace(/^upos-(sz|hz)-mirror/, ""), "codeOf");
        const full = deps.TRUSTED_CDN_CATALOG.find((c) => c === host || shortOf(c) === host || codeOf(c) === host);
        if (!full || !deps.TRUSTED_CDN_CATALOG_SET.has(full)) {
          console.warn("[BiliCDN] 找不到符合的 catalog 節點：" + host);
          return controlResult(false, "invalid-host", "選擇的節點不在可信 catalog");
        }
        if (!deps.knownDeadHosts.has(full)) return controlResult(false, "not-dead", "該節點目前不在 dead 清單");
        deps.reviveDeadHost(full);
        deps.promoteBestCdnNow();
        console.log("[BiliCDN] 已救回：" + full);
        return controlResult(true, "revived", "已救回：" + full, { host: full });
      },
      clearSoft() {
        const cleared = Object.keys(deps.cdnSoftBlockUntil).filter(deps.isCdnSoftBlocked).length;
        Object.keys(deps.cdnSoftBlockUntil).forEach((c) => delete deps.cdnSoftBlockUntil[c]);
        Object.values(deps.cdnHealth).forEach((h) => {
          h.softBlocks = 0;
          h.lastSoftBlockAt = 0;
          h.lastSoftBlockReason = "";
        });
        deps.scheduleCdnHealthSave();
        deps.promoteBestCdnNow();
        return controlResult(
          true,
          cleared ? "cleared" : "empty",
          cleared ? "已清除 " + cleared + " 個 soft block" : "目前沒有 soft block",
          { cleared }
        );
      },
      dead() {
        try {
          const raw = JSON.parse(GM_getValue(deps.DEAD_HOSTS_KEY) || "[]");
          console.group("[BiliCDN] 持久死節點清單");
          raw.forEach((e) => {
            const leftMs = e.expireAt - Date.now();
            const leftH = Math.max(0, Math.round(leftMs / 36e5));
            console.log(e.host.split(".")[0] + "  reason=" + e.reason + "  剩餘 " + leftH + "h");
          });
          console.groupEnd();
          return raw;
        } catch {
          return [];
        }
      },
      setCdn(host) {
        if (host == null) host = "";
        host = String(host).trim().toLowerCase();
        if (!host || host === "null") {
          GM_deleteValue("CustomCDN");
          console.log("[BiliCDN] 已清除固定 CDN（重整頁面生效）");
          return controlResult(true, "auto", "已恢復自動選路；重新載入後生效", { host: null });
        }
        if (!deps.isValidCustomCdnHost(host)) {
          console.error("[BiliCDN] [安全] 拒絕設定：「" + host + "」不在可信 CDN catalog");
          return controlResult(false, "invalid-host", "拒絕設定：節點不在可信 catalog");
        }
        GM_setValue("CustomCDN", host);
        console.log("[BiliCDN] 已固定 CDN 為 " + host + "（重整頁面生效）");
        return controlResult(true, "fixed", "已固定 CDN；重新載入後生效", { host });
      },
      buf() {
        const s = deps.Watchdog.stats();
        console.group("[BiliCDN] 緩衝狀態");
        console.log(
          "累計下載:",
          s.totalMB + "MB / " + s.targetMB + "MB",
          s.reachedTarget ? "✓ 已達標" : "⌛ 未達標"
        );
        console.log(
          "buffer ahead:",
          s.bufferAheadSec + "s | buffered end:",
          s.bufferedEndSec + "s | currentTime:",
          s.videoTimeSec + "s",
          "| readyState:",
          s.readyState,
          "| paused:",
          s.paused
        );
        console.log("各 CDN 下載量:", s.perCdnMB);
        console.log("各 CDN 速度:", s.perCdnMbps);
        console.log("最低需求 Mbps:", s.requiredMbps);
        console.log("各 CDN 評分:", s.cdnScore);
        console.log("已運行:", s.elapsedSec + "s");
        console.log(
          "換節點次數:",
          s.switchCount,
          "| 卡頓判定次數:",
          s.stallCount,
          "| 換節點斷路器:",
          s.breakerSec > 0 ? "已跳脫，" + s.breakerSec + "s 後恢復（換也沒用，瓶頸在頻寬/碼率/跨境線路）" : "未跳脫"
        );
        console.groupEnd();
        return s;
      },
      watchdog: {
        start: /* @__PURE__ */ __name(() => deps.Watchdog.start(), "start"),
        stop: /* @__PURE__ */ __name(() => deps.Watchdog.stop(), "stop"),
        // 跟 SPA 換片時的處理方式一致：Watchdog.reset() 會讓累計位元組歸零，若當下
        // HTTPDNS AutoPilot 正在 trial-allow，沒有同步通知它就會拿舊的大 baseline
        // 對歸零後的小 sample 相減，trial 被誤判失敗——見 onWatchdogReset 註解。
        reset: /* @__PURE__ */ __name(() => {
          deps.Watchdog.reset();
          try {
            deps.HttpDnsAutoPilot.onWatchdogReset();
          } catch {
          }
        }, "reset")
      },
      // 動態排除/恢復 host 關鍵字（即時生效不需重整）
      exclude(kw) {
        if (!kw || typeof kw !== "string") {
          console.log("請使用控制中心「CDN 選路」");
          return [...deps.ExcludeHostKeywords];
        }
        if (!deps.ExcludeHostKeywords.includes(kw)) deps.ExcludeHostKeywords.push(kw);
        deps.rebuildPreferredCdnList();
        for (let i = deps.activeCdnList.length - 1; i >= 0; i--) {
          if (!deps.PREFERRED_CDN_LIST.includes(deps.activeCdnList[i])) deps.activeCdnList.splice(i, 1);
        }
        if (deps.lastChosenCdn && !deps.PREFERRED_CDN_LIST.includes(deps.lastChosenCdn)) deps.lastChosenCdn = null;
        if (deps.pageDiscoveredCdn && deps.matchesExclude(deps.pageDiscoveredCdn)) deps.pageDiscoveredCdn = null;
        try {
          GM_deleteValue(deps.PROBE_CACHE_KEY);
        } catch {
        }
        deps.log("已加入排除：" + kw + "，剩餘：" + deps.activeCdnList.map((c) => c.split(".")[0]).join(", "));
        return [...deps.ExcludeHostKeywords];
      },
      include(kw) {
        const idx = deps.ExcludeHostKeywords.indexOf(kw);
        if (idx === -1) {
          deps.log("排除清單中沒有：" + kw);
          return [...deps.ExcludeHostKeywords];
        }
        deps.ExcludeHostKeywords.splice(idx, 1);
        deps.rebuildPreferredCdnList();
        deps.PREFERRED_CDN_LIST.forEach((h) => {
          if (!deps.activeCdnList.includes(h) && !deps.blacklistSet.has(h) && !deps.knownDeadHosts.has(h)) {
            deps.activeCdnList.push(h);
          }
        });
        const ranked = deps.getHealthyCdnList();
        if (ranked.length) {
          const rest = deps.activeCdnList.filter((h) => !ranked.includes(h));
          deps.activeCdnList.splice(0, deps.activeCdnList.length, ...ranked, ...rest);
        }
        try {
          GM_deleteValue(deps.PROBE_CACHE_KEY);
        } catch {
        }
        deps.log("已移除排除：" + kw + "，當前：" + deps.activeCdnList.map((c) => c.split(".")[0]).join(", "));
        return [...deps.ExcludeHostKeywords];
      },
      excludes() {
        return [...deps.ExcludeHostKeywords];
      }
    };
    return {
      get controlResult() {
        return controlResult;
      },
      get copyDiagReport() {
        return copyDiagReport;
      },
      get BiliCDNControls() {
        return BiliCDNControls;
      }
    };
  }
  __name(createControls, "createControls");

  // src/diagnostics/snapshot.mjs
  function createSnapshot(deps) {
    const describePlaybackBuffer = /* @__PURE__ */ __name((stats) => {
      if (stats.readyState < 0) return "緩衝：無資料（尚無影片）";
      const rate = deps.playbackRateState.confirmed ? deps.playbackRateState.observedRate : deps.ASSUMED_PLAYBACK_RATE;
      return "連續前方緩衝：" + stats.bufferAheadSec + " 秒｜約可播放 " + (stats.bufferAheadSec / rate).toFixed(1) + " 秒" + (deps.playbackRateState.confirmed ? "" : "（未確認，按 2x 估算）");
    }, "describePlaybackBuffer");
    const PUBLIC_DIAG_HOST_MAX = 32;
    const publicFinite = /* @__PURE__ */ __name((value, fallback = 0) => Number.isFinite(+value) ? +value : fallback, "publicFinite");
    const publicHost = /* @__PURE__ */ __name((value) => {
      const host = typeof value === "string" ? value.trim().toLowerCase() : "";
      return host.length <= 253 && /^[a-z0-9.-]+$/.test(host) ? host : null;
    }, "publicHost");
    const deepFreezePublic = /* @__PURE__ */ __name((value, seen = /* @__PURE__ */ new WeakSet()) => {
      if (!value || typeof value !== "object" || seen.has(value)) return value;
      seen.add(value);
      Object.values(value).forEach((child) => deepFreezePublic(child, seen));
      return Object.freeze(value);
    }, "deepFreezePublic");
    const buildPublicDiagnosticSnapshot = /* @__PURE__ */ __name(() => {
      const wd = deps.Watchdog.stats();
      const hd = deps.getHttpDnsStatus();
      const native = deps.getNativeRouteDiagnostics();
      const health = {};
      deps.TRUSTED_CDN_CATALOG.slice(0, PUBLIC_DIAG_HOST_MAX).forEach((host) => {
        const h = deps.cdnHealth[host];
        if (!h) return;
        health[host] = {
          mbps: publicFinite(h.ewmaMbps),
          latencyMs: publicFinite(h.latencyMs),
          samples: Math.max(0, Math.min(1e4, Math.trunc(publicFinite(h.samples)))),
          failures: Math.max(0, Math.min(1e4, Math.trunc(publicFinite(h.failures)))),
          slowSamples: Math.max(0, Math.min(1e4, Math.trunc(publicFinite(h.slowSamples)))),
          softBlocked: !!deps.isCdnSoftBlocked(host)
        };
      });
      const scores = hd && hd.scores ? {
        block: publicFinite(hd.scores.block),
        allow: publicFinite(hd.scores.allow),
        blockSamples: Math.max(0, Math.trunc(publicFinite(hd.scores.blockSamples))),
        allowSamples: Math.max(0, Math.trunc(publicFinite(hd.scores.allowSamples))),
        trial: hd.scores.trial == null ? null : publicFinite(hd.scores.trial)
      } : null;
      return deepFreezePublic({
        version: deps.VERSION,
        updatedAt: Date.now(),
        diagnostics: deps.DiagnosticLog.summary(),
        disabled: !!deps.disabled,
        currentCdn: publicHost(deps.peekCurrentCdn()),
        active: deps.activeCdnList.map(publicHost).filter(Boolean).slice(0, PUBLIC_DIAG_HOST_MAX),
        selectable: deps.getHealthyCdnList().map(publicHost).filter(Boolean).slice(0, PUBLIC_DIAG_HOST_MAX),
        catalog: deps.TRUSTED_CDN_CATALOG.slice(0, PUBLIC_DIAG_HOST_MAX).map((host) => ({
          host,
          autoEnabled: !!deps.isCatalogAutoEnabled(host),
          overridden: Object.prototype.hasOwnProperty.call(deps.catalogOverrides, host)
        })),
        black: [...deps.blacklistSet].map(publicHost).filter(Boolean).slice(0, PUBLIC_DIAG_HOST_MAX),
        soft: Object.keys(deps.cdnSoftBlockUntil).filter(deps.isCdnSoftBlocked).map(publicHost).filter(Boolean).slice(0, PUBLIC_DIAG_HOST_MAX),
        dead: deps.listDeadHosts().slice(0, PUBLIC_DIAG_HOST_MAX).map((entry) => ({
          host: publicHost(entry.host),
          reason: String(entry.reason || "unknown").slice(0, 64),
          daysLeft: Math.max(0, publicFinite(entry.daysLeft))
        })).filter((entry) => entry.host),
        health,
        discovered: publicHost(deps.pageDiscoveredCdn),
        redirects: Object.fromEntries(Object.entries(deps.redirectStats).map(([key, value]) => [String(key).slice(0, 40), Math.max(0, publicFinite(value))])),
        buffer: {
          totalMB: Math.max(0, publicFinite(wd.totalMB)),
          // compatibility alias: cumulative downloaded MB, NOT buffered MB
          downloadedMB: Math.max(0, publicFinite(wd.totalMB)),
          available: wd.readyState >= 0,
          playableSec: wd.readyState >= 0 ? +(wd.bufferAheadSec / (deps.playbackRateState.confirmed ? deps.playbackRateState.observedRate : deps.ASSUMED_PLAYBACK_RATE)).toFixed(2) : null,
          targetMB: Math.max(0, publicFinite(wd.targetMB)),
          bufferAheadSec: Math.max(0, publicFinite(wd.bufferAheadSec)),
          bufferedEndSec: Math.max(0, publicFinite(wd.bufferedEndSec)),
          videoTimeSec: Math.max(0, publicFinite(wd.videoTimeSec)),
          requiredMbps: Math.max(0, publicFinite(wd.requiredMbps)),
          switchCount: Math.max(0, Math.trunc(publicFinite(wd.switchCount))),
          stallCount: Math.max(0, Math.trunc(publicFinite(wd.stallCount))),
          breakerSec: Math.max(0, Math.trunc(publicFinite(wd.breakerSec)))
        },
        playback: {
          observedRate: Math.max(0, publicFinite(deps.playbackRateState.observedRate, deps.ASSUMED_PLAYBACK_RATE)),
          effectiveRate: deps.getEffectivePlaybackRate(deps.playbackRateState.effectiveRate),
          confirmed: !!deps.playbackRateState.confirmed,
          source: ["assumed", "initial", "ratechange", "watchdog", "performance"].includes(deps.playbackRateState.source) ? deps.playbackRateState.source : "assumed"
        },
        mediaDelivery: deps.getMediaDeliverySnapshot(),
        nativeRouting: {
          selectedRouteType: ["catalog-generated", "native-signed", "root-original"].includes(native.currentRouteType) ? native.currentRouteType : "catalog-generated",
          routeRevision: Math.max(0, Math.trunc(publicFinite(native.routeRevision))),
          activeRepresentation: native.active ? {
            height: Math.max(0, Math.trunc(publicFinite(native.active.height))),
            codec: ["av1", "hevc", "avc", "other"].includes(native.active.codec) ? native.active.codec : "other"
          } : null,
          tentativeRepresentation: native.tentative ? {
            height: Math.max(0, Math.trunc(publicFinite(native.tentative.height))),
            codec: ["av1", "hevc", "avc", "other"].includes(native.tentative.codec) ? native.tentative.codec : "other"
          } : null,
          currentGroupNativeCount: Math.max(0, Math.min(4, Math.trunc(publicFinite(native.groupNativeCount)))),
          states: Object.fromEntries(["unknown", "provisional", "confirmed", "invalid"].map((key) => [key, Math.max(0, Math.trunc(publicFinite(native.counts?.[key])))])),
          ledgerSize: {
            video: Math.max(0, Math.min(48, Math.trunc(publicFinite(native.ledger?.video)))),
            audio: Math.max(0, Math.min(16, Math.trunc(publicFinite(native.ledger?.audio))))
          }
        },
        playbackQuality: { ...deps.playbackQualitySnapshot },
        currentCodecConfigurations: deps.getCurrentCodecDiagnostics(),
        streamEstimate: {
          source: deps.streamEstimate.source === "observed-representation" ? "observed-representation" : deps.streamEstimate.source === "conservative-height-max" ? "conservative-height-max" : "unknown",
          codec: ["av1", "hevc", "avc", "other"].includes(deps.streamEstimate.codec) ? deps.streamEstimate.codec : "other",
          height: Math.max(0, Math.trunc(publicFinite(deps.streamEstimate.height))),
          videoMbps: Math.max(0, publicFinite(deps.streamEstimate.videoMbps)),
          audioMbps: Math.max(0, publicFinite(deps.streamEstimate.audioMbps))
        },
        codec: {
          preference: deps.resolvedVideoCodecPreference,
          selectedMeaning: "sorting-first",
          capabilities: {
            av1_1080: deps.getCodecCapabilityState("av1", 1080),
            av1_2160: deps.getCodecCapabilityState("av1", 2160),
            hevc_1080: deps.getCodecCapabilityState("hevc", 1080),
            hevc_2160: deps.getCodecCapabilityState("hevc", 2160)
          },
          groups: deps.lastCodecDecision.groups.slice(0, 8).map((group) => ({
            quality: String(group.quality || "").slice(0, 16),
            selected: ["av1", "hevc", "avc", "other"].includes(group.selected) ? group.selected : "other",
            capability: ["good", "bad", "unknown", "not-applicable"].includes(group.capability) ? group.capability : "unknown"
          }))
        },
        httpdns: {
          mode: hd && (hd.mode === true || hd.mode === false || hd.mode === "auto") ? hd.mode : "auto",
          block: !!(hd && hd.block),
          ttlMin: Math.max(0, publicFinite(hd && hd.ttlMin)),
          decision: String(hd && hd.decision || "").slice(0, 32),
          scores
        },
        uiInjectStatus: String(deps.uiInjectStatus || "pending").slice(0, 32)
      });
    }, "buildPublicDiagnosticSnapshot");
    let publicDiagnosticSnapshot = deepFreezePublic({ version: deps.VERSION, disabled: !!deps.disabled });
    const refreshPublicDiagnosticSnapshot = /* @__PURE__ */ __name(() => {
      try {
        publicDiagnosticSnapshot = buildPublicDiagnosticSnapshot();
      } catch {
        deps.DiagnosticLog.fault("snapshot");
      }
      return publicDiagnosticSnapshot;
    }, "refreshPublicDiagnosticSnapshot");
    refreshPublicDiagnosticSnapshot();
    try {
      Object.defineProperty(unsafeWindow, "BiliCDN", {
        enumerable: true,
        configurable: false,
        get: /* @__PURE__ */ __name(() => publicDiagnosticSnapshot, "get")
      });
    } catch (e) {
      deps.err("[安全] 無法安裝唯讀診斷快照：", e);
    }
    return {
      get describePlaybackBuffer() {
        return describePlaybackBuffer;
      },
      get publicFinite() {
        return publicFinite;
      },
      get refreshPublicDiagnosticSnapshot() {
        return refreshPublicDiagnosticSnapshot;
      }
    };
  }
  __name(createSnapshot, "createSnapshot");

  // src/routing/catalog-controls.mjs
  function createCatalogControls(deps) {
    let cdnProbeStarted = false;
    const startCdnProbe = /* @__PURE__ */ __name(() => {
      if (cdnProbeStarted || deps.disabled) return;
      cdnProbeStarted = true;
      try {
        const primary = deps.getCurrentCdn(deps.STARTUP_PICK);
        const backups = deps.getHealthyCdnList(deps.STARTUP_PICK).filter((c) => c !== primary).slice(0, 2);
        deps.preconnectBatch([primary, ...backups].filter(Boolean), false);
      } catch {
      }
      deps.reorderCdnsByLatency().catch(deps.reportMeasurementFailure());
    }, "startCdnProbe");
    const persistCatalogOverrides = /* @__PURE__ */ __name(() => {
      try {
        const payload = Object.fromEntries(Object.entries(deps.catalogOverrides).filter(([host, enabled]) => deps.TRUSTED_CDN_CATALOG_SET.has(host) && typeof enabled === "boolean"));
        if (Object.keys(payload).length) GM_setValue(deps.CATALOG_OVERRIDES_KEY, payload);
        else GM_deleteValue(deps.CATALOG_OVERRIDES_KEY);
      } catch {
      }
    }, "persistCatalogOverrides");
    const reconcileCatalogCandidates = /* @__PURE__ */ __name(() => {
      deps.rebuildPreferredCdnList();
      for (let i = deps.activeCdnList.length - 1; i >= 0; i--) {
        if (!deps.PREFERRED_CDN_LIST.includes(deps.activeCdnList[i])) deps.activeCdnList.splice(i, 1);
      }
      deps.PREFERRED_CDN_LIST.forEach((host) => {
        if (!deps.activeCdnList.includes(host) && !deps.blacklistSet.has(host) && !deps.knownDeadHosts.has(host)) {
          deps.activeCdnList.push(host);
        }
      });
      const ranked = deps.getHealthyCdnList();
      if (ranked.length) {
        const rest = deps.activeCdnList.filter((host) => !ranked.includes(host));
        deps.activeCdnList.splice(0, deps.activeCdnList.length, ...ranked, ...rest);
      }
      if (deps.lastChosenCdn && !deps.PREFERRED_CDN_LIST.includes(deps.lastChosenCdn)) deps.lastChosenCdn = null;
      if (deps.pageDiscoveredCdn && deps.TRUSTED_CDN_CATALOG_SET.has(deps.pageDiscoveredCdn) && !deps.PREFERRED_CDN_LIST.includes(deps.pageDiscoveredCdn)) deps.pageDiscoveredCdn = null;
      try {
        GM_deleteValue(deps.PROBE_CACHE_KEY);
      } catch {
      }
      deps.clearRuntimeConnectionHints();
      deps.promoteBestCdnNow();
      if (!deps.disabled) deps.preconnectBatch(deps.getHealthyCdnList().slice(0, 3), false);
      deps.refreshPublicDiagnosticSnapshot();
    }, "reconcileCatalogCandidates");
    const setCatalogOverride = /* @__PURE__ */ __name((host, enabled) => {
      if (!deps.TRUSTED_CDN_CATALOG_SET.has(host) || typeof enabled !== "boolean") return false;
      const next = Object.assign(/* @__PURE__ */ Object.create(null), deps.catalogOverrides, { [host]: enabled });
      const usable = deps.TRUSTED_CDN_CATALOG.some((candidate) => {
        const candidateEnabled = Object.prototype.hasOwnProperty.call(next, candidate) ? next[candidate] : !deps.matchesHeaderExclude(candidate);
        return candidateEnabled && !deps.isPresumedDnsFailHost(candidate);
      });
      if (!usable) {
        console.error("[BiliCDN] 拒絕：自動選路至少要保留一個非 presumed 候選");
        return false;
      }
      deps.catalogOverrides[host] = enabled;
      persistCatalogOverrides();
      reconcileCatalogCandidates();
      return true;
    }, "setCatalogOverride");
    const resetCatalogOverrides = /* @__PURE__ */ __name(() => {
      Object.keys(deps.catalogOverrides).forEach((host) => delete deps.catalogOverrides[host]);
      persistCatalogOverrides();
      reconcileCatalogCandidates();
      return deps.controlResult(true, "defaults-restored", "已恢復檔頭的 catalog 預設");
    }, "resetCatalogOverrides");
    const applyCatalogSelection = /* @__PURE__ */ __name((selectedIndices) => {
      if (!Array.isArray(selectedIndices)) return deps.controlResult(false, "invalid-selection", "Catalog 選擇格式不合法");
      const selected = new Set(selectedIndices.filter((index) => Number.isInteger(index) && index >= 0 && index < deps.TRUSTED_CDN_CATALOG.length));
      const usable = deps.TRUSTED_CDN_CATALOG.some((host, index) => selected.has(index) && !deps.isPresumedDnsFailHost(host));
      if (!usable) return deps.controlResult(false, "zero-candidates", "自動選路至少要保留一個非 presumed 候選");
      Object.keys(deps.catalogOverrides).forEach((host) => delete deps.catalogOverrides[host]);
      deps.TRUSTED_CDN_CATALOG.forEach((host, index) => {
        const enabled = selected.has(index);
        const headerDefault = !deps.matchesHeaderExclude(host);
        if (enabled !== headerDefault) deps.catalogOverrides[host] = enabled;
      });
      persistCatalogOverrides();
      reconcileCatalogCandidates();
      return deps.controlResult(true, "catalog-updated", "Catalog 自動選路設定已套用", {
        enabled: deps.TRUSTED_CDN_CATALOG.filter((host, index) => selected.has(index)).length
      });
    }, "applyCatalogSelection");
    const reloadAfterFeedback = /* @__PURE__ */ __name(() => setTimeout(() => {
      try {
        location.reload();
      } catch {
      }
    }, 450), "reloadAfterFeedback");
    const restoreAutomaticDefaults = /* @__PURE__ */ __name(() => {
      GM_deleteValue("CustomCDN");
      return resetCatalogOverrides();
    }, "restoreAutomaticDefaults");
    return {
      get restoreAutomaticDefaults() {
        return restoreAutomaticDefaults;
      },
      get cdnProbeStarted() {
        return cdnProbeStarted;
      },
      set cdnProbeStarted(value) {
        cdnProbeStarted = value;
      },
      get startCdnProbe() {
        return startCdnProbe;
      },
      get resetCatalogOverrides() {
        return resetCatalogOverrides;
      },
      get applyCatalogSelection() {
        return applyCatalogSelection;
      },
      get reloadAfterFeedback() {
        return reloadAfterFeedback;
      }
    };
  }
  __name(createCatalogControls, "createCatalogControls");

  // src/ui/control-center.mjs
  function createViews(deps) {
    const showResetLearningDialog = /* @__PURE__ */ __name(() => deps.TrustedMenuUI.openConfirm({
      title: "重置所有學習狀態？",
      paragraphs: [
        "將清除 CDN health、Native Route 評級、blacklist、dead／soft block、probe cache、HTTPDNS 學習及 Watchdog 統計。",
        "固定 CDN 與 catalog override 不會被清除。此操作無法復原。"
      ],
      confirmLabel: "確認重置",
      cancelLabel: "返回節點維護",
      onCancel: /* @__PURE__ */ __name(() => showMaintenanceCenter(), "onCancel"),
      danger: true,
      onConfirm: /* @__PURE__ */ __name(() => {
        const result = deps.BiliCDNControls.reset();
        deps.refreshPublicDiagnosticSnapshot();
        deps.TrustedMenuUI.toast(result.message + "，正在重新載入…", "success");
        deps.reloadAfterFeedback();
      }, "onConfirm")
    }), "showResetLearningDialog");
    const showDiagnosticDialog = /* @__PURE__ */ __name(() => {
      deps.BiliCDNControls.diag();
      deps.refreshPublicDiagnosticSnapshot();
      return deps.TrustedMenuUI.openText({
        title: "BiliCDN 診斷資訊",
        paragraphs: ["「排序首位」不等於已確認解碼 codec；此報告包含 UA，但不含影片 URL、cookie 或 IP。"],
        text: deps.buildDiagReport(),
        copyLabel: "複製報告",
        onCopy: /* @__PURE__ */ __name(() => {
          deps.copyDiagReport().catch(() => {
          });
        }, "onCopy"),
        actionLabel: deps.Config.verbose ? "關閉 verbose" : "開啟 verbose",
        onAction: /* @__PURE__ */ __name(() => {
          const result = deps.BiliCDNControls.verbose(!deps.Config.verbose);
          deps.refreshPublicDiagnosticSnapshot();
          deps.TrustedMenuUI.toast(result.message, result.ok ? "success" : "warning");
          showDiagnosticDialog();
        }, "onAction"),
        closeLabel: "返回控制中心",
        onClose: /* @__PURE__ */ __name(() => showControlCenter(), "onClose")
      });
    }, "showDiagnosticDialog");
    const showDeadReviveDialog = /* @__PURE__ */ __name(() => {
      const dead = deps.listDeadHosts().map((entry) => entry.host).filter((host) => deps.TRUSTED_CDN_CATALOG_SET.has(host));
      if (!dead.length) {
        deps.TrustedMenuUI.toast("目前沒有可救回的 dead catalog 節點", "info");
        showMaintenanceCenter();
        return false;
      }
      return deps.TrustedMenuUI.openChoice({
        title: "救回單一 dead catalog 節點",
        paragraphs: ["只解除所選節點的持久 dead 判定；不修改 catalog override。"],
        choices: dead.map((host) => ({
          label: host,
          detail: (deps.listDeadHosts().find((entry) => entry.host === host) || {}).reason || "dead"
        })),
        selected: [0],
        confirmLabel: "救回節點",
        cancelLabel: "返回節點維護",
        onCancel: /* @__PURE__ */ __name(() => showMaintenanceCenter(), "onCancel"),
        navigateOnConfirm: true,
        onConfirm: /* @__PURE__ */ __name((picked) => {
          const index = picked[0];
          const host = Number.isInteger(index) ? dead[index] : null;
          const stillDead = host && deps.listDeadHosts().some((entry) => entry.host === host);
          const result = stillDead && deps.TRUSTED_CDN_CATALOG_SET.has(host) ? deps.BiliCDNControls.revive(host) : deps.controlResult(false, "stale", "節點狀態已改變，請重新開啟選單");
          deps.refreshPublicDiagnosticSnapshot();
          deps.TrustedMenuUI.toast(result.message, result.ok ? "success" : "warning");
          showMaintenanceCenter();
        }, "onConfirm")
      });
    }, "showDeadReviveDialog");
    const showAsyncControlResult = /* @__PURE__ */ __name(async (startMessage, operation) => {
      const progress = deps.TrustedMenuUI.toast(startMessage, "info", { sticky: true });
      try {
        const result = await operation();
        progress.update(result.message, result.ok ? "success" : result.status === "disabled" ? "warning" : "info");
        return result;
      } catch (error) {
        const result = deps.controlResult(false, "error", "操作失敗：" + (error && error.message ? error.message : "未知錯誤"));
        progress.update(result.message, "error");
        return result;
      }
    }, "showAsyncControlResult");
    const runSmartReassessment = /* @__PURE__ */ __name(() => {
      if (deps.lastSampleSegmentUrl) {
        return showAsyncControlResult("開始以目前影片分段重新測速…", () => deps.BiliCDNControls.bakeoff());
      }
      return showAsyncControlResult("尚無影片分段，改用延遲探測…", async () => {
        const result = await deps.BiliCDNControls.probe();
        return result && result.ok ? deps.controlResult(true, result.status, "尚無影片分段；" + result.message, result.data) : result;
      });
    }, "runSmartReassessment");
    const showRoutingCenter = /* @__PURE__ */ __name(() => {
      const routes = [
        { label: "自動選路", detail: deps.resolvedCdn ? "重新載入後恢復自動" : "目前模式" },
        ...deps.TRUSTED_CDN_CATALOG.map((host) => ({
          label: host,
          detail: [
            host === deps.resolvedCdn ? "目前固定" : "",
            "檔頭預設=" + (deps.matchesHeaderExclude(host) ? "停用" : "啟用"),
            Object.prototype.hasOwnProperty.call(deps.catalogOverrides, host) ? "override" : "",
            deps.knownDeadHosts.has(host) ? "dead" : "",
            deps.isPresumedDnsFailHost(host) ? "presumed" : ""
          ].filter(Boolean).join("；") || "可信 catalog 節點"
        }))
      ];
      const fixedSelected = deps.resolvedCdn ? Math.max(1, deps.TRUSTED_CDN_CATALOG.indexOf(deps.resolvedCdn) + 1) : 0;
      const catalogSelected = deps.TRUSTED_CDN_CATALOG.map((host, index) => deps.isCatalogAutoEnabled(host) ? index : -1).filter((index) => index >= 0);
      return deps.TrustedMenuUI.openRouting({
        title: "CDN 選路",
        paragraphs: [deps.resolvedCdn ? "目前使用固定 CDN；Native signed route 不會成為 primary，候選勾選會保留，恢復自動後生效。" : "此頁只管理可信 catalog；Native 評級不會加入 catalog。至少保留一個非 presumed 自動候選。"],
        routes,
        fixedSelected,
        catalogSelected,
        backLabel: "返回控制中心",
        onBack: /* @__PURE__ */ __name(() => showControlCenter(), "onBack"),
        onDefaults: /* @__PURE__ */ __name(() => {
          const result = deps.restoreAutomaticDefaults();
          deps.refreshPublicDiagnosticSnapshot();
          deps.TrustedMenuUI.toast("已恢復自動選路與檔頭預設；正在重新載入…", result.ok ? "success" : "error");
          if (result.ok) deps.reloadAfterFeedback();
        }, "onDefaults"),
        onConfirm: /* @__PURE__ */ __name(({ routeIndex, enabled }) => {
          if (!Number.isInteger(routeIndex) || routeIndex < 0 || routeIndex > deps.TRUSTED_CDN_CATALOG.length) {
            deps.TrustedMenuUI.toast("固定節點選擇不合法", "error");
            return;
          }
          const catalogResult = deps.applyCatalogSelection(enabled);
          if (!catalogResult.ok) {
            deps.TrustedMenuUI.toast(catalogResult.message, "error");
            return;
          }
          const host = routeIndex === 0 ? null : deps.TRUSTED_CDN_CATALOG[routeIndex - 1];
          const routeResult = deps.BiliCDNControls.setCdn(host);
          deps.refreshPublicDiagnosticSnapshot();
          deps.TrustedMenuUI.toast(
            routeResult.ok ? "選路設定已套用；正在重新載入…" : routeResult.message,
            routeResult.ok ? "success" : "error"
          );
          if (routeResult.ok) deps.reloadAfterFeedback();
        }, "onConfirm")
      });
    }, "showRoutingCenter");
    const showMaintenanceCenter = /* @__PURE__ */ __name(() => {
      const softCount = Object.keys(deps.cdnSoftBlockUntil).filter(deps.isCdnSoftBlocked).length;
      const deadCount = deps.listDeadHosts().filter((entry) => deps.TRUSTED_CDN_CATALOG_SET.has(entry.host)).length;
      const blackCount = deps.blacklistSet.size;
      return deps.TrustedMenuUI.openActions({
        title: "節點維護",
        paragraphs: ["soft=" + softCount + "、dead=" + deadCount + "、black=" + blackCount],
        items: [
          {
            label: "清除所有 soft block",
            action: "clear-soft",
            onActivate: /* @__PURE__ */ __name(() => {
              const result = deps.BiliCDNControls.clearSoft();
              deps.refreshPublicDiagnosticSnapshot();
              deps.TrustedMenuUI.toast(result.message, result.status === "empty" ? "info" : "success");
              showMaintenanceCenter();
            }, "onActivate")
          },
          { label: "救回單一 dead catalog 節點", action: "revive-dead", onActivate: showDeadReviveDialog },
          { label: "重置所有學習狀態", action: "reset-all", onActivate: showResetLearningDialog },
          { label: "返回控制中心", action: "back", onActivate: /* @__PURE__ */ __name(() => showControlCenter(), "onActivate") }
        ]
      });
    }, "showMaintenanceCenter");
    function showControlCenter() {
      const stats = deps.Watchdog.stats();
      const httpdns = deps.getHttpDnsStatus();
      const abnormal = deps.blacklistSet.size + deps.knownDeadHosts.size + Object.keys(deps.cdnSoftBlockUntil).filter(deps.isCdnSoftBlocked).length;
      const codecLead = deps.lastCodecDecision.groups && deps.lastCodecDecision.groups[0] ? deps.lastCodecDecision.groups[0].selected || "未知" : "尚無資料";
      const native = deps.getNativeRouteDiagnostics();
      const rep = native.active ? native.active.height + "p/" + native.active.codec : "尚未確認";
      return deps.TrustedMenuUI.openActions({
        title: "BiliCDN 控制中心",
        paragraphs: [
          "狀態：" + (deps.disabled ? "停用" : "啟用") + "｜模式：" + (deps.resolvedCdn ? "固定" : "自動") + "｜選路建議：" + deps.getCdnShortName(),
          "倍速：" + deps.playbackRateState.effectiveRate + "x（" + (deps.playbackRateState.confirmed ? "已確認" : "假定") + "）｜" + deps.describePlaybackBuffer(stats),
          "串流：" + deps.streamEstimate.videoMbps + "+" + deps.streamEstimate.audioMbps + " Mbps｜codec 排序首位：" + codecLead,
          "Representation：" + rep + "｜路線：" + native.currentRouteType + "｜Catalog fallback：" + (native.catalogFallback ? native.catalogFallback.split(".")[0] : "無"),
          "Native 評級：本群組 " + native.groupNativeCount + " 條｜confirmed=" + native.counts.confirmed + "｜provisional=" + native.counts.provisional + "｜unknown=" + native.counts.unknown,
          "異常節點：" + abnormal + "｜HTTPDNS：" + httpdns.mode
        ],
        items: [
          { label: "重新評估節點", action: "reassess", onActivate: /* @__PURE__ */ __name(() => {
            runSmartReassessment();
            showControlCenter();
          }, "onActivate") },
          { label: "CDN 選路", action: "routing", onActivate: showRoutingCenter },
          { label: "診斷", action: "diagnostics", onActivate: showDiagnosticDialog },
          { label: "節點維護", action: "maintenance", onActivate: showMaintenanceCenter }
        ]
      });
    }
    __name(showControlCenter, "showControlCenter");
    const registerControlMenu = /* @__PURE__ */ __name((register) => register("⚙️ 開啟 BiliCDN 控制中心", showControlCenter), "registerControlMenu");
    return {
      get registerControlMenu() {
        return registerControlMenu;
      }
    };
  }
  __name(createViews, "createViews");

  // src/ui/player-panel.mjs
  function createPlayerPanel(deps) {
    const pickMainSettingsAnchor = /* @__PURE__ */ __name((first) => {
      const all = document.querySelectorAll(".bpx-player-ctrl-setting-others");
      if (all.length <= 1) return first;
      let best = first, bestArea = -1;
      all.forEach((node) => {
        const root = node.closest('[id*="bilibili-player"], [class*="bpx-player"]') || node;
        const video = root.querySelector && root.querySelector("video");
        const area = video ? (video.clientWidth || 0) * (video.clientHeight || 0) : 0;
        if (area > bestArea) {
          bestArea = area;
          best = node;
        }
      });
      return best;
    }, "pickMainSettingsAnchor");
    let renderVisibleStatus = /* @__PURE__ */ __name(() => {
    }, "renderVisibleStatus");
    const buildUI = /* @__PURE__ */ __name((settingsBar) => {
      if (!settingsBar || settingsBar.querySelector("#bilicdn-status-panel")) return;
      deps.uiInjectStatus = "ok";
      settingsBar.appendChild(deps.fromHTML(
        '<div class="bpx-player-ctrl-setting-others-title">' + deps.SettingsBarTitle + "</div>"
      ));
      const checkBoxWrapper = deps.fromHTML(
        '<div class="bpx-player-ctrl-setting-checkbox bpx-player-ctrl-setting-blackgap bui bui-checkbox bui-dark"><div class="bui-area"><input class="bui-checkbox-input" type="checkbox" checked aria-label="自訂影片 CDN"><label class="bui-checkbox-label"><span class="bui-checkbox-icon bui-checkbox-icon-default"><svg xmlns="http://www.w3.org/2000/svg" data-pointer="none" viewBox="0 0 32 32"><path d="M8 6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H8zm0-2h16c2.21 0 4 1.79 4 4v16c0 2.21-1.79 4-4 4H8c-2.21 0-4-1.79-4-4V8c0-2.21 1.79-4 4-4z"></path></svg></span><span class="bui-checkbox-icon bui-checkbox-icon-selected"><svg xmlns="http://www.w3.org/2000/svg" data-pointer="none" viewBox="0 0 32 32"><path d="m13 18.25-1.8-1.8c-.6-.6-1.65-.6-2.25 0s-.6 1.5 0 2.25l2.85 2.85c.318.318.762.468 1.2.448.438.02.882-.13 1.2-.448l8.85-8.85c.6-.6.6-1.65 0-2.25s-1.65-.6-2.25 0l-7.8 7.8zM8 4h16c2.21 0 4 1.79 4 4v16c0 2.21-1.79 4-4 4H8c-2.21 0-4-1.79-4-4V8c0-2.21 1.79-4 4-4z"></path></svg></span><span class="bui-checkbox-name">' + deps.SettingsBarTitle + "</span></label></div></div>"
      );
      const checkBox = checkBoxWrapper.querySelector("input");
      checkBox.checked = !deps.disabled;
      checkBox.addEventListener("change", (event) => {
        if (!event || !event.isTrusted) {
          checkBox.checked = !deps.disabled;
          return;
        }
        deps.setRuntimeDisabled(!checkBox.checked);
        updateStatusPanel();
        deps.TrustedMenuUI.toast(deps.disabled ? "CDN 改寫與主動量測已停用" : "CDN 改寫已啟用", deps.disabled ? "warning" : "success");
      });
      const statusPanel = document.createElement("div");
      statusPanel.id = "bilicdn-status-panel";
      statusPanel.style.cssText = "font-size:10px;padding:2px 0 6px;line-height:1.6;";
      let lastStatusHtml = "";
      const renderStatusHtml = /* @__PURE__ */ __name((html) => {
        if (html === lastStatusHtml) return;
        lastStatusHtml = html;
        statusPanel.innerHTML = html;
      }, "renderStatusHtml");
      const updateStatusPanel = /* @__PURE__ */ __name(() => {
        if (deps.disabled) {
          renderStatusHtml('<span style="color:#aaa;">CDN 切換已停用</span>');
          return;
        }
        const s = deps.Watchdog.stats();
        const bufferText = deps.describePlaybackBuffer(s);
        const mode = deps.resolvedCdn ? "固定" : "自動";
        const rate = (deps.playbackRateState.confirmed ? deps.playbackRateState.observedRate : deps.ASSUMED_PLAYBACK_RATE) + "x" + (deps.playbackRateState.confirmed ? "" : "（未確認，按 2x 估算）");
        const softCount = Object.keys(deps.cdnSoftBlockUntil).filter(deps.isCdnSoftBlocked).length;
        const abnormalCount = deps.blacklistSet.size + deps.knownDeadHosts.size + softCount;
        let html = '<div style="color:#4fc3f7;">' + mode + "｜" + deps.getCdnShortName() + "｜" + rate + '</div><div style="margin-top:3px;color:#90caf9;font-size:10px;">' + bufferText + "</div>";
        if (abnormalCount > 0) {
          html += '<div style="color:#ffb74d;margin-top:2px;">異常節點：' + abnormalCount + "（請由控制中心查看）</div>";
        }
        renderStatusHtml(html);
      }, "updateStatusPanel");
      updateStatusPanel();
      renderVisibleStatus = /* @__PURE__ */ __name(() => {
        if (!document.contains(statusPanel) || statusPanel.offsetParent === null) return;
        updateStatusPanel();
      }, "renderVisibleStatus");
      settingsBar.appendChild(checkBoxWrapper);
      settingsBar.appendChild(statusPanel);
    }, "buildUI");
    const ensureUiPresent = /* @__PURE__ */ __name(() => {
      if (document.querySelector("#bilicdn-status-panel")) return;
      const bar = pickMainSettingsAnchor(document.querySelector(".bpx-player-ctrl-setting-others"));
      if (bar) buildUI(bar);
    }, "ensureUiPresent");
    deps.waitForElm(".bpx-player-ctrl-setting-others", 3e4).then((found) => buildUI(pickMainSettingsAnchor(found))).catch(() => {
      deps.uiInjectStatus = "timeout";
      deps.DiagnosticLog.fault("ui");
    });
    return { renderVisibleStatus: /* @__PURE__ */ __name(() => renderVisibleStatus(), "renderVisibleStatus"), ensureUiPresent };
  }
  __name(createPlayerPanel, "createPlayerPanel");

  // src/runtime/application.mjs
  function createApplication(deps) {
    "use strict";
    deps.interceptNetResponse((response, url, valid) => {
      if (deps.disabled || !valid() || !deps.isPlayUrlApi(url)) return;
      if (response === null || response === void 0) return;
      try {
        if (Object.prototype.toString.call(response) === "[object Object]") {
          deps.playInfoTransformer(response, { trustedTransport: true });
          return response;
        }
        if (typeof response !== "string") return response;
        const playInfo = JSON.parse(response);
        deps.playInfoTransformer(playInfo, { trustedTransport: true });
        return JSON.stringify(playInfo);
      } catch {
        deps.DiagnosticLog.fault("transform");
      }
    });
    const WEBRTC_APIS = ["RTCPeerConnection", "mozRTCPeerConnection", "webkitRTCPeerConnection", "RTCDataChannel"];
    const webRtcOriginalDescriptors = /* @__PURE__ */ new Map();
    const blockWebRtc = /* @__PURE__ */ __name(() => {
      if (!deps.BlockWebRTC || deps.disabled) return;
      WEBRTC_APIS.forEach((api) => {
        try {
          if (!webRtcOriginalDescriptors.has(api)) {
            webRtcOriginalDescriptors.set(api, Object.getOwnPropertyDescriptor(unsafeWindow, api) || null);
          }
          Object.defineProperty(unsafeWindow, api, {
            get: /* @__PURE__ */ __name(() => void 0, "get"),
            set: /* @__PURE__ */ __name(() => {
            }, "set"),
            configurable: true
          });
        } catch {
        }
      });
    }, "blockWebRtc");
    const restoreWebRtc = /* @__PURE__ */ __name(() => {
      webRtcOriginalDescriptors.forEach((descriptor, api) => {
        try {
          if (descriptor) Object.defineProperty(unsafeWindow, api, descriptor);
          else delete unsafeWindow[api];
        } catch {
        }
      });
    }, "restoreWebRtc");
    const transformInitialPlayInfo = /* @__PURE__ */ __name(() => {
      if (deps.disabled) return;
      const safeTransform = /* @__PURE__ */ __name((value) => {
        try {
          deps.playInfoTransformer(value, { trustedTransport: false });
        } catch {
          deps.DiagnosticLog.fault("transform");
        }
      }, "safeTransform");
      if (unsafeWindow.__playinfo__) {
        safeTransform(unsafeWindow.__playinfo__);
      } else {
        let internal = unsafeWindow.__playinfo__;
        Object.defineProperty(unsafeWindow, "__playinfo__", {
          get: /* @__PURE__ */ __name(() => internal, "get"),
          set: /* @__PURE__ */ __name((v) => {
            if (!deps.disabled) safeTransform(v);
            internal = v;
          }, "set"),
          configurable: true
        });
      }
    }, "transformInitialPlayInfo");
    let backgroundPlaybackEnabled = !deps.disabled;
    let visibilitySpoofInstalled = false;
    let tabReallyHidden = false;
    const installVisibilitySpoof = /* @__PURE__ */ __name(() => {
      if (visibilitySpoofInstalled) return;
      visibilitySpoofInstalled = true;
      const doc = unsafeWindow.document;
      const origHidden = Object.getOwnPropertyDescriptor(Document.prototype, "hidden");
      const origState = Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState");
      const realHidden = /* @__PURE__ */ __name(() => origHidden && origHidden.get ? origHidden.get.call(doc) : false, "realHidden");
      const realState = /* @__PURE__ */ __name(() => origState && origState.get ? origState.get.call(doc) : "visible", "realState");
      deps.readDiagnosticHidden = () => realState() !== "visible";
      tabReallyHidden = realState() !== "visible";
      const def = /* @__PURE__ */ __name((key, spoofed, real) => {
        try {
          Object.defineProperty(doc, key, {
            configurable: true,
            get: /* @__PURE__ */ __name(() => backgroundPlaybackEnabled ? spoofed : real(), "get")
          });
        } catch (e) {
          deps.err("visibility spoof 失敗 (" + key + "):", e);
        }
      }, "def");
      def("hidden", false, realHidden);
      def("webkitHidden", false, realHidden);
      def("visibilityState", "visible", realState);
      def("webkitVisibilityState", "visible", realState);
      const onVisRaw = /* @__PURE__ */ __name((e) => {
        tabReallyHidden = realState() !== "visible";
        if (!backgroundPlaybackEnabled) return;
        if (!tabReallyHidden) {
          const hosts = [...new Set([deps.resolvedCdn, ...deps.activeCdnList].filter(Boolean))].slice(0, 3);
          try {
            deps.preconnectBatch(hosts, true);
          } catch {
          }
        }
        e.stopImmediatePropagation();
      }, "onVisRaw");
      doc.addEventListener("visibilitychange", onVisRaw, true);
      doc.addEventListener("webkitvisibilitychange", onVisRaw, true);
      unsafeWindow.addEventListener("blur", (e) => {
        if (backgroundPlaybackEnabled) e.stopImmediatePropagation();
      }, true);
    }, "installVisibilitySpoof");
    const TAB_ID = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const FOREIGN_BAKEOFF_QUIET = 8e3;
    let crossTabChannel = null;
    let foreignBakeoffAt = 0;
    const setupCrossTab = /* @__PURE__ */ __name(() => {
      if (crossTabChannel || typeof BroadcastChannel === "undefined") return;
      try {
        crossTabChannel = new BroadcastChannel("bilicdn_tw");
      } catch {
        return;
      }
      crossTabChannel.onmessage = (ev) => {
        const d = ev && ev.data;
        if (!d || d.id === TAB_ID) return;
        if (d.type === "bakeoff") foreignBakeoffAt = Date.now();
      };
      deps.crossTabShouldBakeoff = () => true;
      deps.onBakeoffStart = () => {
        try {
          crossTabChannel.postMessage({ type: "bakeoff", id: TAB_ID });
        } catch {
        }
      };
    }, "setupCrossTab");
    const closeCrossTab = /* @__PURE__ */ __name(() => {
      if (crossTabChannel) {
        try {
          crossTabChannel.close();
        } catch {
        }
        crossTabChannel = null;
      }
      foreignBakeoffAt = 0;
      deps.crossTabShouldBakeoff = () => true;
      deps.onBakeoffStart = () => {
      };
    }, "closeCrossTab");
    let pageHooksApplied = false;
    const applyPageHooks = /* @__PURE__ */ __name(() => {
      if (deps.disabled || pageHooksApplied) return;
      const step = /* @__PURE__ */ __name((name, fn) => {
        try {
          fn();
        } catch {
          deps.DiagnosticLog.fault("page-hook");
        }
      }, "step");
      step("transformInitialPlayInfo", transformInitialPlayInfo);
      step("blockWebRtc", blockWebRtc);
      step("installVisibilitySpoof", installVisibilitySpoof);
      pageHooksApplied = true;
    }, "applyPageHooks");
    let seekPrewarmStarted = false;
    let rearmSeekPrewarm = null;
    let stopSeekPrewarm = null;
    const setupSeekPrewarm = /* @__PURE__ */ __name(() => {
      if (seekPrewarmStarted) return;
      seekPrewarmStarted = true;
      let attached = null;
      let lastSeekWarmAt = 0;
      const SEEK_WARM_GAP_MS = 400;
      const ATTACH_TIMEOUT_MS = 3e4;
      let attachStartedAt = Date.now();
      let attachTimer = null;
      const findVideo = /* @__PURE__ */ __name(() => {
        let best = null, bestArea = 0;
        document.querySelectorAll("video").forEach((v) => {
          const a = (v.clientWidth || 0) * (v.clientHeight || 0);
          if (a > bestArea) {
            bestArea = a;
            best = v;
          }
        });
        return best;
      }, "findVideo");
      const seekWarmHosts = /* @__PURE__ */ __name(() => {
        const hosts = [];
        const push = /* @__PURE__ */ __name((h) => {
          if (deps.isValidCustomCdnHost(h) && (h === deps.resolvedCdn || !deps.matchesExclude(h)) && hosts.length < 3 && !hosts.includes(h)) hosts.push(h);
        }, "push");
        push(deps.getPlayingCdnHost());
        deps.getHealthyCdnList(deps.STARTUP_PICK).forEach(push);
        return hosts;
      }, "seekWarmHosts");
      const warmupSeek = /* @__PURE__ */ __name(() => {
        if (deps.disabled) return;
        if (Date.now() - lastSeekWarmAt < SEEK_WARM_GAP_MS) return;
        lastSeekWarmAt = Date.now();
        deps.preconnectBatch(seekWarmHosts(), false);
      }, "warmupSeek");
      const scheduleSeekWarmup = /* @__PURE__ */ __name(() => {
        if (deps.disabled) return;
        deps.Watchdog.noteSeek();
        deps.bumpSeekGrace();
        warmupSeek();
      }, "scheduleSeekWarmup");
      const onSeeked = /* @__PURE__ */ __name(() => {
        if (deps.disabled) return;
        deps.bumpSeekGrace();
        warmupSeek();
      }, "onSeeked");
      const tryAttach = /* @__PURE__ */ __name(() => {
        const v = findVideo();
        if (!v && Date.now() - attachStartedAt > ATTACH_TIMEOUT_MS) {
          clearInterval(attachTimer);
          attachTimer = null;
          return;
        }
        if (!v || v === attached) return;
        attached = v;
        try {
          v.preload = "auto";
        } catch {
        }
        deps.syncPlaybackRateFromVideo(v, "initial");
        if (!v.__biliCdnSeekBound) {
          v.__biliCdnSeekBound = true;
          v.addEventListener("seeking", scheduleSeekWarmup);
          v.addEventListener("seeked", onSeeked);
          v.addEventListener("ratechange", () => {
            if (deps.disabled) return;
            const rateState = deps.syncPlaybackRateFromVideo(v, "ratechange");
            if (rateState.effectiveRate > 1.5) warmupSeek();
          });
        }
        clearInterval(attachTimer);
        attachTimer = null;
      }, "tryAttach");
      attachTimer = setInterval(tryAttach, 800);
      tryAttach();
      rearmSeekPrewarm = /* @__PURE__ */ __name(() => {
        attached = null;
        attachStartedAt = Date.now();
        if (!attachTimer) attachTimer = setInterval(tryAttach, 800);
      }, "rearmSeekPrewarm");
      stopSeekPrewarm = /* @__PURE__ */ __name(() => {
        if (attachTimer) clearInterval(attachTimer);
        attachTimer = null;
        attached = null;
        seekPrewarmStarted = false;
        rearmSeekPrewarm = null;
        stopSeekPrewarm = null;
      }, "stopSeekPrewarm");
    }, "setupSeekPrewarm");
    let videoKeyUsedFallback = false;
    const getVideoKey = /* @__PURE__ */ __name(() => {
      let params;
      try {
        params = new URLSearchParams(location.search);
      } catch {
        params = new URLSearchParams("");
      }
      const m = location.pathname.match(/\/(BV[0-9A-Za-z]+|ep\d+|ss\d+|av\d+)/i);
      const fromQuery = m ? "" : params.get("bvid") || (params.get("epid") ? "ep" + params.get("epid") : "") || (params.get("oid") ? "av" + params.get("oid") : "") || (params.get("aid") ? "av" + params.get("aid") : "");
      videoKeyUsedFallback = !m && !fromQuery;
      const base = (m ? m[1] : fromQuery || location.pathname).toLowerCase();
      const part = params.get("p") || "";
      return part ? base + "#p" + part : base;
    }, "getVideoKey");
    let videoKeyFallbackWarned = false;
    const warnIfVideoKeyUnresolvable = /* @__PURE__ */ __name(() => {
      if (!videoKeyUsedFallback || videoKeyFallbackWarned) return;
      videoKeyFallbackWarned = true;
      console.warn("[" + deps.PluginName + "]: 這個頁面的網址取不到影片識別碼（" + location.pathname + "），SPA 換片偵測可能失效；CDN 改寫本身仍可正常運作。");
    }, "warnIfVideoKeyUnresolvable");
    let currentVideoKey = getVideoKey();
    let spaHooked = false;
    const onSpaNavigate = /* @__PURE__ */ __name(() => {
      const key = getVideoKey();
      warnIfVideoKeyUnresolvable();
      if (key === currentVideoKey) return;
      currentVideoKey = key;
      deps.DiagnosticLog.record("runtime", { reason: "spa" }, true);
      deps.TrustedMenuUI.invalidate();
      deps.stopRuntimeGeneration();
      deps.cdnProbeStarted = false;
      closeCrossTab();
      if (stopSeekPrewarm) stopSeekPrewarm();
      deps.clearRuntimeConnectionHints();
      deps.forcedRedirectHosts.clear();
      deps.resetStreamProfile();
      deps.bakeoffStartupDefers = 0;
      deps.setLastBakeoffAt(0);
      deps.lastSampleSegmentUrl = null;
      deps.bakeoffEpoch++;
      if (deps.bakeoffTimer) {
        clearTimeout(deps.bakeoffTimer);
        deps.bakeoffTimer = null;
      }
      if (deps.bakeoffAbortController) {
        try {
          deps.bakeoffAbortController.abort();
        } catch {
        }
        ;
        deps.bakeoffAbortController = null;
      }
      try {
        deps.Watchdog.reset();
      } catch {
      }
      try {
        deps.HttpDnsAutoPilot.onWatchdogReset();
      } catch {
      }
      if (!deps.disabled) {
        deps.beginRuntimeGeneration();
        setupCrossTab();
        deps.startCdnProbe();
        setupSeekPrewarm();
      }
      deps.refreshPublicDiagnosticSnapshot();
      deps.log("[SPA] 換片：" + key + "，重置選節點狀態");
    }, "onSpaNavigate");
    const hookHistory = /* @__PURE__ */ __name(() => {
      if (spaHooked) return;
      spaHooked = true;
      const h = unsafeWindow.history;
      ["pushState", "replaceState"].forEach((name) => {
        const orig = h[name];
        if (!orig || orig.__biliCdnHooked) return;
        const wrapped = /* @__PURE__ */ __name(function(...args) {
          const r = orig.apply(this, args);
          try {
            setTimeout(onSpaNavigate, 0);
          } catch {
          }
          return r;
        }, "wrapped");
        wrapped.__biliCdnHooked = true;
        h[name] = wrapped;
      });
      unsafeWindow.addEventListener("popstate", () => setTimeout(onSpaNavigate, 0));
    }, "hookHistory");
    let runtimeStarted = false;
    let keepWarmTimer = null;
    let periodicBakeoffTimer = null;
    const startRuntimeFeatures = /* @__PURE__ */ __name(() => {
      if (runtimeStarted || deps.disabled) return;
      runtimeStarted = true;
      deps.beginRuntimeGeneration();
      deps.refreshExpiredRestrictions();
      backgroundPlaybackEnabled = true;
      applyPageHooks();
      if (deps.codecResumeItems.length) deps.prepareCodecConfigurations(deps.codecResumeItems);
      blockWebRtc();
      deps.startCdnProbe();
      deps.Watchdog.start();
      hookHistory();
      setupCrossTab();
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", deps.discoverCdnFromPage, { once: true });
      } else {
        deps.discoverCdnFromPage();
      }
      setupSeekPrewarm();
      if (!keepWarmTimer) {
        keepWarmTimer = setInterval(() => {
          if (deps.disabled) return;
          const hosts = [...new Set([deps.resolvedCdn, ...deps.activeCdnList].filter(Boolean))].slice(0, 3);
          deps.preconnectBatch(hosts, !deps.inSeekGrace());
        }, 25e3);
      }
      if (!periodicBakeoffTimer) {
        periodicBakeoffTimer = setInterval(() => {
          if (deps.disabled || deps.resolvedCdn || !deps.lastSampleSegmentUrl) return;
          if (tabReallyHidden) return;
          deps.runThroughputBakeoff(deps.lastSampleSegmentUrl, false).catch(deps.reportMeasurementFailure());
        }, 4 * 60 * 1e3);
      }
    }, "startRuntimeFeatures");
    const stopRuntimeFeatures = /* @__PURE__ */ __name(() => {
      runtimeStarted = false;
      deps.stopRuntimeGeneration();
      deps.cdnProbeStarted = false;
      backgroundPlaybackEnabled = false;
      restoreWebRtc();
      deps.Watchdog.stop();
      deps.bakeoffEpoch++;
      if (deps.bakeoffTimer) {
        deps.clearRuntimeTimeout(deps.bakeoffTimer);
        deps.bakeoffTimer = null;
      }
      if (deps.bakeoffAbortController) {
        try {
          deps.bakeoffAbortController.abort();
        } catch {
        }
        ;
        deps.bakeoffAbortController = null;
      }
      if (deps.probeDeferTimer) {
        deps.clearRuntimeTimeout(deps.probeDeferTimer);
        deps.probeDeferTimer = null;
      }
      deps.probeDeferCount = 0;
      deps.clearRuntimeConnectionHints();
      closeCrossTab();
      if (stopSeekPrewarm) stopSeekPrewarm();
      if (keepWarmTimer) {
        clearInterval(keepWarmTimer);
        keepWarmTimer = null;
      }
      if (periodicBakeoffTimer) {
        clearInterval(periodicBakeoffTimer);
        periodicBakeoffTimer = null;
      }
    }, "stopRuntimeFeatures");
    const setRuntimeDisabled = /* @__PURE__ */ __name((nextDisabled) => {
      deps.TrustedMenuUI.invalidate();
      deps.disabled = !!nextDisabled;
      GM_setValue("disabled", deps.disabled);
      if (deps.disabled) stopRuntimeFeatures();
      else startRuntimeFeatures();
      deps.refreshPublicDiagnosticSnapshot();
      return deps.disabled;
    }, "setRuntimeDisabled");
    startRuntimeFeatures();
    const panel = createPlayerPanel({
      get uiInjectStatus() {
        return deps.uiInjectStatus;
      },
      set uiInjectStatus(v) {
        deps.uiInjectStatus = v;
      },
      get fromHTML() {
        return deps.fromHTML;
      },
      get SettingsBarTitle() {
        return deps.SettingsBarTitle;
      },
      get disabled() {
        return deps.disabled;
      },
      get setRuntimeDisabled() {
        return setRuntimeDisabled;
      },
      get TrustedMenuUI() {
        return deps.TrustedMenuUI;
      },
      get Watchdog() {
        return { stats: deps.Watchdog.stats };
      },
      get describePlaybackBuffer() {
        return deps.describePlaybackBuffer;
      },
      get resolvedCdn() {
        return deps.resolvedCdn;
      },
      get playbackRateState() {
        return { ...deps.playbackRateState };
      },
      get ASSUMED_PLAYBACK_RATE() {
        return deps.ASSUMED_PLAYBACK_RATE;
      },
      get cdnSoftBlockUntil() {
        return { ...deps.cdnSoftBlockUntil };
      },
      get isCdnSoftBlocked() {
        return deps.isCdnSoftBlocked;
      },
      get blacklistSet() {
        return new Set(deps.blacklistSet);
      },
      get knownDeadHosts() {
        return new Set(deps.knownDeadHosts);
      },
      get getCdnShortName() {
        return deps.getCdnShortName;
      },
      get waitForElm() {
        return deps.waitForElm;
      },
      get DiagnosticLog() {
        return deps.DiagnosticLog;
      }
    });
    setInterval(() => {
      deps.refreshExpiredRestrictions();
      deps.samplePlaybackQuality();
      if (!deps.disabled) deps.DiagnosticLog.sample(deps.readPlaybackDiagnostic());
      deps.refreshPublicDiagnosticSnapshot();
      panel.renderVisibleStatus();
    }, 1e3);
    deps.refreshPublicDiagnosticSnapshot();
    setInterval(panel.ensureUiPresent, 1500);
    return {};
  }
  __name(createApplication, "createApplication");

  // src/main.mjs
  function start(settingsInput) {
    let settings;
    let events;
    let runtime;
    let catalog;
    let health;
    let nativeRoutes;
    let rate;
    let mediaPolicy;
    let evidence;
    let media;
    let httpdns;
    let rewrite;
    let codec;
    let playurl;
    let transport;
    let failures;
    let dom;
    let latency;
    let bakeoff;
    let hints;
    let probe;
    let watchdog;
    let trustedUI;
    let report;
    let controls;
    let snapshot;
    let catalogControls;
    let views;
    let application;
    settings = createSettings({}, settingsInput);
    events = createEvents({
      get VERSION() {
        return settings.VERSION;
      },
      get TRUSTED_CDN_CATALOG_SET() {
        return catalog.TRUSTED_CDN_CATALOG_SET;
      },
      get mediaContextActive() {
        return media.mediaContextActive;
      }
    });
    runtime = createRuntime({
      get DiagnosticLog() {
        return events.DiagnosticLog;
      },
      get playinfoEpoch() {
        return media.playinfoEpoch;
      },
      get resetMediaDelivery() {
        return media.resetMediaDelivery;
      },
      get invalidateCodecQueries() {
        return codec.invalidateCodecQueries;
      },
      get resetPlaybackQuality() {
        return media.resetPlaybackQuality;
      }
    });
    catalog = createCatalog({
      get ExcludeHostKeywords() {
        return settings.ExcludeHostKeywords;
      }
    });
    health = createHealth({
      get TRUSTED_CDN_CATALOG_SET() {
        return catalog.TRUSTED_CDN_CATALOG_SET;
      },
      get VERSION() {
        return settings.VERSION;
      },
      get verGte() {
        return settings.verGte;
      },
      get isValidCustomCdnHost() {
        return catalog.isValidCustomCdnHost;
      },
      get PREFERRED_CDN_LIST() {
        return catalog.PREFERRED_CDN_LIST;
      },
      get PROBE_CACHE_KEY() {
        return latency.PROBE_CACHE_KEY;
      },
      get log() {
        return events.log;
      },
      get disabled() {
        return runtime.disabled;
      },
      get matchesExclude() {
        return catalog.matchesExclude;
      },
      get DiagnosticLog() {
        return events.DiagnosticLog;
      },
      get getEffectivePlaybackRate() {
        return rate.getEffectivePlaybackRate;
      },
      get currentStreamBitsPerSec() {
        return media.currentStreamBitsPerSec;
      },
      get INITIAL_DEAD_HOSTS_TW() {
        return catalog.INITIAL_DEAD_HOSTS_TW;
      },
      get isUnstableCdnHost() {
        return mediaPolicy.isUnstableCdnHost;
      },
      get Watchdog() {
        return watchdog.Watchdog;
      },
      get err() {
        return events.err;
      },
      get getWarmCdnHost() {
        return bakeoff.getWarmCdnHost;
      },
      get preconnectBatch() {
        return hints.preconnectBatch;
      },
      get inSeekGrace() {
        return rate.inSeekGrace;
      },
      get preconnectCdn() {
        return hints.preconnectCdn;
      },
      get CustomCDN() {
        return settings.CustomCDN;
      },
      get PluginName() {
        return events.PluginName;
      }
    });
    nativeRoutes = createNativeRoutes({
      get gmGet() {
        return (key) => GM_getValue(key);
      },
      get gmSet() {
        return (key, value) => GM_setValue(key, value);
      },
      get gmDelete() {
        return (key) => GM_deleteValue(key);
      },
      get TRUSTED_CDN_CATALOG_SET() {
        return catalog.TRUSTED_CDN_CATALOG_SET;
      },
      get parseMediaHttpUrl() {
        return mediaPolicy.parseMediaHttpUrl;
      },
      get classifyMediaDelivery() {
        return mediaPolicy.classifyMediaDelivery;
      },
      get mediaUrlPolicy() {
        return mediaPolicy.mediaUrlPolicy;
      },
      get isMediaSegmentUrl() {
        return rewrite.isMediaSegmentUrl;
      },
      get normalizeCodecName() {
        return codec.normalizeCodecName;
      },
      get playinfoEpoch() {
        return media.playinfoEpoch;
      },
      get resolvedCdn() {
        return health.resolvedCdn;
      },
      get disabled() {
        return runtime.disabled;
      },
      get peekCurrentCdn() {
        return health.peekCurrentCdn;
      },
      get getRequiredStreamMbps() {
        return health.getRequiredStreamMbps;
      },
      get getCdnHealthScore() {
        return health.getCdnHealthScore;
      },
      get scoreRouteHealth() {
        return health.scoreRouteHealth;
      },
      get cdnHealth() {
        return health.cdnHealth;
      },
      get playbackRateState() {
        return rate.playbackRateState;
      },
      get getVideo() {
        return watchdog.Watchdog.getVideo;
      },
      get DiagnosticLog() {
        return events.DiagnosticLog;
      },
      get onActiveRepresentation() {
        return (sampleUrl, _groupId, transition) => {
          if (transition?.switched) try {
            watchdog.Watchdog.noteCdnSwitched();
          } catch {
          }
          bakeoff.scheduleBakeoff(sampleUrl);
        };
      }
    });
    rate = createRate({
      get currentStreamBitsPerSec() {
        return media.currentStreamBitsPerSec;
      }
    });
    mediaPolicy = createMediaPolicy({
      get matchesExclude() {
        return catalog.matchesExclude;
      },
      get knownDeadHosts() {
        return health.knownDeadHosts;
      },
      get blacklistSet() {
        return health.blacklistSet;
      },
      get isCdnSoftBlocked() {
        return health.isCdnSoftBlocked;
      },
      get isValidCustomCdnHost() {
        return catalog.isValidCustomCdnHost;
      },
      get preconnectCdn() {
        return hints.preconnectCdn;
      },
      get resolvedCdn() {
        return health.resolvedCdn;
      },
      get getCurrentCdn() {
        return health.getCurrentCdn;
      },
      get activeCdnList() {
        return health.activeCdnList;
      },
      get PREFERRED_CDN_LIST() {
        return catalog.PREFERRED_CDN_LIST;
      },
      get decideMediaRewrite() {
        return rewrite.decideMediaRewrite;
      },
      get redirectStats() {
        return evidence.redirectStats;
      },
      get needsRedirect() {
        return rewrite.needsRedirect;
      },
      get replaceUrlHost() {
        return rewrite.replaceUrlHost;
      }
    });
    evidence = createEvidence({
      get disabled() {
        return runtime.disabled;
      },
      get isRuntimeGenerationActive() {
        return runtime.isRuntimeGenerationActive;
      },
      get observeMediaTransfer() {
        return media.observeMediaTransfer;
      },
      get Watchdog() {
        return watchdog.Watchdog;
      },
      get recordCdnThroughput() {
        return health.recordCdnThroughput;
      },
      get recordNativeThroughput() {
        return nativeRoutes.recordNativeThroughput;
      },
      get playbackRateState() {
        return rate.playbackRateState;
      }
    });
    media = createMedia({
      get getEffectivePlaybackRate() {
        return rate.getEffectivePlaybackRate;
      },
      get getRequiredStreamMbps() {
        return health.getRequiredStreamMbps;
      },
      get DiagnosticLog() {
        return events.DiagnosticLog;
      },
      get runtimeGeneration() {
        return runtime.runtimeGeneration;
      },
      get isMediaSegmentUrl() {
        return rewrite.isMediaSegmentUrl;
      },
      get captureRuntimeGeneration() {
        return runtime.captureRuntimeGeneration;
      },
      get isRuntimeGenerationActive() {
        return runtime.isRuntimeGenerationActive;
      },
      get Watchdog() {
        return watchdog.Watchdog;
      },
      get classifyMediaDelivery() {
        return mediaPolicy.classifyMediaDelivery;
      },
      get TRUSTED_CDN_CATALOG_SET() {
        return catalog.TRUSTED_CDN_CATALOG_SET;
      },
      get disabled() {
        return runtime.disabled;
      },
      get clearCodecPlayinfo() {
        return codec.clearCodecPlayinfo;
      },
      get hostLockedStreams() {
        return rewrite.hostLockedStreams;
      },
      get preservedOriginalStreamUrls() {
        return rewrite.preservedOriginalStreamUrls;
      },
      get rewrittenStreamOrigins() {
        return rewrite.rewrittenStreamOrigins;
      },
      get seekGraceUntil() {
        return rate.seekGraceUntil;
      },
      set seekGraceUntil(value) {
        rate.seekGraceUntil = value;
      },
      get resetPlaybackRateState() {
        return rate.resetPlaybackRateState;
      },
      get resetNativeRoutePool() {
        return nativeRoutes.resetPool;
      },
      get captureNativeRouteContext() {
        return nativeRoutes.captureRouteContext;
      },
      get observeNativeTransport() {
        return nativeRoutes.observeTransport;
      }
    });
    httpdns = createHttpdns({
      get BlockHttpDNS() {
        return settings.BlockHttpDNS;
      },
      set BlockHttpDNS(value) {
        settings.BlockHttpDNS = value;
      },
      get getRequiredStreamMbps() {
        return health.getRequiredStreamMbps;
      },
      get redirectStats() {
        return evidence.redirectStats;
      },
      get PROBE_CACHE_KEY() {
        return latency.PROBE_CACHE_KEY;
      }
    });
    rewrite = createRewrite({
      get redirectStats() {
        return evidence.redirectStats;
      },
      get parseMediaHttpUrl() {
        return mediaPolicy.parseMediaHttpUrl;
      },
      get classifyMediaDelivery() {
        return mediaPolicy.classifyMediaDelivery;
      },
      get rewriteUnstableMediaUrl() {
        return mediaPolicy.rewriteUnstableMediaUrl;
      },
      get isAkamaiUrl() {
        return mediaPolicy.isAkamaiUrl;
      },
      get isForcedRedirect() {
        return failures.isForcedRedirect;
      },
      get getCurrentCdn() {
        return health.getCurrentCdn;
      },
      get isBiliFragmentUrl() {
        return playurl.isBiliFragmentUrl;
      },
      get getBiliVideoCdn() {
        return mediaPolicy.getBiliVideoCdn;
      },
      get inSeekGrace() {
        return rate.inSeekGrace;
      },
      get matchesExclude() {
        return catalog.matchesExclude;
      },
      get knownDeadHosts() {
        return health.knownDeadHosts;
      },
      get blacklistSet() {
        return health.blacklistSet;
      },
      get isUnstableCdnHost() {
        return mediaPolicy.isUnstableCdnHost;
      },
      get DiagnosticLog() {
        return events.DiagnosticLog;
      },
      get log() {
        return events.log;
      },
      get resolvedCdn() {
        return health.resolvedCdn;
      },
      get isCdnStronglyBad() {
        return health.isCdnStronglyBad;
      },
      get PREFERRED_CDN_LIST() {
        return catalog.PREFERRED_CDN_LIST;
      },
      get mediaUrlPolicy() {
        return mediaPolicy.mediaUrlPolicy;
      },
      get isValidCustomCdnHost() {
        return catalog.isValidCustomCdnHost;
      },
      get MEDIA_URL_MAX_LENGTH() {
        return mediaPolicy.MEDIA_URL_MAX_LENGTH;
      },
      get getHealthyCdnList() {
        return health.getHealthyCdnList;
      },
      get STARTUP_PICK() {
        return health.STARTUP_PICK;
      },
      get isBiliVideoUrl() {
        return mediaPolicy.isBiliVideoUrl;
      },
      get noteDiscoveredCdn() {
        return mediaPolicy.noteDiscoveredCdn;
      },
      get isProtectedSignedUrl() {
        return nativeRoutes.isProtectedSignedUrl;
      }
    });
    codec = createCodec({
      get PreferredVideoCodec() {
        return settings.PreferredVideoCodec;
      },
      get disabled() {
        return runtime.disabled;
      },
      get isRuntimeGenerationActive() {
        return runtime.isRuntimeGenerationActive;
      },
      get captureRuntimeGeneration() {
        return runtime.captureRuntimeGeneration;
      }
    });
    playurl = createPlayurl({
      get clearCodecPlayinfo() {
        return codec.clearCodecPlayinfo;
      },
      get resetRepresentationRegistry() {
        return media.resetRepresentationRegistry;
      },
      get streamEstimate() {
        return media.streamEstimate;
      },
      set streamEstimate(value) {
        media.streamEstimate = value;
      },
      get streamProfile() {
        return media.streamProfile;
      },
      set streamProfile(value) {
        media.streamProfile = value;
      },
      get currentStreamBitsPerSec() {
        return media.currentStreamBitsPerSec;
      },
      set currentStreamBitsPerSec(value) {
        media.currentStreamBitsPerSec = value;
      },
      get baseBufferTargetBytes() {
        return media.baseBufferTargetBytes;
      },
      set baseBufferTargetBytes(value) {
        media.baseBufferTargetBytes = value;
      },
      get DEFAULT_BUFFER_TARGET_BYTES() {
        return media.DEFAULT_BUFFER_TARGET_BYTES;
      },
      get registerMediaRepresentation() {
        return media.registerMediaRepresentation;
      },
      get muxedRepresentationRegistry() {
        return media.muxedRepresentationRegistry;
      },
      get pickStreamUrls() {
        return rewrite.pickStreamUrls;
      },
      get AUDIO_REGISTRY_MAX() {
        return media.AUDIO_REGISTRY_MAX;
      },
      get transformStreamItem() {
        return rewrite.transformStreamItem;
      },
      get sanitizePlayInfoUrls() {
        return rewrite.sanitizePlayInfoUrls;
      },
      get normalizeDashCodecPreference() {
        return codec.normalizeDashCodecPreference;
      },
      get normalizeCodecName() {
        return codec.normalizeCodecName;
      },
      get rebuildRepresentationRegistry() {
        return media.rebuildRepresentationRegistry;
      },
      get setBufferTargetFromBitrate() {
        return media.setBufferTargetFromBitrate;
      },
      get isBiliVideoUrl() {
        return mediaPolicy.isBiliVideoUrl;
      },
      get isAkamaiUrl() {
        return mediaPolicy.isAkamaiUrl;
      },
      get scheduleBakeoff() {
        return bakeoff.scheduleBakeoff;
      },
      get err() {
        return events.err;
      },
      get parseMediaHttpUrl() {
        return mediaPolicy.parseMediaHttpUrl;
      },
      get mediaUrlPolicy() {
        return mediaPolicy.mediaUrlPolicy;
      },
      get registerSignedRouteGroup() {
        return nativeRoutes.registerSignedRouteGroup;
      },
      get applySignedRoutePlan() {
        return nativeRoutes.applySignedRoutePlan;
      }
    });
    transport = createTransport({
      get disabled() {
        return runtime.disabled;
      },
      get DiagnosticLog() {
        return events.DiagnosticLog;
      },
      get isRuntimeGenerationActive() {
        return runtime.isRuntimeGenerationActive;
      },
      get captureRuntimeGeneration() {
        return runtime.captureRuntimeGeneration;
      },
      get captureMediaRequest() {
        return media.captureMediaRequest;
      },
      get isBiliJsonMetadataApi() {
        return mediaPolicy.isBiliJsonMetadataApi;
      },
      get isHttpDnsUrl() {
        return mediaPolicy.isHttpDnsUrl;
      },
      get shouldBlockHttpDns() {
        return httpdns.shouldBlockHttpDns;
      },
      get redirectStats() {
        return evidence.redirectStats;
      },
      get isMediaSegmentUrl() {
        return rewrite.isMediaSegmentUrl;
      },
      get getOriginalStreamUrl() {
        return rewrite.getOriginalStreamUrl;
      },
      get normalizeMediaUrl() {
        return rewrite.normalizeMediaUrl;
      },
      get getBiliVideoCdn() {
        return mediaPolicy.getBiliVideoCdn;
      },
      get err() {
        return events.err;
      },
      get mediaContextActive() {
        return media.mediaContextActive;
      },
      get handleVerifiedSegmentFailure() {
        return failures.handleVerifiedSegmentFailure;
      },
      get TRUSTED_XHR_TIMEOUT_EVIDENCE() {
        return health.TRUSTED_XHR_TIMEOUT_EVIDENCE;
      },
      get observeMediaTransfer() {
        return media.observeMediaTransfer;
      },
      get Watchdog() {
        return watchdog.Watchdog;
      },
      get noteSegmentAccounted() {
        return evidence.noteSegmentAccounted;
      },
      get HARD_FAIL_STATUSES() {
        return health.HARD_FAIL_STATUSES;
      },
      get recordCdnSuccess() {
        return health.recordCdnSuccess;
      },
      get noteSegmentBytes() {
        return evidence.noteSegmentBytes;
      },
      get isPlayUrlApi() {
        return catalog.isPlayUrlApi;
      },
      get recordCdnThroughput() {
        return health.recordCdnThroughput;
      },
      get playbackRateState() {
        return rate.playbackRateState;
      },
      get resolveRequestRoute() {
        return nativeRoutes.resolveRequestRoute;
      },
      get noteNativeRouteFailure() {
        return nativeRoutes.noteNativeFailure;
      },
      get recordNativeThroughput() {
        return nativeRoutes.recordNativeThroughput;
      }
    });
    failures = createFailures({
      get TRUSTED_CDN_CATALOG() {
        return catalog.TRUSTED_CDN_CATALOG;
      },
      get isValidCustomCdnHost() {
        return catalog.isValidCustomCdnHost;
      },
      get disabled() {
        return runtime.disabled;
      },
      get isMediaSegmentUrl() {
        return rewrite.isMediaSegmentUrl;
      },
      get DiagnosticLog() {
        return events.DiagnosticLog;
      },
      get noteHostLockedStream() {
        return rewrite.noteHostLockedStream;
      },
      get inSeekGrace() {
        return rate.inSeekGrace;
      },
      get TRUSTED_XHR_TIMEOUT_EVIDENCE() {
        return health.TRUSTED_XHR_TIMEOUT_EVIDENCE;
      },
      get MIN_THROUGHPUT_SAMPLE_BYTES() {
        return health.MIN_THROUGHPUT_SAMPLE_BYTES;
      },
      get XHR_TIMEOUT_MIN_ELAPSED_MS() {
        return health.XHR_TIMEOUT_MIN_ELAPSED_MS;
      },
      get acceptedXhrTimeoutAt() {
        return health.acceptedXhrTimeoutAt;
      },
      get XHR_TIMEOUT_HOST_GAP_MS() {
        return health.XHR_TIMEOUT_HOST_GAP_MS;
      },
      get HARD_FAIL_STATUSES() {
        return health.HARD_FAIL_STATUSES;
      },
      get recordCdnFailure() {
        return health.recordCdnFailure;
      },
      get handleSegmentConnError() {
        return latency.handleSegmentConnError;
      },
      get publicFinite() {
        return snapshot.publicFinite;
      },
      get promoteBestCdnNow() {
        return health.promoteBestCdnNow;
      },
      get preconnectBatch() {
        return hints.preconnectBatch;
      },
      get getHealthyCdnList() {
        return health.getHealthyCdnList;
      },
      get lastSampleSegmentUrl() {
        return bakeoff.lastSampleSegmentUrl;
      },
      get currentStreamBitsPerSec() {
        return media.currentStreamBitsPerSec;
      },
      get playbackRateState() {
        return rate.playbackRateState;
      },
      get runThroughputBakeoff() {
        return bakeoff.runThroughputBakeoff;
      },
      get trustedBakeoffRequest() {
        return bakeoff.trustedBakeoffRequest;
      },
      get reportMeasurementFailure() {
        return runtime.reportMeasurementFailure;
      }
    });
    dom = createDom({});
    latency = createLatency({
      get captureRuntimeGeneration() {
        return runtime.captureRuntimeGeneration;
      },
      get isRuntimeGenerationActive() {
        return runtime.isRuntimeGenerationActive;
      },
      get clearRuntimeTimeout() {
        return runtime.clearRuntimeTimeout;
      },
      get scheduleRuntimeTimeout() {
        return runtime.scheduleRuntimeTimeout;
      },
      get interceptNetResponse() {
        return transport.interceptNetResponse;
      },
      get disabled() {
        return runtime.disabled;
      },
      get knownDeadHosts() {
        return health.knownDeadHosts;
      },
      get blacklistSet() {
        return health.blacklistSet;
      },
      get isPresumedDnsFailHost() {
        return health.isPresumedDnsFailHost;
      },
      get markHostDead() {
        return health.markHostDead;
      },
      get log() {
        return events.log;
      },
      get promoteBestCdnNow() {
        return health.promoteBestCdnNow;
      },
      get DiagnosticLog() {
        return events.DiagnosticLog;
      },
      get recordCdnLatency() {
        return health.recordCdnLatency;
      },
      get ensureCdnHealth() {
        return health.ensureCdnHealth;
      },
      get CDN_HEALTH_CAPS() {
        return health.CDN_HEALTH_CAPS;
      },
      get scheduleCdnHealthSave() {
        return health.scheduleCdnHealthSave;
      },
      get softBlockCdn() {
        return health.softBlockCdn;
      },
      get cdnHealth() {
        return health.cdnHealth;
      }
    });
    bakeoff = createBakeoff({
      get captureRuntimeGeneration() {
        return runtime.captureRuntimeGeneration;
      },
      get isRuntimeGenerationActive() {
        return runtime.isRuntimeGenerationActive;
      },
      get isValidCustomCdnHost() {
        return catalog.isValidCustomCdnHost;
      },
      get blacklistSet() {
        return health.blacklistSet;
      },
      get knownDeadHosts() {
        return health.knownDeadHosts;
      },
      get matchesExclude() {
        return catalog.matchesExclude;
      },
      get isPresumedDnsFailHost() {
        return health.isPresumedDnsFailHost;
      },
      get decideMediaRewrite() {
        return rewrite.decideMediaRewrite;
      },
      get replaceUrlHost() {
        return rewrite.replaceUrlHost;
      },
      get clearRuntimeTimeout() {
        return runtime.clearRuntimeTimeout;
      },
      get recordCdnThroughput() {
        return health.recordCdnThroughput;
      },
      get playbackRateState() {
        return rate.playbackRateState;
      },
      get recordCdnLatency() {
        return health.recordCdnLatency;
      },
      get redirectStats() {
        return evidence.redirectStats;
      },
      get DiagnosticLog() {
        return events.DiagnosticLog;
      },
      get scheduleRuntimeTimeout() {
        return runtime.scheduleRuntimeTimeout;
      },
      get interceptNetResponse() {
        return transport.interceptNetResponse;
      },
      get getAttributedVideoHost() {
        return media.getAttributedVideoHost;
      },
      get resolvedCdn() {
        return health.resolvedCdn;
      },
      get lastChosenCdn() {
        return health.lastChosenCdn;
      },
      get activeCdnList() {
        return health.activeCdnList;
      },
      get Watchdog() {
        return watchdog.Watchdog;
      },
      get disabled() {
        return runtime.disabled;
      },
      get inSeekGrace() {
        return rate.inSeekGrace;
      },
      get isBiliVideoUrl() {
        return mediaPolicy.isBiliVideoUrl;
      },
      get isHostLockedStream() {
        return rewrite.isHostLockedStream;
      },
      get reportMeasurementFailure() {
        return runtime.reportMeasurementFailure;
      },
      get cdnHealth() {
        return health.cdnHealth;
      },
      get getRequiredStreamMbps() {
        return health.getRequiredStreamMbps;
      },
      get PREFERRED_CDN_LIST() {
        return catalog.PREFERRED_CDN_LIST;
      },
      get isCdnSoftBlocked() {
        return health.isCdnSoftBlocked;
      },
      get currentStreamBitsPerSec() {
        return media.currentStreamBitsPerSec;
      },
      get noteHostLockedStream() {
        return rewrite.noteHostLockedStream;
      },
      get err() {
        return events.err;
      },
      get getHealthyCdnList() {
        return health.getHealthyCdnList;
      },
      get addForcedRedirect() {
        return failures.addForcedRedirect;
      },
      get log() {
        return events.log;
      },
      get promoteBestCdnNow() {
        return health.promoteBestCdnNow;
      },
      get PROBE_CACHE_KEY() {
        return latency.PROBE_CACHE_KEY;
      },
      get getNativeProbeCandidate() {
        return nativeRoutes.getNativeProbeCandidate;
      },
      get recordNativeProbe() {
        return nativeRoutes.recordNativeProbe;
      },
      get setNativeBakeoffDiagnostics() {
        return nativeRoutes.setLastBakeoff;
      }
    });
    hints = createHints({
      get isValidCustomCdnHost() {
        return catalog.isValidCustomCdnHost;
      },
      get resolvedCdn() {
        return health.resolvedCdn;
      },
      get knownDeadHosts() {
        return health.knownDeadHosts;
      },
      get blacklistSet() {
        return health.blacklistSet;
      },
      get isCdnSoftBlocked() {
        return health.isCdnSoftBlocked;
      },
      get matchesExclude() {
        return catalog.matchesExclude;
      },
      get isPresumedDnsFailHost() {
        return health.isPresumedDnsFailHost;
      }
    });
    probe = createProbe({
      get activeCdnList() {
        return health.activeCdnList;
      },
      get cdnHealth() {
        return health.cdnHealth;
      },
      get knownDeadHosts() {
        return health.knownDeadHosts;
      },
      get blacklistSet() {
        return health.blacklistSet;
      },
      get scheduleRuntimeTimeout() {
        return runtime.scheduleRuntimeTimeout;
      },
      get isStartupBuffering() {
        return bakeoff.isStartupBuffering;
      },
      get reportMeasurementFailure() {
        return runtime.reportMeasurementFailure;
      },
      get disabled() {
        return runtime.disabled;
      },
      get captureRuntimeGeneration() {
        return runtime.captureRuntimeGeneration;
      },
      get isRuntimeGenerationActive() {
        return runtime.isRuntimeGenerationActive;
      },
      get resolvedCdn() {
        return health.resolvedCdn;
      },
      get preconnectCdn() {
        return hints.preconnectCdn;
      },
      get bakeoffRunning() {
        return bakeoff.bakeoffRunning;
      },
      get inSeekGrace() {
        return rate.inSeekGrace;
      },
      get PROBE_CACHE_KEY() {
        return latency.PROBE_CACHE_KEY;
      },
      get PROBE_CACHE_TTL() {
        return latency.PROBE_CACHE_TTL;
      },
      get isCdnSoftBlocked() {
        return health.isCdnSoftBlocked;
      },
      get PREFERRED_CDN_LIST() {
        return catalog.PREFERRED_CDN_LIST;
      },
      get promoteBestCdnNow() {
        return health.promoteBestCdnNow;
      },
      get preconnectBatch() {
        return hints.preconnectBatch;
      },
      get isPresumedDnsFailHost() {
        return health.isPresumedDnsFailHost;
      },
      get probeCdnLatency() {
        return latency.probeCdnLatency;
      },
      get log() {
        return events.log;
      },
      get getHealthyCdnList() {
        return health.getHealthyCdnList;
      }
    });
    watchdog = createWatchdog({
      get cdnHealth() {
        return health.cdnHealth;
      },
      get cdnSoftBlockUntil() {
        return health.cdnSoftBlockUntil;
      },
      get activeCdnList() {
        return health.activeCdnList;
      },
      get blacklistSet() {
        return health.blacklistSet;
      },
      get knownDeadHosts() {
        return health.knownDeadHosts;
      },
      get PREFERRED_CDN_LIST() {
        return catalog.PREFERRED_CDN_LIST;
      },
      get scheduleCdnHealthSave() {
        return health.scheduleCdnHealthSave;
      },
      get promoteBestCdnNow() {
        return health.promoteBestCdnNow;
      },
      get freshMediaObservation() {
        return media.freshMediaObservation;
      },
      get DiagnosticLog() {
        return events.DiagnosticLog;
      },
      get runtimeGeneration() {
        return runtime.runtimeGeneration;
      },
      get playinfoEpoch() {
        return media.playinfoEpoch;
      },
      get inSeekGrace() {
        return rate.inSeekGrace;
      },
      get getAttributedVideoHost() {
        return media.getAttributedVideoHost;
      },
      get disabled() {
        return runtime.disabled;
      },
      get wasSegmentAccounted() {
        return evidence.wasSegmentAccounted;
      },
      get TRUSTED_CDN_CATALOG_SET() {
        return catalog.TRUSTED_CDN_CATALOG_SET;
      },
      get observeMediaTransfer() {
        return media.observeMediaTransfer;
      },
      get captureMediaRequest() {
        return media.captureMediaRequest;
      },
      get syncPlaybackRateFromVideo() {
        return rate.syncPlaybackRateFromVideo;
      },
      get playbackRateState() {
        return rate.playbackRateState;
      },
      get recordCdnThroughput() {
        return health.recordCdnThroughput;
      },
      get bumpSeekGrace() {
        return rate.bumpSeekGrace;
      },
      get currentStreamBitsPerSec() {
        return media.currentStreamBitsPerSec;
      },
      get log() {
        return events.log;
      },
      get readPlaybackDiagnostic() {
        return report.readPlaybackDiagnostic;
      },
      get HttpDnsAutoPilot() {
        return httpdns.HttpDnsAutoPilot;
      },
      get reorderCdnsByLatency() {
        return probe.reorderCdnsByLatency;
      },
      get reportMeasurementFailure() {
        return runtime.reportMeasurementFailure;
      },
      get isUnstableCdnHost() {
        return mediaPolicy.isUnstableCdnHost;
      },
      get recordCdnPenalty() {
        return health.recordCdnPenalty;
      },
      get softBlockCdn() {
        return health.softBlockCdn;
      },
      get CDN_SOFT_BLOCK_MS() {
        return health.CDN_SOFT_BLOCK_MS;
      },
      get PROBE_CACHE_KEY() {
        return latency.PROBE_CACHE_KEY;
      },
      get getWarmCdnHost() {
        return bakeoff.getWarmCdnHost;
      },
      get getHealthyCdnList() {
        return health.getHealthyCdnList;
      },
      get preconnectBatch() {
        return hints.preconnectBatch;
      },
      get preconnectCdn() {
        return hints.preconnectCdn;
      },
      get scheduleRuntimeTimeout() {
        return runtime.scheduleRuntimeTimeout;
      },
      get bakeoffRunning() {
        return bakeoff.bakeoffRunning;
      },
      get lastSampleSegmentUrl() {
        return bakeoff.lastSampleSegmentUrl;
      },
      get runThroughputBakeoff() {
        return bakeoff.runThroughputBakeoff;
      },
      get trustedBakeoffRequest() {
        return bakeoff.trustedBakeoffRequest;
      },
      get resetPlaybackRateState() {
        return rate.resetPlaybackRateState;
      },
      get syncStreamBitrateFromVideo() {
        return media.syncStreamBitrateFromVideo;
      },
      get getBufferTargetBytes() {
        return media.getBufferTargetBytes;
      },
      get getWatchdogRequiredBps() {
        return media.getWatchdogRequiredBps;
      },
      get resetMediaDelivery() {
        return media.resetMediaDelivery;
      },
      get getRequiredStreamMbps() {
        return health.getRequiredStreamMbps;
      },
      get getCdnHealthScore() {
        return health.getCdnHealthScore;
      }
    });
    trustedUI = createTrustedUI({
      get Watchdog() {
        return { getVideo: watchdog.Watchdog.getVideo };
      }
    });
    report = createReport({
      get playbackRateState() {
        return rate.playbackRateState;
      },
      get Watchdog() {
        return watchdog.Watchdog;
      },
      get DiagnosticLog() {
        return events.DiagnosticLog;
      },
      get getHttpDnsStatus() {
        return httpdns.getHttpDnsStatus;
      },
      get VERSION() {
        return settings.VERSION;
      },
      get uiInjectStatus() {
        return runtime.uiInjectStatus;
      },
      get disabled() {
        return runtime.disabled;
      },
      get activeCdnList() {
        return health.activeCdnList;
      },
      get getHealthyCdnList() {
        return health.getHealthyCdnList;
      },
      get blacklistSet() {
        return health.blacklistSet;
      },
      get listDeadHosts() {
        return health.listDeadHosts;
      },
      get getCdnShortName() {
        return health.getCdnShortName;
      },
      get getMediaDeliverySnapshot() {
        return media.getMediaDeliverySnapshot;
      },
      get describePlaybackBuffer() {
        return snapshot.describePlaybackBuffer;
      },
      get resolvedVideoCodecPreference() {
        return codec.resolvedVideoCodecPreference;
      },
      get lastCodecDecision() {
        return codec.lastCodecDecision;
      },
      get getCurrentCodecDiagnostics() {
        return codec.getCurrentCodecDiagnostics;
      },
      get streamEstimate() {
        return media.streamEstimate;
      },
      get playbackQualitySnapshot() {
        return media.playbackQualitySnapshot;
      },
      get pageDiscoveredCdn() {
        return mediaPolicy.pageDiscoveredCdn;
      },
      get redirectStats() {
        return evidence.redirectStats;
      },
      get getNativeRouteDiagnostics() {
        return nativeRoutes.diagnostics;
      },
      get Config() {
        return events.Config;
      }
    });
    controls = createControls({
      get TrustedMenuUI() {
        return trustedUI.TrustedMenuUI;
      },
      get buildDiagReport() {
        return report.buildDiagReport;
      },
      get DiagnosticLog() {
        return events.DiagnosticLog;
      },
      get log() {
        return events.log;
      },
      get activeCdnList() {
        return health.activeCdnList;
      },
      get blacklistSet() {
        return health.blacklistSet;
      },
      get cdnSoftBlockUntil() {
        return health.cdnSoftBlockUntil;
      },
      get isCdnSoftBlocked() {
        return health.isCdnSoftBlocked;
      },
      get listDeadHosts() {
        return health.listDeadHosts;
      },
      get PREFERRED_CDN_LIST() {
        return catalog.PREFERRED_CDN_LIST;
      },
      get isPresumedDnsFailHost() {
        return health.isPresumedDnsFailHost;
      },
      get cdnFailCount() {
        return health.cdnFailCount;
      },
      get cdnHealth() {
        return health.cdnHealth;
      },
      get getCdnHealthScore() {
        return health.getCdnHealthScore;
      },
      get playbackRateState() {
        return rate.playbackRateState;
      },
      get streamEstimate() {
        return media.streamEstimate;
      },
      get getMediaDeliverySnapshot() {
        return media.getMediaDeliverySnapshot;
      },
      get getNativeRouteDiagnostics() {
        return nativeRoutes.diagnostics;
      },
      get playbackQualitySnapshot() {
        return media.playbackQualitySnapshot;
      },
      get getCurrentCodecDiagnostics() {
        return codec.getCurrentCodecDiagnostics;
      },
      get resolvedVideoCodecPreference() {
        return codec.resolvedVideoCodecPreference;
      },
      get getCodecCapabilityState() {
        return codec.getCodecCapabilityState;
      },
      get lastCodecDecision() {
        return codec.lastCodecDecision;
      },
      get Config() {
        return events.Config;
      },
      get redirectStats() {
        return evidence.redirectStats;
      },
      get pageDiscoveredCdn() {
        return mediaPolicy.pageDiscoveredCdn;
      },
      set pageDiscoveredCdn(value) {
        mediaPolicy.pageDiscoveredCdn = value;
      },
      get getHttpDnsStatus() {
        return httpdns.getHttpDnsStatus;
      },
      get uiInjectStatus() {
        return runtime.uiInjectStatus;
      },
      get disabled() {
        return runtime.disabled;
      },
      get resolvedCdn() {
        return health.resolvedCdn;
      },
      get lastSampleSegmentUrl() {
        return bakeoff.lastSampleSegmentUrl;
      },
      get inSeekGrace() {
        return rate.inSeekGrace;
      },
      get bakeoffRunning() {
        return bakeoff.bakeoffRunning;
      },
      get trustedBakeoffLastAt() {
        return bakeoff.trustedBakeoffLastAt;
      },
      get TRUSTED_BAKEOFF_MIN_GAP() {
        return bakeoff.TRUSTED_BAKEOFF_MIN_GAP;
      },
      get runThroughputBakeoff() {
        return bakeoff.runThroughputBakeoff;
      },
      get trustedBakeoffRequest() {
        return bakeoff.trustedBakeoffRequest;
      },
      get TRUSTED_CDN_CATALOG() {
        return catalog.TRUSTED_CDN_CATALOG;
      },
      get getCdnShortName() {
        return health.getCdnShortName;
      },
      get isHostLockedStream() {
        return rewrite.isHostLockedStream;
      },
      get clearBlacklist() {
        return health.clearBlacklist;
      },
      get clearDeadHosts() {
        return health.clearDeadHosts;
      },
      get CDN_HEALTH_KEY() {
        return health.CDN_HEALTH_KEY;
      },
      get lastChosenCdn() {
        return health.lastChosenCdn;
      },
      set lastChosenCdn(value) {
        health.lastChosenCdn = value;
      },
      get HttpDnsAutoPilot() {
        return httpdns.HttpDnsAutoPilot;
      },
      get hostLockedStreams() {
        return rewrite.hostLockedStreams;
      },
      get preservedOriginalStreamUrls() {
        return rewrite.preservedOriginalStreamUrls;
      },
      get rewrittenStreamOrigins() {
        return rewrite.rewrittenStreamOrigins;
      },
      get clearNativeRouteLedger() {
        return nativeRoutes.clearLedger;
      },
      get PROBE_CACHE_KEY() {
        return latency.PROBE_CACHE_KEY;
      },
      get Watchdog() {
        return watchdog.Watchdog;
      },
      get setHttpDnsMode() {
        return httpdns.setHttpDnsMode;
      },
      get reorderRunning() {
        return probe.reorderRunning;
      },
      get reorderCdnsByLatency() {
        return probe.reorderCdnsByLatency;
      },
      get TRUSTED_CDN_CATALOG_SET() {
        return catalog.TRUSTED_CDN_CATALOG_SET;
      },
      get knownDeadHosts() {
        return health.knownDeadHosts;
      },
      get reviveDeadHost() {
        return health.reviveDeadHost;
      },
      get promoteBestCdnNow() {
        return health.promoteBestCdnNow;
      },
      get scheduleCdnHealthSave() {
        return health.scheduleCdnHealthSave;
      },
      get DEAD_HOSTS_KEY() {
        return health.DEAD_HOSTS_KEY;
      },
      get isValidCustomCdnHost() {
        return catalog.isValidCustomCdnHost;
      },
      get ExcludeHostKeywords() {
        return settings.ExcludeHostKeywords;
      },
      get rebuildPreferredCdnList() {
        return catalog.rebuildPreferredCdnList;
      },
      get matchesExclude() {
        return catalog.matchesExclude;
      },
      get getHealthyCdnList() {
        return health.getHealthyCdnList;
      }
    });
    snapshot = createSnapshot({
      get playbackRateState() {
        return rate.playbackRateState;
      },
      get ASSUMED_PLAYBACK_RATE() {
        return rate.ASSUMED_PLAYBACK_RATE;
      },
      get Watchdog() {
        return watchdog.Watchdog;
      },
      get getHttpDnsStatus() {
        return httpdns.getHttpDnsStatus;
      },
      get TRUSTED_CDN_CATALOG() {
        return catalog.TRUSTED_CDN_CATALOG;
      },
      get cdnHealth() {
        return health.cdnHealth;
      },
      get isCdnSoftBlocked() {
        return health.isCdnSoftBlocked;
      },
      get VERSION() {
        return settings.VERSION;
      },
      get DiagnosticLog() {
        return events.DiagnosticLog;
      },
      get disabled() {
        return runtime.disabled;
      },
      get peekCurrentCdn() {
        return health.peekCurrentCdn;
      },
      get activeCdnList() {
        return health.activeCdnList;
      },
      get getHealthyCdnList() {
        return health.getHealthyCdnList;
      },
      get isCatalogAutoEnabled() {
        return catalog.isCatalogAutoEnabled;
      },
      get catalogOverrides() {
        return catalog.catalogOverrides;
      },
      get blacklistSet() {
        return health.blacklistSet;
      },
      get cdnSoftBlockUntil() {
        return health.cdnSoftBlockUntil;
      },
      get listDeadHosts() {
        return health.listDeadHosts;
      },
      get pageDiscoveredCdn() {
        return mediaPolicy.pageDiscoveredCdn;
      },
      get redirectStats() {
        return evidence.redirectStats;
      },
      get getEffectivePlaybackRate() {
        return rate.getEffectivePlaybackRate;
      },
      get getMediaDeliverySnapshot() {
        return media.getMediaDeliverySnapshot;
      },
      get getNativeRouteDiagnostics() {
        return nativeRoutes.diagnostics;
      },
      get playbackQualitySnapshot() {
        return media.playbackQualitySnapshot;
      },
      get getCurrentCodecDiagnostics() {
        return codec.getCurrentCodecDiagnostics;
      },
      get streamEstimate() {
        return media.streamEstimate;
      },
      get resolvedVideoCodecPreference() {
        return codec.resolvedVideoCodecPreference;
      },
      get getCodecCapabilityState() {
        return codec.getCodecCapabilityState;
      },
      get lastCodecDecision() {
        return codec.lastCodecDecision;
      },
      get uiInjectStatus() {
        return runtime.uiInjectStatus;
      },
      get err() {
        return events.err;
      }
    });
    catalogControls = createCatalogControls({
      get disabled() {
        return runtime.disabled;
      },
      get getCurrentCdn() {
        return health.getCurrentCdn;
      },
      get STARTUP_PICK() {
        return health.STARTUP_PICK;
      },
      get getHealthyCdnList() {
        return health.getHealthyCdnList;
      },
      get preconnectBatch() {
        return hints.preconnectBatch;
      },
      get reorderCdnsByLatency() {
        return probe.reorderCdnsByLatency;
      },
      get reportMeasurementFailure() {
        return runtime.reportMeasurementFailure;
      },
      get catalogOverrides() {
        return catalog.catalogOverrides;
      },
      get TRUSTED_CDN_CATALOG_SET() {
        return catalog.TRUSTED_CDN_CATALOG_SET;
      },
      get CATALOG_OVERRIDES_KEY() {
        return catalog.CATALOG_OVERRIDES_KEY;
      },
      get rebuildPreferredCdnList() {
        return catalog.rebuildPreferredCdnList;
      },
      get activeCdnList() {
        return health.activeCdnList;
      },
      get PREFERRED_CDN_LIST() {
        return catalog.PREFERRED_CDN_LIST;
      },
      get blacklistSet() {
        return health.blacklistSet;
      },
      get knownDeadHosts() {
        return health.knownDeadHosts;
      },
      get lastChosenCdn() {
        return health.lastChosenCdn;
      },
      set lastChosenCdn(value) {
        health.lastChosenCdn = value;
      },
      get pageDiscoveredCdn() {
        return mediaPolicy.pageDiscoveredCdn;
      },
      set pageDiscoveredCdn(value) {
        mediaPolicy.pageDiscoveredCdn = value;
      },
      get PROBE_CACHE_KEY() {
        return latency.PROBE_CACHE_KEY;
      },
      get clearRuntimeConnectionHints() {
        return hints.clearRuntimeConnectionHints;
      },
      get promoteBestCdnNow() {
        return health.promoteBestCdnNow;
      },
      get refreshPublicDiagnosticSnapshot() {
        return snapshot.refreshPublicDiagnosticSnapshot;
      },
      get TRUSTED_CDN_CATALOG() {
        return catalog.TRUSTED_CDN_CATALOG;
      },
      get matchesHeaderExclude() {
        return catalog.matchesHeaderExclude;
      },
      get isPresumedDnsFailHost() {
        return health.isPresumedDnsFailHost;
      },
      get controlResult() {
        return controls.controlResult;
      }
    });
    views = createViews({
      get TrustedMenuUI() {
        return trustedUI.TrustedMenuUI;
      },
      get BiliCDNControls() {
        return controls.BiliCDNControls;
      },
      get refreshPublicDiagnosticSnapshot() {
        return snapshot.refreshPublicDiagnosticSnapshot;
      },
      get reloadAfterFeedback() {
        return catalogControls.reloadAfterFeedback;
      },
      get buildDiagReport() {
        return report.buildDiagReport;
      },
      get copyDiagReport() {
        return controls.copyDiagReport;
      },
      get listDeadHosts() {
        return health.listDeadHosts;
      },
      get TRUSTED_CDN_CATALOG_SET() {
        return new Set(catalog.TRUSTED_CDN_CATALOG_SET);
      },
      get controlResult() {
        return controls.controlResult;
      },
      get lastSampleSegmentUrl() {
        return bakeoff.lastSampleSegmentUrl;
      },
      get resolvedCdn() {
        return health.resolvedCdn;
      },
      get TRUSTED_CDN_CATALOG() {
        return catalog.TRUSTED_CDN_CATALOG;
      },
      get matchesHeaderExclude() {
        return catalog.matchesHeaderExclude;
      },
      get catalogOverrides() {
        return Object.freeze({ ...catalog.catalogOverrides });
      },
      get knownDeadHosts() {
        return new Set(health.knownDeadHosts);
      },
      get isPresumedDnsFailHost() {
        return health.isPresumedDnsFailHost;
      },
      get isCatalogAutoEnabled() {
        return catalog.isCatalogAutoEnabled;
      },
      get restoreAutomaticDefaults() {
        return catalogControls.restoreAutomaticDefaults;
      },
      get applyCatalogSelection() {
        return catalogControls.applyCatalogSelection;
      },
      get cdnSoftBlockUntil() {
        return Object.freeze({ ...health.cdnSoftBlockUntil });
      },
      get isCdnSoftBlocked() {
        return health.isCdnSoftBlocked;
      },
      get blacklistSet() {
        return new Set(health.blacklistSet);
      },
      get Config() {
        return Object.freeze({ ...events.Config });
      },
      get Watchdog() {
        return { stats: watchdog.Watchdog.stats };
      },
      get getHttpDnsStatus() {
        return httpdns.getHttpDnsStatus;
      },
      get lastCodecDecision() {
        return JSON.parse(JSON.stringify(codec.lastCodecDecision));
      },
      get disabled() {
        return runtime.disabled;
      },
      get getCdnShortName() {
        return health.getCdnShortName;
      },
      get playbackRateState() {
        return Object.freeze({ ...rate.playbackRateState });
      },
      get describePlaybackBuffer() {
        return snapshot.describePlaybackBuffer;
      },
      get streamEstimate() {
        return Object.freeze({ ...media.streamEstimate });
      },
      get getNativeRouteDiagnostics() {
        return nativeRoutes.diagnostics;
      }
    });
    if (typeof GM_registerMenuCommand === "function") views.registerControlMenu(GM_registerMenuCommand);
    application = createApplication({
      get interceptNetResponse() {
        return transport.interceptNetResponse;
      },
      get disabled() {
        return runtime.disabled;
      },
      set disabled(value) {
        runtime.disabled = value;
      },
      get isPlayUrlApi() {
        return catalog.isPlayUrlApi;
      },
      get playInfoTransformer() {
        return playurl.playInfoTransformer;
      },
      get DiagnosticLog() {
        return events.DiagnosticLog;
      },
      get BlockWebRTC() {
        return settings.BlockWebRTC;
      },
      get readDiagnosticHidden() {
        return report.readDiagnosticHidden;
      },
      set readDiagnosticHidden(value) {
        report.readDiagnosticHidden = value;
      },
      get err() {
        return events.err;
      },
      get resolvedCdn() {
        return health.resolvedCdn;
      },
      get activeCdnList() {
        return health.activeCdnList;
      },
      get preconnectBatch() {
        return hints.preconnectBatch;
      },
      get crossTabShouldBakeoff() {
        return bakeoff.crossTabShouldBakeoff;
      },
      set crossTabShouldBakeoff(value) {
        bakeoff.crossTabShouldBakeoff = value;
      },
      get onBakeoffStart() {
        return bakeoff.onBakeoffStart;
      },
      set onBakeoffStart(value) {
        bakeoff.onBakeoffStart = value;
      },
      get isValidCustomCdnHost() {
        return catalog.isValidCustomCdnHost;
      },
      get matchesExclude() {
        return catalog.matchesExclude;
      },
      get getPlayingCdnHost() {
        return bakeoff.getPlayingCdnHost;
      },
      get getHealthyCdnList() {
        return health.getHealthyCdnList;
      },
      get STARTUP_PICK() {
        return health.STARTUP_PICK;
      },
      get Watchdog() {
        return watchdog.Watchdog;
      },
      get bumpSeekGrace() {
        return rate.bumpSeekGrace;
      },
      get syncPlaybackRateFromVideo() {
        return rate.syncPlaybackRateFromVideo;
      },
      get PluginName() {
        return events.PluginName;
      },
      get TrustedMenuUI() {
        return trustedUI.TrustedMenuUI;
      },
      get stopRuntimeGeneration() {
        return runtime.stopRuntimeGeneration;
      },
      get cdnProbeStarted() {
        return catalogControls.cdnProbeStarted;
      },
      set cdnProbeStarted(value) {
        catalogControls.cdnProbeStarted = value;
      },
      get clearRuntimeConnectionHints() {
        return hints.clearRuntimeConnectionHints;
      },
      get forcedRedirectHosts() {
        return failures.forcedRedirectHosts;
      },
      get resetStreamProfile() {
        return media.resetStreamProfile;
      },
      get bakeoffStartupDefers() {
        return bakeoff.bakeoffStartupDefers;
      },
      set bakeoffStartupDefers(value) {
        bakeoff.bakeoffStartupDefers = value;
      },
      get setLastBakeoffAt() {
        return bakeoff.setLastBakeoffAt;
      },
      get lastSampleSegmentUrl() {
        return bakeoff.lastSampleSegmentUrl;
      },
      set lastSampleSegmentUrl(value) {
        bakeoff.lastSampleSegmentUrl = value;
      },
      get bakeoffEpoch() {
        return bakeoff.bakeoffEpoch;
      },
      set bakeoffEpoch(value) {
        bakeoff.bakeoffEpoch = value;
      },
      get bakeoffTimer() {
        return bakeoff.bakeoffTimer;
      },
      set bakeoffTimer(value) {
        bakeoff.bakeoffTimer = value;
      },
      get bakeoffAbortController() {
        return bakeoff.bakeoffAbortController;
      },
      set bakeoffAbortController(value) {
        bakeoff.bakeoffAbortController = value;
      },
      get HttpDnsAutoPilot() {
        return httpdns.HttpDnsAutoPilot;
      },
      get beginRuntimeGeneration() {
        return runtime.beginRuntimeGeneration;
      },
      get startCdnProbe() {
        return catalogControls.startCdnProbe;
      },
      get refreshPublicDiagnosticSnapshot() {
        return snapshot.refreshPublicDiagnosticSnapshot;
      },
      get log() {
        return events.log;
      },
      get refreshExpiredRestrictions() {
        return health.refreshExpiredRestrictions;
      },
      get codecResumeItems() {
        return codec.codecResumeItems;
      },
      get prepareCodecConfigurations() {
        return codec.prepareCodecConfigurations;
      },
      get discoverCdnFromPage() {
        return mediaPolicy.discoverCdnFromPage;
      },
      get inSeekGrace() {
        return rate.inSeekGrace;
      },
      get runThroughputBakeoff() {
        return bakeoff.runThroughputBakeoff;
      },
      get reportMeasurementFailure() {
        return runtime.reportMeasurementFailure;
      },
      get clearRuntimeTimeout() {
        return runtime.clearRuntimeTimeout;
      },
      get probeDeferTimer() {
        return probe.probeDeferTimer;
      },
      set probeDeferTimer(value) {
        probe.probeDeferTimer = value;
      },
      get probeDeferCount() {
        return probe.probeDeferCount;
      },
      set probeDeferCount(value) {
        probe.probeDeferCount = value;
      },
      get uiInjectStatus() {
        return runtime.uiInjectStatus;
      },
      set uiInjectStatus(value) {
        runtime.uiInjectStatus = value;
      },
      get fromHTML() {
        return dom.fromHTML;
      },
      get SettingsBarTitle() {
        return mediaPolicy.SettingsBarTitle;
      },
      get describePlaybackBuffer() {
        return snapshot.describePlaybackBuffer;
      },
      get playbackRateState() {
        return rate.playbackRateState;
      },
      get ASSUMED_PLAYBACK_RATE() {
        return rate.ASSUMED_PLAYBACK_RATE;
      },
      get cdnSoftBlockUntil() {
        return health.cdnSoftBlockUntil;
      },
      get isCdnSoftBlocked() {
        return health.isCdnSoftBlocked;
      },
      get blacklistSet() {
        return health.blacklistSet;
      },
      get knownDeadHosts() {
        return health.knownDeadHosts;
      },
      get getCdnShortName() {
        return health.getCdnShortName;
      },
      get waitForElm() {
        return dom.waitForElm;
      },
      get samplePlaybackQuality() {
        return media.samplePlaybackQuality;
      },
      get readPlaybackDiagnostic() {
        return report.readPlaybackDiagnostic;
      }
    });
  }
  __name(start, "start");

  // entry.mjs
  start(__BiliCDNSettings);
})();

})();
