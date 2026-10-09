import type { TestContext } from 'node:test'
import { MeasurementController } from '../../src-v2/application/measurement-controller.ts'
import type { RangeProbePort } from '../../src-v2/application/ports.ts'
import { generationId, epochId, representationId } from '../../src-v2/domain/model.ts'
import { MeasurementMetaStore } from '../../src-v2/state/measurement-meta-store.ts'
import { FakeStorage } from './storage.ts'
import { FakeClock } from './clock.ts'
import { measurementRoutes } from './controllers.ts'
import { deferred } from './deferred.ts'
import { testScope } from './scope.ts'

const host = 'upos-sz-mirroralib.bilivideo.com'
export const startupAbortUrl = `https://${host}/upgcxcode/synthetic/startup/100-1-30080.m4s?fixture=1`
export function startupAbortFixture(t: TestContext, onOptions: () => void = () => undefined) {
  const scope = testScope(t), clock = scope.own(new FakeClock()), storage = new FakeStorage()
  const meta = new MeasurementMetaStore(storage, clock.now)
  const result = deferred<Awaited<ReturnType<RangeProbePort['read']>>>()
  const probeSignals: AbortSignal[] = []
  let commits = 0
  const measurement = scope.own(new MeasurementController(measurementRoutes({
    startupOptions: () => {
      onOptions()
      return { candidates: [{ url: startupAbortUrl, host, type: 'catalog-generated', original: false, cachedSafeMbps: null,
        context: { generation: generationId(1), epoch: epochId(1), representation: representationId('synthetic'), kind: 'video', authorityRevision: 1 } }],
        demand: { kind: 'video', requiredMbps: 2, highDemand: false }, originalHost: host }
    },
    isCatalogOnly: () => true,
    commitStartupChoice: () => { commits++; return { host } },
  }), meta, { read: async ({ signal }) => {
    probeSignals.push(signal)
    const onAbort = () => result.resolve({ bytes: 0, elapsedMs: 1, ttfbMs: null, status: null, directRange: false, reason: 'aborted' })
    signal.addEventListener('abort', onAbort, { once: true })
    try { return await result.promise } finally { signal.removeEventListener('abort', onAbort) }
  } } satisfies RangeProbePort, clock.now, clock))
  return { measurement, clock, probeSignals, commits: () => commits,
    complete: () => result.resolve({ bytes: 64 * 1024, elapsedMs: 10, ttfbMs: 1, status: 206, directRange: true, reason: 'measured' }) }
}
