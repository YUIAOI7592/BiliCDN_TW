import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assessPrefixFeasibility } from '../../scripts/buffer-shadow/prefix-feasibility.mts'
import { assessReadiness } from '../../scripts/buffer-shadow/adoption-readiness.mts'
import type { LiveSample, AdoptionFacts } from '../../scripts/buffer-shadow/live-model.mts'
import { runAdoptionPair } from '../support/buffer-adoption-pair.ts'
import { parseLiveArgs } from '../../scripts/buffer-live.mts'
import { projectDecisionPair } from '../../scripts/buffer-adoption-decision.mts'
import { auditRouteObservability } from '../../scripts/buffer-shadow/actionability.mts'
import { fixture, media } from '../support/runtime-fixture.ts'
import { FakeStorage } from '../support/storage.ts'
import { frozenCases } from '../../scripts/buffer-shadow/low-inputs.mts'

function pairRows() {
  const make = (buffers: readonly number[]) =>
    buffers.map((bufferSec, i): LiveSample => ({
      at: i * 1000,
      owner: 1,
      content: 1,
      rate: 1,
      candidate: false,
      reason: 'stable',
      bufferSec,
      currentTime: 100 + i,
      frames: 30 * i,
      qualified: true,
      rescue: false,
      automatic: true,
      alternative: null,
      quality: 'valid',
    }))
  return {
    exhaustion: make([4, 3, 2, 1, 3.25, 2.25, 1.25, 0.25, 3.25]),
    normal: make([4, 3, 2, 1, 4, 3, 2, 1, 4]),
    from: 0,
    depletionMs: 7250,
    minimumLeadMs: 3000,
  }
}
const facts = (): AdoptionFacts => ({
  windows: 12,
  combinations: 6,
  observedMs: 3600000,
  eligibleMs: 3600000,
  opportunities: 10,
  interruptions: 10,
  clipsWithInterruptions: 2,
  interruptionsByRate: [5, 5],
  matched: 8,
  warned: 7,
  timely: 8,
  actionable: 5,
  actionableRates: 2,
  normalMs: 1800000,
  unnecessary: 1,
  unknown: 0,
  integrity: true,
})

test('adoption U-F01 shared prefix and refill revocation leave no 3000ms warning opportunity', () => {
  const input = pairRows(),
    before = structuredClone(input)
  const result = assessPrefixFeasibility(input)
  assert.equal(result.validity, 'valid')
  assert.equal(result.feasible, false)
  assert.equal(result.sharedThroughMs, 3000)
  assert.equal(result.earliestAllowedMs, 5000)
  assert.equal(result.maximumLeadMs, 2250)
  assert.deepEqual(input, before)
})
test('adoption U-D01 adequate synthetic conditions cannot replace missing real events', () => {
  assert.equal(
    assessReadiness({
      real: {
        ...facts(),
        opportunities: 0,
        interruptions: 0,
        clipsWithInterruptions: 0,
        interruptionsByRate: [0, 0],
        matched: 0,
        warned: 0,
        timely: 0,
        actionable: 0,
        actionableRates: 0,
      },
      warningUtilityPassed: true,
      warningFeasible: true,
      alternative: 'known-pass',
    }).recommendation,
    'do-not-adopt-now',
  )
})
for (const [minimum, feasible] of [
  [2250, true],
  [2251, false],
  [3000, false],
] as const)
  test(`adoption U-F02 exact sampled maximum lead ${minimum}ms has feasibility=${feasible}`, () => {
    assert.equal(
      assessPrefixFeasibility({ ...pairRows(), minimumLeadMs: minimum }).feasible,
      feasible,
    )
  })
test('adoption U-F03 distinguishable decline before deadline is feasible and does not authorize action', () => {
  const input = pairRows()
  input.normal[1] = { ...input.normal[1]!, bufferSec: 4 }
  const r = assessPrefixFeasibility(input)
  assert.equal(r.feasible, true)
  assert.equal(r.earliestAllowedMs, 1000)
})
for (const mode of [
  'gap',
  'duplicate',
  'missing',
  'owner',
  'content',
  'rate',
  'null',
  'quality',
  'normal-stopped',
  'mode',
  'nan',
] as const)
  test(`adoption U-F04 ${mode} cannot support a shared-prefix impossibility claim`, () => {
    const input = pairRows()
    if (mode === 'gap') input.exhaustion[2] = { ...input.exhaustion[2]!, at: 2501 }
    if (mode === 'duplicate') input.exhaustion[2] = input.exhaustion[1]!
    if (mode === 'missing') input.normal.pop()
    if (mode === 'owner') input.normal[2] = { ...input.normal[2]!, owner: 2 }
    if (mode === 'content') input.normal[2] = { ...input.normal[2]!, content: 2 }
    if (mode === 'rate') input.normal[2] = { ...input.normal[2]!, rate: 2 }
    if (mode === 'null') input.exhaustion[2] = { ...input.exhaustion[2]!, bufferSec: null }
    if (mode === 'quality') input.exhaustion[2] = { ...input.exhaustion[2]!, quality: 'invalid' }
    if (mode === 'normal-stopped')
      input.normal[2] = { ...input.normal[2]!, currentTime: input.normal[1]!.currentTime }
    if (mode === 'mode') input.exhaustion[2] = { ...input.exhaustion[2]!, automatic: false }
    if (mode === 'nan') input.depletionMs = NaN
    assert.equal(assessPrefixFeasibility(input).validity, 'invalid')
  })
