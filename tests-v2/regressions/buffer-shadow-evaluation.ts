import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scoreWindow, parseEvaluationArgs } from '../../scripts/buffer-shadow/model.mts'
import type { EvidenceRow } from '../../scripts/buffer-shadow/model.mts'
import { scenarioNames } from '../../scripts/buffer-shadow/model.mts'
import { runScenario } from '../support/buffer-shadow-scenarios.ts'
import { validEvaluationResult } from '../../scripts/buffer-shadow-evaluation.mts'
import { runInNewContext } from 'node:vm'
import { installedCollector } from '../../scripts/buffer-shadow/browser-collector.mts'
import { FakeClock } from '../support/clock.ts'
import { testScope } from '../support/scope.ts'
import { fixture as fullRuntime, media } from '../support/runtime-fixture.ts'
import { FakeStorage } from '../support/storage.ts'

const row = (
  at: number,
  candidate: boolean | null,
  patch: Partial<EvidenceRow> = {},
): EvidenceRow => ({
  seq: at / 1000 + 1,
  at,
  owner: 'owner-1',
  candidate,
  state: candidate === null ? 'insufficient' : 'draining',
  reason: 'fixture',
  currentTime: 100 + at / 1000,
  frames: (at / 1000) * 30,
  qualified: true,
  rate: 1,
  ...patch,
})

test('shadow evaluator merges episodes and records false endings without mutating input', () => {
  const rows = [row(0, false), row(1000, true), row(2000, true), row(3000, false)]
  const before = structuredClone(rows)
  const result = scoreWindow(rows, { scoreUntil: 3000, stallAt: 5000 })
  assert.deepEqual(
    result.episodes.map((e) => [e.start, e.end, e.censored]),
    [[1000, 3000, false]],
  )
  assert.equal(result.firstLeadMs, 4000)
  assert.equal(result.candidateMs, 2000)
  assert.deepEqual(rows, before)
})

for (const kind of ['null', 'gap', 'owner'] as const)
  test(`shadow evaluator censors on ${kind} instead of claiming healthy continuation`, () => {
    const rows = [
      row(0, true),
      row(
        kind === 'gap' ? 2000 : 1000,
        kind === 'null' ? null : true,
        kind === 'owner' ? { owner: 'owner-2' } : {},
      ),
    ]
    const result = scoreWindow(rows, { scoreUntil: 2000, stallAt: null })
    assert.equal(result.episodes[0]!.censored, true)
    if (kind === 'null') assert.equal(result.episodes[0]!.end, 1000)
    assert.equal(result.episodes[0]!.followup, 'undetermined')
  })

test('shadow evaluator accepts exactly fifteen seconds and detects two-second interruption', () => {
  const rows = Array.from({ length: 16 }, (_, i) =>
    row(i * 1000, i === 0, { currentTime: i < 4 ? 100 + i : 103, frames: i < 4 ? i * 30 : 90 }),
  )
  assert.equal(
    scoreWindow(rows, { scoreUntil: 0, stallAt: 4000 }).episodes[0]!.followup,
    'interrupted',
  )
  const healthy = rows.map((r, i) => ({ ...r, currentTime: 100 + i, frames: i * 30 }))
  assert.equal(
    scoreWindow(healthy, { scoreUntil: 0, stallAt: null }).episodes[0]!.followup,
    'continued',
  )
  assert.equal(
    scoreWindow(healthy.slice(0, 15), { scoreUntil: 0, stallAt: null }).episodes[0]!.followup,
    'undetermined',
  )
})

for (const kind of [
  'duplicate',
  'reversed',
  'nan',
  'missing',
  'rate',
  'state',
  'quality',
  'sensitive-owner',
] as const)
  test(`shadow evaluator rejects invalid ${kind} evidence`, () => {
    const rows = [row(0, false), row(1000, true)]
    if (kind === 'duplicate') rows[1] = row(0, true)
    if (kind === 'reversed') rows[1] = row(-1, true)
    if (kind === 'nan') rows[1] = row(NaN, true)
    if (kind === 'missing') rows[1] = row(1000, true, { owner: '' })
    if (kind === 'rate') rows[1] = row(1000, true, { rate: NaN })
    if (kind === 'state') rows[1] = row(1000, true, { state: 'insufficient' })
    if (kind === 'quality')
      rows[1] = row(1000, true, { qualified: undefined as unknown as boolean })
    if (kind === 'sensitive-owner')
      rows[1] = row(1000, true, { owner: 'https://example.invalid/token' })
    assert.throws(() => scoreWindow(rows, { scoreUntil: 1000, stallAt: null }), /Invalid evidence/)
  })

test('shadow evaluator validates CLI independently of execution', () => {
  assert.deepEqual(parseEvaluationArgs(['--json', '--cost']), { json: true, cost: true })
  for (const args of [['--bad'], ['--json', '--json'], ['case']])
    assert.throws(() => parseEvaluationArgs(args))
})

for (const rate of [1, 2] as const)
  for (const name of scenarioNames)
    test(
      `shadow evaluation integration ${name} after healthy 60s rate=${rate}`,
      { timeout: 5000 },
      async (t) => {
        const result = await runScenario(name, rate, t)
        for (const a of result.assertions)
          assert.equal(a.verdict, 'pass', `${a.id}: ${JSON.stringify(a.actual)}`)
        assert.equal(validEvaluationResult(result, false), true)
      },
    )

