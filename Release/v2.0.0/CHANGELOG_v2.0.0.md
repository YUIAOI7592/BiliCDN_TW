# BiliCDN_TW v2.0.0

- Rebuilt the runtime in strict TypeScript with explicit domain, state, application, adapter, UI and diagnostic layers.
- Replaced the v1 router with deterministic Catalog/Native ranking based on bounded video/audio evidence, conservative throughput and per-kind circuits.
- Added a single safe challenger model; startup performs no active measurement and healthy exploration never changes affinity.
- Introduced current-epoch opaque Native route handles; full signed URLs are never persisted or reported.
- Added v2-only settings, restrictions, evidence and coordination storage with Web Locks and Tampermonkey value-change synchronization.
- Unified transport, Watchdog and player-core recovery under traceable route decisions and recovery actions.
- Preserved 2x playback, AV1/HEVC preference, auto quality, background playback, WebRTC blocking, manual HTTPDNS policy, strict restrictions, control center and failure-oriented incidents.
- Removed v1 storage migration, header settings, public page API, compatibility aliases, AutoPilot HTTPDNS, multi-candidate bakeoff, latency probes, old fixtures and historical patch generation.
- Limited official support to current Chrome and Tampermonkey.
