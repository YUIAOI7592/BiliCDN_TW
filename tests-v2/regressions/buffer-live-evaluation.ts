import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLiveSession, drainRemoteSession } from '../../scripts/buffer-shadow/live-session.mts'
import { assessAdoption, scoreLiveWindow } from '../../scripts/buffer-shadow/live-model.mts'
import type {
  LiveSample,
  LiveEvent,
  AdoptionFacts,
} from '../../scripts/buffer-shadow/live-model.mts'
import { FakeClock } from '../support/clock.ts'
import { testScope } from '../support/scope.ts'
import { startBrowserObservation } from '../../scripts/buffer-shadow/live-browser.mts'
import { evaluateLiveWindows } from '../../scripts/buffer-shadow/live-report.mts'
import { parseLiveArgs, replayLiveEvidence } from '../../scripts/buffer-live.mts'
import { fixture as runtimeFixture, media } from '../support/runtime-fixture.ts'
import { FakeStorage } from '../support/storage.ts'
class ObservedStorage extends FakeStorage {
  readonly writes: { key: string; value: unknown }[] = []
  override set<T>(key: string, value: T): void {
    this.writes.push({ key, value: structuredClone(value) })
    super.set(key, value)
  }
}

const sample = (at: number, patch: Partial<LiveSample> = {}): LiveSample => ({
  at,
  owner: 1,
  content: 1,
  rate: 1,
  candidate: false,
  reason: patch.candidate ? 'draining-low' : 'stable',
  bufferSec: patch.candidate ? 3 : 12,
  currentTime: 100 + at / 1000,
  frames: Math.floor((at / 1000) * 30),
  qualified: true,
  rescue: false,
  automatic: true,
  alternative: null,
  quality: 'valid',
  ...patch,
})

function fixture(t: Parameters<typeof testScope>[0], options = {}) {
  const scope = testScope(t),
    clock = scope.own(new FakeClock())
  let onSample: (v: unknown) => void = () => {},
    onEvent: (v: unknown) => void = () => {}
  let exit: () => void = () => {},
    bindings = 0
  const session = createLiveSession(
    {
      now: clock.now,
      timeout: clock.timeout.bind(clock),
      bind(s, e, x) {
        onSample = s
        onEvent = e
        exit = x
        bindings = 3
        return () => {
          bindings = 0
        }
      },
      resources: () => ({ subscriptions: bindings ? 2 : 0, listeners: bindings ? 1 : 0 }),
    },
    options,
  )
  scope.defer(() => session.stop())
  const start = clock.now()
  return {
    session,
    clock,
    push: (v: unknown) => onSample(v),
    event: (v: unknown) => onEvent(v),
    exit: () => exit(),
    advance: (ms: number) => clock.advance(ms),
    at: () => clock.now() - start,
  }
}

test('live session keeps a single cursor across paged and repeated drains with detached copies', (t) => {
  const f = fixture(t)
  f.push(sample(0))
  f.advance(1000)
  f.push(sample(1000))
  const a = f.session.drain(0, 1),
    repeated = f.session.drain(0, 1)
  assert.deepEqual(a, repeated)
  assert.equal(a.hasMore, true)
  const b = f.session.drain(a.cursor, 1)
  assert.equal(b.cursor, 2)
  assert.equal(b.hasMore, false)
  ;(b.entries[0]!.value as { currentTime: number }).currentTime = -9
  assert.equal((f.session.drain(1).entries[0]!.value as LiveSample).currentTime, 101)
  f.session.stop()
  assert.equal(f.clock.pendingCount, 0)
  assert.deepEqual(f.session.status().resources, { timers: 0, subscriptions: 0, listeners: 0 })
})

test('live session records the complete 365s stream through short lease renewals', (t) => {
  const f = fixture(t)
  for (let i = 0; i < 365; i++) {
    f.push(sample(i * 1000))
    f.advance(1000)
    if (i % 10 === 0) f.session.drain(0, 1000)
  }
  assert.equal(f.session.status().reason, 'complete')
  assert.equal(f.session.status().samples, 365)
  assert.equal(f.clock.pendingCount, 0)
})

