# Codex development guide — BiliCDN_TW v2

## Current target

- Source of truth: `src-v2/`.
- Entry point: `src-v2/entry.ts`.
- Tests: `tests-v2/`.
- Release output: `Release/v2.1.4/BiliCDN_TW.user.js`. Publish after automated and required security verification; targeted Chrome acceptance follows the user's update.
- Historical v1 releases and tags are references only; v2 build and tests must not import them.

## Required workflow

1. Read `PROJECT_CONTEXT.md`, `SECURITY.md`, `docs/ARCHITECTURE.md` and `docs/DEVELOPMENT.md`.
2. Reproduce a behavior with a domain, controller or adapter contract test before changing runtime logic.
3. Preserve the layer direction: domain → state → application → adapters/UI composition. Lower layers never import higher layers.
4. Use `apply_patch` for source edits and preserve unrelated user changes.
5. Run `npm run typecheck`, `npm run architecture`, `npm test` and `npm run verify` before release.
6. Record automated and real Chrome/Tampermonkey results separately.

## Architectural rules

- `domain` is pure and must not read GM, DOM, Fetch, XHR, clocks or timers.
- Importing a module must not read GM, mutate the page, create a timer or start network work.
- `entry.ts` only composes ports, stores and controllers.
- No dynamic dependency bags, cross-module setters or public mutable Maps/Sets/timers.
- `RouteCoordinator` exclusively changes route affinity.
- `MeasurementController` exclusively starts active probes.
- `RecoveryController` exclusively reloads the player core.
- Every asynchronous task must validate its generation before committing state.
- Full Native URLs remain in `SignedRouteVault`; all other components use an opaque handle and bounded metadata.
- Diagnostics are read-only consumers of typed events.

## Required invariants

- Catalog targets are trusted built-ins only; Native targets are exact current-epoch URLs.
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
- Use Codex Security according to risk: for security-sensitive changes or an explicit user request, not automatically for every release. v2.1.4 requires a security diff scan and verification of its three reported findings before release. `npm run verify` does not include a security scan.
- Commit messages identify the actual executing model and reasoning setting when that information is available; do not copy stale attribution.
