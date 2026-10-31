import { extendFixture } from '../support/fixture-context.ts'
import { test } from 'node:test'
import '../regressions/buffer-diagnostics.ts'
import '../regressions/buffer-low-diagnostics.ts'
import '../regressions/buffer-continuity-diagnostics.ts'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { assessDemandRatio } from '../../src-v2/domain/routing.ts'
import {
  decisionId,
  epochId,
  generationId,
  recoveryActionId,
  representationId,
  requestId,
} from '../../src-v2/domain/model.ts'
import { TRUSTED_CATALOG } from '../../src-v2/domain/catalog.ts'
import { SessionStore } from '../../src-v2/state/session-store.ts'
import { DiagnosticRecorder } from '../../src-v2/diagnostics/recorder.ts'
import type { DomainEvent, RouteDecision, TransportObservation } from '../../src-v2/domain/model.ts'
import { testScope } from '../support/scope.ts'

// Named scenarios create only their prerequisite state; resources belong to this test.
async function createDiagnosticsScenario(_t: TestContext) {
  const now = 2_000_000_000_000
  const session = new SessionStore()
  const routeReadModel = { planCount: 41, recentPlans: [] }
  const recorder = new DiagnosticRecorder(() => now)
  const healthyObservation: TransportObservation = {
    generation: generationId(1),
    epoch: epochId(1),
    decisionId: decisionId('aggregate'),
    representation: null,
    kind: 'video',
    routeType: 'catalog-generated',
    originalHost: 'a.example',
    targetHost: 'b.example',
    finalHost: 'b.example',
    status: 206,
    bytes: 100_000,
    ttfbMs: 20,
    elapsedMs: 100,
    completedAt: now,
    outcome: 'success',
    streamKey: 'aggregate',
  }
  for (let index = 0; index < 1000; index++)
    recorder.record({
      type: 'transport',
      at: now,
      observation: { ...healthyObservation, completedAt: now + index },
    })
  const recorderSnapshot = recorder.snapshot()
  return extendFixture({}, {
    now,
    session,
    routeReadModel,
    recorder,
    healthyObservation,
    recorderSnapshot,
  } as const)
}

async function createOldBufferedPlaybackDoesNotVerifyAFallback2Context1(t: TestContext) {
  const base = await createDiagnosticsScenario(t)
  void (base.recorderSnapshot.flow.length <= 96)
  const failureEvent: DomainEvent = {
    type: 'transport',
    at: base.now + 2000,
    observation: {
      ...base.healthyObservation,
      completedAt: base.now + 2000,
      outcome: 'failure',
      failureKind: 'network',
      status: 0,
    },
  }
  base.recorder.record(failureEvent)
  void base.recorder.snapshot().incident
  const report = JSON.parse(
    base.recorder.buildReport({
      version: '2.0.0',
      session: base.session.get(),
      routes: base.routeReadModel,
      monitor: { watchdog: 'healthy', video: { currentTime: 90, bufferAheadSec: 70 } },
    }),
  ) as {
    current: {
      routes?: { planCount: number }
      monitor?: { watchdog: string }
      truncated?: boolean
    }
    recorder: { truncated?: boolean }
  }
  void (report.current.truncated !== true)
  const oversizedReport = JSON.parse(
    base.recorder.buildReport({
      version: '2.0.0',
      session: base.session.get(),
      routes: {
        ...base.routeReadModel,
        plans: Array.from({ length: 128 }, () => 'p'.repeat(1000)),
        ranking: Array.from({ length: 128 }, () => 'r'.repeat(1000)),
      },
      monitor: { watchdog: 'healthy', video: { currentTime: 90, bufferAheadSec: 70 } },
    }),
  ) as {
    current: {
      routes?: { planCount: number }
      monitor?: { watchdog: string }
      truncated?: boolean
    }
    recorder: { incident?: { reason: string } | null; truncated?: boolean }
  }
  void oversizedReport.recorder.incident?.reason.startsWith('transport:')
  const trace = new DiagnosticRecorder(() => traceNow)
  let traceNow = base.now
  const traceRep = representationId('trace-rep'),
    traceHostA = TRUSTED_CATALOG[0],
    traceHostB = TRUSTED_CATALOG[1]
  const traceIdentity = {
    generation: generationId(2),
    epoch: epochId(3),
    representation: traceRep,
    kind: 'video' as const,
    authorityRevision: 4,
  }
  const traceDecision = (id: string, host: string): RouteDecision => ({
    action: 'rewrite',
    id: decisionId(id),
    reason: 'proven',
    routeType: 'catalog-generated',
    host,
    candidate: { type: 'catalog-generated', host, kind: 'video', catalogIndex: 0 },
    ranking: [],
  })
  const traceSample = (time: number, buffer: number, frames: number, paused = false) => ({
    at: traceNow,
    generation: traceIdentity.generation,
    epoch: traceIdentity.epoch,
    enabled: true,
    originalComparison: false,
    currentTimeSec: time,
    frames,
    playableBufferSec: buffer,
    paused,
    seeking: false,
    ended: false,
    readyState: 4,
    coreInitialized: true,
    watchdog: 'healthy' as const,
  })
  const attemptRows = () => trace.snapshot().routeRecovery.attempts
  trace.recordPlayer(traceSample(100, 4, 100))
  trace.record({
    type: 'recovery',
    at: traceNow,
    action: {
      action: 'route-fallback',
      id: recoveryActionId('first'),
      kind: 'video',
      identity: traceIdentity,
      decision: traceDecision('first-decision', traceHostA),
    },
  })
  trace.recordPlayer(traceSample(100, 4, 100))
  traceNow += 1000
  trace.recordPlayer(traceSample(101, 3, 125))
  return extendFixture(base, {
    failureEvent,
    report,
    oversizedReport,
    trace,
    get traceNow() {
      return traceNow
    },
    set traceNow(next: typeof traceNow) {
      traceNow = next
    },
    traceRep,
    traceHostA,
    traceHostB,
    traceIdentity,
    traceDecision,
    traceSample,
    attemptRows,
  } as const)
}

