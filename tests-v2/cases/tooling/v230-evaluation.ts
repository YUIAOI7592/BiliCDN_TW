import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateDeadlines } from '../../../scripts/evaluation/deadline-evaluation.mts'
test('V230 model uses immutable input and identical resource ceilings', async () => {
  const a = await evaluateDeadlines(),
    b = await evaluateDeadlines()
  assert.deepEqual(a, b)
  assert.equal(a.baselineRevision, '304c63196a2110943387848765cf5156a01af066')
  assert.equal(a.scenarios.length, 16)
  for (const scene of a.scenarios)
    for (const row of [scene.baseline, scene.current]) {
      assert.ok(row.probeCount <= 3)
      assert.ok(row.probeBytes <= 3 * 262144)
      assert.ok(row.representationTrajectory.length > 0)
    }
})
test('V230 model retains early-release and handoff tradeoffs', async () => {
  const result = await evaluateDeadlines(),
    early = result.scenarios.find((s) => s.id === 'early-not-whole-round-fastest')!
  assert.equal(early.current.startupWaitingMs, 800)
  assert.equal(early.baseline.startupWaitingMs, 3000)
  assert.ok(
    early.current.deliveryMs! > early.baseline.deliveryMs!,
    'first adequate route is not fastest',
  )
  assert.equal(result.handoff.baseline.eligible, true)
  assert.equal(result.handoff.current.eligible, false)
  assert.equal(result.handoff.current.reason, 'alternative-late')
})
