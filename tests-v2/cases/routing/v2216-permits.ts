import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RetryPermitState } from '../../../src-v2/application/routing/retry-permit-state.ts'
import { fixture, media, dash } from './routing-fixture.ts'
import { start } from '../../support/route-dispatch.ts'
import { testScope } from '../../support/scope.ts'

test('V2216 permit: prepared and materialized stages retain request and decision identity', (t) => {
  const f = fixture(testScope(t)),
    url = media('permit', 'a.m4s')
  f.adapter.transform(dash(url))
  const work = start(f, url, 1),
    permits = new RetryPermitState()
  const permit = Object.freeze({ id: 'permit-one', expiresAt: 2000 })
  permits.prepare(permit, work.request, work.request.targetHost, {
    kind: 'video',
    requiredMbps: 10,
    highDemand: false,
  })
  const pending = permits.current!
  assert.equal(pending.stage.phase, 'prepared')
  assert.strictEqual(pending.request, work.request)
  assert.equal(permits.applied(pending), null)
  assert.strictEqual(permits.materialize(pending, work.applied), work.applied)
  assert.strictEqual(permits.current, pending)
  assert.equal(pending.stage.phase, 'materialized')
  assert.strictEqual(permits.applied(pending)?.decision, work.applied.decision)
  assert.equal(permits.consume(pending), true)
  assert.equal(permits.consume(pending), false)
  assert.equal(permits.current, null)
})

test('V2216 permit: old revocation, materialization and acceptance cannot replace a new permit', (t) => {
  const f = fixture(testScope(t)),
    url = media('permit', 'b.m4s')
  f.adapter.transform(dash(url))
  const work = start(f, url, 1),
    permits = new RetryPermitState()
  const old = Object.freeze({ id: 'old', expiresAt: 2000 }),
    next = Object.freeze({ id: 'next', expiresAt: 4000 })
  const demand = { kind: 'video' as const, requiredMbps: 10, highDemand: false }
  permits.prepare(old, work.request, work.request.targetHost, demand)
  const prior = permits.current!
  permits.prepare(next, work.request, work.request.targetHost, demand)
  permits.revoke(old)
  permits.materialize(prior, work.applied)
  assert.strictEqual(permits.current?.permit, next)
  assert.equal(permits.applied(permits.current!), null)
  assert.equal(permits.consume(prior), false)
  permits.clear()
  assert.equal(permits.current, null)
})
