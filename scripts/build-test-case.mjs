// Test-only source injection; never imported or included in the release bundle.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { build } from './build.mjs';
const transform = vm.runInNewContext(`(${readFileSync(0, 'utf8')})`);
const result = await build({ testing: true, sourceTransform: transform, write: false });
process.stdout.write(result.output);
