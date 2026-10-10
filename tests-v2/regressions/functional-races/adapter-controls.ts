import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BrowserNavigation } from '../../../src-v2/adapters/navigation.ts'
import { PagePlayinfoAdapter } from '../../../src-v2/adapters/page-playinfo.ts'
import { PlayerAdapter } from '../../../src-v2/adapters/player.ts'
import { VisibilityAdapter } from '../../../src-v2/adapters/visibility.ts'
import { WebRtcAdapter } from '../../../src-v2/adapters/webrtc.ts'
import { RangeProbeAdapter } from '../../../src-v2/adapters/range-probe.ts'
import { BrowserScheduler } from '../../../src-v2/adapters/scheduler.ts'
import { SettingsStore } from '../../../src-v2/state/settings-store.ts'
import { FakeStorage } from '../../support/storage.ts'
import { testScope } from '../../support/scope.ts'
import { deferred } from '../../support/deferred.ts'
import { playurlResult } from '../../support/playurl.ts'

test('CONTROL navigation: disposed queued callbacks cannot notify and newer owner survives', t => {
  const scope = testScope(t), tasks: (() => void)[] = [], events = new EventTarget()
  let count = 0
  const history = { pushState: () => undefined, replaceState: () => undefined }
  scope.defineGlobal('history', { configurable: true, value: history })
  scope.defineGlobal('location', { configurable: true, value: new URL('https://www.bilibili.com/video/BVsynthetic?p=2') })
  scope.defineGlobal('queueMicrotask', { configurable: true, value: (fn: () => void) => tasks.push(fn) })
  scope.defineGlobal('addEventListener', { configurable: true, value: events.addEventListener.bind(events) })
  scope.defineGlobal('removeEventListener', { configurable: true, value: events.removeEventListener.bind(events) })
  const navigation = new BrowserNavigation(), stop = navigation.subscribe(() => count++)
  scope.defer(stop)
  assert.equal(navigation.key(), '/video/BVsynthetic?p=2')
  history.pushState()
  const newer = () => undefined; history.pushState = newer
  stop(); tasks.forEach(fn => fn()); events.dispatchEvent(new Event('popstate'))
  assert.equal(count, 0); assert.equal(history.pushState, newer)
})

test('CONTROL page hint: strict rejection cannot enter page setter; newer property owner survives dispose', t => {
  const scope = testScope(t), seen: unknown[] = [], page: { __playinfo__?: unknown } = {}
  let current: unknown
  Object.defineProperty(page, '__playinfo__', { configurable: true, get: () => current, set: value => { current = value; seen.push(value) } })
  scope.defineGlobal('unsafeWindow', { configurable: true, value: page })
  const adapter = scope.own(new PagePlayinfoAdapter(value => typeof value === 'object' && value !== null, () => true))
  adapter.install(); page.__playinfo__ = 'unsupported'; assert.deepEqual(seen, [])
  const good = { code: 0 }; page.__playinfo__ = good; assert.deepEqual(seen, [good])
  const newer = () => 'site-owned'; Object.defineProperty(page, '__playinfo__', { configurable: true, get: newer })
  adapter.dispose(); assert.equal(Object.getOwnPropertyDescriptor(page, '__playinfo__')?.get, newer)
})

test('CONTROL WebRTC: disable restores original APIs and newer owner is preserved', async t => {
  const scope = testScope(t), store = scope.own(new SettingsStore(new FakeStorage(), () => 100))
  const original = function RTCPeerConnection() {}, page = { RTCPeerConnection: original }
  scope.defineGlobal('unsafeWindow', { configurable: true, value: page })
  const adapter = scope.own(new WebRtcAdapter(store)); adapter.install()
  assert.equal(page.RTCPeerConnection, undefined)
  await store.update({ disabled: true }); assert.equal(page.RTCPeerConnection, original)
  await store.update({ disabled: false }); assert.equal(page.RTCPeerConnection, undefined)
  const newer = function SitePeer() {}
  Object.defineProperty(page, 'RTCPeerConnection', { configurable: true, value: newer })
  adapter.dispose(); assert.equal(page.RTCPeerConnection, newer)
})

test('CONTROL visibility: foreground spoof retains actual hidden state and disable restores native state', t => {
  const scope = testScope(t)
  class Doc extends EventTarget { get hidden() { return true }; get visibilityState() { return 'hidden' } }
  const document = new Doc(), window = new EventTarget()
  scope.defineGlobal('Document', { configurable: true, value: Doc })
  scope.defineGlobal('document', { configurable: true, value: document })
  scope.defineGlobal('window', { configurable: true, value: window })
  const adapter = scope.own(new VisibilityAdapter()); adapter.install()
  assert.equal(document.hidden, false); assert.equal(document.visibilityState, 'visible')
  assert.equal(adapter.isActuallyVisible(), false)
  adapter.setEnabled(false); assert.equal(document.hidden, true); assert.equal(document.visibilityState, 'hidden')
})

test('CONTROL player: disconnecting cached video changes snapshot and buffer accounts for playback rate', t => {
  const scope = testScope(t)
  const video = (time: number) => ({ isConnected: true, clientWidth: 1280, clientHeight: 720, currentTime: time,
    duration: 120, playbackRate: 2, buffered: { length: 1, start: () => time, end: () => time + 20 },
    paused: false, seeking: false, ended: false, readyState: 4, videoWidth: 1280, videoHeight: 720,
    getVideoPlaybackQuality: () => ({ totalVideoFrames: 500 }), error: null })
  const first = video(10), second = video(60)
  let videos = [first]
  scope.defineGlobal('document', { configurable: true, value: { querySelectorAll: () => videos } })
  scope.defineGlobal('unsafeWindow', { configurable: true, value: { player: {} } })
  const adapter = new PlayerAdapter({ transform: () => playurlResult(true), lifecycleKey: () => '1:0' },
    { scheduler: { timeout: () => () => undefined }, isActuallyVisible: () => true })
  scope.defer(() => adapter.reset())
  assert.equal(adapter.snapshot().playableBufferSec, 10)
  first.isConnected = false; videos = [first, second]
  assert.equal(adapter.snapshot().currentTime, 60)
})

test('CONTROL range: native body read failure is rejected as evidence and lock released', async t => {
  const scope = testScope(t), body = new ReadableStream<Uint8Array>({ pull(c) { c.error(new Error('synthetic body failure')) } })
  scope.defer(async () => { if (!body.locked) await body.cancel().catch(() => undefined) })
  const response = new Response(body, { status: 206 })
  Object.defineProperty(response, 'url', { value: 'https://upos-sz-mirrorali.bilivideo.com/test.m4s' })
  const probe = new RangeProbeAdapter(async () => response, () => 100)
  const result = await probe.read({ url: response.url, host: 'upos-sz-mirrorali.bilivideo.com', signal: new AbortController().signal,
    limit: 65536, completionReason: 'enough' })
  assert.equal(result.directRange, false); assert.equal(result.reason, 'network'); assert.equal(body.locked, false)
})

test('CONTROL scheduler: cancelling pending timer leaves only the completion signal', async t => {
  const scope = testScope(t), scheduler = new BrowserScheduler(), done = deferred<void>()
  let calls = 0
  const cancel = scheduler.timeout(() => calls++, 0); scope.defer(cancel); cancel()
  scope.defer(scheduler.timeout(() => done.resolve(), 0))
  await done.promise
  assert.equal(calls, 0)
})
