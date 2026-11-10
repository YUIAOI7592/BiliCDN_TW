import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate as nextTurn } from 'node:timers/promises'
import { fixture, dash, media } from '../routing-fixture.ts'
import { SharedEvidenceStorage } from '../../../support/shared-evidence-storage.ts'
import { testScope } from '../../../support/scope.ts'
import {
  MeasurementMetaStore,
  MEASUREMENT_META_KEY,
} from '../../../../src-v2/state/measurement-meta-store.ts'
import { MeasurementController } from '../../../../src-v2/application/measurement/measurement-controller.ts'
import {
  type MeasurementMeta,
  type RevalidationClaim,
} from '../../../../src-v2/state/measurement-meta-ports.ts'
import { createRuntimeIds } from '../../../../src-v2/platform/runtime-ids.ts'
import { type StoragePort } from '../../../../src-v2/platform/storage-port.ts'
import { TRUSTED_CATALOG } from '../../../../src-v2/domain/catalog.ts'
import { type MeasurementStatus } from '../../../../src-v2/application/measurement/measurement-contracts.ts'

async function createPriorityRound(t: TestContext, storage = new SharedEvidenceStorage()) {
  const scope = testScope(t),
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
    stableProgressMs: 25_000,
    progressObservation: 'progress' as const,
    playableBufferSec: 40,
    visible: true,
    seeking: false,
    recovering: false,
    disabled: false,
  }
  const calls: string[] = []
  const readControl = (host: string, kind: 'video' | 'audio') =>
    f.evidence.readCurrentControl(host, kind)
  const meta = new MeasurementMetaStore(storage, f.clock.now, createRuntimeIds(), readControl)
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
  return { ...f, scope, hosts, status, calls, meta, controller, readControl }
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
  const reopened = new MeasurementMetaStore(
    f.storage,
    f.clock.now,
    createRuntimeIds(),
    f.readControl,
  )
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
    new MeasurementMetaStore(f.storage, f.clock.now, createRuntimeIds(), f.readControl),
  ).tick(f.status)
  await nextTurn()
  assert.equal(f.calls.length, 3)
  assert.equal(f.clock.pendingCount, 0)
})

class CountedMetadata extends MeasurementMetaStore {
  claimCalls = 0
  updates = 0
  override claimRevalidation(generation: string, claim: RevalidationClaim): boolean {
    this.claimCalls++
    return super.claimRevalidation(generation, claim)
  }
  override update(change: Partial<MeasurementMeta>): void {
    this.updates++
    super.update(change)
  }
}

async function fillClaims(meta: MeasurementMetaStore, storage: StoragePort) {
  await meta.withLock((lock) => {
    const generation = meta.coordination(lock)!.generation
    const claims = Array.from({ length: 96 }, (_, index) => ({
      host: `full-${index}.example`,
      kind: 'video',
      stamp: { generation: 'synthetic-evidence', recordId: `record-${index}`, revision: 1 },
      claimId: `claim-${index}`,
      roundId: 'filled-round',
    }))
    // A full historical ledger is fixture input, not authority to claim these synthetic stamps.
    storage.set(MEASUREMENT_META_KEY, {
      ...storage.get<Record<string, unknown>>(MEASUREMENT_META_KEY, {}),
      revalidationClaims: claims,
    })
    assert.equal(meta.coordination(lock)!.generation, generation)
    assert.equal(meta.coordination(lock)!.claims.length, 96)
  })
}

for (const oldEnough of [true, false])
  test(`V2213 health fallback: full shared claims ${oldEnough ? 'allow ordinary six-hour candidates' : 'cannot bypass six-hour freshness'}`, async (t) => {
    const f = await createPriorityRound(t)
    await fillClaims(f.meta, f.storage)
    if (oldEnough) f.clock.advance(6 * 60 * 60_000)
    const meta = new CountedMetadata(f.storage, f.clock.now, createRuntimeIds(), f.readControl)
    f.controller(undefined, meta).tick(f.status)
    await nextTurn()
    assert.equal(f.calls.length, oldEnough ? 3 : 0)
    assert.equal(
      meta.claimCalls,
      1,
      'a failed priority opportunity is not claimed again in the same round',
    )
    assert.equal(
      meta.updates,
      oldEnough ? 1 : 0,
      'ordinary fallback consumes no second cooldown or cursor update',
    )
    assert.equal(meta.get().catalogCursor, oldEnough ? 1 : 0)
    assert.equal(
      f.storage.get<{ revalidationClaims: unknown[] }>(MEASUREMENT_META_KEY, null!)
        .revalidationClaims.length,
      96,
    )
    assert.equal(f.clock.pendingCount, 0)
  })

