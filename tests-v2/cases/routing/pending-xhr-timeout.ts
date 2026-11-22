import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import { type TransportObservation } from '../../../src-v2/domain/transport-model.ts'
import { EVIDENCE_KEY } from '../../../src-v2/state/evidence-store.ts'
import { deferred } from '../../support/deferred.ts'
import { start } from '../../support/route-dispatch.ts'
import { testScope } from '../../support/scope.ts'
import { SharedEvidenceStorage } from '../../support/shared-evidence-storage.ts'
import { fixture, media } from './routing-fixture.ts'

const preferred = TRUSTED_CATALOG[0]

class TimeoutStorage extends SharedEvidenceStorage {
  rejectEvidence = false
  override set<T>(key: string, value: T): void {
    if (this.rejectEvidence && key === EVIDENCE_KEY) throw Error('evidence write rejected')
    super.set(key, value)
  }
}

async function timeoutFixture(t: TestContext, onlyPreferred = false) {
  const scope = testScope(t)
  const storage = new TimeoutStorage()
  const f = fixture(scope, storage)
  await f.settings.update({
    fixedHost: preferred,
    ...(onlyPreferred && {
      catalogOverrides: Object.fromEntries(
        TRUSTED_CATALOG.map((host) => [host, host === preferred]),
      ),
    }),
  })
  const url = media('pending-timeout', 'video.m4s')
  function register(resource: string, key: string, kind: 'audio' | 'video' = 'video') {
    const { generation, epoch } = f.session.get()
    const rep = f.vault.register({
      generation,
      epoch,
      kind,
      key,
      height: kind === 'video' ? 1080 : 0,
      codec: kind === 'video' ? 'av1' : 'other',
      bandwidth: kind === 'video' ? 3_000_000 : 160_000,
      urls: [resource],
      source: 'trusted-api',
      refreshTrustedSources: true,
    })
    assert.ok(rep)
    return rep
  }
  const representation = register(url, 'selected')
  const observations: Promise<void>[] = []
  const barriers: ReturnType<typeof deferred<void>>[] = []
  scope.defer(async () => {
    for (const barrier of barriers) barrier.resolve()
    await Promise.all(observations)
  })
  function hold() {
    const gate = deferred<void>()
    barriers.push(gate)
    observations.push(storage.withLock('routeEvidence', () => gate.promise))
    return gate.resolve
  }
  function timeout(
    work: ReturnType<typeof start>,
    facts: Partial<TransportObservation> = {},
    trusted = true,
  ) {
    const r = work.request
    const observation: TransportObservation = {
      request: r,
      generation: r.generation,
      epoch: r.epoch,
      decisionId: r.decisionId,
      representation: r.representation,
      kind: r.kind,
      routeType: r.routeType,
      originalHost: r.originalHost,
      targetHost: r.targetHost,
      finalHost: null,
      streamKey: work.applied.streamKey,
      status: 0,
      bytes: 0,
      ttfbMs: null,
      elapsedMs: 13006,
      completedAt: f.clock.now(),
      outcome: 'failure',
      failureKind: 'timeout',
      timingBasis: 'xhr-terminal',
      ...(trusted && { nativeXhrTimeout: true }),
      ...facts,
    }
    const outcome = f.routes.observe(observation)
    const checked = storage.rejectEvidence
      ? assert.rejects(outcome, /evidence write rejected/)
      : outcome
    // Cleanup verifies every queued write, including those released after the test body.
    void checked.catch(() => undefined)
    observations.push(checked)
    return outcome
  }
  function dispatch(resource = url, basis: 'xhr-terminal' | 'fetch-consumer' = 'xhr-terminal') {
    const applied = f.routes.apply(resource, null, undefined, false, 65536, basis)
    assert.ok(applied.url)
    const target = new URL(applied.url).host
    assert.equal(target, applied.decision.host)
    return target
  }
  const first = start(f, url, 1, 'video', 'xhr-terminal', 65536)
  assert.equal(first.request.targetHost, preferred)
  f.clock.advance(13006)
  return { f, storage, url, representation, register, hold, timeout, dispatch, first }
}

test('pending XHR timeout expires at three monotonic seconds while the evidence lock is held', async (t) => {
  const c = await timeoutFixture(t)
  let tick = c.f.clock.monotonicNow()
  c.f.clock.monotonicNow = () => tick
  c.hold()
  c.timeout(c.first)
  c.f.clock.advance(60_000)
  tick += 2999
  assert.notEqual(c.dispatch(), preferred)
  tick++
  assert.equal(c.dispatch(), preferred)
  assert.equal(c.f.evidence.get(preferred, 'video'), null)
})

