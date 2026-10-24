import assert from 'node:assert/strict'
import { isDeepStrictEqual } from 'node:util'
import { RuntimeController } from '../../src-v2/application/runtime-controller.ts'
import { DiagnosticRecorder } from '../../src-v2/diagnostics/recorder.ts'
import { defaultSettings } from '../../src-v2/state/settings-store.ts'
import { epochId, representationId, requestId } from '../../src-v2/domain/model.ts'
import type { BufferTrendSnapshot } from '../../src-v2/domain/buffer-trend.ts'
import { bufferMonitor } from './buffer-monitor.ts'
import type { testScope } from './scope.ts'
import { sha256 } from '../../scripts/upstream-compare/model.mts'
import { scoreWindow } from '../../scripts/buffer-shadow/model.mts'
import type { EvidenceRow, ScenarioName } from '../../scripts/buffer-shadow/model.mts'
import {
  candidateProfile,
  candidateTargets,
} from '../../scripts/buffer-shadow/candidate-inputs.mts'
import type { CandidateProfile } from '../../scripts/buffer-shadow/candidate-inputs.mts'
import type { ObservationTarget } from '../../scripts/buffer-shadow/observation-inputs.mts'
import type { CycleTarget } from '../../scripts/buffer-shadow/cycle-inputs.mts'

export interface ScenarioInput {
  readonly at: number
  readonly buffer: number | 'NaN'
  readonly progress: boolean
  readonly rate: number
  readonly owner: string
}
export interface ScenarioResult {
  readonly id: string
  readonly level: 'integration'
  readonly rate: 1 | 2
  readonly algorithm: 'buffer-window-v6'
  readonly scenarioHash: string
  readonly validity: 'valid'
  readonly verdict: 'pass' | 'fail'
  readonly reasons: readonly string[]
  readonly warmupMs: number
  readonly prelude: readonly {
    readonly input: ScenarioInput
    readonly trend: BufferTrendSnapshot
  }[]
  readonly stallAt: number | null
  readonly inputs: readonly ScenarioInput[]
  readonly rows: readonly (EvidenceRow & { readonly trend: BufferTrendSnapshot })[]
  readonly score: ReturnType<typeof scoreWindow>
  readonly assertions: readonly {
    readonly id: string
    readonly expected: unknown
    readonly actual: unknown
    readonly evidence: readonly number[]
    readonly verdict: 'pass' | 'fail'
  }[]
  readonly effects: readonly string[]
  readonly bounds: {
    readonly maxSamples: number
    readonly maxCompletions: number
    readonly maxTrendRecords: number
    readonly maxTrendBytes: number
    readonly maxReportBytes: number
  }
  readonly cleanup: { readonly timers: number; readonly subscriptions: number }
}

