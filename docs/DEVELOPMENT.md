# Development

## Prerequisites

- Node.js 26.8.1
- npm 11.19.0
- Google Chrome and Tampermonkey for real-browser validation

Install the exact locked toolchain with `npm ci`.

## Commands

```powershell
npm run typecheck     # strict TypeScript, no emit
npm run architecture  # dependency direction and cycle check
npm test              # domain/controller/adapter contracts
npm run build         # deterministic single-IIFE userscript
npm run package       # v2 release directory, no patches
npm run verify        # complete local release verification
```

`npm run verify` checks the configured Node version, typecheck, architecture, functional tests, two identical builds, JavaScript syntax, forbidden v1/Worker markers and SHA-256 output. It does not run Code Security.

## Adding behavior

1. Put pure eligibility/ranking logic in `domain/` and pass clocks explicitly.
2. Put durable or session-owned data in a typed state store.
3. Add a controller method for actions that can alter routing, measurement or recovery.
4. Keep browser/Tampermonkey quirks inside an adapter.
5. Emit a typed event rather than letting diagnostics inspect controller internals.
6. Add a focused test in `tests-v2/run.ts`.

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

`npm run package` writes only the userscript, changelog, test report, build manifest and SHA-256 list under the current `Release/v<version>/`. Do not add patch files. The GitHub Release asset is only the userscript. For v2.0.1, publish after automated verification; perform targeted Chrome acceptance after the user updates. Do not describe pending browser checks as passed.