test('pending XHR timeout keeps the remaining owner when an overlapping write fails', async (t) => {
  const c = await timeoutFixture(t)
  const second = start(c.f, c.url, 2, 'video', 'xhr-terminal', 65536)
  const releaseFirst = c.hold()
  c.storage.rejectEvidence = true
  const one = c.timeout(c.first)
  // EvidenceStore enters the shared FIFO on its next microtask.
  await Promise.resolve()
  const releaseSecond = c.hold()
  const two = c.timeout(second)
  releaseFirst()
  await assert.rejects(one)
  assert.notEqual(c.dispatch(), preferred)
  releaseSecond()
  await assert.rejects(two)
  assert.equal(c.dispatch(), preferred)
  assert.equal(c.f.evidence.get(preferred, 'video'), null)
})

test('pending XHR timeout reuses the sole legal source until the write settles', async (t) => {
  const c = await timeoutFixture(t, true)
  const release = c.hold()
  const settled = c.timeout(c.first)
  assert.equal(c.dispatch(), preferred)
  release()
  await settled
  assert.equal(c.f.routes.apply(c.url, 'video', undefined, false, 65536, 'xhr-terminal').url, null)
})

test('pending XHR timeout keeps Fetch, audio and other video representations on their ordinary routes', async (t) => {
  const c = await timeoutFixture(t)
  const audio = media('pending-timeout', 'audio.m4s')
  const other = media('pending-timeout', 'other-video.m4s')
  c.register(audio, 'audio', 'audio')
  c.register(other, 'other-video')
  c.hold()
  c.timeout(c.first)
  assert.equal(c.dispatch(c.url, 'fetch-consumer'), preferred)
  assert.equal(c.dispatch(audio), preferred)
  assert.equal(c.dispatch(other), preferred)
  assert.notEqual(c.dispatch(), preferred)
})

test('pending XHR timeout releases the replaced authority and ignores its late completion', async (t) => {
  const c = await timeoutFixture(t)
  const releaseOld = c.hold()
  const old = c.timeout(c.first)
  await Promise.resolve()
  const next = media('pending-timeout', 'replacement.m4s')
  assert.equal(c.register(next, 'selected'), c.representation)
  const replacement = start(c.f, next, 2, 'video', 'xhr-terminal', 65536)
  assert.equal(replacement.request.targetHost, preferred)
  assert.notEqual(replacement.request.authorityRevision, c.first.request.authorityRevision)
  c.hold()
  c.timeout(replacement)
  releaseOld()
  await old
  assert.equal(c.f.evidence.get(preferred, 'video'), null)
  assert.notEqual(c.dispatch(next), preferred)
  c.f.routes.invalidateForUserSetting()
  assert.equal(c.dispatch(next), preferred)
})

test('pending XHR timeout evicts only the oldest of more than 32 live observations', async (t) => {
  for (const count of [31, 32]) {
    const c = await timeoutFixture(t)
    c.hold()
    c.timeout(c.first)
    // All requests to the second host are dispatched before any of their timeouts.
    const others = Array.from({ length: count }, (_, index) =>
      start(c.f, c.url, index + 2, 'video', 'xhr-terminal', 65536),
    )
    const secondHost = others[0]!.request.targetHost
    assert.notEqual(secondHost, preferred)
    assert.ok(others.every((work) => work.request.targetHost === secondHost))
    for (const work of others) c.timeout(work)
    const next = c.dispatch()
    if (count === 31) {
      assert.notEqual(next, preferred, 'the oldest receipt is retained at the bound')
      assert.notEqual(next, secondHost, 'the later failed host is also avoided')
    } else {
      assert.equal(next, preferred, 'the 33rd receipt makes the oldest host available again')
    }
    assert.equal(c.f.evidence.get(preferred, 'video'), null)
    assert.equal(c.f.evidence.get(secondHost, 'video'), null)
  }
})

test('pending XHR timeout requires a trusted marker, an owned request and a readable monotonic clock', async (t) => {
  const c = await timeoutFixture(t)
  const unowned = start(c.f, c.url, 2, 'video', 'xhr-terminal', 65536)
  const unreadable = start(c.f, c.url, 3, 'video', 'xhr-terminal', 65536)
  c.hold()
  c.timeout(c.first, {}, false)
  assert.equal(c.dispatch(), preferred)
  c.timeout(unowned, { request: { ...unowned.request } })
  assert.equal(c.dispatch(), preferred)
  c.f.clock.monotonicNow = () => Number.NaN
  c.timeout(unreadable)
  c.f.clock.monotonicNow = c.f.clock.now
  assert.equal(c.dispatch(), preferred)
})
