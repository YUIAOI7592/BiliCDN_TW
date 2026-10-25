import test from 'node:test'
import assert from 'node:assert/strict'
import { DiagnosticRecorder } from '../../src-v2/diagnostics/recorder.ts'
import { exercise } from '../support/diagnostics-cost.ts'
import { testScope } from '../support/scope.ts'

for (const rate of [1, 2] as const)
  for (const workload of ['incident', 'capacity', 'export'] as const)
    test(`diagnostics-cost frozen workload covers ${workload} and clear rate=${rate}`, (t) => {
      testScope(t)
      let now = 2000000000000
      const recorder = new DiagnosticRecorder(
        () => now,
        () => true,
      )
      let evicted = 0,
        incidentEvicted = 0,
        truncated = 0
      for (let i = 0; i < 600; i++) {
        now += 1000
        const value = exercise(recorder, workload, now, i, rate)
        assert.deepEqual(value.before, value.after)
        assert.ok(Buffer.byteLength(value.report) <= 96 * 1024)
        assert.ok(Buffer.byteLength(JSON.stringify(value.before.bufferTrend)) <= 8192)
        const report = JSON.parse(value.report) as { export: { truncated: boolean } }
        truncated += Number(report.export.truncated)
        evicted = Math.max(evicted, value.before.counters.evicted)
        incidentEvicted = Math.max(incidentEvicted, value.before.counters.incidentEvicted)
        if (i === 299) {
          assert.equal(value.before.incident, null)
          assert.equal(value.before.bufferTrend.history.length, 0)
        }
        if (i === 300) assert.ok(value.before.incident)
      }
      if (workload === 'capacity') assert.ok(evicted > 0 && incidentEvicted > 0)
      if (workload === 'export') assert.ok(truncated > 0)
    })
