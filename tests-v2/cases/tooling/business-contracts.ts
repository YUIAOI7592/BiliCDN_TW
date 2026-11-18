import assert from 'node:assert/strict'
import { test } from 'node:test'
import { type TestReport } from '../../../scripts/test.mts'
import { validateBusinessContracts } from '../../../scripts/testing/business-contracts.mts'
import { selection } from '../../../scripts/testing/test-registry.mts'

const index = {
  settings: [
    { id: 'settings-save', rule: 'Save and publish a preference', tests: [['state', 'save']] },
  ],
}

function results(names = ['save']) {
  const report: TestReport = {
    version: 1,
    nodeVersion: process.versions.node,
    success: true,
    counts: {
      passed: names.length,
      tests: names.length,
      topLevel: names.length,
      failed: 0,
      cancelled: 0,
      todo: 0,
      skipped: 0,
      suites: 0,
    },
    durationMs: 1,
    cases: names.map((name) => ({
      name,
      kind: 'test',
      status: 'passed',
      durationMs: 1,
      file: 'settings.ts',
      line: 1,
      column: 1,
    })),
    failures: [],
  }
  return [{ suite: 'state', phase: 'report' as const, success: true, report }]
}

test('business contract index requires its exact named case to pass in the registered suite', () => {
  assert.equal(validateBusinessContracts(index, results()), 1)
  assert.throws(() => validateBusinessContracts(index, results(['save its fixture'])), /found 0/)
  assert.throws(() => validateBusinessContracts(index, results(['save', 'save'])), /found 2/)
  const wrongSuite = results().map((row) => ({ ...row, suite: 'application' }))
  assert.throws(() => validateBusinessContracts(index, wrongSuite), /found 0/)
  const skipped = results()
  skipped[0]!.report.cases[0]!.status = 'skipped'
  assert.throws(() => validateBusinessContracts(index, skipped), /found 0/)
})

test('business contract index rejects empty areas, duplicate rules and rules without evidence', () => {
  assert.throws(() => validateBusinessContracts({}, results()), /Empty business contract index/)
  assert.throws(
    () => validateBusinessContracts({ state: [] }, results()),
    /Empty business contract area/,
  )
  assert.throws(
    () => validateBusinessContracts({ ...index, other: index.settings }, results()),
    /Duplicate business contract/,
  )
  assert.throws(
    () => validateBusinessContracts({ state: [{ ...index.settings[0], tests: [] }] }, results()),
    /Invalid business contract/,
  )
})

test('deferred product contracts are explicitly selectable and absent from the full run', () => {
  const selected = selection('deferred-product')
  assert.deepEqual(selected, [
    { name: 'deferred-product', source: 'tests-v2/deferred-product-contracts.ts' },
  ])
  assert.ok(selection().every((suite) => suite.name !== selected[0]!.name))
})
