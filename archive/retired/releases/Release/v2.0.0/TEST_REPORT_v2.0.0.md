# BiliCDN_TW v2.0.0 test report

## Scope

This report separates automated source-level verification from real Chrome/Tampermonkey playback. v1.9.6 is used only as a behavioral oracle for non-regression invariants; v2 does not compare its CDN ranking result with v1.

## Automated verification

Passed on 2026-09-21 with Node.js 26.8.1, npm 11.19.0, TypeScript 7.0.2 and esbuild 0.28.2:

- strict TypeScript typecheck: passed with zero errors;
- architecture direction and cycle check: passed for 28 TypeScript modules, zero cycles;
- domain, controller and adapter contract suite: 65 assertions passed, including bounded route summaries and oversized diagnostic reports retaining the current state and incident cause;
- 1,000-success diagnostic capacity and frozen-incident retention: passed;
- deterministic double build: identical userscript and manifest;
- generated JavaScript syntax check: passed;
- v2-only storage namespace and no Worker interception markers: passed;
- release package checksum verification: passed.

The generated userscript SHA-256 is recorded in `Release/v2.0.0/SHA256SUMS_v2.0.0.txt`; the release checksum file is authoritative after subsequent edits.

Functional contracts include candidate restrictions and ranking, evidence windows and circuits, opaque current-epoch Native routes, cross-tab store replacement, host-lock restoration, Fetch single-reader cancellation, XHR JSON, HTTPDNS policy, disabled pass-through, website Worker identity, player-core recovery and safe single-challenger measurement.

## Real Chrome＋Tampermonkey

The user installed an earlier v2.0.0 bundle in Chrome. On 2026-09-21, an agent-created video tab and a second independent video tab were observed; the user's existing paused video page was not touched. The first browser bundle predated the diagnostic-size fix above. The user subsequently installed the rebuilt bundle and the diagnostic behavior was retested in separate agent-created tabs.

- The first test video played at 1920×1080, 2x, `readyState=4`, with roughly 70 seconds buffered ahead; its playback time continued to advance. A seek to the middle of the video recovered at 2x with buffered video.
- Choosing the next video in the site's playlist navigated the same tab through SPA. The new video reached 1920×1080, 2x, `readyState=4`, and continued playback.
- A second video tab reached 1920×1080, 2x, `readyState=4`, with roughly 70 seconds buffered ahead. The first tab's playback time advanced while the second tab was in use. The userscript masks `document.hidden`, so this is not proof of every background or minimized-window case.
- On the second video, manual 1080p→720p produced a 1280×720 video without stopping playback; restoring automatic quality returned to 1920×1080, still at 2x with `readyState=4` and buffered video. That video offered no 4K option.
- Pausing the second video for approximately 30 seconds and resuming it through the site's play button preserved position and 2x playback. The video continued to progress; a dead core was not reproduced, and the recovery path itself was not exercised.
- The first installed bundle's diagnostic report exceeded its 96 KiB budget and collapsed `current` to `{ "truncated": true }`, losing active player/route context despite healthy playback. This was a genuine diagnostic defect. Source and automated tests were changed to bound route plans and retain essential current/incident data under truncation; the rebuilt bundle was then retested as described below.

### Rebuilt bundle, user-installed Chrome retest

- The control-center opener in the player's settings menu worked by an actual pointer click. Opening diagnostics showed `current.session`, route affinity, and `current.monitor.video`; route ranking and incident/counter sections remained present farther down the report. The report still marked `truncated: true`, but it no longer collapsed the entire current state. The browser clipboard interface returned no text from the copy control, so exact byte count and full JSON parsing were not available from this UI observation.
- While the diagnostic modal was open, the first video continued at 1920×1080, 2x, `readyState=4`, with about 70 seconds buffered ahead.
- After a 35-second pause, the same video resumed from its prior position at 1080p/2x, `readyState=4`. This was a healthy resume, not a reproduction of a dead core.
- A second simultaneously playing tab reached 1080p/2x with over 70 seconds buffered. The first tab's playback time advanced while the second was in use. `document.visibilityState` remained `visible` because the userscript masks it; minimized-window behavior remains unproven.
- Selecting the next playlist video in the second tab caused a transient site message, “無法播放媒體,” during SPA transition. The new URL then loaded, `readyState=4`, and playback began at 2x. This transient should not be treated as a permanent failure, but the transition deserves longer observation.
- On that new video, seeking from about 165 seconds to about 1008 seconds briefly produced `readyState=1` and no buffered range. The player then returned to `readyState=4`, kept 2x playback, and rebuilt more than 50 seconds of forward buffer; no permanent stall was observed.
- On the rebuilt bundle, manually switching the new video from 1080p to 720p reached 1280×720 at 2x and `readyState=4`; selecting automatic quality then returned to 1920×1080 with about 70 seconds buffered. This tests a user-initiated quality transition, not network-driven automatic downshift.

Remaining scenarios before a release claim:

- first playback with no active startup measurement;
- 4K, AV1／HEVC, and longer automatic quality transitions under changing network conditions;
- 分P, minimized playback and full background lifecycle;
- dead-core recovery after a long pause;
- cross-tab evidence updates (two-tab playback alone does not prove storage synchronization);
- at least ten minutes of healthy playback without an exploration-driven host switch;
- exact report byte count and independent confirmation that control-center browsing creates no network activity;
- a longer SPA transition trace to determine whether the transient media error is solely a site loading state.

Only the scenarios described above are claimed as observed in Chrome; the remaining release gates are not claimed as passed.

## Code Security

Not run, per user instruction. This report does not substitute ordinary functional tests with a security scan.
