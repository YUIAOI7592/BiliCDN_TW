# v2.0.3 Chrome acceptance — targeted pass completed

> **Historical acceptance record: targeted v2.0.3 pass.** The observations and evidence limits below are specific to this test session and do not establish browser acceptance for later versions or create current tasks. See the [documentation index](../../../docs/INDEX.md) for current version and verification records.

Date: 2026-09-22 Asia/Taipei. Installed version verified as 2.0.3 in the
control-center diagnostic textarea. Only an additional agent-created video tab
was operated; the user's existing homepage and unrelated tab were untouched.

## Direct observations

- Actual video element: 3840x2160, 2x, readyState 4, currentTime advancing.
- Player panel displayed Akamai and approximately 36.5 seconds playable buffer.
- Browser resource timing independently contains Akamai XHRs. Its retained
  entries end early in playback; zero transferSize does not prove zero wire bytes.
- Manual 4K to 720p selection took effect: videoHeight 720, readyState 4,
  playbackRate 2, time progressed from 189.24 to 206.16 seconds.
- A several-minute test pause resumed successfully at approximately 92 seconds,
  readyState 4, 2160p and 2x. No dead-core fault was induced or established.
- Control-center button works when the visible More Playback Settings subpanel
  is opened. Initial automation targeted an inactive subpanel with opacity 0 and
  pointer-events none. This is not evidence of a broken button.

## Test interference and limitations

During UI targeting, the script was temporarily disabled and then restored to
enabled using its control center. Generation ultimately became 5 and route observations
were cleared. Subsequent no-attribution state cannot be compared to the earlier
generation as if it were a spontaneous runtime failure.

CDP network event history was truncated; the subsequent capture returned no
new media events. Thus route continuity during the 4K-to-720p transition is NOT
yet verified. Playback snapshots do not prove there were no stalls between them.

## Subsequent uninterrupted enabled-state observations

- Selected 1.5x through the player UI. Playback advanced from 23.08 through
  161.91 seconds with actual and diagnostic rates remaining 1.5x; not forced to 2x.
- The diagnostic report at 2026-09-21T18:09:50.817Z showed generation 5,
  matched 720p/AV1, healthy core, and successful video/audio HTTP 206 responses.
  Both requests originally targeted excluded cosov; the request interceptor sent
  their exact Native Akamai alternatives and recorded Akamai response hosts.
  Ranking rejected cosov both as catalog-generated and root-original.
- Restored automatic quality; it rose to 2160p. A progress-bar seek reached
  156.18 seconds, then playback resumed at 1.5x. Captured browser Network events
  independently showed Akamai media requests and HTTP 206 responses.
- Opened an additional blank tab for background playback and subsequently closed
  it. Video time advanced from 163.95 to 238.43 seconds, readyState remained 4,
  resolution 2160p, rate 1.5x. The captured interval included seven Akamai 206
  responses. This is tab-background evidence, not OS-minimization evidence.
- Restored the original 2x rate and automatic quality.

## Actual transport failure and recovery

Temporarily selected fixed mirroraliov through the control center, then replayed.
Browser Network events confirmed actual mirroraliov requests and 206 responses.
This also produced a genuine video timeout, not a fabricated fault:

1. `decision-28` selected fixed mirroraliov for video; `decision-29` for audio.
2. Video `request-860` successfully received 206 from mirroraliov.
3. Video `request-868` timed out after 5003 ms, with 943164 observed bytes and no
   terminal response host. The failure was matched to the current generation/epoch.
4. `decision-30` / `recovery-1` committed Native Akamai fallback.
5. `request-879` received Akamai 206 about 2.01 seconds after the timeout.
6. Core status became recovered; `reloadCount=0`. Subsequent playback was healthy
   with approximately 35 seconds playable buffer. Audio stayed on mirroraliov.

The frozen incident retained this chain with Verbose off. Fixed configuration
did not force the failed video host back over its circuit; audio was isolated.
This is evidence for this recovery path, not proof of every historic black-screen
cause or of successful dead-core reload. Fixed mode was restored to automatic.

## SPA and final state

Clicked a related video in the same test tab. URL/title changed while
`performance.timeOrigin` remained 1790013433459, confirming same-document SPA.
The new video played at 1080p/2x, readyState 4. The control center rebuilt and
showed matched video/audio Akamai 206 responses and 1080p/AVC attribution.
An earlier unclassified media observation remained explicitly waiting-data;
it did not prevent current video/audio attribution.

Final settings: script enabled, automatic CDN, automatic quality, 2x; no catalog
overrides or manual blacklist entries added, and no learning data cleared.

## Scope and limitations

Network event capture reported truncation, so absence of forbidden hosts is only
established for captured media events, not an exhaustive all-request trace.
The initial manual 4K-to-720p interval remains incomplete network evidence; the
later 720p-to-auto-4K observation retained Akamai in browser and diagnostics.
No OS-minimization, deliberate dead-core fault, or exhaustive black/dead matrix
was performed in Chrome. These are not claimed as browser passes. A few playback
snapshots alone do not establish uninterrupted smoothness between observations.

Basic screenshot output lagged the live UI during automation. Later inspection
used the advanced browser screenshot and read-only CDP access to the displayed
closed-shadow diagnostic textarea. UI targeting mistakes are documented above,
not treated as application failures.

No runtime code was changed, no release asset was replaced, and no security scan
ran. No new reproducible script defect requiring a patch was established in this
targeted acceptance pass.
