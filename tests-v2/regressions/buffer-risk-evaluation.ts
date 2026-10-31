import { test } from 'node:test'
import assert from 'node:assert/strict'
import { measureRiskCoverage } from '../../scripts/evaluation/buffer-shadow/risk-coverage.mts'
import {
  createSupply,
  advanceSupply,
} from '../../scripts/evaluation/buffer-shadow/supply-model.mts'
import type { LiveSample } from '../../scripts/evaluation/buffer-shadow/live-model.mts'
import { runRiskScenario } from '../support/buffer-risk-scenario.ts'
import { riskScenario } from '../../scripts/evaluation/buffer-shadow/risk-inputs.mts'
import {
  assessOpportunity,
  auditRouteObservability,
} from '../../scripts/evaluation/buffer-shadow/actionability.mts'
import type { OpportunityProbe } from '../../scripts/evaluation/buffer-shadow/actionability.mts'
import {
  analyzeLiveRisk,
  parseLiveArgs,
  replayLiveEvidence,
} from '../../scripts/evaluation/buffer-live.mts'
import { validSupplyResult } from '../../scripts/evaluation/buffer-risk-evaluation.mts'
import { createHash } from 'node:crypto'

const row = (
  at: number,
  bufferSec: number | null,
  patch: Partial<LiveSample> = {},
): LiveSample => ({
  at,
  owner: 1,
  content: 1,
  rate: 1,
  candidate: false,
  reason: 'stable',
  bufferSec,
  currentTime: 100 + at / 1000,
  frames: Math.floor(at / 10),
  qualified: true,
  rescue: false,
  automatic: true,
  alternative: null,
  quality: 'valid',
  ...patch,
})

test('risk U-C01 distinguishes complete high-buffer observation from low-buffer exposure', () => {
  const result = measureRiskCoverage([row(0, 12), row(1000, 12)], { from: 0, until: 1000 })
  assert.equal(result.bands.above10, 1000)
  assert.equal(result.bands.oneTo4, 0)
  assert.equal(result.progressMs, 1000)
  assert.equal(result.riskExposure, 'not-exposed')
})

for (const rate of [1, 2] as const)
  test(`risk U-S01 supply completion, consumption and stall are independent of SDK rate=${rate}`, () => {
    const initial = createSupply(1, rate)
    const result = advanceSupply(initial, 2000, rate, [
      { at: 1500, segment: 0, bytes: 100, mediaMs: 1000 * rate, outcome: 'success' },
    ])
    assert.equal(result.positionMs, 100000 + 1500 * rate)
    assert.equal(result.bufferMs, 500 * rate)
    assert.equal(result.stalledMs, 500)
    assert.equal(result.acceptedBytes, 100)
    assert.deepEqual(initial, createSupply(1, rate))
  })

for (const [buffer, band] of [
  [0, 'zero'],
  [1, 'zeroTo1'],
  [4, 'oneTo4'],
  [10, 'fourTo10'],
  [10.000001, 'above10'],
] as const)
  test(`risk U-C02 exact buffer boundary ${buffer} seconds belongs to ${band}`, () => {
    const rows = [row(0, buffer), row(1000, buffer)],
      before = structuredClone(rows)
    assert.equal(measureRiskCoverage(rows, { from: 250, until: 750 }).bands[band], 500)
    assert.deepEqual(rows, before)
  })

for (const mode of [
  'gap',
  'owner',
  'content',
  'rate',
  'quality',
  'null',
  'paused',
  'rescue',
] as const)
  test(`risk U-C03 ${mode} is not counted as healthy exposure`, () => {
    const rows = [
      row(
        0,
        mode === 'null' ? null : 2,
        mode === 'null'
          ? { candidate: null, reason: 'warming-up' }
          : mode === 'rescue'
            ? { rescue: true }
            : {},
      ),
      row(
        mode === 'gap' ? 1501 : 1000,
        2,
        mode === 'owner'
          ? { owner: 2 }
          : mode === 'content'
            ? { content: 2 }
            : mode === 'rate'
              ? { rate: 2 }
              : mode === 'quality'
                ? { quality: 'invalid' }
                : mode === 'paused'
                  ? { qualified: false }
                  : {},
      ),
    ]
    const x = measureRiskCoverage(rows, { from: 0, until: rows[1]!.at })
    assert.equal(x.bands.oneTo4, 0)
    assert.equal(x.missingMs + x.insufficientMs + x.ineligibleMs, rows[1]!.at)
  })

