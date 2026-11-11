import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  sustainedPlayback,
  restoredPosition,
  type RescueProgressSample,
} from '../../support/rescue-acceptance.ts'

for (const rate of [1, 2]) {
  const samples = (): RescueProgressSample[] =>
    Array.from({ length: 16 }, (_, i) => ({
      at: i * 1000,
      position: 978 + i * rate,
      frames: 100 + i * 30,
      rate,
      owner: 'media:core:user:seek',
      paused: false,
      seeking: false,
      ended: false,
      error: false,
      reloadCount: 1,
    }))
  test(`TOOL-SP good fifteen one-second intervals rate=${rate}`, () => {
    assert.equal(sustainedPlayback(samples(), rate), true)
    assert.equal(
      sustainedPlayback(
        samples().map((s) => ({ ...s, frames: null })),
        rate,
      ),
      true,
    )
  })
  if (rate === 2)
    for (const change of [
      'time',
      'frames',
      'rate',
      'owner',
      'pause',
      'seeking',
      'ended',
      'error',
      'reload',
      'gap',
      'NaN',
      'tail',
    ] as const)
      test(`TOOL-SP relapse ${change} rejects sustained acceptance rate=${rate}`, () => {
        const input = samples(),
          previous = input[7]!,
          value = input[8]!
        const patch: { -readonly [K in keyof RescueProgressSample]?: RescueProgressSample[K] } = {}
        if (change === 'time') patch.position = previous.position
        if (change === 'frames') patch.frames = previous.frames
        if (change === 'rate') patch.rate = 1
        if (change === 'owner') patch.owner = 'other'
        if (change === 'pause') patch.paused = true
        if (change === 'seeking') patch.seeking = true
        if (change === 'ended') patch.ended = true
        if (change === 'error') patch.error = true
        if (change === 'reload') patch.reloadCount = 2
        if (change === 'gap') patch.at = value.at + 1000
        if (change === 'NaN') patch.frames = NaN
        input[8] = { ...value, ...patch }
        if (change === 'tail') input.pop()
        assert.equal(sustainedPlayback(input, rate), false)
      })
  test(`TOOL-RP elapsed position correction boundaries rate=${rate}`, () => {
    for (const [error, expected] of [
      [0, true],
      [0.999999, true],
      [1, true],
      [1.000001, false],
    ] as const)
      assert.equal(restoredPosition(rate + error, 0, rate, 1000), expected, `error=${error}`)
    assert.equal(restoredPosition(0, 978, rate, 0), false)
    assert.equal(restoredPosition(NaN, 0, rate, 0), false)
  })
}
