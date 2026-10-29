import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate as nextTurn } from 'node:timers/promises'
import { testScope } from '../support/scope.ts'
import { fixture, media, dash } from './functional-races/routing-fixture.ts'
import { DelayedSettingsStorage, FakeStorage } from '../support/storage.ts'
import { SettingsStore, SETTINGS_KEY } from '../../src-v2/state/settings-store.ts'
import { MeasurementController } from '../../src-v2/application/measurement-controller.ts'
import type { MeasurementStatus } from '../../src-v2/application/measurement-model.ts'
import {
  MeasurementMetaStore,
  MEASUREMENT_META_KEY,
} from '../../src-v2/state/measurement-meta-store.ts'
import { catalogOutputPlan, backupOutputPlan } from '../../src-v2/domain/player-output-plan.ts'
import type { RangeProbeInput, RangeProbeResult } from '../../src-v2/application/ports.ts'
import { DiagnosticRecorder } from '../../src-v2/diagnostics/recorder.ts'
import { deferred } from '../support/deferred.ts'
import { earlyRetryReason } from '../../src-v2/domain/early-retry-diagnostic.ts'

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
        v.controller.requestCatalogValidation(hk)
        v.f.clock.advance(600001)
        v.controller.tick(v.status)
      } else await v.controller.prepareStartup(media('up141-test', 'video.m4s'))
      await nextTurn()
      assert.ok(storage.releases.length > 0)
      const before = v.f.evidence.list()
      await v.f.settings.update(
        kind === 'health'
          ? { healthMiddleRangeEnabled: false }
          : { startupEarlyReleaseEnabled: false },
      )
      storage.release()
      await nextTurn()
      assert.deepEqual(v.f.evidence.list(), before)
    },
  )

test('UP141-DIAG comparison cancellation retains its fixed reason', (t) => {
  testScope(t)
  assert.equal(earlyRetryReason('comparison-setting'), 'comparison-setting')
  assert.equal(earlyRetryReason('monitor-stop'), 'monitor-stop')
})

const hk = [
  'cn-hk-eq-01-03.bilivideo.com',
  'cn-hk-eq-01-05.bilivideo.com',
  'cn-hk-eq-01-01.bilivideo.com',
]
const flags = [
  'startupEarlyReleaseEnabled',
  'healthMiddleRangeEnabled',
  'backupFamilyDiversityEnabled',
] as const

test('UP141-TEST settings migrate A on and retry off, preserve false, and suppress off while locked', async (t) => {
  const scope = testScope(t),
    storage = new DelayedSettingsStorage()
  const settings = scope.own(new SettingsStore(storage, () => 1000))
  for (const key of flags) assert.equal(settings.get()[key], true)
  assert.equal(settings.get().earlyRetryEnabled, false)
  storage.holdNextSettingsLock = true
  const pending = settings.update(Object.fromEntries(flags.map((key) => [key, false])))
  for (const key of flags) assert.equal(settings.get()[key], false)
  storage.remote(SETTINGS_KEY, {
    ...settings.get(),
    ...Object.fromEntries(flags.map((key) => [key, true])),
    updatedAt: 1001,
  })
  for (const key of flags) assert.equal(settings.get()[key], false)
  storage.releaseSettingsLock()
  await pending
  const restored = scope.own(new SettingsStore(storage, () => 1002))
  for (const key of flags) assert.equal(restored.get()[key], false)
})

