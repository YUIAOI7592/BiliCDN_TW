import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateRouting } from '../../../scripts/evaluation/routing-evaluation.mts'

test('V227 evaluation: frozen evidence and delivery produce reproducible finite routing metrics', async () => {
  const first = await evaluateRouting(),
    second = await evaluateRouting()
  assert.deepEqual(first, second)
  assert.equal(first.baselineRevision, '048b0f94e6bb98922ee5bcc0d1b30003cf3b12a9')
  assert.equal(first.scenarios.length, 10)
  for (const row of first.scenarios)
    for (const metrics of [row.baseline, row.current]) {
      for (const key of [
        'startupMs',
        'stallMs',
        'switches',
        'downloadBytes',
        'probeCount',
        'probeBytes',
        'reloadCount',
      ] as const) {
        const value = metrics[key]
        assert.ok(Number.isFinite(value) && value >= 0, `${row.id}: ${key}`)
      }
      assert.ok(metrics.probeCount <= 3)
      assert.ok(metrics.probeBytes <= 3 * 192 * 1024)
      assert.equal(metrics.reloadCount, 0)
    }
})
test('V227 evaluation: source equality and complete timing change choices while healthy affinity stays', async () => {
  const { scenarios } = await evaluateRouting()
  const faster = scenarios.find((row) => row.id === 'original-faster')!
  assert.equal(faster.current.host, 'original.example')
  assert.notEqual(faster.baseline.host, faster.current.host)
  const small = scenarios.find((row) => row.id === 'small-response')!
  assert.equal(small.current.host, 'original.example')
  assert.ok(small.current.startupMs < small.baseline.startupMs)
  assert.equal(scenarios.find((row) => row.id === 'healthy-current')!.current.switches, 0)
})
test('V227 evaluation: held-out delivery can contradict estimates without being reported as missing-host failure', async () => {
  const row = (await evaluateRouting()).scenarios.find((row) => row.id === 'future-divergence')!
  assert.ok(row.current.stallMs > row.baseline.stallMs)
  assert.equal(row.current.probeCount, 0)
})
test('V227 evaluation: startup reserves one real exploration slot within unchanged candidate caps', async () => {
  const row = (await evaluateRouting()).scenarios.find((row) => row.id === 'reserved-exploration')!
  assert.ok(row.currentProbes.includes('unknown.example'))
  assert.equal(row.current.probeCount, 3)
  assert.equal(row.baseline.probeCount, 3)
  assert.equal(row.current.probeBytes, row.baseline.probeBytes)
})
