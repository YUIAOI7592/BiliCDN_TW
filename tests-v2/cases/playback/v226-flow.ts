import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  startupTransition,
  type StartupStage,
  type StartupEvent,
} from '../../../src-v2/domain/startup-policy.ts'
import {
  restoreTransition,
  type RestoreStage,
  type RestoreEvent,
} from '../../../src-v2/domain/restore-policy.ts'
import { stallProgressTransition } from '../../../src-v2/domain/playback-progress.ts'

for (const stage of [
  'available',
  'reserved',
  'probing',
  'adequate',
  'insufficient',
  'unverified',
  'exhausted',
  'cancelled',
] satisfies StartupStage[])
  test(`V226 startup transition table is total and terminal-safe stage=${stage}`, () => {
    for (const event of [
      'reserve',
      'probe',
      'adequate',
      'insufficient',
      'unverified',
      'exhausted',
      'cancel',
    ] satisfies StartupEvent[]) {
      const result = startupTransition(stage, event)
      if (!['available', 'reserved', 'probing'].includes(stage))
        assert.deepEqual(result, { next: stage, effects: [], reason: 'terminal' })
      if (result.reason !== 'accepted') assert.deepEqual(result.effects, [])
      if (result.effects.includes('probe-window')) assert.equal(stage, 'reserved')
      if (result.effects.includes('commit-selection')) assert.equal(stage, 'probing')
    }
  })

for (const stage of [
  'position',
  'rate',
  'play',
  'progress',
  'complete',
  'failed',
  'cancelled',
] satisfies RestoreStage[])
  test(`V226 restoration transition table is total and terminal-safe stage=${stage}`, () => {
    for (const event of [
      'verified',
      'progress-confirmed',
      'fail',
      'cancel',
    ] satisfies RestoreEvent[]) {
      const result = restoreTransition(stage, event)
      if (['complete', 'failed', 'cancelled'].includes(stage))
        assert.deepEqual(result, { next: stage, effects: [], reason: 'terminal' })
      if (result.reason !== 'accepted') assert.deepEqual(result.effects, [])
      if (result.effects.includes('play')) assert.equal(stage, 'rate')
      if (result.next === 'complete' && result.reason === 'accepted')
        assert.equal(stage, 'progress')
    }
  })

test('V226 stall progress transition preserves a bounded confirmation count', () => {
  let state = stallProgressTransition({ phase: 'stalled', ticks: 0 }, 'progress', 0).next
  assert.equal(state.phase, 'confirming')
  state = stallProgressTransition(state, 'stalled', 0).next
  assert.deepEqual(state, { phase: 'stalled', ticks: 0 })
  for (let i = 0; i < 30; i++) {
    const step = stallProgressTransition(state, 'progress', 9)
    assert.equal(step.complete, false)
    state = step.next
  }
  assert.equal(state.ticks, 10)
  assert.equal(stallProgressTransition(state, 'progress', 10).complete, true)
})
