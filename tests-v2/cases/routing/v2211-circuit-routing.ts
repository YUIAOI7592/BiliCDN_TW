import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, dash, media } from './routing-fixture.ts'
import { start, finish } from '../../support/route-dispatch.ts'
import { SharedEvidenceStorage } from '../../support/shared-evidence-storage.ts'
import { testScope } from '../../support/scope.ts'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import { deferred } from '../../support/deferred.ts'

const createObservation = async (t: Parameters<typeof testScope>[0], level = 1) => {
  const f = fixture(testScope(t), new SharedEvidenceStorage())
  const url = media('331/442', 'video.m4s')
  await f.settings.update({ fixedHost: TRUSTED_CATALOG[0] })
  assert.equal(f.adapter.transform(dash(url)).accepted, true)
  const host = TRUSTED_CATALOG[0]!
  for (let i = 0; i < level; i++)
    await f.evidence.record(host, 'video', {
      requestId: `initial-failure-${i}`,
      at: f.clock.now(),
      source: 'transport',
      outcome: 'failure',
      throughputMbps: null,
      ttfbMs: null,
      failureKind: 'network',
    })
  f.clock.advance([600000, 1800000, 7200000, 21600000][level - 1]! + 1)
  return { ...f, url, host }
}
test('V2211 routing: real ordinary transfers lower exactly one level after five observed minutes', async (t) => {
  const f = await createObservation(t)
  await finish(f, start(f, f.url, 1))
  assert.equal(f.evidence.get(f.host, 'video')!.circuitLevel, 1)
  const began = f.clock.now()
  for (let i = 1; i <= 5; i++) {
    f.clock.advance(59900)
    await finish(f, start(f, f.url, i + 1))
  }
  assert.equal(f.clock.now() - began, 300000)
  assert.equal(f.evidence.get(f.host, 'video')!.circuitLevel, 0)
})

