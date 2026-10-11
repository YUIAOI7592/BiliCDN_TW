import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { PlayerAdapter } from '../../../src-v2/adapters/player.ts'
import { RecoveryController } from '../../../src-v2/application/recovery-controller.ts'
import { FakeClock } from '../../support/clock.ts'
import { testScope } from '../../support/scope.ts'
import { deferred } from '../../support/deferred.ts'

// BR-09 regression contracts: native HAVE_NOTHING target ownership.
// readyState=0 currentTime writes do not start native seeking; native Chrome
// counterpart is preserved in br09-native-media.json.
function fixture(t: TestContext, rate: 1 | 2 = 1) {
  const scope = testScope(t), clock = scope.own(new FakeClock())
  class ElementBoundary extends EventTarget {
    parentElement: ElementBoundary | null = null
    closest(): ElementBoundary | null { return this.parentElement }
    contains(target: unknown): boolean { return target === this || target instanceof ElementBoundary && target.parentElement === this }
  }
  class MediaBoundary extends ElementBoundary {
    isConnected = true; clientWidth = 1280; clientHeight = 720
    #position = 120
    onRead: (() => void) | null = null
    get currentTime(): number { const position = this.#position, action = this.onRead; this.onRead = null; action?.(); return position }
    set currentTime(value: number) { this.#position = value }
    duration = 3910; paused = false; seeking = false; ended = false
    readyState = 4; videoWidth = 1280; videoHeight = 720; playbackRate: number = rate
    frames = 100; error: MediaError | null = null
    buffered: TimeRanges = { length: 0, start() { throw new RangeError('No buffer') }, end() { throw new RangeError('No buffer') } }
    getVideoPlaybackQuality(): VideoPlaybackQuality { return { totalVideoFrames: this.frames, droppedVideoFrames: 0, corruptedVideoFrames: 0, creationTime: 0 } }
  }
  const region = new ElementBoundary()
  let video = new MediaBoundary(); video.parentElement = region
  const document = new EventTarget(), window = new EventTarget()
  for (const [name, value] of Object.entries({ document, window, Node: ElementBoundary, Element: ElementBoundary, HTMLElement: ElementBoundary }))
    scope.defineGlobal(name, { configurable: true, value })
  let core: { state: { initialized: boolean }; getMpd(): { video: object[] } } | null = null
  const makeCore = () => ({ state: { initialized: true }, getMpd: () => ({ video: [{}] }) })
  core = makeCore()
  const effects = { reloads: 0, seeks: [] as number[], plays: 0 }
  let onReload = () => {}, reloadResult: unknown, reloadError: Error | null = null, lifecycle = 'br09-synthetic'
  const site = {
    __core: () => core,
    // Model the actual site's reader: native readyState<1 returns cached SDK time.
    getCurrentTime: () => video.readyState < 1 ? 120 : video.currentTime,
    getPlaybackRate: () => video.playbackRate,
    seek(position: number) { effects.seeks.push(position); video.currentTime = position;
      if (video.readyState >= 1) { video.seeking = true; video.dispatchEvent(new Event('seeking')) } },
    setPlaybackRate(rate: number) { video.playbackRate = rate },
    play() { effects.plays++; video.paused = false },
    reload() { effects.reloads++; core = null; video.paused = true; video.readyState = 0;
      video.currentTime = 0; video.videoWidth = 0; video.videoHeight = 0; video.frames = 0
      onReload(); if (reloadError) throw reloadError; return reloadResult },
  }
  let activeSite = site
  class Player extends PlayerAdapter {
    protected override player() { return activeSite }
    override video(): HTMLVideoElement { return video as unknown as HTMLVideoElement }
  }
  const player = new Player({ lifecycleKey: () => lifecycle, transform: () => ({ accepted: false,
    formats: [], videoCount: 0, audioCount: 0, segmentCount: 0, upstreamCode: 0, reason: null }) },
    { scheduler: clock, isActuallyVisible: () => true, subscribeControlLoss: () => () => undefined })
  scope.defer(() => player.reset())
  const recovery = scope.own(new RecoveryController(player, clock.now))
  recovery.tick(player.snapshot())
  const beginReload = () => {
    recovery.armStall(player.snapshot(), { id: 1, startedAt: clock.now(), targetSec: 120, valid: () => true })
    clock.advance(30_000); recovery.tick(player.snapshot())
    assert.equal(effects.reloads, 1)
    assert.equal(player.snapshot().readyState, 0)
    assert.equal(recovery.isRecovering(), true)
  }
  const ready = () => { core = makeCore(); video.readyState = 2; video.videoWidth = 1280; video.videoHeight = 720 }
  return { player, recovery, clock, effects, get video() { return video }, site, beginReload, ready,
    onReload: (listener: () => void) => { onReload = listener }, reloadResult: (value: unknown) => { reloadResult = value },
    reloadError: (value: Error | null) => { reloadError = value },
    lifecycle: (value: string) => { lifecycle = value },
    replacePlayer: () => { activeSite = { ...site } },
    replaceVideo: (position: number) => { video = new MediaBoundary(); video.parentElement = region; video.readyState = 0; video.currentTime = position } }
}

test('BR-09 correct contract: an uninitialized native target change revokes stale position restoration', t => {
  const f = fixture(t); f.beginReload()
  f.video.currentTime = 978 // Site internal seek bypasses the public SDK method.
  assert.equal(f.video.seeking, false)
  f.player.controls(); f.ready(); f.clock.advance(1000); f.recovery.tick(f.player.snapshot())
  assert.deepEqual(f.effects.seeks, [], 'a newer finite SDK/native target cannot be overwritten by the pre-reload position')
  assert.equal(f.video.currentTime, 978)
})

test('BR-09 correct contract: the same unknown target change to zero also revokes stale restoration', t => {
  const f = fixture(t); f.beginReload()
  f.video.currentTime = 978; f.player.controls()
  f.video.currentTime = 0; f.player.controls()
  f.ready(); f.clock.advance(1000); f.recovery.tick(f.player.snapshot())
  assert.deepEqual(f.effects.seeks, [], 'zero is a valid latest target, not permission to restore 120')
  assert.equal(f.video.currentTime, 0)
})

test('BR-09 normal control: public SDK seek during initialization revokes stale restoration', t => {
  const f = fixture(t); f.beginReload(); f.site.seek(978); f.effects.seeks.length = 0
  f.ready(); f.clock.advance(1000); f.recovery.tick(f.player.snapshot())
  assert.deepEqual(f.effects.seeks, []); assert.equal(f.video.currentTime, 978)
})

test('BR-09 normal control: native seeking observation revokes stale restoration', t => {
  const f = fixture(t); f.beginReload(); f.video.readyState = 1; f.video.currentTime = 978
  f.video.seeking = true; f.video.dispatchEvent(new Event('seeking'))
  f.ready(); f.clock.advance(1000); f.recovery.tick(f.player.snapshot())
  assert.deepEqual(f.effects.seeks, []); assert.equal(f.video.currentTime, 978)
})

test('BR-09 normal control: unchanged reload target still permits the existing restoration', t => {
  const f = fixture(t); f.beginReload(); f.ready(); f.clock.advance(1000); f.recovery.tick(f.player.snapshot())
  assert.deepEqual(f.effects.seeks, [120]); assert.equal(f.video.currentTime, 120)
})

for (const rate of [1, 2] as const) {
  test(`BR-09 ${rate}x: unknown positive then zero preserves target without granting user ownership`, t => {
    const f = fixture(t, rate); f.beginReload(); const before = f.player.controls()
    f.video.currentTime = 978; const positive = f.player.controls()
    f.video.currentTime = 0; const zero = f.player.controls()
    assert.equal(positive.seekRevision, before.seekRevision + 1)
    assert.equal(zero.seekRevision, positive.seekRevision + 1)
    assert.equal(zero.targetSec, 0); assert.equal(zero.userRevision, before.userRevision)
    f.ready(); f.clock.advance(1000); f.recovery.tick(f.player.snapshot())
    assert.deepEqual(f.effects.seeks, []); assert.equal(f.video.currentTime, 0)
    assert.equal(f.video.playbackRate, rate); assert.equal(f.effects.plays, 1)
  })

  test(`BR-09 ${rate}x: unknown target changes do not extend the 15 second reload deadline`, t => {
    const f = fixture(t, rate); f.beginReload()
    f.clock.advance(14_999); f.video.currentTime = 978; f.player.controls(); f.video.currentTime = 0; f.player.controls()
    f.recovery.tick(f.player.snapshot()); assert.equal(f.recovery.isRecovering(), true)
    f.clock.advance(1); f.recovery.tick(f.player.snapshot())
    assert.equal(f.recovery.snapshot().reason, 'reload-timeout'); assert.equal(f.recovery.isRecovering(), false)
    for (let index = 0; index < 3; index++) { f.clock.advance(1000); f.recovery.tick(f.player.snapshot()) }
    assert.equal(f.effects.reloads, 1); assert.deepEqual(f.effects.seeks, [])
  })
}

test('BR-09 synchronous reload: initial zero is exempt but later observed targets are not', t => {
  const f = fixture(t); const before = f.player.controls()
  f.onReload(() => {
    const initial = f.player.controls(); assert.equal(initial.seekRevision, before.seekRevision)
    f.video.currentTime = 978; f.player.controls(); f.video.currentTime = 0
  })
  f.beginReload(); const after = f.player.controls()
  assert.equal(after.seekRevision, before.seekRevision + 2); assert.equal(after.userRevision, before.userRevision)
  f.ready(); f.clock.advance(1000); f.recovery.tick(f.player.snapshot()); assert.deepEqual(f.effects.seeks, [])
})

test('BR-09 synchronous reload: a finite nonzero final target cannot become a fresh baseline', t => {
  const f = fixture(t); f.onReload(() => { f.video.currentTime = 978 })
  f.beginReload(); f.ready(); f.clock.advance(1000); f.recovery.tick(f.player.snapshot())
  assert.deepEqual(f.effects.seeks, []); assert.equal(f.video.currentTime, 978)
})

test('BR-09 public seek: native sampling does not count the same target twice', t => {
  const f = fixture(t); f.beginReload(); const before = f.player.controls()
  f.site.seek(978); const publicSeek = f.player.controls(); f.player.controls()
  assert.equal(publicSeek.seekRevision, before.seekRevision + 1)
  f.site.seek(0); const zero = f.player.controls()
  assert.equal(zero.seekRevision, publicSeek.seekRevision + 1); assert.equal(zero.targetSec, 0)
})

test('BR-09 own pendingSeek: own restore stays suppressed while a different unknown zero revokes it', t => {
  const f = fixture(t); f.beginReload(); const before = f.player.controls()
  f.player.seek(978); const own = f.player.controls()
  assert.equal(own.seekRevision, before.seekRevision); assert.equal(own.userRevision, before.userRevision)
  f.video.currentTime = 0; const unknown = f.player.controls()
  assert.equal(unknown.seekRevision, own.seekRevision + 1); assert.equal(unknown.targetSec, 0)
})

test('BR-09 initialized normal playback increments do not become seek revisions', t => {
  const f = fixture(t); const before = f.player.controls()
  for (const position of [120.04, 120.5, 121, 123]) { f.video.currentTime = position; f.player.controls() }
  const after = f.player.controls(); assert.equal(after.seekRevision, before.seekRevision); assert.equal(after.userRevision, before.userRevision)
})

test('BR-09 invalid native positions are ignored without discarding the finite target baseline', t => {
  const f = fixture(t); f.beginReload(); const before = f.player.controls()
  for (const position of [NaN, Infinity, -Infinity]) { f.video.currentTime = position; assert.equal(f.player.controls().seekRevision, before.seekRevision) }
  f.video.currentTime = 978; assert.equal(f.player.controls().seekRevision, before.seekRevision + 1)
})

test('BR-09 reset prevents a previous uninitialized target baseline from crossing lifecycle', t => {
  const f = fixture(t); f.beginReload(); f.video.currentTime = 978; f.player.controls()
  f.player.reset(); f.video.currentTime = 0; const fresh = f.player.controls()
  assert.equal(fresh.targetSec, null)
  f.player.controls(); assert.equal(f.player.controls().seekRevision, fresh.seekRevision)
  f.video.currentTime = 25; assert.equal(f.player.controls().seekRevision, fresh.seekRevision + 1)
})

test('BR-09 media replacement initializes its own bounded baseline and revokes the old recovery', t => {
  const f = fixture(t); f.beginReload(); const before = f.player.controls()
  f.replaceVideo(978); const replacement = f.player.controls()
  assert.notEqual(replacement.mediaId, before.mediaId); assert.equal(replacement.seekRevision, before.seekRevision)
  f.recovery.tick(f.player.snapshot()); assert.equal(f.recovery.isRecovering(), false)
  f.video.currentTime = 0; assert.equal(f.player.controls().seekRevision, replacement.seekRevision + 1)
})

test('BR-09 SDK replacement prevents old raw observations from granting restoration', t => {
  const f = fixture(t); f.beginReload(); f.video.currentTime = 978; f.player.controls()
  f.replacePlayer(); f.video.currentTime = 0; const replacement = f.player.controls()
  f.recovery.tick(f.player.snapshot()); assert.equal(f.recovery.isRecovering(), false)
  f.player.controls(); assert.equal(f.player.controls().seekRevision, replacement.seekRevision)
  assert.deepEqual(f.effects.seeks, [])
})

test('BR-09 content lifecycle change invalidates the old baseline and owned reload', t => {
  const f = fixture(t); f.beginReload(); f.video.currentTime = 978; f.player.controls()
  f.lifecycle('br09-next-epoch'); f.video.currentTime = 0; const next = f.player.controls()
  f.recovery.tick(f.player.snapshot()); assert.equal(f.recovery.isRecovering(), false)
  f.player.controls(); assert.equal(f.player.controls().seekRevision, next.seekRevision); assert.deepEqual(f.effects.seeks, [])
})

test('BR-09 synchronous native read reset cannot commit a stale target afterward', t => {
  const f = fixture(t); f.beginReload(); const before = f.player.controls()
  f.video.currentTime = 978; f.video.onRead = () => f.player.reset()
  const after = f.player.controls()
  assert.equal(after.seekRevision, before.seekRevision + 1); assert.equal(after.targetSec, null)
})

test('BR-09 synchronous native read public seek keeps the newer target and one revision', t => {
  const f = fixture(t); f.beginReload(); const before = f.player.controls()
  f.video.currentTime = 978; f.video.onRead = () => f.site.seek(333)
  const after = f.player.controls()
  assert.equal(after.seekRevision, before.seekRevision + 1); assert.equal(after.targetSec, 333)
  assert.equal(f.player.controls().seekRevision, after.seekRevision); assert.equal(f.video.currentTime, 333)
})

test('BR-09 observation exceptions preserve the SDK reload result and release the source marker', t => {
  const f = fixture(t); const result = { result: 'original SDK result' }; f.reloadResult(result)
  f.onReload(() => { f.video.onRead = () => { throw Error('native read unavailable') } })
  assert.equal(f.player.reload(), result)
  f.onReload(() => {}); const before = f.player.controls(); f.site.reload()
  assert.equal(f.player.controls().seekRevision, before.seekRevision + 1)
})

test('BR-09 original reload exception is preserved without leaving an owned source marker', t => {
  const f = fixture(t), error = Error('original SDK exception'); f.reloadError(error)
  assert.throws(() => f.player.reload(), actual => actual === error)
  f.reloadError(null); const before = f.player.controls(); f.site.reload()
  assert.equal(f.player.controls().seekRevision, before.seekRevision + 1)
})

test('BR-09 late reload resolution cannot restore the obsolete position after a new native zero target', async t => {
  const f = fixture(t), reload = deferred<void>(); f.reloadResult(reload.promise); f.beginReload()
  f.video.currentTime = 978; f.player.controls(); f.video.currentTime = 0; f.player.controls()
  reload.resolve(); await reload.promise; await Promise.resolve()
  f.ready(); f.clock.advance(1000); f.recovery.tick(f.player.snapshot())
  assert.deepEqual(f.effects.seeks, []); assert.equal(f.video.currentTime, 0)
})

test('BR-09 late reload rejection cannot revive a reset recovery or restore its position', async t => {
  const f = fixture(t), reload = deferred<void>(); f.reloadResult(reload.promise); f.beginReload()
  f.video.currentTime = 978; f.player.controls(); f.video.currentTime = 0; f.player.controls()
  f.recovery.reset(); f.player.reset(); reload.reject(Error('late SDK rejection'))
  await reload.promise.catch(() => undefined); await Promise.resolve()
  assert.equal(f.recovery.snapshot().state, 'healthy'); assert.equal(f.recovery.isRecovering(), false)
  f.ready(); f.clock.advance(1000); f.recovery.tick(f.player.snapshot())
  assert.deepEqual(f.effects.seeks, []); assert.equal(f.effects.plays, 0)
})

// BR-01 installed v2.1.19: a new paused-transition saved the SDK's cached
// pre-keyup position although the native HAVE_NOTHING target had moved.
for (const rate of [1, 2] as const) {
  for (const target of [0, 5, 978]) {
    test(`BR-01 native position ${rate}x target ${target}: capture the finite HAVE_NOTHING target before cached SDK time`, t => {
      const f = fixture(t, rate)
      f.video.readyState = 0; f.video.currentTime = target
      assert.equal(f.site.getCurrentTime(), 120, 'the site SDK still reports its cached position')
      assert.equal(f.player.currentTime(), target, 'a new intent must save the native target, including zero')
    })

    test(`BR-01 native position ${rate}x target ${target}: new paused-transition restores the latest target`, t => {
      const f = fixture(t, rate), core = f.site.__core()
      assert.ok(core); core.state.initialized = false
      f.video.readyState = 0; f.video.currentTime = target
      f.video.videoWidth = 0; f.video.videoHeight = 0; f.video.paused = true
      f.player.controls(); f.recovery.tick(f.player.snapshot())
      f.clock.advance(30_000); f.video.paused = false
      f.recovery.tick(f.player.snapshot())
      assert.equal(f.recovery.snapshot().source, 'paused-transition')
      f.clock.advance(4000); f.recovery.tick(f.player.snapshot())
      assert.equal(f.effects.reloads, 1)
      f.ready(); f.clock.advance(1000); f.recovery.tick(f.player.snapshot())
      assert.deepEqual(f.effects.seeks, [target])
      assert.equal(f.recovery.snapshot().savedPositionSec, target)
      assert.equal(f.video.currentTime, target)
      assert.equal(f.video.playbackRate, rate)
      assert.equal(f.effects.plays, 1)
    })
  }
}

test('BR-01 native position control: initialized media retains SDK reader semantics', t => {
  const f = fixture(t); f.video.currentTime = 199; f.site.getCurrentTime = () => 120
  assert.equal(f.video.readyState, 4); assert.equal(f.player.currentTime(), 120)
})

test('BR-01 native position control: invalid HAVE_NOTHING targets fall back to the finite SDK time', t => {
  const f = fixture(t); f.video.readyState = 0
  for (const target of [NaN, Infinity, -Infinity]) {
    f.video.currentTime = target; assert.equal(f.player.currentTime(), 120)
  }
})

test('BR-01 native position control: native getter exceptions preserve the SDK fallback', t => {
  const f = fixture(t); f.video.readyState = 0
  f.video.onRead = () => { throw Error('native position unavailable') }
  assert.equal(f.player.currentTime(), 120)
})

test('BR-01 native position control: synchronous media replacement cannot commit a new recovery with the old target', t => {
  const f = fixture(t); f.video.readyState = 0; f.video.currentTime = 978
  const snapshot = f.player.snapshot()
  f.video.onRead = () => { f.video.onRead = () => f.replaceVideo(333) }
  f.recovery.armRouteFailure('watchdog', snapshot, () => true)
  assert.equal(f.recovery.isRecovering(), false)
  assert.deepEqual(f.effects.seeks, []); assert.equal(f.effects.reloads, 0)
  assert.equal(snapshot.currentTime, 978)
})
