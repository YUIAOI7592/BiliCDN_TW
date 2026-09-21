# v2.0.0 release checklist

- [x] Establish strict TypeScript architecture and v2-only storage namespaces.
- [x] Implement the route domain, state stores, controllers, adapters, UI and diagnostics.
- [x] Remove v1 runtime sources, test bridges, bundle fixtures and patch generation.
- [ ] Pass final typecheck, architecture, functional, deterministic-build and package verification.
- [ ] Install the local v2 bundle in Chrome＋Tampermonkey and record real-browser results separately.
- [ ] Verify auto quality, 1080p／4K 2x, AV1／HEVC, seek, SPA／分P, background/minimize, long pause recovery and multiple tabs.
- [ ] Confirm first playback produces no active measurement and ten minutes of healthy playback produces no exploration-driven host switch.
- [ ] Update `TEST_REPORT.md` with exact results and known limitations.
- [ ] Commit, push, merge and publish v2.0.0; attach only the userscript to the GitHub Release.

Deferred until evidence justifies a separate change:

- Additional CDN Catalog entries.
- A remembered “last CDN” preference.
- More aggressive startup preconnect or challenge cadence.
- Browser support beyond Chrome＋Tampermonkey.
