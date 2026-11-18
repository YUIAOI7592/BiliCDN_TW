import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'
import { testScope } from '../../support/scope.ts'

function trackedTarget() {
  const listeners = new Set<EventListenerOrEventListenerObject>()
  return {
    listeners,
    addEventListener(_type: string, listener: EventListenerOrEventListenerObject) {
      listeners.add(listener)
    },
    removeEventListener(_type: string, listener: EventListenerOrEventListenerObject) {
      listeners.delete(listener)
    },
  }
}

test('V2222 entry restores native APIs when lifecycle startup fails', async (t) => {
  const scope = testScope(t)
  const { outputFiles } = await build({
    entryPoints: ['src-v2/entry.ts'],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'chrome120',
  })
  const body = outputFiles[0]?.text
  assert.ok(body)

  class NativeXhr {
    open() {}
    send() {}
    abort() {}
    setRequestHeader() {}
    get readyState() {
      return 0
    }
    get response() {
      return null
    }
    get responseText() {
      return ''
    }
  }
  class NativePeer {}
  class Document {}
  const nativeFetch = async () => new Response(null, { status: 204 })
  const native = Object.getOwnPropertyDescriptors(NativeXhr.prototype)
  const pending = new Set<number>(),
    storageListeners = new Set<number>()
  const tasks: (() => void)[] = []
  let timerSerial = 0,
    listenerSerial = 0,
    panelCalls = 0,
    menuCalls = 0,
    installedBeforeFailure = false
  const startTimer = () => {
    pending.add(++timerSerial)
    return timerSerial
  }
  const clearTimer = (id: number) => pending.delete(id)
  const doc = {
    ...trackedTarget(),
    querySelectorAll: () => [],
  }
  const window = {
    ...trackedTarget(),
    fetch: nativeFetch,
    XMLHttpRequest: NativeXhr,
    RTCPeerConnection: NativePeer,
    setInterval: () => {
      panelCalls++
      return startTimer()
    },
  }
  const pushState = () => {}
  const replaceState = () => {}
  const history = { pushState, replaceState }
  Object.defineProperty(history, 'replaceState', {
    get: () => replaceState,
    set: () => {
      installedBeforeFailure =
        window.fetch !== nativeFetch && NativeXhr.prototype.send !== native.send?.value
      history.pushState()
      throw Error('controlled second History installation failure')
    },
  })
  const expectedHistory = Object.getOwnPropertyDescriptors(history)
  scope.defer(() => {
    pending.clear()
    storageListeners.clear()
    tasks.length = 0
  })
  const pageEvents = trackedTarget()
  const environment = {
    window,
    unsafeWindow: window,
    document: doc,
    Document,
    URLSearchParams,
    location: new URL('https://www.bilibili.com/video/test'),
    history,
    navigator: {},
    crypto,
    performance,
    queueMicrotask: (task: () => void) => tasks.push(task),
    setInterval: startTimer,
    clearInterval: clearTimer,
    addEventListener: pageEvents.addEventListener,
    removeEventListener: pageEvents.removeEventListener,
    GM_info: { script: { version: 'test' } },
    GM_getValue: (_key: string, fallback: unknown) => fallback,
    GM_addValueChangeListener: () => {
      storageListeners.add(++listenerSerial)
      return listenerSerial
    },
    GM_removeValueChangeListener: (id: number) => storageListeners.delete(id),
    GM_registerMenuCommand: () => menuCalls++,
  }
  assert.doesNotThrow(() => runInNewContext(body, environment, { timeout: 1000 }))
  assert.equal(installedBeforeFailure, true)
  assert.ok(timerSerial > 0 && listenerSerial > 0)
  assert.equal(window.fetch, nativeFetch)
  assert.deepEqual(Object.getOwnPropertyDescriptors(NativeXhr.prototype), native)
  assert.deepEqual(Object.getOwnPropertyDescriptors(history), expectedHistory)
  assert.equal(window.RTCPeerConnection, NativePeer)
  assert.equal(Object.hasOwn(window, '__playinfo__'), false)
  assert.equal(Object.hasOwn(doc, 'hidden'), false)
  assert.equal(Object.hasOwn(doc, 'visibilityState'), false)
  tasks.forEach((task) => task())
  assert.deepEqual(
    [
      pending.size,
      storageListeners.size,
      doc.listeners.size,
      window.listeners.size,
      pageEvents.listeners.size,
      panelCalls,
      menuCalls,
    ],
    [0, 0, 0, 0, 0, 0, 0],
  )
})