async function createNewFallbackSupersedesUnconfirmedOldAttempt3Context2(t: TestContext) {
  const base = await createOldBufferedPlaybackDoesNotVerifyAFallback2Context1(t)
  void base.attemptRows().at(-1)?.stage
  const traceRequest = (id: string, decision: string, host: string) => ({
    requestId: requestId(id),
    generation: base.traceIdentity.generation,
    epoch: base.traceIdentity.epoch,
    decisionId: decisionId(decision),
    representation: base.traceRep,
    authorityRevision: 4,
    routePolicyRevision: 0,
    kind: 'video' as const,
    attributionStatus: 'matched' as const,
    attributionSource: 'exact' as const,
    decisionStage: 'request' as const,
    routeType: 'catalog-generated' as const,
    originalHost: base.traceHostA,
    targetHost: host,
    sourceHost: base.traceHostA,
    playurlHostChanged: false,
    playurlOutput: null,
    urlChanged: false,
    hostChanged: true,
    startedAt: base.traceNow,
  })
  for (let index = 0; index < 11; index++) {
    const request = traceRequest(`abort-${index}`, 'first-decision', base.traceHostA)
    base.trace.record({ type: 'request-started', at: base.traceNow, request })
    base.trace.record({
      type: 'transport-completed',
      at: base.traceNow,
      detached: false,
      observation: {
        ...base.healthyObservation,
        request,
        generation: base.traceIdentity.generation,
        epoch: base.traceIdentity.epoch,
        representation: base.traceRep,
        decisionId: request.decisionId,
        targetHost: base.traceHostA,
        finalHost: null,
        status: 0,
        bytes: 0,
        outcome: 'abort',
        completedAt: base.traceNow,
      },
    })
  }
  void base.attemptRows().at(-1)?.zeroByteAborts
  void base.attemptRows().at(-1)?.noResponseAborts
  void base.attemptRows().at(-1)?.stage
  const timeoutRequest = traceRequest('timeout-after-aborts', 'first-decision', base.traceHostA)
  base.trace.record({ type: 'request-started', at: base.traceNow, request: timeoutRequest })
  base.trace.record({
    type: 'transport-completed',
    at: base.traceNow,
    detached: false,
    observation: {
      ...base.healthyObservation,
      request: timeoutRequest,
      generation: base.traceIdentity.generation,
      epoch: base.traceIdentity.epoch,
      representation: base.traceRep,
      decisionId: timeoutRequest.decisionId,
      targetHost: base.traceHostA,
      finalHost: null,
      status: 0,
      bytes: 0,
      outcome: 'failure',
      failureKind: 'timeout',
      completedAt: base.traceNow,
    },
  })
  void (base.attemptRows().at(-1) as
    { aborts: number; failures: number; lastFailureKind: string } | undefined)
  const timedOutFlow = base.trace.snapshot().flow
  void timedOutFlow.reduce((sum, row) => sum + row.aborts, 0)
  void timedOutFlow.reduce((sum, row) => sum + row.failures, 0)
  void timedOutFlow.reduce((sum, row) => sum + row.timeouts, 0)
  base.trace.record({
    type: 'recovery',
    at: base.traceNow,
    action: {
      action: 'route-fallback',
      id: recoveryActionId('second'),
      kind: 'video',
      identity: base.traceIdentity,
      decision: base.traceDecision('second-decision', base.traceHostB),
    },
  })
  base.trace.recordPlayer(base.traceSample(101, 0.5, 125))
  return extendFixture(base, { traceRequest, timeoutRequest, timedOutFlow } as const)
}

