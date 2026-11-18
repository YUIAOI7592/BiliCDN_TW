import test, { type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../support/runtime-fixture.ts'
import { BrowserNavigation } from '../../../src-v2/adapters/navigation.ts'
import { LifecycleController } from '../../../src-v2/application/lifecycle-controller.ts'
import { TransportContext } from '../../../src-v2/adapters/transport/transport-context.ts'
import { FetchHookAdapter } from '../../../src-v2/adapters/transport/fetch-hook.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'

function createNavigationPlayback(t: TestContext) {
  const f = fixture(t)
  let wallOffset = 0
  let clockAvailable = true
  const wallNow = () => f.clock.now() + wallOffset
  const monotonicNow = () => (clockAvailable ? f.clock.now() : null)
  const nativeMicrotask = globalThis.queueMicrotask
  let replacingHistory = false
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
    queueMicrotask: (fn: () => void) => {
      if (replacingHistory) f.clock.microtask(fn)
      else nativeMicrotask(fn)
    },
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
      wallNow,
      new BrowserNavigation(),
      f.clock,
      monotonicNow,
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
    wallNow,
    createRuntimeIds(),
    monotonicNow,
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
    replacingHistory = true
    try {
      history.replaceState(null, '', url)
    } finally {
      replacingHistory = false
    }
    f.clock.advance(0)
  }
  return {
    ...f,
    lifecycle,
    context,
    payload,
    start,
    finish,
    navigate,
    correctWallClock: (offset: number) => {
      wallOffset = offset
    },
    loseMonotonicClock: () => {
      clockAvailable = false
    },
  }
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

test('UP142 locale navigation preserves the active part and distinguishes actual media changes', (t) => {
  const f = createNavigationPlayback(t)
  const generation = Number(f.session.get().generation)
  f.navigate('/zh-Hant/video/test?p=1&spm_id_from=feed')
  assert.equal(Number(f.session.get().generation), generation)
  f.navigate('/en/video/test?p=2')
  assert.equal(Number(f.session.get().generation), generation + 1)
  f.navigate('/ja/list/watchlater?bvid=BV1111111111')
  assert.equal(Number(f.session.get().generation), generation + 2)
  f.navigate('/zh-Hans/list/watchlater?bvid=BV2222222222')
  assert.equal(Number(f.session.get().generation), generation + 3)
  f.navigate('/en/list/watchlater?p=1&bvid=BV2222222222')
  assert.equal(Number(f.session.get().generation), generation + 3)
  f.navigate('/fr/list/watchlater?bvid=BV2222222222')
  assert.equal(Number(f.session.get().generation), generation + 4)
})

for (const order of [
  'api-first',
  'url-first',
  'expired',
  'wall-clock-correction',
  'clock-unavailable',
  'unrelated',
  'missing-part',
  'exact-part',
  'rapid',
  'matching-refresh',
  'refresh-does-not-extend-lease',
  'requires-canonical-id',
] as const) {
  test(`UP142 navigation pairs accepted primary responses only when eligible: ${order}`, (t) => {
    const f = createNavigationPlayback(t)
    f.navigate('/video/BV1111111111')
    const before = f.session.get()
    let sequence = 0
    const accept = (cid: string, identity: string, part = '') => {
      const value = f.payload(cid)
      const url = `https://api.bilibili.com/x/player/wbi/playurl?is_main_page=true&cid=${cid}&${identity}${part}`
      const context = f.context.apiDispatch(url)
      assert.equal(
        f.playurl.transform(value, 'trusted-api', String(++sequence), context).accepted,
        true,
      )
      return value.data.dash.video[0]!.base_url
    }
    accept('101', 'bvid=BV1111111111')
    const part = order === 'missing-part' || order === 'exact-part'
    const nextBvid = part ? 'BV1111111111' : 'BV2222222222'
    const query = part ? '?p=2' : order === 'requires-canonical-id' ? '?aid=202' : ''
    const destination = `/video/${nextBvid}${query}`
    if (order === 'url-first') f.navigate(destination)
    if (order === 'clock-unavailable') f.loseMonotonicClock()
    const nextIdentity = order === 'requires-canonical-id' ? 'aid=202' : `bvid=${nextBvid}`
    const newUrl = accept('102', nextIdentity, order === 'exact-part' ? '&p=2' : '')
    if (order === 'expired') f.clock.advance(5001)
    if (order === 'wall-clock-correction') {
      f.clock.advance(5001)
      f.correctWallClock(-4000)
    }
    if (order === 'matching-refresh' || order === 'refresh-does-not-extend-lease') {
      f.clock.advance(2500)
      accept('102', nextIdentity)
      if (order === 'refresh-does-not-extend-lease') f.clock.advance(2501)
    }
    if (order === 'rapid') accept('103', 'bvid=BV3333333333')
    if (order !== 'url-first')
      f.navigate(order === 'unrelated' ? '/video/BV4444444444' : destination)
    const current = f.session.get()
    const apiPaired =
      order === 'api-first' || order === 'exact-part' || order === 'matching-refresh'
    const kept = apiPaired || order === 'url-first'
    assert.equal(Boolean(f.vault.match(newUrl).context), kept)
    assert.equal(Number(current.generation), Number(before.generation) + (apiPaired ? 0 : 1))
    assert.equal(Number(current.epoch), apiPaired ? Number(before.epoch) + 1 : 0)
  })
}

test('UP142 actual Fetch accepts the new response and ignores a late old response during pairing', async (t) => {
  const f = createNavigationPlayback(t)
  f.navigate('/video/BV1111111111')
  const before = f.session.get()
  const pending = new Map<string, (response: Response) => void>()
  const windowFixture = {
    fetch: (input: RequestInfo | URL) => {
      const request = new Request(input)
      return new Promise<Response>((resolve) => pending.set(new URL(request.url).search, resolve))
    },
  }
  f.scope.defineGlobal('unsafeWindow', { configurable: true, value: windowFixture })
  const hook = new FetchHookAdapter(f.context).install()
  assert.ok(hook)
  f.scope.defer(() => hook.restore())
  const endpoint = 'https://api.bilibili.com/x/player/wbi/playurl'
  const main = (cid: string, bvid: string) => `?is_main_page=true&cid=${cid}&bvid=${bvid}`
  const first = main('101', 'BV1111111111')
  const next = main('102', 'BV2222222222')
  const send = (query: string) => windowFixture.fetch(endpoint + query)
  const finish = (query: string, cid: string) => {
    const deliver = pending.get(query)
    assert.ok(deliver)
    deliver(new Response(JSON.stringify(f.payload(cid))))
  }
  const seeded = send(first)
  finish(first, '101')
  await seeded
  const late = send(first)
  const fresh = send(next)
  finish(next, '102')
  const response = (await (await fresh).json()) as ReturnType<typeof f.payload>
  assert.equal(f.context.snapshot().lastPlayurl?.accepted, true)
  const saved = response.data.dash.video[0]!.base_url
  assert.ok(f.vault.match(saved).context)
  finish(first, '101')
  await late
  assert.equal(f.context.snapshot().lastPlayurl?.accepted, false)
  f.navigate('/video/BV2222222222')
  assert.equal(f.session.get().generation, before.generation)
  assert.equal(Number(f.session.get().epoch), Number(before.epoch) + 1)
  assert.ok(f.vault.match(saved).context)
})

function acceptedWatchlater(t: TestContext) {
  const f = createNavigationPlayback(t)
  f.navigate('/watchlater/')
  const before = f.session.get()
  const body = f.payload('101')
  const request = f.context.apiDispatch(
    'https://api.bilibili.com/x/player/wbi/playurl?cid=101&bvid=BV1111111111&is_main_page=true',
  )
  assert.equal(f.playurl.transform(body, 'trusted-api', 'watchlater-101', request).accepted, true)
  return { ...f, before, body }
}

test('UP142 watchlater can complete the address of the accepted main video once', (t) => {
  const f = acceptedWatchlater(t)
  f.navigate('/watchlater/?bvid=BV1111111111')
  assert.equal(f.session.get().generation, f.before.generation)
  assert.ok(f.vault.match(f.body.data.dash.video[0]!.base_url).context)
  f.navigate('/watchlater/?bvid=BV2222222222')
  assert.equal(Number(f.session.get().generation), Number(f.before.generation) + 1)
})

test('UP142 watchlater keeps the ordinary reset when other query state changes', (t) => {
  const f = acceptedWatchlater(t)
  f.navigate('/watchlater/?bvid=BV1111111111&view=archive')
  assert.equal(Number(f.session.get().generation), Number(f.before.generation) + 1)
  assert.equal(f.vault.match(f.body.data.dash.video[0]!.base_url).context, null)
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