test('adoption U-F05 warmup nulls are not extrapolated into the scored interval', () => {
  const input = pairRows()
  input.exhaustion[0] = { ...input.exhaustion[0]!, bufferSec: null, candidate: null }
  input.normal[0] = { ...input.normal[0]!, bufferSec: null, candidate: null }
  assert.equal(
    assessPrefixFeasibility({ ...input, from: 1000, depletionMs: 6250 }).validity,
    'valid',
  )
})
for (const [warningFeasible, alternative] of [
  [false, 'known-pass'],
  [null, 'known-pass'],
  [true, 'unknown'],
  [true, 'known-fail'],
] as const)
  test(`adoption U-D02 warning=${warningFeasible} alternative=${alternative} stops prototype despite adequate real aggregate`, () => {
    const result = assessReadiness({
      real: facts(),
      warningUtilityPassed: true,
      warningFeasible,
      alternative,
    })
    assert.equal(result.recommendation, 'do-not-adopt-now')
    assert.equal(result.stages.prototype, 'not-executed-gate-failed')
    assert.equal(result.productActionAuthorized, false)
  })
test('adoption U-D03 only complete gates recommend a controlled prototype and never authorize release', () => {
  const input = {
      real: facts(),
      warningUtilityPassed: true,
      warningFeasible: true,
      alternative: 'known-pass' as const,
    },
    before = structuredClone(input)
  const r = assessReadiness(input)
  assert.equal(r.recommendation, 'recommend-controlled-prototype')
  assert.equal(r.stages.release, 'not-authorized-by-evaluation')
  assert.equal(r.productActionAuthorized, false)
  r.liveChecks.splice(0)
  assert.deepEqual(input, before)
})
test('adoption U-D04 invalid evidence and sufficient but unhelpful normal costs cannot be recommended', () => {
  assert.equal(
    assessReadiness({
      real: { ...facts(), unnecessary: 2 },
      warningUtilityPassed: true,
      warningFeasible: true,
      alternative: 'known-pass',
    }).underlyingLiveDecision,
    'do-not-adopt',
  )
  assert.equal(
    assessReadiness({
      real: { ...facts(), integrity: false },
      warningUtilityPassed: true,
      warningFeasible: true,
      alternative: 'known-pass',
    }).underlyingLiveDecision,
    'blocked',
  )
})
test('adoption U-C01 decision mode is exclusive and legacy option results remain unchanged', () => {
  assert.deepEqual(parseLiveArgs(['--decision', '--json']), {
    input: undefined,
    serve: false,
    json: true,
    decision: true,
  })
  for (const args of [
    ['--decision', '--supply'],
    ['--decision', '--input', 'a'],
    ['--decision', '--serve'],
    ['--decision', '--risk'],
    ['--decision', '--decision'],
  ])
    assert.throws(() => parseLiveArgs(args))
})
test('adoption U-F06 outcomes after the declared horizon cannot change the prefix bound', () => {
  const input = pairRows(),
    before = assessPrefixFeasibility(input)
  input.normal[8] = { ...input.normal[8]!, owner: 2, quality: 'invalid' }
  assert.deepEqual(assessPrefixFeasibility(input), before)
})
for (const warningUtilityPassed of [false, null] as const)
  test(`adoption U-D05 merely feasible but utility=${warningUtilityPassed} cannot recommend a prototype`, () => {
    const result = assessReadiness({
      real: facts(),
      warningFeasible: true,
      warningUtilityPassed,
      alternative: 'known-pass',
    })
    assert.equal(result.recommendation, 'do-not-adopt-now')
    assert.equal(result.productActionAuthorized, false)
  })
