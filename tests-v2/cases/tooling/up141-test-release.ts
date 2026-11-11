import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate as nextTurn } from 'node:timers/promises'
import { testScope } from '../../support/scope.ts'
import { fixture, media, dash } from '../routing/routing-fixture.ts'
import { FakeStorage } from '../../support/storage.ts'
import { SETTINGS_KEY } from '../../../src-v2/state/settings-store.ts'
import { MeasurementController } from '../../../src-v2/application/measurement/measurement-controller.ts'
import { type MeasurementStatus } from '../../../src-v2/application/measurement/measurement-contracts.ts'
import {
  MeasurementMetaStore,
  MEASUREMENT_META_KEY,
} from '../../../src-v2/state/measurement-meta-store.ts'
import {
  type RangeProbeInput,
  type RangeProbeResult,
} from '../../../src-v2/application/measurement/measurement-contracts.ts'
import { deferred } from '../../support/deferred.ts'

class HeldEvidenceStorage extends FakeStorage {
  held = true
  releases: (() => void)[] = []
  release(): void {
    this.held = false
    for (const resolve of this.releases.splice(0)) resolve()
  }
  override async withLock<T>(name: string, task: () => T | Promise<T>): Promise<T> {
    if (name === 'routeEvidence' && this.held)
      await new Promise<void>((resolve) => this.releases.push(resolve))
    return await super.withLock(name, task)
  }
}

for (const kind of ['health', 'startup'] as const)
  test(
    'UP141-TEST ' + kind + ' rejects evidence queued behind storage after policy cancellation',
    async (t) => {
      const storage = new HeldEvidenceStorage()
      testScope(t).defer(() => storage.release())
      const v = await validation(t, storage)
      if (kind === 'health') {
        v.f.clock.advance(600001)
        v.controller.tick(v.status)
      } else await v.controller.prepareStartup(media('up141-test', 'video.m4s'))
      await nextTurn()
      assert.ok(storage.releases.length > 0)
      const before = v.f.evidence.list()
      await v.f.settings.update({ disabled: true })
      storage.release()
      await nextTurn()
      assert.deepEqual(v.f.evidence.list(), before)
    },
  )

const hk = [
  'cn-hk-eq-01-03.bilivideo.com',
  'cn-hk-eq-01-05.bilivideo.com',
  'cn-hk-eq-01-01.bilivideo.com',
]

async function validation(t: TestContext, storage = new FakeStorage()) {
  const scope = testScope(t),
    f = fixture(scope, storage)
  const url = media('up141-test', 'video.m4s')
  f.adapter.transform(dash(url))
  for (const host of hk) await f.settings.setCatalogEnabled(host, true)
  const context = f.vault.contextForUrl(url)!
  const calls: RangeProbeInput[] = []
  const pending: ReturnType<typeof deferred<RangeProbeResult>>[] = []
  let hold = false
  const result = (): RangeProbeResult => ({
    bytes: 384 * 1024,
    elapsedMs: 100,
    ttfbMs: 10,
    status: 206,
    directRange: true,
    reason: 'measured',
    range: { startByte: 0, endByte: 384 * 1024 - 1, totalBytes: 8 * 1024 * 1024 },
  })
  const controller = scope.own(
    new MeasurementController(
      f.routes,
      new MeasurementMetaStore(storage, f.clock.now),
      {
        read: async (input) => {
          calls.push(input)
          if (!hold) return result()
          const item = deferred<RangeProbeResult>()
          pending.push(item)
          return await item.promise
        },
      },
      f.clock.now,
      f.clock,
      f.vault,
      () => 0.5,
      f.settings,
      f.clock.now,
    ),
  )
  const status: MeasurementStatus = {
    generationActive: true,
    representation: context.representation,
    demand: { kind: 'video', requiredMbps: 4, highDemand: false },
    stableProgressTicks: 25,
    stableProgressMs: 25_000,
    progressObservation: 'progress' as const,
    playableBufferSec: 40,
    visible: true,
    seeking: false,
    recovering: false,
    disabled: false,
  }
  // Seed current status without starting an automatic round.
  storage.set(MEASUREMENT_META_KEY, { schema: 2, lastChallengeAt: f.clock.now(), catalogCursor: 0 })
  controller.tick(status)
  await nextTurn()
  return {
    f,
    controller,
    calls,
    context,
    status,
    pending,
    result,
    setHold: () => {
      hold = true
    },
  }
}

test('UP141-TEST automatic exploration shares cooldown, caps rounds and skips fresh evidence', async (t) => {
  const v = await validation(t)
  const before = v.f.session.get().affinity

  v.controller.tick(v.status)
  await nextTurn()
  assert.equal(v.calls.length, 0)
  v.f.clock.advance(600001)
  v.controller.tick(v.status)
  await nextTurn()
  assert.equal(v.calls.length, 3)
  const firstHosts = v.calls.map((row) => row.host)
  assert.deepEqual(v.f.session.get().affinity, before)

  v.controller.tick(v.status)
  await nextTurn()
  assert.equal(v.calls.length, 3)
  v.f.clock.advance(600001)
  v.controller.tick(v.status)
  await nextTurn()
  assert.equal(v.calls.length, 6)
  assert.ok(v.calls.slice(3).every((row) => !firstHosts.includes(row.host)))
})

