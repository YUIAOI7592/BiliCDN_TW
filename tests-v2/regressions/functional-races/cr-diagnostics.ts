import test from 'node:test'
import assert from 'node:assert/strict'
import { DiagnosticRecorder } from '../../../src-v2/diagnostics/recorder.ts'
import {
  decisionId,
  epochId,
  generationId,
  recoveryActionId,
  representationId,
  requestId,
  type RequestContext,
  type RouteDecision,
} from '../../../src-v2/domain/model.ts'
import { FakeClock } from '../../support/clock.ts'
import { testScope } from '../../support/scope.ts'

for (const additional of [false, true])
  test(`CR-05 ${additional ? 'later same-route response preserves confirmed playback' : 'control: confirmed playback survives the observation deadline'}`, (t) => {
    const scope = testScope(t),
      clock = scope.own(new FakeClock()),
      start = clock.now()
    const recorder = new DiagnosticRecorder(clock.now, () => false)
    const host = 'upos-sz-mirrorali.bilivideo.com'
    const identity = {
      generation: generationId(1),
      epoch: epochId(1),
      representation: representationId('video:review'),
      kind: 'video' as const,
      authorityRevision: 1,
    }
    const decision: RouteDecision = {
      action: 'rewrite',
      id: decisionId('review-decision'),
      reason: 'verified-failure',
      routeType: 'catalog-generated',
      host,
      candidate: { type: 'catalog-generated', host, kind: 'video', catalogIndex: 0 },
      ranking: [],
    }
    const sample = (position: number) =>
      recorder.recordPlayer({
        at: clock.now(),
        generation: identity.generation,
        epoch: identity.epoch,
        enabled: true,
        originalComparison: false,
        currentTimeSec: position,
        frames: Math.round(position * 24),
        playableBufferSec: 0,
        paused: false,
        seeking: false,
        ended: false,
        readyState: 4,
        coreInitialized: true,
        watchdog: 'healthy',
      })
    const response = (id: string) => {
      const request: RequestContext = {
        ...identity,
        requestId: requestId(id),
        routePolicyRevision: 0,
        decisionId: decision.id,
        attributionStatus: 'matched',
        attributionSource: 'exact',
        decisionStage: 'request',
        routeType: 'catalog-generated',
        originalHost: host,
        targetHost: host,
        sourceHost: host,
        playurlHostChanged: false,
        playurlOutput: null,
        urlChanged: false,
        hostChanged: false,
        startedAt: clock.now(),
      }
      recorder.record({ type: 'request-started', at: clock.now(), request })
      recorder.record({
        type: 'route-confirmed',
        at: clock.now(),
        observation: {
          ...identity,
          request,
          decisionId: decision.id,
          routeType: 'catalog-generated',
          originalHost: host,
          targetHost: host,
          finalHost: host,
          streamKey: null,
          status: 206,
          bytes: 131072,
          ttfbMs: 10,
          elapsedMs: 100,
          completedAt: clock.now(),
          outcome: 'success',
          responseUrlMatchesRequest: true,
        },
      })
    }
    recorder.record({
      type: 'recovery',
      at: start,
      action: {
        action: 'route-fallback',
        id: recoveryActionId('review-action'),
        kind: 'video',
        identity,
        decision,
      },
    })
    sample(100)
    response('review-1')
    clock.advance(28000)
    sample(101)
    clock.advance(1000)
    sample(102)
    assert.equal(recorder.snapshot().routeRecovery.attempts.at(-1)?.stage, 'playback-observed')
    if (additional) {
      clock.advance(500)
      response('review-2')
    }
    clock.advance(additional ? 500 : 1000)
    recorder.tick()
    const result = recorder.snapshot().routeRecovery.attempts.at(-1)
    t.diagnostic(
      JSON.stringify({
        additional,
        stage: result?.stage,
        playbackAt: result?.playbackAt,
        elapsed: clock.now() - start,
      }),
    )
    assert.equal(
      result?.stage,
      'playback-observed',
      'additional valid data on the same confirmed route must not erase existing playback evidence',
    )
  })
