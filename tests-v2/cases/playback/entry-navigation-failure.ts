import assert from 'node:assert/strict'
import { test } from 'node:test'
import { exerciseEntryStartup } from '../../support/entry-startup.ts'

test('V2222 entry restores native APIs when lifecycle startup fails', async (t) => {
  const result = await exerciseEntryStartup(t, 'history')
  assert.equal(result.escaped, undefined)
  assert.equal(result.installedBeforeFailure, true)
  assert.deepEqual(result.documentEventsBeforeFailure.sort(), [
    'visibilitychange',
    'webkitvisibilitychange',
  ])
  assert.deepEqual(result.windowEventsBeforeFailure, ['blur'])
  assert.ok(result.timerSerial > 0 && result.listenerSerial > 0)
  assert.equal(result.window.fetch, result.nativeFetch)
  assert.deepEqual(Object.getOwnPropertyDescriptors(result.NativeXhr.prototype), result.native)
  assert.deepEqual(Object.getOwnPropertyDescriptors(result.history), result.expectedHistory)
  assert.equal(result.window.RTCPeerConnection, result.NativePeer)
  assert.equal(Object.hasOwn(result.window, '__playinfo__'), false)
  assert.deepEqual(result.resources, {
    timers: 0,
    storage: 0,
    documentEvents: [],
    windowEvents: [],
    navigationEvents: [],
    panels: 0,
    menus: 0,
    visibilityShadow: false,
  })
})
