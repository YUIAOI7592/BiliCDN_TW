import { test } from 'node:test'
import assert from 'node:assert/strict'
import { observeBufferCycle as subject } from '../../src-v2/domain/buffer-cycle.ts'
import type { BufferTrendFacts, BufferTrendSample } from '../../src-v2/domain/buffer-trend.ts'
function fixture(rate: number) {
  let previous: BufferTrendSample = {
    at: 60000,
    currentTime: 100,
    frames: 100,
    rate,
    bufferAheadSec: 12 * rate,
  }
  let state: Parameters<typeof subject>[0]['state'] = null
  return {
    step(buffer: number, ms = 1000, base: boolean | null = buffer <= 10) {
      const sample = {
        ...previous,
        at: previous.at + ms,
        bufferAheadSec: buffer * rate,
        currentTime: previous.currentTime + (ms * rate) / 1000,
        frames: (previous.frames ?? 0) + 30,
      }
      const reading: BufferTrendFacts = {
        at: sample.at,
        from: sample.at - 8000,
        spanMs: 8000,
        sampleCount: 9,
        interpolated: false,
        progressQuality: 'frames',
        state: base === null ? 'insufficient' : base ? 'draining' : 'stable',
        reason: base === null ? 'invalid-sample' : base ? 'draining-low' : 'stable',
        candidate: base,
        rate,
        startBufferSec: base ? buffer + 4 : buffer,
        endBufferSec: buffer,
        deltaSec: base ? -4 : 0,
        slopeSecPerSec: base ? -0.5 : 0,
      }
      const input = { reading, sample, previous, state }
      const before = structuredClone(input)
      const result = subject(input)
      assert.deepEqual(input, before)
      state = result.state
      if (ms !== 0) previous = sample
      return result
    },
  }
}
for (const rate of [1, 2]) {
  for (const age of [7999, 8000, 8001])
    test(`buffer-v4 U-W cycle evidence age ${age}ms rate=${rate}`, () => {
      const previous: BufferTrendSample = {
        at: 19000,
        rate,
        bufferAheadSec: 9 * rate,
        currentTime: 100,
        frames: 100,
      }
      const sample = {
        ...previous,
        at: 20000,
        bufferAheadSec: 8 * rate,
        currentTime: 100 + rate,
        frames: 130,
      }
      const reading: BufferTrendFacts = {
        at: 20000,
        from: 12000,
        spanMs: 8000,
        sampleCount: 9,
        interpolated: false,
        progressQuality: 'frames',
        state: 'stable',
        reason: 'stable',
        candidate: false,
        rate,
        startBufferSec: 9,
        endBufferSec: 8,
        deltaSec: -1,
        slopeSecPerSec: -0.125,
      }
      const state = {
        at: 19000,
        peakSec: 12,
        troughSec: 9,
        phase: 'falling' as const,
        netLossSec: 2,
        lastLossAt: 20000 - age,
        lastRefillAt: 18000,
        rangeTroughSec: null,
        cycleCreditMs: 1000,
        confirmation: null,
      }
      const input = { reading, sample, previous, state }
      const before = structuredClone(input)
      const result = subject(input)
      assert.deepEqual(input, before)
      assert.equal(result.reading.candidate, age <= 8000)
      assert.equal(result.state!.netLossSec, age <= 8000 ? 2 : 0)
    })
  for (const gap of [1500, 1501])
    test(`buffer-v4 U-W cycle evidence sampling gap ${gap}ms rate=${rate}`, () => {
      const previous: BufferTrendSample = {
        at: 19000,
        rate,
        bufferAheadSec: 9 * rate,
        currentTime: 100,
        frames: 100,
      }
      const sample = {
        ...previous,
        at: 19000 + gap,
        bufferAheadSec: 8 * rate,
        currentTime: 100 + rate,
        frames: 130,
      }
      const reading: BufferTrendFacts = {
        at: sample.at,
        from: sample.at - 8000,
        spanMs: 8000,
        sampleCount: 9,
        interpolated: false,
        progressQuality: 'frames',
        state: 'stable',
        reason: 'stable',
        candidate: false,
        rate,
        startBufferSec: 9,
        endBufferSec: 8,
        deltaSec: -1,
        slopeSecPerSec: -0.125,
      }
      const state = {
        at: 19000,
        peakSec: 12,
        troughSec: 9,
        phase: 'falling' as const,
        netLossSec: 2,
        lastLossAt: 19000,
        lastRefillAt: 18000,
        rangeTroughSec: null,
        cycleCreditMs: 1000,
        confirmation: null,
      }
      const result = subject({ reading, sample, previous, state })
      assert.equal(result.state === null, gap === 1501)
      assert.equal(result.reading.candidate, gap === 1500 ? true : null)
    })
  test(`buffer-v4 U-R tiny unpaid cycles cannot restart a normal range candidate rate=${rate}`, () => {
    const f = fixture(rate)
    const candidates: number[] = []
    let buffer = 12
    for (let second = 1; second <= 120; second++) {
      buffer += second % 6 ? -1 : 5 * (1 - 1e-9)
      if (f.step(buffer).reading.candidate) candidates.push(second)
    }
    assert.deepEqual(candidates, [4, 5])
  })
  for (const elapsed of [1999, 2000])
    test(`buffer-v4 U-C cycle evidence confirms at ${elapsed}ms rate=${rate}`, () => {
      const f = fixture(rate)
      for (const b of [11, 11.5, 10.5, 11, 10, 10.5, 9.5, 10, 9]) f.step(b, 1000, false)
      assert.equal(f.step(8, 1000, false).reading.candidate, false)
      const result = f.step(7, elapsed - 1000, false)
      assert.equal(result.reading.candidate, elapsed === 2000)
      assert.equal(result.reading.cycle!.creditMs, elapsed)
    })
  test(`buffer-v4 U-C slow cycle debt can confirm without the short-window threshold rate=${rate}`, () => {
    const f = fixture(rate)
    let buffer = 12
    const candidates: number[] = []
    for (let second = 1; second <= 88; second++) {
      buffer = Math.max(0, buffer + (second % 2 ? -1 : 0.75))
      if (f.step(buffer, 1000, false).reading.candidate) candidates.push(second)
    }
    assert.ok(candidates.length > 0)
    assert.ok(candidates[0]! <= 86)
    assert.ok(candidates.at(-1)! >= 84)
  })
  test(`buffer-v4 U-R complete refill suppresses repeated candidates in the same envelope rate=${rate}`, () => {
    const f = fixture(rate)
    const candidates: number[] = []
    for (let second = 1; second <= 120; second++)
      if (f.step(12 - (second % 6)).reading.candidate) candidates.push(second)
    assert.deepEqual(candidates, [4, 5])
  })
  for (const elapsed of [1999, 2000])
    test(`buffer-v4 U-C unchanged fast confirmation ${elapsed}ms rate=${rate}`, () => {
      const f = fixture(rate)
      assert.equal(f.step(10).reading.candidate, false)
      assert.equal(f.step(9).reading.candidate, false)
      assert.equal(f.step(8, elapsed - 1000).reading.candidate, elapsed === 2000)
    })
  test(`buffer-v4 U-W invalid data clears cycle evidence rate=${rate}`, () => {
    const f = fixture(rate)
    f.step(10)
    f.step(8)
    const invalid = f.step(NaN, 1000, null)
    assert.equal(invalid.reading.candidate, null)
    assert.equal(invalid.state, null)
    assert.equal(f.step(7, 1000, null).reading.candidate, null)
  })
  test(`buffer-v4 U-W duplicate time cannot earn confirmation credit rate=${rate}`, () => {
    const f = fixture(rate)
    f.step(10)
    assert.equal(f.step(9).reading.candidate, false)
    assert.equal(f.step(1, 0).reading.candidate, null)
    assert.equal(f.step(8).reading.candidate, true)
  })
}
