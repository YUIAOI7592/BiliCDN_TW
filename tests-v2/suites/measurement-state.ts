import { MeasurementMetaStore, MEASUREMENT_META_KEY } from '../../src-v2/state/measurement-meta-store.ts'
import { MeasurementController } from '../../src-v2/application/measurement-controller.ts'
import { generationId, epochId, representationId } from '../../src-v2/domain/model.ts'
import { TRUSTED_CATALOG } from '../../src-v2/domain/catalog.ts'
import { FakeStorage } from '../support/storage.ts'
import { FakeClock } from '../support/clock.ts'
import { measurementRoutes } from '../support/controllers.ts'
import { check, equal, assertionCount } from '../support/assert.ts'
import { testScope } from '../support/scope.ts'

const scope = testScope()
try {
  class MeasurementStorage extends FakeStorage {
    lockName = ''
    blocked = false
    release: () => void = () => undefined
    override async withLock<T>(name: string, task: () => Promise<T> | T): Promise<T> {
      this.lockName = name
      if (this.blocked) await new Promise<void>(resolve => { this.release = resolve })
      return await task()
    }
  }
  const storage = new MeasurementStorage(), clock = scope.own(new FakeClock())
  const meta = new MeasurementMetaStore(storage, clock.now)
  equal(meta.get().catalogCursor, 0, 'measurement metadata defaults to first Catalog cursor')
  equal(meta.get().lastChallengeAt, 0, 'measurement metadata defaults to no cooldown')
  storage.set(MEASUREMENT_META_KEY, { schema: 2, catalogCursor: 4, lastChallengeAt: 123, futureField: 'preserve' })
  meta.update({ catalogCursor: 5 })
  equal(meta.get().lastChallengeAt, 123, 'cursor update preserves existing cross-tab cooldown')
  equal(storage.get(MEASUREMENT_META_KEY, { futureField: '' }).futureField, 'preserve', 'metadata updates retain unowned compatible fields')
  await meta.withLock(() => meta.update({ lastChallengeAt: clock.now() }))
  equal(storage.lockName, 'measurement', 'metadata keeps the existing cross-tab measurement lock')
  meta.clear()
  check(!storage.values.has(MEASUREMENT_META_KEY), 'clear removes only the existing measurement key')
  const host = TRUSTED_CATALOG[0]!, url = `https://${host}/test.m4s`
  const context = { generation: generationId(1), epoch: epochId(1), representation: representationId('one'), kind: 'video' as const, authorityRevision: 1 }
  let commits = 0
  storage.blocked = true
  const controller = scope.own(new MeasurementController(measurementRoutes({
    startupOptions: () => ({ candidates: [{ host, url, type: 'catalog-generated', original: false, cachedSafeMbps: null, context }],
      demand: { kind: 'video', requiredMbps: 2, highDemand: false }, originalHost: host }),
    commitStartupChoice: () => { commits++; return { host } },
  }), meta, { read: async () => ({ bytes: 64 * 1024, elapsedMs: 100, ttfbMs: 10, status: 206, directRange: true, reason: 'measured' }) }, clock.now, clock))
  const pending = controller.prepareStartup(url)
  controller.reset(); storage.release()
  await pending; await Promise.resolve()
  equal(commits, 0, 'old startup completion cannot commit after generation reset')
  equal(meta.get().catalogCursor, 0, 'old startup lock waiter cannot write metadata after generation reset')
  console.log(`measurement-state: ${assertionCount()} assertions`)
} finally { scope.dispose() }
