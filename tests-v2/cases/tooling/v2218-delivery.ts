import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import * as esbuild from 'esbuild'
import { build } from '../../../scripts/build.mts'
import { packageRelease } from '../../../scripts/package.mts'
import { readRelease, sha256 } from '../../../scripts/lib/lib.mts'
import { supervise } from '../../../scripts/testing/test-process.mts'
import { testScope } from '../../support/scope.ts'

function directory(t: TestContext): string {
  const root = mkdtempSync(join(tmpdir(), 'bilicdn-delivery-'))
  assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep))
  testScope(t).defer(() => rmSync(root, { recursive: true }))
  return root.replaceAll('\\', '/')
}

test('V2218 build seals the exact metadata template used by the userscript', async () => {
  const result = await build({ write: false })
  assert.equal(
    result.manifest.sources['src-v2/metadata.txt'],
    sha256(readFileSync('src-v2/metadata.txt')),
  )
})

for (const occupied of ['artifact', 'unrelated', 'empty-directory'] as const)
  test(`V2218 packaging refuses occupied destination without changing it: ${occupied}`, async (t) => {
    const root = directory(t)
    const path = `${root}/${occupied === 'artifact' ? readRelease().artifactName : 'retained'}`
    if (occupied === 'empty-directory') mkdirSync(path)
    else writeFileSync(path, 'original bytes\r\n')
    const before = readdirSync(root)
    await assert.rejects(packageRelease({ directory: root }), /not empty/)
    assert.deepEqual(readdirSync(root), before)
    if (occupied !== 'empty-directory')
      assert.equal(readFileSync(path, 'utf8'), 'original bytes\r\n')
  })

for (const existing of [true, false])
  test(`V2218 packaging creates exactly five checked artifacts in an empty destination: ${existing}`, async (t) => {
    const root = directory(t),
      destination = existing ? root : `${root}/new`
    const result = await packageRelease({ directory: destination })
    const version = readRelease().version
    assert.equal(readdirSync(destination).length, 5)
    assert.equal(readFileSync(result.script, 'utf8'), (await build({ write: false })).output)
    for (const row of readFileSync(`${destination}/SHA256SUMS_v${version}.txt`, 'utf8')
      .trim()
      .split('\n')) {
      const [, hash, path] = /^([a-f0-9]{64})  (.+)$/.exec(row)!
      assert.equal(sha256(readFileSync(path!)), hash)
    }
  })

test('V2218 verify CLI reports failed suite phases without dumping attached outcomes', async (t) => {
  const root = directory(t)
  mkdirSync(`${root}/scripts`)
  await esbuild.build({
    entryPoints: ['scripts/verify.mts'],
    outfile: `${root}/scripts/verify.mts`,
    bundle: true,
    platform: 'node',
    format: 'esm',
    plugins: [
      {
        name: 'controlled-verification-failure',
        setup(builder) {
          builder.onResolve({ filter: /^\.\// }, (args) => {
            if (args.importer === resolve('scripts/verify.mts'))
              return { path: args.path, namespace: 'fixture' }
            return undefined
          })
          builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
            contents: `
        export const readRelease = () => ({version:'fixture'});
        export const assertRuntimeCapabilities = async () => {};
        export const checkProjectConfiguration = () => ({success:true,checkedDependencies:9});
        export const formatProject = async () => {};
        export const checkArchive = async () => ({success:true,entries:0,records:0});
        export const checkDocumentation = async () => ({success:true,legacyLinks:[],archivedReferences:[],privateEvidenceNotChecked:[],externalLinksNotFetched:0});
        export const typecheck = () => {};
        export const command = () => {};
        export const build = () => {};
        export const packageRelease = () => {};
        export const sha256 = () => '';
        export const errorMessage = error => error instanceof Error ? error.message : String(error);
        export async function runTests() {
          throw Object.assign(new AggregateError([new Error('adapters (report): controlled failure')], 'Test suites failed'), {outcome:{stdout:'PRIVATE_OUTCOME_MARKER'}});
        }
      `,
          }))
        },
      },
    ],
  })
  const result = await supervise(process.execPath, ['scripts/verify.mts'], { cwd: root })
  assert.equal(result.code, 1)
  assert.match(result.stderr, /Test suites failed/)
  assert.match(result.stderr, /adapters \(report\): controlled failure/)
  assert.doesNotMatch(result.stderr, /PRIVATE_OUTCOME_MARKER/)
})
