import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeBufferTrend } from '../../src-v2/diagnostics/buffer-trend.ts'
import type { BufferTrendSnapshot } from '../../src-v2/domain/buffer-trend.ts'
function fixture(basis: 'steady-decline' | 'partial-cycle'): BufferTrendSnapshot {
  return {
    schemaVersion: 6,
    algorithm: 'buffer-window-v6',
    at: 20000,
    from: 12000,
    spanMs: 8000,
    sampleCount: 9,
    interpolated: false,
    progressQuality: 'frames',
    state: 'stable',
    candidate: true,
    reason: basis === 'steady-decline' ? 'low-buffer-steady' : 'low-buffer-cycle',
    rate: 1,
    startBufferSec: 4,
    endBufferSec: 3.2,
    deltaSec: -0.8,
    slopeSecPerSec: -0.1,
    cycle: {
      netLossSec: basis === 'partial-cycle' ? 0.5 : 0,
      creditMs: null,
      lastLossAgeMs: basis === 'partial-cycle' ? 1000 : null,
      rangeTroughSec: null,
    },
    lowBuffer: {
      tailUsed: false,
      basis,
      creditMs: 2000,
      declineCoverageMs: basis === 'steady-decline' ? 8000 : 1000,
    },
    transport: {
      coverage: 'none-observed',
      successes: 0,
      failures: 0,
      aborts: 0,
      completedBytes: 0,
      crossWindow: 0,
      dropped: 0,
    },
  }
}
for (const basis of ['steady-decline', 'partial-cycle'] as const) {
  test(`buffer-v5 U-D ${basis} isolated whitelist`, () => {
    const f = fixture(basis)
    Object.assign(f.lowBuffer!, { url: 'https://secret.invalid', core: {}, token: 'private-token' })
    const r = sanitizeBufferTrend(f)!
    assert.ok(r)
    assert.notEqual(r.lowBuffer, f.lowBuffer)
    assert.equal(JSON.stringify(r).includes('secret'), false)
    assert.equal(JSON.stringify(r).includes('token'), false)
    Object.assign(f.lowBuffer!, { creditMs: 0 })
    assert.equal(r.lowBuffer!.creditMs, 2000)
  })
  for (const kind of [
    'missing',
    'credit-short',
    'credit-over',
    'coverage-over',
    'basis-mismatch',
    'reason-mismatch',
    'buffer-high',
    'null-candidate',
    'no-evidence',
    'bad-version',
    'bad-algorithm',
  ] as const)
    test(`buffer-v5 U-D reject ${basis} ${kind}`, () => {
      const f = fixture(basis)
      if (kind === 'missing') Object.assign(f, { lowBuffer: null })
      if (kind === 'credit-short') Object.assign(f.lowBuffer!, { creditMs: 1999 })
      if (kind === 'credit-over') Object.assign(f.lowBuffer!, { creditMs: 2001 })
      if (kind === 'coverage-over') Object.assign(f.lowBuffer!, { declineCoverageMs: 8001 })
      if (kind === 'basis-mismatch')
        Object.assign(f.lowBuffer!, {
          basis: basis === 'partial-cycle' ? 'steady-decline' : 'partial-cycle',
        })
      if (kind === 'reason-mismatch') Object.assign(f, { reason: 'low-buffer-confirming' })
      if (kind === 'buffer-high') Object.assign(f, { endBufferSec: 4.000001 })
      if (kind === 'null-candidate') Object.assign(f, { candidate: null })
      if (kind === 'no-evidence') {
        Object.assign(f.lowBuffer!, { declineCoverageMs: 7999 })
        Object.assign(f.cycle!, { netLossSec: 0, lastLossAgeMs: null })
      }
      if (kind === 'bad-version') Object.assign(f, { schemaVersion: 4 })
      if (kind === 'bad-algorithm') Object.assign(f, { algorithm: 'buffer-window-v4' })
      assert.equal(sanitizeBufferTrend(f), null)
    })
}
