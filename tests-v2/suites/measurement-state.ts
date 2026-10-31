import { extendFixture } from '../support/fixture-context.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import {
  MeasurementMetaStore,
  MEASUREMENT_META_KEY,
} from '../../src-v2/state/measurement-meta-store.ts'
import { MeasurementController } from '../../src-v2/application/measurement-controller.ts'
import { generationId, epochId, representationId } from '../../src-v2/domain/model.ts'
import { TRUSTED_CATALOG } from '../../src-v2/domain/catalog.ts'
import { FakeStorage } from '../support/storage.ts'
import { FakeClock } from '../support/clock.ts'
import { measurementRoutes } from '../support/controllers.ts'
import { testScope } from '../support/scope.ts'
import '../regressions/functional-races/startup-abort.ts'
import '../regressions/functional-races/cr-measurement-errors.ts'
import '../regressions/functional-races/cr-measurement-lifecycle.ts'
import '../regressions/functional-races/measurement-metadata.ts'
import '../regressions/functional-races/up141-probe.ts'
import '../regressions/functional-races/up141-start.ts'

// Named scenarios create only their prerequisite state; resources belong to this test.
async function createMeasurementStateScenario(t: TestContext) {
  const scope = testScope(t)
  class MeasurementStorage extends FakeStorage {
    lockName = ''
    blocked = false
    release: () => void = () => undefined
    override async withLock<T>(name: string, task: () => Promise<T> | T): Promise<T> {
      this.lockName = name
      if (this.blocked)
        await new Promise<void>((resolve) => {
          this.release = resolve
        })
      return await task()
    }
  }
  const storage = new MeasurementStorage(),
    clock = scope.own(new FakeClock())
  const meta = new MeasurementMetaStore(storage, clock.now)
  return extendFixture({}, { scope, MeasurementStorage, storage, clock, meta } as const)
}

async function checkMeasurementMetadataDefaultsToFirstCatalogCursor1(
  t: TestContext,
): Promise<void> {
  const base = await createMeasurementStateScenario(t)

  assert.strictEqual(
    base.meta.get().catalogCursor,
    0,
    'measurement metadata defaults to first Catalog cursor',
  )
  assert.strictEqual(
    base.meta.get().lastChallengeAt,
    0,
    'measurement metadata defaults to no cooldown',
  )
  base.storage.set(MEASUREMENT_META_KEY, {
    schema: 2,
    catalogCursor: 4,
    lastChallengeAt: 123,
    futureField: 'preserve',
  })
  base.meta.update({ catalogCursor: 5 })
  assert.strictEqual(
    base.meta.get().lastChallengeAt,
    123,
    'cursor update preserves existing cross-tab cooldown',
  )
  assert.equal(
    Object.hasOwn(base.storage.get(MEASUREMENT_META_KEY, {}), 'futureField'),
    false,
    'metadata updates only retain explicitly validated owned fields',
  )
  await base.meta.withLock(() => base.meta.update({ lastChallengeAt: base.clock.now() }))
  assert.strictEqual(
    base.storage.lockName,
    'measurement',
    'metadata keeps the existing cross-tab measurement lock',
  )
  base.meta.clear()
  assert.ok(
    !base.storage.values.has(MEASUREMENT_META_KEY),
    'clear removes only the existing measurement key',
  )
  const host = TRUSTED_CATALOG[0]!,
    url = `https://${host}/test.m4s`
  const context = {
    generation: generationId(1),
    epoch: epochId(1),
    representation: representationId('one'),
    kind: 'video' as const,
    authorityRevision: 1,
  }
  let commits = 0
  base.storage.blocked = true
  const controller = base.scope.own(
    new MeasurementController(
      measurementRoutes({
        startupOptions: () => ({
          candidates: [
            {
              host,
              url,
              type: 'catalog-generated',
              original: false,
              cachedSafeMbps: null,
              context,
            },
          ],
          demand: { kind: 'video', requiredMbps: 2, highDemand: false },
          originalHost: host,
        }),
        commitStartupChoice: () => {
          commits++
          return { host }
        },
      }),
      base.meta,
      {
        read: async () => ({
          bytes: 64 * 1024,
          elapsedMs: 100,
          ttfbMs: 10,
          status: 206,
          directRange: true,
          reason: 'measured',
        }),
      },
      base.clock.now,
      base.clock,
    ),
  )
  const pending = controller.prepareStartup(url)
  controller.reset()
  base.storage.release()
  await pending
  await Promise.resolve()
  assert.strictEqual(commits, 0, 'old startup completion cannot commit after generation reset')
  assert.strictEqual(
    base.meta.get().catalogCursor,
    0,
    'old startup lock waiter cannot write metadata after generation reset',
  )
}

test('measurement metadata defaults to first Catalog cursor [1]', { timeout: 5000 }, async (t) => {
  await checkMeasurementMetadataDefaultsToFirstCatalogCursor1(t)
})
