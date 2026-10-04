# Development

This is the maintained workflow for the **v2.1.8 release candidate**, including the MP4/FLV correction. The configured version is 2.1.8; security review and publication confirmation are pending, and v2.1.7 remains the latest published bundle. See the [documentation index](INDEX.md), [architecture](ARCHITECTURE.md), [repository guide](../AGENTS.md) and [security policy](../SECURITY.md). Revision-specific test and browser results belong in the [test report](TEST_REPORT.md) and dated acceptance records, not in this command reference.

## Repository layout and archive maintenance

| Location | Purpose |
| --- | --- |
| `src-v2/`, `tests-v2/`, `scripts/` | Current source, contracts and npm build/test tooling |
| Repository root | README, AGENTS, SECURITY, LICENSE and required npm/build configuration |
| `docs/` | All other current guides, work status, changelog, verification report and the document index |
| `dist/`, `node_modules/` | Generated build output and installed development dependencies |
| `Release/`, `baseline/` | Preserved release artifacts and upstream attribution evidence; checksum list at `baseline/SHA256SUMS.txt` |
| `archive/retired/docs/` | Historical plans, acceptance/research records and their supporting `evidence/` |
| `archive/retired/local/` | Private local history grouped under `development`, `review`, `security`, `src`, `scripts` and `work` |

The [archive guide](../archive/retired/README.md) records the retired layout; the [documentation index](INDEX.md) links current guides and historical records. Existing `archive/pre-upstream-*` history remains separate. Root configuration, source/test inputs and tool locations stay unchanged. Packaging reads `docs/CHANGELOG.md` and `docs/TEST_REPORT.md`; it retains the existing versioned output names. The baseline checksum list retains repository-root-relative paths, so verify it from the repository root. Archived v1 helpers and local work artifacts are outside the current npm commands; their embedded paths and commands describe the original environment.

Keep active guidance in `docs/`; root documents serve the repository landing page, automatically discovered development instructions, security policy and license. Place completed historical documents and their supporting evidence together under `archive/retired/docs/`, retaining their dates, versions and observed limits. Keep private scan/review/work artifacts under `archive/retired/local/`; archiving does not authorize publishing them. Before moving additional files, check current imports, scripts, links and executable locations. Record old-to-new paths and update maintained links/index entries while preserving sealed evidence, checksums and published release contents.

## Prerequisites

- Node.js 26.8.1
- npm 11.19.0
- TypeScript 7.0.2 and esbuild 0.28.2 (locked development dependencies)
- Google Chrome and Tampermonkey for real-browser validation

Provision Node/npm, then run `npm ci` from the repository root to install the development dependencies locked in [package-lock.json](../package-lock.json). [release.json](../release.json) records the release tool versions. `verify` checks the exact running Node version, and `build` checks the exact esbuild version. The build manifest records npm/TypeScript versions from configuration; it does not independently verify the running npm/compiler version. [package.json](../package.json) has no runtime dependencies.

## Commands

```powershell
npm run typecheck     # strict TypeScript, no emit
npm run architecture  # source AST dependency graph and listed ownership syntax rules
npm test              # all independent contract suites + architecture/import-purity tests
npm test -- adapters  # one isolated suite (see tests-v2/run.ts)
npm run build         # deterministic single-IIFE userscript
npm run package       # rebuild dist and write the configured Release/v<version>/
npm run verify        # automated checks and temporary packaging verification
```

Run commands from the repository root. `typecheck` uses the strict options in [tsconfig.json](../tsconfig.json) for both source and tests. `architecture` inspects production modules; the separate `npm test -- architecture` exercises the guard's own fixtures. See [architecture check scope](ARCHITECTURE.md#dependency-direction) before treating these checks as proof of an invariant.

[verify.mjs](../scripts/verify.mjs) checks the configured Node version, typecheck, source architecture, all tests, identical output/manifests from two builds, JavaScript syntax, a specific list of legacy/Worker markers, required storage markers and packaged SHA-256 checksums. Its packaging step performs another build. The command writes `dist/`, packages into a fresh `dist/verify-package-*` directory, and removes that directory after checking its resolved location and prefix. It does not write `Release/v<version>/`.

Verify does not run Codex Security or Chrome/Tampermonkey acceptance. Run a separate security diff scan for security-sensitive changes or when explicitly requested; it is not mandatory for every release. A previous release's passing report is not evidence for a new local change.

## Adding behavior

1. Put pure eligibility/ranking logic in `domain/` and pass clocks explicitly.
2. Put durable or session-owned data in a typed state store.
3. Add a controller method for actions that can alter routing, measurement or recovery.
4. Keep browser quirks inside adapters and GM storage behind `platform/storage.ts`; UI owns its DOM and presentation lifecycle.
5. Emit a typed event rather than letting diagnostics inspect controller internals.
6. Add a contract to the relevant independent suite under `tests-v2/suites/`, or to the browser-free `tests-v2/domain-boundaries.ts`. Register new suites in `tests-v2/run.ts`.

Reproduce a behavior with a failing domain, controller or adapter contract before changing runtime logic. Keep affinity changes in `RouteCoordinator`, active probe initiation in `MeasurementController` and player-core reload in `RecoveryController`. Preserve lifecycle validity checks after waits and inside storage-lock callbacks; a timer port alone does not make stale work safe. Diagnostics consume typed events and snapshots.