test('UP141-TEST diversity off restores original order without dropping eligibility or backup bound', (t) => {
  testScope(t)
  const primary = 'upos-sz-mirroraliov.bilivideo.com'
  const same = 'upos-sz-mirrorali.bilivideo.com',
    diverse = 'upos-sz-mirrorbos.bilivideo.com'
  const unavailable = new Set(['upos-sz-mirrorhw.bilivideo.com'])
  const sufficient = new Set([same, diverse])
  assert.deepEqual(
    catalogOutputPlan(primary, [same, diverse], unavailable, sufficient, false).slice(0, 2),
    [same, diverse],
  )
  const candidates = [same, diverse].map((host, index) => ({
    host,
    index,
    allowed: true,
    meetsHeadroom: true,
  }))
  assert.deepEqual(backupOutputPlan(primary, candidates, false, false), [0, 1])
  assert.deepEqual(backupOutputPlan(primary, candidates, true, false), [])
})

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
    ),
  )
  const status: MeasurementStatus = {
    generationActive: true,
    representation: context.representation,
    demand: { kind: 'video', requiredMbps: 4, highDemand: false },
    stableProgressSec: 25,
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

test('UP141-TEST targeted HK shares cooldown, caps one round and can remeasure fresh evidence', async (t) => {
  const v = await validation(t)
  const before = v.f.session.get().affinity
  v.controller.requestCatalogValidation(hk)
  v.controller.requestCatalogValidation(hk)
  v.controller.tick(v.status)
  await nextTurn()
  assert.equal(v.calls.length, 0)
  v.f.clock.advance(600001)
  v.controller.tick(v.status)
  await nextTurn()
  assert.deepEqual(
    v.calls.map((row) => row.host),
    hk,
  )
  assert.deepEqual(v.f.session.get().affinity, before)
  v.controller.requestCatalogValidation(hk)
  v.controller.tick(v.status)
  await nextTurn()
  assert.equal(v.calls.length, 3)
  v.f.clock.advance(600001)
  v.controller.tick(v.status)
  await nextTurn()
  assert.equal(v.calls.length, 6)
})

test('UP141-TEST validation rejects arbitrary, disabled and forbidden targets', async (t) => {
  const v = await validation(t)
  for (const hosts of [[], ['evil.invalid'], ['https://' + hk[0]], [...hk, hk[0]!]])
    assert.throws(() => v.controller.requestCatalogValidation(hosts))
  await v.f.settings.setCatalogEnabled(hk[0]!, false)
  assert.throws(() => v.controller.requestCatalogValidation([hk[0]!]))
  await v.f.restrictions.add({
    host: hk[1]!,
    kind: 'all',
    type: 'black',
    reason: 'user',
    expireAt: v.f.clock.now() + 1000000,
  })
  v.controller.requestCatalogValidation([hk[1]!])
  v.f.clock.advance(600001)
  v.controller.tick(v.status)
  await nextTurn()
  assert.equal(v.calls.length, 0)
})

for (const change of [
  'fixed',
  'disabled',
  'native',
  'representation',
  'authority',
  'reset',
] as const)
  test('UP141-TEST queued validation cancels on ' + change, async (t) => {
    const v = await validation(t)
    v.controller.requestCatalogValidation(hk)
    if (change === 'fixed') await v.f.settings.update({ fixedHost: hk[0]! })
    if (change === 'disabled') await v.f.settings.update({ disabled: true })
    if (change === 'native') await v.f.settings.update({ considerNativeSources: true })
    if (change === 'representation') v.controller.tick({ ...v.status, representation: null })
    if (change === 'authority') v.f.vault.reset(v.context.generation, v.context.epoch)
    if (change === 'reset') v.controller.reset()
    assert.notEqual(v.controller.snapshot().validation?.state, 'running')
    v.f.clock.advance(600001)
    v.controller.tick({ ...v.status, visible: false })
    await nextTurn()
    assert.equal(v.calls.length, 0)
    assert.equal(v.controller.snapshot().validation?.state, 'cancelled')
  })

test('UP141-TEST changing measurement flags cancels owned work and refuses late learning', async (t) => {
  const v = await validation(t)
  v.setHold()
  v.controller.requestCatalogValidation(hk)
  v.f.clock.advance(600001)
  v.controller.tick(v.status)
  await nextTurn()
  assert.equal(v.calls.length, 1)
  const evidence = v.f.evidence.list()
  await v.f.settings.update({ healthMiddleRangeEnabled: false })
  assert.equal(v.calls[0]!.signal.aborted, true)
  v.pending[0]!.resolve(v.result())
  await nextTurn()
  assert.deepEqual(v.f.evidence.list(), evidence)
  assert.equal(v.calls.length, 1)
})

test('UP141-TEST failed targeted probe closes its one-shot request without reopening budget', async (t) => {
  const v = await validation(t)
  v.setHold()
  v.controller.requestCatalogValidation(hk)
  v.f.clock.advance(600001)
  v.controller.tick(v.status)
  await nextTurn()
  v.pending[0]!.reject(new Error('probe adapter rejected'))
  await nextTurn()
  assert.equal(v.controller.snapshot().validation?.state, 'cancelled')
  assert.equal(v.controller.snapshot().validation?.reason, 'measurement-error')
  v.controller.tick(v.status)
  await nextTurn()
  assert.equal(v.calls.length, 1)
})

test('UP141-TEST source revoked during targeted round closes pending validation', async (t) => {
  const v = await validation(t)
  v.setHold()
  v.controller.requestCatalogValidation(hk)
  v.f.clock.advance(600001)
  v.controller.tick(v.status)
  await nextTurn()
  v.f.vault.reset(v.context.generation, v.context.epoch)
  v.pending[0]!.resolve(v.result())
  await nextTurn()
  assert.equal(v.controller.snapshot().validation?.state, 'cancelled')
  assert.equal(v.calls.length, 1)
})

test('UP141-TEST middle toggle off requests head while retaining validated source size', async (t) => {
  const v = await validation(t)
  const handle = v.f.vault.catalogSourceHandle(v.context.representation)!
  v.f.vault.recordRangeSize(v.context, handle, 8 * 1024 * 1024)
  await v.f.settings.update({ healthMiddleRangeEnabled: false })
  v.controller.requestCatalogValidation(hk)
  v.f.clock.advance(600001)
  v.controller.tick(v.status)
  await nextTurn()
  assert.equal(v.calls.length, 3)
  assert.ok(v.calls.every((row) => row.startByte === 0))
  assert.equal(v.f.vault.rangeSize(v.context, handle), 8 * 1024 * 1024)
})

test('UP141-TEST early retry events export bounded sanitized history without changing bufferTrend', (t) => {
  testScope(t)
  let now = 1000
  const recorder = new DiagnosticRecorder(
    () => now++,
    () => false,
  )
  const before = recorder.snapshot().bufferTrend
  for (let i = 0; i < 40; i++)
    recorder.record({
      type: 'early-retry',
      at: now,
      state: 'waiting',
      reason: i === 39 ? 'https://secret.invalid/path?token=secret' : 'no-alternative',
      host: hk[0]!,
      attempts: i,
    })
  const exported = JSON.parse(
    recorder.buildReport({ releaseStage: 'test', settings: { earlyRetryEnabled: false } }),
  )
  const events = exported.recorder.events.filter(
    (row: { type: string }) => row.type === 'early-retry',
  )
  assert.equal(events.length, 16)
  assert.equal(events.at(-1).data.reason, 'unknown')
  assert.equal(JSON.stringify(exported).includes('secret'), false)
  assert.deepEqual(recorder.snapshot().bufferTrend, before)
  assert.ok(new TextEncoder().encode(JSON.stringify(exported)).byteLength <= 96 * 1024)
})
