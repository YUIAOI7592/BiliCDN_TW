# Trust boundaries and data handling

This is current guidance for the v2 source in `src-v2/`, not a versioned audit result. Document roles and historical records are indexed in [docs/INDEX.md](docs/INDEX.md). This file documents runtime trust boundaries; it is not a request to run a security scanner.

This guidance describes published **v2.1.8**, including the MP4/FLV correction. Publication, automated verification and source security review are complete. The canonical sealed security report retains an intermediate `partial coverage` limitation for nine subsequently reviewed files; [TEST_REPORT](docs/TEST_REPORT.md) records that distinction. The installed Tampermonkey version and the authorized Chrome regression have now been observed separately: a legitimate MP4 trial clip and public DASH playback used direct Catalog HTTPS 206 responses. The members-only MP4 trial does not establish complete public MP4 playback; no such field sample was available, and FLV remains covered by automated contracts only. These are evidence limits, not additional approved tasks.

## Untrusted inputs

Page JavaScript, `__playinfo__`, player manifests, playurl payloads, media URLs, response headers, console output and synthetic DOM events are untrusted.

- URLs are parsed and admitted by `domain/url-policy.ts` before routing.
- `SignedRouteVault` owns the signed route indexes, opaque handles and current Native selection authority. Adapters and execution paths also process URLs and payloads in memory; `PlayerAdapter` retains a serialized manifest fingerprint until replacement/reset, and XHR retains per-request URL state. These are not separate Native authorization indexes and must not enter durable learning data or diagnostic output.
- A trusted playurl API representation supersedes lower-trust page and player hints for Native eligibility; revoked handles cannot grant active probing or new health evidence.
- Unknown external hosts require natural attributable transport success before they can receive evidence; they are never actively probed first.
- Control-center actions require trusted user events and run inside a closed Shadow DOM.

Recognized MP4/FLV `durl` segments and DASH aliases remain untrusted payload inputs. Progressive/mixed output is planned before URL writeback; a required progressive segment without a legal primary must not be dropped or exposed as a partially rewritten success. This is payload writeback atomicity, not a promise to roll back vault/controller registration. Typed playurl results carry an explicit `accepted` flag that every consumer must inspect. In strict mode, rejected Fetch playurl responses use HTTP 503, while XHR exposes safe failure content without replacing native HTTP status.

A Catalog source handle identifies the current segment's admitted URL used to generate a built-in target. Selecting a safe backup source for that segment must preserve exact path/query association and current authority checks. This capability does not grant new Native selection authority; an unsafe or unrewritable original must not become a pass-through route merely because another source can generate Catalog output.

The vault may retain a rewritable PCDN URL solely as a Catalog source when replacement yields a normal built-in target; its Native selectability remains false. Progressive output uses its canonical same-segment source, while safe same-representation DASH exact/Catalog-alias requests retain their current query. Neither case relaxes final-target restrictions.

## Persistent data

Product persistence uses four keys: `bilicdn.v2.settings`, `bilicdn.v2.restrictions`, `bilicdn.v2.routeEvidence`, and `bilicdn.v2.meta`.

`SettingsStore`, `RestrictionStore` and `EvidenceStore` reconstruct their known fields with the limits implemented in their parsers and subscribe to Tampermonkey value changes when the API is available. Settings writes and restriction/evidence mutations use their storage locks. Collection and sample limits must not be generalized into a claim that every raw envelope field has a finite upper bound.

`MeasurementMetaStore` has different semantics: it rereads an object on demand, coerces cursor/cooldown fields, preserves existing raw fields on update, and has no value-change listener or full schema/finite-upper-bound validation. The measurement controller invokes its `measurement` lock for planning writes; `get`, `update` and `clear` do not acquire that lock themselves. See [measurement-meta-store.ts](src-v2/state/measurement-meta-store.ts).

Chrome Web Locks are used when available; otherwise the storage port executes the task without cross-tab serialization. Tampermonkey listener support also has an unavailable-API fallback. These are platform-dependent synchronization mechanisms, not unconditional guarantees.

Product-owned persistent data consists of settings, restrictions, Host evidence and measurement cursor/time metadata. Signed URLs, paths, queries, tokens, player objects, representation state and incident timelines must not be introduced into persistence. Metadata's raw-field merge is not a general-purpose storage sanitizer.

## Network authority

- Adapters normalize outside observations; only application controllers may initiate routing, measurement or recovery.
- `MeasurementController` is the only component that starts active probes.
- `RouteCoordinator` is the only component that changes affinity or commits fallback.
- `RecoveryController` is the only component that reloads the player core.
- Diagnostics consume typed events and cannot impose penalties or control playback.
- While enabled, Fetch checks the platform-normalized Request that is sent to the native API. Active probes reject redirects and only accept a direct Range response from the checked host.
- Normal routing defaults to generated built-in Catalog routes. Enabling Native consideration admits only legal current-identity exact routes; tab-local original comparison is separate. Whole-script disable passes website requests through and stops active script measurement/recovery.
- The `trusted-api` source label follows the recognized playurl request endpoint; it is not a cryptographic provenance assertion or proof of the final response origin. Promotion and revoked-handle checks remain necessary.
- Catalog-only media Fetch dispatch uses `redirect: 'error'`. XHR cannot prevent redirects before they happen; a non-Catalog observed final host is not confirmed as a Catalog route. Requests outside the installed Fetch/XHR hooks and already-dispatched website requests are outside that interception coverage. Actual destinations require Chrome Network evidence.

All 11 built-in Catalog hosts remain in the candidate inventory, including four unavailable by default. The startup budget is at most three concurrent probes with one shared three-second deadline, not one budget per MP4/FLV segment. Unprobed candidates still require the same restrictions and safe URL-generation checks before ranking, backup output or later exploration. Catalog-only output is capped at five backup hosts distinct from the primary and each other.

Catalog-only startup with no valid result commits no probe winner; final dispatch ranks the complete remaining legal pool. A Catalog 403 still invalidates its current stream/host pairing rather than authorizing an original-source fallback.

Whole-script disable precedes tab-local original comparison and normal fixed/automatic routing. Fixed-host, Catalog-override and Native-source changes invalidate plans and reset probes/recovery; old asynchronous probe results must not overwrite current settings. Already-dispatched website requests remain untouched.

## Browser behavior

The script does not replace or inspect `Worker`, does not create Worker blobs or message channels, and does not load remote code.

WebRTC restoration checks that the installed getter/setter is still owned by this script. Visibility cleanup removes its event listeners and attempts to restore the saved document descriptors (or remove its own properties); the current visibility implementation does not check descriptor ownership before restoration. Browser hooks must be described according to their individual restoration behavior.

## Reporting

Diagnostic output is bounded and redacted. It may contain normalized Catalog or known Native hostnames; unknown third-party hosts receive a per-tab alias. It must not contain media URLs, paths, queries, tokens, video IDs, cookies, IP addresses or player/core objects.

The recent playurl summary copies only transport, time, native HTTP status, acceptance, up to three known formats, bounded video/audio/segment counts, numeric upstream code and an enumerated rejection reason. It stores one immutable entry and excludes payloads, result extras and exception text. This summary does not prove actual network destination or successful playback and introduces no new persistent key.

Please report runtime bugs through the repository issue tracker. Do not include unredacted browser network exports.
