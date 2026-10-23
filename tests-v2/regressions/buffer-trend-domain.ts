import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assessBufferTrend, summarizeBufferTransport } from '../../src-v2/domain/buffer-trend.ts'
import type { BufferTrendSample } from '../../src-v2/domain/buffer-trend.ts'

function samples(rate: number, delta = -4, end = 8): BufferTrendSample[] {
  return Array.from({ length: 9 }, (_, i) => ({
    at: i * 1000,
    bufferAheadSec: (end - delta + (delta * i) / 8) * rate,
    rate,
    currentTime: 100 + i * rate,
    frames: i * 30,
  }))
}

for (const rate of [1, 2]) {
  test(`U-W01 full 7999/8000 ms window rate=${rate}`, () => {
    const input = samples(rate)
    const copy = structuredClone(input)
    assert.equal(assessBufferTrend(input.slice(0, -1), 7999).candidate, null)
    const result = assessBufferTrend(input, 8000)
    assert.equal(result.candidate, true)
    assert.equal(result.spanMs, 8000)
    assert.equal(result.deltaSec, -4)
    assert.equal(result.slopeSecPerSec, -0.5)
    assert.deepEqual(input, copy)
  })
  for (const gap of [1500, 1501])
    test(`U-W02 adjacent gap ${gap} ms rate=${rate}`, () => {
      const input = samples(rate)
      input[1] = { ...input[1]!, at: gap }
      assert.equal(assessBufferTrend(input, 8000).candidate, gap === 1500 ? true : null)
    })
  test(`U-W03 interpolates only a bracketed window start rate=${rate}`, () => {
    const input = [
      ...samples(rate),
      {
        ...samples(rate)[8]!,
        at: 8500,
        currentTime: 109 * rate,
        frames: 270,
        bufferAheadSec: 7.75 * rate,
      },
    ]
    const result = assessBufferTrend(input, 8500)
    assert.equal(result.interpolated, true)
    assert.equal(result.from, 500)
    assert.equal(result.startBufferSec, 11.75)
    assert.equal(result.deltaSec, -4)
  })
  for (const delta of [-1.999999, -2, -2.000001, 2])
    test(`U-S01 delta ${delta} actual seconds rate=${rate}`, () => {
      const result = assessBufferTrend(samples(rate, delta), 8000)
      assert.equal(result.candidate, delta <= -2)
      assert.equal(result.state, delta <= -2 ? 'draining' : delta >= 2 ? 'filling' : 'stable')
    })
  for (const end of [9.999999, 10, 10.000001])
    test(`U-S02 low buffer boundary ${end} actual seconds rate=${rate}`, () => {
      assert.equal(assessBufferTrend(samples(rate, -4, end), 8000).candidate, end <= 10)
    })
  for (const invalid of [NaN, Infinity, -1])
    test(`U-W04 rejects buffer ${String(invalid)} rate=${rate}`, () => {
      const input = samples(rate)
      input[5] = { ...input[5]!, bufferAheadSec: invalid }
      assert.equal(assessBufferTrend(input, 8000).reason, 'invalid-sample')
    })
  test(`U-P01 missing frames uses time only rate=${rate}`, () => {
    assert.equal(
      assessBufferTrend(
        samples(rate).map((s) => ({ ...s, frames: null })),
        8000,
      ).progressQuality,
      'time-only',
    )
  })
  for (const change of [
    'time-boundary',
    'frames-stall',
    'frames-backwards',
    'rate-change',
  ] as const)
    test(`U-P02 ${change} cannot establish continuous progress rate=${rate}`, () => {
      const input = samples(rate)
      const previous = input[3]!
      input[4] = {
        ...input[4]!,
        ...(change === 'time-boundary'
          ? { currentTime: previous.currentTime + 0.049999 }
          : change === 'rate-change'
            ? { rate: rate + 1 }
            : { frames: previous.frames! - Number(change === 'frames-backwards') }),
      }
      assert.notEqual(assessBufferTrend(input, 8000).candidate, true)
    })
}

test('U-W05 duplicate time, reversed time and oversized input stay insufficient', () => {
  for (const at of [3000, 2999]) {
    const input = samples(1)
    input[4] = { ...input[4]!, at }
    assert.equal(assessBufferTrend(input, 8000).candidate, null)
  }
  assert.equal(
    assessBufferTrend(
      Array.from({ length: 33 }, (_, i) => ({ ...samples(1)[0]!, at: i })),
      32,
    ).reason,
    'sample-overflow',
  )
})
test('U-T01 observed completions are not an instantaneous bandwidth estimate', () => {
  const rows = [
    { startedAt: -1000, completedAt: 1000, outcome: 'success' as const, bytes: 100, status: 206 },
    { startedAt: 0, completedAt: 2000, outcome: 'failure' as const, bytes: 999, status: 500 },
    { startedAt: 0, completedAt: 3000, outcome: 'abort' as const, bytes: 999, status: 0 },
  ]
  const result = summarizeBufferTransport(rows, 8000, 0)
  assert.equal(result.completedBytes, 100)
  assert.equal(result.crossWindow, 1)
  assert.deepEqual([result.successes, result.failures, result.aborts], [1, 1, 1])
  assert.equal(summarizeBufferTransport([], 8000, 0).coverage, 'none-observed')
  assert.equal(summarizeBufferTransport(rows, 8000, 1).coverage, 'partial')
  assert.equal('throughputMbps' in result, false)
})
