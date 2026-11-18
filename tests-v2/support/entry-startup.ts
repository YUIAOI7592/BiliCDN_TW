import assert from 'node:assert/strict'
import { type TestContext } from 'node:test'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'
import { testScope } from './scope.ts'

function trackedTarget() {
  type Options = boolean | EventListenerOptions | undefined
  const listeners: {
    type: string
    listener: EventListenerOrEventListenerObject
    capture: boolean
  }[] = []
  function indexOf(type: string, listener: EventListenerOrEventListenerObject, options: Options) {
    const capture = typeof options === 'boolean' ? options : options?.capture === true
    return listeners.findIndex(
      (row) => row.type === type && row.listener === listener && row.capture === capture,
    )
  }
  return {
    listeners,
    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: Options,
    ) {
      if (indexOf(type, listener, options) === -1) {
        const capture = typeof options === 'boolean' ? options : options?.capture === true
        listeners.push({ type, listener, capture })
      }
    },
    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: Options,
    ) {
      const index = indexOf(type, listener, options)
      if (index !== -1) listeners.splice(index, 1)
    },
  }
}

export async function exerciseEntryStartup(
  t: TestContext,
  failure: 'visibility' | 'page-assignment' | 'history' | 'none',
  throwDuringRemoval = false,
) {
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
  let documentEventsBeforeFailure: string[] = []
  let windowEventsBeforeFailure: string[] = []
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
  const pageBefore = { marker: 'before' }
  const pageAfter = { marker: 'latest' }
  if (failure === 'history' || failure === 'page-assignment')
    Object.defineProperty(history, 'replaceState', {
      get: () => replaceState,
      set: () => {
        installedBeforeFailure =
          window.fetch !== nativeFetch && NativeXhr.prototype.send !== native.send?.value
        documentEventsBeforeFailure = doc.listeners.map(({ type }) => type)
        windowEventsBeforeFailure = window.listeners.map(({ type }) => type)
        history.pushState()
        if (failure === 'page-assignment') Reflect.set(window, '__playinfo__', pageAfter)
        throw Error('controlled second History installation failure')
      },
    })
  if (failure === 'page-assignment')
    Object.defineProperty(window, '__playinfo__', {
      value: pageBefore,
      writable: true,
      configurable: true,
      enumerable: false,
    })
  if (failure === 'visibility') {
    const add = doc.addEventListener
    doc.addEventListener = (type, listener, options) => {
      add(type, listener, options)
      if (type === 'webkitvisibilitychange')
        throw Error('controlled visibility registration failure')
    }
  }
  let removalThrew = false
  if (throwDuringRemoval) {
    const remove = doc.removeEventListener
    doc.removeEventListener = (type, listener, options) => {
      remove(type, listener, options)
      if (type === 'webkitvisibilitychange') {
        removalThrew = true
        throw Error('controlled visibility removal failure')
      }
    }
  }
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
  let escaped: unknown
  try {
    runInNewContext(body, environment, { timeout: 1000 })
  } catch (error) {
    if (String(error) !== 'Error: controlled visibility registration failure') throw error
    escaped = String(error)
  }
  tasks.forEach((task) => task())
  return {
    escaped,
    removalThrew,
    installedBeforeFailure,
    documentEventsBeforeFailure,
    windowEventsBeforeFailure,
    timerSerial,
    listenerSerial,
    window,
    history,
    expectedHistory,
    nativeFetch,
    native,
    NativeXhr,
    NativePeer,
    pageAfter,
    resources: {
      timers: pending.size,
      storage: storageListeners.size,
      documentEvents: doc.listeners.map(({ type }) => type).sort(),
      windowEvents: window.listeners.map(({ type }) => type).sort(),
      navigationEvents: pageEvents.listeners.map(({ type }) => type).sort(),
      panels: panelCalls,
      menus: menuCalls,
      visibilityShadow: Object.hasOwn(doc, 'hidden') || Object.hasOwn(doc, 'visibilityState'),
    },
  }
}
