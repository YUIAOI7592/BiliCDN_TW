import { test } from 'node:test'
import assert from 'node:assert/strict'
import { IabEventCollector } from '../../scripts/iab-event-collector.mts'
import type { CollectorEvent } from '../../scripts/iab-event-collector.mts'
import { testScope } from '../support/scope.ts'
import { deferred } from '../support/deferred.ts'

type Event = CollectorEvent & { params: NonNullable<CollectorEvent['params']> }
const paused = (sequence: number, id: string, url = 'https://owned.invalid/video'): Event => ({
  sequence,
  method: 'Fetch.requestPaused',
  params: { requestId: id, request: { url } },
})
function fixture(
  t: Parameters<typeof testScope>[0],
  classify = (url: string) => (url.endsWith('/video') ? 'video' : 'audio'),
  limit = 12000,
) {
  const scope = testScope(t),
    calls: Array<{ method: string; params: Record<string, unknown> }> = []
  const batches: Array<{ cursor: number; events: Event[]; hasMore: boolean; truncated: boolean }> =
    []
  const reads: Array<Record<string, unknown>> = []
  const cdp = {
    async send(method: string, params: Record<string, unknown>) {
      calls.push({ method, params })
    },
    async readEvents(options: Record<string, unknown>) {
      reads.push(options)
      return batches.shift() ?? { cursor: 0, events: [], hasMore: false, truncated: false }
    },
  }
  const collector = new IabEventCollector(cdp, classify, { limit })
  scope.defer(async () => {
    await collector.cleanup()
  })
  return {
    collector,
    cdp,
    calls,
    batches,
    reads,
    add(events: Event[], more = false, truncated = false) {
      batches.push({ cursor: events.at(-1)?.sequence ?? 0, events, hasMore: more, truncated })
    },
  }
}
test('IAB collector persists cursor and holding changes through previously saved methods', async (t) => {
  const f = fixture(t)
  await f.collector.start([])
  const pump = f.collector.pump.bind(f.collector)
  f.collector.setHolding(true)
  f.add([paused(1, 'one')])
  await pump()
  assert.equal(f.collector.snapshot().held, 1)
  f.collector.setHolding(false)
  f.add([paused(2, 'two')])
  await pump()
  assert.equal(f.reads.at(-1)?.afterSequence, 1)
  assert.equal(f.collector.snapshot().held, 0)
  assert.deepEqual(
    f.calls.filter((c) => c.method === 'Fetch.continueRequest').map((c) => c.params.requestId),
    ['two', 'one'],
  )
})
test('IAB collector registers the full batch before a classification exception and releases every paused request', async (t) => {
  const f = fixture(t, () => {
    throw Error('private URL must never be logged')
  })
  await f.collector.start([])
  f.collector.setHolding(true)
  f.add([paused(1, 'one'), paused(2, 'two')])
  await f.collector.pump()
  assert.equal(f.collector.snapshot().held, 0)
  assert.equal(f.collector.snapshot().rows.length, 2)
  assert.equal(f.calls.filter((c) => c.method === 'Fetch.continueRequest').length, 2)
  assert.doesNotMatch(JSON.stringify(f.collector.snapshot()), /https|private URL/)
})
test('IAB collector drains pages once and passes nonmatching audio while holding video', async (t) => {
  const f = fixture(t)
  await f.collector.start([])
  f.collector.setHolding(true)
  f.add([paused(1, 'video')], true)
  f.add([paused(1, 'video'), paused(2, 'audio', 'https://owned.invalid/audio')])
  await f.collector.pump()
  assert.equal(f.collector.snapshot().held, 1)
  assert.equal(f.collector.snapshot().rows.length, 2)
  assert.deepEqual(
    f.calls.filter((c) => c.method === 'Fetch.continueRequest').map((c) => c.params.requestId),
    ['audio'],
  )
})
test('IAB collector truncation and capacity loss revoke holding and retain invalidity', async (t) => {
  for (const mode of ['truncated', 'capacity']) {
    const f = fixture(t, undefined, 1)
    await f.collector.start([])
    f.collector.setHolding(true)
    f.add([paused(1, 'one'), paused(2, 'two')], false, mode === 'truncated')
    await f.collector.pump()
    assert.equal(f.collector.snapshot().held, 0)
    assert.throws(() => f.collector.setHolding(true))
    assert.equal(f.collector.snapshot().dropped, true)
  }
})
test('IAB collector continuation failure retains unresolved ownership and attempts other cleanup', async (t) => {
  const f = fixture(t),
    original = f.cdp.send.bind(f.cdp)
  f.cdp.send = async (method, params) => {
    if (method === 'Fetch.continueRequest' && params.requestId === 'one')
      throw Error('out of scope')
    await original(method, params)
  }
  await f.collector.start([])
  f.add([paused(1, 'one'), paused(2, 'two')])
  await f.collector.pump()
  const cleanup = await f.collector.cleanup()
  assert.equal(cleanup.held, 1)
  assert.equal(cleanup.complete, false)
  assert.equal(cleanup.patterns, 0)
  assert.ok(
    f.calls.some((c) => c.method === 'Fetch.continueRequest' && c.params.requestId === 'two'),
  )
})
test('IAB collector rejects concurrent pumps and cannot reset an active cursor', async (t) => {
  const f = fixture(t)
  await f.collector.start([])
  const wait = deferred<{ cursor: number; events: Event[]; hasMore: boolean; truncated: boolean }>()
  f.cdp.readEvents = async () => wait.promise
  const running = f.collector.pump()
  await assert.rejects(f.collector.pump(), /Concurrent/)
  await assert.rejects(f.collector.start(), /already/)
  wait.resolve({ cursor: 1, events: [], hasMore: false, truncated: false })
  await running
  assert.equal(f.collector.snapshot().cursor, 1)
})
test('IAB collector distinguishes observed native cancellation from unresolved continuation failures', async (t) => {
  const f = fixture(t)
  await f.collector.start([])
  f.collector.setHolding(true)
  const event = paused(1, 'one')
  event.params.networkId = 'network-one'
  f.add([event])
  await f.collector.pump()
  f.add([
    {
      sequence: 2,
      method: 'Network.loadingFailed',
      params: { requestId: 'network-one', canceled: true },
    },
  ])
  await f.collector.pump()
  const result = await f.collector.cleanup()
  assert.equal(result.complete, true)
  assert.equal(result.errors.length, 0)
  assert.equal(f.calls.filter((c) => c.method === 'Fetch.continueRequest').length, 0)
})