test('risk U-C04 no extrapolation, duplicate time rejected, 1500ms interval accepted', () => {
  assert.equal(
    measureRiskCoverage([row(1000, 2), row(2500, 2)], { from: 0, until: 3000 }).missingMs,
    1500,
  )
  assert.equal(
    measureRiskCoverage([row(1000, 2), row(2500, 2)], { from: 0, until: 3000 }).bands.oneTo4,
    1500,
  )
  assert.throws(() => measureRiskCoverage([row(0, 2), row(0, 2)], { from: 0, until: 1000 }))
  assert.throws(() => measureRiskCoverage([row(0, NaN)], { from: 0, until: 1000 }))
})

for (const outcome of ['failure', 'abort', 'success'] as const)
  test(`risk U-S02 ${outcome} with zero bytes does not supply media`, () => {
    const x = advanceSupply(createSupply(0, 1), 1000, 1, [
      { at: 500, segment: 0, bytes: 0, mediaMs: 1000, outcome },
    ])
    assert.equal(x.bufferMs, 0)
    assert.equal(x.positionMs, 100000)
    assert.equal(x.stalledMs, 1000)
  })

test('risk U-S03 reordered and duplicate segments are appended once and in order', () => {
  const c = { at: 0, segment: 1, bytes: 100, mediaMs: 1000, outcome: 'success' as const }
  const first = advanceSupply(createSupply(0, 1), 0, 1, [c, c])
  assert.equal(first.bufferMs, 0)
  assert.equal(first.pending.length, 1)
  const second = advanceSupply(first, 0, 1, [{ ...c, segment: 0 }, c])
  assert.equal(second.bufferMs, 2000)
  assert.equal(second.acceptedBytes, 200)
  assert.equal(first.pending.length, 1)
})

test('risk U-S04 paused playback consumes no supply and does not create a stall', () => {
  const x = advanceSupply(createSupply(3, 2), 5000, 2, [], true)
  assert.equal(x.bufferMs, 6000)
  assert.equal(x.stalledMs, 0)
  assert.equal(x.positionMs, 100000)
})

test('risk U-S05 two-hour sequential supply retains no completion index', () => {
  let s = createSupply(3, 2)
  for (let i = 1; i <= 7200; i++)
    s = advanceSupply(s, i * 1000, 2, [
      { at: i * 1000, segment: i - 1, bytes: 100, mediaMs: 2000, outcome: 'success' },
    ])
  assert.equal(s.pending.length, 0)
  assert.equal(s.nextSegment, 7200)
  assert.equal(s.bufferMs, 6000)
  assert.throws(() =>
    advanceSupply(
      s,
      s.at + 1,
      2,
      Array.from({ length: 129 }, (_, i) => ({
        at: s.at,
        segment: s.nextSegment + 1 + i,
        bytes: 100,
        mediaMs: 1000,
        outcome: 'success' as const,
      })),
    ),
  )
})

for (const rate of [1, 2] as const)
  test(`risk U-S06 discrete 0.8s supply has 0.8s left at 56s and first starves at 56.8s rate=${rate}`, () => {
    let state = createSupply(12, rate)
    for (let i = 1; i <= 56; i++)
      state = advanceSupply(state, i * 1000, rate, [
        { at: i * 1000, segment: i - 1, bytes: 100, mediaMs: 800 * rate, outcome: 'success' },
      ])
    assert.equal(state.stalledMs, 0)
    assert.equal(state.bufferMs, 800 * rate)
    assert.equal(advanceSupply(state, 56800, rate, []).stalledMs, 0)
    assert.equal(advanceSupply(state, 56801, rate, []).stalledMs, 1)
    assert.equal(riskScenario('slow-deficit', rate).firstDepletionMs, 56800)
  })

const opportunity = (): OpportunityProbe => ({
  level: 'synthetic',
  sample: row(60000, 3, { candidate: true, reason: 'low-buffer-steady' }),
  request: { at: 61500, owner: 1, kind: 'video', phase: 'before-dispatch' },
  evidence: {
    at: 60000,
    owner: 1,
    content: 1,
    rate: 1,
    catalogLegal: true,
    restrictionsClear: true,
    authorityCurrent: true,
    successTimes: [0, 60000],
    demandRatio: 1.35,
  },
})

