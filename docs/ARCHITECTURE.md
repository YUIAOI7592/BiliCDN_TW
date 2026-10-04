# v2 architecture

This document describes the **v2.1.8 release candidate** in [src-v2](../src-v2/entry.ts), including the MP4/FLV correction. [release.json](../release.json) is set to 2.1.8; security review and publication confirmation are pending, and v2.1.7 remains the latest published bundle. This is a maintained design reference, not a record of browser acceptance. See the [documentation index](INDEX.md), [development workflow](DEVELOPMENT.md) and [security policy](../SECURITY.md) for their respective scopes.

## Dependency direction

The allowed imports in [architecture-rules.mjs](../scripts/architecture-rules.mjs) are:

| Importing layer | Allowed target layers |
| --- | --- |
| `domain` | `domain` |
| `platform` | `platform` |
| `state` | `state`, `domain`, `platform` |
| `application` | `application`, `state`, `domain`, `platform` |
| `adapters` | `adapters`, `application`, `state`, `domain`, `platform` |
| `diagnostics` | `diagnostics`, `domain` |
| `ui` | `ui`, `diagnostics`, `application`, `state`, `domain`, `platform` |
| `entry.ts` | All composed layers |

This is an allowed-import table, not a requirement to import every listed layer. In the current code, state stores import the `StoragePort` type from `platform/storage.ts`; that module also implements Tampermonkey storage. UI modules import application/state types and domain helpers, consume snapshots, and send product mutations through `ControlCommandPort`. UI does not import browser adapters. Diagnostics imports domain models. [entry.ts](../src-v2/entry.ts) constructs and wires these objects and starts the runtime.

The AST check covers runtime `.ts` files under `src-v2/`, excluding declarations. It checks value/type imports, re-exports, import types and import-equals declarations, rejects non-relative imports and dynamic `import()`, and detects dependency cycles. Its additional syntax rules reject named browser/GM globals and direct clock/random calls in domain/application, dotted `setAffinity()` calls outside the coordinator, application-layer dotted `reload()` calls outside recovery, and a listed set of UI mutations outside the command receiver. These are syntax and dependency checks, not a complete proof of runtime effects or ownership.

The separate import-purity test bundles all non-entry, non-declaration modules together without tree shaking, then imports that bundle in a Node subprocess with a fixed list of browser, network, GM and timer globals plus `Date.now`/`Math.random` trapped. It checks import-time behavior; constructors and methods still need their contract tests.

## Domain

`domain/` contains pure models and algorithms:

- branded lifecycle and action IDs;
- URL admission and host-replacement rules;
- Catalog definitions;
- bounded evidence windows, safe throughput and circuits;
- candidate eligibility and deterministic ranking;
- Catalog restriction snapshots and player output plans expressed as trusted hosts or opaque indexes.
- a readonly playurl result model with explicit acceptance, recognized formats, counts, numeric upstream code and a fixed rejection-reason union.

The domain accepts time and relative-URL base addresses as arguments and performs no I/O. Output-policy functions return decisions over hosts or opaque indexes; they do not submit affinity or start probes. URL-policy helpers can inspect URL strings without retaining them.

## State

- `SessionStore` stores immutable generation, epoch, representation and affinity snapshots. The coordinator calls `setAffinity`; starting a generation or epoch also clears affinity as part of the session reset.
- `RestrictionStore` owns expiring black/dead records by host and media kind. Catalog user overrides live in `SettingsStore`, defaults in the domain Catalog, and current-stream host locks in the coordinator/vault.
- `EvidenceStore` owns bounded video/audio host evidence.
- `SignedRouteVault` owns full current-epoch Native URLs behind opaque handles.
- The first trusted playurl API representation replaces lower-trust page-hint/player-MPD routes for the same group. The vault revokes provisional handles and changes the authority identity; the coordinator discards plans and related permissions when their saved identity no longer matches. Later hints cannot restore selectable Native routes for that trusted group.
- Exact signed URLs with an unrecognized path may be indexed for observation and host restriction only; they do not become selectable Native routes or active-probe capabilities.
- The vault also keeps a bounded, current-epoch mapping from playurl output URL to original/output hostname, primary/backup role, source and decision ID. It owns selection authority and signed-route indexes and exposes candidates through handles and metadata. Full URL strings still pass through ingestion, output materialization and browser dispatch/probe ports. `PlayerAdapter` also retains a serialized manifest fingerprint until replacement/reset, and XHR keeps per-request URL state in memory; neither is a separate Native authorization index. These URLs are not persisted or included in diagnostic request models.
- `SettingsStore` owns the typed v2 product settings, including the persisted, default-off option to consider Bilibili-provided Native sources in normal routing.
- `MeasurementMetaStore` owns the existing cursor/cooldown storage access and exposes the `measurement` lock to its caller.