test('live session lease expiry invalidates the window and releases before restart', (t) => {
  const f = fixture(t)
  f.push(sample(0))
  f.advance(29999)
  assert.equal(f.session.status().active, true)
  f.advance(1)
  assert.equal(f.session.status().reason, 'lease-expired')
  f.push(sample(30000))
  assert.equal(f.session.status().samples, 1)
  assert.equal(f.clock.pendingCount, 0)
  assert.equal(f.session.status().resources.subscriptions, 0)
})

for (const mode of ['samples', 'events', 'bytes'] as const)
  test(`live session ${mode} overflow invalidates instead of silently truncating`, (t) => {
    const f = fixture(
      t,
      mode === 'bytes'
        ? { maxBytes: 1 }
        : mode === 'samples'
          ? { maxSamples: 1 }
          : { maxEvents: 1 },
    )
    if (mode === 'events') {
      const e: LiveEvent = { at: 0, type: 'request-started', request: 1, kind: 'video', owner: 1 }
      f.event(e)
      f.event({ ...e, request: 2 })
    } else {
      f.push(sample(0))
      f.advance(1000)
      f.push(sample(1000))
    }
    assert.equal(f.session.status().reason, 'overflow')
    assert.equal(f.clock.pendingCount, 0)
  })

for (const mode of ['invalid', 'exit', 'cancel', 'exception'] as const)
  test(`live session ${mode} cleanup prevents old callbacks from reviving capture`, (t) => {
    const f = fixture(t)
    if (mode === 'invalid') f.push(sample(NaN))
    if (mode === 'exit') f.exit()
    if (mode === 'cancel') f.session.stop()
    if (mode === 'exception')
      f.push(
        new Proxy(
          {},
          {
            get() {
              throw Error('private data')
            },
          },
        ),
      )
    const before = f.session.status().samples
    f.push(sample(0))
    f.session.stop()
    assert.equal(f.session.status().samples, before)
    assert.equal(f.clock.pendingCount, 0)
    assert.equal(f.session.status().resources.listeners, 0)
    assert.doesNotMatch(JSON.stringify(f.session.status()), /private data/)
  })

test('live session whitelist removes unknown sensitive payload and rejects arbitrary strings', (t) => {
  const f = fixture(t)
  f.push({ ...sample(0), url: 'https://private.invalid/token', core: { secret: true } })
  assert.doesNotMatch(JSON.stringify(f.session.drain(0)), /private|secret|url|core/)
  f.push(sample(1000, { reason: 'token' }))
  assert.equal(f.session.status().reason, 'invalid-sample')
})

test('live session rejects future samples and does not renew on an invalid cursor', (t) => {
  const f = fixture(t)
  assert.throws(() => f.session.drain(1), /cursor/)
  f.push(sample(1))
  assert.equal(f.session.status().reason, 'invalid-sample')
  assert.equal(f.clock.pendingCount, 0)
})

test('live remote drain uses the current explicit capability and rejects exception envelopes', async () => {
  const calls: string[] = []
  const capability = (name: string) => ({
    async send(_method: string, params: Record<string, unknown>) {
      calls.push(name)
      assert.equal(params.objectId, name)
      return {
        result: {
          type: 'object',
          value: {
            cursor: 1,
            hasMore: false,
            truncated: false,
            private: 'sensitive',
            entries: [{ sequence: 1, kind: 'sample', value: { ...sample(0), url: 'sensitive' } }],
          },
        },
      }
    },
  })
  await drainRemoteSession(capability('old'), 'old', 0)
  const projected = await drainRemoteSession(capability('current'), 'current', 0)
  assert.doesNotMatch(JSON.stringify(projected), /sensitive|private|url/)
  assert.deepEqual(calls, ['old', 'current'])
  await assert.rejects(
    drainRemoteSession(
      {
        async send() {
          return { exceptionDetails: { text: 'private' } }
        },
      },
      'current',
      0,
    ),
    /rejected/,
  )
  await assert.rejects(
    drainRemoteSession(
      {
        async send() {
          return {
            result: {
              type: 'object',
              value: {
                cursor: 2,
                hasMore: false,
                truncated: false,
                entries: [{ sequence: 2, kind: 'sample', value: sample(0) }],
              },
            },
          }
        },
      },
      'current',
      0,
    ),
    /sequence/,
  )
})

