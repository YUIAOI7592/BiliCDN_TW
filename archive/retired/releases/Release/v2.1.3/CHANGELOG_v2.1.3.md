# BiliCDN_TW v2.1.3

- Rewrite the control center and player-panel labels in plain Traditional Chinese. The overview now explains playback, selected CDN, actual script-observed request/response hosts, attribution, fallback and measurement without exposing internal status codes as the primary UI.
- Clarify that the per-tab original comparison mode uses only Bilibili-provided original or backup URLs, does not measure or switch automatically, and applies to new playback after activation. Explain settings, disabled actions and the diagnostic report in user-facing language.
- Keep the report's raw technical data for troubleshooting. No route, restriction, playback, probe, recovery, storage or network behavior changes; v2.1.2 remains untouched.

## v2.1.2

- Link playurl output to later media requests with bounded original/output host, primary/backup, source and decision-ID metadata. Exact signed URLs without a recognized media path remain observation-only but retain this host-level lineage; no signed URL enters diagnostics.
- Keep a Catalog 403 incompatible only with the current stream/host pairing across later ranking, backup assembly and healthy challenge selection. Do not punish that CDN globally from a compatibility response alone.
- Track a legal fallback separately as planned, entered-hook, response-observed or request-failed. Tie the after-state to the same decision and request; an unrelated same-host request cannot confirm it. When no legal different route remains, clear the older fallback instead of presenting it as current.
- Add a per-tab original signed-URL comparison mode for troubleshooting. It creates no synthesized CDN URL, active probe or automatic script route/core recovery; existing black/dead/default restrictions still apply. A forbidden primary may promote its own legal signed backup. Full reload exits the mode.
- Keep the CDN roster, scoring formula, playback-rate behavior and probe limits unchanged. No Code Security scan or historical patch files.

## v2.1.1

- Install and verify Fetch/XHR hooks before player monitoring or UI startup; a partial installation rolls back the hooks installed in that attempt and reports its status.
- Recognize exact current-epoch signed media URLs even when their path lacks a known media suffix. These opaque URLs remain observation-only: no synthesized rewrite, Native selection, health sample or active probe.
- Recheck recognized GET and non-GET media hosts before dispatch. Non-GET requests preserve their original URL but cannot directly send to a black/dead/disabled host; XHR rechecks at `send()` after settings changes or startup waiting.
- Preserve legal opaque signed primary and backup URLs in playurl output, while removing prohibited ones. Fetch `Request` input and XHR timeout/abort/reuse behavior remain covered by contracts.
- Report hook installation, media recognition, native-call and response stages separately. An explicit XHR timeout is labeled as a skipped preflight, not a skipped interception; only Chrome Network can confirm an actual browser request.
- Preserve the CDN roster, ranking, playback speed, Codec preference and recovery strategy. No Code Security scan or historical patches.

## v2.1.0

- Gate the first attributable player media Fetch or asynchronous XHR behind one shared, at-most-three-second cold-start preflight. Probe up to three different legal exact-signed or Catalog routes in parallel, using bounded Range reads; an inconclusive window releases a legal original or alternative.
- Reuse recent cross-tab Catalog throughput only after a 16 KiB compatibility response for this video's generated URL. Full startup samples enter the existing evidence store; probing alone never opens a persistent host circuit.
- Prevent an unattributed first media request from blindly selecting the first Catalog. Preserve exact signed backups, including backups on Catalog hosts, and never send a blacklisted preflight candidate.
- Detect a no-progress, no-buffer initial stall after 15 seconds and submit at most one legal different-host fallback without penalizing the original. If the player remains stalled, the existing RecoveryController can reload the core once; actual recovery still requires new media evidence.
- Replace the one-challenger healthy round with up to three sequential, fair candidates under the existing ten-minute cross-tab cooldown. Invalid and HTTP 4xx attempts are bounded and skipped in later rounds; healthy exploration never switches the playback host.
- Preserve user-selected playback speed, v2 storage, CDN roster, media-kind isolation and strict restrictions. No Code Security scan. Automated results and post-update Chrome acceptance are recorded separately.

## v2.0.4