test('V2213 health fallback: two controllers still consume one ordinary round cooldown', async (t) => {
  const f = await createPriorityRound(t)
  await fillClaims(f.meta, f.storage)
  f.clock.advance(6 * 60 * 60_000)
  const a = new CountedMetadata(f.storage, f.clock.now, createRuntimeIds(), f.readControl)
  const b = new CountedMetadata(f.storage, f.clock.now, createRuntimeIds(), f.readControl)
  f.controller(undefined, a).tick(f.status)
  f.controller(undefined, b).tick(f.status)
  await nextTurn()
  assert.equal(f.calls.length, 3)
  assert.equal(a.claimCalls + b.claimCalls, 1)
  assert.equal(a.updates + b.updates, 1)
  assert.equal(a.get().catalogCursor, 1)
  assert.equal(f.clock.pendingCount, 0)
})

test('V2213 health fallback: cancellation during failed claim cannot start ordinary work', async (t) => {
  const f = await createPriorityRound(t)
  f.clock.advance(6 * 60 * 60_000)
  let controller: MeasurementController
  class CancelledClaim extends CountedMetadata {
    override claimRevalidation(_generation: string, _claim: RevalidationClaim): boolean {
      this.claimCalls++
      controller.cancel('controlled-fallback-cancellation')
      return false
    }
  }
  const meta = new CancelledClaim(f.storage, f.clock.now, createRuntimeIds(), f.readControl)
  controller = f.controller(undefined, meta)
  controller.tick(f.status)
  await nextTurn()
  assert.equal(f.calls.length, 0)
  assert.equal(meta.claimCalls, 1)
  assert.equal(meta.updates, 0)
  assert.equal(f.clock.pendingCount, 0)
})

class ClaimFaultStorage extends SharedEvidenceStorage {
  mode: 'normal' | 'before-save' | 'unknown-save' | 'protocol-loss' = 'normal'
  failNextRead = false
  override readResult<T>(key: string, fallback: T): { ok: true; value: T } | { ok: false } {
    if (key === MEASUREMENT_META_KEY && this.failNextRead) {
      this.failNextRead = false
      return { ok: false }
    }
    return super.readResult(key, fallback)
  }
  override set<T>(key: string, value: T): void {
    const payload = value as Record<string, unknown>
    const claimWrite =
      key === MEASUREMENT_META_KEY &&
      Array.isArray(payload.revalidationClaims) &&
      payload.revalidationClaims.length > 0
    if (claimWrite && this.mode === 'before-save') throw Error('controlled claim write rejection')
    if (claimWrite && this.mode === 'protocol-loss') {
      super.set(key, {
        schema: 2,
        catalogCursor: 0,
        lastChallengeAt: 0,
        updatedAt: payload.updatedAt,
      })
      return
    }
    super.set(key, value)
    if (claimWrite && this.mode === 'unknown-save') this.failNextRead = true
  }
}

for (const mode of ['before-save', 'unknown-save', 'protocol-loss'] as const)
  test(`V2213 health fallback: ${mode} disables priority but keeps ordinary bounded work`, async (t) => {
    const storage = new ClaimFaultStorage(),
      f = await createPriorityRound(t, storage)
    f.clock.advance(6 * 60 * 60_000)
    storage.mode = mode
    const meta = new CountedMetadata(storage, f.clock.now, createRuntimeIds(), f.readControl)
    f.controller(undefined, meta).tick(f.status)
    await nextTurn()
    assert.equal(f.calls.length, 3)
    assert.equal(new Set(f.calls).size, 3)
    assert.equal(meta.claimCalls, 1)
    assert.equal(meta.updates, 1)
    assert.equal(meta.get().catalogCursor, 1)
    assert.equal(meta.get().lastChallengeAt, f.clock.now())
    assert.equal(f.clock.pendingCount, 0)
  })
