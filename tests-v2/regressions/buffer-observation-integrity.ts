import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { installedCollector } from '../../scripts/buffer-shadow/browser-collector.mts'
import { validEvaluationResult } from '../../scripts/buffer-shadow-evaluation.mts'
import {
  scoreWindow,
  candidateContinuity,
  parseEvaluationArgs,
} from '../../scripts/buffer-shadow/model.mts'
import type { EvidenceRow } from '../../scripts/buffer-shadow/model.mts'
import { runScenario } from '../support/buffer-shadow-scenarios.ts'
import { FakeClock } from '../support/clock.ts'
import { testScope } from '../support/scope.ts'
import {
  observationNames,
  observationInput,
} from '../../scripts/buffer-shadow/observation-inputs.mts'

test('U-E07 independent holdout inputs are immutable and declare utility gates before execution', () => {
  for (const name of observationNames) {
    const input = observationInput(name)
    assert.ok(Object.isFrozen(input.profile.samples))
    assert.equal(input.profile.samples.length, 120)
    assert.deepEqual(input, observationInput(name))
    assert.ok(Object.keys(input.target).length)
    assert.throws(() => Object.assign(input.target, { minimumLeadMs: 0 }), TypeError)
  }
  assert.deepEqual(parseEvaluationArgs(['--holdout', '--json']), {
    cost: false,
    json: true,
    holdout: true,
  })
  for (const flag of ['--cost', '--cost-v3', '--cost-source'])
    assert.throws(() => parseEvaluationArgs(['--holdout', flag]))
})

for (const rate of [1, 2] as const)
  test(`I-E08 product outputs with the same prefix cannot depend on future refill rate=${rate}`, async (t) => {
    const normal = await runScenario(
      'observation-holdout',
      rate,
      t,
      observationInput('prefix-normal'),
    )
    const exhaustion = await runScenario(
      'observation-holdout',
      rate,
      t,
      observationInput('prefix-exhaustion'),
    )
    assert.equal(validEvaluationResult(normal, false), true)
    assert.equal(validEvaluationResult(exhaustion, false), true)
    assert.deepEqual(normal.inputs.slice(0, 9), exhaustion.inputs.slice(0, 9))
    assert.deepEqual(normal.rows.slice(0, 9), exhaustion.rows.slice(0, 9))
    assert.equal(normal.cleanup.timers, 0)
    assert.equal(exhaustion.cleanup.subscriptions, 0)
    const red = structuredClone(normal) as unknown as {
      verdict: string
      assertions: { id: string; actual: unknown; expected: unknown; verdict: string }[]
    }
    red.assertions.push({
      id: 'deliberate negative evaluator control',
      expected: true,
      actual: false,
      verdict: 'fail',
    })
    red.verdict = 'fail'
    assert.equal(validEvaluationResult(red, false), true)
    red.verdict = 'pass'
    assert.equal(validEvaluationResult(red, false), false)
  })

for (const rate of [1, 2] as const)
  for (const fault of ['candidate', 'state', 'reason', 'assertion'] as const)
    test(`I-E04 rejects inconsistent ${fault} worker evidence rate=${rate}`, async (t) => {
      const result = structuredClone(await runScenario('drain-refill', rate, t))
      const data = result as unknown as {
        rows: { candidate: boolean | null; state: string; reason: string }[]
        assertions: { actual: unknown }[]
      }
      if (fault === 'candidate') data.rows[6]!.candidate = false
      if (fault === 'state') data.rows[6]!.state = 'stable'
      if (fault === 'reason') data.rows[6]!.reason = 'different'
      if (fault === 'assertion') data.assertions[0]!.actual = 'contradictory-evidence'
      assert.equal(validEvaluationResult(result, false), false)
    })

