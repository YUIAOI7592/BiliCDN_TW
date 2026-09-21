# BiliCDN_TW v2.0.1 test report

## Scope and release order

This release repairs transport attribution, route/representation continuity, diagnostic retention and forced playback speed. Existing v2 storage is retained. At the user's explicit request, automated verification and GitHub publication precede real Chrome acceptance. No natural reproduction of a dead core is required to publish.

## Automated functional verification

`npm run verify` passed on 2026-09-21 using Node.js 26.8.1, TypeScript 7.0.2 and esbuild 0.28.2: all 87 assertions, typecheck, architecture, deterministic build, syntax and package checksums passed.

The suite contains 87 assertions. Covered contracts include restrictions and ranking, evidence/circuits, stable repeated representation registration, Native vault bounds, host-lock, Fetch single-reader cancellation, XHR JSON handling, disabled pass-through, diagnostic success aggregation and oversized-report incident retention, core position/rate restoration, and safe single-challenger measurement.

Added speed checks observe 0.75x, 1x, 1.5x and 2x across repeated monitor ticks without a rate write; adapter buffer duration uses the actual speed, unavailable speed uses the 2x estimate, and core recovery restores a saved 1.5x rather than forcing 2x.

Release verification runs strict typecheck, architecture direction/cycle checks, the complete functional suite, two identical builds, generated JavaScript syntax, package equality and SHA-256 checks. Results are reported from the actual verification command; this document does not claim each acceptance-plan scenario has a dedicated automated case.

## Real Chrome / Tampermonkey: pending after update

No Chrome playback acceptance has been performed on v2.0.1 before publication. v2.0.0 observations are not evidence for this build.

After installation, use an additional video tab to compare outgoing/response hosts with the report, switch to a permitted fixed CDN and back to automatic, and check one seek, quality change, SPA and background return. Verify user-selected playback speed remains unchanged. Do not touch the user's preserved paused tabs.

Still unverified in the browser: attribution continuity under real player URL changes, fixed-CDN dispatch after settings changes, and recovery behavior during a natural black-screen incident. The root cause of all historical black screens is not claimed solved.

## Artifacts

The userscript, manifest, this report, changelog and SHA-256 list are in `Release/v2.0.1/`. GitHub Release attaches only `BiliCDN_TW.user.js`. No historical patches, Code Security scan, independent security suite or CI workflow are included.
