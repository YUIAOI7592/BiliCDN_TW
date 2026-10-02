# Development

## Prerequisites

- Node.js 26.8.1
- npm 11.19.0
- Google Chrome and Tampermonkey for real-browser validation

Install the exact locked toolchain with `npm ci`.

## Commands

```powershell
npm run typecheck     # strict TypeScript, no emit
npm run architecture  # AST dependencies, ownership rules and cycles
npm test              # all independent contract suites + architecture/import-purity tests
npm test -- adapters  # one isolated suite (see tests-v2/run.ts)
npm run build         # deterministic single-IIFE userscript
npm run package       # v2 release directory, no patches
npm run verify        # complete local release verification
```

`npm run verify` checks the configured Node version, typecheck, architecture, functional tests, two identical builds, JavaScript syntax, forbidden v1/Worker markers and SHA-256 output. Packaging verification uses a temporary directory under `dist/`, then removes it; it does not overwrite a published `Release/v<version>/`. Explicit `npm run package` retains its release-writing behavior. Verify does not run Codex Security. Run a separate security diff scan for security-sensitive changes or when explicitly requested; it is not mandatory for every release.

## Adding behavior

1. Put pure eligibility/ranking logic in `domain/` and pass clocks explicitly.
2. Put durable or session-owned data in a typed state store.
3. Add a controller method for actions that can alter routing, measurement or recovery.
4. Keep browser/Tampermonkey quirks inside an adapter.
5. Emit a typed event rather than letting diagnostics inspect controller internals.
6. Add a contract to the relevant independent suite under `tests-v2/suites/`, or to the browser-free `tests-v2/domain-boundaries.ts`. Register new suites in `tests-v2/run.ts`.

Each suite runs in its own process and creates its own state. Shared support is limited to assertions, fixture factories, fake storage/clocks and cleanup scopes. Use `satisfies` for port fakes; do not bypass dependency types with `as never`. Register owned resources in `testScope()` and always dispose in `finally`, restoring hooks, subscriptions, globals and timers even when assertions fail. Boundary/architecture tests should fail before changing the matching runtime behavior.

Useful isolated checks include `npm test -- domain-boundaries`, `npm test -- orchestration`, `npm test -- adapter-boundaries`, `npm test -- measurement-state`, `npm test -- architecture` and `npm test -- imports`. A full `npm test` executes all of these as well as the original behavioral suites.

Do not add a public test bridge to the production bundle. Tests are bundled from TypeScript source independently.

## Real Chrome validation

Install the local `dist/BiliCDN_TW.user.js` into Tampermonkey and use separate test tabs. Record:

- script version and Chrome/Tampermonkey versions;
- page type, quality, codec and playback rate;
- actual observed video/audio hosts;
- whether a probe was started and whether the host changed;
- seek, SPA, background, pause/resume and multi-tab outcomes.

Do not label VM or mock results as real playback. Preserve a user’s existing paused/test tab unless they explicitly authorize changing it.

## Packaging and release

`npm run package` writes only the userscript, changelog, test report, build manifest and SHA-256 list under `Release/v<version>/`, with `version` from `release.json`. Do not add patch files. The GitHub Release asset is only the userscript. Publish only after automated and required security verification; record any later Chrome/Tampermonkey acceptance separately. Do not describe pending browser checks as passed.