async function createParameterCannotConfirmFallbackTransfer4ParameterParameterContext3(
  t: TestContext,
) {
  const base = await createNewFallbackSupersedesUnconfirmedOldAttempt3Context2(t)
  void base.attemptRows()[0]?.stage
  const secondRequest = base.traceRequest('second-request', 'second-decision', base.traceHostB)
  base.trace.record({ type: 'request-started', at: base.traceNow, request: secondRequest })
  const secondSuccess = {
    ...base.healthyObservation,
    request: secondRequest,
    generation: base.traceIdentity.generation,
    epoch: base.traceIdentity.epoch,
    representation: base.traceRep,
    decisionId: secondRequest.decisionId,
    targetHost: base.traceHostB,
    finalHost: base.traceHostB,
    responseUrlMatchesRequest: true,
    completedAt: base.traceNow,
  }
  base.trace.record({
    type: 'route-confirmed',
    at: base.traceNow,
    observation: { ...secondSuccess, bytes: 10_000 },
  })
  void base.attemptRows().at(-1)?.stage
  base.traceNow += 1000
  base.trace.recordPlayer(base.traceSample(101.7, 1, 132))
  void base.attemptRows().at(-1)?.stage
  base.traceNow += 1000
  base.trace.recordPlayer(base.traceSample(102.2, 1, 156))
  void base.attemptRows().at(-1)?.stage
  const invalidTransfers = [
    { name: 'wrong host', request: { targetHost: base.traceHostA } },
    { name: 'wrong decision', request: { decisionId: decisionId('unrelated') } },
    { name: 'stale epoch', request: { epoch: epochId(2) } },
    { name: 'stale authority', request: { authorityRevision: 3 } },
    { name: 'audio transfer', request: { kind: 'audio' as const } },
    { name: 'HTTP 200', observation: { status: 200 } },
    { name: 'empty 206', observation: { bytes: 0 } },
    { name: 'redirected response', observation: { finalHost: base.traceHostA } },
    { name: 'same-host redirect', observation: { responseUrlMatchesRequest: false } },
  ]
  return extendFixture(base, { secondRequest, secondSuccess, invalidTransfers } as const)
}

async function createPausedPlayerCannotConfirmFallbackPlayback5Context4(t: TestContext) {
  const base = await createParameterCannotConfirmFallbackTransfer4ParameterParameterContext3(t)
  for (const invalid of base.invalidTransfers) {
    const fixture = new DiagnosticRecorder(() => base.traceNow)
    fixture.record({
      type: 'recovery',
      at: base.traceNow,
      action: {
        action: 'route-fallback',
        id: recoveryActionId('invalid'),
        kind: 'video',
        identity: base.traceIdentity,
        decision: base.traceDecision('second-decision', base.traceHostB),
      },
    })
    fixture.recordPlayer(base.traceSample(10, 0, 1))
    const request = {
      ...base.traceRequest('invalid-request', 'second-decision', base.traceHostB),
      ...invalid.request,
    }
    fixture.record({ type: 'request-started', at: base.traceNow, request })
    fixture.record({
      type: 'route-confirmed',
      at: base.traceNow,
      observation: {
        ...base.secondSuccess,
        request,
        decisionId: request.decisionId,
        epoch: request.epoch,
        kind: request.kind,
        targetHost: request.targetHost,
        finalHost: request.targetHost,
        ...invalid.observation,
      },
    })
    const stage = fixture.snapshot().routeRecovery.attempts.at(-1)?.stage
    void (stage !== 'response-observed' && stage !== 'playback-observed')
  }
  const pausedTrace = new DiagnosticRecorder(() => base.traceNow)
  pausedTrace.record({
    type: 'recovery',
    at: base.traceNow,
    action: {
      action: 'route-fallback',
      id: recoveryActionId('paused'),
      kind: 'video',
      identity: base.traceIdentity,
      decision: base.traceDecision('second-decision', base.traceHostB),
    },
  })
  pausedTrace.recordPlayer(base.traceSample(50, 0.5, 10))
  const pausedRequest = base.traceRequest('paused-request', 'second-decision', base.traceHostB)
  pausedTrace.record({ type: 'request-started', at: base.traceNow, request: pausedRequest })
  pausedTrace.record({
    type: 'route-confirmed',
    at: base.traceNow,
    observation: { ...base.secondSuccess, request: pausedRequest },
  })
  base.traceNow += 1000
  pausedTrace.recordPlayer(base.traceSample(51, 0, 12, true))
  base.traceNow += 1000
  pausedTrace.recordPlayer(base.traceSample(52, 0, 13, true))
  return extendFixture(base, { pausedTrace, pausedRequest } as const)
}

