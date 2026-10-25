import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseArgs,
  jobs,
  proof,
  hash,
  validResult,
  summarize,
} from '../../scripts/diagnostics-cost/model.mts'
import type { Measurement } from '../../scripts/diagnostics-cost/model.mts'
import { testScope } from '../support/scope.ts'
import { supervise } from '../../scripts/test-process.mts'

test('diagnostics-cost CLI separates profile and timing and rejects unknown or duplicate options', () => {
  assert.deepEqual(parseArgs(['--profile', '--json']), { profile: true, json: true })
  assert.deepEqual(parseArgs(['--json']), { profile: false, json: true })
  for (const args of [['--cost-source'], ['--profile', '--profile'], ['--cost', '--profile']])
    assert.throws(() => parseArgs(args))
})
test('diagnostics-cost scheduling excludes warmups and alternates ten measured pairs per rate', () => {
  for (const rate of [1, 2]) {
    const healthy = jobs(false).filter((j) => j.rate === rate && j.workload === 'healthy')
    assert.equal(healthy.length, 24)
    assert.equal(healthy.filter((j) => !j.warmup).length, 20)
    for (let i = 0; i < healthy.length; i += 2) {
      assert.equal(healthy[i]!.side, healthy[i]!.pair % 2 === 0 ? 'baseline' : 'candidate')
      assert.notEqual(healthy[i]!.side, healthy[i + 1]!.side)
    }
  }
  assert.equal(jobs(true).length, 16)
})
test('diagnostics-cost source proof rejects tampered bytes and hashes', () => {
  const data = Buffer.from('中文😀')
  proof(data, data.length, hash(data))
  assert.throws(() => proof(data, data.length - 1, hash(data)))
  assert.throws(() => proof(Buffer.from('other'), data.length, hash(data)))
})
function row(side: string): Measurement {
  return {
    side,
    rate: 1,
    workload: 'healthy',
    pair: 0,
    warmup: false,
    validity: 'valid',
    times: Array(600).fill(1),
    startupMs: 1,
    caseDurationMs: 1000,
    cpu: { user: 10, system: 1 },
    heap: { start: 1, end: 2, peak: 3 },
    digest: 'a'.repeat(64),
    cleanup: { timers: 0, listeners: 0, requests: 0, subscriptions: 0 },
  }
}
for (const defect of [
  'missing',
  'samples',
  'nan',
  'cleanup',
  'digest',
  'deadline',
  'missing-duration',
] as const)
  test(`diagnostics-cost protocol rejects ${defect}`, () => {
    const r = row('baseline')
    if (defect === 'missing') delete r.cpu
    if (defect === 'samples') r.times = [1]
    if (defect === 'nan') r.cpu!.user = NaN
    if (defect === 'cleanup') r.cleanup!.timers = 1
    if (defect === 'digest') r.digest = 'invalid'
    if (defect === 'deadline') r.caseDurationMs = 5001
    if (defect === 'missing-duration') delete r.caseDurationMs
    assert.equal(validResult(r), false)
  })
test('diagnostics-cost adoption requires both rates, eight CPU wins, semantics and excludes warmups', () => {
  const rows = ([1, 2] as const).flatMap((rate) =>
    Array.from({ length: 10 }, (_, pair) => pair).flatMap((pair) =>
      ['baseline', 'candidate'].map((side) => ({
        ...row(side),
        rate,
        pair,
        cpu: { user: side === 'candidate' ? 8 : 10, system: 1 },
      })),
    ),
  )
  assert.equal(summarize(rows, false).timingAccepted, true)
  assert.equal(
    summarize(
      rows.map((r) => ({ ...r, cpu: { user: 10, system: 1 } })),
      false,
    ).timingAccepted,
    false,
  )
  assert.equal(summarize(rows.slice(0, 20), false).timingAccepted, false)
  assert.equal(
    summarize(
      rows.map((r, i) => (i === 0 ? { ...r, digest: 'b'.repeat(64) } : r)),
      false,
    ).semanticEquality,
    false,
  )
  assert.equal(
    summarize(
      [...rows, { ...row('baseline'), pair: -1, warmup: true, times: Array(600).fill(100) }],
      false,
    ).timingAccepted,
    true,
  )
})
for (const defect of ['timeout', 'output-limit'] as const)
  test(`diagnostics-cost supervision preserves ${defect}`, async (t) => {
    testScope(t)
    const r = await supervise(
      process.execPath,
      [
        '-e',
        defect === 'timeout'
          ? 'setInterval(()=>{},1000)'
          : "process.stdout.write('x'.repeat(65536))",
      ],
      defect === 'timeout' ? { timeoutMs: 200 } : { maxBytes: 1024 },
    )
    assert.equal(r.reason, defect)
    assert.ok(r.durationMs < 5000)
  })
