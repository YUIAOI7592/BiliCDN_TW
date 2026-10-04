# Codex development guide — BiliCDN_TW v2

## Current target

- Source of truth: `src-v2/`.
- Entry point: `src-v2/entry.ts`.
- Tests: `tests-v2/`.
- Release output: `Release/v<version>/BiliCDN_TW.user.js`, with `version` from `release.json`. Publish after automated and required security verification; record Chrome/Tampermonkey acceptance separately.
- Historical v1 releases and tags are references only; v2 build and tests must not import them.
- Current documentation and historical-record status are indexed in `docs/INDEX.md`. Versioned plans, acceptance logs and release snapshots describe their recorded version, not the current backlog.
- Retired documents live under `archive/retired/docs/`; obsolete local tools and private evidence under `archive/retired/local/`. The archive is not a v2 build/test input; its placement is documented in `archive/retired/README.md`.

## Required workflow

1. Read `docs/PROJECT_CONTEXT.md`, `SECURITY.md`, `docs/ARCHITECTURE.md` and `docs/DEVELOPMENT.md`.
2. Reproduce a behavior with a domain, controller or adapter contract test before changing runtime logic.
3. Preserve the layer direction: domain → state → application → adapters/UI composition. Lower layers never import higher layers.
4. Use `apply_patch` for source edits and preserve unrelated user changes.
5. Run `npm run typecheck`, `npm run architecture`, `npm test` and `npm run verify` before release.
6. Record automated and real Chrome/Tampermonkey results separately.

## Architectural rules

- `domain` is pure and must not read GM, DOM, Fetch, XHR, ambient clocks or timers. Time and relative-URL bases are explicit inputs; injected `Clock` values are allowed.
- Importing a non-entry module must not read GM, mutate the page, create a timer or start network work. `entry.ts` deliberately starts the composed runtime.
- `entry.ts` only composes ports, stores and controllers.
- No dynamic dependency bags, cross-module setters or public mutable Maps/Sets/timers.
- `RouteCoordinator` exclusively changes route affinity.
- `MeasurementController` exclusively starts active probes.
- `RecoveryController` exclusively reloads the player core.
- Lifecycle-sensitive asynchronous work must validate the applicable generation, epoch, identity or controller marker before committing state.
- `SignedRouteVault` owns signed route indexes, opaque handles and Native selection authority. Policy helpers use handles and bounded metadata; adapters and execution paths also process in-memory URLs, payloads and manifest fingerprints. Do not create another independently authorizing Native URL index or persist/report these raw values.
- Diagnostics are read-only consumers of typed events.

## Required invariants

- Catalog targets are trusted built-ins only; Native targets are exact current-epoch URLs.
- Normal routing defaults to Catalog-only; the persisted Native-source switch, tab-local original comparison and whole-script disable retain their distinct semantics.
- Restrictions apply to original, Native, Catalog, fixed and fallback routes.
- Video and audio health/recovery remain isolated.
- Healthy exploration never changes the current host.
- Fetch remains single-reader and propagates cancel reasons.
- XHR text/json/reuse/timeout/abort behavior remains compatible.
- Stop all script rewrite and active network behavior while disabled without cancelling website requests.
- Never read, replace or wrap the site Worker constructor.
- Never persist or report signed URL/path/query/token, cookie, IP or player/core objects.
- Codec capability checks do not block playurl; dropped frames remain diagnostic only.

## Release rules

- Do not add CI/CD, GitHub Actions, runtime dependencies or remote code loading.
- Do not generate historical patch artifacts for v2.
- The GitHub Release contains only `BiliCDN_TW.user.js`.
- Update URLs remain under this repository’s latest release.
- Use Codex Security according to risk: for security-sensitive changes or an explicit user request, not automatically for every release. `npm run verify` does not include a security scan.
- Commit messages identify the actual executing model and reasoning setting when that information is available; do not copy stale attribution.

## Documentation maintenance

- Update active guidance with the corresponding source change. Check defaults, ports/ownership, storage behavior, UI labels, test commands and publication status against code/configuration.
- Use `release.json`, `package.json`, `package-lock.json`, `src-v2/` and `scripts/` as factual inputs; use dated test/browser records as evidence for that version only.
- Label historical records with their version/date and a link to current guidance. Preserve original observations, limits and cancelled-plan status; do not turn old pending text or approved acceptance limits into current tasks.
- Keep `docs/INDEX.md`, `docs/TODO.md` and the latest section of `docs/TEST_REPORT.md` consistent. Do not rewrite `Release/v*/` snapshots or sealed security artifacts when correcting current documents.
- For documentation-only work, verify links, referenced paths/labels, factual consistency and `git diff --check`. Do not claim new runtime tests or browser acceptance unless performed.
