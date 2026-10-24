import { test } from 'node:test'
import assert from 'node:assert/strict'
import { observeBufferCycle } from '../../src-v2/domain/buffer-cycle.ts'
import type { BufferCycleInput } from '../../src-v2/domain/buffer-trend.ts'

function fixture(rate: number, end = 0.5, coverage = 2000): BufferCycleInput {
  const values = [2, 0.1, 2, 2, 2, end + 0.2, end + 0.2, end + 0.1, end]
  const samples = values.map((value, i) => ({
    at: i === 6 ? 20000 - coverage : 12000 + i * 1000,
    bufferAheadSec: value * rate,
    rate,
    currentTime: 100 + i * rate,
    frames: i * 30,
  }))
  return {
    samples,
    sample: samples[8]!,
    previous: samples[7],
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
      startBufferSec: 2,
      endBufferSec: end,
      deltaSec: end - 2,
      slopeSecPerSec: (end - 2) / 8,
    },
    state: {
      at: 19000,
      peakSec: 2,
      troughSec: 0,
      phase: 'falling',
      netLossSec: 0.5,
      lastLossAt: 15000,
      lastRefillAt: 14000,
      rangeTroughSec: 0,
      cycleCreditMs: null,
      confirmation: null,
      lowConfirmation: Object.assign(
        {
          basis: 'partial-cycle' as const,
          confirmation: { at: 19000, anchorSec: 2, lowSec: 0, creditMs: 2000, lastLowAt: 13000 },
        },
        { tailUsed: false },
      ),
    },
  }
}
function run(f: BufferCycleInput) {
  const before = structuredClone(f),
    r = observeBufferCycle(f)
  assert.deepEqual(f, before)
  assert.ok(Object.isFrozen(r.reading))
  return r
}
for (const rate of [1, 2]) {
  test(`buffer-v6 U-T bounded tail at positive low buffer rate=${rate}`, () => {
    const r = run(fixture(rate))
    assert.equal(r.reading.candidate, true)
    assert.equal(r.reading.reason, 'low-buffer-tail')
    assert.equal(Reflect.get(r.state!.lowConfirmation!, 'tailUsed'), true)
  })
  for (const buffer of [0, 0.999999, 1, 1.000001])
    test(`buffer-v6 U-T buffer=${buffer} rate=${rate}`, () => {
      const r = run(fixture(rate, buffer))
      assert.equal(r.reading.candidate, buffer > 0 && buffer <= 1)
    })
  for (const coverage of [1999, 2000, 2001])
    test(`buffer-v6 U-T actual decline coverage=${coverage} rate=${rate}`, () => {
      assert.equal(run(fixture(rate, 0.5, coverage)).reading.candidate, coverage >= 2000)
    })
  for (const credit of [0, 1999, 2000])
    test(`buffer-v6 U-T prior credit=${credit} rate=${rate}`, () => {
      const f = fixture(rate)
      Object.assign(f.state!.lowConfirmation!.confirmation, { creditMs: credit })
      assert.equal(run(f).reading.candidate, credit === 2000)
    })
  for (const age of [7999, 8000, 8001])
    for (const kind of ['low', 'debt'] as const)
      test(`buffer-v6 U-W ${kind} age=${age} rate=${rate}`, () => {
        const f = fixture(rate)
        if (kind === 'low')
          Object.assign(f.state!.lowConfirmation!.confirmation, { lastLowAt: 20000 - age })
        else Object.assign(f.state!, { lastLossAt: 20000 - age })
        assert.equal(run(f).reading.candidate, age <= 8000)
      })
  for (const kind of [
    'used',
    'flat',
    'refill',
    'repaid',
    'duplicate',
    'reverse',
    'gap',
    'insufficient',
    'bad-rate',
    'NaN',
    'Infinity',
    'basis',
    'expired-renewal',
  ] as const)
    test(`buffer-v6 U-Q revoke or retain ${kind} rate=${rate}`, () => {
      const f = fixture(rate)
      if (kind === 'used') Object.assign(f.state!.lowConfirmation!, { tailUsed: true })
      if (kind === 'flat' || kind === 'refill')
        Object.assign(f.previous!, { bufferAheadSec: (kind === 'flat' ? 0.5 : 0.4) * rate })
      if (kind === 'repaid')
        Object.assign(f.state!.lowConfirmation!.confirmation, { anchorSec: 0.5 })
      if (kind === 'duplicate') Object.assign(f.sample, f.previous)
      if (kind === 'reverse') Object.assign(f.sample, { at: 18000 })
      if (kind === 'gap') Object.assign(f.previous!, { at: 18499 })
      if (kind === 'insufficient')
        Object.assign(f.reading, { candidate: null, state: 'insufficient' })
      if (kind === 'bad-rate') Object.assign(f.sample, { rate: 0 })
      if (kind === 'NaN' || kind === 'Infinity')
        Object.assign(f.sample, { bufferAheadSec: Number(kind) })
      if (kind === 'basis') Object.assign(f.state!.lowConfirmation!, { basis: 'steady-decline' })
      if (kind === 'expired-renewal')
        Object.assign(f.state!, { lastLossAt: 11999, phase: 'rising' })
      const r = run(f)
      assert.notEqual(r.reading.candidate, true)
      if (kind === 'duplicate') assert.deepEqual(r.state, f.state)
      if (kind === 'used') assert.equal(r.reading.reason, 'low-buffer-tail-used')
      if (kind === 'expired-renewal')
        assert.equal(r.state!.lowConfirmation!.confirmation.creditMs, 0)
    })
  for (const bad of [undefined, null, 1, 'true'])
    test(`buffer-v6 U-Q inconsistent marker ${String(bad)} rate=${rate}`, () => {
      const f = fixture(rate)
      Object.assign(f.state!.lowConfirmation!, { tailUsed: bad })
      const r = run(f)
      assert.notEqual(r.reading.candidate, true)
      assert.equal(r.state, null)
    })
  test(`buffer-v6 U-Q original candidate does not spend tail rate=${rate}`, () => {
    const f = fixture(rate)
    Object.assign(f.state!.lowConfirmation!.confirmation, { lowSec: 0.6 })
    const r = run(f)
    assert.equal(r.reading.candidate, true)
    assert.equal(r.reading.reason, 'low-buffer-cycle')
    assert.equal(Reflect.get(r.state!.lowConfirmation!, 'tailUsed'), false)
  })
  test(`buffer-v6 U-Q used proof survives refill flat new low and original true rate=${rate}`, () => {
    const f = fixture(rate)
    Object.assign(f.state!.lowConfirmation!.confirmation, { lowSec: 0.2, lastLowAt: 19000 })
    let r = run(f),
      previous = f.sample,
      samples = [...f.samples!]
    assert.equal(r.reading.reason, 'low-buffer-tail')
    for (const [i, buffer] of [0.6, 0.6, 0.4, 0.1, 0.5, 0.4, 0.3].entries()) {
      const sample = {
        ...previous,
        at: previous.at + 1000,
        currentTime: previous.currentTime + rate,
        frames: previous.frames! + 30,
        bufferAheadSec: buffer * rate,
      }
      samples.push(sample)
      while (samples.length > 1 && samples[1]!.at <= sample.at - 8000) samples.shift()
      r = run({
        sample,
        previous,
        samples,
        state: r.state,
        reading: { ...f.reading, at: sample.at, from: sample.at - 8000, endBufferSec: buffer },
      })
      assert.equal(Reflect.get(r.state!.lowConfirmation!, 'tailUsed'), true)
      assert.notEqual(r.reading.reason, 'low-buffer-tail')
      if (i === 3) assert.equal(r.reading.candidate, true)
      else assert.equal(r.reading.candidate, false)
      previous = sample
    }
  })
  for (const gap of [1500, 1501])
    test(`buffer-v6 U-W interval ${gap} rate=${rate}`, () => {
      const f = fixture(rate)
      Object.assign(f.previous!, { at: 20000 - gap })
      Object.assign(f.state!, { at: 20000 - gap })
      Object.assign(f.state!.lowConfirmation!.confirmation, { at: 20000 - gap })
      assert.equal(run(f).reading.candidate, gap === 1500 ? true : null)
    })
  for (const kind of ['time-boundary', 'same-frame', 'back-frame', 'missing-frame'] as const)
    test(`buffer-v6 U-P decline requires progress ${kind} rate=${rate}`, () => {
      const f = fixture(rate)
      if (kind === 'time-boundary') {
        Object.assign(f.previous!, { currentTime: 0 })
        Object.assign(f.sample, { currentTime: 0.05 })
      } else if (kind === 'missing-frame')
        for (const sample of f.samples!) Object.assign(sample, { frames: null })
      else
        Object.assign(f.sample, { frames: f.previous!.frames! - (kind === 'back-frame' ? 1 : 0) })
      assert.equal(run(f).reading.candidate, kind === 'missing-frame')
    })
}
