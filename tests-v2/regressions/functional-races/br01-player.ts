import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { PlayerAdapter } from '../../../src-v2/adapters/player.ts'
import { testScope } from '../../support/scope.ts'
import { FakeClock } from '../../support/clock.ts'

class Target extends EventTarget {
  readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject | null>>()
  override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void {
    super.addEventListener(type, listener, options)
    const entries = this.listeners.get(type) ?? new Set(); entries.add(listener); this.listeners.set(type, entries)
  }
  override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void {
    super.removeEventListener(type, listener, options); this.listeners.get(type)?.delete(listener)
  }
  count(): number { return [...this.listeners.values()].reduce((sum, entries) => sum + entries.size, 0) }
}

function fixture(t: TestContext) {
  const scope = testScope(t), document = new Target(), window = new Target(), clock = scope.own(new FakeClock())
  let core: object = {}, failure: Error | null = null
  const marker = {}, seen: unknown[][] = []
  class Element extends Target {
    currentTime = 0
    seeking = false
    parentElement: Element | null = null
    contains(target: unknown): boolean { return target === this || target === video }
    closest(): Element { return region }
  }
  const region = new Element(), video = new Element(); video.parentElement = region
  const site = {
    __core: () => core,
    seek(this: unknown, ...args: unknown[]): unknown { seen.push([this, ...args]); if (failure) throw failure; return marker },
    reload(): unknown { core = {}; return marker },
  }
  scope.defineGlobal('document', { configurable: true, value: document })
  scope.defineGlobal('window', { configurable: true, value: window })
  scope.defineGlobal('Node', { configurable: true, value: Element })
  scope.defineGlobal('Element', { configurable: true, value: Element })
  class Player extends PlayerAdapter {
    protected override player() { return site }
    override video(): HTMLVideoElement { return video as unknown as HTMLVideoElement }
  }
  const player = new Player({ lifecycleKey: () => 'fixture', transform: () => ({ accepted: true, formats: [],
    videoCount: 0, audioCount: 0, segmentCount: 0, upstreamCode: 0, reason: null }) }, { scheduler: clock, isActuallyVisible: () => true,
      subscribeControlLoss: () => () => undefined })
  scope.defer(() => player.reset()); player.controls()
  return { player, site, video, document, window, marker, seen, core: (value: object) => { core = value },
    fail: (value: Error) => { failure = value } }
}

test('BR-01 adapter preserves site seek arguments, receiver, result and exact exception', t => {
  const f = fixture(t), receiver = {}
  assert.equal(Reflect.apply(f.site.seek, receiver, [0, 'extra']), f.marker)
  assert.deepEqual(f.seen[0], [receiver, 0, 'extra']); assert.equal(f.player.controls().targetSec, 0)
  const error = new Error('controlled seek'); f.fail(error)
  assert.throws(() => f.site.seek(19), thrown => thrown === error)
})

test('BR-01 adapter separates synthetic seek observation from user and internal restore revisions', t => {
  const f = fixture(t), before = f.player.controls()
  f.video.currentTime = 20; f.video.dispatchEvent(new Event('seeking'))
  assert.equal(f.player.controls().userRevision, before.userRevision)
  assert.ok(f.player.controls().seekRevision > before.seekRevision)
  const revision = f.player.controls().seekRevision
  f.player.seek(0); f.video.currentTime = 0; f.video.dispatchEvent(new Event('seeking'))
  assert.equal(f.player.controls().seekRevision, revision)
  f.video.dispatchEvent(new Event('seeked'))
})

test('BR-01 adapter marks its own replacement and revokes marker for external reload', t => {
  const f = fixture(t), initial = f.player.controls()
  assert.equal(f.player.reload(), f.marker)
  const own = f.player.controls(); assert.notEqual(own.coreId, initial.coreId)
  assert.equal(own.coreReloadRevision, own.reloadRevision)
  f.site.reload(); const external = f.player.controls()
  assert.equal(external.coreReloadRevision, 0); assert.ok(external.seekRevision > own.seekRevision)
})

test('BR-01 adapter reset removes observers and preserves a newer method owner', t => {
  const f = fixture(t), replacement = () => f.marker
  assert.ok(f.video.count() + f.document.count() + f.window.count() > 0)
  f.site.seek = replacement; f.player.reset()
  assert.equal(f.site.seek, replacement)
  assert.equal(f.video.count() + f.document.count() + f.window.count(), 0)
})