async function checkPausedPlayerCannotConfirmFallbackPlayback5(t: TestContext): Promise<void> {
  const base = await createPausedPlayerCannotConfirmFallbackPlayback5Context4(t)

  assert.strictEqual(
    base.pausedTrace.snapshot().routeRecovery.attempts.at(-1)?.stage,
    'response-observed',
    'paused player cannot confirm fallback playback',
  )
  base.pausedTrace.recordPlayer({ ...base.traceSample(52, 0, 13), seeking: true })
  assert.strictEqual(
    base.pausedTrace.snapshot().routeRecovery.attempts.at(-1)?.stage,
    'interrupted',
    'seek invalidates the old buffer boundary',
  )
  const mixedTrace = new DiagnosticRecorder(() => base.traceNow)
  mixedTrace.record({
    type: 'recovery',
    at: base.traceNow,
    action: {
      action: 'route-fallback',
      id: recoveryActionId('mixed'),
      kind: 'video',
      identity: base.traceIdentity,
      decision: base.traceDecision('second-decision', base.traceHostB),
    },
  })
  mixedTrace.recordPlayer(base.traceSample(60, 0.2, 20))
  mixedTrace.record({
    type: 'route-confirmed',
    at: base.traceNow,
    observation: {
      ...base.secondSuccess,
      request: base.traceRequest('competing', 'other-decision', base.traceHostA),
      decisionId: decisionId('other-decision'),
      targetHost: base.traceHostA,
      finalHost: base.traceHostA,
    },
  })
  assert.strictEqual(
    mixedTrace.snapshot().routeRecovery.attempts.at(-1)?.stage,
    'mixed-evidence',
    'another successful video host makes playback attribution ambiguous',
  )
  const disabledTrace = new DiagnosticRecorder(() => base.traceNow)
  disabledTrace.record({
    type: 'recovery',
    at: base.traceNow,
    action: {
      action: 'route-fallback',
      id: recoveryActionId('disabled'),
      kind: 'video',
      identity: base.traceIdentity,
      decision: base.traceDecision('second-decision', base.traceHostB),
    },
  })
  disabledTrace.record(
    { type: 'route-confirmed', at: base.traceNow, observation: base.secondSuccess },
    false,
  )
  assert.strictEqual(
    disabledTrace.snapshot().routeRecovery.attempts.at(-1)?.stage,
    'interrupted',
    'comparison or disabled mode stops route attribution immediately',
  )
  const staleTrace = new DiagnosticRecorder(() => base.traceNow)
  staleTrace.record({
    type: 'recovery',
    at: base.traceNow,
    action: {
      action: 'route-fallback',
      id: recoveryActionId('stale'),
      kind: 'video',
      identity: base.traceIdentity,
      decision: base.traceDecision('second-decision', base.traceHostB),
    },
  })
  staleTrace.record({
    type: 'lifecycle',
    at: base.traceNow,
    generation: generationId(3),
    epoch: epochId(4),
    reason: 'spa',
  })
  assert.strictEqual(
    staleTrace.snapshot().routeRecovery.attempts.at(-1)?.stage,
    'interrupted',
    'new generation closes stale fallback attribution',
  )
  base.trace.record({
    type: 'core',
    at: base.traceNow,
    state: 'recovered',
    actionId: recoveryActionId('core'),
    source: 'route-failure',
  })
  const traceReport = base.trace.buildReport({
    url: 'https://example.invalid/video?token=secret',
  })
  assert.ok(
    new TextEncoder().encode(traceReport).length <= 96 * 1024,
    'fallback trace preserves report limit',
  )
  assert.ok(
    !traceReport.includes('token=secret'),
    'fallback trace report excludes sensitive test query',
  )
  assert.ok(
    traceReport.includes('player-core-progress-only'),
    'core progress is explicitly scoped below route confirmation',
  )
}

async function checkOversizedCurrentEvidenceStillHonorsTheAbsoluteReportLimit6(
  t: TestContext,
): Promise<void> {
  const base = await createPausedPlayerCannotConfirmFallbackPlayback5Context4(t)

  void base.pausedTrace.snapshot().routeRecovery.attempts.at(-1)?.stage
  base.pausedTrace.recordPlayer({ ...base.traceSample(52, 0, 13), seeking: true })
  void base.pausedTrace.snapshot().routeRecovery.attempts.at(-1)?.stage
  const mixedTrace = new DiagnosticRecorder(() => base.traceNow)
  mixedTrace.record({
    type: 'recovery',
    at: base.traceNow,
    action: {
      action: 'route-fallback',
      id: recoveryActionId('mixed'),
      kind: 'video',
      identity: base.traceIdentity,
      decision: base.traceDecision('second-decision', base.traceHostB),
    },
  })
  mixedTrace.recordPlayer(base.traceSample(60, 0.2, 20))
  mixedTrace.record({
    type: 'route-confirmed',
    at: base.traceNow,
    observation: {
      ...base.secondSuccess,
      request: base.traceRequest('competing', 'other-decision', base.traceHostA),
      decisionId: decisionId('other-decision'),
      targetHost: base.traceHostA,
      finalHost: base.traceHostA,
    },
  })
  void mixedTrace.snapshot().routeRecovery.attempts.at(-1)?.stage
  const disabledTrace = new DiagnosticRecorder(() => base.traceNow)
  disabledTrace.record({
    type: 'recovery',
    at: base.traceNow,
    action: {
      action: 'route-fallback',
      id: recoveryActionId('disabled'),
      kind: 'video',
      identity: base.traceIdentity,
      decision: base.traceDecision('second-decision', base.traceHostB),
    },
  })
  disabledTrace.record(
    { type: 'route-confirmed', at: base.traceNow, observation: base.secondSuccess },
    false,
  )
  void disabledTrace.snapshot().routeRecovery.attempts.at(-1)?.stage
  const staleTrace = new DiagnosticRecorder(() => base.traceNow)
  staleTrace.record({
    type: 'recovery',
    at: base.traceNow,
    action: {
      action: 'route-fallback',
      id: recoveryActionId('stale'),
      kind: 'video',
      identity: base.traceIdentity,
      decision: base.traceDecision('second-decision', base.traceHostB),
    },
  })
  staleTrace.record({
    type: 'lifecycle',
    at: base.traceNow,
    generation: generationId(3),
    epoch: epochId(4),
    reason: 'spa',
  })
  void staleTrace.snapshot().routeRecovery.attempts.at(-1)?.stage
  base.trace.record({
    type: 'core',
    at: base.traceNow,
    state: 'recovered',
    actionId: recoveryActionId('core'),
    source: 'route-failure',
  })
  const traceReport = base.trace.buildReport({
    url: 'https://example.invalid/video?token=secret',
  })
  void (new TextEncoder().encode(traceReport).length <= 96 * 1024)
  void !traceReport.includes('token=secret')
  void traceReport.includes('player-core-progress-only')
  const saturatedReport = JSON.parse(
    base.trace.buildReport({
      version: '2.1.4',
      monitor: { watchdog: 'healthy' },
      evidence: Array.from({ length: 48 }, () => Array.from({ length: 48 }, () => 'x'.repeat(160))),
    }),
  ) as {
    current: { monitor?: { watchdog?: string } }
    recorder: { routeRecovery?: { attempts?: unknown[] } }
  }

  assert.ok(
    new TextEncoder().encode(JSON.stringify(saturatedReport)).length <= 96 * 1024,
    'oversized current evidence still honors the absolute report limit',
  )
  assert.strictEqual(
    saturatedReport.current.monitor?.watchdog,
    'healthy',
    'size fallback retains current playback watchdog',
  )
  assert.ok(
    (saturatedReport.recorder.routeRecovery?.attempts?.length ?? 0) >= 1,
    'size fallback retains latest fallback assessment',
  )
}

