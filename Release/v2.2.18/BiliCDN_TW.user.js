// ==UserScript==
// @name         Bilibili CDN 台灣優化
// @namespace    BiliCDN_TW
// @version      2.2.18
// @description  台灣 CDN 與播放整合：自動選路、香港節點、起播與健康量測、慢請求重試及三頁控制中心
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
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_registerMenuCommand
// @grant        GM_info
// @grant        unsafeWindow
// ==/UserScript==

(() => {
  var __defProp = Object.defineProperty;
  var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

  // src-v2/domain/model.ts
  var generationId = /* @__PURE__ */ __name((value) => value, "generationId");
  var epochId = /* @__PURE__ */ __name((value) => value, "epochId");
  var representationId = /* @__PURE__ */ __name((value) => value, "representationId");
  var decisionId = /* @__PURE__ */ __name((value) => value, "decisionId");
  var requestId = /* @__PURE__ */ __name((value) => value, "requestId");
  var recoveryActionId = /* @__PURE__ */ __name((value) => value, "recoveryActionId");
  var signedRouteHandle = /* @__PURE__ */ __name((value) => value, "signedRouteHandle");

  // src-v2/domain/measurement-time.ts
  function measuredPayload(bytes, length, range) {
    if (!Number.isSafeInteger(bytes) || bytes < 0) return false;
    if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)) || Number(length) !== bytes))
      return false;
    if (range === null) return true;
    const match = /^bytes (\d+)-(\d+)\/(\d+|\*)$/i.exec(range);
    if (!match) return false;
    const start2 = Number(match[1]), end = Number(match[2]), total = match[3] === "*" ? null : Number(match[3]);
    return Number.isSafeInteger(start2) && Number.isSafeInteger(end) && start2 >= 0 && end >= start2 && end - start2 + 1 === bytes && (total === null || Number.isSafeInteger(total) && total > end);
  }
  __name(measuredPayload, "measuredPayload");
  var timingBasis = /* @__PURE__ */ __name((value) => value === "fetch-consumer" || value === "xhr-terminal" || value === "probe-reader" ? value : void 0, "timingBasis");
  function measuredTiming(start2, response, end) {
    const valid = /* @__PURE__ */ __name((value) => value !== null && Number.isFinite(value) && value >= 0, "valid");
    const elapsedMs = valid(start2) && valid(end) && end >= start2 ? end - start2 : 0;
    const ttfbMs = valid(start2) && valid(response) && valid(end) && response >= start2 && response <= end ? response - start2 : null;
    return Object.freeze({
      elapsedMs,
      ttfbMs,
      speedEligible: elapsedMs > 0 && ttfbMs !== null && ttfbMs < elapsedMs
    });
  }
  __name(measuredTiming, "measuredTiming");
  function readMonotonic(now) {
    try {
      const value = now();
      return value !== null && Number.isFinite(value) && value >= 0 ? value : null;
    } catch {
      return null;
    }
  }
  __name(readMonotonic, "readMonotonic");

  // src-v2/domain/route-completion.ts
  function closedRangeLength(value) {
    if (typeof value !== "string") return null;
    const match = /^bytes=(\d+)-(\d+)$/i.exec(value.trim());
    if (!match) return null;
    const start2 = Number(match[1]), end = Number(match[2]), length = end - start2 + 1;
    return Number.isSafeInteger(start2) && Number.isSafeInteger(end) && start2 >= 0 && end >= start2 && Number.isSafeInteger(length) && length > 0 ? length : null;
  }
  __name(closedRangeLength, "closedRangeLength");
  function completionReason(budget, now) {
    if (!budget || !Number.isSafeInteger(budget.requestBytes) || (budget.requestBytes ?? 0) <= 0)
      return "unknown-size";
    if (budget.playableBufferSec === null || !Number.isFinite(budget.playableBufferSec) || budget.playableBufferSec < 0)
      return "unknown-buffer";
    const age = budget.ageMs ?? now - budget.sampledAt;
    if (!Number.isFinite(budget.sampledAt) || !Number.isFinite(age) || age < 0 || age > 2e3)
      return "stale-playback";
    return "available";
  }
  __name(completionReason, "completionReason");
  function predictCompletionMs(requestBytes, safePayloadMbps, ttfbMs) {
    if (!Number.isSafeInteger(requestBytes) || (requestBytes ?? 0) <= 0 || safePayloadMbps === null || !Number.isFinite(safePayloadMbps) || safePayloadMbps <= 0 || ttfbMs === null || !Number.isFinite(ttfbMs) || ttfbMs < 0)
      return null;
    const bodyMs = requestBytes * 8 / (safePayloadMbps * 1e3), totalMs = ttfbMs + bodyMs;
    return Number.isFinite(bodyMs) && bodyMs >= 2 ** -1022 && Number.isFinite(totalMs) && totalMs > 0 ? totalMs : null;
  }
  __name(predictCompletionMs, "predictCompletionMs");

  // src-v2/domain/playback-demand.ts
  var positive = /* @__PURE__ */ __name((value) => typeof value === "number" && Number.isFinite(value) && value > 0, "positive");
  function observedPlaybackDemand(kind, bandwidth, rate) {
    if (!positive(bandwidth) || !positive(rate)) return null;
    const mbps = bandwidth / 1e6;
    const scaled = mbps * rate;
    const demand = scaled * 1.25;
    if (![mbps, scaled, demand].every((value) => positive(value) && value >= 2 ** -1022)) return null;
    const requiredMbps = Math.max(kind === "audio" ? 0.5 : 2, demand);
    return Object.freeze({ kind, requiredMbps, highDemand: requiredMbps >= 12 });
  }
  __name(observedPlaybackDemand, "observedPlaybackDemand");
  function controlPlaybackDemand(kind, bandwidth, rate) {
    return observedPlaybackDemand(
      kind,
      positive(bandwidth) ? bandwidth : kind === "audio" ? 192e3 : 4e6,
      positive(rate) ? rate : 2
    ) ?? observedPlaybackDemand(kind, kind === "audio" ? 192e3 : 4e6, 2);
  }
  __name(controlPlaybackDemand, "controlPlaybackDemand");

  // src-v2/domain/probe-range.ts
  function parseProbeRange(value, startByte, limit) {
    const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(value);
    if (!match) return null;
    const start2 = Number(match[1]), end = Number(match[2]), total = Number(match[3]);
    if (![start2, end, total].every(Number.isSafeInteger) || start2 < 0 || total <= 0 || end < start2 || end >= total || start2 !== startByte || end !== Math.min(total - 1, startByte + limit - 1))
      return null;
    return Object.freeze({ startByte: start2, endByte: end, totalBytes: total });
  }
  __name(parseProbeRange, "parseProbeRange");
  function probeStartByte(totalBytes, limit, draw) {
    const minimum = 1024 * 1024, alignment = 64 * 1024;
    if (!Number.isSafeInteger(totalBytes) || totalBytes === null || !Number.isSafeInteger(limit) || limit <= 0 || !Number.isFinite(draw) || draw < 0 || draw >= 1 || totalBytes - limit < minimum)
      return 0;
    const slots = Math.floor((totalBytes - limit - minimum) / alignment) + 1;
    return minimum + Math.floor(draw * slots) * alignment;
  }
  __name(probeStartByte, "probeStartByte");

  // src-v2/domain/playback-progress.ts
  function comparePlaybackControls(current, previous) {
    if (previous === null) return "initial";
    return current.seekRevision !== previous.seekRevision || current.userRevision !== previous.userRevision || current.mediaId !== previous.mediaId || current.coreId !== previous.coreId ? "changed" : "same";
  }
  __name(comparePlaybackControls, "comparePlaybackControls");
  function playbackTimeAdvanced(currentTime, previousTime) {
    return currentTime - previousTime > 0.05;
  }
  __name(playbackTimeAdvanced, "playbackTimeAdvanced");
  function playbackFramesAdvanced(currentFrames, previousFrames) {
    return currentFrames > previousFrames;
  }
  __name(playbackFramesAdvanced, "playbackFramesAdvanced");
  function stableProgress(ticks, elapsedMs, minimum) {
    return Number.isFinite(ticks) && ticks >= minimum && Number.isFinite(elapsedMs) && elapsedMs >= minimum * 1e3;
  }
  __name(stableProgress, "stableProgress");
  function samplePlaybackProgress(state, sample) {
    const previous = state.baseline;
    const reset = /* @__PURE__ */ __name((observation, advanced2 = false) => ({
      next: { baseline: sample, observedAt: sample.at, ticks: 0, elapsedMs: 0 },
      observation,
      advanced: advanced2
    }), "reset");
    if (previous && (comparePlaybackControls(sample, previous) !== "same" || sample.playbackRevision !== previous.playbackRevision || sample.generation !== previous.generation || sample.epoch !== previous.epoch || sample.representation !== previous.representation || sample.active !== previous.active || sample.seeking !== previous.seeking || sample.pendingSeekGoal !== previous.pendingSeekGoal))
      return reset("owner-changed");
    if (sample.at === null || !Number.isFinite(sample.at) || sample.at < 0 || state.observedAt != null && sample.at < state.observedAt)
      return reset("clock-invalid");
    if (!previous || previous.at === null || !Number.isFinite(previous.at) || previous.at < 0)
      return reset("insufficient");
    const gap = sample.at - (state.observedAt ?? previous.at);
    if (gap === 0) return { next: state, observation: "duplicate", advanced: false };
    const advanced = sample.active && !sample.seeking && !previous.seeking && playbackTimeAdvanced(sample.position, previous.position);
    const progress = advanced && (sample.frames === null || previous.frames !== null && playbackFramesAdvanced(sample.frames, previous.frames));
    if (progress) {
      if (gap > 2e3) return reset("gap-progress", true);
      return {
        next: {
          baseline: sample,
          observedAt: sample.at,
          ticks: state.ticks + 1,
          elapsedMs: state.elapsedMs + gap
        },
        observation: "progress",
        advanced
      };
    }
    if (!sample.active) return reset("insufficient");
    if (sample.at - previous.at < 1e3)
      return { next: { ...state, observedAt: sample.at }, observation: "insufficient", advanced };
    return {
      next: {
        baseline: { ...sample, at: previous.at },
        observedAt: sample.at,
        ticks: 0,
        elapsedMs: 0
      },
      observation: "stalled",
      advanced
    };
  }
  __name(samplePlaybackProgress, "samplePlaybackProgress");
  function stallProgressTransition(state, event, bufferSec, elapsedMs) {
    if (event === "stalled") return { next: { phase: "stalled", ticks: 0 }, complete: false };
    const ticks = Math.min(10, state.ticks + 1);
    return {
      next: stableProgress(ticks, elapsedMs, 10) ? { phase: "stable-retained", ticks } : ticks === 1 ? { phase: "confirming", ticks: 1 } : { phase: "settling", ticks },
      complete: stableProgress(ticks, elapsedMs, 10) && Number.isFinite(bufferSec) && bufferSec >= 10
    };
  }
  __name(stallProgressTransition, "stallProgressTransition");

  // src-v2/application/routing/early-retry-contracts.ts
  var EARLY_RETRY_STATES = Object.freeze([
    "idle",
    "waiting",
    "armed",
    "timedout",
    "claimed",
    "dispatched",
    "complete",
    "cancelled",
    "suspended"
  ]);
  var reasons = Object.freeze([
    "not-started",
    "stable-progress",
    "episode-used",
    "document-quota",
    "no-qualified-request",
    "no-alternative",
    "invalid-input",
    "request-young",
    "mostly-complete",
    "buffer-window",
    "unknown-rate",
    "adequate-current",
    "alternative-evidence",
    "alternative-capacity",
    "alternative-timing",
    "alternative-late",
    "current-finishes-in-time",
    "insufficient-benefit",
    "eligible",
    "native-timeout-armed",
    "native-timeout-observed",
    "website-retry-claimed",
    "website-retry-dispatched",
    "website-retry-succeeded",
    "website-retry-failed",
    "retry-completion-timeout",
    "handoff-lost",
    "handoff-expired",
    "native-timeout-unavailable",
    "port-failure",
    "owner-changed",
    "disabled-setting",
    "disabled",
    "route-mode",
    "hidden",
    "recovering",
    "stall-confirming",
    "observation-insufficient",
    "clock-invalid",
    "playback-state",
    "user-operation",
    "unknown-demand",
    "cancelled",
    "lifecycle-reset",
    "disposed",
    "settings",
    "route-policy",
    "monitor-stop"
  ]);
  var earlyRetryReason = /* @__PURE__ */ __name((value) => reasons.includes(value) ? value : "unknown", "earlyRetryReason");

  // src-v2/ui/control-read-model.ts
  function createControlReadModel(sources) {
    return {
      snapshot() {
        return Object.freeze({
          settings: sources.settings.get(),
          session: sources.session.get(),
          monitor: sources.monitor.snapshot(),
          recovery: sources.recovery.snapshot(),
          measurement: sources.measurement.snapshot(),
          interception: sources.transport.snapshot(),
          routes: sources.routes.snapshot(),
          restrictions: sources.restrictions.list(),
          ...sources.earlyRetry ? { earlyRetry: sources.earlyRetry.snapshot() } : {}
        });
      },
      subscribe(listener) {
        const stops = ["settings", "monitor", "routes"].flatMap((kind) => {
          const source = sources[kind];
          return source.subscribe ? [source.subscribe(() => listener(kind))] : [];
        });
        return () => {
          for (const stop of stops) stop();
        };
      }
    };
  }
  __name(createControlReadModel, "createControlReadModel");

  // src-v2/adapters/transport/range-probe.ts
  var RangeProbeAdapter = class {
    constructor(nativeFetch, now) {
      this.nativeFetch = nativeFetch;
      this.now = now;
    }
    nativeFetch;
    now;
    static {
      __name(this, "RangeProbeAdapter");
    }
    async read(input) {
      let startedAt = null;
      let bytes = 0, receivedBytes = 0, responseAt = null;
      let endedAt = null, frozen = false, payloadValid = true;
      const freeze = /* @__PURE__ */ __name(() => {
        if (frozen) return;
        frozen = true;
        endedAt = readMonotonic(this.now);
      }, "freeze");
      let range = null;
      const result = /* @__PURE__ */ __name((status, directRange, reason) => {
        freeze();
        const timing = measuredTiming(startedAt, responseAt, endedAt);
        return {
          status,
          range,
          directRange,
          reason,
          bytes,
          receivedBytes,
          payloadValid,
          timingBasis: "probe-reader",
          elapsedMs: timing.elapsedMs,
          ttfbMs: timing.ttfbMs,
          speedEligible: directRange && payloadValid && timing.speedEligible && receivedBytes >= 64 * 1024
        };
      }, "result");
      try {
        const startByte = input.startByte ?? 0;
        if (!Number.isSafeInteger(startByte) || startByte < 0 || !Number.isSafeInteger(input.limit) || input.limit <= 0 || !Number.isSafeInteger(startByte + input.limit - 1))
          return result(null, false, "invalid-range");
        if (input.signal.aborted)
          return result(null, false, input.signal.reason === "timeout" ? "timeout" : "cancelled");
        startedAt = readMonotonic(this.now);
        const response = await this.nativeFetch(input.url, {
          method: "GET",
          headers: { Range: `bytes=${startByte}-${startByte + input.limit - 1}` },
          credentials: "omit",
          cache: "no-store",
          redirect: "error",
          signal: input.signal
        });
        responseAt = readMonotonic(this.now);
        let direct = false;
        try {
          const url = new URL(response.url);
          direct = !response.redirected && !!input.host && url.protocol === "https:" && !url.port && url.hostname.toLowerCase() === input.host;
        } catch {
        }
        if (!direct) {
          freeze();
          await response.body?.cancel("redirected-response");
          return result(null, false, "redirected-response");
        }
        if (response.status !== 206 || !response.body) {
          freeze();
          await response.body?.cancel("range-required");
          return result(response.status, false, `http-${response.status}`);
        }
        const header = response.headers.get("Content-Range");
        if (header !== null) range = parseProbeRange(header, startByte, input.limit);
        if (header !== null && !range || startByte > 0 && !range) {
          freeze();
          await response.body.cancel("range-mismatch");
          return result(response.status, false, "range-mismatch");
        }
        const reader = response.body.getReader();
        const declaredLength = response.headers.get("Content-Length");
        const expected = range ? range.endByte - range.startByte + 1 : null;
        try {
          while (bytes < input.limit && !input.signal.aborted) {
            const item = await reader.read();
            if (item.done) {
              freeze();
              break;
            }
            receivedBytes += item.value.byteLength;
            bytes = Math.min(input.limit, receivedBytes);
            if (bytes >= input.limit) {
              freeze();
              try {
                await reader.cancel(input.completionReason);
              } catch {
              }
              break;
            }
          }
        } catch (error) {
          freeze();
          throw error;
        } finally {
          if (input.signal.aborted) {
            try {
              await reader.cancel(input.signal.reason);
            } catch {
            }
          }
          try {
            reader.releaseLock();
          } catch {
          }
        }
        payloadValid = receivedBytes <= input.limit && (expected === null || receivedBytes === expected) && (declaredLength === null || /^\d+$/.test(declaredLength) && Number(declaredLength) === receivedBytes);
        if (input.signal.aborted)
          return result(null, false, input.signal.reason === "timeout" ? "timeout" : "cancelled");
        return result(response.status, true, "measured");
      } catch {
        return result(
          null,
          false,
          input.signal.aborted ? input.signal.reason === "timeout" ? "timeout" : "cancelled" : "network"
        );
      }
    }
  };

  // src-v2/domain/url-policy.ts
  var MEDIA_URL_MAX_LENGTH = 16 * 1024;
  var MEDIA_PATH_RE = /\.(?:m4s|mp4|flv|m3u8)$/i;
  var IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
  var PCDN_SUFFIXES = [
    "szbdyd.com",
    "mountaintoys.cn",
    "nexusedgeio.com",
    "ahdohpiechei.com"
  ];
  var PCDN_HOSTS = /* @__PURE__ */ new Set(["upos-sz-mirror14b.bilivideo.com"]);
  var hasSuffix = /* @__PURE__ */ __name((host, suffix) => host === suffix || host.endsWith(`.${suffix}`), "hasSuffix");
  var isKnownPcdnHost = /* @__PURE__ */ __name((host) => PCDN_SUFFIXES.some((suffix) => hasSuffix(host, suffix)), "isKnownPcdnHost");
  var isKnownNativeFamily = /* @__PURE__ */ __name((host) => /\.bilivideo\.(?:com|cn|net)$/i.test(host) || host.endsWith(".akamaized.net"), "isKnownNativeFamily");
  var parseMediaUrl = /* @__PURE__ */ __name((value) => {
    if (!value || value.length > MEDIA_URL_MAX_LENGTH) return null;
    let url;
    try {
      url = new URL(value.startsWith("//") ? `https:${value}` : value);
    } catch {
      return null;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase();
    const mediaPath = MEDIA_PATH_RE.test(url.pathname) || url.pathname.includes("/upgcxcode/") || url.pathname.startsWith("/v1/resource") || url.pathname.includes("/live-bvc/");
    if (!mediaPath) return { url, host, kind: "unknown", replaceable: false };
    if (url.pathname.includes("/live-bvc/")) return { url, host, kind: "live", replaceable: false };
    if (url.pathname.startsWith("/v1/resource"))
      return { url, host, kind: "resource", replaceable: false };
    const label = host.split(".")[0] ?? "";
    const nonDefaultPort = !!url.port && url.port !== "80" && url.port !== "443";
    const pcdn = /\.mcdn\.bilivideo\.(?:com|cn|net)$/i.test(host) || isKnownPcdnHost(host) || PCDN_HOSTS.has(host) || label.startsWith("upos-") && label.includes("302") || String(url.searchParams.get("os") ?? "").toLowerCase() === "mcdn" || IPV4_RE.test(host) && nonDefaultPort;
    if (pcdn) return { url, host, kind: "pcdn", replaceable: true };
    if (nonDefaultPort || IPV4_RE.test(host))
      return { url, host, kind: "suspected-pcdn", replaceable: false };
    return { url, host, kind: "normal", replaceable: isKnownNativeFamily(host) };
  }, "parseMediaUrl");
  var isOversizedBilibiliMedia = /* @__PURE__ */ __name((value) => {
    if (value.length <= MEDIA_URL_MAX_LENGTH) return false;
    let url;
    try {
      url = new URL(value.startsWith("//") ? `https:${value}` : value);
    } catch {
      return false;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase(), path = url.pathname;
    const mediaPath = MEDIA_PATH_RE.test(path) || path.includes("/upgcxcode/") || path.startsWith("/v1/resource") || path.includes("/live-bvc/");
    if (!mediaPath) return false;
    if (/\.bilivideo\.(?:com|cn|net)$/.test(host)) return true;
    if (host.startsWith("upos-") && host.endsWith(".akamaized.net")) return true;
    return isKnownPcdnHost(host);
  }, "isOversizedBilibiliMedia");
  var replaceUrlHost = /* @__PURE__ */ __name((value, host) => {
    const parsed = parseMediaUrl(value);
    if (!parsed || !parsed.replaceable) return null;
    const next = new URL(parsed.url.href);
    next.hostname = host;
    next.port = "";
    next.protocol = "https:";
    return next.href;
  }, "replaceUrlHost");
  var mediaIdentity = /* @__PURE__ */ __name((value) => {
    const parsed = parseMediaUrl(value);
    return parsed ? `${parsed.url.pathname}?${parsed.url.searchParams.toString()}` : null;
  }, "mediaIdentity");
  var isHttpDnsUrl = /* @__PURE__ */ __name((value, baseUrl2) => {
    try {
      return new URL(value, baseUrl2).hostname === "httpdns.bilivideo.com";
    } catch {
      return false;
    }
  }, "isHttpDnsUrl");

  // src-v2/domain/catalog.ts
  var HK_CATALOG_HOSTS = Object.freeze([
    "cn-hk-eq-01-03.bilivideo.com",
    "cn-hk-eq-01-05.bilivideo.com",
    "cn-hk-eq-01-01.bilivideo.com"
  ]);
  var TRUSTED_CATALOG = Object.freeze([
    "upos-sz-mirroraliov.bilivideo.com",
    "upos-sz-mirrorcosov.bilivideo.com",
    "upos-sz-mirrorali.bilivideo.com",
    "upos-sz-mirroralib.bilivideo.com",
    "upos-sz-mirrorali02.bilivideo.com",
    "upos-sz-mirrorbos.bilivideo.com",
    "upos-tf-all-tx.bilivideo.com",
    "upos-sz-mirrorcos.bilivideo.com",
    "upos-sz-mirrorhwov.bilivideo.com",
    "upos-sz-mirrorhw.bilivideo.com",
    "upos-hz-mirroraliov.bilivideo.com",
    ...HK_CATALOG_HOSTS
  ]);
  var TRUSTED_CATALOG_SET = new Set(TRUSTED_CATALOG);
  var DEFAULT_UNAVAILABLE_HOSTS = /* @__PURE__ */ new Set([
    "upos-sz-mirrorcosov.bilivideo.com",
    "upos-sz-mirrorhwov.bilivideo.com",
    "upos-sz-mirrorhw.bilivideo.com",
    "upos-hz-mirroraliov.bilivideo.com"
  ]);
  var isCatalogHost = /* @__PURE__ */ __name((host) => TRUSTED_CATALOG_SET.has(host.toLowerCase()), "isCatalogHost");
  var catalogIndex = /* @__PURE__ */ __name((host) => {
    const index = TRUSTED_CATALOG.indexOf(host.toLowerCase());
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  }, "catalogIndex");
  var PLAYURL_PATH = /\/player\/.*playurl/i;
  var classifyPlayurlApi = /* @__PURE__ */ __name((value, baseUrl2) => {
    try {
      const url = new URL(value, baseUrl2);
      if (url.hostname !== "api.bilibili.com") return null;
      if (PLAYURL_PATH.test(url.pathname)) return "playurl";
      if (url.protocol !== "https:" || url.port || url.username || url.password) return null;
      if (url.pathname === "/ogv/player/playview") return "ogv-playview";
      if (url.pathname === "/ogv/player/pre/check/drm") return "ogv-precheck";
      return null;
    } catch {
      return null;
    }
  }, "classifyPlayurlApi");
  var isPlayurlApi = /* @__PURE__ */ __name((value, baseUrl2) => {
    const endpoint = classifyPlayurlApi(value, baseUrl2);
    return endpoint !== null && endpoint !== "ogv-precheck";
  }, "isPlayurlApi");

  // src-v2/domain/source-admission.ts
  var MAX_EXACT_SOURCES = 4;
  var TRUSTED_SOURCE_SCAN = 16;
  var PROVISIONAL_SOURCE_SCAN = 4;
  function admitSources(urls, trusted) {
    const candidates = [];
    const seen = /* @__PURE__ */ new Set();
    const limit = trusted ? TRUSTED_SOURCE_SCAN : PROVISIONAL_SOURCE_SCAN;
    for (let rawIndex = 0; rawIndex < Math.min(limit, urls.length); rawIndex++) {
      const raw = urls[rawIndex];
      if (typeof raw !== "string") continue;
      const parsed = parseMediaUrl(raw);
      if (!parsed) continue;
      const opaque = parsed.kind === "unknown" && parsed.url.protocol === "https:" && !parsed.url.port;
      const generated = parsed.kind === "pcdn" ? replaceUrlHost(raw, TRUSTED_CATALOG[0]) : null;
      const pcdnSource = generated !== null && parseMediaUrl(generated)?.kind === "normal";
      if (parsed.kind !== "normal" && !opaque && !pcdnSource) continue;
      const url = parsed.url.href;
      if (seen.has(url)) continue;
      seen.add(url);
      candidates.push(
        Object.freeze({
          url,
          host: parsed.host,
          rawIndex,
          selectable: !opaque && !pcdnSource,
          activelyExplorable: !opaque && !pcdnSource && isKnownNativeFamily(parsed.host)
        })
      );
    }
    const selected = [];
    const primary = candidates.find((row) => row.rawIndex === 0);
    if (primary) selected.push(primary);
    for (const selectable of [true, false]) {
      const remaining = candidates.filter((row) => row !== primary && row.selectable === selectable);
      for (const row of remaining)
        if (selected.length < MAX_EXACT_SOURCES && !selected.some((prior) => prior.host === row.host))
          selected.push(row);
      for (const row of remaining)
        if (selected.length < MAX_EXACT_SOURCES && !selected.includes(row)) selected.push(row);
    }
    return Object.freeze(selected);
  }
  __name(admitSources, "admitSources");

  // src-v2/domain/playurl-content.ts
  function playurlRequestContext(value, base) {
    let contentId = null;
    if (isPlayurlApi(value, base)) {
      const values = new URL(value, base).searchParams.getAll("cid");
      if (values.length === 1 && /^[0-9]{1,20}$/.test(values[0])) {
        contentId = values[0].replace(/^0+/, "") || null;
      }
    }
    return Object.freeze({ contentId });
  }
  __name(playurlRequestContext, "playurlRequestContext");
  var directories = /* @__PURE__ */ __name((urls) => {
    const result = /* @__PURE__ */ new Set();
    for (const value of urls) {
      const parsed = parseMediaUrl(value);
      if (!parsed) continue;
      const path = parsed.url.pathname, parent = path.slice(0, path.lastIndexOf("/"));
      if (parent) result.add(parent);
    }
    return [...result].sort();
  }, "directories");
  var merge = /* @__PURE__ */ __name((current, previous, limit) => {
    const result = new Set(current.slice(0, limit));
    for (const value of [...previous].sort()) {
      if (result.size >= limit) break;
      result.add(value);
    }
    return Object.freeze([...result].sort());
  }, "merge");
  function observePlayurlContent(previous, videoUrls, audioUrls, context) {
    const video = directories(videoUrls), audio = directories(audioUrls), contentId = context?.contentId ?? null;
    if (!contentId && !video.length && !audio.length) return { identity: previous, changed: false };
    let changed = false;
    if (previous?.contentId && contentId) changed = previous.contentId !== contentId;
    else if (previous && (previous.video.length || previous.audio.length)) {
      const before = previous.video.length ? previous.video : previous.audio;
      const next = video.length ? video : audio;
      changed = Boolean(previous.video.length) !== Boolean(video.length) || !next.some((value) => before.includes(value));
    }
    const retained = changed ? null : previous;
    return {
      changed,
      identity: Object.freeze({
        contentId: contentId ?? retained?.contentId ?? null,
        video: merge(video, retained?.video ?? [], 128),
        audio: merge(audio, retained?.audio ?? [], 64)
      })
    };
  }
  __name(observePlayurlContent, "observePlayurlContent");

  // src-v2/application/playurl/playurl-controller.ts
  var PlayurlController = class {
    constructor(session, vault, routes) {
      this.session = session;
      this.vault = vault;
      this.routes = routes;
    }
    session;
    vault;
    routes;
    static {
      __name(this, "PlayurlController");
    }
    #epochListeners = /* @__PURE__ */ new Set();
    #seenTrusted = /* @__PURE__ */ new WeakSet();
    #trustedItems = /* @__PURE__ */ new WeakMap();
    #seenPage = /* @__PURE__ */ new WeakMap();
    #responses = /* @__PURE__ */ new Set();
    #generation = -1;
    #apiWatermark = 0;
    #ingestion = null;
    #apiCandidate = null;
    #contentIdentity = null;
    catalogOnly() {
      return this.routes.isCatalogOnly();
    }
    subscribeEpoch(listener) {
      this.#epochListeners.add(listener);
      return () => this.#epochListeners.delete(listener);
    }
    active() {
      return !this.session.get().disabled;
    }
    lifecycleKey() {
      const s = this.session.get();
      return `${s.generation}:${s.epoch}`;
    }
    ingest(payload, source = "trusted-api", responseKey, context) {
      const state = this.session.get(), active = this.#ingestion;
      const sequence = source === "trusted-api" && Number.isSafeInteger(context?.requestSequence) && context.requestSequence > 0 ? context.requestSequence : void 0;
      if (state.disabled || context?.generation !== void 0 && context.generation !== Number(state.generation))
        return null;
      if (active && active.generation === state.generation && (sequence === void 0 || active.sequence === void 0 || sequence <= active.sequence))
        return null;
      const owner = { generation: state.generation, epoch: state.epoch, sequence };
      this.#ingestion = owner;
      const valid = /* @__PURE__ */ __name(() => {
        const current = this.session.get();
        return this.#ingestion === owner && !current.disabled && current.generation === owner.generation && current.epoch === owner.epoch;
      }, "valid");
      try {
        const outputs = this.#ingest(payload, source, responseKey, context, owner, valid);
        return valid() ? outputs : null;
      } finally {
        if (this.#ingestion === owner) this.#ingestion = null;
      }
    }
    #ingest(payload, source, responseKey, context, owner, valid) {
      const outputs = [];
      const rewriteItem2 = /* @__PURE__ */ __name((item, primary, backups) => {
        outputs.push({ token: item.token, primary, backups });
      }, "rewriteItem");
      if (this.session.get().disabled) return null;
      if (this.#generation !== Number(this.session.get().generation)) {
        this.#generation = Number(this.session.get().generation);
        this.#responses.clear();
        this.#apiWatermark = 0;
        this.#apiCandidate = null;
        this.#contentIdentity = null;
        this.#seenTrusted = /* @__PURE__ */ new WeakSet();
        this.#trustedItems = /* @__PURE__ */ new WeakMap();
      }
      const sequence = context?.requestSequence;
      const ordered = source === "trusted-api" && Number.isSafeInteger(sequence) && sequence > 0;
      if (source === "trusted-api" && context?.generation !== void 0 && context.generation !== this.#generation)
        return null;
      const older = ordered && sequence < this.#apiWatermark;
      if (older && (!context?.contentId || context.contentId !== this.#contentIdentity?.contentId))
        return null;
      const catalogOnly = this.routes.isCatalogOnly();
      if (responseKey && this.#responses.has(responseKey) && !catalogOnly) return outputs;
      const dash = payload;
      if (!dash || !dash.video.length && !dash.audio.length) return null;
      if (payload && typeof payload === "object") {
        if (source === "trusted-api") {
          if (this.#seenTrusted.has(payload.token)) {
            if (catalogOnly) {
              for (const [kind, items] of [
                ["video", dash.video],
                ["audio", dash.audio]
              ]) {
                for (const item of items) {
                  const identity = this.#trustedItems.get(item.token);
                  if (identity && this.vault.isCurrentIdentity(identity))
                    this.#sanitizeKnownItem(
                      item,
                      identity.representation,
                      kind,
                      "trusted-api",
                      true,
                      rewriteItem2
                    );
                  else rewriteItem2(item, "", []);
                }
              }
            }
            return outputs;
          }
          this.#seenTrusted.add(payload.token);
        } else if (source === "page-hint") {
          const generation = Number(this.session.get().generation);
          if (this.#seenPage.get(payload.token) === generation && !catalogOnly) return outputs;
          this.#seenPage.set(payload.token, generation);
        }
      }
      if (source === "trusted-api" && !older) {
        const next = observePlayurlContent(
          this.#contentIdentity,
          dash.video.map((item) => item.primary),
          dash.audio.map((item) => item.primary),
          context
        );
        this.#contentIdentity = next.identity;
        if (next.changed) {
          this.session.beginEpoch();
          const state2 = this.session.get();
          if (this.#ingestion !== owner || state2.disabled || state2.generation !== owner.generation)
            return null;
          owner.epoch = state2.epoch;
          this.vault.reset(state2.generation, state2.epoch);
          this.routes.resetEpoch();
          if (!valid()) return null;
          this.#trustedItems = /* @__PURE__ */ new WeakMap();
          const identity = Object.freeze({ generation: state2.generation, epoch: state2.epoch });
          for (const listener of this.#epochListeners) {
            listener(identity);
            if (!valid()) return null;
          }
        }
      }
      if (!valid()) return null;
      if (responseKey) {
        this.#responses.add(responseKey);
        while (this.#responses.size > 128)
          this.#responses.delete(this.#responses.values().next().value);
      }
      const state = this.session.get();
      for (const [kind, items] of [
        ["video", dash.video],
        ["audio", dash.audio]
      ]) {
        items.forEach((item) => {
          if (!valid()) return;
          if (ordered && sequence < this.#apiWatermark) {
            if (context?.contentId !== this.#contentIdentity?.contentId) {
              rewriteItem2(item, "", []);
              return;
            }
            const existing = this.vault.registeredRepresentation(
              kind,
              item.key,
              item.codec,
              item.height
            );
            if (existing) {
              this.#sanitizeKnownItem(item, existing, kind, "trusted-api", false, rewriteItem2);
              return;
            }
          }
          const primary = item.primary, urls = item.urls;
          if (!item.progressive && parseMediaUrl(primary)?.kind === "unknown") {
            const rep2 = this.vault.register({
              generation: state.generation,
              epoch: state.epoch,
              kind,
              key: item.key,
              height: item.height,
              codec: item.codec,
              bandwidth: item.bandwidth,
              ...item.frameRate !== void 0 ? { frameRate: item.frameRate } : {},
              urls,
              source,
              refreshTrustedSources: source === "trusted-api"
            });
            if (rep2 && source === "trusted-api") {
              const identity = this.vault.identity(rep2);
              if (identity) this.#trustedItems.set(item.token, identity);
            }
            if (rep2 && source !== "trusted-api" && this.vault.source(rep2) === "trusted-api") {
              if (source === "page-hint" && catalogOnly)
                this.#sanitizeKnownItem(item, rep2, kind, "page-hint", false, rewriteItem2);
              return;
            }
            if (source !== "player-mpd") {
              const output2 = rep2 ? this.routes.opaqueOutput(rep2, primary, this.vault.sourceURLs(rep2), source) : { primary: "", backups: [] };
              rewriteItem2(item, output2.primary, output2.backups);
            }
            return;
          }
          const bandwidth = item.bandwidth;
          const rep = this.vault.register({
            generation: state.generation,
            epoch: state.epoch,
            kind,
            key: item.key,
            height: item.height,
            codec: item.codec,
            bandwidth,
            ...item.frameRate !== void 0 ? { frameRate: item.frameRate } : {},
            urls,
            source,
            refreshTrustedSources: source === "trusted-api"
          });
          if (rep && source === "trusted-api") {
            const identity = this.vault.identity(rep);
            if (identity) this.#trustedItems.set(item.token, identity);
          }
          if (rep && source !== "trusted-api" && this.vault.source(rep) === "trusted-api") {
            if (source === "page-hint" && catalogOnly)
              this.#sanitizeKnownItem(item, rep, kind, "page-hint", false, rewriteItem2);
            return;
          }
          if (!rep) {
            if (source !== "player-mpd") {
              if (item.progressive) {
                rewriteItem2(item, "", []);
                return;
              }
              const primaryOutput = this.routes.apply(primary, kind, void 0, true);
              const admitted = admitSources(urls, source === "trusted-api").map((route) => route.url);
              const backups = this.routes.isCatalogOnly() ? [] : primaryOutput.url ? [
                ...new Set(
                  admitted.map((url) => this.routes.apply(url).url).filter((url) => !!url && url !== primaryOutput.url)
                )
              ].slice(0, 5) : [];
              const safePrimary = primaryOutput.url && (catalogOnly || this.routes.isBilibiliMedia(primaryOutput.url)) ? primaryOutput.url : "";
              rewriteItem2(
                item,
                safePrimary,
                safePrimary ? backups.filter((url) => catalogOnly || this.routes.isBilibiliMedia(url)) : []
              );
            }
            return;
          }
          if (source === "player-mpd") return;
          const demand = controlPlaybackDemand(kind, bandwidth, this.routes.playbackRate());
          const decision = this.routes.plan(
            rep,
            demand,
            this.session.get().affinity ? "representation" : "startup"
          );
          if (!valid()) return;
          const output = this.routes.playerOutput(
            rep,
            primary,
            decision,
            this.vault.sourceURLs(rep),
            source
          );
          rewriteItem2(item, output.primary, output.backups);
        });
      }
      if (!valid()) return null;
      if (ordered && context)
        this.#apiCandidate = { context, generation: state.generation, epoch: state.epoch };
      return outputs;
    }
    acceptResponse(context) {
      const candidate = this.#apiCandidate, state = this.session.get();
      if (!context || candidate?.context !== context || state.disabled || state.generation !== candidate.generation || state.epoch !== candidate.epoch)
        return;
      this.#apiCandidate = null;
      if (Number.isSafeInteger(context.requestSequence) && context.requestSequence > 0)
        this.#apiWatermark = Math.max(this.#apiWatermark, context.requestSequence);
    }
    #sanitizeKnownItem(item, representation, kind, source, recordOutput, rewriteItem2) {
      const original = this.vault.rootUrl(representation);
      if (!original) {
        rewriteItem2(item, "", []);
        return;
      }
      const bandwidth = this.vault.groupSummary(representation)?.bandwidth ?? 0;
      const demand = controlPlaybackDemand(kind, bandwidth, this.routes.playbackRate());
      const decision = this.routes.plan(
        representation,
        demand,
        this.session.get().affinity ? "representation" : "startup"
      );
      const output = this.routes.playerOutput(
        representation,
        original,
        decision,
        this.vault.sourceURLs(representation),
        source,
        recordOutput
      );
      rewriteItem2(item, output.primary, output.backups);
    }
  };

  // src-v2/state/settings-policy.ts
  function sameOverrides(a, b) {
    const left = Object.entries(a.catalogOverrides), right = Object.entries(b.catalogOverrides);
    return left.length === right.length && left.every(([key, value], i) => right[i]?.[0] === key && right[i]?.[1] === value);
  }
  __name(sameOverrides, "sameOverrides");
  function sameRouteSettings(a, b) {
    return a.fixedHost === b.fixedHost && a.considerNativeSources === b.considerNativeSources && sameOverrides(a, b);
  }
  __name(sameRouteSettings, "sameRouteSettings");
  function sameMeasurementSettings(a, b) {
    return sameRouteSettings(a, b) && a.disabled === b.disabled;
  }
  __name(sameMeasurementSettings, "sameMeasurementSettings");

  // src-v2/application/runtime-controller.ts
  var RuntimeController = class {
    constructor(settings, routes, player, monitor, measurement, recovery, visibility, content, earlyRetry) {
      this.settings = settings;
      this.routes = routes;
      this.player = player;
      this.monitor = monitor;
      this.measurement = measurement;
      this.recovery = recovery;
      this.visibility = visibility;
      this.content = content;
      this.earlyRetry = earlyRetry;
    }
    settings;
    routes;
    player;
    monitor;
    measurement;
    recovery;
    visibility;
    content;
    earlyRetry;
    static {
      __name(this, "RuntimeController");
    }
    #running = false;
    #stops = [];
    install() {
      if (this.#stops.length) return;
      if (this.player.observePlaybackInvalidation)
        this.#stops.push(
          this.player.observePlaybackInvalidation(
            (revision2) => this.routes.observePlaybackFacts(null, revision2)
          )
        );
      this.#stops.push(
        this.content.subscribeEpoch(() => this.reset()),
        this.routes.subscribe((event) => this.handleRouteEvent(event)),
        this.monitor.subscribe((snapshot) => {
          if (this.#stops.length && this.#running)
            this.routes.observePlaybackFacts(snapshot.routingPlayback ?? null);
        })
      );
      this.visibility.setEnabled(!this.settings.get().disabled);
      let routeSettings = this.settings.get();
      this.#stops.push(
        this.settings.subscribe((state) => {
          if (!state.earlyRetryEnabled || state.disabled) this.earlyRetry?.cancel("settings");
          this.visibility.setEnabled(!state.disabled);
          if (!sameRouteSettings(state, routeSettings)) {
            this.earlyRetry?.cancel("route-policy");
            routeSettings = state;
            this.routes.invalidateForUserSetting();
            this.measurement.reset();
            this.recovery.reset();
          }
        })
      );
    }
    handleRouteEvent(event) {
      if (event.type === "recovery" && event.action.action === "route-fallback" && event.action.kind === "video") {
        const snapshot = this.player.snapshot();
        const request = this.routes.latestRequested("video");
        this.recovery.armRouteFailure(
          "route-failure",
          snapshot,
          () => !!request && this.routes.recoveryEligible(request) && this.routes.latestRequested("video")?.representation === request.representation
        );
      }
    }
    start() {
      this.#running = true;
      this.monitor.start();
    }
    stop() {
      this.#running = false;
      this.routes.observePlaybackFacts(null);
      this.monitor.stop();
    }
    reset() {
      this.routes.observePlaybackFacts(null);
      this.monitor.reset();
      this.measurement.reset();
      this.recovery.reset();
      this.player.reset();
    }
    dispose() {
      this.#running = false;
      this.routes.observePlaybackFacts(null);
      this.earlyRetry?.dispose();
      for (const stop of this.#stops.splice(0).reverse()) stop();
    }
  };

  // src-v2/domain/route-capacity.ts
  var ROUTE_HEADROOM = 1;
  var EARLY_RETRY_HEADROOM = 1.35;
  function recentCapacity(row) {
    return row.capacityConfidence === "sufficient" || row.capacityConfidence === "provisional";
  }
  __name(recentCapacity, "recentCapacity");
  function adequateCapacity(row) {
    return recentCapacity(row) && row.safeThroughputMbps !== null && Number.isFinite(row.safeThroughputMbps) && row.safeThroughputMbps > 0 && Number.isFinite(row.demandRatio) && (row.demandRatio ?? 0) >= ROUTE_HEADROOM;
  }
  __name(adequateCapacity, "adequateCapacity");
  function capacityPriority(row) {
    if (adequateCapacity(row)) return row.capacityConfidence === "sufficient" ? 0 : 1;
    if (recentCapacity(row) && row.safeThroughputMbps !== null) return 2;
    if (row.safeThroughputMbps !== null && Number.isFinite(row.safeThroughputMbps) && row.safeThroughputMbps > 0)
      return 3;
    return 4;
  }
  __name(capacityPriority, "capacityPriority");
  function orderCapacityRows(rows, budget, now) {
    const reason = completionReason(budget, now);
    const predicted = rows.map((row) => ({
      row,
      time: reason === "available" && recentCapacity(row) ? predictCompletionMs(budget.requestBytes, row.safePayloadMbps, row.predictionTtfbMs) : null
    }));
    const complete = /* @__PURE__ */ new Map();
    const cohort = /* @__PURE__ */ __name((row) => adequateCapacity(row) ? 0 : capacityPriority(row), "cohort");
    for (const item of predicted) {
      if (item.row.eligible === false) continue;
      const tier = cohort(item.row);
      complete.set(tier, (complete.get(tier) ?? true) && item.time !== null);
    }
    const decorated = predicted.map(
      ({ row, time }) => Object.freeze({
        ...row,
        estimatedCompletionMs: time,
        comparisonMode: row.eligible !== false && complete.get(cohort(row)) === true ? "completion" : "throughput",
        predictionReason: reason !== "available" ? reason : time === null ? "unknown-body-rate" : complete.get(cohort(row)) ? "available" : "cohort-incomplete"
      })
    );
    return Object.freeze(
      decorated.sort((a, b) => {
        if (a.eligible !== false && b.eligible === false) return -1;
        if (a.eligible === false && b.eligible !== false) return 1;
        const merged = adequateCapacity(a) && adequateCapacity(b) && complete.get(0) === true;
        const tier = merged ? 0 : capacityPriority(a) - capacityPriority(b);
        if (tier) return tier;
        if (a.comparisonMode === "completion" && b.comparisonMode === "completion") {
          return a.estimatedCompletionMs - b.estimatedCompletionMs || capacityPriority(a) - capacityPriority(b) || a.candidateOrder - b.candidateOrder;
        }
        return (b.safeThroughputMbps ?? -1) - (a.safeThroughputMbps ?? -1) || a.candidateOrder - b.candidateOrder;
      })
    );
  }
  __name(orderCapacityRows, "orderCapacityRows");

  // src-v2/domain/early-retry.ts
  function evaluateEarlyRetry(input) {
    const reject = /* @__PURE__ */ __name((reason) => ({
      eligible: false,
      reason,
      remainingSec: null,
      alternativeSec: null
    }), "reject");
    const { now, startedAt, loadedBytes, totalBytes, playableBufferSec, requiredMbps, alternative } = input;
    if (!Number.isFinite(now) || !Number.isFinite(startedAt) || startedAt < 0 || now < startedAt || !Number.isSafeInteger(loadedBytes) || loadedBytes < 0 || !Number.isSafeInteger(totalBytes) || totalBytes <= 0 || loadedBytes > totalBytes || !Number.isFinite(playableBufferSec) || !Number.isFinite(requiredMbps) || requiredMbps <= 0)
      return reject("invalid-input");
    const age = input.ageMs ?? now - startedAt;
    if (!Number.isFinite(age) || age < 0) return reject("invalid-input");
    if (age < 1500) return reject("request-young");
    if (loadedBytes / totalBytes >= 0.8) return reject("mostly-complete");
    if (playableBufferSec <= 0 || playableBufferSec >= 6) return reject("buffer-window");
    const rate = input.recentBytesPerSec;
    if (rate === null || !Number.isFinite(rate) || rate < 0) return reject("unknown-rate");
    if (rate * 8 / 1e6 >= requiredMbps) return reject("adequate-current");
    if (!alternative.host || alternative.host === input.currentHost || !Number.isSafeInteger(alternative.successCount) || alternative.successCount < 2 || !Number.isFinite(alternative.oldestAt) || alternative.oldestAt < 0 || alternative.oldestAt > now || now - alternative.oldestAt > 6e4)
      return reject("alternative-evidence");
    if (!Number.isFinite(alternative.safeMbps) || alternative.safeMbps / requiredMbps < EARLY_RETRY_HEADROOM || !Number.isFinite(alternative.ttfbMs) || alternative.ttfbMs < 0)
      return reject("alternative-capacity");
    const alternativeMs = predictCompletionMs(
      totalBytes,
      alternative.safePayloadMbps ?? null,
      alternative.ttfbMs
    );
    if (alternativeMs === null) return reject("alternative-timing");
    const alternativeSec = 2 + alternativeMs / 1e3;
    if (!Number.isFinite(alternativeSec) || alternativeSec > 0.8 * playableBufferSec)
      return reject("alternative-late");
    const remainingSec = rate === 0 ? null : (totalBytes - loadedBytes) / rate;
    if (remainingSec !== null && (!Number.isFinite(remainingSec) || remainingSec <= 0.8 * playableBufferSec))
      return reject("current-finishes-in-time");
    if (remainingSec !== null && remainingSec - alternativeSec < 1)
      return reject("insufficient-benefit");
    return { eligible: true, reason: "eligible", remainingSec, alternativeSec };
  }
  __name(evaluateEarlyRetry, "evaluateEarlyRetry");

  // src-v2/application/routing/early-retry-controller.ts
  var EarlyRetryController = class {
    constructor(routes, flight, now) {
      this.routes = routes;
      this.flight = flight;
      this.now = now;
    }
    routes;
    flight;
    now;
    static {
      __name(this, "EarlyRetryController");
    }
    #pending = null;
    #attempted = /* @__PURE__ */ new WeakSet();
    #attemptTimes = [];
    #hostLast = /* @__PURE__ */ new Map();
    #attemptCount = 0;
    #episodeUsed = false;
    #healthyTicks = 0;
    #healthyAt = null;
    #healthyMs = 0;
    #breaker = false;
    #disposed = false;
    #revision = 0;
    #snapshot = Object.freeze({
      state: "idle",
      reason: "not-started",
      host: null,
      attempts: 0
    });
    tick(status) {
      if (this.#disposed || this.#breaker) return;
      const revision2 = ++this.#revision;
      try {
        const now = this.now();
        const unsafe = this.#unsafe(status);
        if (unsafe) {
          this.cancel(unsafe);
          return;
        }
        this.#observeHealthy(status);
        const pending = this.#pending;
        if (pending) {
          if (!this.#sameControls(pending.controls, status.controls)) {
            this.cancel("owner-changed");
            return;
          }
          const observations = this.flight.observations?.(pending.permit) ?? [];
          for (const event of observations.slice(pending.observed, 2)) {
            pending.observed++;
            this.#publish(
              event.state,
              event.state === "timedout" ? "native-timeout-observed" : "website-retry-claimed",
              pending.request.targetHost
            );
            if (revision2 !== this.#revision || this.#pending !== pending) return;
          }
          const state = this.flight.state(pending.permit);
          if (revision2 !== this.#revision || this.#pending !== pending) return;
          if (state === "succeeded") {
            this.#release();
            this.#publish("complete", "website-retry-succeeded", pending.request.targetHost);
          } else if (state === "dispatched") {
            pending.dispatchedAt ??= now;
            if (now - pending.dispatchedAt >= 15e3) this.#suspend("retry-completion-timeout");
            else this.#publish("dispatched", "website-retry-dispatched", pending.request.targetHost);
          } else if (state === "failed" || state === "expired" || state === null) {
            this.#suspend(state === "failed" ? "website-retry-failed" : "handoff-lost");
          } else if (now >= pending.permit.expiresAt) this.#suspend("handoff-expired");
          return;
        }
        if (status.progressObservation !== "progress") {
          this.#publish("waiting", "observation-insufficient", null);
          return;
        }
        if (!stableProgress(status.stableProgressTicks, status.stableProgressMs, 10)) {
          this.#publish("waiting", "stable-progress", null);
          return;
        }
        if (this.#episodeUsed) {
          this.#publish("waiting", "episode-used", null);
          return;
        }
        this.#attemptTimes = this.#attemptTimes.filter((at) => now - at < 3e4);
        for (const [host, at] of this.#hostLast) if (now - at >= 3e4) this.#hostLast.delete(host);
        if (this.#attemptTimes.length >= 3) {
          this.#publish("waiting", "document-quota", null);
          return;
        }
        const demand = status.demand;
        let waitingReason = "no-qualified-request";
        for (const sample of this.flight.samples(now).slice(0, 16)) {
          if (revision2 !== this.#revision) return;
          const request = sample.request;
          if (request.kind !== "video" || request.routeType !== "catalog-generated" || request.attributionStatus !== "matched" || !request.representation || this.#attempted.has(request) || now - (this.#hostLast.get(request.targetHost) ?? -Infinity) < 8e3)
            continue;
          const alternatives = this.routes.alternatives(request, demand);
          if (revision2 !== this.#revision) return;
          if (!alternatives.length) {
            waitingReason = "no-alternative";
            continue;
          }
          const facts = {
            now,
            startedAt: request.startedAt,
            ...sample.ageMs !== void 0 ? { ageMs: sample.ageMs } : {},
            currentHost: request.targetHost,
            loadedBytes: sample.loadedBytes,
            totalBytes: sample.totalBytes,
            recentBytesPerSec: sample.recentBytesPerSec,
            playableBufferSec: status.video.playableBufferSec,
            requiredMbps: demand.requiredMbps
          };
          let selected = null;
          let firstReason = null;
          for (const alternative of alternatives.slice(0, TRUSTED_CATALOG.length)) {
            const assessment = evaluateEarlyRetry({ ...facts, alternative });
            if (revision2 !== this.#revision) return;
            firstReason ??= assessment.reason;
            if (assessment.eligible && assessment.alternativeSec !== null && (!selected || assessment.alternativeSec < selected.seconds))
              selected = { alternative, seconds: assessment.alternativeSec };
          }
          if (!selected) {
            waitingReason = firstReason ?? "no-alternative";
            continue;
          }
          const permit = this.routes.prepare(request, selected.alternative.host, demand);
          if (!permit) continue;
          if (revision2 !== this.#revision || !Number.isFinite(permit.expiresAt) || permit.expiresAt <= this.now() || permit.expiresAt > this.now() + 2e3) {
            this.routes.revoke(permit);
            return;
          }
          const attempt = {
            observed: 0,
            permit,
            request,
            controls: Object.freeze({ ...status.controls }),
            dispatchedAt: null
          };
          this.#pending = attempt;
          this.#attempted.add(request);
          this.#attemptTimes.push(now);
          this.#hostLast.set(request.targetHost, now);
          this.#attemptCount = Math.min(1e9, this.#attemptCount + 1);
          this.#episodeUsed = true;
          if (!this.flight.arm(request.requestId, permit)) {
            if (this.#pending === attempt) this.#suspend("native-timeout-unavailable");
            return;
          }
          if (revision2 !== this.#revision || this.#pending !== attempt) return;
          this.#publish("armed", "native-timeout-armed", request.targetHost);
          return;
        }
        this.#publish("waiting", waitingReason, null);
      } catch {
        this.#suspend("port-failure");
      }
    }
    #unsafe(status) {
      if (!status.enabled) return "disabled-setting";
      if (status.disabled) return "disabled";
      if (status.fixedHost) return "route-mode";
      if (!status.visible) return "hidden";
      if (status.recovering) return "recovering";
      if (status.progressObservation === "clock-invalid") return "clock-invalid";
      if (status.progressObservation === "owner-changed") return "owner-changed";
      if (status.stallPending || status.progressObservation === "stalled") return "stall-confirming";
      const video = status.video;
      if (!video.available || video.paused || video.seeking || video.ended || video.mediaError || video.coreInitialized !== true || !video.manifestHasVideo || video.bufferedToEnd)
        return "playback-state";
      if (status.controls.dragging || status.controls.pendingSeekGoal) return "user-operation";
      if (!status.demand || status.demand.kind !== "video") return "unknown-demand";
      return null;
    }
    #sameControls(a, b) {
      return a.mediaId === b.mediaId && a.coreId === b.coreId && a.seekRevision === b.seekRevision && a.userRevision === b.userRevision && a.reloadRevision === b.reloadRevision && a.coreReloadRevision === b.coreReloadRevision;
    }
    #observeHealthy(status) {
      const now = status.sampledTick;
      if (!Number.isFinite(status.video.playableBufferSec) || status.video.playableBufferSec < 10 || !stableProgress(status.stableProgressTicks, status.stableProgressMs, 10) || now === null || !Number.isFinite(now) || now < 0 || status.progressObservation === "gap-progress") {
        this.#healthyAt = null;
        this.#healthyTicks = 0;
        this.#healthyMs = 0;
        return;
      }
      if (status.progressObservation !== "progress") {
        if (status.progressObservation === "insufficient" && this.#healthyAt !== null) {
          if (now - this.#healthyAt > 2e3) {
            this.#healthyTicks = 0;
            this.#healthyMs = 0;
            this.#healthyAt = null;
          } else if (now > this.#healthyAt) this.#healthyAt = now;
        }
        return;
      }
      if (this.#healthyAt === now) return;
      const gap = this.#healthyAt === null ? 0 : now - this.#healthyAt;
      const continuous = this.#healthyAt !== null && gap > 0 && gap <= 2e3;
      this.#healthyTicks = continuous ? this.#healthyTicks + 1 : 1;
      this.#healthyMs = continuous ? this.#healthyMs + gap : 0;
      this.#healthyAt = now;
      if (stableProgress(this.#healthyTicks, this.#healthyMs, 10)) this.#episodeUsed = false;
    }
    #release() {
      const pending = this.#pending;
      this.#pending = null;
      if (!pending) return;
      try {
        this.flight.cancel(pending.permit);
      } finally {
        this.routes.revoke(pending.permit);
      }
    }
    #suspend(reason) {
      this.#breaker = true;
      this.#revision++;
      const host = this.#pending?.request.targetHost ?? null;
      try {
        this.#release();
      } catch {
      }
      this.#publish("suspended", reason, host);
    }
    cancel(reason = "cancelled") {
      this.#revision++;
      this.#healthyAt = null;
      this.#healthyTicks = 0;
      this.#healthyMs = 0;
      try {
        this.#release();
      } catch {
        this.#breaker = true;
      }
      if (!this.#breaker) this.#publish("cancelled", reason, null);
    }
    reset() {
      this.cancel("lifecycle-reset");
    }
    dispose() {
      this.cancel("disposed");
      this.#disposed = true;
    }
    snapshot() {
      return this.#snapshot;
    }
    #publish(state, reason, host) {
      reason = earlyRetryReason(reason);
      if (this.#snapshot.state === state && this.#snapshot.reason === reason && this.#snapshot.host === host && this.#snapshot.attempts === this.#attemptCount)
        return;
      this.#snapshot = Object.freeze({
        state,
        reason,
        host,
        attempts: this.#attemptCount
      });
    }
  };

  // src-v2/application/control-commands.ts
  var ControlCommands = class {
    constructor(settings, restrictions, evidence, meta, routes) {
      this.settings = settings;
      this.restrictions = restrictions;
      this.evidence = evidence;
      this.meta = meta;
      this.routes = routes;
    }
    settings;
    restrictions;
    evidence;
    meta;
    routes;
    static {
      __name(this, "ControlCommands");
    }
    updateSettings(change) {
      return this.settings.update(change);
    }
    setCatalogEnabled(host, enabled) {
      return this.settings.setCatalogEnabled(host, enabled);
    }
    async clearLearning() {
      await this.evidence.clear();
      await this.restrictions.clear();
      await this.meta.clear();
    }
    async resetSettings() {
      await this.settings.reset();
      this.routes.invalidateForUserSetting();
    }
  };

  // src-v2/domain/circuit-policy.ts
  var CIRCUIT_OBSERVATION_MS = 3e5;
  var CIRCUIT_SUCCESS_GAP_MS = 12e4;
  var CIRCUIT_SETTLEMENT_GRACE_MS = 6e4;
  var CIRCUIT_PENDING_LIMIT = 64;
  var CIRCUIT_BACKOFF_MS = Object.freeze([6e5, 18e5, 72e5, 216e5]);
  var sameCircuitStamp = /* @__PURE__ */ __name((a, b) => !!a && !!b && a.generation === b.generation && a.recordId === b.recordId && a.revision === b.revision, "sameCircuitStamp");
  var startCircuitWindow = /* @__PURE__ */ __name((id2, stamp, now) => Object.freeze({
    id: id2,
    stamp,
    start: now,
    deadline: now + CIRCUIT_OBSERVATION_MS,
    hardDeadline: now + CIRCUIT_OBSERVATION_MS + CIRCUIT_SETTLEMENT_GRACE_MS,
    lastSuccess: now
  }), "startCircuitWindow");
  function advanceCircuitWindow(period, now) {
    if (!period) return { period: null, reason: "awaiting-new-transfer" };
    const reason = !Number.isFinite(now) || now < period.lastSuccess ? "clock-invalid" : now >= period.hardDeadline ? "settlement-expired" : now - period.lastSuccess > CIRCUIT_SUCCESS_GAP_MS ? "success-gap-expired" : null;
    return { period: reason ? null : period, reason };
  }
  __name(advanceCircuitWindow, "advanceCircuitWindow");
  var circuitWindowReady = /* @__PURE__ */ __name((period, now, pending) => advanceCircuitWindow(period, now).period !== null && now >= period.deadline && period.lastSuccess >= period.deadline && pending === 0, "circuitWindowReady");
  function failedCircuit(level, until, now) {
    const next = Math.min(4, Math.max(0, Math.ceil(level)) + 1);
    return { circuitLevel: next, circuitUntil: Math.max(until, now + CIRCUIT_BACKOFF_MS[next - 1]) };
  }
  __name(failedCircuit, "failedCircuit");

  // src-v2/state/measurement-meta-store.ts
  var MEASUREMENT_META_KEY = "bilicdn.v2.meta";
  var field = /* @__PURE__ */ __name((value, key) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return void 0;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor ? descriptor.value : void 0;
  }, "field");
  var cursorValue = /* @__PURE__ */ __name((value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : void 0, "cursorValue");
  var timeValue = /* @__PURE__ */ __name((value, ceiling = Number.MAX_SAFE_INTEGER) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= ceiling ? value : void 0, "timeValue");
  var parse = /* @__PURE__ */ __name((raw, now) => ({
    catalogCursor: field(raw, "schema") === 2 ? cursorValue(field(raw, "catalogCursor")) ?? 0 : 0,
    lastChallengeAt: field(raw, "schema") === 2 ? timeValue(field(raw, "lastChallengeAt"), now) ?? 0 : 0
  }), "parse");
  var id = /* @__PURE__ */ __name((value) => typeof value === "string" && /^[a-zA-Z0-9:_-]{1,64}$/.test(value), "id");
  var parseCoordination = /* @__PURE__ */ __name((raw) => {
    const generation = field(raw, "coordinationGeneration"), rows = field(raw, "revalidationClaims");
    if (field(raw, "coordinationProtocol") !== 1 || !id(generation) || !Array.isArray(rows) || rows.length > 96)
      return null;
    const claims = [], keys = /* @__PURE__ */ new Set();
    for (const row of rows) {
      const host = field(row, "host"), kind = field(row, "kind"), stamp = field(row, "stamp");
      const stampGeneration = field(stamp, "generation"), recordId = field(stamp, "recordId"), revision2 = field(stamp, "revision");
      const claimId = field(row, "claimId"), roundId = field(row, "roundId");
      if (typeof host !== "string" || !/^[a-z0-9.-]{1,253}$/.test(host) || !host.includes(".") || kind !== "video" && kind !== "audio" || !id(stampGeneration) || !id(recordId) || !Number.isSafeInteger(revision2) || Number(revision2) < 0 || !id(claimId) || !id(roundId))
        return null;
      const key = `${kind}:${host}`;
      if (keys.has(key)) return null;
      keys.add(key);
      claims.push(
        Object.freeze({
          host,
          kind,
          claimId,
          roundId,
          stamp: Object.freeze({ generation: stampGeneration, recordId, revision: Number(revision2) })
        })
      );
    }
    return Object.freeze({ generation, claims: Object.freeze(claims) });
  }, "parseCoordination");
  var coordinationFields = /* @__PURE__ */ __name((value) => value ? {
    coordinationProtocol: 1,
    coordinationGeneration: value.generation,
    revalidationClaims: value.claims
  } : {}, "coordinationFields");
  var MeasurementMetaStore = class {
    constructor(storage, now, ids, readControl) {
      this.storage = storage;
      this.now = now;
      this.ids = ids;
      this.readControl = readControl;
    }
    storage;
    now;
    ids;
    readControl;
    static {
      __name(this, "MeasurementMetaStore");
    }
    #lock;
    #seenProtocol = false;
    #protocolLost = false;
    #read() {
      const result = this.storage.readResult?.(MEASUREMENT_META_KEY, null);
      if (!result?.ok) throw Error("Measurement metadata read unconfirmed");
      return result.value;
    }
    #save(payload) {
      try {
        this.storage.set(MEASUREMENT_META_KEY, payload);
      } catch {
      }
      const raw = this.#read();
      const expectedCoordination = parseCoordination(payload), actualCoordination = parseCoordination(raw);
      if (field(raw, "schema") !== 2 || field(raw, "catalogCursor") !== payload.catalogCursor || field(raw, "lastChallengeAt") !== payload.lastChallengeAt || field(raw, "updatedAt") !== payload.updatedAt || JSON.stringify(actualCoordination) !== JSON.stringify(expectedCoordination))
        throw Error("Measurement metadata write unconfirmed");
    }
    get() {
      return parse(this.storage.get(MEASUREMENT_META_KEY, null), timeValue(this.now()) ?? 0);
    }
    update(change) {
      const now = timeValue(this.now()) ?? 0;
      const result = this.storage.readResult?.(MEASUREMENT_META_KEY, null);
      if (result && !result.ok) throw Error("Measurement metadata read unconfirmed");
      const raw = result?.ok ? result.value : this.storage.get(MEASUREMENT_META_KEY, null);
      const current = parse(raw, now), coordination = parseCoordination(raw);
      if (field(raw, "coordinationProtocol") !== void 0 && !coordination)
        throw Error("Invalid measurement coordination");
      if (this.#seenProtocol && !coordination) this.#protocolLost = true;
      this.storage.set(MEASUREMENT_META_KEY, {
        schema: 2,
        catalogCursor: cursorValue(field(change, "catalogCursor")) ?? current.catalogCursor,
        lastChallengeAt: timeValue(field(change, "lastChallengeAt"), now) ?? current.lastChallengeAt,
        updatedAt: now,
        ...coordinationFields(coordination)
      });
    }
    withLock(task) {
      return this.storage.withLock("measurement", async (lock) => {
        const previous = this.#lock;
        this.#lock = lock;
        try {
          return await task(lock);
        } finally {
          this.#lock = previous;
        }
      });
    }
    coordination(lock) {
      if (!lock?.exclusive || lock !== this.#lock || !this.ids || !this.storage.readResult || this.#protocolLost)
        return null;
      let raw;
      try {
        raw = this.#read();
      } catch {
        return null;
      }
      const existing = parseCoordination(raw);
      if (existing) {
        this.#seenProtocol = true;
        return existing;
      }
      if (this.#seenProtocol || field(raw, "coordinationProtocol") !== void 0) {
        this.#protocolLost = true;
        return null;
      }
      this.#seenProtocol = true;
      const initialized = { generation: this.ids.next("challenge"), claims: Object.freeze([]) };
      try {
        this.#save({
          schema: 2,
          ...parse(raw, timeValue(this.now()) ?? 0),
          updatedAt: this.now(),
          ...coordinationFields(initialized)
        });
        return initialized;
      } catch {
        return null;
      }
    }
    coordinationCurrent(generation) {
      if (!this.#lock?.exclusive || this.#protocolLost) return false;
      try {
        const value = parseCoordination(this.#read());
        if (!value && this.#seenProtocol) this.#protocolLost = true;
        return value?.generation === generation;
      } catch {
        return false;
      }
    }
    claimRevalidation(generation, claim) {
      if (!this.coordinationCurrent(generation)) return false;
      let raw;
      try {
        raw = this.#read();
      } catch {
        return false;
      }
      const current = parseCoordination(raw);
      if (!current || current.generation !== generation) return false;
      const previous = current.claims.find(
        (row) => row.host === claim.host && row.kind === claim.kind
      );
      if (previous && sameCircuitStamp(previous.stamp, claim.stamp)) return false;
      if (!previous && current.claims.length >= 96) return false;
      const claims = Object.freeze([
        ...current.claims.filter((row) => row !== previous),
        Object.freeze(claim)
      ]);
      const next = { generation, claims };
      const payload = {
        schema: 2,
        ...parse(raw, timeValue(this.now()) ?? 0),
        updatedAt: this.now(),
        ...coordinationFields(next)
      };
      if (!parseCoordination(payload)) return false;
      try {
        const control = this.readControl?.(claim.host, claim.kind), now = timeValue(this.now());
        if (!control?.synchronized || !sameCircuitStamp(control.stamp, claim.stamp) || now === void 0 || control.until <= 0 || control.until > now || !this.coordinationCurrent(generation))
          return false;
        this.#save(payload);
        return true;
      } catch {
        return false;
      }
    }
    async clear() {
      await this.withLock(() => {
        this.#read();
        const next = this.ids ? { generation: this.ids.next("challenge"), claims: Object.freeze([]) } : null;
        this.#save({
          schema: 2,
          catalogCursor: 0,
          lastChallengeAt: 0,
          updatedAt: this.now(),
          ...coordinationFields(next)
        });
        this.#seenProtocol = next !== null;
        this.#protocolLost = false;
      });
    }
  };

  // src-v2/platform/storage.ts
  var TampermonkeyStorage = class {
    static {
      __name(this, "TampermonkeyStorage");
    }
    readResult(key, fallback) {
      try {
        return { ok: true, value: GM_getValue(key, fallback) };
      } catch {
        return { ok: false };
      }
    }
    sharedLockAvailable() {
      try {
        return typeof navigator.locks?.request === "function";
      } catch {
        return false;
      }
    }
    get(key, fallback) {
      try {
        return GM_getValue(key, fallback);
      } catch {
        return fallback;
      }
    }
    set(key, value) {
      GM_setValue(key, value);
    }
    delete(key) {
      try {
        GM_deleteValue(key);
      } catch {
      }
    }
    listen(key, listener) {
      if (typeof GM_addValueChangeListener !== "function") return () => void 0;
      let id2;
      try {
        id2 = GM_addValueChangeListener(
          key,
          (_name, _oldValue, value, remote) => listener(value, remote)
        );
      } catch {
        return () => void 0;
      }
      return () => {
        try {
          GM_removeValueChangeListener(id2);
        } catch {
        }
      };
    }
    async withLock(name, task) {
      const manager = navigator.locks;
      if (!manager?.request) return await task({ exclusive: false });
      return await manager.request(`bilicdn.v2.${name}`, async () => await task({ exclusive: true }));
    }
  };

  // src-v2/platform/runtime-ids.ts
  var createRuntimeIds = /* @__PURE__ */ __name((random = (bytes) => crypto.getRandomValues(bytes)) => {
    const namespace = /* @__PURE__ */ __name(() => [...random(new Uint8Array(16))].map((byte) => byte.toString(16).padStart(2, "0")).join(""), "namespace");
    let prefix = namespace(), serial = 0;
    return {
      next(kind) {
        if (serial >= Number.MAX_SAFE_INTEGER) {
          prefix = namespace();
          serial = 0;
        }
        return `${kind[0]}:${prefix}:${(++serial).toString(36)}`;
      }
    };
  }, "createRuntimeIds");

  // src-v2/state/settings-store.ts
  var SETTINGS_KEY = "bilicdn.v2.settings";
  var BOOLEAN_DEFAULTS = Object.freeze({
    disabled: false,
    considerNativeSources: true,
    earlyRetryEnabled: true,
    blockWebRtc: true,
    blockHttpDns: true
  });
  var booleanSettings = /* @__PURE__ */ __name((raw) => Object.fromEntries(
    Object.entries(BOOLEAN_DEFAULTS).map(([key, fallback]) => {
      const value = raw[key];
      return [key, typeof value === "boolean" ? value : fallback];
    })
  ), "booleanSettings");
  var SUPPRESSED_SETTINGS = ["earlyRetryEnabled", "considerNativeSources"];
  var defaultSettings = /* @__PURE__ */ __name((now) => Object.freeze({
    schema: 2,
    ...BOOLEAN_DEFAULTS,
    fixedHost: null,
    catalogOverrides: Object.freeze({}),
    updatedAt: now
  }), "defaultSettings");
  var parseSettings = /* @__PURE__ */ __name((value, now) => {
    if (!value || typeof value !== "object") return defaultSettings(now);
    const raw = value;
    if (raw.schema !== 2) return defaultSettings(now);
    const overrides = {};
    if (raw.catalogOverrides && typeof raw.catalogOverrides === "object") {
      for (const [host, enabled] of Object.entries(raw.catalogOverrides)) {
        if (isCatalogHost(host) && typeof enabled === "boolean") overrides[host] = enabled;
      }
    }
    const fixedHost = typeof raw.fixedHost === "string" && isCatalogHost(raw.fixedHost) ? raw.fixedHost : null;
    return Object.freeze({
      schema: 2,
      ...booleanSettings(raw),
      fixedHost,
      catalogOverrides: Object.freeze(overrides),
      updatedAt: Number.isFinite(raw.updatedAt) ? Math.min(now + 5 * 6e4, Math.max(0, Number(raw.updatedAt))) : now
    });
  }, "parseSettings");
  var SettingsStore = class {
    constructor(storage, now) {
      this.storage = storage;
      this.now = now;
      this.#state = parseSettings(storage.get(SETTINGS_KEY, null), now());
      this.#stopRemote = storage.listen(SETTINGS_KEY, (value, remote) => {
        if (!remote) return;
        const next = parseSettings(value, this.now());
        if (next.updatedAt < this.#state.updatedAt) return;
        this.#publish(next);
      });
    }
    storage;
    now;
    static {
      __name(this, "SettingsStore");
    }
    #pendingOff = {
      earlyRetryEnabled: 0,
      considerNativeSources: 0
    };
    #state;
    #listeners = /* @__PURE__ */ new Set();
    #stopRemote;
    get() {
      if (!SUPPRESSED_SETTINGS.some((key) => this.#pendingOff[key] > 0)) return this.#state;
      const suppressed = SUPPRESSED_SETTINGS.filter((key) => this.#pendingOff[key] > 0);
      return Object.freeze({
        ...this.#state,
        ...Object.fromEntries(suppressed.map((key) => [key, false]))
      });
    }
    #holdOff(keys) {
      for (const key of keys) this.#pendingOff[key]++;
      if (keys.length) this.#emit();
      return () => {
        for (const key of keys) this.#pendingOff[key]--;
        if (keys.length) this.#emit();
      };
    }
    #save(value, current, now) {
      const next = parseSettings(
        { ...value, schema: 2, updatedAt: Math.max(now, current.updatedAt + 1) },
        now
      );
      this.storage.set(SETTINGS_KEY, next);
      return next;
    }
    #publish(next) {
      this.#state = next;
      this.#emit();
      return next;
    }
    subscribe(listener) {
      this.#listeners.add(listener);
      return () => this.#listeners.delete(listener);
    }
    async update(change) {
      const releaseEarlyRetry = this.#holdOff(
        change.earlyRetryEnabled === false ? ["earlyRetryEnabled"] : []
      );
      const releaseNative = this.#holdOff(
        change.considerNativeSources === false ? ["considerNativeSources"] : []
      );
      try {
        return await this.storage.withLock("settings", () => {
          const current = parseSettings(this.storage.get(SETTINGS_KEY, null), this.now());
          const now = this.now();
          return this.#publish(this.#save({ ...current, ...change }, current, now));
        });
      } finally {
        releaseEarlyRetry();
        releaseNative();
      }
    }
    async setCatalogEnabled(host, enabled) {
      if (!isCatalogHost(host)) throw new TypeError("Unknown Catalog host");
      return await this.storage.withLock("settings", () => {
        const now = this.now(), current = parseSettings(this.storage.get(SETTINGS_KEY, null), now);
        return this.#publish(
          this.#save(
            { ...current, catalogOverrides: { ...current.catalogOverrides, [host]: enabled } },
            current,
            now
          )
        );
      });
    }
    async reset() {
      const release = this.#holdOff(["considerNativeSources", "earlyRetryEnabled"]);
      try {
        const next = await this.storage.withLock("settings", () => {
          const now = this.now(), current = parseSettings(this.storage.get(SETTINGS_KEY, null), now);
          return this.#save(defaultSettings(now), current, now);
        });
        return this.#publish(next);
      } finally {
        release();
      }
    }
    dispose() {
      this.#stopRemote();
      this.#listeners.clear();
    }
    #emit() {
      const state = this.get();
      for (const listener of this.#listeners) listener(state);
    }
  };

  // src-v2/state/restriction-store.ts
  var RESTRICTIONS_KEY = "bilicdn.v2.restrictions";
  var savedPayloadMatches = /* @__PURE__ */ __name((raw, expected) => {
    if (!raw || typeof raw !== "object") return false;
    const payload = raw;
    if (payload.schema !== 2 || payload.updatedAt !== expected.updatedAt || !Array.isArray(payload.records) || payload.records.length !== expected.records.length)
      return false;
    return payload.records.every((rawRecord, index) => {
      if (!rawRecord || typeof rawRecord !== "object") return false;
      const actual = rawRecord, row = expected.records[index];
      return actual.host === row.host && actual.type === row.type && actual.kind === row.kind && actual.reason === row.reason && actual.createdAt === row.createdAt && actual.expireAt === row.expireAt && actual.updatedAt === row.updatedAt;
    });
  }, "savedPayloadMatches");
  var safeHost = /* @__PURE__ */ __name((value) => {
    const host = String(value ?? "").trim().toLowerCase();
    return /^[a-z0-9.-]{1,253}$/.test(host) && host.includes(".") ? host : null;
  }, "safeHost");
  var parsePayload = /* @__PURE__ */ __name((value, now) => {
    const raw = value && typeof value === "object" ? value : {};
    const rows = Array.isArray(raw.records) ? raw.records : [];
    const records = [];
    for (const item of rows.slice(0, 128)) {
      if (!item || typeof item !== "object") continue;
      const row = item;
      const host = safeHost(row.host);
      const type = row.type === "black" || row.type === "dead" ? row.type : null;
      const storedKind = row.kind === "video" || row.kind === "audio" || row.kind === "all" ? row.kind : "all";
      const reason = String(row.reason ?? "").slice(0, 64);
      const kind = type === "black" && storedKind === "video" && reason === "user" ? "all" : storedKind;
      const expireAt = Number(row.expireAt);
      if (!host || !type || !Number.isFinite(expireAt) || expireAt <= now || expireAt > now + 30 * 24 * 60 * 6e4)
        continue;
      records.push(
        Object.freeze({
          host,
          type,
          kind,
          reason,
          createdAt: Math.min(now, Math.max(0, Number(row.createdAt) || now)),
          expireAt,
          updatedAt: Math.min(now + 5 * 6e4, Math.max(0, Number(row.updatedAt) || now))
        })
      );
    }
    return Object.freeze({
      schema: 2,
      records: Object.freeze(records),
      updatedAt: Number(raw.updatedAt) || now
    });
  }, "parsePayload");
  var mergePayload = /* @__PURE__ */ __name((a, b, now) => {
    const merged = /* @__PURE__ */ new Map();
    for (const row of [...a.records, ...b.records]) {
      if (row.expireAt <= now) continue;
      const key = `${row.type}:${row.kind}:${row.host}`;
      const old = merged.get(key);
      if (!old || row.updatedAt >= old.updatedAt) merged.set(key, row);
    }
    return Object.freeze({
      schema: 2,
      records: Object.freeze([...merged.values()].slice(-128)),
      updatedAt: Math.max(a.updatedAt, b.updatedAt, now)
    });
  }, "mergePayload");
  var RestrictionStore = class {
    constructor(storage, now) {
      this.storage = storage;
      this.now = now;
      this.#payload = parsePayload(null, now());
      this.#read();
      this.#stopRemote = storage.listen(RESTRICTIONS_KEY, (_value, remote) => {
        if (!remote) return;
        this.#read();
      });
    }
    storage;
    now;
    static {
      __name(this, "RestrictionStore");
    }
    #payload;
    #stopRemote;
    #readToken = 0;
    #disposed = false;
    #read() {
      if (this.#disposed) return null;
      const token = ++this.#readToken;
      try {
        const result = this.storage.readResult(RESTRICTIONS_KEY, null);
        if (!result.ok || token !== this.#readToken) return null;
        const payload = parsePayload(result.value, this.now());
        if (token !== this.#readToken) return null;
        this.#payload = payload;
        return { raw: result.value, payload, token };
      } catch {
        return null;
      }
    }
    async #write(build) {
      await this.storage.withLock("restrictions", () => {
        const current = this.#read();
        if (!current) throw Error("Restriction read unconfirmed");
        const now = this.now();
        if (!Number.isFinite(now) || now < 0) throw Error("Restriction clock invalid");
        const next = build(current.payload, now);
        if (current.token !== this.#readToken) throw Error("Restriction read superseded");
        let writeError;
        try {
          this.storage.set(RESTRICTIONS_KEY, next);
        } catch (error) {
          writeError = error;
        }
        const actual = this.#read();
        if (!actual || !savedPayloadMatches(actual.raw, next) || actual.token !== this.#readToken)
          throw writeError ?? Error("Restriction write unconfirmed");
      });
    }
    has(host, kind, type) {
      const now = this.now();
      return this.#payload.records.some(
        (row) => row.host === host && row.expireAt > now && (row.kind === "all" || row.kind === kind) && (!type || row.type === type)
      );
    }
    snapshot(kind) {
      const now = this.now(), black = /* @__PURE__ */ new Set(), dead = /* @__PURE__ */ new Set();
      for (const row of this.#payload.records) {
        if (row.expireAt <= now || row.kind !== "all" && row.kind !== kind) continue;
        (row.type === "black" ? black : dead).add(row.host);
      }
      return Object.freeze({ blackHosts: black, deadHosts: dead });
    }
    list() {
      return Object.freeze(this.#payload.records.filter((row) => row.expireAt > this.now()));
    }
    async add(record) {
      await this.#write((current, now) => {
        const incoming = parsePayload(
          { schema: 2, updatedAt: now, records: [{ ...record, createdAt: now, updatedAt: now }] },
          now
        );
        return mergePayload(current, incoming, now);
      });
    }
    async remove(host, type) {
      await this.#write(
        (current, now) => Object.freeze({
          schema: 2,
          updatedAt: now,
          records: Object.freeze(
            current.records.filter((row) => row.host !== host || !!type && row.type !== type)
          )
        })
      );
    }
    async clear() {
      await this.#write(
        (_current, now) => Object.freeze({ schema: 2, records: Object.freeze([]), updatedAt: now })
      );
    }
    dispose() {
      this.#disposed = true;
      this.#readToken++;
      this.#stopRemote();
    }
  };

  // src-v2/domain/evidence.ts
  var EVIDENCE_TTL_MS = 24 * 60 * 60 * 1e3;
  var FRESH_EVIDENCE_MS = 5 * 60 * 1e3;
  var MAX_EVIDENCE_SAMPLES = 12;
  var MIN_THROUGHPUT_BYTES = 64 * 1024;
  var PROVEN_FAILURE_QUIET_MS = 30 * 60 * 1e3;
  var positive2 = /* @__PURE__ */ __name((value) => typeof value === "number" && Number.isFinite(value) && value > 0, "positive");
  var speed = /* @__PURE__ */ __name((value) => positive2(value) ? Math.min(1e5, value) : null, "speed");
  function sampleTiming(bytes, elapsedMs, ttfbMs) {
    if (!Number.isSafeInteger(bytes) || !positive2(bytes) || !positive2(elapsedMs)) return null;
    if (ttfbMs != null && (typeof ttfbMs !== "number" || !Number.isFinite(ttfbMs) || ttfbMs < 0 || ttfbMs >= elapsedMs))
      return null;
    return { bytes, elapsedMs };
  }
  __name(sampleTiming, "sampleTiming");
  var emptyEvidence = /* @__PURE__ */ __name((host, kind) => ({
    host,
    kind,
    samples: Object.freeze([]),
    circuitLevel: 0,
    circuitUntil: 0,
    updatedAt: 0
  }), "emptyEvidence");
  var pruneSamples = /* @__PURE__ */ __name((samples, now) => Object.freeze(
    samples.filter(
      (sample) => Number.isFinite(sample.at) && sample.at <= now && now - sample.at <= EVIDENCE_TTL_MS
    ).sort(
      (a, b) => a.at - b.at || (a.requestId < b.requestId ? -1 : a.requestId > b.requestId ? 1 : 0)
    ).slice(-MAX_EVIDENCE_SAMPLES)
  ), "pruneSamples");
  var hasSpeed = /* @__PURE__ */ __name((sample) => sample.outcome === "success" && speed(sample.throughputMbps) !== null && (sample.bytes === void 0 || sample.bytes >= MIN_THROUGHPUT_BYTES), "hasSpeed");
  var addEvidenceSample = /* @__PURE__ */ __name((evidence, sample, now) => {
    const samples = pruneSamples([...evidence.samples, Object.freeze({ ...sample })], now);
    const failed = sample.outcome === "failure", verified = hasSpeed(sample);
    const circuit = failed ? failedCircuit(evidence.circuitLevel, evidence.circuitUntil, now) : {
      circuitLevel: evidence.circuitLevel,
      circuitUntil: verified && evidence.circuitUntil <= now ? 0 : evidence.circuitUntil
    };
    return Object.freeze({ ...evidence, samples, ...circuit, updatedAt: now });
  }, "addEvidenceSample");
  function conservativeEwma(values) {
    if (!values.length) return null;
    let fast = values[0], slow = fast;
    for (const value of values.slice(1)) {
      fast += (1 - 2 ** (-1 / 2)) * (value - fast);
      slow += (1 - 2 ** (-1 / 5)) * (value - slow);
    }
    return speed(Math.min(fast, slow, values.at(-1)) * (values.length === 1 ? 0.7 : 1));
  }
  __name(conservativeEwma, "conservativeEwma");
  var evidenceMetrics = /* @__PURE__ */ __name((evidence, now, basis) => {
    const unique = /* @__PURE__ */ new Map();
    for (const sample of pruneSamples(evidence?.samples ?? [], now))
      unique.set(sample.requestId || `${sample.at}:${sample.source}:${sample.outcome}`, sample);
    const samples = [...unique.values()];
    const successes = samples.filter((sample) => sample.outcome === "success");
    const failures = samples.filter((sample) => sample.outcome === "failure");
    const throughput = successes.filter(hasSpeed);
    const fresh = throughput.filter((sample) => now - sample.at <= FRESH_EVIDENCE_MS);
    const freshCount = new Set(
      fresh.filter((sample) => sample.requestId).map((sample) => sample.requestId)
    ).size;
    const ttfb = successes.map((sample) => sample.ttfbMs).filter((value) => value !== null && Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
    const payload = fresh.flatMap((sample) => {
      if (!basis || sample.timingBasis !== basis) return [];
      const timing = sampleTiming(sample.bytes, sample.elapsedMs, sample.ttfbMs);
      if (!timing || sample.ttfbMs === null) return [];
      const rate = speed(timing.bytes * 8 / (timing.elapsedMs - sample.ttfbMs) / 1e3);
      return rate === null ? [] : [{ rate, ttfb: sample.ttfbMs }];
    });
    const revalidationRequired = !!evidence?.circuitUntil && evidence.circuitUntil <= now;
    const recentFailure = failures.some((sample) => now - sample.at < PROVEN_FAILURE_QUIET_MS);
    const state = evidence && evidence.circuitUntil > now ? "circuit-open" : successes.length >= 2 && !recentFailure ? "proven" : successes.length ? "usable" : failures.length ? "degraded" : "unknown";
    const capacityConfidence = revalidationRequired ? "revalidation" : freshCount >= 2 ? "sufficient" : freshCount === 1 ? "provisional" : throughput.length ? "historical" : "missing";
    return {
      state,
      capacityConfidence,
      revalidationRequired,
      safeThroughputMbps: conservativeEwma(throughput.map((sample) => sample.throughputMbps)),
      medianTtfbMs: ttfb.length ? ttfb[Math.floor((ttfb.length - 1) / 2)] : null,
      successCount: successes.length,
      failureCount: failures.length,
      speedSampleCount: throughput.length,
      freshSpeedCount: freshCount,
      newestSpeedAt: throughput.at(-1)?.at ?? null,
      safePayloadMbps: conservativeEwma(payload.map((row) => row.rate)),
      predictionTtfbMs: payload.length ? Math.max(...payload.map((row) => row.ttfb)) : null
    };
  }, "evidenceMetrics");

  // src-v2/state/evidence-store.ts
  var EVIDENCE_KEY = "bilicdn.v2.routeEvidence";
  var MAX_VIDEO_HOSTS = 64;
  var MAX_AUDIO_HOSTS = 32;
  var recordKey = /* @__PURE__ */ __name((host, kind) => `${kind}:${host}`, "recordKey");
  var identifier = /* @__PURE__ */ __name((value) => typeof value === "string" && /^[a-zA-Z0-9:_-]{1,64}$/.test(value), "identifier");
  var revision = /* @__PURE__ */ __name((value) => Number.isSafeInteger(value) && Number(value) >= 0, "revision");
  var parseControl = /* @__PURE__ */ __name((value) => {
    if (!value || typeof value !== "object") return void 0;
    const row = value;
    if (!identifier(row.recordId) || !revision(row.revision) || row.lastCommitId !== null && !identifier(row.lastCommitId))
      return void 0;
    return Object.freeze({
      recordId: row.recordId,
      revision: row.revision,
      lastCommitId: row.lastCommitId
    });
  }, "parseControl");
  var safeHost2 = /* @__PURE__ */ __name((value) => {
    const host = String(value ?? "").trim().toLowerCase();
    return /^[a-z0-9.-]{1,253}$/.test(host) && host.includes(".") ? host : null;
  }, "safeHost");
  var parsePayload2 = /* @__PURE__ */ __name((value, now) => {
    const raw = value && typeof value === "object" ? value : {};
    const source = raw.records && typeof raw.records === "object" ? raw.records : {};
    const records = {};
    for (const item of Object.values(source).slice(0, MAX_VIDEO_HOSTS + MAX_AUDIO_HOSTS)) {
      if (!item || typeof item !== "object") continue;
      const row = item, host = safeHost2(row.host), kind = row.kind;
      if (!host || kind !== "video" && kind !== "audio") continue;
      const samples = [];
      for (const rawSample of (Array.isArray(row.samples) ? row.samples : []).slice(
        -MAX_EVIDENCE_SAMPLES
      )) {
        if (!rawSample || typeof rawSample !== "object") continue;
        const sample = rawSample, at = Number(sample.at);
        if (!Number.isFinite(at) || at > now + 5 * 6e4 || now - at > EVIDENCE_TTL_MS) continue;
        const outcome = sample.outcome === "failure" ? "failure" : sample.outcome === "success" ? "success" : null;
        if (!outcome) continue;
        const timing = outcome === "success" ? sampleTiming(sample.bytes, sample.elapsedMs, sample.ttfbMs) : null;
        samples.push(
          Object.freeze({
            requestId: String(sample.requestId ?? "").slice(0, 64),
            at,
            source: sample.source === "challenge" ? "challenge" : "transport",
            outcome,
            throughputMbps: Number.isFinite(sample.throughputMbps) ? Math.min(1e5, Math.max(0, Number(sample.throughputMbps))) : null,
            ttfbMs: Number.isFinite(sample.ttfbMs) ? Math.min(12e4, Math.max(0, Number(sample.ttfbMs))) : null,
            failureKind: ["network", "body", "timeout", "http-5xx", "native-invalid"].includes(
              String(sample.failureKind)
            ) ? sample.failureKind : null,
            ...timing ?? {},
            ...timingBasis(sample.timingBasis) ? { timingBasis: timingBasis(sample.timingBasis) } : {}
          })
        );
      }
      const updatedAt = Math.min(now + 5 * 6e4, Math.max(0, Number(row.updatedAt) || 0));
      const control = parseControl(row.circuitControl);
      const evidence = Object.freeze({
        host,
        kind,
        samples: Object.freeze(samples),
        circuitLevel: Math.max(0, Math.min(4, Math.ceil(Number(row.circuitLevel) || 0))),
        circuitUntil: Math.min(
          now + 7 * 24 * 60 * 6e4,
          Math.max(0, Number(row.circuitUntil) || 0)
        ),
        ...control ? { circuitControl: control } : {},
        updatedAt
      });
      records[recordKey(host, kind)] = evidence;
    }
    return Object.freeze({
      ...raw.controlProtocol === 1 && identifier(raw.generation) && revision(raw.dataRevision) ? { controlProtocol: 1, generation: raw.generation, dataRevision: raw.dataRevision } : {},
      schema: 2,
      records: Object.freeze(records),
      updatedAt: Number(raw.updatedAt) || now
    });
  }, "parsePayload");
  var EvidenceStore = class {
    constructor(storage, now, ids) {
      this.storage = storage;
      this.now = now;
      this.ids = ids;
      this.#payload = parsePayload2(null, now());
      this.#refresh();
      this.#stopRemote = storage.listen(EVIDENCE_KEY, (_value, remote) => {
        if (!remote) return;
        this.#refresh();
      });
    }
    storage;
    now;
    ids;
    static {
      __name(this, "EvidenceStore");
    }
    #payload;
    #stopRemote;
    #readable = true;
    #writes = /* @__PURE__ */ new WeakMap();
    #downgrades = /* @__PURE__ */ new WeakSet();
    #refresh() {
      try {
        const result = this.storage.readResult?.(EVIDENCE_KEY, null);
        if (result && !result.ok) {
          this.#readable = false;
          return null;
        }
        const raw = result?.ok ? result.value : this.storage.get(EVIDENCE_KEY, null);
        this.#payload = parsePayload2(raw, this.now());
        this.#readable = true;
        return this.#payload;
      } catch {
        this.#readable = false;
        return null;
      }
    }
    readCurrentControl(host, kind) {
      if (!this.storage.readResult || !this.#refresh()) return null;
      return this.control(host, kind);
    }
    control(host, kind) {
      const row = this.get(host, kind), control = row?.circuitControl;
      return {
        level: row?.circuitLevel ?? 0,
        until: row?.circuitUntil ?? 0,
        stamp: this.#readable && this.#payload.generation && control ? Object.freeze({
          generation: this.#payload.generation,
          recordId: control.recordId,
          revision: control.revision
        }) : null,
        synchronized: this.#readable && !!this.ids && !!this.storage.readResult && this.storage.sharedLockAvailable?.() === true
      };
    }
    #result(status, host, kind) {
      return {
        status,
        evidence: this.get(host, kind) ?? emptyEvidence(host, kind),
        stamp: this.control(host, kind).stamp
      };
    }
    #updatedPayload(latest, row) {
      const records = { ...latest.records };
      if (row) records[recordKey(row.host, row.kind)] = row;
      for (const kind of ["video", "audio"]) {
        const rows = Object.entries(records).filter(([, value]) => value.kind === kind).sort((a, b) => b[1].updatedAt - a[1].updatedAt);
        for (const [key] of rows.slice(kind === "video" ? MAX_VIDEO_HOSTS : MAX_AUDIO_HOSTS))
          delete records[key];
      }
      const rotate = !latest.generation || latest.dataRevision === Number.MAX_SAFE_INTEGER;
      return Object.freeze({
        schema: 2,
        records: Object.freeze(records),
        updatedAt: this.now(),
        ...this.ids ? {
          controlProtocol: 1,
          generation: rotate ? this.ids.next("circuit") : latest.generation,
          dataRevision: rotate ? 1 : (latest.dataRevision ?? 0) + 1
        } : {}
      });
    }
    #save(payload) {
      let accepted = false;
      let error;
      try {
        this.storage.set(EVIDENCE_KEY, payload);
        accepted = true;
      } catch (cause) {
        error = cause;
      }
      const actual = this.#refresh();
      const confirmed = !!actual && (payload.generation ? actual.generation === payload.generation && actual.dataRevision === payload.dataRevision : accepted);
      return { confirmed, ...error !== void 0 ? { error } : {} };
    }
    get(host, kind) {
      return this.#payload.records[recordKey(host, kind)] ?? null;
    }
    list(kind) {
      return Object.freeze(
        Object.values(this.#payload.records).filter((row) => !kind || row.kind === kind)
      );
    }
    async record(host, kind, sample, valid = () => true) {
      const result = await this.commit(host, kind, sample, sample, valid);
      if (result.status === "unconfirmed") throw result.error ?? Error("Evidence write unconfirmed");
      return result.evidence;
    }
    async commit(host, kind, sample, receipt, valid = () => true) {
      const key = recordKey(host, kind);
      let operations = this.#writes.get(receipt);
      const previous = operations?.get(key);
      if (previous) return { ...await previous, status: "duplicate" };
      if (!operations) {
        operations = /* @__PURE__ */ new Map();
        this.#writes.set(receipt, operations);
      }
      if (operations.size >= MAX_VIDEO_HOSTS + MAX_AUDIO_HOSTS)
        return this.#result("invalid", host, kind);
      const pending = Promise.resolve().then(
        () => this.storage.withLock("routeEvidence", () => {
          const latest = this.#refresh();
          if (!latest) return this.#result("unconfirmed", host, kind);
          if (!valid()) return this.#result("invalid", host, kind);
          const prior = latest.records[recordKey(host, kind)] ?? emptyEvidence(host, kind);
          const deduped = {
            ...prior,
            samples: prior.samples.filter((row) => row.requestId !== sample.requestId)
          };
          let updated = addEvidenceSample(deduped, sample, this.now());
          if (this.ids) {
            const old = prior.circuitControl;
            const rotate = !old || old.revision === Number.MAX_SAFE_INTEGER;
            updated = {
              ...updated,
              circuitControl: Object.freeze({
                recordId: rotate ? this.ids.next("circuit") : old.recordId,
                revision: rotate ? 0 : old.revision + (sample.outcome === "failure" ? 1 : 0),
                lastCommitId: sample.outcome === "failure" ? this.ids.next("commit") : old?.lastCommitId ?? null
              })
            };
          }
          if (!valid()) return this.#result("invalid", host, kind);
          const saved = this.#save(this.#updatedPayload(latest, updated));
          return {
            ...this.#result(saved.confirmed ? "committed" : "unconfirmed", host, kind),
            ...saved.error !== void 0 ? { error: saved.error } : {}
          };
        })
      ).catch(() => this.#result("unconfirmed", host, kind));
      operations.set(key, pending);
      return await pending;
    }
    async tryDowngrade(host, kind, stamp, commitId, valid) {
      if (this.#downgrades.has(stamp)) return this.#result("duplicate", host, kind);
      this.#downgrades.add(stamp);
      try {
        return await this.storage.withLock("routeEvidence", (lock) => {
          if (!lock?.exclusive || !this.ids || !this.storage.readResult)
            return this.#result("no-common-lock", host, kind);
          const latest = this.#refresh();
          if (!latest) return this.#result("unconfirmed", host, kind);
          if (!sameCircuitStamp(stamp, this.control(host, kind).stamp))
            return this.#result("stale", host, kind);
          const prior = this.get(host, kind);
          if (!valid() || prior.circuitLevel <= 0 || prior.circuitUntil > this.now() || !identifier(commitId))
            return this.#result("invalid", host, kind);
          const old = prior.circuitControl, rotate = old.revision === Number.MAX_SAFE_INTEGER;
          const updated = {
            ...prior,
            circuitLevel: prior.circuitLevel - 1,
            circuitUntil: 0,
            updatedAt: this.now(),
            circuitControl: {
              recordId: rotate ? this.ids.next("circuit") : old.recordId,
              revision: rotate ? 0 : old.revision + 1,
              lastCommitId: commitId
            }
          };
          const saved = this.#save(this.#updatedPayload(latest, updated));
          return {
            ...this.#result(saved.confirmed ? "committed" : "unconfirmed", host, kind),
            ...saved.error !== void 0 ? { error: saved.error } : {}
          };
        });
      } catch {
        this.#refresh();
        return this.#result("unconfirmed", host, kind);
      }
    }
    async clear() {
      await this.storage.withLock("routeEvidence", () => {
        const empty = {
          schema: 2,
          records: Object.freeze({}),
          updatedAt: this.now(),
          ...this.ids ? { controlProtocol: 1, generation: this.ids.next("circuit"), dataRevision: 0 } : {}
        };
        const saved = this.#save(empty);
        if (!saved.confirmed) throw saved.error ?? Error("Evidence clear unconfirmed");
      });
    }
    dispose() {
      this.#stopRemote();
    }
  };

  // src-v2/state/session-store.ts
  var SessionStore = class {
    static {
      __name(this, "SessionStore");
    }
    #state = Object.freeze({
      generation: generationId(0),
      epoch: epochId(0),
      representation: null,
      affinity: null,
      disabled: false,
      recovering: false,
      lastDecisionId: null
    });
    get() {
      return this.#state;
    }
    isGeneration(generation) {
      return generation === this.#state.generation;
    }
    beginGeneration(disabled = false) {
      this.#state = Object.freeze({
        generation: generationId(Number(this.#state.generation) + 1),
        epoch: epochId(0),
        representation: null,
        affinity: null,
        disabled,
        recovering: false,
        lastDecisionId: null
      });
      return this.#state;
    }
    beginEpoch() {
      this.#state = Object.freeze({
        ...this.#state,
        epoch: epochId(Number(this.#state.epoch) + 1),
        representation: null,
        affinity: null,
        recovering: false,
        lastDecisionId: null
      });
      return this.#state;
    }
    setRepresentation(representation) {
      this.#state = Object.freeze({ ...this.#state, representation });
    }
    setAffinity(affinity) {
      this.#state = Object.freeze({ ...this.#state, affinity });
    }
    setRecovering(recovering) {
      this.#state = Object.freeze({ ...this.#state, recovering });
    }
    noteDecision(id2) {
      this.#state = Object.freeze({ ...this.#state, lastDecisionId: id2 });
    }
  };

  // src-v2/domain/frame-rate.ts
  function declaredFrameRate(value) {
    let rate;
    if (typeof value === "number") rate = value;
    else if (typeof value === "string" && value.length <= 64) {
      const text3 = value.trim();
      if (/^\d+(?:\.\d+)?$/.test(text3)) rate = Number(text3);
      else {
        const match = /^(\d+)\/(\d+)$/.exec(text3);
        if (!match) return void 0;
        const numerator = Number(match[1]), denominator = Number(match[2]);
        if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0)
          return void 0;
        rate = numerator / denominator;
      }
    } else return void 0;
    return Number.isFinite(rate) && rate > 0 ? rate : void 0;
  }
  __name(declaredFrameRate, "declaredFrameRate");

  // src-v2/state/signed-route-vault.ts
  var MAX_VIDEO_GROUPS = 128;
  var MAX_AUDIO_GROUPS = 64;
  var MAX_URLS_PER_GROUP = MAX_EXACT_SOURCES;
  var MAX_URL_CHARS = 1024 * 1024;
  var catalogSource = /* @__PURE__ */ __name((raw) => {
    const parsed = parseMediaUrl(raw);
    if (!parsed?.replaceable || parsed.kind !== "normal" && parsed.kind !== "pcdn") return false;
    const generated = replaceUrlHost(parsed.url.href, TRUSTED_CATALOG[0]);
    const target = generated ? parseMediaUrl(generated) : null;
    return target?.kind === "normal" && target.host === TRUSTED_CATALOG[0];
  }, "catalogSource");
  var SignedRouteVault = class {
    static {
      __name(this, "SignedRouteVault");
    }
    #generation = null;
    #epoch = null;
    #groups = /* @__PURE__ */ new Map();
    #byKey = /* @__PURE__ */ new Map();
    #byUrl = /* @__PURE__ */ new Map();
    #aliases = /* @__PURE__ */ new Map();
    #byPath = /* @__PURE__ */ new Map();
    #handles = /* @__PURE__ */ new Map();
    #invalid = /* @__PURE__ */ new Map();
    #outputs = /* @__PURE__ */ new Map();
    #urlChars = 0;
    #serial = 0;
    #handleSerial = 0;
    #authoritySerial = 0;
    reset(generation, epoch) {
      this.#generation = generation;
      this.#outputs.clear();
      this.#epoch = epoch;
      this.#groups.clear();
      this.#byKey.clear();
      this.#byUrl.clear();
      this.#aliases.clear();
      this.#byPath.clear();
      this.#handles.clear();
      this.#invalid.clear();
      this.#urlChars = 0;
      this.#serial = 0;
      this.#handleSerial = 0;
      this.#authoritySerial = 0;
    }
    registeredRepresentation(kind, key, codec, height) {
      return this.#byKey.get(`${kind}:${key}:${codec}:${height}`) ?? null;
    }
    register(input) {
      if (input.generation !== this.#generation || input.epoch !== this.#epoch) return null;
      const key = `${input.kind}:${input.key}:${input.codec}:${input.height}`;
      const priorId = this.#byKey.get(key), prior = priorId ? this.#groups.get(priorId) : void 0;
      if (prior?.source === "trusted-api" && input.source !== "trusted-api") return priorId ?? null;
      const admittedSources = admitSources(input.urls, input.source === "trusted-api");
      const sharedExact = /* @__PURE__ */ new Set();
      for (const route of admittedSources) {
        for (const rep2 of this.#byUrl.get(route.url) ?? []) {
          if (this.#groups.get(rep2)?.identity.kind === input.kind) sharedExact.add(rep2);
        }
      }
      if (input.source !== "trusted-api") {
        const authoritative = [...sharedExact].filter(
          (rep2) => this.#groups.get(rep2)?.source === "trusted-api"
        );
        if (authoritative.length)
          return authoritative.length === 1 ? authoritative[0] ?? null : null;
      } else {
        for (const rep2 of sharedExact) {
          if (rep2 === priorId || this.#groups.get(rep2)?.source === "trusted-api") continue;
          this.#dropGroup(rep2);
        }
      }
      const admitted = admittedSources.map((route) => route.url);
      const refresh = !!prior && input.source === "trusted-api" && prior.source === "trusted-api" && input.refreshTrustedSources === true;
      const refreshed = refresh && (admitted.length !== prior.routes.length || admitted.some((url) => !prior.routes.some((route) => route.url === url)));
      const promoted = !!prior && input.source === "trusted-api" && prior.source !== "trusted-api";
      const replaced = promoted || refreshed;
      const cap = input.kind === "video" ? MAX_VIDEO_GROUPS : MAX_AUDIO_GROUPS;
      if (!prior && [...this.#groups.values()].filter((group) => group.identity.kind === input.kind).length >= cap)
        return null;
      const rep = priorId ?? representationId(`${input.kind}:group-${++this.#serial}`);
      if (replaced && priorId && prior) {
        this.#revokeGroupRoutes(priorId, prior);
        this.#invalid.delete(priorId);
      }
      const routes = replaced ? [] : refresh ? admitted.map(
        (url, order) => Object.freeze({ ...prior.routes.find((route) => route.url === url), order })
      ) : [...prior?.routes ?? []];
      for (const source of admittedSources) {
        if (this.#urlChars + source.url.length > MAX_URL_CHARS) continue;
        if (routes.some((route) => route.url === source.url)) continue;
        if (routes.length >= MAX_URLS_PER_GROUP) {
          this.registerAlias(rep, source.url);
          continue;
        }
        const handle = signedRouteHandle(`route:${rep}:${++this.#handleSerial}`);
        routes.push(
          Object.freeze({
            handle,
            host: source.host,
            url: source.url,
            order: routes.length,
            activelyExplorable: source.activelyExplorable,
            selectable: source.selectable
          })
        );
        this.#handles.set(handle, { representation: rep, url: source.url });
        this.#index(this.#byUrl, source.url, rep);
        if (source.selectable) this.#index(this.#byPath, new URL(source.url).pathname, rep);
        this.#urlChars += source.url.length;
      }
      if (!routes.length) {
        if (replaced) {
          this.#groups.delete(rep);
          this.#byKey.delete(key);
          this.#invalid.delete(rep);
        }
        return null;
      }
      this.#byKey.set(key, rep);
      const identity = !replaced && prior ? prior.identity : Object.freeze({
        generation: input.generation,
        epoch: input.epoch,
        representation: rep,
        kind: input.kind,
        authorityRevision: ++this.#authoritySerial
      });
      this.#groups.set(
        rep,
        Object.freeze({
          identity,
          height: input.height,
          codec: input.codec.slice(0, 48),
          bandwidth: input.bandwidth,
          ...declaredFrameRate(input.frameRate) !== void 0 ? { frameRate: declaredFrameRate(input.frameRate) } : {},
          source: prior?.source === "trusted-api" ? prior.source : input.source,
          routes: Object.freeze(routes)
        })
      );
      return rep;
    }
    source(representation) {
      return this.#groups.get(representation)?.source ?? null;
    }
    isCurrentIdentity(identity) {
      return identity.generation === this.#generation && identity.epoch === this.#epoch && this.#groups.get(identity.representation)?.identity === identity;
    }
    #revokeGroupRoutes(representation, group) {
      for (const route of group.routes) {
        this.#handles.delete(route.handle);
        this.#urlChars -= route.url.length;
      }
      const remove = /* @__PURE__ */ __name((index, counted) => {
        for (const [key, rows] of index) {
          if (!rows.delete(representation)) continue;
          if (!rows.size) {
            index.delete(key);
            if (counted) this.#urlChars -= key.length;
          }
        }
      }, "remove");
      remove(this.#byUrl, false);
      remove(this.#byPath, false);
      remove(this.#aliases, true);
      for (const [url, row] of this.#outputs) {
        if (row?.representation !== representation) continue;
        this.#outputs.delete(url);
        this.#urlChars -= url.length;
      }
    }
    #dropGroup(representation) {
      const group = this.#groups.get(representation);
      if (!group) return;
      this.#revokeGroupRoutes(representation, group);
      this.#groups.delete(representation);
      this.#invalid.delete(representation);
      for (const [key, rep] of this.#byKey) if (rep === representation) this.#byKey.delete(key);
    }
    contextForUrl(url) {
      const match = this.match(url);
      return match.status === "matched" ? match.context : null;
    }
    match(url) {
      const parsed = parseMediaUrl(url);
      if (!parsed || parsed.kind !== "normal" && parsed.kind !== "unknown" && parsed.kind !== "pcdn")
        return { context: null, status: "waiting-data", source: "none" };
      for (const [index, source] of [
        [this.#byUrl, "exact"],
        [this.#aliases, "catalog-alias"],
        [this.#byPath, "path-hint"]
      ]) {
        if ((parsed.kind === "unknown" || parsed.kind === "pcdn") && source !== "exact") continue;
        const reps = index.get(source === "path-hint" ? parsed.url.pathname : parsed.url.href);
        if (!reps?.size) continue;
        if (reps.size !== 1) return { context: null, status: "ambiguous", source };
        const rep = [...reps][0], context = rep ? this.#groups.get(rep)?.identity ?? null : null;
        return {
          context,
          status: source === "path-hint" || parsed.kind === "unknown" ? "weak" : "matched",
          source
        };
      }
      return { context: null, status: "waiting-data", source: "none" };
    }
    registerAlias(rep, url) {
      const parsed = parseMediaUrl(url);
      if (!parsed || parsed.kind !== "normal" || this.#aliases.size >= 1024 || this.#urlChars + url.length > MAX_URL_CHARS)
        return;
      if (!this.#aliases.has(parsed.url.href)) this.#urlChars += parsed.url.href.length;
      this.#index(this.#aliases, parsed.url.href, rep);
      this.#index(this.#byPath, parsed.url.pathname, rep);
    }
    registerOutput(rep, original, primary, backups, decisionId2, source, catalogGenerated = false) {
      const originalHost = parseMediaUrl(original)?.host ?? "";
      for (const [index, url] of [primary, ...backups].entries()) {
        const parsed = parseMediaUrl(url);
        if (!parsed || this.#outputs.size >= 1152 || this.#urlChars + url.length > MAX_URL_CHARS)
          continue;
        const prior = this.#outputs.get(parsed.url.href);
        if (prior === null || prior && prior.representation !== rep) {
          this.#outputs.set(parsed.url.href, null);
          continue;
        }
        if (!this.#outputs.has(parsed.url.href)) this.#urlChars += url.length;
        this.#outputs.set(parsed.url.href, {
          representation: rep,
          role: index === 0 ? "primary" : "backup",
          hostChanged: !!originalHost && originalHost !== parsed.host,
          originalHost,
          outputHost: parsed.host,
          source,
          decisionId: decisionId2,
          catalogGenerated
        });
      }
    }
    outputRole(rep, url) {
      const parsed = parseMediaUrl(url), row = parsed ? this.#outputs.get(parsed.url.href) : null;
      return row?.representation === rep ? {
        role: row.role,
        hostChanged: row.hostChanged,
        originalHost: row.originalHost,
        outputHost: row.outputHost,
        source: row.source,
        decisionId: row.decisionId,
        catalogGenerated: row.catalogGenerated
      } : null;
    }
    wasPlayerOutput(url) {
      const parsed = parseMediaUrl(url);
      return !!parsed && this.#outputs.has(parsed.url.href);
    }
    #index(index, key, rep) {
      const rows = index.get(key) ?? /* @__PURE__ */ new Set();
      rows.add(rep);
      index.set(key, rows);
    }
    candidates(representation, unlockedHosts) {
      const group = this.#groups.get(representation);
      if (!group) return { native: Object.freeze([]), root: null };
      const invalid = this.#invalid.get(representation) ?? /* @__PURE__ */ new Set();
      const native = group.routes.filter(
        (route) => route.selectable && !invalid.has(route.host) && (route.activelyExplorable || unlockedHosts.has(route.host))
      ).map(
        (route) => Object.freeze({
          type: "native-signed",
          host: route.host,
          kind: group.identity.kind,
          catalogIndex: catalogIndex(route.host),
          route: group.identity,
          handle: route.handle,
          activelyExplorable: route.activelyExplorable
        })
      );
      const first = group.routes.find((route) => route.selectable && !invalid.has(route.host));
      const root = first ? Object.freeze({
        type: "root-original",
        host: first.host,
        kind: group.identity.kind,
        catalogIndex: Number.MAX_SAFE_INTEGER,
        route: group.identity,
        handle: first.handle
      }) : null;
      return { native: Object.freeze(native), root };
    }
    identity(representation) {
      return this.#groups.get(representation)?.identity ?? null;
    }
    hosts(representation) {
      return Object.freeze(
        (this.#groups.get(representation)?.routes ?? []).map((route) => route.host)
      );
    }
    invalidate(representation, host) {
      const invalid = this.#invalid.get(representation) ?? /* @__PURE__ */ new Set();
      invalid.add(host.toLowerCase());
      this.#invalid.set(representation, invalid);
    }
    isInvalid(representation, host) {
      return this.#invalid.get(representation)?.has(host) ?? false;
    }
    rootUrl(representation) {
      return this.#groups.get(representation)?.routes[0]?.url ?? null;
    }
    catalogSourceHandle(representation) {
      const routes = this.#groups.get(representation)?.routes ?? [];
      return routes.find((route) => catalogSource(route.url))?.handle ?? null;
    }
    sourceURLs(representation) {
      return Object.freeze((this.#groups.get(representation)?.routes ?? []).map((route) => route.url));
    }
    resolve(handle, identity) {
      if (!this.isCurrentIdentity(identity)) return null;
      const stored = this.#handles.get(handle);
      return stored?.representation === identity.representation ? stored.url : null;
    }
    rangeSize(identity, handle) {
      if (!this.resolve(handle, identity)) return null;
      return this.#handles.get(handle)?.totalBytes ?? null;
    }
    recordRangeSize(identity, handle, totalBytes) {
      if (!this.resolve(handle, identity)) return;
      const stored = this.#handles.get(handle);
      if (!stored) return;
      if (totalBytes === null) delete stored.totalBytes;
      else if (Number.isSafeInteger(totalBytes) && totalBytes > 0) stored.totalBytes = totalBytes;
    }
    startupMediaKind() {
      const groups = [...this.#groups.values()];
      const trusted = groups.filter((group) => group.source === "trusted-api");
      if (trusted.some((group) => group.identity.kind === "video")) return "video";
      if (trusted.some((group) => group.identity.kind === "audio")) return "audio";
      return groups.some((group) => group.identity.kind === "video") ? "video" : null;
    }
    groupSummary(representation) {
      const group = this.#groups.get(representation);
      return group ? Object.freeze({
        kind: group.identity.kind,
        height: group.height,
        codec: group.codec,
        bandwidth: group.bandwidth,
        ...group.frameRate !== void 0 ? { frameRate: group.frameRate } : {},
        routeCount: group.routes.length
      }) : null;
    }
  };

  // src-v2/application/routing/retry-evidence.ts
  var RetryEvidence = class {
    static {
      __name(this, "RetryEvidence");
    }
    #successes = [];
    #suppressed = /* @__PURE__ */ new Map();
    reset() {
      this.#successes = [];
    }
    prune(now) {
      this.#successes = this.#successes.filter((row) => now - row.at <= 6e4 && now >= row.at);
    }
    isSuppressed(id2) {
      return this.#suppressed.has(id2);
    }
    matching(request, host) {
      const successes = this.#successes.filter(
        (row) => !this.#suppressed.has(row.request.requestId) && row.request.targetHost === host && row.request.generation === request.generation && row.request.epoch === request.epoch && row.request.representation === request.representation && row.request.authorityRevision === request.authorityRevision && row.request.routePolicyRevision === request.routePolicyRevision && !!request.timingBasis && row.timingBasis === request.timingBasis
      );
      return [...new Map(successes.map((row) => [row.request.requestId, row])).values()];
    }
    record(request, observation, now) {
      this.#successes = this.#successes.filter(
        (row) => row.request.requestId !== request.requestId && now() - row.at <= 6e4
      );
      this.#successes.push({
        request,
        at: observation.completedAt,
        bytes: observation.retryVerifiedBytes,
        timingBasis: observation.timingBasis,
        mbps: observation.retryVerifiedBytes * 8 / observation.elapsedMs / 1e3,
        payloadMbps: sampleTiming(
          observation.retryVerifiedBytes,
          observation.elapsedMs,
          observation.ttfbMs
        ) ? observation.retryVerifiedBytes * 8 / (observation.elapsedMs - observation.ttfbMs) / 1e3 : null,
        ttfbMs: observation.ttfbMs
      });
      this.#successes = this.#successes.slice(-32);
    }
    suppress(requestIds) {
      const ids = [...new Set(requestIds)];
      if (ids.length > 32 || ids.some((id2) => typeof id2 !== "string" || id2.length < 1 || id2.length > 64) || (/* @__PURE__ */ new Set([...this.#suppressed.keys(), ...ids])).size > 32)
        throw new RangeError("Invalid early retry suppression scope");
      for (const id2 of ids) this.#suppressed.set(id2, (this.#suppressed.get(id2) ?? 0) + 1);
      this.#successes = this.#successes.filter((row) => !this.#suppressed.has(row.request.requestId));
      let released = false;
      return () => {
        if (released) return;
        released = true;
        for (const id2 of ids) {
          const count = this.#suppressed.get(id2) ?? 0;
          if (count > 1) this.#suppressed.set(id2, count - 1);
          else this.#suppressed.delete(id2);
        }
      };
    }
  };

  // src-v2/application/routing/request-ownership.ts
  var RequestOwnership = class {
    static {
      __name(this, "RequestOwnership");
    }
    #dispatchSequence = 0;
    #selectionSerial = 0;
    #owners = /* @__PURE__ */ new WeakMap();
    #preparedVideo = null;
    #selection = null;
    #tentativeRepresentation = null;
    #successes = /* @__PURE__ */ new Set();
    #observed = /* @__PURE__ */ new WeakSet();
    get selection() {
      return this.#selection;
    }
    get tentativeRepresentation() {
      return this.#tentativeRepresentation;
    }
    get sampleCount() {
      return this.#successes.size;
    }
    owner(request) {
      return this.#owners.get(request);
    }
    has(request) {
      return this.#owners.has(request);
    }
    prepare(request, revisionFor) {
      const owned = this.#owners.get(request);
      if (owned) return owned;
      let selectionRevision = 0;
      if (request.kind === "video" && request.representation) {
        const previous = this.#preparedVideo;
        const same = previous?.representation === request.representation && previous.generation === request.generation && previous.epoch === request.epoch && previous.authorityRevision === request.authorityRevision && previous.routePolicyRevision === request.routePolicyRevision;
        selectionRevision = same ? previous.selectionRevision : ++this.#selectionSerial;
      }
      const stamped = Object.freeze({
        ...request,
        dispatchSequence: ++this.#dispatchSequence,
        routeRevision: request.representation ? revisionFor(request.representation) : 0,
        selectionRevision
      });
      this.#owners.set(request, stamped);
      this.#owners.set(stamped, stamped);
      if (request.kind === "video" && request.representation) this.#preparedVideo = stamped;
      return stamped;
    }
    started(request) {
      if (request.kind === "video" && request.representation && this.#selection?.revision !== request.selectionRevision) {
        this.#selection = {
          representation: request.representation,
          revision: request.selectionRevision,
          phase: "pending"
        };
        this.clearSuccesses();
      }
    }
    success(representation, key) {
      if (this.#tentativeRepresentation === representation) this.#successes.add(key);
      else {
        this.#tentativeRepresentation = representation;
        this.#successes = /* @__PURE__ */ new Set([key]);
      }
      return this.#successes.size >= 2;
    }
    confirm(representation) {
      if (this.#selection?.representation === representation) this.#selection.phase = "confirmed";
      this.clearSuccesses();
    }
    clearSuccesses() {
      this.#tentativeRepresentation = null;
      this.#successes.clear();
    }
    forgetRepresentation(representation) {
      if (this.#tentativeRepresentation === representation) this.#tentativeRepresentation = null;
    }
    commitRoute(request, revision2) {
      const owner = this.#owners.get(request);
      if (!owner) return null;
      const committed = Object.freeze({ ...owner, routeRevision: revision2 });
      this.#owners.set(request, committed);
      this.#owners.set(owner, committed);
      return committed;
    }
    beginObservation(observation) {
      const receipt = observation.request ? this.#owners.get(observation.request) ?? observation.request : observation;
      if (this.#observed.has(receipt)) return null;
      this.#observed.add(receipt);
      return receipt;
    }
    reset(reason) {
      this.#preparedVideo = null;
      this.#selection = null;
      this.#successes.clear();
      if (reason === "content") this.#tentativeRepresentation = null;
    }
  };

  // src-v2/application/routing/retry-permit-state.ts
  var RetryPermitState = class {
    static {
      __name(this, "RetryPermitState");
    }
    #current = null;
    get current() {
      return this.#current;
    }
    prepare(permit, request, host, demand) {
      this.#current = { permit, request, host, demand, stage: { phase: "prepared" } };
    }
    applied(record = this.#current) {
      return record?.stage.phase === "materialized" ? record.stage.applied : null;
    }
    materialize(record, applied) {
      if (this.#current === record) this.#current.stage = { phase: "materialized", applied };
      return applied;
    }
    consume(record) {
      if (this.#current !== record) return false;
      this.#current = null;
      return true;
    }
    revoke(permit) {
      if (this.#current?.permit === permit) this.#current = null;
    }
    clear() {
      this.#current = null;
    }
  };

  // src-v2/application/routing/route-projection.ts
  function planSummary(decision) {
    return Object.freeze({
      id: decision.id,
      action: decision.action,
      reason: decision.reason,
      routeType: decision.routeType,
      host: decision.host
    });
  }
  __name(planSummary, "planSummary");
  function rankingSummary(ranking) {
    return Object.freeze(
      ranking.slice(0, 12).map(
        (row) => Object.freeze({
          host: row.candidate.host,
          type: row.candidate.type,
          state: row.state,
          eligible: row.eligible,
          reasons: row.reasons,
          safeMbps: row.safeThroughputMbps,
          ratio: row.demandRatio,
          ttfbMs: row.medianTtfbMs
        })
      )
    );
  }
  __name(rankingSummary, "rankingSummary");
  function capacityNumbers(evidence, metrics, now, budget, requestBytes) {
    const speed2 = metrics.safeThroughputMbps;
    const estimatedCompletionMs = budget ? predictCompletionMs(budget.requestBytes, metrics.safePayloadMbps, metrics.predictionTtfbMs) : null;
    const unavailable = completionReason(
      budget ?? { requestBytes, playableBufferSec: null, sampledAt: now },
      now
    );
    const predictionReason = estimatedCompletionMs !== null ? "available" : unavailable === "available" ? "unknown-body-rate" : unavailable;
    const safeMbps = speed2 !== null && Number.isFinite(speed2) && speed2 > 0 ? speed2 : null;
    const speeds = evidence?.samples.filter(
      (sample) => sample.outcome === "success" && sample.throughputMbps !== null && Number.isFinite(sample.throughputMbps) && sample.throughputMbps > 0
    ) ?? [];
    const sampleStatus = safeMbps !== null ? "available" : speeds.length > 0 && speeds.every((sample) => now - sample.at > EVIDENCE_TTL_MS) ? "expired" : "missing";
    return { estimatedCompletionMs, predictionReason, safeMbps, speeds, sampleStatus };
  }
  __name(capacityNumbers, "capacityNumbers");

  // src-v2/application/routing/circuit-observation.ts
  var CircuitObservations = class {
    static {
      __name(this, "CircuitObservations");
    }
    #active = /* @__PURE__ */ new Map();
    #receipts = /* @__PURE__ */ new WeakMap();
    #proofs = /* @__PURE__ */ new WeakMap();
    #last = null;
    #clockOk = false;
    #playbackActive = true;
    playbackActive(active) {
      this.#playbackActive = active;
      if (!active) this.invalidate("playback-invalidated");
    }
    #close(state, reason) {
      state.epoch++;
      state.period = null;
      state.pending.clear();
      state.committing = false;
      state.reason = reason;
    }
    invalidate(reason) {
      for (const state of this.#active.values()) this.#close(state, reason);
    }
    reset(reason) {
      this.invalidate(reason);
      this.#active.clear();
      this.#last = null;
    }
    step(wall, tick, control) {
      const last = this.#last;
      const invalid = tick === null || !Number.isFinite(wall) || last && (tick < last.tick || wall < last.wall || tick - last.tick > CIRCUIT_SUCCESS_GAP_MS || Math.abs(wall - last.wall - (tick - last.tick)) > CIRCUIT_SUCCESS_GAP_MS);
      this.#last = tick === null ? null : { wall, tick };
      this.#clockOk = !invalid;
      if (invalid) {
        this.invalidate("clock-gap");
        return;
      }
      for (const state of this.#active.values()) {
        const shared = control(state.host, state.kind);
        if (!sameCircuitStamp(state.stamp, shared.stamp)) {
          this.#close(state, "control-changed");
          state.stamp = shared.stamp;
        }
        if (!shared.synchronized) {
          this.#close(state, "no-common-lock");
          continue;
        }
        if (shared.until > wall) {
          this.#close(state, "isolated");
          continue;
        }
        if (state.period) {
          const next = advanceCircuitWindow(state.period, tick);
          if (!next.period) this.#close(state, next.reason);
        }
      }
    }
    capture(receipt, request, shared, tick, wall) {
      if (!request.kind || request.attributionStatus !== "matched" || tick === null || !this.#clockOk || !this.#playbackActive)
        return;
      const kind = request.kind, host = request.targetHost;
      const scope = [
        request.generation,
        request.epoch,
        request.representation,
        request.authorityRevision,
        request.routePolicyRevision,
        request.selectionRevision
      ].join(":");
      let state = this.#active.get(kind);
      if (!state || state.host !== host || state.scope !== scope) {
        if (state) this.#close(state, "route-changed");
        state = {
          request,
          host,
          kind,
          scope,
          epoch: 0,
          stamp: shared.stamp,
          period: null,
          reason: "awaiting-new-transfer",
          certain: true,
          blocked: 0,
          committing: false,
          pending: /* @__PURE__ */ new Map()
        };
        this.#active.set(kind, state);
      }
      state.request = request;
      if (!shared.synchronized || !shared.stamp || shared.level <= 0 || shared.until > wall || state.blocked || !state.certain)
        return;
      if (state.pending.size >= CIRCUIT_PENDING_LIMIT) {
        this.#close(state, "capacity-exceeded");
        return;
      }
      if (state.pending.has(receipt)) return;
      state.pending.set(receipt, tick);
      this.#receipts.set(receipt, { owner: state, epoch: state.epoch, stamp: shared.stamp });
    }
    failure(host, kind) {
      const state = this.#active.get(kind);
      if (!state || state.host !== host) return () => void 0;
      this.#close(state, "failure-pending");
      state.blocked++;
      let released = false;
      return () => {
        if (!released) {
          released = true;
          state.blocked--;
        }
      };
    }
    persisted(host, kind, confirmed) {
      const state = this.#active.get(kind);
      if (!state || state.host !== host) return;
      state.certain = confirmed;
      if (!confirmed) this.#close(state, "storage-unconfirmed");
    }
    finish(receipt, success, certain, shared, tick, nextId) {
      const owned = this.#receipts.get(receipt);
      this.#receipts.delete(receipt);
      if (!owned) return null;
      const state = owned.owner;
      state.pending.delete(receipt);
      if (this.#active.get(state.kind) !== state) return null;
      if (!certain) {
        state.certain = false;
        this.#close(state, "storage-unconfirmed");
        return null;
      }
      state.certain = true;
      if (owned.epoch !== state.epoch) return state.kind;
      if (success && this.#playbackActive && shared && shared.level > 0 && shared.synchronized && tick !== null && sameCircuitStamp(owned.stamp, shared.stamp) && !state.blocked) {
        state.period = state.period ? Object.freeze({ ...state.period, lastSuccess: tick }) : startCircuitWindow(nextId(), shared.stamp, tick);
        state.reason = "observing";
      }
      return state.kind;
    }
    #pending(state) {
      const period = state.period;
      return period ? [...state.pending.values()].filter((at) => at < period.deadline).length : 0;
    }
    proposal(kind, tick) {
      const state = this.#active.get(kind);
      if (!this.#playbackActive || !state || !state.period || state.committing || !state.certain || state.blocked || tick === null || !circuitWindowReady(state.period, tick, this.#pending(state)))
        return null;
      state.committing = true;
      const proof = Object.freeze({
        request: state.request,
        host: state.host,
        kind,
        period: state.period,
        epoch: state.epoch
      });
      this.#proofs.set(proof, state);
      return proof;
    }
    ready(proof, shared, wall, tick) {
      const state = this.#proofs.get(proof);
      if (!state) return false;
      return this.#playbackActive && this.#active.get(state.kind) === state && state.period?.id === proof.period.id && state.epoch === proof.epoch && !state.blocked && state.certain && tick !== null && shared.until <= wall && shared.synchronized && sameCircuitStamp(proof.period.stamp, shared.stamp) && circuitWindowReady(state.period, tick, this.#pending(state));
    }
    submitted(proof, result, tick, nextId) {
      const state = this.#proofs.get(proof);
      this.#proofs.delete(proof);
      if (!state) return;
      if (this.#active.get(state.kind) !== state || state.epoch !== proof.epoch || state.period?.id !== proof.period.id)
        return;
      this.#close(state, result.status === "committed" ? "downgrade-committed" : result.status);
      state.stamp = result.stamp;
      state.certain = result.status !== "unconfirmed";
      if (result.status === "committed" && result.evidence.circuitLevel > 0 && result.stamp && tick !== null)
        state.period = startCircuitWindow(nextId(), result.stamp, tick);
    }
    snapshot(host, kind, shared, wall, tick) {
      const state = this.#active.get(kind), local = state?.host === host ? state : null;
      const period = local?.period && tick !== null && sameCircuitStamp(local.stamp, shared.stamp) ? advanceCircuitWindow(local.period, tick).period : null;
      const phase = shared.until > wall ? "isolated" : shared.level === 0 ? "clear" : period ? tick >= period.deadline ? "settling" : "observing" : "awaiting";
      const reason = !shared.synchronized ? "no-common-lock" : !shared.stamp ? "awaiting-control-version" : period ? local.committing ? "committing" : phase === "settling" ? period.lastSuccess < period.deadline ? "awaiting-end-success" : "awaiting-pending-results" : "observing" : local?.period && tick !== null ? advanceCircuitWindow(local.period, tick).reason ?? "control-changed" : local?.reason ?? "awaiting-new-transfer";
      return Object.freeze({
        host,
        kind,
        level: shared.level,
        until: shared.until,
        phase,
        reason,
        progressSec: period ? Math.min(300, Math.max(0, tick - period.start) / 1e3) : 0,
        remainingSec: phase === "isolated" ? Math.max(0, shared.until - wall) / 1e3 : period ? Math.max(0, (phase === "settling" ? period.hardDeadline : period.deadline) - tick) / 1e3 : null
      });
    }
  };

  // src-v2/domain/route-policy.ts
  var orderedRestrictions = /* @__PURE__ */ __name((facts) => Object.freeze([
    ...facts.black ? ["black"] : [],
    ...facts.dead ? ["dead"] : [],
    ...facts.catalogDisabled ? ["catalog-disabled"] : [],
    ...facts.defaultUnavailable ? ["default-unavailable"] : [],
    ...facts.hostLocked ? ["host-lock"] : [],
    ...facts.circuitOpen ? ["circuit-open"] : []
  ]), "orderedRestrictions");
  var catalogRestrictions = /* @__PURE__ */ __name((overrides) => ({
    disabledCatalogHosts: new Set(TRUSTED_CATALOG.filter((host) => overrides[host] === false)),
    defaultUnavailableHosts: new Set(
      TRUSTED_CATALOG.filter(
        (host) => DEFAULT_UNAVAILABLE_HOSTS.has(host) && overrides[host] !== true
      )
    )
  }), "catalogRestrictions");
  var catalogCandidates = /* @__PURE__ */ __name((kind, excluded = /* @__PURE__ */ new Set()) => TRUSTED_CATALOG.map((host, catalogIndex2) => ({
    type: "catalog-generated",
    host,
    kind,
    catalogIndex: catalogIndex2
  })).filter((candidate) => !excluded.has(candidate.host)), "catalogCandidates");
  function hardRestriction(host, input, now) {
    return orderedRestrictions({
      black: input.blackHosts.has(host),
      dead: input.deadHosts.has(host),
      catalogDisabled: input.overrides[host] === false,
      defaultUnavailable: DEFAULT_UNAVAILABLE_HOSTS.has(host) && input.overrides[host] !== true,
      circuitOpen: input.circuitUntil > now
    })[0] ?? null;
  }
  __name(hardRestriction, "hardRestriction");

  // src-v2/application/routing/request-policy.ts
  function appliedRoute(decision, url, context, streamKey, sourceHost, match, output) {
    return {
      decision,
      url,
      context,
      streamKey,
      sourceHost,
      attributionStatus: match.status,
      attributionSource: match.source,
      playurlHostChanged: output?.hostChanged ?? false,
      ...output ? { playurlOutput: output } : {}
    };
  }
  __name(appliedRoute, "appliedRoute");
  function classifyRequestSource(facts) {
    if (facts.kind === "unknown") return { type: "opaque" };
    if (facts.kind !== "normal") return { type: "unreplaceable", reason: facts.kind };
    return { type: "normal" };
  }
  __name(classifyRequestSource, "classifyRequestSource");
  function catalogRequestEligible(facts) {
    return (facts.kind === "normal" || facts.exactPcdn) && facts.replaceable && (!facts.hasContext || facts.hasSource);
  }
  __name(catalogRequestEligible, "catalogRequestEligible");
  function materializeRoute(original, decision, context, vault, decisionAllowed) {
    if (decision.action === "block") return null;
    if (decision.action === "pass") {
      if (decision.target.type === "request") return original;
      const candidate = decision.target.candidate;
      if (!context || candidate.route !== context || !candidate.handle || !decisionAllowed(decision, context, context.kind))
        return null;
      const exact = vault.resolve(candidate.handle, context);
      if (!exact || parseMediaUrl(exact)?.host !== decision.host) return null;
      return parseMediaUrl(original)?.host === decision.host ? original : exact;
    }
    if (decision.candidate.type === "catalog-generated")
      return replaceUrlHost(original, decision.host);
    return context ? vault.resolve(decision.candidate.handle, context) : null;
  }
  __name(materializeRoute, "materializeRoute");
  function catalogSource2(vault, context, requested) {
    const handle = vault.catalogSourceHandle(context.representation);
    const source = handle ? vault.resolve(handle, context) : null;
    const parsed = source ? parseMediaUrl(source) : null;
    const generated = parsed?.replaceable ? replaceUrlHost(parsed.url.href, TRUSTED_CATALOG[0]) : null;
    if (!generated || parseMediaUrl(generated)?.kind !== "normal") return null;
    const codec = vault.groupSummary(context.representation)?.codec;
    if (requested && codec !== "mp4" && codec !== "flv") {
      const parsedRequested = parseMediaUrl(requested), match = vault.match(requested);
      if (parsedRequested?.kind === "normal" && parsedRequested.replaceable && match.context?.representation === context.representation && (match.source === "exact" || match.source === "catalog-alias"))
        return parsedRequested.url.href;
    }
    return parsed.url.href;
  }
  __name(catalogSource2, "catalogSource");

  // src-v2/domain/routing.ts
  var restrictionReasons = /* @__PURE__ */ __name((candidate, input, now) => {
    const host = candidate.host;
    const evidence = input.evidenceFor(host, candidate.kind);
    return [
      ...orderedRestrictions({
        black: input.restrictions.blackHosts.has(host),
        dead: input.restrictions.deadHosts.has(host),
        catalogDisabled: input.restrictions.disabledCatalogHosts.has(host),
        defaultUnavailable: input.restrictions.defaultUnavailableHosts.has(host),
        hostLocked: input.restrictions.hostLocked.has(host),
        circuitOpen: !!(evidence && evidence.circuitUntil > now) || input.failedHost === host && ["verified-failure", "watchdog"].includes(input.boundary)
      })
    ];
  }, "restrictionReasons");
  var assessDemandRatio = /* @__PURE__ */ __name((ratio) => ratio === null || !Number.isFinite(ratio) ? "unknown" : ratio < ROUTE_HEADROOM ? "below-required" : "meets-headroom", "assessDemandRatio");
  var rankRoutes = /* @__PURE__ */ __name((input, now) => {
    const entries = input.candidates.map((candidate, candidateOrder) => {
      const reasons2 = restrictionReasons(candidate, input, now);
      const metrics = evidenceMetrics(
        input.evidenceFor(candidate.host, candidate.kind),
        now,
        input.completionBudget?.timingBasis
      );
      return Object.freeze({
        candidate,
        candidateOrder,
        state: reasons2.length ? "forbidden" : metrics.state,
        eligible: reasons2.length === 0,
        reasons: Object.freeze(reasons2),
        safeThroughputMbps: metrics.safeThroughputMbps,
        demandRatio: metrics.safeThroughputMbps === null ? null : metrics.safeThroughputMbps / Math.max(1e-3, input.demand.requiredMbps),
        medianTtfbMs: metrics.medianTtfbMs,
        successCount: metrics.successCount,
        failureCount: metrics.failureCount,
        capacityConfidence: metrics.capacityConfidence,
        freshSpeedCount: metrics.freshSpeedCount,
        newestSpeedAt: metrics.newestSpeedAt,
        safePayloadMbps: metrics.safePayloadMbps,
        predictionTtfbMs: metrics.predictionTtfbMs
      });
    });
    const ranked = orderCapacityRows(entries, input.completionBudget, now);
    return Object.freeze(
      [...ranked].sort((a, b) => {
        if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
        const fixedA = input.fixedHost === a.candidate.host, fixedB = input.fixedHost === b.candidate.host;
        return Number(fixedB) - Number(fixedA);
      })
    );
  }, "rankRoutes");
  function retainedRoute(input, ranking) {
    if (!input.current || ["verified-failure", "watchdog", "user-setting", "new-epoch"].includes(input.boundary))
      return;
    const current = ranking.find((row) => row.eligible && row.candidate.host === input.current.host);
    const fixed = ranking.find((row) => row.eligible && row.candidate.host === input.fixedHost);
    if (!current || fixed && fixed.candidate.host !== current.candidate.host) return;
    if (recentCapacity(current) && (current.demandRatio ?? 0) < ROUTE_HEADROOM && ranking.some(
      (row) => row.eligible && row.candidate.host !== current.candidate.host && adequateCapacity(row)
    ))
      return;
    return current;
  }
  __name(retainedRoute, "retainedRoute");
  var chooseRoute = /* @__PURE__ */ __name((input, clock, id2, rows) => {
    const ranking = rows ?? rankRoutes(input, clock.now());
    const fixed = ranking.find((row) => row.eligible && row.candidate.host === input.fixedHost);
    const retained = retainedRoute(input, ranking);
    const selected = fixed ?? retained ?? ranking.find((row) => row.eligible);
    if (!selected) {
      const first = ranking[0];
      return {
        action: "block",
        id: id2,
        reason: first?.reasons[0] ?? "invalid-url",
        routeType: first?.candidate.type ?? "root-original",
        host: first?.candidate.host ?? null,
        ranking
      };
    }
    const candidate = selected.candidate;
    const reason = fixed ? "fixed" : retained ? adequateCapacity(retained) ? "healthy-affinity" : "retained-unverified" : selected.capacityConfidence === "sufficient" ? "proven" : selected.capacityConfidence === "provisional" ? "recent-success" : selected.capacityConfidence === "historical" ? "historical-estimate" : selected.capacityConfidence === "revalidation" ? "revalidation-fallback" : "unverified-fallback";
    if (candidate.type === "root-original")
      return {
        action: "pass",
        target: { type: "selected-original", candidate },
        id: id2,
        reason,
        routeType: "root-original",
        host: candidate.host,
        ranking
      };
    return {
      action: "rewrite",
      id: id2,
      reason,
      routeType: candidate.type,
      host: candidate.host,
      candidate,
      ranking
    };
  }, "chooseRoute");

  // src-v2/domain/startup-policy.ts
  function startupTransition(stage, event) {
    if (!["available", "reserved", "probing"].includes(stage))
      return { next: stage, effects: [], reason: "terminal" };
    if (event === "cancel" && stage !== "available")
      return { next: "cancelled", effects: ["seal-window"], reason: "accepted" };
    if (stage === "available" && event === "reserve")
      return { next: "reserved", effects: ["reserve-window"], reason: "accepted" };
    if (stage === "reserved" && event === "probe")
      return { next: "probing", effects: ["probe-window"], reason: "accepted" };
    if (stage === "probing" && ["adequate", "insufficient", "unverified", "exhausted"].includes(event))
      return {
        next: event,
        effects: event === "exhausted" ? ["seal-window"] : ["commit-selection", "seal-window"],
        reason: "accepted"
      };
    return { next: stage, effects: [], reason: "illegal-event" };
  }
  __name(startupTransition, "startupTransition");
  function startupCapacityPool(rows) {
    const ranked = [...rows].sort(
      (a, b) => capacityPriority(a) - capacityPriority(b) || (b.safeThroughputMbps ?? -1) - (a.safeThroughputMbps ?? -1) || a.candidateOrder - b.candidateOrder
    );
    const exploration = ranked.some(adequateCapacity) ? [...ranked].filter((row) => !recentCapacity(row)).sort((a, b) => {
      const priority = /* @__PURE__ */ __name((row) => row.revalidationRequired ? 0 : row.capacityConfidence === "missing" ? 1 : 2, "priority");
      return priority(a) - priority(b) || a.candidateOrder - b.candidateOrder;
    })[0] ?? null : null;
    return { ranked, exploration };
  }
  __name(startupCapacityPool, "startupCapacityPool");
  function startupSelection(ranked, exploration) {
    const selected = exploration ? [...ranked.filter((row) => row !== exploration).slice(0, 2), exploration] : ranked.slice(0, 3);
    return ranked.filter((row) => selected.includes(row));
  }
  __name(startupSelection, "startupSelection");

  // src-v2/application/routing/candidate-planning.ts
  function* startupCandidates(input) {
    const { clock, evidence, policy, context, parsed, source, catalogCursor } = input;
    const candidates = [];
    const limit = Math.min(TRUSTED_CATALOG.length + 2, Math.max(1, input.limit ?? 3));
    const add = /* @__PURE__ */ __name((host, type, candidateUrl, original) => {
      if (candidates.length >= limit || candidates.some((candidate) => candidate.host === host) || policy.hardRestriction(host, context.kind) || policy.vault.isInvalid(context.representation, host))
        return null;
      const checked = parseMediaUrl(candidateUrl);
      if (!checked || checked.kind !== "normal" || checked.host !== host) return null;
      const key = mediaIdentity(candidateUrl);
      if (key && policy.incompatible(candidateUrl, host)) return null;
      const prior = evidence.get(host, context.kind);
      const metrics = evidenceMetrics(prior, clock.now());
      const cachedSafeMbps = type === "catalog-generated" && recentCapacity(metrics) ? metrics.safeThroughputMbps : null;
      return { host, type, url: candidateUrl, original, cachedSafeMbps, context };
    }, "add");
    if (!policy.isCatalogOnly()) {
      const original = add(parsed.host, "root-original", parsed.url.href, true);
      if (original) {
        yield original;
        candidates.push(original);
      }
      const native = policy.vault.candidates(
        context.representation,
        policy.unlockedNative(context.representation)
      ).native;
      for (const route of native) {
        const exact = policy.vault.resolve(route.handle, context);
        if (exact && route.host !== parsed.host) {
          const candidate = add(route.host, "native-signed", exact, false);
          if (candidate) {
            yield candidate;
            candidates.push(candidate);
            break;
          }
        }
      }
    }
    const catalog = TRUSTED_CATALOG.filter((host) => !policy.hardRestriction(host, context.kind));
    for (let offset = 0; offset < catalog.length && candidates.length < limit; offset++) {
      const host = catalog[(catalogCursor + offset) % catalog.length];
      if (!host) continue;
      const generated = replaceUrlHost(source, host);
      if (!generated) continue;
      const candidate = add(host, "catalog-generated", generated, false);
      if (candidate) {
        yield candidate;
        candidates.push(candidate);
      }
    }
  }
  __name(startupCandidates, "startupCandidates");
  function selectionCandidates(context, root, routes, vault, catalogOnly, incompatible) {
    const catalog = catalogCandidates(context.kind).filter(
      (candidate) => !vault.isInvalid(context.representation, candidate.host) && !incompatible(root, candidate.host)
    );
    return catalogOnly() ? catalog : [...routes.root ? [routes.root] : [], ...routes.native, ...catalog];
  }
  __name(selectionCandidates, "selectionCandidates");
  function challengerCandidates(kind, native, preferNative, catalogCursor) {
    const catalog = catalogCandidates(kind);
    const rotated = [
      ...catalog.slice(catalogCursor % catalog.length),
      ...catalog.slice(0, catalogCursor % catalog.length)
    ];
    return preferNative ? [...native, ...rotated] : [...rotated, ...native];
  }
  __name(challengerCandidates, "challengerCandidates");

  // src-v2/application/routing/route-restrictions.ts
  function restrictionSnapshot(restrictions, kind) {
    if (kind) return restrictions.snapshot(kind);
    const video = restrictions.snapshot("video"), audio = restrictions.snapshot("audio");
    return {
      blackHosts: /* @__PURE__ */ new Set([...video.blackHosts, ...audio.blackHosts]),
      deadHosts: /* @__PURE__ */ new Set([...video.deadHosts, ...audio.deadHosts])
    };
  }
  __name(restrictionSnapshot, "restrictionSnapshot");
  function restrictedHost(input, host, kind) {
    const settings = input.settings.get(), restriction = restrictionSnapshot(input.restrictions, kind), evidence = kind ? input.evidence.get(host, kind) : null;
    return hardRestriction(
      host,
      {
        ...restriction,
        overrides: settings.catalogOverrides,
        circuitUntil: evidence?.circuitUntil ?? 0
      },
      input.clock.now()
    );
  }
  __name(restrictedHost, "restrictedHost");
  function canUseDecision(policy, decision, context, kind) {
    if (decision.action === "block" || !decision.host || policy.hardRestriction(decision.host, kind))
      return false;
    const source = context && policy.isCatalogOnly() ? policy.catalogSource(context) : null;
    if (policy.isCatalogOnly())
      return decision.action === "rewrite" && decision.candidate.type === "catalog-generated" && isCatalogHost(decision.host) && (!context || !!source && !policy.incompatible(source, decision.host));
    if (decision.action === "pass") {
      if (context && policy.vault.isInvalid(context.representation, decision.host)) return false;
      if (decision.target.type === "request") return true;
      const candidate2 = decision.target.candidate;
      return !!context && candidate2.route === context && !!candidate2.handle && parseMediaUrl(policy.vault.resolve(candidate2.handle, context) ?? "")?.host === decision.host;
    }
    const candidate = decision.candidate;
    if (candidate.type === "catalog-generated")
      return !context || !policy.incompatible(policy.vault.rootUrl(context.representation) ?? "", decision.host);
    if (!context) return false;
    return policy.vault.candidates(context.representation, policy.unlockedNative(context.representation)).native.some((route) => route.handle === candidate.handle && route.host === decision.host);
  }
  __name(canUseDecision, "canUseDecision");

  // src-v2/domain/player-output-plan.ts
  var CATALOG_FAMILIES = Object.freeze({
    "cn-hk-eq-01-03.bilivideo.com": "hk-eq-01",
    "cn-hk-eq-01-05.bilivideo.com": "hk-eq-01",
    "cn-hk-eq-01-01.bilivideo.com": "hk-eq-01",
    "upos-sz-mirroraliov.bilivideo.com": "ali",
    "upos-sz-mirrorali.bilivideo.com": "ali",
    "upos-sz-mirroralib.bilivideo.com": "ali",
    "upos-sz-mirrorali02.bilivideo.com": "ali",
    "upos-hz-mirroraliov.bilivideo.com": "ali",
    "upos-sz-mirrorcosov.bilivideo.com": "cos",
    "upos-sz-mirrorcos.bilivideo.com": "cos",
    "upos-sz-mirrorhwov.bilivideo.com": "hw",
    "upos-sz-mirrorhw.bilivideo.com": "hw",
    "upos-sz-mirrorbos.bilivideo.com": "bos",
    "upos-tf-all-tx.bilivideo.com": "tx"
  });
  function catalogHostFamily(host) {
    const normalized = host.toLowerCase();
    return isCatalogHost(normalized) && Object.hasOwn(CATALOG_FAMILIES, normalized) ? CATALOG_FAMILIES[normalized] : null;
  }
  __name(catalogHostFamily, "catalogHostFamily");
  function measuredBackupOrder(primaryHost, candidates) {
    const sufficient = candidates.filter((candidate) => candidate.meetsHeadroom === true);
    const used = /* @__PURE__ */ new Set();
    const primaryFamily = primaryHost ? catalogHostFamily(primaryHost) : null;
    if (primaryFamily) used.add(primaryFamily);
    const selected = [];
    while (sufficient.length) {
      const diverse = sufficient.findIndex((candidate2) => {
        const family2 = catalogHostFamily(candidate2.host);
        return family2 !== null && !used.has(family2);
      });
      const candidate = sufficient.splice(diverse < 0 ? 0 : diverse, 1)[0];
      selected.push(candidate);
      const family = catalogHostFamily(candidate.host);
      if (family) used.add(family);
    }
    return [...selected, ...candidates.filter((candidate) => candidate.meetsHeadroom !== true)];
  }
  __name(measuredBackupOrder, "measuredBackupOrder");
  function backupOutputPlan(primaryHost, candidates, locked) {
    if (locked) return [];
    const used = new Set(primaryHost ? [primaryHost] : []), distinct = [], same = [];
    for (const candidate of candidates) {
      if (!candidate.allowed || !candidate.host) continue;
      if (used.has(candidate.host)) same.push(candidate.index);
      else {
        used.add(candidate.host);
        distinct.push(candidate);
      }
    }
    return [
      ...measuredBackupOrder(primaryHost, distinct).map((candidate) => candidate.index),
      ...same
    ].slice(0, 5);
  }
  __name(backupOutputPlan, "backupOutputPlan");
  function catalogOutputPlan(primaryHost, preferred, unavailable, measuredSufficient = /* @__PURE__ */ new Set()) {
    const candidates = [.../* @__PURE__ */ new Set([...preferred, ...TRUSTED_CATALOG])].filter((host) => isCatalogHost(host) && host !== primaryHost && !unavailable.has(host)).map((host) => ({ host, meetsHeadroom: measuredSufficient.has(host) }));
    return measuredBackupOrder(primaryHost, candidates).map((candidate) => candidate.host).slice(0, 5);
  }
  __name(catalogOutputPlan, "catalogOutputPlan");

  // src-v2/application/routing/player-output.ts
  function measuredSufficientHosts(decision) {
    return new Set(
      decision.ranking.filter(
        (row) => row.eligible && row.successCount > 0 && adequateCapacity(row) && Number.isFinite(row.safeThroughputMbps) && (row.safeThroughputMbps ?? 0) > 0 && Number.isFinite(row.demandRatio) && (row.demandRatio ?? 0) >= 1
      ).map((row) => row.candidate.host)
    );
  }
  __name(measuredSufficientHosts, "measuredSufficientHosts");
  function outputAllowed(policy, representation, context, url) {
    const parsed = parseMediaUrl(url);
    const match = parsed?.kind === "unknown" ? policy.vault.match(url) : null;
    const exactOpaque = match?.source === "exact" && match.context?.representation === representation;
    return !!parsed && (parsed.kind === "normal" || exactOpaque) && !policy.hardRestriction(parsed.host, context.kind) && !policy.vault.isInvalid(representation, parsed.host);
  }
  __name(outputAllowed, "outputAllowed");
  function opaquePlayerOutput(policy, representation, context, originals) {
    const permitted = [...new Set(originals)].filter((url) => {
      const parsed = parseMediaUrl(url), match = policy.vault.match(url);
      return !!parsed && match.source === "exact" && match.context?.representation === representation && !policy.hardRestriction(parsed.host, context.kind) && !policy.vault.isInvalid(representation, parsed.host);
    });
    return { primary: permitted[0] ?? "", backups: permitted.slice(1, 6) };
  }
  __name(opaquePlayerOutput, "opaquePlayerOutput");
  function catalogPlayerOutput(sourceUrl, decision, allowed, incompatible) {
    if (!sourceUrl || decision.action !== "rewrite" || decision.candidate.type !== "catalog-generated" || !isCatalogHost(decision.host))
      return null;
    const primary = replaceUrlHost(sourceUrl, decision.host);
    if (!primary || !allowed(primary) || incompatible(sourceUrl, decision.host)) return null;
    const preferred = decision.ranking.filter((row) => row.eligible && row.candidate.type === "catalog-generated").map((row) => row.candidate.host);
    const unavailable = new Set(
      TRUSTED_CATALOG.filter(
        (host) => incompatible(sourceUrl, host) || !allowed(replaceUrlHost(sourceUrl, host) ?? "")
      )
    );
    const backups = catalogOutputPlan(
      decision.host,
      preferred,
      unavailable,
      measuredSufficientHosts(decision)
    ).flatMap((host) => {
      const url = replaceUrlHost(sourceUrl, host);
      return url ? [url] : [];
    });
    return { primary, backups };
  }
  __name(catalogPlayerOutput, "catalogPlayerOutput");
  function normalPlayerOutput(representation, original, decision, originals, stream, policy, allowed, hostLocked, materialize) {
    const lockedOriginal = stream && hostLocked(stream) ? policy.vault.rootUrl(representation) : null;
    const primary = lockedOriginal && allowed(lockedOriginal) ? lockedOriginal : materialize();
    if (!primary || !allowed(primary)) return null;
    const locked = mediaIdentity(original);
    const generated = locked && hostLocked(locked) ? [] : decision.ranking.filter(
      (row) => row.eligible && row.candidate.type === "catalog-generated" && !policy.incompatible(original, row.candidate.host)
    ).flatMap((row) => {
      const url = replaceUrlHost(original, row.candidate.host);
      return url && allowed(url) ? [url] : [];
    });
    const primaryHost = parseMediaUrl(primary)?.host;
    const urls = [.../* @__PURE__ */ new Set([...originals, ...generated])].filter((url) => url !== primary);
    const sufficient = measuredSufficientHosts(decision);
    const candidates = urls.map((url, index) => {
      const host = parseMediaUrl(url)?.host ?? "";
      return { index, host, allowed: allowed(url), meetsHeadroom: sufficient.has(host) };
    });
    const backups = backupOutputPlan(primaryHost ?? null, candidates, !!lockedOriginal).map(
      (index) => urls[index]
    );
    return { primary, backups };
  }
  __name(normalPlayerOutput, "normalPlayerOutput");

  // src-v2/application/routing/transport-result.ts
  function catalogObservationAllowed(catalogOnly, observation) {
    return !catalogOnly || observation.routeType === "catalog-generated" && isCatalogHost(observation.targetHost) && (observation.finalHost === observation.targetHost || observation.finalHost === null && observation.outcome === "failure");
  }
  __name(catalogObservationAllowed, "catalogObservationAllowed");
  function transportSnapshot(observation) {
    const request = observation.request;
    return Object.freeze({
      ...request ?? {},
      kind: observation.kind,
      routeType: observation.routeType,
      originalHost: observation.originalHost,
      targetHost: observation.targetHost,
      responseHost: observation.finalHost,
      outcome: observation.outcome,
      status: observation.status,
      observedAt: observation.completedAt,
      attributionStatus: request?.attributionStatus ?? (observation.representation ? "matched" : "waiting-data")
    });
  }
  __name(transportSnapshot, "transportSnapshot");
  function circuitCreditEligible(observation, sample) {
    return observation.circuitVerified !== false && sample.bytes !== void 0 && sample.bytes >= 65536 && sample.elapsedMs !== void 0 && Number.isFinite(sample.throughputMbps) && (sample.throughputMbps ?? 0) > 0;
  }
  __name(circuitCreditEligible, "circuitCreditEligible");
  function retryTransportEligible(request, observation) {
    return Number.isSafeInteger(observation.retryVerifiedBytes) && (observation.retryVerifiedBytes ?? 0) >= 64 * 1024 && request.generation === observation.generation && request.epoch === observation.epoch && request.representation === observation.representation && request.kind === observation.kind && request.targetHost === observation.targetHost && observation.kind === "video" && observation.routeType === "catalog-generated" && observation.status === 206 && observation.responseUrlMatchesRequest === true && observation.finalHost === observation.targetHost && observation.bytes >= 64 * 1024 && observation.elapsedMs > 0 && observation.ttfbMs !== null && Number.isFinite(observation.ttfbMs) && observation.ttfbMs >= 0;
  }
  __name(retryTransportEligible, "retryTransportEligible");
  function classifyTransportResult(observation) {
    if (observation.outcome === "abort") return { type: "ignore" };
    const evidenceHost = observation.finalHost ?? observation.targetHost;
    if (!evidenceHost) return { type: "ignore" };
    if (observation.status === 403 && observation.streamKey && observation.routeType === "catalog-generated")
      return { type: "catalog-forbidden" };
    const request = observation.request;
    if (observation.routeType === "catalog-generated" && observation.streamKey && [404, 410].includes(observation.status))
      return { type: "catalog-resource-missing" };
    if (observation.status >= 400 && observation.status < 500 && !(observation.failureKind === "native-invalid" && observation.representation))
      return { type: "request-rejected" };
    if (!observation.kind || request && request.attributionStatus !== "matched")
      return { type: "ignore" };
    const requestId2 = request?.requestId ?? `${Number(observation.generation)}:${Number(observation.epoch)}:${observation.completedAt}:${observation.targetHost}`;
    if (observation.outcome === "success") {
      if (!observation.finalHost) return { type: "ignore" };
      return {
        type: "success",
        host: observation.finalHost,
        kind: observation.kind,
        sample: {
          ...observation.timingBasis ? { timingBasis: observation.timingBasis } : {},
          requestId: requestId2,
          at: observation.completedAt,
          source: "transport",
          outcome: "success",
          throughputMbps: observation.speedEligible !== false && observation.bytes >= 64 * 1024 && observation.elapsedMs > 0 ? observation.bytes * 8 / observation.elapsedMs / 1e3 : null,
          ttfbMs: observation.ttfbMs,
          failureKind: null,
          ...sampleTiming(observation.bytes, observation.elapsedMs, observation.ttfbMs) ?? {}
        }
      };
    }
    const failureKind = observation.failureKind;
    if (failureKind === "native-invalid" && observation.representation)
      return { type: "native-invalid", host: evidenceHost, kind: observation.kind };
    if (!failureKind || !["network", "body", "timeout", "http-5xx"].includes(failureKind))
      return { type: "ignore" };
    return {
      type: "failure",
      host: evidenceHost,
      kind: observation.kind,
      sample: {
        requestId: requestId2,
        at: observation.completedAt,
        source: "transport",
        outcome: "failure",
        throughputMbps: null,
        ttfbMs: observation.ttfbMs,
        failureKind
      }
    };
  }
  __name(classifyTransportResult, "classifyTransportResult");

  // src-v2/application/routing/route-coordinator.ts
  var RouteCoordinator = class {
    constructor(clock, session, settings, restrictions, evidence, vault, ids) {
      this.clock = clock;
      this.session = session;
      this.settings = settings;
      this.restrictions = restrictions;
      this.evidence = evidence;
      this.vault = vault;
      this.ids = ids;
    }
    clock;
    session;
    settings;
    restrictions;
    evidence;
    vault;
    ids;
    static {
      __name(this, "RouteCoordinator");
    }
    #circuits = new CircuitObservations();
    #ownership = new RequestOwnership();
    #policyRevision = 0;
    #routeSerial = 0;
    #planRevisions = /* @__PURE__ */ new Map();
    #measurementIds = /* @__PURE__ */ new WeakMap();
    #serial = 0;
    #recoverySerial = 0;
    #decisions = /* @__PURE__ */ new Map();
    #plans = /* @__PURE__ */ new Map();
    #planIdentities = /* @__PURE__ */ new Map();
    #requestedRepresentations = /* @__PURE__ */ new Set();
    #unlockedNative = /* @__PURE__ */ new Map();
    #listeners = /* @__PURE__ */ new Set();
    #hostLockedStreams = /* @__PURE__ */ new Set();
    #startupIncompatible = /* @__PURE__ */ new Map();
    #streamPlans = /* @__PURE__ */ new Map();
    #latest = /* @__PURE__ */ new Map();
    #requested = /* @__PURE__ */ new Map();
    #playbackFacts = null;
    #effectiveRate = 2;
    #challengeAttempts = /* @__PURE__ */ new Map();
    #challengeProposals = /* @__PURE__ */ new WeakMap();
    #firstMediaAt = 0;
    #firstVideoAt = 0;
    #lastVideoEvidence = null;
    #startupExhausted = /* @__PURE__ */ new Set();
    #pendingMedia = /* @__PURE__ */ new Set();
    #fallbacks = /* @__PURE__ */ new Map();
    #retryEvidence = new RetryEvidence();
    #retryPermits = new RetryPermitState();
    subscribe(listener) {
      this.#listeners.add(listener);
      return () => this.#listeners.delete(listener);
    }
    resetEpoch() {
      this.#circuits.reset("content-changed");
      this.#retryEvidence.reset();
      this.#retryPermits.clear();
      this.#policyRevision++;
      this.#plans.clear();
      this.#planRevisions.clear();
      this.#ownership.reset("content");
      this.#planIdentities.clear();
      this.#unlockedNative.clear();
      this.#decisions.clear();
      this.#hostLockedStreams.clear();
      this.#startupIncompatible.clear();
      this.#requestedRepresentations.clear();
      this.#streamPlans.clear();
      this.#latest.clear();
      this.#requested.clear();
      this.#playbackFacts = null;
      this.#effectiveRate = 2;
      this.#challengeAttempts.clear();
      this.#firstMediaAt = 0;
      this.#firstVideoAt = 0;
      this.#lastVideoEvidence = null;
      this.#startupExhausted.clear();
      this.#pendingMedia.clear();
      this.#fallbacks.clear();
    }
    invalidateForUserSetting() {
      this.#circuits.invalidate("policy-changed");
      this.#playbackFacts = null;
      this.#startupExhausted.clear();
      this.#retryPermits.clear();
      this.#policyRevision++;
      this.#plans.clear();
      this.#planRevisions.clear();
      this.#ownership.reset("policy");
      this.#planIdentities.clear();
      this.#streamPlans.clear();
      this.#fallbacks.clear();
      this.session.setAffinity(null);
    }
    policyRevision() {
      return this.#policyRevision;
    }
    isCatalogOnly() {
      return !this.settings.get().considerNativeSources;
    }
    prepareRequest(request) {
      return this.#ownership.prepare(
        request,
        (representation) => this.#planRevisions.get(representation) ?? 0
      );
    }
    #controlCurrent(observation) {
      const request = observation.request;
      const owned = request ? this.#ownership.owner(request) : null;
      const representation = observation.representation;
      const plan = representation ? this.#plans.get(representation) : null;
      const host = plan?.host ?? observation.targetHost;
      const forbidden = host ? this.#hardRestriction(host, observation.kind) : null;
      if (forbidden && forbidden !== "circuit-open" || representation && host && this.vault.isInvalid(representation, host))
        return false;
      if (!representation && observation.streamKey) {
        const streamPlan = this.#streamPlans.get(observation.streamKey);
        return !!streamPlan && streamPlan.id === (owned?.decisionId ?? observation.decisionId);
      }
      if (owned) {
        if (!representation || owned.routeRevision !== this.#planRevisions.get(representation) || plan?.id !== owned.decisionId)
          return false;
        return observation.kind !== "video" || this.#ownership.selection?.representation === representation && this.#ownership.selection.revision === owned.selectionRevision;
      }
      if (observation.kind && this.#requested.has(observation.kind)) return false;
      return !!plan && plan.id === observation.decisionId;
    }
    requestStarted(request) {
      const stamped = this.prepareRequest(request);
      const state = this.session.get();
      if (stamped.generation !== state.generation || stamped.epoch !== state.epoch || stamped.routePolicyRevision !== this.#policyRevision)
        return;
      const current = this.#requested.get(stamped.kind ?? "unknown");
      if ((current?.dispatchSequence ?? -1) > stamped.dispatchSequence) return;
      this.#ownership.started(stamped);
      if (request.kind && !this.#firstMediaAt) this.#firstMediaAt = request.startedAt;
      if (request.kind === "video" && !this.#firstVideoAt) this.#firstVideoAt = request.startedAt;
      if (request.kind) this.#pendingMedia.add(request.requestId);
      const key = request.kind ?? "unknown";
      this.#requested.set(key, stamped);
      this.#stepCircuits();
      if (stamped.kind)
        this.#circuits.capture(
          stamped,
          stamped,
          this.evidence.control(stamped.targetHost, stamped.kind),
          this.#circuitTick(),
          this.clock.now()
        );
      if (request.kind && request.representation) {
        const fallback = this.#fallbacks.get(request.kind);
        if (fallback?.representation === request.representation && fallback.decisionId === request.decisionId && fallback.plannedHost === request.targetHost && fallback.stage === "planned" && request.generation === this.session.get().generation && request.epoch === this.session.get().epoch) {
          this.#fallbacks.set(request.kind, {
            ...fallback,
            stage: "entered-hook",
            requestId: request.requestId
          });
        }
      }
      this.#emit({ type: "request-started", at: request.startedAt, request });
      this.#emit({
        type: "attribution-changed",
        at: request.startedAt,
        requestId: request.requestId,
        status: request.attributionStatus,
        kind: request.kind
      });
    }
    earlyRetryRequestCurrent(request) {
      const settings = this.settings.get(), state = this.session.get();
      const owned = this.#ownership.owner(request);
      const plan = request.representation ? this.#plans.get(request.representation) : null;
      const preparedRetry = this.#retryPermits.applied()?.decision.id === request.decisionId;
      const currentOwner = !owned || this.#ownership.selection?.representation === request.representation && this.#ownership.selection.revision === owned.selectionRevision && (preparedRetry || plan?.id === request.decisionId && owned.routeRevision === this.#planRevisions.get(request.representation));
      return currentOwner && settings.earlyRetryEnabled && !settings.disabled && !state.disabled && !settings.fixedHost && (!this.#ownership.selection || this.#ownership.selection.phase === "confirmed") && request.kind === "video" && request.routeType === "catalog-generated" && request.attributionStatus === "matched" && request.generation === state.generation && request.epoch === state.epoch && request.routePolicyRevision === this.#policyRevision && !!request.representation && state.representation === request.representation && request.authorityRevision === this.vault.identity(request.representation)?.authorityRevision;
    }
    earlyRetryAlternatives(request, demand) {
      const context = this.#earlyRetryContext(request, demand);
      if (!context) return Object.freeze([]);
      const alternatives = [];
      for (const host of TRUSTED_CATALOG) {
        const alternative = this.#earlyRetryAlternativeForHost(request, demand, host, context);
        if (alternative) alternatives.push(alternative);
      }
      return this.earlyRetryRequestCurrent(request) ? Object.freeze(alternatives) : Object.freeze([]);
    }
    #earlyRetryContext(request, demand) {
      if (!this.earlyRetryRequestCurrent(request) || demand.kind !== "video" || !Number.isFinite(demand.requiredMbps) || demand.requiredMbps <= 0)
        return null;
      const now = this.clock.now();
      this.#retryEvidence.prune(now);
      const identity = this.vault.identity(request.representation);
      if (!identity) return null;
      const source = this.#catalogSource(identity);
      if (!source) return null;
      return { identity, source };
    }
    #earlyRetryAlternativeForHost(request, demand, host, context = this.#earlyRetryContext(request, demand)) {
      if (!context || !isCatalogHost(host) || host === request.targetHost || this.#hardRestriction(host, "video") || this.#incompatible(context.source, host) || this.vault.isInvalid(context.identity.representation, host))
        return null;
      const unique = this.#retryEvidence.matching(request, host);
      if (unique.length < 2) return null;
      const safeMbps = Math.min(...unique.map((row) => row.mbps));
      if (safeMbps < demand.requiredMbps * EARLY_RETRY_HEADROOM) return null;
      const safePayloadMbps = unique.every((row) => row.payloadMbps !== null) ? Math.min(...unique.map((row) => row.payloadMbps)) : null;
      if (safePayloadMbps === null || !this.earlyRetryRequestCurrent(request)) return null;
      return Object.freeze({
        host,
        safeMbps,
        safePayloadMbps,
        ttfbMs: Math.max(...unique.map((row) => row.ttfbMs)),
        successCount: unique.length,
        oldestAt: Math.min(...unique.map((row) => row.at))
      });
    }
    prepareEarlyRetry(request, host, demand) {
      if (this.#retryPermits.current && this.#retryPermits.current.permit.expiresAt > this.clock.now())
        return null;
      if (!this.#earlyRetryAlternativeForHost(request, demand, host)) return null;
      const permit = Object.freeze({
        id: this.ids.next("request"),
        expiresAt: this.clock.now() + 2e3
      });
      this.#retryPermits.prepare(permit, request, host, demand);
      return permit;
    }
    suppressEarlyRetryEvidence(requestIds) {
      return this.#retryEvidence.suppress(requestIds);
    }
    revokeEarlyRetry(permit) {
      this.#retryPermits.revoke(permit);
    }
    applyEarlyRetry(url, permit) {
      const pending = this.#retryPermits.current;
      if (!pending || pending.permit !== permit || this.clock.now() >= permit.expiresAt || !this.earlyRetryRequestCurrent(pending.request))
        return null;
      const matched = this.vault.match(url);
      if (!matched.context || !["exact", "catalog-alias"].includes(matched.source) || matched.context.representation !== pending.request.representation || matched.context.authorityRevision !== pending.request.authorityRevision)
        return null;
      if (!this.#earlyRetryAlternativeForHost(pending.request, pending.demand, pending.host))
        return null;
      const candidate = {
        type: "catalog-generated",
        host: pending.host,
        kind: "video",
        catalogIndex: TRUSTED_CATALOG.indexOf(pending.host)
      };
      const decision = this.#retryPermits.applied(pending)?.decision ?? {
        action: "rewrite",
        id: this.#nextId(),
        reason: "early-retry",
        routeType: "catalog-generated",
        host: pending.host,
        candidate,
        ranking: Object.freeze([])
      };
      const output = this.#materialize(url, decision, matched.context);
      if (!output) return null;
      this.#remember(decision, matched.context, "video");
      return this.#retryPermits.materialize(pending, {
        decision,
        url: output,
        context: matched.context,
        streamKey: mediaIdentity(url),
        sourceHost: parseMediaUrl(url)?.host ?? null
      });
    }
    acceptEarlyRetry(permit, request) {
      const pending = this.#retryPermits.current;
      if (!pending || pending.permit !== permit || !this.#retryPermits.applied(pending) || this.clock.now() >= permit.expiresAt || !this.earlyRetryRequestCurrent(pending.request) || !this.earlyRetryRequestCurrent(request) || request.targetHost !== pending.host || request.decisionId !== this.#retryPermits.applied(pending).decision.id || this.latestRequested("video")?.requestId !== request.requestId)
        return false;
      const decision = this.#retryPermits.applied(pending).decision;
      if (!this.#decisionAllowed(decision, this.#retryPermits.applied(pending).context, "video"))
        return false;
      if (!this.#retryPermits.consume(pending)) return false;
      this.#savePlan(request.representation, decision);
      if (this.#ownership.has(request)) {
        const committed = this.#ownership.commitRoute(
          request,
          this.#planRevisions.get(request.representation)
        );
        this.#requested.set("video", committed);
      }
      this.session.setAffinity({
        type: "catalog-generated",
        host: pending.host,
        confirmedAt: this.clock.now(),
        decisionId: decision.id,
        representation: request.representation
      });
      this.#emit({ type: "route-decision", at: this.clock.now(), decision });
      return true;
    }
    #demandFor(representation, kind) {
      return controlPlaybackDemand(
        kind,
        representation ? this.vault.groupSummary(representation)?.bandwidth : null,
        this.#effectiveRate
      );
    }
    observePlaybackRate(rate) {
      const next = Number.isFinite(rate) && rate > 0 ? rate : 2;
      if (next !== this.#effectiveRate) this.#circuits.invalidate("rate-changed");
      this.#effectiveRate = next;
    }
    playbackRate() {
      return this.#effectiveRate;
    }
    firstMediaAt(kind) {
      return kind === "video" ? this.#firstVideoAt : this.#firstMediaAt;
    }
    pendingMediaCount() {
      return this.#pendingMedia.size;
    }
    latestRequested(kind) {
      return this.#requested.get(kind) ?? null;
    }
    recoveryEligible(request) {
      const state = this.session.get(), settings = this.settings.get();
      if (settings.disabled || request.routePolicyRevision !== this.#policyRevision || request.generation !== state.generation || request.epoch !== state.epoch || !request.representation)
        return false;
      const identity = this.vault.identity(request.representation), decision = this.#plans.get(request.representation);
      return !!identity && identity.kind === "video" && identity.authorityRevision === request.authorityRevision && this.vault.isCurrentIdentity(identity) && !!decision && this.#planIdentities.get(request.representation) === identity && this.#decisionAllowed(decision, identity, "video");
    }
    recognizesMedia(url) {
      const parsed = parseMediaUrl(url);
      if (!parsed) return this.isCatalogOnly() && this.isBilibiliMedia(url);
      const match = this.vault.match(url);
      const media = parsed.kind !== "unknown" || match.source === "exact";
      return media && (!this.isCatalogOnly() || this.isBilibiliMedia(url));
    }
    isBilibiliMedia(url) {
      const source = this.vault.match(url).source;
      if (source === "exact" || source === "catalog-alias" || this.vault.wasPlayerOutput(url))
        return true;
      const parsed = parseMediaUrl(url);
      if (!parsed) return isOversizedBilibiliMedia(url);
      if (parsed.kind === "unknown") return false;
      const host = parsed.host;
      const bilivideo = /\.bilivideo\.(?:com|cn|net)$/.test(host);
      const akamai = host.startsWith("upos-") && host.endsWith(".akamaized.net");
      const knownPcdn = parsed.kind === "pcdn" && (isKnownPcdnHost(host) || parsed.url.pathname.includes("/upgcxcode/"));
      return bilivideo || akamai || knownPcdn;
    }
    inspectOriginal(url) {
      return this.#inspectOriginal(url, parseMediaUrl(url));
    }
    #inspectOriginal(url, parsed) {
      const match = this.vault.match(url);
      const context = match.context;
      if (!parsed && this.isCatalogOnly() && this.isBilibiliMedia(url)) {
        return {
          decision: this.#block("catalog-only-non-get", null),
          url: null,
          context,
          streamKey: null,
          sourceHost: null
        };
      }
      if (!parsed)
        return {
          decision: this.#pass("invalid-url", null, "video"),
          url,
          context: null,
          streamKey: null,
          sourceHost: null
        };
      if (this.isCatalogOnly() && this.isBilibiliMedia(url)) {
        return {
          decision: this.#block("catalog-only-non-get", parsed.host),
          url: null,
          context,
          streamKey: mediaIdentity(url),
          sourceHost: parsed.host
        };
      }
      const restriction = this.#hardRestriction(parsed.host, context?.kind ?? null);
      const decision = restriction ? this.#block(restriction, parsed.host) : this.#pass("non-get-original", parsed.host, context?.kind ?? "video");
      return {
        decision,
        url: restriction ? null : url,
        context,
        streamKey: mediaIdentity(url),
        sourceHost: parsed.host,
        attributionStatus: context ? "weak" : match.status,
        attributionSource: match.source
      };
    }
    startupOptions(url, catalogCursor = 0, requestBytes = null) {
      const pool = this.#startupPool(url, catalogCursor);
      if (!pool) return null;
      const candidates = startupSelection(pool.candidates, pool.exploration);
      for (const candidate of candidates) this.#measurementId(candidate, "startup");
      return { ...pool, candidates, requestBytes };
    }
    #playbackRevision = 0;
    #playbackObservation = 0;
    observePlaybackFacts(facts, revision2) {
      this.#stepCircuits();
      const observation = ++this.#playbackObservation;
      this.#playbackFacts = null;
      if (revision2 !== void 0 && Number.isSafeInteger(revision2) && revision2 >= this.#playbackRevision)
        this.#playbackRevision = revision2;
      if (!facts) {
        this.#circuits.playbackActive(false);
        return;
      }
      const tick = readMonotonic(() => this.clock.monotonicNow?.() ?? null), state = this.session.get(), requested = this.#requested.get("video");
      const identity = facts.representation ? this.vault.identity(facts.representation) : null;
      if (!identity || state.disabled || this.settings.get().disabled || !requested || facts.generation !== state.generation || facts.epoch !== state.epoch || facts.representation !== state.representation || facts.routePolicyRevision !== this.#policyRevision || facts.authorityRevision !== identity.authorityRevision || facts.selectionRevision === void 0 || facts.selectionRevision !== requested.selectionRevision || facts.representation !== requested.representation || !Number.isFinite(facts.playableBufferSec) || facts.playableBufferSec < 0 || !Number.isFinite(facts.sampledAt) || tick === null || !Number.isFinite(facts.sampledTick) || facts.sampledTick < 0 || tick < facts.sampledTick || tick - facts.sampledTick > 2e3 || !Number.isFinite(facts.playbackRate) || facts.playbackRate <= 0 || !Number.isFinite(facts.bufferAheadSec) || facts.bufferAheadSec < 0 || !Number.isSafeInteger(facts.playbackRevision) || facts.playbackRevision < this.#playbackRevision || observation !== this.#playbackObservation)
        return;
      this.#circuits.playbackActive(true);
      this.#playbackFacts = Object.freeze({
        generation: facts.generation,
        epoch: facts.epoch,
        representation: facts.representation,
        authorityRevision: facts.authorityRevision,
        routePolicyRevision: facts.routePolicyRevision,
        selectionRevision: facts.selectionRevision,
        sampledAt: facts.sampledAt,
        playableBufferSec: facts.playableBufferSec,
        sampledTick: facts.sampledTick,
        playbackRate: facts.playbackRate,
        bufferAheadSec: facts.bufferAheadSec,
        playbackRevision: facts.playbackRevision
      });
      this.#playbackRevision = facts.playbackRevision;
    }
    completionBudget(representation, requestBytes, timingBasis2) {
      const facts = this.#playbackFacts, revision2 = this.#policyRevision;
      if (!facts || !Number.isSafeInteger(requestBytes) || (requestBytes ?? 0) <= 0) return null;
      const current = /* @__PURE__ */ __name(() => {
        const state = this.session.get(), identity = this.vault.identity(representation), requested = this.#requested.get("video"), tick2 = readMonotonic(() => this.clock.monotonicNow?.() ?? null);
        return !state.disabled && !this.settings.get().disabled && this.#policyRevision === revision2 && this.#playbackFacts === facts && facts.generation === state.generation && facts.epoch === state.epoch && facts.representation === representation && state.representation === representation && facts.routePolicyRevision === revision2 && facts.authorityRevision === identity?.authorityRevision && facts.selectionRevision === requested?.selectionRevision && requested?.representation === representation && tick2 !== null && tick2 >= facts.sampledTick && tick2 - facts.sampledTick <= 2e3 && facts.playbackRevision === this.#playbackRevision;
      }, "current");
      if (!current()) return null;
      const tick = readMonotonic(() => this.clock.monotonicNow?.() ?? null);
      if (tick === null) return null;
      const ageMs = tick - facts.sampledTick;
      if (ageMs < 0 || ageMs > 2e3) return null;
      const result = Object.freeze({
        requestBytes,
        ...timingBasis2 ? { timingBasis: timingBasis2 } : {},
        playableBufferSec: Math.max(0, facts.bufferAheadSec / facts.playbackRate - ageMs / 1e3),
        sampledAt: facts.sampledAt,
        ageMs
      });
      return current() ? result : null;
    }
    startupFallback(url, excludedHosts) {
      return this.#startupPool(url, 0)?.candidates.find(
        (candidate) => !excludedHosts.has(candidate.host)
      ) ?? null;
    }
    #startupPool(url, catalogCursor = 0) {
      const parsed = parseMediaUrl(url), match = this.vault.match(url);
      const context = match.status === "matched" || match.source === "exact" ? match.context : null;
      const source = context && this.isCatalogOnly() ? this.#catalogSource(context, url) : url;
      const parsedSource = source ? parseMediaUrl(source) : null;
      if (!parsed || !source || !parsedSource || !parsedSource.replaceable || !this.isCatalogOnly() && parsedSource.kind !== "normal" || !context || this.settings.get().fixedHost || this.session.get().disabled)
        return null;
      const demand = this.#demandFor(context.representation, context.kind);
      if (context.kind === "audio" && this.vault.startupMediaKind() !== "audio")
        return { candidates: [], demand, originalHost: parsedSource.host, deferredToVideo: true };
      const candidates = [];
      for (const candidate of startupCandidates({
        clock: this.clock,
        evidence: this.evidence,
        policy: this.#policyReader(),
        context,
        parsed,
        source,
        catalogCursor,
        limit: TRUSTED_CATALOG.length + 2
      }))
        candidates.push(candidate);
      const now = this.clock.now();
      const ranked = candidates.map((candidate, index) => {
        const metrics = evidenceMetrics(this.evidence.get(candidate.host, context.kind), now);
        return {
          candidate,
          candidateOrder: index,
          ...metrics,
          demandRatio: metrics.safeThroughputMbps === null ? null : metrics.safeThroughputMbps / demand.requiredMbps
        };
      });
      const pool = startupCapacityPool(ranked);
      return {
        candidates: pool.ranked.map((row) => row.candidate),
        exploration: pool.exploration?.candidate ?? null,
        demand,
        originalHost: parsedSource.host
      };
    }
    /** Read-only preview: selecting a result never commits a sample or route. */
    startupDemand(candidate) {
      const revision2 = this.#policyRevision;
      if (!this.#startupCandidateCurrent(candidate, revision2)) return null;
      const demand = this.#demandFor(candidate.context.representation, candidate.context.kind);
      return this.#startupCandidateCurrent(candidate, revision2) ? demand : null;
    }
    #startupCandidateCurrent(candidate, revision2) {
      return !this.session.get().disabled && !this.settings.get().disabled && candidate.context.generation === this.session.get().generation && candidate.context.epoch === this.session.get().epoch && this.vault.isCurrentIdentity(candidate.context) && (!this.isCatalogOnly() || candidate.type === "catalog-generated") && !this.#hardRestriction(candidate.host, candidate.context.kind) && !this.vault.isInvalid(candidate.context.representation, candidate.host) && this.#policyRevision === revision2;
    }
    startupCapacity(candidate, sample) {
      const revision2 = this.#policyRevision;
      const current = /* @__PURE__ */ __name(() => this.#startupCandidateCurrent(candidate, revision2), "current");
      if (!current()) return null;
      const prior = this.evidence.get(candidate.host, candidate.context.kind);
      const metrics = evidenceMetrics(
        sample ? addEvidenceSample(
          prior ?? emptyEvidence(candidate.host, candidate.context.kind),
          sample,
          this.clock.now()
        ) : prior,
        this.clock.now(),
        "probe-reader"
      );
      return current() ? metrics : null;
    }
    noteStartupProbeResult(candidate, status) {
      if (status !== 403 || candidate.type !== "catalog-generated") return;
      const context = candidate.context, current = this.session.get();
      if (context.generation !== current.generation || context.epoch !== current.epoch || !this.vault.isCurrentIdentity(context))
        return;
      this.#markIncompatible(candidate.url, candidate.host);
    }
    commitStartupChoice(url, selected, reason) {
      if (this.session.get().disabled || this.settings.get().disabled) return null;
      if (!selected) {
        const context2 = this.vault.match(url).context;
        if (reason === "startup-exhausted" && context2 && this.vault.isCurrentIdentity(context2)) {
          this.#startupExhausted.add(context2.representation);
          this.#plans.delete(context2.representation);
          this.#planIdentities.delete(context2.representation);
        }
        return null;
      }
      if (this.isCatalogOnly() && selected.type !== "catalog-generated") return null;
      const fixedHost = this.settings.get().fixedHost;
      if (fixedHost && (selected.type !== "catalog-generated" || selected.host !== fixedHost))
        return null;
      const match = this.vault.match(url);
      const context = match.status === "matched" || match.source === "exact" ? match.context : null;
      if (!context || context !== selected.context || this.#hardRestriction(selected.host, context.kind) || this.vault.isInvalid(context.representation, selected.host) || this.#startupIncompatible.get(mediaIdentity(selected.url) ?? "")?.has(selected.host))
        return null;
      this.#startupExhausted.delete(context.representation);
      const source = this.isCatalogOnly() ? this.#catalogSource(context, url) : url;
      if (!source) return null;
      let decision;
      if (selected.original) {
        const candidates = this.vault.candidates(
          context.representation,
          this.#unlockedNative.get(context.representation) ?? /* @__PURE__ */ new Set()
        );
        const candidate = [candidates.root, ...candidates.native].find(
          (route) => route?.handle && route.host === selected.host && this.vault.resolve(route.handle, context) === selected.url
        );
        if (!candidate?.handle) return null;
        decision = {
          action: "pass",
          target: { type: "selected-original", candidate: { ...candidate, type: "root-original" } },
          id: this.#nextId(),
          reason,
          routeType: "root-original",
          host: selected.host,
          ranking: []
        };
      } else if (selected.type === "catalog-generated") {
        const catalogIndex2 = TRUSTED_CATALOG.indexOf(
          selected.host
        );
        if (catalogIndex2 < 0 || replaceUrlHost(source, selected.host) !== selected.url || parseMediaUrl(selected.url)?.kind !== "normal")
          return null;
        const candidate = {
          type: "catalog-generated",
          host: selected.host,
          kind: context.kind,
          catalogIndex: catalogIndex2
        };
        decision = {
          action: "rewrite",
          id: this.#nextId(),
          reason,
          routeType: "catalog-generated",
          host: selected.host,
          candidate,
          ranking: []
        };
      } else {
        const native = this.vault.candidates(
          context.representation,
          this.#unlockedNative.get(context.representation) ?? /* @__PURE__ */ new Set()
        ).native.find(
          (candidate) => candidate.host === selected.host && this.vault.resolve(candidate.handle, context) === selected.url
        );
        if (!native) return null;
        decision = {
          action: "rewrite",
          id: this.#nextId(),
          reason,
          routeType: "native-signed",
          host: selected.host,
          candidate: native,
          ranking: []
        };
      }
      this.#savePlan(context.representation, decision);
      this.session.noteDecision(decision.id);
      this.#remember(decision, context, context.kind);
      this.#emit({ type: "route-planned", at: this.clock.now(), decision });
      return decision;
    }
    async recordStartupSuccess(candidate, bytes, elapsedMs, ttfbMs, workCurrent = () => true, measurement) {
      if (bytes < 64 * 1024 || elapsedMs <= 0 || measurement?.speedEligible === false) return;
      if (this.isCatalogOnly() && candidate.type !== "catalog-generated") return;
      const context = candidate.context;
      const valid = /* @__PURE__ */ __name(() => workCurrent() && context.generation === this.session.get().generation && context.epoch === this.session.get().epoch && !this.session.get().disabled && this.vault.isCurrentIdentity(context) && (!this.isCatalogOnly() || candidate.type === "catalog-generated"), "valid");
      if (!valid()) return;
      await this.evidence.record(
        candidate.host,
        context.kind,
        {
          requestId: this.#measurementId(candidate, "startup"),
          ...measurement?.timingBasis ? { timingBasis: measurement.timingBasis } : {},
          at: this.clock.now(),
          source: "challenge",
          outcome: "success",
          throughputMbps: bytes * 8 / elapsedMs / 1e3,
          ttfbMs,
          failureKind: null,
          ...sampleTiming(bytes, elapsedMs, ttfbMs) ?? {}
        },
        valid
      );
      if (context.kind === "video" && valid() && this.#plans.get(context.representation)?.host === candidate.host)
        this.#lastVideoEvidence = {
          host: candidate.host,
          requestId: this.#measurementId(candidate, "startup"),
          identity: context,
          source: "current-probe"
        };
    }
    unlockNative(representation, host) {
      const hosts = this.#unlockedNative.get(representation) ?? /* @__PURE__ */ new Set();
      hosts.add(host);
      this.#unlockedNative.set(representation, hosts);
    }
    plan(representation, demand, boundary, failedHost = null, requestBytes = null, timingBasis2) {
      const context = this.vault.identity(representation);
      if (!context) return this.#pass("missing-representation", null, demand.kind);
      const previous = this.#currentPlan(representation);
      const decision = this.#choose(
        context,
        demand,
        boundary,
        failedHost,
        void 0,
        previous,
        requestBytes,
        timingBasis2
      );
      this.#savePlan(representation, decision);
      return decision;
    }
    recover(representation, demand, boundary, failedHost, requestBytes = null, timingBasis2) {
      const decision = this.plan(
        representation,
        demand,
        boundary,
        failedHost,
        requestBytes,
        timingBasis2
      );
      if (decision.action !== "block" && decision.host && decision.host !== failedHost)
        this.#trackFallback(representation, demand.kind, decision);
      else {
        this.#fallbacks.delete(demand.kind);
        this.#emit({
          type: "recovery",
          at: this.clock.now(),
          action: {
            action: "none",
            id: recoveryActionId(`recovery-${++this.#recoverySerial}`),
            reason: "no-legal-different-route"
          }
        });
      }
      return decision;
    }
    recoverStartup(representation, demand, failedHost, preferredHosts) {
      const context = this.vault.identity(representation);
      const root = context && this.isCatalogOnly() ? this.#catalogSource(context) : this.vault.rootUrl(representation);
      if (!root || !failedHost || demand.kind !== "video") return null;
      const options = this.#startupPool(root);
      if (!options) return null;
      const alternatives = options.candidates.filter((candidate) => candidate.host !== failedHost);
      const locked = mediaIdentity(root) && this.#hostLockedStreams.has(mediaIdentity(root));
      const preferred = preferredHosts.map((host) => alternatives.find((candidate) => candidate.host === host)).find((candidate) => candidate !== void 0);
      const selected = locked ? alternatives.find((candidate) => candidate.original) ?? preferred ?? alternatives[0] : preferred ?? alternatives[0];
      if (!selected) return null;
      const decision = this.commitStartupChoice(root, selected, "startup-stall-fallback");
      if (decision && decision.host !== failedHost)
        this.#trackFallback(representation, "video", decision);
      return decision && decision.host !== failedHost ? decision : null;
    }
    apply(url, kindHint = null, demand, trustedPlayurl = false, requestBytes = null, timingBasis2) {
      const parsed = parseMediaUrl(url);
      const startupContext = this.vault.match(url).context;
      if (parsed && startupContext && this.#startupExhausted.has(startupContext.representation)) {
        if (this.isCatalogOnly())
          return appliedRoute(
            this.#block("catalog-unavailable", parsed.host),
            null,
            startupContext,
            mediaIdentity(url),
            parsed.host,
            this.vault.match(url),
            null
          );
        const original = this.inspectOriginal(url);
        return original.url && original.decision.action === "pass" ? {
          ...original,
          decision: { ...original.decision, reason: "startup-exhausted-site-owned" }
        } : original;
      }
      if (!parsed && this.isCatalogOnly() && (trustedPlayurl || this.isBilibiliMedia(url))) {
        return {
          decision: this.#block("catalog-unreplaceable", null),
          url: null,
          context: null,
          streamKey: null,
          sourceHost: null
        };
      }
      if (!parsed)
        return {
          decision: this.#pass("invalid-url", null, kindHint ?? "video"),
          url,
          context: null,
          streamKey: null,
          sourceHost: null
        };
      if (this.isCatalogOnly() && (trustedPlayurl || this.isBilibiliMedia(url))) {
        return this.#applyCatalogOnly(url, parsed, kindHint, demand, requestBytes, timingBasis2);
      }
      const streamKey = mediaIdentity(url);
      const source = classifyRequestSource({ kind: parsed.kind });
      if (source.type === "opaque") return this.#applyOpaque(url, parsed, kindHint, streamKey);
      if (source.type === "unreplaceable")
        return this.#applyUnreplaceable(url, parsed, kindHint, streamKey, source.reason);
      return this.#applyNormal(url, parsed, kindHint, streamKey, demand, requestBytes, timingBasis2);
    }
    #applyOpaque(url, parsed, kindHint, streamKey) {
      const match = this.vault.match(url), context = match.source === "exact" ? match.context : null;
      const restriction = this.#hardRestriction(parsed.host, context?.kind ?? kindHint);
      const decision = restriction ? this.#block(restriction, parsed.host) : this.#pass(
        "opaque-media-observation-only",
        parsed.host,
        context?.kind ?? kindHint ?? "video"
      );
      const outputRole = context ? this.vault.outputRole(context.representation, url) : null;
      return appliedRoute(
        decision,
        restriction ? null : url,
        context,
        streamKey,
        parsed.host,
        match,
        outputRole
      );
    }
    #applyUnreplaceable(url, parsed, kindHint, streamKey, reason) {
      const restriction = this.#hardRestriction(parsed.host, kindHint);
      if (restriction)
        return {
          decision: this.#block(restriction, parsed.host),
          url: null,
          context: null,
          streamKey,
          sourceHost: parsed.host
        };
      return {
        decision: this.#pass(reason, parsed.host, kindHint ?? "video"),
        url,
        context: null,
        streamKey,
        sourceHost: parsed.host
      };
    }
    #applyNormal(url, parsed, kindHint, streamKey, demand, requestBytes = null, timingBasis2) {
      const match = this.vault.match(url);
      const context = match.status === "matched" ? match.context : null;
      const kind = context?.kind ?? kindHint ?? null;
      if (streamKey && this.#hostLockedStreams.has(streamKey))
        return this.#applyHostLocked(url, parsed, context, streamKey, kind, demand);
      const playbackDemand = demand ?? this.#demandFor(context?.representation ?? null, kind ?? "video");
      let decision = context ? this.#currentPlan(context.representation) : streamKey ? this.#streamPlans.get(streamKey) : null;
      const outputRole = context ? this.vault.outputRole(context.representation, url) : null;
      if (context?.kind === "video" && !this.#requestedRepresentations.has(context.representation) && this.session.get().affinity && outputRole?.role !== "backup" && !this.settings.get().fixedHost) {
        decision = this.#choose(context, playbackDemand, "representation", null);
      }
      if (context && outputRole?.role === "backup" && (!decision || outputRole.decisionId === decision.id) && decision?.host !== parsed.host && !this.settings.get().fixedHost && !this.#hardRestriction(parsed.host, kind)) {
        const catalogIndex2 = TRUSTED_CATALOG.indexOf(parsed.host);
        const native = this.vault.candidates(
          context.representation,
          this.#unlockedNative.get(context.representation) ?? /* @__PURE__ */ new Set()
        ).native.find(
          (candidate2) => candidate2.host === parsed.host && this.vault.resolve(candidate2.handle, context) === parsed.url.href
        );
        const candidate = catalogIndex2 >= 0 ? {
          type: "catalog-generated",
          host: parsed.host,
          kind: context.kind,
          catalogIndex: catalogIndex2
        } : native;
        if (candidate) {
          decision = this.#planPlayerFallback(candidate);
        }
      }
      if (context && decision && decision.action !== "block" && this.#decisionAllowed(decision, context, kind)) {
        decision = this.#choose(
          context,
          playbackDemand,
          "request",
          null,
          url,
          decision,
          requestBytes,
          timingBasis2
        );
      }
      if (!decision || decision.action === "block" || !this.#decisionAllowed(decision, context, kind)) {
        if (context)
          decision = this.#choose(
            context,
            playbackDemand,
            "request",
            null,
            url,
            void 0,
            requestBytes,
            timingBasis2
          );
        else if (!this.settings.get().fixedHost && !this.#hardRestriction(parsed.host, kind)) {
          decision = this.#pass("unattributed-original-no-preflight", parsed.host, kind ?? "video");
        } else decision = this.#catalogOnly(playbackDemand, parsed.host, kind);
      }
      let applied = this.#materialize(url, decision, context);
      if (decision.action === "rewrite" && decision.candidate.type === "catalog-generated" && applied === null) {
        const restriction = this.#hardRestriction(parsed.host, kind);
        decision = restriction ? this.#block(restriction, parsed.host) : this.#pass("catalog-host-not-replaceable", parsed.host, kind ?? "video");
        applied = restriction ? null : url;
      }
      const finalHost = applied === url ? parsed.host : applied ? parseMediaUrl(applied)?.host : null;
      const finalRestriction = finalHost ? this.#hardRestriction(finalHost, kind) : null;
      if (finalHost && finalRestriction) {
        decision = this.#block(finalRestriction, finalHost);
        applied = null;
      }
      this.#saveAppliedPlan(decision, context, streamKey, kind ?? "video");
      const sourceHost = context ? parseMediaUrl(this.vault.rootUrl(context.representation) ?? url)?.host ?? parsed.host : parsed.host;
      if (applied && context) this.vault.registerAlias(context.representation, applied);
      return appliedRoute(decision, applied, context, streamKey, sourceHost, match, outputRole);
    }
    #applyHostLocked(url, parsed, context, streamKey, kind, demand) {
      const original = context ? this.vault.rootUrl(context.representation) ?? url : url;
      const originalHost = parseMediaUrl(original)?.host ?? parsed.host;
      const hard = this.#hardRestriction(originalHost, kind);
      if (hard && context) {
        const fallback = this.#choose(
          context,
          demand ?? this.#demandFor(context.representation, context.kind),
          "watchdog",
          originalHost
        );
        const safe = this.#materialize(original, fallback, context);
        const target = safe ? parseMediaUrl(safe)?.host : null;
        if (safe && target && target !== originalHost && !this.#hardRestriction(target, context.kind)) {
          this.#savePlan(context.representation, fallback);
          return { decision: fallback, url: safe, context, streamKey, sourceHost: originalHost };
        }
      }
      const decision = hard ? this.#block(hard, originalHost) : this.#pass("host-locked", originalHost, kind ?? "video");
      this.#remember(decision, context, kind ?? "video");
      return { decision, url: hard ? null : original, context, streamKey, sourceHost: originalHost };
    }
    #applyCatalogOnly(url, parsed, kindHint, demand, requestBytes = null, timingBasis2) {
      const match = this.vault.match(url), context = match.status === "matched" ? match.context : null;
      const root = context ? this.#catalogSource(context, url) : null;
      const sourceHost = parseMediaUrl(root ?? url)?.host ?? parsed.host;
      const streamKey = mediaIdentity(url);
      const outputRole = context ? this.vault.outputRole(context.representation, url) : null;
      const blocked = /* @__PURE__ */ __name((reason) => appliedRoute(
        this.#block(reason, parsed.host),
        null,
        context,
        streamKey,
        sourceHost,
        match,
        outputRole
      ), "blocked");
      const exactPcdn = parsed.kind === "pcdn" && match.source === "exact" && !!context;
      if (!catalogRequestEligible({
        kind: parsed.kind,
        replaceable: parsed.replaceable,
        exactPcdn,
        hasContext: !!context,
        hasSource: !!root
      })) {
        return blocked("catalog-unreplaceable");
      }
      const kind = context?.kind ?? kindHint;
      const playbackDemand = demand ?? this.#demandFor(context?.representation ?? null, kind ?? "video");
      let decision = context ? this.#currentPlan(context.representation) : streamKey ? this.#streamPlans.get(streamKey) : null;
      if (context?.kind === "video" && !this.#requestedRepresentations.has(context.representation) && this.session.get().affinity && outputRole?.role !== "backup" && !this.settings.get().fixedHost) {
        decision = this.#choose(context, playbackDemand, "representation", null, url);
      }
      if (context && outputRole?.role === "backup" && (!decision || outputRole.decisionId === decision.id) && outputRole.catalogGenerated && isCatalogHost(parsed.host) && !this.settings.get().fixedHost && !this.#hardRestriction(parsed.host, kind) && !this.#incompatible(url, parsed.host)) {
        const candidate = {
          type: "catalog-generated",
          host: parsed.host,
          kind: context.kind,
          catalogIndex: TRUSTED_CATALOG.indexOf(parsed.host)
        };
        decision = this.#planPlayerFallback(candidate);
      }
      const allowed = /* @__PURE__ */ __name((candidate) => !!candidate && candidate.action === "rewrite" && candidate.candidate.type === "catalog-generated" && isCatalogHost(candidate.host) && !this.#hardRestriction(candidate.host, kind) && !this.#incompatible(url, candidate.host) && (!context || !this.vault.isInvalid(context.representation, candidate.host)), "allowed");
      if (context && allowed(decision))
        decision = this.#choose(
          context,
          playbackDemand,
          "request",
          null,
          url,
          decision,
          requestBytes,
          timingBasis2
        );
      if (!allowed(decision)) {
        decision = context ? this.#choose(
          context,
          playbackDemand,
          "request",
          null,
          url,
          void 0,
          requestBytes,
          timingBasis2
        ) : this.#catalogOnly(playbackDemand, parsed.host, kind, url);
      }
      if (!decision || decision.action !== "rewrite" || !allowed(decision)) {
        return blocked("catalog-unavailable");
      }
      const target = replaceUrlHost(url, decision.host);
      const parsedTarget = target ? parseMediaUrl(target) : null;
      if (!target || parsedTarget?.kind !== "normal" || parsedTarget?.host !== decision.host || this.#hardRestriction(decision.host, kind) || this.#incompatible(url, decision.host))
        return blocked("catalog-unavailable");
      this.#saveAppliedPlan(decision, context, streamKey, kind ?? "video");
      if (context) this.vault.registerAlias(context.representation, target);
      return appliedRoute(decision, target, context, streamKey, sourceHost, match, outputRole);
    }
    decisionRecord(id2) {
      return id2 ? this.#decisions.get(id2) ?? null : null;
    }
    opaqueOutput(representation, original, originals, source) {
      const context = this.vault.identity(representation);
      if (!context) return { primary: "", backups: [] };
      if (this.isCatalogOnly()) return { primary: "", backups: [] };
      const { primary, backups } = opaquePlayerOutput(
        this.#policyReader(),
        representation,
        context,
        originals
      );
      if (primary) {
        const host = parseMediaUrl(primary).host;
        const decision = this.#pass(
          primary === original ? "opaque-original" : "opaque-original-backup",
          host,
          context.kind
        );
        this.#remember(decision, context, context.kind);
        this.#emit({ type: "route-planned", at: this.clock.now(), decision });
        this.vault.registerOutput(representation, original, primary, backups, decision.id, source);
      }
      return { primary, backups };
    }
    playerOutput(representation, original, decision, originals, source = "trusted-api", recordOutput = true) {
      const context = this.vault.identity(representation);
      if (!context) return { primary: "", backups: [] };
      const policy = this.#policyReader();
      const allowed = /* @__PURE__ */ __name((url) => outputAllowed(policy, representation, context, url), "allowed");
      const stream = mediaIdentity(original);
      if (this.isCatalogOnly()) {
        const sourceUrl = this.#catalogSource(context, original);
        const output2 = catalogPlayerOutput(
          sourceUrl,
          decision,
          allowed,
          (url, host) => this.#incompatible(url, host)
        );
        if (!output2 || !sourceUrl) return { primary: "", backups: [] };
        const { primary: primary2, backups: backups2 } = output2;
        this.vault.registerAlias(representation, primary2);
        for (const backup of backups2) this.vault.registerAlias(representation, backup);
        if (recordOutput)
          this.vault.registerOutput(
            representation,
            sourceUrl,
            primary2,
            backups2,
            decision.id,
            source,
            true
          );
        return { primary: primary2, backups: Object.freeze(backups2) };
      }
      const output = normalPlayerOutput(
        representation,
        original,
        decision,
        originals,
        stream,
        policy,
        allowed,
        (key) => this.#hostLockedStreams.has(key),
        () => this.#materialize(original, decision, context)
      );
      if (!output) return { primary: "", backups: [] };
      const { primary, backups } = output;
      this.vault.registerAlias(representation, primary);
      for (const url of backups) this.vault.registerAlias(representation, url);
      this.vault.registerOutput(representation, original, primary, backups, decision.id, source);
      return this.isBilibiliMedia(primary) ? { primary, backups: backups.filter((url) => this.isBilibiliMedia(url)) } : { primary: "", backups: [] };
    }
    challenge(representation, demand, preferNative, excludedHosts = /* @__PURE__ */ new Set(), catalogCursor = 0) {
      const proposal = this.proposeChallenge(
        representation,
        demand,
        preferNative,
        excludedHosts,
        catalogCursor
      );
      return proposal ? this.commitChallenge(proposal) : null;
    }
    proposeChallenge(representation, _demand, preferNative, excludedHosts = /* @__PURE__ */ new Set(), catalogCursor = 0, priority) {
      const revision2 = this.#policyRevision;
      const context = this.vault.identity(representation);
      const root = context && this.isCatalogOnly() ? this.#catalogSource(context) : this.vault.rootUrl(representation);
      const rootKey = root ? mediaIdentity(root) : null;
      if (!context || !root || this.session.get().disabled || this.settings.get().disabled || this.settings.get().fixedHost || rootKey !== null && this.#hostLockedStreams.has(rootKey))
        return null;
      const native = this.isCatalogOnly() || priority?.allowNative === false ? [] : this.vault.candidates(representation, this.#unlockedNative.get(representation) ?? /* @__PURE__ */ new Set()).native.filter((candidate) => candidate.activelyExplorable);
      const candidates = challengerCandidates(context.kind, native, preferNative, catalogCursor);
      const now = this.clock.now(), currentHost = this.session.get().affinity?.host;
      const legal = candidates.filter((candidate) => {
        if (candidate.host === currentHost || excludedHosts.has(candidate.host)) return false;
        if (this.#hardRestriction(candidate.host, candidate.kind)) return false;
        if (this.vault.isInvalid(context.representation, candidate.host)) return false;
        if (candidate.type === "catalog-generated" && this.#incompatible(root, candidate.host))
          return false;
        return true;
      });
      const prioritized = priority ? legal.find((candidate) => {
        const row = this.evidence.get(candidate.host, candidate.kind), control = this.evidence.control(candidate.host, candidate.kind);
        return !!row && row.circuitUntil > 0 && row.circuitUntil <= now && control.synchronized && control.until === row.circuitUntil && !!control.stamp && !priority.claims.some(
          (claim) => claim.host === candidate.host && claim.kind === candidate.kind && sameCircuitStamp(claim.stamp, control.stamp)
        );
      }) : null;
      const selected = prioritized ?? legal.find((candidate) => {
        const attemptKey = `${context.representation}:${candidate.host}`;
        if (now - (this.#challengeAttempts.get(attemptKey) ?? 0) < 6 * 60 * 6e4) return false;
        const evidence = this.evidence.get(candidate.host, candidate.kind);
        return !evidence || !evidence.updatedAt || now - evidence.updatedAt >= 6 * 60 * 60 * 1e3;
      });
      if (!selected) return null;
      const url = selected.type === "catalog-generated" ? replaceUrlHost(root, selected.host) : this.vault.resolve(selected.handle, context);
      if (!url || selected.type === "catalog-generated" && parseMediaUrl(url)?.kind !== "normal")
        return null;
      const proposal = Object.freeze({
        context,
        candidate: selected,
        url,
        streamKey: rootKey,
        priorityStamp: prioritized ? this.evidence.control(selected.host, selected.kind).stamp : null
      });
      const proof = { revision: revision2, root, allowNative: priority?.allowNative !== false };
      if (!this.#challengeCurrent(proposal, proof)) return null;
      if (prioritized && !proposal.priorityStamp) return null;
      this.#challengeProposals.set(proposal, proof);
      return proposal;
    }
    #challengeCurrent(proposal, proof) {
      const { context, candidate } = proposal, state = this.session.get(), settings = this.settings.get(), root = this.isCatalogOnly() ? this.#catalogSource(context) : this.vault.rootUrl(context.representation);
      if (state.disabled || settings.disabled || settings.fixedHost || context.generation !== state.generation || context.epoch !== state.epoch || !this.vault.isCurrentIdentity(context) || proof.revision !== this.#policyRevision || !root || root !== proof.root || mediaIdentity(root) !== proposal.streamKey || proposal.streamKey !== null && this.#hostLockedStreams.has(proposal.streamKey) || candidate.kind !== context.kind || candidate.host === state.affinity?.host || this.#hardRestriction(candidate.host, candidate.kind) || this.vault.isInvalid(context.representation, candidate.host))
        return false;
      const legal = candidate.type === "catalog-generated" ? !this.#incompatible(root, candidate.host) && replaceUrlHost(root, candidate.host) === proposal.url && parseMediaUrl(proposal.url)?.kind === "normal" : proof.allowNative && !this.isCatalogOnly() && this.vault.candidates(
        context.representation,
        this.#unlockedNative.get(context.representation) ?? /* @__PURE__ */ new Set()
      ).native.some(
        (route) => route.handle === candidate.handle && route.host === candidate.host && route.activelyExplorable
      ) && this.vault.resolve(candidate.handle, context) === proposal.url;
      const priorityCurrent = this.#challengePriorityCurrent(proposal);
      const latest = this.session.get(), latestSettings = this.settings.get();
      return legal && priorityCurrent && !latest.disabled && !latestSettings.disabled && !latestSettings.fixedHost && latest.generation === context.generation && latest.epoch === context.epoch && candidate.host !== latest.affinity?.host && proof.revision === this.#policyRevision && this.vault.isCurrentIdentity(context);
    }
    #challengePriorityCurrent(proposal) {
      if (!proposal.priorityStamp) return true;
      const control = this.evidence.control(proposal.candidate.host, proposal.candidate.kind);
      return control.synchronized && control.until > 0 && control.until <= this.clock.now() && sameCircuitStamp(control.stamp, proposal.priorityStamp);
    }
    commitChallenge(proposal, priorityClaimed = false) {
      const proof = this.#challengeProposals.get(proposal);
      if (!proof || !this.#challengeCurrent(proposal, proof)) return null;
      const { context, candidate } = proposal, now = this.clock.now();
      if (proposal.priorityStamp) {
        if (!priorityClaimed || !this.#challengePriorityCurrent(proposal)) return null;
      } else {
        const row = this.evidence.get(candidate.host, candidate.kind);
        if (now - (this.#challengeAttempts.get(`${context.representation}:${candidate.host}`) ?? 0) < 6 * 60 * 6e4 || row?.updatedAt && now - row.updatedAt < 6 * 60 * 6e4)
          return null;
      }
      if (!this.#challengeCurrent(proposal, proof)) return null;
      this.#challengeProposals.delete(proposal);
      const decision = {
        action: "rewrite",
        id: this.#nextId(),
        reason: "safe-challenger",
        routeType: candidate.type,
        host: candidate.host,
        candidate,
        ranking: Object.freeze([])
      };
      this.#challengeAttempts.set(`${context.representation}:${candidate.host}`, now);
      this.#remember(decision, context, context.kind);
      this.#emit({ type: "route-planned", at: now, decision });
      const applied = {
        decision,
        url: proposal.url,
        context,
        streamKey: proposal.streamKey,
        sourceHost: parseMediaUrl(proof.root)?.host ?? null
      };
      this.#measurementId(applied, "challenge");
      return this.#challengeCurrent(proposal, proof) ? applied : null;
    }
    async recordChallenge(applied, bytes, elapsedMs, ttfbMs, outcome, failureKind, workCurrent = () => true, measurement) {
      const context = applied.context;
      if (!context || applied.decision.action !== "rewrite") return;
      if (this.isCatalogOnly() && applied.decision.routeType !== "catalog-generated") return;
      const valid = /* @__PURE__ */ __name(() => workCurrent() && context.generation === this.session.get().generation && context.epoch === this.session.get().epoch && !this.session.get().disabled && this.vault.isCurrentIdentity(context) && (!this.isCatalogOnly() || applied.decision.routeType === "catalog-generated"), "valid");
      if (!valid()) return;
      if (failureKind === "native-invalid" && applied.decision.routeType === "native-signed") {
        this.vault.invalidate(context.representation, applied.decision.host);
        return;
      }
      if (outcome === "failure") return;
      await this.evidence.record(
        applied.decision.host,
        context.kind,
        {
          requestId: this.#measurementId(applied, "challenge"),
          ...measurement?.timingBasis ? { timingBasis: measurement.timingBasis } : {},
          at: this.clock.now(),
          source: "challenge",
          outcome,
          throughputMbps: measurement?.speedEligible !== false && outcome === "success" && bytes >= 64 * 1024 && elapsedMs > 0 ? bytes * 8 / elapsedMs / 1e3 : null,
          ttfbMs,
          failureKind,
          ...sampleTiming(bytes, elapsedMs, ttfbMs) ?? {}
        },
        valid
      );
      if (outcome === "success" && context.kind === "video" && valid() && applied.decision.host && this.#plans.get(context.representation)?.host === applied.decision.host)
        this.#lastVideoEvidence = {
          host: applied.decision.host,
          requestId: this.#measurementId(applied, "challenge"),
          identity: context,
          source: "current-probe"
        };
    }
    async observe(observation) {
      const receipt = this.#ownership.beginObservation(observation);
      if (!receipt) return;
      this.#stepCircuits();
      const terminalTick = this.#circuitTick();
      let credit = null;
      let releaseFailure = null;
      let confirmed = true;
      try {
        if (observation.request) this.#pendingMedia.delete(observation.request.requestId);
        const valid = /* @__PURE__ */ __name(() => observation.generation === this.session.get().generation && observation.epoch === this.session.get().epoch && !this.session.get().disabled && (observation.request?.authorityRevision == null || !observation.representation || this.vault.identity(observation.representation)?.authorityRevision === observation.request.authorityRevision), "valid");
        const catalogObserved = /* @__PURE__ */ __name(() => catalogObservationAllowed(this.isCatalogOnly(), observation), "catalogObserved");
        const controlsCurrent = /* @__PURE__ */ __name(() => valid() && this.#controlCurrent(observation) && (observation.request ? observation.request.routePolicyRevision === this.#policyRevision : !!observation.decisionId && this.#decisions.get(observation.decisionId)?.policyRevision === this.#policyRevision), "controlsCurrent");
        if (controlsCurrent() && this.isCatalogOnly() && observation.routeType === "catalog-generated" && isCatalogHost(observation.targetHost) && observation.finalHost && observation.finalHost !== observation.targetHost && observation.streamKey)
          this.#markIncompatibleKey(observation.streamKey, observation.targetHost);
        if (!valid() || !catalogObserved()) return;
        if (controlsCurrent() && observation.kind && observation.request) {
          const fallback = this.#fallbacks.get(observation.kind);
          if (fallback?.requestId === observation.request.requestId && fallback.stage === "entered-hook") {
            this.#fallbacks.set(observation.kind, {
              ...fallback,
              stage: observation.status > 0 ? "response-observed" : "request-failed",
              responseHost: observation.finalHost,
              outcome: observation.outcome,
              status: observation.status
            });
          }
        }
        const key = observation.kind ?? "unknown";
        if (!observation.request || !this.#ownership.has(observation.request) || controlsCurrent()) {
          this.#latest.set(key, transportSnapshot(observation));
        }
        const result = classifyTransportResult(observation);
        if (result.type === "ignore") return;
        if (result.type === "request-rejected") return;
        if (result.type === "catalog-resource-missing") {
          if (!controlsCurrent()) return;
          this.#markIncompatibleKey(observation.streamKey, observation.targetHost);
          if (observation.representation && observation.kind)
            this.recover(
              observation.representation,
              this.#demandFor(observation.representation, observation.kind),
              "verified-failure",
              observation.targetHost,
              observation.request?.expectedBytes ?? null,
              observation.request?.timingBasis
            );
          return;
        }
        if (result.type === "catalog-forbidden") {
          if (!controlsCurrent()) return;
          this.#markIncompatibleKey(observation.streamKey, observation.targetHost);
          this.#hostLockedStreams.add(observation.streamKey);
          if (observation.kind === "video" && observation.representation)
            this.recoverStartup(
              observation.representation,
              this.#demandFor(observation.representation, "video"),
              observation.targetHost,
              []
            );
          return;
        }
        const representation = observation.representation;
        if (result.type === "native-invalid") {
          if (!controlsCurrent()) return;
          this.vault.invalidate(representation, result.host);
          const demand = this.#demandFor(representation, result.kind);
          this.recover(
            representation,
            demand,
            "verified-failure",
            result.host,
            observation.request?.expectedBytes ?? null,
            observation.request?.timingBasis
          );
          return;
        }
        if (result.type === "failure")
          releaseFailure = this.#circuits.failure(result.host, result.kind);
        const saved = await this.evidence.commit(
          result.host,
          result.kind,
          result.sample,
          receipt,
          () => valid() && catalogObserved()
        );
        confirmed = saved.status === "committed";
        this.#circuits.persisted(result.host, result.kind, confirmed);
        if (saved.status === "unconfirmed") throw saved.error ?? Error("Evidence write unconfirmed");
        if (result.type === "success" && confirmed && circuitCreditEligible(observation, result.sample))
          credit = {
            host: result.host,
            kind: result.kind,
            valid: /* @__PURE__ */ __name(() => controlsCurrent() && catalogObserved(), "valid")
          };
        if (result.type === "success" && result.kind === "video" && observation.representation && controlsCurrent()) {
          const identity = this.vault.identity(observation.representation);
          if (identity)
            this.#lastVideoEvidence = {
              host: result.host,
              requestId: result.sample.requestId,
              identity,
              source: "current-transport"
            };
        }
        if (!controlsCurrent() || !catalogObserved()) return;
        if (result.type === "success") {
          const request = observation.request;
          if (request && !this.#retryEvidence.isSuppressed(request.requestId) && retryTransportEligible(request, observation) && this.evidence.get(observation.targetHost, "video")?.samples.some(
            (sample) => sample.requestId === request.requestId && sample.at === observation.completedAt && sample.outcome === "success" && sample.source === "transport"
          )) {
            this.#retryEvidence.record(request, observation, () => this.clock.now());
          }
          this.#confirmObservedTransport(observation, representation);
          return;
        }
        if (representation) {
          const demand = this.#demandFor(representation, observation.kind);
          this.recover(
            representation,
            demand,
            "verified-failure",
            result.host,
            observation.request?.expectedBytes ?? null,
            observation.request?.timingBasis
          );
        }
      } finally {
        releaseFailure?.();
        this.#stepCircuits();
        const tick = this.#circuitTick();
        const fresh = tick !== null && terminalTick !== null && tick >= terminalTick && tick - terminalTick <= CIRCUIT_SUCCESS_GAP_MS;
        const kind = this.#circuits.finish(
          receipt,
          !!credit && fresh && credit.valid(),
          confirmed,
          credit ? this.evidence.control(credit.host, credit.kind) : null,
          tick,
          () => this.ids.next("observation")
        );
        if (kind) await this.#settleCircuit(kind);
      }
    }
    #circuitTick() {
      return readMonotonic(() => this.clock.monotonicNow?.() ?? null);
    }
    #stepCircuits() {
      this.#circuits.step(
        this.clock.now(),
        this.#circuitTick(),
        (host, kind) => this.evidence.control(host, kind)
      );
    }
    async #settleCircuit(kind) {
      const proof = this.#circuits.proposal(kind, this.#circuitTick());
      if (!proof) return;
      const { host } = proof;
      const result = await this.evidence.tryDowngrade(
        host,
        kind,
        proof.period.stamp,
        this.ids.next("commit"),
        () => {
          this.#stepCircuits();
          return this.#circuits.ready(
            proof,
            this.evidence.control(host, kind),
            this.clock.now(),
            this.#circuitTick()
          ) && this.#circuitOwnerCurrent(proof.request);
        }
      );
      this.#circuits.submitted(proof, result, this.#circuitTick(), () => this.ids.next("observation"));
    }
    #circuitOwnerCurrent(request) {
      const state = this.session.get(), revision2 = this.#policyRevision;
      const representation = request.representation;
      if (!representation || !request.kind || state.disabled || this.settings.get().disabled)
        return false;
      const identity = this.vault.identity(representation), plan = this.#plans.get(representation);
      const current = this.#requested.get(request.kind);
      const allowed = request.generation === state.generation && request.epoch === state.epoch && request.routePolicyRevision === revision2 && !!identity && this.vault.isCurrentIdentity(identity) && request.authorityRevision === identity.authorityRevision && !this.vault.isInvalid(representation, request.targetHost) && !this.#hardRestriction(request.targetHost, request.kind) && plan?.id === request.decisionId && plan.host === request.targetHost && request.routeRevision === this.#planRevisions.get(representation) && current?.representation === representation && current.targetHost === request.targetHost && (request.kind !== "video" || this.#ownership.selection?.revision === request.selectionRevision);
      return allowed && revision2 === this.#policyRevision && this.session.get().generation === state.generation && this.session.get().epoch === state.epoch && !this.session.get().disabled && !this.settings.get().disabled && this.vault.identity(representation)?.authorityRevision === identity?.authorityRevision;
    }
    #confirmObservedTransport(observation, representation) {
      if (representation && this.vault.hosts(representation).includes(observation.finalHost)) {
        this.unlockNative(representation, observation.finalHost);
      }
      if (observation.kind === "video") {
        const active = this.session.get().representation;
        if (representation && (representation !== active || this.#ownership.selection?.representation === representation && this.#ownership.selection.phase === "pending")) {
          const key = observation.request?.requestId ?? String(observation.decisionId) + ":" + observation.completedAt;
          if (this.#ownership.success(representation, key)) {
            this.session.setRepresentation(representation);
            this.#ownership.confirm(representation);
          }
        } else {
          this.#ownership.clearSuccesses();
        }
        if (representation && this.session.get().representation === representation && (!this.#ownership.selection || this.#ownership.selection.phase === "confirmed") && observation.decisionId) {
          this.session.setAffinity({
            type: observation.routeType,
            host: observation.finalHost,
            confirmedAt: observation.completedAt,
            decisionId: observation.decisionId,
            representation
          });
        }
      }
      this.#emit({ type: "route-confirmed", at: observation.completedAt, observation });
    }
    snapshot() {
      const session = this.session.get(), pending = this.#ownership.selection?.phase === "pending", activeRepresentation = this.#ownership.selection?.representation ?? session.representation, active = activeRepresentation ? this.#plans.get(activeRepresentation) : null, representation = !pending && session.representation ? this.vault.groupSummary(session.representation) : null, currentCapacity = this.#capacity(session, active);
      return Object.freeze({
        currentCapacity,
        circuits: Object.freeze(
          this.evidence.list().filter((row) => row.circuitLevel > 0 || row.circuitUntil > this.clock.now()).map(
            (row) => this.#circuits.snapshot(
              row.host,
              row.kind,
              this.evidence.control(row.host, row.kind),
              this.clock.now(),
              this.#circuitTick()
            )
          )
        ),
        selection: this.#ownership.selection ? {
          phase: this.#ownership.selection.phase,
          sampleCount: this.#ownership.selection.phase === "confirmed" ? 2 : this.#ownership.sampleCount,
          nextAction: this.#ownership.selection.phase === "confirmed" ? "observe-playback" : "await-video-success",
          revision: this.#ownership.selection.revision
        } : null,
        activePlan: active ? Object.freeze({
          ...planSummary(active),
          ranking: rankingSummary(active.ranking)
        }) : null,
        affinity: session.affinity,
        latest: Object.freeze(Object.fromEntries(this.#latest)),
        requested: Object.freeze(Object.fromEntries(this.#requested)),
        attribution: !pending && session.representation ? "confirmed" : this.#ownership.tentativeRepresentation ? "awaiting-second-video-transfer" : "awaiting-matched-video",
        representation,
        fallback: Object.freeze(Object.fromEntries(this.#fallbacks))
      });
    }
    #capacity(session, plan) {
      const representation = session.representation;
      if (!representation || !plan || plan.action === "block" || !plan.host || this.#ownership.selection && (this.#ownership.selection.representation !== representation || this.#ownership.selection.phase !== "confirmed"))
        return null;
      const identity = this.#planIdentities.get(representation), revision2 = this.#policyRevision;
      if (!identity || identity.kind !== "video") return null;
      const current = /* @__PURE__ */ __name(() => {
        const settings = this.settings.get(), vaultCurrent = this.vault.isCurrentIdentity(identity), state = this.session.get();
        return !settings.disabled && !state.disabled && vaultCurrent && state.generation === session.generation && state.epoch === session.epoch && identity.generation === state.generation && identity.epoch === state.epoch && state.representation === representation && this.#policyRevision === revision2 && this.#planIdentities.get(representation) === identity && this.#plans.get(representation) === plan;
      }, "current");
      if (!current() || !this.#decisionAllowed(plan, identity, "video")) return null;
      const evidence = this.evidence.get(plan.host, "video"), now = this.clock.now();
      const metrics = evidenceMetrics(evidence, now, this.#requested.get("video")?.timingBasis);
      const requestBytes = this.#requested.get("video")?.expectedBytes ?? null;
      const budget = this.completionBudget(
        representation,
        requestBytes,
        this.#requested.get("video")?.timingBasis
      );
      const { estimatedCompletionMs, predictionReason, safeMbps, speeds, sampleStatus } = capacityNumbers(evidence, metrics, now, budget, requestBytes);
      if (!this.#decisionAllowed(plan, identity, "video") || !current()) return null;
      return Object.freeze({
        generation: session.generation,
        epoch: session.epoch,
        representation,
        decisionId: plan.id,
        host: plan.host,
        routeType: plan.routeType,
        safeMbps,
        capacityConfidence: metrics.capacityConfidence,
        freshSpeedCount: metrics.freshSpeedCount,
        newestSpeedAt: metrics.newestSpeedAt,
        safePayloadMbps: metrics.safePayloadMbps,
        estimatedCompletionMs,
        predictionReason,
        sampleStatus,
        evidenceOrigin: safeMbps === null ? null : this.#lastVideoEvidence && this.#lastVideoEvidence.host === plan.host && this.#lastVideoEvidence.identity.representation === representation && this.#lastVideoEvidence.identity === identity && speeds.some(
          (sample) => sample.requestId === this.#lastVideoEvidence.requestId && now - sample.at <= EVIDENCE_TTL_MS
        ) ? this.#lastVideoEvidence.source : "historical-cache"
      });
    }
    #trackFallback(representation, kind, decision) {
      const identity = this.vault.identity(representation);
      if (!decision.host || !identity || identity.kind !== kind) return;
      const actionId = recoveryActionId(`recovery-${++this.#recoverySerial}`);
      this.#fallbacks.set(
        kind,
        Object.freeze({
          actionId,
          representation,
          decisionId: decision.id,
          plannedHost: decision.host,
          routeType: decision.routeType,
          stage: "planned",
          requestId: null,
          responseHost: null,
          outcome: null,
          status: null
        })
      );
      this.#emit({
        type: "recovery",
        at: this.clock.now(),
        action: { action: "route-fallback", id: actionId, kind, identity, decision }
      });
    }
    #choose(context, demand, boundary, failedHost, sourceUrl, reuse, requestBytes = null, timingBasis2) {
      const settings = this.settings.get();
      const { disabledCatalogHosts, defaultUnavailableHosts } = catalogRestrictions(
        settings.catalogOverrides
      );
      const restriction = this.restrictions.snapshot(context.kind);
      const unlocked = this.#unlockedNative.get(context.representation) ?? /* @__PURE__ */ new Set();
      const routes = this.vault.candidates(context.representation, unlocked);
      const root = this.isCatalogOnly() ? this.#catalogSource(context, sourceUrl) ?? "" : sourceUrl ?? this.vault.rootUrl(context.representation) ?? "";
      if (this.isCatalogOnly() && !root) return this.#block("catalog-unreplaceable", null);
      const candidates = selectionCandidates(
        context,
        root,
        routes,
        this.vault,
        () => this.isCatalogOnly(),
        (url, host) => this.#incompatible(url, host)
      );
      const current = reuse ?? this.#currentPlan(context.representation), affinity = this.session.get().affinity;
      const currentRoute = boundary === "representation" && context.kind === "video" && affinity ? { type: affinity.type, host: affinity.host } : current && current.action !== "block" && current.host ? { type: current.routeType, host: current.host } : context.kind === "video" && affinity ? { type: affinity.type, host: affinity.host } : null;
      const input = {
        completionBudget: this.completionBudget(
          context.representation,
          requestBytes,
          timingBasis2
        ) ?? {
          requestBytes,
          ...timingBasis2 ? { timingBasis: timingBasis2 } : {},
          playableBufferSec: null,
          sampledAt: this.clock.now()
        },
        candidates,
        evidenceFor: /* @__PURE__ */ __name((host, kind) => this.evidence.get(host, kind), "evidenceFor"),
        restrictions: {
          disabledCatalogHosts,
          defaultUnavailableHosts,
          blackHosts: restriction.blackHosts,
          deadHosts: restriction.deadHosts,
          hostLocked: /* @__PURE__ */ new Set()
        },
        demand,
        fixedHost: settings.fixedHost,
        current: currentRoute,
        boundary,
        failedHost
      };
      const ranking = rankRoutes(input, this.clock.now());
      if (reuse && this.#decisionAllowed(reuse, context, demand.kind) && retainedRoute(input, ranking)?.candidate.host === reuse.host)
        return reuse;
      const id2 = this.#nextId();
      const decision = chooseRoute(input, this.clock, id2, ranking);
      this.session.noteDecision(id2);
      this.#remember(decision, context, context.kind);
      this.#emit({ type: "route-planned", at: this.clock.now(), decision });
      return decision;
    }
    #catalogOnly(demand, originalHost, knownKind, sourceUrl) {
      const settings = this.settings.get(), restriction = this.#restrictionSnapshot(knownKind);
      const candidates = catalogCandidates(demand.kind).filter(
        (candidate) => !sourceUrl || !this.#incompatible(sourceUrl, candidate.host)
      );
      const id2 = this.#nextId();
      const decision = chooseRoute(
        {
          candidates,
          evidenceFor: /* @__PURE__ */ __name((host, kind) => this.evidence.get(host, kind), "evidenceFor"),
          restrictions: {
            ...catalogRestrictions(settings.catalogOverrides),
            blackHosts: restriction.blackHosts,
            deadHosts: restriction.deadHosts,
            hostLocked: /* @__PURE__ */ new Set()
          },
          demand,
          fixedHost: settings.fixedHost,
          current: this.session.get().affinity,
          boundary: "request",
          failedHost: null
        },
        this.clock,
        id2
      );
      if (decision.action === "block") {
        if (this.isCatalogOnly()) return this.#block("catalog-unavailable", originalHost);
        const forbidden = this.#hardRestriction(originalHost, knownKind);
        return forbidden ? this.#block(forbidden, originalHost) : this.#pass("catalog-unavailable", originalHost, demand.kind);
      }
      return decision;
    }
    #materialize(original, decision, context) {
      return materializeRoute(
        original,
        decision,
        context,
        this.vault,
        (choice, identity, kind) => this.#decisionAllowed(choice, identity, kind)
      );
    }
    #pass(reason, host, _kind) {
      return {
        action: "pass",
        target: { type: "request" },
        id: this.#nextId(),
        reason: reason.slice(0, 64),
        routeType: "root-original",
        host,
        ranking: Object.freeze([])
      };
    }
    #block(reason, host) {
      return {
        action: "block",
        id: this.#nextId(),
        reason,
        routeType: "root-original",
        host,
        ranking: Object.freeze([])
      };
    }
    #restrictionSnapshot(kind) {
      return restrictionSnapshot(this.restrictions, kind);
    }
    #hardRestriction(host, kind) {
      return restrictedHost(
        {
          clock: this.clock,
          settings: this.settings,
          restrictions: this.restrictions,
          evidence: this.evidence
        },
        host,
        kind
      );
    }
    #catalogSource(context, requested) {
      return catalogSource2(this.vault, context, requested);
    }
    #decisionAllowed(decision, context, kind) {
      return canUseDecision(this.#policyReader(), decision, context, kind);
    }
    #policyReader() {
      return {
        vault: this.vault,
        isCatalogOnly: /* @__PURE__ */ __name(() => this.isCatalogOnly(), "isCatalogOnly"),
        hardRestriction: /* @__PURE__ */ __name((host, kind) => this.#hardRestriction(host, kind), "hardRestriction"),
        catalogSource: /* @__PURE__ */ __name((context, requested) => this.#catalogSource(context, requested), "catalogSource"),
        incompatible: /* @__PURE__ */ __name((url, host) => this.#incompatible(url, host), "incompatible"),
        unlockedNative: /* @__PURE__ */ __name((representation) => this.#unlockedNative.get(representation) ?? /* @__PURE__ */ new Set(), "unlockedNative")
      };
    }
    #currentPlan(representation) {
      const current = this.vault.identity(representation), prior = this.#planIdentities.get(representation);
      if (prior && prior !== current) {
        this.#plans.delete(representation);
        this.#planIdentities.delete(representation);
        this.#unlockedNative.delete(representation);
        this.#requestedRepresentations.delete(representation);
        this.#ownership.forgetRepresentation(representation);
        for (const [kind, fallback] of this.#fallbacks)
          if (fallback.representation === representation) this.#fallbacks.delete(kind);
        for (const key of this.#challengeAttempts.keys())
          if (key.startsWith(`${representation}:`)) this.#challengeAttempts.delete(key);
        const affinity = this.session.get().affinity;
        if (affinity?.representation === representation && affinity.type !== "catalog-generated")
          this.session.setAffinity(null);
      }
      return this.#plans.get(representation);
    }
    #planPlayerFallback(candidate) {
      const decision = {
        action: "rewrite",
        id: this.#nextId(),
        reason: "player-fallback",
        routeType: candidate.type,
        host: candidate.host,
        candidate,
        ranking: []
      };
      this.session.noteDecision(decision.id);
      this.#emit({ type: "route-planned", at: this.clock.now(), decision });
      return decision;
    }
    #saveAppliedPlan(decision, context, streamKey, kind) {
      this.#remember(decision, context, kind);
      if (context) {
        this.#savePlan(context.representation, decision);
        this.#requestedRepresentations.add(context.representation);
      } else if (streamKey) {
        this.#streamPlans.set(streamKey, decision);
        while (this.#streamPlans.size > 192)
          this.#streamPlans.delete(this.#streamPlans.keys().next().value);
      }
    }
    #savePlan(representation, decision) {
      this.#currentPlan(representation);
      const identity = this.vault.identity(representation);
      if (!identity) return;
      if (this.#plans.get(representation) !== decision)
        this.#planRevisions.set(representation, ++this.#routeSerial);
      this.#plans.set(representation, decision);
      this.#planIdentities.set(representation, identity);
    }
    #nextId() {
      return decisionId(`decision-${++this.#serial}`);
    }
    #incompatible(url, host) {
      const key = mediaIdentity(url);
      return !!key && (this.#startupIncompatible.get(key)?.has(host) ?? false);
    }
    #markIncompatible(url, host) {
      const key = mediaIdentity(url);
      if (!key) return;
      this.#markIncompatibleKey(key, host);
    }
    #markIncompatibleKey(key, host) {
      const hosts = this.#startupIncompatible.get(key) ?? /* @__PURE__ */ new Set();
      hosts.add(host);
      this.#startupIncompatible.set(key, hosts);
      while (this.#startupIncompatible.size > 256)
        this.#startupIncompatible.delete(this.#startupIncompatible.keys().next().value);
    }
    #remember(decision, context, kind) {
      this.#decisions.set(decision.id, {
        decision,
        context,
        kind,
        representation: context?.representation ?? null,
        policyRevision: this.#policyRevision
      });
      while (this.#decisions.size > 256)
        this.#decisions.delete(this.#decisions.keys().next().value);
    }
    #emit(event) {
      for (const listener of this.#listeners) listener(event);
    }
    #measurementId(work, kind) {
      let id2 = this.#measurementIds.get(work);
      if (!id2) {
        id2 = this.ids.next(kind);
        this.#measurementIds.set(work, id2);
      }
      return id2;
    }
  };

  // src-v2/application/measurement/startup-evaluation.ts
  function probeResultUsable(candidate, result) {
    return result.directRange && Number.isSafeInteger(result.bytes) && Number.isFinite(result.elapsedMs) && (candidate.cachedSafeMbps !== null || result.elapsedMs > 0 && result.speedEligible !== false) && result.payloadValid !== false && (candidate.cachedSafeMbps !== null ? result.bytes >= 16 * 1024 : result.bytes >= 64 * 1024);
  }
  __name(probeResultUsable, "probeResultUsable");
  function evaluatedProbeResult(candidate, result, rangeValid, metrics) {
    const valid = rangeValid && !!metrics && ["sufficient", "provisional"].includes(metrics.capacityConfidence) && metrics.safeThroughputMbps !== null;
    return {
      candidate,
      ...result,
      valid,
      safeMbps: valid ? metrics.safeThroughputMbps : null,
      capacityConfidence: metrics?.capacityConfidence ?? "missing",
      safePayloadMbps: metrics?.safePayloadMbps ?? null,
      predictionTtfbMs: metrics?.predictionTtfbMs ?? null,
      reason: result.directRange ? valid ? "measured" : "short-response" : result.reason
    };
  }
  __name(evaluatedProbeResult, "evaluatedProbeResult");
  function rankStartupResults(rows, qualified, budget, now) {
    const ordered = orderCapacityRows(rows, budget, now).map((row) => row.result);
    const compare = /* @__PURE__ */ __name((a, b) => ordered.indexOf(a) - ordered.indexOf(b), "compare");
    const ranked = [...qualified].sort(compare);
    const fastestValid = rows.map((row) => row.result).sort(compare)[0]?.candidate ?? null;
    return { ranked, fastestValid, compare };
  }
  __name(rankStartupResults, "rankStartupResults");
  function classifyProbeOutcome(applied, result) {
    const ok = result.directRange && result.payloadValid !== false && result.bytes >= 64 * 1024;
    const failure = applied.decision.routeType === "native-signed" && [403, 451, 959].includes(result.status ?? 0) ? "native-invalid" : result.reason === "timeout" ? "timeout" : result.reason === "network" ? "network" : null;
    return { ok, failure };
  }
  __name(classifyProbeOutcome, "classifyProbeOutcome");

  // src-v2/application/measurement/measurement-controller.ts
  var COOLDOWN_MS = 10 * 6e4;
  var TIMEOUT_MS = 3e3;
  var nextCursor = /* @__PURE__ */ __name((cursor) => Number.isSafeInteger(cursor) && cursor >= 0 && cursor < Number.MAX_SAFE_INTEGER ? cursor + 1 : 0, "nextCursor");
  var cancellationReason = /* @__PURE__ */ __name((signal) => "reason" in signal ? signal.reason : new DOMException("Aborted", "AbortError"), "cancellationReason");
  var MeasurementController = class {
    constructor(routes, meta, probe, now, scheduler, rangeMetadata, random = () => 0, settings, monotonicNow = () => null, ids) {
      this.routes = routes;
      this.meta = meta;
      this.probe = probe;
      this.now = now;
      this.scheduler = scheduler;
      this.rangeMetadata = rangeMetadata;
      this.random = random;
      this.monotonicNow = monotonicNow;
      this.ids = ids;
      if (settings) {
        let previous = settings.get();
        this.#stopSettings = settings.subscribe(() => {
          const next = settings.get();
          if (sameMeasurementSettings(previous, next)) return;
          previous = next;
          this.#marker++;
          this.cancel("test-policy-changed");
          this.#closeStartup("test-policy-changed");
        });
      }
    }
    routes;
    meta;
    probe;
    now;
    scheduler;
    rangeMetadata;
    random;
    monotonicNow;
    ids;
    static {
      __name(this, "MeasurementController");
    }
    #stopSettings = null;
    #disposed = false;
    #running = null;
    #failedAt = null;
    #planning = null;
    #preferNative = false;
    #marker = 0;
    #lastStatus = null;
    #startupLease = { phase: "available" };
    #startupQualifiedHosts = [];
    #startupState = Object.freeze({
      state: "idle",
      reason: "not-requested",
      candidates: 0,
      selectedHost: null,
      delayed: false
    });
    #snapshot = Object.freeze({
      state: "idle",
      reason: "startup",
      lastAttemptAt: 0,
      host: null
    });
    snapshot() {
      return Object.freeze({
        ...this.#snapshot,
        startup: this.#startupState
      });
    }
    reset() {
      this.cancel("generation");
      this.#closeStartup("generation");
      this.#startupQualifiedHosts = [];
      this.#marker++;
      this.#failedAt = null;
      this.#snapshot = Object.freeze({
        state: "idle",
        reason: "generation",
        lastAttemptAt: 0,
        host: null
      });
    }
    dispose() {
      this.#disposed = true;
      this.#stopSettings?.();
      this.#stopSettings = null;
      this.reset();
    }
    #closeStartup(reason) {
      if (this.#startupLease.phase === "available") return;
      const lease = this.#startupLease;
      this.#startupLease = { phase: "closed" };
      this.#startupState = Object.freeze({
        state: lease.phase === "reserved" || lease.phase === "probing" ? "cancelled" : "skipped",
        result: "none",
        reason: lease.phase === "reserved" || lease.phase === "probing" ? reason : "budget-consumed",
        candidates: 0,
        selectedHost: null,
        delayed: false
      });
      if (lease.phase === "reserved" || lease.phase === "probing") lease.controller.abort(reason);
    }
    startupFallbackHosts() {
      return this.#startupQualifiedHosts;
    }
    cancel(reason) {
      const running = this.#running;
      this.#planning = null;
      this.#running = null;
      running?.controller.abort(reason);
    }
    willGateStartup(url) {
      return this.#startupLease.phase !== "closed" && !!this.routes.startupOptions(url)?.candidates.length;
    }
    /** The player request, never a page hint, authorizes this one bounded startup window. */
    async prepareStartup(url, signal = null, requestBytes = null) {
      if (signal?.aborted) throw cancellationReason(signal);
      if (this.#startupLease.phase === "closed") return;
      if (this.#startupLease.phase === "available") {
        const cursor = Math.max(0, Number(this.meta.get().catalogCursor) || 0);
        const options = this.routes.startupOptions(url, cursor, requestBytes);
        if (!options?.candidates.length) {
          this.noteUnpreflighted(
            options?.deferredToVideo ? "video-priority" : "unsupported-or-no-legal-candidate"
          );
          return;
        }
        const controller = new AbortController(), marker = this.#marker, startedAt = this.now(), deadlineAt = startedAt + TIMEOUT_MS;
        const startedTick = readMonotonic(this.monotonicNow);
        if (startedTick === null) {
          this.noteUnpreflighted("monotonic-unavailable");
          return;
        }
        this.#startupState = Object.freeze({
          state: "running",
          reason: "player-media-request",
          deadlineAt,
          remainingProbes: options.candidates.length,
          candidates: options.candidates.length,
          selectedHost: null,
          delayed: true
        });
        let release;
        const pending2 = new Promise((resolve) => {
          release = resolve;
        });
        if (startupTransition("available", "reserve").reason !== "accepted") return;
        const lease = {
          phase: "reserved",
          controller,
          pending: pending2,
          startedAt,
          deadlineAt,
          startedTick,
          deadlineTick: startedTick + TIMEOUT_MS
        };
        this.#startupLease = lease;
        void this.#runStartup(url, options, controller, marker).catch(() => {
          if (marker === this.#marker)
            this.#startupState = Object.freeze({
              state: "skipped",
              reason: "preflight-error",
              candidates: options.candidates.length,
              selectedHost: null,
              delayed: true
            });
        }).finally(() => {
          if (this.#startupLease === lease) this.#startupLease = { phase: "closed" };
          release();
        });
        void this.meta.withLock(() => {
          if (marker !== this.#marker) return;
          const currentCursor = this.meta.get().catalogCursor;
          if (marker !== this.#marker) return;
          this.meta.update({ catalogCursor: nextCursor(currentCursor) });
        }).catch(() => void 0);
      }
      const pending = "pending" in this.#startupLease ? this.#startupLease.pending : null;
      if (!pending) return;
      if (!signal) {
        await pending;
        return;
      }
      if (signal.aborted) throw cancellationReason(signal);
      let onAbort = null;
      try {
        await Promise.race([
          pending,
          new Promise((_resolve, reject) => {
            onAbort = /* @__PURE__ */ __name(() => reject(cancellationReason(signal)), "onAbort");
            signal.addEventListener("abort", onAbort, { once: true });
          })
        ]);
      } finally {
        if (onAbort) signal.removeEventListener("abort", onAbort);
      }
    }
    noteUnpreflighted(reason) {
      if (this.#startupLease.phase !== "available") return;
      this.#startupState = Object.freeze({
        state: "skipped",
        reason: reason.slice(0, 48),
        candidates: 0,
        selectedHost: null,
        delayed: false
      });
    }
    async #runStartup(url, options, controller, marker) {
      const lease = this.#startupLease;
      if (lease.phase === "available" || lease.phase === "closed" || lease.controller !== controller || startupTransition(lease.phase, "probe").reason !== "accepted")
        return;
      lease.phase = "probing";
      const current = /* @__PURE__ */ __name(() => this.#startupLease === lease && this.#marker === marker && !this.#disposed, "current");
      const results = [];
      const { startedTick, deadlineTick } = lease;
      let timer = null;
      let sealed = false, releaseReason = "complete", remaining = options.candidates.length;
      let resolveWindow, rejectWindow;
      const completion = new Promise((resolve, reject) => {
        resolveWindow = resolve;
        rejectWindow = reject;
      });
      const finish = /* @__PURE__ */ __name((reason) => {
        if (sealed) return;
        sealed = true;
        releaseReason = reason;
        resolveWindow();
      }, "finish");
      const aborted = /* @__PURE__ */ __name(() => finish("cancelled"), "aborted");
      const expire = /* @__PURE__ */ __name(() => {
        finish("deadline");
        controller.abort("startup-deadline");
      }, "expire");
      const accepting = /* @__PURE__ */ __name(() => {
        if (sealed || !current()) return false;
        const tick = readMonotonic(this.monotonicNow);
        if (tick === null || tick < startedTick) {
          finish("clock-invalid");
          controller.abort("clock-invalid");
          return false;
        }
        if (tick >= deadlineTick) {
          expire();
          return false;
        }
        return true;
      }, "accepting");
      controller.signal.addEventListener("abort", aborted, { once: true });
      timer = this.scheduler.timeout(
        expire,
        Math.max(0, deadlineTick - (readMonotonic(this.monotonicNow) ?? deadlineTick))
      );
      for (const candidate of options.candidates) {
        if (!accepting() || controller.signal.aborted) break;
        void this.#probeStartup(candidate, options.demand, controller.signal).then(
          (result2) => {
            if (!accepting()) return;
            results.push(result2);
            this.#startupState = Object.freeze({
              ...this.#startupState,
              remainingProbes: options.candidates.length - results.length
            });
            if (result2.valid && (result2.safeMbps ?? 0) / (this.routes.startupDemand(candidate)?.requiredMbps ?? Infinity) >= ROUTE_HEADROOM && accepting())
              finish("qualified-early");
            else if (--remaining === 0) finish("complete");
          },
          (error) => {
            if (!accepting()) return;
            sealed = true;
            rejectWindow(error);
          }
        );
      }
      try {
        await completion;
      } finally {
        sealed = true;
        if (timer !== null) timer();
        controller.signal.removeEventListener("abort", aborted);
        controller.abort("startup-complete");
      }
      if (marker !== this.#marker) return;
      if (releaseReason === "clock-invalid") {
        this.#startupState = Object.freeze({
          ...this.#startupState,
          state: "cancelled",
          reason: releaseReason
        });
        return;
      }
      for (const result2 of results)
        this.routes.noteStartupProbeResult(result2.candidate, result2.status);
      const valid = results.filter(
        (result2) => result2.valid && result2.safeMbps !== null && this.routes.startupDemand(result2.candidate) !== null
      );
      const qualified = valid.filter(
        (result2) => (result2.safeMbps ?? 0) / (this.routes.startupDemand(result2.candidate)?.requiredMbps ?? Infinity) >= ROUTE_HEADROOM
      );
      const budget = options.candidates[0] ? this.routes.completionBudget(
        options.candidates[0].context.representation,
        options.requestBytes ?? null,
        "probe-reader"
      ) : null;
      const { ranked, fastestValid, compare } = rankStartupResults(
        valid.map((result2) => ({
          result: result2,
          candidateOrder: options.candidates.indexOf(result2.candidate),
          capacityConfidence: result2.capacityConfidence,
          safeThroughputMbps: result2.safeMbps,
          demandRatio: result2.safeMbps === null ? null : result2.safeMbps / (this.routes.startupDemand(result2.candidate)?.requiredMbps ?? Infinity),
          safePayloadMbps: result2.safePayloadMbps,
          predictionTtfbMs: result2.predictionTtfbMs
        })),
        qualified,
        budget,
        this.now()
      );
      const winner = ranked[0]?.candidate ?? fastestValid ?? this.routes.startupFallback(
        url,
        new Set(options.candidates.map((candidate) => candidate.host))
      );
      const result = ranked.length ? "adequate" : valid.length ? "insufficient" : winner ? "unverified" : "none";
      const transition = startupTransition(lease.phase, result === "none" ? "exhausted" : result);
      if (!current() || transition.reason !== "accepted") return;
      const decision = winner ? this.routes.commitStartupChoice(
        url,
        winner,
        valid.length ? "startup-preflight" : "startup-inconclusive"
      ) : this.routes.commitStartupChoice(url, null, "startup-exhausted");
      if (!current()) return;
      this.#startupQualifiedHosts = Object.freeze(
        [...valid].sort(compare).map((result2) => result2.candidate.host)
      );
      this.#startupState = Object.freeze({
        state: decision ? "complete" : "skipped",
        result,
        reason: releaseReason === "qualified-early" ? releaseReason : valid.length ? "measured" : "inconclusive",
        candidates: options.candidates.length,
        selectedHost: decision?.host ?? null,
        delayed: true,
        elapsedMs: Math.max(0, (readMonotonic(this.monotonicNow) ?? startedTick) - startedTick),
        results: Object.freeze(
          results.slice(0, 3).map(
            (result2) => Object.freeze({
              host: result2.candidate.host,
              type: result2.candidate.type,
              valid: result2.valid,
              safeMbps: result2.safeMbps,
              status: result2.status,
              reason: result2.reason
            })
          )
        )
      });
      for (const result2 of valid)
        if (result2.candidate.cachedSafeMbps === null) {
          void this.routes.recordStartupSuccess(
            result2.candidate,
            result2.bytes,
            result2.elapsedMs,
            result2.ttfbMs,
            () => !this.#disposed && marker === this.#marker,
            result2
          ).catch(() => void 0);
        }
    }
    async #probeStartup(candidate, demand, signal) {
      const limit = candidate.cachedSafeMbps !== null ? 16 * 1024 : demand.highDemand ? 512 * 1024 : 256 * 1024;
      const result = await this.probe.read({
        url: candidate.url,
        host: candidate.host,
        limit,
        signal,
        completionReason: "startup-sample-complete"
      });
      const rangeValid = probeResultUsable(candidate, result);
      const metrics = rangeValid ? this.routes.startupCapacity(
        candidate,
        candidate.cachedSafeMbps !== null ? null : {
          requestId: "startup-preview",
          ...result.timingBasis ? { timingBasis: result.timingBasis } : {},
          at: this.now(),
          source: "challenge",
          outcome: "success",
          throughputMbps: result.bytes * 8 / result.elapsedMs / 1e3,
          ttfbMs: result.ttfbMs,
          failureKind: null,
          bytes: result.bytes,
          elapsedMs: result.elapsedMs
        }
      ) : null;
      return evaluatedProbeResult(candidate, result, rangeValid, metrics);
    }
    tick(status) {
      if (this.#disposed) return;
      this.#lastStatus = status;
      const unsafe = this.#unsafeReason(status);
      if (this.#running && unsafe) {
        this.cancel(unsafe);
        this.#snapshot = Object.freeze({ ...this.#snapshot, state: "cancelled", reason: unsafe });
        return;
      }
      if (this.#running || this.#planning) return;
      if (unsafe || status.progressObservation !== "progress") {
        this.#snapshot = Object.freeze({
          ...this.#snapshot,
          state: "waiting",
          reason: unsafe ?? "awaiting-progress"
        });
        return;
      }
      if (this.#failedAt !== null && this.now() - this.#failedAt < COOLDOWN_MS) return;
      void this.#tryStart(status);
    }
    async #tryStart(status) {
      if (!status.representation || !status.demand || this.#running || this.#planning) return;
      const planning = {};
      this.#planning = planning;
      this.#snapshot = Object.freeze({ ...this.#snapshot, state: "waiting", reason: "storage-lock" });
      const planningMarker = this.#marker;
      const round = {
        id: this.ids?.next("challenge") ?? "",
        generation: null,
        priorityUnavailable: false
      };
      let running = null;
      try {
        let at = this.now();
        let first = null, cursor = 0;
        await this.meta.withLock((lock) => {
          if (planningMarker !== this.#marker || this.#planning !== planning) return;
          const current2 = this.#lastStatus;
          if (!current2 || this.#unsafeReason(current2) || current2.representation !== status.representation || !current2.demand)
            return;
          at = this.now();
          const meta = this.meta.get();
          if (at - (Number(meta.lastChallengeAt) || 0) < COOLDOWN_MS) return;
          cursor = Math.max(0, Number(meta.catalogCursor) || 0);
          first = this.#reserveChallenge(
            current2,
            this.#preferNative,
            /* @__PURE__ */ new Set(),
            cursor,
            lock,
            round,
            () => planningMarker === this.#marker && this.#planning === planning
          );
          if (!first?.url) return;
          if (planningMarker !== this.#marker || this.#planning !== planning || this.routes.isCatalogOnly() && first.decision.routeType !== "catalog-generated")
            return;
          this.meta.update({ lastChallengeAt: at, catalogCursor: nextCursor(cursor) });
        });
        if (planningMarker !== this.#marker || this.#planning !== planning) return;
        const current = this.#lastStatus;
        if (!current || this.#unsafeReason(current) || current.representation !== status.representation)
          return;
        const planned = first;
        if (planned && this.routes.isCatalogOnly() && planned.decision.routeType !== "catalog-generated")
          return;
        if (!planned?.url) {
          const cooldown = at - (Number(this.meta.get().lastChallengeAt) || 0) < COOLDOWN_MS;
          this.#snapshot = Object.freeze({
            ...this.#snapshot,
            state: "waiting",
            reason: cooldown ? "cross-tab-cooldown" : "no-stale-candidate"
          });
          return;
        }
        this.#preferNative = !this.#preferNative;
        const controller = new AbortController(), marker = this.#marker;
        running = { controller, marker };
        this.#running = running;
        await this.#runRound(planned, status, controller, marker, cursor, round);
      } catch {
        if (planningMarker === this.#marker && this.#planning === planning && (!running || this.#running === running && !running.controller.signal.aborted)) {
          this.#failedAt = this.now();
          this.#snapshot = Object.freeze({
            ...this.#snapshot,
            state: "failed",
            reason: "measurement-error",
            lastAttemptAt: this.#failedAt
          });
        }
      } finally {
        if (running && this.#running === running) this.#running = null;
        if (this.#planning === planning) this.#planning = null;
      }
    }
    #reserveChallenge(status, preferNative, excluded, cursor, lock, round, valid, allowNative = true) {
      if (!valid() || this.#unsafeReason(status) || !status.representation || !status.demand)
        return null;
      const coordination = this.ids ? this.meta.coordination?.(lock) : null;
      if (round.generation !== null && coordination && coordination.generation !== round.generation)
        return null;
      if (coordination) round.generation ??= coordination.generation;
      else round.priorityUnavailable = true;
      if (!this.routes.proposeChallenge || !this.routes.commitChallenge)
        return this.routes.challenge(
          status.representation,
          status.demand,
          preferNative,
          excluded,
          cursor
        );
      const ordinary = /* @__PURE__ */ __name(() => valid() ? this.routes.proposeChallenge(
        status.representation,
        status.demand,
        preferNative,
        excluded,
        cursor
      ) : null, "ordinary");
      let proposal = this.routes.proposeChallenge(
        status.representation,
        status.demand,
        preferNative,
        excluded,
        cursor,
        coordination && !round.priorityUnavailable ? { claims: coordination.claims, allowNative } : void 0
      );
      if (!proposal || !allowNative && proposal.candidate.type === "native-signed" || !valid())
        return null;
      let claimed = false;
      if (proposal.priorityStamp) {
        if (coordination && round.id && this.ids)
          try {
            claimed = this.meta.claimRevalidation?.(coordination.generation, {
              host: proposal.candidate.host,
              kind: proposal.candidate.kind,
              stamp: proposal.priorityStamp,
              claimId: this.ids.next("challenge"),
              roundId: round.id
            }) === true;
          } catch {
            claimed = false;
          }
        if (!claimed) {
          round.priorityUnavailable = true;
          proposal = ordinary();
        }
      }
      if (!proposal || !allowNative && proposal.candidate.type === "native-signed" || !valid() || proposal.priorityStamp !== null && (round.generation === null || this.meta.coordinationCurrent?.(round.generation) !== true))
        return null;
      return this.routes.commitChallenge(proposal, claimed);
    }
    async #runRound(first, status, controller, marker, cursor, round) {
      const context = first.context;
      const handle = context && this.routes.isCatalogOnly() ? this.rangeMetadata?.catalogSourceHandle(context.representation) ?? null : null;
      const totalBytes = context && handle ? this.rangeMetadata?.rangeSize(context, handle) ?? null : null;
      const range = context && handle ? {
        identity: context,
        handle,
        sizeKnown: totalBytes !== null,
        startByte: probeStartByte(
          totalBytes,
          status.demand.highDemand ? 768 * 1024 : 384 * 1024,
          totalBytes === null ? 0 : this.random()
        )
      } : null;
      const excluded = /* @__PURE__ */ new Set();
      let catalogCount = 0, nativeCount = 0;
      let next = first;
      for (let index = 0; index < 3 && next?.url && !controller.signal.aborted; index++) {
        const current = this.#lastStatus ?? status;
        const unsafe = this.#unsafeReason(current);
        if (unsafe || marker !== this.#marker || current.representation !== status.representation) {
          controller.abort(unsafe ?? "representation-changed");
          break;
        }
        const applied = next;
        if (range && (!this.rangeMetadata?.resolve(range.handle, range.identity) || this.rangeMetadata.catalogSourceHandle(range.identity.representation) !== range.handle)) {
          controller.abort("source-changed");
          break;
        }
        if (applied.decision.host) excluded.add(applied.decision.host);
        if (applied.decision.routeType === "native-signed") nativeCount++;
        else catalogCount++;
        this.#snapshot = Object.freeze({
          state: "running",
          reason: "candidate-" + (index + 1),
          lastAttemptAt: this.now(),
          host: applied.decision.host,
          range: {
            mode: range?.startByte ? "middle" : "head",
            sizeKnown: range?.sizeKnown ?? false
          }
        });
        await this.#runCandidate(applied, status.demand, controller, marker, range);
        if (index === 2 || controller.signal.aborted || marker !== this.#marker || this.#running?.controller !== controller)
          break;
        cursor = nextCursor(cursor);
        next = await this.meta.withLock((lock) => {
          const current2 = this.#lastStatus ?? status;
          return this.#reserveChallenge(
            current2,
            nativeCount === 0 && catalogCount >= 2,
            excluded,
            cursor,
            lock,
            round,
            () => marker === this.#marker && this.#running?.controller === controller && !controller.signal.aborted && current2.representation === status.representation,
            nativeCount < 1
          );
        });
        if (nativeCount >= 1 && next?.decision.routeType === "native-signed") next = null;
      }
      if (controller.signal.aborted && marker === this.#marker && this.#running?.controller === controller)
        this.#snapshot = Object.freeze({
          ...this.#snapshot,
          state: "cancelled",
          reason: String(controller.signal.reason ?? "cancelled").slice(0, 48)
        });
    }
    async #runCandidate(applied, demand, round, marker, range) {
      const startedAt = this.now(), limit = demand.highDemand ? 768 * 1024 : 384 * 1024;
      const controller = new AbortController();
      const cancel = /* @__PURE__ */ __name(() => controller.abort(round.signal.reason), "cancel");
      round.signal.addEventListener("abort", cancel, { once: true });
      const stopTimeout = this.scheduler.timeout(() => controller.abort("timeout"), TIMEOUT_MS);
      let result;
      const source = range ? this.rangeMetadata?.resolve(range.handle, range.identity) : null;
      const usesRange = !!source && !!applied.url && applied.decision.routeType === "catalog-generated" && mediaIdentity(source) === mediaIdentity(applied.url);
      const startByte = usesRange ? range.startByte : 0;
      try {
        result = await this.probe.read({
          url: applied.url ?? "",
          host: applied.decision.host,
          limit,
          startByte,
          signal: controller.signal,
          completionReason: "sample-complete"
        });
      } finally {
        stopTimeout();
        round.signal.removeEventListener("abort", cancel);
      }
      if (marker !== this.#marker || this.#running?.controller !== round || round.signal.aborted || controller.signal.aborted && controller.signal.reason !== "timeout")
        return;
      if (usesRange && range && this.rangeMetadata?.resolve(range.handle, range.identity) && this.rangeMetadata.catalogSourceHandle(range.identity.representation) === range.handle) {
        if (result.status === 416)
          this.rangeMetadata.recordRangeSize(range.identity, range.handle, null);
        else if (result.directRange && result.range)
          this.rangeMetadata.recordRangeSize(range.identity, range.handle, result.range.totalBytes);
      }
      const { ok, failure } = classifyProbeOutcome(applied, result);
      await this.routes.recordChallenge(
        applied,
        result.bytes,
        result.elapsedMs,
        result.ttfbMs,
        ok ? "success" : "failure",
        failure,
        () => !this.#disposed && marker === this.#marker && this.#running?.controller === round && !round.signal.aborted,
        result
      );
      if (marker !== this.#marker || this.#running?.controller !== round || round.signal.aborted)
        return;
      this.#snapshot = Object.freeze({
        state: ok ? "complete" : "failed",
        reason: ok ? "sample-recorded" : result.directRange ? "short-response" : result.reason,
        lastAttemptAt: startedAt,
        host: applied.decision.host,
        range: {
          mode: startByte > 0 ? "middle" : "head",
          sizeKnown: !!result.range || usesRange && range.sizeKnown
        }
      });
    }
    #unsafeReason(status) {
      if (status.disabled) return "disabled";
      if (!status.generationActive || !status.representation || !status.demand)
        return "no-representation";
      if (!status.visible) return "hidden";
      if (status.seeking) return "seeking";
      if (status.recovering) return "recovering";
      if (!["progress", "duplicate", "insufficient"].includes(status.progressObservation) || !stableProgress(status.stableProgressTicks, status.stableProgressMs, 20))
        return "awaiting-progress";
      if (status.playableBufferSec < 30) return "low-buffer";
      return null;
    }
  };

  // src-v2/domain/restore-policy.ts
  function restorePositionMatches(reading, anchor, now) {
    if (anchor) {
      if (reading.positionSec === null || reading.rate === null || reading.paused === null || reading.seeking !== false)
        return false;
      const elapsed = Math.max(0, now() - anchor.at) / 1e3;
      const oldRate = anchor.paused ? 0 : anchor.rate;
      const nextRate = reading.paused ? 0 : reading.rate;
      const low = anchor.positionSec + Math.min(oldRate, nextRate) * elapsed - 1;
      const high = anchor.positionSec + Math.max(oldRate, nextRate) * elapsed + 1;
      return Number.isFinite(low) && Number.isFinite(high) && reading.positionSec >= low && reading.positionSec <= high;
    }
    if (!reading.landing || reading.positionSec === null || reading.seeking !== false || reading.paused === null)
      return false;
    if (!reading.paused && reading.rate === null) return false;
    const expected = reading.landing.positionSec + (reading.paused ? 0 : reading.rate * Math.max(0, now() - reading.landing.at) / 1e3);
    return Math.abs(reading.positionSec - expected) <= 1;
  }
  __name(restorePositionMatches, "restorePositionMatches");
  function restorePositionMismatch(reading, targetSec, now) {
    return reading.positionSec !== null && reading.paused !== null && (reading.paused || reading.rate !== null) && Math.abs(
      reading.positionSec - (reading.landing ? reading.landing.positionSec + (reading.paused ? 0 : reading.rate * Math.max(0, now() - reading.landing.at) / 1e3) : targetSec)
    ) > 1;
  }
  __name(restorePositionMismatch, "restorePositionMismatch");
  function restoreProgressMatches(baseline, snapshot, now) {
    const elapsed = Math.max(0, now() - baseline.at) / 1e3;
    return snapshot.playbackRate === baseline.rate && Number.isFinite(snapshot.currentTime) && snapshot.currentTime >= baseline.positionSec - 1 && snapshot.currentTime <= baseline.positionSec + baseline.rate * elapsed + 1;
  }
  __name(restoreProgressMatches, "restoreProgressMatches");
  function restoreTransition(stage, event) {
    if (stage === "complete" || stage === "failed" || stage === "cancelled")
      return { next: stage, effects: [], reason: "terminal" };
    if (event === "cancel" || event === "fail")
      return {
        next: event === "cancel" ? "cancelled" : "failed",
        effects: ["finish"],
        reason: "accepted"
      };
    if (event === "verified") {
      if (stage === "position") return { next: "rate", effects: ["restore-rate"], reason: "accepted" };
      if (stage === "rate") return { next: "play", effects: ["play"], reason: "accepted" };
      if (stage === "play")
        return { next: "progress", effects: ["confirm-progress"], reason: "accepted" };
    }
    if (stage === "progress" && event === "progress-confirmed")
      return { next: "complete", effects: ["finish"], reason: "accepted" };
    return { next: stage, effects: [], reason: "illegal-event" };
  }
  __name(restoreTransition, "restoreTransition");

  // src-v2/application/playback/recovery-controller.ts
  function restored(token) {
    return token?.restore?.step.phase === "progress";
  }
  __name(restored, "restored");
  var RecoveryController = class {
    constructor(player, now, isActive = () => true, captureEligibility = () => () => true) {
      this.player = player;
      this.now = now;
      this.isActive = isActive;
      this.captureEligibility = captureEligibility;
    }
    player;
    now;
    isActive;
    captureEligibility;
    static {
      __name(this, "RecoveryController");
    }
    #pauseAt = 0;
    #hadHealthy = false;
    #lastHealthyTime = 0;
    #lastHealthyRate = 1;
    #startupReloaded = false;
    #token = null;
    #reloadCount = 0;
    #breakerUntil = 0;
    #stopIntent = null;
    #suppress = false;
    #lifecycleSerial = 0;
    #lastFrames = null;
    #lastSnapshot = null;
    #lastControls = null;
    #progressTicks = 0;
    #failedRestore = null;
    #state = Object.freeze({
      state: "healthy",
      source: null,
      pauseSec: 0,
      reloadCount: 0,
      breakerSec: 0
    });
    snapshot() {
      const restoration = this.#restoration();
      const token = this.#token;
      return Object.freeze({
        ...this.#state,
        ...restoration ? { restoration } : {},
        remainingReloads: Math.max(0, 2 - this.#reloadCount),
        deadlineAt: token ? token.firstProgressAt !== null ? token.firstProgressAt + 15e3 : token.reload.phase === "submitted" ? token.reload.at + 15e3 : token.stall ? token.stall.startedAt + (token.stall.reloadAfterMs ?? 3e4) : token.startedAt + (token.source === "startup-failure" ? 4e3 : 3e4) : void 0,
        nextAction: token ? token.restore?.step.phase === "play" ? "await-play" : token.restore ? "verify-restore" : token.reload.phase === "submitted" ? "await-core" : "await-reload-deadline" : "none"
      });
    }
    #restoration() {
      const token = this.#token, plan = token?.restore;
      return plan ? Object.freeze({
        phase: plan.step.phase,
        channel: plan.channel,
        result: plan.result
      }) : void 0;
    }
    isRecovering() {
      return !!this.#token;
    }
    ongoingStallReload(id2, snapshot, controls) {
      const token = this.#token;
      return !!token && token.stall?.id === id2 && this.isActive() && !snapshot.ended && !snapshot.mediaError && (this.#ownedReload(token, controls) || this.#acceptedReloadProgress(token, snapshot, controls));
    }
    reset() {
      if (this.#token) this.#finish("failed", "lifecycle-ended");
      this.#lifecycleSerial++;
      this.#lastFrames = null;
      this.#lastSnapshot = null;
      this.#lastControls = null;
      this.#progressTicks = 0;
      this.#failedRestore = null;
      this.#unhook();
      this.#pauseAt = 0;
      this.#hadHealthy = false;
      this.#lastHealthyTime = 0;
      this.#token = null;
      this.#reloadCount = 0;
      this.#breakerUntil = 0;
      this.#startupReloaded = false;
      this.#lastHealthyRate = 1;
      this.#state = Object.freeze({
        state: "healthy",
        source: null,
        pauseSec: 0,
        reloadCount: 0,
        breakerSec: 0
      });
    }
    armRouteFailure(source, snapshot, valid = () => true) {
      if (this.#token || snapshot.paused || snapshot.seeking || snapshot.ended || snapshot.mediaError || !this.#hadHealthy)
        return;
      this.#begin(source, true, valid);
    }
    armStall(snapshot, intent) {
      if (this.#token?.stall?.id === intent.id) return;
      const token = this.#token;
      if (token && !token.stall && ["route-failure", "watchdog"].includes(token.source) && snapshot.readyState === 0 && snapshot.width === 0 && snapshot.height === 0 && snapshot.coreInitialized === false && snapshot.manifestHasVideo && this.#owns(token, this.player.controls()))
        return;
      if (token && !token.stall && !snapshot.seeking && ["route-failure", "watchdog"].includes(token.source) && intent.valid() && this.#owns(token, this.player.controls()) && this.#token === token) {
        const previousValid = token.valid;
        token.stall = intent;
        token.valid = () => previousValid() && intent.valid();
        return;
      }
      if (this.#token !== token) return;
      if (this.#token) this.#finish("failed", "superseded-by-stall");
      if (!intent.valid() || snapshot.paused || snapshot.ended || snapshot.mediaError) return;
      this.#begin("stall", true, intent.valid, intent);
    }
    cancelStall(id2) {
      if (this.#token?.stall?.id === id2) this.#finish("failed", "stall-ended");
    }
    rejectStall() {
      this.#finish("failed", "no-legal-video-route");
    }
    armStartupFailure(snapshot, valid = this.captureEligibility()) {
      if (this.#token || this.#startupReloaded || snapshot.paused || snapshot.seeking || snapshot.ended || snapshot.mediaError || !snapshot.available || snapshot.playableBufferSec >= 1)
        return;
      this.#begin("startup-failure", true, valid);
    }
    tick(snapshot) {
      const now = this.now();
      const previous = this.#lastSnapshot, controls = this.player.controls();
      if (this.#failedRestore && comparePlaybackControls(controls, this.#failedRestore.controls) !== "same")
        this.#failedRestore = null;
      const token = this.#token, plan = token?.restore;
      const observation = restored(token) ? {
        attempt: token.restore.step.attempt,
        controls: token.controls,
        positionSec: token.restore.step.progress.positionSec,
        at: token.restore.step.progress.at,
        rate: token.savedRate
      } : this.#failedRestore;
      const native = observation ? this.player.readRestore(observation.attempt, "progress") : null;
      let known = !observation || !!native?.owned && native.positionSec !== null && native.rate !== null && native.paused !== null && native.seeking !== null;
      const observed = native && known ? {
        ...snapshot,
        currentTime: native.positionSec,
        playbackRate: native.rate,
        paused: native.paused,
        seeking: native.seeking
      } : snapshot;
      if (observation && !token && known && !this.#matchesRestoreProgress(observation, observed))
        known = false;
      if (restored(token) && plan)
        plan.result = !known ? "unknown" : this.#matchesRestoreProgress(observation, observed) ? "verified" : "mismatch";
      const { progress, newFrames } = this.#recordProgress(observed, previous, controls, known);
      if (this.#endInvalidToken(observed, controls, now)) return;
      if (this.#token?.firstProgressAt !== null && this.#token?.firstProgressAt !== void 0 && now - this.#token.firstProgressAt >= 15e3) {
        this.#finish("failed", "progress-not-sustained");
        return;
      }
      const healthy = this.#observeCoreHealth(observed, newFrames);
      if (healthy && known) this.#acceptHealthy(observed, controls);
      this.#observePause(observed, healthy, now);
      this.#advanceToken(observed, progress, now, known);
    }
    #recordProgress(snapshot, previous, controls, known = true) {
      const sameControls = comparePlaybackControls(controls, this.#lastControls) === "same";
      const newFrames = snapshot.frames !== null && this.#lastFrames !== null && playbackFramesAdvanced(snapshot.frames, this.#lastFrames);
      const progress = known && !!previous && sameControls && !previous.seeking && !snapshot.seeking && !snapshot.paused && !snapshot.ended && !snapshot.mediaError && playbackTimeAdvanced(snapshot.currentTime, previous.currentTime) && (snapshot.frames === null || newFrames);
      this.#progressTicks = progress ? this.#progressTicks + 1 : 0;
      this.#lastFrames = known ? snapshot.frames : null;
      this.#lastSnapshot = known ? snapshot : null;
      this.#lastControls = controls;
      return { progress, newFrames };
    }
    #endInvalidToken(snapshot, controls, now) {
      if (this.#token && (snapshot.mediaError || snapshot.seeking && !this.#token.stall && !this.#initializationOwned(this.#token, controls) || snapshot.ended)) {
        this.#finish(
          "failed",
          snapshot.mediaError ? "media-error" : snapshot.seeking ? "seek-interrupted" : "ended"
        );
        return true;
      }
      if (this.#token?.reload.phase === "submitted" && this.#token.firstProgressAt === null && now - this.#token.reload.at >= 15e3) {
        this.#breakerUntil = now + 9e4;
        this.#finish("failed", "reload-timeout");
        return true;
      }
      if (this.#token && (!this.isActive() || !this.#owns(this.#token, controls))) {
        this.#finish("failed", "ownership-ended");
        return true;
      }
      return false;
    }
    #observeCoreHealth(snapshot, newFrames) {
      const healthy = snapshot.available && !snapshot.mediaError && (snapshot.readyState >= 2 || snapshot.width > 0 || snapshot.height > 0 || newFrames);
      return healthy;
    }
    #acceptHealthy(snapshot, controls) {
      this.#hadHealthy = true;
      this.#lastHealthyTime = snapshot.currentTime;
      this.#lastHealthyRate = snapshot.playbackRate > 0 ? snapshot.playbackRate : 2;
      if (!this.#token && this.#progressTicks >= 2 && ["failed", "breaker"].includes(this.#state.state))
        this.#finish("recovered", "playback-progress-observed");
      if (this.#token) {
        const ownedReload = this.#ownedReload(this.#token, controls);
        const restoreReady = (!this.#token.positionCapture.proof || !snapshot.seeking) && (!ownedReload || controls.coreId !== 0 && controls.coreReloadRevision === this.#token.reload.revision && snapshot.coreInitialized !== false);
        if (this.#token.reload.phase === "submitted" && !restored(this.#token) && restoreReady)
          this.#restore(this.#token, snapshot);
        else if (this.#progressTicks >= 2 && (this.#token.reload.phase !== "submitted" || restored(this.#token)) && this.#restoredProgressValid(this.#token, snapshot))
          this.#finish("recovered");
      }
    }
    #observePause(snapshot, healthy, now) {
      if (snapshot.paused && !snapshot.seeking && !snapshot.ended && this.#hadHealthy && !this.#token) {
        if (!this.#pauseAt) this.#pauseAt = now;
        this.#hook();
        if (!["failed", "breaker"].includes(this.#state.state))
          this.#state = Object.freeze({
            state: "pause-armed",
            source: null,
            pauseSec: Math.floor((now - this.#pauseAt) / 1e3),
            reloadCount: this.#reloadCount,
            breakerSec: Math.max(0, Math.ceil((this.#breakerUntil - now) / 1e3))
          });
        else
          this.#state = Object.freeze({
            ...this.#state,
            breakerSec: Math.max(0, Math.ceil((this.#breakerUntil - now) / 1e3))
          });
      } else if (!snapshot.paused && this.#pauseAt && !this.#token) {
        const wasLong = now - this.#pauseAt >= 3e4;
        this.#pauseAt = 0;
        this.#unhook();
        if (wasLong) this.#begin("paused-transition", true);
        else if (healthy && this.#state.state === "pause-armed")
          this.#state = Object.freeze({
            state: "healthy",
            source: null,
            pauseSec: 0,
            reloadCount: this.#reloadCount,
            breakerSec: Math.max(0, Math.ceil((this.#breakerUntil - now) / 1e3))
          });
      }
    }
    #advanceToken(snapshot, progress, now, restoreKnown = true) {
      const token = this.#token;
      if (!token) return;
      if (snapshot.mediaError || snapshot.seeking && !token.stall && !this.#initializationOwned(token, this.player.controls()) || snapshot.ended) {
        this.#finish(
          "failed",
          snapshot.mediaError ? "media-error" : snapshot.seeking ? "seek-interrupted" : "ended"
        );
        return;
      }
      if (snapshot.paused && token.stall && !this.#ownedReload(token, this.player.controls())) {
        this.#finish("failed", "paused");
        return;
      }
      if (restored(token) && now <= token.restore.step.progress.restoredAt) return;
      if (token.reload.phase === "submitted" && !restored(token)) progress = false;
      if (restored(token) && restoreKnown && !this.#restoredProgressValid(token, snapshot)) {
        this.#finish("failed", "restore-mismatch");
        return;
      }
      if (progress && (!restored(token) || now > token.restore.step.progress.restoredAt)) {
        token.firstProgressAt ??= now;
        return;
      }
      if (token.firstProgressAt !== null) {
        if (now - token.firstProgressAt >= 15e3) this.#finish("failed", "progress-not-sustained");
        return;
      }
      const dead = snapshot.readyState === 0 && snapshot.width === 0 && snapshot.height === 0 && snapshot.manifestHasVideo && snapshot.coreInitialized === false;
      const startupStalled = token.source === "startup-failure" && snapshot.playableBufferSec < 1 && snapshot.currentTime <= token.baselinePositionSec + 0.05 && (snapshot.frames === null || token.baselineFrames === null || snapshot.frames <= token.baselineFrames);
      if (token.reload.phase !== "submitted" && (token.stall ? now - token.stall.startedAt >= (token.stall.reloadAfterMs ?? 3e4) : (dead || startupStalled) && now - token.startedAt >= 4e3 || now - token.startedAt >= 3e4))
        this.#reload(token);
      if (token.reload.phase === "submitted" && now - token.reload.at >= 15e3) {
        this.#breakerUntil = now + 9e4;
        this.#finish("failed", "reload-timeout");
      }
    }
    dispose() {
      this.reset();
    }
    #hook() {
      this.#unhook();
      this.#stopIntent = this.player.observePlayIntent(() => {
        if (!this.#suppress && this.#pauseAt && this.now() - this.#pauseAt >= 3e4)
          this.#begin("trusted-player-play", true);
      });
    }
    #unhook() {
      this.#stopIntent?.();
      this.#stopIntent = null;
    }
    #begin(source, wasPlaying, valid = this.captureEligibility(), stall = null) {
      const lifecycle = this.#lifecycleSerial, before = this.player.controls();
      if (this.#token || before.dragging || !this.isActive() || !valid() || this.now() < this.#breakerUntil || this.#reloadCount >= 2)
        return;
      const positionCapture = this.player.captureResumePosition(), position = positionCapture.proof ? positionCapture.positionSec : stall?.targetSec ?? positionCapture.positionSec, rate = this.player.playbackRate();
      const snapshot = this.player.snapshot(), now = this.now();
      const positionValid = this.player.validateResumePosition(positionCapture), controls = this.player.controls(), eligible = positionValid && this.isActive() && valid();
      if (!eligible || this.#lifecycleSerial !== lifecycle || this.#token || controls.dragging || now < this.#breakerUntil || this.#reloadCount >= 2 || snapshot.ended || snapshot.mediaError || controls.mediaId !== before.mediaId || controls.coreId !== before.coreId || controls.seekRevision !== before.seekRevision || controls.userRevision !== before.userRevision)
        return;
      this.#failedRestore = null;
      this.#token = {
        positionCapture,
        source,
        startedAt: now,
        savedPositionSec: Math.max(0, Number.isFinite(position) ? position : this.#lastHealthyTime),
        savedRate: rate > 0 ? rate : this.#lastHealthyRate || 1,
        wasPlaying,
        baselinePositionSec: snapshot.currentTime,
        baselineFrames: snapshot.frames,
        reload: { phase: "waiting", revision: null },
        controls,
        valid,
        stall,
        firstProgressAt: null,
        initiallyPaused: snapshot.paused,
        restorePosition: true,
        restore: null
      };
      this.#state = Object.freeze({
        state: "play-intent",
        source,
        pauseSec: this.#pauseAt ? Math.floor((now - this.#pauseAt) / 1e3) : 0,
        reloadCount: this.#reloadCount,
        breakerSec: 0
      });
    }
    #reload(token) {
      if (!this.#owns(token, this.player.controls()) || !this.isActive()) {
        this.#finish("failed", "ownership-ended");
        return;
      }
      if (this.now() < this.#breakerUntil || this.#reloadCount >= 2) {
        this.#finish("breaker");
        return;
      }
      let prepared;
      try {
        prepared = this.player.prepareReload();
      } catch (error) {
        if (this.#token === token)
          this.#finish(
            "failed",
            error instanceof Error && error.message.includes("ownership ended") ? "ownership-ended" : "reload-unavailable"
          );
        return;
      }
      const ready = /* @__PURE__ */ __name(() => {
        try {
          return prepared?.valid() === true;
        } catch {
          return false;
        }
      }, "ready");
      if (this.#token !== token) return;
      if (!prepared || !ready()) {
        if (this.#token === token) this.#finish("failed", "reload-unavailable");
        return;
      }
      if (!this.#owns(token, this.player.controls()) || !this.isActive() || !ready()) {
        if (this.#token === token) this.#finish("failed", "ownership-ended");
        return;
      }
      const lifecycle = this.#lifecycleSerial;
      if (!this.#owns(token, this.player.controls())) return;
      try {
        const before = this.player.controls();
        if (!this.#owns(token, before)) return;
        token.reload = {
          phase: "prepared",
          revision: Number.isSafeInteger(before.reloadRevision) ? before.reloadRevision + 1 : null
        };
        const result = prepared.dispatch(() => {
          if (!this.#owns(token, this.player.controls()) || !this.isActive() || !ready() || this.#token !== token)
            return false;
          token.reload = { phase: "submitted", revision: token.reload.revision, at: this.now() };
          this.#reloadCount++;
          if (token.source === "startup-failure") this.#startupReloaded = true;
          this.#breakerUntil = this.now() + 9e4;
          return true;
        });
        if (result !== null && (typeof result === "object" || typeof result === "function"))
          void Promise.resolve(result).catch(() => {
            if (this.#lifecycleSerial === lifecycle && this.#token === token)
              this.#finish("failed", "reload-rejected");
          });
      } catch (error) {
        if (this.#token === token)
          this.#finish(
            "failed",
            error instanceof Error && error.message === "player.reload unavailable" ? "reload-unavailable" : "reload-threw"
          );
        return;
      }
      if (this.#token === token && this.#owns(token, this.player.controls()))
        this.#state = Object.freeze({
          state: "reloading",
          savedPositionSec: token.savedPositionSec,
          savedRate: token.savedRate,
          source: token.source,
          pauseSec: 0,
          reloadCount: this.#reloadCount,
          breakerSec: 0
        });
    }
    #restoreReady(token) {
      if (token.reload.phase !== "submitted") return false;
      if (this.now() - token.reload.at >= 15e3) {
        this.#breakerUntil = this.now() + 9e4;
        this.#finish("failed", "reload-timeout");
        return false;
      }
      if (this.#token !== token || !this.isActive() || !this.#owns(token, this.player.controls())) {
        if (this.#token === token) this.#finish("failed", "ownership-ended");
        return false;
      }
      return true;
    }
    #advanceRestore(plan, next) {
      const transition = restoreTransition(plan.step.phase, "verified");
      if (transition.reason !== "accepted" || transition.next !== next.phase) return false;
      plan.step = next;
      return true;
    }
    #positionMatches(reading, plan) {
      const anchor = plan?.step.phase === "rate" ? plan.step.positionBaseline : null;
      return restorePositionMatches(reading, anchor, () => this.now());
    }
    #restore(token, snapshot) {
      if (!this.#restoreReady(token)) return;
      token.restore ??= {
        targetSec: snapshot.duration ? Math.min(token.savedPositionSec, Math.max(0, snapshot.duration - 0.1)) : token.savedPositionSec,
        step: {
          phase: token.restorePosition ? "position" : "rate",
          attempt: null,
          positionAttempt: null,
          positionBaseline: null,
          issuedAt: 0
        },
        nativeUsed: { position: false, rate: false },
        channel: "none",
        result: "unknown"
      };
      const plan = token.restore;
      if (plan.step.phase === "progress" || plan.step.phase === "play") return;
      const valid = /* @__PURE__ */ __name(() => this.#token === token && this.isActive() && token.reload.phase === "submitted" && this.now() - token.reload.at < 15e3 && this.#owns(token, this.player.controls()), "valid");
      try {
        for (let step = 0; step < 2; step++) {
          if (!this.#restoreReady(token)) return;
          if (plan.step.phase !== "position" && plan.step.phase !== "rate") return;
          if (!token.restorePosition && plan.step.phase === "position") {
            if (!this.#advanceRestore(plan, { ...plan.step, phase: "rate", attempt: null })) return;
          }
          if (!plan.step.attempt) {
            if (plan.step.phase === "rate" && plan.step.positionAttempt) {
              const beforeRate = this.player.readRestore(plan.step.positionAttempt);
              if (!beforeRate.owned || !this.#positionMatches(beforeRate, plan) || !this.#restoreReady(token) || beforeRate.positionSec === null || beforeRate.rate === null || beforeRate.paused === null)
                return;
              plan.step.positionBaseline = {
                positionSec: beforeRate.positionSec,
                at: this.now(),
                rate: beforeRate.rate,
                paused: beforeRate.paused
              };
            }
            plan.step.issuedAt = this.now();
            plan.step.attempt = this.player.performRestore(
              {
                kind: plan.step.phase,
                value: plan.step.phase === "position" ? plan.targetSec : token.savedRate,
                at: plan.step.issuedAt
              },
              { reloadRevision: token.reload.revision ?? -1, valid, now: this.now }
            );
            if (plan.step.phase === "position") plan.step.positionAttempt = plan.step.attempt;
          }
          if (!this.#restoreReady(token)) return;
          let reading = this.player.readRestore(plan.step.attempt);
          plan.channel = reading.channel;
          plan.result = reading.status === "pending" ? "pending" : "unknown";
          if (!reading.owned || !this.#restoreReady(token)) return;
          const correct = /* @__PURE__ */ __name(() => plan.step.phase === "position" ? this.#positionMatches(reading) : reading.rate === token.savedRate && reading.seeking === false && reading.positionSec !== null, "correct");
          if (!correct()) {
            if (reading.positionSec !== null && reading.rate !== null && reading.status !== "pending")
              plan.result = "mismatch";
            if (reading.channel === "native") {
              plan.nativeUsed[plan.step.phase] = true;
            }
            const used = plan.nativeUsed[plan.step.phase];
            const known = plan.step.phase === "position" ? restorePositionMismatch(reading, plan.targetSec, () => this.now()) : reading.rate !== null && reading.rate !== token.savedRate;
            if (!used && known && (plan.step.phase === "position" || this.#positionMatches(reading, plan)) && reading.status !== "pending" && reading.seeking === false && reading.readyState !== null && reading.readyState >= 1 && this.now() - plan.step.issuedAt >= 1e3) {
              plan.nativeUsed[plan.step.phase] = true;
              if (!this.#restoreReady(token)) return;
              this.player.correctRestore(plan.step.attempt);
              if (!this.#restoreReady(token)) return;
              reading = this.player.readRestore(plan.step.attempt);
              plan.channel = reading.channel;
            }
            if (!reading.owned || !correct()) return;
          }
          plan.result = "verified";
          if (plan.step.phase === "position") {
            if (reading.positionSec === null || reading.rate === null || reading.paused === null)
              return;
            plan.step.positionBaseline = {
              positionSec: reading.positionSec,
              at: this.now(),
              rate: reading.rate,
              paused: reading.paused
            };
            if (!this.#advanceRestore(plan, { ...plan.step, phase: "rate", attempt: null })) return;
            continue;
          }
          if (plan.step.positionAttempt && !this.#positionMatches(this.player.readRestore(plan.step.positionAttempt), plan))
            return;
          if (reading.positionSec === null || reading.rate === null || reading.paused === null) return;
          plan.step.positionBaseline = {
            positionSec: reading.positionSec,
            at: this.now(),
            rate: reading.rate,
            paused: reading.paused
          };
          this.#resumeVerified(token, plan.step.attempt);
          return;
        }
      } catch {
        if (this.#token === token) this.#finish("failed", "restore-threw");
      }
    }
    #resumeVerified(token, rateAttempt) {
      if (!this.#restoreReady(token)) return;
      const beforePlay = this.player.readRestore(rateAttempt);
      if (!beforePlay.owned || beforePlay.positionSec === null || beforePlay.rate !== token.savedRate || beforePlay.paused === null || beforePlay.seeking !== false || !this.#restoreReady(token))
        return;
      const beforePosition = beforePlay.positionSec;
      if (!this.#advanceRestore(token.restore, {
        phase: "play",
        attempt: rateAttempt,
        issuedAt: token.restore.step.issuedAt
      }))
        return;
      const playAt = this.now();
      const lifecycle = this.#lifecycleSerial;
      let playResult;
      if (token.wasPlaying) {
        this.#suppress = true;
        try {
          playResult = this.player.play(() => this.#restoreReady(token));
        } catch {
          if (this.#token === token) this.#finish("recovered-paused", "play-threw");
          return;
        } finally {
          this.#suppress = false;
        }
      }
      const complete = /* @__PURE__ */ __name(() => {
        if (token.restore?.step.phase !== "play" || !this.#restoreReady(token)) return;
        const reading = this.player.readRestore(rateAttempt);
        if (!reading.owned || reading.rate !== null && reading.rate !== token.savedRate || reading.positionSec !== null && Math.abs(
          reading.positionSec - beforePosition - (reading.paused ? 0 : token.savedRate * Math.max(0, this.now() - playAt) / 1e3)
        ) > 1) {
          if (this.#token === token) this.#finish("failed", "restore-mismatch");
          return;
        }
        const baseline = this.player.snapshot(), controls = this.player.controls();
        if (!this.#restoreReady(token)) return;
        const restoredAt = this.now();
        if (!this.#advanceRestore(token.restore, {
          phase: "progress",
          attempt: rateAttempt,
          issuedAt: token.restore.step.issuedAt,
          progress: { positionSec: beforePosition, at: playAt, restoredAt }
        }))
          return;
        token.restore.result = reading.positionSec === null || reading.rate === null ? "unknown" : "verified";
        this.#lastSnapshot = {
          ...baseline,
          currentTime: reading.positionSec ?? beforePosition,
          playbackRate: token.savedRate
        };
        this.#lastFrames = baseline.frames;
        this.#lastControls = controls;
        this.#progressTicks = 0;
        this.#state = Object.freeze({
          state: "waiting",
          source: token.source,
          pauseSec: 0,
          reloadCount: this.#reloadCount,
          breakerSec: 0,
          savedPositionSec: token.savedPositionSec,
          savedRate: token.savedRate
        });
      }, "complete");
      if (playResult !== null && (typeof playResult === "object" || typeof playResult === "function")) {
        token.restore.result = "pending";
        this.#state = Object.freeze({ ...this.#state, state: "waiting" });
        void Promise.resolve(playResult).then(
          () => {
            if (this.#lifecycleSerial === lifecycle && this.#token === token && this.#owns(token, this.player.controls()))
              complete();
          },
          () => {
            if (this.#lifecycleSerial === lifecycle && this.#token === token && this.#owns(token, this.player.controls()))
              this.#finish("recovered-paused", "play-rejected");
          }
        );
        const actual = this.player.readRestore(rateAttempt);
        if (actual.owned && actual.paused === false && actual.rate === token.savedRate && actual.positionSec !== null)
          complete();
        return;
      }
      complete();
    }
    #restoredProgressValid(token, snapshot) {
      if (!restored(token)) return true;
      return this.#matchesRestoreProgress(
        {
          attempt: token.restore.step.attempt,
          controls: token.controls,
          positionSec: token.restore.step.progress.positionSec,
          at: token.restore.step.progress.at,
          rate: token.savedRate
        },
        snapshot
      );
    }
    #matchesRestoreProgress(baseline, snapshot) {
      return restoreProgressMatches(baseline, snapshot, () => this.now());
    }
    #owns(token, _observed) {
      const snapshot = this.player.snapshot();
      const eligible = this.isActive() && token.valid(), controls = this.player.controls();
      const ownedReload = this.#ownedReload(token, controls);
      const stillEligible = this.isActive() && token.valid(), positionValid = this.player.validateResumePosition(token.positionCapture), current = this.player.controls();
      if (this.#token !== token || !eligible || !stillEligible || !positionValid || controls.userRevision !== current.userRevision || controls.seekRevision !== current.seekRevision || controls.mediaId !== current.mediaId || controls.coreId !== current.coreId || controls.reloadRevision !== current.reloadRevision || current.dragging)
        return false;
      if (ownedReload) {
        if (controls.seekRevision !== token.controls.seekRevision && !this.#initializationOwned(token, controls))
          token.restorePosition = false;
        token.controls = {
          ...controls,
          coreId: controls.coreId === 0 ? token.controls.coreId : controls.coreId
        };
      }
      return this.#token === token && eligible && !controls.dragging && !snapshot.ended && !snapshot.mediaError && (!snapshot.paused || token.initiallyPaused || ownedReload) && controls.mediaId === token.controls.mediaId && (controls.coreId === token.controls.coreId || ownedReload) && controls.userRevision === token.controls.userRevision && controls.seekRevision === token.controls.seekRevision;
    }
    #ownedReload(token, controls) {
      const revision2 = token.reload.revision;
      return this.#token === token && token.reload.phase === "submitted" && revision2 !== null && controls.reloadRevision === revision2 && controls.mediaId === token.controls.mediaId && controls.userRevision === token.controls.userRevision && !controls.dragging && (controls.coreId === token.controls.coreId || controls.coreId === 0 || controls.coreReloadRevision === revision2) && this.player.ownedReload?.(revision2) === true && this.#token === token;
    }
    #initializationOwned(token, controls) {
      return token.positionCapture.proof !== null && token.reload.revision !== null && this.#ownedReload(token, controls) && this.player.validateResumePosition(token.positionCapture, token.reload.revision);
    }
    #acceptedReloadProgress(token, snapshot, controls) {
      return this.#token === token && restored(token) && token.firstProgressAt !== null && token.reload.revision !== null && this.now() - token.firstProgressAt <= 15e3 && snapshot.available && !snapshot.paused && !snapshot.seeking && !snapshot.ended && !snapshot.mediaError && !controls.dragging && controls.coreId !== 0 && controls.mediaId === token.controls.mediaId && controls.coreId === token.controls.coreId && controls.userRevision === token.controls.userRevision && controls.seekRevision === token.controls.seekRevision && controls.reloadRevision === token.reload.revision;
    }
    #finish(state, reason = state) {
      const token = this.#token;
      const observedRestoration = this.#restoration();
      const restoration = observedRestoration && reason === "restore-mismatch" ? Object.freeze({ ...observedRestoration, result: "mismatch" }) : observedRestoration;
      this.#failedRestore = state === "failed" && token?.restore?.step.attempt ? Object.freeze({
        attempt: token.restore.step.attempt,
        controls: Object.freeze({ ...token.controls }),
        positionSec: token.restore.step.phase === "progress" ? token.restore.step.progress.positionSec : token.restore.targetSec,
        at: token.restore.step.phase === "progress" ? token.restore.step.progress.at : token.restore.step.issuedAt,
        rate: token.savedRate
      }) : null;
      this.#token = null;
      this.#pauseAt = 0;
      this.#unhook();
      this.#state = Object.freeze({
        state,
        reason,
        ...token ? { savedPositionSec: token.savedPositionSec, savedRate: token.savedRate } : {},
        ...restoration ? { restoration } : {},
        source: token?.source ?? null,
        pauseSec: 0,
        reloadCount: this.#reloadCount,
        breakerSec: Math.max(0, Math.ceil((this.#breakerUntil - this.now()) / 1e3))
      });
    }
  };

  // src-v2/application/playback/player-monitor.ts
  var PlayerMonitor = class {
    constructor(player, session, settings, vault, routes, measurement, recovery, isVisible, now, scheduler, earlyRetry, monotonicNow = () => null) {
      this.player = player;
      this.session = session;
      this.settings = settings;
      this.vault = vault;
      this.routes = routes;
      this.measurement = measurement;
      this.recovery = recovery;
      this.isVisible = isVisible;
      this.now = now;
      this.scheduler = scheduler;
      this.earlyRetry = earlyRetry;
      this.monotonicNow = monotonicNow;
      this.#snapshot = Object.freeze({
        video: player.snapshot(),
        stableProgressTicks: 0,
        stableProgressMs: 0,
        progressObservation: "insufficient",
        recoveryActive: false,
        watchdog: "no-video",
        stallTicks: 0,
        startupRescue: { state: "watching", ageSec: 0 }
      });
    }
    player;
    session;
    settings;
    vault;
    routes;
    measurement;
    recovery;
    isVisible;
    now;
    scheduler;
    earlyRetry;
    monotonicNow;
    static {
      __name(this, "PlayerMonitor");
    }
    #timer = null;
    #progress = { baseline: null, ticks: 0, elapsedMs: 0 };
    #observation = "insufficient";
    #stallTicks = 0;
    #lastRecoveryAt = 0;
    #seekGraceUntil = 0;
    #manifestTick = 0;
    #manifestReady = false;
    #startupRescue = { phase: "available" };
    #startupObservedProgress = false;
    #startupRescueState = "watching";
    #snapshot;
    #controls = null;
    #stall = null;
    #stallSerial = 0;
    #failedStall = null;
    #listeners = /* @__PURE__ */ new Set();
    start() {
      if (this.#timer === null) {
        this.#timer = this.scheduler.interval(() => this.tick(), 1e3);
        this.tick();
      }
    }
    stop() {
      this.earlyRetry?.cancel("monitor-stop");
      this.#timer?.();
      this.#timer = null;
      this.#endStall();
      this.measurement.cancel("monitor-stop");
    }
    reset() {
      this.earlyRetry?.reset();
      this.#progress = { baseline: null, ticks: 0, elapsedMs: 0 };
      this.#observation = "insufficient";
      this.#stallTicks = 0;
      this.#lastRecoveryAt = 0;
      this.#seekGraceUntil = 0;
      this.#manifestTick = 0;
      this.#manifestReady = false;
      this.#startupRescue = { phase: "available" };
      this.#startupObservedProgress = false;
      this.#startupRescueState = "watching";
      this.#endStall();
      this.#controls = null;
      this.#failedStall = null;
    }
    snapshot() {
      return this.#snapshot;
    }
    dispose() {
      this.stop();
      this.#listeners.clear();
    }
    subscribe(listener) {
      this.#listeners.add(listener);
      return () => this.#listeners.delete(listener);
    }
    tick() {
      const playbackOwner = this.session.get(), playbackRequest = this.routes.latestRequested("video");
      const sampledTick = readMonotonic(this.monotonicNow), playbackRevision = this.player.playbackRevision?.() ?? 0;
      const video = this.player.snapshot(), controls = this.player.controls(), now = this.now(), disabled = this.settings.get().disabled;
      const visible = this.isVisible();
      this.routes.observePlaybackRate(video.available ? video.playbackRate : 0);
      if (!this.#manifestReady || this.#manifestTick++ % 5 === 0)
        this.#manifestReady = this.player.syncManifest();
      const sample = {
        ...controls,
        at: sampledTick,
        position: video.currentTime,
        frames: video.frames,
        seeking: video.seeking,
        active: !disabled && visible && video.available && !video.paused && !video.ended && !video.mediaError && !controls.dragging,
        playbackRevision: this.player.playbackRevision?.() ?? 0,
        generation: playbackOwner.generation,
        epoch: playbackOwner.epoch,
        representation: playbackRequest?.representation ?? playbackOwner.representation
      };
      const sampled = samplePlaybackProgress(this.#progress, sample);
      this.#progress = sampled.next;
      this.#observation = sampled.observation;
      const { advanced } = sampled;
      const progress = sampled.observation === "progress" || sampled.observation === "gap-progress";
      if (progress) {
        this.#startupObservedProgress = true;
        if (this.#startupRescue.phase !== "committed") this.#startupRescueState = "not-needed";
      }
      const { active, ownedReload } = this.#advanceStall(
        video,
        controls,
        now,
        disabled,
        visible,
        progress
      );
      const firstMediaAt = this.routes.firstMediaAt("video");
      const watchdog = this.#observeWatchdog(video, controls, now, progress, advanced, ownedReload);
      if (!this.#stall && !this.#failedStall && !this.recovery.isRecovering() && !controls.dragging && !disabled && visible && watchdog === "recovering" && this.#observation === "stalled" && (this.#startupObservedProgress || !firstMediaAt) && now - this.#lastRecoveryAt >= 3e4) {
        const state = this.session.get(), rep = state.representation;
        if (rep) {
          this.routes.recover(
            rep,
            this.#demand(video),
            "watchdog",
            state.affinity?.host ?? null,
            this.routes.latestRequested("video")?.expectedBytes ?? null
          );
          this.#lastRecoveryAt = now;
        }
      }
      const startupAge = this.#observeStartup(video, controls, now, disabled, visible, firstMediaAt);
      const demand = this.#demand(video);
      this.measurement.tick({
        generationActive: true,
        representation: this.session.get().representation,
        demand,
        stableProgressTicks: this.#progress.ticks,
        stableProgressMs: this.#progress.elapsedMs,
        progressObservation: this.#observation,
        playableBufferSec: video.playableBufferSec,
        visible,
        seeking: video.seeking || now < this.#seekGraceUntil,
        recovering: this.recovery.isRecovering(),
        disabled
      });
      const retrySettings = this.settings.get();
      this.earlyRetry?.tick({
        enabled: retrySettings.earlyRetryEnabled === true,
        disabled,
        catalogOnly: !retrySettings.considerNativeSources,
        fixedHost: !!retrySettings.fixedHost,
        visible,
        recovering: this.recovery.isRecovering(),
        stallPending: !!this.#stall && this.#stall.progress.phase !== "stable-retained",
        progressObservation: this.#observation,
        sampledTick,
        stableProgressTicks: this.#progress.ticks,
        stableProgressMs: this.#progress.elapsedMs,
        video,
        controls,
        demand
      });
      const routingPlayback = sampledTick !== null && playbackRevision === (this.player.playbackRevision?.() ?? 0) && Number.isFinite(video.playbackRate) && video.playbackRate > 0 && !disabled && visible && video.available && !video.paused && !video.seeking && !video.ended && !video.mediaError && !controls.dragging && playbackRequest && playbackOwner === this.session.get() && playbackOwner.representation === playbackRequest.representation ? {
        generation: playbackRequest.generation,
        epoch: playbackRequest.epoch,
        representation: playbackRequest.representation,
        routePolicyRevision: playbackRequest.routePolicyRevision,
        ...playbackRequest.authorityRevision !== void 0 ? { authorityRevision: playbackRequest.authorityRevision } : {},
        ...playbackRequest.selectionRevision !== void 0 ? { selectionRevision: playbackRequest.selectionRevision } : {},
        sampledAt: now,
        sampledTick,
        playbackRate: video.playbackRate,
        bufferAheadSec: video.bufferAheadSec,
        playbackRevision,
        playableBufferSec: video.playableBufferSec
      } : null;
      this.#publishSnapshot(video, controls, active, watchdog, startupAge, routingPlayback);
    }
    #advanceStall(video, controls, now, disabled, visible, progress) {
      const recoveryTicked = !disabled && this.#stall?.action === "armed" && this.recovery.isRecovering();
      if (recoveryTicked) this.recovery.tick(video);
      if (this.#stall?.action === "armed" && !this.recovery.isRecovering() && this.recovery.snapshot().reloadCount > this.#stall.reloadCount && ["failed", "breaker", "recovered-paused"].includes(this.recovery.snapshot().state)) {
        this.#failedStall = { userRevision: this.#stall.userRevision, mediaId: this.#stall.mediaId };
      }
      if (progress && stableProgress(this.#progress.ticks, this.#progress.elapsedMs, 10) && video.playableBufferSec >= 10 || this.#failedStall && (this.#failedStall.userRevision !== controls.userRevision || this.#failedStall.mediaId !== controls.mediaId))
        this.#failedStall = null;
      const ownedReload = !!this.#stall && this.recovery.ongoingStallReload(this.#stall.id, video, controls);
      const active = !disabled && visible && video.available && (!video.paused || ownedReload) && !video.ended && !video.mediaError && !controls.dragging;
      if (!active) this.#endStall();
      else if (this.#observation === "progress") {
        if (this.#stall) {
          const stall = this.#stall;
          const transition = stallProgressTransition(
            stall.progress,
            "progress",
            video.playableBufferSec,
            this.#progress.elapsedMs
          );
          stall.progress = transition.next;
          if (transition.complete) this.#endStall();
        }
      } else if (!ownedReload && this.#observation === "stalled" && (this.#startupObservedProgress || video.seeking || controls.pendingSeekGoal))
        this.#observeStall(video, controls, now);
      else if (this.#stall && ["gap-progress", "clock-invalid", "owner-changed"].includes(this.#observation)) {
        this.#stall.progress = { phase: "settling", ticks: 0 };
        if (this.#observation === "owner-changed" && !ownedReload)
          this.#observeStall(video, controls, now, false);
      }
      if (!disabled && !recoveryTicked) this.recovery.tick(video);
      if (this.#stall?.action === "armed" && !this.recovery.isRecovering())
        this.#stall.action = "spent";
      return { active, ownedReload };
    }
    #observeWatchdog(video, controls, now, progress, advanced, ownedReload) {
      const fallbackAfter = this.#stall?.longSeek === false ? 6e3 : 15e3;
      let watchdog = "healthy";
      if (!video.available) {
        watchdog = "no-video";
        this.#stallTicks = 0;
      } else if (controls.dragging) {
        watchdog = "seek-grace";
        this.#stallTicks = 0;
      } else if (progress) {
        watchdog = "healthy";
        this.#stallTicks = 0;
      } else if (ownedReload) {
        watchdog = "recovering";
        this.#stallTicks = 0;
      } else if (video.paused || video.ended) {
        watchdog = "paused";
        this.#stallTicks = 0;
      } else if (this.#observation !== "stalled") {
        watchdog = "observing";
      } else if (video.seeking && (!this.#stall || now - this.#stall.startedAt < fallbackAfter)) {
        watchdog = "seek-grace";
        this.#stallTicks = 0;
      } else if (this.#stall && now - this.#stall.startedAt >= fallbackAfter) {
        watchdog = "recovering";
        this.#stallTicks = Math.floor((now - this.#stall.startedAt) / 1e3);
      } else if (video.bufferedToEnd) {
        watchdog = "buffered-to-end";
        this.#stallTicks = 0;
      } else if (advanced || video.playableBufferSec >= 2 || video.readyState >= 3) {
        watchdog = "healthy";
        this.#stallTicks = 0;
      } else {
        this.#stallTicks++;
        watchdog = this.#stallTicks >= 6 ? "recovering" : "low-buffer";
      }
      return watchdog;
    }
    #observeStartup(video, controls, now, disabled, visible, firstMediaAt) {
      const startupAge = firstMediaAt ? Math.max(0, now - firstMediaAt) : 0;
      if (!controls.dragging && !disabled && visible && firstMediaAt && startupAge >= 15e3 && this.#observation === "stalled" && this.#startupRescue.phase !== "committed" && !this.#startupObservedProgress && video.available && !video.paused && !video.seeking && !video.ended && !video.mediaError && video.playableBufferSec < 1 && !this.recovery.isRecovering() && now >= this.#seekGraceUntil) {
        const requested = this.routes.latestRequested("video");
        if (requested?.representation && requested.epoch === this.session.get().epoch && requested.generation === this.session.get().generation && this.routes.recoveryEligible(requested)) {
          const qualification = [
            requested.generation,
            requested.epoch,
            requested.representation,
            requested.authorityRevision,
            requested.routePolicyRevision,
            requested.targetHost,
            this.vault.groupSummary(requested.representation)?.routeCount ?? 0
          ].join(":");
          if (this.#startupRescue.phase === "waiting" && this.#startupRescue.qualification === qualification)
            return startupAge;
          if (!this.routes.recoveryEligible(requested)) return startupAge;
          this.#startupRescue = { phase: "waiting", qualification };
          const fallback = this.routes.recoverStartup(
            requested.representation,
            this.#demand(video),
            requested.targetHost,
            this.measurement.startupFallbackHosts?.() ?? []
          );
          this.#startupRescueState = fallback ? "fallback-submitted" : "no-alternative";
          if (fallback) {
            this.#startupRescue = { phase: "committed" };
            this.recovery.armStartupFailure(video);
          }
        }
      }
      return startupAge;
    }
    #publishSnapshot(video, controls, active, watchdog, startupAge, routingPlayback) {
      this.#controls = controls;
      if (!active) {
        this.#progress = { ...this.#progress, ticks: 0, elapsedMs: 0 };
      }
      this.#snapshot = Object.freeze({
        video,
        routingPlayback,
        stableProgressTicks: this.#progress.ticks,
        stableProgressMs: this.#progress.elapsedMs,
        progressObservation: this.#observation,
        watchdog,
        recoveryActive: this.recovery.isRecovering(),
        stallTicks: this.#stallTicks,
        stall: this.#stall ? Object.freeze({
          id: this.#stall.id,
          phase: this.#stall.progress.phase,
          action: this.#stall.action,
          startedAt: this.#stall.startedAt,
          fallbackAt: this.#stall.startedAt + (this.#stall.longSeek ? 15e3 : 6e3),
          reloadAt: this.#stall.startedAt + (this.#stall.longSeek ? 3e4 : 12e3),
          fallbackAvailable: this.#stall.fallback === "available"
        }) : null,
        startupRescue: { state: this.#startupRescueState, ageSec: Math.floor(startupAge / 1e3) }
      });
      for (const listener of this.#listeners) listener(this.#snapshot);
    }
    #endStall() {
      if (this.#stall) this.recovery.cancelStall(this.#stall.id);
      this.#stall = null;
    }
    #observeStall(video, controls, now, canConfirm = true) {
      if (this.#failedStall) return;
      const requested = this.routes.latestRequested("video"), state = this.session.get();
      if (this.#stall && (this.#stall.userRevision !== controls.userRevision || this.#controls?.mediaId !== controls.mediaId))
        this.#endStall();
      if (!this.#stall && !canConfirm) return;
      if (!this.#stall)
        this.#stall = {
          id: ++this.#stallSerial,
          startedAt: now,
          userRevision: controls.userRevision,
          mediaId: controls.mediaId,
          seekRevision: controls.seekRevision,
          targetSec: video.currentTime,
          longSeek: video.seeking || controls.pendingSeekGoal === true,
          request: requested,
          fallback: this.recovery.isRecovering() && ["route-failure", "watchdog"].includes(this.recovery.snapshot().source ?? "") ? "submitted" : "available",
          action: "waiting",
          progress: { phase: "stalled", ticks: 0 },
          reloadCount: this.recovery.snapshot().reloadCount
        };
      const stall = this.#stall;
      stall.progress = stallProgressTransition(
        stall.progress,
        "stalled",
        video.playableBufferSec,
        0
      ).next;
      const routeIntent = this.recovery.isRecovering() && ["route-failure", "watchdog"].includes(this.recovery.snapshot().source ?? "");
      if (routeIntent) stall.fallback = "submitted";
      const deadCore = video.readyState === 0 && video.width === 0 && video.height === 0 && video.coreInitialized === false && video.manifestHasVideo;
      const joinRouteIntent = routeIntent && !video.seeking && !deadCore;
      if (this.recovery.snapshot().reloadCount > stall.reloadCount && stall.action !== "armed")
        stall.action = "spent";
      if (!stall.longSeek && (video.seeking || controls.pendingSeekGoal)) {
        stall.longSeek = true;
        if (stall.action === "armed") {
          this.recovery.cancelStall(stall.id);
          stall.action = "waiting";
        }
      }
      const rebound = stall.seekRevision !== controls.seekRevision || stall.request?.representation !== requested?.representation || stall.request?.authorityRevision !== requested?.authorityRevision || stall.request?.routePolicyRevision !== requested?.routePolicyRevision;
      if (rebound) {
        this.recovery.cancelStall(stall.id);
        stall.action = this.recovery.snapshot().reloadCount > stall.reloadCount ? "spent" : "waiting";
        stall.seekRevision = controls.seekRevision;
        stall.request = requested;
        stall.targetSec = video.currentTime;
      }
      if (video.seeking) stall.targetSec = video.currentTime;
      const fallbackAfter = stall.longSeek ? 15e3 : 6e3;
      if (!canConfirm || now - stall.startedAt < fallbackAfter && !joinRouteIntent || stall.action === "spent" || stall.action === "armed")
        return;
      if (!requested?.representation || requested.generation !== state.generation || requested.epoch !== state.epoch || !this.routes.recoveryEligible(requested)) {
        stall.action = "spent";
        this.recovery.rejectStall();
        return;
      }
      const request = requested, revision2 = controls.seekRevision, mediaId = controls.mediaId;
      const valid = /* @__PURE__ */ __name(() => {
        const current = this.player.controls(), latest = this.routes.latestRequested("video");
        if (this.#stall !== stall || !this.isVisible() || this.settings.get().disabled || current.userRevision !== stall.userRevision || current.mediaId !== mediaId)
          return false;
        if (this.recovery.ongoingStallReload(stall.id, this.player.snapshot(), current))
          return !!latest && latest.generation === request.generation && latest.epoch === request.epoch && latest.routePolicyRevision === request.routePolicyRevision && this.routes.recoveryEligible(latest);
        return current.seekRevision === revision2 && latest?.representation === request.representation && this.routes.recoveryEligible(request);
      }, "valid");
      stall.action = "armed";
      this.recovery.armStall(video, {
        id: stall.id,
        startedAt: stall.startedAt,
        targetSec: stall.targetSec,
        reloadAfterMs: stall.longSeek ? 3e4 : 12e3,
        valid
      });
      if (stall.fallback === "available") {
        const decision = this.routes.recover(
          requested.representation,
          this.#demand(video),
          "watchdog",
          requested.targetHost,
          requested.expectedBytes ?? null
        );
        if (decision && typeof decision === "object" && "host" in decision && decision.host && decision.host !== requested.targetHost)
          stall.fallback = "submitted";
      }
    }
    #demand(video) {
      const rep = this.routes.latestRequested("video")?.representation ?? this.session.get().representation, summary = rep ? this.vault.groupSummary(rep) : null;
      return controlPlaybackDemand(summary?.kind ?? "video", summary?.bandwidth, video.playbackRate);
    }
  };

  // src-v2/application/lifecycle-controller.ts
  var LifecycleController = class {
    constructor(session, settings, vault, routes, playurl, pagePlayinfo, monitor, now, navigation, scheduler) {
      this.session = session;
      this.settings = settings;
      this.vault = vault;
      this.routes = routes;
      this.playurl = playurl;
      this.pagePlayinfo = pagePlayinfo;
      this.monitor = monitor;
      this.now = now;
      this.navigation = navigation;
      this.scheduler = scheduler;
    }
    session;
    settings;
    vault;
    routes;
    playurl;
    pagePlayinfo;
    monitor;
    now;
    navigation;
    scheduler;
    static {
      __name(this, "LifecycleController");
    }
    #restores = [];
    #pending = null;
    #pageKey = "";
    #active = false;
    start() {
      if (this.#restores.length) return;
      this.#active = true;
      this.#pageKey = this.navigation.key();
      this.#beginGeneration();
      this.pagePlayinfo.install();
      this.#restores.push(this.navigation.subscribe(() => this.#checkNavigation()));
      this.#restores.push(
        this.settings.subscribe((state) => {
          if (state.disabled !== this.session.get().disabled) this.#beginGeneration();
        })
      );
    }
    acceptPageAssignment(payload, serial) {
      if (!this.#active) return false;
      this.#pending = {
        payload,
        serial,
        assignedAt: this.now(),
        pageKey: this.#pageKey,
        appliedGeneration: -1
      };
      const accepted = this.#applyPending();
      this.scheduler.microtask(() => this.#applyPending());
      return accepted;
    }
    dispose() {
      this.#active = false;
      this.#pending = null;
      for (const restore of this.#restores.splice(0).reverse()) {
        try {
          restore();
        } catch {
        }
      }
      this.pagePlayinfo.dispose();
      this.monitor.stop();
    }
    #checkNavigation() {
      const key = this.navigation.key();
      if (key === this.#pageKey) return;
      this.#pageKey = key;
      this.#beginGeneration();
      this.#applyPending();
    }
    #beginGeneration() {
      const state = this.session.beginGeneration(this.settings.get().disabled);
      this.vault.reset(state.generation, state.epoch);
      this.routes.resetEpoch();
      this.monitor.reset();
      if (state.disabled) this.monitor.stop();
      else this.monitor.start();
    }
    #applyPending() {
      const pending = this.#pending, state = this.session.get();
      if (!this.#active || !pending || state.disabled) return false;
      if (pending.appliedGeneration === Number(state.generation)) return true;
      const age = this.now() - pending.assignedAt;
      if (age > 5e3 || pending.pageKey !== this.#pageKey && age > 250) return false;
      const accepted = this.playurl.transform(pending.payload, "page-hint").accepted;
      if (accepted) pending.appliedGeneration = Number(state.generation);
      return accepted;
    }
  };

  // src-v2/adapters/playurl/playurl.ts
  var isRecord = /* @__PURE__ */ __name((value) => !!value && typeof value === "object" && !Array.isArray(value), "isRecord");
  var finite = /* @__PURE__ */ __name((value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0, "finite");
  var text = /* @__PURE__ */ __name((value) => typeof value === "string" ? value : "", "text");
  var baseUrl = /* @__PURE__ */ __name((item) => text(item.baseUrl || item.base_url), "baseUrl");
  var backupUrls = /* @__PURE__ */ __name((item, limit) => {
    const value = item.backupUrl || item.backup_url;
    return Array.isArray(value) ? value.slice(0, limit - 1).map((entry) => typeof entry === "string" ? entry : "") : [];
  }, "backupUrls");
  var codecName = /* @__PURE__ */ __name((item) => {
    const codec = text(item.codecs || item.codec).toLowerCase();
    const id2 = finite(item.codecid || item.codec_id || item.codecId);
    if (codec.includes("av01") || id2 === 13) return "av1";
    if (codec.includes("hev1") || codec.includes("hvc1") || id2 === 12) return "hevc";
    if (codec.includes("avc1") || id2 === 7) return "avc";
    return "other";
  }, "codecName");
  var rewriteItem = /* @__PURE__ */ __name((item, primary, backups) => {
    if ("url" in item) item.url = primary;
    if ("baseUrl" in item) item.baseUrl = primary;
    if ("base_url" in item || !("baseUrl" in item) && !("url" in item)) item.base_url = primary;
    if ("backupUrl" in item) item.backupUrl = [...backups];
    if ("backup_url" in item || !("backupUrl" in item)) item.backup_url = [...backups];
  }, "rewriteItem");
  var PlayurlAdapter = class {
    constructor(controller) {
      this.controller = controller;
    }
    controller;
    static {
      __name(this, "PlayurlAdapter");
    }
    lifecycleKey() {
      return this.controller.lifecycleKey();
    }
    transform(payload, source = "trusted-api", responseKey, context) {
      const root = isRecord(payload) ? payload : null;
      const code = root?.code;
      const upstreamCode = typeof code === "number" && Number.isInteger(code) && code >= -2147483648 && code <= 2147483647 ? code : null;
      const formats = [], video = [], audio = [];
      let segmentCount = 0, failure = null;
      const result = /* @__PURE__ */ __name((reason) => Object.freeze({
        accepted: reason === null,
        formats: Object.freeze([...formats]),
        videoCount: video.length,
        audioCount: audio.length,
        segmentCount,
        upstreamCode,
        reason
      }), "result");
      if (!this.controller.active()) return result("inactive");
      if (!root || "code" in root && upstreamCode === null) return result("malformed-payload");
      if (upstreamCode !== null && upstreamCode !== 0) return result("upstream-error");
      const visited = /* @__PURE__ */ new Set();
      const primaryBranch = isRecord(root.data) ? "root.data" : isRecord(root.result) ? "root.result" : "root";
      const addFormat = /* @__PURE__ */ __name((format) => {
        if (!formats.includes(format)) formats.push(format);
      }, "addFormat");
      const normalize = /* @__PURE__ */ __name((item, index, branch, progressive = false, format) => {
        const primary = progressive ? text(item.url) : baseUrl(item);
        const frameRate = declaredFrameRate(item.frame_rate ?? item.frameRate);
        return {
          token: item,
          key: progressive ? `${branch}:${format}:${finite(item.quality)}:${index}` : `${branch ? branch + ":" : ""}${String(item.id ?? index)}:${codecName(item)}:${finite(item.height)}`,
          height: finite(item.height),
          codec: progressive ? format ?? "other" : codecName(item),
          bandwidth: finite(item.bandwidth),
          ...frameRate !== void 0 ? { frameRate } : {},
          primary,
          urls: [
            primary,
            ...backupUrls(
              item,
              source === "trusted-api" ? TRUSTED_SOURCE_SCAN : PROVISIONAL_SOURCE_SCAN
            )
          ],
          ...progressive ? { progressive: true } : {}
        };
      }, "normalize");
      const inventory = [];
      let videoLength = 0, audioLength = 0;
      const queue = /* @__PURE__ */ __name((value, kind, branch, container, progressive = false) => {
        if ((value === void 0 || value === null) && !progressive) return;
        if (!Array.isArray(value)) {
          failure = "malformed-payload";
          return;
        }
        const count = value.length;
        if (!Number.isSafeInteger(count) || count < 0 || progressive && !count) {
          failure = "malformed-payload";
          return;
        }
        if (kind === "video") videoLength += count;
        else audioLength += count;
        if (videoLength > 128 || audioLength > 64) {
          failure = "malformed-payload";
          return;
        }
        inventory.push({ items: value, count, kind, branch, progressive, container });
      }, "queue");
      const collect = /* @__PURE__ */ __name((data, branch, depth) => {
        if (visited.has(data)) return;
        visited.add(data);
        if ("dash" in data) {
          if (!isRecord(data.dash)) failure = "malformed-payload";
          else {
            const dash = data.dash;
            const dashBranch = branch === primaryBranch || branch === `${primaryBranch}.video_info` ? "" : `${branch}.dash`;
            addFormat("dash");
            queue(dash.video, "video", dashBranch, data);
            queue(dash.audio, "audio", dashBranch, data);
            for (const key of ["dolby", "flac"]) {
              const variant = isRecord(dash[key]) ? dash[key] : null, nested = variant?.audio;
              queue(isRecord(nested) ? [nested] : nested, "audio", `${dashBranch}.${key}`, data);
            }
          }
        }
        if ("durl" in data) {
          queue(data.durl, "video", `${branch}.durl`, data, true);
        }
        if (depth < 2) {
          for (const key of ["data", "result", "video_info"])
            if (isRecord(data[key])) collect(data[key], `${branch}.${key}`, depth + 1);
        }
      }, "collect");
      collect(root, "root", 0);
      if (failure) return result(failure);
      for (const group of inventory) {
        for (let index = 0; index < group.count; index++) {
          const item = group.items[index];
          if (!isRecord(item)) {
            failure = "malformed-payload";
            continue;
          }
          if (group.progressive) {
            if (typeof item.url !== "string" || !item.url || "backup_url" in item && !Array.isArray(item.backup_url) || "backupUrl" in item && !Array.isArray(item.backupUrl)) {
              failure = "malformed-payload";
              continue;
            }
            const declared = text(group.container.format).toLowerCase(), parsed = parseMediaUrl(item.url);
            const extension = parsed?.url.pathname.match(/\.(mp4|flv)$/i)?.[1]?.toLowerCase();
            const format = extension === "mp4" || extension === "flv" ? extension : declared.startsWith("mp4") ? "mp4" : declared.startsWith("flv") ? "flv" : null;
            if (!format || declared && !declared.startsWith("mp4") && !declared.startsWith("flv")) {
              failure = "unsupported-format";
              continue;
            }
            addFormat(format);
            segmentCount++;
            const entry = normalize(
              item,
              index,
              `${group.branch}:${finite(group.container.quality)}`,
              true,
              format
            );
            video.push(entry);
            if (this.controller.catalogOnly() && !entry.urls.some((url) => parseMediaUrl(url)?.replaceable))
              failure = "unreplaceable-source";
          } else (group.kind === "video" ? video : audio).push(normalize(item, index, group.branch));
        }
      }
      if (failure) return result(failure);
      if (!video.length && !audio.length) return result("unsupported-format");
      const outputs = this.controller.ingest(
        { token: root, video, audio },
        source,
        responseKey,
        context
      );
      if (!outputs) return result(this.controller.active() ? "no-legal-route" : "inactive");
      if (this.controller.catalogOnly() && outputs.some((output) => !output.primary)) {
        if (!segmentCount) {
          for (const output of outputs)
            if (isRecord(output.token)) rewriteItem(output.token, output.primary, output.backups);
        }
        return result("no-legal-route");
      }
      if (segmentCount && outputs.some(
        (output) => !output.primary && video.some((item) => item.progressive && item.token === output.token)
      ))
        return result("no-legal-route");
      for (const output of outputs)
        if (isRecord(output.token)) rewriteItem(output.token, output.primary, output.backups);
      if (source === "trusted-api") this.controller.acceptResponse(context);
      return result(null);
    }
  };

  // src-v2/adapters/player/input-bindings.ts
  var PlayerInputBindings = class {
    static {
      __name(this, "PlayerInputBindings");
    }
    #stops = [];
    listen(target, type, listener) {
      target.addEventListener(type, listener, true);
      this.#stops.push(() => target.removeEventListener(type, listener, true));
    }
    trusted(target, type, listener) {
      this.listen(target, type, (event) => {
        if (event.isTrusted) listener(event);
      });
    }
    own(stop) {
      this.#stops.push(stop);
    }
    playback(video, invalidate) {
      for (const type of ["pause", "play", "ratechange", "seeking", "emptied", "ended"])
        this.listen(video, type, () => invalidate());
    }
    pointerRelease(release) {
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
        this.listen(document, type, release);
    }
    keyboard(listener) {
      for (const type of ["keydown", "keyup"]) this.listen(document, type, listener);
    }
    clear() {
      for (const stop of this.#stops.splice(0).reverse()) stop();
    }
  };
  function isControlKeyboard(event) {
    return event instanceof KeyboardEvent && event.isTrusted && !event.isComposing && event.keyCode !== 229 && !event.ctrlKey && !event.metaKey && !event.altKey;
  }
  __name(isControlKeyboard, "isControlKeyboard");
  function isEditableTarget(target) {
    return target instanceof Element && (!!target.closest('input, textarea, select, [role="textbox"], #bilicdn-v2-control-center') || target instanceof HTMLElement && target.isContentEditable);
  }
  __name(isEditableTarget, "isEditableTarget");
  function progressPointerId(event, region) {
    const hit = event.target instanceof Element ? event.target.closest(
      '.bpx-player-progress-wrap, .bpx-player-progress, .bilibili-player-video-progress, [role="slider"]'
    ) : null;
    if (!hit || !region?.contains(hit) || typeof PointerEvent !== "function" || !(event instanceof PointerEvent))
      return null;
    const pointerId = event.pointerId;
    return Number.isInteger(pointerId) ? pointerId : null;
  }
  __name(progressPointerId, "progressPointerId");

  // src-v2/adapters/player/player-sdk.ts
  var isRecord2 = /* @__PURE__ */ __name((value) => !!value && typeof value === "object", "isRecord");
  var safeCall = /* @__PURE__ */ __name((target, name, ...args) => {
    if (!isRecord2(target)) return void 0;
    try {
      const fn = target[name];
      return typeof fn === "function" ? Reflect.apply(fn, target, args) : void 0;
    } catch {
      return void 0;
    }
  }, "safeCall");
  var safeNumber = /* @__PURE__ */ __name((value) => Number.isFinite(Number(value)) ? Number(value) : null, "safeNumber");
  var sameDescriptor = /* @__PURE__ */ __name((left, right) => left === void 0 || right === void 0 ? left === right : left.value === right.value && left.get === right.get && left.set === right.set && left.writable === right.writable && left.enumerable === right.enumerable && left.configurable === right.configurable, "sameDescriptor");
  var observeMethod = /* @__PURE__ */ __name((target, name, original, wrapped) => {
    const before = Object.getOwnPropertyDescriptor(target, name);
    target[name] = wrapped;
    const installed = Object.getOwnPropertyDescriptor(target, name);
    return () => {
      try {
        if (!sameDescriptor(Object.getOwnPropertyDescriptor(target, name), installed) || target[name] !== wrapped || !sameDescriptor(Object.getOwnPropertyDescriptor(target, name), installed))
          return;
        if (!before && installed) Reflect.deleteProperty(target, name);
        else if (before && "value" in before) Object.defineProperty(target, name, before);
        else target[name] = original;
      } catch {
      }
    };
  }, "observeMethod");

  // src-v2/adapters/player/player-controls.ts
  var PlayerControlObserver = class {
    constructor(sources, environment) {
      this.sources = sources;
      this.environment = environment;
    }
    sources;
    environment;
    static {
      __name(this, "PlayerControlObserver");
    }
    #seek = {
      revision: 0,
      drag: null,
      pointerRevision: 0,
      targetSec: null,
      internalDepth: 0,
      pending: null,
      keyboard: null,
      goal: null,
      nativePosition: null
    };
    #reload = {
      revision: 0,
      coreRevision: 0,
      internalDepth: 0,
      core: null,
      awaitCore: false,
      owned: null
    };
    #restores = { position: null, rate: null };
    #objects = /* @__PURE__ */ new WeakMap();
    #objectSerial = 0;
    #userRevision = 0;
    #inputs = new PlayerInputBindings();
    #controlVideo = null;
    #seekOwner = null;
    #keyboardPlayback = null;
    #keyboardRevision = 0;
    #controlRevision = 0;
    #playbackRevision = 0;
    #playbackListeners = /* @__PURE__ */ new Set();
    playbackRevision() {
      return this.#playbackRevision;
    }
    observePlaybackInvalidation(listener) {
      this.#playbackListeners.add(listener);
      this.controls();
      return () => this.#playbackListeners.delete(listener);
    }
    #invalidatePlayback() {
      const revision2 = ++this.#playbackRevision;
      for (const listener of this.#playbackListeners) {
        try {
          listener(revision2);
        } catch {
        }
      }
    }
    controls() {
      const reloadOwner = this.#reload.owned;
      const video = this.sources.video(), player = this.sources.player(), core = safeCall(player, "__core");
      if (video !== this.#controlVideo || player !== this.#seekOwner)
        this.#observeControls(video, player);
      this.#validateDrag();
      this.#confirmKeyboardSeek();
      this.#confirmKeyboardPlayback();
      if (video) this.#observeNativePosition(video, player);
      if (video?.seeking && Number.isFinite(video.currentTime) && video.currentTime !== this.#seek.targetSec) {
        this.#seek.targetSec = video.currentTime;
        if (!this.#seek.internalDepth && this.#seek.pending !== video.currentTime && !this.#pendingRestoreSeek(video.currentTime))
          this.#seek.revision++;
      }
      const identity = /* @__PURE__ */ __name((object) => {
        if (!object || typeof object !== "object" && typeof object !== "function") return 0;
        let id2 = this.#objects.get(object);
        if (id2 === void 0) {
          id2 = ++this.#objectSerial;
          this.#objects.set(object, id2);
        }
        return id2;
      }, "identity");
      if (reloadOwner) this.#validateOwnedReload(video, player, core, reloadOwner);
      else if (!this.#reload.owned && !this.#reload.awaitCore && core !== this.#reload.core)
        this.#reload.coreRevision = 0;
      this.#reload.core = core;
      return Object.freeze({
        mediaId: identity(video),
        coreId: identity(core),
        seekRevision: this.#seek.revision,
        userRevision: this.#userRevision,
        dragging: this.#seek.drag !== null,
        targetSec: this.#seek.targetSec,
        pendingSeekGoal: !!this.#seek.goal && !this.#seek.goal.completed,
        reloadRevision: this.#reload.revision,
        coreReloadRevision: this.#reload.coreRevision
      });
    }
    captureResumePosition(readCurrent) {
      this.controls();
      const before = this.#seek.goal;
      const current = readCurrent();
      this.controls();
      const goal = this.#seek.goal;
      return Object.freeze(
        goal && goal === before && !goal.completed && this.#goalCurrent(goal) ? { positionSec: goal.position, proof: goal.proof } : { positionSec: current, proof: null }
      );
    }
    validateResumePosition(capture, initializationRevision) {
      this.controls();
      if (capture.proof === null) return initializationRevision === void 0;
      const goal = this.#seek.goal;
      return !!goal && goal.proof === capture.proof && goal.position === capture.positionSec && this.#goalCurrent(goal) && (initializationRevision === void 0 || goal.initialization?.revision === initializationRevision);
    }
    #goalCurrent(goal) {
      const video = this.sources.video(), player = this.sources.player(), lifecycle = this.sources.lifecycleKey(), core = safeCall(player, "__core");
      const reload = this.#reload.owned;
      if (reload) this.#validateOwnedReload(video, player, core, reload);
      return this.#seek.goal === goal && goal.video === video && goal.player === player && goal.lifecycle === lifecycle && goal.userRevision === this.#userRevision && this.environment.isActuallyVisible() && (core === goal.core || !!reload && this.#reload.owned === reload && (core === null || core === void 0 || core === reload.replacement)) && video === this.sources.video() && player === this.sources.player() && lifecycle === this.sources.lifecycleKey() && this.#seek.goal === goal && goal.userRevision === this.#userRevision;
    }
    #setGoal(video, position) {
      if (!Number.isFinite(position)) return;
      const revision2 = this.#userRevision, controlRevision = this.#controlRevision;
      const old = this.#seek.goal;
      if (old && old.position === position && old.video === video && old.userRevision === this.#userRevision && this.#goalCurrent(old))
        return;
      const player = this.sources.player(), lifecycle = this.sources.lifecycleKey(), core = safeCall(player, "__core");
      if (video !== this.sources.video() || player !== this.sources.player() || lifecycle !== this.sources.lifecycleKey() || revision2 !== this.#userRevision || controlRevision !== this.#controlRevision)
        return;
      this.#seek.goal = {
        proof: Object.freeze({}),
        video,
        player,
        lifecycle,
        core,
        position,
        userRevision: revision2,
        completed: false,
        baseline: null,
        progress: 0,
        initialization: null
      };
    }
    #pointerGoal(video) {
      const drag = this.#seek.drag, revision2 = this.#seek.pointerRevision, position = video.currentTime;
      if (drag && drag.video === video && drag.player === this.sources.player() && drag.lifecycle === this.sources.lifecycleKey() && this.environment.isActuallyVisible() && Number.isFinite(position) && position !== drag.position && this.#seek.drag === drag && revision2 === this.#seek.pointerRevision)
        this.#setGoal(video, position);
    }
    #initializationSeek(position) {
      const goal = this.#seek.goal, reload = this.#reload.owned;
      if (!goal || goal.completed || !Number.isFinite(position) || !reload || reload.stable || goal.initialization || !this.#goalCurrent(goal) || !this.#reload.internalDepth && !reload.replacement)
        return false;
      goal.initialization = { revision: reload.revision, seekRevision: this.#seek.revision, position };
      goal.baseline = null;
      goal.progress = 0;
      return true;
    }
    #sampleGoal(video, position) {
      const goal = this.#seek.goal;
      if (!goal) return;
      if (!this.#goalCurrent(goal)) {
        if (this.#seek.goal === goal) this.#seek.goal = null;
        return;
      }
      if (goal.completed || video.readyState < 2 || video.seeking || video.ended || video.error)
        return;
      const reload = this.#reload.owned;
      if (reload?.replacement && !video.paused) reload.stable = true;
      let frames = null;
      try {
        const value = video.getVideoPlaybackQuality?.().totalVideoFrames;
        if (typeof value === "number" && Number.isFinite(value)) frames = value;
      } catch {
      }
      const at = this.environment.now?.() ?? Date.now(), before = goal.baseline;
      if (this.#seek.goal !== goal || !this.#goalCurrent(goal)) return;
      if (!before) {
        if (Math.abs(position - goal.position) <= 1) goal.baseline = { position, frames, at };
        else if (position !== goal.initialization?.position && this.#seek.goal === goal)
          this.#seek.goal = null;
        return;
      }
      if (at <= before.at) return;
      const delta = position - before.position, maxAdvance = Math.max(1, Math.max(0, video.playbackRate) * (at - before.at) / 1e3 + 1);
      const progress = !video.paused && playbackTimeAdvanced(position, before.position) && (frames === null || before.frames !== null && playbackFramesAdvanced(frames, before.frames));
      if (this.#seek.goal !== goal || !this.#goalCurrent(goal)) return;
      if (delta < 0 || delta > maxAdvance || video.paused && delta !== 0 && !this.#seek.internalDepth) {
        this.#seek.goal = null;
        return;
      }
      goal.progress = progress ? goal.progress + 1 : 0;
      goal.baseline = { position, frames, at };
      if (goal.progress >= 2) goal.completed = true;
    }
    #observeNativePosition(video, player, knownReloadZero = false) {
      const before = this.#seek.nativePosition, revision2 = this.#controlRevision;
      const seekRevision = this.#seek.revision, userRevision = this.#userRevision, pendingSeek = this.#seek.pending;
      const lifecycle = this.sources.lifecycleKey(), position = video.currentTime, readyState = video.readyState;
      const currentVideo = this.sources.video(), currentPlayer = this.sources.player(), currentLifecycle = this.sources.lifecycleKey();
      if (revision2 !== this.#controlRevision || this.#seek.nativePosition !== before || video !== this.#controlVideo || player !== this.#seekOwner || currentVideo !== video || currentPlayer !== player || lifecycle !== currentLifecycle || seekRevision !== this.#seek.revision || userRevision !== this.#userRevision || pendingSeek !== this.#seek.pending || !Number.isFinite(position))
        return;
      this.#seek.nativePosition = { video, player, lifecycle, position, readyState };
      this.#pointerGoal(video);
      this.#sampleGoal(video, position);
      if (!before || before.video !== video || before.player !== player || before.lifecycle !== lifecycle || readyState !== 0 || before.position === position)
        return;
      const owner = this.#reload.owned;
      const initialReloadZero = position === 0 && owner?.video === video && owner.player === player && owner.lifecycle === lifecycle && (knownReloadZero || this.#reload.internalDepth > 0 && before.readyState !== 0);
      if (initialReloadZero) return;
      const goal = this.#seek.goal;
      if (goal && position !== goal.position && !(position === 0 && before.readyState !== 0 && !this.#reload.owned) && position !== goal.initialization?.position)
        this.#seek.goal = null;
      const alreadyObserved = this.#seek.targetSec === position;
      this.#seek.targetSec = position;
      if (!this.#seek.internalDepth && position !== this.#seek.pending) {
        this.#seek.pending = null;
        if (!alreadyObserved) this.#seek.revision++;
      }
    }
    #observeControls(video, player) {
      this.#invalidatePlayback();
      this.#clearControls();
      this.#controlVideo = video;
      this.#seekOwner = player;
      if (!video) return;
      this.#inputs.playback(video, () => this.#invalidatePlayback());
      const region = video.closest(".bpx-player-container, .bilibili-player") ?? video.parentElement;
      const inRegion = /* @__PURE__ */ __name((event) => event.target instanceof Node && !!region?.contains(event.target), "inRegion");
      this.#bindPointerControls(video, player, region, inRegion);
      this.#bindControlLoss();
      this.#bindKeyboardControls(video, player, inRegion);
      this.#bindMediaControls(video);
      this.#bindSdkControls(player);
    }
    #bindPointerControls(video, player, region, inRegion) {
      this.#inputs.trusted(document, "pointerdown", (event) => {
        const revision2 = ++this.#seek.pointerRevision;
        if (!this.environment.isActuallyVisible() || !inRegion(event) || revision2 !== this.#seek.pointerRevision)
          return;
        this.#clearKeyboardSeek();
        this.#clearKeyboardPlayback();
        const playTarget = event.target instanceof Element && event.target.closest(".bpx-player-ctrl-play");
        if (!this.#advanceUser(!!playTarget && video.paused)) return;
        const lifecycle = this.sources.lifecycleKey();
        const pointerId = progressPointerId(event, region);
        if (pointerId === null) return;
        const current = video === this.sources.video() && player === this.sources.player() && lifecycle === this.sources.lifecycleKey() && this.environment.isActuallyVisible();
        if (!current || video !== this.#controlVideo || player !== this.#seekOwner || revision2 !== this.#seek.pointerRevision)
          return;
        this.#seek.drag = { pointerId, video, player, lifecycle, position: video.currentTime };
      });
      const release = /* @__PURE__ */ __name((event) => {
        const drag = this.#seek.drag;
        if (!drag || !event.isTrusted || typeof PointerEvent !== "function" || !(event instanceof PointerEvent) || event.pointerId !== drag.pointerId)
          return;
        if (this.#seek.drag === drag) {
          this.#pointerGoal(video);
          this.#seek.drag = null;
          this.#seek.pointerRevision++;
        }
      }, "release");
      this.#inputs.pointerRelease(release);
    }
    #bindControlLoss() {
      const controlLoss = /* @__PURE__ */ __name(() => {
        this.#seek.drag = null;
        this.#seek.pointerRevision++;
        this.#clearKeyboardSeek();
        this.#clearKeyboardPlayback();
        this.#clearOwnedReload();
        this.#seek.goal = null;
      }, "controlLoss");
      this.#inputs.trusted(window, "blur", (event) => {
        if (event.target === window) controlLoss();
      });
      this.#inputs.own(this.environment.subscribeControlLoss(controlLoss));
    }
    #bindKeyboardControls(video, player, inRegion) {
      const observeKeyboard = /* @__PURE__ */ __name((event) => {
        const revision2 = ++this.#keyboardRevision;
        this.#clearKeyboardSeek();
        this.#clearKeyboardPlayback();
        if (!isControlKeyboard(event) || !this.environment.isActuallyVisible()) return;
        if (event.composedPath().some(isEditableTarget) || event.target && isEditableTarget(event.target))
          return;
        if (["ArrowLeft", "ArrowRight", "Home", "End", "j", "J", "l", "L"].includes(event.key)) {
          this.#beginKeyboardSeek(event, video, player, revision2);
        } else if (event.type === "keydown" && ["ArrowUp", "ArrowDown", " ", "k", "K"].includes(event.key)) {
          const inside = inRegion(event);
          if (revision2 !== this.#keyboardRevision) return;
          if (inside) this.#advanceUser(video.paused && [" ", "k", "K"].includes(event.key));
          else this.#beginKeyboardPlayback(event, video, player, revision2);
        }
      }, "observeKeyboard");
      this.#inputs.keyboard(observeKeyboard);
    }
    #bindMediaControls(video) {
      this.#inputs.listen(video, "seeking", () => {
        const position = Number.isFinite(video.currentTime) ? video.currentTime : null;
        if (!this.#seek.internalDepth && position !== this.#seek.pending && !this.#pendingRestoreSeek(position))
          this.#seek.revision++;
        this.#seek.targetSec = position;
        this.#confirmKeyboardSeek();
        this.#pointerGoal(video);
        const goal = this.#seek.goal;
        if (!this.#seek.internalDepth && !this.#pendingRestoreSeek(position) && goal && position !== goal.position && position !== goal.initialization?.position)
          this.#seek.goal = null;
      });
      this.#inputs.listen(video, "seeked", () => {
        this.#seek.pending = null;
        this.#sampleGoal(video, video.currentTime);
        this.#noteRestoreLanding();
      });
    }
    #bindSdkControls(player) {
      const original = player?.seek, observer = this;
      const reload = player?.reload;
      if (player && typeof reload === "function") {
        const wrapped = /* @__PURE__ */ __name(function(...args) {
          if (!observer.#reload.internalDepth) {
            observer.#seek.revision++;
            observer.#clearOwnedReload();
            observer.#seek.goal = null;
          }
          return Reflect.apply(reload, this, args);
        }, "wrapped");
        try {
          this.#inputs.own(observeMethod(player, "reload", reload, wrapped));
        } catch {
        }
      }
      if (player && typeof original === "function") {
        const wrapped = /* @__PURE__ */ __name(function(...args) {
          if (!observer.#seek.internalDepth) {
            observer.#seek.revision++;
            observer.#seek.pending = null;
            observer.#seek.targetSec = typeof args[0] === "number" && Number.isFinite(args[0]) ? Math.max(0, args[0]) : null;
            if (!observer.#initializationSeek(observer.#seek.targetSec ?? NaN))
              observer.#seek.goal = null;
          }
          try {
            return Reflect.apply(original, this, args);
          } finally {
            observer.#confirmKeyboardSeek();
            const video = observer.sources.video();
            if (video) observer.#pointerGoal(video);
          }
        }, "wrapped");
        try {
          this.#inputs.own(observeMethod(player, "seek", original, wrapped));
        } catch {
        }
      }
    }
    #beginKeyboardSeek(event, video, player, revision2) {
      const position = video.currentTime, core = safeCall(player, "__core"), lifecycle = this.sources.lifecycleKey();
      if (!Number.isFinite(position) || revision2 !== this.#keyboardRevision || video !== this.#controlVideo || player !== this.#seekOwner)
        return;
      const candidate = {
        event,
        video,
        player,
        lifecycle: this.sources.lifecycleKey(),
        position,
        core,
        revision: revision2,
        stop: /* @__PURE__ */ __name(() => void 0, "stop")
      };
      if (lifecycle !== candidate.lifecycle || revision2 !== this.#keyboardRevision) return;
      this.#seek.keyboard = candidate;
      const type = event.type;
      const finish = /* @__PURE__ */ __name((observed) => {
        if (observed === event && this.#seek.keyboard === candidate) this.#confirmKeyboardSeek();
      }, "finish");
      window.addEventListener(type, finish);
      const cancel = this.environment.scheduler.timeout(() => {
        if (this.#seek.keyboard === candidate) this.#clearKeyboardSeek();
      }, 0);
      candidate.stop = () => {
        cancel();
        window.removeEventListener(type, finish);
      };
    }
    #confirmKeyboardSeek() {
      const candidate = this.#seek.keyboard;
      if (!candidate) return;
      try {
        if (candidate.event.eventPhase === Event.NONE || candidate.revision !== this.#keyboardRevision || candidate.video !== this.#controlVideo || candidate.player !== this.#seekOwner || candidate.video !== this.sources.video() || candidate.player !== this.sources.player() || candidate.lifecycle !== this.sources.lifecycleKey() || !this.environment.isActuallyVisible()) {
          if (this.#seek.keyboard === candidate) this.#clearKeyboardSeek();
          return;
        }
        const position = candidate.video.currentTime, seeking = candidate.video.seeking, readyState = candidate.video.readyState;
        const core = safeCall(candidate.player, "__core");
        const actualSeek = seeking || readyState === 0 && core === candidate.core && !this.#reload.internalDepth;
        if (this.#seek.keyboard !== candidate || candidate.revision !== this.#keyboardRevision) return;
        if (candidate.event.eventPhase === Event.NONE || candidate.video !== this.#controlVideo || candidate.player !== this.#seekOwner || candidate.video !== this.sources.video() || candidate.player !== this.sources.player() || candidate.lifecycle !== this.sources.lifecycleKey() || !this.environment.isActuallyVisible()) {
          if (this.#seek.keyboard === candidate) this.#clearKeyboardSeek();
          return;
        }
        if (this.#seek.keyboard !== candidate || candidate.revision !== this.#keyboardRevision || this.#seek.internalDepth || !actualSeek || !Number.isFinite(position) || position === candidate.position || position === this.#seek.pending)
          return;
        if (this.#seek.targetSec !== position) this.#seek.revision++;
        this.#seek.targetSec = position;
        if (!this.#advanceUser()) return;
        this.#setGoal(candidate.video, position);
        this.#clearKeyboardSeek();
      } catch {
        if (this.#seek.keyboard === candidate) this.#clearKeyboardSeek();
      }
    }
    #clearKeyboardSeek() {
      const candidate = this.#seek.keyboard;
      this.#seek.keyboard = null;
      candidate?.stop();
    }
    #beginKeyboardPlayback(event, video, player, revision2) {
      const candidate = {
        event,
        video,
        player,
        core: safeCall(player, "__core"),
        lifecycle: this.sources.lifecycleKey(),
        paused: video.paused,
        rate: video.playbackRate,
        kind: [" ", "k", "K"].includes(event.key) ? "pause" : "rate",
        revision: revision2,
        stop: /* @__PURE__ */ __name(() => void 0, "stop")
      };
      if (revision2 !== this.#keyboardRevision || video !== this.#controlVideo || player !== this.#seekOwner)
        return;
      this.#keyboardPlayback = candidate;
      const finish = /* @__PURE__ */ __name((observed) => {
        if (observed === event && this.#keyboardPlayback === candidate)
          this.#confirmKeyboardPlayback();
      }, "finish");
      window.addEventListener(event.type, finish);
      const cancel = this.environment.scheduler.timeout(() => {
        if (this.#keyboardPlayback === candidate) this.#clearKeyboardPlayback();
      }, 0);
      candidate.stop = () => {
        cancel();
        window.removeEventListener(event.type, finish);
      };
    }
    #confirmKeyboardPlayback() {
      const candidate = this.#keyboardPlayback;
      if (!candidate) return;
      try {
        const eligible = candidate.event.eventPhase !== Event.NONE && candidate.revision === this.#keyboardRevision && candidate.video === this.#controlVideo && candidate.player === this.#seekOwner && candidate.video === this.sources.video() && candidate.player === this.sources.player() && candidate.core === safeCall(candidate.player, "__core") && candidate.lifecycle === this.sources.lifecycleKey() && this.environment.isActuallyVisible();
        const changed = candidate.kind === "pause" ? candidate.video.paused !== candidate.paused : Number.isFinite(candidate.video.playbackRate) && candidate.video.playbackRate !== candidate.rate;
        if (this.#keyboardPlayback !== candidate || candidate.revision !== this.#keyboardRevision)
          return;
        if (!eligible) {
          this.#clearKeyboardPlayback();
          return;
        }
        if (changed) {
          this.#advanceUser(candidate.kind === "pause" && candidate.paused);
          this.#clearKeyboardPlayback();
        }
      } catch {
        if (this.#keyboardPlayback === candidate) this.#clearKeyboardPlayback();
      }
    }
    #clearKeyboardPlayback() {
      const candidate = this.#keyboardPlayback;
      this.#keyboardPlayback = null;
      candidate?.stop();
    }
    #advanceUser(keepGoal = false) {
      const goal = this.#seek.goal, revision2 = this.#userRevision;
      const valid = keepGoal && !!goal && !goal.completed && this.#goalCurrent(goal);
      if (revision2 !== this.#userRevision) return false;
      this.#userRevision++;
      this.#invalidatePlayback();
      this.#clearOwnedReload();
      if (valid && this.#seek.goal === goal) goal.userRevision = this.#userRevision;
      else this.#seek.goal = null;
      return true;
    }
    #clearOwnedReload() {
      const owner = this.#reload.owned;
      this.#reload.owned = null;
      this.#reload.awaitCore = false;
      this.#reload.coreRevision = 0;
      owner?.cancel();
    }
    #validateOwnedReload(video, player, core, owner) {
      if (this.#reload.owned !== owner) return;
      const valid = video === owner.video && player === owner.player && owner.revision === this.#reload.revision && owner.lifecycle === this.sources.lifecycleKey() && owner.userRevision === this.#userRevision && this.environment.isActuallyVisible();
      if (this.#reload.owned !== owner) return;
      if (!valid) {
        this.#clearOwnedReload();
        return;
      }
      if (owner.replacement) {
        if (core !== owner.replacement) this.#clearOwnedReload();
        return;
      }
      if (!core) {
        owner.sawNull = true;
        return;
      }
      if (core === owner.sourceCore) {
        if (owner.sawNull) this.#clearOwnedReload();
        return;
      }
      owner.replacement = core;
      this.#reload.coreRevision = owner.revision;
      this.#reload.awaitCore = false;
    }
    ownedReload(revision2) {
      this.#confirmKeyboardPlayback();
      const owner = this.#reload.owned;
      if (!owner || owner.revision !== revision2) return false;
      this.#validateOwnedReload(
        this.sources.video(),
        this.sources.player(),
        safeCall(owner.player, "__core"),
        owner
      );
      return this.#reload.owned === owner;
    }
    #validateDrag() {
      const drag = this.#seek.drag;
      if (!drag) return;
      if (drag.video !== this.#controlVideo || drag.player !== this.#seekOwner || drag.video !== this.sources.video() || drag.player !== this.sources.player() || drag.lifecycle !== this.sources.lifecycleKey() || !this.environment.isActuallyVisible()) {
        if (this.#seek.drag === drag) {
          this.#seek.drag = null;
          this.#seek.pointerRevision++;
        }
      }
    }
    #clearControls() {
      this.#restores.position = null;
      this.#restores.rate = null;
      this.#seek.goal = null;
      this.#controlRevision++;
      this.#seek.nativePosition = null;
      this.#clearKeyboardSeek();
      this.#clearKeyboardPlayback();
      this.#keyboardRevision++;
      this.#clearOwnedReload();
      this.#inputs.clear();
      this.#controlVideo = null;
      this.#seekOwner = null;
      this.#seek.drag = null;
      this.#seek.pointerRevision++;
      this.#seek.pending = null;
    }
    observePlayIntent(listener) {
      const target = this.sources.player(), original = target?.play;
      let stopped = false;
      const stops = [];
      if (target && typeof original === "function") {
        const wrapped = /* @__PURE__ */ __name(function(...args) {
          let active = false;
          try {
            active = unsafeWindow.navigator.userActivation?.isActive === true;
          } catch {
          }
          if (!stopped && active) listener();
          return Reflect.apply(original, this, args);
        }, "wrapped");
        try {
          stops.push(observeMethod(target, "play", original, wrapped));
        } catch {
        }
      }
      try {
        const video = this.sources.video(), lifecycle = this.sources.lifecycleKey();
        const region = video?.closest(".bpx-player-container, .bilibili-player") ?? video?.parentElement;
        const controlRevision = this.#controlRevision;
        if (video && target && region) {
          const ownerDocument = document;
          const click = /* @__PURE__ */ __name((event) => {
            if (stopped || !event.isTrusted || !(event.target instanceof Element)) return;
            const userRevision = this.#userRevision;
            const button = event.target.closest(".bpx-player-ctrl-play");
            if (!button || !region.contains(button) || !this.environment.isActuallyVisible() || video !== this.sources.video() || target !== this.sources.player() || lifecycle !== this.sources.lifecycleKey() || !video.paused || video.ended || video.error)
              return;
            if (stopped || controlRevision !== this.#controlRevision || userRevision !== this.#userRevision || video !== this.sources.video() || target !== this.sources.player() || lifecycle !== this.sources.lifecycleKey() || !this.environment.isActuallyVisible() || lifecycle !== this.sources.lifecycleKey() || stopped || controlRevision !== this.#controlRevision || userRevision !== this.#userRevision)
              return;
            listener();
          }, "click");
          ownerDocument.addEventListener("click", click, { capture: true });
          stops.push(() => ownerDocument.removeEventListener("click", click, { capture: true }));
        }
      } catch {
      }
      return () => {
        if (!stopped) {
          stopped = true;
          for (const stop of stops.reverse()) stop();
        }
      };
    }
    reload() {
      const prepared = this.prepareReload();
      if (!prepared) throw new Error("player.reload unavailable");
      return prepared.dispatch(() => true);
    }
    prepareReload() {
      const userRevision = this.#userRevision, beforeRevision = this.#reload.revision, seekRevision = this.#seek.revision, controlRevision = this.#controlRevision;
      const player = this.sources.player(), video = this.sources.video(), lifecycle = this.sources.lifecycleKey();
      const sourceCore = safeCall(player, "__core"), reload = player?.reload;
      if (!player || typeof reload !== "function") return null;
      let dispatched = false;
      const revisionsMatch = /* @__PURE__ */ __name(() => userRevision === this.#userRevision && beforeRevision === this.#reload.revision && seekRevision === this.#seek.revision && controlRevision === this.#controlRevision, "revisionsMatch");
      const valid = /* @__PURE__ */ __name(() => {
        if (dispatched || !revisionsMatch()) return false;
        const currentPlayer = this.sources.player(), currentVideo = this.sources.video(), currentCore = safeCall(player, "__core");
        const visible = this.environment.isActuallyVisible(), currentLifecycle = this.sources.lifecycleKey();
        if (userRevision !== this.#userRevision || beforeRevision !== this.#reload.revision || currentPlayer !== player || currentVideo !== video || currentCore !== sourceCore || currentLifecycle !== lifecycle || !visible)
          return false;
        return revisionsMatch();
      }, "valid");
      if (!valid()) throw new Error("player.reload ownership ended");
      return Object.freeze({
        valid,
        dispatch: /* @__PURE__ */ __name((commit) => {
          if (!valid() || !commit() || !revisionsMatch())
            throw new Error("player.reload ownership ended");
          dispatched = true;
          this.#clearKeyboardPlayback();
          this.#clearOwnedReload();
          this.#reload.core = sourceCore;
          const revision2 = ++this.#reload.revision;
          const owner = video ? {
            revision: revision2,
            video,
            player,
            lifecycle,
            userRevision,
            sourceCore: this.#reload.core,
            replacement: null,
            sawNull: false,
            stable: false,
            cancel: /* @__PURE__ */ __name(() => void 0, "cancel")
          } : null;
          this.#reload.owned = owner;
          this.#reload.awaitCore = owner !== null;
          if (owner)
            owner.cancel = this.environment.scheduler.timeout(() => {
              if (this.#reload.owned === owner) this.#clearOwnedReload();
            }, 15e3);
          if (this.#reload.owned !== owner || this.#reload.revision !== revision2 || this.#seek.revision !== seekRevision || this.#controlRevision !== controlRevision || this.#userRevision !== userRevision) {
            if (this.#reload.owned === owner) this.#clearOwnedReload();
            throw new Error("player.reload ownership ended");
          }
          this.#reload.internalDepth++;
          const beforePosition = this.#seek.nativePosition;
          try {
            const result = Reflect.apply(reload, player, []);
            if (result && (typeof result === "object" || typeof result === "function"))
              void Promise.resolve(result).catch(() => {
                if (this.#reload.owned === owner) this.#clearOwnedReload();
              });
            return result;
          } catch (error) {
            if (this.#reload.owned === owner) this.#clearOwnedReload();
            throw error;
          } finally {
            try {
              if (video && this.#reload.owned === owner)
                this.#observeNativePosition(
                  video,
                  player,
                  this.#seek.nativePosition === beforePosition
                );
            } catch {
              if (this.#reload.owned === owner) this.#seek.revision++;
            } finally {
              this.#reload.internalDepth--;
            }
          }
        }, "dispatch")
      });
    }
    #nativeWriteGuard(canCommit) {
      const revision2 = this.#controlRevision, user = this.#userRevision, seek = this.#seek.revision, reload = this.#reload.revision, video = this.sources.video(), player = this.sources.player(), lifecycle = this.sources.lifecycleKey(), core = safeCall(player, "__core");
      const revisionsMatch = /* @__PURE__ */ __name(() => revision2 === this.#controlRevision && user === this.#userRevision && seek === this.#seek.revision && reload === this.#reload.revision, "revisionsMatch");
      return () => {
        try {
          if (!canCommit() || !revisionsMatch()) return false;
          const same = video === this.sources.video() && player === this.sources.player() && lifecycle === this.sources.lifecycleKey() && core === safeCall(player, "__core") && this.environment.isActuallyVisible();
          return same && canCommit() && revisionsMatch();
        } catch {
          return false;
        }
      };
    }
    seek(value, canCommit = () => true) {
      this.#seekCommand(value, canCommit);
    }
    #seekCommand(value, canCommit) {
      this.#invalidatePlayback();
      this.#clearKeyboardSeek();
      this.#clearKeyboardPlayback();
      const nativeCurrent = this.#nativeWriteGuard(canCommit);
      if (this.#seek.goal?.position === value) {
        this.#seek.goal.baseline = null;
        this.#seek.goal.progress = 0;
      }
      this.#seek.internalDepth++;
      this.#seek.pending = value;
      try {
        const player = this.sources.player(), method = player?.seek;
        const dispatched = this.#sdkCommand(player, method, value, nativeCurrent);
        if (dispatched) return dispatched;
        const video = this.sources.video();
        if (video && nativeCurrent()) {
          video.currentTime = value;
          return { channel: "native", result: void 0 };
        }
        return { channel: "none", result: void 0 };
      } finally {
        this.#seek.internalDepth--;
      }
    }
    setRate(value, canCommit = () => true) {
      this.#rateCommand(value, canCommit);
    }
    #rateCommand(value, canCommit, fallbackOnThrow = true) {
      this.#invalidatePlayback();
      this.#clearKeyboardPlayback();
      const nativeCurrent = this.#nativeWriteGuard(canCommit);
      const player = this.sources.player(), method = player?.setPlaybackRate;
      try {
        const dispatched = this.#sdkCommand(player, method, value, nativeCurrent);
        if (dispatched) return dispatched;
      } catch (error) {
        if (!fallbackOnThrow) throw error;
      }
      const video = this.sources.video();
      if (video && nativeCurrent()) {
        video.playbackRate = value;
        return { channel: "native", result: void 0 };
      }
      return { channel: "none", result: void 0 };
    }
    #sdkCommand(player, method, value, current) {
      if (!player || typeof method !== "function") return null;
      if (!current()) return { channel: "none", result: void 0 };
      return { channel: "sdk", result: Reflect.apply(method, player, [value]) };
    }
    #restoreRecord(attempt) {
      const record = attempt.kind === "position" ? this.#restores.position : this.#restores.rate;
      return record?.attempt.proof === attempt.proof ? record : null;
    }
    #restoreCurrent(record, policy = true) {
      return this.#restoreRecord(record.attempt) === record && (!policy || record.guard.valid()) && this.ownedReload(record.guard.reloadRevision) && record.localCurrent() && this.#restoreRecord(record.attempt) === record;
    }
    #settleRestore(attempt, rejected) {
      const record = this.#restoreRecord(attempt);
      if (record && this.#restoreCurrent(record, false))
        record.status = rejected ? "rejected" : "settled";
    }
    #pendingRestoreSeek(position) {
      const record = this.#restores.position;
      return !!record && (record.inCall || record.status === "pending") && (position === record.originPosition || position === record.command.value) && this.#restoreCurrent(record, false);
    }
    #watchRestoreResult(attempt, result) {
      const record = this.#restoreRecord(attempt);
      if (!record) return;
      if (result !== null && (typeof result === "object" || typeof result === "function")) {
        record.status = "pending";
        void Promise.resolve(result).then(
          () => this.#settleRestore(attempt, false),
          () => this.#settleRestore(attempt, true)
        );
      }
    }
    performRestore(command, guard) {
      if (!Number.isFinite(command.value) || command.value < 0 || command.kind === "rate" && command.value === 0 || !Number.isFinite(command.at))
        throw Error("invalid restore command");
      const attempt = Object.freeze({ kind: command.kind, proof: Object.freeze({}) });
      const origin = this.sources.video()?.currentTime;
      const record = {
        command: Object.freeze({ ...command }),
        guard,
        attempt,
        localCurrent: this.#nativeWriteGuard(() => true),
        channel: "none",
        status: "settled",
        landing: null,
        originPosition: typeof origin === "number" && Number.isFinite(origin) ? origin : null,
        inCall: true
      };
      if (command.kind === "position") this.#restores.position = record;
      else this.#restores.rate = record;
      const current = /* @__PURE__ */ __name(() => this.#restoreCurrent(record), "current");
      let applied;
      try {
        applied = command.kind === "position" ? this.#seekCommand(command.value, current) : this.#rateCommand(command.value, current, false);
      } catch {
        record.channel = "sdk";
        record.status = "rejected";
        return attempt;
      } finally {
        record.inCall = false;
      }
      if (this.#restoreRecord(attempt) === record) {
        record.channel = applied.channel;
        this.#watchRestoreResult(attempt, applied.result);
      }
      return attempt;
    }
    #noteRestoreLanding() {
      const record = this.#restores.position;
      if (!record || record.landing || !this.#restoreCurrent(record, false)) return;
      try {
        const video = this.sources.video(), at = record.guard.now();
        if (!video) return;
        const positionSec = video.currentTime;
        if (video.seeking || video.readyState < 1 || !Number.isFinite(positionSec) || !Number.isFinite(at) || Math.abs(positionSec - record.command.value) > 1)
          return;
        if (this.#restoreCurrent(record, false)) record.landing = Object.freeze({ positionSec, at });
      } catch {
      }
    }
    readRestore(attempt, mode = "command") {
      const unknown = /* @__PURE__ */ __name(() => ({
        owned: false,
        channel: "none",
        status: "settled",
        positionSec: null,
        rate: null,
        paused: null,
        seeking: null,
        readyState: null,
        landing: null
      }), "unknown");
      const record = this.#restoreRecord(attempt);
      if (!record) return unknown();
      const current = /* @__PURE__ */ __name(() => mode === "progress" ? this.#restoreRecord(attempt) === record && record.localCurrent() && this.#restoreRecord(attempt) === record : this.#restoreCurrent(record), "current");
      if (!current()) return unknown();
      try {
        this.#noteRestoreLanding();
        const video = this.sources.video();
        if (!video) return unknown();
        const position = video.currentTime, rate = video.playbackRate, paused = video.paused, seeking = video.seeking, ready = video.readyState;
        if (!current()) return unknown();
        return Object.freeze({
          owned: true,
          channel: record.channel,
          status: record.status,
          positionSec: typeof position === "number" && Number.isFinite(position) && position >= 0 ? position : null,
          rate: typeof rate === "number" && Number.isFinite(rate) && rate > 0 ? rate : null,
          paused: typeof paused === "boolean" ? paused : null,
          seeking: typeof seeking === "boolean" ? seeking : null,
          readyState: Number.isInteger(ready) && ready >= 0 && ready <= 4 ? ready : null,
          landing: record.landing ? Object.freeze({ ...record.landing }) : null
        });
      } catch {
        return {
          ...unknown(),
          owned: current(),
          channel: record.channel,
          status: record.status
        };
      }
    }
    correctRestore(attempt) {
      const record = this.#restoreRecord(attempt);
      if (!record || record.channel === "native" || record.status === "pending" || record.guard.now() - record.command.at < 1e3 || !this.#restoreCurrent(record))
        return;
      const video = this.sources.video();
      if (!video || video.seeking || video.readyState < 1 || !this.#restoreCurrent(record)) return;
      record.channel = "native";
      record.status = "settled";
      if (record.command.kind === "position") {
        record.landing = null;
        this.#seek.pending = record.command.value;
        this.#seek.internalDepth++;
        try {
          if (this.#restoreCurrent(record)) video.currentTime = record.command.value;
        } catch {
        } finally {
          this.#seek.internalDepth--;
        }
      } else {
        try {
          if (this.#restoreCurrent(record)) video.playbackRate = record.command.value;
        } catch {
        }
      }
    }
    play(canCommit = () => true) {
      this.#invalidatePlayback();
      this.#clearKeyboardPlayback();
      const current = this.#nativeWriteGuard(canCommit);
      const player = this.sources.player(), method = player?.play;
      if (!player || typeof method !== "function") throw new Error("player.play unavailable");
      if (!current()) return void 0;
      return Reflect.apply(method, player, []);
    }
    reset() {
      this.#invalidatePlayback();
      this.#clearControls();
      this.#reload.awaitCore = false;
      this.#reload.coreRevision = 0;
      this.#seek.revision++;
      this.#userRevision++;
      this.#seek.targetSec = null;
    }
  };

  // src-v2/adapters/player/player-media.ts
  var PlayerMediaReader = class {
    static {
      __name(this, "PlayerMediaReader");
    }
    #cachedVideo = null;
    video() {
      if (this.#cachedVideo?.isConnected && this.#area(this.#cachedVideo) > 0)
        return this.#cachedVideo;
      const videos = [...document.querySelectorAll("video")];
      const connected = videos.filter((video) => video.isConnected);
      const best = connected.sort((a, b) => this.#area(b) - this.#area(a))[0] ?? null;
      if (best && this.#area(best) > 0) this.#cachedVideo = best;
      else if (!this.#cachedVideo?.isConnected) this.#cachedVideo = best;
      return this.#cachedVideo;
    }
    #area(video) {
      return Math.max(0, video.clientWidth) * Math.max(0, video.clientHeight);
    }
    reset() {
      this.#cachedVideo = null;
    }
  };
  function readVideoSnapshot(video, player) {
    const core = safeCall(player, "__core");
    let coreInitialized = null, manifestHasVideo = false;
    try {
      const value = isRecord2(core) && isRecord2(core.state) ? core.state.initialized : null;
      coreInitialized = typeof value === "boolean" ? value : null;
    } catch {
    }
    const mpd = safeCall(core, "getMpd");
    if (isRecord2(mpd)) manifestHasVideo = Array.isArray(mpd.video) && mpd.video.length > 0;
    if (!video)
      return {
        available: false,
        paused: true,
        seeking: false,
        ended: false,
        readyState: 0,
        currentTime: 0,
        duration: null,
        width: 0,
        height: 0,
        playbackRate: 1,
        effectiveRate: 2,
        bufferAheadSec: 0,
        playableBufferSec: 0,
        bufferedToEnd: false,
        frames: null,
        mediaError: false,
        coreInitialized,
        manifestHasVideo
      };
    const currentTime = safeNumber(video.currentTime) ?? 0, durationRaw = safeNumber(video.duration);
    const duration = durationRaw !== null && durationRaw > 0 ? durationRaw : null;
    let end = currentTime;
    try {
      for (let index = 0; index < video.buffered.length; index++) {
        const start2 = video.buffered.start(index), rangeEnd = video.buffered.end(index);
        if (start2 <= currentTime + 0.05 && rangeEnd >= currentTime - 0.05) {
          end = Math.max(end, rangeEnd);
          break;
        }
      }
    } catch {
    }
    const rate = safeNumber(video.playbackRate) ?? 0, effectiveRate = rate > 0 ? rate : 2;
    let frames = null;
    try {
      frames = video.getVideoPlaybackQuality?.().totalVideoFrames ?? null;
    } catch {
    }
    return {
      available: true,
      paused: video.paused,
      seeking: video.seeking,
      ended: video.ended,
      readyState: video.readyState,
      currentTime,
      duration,
      width: video.videoWidth,
      height: video.videoHeight,
      playbackRate: rate,
      effectiveRate,
      bufferAheadSec: Math.max(0, end - currentTime),
      playableBufferSec: Math.max(0, end - currentTime) / effectiveRate,
      bufferedToEnd: duration !== null && end >= duration - 0.1,
      frames,
      mediaError: !!video.error,
      coreInitialized,
      manifestHasVideo
    };
  }
  __name(readVideoSnapshot, "readVideoSnapshot");
  function clonePlayerManifest(mpd) {
    const cloneList = /* @__PURE__ */ __name((value, limit) => (Array.isArray(value) ? value : []).slice(0, limit).flatMap((item) => {
      if (!isRecord2(item)) return [];
      const base = typeof item.baseUrl === "string" ? item.baseUrl : typeof item.base_url === "string" ? item.base_url : typeof item.url === "string" ? item.url : "";
      const backups = Array.isArray(item.backupUrl) ? item.backupUrl : Array.isArray(item.backup_url) ? item.backup_url : [];
      const urls = [base, ...backups].filter(
        (url) => typeof url === "string" && url.length > 0 && url.length <= 16 * 1024
      ).slice(0, 4);
      if (!urls.length) return [];
      const frameRate = declaredFrameRate(item.frame_rate ?? item.frameRate);
      return [
        {
          base_url: urls[0],
          backup_url: urls.slice(1),
          id: item.id,
          codecid: item.codecid ?? item.codecId,
          codecs: item.codecs ?? item.codec,
          width: item.width,
          height: item.height,
          bandwidth: item.bandwidth ?? item.bitrate,
          ...frameRate !== void 0 ? { frame_rate: frameRate } : {}
        }
      ];
    }), "cloneList");
    const video = cloneList(mpd.video, 128), audio = cloneList(mpd.audio, 64);
    return video.length || audio.length ? { video, audio } : null;
  }
  __name(clonePlayerManifest, "clonePlayerManifest");

  // src-v2/adapters/player/player.ts
  var PlayerAdapter = class {
    constructor(playurl, environment) {
      this.playurl = playurl;
      this.#controls = new PlayerControlObserver(
        {
          video: /* @__PURE__ */ __name(() => this.video(), "video"),
          player: /* @__PURE__ */ __name(() => this.player(), "player"),
          lifecycleKey: /* @__PURE__ */ __name(() => this.playurl.lifecycleKey(), "lifecycleKey")
        },
        environment
      );
    }
    playurl;
    static {
      __name(this, "PlayerAdapter");
    }
    #media = new PlayerMediaReader();
    #controls;
    #manifestFingerprint = "";
    player() {
      try {
        return isRecord2(unsafeWindow.player) ? unsafeWindow.player : null;
      } catch {
        return null;
      }
    }
    controls() {
      return this.#controls.controls();
    }
    captureResumePosition() {
      return this.#controls.captureResumePosition(() => this.currentTime());
    }
    validateResumePosition(capture, initializationRevision) {
      return this.#controls.validateResumePosition(capture, initializationRevision);
    }
    ownedReload(revision2) {
      return this.#controls.ownedReload(revision2);
    }
    performRestore(command, guard) {
      return this.#controls.performRestore(command, guard);
    }
    readRestore(attempt, mode) {
      return this.#controls.readRestore(attempt, mode);
    }
    correctRestore(attempt) {
      this.#controls.correctRestore(attempt);
    }
    observePlayIntent(listener) {
      return this.#controls.observePlayIntent(listener);
    }
    playbackRevision() {
      return this.#controls.playbackRevision();
    }
    observePlaybackInvalidation(listener) {
      return this.#controls.observePlaybackInvalidation(listener);
    }
    video() {
      return this.#media.video();
    }
    snapshot() {
      return readVideoSnapshot(this.video(), this.player());
    }
    syncManifest() {
      const player = this.player(), core = safeCall(player, "__core"), mpd = safeCall(core, "getMpd");
      if (!isRecord2(mpd)) return false;
      const cloned = clonePlayerManifest(mpd);
      if (!cloned) return false;
      const fingerprint = `${this.playurl.lifecycleKey()}:${JSON.stringify(cloned)}`;
      if (fingerprint === this.#manifestFingerprint) return true;
      const accepted = this.playurl.transform(
        { code: 0, data: { dash: cloned } },
        "player-mpd"
      ).accepted;
      if (accepted) this.#manifestFingerprint = fingerprint;
      return accepted;
    }
    prepareReload() {
      return this.#controls.prepareReload();
    }
    reload() {
      return this.#controls.reload();
    }
    currentTime() {
      const video = this.video();
      try {
        if (video?.readyState === 0) {
          const position = video.currentTime;
          if (Number.isFinite(position)) return position;
        }
      } catch {
      }
      return safeNumber(safeCall(this.player(), "getCurrentTime")) ?? this.snapshot().currentTime;
    }
    playbackRate() {
      const before = this.controls(), video = this.video();
      let native = null;
      try {
        native = safeNumber(video?.playbackRate);
      } catch {
      }
      const rate = native !== null && native > 0 ? native : safeNumber(safeCall(this.player(), "getPlaybackRate"));
      const after = this.controls();
      return before.mediaId === after.mediaId && before.userRevision === after.userRevision && before.seekRevision === after.seekRevision && before.coreId === after.coreId && video === this.video() && rate !== null && rate > 0 ? rate : 0;
    }
    seek(value, canCommit) {
      this.#controls.seek(value, canCommit);
    }
    setRate(value, canCommit) {
      this.#controls.setRate(value, canCommit);
    }
    play(canCommit) {
      return this.#controls.play(canCommit);
    }
    reset() {
      this.#controls.reset();
      this.#media.reset();
      this.#manifestFingerprint = "";
    }
  };

  // src-v2/adapters/playurl/page-playinfo.ts
  var PagePlayinfoAdapter = class {
    constructor(onAssignment, rewriteBeforePageSetter = () => false) {
      this.onAssignment = onAssignment;
      this.rewriteBeforePageSetter = rewriteBeforePageSetter;
    }
    onAssignment;
    rewriteBeforePageSetter;
    static {
      __name(this, "PagePlayinfoAdapter");
    }
    #restore = null;
    #serial = 0;
    #current = void 0;
    install() {
      if (this.#restore) return;
      const target = unsafeWindow;
      let descriptor;
      try {
        descriptor = Object.getOwnPropertyDescriptor(target, "__playinfo__");
      } catch {
        return;
      }
      if (descriptor && descriptor.configurable === false) {
        try {
          this.#adopt(target.__playinfo__);
        } catch {
        }
        return;
      }
      let value;
      try {
        value = descriptor?.get ? descriptor.get.call(target) : descriptor?.value;
      } catch {
        value = void 0;
      }
      this.#current = value;
      const adapter = this;
      const getter = /* @__PURE__ */ __name(() => {
        let current;
        if (descriptor?.get) {
          try {
            current = descriptor.get.call(target);
          } catch {
            current = adapter.#current;
          }
        } else current = adapter.#current;
        if (!adapter.rewriteBeforePageSetter()) return current;
        try {
          return adapter.#adopt(current) ? current : void 0;
        } catch {
          return void 0;
        }
      }, "getter");
      const setter = /* @__PURE__ */ __name((next) => {
        if (adapter.rewriteBeforePageSetter()) {
          const previous = adapter.#current;
          try {
            if (!adapter.#adopt(next)) {
              adapter.#current = previous;
              return;
            }
          } catch {
            adapter.#current = previous;
            return;
          }
          if (descriptor?.set) descriptor.set.call(target, next);
          return;
        }
        if (descriptor?.set) descriptor.set.call(target, next);
        else adapter.#current = next;
        adapter.#adopt(next);
      }, "setter");
      try {
        Object.defineProperty(target, "__playinfo__", {
          configurable: true,
          enumerable: descriptor?.enumerable ?? true,
          get: getter,
          set: setter
        });
      } catch {
        return;
      }
      this.#restore = () => {
        try {
          const current = Object.getOwnPropertyDescriptor(target, "__playinfo__");
          if (current?.get !== getter || current.set !== setter) return;
          if (descriptor) Object.defineProperty(target, "__playinfo__", descriptor);
          else {
            delete target.__playinfo__;
            if (adapter.#current !== void 0) target.__playinfo__ = adapter.#current;
          }
        } catch {
        }
      };
      if (value !== void 0) this.#adopt(value);
    }
    current() {
      try {
        return unsafeWindow.__playinfo__;
      } catch {
        return this.#current;
      }
    }
    dispose() {
      this.#restore?.();
      this.#restore = null;
    }
    #adopt(payload) {
      this.#current = payload;
      return this.onAssignment(payload, ++this.#serial) !== false;
    }
  };

  // src-v2/adapters/transport/transport-context.ts
  var hostOf = /* @__PURE__ */ __name((value) => {
    try {
      return new URL(value, location.href).hostname.toLowerCase();
    } catch {
      return "";
    }
  }, "hostOf");
  var sameUrl = /* @__PURE__ */ __name((responseUrl, requestUrl) => {
    try {
      return !!responseUrl && new URL(responseUrl, location.href).href === new URL(requestUrl, location.href).href;
    } catch {
      return false;
    }
  }, "sameUrl");
  var catalogTarget = /* @__PURE__ */ __name((applied) => !!applied?.url && applied.decision.action === "rewrite" && applied.decision.routeType === "catalog-generated" && isCatalogHost(applied.decision.host) && hostOf(applied.url) === applied.decision.host, "catalogTarget");
  function responseFailure(routeType, status) {
    return routeType === "native-signed" && [403, 451, 959].includes(status) ? "native-invalid" : status >= 500 ? "http-5xx" : void 0;
  }
  __name(responseFailure, "responseFailure");
  var blockedPlayurl = /* @__PURE__ */ __name(() => ({
    code: -1,
    message: "BiliCDN Catalog route unavailable"
  }), "blockedPlayurl");
  var blockedPlayurlText = /* @__PURE__ */ __name(() => JSON.stringify(blockedPlayurl()), "blockedPlayurlText");
  var rejectedPlayurl = /* @__PURE__ */ __name((reason) => ({
    accepted: false,
    formats: [],
    videoCount: 0,
    audioCount: 0,
    segmentCount: 0,
    upstreamCode: null,
    reason
  }), "rejectedPlayurl");
  var copyResponseSurface = /* @__PURE__ */ __name((target, source) => {
    for (const key of ["url", "redirected", "type"]) {
      try {
        Object.defineProperty(target, key, {
          configurable: true,
          enumerable: true,
          value: source[key]
        });
      } catch {
      }
    }
    return target;
  }, "copyResponseSurface");
  var TransportContext = class {
    constructor(session, settings, routes, playurl, measurement, now, ids, monotonicNow = () => null) {
      this.session = session;
      this.settings = settings;
      this.routes = routes;
      this.playurl = playurl;
      this.measurement = measurement;
      this.now = now;
      this.ids = ids;
      this.monotonicNow = monotonicNow;
    }
    session;
    settings;
    routes;
    playurl;
    measurement;
    now;
    ids;
    monotonicNow;
    static {
      __name(this, "TransportContext");
    }
    #requestSerial = 0;
    #apiDispatchSerial = 0;
    #stats = {
      enteredFetch: 0,
      enteredXhr: 0,
      mediaRecognized: 0,
      nativeCalled: 0,
      responseObserved: 0,
      blocked: 0
    };
    #lastMedia = null;
    #lastBlocked = null;
    #lastPlayurl = null;
    #lastApiEndpoint = null;
    tick() {
      return readMonotonic(this.monotonicNow);
    }
    freezeMeasurement(start2, response, basis) {
      const end = this.tick(), completedAt = this.now();
      return Object.freeze({
        ...measuredTiming(start2, response, end),
        completedAt,
        timingBasis: basis
      });
    }
    count(stage) {
      this.#stats[stage]++;
    }
    dispatchFailure(input) {
      const strict = input.managedMedia && this.routes.isCatalogOnly();
      if (strict && !this.session.isGeneration(input.generation)) return "catalog-unavailable";
      const applied = input.applied;
      if (applied?.decision.action === "block") return applied.decision.reason;
      if (applied && !applied.url) return "catalog-unavailable";
      if (strict && (!catalogTarget(applied) || !sameUrl(applied?.url ?? "", input.targetUrl)))
        return "catalog-unavailable";
      return null;
    }
    blocked(method, url, reason) {
      this.#stats.blocked++;
      this.#lastBlocked = Object.freeze({ method, host: hostOf(url), reason });
    }
    apiDispatch(url, captured) {
      return Object.freeze({
        ...captured ?? playurlRequestContext(url),
        generation: Number(this.session.get().generation),
        requestSequence: ++this.#apiDispatchSerial
      });
    }
    nextResponseKey(prefix) {
      return `${prefix}-${++this.#requestSerial}`;
    }
    noteApiEndpoint(transport, kind) {
      if (!["playurl", "ogv-playview", "ogv-precheck"].includes(kind)) return;
      this.#lastApiEndpoint = Object.freeze({ kind, transport, observedAt: this.now() });
    }
    notePlayurl(transport, status, result, endpointKind = "playurl") {
      const count = /* @__PURE__ */ __name((value) => Number.isFinite(value) ? Math.max(0, Math.min(65535, Math.trunc(value))) : 0, "count");
      const reasons2 = [
        "upstream-error",
        "unsupported-format",
        "malformed-payload",
        "unreplaceable-source",
        "no-legal-route",
        "inactive"
      ];
      this.#lastPlayurl = Object.freeze({
        endpointKind: ["playurl", "ogv-playview", "ogv-precheck"].includes(endpointKind) ? endpointKind : "playurl",
        transport,
        status: Number.isInteger(status) && status >= 0 && status <= 599 ? status : 0,
        observedAt: this.now(),
        accepted: result.accepted === true,
        formats: Object.freeze(
          [
            ...new Set(result.formats.filter((format) => ["dash", "mp4", "flv"].includes(format)))
          ].slice(0, 3)
        ),
        videoCount: count(result.videoCount),
        audioCount: count(result.audioCount),
        segmentCount: count(result.segmentCount),
        upstreamCode: Number.isSafeInteger(result.upstreamCode) ? result.upstreamCode : null,
        reason: result.reason !== null && reasons2.includes(result.reason) ? result.reason : null
      });
    }
    snapshot() {
      return Object.freeze({
        ...this.#stats,
        lastMediaRequest: this.#lastMedia ? Object.freeze({ ...this.#lastMedia }) : null,
        lastBlocked: this.#lastBlocked,
        lastPlayurl: this.#lastPlayurl,
        lastApiEndpoint: this.#lastApiEndpoint
      });
    }
    request(applied, originalUrl, targetUrl, startedAt, method, expectedBytes = null, timingBasis2) {
      const state = this.session.get(), matched = applied.attributionStatus ?? (applied.context ? "matched" : "waiting-data");
      const request = this.routes.prepareRequest(
        Object.freeze({
          requestId: requestId(this.ids.next("request")),
          generation: state.generation,
          epoch: state.epoch,
          routePolicyRevision: this.routes.policyRevision(),
          decisionId: applied.decision.id,
          representation: applied.context?.representation ?? null,
          authorityRevision: applied.context?.authorityRevision ?? null,
          kind: applied.context?.kind ?? null,
          attributionStatus: matched,
          attributionSource: applied.attributionSource ?? (applied.context ? "exact" : "none"),
          decisionStage: "request",
          routeType: applied.decision.routeType,
          originalHost: hostOf(originalUrl),
          targetHost: hostOf(targetUrl),
          sourceHost: applied.sourceHost,
          playurlHostChanged: applied.playurlHostChanged ?? false,
          playurlOutput: applied.playurlOutput ?? null,
          urlChanged: originalUrl !== targetUrl,
          hostChanged: hostOf(originalUrl) !== hostOf(targetUrl),
          startedAt,
          expectedBytes: Number.isSafeInteger(expectedBytes) && (expectedBytes ?? 0) > 0 ? expectedBytes : null,
          ...timingBasis2 ? { timingBasis: timingBasis2 } : {}
        })
      );
      this.#lastMedia = {
        requestId: request.requestId,
        method,
        kind: request.kind ?? "unknown",
        originalHost: request.originalHost,
        targetHost: request.targetHost,
        hookEntered: true,
        mediaRecognized: true,
        nativeCalled: false,
        responseObserved: false,
        status: null
      };
      return request;
    }
    noteNativeCall(request) {
      if (request && this.#lastMedia?.requestId === request.requestId)
        this.#lastMedia.nativeCalled = true;
    }
    noteResponse(request, status) {
      if (request && this.#lastMedia?.requestId === request.requestId) {
        this.#lastMedia.responseObserved = true;
        this.#lastMedia.status = status;
      }
    }
    async observeFetch(request, applied, originalUrl, targetUrl, response, startedAt, responseAt, bytes, outcome, failureKind, measurement) {
      const finalUrl = response?.url || "";
      if (measurement && response) {
        let valid = false;
        try {
          valid = measuredPayload(
            bytes,
            response.headers.get("Content-Length"),
            response.headers.get("Content-Range")
          );
        } catch {
        }
        measurement = { ...measurement, speedEligible: measurement.speedEligible && valid };
      }
      await this.routes.observe(
        this.observation(
          request,
          applied,
          originalUrl,
          targetUrl,
          finalUrl,
          response?.status ?? 0,
          bytes,
          startedAt,
          responseAt,
          outcome,
          failureKind,
          !!response && !response.redirected && sameUrl(finalUrl, targetUrl),
          measurement
        )
      );
    }
    observation(request, applied, _originalUrl, _targetUrl, finalUrl, status, bytes, startedAt, responseAt, outcome, failureKind, responseUrlMatchesRequest = false, measurement) {
      const completedAt = measurement?.completedAt ?? this.now(), kind = request.kind;
      const routeType = applied.decision.routeType;
      return {
        request,
        generation: request.generation,
        epoch: request.epoch,
        decisionId: request.decisionId,
        representation: request.representation,
        kind,
        routeType,
        originalHost: request.originalHost,
        targetHost: request.targetHost,
        finalHost: finalUrl ? hostOf(finalUrl) || null : null,
        responseUrlMatchesRequest,
        streamKey: applied.streamKey,
        status,
        bytes,
        ttfbMs: measurement ? measurement.ttfbMs : responseAt > 0 ? responseAt - startedAt : null,
        elapsedMs: measurement ? measurement.elapsedMs : Math.max(0, completedAt - startedAt),
        ...measurement ? { timingBasis: measurement.timingBasis, speedEligible: measurement.speedEligible } : {},
        completedAt,
        outcome,
        ...failureKind ? { failureKind } : {}
      };
    }
  };

  // src-v2/adapters/transport/fetch-hook.ts
  var FetchHookAdapter = class {
    constructor(context) {
      this.context = context;
    }
    context;
    static {
      __name(this, "FetchHookAdapter");
    }
    install() {
      const original = unsafeWindow.fetch;
      if (typeof original !== "function") return null;
      const self = this.context;
      const wrapped = /* @__PURE__ */ __name(async function(input, init) {
        self.count("enteredFetch");
        let activeRequest = null;
        const native = /* @__PURE__ */ __name(async (source, originalInit = true) => {
          self.count("nativeCalled");
          self.noteNativeCall(activeRequest);
          const response2 = await Reflect.apply(
            original,
            this,
            originalInit ? [source, init] : [source]
          );
          self.count("responseObserved");
          self.noteResponse(activeRequest, response2.status);
          return response2;
        }, "native");
        if (self.settings.get().disabled) return await native(input);
        const sourceRequest = new Request(input, init);
        const originalUrl = sourceRequest.url;
        if (self.settings.get().blockHttpDns && isHttpDnsUrl(originalUrl, location.href)) {
          return new Response(
            JSON.stringify({ code: -1, message: "HTTPDNS blocked by BiliCDN v2" }),
            {
              status: 503,
              headers: { "content-type": "application/json; charset=utf-8" }
            }
          );
        }
        const endpoint = classifyPlayurlApi(originalUrl, location.href);
        if (endpoint) self.noteApiEndpoint("fetch", endpoint);
        if (endpoint === "ogv-precheck") return await native(sourceRequest, false);
        if (endpoint) {
          const generation2 = self.session.get().generation, responseKey = self.nextResponseKey("api-fetch");
          const requestContext = self.apiDispatch(originalUrl);
          const response2 = await native(sourceRequest, false);
          if (self.settings.get().disabled) return response2;
          const catalogOnly = /* @__PURE__ */ __name(() => !self.settings.get().disabled && self.routes.isCatalogOnly(), "catalogOnly");
          const blocked = /* @__PURE__ */ __name(() => copyResponseSurface(
            new Response(blockedPlayurlText(), {
              status: 503,
              headers: { "content-type": "application/json; charset=utf-8" }
            }),
            response2
          ), "blocked");
          let text3;
          try {
            text3 = await response2.text();
          } catch {
            self.notePlayurl(
              "fetch",
              response2.status,
              rejectedPlayurl(
                self.session.isGeneration(generation2) && !self.settings.get().disabled ? "malformed-payload" : "inactive"
              ),
              endpoint
            );
            return catalogOnly() ? blocked() : response2;
          }
          if (self.settings.get().disabled) {
            self.notePlayurl("fetch", response2.status, rejectedPlayurl("inactive"), endpoint);
            return copyResponseSurface(
              new Response(text3, {
                status: response2.status,
                statusText: response2.statusText,
                headers: response2.headers
              }),
              response2
            );
          }
          try {
            const payload = JSON.parse(text3);
            const result = self.session.isGeneration(generation2) && !self.settings.get().disabled ? self.playurl.transform(payload, "trusted-api", responseKey, requestContext) : rejectedPlayurl("inactive");
            self.notePlayurl("fetch", response2.status, result, endpoint);
            if (catalogOnly() && !result.accepted) return blocked();
            text3 = JSON.stringify(payload);
          } catch {
            self.notePlayurl("fetch", response2.status, rejectedPlayurl("malformed-payload"), endpoint);
            if (catalogOnly()) return blocked();
          }
          return copyResponseSurface(
            new Response(text3, {
              status: response2.status,
              statusText: response2.statusText,
              headers: response2.headers
            }),
            response2
          );
        }
        const method = sourceRequest.method.toUpperCase();
        if (!self.routes.recognizesMedia(originalUrl)) return await native(sourceRequest, false);
        self.count("mediaRecognized");
        const requestBytes = method === "GET" ? closedRangeLength(sourceRequest.headers.get("Range")) : null;
        const generation = self.session.get().generation;
        if (method === "GET") {
          if (self.measurement.willGateStartup(originalUrl)) {
            await self.measurement.prepareStartup(originalUrl, sourceRequest.signal, requestBytes);
          } else self.measurement.noteUnpreflighted("no-safe-startup-candidate");
        }
        if (self.settings.get().disabled) return await native(sourceRequest, false);
        if (!self.session.isGeneration(generation)) {
          if (self.routes.isCatalogOnly()) {
            self.blocked(method, originalUrl, "catalog-unavailable");
            throw new TypeError("BiliCDN blocked stale media request: catalog-unavailable");
          }
          const original2 = self.routes.inspectOriginal(originalUrl);
          if (original2.decision.action === "block" || !original2.url) {
            self.blocked(method, originalUrl, original2.decision.reason);
            throw new TypeError(`BiliCDN blocked media request: ${original2.decision.reason}`);
          }
          return await native(sourceRequest, false);
        }
        const applied = method === "GET" ? self.routes.apply(originalUrl, null, void 0, false, requestBytes, "fetch-consumer") : self.routes.inspectOriginal(originalUrl);
        const reason = self.dispatchFailure({
          generation,
          applied,
          targetUrl: applied.url ?? "",
          managedMedia: true
        });
        if (reason || !applied.url) {
          self.blocked(method, originalUrl, reason ?? "catalog-unavailable");
          throw new TypeError(`BiliCDN blocked media request: ${reason}`);
        }
        const targetInput = applied.url === originalUrl ? sourceRequest : new Request(applied.url, sourceRequest);
        const outbound = self.routes.isCatalogOnly() ? new Request(targetInput, { redirect: "error" }) : targetInput;
        const startedAt = self.now();
        const request = self.request(
          applied,
          originalUrl,
          applied.url,
          startedAt,
          method,
          requestBytes,
          "fetch-consumer"
        );
        activeRequest = request;
        self.routes.requestStarted(request);
        let response;
        const startedTick = self.tick();
        try {
          response = await native(outbound, false);
        } catch (error) {
          const signal = sourceRequest.signal;
          const aborted = signal?.aborted === true || error instanceof DOMException && error.name === "AbortError";
          void self.observeFetch(
            request,
            applied,
            originalUrl,
            applied.url,
            null,
            startedAt,
            0,
            0,
            aborted ? "abort" : "failure",
            aborted ? void 0 : "network",
            self.freezeMeasurement(startedTick, null, "fetch-consumer")
          );
          throw error;
        }
        const responseAt = self.now();
        const responseTick = self.tick();
        if (!response.body) {
          void self.observeFetch(
            request,
            applied,
            originalUrl,
            applied.url,
            response,
            startedAt,
            responseAt,
            0,
            response.ok ? "success" : "failure",
            responseFailure(applied.decision.routeType, response.status),
            self.freezeMeasurement(startedTick, responseTick, "fetch-consumer")
          );
          return response;
        }
        const reader = response.body.getReader();
        let bytes = 0, settled = false;
        const settle = /* @__PURE__ */ __name((outcome, failure) => {
          if (settled) return;
          const measurement = self.freezeMeasurement(startedTick, responseTick, "fetch-consumer");
          settled = true;
          void self.observeFetch(
            request,
            applied,
            originalUrl,
            applied.url ?? originalUrl,
            response,
            startedAt,
            responseAt,
            bytes,
            outcome,
            failure,
            measurement
          );
        }, "settle");
        const body = new ReadableStream({
          async pull(controller) {
            try {
              const result = await reader.read();
              if (result.done) {
                settle(
                  response.ok ? "success" : "failure",
                  responseFailure(applied.decision.routeType, response.status)
                );
                controller.close();
                return;
              }
              bytes += result.value.byteLength;
              controller.enqueue(result.value);
            } catch (error) {
              const signal = sourceRequest.signal;
              if (signal?.aborted) settle("abort");
              else settle("failure", "body");
              controller.error(error);
            }
          },
          async cancel(reason2) {
            settle("abort");
            await reader.cancel(reason2);
          }
        });
        return copyResponseSurface(
          new Response(body, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
          }),
          response
        );
      }, "wrapped");
      try {
        unsafeWindow.fetch = wrapped;
        if (unsafeWindow.fetch !== wrapped) {
          try {
            unsafeWindow.fetch = original;
          } catch {
          }
          return null;
        }
        return {
          isInstalled: /* @__PURE__ */ __name(() => unsafeWindow.fetch === wrapped, "isInstalled"),
          restore: /* @__PURE__ */ __name(() => {
            if (unsafeWindow.fetch === wrapped) unsafeWindow.fetch = original;
          }, "restore")
        };
      } catch {
        try {
          if (unsafeWindow.fetch === wrapped) unsafeWindow.fetch = original;
        } catch {
        }
        return null;
      }
    }
  };

  // src-v2/adapters/transport/xhr-dispatch.ts
  function createXhrPreparation(xhr, meta, waiting, native) {
    const responseType = xhr.responseType, credentials = xhr.withCredentials;
    let preparations = 0;
    const nativeReady = /* @__PURE__ */ __name(() => waiting(xhr, meta) && native.readyState?.get?.call(xhr) === 1, "nativeReady");
    const reopen = /* @__PURE__ */ __name((url) => {
      if (++preparations > 2)
        throw new DOMException("XHR preparation did not stabilize", "InvalidStateError");
      Reflect.apply(native.open, xhr, [
        meta.method,
        url,
        meta.async,
        meta.username ?? null,
        meta.password ?? null
      ]);
      if (!waiting(xhr, meta)) return;
      if (!nativeReady()) {
        meta.needsNativeOpen = true;
        return;
      }
      if (meta.async) {
        xhr.responseType = responseType;
        if (!nativeReady()) {
          if (waiting(xhr, meta)) meta.needsNativeOpen = true;
          return;
        }
        const requestTimeout = xhr.timeout;
        if (!nativeReady()) {
          if (waiting(xhr, meta)) meta.needsNativeOpen = true;
          return;
        }
        xhr.timeout = requestTimeout;
        if (!nativeReady()) {
          if (waiting(xhr, meta)) meta.needsNativeOpen = true;
          return;
        }
      }
      xhr.withCredentials = credentials;
      if (!nativeReady()) {
        if (waiting(xhr, meta)) meta.needsNativeOpen = true;
        return;
      }
      for (const [key, value] of meta.headers) {
        Reflect.apply(native.setHeader, xhr, [key, value]);
        if (!nativeReady()) {
          if (waiting(xhr, meta)) meta.needsNativeOpen = true;
          return;
        }
      }
      meta.targetUrl = url;
      meta.needsNativeOpen = false;
    }, "reopen");
    return { nativeReady, reopen };
  }
  __name(createXhrPreparation, "createXhrPreparation");

  // src-v2/adapters/transport/xhr-values.ts
  function convertXhrOpen(method, url, argumentCount, async, username, password) {
    const methodString = `${method}`;
    if (/[^\x00-\xff]/.test(methodString)) throw new TypeError("XHR method must be a ByteString");
    const originalUrl = `${url}`.toWellFormed();
    const asynchronous = argumentCount < 3 ? true : Boolean(async);
    const user = username == null ? null : `${username}`.toWellFormed();
    const pass = password == null ? null : `${password}`.toWellFormed();
    const normalizedMethod = /^(DELETE|GET|HEAD|OPTIONS|POST|PUT)$/i.test(methodString) ? methodString.toUpperCase() : methodString;
    return { methodString, originalUrl, asynchronous, user, pass, normalizedMethod };
  }
  __name(convertXhrOpen, "convertXhrOpen");
  function convertXhrHeader(name, value) {
    const key = `${name}`;
    if (/[^\x00-\xff]/.test(key)) throw new TypeError("XHR header name must be a ByteString");
    const text3 = `${value}`;
    if (/[^\x00-\xff]/.test(text3)) throw new TypeError("XHR header value must be a ByteString");
    return [key, text3];
  }
  __name(convertXhrHeader, "convertXhrHeader");
  function createXhrBodyConverter() {
    const bufferSize = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength")?.get;
    const blobSize = typeof Blob === "undefined" ? void 0 : Object.getOwnPropertyDescriptor(Blob.prototype, "size")?.get;
    const nodeType = typeof Node === "undefined" ? void 0 : Object.getOwnPropertyDescriptor(Node.prototype, "nodeType")?.get;
    const formHas = typeof FormData === "undefined" ? void 0 : FormData.prototype.has;
    const searchHas = typeof URLSearchParams === "undefined" ? void 0 : URLSearchParams.prototype.has;
    const branded = /* @__PURE__ */ __name((method, value, args = []) => {
      if (!method) return false;
      try {
        Reflect.apply(method, value, args);
        return true;
      } catch {
        return false;
      }
    }, "branded");
    const bodyValue = /* @__PURE__ */ __name((body) => {
      if (body == null) return null;
      if (typeof body === "object" || typeof body === "function") {
        if (ArrayBuffer.isView(body) || branded(bufferSize, body) || branded(blobSize, body) || branded(formHas, body, [""]) || branded(searchHas, body, [""]))
          return body;
        try {
          if (nodeType?.call(body) === 9) return body;
        } catch {
        }
      }
      return `${body}`.toWellFormed();
    }, "bodyValue");
    return bodyValue;
  }
  __name(createXhrBodyConverter, "createXhrBodyConverter");

  // src-v2/adapters/transport/xhr-request.ts
  function createXhrRequestState(getMetadata) {
    const waiting = /* @__PURE__ */ __name((xhr, meta) => getMetadata(xhr) === meta && meta.phase === "waiting", "waiting");
    const finishLocal = /* @__PURE__ */ __name((xhr, meta, type) => {
      if (!waiting(xhr, meta)) return;
      meta.phase = "terminal";
      meta.virtualReadyState = 4;
      meta.cleanup();
      if (!meta.async) throw new DOMException("BiliCDN blocked request", "NetworkError");
      const owns = /* @__PURE__ */ __name(() => getMetadata(xhr) === meta && meta.virtualReadyState === 4, "owns");
      xhr.dispatchEvent(new Event("readystatechange"));
      if (owns()) xhr.dispatchEvent(new ProgressEvent(type));
      if (owns()) xhr.dispatchEvent(new ProgressEvent("loadend"));
    }, "finishLocal");
    const rejectLocal = /* @__PURE__ */ __name((xhr, meta) => {
      if (meta.async) queueMicrotask(() => finishLocal(xhr, meta, "error"));
      else finishLocal(xhr, meta, "error");
    }, "rejectLocal");
    return { waiting, finishLocal, rejectLocal };
  }
  __name(createXhrRequestState, "createXhrRequestState");
  function resetXhrTransform(meta, strict) {
    if (meta.catalogOnlyAtTransform !== strict) {
      meta.transformedText = null;
      meta.transformedJson = void 0;
      meta.catalogOnlyAtTransform = strict;
    }
  }
  __name(resetXhrTransform, "resetXhrTransform");
  function createXhrCompletion(xhr, meta, self, retry, current) {
    let nativeBytes = 0;
    const noteHeaders = /* @__PURE__ */ __name(() => {
      if (current() && meta.responseTick === null && xhr.readyState >= 2) {
        meta.responseAt = self.now();
        meta.responseTick = self.tick();
      }
    }, "noteHeaders");
    const progress = /* @__PURE__ */ __name((event) => {
      if (!current()) return;
      noteHeaders();
      meta.bytes = Math.max(meta.bytes, Number(event.loaded) || 0);
      if (event.isTrusted && Number.isSafeInteger(event.loaded) && event.loaded >= 0)
        nativeBytes = Math.max(nativeBytes, event.loaded);
      retry.progress(xhr, meta, event);
    }, "progress");
    const settle = /* @__PURE__ */ __name((outcome, failure, nativeTimeout = false, event) => {
      if (meta.settled || !current()) return;
      meta.measurement = self.freezeMeasurement(meta.startedTick, meta.responseTick, "xhr-terminal");
      let payloadValid = false;
      try {
        payloadValid = measuredPayload(
          meta.bytes,
          xhr.getResponseHeader("Content-Length"),
          xhr.getResponseHeader("Content-Range")
        );
      } catch {
      }
      if (!current() || meta.settled) return;
      meta.measurement = {
        ...meta.measurement,
        speedEligible: meta.measurement.speedEligible && payloadValid
      };
      if (event && !event.isTrusted && retry.tracks(meta)) return;
      const verifiedBytes = outcome === "success" ? retry.verifiedBytes(xhr, meta) : null;
      const controlledTimeout = retry.terminal(xhr, meta, nativeTimeout ? "timeout" : outcome);
      if (controlledTimeout) {
        outcome = "abort";
        failure = void 0;
      }
      meta.settled = true;
      meta.cleanup();
      if (meta.responseAt > 0 || xhr.status > 0) {
        self.count("responseObserved");
        self.noteResponse(meta.request, Number(xhr.status) || 0);
      }
      if (!meta.applied || !meta.request) return;
      const finalUrl = (() => {
        try {
          return xhr.responseURL || "";
        } catch {
          return "";
        }
      })();
      void self.routes.observe({
        circuitVerified: event?.isTrusted === true && nativeBytes === meta.bytes && nativeBytes >= 65536,
        ...self.observation(
          meta.request,
          meta.applied,
          meta.originalUrl,
          meta.targetUrl,
          finalUrl,
          Number(xhr.status) || 0,
          meta.bytes,
          meta.startedAt,
          meta.responseAt,
          outcome,
          failure,
          sameUrl(finalUrl, meta.targetUrl),
          meta.measurement
        ),
        ...controlledTimeout ? { terminationReason: "early-retry-timeout" } : {},
        ...verifiedBytes !== null ? { retryVerifiedBytes: verifiedBytes } : {}
      });
    }, "settle");
    return { noteHeaders, progress, settle };
  }
  __name(createXhrCompletion, "createXhrCompletion");

  // src-v2/adapters/transport/xhr-response.ts
  function transformXhrText(context, state, raw, strict, status) {
    if (state.transformedText === null) {
      try {
        const payload = JSON.parse(raw), result = context.playurl.transform(
          payload,
          "trusted-api",
          state.responseKey,
          state.requestContext
        );
        context.notePlayurl("xhr", status(), result, state.apiEndpoint ?? "playurl");
        state.transformedText = strict && !result.accepted ? blockedPlayurlText() : JSON.stringify(payload);
      } catch {
        context.notePlayurl(
          "xhr",
          status(),
          rejectedPlayurl("malformed-payload"),
          state.apiEndpoint ?? "playurl"
        );
        state.transformedText = strict ? blockedPlayurlText() : raw;
      }
    }
    return state.transformedText;
  }
  __name(transformXhrText, "transformXhrText");
  function transformXhrJson(context, state, raw, strict, status) {
    if (state.transformedJson === void 0) {
      try {
        const result = context.playurl.transform(
          raw,
          "trusted-api",
          state.responseKey,
          state.requestContext
        );
        context.notePlayurl("xhr", status(), result, state.apiEndpoint ?? "playurl");
        state.transformedJson = strict && !result.accepted ? blockedPlayurl() : raw;
      } catch {
        context.notePlayurl(
          "xhr",
          status(),
          rejectedPlayurl("malformed-payload"),
          state.apiEndpoint ?? "playurl"
        );
        state.transformedJson = strict ? blockedPlayurl() : raw;
      }
    }
    return state.transformedJson;
  }
  __name(transformXhrJson, "transformXhrJson");

  // src-v2/adapters/transport/xhr-early-retry.ts
  var XhrEarlyRetry = class {
    constructor(proto, context, metadata, routes) {
      this.proto = proto;
      this.context = context;
      this.metadata = metadata;
      this.routes = routes;
      this.#descriptor = Object.getOwnPropertyDescriptor(proto, "timeout");
      this.#status = Object.getOwnPropertyDescriptor(proto, "status");
      this.#responseUrl = Object.getOwnPropertyDescriptor(proto, "responseURL");
      this.#ready = Object.getOwnPropertyDescriptor(proto, "readyState");
      try {
        this.#header = proto.getResponseHeader;
      } catch {
        return;
      }
      const descriptor = this.#descriptor;
      if (!routes || !descriptor?.get || !descriptor.set || !descriptor.configurable || !this.#status?.get || !this.#responseUrl?.get || !this.#ready?.get || typeof this.#header !== "function")
        return;
      const owner = this;
      this.#get = function() {
        return descriptor.get.call(this);
      };
      this.#set = function(value) {
        descriptor.set.call(this, value);
        owner.#writes.set(this, (owner.#writes.get(this) ?? 0) + 1);
        for (const flight of owner.#active.values())
          if (flight.xhr === this) {
            const permit = flight.lease?.permit;
            flight.lease = null;
            if (permit) owner.cancel(permit);
          }
      };
      try {
        Object.defineProperty(proto, "timeout", { ...descriptor, get: this.#get, set: this.#set });
        this.#capable = Object.getOwnPropertyDescriptor(proto, "timeout")?.set === this.#set;
      } catch {
      }
    }
    proto;
    context;
    metadata;
    routes;
    static {
      __name(this, "XhrEarlyRetry");
    }
    #active = /* @__PURE__ */ new Map();
    #actions = /* @__PURE__ */ new Map();
    #selection = /* @__PURE__ */ new WeakMap();
    #writes = /* @__PURE__ */ new WeakMap();
    #descriptor;
    #get;
    #set;
    #capable = false;
    #status;
    #responseUrl;
    #ready;
    #header;
    #enabled() {
      return this.#capable && this.#ownsDescriptor() && !!this.routes && this.context.settings.get().earlyRetryEnabled === true && !this.context.settings.get().disabled;
    }
    #ownsDescriptor() {
      const current = Object.getOwnPropertyDescriptor(this.proto, "timeout");
      return !!this.#descriptor && current?.get === this.#get && current?.set === this.#set && current?.enumerable === this.#descriptor.enumerable && current?.configurable === this.#descriptor.configurable;
    }
    tracks(meta) {
      return !!meta.request && this.#active.get(meta.request.requestId)?.meta === meta;
    }
    verifiedBytes(xhr, meta) {
      const flight = meta.request ? this.#active.get(meta.request.requestId) : null;
      if (!flight || flight.xhr !== xhr || flight.total === null || flight.loaded !== flight.total)
        return null;
      try {
        if (this.#ready?.get?.call(xhr) !== 4 || this.#status?.get?.call(xhr) !== 206 || !sameUrl(String(this.#responseUrl?.get?.call(xhr) ?? ""), meta.targetUrl))
          return null;
        return flight.loaded;
      } catch {
        return null;
      }
    }
    #owns(flight) {
      return this.metadata(flight.xhr) === flight.meta && flight.meta.phase === "sent" && !flight.meta.settled;
    }
    #timeout(xhr) {
      return Number(this.#descriptor?.get?.call(xhr));
    }
    #response(flight) {
      const xhr = flight.xhr;
      if (!this.#owns(flight) || !this.routes?.earlyRetryRequestCurrent(flight.meta.request))
        return false;
      try {
        if (this.#ready?.get?.call(xhr) < 2 || this.#ready?.get?.call(xhr) >= 4 || this.#status?.get?.call(xhr) !== 206 || !sameUrl(String(this.#responseUrl?.get?.call(xhr) ?? ""), flight.meta.targetUrl))
          return false;
        const value = Reflect.apply(this.#header, xhr, ["Content-Range"]);
        const parsed = typeof value === "string" ? parseProbeRange(value, flight.start, flight.end - flight.start + 1) : null;
        if (!parsed || parsed.endByte !== flight.end) return false;
        flight.total = parsed.endByte - parsed.startByte + 1;
        return true;
      } catch {
        return false;
      }
    }
    register(xhr, meta) {
      if (!this.#enabled() || this.metadata(xhr) !== meta || meta.phase !== "sent" || meta.settled || !meta.request || !meta.async || meta.method !== "GET" || meta.playurl || meta.request.kind !== "video" || meta.request.routeType !== "catalog-generated" || this.#active.size >= 16)
        return;
      try {
        if (this.#timeout(xhr) !== 0 || !/\.m4s$/i.test(new URL(meta.targetUrl).pathname)) return;
        const headers = meta.headers.filter(([name]) => name.toLowerCase() === "range");
        if (headers.length !== 1) return;
        const range = /^bytes=(\d+)-(\d+)$/.exec(headers[0][1].trim());
        if (!range) return;
        const start2 = Number(range[1]), end = Number(range[2]);
        if (![start2, end].every(Number.isSafeInteger) || start2 < 0 || end < start2) return;
        this.#active.set(meta.request.requestId, {
          xhr,
          meta,
          range: `bytes=${start2}-${end}`,
          start: start2,
          end,
          loaded: 0,
          total: null,
          samples: [],
          lease: null
        });
      } catch {
      }
    }
    progress(xhr, meta, event) {
      const flight = meta.request ? this.#active.get(meta.request.requestId) : null;
      if (!flight || flight.xhr !== xhr || !event.isTrusted || !this.#response(flight)) return;
      const loaded = Number(event.loaded);
      if (!Number.isSafeInteger(loaded) || loaded < flight.loaded || loaded > flight.total) {
        const permit = flight.lease?.permit;
        if (permit) {
          const action = this.#actions.get(permit.id);
          if (action) action.state = "failed";
          this.routes?.revokeEarlyRetry(permit);
        }
        this.#restore(flight);
        this.#active.delete(meta.request.requestId);
        return;
      }
      flight.loaded = loaded;
      const tick = this.context.tick();
      if (tick !== null) this.#sample(flight, tick);
    }
    #sample(flight, now) {
      const last = flight.samples.at(-1);
      if (last && now < last.at) {
        flight.samples = [];
        return;
      }
      if (last && last.at === now) {
        last.bytes = flight.loaded;
        return;
      }
      if (last && now - last.at < 250) return;
      flight.samples.push({ at: now, bytes: flight.loaded });
      flight.samples = flight.samples.filter((sample) => now >= sample.at && now - sample.at <= 2e3).slice(-8);
    }
    samples(_now) {
      if (!this.#enabled()) return [];
      const now = this.context.tick();
      if (now === null) return [];
      const results = [];
      for (const flight of this.#active.values()) {
        if (!flight.meta.request || flight.meta.startedTick === null || now < flight.meta.startedTick || flight.lease || this.#timeout(flight.xhr) !== 0 || !this.#response(flight))
          continue;
        this.#sample(flight, now);
        const first = flight.samples.find((sample) => now - sample.at >= 1e3);
        results.push(
          Object.freeze({
            request: flight.meta.request,
            ageMs: now - flight.meta.startedTick,
            loadedBytes: flight.loaded,
            totalBytes: flight.total,
            recentBytesPerSec: first ? (flight.loaded - first.bytes) * 1e3 / (now - first.at) : null
          })
        );
      }
      return Object.freeze(results);
    }
    arm(requestId2, permit) {
      const flight = this.#active.get(requestId2), now = this.context.now();
      const tick = this.context.tick(), started = flight?.meta.startedTick ?? null;
      if (!this.#enabled() || !flight || flight.lease || permit.expiresAt <= now || permit.expiresAt > now + 2e3 || !this.#response(flight) || flight.total === null || flight.loaded >= flight.total * 0.8 || tick === null || started === null || tick - started < 1500 || this.#timeout(flight.xhr) !== 0)
        return false;
      const applied = Math.floor(tick - started);
      flight.lease = { before: 0, applied, revision: this.#writes.get(flight.xhr) ?? 0, permit };
      const action = { permit, flight, state: "pending", replacement: null, observations: [] };
      this.#actions.set(permit.id, action);
      while (this.#actions.size > 16) this.#actions.delete(this.#actions.keys().next().value);
      try {
        this.#descriptor.set.call(flight.xhr, applied);
        if (!this.#owns(flight) && action.state === "pending") {
          action.state = "failed";
          return false;
        }
        return true;
      } catch {
        action.state = "failed";
        this.#restore(flight);
        return false;
      }
    }
    beforeOpen(xhr) {
      for (const flight of this.#active.values()) if (flight.xhr === xhr) this.#restore(flight);
    }
    #restore(flight) {
      const lease = flight.lease;
      flight.lease = null;
      if (!lease || this.metadata(flight.xhr) !== flight.meta || (this.#writes.get(flight.xhr) ?? 0) !== lease.revision)
        return;
      try {
        if (this.#timeout(flight.xhr) === lease.applied)
          this.#descriptor.set.call(flight.xhr, lease.before);
      } catch {
        this.#capable = false;
      }
    }
    select(xhr, meta) {
      if (!this.#enabled() || !meta.async || meta.method !== "GET") return null;
      const headers = meta.headers.filter(([name]) => name.toLowerCase() === "range");
      if (headers.length !== 1) return null;
      const range = /^bytes=(\d+)-(\d+)$/.exec(headers[0][1].trim());
      if (!range) return null;
      const normalized = `bytes=${Number(range[1])}-${Number(range[2])}`;
      for (const action of this.#actions.values()) {
        if (action.state !== "timedout" || this.context.now() >= action.permit.expiresAt || action.flight.range !== normalized || action.flight.xhr === xhr && action.flight.meta === meta)
          continue;
        if (action.replacement && action.replacement !== meta) continue;
        if (!this.routes.earlyRetryRequestCurrent(action.flight.meta.request)) continue;
        const applied = this.routes.applyEarlyRetry(meta.originalUrl, action.permit);
        if (applied) {
          if (!action.replacement)
            action.observations.push(Object.freeze({ at: this.context.now(), state: "claimed" }));
          action.replacement = meta;
          this.#selection.set(meta, action);
          return applied;
        }
      }
      return null;
    }
    accepted(xhr, meta) {
      const action = this.#selection.get(meta);
      if (!action) return;
      this.#selection.delete(meta);
      if (this.metadata(xhr) !== meta || meta.phase !== "sent" || !meta.request || !this.#enabled() || !this.routes.acceptEarlyRetry(action.permit, meta.request)) {
        action.state = "failed";
        this.routes?.revokeEarlyRetry(action.permit);
        return;
      }
      action.state = "dispatched";
      action.replacement = meta;
    }
    terminal(xhr, meta, kind) {
      const flight = meta.request ? this.#active.get(meta.request.requestId) : null;
      let ownTimeout = false;
      if (flight && flight.xhr === xhr && flight.meta === meta) {
        const lease = flight.lease, action = lease ? this.#actions.get(lease.permit.id) : null;
        if (kind === "timeout" && action?.state === "pending") {
          action.state = "timedout";
          action.observations.push(Object.freeze({ at: this.context.now(), state: "timedout" }));
          ownTimeout = true;
        } else if (action?.state === "pending") {
          action.state = "failed";
          this.routes?.revokeEarlyRetry(action.permit);
        }
        this.#restore(flight);
        this.#active.delete(meta.request.requestId);
      }
      for (const action of this.#actions.values())
        if (action.replacement === meta && action.state === "dispatched") {
          const direct = (() => {
            try {
              return this.#status?.get?.call(xhr) === 206 && sameUrl(String(this.#responseUrl?.get?.call(xhr) ?? ""), meta.targetUrl);
            } catch {
              return false;
            }
          })();
          action.state = kind === "success" && direct && flight?.total !== null && flight?.loaded === action.flight.end - action.flight.start + 1 ? "succeeded" : "failed";
        }
      return ownTimeout;
    }
    cleanup(xhr, meta) {
      const selected = this.#selection.get(meta);
      if (selected) {
        this.#selection.delete(meta);
        selected.state = "failed";
        this.routes?.revokeEarlyRetry(selected.permit);
      }
      const flight = meta.request ? this.#active.get(meta.request.requestId) : null;
      if (flight && flight.xhr === xhr) {
        this.#restore(flight);
        this.#active.delete(meta.request.requestId);
        if (!meta.settled && meta.phase === "terminal" && meta.request && meta.applied) {
          for (const action of this.#actions.values())
            if (action.flight === flight && action.state === "pending") {
              action.state = "failed";
              this.routes?.revokeEarlyRetry(action.permit);
            }
          void this.context.routes.observe(
            this.context.observation(
              meta.request,
              meta.applied,
              meta.originalUrl,
              meta.targetUrl,
              "",
              0,
              meta.bytes,
              meta.startedAt,
              meta.responseAt,
              "abort",
              void 0,
              false
            )
          );
        }
      }
    }
    observations(permit) {
      const action = this.#actions.get(permit.id);
      return Object.freeze(action?.permit === permit ? action.observations.slice(0, 2) : []);
    }
    state(permit) {
      const action = this.#actions.get(permit.id);
      if (!action || action.permit !== permit) return null;
      if (["pending", "timedout"].includes(action.state) && this.context.now() >= permit.expiresAt) {
        this.cancel(permit);
        action.state = "expired";
      }
      return action.state;
    }
    cancel(permit) {
      for (const action of this.#actions.values())
        if (!permit || action.permit === permit) {
          this.#restore(action.flight);
          this.routes?.revokeEarlyRetry(action.permit);
          if (!["succeeded", "failed", "expired"].includes(action.state)) action.state = "expired";
        }
    }
    restore() {
      this.cancel();
      this.#active.clear();
      this.#actions.clear();
      if (this.#descriptor && this.#ownsDescriptor())
        Object.defineProperty(this.proto, "timeout", this.#descriptor);
      this.#capable = false;
    }
  };

  // src-v2/adapters/transport/xhr-hook.ts
  var XhrHookAdapter = class {
    constructor(context, retryRoutes) {
      this.context = context;
      this.retryRoutes = retryRoutes;
    }
    context;
    retryRoutes;
    static {
      __name(this, "XhrHookAdapter");
    }
    #xhrMeta = /* @__PURE__ */ new WeakMap();
    #retry = null;
    samples(now) {
      return this.#retry?.samples(now) ?? [];
    }
    arm(requestId2, permit) {
      return this.#retry?.arm(requestId2, permit) ?? false;
    }
    state(permit) {
      return this.#retry?.state(permit) ?? null;
    }
    observations(permit) {
      return this.#retry?.observations(permit) ?? [];
    }
    cancel(permit) {
      this.#retry?.cancel(permit);
    }
    install() {
      const proto = unsafeWindow.XMLHttpRequest?.prototype;
      if (!proto) return null;
      const originalOpen = proto.open, originalSend = proto.send, originalAbort = proto.abort, originalSetHeader = proto.setRequestHeader;
      const responseDescriptor = Object.getOwnPropertyDescriptor(proto, "response");
      const responseTextDescriptor = Object.getOwnPropertyDescriptor(proto, "responseText");
      const readyStateDescriptor = Object.getOwnPropertyDescriptor(proto, "readyState");
      const bodyValue = createXhrBodyConverter();
      const self = this.context, xhrMeta = this.#xhrMeta;
      const retry = this.#retry = new XhrEarlyRetry(
        proto,
        self,
        (xhr) => xhrMeta.get(xhr),
        this.retryRoutes
      );
      const { waiting, finishLocal, rejectLocal } = createXhrRequestState((xhr) => xhrMeta.get(xhr));
      const open = /* @__PURE__ */ __name(function(method, url, async, username, password) {
        readyStateDescriptor?.get?.call(this);
        retry.beforeOpen(this);
        if (arguments.length < 2) {
          Reflect.apply(originalOpen, this, Array.from(arguments));
          return;
        }
        const { methodString, originalUrl, asynchronous, user, pass, normalizedMethod } = convertXhrOpen(method, url, arguments.length, async, username, password);
        self.count("enteredXhr");
        const apiEndpoint = classifyPlayurlApi(originalUrl, location.href);
        const playurl = apiEndpoint !== null && apiEndpoint !== "ogv-precheck";
        const previous = xhrMeta.get(this);
        let applied = null, targetUrl = originalUrl;
        if (!self.settings.get().disabled && !playurl && self.routes.recognizesMedia(originalUrl)) {
          self.count("mediaRecognized");
          applied = normalizedMethod === "GET" ? self.routes.apply(originalUrl) : self.routes.inspectOriginal(originalUrl);
          if (applied.url) targetUrl = applied.url;
        }
        const next = {
          method: normalizedMethod,
          originalUrl,
          managedBilibili: self.routes.isBilibiliMedia(originalUrl),
          targetUrl,
          applied,
          startedAt: 0,
          startedTick: null,
          responseTick: null,
          measurement: null,
          responseAt: 0,
          bytes: 0,
          settled: false,
          playurl,
          apiEndpoint,
          requestContext: playurlRequestContext(originalUrl, location.href),
          transformedText: null,
          transformedJson: void 0,
          catalogOnlyAtTransform: null,
          request: null,
          generation: self.session.get().generation,
          epoch: self.session.get().epoch,
          responseKey: self.nextResponseKey("api-xhr"),
          cleanup: /* @__PURE__ */ __name(() => void 0, "cleanup"),
          async: asynchronous,
          headers: [],
          phase: "opened",
          virtualReadyState: null,
          needsNativeOpen: false,
          username: user,
          password: pass
        };
        xhrMeta.set(this, next);
        try {
          Reflect.apply(originalOpen, this, [methodString, targetUrl, asynchronous, user, pass]);
        } catch (error) {
          if (xhrMeta.get(this) === next) {
            if (previous) {
              xhrMeta.set(this, previous);
              if (previous.phase === "waiting" && readyStateDescriptor?.get?.call(this) === 0)
                previous.needsNativeOpen = true;
            } else xhrMeta.delete(this);
          }
          throw error;
        }
        if (xhrMeta.get(this) === next && apiEndpoint && !self.settings.get().disabled)
          self.noteApiEndpoint("xhr", apiEndpoint);
        if (previous) {
          previous.phase = "terminal";
          previous.cleanup();
        }
      }, "open");
      const send = /* @__PURE__ */ __name(function(body) {
        readyStateDescriptor?.get?.call(this);
        body = bodyValue(body);
        const meta = xhrMeta.get(this);
        if (!meta) {
          Reflect.apply(originalSend, this, [body ?? null]);
          return;
        }
        if (meta.phase !== "opened" || this.readyState !== 1)
          throw new DOMException("send invalid state", "InvalidStateError");
        meta.phase = "waiting";
        let nativeAccepted = false;
        const perform = /* @__PURE__ */ __name(() => {
          if (!waiting(this, meta)) return;
          const { nativeReady, reopen } = createXhrPreparation(this, meta, waiting, {
            open: originalOpen,
            setHeader: originalSetHeader,
            readyState: readyStateDescriptor
          });
          let disabled = false, stale = false;
          for (; ; ) {
            if (!waiting(this, meta)) return;
            disabled = self.settings.get().disabled;
            let targetUrl = meta.originalUrl, applied = null;
            if (!disabled) {
              if (meta.playurl && self.routes.isCatalogOnly() && !["", "text", "json"].includes(this.responseType)) {
                self.blocked(meta.method, meta.originalUrl, "playurl-response-type");
                self.notePlayurl("xhr", 0, rejectedPlayurl("unsupported-format"));
                rejectLocal(this, meta);
                return;
              }
              const strictManaged = self.routes.isCatalogOnly() && (meta.managedBilibili || self.routes.recognizesMedia(meta.originalUrl));
              const sameContent = self.session.isGeneration(meta.generation) && self.session.get().epoch === meta.epoch;
              if (!sameContent && strictManaged) {
                self.blocked(meta.method, meta.originalUrl, "catalog-unavailable");
                rejectLocal(this, meta);
                return;
              }
              stale = !sameContent;
              if (!meta.playurl && (meta.applied || meta.managedBilibili || self.routes.recognizesMedia(meta.originalUrl) || strictManaged)) {
                if (!meta.applied) self.count("mediaRecognized");
                applied = !stale && meta.method === "GET" ? self.routes.apply(
                  meta.originalUrl,
                  null,
                  void 0,
                  false,
                  closedRangeLength(
                    meta.headers.filter(([key]) => key.toLowerCase() === "range").map(([, value]) => value).join(",")
                  ),
                  "xhr-terminal"
                ) : self.routes.inspectOriginal(meta.originalUrl);
                applied = retry.select(this, meta) ?? applied;
                if (applied.url) targetUrl = applied.url;
              }
              if (self.settings.get().blockHttpDns && isHttpDnsUrl(meta.originalUrl, location.href)) {
                rejectLocal(this, meta);
                return;
              }
              const reason = self.dispatchFailure({
                generation: meta.generation,
                applied,
                targetUrl,
                managedMedia: strictManaged
              });
              if (reason) {
                self.blocked(meta.method, meta.originalUrl, reason);
                rejectLocal(this, meta);
                return;
              }
            }
            if (!waiting(this, meta)) return;
            if (meta.needsNativeOpen || !nativeReady() || targetUrl !== meta.targetUrl) {
              reopen(targetUrl);
              continue;
            }
            meta.applied = stale ? null : applied;
            break;
          }
          if (!waiting(this, meta)) return;
          if (disabled) {
            meta.phase = "sent";
            self.count("nativeCalled");
            Reflect.apply(originalSend, this, [body ?? null]);
            nativeAccepted = true;
            return;
          }
          meta.startedAt = self.now();
          if (meta.applied) {
            meta.request = self.request(
              meta.applied,
              meta.originalUrl,
              meta.targetUrl,
              meta.startedAt,
              meta.method,
              closedRangeLength(
                meta.headers.filter(([key]) => key.toLowerCase() === "range").map(([, value]) => value).join(",")
              ),
              "xhr-terminal"
            );
            self.routes.requestStarted(meta.request);
          }
          const { noteHeaders, progress, settle } = createXhrCompletion(
            this,
            meta,
            self,
            retry,
            () => xhrMeta.get(this) === meta
          );
          const load = /* @__PURE__ */ __name((event) => {
            settle(
              this.status >= 200 && this.status < 400 ? "success" : "failure",
              responseFailure(meta.applied?.decision.routeType, this.status),
              false,
              event
            );
          }, "load");
          const error = /* @__PURE__ */ __name((event) => settle("failure", "network", false, event), "error"), timeout = /* @__PURE__ */ __name((event) => settle("failure", "timeout", true, event), "timeout"), abort2 = /* @__PURE__ */ __name((event) => settle("abort", void 0, false, event), "abort");
          this.addEventListener("readystatechange", noteHeaders);
          this.addEventListener("progress", progress);
          this.addEventListener("load", load);
          this.addEventListener("error", error);
          this.addEventListener("timeout", timeout, true);
          this.addEventListener("abort", abort2);
          meta.cleanup = () => {
            retry.cleanup(this, meta);
            this.removeEventListener("readystatechange", noteHeaders);
            this.removeEventListener("progress", progress);
            this.removeEventListener("load", load);
            this.removeEventListener("error", error);
            this.removeEventListener("timeout", timeout, true);
            this.removeEventListener("abort", abort2);
          };
          self.count("nativeCalled");
          self.noteNativeCall(meta.request);
          meta.phase = "sent";
          if (meta.playurl)
            meta.requestContext = self.apiDispatch(meta.originalUrl, meta.requestContext);
          try {
            meta.startedTick = self.tick();
            Reflect.apply(originalSend, this, [body ?? null]);
          } catch (error2) {
            if (!meta.settled && xhrMeta.get(this) === meta) {
              meta.cleanup();
              if (meta.applied && meta.request)
                void self.routes.observe(
                  self.observation(
                    meta.request,
                    meta.applied,
                    meta.originalUrl,
                    meta.targetUrl,
                    "",
                    0,
                    0,
                    meta.startedAt,
                    0,
                    "abort",
                    void 0,
                    false
                  )
                );
            }
            throw error2;
          }
          nativeAccepted = true;
          try {
            retry.accepted(this, meta);
            retry.register(this, meta);
          } catch {
            retry.cancel();
          }
        }, "perform");
        if (meta.async && !meta.playurl && meta.method === "GET" && self.routes.recognizesMedia(meta.originalUrl) && !self.settings.get().disabled && self.measurement.willGateStartup(meta.originalUrl)) {
          const release = /* @__PURE__ */ __name(() => {
            try {
              perform();
            } catch {
              if (!nativeAccepted && xhrMeta.get(this) === meta && !meta.settled && (meta.phase === "waiting" || meta.phase === "sent")) {
                meta.phase = "waiting";
                finishLocal(this, meta, "error");
              }
            }
          }, "release");
          void self.measurement.prepareStartup(
            meta.originalUrl,
            null,
            closedRangeLength(
              meta.headers.filter(([key]) => key.toLowerCase() === "range").map(([, value]) => value).join(",")
            )
          ).then(release, release);
          return;
        }
        if (!meta.playurl && self.routes.recognizesMedia(meta.originalUrl)) {
          if (!meta.async) self.measurement.noteUnpreflighted("preflight-skipped:synchronous-xhr");
          else self.measurement.noteUnpreflighted("no-safe-startup-candidate");
        }
        perform();
      }, "send");
      const abort = /* @__PURE__ */ __name(function() {
        const meta = xhrMeta.get(this);
        if (meta?.phase === "waiting") {
          finishLocal(this, meta, "abort");
          if (xhrMeta.get(this) === meta) meta.virtualReadyState = 0;
          return;
        }
        if (meta?.virtualReadyState !== null && meta?.virtualReadyState !== void 0) {
          meta.virtualReadyState = 0;
          return;
        }
        Reflect.apply(originalAbort, this, []);
      }, "abort");
      const setHeader = /* @__PURE__ */ __name(function(name, value) {
        readyStateDescriptor?.get?.call(this);
        if (arguments.length < 2) {
          Reflect.apply(originalSetHeader, this, Array.from(arguments));
          return;
        }
        const [key, text3] = convertXhrHeader(name, value);
        const meta = xhrMeta.get(this);
        if (meta && (meta.phase === "waiting" || meta.virtualReadyState !== null))
          throw new DOMException("header invalid state", "InvalidStateError");
        Reflect.apply(originalSetHeader, this, [key, text3]);
        if (meta && xhrMeta.get(this) === meta) meta.headers.push([key, text3]);
      }, "setHeader");
      let responseGetter, responseTextGetter, readyStateGetter;
      const rollback = /* @__PURE__ */ __name(() => {
        retry.restore();
        try {
          if (proto.open === open) proto.open = originalOpen;
        } catch {
        }
        try {
          if (proto.send === send) proto.send = originalSend;
        } catch {
        }
        try {
          if (proto.abort === abort) proto.abort = originalAbort;
        } catch {
        }
        try {
          if (proto.setRequestHeader === setHeader) proto.setRequestHeader = originalSetHeader;
        } catch {
        }
        try {
          if (responseDescriptor && Object.getOwnPropertyDescriptor(proto, "response")?.get === responseGetter)
            Object.defineProperty(proto, "response", responseDescriptor);
        } catch {
        }
        try {
          if (responseTextDescriptor && Object.getOwnPropertyDescriptor(proto, "responseText")?.get === responseTextGetter)
            Object.defineProperty(proto, "responseText", responseTextDescriptor);
        } catch {
        }
        try {
          if (readyStateDescriptor && Object.getOwnPropertyDescriptor(proto, "readyState")?.get === readyStateGetter)
            Object.defineProperty(proto, "readyState", readyStateDescriptor);
        } catch {
        }
      }, "rollback");
      try {
        proto.open = open;
        proto.send = send;
        proto.abort = abort;
        proto.setRequestHeader = setHeader;
        if (proto.open !== open || proto.send !== send || proto.abort !== abort || proto.setRequestHeader !== setHeader)
          throw new Error("XHR hook assignment did not stick");
        if (readyStateDescriptor?.get && readyStateDescriptor.configurable) {
          readyStateGetter = /* @__PURE__ */ __name(function() {
            return xhrMeta.get(this)?.virtualReadyState ?? readyStateDescriptor.get.call(this);
          }, "readyStateGetter");
          Object.defineProperty(proto, "readyState", {
            ...readyStateDescriptor,
            get: readyStateGetter
          });
        }
        if (responseDescriptor?.get && responseDescriptor.configurable) {
          responseGetter = /* @__PURE__ */ __name(function() {
            const raw = responseDescriptor.get?.call(this), meta = xhrMeta.get(this);
            if (meta && meta.virtualReadyState !== null)
              return this.responseType === "" || this.responseType === "text" ? "" : null;
            if (!meta?.playurl || self.settings.get().disabled) return raw;
            if (this.readyState !== 4)
              return self.routes.isCatalogOnly() ? this.responseType === "" || this.responseType === "text" ? "" : null : raw;
            if (!self.session.isGeneration(meta.generation)) {
              self.notePlayurl(
                "xhr",
                this.status,
                rejectedPlayurl("inactive"),
                meta.apiEndpoint ?? "playurl"
              );
              return self.routes.isCatalogOnly() ? this.responseType === "" || this.responseType === "text" ? blockedPlayurlText() : blockedPlayurl() : raw;
            }
            const strict = self.routes.isCatalogOnly();
            resetXhrTransform(meta, strict);
            if (this.responseType === "json") {
              return transformXhrJson(self, meta, raw, strict, () => this.status);
            }
            if ((this.responseType === "" || this.responseType === "text") && typeof raw === "string") {
              return transformXhrText(self, meta, raw, strict, () => this.status);
            }
            self.notePlayurl(
              "xhr",
              this.status,
              rejectedPlayurl("unsupported-format"),
              meta.apiEndpoint ?? "playurl"
            );
            return strict ? blockedPlayurl() : raw;
          }, "responseGetter");
          Object.defineProperty(proto, "response", { ...responseDescriptor, get: responseGetter });
        }
        if (responseTextDescriptor?.get && responseTextDescriptor.configurable) {
          responseTextGetter = /* @__PURE__ */ __name(function() {
            const raw = String(responseTextDescriptor.get?.call(this) ?? ""), meta = xhrMeta.get(this);
            if (meta && meta.virtualReadyState !== null) return "";
            if (!meta?.playurl || self.settings.get().disabled) return raw;
            if (this.readyState !== 4) return self.routes.isCatalogOnly() ? "" : raw;
            if (!self.session.isGeneration(meta.generation)) {
              self.notePlayurl(
                "xhr",
                this.status,
                rejectedPlayurl("inactive"),
                meta.apiEndpoint ?? "playurl"
              );
              return self.routes.isCatalogOnly() ? blockedPlayurlText() : raw;
            }
            const strict = self.routes.isCatalogOnly();
            resetXhrTransform(meta, strict);
            return transformXhrText(self, meta, raw, strict, () => this.status);
          }, "responseTextGetter");
          Object.defineProperty(proto, "responseText", {
            ...responseTextDescriptor,
            get: responseTextGetter
          });
        }
        return {
          restore: rollback,
          isInstalled: /* @__PURE__ */ __name(() => proto.open === open && proto.send === send && proto.abort === abort && proto.setRequestHeader === setHeader && (!responseGetter || Object.getOwnPropertyDescriptor(proto, "response")?.get === responseGetter) && (!responseTextGetter || Object.getOwnPropertyDescriptor(proto, "responseText")?.get === responseTextGetter) && (!readyStateGetter || Object.getOwnPropertyDescriptor(proto, "readyState")?.get === readyStateGetter), "isInstalled")
        };
      } catch {
        rollback();
        return null;
      }
    }
  };

  // src-v2/adapters/transport/transport.ts
  var TransportAdapter = class {
    constructor(session, settings, routes, playurl, measurement, now, ids, retryRoutes, monotonicNow = () => null) {
      this.retryRoutes = retryRoutes;
      this.#context = new TransportContext(
        session,
        settings,
        routes,
        playurl,
        measurement,
        now,
        ids,
        monotonicNow
      );
    }
    retryRoutes;
    static {
      __name(this, "TransportAdapter");
    }
    #fetch = null;
    #xhr = null;
    #xhrAdapter = null;
    #hookState = "not-installed";
    #hookReason = "not-attempted";
    #context;
    install() {
      if (this.#fetch && this.#xhr) return;
      try {
        this.#fetch = new FetchHookAdapter(this.#context).install();
      } catch {
      }
      if (!this.#fetch) {
        this.#hookState = "failed";
        this.#hookReason = "fetch-install-unavailable";
        return;
      }
      try {
        this.#xhrAdapter = new XhrHookAdapter(this.#context, this.retryRoutes);
        this.#xhr = this.#xhrAdapter.install();
      } catch {
      }
      if (!this.#xhr) {
        try {
          this.#fetch.restore();
        } catch {
        }
        this.#fetch = null;
        this.#hookState = "failed";
        this.#hookReason = "xhr-install-unavailable";
        return;
      }
      this.#hookState = "installed";
      this.#hookReason = "fetch-and-xhr-verified";
    }
    snapshot() {
      let fetchInstalled = false, xhrInstalled = false;
      try {
        fetchInstalled = this.#fetch?.isInstalled() ?? false;
      } catch {
      }
      try {
        xhrInstalled = this.#xhr?.isInstalled() ?? false;
      } catch {
      }
      return Object.freeze({
        hookState: this.#hookState === "installed" && (!fetchInstalled || !xhrInstalled) ? "degraded" : this.#hookState,
        hookReason: this.#hookReason,
        fetchInstalled,
        xhrInstalled,
        ...this.#context.snapshot(),
        note: "Native call is a script observation, not Chrome Network confirmation."
      });
    }
    samples(now) {
      return this.#xhrAdapter?.samples(now) ?? [];
    }
    arm(requestId2, permit) {
      return this.#xhrAdapter?.arm(requestId2, permit) ?? false;
    }
    state(permit) {
      return this.#xhrAdapter?.state(permit) ?? null;
    }
    observations(permit) {
      return this.#xhrAdapter?.observations(permit) ?? [];
    }
    cancel(permit) {
      this.#xhrAdapter?.cancel(permit);
    }
    dispose() {
      for (const hook of [this.#xhr, this.#fetch]) {
        try {
          hook?.restore();
        } catch {
        }
      }
      this.#xhr = null;
      this.#xhrAdapter = null;
      this.#fetch = null;
      this.#hookState = "not-installed";
      this.#hookReason = "disposed";
    }
  };

  // src-v2/adapters/visibility.ts
  var VisibilityAdapter = class {
    static {
      __name(this, "VisibilityAdapter");
    }
    #restores = [];
    #nativeHidden = null;
    #controlLoss = /* @__PURE__ */ new Set();
    subscribeControlLoss(listener) {
      this.#controlLoss.add(listener);
      return () => {
        this.#controlLoss.delete(listener);
      };
    }
    install() {
      if (this.#restores.length) return;
      const hidden = Object.getOwnPropertyDescriptor(Document.prototype, "hidden");
      Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState");
      this.#nativeHidden = () => {
        try {
          return hidden?.get ? Boolean(hidden.get.call(document)) : document.visibilityState !== "visible";
        } catch {
          return false;
        }
      };
      this.#spoof("hidden", false);
      this.#spoof("visibilityState", "visible");
      const guard = /* @__PURE__ */ __name((event) => {
        if (!this.#nativeHidden?.()) return;
        if (event.isTrusted) this.#notifyControlLoss();
        event.stopImmediatePropagation();
      }, "guard");
      document.addEventListener("visibilitychange", guard, true);
      document.addEventListener("webkitvisibilitychange", guard, true);
      const blurGuard = /* @__PURE__ */ __name((event) => {
        if (event.isTrusted && event.target === window) this.#notifyControlLoss();
        event.stopImmediatePropagation();
      }, "blurGuard");
      window.addEventListener("blur", blurGuard, true);
      this.#restores.push(() => document.removeEventListener("visibilitychange", guard, true));
      this.#restores.push(() => document.removeEventListener("webkitvisibilitychange", guard, true));
      this.#restores.push(() => window.removeEventListener("blur", blurGuard, true));
    }
    setEnabled(enabled) {
      if (enabled) this.install();
      else this.dispose();
    }
    isActuallyVisible() {
      return !(this.#nativeHidden?.() ?? false);
    }
    dispose() {
      for (const restore of this.#restores.splice(0).reverse()) {
        try {
          restore();
        } catch {
        }
      }
      this.#nativeHidden = null;
    }
    #notifyControlLoss() {
      for (const listener of [...this.#controlLoss]) {
        if (!this.#controlLoss.has(listener)) continue;
        try {
          listener();
        } catch {
        }
      }
    }
    #spoof(key, value) {
      const target = document;
      let existing;
      try {
        existing = Object.getOwnPropertyDescriptor(target, key);
      } catch {
        return;
      }
      try {
        const installed = {
          configurable: true,
          enumerable: true,
          get: /* @__PURE__ */ __name(() => value, "get"),
          ...existing?.set ? { set: existing.set } : {}
        };
        Object.defineProperty(target, key, installed);
        this.#restores.push(() => {
          try {
            const current = Object.getOwnPropertyDescriptor(target, key);
            if (!current || "value" in current || current.get !== installed.get || current.set !== installed.set || current.enumerable !== installed.enumerable || current.configurable !== installed.configurable)
              return;
            if (existing) Object.defineProperty(target, key, existing);
            else delete target[key];
          } catch {
          }
        });
      } catch {
      }
    }
  };

  // src-v2/adapters/webrtc.ts
  var API_NAMES = [
    "RTCPeerConnection",
    "mozRTCPeerConnection",
    "webkitRTCPeerConnection",
    "RTCDataChannel"
  ];
  var WebRtcAdapter = class {
    constructor(settings) {
      this.settings = settings;
    }
    settings;
    static {
      __name(this, "WebRtcAdapter");
    }
    #original = /* @__PURE__ */ new Map();
    #unsubscribe = null;
    install() {
      if (this.#unsubscribe) return;
      this.#apply(!this.settings.get().disabled && this.settings.get().blockWebRtc);
      this.#unsubscribe = this.settings.subscribe(
        (state) => this.#apply(!state.disabled && state.blockWebRtc)
      );
    }
    dispose() {
      this.#unsubscribe?.();
      this.#unsubscribe = null;
      this.#restore();
    }
    #apply(blocked) {
      if (!blocked) {
        this.#restore();
        return;
      }
      for (const name of API_NAMES) {
        if (this.#original.has(name)) continue;
        let descriptor;
        try {
          descriptor = Object.getOwnPropertyDescriptor(unsafeWindow, name);
        } catch {
          continue;
        }
        const getter = /* @__PURE__ */ __name(() => void 0, "getter"), setter = /* @__PURE__ */ __name(() => void 0, "setter");
        try {
          Object.defineProperty(unsafeWindow, name, {
            configurable: true,
            enumerable: descriptor?.enumerable ?? true,
            get: getter,
            set: setter
          });
          this.#original.set(name, { descriptor, getter, setter });
        } catch {
        }
      }
    }
    #restore() {
      for (const [name, entry] of this.#original) {
        try {
          const current = Object.getOwnPropertyDescriptor(unsafeWindow, name);
          if (current?.get !== entry.getter || current.set !== entry.setter) continue;
          if (entry.descriptor) Object.defineProperty(unsafeWindow, name, entry.descriptor);
          else delete unsafeWindow[name];
        } catch {
        }
      }
      this.#original.clear();
    }
  };

  // src-v2/ui/styles.ts
  var controlCenterCss = `
:host{all:initial;color-scheme:light dark}
*{box-sizing:border-box}
.backdrop{position:fixed;inset:0;z-index:2147483647;background:#0008;display:grid;place-items:center;padding:18px;font:14px/1.55 system-ui,-apple-system,"Microsoft JhengHei",sans-serif}
.dialog{--bg:light-dark(#f6f8fc,#0e1728);--surface:light-dark(#fff,#162136);--ink:light-dark(#17283f,#e8eff9);--muted:light-dark(#5b6d83,#9aacbf);--line:light-dark(#dde5ef,#2b3a51);--blue:light-dark(#2263ce,#83b5ff);--green:light-dark(#147651,#79d6b0);color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:20px;width:min(900px,100%);max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 70px #0008;overflow:hidden}
h2,h3,p{margin:0}h2{font-size:21px;font-weight:600}h3{font-size:15px;font-weight:600}
.head{display:flex;gap:12px;align-items:center;padding:24px 28px 18px;flex-wrap:wrap}.brand{flex:1;min-width:200px}
.tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;padding:0 28px;border-bottom:1px solid var(--line)}
.tab{font:inherit;color:var(--muted);background:transparent;border:0;border-bottom:3px solid transparent;padding:13px 0;cursor:pointer}
.tab[aria-current=page]{color:var(--blue);border-bottom-color:var(--blue)}
.body{overflow:auto;padding:24px 28px;display:grid;gap:20px}
.foot{display:flex;gap:9px;flex-wrap:wrap;padding:16px 28px;border-top:1px solid var(--line)}.foot:empty{display:none}
.notice:empty{display:none}.notice{padding:10px 28px;color:light-dark(#b14242,#f59b9b)}
.btn,select{font:inherit;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:9px 13px;cursor:pointer}
.btn:disabled{opacity:.55;cursor:wait}.btn.danger{color:light-dark(#b14242,#f59b9b)}.power[aria-pressed=true]{color:var(--green)}
:focus-visible{outline:2px solid var(--blue);outline-offset:3px}
.hero{display:flex;align-items:center;justify-content:space-between;gap:12px}.playback{font-size:20px}.badge{font-size:12px;color:var(--muted);border:1px solid var(--line);padding:5px 10px;border-radius:8px}
.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.metric,.panel{border:1px solid var(--line);border-radius:14px;background:var(--surface)}
.metric{padding:17px 18px;min-width:0}.number{display:flex;align-items:baseline;gap:6px;margin:7px 0}.value{font-size:30px;font-weight:500;letter-spacing:-.8px;font-variant-numeric:tabular-nums}.unit,.detail{font-size:12px;color:var(--muted)}
.routes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.route{padding:18px;min-width:0}.route+.route{border-left:1px solid var(--line)}.route-host{font-size:16px;margin:9px 0;overflow-wrap:anywhere}
.activity{padding:16px 18px;display:grid;gap:10px}.event{font-size:12px;color:var(--muted)}
.grid{display:grid;gap:8px}.row{display:flex;align-items:center;gap:16px;padding:15px 18px;border:1px solid var(--line);border-radius:10px;background:var(--surface);flex-wrap:wrap}
.row label{flex:1;min-width:150px;overflow-wrap:anywhere}.row input{width:19px;height:19px;flex:none;accent-color:var(--blue);cursor:pointer}.row select{max-width:100%;min-width:0}.restriction{flex-basis:100%}.restriction:empty{display:none}
.tools{padding:14px 18px}.tools summary{cursor:pointer;color:var(--muted);font-size:13px}.tools[open] summary{margin-bottom:14px}.tools .btn{margin:5px 8px 5px 0}.confirmation:empty{display:none}.confirmation{margin-top:12px;padding:14px;border:1px solid var(--line);border-radius:9px}
.summary{font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--muted)}.status-details:empty{display:none}
@media(max-width:560px){.backdrop{padding:8px}.head{padding:18px}.tabs{padding:0 18px;gap:8px}.body{padding:20px 18px}.metrics,.routes{grid-template-columns:1fr}.metric{display:grid;grid-template-columns:1fr 1fr;gap:6px;align-items:center}.metric .detail:last-child{grid-column:1/-1}.number{margin:0}.route+.route{border-left:0;border-top:1px solid var(--line)}.foot{padding:14px 18px}h2{font-size:19px}.brand{min-width:170px}.row select{width:100%}}
`;
  function createControlCenterStyle() {
    const style = document.createElement("style");
    style.textContent = controlCenterCss;
    return style;
  }
  __name(createControlCenterStyle, "createControlCenterStyle");

  // src-v2/ui/elements.ts
  function createButton(label, action, tone = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `btn ${tone}`.trim();
    button.textContent = label;
    button.addEventListener("click", (event) => {
      if (!event.isTrusted) return;
      event.preventDefault();
      event.stopPropagation();
      void action();
    });
    return button;
  }
  __name(createButton, "createButton");
  function createRow(label, control, detail = "") {
    const row = document.createElement("div");
    row.className = "row";
    const text3 = document.createElement("label");
    text3.textContent = label;
    if (detail) {
      const small = document.createElement("span");
      small.className = "detail";
      small.textContent = detail;
      text3.append(document.createElement("br"), small);
    }
    row.append(text3, control);
    return row;
  }
  __name(createRow, "createRow");

  // src-v2/ui/labels.ts
  var plain = /* @__PURE__ */ __name((value, labels, fallback = "尚未確認") => {
    const key = String(value);
    return Object.hasOwn(labels, key) ? labels[key] ?? fallback : fallback;
  }, "plain");
  var routeLabel = /* @__PURE__ */ __name((type) => plain(type, {
    "catalog-generated": "腳本挑選的 CDN",
    "native-signed": "B 站提供的 CDN",
    "root-original": "B 站原本的 CDN"
  }), "routeLabel");
  var playbackLabel = /* @__PURE__ */ __name((state) => plain(state, {
    "no-video": "還沒找到影片",
    paused: "已暫停",
    "seek-grace": "剛跳轉，等待載入",
    "buffered-to-end": "已緩衝到片尾",
    healthy: "播放正常",
    "low-buffer": "緩衝不足",
    recovering: "正在嘗試恢復",
    observing: "觀察不足，等待下一筆播放資料"
  }), "playbackLabel");
  function monitorPlaybackLabel(monitor) {
    if (monitor.recoveryActive) return "正在嘗試恢復";
    if (monitor.watchdog === "observing") return playbackLabel("observing");
    if (monitor.stall?.phase === "stable-retained") return "播放穩定，保留本段額度";
    if (monitor.stall && monitor.watchdog === "healthy") return "已有播放進度，等待穩定";
    return playbackLabel(monitor.watchdog);
  }
  __name(monitorPlaybackLabel, "monitorPlaybackLabel");
  var recoveryLabel = /* @__PURE__ */ __name((state) => plain(state, {
    healthy: "正常",
    "pause-armed": "已暫停，等待播放",
    "play-intent": "正在嘗試繼續播放",
    waiting: "等待影片恢復",
    reloading: "正在重建播放器",
    recovered: "核心觀察到播放進度",
    "recovered-paused": "核心已恢復，等待手動播放",
    failed: "自動恢復失敗",
    breaker: "暫停自動恢復，避免反覆重試"
  }), "recoveryLabel");
  var recoveryReasonLabel = /* @__PURE__ */ __name((reason) => plain(
    reason,
    {
      "reload-unavailable": "播放器不支援自動重建",
      "reload-threw": "播放器重建時出錯",
      "reload-rejected": "播放器拒絕重建",
      "reload-timeout": "重建後仍未恢復",
      "play-rejected": "瀏覽器拒絕自動播放，請手動按播放",
      "play-threw": "恢復播放時出錯",
      "restore-threw": "還原播放位置或倍速時出錯",
      "media-error": "播放器回報媒體錯誤",
      "seek-interrupted": "跳轉影片時已停止恢復",
      "lifecycle-ended": "影片已切換，舊的恢復流程已結束"
    },
    "恢復條件已失效"
  ), "recoveryReasonLabel");
  var measurementLabel = /* @__PURE__ */ __name((state, reason) => {
    const why = String(reason);
    if (why.startsWith("manual-")) return `已安排測速，${measurementLabel("waiting", why.slice(7))}`;
    if (why.startsWith("candidate-")) return "正在測試 CDN 速度";
    if (why.startsWith("http-")) return `測試網址收到 HTTP ${why.slice(5)}，沒有取得有效速度`;
    return plain(
      why,
      {
        disabled: "腳本已停用",
        "no-representation": "尚未確認目前的影片資料",
        hidden: "分頁不在前景",
        seeking: "正在跳轉影片",
        recovering: "正在恢復播放",
        "awaiting-progress": "等待影片穩定播放",
        "low-buffer": "緩衝還不夠，暫不測速",
        "cross-tab-cooldown": "共用測速冷卻中",
        "storage-lock": "等待設定儲存鎖",
        "no-stale-candidate": "目前沒有需要測試的 CDN",
        "sample-recorded": "已記下測速結果",
        "short-response": "下載資料太少，無法判斷速度",
        timeout: "測速逾時",
        network: "測速時網路失敗",
        startup: "等待播放",
        generation: "等待新影片"
      },
      plain(state, {
        idle: "尚未測速",
        waiting: "等待安全的測速時機",
        running: "正在測速",
        complete: "已完成測速",
        failed: "這次測速沒有結果",
        cancelled: "已停止測速"
      })
    );
  }, "measurementLabel");
  var startupLabel = /* @__PURE__ */ __name((state, reason, result) => {
    if ((state === "complete" || state === "skipped" && result === "none") && result)
      return plain(result, {
        adequate: "本輪已選定足速路線",
        insufficient: "已選定本輪最快路線，尚未達足速門檻",
        unverified: "已使用一次合法未測退路，尚未驗證",
        none: "本輪沒有合法可用選擇"
      });
    if (state === "running") return "正在起播前測試可用路線（最長 3 秒）";
    if (state === "complete")
      return reason === "measured" ? "已測試並選好起播路線" : "已選好合法起播路線，測試沒有明確結果";
    if (state === "skipped")
      return plain(
        reason,
        {
          "unsupported-or-no-legal-candidate": "這筆請求無法安全預測試，後續依目前選路設定處理",
          "preflight-error": "預測試未完成，後續依目前選路設定處理",
          "video-priority": "等待影片取得起播窗口",
          "preflight-skipped:synchronous-xhr": "同步 XHR 保留原生行為，未消耗起播窗口"
        },
        "這筆請求未進行起播預測試"
      );
    return "等待播放器提出第一筆影音請求";
  }, "startupLabel");
  var attributionLabel = /* @__PURE__ */ __name((status) => plain(status, {
    matched: "已確認屬於這支影片",
    "waiting-data": "還在等影片資料",
    weak: "只能辨識到相似網址，尚未確認",
    ambiguous: "可能對應多個畫質，尚未確認",
    detached: "屬於先前的影片",
    confirmed: "已確認",
    "awaiting-second-video-transfer": "再收到一筆影片資料才能確認",
    "awaiting-matched-video": "等待可辨識的影片資料"
  }), "attributionLabel");
  var restrictionLabel = /* @__PURE__ */ __name((reason) => plain(reason, {
    black: "黑名單",
    dead: "已標記為不可用",
    "catalog-disabled": "已在設定中停用",
    "default-unavailable": "預設不使用",
    "circuit-open": "近期故障，暫時避開",
    "catalog-unavailable": "沒有合法的內建 CDN",
    "catalog-unreplaceable": "無法安全改寫成內建 CDN",
    "catalog-only-non-get": "這類請求無法安全改寫成內建 CDN"
  }), "restrictionLabel");

  // src-v2/ui/overview-presentation.ts
  var positive3 = /* @__PURE__ */ __name((value) => value != null && Number.isFinite(value) && value > 0, "positive");
  function currentDemand(model) {
    const video = model.monitor.video, rep = model.routes.representation;
    if (!video.available || !model.session.representation || model.routes.attribution !== "confirmed" || rep?.kind !== "video" || !positive3(rep.bandwidth) || !positive3(video.playbackRate))
      return null;
    return observedPlaybackDemand("video", rep.bandwidth, video.playbackRate)?.requiredMbps ?? null;
  }
  __name(currentDemand, "currentDemand");
  function overviewPresentation(model, now) {
    const video = model.monitor.video, routes = model.routes, plan = routes.activePlan;
    const candidate = routes.currentCapacity;
    const capacity = candidate && !model.settings.disabled && !model.session.disabled && candidate.generation === model.session.generation && candidate.epoch === model.session.epoch && candidate.representation === model.session.representation && candidate.decisionId === plan?.id && candidate.host === plan.host && candidate.routeType === plan.routeType ? candidate : null;
    const safeMbps = capacity?.sampleStatus === "available" && positive3(capacity.safeMbps) ? capacity.safeMbps : null;
    const confidence = capacity?.capacityConfidence;
    const historical = confidence === "historical" || confidence === "revalidation";
    const evidenceLabel = confidence === "sufficient" ? "近期容量" : confidence === "provisional" ? "單筆試用" : confidence === "revalidation" ? "隔離到期，待再驗證" : "歷史估計，待驗證";
    const requiredMbps = currentDemand(model);
    const margin = safeMbps !== null && requiredMbps !== null ? safeMbps / requiredMbps : null;
    const ratio = positive3(margin) ? margin : null;
    const missing = model.settings.disabled ? "腳本已停用" : model.interception.hookState !== "installed" || !model.interception.fetchInstalled || !model.interception.xhrInstalled ? "請求攔截未完整" : !capacity ? routes.attribution === "awaiting-second-video-transfer" ? "等待第二筆影片資料" : routes.attribution === "awaiting-matched-video" ? "等待可辨識影片資料" : "尚未建立目前路線" : capacity.sampleStatus === "expired" ? "目前路線的速度樣本已過期" : "目前路線尚無有效速度樣本";
    const dimensions = video.available && Number.isInteger(video.width) && video.width > 0 && Number.isInteger(video.height) && video.height > 0;
    const rep = routes.representation;
    const format = rep && positive3(rep.height) && (!dimensions || rep.height === video.height) ? rep.height + "p / " + rep.codec : dimensions ? video.width + "×" + video.height + "（播放器，編碼未確認）" : attributionLabel(routes.attribution);
    const transfers = ["video", "audio"].map((kind) => {
      const latest = routes.latest[kind], sent = routes.requested[kind];
      const observed = latest && (latest.generation == null || latest.generation === model.session.generation) && (latest.epoch == null || latest.epoch === model.session.epoch) ? latest : void 0;
      const requested = sent && sent.generation === model.session.generation && sent.epoch === model.session.epoch ? sent : void 0;
      const age = observed ? Math.max(0, Math.floor((now - observed.observedAt) / 1e3)) : 0;
      return {
        kind,
        observed,
        requested,
        host: observed?.responseHost ?? "尚未確認回應主機",
        detail: observed ? plain(observed.outcome, { success: "成功", failure: "失敗", abort: "已取消" }) + " · HTTP " + observed.status + " · " + age + " 秒前" + (now - observed.observedAt > 6e4 ? "（較早的回應）" : "") : requested ? "已送往 " + requested.targetHost + "，等待回應" : "目前尚未觀察到請求"
      };
    });
    return {
      format,
      capacityConfidence: confidence,
      historical,
      estimatedCompletionMs: capacity?.estimatedCompletionMs ?? null,
      predictionReason: capacity?.predictionReason ?? "unknown-size",
      safeMbps,
      ratio,
      requiredMbps,
      transfers,
      speedHint: safeMbps !== null ? capacity.host + " · " + (capacity.evidenceOrigin === "current-transport" ? "目前內容傳輸" : capacity.evidenceOrigin === "current-probe" ? "目前內容探測" : "歷史影片樣本") + "的保守估計 · " + evidenceLabel : missing,
      marginHint: ratio !== null && requiredMbps !== null ? (historical ? "歷史估計 · " : confidence === "provisional" ? "單筆試用 · " : "") + "需求 " + requiredMbps.toFixed(2) + " Mbps · " + (ratio >= 1 ? "達到安全餘裕" : "未達安全餘裕") : safeMbps !== null ? "尚無有效需求估計" : missing
    };
  }
  __name(overviewPresentation, "overviewPresentation");

  // src-v2/ui/circuit-presentation.ts
  function circuitPresentation(row) {
    const prefix = `${row.kind === "video" ? "影片" : "音訊"}共享熔斷 L${row.level}｜`;
    if (row.phase === "isolated")
      return prefix + `隔離中，截止 ${new Date(row.until).toLocaleString("zh-TW", { hour12: false })}`;
    if (row.phase === "clear") return prefix + "沒有熔斷等級";
    if (row.phase === "observing")
      return prefix + `本頁觀察 ${Math.floor(row.progressSec)}／300 秒；距滿期約 ${Math.ceil(row.remainingSec ?? 0)} 秒`;
    if (row.phase === "settling")
      return prefix + "本頁待結算：" + plain(row.reason, {
        "awaiting-end-success": "等待期末成功",
        "awaiting-pending-results": "等待本輪未決結果",
        committing: "等待儲存確認"
      }) + `；結算期限剩餘約 ${Math.ceil(row.remainingSec ?? 0)} 秒`;
    return prefix + "等待本頁新實傳；" + plain(row.reason, {
      "awaiting-new-transfer": "尚無有效觀察",
      "awaiting-control-version": "等待合法更新建立控制版本",
      "success-gap-expired": "成功間隔已超過兩分鐘",
      "settlement-expired": "結算期限已過，證據不足",
      "no-common-lock": "降級暫停：無共同儲存鎖或同步能力不足",
      "storage-unconfirmed": "儲存結果未確認",
      unconfirmed: "儲存結果未確認",
      "clock-gap": "時間或排程中斷",
      "clock-invalid": "時間無效",
      "capacity-exceeded": "觀察容量不足",
      "playback-invalidated": "播放狀態已改變",
      "route-changed": "主機或表示已改變",
      "rate-changed": "倍率已改變",
      "policy-changed": "政策已改變",
      "content-changed": "內容已改變",
      "control-changed": "共享控制版本已改變",
      "failure-pending": "等待失敗提交",
      stale: "共享控制版本已改變",
      invalid: "觀察資格已失效",
      "downgrade-committed": "上一級觀察已完成"
    });
  }
  __name(circuitPresentation, "circuitPresentation");

  // src-v2/ui/status-summary.ts
  function describeStatus(model, now) {
    const state = model.session, settings = model.settings, monitor = model.monitor;
    const affinity = state.affinity ? `${state.affinity.host}（${routeLabel(state.affinity.type)}）` : "尚未確認";
    let summary = "";
    const sourceMode = settings.considerNativeSources ? "可參考 B 站原生來源" : "僅內建 CDN";
    const mode = settings.disabled ? "腳本已停用，網站自行選擇 CDN" : settings.fixedHost ? `優先固定 ${settings.fixedHost}（${sourceMode}）` : `自動挑選 CDN（${sourceMode}）`;
    const recovery = model.recovery, measurement = model.measurement;
    summary = `腳本：${settings.disabled ? "已停用" : "已啟用"}｜CDN：${mode}
選定路線：${affinity}（實際請求見下方）
播放：${monitorPlaybackLabel(monitor)}｜已緩衝約 ${monitor.video.playableBufferSec.toFixed(1)} 秒可播放內容｜${monitor.video.effectiveRate} 倍速
播放器：${recoveryLabel(recovery.state)}｜測速：${measurementLabel(measurement.state, measurement.reason)}`;
    if (recovery.state === "failed" || recovery.state === "recovered-paused")
      summary += `｜${recoveryReasonLabel(recovery.reason)}`;
    if (measurement.startup) {
      const startup = measurement.startup;
      summary += `
起播前測試：${startup.state === "complete" && startup.reason === "qualified-early" ? "已測試並選好起播路線" : startupLabel(startup.state, startup.reason, startup.result)}`;
      if (startup.elapsedMs != null && Number.isFinite(startup.elapsedMs))
        summary += `｜等待 ${Math.max(0, Math.round(startup.elapsedMs))} ms`;
      if (startup.state === "complete")
        summary += `｜結束：${plain(startup.reason, { measured: "已取得有效量測", "qualified-early": "已找到足夠快的候選，提早放行", inconclusive: "證據不足" })}`;
    }
    if (measurement.range)
      summary += `
健康探測：${measurement.range.mode === "middle" ? "中段" : "首段"}｜${measurement.range.sizeKnown ? "大小已驗證" : "大小未知"}（不代表未快取）`;
    if (monitor.stall)
      summary += `
停滯段：${monitor.stall.id}｜${plain(monitor.stall.phase, { stalled: "等待進度", confirming: "確認短暫前進", settling: "等待穩定", "stable-retained": "播放穩定，保留本段額度" })}｜備援${monitor.stall.fallbackAvailable ? "尚可提交" : "已提交"}｜原段重載期限剩餘 ${Math.max(0, Math.ceil((monitor.stall.reloadAt - now) / 1e3))} 秒`;
    summary += `
穩定進度：${monitor.stableProgressTicks} 次／${(monitor.stableProgressMs / 1e3).toFixed(2)} 秒有效觀察`;
    if (recovery.remainingReloads !== void 0)
      summary += `
重載剩餘額度：${recovery.remainingReloads}｜${plain(recovery.nextAction, { "await-play": "等待播放命令結果", "verify-restore": "核對還原結果", "await-core": "等待核心就緒", "await-reload-deadline": "等待升級期限", none: "沒有待處理動作" })}`;
    if (recovery.deadlineAt !== void 0)
      summary += `｜本階段剩餘 ${Math.max(0, Math.ceil((recovery.deadlineAt - now) / 1e3))} 秒`;
    if (model.routes.selection?.phase === "pending")
      summary += `
表示選擇：待確認（${model.routes.selection.sampleCount}／2 筆成功影片傳輸），等待目前選擇的下一筆成功`;
    const hook = model.interception;
    const retry = model.earlyRetry;
    if (retry)
      summary += `
慢請求提前重試：${settings.earlyRetryEnabled ? "開啟" : "關閉"}｜${plain(retry.state, { idle: "尚未開始", waiting: "觀察中", armed: "已要求原生逾時", timedout: "已觀察原生逾時", claimed: "網站重試已配對", dispatched: "網站已重試", complete: "重試成功", cancelled: "已撤銷", suspended: "本分頁已停止提前重試" })}｜本分頁已嘗試 ${retry.attempts} 次`;
    if (hook.lastApiEndpoint)
      summary += `
播放入口：${plain(hook.lastApiEndpoint.kind, { playurl: "一般播放資料", "ogv-playview": "OGV 正片", "ogv-precheck": "OGV 片頭檢查（原文傳遞）" })}`;
    summary += `
請求攔截：${plain(hook.hookState, { installed: "運作中", degraded: "部分失效", failed: "無法啟用", "not-installed": "未啟用" })}｜腳本看到 ${Number(hook.enteredFetch) + Number(hook.enteredXhr)} 筆請求，其中 ${hook.mediaRecognized} 筆像是影音請求；交給瀏覽器 ${hook.nativeCalled} 筆，看到回應 ${hook.responseObserved} 筆`;
    if (!settings.disabled && !settings.considerNativeSources && hook.hookState !== "installed") {
      summary += "\n請求攔截未完整，無法確認影音只依內建 CDN 選路；請以 Chrome「網路」面板核對。";
    }
    const lastHook = hook.lastMediaRequest;
    if (lastHook)
      summary += `
最近一筆影音請求：${plain(lastHook.kind, { video: "影片", audio: "音訊", unknown: "尚未分類" })}，送往 ${lastHook.targetHost ?? "未知"}｜${lastHook.nativeCalled ? "已交給瀏覽器" : "未交給瀏覽器"}｜${lastHook.responseObserved ? `收到回應${lastHook.status ? `（HTTP ${lastHook.status}）` : ""}` : "尚未看到回應"}`;
    const lastBlocked = hook.lastBlocked;
    if (lastBlocked)
      summary += `
最近擋下的請求：${lastBlocked.host}｜原因：${restrictionLabel(lastBlocked.reason)}｜沒有送給瀏覽器`;
    const playurl = hook.lastPlayurl;
    if (playurl) {
      const formats = playurl.formats.map((format) => plain(format, { dash: "DASH", mp4: "MP4", flv: "FLV" })).join("／") || "未辨識";
      summary += `
最近播放資料：${playurl.transport === "fetch" ? "Fetch" : "XHR"}｜${playurl.accepted ? "已接納" : "未接納"}｜格式：${formats}｜影片 ${playurl.videoCount}、音訊 ${playurl.audioCount}、分段 ${playurl.segmentCount}`;
      if (playurl.status) summary += `｜上游 HTTP ${playurl.status}`;
      if (playurl.upstreamCode !== null) summary += `｜上游代碼 ${playurl.upstreamCode}`;
      if (playurl.reason)
        summary += `｜原因：${plain(playurl.reason, {
          "upstream-error": "B 站回報錯誤",
          "unsupported-format": "不支援的資料格式",
          "malformed-payload": "播放資料無法解析",
          "unreplaceable-source": "來源網址無法安全改寫",
          "no-legal-route": "沒有合法路線",
          inactive: "處理時已停用或影片已切換"
        })}`;
    }
    const routes = model.routes, latest = routes.latest;
    for (const row of routes.circuits) summary += `
${row.host}：${circuitPresentation(row)}`;
    const display = overviewPresentation(model, now);
    const activePlan = routes.activePlan;
    if (activePlan?.host)
      summary += `
目前路線容量：${display.historical ? "歷史估計，待驗證 · " : ""}${plain(
        assessDemandRatio(display.ratio),
        {
          "below-required": "低於本次需求",
          "meets-headroom": "達到安全餘量",
          unknown: display.safeMbps !== null ? display.marginHint : "速度樣本不足"
        }
      )}${display.ratio === null ? "" : `（保守速度約為需求的 ${display.ratio.toFixed(2)} 倍）`}`;
    const { safeMbps, ratio, requiredMbps } = display;
    summary += safeMbps !== null ? `
保守吞吐 ${safeMbps.toFixed(2)} Mbps` + (ratio !== null && requiredMbps !== null ? `｜需求 ${requiredMbps.toFixed(2)} Mbps｜餘裕 ${ratio.toFixed(2)} 倍` : `｜${display.marginHint}`) + `｜${display.speedHint}` : `
安全吞吐：${display.speedHint}`;
    if (display.estimatedCompletionMs !== null)
      summary += "\n目前請求完成預估：約 " + (display.estimatedCompletionMs / 1e3).toFixed(2) + " 秒";
    const restricted = activePlan?.ranking.filter((row) => !row.eligible).slice(0, 5) ?? [];
    if (restricted.length)
      summary += `
候選限制：${restricted.map((row) => `${row.host}（${row.reasons.map(restrictionLabel).join("、")}）`).join("；")}`;
    for (const [kind, label] of [
      ["video", "影片"],
      ["audio", "音訊"],
      ["unknown", "尚未分類媒體"]
    ]) {
      const transfer = display.transfers.find((entry) => entry.kind === kind);
      const row = kind === "unknown" ? latest[kind] : transfer?.observed;
      if (!row) {
        if (kind !== "unknown") summary += `
${label}：${transfer.detail}`;
        continue;
      }
      const age = Math.max(0, Math.floor((now - Number(row.observedAt)) / 1e3));
      summary += `
${label}：送往 ${row.targetHost ?? "未知"} → ${row.responseHost ? `回應來自 ${row.responseHost}` : "尚未取得回應來源"}｜${age} 秒前｜${plain(row.outcome, { success: "成功", failure: "失敗", abort: "已取消" })}${row.status ? `（HTTP ${row.status}）` : ""}
  腳本在送出前換 CDN：${row.hostChanged === true ? "有" : row.hostChanged === false ? "沒有" : "尚未確認"}｜提供播放器時換 CDN：${row.playurlHostChanged === true ? "有" : row.playurlHostChanged === false ? "沒有" : "尚未確認"}｜這筆請求：${attributionLabel(row.attributionStatus)}`;
      const output = row.playurlOutput;
      if (output)
        summary += `
  播放器取得的${output.role === "backup" ? "備用" : "主要"}網址：${output.originalHost} → ${output.outputHost}`;
    }
    summary += `
目前畫質：${display.format}`;
    const fallback = routes.fallback;
    for (const [kind, label] of [
      ["video", "影片"],
      ["audio", "音訊"]
    ]) {
      const row = fallback[kind];
      const stage = plain(row?.stage, {
        planned: "已選好，但還沒看到新請求",
        "entered-hook": "腳本看到新請求，尚未確認有回應",
        "response-observed": "已看到備用路線的回應",
        "request-failed": "備用路線請求失敗"
      });
      if (row)
        summary += `
${label}備用路線：${row.plannedHost}｜${stage}` + (row.responseHost ? `｜回應來自 ${row.responseHost}${row.status ? `（HTTP ${row.status}）` : ""}` : "");
    }
    summary += "\n※ 上述請求與回應由腳本觀察；要確認瀏覽器實際送出的網址，仍須查看 Chrome「網路」面板。";
    return summary;
  }
  __name(describeStatus, "describeStatus");

  // src-v2/ui/overview-view.ts
  function text2(tag, className, value = "") {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = value;
    return node;
  }
  __name(text2, "text");
  function metric(label, unit) {
    const node = text2("section", "metric");
    const value = text2("strong", "value", "—"), hint = text2("p", "detail");
    const number = text2("div", "number");
    number.append(value, text2("span", "unit", unit));
    node.append(text2("p", "detail", label), number, hint);
    return { node, value, hint };
  }
  __name(metric, "metric");
  function renderOverview(frame, actions, now, initialModel) {
    const status = text2("h3", "playback"), format = text2("span", "badge");
    const hero = text2("div", "hero");
    hero.append(status, format);
    const buffer = metric("可播放緩衝", "秒"), speed2 = metric("安全吞吐", "Mbps"), margin = metric("需求餘裕", "倍");
    const metrics = text2("div", "metrics");
    metrics.append(buffer.node, speed2.node, margin.node);
    const routes = text2("section", "panel routes");
    const transfers = ["video", "audio"].map((kind) => {
      const card = text2("div", "route"), host = text2("p", "route-host"), meta = text2("p", "detail");
      card.append(text2("h3", "", kind === "video" ? "影片回應" : "音訊回應"), host, meta);
      routes.append(card);
      return { kind, host, meta };
    });
    const selected = text2("p", "detail"), activity = text2("section", "panel activity");
    const startup = text2("p", "event"), measurement = text2("p", "event"), retry = text2("p", "event");
    activity.append(text2("h3", "", "最近狀態"), startup, measurement, retry);
    const details = text2("div", "status-details"), summary = text2("p", "summary");
    let currentModel = initialModel;
    let expanded = false;
    const expand = createButton("查看詳細狀態", () => {
      if (!actions.ownsView()) return;
      expanded = !expanded;
      expand.textContent = expanded ? "收起詳細狀態" : "查看詳細狀態";
      details.replaceChildren(...expanded ? [summary] : []);
      if (expanded) summary.textContent = describeStatus(currentModel, now());
    });
    frame.body.append(hero, metrics, routes, selected, activity, expand, details);
    const refresh = /* @__PURE__ */ __name((model) => {
      currentModel = model;
      const video = model.monitor.video, plan = model.routes.activePlan;
      const display = overviewPresentation(model, now());
      status.textContent = model.settings.disabled ? "腳本已停用" : monitorPlaybackLabel(model.monitor);
      format.textContent = display.format;
      buffer.value.textContent = video.available && Number.isFinite(video.playableBufferSec) ? Math.max(0, video.playableBufferSec).toFixed(1) : "—";
      buffer.hint.textContent = video.available ? "已按 " + video.effectiveRate + " 倍速折算" : "尚未取得播放資料";
      speed2.value.textContent = display.safeMbps !== null ? display.safeMbps.toFixed(2) : "—";
      speed2.hint.textContent = display.speedHint;
      margin.value.textContent = display.ratio !== null ? display.ratio.toFixed(2) : "—";
      margin.hint.textContent = display.marginHint;
      for (const entry of transfers) {
        const transfer = display.transfers.find((row) => row.kind === entry.kind);
        entry.host.textContent = transfer.host;
        entry.meta.textContent = transfer.detail;
      }
      selected.textContent = "選定路線：" + (model.session.affinity?.host ?? plan?.host ?? "尚未確認") + " · " + (model.settings.fixedHost ? "固定 CDN" : "自動 CDN");
      const start2 = model.measurement.startup;
      startup.textContent = "起播：" + (start2 ? startupLabel(start2.state, start2.reason, start2.result) + (start2.elapsedMs != null && Number.isFinite(start2.elapsedMs) ? " · " + Math.round(start2.elapsedMs) + " ms" : "") : "尚無起播量測");
      const range = model.measurement.range;
      measurement.textContent = "健康探測：" + measurementLabel(model.measurement.state, model.measurement.reason) + (range ? " · " + (range.mode === "middle" ? "中段" : "首段") + " · " + (range.sizeKnown ? "大小已驗證" : "大小未知") : "");
      retry.textContent = "提前重試：" + (!model.settings.earlyRetryEnabled ? "關閉" : model.earlyRetry ? plain(model.earlyRetry.state, {
        idle: "等待資格",
        waiting: "觀察中",
        armed: "已要求原生逾時",
        timedout: "已觀察原生逾時",
        claimed: "網站重試已配對",
        dispatched: "網站已重試",
        complete: "重試成功",
        cancelled: "已撤銷",
        suspended: "本分頁已停止"
      }) + " · " + model.earlyRetry.attempts + " 次" : "尚未取得狀態");
    }, "refresh");
    return { refresh };
  }
  __name(renderOverview, "renderOverview");

  // src-v2/ui/setting-controls.ts
  function settingToggle(label, value, update, actions, model, detail = "") {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("aria-label", label);
    let expected = value(model), pending = false;
    input.checked = expected;
    input.addEventListener("change", (event) => {
      if (!event.isTrusted || !actions.ownsView() || pending) {
        input.checked = expected;
        return;
      }
      const requested = input.checked;
      pending = true;
      expected = requested;
      const result = update(requested);
      void actions.refreshAfter(Promise.resolve(result), () => {
        pending = false;
      });
    });
    return {
      row: createRow(label, input, detail),
      refresh(model2) {
        if (!pending) {
          expected = value(model2);
          input.checked = expected;
        }
      }
    };
  }
  __name(settingToggle, "settingToggle");

  // src-v2/ui/settings-view.ts
  function renderSettings(commands, frame, actions, initialModel) {
    const rows = document.createElement("div");
    rows.className = "grid";
    const toggles = [
      [
        "earlyRetryEnabled",
        "慢請求提前重試",
        "緩衝不足且替代路線證據充足時，讓網站提早重試。效用評估仍未達原定門檻。"
      ],
      ["blockWebRtc", "阻止網頁使用 WebRTC", "阻止網頁建立點對點連線。"],
      ["blockHttpDns", "阻止網頁使用 HTTPDNS", "阻止網頁透過 HTTPDNS 另行尋找 CDN。"]
    ].map(
      ([key, label, detail]) => settingToggle(
        label,
        (m) => m.settings[key],
        (value) => commands.updateSettings({ [key]: value }),
        actions,
        initialModel,
        detail
      )
    );
    rows.append(...toggles.map((t) => t.row));
    const note = document.createElement("p");
    note.className = "detail";
    note.textContent = "影片格式交由 B 站設定。變更功能後，請以新的播放情境比較效果。";
    const tools = document.createElement("details");
    tools.className = "panel tools";
    const title = document.createElement("summary");
    title.textContent = "維護工具";
    const confirm = document.createElement("div");
    confirm.className = "confirmation";
    const ask = /* @__PURE__ */ __name((message, command) => {
      if (!actions.ownsView()) return;
      const text3 = document.createElement("p");
      text3.textContent = message;
      confirm.replaceChildren(
        text3,
        createButton(
          "確認執行",
          () => {
            if (!actions.ownsView()) return;
            confirm.replaceChildren();
            return actions.refreshAfter(command());
          },
          "danger"
        ),
        createButton("取消", () => confirm.replaceChildren())
      );
    }, "ask");
    tools.append(
      title,
      createButton(
        "清除測速紀錄、黑名單與故障標記",
        () => ask("清除已學習的速度與限制資料？", () => commands.clearLearning()),
        "danger"
      ),
      createButton(
        "還原預設設定（不清除測速紀錄）",
        () => ask("還原所有設定？三個功能開關與節點將使用新版預設。", () => commands.resetSettings()),
        "danger"
      ),
      confirm
    );
    frame.body.append(rows, note, tools);
    return {
      refresh: /* @__PURE__ */ __name((model) => {
        for (const toggle of toggles) toggle.refresh(model);
      }, "refresh")
    };
  }
  __name(renderSettings, "renderSettings");

  // src-v2/ui/cdn-view.ts
  function renderCdn(commands, frame, actions, initialModel) {
    const mode = document.createElement("select");
    mode.setAttribute("aria-label", "CDN 選擇方式");
    mode.append(
      new Option("自動挑選 CDN", ""),
      ...TRUSTED_CATALOG.map((host) => new Option("固定：" + host, host))
    );
    let currentModel = initialModel;
    mode.value = currentModel.settings.fixedHost ?? "";
    let pending = false;
    mode.addEventListener("change", (event) => {
      if (!event.isTrusted || !actions.ownsView() || pending) {
        mode.value = currentModel.settings.fixedHost ?? "";
        return;
      }
      pending = true;
      void actions.refreshAfter(commands.updateSettings({ fixedHost: mode.value || null }), () => {
        pending = false;
      });
    });
    const native = settingToggle(
      "允許參考 B 站原生來源",
      (m) => m.settings.considerNativeSources,
      (value) => commands.updateSettings({ considerNativeSources: value }),
      actions,
      initialModel,
      "預設啟用。開啟時，B 站當次授權的來源可以參與選路；禁止規則仍有效。"
    );
    const list = document.createElement("div");
    list.className = "grid";
    const nodes = TRUSTED_CATALOG.map((host) => {
      const enabled = !DEFAULT_UNAVAILABLE_HOSTS.has(host);
      const toggle = settingToggle(
        host,
        (m) => m.settings.catalogOverrides[host] ?? enabled,
        (value) => commands.setCatalogEnabled(host, value),
        actions,
        initialModel,
        enabled ? "預設可用；勾選表示允許選路" : "預設不使用；勾選後才允許選路"
      );
      const restrictions = document.createElement("p");
      restrictions.className = "detail restriction";
      toggle.row.append(restrictions);
      return { host, toggle, restrictions };
    });
    list.append(...nodes.map((n) => n.toggle.row));
    frame.body.append(
      createRow("CDN 選擇方式", mode, "固定與自動模式都會遵守授權及禁止規則。"),
      native.row,
      list
    );
    const refresh = /* @__PURE__ */ __name((model) => {
      currentModel = model;
      if (!pending) mode.value = model.settings.fixedHost ?? "";
      native.refresh(model);
      for (const node of nodes) {
        node.toggle.refresh(model);
        const rows = model.restrictions.filter((row) => row.host === node.host);
        const restriction = rows.length ? "目前限制：" + rows.map(
          (row) => restrictionLabel(row.type) + "（" + (row.kind === "all" ? "影片＋音訊" : row.kind === "video" ? "影片" : "音訊") + "）"
        ).join("、") + "；勾選不會解除禁止" : "";
        node.restrictions.textContent = [
          restriction,
          ...model.routes.circuits.filter((row) => row.host === node.host).map(circuitPresentation)
        ].filter(Boolean).join("；");
      }
    }, "refresh");
    return { refresh };
  }
  __name(renderCdn, "renderCdn");

  // src-v2/ui/control-center.ts
  var ControlCenter = class {
    constructor(deps) {
      this.deps = deps;
    }
    deps;
    static {
      __name(this, "ControlCenter");
    }
    #host = null;
    #shadow = null;
    #opener = null;
    #viewVersion = 0;
    #queuedRefresh = null;
    #open = false;
    #releaseKeyboard = null;
    #binding = null;
    #subscriptions = [];
    #frame = null;
    #tabs = {};
    #power = null;
    #notice = null;
    show(opener) {
      this.#open = true;
      this.#opener = opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      this.#ensure();
      this.#observeKeyboard();
      this.#releaseView();
      this.#shell();
      this.#navigate("overview");
      this.#subscriptions.push(
        this.deps.model.subscribe((source) => {
          if (source === "settings") this.#refresh();
          else this.#queueRefresh();
        })
      );
    }
    close() {
      this.#open = false;
      this.#viewVersion++;
      this.#clearKeyboard();
      this.#releaseView();
      this.#frame = null;
      this.#tabs = {};
      this.#power = null;
      this.#notice = null;
      if (this.#shadow) this.#shadow.replaceChildren(createControlCenterStyle());
      const target = this.#opener?.isConnected ? this.#opener : document.querySelector("video") ?? document.body;
      if (target instanceof HTMLElement) {
        try {
          target.focus({ preventScroll: true });
        } catch {
        }
      }
    }
    #ensure() {
      if (this.#host?.isConnected && this.#shadow) return;
      this.#clearKeyboard();
      this.#host = document.createElement("div");
      this.#host.id = "bilicdn-v2-control-center";
      this.#shadow = this.#host.attachShadow({ mode: "closed" });
      this.#shadow.append(createControlCenterStyle());
      document.documentElement.append(this.#host);
    }
    #clearKeyboard() {
      this.#releaseKeyboard?.();
      this.#releaseKeyboard = null;
    }
    #observeKeyboard() {
      if (this.#releaseKeyboard || !this.#host || !this.#shadow) return;
      const host = this.#host, shadow = this.#shadow;
      const onKeyboard = /* @__PURE__ */ __name((event) => {
        if (!event.isTrusted || !this.#open || this.#host !== host || this.#shadow !== shadow || !host.isConnected || event.currentTarget !== shadow)
          return;
        event.stopPropagation();
        if (event.type === "keydown" && event.key === "Escape") {
          event.preventDefault();
          this.close();
        }
      }, "onKeyboard");
      const types = ["keydown", "keypress", "keyup"];
      for (const type of types) shadow.addEventListener(type, onKeyboard);
      this.#releaseKeyboard = () => {
        for (const type of types) shadow.removeEventListener(type, onKeyboard);
      };
    }
    #releaseView() {
      this.#queuedRefresh = null;
      for (const release of this.#subscriptions.splice(0)) release();
      this.#binding?.dispose?.();
      this.#binding = null;
    }
    #shell() {
      const backdrop = document.createElement("div");
      backdrop.className = "backdrop";
      const dialog = document.createElement("section");
      dialog.className = "dialog";
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.setAttribute("aria-label", "BiliCDN 控制中心");
      const head = document.createElement("header");
      head.className = "head";
      const brand = document.createElement("div");
      brand.className = "brand";
      const heading = document.createElement("h2");
      heading.textContent = "BiliCDN 控制中心";
      const version = document.createElement("p");
      version.className = "detail";
      version.textContent = "v" + this.deps.version + " · 播放與路線狀態";
      brand.append(heading, version);
      const power = createButton("", () => {
        if (!this.#open || this.#power !== power) return;
        return this.#refreshAfter(
          this.deps.commands.updateSettings({
            disabled: !this.deps.model.snapshot().settings.disabled
          })
        );
      });
      power.className = "btn power";
      this.#power = power;
      const close = createButton("關閉", () => {
        if (this.#open && this.#power === power) this.close();
      });
      close.dataset.action = "close";
      head.append(brand, power, close);
      const nav = document.createElement("nav");
      nav.className = "tabs";
      nav.setAttribute("aria-label", "控制中心頁面");
      this.#tabs = {};
      for (const [page, label] of [
        ["overview", "總覽"],
        ["cdn", "CDN"],
        ["settings", "播放設定"]
      ]) {
        const tab = createButton(label, () => {
          if (this.#open && this.#tabs[page] === tab) this.#navigate(page);
        });
        tab.className = "tab";
        this.#tabs[page] = tab;
        nav.append(tab);
      }
      const body = document.createElement("div");
      body.className = "body";
      const foot = document.createElement("footer");
      foot.className = "foot";
      const notice = document.createElement("p");
      notice.className = "notice";
      notice.setAttribute("aria-live", "polite");
      this.#notice = notice;
      dialog.append(head, nav, body, foot, notice);
      backdrop.append(dialog);
      this.#frame = { body, foot };
      this.#shadow?.replaceChildren(createControlCenterStyle(), backdrop);
      queueMicrotask(() => {
        if (this.#open && this.#power === power && close.isConnected) close.focus();
      });
    }
    #navigate(page) {
      if (!this.#frame) return;
      this.#queuedRefresh = null;
      const version = ++this.#viewVersion;
      this.#binding?.dispose?.();
      this.#binding = null;
      this.#frame.body.replaceChildren();
      this.#frame.foot.replaceChildren();
      for (const [name, tab] of Object.entries(this.#tabs))
        tab.setAttribute("aria-current", name === page ? "page" : "false");
      if (this.#notice) this.#notice.textContent = "";
      const actions = {
        ownsView: /* @__PURE__ */ __name(() => this.#ownsView(version), "ownsView"),
        refresh: /* @__PURE__ */ __name(() => {
          if (this.#ownsView(version)) this.#refresh();
        }, "refresh"),
        refreshAfter: /* @__PURE__ */ __name((command, settled) => this.#refreshAfter(command, version, settled), "refreshAfter")
      };
      const model = this.deps.model.snapshot();
      if (!this.#ownsView(version)) return;
      this.#binding = page === "overview" ? renderOverview(this.#frame, actions, this.deps.now, model) : page === "cdn" ? renderCdn(this.deps.commands, this.#frame, actions, model) : renderSettings(this.deps.commands, this.#frame, actions, model);
      this.#refresh(model);
    }
    #refresh(model) {
      if (!this.#open || !this.#host?.isConnected) return;
      const version = this.#viewVersion, host = this.#host;
      if (!model) {
        this.#queuedRefresh = null;
        model = this.deps.model.snapshot();
      }
      if (!this.#ownsView(version) || this.#host !== host || !host.isConnected) return;
      if (this.#power) {
        const enabled = !model.settings.disabled;
        this.#power.textContent = enabled ? "停用腳本" : "啟用腳本";
        this.#power.setAttribute("aria-pressed", String(enabled));
      }
      this.#binding?.refresh(model);
    }
    #queueRefresh() {
      if (!this.#open || this.#queuedRefresh) return;
      const work = { version: this.#viewVersion };
      this.#queuedRefresh = work;
      queueMicrotask(() => {
        if (this.#queuedRefresh !== work) return;
        this.#queuedRefresh = null;
        if (this.#ownsView(work.version)) this.#refresh();
      });
    }
    #ownsView(version) {
      return this.#open && this.#viewVersion === version;
    }
    async #refreshAfter(command, version = this.#viewVersion, settled) {
      try {
        await command;
        settled?.();
        if (this.#ownsView(version)) this.#refresh();
      } catch {
        settled?.();
        if (this.#ownsView(version)) {
          this.#refresh();
          if (this.#notice) this.#notice.textContent = "設定未能保存，請稍後再試。";
        }
      }
    }
  };

  // src-v2/ui/player-panel.ts
  var PlayerPanel = class {
    constructor(center, settings, session, monitor) {
      this.center = center;
      this.settings = settings;
      this.session = session;
      this.monitor = monitor;
    }
    center;
    settings;
    session;
    monitor;
    static {
      __name(this, "PlayerPanel");
    }
    #timer = null;
    start() {
      if (this.#timer === null) {
        this.#timer = window.setInterval(() => this.#ensure(), 1500);
        this.#ensure();
      }
    }
    stop() {
      if (this.#timer !== null) clearInterval(this.#timer);
      this.#timer = null;
      document.querySelectorAll("[data-bilicdn-v2-panel]").forEach((node) => node.remove());
    }
    #ensure() {
      const anchors = [...document.querySelectorAll(".bpx-player-ctrl-setting-others")];
      if (!anchors.length) return;
      const anchor = anchors.sort((a, b) => this.#area(b) - this.#area(a))[0];
      if (!anchor) return;
      const existing = anchor.querySelector("[data-bilicdn-v2-panel]");
      if (existing) {
        const status2 = existing.querySelector("[data-bilicdn-v2-status]");
        if (status2) this.#renderStatus(status2);
        return;
      }
      const panel = document.createElement("div");
      panel.dataset.bilicdnV2Panel = "true";
      panel.style.cssText = "padding:4px 0 7px;font:11px/1.5 system-ui;color:#dbeafe";
      const status = document.createElement("div");
      status.dataset.bilicdnV2Status = "true";
      status.style.cssText = "padding:2px 0 5px;color:#7dd3fc";
      this.#renderStatus(status);
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "⚙️ 開啟 BiliCDN 控制中心";
      button.style.cssText = "display:block;width:100%;padding:6px 8px;border:1px solid #38bdf8;border-radius:6px;background:#12344a;color:#e0f2fe;cursor:pointer";
      button.addEventListener("click", (event) => {
        if (!event.isTrusted) return;
        event.preventDefault();
        event.stopPropagation();
        this.center.show(button);
      });
      panel.append(status, button);
      anchor.append(panel);
    }
    #renderStatus(status) {
      const state = this.session.get(), video = this.monitor.snapshot().video;
      status.textContent = `${this.settings.get().disabled ? "腳本已停用" : "BiliCDN 已啟用"}｜選定 CDN：${state.affinity?.host ?? "尚未確認"}｜${video.effectiveRate} 倍速｜可播放約 ${video.playableBufferSec.toFixed(1)} 秒`;
    }
    #area(anchor) {
      const root = anchor.closest('[id*="bilibili-player"],[class*="bpx-player"]');
      const video = root?.querySelector("video");
      return video ? video.clientWidth * video.clientHeight : 0;
    }
  };

  // src-v2/adapters/scheduler.ts
  var BrowserScheduler = class {
    static {
      __name(this, "BrowserScheduler");
    }
    timeout(task, delayMs) {
      const id2 = setTimeout(task, delayMs);
      return () => clearTimeout(id2);
    }
    interval(task, delayMs) {
      const id2 = setInterval(task, delayMs);
      return () => clearInterval(id2);
    }
    microtask(task) {
      queueMicrotask(task);
    }
  };

  // src-v2/adapters/navigation.ts
  function navigationKey(pathname, search) {
    if (!/^\/(?:video\/[^/]+|bangumi\/play\/[^/]+)\/?$/.test(pathname)) return pathname + search;
    const path = pathname.replace(/\/$/, "");
    const query = new URLSearchParams(search);
    query.delete("vd_source");
    query.delete("spm_id_from");
    const parts = query.getAll("p");
    if (path.startsWith("/video/") && parts.length === 1 && parts[0] === "1") query.delete("p");
    query.sort();
    const suffix = query.toString();
    return path + (suffix ? "?" + suffix : "");
  }
  __name(navigationKey, "navigationKey");
  var BrowserNavigation = class {
    static {
      __name(this, "BrowserNavigation");
    }
    key() {
      return navigationKey(location.pathname, location.search);
    }
    subscribe(listener) {
      const push = history.pushState, replace = history.replaceState;
      let active = true;
      const after = /* @__PURE__ */ __name(() => queueMicrotask(() => {
        if (active) listener();
      }), "after");
      const wrappedPush = /* @__PURE__ */ __name(function(...args) {
        Reflect.apply(push, this, args);
        after();
      }, "wrappedPush");
      const wrappedReplace = /* @__PURE__ */ __name(function(...args) {
        Reflect.apply(replace, this, args);
        after();
      }, "wrappedReplace");
      history.pushState = wrappedPush;
      history.replaceState = wrappedReplace;
      addEventListener("popstate", listener);
      return () => {
        active = false;
        if (history.pushState === wrappedPush) history.pushState = push;
        if (history.replaceState === wrappedReplace) history.replaceState = replace;
        removeEventListener("popstate", listener);
      };
    }
  };

  // src-v2/entry.ts
  var start = /* @__PURE__ */ __name(() => {
    const now = /* @__PURE__ */ __name(() => Date.now(), "now");
    const monotonicNow = (() => {
      try {
        return performance.now.bind(performance);
      } catch {
        return () => null;
      }
    })();
    const clock = { now, monotonicNow };
    const scheduler = new BrowserScheduler();
    const storage = new TampermonkeyStorage();
    const settings = new SettingsStore(storage, now);
    const restrictions = new RestrictionStore(storage, now);
    const ids = createRuntimeIds();
    const evidence = new EvidenceStore(storage, now, ids);
    const session = new SessionStore();
    const vault = new SignedRouteVault();
    const routes = new RouteCoordinator(clock, session, settings, restrictions, evidence, vault, ids);
    const meta = new MeasurementMetaStore(
      storage,
      now,
      ids,
      (host, kind) => evidence.readCurrentControl(host, kind)
    );
    const content = new PlayurlController(session, vault, routes);
    const playurl = new PlayurlAdapter(content);
    const visibility = new VisibilityAdapter();
    const player = new PlayerAdapter(playurl, {
      scheduler,
      now,
      isActuallyVisible: /* @__PURE__ */ __name(() => visibility.isActuallyVisible(), "isActuallyVisible"),
      subscribeControlLoss: /* @__PURE__ */ __name((listener) => visibility.subscribeControlLoss(listener), "subscribeControlLoss")
    });
    const recovery = new RecoveryController(
      player,
      now,
      () => !settings.get().disabled && visibility.isActuallyVisible(),
      () => {
        const request = routes.latestRequested("video");
        return () => !!request && routes.recoveryEligible(request) && routes.latestRequested("video")?.representation === request.representation;
      }
    );
    const nativeFetch = unsafeWindow.fetch.bind(unsafeWindow);
    const measurement = new MeasurementController(
      routes,
      meta,
      new RangeProbeAdapter(nativeFetch, monotonicNow),
      now,
      scheduler,
      vault,
      Math.random,
      settings,
      monotonicNow,
      ids
    );
    const transport = new TransportAdapter(
      session,
      settings,
      routes,
      playurl,
      measurement,
      now,
      ids,
      routes,
      monotonicNow
    );
    transport.install();
    const earlyRetry = new EarlyRetryController(
      {
        alternatives: /* @__PURE__ */ __name((request, demand) => routes.earlyRetryAlternatives(request, demand), "alternatives"),
        prepare: /* @__PURE__ */ __name((request, host, demand) => routes.prepareEarlyRetry(request, host, demand), "prepare"),
        revoke: /* @__PURE__ */ __name((permit) => routes.revokeEarlyRetry(permit), "revoke")
      },
      transport,
      now
    );
    const monitor = new PlayerMonitor(
      player,
      session,
      settings,
      vault,
      routes,
      measurement,
      recovery,
      () => visibility.isActuallyVisible(),
      now,
      scheduler,
      earlyRetry,
      monotonicNow
    );
    const runtime = new RuntimeController(
      settings,
      routes,
      player,
      monitor,
      measurement,
      recovery,
      visibility,
      content,
      earlyRetry
    );
    let lifecycle = null;
    const pagePlayinfo = new PagePlayinfoAdapter(
      (payload, serial) => lifecycle?.acceptPageAssignment(payload, serial),
      () => !settings.get().disabled && routes.isCatalogOnly()
    );
    lifecycle = new LifecycleController(
      session,
      settings,
      vault,
      routes,
      playurl,
      pagePlayinfo,
      runtime,
      now,
      new BrowserNavigation(),
      scheduler
    );
    const webRtc = new WebRtcAdapter(settings);
    const commands = new ControlCommands(settings, restrictions, evidence, meta, routes);
    const version = GM_info?.script?.version ?? "未知";
    const center = new ControlCenter({
      version,
      commands,
      now,
      model: createControlReadModel({
        settings,
        restrictions,
        session,
        routes,
        measurement,
        monitor,
        recovery,
        transport,
        earlyRetry
      })
    });
    const panel = new PlayerPanel(center, settings, session, monitor);
    runtime.install();
    webRtc.install();
    lifecycle.start();
    panel.start();
    try {
      GM_registerMenuCommand("⚙️ 開啟 BiliCDN 控制中心", () => center.show());
    } catch {
    }
  }, "start");
  start();
})();
