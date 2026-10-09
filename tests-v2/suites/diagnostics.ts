import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { assessDemandRatio } from '../../src-v2/domain/routing.ts'
import { decisionId, epochId, generationId, recoveryActionId, representationId, requestId } from '../../src-v2/domain/model.ts'
import { TRUSTED_CATALOG } from '../../src-v2/domain/catalog.ts'
import { SessionStore } from '../../src-v2/state/session-store.ts'
import { DiagnosticRecorder } from '../../src-v2/diagnostics/recorder.ts'
import type { DomainEvent, RouteDecision, TransportObservation } from '../../src-v2/domain/model.ts'
import { testScope } from '../support/scope.ts'

// Each call creates fresh resources and replays only this fixture's prerequisite transitions.
// Earlier expectations run in their own cases; no mutable state crosses a test boundary.
async function fixture(t: TestContext, scenario: number, parameter = 0): Promise<() => Promise<void>> {
  const scope = testScope(t)
const now = 2_000_000_000_000
const clock = { now: () => now }
const session = new SessionStore()
const routeReadModel = { planCount: 41, recentPlans: [] }
const recorder = new DiagnosticRecorder(() => now, () => false)
const healthyObservation: TransportObservation = { generation: generationId(1), epoch: epochId(1), decisionId: decisionId('aggregate'),
  representation: null, kind: 'video', routeType: 'catalog-generated', originalHost: 'a.example', targetHost: 'b.example', finalHost: 'b.example',
  status: 206, bytes: 100_000, ttfbMs: 20, elapsedMs: 100, completedAt: now, outcome: 'success', streamKey: 'aggregate' }
for (let index = 0; index < 1000; index++) recorder.record({ type: 'transport', at: now, observation: { ...healthyObservation, completedAt: now + index } })
const recorderSnapshot = recorder.snapshot()
if (scenario === 0) return async () => {
assert.ok(recorderSnapshot.flow.length <= 96, '1000 successes remain bounded aggregates')
assert.strictEqual(recorderSnapshot.events.length, 0, 'healthy requests do not create verbose events when disabled')
const failureEvent: DomainEvent = { type: 'transport', at: now + 2000, observation: { ...healthyObservation, completedAt: now + 2000,
  outcome: 'failure', failureKind: 'network', status: 0 } }
recorder.record(failureEvent)
assert.ok((recorder.snapshot()).incident, 'verified failure freezes an incident timeline')
const report = JSON.parse(recorder.buildReport({ version: '2.0.0', session: session.get(), routes: routeReadModel,
  monitor: { watchdog: 'healthy', video: { currentTime: 90, bufferAheadSec: 70 } } })) as {
  current: { routes?: { planCount: number }; monitor?: { watchdog: string }; truncated?: boolean }; recorder: { truncated?: boolean }
}
assert.strictEqual(report.current.routes?.planCount, routeReadModel.planCount, 'incident report retains route state with many groups')
assert.strictEqual(report.current.monitor?.watchdog, 'healthy', 'incident report retains player state with many groups')
assert.ok(report.current.truncated !== true, 'capacity fallback never discards the complete current state')
const oversizedReport = JSON.parse(recorder.buildReport({ version: '2.0.0', session: session.get(),
  routes: { ...routeReadModel, plans: Array.from({ length: 128 }, () => 'p'.repeat(1000)),
    ranking: Array.from({ length: 128 }, () => 'r'.repeat(1000)) },
  monitor: { watchdog: 'healthy', video: { currentTime: 90, bufferAheadSec: 70 } } })) as {
  current: { routes?: { planCount: number }; monitor?: { watchdog: string }; truncated?: boolean };
  recorder: { incident?: { reason: string } | null; truncated?: boolean }
}
assert.strictEqual(oversizedReport.current.routes?.planCount, routeReadModel.planCount, 'oversized route read model retains bounded current summary')
assert.strictEqual(oversizedReport.current.monitor?.watchdog, 'healthy', 'oversized report keeps current playback state')
assert.ok(oversizedReport.recorder.incident?.reason.startsWith('transport:'), 'oversized report keeps incident cause')
assert.ok(((oversizedReport.recorder as { flow?: unknown[] }).flow?.length ?? 0) > 0, 'oversized report preserves successful transport summaries')
}
void (recorderSnapshot.flow.length <= 96);
void (recorderSnapshot.events.length);
void (0);
const failureEvent: DomainEvent = { type: 'transport', at: now + 2000, observation: { ...healthyObservation, completedAt: now + 2000,
  outcome: 'failure', failureKind: 'network', status: 0 } }
recorder.record(failureEvent)
void ((recorder.snapshot()).incident);
const report = JSON.parse(recorder.buildReport({ version: '2.0.0', session: session.get(), routes: routeReadModel,
  monitor: { watchdog: 'healthy', video: { currentTime: 90, bufferAheadSec: 70 } } })) as {
  current: { routes?: { planCount: number }; monitor?: { watchdog: string }; truncated?: boolean }; recorder: { truncated?: boolean }
}
void (report.current.routes?.planCount);
void (routeReadModel.planCount);
void (report.current.monitor?.watchdog);
void ('healthy');
void (report.current.truncated !== true);
const oversizedReport = JSON.parse(recorder.buildReport({ version: '2.0.0', session: session.get(),
  routes: { ...routeReadModel, plans: Array.from({ length: 128 }, () => 'p'.repeat(1000)),
    ranking: Array.from({ length: 128 }, () => 'r'.repeat(1000)) },
  monitor: { watchdog: 'healthy', video: { currentTime: 90, bufferAheadSec: 70 } } })) as {
  current: { routes?: { planCount: number }; monitor?: { watchdog: string }; truncated?: boolean };
  recorder: { incident?: { reason: string } | null; truncated?: boolean }
}
void (oversizedReport.current.routes?.planCount);
void (routeReadModel.planCount);
void (oversizedReport.current.monitor?.watchdog);
void ('healthy');
void (oversizedReport.recorder.incident?.reason.startsWith('transport:'));
void (((oversizedReport.recorder as { flow?: unknown[] }).flow?.length ?? 0) > 0);
const trace = new DiagnosticRecorder(() => traceNow, () => false)
let traceNow = now
const traceRep = representationId('trace-rep'), traceHostA = TRUSTED_CATALOG[0], traceHostB = TRUSTED_CATALOG[1]
const traceIdentity = { generation: generationId(2), epoch: epochId(3), representation: traceRep, kind: 'video' as const,
  authorityRevision: 4 }
const traceDecision = (id: string, host: string): RouteDecision => ({ action: 'rewrite', id: decisionId(id), reason: 'proven',
  routeType: 'catalog-generated', host, candidate: { type: 'catalog-generated', host, kind: 'video', catalogIndex: 0 }, ranking: [] })
const traceSample = (time: number, buffer: number, frames: number, paused = false) => ({ at: traceNow,
  generation: traceIdentity.generation, epoch: traceIdentity.epoch, enabled: true, originalComparison: false,
  currentTimeSec: time, frames, playableBufferSec: buffer, paused, seeking: false, ended: false,
  readyState: 4, coreInitialized: true, watchdog: 'healthy' as const })
const attemptRows = () => (trace.snapshot()).routeRecovery.attempts
trace.recordPlayer(traceSample(100, 4, 100))
trace.record({ type: 'recovery', at: traceNow, action: { action: 'route-fallback', id: recoveryActionId('first'),
  kind: 'video', identity: traceIdentity, decision: traceDecision('first-decision', traceHostA) } })
trace.recordPlayer(traceSample(100, 4, 100))
traceNow += 1000;
trace.recordPlayer(traceSample(101, 3, 125))
if (scenario === 1) return async () => {
assert.strictEqual(attemptRows().at(-1)?.stage, 'progress-unconfirmed', 'old buffered playback does not verify a fallback')
const traceRequest = (id: string, decision: string, host: string) => ({ requestId: requestId(id), generation: traceIdentity.generation,
  epoch: traceIdentity.epoch, decisionId: decisionId(decision), representation: traceRep, authorityRevision: 4, routePolicyRevision: 0,
  kind: 'video' as const, attributionStatus: 'matched' as const, attributionSource: 'exact' as const,
  decisionStage: 'request' as const, routeType: 'catalog-generated' as const, originalHost: traceHostA,
  targetHost: host, sourceHost: traceHostA, playurlHostChanged: false, playurlOutput: null,
  urlChanged: false, hostChanged: true, startedAt: traceNow })
for (let index = 0; index < 11; index++) {
  const request = traceRequest(`abort-${index}`, 'first-decision', traceHostA)
  trace.record({ type: 'request-started', at: traceNow, request })
  trace.record({ type: 'transport-completed', at: traceNow, detached: false, observation: {
    ...healthyObservation, request, generation: traceIdentity.generation, epoch: traceIdentity.epoch,
    representation: traceRep, decisionId: request.decisionId, targetHost: traceHostA, finalHost: null,
    status: 0, bytes: 0, outcome: 'abort', completedAt: traceNow } })
}
assert.strictEqual(attemptRows().at(-1)?.zeroByteAborts, 11, 'abort wave is counted per fallback decision')
assert.strictEqual(attemptRows().at(-1)?.noResponseAborts, 11, 'pre-response abort wave is distinguished from timeout')
assert.strictEqual(attemptRows().at(-1)?.stage, 'progress-unconfirmed', 'aborts do not confirm or fail a route')
const timeoutRequest = traceRequest('timeout-after-aborts', 'first-decision', traceHostA)
trace.record({ type: 'request-started', at: traceNow, request: timeoutRequest })
trace.record({ type: 'transport-completed', at: traceNow, detached: false, observation: {
  ...healthyObservation, request: timeoutRequest, generation: traceIdentity.generation, epoch: traceIdentity.epoch,
  representation: traceRep, decisionId: timeoutRequest.decisionId, targetHost: traceHostA, finalHost: null,
  status: 0, bytes: 0, outcome: 'failure', failureKind: 'timeout', completedAt: traceNow } })
const timedOutAttempt = attemptRows().at(-1) as { aborts: number; failures: number; lastFailureKind: string } | undefined
assert.strictEqual(timedOutAttempt?.aborts, 11, 'timeout does not increase the abort count')
assert.strictEqual(timedOutAttempt?.failures, 1, 'timeout is a separate fallback failure')
assert.strictEqual(timedOutAttempt?.lastFailureKind, 'timeout', 'fallback preserves the timeout category')
const timedOutFlow = (trace.snapshot()).flow
assert.strictEqual(timedOutFlow.reduce((sum, row) => sum + row.aborts, 0), 11, 'flow summary counts only abort terminal events as aborts')
assert.strictEqual(timedOutFlow.reduce((sum, row) => sum + row.failures, 0), 1, 'flow summary retains the failed request')
assert.strictEqual(timedOutFlow.reduce((sum, row) => sum + row.timeouts, 0), 1, 'flow summary distinguishes timeout from abort')
}
void (attemptRows().at(-1)?.stage);
void ('progress-unconfirmed');
const traceRequest = (id: string, decision: string, host: string) => ({ requestId: requestId(id), generation: traceIdentity.generation,
  epoch: traceIdentity.epoch, decisionId: decisionId(decision), representation: traceRep, authorityRevision: 4, routePolicyRevision: 0,
  kind: 'video' as const, attributionStatus: 'matched' as const, attributionSource: 'exact' as const,
  decisionStage: 'request' as const, routeType: 'catalog-generated' as const, originalHost: traceHostA,
  targetHost: host, sourceHost: traceHostA, playurlHostChanged: false, playurlOutput: null,
  urlChanged: false, hostChanged: true, startedAt: traceNow })
for (let index = 0; index < 11; index++) {
  const request = traceRequest(`abort-${index}`, 'first-decision', traceHostA)
  trace.record({ type: 'request-started', at: traceNow, request })
  trace.record({ type: 'transport-completed', at: traceNow, detached: false, observation: {
    ...healthyObservation, request, generation: traceIdentity.generation, epoch: traceIdentity.epoch,
    representation: traceRep, decisionId: request.decisionId, targetHost: traceHostA, finalHost: null,
    status: 0, bytes: 0, outcome: 'abort', completedAt: traceNow } })
}
void (attemptRows().at(-1)?.zeroByteAborts);
void (11);
void (attemptRows().at(-1)?.noResponseAborts);
void (11);
void (attemptRows().at(-1)?.stage);
void ('progress-unconfirmed');
const timeoutRequest = traceRequest('timeout-after-aborts', 'first-decision', traceHostA)
trace.record({ type: 'request-started', at: traceNow, request: timeoutRequest })
trace.record({ type: 'transport-completed', at: traceNow, detached: false, observation: {
  ...healthyObservation, request: timeoutRequest, generation: traceIdentity.generation, epoch: traceIdentity.epoch,
  representation: traceRep, decisionId: timeoutRequest.decisionId, targetHost: traceHostA, finalHost: null,
  status: 0, bytes: 0, outcome: 'failure', failureKind: 'timeout', completedAt: traceNow } })
const timedOutAttempt = attemptRows().at(-1) as { aborts: number; failures: number; lastFailureKind: string } | undefined
void (timedOutAttempt?.aborts);
void (11);
void (timedOutAttempt?.failures);
void (1);
void (timedOutAttempt?.lastFailureKind);
void ('timeout');
const timedOutFlow = (trace.snapshot()).flow
void (timedOutFlow.reduce((sum, row) => sum + row.aborts, 0));
void (11);
void (timedOutFlow.reduce((sum, row) => sum + row.failures, 0));
void (1);
void (timedOutFlow.reduce((sum, row) => sum + row.timeouts, 0));
void (1);
trace.record({ type: 'recovery', at: traceNow, action: { action: 'route-fallback', id: recoveryActionId('second'),
  kind: 'video', identity: traceIdentity, decision: traceDecision('second-decision', traceHostB) } })
trace.recordPlayer(traceSample(101, 0.5, 125))
if (scenario === 2) return async () => {
assert.strictEqual(attemptRows()[0]?.stage, 'superseded', 'new fallback supersedes unconfirmed old attempt')
const secondRequest = traceRequest('second-request', 'second-decision', traceHostB)
trace.record({ type: 'request-started', at: traceNow, request: secondRequest })
const secondSuccess = { ...healthyObservation, request: secondRequest, generation: traceIdentity.generation,
  epoch: traceIdentity.epoch, representation: traceRep, decisionId: secondRequest.decisionId,
  targetHost: traceHostB, finalHost: traceHostB, responseUrlMatchesRequest: true, completedAt: traceNow }
trace.record({ type: 'route-confirmed', at: traceNow, observation: { ...secondSuccess, bytes: 10_000 } })
assert.strictEqual(attemptRows().at(-1)?.stage, 'response-observed', 'direct nonempty 206 advances to network evidence')
traceNow += 1000;
trace.recordPlayer(traceSample(101.7, 1, 132))
assert.strictEqual(attemptRows().at(-1)?.stage, 'response-observed', 'one player tick is insufficient')
traceNow += 1000;
trace.recordPlayer(traceSample(102.2, 1, 156))
assert.strictEqual(attemptRows().at(-1)?.stage, 'playback-observed', 'two ticks beyond original buffer record playback evidence')
assert.strictEqual(assessDemandRatio(0.55), 'below-required', 'sub-demand route is labeled without changing selection')
assert.strictEqual(assessDemandRatio(1.2), 'below-headroom', 'partial headroom is labeled')
assert.strictEqual(assessDemandRatio(1.35), 'meets-headroom', 'sufficient headroom is labeled')
assert.strictEqual(assessDemandRatio(null), 'unknown', 'missing throughput is labeled unknown')
}
void (attemptRows()[0]?.stage);
void ('superseded');
const secondRequest = traceRequest('second-request', 'second-decision', traceHostB)
trace.record({ type: 'request-started', at: traceNow, request: secondRequest })
const secondSuccess = { ...healthyObservation, request: secondRequest, generation: traceIdentity.generation,
  epoch: traceIdentity.epoch, representation: traceRep, decisionId: secondRequest.decisionId,
  targetHost: traceHostB, finalHost: traceHostB, responseUrlMatchesRequest: true, completedAt: traceNow }
trace.record({ type: 'route-confirmed', at: traceNow, observation: { ...secondSuccess, bytes: 10_000 } })
void (attemptRows().at(-1)?.stage);
void ('response-observed');
traceNow += 1000;
trace.recordPlayer(traceSample(101.7, 1, 132))
void (attemptRows().at(-1)?.stage);
void ('response-observed');
traceNow += 1000;
trace.recordPlayer(traceSample(102.2, 1, 156))
void (attemptRows().at(-1)?.stage);
void ('playback-observed');
void (assessDemandRatio(0.55));
void ('below-required');
void (assessDemandRatio(1.2));
void ('below-headroom');
void (assessDemandRatio(1.35));
void ('meets-headroom');
void (assessDemandRatio(null));
void ('unknown');
const invalidTransfers = [
  { name: 'wrong host', request: { targetHost: traceHostA } },
  { name: 'wrong decision', request: { decisionId: decisionId('unrelated') } },
  { name: 'stale epoch', request: { epoch: epochId(2) } },
  { name: 'stale authority', request: { authorityRevision: 3 } },
  { name: 'audio transfer', request: { kind: 'audio' as const } },
  { name: 'HTTP 200', observation: { status: 200 } },
  { name: 'empty 206', observation: { bytes: 0 } },
  { name: 'redirected response', observation: { finalHost: traceHostA } },
  { name: 'same-host redirect', observation: { responseUrlMatchesRequest: false } },
]
if (scenario === 3) {
 let iteration = 0
for (const invalid of invalidTransfers) {
 if (iteration++ === parameter) return async () => {
  const fixture = new DiagnosticRecorder(() => traceNow, () => false)
  fixture.record({ type: 'recovery', at: traceNow, action: { action: 'route-fallback', id: recoveryActionId('invalid'),
    kind: 'video', identity: traceIdentity, decision: traceDecision('second-decision', traceHostB) } })
  fixture.recordPlayer(traceSample(10, 0, 1))
  const request = { ...traceRequest('invalid-request', 'second-decision', traceHostB), ...invalid.request }
  fixture.record({ type: 'request-started', at: traceNow, request })
  fixture.record({ type: 'route-confirmed', at: traceNow, observation: { ...secondSuccess, request,
    decisionId: request.decisionId, epoch: request.epoch, kind: request.kind,
    targetHost: request.targetHost, finalHost: request.targetHost, ...invalid.observation } })
  const stage = ((fixture.snapshot()).routeRecovery.attempts.at(-1)?.stage)
  assert.ok(stage !== 'response-observed' && stage !== 'playback-observed', `${invalid.name} cannot confirm fallback transfer`)
}
 }
 throw Error('Unknown fixture parameter')
}
for (const invalid of invalidTransfers) {
  const fixture = new DiagnosticRecorder(() => traceNow, () => false)
  fixture.record({ type: 'recovery', at: traceNow, action: { action: 'route-fallback', id: recoveryActionId('invalid'),
    kind: 'video', identity: traceIdentity, decision: traceDecision('second-decision', traceHostB) } })
  fixture.recordPlayer(traceSample(10, 0, 1))
  const request = { ...traceRequest('invalid-request', 'second-decision', traceHostB), ...invalid.request }
  fixture.record({ type: 'request-started', at: traceNow, request })
  fixture.record({ type: 'route-confirmed', at: traceNow, observation: { ...secondSuccess, request,
    decisionId: request.decisionId, epoch: request.epoch, kind: request.kind,
    targetHost: request.targetHost, finalHost: request.targetHost, ...invalid.observation } })
  const stage = ((fixture.snapshot()).routeRecovery.attempts.at(-1)?.stage)
void (stage !== 'response-observed' && stage !== 'playback-observed');
}
const pausedTrace = new DiagnosticRecorder(() => traceNow, () => false)
pausedTrace.record({ type: 'recovery', at: traceNow, action: { action: 'route-fallback', id: recoveryActionId('paused'),
  kind: 'video', identity: traceIdentity, decision: traceDecision('second-decision', traceHostB) } })
pausedTrace.recordPlayer(traceSample(50, 0.5, 10))
const pausedRequest = traceRequest('paused-request', 'second-decision', traceHostB)
pausedTrace.record({ type: 'request-started', at: traceNow, request: pausedRequest })
pausedTrace.record({ type: 'route-confirmed', at: traceNow, observation: { ...secondSuccess, request: pausedRequest } })
traceNow += 1000;
pausedTrace.recordPlayer(traceSample(51, 0, 12, true))
traceNow += 1000;
pausedTrace.recordPlayer(traceSample(52, 0, 13, true))
if (scenario === 4) return async () => {
assert.strictEqual(((pausedTrace.snapshot()).routeRecovery.attempts.at(-1)?.stage),
  'response-observed', 'paused player cannot confirm fallback playback')
pausedTrace.recordPlayer({ ...traceSample(52, 0, 13), seeking: true })
assert.strictEqual(((pausedTrace.snapshot()).routeRecovery.attempts.at(-1)?.stage),
  'interrupted', 'seek invalidates the old buffer boundary')
const mixedTrace = new DiagnosticRecorder(() => traceNow, () => false)
mixedTrace.record({ type: 'recovery', at: traceNow, action: { action: 'route-fallback', id: recoveryActionId('mixed'),
  kind: 'video', identity: traceIdentity, decision: traceDecision('second-decision', traceHostB) } })
mixedTrace.recordPlayer(traceSample(60, 0.2, 20))
mixedTrace.record({ type: 'route-confirmed', at: traceNow, observation: { ...secondSuccess,
  request: traceRequest('competing', 'other-decision', traceHostA), decisionId: decisionId('other-decision'),
  targetHost: traceHostA, finalHost: traceHostA } })
assert.strictEqual(((mixedTrace.snapshot()).routeRecovery.attempts.at(-1)?.stage),
  'mixed-evidence', 'another successful video host makes playback attribution ambiguous')
const disabledTrace = new DiagnosticRecorder(() => traceNow, () => false)
disabledTrace.record({ type: 'recovery', at: traceNow, action: { action: 'route-fallback', id: recoveryActionId('disabled'),
  kind: 'video', identity: traceIdentity, decision: traceDecision('second-decision', traceHostB) } })
disabledTrace.record({ type: 'route-confirmed', at: traceNow, observation: secondSuccess }, false)
assert.strictEqual(((disabledTrace.snapshot()).routeRecovery.attempts.at(-1)?.stage),
  'interrupted', 'comparison or disabled mode stops route attribution immediately')
const staleTrace = new DiagnosticRecorder(() => traceNow, () => false)
staleTrace.record({ type: 'recovery', at: traceNow, action: { action: 'route-fallback', id: recoveryActionId('stale'),
  kind: 'video', identity: traceIdentity, decision: traceDecision('second-decision', traceHostB) } })
staleTrace.record({ type: 'lifecycle', at: traceNow, generation: generationId(3), epoch: epochId(4), reason: 'spa' })
assert.strictEqual(((staleTrace.snapshot()).routeRecovery.attempts.at(-1)?.stage),
  'interrupted', 'new generation closes stale fallback attribution')
trace.record({ type: 'core', at: traceNow, state: 'recovered', actionId: recoveryActionId('core'), source: 'route-failure' })
const traceReport = trace.buildReport({ url: 'https://example.invalid/video?token=secret' })
assert.ok(new TextEncoder().encode(traceReport).length <= 96 * 1024, 'fallback trace preserves report limit')
assert.ok(!traceReport.includes('token=secret'), 'fallback trace report excludes sensitive test query')
assert.ok(traceReport.includes('player-core-progress-only'), 'core progress is explicitly scoped below route confirmation')
}
void (((pausedTrace.snapshot()).routeRecovery.attempts.at(-1)?.stage));
void ('response-observed');
pausedTrace.recordPlayer({ ...traceSample(52, 0, 13), seeking: true })
void (((pausedTrace.snapshot()).routeRecovery.attempts.at(-1)?.stage));
void ('interrupted');
const mixedTrace = new DiagnosticRecorder(() => traceNow, () => false)
mixedTrace.record({ type: 'recovery', at: traceNow, action: { action: 'route-fallback', id: recoveryActionId('mixed'),
  kind: 'video', identity: traceIdentity, decision: traceDecision('second-decision', traceHostB) } })
mixedTrace.recordPlayer(traceSample(60, 0.2, 20))
mixedTrace.record({ type: 'route-confirmed', at: traceNow, observation: { ...secondSuccess,
  request: traceRequest('competing', 'other-decision', traceHostA), decisionId: decisionId('other-decision'),
  targetHost: traceHostA, finalHost: traceHostA } })
void (((mixedTrace.snapshot()).routeRecovery.attempts.at(-1)?.stage));
void ('mixed-evidence');
const disabledTrace = new DiagnosticRecorder(() => traceNow, () => false)
disabledTrace.record({ type: 'recovery', at: traceNow, action: { action: 'route-fallback', id: recoveryActionId('disabled'),
  kind: 'video', identity: traceIdentity, decision: traceDecision('second-decision', traceHostB) } })
disabledTrace.record({ type: 'route-confirmed', at: traceNow, observation: secondSuccess }, false)
void (((disabledTrace.snapshot()).routeRecovery.attempts.at(-1)?.stage));
void ('interrupted');
const staleTrace = new DiagnosticRecorder(() => traceNow, () => false)
staleTrace.record({ type: 'recovery', at: traceNow, action: { action: 'route-fallback', id: recoveryActionId('stale'),
  kind: 'video', identity: traceIdentity, decision: traceDecision('second-decision', traceHostB) } })
staleTrace.record({ type: 'lifecycle', at: traceNow, generation: generationId(3), epoch: epochId(4), reason: 'spa' })
void (((staleTrace.snapshot()).routeRecovery.attempts.at(-1)?.stage));
void ('interrupted');
trace.record({ type: 'core', at: traceNow, state: 'recovered', actionId: recoveryActionId('core'), source: 'route-failure' })
const traceReport = trace.buildReport({ url: 'https://example.invalid/video?token=secret' })
void (new TextEncoder().encode(traceReport).length <= 96 * 1024);
void (!traceReport.includes('token=secret'));
void (traceReport.includes('player-core-progress-only'));
const saturatedReport = JSON.parse(trace.buildReport({ version: '2.1.4', monitor: { watchdog: 'healthy' },
  evidence: Array.from({ length: 48 }, () => Array.from({ length: 48 }, () => 'x'.repeat(160))) })) as {
  current: { monitor?: { watchdog?: string } }; recorder: { routeRecovery?: { attempts?: unknown[] } }
}
if (scenario === 5) return async () => {
assert.ok(new TextEncoder().encode(JSON.stringify(saturatedReport)).length <= 96 * 1024,
  'oversized current evidence still honors the absolute report limit')
assert.strictEqual(saturatedReport.current.monitor?.watchdog, 'healthy', 'size fallback retains current playback watchdog')
assert.ok((saturatedReport.recorder.routeRecovery?.attempts?.length ?? 0) >= 1, 'size fallback retains latest fallback assessment')
}
void (new TextEncoder().encode(JSON.stringify(saturatedReport)).length <= 96 * 1024);
void (saturatedReport.current.monitor?.watchdog);
void ('healthy');
void ((saturatedReport.recorder.routeRecovery?.attempts?.length ?? 0) >= 1);
throw Error('Unknown fixture scenario')
}

test("1000 successes remain bounded aggregates [1]", { timeout: 5000 }, async t => { await (await fixture(t, 0))() })
test("old buffered playback does not verify a fallback [2]", { timeout: 5000 }, async t => { await (await fixture(t, 1))() })
test("new fallback supersedes unconfirmed old attempt [3]", { timeout: 5000 }, async t => { await (await fixture(t, 2))() })
{
 let parameter = 0
for (const invalid of ["wrong host","wrong decision","stale epoch","stale authority","audio transfer","HTTP 200","empty 206","redirected response","same-host redirect"]) {
 const selected = parameter++
 test("`${invalid.name} cannot confirm fallback transfer` [4]" + ` / ${String(invalid)} / ${selected}`, { timeout: 5000 }, async t => { await (await fixture(t, 3, selected))() })
}
}
test("paused player cannot confirm fallback playback [5]", { timeout: 5000 }, async t => { await (await fixture(t, 4))() })
test("oversized current evidence still honors the absolute report limit [6]", { timeout: 5000 }, async t => { await (await fixture(t, 5))() })
