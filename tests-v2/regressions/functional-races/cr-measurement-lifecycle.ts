import test from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate as nextTurn } from 'node:timers/promises'
import { MeasurementController } from '../../../src-v2/application/measurement-controller.ts'
import type { MeasurementStatus } from '../../../src-v2/application/measurement-contracts.ts'
import { MeasurementMetaStore } from '../../../src-v2/state/measurement-meta-store.ts'
import { EVIDENCE_KEY } from '../../../src-v2/state/evidence-store.ts'
import type { RangeProbeResult } from '../../../src-v2/application/ports.ts'
import { fixture, media, dash } from './routing-fixture.ts'
import { FakeStorage } from '../../support/storage.ts'
import { testScope } from '../../support/scope.ts'
import { deferred } from '../../support/deferred.ts'

const measured: RangeProbeResult = {
  bytes: 262144,
  elapsedMs: 100,
  ttfbMs: 5,
  status: 206,
  directRange: true,
  reason: 'measured',
}
function ready(f: ReturnType<typeof fixture>): MeasurementStatus {
  const url = media('cr-measurement', 'video.m4s')
  f.adapter.transform(dash(url))
  return {
    generationActive: true,
    representation: f.vault.match(url).context!.representation,
    demand: { kind: 'video', requiredMbps: 8, highDemand: false },
    stableProgressSec: 25,
    playableBufferSec: 40,
    visible: true,
    seeking: false,
    recovering: false,
    disabled: false,
  }
}

test('CR-04 failed evidence persistence cannot publish an in-memory successful sample', async (t) => {
  class Storage extends FakeStorage {
    override set<T>(key: string, value: T): void {
      if (key === EVIDENCE_KEY) throw Error('synthetic storage failure')
      super.set(key, value)
    }
  }
  const f = fixture(testScope(t), new Storage())
  await assert.rejects(
    f.evidence.record('synthetic.example', 'video', {
      requestId: 'synthetic',
      at: f.clock.now(),
      source: 'challenge',
      outcome: 'success',
      throughputMbps: 5,
      ttfbMs: 3,
      failureKind: null,
    }),
  )
  assert.equal(f.evidence.get('synthetic.example', 'video'), null)
  assert.equal(f.storage.values.has(EVIDENCE_KEY), false)
})

for (const phase of ['measurement', 'routeEvidence', 'probe'] as const)
  test(`CR-04 ${phase} rejection releases ownership without immediate retry or CDN failure`, async (t) => {
    let attempts = 0,
      probes = 0
    class Storage extends FakeStorage {
      override async withLock<T>(name: string, task: () => T | Promise<T>): Promise<T> {
        if (name === phase && ++attempts === 1) throw Error('sensitive exception text')
        return await super.withLock(name, task)
      }
    }
    const scope = testScope(t),
      f = fixture(scope, new Storage()),
      status = ready(f)
    const controller = scope.own(
      new MeasurementController(
        f.routes,
        new MeasurementMetaStore(f.storage, f.clock.now),
        {
          read: async () => {
            probes++
            if (phase === 'probe' && probes === 1) throw Error('sensitive exception text')
            return measured
          },
        },
        f.clock.now,
        f.clock,
      ),
    )
    controller.tick(status)
    await nextTurn()
    assert.equal(controller.snapshot().state, 'failed')
    assert.equal(controller.snapshot().reason, 'measurement-error')
    assert.equal(f.evidence.list().length, 0)
    assert.equal(f.clock.pendingCount, 0)
    const count = probes,
      locks = attempts
    controller.tick(status)
    await nextTurn()
    assert.equal(probes, count)
    assert.equal(attempts, locks)
    f.clock.advance(600_001)
    controller.tick(status)
    await nextTurn()
    assert.ok(probes > count)
    assert.equal(controller.snapshot().state, 'complete')
  })

for (const reject of [false, true])
  test(`CR-04 old storage ${reject ? 'rejection' : 'completion'} cannot clear or overwrite a newer round`, async (t) => {
    const old = deferred<void>(),
      newer = deferred<RangeProbeResult>()
    let held = false,
      probes = 0
    class Storage extends FakeStorage {
      override async withLock<T>(name: string, task: () => T | Promise<T>): Promise<T> {
        if (name === 'routeEvidence' && !held) {
          held = true
          await old.promise
        }
        return await super.withLock(name, task)
      }
    }
    const scope = testScope(t),
      f = fixture(scope, new Storage()),
      status = ready(f)
    scope.defer(() => {
      old.resolve()
      newer.resolve(measured)
    })
    const controller = scope.own(
      new MeasurementController(
        f.routes,
        new MeasurementMetaStore(f.storage, f.clock.now),
        { read: async () => (++probes === 1 ? measured : await newer.promise) },
        f.clock.now,
        f.clock,
      ),
    )
    controller.tick(status)
    await nextTurn()
    assert.equal(held, true)
    controller.reset()
    f.clock.advance(600_001)
    controller.tick(status)
    await nextTurn()
    assert.equal(controller.snapshot().state, 'running')
    assert.equal(probes, 2)
    if (reject) old.reject(Error('old rejected'))
    else old.resolve()
    await nextTurn()
    assert.equal(controller.snapshot().state, 'running')
    controller.tick(status)
    await nextTurn()
    assert.equal(probes, 2)
    newer.resolve(measured)
    await nextTurn()
    assert.equal(controller.snapshot().state, 'complete')
  })
