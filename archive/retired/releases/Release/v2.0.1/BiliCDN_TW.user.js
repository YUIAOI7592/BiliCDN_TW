// ==UserScript==
// @name         Bilibili CDN 台灣優化
// @namespace    BiliCDN_TW
// @version      2.0.1
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
  var isPlayurlApi = /* @__PURE__ */ __name((value) => {
    try {
      const url = new URL(value, location.href);
      return url.hostname === "api.bilibili.com" && PLAYURL_PATH.test(url.pathname);
    } catch {
      return false;
    }
  }, "isPlayurlApi");

  // src-v2/state/settings-store.ts
  var SETTINGS_KEY = "bilicdn.v2.settings";
  var defaultSettings = /* @__PURE__ */ __name((now) => Object.freeze({
    schema: 2,
    disabled: false,
    fixedHost: null,
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
    #listeners = /* @__PURE__ */ new Set();
    #stopRemote;
    get() {
      return this.#state;
    }
    subscribe(listener) {
      this.#listeners.add(listener);
      return () => this.#listeners.delete(listener);
    }
    async update(change) {
      return await this.storage.withLock("settings", () => {
        const current = parseSettings(this.storage.get(SETTINGS_KEY, null), this.now());
        const now = this.now();
        const next = parseSettings({ ...current, ...change, schema: 2, updatedAt: Math.max(now, current.updatedAt + 1) }, now);
        this.storage.set(SETTINGS_KEY, next);
        this.#state = next;
        this.#emit();
        return next;
      });
    }
    async reset() {
      const next = defaultSettings(this.now());
      await this.storage.withLock("settings", () => this.storage.set(SETTINGS_KEY, next));
      this.#state = next;
      this.#emit();
      return next;
    }
    dispose() {
      this.#stopRemote();
      this.#listeners.clear();
    }
    #emit() {
      for (const listener of this.#listeners) listener(this.#state);
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
      const kind = row.kind === "video" || row.kind === "audio" || row.kind === "all" ? row.kind : "all";
      const expireAt = Number(row.expireAt);
      if (!host || !type || !Number.isFinite(expireAt) || expireAt <= now || expireAt > now + 30 * 24 * 60 * 6e4) continue;
      records.push(Object.freeze({
        host,
        type,
        kind,
        reason: String(row.reason ?? "").slice(0, 64),
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

  // src-v2/domain/url-policy.ts
  var MEDIA_URL_MAX_LENGTH = 16 * 1024;
  var MEDIA_PATH_RE = /\.(?:m4s|mp4|flv|m3u8)$/i;
  var IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
  var PCDN_SUFFIXES = ["szbdyd.com", "mountaintoys.cn", "nexusedgeio.com", "ahdohpiechei.com"];
  var PCDN_HOSTS = /* @__PURE__ */ new Set(["upos-sz-mirror14b.bilivideo.com"]);
  var hasSuffix = /* @__PURE__ */ __name((host, suffix) => host === suffix || host.endsWith(`.${suffix}`), "hasSuffix");
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
    const pcdn = /\.mcdn\.bilivideo\.(?:com|cn|net)$/i.test(host) || PCDN_SUFFIXES.some((suffix) => hasSuffix(host, suffix)) || PCDN_HOSTS.has(host) || label.startsWith("upos-") && label.includes("302") || String(url.searchParams.get("os") ?? "").toLowerCase() === "mcdn" || IPV4_RE.test(host) && nonDefaultPort;
    if (pcdn) return { url, host, kind: "pcdn", replaceable: true };
    if (nonDefaultPort || IPV4_RE.test(host)) return { url, host, kind: "suspected-pcdn", replaceable: false };
    return { url, host, kind: "normal", replaceable: isKnownNativeFamily(host) };
  }, "parseMediaUrl");
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
  var isHttpDnsUrl = /* @__PURE__ */ __name((value) => {
    try {
      return new URL(value, location.href).hostname === "httpdns.bilivideo.com";
    } catch {
      return false;
    }
  }, "isHttpDnsUrl");

  // src-v2/state/signed-route-vault.ts
  var MAX_VIDEO_GROUPS = 128;
  var MAX_AUDIO_GROUPS = 64;
  var MAX_URLS_PER_GROUP = 4;
  var MAX_URL_CHARS = 1024 * 1024;
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
    #urlChars = 0;
    #serial = 0;
    reset(generation, epoch) {
      this.#generation = generation;
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
    }
    register(input) {
      if (input.generation !== this.#generation || input.epoch !== this.#epoch) return null;
      const key = `${input.kind}:${input.key}:${input.codec}:${input.height}`;
      const priorId = this.#byKey.get(key), prior = priorId ? this.#groups.get(priorId) : void 0;
      const cap = input.kind === "video" ? MAX_VIDEO_GROUPS : MAX_AUDIO_GROUPS;
      if (!prior && [...this.#groups.values()].filter((group) => group.identity.kind === input.kind).length >= cap) return null;
      const rep = priorId ?? representationId(`${input.kind}:group-${++this.#serial}`);
      const routes = [...prior?.routes ?? []];
      for (const raw of [...new Set(input.urls)].slice(0, MAX_URLS_PER_GROUP)) {
        const parsed = parseMediaUrl(raw);
        if (!parsed || parsed.kind !== "normal" || this.#urlChars + raw.length > MAX_URL_CHARS) continue;
        if (routes.some((route) => route.url === parsed.url.href)) continue;
        if (routes.length >= MAX_URLS_PER_GROUP) {
          this.registerAlias(rep, parsed.url.href);
          continue;
        }
        const handle = signedRouteHandle(`route:${rep}:${routes.length + 1}`);
        routes.push(Object.freeze({
          handle,
          host: parsed.host,
          url: parsed.url.href,
          order: routes.length,
          activelyExplorable: isKnownNativeFamily(parsed.host)
        }));
        this.#handles.set(handle, { representation: rep, url: parsed.url.href });
        this.#index(this.#byUrl, parsed.url.href, rep);
        this.#index(this.#byPath, parsed.url.pathname, rep);
        this.#urlChars += parsed.url.href.length;
      }
      if (!routes.length) return null;
      this.#byKey.set(key, rep);
      const identity = Object.freeze({ generation: input.generation, epoch: input.epoch, representation: rep, kind: input.kind });
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
    contextForUrl(url) {
      const match = this.match(url);
      return match.status === "matched" ? match.context : null;
    }
    match(url) {
      const parsed = parseMediaUrl(url);
      if (!parsed || parsed.kind !== "normal") return { context: null, status: "waiting-data", source: "none" };
      for (const [index, source] of [[this.#byUrl, "exact"], [this.#aliases, "catalog-alias"], [this.#byPath, "path-hint"]]) {
        const reps = index.get(source === "path-hint" ? parsed.url.pathname : parsed.url.href);
        if (!reps?.size) continue;
        if (reps.size !== 1) return { context: null, status: "ambiguous", source };
        const rep = [...reps][0], context = rep ? this.#groups.get(rep)?.identity ?? null : null;
        return { context, status: source === "path-hint" ? "weak" : "matched", source };
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
    #index(index, key, rep) {
      const rows = index.get(key) ?? /* @__PURE__ */ new Set();
      rows.add(rep);
      index.set(key, rows);
    }
    candidates(representation, unlockedHosts) {
      const group = this.#groups.get(representation);
      if (!group) return { native: Object.freeze([]), root: null };
      const invalid = this.#invalid.get(representation) ?? /* @__PURE__ */ new Set();
      const native = group.routes.filter((route) => !invalid.has(route.host) && !TRUSTED_CATALOG_SET.has(route.host) && (route.activelyExplorable || unlockedHosts.has(route.host))).map((route) => Object.freeze({
        type: "native-signed",
        host: route.host,
        kind: group.identity.kind,
        catalogIndex: catalogIndex(route.host),
        route: group.identity,
        handle: route.handle,
        activelyExplorable: route.activelyExplorable
      }));
      const first = group.routes.find((route) => !invalid.has(route.host));
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
    rootUrl(representation) {
      return this.#groups.get(representation)?.routes[0]?.url ?? null;
    }
    resolve(handle, identity) {
      if (identity.generation !== this.#generation || identity.epoch !== this.#epoch) return null;
      const stored = this.#handles.get(handle);
      return stored?.representation === identity.representation ? stored.url : null;
    }
    groupSummary(representation) {
      const group = this.#groups.get(representation);
      return group ? Object.freeze({ kind: group.identity.kind, height: group.height, codec: group.codec, bandwidth: group.bandwidth, routeCount: group.routes.length }) : null;
    }
  };

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
      if (stateRank(a.state) !== stateRank(b.state)) return stateRank(b.state) - stateRank(a.state);
      if ((a.demandRatio ?? -1) !== (b.demandRatio ?? -1)) return (b.demandRatio ?? -1) - (a.demandRatio ?? -1);
      if ((a.medianTtfbMs ?? Number.MAX_SAFE_INTEGER) !== (b.medianTtfbMs ?? Number.MAX_SAFE_INTEGER)) {
        return (a.medianTtfbMs ?? Number.MAX_SAFE_INTEGER) - (b.medianTtfbMs ?? Number.MAX_SAFE_INTEGER);
      }
      return a.candidate.catalogIndex - b.candidate.catalogIndex;
    }));
  }, "rankRoutes");
  var chooseRoute = /* @__PURE__ */ __name((input, clock, id) => {
    const ranking = rankRoutes(input, clock.now());
    const current = input.current && ranking.find((row) => row.eligible && row.candidate.host === input.current?.host);
    const healthyBoundary = input.boundary !== "verified-failure" && input.boundary !== "watchdog" && input.boundary !== "user-setting";
    if (current && healthyBoundary && input.boundary !== "new-epoch") {
      const candidate = current.candidate;
      if (candidate.type === "root-original") return { action: "pass", id, reason: "healthy-affinity", routeType: "root-original", host: candidate.host, ranking };
      return { action: "rewrite", id, reason: "healthy-affinity", routeType: candidate.type, host: candidate.host, candidate, ranking };
    }
    const fixed = input.fixedHost ? ranking.find((row) => row.eligible && row.candidate.host === input.fixedHost) : null;
    const selected = fixed ?? ranking.find((row) => row.eligible && row.candidate.type !== "root-original" && (row.state === "proven" && (row.demandRatio ?? 0) >= 1.35)) ?? ranking.find((row) => row.eligible && row.candidate.type !== "root-original" && row.successCount > 0) ?? ranking.find((row) => row.eligible && row.candidate.type === "catalog-generated") ?? ranking.find((row) => row.eligible && row.candidate.type === "root-original");
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
    constructor(clock, session, settings, restrictions, evidence, vault) {
      this.clock = clock;
      this.session = session;
      this.settings = settings;
      this.restrictions = restrictions;
      this.evidence = evidence;
      this.vault = vault;
    }
    clock;
    session;
    settings;
    restrictions;
    evidence;
    vault;
    static {
      __name(this, "RouteCoordinator");
    }
    #serial = 0;
    #recoverySerial = 0;
    #decisions = /* @__PURE__ */ new Map();
    #plans = /* @__PURE__ */ new Map();
    #unlockedNative = /* @__PURE__ */ new Map();
    #listeners = /* @__PURE__ */ new Set();
    #hostLockedStreams = /* @__PURE__ */ new Set();
    #tentativeRepresentation = null;
    #tentativeTransfers = 0;
    #streamPlans = /* @__PURE__ */ new Map();
    #latest = /* @__PURE__ */ new Map();
    #requested = /* @__PURE__ */ new Map();
    #effectiveRate = 2;
    subscribe(listener) {
      this.#listeners.add(listener);
      return () => this.#listeners.delete(listener);
    }
    resetEpoch() {
      this.#plans.clear();
      this.#unlockedNative.clear();
      this.#decisions.clear();
      this.#hostLockedStreams.clear();
      this.#tentativeRepresentation = null;
      this.#tentativeTransfers = 0;
      this.#streamPlans.clear();
      this.#latest.clear();
      this.#requested.clear();
      this.#effectiveRate = 2;
    }
    invalidateForUserSetting() {
      this.#plans.clear();
      this.#streamPlans.clear();
      this.session.setAffinity(null);
    }
    requestStarted(request) {
      const key = request.kind ?? "unknown";
      this.#requested.set(key, request);
      this.#emit({ type: "request-started", at: request.startedAt, request });
      this.#emit({ type: "attribution-changed", at: request.startedAt, requestId: request.requestId, status: request.attributionStatus, kind: request.kind });
    }
    observePlaybackRate(rate) {
      this.#effectiveRate = Number.isFinite(rate) && rate > 0 ? rate : 2;
    }
    playbackRate() {
      return this.#effectiveRate;
    }
    latestVideoHost() {
      const row = this.#latest.get("video");
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
      const previous = this.#plans.get(representation);
      if (previous && !["verified-failure", "watchdog", "user-setting"].includes(boundary) && this.#decisionAllowed(previous, context, demand.kind)) return previous;
      const decision = this.#choose(context, demand, boundary, failedHost);
      this.#plans.set(representation, decision);
      return decision;
    }
    recover(representation, demand, boundary, failedHost) {
      const decision = this.plan(representation, demand, boundary, failedHost);
      this.#emit({ type: "recovery", at: this.clock.now(), action: {
        action: "route-fallback",
        id: recoveryActionId(`recovery-${++this.#recoverySerial}`),
        kind: demand.kind,
        decision
      } });
      return decision;
    }
    apply(url, kindHint = null, demand) {
      const parsed = parseMediaUrl(url);
      if (!parsed) return { decision: this.#pass("invalid-url", null, kindHint ?? "video"), url, context: null, streamKey: null, sourceHost: null };
      const streamKey = mediaIdentity(url);
      if (parsed.kind === "live" || parsed.kind === "resource" || parsed.kind === "pcdn" || parsed.kind === "suspected-pcdn") {
        return { decision: this.#pass(parsed.kind, parsed.host, kindHint ?? "video"), url, context: null, streamKey, sourceHost: parsed.host };
      }
      const match = this.vault.match(url);
      const context = match.status === "matched" ? match.context : null;
      const kind = context?.kind ?? kindHint ?? "video";
      if (streamKey && this.#hostLockedStreams.has(streamKey)) {
        const original = context ? this.vault.rootUrl(context.representation) ?? url : url;
        const originalHost = parseMediaUrl(original)?.host ?? parsed.host;
        const hard = this.#hardRestriction(originalHost, kind);
        const decision2 = hard ? this.#block(hard, originalHost) : this.#pass("host-locked", originalHost, kind);
        this.#remember(decision2, context, kind);
        return { decision: decision2, url: hard ? null : original, context, streamKey, sourceHost: originalHost };
      }
      const playbackDemand = demand ?? { kind, requiredMbps: kind === "audio" ? 0.5 : 8, highDemand: false };
      let decision = context ? this.#plans.get(context.representation) : streamKey ? this.#streamPlans.get(streamKey) : null;
      if (!decision || decision.action === "block" || !this.#decisionAllowed(decision, context, kind)) decision = context ? this.#choose(context, playbackDemand, "request", null) : this.#catalogOnly(playbackDemand, parsed.host);
      let applied = this.#materialize(url, decision, context);
      if (decision.action === "rewrite" && decision.candidate.type === "catalog-generated" && applied === null) {
        decision = this.#pass("catalog-host-not-replaceable", parsed.host, kind);
        applied = url;
      }
      this.#remember(decision, context, kind);
      if (context) this.#plans.set(context.representation, decision);
      else if (streamKey) {
        this.#streamPlans.set(streamKey, decision);
        while (this.#streamPlans.size > 192) this.#streamPlans.delete(this.#streamPlans.keys().next().value);
      }
      const sourceHost = context ? parseMediaUrl(this.vault.rootUrl(context.representation) ?? url)?.host ?? parsed.host : parsed.host;
      if (applied && context) this.vault.registerAlias(context.representation, applied);
      return { decision, url: applied, context, streamKey, sourceHost, attributionStatus: match.status, attributionSource: match.source };
    }
    decisionRecord(id) {
      return id ? this.#decisions.get(id) ?? null : null;
    }
    challenge(representation, demand, preferNative) {
      const context = this.vault.identity(representation), root = this.vault.rootUrl(representation);
      const rootKey = root ? mediaIdentity(root) : null;
      if (!context || !root || this.settings.get().fixedHost || rootKey !== null && this.#hostLockedStreams.has(rootKey)) return null;
      const settings = this.settings.get(), restriction = this.restrictions.snapshot(context.kind);
      const catalog = TRUSTED_CATALOG.map((host, index) => ({ type: "catalog-generated", host, kind: context.kind, catalogIndex: index }));
      const native = this.vault.candidates(representation, this.#unlockedNative.get(representation) ?? /* @__PURE__ */ new Set()).native.filter((candidate) => candidate.activelyExplorable);
      const candidates = preferNative ? [...native, ...catalog] : [...catalog, ...native];
      const now = this.clock.now(), currentHost = this.session.get().affinity?.host;
      const selected = candidates.find((candidate) => {
        if (candidate.host === currentHost) return false;
        if (settings.catalogOverrides[candidate.host] === false || restriction.blackHosts.has(candidate.host) || restriction.deadHosts.has(candidate.host)) return false;
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
      if (!url) return null;
      this.#remember(decision, context, context.kind);
      this.#emit({ type: "route-planned", at: now, decision });
      return { decision, url, context, streamKey: rootKey, sourceHost: parseMediaUrl(root)?.host ?? null };
    }
    async recordChallenge(applied, bytes2, elapsedMs, ttfbMs, outcome, failureKind) {
      const context = applied.context;
      if (!context || applied.decision.action !== "rewrite") return;
      const valid = /* @__PURE__ */ __name(() => context.generation === this.session.get().generation && context.epoch === this.session.get().epoch && !this.session.get().disabled, "valid");
      if (!valid()) return;
      if (failureKind === "native-invalid" && applied.decision.routeType === "native-signed") {
        this.vault.invalidate(context.representation, applied.decision.host);
        return;
      }
      if (outcome === "failure" && failureKind === null) return;
      await this.evidence.record(applied.decision.host, context.kind, {
        requestId: `challenge:${applied.decision.id}`,
        at: this.clock.now(),
        source: "challenge",
        outcome,
        throughputMbps: outcome === "success" && bytes2 >= 64 * 1024 && elapsedMs > 0 ? bytes2 * 8 / elapsedMs / 1e3 : null,
        ttfbMs,
        failureKind
      }, valid);
    }
    async observe(observation) {
      const valid = /* @__PURE__ */ __name(() => observation.generation === this.session.get().generation && observation.epoch === this.session.get().epoch && !this.session.get().disabled, "valid");
      this.#emit({ type: "transport-completed", at: this.clock.now(), observation, detached: !valid() });
      if (!valid()) return;
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
      if (observation.outcome === "abort" || !observation.finalHost) return;
      if (observation.status === 403 && observation.streamKey && observation.routeType === "catalog-generated" && (observation.request?.sourceHost ?? observation.originalHost) !== observation.targetHost) {
        this.#hostLockedStreams.add(observation.streamKey);
        return;
      }
      if (!observation.kind || request && request.attributionStatus !== "matched") return;
      const representation = observation.representation;
      const requestId2 = request?.requestId ?? `${Number(observation.generation)}:${Number(observation.epoch)}:${observation.completedAt}:${observation.targetHost}`;
      if (observation.outcome === "success") {
        const throughputMbps = observation.bytes >= 64 * 1024 && observation.elapsedMs > 0 ? observation.bytes * 8 / observation.elapsedMs / 1e3 : null;
        await this.evidence.record(observation.finalHost, observation.kind, {
          requestId: requestId2,
          at: observation.completedAt,
          source: "transport",
          outcome: "success",
          throughputMbps,
          ttfbMs: observation.ttfbMs,
          failureKind: null
        }, valid);
        if (!valid()) return;
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
        this.vault.invalidate(representation, observation.finalHost);
        const demand = { kind: observation.kind, requiredMbps: observation.kind === "audio" ? 0.5 : 8, highDemand: false };
        this.recover(representation, demand, "verified-failure", observation.finalHost);
        return;
      }
      if (!failureKind || !["network", "body", "timeout", "http-5xx"].includes(failureKind)) return;
      await this.evidence.record(observation.finalHost, observation.kind, {
        requestId: requestId2,
        at: observation.completedAt,
        source: "transport",
        outcome: "failure",
        throughputMbps: null,
        ttfbMs: observation.ttfbMs,
        failureKind
      }, valid);
      if (!valid()) return;
      if (representation) {
        const demand = { kind: observation.kind, requiredMbps: observation.kind === "audio" ? 0.5 : 8, highDemand: false };
        this.recover(representation, demand, "verified-failure", observation.finalHost);
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
        requested: Object.freeze(Object.fromEntries(this.#requested)),
        attribution: session.representation ? "confirmed" : this.#tentativeRepresentation ? "awaiting-second-video-transfer" : "awaiting-matched-video",
        representation: session.representation ? this.vault.groupSummary(session.representation) : null
      });
    }
    #choose(context, demand, boundary, failedHost) {
      const settings = this.settings.get();
      const disabledCatalogHosts = new Set(TRUSTED_CATALOG.filter((host) => settings.catalogOverrides[host] === false));
      const defaultUnavailableHosts = new Set(TRUSTED_CATALOG.filter((host) => DEFAULT_UNAVAILABLE_HOSTS.has(host) && settings.catalogOverrides[host] !== true));
      const restriction = this.restrictions.snapshot(context.kind);
      const unlocked = this.#unlockedNative.get(context.representation) ?? /* @__PURE__ */ new Set();
      const routes = this.vault.candidates(context.representation, unlocked);
      const catalog = TRUSTED_CATALOG.map((host, index) => Object.freeze({
        type: "catalog-generated",
        host,
        kind: context.kind,
        catalogIndex: index
      }));
      const candidates = [...catalog, ...routes.native, ...routes.root ? [routes.root] : []];
      const id = this.#nextId();
      const current = this.#plans.get(context.representation), affinity = this.session.get().affinity;
      const currentRoute = current && current.action !== "block" && current.host ? { type: current.routeType, host: current.host } : context.kind === "video" && affinity ? { type: affinity.type, host: affinity.host } : null;
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
    #catalogOnly(demand, originalHost) {
      const settings = this.settings.get(), restriction = this.restrictions.snapshot(demand.kind);
      const candidates = TRUSTED_CATALOG.map((host, index) => ({ type: "catalog-generated", host, kind: demand.kind, catalogIndex: index }));
      const id = this.#nextId();
      const decision = chooseRoute({
        candidates,
        evidenceFor: /* @__PURE__ */ __name((host, kind) => this.evidence.get(host, kind), "evidenceFor"),
        restrictions: {
          disabledCatalogHosts: new Set(TRUSTED_CATALOG.filter((host) => settings.catalogOverrides[host] === false)),
          defaultUnavailableHosts: new Set(TRUSTED_CATALOG.filter((host) => DEFAULT_UNAVAILABLE_HOSTS.has(host) && settings.catalogOverrides[host] !== true)),
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
        const forbidden = this.#hardRestriction(originalHost, demand.kind);
        return forbidden ? this.#block(forbidden, originalHost) : this.#pass("catalog-unavailable", originalHost, demand.kind);
      }
      return decision;
    }
    #materialize(original, decision, context) {
      if (decision.action === "block") return null;
      if (decision.action === "pass") return original;
      if (decision.candidate.type === "catalog-generated") return replaceUrlHost(original, decision.host);
      return context ? this.vault.resolve(decision.candidate.handle, context) ?? original : original;
    }
    #pass(reason, host, kind) {
      return { action: "pass", id: this.#nextId(), reason: reason.slice(0, 64), routeType: "root-original", host, ranking: Object.freeze([]) };
    }
    #block(reason, host) {
      return { action: "block", id: this.#nextId(), reason, routeType: "root-original", host, ranking: Object.freeze([]) };
    }
    #hardRestriction(host, kind) {
      const settings = this.settings.get(), restriction = this.restrictions.snapshot(kind), evidence = this.evidence.get(host, kind);
      if (restriction.blackHosts.has(host)) return "black";
      if (restriction.deadHosts.has(host)) return "dead";
      if (settings.catalogOverrides[host] === false) return "catalog-disabled";
      if (DEFAULT_UNAVAILABLE_HOSTS.has(host) && settings.catalogOverrides[host] !== true) return "default-unavailable";
      if (evidence && evidence.circuitUntil > this.clock.now()) return "circuit-open";
      return null;
    }
    #decisionAllowed(decision, context, kind) {
      if (decision.action === "block" || !decision.host || this.#hardRestriction(decision.host, kind)) return false;
      if (decision.action === "pass") return true;
      const candidate = decision.candidate;
      if (candidate.type === "catalog-generated") return true;
      if (!context) return false;
      return this.vault.candidates(context.representation, this.#unlockedNative.get(context.representation) ?? /* @__PURE__ */ new Set()).native.some((route) => route.handle === candidate.handle && route.host === decision.host);
    }
    #nextId() {
      return decisionId(`decision-${++this.#serial}`);
    }
    #remember(decision, context, kind) {
      this.#decisions.set(decision.id, { decision, context, kind, representation: context?.representation ?? null });
      while (this.#decisions.size > 256) this.#decisions.delete(this.#decisions.keys().next().value);
    }
    #emit(event) {
      for (const listener of this.#listeners) listener(event);
    }
  };

  // src-v2/application/measurement-controller.ts
  var META_KEY = "bilicdn.v2.meta";
  var CHALLENGE_COOLDOWN_MS = 10 * 60 * 1e3;
  var CHALLENGE_TIMEOUT_MS = 3e3;
  var MeasurementController = class {
    constructor(routes, storage, nativeFetch, now) {
      this.routes = routes;
      this.storage = storage;
      this.nativeFetch = nativeFetch;
      this.now = now;
    }
    routes;
    storage;
    nativeFetch;
    now;
    static {
      __name(this, "MeasurementController");
    }
    #running = null;
    #manualRequested = false;
    #preferNative = false;
    #generationMarker = 0;
    #snapshot = Object.freeze({ state: "idle", reason: "startup", lastAttemptAt: 0, host: null });
    snapshot() {
      return this.#snapshot;
    }
    reset() {
      this.cancel("generation");
      this.#generationMarker++;
      this.#manualRequested = false;
      this.#snapshot = Object.freeze({ state: "idle", reason: "generation", lastAttemptAt: 0, host: null });
    }
    requestManual() {
      this.#manualRequested = true;
    }
    cancel(reason) {
      if (this.#running) this.#running.controller.abort(reason);
      this.#running = null;
    }
    tick(status) {
      const unsafe = this.#unsafeReason(status);
      if (this.#running && unsafe) {
        this.cancel(unsafe);
        this.#snapshot = Object.freeze({ ...this.#snapshot, state: "cancelled", reason: unsafe });
        return;
      }
      if (this.#running) return;
      if (unsafe) {
        this.#snapshot = Object.freeze({ ...this.#snapshot, state: "waiting", reason: unsafe });
        return;
      }
      void this.#tryStart(status);
    }
    async #tryStart(status) {
      if (!status.representation || !status.demand || this.#running) return;
      const now = this.now();
      let claimed = false;
      await this.storage.withLock("measurement", () => {
        const raw = this.storage.get(META_KEY, null);
        const meta = raw && typeof raw === "object" ? raw : {};
        const last = Number(meta.lastChallengeAt) || 0;
        if (now - last < CHALLENGE_COOLDOWN_MS) return;
        this.storage.set(META_KEY, { schema: 2, lastChallengeAt: now, updatedAt: now });
        claimed = true;
      });
      if (!claimed) {
        this.#snapshot = Object.freeze({ ...this.#snapshot, state: "waiting", reason: "cross-tab-cooldown" });
        return;
      }
      const applied = this.routes.challenge(status.representation, status.demand, this.#preferNative);
      this.#preferNative = !this.#preferNative;
      this.#manualRequested = false;
      if (!applied?.url) {
        this.#snapshot = Object.freeze({ state: "complete", reason: "no-stale-candidate", lastAttemptAt: now, host: null });
        return;
      }
      const controller = new AbortController(), marker = this.#generationMarker;
      this.#running = { controller, generationMarker: marker };
      this.#snapshot = Object.freeze({ state: "running", reason: "safe-challenger", lastAttemptAt: now, host: applied.decision.host });
      await this.#run(applied, status.demand, controller, marker);
    }
    async #run(applied, demand, controller, marker) {
      const startedAt = this.now(), maxBytes = demand.highDemand ? 768 * 1024 : 384 * 1024;
      const timeout = setTimeout(() => controller.abort("timeout"), CHALLENGE_TIMEOUT_MS);
      let bytes2 = 0, responseAt = 0, failure = null, ok = false;
      try {
        const response = await this.nativeFetch(applied.url ?? "", {
          method: "GET",
          headers: { Range: `bytes=0-${maxBytes - 1}` },
          credentials: "omit",
          cache: "no-store",
          signal: controller.signal
        });
        responseAt = this.now();
        if (!response.ok || !response.body) {
          failure = applied.decision.routeType === "native-signed" && [403, 451, 959].includes(response.status) ? "native-invalid" : response.status >= 500 ? "http-5xx" : null;
        } else {
          const reader = response.body.getReader();
          try {
            while (bytes2 < maxBytes) {
              const item = await reader.read();
              if (item.done) break;
              bytes2 += item.value.byteLength;
              if (bytes2 >= maxBytes) {
                await reader.cancel("sample-complete");
                break;
              }
            }
            ok = bytes2 >= 64 * 1024;
            if (!ok) failure = "body";
          } finally {
            try {
              reader.releaseLock();
            } catch {
            }
          }
        }
      } catch (error) {
        if (controller.signal.aborted && controller.signal.reason !== "timeout") {
          this.#snapshot = Object.freeze({ state: "cancelled", reason: String(controller.signal.reason || "cancelled").slice(0, 48), lastAttemptAt: startedAt, host: applied.decision.host });
          return;
        }
        failure = controller.signal.reason === "timeout" ? "timeout" : "network";
      } finally {
        clearTimeout(timeout);
        if (this.#running?.generationMarker === marker) this.#running = null;
      }
      if (marker !== this.#generationMarker) return;
      const elapsed = Math.max(1, this.now() - startedAt), ttfb = responseAt ? responseAt - startedAt : null;
      await this.routes.recordChallenge(applied, bytes2, elapsed, ttfb, ok ? "success" : "failure", failure);
      this.#snapshot = Object.freeze({ state: ok ? "complete" : "failed", reason: ok ? "sample-recorded" : failure ?? "http-status", lastAttemptAt: startedAt, host: applied.decision.host });
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
    constructor(player, now) {
      this.player = player;
      this.now = now;
    }
    player;
    now;
    static {
      __name(this, "RecoveryController");
    }
    #listeners = /* @__PURE__ */ new Set();
    #pauseAt = 0;
    #hadHealthy = false;
    #lastHealthyTime = 0;
    #lastHealthyRate = 2;
    #token = null;
    #serial = 0;
    #reloadCount = 0;
    #breakerUntil = 0;
    #hookedPlayer = null;
    #originalPlay = null;
    #wrappedPlay = null;
    #suppress = false;
    #lifecycleSerial = 0;
    #lastFrames = null;
    #lastSnapshot = null;
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
    reset() {
      if (this.#token) this.#finish("failed", "lifecycle-ended");
      this.#lifecycleSerial++;
      this.#lastFrames = null;
      this.#lastSnapshot = null;
      this.#unhook();
      this.#pauseAt = 0;
      this.#hadHealthy = false;
      this.#lastHealthyTime = 0;
      this.#token = null;
      this.#reloadCount = 0;
      this.#breakerUntil = 0;
      this.#state = Object.freeze({ state: "healthy", source: null, pauseSec: 0, reloadCount: 0, breakerSec: 0 });
    }
    armRouteFailure(source, snapshot) {
      if (this.#token || snapshot.paused || snapshot.seeking || snapshot.ended || snapshot.mediaError || !this.#hadHealthy) return;
      this.#begin(source, true);
    }
    tick(snapshot) {
      const now = this.now();
      const newFrames = snapshot.frames !== null && this.#lastFrames !== null && snapshot.frames > this.#lastFrames;
      this.#lastFrames = snapshot.frames;
      this.#lastSnapshot = snapshot;
      const healthy = snapshot.available && !snapshot.mediaError && (snapshot.readyState >= 2 || snapshot.width > 0 || snapshot.height > 0 || newFrames);
      if (healthy) {
        this.#hadHealthy = true;
        this.#lastHealthyTime = snapshot.currentTime;
        this.#lastHealthyRate = snapshot.playbackRate > 0 ? snapshot.playbackRate : 2;
        if (!this.#token && !snapshot.paused && ["failed", "breaker"].includes(this.#state.state)) this.#finish("recovered", "healthy-playback-observed");
        if (this.#token) {
          if (this.#token.reloadingAt && !this.#token.restored) this.#restore(this.#token, snapshot);
          else if (!this.#token.reloadingAt && (snapshot.currentTime > this.#token.baselinePositionSec + 0.05 || snapshot.frames !== null && this.#token.baselineFrames !== null && snapshot.frames > this.#token.baselineFrames)) this.#finish("recovered");
        }
      }
      if (snapshot.paused && !snapshot.seeking && !snapshot.ended && this.#hadHealthy && !this.#token) {
        if (!this.#pauseAt) this.#pauseAt = now;
        if (now - this.#pauseAt >= 3e4) this.#hook();
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
      }
      const token = this.#token;
      if (!token) return;
      if (snapshot.mediaError || snapshot.seeking || snapshot.ended) {
        this.#finish("failed", snapshot.mediaError ? "media-error" : snapshot.seeking ? "seek-interrupted" : "ended");
        return;
      }
      if (healthy && !token.reloadingAt && (snapshot.currentTime > token.baselinePositionSec + 0.05 || snapshot.frames !== null && token.baselineFrames !== null && snapshot.frames > token.baselineFrames)) {
        this.#finish("recovered");
        return;
      }
      const dead = snapshot.readyState === 0 && snapshot.width === 0 && snapshot.height === 0 && snapshot.manifestHasVideo && snapshot.coreInitialized === false;
      if (!token.reloadingAt && dead && now - token.startedAt >= 4e3) this.#reload(token);
      if (token.reloadingAt && now - token.reloadingAt >= 15e3) {
        this.#breakerUntil = now + 9e4;
        this.#finish("failed", "reload-timeout");
      }
    }
    dispose() {
      this.#unhook();
      this.#listeners.clear();
    }
    #hook() {
      const target = this.player.player(), current = target?.play;
      if (!target || typeof current !== "function" || this.#hookedPlayer === target && this.#wrappedPlay === current) return;
      this.#unhook();
      const original = current, self = this;
      const wrapped = /* @__PURE__ */ __name(function(...args) {
        if (!self.#suppress) {
          let active = false;
          try {
            active = unsafeWindow.navigator.userActivation?.isActive === true;
          } catch {
          }
          if (active && self.#pauseAt && self.now() - self.#pauseAt >= 3e4) self.#begin("trusted-player-play", true);
        }
        return Reflect.apply(original, this, args);
      }, "wrapped");
      try {
        target.play = wrapped;
        this.#hookedPlayer = target;
        this.#originalPlay = original;
        this.#wrappedPlay = wrapped;
      } catch {
        this.#hookedPlayer = null;
      }
    }
    #unhook() {
      if (this.#hookedPlayer && this.#originalPlay && this.#wrappedPlay && this.#hookedPlayer.play === this.#wrappedPlay) {
        try {
          this.#hookedPlayer.play = this.#originalPlay;
        } catch {
        }
      }
      this.#hookedPlayer = null;
      this.#originalPlay = null;
      this.#wrappedPlay = null;
    }
    #begin(source, wasPlaying) {
      const now = this.now();
      if (this.#token || now < this.#breakerUntil || this.#reloadCount >= 2) return;
      const snapshot = this.player.snapshot();
      this.#token = {
        id: recoveryActionId(`core-${++this.#serial}`),
        source,
        startedAt: now,
        savedPositionSec: Math.max(0, this.player.currentTime() || this.#lastHealthyTime),
        savedRate: this.player.playbackRate() > 0 ? this.player.playbackRate() : this.#lastHealthyRate || 2,
        wasPlaying,
        baselinePositionSec: snapshot.currentTime,
        baselineFrames: snapshot.frames,
        reloadingAt: 0,
        restored: false
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
      if (this.now() < this.#breakerUntil || this.#reloadCount >= 2) {
        this.#finish("breaker");
        return;
      }
      token.reloadingAt = this.now();
      this.#reloadCount++;
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
      try {
        const result = this.player.reload();
        if (result && typeof result.then === "function") void Promise.resolve(result).catch(() => {
          if (this.#lifecycleSerial === lifecycle && this.#token === token) this.#finish("failed", "reload-rejected");
        });
      } catch (error) {
        this.#finish("failed", error instanceof Error && error.message === "player.reload unavailable" ? "reload-unavailable" : "reload-threw");
        return;
      }
      this.#state = Object.freeze({ state: "reloading", source: token.source, pauseSec: 0, reloadCount: this.#reloadCount, breakerSec: 0 });
    }
    #restore(token, snapshot) {
      token.restored = true;
      const position = snapshot.duration ? Math.min(token.savedPositionSec, Math.max(0, snapshot.duration - 0.1)) : token.savedPositionSec;
      try {
        this.player.seek(position);
        this.player.setRate(token.savedRate);
      } catch {
        this.#finish("failed", "restore-threw");
        return;
      }
      const lifecycle = this.#lifecycleSerial;
      let playResult;
      if (token.wasPlaying) {
        this.#suppress = true;
        try {
          playResult = this.player.play();
        } catch {
          this.#finish("recovered-paused", "play-threw");
          return;
        } finally {
          this.#suppress = false;
        }
      }
      this.#finish(token.wasPlaying ? "recovered" : "recovered-paused", "core-evidence-restored");
      if (playResult && typeof playResult.then === "function") void Promise.resolve(playResult).catch(() => {
        if (this.#lifecycleSerial !== lifecycle || this.#token) return;
        this.#state = Object.freeze({ ...this.#state, state: "recovered-paused", reason: "play-rejected" });
        this.#emit({ type: "core", at: this.now(), state: "recovered-paused", actionId: token.id, reason: "play-rejected" });
      });
    }
    #finish(state, reason = state) {
      const token = this.#token;
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
    }
    #emit(event) {
      for (const listener of this.#listeners) listener(event);
    }
  };

  // src-v2/application/player-monitor.ts
  var PlayerMonitor = class {
    constructor(player, session, settings, vault, routes, measurement, recovery, isVisible, now) {
      this.player = player;
      this.session = session;
      this.settings = settings;
      this.vault = vault;
      this.routes = routes;
      this.measurement = measurement;
      this.recovery = recovery;
      this.isVisible = isVisible;
      this.now = now;
      this.#snapshot = Object.freeze({ video: player.snapshot(), stableProgressSec: 0, watchdog: "no-video", stallTicks: 0 });
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
    static {
      __name(this, "PlayerMonitor");
    }
    #timer = null;
    #lastTime = 0;
    #stableProgressSec = 0;
    #stallTicks = 0;
    #lastRecoveryAt = 0;
    #seekGraceUntil = 0;
    #manifestTick = 0;
    #manifestReady = false;
    #snapshot;
    #listeners = /* @__PURE__ */ new Set();
    start() {
      if (this.#timer === null) {
        this.#timer = window.setInterval(() => this.tick(), 1e3);
        this.tick();
      }
    }
    stop() {
      if (this.#timer !== null) clearInterval(this.#timer);
      this.#timer = null;
      this.measurement.cancel("monitor-stop");
    }
    reset() {
      this.#lastTime = 0;
      this.#stableProgressSec = 0;
      this.#stallTicks = 0;
      this.#lastRecoveryAt = 0;
      this.#seekGraceUntil = 0;
      this.#manifestTick = 0;
      this.#manifestReady = false;
      this.measurement.reset();
      this.recovery.reset();
      this.player.reset();
    }
    snapshot() {
      return this.#snapshot;
    }
    subscribe(listener) {
      this.#listeners.add(listener);
      return () => this.#listeners.delete(listener);
    }
    tick() {
      const video = this.player.snapshot(), now = this.now(), disabled = this.settings.get().disabled;
      this.routes.observePlaybackRate(video.available ? video.playbackRate : 0);
      if (!this.#manifestReady || this.#manifestTick++ % 5 === 0) this.#manifestReady = this.player.syncManifest();
      if (video.seeking) this.#seekGraceUntil = now + (this.#demand(video).highDemand ? 8e3 : 5e3);
      const advanced = video.currentTime - this.#lastTime > 0.05;
      if (video.available && !video.paused && !video.seeking && advanced) this.#stableProgressSec++;
      else this.#stableProgressSec = 0;
      this.recovery.tick(video);
      let watchdog = "healthy";
      if (!video.available) {
        watchdog = "no-video";
        this.#stallTicks = 0;
      } else if (video.paused || video.ended) {
        watchdog = "paused";
        this.#stallTicks = 0;
      } else if (video.seeking || now < this.#seekGraceUntil) {
        watchdog = "seek-grace";
        this.#stallTicks = 0;
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
      if (!disabled && watchdog === "recovering" && now - this.#lastRecoveryAt >= 3e4) {
        const state = this.session.get(), rep = state.representation;
        if (rep) {
          this.routes.recover(rep, this.#demand(video), "watchdog", state.affinity?.host ?? null);
          this.#lastRecoveryAt = now;
        }
      }
      const demand = this.#demand(video);
      this.measurement.tick({
        generationActive: true,
        representation: this.session.get().representation,
        demand,
        stableProgressSec: this.#stableProgressSec,
        playableBufferSec: video.playableBufferSec,
        visible: this.isVisible(),
        seeking: video.seeking || now < this.#seekGraceUntil,
        recovering: this.recovery.isRecovering(),
        disabled
      });
      this.#lastTime = video.currentTime;
      this.#snapshot = Object.freeze({ video, stableProgressSec: this.#stableProgressSec, watchdog, stallTicks: this.#stallTicks });
      for (const listener of this.#listeners) listener(this.#snapshot);
    }
    #demand(video) {
      const rep = this.session.get().representation, summary = rep ? this.vault.groupSummary(rep) : null;
      const base = summary?.bandwidth ? summary.bandwidth / 1e6 : summary?.kind === "audio" ? 0.192 : 4;
      const kind = summary?.kind ?? "video", requiredMbps = Math.max(kind === "audio" ? 0.5 : 2, base * video.effectiveRate * 1.25);
      return { kind, requiredMbps, highDemand: requiredMbps >= 12 };
    }
  };

  // src-v2/application/lifecycle-controller.ts
  var LifecycleController = class {
    constructor(session, settings, vault, routes, playurl, pagePlayinfo, monitor, now) {
      this.session = session;
      this.settings = settings;
      this.vault = vault;
      this.routes = routes;
      this.playurl = playurl;
      this.pagePlayinfo = pagePlayinfo;
      this.monitor = monitor;
      this.now = now;
    }
    session;
    settings;
    vault;
    routes;
    playurl;
    pagePlayinfo;
    monitor;
    now;
    static {
      __name(this, "LifecycleController");
    }
    #listeners = /* @__PURE__ */ new Set();
    #restores = [];
    #pending = null;
    #pageKey = "";
    subscribe(listener) {
      this.#listeners.add(listener);
      return () => this.#listeners.delete(listener);
    }
    start() {
      if (this.#restores.length) return;
      this.#pageKey = this.#key();
      this.#beginGeneration("startup");
      this.pagePlayinfo.install();
      const push = history.pushState, replace = history.replaceState;
      const after = /* @__PURE__ */ __name(() => queueMicrotask(() => this.#checkNavigation()), "after");
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
      const pop = /* @__PURE__ */ __name(() => this.#checkNavigation(), "pop");
      addEventListener("popstate", pop);
      this.#restores.push(() => {
        if (history.pushState === wrappedPush) history.pushState = push;
      });
      this.#restores.push(() => {
        if (history.replaceState === wrappedReplace) history.replaceState = replace;
      });
      this.#restores.push(() => removeEventListener("popstate", pop));
      this.#restores.push(this.settings.subscribe((state) => {
        if (state.disabled !== this.session.get().disabled) this.#beginGeneration(state.disabled ? "disabled" : "enabled");
      }));
    }
    acceptPageAssignment(payload, serial) {
      this.#pending = { payload, serial, assignedAt: this.now(), pageKey: this.#pageKey, appliedGeneration: -1 };
      this.#applyPending();
      queueMicrotask(() => this.#applyPending());
    }
    dispose() {
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
      const key = this.#key();
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
      if (!pending || state.disabled || pending.appliedGeneration === Number(state.generation)) return;
      const age = this.now() - pending.assignedAt;
      if (age > 5e3 || pending.pageKey !== this.#pageKey && age > 250) return;
      if (this.playurl.transform(pending.payload, "page-hint")) pending.appliedGeneration = Number(state.generation);
    }
    #key() {
      return `${location.pathname}${location.search}`.slice(0, 512);
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
    if ("baseUrl" in item) item.baseUrl = primary;
    else item.base_url = primary;
    if ("backupUrl" in item) item.backupUrl = [...backups];
    else item.backup_url = [...backups];
  }, "rewriteItem");
  var collectDash = /* @__PURE__ */ __name((payload) => {
    const root = isRecord(payload) ? payload : null;
    const data = root && isRecord(root.data) ? root.data : root && isRecord(root.result) ? root.result : root;
    const dash = data && isRecord(data.dash) ? data.dash : data && isRecord(data.video_info) && isRecord(data.video_info.dash) ? data.video_info.dash : null;
    if (!dash) return null;
    return { video: Array.isArray(dash.video) ? dash.video.filter(isRecord) : [], audio: Array.isArray(dash.audio) ? dash.audio.filter(isRecord) : [] };
  }, "collectDash");
  var PlayurlAdapter = class {
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
      __name(this, "PlayurlAdapter");
    }
    #seenTrusted = /* @__PURE__ */ new WeakSet();
    #seenPage = /* @__PURE__ */ new WeakMap();
    #responses = /* @__PURE__ */ new Set();
    #generation = -1;
    #contentKey = "";
    lifecycleKey() {
      const s = this.session.get();
      return `${s.generation}:${s.epoch}`;
    }
    transform(payload, source = "trusted-api", responseKey) {
      if (this.session.get().disabled) return false;
      if (this.#generation !== Number(this.session.get().generation)) {
        this.#generation = Number(this.session.get().generation);
        this.#responses.clear();
        this.#contentKey = "";
        this.#seenTrusted = /* @__PURE__ */ new WeakSet();
      }
      if (responseKey && this.#responses.has(responseKey)) return true;
      const dash = collectDash(payload);
      if (!dash || !dash.video.length && !dash.audio.length) return false;
      if (payload && typeof payload === "object") {
        if (source === "trusted-api") {
          if (this.#seenTrusted.has(payload)) return true;
          this.#seenTrusted.add(payload);
        } else if (source === "page-hint") {
          const generation = Number(this.session.get().generation);
          if (this.#seenPage.get(payload) === generation) return true;
          this.#seenPage.set(payload, generation);
        }
      }
      this.#sortCodecGroups(dash.video, this.settings.get().codec);
      let contentKey = "";
      try {
        const pathname = new URL(baseUrl(dash.video[0] ?? dash.audio[0] ?? {})).pathname;
        contentKey = pathname.slice(0, pathname.lastIndexOf("/"));
      } catch {
      }
      if (source === "trusted-api" && this.#contentKey && contentKey && contentKey !== this.#contentKey) {
        this.session.beginEpoch();
        const state2 = this.session.get();
        this.vault.reset(state2.generation, state2.epoch);
        this.routes.resetEpoch();
      }
      if (source === "trusted-api" && contentKey) this.#contentKey = contentKey;
      if (responseKey) {
        this.#responses.add(responseKey);
        while (this.#responses.size > 128) this.#responses.delete(this.#responses.values().next().value);
      }
      const state = this.session.get();
      for (const [kind, items] of [["video", dash.video], ["audio", dash.audio]]) {
        items.forEach((item, index) => {
          const primary = baseUrl(item), urls = [primary, ...backupUrls(item)].filter(Boolean);
          const bandwidth = finite2(item.bandwidth);
          const rep = this.vault.register({
            generation: state.generation,
            epoch: state.epoch,
            kind,
            key: `${String(item.id ?? index)}:${codecName(item)}:${finite2(item.height)}`,
            height: finite2(item.height),
            codec: codecName(item),
            bandwidth,
            urls,
            source
          });
          if (!rep) return;
          if (source === "player-mpd") return;
          const requiredMbps = Math.max(
            kind === "audio" ? 0.5 : 2,
            (bandwidth || (kind === "audio" ? 192e3 : 4e6)) / 1e6 * this.routes.playbackRate() * 1.25
          );
          const demand = { kind, requiredMbps, highDemand: requiredMbps >= 12 };
          const decision = this.routes.plan(rep, demand, this.session.get().affinity ? "representation" : "startup");
          const applied = this.#apply(primary, decision, rep);
          if (!applied) return;
          const catalogBackups = decision.ranking.filter((row) => row.eligible && row.candidate.type === "catalog-generated").slice(0, 2).map((row) => {
            try {
              const u = new URL(primary);
              u.hostname = row.candidate.host;
              u.protocol = "https:";
              u.port = "";
              return u.href;
            } catch {
              return "";
            }
          }).filter(Boolean);
          const backups = [.../* @__PURE__ */ new Set([...catalogBackups, ...urls])].filter((url) => url !== applied).slice(0, 5);
          this.vault.registerAlias(rep, applied);
          for (const url of catalogBackups) this.vault.registerAlias(rep, url);
          rewriteItem(item, applied, backups);
        });
      }
      return true;
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
    #apply(primary, decision, representation) {
      if (decision.action === "block") return null;
      if (decision.action === "pass") return primary;
      if (decision.candidate.type === "catalog-generated") {
        return replaceUrlHost(primary, decision.host) ?? primary;
      }
      const identity = this.vault.identity(representation);
      return identity ? this.vault.resolve(decision.candidate.handle, identity) ?? primary : primary;
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
  var PlayerAdapter = class {
    constructor(playurl) {
      this.playurl = playurl;
    }
    playurl;
    static {
      __name(this, "PlayerAdapter");
    }
    #cachedVideo = null;
    #manifestFingerprint = "";
    player() {
      try {
        return isRecord2(unsafeWindow.player) ? unsafeWindow.player : null;
      } catch {
        return null;
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
      const accepted = this.playurl.transform({ code: 0, data: { dash: cloned } }, "player-mpd");
      if (accepted) this.#manifestFingerprint = fingerprint;
      return accepted;
    }
    reload() {
      const player = this.player(), reload = player?.reload;
      if (!player || typeof reload !== "function") throw new Error("player.reload unavailable");
      return Reflect.apply(reload, player, []);
    }
    currentTime() {
      return safeNumber(safeCall(this.player(), "getCurrentTime")) ?? this.snapshot().currentTime;
    }
    playbackRate() {
      const rate = safeNumber(safeCall(this.player(), "getPlaybackRate"));
      return rate !== null && rate > 0 ? rate : this.snapshot().playbackRate;
    }
    seek(value) {
      const player = this.player(), method = player?.seek;
      if (player && typeof method === "function") {
        try {
          Reflect.apply(method, player, [value]);
          return;
        } catch {
        }
      }
      const video = this.video();
      if (video) video.currentTime = value;
    }
    setRate(value) {
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
      const player = this.player();
      if (!player || typeof player.play !== "function") throw new Error("player.play unavailable");
      return Reflect.apply(player.play, player, []);
    }
    reset() {
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
    constructor(onAssignment) {
      this.onAssignment = onAssignment;
    }
    onAssignment;
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
        if (descriptor?.get) {
          try {
            return descriptor.get.call(target);
          } catch {
            return adapter.#current;
          }
        }
        return adapter.#current;
      }, "getter");
      const setter = /* @__PURE__ */ __name((next) => {
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
      this.onAssignment(payload, ++this.#serial);
    }
  };

  // src-v2/adapters/transport.ts
  var urlOf = /* @__PURE__ */ __name((input) => typeof input === "string" ? input : input instanceof URL ? input.href : input.url, "urlOf");
  var hostOf = /* @__PURE__ */ __name((value) => {
    try {
      return new URL(value, location.href).hostname.toLowerCase();
    } catch {
      return "";
    }
  }, "hostOf");
  var isMedia = /* @__PURE__ */ __name((url) => {
    const parsed = parseMediaUrl(url);
    return !!parsed && parsed.kind !== "unknown";
  }, "isMedia");
  var copyResponseSurface = /* @__PURE__ */ __name((target, source) => {
    for (const key of ["url", "redirected", "type"]) {
      try {
        Object.defineProperty(target, key, { configurable: true, enumerable: true, value: source[key] });
      } catch {
      }
    }
    return target;
  }, "copyResponseSurface");
  var TransportAdapter = class {
    constructor(session, settings, routes, playurl, now) {
      this.session = session;
      this.settings = settings;
      this.routes = routes;
      this.playurl = playurl;
      this.now = now;
    }
    session;
    settings;
    routes;
    playurl;
    now;
    static {
      __name(this, "TransportAdapter");
    }
    #installed = false;
    #xhrMeta = /* @__PURE__ */ new WeakMap();
    #restore = [];
    #requestSerial = 0;
    install() {
      if (this.#installed) return;
      this.#installed = true;
      this.#installFetch();
      this.#installXhr();
    }
    dispose() {
      for (const restore of this.#restore.splice(0).reverse()) {
        try {
          restore();
        } catch {
        }
      }
      this.#installed = false;
    }
    #installFetch() {
      const original = unsafeWindow.fetch;
      if (typeof original !== "function") return;
      const self = this;
      const wrapped = /* @__PURE__ */ __name(async function(input, init) {
        if (self.settings.get().disabled) return await Reflect.apply(original, this, [input, init]);
        const originalUrl = urlOf(input);
        if (self.settings.get().blockHttpDns && isHttpDnsUrl(originalUrl)) {
          return new Response(JSON.stringify({ code: -1, message: "HTTPDNS blocked by BiliCDN v2" }), {
            status: 503,
            headers: { "content-type": "application/json; charset=utf-8" }
          });
        }
        if (isPlayurlApi(originalUrl)) {
          const generation = self.session.get().generation, responseKey = `api-fetch-${++self.#requestSerial}`;
          const response2 = await Reflect.apply(original, this, [input, init]);
          let text3;
          try {
            text3 = await response2.text();
          } catch {
            return response2;
          }
          try {
            const payload = JSON.parse(text3);
            if (self.session.isGeneration(generation) && !self.settings.get().disabled) self.playurl.transform(payload, "trusted-api", responseKey);
            text3 = JSON.stringify(payload);
          } catch {
          }
          return copyResponseSurface(new Response(text3, { status: response2.status, statusText: response2.statusText, headers: response2.headers }), response2);
        }
        const parsed = parseMediaUrl(originalUrl);
        if (!parsed || parsed.kind === "unknown" || !["GET", ""].includes(String(init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase())) {
          return await Reflect.apply(original, this, [input, init]);
        }
        const applied = self.routes.apply(originalUrl);
        if (applied.decision.action === "block" || !applied.url) throw new TypeError(`BiliCDN blocked media request: ${applied.decision.reason}`);
        const targetInput = applied.url === originalUrl ? input : input instanceof Request ? new Request(applied.url, input) : applied.url;
        const startedAt = self.now();
        const request = self.#request(applied, originalUrl, applied.url, startedAt);
        self.routes.requestStarted(request);
        let response;
        try {
          response = await Reflect.apply(original, this, [targetInput, init]);
        } catch (error) {
          const signal = init?.signal ?? (input instanceof Request ? input.signal : null);
          const aborted = signal?.aborted === true || error instanceof DOMException && error.name === "AbortError";
          void self.#observeFetch(request, applied, originalUrl, applied.url, null, startedAt, 0, 0, aborted ? "abort" : "failure", aborted ? void 0 : "network");
          throw error;
        }
        const responseAt = self.now();
        if (!response.body) {
          const invalid = applied.decision.routeType === "native-signed" && [403, 451, 959].includes(response.status);
          void self.#observeFetch(
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
          void self.#observeFetch(request, applied, originalUrl, applied.url ?? originalUrl, response, startedAt, responseAt, bytes2, outcome, failure);
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
              const signal = init?.signal ?? (input instanceof Request ? input.signal : null);
              if (signal?.aborted) settle("abort");
              else settle("failure", "body");
              controller.error(error);
            }
          },
          async cancel(reason) {
            settle("abort");
            await reader.cancel(reason);
          }
        });
        return copyResponseSurface(new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers }), response);
      }, "wrapped");
      try {
        unsafeWindow.fetch = wrapped;
        this.#restore.push(() => {
          if (unsafeWindow.fetch === wrapped) unsafeWindow.fetch = original;
        });
      } catch {
      }
    }
    #installXhr() {
      const proto = unsafeWindow.XMLHttpRequest?.prototype;
      if (!proto) return;
      const originalOpen = proto.open, originalSend = proto.send, originalAbort = proto.abort, originalSetHeader = proto.setRequestHeader;
      const responseDescriptor = Object.getOwnPropertyDescriptor(proto, "response");
      const responseTextDescriptor = Object.getOwnPropertyDescriptor(proto, "responseText");
      const self = this;
      const open = /* @__PURE__ */ __name(function(method, url, async = true, username, password) {
        const originalUrl = String(url), playurl = isPlayurlApi(originalUrl);
        self.#xhrMeta.get(this)?.cleanup();
        let applied = null, targetUrl = originalUrl;
        if (!self.settings.get().disabled && !playurl && isMedia(originalUrl) && method.toUpperCase() === "GET") {
          applied = self.routes.apply(originalUrl);
          if (applied.url) targetUrl = applied.url;
        }
        self.#xhrMeta.set(this, {
          method: String(method).toUpperCase(),
          originalUrl,
          targetUrl,
          applied,
          startedAt: 0,
          responseAt: 0,
          bytes: 0,
          settled: false,
          playurl,
          transformedText: null,
          transformedJson: void 0,
          request: null,
          generation: self.session.get().generation,
          epoch: self.session.get().epoch,
          responseKey: `api-xhr-${++self.#requestSerial}`,
          cleanup: /* @__PURE__ */ __name(() => void 0, "cleanup"),
          async,
          headers: [],
          ...username !== void 0 ? { username } : {},
          ...password !== void 0 ? { password } : {}
        });
        if (username !== void 0) Reflect.apply(originalOpen, this, [method, targetUrl, async, username, password]);
        else Reflect.apply(originalOpen, this, [method, targetUrl, async]);
      }, "open");
      const send = /* @__PURE__ */ __name(function(body) {
        const meta = self.#xhrMeta.get(this);
        if (!meta) {
          Reflect.apply(originalSend, this, [body ?? null]);
          return;
        }
        const reopen = /* @__PURE__ */ __name((url) => {
          const responseType = this.responseType, timeout2 = this.timeout, credentials = this.withCredentials;
          Reflect.apply(originalOpen, this, [meta.method, url, meta.async, meta.username ?? null, meta.password ?? null]);
          this.responseType = responseType;
          this.timeout = timeout2;
          this.withCredentials = credentials;
          for (const [key, value] of meta.headers) Reflect.apply(originalSetHeader, this, [key, value]);
        }, "reopen");
        if (self.settings.get().disabled) {
          if (meta.targetUrl !== meta.originalUrl) reopen(meta.originalUrl);
          Reflect.apply(originalSend, this, [body ?? null]);
          return;
        }
        if (meta.applied) {
          const next = self.routes.apply(meta.originalUrl);
          if (next.url && next.url !== meta.targetUrl) {
            reopen(next.url);
            meta.targetUrl = next.url;
          }
          meta.applied = next;
        }
        if (self.settings.get().blockHttpDns && isHttpDnsUrl(meta.originalUrl)) {
          queueMicrotask(() => {
            this.dispatchEvent(new Event("error"));
            this.dispatchEvent(new Event("loadend"));
          });
          return;
        }
        if (meta.applied?.decision.action === "block" || meta.applied && !meta.applied.url) {
          queueMicrotask(() => {
            this.dispatchEvent(new Event("error"));
            this.dispatchEvent(new Event("loadend"));
          });
          return;
        }
        meta.startedAt = self.now();
        if (meta.applied) {
          meta.request = self.#request(meta.applied, meta.originalUrl, meta.targetUrl, meta.startedAt);
          self.routes.requestStarted(meta.request);
        }
        const noteHeaders = /* @__PURE__ */ __name(() => {
          if (!meta.responseAt && this.readyState >= 2) meta.responseAt = self.now();
        }, "noteHeaders");
        const progress = /* @__PURE__ */ __name((event) => {
          noteHeaders();
          meta.bytes = Math.max(meta.bytes, Number(event.loaded) || 0);
        }, "progress");
        const settle = /* @__PURE__ */ __name((outcome, failure) => {
          if (meta.settled) return;
          meta.settled = true;
          meta.cleanup();
          if (!meta.applied || !meta.request) return;
          const finalUrl = (() => {
            try {
              return this.responseURL || meta.targetUrl;
            } catch {
              return meta.targetUrl;
            }
          })();
          void self.routes.observe(self.#observation(
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
            failure
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
        Reflect.apply(originalSend, this, [body ?? null]);
      }, "send");
      const abort = /* @__PURE__ */ __name(function() {
        Reflect.apply(originalAbort, this, []);
      }, "abort");
      const setHeader = /* @__PURE__ */ __name(function(name, value) {
        Reflect.apply(originalSetHeader, this, [name, value]);
        self.#xhrMeta.get(this)?.headers.push([name, value]);
      }, "setHeader");
      try {
        proto.open = open;
        proto.send = send;
        proto.abort = abort;
        proto.setRequestHeader = setHeader;
        if (responseDescriptor?.get && responseDescriptor.configurable) {
          Object.defineProperty(proto, "response", { ...responseDescriptor, get() {
            const raw = responseDescriptor.get?.call(this), meta = self.#xhrMeta.get(this);
            if (!meta?.playurl || self.settings.get().disabled || !self.session.isGeneration(meta.generation) || this.readyState !== 4) return raw;
            if (this.responseType === "json" && raw && typeof raw === "object") {
              if (meta.transformedJson === void 0) {
                self.playurl.transform(raw, "trusted-api", meta.responseKey);
                meta.transformedJson = raw;
              }
              return meta.transformedJson;
            }
            if ((this.responseType === "" || this.responseType === "text") && typeof raw === "string") {
              if (meta.transformedText === null) {
                try {
                  const payload = JSON.parse(raw);
                  self.playurl.transform(payload, "trusted-api", meta.responseKey);
                  meta.transformedText = JSON.stringify(payload);
                } catch {
                  meta.transformedText = raw;
                }
              }
              return meta.transformedText;
            }
            return raw;
          } });
        }
        if (responseTextDescriptor?.get && responseTextDescriptor.configurable) {
          Object.defineProperty(proto, "responseText", { ...responseTextDescriptor, get() {
            const raw = String(responseTextDescriptor.get?.call(this) ?? ""), meta = self.#xhrMeta.get(this);
            if (!meta?.playurl || self.settings.get().disabled || !self.session.isGeneration(meta.generation) || this.readyState !== 4) return raw;
            if (meta.transformedText !== null) return meta.transformedText;
            try {
              const payload = JSON.parse(raw);
              self.playurl.transform(payload, "trusted-api", meta.responseKey);
              meta.transformedText = JSON.stringify(payload);
            } catch {
              meta.transformedText = raw;
            }
            return meta.transformedText;
          } });
        }
        this.#restore.push(() => {
          if (proto.open === open) proto.open = originalOpen;
          if (proto.send === send) proto.send = originalSend;
          if (proto.abort === abort) proto.abort = originalAbort;
          if (proto.setRequestHeader === setHeader) proto.setRequestHeader = originalSetHeader;
          if (responseDescriptor) Object.defineProperty(proto, "response", responseDescriptor);
          if (responseTextDescriptor) Object.defineProperty(proto, "responseText", responseTextDescriptor);
        });
      } catch {
      }
    }
    #request(applied, originalUrl, targetUrl, startedAt) {
      const state = this.session.get(), matched = applied.attributionStatus ?? (applied.context ? "matched" : "waiting-data");
      return Object.freeze({
        requestId: requestId(`request-${++this.#requestSerial}`),
        generation: state.generation,
        epoch: state.epoch,
        decisionId: applied.decision.id,
        representation: applied.context?.representation ?? null,
        kind: applied.context?.kind ?? null,
        attributionStatus: matched,
        attributionSource: applied.attributionSource ?? (applied.context ? "exact" : "none"),
        decisionStage: "request",
        routeType: applied.decision.routeType,
        originalHost: hostOf(originalUrl),
        targetHost: hostOf(targetUrl),
        sourceHost: applied.sourceHost,
        playurlHostChanged: !!applied.sourceHost && applied.sourceHost !== hostOf(originalUrl),
        urlChanged: originalUrl !== targetUrl,
        hostChanged: hostOf(originalUrl) !== hostOf(targetUrl),
        startedAt
      });
    }
    async #observeFetch(request, applied, originalUrl, targetUrl, response, startedAt, responseAt, bytes2, outcome, failureKind) {
      const finalUrl = response?.url || targetUrl;
      await this.routes.observe(this.#observation(
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
        failureKind
      ));
    }
    #observation(request, applied, originalUrl, targetUrl, finalUrl, status, bytes2, startedAt, responseAt, outcome, failureKind) {
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
        finalHost: hostOf(finalUrl) || null,
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

  // src-v2/adapters/visibility.ts
  var VisibilityAdapter = class {
    static {
      __name(this, "VisibilityAdapter");
    }
    #restores = [];
    #nativeHidden = null;
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
        if (this.#nativeHidden?.()) event.stopImmediatePropagation();
      }, "guard");
      document.addEventListener("visibilitychange", guard, true);
      document.addEventListener("webkitvisibilitychange", guard, true);
      const blurGuard = /* @__PURE__ */ __name((event) => event.stopImmediatePropagation(), "blurGuard");
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
    #serial = 0;
    #aliases = /* @__PURE__ */ new Map();
    #counters = { evicted: 0, incidentReplaced: 0, rankingEvicted: 0, flowEvicted: 0, incidentEvicted: 0, pendingEvicted: 0 };
    tick() {
      if (this.#incident?.state === "capturing" && this.now() >= this.#incident.captureUntil) this.#incident.state = "frozen";
      const floor = this.now() - 6e4;
      this.#events = this.#events.filter((event) => event.at >= floor);
      for (const [key, row] of this.#flow) if (row.lastAt < floor) this.#flow.delete(key);
      for (const [key, row] of this.#pending) if (this.now() - row.startedAt > 12e4) {
        this.#pending.delete(key);
        this.#counters.pendingEvicted++;
      }
    }
    record(event) {
      this.tick();
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
        if (o.outcome !== "failure") {
          this.#aggregate(o);
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
      this.#start(text2(reason), this.now());
      this.#bound();
    }
    clear() {
      this.#incident = null;
    }
    snapshot() {
      return Object.freeze({
        coverage: { from: this.#events[0]?.at ?? this.now(), to: this.#events.at(-1)?.at ?? this.now() },
        incident: this.#incident ? structuredClone(this.#incident) : null,
        flow: this.#flows(),
        lastSuccess: Object.fromEntries(this.#lastSuccess),
        pending: [...this.#pending.values()].map((row) => this.#sanitize(row)),
        events: structuredClone(this.#events),
        rankings: structuredClone(this.#rankings),
        counters: { ...this.#counters }
      });
    }
    buildReport(readModel) {
      const recorder = this.snapshot();
      const payload = {
        title: "BiliCDN_TW v2 診斷報告",
        generatedAt: new Date(this.now()).toISOString(),
        evidence: this.#incident ? this.#incident.state + "-incident" : this.#lastSuccess.size ? "media-observation-only" : "playback-observation-unattributed",
        current: this.#sanitize(readModel),
        recorder,
        export: { truncated: false, rankingDropped: 0, contextDropped: 0, flowDropped: 0 }
      };
      let output = JSON.stringify(payload, null, 2);
      if (new TextEncoder().encode(output).byteLength <= 96 * 1024) return output;
      payload.export.truncated = true;
      payload.export.rankingDropped = this.#rankings.length;
      recorder.rankings = [];
      const m = readModel, r = m.routes;
      payload.current = this.#sanitize({
        version: m.version,
        session: m.session,
        monitor: m.monitor,
        recovery: m.recovery,
        measurement: m.measurement,
        routes: { planCount: r?.planCount, activePlan: r?.activePlan, affinity: r?.affinity, latest: r?.latest, representation: r?.representation, attribution: r?.attribution },
        evidence: m.evidence,
        truncated: true
      });
      output = JSON.stringify(payload);
      const events = recorder.events, flows = recorder.flow;
      while (new TextEncoder().encode(output).byteLength > 96 * 1024 && (events.length > 1 || flows.length > 1)) {
        if (events.length > 1) {
          const i = events.findIndex((row) => !row.important);
          events.splice(i >= 0 ? i : 0, 1);
          payload.export.contextDropped++;
        } else {
          flows.shift();
          payload.export.flowDropped++;
        }
        output = JSON.stringify(payload);
      }
      return output;
    }
    #aggregate(o) {
      const key = [Math.floor(o.completedAt / 5e3), o.kind ?? "unknown", o.routeType, this.#host(o.targetHost), this.#host(o.finalHost)].join(":");
      const row = this.#flow.get(key) ?? { requests: 0, successes: 0, aborts: 0, bytes: 0, lastAt: 0, maxElapsedMs: 0, maxTtfbMs: 0 };
      row.requests++;
      row.bytes += o.bytes;
      row.lastAt = o.completedAt;
      row.maxElapsedMs = Math.max(row.maxElapsedMs, o.elapsedMs);
      row.maxTtfbMs = Math.max(row.maxTtfbMs, o.ttfbMs ?? 0);
      if (o.outcome === "success") row.successes++;
      else row.aborts++;
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
    #transport(o) {
      return {
        ...o.request ? this.#sanitize(o.request) : {},
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
      return { decisionStage: "plan", id: d.id, action: d.action, reason: d.reason, routeType: d.routeType, host: this.#host(d.host) };
    }
    #event(event) {
      let data = {}, important = false;
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
          data = this.#sanitize(event.request);
          break;
        case "attribution-changed":
          data = { requestId: event.requestId, status: event.status, kind: event.kind };
          break;
        case "recovery":
          data = {
            action: event.action.action,
            actionId: event.action.id,
            ...event.action.action === "route-fallback" ? { kind: event.action.kind, decision: this.#decision(event.action.decision) } : event.action.action === "player-reload" ? { savedPositionSec: event.action.savedPositionSec, savedRate: event.action.savedRate } : { reason: event.action.reason }
          };
          important = true;
          break;
        case "core":
          data = { ...event };
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
        flow: this.#flows()
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
        } else if (this.#flow.size > 1) {
          this.#flow.delete(this.#flow.keys().next().value);
          this.#counters.flowEvicted++;
        } else if (this.#events.length > 1) {
          this.#events.shift();
          this.#counters.evicted++;
        } else if (this.#pending.size) {
          this.#pending.delete(this.#pending.keys().next().value);
          this.#counters.pendingEvicted++;
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
    show(opener) {
      this.#opener = opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      this.#ensure();
      this.#renderOverview();
    }
    close() {
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
      queueMicrotask(() => close.focus());
      return { body, foot };
    }
    #renderOverview() {
      const { body, foot } = this.#shell("BiliCDN v2 控制中心");
      const state = this.deps.session.get(), settings = this.deps.settings.get(), monitor = this.deps.monitor.snapshot();
      const affinity = state.affinity ? `${state.affinity.type} / ${state.affinity.host}` : "尚未觀察";
      const summary = document.createElement("p");
      summary.className = "summary";
      summary.textContent = `狀態：${settings.disabled ? "停用" : "啟用"}｜模式：${settings.fixedHost ? `固定 ${settings.fixedHost}` : "自動"}
路線：${affinity}
播放：${monitor.watchdog}｜可播放 ${monitor.video.playableBufferSec.toFixed(1)} 秒｜${monitor.video.effectiveRate}x
核心：${this.deps.recovery.snapshot().state}｜單一挑戰者：${this.deps.measurement.snapshot().state}`;
      const routes = this.deps.routes.snapshot(), latest = routes.latest;
      for (const [kind, label] of [["video", "影片"], ["audio", "音訊"], ["unknown", "尚未分類媒體"]]) {
        const row = latest[kind];
        if (!row) {
          if (kind !== "unknown") summary.textContent += `
${label}：尚無已歸因請求`;
          continue;
        }
        const age = Math.max(0, Math.floor((this.deps.now() - Number(row.observedAt)) / 1e3));
        summary.textContent += `
${label}：送出 ${row.targetHost ?? "未知"} → 回應 ${row.responseHost ?? "尚未收到"}｜${age} 秒前
  請求攔截換 host：${row.hostChanged === true ? "是" : row.hostChanged === false ? "否" : "未知"}｜playurl 已改 host：${row.playurlHostChanged === true ? "是" : "否"}｜歸因：${row.attributionStatus ?? "等待資料"}`;
      }
      const rep = routes.representation;
      summary.textContent += `
畫質歸因：${rep ? `${rep.height}p / ${rep.codec}` : String(routes.attribution)}
量測狀態：${this.deps.measurement.snapshot().reason}`;
      body.append(summary);
      const actions = document.createElement("div");
      actions.className = "grid";
      actions.append(
        this.#button(settings.disabled ? "啟用腳本" : "停用腳本", async () => {
          await this.deps.settings.update({ disabled: !settings.disabled });
          this.#renderOverview();
        }, "primary"),
        this.#button("CDN 與播放設定", () => this.#renderSettings()),
        this.#button("診斷與事故記錄", () => this.#renderDiagnostics()),
        this.#button("重新評估一個安全候選", () => {
          this.deps.measurement.requestManual();
          this.#renderOverview();
        }),
        this.#button("將目前影片路線加入黑名單 24 小時", async () => {
          const host = this.deps.routes.latestVideoHost();
          if (host) await this.deps.restrictions.add({ host, type: "black", kind: "video", reason: "user", expireAt: this.deps.now() + 24 * 60 * 60 * 1e3 });
          this.deps.routes.invalidateForUserSetting();
          this.#renderOverview();
        }, "danger"),
        this.#button("清除 v2 學習資料", async () => {
          await this.deps.evidence.clear();
          await this.deps.restrictions.clear();
          this.deps.storageDelete("bilicdn.v2.meta");
          this.#renderOverview();
        }, "danger"),
        this.#button("恢復 v2 預設設定", async () => {
          await this.deps.settings.reset();
          this.deps.routes.invalidateForUserSetting();
          this.#renderOverview();
        }, "danger")
      );
      const blacklistButton = [...actions.querySelectorAll("button")].find((button) => button.textContent?.startsWith("將目前影片路線"));
      if (blacklistButton && !this.deps.routes.latestVideoHost()) {
        blacklistButton.disabled = true;
        blacklistButton.textContent = "尚無成功歸因的影片回應，無法指定黑名單節點";
      }
      body.append(actions);
      foot.append(this.#button("關閉", () => this.close()));
    }
    #renderSettings() {
      const { body, foot } = this.#shell("CDN 與播放設定");
      const settings = this.deps.settings.get(), rows = document.createElement("div");
      rows.className = "grid";
      const mode = document.createElement("select");
      mode.append(new Option("自動選路", ""), ...TRUSTED_CATALOG.map((host) => new Option(`固定：${host}`, host)));
      mode.value = settings.fixedHost ?? "";
      mode.addEventListener("change", (event) => {
        if (!event.isTrusted) return;
        void this.deps.settings.update({ fixedHost: mode.value || null }).then(() => {
          this.deps.routes.invalidateForUserSetting();
          this.#renderSettings();
        });
      });
      rows.append(this.#row("選路模式", mode));
      const codec = document.createElement("select");
      for (const value of ["av1", "hevc", "avc", "auto"]) codec.append(new Option(value.toUpperCase(), value));
      codec.value = settings.codec;
      codec.addEventListener("change", (event) => {
        if (event.isTrusted) void this.deps.settings.update({ codec: codec.value });
      });
      rows.append(this.#row("Codec 偏好（下一份 playurl 生效）", codec));
      rows.append(this.#toggle("阻擋 WebRTC", settings.blockWebRtc, (value) => this.deps.settings.update({ blockWebRtc: value })));
      rows.append(this.#toggle("阻擋 HTTPDNS", settings.blockHttpDns, (value) => this.deps.settings.update({ blockHttpDns: value })));
      rows.append(this.#toggle("Verbose 診斷", settings.verbose, (value) => this.deps.settings.update({ verbose: value })));
      for (const host of TRUSTED_CATALOG) {
        const defaultEnabled = !DEFAULT_UNAVAILABLE_HOSTS.has(host);
        const enabled = settings.catalogOverrides[host] ?? defaultEnabled;
        rows.append(this.#toggle(host, enabled, async (value) => {
          await this.deps.settings.update({ catalogOverrides: { ...this.deps.settings.get().catalogOverrides, [host]: value } });
          this.deps.routes.invalidateForUserSetting();
        }, defaultEnabled ? "內建 Catalog" : "預設不可用；勾選後才允許"));
      }
      body.append(rows);
      foot.append(this.#button("返回", () => this.#renderOverview()));
    }
    #renderDiagnostics() {
      const { body, foot } = this.#shell("診斷與事故記錄");
      const report = document.createElement("textarea");
      report.className = "report";
      report.readOnly = true;
      report.value = this.deps.diagnostics.buildReport(this.#readModel());
      body.append(report);
      foot.append(
        this.#button("標記剛剛卡頓", () => {
          this.deps.diagnostics.mark();
          this.#renderDiagnostics();
        }),
        this.#button("清除事故", () => {
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
        version: GM_info?.script?.version ?? "2.0.1",
        settings: this.deps.settings.get(),
        session: this.deps.session.get(),
        monitor: this.deps.monitor.snapshot(),
        recovery: this.deps.recovery.snapshot(),
        measurement: this.deps.measurement.snapshot(),
        routes: this.deps.routes.snapshot(),
        restrictions: this.deps.restrictions.list(),
        evidence
      });
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
      status.textContent = `${this.settings.get().disabled ? "已停用" : "BiliCDN v2"}｜${state.affinity?.host ?? "等待媒體"}｜${video.effectiveRate}x｜緩衝 ${video.playableBufferSec.toFixed(1)} 秒`;
    }
    #area(anchor) {
      const root = anchor.closest('[id*="bilibili-player"],[class*="bpx-player"]');
      const video = root?.querySelector("video");
      return video ? video.clientWidth * video.clientHeight : 0;
    }
  };

  // src-v2/entry.ts
  var start = /* @__PURE__ */ __name(() => {
    const now = /* @__PURE__ */ __name(() => Date.now(), "now");
    const clock = { now };
    const storage = new TampermonkeyStorage();
    const settings = new SettingsStore(storage, now);
    const restrictions = new RestrictionStore(storage, now);
    const evidence = new EvidenceStore(storage, now);
    const session = new SessionStore();
    const vault = new SignedRouteVault();
    const routes = new RouteCoordinator(clock, session, settings, restrictions, evidence, vault);
    const playurl = new PlayurlAdapter(session, vault, routes, settings);
    const player = new PlayerAdapter(playurl);
    const recovery = new RecoveryController(player, now);
    const nativeFetch = unsafeWindow.fetch.bind(unsafeWindow);
    const measurement = new MeasurementController(routes, storage, nativeFetch, now);
    const visibility = new VisibilityAdapter();
    const monitor = new PlayerMonitor(
      player,
      session,
      settings,
      vault,
      routes,
      measurement,
      recovery,
      () => visibility.isActuallyVisible(),
      now
    );
    let lifecycle = null;
    const pagePlayinfo = new PagePlayinfoAdapter((payload, serial) => lifecycle?.acceptPageAssignment(payload, serial));
    lifecycle = new LifecycleController(session, settings, vault, routes, playurl, pagePlayinfo, monitor, now);
    const transport = new TransportAdapter(session, settings, routes, playurl, now);
    const webRtc = new WebRtcAdapter(settings);
    const diagnostics = new DiagnosticRecorder(now, () => settings.get().verbose);
    const center = new ControlCenter({
      settings,
      restrictions,
      evidence,
      session,
      routes,
      measurement,
      monitor,
      recovery,
      diagnostics,
      storageDelete: /* @__PURE__ */ __name((key) => storage.delete(key), "storageDelete"),
      now
    });
    const panel = new PlayerPanel(center, settings, session, monitor);
    const eventSink = /* @__PURE__ */ __name((event) => {
      diagnostics.record(event);
      if (event.type === "recovery" && event.action.action === "route-fallback") recovery.armRouteFailure("route-failure", player.snapshot());
    }, "eventSink");
    routes.subscribe(eventSink);
    recovery.subscribe(eventSink);
    lifecycle.subscribe(eventSink);
    monitor.subscribe(() => diagnostics.tick());
    visibility.setEnabled(!settings.get().disabled);
    transport.install();
    webRtc.install();
    lifecycle.start();
    panel.start();
    let routeSettings = JSON.stringify([settings.get().fixedHost, settings.get().catalogOverrides]);
    settings.subscribe((state) => {
      visibility.setEnabled(!state.disabled);
      const next = JSON.stringify([state.fixedHost, state.catalogOverrides]);
      if (next !== routeSettings) {
        routeSettings = next;
        routes.invalidateForUserSetting();
      }
    });
    try {
      GM_registerMenuCommand("⚙️ 開啟 BiliCDN v2 控制中心", () => center.show());
    } catch {
    }
  }, "start");
  start();
})();
