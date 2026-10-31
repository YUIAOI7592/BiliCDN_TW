import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { fixture, media } from './runtime-fixture.ts'
import { FakeStorage } from './storage.ts'
import type { TestContext } from 'node:test'
import type { DomainEvent, RequestContext } from '../../src-v2/domain/model.ts'
import {
  createSupply,
  advanceSupply,
} from '../../scripts/evaluation/buffer-shadow/supply-model.mts'
import type { RiskScenario } from '../../scripts/evaluation/buffer-shadow/risk-inputs.mts'
import { startBrowserObservation } from '../../scripts/evaluation/buffer-shadow/live-browser.mts'
import type { LiveSample, LiveEvent } from '../../scripts/evaluation/buffer-shadow/live-model.mts'

class ObservedStorage extends FakeStorage {
  readonly writes: unknown[] = []
  override set<T>(key: string, value: T) {
    this.writes.push({ key, value: structuredClone(value) })
    super.set(key, value)
  }
}

export async function runRiskScenario(
  input: RiskScenario,
  observed: boolean,
  t: TestContext,
  changeContentAt: number | null = null,
) {
  const storage = new ObservedStorage(),
    f = fixture(t, storage),
    base = f.clock.now()
  const source = media(552),
    url = source.data.dash.video[0]!.base_url
  f.playurl.transform(source)
  f.request(url)
  const trace: DomainEvent[] = []
  const stopTrace = f.routes.subscribe((e) => trace.push(e))
  let model = createSupply(input.initialWallSec, input.rate),
    firstDepletion: number | null = null
  let currentRequest: RequestContext | null = f.routes.latestRequested('video')
  let exitListeners = 0,
    maxSamples = 0,
    maxTrendRecords = 0,
    maxTrendBytes = 0,
    projectionMatches = true
  const observation = observed
    ? startBrowserObservation(
        {
          monitor: f.deps.monitor,
          routes: f.routes,
          session: f.session,
          player: {
            controls: () => ({
              mediaId: 1,
              coreId: 1,
              userRevision: 0,
              seekRevision: 0,
              reloadRevision: 0,
              coreReloadRevision: 0,
            }),
          },
          settings: f.settings,
          recovery: f.recovery,
          visibility: { isActuallyVisible: () => true },
        },
        {
          now: f.clock.now,
          wall: f.clock.now,
          timeout: f.clock.timeout.bind(f.clock),
          onExit() {
            exitListeners++
            return () => {
              exitListeners--
            }
          },
        },
        input.rate,
        60000,
      )
    : null
  f.scope.defer(() => observation?.stop())
  const rows: LiveSample[] = [],
    events: LiveEvent[] = [],
    balances: {
      at: number
      bufferMs: number
      positionMs: number
      stalledMs: number
      acceptedBytes: number
    }[] = []
  let cursor = 0
  try {
    for (let second = 1; second <= 180; second++) {
      const until = second * 1000,
        phase = until - 60000
      const completions = input.completions.filter((c) => c.at === until)
      if (phase === 1000 && input.resetAtStart) f.deps.monitor.reset()
      if (phase === changeContentAt) {
        f.navigate()
        f.playurl.transform(media(553))
      }
      if (completions.length && (phase <= 0 || input.requests)) {
        f.request(url)
        currentRequest = f.routes.latestRequested('video')
      }
      const previous = model
      model = advanceSupply(model, until, input.rate, completions)
      if (phase > 0 && firstDepletion === null && model.stalledMs > previous.stalledMs)
        firstDepletion = phase - 1000 + previous.bufferMs / input.rate
      f.setVideo({
        ...f.video(),
        available: true,
        readyState: 4,
        coreInitialized: true,
        paused: false,
        seeking: false,
        width: 1920,
        height: 1080,
        duration: 5000,
        currentTime: model.positionMs / 1000,
        frames: Math.floor((model.positionMs * 30) / 1000),
        playbackRate: input.rate,
        effectiveRate: input.rate,
        bufferAheadSec: model.bufferMs / 1000,
        playableBufferSec: model.bufferMs / (input.rate * 1000),
      })
      f.clock.advance(1000)
      const trend = f.deps.monitor.snapshot().bufferTrend!,
        diagnostic = f.diagnostics.snapshot().bufferTrend
      projectionMatches &&= isDeepStrictEqual(diagnostic.latest, trend)
      maxSamples = Math.max(maxSamples, trend.sampleCount)
      maxTrendRecords = Math.max(maxTrendRecords, diagnostic.history.length)
      maxTrendBytes = Math.max(maxTrendBytes, Buffer.byteLength(JSON.stringify(diagnostic.history)))
      for (const completion of completions)
        if (currentRequest) {
          const r = currentRequest
          await f.routes.observe({
            request: r,
            generation: r.generation,
            epoch: r.epoch,
            decisionId: r.decisionId,
            representation: r.representation,
            kind: 'video',
            routeType: r.routeType,
            originalHost: r.originalHost,
            targetHost: r.targetHost,
            finalHost: r.targetHost,
            responseUrlMatchesRequest: true,
            streamKey: null,
            status: 206,
            bytes: completion.bytes,
            ttfbMs: 1,
            elapsedMs: 1000,
            completedAt: f.clock.now(),
            outcome: 'success',
          })
        }
      if (observation) {
        const batch = observation.drain(cursor)
        assert.equal(batch.hasMore, false)
        cursor = batch.cursor
        for (const entry of batch.entries)
          if (entry.kind === 'sample') rows.push(entry.value as LiveSample)
          else events.push(entry.value as LiveEvent)
      }
      if (phase >= 0)
        balances.push({
          at: phase,
          bufferMs: model.bufferMs,
          positionMs: model.positionMs,
          stalledMs: model.stalledMs,
          acceptedBytes: model.acceptedBytes,
        })
    }
    observation?.stop()
    const status = observation?.status()
    if (status) assert.deepEqual(status.resources, { timers: 0, subscriptions: 0, listeners: 0 })
    const idMap = new Map<string, string>()
    const normalize = (key: string, value: unknown): unknown => {
      if ((key === 'id' || key.endsWith('Id')) && typeof value === 'string') {
        if (!idMap.has(value)) idMap.set(value, 'id-' + (idMap.size + 1))
        return idMap.get(value)
      }
      return value
    }
    const effects = JSON.parse(
      JSON.stringify(
        {
          trace,
          calls: f.calls,
          writes: storage.writes,
          affinity: f.session.get().affinity,
          recovery: f.recovery.snapshot(),
        },
        normalize,
      ),
    ) as unknown
    const scored = rows.filter((r) => r.at >= 60000 && r.at < 180000)
    const firstCandidate = scored.find((r) => r.candidate === true)?.at
    return {
      level: 'synthetic-integration' as const,
      scenario: input.name,
      rate: input.rate,
      sourceAlgorithm: 'buffer-window-v6',
      scenarioHash: createHash('sha256').update(JSON.stringify(input)).digest('hex'),
      rows,
      events,
      balances,
      firstDepletionMs: firstDepletion,
      firstLeadMs:
        firstDepletion === null || firstCandidate === undefined
          ? null
          : firstDepletion - (firstCandidate - 60000),
      projectionMatches,
      bounds: { maxSamples, maxTrendRecords, maxTrendBytes },
      effects,
      effectsHash: createHash('sha256').update(JSON.stringify(effects)).digest('hex'),
      cleanup: {
        observer: status?.resources ?? null,
        exitListeners,
        timers: 0,
        storageListeners: 0,
      },
      elapsedMs: f.clock.now() - base,
    }
  } finally {
    observation?.stop()
    stopTrace()
    f.lifecycle.dispose()
    f.runtime.dispose()
    f.deps.monitor.dispose()
    f.recovery.dispose()
    f.settings.dispose()
    f.deps.restrictions.dispose()
    f.deps.evidence.dispose()
    assert.equal(exitListeners, 0)
    assert.equal(
      [...storage.listeners.values()].reduce((n, s) => n + s.size, 0),
      0,
    )
    assert.equal(f.clock.pendingCount, 0, 'owned resources must be zero before FakeClock disposal')
    await f.scope.dispose()
  }
}
