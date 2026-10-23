import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { VisibilityAdapter } from '../../../src-v2/adapters/visibility.ts'
import { testScope } from '../../support/scope.ts'
import { fixture as runtimeFixture } from '../../support/runtime-fixture.ts'
import { FakeStorage } from '../../support/storage.ts'

function fixture(t: TestContext) {
  const scope = testScope(t)
  class Target extends EventTarget {
    readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject | null>>()
    override addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ): void {
      super.addEventListener(type, listener, options)
      const rows = this.listeners.get(type) ?? new Set()
      rows.add(listener)
      this.listeners.set(type, rows)
    }
    override removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions,
    ): void {
      super.removeEventListener(type, listener, options)
      this.listeners.get(type)?.delete(listener)
    }
    count(): number {
      return [...this.listeners.values()].reduce((n, rows) => n + rows.size, 0)
    }
  }
  class Doc extends Target {
    get hidden() {
      return true
    }
    get visibilityState() {
      return 'hidden'
    }
  }
  const document = new Doc(),
    window = new Target()
  scope.defineGlobal('Document', { configurable: true, value: Doc })
  scope.defineGlobal('document', { configurable: true, value: document })
  scope.defineGlobal('window', { configurable: true, value: window })
  const adapter = new VisibilityAdapter()
  scope.defer(() => {
    adapter.dispose()
    assert.equal(document.count(), 0)
    assert.equal(window.count(), 0)
  })
  return { scope, document, window, adapter }
}

for (const key of ['hidden', 'visibilityState'] as const) {
  for (const original of ['inherited', 'accessor', 'data'] as const) {
    test(`VIS-OWN normal ${key} restores complete ${original} descriptor`, (t) => {
      const f = fixture(t)
      if (original === 'accessor')
        Object.defineProperty(f.document, key, {
          configurable: true,
          enumerable: false,
          get: () => 'original',
          set: () => undefined,
        })
      if (original === 'data')
        Object.defineProperty(f.document, key, {
          configurable: true,
          enumerable: false,
          writable: false,
          value: 'original',
        })
      const before = Object.getOwnPropertyDescriptor(f.document, key)
      f.adapter.install()
      f.adapter.dispose()
      assert.deepEqual(Object.getOwnPropertyDescriptor(f.document, key), before)
    })
  }
  for (const replacement of [
    'getter',
    'setter',
    'data',
    'deleted',
    'enumerable',
    'configurable',
  ] as const) {
    test(`VIS-OWN newer ${key} ${replacement} survives disable and repeated dispose`, (t) => {
      const f = fixture(t)
      Object.defineProperty(f.document, key, { configurable: true, value: 'before' })
      f.adapter.install()
      const installed = Object.getOwnPropertyDescriptor(f.document, key)!
      if (replacement === 'deleted') Reflect.deleteProperty(f.document, key)
      else
        Object.defineProperty(
          f.document,
          key,
          replacement === 'getter'
            ? { ...installed, get: () => 'newer' }
            : replacement === 'setter'
              ? { ...installed, set: () => undefined }
              : replacement === 'data'
                ? { configurable: true, writable: true, value: 'newer' }
                : replacement === 'enumerable'
                  ? { ...installed, enumerable: false }
                  : { ...installed, configurable: false },
        )
      const newer = Object.getOwnPropertyDescriptor(f.document, key)
      f.adapter.setEnabled(false)
      f.adapter.dispose()
      assert.deepEqual(Object.getOwnPropertyDescriptor(f.document, key), newer)
    })
  }
  test(`VIS-OWN ${key} restoration never invokes original or newer getter`, (t) => {
    const f = fixture(t)
    let calls = 0
    const getter = () => {
      calls++
      throw Error('must not evaluate')
    }
    Object.defineProperty(f.document, key, { configurable: true, get: getter })
    f.adapter.install()
    f.adapter.dispose()
    assert.equal(Object.getOwnPropertyDescriptor(f.document, key)?.get, getter)
    f.adapter.install()
    const newer = () => {
      calls++
      throw Error('must not evaluate newer')
    }
    Object.defineProperty(f.document, key, { configurable: true, get: newer })
    f.adapter.dispose()
    assert.equal(calls, 0)
    assert.equal(Object.getOwnPropertyDescriptor(f.document, key)?.get, newer)
  })
  for (const failure of [
    'install-read',
    'install-write',
    'restore-read',
    'restore-write',
    'restore-delete',
  ] as const) {
    test(`VIS-OWN ${key} ${failure} failure preserves other cleanup and is not retried`, (t) => {
      const f = fixture(t)
      const original = { configurable: true, value: 'original' }
      if (failure !== 'restore-delete') Object.defineProperty(f.document, key, original)
      let active = true,
        failures = 0
      const fail = (phase: string, property: PropertyKey) => {
        if (active && property === key && failure.endsWith(phase)) {
          failures++
          throw Error('controlled descriptor failure')
        }
      }
      const proxy = new Proxy(f.document, {
        getOwnPropertyDescriptor(target, property) {
          fail('read', property)
          return Reflect.getOwnPropertyDescriptor(target, property)
        },
        defineProperty(target, property, descriptor) {
          fail('write', property)
          return Reflect.defineProperty(target, property, descriptor)
        },
        deleteProperty(target, property) {
          fail('delete', property)
          return Reflect.deleteProperty(target, property)
        },
      })
      f.scope.defineGlobal('document', { configurable: true, value: proxy })
      active = failure.startsWith('install')
      f.adapter.install()
      active = failure.startsWith('restore')
      assert.doesNotThrow(() => f.adapter.dispose())
      const count = failures
      f.adapter.dispose()
      assert.equal(failures, count)
      assert.equal(failures, 1)
      assert.equal(
        Object.getOwnPropertyDescriptor(
          f.document,
          key === 'hidden' ? 'visibilityState' : 'hidden',
        ),
        undefined,
      )
      assert.equal(f.document.count(), 0)
      assert.equal(f.window.count(), 0)
      active = false
    })
  }
  test(`VIS-OWN nonconfigurable ${key} permits independent installation and cleanup`, (t) => {
    const f = fixture(t)
    Object.defineProperty(f.document, key, { configurable: false, value: 'browser-owned' })
    const before = Object.getOwnPropertyDescriptor(f.document, key)
    f.adapter.install()
    f.adapter.dispose()
    assert.deepEqual(Object.getOwnPropertyDescriptor(f.document, key), before)
    assert.equal(
      Object.getOwnPropertyDescriptor(f.document, key === 'hidden' ? 'visibilityState' : 'hidden'),
      undefined,
    )
  })
}

