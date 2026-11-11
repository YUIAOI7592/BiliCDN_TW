import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RequestOwnership } from '../../../src-v2/application/routing/request-ownership.ts'
import { fixture, media, dash } from './routing-fixture.ts'
import { start, finish } from '../../support/route-dispatch.ts'
import { testScope } from '../../support/scope.ts'
import { requestId } from '../../../src-v2/domain/model.ts'

test('V2216 ownership: idempotent preparation preserves lazy plan reads and monotonic revisions', (t) => {
  const f = fixture(testScope(t)),
    url = media('ownership', 'a.m4s')
  assert.equal(f.adapter.transform(dash(url)).accepted, true)
  const work = start(f, url, 1),
    owner = new RequestOwnership()
  let reads = 0
  const revision = () => {
    reads++
    return 7
  }
  const a = owner.prepare(work.request, revision)
  assert.strictEqual(owner.prepare(work.request, revision), a)
  assert.strictEqual(owner.prepare(a, revision), a)
  assert.equal(reads, 1)
  const b = owner.prepare({ ...work.request, requestId: requestId('second') }, revision)
  assert.equal(b.selectionRevision, a.selectionRevision)
  assert.equal(b.dispatchSequence, a.dispatchSequence! + 1)
  owner.reset('policy')
  const c = owner.prepare({ ...work.request, requestId: requestId('third') }, revision)
  assert.equal(c.selectionRevision, a.selectionRevision! + 1)
  assert.equal(c.dispatchSequence, b.dispatchSequence! + 1)
  assert.strictEqual(owner.owner(work.request), a)
})

test('V2216 ownership: distinct success proposals settle only after owner confirmation', (t) => {
  const f = fixture(testScope(t)),
    url = media('ownership', 'b.m4s')
  f.adapter.transform(dash(url))
  const work = start(f, url, 1),
    owner = new RequestOwnership()
  const request = owner.prepare(work.request, () => 1),
    rep = request.representation!
  owner.started(request)
  assert.equal(owner.success(rep, 'one'), false)
  assert.equal(owner.success(rep, 'one'), false)
  assert.equal(owner.success(rep, 'two'), true)
  assert.equal(owner.selection?.phase, 'pending')
  assert.equal(owner.sampleCount, 2)
  owner.confirm(rep)
  assert.equal(owner.selection?.phase, 'confirmed')
  assert.equal(owner.sampleCount, 0)
})

test('V2216 ownership: policy, content and source invalidation retain distinct cleanup scopes', (t) => {
  const f = fixture(testScope(t)),
    url = media('ownership', 'c.m4s')
  f.adapter.transform(dash(url))
  const { request } = start(f, url, 1),
    rep = request.representation!,
    owner = new RequestOwnership()
  owner.success(rep, 'before-dispatch')
  owner.reset('policy')
  assert.equal(owner.tentativeRepresentation, rep)
  assert.equal(owner.sampleCount, 0)
  owner.success(rep, 'again')
  owner.forgetRepresentation(rep)
  assert.equal(owner.tentativeRepresentation, null)
  assert.equal(owner.sampleCount, 1)
  owner.reset('content')
  assert.equal(owner.tentativeRepresentation, null)
  assert.equal(owner.sampleCount, 0)
})

test('V2216 ownership: committed request aliases share one terminal receipt', async (t) => {
  const f = fixture(testScope(t)),
    url = media('ownership', 'd.m4s')
  f.adapter.transform(dash(url))
  const work = start(f, url, 1),
    owner = new RequestOwnership()
  const prepared = owner.prepare(work.request, () => 1)
  const committed = owner.commitRoute(work.request, 2)!
  assert.equal(committed.routeRevision, 2)
  assert.strictEqual(owner.owner(prepared), committed)
  const observation = { request: work.request } as Parameters<
    RequestOwnership['beginObservation']
  >[0]
  assert.strictEqual(owner.beginObservation(observation), committed)
  assert.equal(owner.beginObservation({ ...observation, request: prepared }), null)
  await finish(f, work)
  const before = f.evidence.list()
  assert.equal(f.evidence.get(work.request.targetHost, 'video')?.samples.length, 1)
  await finish(f, work)
  assert.deepEqual(f.evidence.list(), before)
})