for (const mode of ['stale', 'future', 'owner-change', 'sensitive-extra'] as const)
  test(`U-E03 collector isolates ${mode} without stale attribution or leaked fields`, async (t) => {
    const clock = testScope(t).own(new FakeClock())
    clock.advance(10000)
    const timers = new Map<number, () => void>()
    let serial = 0
    let userRevision = 1
    const video = {
      currentTime: 100,
      playbackRate: 1,
      paused: false,
      seeking: false,
      ended: false,
      error: null,
      videoWidth: 1920,
      videoHeight: 1080,
      getVideoPlaybackQuality: () => ({ totalVideoFrames: 30 }),
    }
    const trend = {
      schemaVersion: 3,
      algorithm: 'buffer-window-v3',
      at: 0,
      from: -8000,
      spanMs: 8000,
      sampleCount: 9,
      interpolated: false,
      progressQuality: 'frames',
      state: 'draining',
      reason: 'draining-low',
      candidate: true,
      rate: 1,
      startBufferSec: 12,
      endBufferSec: 8,
      deltaSec: -4,
      slopeSecPerSec: -0.5,
      transport: {
        coverage: 'none-observed',
        successes: 0,
        failures: 0,
        aborts: 0,
        completedBytes: 0,
        crossWindow: 0,
        dropped: 0,
      },
      secretUrl: 'https://sensitive.invalid/token',
    }
    const collect = runInNewContext('(' + installedCollector + ')', {
      performance: { now: clock.now },
      Date: { now: clock.now },
      document: { querySelector: (s: string) => (s === 'video' ? video : { textContent: 'Auto' }) },
      setTimeout(callback: () => void, ms: number) {
        const id = ++serial
        timers.set(
          id,
          clock.timeout(() => {
            timers.delete(id)
            callback()
          }, ms),
        )
        return id
      },
      clearTimeout(id: number) {
        timers.get(id)?.()
        timers.delete(id)
      },
    }) as (
      this: unknown,
      ms: number,
      rate: number,
    ) => Promise<{
      rows: { candidate: boolean | null; sampleQuality?: string }[]
    }>
    const task = collect.call(
      {
        monitor: {
          snapshot() {
            if (mode === 'owner-change') userRevision++
            const at = clock.now() + (mode === 'future' ? 1000 : mode === 'stale' ? -2000 : 0)
            return { video, bufferTrend: { ...trend, at, from: at - 8000 } }
          },
        },
        player: { controls: () => ({ mediaId: 1, coreId: 1, userRevision }) },
        session: { get: () => ({ generation: 1, epoch: 1 }) },
        routes: { latestRequested: () => null },
        recovery: { isRecovering: () => false, snapshot: () => ({ state: 'healthy' }) },
        diagnostics: { buildReport: () => '{}' },
      },
      2000,
      1,
    )
    for (let i = 0; i < 2; i++) {
      clock.advance(1000)
      for (let j = 0; j < 10; j++) await Promise.resolve()
    }
    const result = await task
    if (mode === 'sensitive-extra')
      assert.equal(JSON.stringify(result).includes('sensitive.invalid'), false)
    else
      assert.equal(
        result.rows.every((r) => r.candidate === null),
        true,
      )
    assert.equal(timers.size, 0)
    assert.equal(clock.pendingCount, 0)
  })

for (const rate of [1, 2] as const)
  test(`U-E01 same-prefix scores cannot depend on future exhaustion rate=${rate}`, () => {
    const rows: EvidenceRow[] = Array.from({ length: 9 }, (_, i) => ({
      seq: i + 1,
      at: i * 1000,
      owner: 'owner-1',
      candidate: i >= 4,
      state: 'draining',
      reason: 'draining-low',
      currentTime: 100 + i * rate,
      frames: 30 * i,
      qualified: true,
      rate,
    }))
    const normal = scoreWindow(rows, { scoreUntil: 8000, stallAt: null })
    const exhaustion = scoreWindow(rows, { scoreUntil: 8000, stallAt: 18000 })
    assert.deepEqual(
      normal.episodes.map((e) => e.evidence),
      exhaustion.episodes.map((e) => e.evidence),
    )
    assert.equal(normal.candidateMs, exhaustion.candidateMs)
    assert.equal(exhaustion.firstLeadMs, 14000)
  })

test('U-E02 separates fifteen-second continuation from later annotated exhaustion', () => {
  const rows: EvidenceRow[] = Array.from({ length: 21 }, (_, i) => ({
    seq: i + 1,
    at: i * 1000,
    owner: 'owner-1',
    candidate: i === 0 || i === 3,
    state: 'draining',
    reason: 'draining-low',
    currentTime: 100 + i,
    frames: 30 * i,
    qualified: true,
    rate: 1,
  }))
  const before = structuredClone(rows)
  assert.equal(
    scoreWindow(rows.slice(0, 15), { scoreUntil: 0, stallAt: 18000 }).episodes[0]!.followup,
    'undetermined',
  )
  const score = scoreWindow(rows, { scoreUntil: 5000, stallAt: 18000 })
  assert.equal(score.episodes[0]!.followup, 'continued')
  assert.deepEqual(candidateContinuity(rows, { scoreUntil: 5000, stallAt: 18000 }), {
    firstLeadMs: 18000,
    lastCandidateLeadMs: 15000,
    candidateGapsMs: [2000],
    externallyAnnotatedStallAt: 18000,
  })
  assert.deepEqual(rows, before)
})

test('U-C01 explicit cost comparisons preserve legacy CLI and reject ambiguous selection', () => {
  assert.deepEqual(parseEvaluationArgs(['--cost']), { json: false, cost: true })
  assert.deepEqual(parseEvaluationArgs(['--cost-v3', '--json']), {
    json: true,
    cost: true,
    comparison: 'v3',
  })
  assert.deepEqual(parseEvaluationArgs(['--cost-source']), {
    json: false,
    cost: true,
    comparison: 'source',
  })
  for (const args of [
    ['--cost', '--cost-v3'],
    ['--cost-v3', '--cost-source'],
    ['--cost-source', '--cost-source'],
  ])
    assert.throws(() => parseEvaluationArgs(args))
})
