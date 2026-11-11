import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  comparePlaybackControls,
  playbackFramesAdvanced,
  playbackTimeAdvanced,
} from '../src-v2/domain/playback-progress.ts'

test('playback progress facts: control identity distinguishes initial, same and changed fields without extra reads', () => {
  const before = { seekRevision: 1, userRevision: 2, mediaId: 3, coreId: 4 }
  assert.equal(comparePlaybackControls(before, null), 'initial')
  assert.equal(comparePlaybackControls({ ...before }, before), 'same')
  for (const key of ['seekRevision', 'userRevision', 'mediaId', 'coreId'] as const)
    assert.equal(comparePlaybackControls({ ...before, [key]: 9 }, before), 'changed', key)
  const reads: string[] = []
  const current = {
    get seekRevision() {
      reads.push('seek')
      return 9
    },
    get userRevision() {
      reads.push('user')
      return 2
    },
    get mediaId() {
      reads.push('media')
      return 3
    },
    get coreId() {
      reads.push('core')
      return 4
    },
  }
  assert.equal(comparePlaybackControls(current, null), 'initial')
  assert.deepEqual([...reads], [])
  assert.equal(comparePlaybackControls(current, before), 'changed')
  assert.deepEqual([...reads], ['seek'])
})

test('playback progress facts: time and frame comparisons keep strict boundaries without policy', () => {
  assert.equal(playbackTimeAdvanced(0.05, 0), false)
  assert.equal(playbackTimeAdvanced(0.050001, 0), true)
  assert.equal(playbackTimeAdvanced(0, 1), false)
  assert.equal(playbackTimeAdvanced(NaN, 0), false)
  assert.equal(playbackFramesAdvanced(1, 1), false)
  assert.equal(playbackFramesAdvanced(2, 1), true)
  assert.equal(playbackFramesAdvanced(0, 1), false)
})