test('VIS-OWN reinstall captures current owner and install is idempotent', (t) => {
  const f = fixture(t)
  f.adapter.install()
  const first = Object.getOwnPropertyDescriptor(f.document, 'hidden')
  f.adapter.install()
  assert.deepEqual(Object.getOwnPropertyDescriptor(f.document, 'hidden'), first)
  assert.equal(f.document.count(), 2)
  assert.equal(f.window.count(), 1)
  const newer = { configurable: true, enumerable: false, value: 'new-owner', writable: true }
  Object.defineProperty(f.document, 'hidden', newer)
  f.adapter.dispose()
  f.adapter.install()
  f.adapter.dispose()
  assert.deepEqual(Object.getOwnPropertyDescriptor(f.document, 'hidden'), newer)
})

for (const rate of [1, 2]) {
  test(`VIS-OWN integration Runtime settings preserve newer owner without extra actions rate=${rate}`, async (t) => {
    const f = fixture(t)
    class Storage extends FakeStorage {
      writes: string[] = []
      override set<T>(key: string, value: T): void {
        this.writes.push(key)
        super.set(key, value)
      }
    }
    const storage = new Storage()
    const r = runtimeFixture(t, storage, undefined, f.adapter)
    const controlStorage = new Storage()
    const control = runtimeFixture(t, controlStorage)
    r.setVideo({ ...r.video(), playbackRate: rate, effectiveRate: rate })
    control.setVideo({ ...control.video(), playbackRate: rate, effectiveRate: rate })
    for (const disabled of [true, false, true]) await control.settings.update({ disabled })
    const newer = { configurable: true, enumerable: false, get: () => true }
    Object.defineProperty(f.document, 'hidden', newer)
    await r.settings.update({ disabled: true })
    assert.deepEqual(Object.getOwnPropertyDescriptor(f.document, 'hidden'), {
      ...newer,
      set: undefined,
    })
    await r.settings.update({ disabled: false })
    await r.settings.update({ disabled: true })
    assert.deepEqual(Object.getOwnPropertyDescriptor(f.document, 'hidden'), {
      ...newer,
      set: undefined,
    })
    assert.deepEqual(r.calls, control.calls)
    assert.deepEqual(r.calls, { seeks: [], rates: [], plays: 0, reloads: 0, resets: 4 })
    assert.deepEqual(storage.writes, Array(3).fill('bilicdn.v2.settings'))
    assert.deepEqual(storage.writes, controlStorage.writes)
    assert.equal(r.recovery.snapshot().reloadCount, 0)
    for (const instance of [r, control]) {
      instance.lifecycle.dispose()
      instance.runtime.dispose()
      instance.deps.monitor.dispose()
      instance.recovery.dispose()
      instance.settings.dispose()
      instance.deps.restrictions.dispose()
      instance.deps.evidence.dispose()
      assert.equal(instance.clock.pendingCount, 0, 'owned work is released before FakeClock')
    }
    for (const item of [storage, controlStorage])
      assert.equal(
        [...item.listeners.values()].reduce((n, rows) => n + rows.size, 0),
        0,
      )
    f.adapter.dispose()
    assert.equal(f.document.count(), 0)
    assert.equal(f.window.count(), 0)
  })
}
