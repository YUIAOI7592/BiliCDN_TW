# v2.1.6 Chrome acceptance — user approved

> **Historical acceptance record: v2.1.6, passed and closed.** The approval below applies to v2.1.6 and does not establish browser acceptance for v2.1.7 or later versions. See the [documentation index](../../../docs/INDEX.md) for current version and verification records.

Dates: 2026-09-30 and 2026-10-01, Asia/Taipei. This records real Chrome/Tampermonkey observations from additional agent-created Bilibili video tabs. The user's existing tabs were not navigated. No mock, VM or contract result is counted as a browser pass.

**Acceptance status: approved by the user on 2026-10-01.** The user confirmed that acceptance has passed and must not be counted as unfinished work. Acceptance is closed; the observations and evidence limits below are retained as the factual test record, without creating follow-up testing or investigation tasks.

## Environment and initial settings

- The control-center diagnostic report confirmed installed script version **2.1.6** in both test tabs.
- Chrome's page user agent reported `Chrome/154.0.0.0` on Windows. On October 1, User-Agent Client Hints reported Google Chrome/Chromium **154.0.8037.58**. Tampermonkey's extension version was not captured: the browser tool rejected `chrome://extensions/` because it permits only HTTP/HTTPS. No alternate route around that restriction was attempted.
- Initial script settings: enabled, automatic CDN, `considerNativeSources: false`, empty Catalog overrides, AV1 preference, WebRTC and HTTPDNS blocking enabled, Verbose off. Per-tab original comparison was off.
- Initial playback was 1920×1080 at 2x. Manual 720P selection later produced an actual 1280×720 video at 2x.
- Network evidence came from Chrome DevTools Protocol request/response events, independently of the userscript's diagnostic report. Only hostnames, status, method, media-kind hints, redirect flags and aggregate counts are retained here. No signed URL, path, query, token, cookie, IP or HAR was saved.

## Observed results

| Case | Evidence | Assessment |
| --- | --- | --- |
| Native sources off after reload | The delivered page playinfo contained Catalog-only primary and backup hosts across 15 video and 3 audio representations. Captured media requests used `upos-tf-all-tx.bilivideo.com` and `upos-sz-mirroraliov.bilivideo.com`, with 206 responses. | Pass for inspected output and captured traffic. The longer initial Network interval was truncated, so it is not an exhaustive first-request trace. |
| Off, short seek interval | An untruncated interval contained 39 media requests, all to `upos-tf-all-tx.bilivideo.com`, all with 206 responses and no observed redirect. | Pass for this captured interval. Media-kind hints include video and audio; the page also loaded recommendation previews during some actions. |
| Quality and playback | The player selected 720P; actual dimensions subsequently became 1280×720, readyState 4, 2x, with time advancing. Pause and resume both worked. | Playback pass at sampled checks. The extended quality-change Network interval was truncated. |
| SPA navigation with sources off | Same-tab navigation changed the video while `performance.timeOrigin` remained unchanged. The new main video played at 720P/2x, readyState 4. Captured media requests used Catalog `mirroraliov`, with 206 responses. | SPA playback pass; captured traffic is limited by truncation. A hovered recommendation briefly created another video element and affected diagnostic representation selection, so that preview is not treated as the main video's codec evidence. |
| Native sources on and cross-tab persistence | Enabling the switch in the first tab was confirmed as `true` in the second tab's fresh diagnostic report. Its matched video and audio routes were `native-signed` Akamai with 206 responses. An untruncated 8-second Network interval contained 7 media requests to Akamai and Catalog `mirrorali`, all 206, without redirects. | Pass for synchronization and preserved Native routing in the observed interval. |
| Turn sources off while a player already has Native URLs | The second tab observed the synchronized off setting without reload and selected a Catalog affinity. An untruncated 10-second interval contained 8 media requests, all to Catalog `mirrorali`, all 206, without redirects. | Pass for subsequent captured dispatches after the switch. This does not claim to cancel previously dispatched website requests. |
| Verified seek after turning sources off | Main playback moved from 664.7 to 848.2 seconds, then advanced to 856.9 seconds with readyState 4. An untruncated 5-second interval contained 18 Catalog `mirrorali` media requests, 17 observed 206 responses and one still pending, with no redirect. | Pass for this seek and subsequent Catalog-only traffic. |
| Fixed Catalog on a fresh reload | Fixed `mirroraliov` was confirmed in settings. Fresh matched video and audio observations both used Catalog-generated `mirroraliov` and received 206. The untruncated reload interval contained 33 media requests to `mirrorali` and `mirroraliov`, with 29 observed 206 responses and two canceled requests. | Fresh fixed-route behavior confirmed by matched observations. The interval includes traffic around document replacement, so its other host is not assigned to the new main representation. Changing fixed settings in an already playing document initially retained the healthy `mirrorali` route; immediate fixed takeover is not claimed. |
| No legal Catalog | All 11 Catalog checkboxes were observed unchecked, with Native sources off and automatic CDN. A subsequent 8-second Network interval captured zero new media requests. The player no longer exposed the injected settings entry, so a fresh structured blocking diagnostic could not be collected. | Partial evidence from September 30. Fresh-document blocking and its diagnostic reason were subsequently confirmed in the October 1 observations below. |