test('risk U-A01 exact readonly bounds match only the supplied model and never authorize action', () => {
  const input = opportunity(),
    before = structuredClone(input),
    result = assessOpportunity(input)
  assert.equal(result.status, 'known-pass')
  assert.equal(result.productActionAuthorized, false)
  assert.deepEqual(input, before)
})

for (const mode of [
  'no-alternative',
  'post-dispatch',
  'old-success',
  'future-success',
  'wrong-owner',
  'missing-authority',
] as const)
  test(`risk U-A02 ${mode} remains unknown`, () => {
    const v = opportunity()
    const changed =
      mode === 'no-alternative'
        ? { ...v, evidence: null }
        : mode === 'post-dispatch'
          ? { ...v, request: { ...v.request!, phase: 'started' as const } }
          : {
              ...v,
              evidence: {
                ...v.evidence!,
                ...(mode === 'old-success'
                  ? { successTimes: [0, -1] }
                  : mode === 'future-success'
                    ? { successTimes: [0, 60001] }
                    : mode === 'wrong-owner'
                      ? { owner: 2 }
                      : { authorityCurrent: null }),
              },
            }
    assert.equal(assessOpportunity(changed).status, 'unknown')
  })

for (const mode of ['audio', 'late', 'ratio', 'forbidden', 'tail', 'duplicate-success'] as const)
  test(`risk U-A03 known ${mode} is not an actionable observation`, () => {
    const v = opportunity()
    const changed =
      mode === 'audio'
        ? { ...v, request: { ...v.request!, kind: 'audio' as const } }
        : mode === 'late'
          ? { ...v, request: { ...v.request!, at: 61501 } }
          : mode === 'tail'
            ? { ...v, sample: row(60000, 1, { candidate: true, reason: 'low-buffer-tail' }) }
            : {
                ...v,
                evidence: {
                  ...v.evidence!,
                  ...(mode === 'ratio'
                    ? { demandRatio: 1.349999 }
                    : mode === 'forbidden'
                      ? { restrictionsClear: false }
                      : { successTimes: [60000, 60000] }),
                },
              }
    assert.equal(assessOpportunity(changed).status, 'known-fail')
  })

test('risk U-A04 cached ranking and extra authorization fields cannot fill missing evidence', () => {
  const a = auditRouteObservability({
    activePlan: { ranking: [{ eligible: true, ratio: 100, token: 'sensitive' }] },
    freshAlternativeSuccesses: true,
    authorityCurrent: true,
  })
  assert.equal(a.cachedRanking, 'observed')
  assert.equal(a.alternativeQualification, 'unknown')
  assert.equal(JSON.stringify(a).includes('sensitive'), false)
})

test('risk U-D01 risk analysis preserves the original decision and never reinterprets candidate', () => {
  const windows = ['BV1tFZZBQE57', 'BV17CDwBbE6R', 'BV17z4y1p733'].flatMap((clip, c) =>
    ([1, 2] as const).flatMap((rate) =>
      ([1, 2] as const).map((repeat) => ({
        id: `case-${c}-${rate}-${repeat}`,
        clip,
        part: 1,
        rate,
        repeat,
        validity: 'valid' as const,
        reason: 'complete' as const,
        scoreFrom: 60000,
        rows: Array.from({ length: 427 }, (_, i) => row(i * 1000, 12, { rate })),
        events: [],
        clean: true,
      })),
    ),
  )
  const input = {
    schemaVersion: 1,
    baseline: 'd0c2c8c3dcc61e6db76531d560dfbc2a12d7fd98',
    source: {
      version: '2.1.35',
      bytes: 422022,
      sha256: '7458f27610a0b2a9f13e07c1e087502198809dacb2a411f5112acf9aaf3b9cc3',
    },
    windows,
  }
  const before = structuredClone(input),
    old = replayLiveEvidence(input),
    result = analyzeLiveRisk(input)
  assert.deepEqual(result.original, old)
  assert.deepEqual(input, before)
  assert.equal(result.coverage.totals.above10, 3600000)
  assert.equal(result.coverage.utilityCoverage, 'not-exposed-to-actionable-buffer')
  assert.equal(result.coverage.alternativeObservability.alternativeQualification, 'unknown')
  assert.equal(result.original.adoption.decision, 'insufficient')
})

