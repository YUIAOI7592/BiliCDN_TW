import { readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

export function discoverTests(directory = 'tests') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? discoverTests(path) : /\.test\.(?:[cm]?js)$/.test(path) ? [path] : [];
  }).sort();
}

export function runTests({ security = false } = {}) {
  if (!existsSync(process.env.BILICDN_TEST_TARGET || 'dist/BiliCDN_TW.user.js')) throw Error('Build target missing; tests must not silently skip');
  const files = discoverTests().filter(path => !security || /security-cs00[123]\.test\.js$/.test(path));
  if (!files.length) throw Error('No tests discovered');
  const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(`Tests failed (${result.status})`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/test.mjs')) {
  const { build } = await import('./build.mjs');
  await build(); await build({testing:true});
  runTests({ security: process.argv.includes('--security') });
}
