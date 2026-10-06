# 歷史驗證報告

本文件於 2026-10-06 自 `docs/TEST_REPORT.md` 搬入 v2.0.2～v2.1.7 的十二個主要紀錄區塊，包括發行前模組化驗證。英文正文、順序、日期、數值與當時的 pending 敘述保留；僅按位置調整 Markdown 連結。原文的 current release、first section 等用語保留其原報告脈絡；歷史狀態只適用於記錄當時，不構成目前待辦。

現行入口：[最新版驗證報告](../../../docs/TEST_REPORT.md)、[文件索引](../../../docs/INDEX.md)、[工作狀態](../../../docs/TODO.md)。封存配置見 [封存索引](../README.md)。

---

# Published BiliCDN_TW v2.1.7 test report

> Current release evidence is summarized in the first section. All later version/pre-release sections are dated historical records; their pending or unpublished language describes that time, not the current backlog. Document status is indexed in [docs/INDEX.md](../../../docs/INDEX.md). Packaged `Release/v*/` reports remain immutable snapshots.

## Release scope

Released on 2026-10-03 (Asia/Taipei) as [v2.1.7](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.7), commit `03beb91a5fdc34c8bcaf6f623783bfc411737d0e`, from baseline `307f9a6f38b5a559e05e32c50c5b3f8ca1636257`, after the completed modularization implementation documented below. Settings schema/defaults, the Catalog roster, Native-source opt-in, original comparison and UI/diagnostic semantics remain compatible with v2.1.6.

## Final automated verification

On 2026-10-03 (Asia/Taipei), `npm run typecheck`, `npm run architecture`, `npm test` and `npm run verify` all passed for v2.1.7. The architecture check covers 41 runtime modules; tests retain 626 functional assertions and add 18 architecture assertions plus import-purity checks for all 40 non-entry modules. Verify passed deterministic double build, JavaScript syntax, v2-only bundle and package/checksum validation in a temporary directory. `git diff --check` also passed.

The production userscript is **273,691 bytes**, SHA-256 **`6cc8d1bdcc1afd76859a7831c3b467d9d7f5fddf4f238df47a4a28c475f2e405`**. Formal release packaging uses these same build inputs and retains the packaged script, report, changelog, manifest and checksum list under `Release/v2.1.7/`.

## Security evidence and browser status

The final implementation diff was reviewed in Codex Security scan `650fe466-dc70-4427-be60-b8da85b84e0b`: all 53 changed review items were examined with zero reportable findings. The sealed coverage document retains one stale intermediate deferred entry even though both runtime and script/test surfaces are closed as `no_issue_found`; the canonical partial-coverage limitation remains explicit in the implementation record below. A readback for this release confirmed the same sealed result. Before release metadata changes, all 38 `src-v2/` inputs in the verified build manifest matched their current SHA-256 hashes. Subsequent release edits update version metadata, release documentation and packaging inclusion only; no application runtime body was changed after the scan.

**v2.1.6 Chrome/Tampermonkey acceptance remains passed and closed.** No new real-browser v2.1.7 result is claimed by this release; any later browser regression record applies to the new release difference.

## Publication contract

The GitHub Release contains only `BiliCDN_TW.user.js`. Changelog, test report, build manifest and checksums stay in the repository under `Release/v2.1.7/`; prior release directories and unrelated user documentation remain preserved.

Publication readback confirmed v2.1.7 as the latest non-draft/non-prerelease, exactly one uploaded userscript asset, the remote tag matching the release commit, and asset size/SHA-256 matching the verified package above. Current repository documentation can subsequently receive maintenance edits without rewriting the packaged release report.

## First post-release archive verification — 2026-10-03

Historical documents and completed local tools/evidence were moved into `archive/retired/`; current source, tests, tool scripts, configuration, attribution baseline and all Release snapshots retain their locations. Before link adjustments, all 604 relocated files matched their pre-move SHA-256. Subsequent checks confirmed all 592 relocated local files and 327 protected files remain byte-identical. The 11 relocated Markdown files changed relative link targets only; the acceptance screenshot is unchanged. The selective Git ignore rules expose curated archival documentation while retaining private artifacts and the relocation manifest as ignored local data.