for (const rate of [1, 2] as const)
  test(
    `shadow transport evidence does not change candidate trajectory rate=${rate}`,
    { timeout: 5000 },
    async (t) => {
      const baseline = await runScenario('transport-none', rate, t)
      for (const name of [
        'transport-success',
        'transport-failure',
        'transport-abort',
        'transport-duplicate',
        'transport-overflow',
      ] as const) {
        const result = await runScenario(name, rate, t)
        assert.deepEqual(
          result.rows.map((r) => r.candidate),
          baseline.rows.map((r) => r.candidate),
        )
      }
    },
  )

test('shadow evaluator rejects malformed worker reports', () => {
  for (const value of [null, {}, { validity: 'valid', verdict: 'pass' }])
    assert.equal(validEvaluationResult(value, false), false)
})

for (const fail of [false, true])
  test(
    `installed read-only collector owns a fully awaited 50s task read-error=${fail}`,
    { timeout: 5000 },
    async (t) => {
      const clock = testScope(t).own(new FakeClock())
      const timers = new Map<number, () => void>()
      let serial = 0,
        reads = 0
      const video = {
        currentTime: 100,
        playbackRate: 1,
        paused: false,
        seeking: false,
        ended: false,
        error: null,
        videoWidth: 1920,
        videoHeight: 1080,
        getVideoPlaybackQuality: () => ({ totalVideoFrames: reads * 30 }),
      }
      const fn = runInNewContext('(' + installedCollector + ')', {
        performance: { now: clock.now },
        Date: { now: clock.now },
        document: {
          querySelector: (s: string) => (s === 'video' ? video : { textContent: '自动' }),
        },
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
      ) => Promise<{ rows: unknown[]; executionMs: number; cleanup: { timers: number } }>
      const task = fn.call(
        {
          monitor: {
            snapshot() {
              if (fail && ++reads === 3) throw Error('read rejected')
              if (!fail) reads++
              return { video, bufferTrend: null }
            },
          },
          player: { controls: () => ({ mediaId: 1 }) },
          session: { get: () => ({ generation: 1, epoch: 1 }) },
          routes: { latestRequested: () => null },
          recovery: { isRecovering: () => false, snapshot: () => ({ state: 'healthy' }) },
          diagnostics: { buildReport: () => '{}' },
        },
        50000,
        1,
      )
      const observed = task.then(
        (value) => ({ value, error: null }),
        (error) => ({ value: null, error }),
      )
      for (let i = 0; i < 50; i++) {
        clock.advance(1000)
        for (let j = 0; j < 8; j++) await Promise.resolve()
      }
      const result = await observed
      if (fail) assert.match(String(result.error), /read rejected/)
      else {
        assert.equal(result.value!.rows.length, 51)
        assert.equal(result.value!.executionMs, 50000)
        assert.equal(result.value!.cleanup.timers, 0)
      }
      assert.equal(timers.size, 0)
      assert.equal(clock.pendingCount, 0)
    },
  )

for (const rate of [1, 2] as const)
  test(
    `warmed real Routes Recovery Runtime Recorder keep decision and side effects rate=${rate}`,
    { timeout: 5000 },
    async (t) => {
      class CountingStorage extends FakeStorage {
        writes = 0
        override set<T>(key: string, value: T) {
          this.writes++
          super.set(key, value)
        }
      }
      const storage = new CountingStorage(),
        f = fullRuntime(t, storage),
        input = media(901)
      assert.equal(f.playurl.transform(input, 'trusted-api').accepted, true)
      f.setVideo({
        ...f.video(),
        readyState: 4,
        width: 1920,
        height: 1080,
        coreInitialized: true,
        duration: 5000,
        playbackRate: rate,
        effectiveRate: rate,
        bufferAheadSec: 12 * rate,
        playableBufferSec: 12,
      })
      f.request(input.data.dash.video[0]!.base_url)
      const tick = (buffer: number) => {
        const v = f.video()
        f.setVideo({
          ...v,
          currentTime: v.currentTime + rate,
          frames: (v.frames ?? 0) + 30,
          bufferAheadSec: buffer * rate,
          playableBufferSec: buffer,
        })
        f.clock.advance(1000)
      }
      for (let i = 0; i < 60; i++) tick(12)
      const before = {
        decision: f.routes.latestRequested('video')!.decisionId,
        routes: f.routes.snapshot(),
        calls: structuredClone(f.calls),
        writes: storage.writes,
      }
      const events: string[] = []
      f.scope.defer(
        f.routes.subscribe((e) => {
          events.push(e.type)
        }),
      )
      tick(11)
      tick(10)
      tick(9)
      tick(8)
      assert.equal(f.diagnostics.snapshot().bufferTrend.latest!.candidate, true)
      for (let i = 0; i < 20; i++) tick(12)
      assert.equal(f.routes.latestRequested('video')!.decisionId, before.decision)
      assert.deepEqual(f.routes.snapshot(), before.routes)
      assert.deepEqual(f.calls, before.calls)
      assert.equal(storage.writes, before.writes)
      assert.deepEqual(events, [])
      await f.scope.dispose()
      assert.equal(f.clock.pendingCount, 0)
      assert.equal(
        [...storage.listeners.values()].reduce((n, rows) => n + rows.size, 0),
        0,
      )
    },
  )

test(
  'worker protocol rejects corrupted scores and hidden assertion failures',
  { timeout: 5000 },
  async (t) => {
    const result = await runScenario('high-stable', 1, t)
    assert.equal(result.rows[0]!.candidate, false)
    assert.equal(result.score.eligibleMs, 45000)
    assert.equal(
      validEvaluationResult({ ...result, score: { ...result.score, candidateMs: 1 } }, false),
      false,
    )
    assert.equal(
      validEvaluationResult({ ...result, assertions: [{ verdict: 'fail' }] }, false),
      false,
    )
    assert.equal(validEvaluationResult({ ...result, rows: [] }, false), false)
  },
)