type ObservationFixture = Awaited<ReturnType<typeof createObservation>>
async function succeedAt(f: ObservationFixture, at: number, id: number) {
  f.clock.advance(at - f.clock.now() - 100)
  await finish(f, start(f, f.url, id))
}
async function endpointWithPending(f: ObservationFixture) {
  await finish(f, start(f, f.url, 1))
  const began = f.clock.now(),
    pending = start(f, f.url, 2)
  for (const [i, seconds] of [60, 120, 180, 240, 300].entries())
    await succeedAt(f, began + seconds * 1000, i + 3)
  assert.equal(f.evidence.get(f.host, 'video')!.circuitLevel, 1)
  return { began, pending }
}
for (const [end, level] of [
  [359999, 0],
  [360000, 1],
] as const) {
  test(`V2211 routing: pre-cutoff pending transfer settles at ${end}ms`, async (t) => {
    const f = await createObservation(t),
      { began, pending } = await endpointWithPending(f)
    f.clock.advance(began + end - f.clock.now() - 100)
    await finish(f, pending)
    assert.equal(f.evidence.get(f.host, 'video')!.circuitLevel, level)
  })
}
test('V2211 routing: pending failure advances the circuit level and cooldown', async (t) => {
  const f = await createObservation(t),
    { pending } = await endpointWithPending(f)
  await finish(f, pending, true)
  assert.equal(f.evidence.get(f.host, 'video')!.circuitLevel, 2)
  assert.equal(f.evidence.get(f.host, 'video')!.circuitUntil, f.clock.now() + 1800000)
})
test('V2211 routing: a post-cutoff pipeline request neither blocks nor credits the next period', async (t) => {
  const f = await createObservation(t),
    { pending } = await endpointWithPending(f)
  const later = start(f, f.url, 90)
  await finish(f, pending)
  assert.equal(f.evidence.get(f.host, 'video')!.circuitLevel, 0)
  await finish(f, later)
  assert.equal(f.evidence.get(f.host, 'video')!.circuitLevel, 0)
})
test('V2211 routing: four complete observation periods gradually clear level four', async (t) => {
  const f = await createObservation(t, 4)
  await finish(f, start(f, f.url, 1))
  const began = f.clock.now()
  for (let i = 1; i <= 20; i++) {
    await succeedAt(f, began + i * 60000, i + 1)
    assert.equal(f.evidence.get(f.host, 'video')!.circuitLevel, 4 - Math.floor(i / 5))
  }
})
for (const operation of ['pause', 'rate', 'policy', 'content'] as const) {
  test(`V2211 routing: ${operation} invalidation cannot reuse earlier observation credit`, async (t) => {
    const f = await createObservation(t)
    await finish(f, start(f, f.url, 1))
    const old = start(f, f.url, 2)
    if (operation === 'pause') f.routes.observePlaybackFacts(null)
    if (operation === 'rate') f.routes.observePlaybackRate(1)
    if (operation === 'policy') f.routes.invalidateForUserSetting()
    if (operation === 'content') f.routes.resetEpoch()
    await finish(f, old)
    assert.equal(f.evidence.get(f.host, 'video')!.circuitLevel, 1)
    const status = f.routes
      .snapshot()
      .circuits.find((r) => r.host === f.host && r.kind === 'video')!
    assert.equal(status.phase, 'awaiting')
    assert.equal(status.progressSec, 0)
  })
}
test('V2211 routing: pause keeps subsequent downloading from accumulating recovery credit', async (t) => {
  const f = await createObservation(t)
  f.routes.observePlaybackFacts(null)
  for (let i = 0; i < 7; i++) {
    f.clock.advance(60000)
    await finish(f, start(f, f.url, i + 1))
  }
  assert.equal(f.evidence.get(f.host, 'video')!.circuitLevel, 1)
})
test('V2211 routing: repeated completion cannot punish one dispatched request twice', async (t) => {
  const f = await createObservation(t)
  const request = start(f, f.url, 1)
  await finish(f, request, true)
  await finish(f, request, true)
  assert.equal(f.evidence.get(f.host, 'video')!.circuitLevel, 2)
})
test('V2211 routing: observation capacity overflow discards credit without cancelling requests', async (t) => {
  const f = await createObservation(t)
  await finish(f, start(f, f.url, 1))
  const work = Array.from({ length: 65 }, (_, i) => start(f, f.url, i + 2))
  const overflow = f.routes
    .snapshot()
    .circuits.find((row) => row.host === f.host && row.kind === 'video')!
  assert.equal(overflow.phase, 'awaiting')
  assert.equal(overflow.progressSec, 0)
  for (const request of work) await finish(f, request)
  assert.equal(f.evidence.get(f.host, 'video')!.circuitLevel, 1)
  assert.ok(f.evidence.get(f.host, 'video')!.samples.some((row) => row.outcome === 'success'))
})
test('V2211 routing: snapshot reads cannot commit, mutate a decision or start work', async (t) => {
  const f = await createObservation(t)
  await finish(f, start(f, f.url, 1))
  const decision = f.routes.apply(f.url).decision,
    saved = structuredClone([...f.storage.values])
  for (let i = 0; i < 10; i++) f.routes.snapshot()
  assert.equal(f.routes.apply(f.url).decision, decision)
  assert.deepEqual([...f.storage.values], saved)
  assert.equal(f.clock.pendingCount, 0)
})
for (const change of ['deadline', 'generation', 'authority', 'policy', 'clear'] as const) {
  test(`V2211 routing: ${change} while a downgrade awaits submission rejects its old proof`, async (t) => {
    const f = await createObservation(t)
    await finish(f, start(f, f.url, 1))
    const began = f.clock.now()
    for (let i = 1; i <= 4; i++) await succeedAt(f, began + i * 60000, i + 1)
    const offered = deferred<void>(),
      hold = deferred<void>(),
      down = f.evidence.tryDowngrade.bind(f.evidence)
    f.evidence.tryDowngrade = async (...args) => {
      offered.resolve()
      await hold.promise
      return await down(...args)
    }
    const finishing = succeedAt(f, began + 300000, 6)
    await offered.promise
    if (change === 'deadline') f.clock.advance(60000)
    if (change === 'generation') f.session.beginGeneration(false)
    if (change === 'authority') f.vault.reset(f.session.get().generation, f.session.get().epoch)
    if (change === 'policy') await f.settings.update({ disabled: true })
    if (change === 'clear') await f.evidence.clear()
    hold.resolve()
    await finishing
    assert.equal(f.evidence.get(f.host, 'video')?.circuitLevel ?? 0, change === 'clear' ? 0 : 1)
  })
}
test('V2211 routing: a cancellation unblocks existing evidence without adding success credit', async (t) => {
  const f = await createObservation(t),
    { pending } = await endpointWithPending(f),
    r = pending.request
  await f.routes.observe({
    request: r,
    generation: r.generation,
    epoch: r.epoch,
    representation: r.representation,
    kind: r.kind,
    decisionId: r.decisionId,
    routeType: r.routeType,
    originalHost: r.originalHost,
    targetHost: r.targetHost,
    finalHost: null,
    status: 0,
    bytes: 0,
    streamKey: pending.applied.streamKey,
    ttfbMs: null,
    elapsedMs: 300000,
    completedAt: f.clock.now(),
    outcome: 'abort',
  })
  assert.equal(f.evidence.get(f.host, 'video')!.circuitLevel, 0)
})