All 128 local links/anchors across 25 public Markdown files passed. `npm run verify` passed typecheck, architecture, 626 functional assertions, 18 architecture assertions, 40 non-entry import-purity checks, deterministic build, syntax and temporary packaging/checksums. The initial sandboxed attempt failed because esbuild could not read an ancestor directory; the same command passed with appropriate permissions and no tool/runtime edits. `git diff --check` passed. This is an automated layout regression record, not a new security scan or Chrome/Tampermonkey acceptance. The published v2.1.7 userscript and immutable packaged reports are unchanged.

## Root-document consolidation verification — 2026-10-03

Five active documents were consolidated under `docs/`, and the upstream checksum list moved to `baseline/SHA256SUMS.txt` without changing its contents. Root Markdown files are now README, AGENTS and SECURITY. Packaging retains its versioned output names and reads changelog/report from their new locations. The archive index's accidentally concatenated duplicate project-context block was removed; the authoritative project context remains in `docs/PROJECT_CONTEXT.md`.

All 129 local links/anchors across 25 public Markdown files passed. Baseline checksum validation and `git diff --check` passed. `npm run verify` completed with the same 626 functional/18 architecture assertions and 40-module import-purity coverage, plus deterministic build, syntax and temporary packaging/checksum validation. All source, tests, released artifacts and archived raw evidence remain unchanged; the packaging script changes only its two document input paths. The rebuilt userscript SHA-256 remains the published hash recorded above. No new security scan or real-browser acceptance is claimed.

---

# Historical modularization verification — before release

> This is the 2026-10-02 pre-release record. Its then-current v2.1.6 metadata and unpublished status were superseded by the v2.1.7 publication section above; the original evidence is retained.

## Scope and completed stages

Verified on 2026-10-02 against baseline `307f9a6f38b5a559e05e32c50c5b3f8ca1636257`. This working-tree refactor completes the four-stage modularization plan. The configured version remains **v2.1.6**; no release was published and existing `Release/` artifacts were not changed. Pre-existing `PROJECT_CONTEXT.md` and CDN/Chrome documents were preserved.

1. Split the original test program into independent suites, made domain URL resolution accept an explicit base URL, and replaced import-pattern checks with TypeScript AST dependency/ownership rules and import-purity tests.
2. Added navigation, scheduler and play-intent ports; centralized application settings/reset/fallback orchestration and typed UI commands; moved measurement metadata into its own state store and playurl registration/epoch handling into an application controller.
3. Extracted pure route eligibility/output planning, independent Fetch/XHR hooks with a shared send-time policy context, and the shared bounded Range probe adapter. Route affinity, active probe initiation and player reload remain owned by their respective controllers; retained signed URLs remain in `SignedRouteVault`.
4. Added explicit readonly snapshots and minimum controller interfaces, removed dependency-bypassing `as never` casts, and verified isolated suite state and resource cleanup. Settings schema/defaults, Catalog hosts, UI capabilities and diagnostic field meanings are preserved.

## Contract reproduction and automated results

Failure-first contracts reproduced browser-global-dependent domain classification, a disposed lifecycle applying queued page data, already-aborted/mid-read-aborted probe behavior, and a stale startup waiter writing measurement metadata after reset. The corresponding runtime fixes pass. The original **556 assertions** remain covered in seven extracted behavioral suites; four new suites add **70 assertions**, for **626 functional assertions** total.