| Store | Persistent key | Read/update behavior |
| --- | --- | --- |
| `SettingsStore` | `bilicdn.v2.settings` | Parses schema-2 settings, listens for remote changes, and locks updates/reset. Native-source consideration defaults off. |
| `RestrictionStore` | `bilicdn.v2.restrictions` | Parses bounded expiring records, listens for remote changes, and locks mutations. |
| `EvidenceStore` | `bilicdn.v2.routeEvidence` | Parses bounded video/audio evidence, listens for remote changes, and locks record/clear operations. |
| `MeasurementMetaStore` | `bilicdn.v2.meta` | Reads storage on each `get()`; has no value-change listener or cached state. |

[Measurement metadata](../src-v2/state/measurement-meta-store.ts) retains its existing compatibility semantics: it accepts an object, coerces the cursor/timestamp to numbers with zero fallbacks, and clamps the cursor to at least zero. It does not enforce finite-number bounds or validate the stored schema. `update()` merges existing fields, writes schema 2 and `updatedAt`, and does not itself acquire a lock; `clear()` also deletes directly. `MeasurementController` uses `withLock()` around its cursor/cooldown updates and checks its lifecycle marker inside the callback.

[TampermonkeyStorage](../src-v2/platform/storage.ts) uses `navigator.locks` with a `bilicdn.v2.` name prefix when available; otherwise it runs the callback directly. Cross-tab serialization therefore depends on Web Locks availability. Signed routes and session state are memory-only.

## Application controllers

- `RouteCoordinator` produces route decisions, applies affinity, plans group-aware fallback, and validates probe/transport results before committing evidence or route invalidation.
- `MeasurementController` alone initiates active probes. It owns one bounded, player-request-triggered startup preflight with at most three parallel candidates and one shared three-second deadline, followed by later sequential safe rounds of up to three challengers. MP4/FLV segments share that startup window. The coordinator validates startup choices before committing; healthy exploration records evidence without changing affinity.
- Active startup and healthy probes reject redirects and count only direct 206 Range responses from the admitted host.
- `RecoveryController` owns player-core reload and resume state. `RouteCoordinator` owns route fallback; `PlayerMonitor` detects watchdog/cold-start conditions, and `RuntimeController` forwards route-fallback events to core recovery.
- `LifecycleController` begins generations at startup, SPA navigation-key changes and enable/disable changes. Page assignments are bounded pending inputs, not automatic generation changes.
- `PlayerMonitor` samples the player on a one-second cadence, drives recovery ticks and feeds typed observations.
- `PlayurlController` registers normalized representations, manages content epochs and requests output plans. The playurl adapter owns payload parsing, field compatibility and writeback.
- `RuntimeController` coordinates settings invalidation, probe/recovery reset, monitor lifecycle and fallback events. `ControlCommands` provides the UI's typed mutation interface and orders comparison, blacklist, reset and data-clear actions.

Controllers receive typed ports, often narrowed with `Pick`. `NavigationPort`, `SchedulerPort` and `PlayerPort.observePlayIntent` keep History wrappers, timer APIs and activation checks outside application policy. `PlayerPort` exposes no raw player/core object. Lifecycle-sensitive probe/transport commits check the active generation, epoch, route identity or controller marker as appropriate; evidence writes recheck their validity predicate after acquiring the storage lock. Recovery promises use a lifecycle serial/token, and disposed lifecycle observers ignore queued page assignments. These guards concern lifecycle work; ordinary user settings writes are not generation-scoped.

