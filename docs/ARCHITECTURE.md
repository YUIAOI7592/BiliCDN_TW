# v2 architecture

## Dependency direction

```text
domain <- state <- application <- adapters
                         ^          |
                         |          v
                    diagnostics <- ui
                              \    /
                               entry
```

The architecture check parses the locked TypeScript compiler's AST, checks value/type imports, re-exports and import types, rejects dynamic loading and cycles, and enforces the allowed layer direction. It also rejects browser/GM/clock globals in domain and application modules, affinity/reload calls outside their owners, and direct UI storage/controller mutations. `entry.ts` is the composition root. Independent import-purity tests load every non-entry module with browser, network, storage and timer access trapped.

## Domain

`domain/` contains pure models and algorithms:

- branded lifecycle and action IDs;
- URL admission and host-replacement rules;
- Catalog definitions;
- bounded evidence windows, safe throughput and circuits;
- candidate eligibility and deterministic ranking;
- Catalog restriction snapshots and player output plans expressed as trusted hosts or opaque indexes.

The domain accepts time and relative-URL base addresses as arguments and performs no I/O. Output policies cannot submit affinity, start probes, or retain signed URLs.

## State

- `SessionState` owns generation, epoch, representation and route affinity.
- `RestrictionStore` owns black/dead/user/default restrictions.
- `EvidenceStore` owns bounded video/audio host evidence.
- `SignedRouteVault` owns full current-epoch Native URLs behind opaque handles.
- The first trusted playurl API representation replaces lower-trust page-hint/player-MPD routes for the same group, revokes their handles and route plans, and prevents later hints from restoring selectable Native routes.
- Exact signed URLs with an unrecognized path may be indexed for observation and host restriction only; they do not become selectable Native routes or active-probe capabilities.
- The vault also keeps a bounded, current-epoch mapping from playurl output URL to original/output hostname, primary/backup role, source and decision ID. Full URLs remain private to the vault.
- `SettingsStore` owns the typed v2 product settings, including the persisted, default-off option to consider Bilibili-provided Native sources in normal routing.
- `MeasurementMetaStore` owns the existing `bilicdn.v2.meta` cursor/cooldown record and delegates the existing `measurement` lock. It preserves the storage key and schema.

Persistent stores use distinct `bilicdn.v2.*` keys. Signed routes and session state are memory-only.

## Application controllers

- `RouteCoordinator` produces every `RouteDecision`, applies affinity and plans group-aware fallback.
- `MeasurementController` owns one bounded, player-request-triggered startup preflight and later sequential safe rounds of up to three challengers. Neither changes a healthy route.
- Active startup and healthy probes reject redirects and count only direct 206 Range responses from the admitted host.
- `RecoveryController` arbitrates Watchdog, transport and player-core recovery.
- `LifecycleController` invalidates generations for SPA, enable/disable and page data changes.
- `PlayerMonitor` samples the player on a one-second cadence and feeds typed observations.
- `PlayurlController` registers normalized representations, manages content epochs and requests output plans. The playurl adapter owns payload parsing, field compatibility and writeback.
- `RuntimeController` coordinates settings invalidation, probe/recovery reset, monitor lifecycle and fallback events. `ControlCommands` provides the UI's typed mutation interface and orders comparison, blacklist, reset and data-clear actions.

Controllers receive minimum typed ports. `NavigationPort`, `SchedulerPort` and `PlayerPort.observePlayIntent` keep History wrappers, browser clocks and activation checks outside application policy. `PlayerPort` exposes no raw player/core object. All asynchronous commits revalidate their generation, including metadata updates waiting for a cross-tab lock; disposed lifecycle observers ignore queued page assignments.

## Adapters

Adapters translate browser/Tampermonkey behavior into typed observations:

- independent `FetchHookAdapter` and `XhrHookAdapter`, with shared typed dispatch checks and observation construction in `TransportContext`;
- `TransportAdapter` installs/verifies both hooks, restores partial installations and reports the combined hook snapshot;
- `RangeProbeAdapter` provides one direct same-host HTTPS 206 reader implementation for startup and health probes; it caps bytes, propagates cancellation and releases readers. `MeasurementController` alone initiates probes and controls deadlines/result commits;
- playurl parsing and transformation writeback;
- `__playinfo__` and player manifest ingestion;
- video/player resolution;
- `BrowserNavigation` and `BrowserScheduler`, with reversible History ownership and cancellable scheduled work;
- visibility/background behavior;
- reversible WebRTC blocking;
- Tampermonkey storage and value-change listeners.

Adapters do not own route state or impose penalties.

## Route lifecycle

1. A trusted playurl response or bounded page/player hint establishes representation groups.
2. The vault stores exact Native URLs for the active generation/epoch.
3. The coordinator admits current candidates, applies restrictions and ranks them. With the Native-source option off, normal routing admits only generated built-in Catalog routes; original and Native signed URLs remain in the vault for attribution and the separate comparison mode.
4. The first eligible Fetch/async XHR media request can wait up to three seconds for parallel legal-route preflight. All requests in that window share one deadline. With the option off, preflight probes only Catalog routes; a recognizable Bilibili media URL that cannot safely become a legal Catalog route is blocked before dispatch.
5. The transport adapter asks for a decision at dispatch and records its immutable request context.
   Fetch policy inputs and native dispatch use the same platform-normalized Request; an added page-owned `href` property cannot select a different checked URL.
   It verifies Fetch/XHR hook installation before monitor/UI startup, checks recognized non-GET media without rewriting it, and rechecks XHR at `send()`. With the option off, a recognized media request that cannot be sent to an allowed Catalog route is blocked before the native call, including non-GET and stale-generation requests.
6. Completion yields a typed observation and evidence update. Verified failure may open a media-kind circuit and request group-aware fallback.
7. A no-progress cold start can submit one legal different-host fallback and arm the existing one-shot core recovery. With the option off, that fallback must also be a Catalog route.
8. The observed post-decision host, not the plan alone, confirms the route outcome.

Catalog HTTP 403 invalidates only the current stream/host pairing for later ranking, backups and active challengers. Recovery records a bounded per-kind action from plan to hook entry to response or failure; a same-host request from an unrelated decision cannot confirm that action.

The persisted Native-source option restores normal routing's prior ability to consider legal original and exact Native signed routes when enabled. With it off, playurl output contains only safely generated Catalog primary and backup URLs; if none is legal, the output has no usable route. It does not cancel a website request already dispatched. Disabling the entire script still leaves website requests unchanged.

The optional original comparison mode lives only in the current tab's coordinator and is independent of the persisted Native-source option. It uses only exact legal signed URLs supplied by the video, can promote a legal original backup if the primary is forbidden, and suppresses script probes, route changes and core recovery. It does not survive a full reload or retroactively restore URLs already given to the player.

Healthy measurements never change affinity.

## Diagnostics

The recorder consumes typed `DomainEvent` values, aggregates successful traffic and preserves bounded failure incidents. UI read models are snapshots; reading them cannot mutate routing or start network work. Hook entry, media recognition, native-call and response stages remain separate from browser Network confirmation. The Catalog-only rule applies to script-transformed playurl output and intercepted media dispatch, not to browser traffic outside those entry points.

`RouteSnapshot`, `TransportSnapshot`, `DiagnosticSnapshot` and `ControlCenterSnapshot` expose concrete readonly fields. Diagnostic request serialization uses an explicit bounded field list; unknown external payloads are still validated at adapter/store boundaries. UI commands never access storage keys directly.
