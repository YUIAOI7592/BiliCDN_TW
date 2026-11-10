import test from 'node:test'
import assert from 'node:assert/strict'
import { ui, readSummary } from './control-center-resources.ts'
import { type MonitorSnapshot } from '../../../src-v2/application/playback/monitor-contracts.ts'

for (const [phase, active, watchdog, expected] of [
  ['stable-retained', false, 'healthy', '播放穩定，保留本段額度'],
  ['settling', false, 'healthy', '已有播放進度，等待穩定'],
  ['stable-retained', true, 'healthy', '正在嘗試恢復'],
  ['stable-retained', false, 'observing', '觀察不足'],
] as const) {
  test(`V2217 UI: ${phase}/${active}/${watchdog} separates action from retained budget`, (t) => {
    const f = ui(t),
      before = f.deps.monitor.snapshot()
    let reads = 0
    const snapshot: MonitorSnapshot = {
      ...before,
      watchdog,
      recoveryActive: active,
      stableProgressTicks: 12,
      stableProgressMs: 11988,
      progressObservation: 'progress',
      stall: {
        id: 7,
        phase,
        action: 'spent',
        startedAt: 1000,
        fallbackAt: 7000,
        reloadAt: 13000,
        fallbackAvailable: false,
      },
    }
    f.deps.monitor.snapshot = () => {
      reads++
      return snapshot
    }
    f.center.show()
    assert.equal(reads, 1)
    assert.ok(f.doc.flatten().some((e) => e.textContent.includes(expected)))
    assert.equal(
      f.doc.flatten().some((e) => e.className === 'summary'),
      false,
    )
    const summary = readSummary(f).textContent
    assert.ok(summary.includes(expected))
    assert.match(summary, /穩定進度：12 次／11\.99 秒有效觀察/)
    assert.equal(reads, 1, 'details reuse the current model')
    f.center.close()
    assert.equal(reads, 1)
  })
}
