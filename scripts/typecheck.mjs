import { resolve } from 'node:path'
import { command } from './lib.mjs'
export function typecheck() {
  for (const config of ['tsconfig.json', 'tsconfig.tests.json']) {
    command(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '-p', config])
  }
}
if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/typecheck.mjs')) typecheck()
