// ==UserScript==
// @name         Bilibili CDN 台灣優化
// @namespace    BiliCDN_TW
// @version      2.1.37
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
      let bytes = 0, responseAt = null;
      let range = null;
      const result = /* @__PURE__ */ __name((status, directRange, reason) => ({
        status,
        range,
        directRange,
        reason,
        bytes,
        elapsedMs: Math.max(1, this.now() - startedAt),
        ttfbMs: responseAt === null ? null : responseAt - startedAt
      }), "result");
      try {
        const startByte = input.startByte ?? 0;
        if (!Number.isSafeInteger(startByte) || startByte < 0 || !Number.isSafeInteger(input.limit) || input.limit <= 0 || !Number.isSafeInteger(startByte + input.limit - 1))
          return result(null, false, "invalid-range");
        if (input.signal.aborted)
          return result(null, false, input.signal.reason === "timeout" ? "timeout" : "cancelled");
        const response = await this.nativeFetch(input.url, {
          method: "GET",
          headers: { Range: `bytes=${startByte}-${startByte + input.limit - 1}` },
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
        const header = response.headers.get("Content-Range");
        if (header !== null) range = parseProbeRange(header, startByte, input.limit);
        if (header !== null && !range || startByte > 0 && !range) {
          await response.body.cancel("range-mismatch");
          return result(response.status, false, "range-mismatch");
        }
        const reader = response.body.getReader();
        try {
          while (bytes < input.limit && !input.signal.aborted) {
            const item = await reader.read();
            if (item.done) break;
            bytes = Math.min(input.limit, bytes + item.value.byteLength);
            if (bytes >= input.limit) {
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
        while (this.#responses.size > 128)
          this.#responses.delete(this.#responses.values().next().value);
      }
      const state = this.session.get();
      for (const [kind, items] of [
        ["video", dash.video],
        ["audio", dash.audio]
      ]) {
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
              if (source === "page-hint" && catalogOnly)
                this.#sanitizeKnownItem(item, rep2, kind, "page-hint", false, rewriteItem2);
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
              const backups = this.routes.isCatalogOnly() ? [] : primaryOutput.url ? [
                ...new Set(
                  urls.map((url) => this.routes.apply(url).url).filter((url) => !!url && url !== primaryOutput.url)
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
          const requiredMbps = Math.max(
            kind === "audio" ? 0.5 : 2,
            (bandwidth || (kind === "audio" ? 192e3 : 4e6)) / 1e6 * this.routes.playbackRate() * 1.25
          );
          const demand = { kind, requiredMbps, highDemand: requiredMbps >= 12 };
          const decision = this.routes.plan(
            rep,
            demand,
            this.session.get().affinity ? "representation" : "startup"
          );
          const output = this.routes.playerOutput(
            rep,
            primary,
            decision,
            item.progressive ? this.vault.sourceURLs(rep) : urls,
            source
          );
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
      this.#stops.push(
        this.content.subscribeEpoch((state) => {
          this.reset();
          this.record({ type: "lifecycle", at: this.now(), ...state, reason: "content-epoch" });
        })
      );
      this.#stops.push(
        this.routes.subscribe((event) => this.record(event)),
        this.recovery.subscribe((event) => this.record(event)),
        this.monitor.subscribe(
          (snapshot) => this.diagnostics.recordPlayer({
            ...this.#sample(snapshot.video, snapshot.watchdog, this.now()),
            ...snapshot.bufferTrend ? { bufferTrend: snapshot.bufferTrend } : {}
          })
        )
      );
      this.visibility.setEnabled(!this.settings.get().disabled);
      const signature = /* @__PURE__ */ __name((state) => JSON.stringify([state.fixedHost, state.catalogOverrides, state.considerNativeSources]), "signature");
      let routeSettings = signature(this.settings.get());
      this.#stops.push(
        this.settings.subscribe((state) => {
          this.visibility.setEnabled(!state.disabled);
          const next = signature(state);
          if (next !== routeSettings) {
            routeSettings = next;
            this.routes.invalidateForUserSetting();
            this.measurement.reset();
            this.recovery.reset();
          }
        })
      );
    }
    record(event) {
      this.diagnostics.record(
        event,
        !this.settings.get().disabled && !this.routes.isOriginalComparison()
      );
      if (event.type === "transport-completed" && !event.detached) {
        const o = event.observation, request = o.request;
        if (request && request.kind === "video" && o.kind === "video" && request.attributionStatus === "matched" && request.representation === o.representation && request.generation === o.generation && request.epoch === o.epoch && request.targetHost === o.targetHost && (o.outcome !== "success" || o.finalHost === o.targetHost && o.responseUrlMatchesRequest !== false))
          this.monitor.observeTransport({
            request: {
              requestId: request.requestId,
              generation: request.generation,
              epoch: request.epoch,
              representation: request.representation,
              routePolicyRevision: request.routePolicyRevision,
              ...request.authorityRevision !== void 0 ? { authorityRevision: request.authorityRevision } : {},
              targetHost: request.targetHost
            },
            startedAt: request.startedAt,
            completedAt: o.completedAt,
            bytes: o.bytes,
            status: o.status,
            outcome: o.outcome
          });
      }
      if (event.type === "recovery" && event.action.action === "route-fallback" && event.action.kind === "video" && !this.routes.isOriginalComparison()) {
        const snapshot = this.player.snapshot();
        this.diagnostics.recordPlayer(
          this.#sample(snapshot, this.monitor.snapshot().watchdog, event.at)
        );
        const request = this.routes.latestRequested("video");
        this.recovery.armRouteFailure(
          "route-failure",
          snapshot,
          () => !!request && this.routes.recoveryEligible(request) && this.routes.latestRequested("video")?.representation === request.representation
        );
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
      if (host)
        await this.restrictions.add({
          host,
          type: "black",
          kind: "all",
          reason: "user",
          expireAt: this.now() + 24 * 60 * 60 * 1e3
        });
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
      return parse(this.storage.get(MEASUREMENT_META_KEY, null), timeValue(this.now()) ?? 0);
    }
    update(change) {
      const now = timeValue(this.now()) ?? 0;
      const current = parse(this.storage.get(MEASUREMENT_META_KEY, null), now);
      this.storage.set(MEASUREMENT_META_KEY, {
        schema: 2,
        catalogCursor: cursorValue(field(change, "catalogCursor")) ?? current.catalogCursor,
        lastChallengeAt: timeValue(field(change, "lastChallengeAt"), now) ?? current.lastChallengeAt,
        updatedAt: now
      });
    }
    withLock(task) {
      return this.storage.withLock("measurement", task);
    }
    clear() {
      this.storage.delete(MEASUREMENT_META_KEY);
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
        id = GM_addValueChangeListener(
          key,
          (_name, _oldValue, value, remote) => listener(value, remote)
        );
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
          const next = parseSettings(
            { ...current, ...change, schema: 2, updatedAt: Math.max(now, current.updatedAt + 1) },
            now
          );
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
        const next = parseSettings(
          {
            ...current,
            catalogOverrides: { ...current.catalogOverrides, [host]: enabled },
            updatedAt: Math.max(now, current.updatedAt + 1)
          },
          now
        );
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
          const state = parseSettings(
            { ...defaultSettings(now), updatedAt: Math.max(now, current.updatedAt + 1) },
            now
          );
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
      await this.storage.withLock("restrictions", () => {
        const now = this.now();
        const current = parsePayload(this.storage.get(RESTRICTIONS_KEY, null), now);
        const incoming = parsePayload(
          { schema: 2, updatedAt: now, records: [{ ...record, createdAt: now, updatedAt: now }] },
          now
        );
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
          records: Object.freeze(
            current.records.filter((row) => row.host !== host || !!type && row.type !== type)
          )
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
  var CIRCUIT_BACKOFF_MS = Object.freeze([
    10 * 6e4,
    30 * 6e4,
    2 * 36e5,
    6 * 36e5
  ]);
  var finite = /* @__PURE__ */ __name((value, min, max) => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min, "finite");
  var emptyEvidence = /* @__PURE__ */ __name((host, kind) => ({
    host,
    kind,
    samples: Object.freeze([]),
    circuitLevel: 0,
    circuitUntil: 0,
    updatedAt: 0
  }), "emptyEvidence");
  var pruneSamples = /* @__PURE__ */ __name((samples, now) => Object.freeze(
    samples.filter((sample) => now - sample.at <= EVIDENCE_TTL_MS).slice(-MAX_EVIDENCE_SAMPLES)
  ), "pruneSamples");
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
    if (!evidence)
      return {
        state: "unknown",
        safeThroughputMbps: null,
        medianTtfbMs: null,
        successCount: 0,
        failureCount: 0
      };
    const samples = pruneSamples(evidence.samples, now);
    const successes = samples.filter((sample) => sample.outcome === "success");
    const failures = samples.filter((sample) => sample.outcome === "failure");
    const throughput = successes.filter(
      (sample) => sample.throughputMbps !== null && sample.throughputMbps > 0
    );
    let safe = null;
    if (throughput.length === 1) safe = (throughput[0]?.throughputMbps ?? 0) * 0.7;
    else if (throughput.length === 2)
      safe = Math.min(...throughput.map((sample) => sample.throughputMbps ?? 0));
    else if (throughput.length >= 3) {
      safe = weightedQuantile(
        throughput.map((sample) => ({
          value: sample.throughputMbps ?? 0,
          weight: Math.pow(0.5, Math.max(0, now - sample.at) / EVIDENCE_HALF_LIFE_MS)
        })),
        0.25
      );
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
      for (const rawSample of (Array.isArray(row.samples) ? row.samples : []).slice(
        -MAX_EVIDENCE_SAMPLES
      )) {
        if (!rawSample || typeof rawSample !== "object") continue;
        const sample = rawSample, at = Number(sample.at);
        if (!Number.isFinite(at) || at > now + 5 * 6e4 || now - at > EVIDENCE_TTL_MS) continue;
        const outcome = sample.outcome === "failure" ? "failure" : sample.outcome === "success" ? "success" : null;
        if (!outcome) continue;
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
            ) ? sample.failureKind : null
          })
        );
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
    return Object.freeze({
      schema: 2,
      records: Object.freeze(records),
      updatedAt: Number(raw.updatedAt) || now
    });
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
      samples: pruneSamples(
        [...samples.values()].sort((x, y) => x.at - y.at),
        now
      ),
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
    return Object.freeze({
      schema: 2,
      records: Object.freeze(records),
      updatedAt: Math.max(a.updatedAt, b.updatedAt, now)
    });
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
      return Object.freeze(
        Object.values(this.#payload.records).filter((row) => !kind || row.kind === kind)
      );
    }
    async record(host, kind, sample, valid = () => true) {
      return await this.storage.withLock("routeEvidence", () => {
        if (!valid()) return this.get(host, kind) ?? emptyEvidence(host, kind);
        const now = this.now(), latest = parsePayload2(this.storage.get(EVIDENCE_KEY, null), now);
        const key = recordKey(host, kind), prior = latest.records[key] ?? emptyEvidence(host, kind);
        const updated = addEvidenceSample(prior, sample, now);
        const incoming = { schema: 2, records: { [key]: updated }, updatedAt: now };
        const committed = mergePayload2(latest, incoming, now);
        this.storage.set(EVIDENCE_KEY, committed);
        this.#payload = committed;
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
        if (!parsed || parsed.kind !== "normal" && parsed.kind !== "unknown" && !catalogSource(raw))
          continue;
        for (const rep2 of this.#byUrl.get(parsed.url.href) ?? []) {
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
      const admitted = [
        ...new Set(
          [...new Set(input.urls)].slice(0, MAX_URLS_PER_GROUP).map((raw) => parseMediaUrl(raw)).filter(
            (parsed) => parsed && (parsed.kind === "normal" || parsed.kind === "unknown" && parsed.url.protocol === "https:" && !parsed.url.port || parsed.kind === "pcdn" && catalogSource(parsed.url.href))
          ).map((parsed) => parsed.url.href)
        )
      ];
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
      for (const raw of [...new Set(input.urls)].slice(0, MAX_URLS_PER_GROUP)) {
        const parsed = parseMediaUrl(raw);
        const opaque = parsed?.kind === "unknown" && parsed.url.protocol === "https:" && !parsed.url.port;
        const pcdnCatalogSource = parsed?.kind === "pcdn" && catalogSource(raw);
        if (!parsed || parsed.kind !== "normal" && !opaque && !pcdnCatalogSource || this.#urlChars + raw.length > MAX_URL_CHARS)
          continue;
        if (routes.some((route) => route.url === parsed.url.href)) continue;
        if (routes.length >= MAX_URLS_PER_GROUP) {
          this.registerAlias(rep, parsed.url.href);
          continue;
        }
        const handle = signedRouteHandle(`route:${rep}:${++this.#handleSerial}`);
        routes.push(
          Object.freeze({
            handle,
            host: parsed.host,
            url: parsed.url.href,
            order: routes.length,
            activelyExplorable: !opaque && !pcdnCatalogSource && isKnownNativeFamily(parsed.host),
            selectable: !opaque && !pcdnCatalogSource
          })
        );
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
      this.#groups.set(
        rep,
        Object.freeze({
          identity,
          height: input.height,
          codec: input.codec.slice(0, 48),
          bandwidth: input.bandwidth,
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
    groupSummary(representation) {
      const group = this.#groups.get(representation);
      return group ? Object.freeze({
        kind: group.identity.kind,
        height: group.height,
        codec: group.codec,
        bandwidth: group.bandwidth,
        routeCount: group.routes.length
      }) : null;
    }
  };

  // src-v2/domain/route-policy.ts
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
    if (input.blackHosts.has(host)) return "black";
    if (input.deadHosts.has(host)) return "dead";
    if (input.overrides[host] === false) return "catalog-disabled";
    if (DEFAULT_UNAVAILABLE_HOSTS.has(host) && input.overrides[host] !== true)
      return "default-unavailable";
    return input.circuitUntil > now ? "circuit-open" : null;
  }
  __name(hardRestriction, "hardRestriction");

  // src-v2/domain/routing.ts
  var restrictionReasons = /* @__PURE__ */ __name((candidate, input, now) => {
    const reasons2 = [];
    const host = candidate.host;
    if (input.restrictions.disabledCatalogHosts.has(host)) reasons2.push("catalog-disabled");
    if (input.restrictions.defaultUnavailableHosts.has(host)) reasons2.push("default-unavailable");
    if (input.restrictions.blackHosts.has(host)) reasons2.push("black");
    if (input.restrictions.deadHosts.has(host)) reasons2.push("dead");
    if (input.restrictions.hostLocked.has(host)) reasons2.push("host-lock");
    if (input.failedHost === host && (input.boundary === "verified-failure" || input.boundary === "watchdog"))
      reasons2.push("circuit-open");
    const evidence = input.evidenceFor(host, candidate.kind);
    if (evidence && evidence.circuitUntil > now) reasons2.push("circuit-open");
    return [...new Set(reasons2)];
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
      const reasons2 = restrictionReasons(candidate, input, now);
      const metrics = evidenceMetrics(input.evidenceFor(candidate.host, candidate.kind), now);
      const state = reasons2.length ? "forbidden" : metrics.state;
      return Object.freeze({
        candidate,
        state,
        eligible: reasons2.length === 0,
        reasons: Object.freeze(reasons2),
        safeThroughputMbps: metrics.safeThroughputMbps,
        demandRatio: metrics.safeThroughputMbps === null ? null : metrics.safeThroughputMbps / Math.max(1e-3, input.demand.requiredMbps),
        medianTtfbMs: metrics.medianTtfbMs,
        successCount: metrics.successCount,
        failureCount: metrics.failureCount
      });
    });
    return Object.freeze(
      entries.sort((a, b) => {
        if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
        const fixedA = input.fixedHost === a.candidate.host;
        const fixedB = input.fixedHost === b.candidate.host;
        if (fixedA !== fixedB) return fixedA ? -1 : 1;
        const sufficientA = (a.demandRatio ?? 0) >= 1.35;
        const sufficientB = (b.demandRatio ?? 0) >= 1.35;
        if (sufficientA !== sufficientB) return sufficientA ? -1 : 1;
        if ((a.demandRatio ?? -1) !== (b.demandRatio ?? -1))
          return (b.demandRatio ?? -1) - (a.demandRatio ?? -1);
        if (stateRank(a.state) !== stateRank(b.state)) return stateRank(b.state) - stateRank(a.state);
        if ((a.medianTtfbMs ?? Number.MAX_SAFE_INTEGER) !== (b.medianTtfbMs ?? Number.MAX_SAFE_INTEGER)) {
          return (a.medianTtfbMs ?? Number.MAX_SAFE_INTEGER) - (b.medianTtfbMs ?? Number.MAX_SAFE_INTEGER);
        }
        return a.candidate.catalogIndex - b.candidate.catalogIndex;
      })
    );
  }, "rankRoutes");
  var chooseRoute = /* @__PURE__ */ __name((input, clock, id) => {
    const ranking = rankRoutes(input, clock.now());
    const fixed = input.fixedHost ? ranking.find((row) => row.eligible && row.candidate.host === input.fixedHost) : null;
    const current = input.current && ranking.find((row) => row.eligible && row.candidate.host === input.current?.host);
    const healthyBoundary = input.boundary !== "verified-failure" && input.boundary !== "watchdog" && input.boundary !== "user-setting";
    if (!fixed && current && healthyBoundary && input.boundary !== "new-epoch") {
      const candidate = current.candidate;
      if (candidate.type === "root-original")
        return {
          action: "pass",
          target: { type: "selected-original", candidate },
          id,
          reason: "healthy-affinity",
          routeType: "root-original",
          host: candidate.host,
          ranking
        };
      return {
        action: "rewrite",
        id,
        reason: "healthy-affinity",
        routeType: candidate.type,
        host: candidate.host,
        candidate,
        ranking
      };
    }
    const original = ranking.find((row) => row.eligible && row.candidate.type === "root-original");
    if (!fixed && input.boundary === "startup" && original?.candidate.type === "root-original") {
      return {
        action: "pass",
        target: { type: "selected-original", candidate: original.candidate },
        id,
        reason: "startup-original-pending-preflight",
        routeType: "root-original",
        host: original.candidate.host,
        ranking
      };
    }
    const selected = fixed ?? ranking.find(
      (row) => row.eligible && row.candidate.type !== "root-original" && row.state === "proven" && (row.demandRatio ?? 0) >= 1.35
    ) ?? ranking.find(
      (row) => row.eligible && row.candidate.type !== "root-original" && row.successCount > 0 && (row.demandRatio ?? 0) >= 1.35
    ) ?? original ?? ranking.find((row) => row.eligible && row.candidate.type === "catalog-generated");
    if (!selected) {
      const first = ranking[0];
      return {
        action: "block",
        id,
        reason: first?.reasons[0] ?? "invalid-url",
        routeType: first?.candidate.type ?? "root-original",
        host: first?.candidate.host ?? null,
        ranking
      };
    }
    if (selected.candidate.type === "root-original") {
      return {
        action: "pass",
        target: { type: "selected-original", candidate: selected.candidate },
        id,
        reason: "root-fallback",
        routeType: "root-original",
        host: selected.candidate.host,
        ranking
      };
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

  // src-v2/application/routing/candidate-planning.ts
  function* startupCandidates(input) {
    const { clock, evidence, policy, context, parsed, source, catalogCursor } = input;
    const candidates = [];
    const add = /* @__PURE__ */ __name((host, type, candidateUrl, original) => {
      if (candidates.length >= 3 || candidates.some((candidate) => candidate.host === host) || policy.hardRestriction(host, context.kind) || policy.vault.isInvalid(context.representation, host))
        return null;
      const checked = parseMediaUrl(candidateUrl);
      if (!checked || checked.kind !== "normal" || checked.host !== host) return null;
      const key = mediaIdentity(candidateUrl);
      if (key && policy.incompatible(candidateUrl, host)) return null;
      const prior = evidence.get(host, context.kind);
      const cachedSafeMbps = type === "catalog-generated" && prior && clock.now() - prior.updatedAt <= 5 * 6e4 ? evidenceMetrics(prior, clock.now()).safeThroughputMbps : null;
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
          }
          break;
        }
      }
    }
    const catalog = TRUSTED_CATALOG.filter((host) => !policy.hardRestriction(host, context.kind));
    for (let offset = 0; offset < catalog.length && candidates.length < 3; offset++) {
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
    return catalogOnly() ? catalog : [...catalog, ...routes.native, ...routes.root ? [routes.root] : []];
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

  // src-v2/application/routing/route-materialization.ts
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
  function originalOutputPlan(candidates) {
    const allowed = candidates.filter((candidate) => candidate.allowed);
    return {
      primary: allowed[0]?.index ?? null,
      backups: allowed.slice(1, 6).map((candidate) => candidate.index)
    };
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
        (row) => row.eligible && row.successCount > 0 && Number.isFinite(row.safeThroughputMbps) && (row.safeThroughputMbps ?? 0) > 0 && Number.isFinite(row.demandRatio) && (row.demandRatio ?? 0) >= 1.35
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
  function comparisonOutput(originals, allowed) {
    const unique = [...new Set(originals)];
    const candidates = unique.map((url, index) => ({
      index,
      host: parseMediaUrl(url)?.host ?? "",
      allowed: allowed(url)
    }));
    const plan = originalOutputPlan(candidates);
    const permitted = candidates.filter((candidate) => candidate.allowed).map((candidate) => unique[candidate.index]);
    const primary = plan.primary === null ? "" : unique[plan.primary], backups = plan.backups.map((index) => unique[index]);
    return { primary, backups, permitted };
  }
  __name(comparisonOutput, "comparisonOutput");
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

  // src-v2/application/routing/request-routing.ts
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
  function classifyTransportResult(observation) {
    if (observation.outcome === "abort") return { type: "ignore" };
    const evidenceHost = observation.finalHost ?? observation.targetHost;
    if (!evidenceHost) return { type: "ignore" };
    if (observation.status === 403 && observation.streamKey && observation.routeType === "catalog-generated")
      return { type: "catalog-forbidden" };
    const request = observation.request;
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
          requestId: requestId2,
          at: observation.completedAt,
          source: "transport",
          outcome: "success",
          throughputMbps: observation.bytes >= 64 * 1024 && observation.elapsedMs > 0 ? observation.bytes * 8 / observation.elapsedMs / 1e3 : null,
          ttfbMs: observation.ttfbMs,
          failureKind: null
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
      if (settings.disabled || this.#originalComparison || request.routePolicyRevision !== this.#policyRevision || request.generation !== state.generation || request.epoch !== state.epoch || !request.representation)
        return false;
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
    startupOptions(url, catalogCursor = 0) {
      const parsed = parseMediaUrl(url), match = this.vault.match(url);
      const context = match.status === "matched" || match.source === "exact" ? match.context : null;
      const source = context && this.isCatalogOnly() ? this.#catalogSource(context, url) : url;
      const parsedSource = source ? parseMediaUrl(source) : null;
      if (!parsed || !source || !parsedSource || !parsedSource.replaceable || !this.isCatalogOnly() && parsedSource.kind !== "normal" || !context || this.settings.get().fixedHost || this.#originalComparison || this.session.get().disabled)
        return null;
      const bandwidth = this.vault.groupSummary(context.representation)?.bandwidth ?? 0;
      const requiredMbps = Math.max(
        context.kind === "audio" ? 0.5 : 2,
        (bandwidth || (context.kind === "audio" ? 192e3 : 4e6)) / 1e6 * this.#effectiveRate * 1.25
      );
      const candidates = [];
      for (const candidate of startupCandidates({
        clock: this.clock,
        evidence: this.evidence,
        policy: this.#policyReader(),
        context,
        parsed,
        source,
        catalogCursor
      })) {
        this.#measurementId(candidate, "startup");
        candidates.push(candidate);
      }
      return {
        candidates,
        demand: { kind: context.kind, requiredMbps, highDemand: requiredMbps >= 12 },
        originalHost: parsedSource.host
      };
    }
    noteStartupProbeResult(candidate, status) {
      if (status !== 403 || candidate.type !== "catalog-generated") return;
      const context = candidate.context, current = this.session.get();
      if (context.generation !== current.generation || context.epoch !== current.epoch || !this.vault.isCurrentIdentity(context))
        return;
      this.#markIncompatible(candidate.url, candidate.host);
    }
    commitStartupChoice(url, selected, reason) {
      if (!selected || this.session.get().disabled || this.#originalComparison) return null;
      if (this.isCatalogOnly() && selected.type !== "catalog-generated") return null;
      const fixedHost = this.settings.get().fixedHost;
      if (fixedHost && (selected.type !== "catalog-generated" || selected.host !== fixedHost))
        return null;
      const match = this.vault.match(url);
      const context = match.status === "matched" || match.source === "exact" ? match.context : null;
      if (!context || context !== selected.context || this.#hardRestriction(selected.host, context.kind) || this.vault.isInvalid(context.representation, selected.host) || this.#startupIncompatible.get(mediaIdentity(selected.url) ?? "")?.has(selected.host))
        return null;
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
    async recordStartupSuccess(candidate, bytes, elapsedMs, ttfbMs) {
      if (bytes < 64 * 1024 || elapsedMs <= 0) return;
      if (this.isCatalogOnly() && candidate.type !== "catalog-generated") return;
      const context = candidate.context;
      const valid = /* @__PURE__ */ __name(() => context.generation === this.session.get().generation && context.epoch === this.session.get().epoch && !this.session.get().disabled && this.vault.isCurrentIdentity(context) && (!this.isCatalogOnly() || candidate.type === "catalog-generated"), "valid");
      if (!valid()) return;
      await this.evidence.record(
        candidate.host,
        context.kind,
        {
          requestId: this.#measurementId(candidate, "startup"),
          at: this.clock.now(),
          source: "challenge",
          outcome: "success",
          throughputMbps: bytes * 8 / elapsedMs / 1e3,
          ttfbMs,
          failureKind: null
        },
        valid
      );
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
      if (previous && !["verified-failure", "watchdog", "user-setting"].includes(boundary) && this.#decisionAllowed(previous, context, demand.kind))
        return previous;
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
      if (decision && decision.host !== failedHost)
        this.#trackFallback(representation, "video", decision);
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
      if (!parsed)
        return {
          decision: this.#pass("invalid-url", null, kindHint ?? "video"),
          url,
          context: null,
          streamKey: null,
          sourceHost: null
        };
      if (this.#originalComparison) return this.#applyOriginalComparison(url, parsed, kindHint);
      if (this.isCatalogOnly() && (trustedPlayurl || this.isBilibiliMedia(url))) {
        return this.#applyCatalogOnly(url, parsed, kindHint, demand);
      }
      const streamKey = mediaIdentity(url);
      const source = classifyRequestSource({ kind: parsed.kind });
      if (source.type === "opaque") return this.#applyOpaque(url, parsed, kindHint, streamKey);
      if (source.type === "unreplaceable")
        return this.#applyUnreplaceable(url, parsed, kindHint, streamKey, source.reason);
      return this.#applyNormal(url, parsed, kindHint, streamKey, demand);
    }
    #applyOriginalComparison(url, parsed, kindHint) {
      const inspected = this.inspectOriginal(url);
      const decision = inspected.decision.action === "pass" ? this.#pass(
        "original-observe-only",
        parsed.host,
        inspected.context?.kind ?? kindHint ?? "video"
      ) : inspected.decision;
      const outputRole = inspected.context ? this.vault.outputRole(inspected.context.representation, url) : null;
      this.#remember(decision, inspected.context, inspected.context?.kind ?? kindHint ?? "video");
      return {
        ...inspected,
        decision,
        playurlHostChanged: outputRole?.hostChanged ?? false,
        ...outputRole ? { playurlOutput: outputRole } : {}
      };
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
      return {
        decision,
        url: restriction ? null : url,
        context,
        streamKey,
        sourceHost: parsed.host,
        attributionStatus: match.status,
        attributionSource: match.source,
        playurlHostChanged: outputRole?.hostChanged ?? false,
        ...outputRole ? { playurlOutput: outputRole } : {}
      };
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
    #applyNormal(url, parsed, kindHint, streamKey, demand) {
      const match = this.vault.match(url);
      const context = match.status === "matched" ? match.context : null;
      const kind = context?.kind ?? kindHint ?? null;
      if (streamKey && this.#hostLockedStreams.has(streamKey))
        return this.#applyHostLocked(url, parsed, context, streamKey, kind, demand);
      const playbackDemand = demand ?? {
        kind: kind ?? "video",
        requiredMbps: kind === "audio" ? 0.5 : 8,
        highDemand: false
      };
      let decision = context ? this.#currentPlan(context.representation) : streamKey ? this.#streamPlans.get(streamKey) : null;
      const outputRole = context ? this.vault.outputRole(context.representation, url) : null;
      if (context?.kind === "video" && !this.#requestedRepresentations.has(context.representation) && this.session.get().affinity && outputRole?.role !== "backup" && !this.settings.get().fixedHost) {
        decision = this.#choose(context, playbackDemand, "representation", null);
      }
      if (context && outputRole?.role === "backup" && decision?.host !== parsed.host && !this.settings.get().fixedHost && !this.#hardRestriction(parsed.host, kind)) {
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
      this.#saveAppliedPlan(decision, context, streamKey, kind ?? "video");
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
    #applyHostLocked(url, parsed, context, streamKey, kind, demand) {
      const original = context ? this.vault.rootUrl(context.representation) ?? url : url;
      const originalHost = parseMediaUrl(original)?.host ?? parsed.host;
      const hard = this.#hardRestriction(originalHost, kind);
      if (hard && context) {
        const fallback = this.#choose(
          context,
          demand ?? { kind: context.kind, requiredMbps: 8, highDemand: false },
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
      const playbackDemand = demand ?? {
        kind: kind ?? "video",
        requiredMbps: kind === "audio" ? 0.5 : 8,
        highDemand: false
      };
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
        decision = this.#planPlayerFallback(candidate);
      }
      const allowed = /* @__PURE__ */ __name((candidate) => !!candidate && candidate.action === "rewrite" && candidate.candidate.type === "catalog-generated" && isCatalogHost(candidate.host) && !this.#hardRestriction(candidate.host, kind) && !this.#incompatible(url, candidate.host) && (!context || !this.vault.isInvalid(context.representation, candidate.host)), "allowed");
      if (!allowed(decision)) {
        decision = context ? this.#choose(context, playbackDemand, "request", null, url) : this.#catalogOnly(playbackDemand, parsed.host, kind, url);
      }
      if (!decision || decision.action !== "rewrite" || !allowed(decision)) {
        return blocked("catalog-unavailable");
      }
      const target = replaceUrlHost(url, decision.host);
      if (!target || parseMediaUrl(target)?.kind !== "normal" || parseMediaUrl(target)?.host !== decision.host || this.#hardRestriction(decision.host, kind) || this.#incompatible(url, decision.host))
        return blocked("catalog-unavailable");
      this.#saveAppliedPlan(decision, context, streamKey, kind ?? "video");
      if (context) this.vault.registerAlias(context.representation, target);
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
      if (this.#originalComparison) {
        const { primary: primary2, backups: backups2, permitted } = comparisonOutput(originals, allowed);
        if (primary2) {
          const selectedHost = parseMediaUrl(primary2).host;
          const outputDecision = primary2 === original && decision.action === "pass" && decision.host === selectedHost ? decision : this.#pass("original-backup", selectedHost, context.kind);
          if (outputDecision !== decision) {
            this.#savePlan(representation, outputDecision);
            this.#remember(outputDecision, context, context.kind);
            this.#emit({ type: "route-planned", at: this.clock.now(), decision: outputDecision });
          }
          this.vault.registerOutput(
            representation,
            original,
            primary2,
            backups2,
            outputDecision.id,
            source
          );
          for (const url of permitted.slice(0, 6)) this.vault.registerAlias(representation, url);
        }
        return this.isBilibiliMedia(primary2) ? { primary: primary2, backups: backups2.filter((url) => this.isBilibiliMedia(url)) } : { primary: "", backups: [] };
      }
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
    challenge(representation, _demand, preferNative, excludedHosts = /* @__PURE__ */ new Set(), catalogCursor = 0) {
      const context = this.vault.identity(representation);
      const root = context && this.isCatalogOnly() ? this.#catalogSource(context) : this.vault.rootUrl(representation);
      const rootKey = root ? mediaIdentity(root) : null;
      if (!context || !root || this.settings.get().fixedHost || this.#originalComparison || rootKey !== null && this.#hostLockedStreams.has(rootKey))
        return null;
      this.settings.get();
      this.restrictions.snapshot(context.kind);
      const native = this.isCatalogOnly() ? [] : this.vault.candidates(representation, this.#unlockedNative.get(representation) ?? /* @__PURE__ */ new Set()).native.filter((candidate) => candidate.activelyExplorable);
      const candidates = challengerCandidates(context.kind, native, preferNative, catalogCursor);
      const now = this.clock.now(), currentHost = this.session.get().affinity?.host;
      const selected = candidates.find((candidate) => {
        if (candidate.host === currentHost || excludedHosts.has(candidate.host)) return false;
        if (this.#hardRestriction(candidate.host, candidate.kind)) return false;
        if (candidate.type === "catalog-generated" && this.#incompatible(root, candidate.host))
          return false;
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
      if (!url || selected.type === "catalog-generated" && parseMediaUrl(url)?.kind !== "normal")
        return null;
      this.#challengeAttempts.set(`${context.representation}:${selected.host}`, now);
      this.#remember(decision, context, context.kind);
      this.#emit({ type: "route-planned", at: now, decision });
      const applied = {
        decision,
        url,
        context,
        streamKey: rootKey,
        sourceHost: parseMediaUrl(root)?.host ?? null
      };
      this.#measurementId(applied, "challenge");
      return applied;
    }
    async recordChallenge(applied, bytes, elapsedMs, ttfbMs, outcome, failureKind) {
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
      await this.evidence.record(
        applied.decision.host,
        context.kind,
        {
          requestId: this.#measurementId(applied, "challenge"),
          at: this.clock.now(),
          source: "challenge",
          outcome,
          throughputMbps: outcome === "success" && bytes >= 64 * 1024 && elapsedMs > 0 ? bytes * 8 / elapsedMs / 1e3 : null,
          ttfbMs,
          failureKind
        },
        valid
      );
    }
    async observe(observation) {
      if (observation.request) this.#pendingMedia.delete(observation.request.requestId);
      const valid = /* @__PURE__ */ __name(() => observation.generation === this.session.get().generation && observation.epoch === this.session.get().epoch && !this.session.get().disabled && (observation.request?.authorityRevision == null || !observation.representation || this.vault.identity(observation.representation)?.authorityRevision === observation.request.authorityRevision), "valid");
      const catalogObserved = /* @__PURE__ */ __name(() => catalogObservationAllowed(this.isCatalogOnly(), observation), "catalogObserved");
      const controlsCurrent = /* @__PURE__ */ __name(() => valid() && (observation.request ? observation.request.routePolicyRevision === this.#policyRevision : !!observation.decisionId && this.#decisions.get(observation.decisionId)?.policyRevision === this.#policyRevision), "controlsCurrent");
      if (controlsCurrent() && this.isCatalogOnly() && observation.routeType === "catalog-generated" && isCatalogHost(observation.targetHost) && observation.finalHost && observation.finalHost !== observation.targetHost && observation.streamKey)
        this.#markIncompatibleKey(observation.streamKey, observation.targetHost);
      this.#emit({
        type: "transport-completed",
        at: this.clock.now(),
        observation,
        detached: !valid() || !catalogObserved()
      });
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
      this.#latest.set(key, transportSnapshot(observation));
      if (observation.outcome === "success" && observation.finalHost)
        this.#lastSuccess.set(key, this.#latest.get(key));
      const result = classifyTransportResult(observation);
      if (result.type === "ignore") return;
      if (result.type === "catalog-forbidden") {
        if (!controlsCurrent()) return;
        this.#markIncompatibleKey(observation.streamKey, observation.targetHost);
        this.#hostLockedStreams.add(observation.streamKey);
        if (observation.kind === "video" && observation.representation)
          this.recoverStartup(
            observation.representation,
            { kind: "video", requiredMbps: 8, highDemand: false },
            observation.targetHost,
            []
          );
        return;
      }
      const representation = observation.representation;
      if (result.type === "native-invalid") {
        if (!controlsCurrent()) return;
        this.vault.invalidate(representation, result.host);
        const demand = {
          kind: result.kind,
          requiredMbps: result.kind === "audio" ? 0.5 : 8,
          highDemand: false
        };
        this.recover(representation, demand, "verified-failure", result.host);
        return;
      }
      await this.evidence.record(
        result.host,
        result.kind,
        result.sample,
        () => valid() && catalogObserved()
      );
      if (!controlsCurrent() || !catalogObserved()) return;
      if (result.type === "success") {
        this.#confirmObservedTransport(observation, representation);
        return;
      }
      if (representation) {
        const demand = {
          kind: observation.kind,
          requiredMbps: observation.kind === "audio" ? 0.5 : 8,
          highDemand: false
        };
        this.recover(representation, demand, "verified-failure", result.host);
      }
    }
    #confirmObservedTransport(observation, representation) {
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
          ranking: Object.freeze(
            active.ranking.slice(0, 12).map(
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
          )
        }) : null,
        recentPlans: Object.freeze(
          recent.map(
            ([representation, decision]) => Object.freeze({ representation, ...summarize(decision) })
          )
        ),
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
    #choose(context, demand, boundary, failedHost, sourceUrl) {
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
      const id = this.#nextId();
      const current = this.#currentPlan(context.representation), affinity = this.session.get().affinity;
      const currentRoute = boundary === "representation" && context.kind === "video" && affinity ? { type: affinity.type, host: affinity.host } : current && current.action !== "block" && current.host ? { type: current.routeType, host: current.host } : context.kind === "video" && affinity ? { type: affinity.type, host: affinity.host } : null;
      const decision = chooseRoute(
        {
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
        },
        this.clock,
        id
      );
      this.session.noteDecision(id);
      this.#remember(decision, context, context.kind);
      this.#emit({ type: "route-planned", at: this.clock.now(), decision });
      return decision;
    }
    #catalogOnly(demand, originalHost, knownKind, sourceUrl) {
      const settings = this.settings.get(), restriction = this.#restrictionSnapshot(knownKind);
      const candidates = catalogCandidates(demand.kind).filter(
        (candidate) => !sourceUrl || !this.#incompatible(sourceUrl, candidate.host)
      );
      const id = this.#nextId();
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
        id
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
        if (this.#tentativeRepresentation === representation) {
          this.#tentativeRepresentation = null;
          this.#tentativeTransfers = 0;
        }
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
  var nextCursor = /* @__PURE__ */ __name((cursor) => Number.isSafeInteger(cursor) && cursor >= 0 && cursor < Number.MAX_SAFE_INTEGER ? cursor + 1 : 0, "nextCursor");
  var cancellationReason = /* @__PURE__ */ __name((signal) => "reason" in signal ? signal.reason : new DOMException("Aborted", "AbortError"), "cancellationReason");
  var MeasurementController = class {
    constructor(routes, meta, probe, now, scheduler, rangeMetadata, random = () => 0) {
      this.routes = routes;
      this.meta = meta;
      this.probe = probe;
      this.now = now;
      this.scheduler = scheduler;
      this.rangeMetadata = rangeMetadata;
      this.random = random;
    }
    routes;
    meta;
    probe;
    now;
    scheduler;
    rangeMetadata;
    random;
    static {
      __name(this, "MeasurementController");
    }
    #running = null;
    #failedAt = null;
    #planning = null;
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
    #snapshot = Object.freeze({
      state: "idle",
      reason: "startup",
      lastAttemptAt: 0,
      host: null
    });
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
      this.#failedAt = null;
      this.#snapshot = Object.freeze({
        state: "idle",
        reason: "generation",
        lastAttemptAt: 0,
        host: null
      });
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
      const running = this.#running;
      this.#planning = null;
      this.#running = null;
      running?.controller.abort(reason);
    }
    willGateStartup(url) {
      return !!this.#startupPending || !this.#startupUsed && !!this.routes.startupOptions(url)?.candidates.length;
    }
    /** The player request, never a page hint, authorizes this one bounded startup window. */
    async prepareStartup(url, signal = null) {
      if (signal?.aborted) throw cancellationReason(signal);
      if (!this.#startupPending) {
        if (this.#startupUsed) return;
        const cursor = Math.max(0, Number(this.meta.get().catalogCursor) || 0);
        const options = this.routes.startupOptions(url, cursor);
        if (!options?.candidates.length) {
          this.noteUnpreflighted("unsupported-or-no-legal-candidate");
          return;
        }
        const controller = new AbortController(), marker = this.#marker;
        this.#startupUsed = true;
        this.#startupController = controller;
        this.#startupState = Object.freeze({
          state: "running",
          reason: "player-media-request",
          candidates: options.candidates.length,
          selectedHost: null,
          delayed: true
        });
        let release;
        this.#startupPending = new Promise((resolve) => {
          release = resolve;
        });
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
          if (this.#startupController === controller) this.#startupController = null;
          if (marker === this.#marker) this.#startupPending = null;
          release();
        });
        void this.meta.withLock(() => {
          if (marker !== this.#marker) return;
          const currentCursor = this.meta.get().catalogCursor;
          if (marker !== this.#marker) return;
          this.meta.update({ catalogCursor: nextCursor(currentCursor) });
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
      const startedAt = this.now(), catalogOnlyAtStart = this.routes.isCatalogOnly();
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
      controller.signal.addEventListener("abort", aborted, { once: true });
      timer = this.scheduler.timeout(() => {
        finish("deadline");
        controller.abort("startup-deadline");
      }, TIMEOUT_MS);
      for (const candidate of options.candidates) {
        if (sealed || controller.signal.aborted) break;
        void this.#probeStartup(candidate, options.demand, controller.signal).then(
          (result) => {
            if (sealed || marker !== this.#marker) return;
            results.push(result);
            if (catalogOnlyAtStart && this.routes.isCatalogOnly() && candidate.type === "catalog-generated" && result.valid && (result.safeMbps ?? 0) / options.demand.requiredMbps >= 1.35)
              finish("qualified-early");
            else if (--remaining === 0) finish("complete");
          },
          (error) => {
            if (sealed) return;
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
      for (const result of results)
        this.routes.noteStartupProbeResult(result.candidate, result.status);
      const valid = results.filter((result) => result.valid && result.safeMbps !== null);
      const qualified = valid.filter(
        (result) => (result.safeMbps ?? 0) / options.demand.requiredMbps >= 1.35
      );
      const ranked = [...qualified].sort((a, b) => (b.safeMbps ?? 0) - (a.safeMbps ?? 0));
      const catalogOnly = this.routes.isCatalogOnly();
      const fastestValid = [...valid].sort((a, b) => (b.safeMbps ?? 0) - (a.safeMbps ?? 0))[0]?.candidate ?? null;
      let winner = ranked[0]?.candidate ?? (!catalogOnly ? options.candidates.find((candidate) => candidate.original) : null) ?? fastestValid ?? (!catalogOnly ? options.candidates[0] : null) ?? null;
      const original = valid.find((result) => result.candidate.original);
      if (!catalogOnly && winner && original && !winner.original && (original.safeMbps ?? 0) >= (ranked[0]?.safeMbps ?? 0) * 0.9)
        winner = original.candidate;
      const decision = winner ? this.routes.commitStartupChoice(
        url,
        winner,
        valid.length ? "startup-preflight" : "startup-inconclusive"
      ) : null;
      this.#startupQualifiedHosts = Object.freeze(
        [...valid].sort((a, b) => (b.safeMbps ?? 0) - (a.safeMbps ?? 0)).map((result) => result.candidate.host)
      );
      this.#startupState = Object.freeze({
        state: decision ? "complete" : "skipped",
        reason: releaseReason === "qualified-early" ? releaseReason : valid.length ? "measured" : "inconclusive",
        candidates: options.candidates.length,
        selectedHost: decision?.host ?? null,
        delayed: true,
        elapsedMs: Math.max(0, this.now() - startedAt),
        results: Object.freeze(
          results.slice(0, 3).map(
            (result) => Object.freeze({
              host: result.candidate.host,
              type: result.candidate.type,
              valid: result.valid,
              safeMbps: result.safeMbps,
              status: result.status,
              reason: result.reason
            })
          )
        )
      });
      for (const result of valid)
        if (result.candidate.cachedSafeMbps === null) {
          void this.routes.recordStartupSuccess(result.candidate, result.bytes, result.elapsedMs, result.ttfbMs).catch(() => void 0);
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
      const valid = result.directRange && (candidate.cachedSafeMbps !== null ? result.bytes >= 16 * 1024 : result.bytes >= 64 * 1024);
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
      if (this.#failedAt !== null && this.now() - this.#failedAt < COOLDOWN_MS) return;
      void this.#tryStart(status);
    }
    async #tryStart(status) {
      if (!status.representation || !status.demand || this.#running || this.#planning) return;
      const planning = {};
      this.#planning = planning;
      const planningMarker = this.#marker;
      let running = null;
      try {
        let at = this.now();
        let first = null, cursor = 0;
        await this.meta.withLock(() => {
          if (planningMarker !== this.#marker || this.#planning !== planning) return;
          const current2 = this.#lastStatus;
          if (!current2 || this.#unsafeReason(current2) || current2.representation !== status.representation || !current2.demand)
            return;
          at = this.now();
          const meta = this.meta.get();
          if (at - (Number(meta.lastChallengeAt) || 0) < COOLDOWN_MS) return;
          cursor = Math.max(0, Number(meta.catalogCursor) || 0);
          first = this.routes.challenge(
            current2.representation,
            current2.demand,
            this.#preferNative,
            /* @__PURE__ */ new Set(),
            cursor
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
        this.#manualRequested = false;
        const controller = new AbortController(), marker = this.#marker;
        running = { controller, marker };
        this.#running = running;
        await this.#runRound(planned, status, controller, marker, cursor);
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
    async #runRound(first, status, controller, marker, cursor) {
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
        next = this.routes.challenge(
          status.representation,
          status.demand,
          nativeCount === 0 && catalogCount >= 2,
          excluded,
          cursor
        );
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
      const ok = result.directRange && result.bytes >= 64 * 1024;
      const failure = applied.decision.routeType === "native-signed" && [403, 451, 959].includes(result.status ?? 0) ? "native-invalid" : result.reason === "timeout" ? "timeout" : result.reason === "network" ? "network" : null;
      await this.routes.recordChallenge(
        applied,
        result.bytes,
        result.elapsedMs,
        result.ttfbMs,
        ok ? "success" : "failure",
        failure
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
      if (status.stableProgressSec < 20) return "awaiting-progress";
      if (status.playableBufferSec < 30) return "low-buffer";
      return null;
    }
  };

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
    #failedRestore = null;
    #state = Object.freeze({
      state: "healthy",
      source: null,
      pauseSec: 0,
      reloadCount: 0,
      breakerSec: 0
    });
    subscribe(listener) {
      this.#listeners.add(listener);
      return () => this.#listeners.delete(listener);
    }
    snapshot() {
      const restoration = this.#restoration();
      if (restoration) return Object.freeze({ ...this.#state, restoration });
      return this.#state;
    }
    #restoration() {
      const token = this.#token, plan = token?.restore;
      return plan ? Object.freeze({
        phase: token?.restored ? "progress" : plan.phase,
        channel: plan.channel,
        result: plan.result
      }) : void 0;
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
    cancelStall(id) {
      if (this.#token?.stall?.id === id) this.#finish("failed", "stall-ended");
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
      const observation = token?.restored && plan?.attempt && token.restoreBaseline ? {
        attempt: plan.attempt,
        controls: token.controls,
        positionSec: token.restoreBaseline.positionSec,
        at: token.restoreBaseline.at,
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
      if (token?.restored && plan)
        plan.result = !known ? "unknown" : this.#matchesRestoreProgress(observation, observed) ? "verified" : "mismatch";
      const { progress, newFrames } = this.#recordProgress(observed, previous, controls, known);
      if (this.#endInvalidToken(observed, controls, now)) return;
      const healthy = this.#observeCoreHealth(observed, newFrames, now);
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
      if (this.#token?.reloadingAt && this.#token.firstProgressAt === null && now - this.#token.reloadingAt >= 15e3) {
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
    #observeCoreHealth(snapshot, newFrames, now) {
      const healthy = snapshot.available && !snapshot.mediaError && (snapshot.readyState >= 2 || snapshot.width > 0 || snapshot.height > 0 || newFrames);
      const deadObservation = this.#hadHealthy && snapshot.available && !snapshot.seeking && !snapshot.ended && !snapshot.mediaError && snapshot.readyState === 0 && snapshot.width === 0 && snapshot.height === 0 && snapshot.manifestHasVideo && snapshot.coreInitialized === false && !newFrames;
      const gap = now - this.#lastTickAt;
      this.#lastTickAt = now;
      this.#deadTicks = deadObservation ? gap > 0 && gap <= 2e3 ? this.#deadTicks + 1 : 1 : 0;
      if (healthy) this.#deadReported = false;
      if (this.#deadTicks >= 4 && !this.#deadReported) {
        this.#deadReported = true;
        this.#emit({
          type: "core-uninitialized",
          at: now,
          paused: snapshot.paused,
          intentPending: !!this.#token,
          consecutiveTicks: this.#deadTicks
        });
      }
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
        const restoreReady = (!this.#token.positionCapture.proof || !snapshot.seeking) && (!ownedReload || controls.coreId !== 0 && controls.coreReloadRevision === this.#token.reloadRevision && snapshot.coreInitialized !== false);
        if (this.#token.reloadingAt && !this.#token.restored && restoreReady)
          this.#restore(this.#token, snapshot);
        else if (this.#progressTicks >= 2 && (!this.#token.reloadingAt || this.#token.restored) && this.#restoredProgressValid(this.#token, snapshot))
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
      if (token.restored && now <= token.restoredAt) return;
      if (token.reloadingAt && !token.restored) progress = false;
      if (token.restored && restoreKnown && !this.#restoredProgressValid(token, snapshot)) {
        this.#finish("failed", "restore-mismatch");
        return;
      }
      if (progress && (!token.restored || now > token.restoredAt)) {
        token.firstProgressAt ??= now;
        return;
      }
      if (token.firstProgressAt !== null) {
        if (now - token.firstProgressAt >= 15e3) this.#finish("failed", "progress-not-sustained");
        return;
      }
      const dead = snapshot.readyState === 0 && snapshot.width === 0 && snapshot.height === 0 && snapshot.manifestHasVideo && snapshot.coreInitialized === false;
      const startupStalled = token.source === "startup-failure" && snapshot.readyState < 2 && snapshot.playableBufferSec < 1 && snapshot.currentTime <= token.baselinePositionSec + 0.05 && (snapshot.frames === null || token.baselineFrames === null || snapshot.frames <= token.baselineFrames);
      if (!token.reloadingAt && (token.stall ? now - token.stall.startedAt >= (token.stall.reloadAfterMs ?? 3e4) : (dead || startupStalled) && now - token.startedAt >= 4e3 || now - token.startedAt >= 3e4))
        this.#reload(token);
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
        restorePosition: true,
        restore: null,
        restoredAt: 0,
        restoreBaseline: null
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
      this.#emit({
        type: "recovery",
        at: this.now(),
        action: {
          action: "player-reload",
          id: token.id,
          savedPositionSec: token.savedPositionSec,
          savedRate: token.savedRate
        }
      });
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
          source: token.source,
          pauseSec: 0,
          reloadCount: this.#reloadCount,
          breakerSec: 0
        });
    }
    #restoreReady(token) {
      if (this.now() - token.reloadingAt >= 15e3) {
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
    #positionMatches(reading) {
      if (!reading.landing || reading.positionSec === null || reading.seeking !== false || reading.paused === null)
        return false;
      if (!reading.paused && reading.rate === null) return false;
      const expected = reading.landing.positionSec + (reading.paused ? 0 : reading.rate * Math.max(0, this.now() - reading.landing.at) / 1e3);
      return Math.abs(reading.positionSec - expected) <= 1;
    }
    #restore(token, snapshot) {
      if (!this.#restoreReady(token)) return;
      token.restore ??= {
        targetSec: snapshot.duration ? Math.min(token.savedPositionSec, Math.max(0, snapshot.duration - 0.1)) : token.savedPositionSec,
        phase: token.restorePosition ? "position" : "rate",
        attempt: null,
        positionAttempt: null,
        issuedAt: 0,
        positionNativeUsed: false,
        rateNativeUsed: false,
        channel: "none",
        result: "unknown"
      };
      const plan = token.restore;
      const valid = /* @__PURE__ */ __name(() => this.#token === token && this.isActive() && this.now() - token.reloadingAt < 15e3 && this.#owns(token, this.player.controls()), "valid");
      try {
        for (let step = 0; step < 2; step++) {
          if (!this.#restoreReady(token)) return;
          if (!token.restorePosition && plan.phase === "position") {
            plan.phase = "rate";
            plan.attempt = null;
          }
          if (!plan.attempt) {
            plan.issuedAt = this.now();
            plan.attempt = this.player.performRestore(
              {
                kind: plan.phase,
                value: plan.phase === "position" ? plan.targetSec : token.savedRate,
                at: plan.issuedAt
              },
              { reloadRevision: token.reloadRevision ?? -1, valid, now: this.now }
            );
            if (plan.phase === "position") plan.positionAttempt = plan.attempt;
          }
          if (!this.#restoreReady(token)) return;
          let reading = this.player.readRestore(plan.attempt);
          plan.channel = reading.channel;
          plan.result = reading.status === "pending" ? "pending" : "unknown";
          if (!reading.owned || !this.#restoreReady(token)) return;
          const correct = /* @__PURE__ */ __name(() => plan.phase === "position" ? this.#positionMatches(reading) : reading.rate === token.savedRate && reading.seeking === false && reading.positionSec !== null, "correct");
          if (!correct()) {
            if (reading.positionSec !== null && reading.rate !== null && reading.status !== "pending")
              plan.result = "mismatch";
            if (reading.status === "rejected") {
              this.#finish("failed", "restore-threw");
              return;
            }
            if (reading.channel === "native") {
              if (plan.phase === "position") plan.positionNativeUsed = true;
              else plan.rateNativeUsed = true;
            }
            const used = plan.phase === "position" ? plan.positionNativeUsed : plan.rateNativeUsed;
            const known = plan.phase === "position" ? reading.positionSec !== null && reading.paused !== null && (reading.paused || reading.rate !== null) && Math.abs(
              reading.positionSec - (reading.landing ? reading.landing.positionSec + (reading.paused ? 0 : reading.rate * Math.max(0, this.now() - reading.landing.at) / 1e3) : plan.targetSec)
            ) > 1 : reading.rate !== null && reading.rate !== token.savedRate;
            if (!used && known && reading.status !== "pending" && reading.seeking === false && reading.readyState !== null && reading.readyState >= 1 && this.now() - plan.issuedAt >= 1e3) {
              if (plan.phase === "position") plan.positionNativeUsed = true;
              else plan.rateNativeUsed = true;
              if (!this.#restoreReady(token)) return;
              this.player.correctRestore(plan.attempt);
              if (!this.#restoreReady(token)) return;
              reading = this.player.readRestore(plan.attempt);
              plan.channel = reading.channel;
            }
            if (!reading.owned || !correct()) return;
          }
          plan.result = "verified";
          if (plan.phase === "position") {
            plan.phase = "rate";
            plan.attempt = null;
            continue;
          }
          if (plan.positionAttempt && !this.#positionMatches(this.player.readRestore(plan.positionAttempt)))
            return;
          this.#resumeVerified(token, plan.attempt);
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
      if (playResult !== null && (typeof playResult === "object" || typeof playResult === "function"))
        void Promise.resolve(playResult).catch(() => {
          if (this.#lifecycleSerial !== lifecycle || this.#token !== token || !this.#owns(token, this.player.controls()))
            return;
          this.#finish("recovered-paused", "play-rejected");
        });
      if (!this.#restoreReady(token)) return;
      const reading = this.player.readRestore(rateAttempt);
      if (!reading.owned || reading.rate !== null && reading.rate !== token.savedRate || reading.positionSec !== null && Math.abs(
        reading.positionSec - beforePlay.positionSec - (reading.paused ? 0 : token.savedRate * Math.max(0, this.now() - playAt) / 1e3)
      ) > 1) {
        if (this.#token === token) this.#finish("failed", "restore-mismatch");
        return;
      }
      const baseline = this.player.snapshot(), controls = this.player.controls();
      if (!this.#restoreReady(token)) return;
      token.restored = true;
      token.restoredAt = this.now();
      token.restoreBaseline = { positionSec: beforePlay.positionSec, at: playAt };
      token.restore.result = reading.positionSec === null || reading.rate === null ? "unknown" : "verified";
      this.#lastSnapshot = {
        ...baseline,
        currentTime: reading.positionSec ?? beforePlay.positionSec,
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
    }
    #restoredProgressValid(token, snapshot) {
      if (!token.restored || !token.restoreBaseline) return true;
      return this.#matchesRestoreProgress(
        {
          attempt: token.restore.attempt,
          controls: token.controls,
          positionSec: token.restoreBaseline.positionSec,
          at: token.restoreBaseline.at,
          rate: token.savedRate
        },
        snapshot
      );
    }
    #matchesRestoreProgress(baseline, snapshot) {
      const elapsed = Math.max(0, this.now() - baseline.at) / 1e3;
      return snapshot.playbackRate === baseline.rate && Number.isFinite(snapshot.currentTime) && snapshot.currentTime >= baseline.positionSec - 1 && snapshot.currentTime <= baseline.positionSec + baseline.rate * elapsed + 1;
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
      const revision = token.reloadRevision;
      return this.#token === token && !!token.reloadingAt && revision !== null && controls.reloadRevision === revision && controls.mediaId === token.controls.mediaId && controls.userRevision === token.controls.userRevision && !controls.dragging && (controls.coreId === token.controls.coreId || controls.coreId === 0 || controls.coreReloadRevision === revision) && this.player.ownedReload?.(revision) === true && this.#token === token;
    }
    #initializationOwned(token, controls) {
      return token.positionCapture.proof !== null && token.reloadRevision !== null && this.#ownedReload(token, controls) && this.player.validateResumePosition(token.positionCapture, token.reloadRevision);
    }
    #acceptedReloadProgress(token, snapshot, controls) {
      return this.#token === token && token.restored && token.firstProgressAt !== null && token.reloadRevision !== null && this.now() - token.firstProgressAt <= 15e3 && snapshot.available && !snapshot.paused && !snapshot.seeking && !snapshot.ended && !snapshot.mediaError && !controls.dragging && controls.coreId !== 0 && controls.mediaId === token.controls.mediaId && controls.coreId === token.controls.coreId && controls.userRevision === token.controls.userRevision && controls.seekRevision === token.controls.seekRevision && controls.reloadRevision === token.reloadRevision;
    }
    #finish(state, reason = state) {
      const token = this.#token;
      const observedRestoration = this.#restoration();
      const restoration = observedRestoration && reason === "restore-mismatch" ? Object.freeze({ ...observedRestoration, result: "mismatch" }) : observedRestoration;
      this.#failedRestore = state === "failed" && token?.restore?.attempt ? Object.freeze({
        attempt: token.restore.attempt,
        controls: Object.freeze({ ...token.controls }),
        positionSec: token.restoreBaseline?.positionSec ?? token.restore.targetSec,
        at: token.restoreBaseline?.at ?? token.restore.issuedAt,
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
      if (token && ["failed", "recovered", "recovered-paused"].includes(state))
        this.#emit({
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

  // src-v2/domain/buffer-trend.ts
  var BUFFER_WINDOW_MS = 8e3;
  var BUFFER_SAMPLE_LIMIT = 32;
  var BUFFER_COMPLETION_LIMIT = 128;
  function emptyBufferTrend(at, reason = "warming-up", ineligible = false) {
    return Object.freeze({
      schemaVersion: 3,
      algorithm: "buffer-window-v3",
      at: Number.isFinite(at) && at >= 0 ? at : null,
      from: null,
      spanMs: 0,
      sampleCount: 0,
      interpolated: false,
      progressQuality: "none",
      state: ineligible ? "ineligible" : "insufficient",
      reason,
      candidate: null,
      rate: null,
      startBufferSec: null,
      endBufferSec: null,
      deltaSec: null,
      slopeSecPerSec: null
    });
  }
  __name(emptyBufferTrend, "emptyBufferTrend");
  function validBufferSample(s) {
    return Number.isFinite(s.at) && s.at >= 0 && Number.isFinite(s.rate) && s.rate > 0 && Number.isFinite(s.bufferAheadSec) && s.bufferAheadSec >= 0 && Number.isFinite(s.bufferAheadSec / s.rate) && Number.isFinite(s.currentTime) && s.currentTime >= 0 && (s.frames === null || Number.isSafeInteger(s.frames) && s.frames >= 0);
  }
  __name(validBufferSample, "validBufferSample");
  function assessBufferTrend(samples, now) {
    const empty = /* @__PURE__ */ __name((reason) => Object.freeze({
      ...emptyBufferTrend(now, reason),
      schemaVersion: 1,
      algorithm: "buffer-window-v1"
    }), "empty");
    if (samples.length > BUFFER_SAMPLE_LIMIT) return empty("sample-overflow");
    if (!Number.isFinite(now) || now < 0 || samples.some((s) => !validBufferSample(s)))
      return empty("invalid-sample");
    const last = samples.at(-1);
    if (!last || last.at !== now) return empty("warming-up");
    if (samples.some((s) => s.rate !== last.rate)) return empty("context-changed");
    let quality = "frames";
    for (let i = 1; i < samples.length; i++) {
      const before = samples[i - 1], after = samples[i];
      if (after.at <= before.at) return empty("time-reversed");
      if (after.at - before.at > 1500) return empty("sample-gap");
      if (after.rate !== last.rate) return empty("context-changed");
      if (after.currentTime - before.currentTime <= 0.05 || after.frames !== null && before.frames !== null && after.frames <= before.frames)
        return empty("no-progress");
      if (after.frames === null || before.frames === null) quality = "time-only";
    }
    const from = now - BUFFER_WINDOW_MS;
    let index = -1;
    for (let i = 0; i < samples.length && samples[i].at <= from; i++) index = i;
    if (index < 0) return empty("warming-up");
    const left = samples[index], right = samples[index + 1];
    const interpolated = left.at !== from;
    if (interpolated && !right) return empty("warming-up");
    const firstBuffer = left.bufferAheadSec / left.rate;
    const startBufferSec = interpolated && right ? firstBuffer + (right.bufferAheadSec / right.rate - firstBuffer) * (from - left.at) / (right.at - left.at) : firstBuffer;
    const endBufferSec = last.bufferAheadSec / last.rate, deltaSec = endBufferSec - startBufferSec;
    const state = deltaSec <= -2 ? "draining" : deltaSec >= 2 ? "filling" : "stable";
    const candidate = state === "draining" && endBufferSec <= 10;
    return Object.freeze({
      schemaVersion: 1,
      algorithm: "buffer-window-v1",
      at: now,
      from,
      spanMs: BUFFER_WINDOW_MS,
      sampleCount: samples.length,
      interpolated,
      progressQuality: quality,
      state,
      reason: state === "draining" ? candidate ? "draining-low" : "draining-high" : state,
      candidate,
      rate: last.rate,
      startBufferSec,
      endBufferSec,
      deltaSec,
      slopeSecPerSec: deltaSec / (BUFFER_WINDOW_MS / 1e3)
    });
  }
  __name(assessBufferTrend, "assessBufferTrend");
  function confirmBufferTrend(input) {
    const { reading: raw, sample, previous } = input;
    const current = Object.freeze({
      ...raw,
      schemaVersion: 3,
      algorithm: "buffer-window-v3"
    });
    const finish = /* @__PURE__ */ __name((reading, confirmation) => Object.freeze({ reading, confirmation }), "finish");
    const reject = /* @__PURE__ */ __name((reason) => finish(emptyBufferTrend(sample.at, reason), null), "reject");
    if (!validBufferSample(sample)) return reject("invalid-sample");
    if (previous && (!validBufferSample(previous) || previous.rate !== sample.rate))
      return reject("context-changed");
    let state = input.confirmation;
    if (state && (!previous || state.at !== previous.at || ![state.anchorSec, state.lowSec, state.creditMs, state.at, state.lastLowAt].every(
      Number.isFinite
    ) || state.lowSec < 0 || state.anchorSec < state.lowSec || state.creditMs < 0 || state.creditMs > 2e3 || state.lastLowAt < 0 || state.lastLowAt > state.at))
      state = null;
    if (previous && sample.at === previous.at)
      return finish(emptyBufferTrend(sample.at, "warming-up"), state);
    if (previous && sample.at < previous.at) return reject("time-reversed");
    if (previous && sample.at - previous.at > 1500) return reject("sample-gap");
    if (raw.candidate === null) return finish(current, null);
    if (raw.at !== sample.at || raw.endBufferSec !== sample.bufferAheadSec / sample.rate)
      return reject("invalid-sample");
    if (!raw.candidate) return finish(current, null);
    const buffer = sample.bufferAheadSec / sample.rate;
    const before = previous ? previous.bufferAheadSec / previous.rate : null;
    const expired = state !== null && sample.at - state.lastLowAt > BUFFER_WINDOW_MS;
    if (expired) state = null;
    const result = /* @__PURE__ */ __name((reason, candidate, next) => finish(Object.freeze({ ...current, candidate, reason }), next), "result");
    if (!state) {
      const next = before !== null && buffer < before ? Object.freeze({
        anchorSec: before,
        lowSec: buffer,
        creditMs: 0,
        at: sample.at,
        lastLowAt: sample.at
      }) : null;
      return result(
        expired ? "candidate-expired" : before !== null && buffer > before ? "partial-refill" : before === buffer ? "not-decreasing" : "candidate-confirming",
        false,
        next
      );
    }
    if (buffer >= state.anchorSec) return result("candidate-repaid", false, null);
    if (buffer < state.lowSec) {
      const creditMs = Math.min(2e3, state.creditMs + sample.at - previous.at);
      const next = Object.freeze({
        ...state,
        lowSec: buffer,
        creditMs,
        at: sample.at,
        lastLowAt: sample.at
      });
      return result(
        creditMs >= 2e3 ? "draining-low" : "candidate-confirming",
        creditMs >= 2e3,
        next
      );
    }
    return result(
      buffer > before ? "partial-refill" : buffer === before ? "not-decreasing" : "above-prior-low",
      false,
      Object.freeze({ ...state, at: sample.at })
    );
  }
  __name(confirmBufferTrend, "confirmBufferTrend");
  function summarizeBufferTransport(rows, now, dropped) {
    let successes = 0, failures = 0, aborts = 0, completedBytes = 0, crossWindow = 0;
    let unavailable = dropped;
    for (const row of rows) {
      if (row.completedAt < now - BUFFER_WINDOW_MS || row.completedAt > now) continue;
      if (row.outcome === "success") {
        successes++;
        if (row.status >= 200 && row.status < 300 && Number.isSafeInteger(row.bytes) && row.bytes >= 0 && Number.isSafeInteger(completedBytes + row.bytes))
          completedBytes += row.bytes;
        else unavailable = Math.min(Number.MAX_SAFE_INTEGER, unavailable + 1);
      } else if (row.outcome === "failure") failures++;
      else aborts++;
      if (row.startedAt < now - BUFFER_WINDOW_MS) crossWindow++;
    }
    return Object.freeze({
      coverage: unavailable ? "partial" : successes + failures + aborts ? "observed-completions" : "none-observed",
      successes,
      failures,
      aborts,
      completedBytes,
      crossWindow,
      dropped: unavailable
    });
  }
  __name(summarizeBufferTransport, "summarizeBufferTransport");

  // src-v2/domain/buffer-cycle.ts
  function emptyBufferCycle(at, reason = "warming-up", ineligible = false) {
    return Object.freeze({
      ...emptyBufferTrend(at, reason, ineligible),
      schemaVersion: 6,
      algorithm: "buffer-window-v6",
      cycle: null,
      lowBuffer: null
    });
  }
  __name(emptyBufferCycle, "emptyBufferCycle");
  function observeBufferCycle(input) {
    const { reading: raw, sample, previous } = input;
    const reject = /* @__PURE__ */ __name((reason2) => Object.freeze({ reading: emptyBufferCycle(sample.at, reason2), state: null }), "reject");
    if (!validBufferSample(sample)) return reject("invalid-sample");
    if (previous && (!validBufferSample(previous) || previous.rate !== sample.rate))
      return reject("context-changed");
    const priorLow = input.state?.lowConfirmation;
    if (priorLow && (typeof priorLow.tailUsed !== "boolean" || priorLow.tailUsed && (priorLow.basis !== "partial-cycle" || priorLow.confirmation.creditMs !== 2e3)))
      return reject("invalid-sample");
    const result = /* @__PURE__ */ __name((reading, state2) => Object.freeze({ reading: Object.freeze(reading), state: state2 }), "result");
    if (previous && sample.at === previous.at) return result(emptyBufferCycle(sample.at), input.state);
    if (previous && sample.at < previous.at) return reject("time-reversed");
    if (previous && sample.at - previous.at > 1500) return reject("sample-gap");
    if (raw.candidate === null)
      return result(
        { ...raw, schemaVersion: 6, algorithm: "buffer-window-v6", cycle: null, lowBuffer: null },
        null
      );
    const buffer = sample.bufferAheadSec / sample.rate;
    if (raw.at !== sample.at || raw.endBufferSec !== buffer) return reject("invalid-sample");
    const before = previous ? previous.bufferAheadSec / previous.rate : buffer;
    const prior = input.state;
    const valid = prior && previous && prior.at === previous.at && [prior.peakSec, prior.troughSec, prior.netLossSec, prior.at].every(Number.isFinite) && prior.peakSec >= prior.troughSec && prior.troughSec >= 0 && prior.netLossSec >= 0 && prior.netLossSec <= 2 && (prior.phase === "falling" || prior.phase === "rising") && (prior.cycleCreditMs === null || Number.isFinite(prior.cycleCreditMs) && prior.cycleCreditMs >= 0 && prior.cycleCreditMs <= 2e3) && [prior.lastLossAt, prior.lastRefillAt].every(
      (v) => v === null || Number.isFinite(v) && v >= 0 && v <= prior.at
    ) && (prior.rangeTroughSec === null || Number.isFinite(prior.rangeTroughSec) && prior.rangeTroughSec >= 0);
    const state = valid ? { ...prior } : {
      at: sample.at,
      peakSec: before,
      troughSec: Math.min(before, buffer),
      phase: "falling",
      netLossSec: 0,
      lastLossAt: null,
      lastRefillAt: null,
      rangeTroughSec: null,
      cycleCreditMs: null,
      confirmation: null,
      lowConfirmation: null
    };
    const debtExpired = state.lastLossAt !== null && sample.at - state.lastLossAt > 8e3;
    if (debtExpired) {
      state.netLossSec = 0;
      state.lastLossAt = null;
      state.cycleCreditMs = null;
    }
    if (state.lastRefillAt !== null && sample.at - state.lastRefillAt > 8e3)
      state.rangeTroughSec = null;
    if (buffer > before) {
      if (state.phase !== "rising") state.troughSec = Math.min(state.troughSec, before);
      state.phase = "rising";
      state.lastRefillAt = sample.at;
      if (buffer >= state.peakSec) {
        state.netLossSec = 0;
        state.lastLossAt = null;
        state.rangeTroughSec = state.troughSec;
        state.confirmation = null;
      }
    } else if (buffer < before) {
      if (state.phase === "rising") {
        const loss = state.peakSec - before;
        if (loss > 0) {
          state.netLossSec = Math.min(2, state.netLossSec + loss);
          state.lastLossAt = previous.at;
          state.rangeTroughSec = state.netLossSec < 2 ? state.troughSec : null;
        } else {
          state.netLossSec = 0;
          state.lastLossAt = null;
          state.rangeTroughSec = state.troughSec;
        }
        state.peakSec = before;
        state.troughSec = buffer;
        state.phase = "falling";
      } else state.troughSec = Math.min(state.troughSec, buffer);
    }
    const balanced = state.rangeTroughSec !== null && buffer >= state.rangeTroughSec;
    const cycleLow = state.netLossSec >= 2 && state.lastLossAt !== null && sample.at - state.lastLossAt <= 8e3 && buffer <= 10;
    const confirmed = confirmBufferTrend({
      reading: { ...raw, candidate: !balanced && (raw.candidate || cycleLow) },
      sample,
      previous,
      confirmation: state.confirmation
    });
    if (!cycleLow || balanced) state.cycleCreditMs = null;
    else if (buffer < before)
      state.cycleCreditMs = state.cycleCreditMs === null ? 0 : Math.min(2e3, state.cycleCreditMs + sample.at - previous.at);
    const cycleCandidate = cycleLow && !balanced && buffer < before && state.cycleCreditMs === 2e3;
    state.confirmation = confirmed.confirmation;
    state.at = sample.at;
    const reason = balanced && raw.candidate ? state.netLossSec > 0 ? "cycle-range-pending" : "refill-cycle-balanced" : cycleCandidate && !confirmed.reading.candidate ? "cycle-draining-low" : cycleLow && !raw.candidate && confirmed.reading.candidate ? "cycle-draining-low" : cycleLow && !raw.candidate && (confirmed.reading.reason === "candidate-confirming" || buffer < before) ? "cycle-loss-confirming" : confirmed.reading.reason;
    const coverage = declineCoverage(input.samples ?? [], sample.at);
    const partial = state.netLossSec > 0 && state.lastLossAt !== null && sample.at - state.lastLossAt <= 8e3;
    const basis = buffer <= 4 && !(balanced && state.netLossSec === 0) ? partial ? "partial-cycle" : coverage === 8e3 ? "steady-decline" : null : null;
    const oldLow = !debtExpired && basis === state.lowConfirmation?.basis ? state.lowConfirmation.confirmation : null;
    const low = confirmBufferTrend({
      reading: { ...raw, candidate: basis !== null },
      sample,
      previous,
      confirmation: oldLow
    });
    const continuousLow = oldLow !== null && low.confirmation !== null && previous !== void 0 && oldLow.at === previous.at && oldLow.creditMs === 2e3 && low.confirmation.creditMs === 2e3 && oldLow.anchorSec === low.confirmation.anchorSec && sample.at - oldLow.lastLowAt <= 8e3;
    const originalCandidate = confirmed.reading.candidate || cycleCandidate;
    const baseCandidate = originalCandidate || low.reading.candidate;
    const tailEligible = baseCandidate === false && continuousLow && basis === "partial-cycle" && buffer > 0 && buffer <= 1 && coverage >= 2e3;
    const alreadyUsed = continuousLow && priorLow?.tailUsed === true;
    const tailCandidate = tailEligible && !alreadyUsed;
    const tailUsed = alreadyUsed || tailCandidate;
    state.lowConfirmation = basis !== null && low.confirmation !== null ? Object.freeze({ basis, confirmation: low.confirmation, tailUsed }) : null;
    const lowEvidence = basis === null ? null : Object.freeze({
      basis,
      creditMs: low.confirmation?.creditMs ?? 0,
      declineCoverageMs: coverage,
      tailUsed
    });
    const lowReason = low.reading.candidate ? basis === "partial-cycle" ? "low-buffer-cycle" : "low-buffer-steady" : "low-buffer-confirming";
    return result(
      {
        ...confirmed.reading,
        candidate: baseCandidate || tailCandidate,
        schemaVersion: 6,
        algorithm: "buffer-window-v6",
        reason: tailCandidate ? "low-buffer-tail" : tailEligible && alreadyUsed ? "low-buffer-tail-used" : originalCandidate || basis === null ? reason : lowReason,
        lowBuffer: lowEvidence,
        cycle: Object.freeze({
          creditMs: cycleLow ? Math.max(state.cycleCreditMs ?? 0, confirmed.confirmation?.creditMs ?? 0) : null,
          netLossSec: state.netLossSec,
          lastLossAgeMs: state.lastLossAt === null ? null : sample.at - state.lastLossAt,
          rangeTroughSec: state.rangeTroughSec
        })
      },
      Object.freeze(state)
    );
  }
  __name(observeBufferCycle, "observeBufferCycle");
  function declineCoverage(samples, now) {
    if (samples.length < 2 || samples.length > 32 || samples.at(-1)?.at !== now) return 0;
    let covered = 0;
    for (let i = samples.length - 1; i > 0; i--) {
      const a = samples[i - 1], b = samples[i];
      if (!validBufferSample(a) || !validBufferSample(b) || a.rate !== b.rate || b.at <= a.at || b.at - a.at > 1500 || !(b.currentTime - a.currentTime > 0.05) || a.frames !== null && b.frames !== null && b.frames <= a.frames || !(b.bufferAheadSec / b.rate < a.bufferAheadSec / a.rate))
        break;
      covered = Math.min(8e3, now - a.at);
      if (covered === 8e3) break;
    }
    return covered;
  }
  __name(declineCoverage, "declineCoverage");

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
    #bufferConfirmation = null;
    #bufferSamples = [];
    #bufferCompletions = [];
    #bufferDrops = [];
    #bufferContext = null;
    #bufferRoute = null;
    #bufferRevision = 0;
    #bufferStopped = false;
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
        this.#bufferStopped = false;
        this.#timer = this.scheduler.interval(() => this.tick(), 1e3);
        this.tick();
      }
    }
    stop() {
      this.#timer?.();
      this.#timer = null;
      this.#endStall();
      this.measurement.cancel("monitor-stop");
      this.#bufferStopped = true;
      this.#resetBuffer("stopped");
    }
    reset() {
      this.#resetBuffer("reset");
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
      const bufferRevision = ++this.#bufferRevision;
      const video = this.player.snapshot(), controls = this.player.controls(), now = this.now(), disabled = this.settings.get().disabled;
      const originalMode = this.routes.isOriginalComparison();
      const visible = this.isVisible();
      this.routes.observePlaybackRate(video.available ? video.playbackRate : 0);
      if (!this.#manifestReady || this.#manifestTick++ % 5 === 0)
        this.#manifestReady = this.player.syncManifest();
      const { advanced, progress } = this.#sampleProgress(video, controls);
      const { active, ownedReload } = this.#advanceStall(
        video,
        controls,
        now,
        disabled,
        originalMode,
        visible,
        progress
      );
      const firstMediaAt = this.routes.firstMediaAt();
      const watchdog = this.#observeWatchdog(video, controls, now, progress, advanced, ownedReload);
      if (!this.#stall && !this.#failedStall && !this.recovery.isRecovering() && !controls.dragging && !disabled && !originalMode && visible && watchdog === "recovering" && (this.#startupObservedProgress || !firstMediaAt) && now - this.#lastRecoveryAt >= 3e4) {
        const state = this.session.get(), rep = state.representation;
        if (rep) {
          this.routes.recover(rep, this.#demand(video), "watchdog", state.affinity?.host ?? null);
          this.#lastRecoveryAt = now;
        }
      }
      const startupAge = this.#observeStartup(
        video,
        controls,
        now,
        disabled,
        originalMode,
        visible,
        firstMediaAt
      );
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
      let bufferTrend;
      try {
        bufferTrend = this.#observeBuffer(
          video,
          controls,
          now,
          disabled,
          originalMode,
          visible,
          bufferRevision
        );
      } catch {
        this.#clearBuffer();
        bufferTrend = Object.freeze({
          ...emptyBufferCycle(now, "invalid-sample"),
          transport: summarizeBufferTransport([], now, 0)
        });
      }
      this.#publishSnapshot(video, controls, active, watchdog, startupAge, bufferTrend);
    }
    observeTransport(observation) {
      try {
        this.#recordBufferTransport(observation);
      } catch {
        this.#clearBuffer();
      }
    }
    #recordBufferTransport(observation) {
      if (this.#bufferStopped || this.#bufferContext === null) return;
      const revision = this.#bufferRevision, now = this.now(), r = observation.request;
      const state = this.session.get(), latest = this.routes.latestRequested("video");
      if (!latest || r.generation !== state.generation || r.epoch !== state.epoch || r.representation !== latest.representation || r.generation !== latest.generation || r.epoch !== latest.epoch || r.routePolicyRevision !== latest.routePolicyRevision || r.authorityRevision !== latest.authorityRevision || r.targetHost !== latest.targetHost || this.#routeKey() !== this.#bufferRoute || !this.routes.recoveryEligible(r) || revision !== this.#bufferRevision || !Number.isFinite(observation.completedAt) || observation.completedAt > now || observation.completedAt < now - BUFFER_WINDOW_MS || !Number.isFinite(observation.startedAt) || observation.startedAt < 0 || observation.startedAt > observation.completedAt || !Number.isSafeInteger(observation.bytes) || observation.bytes < 0 || !Number.isInteger(observation.status) || observation.status < 0 || observation.status > 599 || !["success", "failure", "abort"].includes(observation.outcome) || r.requestId.length > 128)
        return;
      this.#pruneBufferTransport(now);
      if (this.#bufferCompletions.some((row) => row.request.requestId === r.requestId)) return;
      if (this.#bufferCompletions.length >= BUFFER_COMPLETION_LIMIT) {
        const bucket = Math.floor(now / 1e3) * 1e3;
        const last = this.#bufferDrops.at(-1);
        if (last?.at === bucket) last.count = Math.min(Number.MAX_SAFE_INTEGER, last.count + 1);
        else this.#bufferDrops.push({ at: bucket, count: 1 });
        return;
      }
      this.#bufferCompletions.push({
        startedAt: observation.startedAt,
        completedAt: observation.completedAt,
        bytes: observation.bytes,
        status: observation.status,
        outcome: observation.outcome,
        request: {
          requestId: r.requestId,
          generation: r.generation,
          epoch: r.epoch,
          representation: r.representation,
          routePolicyRevision: r.routePolicyRevision,
          ...r.authorityRevision !== void 0 ? { authorityRevision: r.authorityRevision } : {},
          targetHost: r.targetHost
        }
      });
    }
    #routeKey() {
      const state = this.session.get(), request = this.routes.latestRequested("video");
      const eligible = request ? this.routes.recoveryEligible(request) : false;
      const current = this.session.get();
      if (current.generation !== state.generation || current.epoch !== state.epoch || current.representation !== state.representation)
        return null;
      return JSON.stringify([
        state.generation,
        state.epoch,
        state.representation,
        request?.representation,
        request?.routePolicyRevision,
        request?.authorityRevision,
        request?.targetHost,
        state.affinity?.host,
        eligible
      ]);
    }
    #clearBuffer() {
      this.#bufferConfirmation = null;
      this.#bufferSamples = [];
      this.#bufferCompletions = [];
      this.#bufferDrops = [];
      this.#bufferContext = null;
      this.#bufferRoute = null;
    }
    #resetBuffer(reason) {
      this.#bufferRevision++;
      this.#clearBuffer();
      this.#snapshot = Object.freeze({
        ...this.#snapshot,
        bufferTrend: Object.freeze({
          ...emptyBufferCycle(this.now(), reason),
          transport: summarizeBufferTransport([], this.now(), 0)
        })
      });
    }
    #pruneBufferTransport(now) {
      this.#bufferCompletions = this.#bufferCompletions.filter(
        (r) => r.completedAt >= now - BUFFER_WINDOW_MS
      );
      this.#bufferDrops = this.#bufferDrops.filter((r) => r.at + 1e3 > now - BUFFER_WINDOW_MS).slice(-9);
    }
    #observeBuffer(video, controls, now, disabled, original, visible, revision) {
      if (revision !== this.#bufferRevision) return void 0;
      const blockers = [
        [this.#bufferStopped, "stopped"],
        [!video.available, "unavailable"],
        [disabled, "disabled"],
        [original, "original-comparison"],
        [!visible, "hidden"],
        [video.paused, "paused"],
        [video.seeking, "seeking"],
        [controls.dragging, "dragging"],
        [video.mediaError, "error"],
        [video.ended, "ended"],
        [video.bufferedToEnd, "buffered-to-end"]
      ];
      let blocked = blockers.find(([condition]) => condition)?.[1] ?? null;
      if (!blocked && this.recovery.isRecovering()) blocked = "recovering";
      if (revision !== this.#bufferRevision) return void 0;
      if (blocked) {
        this.#clearBuffer();
        return Object.freeze({
          ...emptyBufferCycle(now, blocked, true),
          transport: summarizeBufferTransport([], now, 0)
        });
      }
      const route = this.#routeKey();
      if (revision !== this.#bufferRevision) return void 0;
      if (route === null) {
        this.#clearBuffer();
        return Object.freeze({
          ...emptyBufferCycle(now, "context-changed"),
          transport: summarizeBufferTransport([], now, 0)
        });
      }
      const context = JSON.stringify([
        route,
        controls.mediaId,
        controls.coreId,
        controls.seekRevision,
        controls.userRevision,
        controls.reloadRevision,
        controls.coreReloadRevision,
        video.playbackRate
      ]);
      const changed = this.#bufferContext !== null && this.#bufferContext !== context;
      if (changed) this.#clearBuffer();
      this.#bufferContext = context;
      this.#bufferRoute = route;
      const sample = {
        at: now,
        bufferAheadSec: video.bufferAheadSec,
        rate: video.playbackRate,
        currentTime: video.currentTime,
        frames: video.frames
      };
      const previous = this.#bufferSamples.at(-1);
      let reason = changed ? "context-changed" : null;
      if (!validBufferSample(sample)) {
        this.#clearBuffer();
        reason = "invalid-sample";
      } else if (previous && now === previous.at) {
        reason = "warming-up";
      } else {
        if (previous && (now < previous.at || now - previous.at > 1500)) {
          this.#bufferSamples = [];
          this.#bufferCompletions = [];
          this.#bufferDrops = [];
          reason = now < previous.at ? "time-reversed" : "sample-gap";
        }
        this.#bufferSamples.push(sample);
        while (this.#bufferSamples.length > 1 && this.#bufferSamples[1].at <= now - BUFFER_WINDOW_MS)
          this.#bufferSamples.shift();
        if (this.#bufferSamples.length > BUFFER_SAMPLE_LIMIT) {
          this.#bufferSamples = [sample];
          reason = "sample-overflow";
        }
      }
      let reading = reason ? emptyBufferCycle(now, reason) : assessBufferTrend(this.#bufferSamples, now);
      if (reading.reason === "no-progress") {
        this.#bufferSamples = [sample];
        this.#bufferCompletions = [];
        this.#bufferDrops = [];
        reading = emptyBufferCycle(now, "no-progress", true);
      }
      this.#pruneBufferTransport(now);
      const confirmed = observeBufferCycle({
        samples: this.#bufferSamples,
        reading,
        sample,
        previous,
        state: this.#bufferConfirmation
      });
      if (revision !== this.#bufferRevision) return void 0;
      this.#bufferConfirmation = confirmed.state;
      return Object.freeze({
        ...confirmed.reading,
        transport: summarizeBufferTransport(
          this.#bufferCompletions,
          now,
          this.#bufferDrops.reduce(
            (sum, row) => Math.min(Number.MAX_SAFE_INTEGER, sum + row.count),
            0
          )
        )
      });
    }
    #sampleProgress(video, controls) {
      const controlChanged = comparePlaybackControls(controls, this.#controls) === "changed";
      const advanced = video.available && !video.seeking && !this.#lastSeeking && !video.paused && !video.ended && !video.mediaError && !controlChanged && this.#lastTime !== null && playbackTimeAdvanced(video.currentTime, this.#lastTime);
      const newFrames = video.frames !== null && this.#lastFrames !== null && playbackFramesAdvanced(video.frames, this.#lastFrames);
      const progress = advanced && (video.frames === null || newFrames);
      if (progress || !video.seeking && video.playableBufferSec >= 1) {
        this.#startupObservedProgress = true;
        if (!this.#startupRescueAttempted) this.#startupRescueState = "not-needed";
      }
      if (progress) this.#stableProgressSec++;
      else this.#stableProgressSec = 0;
      return { advanced, progress };
    }
    #advanceStall(video, controls, now, disabled, originalMode, visible, progress) {
      const recoveryTicked = !disabled && !originalMode && !!this.#stall?.armed && this.recovery.isRecovering();
      if (recoveryTicked) this.recovery.tick(video);
      if (this.#stall?.armed && !this.recovery.isRecovering() && this.recovery.snapshot().reloadCount > this.#stall.reloadCount && ["failed", "breaker", "recovered-paused"].includes(this.recovery.snapshot().state)) {
        this.#failedStall = { userRevision: this.#stall.userRevision, mediaId: this.#stall.mediaId };
      }
      if (progress || this.#failedStall && (this.#failedStall.userRevision !== controls.userRevision || this.#failedStall.mediaId !== controls.mediaId))
        this.#failedStall = null;
      const ownedReload = !!this.#stall && this.recovery.ongoingStallReload(this.#stall.id, video, controls);
      const active = !disabled && !originalMode && visible && video.available && (!video.paused || ownedReload) && !video.ended && !video.mediaError && !controls.dragging;
      if (!active) this.#endStall();
      else if (progress) this.#endStall(true);
      else if (!ownedReload && (this.#startupObservedProgress || video.seeking || controls.pendingSeekGoal))
        this.#observeStall(video, controls, now);
      if (!disabled && !originalMode && !recoveryTicked) this.recovery.tick(video);
      if (this.#stall?.armed && !this.recovery.isRecovering()) this.#stall.finished = true;
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
    #observeStartup(video, controls, now, disabled, originalMode, visible, firstMediaAt) {
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
      return startupAge;
    }
    #publishSnapshot(video, controls, active, watchdog, startupAge, bufferTrend) {
      this.#lastTime = video.available ? video.currentTime : null;
      this.#lastFrames = video.frames;
      this.#lastSeeking = video.seeking;
      this.#controls = controls;
      if (!active) {
        this.#lastTime = null;
        this.#lastFrames = null;
      }
      this.#snapshot = Object.freeze({
        ...bufferTrend ? { bufferTrend } : {},
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
      if (this.#stall && (this.#stall.userRevision !== controls.userRevision || this.#controls?.mediaId !== controls.mediaId))
        this.#endStall();
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
          fallbackAttempted: this.recovery.isRecovering() && ["route-failure", "watchdog"].includes(this.recovery.snapshot().source ?? ""),
          armed: false,
          finished: false,
          progressEnded: false,
          reloadCount: this.recovery.snapshot().reloadCount
        };
      const stall = this.#stall;
      const routeIntent = this.recovery.isRecovering() && ["route-failure", "watchdog"].includes(this.recovery.snapshot().source ?? "");
      if (routeIntent) stall.fallbackAttempted = true;
      const deadCore = video.readyState === 0 && video.width === 0 && video.height === 0 && video.coreInitialized === false && video.manifestHasVideo;
      const joinRouteIntent = routeIntent && !video.seeking && !deadCore;
      if (this.recovery.snapshot().reloadCount > stall.reloadCount) stall.finished = true;
      if (!stall.longSeek && (video.seeking || controls.pendingSeekGoal)) {
        stall.longSeek = true;
        if (stall.armed) {
          this.recovery.cancelStall(stall.id);
          stall.armed = false;
        }
      }
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
      const fallbackAfter = stall.longSeek ? 15e3 : 6e3;
      if (now - stall.startedAt < fallbackAfter && !joinRouteIntent || stall.finished || stall.armed)
        return;
      if (!requested?.representation || requested.generation !== state.generation || requested.epoch !== state.epoch || !this.routes.recoveryEligible(requested)) {
        stall.finished = true;
        this.recovery.rejectStall();
        return;
      }
      const request = requested, revision = controls.seekRevision, mediaId = controls.mediaId;
      const valid = /* @__PURE__ */ __name(() => {
        const current = this.player.controls(), latest = this.routes.latestRequested("video");
        if (this.#stall !== stall && !stall.progressEnded || !this.isVisible() || this.settings.get().disabled || this.routes.isOriginalComparison() || current.userRevision !== stall.userRevision || current.mediaId !== mediaId)
          return false;
        if (this.recovery.ongoingStallReload(stall.id, this.player.snapshot(), current))
          return !!latest && latest.generation === request.generation && latest.epoch === request.epoch && latest.routePolicyRevision === request.routePolicyRevision && this.routes.recoveryEligible(latest);
        return current.seekRevision === revision && latest?.representation === request.representation && this.routes.recoveryEligible(request);
      }, "valid");
      stall.armed = true;
      this.recovery.armStall(video, {
        id: stall.id,
        startedAt: stall.startedAt,
        targetSec: stall.targetSec,
        reloadAfterMs: stall.longSeek ? 3e4 : 12e3,
        valid
      });
      if (!stall.fallbackAttempted) {
        stall.fallbackAttempted = true;
        this.routes.recover(
          requested.representation,
          this.#demand(video),
          "watchdog",
          requested.targetHost
        );
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
      this.#restores.push(
        this.settings.subscribe((state) => {
          if (state.disabled !== this.session.get().disabled)
            this.#beginGeneration(state.disabled ? "disabled" : "enabled");
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
      this.#emit({
        type: "lifecycle",
        at: this.now(),
        generation: state.generation,
        epoch: state.epoch,
        reason
      });
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
              audio.push(
                ...items.map((item, index) => normalize(item, index, `${dashBranch}.${key}`))
              );
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
            const entry = normalize(
              item,
              index,
              `${branch}.durl:${finite2(data.quality)}`,
              true,
              format
            );
            video.push(entry);
            if (this.controller.catalogOnly() && !entry.urls.some((url) => parseMediaUrl(url)?.replaceable))
              failure = "unreplaceable-source";
          }
        }
        if (depth < 2) {
          for (const key of ["data", "result", "video_info"])
            if (isRecord(data[key])) collect(data[key], `${branch}.${key}`, depth + 1);
        }
      }, "collect");
      collect(root, "root", 0);
      if (failure) return result(failure);
      if (video.length > 128 || audio.length > 64) return result("malformed-payload");
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

  // src-v2/adapters/player-sdk.ts
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

  // src-v2/adapters/player-method.ts
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

  // src-v2/adapters/player-controls.ts
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
    #nativePosition = null;
    #controlRevision = 0;
    #goal = null;
    #positionRestore = null;
    #rateRestore = null;
    controls() {
      const reloadOwner = this.#ownedReload;
      const video = this.sources.video(), player = this.sources.player(), core = safeCall(player, "__core");
      if (video !== this.#controlVideo || player !== this.#seekOwner)
        this.#observeControls(video, player);
      this.#validateDrag();
      this.#confirmKeyboardSeek();
      this.#confirmKeyboardPlayback();
      if (video) this.#observeNativePosition(video, player);
      if (video?.seeking && Number.isFinite(video.currentTime) && video.currentTime !== this.#targetSec) {
        this.#targetSec = video.currentTime;
        if (!this.#internalSeek && this.#pendingSeek !== video.currentTime && !this.#pendingRestoreSeek(video.currentTime))
          this.#seekRevision++;
      }
      const identity = /* @__PURE__ */ __name((object2) => {
        if (!object2 || typeof object2 !== "object" && typeof object2 !== "function") return 0;
        let id = this.#objects.get(object2);
        if (id === void 0) {
          id = ++this.#objectSerial;
          this.#objects.set(object2, id);
        }
        return id;
      }, "identity");
      if (reloadOwner) this.#validateOwnedReload(video, player, core, reloadOwner);
      else if (!this.#ownedReload && !this.#awaitReloadCore && core !== this.#reloadCore)
        this.#coreReloadRevision = 0;
      this.#reloadCore = core;
      return Object.freeze({
        mediaId: identity(video),
        coreId: identity(core),
        seekRevision: this.#seekRevision,
        userRevision: this.#userRevision,
        dragging: this.#drag !== null,
        targetSec: this.#targetSec,
        pendingSeekGoal: !!this.#goal && !this.#goal.completed,
        reloadRevision: this.#reloadRevision,
        coreReloadRevision: this.#coreReloadRevision
      });
    }
    captureResumePosition(readCurrent) {
      this.controls();
      const before = this.#goal;
      const current = readCurrent();
      this.controls();
      const goal = this.#goal;
      return Object.freeze(
        goal && goal === before && !goal.completed && this.#goalCurrent(goal) ? { positionSec: goal.position, proof: goal.proof } : { positionSec: current, proof: null }
      );
    }
    validateResumePosition(capture, initializationRevision) {
      this.controls();
      if (capture.proof === null) return initializationRevision === void 0;
      const goal = this.#goal;
      return !!goal && goal.proof === capture.proof && goal.position === capture.positionSec && this.#goalCurrent(goal) && (initializationRevision === void 0 || goal.initialization?.revision === initializationRevision);
    }
    #goalCurrent(goal) {
      const video = this.sources.video(), player = this.sources.player(), lifecycle = this.sources.lifecycleKey(), core = safeCall(player, "__core");
      const reload = this.#ownedReload;
      if (reload) this.#validateOwnedReload(video, player, core, reload);
      return this.#goal === goal && goal.video === video && goal.player === player && goal.lifecycle === lifecycle && goal.userRevision === this.#userRevision && this.environment.isActuallyVisible() && (core === goal.core || !!reload && this.#ownedReload === reload && (core === null || core === void 0 || core === reload.replacement)) && video === this.sources.video() && player === this.sources.player() && lifecycle === this.sources.lifecycleKey() && this.#goal === goal && goal.userRevision === this.#userRevision;
    }
    #setGoal(video, position) {
      if (!Number.isFinite(position)) return;
      const revision = this.#userRevision, controlRevision = this.#controlRevision;
      const old = this.#goal;
      if (old && old.position === position && old.video === video && old.userRevision === this.#userRevision && this.#goalCurrent(old))
        return;
      const player = this.sources.player(), lifecycle = this.sources.lifecycleKey(), core = safeCall(player, "__core");
      if (video !== this.sources.video() || player !== this.sources.player() || lifecycle !== this.sources.lifecycleKey() || revision !== this.#userRevision || controlRevision !== this.#controlRevision)
        return;
      this.#goal = {
        proof: Object.freeze({}),
        video,
        player,
        lifecycle,
        core,
        position,
        userRevision: revision,
        completed: false,
        baseline: null,
        progress: 0,
        initialization: null
      };
    }
    #pointerGoal(video) {
      const drag = this.#drag, revision = this.#pointerRevision, position = video.currentTime;
      if (drag && drag.video === video && drag.player === this.sources.player() && drag.lifecycle === this.sources.lifecycleKey() && this.environment.isActuallyVisible() && Number.isFinite(position) && position !== drag.position && this.#drag === drag && revision === this.#pointerRevision)
        this.#setGoal(video, position);
    }
    #initializationSeek(position) {
      const goal = this.#goal, reload = this.#ownedReload;
      if (!goal || goal.completed || !Number.isFinite(position) || !reload || reload.stable || goal.initialization || !this.#goalCurrent(goal) || !this.#internalReload && !reload.replacement)
        return false;
      goal.initialization = { revision: reload.revision, seekRevision: this.#seekRevision, position };
      goal.baseline = null;
      goal.progress = 0;
      return true;
    }
    #sampleGoal(video, position) {
      const goal = this.#goal;
      if (!goal) return;
      if (!this.#goalCurrent(goal)) {
        if (this.#goal === goal) this.#goal = null;
        return;
      }
      if (goal.completed || video.readyState < 2 || video.seeking || video.ended || video.error)
        return;
      const reload = this.#ownedReload;
      if (reload?.replacement && !video.paused) reload.stable = true;
      let frames = null;
      try {
        const value = video.getVideoPlaybackQuality?.().totalVideoFrames;
        if (typeof value === "number" && Number.isFinite(value)) frames = value;
      } catch {
      }
      const at = this.environment.now?.() ?? Date.now(), before = goal.baseline;
      if (this.#goal !== goal || !this.#goalCurrent(goal)) return;
      if (!before) {
        if (Math.abs(position - goal.position) <= 1) goal.baseline = { position, frames, at };
        else if (position !== goal.initialization?.position && this.#goal === goal) this.#goal = null;
        return;
      }
      if (at <= before.at) return;
      const delta = position - before.position, maxAdvance = Math.max(1, Math.max(0, video.playbackRate) * (at - before.at) / 1e3 + 1);
      const progress = !video.paused && playbackTimeAdvanced(position, before.position) && (frames === null || before.frames !== null && playbackFramesAdvanced(frames, before.frames));
      if (this.#goal !== goal || !this.#goalCurrent(goal)) return;
      if (delta < 0 || delta > maxAdvance || video.paused && delta !== 0 && !this.#internalSeek) {
        this.#goal = null;
        return;
      }
      goal.progress = progress ? goal.progress + 1 : 0;
      goal.baseline = { position, frames, at };
      if (goal.progress >= 2) goal.completed = true;
    }
    #observeNativePosition(video, player, knownReloadZero = false) {
      const before = this.#nativePosition, revision = this.#controlRevision;
      const seekRevision = this.#seekRevision, userRevision = this.#userRevision, pendingSeek = this.#pendingSeek;
      const lifecycle = this.sources.lifecycleKey(), position = video.currentTime, readyState = video.readyState;
      const currentVideo = this.sources.video(), currentPlayer = this.sources.player(), currentLifecycle = this.sources.lifecycleKey();
      if (revision !== this.#controlRevision || this.#nativePosition !== before || video !== this.#controlVideo || player !== this.#seekOwner || currentVideo !== video || currentPlayer !== player || lifecycle !== currentLifecycle || seekRevision !== this.#seekRevision || userRevision !== this.#userRevision || pendingSeek !== this.#pendingSeek || !Number.isFinite(position))
        return;
      this.#nativePosition = { video, player, lifecycle, position, readyState };
      this.#pointerGoal(video);
      this.#sampleGoal(video, position);
      if (!before || before.video !== video || before.player !== player || before.lifecycle !== lifecycle || readyState !== 0 || before.position === position)
        return;
      const owner = this.#ownedReload;
      const initialReloadZero = position === 0 && owner?.video === video && owner.player === player && owner.lifecycle === lifecycle && (knownReloadZero || this.#internalReload > 0 && before.readyState !== 0);
      if (initialReloadZero) return;
      const goal = this.#goal;
      if (goal && position !== goal.position && !(position === 0 && before.readyState !== 0 && !this.#ownedReload) && position !== goal.initialization?.position)
        this.#goal = null;
      const alreadyObserved = this.#targetSec === position;
      this.#targetSec = position;
      if (!this.#internalSeek && position !== this.#pendingSeek) {
        this.#pendingSeek = null;
        if (!alreadyObserved) this.#seekRevision++;
      }
    }
    #observeControls(video, player) {
      this.#clearControls();
      this.#controlVideo = video;
      this.#seekOwner = player;
      if (!video) return;
      const region = video.closest(".bpx-player-container, .bilibili-player") ?? video.parentElement;
      const inRegion = /* @__PURE__ */ __name((event) => event.target instanceof Node && !!region?.contains(event.target), "inRegion");
      this.#bindPointerControls(video, player, region, inRegion);
      this.#bindControlLoss();
      this.#bindKeyboardControls(video, player, inRegion);
      this.#bindMediaControls(video);
      this.#bindSdkControls(player);
    }
    #listen(target, type, listener) {
      target.addEventListener(type, listener, true);
      this.#controlStops.push(() => target.removeEventListener(type, listener, true));
    }
    #bindPointerControls(video, player, region, inRegion) {
      this.#listen(document, "pointerdown", (event) => {
        if (!event.isTrusted) return;
        const revision = ++this.#pointerRevision;
        if (!this.environment.isActuallyVisible() || !inRegion(event) || revision !== this.#pointerRevision)
          return;
        this.#clearKeyboardSeek();
        this.#clearKeyboardPlayback();
        const playTarget = event.target instanceof Element && event.target.closest(".bpx-player-ctrl-play");
        if (!this.#advanceUser(!!playTarget && video.paused)) return;
        const lifecycle = this.sources.lifecycleKey();
        const hit = event.target instanceof Element ? event.target.closest(
          '.bpx-player-progress-wrap, .bpx-player-progress, .bilibili-player-video-progress, [role="slider"]'
        ) : null;
        if (!hit || !region?.contains(hit) || typeof PointerEvent !== "function" || !(event instanceof PointerEvent))
          return;
        const pointerId = event.pointerId;
        if (!Number.isInteger(pointerId)) return;
        const current = video === this.sources.video() && player === this.sources.player() && lifecycle === this.sources.lifecycleKey() && this.environment.isActuallyVisible();
        if (!current || video !== this.#controlVideo || player !== this.#seekOwner || revision !== this.#pointerRevision)
          return;
        this.#drag = { pointerId, video, player, lifecycle, position: video.currentTime };
      });
      const release = /* @__PURE__ */ __name((event) => {
        const drag = this.#drag;
        if (!drag || !event.isTrusted || typeof PointerEvent !== "function" || !(event instanceof PointerEvent) || event.pointerId !== drag.pointerId)
          return;
        if (this.#drag === drag) {
          this.#pointerGoal(video);
          this.#drag = null;
          this.#pointerRevision++;
        }
      }, "release");
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
        this.#listen(document, type, release);
    }
    #bindControlLoss() {
      const controlLoss = /* @__PURE__ */ __name(() => {
        this.#drag = null;
        this.#pointerRevision++;
        this.#clearKeyboardSeek();
        this.#clearKeyboardPlayback();
        this.#clearOwnedReload();
        this.#goal = null;
      }, "controlLoss");
      this.#listen(window, "blur", (event) => {
        if (event.isTrusted && event.target === window) controlLoss();
      });
      this.#controlStops.push(this.environment.subscribeControlLoss(controlLoss));
    }
    #bindKeyboardControls(video, player, inRegion) {
      const observeKeyboard = /* @__PURE__ */ __name((event) => {
        const revision = ++this.#keyboardRevision;
        this.#clearKeyboardSeek();
        this.#clearKeyboardPlayback();
        if (!(event instanceof KeyboardEvent) || !event.isTrusted || event.isComposing || event.keyCode === 229 || event.ctrlKey || event.metaKey || event.altKey || !this.environment.isActuallyVisible())
          return;
        const editable = /* @__PURE__ */ __name((target) => target instanceof Element && (!!target.closest(
          'input, textarea, select, [role="textbox"], #bilicdn-v2-control-center'
        ) || target instanceof HTMLElement && target.isContentEditable), "editable");
        if (event.composedPath().some(editable) || event.target && editable(event.target)) return;
        if (["ArrowLeft", "ArrowRight", "Home", "End", "j", "J", "l", "L"].includes(event.key)) {
          this.#beginKeyboardSeek(event, video, player, revision);
        } else if (event.type === "keydown" && ["ArrowUp", "ArrowDown", " ", "k", "K"].includes(event.key)) {
          const inside = inRegion(event);
          if (revision !== this.#keyboardRevision) return;
          if (inside) this.#advanceUser(video.paused && [" ", "k", "K"].includes(event.key));
          else this.#beginKeyboardPlayback(event, video, player, revision);
        }
      }, "observeKeyboard");
      for (const type of ["keydown", "keyup"]) this.#listen(document, type, observeKeyboard);
    }
    #bindMediaControls(video) {
      this.#listen(video, "seeking", () => {
        const position = Number.isFinite(video.currentTime) ? video.currentTime : null;
        if (!this.#internalSeek && position !== this.#pendingSeek && !this.#pendingRestoreSeek(position))
          this.#seekRevision++;
        this.#targetSec = position;
        this.#confirmKeyboardSeek();
        this.#pointerGoal(video);
        const goal = this.#goal;
        if (!this.#internalSeek && !this.#pendingRestoreSeek(position) && goal && position !== goal.position && position !== goal.initialization?.position)
          this.#goal = null;
      });
      this.#listen(video, "seeked", () => {
        this.#pendingSeek = null;
        this.#sampleGoal(video, video.currentTime);
        this.#noteRestoreLanding();
      });
    }
    #bindSdkControls(player) {
      const original = player?.seek, observer = this;
      const reload = player?.reload;
      if (player && typeof reload === "function") {
        const wrapped = /* @__PURE__ */ __name(function(...args) {
          if (!observer.#internalReload) {
            observer.#seekRevision++;
            observer.#clearOwnedReload();
            observer.#goal = null;
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
          if (!observer.#internalSeek) {
            observer.#seekRevision++;
            observer.#pendingSeek = null;
            observer.#targetSec = typeof args[0] === "number" && Number.isFinite(args[0]) ? Math.max(0, args[0]) : null;
            if (!observer.#initializationSeek(observer.#targetSec ?? NaN)) observer.#goal = null;
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
          this.#controlStops.push(observeMethod(player, "seek", original, wrapped));
        } catch {
        }
      }
    }
    #beginKeyboardSeek(event, video, player, revision) {
      const position = video.currentTime, core = safeCall(player, "__core"), lifecycle = this.sources.lifecycleKey();
      if (!Number.isFinite(position) || revision !== this.#keyboardRevision || video !== this.#controlVideo || player !== this.#seekOwner)
        return;
      const candidate = {
        event,
        video,
        player,
        lifecycle: this.sources.lifecycleKey(),
        position,
        core,
        revision,
        stop: /* @__PURE__ */ __name(() => void 0, "stop")
      };
      if (lifecycle !== candidate.lifecycle || revision !== this.#keyboardRevision) return;
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
        if (candidate.event.eventPhase === Event.NONE || candidate.revision !== this.#keyboardRevision || candidate.video !== this.#controlVideo || candidate.player !== this.#seekOwner || candidate.video !== this.sources.video() || candidate.player !== this.sources.player() || candidate.lifecycle !== this.sources.lifecycleKey() || !this.environment.isActuallyVisible()) {
          if (this.#keyboardSeek === candidate) this.#clearKeyboardSeek();
          return;
        }
        const position = candidate.video.currentTime, seeking = candidate.video.seeking, readyState = candidate.video.readyState;
        const core = safeCall(candidate.player, "__core");
        const actualSeek = seeking || readyState === 0 && core === candidate.core && !this.#internalReload;
        if (this.#keyboardSeek !== candidate || candidate.revision !== this.#keyboardRevision) return;
        if (candidate.event.eventPhase === Event.NONE || candidate.video !== this.#controlVideo || candidate.player !== this.#seekOwner || candidate.video !== this.sources.video() || candidate.player !== this.sources.player() || candidate.lifecycle !== this.sources.lifecycleKey() || !this.environment.isActuallyVisible()) {
          if (this.#keyboardSeek === candidate) this.#clearKeyboardSeek();
          return;
        }
        if (this.#keyboardSeek !== candidate || candidate.revision !== this.#keyboardRevision || this.#internalSeek || !actualSeek || !Number.isFinite(position) || position === candidate.position || position === this.#pendingSeek)
          return;
        if (this.#targetSec !== position) this.#seekRevision++;
        this.#targetSec = position;
        if (!this.#advanceUser()) return;
        this.#setGoal(candidate.video, position);
        this.#clearKeyboardSeek();
      } catch {
        if (this.#keyboardSeek === candidate) this.#clearKeyboardSeek();
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
        lifecycle: this.sources.lifecycleKey(),
        paused: video.paused,
        rate: video.playbackRate,
        kind: [" ", "k", "K"].includes(event.key) ? "pause" : "rate",
        revision,
        stop: /* @__PURE__ */ __name(() => void 0, "stop")
      };
      if (revision !== this.#keyboardRevision || video !== this.#controlVideo || player !== this.#seekOwner)
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
      const goal = this.#goal, revision = this.#userRevision;
      const valid = keepGoal && !!goal && !goal.completed && this.#goalCurrent(goal);
      if (revision !== this.#userRevision) return false;
      this.#userRevision++;
      this.#clearOwnedReload();
      if (valid && this.#goal === goal) goal.userRevision = this.#userRevision;
      else this.#goal = null;
      return true;
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
      const valid = video === owner.video && player === owner.player && owner.revision === this.#reloadRevision && owner.lifecycle === this.sources.lifecycleKey() && owner.userRevision === this.#userRevision && this.environment.isActuallyVisible();
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
      this.#validateOwnedReload(
        this.sources.video(),
        this.sources.player(),
        safeCall(owner.player, "__core"),
        owner
      );
      return this.#ownedReload === owner;
    }
    #validateDrag() {
      const drag = this.#drag;
      if (!drag) return;
      if (drag.video !== this.#controlVideo || drag.player !== this.#seekOwner || drag.video !== this.sources.video() || drag.player !== this.sources.player() || drag.lifecycle !== this.sources.lifecycleKey() || !this.environment.isActuallyVisible()) {
        if (this.#drag === drag) {
          this.#drag = null;
          this.#pointerRevision++;
        }
      }
    }
    #clearControls() {
      this.#positionRestore = null;
      this.#rateRestore = null;
      this.#goal = null;
      this.#controlRevision++;
      this.#nativePosition = null;
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
      this.#clearKeyboardPlayback();
      const userRevision = this.#userRevision, beforeRevision = this.#reloadRevision;
      const player = this.sources.player(), video = this.sources.video(), lifecycle = this.sources.lifecycleKey();
      const sourceCore = safeCall(player, "__core"), reload = player?.reload;
      if (!player || typeof reload !== "function") throw new Error("player.reload unavailable");
      const currentPlayer = this.sources.player(), currentVideo = this.sources.video(), currentCore = safeCall(player, "__core");
      const visible = this.environment.isActuallyVisible(), currentLifecycle = this.sources.lifecycleKey();
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
        stable: false,
        cancel: /* @__PURE__ */ __name(() => void 0, "cancel")
      } : null;
      this.#ownedReload = owner;
      this.#awaitReloadCore = owner !== null;
      if (owner)
        owner.cancel = this.environment.scheduler.timeout(() => {
          if (this.#ownedReload === owner) this.#clearOwnedReload();
        }, 15e3);
      if (this.#ownedReload !== owner || this.#reloadRevision !== revision || this.#userRevision !== userRevision) {
        if (this.#ownedReload === owner) this.#clearOwnedReload();
        throw new Error("player.reload ownership ended");
      }
      this.#internalReload++;
      const beforePosition = this.#nativePosition;
      try {
        const result = Reflect.apply(reload, player, []);
        if (result && (typeof result === "object" || typeof result === "function"))
          void Promise.resolve(result).catch(() => {
            if (this.#ownedReload === owner) this.#clearOwnedReload();
          });
        return result;
      } catch (error) {
        if (this.#ownedReload === owner) this.#clearOwnedReload();
        throw error;
      } finally {
        try {
          if (video && this.#ownedReload === owner)
            this.#observeNativePosition(video, player, this.#nativePosition === beforePosition);
        } catch {
          if (this.#ownedReload === owner) this.#seekRevision++;
        } finally {
          this.#internalReload--;
        }
      }
    }
    #nativeWriteGuard(canCommit) {
      const revision = this.#controlRevision, user = this.#userRevision, seek = this.#seekRevision, reload = this.#reloadRevision, video = this.sources.video(), player = this.sources.player(), lifecycle = this.sources.lifecycleKey(), core = safeCall(player, "__core");
      const revisionsMatch = /* @__PURE__ */ __name(() => revision === this.#controlRevision && user === this.#userRevision && seek === this.#seekRevision && reload === this.#reloadRevision, "revisionsMatch");
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
      this.#clearKeyboardSeek();
      this.#clearKeyboardPlayback();
      const nativeCurrent = this.#nativeWriteGuard(canCommit);
      if (this.#goal?.position === value) {
        this.#goal.baseline = null;
        this.#goal.progress = 0;
      }
      this.#internalSeek++;
      this.#pendingSeek = value;
      try {
        const player = this.sources.player(), method = player?.seek;
        if (player && typeof method === "function") {
          if (!nativeCurrent()) return { channel: "none", result: void 0 };
          return { channel: "sdk", result: Reflect.apply(method, player, [value]) };
        }
        const video = this.sources.video();
        if (video && nativeCurrent()) {
          video.currentTime = value;
          return { channel: "native", result: void 0 };
        }
        return { channel: "none", result: void 0 };
      } finally {
        this.#internalSeek--;
      }
    }
    setRate(value, canCommit = () => true) {
      this.#rateCommand(value, canCommit);
    }
    #rateCommand(value, canCommit) {
      this.#clearKeyboardPlayback();
      const nativeCurrent = this.#nativeWriteGuard(canCommit);
      const player = this.sources.player(), method = player?.setPlaybackRate;
      if (player && typeof method === "function") {
        try {
          if (!nativeCurrent()) return { channel: "none", result: void 0 };
          return { channel: "sdk", result: Reflect.apply(method, player, [value]) };
        } catch {
        }
      }
      const video = this.sources.video();
      if (video && nativeCurrent()) {
        video.playbackRate = value;
        return { channel: "native", result: void 0 };
      }
      return { channel: "none", result: void 0 };
    }
    #restoreRecord(attempt) {
      const record = attempt.kind === "position" ? this.#positionRestore : this.#rateRestore;
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
      const record = this.#positionRestore;
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
      if (command.kind === "position") this.#positionRestore = record;
      else this.#rateRestore = record;
      const current = /* @__PURE__ */ __name(() => this.#restoreCurrent(record), "current");
      let applied;
      try {
        applied = command.kind === "position" ? this.#seekCommand(command.value, current) : this.#rateCommand(command.value, current);
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
      const record = this.#positionRestore;
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
      if (!record || record.channel === "native" || record.status === "pending" || !this.#restoreCurrent(record))
        return;
      const video = this.sources.video();
      if (!video || video.seeking || video.readyState < 1 || !this.#restoreCurrent(record)) return;
      record.channel = "native";
      record.status = "settled";
      if (record.command.kind === "position") {
        record.landing = null;
        this.#pendingSeek = record.command.value;
        this.#internalSeek++;
        try {
          if (this.#restoreCurrent(record)) video.currentTime = record.command.value;
        } catch {
        } finally {
          this.#internalSeek--;
        }
      } else {
        try {
          if (this.#restoreCurrent(record)) video.playbackRate = record.command.value;
        } catch {
        }
      }
    }
    play(canCommit = () => true) {
      this.#clearKeyboardPlayback();
      const current = this.#nativeWriteGuard(canCommit);
      const player = this.sources.player(), method = player?.play;
      if (!player || typeof method !== "function") throw new Error("player.play unavailable");
      if (!current()) return void 0;
      return Reflect.apply(method, player, []);
    }
    reset() {
      this.#clearControls();
      this.#awaitReloadCore = false;
      this.#coreReloadRevision = 0;
      this.#seekRevision++;
      this.#userRevision++;
      this.#targetSec = null;
    }
  };

  // src-v2/adapters/player-media.ts
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
      return [
        {
          base_url: urls[0],
          backup_url: urls.slice(1),
          id: item.id,
          codecid: item.codecid ?? item.codecId,
          codecs: item.codecs ?? item.codec,
          width: item.width,
          height: item.height,
          bandwidth: item.bandwidth ?? item.bitrate
        }
      ];
    }), "cloneList");
    const video = cloneList(mpd.video, 128), audio = cloneList(mpd.audio, 64);
    return video.length || audio.length ? { video, audio } : null;
  }
  __name(clonePlayerManifest, "clonePlayerManifest");

  // src-v2/adapters/player.ts
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
    ownedReload(revision) {
      return this.#controls.ownedReload(revision);
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
      const rate = safeNumber(safeCall(this.player(), "getPlaybackRate"));
      return rate !== null && rate > 0 ? rate : this.snapshot().playbackRate;
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
      if (request && this.#lastMedia?.requestId === request.requestId)
        this.#lastMedia.nativeCalled = true;
    }
    noteResponse(request, status) {
      if (request && this.#lastMedia?.requestId === request.requestId) {
        this.#lastMedia.responseObserved = true;
        this.#lastMedia.status = status;
      }
    }
    async observeFetch(request, applied, originalUrl, targetUrl, response, startedAt, responseAt, bytes, outcome, failureKind) {
      const finalUrl = response?.url || "";
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
          !!response && !response.redirected && sameUrl(finalUrl, targetUrl)
        )
      );
    }
    observation(request, applied, _originalUrl, _targetUrl, finalUrl, status, bytes, startedAt, responseAt, outcome, failureKind, responseUrlMatchesRequest = false) {
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
        bytes,
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
          const requestContext = playurlRequestContext(originalUrl);
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
          let text2;
          try {
            text2 = await response2.text();
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
              new Response(text2, {
                status: response2.status,
                statusText: response2.statusText,
                headers: response2.headers
              }),
              response2
            );
          }
          try {
            const payload = JSON.parse(text2);
            const result = self.session.isGeneration(generation2) && !self.settings.get().disabled ? self.playurl.transform(payload, "trusted-api", responseKey, requestContext) : rejectedPlayurl("inactive");
            self.notePlayurl("fetch", response2.status, result, endpoint);
            if (catalogOnly() && !result.accepted) return blocked();
            text2 = JSON.stringify(payload);
          } catch {
            self.notePlayurl("fetch", response2.status, rejectedPlayurl("malformed-payload"), endpoint);
            if (catalogOnly()) return blocked();
          }
          return copyResponseSurface(
            new Response(text2, {
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
        const request = self.request(applied, originalUrl, applied.url, startedAt, method);
        activeRequest = request;
        self.routes.requestStarted(request);
        let response;
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
            aborted ? void 0 : "network"
          );
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
        let bytes = 0, settled = false;
        const settle = /* @__PURE__ */ __name((outcome, failure) => {
          if (settled) return;
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
            failure
          );
        }, "settle");
        const body = new ReadableStream({
          async pull(controller) {
            try {
              const result = await reader.read();
              if (result.done) {
                const invalid = applied.decision.routeType === "native-signed" && [403, 451, 959].includes(response.status);
                settle(
                  response.ok ? "success" : "failure",
                  invalid ? "native-invalid" : response.status >= 500 ? "http-5xx" : void 0
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

  // src-v2/adapters/xhr-values.ts
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
    const text2 = `${value}`;
    if (/[^\x00-\xff]/.test(text2)) throw new TypeError("XHR header value must be a ByteString");
    return [key, text2];
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

  // src-v2/adapters/xhr-request.ts
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

  // src-v2/adapters/xhr-response.ts
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
      const bodyValue = createXhrBodyConverter();
      const self = this.context, xhrMeta = this.#xhrMeta;
      const { waiting, finishLocal, rejectLocal } = createXhrRequestState((xhr) => xhrMeta.get(xhr));
      const open = /* @__PURE__ */ __name(function(method, url, async, username, password) {
        readyStateDescriptor?.get?.call(this);
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
          const responseType = this.responseType, requestTimeout = this.timeout, credentials = this.withCredentials;
          let preparations = 0;
          const nativeReady = /* @__PURE__ */ __name(() => waiting(this, meta) && readyStateDescriptor?.get?.call(this) === 1, "nativeReady");
          const reopen = /* @__PURE__ */ __name((url) => {
            if (++preparations > 2)
              throw new DOMException("XHR preparation did not stabilize", "InvalidStateError");
            Reflect.apply(originalOpen, this, [
              meta.method,
              url,
              meta.async,
              meta.username ?? null,
              meta.password ?? null
            ]);
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
              meta.method
            );
            self.routes.requestStarted(meta.request);
          }
          const noteHeaders = /* @__PURE__ */ __name(() => {
            if (xhrMeta.get(this) === meta && !meta.responseAt && this.readyState >= 2)
              meta.responseAt = self.now();
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
            void self.routes.observe(
              self.observation(
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
              )
            );
          }, "settle");
          const load = /* @__PURE__ */ __name(() => {
            const invalid = meta.applied?.decision.routeType === "native-signed" && [403, 451, 959].includes(this.status);
            settle(
              this.status >= 200 && this.status < 400 ? "success" : "failure",
              invalid ? "native-invalid" : this.status >= 500 ? "http-5xx" : void 0
            );
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
          else if (this.timeout > 0)
            self.measurement.noteUnpreflighted("preflight-skipped:xhr-explicit-timeout");
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
        const [key, text2] = convertXhrHeader(name, value);
        const meta = xhrMeta.get(this);
        if (meta && (meta.phase === "waiting" || meta.virtualReadyState !== null))
          throw new DOMException("header invalid state", "InvalidStateError");
        Reflect.apply(originalSetHeader, this, [key, text2]);
        if (meta && xhrMeta.get(this) === meta) meta.headers.push([key, text2]);
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

  // src-v2/diagnostics/values.ts
  var diagnosticBytes = /* @__PURE__ */ __name((value) => new TextEncoder().encode(JSON.stringify(value)).byteLength, "diagnosticBytes");
  var diagnosticText = /* @__PURE__ */ __name((value, max = 96) => String(value ?? "").slice(0, max), "diagnosticText");
  var diagnosticField = /* @__PURE__ */ __name((value, key) => value && typeof value === "object" ? Reflect.get(value, key) : void 0, "diagnosticField");
  var finiteDiagnosticNumber = /* @__PURE__ */ __name((value, min, max) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null, "finiteDiagnosticNumber");

  // src-v2/diagnostics/event-sanitizer.ts
  var DiagnosticEventSanitizer = class {
    static {
      __name(this, "DiagnosticEventSanitizer");
    }
    #aliases = /* @__PURE__ */ new Map();
    request(row) {
      return {
        requestId: diagnosticText(row.requestId, 160),
        generation: row.generation,
        epoch: row.epoch,
        routePolicyRevision: row.routePolicyRevision,
        decisionId: diagnosticText(row.decisionId, 160),
        representation: row.representation === null ? null : diagnosticText(row.representation, 160),
        ...row.authorityRevision !== void 0 ? { authorityRevision: row.authorityRevision } : {},
        kind: row.kind,
        attributionStatus: row.attributionStatus,
        attributionSource: row.attributionSource,
        decisionStage: row.decisionStage,
        routeType: row.routeType,
        originalHost: this.host(row.originalHost),
        targetHost: this.host(row.targetHost),
        sourceHost: this.host(row.sourceHost),
        playurlHostChanged: row.playurlHostChanged,
        playurlOutput: row.playurlOutput ? {
          originalHost: this.host(row.playurlOutput.originalHost) ?? "",
          outputHost: this.host(row.playurlOutput.outputHost) ?? "",
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
    transport(o) {
      return {
        ...o.request ? this.request(o.request) : {},
        decisionId: o.decisionId,
        generation: o.generation,
        epoch: o.epoch,
        kind: o.kind,
        representation: o.representation,
        routeType: o.routeType,
        originalHost: this.host(o.originalHost),
        targetHost: this.host(o.targetHost),
        responseHost: this.host(o.finalHost),
        status: o.status,
        bytes: o.bytes,
        ttfbMs: o.ttfbMs,
        elapsedMs: o.elapsedMs,
        completedAt: o.completedAt,
        outcome: o.outcome,
        failureKind: o.failureKind ?? null
      };
    }
    decision(d) {
      const chosen = d.ranking.find(
        (row) => row.candidate.host === d.host && row.candidate.type === d.routeType
      );
      return {
        decisionStage: "plan",
        id: d.id,
        action: d.action,
        reason: d.reason,
        routeType: d.routeType,
        host: this.host(d.host),
        demandRatio: chosen?.demandRatio ?? null,
        capacityAssessment: assessDemandRatio(chosen?.demandRatio ?? null)
      };
    }
    event(event, verbose) {
      let ranking = null;
      let data, important = false;
      switch (event.type) {
        case "route-decision":
        case "route-planned": {
          data = this.decision(event.decision);
          if (verbose()) {
            ranking = {
              ...data,
              ranking: event.decision.ranking.slice(0, 12).map((row) => ({
                host: this.host(row.candidate.host),
                state: row.state,
                eligible: row.eligible,
                reasons: row.reasons,
                safeMbps: row.safeThroughputMbps,
                demandRatio: row.demandRatio,
                ttfbMs: row.medianTtfbMs
              }))
            };
          }
          break;
        }
        case "transport":
        case "transport-completed":
          data = {
            ...this.transport(event.observation),
            detached: event.type === "transport-completed" && event.detached
          };
          important = true;
          break;
        case "route-confirmed":
          data = this.transport(event.observation);
          important = true;
          break;
        case "route-observed":
          data = {
            routeType: event.routeType,
            host: this.host(event.host),
            decisionId: event.decisionId
          };
          important = true;
          break;
        case "request-started":
          data = this.request(event.request);
          break;
        case "attribution-changed":
          data = { requestId: event.requestId, status: event.status, kind: event.kind };
          break;
        case "recovery":
          data = {
            action: event.action.action,
            actionId: event.action.id,
            ...event.action.action === "route-fallback" ? {
              kind: event.action.kind,
              identity: event.action.identity,
              decision: this.decision(event.action.decision)
            } : event.action.action === "player-reload" ? {
              savedPositionSec: event.action.savedPositionSec,
              savedRate: event.action.savedRate
            } : { reason: event.action.reason }
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
      return { event: { at: event.at, type: event.type, data, important }, ranking };
    }
    host(host) {
      if (!host || isCatalogHost(host) || isKnownNativeFamily(host)) return host;
      if (this.#aliases.has(host)) return this.#aliases.get(host) ?? "external";
      if (this.#aliases.size >= 64) return "external#overflow";
      const alias = "external#" + (this.#aliases.size + 1);
      this.#aliases.set(host, alias);
      return alias;
    }
    sanitize(value, key = "", depth = 0) {
      if (depth > 7) return "[bounded]";
      if (typeof value === "string")
        return key.toLowerCase().includes("host") ? this.host(value) : diagnosticText(value, 160);
      if (value === null || typeof value === "number" || typeof value === "boolean") return value;
      if (Array.isArray(value))
        return value.slice(0, 48).map((item) => this.sanitize(item, key, depth + 1));
      if (!value || typeof value !== "object") return null;
      return Object.fromEntries(
        Object.entries(value).slice(0, 48).filter(
          ([name]) => !["streamKey", "url", "path", "query", "token", "bufferTrend"].includes(name)
        ).map(([name, item]) => [name, this.sanitize(item, name, depth + 1)])
      );
    }
    reportCurrent(readModel) {
      let retained = null;
      return {
        current: this.sanitize(readModel),
        reduced: /* @__PURE__ */ __name(() => {
          const m = {
            version: diagnosticField(readModel, "version"),
            session: diagnosticField(readModel, "session"),
            monitor: diagnosticField(readModel, "monitor"),
            recovery: diagnosticField(readModel, "recovery"),
            measurement: diagnosticField(readModel, "measurement"),
            interception: diagnosticField(readModel, "interception")
          };
          retained = m;
          const r = diagnosticField(readModel, "routes");
          return this.sanitize({
            version: m.version,
            session: m.session,
            monitor: m.monitor,
            recovery: m.recovery,
            measurement: m.measurement,
            interception: m.interception,
            routes: {
              planCount: diagnosticField(r, "planCount"),
              activePlan: diagnosticField(r, "activePlan"),
              affinity: diagnosticField(r, "affinity"),
              latest: diagnosticField(r, "latest"),
              representation: diagnosticField(r, "representation"),
              attribution: diagnosticField(r, "attribution")
            },
            truncated: true
          });
        }, "reduced"),
        emergency: /* @__PURE__ */ __name(() => this.sanitize({
          version: retained?.version,
          monitor: { watchdog: diagnosticField(retained?.monitor, "watchdog") },
          truncated: true
        }), "emergency")
      };
    }
  };
  var incidentTrigger = /* @__PURE__ */ __name((event) => {
    if (event.type === "core-uninitialized") return "core:uninitialized";
    if ((event.type === "transport" || event.type === "transport-completed") && event.observation.outcome === "failure" && !(event.type === "transport-completed" && event.detached))
      return "transport:" + (event.observation.failureKind ?? "failure");
    if (event.type === "recovery") return "recovery:" + event.action.action;
    if (event.type === "core" && ["reloading", "failed"].includes(event.state))
      return "core:" + event.state;
    return null;
  }, "incidentTrigger");

  // src-v2/diagnostics/route-attempt-tracker.ts
  var RouteAttemptTracker = class {
    constructor(now) {
      this.now = now;
    }
    now;
    static {
      __name(this, "RouteAttemptTracker");
    }
    #attempts = [];
    #evictions = 0;
    tick() {
      const active = this.#activeAttempt();
      if (active && this.now() - active.at >= 3e4 && !["playback-observed", "mixed-evidence"].includes(active.stage))
        active.stage = "unconfirmed";
    }
    record(event) {
      const before = this.#evictions;
      this.#observeEvent(event);
      return this.#evictions - before;
    }
    interrupt() {
      const active = this.#activeAttempt();
      if (active) active.stage = "interrupted";
    }
    recordPlayer(sample) {
      const active = this.#activeAttempt();
      if (active) {
        if (!sample.enabled || sample.originalComparison || sample.generation !== active.identity.generation || sample.epoch !== active.identity.epoch) {
          active.stage = "interrupted";
        } else if (sample.seeking || sample.ended) {
          active.stage = "interrupted";
        } else {
          if (!active.baselineCaptured) {
            active.baselineCaptured = true;
            active.baselinePositionSec = finiteDiagnosticNumber(sample.currentTimeSec, 0, 86400);
            const buffer = finiteDiagnosticNumber(sample.playableBufferSec, 0, 86400);
            active.baselineEndSec = active.baselinePositionSec !== null && buffer !== null ? active.baselinePositionSec + buffer : null;
          }
          const position = finiteDiagnosticNumber(sample.currentTimeSec, 0, 86400);
          const progressing = !sample.paused && !sample.seeking && !sample.ended && position !== null && active.lastPositionSec !== null && position > active.lastPositionSec + 0.05;
          if (progressing && active.responseAt === null && active.stage !== "mixed-evidence")
            active.stage = "progress-unconfirmed";
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
    }
    clear() {
      this.#attempts = [];
    }
    dropOldest() {
      if (this.#attempts.length <= 1) return false;
      this.#attempts.shift();
      return true;
    }
    snapshot(projectHost) {
      return this.#attempts.map((row) => this.#attemptSummary(row, projectHost));
    }
    #activeAttempt() {
      const row = this.#attempts.at(-1);
      return row && !["mixed-evidence", "unconfirmed", "superseded", "interrupted"].includes(row.stage) && !(row.stage === "playback-observed" && this.now() - row.at >= 3e4) ? row : null;
    }
    #matches(request, attempt) {
      return !!request && request.kind === "video" && request.attributionStatus === "matched" && request.generation === attempt.identity.generation && request.epoch === attempt.identity.epoch && request.representation === attempt.identity.representation && request.authorityRevision === attempt.identity.authorityRevision && request.decisionId === attempt.decisionId && request.targetHost === attempt.host && request.startedAt >= attempt.at;
    }
    #observeEvent(event) {
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
          this.#evictions++;
        }
        return;
      }
      const active = this.#activeAttempt();
      if (!active) return;
      if (event.type === "lifecycle") {
        if (event.generation !== active.identity.generation || event.epoch !== active.identity.epoch)
          active.stage = "interrupted";
        return;
      }
      if (event.type === "request-started") {
        if (!this.#matches(event.request, active)) return;
        if (active.requestIds.size >= 32)
          active.requestIds.delete(active.requestIds.values().next().value);
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
      if (!this.#matches(observation.request, active) || !active.requestIds.has(observation.request.requestId))
        return;
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
      if (observation.outcome !== "success" || observation.status !== 206 || observation.bytes <= 0 || observation.finalHost !== active.host || observation.responseUrlMatchesRequest !== true || active.responseIds.has(observation.request.requestId))
        return;
      active.responseIds.add(observation.request.requestId);
      if (active.responseAt === null) {
        active.responseAt = event.at;
        active.stage = "response-observed";
        active.progressTicks = 0;
        active.lastProgressAt = null;
      }
    }
    #attemptSummary(row, projectHost) {
      return {
        actionId: diagnosticText(row.actionId),
        decisionId: diagnosticText(row.decisionId),
        host: projectHost(row.host),
        generation: row.identity.generation,
        epoch: row.identity.epoch,
        representation: diagnosticText(row.identity.representation),
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
  };

  // src-v2/diagnostics/report.ts
  function serializeDiagnosticReport(input) {
    const { recorder } = input;
    const payload = {
      title: "BiliCDN_TW v2 診斷報告",
      generatedAt: input.generatedAt,
      evidence: input.evidence,
      current: input.current.current,
      recorder,
      export: {
        truncated: false,
        rankingDropped: 0,
        traceDropped: 0,
        contextDropped: 0,
        flowDropped: 0,
        incidentDropped: 0,
        bufferTrendDropped: 0,
        currentReduced: false,
        emergencySummary: false
      }
    };
    let output = JSON.stringify(payload, null, 2);
    if (new TextEncoder().encode(output).byteLength <= 96 * 1024) return output;
    payload.export.truncated = true;
    output = JSON.stringify(payload);
    if (new TextEncoder().encode(output).byteLength <= 96 * 1024) return output;
    while (new TextEncoder().encode(output).byteLength > 96 * 1024 && recorder.bufferTrend.history.length) {
      recorder.bufferTrend.history.shift();
      recorder.bufferTrend.latest = recorder.bufferTrend.history.at(-1) ?? null;
      payload.export.bufferTrendDropped++;
      output = JSON.stringify(payload);
    }
    if (new TextEncoder().encode(output).byteLength <= 96 * 1024) return output;
    payload.export.rankingDropped = recorder.rankings.length;
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
    payload.current = input.current.reduced();
    payload.export.currentReduced = true;
    output = JSON.stringify(payload);
    if (new TextEncoder().encode(output).byteLength <= 96 * 1024) return output;
    const latest = recorder.routeRecovery.attempts.at(-1);
    const summary = {
      title: payload.title,
      generatedAt: payload.generatedAt,
      evidence: payload.evidence,
      current: input.current.emergency(),
      recorder: {
        incident: incident && {
          id: incident.id,
          reason: incident.reason,
          startedAt: incident.startedAt,
          state: incident.state
        },
        routeRecovery: {
          attempts: latest ? [
            {
              actionId: latest.actionId,
              decisionId: latest.decisionId,
              host: latest.host,
              stage: latest.stage
            }
          ] : []
        }
      },
      export: { ...payload.export, emergencySummary: true }
    };
    return JSON.stringify(summary);
  }
  __name(serializeDiagnosticReport, "serializeDiagnosticReport");

  // src-v2/diagnostics/buffer-trend.ts
  var reasons = [
    "warming-up",
    "invalid-sample",
    "sample-gap",
    "time-reversed",
    "sample-overflow",
    "context-changed",
    "stopped",
    "reset",
    "no-progress",
    "unavailable",
    "paused",
    "seeking",
    "dragging",
    "hidden",
    "disabled",
    "original-comparison",
    "error",
    "ended",
    "buffered-to-end",
    "recovering",
    "stable",
    "filling",
    "draining-low",
    "draining-high",
    "candidate-confirming",
    "partial-refill",
    "not-decreasing",
    "above-prior-low",
    "candidate-repaid",
    "candidate-expired",
    "cycle-draining-low",
    "cycle-loss-confirming",
    "refill-cycle-balanced",
    "cycle-range-pending",
    "low-buffer-confirming",
    "low-buffer-steady",
    "low-buffer-cycle",
    "low-buffer-tail",
    "low-buffer-tail-used"
  ];
  function object(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  __name(object, "object");
  function member(value, values) {
    return values.some((v) => value === v);
  }
  __name(member, "member");
  function number(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
    return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : void 0;
  }
  __name(number, "number");
  function nullable(value, min = 0) {
    return value === null ? null : number(value, min);
  }
  __name(nullable, "nullable");
  function sanitizeBufferTrend(value) {
    try {
      return read(value);
    } catch {
      return null;
    }
  }
  __name(sanitizeBufferTrend, "sanitizeBufferTrend");
  function read(value) {
    if (!object(value) || value.schemaVersion !== 6 || value.algorithm !== "buffer-window-v6" || !member(value.state, ["insufficient", "ineligible", "stable", "filling", "draining"]) || !member(value.reason, reasons) || !member(value.progressQuality, ["none", "frames", "time-only"]) || typeof value.interpolated !== "boolean" || value.candidate !== null && typeof value.candidate !== "boolean" || !object(value.transport))
      return null;
    const at = nullable(value.at), from = nullable(value.from), spanMs = number(value.spanMs, 0, 8e3), sampleCount = number(value.sampleCount, 0, 32), rate = nullable(value.rate), startBufferSec = nullable(value.startBufferSec), endBufferSec = nullable(value.endBufferSec), deltaSec = nullable(value.deltaSec, -Number.MAX_SAFE_INTEGER), slopeSecPerSec = nullable(value.slopeSecPerSec, -Number.MAX_SAFE_INTEGER);
    if (at === void 0 || from === void 0 || spanMs === void 0 || sampleCount === void 0 || !Number.isInteger(sampleCount) || rate === void 0 || rate !== null && rate <= 0 || startBufferSec === void 0 || endBufferSec === void 0 || deltaSec === void 0 || slopeSecPerSec === void 0 || from !== null && (at === null || from > at))
      return null;
    const insufficient = value.state === "insufficient" || value.state === "ineligible";
    if (insufficient ? value.candidate !== null : typeof value.candidate !== "boolean" || at === null || from === null || rate === null || spanMs !== 8e3 || sampleCount < 2 || at - from !== 8e3 || startBufferSec === null || endBufferSec === null || deltaSec === null || slopeSecPerSec === null)
      return null;
    let cycle = null;
    if (value.cycle !== null) {
      if (!object(value.cycle)) return null;
      const c = value.cycle, creditMs = nullable(c.creditMs), netLossSec = number(c.netLossSec, 0, 2), lastLossAgeMs = nullable(c.lastLossAgeMs), rangeTroughSec = nullable(c.rangeTroughSec);
      if (creditMs === void 0 || creditMs !== null && creditMs > 2e3 || netLossSec === void 0 || lastLossAgeMs === void 0 || lastLossAgeMs !== null && lastLossAgeMs > 8e3 || rangeTroughSec === void 0 || netLossSec > 0 && lastLossAgeMs === null || insufficient)
        return null;
      cycle = Object.freeze({ creditMs, netLossSec, lastLossAgeMs, rangeTroughSec });
    }
    let lowBuffer = null;
    if (value.lowBuffer !== null) {
      if (!object(value.lowBuffer)) return null;
      const l = value.lowBuffer;
      const creditMs = number(l.creditMs, 0, 2e3), declineCoverageMs = number(l.declineCoverageMs, 0, 8e3);
      if (!member(l.basis, ["steady-decline", "partial-cycle"]) || creditMs === void 0 || declineCoverageMs === void 0 || typeof l.tailUsed !== "boolean" || l.tailUsed && (l.basis !== "partial-cycle" || creditMs !== 2e3) || insufficient || endBufferSec === null || endBufferSec > 4 || (l.basis === "steady-decline" ? declineCoverageMs !== 8e3 : !cycle || cycle.netLossSec <= 0 || cycle.lastLossAgeMs === null))
        return null;
      lowBuffer = Object.freeze({ basis: l.basis, creditMs, declineCoverageMs, tailUsed: l.tailUsed });
    }
    const lowReason = value.reason === "low-buffer-steady" || value.reason === "low-buffer-cycle";
    const tailReason = value.reason === "low-buffer-tail" || value.reason === "low-buffer-tail-used";
    if (tailReason && (value.candidate !== (value.reason === "low-buffer-tail") || lowBuffer?.basis !== "partial-cycle" || lowBuffer.creditMs !== 2e3 || !lowBuffer.tailUsed || lowBuffer.declineCoverageMs < 2e3 || endBufferSec === null || endBufferSec <= 0 || endBufferSec > 1))
      return null;
    if (lowReason && (value.candidate !== true || lowBuffer?.creditMs !== 2e3 || lowBuffer.basis !== (value.reason === "low-buffer-steady" ? "steady-decline" : "partial-cycle")))
      return null;
    if (value.reason === "low-buffer-confirming" && (value.candidate !== false || lowBuffer === null))
      return null;
    const shortLow = value.state === "draining" && deltaSec !== null && deltaSec <= -2 && endBufferSec !== null && endBufferSec <= 10;
    const cycleLow = cycle !== null && cycle.netLossSec === 2 && cycle.lastLossAgeMs !== null && endBufferSec !== null && endBufferSec <= 10;
    if (value.reason === "cycle-draining-low" && (!cycleLow || cycle?.creditMs !== 2e3 || value.candidate !== true))
      return null;
    if (value.reason === "cycle-loss-confirming" && (!cycleLow || value.candidate !== false))
      return null;
    if ((value.reason === "refill-cycle-balanced" || value.reason === "cycle-range-pending") && (!shortLow || cycle?.rangeTroughSec === null || cycle === null || endBufferSec < cycle.rangeTroughSec || value.candidate !== false))
      return null;
    const confirmationReason = [
      "candidate-confirming",
      "partial-refill",
      "not-decreasing",
      "above-prior-low",
      "candidate-repaid",
      "candidate-expired"
    ].includes(value.reason);
    if (value.candidate === true && !lowReason && !tailReason && value.reason !== "cycle-draining-low" && (value.reason !== "draining-low" || !shortLow) || value.reason === "draining-low" && (value.candidate !== true || !shortLow) || confirmationReason && (value.candidate !== false || !shortLow && !cycleLow))
      return null;
    const t = value.transport, successes = number(t.successes, 0, 128), failures = number(t.failures, 0, 128), aborts = number(t.aborts, 0, 128), completedBytes = number(t.completedBytes), crossWindow = number(t.crossWindow, 0, 128), dropped = number(t.dropped);
    if (successes === void 0 || failures === void 0 || aborts === void 0 || completedBytes === void 0 || crossWindow === void 0 || dropped === void 0 || ![successes, failures, aborts, completedBytes, crossWindow, dropped].every(
      Number.isSafeInteger
    ) || successes + failures + aborts > 128 || crossWindow > successes + failures + aborts || !member(t.coverage, ["none-observed", "observed-completions", "partial"]) || t.coverage !== (dropped ? "partial" : successes + failures + aborts ? "observed-completions" : "none-observed"))
      return null;
    return Object.freeze({
      schemaVersion: 6,
      algorithm: "buffer-window-v6",
      cycle,
      lowBuffer,
      at,
      from,
      spanMs,
      sampleCount,
      interpolated: value.interpolated,
      progressQuality: value.progressQuality,
      state: value.state,
      reason: value.reason,
      candidate: value.candidate,
      rate,
      startBufferSec,
      endBufferSec,
      deltaSec,
      slopeSecPerSec,
      transport: Object.freeze({
        coverage: t.coverage,
        successes,
        failures,
        aborts,
        completedBytes,
        crossWindow,
        dropped
      })
    });
  }
  __name(read, "read");

  // src-v2/diagnostics/recorder.ts
  var DiagnosticRecorder = class {
    constructor(now, verbose) {
      this.now = now;
      this.verbose = verbose;
      this.#attemptTracker = new RouteAttemptTracker(now);
    }
    now;
    verbose;
    static {
      __name(this, "DiagnosticRecorder");
    }
    #bufferTrends = [];
    #bufferRevision = 0;
    #events = [];
    #flow = /* @__PURE__ */ new Map();
    #pending = /* @__PURE__ */ new Map();
    #lastSuccess = /* @__PURE__ */ new Map();
    #lastConfirmed = /* @__PURE__ */ new Map();
    #lastAttribution = /* @__PURE__ */ new Map();
    #rankings = [];
    #incident = null;
    #attemptTracker;
    #recentPlayerTrace = [];
    #lastPaused = null;
    #lastPlayerFrames = null;
    #serial = 0;
    #sanitizer = new DiagnosticEventSanitizer();
    #manualMark = null;
    #counters = {
      evicted: 0,
      incidentReplaced: 0,
      rankingEvicted: 0,
      flowEvicted: 0,
      incidentEvicted: 0,
      pendingEvicted: 0,
      eventsExpired: 0,
      flowsExpired: 0,
      traceEvicted: 0,
      attemptEvicted: 0,
      bufferTrendEvicted: 0,
      bufferTrendRejected: 0
    };
    tick() {
      if (this.#incident?.state === "capturing" && this.now() >= this.#incident.captureUntil)
        this.#incident.state = "frozen";
      this.#attemptTracker.tick();
      const floor = this.now() - 6e4;
      const events = this.#events.filter((event) => event.at >= floor);
      this.#counters.eventsExpired += this.#events.length - events.length;
      this.#events = events;
      for (const [key, row] of this.#flow)
        if (row.lastAt < floor) {
          this.#flow.delete(key);
          this.#counters.flowsExpired++;
        }
      for (const [key, row] of this.#pending)
        if (this.now() - row.startedAt > 12e4) {
          this.#pending.delete(key);
          this.#counters.pendingEvicted++;
        }
    }
    record(event, routeObservationEnabled = true) {
      this.tick();
      if (routeObservationEnabled) this.#counters.attemptEvicted += this.#attemptTracker.record(event);
      else this.#attemptTracker.interrupt();
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
          if (o.outcome === "success" && !(event.type === "transport-completed" && event.detached))
            this.#lastSuccess.set(o.kind ?? "unknown", this.#sanitizer.transport(o));
          return;
        }
      }
      const safe = this.#event(event);
      this.#events.push(safe);
      this.#trim(this.#events, 24 * 1024, "evicted");
      const trigger = incidentTrigger(event);
      if (this.#incident?.state === "capturing") {
        this.#incident.events.push(safe);
        if (trigger)
          this.#incident.captureUntil = Math.min(
            this.#incident.startedAt + 9e4,
            Math.max(this.#incident.captureUntil, event.at + 3e4)
          );
        this.#trim(this.#incident.events, 48 * 1024, "incidentEvicted");
      } else if (trigger) this.#start(trigger, event.at);
      this.#bound();
    }
    mark(reason = "manual") {
      this.tick();
      this.#manualMark = {
        at: this.now(),
        reason: diagnosticText(reason),
        count: (this.#manualMark?.count ?? 0) + 1
      };
      if (!this.#incident) this.#start(diagnosticText(reason), this.now());
      this.#bound();
    }
    clear() {
      this.#bufferRevision++;
      this.#bufferTrends = [];
      this.#incident = null;
      this.#manualMark = null;
      this.#attemptTracker.clear();
      this.#recentPlayerTrace = [];
      this.#lastPaused = null;
      this.#lastPlayerFrames = null;
    }
    recordPlayer(sample) {
      this.tick();
      this.#attemptTracker.recordPlayer(sample);
      const flags = Number(sample.paused) | Number(sample.seeking) << 1 | Number(sample.ended) << 2 | Number(sample.coreInitialized === false) << 3 | Number(sample.coreInitialized === true) << 4;
      const currentFrames = finiteDiagnosticNumber(sample.frames, 0, 2 ** 32 - 1);
      const frameDelta = currentFrames !== null && this.#lastPlayerFrames !== null ? Math.max(0, currentFrames - this.#lastPlayerFrames) : -1;
      this.#lastPlayerFrames = currentFrames;
      const row = [
        Math.trunc(sample.at),
        Math.round((finiteDiagnosticNumber(sample.currentTimeSec, 0, 86400) ?? 0) * 10),
        frameDelta,
        Math.round((finiteDiagnosticNumber(sample.playableBufferSec, 0, 86400) ?? 0) * 10),
        Math.max(0, Math.min(4, Math.trunc(sample.readyState))),
        flags,
        diagnosticText(sample.watchdog, 20)
      ].join(",");
      this.#recentPlayerTrace.push({ at: sample.at, row });
      this.#recentPlayerTrace = this.#recentPlayerTrace.filter((item) => item.at >= sample.at - 2e4).slice(-21);
      if (this.#incident?.state === "capturing" && sample.at <= this.#incident.startedAt + 9e4) {
        this.#incident.playerTrace.push(row);
        while (diagnosticBytes(this.#incident.playerTrace) > 4 * 1024 && this.#incident.playerTrace.length > 1) {
          this.#incident.playerTrace.shift();
          this.#counters.traceEvicted++;
        }
      }
      if (this.#lastPaused !== null && this.#lastPaused !== sample.paused) {
        const event = {
          at: sample.at,
          type: "player-paused-changed",
          data: { paused: sample.paused },
          important: true
        };
        this.#events.push(event);
        this.#trim(this.#events, 24 * 1024, "evicted");
        if (this.#incident?.state === "capturing") {
          this.#incident.events.push(event);
          this.#trim(this.#incident.events, 48 * 1024, "incidentEvicted");
        }
      }
      this.#lastPaused = sample.paused;
      if (sample.bufferTrend !== void 0) {
        const revision = this.#bufferRevision;
        const row2 = sanitizeBufferTrend(sample.bufferTrend);
        if (revision !== this.#bufferRevision) {
        } else if (!row2 || row2.at === null || row2.at > sample.at) this.#counters.bufferTrendRejected++;
        else if (this.#bufferTrends.at(-1)?.at !== row2.at) {
          if (this.#bufferTrends.at(-1)?.at !== void 0 && row2.at < this.#bufferTrends.at(-1).at) {
            this.#bufferTrends = [];
          }
          this.#bufferTrends.push(row2);
          while (this.#bufferTrends.length > 32 || diagnosticBytes(this.#bufferCapture(false)) > 8 * 1024) {
            this.#bufferTrends.shift();
            this.#counters.bufferTrendEvicted++;
          }
        }
      }
      this.#bound();
    }
    #bufferCapture(detached = true) {
      const history2 = detached ? structuredClone(this.#bufferTrends) : this.#bufferTrends;
      return {
        schemaVersion: 6,
        algorithm: "buffer-window-v6",
        latest: history2.at(-1) ?? null,
        history: history2
      };
    }
    snapshot() {
      return this.#capture();
    }
    #capture(detached = true) {
      return Object.freeze({
        bufferTrend: this.#bufferCapture(detached),
        coverage: {
          from: this.#events[0]?.at ?? this.now(),
          to: this.#events.at(-1)?.at ?? this.now()
        },
        incident: this.#incident && detached ? structuredClone(this.#incident) : this.#incident,
        manualMark: this.#manualMark ? { ...this.#manualMark } : null,
        flow: this.#flows(),
        lastSuccess: Object.fromEntries(this.#lastSuccess),
        pending: [...this.#pending.values()].map((row) => this.#sanitizer.request(row)),
        events: detached ? structuredClone(this.#events) : this.#events,
        rankings: detached ? structuredClone(this.#rankings) : this.#rankings,
        routeRecovery: {
          attempts: this.#attemptTracker.snapshot((host) => this.#sanitizer.host(host))
        },
        counters: { ...this.#counters }
      });
    }
    buildReport(readModel) {
      const recorder = { ...this.#capture() };
      return serializeDiagnosticReport({
        generatedAt: new Date(this.now()).toISOString(),
        evidence: this.#incident ? this.#incident.state + "-incident" : this.#lastSuccess.size ? "media-observation-only" : "playback-observation-unattributed",
        recorder,
        current: this.#sanitizer.reportCurrent(readModel)
      });
    }
    #aggregate(o) {
      const key = [
        Math.floor(o.completedAt / 5e3),
        o.kind ?? "unknown",
        o.routeType,
        this.#sanitizer.host(o.targetHost),
        this.#sanitizer.host(o.finalHost)
      ].join(":");
      const row = this.#flow.get(key) ?? {
        requests: 0,
        successes: 0,
        failures: 0,
        timeouts: 0,
        aborts: 0,
        zeroByteAborts: 0,
        noResponseAborts: 0,
        bytes: 0,
        lastAt: 0,
        maxElapsedMs: 0,
        maxTtfbMs: 0
      };
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
      while (this.#flow.size > 48 || diagnosticBytes(this.#flows()) > 12 * 1024) {
        this.#flow.delete(this.#flow.keys().next().value);
        this.#counters.flowEvicted++;
      }
      this.#bound();
    }
    #flows() {
      return [...this.#flow].map(([key, row]) => ({ key, ...row }));
    }
    #event(event) {
      const { event: safe, ranking } = this.#sanitizer.event(event, this.verbose);
      if (ranking) {
        const signature = JSON.stringify(ranking.ranking);
        if (!this.#rankings.some((row) => JSON.stringify(row.ranking) === signature))
          this.#rankings.push(ranking);
        while (this.#rankings.length > 4 || diagnosticBytes(this.#rankings) > 12 * 1024) {
          this.#rankings.shift();
          this.#counters.rankingEvicted++;
        }
      }
      return safe;
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
      while (diagnosticBytes(rows) > max && rows.length > 1) {
        let index = rows.findIndex((row) => !row.important);
        if (index < 0) index = rows.findIndex((row) => row.at !== this.#incident?.startedAt);
        rows.splice(index < 0 ? 0 : index, 1);
        this.#counters[counter]++;
      }
    }
    #bound() {
      while (diagnosticBytes(this.#capture(false)) > 128 * 1024) {
        if (this.#bufferTrends.length) {
          this.#bufferTrends.shift();
          this.#counters.bufferTrendEvicted++;
        } else if (this.#rankings.length) {
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
        } else if (this.#attemptTracker.dropOldest()) {
          this.#counters.attemptEvicted++;
        } else break;
      }
    }
  };

  // src-v2/ui/styles.ts
  var controlCenterCss = `
:host{all:initial;color-scheme:dark}*{box-sizing:border-box}.backdrop{position:fixed;inset:0;z-index:2147483647;background:#000a;display:grid;place-items:center;padding:18px;font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;color:#eef6ff}.dialog{width:min(760px,100%);max-height:88vh;display:flex;flex-direction:column;background:#101a2b;border:1px solid #405169;border-radius:12px;box-shadow:0 20px 70px #000d}.head,.foot{display:flex;align-items:center;gap:8px;padding:14px 16px;border-bottom:1px solid #34445b}.head{justify-content:space-between}.foot{justify-content:flex-end;border:0;border-top:1px solid #34445b;flex-wrap:wrap}.body{padding:14px 16px;overflow:auto;display:grid;gap:12px}h2,h3,p{margin:0}.summary{white-space:pre-wrap;color:#cfe5ff}.grid{display:grid;gap:7px}.row{display:flex;align-items:center;gap:10px;padding:8px;border:1px solid #34445b;border-radius:7px;background:#162338}.row label{flex:1;overflow-wrap:anywhere}.detail{font-size:12px;color:#9fb3ca}.btn,select{font:inherit;border:1px solid #52657e;border-radius:7px;background:#213149;color:#f6fbff;padding:7px 11px}.btn{cursor:pointer}.btn.primary{background:#075985;border-color:#0ea5e9}.btn.danger{background:#7f1d1d;border-color:#f87171}.report{width:100%;height:min(52vh,520px);background:#050a12;color:#dbeafe;border:1px solid #405169;border-radius:8px;padding:10px;font:12px/1.5 ui-monospace,Consolas,monospace;resize:vertical}
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
    const text2 = document.createElement("label");
    text2.textContent = label;
    if (detail) {
      const small = document.createElement("span");
      small.className = "detail";
      small.textContent = detail;
      text2.append(document.createElement("br"), small);
    }
    row.append(text2, control);
    return row;
  }
  __name(createRow, "createRow");
  function createToggle(label, checked, update, detail = "") {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    input.addEventListener("change", (event) => {
      if (!event.isTrusted) {
        input.checked = checked;
        return;
      }
      void update(input.checked);
    });
    return createRow(label, input, detail);
  }
  __name(createToggle, "createToggle");

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
    "原因請見診斷報告"
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
        "cross-tab-cooldown": "其他分頁最近測過速，等待冷卻",
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
  var startupLabel = /* @__PURE__ */ __name((state, reason) => {
    if (state === "running") return "正在起播前測試可用路線（最長 3 秒）";
    if (state === "complete")
      return reason === "measured" ? "已測試並選好起播路線" : "已選好合法起播路線，測試沒有明確結果";
    if (state === "skipped")
      return plain(
        reason,
        {
          "unsupported-or-no-legal-candidate": "這筆請求無法安全預測試，後續依目前選路設定處理",
          "preflight-error": "預測試未完成，後續依目前選路設定處理"
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

  // src-v2/ui/overview-view.ts
  function renderOverview(deps, frame, actions) {
    const { body, foot } = frame;
    const state = deps.session.get(), settings = deps.settings.get(), monitor = deps.monitor.snapshot();
    const affinity = state.affinity ? `${state.affinity.host}（${routeLabel(state.affinity.type)}）` : "尚未確認";
    const summary = document.createElement("p");
    summary.className = "summary";
    const sourceMode = settings.considerNativeSources ? "可參考 B 站原生來源" : "僅內建 CDN";
    const mode = settings.disabled ? "腳本已停用，網站自行選擇 CDN" : deps.routes.isOriginalComparison() ? "本分頁只用 B 站提供的網址（對照測試）" : settings.fixedHost ? `優先固定 ${settings.fixedHost}（${sourceMode}）` : `自動挑選 CDN（${sourceMode}）`;
    const recovery = deps.recovery.snapshot(), measurement = deps.measurement.snapshot();
    summary.textContent = `腳本：${settings.disabled ? "已停用" : "已啟用"}｜CDN：${mode}
選定路線：${affinity}（實際請求見下方）
播放：${playbackLabel(monitor.watchdog)}｜已緩衝約 ${monitor.video.playableBufferSec.toFixed(1)} 秒可播放內容｜${monitor.video.effectiveRate} 倍速
播放器：${recoveryLabel(recovery.state)}｜測速：${measurementLabel(measurement.state, measurement.reason)}`;
    if (recovery.state === "failed" || recovery.state === "recovered-paused")
      summary.textContent += `｜${recoveryReasonLabel(recovery.reason)}`;
    if (measurement.startup) {
      const startup = measurement.startup;
      summary.textContent += `
起播前測試：${startup.state === "complete" && startup.reason === "qualified-early" ? "已測試並選好起播路線" : startupLabel(startup.state, startup.reason)}`;
      if (startup.elapsedMs != null && Number.isFinite(startup.elapsedMs))
        summary.textContent += `｜等待 ${Math.max(0, Math.round(startup.elapsedMs))} ms`;
      if (startup.state === "complete")
        summary.textContent += `｜結束：${plain(startup.reason, { measured: "已取得有效量測", "qualified-early": "已找到足夠快的候選，提早放行", inconclusive: "證據不足" })}`;
    }
    if (measurement.range)
      summary.textContent += `
健康探測：${measurement.range.mode === "middle" ? "中段" : "首段"}｜${measurement.range.sizeKnown ? "大小已驗證" : "大小未知"}（不代表未快取）`;
    const hook = deps.transport.snapshot();
    if (hook.lastApiEndpoint)
      summary.textContent += `
播放入口：${plain(hook.lastApiEndpoint.kind, { playurl: "一般播放資料", "ogv-playview": "OGV 正片", "ogv-precheck": "OGV 片頭檢查（原文傳遞）" })}`;
    summary.textContent += `
請求攔截：${plain(hook.hookState, { installed: "運作中", degraded: "部分失效", failed: "無法啟用", "not-installed": "未啟用" })}｜腳本看到 ${Number(hook.enteredFetch) + Number(hook.enteredXhr)} 筆請求，其中 ${hook.mediaRecognized} 筆像是影音請求；交給瀏覽器 ${hook.nativeCalled} 筆，看到回應 ${hook.responseObserved} 筆`;
    if (!settings.disabled && !settings.considerNativeSources && !deps.routes.isOriginalComparison() && hook.hookState !== "installed") {
      summary.textContent += "\n請求攔截未完整，無法確認影音只依內建 CDN 選路；請以 Chrome「網路」面板核對。";
    }
    const lastHook = hook.lastMediaRequest;
    if (lastHook)
      summary.textContent += `
最近一筆影音請求：${plain(lastHook.kind, { video: "影片", audio: "音訊", unknown: "尚未分類" })}，送往 ${lastHook.targetHost ?? "未知"}｜${lastHook.nativeCalled ? "已交給瀏覽器" : "未交給瀏覽器"}｜${lastHook.responseObserved ? `收到回應${lastHook.status ? `（HTTP ${lastHook.status}）` : ""}` : "尚未看到回應"}`;
    const lastBlocked = hook.lastBlocked;
    if (lastBlocked)
      summary.textContent += `
最近擋下的請求：${lastBlocked.host}｜原因：${restrictionLabel(lastBlocked.reason)}｜沒有送給瀏覽器`;
    const playurl = hook.lastPlayurl;
    if (playurl) {
      const formats = playurl.formats.map((format) => plain(format, { dash: "DASH", mp4: "MP4", flv: "FLV" })).join("／") || "未辨識";
      summary.textContent += `
最近播放資料：${playurl.transport === "fetch" ? "Fetch" : "XHR"}｜${playurl.accepted ? "已接納" : "未接納"}｜格式：${formats}｜影片 ${playurl.videoCount}、音訊 ${playurl.audioCount}、分段 ${playurl.segmentCount}`;
      if (playurl.status) summary.textContent += `｜上游 HTTP ${playurl.status}`;
      if (playurl.upstreamCode !== null) summary.textContent += `｜上游代碼 ${playurl.upstreamCode}`;
      if (playurl.reason)
        summary.textContent += `｜原因：${plain(playurl.reason, {
          "upstream-error": "B 站回報錯誤",
          "unsupported-format": "不支援的資料格式",
          "malformed-payload": "播放資料無法解析",
          "unreplaceable-source": "來源網址無法安全改寫",
          "no-legal-route": "沒有合法路線",
          inactive: "處理時已停用或影片已切換"
        })}`;
    }
    const routes = deps.routes.snapshot(), latest = routes.latest;
    const routeRecovery = deps.diagnostics.snapshot().routeRecovery;
    const lastAttempt = routeRecovery.attempts.at(-1);
    if (lastAttempt)
      summary.textContent += `
影片備援接手：${lastAttempt.host ?? "未知 Host"}｜${plain(
        lastAttempt.stage,
        {
          planned: "已選定，尚未看到請求",
          sent: "已送出請求",
          "progress-unconfirmed": "播放器有進度，路線仍待確認",
          "response-observed": "已收到影片資料，播放接手待確認",
          "playback-observed": "播放進度與新路線接手一致",
          "mixed-evidence": "同時收到其他 Host 資料，無法歸因",
          unconfirmed: "30 秒內未取得足夠證據",
          superseded: "已由下一條備援取代",
          interrupted: "觀察因模式或影片切換中止"
        }
      )}`;
    const activePlan = routes.activePlan;
    const selected = activePlan?.ranking?.find(
      (row) => row.host === activePlan.host && row.type === activePlan.routeType
    );
    if (activePlan?.host)
      summary.textContent += `
目前路線容量：${plain(assessDemandRatio(selected?.ratio ?? null), {
        "below-required": "低於本次需求",
        "below-headroom": "未達安全餘量",
        "meets-headroom": "達到安全餘量",
        unknown: "速度樣本不足"
      })}${selected?.ratio == null || !Number.isFinite(selected.ratio) ? "" : `（保守速度約為需求的 ${selected.ratio.toFixed(2)} 倍）`}`;
    const safeMbps = selected?.safeMbps, ratio = selected?.ratio, requiredMbps = safeMbps != null && ratio != null && ratio > 0 ? safeMbps / ratio : null;
    if (safeMbps != null && Number.isFinite(safeMbps) && safeMbps > 0 && ratio != null && Number.isFinite(ratio) && ratio > 0 && requiredMbps != null && Number.isFinite(requiredMbps) && requiredMbps > 0)
      summary.textContent += `
保守吞吐 ${safeMbps.toFixed(2)} Mbps｜需求 ${requiredMbps.toFixed(2)} Mbps｜餘裕 ${ratio.toFixed(2)} 倍`;
    const restricted = activePlan?.ranking.filter((row) => !row.eligible).slice(0, 5) ?? [];
    if (restricted.length)
      summary.textContent += `
候選限制：${restricted.map((row) => `${row.host}（${row.reasons.map(restrictionLabel).join("、")}）`).join("；")}`;
    for (const [kind, label] of [
      ["video", "影片"],
      ["audio", "音訊"],
      ["unknown", "尚未分類媒體"]
    ]) {
      const row = latest[kind];
      if (!row) {
        if (kind !== "unknown") summary.textContent += `
${label}：還沒有可確認的請求`;
        continue;
      }
      const age = Math.max(0, Math.floor((deps.now() - Number(row.observedAt)) / 1e3));
      summary.textContent += `
${label}：送往 ${row.targetHost ?? "未知"} → ${row.responseHost ? `回應來自 ${row.responseHost}` : "尚未取得回應來源"}｜${age} 秒前｜${plain(row.outcome, { success: "成功", failure: "失敗", abort: "已取消" })}${row.status ? `（HTTP ${row.status}）` : ""}
  腳本在送出前換 CDN：${row.hostChanged === true ? "有" : row.hostChanged === false ? "沒有" : "尚未確認"}｜提供播放器時換 CDN：${row.playurlHostChanged === true ? "有" : row.playurlHostChanged === false ? "沒有" : "尚未確認"}｜這筆請求：${attributionLabel(row.attributionStatus)}`;
      const output = row.playurlOutput;
      if (output)
        summary.textContent += `
  播放器取得的${output.role === "backup" ? "備用" : "主要"}網址：${output.originalHost} → ${output.outputHost}`;
    }
    const rep = routes.representation;
    summary.textContent += `
目前畫質：${rep ? `${rep.height}p / ${rep.codec}` : attributionLabel(routes.attribution)}`;
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
        summary.textContent += `
${label}備用路線：${row.plannedHost}｜${stage}` + (row.responseHost ? `｜回應來自 ${row.responseHost}${row.status ? `（HTTP ${row.status}）` : ""}` : "");
    }
    summary.textContent += "\n※ 上述請求與回應由腳本觀察；要確認瀏覽器實際送出的網址，仍須查看 Chrome「網路」面板。";
    body.append(summary);
    const actionGrid = document.createElement("div");
    actionGrid.className = "grid";
    const measurementButton = createButton("安排測速（不會立即換 CDN）", () => {
      deps.commands.requestMeasurement();
      actions.overview();
    });
    const blacklistButton = createButton(
      "封鎖最近成功回應的影片 CDN 24 小時（影片＋音訊）",
      () => actions.refreshAfter(deps.commands.blacklistLatestVideo(), () => actions.overview()),
      "danger"
    );
    actionGrid.append(
      createButton(
        settings.disabled ? "啟用腳本" : "停用腳本",
        () => actions.refreshAfter(
          deps.commands.updateSettings({ disabled: !settings.disabled }),
          () => actions.overview()
        ),
        "primary"
      ),
      createButton("CDN 與播放設定", () => actions.settings()),
      createButton("查看診斷報告", () => actions.diagnostics()),
      measurementButton,
      blacklistButton,
      createButton(
        "清除測速紀錄、黑名單與故障標記",
        () => actions.refreshAfter(deps.commands.clearLearning(), () => actions.overview()),
        "danger"
      ),
      createButton(
        "還原預設設定（不清除測速紀錄）",
        () => actions.refreshAfter(deps.commands.resetSettings(), () => actions.overview()),
        "danger"
      )
    );
    if (!deps.routes.latestVideoHost()) {
      blacklistButton.disabled = true;
      blacklistButton.textContent = "最近 60 秒沒有成功的影片請求，暫時無法指定要封鎖的 CDN";
    }
    if (deps.routes.isOriginalComparison()) {
      measurementButton.disabled = true;
      measurementButton.textContent = "對照測試期間不測速";
    }
    body.append(actionGrid);
    foot.append(createButton("關閉", () => actions.close()));
  }
  __name(renderOverview, "renderOverview");

  // src-v2/ui/settings-view.ts
  function renderSettings(deps, frame, actions) {
    const { body, foot } = frame;
    const settings = deps.settings.get(), rows = document.createElement("div");
    rows.className = "grid";
    const mode = document.createElement("select");
    mode.append(
      new Option("由腳本自動挑選 CDN", ""),
      ...TRUSTED_CATALOG.map((host) => new Option(`固定使用：${host}`, host))
    );
    mode.value = settings.fixedHost ?? "";
    mode.addEventListener("change", (event) => {
      if (!event.isTrusted) return;
      void actions.refreshAfter(
        deps.commands.updateSettings({ fixedHost: mode.value || null }),
        () => actions.settings()
      );
    });
    rows.append(
      createRow(
        "要如何選 CDN",
        mode,
        "自動模式會參考可用性與測速結果；固定模式優先使用你指定的節點，但仍會避開已禁止使用的節點。"
      )
    );
    rows.append(
      createToggle(
        "允許參考 B 站原生來源",
        settings.considerNativeSources,
        (value) => {
          const pending = deps.commands.updateSettings({ considerNativeSources: value });
          if (!value) actions.settings();
          return actions.refreshAfter(pending, () => actions.settings());
        },
        "預設關閉。關閉時，腳本辨識到的影音只依內建 CDN 清單選路、測速及提供播放器備援；無法安全改寫或沒有合法內建 CDN 時會擋下請求。開啟後，B 站當次提供的原始與備用網址可參與選路。下方的原生對照測試模式獨立運作；已送出的請求不會取消。"
      )
    );
    rows.append(
      createToggle(
        "測試：只用 B 站原本提供的 CDN",
        deps.routes.isOriginalComparison(),
        (enabled) => {
          deps.commands.setOriginalComparison(enabled);
          actions.settings();
        },
        "只影響這個分頁。新影片只用 B 站提供的原始或備用網址；被禁止的 CDN 仍不會使用。測試期間不測速，也不自動換 CDN。請先開新測試分頁、啟用後再點進影片；已經交給播放器的網址不會倒回重選。重新整理頁面即可退出。"
      )
    );
    const codec = document.createElement("select");
    for (const value of ["av1", "hevc", "avc", "auto"])
      codec.append(
        new Option(
          { av1: "AV1", hevc: "H.265／HEVC", avc: "H.264／AVC", auto: "由 B 站決定" }[value],
          value
        )
      );
    codec.value = settings.codec;
    codec.addEventListener("change", (event) => {
      if (event.isTrusted)
        void deps.commands.updateSettings({ codec: codec.value });
    });
    rows.append(
      createRow(
        "偏好的影片格式",
        codec,
        "下次取得新的影片播放網址時生效；這不會強制改變你現在的播放倍速。"
      )
    );
    rows.append(
      createToggle(
        "阻止網頁使用 WebRTC",
        settings.blockWebRtc,
        (value) => deps.commands.updateSettings({ blockWebRtc: value }),
        "避免網頁建立點對點連線；不熟悉這項功能時，可維持預設值。"
      )
    );
    rows.append(
      createToggle(
        "阻止網頁使用 HTTPDNS",
        settings.blockHttpDns,
        (value) => deps.commands.updateSettings({ blockHttpDns: value }),
        "避免網頁透過 HTTPDNS 另行尋找 CDN；不熟悉這項功能時，可維持預設值。"
      )
    );
    rows.append(
      createToggle(
        "記錄更多診斷細節",
        settings.verbose,
        (value) => deps.commands.updateSettings({ verbose: value }),
        "開啟後會多記錄選路與測速資訊；關閉時仍會保留重要故障。記錄只存在目前分頁，重新整理後清空。"
      )
    );
    for (const host of TRUSTED_CATALOG) {
      const defaultEnabled = !DEFAULT_UNAVAILABLE_HOSTS.has(host);
      const enabled = settings.catalogOverrides[host] ?? defaultEnabled;
      const penalties = deps.restrictions.list().filter((row) => row.host === host).map(
        (row) => `${restrictionLabel(row.type)}（${row.kind === "all" ? "影片＋音訊" : row.kind === "video" ? "影片" : "音訊"}）`
      );
      const detail = `${defaultEnabled ? "預設可用的內建 CDN" : "預設標為不可用；勾選後才允許"}${penalties.length ? `｜目前仍被禁止：${penalties.join("、")}；勾選不會解除禁止` : ""}`;
      rows.append(
        createToggle(
          host,
          enabled,
          async (value) => {
            await deps.commands.setCatalogEnabled(host, value);
          },
          detail
        )
      );
    }
    body.append(rows);
    foot.append(createButton("返回", () => actions.overview()));
  }
  __name(renderSettings, "renderSettings");

  // src-v2/ui/diagnostics-view.ts
  function renderDiagnostics(diagnostics, frame, actions) {
    const { body, foot } = frame;
    const help = document.createElement("p");
    help.className = "detail";
    help.textContent = "遇到卡頓時，按「記下剛剛的卡頓」，再複製報告提供排查。下方是給排查用的詳細資料；只看播放狀態可返回首頁。清除事故只刪除本分頁的事故記錄，不會變更 CDN 設定。";
    body.append(help);
    const report = document.createElement("textarea");
    report.className = "report";
    report.readOnly = true;
    report.value = actions.report();
    body.append(report);
    const status = document.createElement("p");
    status.className = "detail";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    body.append(status);
    const copyReport = actions.captureCopy();
    const copy = createButton("複製報告", () => copyReport(report, copy, status));
    foot.append(
      createButton("記下剛剛的卡頓", () => {
        diagnostics.mark();
        actions.refresh();
      }),
      createButton("清除本分頁事故記錄", () => {
        diagnostics.clear();
        actions.refresh();
      }),
      copy,
      createButton("返回", () => actions.overview())
    );
  }
  __name(renderDiagnostics, "renderDiagnostics");

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
    #open = false;
    #releaseKeyboard = null;
    #pendingCopy = null;
    show(opener) {
      this.#open = true;
      this.#opener = opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      this.#ensure();
      this.#observeKeyboard();
      this.#renderOverview();
    }
    close() {
      this.#open = false;
      this.#viewVersion++;
      this.#clearKeyboard();
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
      const close = createButton("關閉", () => this.close());
      close.dataset.action = "close";
      head.append(heading, close);
      const body = document.createElement("div");
      body.className = "body";
      const foot = document.createElement("footer");
      foot.className = "foot";
      dialog.append(head, body, foot);
      backdrop.append(dialog);
      this.#shadow?.replaceChildren(createControlCenterStyle(), backdrop);
      queueMicrotask(() => {
        if (this.#ownsView(version)) close.focus();
      });
      return { body, foot };
    }
    #viewActions() {
      return {
        overview: /* @__PURE__ */ __name(() => this.#renderOverview(), "overview"),
        settings: /* @__PURE__ */ __name(() => this.#renderSettings(), "settings"),
        diagnostics: /* @__PURE__ */ __name(() => this.#renderDiagnostics(), "diagnostics"),
        close: /* @__PURE__ */ __name(() => this.close(), "close"),
        refreshAfter: /* @__PURE__ */ __name((command, render) => this.#refreshAfter(command, render), "refreshAfter")
      };
    }
    #renderOverview() {
      const frame = this.#shell("BiliCDN v2 控制中心");
      renderOverview(this.deps, frame, this.#viewActions());
    }
    #renderSettings() {
      const frame = this.#shell("CDN 與播放設定");
      renderSettings(this.deps, frame, this.#viewActions());
    }
    #renderDiagnostics() {
      const frame = this.#shell("診斷報告");
      renderDiagnostics(this.deps.diagnostics, frame, {
        overview: /* @__PURE__ */ __name(() => this.#renderOverview(), "overview"),
        refresh: /* @__PURE__ */ __name(() => this.#renderDiagnostics(), "refresh"),
        report: /* @__PURE__ */ __name(() => this.deps.diagnostics.buildReport(this.#readModel()), "report"),
        captureCopy: /* @__PURE__ */ __name(() => {
          const version = this.#viewVersion;
          return (report, button, status) => this.#copyReport(report, button, status, version);
        }, "captureCopy")
      });
    }
    async #copyReport(report, button, status, version) {
      const host = this.#host, shadow = this.#shadow;
      const ownsView = /* @__PURE__ */ __name(() => this.#ownsView(version) && this.#host === host && this.#shadow === shadow && host?.isConnected === true && report.isConnected && button.isConnected && status.isConnected, "ownsView");
      if (!ownsView()) return;
      if (this.#pendingCopy) {
        status.textContent = "前次複製尚未結束，請稍後再試";
        return;
      }
      const operation = {};
      this.#pendingCopy = operation;
      button.disabled = true;
      status.textContent = "正在複製報告…";
      try {
        const text2 = report.value;
        let clipboard, write;
        try {
          clipboard = navigator.clipboard;
          write = clipboard?.writeText;
        } catch {
        }
        if (!ownsView()) return;
        if (typeof write === "function") {
          await write.call(clipboard, text2);
          if (ownsView()) status.textContent = "已複製報告";
        } else {
          GM_setClipboard(text2, "text");
          if (ownsView()) status.textContent = "已交由腳本管理器處理，請貼上確認";
        }
      } catch {
        if (ownsView()) status.textContent = "複製失敗，請選取報告自行複製";
      } finally {
        if (this.#pendingCopy === operation) this.#pendingCopy = null;
        if (ownsView()) button.disabled = false;
      }
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
      now,
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
    const measurement = new MeasurementController(
      routes,
      meta,
      new RangeProbeAdapter(nativeFetch, now),
      now,
      scheduler,
      vault,
      Math.random
    );
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
    const runtime = new RuntimeController(
      session,
      settings,
      routes,
      player,
      monitor,
      measurement,
      recovery,
      visibility,
      diagnostics,
      now,
      content
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
    const commands = new ControlCommands(
      settings,
      restrictions,
      evidence,
      meta,
      routes,
      measurement,
      recovery,
      now
    );
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
      GM_registerMenuCommand("⚙️ 開啟 BiliCDN 控制中心", () => center.show());
    } catch {
    }
  }, "start");
  start();
})();
