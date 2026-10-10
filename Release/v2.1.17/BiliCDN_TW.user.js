// ==UserScript==
// @name         Bilibili CDN 台灣優化
// @namespace    BiliCDN_TW
// @version      2.1.17
// @description  為台灣網路自動選擇穩定的 Bilibili CDN，支援 2x、自動畫質、背景播放與故障恢復
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
// @grant        GM_setClipboard
// @grant        GM_info
// @grant        unsafeWindow
// ==/UserScript==

(() => {
  var __defProp = Object.defineProperty;
  var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

  // src-v2/adapters/range-probe.ts
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
      const startedAt = this.now();
      let bytes2 = 0, responseAt = null;
      const result = /* @__PURE__ */ __name((status, directRange, reason) => ({
        status,
        directRange,
        reason,
        bytes: bytes2,
        elapsedMs: Math.max(1, this.now() - startedAt),
        ttfbMs: responseAt === null ? null : responseAt - startedAt
      }), "result");
      try {
        if (input.signal.aborted) return result(null, false, input.signal.reason === "timeout" ? "timeout" : "cancelled");
        const response = await this.nativeFetch(input.url, {
          method: "GET",
          headers: { Range: `bytes=0-${input.limit - 1}` },
          credentials: "omit",
          cache: "no-store",
          redirect: "error",
          signal: input.signal
        });
        responseAt = this.now();
        let direct = false;
        try {
          const url = new URL(response.url);
          direct = !response.redirected && !!input.host && url.protocol === "https:" && !url.port && url.hostname.toLowerCase() === input.host;
        } catch {
        }
        if (!direct) {
          await response.body?.cancel("redirected-response");
          return result(null, false, "redirected-response");
        }
        if (response.status !== 206 || !response.body) {
          await response.body?.cancel("range-required");
          return result(response.status, false, `http-${response.status}`);
        }
        const reader = response.body.getReader();
        try {
          while (bytes2 < input.limit && !input.signal.aborted) {
            const item = await reader.read();
            if (item.done) break;
            bytes2 = Math.min(input.limit, bytes2 + item.value.byteLength);
            if (bytes2 >= input.limit) {
              await reader.cancel(input.completionReason);
              break;
            }
          }
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
        if (input.signal.aborted) return result(null, false, input.signal.reason === "timeout" ? "timeout" : "cancelled");
        return result(response.status, true, "measured");
      } catch {
        return result(null, false, input.signal.aborted ? input.signal.reason === "timeout" ? "timeout" : "cancelled" : "network");
      }
    }
  };

  // src-v2/domain/url-policy.ts
  var MEDIA_URL_MAX_LENGTH = 16 * 1024;
  var MEDIA_PATH_RE = /\.(?:m4s|mp4|flv|m3u8)$/i;
  var IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
  var PCDN_SUFFIXES = ["szbdyd.com", "mountaintoys.cn", "nexusedgeio.com", "ahdohpiechei.com"];
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
    if (url.pathname.startsWith("/v1/resource")) return { url, host, kind: "resource", replaceable: false };
    const label = host.split(".")[0] ?? "";
    const nonDefaultPort = !!url.port && url.port !== "80" && url.port !== "443";
    const pcdn = /\.mcdn\.bilivideo\.(?:com|cn|net)$/i.test(host) || isKnownPcdnHost(host) || PCDN_HOSTS.has(host) || label.startsWith("upos-") && label.includes("302") || String(url.searchParams.get("os") ?? "").toLowerCase() === "mcdn" || IPV4_RE.test(host) && nonDefaultPort;
    if (pcdn) return { url, host, kind: "pcdn", replaceable: true };
    if (nonDefaultPort || IPV4_RE.test(host)) return { url, host, kind: "suspected-pcdn", replaceable: false };
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
    "upos-hz-mirroraliov.bilivideo.com"
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
  var isPlayurlApi = /* @__PURE__ */ __name((value, baseUrl2) => {
    try {
      const url = new URL(value, baseUrl2);
      return url.hostname === "api.bilibili.com" && PLAYURL_PATH.test(url.pathname);
    } catch {
      return false;
    }
  }, "isPlayurlApi");

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
    return { changed, identity: Object.freeze({
      contentId: contentId ?? retained?.contentId ?? null,
      video: merge(video, retained?.video ?? [], 128),
      audio: merge(audio, retained?.audio ?? [], 64)
    }) };
  }
  __name(observePlayurlContent, "observePlayurlContent");

  // src-v2/application/playurl-controller.ts
  var PlayurlController = class {
    constructor(session, vault, routes, settings) {
      this.session = session;
      this.vault = vault;
      this.routes = routes;
      this.settings = settings;
    }
    session;
    vault;
    routes;
    settings;
    static {
      __name(this, "PlayurlController");
    }
    #epochListeners = /* @__PURE__ */ new Set();
    #seenTrusted = /* @__PURE__ */ new WeakSet();
    #trustedItems = /* @__PURE__ */ new WeakMap();
    #seenPage = /* @__PURE__ */ new WeakMap();
    #responses = /* @__PURE__ */ new Set();
    #generation = -1;
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
    codecPreference() {
      return this.settings.get().codec;
    }
    lifecycleKey() {
      const s = this.session.get();
      return `${s.generation}:${s.epoch}`;
    }
    ingest(payload, source = "trusted-api", responseKey, context) {
      const outputs = [];
      const rewriteItem2 = /* @__PURE__ */ __name((item, primary, backups) => {
        outputs.push({ token: item.token, primary, backups });
      }, "rewriteItem");
      if (this.session.get().disabled) return null;
      if (this.#generation !== Number(this.session.get().generation)) {
        this.#generation = Number(this.session.get().generation);
        this.#responses.clear();
        this.#contentIdentity = null;
        this.#seenTrusted = /* @__PURE__ */ new WeakSet();
        this.#trustedItems = /* @__PURE__ */ new WeakMap();
      }
      const catalogOnly = this.routes.isCatalogOnly();
      if (responseKey && this.#responses.has(responseKey) && !catalogOnly) return outputs;
      const dash = payload;
      if (!dash || !dash.video.length && !dash.audio.length) return null;
      if (payload && typeof payload === "object") {
        if (source === "trusted-api") {
          if (this.#seenTrusted.has(payload.token)) {
            if (catalogOnly) {
              for (const [kind, items] of [["video", dash.video], ["audio", dash.audio]]) {
                for (const item of items) {
                  const identity = this.#trustedItems.get(item.token);
                  if (identity && this.vault.isCurrentIdentity(identity))
                    this.#sanitizeKnownItem(item, identity.representation, kind, "trusted-api", true, rewriteItem2);
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
      if (source === "trusted-api") {
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
          this.vault.reset(state2.generation, state2.epoch);
          this.routes.resetEpoch();
          this.#trustedItems = /* @__PURE__ */ new WeakMap();
          const identity = Object.freeze({ generation: state2.generation, epoch: state2.epoch });
          for (const listener of this.#epochListeners) listener(identity);
        }
      }
      if (responseKey) {
        this.#responses.add(responseKey);
        while (this.#responses.size > 128) this.#responses.delete(this.#responses.values().next().value);
      }
      const state = this.session.get();
      for (const [kind, items] of [["video", dash.video], ["audio", dash.audio]]) {
        items.forEach((item) => {
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
              urls,
              source
            });
            if (rep2 && source === "trusted-api") {
              const identity = this.vault.identity(rep2);
              if (identity) this.#trustedItems.set(item.token, identity);
            }
            if (rep2 && source !== "trusted-api" && this.vault.source(rep2) === "trusted-api") {
              if (source === "page-hint" && catalogOnly) this.#sanitizeKnownItem(item, rep2, kind, "page-hint", false, rewriteItem2);
              return;
            }
            if (source !== "player-mpd") {
              const output2 = rep2 ? this.routes.opaqueOutput(rep2, primary, urls, source) : { primary: "", backups: [] };
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
            urls,
            source,
            refreshTrustedSources: source === "trusted-api" && item.progressive === true
          });
          if (rep && source === "trusted-api") {
            const identity = this.vault.identity(rep);
            if (identity) this.#trustedItems.set(item.token, identity);
          }
          if (rep && source !== "trusted-api" && this.vault.source(rep) === "trusted-api") {
            if (source === "page-hint" && catalogOnly) this.#sanitizeKnownItem(item, rep, kind, "page-hint", false, rewriteItem2);
            return;
          }
          if (!rep) {
            if (source !== "player-mpd") {
              if (item.progressive) {
                rewriteItem2(item, "", []);
                return;
              }
              const primaryOutput = this.routes.apply(primary, kind, void 0, true);
              const backups = this.routes.isCatalogOnly() ? [] : primaryOutput.url ? [...new Set(urls.map((url) => this.routes.apply(url).url).filter((url) => !!url && url !== primaryOutput.url))].slice(0, 5) : [];
              const safePrimary = primaryOutput.url && (catalogOnly || this.routes.isBilibiliMedia(primaryOutput.url)) ? primaryOutput.url : "";
              rewriteItem2(item, safePrimary, safePrimary ? backups.filter((url) => catalogOnly || this.routes.isBilibiliMedia(url)) : []);
            }
            return;
          }
          if (source === "player-mpd") return;
          const requiredMbps = Math.max(
            kind === "audio" ? 0.5 : 2,
            (bandwidth || (kind === "audio" ? 192e3 : 4e6)) / 1e6 * this.routes.playbackRate() * 1.25
          );
          const demand = { kind, requiredMbps, highDemand: requiredMbps >= 12 };
          const decision = this.routes.plan(rep, demand, this.session.get().affinity ? "representation" : "startup");
          const output = this.routes.playerOutput(rep, primary, decision, item.progressive ? this.vault.sourceURLs(rep) : urls, source);
          rewriteItem2(item, output.primary, output.backups);
        });
      }
      return outputs;
    }
    #sanitizeKnownItem(item, representation, kind, source, recordOutput, rewriteItem2) {
      const original = this.vault.rootUrl(representation);
      if (!original) {
        rewriteItem2(item, "", []);
        return;
      }
      const bandwidth = this.vault.groupSummary(representation)?.bandwidth ?? 0;
      const requiredMbps = Math.max(
        kind === "audio" ? 0.5 : 2,
        (bandwidth || (kind === "audio" ? 192e3 : 4e6)) / 1e6 * this.routes.playbackRate() * 1.25
      );
      const demand = { kind, requiredMbps, highDemand: requiredMbps >= 12 };
      const decision = this.routes.plan(representation, demand, this.session.get().affinity ? "representation" : "startup");
      const output = this.routes.playerOutput(representation, original, decision, this.vault.sourceURLs(representation), source, recordOutput);
      rewriteItem2(item, output.primary, output.backups);
    }
  };

  // src-v2/application/runtime-controller.ts
  var RuntimeController = class {
    constructor(session, settings, routes, player, monitor, measurement, recovery, visibility, diagnostics, now, content) {
      this.session = session;
      this.settings = settings;
      this.routes = routes;
      this.player = player;
      this.monitor = monitor;
      this.measurement = measurement;
      this.recovery = recovery;
      this.visibility = visibility;
      this.diagnostics = diagnostics;
      this.now = now;
      this.content = content;
    }
    session;
    settings;
    routes;
    player;
    monitor;
    measurement;
    recovery;
    visibility;
    diagnostics;
    now;
    content;
    static {
      __name(this, "RuntimeController");
    }
    #stops = [];
    install() {
      if (this.#stops.length) return;
      this.#stops.push(this.content.subscribeEpoch((state) => {
        this.reset();
        this.record({ type: "lifecycle", at: this.now(), ...state, reason: "content-epoch" });
      }));
      this.#stops.push(
        this.routes.subscribe((event) => this.record(event)),
        this.recovery.subscribe((event) => this.record(event)),
        this.monitor.subscribe((snapshot) => this.diagnostics.recordPlayer(this.#sample(snapshot.video, snapshot.watchdog, this.now())))
      );
      this.visibility.setEnabled(!this.settings.get().disabled);
      const signature = /* @__PURE__ */ __name((state) => JSON.stringify([state.fixedHost, state.catalogOverrides, state.considerNativeSources]), "signature");
      let routeSettings = signature(this.settings.get());
      this.#stops.push(this.settings.subscribe((state) => {
        this.visibility.setEnabled(!state.disabled);
        const next = signature(state);
        if (next !== routeSettings) {
          routeSettings = next;
          this.routes.invalidateForUserSetting();
          this.measurement.reset();
          this.recovery.reset();
        }
      }));
    }
    record(event) {
      this.diagnostics.record(event, !this.settings.get().disabled && !this.routes.isOriginalComparison());
      if (event.type === "recovery" && event.action.action === "route-fallback" && event.action.kind === "video" && !this.routes.isOriginalComparison()) {
        const snapshot = this.player.snapshot();
        this.diagnostics.recordPlayer(this.#sample(snapshot, this.monitor.snapshot().watchdog, event.at));
        const request = this.routes.latestRequested("video");
        this.recovery.armRouteFailure("route-failure", snapshot, () => !!request && this.routes.recoveryEligible(request) && this.routes.latestRequested("video")?.representation === request.representation);
      }
    }
    start() {
      this.monitor.start();
    }
    stop() {
      this.monitor.stop();
    }
    reset() {
      this.monitor.reset();
      this.measurement.reset();
      this.recovery.reset();
      this.player.reset();
    }
    dispose() {
      for (const stop of this.#stops.splice(0).reverse()) stop();
    }
    #sample(video, watchdog, at) {
      return {
        at,
        generation: this.session.get().generation,
        epoch: this.session.get().epoch,
        enabled: !this.settings.get().disabled,
        originalComparison: this.routes.isOriginalComparison(),
        currentTimeSec: video.currentTime,
        frames: video.frames,
        playableBufferSec: video.playableBufferSec,
        paused: video.paused,
        seeking: video.seeking,
        ended: video.ended,
        readyState: video.readyState,
        coreInitialized: video.coreInitialized,
        watchdog
      };
    }
  };

  // src-v2/application/control-commands.ts
  var ControlCommands = class {
    constructor(settings, restrictions, evidence, meta, routes, measurement, recovery, now) {
      this.settings = settings;
      this.restrictions = restrictions;
      this.evidence = evidence;
      this.meta = meta;
      this.routes = routes;
      this.measurement = measurement;
      this.recovery = recovery;
      this.now = now;
    }
    settings;
    restrictions;
    evidence;
    meta;
    routes;
    measurement;
    recovery;
    now;
    static {
      __name(this, "ControlCommands");
    }
    updateSettings(change) {
      return this.settings.update(change);
    }
    setCatalogEnabled(host, enabled) {
      return this.settings.setCatalogEnabled(host, enabled);
    }
    setOriginalComparison(enabled) {
      this.routes.setOriginalComparison(enabled);
      this.measurement.reset();
      this.recovery.reset();
    }
    requestMeasurement() {
      this.measurement.requestManual();
    }
    async blacklistLatestVideo() {
      const host = this.routes.latestVideoHost();
      if (host) await this.restrictions.add({ host, type: "black", kind: "all", reason: "user", expireAt: this.now() + 24 * 60 * 60 * 1e3 });
      this.routes.invalidateForUserSetting();
    }
    async clearLearning() {
      await this.evidence.clear();
      await this.restrictions.clear();
      this.meta.clear();
    }
    async resetSettings() {
      await this.settings.reset();
      this.routes.invalidateForUserSetting();
    }
  };

  // src-v2/state/measurement-meta-store.ts
  var MEASUREMENT_META_KEY = "bilicdn.v2.meta";
  var MeasurementMetaStore = class {
    constructor(storage, now) {
      this.storage = storage;
      this.now = now;
    }
    storage;
    now;
    static {
      __name(this, "MeasurementMetaStore");
    }
    get() {
      const raw = this.#raw();
      return { catalogCursor: Math.max(0, Number(raw.catalogCursor) || 0), lastChallengeAt: Number(raw.lastChallengeAt) || 0 };
    }
    update(change) {
      this.storage.set(MEASUREMENT_META_KEY, { ...this.#raw(), ...change, schema: 2, updatedAt: this.now() });
    }
    withLock(task) {
      return this.storage.withLock("measurement", task);
    }
    clear() {
      this.storage.delete(MEASUREMENT_META_KEY);
    }
    #raw() {
      const raw = this.storage.get(MEASUREMENT_META_KEY, null);
      return raw && typeof raw === "object" ? raw : {};
    }
  };

  // src-v2/platform/storage.ts
  var TampermonkeyStorage = class {
    static {
      __name(this, "TampermonkeyStorage");
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
      let id;
      try {
        id = GM_addValueChangeListener(key, (_name, _oldValue, value, remote) => listener(value, remote));
      } catch {
        return () => void 0;
      }
      return () => {
        try {
          GM_removeValueChangeListener(id);
        } catch {
        }
      };
    }
    async withLock(name, task) {
      const manager = navigator.locks;
      if (!manager?.request) return await task();
      return await manager.request(`bilicdn.v2.${name}`, async () => await task());
    }
  };

  // src-v2/platform/runtime-ids.ts
  var createRuntimeIds = /* @__PURE__ */ __name((random = (bytes2) => crypto.getRandomValues(bytes2)) => {
    const namespace = /* @__PURE__ */ __name(() => [...random(new Uint8Array(16))].map((byte) => byte.toString(16).padStart(2, "0")).join(""), "namespace");
    let prefix = namespace(), serial = 0;
    return { next(kind) {
      if (serial >= Number.MAX_SAFE_INTEGER) {
        prefix = namespace();
        serial = 0;
      }
      return `${kind[0]}:${prefix}:${(++serial).toString(36)}`;
    } };
  }, "createRuntimeIds");

  // src-v2/state/settings-store.ts
  var SETTINGS_KEY = "bilicdn.v2.settings";
  var defaultSettings = /* @__PURE__ */ __name((now) => Object.freeze({
    schema: 2,
    disabled: false,
    fixedHost: null,
    considerNativeSources: false,
    catalogOverrides: Object.freeze({}),
    codec: "av1",
    blockWebRtc: true,
    blockHttpDns: true,
    verbose: false,
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
    const codec = ["av1", "hevc", "avc", "auto"].includes(String(raw.codec)) ? raw.codec : "av1";
    const fixedHost = typeof raw.fixedHost === "string" && isCatalogHost(raw.fixedHost) ? raw.fixedHost : null;
    return Object.freeze({
      schema: 2,
      disabled: raw.disabled === true,
      fixedHost,
      considerNativeSources: raw.considerNativeSources === true,
      catalogOverrides: Object.freeze(overrides),
      codec,
      blockWebRtc: raw.blockWebRtc !== false,
      blockHttpDns: raw.blockHttpDns !== false,
      verbose: raw.verbose === true,
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
        this.#state = next;
        this.#emit();
      });
    }
    storage;
    now;
    static {
      __name(this, "SettingsStore");
    }
    #state;
    #nativeOffPending = 0;
    #listeners = /* @__PURE__ */ new Set();
    #stopRemote;
    get() {
      return this.#nativeOffPending && this.#state.considerNativeSources ? Object.freeze({ ...this.#state, considerNativeSources: false }) : this.#state;
    }
    subscribe(listener) {
      this.#listeners.add(listener);
      return () => this.#listeners.delete(listener);
    }
    async update(change) {
      const holdNativeOff = change.considerNativeSources === false;
      if (holdNativeOff) {
        this.#nativeOffPending++;
        this.#emit();
      }
      try {
        return await this.storage.withLock("settings", () => {
          const current = parseSettings(this.storage.get(SETTINGS_KEY, null), this.now());
          const now = this.now();
          const next = parseSettings({ ...current, ...change, schema: 2, updatedAt: Math.max(now, current.updatedAt + 1) }, now);
          this.storage.set(SETTINGS_KEY, next);
          this.#state = next;
          this.#emit();
          return next;
        });
      } finally {
        if (holdNativeOff) {
          this.#nativeOffPending--;
          this.#emit();
        }
      }
    }
    async setCatalogEnabled(host, enabled) {
      if (!isCatalogHost(host)) throw new TypeError("Unknown Catalog host");
      return await this.storage.withLock("settings", () => {
        const now = this.now(), current = parseSettings(this.storage.get(SETTINGS_KEY, null), now);
        const next = parseSettings({
          ...current,
          catalogOverrides: { ...current.catalogOverrides, [host]: enabled },
          updatedAt: Math.max(now, current.updatedAt + 1)
        }, now);
        this.storage.set(SETTINGS_KEY, next);
        this.#state = next;
        this.#emit();
        return next;
      });
    }
    async reset() {
      this.#nativeOffPending++;
      this.#emit();
      try {
        const next = await this.storage.withLock("settings", () => {
          const now = this.now(), current = parseSettings(this.storage.get(SETTINGS_KEY, null), now);
          const state = parseSettings({
            ...defaultSettings(now),
            updatedAt: Math.max(now, current.updatedAt + 1)
          }, now);
          this.storage.set(SETTINGS_KEY, state);
          return state;
        });
        this.#state = next;
        this.#emit();
        return next;
      } finally {
        this.#nativeOffPending--;
        this.#emit();
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
      if (!host || !type || !Number.isFinite(expireAt) || expireAt <= now || expireAt > now + 30 * 24 * 60 * 6e4) continue;
      records.push(Object.freeze({
        host,
        type,
        kind,
        reason,
        createdAt: Math.min(now, Math.max(0, Number(row.createdAt) || now)),
        expireAt,
        updatedAt: Math.min(now + 5 * 6e4, Math.max(0, Number(row.updatedAt) || now))
      }));
    }
    return Object.freeze({ schema: 2, records: Object.freeze(records), updatedAt: Number(raw.updatedAt) || now });
  }, "parsePayload");
  var mergePayload = /* @__PURE__ */ __name((a, b, now) => {
    const merged = /* @__PURE__ */ new Map();
    for (const row of [...a.records, ...b.records]) {
      if (row.expireAt <= now) continue;
      const key = `${row.type}:${row.kind}:${row.host}`;
      const old = merged.get(key);
      if (!old || row.updatedAt >= old.updatedAt) merged.set(key, row);
    }
    return Object.freeze({ schema: 2, records: Object.freeze([...merged.values()].slice(-128)), updatedAt: Math.max(a.updatedAt, b.updatedAt, now) });
  }, "mergePayload");
  var RestrictionStore = class {
    constructor(storage, now) {
      this.storage = storage;
      this.now = now;
      this.#payload = parsePayload(storage.get(RESTRICTIONS_KEY, null), now());
      this.#stopRemote = storage.listen(RESTRICTIONS_KEY, (value, remote) => {
        if (!remote) return;
        const incoming = parsePayload(value, this.now());
        if (incoming.updatedAt >= this.#payload.updatedAt) this.#payload = incoming;
      });
    }
    storage;
    now;
    static {
      __name(this, "RestrictionStore");
    }
    #payload;
    #stopRemote;
    has(host, kind, type) {
      const now = this.now();
      return this.#payload.records.some((row) => row.host === host && row.expireAt > now && (row.kind === "all" || row.kind === kind) && (!type || row.type === type));
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
      await this.storage.withLock("restrictions", () => {
        const now = this.now();
        const current = parsePayload(this.storage.get(RESTRICTIONS_KEY, null), now);
        const incoming = parsePayload({ schema: 2, updatedAt: now, records: [{ ...record, createdAt: now, updatedAt: now }] }, now);
        this.#payload = mergePayload(current, incoming, now);
        this.storage.set(RESTRICTIONS_KEY, this.#payload);
      });
    }
    async remove(host, type) {
      await this.storage.withLock("restrictions", () => {
        const now = this.now();
        const current = parsePayload(this.storage.get(RESTRICTIONS_KEY, null), now);
        this.#payload = Object.freeze({
          schema: 2,
          updatedAt: now,
          records: Object.freeze(current.records.filter((row) => row.host !== host || !!type && row.type !== type))
        });
        this.storage.set(RESTRICTIONS_KEY, this.#payload);
      });
    }
    async clear() {
      await this.storage.withLock("restrictions", () => this.storage.delete(RESTRICTIONS_KEY));
      this.#payload = Object.freeze({ schema: 2, records: Object.freeze([]), updatedAt: this.now() });
    }
    dispose() {
      this.#stopRemote();
    }
  };

  // src-v2/domain/evidence.ts
  var EVIDENCE_TTL_MS = 24 * 60 * 60 * 1e3;
  var EVIDENCE_HALF_LIFE_MS = 2 * 60 * 60 * 1e3;
  var MAX_EVIDENCE_SAMPLES = 12;
  var MIN_THROUGHPUT_BYTES = 64 * 1024;
  var PROVEN_FAILURE_QUIET_MS = 30 * 60 * 1e3;
  var CIRCUIT_BACKOFF_MS = Object.freeze([10 * 6e4, 30 * 6e4, 2 * 36e5, 6 * 36e5]);
  var finite = /* @__PURE__ */ __name((value, min, max) => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min, "finite");
  var emptyEvidence = /* @__PURE__ */ __name((host, kind) => ({
    host,
    kind,
    samples: Object.freeze([]),
    circuitLevel: 0,
    circuitUntil: 0,
    updatedAt: 0
  }), "emptyEvidence");
  var pruneSamples = /* @__PURE__ */ __name((samples, now) => Object.freeze(samples.filter((sample) => now - sample.at <= EVIDENCE_TTL_MS).slice(-MAX_EVIDENCE_SAMPLES)), "pruneSamples");
  var addEvidenceSample = /* @__PURE__ */ __name((evidence, sample, now) => {
    const samples = pruneSamples([...evidence.samples, Object.freeze({ ...sample })], now);
    const failed = sample.outcome === "failure";
    const level = failed ? Math.min(CIRCUIT_BACKOFF_MS.length, evidence.circuitLevel + 1) : Math.max(0, evidence.circuitLevel - 1);
    const circuitUntil = failed ? now + (CIRCUIT_BACKOFF_MS[level - 1] ?? CIRCUIT_BACKOFF_MS.at(-1) ?? 0) : evidence.circuitUntil > now ? evidence.circuitUntil : 0;
    return Object.freeze({ ...evidence, samples, circuitLevel: level, circuitUntil, updatedAt: now });
  }, "addEvidenceSample");
  var weightedQuantile = /* @__PURE__ */ __name((rows, quantile) => {
    if (!rows.length) return null;
    const sorted = [...rows].sort((a, b) => a.value - b.value);
    const total = sorted.reduce((sum, row) => sum + row.weight, 0);
    const target = total * quantile;
    let seen = 0;
    for (const row of sorted) {
      seen += row.weight;
      if (seen >= target) return row.value;
    }
    return sorted.at(-1)?.value ?? null;
  }, "weightedQuantile");
  var evidenceMetrics = /* @__PURE__ */ __name((evidence, now) => {
    if (!evidence) return { state: "unknown", safeThroughputMbps: null, medianTtfbMs: null, successCount: 0, failureCount: 0 };
    const samples = pruneSamples(evidence.samples, now);
    const successes = samples.filter((sample) => sample.outcome === "success");
    const failures = samples.filter((sample) => sample.outcome === "failure");
    const throughput = successes.filter((sample) => sample.throughputMbps !== null && sample.throughputMbps > 0);
    let safe = null;
    if (throughput.length === 1) safe = (throughput[0]?.throughputMbps ?? 0) * 0.7;
    else if (throughput.length === 2) safe = Math.min(...throughput.map((sample) => sample.throughputMbps ?? 0));
    else if (throughput.length >= 3) {
      safe = weightedQuantile(throughput.map((sample) => ({
        value: sample.throughputMbps ?? 0,
        weight: Math.pow(0.5, Math.max(0, now - sample.at) / EVIDENCE_HALF_LIFE_MS)
      })), 0.25);
    }
    const ttfb = successes.map((sample) => sample.ttfbMs).filter((value) => value !== null && value >= 0).sort((a, b) => a - b);
    const median = ttfb.length ? ttfb[Math.floor((ttfb.length - 1) / 2)] ?? null : null;
    const recentFailure = failures.some((sample) => now - sample.at < PROVEN_FAILURE_QUIET_MS);
    let state = "unknown";
    if (evidence.circuitUntil > now) state = "circuit-open";
    else if (successes.length >= 2 && !recentFailure) state = "proven";
    else if (successes.length) state = "usable";
    else if (failures.length) state = "degraded";
    return {
      state,
      safeThroughputMbps: safe === null ? null : finite(safe, 0, 1e5),
      medianTtfbMs: median,
      successCount: successes.length,
      failureCount: failures.length
    };
  }, "evidenceMetrics");

  // src-v2/state/evidence-store.ts
  var EVIDENCE_KEY = "bilicdn.v2.routeEvidence";
  var MAX_VIDEO_HOSTS = 64;
  var MAX_AUDIO_HOSTS = 32;
  var recordKey = /* @__PURE__ */ __name((host, kind) => `${kind}:${host}`, "recordKey");
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
      for (const rawSample of (Array.isArray(row.samples) ? row.samples : []).slice(-MAX_EVIDENCE_SAMPLES)) {
        if (!rawSample || typeof rawSample !== "object") continue;
        const sample = rawSample, at = Number(sample.at);
        if (!Number.isFinite(at) || at > now + 5 * 6e4 || now - at > EVIDENCE_TTL_MS) continue;
        const outcome = sample.outcome === "failure" ? "failure" : sample.outcome === "success" ? "success" : null;
        if (!outcome) continue;
        samples.push(Object.freeze({
          requestId: String(sample.requestId ?? "").slice(0, 64),
          at,
          source: sample.source === "challenge" ? "challenge" : "transport",
          outcome,
          throughputMbps: Number.isFinite(sample.throughputMbps) ? Math.min(1e5, Math.max(0, Number(sample.throughputMbps))) : null,
          ttfbMs: Number.isFinite(sample.ttfbMs) ? Math.min(12e4, Math.max(0, Number(sample.ttfbMs))) : null,
          failureKind: ["network", "body", "timeout", "http-5xx", "native-invalid"].includes(String(sample.failureKind)) ? sample.failureKind : null
        }));
      }
      const updatedAt = Math.min(now + 5 * 6e4, Math.max(0, Number(row.updatedAt) || 0));
      const expiredHistory = !samples.length && now - updatedAt > EVIDENCE_TTL_MS;
      const evidence = Object.freeze({
        host,
        kind,
        samples: Object.freeze(samples),
        circuitLevel: expiredHistory ? 0 : Math.max(0, Math.min(4, Number(row.circuitLevel) || 0)),
        circuitUntil: expiredHistory ? 0 : Math.min(now + 7 * 24 * 60 * 6e4, Math.max(0, Number(row.circuitUntil) || 0)),
        updatedAt
      });
      records[recordKey(host, kind)] = evidence;
    }
    return Object.freeze({ schema: 2, records: Object.freeze(records), updatedAt: Number(raw.updatedAt) || now });
  }, "parsePayload");
  var mergeEvidence = /* @__PURE__ */ __name((a, b, now) => {
    if (!a && !b) return null;
    const base = a ?? b;
    if (!base) return null;
    const samples = /* @__PURE__ */ new Map();
    for (const sample of [...a?.samples ?? [], ...b?.samples ?? []]) {
      const key = sample.requestId || `${sample.at}:${sample.source}:${sample.outcome}`;
      const old = samples.get(key);
      if (!old || sample.at >= old.at) samples.set(key, sample);
    }
    const newer = !a ? b : !b ? a : b.updatedAt >= a.updatedAt ? b : a;
    return Object.freeze({
      host: base.host,
      kind: base.kind,
      samples: pruneSamples([...samples.values()].sort((x, y) => x.at - y.at), now),
      circuitLevel: newer?.circuitLevel ?? 0,
      circuitUntil: newer?.circuitUntil ?? 0,
      updatedAt: Math.max(a?.updatedAt ?? 0, b?.updatedAt ?? 0)
    });
  }, "mergeEvidence");
  var mergePayload2 = /* @__PURE__ */ __name((a, b, now) => {
    const records = {};
    for (const key of /* @__PURE__ */ new Set([...Object.keys(a.records), ...Object.keys(b.records)])) {
      const merged = mergeEvidence(a.records[key], b.records[key], now);
      if (merged) records[key] = merged;
    }
    for (const kind of ["video", "audio"]) {
      const max = kind === "video" ? MAX_VIDEO_HOSTS : MAX_AUDIO_HOSTS;
      const rows = Object.entries(records).filter(([, row]) => row.kind === kind).sort((x, y) => y[1].updatedAt - x[1].updatedAt);
      for (const [key] of rows.slice(max)) delete records[key];
    }
    return Object.freeze({ schema: 2, records: Object.freeze(records), updatedAt: Math.max(a.updatedAt, b.updatedAt, now) });
  }, "mergePayload");
  var EvidenceStore = class {
    constructor(storage, now) {
      this.storage = storage;
      this.now = now;
      this.#payload = parsePayload2(storage.get(EVIDENCE_KEY, null), now());
      this.#stopRemote = storage.listen(EVIDENCE_KEY, (value, remote) => {
        if (!remote) return;
        const incoming = parsePayload2(value, this.now());
        if (incoming.updatedAt >= this.#payload.updatedAt) this.#payload = incoming;
      });
    }
    storage;
    now;
    static {
      __name(this, "EvidenceStore");
    }
    #payload;
    #stopRemote;
    get(host, kind) {
      return this.#payload.records[recordKey(host, kind)] ?? null;
    }
    list(kind) {
      return Object.freeze(Object.values(this.#payload.records).filter((row) => !kind || row.kind === kind));
    }
    async record(host, kind, sample, valid = () => true) {
      return await this.storage.withLock("routeEvidence", () => {
        if (!valid()) return this.get(host, kind) ?? emptyEvidence(host, kind);
        const now = this.now(), latest = parsePayload2(this.storage.get(EVIDENCE_KEY, null), now);
        const key = recordKey(host, kind), prior = latest.records[key] ?? emptyEvidence(host, kind);
        const updated = addEvidenceSample(prior, sample, now);
        const incoming = { schema: 2, records: { [key]: updated }, updatedAt: now };
        this.#payload = mergePayload2(latest, incoming, now);
        this.storage.set(EVIDENCE_KEY, this.#payload);
        return this.#payload.records[key] ?? updated;
      });
    }
    async clear() {
      await this.storage.withLock("routeEvidence", () => this.storage.delete(EVIDENCE_KEY));
      this.#payload = Object.freeze({ schema: 2, records: Object.freeze({}), updatedAt: this.now() });
    }
    dispose() {
      this.#stopRemote();
    }
  };

  // src-v2/domain/model.ts
  var generationId = /* @__PURE__ */ __name((value) => value, "generationId");
  var epochId = /* @__PURE__ */ __name((value) => value, "epochId");
  var representationId = /* @__PURE__ */ __name((value) => value, "representationId");
  var decisionId = /* @__PURE__ */ __name((value) => value, "decisionId");
  var requestId = /* @__PURE__ */ __name((value) => value, "requestId");
  var recoveryActionId = /* @__PURE__ */ __name((value) => value, "recoveryActionId");
  var signedRouteHandle = /* @__PURE__ */ __name((value) => value, "signedRouteHandle");

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
    noteDecision(id) {
      this.#state = Object.freeze({ ...this.#state, lastDecisionId: id });
    }
  };

  // src-v2/state/signed-route-vault.ts
  var MAX_VIDEO_GROUPS = 128;
  var MAX_AUDIO_GROUPS = 64;
  var MAX_URLS_PER_GROUP = 4;
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
    register(input) {
      if (input.generation !== this.#generation || input.epoch !== this.#epoch) return null;
      const key = `${input.kind}:${input.key}:${input.codec}:${input.height}`;
      const priorId = this.#byKey.get(key), prior = priorId ? this.#groups.get(priorId) : void 0;
      if (prior?.source === "trusted-api" && input.source !== "trusted-api") return priorId ?? null;
      const sharedExact = /* @__PURE__ */ new Set();
      for (const raw of [...new Set(input.urls)].slice(0, MAX_URLS_PER_GROUP)) {
        const parsed = parseMediaUrl(raw);
        if (!parsed || parsed.kind !== "normal" && parsed.kind !== "unknown" && !catalogSource(raw)) continue;
        for (const rep2 of this.#byUrl.get(parsed.url.href) ?? []) {
          if (this.#groups.get(rep2)?.identity.kind === input.kind) sharedExact.add(rep2);
        }
      }
      if (input.source !== "trusted-api") {
        const authoritative = [...sharedExact].filter((rep2) => this.#groups.get(rep2)?.source === "trusted-api");
        if (authoritative.length) return authoritative.length === 1 ? authoritative[0] ?? null : null;
      } else {
        for (const rep2 of sharedExact) {
          if (rep2 === priorId || this.#groups.get(rep2)?.source === "trusted-api") continue;
          this.#dropGroup(rep2);
        }
      }
      const admitted = [...new Set([...new Set(input.urls)].slice(0, MAX_URLS_PER_GROUP).map((raw) => parseMediaUrl(raw)).filter((parsed) => parsed && (parsed.kind === "normal" || parsed.kind === "unknown" && parsed.url.protocol === "https:" && !parsed.url.port || parsed.kind === "pcdn" && catalogSource(parsed.url.href))).map((parsed) => parsed.url.href))];
      const refreshed = !!prior && input.source === "trusted-api" && prior.source === "trusted-api" && input.refreshTrustedSources === true && (admitted.length !== prior.routes.length || admitted.some((url, index) => url !== prior.routes[index]?.url));
      const promoted = !!prior && input.source === "trusted-api" && prior.source !== "trusted-api";
      const replaced = promoted || refreshed;
      const cap = input.kind === "video" ? MAX_VIDEO_GROUPS : MAX_AUDIO_GROUPS;
      if (!prior && [...this.#groups.values()].filter((group) => group.identity.kind === input.kind).length >= cap) return null;
      const rep = priorId ?? representationId(`${input.kind}:group-${++this.#serial}`);
      if (replaced && priorId && prior) {
        this.#revokeGroupRoutes(priorId, prior);
        this.#invalid.delete(priorId);
      }
      const routes = replaced ? [] : [...prior?.routes ?? []];
      for (const raw of [...new Set(input.urls)].slice(0, MAX_URLS_PER_GROUP)) {
        const parsed = parseMediaUrl(raw);
        const opaque = parsed?.kind === "unknown" && parsed.url.protocol === "https:" && !parsed.url.port;
        const pcdnCatalogSource = parsed?.kind === "pcdn" && catalogSource(raw);
        if (!parsed || parsed.kind !== "normal" && !opaque && !pcdnCatalogSource || this.#urlChars + raw.length > MAX_URL_CHARS) continue;
        if (routes.some((route) => route.url === parsed.url.href)) continue;
        if (routes.length >= MAX_URLS_PER_GROUP) {
          this.registerAlias(rep, parsed.url.href);
          continue;
        }
        const handle = signedRouteHandle(`route:${rep}:${++this.#handleSerial}`);
        routes.push(Object.freeze({
          handle,
          host: parsed.host,
          url: parsed.url.href,
          order: routes.length,
          activelyExplorable: !opaque && !pcdnCatalogSource && isKnownNativeFamily(parsed.host),
          selectable: !opaque && !pcdnCatalogSource
        }));
        this.#handles.set(handle, { representation: rep, url: parsed.url.href });
        this.#index(this.#byUrl, parsed.url.href, rep);
        if (!opaque && !pcdnCatalogSource) this.#index(this.#byPath, parsed.url.pathname, rep);
        this.#urlChars += parsed.url.href.length;
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
      this.#groups.set(rep, Object.freeze({
        identity,
        height: input.height,
        codec: input.codec.slice(0, 48),
        bandwidth: input.bandwidth,
        source: prior?.source === "trusted-api" ? prior.source : input.source,
        routes: Object.freeze(routes)
      }));
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
      if (!parsed || parsed.kind !== "normal" && parsed.kind !== "unknown" && parsed.kind !== "pcdn") return { context: null, status: "waiting-data", source: "none" };
      for (const [index, source] of [[this.#byUrl, "exact"], [this.#aliases, "catalog-alias"], [this.#byPath, "path-hint"]]) {
        if ((parsed.kind === "unknown" || parsed.kind === "pcdn") && source !== "exact") continue;
        const reps = index.get(source === "path-hint" ? parsed.url.pathname : parsed.url.href);
        if (!reps?.size) continue;
        if (reps.size !== 1) return { context: null, status: "ambiguous", source };
        const rep = [...reps][0], context = rep ? this.#groups.get(rep)?.identity ?? null : null;
        return { context, status: source === "path-hint" || parsed.kind === "unknown" ? "weak" : "matched", source };
      }
      return { context: null, status: "waiting-data", source: "none" };
    }
    registerAlias(rep, url) {
      const parsed = parseMediaUrl(url);
      if (!parsed || parsed.kind !== "normal" || this.#aliases.size >= 1024 || this.#urlChars + url.length > MAX_URL_CHARS) return;
      if (!this.#aliases.has(parsed.url.href)) this.#urlChars += parsed.url.href.length;
      this.#index(this.#aliases, parsed.url.href, rep);
      this.#index(this.#byPath, parsed.url.pathname, rep);
    }
    registerOutput(rep, original, primary, backups, decisionId2, source, catalogGenerated = false) {
      const originalHost = parseMediaUrl(original)?.host ?? "";
      for (const [index, url] of [primary, ...backups].entries()) {
        const parsed = parseMediaUrl(url);
        if (!parsed || this.#outputs.size >= 1152 || this.#urlChars + url.length > MAX_URL_CHARS) continue;
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
      const native = group.routes.filter((route) => route.selectable && !invalid.has(route.host) && (route.activelyExplorable || unlockedHosts.has(route.host))).map((route) => Object.freeze({
        type: "native-signed",
        host: route.host,
        kind: group.identity.kind,
        catalogIndex: catalogIndex(route.host),
        route: group.identity,
        handle: route.handle,
        activelyExplorable: route.activelyExplorable
      }));
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
      return Object.freeze((this.#groups.get(representation)?.routes ?? []).map((route) => route.host));
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
    groupSummary(representation) {
      const group = this.#groups.get(representation);
      return group ? Object.freeze({ kind: group.identity.kind, height: group.height, codec: group.codec, bandwidth: group.bandwidth, routeCount: group.routes.length }) : null;
    }
  };

  // src-v2/domain/route-policy.ts
  var catalogRestrictions = /* @__PURE__ */ __name((overrides) => ({
    disabledCatalogHosts: new Set(TRUSTED_CATALOG.filter((host) => overrides[host] === false)),
    defaultUnavailableHosts: new Set(TRUSTED_CATALOG.filter((host) => DEFAULT_UNAVAILABLE_HOSTS.has(host) && overrides[host] !== true))
  }), "catalogRestrictions");
  var catalogCandidates = /* @__PURE__ */ __name((kind, excluded = /* @__PURE__ */ new Set()) => TRUSTED_CATALOG.map((host, catalogIndex2) => ({ type: "catalog-generated", host, kind, catalogIndex: catalogIndex2 })).filter((candidate) => !excluded.has(candidate.host)), "catalogCandidates");
  function hardRestriction(host, input, now) {
    if (input.blackHosts.has(host)) return "black";
    if (input.deadHosts.has(host)) return "dead";
    if (input.overrides[host] === false) return "catalog-disabled";
    if (DEFAULT_UNAVAILABLE_HOSTS.has(host) && input.overrides[host] !== true) return "default-unavailable";
    return input.circuitUntil > now ? "circuit-open" : null;
  }
  __name(hardRestriction, "hardRestriction");

  // src-v2/domain/player-output-plan.ts
  function originalOutputPlan(candidates) {
    const allowed = candidates.filter((candidate) => candidate.allowed);
    return { primary: allowed[0]?.index ?? null, backups: allowed.slice(1, 6).map((candidate) => candidate.index) };
  }
  __name(originalOutputPlan, "originalOutputPlan");
  function backupOutputPlan(primaryHost, candidates, locked) {
    if (locked) return [];
    const used = new Set(primaryHost ? [primaryHost] : []), distinct = [], same = [];
    for (const candidate of candidates) {
      if (!candidate.allowed || !candidate.host) continue;
      if (used.has(candidate.host)) same.push(candidate.index);
      else {
        used.add(candidate.host);
        distinct.push(candidate.index);
      }
    }
    return [...distinct, ...same].slice(0, 5);
  }
  __name(backupOutputPlan, "backupOutputPlan");
  function catalogOutputPlan(primaryHost, preferred, unavailable) {
    return [.../* @__PURE__ */ new Set([...preferred, ...TRUSTED_CATALOG])].filter((host) => isCatalogHost(host) && host !== primaryHost && !unavailable.has(host)).slice(0, 5);
  }
  __name(catalogOutputPlan, "catalogOutputPlan");

  // src-v2/domain/routing.ts
  var restrictionReasons = /* @__PURE__ */ __name((candidate, input, now) => {
    const reasons = [];
    const host = candidate.host;
    if (input.restrictions.disabledCatalogHosts.has(host)) reasons.push("catalog-disabled");
    if (input.restrictions.defaultUnavailableHosts.has(host)) reasons.push("default-unavailable");
    if (input.restrictions.blackHosts.has(host)) reasons.push("black");
    if (input.restrictions.deadHosts.has(host)) reasons.push("dead");
    if (input.restrictions.hostLocked.has(host)) reasons.push("host-lock");
    if (input.failedHost === host && (input.boundary === "verified-failure" || input.boundary === "watchdog")) reasons.push("circuit-open");
    const evidence = input.evidenceFor(host, candidate.kind);
    if (evidence && evidence.circuitUntil > now) reasons.push("circuit-open");
    return [...new Set(reasons)];
  }, "restrictionReasons");
  var stateRank = /* @__PURE__ */ __name((state) => ({
    proven: 5,
    usable: 4,
    unknown: 3,
    degraded: 2,
    "circuit-open": 1,
    forbidden: 0
  })[state], "stateRank");
  var assessDemandRatio = /* @__PURE__ */ __name((ratio) => ratio === null || !Number.isFinite(ratio) ? "unknown" : ratio < 1 ? "below-required" : ratio < 1.35 ? "below-headroom" : "meets-headroom", "assessDemandRatio");
  var rankRoutes = /* @__PURE__ */ __name((input, now) => {
    const entries = input.candidates.map((candidate) => {
      const reasons = restrictionReasons(candidate, input, now);
      const metrics = evidenceMetrics(input.evidenceFor(candidate.host, candidate.kind), now);
      const state = reasons.length ? "forbidden" : metrics.state;
      return Object.freeze({
        candidate,
        state,
        eligible: reasons.length === 0,
        reasons: Object.freeze(reasons),
        safeThroughputMbps: metrics.safeThroughputMbps,
        demandRatio: metrics.safeThroughputMbps === null ? null : metrics.safeThroughputMbps / Math.max(1e-3, input.demand.requiredMbps),
        medianTtfbMs: metrics.medianTtfbMs,
        successCount: metrics.successCount,
        failureCount: metrics.failureCount
      });
    });
    return Object.freeze(entries.sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      const fixedA = input.fixedHost === a.candidate.host;
      const fixedB = input.fixedHost === b.candidate.host;
      if (fixedA !== fixedB) return fixedA ? -1 : 1;
      const sufficientA = (a.demandRatio ?? 0) >= 1.35;
      const sufficientB = (b.demandRatio ?? 0) >= 1.35;
      if (sufficientA !== sufficientB) return sufficientA ? -1 : 1;
      if ((a.demandRatio ?? -1) !== (b.demandRatio ?? -1)) return (b.demandRatio ?? -1) - (a.demandRatio ?? -1);
      if (stateRank(a.state) !== stateRank(b.state)) return stateRank(b.state) - stateRank(a.state);
      if ((a.medianTtfbMs ?? Number.MAX_SAFE_INTEGER) !== (b.medianTtfbMs ?? Number.MAX_SAFE_INTEGER)) {
        return (a.medianTtfbMs ?? Number.MAX_SAFE_INTEGER) - (b.medianTtfbMs ?? Number.MAX_SAFE_INTEGER);
      }
      return a.candidate.catalogIndex - b.candidate.catalogIndex;
    }));
  }, "rankRoutes");
  var chooseRoute = /* @__PURE__ */ __name((input, clock, id) => {
    const ranking = rankRoutes(input, clock.now());
    const fixed = input.fixedHost ? ranking.find((row) => row.eligible && row.candidate.host === input.fixedHost) : null;
    const current = input.current && ranking.find((row) => row.eligible && row.candidate.host === input.current?.host);
    const healthyBoundary = input.boundary !== "verified-failure" && input.boundary !== "watchdog" && input.boundary !== "user-setting";
    if (!fixed && current && healthyBoundary && input.boundary !== "new-epoch") {
      const candidate = current.candidate;
      if (candidate.type === "root-original") return { action: "pass", id, reason: "healthy-affinity", routeType: "root-original", host: candidate.host, ranking };
      return { action: "rewrite", id, reason: "healthy-affinity", routeType: candidate.type, host: candidate.host, candidate, ranking };
    }
    const original = ranking.find((row) => row.eligible && row.candidate.type === "root-original");
    if (!fixed && input.boundary === "startup" && original) {
      return { action: "pass", id, reason: "startup-original-pending-preflight", routeType: "root-original", host: original.candidate.host, ranking };
    }
    const selected = fixed ?? ranking.find((row) => row.eligible && row.candidate.type !== "root-original" && (row.state === "proven" && (row.demandRatio ?? 0) >= 1.35)) ?? ranking.find((row) => row.eligible && row.candidate.type !== "root-original" && row.successCount > 0 && (row.demandRatio ?? 0) >= 1.35) ?? original ?? ranking.find((row) => row.eligible && row.candidate.type === "catalog-generated");
    if (!selected) {
      const first = ranking[0];
      return { action: "block", id, reason: first?.reasons[0] ?? "invalid-url", routeType: first?.candidate.type ?? "root-original", host: first?.candidate.host ?? null, ranking };
    }
    if (selected.candidate.type === "root-original") {
      return { action: "pass", id, reason: "root-fallback", routeType: "root-original", host: selected.candidate.host, ranking };
    }
    return {
      action: "rewrite",
      id,
      reason: fixed ? "fixed" : selected.state === "proven" ? "proven" : selected.successCount ? "recent-success" : "catalog-default",
      routeType: selected.candidate.type,
      host: selected.candidate.host,
      candidate: selected.candidate,
      ranking
    };
  }, "chooseRoute");

  // src-v2/application/route-coordinator.ts
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
    #policyRevision = 0;
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
    #tentativeRepresentation = null;
    #tentativeTransfers = 0;
    #streamPlans = /* @__PURE__ */ new Map();
    #latest = /* @__PURE__ */ new Map();
    #lastSuccess = /* @__PURE__ */ new Map();
    #requested = /* @__PURE__ */ new Map();
    #effectiveRate = 2;
    #challengeAttempts = /* @__PURE__ */ new Map();
    #firstMediaAt = 0;
    #pendingMedia = /* @__PURE__ */ new Set();
    #fallbacks = /* @__PURE__ */ new Map();
    #originalComparison = false;
    subscribe(listener) {
      this.#listeners.add(listener);
      return () => this.#listeners.delete(listener);
    }
    resetEpoch() {
      this.#policyRevision++;
      this.#plans.clear();
      this.#planIdentities.clear();
      this.#unlockedNative.clear();
      this.#decisions.clear();
      this.#hostLockedStreams.clear();
      this.#startupIncompatible.clear();
      this.#requestedRepresentations.clear();
      this.#tentativeRepresentation = null;
      this.#tentativeTransfers = 0;
      this.#streamPlans.clear();
      this.#latest.clear();
      this.#lastSuccess.clear();
      this.#requested.clear();
      this.#effectiveRate = 2;
      this.#challengeAttempts.clear();
      this.#firstMediaAt = 0;
      this.#pendingMedia.clear();
      this.#fallbacks.clear();
    }
    invalidateForUserSetting() {
      this.#policyRevision++;
      this.#plans.clear();
      this.#planIdentities.clear();
      this.#streamPlans.clear();
      this.#fallbacks.clear();
      this.session.setAffinity(null);
    }
    isOriginalComparison() {
      return this.#originalComparison;
    }
    policyRevision() {
      return this.#policyRevision;
    }
    isCatalogOnly() {
      return !this.#originalComparison && !this.settings.get().considerNativeSources;
    }
    setOriginalComparison(enabled) {
      if (this.#originalComparison === enabled) return;
      this.#originalComparison = enabled;
      this.#fallbacks.clear();
      this.invalidateForUserSetting();
    }
    requestStarted(request) {
      if (request.kind && !this.#firstMediaAt) this.#firstMediaAt = request.startedAt;
      if (request.kind) this.#pendingMedia.add(request.requestId);
      const key = request.kind ?? "unknown";
      this.#requested.set(key, request);
      if (request.kind && request.representation) {
        const fallback = this.#fallbacks.get(request.kind);
        if (fallback?.representation === request.representation && fallback.decisionId === request.decisionId && fallback.plannedHost === request.targetHost && fallback.stage === "planned" && request.generation === this.session.get().generation && request.epoch === this.session.get().epoch) {
          this.#fallbacks.set(request.kind, { ...fallback, stage: "entered-hook", requestId: request.requestId });
        }
      }
      this.#emit({ type: "request-started", at: request.startedAt, request });
      this.#emit({ type: "attribution-changed", at: request.startedAt, requestId: request.requestId, status: request.attributionStatus, kind: request.kind });
    }
    observePlaybackRate(rate) {
      this.#effectiveRate = Number.isFinite(rate) && rate > 0 ? rate : 2;
    }
    playbackRate() {
      return this.#effectiveRate;
    }
    firstMediaAt() {
      return this.#firstMediaAt;
    }
    pendingMediaCount() {
      return this.#pendingMedia.size;
    }
    latestRequested(kind) {
      return this.#requested.get(kind) ?? null;
    }
    recoveryEligible(request) {
      const state = this.session.get(), settings = this.settings.get();
      if (settings.disabled || this.#originalComparison || request.routePolicyRevision !== this.#policyRevision || request.generation !== state.generation || request.epoch !== state.epoch || !request.representation) return false;
      const identity = this.vault.identity(request.representation), decision = this.#plans.get(request.representation);
      return !!identity && identity.kind === "video" && identity.authorityRevision === request.authorityRevision && this.vault.isCurrentIdentity(identity) && !!decision && this.#planIdentities.get(request.representation) === identity && (!settings.fixedHost || decision.host === settings.fixedHost) && this.#decisionAllowed(decision, identity, "video");
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
      if (source === "exact" || source === "catalog-alias" || this.vault.wasPlayerOutput(url)) return true;
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
      const parsed = parseMediaUrl(url), match = this.vault.match(url);
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
      if (!parsed) return { decision: this.#pass("invalid-url", null, "video"), url, context: null, streamKey: null, sourceHost: null };
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
    startupOptions(url, catalogCursor = 0) {
      const parsed = parseMediaUrl(url), match = this.vault.match(url);
      const context = match.status === "matched" || match.source === "exact" ? match.context : null;
      const source = context && this.isCatalogOnly() ? this.#catalogSource(context, url) : url;
      const parsedSource = source ? parseMediaUrl(source) : null;
      if (!parsed || !source || !parsedSource || !parsedSource.replaceable || !this.isCatalogOnly() && parsedSource.kind !== "normal" || !context || this.settings.get().fixedHost || this.#originalComparison || this.session.get().disabled) return null;
      const bandwidth = this.vault.groupSummary(context.representation)?.bandwidth ?? 0;
      const requiredMbps = Math.max(
        context.kind === "audio" ? 0.5 : 2,
        (bandwidth || (context.kind === "audio" ? 192e3 : 4e6)) / 1e6 * this.#effectiveRate * 1.25
      );
      const candidates = [];
      const add = /* @__PURE__ */ __name((host, type, candidateUrl, original) => {
        if (candidates.length >= 3 || candidates.some((candidate2) => candidate2.host === host) || this.#hardRestriction(host, context.kind) || this.vault.isInvalid(context.representation, host)) return;
        const checked = parseMediaUrl(candidateUrl);
        if (!checked || checked.kind !== "normal" || checked.host !== host) return;
        const key = mediaIdentity(candidateUrl);
        if (key && this.#startupIncompatible.get(key)?.has(host)) return;
        const evidence = this.evidence.get(host, context.kind);
        const cachedSafeMbps = type === "catalog-generated" && evidence && this.clock.now() - evidence.updatedAt <= 5 * 6e4 ? evidenceMetrics(evidence, this.clock.now()).safeThroughputMbps : null;
        const candidate = { host, type, url: candidateUrl, original, cachedSafeMbps, context };
        this.#measurementId(candidate, "startup");
        candidates.push(candidate);
      }, "add");
      if (!this.isCatalogOnly()) {
        add(parsed.host, "root-original", parsed.url.href, true);
        const native = this.vault.candidates(context.representation, this.#unlockedNative.get(context.representation) ?? /* @__PURE__ */ new Set()).native;
        for (const route of native) {
          const exact = this.vault.resolve(route.handle, context);
          if (exact && route.host !== parsed.host) {
            add(route.host, "native-signed", exact, false);
            break;
          }
        }
      }
      const catalog = TRUSTED_CATALOG.filter((host) => !this.#hardRestriction(host, context.kind));
      for (let offset = 0; offset < catalog.length && candidates.length < 3; offset++) {
        const host = catalog[(catalogCursor + offset) % catalog.length];
        if (!host) continue;
        const generated = replaceUrlHost(source, host);
        if (generated) add(host, "catalog-generated", generated, false);
      }
      return { candidates, demand: { kind: context.kind, requiredMbps, highDemand: requiredMbps >= 12 }, originalHost: parsedSource.host };
    }
    noteStartupProbeResult(candidate, status) {
      if (status !== 403 || candidate.type !== "catalog-generated") return;
      const context = candidate.context, current = this.session.get();
      if (context.generation !== current.generation || context.epoch !== current.epoch || !this.vault.isCurrentIdentity(context)) return;
      this.#markIncompatible(candidate.url, candidate.host);
    }
    commitStartupChoice(url, selected, reason) {
      if (!selected || this.session.get().disabled || this.#originalComparison) return null;
      if (this.isCatalogOnly() && selected.type !== "catalog-generated") return null;
      const fixedHost = this.settings.get().fixedHost;
      if (fixedHost && (selected.type !== "catalog-generated" || selected.host !== fixedHost)) return null;
      const match = this.vault.match(url);
      const context = match.status === "matched" || match.source === "exact" ? match.context : null;
      if (!context || context !== selected.context || this.#hardRestriction(selected.host, context.kind) || this.vault.isInvalid(context.representation, selected.host) || this.#startupIncompatible.get(mediaIdentity(selected.url) ?? "")?.has(selected.host)) return null;
      const source = this.isCatalogOnly() ? this.#catalogSource(context, url) : url;
      if (!source) return null;
      let decision;
      if (selected.original) decision = this.#pass(reason, selected.host, context.kind);
      else if (selected.type === "catalog-generated") {
        const catalogIndex2 = TRUSTED_CATALOG.indexOf(selected.host);
        if (catalogIndex2 < 0 || replaceUrlHost(source, selected.host) !== selected.url || parseMediaUrl(selected.url)?.kind !== "normal") return null;
        const candidate = { type: "catalog-generated", host: selected.host, kind: context.kind, catalogIndex: catalogIndex2 };
        decision = { action: "rewrite", id: this.#nextId(), reason, routeType: "catalog-generated", host: selected.host, candidate, ranking: [] };
      } else {
        const native = this.vault.candidates(context.representation, this.#unlockedNative.get(context.representation) ?? /* @__PURE__ */ new Set()).native.find((candidate) => candidate.host === selected.host && this.vault.resolve(candidate.handle, context) === selected.url);
        if (!native) return null;
        decision = { action: "rewrite", id: this.#nextId(), reason, routeType: "native-signed", host: selected.host, candidate: native, ranking: [] };
      }
      this.#savePlan(context.representation, decision);
      this.session.noteDecision(decision.id);
      this.#remember(decision, context, context.kind);
      this.#emit({ type: "route-planned", at: this.clock.now(), decision });
      return decision;
    }
    async recordStartupSuccess(candidate, bytes2, elapsedMs, ttfbMs) {
      if (bytes2 < 64 * 1024 || elapsedMs <= 0) return;
      if (this.isCatalogOnly() && candidate.type !== "catalog-generated") return;
      const context = candidate.context;
      const valid = /* @__PURE__ */ __name(() => context.generation === this.session.get().generation && context.epoch === this.session.get().epoch && !this.session.get().disabled && this.vault.isCurrentIdentity(context) && (!this.isCatalogOnly() || candidate.type === "catalog-generated"), "valid");
      if (!valid()) return;
      await this.evidence.record(candidate.host, context.kind, {
        requestId: this.#measurementId(candidate, "startup"),
        at: this.clock.now(),
        source: "challenge",
        outcome: "success",
        throughputMbps: bytes2 * 8 / elapsedMs / 1e3,
        ttfbMs,
        failureKind: null
      }, valid);
    }
    latestVideoHost() {
      const row = this.#lastSuccess.get("video");
      return row?.outcome === "success" && row.attributionStatus === "matched" && this.clock.now() - Number(row.observedAt) <= 6e4 && typeof row.responseHost === "string" ? row.responseHost : null;
    }
    unlockNative(representation, host) {
      const hosts = this.#unlockedNative.get(representation) ?? /* @__PURE__ */ new Set();
      hosts.add(host);
      this.#unlockedNative.set(representation, hosts);
    }
    plan(representation, demand, boundary, failedHost = null) {
      const context = this.vault.identity(representation);
      if (!context) return this.#pass("missing-representation", null, demand.kind);
      if (this.#originalComparison) {
        const host = parseMediaUrl(this.vault.rootUrl(representation) ?? "")?.host ?? null;
        const restriction = host ? this.#hardRestriction(host, context.kind) : null;
        const original = restriction && host ? this.#block(restriction, host) : this.#pass("original-observe-only", host, context.kind);
        this.#savePlan(representation, original);
        this.#remember(original, context, context.kind);
        this.#emit({ type: "route-planned", at: this.clock.now(), decision: original });
        return original;
      }
      const previous = this.#currentPlan(representation);
      if (previous && !["verified-failure", "watchdog", "user-setting"].includes(boundary) && this.#decisionAllowed(previous, context, demand.kind)) return previous;
      const decision = this.#choose(context, demand, boundary, failedHost);
      this.#savePlan(representation, decision);
      return decision;
    }
    recover(representation, demand, boundary, failedHost) {
      const decision = this.plan(representation, demand, boundary, failedHost);
      if (decision.action !== "block" && decision.host && decision.host !== failedHost)
        this.#trackFallback(representation, demand.kind, decision);
      else {
        this.#fallbacks.delete(demand.kind);
        this.#emit({ type: "recovery", at: this.clock.now(), action: {
          action: "none",
          id: recoveryActionId(`recovery-${++this.#recoverySerial}`),
          reason: "no-legal-different-route"
        } });
      }
      return decision;
    }
    recoverStartup(representation, demand, failedHost, preferredHosts) {
      if (this.#originalComparison) return null;
      const context = this.vault.identity(representation);
      const root = context && this.isCatalogOnly() ? this.#catalogSource(context) : this.vault.rootUrl(representation);
      if (!root || !failedHost || demand.kind !== "video") return null;
      const options = this.startupOptions(root);
      if (!options) return null;
      const alternatives = options.candidates.filter((candidate) => candidate.host !== failedHost);
      const locked = mediaIdentity(root) && this.#hostLockedStreams.has(mediaIdentity(root));
      const preferred = preferredHosts.map((host) => alternatives.find((candidate) => candidate.host === host)).find((candidate) => candidate !== void 0);
      const selected = locked ? alternatives.find((candidate) => candidate.original) ?? preferred ?? alternatives[0] : preferred ?? alternatives[0];
      if (!selected) return null;
      const decision = this.commitStartupChoice(root, selected, "startup-stall-fallback");
      if (decision && decision.host !== failedHost) this.#trackFallback(representation, "video", decision);
      return decision && decision.host !== failedHost ? decision : null;
    }
    apply(url, kindHint = null, demand, trustedPlayurl = false) {
      const parsed = parseMediaUrl(url);
      if (!parsed && this.isCatalogOnly() && (trustedPlayurl || this.isBilibiliMedia(url))) {
        return {
          decision: this.#block("catalog-unreplaceable", null),
          url: null,
          context: null,
          streamKey: null,
          sourceHost: null
        };
      }
      if (!parsed) return { decision: this.#pass("invalid-url", null, kindHint ?? "video"), url, context: null, streamKey: null, sourceHost: null };
      if (this.#originalComparison) {
        const inspected = this.inspectOriginal(url);
        const decision2 = inspected.decision.action === "pass" ? this.#pass("original-observe-only", parsed.host, inspected.context?.kind ?? kindHint ?? "video") : inspected.decision;
        const outputRole2 = inspected.context ? this.vault.outputRole(inspected.context.representation, url) : null;
        this.#remember(decision2, inspected.context, inspected.context?.kind ?? kindHint ?? "video");
        return {
          ...inspected,
          decision: decision2,
          playurlHostChanged: outputRole2?.hostChanged ?? false,
          ...outputRole2 ? { playurlOutput: outputRole2 } : {}
        };
      }
      if (this.isCatalogOnly() && (trustedPlayurl || this.isBilibiliMedia(url))) {
        return this.#applyCatalogOnly(url, parsed, kindHint, demand);
      }
      const streamKey = mediaIdentity(url);
      if (parsed.kind === "unknown") {
        const match2 = this.vault.match(url), context2 = match2.source === "exact" ? match2.context : null;
        const restriction = this.#hardRestriction(parsed.host, context2?.kind ?? kindHint);
        const decision2 = restriction ? this.#block(restriction, parsed.host) : this.#pass("opaque-media-observation-only", parsed.host, context2?.kind ?? kindHint ?? "video");
        const outputRole2 = context2 ? this.vault.outputRole(context2.representation, url) : null;
        return {
          decision: decision2,
          url: restriction ? null : url,
          context: context2,
          streamKey,
          sourceHost: parsed.host,
          attributionStatus: match2.status,
          attributionSource: match2.source,
          playurlHostChanged: outputRole2?.hostChanged ?? false,
          ...outputRole2 ? { playurlOutput: outputRole2 } : {}
        };
      }
      if (parsed.kind === "live" || parsed.kind === "resource" || parsed.kind === "pcdn" || parsed.kind === "suspected-pcdn") {
        const restriction = this.#hardRestriction(parsed.host, kindHint);
        if (restriction) return { decision: this.#block(restriction, parsed.host), url: null, context: null, streamKey, sourceHost: parsed.host };
        return { decision: this.#pass(parsed.kind, parsed.host, kindHint ?? "video"), url, context: null, streamKey, sourceHost: parsed.host };
      }
      const match = this.vault.match(url);
      const context = match.status === "matched" ? match.context : null;
      const kind = context?.kind ?? kindHint ?? null;
      if (streamKey && this.#hostLockedStreams.has(streamKey)) {
        const original = context ? this.vault.rootUrl(context.representation) ?? url : url;
        const originalHost = parseMediaUrl(original)?.host ?? parsed.host;
        const hard = this.#hardRestriction(originalHost, kind);
        if (hard && context) {
          const fallback = this.#choose(context, demand ?? { kind: context.kind, requiredMbps: 8, highDemand: false }, "watchdog", originalHost);
          const safe = this.#materialize(original, fallback, context);
          const target = safe ? parseMediaUrl(safe)?.host : null;
          if (safe && target && target !== originalHost && !this.#hardRestriction(target, context.kind)) {
            this.#savePlan(context.representation, fallback);
            return { decision: fallback, url: safe, context, streamKey, sourceHost: originalHost };
          }
        }
        const decision2 = hard ? this.#block(hard, originalHost) : this.#pass("host-locked", originalHost, kind ?? "video");
        this.#remember(decision2, context, kind ?? "video");
        return { decision: decision2, url: hard ? null : original, context, streamKey, sourceHost: originalHost };
      }
      const playbackDemand = demand ?? { kind: kind ?? "video", requiredMbps: kind === "audio" ? 0.5 : 8, highDemand: false };
      let decision = context ? this.#currentPlan(context.representation) : streamKey ? this.#streamPlans.get(streamKey) : null;
      const outputRole = context ? this.vault.outputRole(context.representation, url) : null;
      if (context?.kind === "video" && !this.#requestedRepresentations.has(context.representation) && this.session.get().affinity && outputRole?.role !== "backup" && !this.settings.get().fixedHost) {
        decision = this.#choose(context, playbackDemand, "representation", null);
      }
      if (context && outputRole?.role === "backup" && decision?.host !== parsed.host && !this.settings.get().fixedHost && !this.#hardRestriction(parsed.host, kind)) {
        const catalogIndex2 = TRUSTED_CATALOG.indexOf(parsed.host);
        const native = this.vault.candidates(context.representation, this.#unlockedNative.get(context.representation) ?? /* @__PURE__ */ new Set()).native.find((candidate2) => candidate2.host === parsed.host && this.vault.resolve(candidate2.handle, context) === parsed.url.href);
        const candidate = catalogIndex2 >= 0 ? { type: "catalog-generated", host: parsed.host, kind: context.kind, catalogIndex: catalogIndex2 } : native;
        if (candidate) {
          decision = { action: "rewrite", id: this.#nextId(), reason: "player-fallback", routeType: candidate.type, host: parsed.host, candidate, ranking: [] };
          this.session.noteDecision(decision.id);
          this.#emit({ type: "route-planned", at: this.clock.now(), decision });
        }
      }
      if (!decision || decision.action === "block" || !this.#decisionAllowed(decision, context, kind)) {
        if (context) decision = this.#choose(context, playbackDemand, "request", null);
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
      const finalHost = applied ? parseMediaUrl(applied)?.host : null;
      const finalRestriction = finalHost ? this.#hardRestriction(finalHost, kind) : null;
      if (finalHost && finalRestriction) {
        decision = this.#block(finalRestriction, finalHost);
        applied = null;
      }
      this.#remember(decision, context, kind ?? "video");
      if (context) {
        this.#savePlan(context.representation, decision);
        this.#requestedRepresentations.add(context.representation);
      } else if (streamKey) {
        this.#streamPlans.set(streamKey, decision);
        while (this.#streamPlans.size > 192) this.#streamPlans.delete(this.#streamPlans.keys().next().value);
      }
      const sourceHost = context ? parseMediaUrl(this.vault.rootUrl(context.representation) ?? url)?.host ?? parsed.host : parsed.host;
      if (applied && context) this.vault.registerAlias(context.representation, applied);
      return {
        decision,
        url: applied,
        context,
        streamKey,
        sourceHost,
        attributionStatus: match.status,
        attributionSource: match.source,
        playurlHostChanged: outputRole?.hostChanged ?? false,
        ...outputRole ? { playurlOutput: outputRole } : {}
      };
    }
    #applyCatalogOnly(url, parsed, kindHint, demand) {
      const match = this.vault.match(url), context = match.status === "matched" ? match.context : null;
      const root = context ? this.#catalogSource(context, url) : null;
      const sourceHost = parseMediaUrl(root ?? url)?.host ?? parsed.host;
      const streamKey = mediaIdentity(url);
      const outputRole = context ? this.vault.outputRole(context.representation, url) : null;
      const blocked = /* @__PURE__ */ __name((reason) => ({
        decision: this.#block(reason, parsed.host),
        url: null,
        context,
        streamKey,
        sourceHost,
        attributionStatus: match.status,
        attributionSource: match.source,
        playurlHostChanged: outputRole?.hostChanged ?? false,
        ...outputRole ? { playurlOutput: outputRole } : {}
      }), "blocked");
      const exactPcdn = parsed.kind === "pcdn" && match.source === "exact" && !!context;
      if (parsed.kind !== "normal" && !exactPcdn || !parsed.replaceable || context && !root) {
        return blocked("catalog-unreplaceable");
      }
      const kind = context?.kind ?? kindHint;
      const playbackDemand = demand ?? { kind: kind ?? "video", requiredMbps: kind === "audio" ? 0.5 : 8, highDemand: false };
      let decision = context ? this.#currentPlan(context.representation) : streamKey ? this.#streamPlans.get(streamKey) : null;
      if (context?.kind === "video" && !this.#requestedRepresentations.has(context.representation) && this.session.get().affinity && outputRole?.role !== "backup" && !this.settings.get().fixedHost) {
        decision = this.#choose(context, playbackDemand, "representation", null, url);
      }
      if (context && outputRole?.role === "backup" && outputRole.catalogGenerated && isCatalogHost(parsed.host) && !this.settings.get().fixedHost && !this.#hardRestriction(parsed.host, kind) && !this.#incompatible(url, parsed.host)) {
        const candidate = {
          type: "catalog-generated",
          host: parsed.host,
          kind: context.kind,
          catalogIndex: TRUSTED_CATALOG.indexOf(parsed.host)
        };
        decision = {
          action: "rewrite",
          id: this.#nextId(),
          reason: "player-fallback",
          routeType: candidate.type,
          host: parsed.host,
          candidate,
          ranking: []
        };
        this.session.noteDecision(decision.id);
        this.#emit({ type: "route-planned", at: this.clock.now(), decision });
      }
      const allowed = /* @__PURE__ */ __name((candidate) => !!candidate && candidate.action === "rewrite" && candidate.candidate.type === "catalog-generated" && isCatalogHost(candidate.host) && !this.#hardRestriction(candidate.host, kind) && !this.#incompatible(url, candidate.host) && (!context || !this.vault.isInvalid(context.representation, candidate.host)), "allowed");
      if (!allowed(decision)) {
        decision = context ? this.#choose(context, playbackDemand, "request", null, url) : this.#catalogOnly(playbackDemand, parsed.host, kind, url);
      }
      if (!decision || decision.action !== "rewrite" || !allowed(decision)) {
        return blocked("catalog-unavailable");
      }
      const target = replaceUrlHost(url, decision.host);
      if (!target || parseMediaUrl(target)?.kind !== "normal" || parseMediaUrl(target)?.host !== decision.host || this.#hardRestriction(decision.host, kind) || this.#incompatible(url, decision.host)) return blocked("catalog-unavailable");
      this.#remember(decision, context, kind ?? "video");
      if (context) {
        this.#savePlan(context.representation, decision);
        this.#requestedRepresentations.add(context.representation);
        this.vault.registerAlias(context.representation, target);
      } else if (streamKey) {
        this.#streamPlans.set(streamKey, decision);
        while (this.#streamPlans.size > 192) this.#streamPlans.delete(this.#streamPlans.keys().next().value);
      }
      return {
        decision,
        url: target,
        context,
        streamKey,
        sourceHost,
        attributionStatus: match.status,
        attributionSource: match.source,
        playurlHostChanged: outputRole?.hostChanged ?? false,
        ...outputRole ? { playurlOutput: outputRole } : {}
      };
    }
    decisionRecord(id) {
      return id ? this.#decisions.get(id) ?? null : null;
    }
    opaqueOutput(representation, original, originals, source) {
      const context = this.vault.identity(representation);
      if (!context) return { primary: "", backups: [] };
      if (this.isCatalogOnly()) return { primary: "", backups: [] };
      const permitted = [...new Set(originals)].filter((url) => {
        const parsed = parseMediaUrl(url), match = this.vault.match(url);
        return !!parsed && match.source === "exact" && match.context?.representation === representation && !this.#hardRestriction(parsed.host, context.kind) && !this.vault.isInvalid(representation, parsed.host);
      });
      const primary = permitted[0] ?? "", backups = permitted.slice(1, 6);
      if (primary) {
        const host = parseMediaUrl(primary).host;
        const decision = this.#pass(primary === original ? "opaque-original" : "opaque-original-backup", host, context.kind);
        this.#remember(decision, context, context.kind);
        this.#emit({ type: "route-planned", at: this.clock.now(), decision });
        this.vault.registerOutput(representation, original, primary, backups, decision.id, source);
      }
      return { primary, backups };
    }
    playerOutput(representation, original, decision, originals, source = "trusted-api", recordOutput = true) {
      const context = this.vault.identity(representation);
      if (!context) return { primary: "", backups: [] };
      const allowed = /* @__PURE__ */ __name((url) => {
        const parsed = parseMediaUrl(url);
        const match = parsed?.kind === "unknown" ? this.vault.match(url) : null;
        const exactOpaque = match?.source === "exact" && match.context?.representation === representation;
        return !!parsed && (parsed.kind === "normal" || exactOpaque) && !this.#hardRestriction(parsed.host, context.kind) && !this.vault.isInvalid(representation, parsed.host);
      }, "allowed");
      const stream = mediaIdentity(original);
      if (this.#originalComparison) {
        const unique = [...new Set(originals)];
        const candidates2 = unique.map((url, index) => ({ index, host: parseMediaUrl(url)?.host ?? "", allowed: allowed(url) }));
        const outputPlan = originalOutputPlan(candidates2);
        const permitted = candidates2.filter((candidate) => candidate.allowed).map((candidate) => unique[candidate.index]);
        const primary2 = outputPlan.primary === null ? "" : unique[outputPlan.primary], backups2 = outputPlan.backups.map((index) => unique[index]);
        if (primary2) {
          const selectedHost = parseMediaUrl(primary2).host;
          const outputDecision = primary2 === original && decision.action === "pass" && decision.host === selectedHost ? decision : this.#pass("original-backup", selectedHost, context.kind);
          if (outputDecision !== decision) {
            this.#savePlan(representation, outputDecision);
            this.#remember(outputDecision, context, context.kind);
            this.#emit({ type: "route-planned", at: this.clock.now(), decision: outputDecision });
          }
          this.vault.registerOutput(representation, original, primary2, backups2, outputDecision.id, source);
          for (const url of permitted.slice(0, 6)) this.vault.registerAlias(representation, url);
        }
        return this.isBilibiliMedia(primary2) ? { primary: primary2, backups: backups2.filter((url) => this.isBilibiliMedia(url)) } : { primary: "", backups: [] };
      }
      if (this.isCatalogOnly()) {
        const sourceUrl = this.#catalogSource(context, original);
        if (!sourceUrl || decision.action !== "rewrite" || decision.candidate.type !== "catalog-generated" || !isCatalogHost(decision.host)) {
          return { primary: "", backups: [] };
        }
        const primary2 = replaceUrlHost(sourceUrl, decision.host);
        if (!primary2 || !allowed(primary2) || this.#incompatible(sourceUrl, decision.host)) return { primary: "", backups: [] };
        const preferred = decision.ranking.filter((row) => row.eligible && row.candidate.type === "catalog-generated").map((row) => row.candidate.host);
        const unavailable = new Set(TRUSTED_CATALOG.filter((host) => this.#incompatible(sourceUrl, host) || !allowed(replaceUrlHost(sourceUrl, host) ?? "")));
        const backups2 = catalogOutputPlan(decision.host, preferred, unavailable).flatMap((host) => {
          const url = replaceUrlHost(sourceUrl, host);
          return url ? [url] : [];
        });
        this.vault.registerAlias(representation, primary2);
        for (const backup of backups2) this.vault.registerAlias(representation, backup);
        if (recordOutput) this.vault.registerOutput(representation, sourceUrl, primary2, backups2, decision.id, source, true);
        return { primary: primary2, backups: Object.freeze(backups2) };
      }
      const lockedOriginal = stream && this.#hostLockedStreams.has(stream) ? this.vault.rootUrl(representation) : null;
      const primary = lockedOriginal && allowed(lockedOriginal) ? lockedOriginal : this.#materialize(original, decision, context);
      if (!primary || !allowed(primary)) return { primary: "", backups: [] };
      const locked = mediaIdentity(original);
      const generated = locked && this.#hostLockedStreams.has(locked) ? [] : decision.ranking.filter((row) => row.eligible && row.candidate.type === "catalog-generated" && !this.#incompatible(original, row.candidate.host)).flatMap((row) => {
        const url = replaceUrlHost(original, row.candidate.host);
        return url && allowed(url) ? [url] : [];
      });
      const primaryHost = parseMediaUrl(primary)?.host;
      const urls = [.../* @__PURE__ */ new Set([...originals, ...generated])].filter((url) => url !== primary);
      const candidates = urls.map((url, index) => ({ index, host: parseMediaUrl(url)?.host ?? "", allowed: allowed(url) }));
      const backups = backupOutputPlan(primaryHost ?? null, candidates, !!lockedOriginal).map((index) => urls[index]);
      this.vault.registerAlias(representation, primary);
      for (const url of backups) this.vault.registerAlias(representation, url);
      this.vault.registerOutput(representation, original, primary, backups, decision.id, source);
      return this.isBilibiliMedia(primary) ? { primary, backups: backups.filter((url) => this.isBilibiliMedia(url)) } : { primary: "", backups: [] };
    }
    challenge(representation, demand, preferNative, excludedHosts = /* @__PURE__ */ new Set(), catalogCursor = 0) {
      const context = this.vault.identity(representation);
      const root = context && this.isCatalogOnly() ? this.#catalogSource(context) : this.vault.rootUrl(representation);
      const rootKey = root ? mediaIdentity(root) : null;
      if (!context || !root || this.settings.get().fixedHost || this.#originalComparison || rootKey !== null && this.#hostLockedStreams.has(rootKey)) return null;
      const settings = this.settings.get(), restriction = this.restrictions.snapshot(context.kind);
      const catalog = catalogCandidates(context.kind);
      const native = this.isCatalogOnly() ? [] : this.vault.candidates(
        representation,
        this.#unlockedNative.get(representation) ?? /* @__PURE__ */ new Set()
      ).native.filter((candidate) => candidate.activelyExplorable);
      const rotatedCatalog = [...catalog.slice(catalogCursor % catalog.length), ...catalog.slice(0, catalogCursor % catalog.length)];
      const candidates = preferNative ? [...native, ...rotatedCatalog] : [...rotatedCatalog, ...native];
      const now = this.clock.now(), currentHost = this.session.get().affinity?.host;
      const selected = candidates.find((candidate) => {
        if (candidate.host === currentHost || excludedHosts.has(candidate.host)) return false;
        if (this.#hardRestriction(candidate.host, candidate.kind)) return false;
        if (candidate.type === "catalog-generated" && this.#incompatible(root, candidate.host)) return false;
        const attemptKey = `${context.representation}:${candidate.host}`;
        if (now - (this.#challengeAttempts.get(attemptKey) ?? 0) < 6 * 60 * 6e4) return false;
        const evidence = this.evidence.get(candidate.host, candidate.kind);
        return !evidence || !evidence.updatedAt || now - evidence.updatedAt >= 6 * 60 * 60 * 1e3;
      });
      if (!selected) return null;
      const id = this.#nextId();
      const decision = {
        action: "rewrite",
        id,
        reason: "safe-challenger",
        routeType: selected.type,
        host: selected.host,
        candidate: selected,
        ranking: Object.freeze([])
      };
      const url = selected.type === "catalog-generated" ? replaceUrlHost(root, selected.host) : this.vault.resolve(selected.handle, context);
      if (!url || selected.type === "catalog-generated" && parseMediaUrl(url)?.kind !== "normal") return null;
      this.#challengeAttempts.set(`${context.representation}:${selected.host}`, now);
      this.#remember(decision, context, context.kind);
      this.#emit({ type: "route-planned", at: now, decision });
      const applied = { decision, url, context, streamKey: rootKey, sourceHost: parseMediaUrl(root)?.host ?? null };
      this.#measurementId(applied, "challenge");
      return applied;
    }
    async recordChallenge(applied, bytes2, elapsedMs, ttfbMs, outcome, failureKind) {
      const context = applied.context;
      if (!context || applied.decision.action !== "rewrite") return;
      if (this.isCatalogOnly() && applied.decision.routeType !== "catalog-generated") return;
      const valid = /* @__PURE__ */ __name(() => context.generation === this.session.get().generation && context.epoch === this.session.get().epoch && !this.session.get().disabled && this.vault.isCurrentIdentity(context) && (!this.isCatalogOnly() || applied.decision.routeType === "catalog-generated"), "valid");
      if (!valid()) return;
      if (failureKind === "native-invalid" && applied.decision.routeType === "native-signed") {
        this.vault.invalidate(context.representation, applied.decision.host);
        return;
      }
      if (outcome === "failure") return;
      await this.evidence.record(applied.decision.host, context.kind, {
        requestId: this.#measurementId(applied, "challenge"),
        at: this.clock.now(),
        source: "challenge",
        outcome,
        throughputMbps: outcome === "success" && bytes2 >= 64 * 1024 && elapsedMs > 0 ? bytes2 * 8 / elapsedMs / 1e3 : null,
        ttfbMs,
        failureKind
      }, valid);
    }
    async observe(observation) {
      if (observation.request) this.#pendingMedia.delete(observation.request.requestId);
      const valid = /* @__PURE__ */ __name(() => observation.generation === this.session.get().generation && observation.epoch === this.session.get().epoch && !this.session.get().disabled && (observation.request?.authorityRevision == null || !observation.representation || this.vault.identity(observation.representation)?.authorityRevision === observation.request.authorityRevision), "valid");
      const catalogObserved = /* @__PURE__ */ __name(() => !this.isCatalogOnly() || observation.routeType === "catalog-generated" && isCatalogHost(observation.targetHost) && (observation.finalHost === observation.targetHost || observation.finalHost === null && observation.outcome === "failure"), "catalogObserved");
      const controlsCurrent = /* @__PURE__ */ __name(() => valid() && (observation.request ? observation.request.routePolicyRevision === this.#policyRevision : !!observation.decisionId && this.#decisions.get(observation.decisionId)?.policyRevision === this.#policyRevision), "controlsCurrent");
      if (controlsCurrent() && this.isCatalogOnly() && observation.routeType === "catalog-generated" && isCatalogHost(observation.targetHost) && observation.finalHost && observation.finalHost !== observation.targetHost && observation.streamKey) this.#markIncompatibleKey(observation.streamKey, observation.targetHost);
      this.#emit({ type: "transport-completed", at: this.clock.now(), observation, detached: !valid() || !catalogObserved() });
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
      const key = observation.kind ?? "unknown", request = observation.request;
      this.#latest.set(key, Object.freeze({
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
      }));
      if (observation.outcome === "success" && observation.finalHost) this.#lastSuccess.set(key, this.#latest.get(key));
      if (observation.outcome === "abort") return;
      const evidenceHost = observation.finalHost ?? observation.targetHost;
      if (!evidenceHost) return;
      if (observation.status === 403 && observation.streamKey && observation.routeType === "catalog-generated") {
        if (!controlsCurrent()) return;
        this.#markIncompatibleKey(observation.streamKey, observation.targetHost);
        this.#hostLockedStreams.add(observation.streamKey);
        if (observation.kind === "video" && observation.representation) this.recoverStartup(
          observation.representation,
          { kind: "video", requiredMbps: 8, highDemand: false },
          observation.targetHost,
          []
        );
        return;
      }
      if (!observation.kind || request && request.attributionStatus !== "matched") return;
      const representation = observation.representation;
      const requestId2 = request?.requestId ?? `${Number(observation.generation)}:${Number(observation.epoch)}:${observation.completedAt}:${observation.targetHost}`;
      if (observation.outcome === "success") {
        if (!observation.finalHost) return;
        const throughputMbps = observation.bytes >= 64 * 1024 && observation.elapsedMs > 0 ? observation.bytes * 8 / observation.elapsedMs / 1e3 : null;
        await this.evidence.record(observation.finalHost, observation.kind, {
          requestId: requestId2,
          at: observation.completedAt,
          source: "transport",
          outcome: "success",
          throughputMbps,
          ttfbMs: observation.ttfbMs,
          failureKind: null
        }, () => valid() && catalogObserved());
        if (!controlsCurrent() || !catalogObserved()) return;
        if (representation && this.vault.hosts(representation).includes(observation.finalHost)) {
          this.unlockNative(representation, observation.finalHost);
        }
        if (observation.kind === "video") {
          const active = this.session.get().representation;
          if (representation && representation !== active) {
            if (this.#tentativeRepresentation === representation) this.#tentativeTransfers++;
            else {
              this.#tentativeRepresentation = representation;
              this.#tentativeTransfers = 1;
            }
            if (this.#tentativeTransfers >= 2) {
              this.session.setRepresentation(representation);
              this.#tentativeRepresentation = null;
              this.#tentativeTransfers = 0;
            }
          } else {
            this.#tentativeRepresentation = null;
            this.#tentativeTransfers = 0;
          }
          if (representation && this.session.get().representation === representation && observation.decisionId) {
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
        return;
      }
      const failureKind = observation.failureKind;
      if (failureKind === "native-invalid" && representation) {
        if (!controlsCurrent()) return;
        this.vault.invalidate(representation, evidenceHost);
        const demand = { kind: observation.kind, requiredMbps: observation.kind === "audio" ? 0.5 : 8, highDemand: false };
        this.recover(representation, demand, "verified-failure", evidenceHost);
        return;
      }
      if (!failureKind || !["network", "body", "timeout", "http-5xx"].includes(failureKind)) return;
      await this.evidence.record(evidenceHost, observation.kind, {
        requestId: requestId2,
        at: observation.completedAt,
        source: "transport",
        outcome: "failure",
        throughputMbps: null,
        ttfbMs: observation.ttfbMs,
        failureKind
      }, () => valid() && catalogObserved());
      if (!controlsCurrent() || !catalogObserved()) return;
      if (representation) {
        const demand = { kind: observation.kind, requiredMbps: observation.kind === "audio" ? 0.5 : 8, highDemand: false };
        this.recover(representation, demand, "verified-failure", evidenceHost);
      }
    }
    snapshot() {
      const session = this.session.get(), active = session.representation ? this.#plans.get(session.representation) : null;
      const recent = [...this.#plans.entries()].filter(([representation]) => representation !== session.representation).slice(-4);
      const summarize = /* @__PURE__ */ __name((decision) => Object.freeze({
        id: decision.id,
        action: decision.action,
        reason: decision.reason,
        routeType: decision.routeType,
        host: decision.host
      }), "summarize");
      return Object.freeze({
        originalComparison: this.#originalComparison,
        planCount: this.#plans.size,
        activePlan: active ? Object.freeze({
          ...summarize(active),
          ranking: Object.freeze(active.ranking.slice(0, 12).map((row) => Object.freeze({
            host: row.candidate.host,
            type: row.candidate.type,
            state: row.state,
            eligible: row.eligible,
            reasons: row.reasons,
            safeMbps: row.safeThroughputMbps,
            ratio: row.demandRatio,
            ttfbMs: row.medianTtfbMs
          })))
        }) : null,
        recentPlans: Object.freeze(recent.map(([representation, decision]) => Object.freeze({ representation, ...summarize(decision) }))),
        affinity: session.affinity,
        latest: Object.freeze(Object.fromEntries(this.#latest)),
        lastSuccess: Object.freeze(Object.fromEntries(this.#lastSuccess)),
        requested: Object.freeze(Object.fromEntries(this.#requested)),
        attribution: session.representation ? "confirmed" : this.#tentativeRepresentation ? "awaiting-second-video-transfer" : "awaiting-matched-video",
        representation: session.representation ? this.vault.groupSummary(session.representation) : null,
        fallback: Object.freeze(Object.fromEntries(this.#fallbacks))
      });
    }
    #trackFallback(representation, kind, decision) {
      const identity = this.vault.identity(representation);
      if (!decision.host || !identity || identity.kind !== kind) return;
      const actionId = recoveryActionId(`recovery-${++this.#recoverySerial}`);
      this.#fallbacks.set(kind, Object.freeze({
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
      }));
      this.#emit({ type: "recovery", at: this.clock.now(), action: { action: "route-fallback", id: actionId, kind, identity, decision } });
    }
    #choose(context, demand, boundary, failedHost, sourceUrl) {
      const settings = this.settings.get();
      const { disabledCatalogHosts, defaultUnavailableHosts } = catalogRestrictions(settings.catalogOverrides);
      const restriction = this.restrictions.snapshot(context.kind);
      const unlocked = this.#unlockedNative.get(context.representation) ?? /* @__PURE__ */ new Set();
      const routes = this.vault.candidates(context.representation, unlocked);
      const root = this.isCatalogOnly() ? this.#catalogSource(context, sourceUrl) ?? "" : sourceUrl ?? this.vault.rootUrl(context.representation) ?? "";
      if (this.isCatalogOnly() && !root) return this.#block("catalog-unreplaceable", null);
      const catalog = catalogCandidates(context.kind).filter((candidate) => !this.vault.isInvalid(context.representation, candidate.host) && !this.#incompatible(root, candidate.host));
      const candidates = this.isCatalogOnly() ? catalog : [...catalog, ...routes.native, ...routes.root ? [routes.root] : []];
      const id = this.#nextId();
      const current = this.#currentPlan(context.representation), affinity = this.session.get().affinity;
      const currentRoute = boundary === "representation" && context.kind === "video" && affinity ? { type: affinity.type, host: affinity.host } : current && current.action !== "block" && current.host ? { type: current.routeType, host: current.host } : context.kind === "video" && affinity ? { type: affinity.type, host: affinity.host } : null;
      const decision = chooseRoute({
        candidates,
        evidenceFor: /* @__PURE__ */ __name((host, kind) => this.evidence.get(host, kind), "evidenceFor"),
        restrictions: { disabledCatalogHosts, defaultUnavailableHosts, blackHosts: restriction.blackHosts, deadHosts: restriction.deadHosts, hostLocked: /* @__PURE__ */ new Set() },
        demand,
        fixedHost: settings.fixedHost,
        current: currentRoute,
        boundary,
        failedHost
      }, this.clock, id);
      this.session.noteDecision(id);
      this.#remember(decision, context, context.kind);
      this.#emit({ type: "route-planned", at: this.clock.now(), decision });
      return decision;
    }
    #catalogOnly(demand, originalHost, knownKind, sourceUrl) {
      const settings = this.settings.get(), restriction = this.#restrictionSnapshot(knownKind);
      const candidates = catalogCandidates(demand.kind).filter((candidate) => !sourceUrl || !this.#incompatible(sourceUrl, candidate.host));
      const id = this.#nextId();
      const decision = chooseRoute({
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
      }, this.clock, id);
      if (decision.action === "block") {
        if (this.isCatalogOnly()) return this.#block("catalog-unavailable", originalHost);
        const forbidden = this.#hardRestriction(originalHost, knownKind);
        return forbidden ? this.#block(forbidden, originalHost) : this.#pass("catalog-unavailable", originalHost, demand.kind);
      }
      return decision;
    }
    #materialize(original, decision, context) {
      if (decision.action === "block") return null;
      if (decision.action === "pass") return original;
      if (decision.candidate.type === "catalog-generated") return replaceUrlHost(original, decision.host);
      return context ? this.vault.resolve(decision.candidate.handle, context) : null;
    }
    #pass(reason, host, kind) {
      return { action: "pass", id: this.#nextId(), reason: reason.slice(0, 64), routeType: "root-original", host, ranking: Object.freeze([]) };
    }
    #block(reason, host) {
      return { action: "block", id: this.#nextId(), reason, routeType: "root-original", host, ranking: Object.freeze([]) };
    }
    #restrictionSnapshot(kind) {
      if (kind) return this.restrictions.snapshot(kind);
      const video = this.restrictions.snapshot("video"), audio = this.restrictions.snapshot("audio");
      return { blackHosts: /* @__PURE__ */ new Set([...video.blackHosts, ...audio.blackHosts]), deadHosts: /* @__PURE__ */ new Set([...video.deadHosts, ...audio.deadHosts]) };
    }
    #hardRestriction(host, kind) {
      const settings = this.settings.get(), restriction = this.#restrictionSnapshot(kind), evidence = kind ? this.evidence.get(host, kind) : null;
      return hardRestriction(host, {
        ...restriction,
        overrides: settings.catalogOverrides,
        circuitUntil: evidence?.circuitUntil ?? 0
      }, this.clock.now());
    }
    #catalogSource(context, requested) {
      const handle = this.vault.catalogSourceHandle(context.representation);
      const source = handle ? this.vault.resolve(handle, context) : null;
      const parsed = source ? parseMediaUrl(source) : null;
      const generated = parsed?.replaceable ? replaceUrlHost(parsed.url.href, TRUSTED_CATALOG[0]) : null;
      if (!generated || parseMediaUrl(generated)?.kind !== "normal") return null;
      const codec = this.vault.groupSummary(context.representation)?.codec;
      if (requested && codec !== "mp4" && codec !== "flv") {
        const parsedRequested = parseMediaUrl(requested), match = this.vault.match(requested);
        if (parsedRequested?.kind === "normal" && parsedRequested.replaceable && match.context?.representation === context.representation && (match.source === "exact" || match.source === "catalog-alias")) return parsedRequested.url.href;
      }
      return parsed.url.href;
    }
    #decisionAllowed(decision, context, kind) {
      if (decision.action === "block" || !decision.host || this.#hardRestriction(decision.host, kind)) return false;
      const source = context && this.isCatalogOnly() ? this.#catalogSource(context) : null;
      if (this.isCatalogOnly()) return decision.action === "rewrite" && decision.candidate.type === "catalog-generated" && isCatalogHost(decision.host) && (!context || !!source && !this.#incompatible(source, decision.host));
      if (decision.action === "pass") return !context || !this.vault.isInvalid(context.representation, decision.host);
      const candidate = decision.candidate;
      if (candidate.type === "catalog-generated") return !context || !this.#incompatible(this.vault.rootUrl(context.representation) ?? "", decision.host);
      if (!context) return false;
      return this.vault.candidates(context.representation, this.#unlockedNative.get(context.representation) ?? /* @__PURE__ */ new Set()).native.some((route) => route.handle === candidate.handle && route.host === decision.host);
    }
    #currentPlan(representation) {
      const current = this.vault.identity(representation), prior = this.#planIdentities.get(representation);
      if (prior && prior !== current) {
        this.#plans.delete(representation);
        this.#planIdentities.delete(representation);
        this.#unlockedNative.delete(representation);
        this.#requestedRepresentations.delete(representation);
        if (this.#tentativeRepresentation === representation) {
          this.#tentativeRepresentation = null;
          this.#tentativeTransfers = 0;
        }
        for (const [kind, fallback] of this.#fallbacks) if (fallback.representation === representation) this.#fallbacks.delete(kind);
        for (const key of this.#challengeAttempts.keys()) if (key.startsWith(`${representation}:`)) this.#challengeAttempts.delete(key);
        const affinity = this.session.get().affinity;
        if (affinity?.representation === representation && affinity.type !== "catalog-generated") this.session.setAffinity(null);
      }
      return this.#plans.get(representation);
    }
    #savePlan(representation, decision) {
      this.#currentPlan(representation);
      const identity = this.vault.identity(representation);
      if (!identity) return;
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
      while (this.#startupIncompatible.size > 256) this.#startupIncompatible.delete(this.#startupIncompatible.keys().next().value);
    }
    #remember(decision, context, kind) {
      this.#decisions.set(decision.id, { decision, context, kind, representation: context?.representation ?? null, policyRevision: this.#policyRevision });
      while (this.#decisions.size > 256) this.#decisions.delete(this.#decisions.keys().next().value);
    }
    #emit(event) {
      for (const listener of this.#listeners) listener(event);
    }
    #measurementId(work, kind) {
      let id = this.#measurementIds.get(work);
      if (!id) {
        id = this.ids.next(kind);
        this.#measurementIds.set(work, id);
      }
      return id;
    }
  };

  // src-v2/application/measurement-controller.ts
  var COOLDOWN_MS = 10 * 6e4;
  var TIMEOUT_MS = 3e3;
  var cancellationReason = /* @__PURE__ */ __name((signal) => "reason" in signal ? signal.reason : new DOMException("Aborted", "AbortError"), "cancellationReason");
  var MeasurementController = class {
    constructor(routes, meta, probe, now, scheduler) {
      this.routes = routes;
      this.meta = meta;
      this.probe = probe;
      this.now = now;
      this.scheduler = scheduler;
    }
    routes;
    meta;
    probe;
    now;
    scheduler;
    static {
      __name(this, "MeasurementController");
    }
    #running = null;
    #planning = false;
    #manualRequested = false;
    #preferNative = false;
    #marker = 0;
    #lastStatus = null;
    #startupUsed = false;
    #startupPending = null;
    #startupController = null;
    #startupQualifiedHosts = [];
    #startupState = Object.freeze({
      state: "idle",
      reason: "not-requested",
      candidates: 0,
      selectedHost: null,
      delayed: false
    });
    #snapshot = Object.freeze({ state: "idle", reason: "startup", lastAttemptAt: 0, host: null });
    snapshot() {
      return Object.freeze({ ...this.#snapshot, startup: this.#startupState });
    }
    reset() {
      this.cancel("generation");
      this.#startupController?.abort("generation");
      this.#startupController = null;
      this.#startupPending = null;
      this.#startupQualifiedHosts = [];
      this.#marker++;
      this.#manualRequested = false;
      this.#snapshot = Object.freeze({ state: "idle", reason: "generation", lastAttemptAt: 0, host: null });
    }
    requestManual() {
      this.#manualRequested = true;
    }
    dispose() {
      this.reset();
    }
    startupFallbackHosts() {
      return this.#startupQualifiedHosts;
    }
    cancel(reason) {
      this.#running?.controller.abort(reason);
      this.#running = null;
    }
    willGateStartup(url) {
      return !this.#startupUsed && (!!this.#startupPending || !!this.routes.startupOptions(url)?.candidates.length);
    }
    /** The player request, never a page hint, authorizes this one bounded startup window. */
    async prepareStartup(url, signal = null) {
      if (signal?.aborted) throw cancellationReason(signal);
      if (this.#startupUsed) return;
      if (!this.#startupPending) {
        const cursor = Math.max(0, Number(this.meta.get().catalogCursor) || 0);
        const options = this.routes.startupOptions(url, cursor);
        if (!options?.candidates.length) {
          this.noteUnpreflighted("unsupported-or-no-legal-candidate");
          return;
        }
        const controller = new AbortController(), marker = this.#marker;
        this.#startupController = controller;
        this.#startupState = Object.freeze({
          state: "running",
          reason: "player-media-request",
          candidates: options.candidates.length,
          selectedHost: null,
          delayed: true
        });
        this.#startupPending = this.#runStartup(url, options, controller, marker).catch(() => {
          if (marker === this.#marker) this.#startupState = Object.freeze({
            state: "skipped",
            reason: "preflight-error",
            candidates: options.candidates.length,
            selectedHost: null,
            delayed: true
          });
        }).finally(() => {
          if (this.#startupController === controller) this.#startupController = null;
          if (marker === this.#marker) this.#startupPending = null;
        });
        void this.meta.withLock(() => {
          if (marker !== this.#marker) return;
          this.meta.update({ catalogCursor: cursor + 1 });
        }).catch(() => void 0);
      }
      const pending = this.#startupPending;
      if (!pending) return;
      if (!signal) {
        await pending;
        return;
      }
      if (signal.aborted) throw cancellationReason(signal);
      let onAbort = null;
      try {
        await Promise.race([pending, new Promise((_resolve, reject) => {
          onAbort = /* @__PURE__ */ __name(() => reject(cancellationReason(signal)), "onAbort");
          signal.addEventListener("abort", onAbort, { once: true });
        })]);
      } finally {
        if (onAbort) signal.removeEventListener("abort", onAbort);
      }
    }
    noteUnpreflighted(reason) {
      if (this.#startupUsed || this.#startupPending) return;
      this.#startupState = Object.freeze({
        state: "skipped",
        reason: reason.slice(0, 48),
        candidates: 0,
        selectedHost: null,
        delayed: false
      });
    }
    async #runStartup(url, options, controller, marker) {
      const results = [];
      let timer = null;
      const deadline = new Promise((resolve) => {
        timer = this.scheduler.timeout(() => {
          controller.abort("startup-deadline");
          resolve();
        }, TIMEOUT_MS);
      });
      const complete = Promise.all(options.candidates.map(async (candidate) => {
        const result = await this.#probeStartup(candidate, options.demand, controller.signal);
        if (marker === this.#marker) results.push(result);
      })).then(() => void 0);
      await Promise.race([complete, deadline]);
      if (timer !== null) timer();
      controller.abort("startup-complete");
      if (marker !== this.#marker) return;
      for (const result of results) this.routes.noteStartupProbeResult(result.candidate, result.status);
      const valid = results.filter((result) => result.valid && result.safeMbps !== null);
      const qualified = valid.filter((result) => (result.safeMbps ?? 0) / options.demand.requiredMbps >= 1.35);
      const ranked = [...qualified].sort((a, b) => (b.safeMbps ?? 0) - (a.safeMbps ?? 0));
      const catalogOnly = this.routes.isCatalogOnly();
      const fastestValid = [...valid].sort((a, b) => (b.safeMbps ?? 0) - (a.safeMbps ?? 0))[0]?.candidate ?? null;
      let winner = ranked[0]?.candidate ?? (!catalogOnly ? options.candidates.find((candidate) => candidate.original) : null) ?? fastestValid ?? (!catalogOnly ? options.candidates[0] : null) ?? null;
      const original = valid.find((result) => result.candidate.original);
      if (!catalogOnly && winner && original && !winner.original && (original.safeMbps ?? 0) >= (ranked[0]?.safeMbps ?? 0) * 0.9) winner = original.candidate;
      const decision = winner ? this.routes.commitStartupChoice(url, winner, valid.length ? "startup-preflight" : "startup-inconclusive") : null;
      this.#startupQualifiedHosts = Object.freeze([...valid].sort((a, b) => (b.safeMbps ?? 0) - (a.safeMbps ?? 0)).map((result) => result.candidate.host));
      this.#startupUsed = true;
      this.#startupState = Object.freeze({
        state: decision ? "complete" : "skipped",
        reason: valid.length ? "measured" : "inconclusive",
        candidates: options.candidates.length,
        selectedHost: decision?.host ?? null,
        delayed: true,
        results: Object.freeze(results.slice(0, 3).map((result) => Object.freeze({
          host: result.candidate.host,
          type: result.candidate.type,
          valid: result.valid,
          safeMbps: result.safeMbps,
          status: result.status,
          reason: result.reason
        })))
      });
      for (const result of valid) if (result.candidate.cachedSafeMbps === null) {
        void this.routes.recordStartupSuccess(result.candidate, result.bytes, result.elapsedMs, result.ttfbMs).catch(() => void 0);
      }
    }
    async #probeStartup(candidate, demand, signal) {
      const limit = candidate.cachedSafeMbps !== null ? 16 * 1024 : demand.highDemand ? 512 * 1024 : 256 * 1024;
      const result = await this.probe.read({ url: candidate.url, host: candidate.host, limit, signal, completionReason: "startup-sample-complete" });
      const valid = result.directRange && (candidate.cachedSafeMbps !== null ? result.bytes > 0 : result.bytes >= 64 * 1024);
      return {
        candidate,
        ...result,
        valid,
        safeMbps: valid ? candidate.cachedSafeMbps ?? result.bytes * 8 / result.elapsedMs / 1e3 * 0.7 : null,
        reason: result.directRange ? valid ? "measured" : "short-response" : result.reason
      };
    }
    tick(status) {
      this.#lastStatus = status;
      const unsafe = this.#unsafeReason(status);
      if (this.#running && unsafe) {
        this.cancel(unsafe);
        this.#snapshot = Object.freeze({ ...this.#snapshot, state: "cancelled", reason: unsafe });
        return;
      }
      if (this.#running || this.#planning) return;
      if (unsafe) {
        this.#snapshot = Object.freeze({
          ...this.#snapshot,
          state: "waiting",
          reason: this.#manualRequested ? "manual-" + unsafe : unsafe
        });
        return;
      }
      void this.#tryStart(status);
    }
    async #tryStart(status) {
      if (!status.representation || !status.demand || this.#running || this.#planning) return;
      this.#planning = true;
      const planningMarker = this.#marker;
      try {
        let at = this.now();
        let first = null, cursor = 0;
        await this.meta.withLock(() => {
          if (planningMarker !== this.#marker) return;
          const current = this.#lastStatus;
          if (!current || this.#unsafeReason(current) || current.representation !== status.representation || !current.demand) return;
          at = this.now();
          const meta = this.meta.get();
          if (at - (Number(meta.lastChallengeAt) || 0) < COOLDOWN_MS) return;
          cursor = Math.max(0, Number(meta.catalogCursor) || 0);
          first = this.routes.challenge(current.representation, current.demand, this.#preferNative, /* @__PURE__ */ new Set(), cursor);
          if (!first?.url) return;
          if (planningMarker !== this.#marker || this.routes.isCatalogOnly() && first.decision.routeType !== "catalog-generated") return;
          this.meta.update({ lastChallengeAt: at, catalogCursor: cursor + 1 });
        });
        if (planningMarker !== this.#marker) return;
        const planned = first;
        if (planned && this.routes.isCatalogOnly() && planned.decision.routeType !== "catalog-generated") return;
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
        this.#manualRequested = false;
        const controller = new AbortController(), marker = this.#marker;
        this.#running = { controller, marker };
        await this.#runRound(planned, status, controller, marker, cursor);
      } finally {
        this.#planning = false;
      }
    }
    async #runRound(first, status, controller, marker, cursor) {
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
        if (applied.decision.host) excluded.add(applied.decision.host);
        if (applied.decision.routeType === "native-signed") nativeCount++;
        else catalogCount++;
        this.#snapshot = Object.freeze({
          state: "running",
          reason: "candidate-" + (index + 1),
          lastAttemptAt: this.now(),
          host: applied.decision.host
        });
        await this.#runCandidate(applied, status.demand, controller, marker);
        if (index === 2 || controller.signal.aborted) break;
        next = this.routes.challenge(
          status.representation,
          status.demand,
          nativeCount === 0 && catalogCount >= 2,
          excluded,
          cursor + index + 1
        );
        if (nativeCount >= 1 && next?.decision.routeType === "native-signed") next = null;
      }
      if (this.#running?.marker === marker) this.#running = null;
      if (controller.signal.aborted && marker === this.#marker) this.#snapshot = Object.freeze({
        ...this.#snapshot,
        state: "cancelled",
        reason: String(controller.signal.reason ?? "cancelled").slice(0, 48)
      });
    }
    async #runCandidate(applied, demand, round, marker) {
      const startedAt = this.now(), limit = demand.highDemand ? 768 * 1024 : 384 * 1024;
      const controller = new AbortController();
      const cancel = /* @__PURE__ */ __name(() => controller.abort(round.signal.reason), "cancel");
      round.signal.addEventListener("abort", cancel, { once: true });
      const stopTimeout = this.scheduler.timeout(() => controller.abort("timeout"), TIMEOUT_MS);
      let result;
      try {
        result = await this.probe.read({
          url: applied.url ?? "",
          host: applied.decision.host,
          limit,
          signal: controller.signal,
          completionReason: "sample-complete"
        });
      } finally {
        stopTimeout();
        round.signal.removeEventListener("abort", cancel);
      }
      if (marker !== this.#marker || controller.signal.aborted && controller.signal.reason !== "timeout") return;
      const ok = result.directRange && result.bytes >= 64 * 1024;
      const failure = applied.decision.routeType === "native-signed" && [403, 451, 959].includes(result.status ?? 0) ? "native-invalid" : result.reason === "timeout" ? "timeout" : result.reason === "network" ? "network" : null;
      await this.routes.recordChallenge(applied, result.bytes, result.elapsedMs, result.ttfbMs, ok ? "success" : "failure", failure);
      if (marker !== this.#marker) return;
      this.#snapshot = Object.freeze({
        state: ok ? "complete" : "failed",
        reason: ok ? "sample-recorded" : result.directRange ? "short-response" : result.reason,
        lastAttemptAt: startedAt,
        host: applied.decision.host
      });
    }
    #unsafeReason(status) {
      if (status.disabled) return "disabled";
      if (!status.generationActive || !status.representation || !status.demand) return "no-representation";
      if (!status.visible) return "hidden";
      if (status.seeking) return "seeking";
      if (status.recovering) return "recovering";
      if (status.stableProgressSec < 20) return "awaiting-progress";
      if (status.playableBufferSec < 30) return "low-buffer";
      return null;
    }
  };

  // src-v2/application/recovery-controller.ts
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
    #listeners = /* @__PURE__ */ new Set();
    #pauseAt = 0;
    #hadHealthy = false;
    #lastHealthyTime = 0;
    #lastHealthyRate = 1;
    #startupReloaded = false;
    #token = null;
    #serial = 0;
    #reloadCount = 0;
    #breakerUntil = 0;
    #stopIntent = null;
    #suppress = false;
    #lifecycleSerial = 0;
    #lastFrames = null;
    #lastSnapshot = null;
    #lastControls = null;
    #lastTickAt = 0;
    #deadTicks = 0;
    #deadReported = false;
    #progressTicks = 0;
    #state = Object.freeze({ state: "healthy", source: null, pauseSec: 0, reloadCount: 0, breakerSec: 0 });
    subscribe(listener) {
      this.#listeners.add(listener);
      return () => this.#listeners.delete(listener);
    }
    snapshot() {
      return this.#state;
    }
    isRecovering() {
      return !!this.#token;
    }
    ongoingStallReload(id, snapshot, controls) {
      const token = this.#token;
      return !!token && token.stall?.id === id && this.isActive() && !snapshot.ended && !snapshot.mediaError && (this.#ownedReload(token, controls) || this.#acceptedReloadProgress(token, snapshot, controls));
    }
    reset() {
      if (this.#token) this.#finish("failed", "lifecycle-ended");
      this.#lifecycleSerial++;
      this.#lastFrames = null;
      this.#lastSnapshot = null;
      this.#lastControls = null;
      this.#lastTickAt = 0;
      this.#deadTicks = 0;
      this.#deadReported = false;
      this.#progressTicks = 0;
      this.#unhook();
      this.#pauseAt = 0;
      this.#hadHealthy = false;
      this.#lastHealthyTime = 0;
      this.#token = null;
      this.#reloadCount = 0;
      this.#breakerUntil = 0;
      this.#startupReloaded = false;
      this.#lastHealthyRate = 1;
      this.#state = Object.freeze({ state: "healthy", source: null, pauseSec: 0, reloadCount: 0, breakerSec: 0 });
    }
    armRouteFailure(source, snapshot, valid = () => true) {
      if (this.#token || snapshot.paused || snapshot.seeking || snapshot.ended || snapshot.mediaError || !this.#hadHealthy) return;
      this.#begin(source, true, valid);
    }
    armStall(snapshot, intent) {
      if (this.#token?.stall?.id === intent.id) return;
      if (this.#token) this.#finish("failed", "superseded-by-stall");
      if (!intent.valid() || snapshot.paused || snapshot.ended || snapshot.mediaError) return;
      this.#begin("stall", true, intent.valid, intent);
    }
    cancelStall(id) {
      if (this.#token?.stall?.id === id) this.#finish("failed", "stall-ended");
    }
    rejectStall() {
      this.#finish("failed", "no-legal-video-route");
    }
    armStartupFailure(snapshot, valid = this.captureEligibility()) {
      if (this.#token || this.#startupReloaded || snapshot.paused || snapshot.seeking || snapshot.ended || snapshot.mediaError || !snapshot.available || snapshot.playableBufferSec >= 1) return;
      this.#begin("startup-failure", true, valid);
    }
    tick(snapshot) {
      const now = this.now();
      const previous = this.#lastSnapshot, controls = this.player.controls();
      const sameControls = this.#lastControls !== null && controls.seekRevision === this.#lastControls.seekRevision && controls.userRevision === this.#lastControls.userRevision && controls.mediaId === this.#lastControls.mediaId && controls.coreId === this.#lastControls.coreId;
      const newFrames = snapshot.frames !== null && this.#lastFrames !== null && snapshot.frames > this.#lastFrames;
      const progress = !!previous && sameControls && !previous.seeking && !snapshot.seeking && !snapshot.paused && !snapshot.ended && !snapshot.mediaError && snapshot.currentTime - previous.currentTime > 0.05 && (snapshot.frames === null || newFrames);
      this.#progressTicks = progress ? this.#progressTicks + 1 : 0;
      this.#lastFrames = snapshot.frames;
      this.#lastSnapshot = snapshot;
      this.#lastControls = controls;
      if (this.#token && (snapshot.mediaError || snapshot.seeking && !this.#token.stall || snapshot.ended)) {
        this.#finish("failed", snapshot.mediaError ? "media-error" : snapshot.seeking ? "seek-interrupted" : "ended");
        return;
      }
      if (this.#token?.reloadingAt && this.#token.firstProgressAt === null && now - this.#token.reloadingAt >= 15e3) {
        this.#breakerUntil = now + 9e4;
        this.#finish("failed", "reload-timeout");
        return;
      }
      if (this.#token && (!this.isActive() || !this.#owns(this.#token, controls))) {
        this.#finish("failed", "ownership-ended");
        return;
      }
      const healthy = snapshot.available && !snapshot.mediaError && (snapshot.readyState >= 2 || snapshot.width > 0 || snapshot.height > 0 || newFrames);
      const deadObservation = this.#hadHealthy && snapshot.available && !snapshot.seeking && !snapshot.ended && !snapshot.mediaError && snapshot.readyState === 0 && snapshot.width === 0 && snapshot.height === 0 && snapshot.manifestHasVideo && snapshot.coreInitialized === false && !newFrames;
      const gap = now - this.#lastTickAt;
      this.#lastTickAt = now;
      this.#deadTicks = deadObservation ? gap > 0 && gap <= 2e3 ? this.#deadTicks + 1 : 1 : 0;
      if (healthy) this.#deadReported = false;
      if (this.#deadTicks >= 4 && !this.#deadReported) {
        this.#deadReported = true;
        this.#emit({ type: "core-uninitialized", at: now, paused: snapshot.paused, intentPending: !!this.#token, consecutiveTicks: this.#deadTicks });
      }
      if (healthy) {
        this.#hadHealthy = true;
        this.#lastHealthyTime = snapshot.currentTime;
        this.#lastHealthyRate = snapshot.playbackRate > 0 ? snapshot.playbackRate : 2;
        if (!this.#token && this.#progressTicks >= 2 && ["failed", "breaker"].includes(this.#state.state)) this.#finish("recovered", "playback-progress-observed");
        if (this.#token) {
          const ownedReload = this.#ownedReload(this.#token, controls);
          const restoreReady = !ownedReload || controls.coreId !== 0 && controls.coreReloadRevision === this.#token.reloadRevision && snapshot.coreInitialized !== false;
          if (this.#token.reloadingAt && !this.#token.restored && restoreReady) this.#restore(this.#token, snapshot);
          else if (this.#progressTicks >= 2) this.#finish("recovered");
        }
      }
      if (snapshot.paused && !snapshot.seeking && !snapshot.ended && this.#hadHealthy && !this.#token) {
        if (!this.#pauseAt) this.#pauseAt = now;
        this.#hook();
        if (!["failed", "breaker"].includes(this.#state.state)) this.#state = Object.freeze({
          state: "pause-armed",
          source: null,
          pauseSec: Math.floor((now - this.#pauseAt) / 1e3),
          reloadCount: this.#reloadCount,
          breakerSec: Math.max(0, Math.ceil((this.#breakerUntil - now) / 1e3))
        });
        else this.#state = Object.freeze({ ...this.#state, breakerSec: Math.max(0, Math.ceil((this.#breakerUntil - now) / 1e3)) });
      } else if (!snapshot.paused && this.#pauseAt && !this.#token) {
        const wasLong = now - this.#pauseAt >= 3e4;
        this.#pauseAt = 0;
        this.#unhook();
        if (wasLong) this.#begin("paused-transition", true);
        else if (healthy && this.#state.state === "pause-armed") this.#state = Object.freeze({
          state: "healthy",
          source: null,
          pauseSec: 0,
          reloadCount: this.#reloadCount,
          breakerSec: Math.max(0, Math.ceil((this.#breakerUntil - now) / 1e3))
        });
      }
      const token = this.#token;
      if (!token) return;
      if (snapshot.mediaError || snapshot.seeking && !token.stall || snapshot.ended) {
        this.#finish("failed", snapshot.mediaError ? "media-error" : snapshot.seeking ? "seek-interrupted" : "ended");
        return;
      }
      if (snapshot.paused && token.stall && !this.#ownedReload(token, this.player.controls())) {
        this.#finish("failed", "paused");
        return;
      }
      if (progress) {
        token.firstProgressAt ??= now;
        return;
      }
      if (token.firstProgressAt !== null) {
        if (now - token.firstProgressAt >= 15e3) this.#finish("failed", "progress-not-sustained");
        return;
      }
      const dead = snapshot.readyState === 0 && snapshot.width === 0 && snapshot.height === 0 && snapshot.manifestHasVideo && snapshot.coreInitialized === false;
      const startupStalled = token.source === "startup-failure" && snapshot.readyState < 2 && snapshot.playableBufferSec < 1 && snapshot.currentTime <= token.baselinePositionSec + 0.05 && (snapshot.frames === null || token.baselineFrames === null || snapshot.frames <= token.baselineFrames);
      if (!token.reloadingAt && (token.stall ? now - token.stall.startedAt >= 3e4 : (dead || startupStalled) && now - token.startedAt >= 4e3 || now - token.startedAt >= 3e4)) this.#reload(token);
      if (token.reloadingAt && now - token.reloadingAt >= 15e3) {
        this.#breakerUntil = now + 9e4;
        this.#finish("failed", "reload-timeout");
      }
    }
    dispose() {
      this.reset();
      this.#listeners.clear();
    }
    #hook() {
      this.#unhook();
      this.#stopIntent = this.player.observePlayIntent(() => {
        if (!this.#suppress && this.#pauseAt && this.now() - this.#pauseAt >= 3e4) this.#begin("trusted-player-play", true);
      });
    }
    #unhook() {
      this.#stopIntent?.();
      this.#stopIntent = null;
    }
    #begin(source, wasPlaying, valid = this.captureEligibility(), stall = null) {
      const lifecycle = this.#lifecycleSerial, before = this.player.controls();
      if (this.#token || before.dragging || !this.isActive() || !valid() || this.now() < this.#breakerUntil || this.#reloadCount >= 2) return;
      const position = stall?.targetSec ?? this.player.currentTime(), rate = this.player.playbackRate();
      const snapshot = this.player.snapshot(), controls = this.player.controls(), now = this.now();
      const eligible = this.isActive() && valid();
      if (!eligible || this.#lifecycleSerial !== lifecycle || this.#token || controls.dragging || now < this.#breakerUntil || this.#reloadCount >= 2 || snapshot.ended || snapshot.mediaError || controls.mediaId !== before.mediaId || controls.coreId !== before.coreId || controls.seekRevision !== before.seekRevision || controls.userRevision !== before.userRevision) return;
      this.#token = {
        id: recoveryActionId(`core-${++this.#serial}`),
        source,
        startedAt: now,
        savedPositionSec: Math.max(0, Number.isFinite(position) ? position : this.#lastHealthyTime),
        savedRate: rate > 0 ? rate : this.#lastHealthyRate || 1,
        wasPlaying,
        baselinePositionSec: snapshot.currentTime,
        baselineFrames: snapshot.frames,
        reloadingAt: 0,
        restored: false,
        controls,
        valid,
        stall,
        firstProgressAt: null,
        initiallyPaused: snapshot.paused,
        reloadRevision: null,
        restorePosition: true
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
      token.reloadingAt = this.now();
      this.#reloadCount++;
      if (token.source === "startup-failure") this.#startupReloaded = true;
      this.#breakerUntil = this.now() + 9e4;
      this.#emit({ type: "recovery", at: this.now(), action: {
        action: "player-reload",
        id: token.id,
        savedPositionSec: token.savedPositionSec,
        savedRate: token.savedRate
      } });
      this.#emit({
        type: "core",
        at: this.now(),
        state: "reloading",
        actionId: token.id,
        source: token.source,
        savedPositionSec: token.savedPositionSec,
        savedRate: token.savedRate,
        readyState: this.#lastSnapshot?.readyState ?? 0,
        coreInitialized: this.#lastSnapshot?.coreInitialized ?? null
      });
      const lifecycle = this.#lifecycleSerial;
      if (!this.#owns(token, this.player.controls())) return;
      try {
        const before = this.player.controls();
        if (!this.#owns(token, before)) return;
        token.reloadRevision = Number.isSafeInteger(before.reloadRevision) ? before.reloadRevision + 1 : null;
        const result = this.player.reload();
        if (result !== null && (typeof result === "object" || typeof result === "function")) void Promise.resolve(result).catch(() => {
          if (this.#lifecycleSerial === lifecycle && this.#token === token) this.#finish("failed", "reload-rejected");
        });
      } catch (error) {
        if (this.#token === token) this.#finish("failed", error instanceof Error && error.message === "player.reload unavailable" ? "reload-unavailable" : "reload-threw");
        return;
      }
      if (this.#token === token && this.#owns(token, this.player.controls())) this.#state = Object.freeze({ state: "reloading", source: token.source, pauseSec: 0, reloadCount: this.#reloadCount, breakerSec: 0 });
    }
    #restore(token, snapshot) {
      if (!this.#owns(token, this.player.controls()) || !this.isActive()) {
        this.#finish("failed", "ownership-ended");
        return;
      }
      token.restored = true;
      const position = snapshot.duration ? Math.min(token.savedPositionSec, Math.max(0, snapshot.duration - 0.1)) : token.savedPositionSec;
      try {
        if (token.restorePosition) this.player.seek(position);
        if (!this.#owns(token, this.player.controls()) || !this.isActive()) {
          if (this.#token === token) this.#finish("failed", "ownership-ended");
          return;
        }
        this.player.setRate(token.savedRate);
      } catch {
        if (this.#token === token) this.#finish("failed", "restore-threw");
        return;
      }
      const lifecycle = this.#lifecycleSerial;
      let playResult;
      if (token.wasPlaying) {
        if (!this.#owns(token, this.player.controls()) || !this.isActive()) {
          if (this.#token === token) this.#finish("failed", "ownership-ended");
          return;
        }
        this.#suppress = true;
        try {
          playResult = this.player.play();
        } catch {
          if (this.#token === token) this.#finish("recovered-paused", "play-threw");
          return;
        } finally {
          this.#suppress = false;
        }
      }
      if (this.#token !== token || !this.#owns(token, this.player.controls())) return;
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
      if (playResult !== null && (typeof playResult === "object" || typeof playResult === "function")) void Promise.resolve(playResult).catch(() => {
        if (this.#lifecycleSerial !== lifecycle || this.#token !== token || !this.#owns(token, this.player.controls())) return;
        this.#finish("recovered-paused", "play-rejected");
      });
    }
    #owns(token, _observed) {
      const snapshot = this.player.snapshot();
      const eligible = this.isActive() && token.valid(), controls = this.player.controls();
      const ownedReload = this.#ownedReload(token, controls);
      const stillEligible = this.isActive() && token.valid(), current = this.player.controls();
      if (this.#token !== token || !eligible || !stillEligible || controls.userRevision !== current.userRevision || controls.seekRevision !== current.seekRevision || controls.mediaId !== current.mediaId || controls.coreId !== current.coreId || controls.reloadRevision !== current.reloadRevision || current.dragging) return false;
      if (ownedReload) {
        if (controls.seekRevision !== token.controls.seekRevision) token.restorePosition = false;
        token.controls = { ...controls, coreId: controls.coreId === 0 ? token.controls.coreId : controls.coreId };
      }
      return this.#token === token && eligible && !controls.dragging && !snapshot.ended && !snapshot.mediaError && (!snapshot.paused || token.initiallyPaused || ownedReload) && controls.mediaId === token.controls.mediaId && (controls.coreId === token.controls.coreId || ownedReload) && controls.userRevision === token.controls.userRevision && controls.seekRevision === token.controls.seekRevision;
    }
    #ownedReload(token, controls) {
      const revision = token.reloadRevision;
      return this.#token === token && !!token.reloadingAt && revision !== null && controls.reloadRevision === revision && controls.mediaId === token.controls.mediaId && controls.userRevision === token.controls.userRevision && !controls.dragging && (controls.coreId === token.controls.coreId || controls.coreId === 0 || controls.coreReloadRevision === revision) && this.player.ownedReload?.(revision) === true && this.#token === token;
    }
    #acceptedReloadProgress(token, snapshot, controls) {
      return this.#token === token && token.restored && token.firstProgressAt !== null && token.reloadRevision !== null && this.now() - token.firstProgressAt <= 15e3 && snapshot.available && !snapshot.paused && !snapshot.seeking && !snapshot.ended && !snapshot.mediaError && !controls.dragging && controls.coreId !== 0 && controls.mediaId === token.controls.mediaId && controls.coreId === token.controls.coreId && controls.userRevision === token.controls.userRevision && controls.seekRevision === token.controls.seekRevision && controls.reloadRevision === token.reloadRevision;
    }
    #finish(state, reason = state) {
      const token = this.#token;
      this.#token = null;
      this.#pauseAt = 0;
      this.#unhook();
      this.#state = Object.freeze({
        state,
        reason,
        ...token ? { savedPositionSec: token.savedPositionSec, savedRate: token.savedRate } : {},
        source: token?.source ?? null,
        pauseSec: 0,
        reloadCount: this.#reloadCount,
        breakerSec: Math.max(0, Math.ceil((this.#breakerUntil - this.now()) / 1e3))
      });
      if (token && ["failed", "recovered", "recovered-paused"].includes(state)) this.#emit({
        type: "core",
        at: this.now(),
        state,
        actionId: token.id,
        reason,
        source: token.source,
        savedPositionSec: token.savedPositionSec,
        savedRate: token.savedRate,
        readyState: this.#lastSnapshot?.readyState ?? 0,
        coreInitialized: this.#lastSnapshot?.coreInitialized ?? null
      });
    }
    #emit(event) {
      for (const listener of this.#listeners) listener(event);
    }
  };

  // src-v2/application/player-monitor.ts
  var PlayerMonitor = class {
    constructor(player, session, settings, vault, routes, measurement, recovery, isVisible, now, scheduler) {
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
      this.#snapshot = Object.freeze({
        video: player.snapshot(),
        stableProgressSec: 0,
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
    static {
      __name(this, "PlayerMonitor");
    }
    #timer = null;
    #lastTime = null;
    #stableProgressSec = 0;
    #stallTicks = 0;
    #lastRecoveryAt = 0;
    #seekGraceUntil = 0;
    #manifestTick = 0;
    #manifestReady = false;
    #startupRescueAttempted = false;
    #startupObservedProgress = false;
    #lastFrames = null;
    #startupRescueState = "watching";
    #snapshot;
    #controls = null;
    #lastSeeking = false;
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
      this.#timer?.();
      this.#timer = null;
      this.#endStall();
      this.measurement.cancel("monitor-stop");
    }
    reset() {
      this.#lastTime = null;
      this.#stableProgressSec = 0;
      this.#stallTicks = 0;
      this.#lastRecoveryAt = 0;
      this.#seekGraceUntil = 0;
      this.#manifestTick = 0;
      this.#manifestReady = false;
      this.#startupRescueAttempted = false;
      this.#startupObservedProgress = false;
      this.#lastFrames = null;
      this.#startupRescueState = "watching";
      this.#endStall();
      this.#controls = null;
      this.#lastSeeking = false;
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
      const video = this.player.snapshot(), controls = this.player.controls(), now = this.now(), disabled = this.settings.get().disabled;
      const originalMode = this.routes.isOriginalComparison();
      const visible = this.isVisible();
      this.routes.observePlaybackRate(video.available ? video.playbackRate : 0);
      if (!this.#manifestReady || this.#manifestTick++ % 5 === 0) this.#manifestReady = this.player.syncManifest();
      const controlChanged = this.#controls !== null && (controls.seekRevision !== this.#controls.seekRevision || controls.userRevision !== this.#controls.userRevision || controls.mediaId !== this.#controls.mediaId || controls.coreId !== this.#controls.coreId);
      const advanced = video.available && !video.seeking && !this.#lastSeeking && !video.paused && !video.ended && !video.mediaError && !controlChanged && this.#lastTime !== null && video.currentTime - this.#lastTime > 0.05;
      const newFrames = video.frames !== null && this.#lastFrames !== null && video.frames > this.#lastFrames;
      const progress = advanced && (video.frames === null || newFrames);
      if (progress || !video.seeking && video.playableBufferSec >= 1) {
        this.#startupObservedProgress = true;
        if (!this.#startupRescueAttempted) this.#startupRescueState = "not-needed";
      }
      if (progress) this.#stableProgressSec++;
      else this.#stableProgressSec = 0;
      const recoveryTicked = !disabled && !originalMode && !!this.#stall?.armed && this.recovery.isRecovering();
      if (recoveryTicked) this.recovery.tick(video);
      if (this.#stall?.armed && !this.recovery.isRecovering() && this.recovery.snapshot().reloadCount > this.#stall.reloadCount && ["failed", "breaker", "recovered-paused"].includes(this.recovery.snapshot().state)) {
        this.#failedStall = { userRevision: this.#stall.userRevision, mediaId: this.#stall.mediaId };
      }
      if (progress || this.#failedStall && (this.#failedStall.userRevision !== controls.userRevision || this.#failedStall.mediaId !== controls.mediaId)) this.#failedStall = null;
      const ownedReload = !!this.#stall && this.recovery.ongoingStallReload(this.#stall.id, video, controls);
      const active = !disabled && !originalMode && visible && video.available && (!video.paused || ownedReload) && !video.ended && !video.mediaError && !controls.dragging;
      if (!active) this.#endStall();
      else if (progress) this.#endStall(true);
      else if (!ownedReload && (this.#startupObservedProgress || video.seeking)) this.#observeStall(video, controls, now);
      if (!disabled && !originalMode && !recoveryTicked) this.recovery.tick(video);
      if (this.#stall?.armed && !this.recovery.isRecovering()) this.#stall.finished = true;
      const firstMediaAt = this.routes.firstMediaAt();
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
      } else if (video.seeking && (!this.#stall || now - this.#stall.startedAt < 15e3)) {
        watchdog = "seek-grace";
        this.#stallTicks = 0;
      } else if (this.#stall && now - this.#stall.startedAt >= 15e3) {
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
      if (!this.#stall && !this.#failedStall && !this.recovery.isRecovering() && !controls.dragging && !disabled && !originalMode && visible && watchdog === "recovering" && (this.#startupObservedProgress || !firstMediaAt) && now - this.#lastRecoveryAt >= 3e4) {
        const state = this.session.get(), rep = state.representation;
        if (rep) {
          this.routes.recover(rep, this.#demand(video), "watchdog", state.affinity?.host ?? null);
          this.#lastRecoveryAt = now;
        }
      }
      const startupAge = firstMediaAt ? Math.max(0, now - firstMediaAt) : 0;
      if (!controls.dragging && !disabled && !originalMode && visible && firstMediaAt && startupAge >= 15e3 && !this.#startupRescueAttempted && !this.#startupObservedProgress && video.available && !video.paused && !video.seeking && !video.ended && !video.mediaError && video.playableBufferSec < 1 && (video.readyState <= 1 || video.width === 0 && video.height === 0) && !this.recovery.isRecovering() && now >= this.#seekGraceUntil) {
        const requested = this.routes.latestRequested("video");
        if (requested?.representation && requested.epoch === this.session.get().epoch && requested.generation === this.session.get().generation) {
          this.#startupRescueAttempted = true;
          const fallback = this.routes.recoverStartup(
            requested.representation,
            this.#demand(video),
            requested.targetHost,
            this.measurement.startupFallbackHosts?.() ?? []
          );
          this.#startupRescueState = fallback ? "fallback-submitted" : "no-alternative";
          if (fallback) this.recovery.armStartupFailure(video);
        }
      }
      const demand = this.#demand(video);
      this.measurement.tick({
        generationActive: true,
        representation: this.session.get().representation,
        demand,
        stableProgressSec: this.#stableProgressSec,
        playableBufferSec: video.playableBufferSec,
        visible,
        seeking: video.seeking || now < this.#seekGraceUntil,
        recovering: this.recovery.isRecovering(),
        disabled: disabled || originalMode
      });
      this.#lastTime = video.available ? video.currentTime : null;
      this.#lastFrames = video.frames;
      this.#lastSeeking = video.seeking;
      this.#controls = controls;
      if (!active) {
        this.#lastTime = null;
        this.#lastFrames = null;
      }
      this.#snapshot = Object.freeze({
        video,
        stableProgressSec: this.#stableProgressSec,
        watchdog,
        stallTicks: this.#stallTicks,
        startupRescue: { state: this.#startupRescueState, ageSec: Math.floor(startupAge / 1e3) }
      });
      for (const listener of this.#listeners) listener(this.#snapshot);
    }
    #endStall(progress = false) {
      if (this.#stall) {
        this.#stall.progressEnded = progress;
        if (!progress) this.recovery.cancelStall(this.#stall.id);
      }
      this.#stall = null;
    }
    #observeStall(video, controls, now) {
      if (this.#failedStall) return;
      const requested = this.routes.latestRequested("video"), state = this.session.get();
      if (this.#stall && (this.#stall.userRevision !== controls.userRevision || this.#controls?.mediaId !== controls.mediaId)) this.#endStall();
      if (!this.#stall) this.#stall = {
        id: ++this.#stallSerial,
        startedAt: now,
        userRevision: controls.userRevision,
        mediaId: controls.mediaId,
        seekRevision: controls.seekRevision,
        targetSec: video.currentTime,
        request: requested,
        fallbackAttempted: false,
        armed: false,
        finished: false,
        progressEnded: false,
        reloadCount: this.recovery.snapshot().reloadCount
      };
      const stall = this.#stall;
      if (this.recovery.snapshot().reloadCount > stall.reloadCount) stall.finished = true;
      const rebound = stall.seekRevision !== controls.seekRevision || stall.request?.representation !== requested?.representation || stall.request?.authorityRevision !== requested?.authorityRevision || stall.request?.routePolicyRevision !== requested?.routePolicyRevision;
      if (rebound) {
        this.recovery.cancelStall(stall.id);
        stall.finished ||= this.recovery.snapshot().reloadCount > stall.reloadCount;
        stall.armed = false;
        stall.seekRevision = controls.seekRevision;
        stall.request = requested;
        stall.targetSec = video.currentTime;
      }
      if (video.seeking) stall.targetSec = video.currentTime;
      if (now - stall.startedAt < 15e3 || stall.finished || stall.armed) return;
      if (!requested?.representation || requested.generation !== state.generation || requested.epoch !== state.epoch || !this.routes.recoveryEligible(requested)) {
        stall.finished = true;
        this.recovery.rejectStall();
        return;
      }
      const request = requested, revision = controls.seekRevision, mediaId = controls.mediaId;
      const valid = /* @__PURE__ */ __name(() => {
        const current = this.player.controls(), latest = this.routes.latestRequested("video");
        if (this.#stall !== stall && !stall.progressEnded || !this.isVisible() || this.settings.get().disabled || this.routes.isOriginalComparison() || current.userRevision !== stall.userRevision || current.mediaId !== mediaId) return false;
        if (this.recovery.ongoingStallReload(stall.id, this.player.snapshot(), current)) return !!latest && latest.generation === request.generation && latest.epoch === request.epoch && latest.routePolicyRevision === request.routePolicyRevision && this.routes.recoveryEligible(latest);
        return current.seekRevision === revision && latest?.representation === request.representation && this.routes.recoveryEligible(request);
      }, "valid");
      stall.armed = true;
      this.recovery.armStall(video, { id: stall.id, startedAt: stall.startedAt, targetSec: stall.targetSec, valid });
      if (!stall.fallbackAttempted) {
        stall.fallbackAttempted = true;
        this.routes.recover(requested.representation, this.#demand(video), "watchdog", requested.targetHost);
      }
    }
    #demand(video) {
      const rep = this.routes.latestRequested("video")?.representation ?? this.session.get().representation, summary = rep ? this.vault.groupSummary(rep) : null;
      const base = summary?.bandwidth ? summary.bandwidth / 1e6 : summary?.kind === "audio" ? 0.192 : 4;
      const kind = summary?.kind ?? "video", requiredMbps = Math.max(kind === "audio" ? 0.5 : 2, base * video.effectiveRate * 1.25);
      return { kind, requiredMbps, highDemand: requiredMbps >= 12 };
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
    #listeners = /* @__PURE__ */ new Set();
    #restores = [];
    #pending = null;
    #pageKey = "";
    #active = false;
    subscribe(listener) {
      this.#listeners.add(listener);
      return () => this.#listeners.delete(listener);
    }
    start() {
      if (this.#restores.length) return;
      this.#active = true;
      this.#pageKey = this.navigation.key();
      this.#beginGeneration("startup");
      this.pagePlayinfo.install();
      this.#restores.push(this.navigation.subscribe(() => this.#checkNavigation()));
      this.#restores.push(this.settings.subscribe((state) => {
        if (state.disabled !== this.session.get().disabled) this.#beginGeneration(state.disabled ? "disabled" : "enabled");
      }));
    }
    acceptPageAssignment(payload, serial) {
      if (!this.#active) return false;
      this.#pending = { payload, serial, assignedAt: this.now(), pageKey: this.#pageKey, appliedGeneration: -1 };
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
      this.#listeners.clear();
    }
    #checkNavigation() {
      const key = this.navigation.key();
      if (key === this.#pageKey) return;
      this.#pageKey = key;
      this.#beginGeneration("spa");
      this.#applyPending();
    }
    #beginGeneration(reason) {
      const state = this.session.beginGeneration(this.settings.get().disabled);
      this.vault.reset(state.generation, state.epoch);
      this.routes.resetEpoch();
      this.monitor.reset();
      if (state.disabled) this.monitor.stop();
      else this.monitor.start();
      this.#emit({ type: "lifecycle", at: this.now(), generation: state.generation, epoch: state.epoch, reason });
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
    #emit(event) {
      for (const listener of this.#listeners) listener(event);
    }
  };

  // src-v2/adapters/playurl.ts
  var isRecord = /* @__PURE__ */ __name((value) => !!value && typeof value === "object" && !Array.isArray(value), "isRecord");
  var finite2 = /* @__PURE__ */ __name((value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0, "finite");
  var text = /* @__PURE__ */ __name((value) => typeof value === "string" ? value : "", "text");
  var baseUrl = /* @__PURE__ */ __name((item) => text(item.baseUrl || item.base_url), "baseUrl");
  var backupUrls = /* @__PURE__ */ __name((item) => {
    const value = item.backupUrl || item.backup_url;
    return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
  }, "backupUrls");
  var codecName = /* @__PURE__ */ __name((item) => {
    const codec = text(item.codecs || item.codec).toLowerCase();
    const id = finite2(item.codecid || item.codec_id || item.codecId);
    if (codec.includes("av01") || id === 13) return "av1";
    if (codec.includes("hev1") || codec.includes("hvc1") || id === 12) return "hevc";
    if (codec.includes("avc1") || id === 7) return "avc";
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
      const formats = [], video = [], audio = [], sorts = [];
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
        return {
          token: item,
          key: progressive ? `${branch}:${format}:${finite2(item.quality)}:${index}` : `${branch ? branch + ":" : ""}${String(item.id ?? index)}:${codecName(item)}:${finite2(item.height)}`,
          height: finite2(item.height),
          codec: progressive ? format ?? "other" : codecName(item),
          bandwidth: finite2(item.bandwidth),
          primary,
          urls: [primary, ...backupUrls(item)].filter(Boolean),
          ...progressive ? { progressive: true } : {}
        };
      }, "normalize");
      const records = /* @__PURE__ */ __name((value, required = false) => {
        if ((value === void 0 || value === null) && !required) return [];
        if (!Array.isArray(value) || value.some((item) => !isRecord(item))) {
          failure = "malformed-payload";
          return [];
        }
        return value;
      }, "records");
      const collect = /* @__PURE__ */ __name((data, branch, depth) => {
        if (visited.has(data)) return;
        visited.add(data);
        if ("dash" in data) {
          if (!isRecord(data.dash)) failure = "malformed-payload";
          else {
            const dash = data.dash, videos = records(dash.video), audios = records(dash.audio);
            const dashBranch = branch === primaryBranch || branch === `${primaryBranch}.video_info` ? "" : `${branch}.dash`;
            addFormat("dash");
            sorts.push(videos);
            video.push(...videos.map((item, index) => normalize(item, index, dashBranch)));
            audio.push(...audios.map((item, index) => normalize(item, index, dashBranch)));
            for (const key of ["dolby", "flac"]) {
              const variant = isRecord(dash[key]) ? dash[key] : null, nested = variant?.audio;
              const items = isRecord(nested) ? [nested] : records(nested);
              audio.push(...items.map((item, index) => normalize(item, index, `${dashBranch}.${key}`)));
            }
          }
        }
        if ("durl" in data) {
          const segments = records(data.durl, true);
          if (!segments.length) failure = "malformed-payload";
          for (const [index, item] of segments.entries()) {
            if (typeof item.url !== "string" || !item.url || "backup_url" in item && !Array.isArray(item.backup_url) || "backupUrl" in item && !Array.isArray(item.backupUrl)) {
              failure = "malformed-payload";
              continue;
            }
            const declared = text(data.format).toLowerCase(), parsed = parseMediaUrl(item.url);
            const extension = parsed?.url.pathname.match(/\.(mp4|flv)$/i)?.[1]?.toLowerCase();
            const format = extension === "mp4" || extension === "flv" ? extension : declared.startsWith("mp4") ? "mp4" : declared.startsWith("flv") ? "flv" : null;
            if (!format || declared && !declared.startsWith("mp4") && !declared.startsWith("flv")) {
              failure = "unsupported-format";
              continue;
            }
            addFormat(format);
            segmentCount++;
            const entry = normalize(item, index, `${branch}.durl:${finite2(data.quality)}`, true, format);
            video.push(entry);
            if (this.controller.catalogOnly() && !entry.urls.some((url) => parseMediaUrl(url)?.replaceable)) failure = "unreplaceable-source";
          }
        }
        if (depth < 2) {
          for (const key of ["data", "result", "video_info"]) if (isRecord(data[key])) collect(data[key], `${branch}.${key}`, depth + 1);
        }
      }, "collect");
      collect(root, "root", 0);
      if (failure) return result(failure);
      if (video.length > 128 || audio.length > 64) return result("malformed-payload");
      if (!video.length && !audio.length) return result("unsupported-format");
      const outputs = this.controller.ingest({ token: root, video, audio }, source, responseKey, context);
      if (!outputs) return result(this.controller.active() ? "no-legal-route" : "inactive");
      if (this.controller.catalogOnly() && outputs.some((output) => !output.primary)) {
        if (!segmentCount) {
          for (const output of outputs) if (isRecord(output.token)) rewriteItem(output.token, output.primary, output.backups);
        }
        return result("no-legal-route");
      }
      if (segmentCount && outputs.some((output) => !output.primary && video.some((item) => item.progressive && item.token === output.token))) return result("no-legal-route");
      for (const output of outputs) if (isRecord(output.token)) rewriteItem(output.token, output.primary, output.backups);
      for (const items of sorts) this.#sortCodecGroups(items, this.controller.codecPreference());
      return result(null);
    }
    #sortCodecGroups(items, preference) {
      if (preference === "auto" || items.length < 2) return;
      const rank = /* @__PURE__ */ __name((codec) => {
        const order = {
          av1: ["av1", "hevc", "avc", "other"],
          hevc: ["hevc", "av1", "avc", "other"],
          avc: ["avc", "hevc", "av1", "other"]
        };
        const index = order[preference].indexOf(codec);
        return index < 0 ? 99 : index;
      }, "rank");
      const positions = /* @__PURE__ */ new Map();
      items.forEach((item, index) => {
        const key = String(item.id ?? item.quality ?? index);
        if (!positions.has(key)) positions.set(key, positions.size);
      });
      items.sort((a, b) => {
        const aKey = String(a.id ?? a.quality ?? ""), bKey = String(b.id ?? b.quality ?? "");
        const group = (positions.get(aKey) ?? 0) - (positions.get(bKey) ?? 0);
        return group || rank(codecName(a)) - rank(codecName(b));
      });
    }
  };

  // src-v2/adapters/player.ts
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
        if (!sameDescriptor(Object.getOwnPropertyDescriptor(target, name), installed) || target[name] !== wrapped || !sameDescriptor(Object.getOwnPropertyDescriptor(target, name), installed)) return;
        if (!before && installed) Reflect.deleteProperty(target, name);
        else if (before && "value" in before) Object.defineProperty(target, name, before);
        else target[name] = original;
      } catch {
      }
    };
  }, "observeMethod");
  var PlayerAdapter = class {
    constructor(playurl, environment) {
      this.playurl = playurl;
      this.environment = environment;
    }
    playurl;
    environment;
    static {
      __name(this, "PlayerAdapter");
    }
    #cachedVideo = null;
    #manifestFingerprint = "";
    #objects = /* @__PURE__ */ new WeakMap();
    #objectSerial = 0;
    #seekRevision = 0;
    #userRevision = 0;
    #drag = null;
    #pointerRevision = 0;
    #targetSec = null;
    #internalSeek = 0;
    #pendingSeek = null;
    #controlStops = [];
    #controlVideo = null;
    #seekOwner = null;
    #reloadRevision = 0;
    #coreReloadRevision = 0;
    #internalReload = 0;
    #reloadCore = null;
    #awaitReloadCore = false;
    #keyboardSeek = null;
    #keyboardPlayback = null;
    #keyboardRevision = 0;
    #ownedReload = null;
    player() {
      try {
        return isRecord2(unsafeWindow.player) ? unsafeWindow.player : null;
      } catch {
        return null;
      }
    }
    controls() {
      const reloadOwner = this.#ownedReload;
      const video = this.video(), player = this.player(), core = safeCall(player, "__core");
      if (video !== this.#controlVideo || player !== this.#seekOwner) this.#observeControls(video, player);
      this.#validateDrag();
      this.#confirmKeyboardSeek();
      this.#confirmKeyboardPlayback();
      if (video?.seeking && Number.isFinite(video.currentTime) && video.currentTime !== this.#targetSec) {
        this.#targetSec = video.currentTime;
        if (!this.#internalSeek && this.#pendingSeek !== video.currentTime) this.#seekRevision++;
      }
      const identity = /* @__PURE__ */ __name((object) => {
        if (!object || typeof object !== "object" && typeof object !== "function") return 0;
        let id = this.#objects.get(object);
        if (id === void 0) {
          id = ++this.#objectSerial;
          this.#objects.set(object, id);
        }
        return id;
      }, "identity");
      if (reloadOwner) this.#validateOwnedReload(video, player, core, reloadOwner);
      else if (!this.#ownedReload && !this.#awaitReloadCore && core !== this.#reloadCore) this.#coreReloadRevision = 0;
      this.#reloadCore = core;
      return Object.freeze({
        mediaId: identity(video),
        coreId: identity(core),
        seekRevision: this.#seekRevision,
        userRevision: this.#userRevision,
        dragging: this.#drag !== null,
        targetSec: this.#targetSec,
        reloadRevision: this.#reloadRevision,
        coreReloadRevision: this.#coreReloadRevision
      });
    }
    #observeControls(video, player) {
      this.#clearControls();
      this.#controlVideo = video;
      this.#seekOwner = player;
      if (!video) return;
      const listen = /* @__PURE__ */ __name((target, type, listener) => {
        target.addEventListener(type, listener, true);
        this.#controlStops.push(() => target.removeEventListener(type, listener, true));
      }, "listen");
      const region = video.closest(".bpx-player-container, .bilibili-player") ?? video.parentElement;
      const inRegion = /* @__PURE__ */ __name((event) => event.target instanceof Node && !!region?.contains(event.target), "inRegion");
      listen(document, "pointerdown", (event) => {
        if (!event.isTrusted) return;
        const revision = ++this.#pointerRevision;
        if (!this.environment.isActuallyVisible() || !inRegion(event) || revision !== this.#pointerRevision) return;
        this.#clearKeyboardSeek();
        this.#clearKeyboardPlayback();
        this.#advanceUser();
        const lifecycle = this.playurl.lifecycleKey();
        const hit = event.target instanceof Element ? event.target.closest('.bpx-player-progress-wrap, .bpx-player-progress, .bilibili-player-video-progress, [role="slider"]') : null;
        if (!hit || !region?.contains(hit) || typeof PointerEvent !== "function" || !(event instanceof PointerEvent)) return;
        const pointerId = event.pointerId;
        if (!Number.isInteger(pointerId)) return;
        const current = video === this.video() && player === this.player() && lifecycle === this.playurl.lifecycleKey() && this.environment.isActuallyVisible();
        if (!current || video !== this.#controlVideo || player !== this.#seekOwner || revision !== this.#pointerRevision) return;
        this.#drag = { pointerId, video, player, lifecycle };
      });
      const release = /* @__PURE__ */ __name((event) => {
        const drag = this.#drag;
        if (!drag || !event.isTrusted || typeof PointerEvent !== "function" || !(event instanceof PointerEvent) || event.pointerId !== drag.pointerId) return;
        if (this.#drag === drag) {
          this.#drag = null;
          this.#pointerRevision++;
        }
      }, "release");
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) listen(document, type, release);
      const controlLoss = /* @__PURE__ */ __name(() => {
        this.#drag = null;
        this.#pointerRevision++;
        this.#clearKeyboardSeek();
        this.#clearKeyboardPlayback();
        this.#clearOwnedReload();
      }, "controlLoss");
      listen(window, "blur", (event) => {
        if (event.isTrusted) controlLoss();
      });
      this.#controlStops.push(this.environment.subscribeControlLoss(controlLoss));
      const observeKeyboard = /* @__PURE__ */ __name((event) => {
        const revision = ++this.#keyboardRevision;
        this.#clearKeyboardSeek();
        this.#clearKeyboardPlayback();
        if (!(event instanceof KeyboardEvent) || !event.isTrusted || event.isComposing || event.keyCode === 229 || event.ctrlKey || event.metaKey || event.altKey || !this.environment.isActuallyVisible()) return;
        const editable = /* @__PURE__ */ __name((target) => target instanceof Element && (!!target.closest('input, textarea, select, [role="textbox"], #bilicdn-v2-control-center') || target instanceof HTMLElement && target.isContentEditable), "editable");
        if (event.composedPath().some(editable) || event.target && editable(event.target)) return;
        if (["ArrowLeft", "ArrowRight", "Home", "End", "j", "J", "l", "L"].includes(event.key)) {
          this.#beginKeyboardSeek(event, video, player);
        } else if (event.type === "keydown" && ["ArrowUp", "ArrowDown", " ", "k", "K"].includes(event.key)) {
          const inside = inRegion(event);
          if (revision !== this.#keyboardRevision) return;
          if (inside) this.#advanceUser();
          else this.#beginKeyboardPlayback(event, video, player, revision);
        }
      }, "observeKeyboard");
      for (const type of ["keydown", "keyup"]) listen(document, type, observeKeyboard);
      listen(video, "seeking", () => {
        const position = Number.isFinite(video.currentTime) ? video.currentTime : null;
        if (!this.#internalSeek && position !== this.#pendingSeek) this.#seekRevision++;
        this.#targetSec = position;
        this.#confirmKeyboardSeek();
      });
      listen(video, "seeked", () => {
        this.#pendingSeek = null;
      });
      const original = player?.seek, adapter = this;
      const reload = player?.reload;
      if (player && typeof reload === "function") {
        const wrapped = /* @__PURE__ */ __name(function(...args) {
          if (!adapter.#internalReload) {
            adapter.#seekRevision++;
            adapter.#clearOwnedReload();
          }
          return Reflect.apply(reload, this, args);
        }, "wrapped");
        try {
          this.#controlStops.push(observeMethod(player, "reload", reload, wrapped));
        } catch {
        }
      }
      if (player && typeof original === "function") {
        const wrapped = /* @__PURE__ */ __name(function(...args) {
          if (!adapter.#internalSeek) {
            adapter.#seekRevision++;
            adapter.#pendingSeek = null;
            adapter.#targetSec = typeof args[0] === "number" && Number.isFinite(args[0]) ? Math.max(0, args[0]) : null;
          }
          try {
            return Reflect.apply(original, this, args);
          } finally {
            adapter.#confirmKeyboardSeek();
          }
        }, "wrapped");
        try {
          this.#controlStops.push(observeMethod(player, "seek", original, wrapped));
        } catch {
        }
      }
    }
    #beginKeyboardSeek(event, video, player) {
      if (!Number.isFinite(video.currentTime)) return;
      const candidate = {
        event,
        video,
        player,
        lifecycle: this.playurl.lifecycleKey(),
        position: video.currentTime,
        stop: /* @__PURE__ */ __name(() => void 0, "stop")
      };
      this.#keyboardSeek = candidate;
      const type = event.type;
      const finish = /* @__PURE__ */ __name((observed) => {
        if (observed === event && this.#keyboardSeek === candidate) this.#confirmKeyboardSeek();
      }, "finish");
      window.addEventListener(type, finish);
      const cancel = this.environment.scheduler.timeout(() => {
        if (this.#keyboardSeek === candidate) this.#clearKeyboardSeek();
      }, 0);
      candidate.stop = () => {
        cancel();
        window.removeEventListener(type, finish);
      };
    }
    #confirmKeyboardSeek() {
      const candidate = this.#keyboardSeek;
      if (!candidate) return;
      try {
        if (candidate.event.eventPhase === Event.NONE || candidate.video !== this.#controlVideo || candidate.player !== this.#seekOwner || candidate.video !== this.video() || candidate.player !== this.player() || candidate.lifecycle !== this.playurl.lifecycleKey() || !this.environment.isActuallyVisible()) {
          this.#clearKeyboardSeek();
          return;
        }
        if (this.#internalSeek || !candidate.video.seeking || !Number.isFinite(candidate.video.currentTime) || candidate.video.currentTime === candidate.position || candidate.video.currentTime === this.#pendingSeek) return;
        if (this.#targetSec !== candidate.video.currentTime) this.#seekRevision++;
        this.#targetSec = candidate.video.currentTime;
        this.#advanceUser();
        this.#clearKeyboardSeek();
      } catch {
        this.#clearKeyboardSeek();
      }
    }
    #clearKeyboardSeek() {
      const candidate = this.#keyboardSeek;
      this.#keyboardSeek = null;
      candidate?.stop();
    }
    #beginKeyboardPlayback(event, video, player, revision) {
      const candidate = {
        event,
        video,
        player,
        core: safeCall(player, "__core"),
        lifecycle: this.playurl.lifecycleKey(),
        paused: video.paused,
        rate: video.playbackRate,
        kind: [" ", "k", "K"].includes(event.key) ? "pause" : "rate",
        revision,
        stop: /* @__PURE__ */ __name(() => void 0, "stop")
      };
      if (revision !== this.#keyboardRevision || video !== this.#controlVideo || player !== this.#seekOwner) return;
      this.#keyboardPlayback = candidate;
      const finish = /* @__PURE__ */ __name((observed) => {
        if (observed === event && this.#keyboardPlayback === candidate) this.#confirmKeyboardPlayback();
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
        const eligible = candidate.event.eventPhase !== Event.NONE && candidate.revision === this.#keyboardRevision && candidate.video === this.#controlVideo && candidate.player === this.#seekOwner && candidate.video === this.video() && candidate.player === this.player() && candidate.core === safeCall(candidate.player, "__core") && candidate.lifecycle === this.playurl.lifecycleKey() && this.environment.isActuallyVisible();
        const changed = candidate.kind === "pause" ? candidate.video.paused !== candidate.paused : Number.isFinite(candidate.video.playbackRate) && candidate.video.playbackRate !== candidate.rate;
        if (this.#keyboardPlayback !== candidate || candidate.revision !== this.#keyboardRevision) return;
        if (!eligible) {
          this.#clearKeyboardPlayback();
          return;
        }
        if (changed) {
          this.#advanceUser();
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
    #advanceUser() {
      this.#userRevision++;
      this.#clearOwnedReload();
    }
    #clearOwnedReload() {
      const owner = this.#ownedReload;
      this.#ownedReload = null;
      this.#awaitReloadCore = false;
      this.#coreReloadRevision = 0;
      owner?.cancel();
    }
    #validateOwnedReload(video, player, core, owner) {
      if (this.#ownedReload !== owner) return;
      const valid = video === owner.video && player === owner.player && owner.revision === this.#reloadRevision && owner.lifecycle === this.playurl.lifecycleKey() && owner.userRevision === this.#userRevision && this.environment.isActuallyVisible();
      if (this.#ownedReload !== owner) return;
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
      this.#coreReloadRevision = owner.revision;
      this.#awaitReloadCore = false;
    }
    ownedReload(revision) {
      this.#confirmKeyboardPlayback();
      const owner = this.#ownedReload;
      if (!owner || owner.revision !== revision) return false;
      this.#validateOwnedReload(this.video(), this.player(), safeCall(owner.player, "__core"), owner);
      return this.#ownedReload === owner;
    }
    #validateDrag() {
      const drag = this.#drag;
      if (!drag) return;
      if (drag.video !== this.#controlVideo || drag.player !== this.#seekOwner || drag.video !== this.video() || drag.player !== this.player() || drag.lifecycle !== this.playurl.lifecycleKey() || !this.environment.isActuallyVisible()) {
        if (this.#drag === drag) {
          this.#drag = null;
          this.#pointerRevision++;
        }
      }
    }
    #clearControls() {
      this.#clearKeyboardSeek();
      this.#clearKeyboardPlayback();
      this.#keyboardRevision++;
      this.#clearOwnedReload();
      for (const stop of this.#controlStops.splice(0).reverse()) stop();
      this.#controlVideo = null;
      this.#seekOwner = null;
      this.#drag = null;
      this.#pointerRevision++;
      this.#pendingSeek = null;
    }
    observePlayIntent(listener) {
      const target = this.player(), original = target?.play;
      if (!target || typeof original !== "function") return () => void 0;
      const wrapped = /* @__PURE__ */ __name(function(...args) {
        let active = false;
        try {
          active = unsafeWindow.navigator.userActivation?.isActive === true;
        } catch {
        }
        if (active) listener();
        return Reflect.apply(original, this, args);
      }, "wrapped");
      try {
        return observeMethod(target, "play", original, wrapped);
      } catch {
        return () => void 0;
      }
    }
    video() {
      if (this.#cachedVideo?.isConnected && this.#area(this.#cachedVideo) > 0) return this.#cachedVideo;
      const videos = [...document.querySelectorAll("video")];
      const connected = videos.filter((video) => video.isConnected);
      const best = connected.sort((a, b) => this.#area(b) - this.#area(a))[0] ?? null;
      if (best && this.#area(best) > 0) this.#cachedVideo = best;
      else if (!this.#cachedVideo?.isConnected) this.#cachedVideo = best;
      return this.#cachedVideo;
    }
    snapshot() {
      const video = this.video(), player = this.player(), core = safeCall(player, "__core");
      let coreInitialized = null, manifestHasVideo = false;
      try {
        const value = isRecord2(core) && isRecord2(core.state) ? core.state.initialized : null;
        coreInitialized = typeof value === "boolean" ? value : null;
      } catch {
      }
      const mpd = safeCall(core, "getMpd");
      if (isRecord2(mpd)) manifestHasVideo = Array.isArray(mpd.video) && mpd.video.length > 0;
      if (!video) return {
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
    syncManifest() {
      const player = this.player(), core = safeCall(player, "__core"), mpd = safeCall(core, "getMpd");
      if (!isRecord2(mpd)) return false;
      const cloned = this.#cloneMpd(mpd);
      if (!cloned) return false;
      const fingerprint = `${this.playurl.lifecycleKey()}:${JSON.stringify(cloned)}`;
      if (fingerprint === this.#manifestFingerprint) return true;
      const accepted = this.playurl.transform({ code: 0, data: { dash: cloned } }, "player-mpd").accepted;
      if (accepted) this.#manifestFingerprint = fingerprint;
      return accepted;
    }
    reload() {
      this.#clearKeyboardPlayback();
      const userRevision = this.#userRevision, beforeRevision = this.#reloadRevision;
      const player = this.player(), video = this.video(), lifecycle = this.playurl.lifecycleKey();
      const sourceCore = safeCall(player, "__core"), reload = player?.reload;
      if (!player || typeof reload !== "function") throw new Error("player.reload unavailable");
      const currentPlayer = this.player(), currentVideo = this.video(), currentCore = safeCall(player, "__core");
      const visible = this.environment.isActuallyVisible(), currentLifecycle = this.playurl.lifecycleKey();
      if (userRevision !== this.#userRevision || beforeRevision !== this.#reloadRevision || currentPlayer !== player || currentVideo !== video || currentCore !== sourceCore || currentLifecycle !== lifecycle || !visible) {
        throw new Error("player.reload ownership ended");
      }
      this.#clearOwnedReload();
      this.#reloadCore = sourceCore;
      const revision = ++this.#reloadRevision;
      const owner = video ? {
        revision,
        video,
        player,
        lifecycle,
        userRevision,
        sourceCore: this.#reloadCore,
        replacement: null,
        sawNull: false,
        cancel: /* @__PURE__ */ __name(() => void 0, "cancel")
      } : null;
      this.#ownedReload = owner;
      this.#awaitReloadCore = owner !== null;
      if (owner) owner.cancel = this.environment.scheduler.timeout(() => {
        if (this.#ownedReload === owner) this.#clearOwnedReload();
      }, 15e3);
      if (this.#ownedReload !== owner || this.#reloadRevision !== revision || this.#userRevision !== userRevision) {
        if (this.#ownedReload === owner) this.#clearOwnedReload();
        throw new Error("player.reload ownership ended");
      }
      this.#internalReload++;
      try {
        const result = Reflect.apply(reload, player, []);
        if (result && (typeof result === "object" || typeof result === "function")) void Promise.resolve(result).catch(() => {
          if (this.#ownedReload === owner) this.#clearOwnedReload();
        });
        return result;
      } catch (error) {
        if (this.#ownedReload === owner) this.#clearOwnedReload();
        throw error;
      } finally {
        this.#internalReload--;
      }
    }
    currentTime() {
      return safeNumber(safeCall(this.player(), "getCurrentTime")) ?? this.snapshot().currentTime;
    }
    playbackRate() {
      const rate = safeNumber(safeCall(this.player(), "getPlaybackRate"));
      return rate !== null && rate > 0 ? rate : this.snapshot().playbackRate;
    }
    seek(value) {
      this.#clearKeyboardSeek();
      this.#clearKeyboardPlayback();
      this.#internalSeek++;
      this.#pendingSeek = value;
      try {
        const player = this.player(), method = player?.seek;
        if (player && typeof method === "function") {
          Reflect.apply(method, player, [value]);
          return;
        }
        const video = this.video();
        if (video) video.currentTime = value;
      } finally {
        this.#internalSeek--;
      }
    }
    setRate(value) {
      this.#clearKeyboardPlayback();
      const player = this.player(), method = player?.setPlaybackRate;
      if (player && typeof method === "function") {
        try {
          Reflect.apply(method, player, [value]);
          return;
        } catch {
        }
      }
      const video = this.video();
      if (video) video.playbackRate = value;
    }
    play() {
      this.#clearKeyboardPlayback();
      const player = this.player();
      if (!player || typeof player.play !== "function") throw new Error("player.play unavailable");
      return Reflect.apply(player.play, player, []);
    }
    reset() {
      this.#clearControls();
      this.#awaitReloadCore = false;
      this.#coreReloadRevision = 0;
      this.#seekRevision++;
      this.#userRevision++;
      this.#targetSec = null;
      this.#cachedVideo = null;
      this.#manifestFingerprint = "";
    }
    #area(video) {
      return Math.max(0, video.clientWidth) * Math.max(0, video.clientHeight);
    }
    #cloneMpd(mpd) {
      const cloneList = /* @__PURE__ */ __name((value, limit) => (Array.isArray(value) ? value : []).slice(0, limit).flatMap((item) => {
        if (!isRecord2(item)) return [];
        const base = typeof item.baseUrl === "string" ? item.baseUrl : typeof item.base_url === "string" ? item.base_url : typeof item.url === "string" ? item.url : "";
        const backups = Array.isArray(item.backupUrl) ? item.backupUrl : Array.isArray(item.backup_url) ? item.backup_url : [];
        const urls = [base, ...backups].filter((url) => typeof url === "string" && url.length > 0 && url.length <= 16 * 1024).slice(0, 4);
        if (!urls.length) return [];
        return [{
          base_url: urls[0],
          backup_url: urls.slice(1),
          id: item.id,
          codecid: item.codecid ?? item.codecId,
          codecs: item.codecs ?? item.codec,
          width: item.width,
          height: item.height,
          bandwidth: item.bandwidth ?? item.bitrate
        }];
      }), "cloneList");
      const video = cloneList(mpd.video, 128), audio = cloneList(mpd.audio, 64);
      return video.length || audio.length ? { video, audio } : null;
    }
  };

  // src-v2/adapters/page-playinfo.ts
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

  // src-v2/adapters/transport-context.ts
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
  var blockedPlayurl = /* @__PURE__ */ __name(() => ({ code: -1, message: "BiliCDN Catalog route unavailable" }), "blockedPlayurl");
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
        Object.defineProperty(target, key, { configurable: true, enumerable: true, value: source[key] });
      } catch {
      }
    }
    return target;
  }, "copyResponseSurface");
  var TransportContext = class {
    constructor(session, settings, routes, playurl, measurement, now, ids) {
      this.session = session;
      this.settings = settings;
      this.routes = routes;
      this.playurl = playurl;
      this.measurement = measurement;
      this.now = now;
      this.ids = ids;
    }
    session;
    settings;
    routes;
    playurl;
    measurement;
    now;
    ids;
    static {
      __name(this, "TransportContext");
    }
    #requestSerial = 0;
    #stats = { enteredFetch: 0, enteredXhr: 0, mediaRecognized: 0, nativeCalled: 0, responseObserved: 0, blocked: 0 };
    #lastMedia = null;
    #lastBlocked = null;
    #lastPlayurl = null;
    count(stage) {
      this.#stats[stage]++;
    }
    dispatchFailure(input) {
      const strict = input.managedMedia && this.routes.isCatalogOnly();
      if (strict && !this.session.isGeneration(input.generation)) return "catalog-unavailable";
      const applied = input.applied;
      if (applied?.decision.action === "block") return applied.decision.reason;
      if (applied && !applied.url) return "catalog-unavailable";
      if (strict && (!catalogTarget(applied) || !sameUrl(applied?.url ?? "", input.targetUrl))) return "catalog-unavailable";
      return null;
    }
    blocked(method, url, reason) {
      this.#stats.blocked++;
      this.#lastBlocked = Object.freeze({ method, host: hostOf(url), reason });
    }
    nextResponseKey(prefix) {
      return `${prefix}-${++this.#requestSerial}`;
    }
    notePlayurl(transport, status, result) {
      const count = /* @__PURE__ */ __name((value) => Number.isFinite(value) ? Math.max(0, Math.min(65535, Math.trunc(value))) : 0, "count");
      const reasons = [
        "upstream-error",
        "unsupported-format",
        "malformed-payload",
        "unreplaceable-source",
        "no-legal-route",
        "inactive"
      ];
      this.#lastPlayurl = Object.freeze({
        transport,
        status: Number.isInteger(status) && status >= 0 && status <= 599 ? status : 0,
        observedAt: this.now(),
        accepted: result.accepted === true,
        formats: Object.freeze([...new Set(result.formats.filter((format) => ["dash", "mp4", "flv"].includes(format)))].slice(0, 3)),
        videoCount: count(result.videoCount),
        audioCount: count(result.audioCount),
        segmentCount: count(result.segmentCount),
        upstreamCode: Number.isSafeInteger(result.upstreamCode) ? result.upstreamCode : null,
        reason: result.reason !== null && reasons.includes(result.reason) ? result.reason : null
      });
    }
    snapshot() {
      return Object.freeze({
        ...this.#stats,
        lastMediaRequest: this.#lastMedia ? Object.freeze({ ...this.#lastMedia }) : null,
        lastBlocked: this.#lastBlocked,
        lastPlayurl: this.#lastPlayurl
      });
    }
    request(applied, originalUrl, targetUrl, startedAt, method) {
      const state = this.session.get(), matched = applied.attributionStatus ?? (applied.context ? "matched" : "waiting-data");
      const request = Object.freeze({
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
        startedAt
      });
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
      if (request && this.#lastMedia?.requestId === request.requestId) this.#lastMedia.nativeCalled = true;
    }
    noteResponse(request, status) {
      if (request && this.#lastMedia?.requestId === request.requestId) {
        this.#lastMedia.responseObserved = true;
        this.#lastMedia.status = status;
      }
    }
    async observeFetch(request, applied, originalUrl, targetUrl, response, startedAt, responseAt, bytes2, outcome, failureKind) {
      const finalUrl = response?.url || "";
      await this.routes.observe(this.observation(
        request,
        applied,
        originalUrl,
        targetUrl,
        finalUrl,
        response?.status ?? 0,
        bytes2,
        startedAt,
        responseAt,
        outcome,
        failureKind,
        !!response && !response.redirected && sameUrl(finalUrl, targetUrl)
      ));
    }
    observation(request, applied, originalUrl, targetUrl, finalUrl, status, bytes2, startedAt, responseAt, outcome, failureKind, responseUrlMatchesRequest = false) {
      const completedAt = this.now(), kind = request.kind;
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
        bytes: bytes2,
        ttfbMs: responseAt > 0 ? responseAt - startedAt : null,
        elapsedMs: Math.max(1, completedAt - startedAt),
        completedAt,
        outcome,
        ...failureKind ? { failureKind } : {}
      };
    }
  };

  // src-v2/adapters/fetch-hook.ts
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
          const response2 = await Reflect.apply(original, this, originalInit ? [source, init] : [source]);
          self.count("responseObserved");
          self.noteResponse(activeRequest, response2.status);
          return response2;
        }, "native");
        if (self.settings.get().disabled) return await native(input);
        const sourceRequest = new Request(input, init);
        const originalUrl = sourceRequest.url;
        if (self.settings.get().blockHttpDns && isHttpDnsUrl(originalUrl, location.href)) {
          return new Response(JSON.stringify({ code: -1, message: "HTTPDNS blocked by BiliCDN v2" }), {
            status: 503,
            headers: { "content-type": "application/json; charset=utf-8" }
          });
        }
        if (isPlayurlApi(originalUrl, location.href)) {
          const generation2 = self.session.get().generation, responseKey = self.nextResponseKey("api-fetch");
          const requestContext = playurlRequestContext(originalUrl);
          const response2 = await native(sourceRequest, false);
          if (self.settings.get().disabled) return response2;
          const catalogOnly = /* @__PURE__ */ __name(() => !self.settings.get().disabled && self.routes.isCatalogOnly(), "catalogOnly");
          const blocked = /* @__PURE__ */ __name(() => copyResponseSurface(new Response(blockedPlayurlText(), {
            status: 503,
            headers: { "content-type": "application/json; charset=utf-8" }
          }), response2), "blocked");
          let text3;
          try {
            text3 = await response2.text();
          } catch {
            self.notePlayurl("fetch", response2.status, rejectedPlayurl(self.session.isGeneration(generation2) && !self.settings.get().disabled ? "malformed-payload" : "inactive"));
            return catalogOnly() ? blocked() : response2;
          }
          if (self.settings.get().disabled) {
            self.notePlayurl("fetch", response2.status, rejectedPlayurl("inactive"));
            return copyResponseSurface(new Response(text3, { status: response2.status, statusText: response2.statusText, headers: response2.headers }), response2);
          }
          try {
            const payload = JSON.parse(text3);
            const result = self.session.isGeneration(generation2) && !self.settings.get().disabled ? self.playurl.transform(payload, "trusted-api", responseKey, requestContext) : rejectedPlayurl("inactive");
            self.notePlayurl("fetch", response2.status, result);
            if (catalogOnly() && !result.accepted) return blocked();
            text3 = JSON.stringify(payload);
          } catch {
            self.notePlayurl("fetch", response2.status, rejectedPlayurl("malformed-payload"));
            if (catalogOnly()) return blocked();
          }
          return copyResponseSurface(new Response(text3, { status: response2.status, statusText: response2.statusText, headers: response2.headers }), response2);
        }
        const method = sourceRequest.method.toUpperCase();
        if (!self.routes.recognizesMedia(originalUrl)) return await native(sourceRequest, false);
        self.count("mediaRecognized");
        const generation = self.session.get().generation;
        if (method === "GET") {
          if (self.measurement.willGateStartup(originalUrl)) {
            await self.measurement.prepareStartup(originalUrl, sourceRequest.signal);
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
        const applied = method === "GET" ? self.routes.apply(originalUrl) : self.routes.inspectOriginal(originalUrl);
        const reason = self.dispatchFailure({ generation, applied, targetUrl: applied.url ?? "", managedMedia: true });
        if (reason || !applied.url) {
          self.blocked(method, originalUrl, reason ?? "catalog-unavailable");
          throw new TypeError(`BiliCDN blocked media request: ${reason}`);
        }
        const targetInput = applied.url === originalUrl ? sourceRequest : new Request(applied.url, sourceRequest);
        const outbound = self.routes.isCatalogOnly() ? new Request(targetInput, { redirect: "error" }) : targetInput;
        const startedAt = self.now();
        const request = self.request(applied, originalUrl, applied.url, startedAt, method);
        activeRequest = request;
        self.routes.requestStarted(request);
        let response;
        try {
          response = await native(outbound, false);
        } catch (error) {
          const signal = sourceRequest.signal;
          const aborted = signal?.aborted === true || error instanceof DOMException && error.name === "AbortError";
          void self.observeFetch(request, applied, originalUrl, applied.url, null, startedAt, 0, 0, aborted ? "abort" : "failure", aborted ? void 0 : "network");
          throw error;
        }
        const responseAt = self.now();
        if (!response.body) {
          const invalid = applied.decision.routeType === "native-signed" && [403, 451, 959].includes(response.status);
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
            invalid ? "native-invalid" : response.status >= 500 ? "http-5xx" : void 0
          );
          return response;
        }
        const reader = response.body.getReader();
        let bytes2 = 0, settled = false;
        const settle = /* @__PURE__ */ __name((outcome, failure) => {
          if (settled) return;
          settled = true;
          void self.observeFetch(request, applied, originalUrl, applied.url ?? originalUrl, response, startedAt, responseAt, bytes2, outcome, failure);
        }, "settle");
        const body = new ReadableStream({
          async pull(controller) {
            try {
              const result = await reader.read();
              if (result.done) {
                const invalid = applied.decision.routeType === "native-signed" && [403, 451, 959].includes(response.status);
                settle(response.ok ? "success" : "failure", invalid ? "native-invalid" : response.status >= 500 ? "http-5xx" : void 0);
                controller.close();
                return;
              }
              bytes2 += result.value.byteLength;
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
        return copyResponseSurface(new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers }), response);
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

  // src-v2/adapters/xhr-hook.ts
  var XhrHookAdapter = class {
    constructor(context) {
      this.context = context;
    }
    context;
    static {
      __name(this, "XhrHookAdapter");
    }
    #xhrMeta = /* @__PURE__ */ new WeakMap();
    install() {
      const proto = unsafeWindow.XMLHttpRequest?.prototype;
      if (!proto) return null;
      const originalOpen = proto.open, originalSend = proto.send, originalAbort = proto.abort, originalSetHeader = proto.setRequestHeader;
      const responseDescriptor = Object.getOwnPropertyDescriptor(proto, "response");
      const responseTextDescriptor = Object.getOwnPropertyDescriptor(proto, "responseText");
      const readyStateDescriptor = Object.getOwnPropertyDescriptor(proto, "readyState");
      const self = this.context, xhrMeta = this.#xhrMeta;
      const waiting = /* @__PURE__ */ __name((xhr, meta) => xhrMeta.get(xhr) === meta && meta.phase === "waiting", "waiting");
      const finishLocal = /* @__PURE__ */ __name((xhr, meta, type) => {
        if (!waiting(xhr, meta)) return;
        meta.phase = "terminal";
        meta.virtualReadyState = 4;
        meta.cleanup();
        if (!meta.async) throw new DOMException("BiliCDN blocked request", "NetworkError");
        const owns = /* @__PURE__ */ __name(() => xhrMeta.get(xhr) === meta && meta.virtualReadyState === 4, "owns");
        xhr.dispatchEvent(new Event("readystatechange"));
        if (owns()) xhr.dispatchEvent(new ProgressEvent(type));
        if (owns()) xhr.dispatchEvent(new ProgressEvent("loadend"));
      }, "finishLocal");
      const rejectLocal = /* @__PURE__ */ __name((xhr, meta) => {
        if (meta.async) queueMicrotask(() => finishLocal(xhr, meta, "error"));
        else finishLocal(xhr, meta, "error");
      }, "rejectLocal");
      const open = /* @__PURE__ */ __name(function(method, url, async, username, password) {
        readyStateDescriptor?.get?.call(this);
        if (arguments.length < 2) {
          Reflect.apply(originalOpen, this, Array.from(arguments));
          return;
        }
        const methodString = `${method}`;
        if (/[^\x00-\xff]/.test(methodString)) throw new TypeError("XHR method must be a ByteString");
        const originalUrl = `${url}`.toWellFormed();
        const asynchronous = arguments.length < 3 ? true : Boolean(async);
        const user = username == null ? null : `${username}`.toWellFormed();
        const pass = password == null ? null : `${password}`.toWellFormed();
        const normalizedMethod = /^(DELETE|GET|HEAD|OPTIONS|POST|PUT)$/i.test(methodString) ? methodString.toUpperCase() : methodString;
        self.count("enteredXhr");
        const playurl = isPlayurlApi(originalUrl, location.href);
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
          responseAt: 0,
          bytes: 0,
          settled: false,
          playurl,
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
              if (previous.phase === "waiting" && readyStateDescriptor?.get?.call(this) === 0) previous.needsNativeOpen = true;
            } else xhrMeta.delete(this);
          }
          throw error;
        }
        if (previous) {
          previous.phase = "terminal";
          previous.cleanup();
        }
      }, "open");
      const send = /* @__PURE__ */ __name(function(body) {
        const meta = xhrMeta.get(this);
        if (!meta) {
          Reflect.apply(originalSend, this, [body ?? null]);
          return;
        }
        if (meta.phase !== "opened" || this.readyState !== 1) throw new DOMException("send invalid state", "InvalidStateError");
        meta.phase = "waiting";
        let nativeAccepted = false;
        const perform = /* @__PURE__ */ __name(() => {
          if (!waiting(this, meta)) return;
          const responseType = this.responseType, requestTimeout = this.timeout, credentials = this.withCredentials;
          let preparations = 0;
          const nativeReady = /* @__PURE__ */ __name(() => waiting(this, meta) && readyStateDescriptor?.get?.call(this) === 1, "nativeReady");
          const reopen = /* @__PURE__ */ __name((url) => {
            if (++preparations > 2) throw new DOMException("XHR preparation did not stabilize", "InvalidStateError");
            Reflect.apply(originalOpen, this, [meta.method, url, meta.async, meta.username ?? null, meta.password ?? null]);
            if (!waiting(this, meta)) return;
            if (!nativeReady()) {
              meta.needsNativeOpen = true;
              return;
            }
            if (meta.async) {
              this.responseType = responseType;
              if (!nativeReady()) {
                if (waiting(this, meta)) meta.needsNativeOpen = true;
                return;
              }
              this.timeout = requestTimeout;
              if (!nativeReady()) {
                if (waiting(this, meta)) meta.needsNativeOpen = true;
                return;
              }
            }
            this.withCredentials = credentials;
            if (!nativeReady()) {
              if (waiting(this, meta)) meta.needsNativeOpen = true;
              return;
            }
            for (const [key, value] of meta.headers) {
              Reflect.apply(originalSetHeader, this, [key, value]);
              if (!nativeReady()) {
                if (waiting(this, meta)) meta.needsNativeOpen = true;
                return;
              }
            }
            meta.targetUrl = url;
            meta.needsNativeOpen = false;
          }, "reopen");
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
              if (!self.session.isGeneration(meta.generation) && strictManaged) {
                self.blocked(meta.method, meta.originalUrl, "catalog-unavailable");
                rejectLocal(this, meta);
                return;
              }
              stale = !self.session.isGeneration(meta.generation);
              if (!meta.playurl && (meta.applied || meta.managedBilibili || self.routes.recognizesMedia(meta.originalUrl) || strictManaged)) {
                if (!meta.applied) self.count("mediaRecognized");
                applied = !stale && meta.method === "GET" ? self.routes.apply(meta.originalUrl) : self.routes.inspectOriginal(meta.originalUrl);
                if (applied.url) targetUrl = applied.url;
              }
              if (self.settings.get().blockHttpDns && isHttpDnsUrl(meta.originalUrl, location.href)) {
                rejectLocal(this, meta);
                return;
              }
              const reason = self.dispatchFailure({ generation: meta.generation, applied, targetUrl, managedMedia: strictManaged });
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
            meta.request = self.request(meta.applied, meta.originalUrl, meta.targetUrl, meta.startedAt, meta.method);
            self.routes.requestStarted(meta.request);
          }
          const noteHeaders = /* @__PURE__ */ __name(() => {
            if (xhrMeta.get(this) === meta && !meta.responseAt && this.readyState >= 2) meta.responseAt = self.now();
          }, "noteHeaders");
          const progress = /* @__PURE__ */ __name((event) => {
            if (xhrMeta.get(this) !== meta) return;
            noteHeaders();
            meta.bytes = Math.max(meta.bytes, Number(event.loaded) || 0);
          }, "progress");
          const settle = /* @__PURE__ */ __name((outcome, failure) => {
            if (meta.settled || xhrMeta.get(this) !== meta) return;
            meta.settled = true;
            meta.cleanup();
            if (meta.responseAt > 0 || this.status > 0) {
              self.count("responseObserved");
              self.noteResponse(meta.request, Number(this.status) || 0);
            }
            if (!meta.applied || !meta.request) return;
            const finalUrl = (() => {
              try {
                return this.responseURL || "";
              } catch {
                return "";
              }
            })();
            void self.routes.observe(self.observation(
              meta.request,
              meta.applied,
              meta.originalUrl,
              meta.targetUrl,
              finalUrl,
              Number(this.status) || 0,
              meta.bytes,
              meta.startedAt,
              meta.responseAt,
              outcome,
              failure,
              sameUrl(finalUrl, meta.targetUrl)
            ));
          }, "settle");
          const load = /* @__PURE__ */ __name(() => {
            const invalid = meta.applied?.decision.routeType === "native-signed" && [403, 451, 959].includes(this.status);
            settle(this.status >= 200 && this.status < 400 ? "success" : "failure", invalid ? "native-invalid" : this.status >= 500 ? "http-5xx" : void 0);
          }, "load");
          const error = /* @__PURE__ */ __name(() => settle("failure", "network"), "error"), timeout = /* @__PURE__ */ __name(() => settle("failure", "timeout"), "timeout"), abort2 = /* @__PURE__ */ __name(() => settle("abort"), "abort");
          this.addEventListener("readystatechange", noteHeaders);
          this.addEventListener("progress", progress);
          this.addEventListener("load", load);
          this.addEventListener("error", error);
          this.addEventListener("timeout", timeout);
          this.addEventListener("abort", abort2);
          meta.cleanup = () => {
            this.removeEventListener("readystatechange", noteHeaders);
            this.removeEventListener("progress", progress);
            this.removeEventListener("load", load);
            this.removeEventListener("error", error);
            this.removeEventListener("timeout", timeout);
            this.removeEventListener("abort", abort2);
          };
          self.count("nativeCalled");
          self.noteNativeCall(meta.request);
          meta.phase = "sent";
          try {
            Reflect.apply(originalSend, this, [body ?? null]);
          } catch (error2) {
            if (!meta.settled && xhrMeta.get(this) === meta) {
              meta.cleanup();
              if (meta.applied && meta.request) void self.routes.observe(self.observation(
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
              ));
            }
            throw error2;
          }
          nativeAccepted = true;
        }, "perform");
        if (meta.async && !meta.playurl && meta.method === "GET" && self.routes.recognizesMedia(meta.originalUrl) && !self.settings.get().disabled && this.timeout === 0 && self.measurement.willGateStartup(meta.originalUrl)) {
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
          void self.measurement.prepareStartup(meta.originalUrl).then(release, release);
          return;
        }
        if (!meta.playurl && self.routes.recognizesMedia(meta.originalUrl)) {
          if (!meta.async) self.measurement.noteUnpreflighted("preflight-skipped:synchronous-xhr");
          else if (this.timeout > 0) self.measurement.noteUnpreflighted("preflight-skipped:xhr-explicit-timeout");
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
        const meta = xhrMeta.get(this);
        if (meta && (meta.phase === "waiting" || meta.virtualReadyState !== null)) throw new DOMException("header invalid state", "InvalidStateError");
        Reflect.apply(originalSetHeader, this, [name, value]);
        xhrMeta.get(this)?.headers.push([name, value]);
      }, "setHeader");
      let responseGetter, responseTextGetter, readyStateGetter;
      const rollback = /* @__PURE__ */ __name(() => {
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
          if (responseDescriptor && Object.getOwnPropertyDescriptor(proto, "response")?.get === responseGetter) Object.defineProperty(proto, "response", responseDescriptor);
        } catch {
        }
        try {
          if (responseTextDescriptor && Object.getOwnPropertyDescriptor(proto, "responseText")?.get === responseTextGetter) Object.defineProperty(proto, "responseText", responseTextDescriptor);
        } catch {
        }
        try {
          if (readyStateDescriptor && Object.getOwnPropertyDescriptor(proto, "readyState")?.get === readyStateGetter) Object.defineProperty(proto, "readyState", readyStateDescriptor);
        } catch {
        }
      }, "rollback");
      try {
        proto.open = open;
        proto.send = send;
        proto.abort = abort;
        proto.setRequestHeader = setHeader;
        if (proto.open !== open || proto.send !== send || proto.abort !== abort || proto.setRequestHeader !== setHeader) throw new Error("XHR hook assignment did not stick");
        if (readyStateDescriptor?.get && readyStateDescriptor.configurable) {
          readyStateGetter = /* @__PURE__ */ __name(function() {
            return xhrMeta.get(this)?.virtualReadyState ?? readyStateDescriptor.get.call(this);
          }, "readyStateGetter");
          Object.defineProperty(proto, "readyState", { ...readyStateDescriptor, get: readyStateGetter });
        }
        if (responseDescriptor?.get && responseDescriptor.configurable) {
          responseGetter = /* @__PURE__ */ __name(function() {
            const raw = responseDescriptor.get?.call(this), meta = xhrMeta.get(this);
            if (meta && meta.virtualReadyState !== null) return this.responseType === "" || this.responseType === "text" ? "" : null;
            if (!meta?.playurl || self.settings.get().disabled) return raw;
            if (this.readyState !== 4) return self.routes.isCatalogOnly() ? this.responseType === "" || this.responseType === "text" ? "" : null : raw;
            if (!self.session.isGeneration(meta.generation)) {
              self.notePlayurl("xhr", this.status, rejectedPlayurl("inactive"));
              return self.routes.isCatalogOnly() ? this.responseType === "" || this.responseType === "text" ? blockedPlayurlText() : blockedPlayurl() : raw;
            }
            const strict = self.routes.isCatalogOnly();
            if (meta.catalogOnlyAtTransform !== strict) {
              meta.transformedText = null;
              meta.transformedJson = void 0;
              meta.catalogOnlyAtTransform = strict;
            }
            if (this.responseType === "json") {
              if (meta.transformedJson === void 0) {
                try {
                  const result = self.playurl.transform(raw, "trusted-api", meta.responseKey, meta.requestContext);
                  self.notePlayurl("xhr", this.status, result);
                  meta.transformedJson = strict && !result.accepted ? blockedPlayurl() : raw;
                } catch {
                  self.notePlayurl("xhr", this.status, rejectedPlayurl("malformed-payload"));
                  meta.transformedJson = strict ? blockedPlayurl() : raw;
                }
              }
              return meta.transformedJson;
            }
            if ((this.responseType === "" || this.responseType === "text") && typeof raw === "string") {
              if (meta.transformedText === null) {
                try {
                  const payload = JSON.parse(raw), result = self.playurl.transform(payload, "trusted-api", meta.responseKey, meta.requestContext);
                  self.notePlayurl("xhr", this.status, result);
                  meta.transformedText = strict && !result.accepted ? blockedPlayurlText() : JSON.stringify(payload);
                } catch {
                  self.notePlayurl("xhr", this.status, rejectedPlayurl("malformed-payload"));
                  meta.transformedText = strict ? blockedPlayurlText() : raw;
                }
              }
              return meta.transformedText;
            }
            self.notePlayurl("xhr", this.status, rejectedPlayurl("unsupported-format"));
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
              self.notePlayurl("xhr", this.status, rejectedPlayurl("inactive"));
              return self.routes.isCatalogOnly() ? blockedPlayurlText() : raw;
            }
            const strict = self.routes.isCatalogOnly();
            if (meta.catalogOnlyAtTransform !== strict) {
              meta.transformedText = null;
              meta.transformedJson = void 0;
              meta.catalogOnlyAtTransform = strict;
            }
            if (meta.transformedText !== null) return meta.transformedText;
            try {
              const payload = JSON.parse(raw), result = self.playurl.transform(payload, "trusted-api", meta.responseKey, meta.requestContext);
              self.notePlayurl("xhr", this.status, result);
              meta.transformedText = strict && !result.accepted ? blockedPlayurlText() : JSON.stringify(payload);
            } catch {
              self.notePlayurl("xhr", this.status, rejectedPlayurl("malformed-payload"));
              meta.transformedText = strict ? blockedPlayurlText() : raw;
            }
            return meta.transformedText;
          }, "responseTextGetter");
          Object.defineProperty(proto, "responseText", { ...responseTextDescriptor, get: responseTextGetter });
        }
        return { restore: rollback, isInstalled: /* @__PURE__ */ __name(() => proto.open === open && proto.send === send && proto.abort === abort && proto.setRequestHeader === setHeader && (!responseGetter || Object.getOwnPropertyDescriptor(proto, "response")?.get === responseGetter) && (!responseTextGetter || Object.getOwnPropertyDescriptor(proto, "responseText")?.get === responseTextGetter) && (!readyStateGetter || Object.getOwnPropertyDescriptor(proto, "readyState")?.get === readyStateGetter), "isInstalled") };
      } catch {
        rollback();
        return null;
      }
    }
  };

  // src-v2/adapters/transport.ts
  var TransportAdapter = class {
    static {
      __name(this, "TransportAdapter");
    }
    #fetch = null;
    #xhr = null;
    #hookState = "not-installed";
    #hookReason = "not-attempted";
    #context;
    constructor(session, settings, routes, playurl, measurement, now, ids) {
      this.#context = new TransportContext(session, settings, routes, playurl, measurement, now, ids);
    }
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
        this.#xhr = new XhrHookAdapter(this.#context).install();
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
    dispose() {
      for (const hook of [this.#xhr, this.#fetch]) {
        try {
          hook?.restore();
        } catch {
        }
      }
      this.#xhr = null;
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
      const state = Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState");
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
        if (event.isTrusted) this.#notifyControlLoss();
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
      let existing;
      try {
        existing = Object.getOwnPropertyDescriptor(document, key);
      } catch {
        return;
      }
      try {
        Object.defineProperty(document, key, { configurable: true, enumerable: true, get: /* @__PURE__ */ __name(() => value, "get") });
        this.#restores.push(() => {
          try {
            if (existing) Object.defineProperty(document, key, existing);
            else delete document[key];
          } catch {
          }
        });
      } catch {
      }
    }
  };

  // src-v2/adapters/webrtc.ts
  var API_NAMES = ["RTCPeerConnection", "mozRTCPeerConnection", "webkitRTCPeerConnection", "RTCDataChannel"];
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
      this.#unsubscribe = this.settings.subscribe((state) => this.#apply(!state.disabled && state.blockWebRtc));
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

  // src-v2/diagnostics/recorder.ts
  var bytes = /* @__PURE__ */ __name((value) => new TextEncoder().encode(JSON.stringify(value)).byteLength, "bytes");
  var text2 = /* @__PURE__ */ __name((value, max = 96) => String(value ?? "").slice(0, max), "text");
  var field = /* @__PURE__ */ __name((value, key) => value && typeof value === "object" ? Reflect.get(value, key) : void 0, "field");
  var DiagnosticRecorder = class {
    constructor(now, verbose) {
      this.now = now;
      this.verbose = verbose;
    }
    now;
    verbose;
    static {
      __name(this, "DiagnosticRecorder");
    }
    #events = [];
    #flow = /* @__PURE__ */ new Map();
    #pending = /* @__PURE__ */ new Map();
    #lastSuccess = /* @__PURE__ */ new Map();
    #lastConfirmed = /* @__PURE__ */ new Map();
    #lastAttribution = /* @__PURE__ */ new Map();
    #rankings = [];
    #incident = null;
    #attempts = [];
    #recentPlayerTrace = [];
    #lastPaused = null;
    #lastPlayerFrames = null;
    #serial = 0;
    #aliases = /* @__PURE__ */ new Map();
    #manualMark = null;
    #counters = { evicted: 0, incidentReplaced: 0, rankingEvicted: 0, flowEvicted: 0, incidentEvicted: 0, pendingEvicted: 0, eventsExpired: 0, flowsExpired: 0, traceEvicted: 0, attemptEvicted: 0 };
    tick() {
      if (this.#incident?.state === "capturing" && this.now() >= this.#incident.captureUntil) this.#incident.state = "frozen";
      const active = this.#activeAttempt();
      if (active && this.now() - active.at >= 3e4 && !["playback-observed", "mixed-evidence"].includes(active.stage)) active.stage = "unconfirmed";
      const floor = this.now() - 6e4;
      const events = this.#events.filter((event) => event.at >= floor);
      this.#counters.eventsExpired += this.#events.length - events.length;
      this.#events = events;
      for (const [key, row] of this.#flow) if (row.lastAt < floor) {
        this.#flow.delete(key);
        this.#counters.flowsExpired++;
      }
      for (const [key, row] of this.#pending) if (this.now() - row.startedAt > 12e4) {
        this.#pending.delete(key);
        this.#counters.pendingEvicted++;
      }
    }
    record(event, routeObservationEnabled = true) {
      this.tick();
      if (routeObservationEnabled) this.#observeAttempt(event);
      else {
        const active = this.#activeAttempt();
        if (active) active.stage = "interrupted";
      }
      if (event.type === "request-started") {
        this.#pending.set(event.request.requestId, event.request);
        while (this.#pending.size > 32) {
          this.#pending.delete(this.#pending.keys().next().value);
          this.#counters.pendingEvicted++;
        }
        return;
      }
      if (event.type === "route-confirmed") {
        const o = event.observation, key = o.kind ?? "unknown", signature = [o.finalHost, o.routeType, o.representation].join(":");
        if (this.#lastConfirmed.get(key) === signature) return;
        this.#lastConfirmed.set(key, signature);
      }
      if (event.type === "attribution-changed") {
        const key = event.kind ?? "unknown";
        if (this.#lastAttribution.get(key) === event.status) return;
        this.#lastAttribution.set(key, event.status);
      }
      if (event.type === "transport" || event.type === "transport-completed") {
        const o = event.observation;
        if (o.request) this.#pending.delete(o.request.requestId);
        this.#aggregate(o);
        if (o.outcome !== "failure") {
          if (o.outcome === "success" && !(event.type === "transport-completed" && event.detached)) this.#lastSuccess.set(o.kind ?? "unknown", this.#transport(o));
          return;
        }
      }
      const safe = this.#event(event);
      this.#events.push(safe);
      this.#trim(this.#events, 24 * 1024, "evicted");
      const trigger = this.#trigger(event);
      if (this.#incident?.state === "capturing") {
        this.#incident.events.push(safe);
        if (trigger) this.#incident.captureUntil = Math.min(this.#incident.startedAt + 9e4, Math.max(this.#incident.captureUntil, event.at + 3e4));
        this.#trim(this.#incident.events, 48 * 1024, "incidentEvicted");
      } else if (trigger) this.#start(trigger, event.at);
      this.#bound();
    }
    mark(reason = "manual") {
      this.tick();
      this.#manualMark = { at: this.now(), reason: text2(reason), count: (this.#manualMark?.count ?? 0) + 1 };
      if (!this.#incident) this.#start(text2(reason), this.now());
      this.#bound();
    }
    clear() {
      this.#incident = null;
      this.#manualMark = null;
      this.#attempts = [];
      this.#recentPlayerTrace = [];
      this.#lastPaused = null;
      this.#lastPlayerFrames = null;
    }
    recordPlayer(sample) {
      this.tick();
      const active = this.#activeAttempt();
      if (active) {
        if (!sample.enabled || sample.originalComparison || sample.generation !== active.identity.generation || sample.epoch !== active.identity.epoch) {
          active.stage = "interrupted";
        } else if (sample.seeking || sample.ended) {
          active.stage = "interrupted";
        } else {
          if (!active.baselineCaptured) {
            active.baselineCaptured = true;
            active.baselinePositionSec = this.#finite(sample.currentTimeSec, 0, 86400);
            const buffer = this.#finite(sample.playableBufferSec, 0, 86400);
            active.baselineEndSec = active.baselinePositionSec !== null && buffer !== null ? active.baselinePositionSec + buffer : null;
          }
          const position = this.#finite(sample.currentTimeSec, 0, 86400);
          const progressing = !sample.paused && !sample.seeking && !sample.ended && position !== null && active.lastPositionSec !== null && position > active.lastPositionSec + 0.05;
          if (progressing && active.responseAt === null && active.stage !== "mixed-evidence") active.stage = "progress-unconfirmed";
          if (active.responseAt !== null && !active.mixed && active.stage !== "playback-observed" && active.stage !== "unconfirmed") {
            const beyond = progressing && active.baselineEndSec !== null && position > active.baselineEndSec + 0.1;
            const contiguous = active.lastProgressAt !== null && sample.at > active.lastProgressAt && sample.at - active.lastProgressAt <= 2e3;
            active.progressTicks = beyond ? contiguous ? active.progressTicks + 1 : 1 : 0;
            active.lastProgressAt = beyond ? sample.at : null;
            if (active.progressTicks >= 2) {
              active.stage = "playback-observed";
              active.playbackAt = sample.at;
            }
          }
          active.lastPositionSec = position;
        }
      }
      const flags = Number(sample.paused) | Number(sample.seeking) << 1 | Number(sample.ended) << 2 | Number(sample.coreInitialized === false) << 3 | Number(sample.coreInitialized === true) << 4;
      const currentFrames = this.#finite(sample.frames, 0, 2 ** 32 - 1);
      const frameDelta = currentFrames !== null && this.#lastPlayerFrames !== null ? Math.max(0, currentFrames - this.#lastPlayerFrames) : -1;
      this.#lastPlayerFrames = currentFrames;
      const row = [
        Math.trunc(sample.at),
        Math.round((this.#finite(sample.currentTimeSec, 0, 86400) ?? 0) * 10),
        frameDelta,
        Math.round((this.#finite(sample.playableBufferSec, 0, 86400) ?? 0) * 10),
        Math.max(0, Math.min(4, Math.trunc(sample.readyState))),
        flags,
        text2(sample.watchdog, 20)
      ].join(",");
      this.#recentPlayerTrace.push({ at: sample.at, row });
      this.#recentPlayerTrace = this.#recentPlayerTrace.filter((item) => item.at >= sample.at - 2e4).slice(-21);
      if (this.#incident?.state === "capturing" && sample.at <= this.#incident.startedAt + 9e4) {
        this.#incident.playerTrace.push(row);
        while (bytes(this.#incident.playerTrace) > 4 * 1024 && this.#incident.playerTrace.length > 1) {
          this.#incident.playerTrace.shift();
          this.#counters.traceEvicted++;
        }
      }
      if (this.#lastPaused !== null && this.#lastPaused !== sample.paused) {
        const event = { at: sample.at, type: "player-paused-changed", data: { paused: sample.paused }, important: true };
        this.#events.push(event);
        this.#trim(this.#events, 24 * 1024, "evicted");
        if (this.#incident?.state === "capturing") {
          this.#incident.events.push(event);
          this.#trim(this.#incident.events, 48 * 1024, "incidentEvicted");
        }
      }
      this.#lastPaused = sample.paused;
      this.#bound();
    }
    snapshot() {
      return this.#capture();
    }
    #capture() {
      return Object.freeze({
        coverage: { from: this.#events[0]?.at ?? this.now(), to: this.#events.at(-1)?.at ?? this.now() },
        incident: this.#incident ? structuredClone(this.#incident) : null,
        manualMark: this.#manualMark ? { ...this.#manualMark } : null,
        flow: this.#flows(),
        lastSuccess: Object.fromEntries(this.#lastSuccess),
        pending: [...this.#pending.values()].map((row) => this.#request(row)),
        events: structuredClone(this.#events),
        rankings: structuredClone(this.#rankings),
        routeRecovery: { attempts: this.#attempts.map((row) => this.#attemptSummary(row)) },
        counters: { ...this.#counters }
      });
    }
    buildReport(readModel) {
      const recorder = { ...this.#capture() };
      const payload = {
        title: "BiliCDN_TW v2 診斷報告",
        generatedAt: new Date(this.now()).toISOString(),
        evidence: this.#incident ? this.#incident.state + "-incident" : this.#lastSuccess.size ? "media-observation-only" : "playback-observation-unattributed",
        current: this.#sanitize(readModel),
        recorder,
        export: {
          truncated: false,
          rankingDropped: 0,
          traceDropped: 0,
          contextDropped: 0,
          flowDropped: 0,
          incidentDropped: 0,
          currentReduced: false,
          emergencySummary: false
        }
      };
      let output = JSON.stringify(payload, null, 2);
      if (new TextEncoder().encode(output).byteLength <= 96 * 1024) return output;
      payload.export.truncated = true;
      output = JSON.stringify(payload);
      if (new TextEncoder().encode(output).byteLength <= 96 * 1024) return output;
      payload.export.rankingDropped = this.#rankings.length;
      recorder.rankings = [];
      output = JSON.stringify(payload);
      const { events, flow: flows, incident } = recorder;
      while (new TextEncoder().encode(output).byteLength > 96 * 1024 && (incident?.playerTrace.length || events.length > 1 || flows.length > 1 || (incident?.events.length ?? 0) > 1)) {
        if (incident?.playerTrace.length) {
          incident.playerTrace.shift();
          payload.export.traceDropped++;
        } else if (events.length > 1) {
          const i = events.findIndex((row) => !row.important);
          events.splice(i >= 0 ? i : 0, 1);
          payload.export.contextDropped++;
        } else if (flows.length > 1) {
          flows.shift();
          payload.export.flowDropped++;
        } else if (incident && incident.events.length > 1) {
          const i = incident.events.findIndex((row) => !row.important);
          incident.events.splice(i >= 0 ? i : 0, 1);
          payload.export.incidentDropped++;
        }
        output = JSON.stringify(payload);
      }
      if (new TextEncoder().encode(output).byteLength <= 96 * 1024) return output;
      const m = {
        version: field(readModel, "version"),
        session: field(readModel, "session"),
        monitor: field(readModel, "monitor"),
        recovery: field(readModel, "recovery"),
        measurement: field(readModel, "measurement"),
        interception: field(readModel, "interception")
      };
      const r = field(readModel, "routes");
      payload.current = this.#sanitize({
        version: m.version,
        session: m.session,
        monitor: m.monitor,
        recovery: m.recovery,
        measurement: m.measurement,
        interception: m.interception,
        routes: {
          planCount: field(r, "planCount"),
          activePlan: field(r, "activePlan"),
          affinity: field(r, "affinity"),
          latest: field(r, "latest"),
          representation: field(r, "representation"),
          attribution: field(r, "attribution")
        },
        truncated: true
      });
      payload.export.currentReduced = true;
      output = JSON.stringify(payload);
      if (new TextEncoder().encode(output).byteLength <= 96 * 1024) return output;
      const latest = recorder.routeRecovery.attempts.at(-1);
      const summary = {
        title: payload.title,
        generatedAt: payload.generatedAt,
        evidence: payload.evidence,
        current: this.#sanitize({ version: m.version, monitor: { watchdog: field(m.monitor, "watchdog") }, truncated: true }),
        recorder: {
          incident: incident && { id: incident.id, reason: incident.reason, startedAt: incident.startedAt, state: incident.state },
          routeRecovery: { attempts: latest ? [{ actionId: latest.actionId, decisionId: latest.decisionId, host: latest.host, stage: latest.stage }] : [] }
        },
        export: { ...payload.export, emergencySummary: true }
      };
      return JSON.stringify(summary);
    }
    #activeAttempt() {
      const row = this.#attempts.at(-1);
      return row && !["mixed-evidence", "unconfirmed", "superseded", "interrupted"].includes(row.stage) && !(row.stage === "playback-observed" && this.now() - row.at >= 3e4) ? row : null;
    }
    #finite(value, min, max) {
      return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null;
    }
    #matches(request, attempt) {
      return !!request && request.kind === "video" && request.attributionStatus === "matched" && request.generation === attempt.identity.generation && request.epoch === attempt.identity.epoch && request.representation === attempt.identity.representation && request.authorityRevision === attempt.identity.authorityRevision && request.decisionId === attempt.decisionId && request.targetHost === attempt.host && request.startedAt >= attempt.at;
    }
    #observeAttempt(event) {
      if (event.type === "recovery" && event.action.action === "route-fallback" && event.action.kind === "video") {
        const active2 = this.#activeAttempt();
        if (active2 && active2.stage !== "playback-observed") active2.stage = "superseded";
        this.#attempts.push({
          actionId: event.action.id,
          decisionId: event.action.decision.id,
          host: event.action.decision.host ?? "",
          identity: event.action.identity,
          at: event.at,
          stage: "planned",
          baselinePositionSec: null,
          baselineEndSec: null,
          baselineCaptured: false,
          requestAt: null,
          responseAt: null,
          playbackAt: null,
          requests: 0,
          successes: 0,
          failures: 0,
          aborts: 0,
          zeroByteAborts: 0,
          noResponseAborts: 0,
          lastOutcomeAt: null,
          lastFailureKind: null,
          mixed: false,
          progressTicks: 0,
          lastProgressAt: null,
          lastPositionSec: null,
          requestIds: /* @__PURE__ */ new Set(),
          responseIds: /* @__PURE__ */ new Set()
        });
        while (this.#attempts.length > 6) {
          this.#attempts.shift();
          this.#counters.attemptEvicted++;
        }
        return;
      }
      const active = this.#activeAttempt();
      if (!active) return;
      if (event.type === "lifecycle") {
        if (event.generation !== active.identity.generation || event.epoch !== active.identity.epoch) active.stage = "interrupted";
        return;
      }
      if (event.type === "request-started") {
        if (!this.#matches(event.request, active)) return;
        if (active.requestIds.size >= 32) active.requestIds.delete(active.requestIds.values().next().value);
        active.requestIds.add(event.request.requestId);
        active.requests++;
        active.requestAt ??= event.at;
        if (active.stage === "planned") active.stage = "sent";
        return;
      }
      if (event.type !== "transport-completed" && event.type !== "route-confirmed") return;
      const observation = event.observation;
      if (observation.kind === "video" && observation.outcome === "success" && observation.bytes > 0 && observation.generation === active.identity.generation && observation.epoch === active.identity.epoch && observation.representation === active.identity.representation && observation.finalHost && observation.finalHost !== active.host && event.type === "route-confirmed") {
        active.mixed = true;
        active.stage = "mixed-evidence";
        return;
      }
      if (!this.#matches(observation.request, active) || !active.requestIds.has(observation.request.requestId)) return;
      if (event.type === "transport-completed") {
        if (event.detached) return;
        active.lastOutcomeAt = observation.completedAt;
        if (observation.outcome === "abort") {
          active.aborts++;
          if (observation.bytes === 0) active.zeroByteAborts++;
          if (observation.status === 0 && observation.finalHost === null) active.noResponseAborts++;
        } else if (observation.outcome === "failure") {
          active.failures++;
          active.lastFailureKind = observation.failureKind ?? "unknown";
        } else active.successes++;
        return;
      }
      if (observation.outcome !== "success" || observation.status !== 206 || observation.bytes <= 0 || observation.finalHost !== active.host || observation.responseUrlMatchesRequest !== true || active.responseIds.has(observation.request.requestId)) return;
      active.responseIds.add(observation.request.requestId);
      active.responseAt ??= event.at;
      active.stage = "response-observed";
      active.progressTicks = 0;
      active.lastProgressAt = null;
    }
    #attemptSummary(row) {
      return {
        actionId: text2(row.actionId),
        decisionId: text2(row.decisionId),
        host: this.#host(row.host),
        generation: row.identity.generation,
        epoch: row.identity.epoch,
        representation: text2(row.identity.representation),
        authorityRevision: row.identity.authorityRevision,
        at: row.at,
        stage: row.stage,
        baselinePositionSec: row.baselinePositionSec,
        baselineEndSec: row.baselineEndSec,
        requestAt: row.requestAt,
        responseAt: row.responseAt,
        playbackAt: row.playbackAt,
        requests: row.requests,
        successes: row.successes,
        failures: row.failures,
        aborts: row.aborts,
        zeroByteAborts: row.zeroByteAborts,
        noResponseAborts: row.noResponseAborts,
        lastOutcomeAt: row.lastOutcomeAt,
        lastFailureKind: row.lastFailureKind,
        mixed: row.mixed
      };
    }
    #aggregate(o) {
      const key = [Math.floor(o.completedAt / 5e3), o.kind ?? "unknown", o.routeType, this.#host(o.targetHost), this.#host(o.finalHost)].join(":");
      const row = this.#flow.get(key) ?? { requests: 0, successes: 0, failures: 0, timeouts: 0, aborts: 0, zeroByteAborts: 0, noResponseAborts: 0, bytes: 0, lastAt: 0, maxElapsedMs: 0, maxTtfbMs: 0 };
      row.requests++;
      row.bytes += o.bytes;
      row.lastAt = o.completedAt;
      row.maxElapsedMs = Math.max(row.maxElapsedMs, o.elapsedMs);
      row.maxTtfbMs = Math.max(row.maxTtfbMs, o.ttfbMs ?? 0);
      if (o.outcome === "success") row.successes++;
      else if (o.outcome === "failure") {
        row.failures++;
        if (o.failureKind === "timeout") row.timeouts++;
      } else {
        row.aborts++;
        if (o.bytes === 0) row.zeroByteAborts++;
        if (o.status === 0 && o.finalHost === null) row.noResponseAborts++;
      }
      this.#flow.set(key, row);
      while (this.#flow.size > 48 || bytes(this.#flows()) > 12 * 1024) {
        this.#flow.delete(this.#flow.keys().next().value);
        this.#counters.flowEvicted++;
      }
      this.#bound();
    }
    #flows() {
      return [...this.#flow].map(([key, row]) => ({ key, ...row }));
    }
    #request(row) {
      return {
        requestId: text2(row.requestId, 160),
        generation: row.generation,
        epoch: row.epoch,
        routePolicyRevision: row.routePolicyRevision,
        decisionId: text2(row.decisionId, 160),
        representation: row.representation === null ? null : text2(row.representation, 160),
        ...row.authorityRevision !== void 0 ? { authorityRevision: row.authorityRevision } : {},
        kind: row.kind,
        attributionStatus: row.attributionStatus,
        attributionSource: row.attributionSource,
        decisionStage: row.decisionStage,
        routeType: row.routeType,
        originalHost: this.#host(row.originalHost),
        targetHost: this.#host(row.targetHost),
        sourceHost: this.#host(row.sourceHost),
        playurlHostChanged: row.playurlHostChanged,
        playurlOutput: row.playurlOutput ? {
          originalHost: this.#host(row.playurlOutput.originalHost) ?? "",
          outputHost: this.#host(row.playurlOutput.outputHost) ?? "",
          role: row.playurlOutput.role,
          source: row.playurlOutput.source,
          decisionId: row.playurlOutput.decisionId,
          hostChanged: row.playurlOutput.hostChanged
        } : null,
        urlChanged: row.urlChanged,
        hostChanged: row.hostChanged,
        startedAt: row.startedAt
      };
    }
    #transport(o) {
      return {
        ...o.request ? this.#request(o.request) : {},
        decisionId: o.decisionId,
        generation: o.generation,
        epoch: o.epoch,
        kind: o.kind,
        representation: o.representation,
        routeType: o.routeType,
        originalHost: this.#host(o.originalHost),
        targetHost: this.#host(o.targetHost),
        responseHost: this.#host(o.finalHost),
        status: o.status,
        bytes: o.bytes,
        ttfbMs: o.ttfbMs,
        elapsedMs: o.elapsedMs,
        completedAt: o.completedAt,
        outcome: o.outcome,
        failureKind: o.failureKind ?? null
      };
    }
    #decision(d) {
      const chosen = d.ranking.find((row) => row.candidate.host === d.host && row.candidate.type === d.routeType);
      return {
        decisionStage: "plan",
        id: d.id,
        action: d.action,
        reason: d.reason,
        routeType: d.routeType,
        host: this.#host(d.host),
        demandRatio: chosen?.demandRatio ?? null,
        capacityAssessment: assessDemandRatio(chosen?.demandRatio ?? null)
      };
    }
    #event(event) {
      let data, important = false;
      switch (event.type) {
        case "route-decision":
        case "route-planned": {
          data = this.#decision(event.decision);
          if (this.verbose()) {
            const ranking = { ...data, ranking: event.decision.ranking.slice(0, 12).map((row) => ({
              host: this.#host(row.candidate.host),
              state: row.state,
              eligible: row.eligible,
              reasons: row.reasons,
              safeMbps: row.safeThroughputMbps,
              demandRatio: row.demandRatio,
              ttfbMs: row.medianTtfbMs
            })) };
            const signature = JSON.stringify(ranking.ranking);
            if (!this.#rankings.some((row) => JSON.stringify(row.ranking) === signature)) this.#rankings.push(ranking);
            while (this.#rankings.length > 4 || bytes(this.#rankings) > 12 * 1024) {
              this.#rankings.shift();
              this.#counters.rankingEvicted++;
            }
          }
          break;
        }
        case "transport":
        case "transport-completed":
          data = { ...this.#transport(event.observation), detached: event.type === "transport-completed" && event.detached };
          important = true;
          break;
        case "route-confirmed":
          data = this.#transport(event.observation);
          important = true;
          break;
        case "route-observed":
          data = { routeType: event.routeType, host: this.#host(event.host), decisionId: event.decisionId };
          important = true;
          break;
        case "request-started":
          data = this.#request(event.request);
          break;
        case "attribution-changed":
          data = { requestId: event.requestId, status: event.status, kind: event.kind };
          break;
        case "recovery":
          data = {
            action: event.action.action,
            actionId: event.action.id,
            ...event.action.action === "route-fallback" ? { kind: event.action.kind, identity: event.action.identity, decision: this.#decision(event.action.decision) } : event.action.action === "player-reload" ? { savedPositionSec: event.action.savedPositionSec, savedRate: event.action.savedRate } : { reason: event.action.reason }
          };
          important = true;
          break;
        case "core":
        case "core-uninitialized":
          data = {
            ...event,
            ...event.type === "core" && event.state === "recovered" ? { meaning: "player-core-progress-only" } : {}
          };
          important = true;
          break;
        case "lifecycle":
          data = { generation: event.generation, epoch: event.epoch, reason: event.reason };
          important = true;
          break;
      }
      return { at: event.at, type: event.type, data, important };
    }
    #trigger(event) {
      if (event.type === "core-uninitialized") return "core:uninitialized";
      if ((event.type === "transport" || event.type === "transport-completed") && event.observation.outcome === "failure" && !(event.type === "transport-completed" && event.detached)) return "transport:" + (event.observation.failureKind ?? "failure");
      if (event.type === "recovery") return "recovery:" + event.action.action;
      if (event.type === "core" && ["reloading", "failed"].includes(event.state)) return "core:" + event.state;
      return null;
    }
    #start(reason, at) {
      if (this.#incident?.state === "capturing") {
        this.#incident.captureUntil = Math.min(this.#incident.startedAt + 9e4, at + 3e4);
        return;
      }
      if (this.#incident) this.#counters.incidentReplaced++;
      this.#incident = {
        id: "incident-" + ++this.#serial,
        reason,
        startedAt: at,
        captureUntil: at + 3e4,
        state: "capturing",
        events: this.#events.filter((event) => at - event.at <= 6e4).map((event) => structuredClone(event)),
        flow: this.#flows(),
        playerTrace: this.#recentPlayerTrace.map((item) => item.row),
        playerTraceFormat: "atMs,currentTimeDeciSec,frameDelta,playableBufferDeciSec,readyState,flags,watchdog",
        playerTraceFlags: "1=paused,2=seeking,4=ended,8=coreFalse,16=coreTrue"
      };
    }
    #trim(rows, max, counter) {
      while (bytes(rows) > max && rows.length > 1) {
        let index = rows.findIndex((row) => !row.important);
        if (index < 0) index = rows.findIndex((row) => row.at !== this.#incident?.startedAt);
        rows.splice(index < 0 ? 0 : index, 1);
        this.#counters[counter]++;
      }
    }
    #bound() {
      while (bytes(this.snapshot()) > 128 * 1024) {
        if (this.#rankings.length) {
          this.#rankings.shift();
          this.#counters.rankingEvicted++;
        } else if (this.#incident?.playerTrace.length) {
          this.#incident.playerTrace.shift();
          this.#counters.traceEvicted++;
        } else if (this.#flow.size > 1) {
          this.#flow.delete(this.#flow.keys().next().value);
          this.#counters.flowEvicted++;
        } else if (this.#events.length > 1) {
          this.#events.shift();
          this.#counters.evicted++;
        } else if (this.#pending.size) {
          this.#pending.delete(this.#pending.keys().next().value);
          this.#counters.pendingEvicted++;
        } else if (this.#incident && this.#incident.events.length > 1) {
          this.#incident.events.shift();
          this.#counters.incidentEvicted++;
        } else if (this.#attempts.length > 1) {
          this.#attempts.shift();
          this.#counters.attemptEvicted++;
        } else break;
      }
    }
    #host(host) {
      if (!host || isCatalogHost(host) || isKnownNativeFamily(host)) return host;
      if (this.#aliases.has(host)) return this.#aliases.get(host) ?? "external";
      if (this.#aliases.size >= 64) return "external#overflow";
      const alias = "external#" + (this.#aliases.size + 1);
      this.#aliases.set(host, alias);
      return alias;
    }
    #sanitize(value, key = "", depth = 0) {
      if (depth > 7) return "[bounded]";
      if (typeof value === "string") return key.toLowerCase().includes("host") ? this.#host(value) : text2(value, 160);
      if (value === null || typeof value === "number" || typeof value === "boolean") return value;
      if (Array.isArray(value)) return value.slice(0, 48).map((item) => this.#sanitize(item, key, depth + 1));
      if (!value || typeof value !== "object") return null;
      return Object.fromEntries(Object.entries(value).slice(0, 48).filter(([name]) => !["streamKey", "url", "path", "query", "token"].includes(name)).map(([name, item]) => [name, this.#sanitize(item, name, depth + 1)]));
    }
  };

  // src-v2/ui/control-center.ts
  var css = `
:host{all:initial;color-scheme:dark}*{box-sizing:border-box}.backdrop{position:fixed;inset:0;z-index:2147483647;background:#000a;display:grid;place-items:center;padding:18px;font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;color:#eef6ff}.dialog{width:min(760px,100%);max-height:88vh;display:flex;flex-direction:column;background:#101a2b;border:1px solid #405169;border-radius:12px;box-shadow:0 20px 70px #000d}.head,.foot{display:flex;align-items:center;gap:8px;padding:14px 16px;border-bottom:1px solid #34445b}.head{justify-content:space-between}.foot{justify-content:flex-end;border:0;border-top:1px solid #34445b;flex-wrap:wrap}.body{padding:14px 16px;overflow:auto;display:grid;gap:12px}h2,h3,p{margin:0}.summary{white-space:pre-wrap;color:#cfe5ff}.grid{display:grid;gap:7px}.row{display:flex;align-items:center;gap:10px;padding:8px;border:1px solid #34445b;border-radius:7px;background:#162338}.row label{flex:1;overflow-wrap:anywhere}.detail{font-size:12px;color:#9fb3ca}.btn,select{font:inherit;border:1px solid #52657e;border-radius:7px;background:#213149;color:#f6fbff;padding:7px 11px}.btn{cursor:pointer}.btn.primary{background:#075985;border-color:#0ea5e9}.btn.danger{background:#7f1d1d;border-color:#f87171}.report{width:100%;height:min(52vh,520px);background:#050a12;color:#dbeafe;border:1px solid #405169;border-radius:8px;padding:10px;font:12px/1.5 ui-monospace,Consolas,monospace;resize:vertical}
`;
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
    recovering: "正在嘗試恢復"
  }), "playbackLabel");
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
  var recoveryReasonLabel = /* @__PURE__ */ __name((reason) => plain(reason, {
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
  }, "原因請見診斷報告"), "recoveryReasonLabel");
  var measurementLabel = /* @__PURE__ */ __name((state, reason) => {
    const why = String(reason);
    if (why.startsWith("manual-")) return `已安排測速，${measurementLabel("waiting", why.slice(7))}`;
    if (why.startsWith("candidate-")) return "正在測試 CDN 速度";
    if (why.startsWith("http-")) return `測試網址收到 HTTP ${why.slice(5)}，沒有取得有效速度`;
    return plain(why, {
      disabled: "腳本已停用",
      "no-representation": "尚未確認目前的影片資料",
      hidden: "分頁不在前景",
      seeking: "正在跳轉影片",
      recovering: "正在恢復播放",
      "awaiting-progress": "等待影片穩定播放",
      "low-buffer": "緩衝還不夠，暫不測速",
      "cross-tab-cooldown": "其他分頁最近測過速，等待冷卻",
      "no-stale-candidate": "目前沒有需要測試的 CDN",
      "sample-recorded": "已記下測速結果",
      "short-response": "下載資料太少，無法判斷速度",
      timeout: "測速逾時",
      network: "測速時網路失敗",
      startup: "等待播放",
      generation: "等待新影片"
    }, plain(state, {
      idle: "尚未測速",
      waiting: "等待安全的測速時機",
      running: "正在測速",
      complete: "已完成測速",
      failed: "這次測速沒有結果",
      cancelled: "已停止測速"
    }));
  }, "measurementLabel");
  var startupLabel = /* @__PURE__ */ __name((state, reason) => {
    if (state === "running") return "正在起播前測試可用路線（最長 3 秒）";
    if (state === "complete") return reason === "measured" ? "已測試並選好起播路線" : "已選好合法起播路線，測試沒有明確結果";
    if (state === "skipped") return plain(reason, {
      "unsupported-or-no-legal-candidate": "這筆請求無法安全預測試，後續依目前選路設定處理",
      "preflight-error": "預測試未完成，後續依目前選路設定處理"
    }, "這筆請求未進行起播預測試");
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
    #open = false;
    show(opener) {
      this.#open = true;
      this.#opener = opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      this.#ensure();
      this.#renderOverview();
    }
    close() {
      this.#open = false;
      this.#viewVersion++;
      if (this.#shadow) this.#shadow.replaceChildren(this.#style());
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
      this.#host = document.createElement("div");
      this.#host.id = "bilicdn-v2-control-center";
      this.#shadow = this.#host.attachShadow({ mode: "closed" });
      this.#shadow.append(this.#style());
      document.documentElement.append(this.#host);
      this.#shadow.addEventListener("keydown", (event) => {
        const keyboard = event;
        if (!keyboard.isTrusted || keyboard.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        this.close();
      });
    }
    #style() {
      const style = document.createElement("style");
      style.textContent = css;
      return style;
    }
    #shell(title) {
      const version = ++this.#viewVersion;
      const backdrop = document.createElement("div");
      backdrop.className = "backdrop";
      const dialog = document.createElement("section");
      dialog.className = "dialog";
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      const head = document.createElement("header");
      head.className = "head";
      const heading = document.createElement("h2");
      heading.textContent = title;
      const close = this.#button("關閉", () => this.close());
      close.dataset.action = "close";
      head.append(heading, close);
      const body = document.createElement("div");
      body.className = "body";
      const foot = document.createElement("footer");
      foot.className = "foot";
      dialog.append(head, body, foot);
      backdrop.append(dialog);
      this.#shadow?.replaceChildren(this.#style(), backdrop);
      queueMicrotask(() => {
        if (this.#ownsView(version)) close.focus();
      });
      return { body, foot };
    }
    #renderOverview() {
      const { body, foot } = this.#shell("BiliCDN v2 控制中心");
      const state = this.deps.session.get(), settings = this.deps.settings.get(), monitor = this.deps.monitor.snapshot();
      const affinity = state.affinity ? `${state.affinity.host}（${routeLabel(state.affinity.type)}）` : "尚未確認";
      const summary = document.createElement("p");
      summary.className = "summary";
      const sourceMode = settings.considerNativeSources ? "可參考 B 站原生來源" : "僅內建 CDN";
      const mode = settings.disabled ? "腳本已停用，網站自行選擇 CDN" : this.deps.routes.isOriginalComparison() ? "本分頁只用 B 站提供的網址（對照測試）" : settings.fixedHost ? `優先固定 ${settings.fixedHost}（${sourceMode}）` : `自動挑選 CDN（${sourceMode}）`;
      const recovery = this.deps.recovery.snapshot(), measurement = this.deps.measurement.snapshot();
      summary.textContent = `腳本：${settings.disabled ? "已停用" : "已啟用"}｜CDN：${mode}
選定路線：${affinity}（實際請求見下方）
播放：${playbackLabel(monitor.watchdog)}｜已緩衝約 ${monitor.video.playableBufferSec.toFixed(1)} 秒可播放內容｜${monitor.video.effectiveRate} 倍速
播放器：${recoveryLabel(recovery.state)}｜測速：${measurementLabel(measurement.state, measurement.reason)}`;
      if (recovery.state === "failed" || recovery.state === "recovered-paused") summary.textContent += `｜${recoveryReasonLabel(recovery.reason)}`;
      if (measurement.startup) summary.textContent += `
起播前測試：${startupLabel(measurement.startup.state, measurement.startup.reason)}`;
      const hook = this.deps.transport.snapshot();
      summary.textContent += `
請求攔截：${plain(hook.hookState, { installed: "運作中", degraded: "部分失效", failed: "無法啟用", "not-installed": "未啟用" })}｜腳本看到 ${Number(hook.enteredFetch) + Number(hook.enteredXhr)} 筆請求，其中 ${hook.mediaRecognized} 筆像是影音請求；交給瀏覽器 ${hook.nativeCalled} 筆，看到回應 ${hook.responseObserved} 筆`;
      if (!settings.disabled && !settings.considerNativeSources && !this.deps.routes.isOriginalComparison() && hook.hookState !== "installed") {
        summary.textContent += "\n請求攔截未完整，無法確認影音只依內建 CDN 選路；請以 Chrome「網路」面板核對。";
      }
      const lastHook = hook.lastMediaRequest;
      if (lastHook) summary.textContent += `
最近一筆影音請求：${plain(lastHook.kind, { video: "影片", audio: "音訊", unknown: "尚未分類" })}，送往 ${lastHook.targetHost ?? "未知"}｜${lastHook.nativeCalled ? "已交給瀏覽器" : "未交給瀏覽器"}｜${lastHook.responseObserved ? `收到回應${lastHook.status ? `（HTTP ${lastHook.status}）` : ""}` : "尚未看到回應"}`;
      const lastBlocked = hook.lastBlocked;
      if (lastBlocked) summary.textContent += `
最近擋下的請求：${lastBlocked.host}｜原因：${restrictionLabel(lastBlocked.reason)}｜沒有送給瀏覽器`;
      const playurl = hook.lastPlayurl;
      if (playurl) {
        const formats = playurl.formats.map((format) => plain(format, { dash: "DASH", mp4: "MP4", flv: "FLV" })).join("／") || "未辨識";
        summary.textContent += `
最近播放資料：${playurl.transport === "fetch" ? "Fetch" : "XHR"}｜${playurl.accepted ? "已接納" : "未接納"}｜格式：${formats}｜影片 ${playurl.videoCount}、音訊 ${playurl.audioCount}、分段 ${playurl.segmentCount}`;
        if (playurl.status) summary.textContent += `｜上游 HTTP ${playurl.status}`;
        if (playurl.upstreamCode !== null) summary.textContent += `｜上游代碼 ${playurl.upstreamCode}`;
        if (playurl.reason) summary.textContent += `｜原因：${plain(playurl.reason, {
          "upstream-error": "B 站回報錯誤",
          "unsupported-format": "不支援的資料格式",
          "malformed-payload": "播放資料無法解析",
          "unreplaceable-source": "來源網址無法安全改寫",
          "no-legal-route": "沒有合法路線",
          inactive: "處理時已停用或影片已切換"
        })}`;
      }
      const routes = this.deps.routes.snapshot(), latest = routes.latest;
      const routeRecovery = this.deps.diagnostics.snapshot().routeRecovery;
      const lastAttempt = routeRecovery.attempts.at(-1);
      if (lastAttempt) summary.textContent += `
影片備援接手：${lastAttempt.host ?? "未知 Host"}｜${plain(lastAttempt.stage, {
        planned: "已選定，尚未看到請求",
        sent: "已送出請求",
        "progress-unconfirmed": "播放器有進度，路線仍待確認",
        "response-observed": "已收到影片資料，播放接手待確認",
        "playback-observed": "播放進度與新路線接手一致",
        "mixed-evidence": "同時收到其他 Host 資料，無法歸因",
        unconfirmed: "30 秒內未取得足夠證據",
        superseded: "已由下一條備援取代",
        interrupted: "觀察因模式或影片切換中止"
      })}`;
      const activePlan = routes.activePlan;
      const selected = activePlan?.ranking?.find((row) => row.host === activePlan.host && row.type === activePlan.routeType);
      if (activePlan?.host) summary.textContent += `
目前路線容量：${plain(assessDemandRatio(selected?.ratio ?? null), {
        "below-required": "低於本次需求",
        "below-headroom": "未達安全餘量",
        "meets-headroom": "達到安全餘量",
        unknown: "速度樣本不足"
      })}${selected?.ratio == null || !Number.isFinite(selected.ratio) ? "" : `（保守速度約為需求的 ${selected.ratio.toFixed(2)} 倍）`}`;
      for (const [kind, label] of [["video", "影片"], ["audio", "音訊"], ["unknown", "尚未分類媒體"]]) {
        const row = latest[kind];
        if (!row) {
          if (kind !== "unknown") summary.textContent += `
${label}：還沒有可確認的請求`;
          continue;
        }
        const age = Math.max(0, Math.floor((this.deps.now() - Number(row.observedAt)) / 1e3));
        summary.textContent += `
${label}：送往 ${row.targetHost ?? "未知"} → ${row.responseHost ? `回應來自 ${row.responseHost}` : "尚未取得回應來源"}｜${age} 秒前｜${plain(row.outcome, { success: "成功", failure: "失敗", abort: "已取消" })}${row.status ? `（HTTP ${row.status}）` : ""}
  腳本在送出前換 CDN：${row.hostChanged === true ? "有" : row.hostChanged === false ? "沒有" : "尚未確認"}｜提供播放器時換 CDN：${row.playurlHostChanged === true ? "有" : row.playurlHostChanged === false ? "沒有" : "尚未確認"}｜這筆請求：${attributionLabel(row.attributionStatus)}`;
        const output = row.playurlOutput;
        if (output) summary.textContent += `
  播放器取得的${output.role === "backup" ? "備用" : "主要"}網址：${output.originalHost} → ${output.outputHost}`;
      }
      const rep = routes.representation;
      summary.textContent += `
目前畫質：${rep ? `${rep.height}p / ${rep.codec}` : attributionLabel(routes.attribution)}`;
      const fallback = routes.fallback;
      for (const [kind, label] of [["video", "影片"], ["audio", "音訊"]]) {
        const row = fallback[kind];
        const stage = plain(row?.stage, {
          planned: "已選好，但還沒看到新請求",
          "entered-hook": "腳本看到新請求，尚未確認有回應",
          "response-observed": "已看到備用路線的回應",
          "request-failed": "備用路線請求失敗"
        });
        if (row) summary.textContent += `
${label}備用路線：${row.plannedHost}｜${stage}` + (row.responseHost ? `｜回應來自 ${row.responseHost}${row.status ? `（HTTP ${row.status}）` : ""}` : "");
      }
      summary.textContent += "\n※ 上述請求與回應由腳本觀察；要確認瀏覽器實際送出的網址，仍須查看 Chrome「網路」面板。";
      body.append(summary);
      const actions = document.createElement("div");
      actions.className = "grid";
      const measurementButton = this.#button("安排測速（不會立即換 CDN）", () => {
        this.deps.commands.requestMeasurement();
        this.#renderOverview();
      });
      const blacklistButton = this.#button("封鎖最近成功回應的影片 CDN 24 小時（影片＋音訊）", () => this.#refreshAfter(this.deps.commands.blacklistLatestVideo(), () => this.#renderOverview()), "danger");
      actions.append(
        this.#button(settings.disabled ? "啟用腳本" : "停用腳本", () => this.#refreshAfter(this.deps.commands.updateSettings({ disabled: !settings.disabled }), () => this.#renderOverview()), "primary"),
        this.#button("CDN 與播放設定", () => this.#renderSettings()),
        this.#button("查看診斷報告", () => this.#renderDiagnostics()),
        measurementButton,
        blacklistButton,
        this.#button("清除測速紀錄、黑名單與故障標記", () => this.#refreshAfter(this.deps.commands.clearLearning(), () => this.#renderOverview()), "danger"),
        this.#button("還原預設設定（不清除測速紀錄）", () => this.#refreshAfter(this.deps.commands.resetSettings(), () => this.#renderOverview()), "danger")
      );
      if (!this.deps.routes.latestVideoHost()) {
        blacklistButton.disabled = true;
        blacklistButton.textContent = "最近 60 秒沒有成功的影片請求，暫時無法指定要封鎖的 CDN";
      }
      if (this.deps.routes.isOriginalComparison()) {
        measurementButton.disabled = true;
        measurementButton.textContent = "對照測試期間不測速";
      }
      body.append(actions);
      foot.append(this.#button("關閉", () => this.close()));
    }
    #renderSettings() {
      const { body, foot } = this.#shell("CDN 與播放設定");
      const settings = this.deps.settings.get(), rows = document.createElement("div");
      rows.className = "grid";
      const mode = document.createElement("select");
      mode.append(new Option("由腳本自動挑選 CDN", ""), ...TRUSTED_CATALOG.map((host) => new Option(`固定使用：${host}`, host)));
      mode.value = settings.fixedHost ?? "";
      mode.addEventListener("change", (event) => {
        if (!event.isTrusted) return;
        void this.#refreshAfter(this.deps.commands.updateSettings({ fixedHost: mode.value || null }), () => this.#renderSettings());
      });
      rows.append(this.#row("要如何選 CDN", mode, "自動模式會參考可用性與測速結果；固定模式優先使用你指定的節點，但仍會避開已禁止使用的節點。"));
      rows.append(this.#toggle(
        "允許參考 B 站原生來源",
        settings.considerNativeSources,
        (value) => {
          const pending = this.deps.commands.updateSettings({ considerNativeSources: value });
          if (!value) this.#renderSettings();
          return this.#refreshAfter(pending, () => this.#renderSettings());
        },
        "預設關閉。關閉時，腳本辨識到的影音只依內建 CDN 清單選路、測速及提供播放器備援；無法安全改寫或沒有合法內建 CDN 時會擋下請求。開啟後，B 站當次提供的原始與備用網址可參與選路。下方的原生對照測試模式獨立運作；已送出的請求不會取消。"
      ));
      rows.append(this.#toggle("測試：只用 B 站原本提供的 CDN", this.deps.routes.isOriginalComparison(), (enabled) => {
        this.deps.commands.setOriginalComparison(enabled);
        this.#renderSettings();
      }, "只影響這個分頁。新影片只用 B 站提供的原始或備用網址；被禁止的 CDN 仍不會使用。測試期間不測速，也不自動換 CDN。請先開新測試分頁、啟用後再點進影片；已經交給播放器的網址不會倒回重選。重新整理頁面即可退出。"));
      const codec = document.createElement("select");
      for (const value of ["av1", "hevc", "avc", "auto"]) codec.append(new Option({ av1: "AV1", hevc: "H.265／HEVC", avc: "H.264／AVC", auto: "由 B 站決定" }[value], value));
      codec.value = settings.codec;
      codec.addEventListener("change", (event) => {
        if (event.isTrusted) void this.deps.commands.updateSettings({ codec: codec.value });
      });
      rows.append(this.#row("偏好的影片格式", codec, "下次取得新的影片播放網址時生效；這不會強制改變你現在的播放倍速。"));
      rows.append(this.#toggle(
        "阻止網頁使用 WebRTC",
        settings.blockWebRtc,
        (value) => this.deps.commands.updateSettings({ blockWebRtc: value }),
        "避免網頁建立點對點連線；不熟悉這項功能時，可維持預設值。"
      ));
      rows.append(this.#toggle(
        "阻止網頁使用 HTTPDNS",
        settings.blockHttpDns,
        (value) => this.deps.commands.updateSettings({ blockHttpDns: value }),
        "避免網頁透過 HTTPDNS 另行尋找 CDN；不熟悉這項功能時，可維持預設值。"
      ));
      rows.append(this.#toggle(
        "記錄更多診斷細節",
        settings.verbose,
        (value) => this.deps.commands.updateSettings({ verbose: value }),
        "開啟後會多記錄選路與測速資訊；關閉時仍會保留重要故障。記錄只存在目前分頁，重新整理後清空。"
      ));
      for (const host of TRUSTED_CATALOG) {
        const defaultEnabled = !DEFAULT_UNAVAILABLE_HOSTS.has(host);
        const enabled = settings.catalogOverrides[host] ?? defaultEnabled;
        const penalties = this.deps.restrictions.list().filter((row) => row.host === host).map((row) => `${restrictionLabel(row.type)}（${row.kind === "all" ? "影片＋音訊" : row.kind === "video" ? "影片" : "音訊"}）`);
        const detail = `${defaultEnabled ? "預設可用的內建 CDN" : "預設標為不可用；勾選後才允許"}${penalties.length ? `｜目前仍被禁止：${penalties.join("、")}；勾選不會解除禁止` : ""}`;
        rows.append(this.#toggle(host, enabled, async (value) => {
          await this.deps.commands.setCatalogEnabled(host, value);
        }, detail));
      }
      body.append(rows);
      foot.append(this.#button("返回", () => this.#renderOverview()));
    }
    #renderDiagnostics() {
      const { body, foot } = this.#shell("診斷報告");
      const help = document.createElement("p");
      help.className = "detail";
      help.textContent = "遇到卡頓時，按「記下剛剛的卡頓」，再複製報告提供排查。下方是給排查用的詳細資料；只看播放狀態可返回首頁。清除事故只刪除本分頁的事故記錄，不會變更 CDN 設定。";
      body.append(help);
      const report = document.createElement("textarea");
      report.className = "report";
      report.readOnly = true;
      report.value = this.deps.diagnostics.buildReport(this.#readModel());
      body.append(report);
      foot.append(
        this.#button("記下剛剛的卡頓", () => {
          this.deps.diagnostics.mark();
          this.#renderDiagnostics();
        }),
        this.#button("清除本分頁事故記錄", () => {
          this.deps.diagnostics.clear();
          this.#renderDiagnostics();
        }),
        this.#button("複製報告", () => {
          try {
            GM_setClipboard(report.value);
          } catch {
            void navigator.clipboard?.writeText(report.value);
          }
        }),
        this.#button("返回", () => this.#renderOverview())
      );
    }
    #readModel() {
      const now = this.deps.now(), evidence = this.deps.evidence.list().slice(0, 96).map((row) => ({ host: row.host, kind: row.kind, ...evidenceMetrics(row, now) }));
      return Object.freeze({
        version: GM_info?.script?.version ?? "2.1.1",
        settings: this.deps.settings.get(),
        session: this.deps.session.get(),
        monitor: this.deps.monitor.snapshot(),
        recovery: this.deps.recovery.snapshot(),
        measurement: this.deps.measurement.snapshot(),
        interception: this.deps.transport.snapshot(),
        routes: this.deps.routes.snapshot(),
        restrictions: this.deps.restrictions.list(),
        evidence
      });
    }
    #ownsView(version) {
      return this.#open && this.#viewVersion === version;
    }
    async #refreshAfter(command, render) {
      const version = this.#viewVersion;
      await command;
      if (this.#ownsView(version)) render();
    }
    #button(label, action, tone = "") {
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
    #row(label, control, detail = "") {
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
    #toggle(label, checked, update, detail = "") {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = checked;
      input.addEventListener("change", (event) => {
        if (!event.isTrusted) {
          input.checked = checked;
          return;
        }
        ;
        void update(input.checked);
      });
      return this.#row(label, input, detail);
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
      button.textContent = "⚙️ 開啟 BiliCDN 設定與診斷";
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
      const id = setTimeout(task, delayMs);
      return () => clearTimeout(id);
    }
    interval(task, delayMs) {
      const id = setInterval(task, delayMs);
      return () => clearInterval(id);
    }
    microtask(task) {
      queueMicrotask(task);
    }
  };

  // src-v2/adapters/navigation.ts
  var BrowserNavigation = class {
    static {
      __name(this, "BrowserNavigation");
    }
    key() {
      return `${location.pathname}${location.search}`.slice(0, 512);
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
    const clock = { now };
    const scheduler = new BrowserScheduler();
    const storage = new TampermonkeyStorage();
    const settings = new SettingsStore(storage, now);
    const restrictions = new RestrictionStore(storage, now);
    const evidence = new EvidenceStore(storage, now);
    const session = new SessionStore();
    const vault = new SignedRouteVault();
    const ids = createRuntimeIds();
    const routes = new RouteCoordinator(clock, session, settings, restrictions, evidence, vault, ids);
    const meta = new MeasurementMetaStore(storage, now);
    const content = new PlayurlController(session, vault, routes, settings);
    const playurl = new PlayurlAdapter(content);
    const visibility = new VisibilityAdapter();
    const player = new PlayerAdapter(playurl, {
      scheduler,
      isActuallyVisible: /* @__PURE__ */ __name(() => visibility.isActuallyVisible(), "isActuallyVisible"),
      subscribeControlLoss: /* @__PURE__ */ __name((listener) => visibility.subscribeControlLoss(listener), "subscribeControlLoss")
    });
    const recovery = new RecoveryController(
      player,
      now,
      () => !settings.get().disabled && !routes.isOriginalComparison() && visibility.isActuallyVisible(),
      () => {
        const request = routes.latestRequested("video");
        return () => !!request && routes.recoveryEligible(request) && routes.latestRequested("video")?.representation === request.representation;
      }
    );
    const nativeFetch = unsafeWindow.fetch.bind(unsafeWindow);
    const measurement = new MeasurementController(routes, meta, new RangeProbeAdapter(nativeFetch, now), now, scheduler);
    const transport = new TransportAdapter(session, settings, routes, playurl, measurement, now, ids);
    transport.install();
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
      scheduler
    );
    const diagnostics = new DiagnosticRecorder(now, () => settings.get().verbose);
    const runtime = new RuntimeController(session, settings, routes, player, monitor, measurement, recovery, visibility, diagnostics, now, content);
    let lifecycle = null;
    const pagePlayinfo = new PagePlayinfoAdapter(
      (payload, serial) => lifecycle?.acceptPageAssignment(payload, serial),
      () => !settings.get().disabled && routes.isCatalogOnly()
    );
    lifecycle = new LifecycleController(session, settings, vault, routes, playurl, pagePlayinfo, runtime, now, new BrowserNavigation(), scheduler);
    const webRtc = new WebRtcAdapter(settings);
    const commands = new ControlCommands(settings, restrictions, evidence, meta, routes, measurement, recovery, now);
    const center = new ControlCenter({
      settings,
      restrictions,
      evidence,
      session,
      routes,
      measurement,
      monitor,
      recovery,
      transport,
      diagnostics,
      commands,
      now
    });
    const panel = new PlayerPanel(center, settings, session, monitor);
    lifecycle.subscribe((event) => runtime.record(event));
    runtime.install();
    webRtc.install();
    lifecycle.start();
    panel.start();
    try {
      GM_registerMenuCommand("⚙️ 開啟 BiliCDN v2 控制中心", () => center.show());
    } catch {
    }
  }, "start");
  start();
})();
