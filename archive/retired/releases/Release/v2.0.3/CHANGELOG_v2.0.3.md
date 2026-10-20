# BiliCDN_TW v2.0.3

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
