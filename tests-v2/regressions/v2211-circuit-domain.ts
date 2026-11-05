import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addEvidenceSample, emptyEvidence } from '../../src-v2/domain/evidence.ts'
import {
  startCircuitWindow,
  advanceCircuitWindow,
  circuitWindowReady,
  CIRCUIT_OBSERVATION_MS,
} from '../../src-v2/domain/circuit-policy.ts'

const stamp = { generation: 'g', recordId: 'r', revision: 1 }
test('V2211 circuit: ordinary and probe successes retain the failure level', () => {
  for (const source of ['transport', 'challenge'] as const) {
    const row = addEvidenceSample(
      { ...emptyEvidence('cdn.example', 'video'), circuitLevel: 4, circuitUntil: 100 },
      { requestId: source, at: 101, source, outcome: 'success', throughputMbps: 10,
        ttfbMs: 10, bytes: 65536, elapsedMs: 100, failureKind: null },
      101,
    )
    assert.equal(row.circuitLevel, 4)
    assert.equal(row.circuitUntil, 0)
  }
})
test('V2211 circuit: a failure cannot shorten a legacy longer isolation', () => {
  const row = addEvidenceSample(
    { ...emptyEvidence('cdn.example', 'video'), circuitLevel: 1, circuitUntil: 21600000 },
    { requestId: 'failure', at: 100, source: 'transport', outcome: 'failure',
      throughputMbps: null, ttfbMs: null, failureKind: 'network' }, 100,
  )
  assert.equal(row.circuitLevel, 2)
  assert.equal(row.circuitUntil, 21600000)
})
for (const [gap, active] of [[120000, true], [120001, false]] as const) {
  test(`V2211 observation: success gap ${gap}ms has an exact inclusive boundary`, () => {
    const w = startCircuitWindow('window', stamp, 0)
    assert.equal(advanceCircuitWindow(w, gap).period !== null, active)
  })
}
for (const [at, ready] of [[299999, false], [300000, true], [359999, true], [360000, false]] as const) {
  test(`V2211 observation: settlement at ${at}ms respects the absolute window`, () => {
    const w = { ...startCircuitWindow('window', stamp, 0), lastSuccess: at }
    assert.equal(circuitWindowReady(w, at, 0), ready)
    assert.equal(w.deadline, CIRCUIT_OBSERVATION_MS)
  })
}
test('V2211 observation: endpoint success and every pre-cutoff result are required', () => {
  const w = { ...startCircuitWindow('window', stamp, 0), lastSuccess: 299999 }
  assert.equal(circuitWindowReady(w, 300000, 0), false)
  assert.equal(circuitWindowReady({ ...w, lastSuccess: 300000 }, 300000, 1), false)
  assert.equal(circuitWindowReady({ ...w, lastSuccess: 300000 }, 300000, 0), true)
})