for (const horizon of [15000, 60000])
  test(`live scorer requires the full ${horizon}ms followup and keeps earlier interruption distinct`, () => {
    const rows = Array.from({ length: horizon / 1000 + 2 }, (_, i) =>
      sample(i * 1000, { candidate: i === 0 }),
    )
    const result = scoreLiveWindow(rows, [], { from: 0, until: 1000 })
    const key = horizon === 15000 ? 'followup15' : 'followup60'
    assert.equal(result.opportunities[0]![key], 'continued')
    const short = scoreLiveWindow(rows.slice(0, -2), [], { from: 0, until: 1000 })
    assert.equal(short.opportunities[0]![key], 'undetermined')
  })

test('live scorer detects one two-second interruption without counting duplicate candidates twice', () => {
  const rows = Array.from({ length: 70 }, (_, i) =>
    sample(i * 1000, {
      candidate: i === 0 || i === 2,
      bufferSec: 3,
      currentTime: i < 5 ? 100 + i : 104,
      frames: i < 5 ? i * 30 : 120,
    }),
  )
  const result = scoreLiveWindow(rows, [], { from: 0, until: 60000 })
  assert.equal(result.interruptions.length, 1)
  assert.equal(result.pairs.length, 1)
  assert.equal(result.pairs[0]!.leadMs, 4000)
})

test('live scorer does not pair an interruption across a missing interval', () => {
  const rows = Array.from({ length: 70 }, (_, i) =>
    sample(i * 1000, {
      candidate: i === 0,
      currentTime: i < 30 ? 100 + i : 129,
      frames: i < 30 ? i * 30 : 870,
    }),
  )
  rows.splice(20, 1)
  const result = scoreLiveWindow(rows, [], { from: 0, until: 60000 })
  assert.equal(result.interruptions.length, 1)
  assert.equal(result.opportunities[0]!.followup60, 'undetermined')
  assert.equal(result.pairs.length, 0)
})

test('live scorer records entry into the actionable buffer range during an existing candidate', () => {
  const rows = Array.from({ length: 70 }, (_, i) =>
    sample(i * 1000, { candidate: i < 12, bufferSec: i < 10 ? 8 : 3 }),
  )
  const result = scoreLiveWindow(rows, [], { from: 0, until: 60000 })
  assert.equal(result.opportunities.find((o) => o.eligible)?.at, 10000)
})

for (const mode of ['gap', 'null', 'owner'] as const)
  test(`live scorer censors ${mode} without joining ownership or calling it healthy`, () => {
    const rows = Array.from({ length: 70 }, (_, i) => sample(i * 1000, { candidate: i === 0 }))
    if (mode === 'gap') rows.splice(5, 1)
    if (mode === 'null') rows[5] = sample(5000, { candidate: null, quality: 'invalid' })
    if (mode === 'owner') rows[5] = sample(5000, { owner: 2 })
    const before = structuredClone(rows)
    assert.equal(
      scoreLiveWindow(rows, [], { from: 0, until: 1000 }).opportunities[0]!.followup60,
      'undetermined',
    )
    assert.deepEqual(rows, before)
  })

const facts = (patch: Partial<AdoptionFacts> = {}): AdoptionFacts => ({
  windows: 12,
  combinations: 6,
  observedMs: 3600000,
  eligibleMs: 3240000,
  opportunities: 10,
  interruptions: 10,
  clipsWithInterruptions: 2,
  interruptionsByRate: [3, 7],
  matched: 8,
  warned: 7,
  timely: 7,
  actionable: 5,
  actionableRates: 2,
  normalMs: 1800000,
  unnecessary: 1,
  unknown: 0,
  integrity: true,
  ...patch,
})

