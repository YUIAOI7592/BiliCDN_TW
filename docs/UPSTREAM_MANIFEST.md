# Upstream and historical sources

This is current attribution/build guidance for the v2 series. The versioned sources below are historical baselines; current source is `src-v2/`, version/tool configuration is `release.json` and the lockfile, and document roles are listed in [docs/INDEX.md](INDEX.md).

## Attribution baseline

`baseline/BiliCDN_TW_1.3.4.original.user.js` is retained as the immutable upstream attribution baseline. Archived v1 releases and tags remain available for historical investigation.

Its SHA-256 list is [baseline/SHA256SUMS.txt](../baseline/SHA256SUMS.txt). The list retains repository-root-relative paths; perform checksum verification from the repository root.

## v2 relationship

The v2 series began with the v2.0.0 TypeScript rearchitecture. It uses v1.9.6 only as a behavioral reference for user-visible invariants. The current v2 build, tests and packaging do not import:

- the v1 source tree;
- v1 production bundles;
- v1 test bridges or fixtures;
- incremental or cumulative patch artifacts.

There is no v1 storage migration or runtime compatibility layer. Existing v1 Tampermonkey values are neither read nor deleted.

## Third-party tooling

- TypeScript 7.0.2 and its locked platform packages — development type checking and the local AST architecture/test API.
- esbuild 0.28.2 and its locked platform package — build/test bundler only.

The released userscript is a single IIFE with no runtime third-party dependency. License notices are maintained in `docs/THIRD_PARTY_NOTICES.md`.