`PlayurlController` begins a new content epoch when a trusted API input changes its content key. This is separate from the lifecycle generation reset.

## Progressive playurl processing (v2.1.8 release candidate)

[PlayurlAdapter](../src-v2/adapters/playurl.ts) traverses the recognized root/`data`/`result`/`video_info` containers to a bounded depth and collects DASH plus MP4/FLV `durl` entries. Segment identity includes the branch, format, quality and array index; missing or repeated `order` fields do not collapse different segments. Original segment order and metadata remain in the payload. DASH codec ordering continues independently. The parser rejects malformed payloads, nonzero top-level codes, unsupported formats and oversized video/audio entry counts.

The controller registers each segment separately, retaining current generation/epoch and trusted-source promotion rules. Progressive Catalog materialization resolves the first safe opaque source handle from `SignedRouteVault` for that segment rather than assuming its first supplied URL can be rewritten. Its exact source path/query stays attached to the segment. The vault may retain a safely rewritable PCDN source for this purpose only when replacement produces a normal built-in Catalog target; that source does not gain Native selectability. This capability must not become a second URL index. DASH retains its prior behavior of preserving a safe incoming exact/Catalog-alias URL for the same representation, including its current query.

All recognized progressive or mixed response outputs are planned before URL writeback. A required progressive segment without a legal primary rejects the response without partially replacing its URL fields or dropping the failed segment. This is atomic payload writeback, not rollback of vault/controller registration. Existing DASH-only cleared-field handling remains separate. [PlayurlTransformResult](../src-v2/domain/playurl-model.ts) expresses the outcome; every consumer tests `accepted`, rather than treating the result object itself as truthy.

In Catalog-only mode, a rejected Fetch playurl becomes a safe HTTP 503 response. XHR text/json getters expose safe failure content while preserving native HTTP status; unsupported strict XHR response types are rejected before send. The Native-enabled and original-comparison policies remain distinct from whole-script disabled pass-through. Fetch/XHR still recheck settings and lifecycle validity after waits.

## Adapters

Adapters translate browser behavior into typed observations:

- independent `FetchHookAdapter` and `XhrHookAdapter`, with shared typed dispatch checks and observation construction in `TransportContext`;
- `TransportAdapter` installs/verifies both hooks, restores partial installations and reports the combined hook snapshot;
- `RangeProbeAdapter` provides one direct same-host HTTPS 206 reader implementation for startup and health probes; it caps counted bytes, propagates cancellation and releases readers. The measurement controller owns deadlines and result interpretation; the coordinator owns authority checks and evidence commits. Failed healthy challenges do not open playback circuits;
- playurl parsing and transformation writeback;
- `__playinfo__` and player manifest ingestion;
- video/player resolution;
- `BrowserNavigation`, which restores History methods only while its wrappers still own them and ignores queued callbacks after unsubscribe;
- `BrowserScheduler`, which returns cancellation functions for timeouts/intervals and queues non-cancellable microtasks;
- visibility/background behavior;
- reversible WebRTC blocking.

Tampermonkey storage and value-change listeners are implemented in `platform/storage.ts`. Adapters do not own route policy or impose penalties. Application timer ownership is split between measurement deadlines, the player monitor's interval and lifecycle microtasks; recovery advances on monitor ticks. UI remains browser-facing: `PlayerPanel` owns a separate 1.5-second interval and `ControlCenter` queues focus work directly.

## Route lifecycle

1. A trusted playurl response or bounded page/player hint establishes representation groups.
2. The vault stores exact Native URLs for the active generation/epoch.
3. The coordinator admits current candidates, applies restrictions and ranks them. With the Native-source option off, normal routing admits only generated built-in Catalog routes; original and Native signed URLs remain in the vault for attribution and the separate comparison mode.
4. The first eligible Fetch/async XHR media request can wait up to three seconds for parallel legal-route preflight. All requests in that window share one deadline. With the option off, preflight probes only Catalog routes; a recognizable Bilibili media URL that cannot safely become a legal Catalog route is blocked before dispatch.
5. The transport adapter asks for a decision at dispatch and records its immutable request context.
   Fetch policy inputs and native dispatch use the same platform-normalized Request; an added page-owned `href` property cannot select a different checked URL.
   Hook installation is attempted and its verified status recorded before monitor/UI startup; an installation failure does not prevent the UI from starting. Transport checks recognized non-GET media without rewriting it and rechecks XHR at `send()`. With the option off, a recognized media request that cannot be sent to an allowed Catalog route is blocked before the native call, including non-GET and stale-generation requests.
