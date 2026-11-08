import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { supervise } from '../../../scripts/testing/test-process.mts'
import { readRelease } from '../../../scripts/lib/lib.mts'
import { build } from '../../../scripts/build.mts'
import { NODE_BUILD_TARGET } from '../../../scripts/lib/toolchain.mts'
import { testScope } from '../../support/scope.ts'

test('TOOLCHAIN release configuration needs no Node or npm version fields', async (t) => {
  const scope = testScope(t),
    root = mkdtempSync(join(tmpdir(), 'bilicdn-release-config-'))
  scope.defer(() => rmSync(root, { recursive: true }))
  const release = {
    version: '2.2.16',
    artifactName: 'fixture.user.js',
    typescriptVersion: '7.0.2',
    esbuildVersion: '0.28.2',
  }
  writeFileSync(join(root, 'release.json'), JSON.stringify(release))
  const entry = pathToFileURL(resolve('scripts/lib/lib.mts')).href
  const result = await supervise(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import {readRelease} from ${JSON.stringify(entry)};console.log(JSON.stringify(readRelease()))`,
    ],
    { cwd: root },
  )
  assert.equal(result.code, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout), release)
})

test('TOOLCHAIN actual build records runtime and installed tools without claiming npm', async () => {
  const result = await build({ write: false }),
    release = readRelease()
  assert.equal(result.manifest.tools.node, process.versions.node)
  assert.equal(Object.hasOwn(result.manifest.tools, 'npm'), false)
  assert.equal(Object.hasOwn(release, 'nodeVersion'), false)
  assert.equal(Object.hasOwn(release, 'npmVersion'), false)
  assert.equal(
    result.manifest.tools.typescript,
    JSON.parse(readFileSync('node_modules/typescript/package.json', 'utf8')).version,
  )
  assert.ok(Object.hasOwn(result.manifest.sources, 'scripts/lib/toolchain.mts'))
  assert.equal(NODE_BUILD_TARGET, 'node24')
})

test('TOOLCHAIN build rejects installed TypeScript metadata drift before compilation', async (t) => {
  const scope = testScope(t),
    root = mkdtempSync(join(tmpdir(), 'bilicdn-build-config-'))
  scope.defer(() => rmSync(root, { recursive: true }))
  writeFileSync(
    join(root, 'release.json'),
    JSON.stringify({
      version: '2.2.16',
      artifactName: 'fixture.user.js',
      nodeVersion: process.versions.node,
      npmVersion: 'legacy',
      typescriptVersion: '7.0.2',
      esbuildVersion: '0.28.2',
    }),
  )
  mkdirSync(join(root, 'node_modules/typescript'), { recursive: true })
  writeFileSync(
    join(root, 'node_modules/typescript/package.json'),
    JSON.stringify({ version: '7.0.3' }),
  )
  const entry = pathToFileURL(resolve('scripts/build.mts')).href
  const result = await supervise(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import {build} from ${JSON.stringify(entry)};await build({write:false})`,
    ],
    { cwd: root },
  )
  assert.notEqual(result.code, 0)
  assert.match(result.stderr, /Expected TypeScript 7\.0\.2; found 7\.0\.3/)
})