test('risk U-D02 CLI modes are exclusive and legacy options keep their shape', () => {
  assert.deepEqual(parseLiveArgs(['--input', 'data.json']), {
    input: 'data.json',
    serve: false,
    json: false,
  })
  assert.equal(parseLiveArgs(['--input', 'data.json', '--risk']).risk, true)
  assert.equal(parseLiveArgs(['--supply', '--json']).supply, true)
  for (const args of [
    ['--risk'],
    ['--supply', '--serve'],
    ['--supply', '--risk'],
    ['--input', 'data.json', '--supply'],
    ['--risk', '--risk', '--input', 'x'],
  ])
    assert.throws(() => parseLiveArgs(args))
})

test('risk U-D03 worker protocol preserves red utility and rejects sensitive or inconsistent output', () => {
  const input = riskScenario('low-partial-cycle', 1)
  const value = {
    schemaVersion: 1,
    scenario: input.name,
    rate: 1,
    level: 'synthetic-integration',
    sourceAlgorithm: 'buffer-window-v6',
    scenarioHash: createHash('sha256').update(JSON.stringify(input)).digest('hex'),
    validity: 'valid',
    verdict: 'fail',
    productActionAuthorized: false,
    rows: Array.from({ length: 180 }, (_, i) => row(i * 1000, 3)),
    events: [],
    assertions: [{ id: 'minimum-warning', pass: false }],
    cleanup: { timers: 0, exitListeners: 0, storageListeners: 0 },
  }
  assert.equal(validSupplyResult(value, input.name, 1), true)
  assert.equal(validSupplyResult({ ...value, verdict: 'pass' }, input.name, 1), false)
  assert.equal(validSupplyResult({ ...value, token: 'private' }, input.name, 1), false)
  assert.equal(
    validSupplyResult(
      {
        ...value,
        rows: [{ ...value.rows[0], url: 'https://private.invalid/' }, ...value.rows.slice(1)],
      },
      input.name,
      1,
    ),
    false,
  )
})

for (const rate of [1, 2] as const)
  test(
    `risk I-O01 observer has no effect on real routes recovery storage or SDK rate=${rate}`,
    { timeout: 5000 },
    async (t) => {
      const input = riskScenario('partial-cycle', rate)
      const before = await runRiskScenario(input, false, t),
        after = await runRiskScenario(input, true, t)
      assert.deepEqual(after.effects, before.effects)
      assert.equal(after.projectionMatches, true)
      assert.ok(after.rows.some((r) => r.candidate === true))
      assert.ok(after.rows.some((r) => r.candidate === null))
      assert.ok(
        after.bounds.maxSamples <= 32 &&
          after.bounds.maxTrendRecords <= 32 &&
          after.bounds.maxTrendBytes <= 8192,
      )
      assert.equal(after.firstDepletionMs, input.firstDepletionMs)
    },
  )

for (const rate of [1, 2] as const)
  test(
    `risk I-O02 content replacement cannot join old coverage rate=${rate}`,
    { timeout: 5000 },
    async (t) => {
      const result = await runRiskScenario(riskScenario('high-stable', rate), true, t, 5000)
      assert.ok(new Set(result.rows.map((r) => r.owner)).size > 1)
      assert.ok(measureRiskCoverage(result.rows, { from: 0, until: 180000 }).missingMs > 0)
    },
  )

for (const rate of [1, 2] as const)
  test(
    `risk I-N01 real Monitor Runtime Recorder receive supply-driven progress rate=${rate}`,
    { timeout: 5000 },
    async (t) => {
      const result = await runRiskScenario(riskScenario('high-stable', rate), true, t)
      assert.equal(result.firstDepletionMs, null)
      assert.equal(result.balances.at(-1)!.positionMs, 100000 + 180000 * rate)
      assert.equal(result.rows.length, 180)
      assert.ok(result.rows.every((r) => r.candidate !== true))
      assert.equal(result.projectionMatches, true)
      assert.equal(result.cleanup.timers, 0)
    },
  )