- Apply black, dead, Catalog-disable and default-unavailable restrictions before pass-through for PCDN-marked, live, resource and special-port media URLs. Keep unrestricted special media unchanged; a prohibited host without a safe rewrite is locally blocked.
- For media without a confirmed representation, screen candidate and outbound hosts against both video and audio restrictions instead of assuming video. Recheck XHR at `send()` even when it was opened while the script was disabled.
- Make the control-center host blacklist cover both video and audio. Previously saved user-created video-only blacklist rows receive that same effective scope on load; other kind-specific restrictions retain their scope and expiry.
- Show active black/dead penalties alongside Catalog enable toggles. Preserve settings, evidence, route ranking, playback rate and measurement budget; do not change Worker interception or add active network work.
- Source-level Fetch/XHR, playurl and controller contracts passed. Browser-driven requests outside these adapters and post-dispatch redirects cannot be blocked retroactively; targeted Chrome acceptance follows installation. No Code Security scan.

## v2.0.3

- On first use of a video quality, resolve the observed video affinity against that group's own capabilities instead of reviving its cold startup plan.
- Preserve exact Native URLs, explicit player backups, existing requested-group recovery, fixed CDN and host restrictions. No new probes or abort penalties.
- Clear stale pause-armed diagnostics after a healthy short resume; no extra recovery token or reload.
- Preserve published v2.0.2. Source-level reproductions passed; targeted Chrome acceptance follows user installation. The historical black-screen cause remains unconfirmed.

## v2.0.2

- Filter prohibited hosts from player primary/backup output, including blocked roots, invalid Native routes and host-lock restoration. Reuse restriction checks for active challengers.
- Track bounded exact output roles in the current-epoch vault. A legal player-requested backup receives an explicit coordinated fallback decision instead of being rewritten back to primary; fixed mode and video/audio isolation remain in force.
- Report responseHost as null when the browser supplies no response URL. Keep sent-target failure attribution and separate last success from the latest abort.
- Detect sustained uninitialized cores using consecutive valid monitor ticks and automatically capture diagnostic evidence without treating paused state as permission to reload.
- Install the temporary play observer on the first eligible paused tick; retain the existing trusted long-pause activation and one-shot recovery limits.
- Preserve automatic frozen incidents when manually marking a stall, count rolling-context expiry separately, and show transport outcome/status alongside hosts.
- Retain user-selected playback rate, v2 learning/settings, existing CDN roster and measurement budget. No Code Security or CI changes.
- Chrome acceptance follows publication and user installation; this release does not establish the cause of every historical black screen.

## v2.0.1

- Capture immutable request context at dispatch, retaining generation, epoch, attribution and actual outbound/response hosts independently of active representation.
- Merge stable representation groups and generated Catalog aliases; keep MPD ingestion read-only and retain eligible committed routes across evidence updates.
- Aggregate successful transfers, bound ranking details and prioritize incident evidence instead of clearing report event arrays.
- Preserve player reload failure reasons and handle asynchronous reload/play rejection without retry loops.
- Show recent request/response attribution and disable current-video blacklisting when no suitable video observation exists.
- Remove the per-second forced 2x write. Respect the user's playback speed; use 2x only as an unavailable-rate demand estimate and restore the saved speed after core recovery.
- Retain v2 settings and health data. No Code Security scan, historical patches or CI changes.
- Publication precedes targeted Chrome acceptance at the user's request; real-browser results are pending, not claimed passed.

## v2.0.0

- Rebuilt the runtime in strict TypeScript with explicit domain, state, application, adapter, UI and diagnostic layers.
- Replaced the v1 router with deterministic Catalog/Native ranking based on bounded video/audio evidence, conservative throughput and per-kind circuits.
- Added a single safe challenger model; startup performs no active measurement and healthy exploration never changes affinity.
- Introduced current-epoch opaque Native route handles; full signed URLs are never persisted or reported.
- Added v2-only settings, restrictions, evidence and coordination storage with Web Locks and Tampermonkey value-change synchronization.
- Unified transport, Watchdog and player-core recovery under traceable route decisions and recovery actions.
- Preserved 2x playback, AV1/HEVC preference, auto quality, background playback, WebRTC blocking, manual HTTPDNS policy, strict restrictions, control center and failure-oriented incidents.
- Removed v1 storage migration, header settings, public page API, compatibility aliases, AutoPilot HTTPDNS, multi-candidate bakeoff, latency probes, old fixtures and historical patch generation.
- Limited official support to current Chrome and Tampermonkey.
