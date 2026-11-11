import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  startupTransition,
  type StartupStage,
  type StartupEvent,
  type StartupEffect,
} from '../../../src-v2/domain/startup-policy.ts'
import {
  restoreTransition,
  type RestoreStage,
  type RestoreEvent,
} from '../../../src-v2/domain/restore-policy.ts'
import { stallProgressTransition } from '../../../src-v2/domain/playback-progress.ts'

test('V226 startup transition table enforces exact results for every stage and event', () => {
  const accepted: Readonly<Record<string, readonly [StartupStage, readonly StartupEffect[]]>> = {
    'available/reserve': ['reserved', ['reserve-window']],
    'reserved/probe': ['probing', ['probe-window']],
    'reserved/cancel': ['cancelled', ['seal-window']],
    'probing/adequate': ['adequate', ['commit-selection', 'seal-window']],
    'probing/insufficient': ['insufficient', ['commit-selection', 'seal-window']],
    'probing/unverified': ['unverified', ['commit-selection', 'seal-window']],
    'probing/exhausted': ['exhausted', ['seal-window']],
    'probing/cancel': ['cancelled', ['seal-window']],
  }
  for (const stage of [
    'available',
    'reserved',
    'probing',
    'adequate',
    'insufficient',
    'unverified',
    'exhausted',
    'cancelled',
  ] satisfies StartupStage[]) {
    for (const event of [
      'reserve',
      'probe',
      'adequate',
      'insufficient',
      'unverified',
      'exhausted',
      'cancel',
    ] satisfies StartupEvent[]) {
      const expected = accepted[`${stage}/${event}`]
      assert.deepEqual(
        startupTransition(stage, event),
        expected
          ? { next: expected[0], effects: expected[1], reason: 'accepted' }
          : {
              next: stage,
              effects: [],
              reason: ['adequate', 'insufficient', 'unverified', 'exhausted', 'cancelled'].includes(
                stage,
              )
                ? 'terminal'
                : 'illegal-event',
            },
        `${stage}/${event}`,
      )
    }
  }
})

test('V226 restoration transition table enforces exact results for every stage and event', () => {
  const accepted: Readonly<Record<string, readonly [RestoreStage, readonly string[]]>> = {
    'position/verified': ['rate', ['restore-rate']],
    'rate/verified': ['play', ['play']],
    'play/verified': ['progress', ['confirm-progress']],
    'progress/progress-confirmed': ['complete', ['finish']],
    'position/fail': ['failed', ['finish']],
    'rate/fail': ['failed', ['finish']],
    'play/fail': ['failed', ['finish']],
    'progress/fail': ['failed', ['finish']],
    'position/cancel': ['cancelled', ['finish']],
    'rate/cancel': ['cancelled', ['finish']],
    'play/cancel': ['cancelled', ['finish']],
    'progress/cancel': ['cancelled', ['finish']],
  }
  for (const stage of [
    'position',
    'rate',
    'play',
    'progress',
    'complete',
    'failed',
    'cancelled',
  ] satisfies RestoreStage[]) {
    for (const event of [
      'verified',
      'progress-confirmed',
      'fail',
      'cancel',
    ] satisfies RestoreEvent[]) {
      const expected = accepted[`${stage}/${event}`]
      assert.deepEqual(
        restoreTransition(stage, event),
        expected
          ? { next: expected[0], effects: expected[1], reason: 'accepted' }
          : {
              next: stage,
              effects: [],
              reason: ['complete', 'failed', 'cancelled'].includes(stage)
                ? 'terminal'
                : 'illegal-event',
            },
        `${stage}/${event}`,
      )
    }
  }
})

test('V226 stall progress transition preserves a bounded confirmation count', () => {
  let state = stallProgressTransition({ phase: 'stalled', ticks: 0 }, 'progress', 0, 1000).next
  assert.equal(state.phase, 'confirming')
  state = stallProgressTransition(state, 'stalled', 0, 0).next
  assert.deepEqual(state, { phase: 'stalled', ticks: 0 })
  for (let i = 0; i < 30; i++) {
    const step = stallProgressTransition(state, 'progress', 9, (i + 1) * 1000)
    assert.equal(step.complete, false)
    state = step.next
  }
  assert.equal(state.ticks, 10)
  assert.equal(stallProgressTransition(state, 'progress', 10, 31_000).complete, true)
})
