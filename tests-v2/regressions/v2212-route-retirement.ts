import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, dash, media } from './functional-races/routing-fixture.ts'
import { start, finish } from '../support/route-dispatch.ts'
import { testScope } from '../support/scope.ts'

test('V2212 routes: reset clears current attribution and capacity without erasing committed learning', async (t) => {
  const f = fixture(testScope(t))
  const url = media('2212/1', 'video.m4s')
  assert.equal(f.adapter.transform(dash(url)).accepted, true)
  const first = start(f, url, 1)
  await finish(f, first)
  await finish(f, start(f, url, 2))
  const before = f.routes.snapshot()
  assert.ok(before.currentCapacity)
  assert.equal(before.latest.video?.responseHost, first.request.targetHost)
  assert.ok(before.requested.video)
  const saved = structuredClone(f.evidence.get(first.request.targetHost, 'video'))
  assert.deepEqual(
    saved?.samples.map((row) => row.requestId),
    ['rigor-1', 'rigor-2'],
  )
  const late = start(f, url, 3)
  const next = f.session.beginGeneration(false)
  f.vault.reset(next.generation, next.epoch)
  f.routes.resetEpoch()
  await finish(f, late)
  const after = f.routes.snapshot()
  assert.deepEqual(after.latest, {})
  assert.deepEqual(after.requested, {})
  assert.equal(after.currentCapacity, null)
  assert.equal(after.representation, null)
  assert.deepEqual(f.evidence.get(first.request.targetHost, 'video'), saved)
})