for (const condition of ['hidden', 'seeking', 'recovering', 'disabled', 'representation'] as const)
  test('CC39-MEASURE automatic exploration rejects unsafe state: ' + condition, async (t) => {
    const v = await validation(t)
    const before = v.f.storage.get<Record<string, unknown>>(
      MEASUREMENT_META_KEY,
      {},
    ).lastChallengeAt
    v.f.clock.advance(600001)
    const status = { ...v.status }
    if (condition === 'hidden') status.visible = false
    if (condition === 'seeking') status.seeking = true
    if (condition === 'recovering') status.recovering = true
    if (condition === 'disabled') status.disabled = true
    if (condition === 'representation') status.representation = null
    v.controller.tick(status)
    await nextTurn()
    assert.equal(v.calls.length, 0)
    assert.equal(
      v.f.storage.get<Record<string, unknown>>(MEASUREMENT_META_KEY, {}).lastChallengeAt,
      before,
    )
    v.controller.tick(v.status)
    await nextTurn()
    assert.equal(v.calls.length, 3, 'a later eligible observation can still start a full round')
  })

test('UP141-TEST disabling cancels owned work and refuses late learning', async (t) => {
  const v = await validation(t)
  v.setHold()

  v.f.clock.advance(600001)
  v.controller.tick(v.status)
  await nextTurn()
  assert.equal(v.calls.length, 1)
  const evidence = v.f.evidence.list()
  await v.f.settings.update({ disabled: true })
  assert.equal(v.calls[0]!.signal.aborted, true)
  v.pending[0]!.resolve(v.result())
  await nextTurn()
  assert.deepEqual(v.f.evidence.list(), evidence)
  assert.equal(v.calls.length, 1)
})

test('UP141-TEST failed automatic probe respects its consumed cooldown', async (t) => {
  const v = await validation(t)
  v.setHold()

  v.f.clock.advance(600001)
  v.controller.tick(v.status)
  await nextTurn()
  v.pending[0]!.reject(new Error('probe adapter rejected'))
  await nextTurn()
  assert.equal(v.controller.snapshot().state, 'failed')
  assert.equal(v.controller.snapshot().reason, 'measurement-error')
  v.controller.tick(v.status)
  await nextTurn()
  assert.equal(v.calls.length, 1)
})

test('UP141-TEST source revoked during automatic round refuses late learning', async (t) => {
  const v = await validation(t)
  v.setHold()

  v.f.clock.advance(600001)
  v.controller.tick(v.status)
  await nextTurn()
  v.f.vault.reset(v.context.generation, v.context.epoch)
  v.pending[0]!.resolve(v.result())
  await nextTurn()
  assert.equal(v.f.evidence.list().length, 0)
  assert.equal(v.calls.length, 1)
})

test('UP141-TEST retired middle false still requests middle with validated source size', async (t) => {
  const v = await validation(t)
  const handle = v.f.vault.catalogSourceHandle(v.context.representation)!
  v.f.vault.recordRangeSize(v.context, handle, 8 * 1024 * 1024)
  v.f.storage.remote(SETTINGS_KEY, {
    ...v.f.settings.get(),
    healthMiddleRangeEnabled: false,
    updatedAt: v.f.clock.now() + 1,
  })

  v.f.clock.advance(600001)
  v.controller.tick(v.status)
  await nextTurn()
  assert.equal(v.calls.length, 3)
  assert.ok(v.calls.every((row) => row.startByte! > 0))
  assert.equal(v.f.vault.rangeSize(v.context, handle), 8 * 1024 * 1024)
})

for (const kind of ['health', 'startup'] as const)
  test('V2218 retired notifications retain active ' + kind + ' work and budget', async (t) => {
    const v = await validation(t)
    v.setHold()
    let gate: Promise<void> | undefined
    if (kind === 'health') {
      v.f.clock.advance(600001)
      v.controller.tick(v.status)
    } else gate = v.controller.prepareStartup(media('up141-test', 'video.m4s'))
    await nextTurn()
    const started = v.calls.length
    assert.equal(started, kind === 'health' ? 1 : 3)
    const notify = () =>
      v.f.storage.remote(SETTINGS_KEY, {
        ...v.f.settings.get(),
        startupEarlyReleaseEnabled: false,
        healthMiddleRangeEnabled: false,
        backupFamilyDiversityEnabled: false,
        updatedAt: v.f.clock.now() + 1,
      })
    notify()
    assert.ok(v.calls.every((row) => !row.signal.aborted))
    for (let i = 0; i < 3; i++) {
      v.pending[i]?.resolve(v.result())
      await nextTurn()
    }
    await gate
    assert.equal(v.calls.length, 3)
    assert.equal(
      kind === 'health' ? v.controller.snapshot().state : v.controller.snapshot().startup?.state,
      'complete',
      'the active round finished before checking whether its consumed budget can reopen',
    )
    notify()
    if (kind === 'health') v.controller.tick(v.status)
    else await v.controller.prepareStartup(media('up141-test', 'video.m4s'))
    await nextTurn()
    assert.equal(v.calls.length, 3, 'retired fields cannot reopen consumed work')
  })
