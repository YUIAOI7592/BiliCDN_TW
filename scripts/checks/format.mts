import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as prettier from 'prettier'
import { filesUnder, errorMessage } from '../lib/lib.mts'

/** A fixed maintenance allowlist never traverses release, archive or evidence trees. */
export function formatFiles(): readonly string[] {
  const sources = ['src-v2', 'tests-v2', 'scripts'].flatMap((directory) =>
    existsSync(directory) ? filesUnder(directory).filter((file) => /\.(?:ts|mts)$/.test(file)) : [],
  )
  const configs = [
    'package.json',
    'release.json',
    'tsconfig.json',
    'tsconfig.tests.json',
    'tsconfig.tools.json',
    '.prettierrc.json',
  ].filter((file) => existsSync(file))
  return Object.freeze([...sources, ...configs].sort())
}

export async function formattedSource(file: string, source: string): Promise<string> {
  const options = { ...(await prettier.resolveConfig(file)), filepath: file }
  let current = source
  for (let attempt = 0; attempt < 4; attempt++) {
    const next = await prettier.format(current, options)
    if (next === current) return next
    current = next
  }
  throw Error(`Prettier formatting did not stabilize: ${file}`)
}

export async function formatProject(check = false): Promise<readonly string[]> {
  const changed: string[] = []
  for (const file of formatFiles()) {
    const before = readFileSync(file, 'utf8')
    const after = await formattedSource(file, before)
    if (before === after) continue
    changed.push(file)
    if (!check) writeFileSync(file, after)
  }
  if (check && changed.length) throw Error(`Source formatting differs: ${changed.join(', ')}`)
  return Object.freeze(changed)
}

if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/checks/format.mts')) {
  try {
    const args = process.argv.slice(2)
    if (args.length > 1 || args.some((arg) => arg !== '--check'))
      throw Error('Usage: npm run format [-- --check]')
    const changed = await formatProject(args[0] === '--check')
    console.log(
      args[0] === '--check'
        ? 'Source formatting passed.'
        : `Formatted ${changed.length} maintenance files.`,
    )
  } catch (error) {
    console.error(errorMessage(error))
    process.exitCode = 1
  }
}
