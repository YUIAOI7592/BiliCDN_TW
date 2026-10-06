import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inspectImportPurity } from '../scripts/import-purity.mjs'
test('all non-entry modules import without ambient reads or side effects', { timeout: 5000 }, async () => {
  const result = await inspectImportPurity()
  assert.ok(result.modules > 0)
  assert.equal(result.result.code, 0)
})
