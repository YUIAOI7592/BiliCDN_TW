import * as esbuild from 'esbuild'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const buildOptions = Object.freeze({
  bundle: true,
  platform: 'browser',
  format: 'iife',
  splitting: false,
  target: ['chrome120'],
  minify: false,
  treeShaking: true,
  keepNames: true,
  charset: 'utf8',
  legalComments: 'inline',
  sourcemap: 'external',
  write: false,
})

const hash = value => createHash('sha256').update(value).digest('hex')

export async function build({ write = true } = {}) {
  const release = JSON.parse(readFileSync('release.json', 'utf8'))
  if (esbuild.version !== release.esbuildVersion) throw Error(`Expected esbuild ${release.esbuildVersion}; found ${esbuild.version}`)
  const result = await esbuild.build({ ...buildOptions,
    stdin: { contents: "import '././src-v2/entry.ts'", resolveDir: process.cwd(), sourcefile: 'v2-entry.ts' },
    outfile: 'dist/BiliCDN_TW.user.js', metafile: true })
  const metadata = readFileSync('src-v2/metadata.txt', 'utf8').replace(/(@version\s+)\S+/, `$1${release.version}`)
  const codeFile = result.outputFiles.find(file => file.path.endsWith('.js'))
  const mapFile = result.outputFiles.find(file => file.path.endsWith('.map'))
  if (!codeFile || !mapFile) throw Error('esbuild did not return JavaScript and source map outputs')
  const output = `${metadata.trimEnd()}\n\n${codeFile.text}`
  const inputs = Object.keys(result.metafile.inputs).filter(path => path.startsWith('src-v2/')).sort()
  for (const path of ['scripts/build.mjs', 'package.json', 'package-lock.json', 'release.json', 'tsconfig.json']) if (!inputs.includes(path)) inputs.push(path)
  inputs.sort()
  const manifest = {
    version: release.version,
    tools: { node: process.versions.node, npm: release.npmVersion, typescript: release.typescriptVersion, esbuild: esbuild.version },
    options: buildOptions,
    sources: Object.fromEntries(inputs.map(path => [path, hash(readFileSync(path))])),
    userscriptSha256: hash(output),
  }
  if (write) {
    mkdirSync('dist', { recursive: true })
    writeFileSync('dist/BiliCDN_TW.user.js', output)
    writeFileSync('dist/BiliCDN_TW.user.js.map', mapFile.contents)
    writeFileSync('dist/build-manifest.json', `${JSON.stringify(manifest, null, 2)}\n`)
  }
  return { output, manifest }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/build.mjs')) {
  const result = await build()
  console.log(`Built BiliCDN_TW v${result.manifest.version}: ${result.manifest.userscriptSha256}`)
}