The real player used XHR media requests with an explicit timeout. Its startup diagnostic reported `preflight-skipped:xhr-explicit-timeout`; this run does not claim a real startup probe pass. A manual measurement action reported no candidate needing a test, so it does not establish active Catalog-only probe traffic. No Catalog 403, browser redirect or natural recovery incident was established.

Diagnostic report text is a snapshot when opened. A report left open during a settings change was stale; its earlier values were not treated as live synchronization evidence. Initial raw-CDP timeline clicks did not establish a seek. The verified seek above used the browser's supported coordinate click and explicit before/after playback observations.

## October 1 continuation

The user explicitly requested a new Chrome test tab. The Chrome extension provider opened the known Bilibili video URL successfully. The native Windows helper was not reused. Two early test tabs subsequently became unavailable; fresh agent-created tabs were used, and the user's open anime and Bilibili tabs were left alone.

| Case | Evidence | Assessment |
| --- | --- | --- |
| Restore defaults and persistence | Reset produced empty `catalogOverrides`, Native off, automatic CDN, enabled script, AV1, WebRTC/HTTPDNS blocking on and Verbose off. Fresh reports in other test tabs confirmed these settings. | Pass for the observed reset and persistence. |
| Original comparison with persistent Native off | The comparison checkbox was on while the persistent Native checkbox remained off. SPA navigation retained `timeOrigin`. From 05:26:29 to 05:26:38, an untruncated trace contained 48 Akamai media GET requests: 47 observed 206 responses and one pending, without redirects. Main playback reached 16.5 seconds at 720P/2x, readyState 4. The control center showed comparison mode and disabled measurement; recovery reload count was zero. | Pass for the observed comparison exception. Recommendation previews were also present; path-based audio/video hints do not establish an exact main-representation inventory. |
| Full reload exits comparison | An untruncated 10-second reload trace contained 42 Catalog requests: video hints to `tf-all-tx`, audio hints to `mirroraliov`; 39 observed 206 responses, two canceled requests and one pending. A fresh report confirmed comparison off and matched Catalog-generated video/audio routes. | Pass for reset on reload and observed Catalog routing. |
| Whole-script disable | With Native still off, disabling the script and reloading produced 43 GET media requests in an untruncated 10-second trace: Akamai video hints and default-unavailable `cosov` audio hints, 41 observed 206 responses and two canceled requests. Playback advanced at 720P/2x, readyState 4. Fresh diagnostics showed disabled mode, zero recognized-media count and zero blocks. | Pass for the observed website pass-through. |
| Re-enable with existing Native player URLs | Without reloading, re-enabling the script produced seven subsequent media GET requests in an untruncated six-second trace, all to Catalog `tf-all-tx`, all 206, without redirects. | Pass for the captured dispatches after re-enable. |
| No legal Catalog, current player | All 11 Catalog checkboxes were observed off, with Native/comparison off. An untruncated eight-second trace contained zero new media requests. Fresh diagnostics recorded eight blocks, `lastBlocked.reason: catalog-unavailable`; the overview displayed “沒有合法的內建 CDN” and “沒有送給瀏覽器”. | Pass for the observed dispatch blocks and displayed reason. |
| No legal Catalog, fresh document | An initial 10-second reload interval contained two `cosov` media GET requests with 206 responses while the main video remained at zero/readyState 0. Their document/initiator attribution was not retained before the event buffer expired. A subsequent complete 11-second reload trace, including frame/loader metadata, contained zero media requests. A separate complete 10-second homepage-to-new-video navigation trace also contained zero media requests. Both new main videos remained at zero, paused, readyState 0, with no decoded dimensions. | Controlled fresh-document blocking confirmed by the latter two traces. The initial two Native requests remain unexplained; they are retained as an acceptance limitation and are not counted as a pass or an established hook bypass. |
| Final normal playback | After restoring defaults, an untruncated 10-second reload trace contained 45 Catalog requests to `mirrorali`/`mirroraliov`: 43 observed 206 responses and two canceled requests, without redirects. Matched diagnostics confirmed Catalog-generated video/audio. Main time advanced from 490.1 to 776.2 seconds, at 720P/2x, readyState 4, no media error; the watchdog and recovery were healthy at sampled checks. | Pass for observed playback and captured traffic. |
| Manual measurement | A final manual request reported `no-stale-candidate`. Its untruncated eight-second trace contained six Catalog XHR requests, all 206, without redirects; no active Fetch probe was established. | Measurement scheduling observed; active probe behavior remains contract evidence only. |