test('adoption permits only the exact frozen evidence thresholds', () => {
  assert.equal(assessAdoption(facts()).decision, 'prototype')
  assert.equal(
    assessAdoption(
      facts({
        opportunities: 0,
        interruptions: 0,
        matched: 0,
        warned: 0,
        timely: 0,
        actionable: 0,
        unnecessary: 0,
      }),
    ).decision,
    'insufficient',
  )
  assert.equal(assessAdoption(facts({ unknown: 1 })).decision, 'insufficient')
  assert.equal(assessAdoption(facts({ integrity: false })).decision, 'blocked')
})

for (const patch of [
  { windows: 11 },
  { combinations: 5 },
  { observedMs: 3599999 },
  { opportunities: 9 },
  { interruptions: 9 },
  { interruptionsByRate: [2, 8] as const },
  { normalMs: 1799999 },
])
  test(`adoption marks missing evidence insufficient ${JSON.stringify(patch)}`, () => {
    assert.equal(assessAdoption(facts(patch)).decision, 'insufficient')
  })

for (const patch of [
  { eligibleMs: 3239999 },
  { matched: 7 },
  { warned: 6 },
  { timely: 6 },
  { actionable: 4 },
  { actionableRates: 1 },
  { unnecessary: 2 },
])
  test(`adoption rejects sufficient but unhelpful evidence ${JSON.stringify(patch)}`, () => {
    assert.equal(assessAdoption(facts(patch)).decision, 'do-not-adopt')
  })

test('live CLI accepts only input or calibration and preserves provenance', () => {
  assert.deepEqual(parseLiveArgs(['--input', 'result.json', '--json']), {
    input: 'result.json',
    json: true,
    serve: false,
  })
  for (const args of [
    [],
    ['--input'],
    ['--serve', '--input', 'x'],
    ['--serve', '--json'],
    ['--json', '--json'],
    ['--other'],
  ])
    assert.throws(() => parseLiveArgs(args))
  for (const input of [null, {}, { schemaVersion: 1, baseline: 'different', windows: [] }])
    assert.throws(() => replayLiveEvidence(input))
})

test('live report keeps absent windows insufficient and fails execution status honestly', () => {
  const result = evaluateLiveWindows([
    {
      id: 'baseline-1x-1',
      clip: 'BV1tFZZBQE57',
      part: 1,
      rate: 1,
      repeat: 1,
      validity: 'not-executed',
      reason: 'calibration-blocked',
      scoreFrom: 0,
      rows: [],
      events: [],
      clean: true,
    },
  ])
  assert.equal(result.adoption.decision, 'insufficient')
  assert.equal(result.exitCode, 1)
  assert.equal(result.adoption.facts.observedMs, 0)
})

test('live report validates the real healthy prelude and irregular full followup without external writes', () => {
  const rows = Array.from({ length: 427 }, (_, i) => sample(i * 1000 + (i % 2 ? 100 : 0)))
  const window = {
    id: 'baseline-1x-1',
    clip: 'BV1tFZZBQE57',
    part: 1,
    rate: 1 as const,
    repeat: 1 as const,
    validity: 'valid' as const,
    reason: 'complete' as const,
    scoreFrom: 60000,
    rows,
    events: [],
    clean: true,
  }
  const before = structuredClone(window)
  const result = evaluateLiveWindows([window])
  assert.equal(result.exitCode, 1)
  assert.equal(result.adoption.facts.observedMs, 300000)
  assert.equal(result.adoption.facts.normalMs, 300000)
  assert.equal(result.adoption.decision, 'insufficient')
  assert.deepEqual(window, before)
  const all = ['BV1tFZZBQE57', 'BV1aN4y1J763', 'BV1Xr4y1S7aw'].flatMap((clip, c) =>
    ([1, 2] as const).flatMap((rate) =>
      ([1, 2] as const).map((repeat) => ({
        ...window,
        id: `clip-${c}-${rate}-${repeat}`,
        clip,
        rate,
        repeat,
        rows: rows.map((r) => ({ ...r, rate, currentTime: r.currentTime! * rate })),
      })),
    ),
  )
  assert.equal(evaluateLiveWindows(all).exitCode, 0)
  assert.throws(() => evaluateLiveWindows([window, { ...window, id: 'duplicate' }]), /identity/)
  assert.equal(
    evaluateLiveWindows([{ ...window, rows: rows.slice(60) }]).scores[0]!.validity,
    'invalid',
  )
})

