import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  restorePositionMatches,
  restorePositionMismatch,
  restoreProgressMatches,
} from '../../../src-v2/domain/restore-policy.ts'

for (const rate of [1, 2])
  test(`V2215 restoration validates old and new rate travel without moving its baseline: ${rate}`, () => {
    const anchor = { positionSec: 100, at: 1000, rate: 1, paused: false }
    const reading = {
      positionSec: 100 + rate * 5,
      rate,
      paused: false,
      seeking: false,
      landing: { positionSec: 100, at: 1000 },
    }
    assert.equal(
      restorePositionMatches(reading, anchor, () => 6000),
      true,
    )
    assert.equal(
      restorePositionMatches({ ...reading, positionSec: 120 }, anchor, () => 6000),
      false,
    )
    assert.deepEqual(anchor, { positionSec: 100, at: 1000, rate: 1, paused: false })
  })
test('V2215 restoration unknown reads do not acquire a correction or consume the clock', () => {
  let reads = 0
  const now = () => {
    reads++
    return 6000
  }
  const reading = { positionSec: null, rate: null, paused: null, seeking: null, landing: null }
  assert.equal(restorePositionMatches(reading, null, now), false)
  assert.equal(restorePositionMismatch(reading, 100, now), false)
  assert.equal(reads, 0)
})
test('V2215 restored progress retains rate, drift and one-second position bounds', () => {
  const baseline = { at: 1000, positionSec: 100, rate: 2 }
  assert.equal(
    restoreProgressMatches(baseline, { playbackRate: 2, currentTime: 111 }, () => 6000),
    true,
  )
  assert.equal(
    restoreProgressMatches(baseline, { playbackRate: 2, currentTime: 111.001 }, () => 6000),
    false,
  )
  assert.equal(
    restoreProgressMatches(baseline, { playbackRate: 1, currentTime: 105 }, () => 6000),
    false,
  )
})
