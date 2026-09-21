import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { build } from './build.mjs'
import { filesUnder, readJson, sha256 } from './lib.mjs'

export async function packageRelease() {
  const config = readJson('release.json'), version = config.version
  const dir = `Release/v${version}`
  const result = await build()
  mkdirSync(dir, { recursive: true })
  const script = `${dir}/${config.artifactName}`
  writeFileSync(script, result.output)
  copyFileSync('dist/build-manifest.json', `${dir}/BUILD_MANIFEST_v${version}.json`)
  writeFileSync(`${dir}/CHANGELOG_v${version}.md`, readFileSync('CHANGELOG.md', 'utf8'))
  writeFileSync(`${dir}/TEST_REPORT_v${version}.md`, readFileSync('TEST_REPORT.md', 'utf8'))
  const sums = `${dir}/SHA256SUMS_v${version}.txt`
  const rows = filesUnder(dir).filter(file => file !== sums).map(file => `${sha256(readFileSync(file))}  ${file}`)
  writeFileSync(sums, `${rows.join('\n')}\n`)
  return { dir, script }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/package.mjs')) {
  const result = await packageRelease()
  console.log(`Packaged ${result.script}; no historical patches were generated.`)
}