test('V2211 routing: a valid same-window success during submission preserves the pending proposal', async (t) => {
  const f = await createObservation(t)
  await finish(f, start(f, f.url, 1))
  const began = f.clock.now()
  for (let i = 1; i <= 4; i++) await succeedAt(f, began + i * 60000, i + 1)
  const offered = deferred<void>(),
    hold = deferred<void>(),
    down = f.evidence.tryDowngrade.bind(f.evidence)
  f.evidence.tryDowngrade = async (...args) => {
    offered.resolve()
    await hold.promise
    return await down(...args)
  }
  const pending = succeedAt(f, began + 300000, 6)
  await offered.promise
  await succeedAt(f, began + 301000, 7)
  hold.resolve()
  await pending
  assert.equal(f.evidence.get(f.host, 'video')!.circuitLevel, 0)
})
test('V2211 routing: repeated short responses cannot extend the success lease', async (t) => {
  const f = await createObservation(t)
  await finish(f, start(f, f.url, 1))
  for (let i = 0; i < 6; i++) {
    f.clock.advance(60000)
    const w = start(f, f.url, i + 2),
      r = w.request
    await f.routes.observe({
      request: r,
      generation: r.generation,
      epoch: r.epoch,
      representation: r.representation,
      kind: r.kind,
      decisionId: r.decisionId,
      routeType: r.routeType,
      originalHost: r.originalHost,
      targetHost: r.targetHost,
      finalHost: r.targetHost,
      status: 206,
      bytes: 1024,
      streamKey: w.applied.streamKey,
      ttfbMs: 10,
      elapsedMs: 100,
      completedAt: f.clock.now(),
      outcome: 'success',
    })
  }
  assert.equal(f.evidence.get(f.host, 'video')!.circuitLevel, 1)
  assert.equal(f.routes.snapshot().circuits.find((r) => r.kind === 'video')!.phase, 'awaiting')
})
test('V2211 routing: unverified XHR delivery can learn but cannot earn recovery credit', async (t) => {
  const f = await createObservation(t)
  for (let i = 0; i < 7; i++) {
    f.clock.advance(60000)
    const work = start(f, f.url, i + 1),
      r = work.request
    await f.routes.observe({
      request: r,
      generation: r.generation,
      epoch: r.epoch,
      representation: r.representation,
      kind: r.kind,
      decisionId: r.decisionId,
      routeType: r.routeType,
      originalHost: r.originalHost,
      targetHost: r.targetHost,
      finalHost: r.targetHost,
      status: 206,
      bytes: 131072,
      elapsedMs: 100,
      ttfbMs: 10,
      completedAt: f.clock.now(),
      outcome: 'success',
      streamKey: work.applied.streamKey,
      circuitVerified: false,
    })
  }
  assert.equal(f.evidence.get(f.host, 'video')!.circuitLevel, 1)
  assert.ok(f.evidence.get(f.host, 'video')!.samples.some((row) => row.outcome === 'success'))
})
test('V2211 routing: clock loss discards observation without creating a host failure', async (t) => {
  const f = await createObservation(t)
  await finish(f, start(f, f.url, 1))
  const read = f.clock.monotonicNow
  f.clock.monotonicNow = () => NaN
  await finish(f, start(f, f.url, 2))
  f.clock.monotonicNow = read
  assert.equal(f.evidence.get(f.host, 'video')!.circuitLevel, 1)
  assert.equal(f.evidence.get(f.host, 'video')!.circuitUntil, 0)
})
test('V2211 routing: video observation cannot lower an audio circuit on the same host', async (t) => {
  const f = await createObservation(t)
  await f.evidence.record(f.host, 'audio', {
    requestId: 'audio-failure',
    at: f.clock.now(),
    source: 'transport',
    outcome: 'failure',
    throughputMbps: null,
    ttfbMs: null,
    failureKind: 'network',
  })
  await finish(f, start(f, f.url, 1))
  const began = f.clock.now()
  for (let i = 1; i <= 5; i++) await succeedAt(f, began + i * 60000, i + 1)
  assert.equal(f.evidence.get(f.host, 'video')!.circuitLevel, 0)
  assert.equal(f.evidence.get(f.host, 'audio')!.circuitLevel, 1)
})
async function secondPage(t: Parameters<typeof testScope>[0], first: ObservationFixture) {
  const f = fixture(testScope(t), first.storage)
  f.clock.advance(first.clock.now() - f.clock.now())
  f.clock.monotonicNow = () => f.clock.now() + 1000000
  assert.equal(f.adapter.transform(dash(first.url)).accepted, true)
  return { ...f, url: first.url, host: first.host }
}
test('V2211 routing: independent page clocks cannot both lower one shared circuit version', async (t) => {
  const a = await createObservation(t, 2),
    b = await secondPage(t, a)
  await Promise.all([finish(a, start(a, a.url, 1)), finish(b, start(b, b.url, 101))])
  const began = a.clock.now()
  for (let i = 1; i <= 5; i++)
    await Promise.all([
      succeedAt(a, began + i * 60000, i + 1),
      succeedAt(b, began + i * 60000, i + 101),
    ])
  assert.equal(a.evidence.get(a.host, 'video')!.circuitLevel, 1)
  assert.equal(b.evidence.get(b.host, 'video')!.circuitLevel, 1)
})
test('V2211 routing: alternating sparse pages cannot pool their success gaps', async (t) => {
  const a = await createObservation(t),
    b = await secondPage(t, a)
  const began = a.clock.now()
  for (let i = 0; i < 5; i++) {
    if (i === 0) {
      await finish(a, start(a, a.url, 1))
      b.clock.advance(90000)
      await finish(b, start(b, b.url, 101))
    } else {
      await succeedAt(a, began + i * 180000, i + 1)
      await succeedAt(b, began + i * 180000 + 90000, i + 101)
    }
  }
  assert.equal(a.evidence.get(a.host, 'video')!.circuitLevel, 1)
  assert.equal(b.evidence.get(b.host, 'video')!.circuitLevel, 1)
})
test('V2211 routing: an abandoned old transfer cannot revive an expired observation', async (t) => {
  const f = await createObservation(t)
  await finish(f, start(f, f.url, 1))
  const old = start(f, f.url, 2)
  f.clock.advance(120001)
  await finish(f, old)
  assert.equal(f.evidence.get(f.host, 'video')!.circuitLevel, 1)
  assert.equal(
    f.routes.snapshot().circuits.find((r) => r.host === f.host && r.kind === 'video')!.phase,
    'awaiting',
  )
})
