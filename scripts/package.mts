import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { build } from './build.mts'
import { filesUnder, readRelease, sha256 } from './lib/lib.mts'
import { reportRuntimeInfo } from './lib/toolchain.mts'

export interface PackageOptions {
  directory?: string
}
export async function packageRelease({ directory }: PackageOptions = {}) {
  const config = readRelease(),
    version = config.version
  const dir = directory ?? `Release/v${version}`
  if (existsSync(dir) && readdirSync(dir).length) throw Error('Package destination is not empty')
  const result = await build()
  mkdirSync(dir, { recursive: true })
  const script = `${dir}/${config.artifactName}`
  writeFileSync(script, result.output, { flag: 'wx' })
  writeFileSync(
    `${dir}/BUILD_MANIFEST_v${version}.json`,
    readFileSync('dist/build-manifest.json'),
    { flag: 'wx' },
  )
  writeFileSync(`${dir}/CHANGELOG_v${version}.md`, readFileSync('docs/CHANGELOG.md', 'utf8'), {
    flag: 'wx',
  })
  writeFileSync(`${dir}/TEST_REPORT_v${version}.md`, readFileSync('docs/TEST_REPORT.md', 'utf8'), {
    flag: 'wx',
  })
  const sums = `${dir}/SHA256SUMS_v${version}.txt`
  const rows = filesUnder(dir)
    .filter((file) => file !== sums)
    .map((file) => `${sha256(readFileSync(file))}  ${file}`)
  writeFileSync(sums, `${rows.join('\n')}\n`, { flag: 'wx' })
  return { dir, script }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/package.mts')) {
  reportRuntimeInfo()
  const result = await packageRelease()
  console.log(`Packaged ${result.script}; no historical patches were generated.`)
}
