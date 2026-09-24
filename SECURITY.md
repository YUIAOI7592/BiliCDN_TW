# Trust boundaries and data handling

This file documents runtime trust boundaries. It is not a request to run a security scanner.

## Untrusted inputs

Page JavaScript, `__playinfo__`, player manifests, playurl payloads, media URLs, response headers, console output and synthetic DOM events are untrusted.

- URLs are parsed and admitted by `domain/url-policy.ts` before routing.
- Native URLs remain in `SignedRouteVault` and are exposed internally only through opaque handles.
- A trusted playurl API representation supersedes lower-trust page and player hints for Native eligibility; revoked handles cannot grant active probing or new health evidence.
- Unknown external hosts require natural attributable transport success before they can receive evidence; they are never actively probed first.
- Control-center actions require trusted user events and run inside a closed Shadow DOM.

## Persistent data

Only the four `bilicdn.v2.*` namespaces are used. Schemas, record counts, numeric values and timestamps are bounded. Stores merge under Chrome Web Locks when available and subscribe through Tampermonkey value-change listeners.

Signed URLs, paths, queries, tokens, player objects, representation state and incident timelines are never persisted.

## Network authority

- Adapters normalize outside observations; only application controllers may initiate routing, measurement or recovery.
- `MeasurementController` is the only component that starts active probes.
- `RouteCoordinator` is the only component that changes affinity or commits fallback.
- `RecoveryController` is the only component that reloads the player core.
- Diagnostics consume typed events and cannot impose penalties or control playback.
- Fetch checks the platform-normalized Request that is sent to the native API. Active probes reject redirects and only accept a direct Range response from the checked host.

## Browser behavior

The script does not replace or inspect `Worker`, does not create Worker blobs or message channels, and does not load remote code. WebRTC and visibility overrides are reversible and restore only values still owned by the script.

## Reporting

Diagnostic output is bounded and redacted. It may contain normalized Catalog or known Native hostnames; unknown third-party hosts receive a per-tab alias. It must not contain media URLs, paths, queries, tokens, video IDs, cookies, IP addresses or player/core objects.

Please report runtime bugs through the repository issue tracker. Do not include unredacted browser network exports.