## Temporary settings and restoration

The test temporarily enabled Native sources, selected fixed `mirroraliov`, then disabled the seven normally available Catalog hosts. Before browser access was blocked, the first tab's control-center UI verified each of those seven hosts checked again; the four default-unavailable hosts remained unchecked. Fixed mode had been changed back to automatic, Native sources were off, and original comparison had not been enabled.

On October 1, the settings-only reset restored the original empty override object. After the final blocking test, three fresh reports confirmed the same restored settings and `updatedAt: 1790804321065`, with comparison off. No measurement, blacklist or incident data was cleared through the control center. No runtime code or release asset was changed.

The final test video was paused at 855.2 seconds, readyState 4, 1280×720, 2x, with no media error. Extra test tabs were closed. One paused test tab remains open with the restored settings visible. See [final settings screenshot](evidence/CHROME_v2.1.6_FINAL_SETTINGS_2026-10-01.jpg).

## Historical access blocker

The native Windows Computer Use helper stopped because it could not reliably determine Chrome's current URL. A later reload through the already bound browser tab was rejected by automatic approval review, which stated that the Chrome URL safety prerequisite was still unresolved. Browser actions stopped after that rejection. The user was asked to foreground a Bilibili Chrome tab, verify the `https://www.bilibili.com` address, and authorize continuation.

The user authorized continuation and foregrounded the test video. A fresh native application inventory then reported the expected Bilibili video window title, but native state capture again stopped with the same URL-confidence guard. No browser input followed that second stop. Foregrounding the requested page did not resolve the tool prerequisite at that time. Later new-tab observations and the user's acceptance approval supersede that pending status.

An automatic goal continuation rechecked the live native Chrome window and attempted only a read-only address-bar observation. State capture stopped with the same URL-confidence guard for a third consecutive goal turn. The goal was marked **blocked** at that time. Later user-authorized new tabs enabled the October 1 observations above; the user has now approved acceptance.

A later resumed goal run started a fresh blocked audit. All three consecutive resumed turns checked the live Chrome window through the native helper; each read-only state capture stopped with the same URL-confidence guard. No website input or new acceptance result was produced. The goal was marked **blocked** again after the third check. That historical blocker preceded the October 1 continuation and the user's acceptance approval.

## Recorded evidence limits — acceptance closed

- The two Native requests in the first October 1 blocking reload remain unattributed. Later controlled traces did not reproduce them. No universal first-dispatch guarantee is inferred from those traces.
- Dedicated real Fetch, non-GET/opaque/unreplaceable media, active startup/health probes, Catalog 403, redirect refusal/observation and natural fallback/core recovery were not established. Existing contracts remain automated evidence only.
- A genuine hidden-to-visible background/resume interval was not confirmed. Read-only samples from the concurrent test tabs all reported `visibilityState: visible`; those samples are not counted as background coverage.
- Tampermonkey's exact version remains unavailable under the browser tool's URL policy.

The user-approved acceptance is complete. The recorded browser coverage is limited to the observations above, including the unexplained initial traffic. Automated checks, static security review, browser observations and the user's acceptance decision remain distinct records. These evidence limits are not outstanding tasks.
