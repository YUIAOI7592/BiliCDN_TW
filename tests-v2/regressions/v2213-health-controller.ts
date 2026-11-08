import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate as nextTurn } from 'node:timers/promises'
import { fixture, dash, media } from './functional-races/routing-fixture.ts'
import { SharedEvidenceStorage } from '../support/shared-evidence-storage.ts'
import { testScope } from '../support/scope.ts'
import {
  MeasurementMetaStore,
  MEASUREMENT_META_KEY,
} from '../../src-v2/state/measurement-meta-store.ts'
import { MeasurementController } from '../../src-v2/application/measurement-controller.ts'
import { createRuntimeIds } from '../../src-v2/platform/runtime-ids.ts'
import { TRUSTED_CATALOG } from '../../src-v2/domain/catalog.ts'
import type { MeasurementStatus } from '../../src-v2/application/measurement-contracts.ts'

async function createPriorityRound(t: TestContext) {
  const scope = testScope(t),
    storage = new SharedEvidenceStorage(),
    f = fixture(scope, storage)
  const hosts = TRUSTED_CATALOG.filter((host) => !host.startsWith('cn-hk')).slice(0, 3)
  await f.settings.update({
    catalogOverrides: Object.fromEntries(
      TRUSTED_CATALOG.map((host) => [host, hosts.includes(host)]),
    ),
  })
  const url = media('health-controller', 'video.m4s')
  assert.equal(f.adapter.transform(dash(url)).accepted, true)
  const identity = f.vault.contextForUrl(url)!
  for (const host of hosts)
    await f.evidence.record(host, 'video', {
      requestId: `failure-${host}`,
      at: f.clock.now(),
      source: 'transport',
      outcome: 'failure',
      throughputMbps: null,
      ttfbMs: null,
      failureKind: 'network',
    })
  f.clock.advance(600_000)
  const status: MeasurementStatus = {
    generationActive: true,
    representation: identity.representation,
    demand: { kind: 'video', requiredMbps: 5, highDemand: false },
    stableProgressTicks: 25,
    playableBufferSec: 40,
    visible: true,
    seeking: false,
    recovering: false,
    disabled: false,
  }
  const calls: string[] = []
  const meta = new MeasurementMetaStore(storage, f.clock.now, createRuntimeIds())
  const controller = (before?: () => void | Promise<void>, metadata = meta) =>
    scope.own(
      new MeasurementController(
        f.routes,
        metadata,
        {
          read: async ({ host }) => {
            calls.push(host!)
            await before?.()
            return {
              bytes: 1024,
              elapsedMs: 100,
              ttfbMs: 10,
              status: 206,
              directRange: true,
              reason: 'short-response',
            }
          },
        },
        f.clock.now,
        f.clock,
        undefined,
        undefined,
        f.settings,
        f.clock.monotonicNow,
        createRuntimeIds(),
      ),
    )
  return { ...f, scope, hosts, status, calls, meta, controller }
}

test('V2213 health controller: all three sequential candidates acquire distinct shared claims once', async (t) => {
  const f = await createPriorityRound(t),
    controller = f.controller()
  controller.tick(f.status)
  await nextTurn()
  assert.equal(f.calls.length, 3)
  assert.equal(new Set(f.calls).size, 3)
  const payload = f.storage.get<{
    revalidationClaims: readonly unknown[]
    lastChallengeAt: number
  }>(MEASUREMENT_META_KEY, null!)
  assert.equal(payload.revalidationClaims.length, 3)
  assert.equal(payload.lastChallengeAt, f.clock.now())
  for (const host of f.hosts) assert.equal(f.evidence.get(host, 'video')!.circuitLevel, 1)
  controller.dispose()
  f.clock.advance(600_000)
  const reopened = new MeasurementMetaStore(f.storage, f.clock.now, createRuntimeIds())
  f.controller(undefined, reopened).tick(f.status)
  await nextTurn()
  assert.equal(
    f.calls.length,
    3,
    'a new controller/store cannot reacquire the same expired circuits',
  )
  assert.equal(f.clock.pendingCount, 0)
})

test('V2213 health controller: clearing coordination after the first read prevents later claims', async (t) => {
  const f = await createPriorityRound(t)
  const controller = f.controller(() => f.meta.clear())
  controller.tick(f.status)
  await nextTurn()
  assert.equal(f.calls.length, 1)
  await f.meta.withLock((lock) => assert.equal(f.meta.coordination(lock)!.claims.length, 0))
  assert.equal(f.clock.pendingCount, 0)
})

test('V2213 health controller: cancellation after reservation does not return the claimed opportunity', async (t) => {
  const f = await createPriorityRound(t)
  let controller: MeasurementController
  controller = f.controller(() => controller.cancel('controlled-cancellation'))
  controller.tick(f.status)
  await nextTurn()
  assert.equal(f.calls.length, 1)
  await f.meta.withLock((lock) => {
    const claims = f.meta.coordination(lock)!.claims
    assert.equal(claims.length, 1)
    assert.equal(claims[0]!.host, f.calls[0])
  })
  assert.equal(f.clock.pendingCount, 0)
})

test('V2213 health controller: two controllers share the existing round cooldown', async (t) => {
  const f = await createPriorityRound(t)
  f.controller().tick(f.status)
  f.controller(
    undefined,
    new MeasurementMetaStore(f.storage, f.clock.now, createRuntimeIds()),
  ).tick(f.status)
  await nextTurn()
  assert.equal(f.calls.length, 3)
  assert.equal(f.clock.pendingCount, 0)
})
