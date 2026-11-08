import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  controlPlaybackDemand,
  observedPlaybackDemand,
} from '../../../src-v2/domain/playback-demand.ts'

for (const [kind, bandwidth, rate, expected] of [
  ['video', 4_000_000, 1, 5],
  ['video', 4_000_000, 2, 10],
  ['video', 12_000_000, 2, 30],
  ['audio', 192_000, 2, 0.5],
] as const) {
  test(`V226 shared demand ${kind} bandwidth=${bandwidth} rate=${rate}`, () => {
    assert.equal(controlPlaybackDemand(kind, bandwidth, rate).requiredMbps, expected)
    assert.equal(observedPlaybackDemand(kind, bandwidth, rate)?.requiredMbps, expected)
  })
}
for (const value of [null, 0, NaN, Infinity, -1]) {
  test(`V226 demand missing ${String(value)} remains absent in display and explicit in controls`, () => {
    assert.equal(observedPlaybackDemand('video', value, 2), null)
    assert.equal(observedPlaybackDemand('video', 4_000_000, value), null)
    assert.equal(controlPlaybackDemand('video', value, value).requiredMbps, 10)
  })
}
test('V226 display demand rejects arithmetic overflow and underflow', () => {
  assert.equal(observedPlaybackDemand('video', Number.MAX_VALUE, Number.MAX_VALUE), null)
  assert.equal(observedPlaybackDemand('video', Number.MIN_VALUE, Number.MIN_VALUE), null)
  assert.equal(controlPlaybackDemand('video', Number.MAX_VALUE, Number.MAX_VALUE).requiredMbps, 10)
})
