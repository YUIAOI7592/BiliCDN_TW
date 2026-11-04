import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, dash, media } from './functional-races/routing-fixture.ts'
import { testScope } from '../support/scope.ts'
import { start, finish } from '../support/route-dispatch.ts'

async function currentPlayback(t: import('node:test').TestContext, rate: number) {
  const f = fixture(testScope(t)),
    url = media('v229-budget', 'video.m4s')
  assert.equal(f.adapter.transform(dash(url)).accepted, true)
  await finish(f, start(f, url, 1))
  await finish(f, start(f, url, 2))
  const request = f.routes.latestRequested('video')!
  let tick = 0
  f.clock.monotonicNow = () => tick
  const facts = {
    generation: request.generation,
    epoch: request.epoch,
    representation: request.representation,
    authorityRevision: request.authorityRevision!,
    routePolicyRevision: request.routePolicyRevision,
    selectionRevision: request.selectionRevision!,
    sampledAt: f.clock.now(),
    sampledTick: 0,
    playbackRate: rate,
    bufferAheadSec: 10,
    playableBufferSec: 10 / rate,
    playbackRevision: 0,
  }
  f.routes.observePlaybackFacts(facts)
  return {
    f,
    request,
    facts,
    setTick: (n: number) => {
      tick = n
    },
    budget: () => f.routes.completionBudget(request.representation!, 65536),
  }
}
for (const rate of [1, 2])
  for (const age of [0, 1000, 2000, 2001])
    test(`V229 playback deadline projects ${rate}x at ${age}ms`, async (t) => {
      const p = await currentPlayback(t, rate),
        session = p.f.session.get(),
        stored = structuredClone([...p.f.storage.values])
      p.setTick(age)
      const budget = p.budget()
      if (age > 2000) assert.equal(budget, null)
      else assert.equal(budget?.playableBufferSec, 10 / rate - age / 1000)
      assert.equal(p.f.session.get(), session)
      assert.deepEqual([...p.f.storage.values], stored)
    })
test('V229 playback deadline ignores a wall-clock jump and invalidates on a newer observation revision', async (t) => {
  const p = await currentPlayback(t, 2)
  p.setTick(1000)
  p.f.clock.advance(500000)
  assert.equal(p.budget()?.playableBufferSec, 4)
  p.f.routes.observePlaybackFacts(null, 1)
  p.f.routes.observePlaybackFacts(p.facts)
  assert.equal(p.budget(), null, 'old facts cannot revive after an invalidation')
  p.f.routes.observePlaybackFacts({
    ...p.facts,
    sampledAt: p.f.clock.now(),
    sampledTick: 1000,
    playbackRevision: 1,
  })
  assert.equal(p.budget()?.playableBufferSec, 5)
})
test('V229 playback deadline rejects missing monotonic input and unknown actual rate', async (t) => {
  const p = await currentPlayback(t, 2)
  p.f.clock.monotonicNow = () => NaN
  assert.equal(p.budget(), null)
  p.f.clock.monotonicNow = () => 0
  p.f.routes.observePlaybackFacts({ ...p.facts, playbackRate: 0 })
  assert.equal(p.budget(), null)
})

for (const [input, expected] of [
  ['60000/1001', 60000 / 1001],
  ['59.935', 59.935],
  [0, undefined],
  ['1/0', undefined],
  ['Infinity', undefined],
] as const)
  test(`V229 declared FPS stays optional and never changes route authority: ${input}`, (t) => {
    const f = fixture(testScope(t)),
      url = media('v229-fps', 'video.m4s'),
      body = dash(url)
    Object.assign(body.data.dash.video[0]!, { frame_rate: input })
    assert.equal(f.adapter.transform(body).accepted, true)
    const first = f.vault.contextForUrl(url)!
    assert.equal(f.vault.groupSummary(first.representation)?.frameRate, expected)
    const again = dash(url)
    Object.assign(again.data.dash.video[0]!, { frame_rate: '30/1' })
    assert.equal(f.adapter.transform(again).accepted, true)
    const second = f.vault.contextForUrl(url)!
    assert.equal(second.representation, first.representation)
    assert.equal(second.authorityRevision, first.authorityRevision)
  })