for (const mode of ['version', 'hash', 'bytes'] as const)
  test(`live replay rejects incorrect fixed source ${mode}`, () => {
    const source = {
      version: '2.1.35',
      bytes: 422022,
      sha256: '7458f27610a0b2a9f13e07c1e087502198809dacb2a411f5112acf9aaf3b9cc3',
    }
    const invalid = {
      ...source,
      [mode === 'hash' ? 'sha256' : mode]: mode === 'bytes' ? 0 : 'different',
    }
    assert.throws(
      () =>
        replayLiveEvidence({
          schemaVersion: 1,
          baseline: 'd0c2c8c3dcc61e6db76531d560dfbc2a12d7fd98',
          source: invalid,
          windows: [],
        }),
      /provenance/,
    )
  })

for (const rate of [1, 2] as const)
  test(`live real Monitor Runtime Routes Recorder remain unchanged during capture rate=${rate}`, async (t) => {
    const run = async (observed: boolean) => {
      const storage = new ObservedStorage(),
        f = runtimeFixture(t, storage)
      f.runtime.install()
      f.playurl.transform(media(551))
      const url = media(551).data.dash.video[0]!.base_url
      f.request(url)
      const trace: string[] = []
      f.scope.defer(f.routes.subscribe((e) => trace.push(e.type)))
      let exitListener = 0
      const control = {
        mediaId: 1,
        coreId: 1,
        userRevision: 0,
        seekRevision: 0,
        reloadRevision: 0,
        coreReloadRevision: 0,
      }
      const started = f.clock.now()
      const session = observed
        ? startBrowserObservation(
            {
              monitor: f.deps.monitor,
              routes: f.routes,
              session: f.session,
              player: { controls: () => control },
              settings: f.settings,
              recovery: f.recovery,
              visibility: { isActuallyVisible: () => true },
            },
            {
              now: f.clock.now,
              wall: f.clock.now,
              timeout: f.clock.timeout.bind(f.clock),
              onExit() {
                exitListener++
                return () => {
                  exitListener--
                }
              },
            },
            rate,
          )
        : null
      f.scope.defer(() => session?.stop())
      for (let i = 0; i < 80; i++) {
        f.setVideo({
          ...f.video(),
          readyState: 4,
          coreInitialized: true,
          width: 1920,
          height: 1080,
          currentTime: 100 + i * rate,
          frames: i * 30,
          playbackRate: rate,
          effectiveRate: rate,
          bufferAheadSec: 12 * rate,
          playableBufferSec: 12,
        })
        f.clock.advance(1000)
        if (i % 10 === 0) f.request(url)
        session?.drain(0)
      }
      session?.stop()
      if (session) {
        assert.equal(session.status().reason, 'cancelled')
        assert.equal(session.status().samples, 80)
        assert.equal(session.status().resources.timers, 0)
        assert.equal(session.status().resources.subscriptions, 0)
      }
      assert.equal(exitListener, 0)
      const effects = {
        calls: structuredClone(f.calls),
        writes: storage.writes,
        trace,
        affinity: f.session.get().affinity,
        recovery: f.recovery.snapshot(),
        elapsed: f.clock.now() - started,
      }
      await f.scope.dispose()
      // The scope owns the existing product's resources; the observer was checked before this disposal.
      return effects
    }
    const before = await run(false),
      after = await run(true)
    assert.deepEqual(after, before)
  })