for (const rate of [1, 2] as const)
  test(`adoption I-F01 real Monitor Runtime Recorder paired normal stays quiet and exposes shared prefix rate=${rate}`, async (t) => {
    const pair = await runAdoptionPair(rate, t)
    assert.equal(pair.normal.firstDepletionMs, null)
    assert.equal(pair.normal.rows.filter((r) => r.candidate === true).length, 0)
    const existingNormal = frozenCases.find((c) => c.id === 'reserve-4-full4')!
    assert.equal(existingNormal.maxCandidateMs, 0)
    assert.deepEqual(
      pair.normal.rows.filter((r) => r.at > 60000 && r.at <= 68000).map((r) => r.bufferSec),
      existingNormal.profile.samples.slice(0, 8).map((s) => s.buffer),
    )
    assert.equal(pair.exhaustion.firstDepletionMs, 7250)
    assert.deepEqual(
      pair.exhaustion.events.filter((e) => e.at <= 63000),
      pair.normal.events.filter((e) => e.at <= 63000),
    )
    const result = assessPrefixFeasibility({
      exhaustion: pair.exhaustion.rows,
      normal: pair.normal.rows,
      from: 60000,
      depletionMs: 7250,
      minimumLeadMs: 3000,
    })
    assert.equal(result.validity, 'valid')
    assert.equal(result.feasible, false)
    assert.equal(result.sharedThroughMs, 3000)
    assert.equal(result.maximumLeadMs, 2250)
    assert.equal(pair.exhaustion.projectionMatches, true)
    assert.equal(pair.normal.projectionMatches, true)
    const value = {
      ...pair,
      assertions: [
        { id: 'normal-candidate-cost', expected: 0, actual: 0, pass: true },
        { id: 'projection', expected: true, actual: true, pass: true },
        { id: 'capacity', expected: true, actual: true, pass: true },
        { id: 'minimum-warning', expected: 3000, actual: pair.exhaustion.firstLeadMs, pass: false },
      ],
    }
    const projected = projectDecisionPair(value, rate)
    assert.equal(projected?.verdict, 'fail')
    assert.equal(
      projectDecisionPair(
        { ...value, exhaustion: { ...value.exhaustion, firstLeadMs: 3000 } },
        rate,
      ),
      null,
    )
    const extras = projectDecisionPair(
      { ...value, token: 'secret', normal: { ...value.normal, core: {} } },
      rate,
    )
    assert.equal(JSON.stringify(extras).includes('secret'), false)
    assert.equal(JSON.stringify(extras).includes('"core"'), false)
  })
for (const rate of [1, 2] as const)
  test(`adoption I-O01 paired observer changes no routes SDK storage or rescue effects rate=${rate}`, async (t) => {
    const before = await runAdoptionPair(rate, t, false),
      after = await runAdoptionPair(rate, t)
    assert.equal(before.exhaustion.effectsHash, after.exhaustion.effectsHash)
    assert.equal(before.normal.effectsHash, after.normal.effectsHash)
    assert.deepEqual(after.exhaustion.cleanup, {
      observer: { timers: 0, subscriptions: 0, listeners: 0 },
      exitListeners: 0,
      timers: 0,
      storageListeners: 0,
    })
  })
test('adoption I-A01 actual public RouteSnapshot exposes cached ranking but no fresh predispatch qualification', async (t) => {
  const storage = new FakeStorage(),
    f = fixture(t, storage)
  try {
    const source = media(552)
    f.playurl.transform(source)
    for (let i = 0; i < 2; i++) {
      f.request(source.data.dash.video[0]!.base_url)
      const r = f.routes.latestRequested('video')!
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
        bytes: 100000,
        ttfbMs: 1,
        elapsedMs: 1000,
        completedAt: f.clock.now(),
        outcome: 'success',
      })
    }
    const before = f.routes.snapshot(),
      calls = structuredClone(f.calls),
      values = structuredClone([...storage.values])
    const audit = auditRouteObservability(before)
    assert.equal(audit.requestIdentity, 'observed')
    assert.equal(audit.cachedRanking, 'observed')
    assert.equal(audit.beforeDispatch, 'unknown')
    assert.equal(audit.freshAlternativeSuccesses, 'unknown')
    assert.equal(audit.currentProhibitions, 'unknown')
    assert.equal(audit.currentAlternativeAuthority, 'unknown')
    assert.equal(audit.alternativeQualification, 'unknown')
    assert.equal(audit.productActionAuthorized, false)
    assert.deepEqual(f.routes.snapshot(), before)
    assert.deepEqual(f.calls, calls)
    assert.deepEqual([...storage.values], values)
  } finally {
    f.lifecycle.dispose()
    f.runtime.dispose()
    f.deps.monitor.dispose()
    f.recovery.dispose()
    f.settings.dispose()
    f.deps.restrictions.dispose()
    f.deps.evidence.dispose()
    assert.equal(f.clock.pendingCount, 0)
    assert.equal(
      [...storage.listeners.values()].reduce((sum, listeners) => sum + listeners.size, 0),
      0,
    )
    await f.scope.dispose()
  }
})
