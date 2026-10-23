import { test } from 'node:test'
import assert from 'node:assert/strict'
import { observeBufferCycle } from '../../src-v2/domain/buffer-cycle.ts'
import type { BufferCycleInput } from '../../src-v2/domain/buffer-trend.ts'
import { runScenario } from '../support/buffer-shadow-scenarios.ts'

/** A public pure-function input: no controller state or product getters are inspected. */
function input(rate: number, age: number, credit: number | null): BufferCycleInput {
  return {
    previous: { at: 19000, rate, bufferAheadSec: 10 * rate, currentTime: 100, frames: 100 },
    sample: { at: 20000, rate, bufferAheadSec: 9 * rate, currentTime: 100 + rate, frames: 130 },
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
      startBufferSec: 10,
      endBufferSec: 9,
      deltaSec: -1,
      slopeSecPerSec: -0.125,
    },
    state: {
      at: 19000,
      peakSec: 12,
      troughSec: 8,
      phase: 'rising',
      netLossSec: 2,
      lastLossAt: 20000 - age,
      lastRefillAt: 19000,
      rangeTroughSec: null,
      cycleCreditMs: credit,
      confirmation: null,
    },
  }
}

for (const rate of [1, 2] as const) {
  for (const age of [7999, 8000, 8001])
    for (const credit of [null, 0, 1000, 2000])
      test(`buffer-renewal unit age=${age} old-credit=${credit} rate=${rate}`, () => {
        const value = input(rate, age, credit),
          before = structuredClone(value)
        const result = observeBufferCycle(value)
        const expected = age > 8000 || credit === null ? 0 : Math.min(2000, credit + 1000)
        assert.equal(result.state!.cycleCreditMs, expected)
        assert.equal(result.reading.candidate, expected === 2000)
        assert.equal(result.reading.cycle!.netLossSec, 2)
        assert.equal(result.reading.cycle!.lastLossAgeMs, 1000)
        assert.deepEqual(value, before)
        assert.ok(Object.isFrozen(result.state))
      })

  for (const elapsed of [1999, 2000])
    test(`buffer-renewal unit new evidence confirms at ${elapsed}ms rate=${rate}`, () => {
      const value = input(rate, 8001, 2000)
      const first = observeBufferCycle(value)
      assert.equal(first.reading.candidate, false)
      // The second transition uses the first second's state.
      const start = input(rate, 8001, 2000)
      const one = {
        ...start,
        previous: start.sample,
        sample: {
          ...start.sample,
          at: 21000,
          currentTime: 100 + 2 * rate,
          frames: 160,
          bufferAheadSec: 8 * rate,
        },
        reading: { ...start.reading, at: 21000, endBufferSec: 8 },
        state: first.state,
      }
      const middle = observeBufferCycle(one)
      const final = observeBufferCycle({
        ...one,
        previous: one.sample,
        sample: {
          ...one.sample,
          at: 20000 + elapsed,
          currentTime: 100 + 3 * rate,
          frames: 190,
          bufferAheadSec: 7 * rate,
        },
        reading: { ...one.reading, at: 20000 + elapsed, endBufferSec: 7 },
        state: middle.state,
      })
      assert.equal(final.reading.candidate, elapsed === 2000)
      assert.equal(final.state!.cycleCreditMs, elapsed)
    })

  test(`buffer-renewal unit independent short-window evidence remains valid rate=${rate}`, () => {
    const value = input(rate, 8001, 2000)
    const result = observeBufferCycle({
      ...value,
      reading: {
        ...value.reading,
        state: 'draining',
        reason: 'draining-low',
        candidate: true,
        startBufferSec: 12,
        deltaSec: -3,
        slopeSecPerSec: -0.375,
      },
      state: {
        ...value.state!,
        confirmation: {
          anchorSec: 12,
          lowSec: 10,
          creditMs: 1000,
          at: 19000,
          lastLowAt: 19000,
        },
      },
    })
    assert.equal(result.state!.cycleCreditMs, 0)
    assert.equal(result.reading.candidate, true)
    assert.equal(result.reading.reason, 'draining-low')
  })

  for (const resumed of [false, true])
    test(
      `buffer-renewal integration expired evidence ${resumed ? 'sustained decline' : 'refill'} rate=${rate}`,
      { timeout: 5000 },
      async (t) => {
        // Fixed external input, sixty healthy seconds supplied by runScenario.
        const buffers = [
          11,
          11.5,
          10.5,
          11,
          10,
          10.5,
          9.5,
          10,
          9,
          8,
          7,
          8,
          8,
          8,
          8,
          8,
          7.5,
          ...(resumed ? [7, 6.5] : [12, 12]),
          ...Array.from({ length: 20 }, () => 12),
        ]
        const result = await runScenario('observation-holdout', rate, t, {
          profile: {
            samples: buffers.map((buffer) => ({ buffer, ms: 1000, progress: true })),
            stallAt: null,
            cycleMs: null,
            fullRepayment: false,
          },
          target: {},
        })
        assert.equal(result.validity, 'valid')
        for (const a of result.assertions) assert.equal(a.verdict, 'pass', a.id)
        const at = (second: number) => result.rows.find((row) => row.at === second * 1000)!
        assert.equal(at(11).candidate, true, 'old evidence was confirmed')
        assert.equal(at(17).candidate, false, 'new debt cannot inherit expired confirmation')
        // The report combines short-window and cycle credits; it is not the cycle state.
        assert.equal(at(17).reason, 'cycle-loss-confirming')
        assert.equal(at(18).candidate, false)
        assert.equal(at(19).candidate, resumed)
        assert.deepEqual(result.effects, [])
        assert.deepEqual(result.cleanup, { timers: 0, subscriptions: 0 })
      },
    )
}
