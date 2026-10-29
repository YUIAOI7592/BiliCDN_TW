import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate as nextTurn } from 'node:timers/promises'
import { MeasurementController } from '../../../src-v2/application/measurement-controller.ts'
import type { RangeProbeResult } from '../../../src-v2/application/ports.ts'
import { MeasurementMetaStore } from '../../../src-v2/state/measurement-meta-store.ts'
import { measurementRoutes } from '../../support/controllers.ts'
import { testScope } from '../../support/scope.ts'
import { fixture, dash, media } from './routing-fixture.ts'
import { deferred } from '../../support/deferred.ts'

function startup(t: TestContext, catalogOnly = true, cached = false) {
  const scope = testScope(t),
    f = fixture(scope),
    url = media('up141', 'video.m4s')
  f.adapter.transform(dash(url))
  const identity = f.vault.contextForUrl(url)!
  const candidates = ['upos-sz-mirrorali.bilivideo.com', 'upos-sz-mirrorcos.bilivideo.com'].map(
    (host) => ({
      host,
      type: 'catalog-generated' as const,
      url,
      original: false,
      cachedSafeMbps: cached ? 20 : null,
      context: identity,
    }),
  )
  const pending: ReturnType<typeof deferred<RangeProbeResult>>[] = [],
    signals: AbortSignal[] = []
  const recorded: string[] = [],
    decisions: string[] = []
  const controller = scope.own(
    new MeasurementController(
      measurementRoutes({
        startupOptions: () => ({
          candidates,
          demand: { kind: 'video', requiredMbps: 1, highDemand: false },
          originalHost: '',
        }),
        isCatalogOnly: () => catalogOnly,
        commitStartupChoice: (_url, candidate) => {
          if (!candidate) return null
          decisions.push(candidate.host)
          return { host: candidate.host }
        },
        recordStartupSuccess: async (candidate) => {
          recorded.push(candidate.host)
        },
      }),
      new MeasurementMetaStore(f.storage, f.clock.now),
      {
        read: async ({ signal }) => {
          const result = deferred<RangeProbeResult>()
          pending.push(result)
          signals.push(signal)
          return await result.promise
        },
      },
      f.clock.now,
      f.clock,
      undefined,
      () => 0,
      f.settings,
    ),
  )
  const measured = (bytes = 256 * 1024, elapsedMs = 500): RangeProbeResult => ({
    bytes,
    elapsedMs,
    ttfbMs: 5,
    status: 206,
    directRange: true,
    reason: 'measured',
  })
  return { f, controller, url, pending, signals, recorded, decisions, measured }
}

test('UP141-START qualified Catalog releases 2500ms before hanging tail and seals late learning', async (t) => {
  const f = startup(t)
  let released = false
  const wait = f.controller.prepareStartup(f.url).then(() => {
    released = true
  })
  f.f.clock.advance(500)
  f.pending[0]!.resolve(f.measured())
  await nextTurn()
  assert.equal(released, true)
  assert.equal(f.controller.snapshot().startup?.elapsedMs, 500)
  assert.equal(f.controller.snapshot().startup?.reason, 'qualified-early')
  assert.ok(f.signals.every((signal) => signal.aborted))
  assert.equal(f.f.clock.pendingCount, 0)
  f.pending[1]!.resolve(f.measured(512 * 1024, 50))
  await wait
  await nextTurn()
  assert.equal(f.decisions.length, 1)
  assert.equal(f.recorded.length, 1)
  assert.equal(f.controller.snapshot().startup?.results?.length, 1)
  f.controller.reset()
  await f.controller.prepareStartup(f.url)
  assert.equal(f.pending.length, 2, 'reset must not replenish the per-tab budget')
})

test('UP141-START Native mode waits for comparison and preserves the common deadline', async (t) => {
  const f = startup(t, false)
  let released = false
  const wait = f.controller.prepareStartup(f.url).then(() => {
    released = true
  })
  f.f.clock.advance(500)
  f.pending[0]!.resolve(f.measured())
  await nextTurn()
  assert.equal(released, false)
  f.f.clock.advance(2500)
  await wait
  assert.equal(f.controller.snapshot().startup?.elapsedMs, 3000)
  f.pending[1]!.resolve(f.measured())
  await nextTurn()
  assert.equal(f.recorded.length, 1)
})

test('UP141-TEST startup toggle off waits full comparison without adding probes', async (t) => {
  const f = startup(t)
  await f.f.settings.update({ startupEarlyReleaseEnabled: false })
  let released = false
  const wait = f.controller.prepareStartup(f.url).then(() => {
    released = true
  })
  f.f.clock.advance(500)
  f.pending[0]!.resolve(f.measured())
  await nextTurn()
  assert.equal(released, false)
  f.f.clock.advance(2500)
  await wait
  assert.equal(f.controller.snapshot().startup?.elapsedMs, 3000)
  assert.equal(f.pending.length, 2)
  f.pending[1]!.resolve(f.measured())
})

test('UP141-TEST startup policy change releases owned gate but never renews startup budget', async (t) => {
  const f = startup(t)
  const wait = f.controller.prepareStartup(f.url)
  await f.f.settings.update({ startupEarlyReleaseEnabled: false })
  await wait
  for (const p of f.pending) p.resolve(f.measured())
  await nextTurn()
  assert.equal(f.recorded.length, 0)
  await f.f.settings.update({ startupEarlyReleaseEnabled: true })
  await f.controller.prepareStartup(f.url)
  assert.equal(f.pending.length, 2)
})

test('UP141-START cached candidate must complete all 16KiB before early release', async (t) => {
  const f = startup(t, true, true)
  let released = false
  const wait = f.controller.prepareStartup(f.url).then(() => {
    released = true
  })
  f.f.clock.advance(500)
  f.pending[0]!.resolve(f.measured(1024))
  await nextTurn()
  assert.equal(released, false)
  f.f.clock.advance(100)
  f.pending[1]!.resolve(f.measured(16 * 1024))
  await wait
  assert.equal(f.controller.snapshot().startup?.results?.[0]?.valid, false)
  assert.equal(f.controller.snapshot().startup?.selectedHost, 'upos-sz-mirrorcos.bilivideo.com')
})

test('UP141-START reset promptly releases a gate even when a probe ignores cancellation', async (t) => {
  const f = startup(t)
  let released = false
  const wait = f.controller.prepareStartup(f.url).then(() => {
    released = true
  })
  f.controller.reset()
  await nextTurn()
  assert.equal(released, true)
  assert.equal(f.f.clock.pendingCount, 0)
  for (const result of f.pending) result.resolve(f.measured())
  await wait
  assert.equal(f.decisions.length, 0)
  assert.equal(f.recorded.length, 0)
})