async function checkParameterCannotConfirmFallbackTransfer4ParameterParameter(
  t: TestContext,
  parameter = 0,
): Promise<void> {
  const base = await createParameterCannotConfirmFallbackTransfer4ParameterParameterContext3(t)

  let iteration = 0
  for (const invalid of base.invalidTransfers) {
    if (iteration++ === parameter) {
      const fixture = new DiagnosticRecorder(() => base.traceNow)
      fixture.record({
        type: 'recovery',
        at: base.traceNow,
        action: {
          action: 'route-fallback',
          id: recoveryActionId('invalid'),
          kind: 'video',
          identity: base.traceIdentity,
          decision: base.traceDecision('second-decision', base.traceHostB),
        },
      })
      fixture.recordPlayer(base.traceSample(10, 0, 1))
      const request = {
        ...base.traceRequest('invalid-request', 'second-decision', base.traceHostB),
        ...invalid.request,
      }
      fixture.record({ type: 'request-started', at: base.traceNow, request })
      fixture.record({
        type: 'route-confirmed',
        at: base.traceNow,
        observation: {
          ...base.secondSuccess,
          request,
          decisionId: request.decisionId,
          epoch: request.epoch,
          kind: request.kind,
          targetHost: request.targetHost,
          finalHost: request.targetHost,
          ...invalid.observation,
        },
      })
      const stage = fixture.snapshot().routeRecovery.attempts.at(-1)?.stage
      assert.ok(
        stage !== 'response-observed' && stage !== 'playback-observed',
        `${invalid.name} cannot confirm fallback transfer`,
      )

      return
    }
  }
  throw Error('Unknown fixture parameter')
}

async function checkNewFallbackSupersedesUnconfirmedOldAttempt3(t: TestContext): Promise<void> {
  const base = await createNewFallbackSupersedesUnconfirmedOldAttempt3Context2(t)

  assert.strictEqual(
    base.attemptRows()[0]?.stage,
    'superseded',
    'new fallback supersedes unconfirmed old attempt',
  )
  const secondRequest = base.traceRequest('second-request', 'second-decision', base.traceHostB)
  base.trace.record({ type: 'request-started', at: base.traceNow, request: secondRequest })
  const secondSuccess = {
    ...base.healthyObservation,
    request: secondRequest,
    generation: base.traceIdentity.generation,
    epoch: base.traceIdentity.epoch,
    representation: base.traceRep,
    decisionId: secondRequest.decisionId,
    targetHost: base.traceHostB,
    finalHost: base.traceHostB,
    responseUrlMatchesRequest: true,
    completedAt: base.traceNow,
  }
  base.trace.record({
    type: 'route-confirmed',
    at: base.traceNow,
    observation: { ...secondSuccess, bytes: 10_000 },
  })
  assert.strictEqual(
    base.attemptRows().at(-1)?.stage,
    'response-observed',
    'direct nonempty 206 advances to network evidence',
  )
  base.traceNow += 1000
  base.trace.recordPlayer(base.traceSample(101.7, 1, 132))
  assert.strictEqual(
    base.attemptRows().at(-1)?.stage,
    'response-observed',
    'one player tick is insufficient',
  )
  base.traceNow += 1000
  base.trace.recordPlayer(base.traceSample(102.2, 1, 156))
  assert.strictEqual(
    base.attemptRows().at(-1)?.stage,
    'playback-observed',
    'two ticks beyond original buffer record playback evidence',
  )
  assert.strictEqual(
    assessDemandRatio(0.55),
    'below-required',
    'sub-demand route is labeled without changing selection',
  )
  assert.strictEqual(assessDemandRatio(1.2), 'below-headroom', 'partial headroom is labeled')
  assert.strictEqual(assessDemandRatio(1.35), 'meets-headroom', 'sufficient headroom is labeled')
  assert.strictEqual(assessDemandRatio(null), 'unknown', 'missing throughput is labeled unknown')
}

