import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RangeProbeAdapter } from '../../../../src-v2/adapters/transport/range-probe.ts'
import { testScope } from '../../../support/scope.ts'
import { PlayerAdapter } from '../../../../src-v2/adapters/player/player.ts'
import { playurlResult } from '../../../support/playurl.ts'
import { measuredPayload, measuredTiming } from '../../../../src-v2/domain/measurement-time.ts'

for (const [label, bytes, length, range, valid] of [
  ['consistent', 65536, '65536', 'bytes 0-65535/1000000', true],
  ['invisible', 65536, null, null, true],
  ['short', 65535, '65536', null, false],
  ['range conflict', 65536, null, 'bytes 1-65534/1000000', false],
  ['unsafe length', 65536, '9007199254740992', null, false],
] as const)
  test(`V229 completed payload validates ${label}`, () =>
    assert.equal(measuredPayload(bytes, length, range), valid))
for (const [label, start, response, end, valid] of [
  ['zero origin', 0, 10, 100, true],
  ['zero duration', 0, 0, 0, false],
  ['backward', 100, 110, 90, false],
  ['late response', 0, 101, 100, false],
  ['unavailable', null, 10, 100, false],
] as const)
  test(`V229 monotonic timing ${label}`, () =>
    assert.equal(measuredTiming(start, response, end).speedEligible, valid))

function probeFixture(
  t: import('node:test').TestContext,
  options: {
    size?: number
    limit?: number
    elapsed?: number
    cleanup?: number
    length?: string
    range?: string | null
  } = {},
) {
  const scope = testScope(t),
    controller = new AbortController()
  scope.defer(() => controller.abort('cleanup'))
  let now = 0,
    cancelled = 0,
    released = 0,
    read = false
  const size = options.size ?? 65536,
    limit = options.limit ?? 65536
  const response = {
    url: 'https://example.com/media',
    redirected: false,
    status: 206,
    headers: new Headers({
      ...(options.range === null
        ? {}
        : { 'Content-Range': options.range ?? `bytes 0-${limit - 1}/1000000` }),
      ...(options.length ? { 'Content-Length': options.length } : {}),
    }),
    body: {
      getReader: () => ({
        read: async () => {
          now = options.elapsed ?? 100
          if (read) return { done: true, value: undefined }
          read = true
          return { done: false, value: new Uint8Array(size) }
        },
        cancel: async () => {
          cancelled++
          now += options.cleanup ?? 0
        },
        releaseLock: () => {
          released++
        },
      }),
    },
    cancel: async () => undefined,
  }
  const adapter = new RangeProbeAdapter(
    (async () => {
      now = 10
      return response
    }) as unknown as typeof fetch,
    () => now,
  )
  return {
    run: () =>
      adapter.read({
        url: response.url,
        host: 'example.com',
        limit,
        signal: controller.signal,
        completionReason: 'sample-complete',
      }),
    get cancelled() {
      return cancelled
    },
    get released() {
      return released
    },
  }
}

test('V229 probe freezes elapsed before asynchronous cancellation cleanup', async (t) => {
  const f = probeFixture(t, { cleanup: 1000 }),
    result = await f.run()
  assert.equal(result.elapsedMs, 100)
  assert.equal(result.ttfbMs, 10)
  assert.equal(f.cancelled, 1)
  assert.equal(f.released, 1)
  assert.equal(result.timingBasis, 'probe-reader')
})
for (const elapsed of [0, -1, 5])
  test(`V229 probe rejects invalid duration ${elapsed} without creating speed`, async (t) => {
    const result = await probeFixture(t, { elapsed }).run()
    assert.equal(result.speedEligible, false)
    assert.equal(result.directRange, true)
    assert.equal(result.bytes, 65536)
  })
for (const [label, options] of [
  ['overshoot', { size: 131072 }],
  ['conflicting length', { length: '65535' }],
  ['short declared body', { size: 32768 }],
] as const)
  test(`V229 probe ${label} cannot create a speed sample`, async (t) => {
    const result = await probeFixture(t, options).run()
    assert.equal(result.speedEligible, false)
    assert.equal(result.receivedBytes, options.size ?? 65536)
  })
test('V229 probe unexposed range remains eligible at zero offset', async (t) => {
  const result = await probeFixture(t, { range: null }).run()
  assert.equal(result.directRange, true)
  assert.equal(result.speedEligible, true)
  assert.equal(result.receivedBytes, 65536)
})

test('V229 playback invalidation owns media listeners without granting a user operation', (t) => {
  const scope = testScope(t),
    doc = new EventTarget(),
    win = new EventTarget()
  const video = Object.assign(new EventTarget(), {
    isConnected: true,
    clientWidth: 1280,
    clientHeight: 720,
    currentTime: 10,
    duration: 120,
    playbackRate: 2,
    paused: false,
    seeking: false,
    ended: false,
    readyState: 4,
    videoWidth: 1280,
    videoHeight: 720,
    error: null,
    closest: () => null,
    parentElement: null,
    ownerDocument: doc,
    buffered: { length: 1, start: () => 0, end: () => 30 },
  })
  Object.assign(doc, { querySelectorAll: () => [video], activeElement: null })
  scope.defineGlobal('document', { configurable: true, value: doc })
  scope.defineGlobal('window', { configurable: true, value: win })
  scope.defineGlobal('unsafeWindow', { configurable: true, value: { player: {} } })
  const player = new PlayerAdapter(
    { transform: () => playurlResult(true), lifecycleKey: () => '1:0' },
    {
      scheduler: { timeout: () => () => undefined },
      isActuallyVisible: () => true,
      subscribeControlLoss: () => () => undefined,
    },
  )
  scope.defer(() => player.reset())
  const revisions: number[] = [],
    stop = player.observePlaybackInvalidation((n) => revisions.push(n))
  scope.defer(stop)
  const before = player.controls().userRevision
  for (const type of ['pause', 'play', 'ratechange', 'seeking', 'emptied', 'ended']) {
    const n = player.playbackRevision()
    video.dispatchEvent(new Event(type))
    assert.ok(player.playbackRevision() > n)
  }
  assert.equal(
    player.controls().userRevision,
    before,
    'invalidation carries no trusted user revision',
  )
  stop()
  const count = revisions.length
  player.reset()
  video.dispatchEvent(new Event('pause'))
  assert.equal(revisions.length, count)
})
