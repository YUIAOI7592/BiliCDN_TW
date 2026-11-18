import assert from 'node:assert/strict'
import { test } from 'node:test'
import { exerciseEntryStartup } from '../../support/entry-startup.ts'

test('startup control installs transport, document listeners and the control menu', async (t) => {
  const result = await exerciseEntryStartup(t, 'none')
  assert.equal(result.escaped, undefined)
  assert.notEqual(result.window.fetch, result.nativeFetch)
  assert.notEqual(result.NativeXhr.prototype.send, result.native.send?.value)
  assert.deepEqual(result.resources.documentEvents, ['visibilitychange', 'webkitvisibilitychange'])
  assert.equal(result.resources.menus, 1)
})

test('visibility registration failure rolls back all resources acquired by the entry', async (t) => {
  const result = await exerciseEntryStartup(t, 'visibility')
  assert.deepEqual(
    {
      ...result.resources,
      escaped: result.escaped,
      fetchRestored: result.window.fetch === result.nativeFetch,
      xhrRestored: result.NativeXhr.prototype.send === result.native.send?.value,
      webRtcRestored: result.window.RTCPeerConnection === result.NativePeer,
    },
    {
      timers: 0,
      storage: 0,
      documentEvents: [],
      windowEvents: [],
      navigationEvents: [],
      panels: 0,
      menus: 0,
      visibilityShadow: false,
      escaped: undefined,
      fetchRestored: true,
      xhrRestored: true,
      webRtcRestored: true,
    },
  )
})

test('visibility rollback continues after a listener removal throws', async (t) => {
  const result = await exerciseEntryStartup(t, 'visibility', true)
  assert.equal(result.removalThrew, true)
  assert.equal(result.escaped, undefined)
  assert.deepEqual(result.resources.documentEvents, [])
  assert.deepEqual(result.resources.windowEvents, [])
  assert.equal(result.resources.storage, 0)
  assert.equal(result.resources.visibilityShadow, false)
  assert.equal(result.window.fetch, result.nativeFetch)
})

test('entry rollback keeps the latest website playinfo assignment', async (t) => {
  const result = await exerciseEntryStartup(t, 'page-assignment')
  assert.equal(result.installedBeforeFailure, true)
  assert.equal(result.escaped, undefined)
  assert.equal(result.window.fetch, result.nativeFetch)
  assert.deepEqual(Object.getOwnPropertyDescriptors(result.NativeXhr.prototype), result.native)
  assert.equal(result.resources.storage, 0)
  assert.deepEqual(Object.getOwnPropertyDescriptor(result.window, '__playinfo__'), {
    configurable: true,
    enumerable: false,
    writable: true,
    value: result.pageAfter,
  })
  assert.equal(Reflect.get(result.window, '__playinfo__'), result.pageAfter)
})

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
