import * as esbuild from 'esbuild'
import { mkdtempSync, rmSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { command } from './lib.mjs'

export async function runTests() {
  const scratch = mkdtempSync(join(tmpdir(), 'bilicdn-v2-tests-'))
  try {
    const outfile = join(scratch, 'tests.mjs')
    await esbuild.build({ stdin: { contents: "import '././tests-v2/run.ts'", resolveDir: process.cwd(), sourcefile: 'v2-tests.ts' },
      outfile, bundle: true, platform: 'node', format: 'esm', target: 'node26', logLevel: 'warning' })
    const output = command(process.execPath, [outfile])
    process.stdout.write(output)
  } finally {
    const absolute = resolve(scratch), parent = resolve(tmpdir())
    if (!absolute.startsWith(`${parent}${sep}`) || !absolute.split(sep).at(-1)?.startsWith('bilicdn-v2-tests-')) throw Error('Refusing unsafe cleanup')
    rmSync(absolute, { recursive: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/test.mjs')) await runTests()
