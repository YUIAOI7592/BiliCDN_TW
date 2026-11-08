import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { testScope } from '../../support/scope.ts'
import { executeSuites } from '../../../scripts/test.mts'
import { validateTestDefinitions } from '../../../scripts/testing/test-contracts.mts'

function resources(t: Parameters<typeof testScope>[0]) {
  const scope = testScope(t),
    dir = mkdtempSync(join(tmpdir(), 'bilicdn-definitions-'))
  scope.defer(() => {
    if (
      !resolve(dir).startsWith(resolve(tmpdir()) + sep) ||
      !dir.split(sep).at(-1)?.startsWith('bilicdn-definitions-')
    )
      throw Error('Unsafe definition fixture cleanup')
    rmSync(dir, { recursive: true })
  })
  return { dir, source: join(dir, 'entry.ts'), child: join(dir, 'cases.ts') }
}
test('V2215 test definitions follow a real imported case module from a thin suite entry', async (t) => {
  const f = resources(t)
  writeFileSync(f.source, "import './cases.ts'\n")
  writeFileSync(f.child, "import { test } from 'node:test'; test('imported contract', () => {})\n")
  const result = await executeSuites([{ name: 'imported', source: f.source }], { emit: false })
  assert.equal(result.results[0]!.success, true)
  assert.deepEqual(
    result.results[0]!.report!.cases.map((x) => x.name),
    ['imported contract'],
  )
})
test('V2215 test definitions reject focused registrations inside an imported case module before execution', async (t) => {
  const f = resources(t)
  writeFileSync(f.source, "import './cases.ts'\n")
  writeFileSync(
    f.child,
    "import { test as check } from 'node:test'; check.only('focused import', () => {})\n",
  )
  const result = await executeSuites([{ name: 'focused-import', source: f.source }], {
    emit: false,
  })
  assert.equal(result.results[0]!.success, false)
  assert.equal(result.results[0]!.phase, 'build')
  assert.match(result.results[0]!.error!, /Focused test registration/)
})
test('V2215 type-only case imports cannot make an empty suite pass definition validation', (t) => {
  const f = resources(t)
  writeFileSync(f.source, "import type { Example } from './cases.ts'; export const value = 1\n")
  writeFileSync(
    f.child,
    "import { test } from 'node:test'; export interface Example {}; test.only('not imported', () => {})\n",
  )
  assert.throws(() => validateTestDefinitions(f.source, f.dir), /Suite registered no named cases/)
})
