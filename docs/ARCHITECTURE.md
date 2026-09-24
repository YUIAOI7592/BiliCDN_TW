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

The architecture check enforces allowed imports and rejects cycles. `entry.ts` is the composition root.

## Domain

`domain/` contains pure models and algorithms:

- branded lifecycle and action IDs;
- URL admission and host-replacement rules;
- Catalog definitions;
- bounded evidence windows, safe throughput and circuits;
- candidate eligibility and deterministic ranking.

The domain accepts time as an argument and performs no I/O.

## State

- `SessionState` owns generation, epoch, representation and route affinity.
- `RestrictionStore` owns black/dead/user/default restrictions.
- `EvidenceStore` owns bounded video/audio host evidence.
- `SignedRouteVault` owns full current-epoch Native URLs behind opaque handles.
- The first trusted playurl API representation replaces lower-trust page-hint/player-MPD routes for the same group, revokes their handles and route plans, and prevents later hints from restoring selectable Native routes.
- Exact signed URLs with an unrecognized path may be indexed for observation and host restriction only; they do not become selectable Native routes or active-probe capabilities.
- The vault also keeps a bounded, current-epoch mapping from playurl output URL to original/output hostname, primary/backup role, source and decision ID. Full URLs remain private to the vault.
- `SettingsStore` owns the typed v2 product settings.

Persistent stores use distinct `bilicdn.v2.*` keys. Signed routes and session state are memory-only.

## Application controllers

- `RouteCoordinator` produces every `RouteDecision`, applies affinity and plans group-aware fallback.
- `MeasurementController` owns one bounded, player-request-triggered startup preflight and later sequential safe rounds of up to three challengers. Neither changes a healthy route.
- Active startup and healthy probes reject redirects and count only direct 206 Range responses from the admitted host.
- `RecoveryController` arbitrates Watchdog, transport and player-core recovery.
- `LifecycleController` invalidates generations for SPA, enable/disable and page data changes.
- `PlayerMonitor` samples the player on a one-second cadence and feeds typed observations.

All asynchronous commits revalidate their generation.

## Adapters

Adapters translate browser/Tampermonkey behavior into typed observations:

- Fetch/XHR and playurl transformation;
- `__playinfo__` and player manifest ingestion;
- video/player resolution;
- visibility/background behavior;
- reversible WebRTC blocking;
- Tampermonkey storage and value-change listeners.

Adapters do not own route state or impose penalties.

## Route lifecycle

1. A trusted playurl response or bounded page/player hint establishes representation groups.
2. The vault stores exact Native URLs for the active generation/epoch.
3. The coordinator admits current candidates, applies restrictions and ranks them.
4. The first eligible Fetch/async XHR media request can wait up to three seconds for parallel legal-route preflight. All requests in that window share one deadline; an unsupported entrance passes without preflight.
5. The transport adapter asks for a decision at dispatch and records its immutable request context.
   Fetch policy inputs and native dispatch use the same platform-normalized Request; an added page-owned `href` property cannot select a different checked URL.
   It verifies Fetch/XHR hook installation before monitor/UI startup, checks recognized non-GET media without rewriting it, and rechecks XHR at `send()`.
6. Completion yields a typed observation and evidence update. Verified failure may open a media-kind circuit and request group-aware fallback.
7. A no-progress cold start can submit one legal different-host fallback without penalizing the original and arm the existing one-shot core recovery.
8. The observed post-decision host, not the plan alone, confirms the route outcome.

Catalog HTTP 403 invalidates only the current stream/host pairing for later ranking, backups and active challengers. Recovery records a bounded per-kind action from plan to hook entry to response or failure; a same-host request from an unrelated decision cannot confirm that action.

The optional original comparison mode lives only in the current tab's coordinator. It uses only exact legal signed URLs supplied by the video, can promote a legal original backup if the primary is forbidden, and suppresses script probes, route changes and core recovery. It does not survive a full reload or retroactively restore URLs already given to the player.

Healthy measurements never change affinity.

## Diagnostics

The recorder consumes typed `DomainEvent` values, aggregates successful traffic and preserves bounded failure incidents. UI read models are snapshots; reading them cannot mutate routing or start network work. Hook entry, media recognition, native-call and response stages remain separate from browser Network confirmation.
