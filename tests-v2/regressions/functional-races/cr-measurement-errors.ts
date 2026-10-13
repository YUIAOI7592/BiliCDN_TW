import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { buildSync } from 'esbuild'
import { testScope } from '../../support/scope.ts'

interface Result { unhandled: number; afterFirst: string; initialProbes: number; laterProbes: number; cleanupDone: boolean }

function run(reject: boolean): Result {
  const bundle = buildSync({ entryPoints: ['tests-v2/support/measurement-storage-scenario.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false })
  const child = spawnSync(process.execPath, ['--input-type=module', '-', ...(reject ? ['--reject'] : [])],
    { input: bundle.outputFiles[0]!.text, encoding: 'utf8', timeout: 5000, windowsHide: true })
  assert.equal(child.status, 0, child.stderr)
  return JSON.parse(child.stdout) as Result
}
test('CR-04 measurement storage failure releases its round and permits a later qualified attempt', t => {
  testScope(t)
  const result = run(true)
  t.diagnostic(JSON.stringify(result))
  assert.equal(result.cleanupDone, true)
  assert.ok(result.initialProbes > 0)
  assert.notEqual(result.afterFirst, 'running', 'settled storage rejection must not leave a phantom probe round')
  assert.ok(result.laterProbes > result.initialProbes)
  assert.equal(result.unhandled, 0)
})
test('CR-04 control successful storage releases its round and permits a later attempt', t => {
  testScope(t)
  const result = run(false)
  t.diagnostic(JSON.stringify(result))
  assert.equal(result.cleanupDone, true)
  assert.equal(result.afterFirst, 'complete')
  assert.ok(result.laterProbes > result.initialProbes)
  assert.equal(result.unhandled, 0)
})
