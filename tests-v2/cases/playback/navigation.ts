import test, { type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../support/runtime-fixture.ts'
import { BrowserNavigation } from '../../../src-v2/adapters/navigation.ts'
import { LifecycleController } from '../../../src-v2/application/lifecycle-controller.ts'
import { TransportContext } from '../../../src-v2/adapters/transport/transport-context.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'

function createNavigationPlayback(t: TestContext) {
  const f = fixture(t)
  f.lifecycle.dispose()
  const location = new URL('https://www.bilibili.com/video/test/?p=1&vd_source=initial')
  const target = new EventTarget()
  const history = {
    pushState(_state: unknown, _unused: string, url?: string | URL | null) {
      if (url != null) location.href = new URL(url, location).href
    },
    replaceState(_state: unknown, _unused: string, url?: string | URL | null) {
      if (url != null) location.href = new URL(url, location).href
    },
  }
  for (const [name, value] of Object.entries({
    location,
    history,
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    queueMicrotask: (fn: () => void) => f.clock.microtask(fn),
  }))
    f.scope.defineGlobal(name, { configurable: true, value })
  const lifecycle = f.scope.own(
    new LifecycleController(
      f.session,
      f.settings,
      f.vault,
      f.routes,
      f.playurl,
      { install: () => undefined, dispose: () => undefined },
      f.runtime,
      f.clock.now,
      new BrowserNavigation(),
      f.clock,
    ),
  )
  lifecycle.start()
  // This contract advances navigation time without introducing unrelated watchdog stalls.
  f.runtime.stop()
  const context = new TransportContext(
    f.session,
    f.settings,
    f.routes,
    f.playurl,
    {
      willGateStartup: () => false,
      prepareStartup: async () => undefined,
      noteUnpreflighted: () => undefined,
    },
    f.clock.now,
    createRuntimeIds(),
    f.clock.now,
  )
  const payload = (content: string) => ({
    code: 0,
    data: {
      dash: {
        video: [
          {
            id: 80,
            height: 1080,
            codecid: 7,
            bandwidth: 4_000_000,
            base_url: `https://upos-sz-mirrorali.bilivideo.com/upgcxcode/${content}/video/1-30080.m4s`,
            backup_url: [],
          },
        ],
        audio: [
          {
            id: 30280,
            bandwidth: 192_000,
            base_url: `https://upos-sz-mirrorali.bilivideo.com/upgcxcode/${content}/audio/1-30280.m4s`,
            backup_url: [],
          },
        ],
      },
    },
  })
  const start = (url: string, kind: 'video' | 'audio') => {
    const applied = f.routes.apply(url, kind)
    assert.ok(applied.url)
    const request = context.request(applied, url, applied.url, f.clock.now(), 'GET')
    f.routes.requestStarted(request)
    return { applied, request, url: applied.url }
  }
  const finish = async (work: ReturnType<typeof start>) => {
    f.clock.advance(50)
    await f.routes.observe(
      context.observation(
        work.request,
        work.applied,
        work.url,
        206,
        128 * 1024,
        work.request.startedAt,
        work.request.startedAt + 10,
        'success',
      ),
    )
  }
  const navigate = (url: string) => {
    history.replaceState(null, '', url)
    f.clock.advance(0)
  }
  return { ...f, lifecycle, payload, start, finish, navigate }
}

test('V224 tracking navigation after page expiry preserves confirmed decisions and independent media summaries', async (t) => {
  const f = createNavigationPlayback(t),
    body = f.payload('A')
  assert.equal(f.lifecycle.acceptPageAssignment(body, 1), true)
  const video = body.data.dash.video[0]!.base_url,
    audio = body.data.dash.audio[0]!.base_url
  await f.finish(f.start(video, 'video'))
  await f.finish(f.start(video, 'video'))
  await f.finish(f.start(audio, 'audio'))
  const state = f.session.get(),
    routes = f.routes.snapshot(),
    decision = f.routes.apply(video, 'video').decision
  assert.ok(state.representation)
  assert.ok(routes.latest.video && routes.latest.audio && routes.activePlan)
  const identity = f.vault.identity(state.representation),
    resets = f.calls.resets
  f.clock.advance(6001)
  for (const url of ['/video/test?spm_id_from=next', '/video/test/?p=1&vd_source=other']) {
    f.navigate(url)
    assert.equal(f.session.get(), state)
    assert.equal(f.calls.resets, resets)
    assert.equal(f.vault.identity(state.representation), identity)
    assert.equal(f.routes.apply(video, 'video').decision, decision)
    assert.deepEqual(f.routes.snapshot(), routes)
  }
})

test('V224 real part change clears old summaries, rejects late work and rebuilds from new transfers', async (t) => {
  const f = createNavigationPlayback(t),
    body = f.payload('A')
  assert.equal(f.lifecycle.acceptPageAssignment(body, 1), true)
  const old = f.start(body.data.dash.video[0]!.base_url, 'video')
  await f.finish(old)
  await f.finish(f.start(body.data.dash.video[0]!.base_url, 'video'))
  const generation = Number(f.session.get().generation)
  f.clock.advance(6001)
  f.navigate('/video/test?p=2')
  assert.equal(Number(f.session.get().generation), generation + 1)
  assert.equal(f.session.get().representation, null)
  assert.equal(f.routes.snapshot().activePlan, null)
  assert.deepEqual(f.routes.snapshot().latest, {})
  assert.deepEqual(f.routes.snapshot().requested, {})
  assert.equal(f.vault.isCurrentIdentity(old.applied.context!), false)
  await f.finish(old)
  assert.deepEqual(f.routes.snapshot().latest, {}, 'late old completion cannot refill current UI')
  const next = f.payload('B')
  assert.equal(f.lifecycle.acceptPageAssignment(next, 2), true)
  await f.finish(f.start(next.data.dash.audio[0]!.base_url, 'audio'))
  assert.ok(f.routes.snapshot().latest.audio)
  assert.equal(f.routes.snapshot().latest.video, undefined)
  assert.equal(
    f.session.get().representation,
    null,
    'audio never confirms the video representation',
  )
  await f.finish(f.start(next.data.dash.video[0]!.base_url, 'video'))
  assert.equal(f.session.get().representation, null)
  assert.equal(f.routes.snapshot().attribution, 'awaiting-second-video-transfer')
  await f.finish(f.start(next.data.dash.video[0]!.base_url, 'video'))
  assert.ok(f.session.get().representation)
  assert.ok(f.routes.snapshot().activePlan && f.routes.snapshot().latest.video)
})