async function checkOldBufferedPlaybackDoesNotVerifyAFallback2(t: TestContext): Promise<void> {
  const base = await createOldBufferedPlaybackDoesNotVerifyAFallback2Context1(t)

  assert.strictEqual(
    base.attemptRows().at(-1)?.stage,
    'progress-unconfirmed',
    'old buffered playback does not verify a fallback',
  )
  const traceRequest = (id: string, decision: string, host: string) => ({
    requestId: requestId(id),
    generation: base.traceIdentity.generation,
    epoch: base.traceIdentity.epoch,
    decisionId: decisionId(decision),
    representation: base.traceRep,
    authorityRevision: 4,
    routePolicyRevision: 0,
    kind: 'video' as const,
    attributionStatus: 'matched' as const,
    attributionSource: 'exact' as const,
    decisionStage: 'request' as const,
    routeType: 'catalog-generated' as const,
    originalHost: base.traceHostA,
    targetHost: host,
    sourceHost: base.traceHostA,
    playurlHostChanged: false,
    playurlOutput: null,
    urlChanged: false,
    hostChanged: true,
    startedAt: base.traceNow,
  })
  for (let index = 0; index < 11; index++) {
    const request = traceRequest(`abort-${index}`, 'first-decision', base.traceHostA)
    base.trace.record({ type: 'request-started', at: base.traceNow, request })
    base.trace.record({
      type: 'transport-completed',
      at: base.traceNow,
      detached: false,
      observation: {
        ...base.healthyObservation,
        request,
        generation: base.traceIdentity.generation,
        epoch: base.traceIdentity.epoch,
        representation: base.traceRep,
        decisionId: request.decisionId,
        targetHost: base.traceHostA,
        finalHost: null,
        status: 0,
        bytes: 0,
        outcome: 'abort',
        completedAt: base.traceNow,
      },
    })
  }
  assert.strictEqual(
    base.attemptRows().at(-1)?.zeroByteAborts,
    11,
    'abort wave is counted per fallback decision',
  )
  assert.strictEqual(
    base.attemptRows().at(-1)?.noResponseAborts,
    11,
    'pre-response abort wave is distinguished from timeout',
  )
  assert.strictEqual(
    base.attemptRows().at(-1)?.stage,
    'progress-unconfirmed',
    'aborts do not confirm or fail a route',
  )
  const timeoutRequest = traceRequest('timeout-after-aborts', 'first-decision', base.traceHostA)
  base.trace.record({ type: 'request-started', at: base.traceNow, request: timeoutRequest })
  base.trace.record({
    type: 'transport-completed',
    at: base.traceNow,
    detached: false,
    observation: {
      ...base.healthyObservation,
      request: timeoutRequest,
      generation: base.traceIdentity.generation,
      epoch: base.traceIdentity.epoch,
      representation: base.traceRep,
      decisionId: timeoutRequest.decisionId,
      targetHost: base.traceHostA,
      finalHost: null,
      status: 0,
      bytes: 0,
      outcome: 'failure',
      failureKind: 'timeout',
      completedAt: base.traceNow,
    },
  })
  const timedOutAttempt = base.attemptRows().at(-1) as
    { aborts: number; failures: number; lastFailureKind: string } | undefined
  assert.strictEqual(timedOutAttempt?.aborts, 11, 'timeout does not increase the abort count')
  assert.strictEqual(timedOutAttempt?.failures, 1, 'timeout is a separate fallback failure')
  assert.strictEqual(
    timedOutAttempt?.lastFailureKind,
    'timeout',
    'fallback preserves the timeout category',
  )
  const timedOutFlow = base.trace.snapshot().flow
  assert.strictEqual(
    timedOutFlow.reduce((sum, row) => sum + row.aborts, 0),
    11,
    'flow summary counts only abort terminal events as aborts',
  )
  assert.strictEqual(
    timedOutFlow.reduce((sum, row) => sum + row.failures, 0),
    1,
    'flow summary retains the failed request',
  )
  assert.strictEqual(
    timedOutFlow.reduce((sum, row) => sum + row.timeouts, 0),
    1,
    'flow summary distinguishes timeout from abort',
  )
}