6. Completion yields a typed observation and evidence update. Verified failure may open a media-kind circuit and request group-aware fallback.
7. A no-progress cold start can submit one legal different-host fallback and arm the existing one-shot core recovery. With the option off, that fallback must also be a Catalog route.
8. The observed post-decision host, not the plan alone, confirms the route outcome.

Catalog HTTP 403 invalidates only the current stream/host pairing for later ranking, backups and active challengers. Recovery records a bounded per-kind action from plan to hook entry to response or failure; a same-host request from an unrelated decision cannot confirm that action.

The persisted Native-source option restores normal routing's prior ability to consider legal original and exact Native signed routes when enabled. With it off, playurl output contains only safely generated Catalog primary and backup URLs; if none is legal, the output has no usable route. It does not cancel a website request already dispatched. Disabling the entire script still leaves website requests unchanged.

The optional original comparison mode lives only in the current tab's coordinator and is independent of the persisted Native-source option. It uses only exact legal signed URLs supplied by the video, can promote a legal original backup if the primary is forbidden, and suppresses active probes and automated recovery. Toggling it clears plans/affinity and resets measurement/core recovery. It does not survive a full reload or retroactively restore URLs already given to the player.

Healthy measurements never change affinity.

The Catalog retains all 11 built-in hosts, with four unavailable by default. The three-probe startup limit does not narrow ordinary ranking, backup planning or later healthy exploration to those three hosts. Catalog-only output chooses a legal primary and at most five legal backup hosts distinct from the primary and one another. Current black/dead flags, user overrides, default availability, host locks and stream/host incompatibility still apply.

If Catalog-only startup produces no valid probe result, measurement commits no probe winner. Final dispatch performs ordinary ranking over the complete remaining legal Catalog pool; probe 403 results still exclude their current stream/host pairs. This preserves the deadline without granting a failed probe route special priority.

Whole-script disable takes precedence, then tab-local original comparison; normal routing applies fixed/automatic selection and the Native-source switch. Fixed-host, Catalog-override and Native-source changes invalidate plans and reset measurement/recovery. A pending startup result must not override a newly selected fixed host; final dispatch uses current settings and authority.

## Diagnostics

The recorder consumes typed `DomainEvent` values, aggregates successful traffic and preserves bounded failure incidents. UI read models are snapshots; reading them cannot mutate routing or start network work. Hook entry, media recognition, native-call and response stages remain separate from browser Network confirmation. The Catalog-only rule applies to script-transformed playurl output and intercepted media dispatch, not to browser traffic outside those entry points.

`RouteSnapshot`, `TransportSnapshot`, `DiagnosticSnapshot` and `ControlCenterSnapshot` expose concrete readonly fields. Diagnostic request serialization uses an explicit bounded field list, and report export sanitizes the supplied read model. External payload validation belongs to the relevant adapter/store parser, with the metadata compatibility behavior described above. Product-setting/routing commands use `ControlCommandPort`; UI also invokes diagnostic-only mark, clear and report operations directly. UI does not read or write storage keys directly.

The v2.1.8 candidate's `TransportSnapshot.lastPlayurl` adds one immutable recent result: Fetch/XHR, observation time, native HTTP status, acceptance, recognized DASH/MP4/FLV formats, video/audio/segment counts, numeric upstream code and rejection reason. `TransportContext` copies a fixed field list, deduplicates at most three formats, bounds counts to 0–65,535 and drops non-finite or unsafe-integer upstream codes. Raw payloads, URLs, paths, tokens and exception messages are not copied. Control-center text and the existing diagnostic export consume this summary; acceptance does not establish actual network destination or successful playback.
