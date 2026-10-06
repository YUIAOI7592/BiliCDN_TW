import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { build } from './build.mjs'
import { runTests } from './test.mjs'
import { typecheck } from './typecheck.mjs'
import { packageRelease } from './package.mjs'
import { command, readJson, sha256 } from './lib.mjs'

export async function verify() {
  const config = readJson('release.json')
  if (process.versions.node !== config.nodeVersion) throw Error(`Expected Node ${config.nodeVersion}; found ${process.versions.node}`)
  typecheck()
  command(process.execPath, ['scripts/architecture-check.mjs'])
  await runTests()
  const first = await build({ write: false }), second = await build()
  if (first.output !== second.output || JSON.stringify(first.manifest) !== JSON.stringify(second.manifest)) throw Error('Build is not reproducible')
  command(process.execPath, ['--check', 'dist/BiliCDN_TW.user.js'])
  const output = second.output
  for (const forbidden of ['unsafeWindow.BiliCDN', 'EnableWorkerIntercept', 'bilicdn:worker', 'src/settings.txt', 'workerStats_v1']) {
    if (output.includes(forbidden)) throw Error(`Production bundle contains forbidden legacy marker: ${forbidden}`)
  }
  if (!output.includes('bilicdn.v2.settings') || !output.includes('bilicdn.v2.routeEvidence')) throw Error('v2 storage namespace missing')
  if (/unsafeWindow\s*\.\s*Worker|MessageChannel\s*\(/.test(output)) throw Error('Production bundle touches Worker interception primitives')
  // Verify the packaging contract without overwriting an already published release.
  const scratch = mkdtempSync('dist/verify-package-').replaceAll('\\', '/')
  try {
    const packaged = await packageRelease({ directory: scratch })
    if (!existsSync(packaged.script) || readFileSync(packaged.script, 'utf8') !== output) throw Error('Packaged userscript differs from deterministic build')
    const sumFile = `${packaged.dir}/SHA256SUMS_v${config.version}.txt`
    for (const row of readFileSync(sumFile, 'utf8').trim().split('\n')) {
      const match = /^([a-f0-9]{64})  (.+)$/.exec(row)
      if (!match || !match[2]?.startsWith(`${packaged.dir}/`) || match[2].includes('..')) throw Error(`Invalid checksum row: ${row}`)
      if (sha256(readFileSync(match[2])) !== match[1]) throw Error(`Checksum mismatch: ${match[2]}`)
    }
  } finally {
    const target = resolve(scratch), parent = resolve('dist')
    if (!target.startsWith(`${parent}${sep}`) || !target.split(sep).at(-1)?.startsWith('verify-package-')) throw Error('Unsafe verification cleanup')
    rmSync(target, { recursive: true })
  }
  console.log(`Verified v${config.version}: typecheck, architecture, functional tests, deterministic build, syntax, v2-only bundle and checksums.`)
}

if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/verify.mjs')) await verify()