async function check1000SuccessesRemainBoundedAggregates1(t: TestContext): Promise<void> {
  const base = await createDiagnosticsScenario(t)

  assert.ok(base.recorderSnapshot.flow.length <= 96, '1000 successes remain bounded aggregates')
  assert.strictEqual(
    base.recorderSnapshot.events.length,
    0,
    'healthy requests do not create verbose events when disabled',
  )
  const failureEvent: DomainEvent = {
    type: 'transport',
    at: base.now + 2000,
    observation: {
      ...base.healthyObservation,
      completedAt: base.now + 2000,
      outcome: 'failure',
      failureKind: 'network',
      status: 0,
    },
  }
  base.recorder.record(failureEvent)
  assert.ok(base.recorder.snapshot().incident, 'verified failure freezes an incident timeline')
  const report = JSON.parse(
    base.recorder.buildReport({
      version: '2.0.0',
      session: base.session.get(),
      routes: base.routeReadModel,
      monitor: { watchdog: 'healthy', video: { currentTime: 90, bufferAheadSec: 70 } },
    }),
  ) as {
    current: {
      routes?: { planCount: number }
      monitor?: { watchdog: string }
      truncated?: boolean
    }
    recorder: { truncated?: boolean }
  }
  assert.strictEqual(
    report.current.routes?.planCount,
    base.routeReadModel.planCount,
    'incident report retains route state with many groups',
  )
  assert.strictEqual(
    report.current.monitor?.watchdog,
    'healthy',
    'incident report retains player state with many groups',
  )
  assert.ok(
    report.current.truncated !== true,
    'capacity fallback never discards the complete current state',
  )
  const oversizedReport = JSON.parse(
    base.recorder.buildReport({
      version: '2.0.0',
      session: base.session.get(),
      routes: {
        ...base.routeReadModel,
        plans: Array.from({ length: 128 }, () => 'p'.repeat(1000)),
        ranking: Array.from({ length: 128 }, () => 'r'.repeat(1000)),
      },
      monitor: { watchdog: 'healthy', video: { currentTime: 90, bufferAheadSec: 70 } },
    }),
  ) as {
    current: {
      routes?: { planCount: number }
      monitor?: { watchdog: string }
      truncated?: boolean
    }
    recorder: { incident?: { reason: string } | null; truncated?: boolean }
  }
  assert.strictEqual(
    oversizedReport.current.routes?.planCount,
    base.routeReadModel.planCount,
    'oversized route read model retains bounded current summary',
  )
  assert.strictEqual(
    oversizedReport.current.monitor?.watchdog,
    'healthy',
    'oversized report keeps current playback state',
  )
  assert.ok(
    oversizedReport.recorder.incident?.reason.startsWith('transport:'),
    'oversized report keeps incident cause',
  )
  assert.ok(
    ((oversizedReport.recorder as { flow?: unknown[] }).flow?.length ?? 0) > 0,
    'oversized report preserves successful transport summaries',
  )
}

test('1000 successes remain bounded aggregates [1]', { timeout: 5000 }, async (t) => {
  await check1000SuccessesRemainBoundedAggregates1(t)
})
test('old buffered playback does not verify a fallback [2]', { timeout: 5000 }, async (t) => {
  await checkOldBufferedPlaybackDoesNotVerifyAFallback2(t)
})
test('new fallback supersedes unconfirmed old attempt [3]', { timeout: 5000 }, async (t) => {
  await checkNewFallbackSupersedesUnconfirmedOldAttempt3(t)
})
{
  let parameter = 0
  for (const invalid of [
    'wrong host',
    'wrong decision',
    'stale epoch',
    'stale authority',
    'audio transfer',
    'HTTP 200',
    'empty 206',
    'redirected response',
    'same-host redirect',
  ]) {
    const selected = parameter++
    test(
      '`${invalid.name} cannot confirm fallback transfer` [4]' +
        ` / ${String(invalid)} / ${selected}`,
      { timeout: 5000 },
      async (t) => {
        await checkParameterCannotConfirmFallbackTransfer4ParameterParameter(t, selected)
      },
    )
  }
}
test('paused player cannot confirm fallback playback [5]', { timeout: 5000 }, async (t) => {
  await checkPausedPlayerCannotConfirmFallbackPlayback5(t)
})
test(
  'oversized current evidence still honors the absolute report limit [6]',
  { timeout: 5000 },
  async (t) => {
    await checkOversizedCurrentEvidenceStillHonorsTheAbsoluteReportLimit6(t)
  },
)
import '../regressions/functional-races/cr-diagnostics.ts'

