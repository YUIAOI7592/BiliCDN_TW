import { test } from 'node:test'
import assert from 'node:assert/strict'
import { observeBufferCycle } from '../../src-v2/domain/buffer-cycle.ts'
import type { BufferCycleInput } from '../../src-v2/domain/buffer-trend.ts'

function fixture(rate: number, buffer = 3): BufferCycleInput {
  const samples = Array.from({ length: 9 }, (_, i) => ({
    at: 12000 + i * 1000,
    bufferAheadSec: (buffer + (8 - i) / 10) * rate,
    rate,
    currentTime: 100 + i * rate,
    frames: 100 + i * 30,
  }))
  return {
    samples,
    sample: samples[8]!,
    previous: samples[7],
    state: null,
    reading: {
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
      startBufferSec: buffer + 0.8,
      endBufferSec: buffer,
      deltaSec: -0.8,
      slopeSecPerSec: -0.1,
    },
  }
}
function confirmed(rate: number, age = 1000): BufferCycleInput {
  const f = fixture(rate)
  return {
    ...f,
    state: {
      at: 19000,
      peakSec: 4,
      troughSec: 3.1,
      phase: 'falling',
      netLossSec: 0,
      lastLossAt: null,
      lastRefillAt: null,
      rangeTroughSec: null,
      cycleCreditMs: null,
      confirmation: null,
      lowConfirmation: {
        tailUsed: false,
        basis: 'steady-decline',
        confirmation: {
          anchorSec: 4,
          lowSec: 3.1,
          creditMs: 1000,
          at: 19000,
          lastLowAt: 20000 - age,
        },
      },
    },
  }
}
function run(f: BufferCycleInput) {
  const original = structuredClone(f)
  const r = observeBufferCycle(f)
  assert.deepEqual(f, original)
  assert.ok(Object.isFrozen(r.reading))
  return r
}
for (const rate of [1, 2]) {
  for (const buffer of [3.999999, 4, 4.000001])
    test(`buffer-v5 U-C threshold ${buffer} rate=${rate}`, () => {
      const r = run(fixture(rate, buffer))
      assert.equal(r.reading.candidate, false)
      assert.equal(r.state?.lowConfirmation?.basis ?? null, buffer <= 4 ? 'steady-decline' : null)
    })
  for (const elapsed of [1999, 2000])
    test(`buffer-v5 U-C actual time ${elapsed} rate=${rate}`, () => {
      const f = confirmed(rate),
        c = f.state!.lowConfirmation!
      const r = run({
        ...f,
        state: {
          ...f.state!,
          lowConfirmation: { ...c, confirmation: { ...c.confirmation, creditMs: elapsed - 1000 } },
        },
      })
      assert.equal(r.reading.lowBuffer!.creditMs, elapsed)
      assert.equal(r.reading.candidate, elapsed === 2000)
    })
  for (const age of [7999, 8000, 8001])
    test(`buffer-v5 U-W last low expiry ${age} rate=${rate}`, () => {
      const r = run(confirmed(rate, age))
      assert.equal(r.reading.lowBuffer!.creditMs, age <= 8000 ? 2000 : 0)
      assert.equal(r.reading.candidate, age <= 8000)
    })
  for (const gap of [1500, 1501])
    test(`buffer-v5 U-W gap ${gap} rate=${rate}`, () => {
      const f = fixture(rate),
        previous = { ...f.previous!, at: 20000 - gap }
      const samples = [...f.samples!.slice(0, -2), previous, f.sample]
      const r = run({ ...f, previous, samples })
      assert.equal(r.reading.candidate, gap <= 1500 ? false : null)
      assert.equal(r.state === null, gap > 1500)
    })
  for (const kind of [
    'flat',
    'tiny-refill',
    'time-boundary',
    'frame-backward',
    'frame-missing',
  ] as const)
    test(`buffer-v5 U-P window ${kind} rate=${rate}`, () => {
      const f = fixture(rate),
        samples = f.samples!.map((s) => ({ ...s }))
      const prev = samples[3]!,
        s = samples[4]!
      if (kind === 'flat') s.bufferAheadSec = prev.bufferAheadSec
      if (kind === 'tiny-refill') s.bufferAheadSec = prev.bufferAheadSec + 1e-9
      if (kind === 'time-boundary') {
        prev.currentTime = 0
        s.currentTime = 0.05
      }
      if (kind === 'frame-backward') s.frames = prev.frames! - 1
      const actual =
        kind === 'frame-missing' ? samples.map((s) => ({ ...s, frames: null })) : samples
      const r = run({ ...f, samples: actual, sample: actual[8]!, previous: actual[7] })
      assert.equal(r.reading.lowBuffer?.declineCoverageMs ?? 0, kind === 'frame-missing' ? 8000 : 0)
    })
  for (const kind of [
    'duplicate',
    'reverse',
    'NaN',
    'Infinity',
    'zero-rate',
    'insufficient',
  ] as const)
    test(`buffer-v5 U-W invalid ${kind} rate=${rate}`, () => {
      const f = confirmed(rate),
        sample = { ...f.sample }
      if (kind === 'duplicate') Object.assign(sample, { ...f.previous! })
      if (kind === 'reverse') sample.at = 18000
      if (kind === 'NaN') sample.bufferAheadSec = NaN
      if (kind === 'Infinity') sample.bufferAheadSec = Infinity
      if (kind === 'zero-rate') sample.rate = 0
      const r = run({
        ...f,
        sample,
        reading:
          kind === 'insufficient'
            ? { ...f.reading, state: 'insufficient', candidate: null }
            : f.reading,
      })
      assert.equal(r.reading.candidate, null)
      assert.deepEqual(r.state, kind === 'duplicate' ? f.state : null)
    })
  test(`buffer-v5 U-O basis change cannot borrow credit rate=${rate}`, () => {
    const f = confirmed(rate),
      r = run({ ...f, state: { ...f.state!, netLossSec: 0.5, lastLossAt: 19000 } })
    assert.equal(r.reading.lowBuffer!.basis, 'partial-cycle')
    assert.equal(r.reading.lowBuffer!.creditMs, 0)
    assert.equal(r.reading.candidate, false)
  })
  test(`buffer-v5 U-O expired debt renewed in same sample starts zero rate=${rate}`, () => {
    const f = confirmed(rate),
      r = run({
        ...f,
        state: {
          ...f.state!,
          phase: 'rising',
          peakSec: 3.5,
          netLossSec: 0.1,
          lastLossAt: 11999,
          lowConfirmation: { ...f.state!.lowConfirmation!, basis: 'partial-cycle' },
        },
      })
    assert.equal(r.reading.lowBuffer!.basis, 'partial-cycle')
    assert.equal(r.reading.lowBuffer!.creditMs, 0)
  })
  for (const credit of [0, 2000])
    test(`buffer-v5 U-R partial and complete refill credit=${credit} rate=${rate}`, () => {
      const f = confirmed(rate),
        state = {
          ...f.state!,
          netLossSec: 0.5,
          lastLossAt: 19000,
          lowConfirmation: {
            tailUsed: false,
            basis: 'partial-cycle' as const,
            confirmation: {
              anchorSec: 4,
              lowSec: 2.5,
              creditMs: credit,
              at: 19000,
              lastLowAt: 18000,
            },
          },
        }
      const previous = { ...f.previous!, bufferAheadSec: 2.5 * rate }
      const partial = run({ ...f, state, previous })
      assert.equal(partial.reading.candidate, false)
      assert.equal(partial.state!.lowConfirmation!.confirmation.creditMs, credit)
      const full = run({
        ...f,
        state,
        previous,
        sample: { ...f.sample, bufferAheadSec: 4 * rate },
        reading: { ...f.reading, endBufferSec: 4 },
      })
      assert.equal(full.reading.candidate, false)
      assert.equal(full.state!.lowConfirmation, null)
    })
  test(`buffer-v5 U-C v4 candidate and reason retain priority rate=${rate}`, () => {
    const f = confirmed(rate),
      r = run({
        ...f,
        reading: {
          ...f.reading,
          candidate: true,
          state: 'draining',
          reason: 'draining-low',
          deltaSec: -3,
        },
        state: { ...f.state!, confirmation: f.state!.lowConfirmation!.confirmation },
      })
    assert.equal(r.reading.candidate, true)
    assert.equal(r.reading.reason, 'draining-low')
  })
}
