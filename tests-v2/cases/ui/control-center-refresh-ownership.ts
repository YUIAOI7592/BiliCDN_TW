import test, { type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { type ControlModelSources } from '../../../src-v2/ui/control-contracts.ts'
import { media } from '../../support/runtime-fixture.ts'
import { flushCommands, readSummary, ui } from './control-center-resources.ts'

function notificationUi(t: TestContext) {
  const f = ui(t)
  f.center.close()
  const listeners = new Set<() => void>()
  const monitor: ControlModelSources['monitor'] = f.deps.monitor
  monitor.subscribe = (listener) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }
  const originalMonitor = monitor.snapshot.bind(monitor)
  let buffer = 10,
    reads = 0,
    onRead: (() => void) | undefined
  monitor.snapshot = () => {
    const state = originalMonitor()
    return { ...state, video: { ...state.video, playableBufferSec: buffer } }
  }
  const originalRoutes = f.routes.snapshot.bind(f.routes)
  f.routes.snapshot = () => {
    reads++
    const action = onRead
    onRead = undefined
    action?.()
    return originalRoutes()
  }
  f.center.show()
  f.clock.advance(0)
  reads = 0
  return {
    ...f,
    listeners,
    notify() {
      for (const listener of listeners) listener()
    },
    setBuffer(value: number) {
      buffer = value
    },
    get reads() {
      return reads
    },
    onRead(action: () => void) {
      onRead = action
    },
  }
}

test('V2212 UI: 8 synchronous notifications share one latest snapshot', (t) => {
  const count = 8
  const f = notificationUi(t)
  const pending = f.clock.pendingCount
  for (let i = 0; i < count; i++) {
    f.setBuffer(20 + i)
    f.notify()
  }
  assert.equal(f.reads, 0)
  assert.equal(f.clock.pendingCount, pending + 1)
  f.clock.advance(0)
  assert.equal(f.reads, 1)
  assert.ok(f.doc.flatten().some((e) => e.textContent === (19 + count).toFixed(1)))
  f.setBuffer(45)
  f.notify()
  f.clock.advance(0)
  assert.equal(f.reads, 2, 'a later batch still refreshes')
  assert.ok(f.doc.flatten().some((e) => e.textContent === '45.0'))
})

test('V2212 UI: settings refresh immediately and supersede queued notifications', (t) => {
  const f = notificationUi(t)
  f.setBuffer(23)
  f.notify()
  f.storage.remote('bilicdn.v2.settings', {
    ...f.settings.get(),
    disabled: true,
    updatedAt: f.clock.now() + 1,
  })
  assert.equal(f.reads, 1)
  assert.ok(f.button('啟用腳本'))
  f.clock.advance(0)
  assert.equal(f.reads, 1)
})

for (const action of ['close', 'navigate', 'reopen'] as const) {
  test(`V2212 UI: ${action} revokes old queued work`, (t) => {
    const f = notificationUi(t)
    f.notify()
    if (action === 'navigate') f.button('CDN').emit('click')
    else {
      f.center.close()
      if (action === 'reopen') f.center.show()
    }
    const expected = action === 'close' ? 0 : 1
    assert.equal(f.reads, expected)
    if (action === 'reopen') {
      f.setBuffer(33)
      f.notify()
    }
    f.clock.advance(0)
    assert.equal(f.reads, expected + (action === 'reopen' ? 1 : 0))
    if (action === 'close') assert.equal(f.listeners.size, 0)
    if (action === 'reopen') assert.ok(f.doc.flatten().some((e) => e.textContent === '33.0'))
  })
}

test('V2212 UI: a notification during snapshot survives the current flush', (t) => {
  const f = notificationUi(t)
  f.onRead(() => {
    f.setBuffer(47)
    f.notify()
  })
  f.notify()
  f.clock.advance(0)
  assert.equal(f.reads, 2)
  assert.ok(f.doc.flatten().some((e) => e.textContent === '47.0'))
})

test('V2212 UI: synchronous reopen during snapshot cannot paint an obsolete model', (t) => {
  const f = notificationUi(t)
  f.onRead(() => {
    f.setBuffer(48)
    f.center.close()
    f.center.show()
  })
  f.notify()
  f.clock.advance(0)
  assert.equal(f.reads, 2)
  assert.ok(f.doc.flatten().some((e) => e.textContent === '48.0'))
})

test('V2212 UI: real request notifications preserve immediate routing and defer one display read', (t) => {
  const f = notificationUi(t),
    body = media(2212)
  assert.equal(f.playurl.transform(body, 'trusted-api').accepted, true)
  f.clock.advance(0)
  const before = f.reads
  const events: string[] = []
  f.scope.defer(f.routes.subscribe((event) => events.push(event.type)))
  f.request(body.data.dash.video[0]!.base_url)
  assert.ok(f.routes.latestRequested('video'))
  assert.deepEqual(events.slice(-2), ['request-started', 'attribution-changed'])
  assert.equal(f.reads, before)
  f.clock.advance(0)
  assert.equal(f.reads, before + 1)
})

test('V2212 UI: details remain on demand while queued refresh updates the current model', (t) => {
  const f = notificationUi(t)
  assert.equal(
    f.doc.flatten().some((e) => e.className === 'summary'),
    false,
  )
  f.setBuffer(31)
  f.notify()
  f.button('查看詳細狀態').emit('click')
  assert.equal(f.reads, 0)
  const captured = readSummary(f).textContent
  f.clock.advance(0)
  assert.equal(f.reads, 1)
  assert.equal(readSummary(f).textContent, captured, 'a tick does not rebuild captured details')
  f.button('收起詳細狀態').emit('click')
  f.button('查看詳細狀態').emit('click')
  assert.match(readSummary(f).textContent, /31/)
  assert.equal(f.reads, 1, 'details use the current shared model')
})

for (const fail of [false, true]) {
  test(`V2212 UI: ${fail ? 'failed' : 'successful'} command completion consumes old queued work`, async (t) => {
    const f = notificationUi(t)
    if (fail)
      f.storage.set = () => {
        throw Error('controlled persistence failure')
      }
    f.button('停用腳本').emit('click')
    f.setBuffer(32)
    f.notify()
    await f.storage.drain()
    await flushCommands()
    const reads = f.reads
    assert.ok(reads > 0)
    assert.equal(f.settings.get().disabled, !fail)
    if (fail) assert.ok(f.doc.flatten().some((e) => e.textContent === '設定未能保存，請稍後再試。'))
    f.clock.advance(0)
    assert.equal(f.reads, reads)
  })
}
