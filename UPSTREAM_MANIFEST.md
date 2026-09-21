# Upstream and historical sources

## Attribution baseline

`baseline/BiliCDN_TW_1.3.4.original.user.js` is retained as the immutable upstream attribution baseline. Archived v1 releases and tags remain available for historical investigation.

## v2 relationship

BiliCDN_TW v2.0.0 is a clean TypeScript rearchitecture. It uses v1.9.6 only as a behavioral reference for user-visible invariants. The v2 build, tests and packaging do not import:

- the v1 source tree;
- v1 production bundles;
- v1 test bridges or fixtures;
- incremental or cumulative patch artifacts.

There is no v1 storage migration or runtime compatibility layer. Existing v1 Tampermonkey values are neither read nor deleted.

## Third-party tooling

- TypeScript 7.0.2 — development type checker only.
- esbuild 0.28.2 and its locked platform package — build/test bundler only.

The released userscript is a single IIFE with no runtime third-party dependency. License notices are maintained in `docs/THIRD_PARTY_NOTICES.md`.
