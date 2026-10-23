import { test } from 'node:test'
import assert from 'node:assert/strict'
import { confirmBufferTrend } from '../../src-v2/domain/buffer-trend.ts'
import type {
  BufferCandidateConfirmation,
  BufferTrendFacts,
  BufferTrendSample,
} from '../../src-v2/domain/buffer-trend.ts'

function fixture(rate: number) {
  let previous: BufferTrendSample = {
    at: 20000,
    bufferAheadSec: 12 * rate,
    rate,
    currentTime: 100,
    frames: 100,
  }
  let confirmation: BufferCandidateConfirmation | null = null
  return {
    step(buffer: number, ms = 1000, candidate: boolean | null = true) {
      const sample = {
        ...previous,
        at: previous.at + ms,
        bufferAheadSec: buffer * rate,
        currentTime: previous.currentTime + (ms * rate) / 1000,
        frames: (previous.frames ?? 0) + 30,
      }
      const reading = {
        at: sample.at,
        from: sample.at - 8000,
        spanMs: 8000,
        sampleCount: 9,
        interpolated: false,
        progressQuality: 'frames',
        state: candidate === null ? 'insufficient' : candidate ? 'draining' : 'stable',
        reason: candidate === null ? 'warming-up' : candidate ? 'draining-low' : 'stable',
        candidate,
        rate,
        startBufferSec: candidate ? buffer + 4 : buffer,
        endBufferSec: buffer,
        deltaSec: candidate ? -4 : 0,
        slopeSecPerSec: candidate ? -0.5 : 0,
      } satisfies BufferTrendFacts
      const input = { reading, sample, previous, confirmation }
      const before = structuredClone(input)
      const result = confirmBufferTrend(input)
      assert.deepEqual(input, before)
      confirmation = result.confirmation
      if (ms !== 0) previous = sample
      return result
    },
  }
}

for (const invalid of [0, -1, NaN, Infinity])
  test(`buffer-v3 U-W raw rate ${invalid} never uses a fallback`, () => {
    const result = fixture(invalid).step(10)
    assert.equal(result.reading.candidate, null)
    assert.equal(result.confirmation, null)
  })

for (const rate of [1, 2]) {
  for (const end of [1999, 2000])
    test(`buffer-v3 U-C cumulative ${end} ms rate=${rate}`, () => {
      const f = fixture(rate)
      assert.equal(f.step(10).confirmation!.creditMs, 0)
      assert.equal(f.step(9).reading.candidate, false)
      const result = f.step(8, end - 1000)
      assert.equal(result.confirmation!.creditMs, end)
      assert.equal(result.reading.candidate, end === 2000)
      assert.equal(result.reading.schemaVersion, 3)
      assert.equal(result.reading.algorithm, 'buffer-window-v3')
    })
  test(`buffer-v3 U-C irregular elapsed time and capped credit rate=${rate}`, () => {
    const f = fixture(rate)
    f.step(10)
    assert.equal(f.step(9, 900).confirmation!.creditMs, 900)
    assert.equal(f.step(8, 1100).reading.candidate, true)
    assert.equal(f.step(7).confirmation!.creditMs, 2000)
  })
  for (const confirmed of [false, true])
    for (const kind of ['refill', 'flat', 'above-low'] as const)
      test(`buffer-v3 U-R ${kind} revokes confirmed=${confirmed} rate=${rate}`, () => {
        const f = fixture(rate)
        f.step(10)
        f.step(8)
        if (confirmed) f.step(6)
        const low = confirmed ? 6 : 8
        if (kind === 'above-low') f.step(low + 1)
        const result = f.step(kind === 'flat' ? low : kind === 'above-low' ? low + 0.5 : low + 1)
        assert.equal(result.reading.candidate, false)
        assert.equal(
          result.reading.reason,
          kind === 'flat'
            ? 'not-decreasing'
            : kind === 'above-low'
              ? 'above-prior-low'
              : 'partial-refill',
        )
        assert.equal(result.confirmation!.creditMs, confirmed ? 2000 : 1000)
        assert.equal(f.step(low - 1).reading.candidate, true)
      })
  for (const repayment of [8.999999, 9, 9.000001])
    test(`buffer-v3 U-R repayment ${repayment} rate=${rate}`, () => {
      const f = fixture(rate)
      f.step(9, 1000, false)
      f.step(8)
      f.step(7)
      const result = f.step(repayment)
      assert.equal(result.reading.candidate, false)
      assert.equal(result.confirmation === null, repayment >= 9)
      assert.equal(result.reading.reason, repayment >= 9 ? 'candidate-repaid' : 'partial-refill')
      const next = f.step(6)
      assert.equal(next.confirmation!.creditMs, repayment >= 9 ? 0 : 2000)
    })
  for (const flag of [false, null] as const)
    test(`buffer-v3 U-W base ${flag} clears evidence rate=${rate}`, () => {
      const f = fixture(rate)
      f.step(10)
      f.step(8)
      assert.equal(f.step(7, 1000, flag).confirmation, null)
      assert.equal(f.step(6).confirmation!.creditMs, 0)
    })
  for (const gap of [1500, 1501, -1])
    test(`buffer-v3 U-W gap ${gap} ms rate=${rate}`, () => {
      const f = fixture(rate)
      f.step(10)
      const result = f.step(8, gap)
      assert.equal(result.reading.candidate, gap === 1500 ? false : null)
      assert.equal(result.confirmation?.creditMs ?? null, gap === 1500 ? 1500 : null)
    })
  test(`buffer-v3 U-W duplicate neither replaces nor credits a sample rate=${rate}`, () => {
    const f = fixture(rate)
    f.step(10)
    const state = f.step(8).confirmation
    const duplicate = f.step(1, 0)
    assert.equal(duplicate.reading.candidate, null)
    assert.equal(duplicate.confirmation, state)
    assert.equal(f.step(7).reading.candidate, true)
  })
  for (const age of [7999, 8000, 8001])
    test(`buffer-v3 U-W no new low for ${age} ms rate=${rate}`, () => {
      const f = fixture(rate)
      f.step(10)
      f.step(8)
      for (let i = 0; i < 7; i++) f.step(8)
      const result = f.step(7, age - 7000)
      assert.equal(result.confirmation!.anchorSec, age > 8000 ? 8 : 12)
      assert.equal(result.confirmation!.creditMs, age > 8000 ? 0 : age - 6000)
      assert.equal(
        result.reading.reason,
        age > 8000 ? 'candidate-expired' : age === 8000 ? 'draining-low' : 'candidate-confirming',
      )
    })
  for (const invalid of [NaN, Infinity, -1])
    test(`buffer-v3 U-W invalid buffer ${invalid} rate=${rate}`, () => {
      const f = fixture(rate)
      f.step(10)
      assert.equal(f.step(invalid).reading.candidate, null)
    })
}