## Test suites and isolation

[tests-v2/run.ts](../tests-v2/run.ts) registers these contract suites:

| Suite selector | Coverage area |
| --- | --- |
| `domain-boundaries` | Pure policy/output boundaries |
| `domain` | Domain behavior |
| `state` | Settings, restrictions, evidence and signed-route state |
| `application` | Routing, measurement and recovery contracts |
| `diagnostics` | Typed observations, snapshots and report privacy |
| `adapters` | Browser adapter behavior |
| `native-routing` | Catalog/Native routing and provenance |
| `native-transport` | Catalog/Native transport and request handling |
| `orchestration` | Composition, lifecycle and command coordination |
| `adapter-boundaries` | Navigation ownership and range reader contracts |
| `measurement-state` | Measurement metadata and stale lock callbacks |
| `progressive-playurl` | MP4/FLV containers, segment identity, atomic output and unchanged DASH handling |
| `progressive-routing` | Catalog source handles, complete candidate pool, backup limits and settings races |
| `progressive-transport` | MP4 Fetch/XHR output, shared startup window and comparison/disabled modes |
| `playurl-summary` | Typed acceptance, safe recent summary, status semantics, lifecycle and export privacy |

Use `npm test -- <selector>` for one suite; the runner also accepts its registered `suites/<selector>` name where applicable. `npm test -- architecture` runs AST rule fixtures, and `npm test -- imports` runs the import-purity harness. A full `npm test` runs both checks and all registered contract suites. Assertion counts belong to the report for the tested revision.

[scripts/test.mjs](../scripts/test.mjs) bundles each contract suite and runs it in its own Node process. Import purity uses one separate bundle containing all non-entry runtime modules with tree shaking disabled, loaded with selected globals trapped. It checks top-level imports, not later method calls. The runner uses an OS temporary directory and validates its resolved parent/prefix before recursive cleanup.

Shared [test support](../tests-v2/support/scope.ts) provides assertions, fixture factories, fake storage/clocks and cleanup scopes. Use `satisfies` for port fakes; do not bypass dependency types with `as never`. Register owned resources in `testScope()` and dispose in `finally`. The scope restores its listed globals and tracks timers created through its wrappers; tests must register cleanup for additional hooks/subscriptions they own. A scope does not automatically undo arbitrary browser mutations.

Do not add a public test bridge to the production bundle. Tests are bundled from TypeScript source independently.

## Build output

[build.mjs](../scripts/build.mjs) bundles `src-v2/entry.ts` as one browser IIFE targeting Chrome 120, without code splitting, and prepends [userscript metadata](../src-v2/metadata.txt) with the configured release version. It writes `dist/BiliCDN_TW.user.js`, its external source map and `dist/build-manifest.json`. The manifest records build options, input hashes and the userscript hash. Builds do not upload artifacts. Keep runtime dependencies, remote code loading, Worker interception and historical v1 imports out of the v2 source.

## Real Chrome validation

For v2.1.8, the user has requested publication before browser updating. Complete automated and required security verification, publish the userscript, confirm the GitHub Release, then update Tampermonkey through the repository's standard [latest-release userscript URL](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js). Until publication is confirmed, that URL still serves the previously published v2.1.7. Browser regression follows the update and is recorded separately from release verification.

After the published userscript is updated in Tampermonkey, use separate test tabs. Record:

- script version and Chrome/Tampermonkey versions;
- page type, quality, codec and playback rate;
- actual observed video/audio hosts;
- whether a probe was started and whether the host changed;
- seek, SPA, background, pause/resume and multi-tab outcomes.

For the new difference, run the target MP4 reproduction and DASH regression, recording format/segment handling, actual video hosts, playback progress and any startup/fixed-host setting race exercised. FLV currently has automated contract evidence only; exercise real FLV playback only if a legitimate accessible sample is available, otherwise retain that explicit evidence limit. These checks are separate from the approved, closed v2.1.6 acceptance and remain pending until actually performed.

Do not label VM or mock results as real playback. Preserve a user’s existing paused/test tab unless they explicitly authorize changing it.

## Packaging and release

Explicit `npm run package` runs a build and writes these five configured artifacts under `Release/v<version>/`, with the version from `release.json`:

- `BiliCDN_TW.user.js`
- `CHANGELOG_v<version>.md`
- `TEST_REPORT_v<version>.md`
- `BUILD_MANIFEST_v<version>.json`
- `SHA256SUMS_v<version>.txt`

[package.mjs](../scripts/package.mjs) overwrites those named files and does not clean an existing release directory. Its checksum list includes all files already present there except the checksum file itself. Review the target directory before packaging; do not use the command merely to validate an existing published release. Use `npm run verify` for temporary packaging verification.

Do not add patch files, CI/CD or GitHub Actions. Local packaging does not publish a release. The GitHub Release asset is only the userscript; retain the repository's latest-release update URLs. Before release, run `npm run typecheck`, `npm run architecture`, `npm test` and `npm run verify`, plus required security verification. Record real Chrome/Tampermonkey acceptance separately and do not describe pending browser checks as passed.
