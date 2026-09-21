# v2.0.2 post-release findings — 2026-09-21

## Evidence and limits

The user-installed v2.0.2 report generated at 14:37:55 UTC records successful
video and audio responses from Akamai (206), with matched representation and
19.576 seconds of playable buffer. `sourceHost=mirrorcosov` is the candidate
origin, not the outbound target. No cosov outbound request appears in this report.
This snapshot does not prove the absence of earlier stalls.

Four Catalog mirrorali video requests were aborted after approximately
2050–2055 ms with zero bytes. Several video groups subsequently acquired their
own Akamai player-fallback plan. Abort alone does not prove network timeout or
justify penalizing a host.

The monitor reports playing while recovery still reports `pause-armed`.

## Source-level reproduction

Two qualities are planned before playback. After two successful observations
confirm the first quality's Native fallback, first use of the second quality
still uses its old Catalog startup plan. The new contract test failed with
Catalog output instead of that second quality's exact Native URL.

A separate normal short-pause/resume contract failed with `pause-armed` instead
of `healthy`. Neither reproduction changes or injects faults into a real browser.

## Working-tree repair

- Record which current-epoch representation plans have actually been requested.
- On first video-group use, resolve the confirmed video affinity against that
  group's current capabilities before using a cold preplanned route.
- Preserve explicit player backup selection and already-requested group plans.
- No Native URL synthesis, audio affinity changes, new probes or abort penalties.
- Clear the stale pause summary after a healthy short resume without creating a
  recovery token or adding a reload.

148 functional assertions passed after these changes. Tests cover the exact
different-quality URL, missing Native capability, fixed mode, newly restricted
affinity and no fabricated affinity observation. Final release verification is
recorded separately in the current TEST_REPORT and command output.

## Release / Chrome status

Published v2.0.2 remains immutable. These changes are assigned to v2.0.3 and
are not in the user's installed v2.0.2 userscript.
Full targeted Chrome acceptance is incomplete; seeing an extra test tab at the
video end is not evidence that the whole interval was stall-free. Do not mark
the active goal complete on this evidence. Preserve the user's original tab.

Next: complete negative-path checks and final release verification under a new
version, publish the successor, then perform the remaining targeted acceptance
after installation. Do not overwrite Release/v2.0.2 or its GitHub asset.