| Verification | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run architecture` | Passed: 41 runtime modules, AST layer/ownership rules and no cycles |
| `npm test` | Passed: 626 functional assertions, 18 architecture assertions and import-purity checks for all 40 non-entry modules |
| `npm run verify` | Passed: all preceding gates, deterministic double build, JavaScript syntax, v2-only bundle and package/checksum validation |
| `git diff --check` | Passed |

Every suite runs in a separate process and restores its owned globals, hooks, subscriptions and timers in `finally`. Regression coverage includes Catalog-only/Native/comparison/disabled modes, settings synchronization, SPA/trusted promotion, generation and setting races, video/audio isolation, Catalog 403, Fetch single-reader/cancellation/Request normalization, and XHR text/json/reuse/timeout/abort/send-time checks. Verification packages into a temporary `dist/verify-package-*` directory and checks cleanup containment, so running `verify` does not overwrite a published release. Explicit `npm run package` retains its release-writing behavior.

## Final security diff scan

Codex Security scan `650fe466-dc70-4427-be60-b8da85b84e0b` completed and sealed the immutable final source diff. The review covered **53 of 53 changed source/config/test items with zero reportable findings**: 28 runtime paths and 25 build/test paths, with supporting authority, restriction, generation, privacy and baseline-extraction tracing. No source changes followed the scan; this verification record was added afterward.

**Canonical coverage-record limitation:** after the final draft was successfully submitted with `completeness: complete` and an empty deferred list, the sealed readback still reports `completeness: partial` and retains the earlier `scripts-tests-review` deferred entry. The same sealed document contains the completed 25-file review surface marked `no_issue_found`, and the workbench reports 53/53 reviews closed. The independent script/test reviewer completed all 25 paths and returned no candidates. This is a discrepancy in the saved coverage record, not an unperformed review; a canonical zero-deferred result is therefore **not claimed**. The supported tool does not permit modifying sealed scans, so the immutable artifacts were preserved and this limitation is recorded explicitly.

Canonical local report: `C:\Users\qwe15\.codex\state\plugins\codex-security\scans\BiliCDN_TW_Codex_Handoff\307f9a6f38b5a559e05e32c50c5b3f8ca1636257_20261002T150214Z_yekz7bna\report.md`.

The scan tool reported **12,472,914 total tokens**, including **11,789,824 cached input tokens**, across four threads (`codex_rollout` accounting). This is the tool's measured accounting, not a billing estimate. Static source review and automated contracts do not establish actual Chrome Network destinations.

## Browser acceptance and delivery

**The user's v2.1.6 Chrome/Tampermonkey acceptance remains passed and closed.** This unreleased refactor has no new browser-acceptance claim and does not reopen the accepted work. If a later release is requested, browser regression evidence should cover that new diff separately. This delivery consists of reviewable working-tree changes and verification records; versioning and publication remain separately arranged.

---

# Historical v2.1.6 test report

## Scope

Predecessor: v2.1.5. This update adds a persisted, default-off option to consider Bilibili-provided Native sources in normal routing. With the option off, script-transformed playurl output and intercepted media dispatch use only safely generated built-in Catalog routes, or block before dispatch if none is legal. The per-tab original comparison mode remains an explicit exception; disabling the script still passes website requests through.

## Contract tests and local verification

On 2026-09-29, `npm run typecheck`, `npm run architecture`, `npm test` (**556 assertions**) and `npm run verify` passed. Verify includes deterministic double build, JavaScript syntax, a v2-only bundle check and package checksum validation; it does not run a security scan. Targeted contracts reproduced concrete failures before their fixes, and the full suite verifies completed behavior. It covers schema-2 defaults, save/sync/reset including a future timestamp across tabs and a delayed settings lock; Catalog-only video/audio choices, output, startup probes, 403 and recovery; preserved backup path/query and same-Host Catalog provenance; opaque, unreplaceable, oversized and non-GET blocking; known PCDN suffixes; Fetch/XHR final destination and redirect observations; page playinfo synchronous handoff, existing values, dynamic getters and unsupported formats; nested Dolby/FLAC audio; mode changes, old player backups including exhausted provenance indexes, SPA generation, in-flight Fetch while disabling the script, XHR partial and stale playurl responses, async results and reused playurl objects across epochs. Native-enabled and per-tab original comparison behavior remain covered separately.

## Security review

Interim Codex Security working-tree diff scan `d3b45965-0037-41aa-b2b9-283d13552e84` identified three low-severity snapshot issues: stale XHR playurl data after SPA, non-monotonic cross-tab reset, and old-object/new-epoch identity reuse. Contracts reproduced them and the source was repaired. A later pre-fix scan `fd6494c2-0a4b-49e4-be68-be8793bbfe44` found that bounded output indexes could omit an emitted external Native backup; a red cap-exhaustion contract led to pruning any output the strict hook could not later recognize. The final post-fix Codex Security diff scan `8e87267d-ecf7-40c8-990b-b9c19ec0b411` covered all 17 changed review items with **zero reportable findings and zero deferred items**. This is source-level review, not real Chrome Network acceptance or proof that browser-owned redirects and unhooked requests use Catalog.

## Chrome/Tampermonkey acceptance

**User approved on 2026-10-01: acceptance passed and is closed.** The user explicitly confirmed that acceptance must not be counted as unfinished work. The coverage limits below remain factual records and do not create pending acceptance, retesting or investigation tasks.

Real Chrome/Tampermonkey acceptance was performed on 2026-09-30 and continued in new user-authorized Chrome tabs on 2026-10-01 (Asia/Taipei), with installed v2.1.6 confirmed. Observed cases cover Catalog-only output/traffic, Native on-to-off synchronization, seek, 720P/2x playback, SPA, fresh fixed Catalog, per-tab original comparison and its exit on reload, whole-script disable/re-enable, settings reset/synchronization, and no-legal-Catalog dispatch blocks with a displayed reason. Two complete fresh-document blocking traces contained zero media requests; an earlier reload interval contained two Native cosov requests whose attribution was not preserved, so that interval remains **unexplained**. Browser coverage did not establish dedicated Fetch/non-GET/opaque cases, active probes, 403/redirect/fallback/core recovery or background/resume; these are recorded coverage limits of the approved acceptance. Chrome reported full version 154.0.8037.58; the tool blocked access to Tampermonkey's version page. Settings were restored to the initial defaults, and one paused test tab was left open. See [archive/retired/docs/CHROME_v2.1.6_ACCEPTANCE.md](CHROME_v2.1.6_ACCEPTANCE.md) for exact counts, limits and the final screenshot. No signed media URLs or HAR exports were retained. This later browser record does not replace the immutable test report packaged with the release.

---

# Historical v2.1.5 test report

## Baseline and scope

Predecessor: published v2.1.4 commit `09f04e82ffaac5276ed220f89d742cbe03ce0ec5`. This update changes fallback attribution and diagnostics only. It does not add Catalog hosts, change route selection or switching timing, increase probe cost, or change the player-core reload threshold.

## Contract reproduction and verification

New contracts were written before their corresponding runtime changes. A fake-clock incident replay covers brief progress inside the old buffer, 11 zero-byte aborts, a separate timeout, a second fallback with matching video `206`, and two progressing player ticks beyond the buffer boundary. The first fallback never claims takeover. Counterexamples cover wrong host or decision, stale epoch or authority, audio, redirect or changed response URL, HTTP `200`, empty `206`, pause, seek, disabled/comparison mode and lifecycle change. Additional cases verify speed-demand labels, report privacy and 96 KiB export under oversized evidence. A red contract also exposed that oversized report pruning attempted to mutate a frozen snapshot; the repaired path is covered.

Final verification on 2026-09-26: `npm run typecheck`, `npm run architecture`, `npm test` (**349 assertions**) and `npm run verify` all passed. Verify includes deterministic double build, syntax, v2-only bundle and package checksum validation. The Codex Security diff scan is separate from `verify`.

## Security review

Final source and test working-tree diff scan `73db4cdb-1f96-4ec4-930a-e4b3b2b5f844` covered all eight changed TypeScript files and completed with **zero reportable security findings**. It checked route identity, transport response URL metadata, diagnostic privacy and bounded output. This static result does not establish browser playback or the absence of every fault.

## Chrome/Tampermonkey acceptance

Post-release acceptance on 2026-09-26 (Asia/Taipei) used a new public Bilibili video tab in Chrome with Tampermonkey. The script's diagnostic report displayed `current.version: "2.1.5"`, confirming that the updated userscript was running. The player showed 1080P high bitrate, AV1 and the user's existing 2x speed. From 01:38:12 to 01:41:26 local time, the same video played continuously for 3 minutes 13 seconds: sampled playback position advanced from 664.9 to 1051.4 seconds, `paused` remained false, and `readyState` remained 4. No black screen was observed at the sampled checks. Chrome Network showed media XHR `206` responses from `upos-hz-mirrorakam.akamaized.net`; the captured Network events do not establish a complete video/audio request inventory or redirect history.

After that video ended, Bilibili automatically opened the next video. In the new video, pause succeeded, a seek moved playback from about 1213 to 261 seconds, playback resumed with `readyState` 4, and a second pause succeeded. The diagnostic report was opened to verify the version before the timed playback; it was not re-inspected after the pause and seek. Chrome and Tampermonkey version numbers were not captured. The user's 2026-09-26 approval formally accepts the observed v2.1.5 normal-playback validation. The transport fault did not recur, so actual black-screen fallback recovery remains **contract-tested, real-browser pending**; no real fallback takeover is claimed.

---

# Historical v2.1.4 test report

## Baseline and scope

Immutable predecessor: v2.1.3 commit `6322c06`. This release addresses three findings from Codex Security scan `cf49b015-ecb4-48d8-91f9-2b61adb709f4`: a Fetch checked/sent destination mismatch, lower-trust Native route contamination, and active probe redirects. It also closes the same Fetch boundary after startup waiting and clears provisional route invalidation when trusted playurl takes authority. CDN ranking, playback speed, Codec selection and measurement budgets are unchanged.

## Automated reproduction and verification

New contract cases first reproduced a provisional invalid-host flag suppressing a newly trusted exact URL, a mutable Fetch URL and method being sent after an SPA generation change, and a prohibited original host being sent from the same stale-generation branch. Each failed before its corresponding runtime fix. The completed suite passes **311** domain/controller/adapter assertions. Existing and new cases cover forged `Request.href`, string/URL/Request input, GET/POST and `init.method`, streaming body, abort and single-reader behavior, hint/API ordering and handle revocation, stale plans/probe results, direct 206 Range acceptance and same-/cross-host redirect rejection.

`npm run typecheck`, `npm run architecture`, `npm test` and `npm run verify` passed on 2026-09-24. Architecture check covered 28 TypeScript modules with no import cycle. Verify includes deterministic double build, syntax, v2-only bundle checks, package equality and SHA-256. It does **not** include Codex Security.

## Security verification

An interim v2.1.4 working-tree diff scan (`724a180d-130a-43a1-9247-5f62d5447a02`) found the startup-wait/SPA branch still dispatched the original mutable Fetch input. That finding was reproduced by a failing contract test and fixed; no release was made from that snapshot. The final Codex Security diff scan (`dc9c0242-05a9-46cf-bc69-feb8136055ab`) reviewed 11 changed source/config/test/release items and completed with **zero reportable findings**. This is a static diff-scan result, not a Chrome Network result.

The three findings from the original scan were checked individually against the current source and passing contracts:

- `csf_593a2c7f450a4906aaf271ca` — **fixed**: enabled Fetch constructs one platform `Request`, reads its URL/method/signal and sends that Request or a rewrite built from it; forged `href`, method override, mutable input after preflight, HTTPDNS and forbidden media cases pass.
- `csf_39f7c70dad56927d52424c3e` — **fixed**: trusted API promotion revokes provisional Native handles, plans, invalid state and authority; later hints and old async results cannot reinstate candidates or update health. Hint/API ordering, cross-key exact URL and stale-result cases pass.
- `csf_f11ae85718c76268b449316e` — **fixed**: startup and healthy probes set `redirect: 'error'`; only a direct, same-host HTTPS `206` response can create a valid sample. Redirect, mismatched-host and absent-response-URL cases pass; failed active probes do not create a playback circuit.

These verdicts establish source-level remediation and preserved ordinary Request/Catalog/probe behavior. Whether Bilibili's real Chrome media entry points follow the tested hooks remains part of post-update acceptance.

## Chrome/Tampermonkey

No current-version Chrome acceptance is claimed. Following the user's requested order, publish first, then the user updates Tampermonkey, then use an extra Chrome tab to compare actual media request URLs, response hosts and redirects with the script's bounded diagnostics. Source-level contract tests cannot prove that every browser media entry point is intercepted.

---

# Historical v2.1.3 test report

## Scope

Only user-facing wording in the control center and player setting panel changed. Internal route, transport, measurement and recovery state machines, the CDN roster, settings values and the machine-readable diagnostic report remain unchanged. The v2.1.2 release artifact is not overwritten.

## Automated verification

On 2026-09-24, `npm run verify` passed: TypeScript typecheck, architecture boundaries, all 264 domain/controller/adapter assertions, deterministic double build, JavaScript syntax, v2-only bundle checks, package equality and SHA-256 validation. The test runner's first sandboxed invocation could not resolve its temporary esbuild entry because Windows denied access to the temporary directory; rerunning the same command with the permitted environment passed all 264 assertions. This was a test-environment failure, not a functional assertion failure.

## Chrome/Tampermonkey

The new wording cannot be inspected in the user's installed Tampermonkey script until v2.1.3 is published and installed. Chrome UI inspection is therefore pending after update; no playback or CDN behavior is claimed to have been verified by this copy-only change. No Code Security scan was run.

---

# Historical v2.1.2 test report

## Baseline and scope

Immutable predecessor: v2.1.1 commit `305244d57119799b94b5971aabc37c1df991a757`; packaged userscript SHA-256 `20414a4e33cc124db7a0b52c60dcfcc104e69de4ad6ecf1cea5a2051421f08f7`.

This release adds host-level playurl-to-segment lineage, stream-specific Catalog incompatibility, fallback after-state correlation and a per-tab original signed-URL comparison mode. It does not change the CDN roster, scoring formula, player speed, Codec preference or measurement budget. No Code Security scan was run.

## Automated reproduction and verification

The added contracts first failed for four concrete gaps: an original backup promoted after a prohibited primary still had the blocked primary's plan; a same-host unrelated decision could impersonate fallback after-state; a later no-alternative recovery left an older fallback looking current; and an exact signed URL with an unrecognized path lost its playurl output lineage. After repair, the suite passes 264 domain/controller/adapter assertions. It also checks actual native Fetch/XHR dispatch, strict prohibited-host handling, Catalog 403 avoidance in later ranking, probe-result isolation, fallback plan versus later request/response, and original mode without preflight or automatic recovery.

Passed on 2026-09-24: `npm run typecheck`, `npm run architecture` (28 TypeScript modules, no import cycles), and `npm test` (264 assertions). `npm run verify` additionally checks deterministic double build, JavaScript syntax, v2 bundle invariants, package equality and SHA-256. The packaged SHA-256 list is the authority for the release artifact.

## Chrome/Tampermonkey evidence and pending acceptance

An additional Chrome test tab on the previously installed script produced actual Network `206` media responses from `upos-sz-mirroraliov.bilivideo.com` and `upos-hz-mirrorakam.akamaized.net` during playback/seek. The event buffer was truncated, so this does **not** prove complete first-request interception, fallback, or v2.1.2 behavior. A later computer-use attempt stopped because the Windows browser URL could not be determined confidently; no further browser action was taken. Only hosts/status were retained, not signed URLs, paths or queries.

Per the user-requested order, formal v2.1.2 Chrome Network acceptance follows push, Release and the user's Tampermonkey update. In an extra tab, compare a newly delivered playurl host and a later segment's actual Chrome Request URL, script RequestId/DecisionId, response host and status; then check a real legal fallback's subsequent request and the per-tab original comparison mode. If no real fallback occurs naturally, report that case as unverified in Chrome rather than fabricate a failure. Browser redirects or non-Fetch/XHR entry points remain a known boundary.

---

# Historical v2.1.1 test report

## Baseline and observed browser evidence

Immutable predecessor: v2.1.0 commit `f62cb5e18974b58e6d9b3d3741beeb4e52c8bb86`; packaged userscript SHA-256 `2403f7021c98b7b4f4b2303a05c5b85bd58c4c677c73ec0db8b3a2124e962137`.

Before the code change, an additional Chrome/Tampermonkey video tab showed the BiliCDN v2 player-panel entry and actual Network media XHR traffic. After a reload, the retained Network events included seven GET media requests to `upos-sz-mirroraliov.bilivideo.com` and `upos-hz-mirrorakam.akamaized.net`, each with a 206 response at the same host. The earliest Network events were evicted (`truncated=true`), so this capture does not establish the first-request/preflight timing. A subsequent seek capture was not truncated: eight GET/XHR requests to those two hosts received 206 responses. All eight URLs had a media suffix and `/upgcxcode/`, so they do **not** reproduce the missing-suffix case. Network alone did not establish video versus audio for each request, and no natural fallback occurred. No HAR, signed URL, path, query or token was saved to the repository or report. This is a limited v2.1.0 baseline, not post-update v2.1.1 acceptance.

## Reproductions and automated verification

New tests first failed on a current-epoch, suffix-less exact signed URL being rejected by the Vault, and on non-GET requests to a prohibited media host reaching the native transport. The repaired suite has 231 passing assertions. New contracts cover exact opaque observation without Native selection or probe, strict host blocking on opaque and non-GET Fetch/XHR, legal exact opaque backups in playurl output, Fetch `Request` dispatch to the chosen host, explicit XHR timeout labeling, partial hook-install rollback, and distinct hook/recognition/native-call/response diagnostic stages. Existing tests cover GET replacement, XHR revalidation at `send()`, abort, reuse, Fetch cancellation and one-reader behavior.

Passed on 2026-09-23: `npm run typecheck`, `npm run architecture`, `npm test` (231 assertions) and `npm run verify`. The verifier completed deterministic double build, JavaScript syntax, v2-only bundle checks, package equality and SHA-256 validation. The packaged SHA list is authoritative. No Code Security scan was run.

## Chrome/Tampermonkey acceptance after update

Publication precedes formal Chrome acceptance per user instruction. After installing v2.1.1, use an extra test tab to compare each script-observed RequestId/DecisionId, method, media kind, original/target/response hosts and status with Chrome Network. During the measured interval, newly dispatched media requests to a prohibited host must be zero; a claimed host rewrite must match the browser's actual Request URL. Repeat first play, seek and a real fallback. If a request remains unmatched, retain only a sanitized initiator classification and continue investigating. Source-level passing tests do not prove coverage of Worker-initiated traffic or browser redirects.

---

# Historical v2.1.0 test report

## Automated scope

Baseline: published v2.0.4 commit `363d527136c876a162d06c78d77e8663ce2a62cc`. New tests first reproduced first-Catalog cold selection, unattributed first-request rewrite, abort-triggered probing, missing no-failure startup rescue and missing bounded deadline; runtime was then changed.

The source-level suite has 206 passing assertions. New contracts cover legal original pass-through before preflight, exact signed backup versus synthesized Catalog URL, measured Catalog victory, low-confidence original fallback, a shared three-second deadline with hanging probes, previously aborted requests starting no probe, current-stream 16 KiB Catalog compatibility, stream-scoped Catalog 403 exclusion, strict blacklist admission, actual Fetch/XHR native dispatch after the gate, XHR abort and explicit-timeout semantics, sequential fair challengers, 15-second no-progress fallback and a single first-start core reload. Existing restriction, Native group isolation, host-lock, disabled, Fetch single-reader/cancel, XHR and incident tests remain included.

Verification commands and reproducible build/checksums are recorded by `npm run verify` and the packaged build manifest. This report does not equate source-level fake transport/player contracts with real Chrome playback. No Code Security scan was run.

## Real Chrome / Tampermonkey

Pending publication and user update, per the requested order. In an additional test tab, compare the first browser media request's true dispatch time and target/response hosts with the preflight's three-second window and result; then check automatic quality, seek, SPA, background return, 2x as a user selection and no healthy-probe-induced switch. A naturally occurring 6006 or dead core is not claimed to have been reproduced in Chrome.

Unsupported entries—including synchronous XHR, XHR with an explicit finite timeout, unknown/unmatched media, Worker-initiated media and URL shapes that cannot be safely rewritten—are not held by preflight; diagnosis must mark them as such. A probe predicts only the sampled URL and interval, not later CDN availability.

---

# Historical v2.0.4 test report

## Current release

Immutable predecessor: v2.0.3 commit `28b1cf57a3c3eaeafc30c282f9f5ec67a8406c0a`, userscript SHA-256 `667476a1a8b04c75437410c35ac15b5d52f568682d7d3934f55e22650507a19d`.

Before changing runtime logic, the new source-level test failed because a default-unavailable Catalog media URL with `os=mcdn` passed unchanged. A separate no-file controller reproduction showed that an audio-blacklisted host remained eligible for ungrouped media. The previous control-center button stored user blacklists as video-only; a regression reproducing an existing stored row failed for audio before the compatibility fix.

The functional suite now has 166 passing assertions. New contracts cover default-unavailable PCDN/live/resource pass-through, unrestricted live preservation, blocked playurl primary/backup, user-wide black against matched audio, ungrouped audio-black eligibility, black/dead special-media rejection, native Fetch/XHR refusal and enable-between-XHR-open/send revalidation. Existing video/audio recovery, Native exact URL, host-lock, disabled mode, cancellation and single-reader tests remain included.

Automated verification passed on 2026-09-22: `npm run typecheck`, `npm run architecture`, `npm test` (166 assertions) and `npm run verify` (deterministic double build, JavaScript syntax, v2 bundle invariants, package equality and checksums). No Code Security scan.

Real Chrome/Tampermonkey v2.0.4 acceptance: pending publication and user update. No current-version playback or absence of black-screen regression is claimed. A userscript cannot retroactively prevent a browser redirect or intercept media initiated outside its playurl and page Fetch/XHR paths; if Bilibili issues those requests, browser network initiator evidence is needed to evaluate coverage.

---

# Historical v2.0.3 test report

## Current release

Immutable predecessor: v2.0.2 commit `7739d5ada141d4d35192dc6ae06693ace25f7d13`, script SHA-256 `d36b1271af5107b14c3820d7afc55ea56ba0ec0f307643b2b1c2471792745ea8`.

The installed v2.0.2 report showed repeated zero-byte Catalog aborts followed by successful Akamai fallbacks in multiple groups. This does not establish why the browser aborted. The same report had playing media but stale pause-armed recovery state.

Before changing runtime logic, separate source-level contracts failed for (1) a new quality retaining its cold Catalog plan after observed Native affinity, and (2) healthy short resume retaining pause-armed. Both now pass.

The suite has 148 passing assertions. Additional checks cover different-quality exact Native URL, no fabricated observed affinity, missing Native capability, explicit fixed mode, and a newly blacklisted affinity host. Existing v2.0.2 restriction, backup, responseHost, incident, playback-rate and cancellation tests remain included.

Passed on 2026-09-21: `npm run verify` completed types, architecture, all 148 assertions, deterministic double build, syntax, package equality and checksums. No Code Security or independent security suite.

Chrome/Tampermonkey acceptance of v2.0.3 is pending user installation. The supplied v2.0.2 report is user runtime evidence, not a v2.0.3 real-browser test. No natural dead-core reproduction is required for publication. Historical black-screen causes remain unconfirmed. See `archive/retired/docs/POST_RELEASE_v2.0.2.md` for the evidence trail.

Deliverables: `Release/v2.0.3/` script, changelog, report, manifest, SHA-256; GitHub Release attaches only the script. No previous release directory is overwritten.

---

# Historical v2.0.2 verification (unchanged scope)

## Baseline and evidence

Immutable baseline: v2.0.1 commit `66f7c36dd3605933342ec0536892753f5bfe8cca`, userscript SHA-256 `ec2be1e39cea70ddfb04241b26b23b7f787d63896bea100bcb5e12cc8d3ef279`.

The submitted report establishes an uninitialized video core and no reload, not a proven connection to prohibited cosov. Recorded successful video was rewritten to mirrorali; the last video terminal was an abort. The root cause of the historical black screen remains unconfirmed.

## Reproductions and functional verification

Before runtime fixes, new assertions reproduced: empty response URL inventing a host, prohibited original retained in playurl backups, a player backup rewritten to primary, paused dead core failing to create an incident, and a challenger selecting default-unavailable cosov.

The complete source-level functional suite now has 140 passing assertions, including:

- Existing evidence/ranking, limits, cancellation, XHR JSON, disabled behavior, rate preservation, core restore and safe measurement contracts.
- Default-unavailable output removal; independent black/dead cases against cached fallback, fixed CDN and playurl output.
- Native XHR open target; restriction added between open and send; single native send; no-alternative XHR/Fetch local blocking; disabled original pass-through.
- Permitted Catalog backup adoption and subsequent group affinity plan; weak query match cannot claim backup role.
- Exact Native audio backup, video-affinity isolation, invalid Native exclusion on request/output and generation cleanup.
- Host-lock cannot restore a dead root; no-alternative player output contains neither prohibited primary nor backups.
- Missing response URL stays null; target-host network failure still opens the appropriate circuit; latest abort does not erase last successful video observation.
- Sustained dead paused core captures evidence without reload; timer gaps and initial startup do not falsely count as continuous prior-healthy death.
- First paused-tick play observer, original return preservation, untrusted calls rejected, trusted long-pause intent while paused, one reload, reset restores owned method.
- Late manual mark and 1,000 subsequent successes preserve the frozen core incident; 128 KiB recorder and 96 KiB report checks.

These are source-level fake-player/transport contracts, not real Chrome playback. Passing assertions are not claimed to exhaust all browser-specific URL or player lifecycle variants.

## Release verification

Passed on 2026-09-21: `npm run verify` completed all 140 assertions, strict types, architecture, deterministic build, syntax, bundle/package and checksum checks with Node 26.8.1, TypeScript 7.0.2 and esbuild 0.28.2.

Run `npm run verify` for strict TypeScript, architecture/cycles, all functional assertions, deterministic double build, JavaScript syntax, bundle invariants, package equality and SHA-256. The release checksum list is authoritative. No Code Security scan or independent security suite is run.

## Real Chrome / Tampermonkey: pending after installation

Per user instruction, publish first, then perform targeted acceptance after the user updates. No preserved failed/paused tab was operated during this code repair. No v2.0.2 Chrome pass is claimed here.

Use an additional tab: compare native outbound/response hosts with the report; check legal backup behavior, prohibited-host absence, fixed/automatic mode, user-selected speed, one seek/quality/SPA/background-return sequence, and incident marking. Natural dead-core reproduction is not a publication gate. Do not infer consumed media or a black-screen cause solely from a route plan or host label.

## Deliverables

`Release/v2.0.2/`: userscript, CHANGELOG, TEST_REPORT, manifest and SHA-256 list. GitHub Release attaches only `BiliCDN_TW.user.js`. Existing v2 storage is preserved; no history patches, CI, remote code or telemetry are added.