export async function runScenario(
  name: ScenarioName | 'observation-holdout',
  rate: 1 | 2,
  t: Parameters<typeof testScope>[0] = { after() {} },
  observation?: {
    readonly profile: CandidateProfile
    readonly target: ObservationTarget & CycleTarget
  },
): Promise<ScenarioResult> {
  const f = bufferMonitor(t, rate),
    recorder = new DiagnosticRecorder(f.clock.now, () => false)
  let subscriptions = 0
  const subscribe = () => {
    subscriptions++
    return () => {
      subscriptions--
    }
  }
  const runtime = new RuntimeController(
    f.session,
    { get: () => defaultSettings(f.clock.now()), subscribe },
    { ...f.routes, latestRequested: f.request, subscribe, invalidateForUserSetting() {} },
    { ...f.player, reset() {} },
    f.monitor,
    { reset() {} },
    { subscribe, reset() {}, armRouteFailure() {} },
    { setEnabled() {} },
    recorder,
    f.clock.now,
    { subscribeEpoch: subscribe },
  )
  runtime.install()
  f.scope.defer(() => {
    runtime.dispose()
    assert.equal(subscriptions, 0)
  })
  const inputs: ScenarioInput[] = [],
    rows: (EvidenceRow & { trend: BufferTrendSnapshot })[] = []
  const prelude: { input: ScenarioInput; trend: BufferTrendSnapshot }[] = []
  const assertions: ScenarioResult['assertions'][number][] = []
  const check = (id: string, expected: unknown, actual: unknown) => {
    assertions.push({
      id,
      expected,
      actual,
      evidence: rows.length ? [rows.at(-1)!.seq] : [],
      verdict: JSON.stringify(expected) === JSON.stringify(actual) ? 'pass' : 'fail',
    })
  }
  const profile = observation?.profile ?? candidateProfile(name)
  const initial =
    profile?.initialBuffer ??
    (name === 'high-stable'
      ? 30
      : name === 'low-stable' || name === 'low-sawtooth'
        ? 8
        : name === 'slow-exhaustion'
          ? 20
          : 12)
  let ownerRevision = 1,
    projectionMatches = true,
    maxSamples = 0,
    maxCompletions = 0,
    maxTrendRecords = 0,
    maxTrendBytes = 0,
    maxReportBytes = 0
  const sample = (
    buffer: number,
    progress: boolean,
    ms: number,
    record: boolean,
    elapsed: number,
  ) => {
    f.video.bufferAheadSec = buffer * f.video.playbackRate
    f.video.playableBufferSec = buffer
    if (progress && ms > 0) {
      f.video.currentTime += (f.video.playbackRate * ms) / 1000
      f.video.frames = f.video.frames === null ? null : f.video.frames + 30
    }
    // Reuse the complete prelude snapshot at scenario zero. A duplicate tick at
    // the same timestamp would manufacture an insufficient diagnostic row.
    if (ms > 0 || !record) {
      f.clock.advance(ms)
      f.monitor.tick()
    }
    const trend = f.monitor.snapshot().bufferTrend!
    const snapshot = recorder.snapshot()
    // A reset-only read does not publish a new sample; compare only completed ticks.
    if (ms > 0 || !record)
      projectionMatches &&= isDeepStrictEqual(snapshot.bufferTrend.latest, trend)
    maxSamples = Math.max(maxSamples, trend.sampleCount)
    maxCompletions = Math.max(
      maxCompletions,
      trend.transport.successes + trend.transport.failures + trend.transport.aborts,
    )
    maxTrendRecords = Math.max(maxTrendRecords, snapshot.bufferTrend.history.length)
    maxTrendBytes = Math.max(
      maxTrendBytes,
      Buffer.byteLength(JSON.stringify(snapshot.bufferTrend.history)),
    )
    if (name !== 'two-hour-bounds' || elapsed % 10000 === 0)
      maxReportBytes = Math.max(maxReportBytes, Buffer.byteLength(recorder.buildReport({})))
    if (record) {
      const input = {
        at: elapsed,
        buffer: Number.isFinite(buffer) ? buffer : ('NaN' as const),
        progress,
        rate: f.video.playbackRate,
        owner: `owner-${ownerRevision}`,
      }
      inputs.push(input)
      rows.push({
        seq: rows.length + 1,
        at: elapsed,
        owner: input.owner,
        candidate: trend.candidate,
        state: trend.state,
        reason: trend.reason,
        currentTime: f.video.currentTime,
        frames: f.video.frames,
        qualified: !f.video.paused && !f.video.seeking && !f.video.ended && !f.video.mediaError,
        rate: f.video.playbackRate,
        trend: structuredClone(trend),
      })
    } else
      prelude.push({
        input: {
          at: prelude.length * 1000,
          buffer: Number.isFinite(buffer) ? buffer : 'NaN',
          progress,
          rate: f.video.playbackRate,
          owner: `owner-${ownerRevision}`,
        },
        trend: structuredClone(trend),
      })
  }
  try {
    sample(initial, true, 0, false, 0)
    for (let i = 0; i < 60; i++) sample(initial, true, 1000, false, 0)
    if (name === 'pre-window-stall') {
      f.monitor.reset()
      ownerRevision++
    }
    const start = f.clock.now()
    sample(initial, true, 0, true, 0)
    const duration =
      profile?.samples.length ??
      (name === 'two-hour-bounds' ? 7200 : name === 'slow-exhaustion' ? 60 : 45)
    const stallAt =
      profile?.stallAt ??
      (name === 'slow-exhaustion'
        ? 40000
        : name === 'fast-exhaustion'
          ? 6000
          : name === 'sudden-loss'
            ? 1000
            : name === 'pre-window-stall'
              ? 2000
              : null)
    for (let second = 1; second <= duration; second++) {
      let buffer = initial,
        progress = true
      const profileSample = profile?.samples[second - 1]
      if (profileSample) {
        buffer = profileSample.buffer
        progress = profileSample.progress
      }
      if (name === 'jitter-2s') buffer = second <= 2 ? 12 - second : 12
      if (name === 'short-stall-5s') progress = second > 5
      if (name === 'burst-refill') buffer = 12 - (second % 4)
      if (name === 'drain-refill')
        buffer = second <= 8 ? 12 - second / 2 : Math.min(14, 8 + (second - 8) / 2)
      if (name === 'low-sawtooth') buffer = 8 - (second % 4)
      if (name === 'slow-exhaustion') {
        buffer = Math.max(0, 20 - second / 2)
        progress = second < 40
      }
      if (name === 'fast-exhaustion') {
        buffer = Math.max(0, 12 - second * 2)
        progress = second < 6
      }
      if (name === 'sudden-loss' || name === 'pre-window-stall') {
        progress = second < (name === 'sudden-loss' ? 1 : 2)
        buffer = progress ? 12 : 0
      }
      if (name.startsWith('transport-') || name === 'missing-frames')
        buffer = Math.max(3, 12 - second / 2)
      if (name === 'missing-frames') f.video.frames = null
      if (name === 'illegal-buffer' && second === 2) buffer = NaN
      if (
        second === 2 &&
        ['rate-change', 'representation-change', 'content-change', 'new-operation'].includes(name)
      ) {
        ownerRevision++
        if (name === 'rate-change') {
          f.video.playbackRate = rate === 1 ? 2 : 1
          f.video.effectiveRate = f.video.playbackRate
        }
        if (name === 'representation-change') {
          f.state.representation = representationId('replacement')
          f.changeRequest({ representation: f.state.representation })
        }
        if (name === 'content-change') {
          f.state.epoch = epochId(2)
          f.changeRequest({ epoch: f.state.epoch })
        }
        if (name === 'new-operation') f.controls.userRevision++
      }
      if (name === 'recovering') f.flags.recovering = true
      if (name === 'media-end') f.video.bufferedToEnd = true
      if (name === 'two-hour-bounds' && second % 300 === 0) {
        ownerRevision++
        f.state.epoch = epochId(ownerRevision)
        f.changeRequest({ epoch: f.state.epoch })
        f.video.currentTime = 100
      }
      if (
        (name.startsWith('transport-') && name !== 'transport-none') ||
        name === 'two-hour-bounds'
      ) {
        const count = name === 'transport-overflow' ? 140 : name === 'transport-duplicate' ? 2 : 1
        for (let n = 0; n < count; n++) {
          const request = {
            ...f.request(),
            requestId: requestId(`completion-${second}-${name === 'transport-duplicate' ? 0 : n}`),
            startedAt: f.clock.now() - 10,
          }
          const outcome =
            name === 'transport-failure'
              ? 'failure'
              : name === 'transport-abort'
                ? 'abort'
                : 'success'
          runtime.record({
            type: 'transport-completed',
            at: f.clock.now(),
            detached: false,
            observation: {
              request,
              generation: request.generation,
              epoch: request.epoch,
              decisionId: request.decisionId,
              representation: request.representation,
              kind: 'video',
              routeType: request.routeType,
              originalHost: request.originalHost,
              targetHost: request.targetHost,
              finalHost: request.targetHost,
              responseUrlMatchesRequest: true,
              streamKey: null,
              status: outcome === 'success' ? 206 : 0,
              bytes: outcome === 'success' ? 1024 : 0,
              ttfbMs: 1,
              elapsedMs: 10,
              completedAt: f.clock.now(),
              outcome,
            },
          })
        }
      }
      sample(
        buffer,
        progress,
        profileSample?.ms ?? (name === 'sample-gap' && second === 2 ? 2000 : 1000),
        true,
        f.clock.now() -
          start +
          (profileSample?.ms ?? (name === 'sample-gap' && second === 2 ? 2000 : 1000)),
      )
    }
    const score = scoreWindow(rows, { scoreUntil: rows.at(-1)!.at, stallAt })
    const first = score.episodes[0]?.start ?? null
    if (observation) {
      const target = observation.target
      if (target.minimumLeadMs !== undefined)
        check(
          'holdout-exhaustion-lead',
          true,
          score.firstLeadMs !== null && score.firstLeadMs >= target.minimumLeadMs,
        )
      if (target.maximumCandidateMs !== undefined)
        check('holdout-normal-candidate-cap', true, score.candidateMs <= target.maximumCandidateMs)
      if (target.maximumLastLeadMs !== undefined) {
        const last = rows.filter((r) => r.candidate === true).at(-1)?.at
        check(
          'holdout-last-candidate-gap',
          true,
          last !== undefined && stallAt !== null && stallAt - last <= target.maximumLastLeadMs,
        )
      }
      if (target.requiresInsufficient)
        check(
          'holdout-gap-not-healthy',
          true,
          rows.some((r) => r.candidate === null),
        )
      if (target.maximumCycleCandidateMs !== undefined && profile?.cycleMs)
        for (let at = 0; at < rows.at(-1)!.at; at += profile.cycleMs) {
          const overlap = score.episodes.reduce(
            (sum, e) =>
              sum + Math.max(0, Math.min(e.end, at + profile.cycleMs!) - Math.max(e.start, at)),
            0,
          )
          check(`holdout-normal-cycle-${at}`, true, overlap <= target.maximumCycleCandidateMs)
        }
    }
    if (
      [
        'high-stable',
        'low-stable',
        'short-stall-5s',
        'sudden-loss',
        'pre-window-stall',
        'recovering',
        'media-end',
      ].includes(name)
    )
      check('no-candidate-control', null, first)
    const target = candidateTargets[name]
    if (target) {
      check('first-candidate', target.firstMs, first)
      if (target.leadMs !== undefined) check('lead', target.leadMs, score.firstLeadMs)
      if (target.episodes)
        check(
          'candidate-episodes',
          target.episodes,
          score.episodes.map((e) => [e.start, e.end]),
        )
      if (target.maxEpisodes !== undefined)
        check('episode-cap', true, score.episodes.length <= target.maxEpisodes)
      if (target.maxCandidateMs !== undefined)
        check('candidate-time-cap', true, score.candidateMs <= target.maxCandidateMs)
    }
    if (name.startsWith('repayment-') && profile) {
      if (!profile.fullRepayment)
        check(
          'exhaustion-lead-at-least-3s',
          true,
          score.firstLeadMs !== null && score.firstLeadMs >= 3000,
        )
      else if (profile.cycleMs !== 5000) check('full-repayment-suppressed', 0, score.candidateMs)
      else
        for (let at = 0; at < 120000; at += 5000) {
          const overlap = score.episodes.reduce(
            (sum, e) => sum + Math.max(0, Math.min(e.end, at + 5000) - Math.max(e.start, at)),
            0,
          )
          check(`full-repayment-cycle-${at}`, true, overlap <= 1000)
        }
    }
    if (name === 'drain-refill' || name.startsWith('transport-') || name === 'missing-frames')
      check('drain-candidate', 6000, first)
    if (name === 'slow-exhaustion') {
      check('first-candidate', 22000, first)
      check('lead', 18000, score.firstLeadMs)
    }
    if (name === 'fast-exhaustion') {
      check('first-candidate', 3000, first)
      check('lead', 3000, score.firstLeadMs)
    }
    if (name === 'illegal-buffer' || name === 'sample-gap')
      check(
        'invalid-window-retained',
        true,
        rows.some((r) => r.candidate === null),
      )
    if (['rate-change', 'representation-change', 'content-change', 'new-operation'].includes(name))
      check('identity-reset', null, rows[2]!.candidate)
    check('sample-cap', true, maxSamples <= 32)
    check('recorder-projection', true, projectionMatches)
    check('completion-cap', true, maxCompletions <= 128)
    check('trend-record-cap', true, maxTrendRecords <= 32)
    check('trend-byte-cap', true, maxTrendBytes <= 8192)
    check('export-cap', true, maxReportBytes <= 96 * 1024)
    if (stallAt === null && name !== 'short-stall-5s') check('no-control-effects', [], f.effects)
    const beforeClear = f.monitor.snapshot().bufferTrend
    recorder.clear()
    check('clear-does-not-reset-monitor', beforeClear, f.monitor.snapshot().bufferTrend)
    runtime.dispose()
    f.monitor.dispose()
    check('owned-timers', 0, f.clock.pendingCount)
    check('owned-subscriptions', 0, subscriptions)
    return {
      id: `${name}@${rate}x`,
      level: 'integration',
      rate,
      algorithm: 'buffer-window-v6',
      scenarioHash: sha256(JSON.stringify({ name, rate, warmupMs: 60000, inputs })),
      validity: 'valid',
      verdict: assertions.every((a) => a.verdict === 'pass') ? 'pass' : 'fail',
      reasons: [],
      warmupMs: 60000,
      prelude,
      stallAt,
      inputs,
      rows,
      score,
      assertions,
      effects: f.effects.slice(),
      bounds: { maxSamples, maxCompletions, maxTrendRecords, maxTrendBytes, maxReportBytes },
      cleanup: { timers: f.clock.pendingCount, subscriptions },
    }
  } finally {
    await f.scope.dispose()
  }
}
