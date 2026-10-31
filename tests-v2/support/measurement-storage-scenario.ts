import assert from 'node:assert/strict'
import { setImmediate as nextTurn } from 'node:timers/promises'
import { MeasurementController } from '../../src-v2/application/measurement-controller.ts'
import type { MeasurementStatus } from '../../src-v2/application/measurement-contracts.ts'
import { MeasurementMetaStore } from '../../src-v2/state/measurement-meta-store.ts'
import { EVIDENCE_KEY } from '../../src-v2/state/evidence-store.ts'
import { fixture, media, dash } from '../regressions/functional-races/routing-fixture.ts'
import { FakeStorage } from './storage.ts'
import { testScope } from './scope.ts'

interface Result {
  unhandled: number
  afterFirst: string
  initialProbes: number
  laterProbes: number
  cleanupDone: boolean
}

async function scenario(reject: boolean): Promise<Result> {
  // Deliberately use a separate process: the unhandled rejection is itself a
  // product observation, not an unhandled rejection created by this test runner.
  const cleanups: (() => void | Promise<void>)[] = []
  const scope = testScope({
    after: (cleanup) => {
      cleanups.push(cleanup)
    },
  })
  class Storage extends FakeStorage {
    fails = reject
    override set<T>(key: string, value: T): void {
      if (key === EVIDENCE_KEY && this.fails) {
        this.fails = false
        throw Error('synthetic GM storage failure')
      }
      super.set(key, value)
    }
  }
  const storage = new Storage(),
    f = fixture(scope, storage),
    url = media('review-error', 'video.m4s')
  assert.equal(f.adapter.transform(dash(url)).accepted, true)
  const representation = f.vault.match(url).context?.representation
  assert.ok(representation)
  let unhandled = 0,
    probes = 0
  const onUnhandled = () => {
    unhandled++
  }
  process.on('unhandledRejection', onUnhandled)
  scope.defer(() => {
    process.removeListener('unhandledRejection', onUnhandled)
  })
  const measurement = scope.own(
    new MeasurementController(
      f.routes,
      new MeasurementMetaStore(storage, f.clock.now),
      {
        read: async () => {
          probes++
          return {
            bytes: 256 * 1024,
            elapsedMs: 100,
            ttfbMs: 10,
            directRange: true,
            status: 206,
            reason: 'measured',
          }
        },
      },
      f.clock.now,
      f.clock,
    ),
  )
  const status: MeasurementStatus = {
    generationActive: true,
    representation,
    demand: { kind: 'video', requiredMbps: 8, highDemand: false },
    stableProgressSec: 25,
    playableBufferSec: 40,
    visible: true,
    seeking: false,
    recovering: false,
    disabled: false,
  }
  measurement.tick(status)
  // The explicit event-loop boundary observes completion of the resolved probe,
  // storage rejection and Node's unhandled-rejection dispatch; no timed sleeps.
  await nextTurn()
  const afterFirst = measurement.snapshot().state,
    initialProbes = probes
  f.clock.advance(10 * 60_000 + 1)
  measurement.tick(status)
  await nextTurn()
  const laterProbes = probes
  await scope.dispose()
  return {
    unhandled,
    afterFirst,
    initialProbes,
    laterProbes,
    cleanupDone:
      f.clock.pendingCount === 0 &&
      [...storage.listeners.values()].every((listeners) => listeners.size === 0),
  }
}

process.stdout.write(JSON.stringify(await scenario(process.argv.includes('--reject'))))