test('diagnostic report keeps stable host aliases and clears only incident-local state', (t) => {
  testScope(t)
  const now = 2_000_000_000_000
  const recorder = new DiagnosticRecorder(() => now)
  const observation = {
    generation: generationId(1),
    epoch: epochId(1),
    decisionId: decisionId('alias-report'),
    representation: null,
    kind: 'video',
    routeType: 'catalog-generated',
    originalHost: TRUSTED_CATALOG[0],
    targetHost: 'private.invalid',
    finalHost: 'private.invalid',
    status: 206,
    bytes: 128,
    ttfbMs: 20,
    elapsedMs: 100,
    completedAt: now,
    outcome: 'success',
    streamKey: 'private-stream',
  } satisfies TransportObservation
  recorder.record({ type: 'transport', at: now, observation })
  recorder.mark('manual')
  const before = recorder.snapshot()
  const current = {
    version: 'contract',
    host: 'private.invalid',
    anotherHost: 'second.invalid',
    url: 'https://private.invalid/path?token=report-secret',
    token: 'report-secret',
    nested: {
      path: '/private-path',
      query: 'private-query',
      streamKey: 'private-stream',
      value: 'kept',
    },
  }
  const text = recorder.buildReport(current)
  const report = JSON.parse(text) as {
    current: object
    recorder: { lastSuccess: { video: { responseHost: string } } }
  }
  assert.deepEqual(report.current, {
    version: 'contract',
    host: 'external#1',
    anotherHost: 'external#2',
    nested: { value: 'kept' },
  })
  assert.equal(report.recorder.lastSuccess.video.responseHost, 'external#1')
  assert.ok(!text.includes('report-secret') && !text.includes('private-stream'))
  assert.equal(text, recorder.buildReport(current), 'export is byte-stable with fixed time')
  assert.deepEqual(recorder.snapshot(), before, 'export does not consume retained observations')
  recorder.clear()
  const after = recorder.snapshot()
  assert.equal(after.incident, null)
  assert.equal(after.manualMark, null)
  assert.deepEqual(after.flow, before.flow)
  assert.deepEqual(after.lastSuccess, before.lastSuccess)
  assert.deepEqual(after.counters, before.counters)
  assert.match(recorder.buildReport({ nextHost: 'third.invalid' }), /external#3/)
})

test('diagnostic oversized export reduces context without consuming snapshot buffers', (t) => {
  testScope(t)
  const now = 2_000_000_000_000
  const recorder = new DiagnosticRecorder(() => now)
  recorder.mark()
  const before = recorder.snapshot()
  const oversized = Object.fromEntries(
    Array.from({ length: 48 }, (_, group) => [
      String(group),
      Object.fromEntries(Array.from({ length: 48 }, (_, item) => [String(item), 'x'.repeat(160)])),
    ]),
  )
  const model = { version: 'contract', monitor: { watchdog: 'healthy' }, oversized }
  const first = recorder.buildReport(model)
  const report = JSON.parse(first) as {
    current: { version: string; monitor: { watchdog: string }; truncated: boolean }
    export: { truncated: boolean; currentReduced: boolean }
  }
  assert.ok(new TextEncoder().encode(first).byteLength <= 96 * 1024)
  assert.equal(report.current.version, 'contract')
  assert.equal(report.current.monitor.watchdog, 'healthy')
  assert.equal(report.current.truncated, true)
  assert.equal(report.export.truncated, true)
  assert.equal(report.export.currentReduced, true)
  assert.equal(first, recorder.buildReport(model))
  assert.deepEqual(recorder.snapshot(), before)
})

test('diagnostic attempts retain six records and mode interruption survives late observations', (t) => {
  testScope(t)
  const now = 2_000_000_000_000
  const recorder = new DiagnosticRecorder(() => now)
  const identity = {
    generation: generationId(1),
    epoch: epochId(1),
    representation: representationId('bounded-attempts'),
    kind: 'video' as const,
    authorityRevision: 1,
  }
  for (let index = 0; index < 8; index++) {
    const decision = {
      action: 'rewrite',
      id: decisionId(`attempt-${index}`),
      reason: 'contract',
      routeType: 'catalog-generated',
      host: TRUSTED_CATALOG[0],
      candidate: {
        type: 'catalog-generated',
        host: TRUSTED_CATALOG[0],
        kind: 'video',
        catalogIndex: 0,
      },
      ranking: [],
    } satisfies RouteDecision
    recorder.record({
      type: 'recovery',
      at: now,
      action: {
        action: 'route-fallback',
        id: recoveryActionId(`action-${index}`),
        kind: 'video',
        identity,
        decision,
      },
    })
  }
  const before = recorder.snapshot()
  assert.equal(before.routeRecovery.attempts.length, 6)
  assert.equal(before.routeRecovery.attempts[0]?.actionId, 'action-2')
  assert.equal(before.counters.attemptEvicted, 2)
  recorder.record(
    {
      type: 'lifecycle',
      at: now,
      generation: identity.generation,
      epoch: identity.epoch,
      reason: 'contract',
    },
    false,
  )
  assert.equal(recorder.snapshot().routeRecovery.attempts.at(-1)?.stage, 'interrupted')
  recorder.recordPlayer({
    at: now,
    generation: identity.generation,
    epoch: identity.epoch,
    enabled: true,
    originalComparison: false,
    currentTimeSec: 100,
    frames: 100,
    playableBufferSec: 10,
    paused: false,
    seeking: false,
    ended: false,
    readyState: 4,
    coreInitialized: true,
    watchdog: 'healthy',
  })
  assert.equal(recorder.snapshot().routeRecovery.attempts.at(-1)?.stage, 'interrupted')
  recorder.clear()
  assert.deepEqual(recorder.snapshot().routeRecovery.attempts, [])
  assert.equal(recorder.snapshot().counters.attemptEvicted, 2)
})
import '../regressions/buffer-cycle-renewal.ts'
import '../regressions/diagnostics-workloads.ts'
