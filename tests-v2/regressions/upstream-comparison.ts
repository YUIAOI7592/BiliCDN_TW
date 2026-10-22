import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PageClock,
  checkSource,
  sha256,
  sustainedPlayback,
  outcomeCode,
  scenarioHash,
  restorationFacts,
  newOperationProtected,
  comparisonMetrics,
  parseComparisonArgs,
  validCaseResult,
} from '../../scripts/upstream-compare/model.mts'
import type { Observation } from '../../scripts/upstream-compare/model.mts'
import { ComparisonPage, PageEvent, PageNode } from '../../scripts/upstream-compare/page.mts'
import { testScope } from '../support/scope.ts'

test(
  'comparison clock drains promise jobs before the next same-time timer',
  { timeout: 5000 },
  async (t) => {
    const clock = new PageClock(),
      order: string[] = []
    testScope(t).defer(() => {
      clock.close()
      clock.dispose()
    })
    clock.set(() => {
      order.push('task1')
      void Promise.resolve().then(() => order.push('promise'))
    }, 10)
    clock.set(() => order.push('task2'), 10)
    await clock.advance(10)
    assert.deepEqual(order, ['task1', 'promise', 'task2'])
    assert.equal(clock.pendingCount, 0)
  },
)
test(
  'comparison clock cancellation and page microtasks preserve FIFO',
  { timeout: 5000 },
  async (t) => {
    const clock = new PageClock(),
      order: string[] = []
    testScope(t).defer(() => {
      clock.close()
      clock.dispose()
    })
    const removed = clock.set(() => order.push('removed'), 0)
    clock.clear(removed)
    clock.set(() => {
      order.push('timer')
      clock.microtask(() => order.push('micro'))
    }, 0)
    clock.set(() => order.push('next'), 0)
    await clock.advance(0)
    assert.deepEqual(order, ['timer', 'micro', 'next'])
  },
)
test(
  'comparison source guard rejects changed bytes and size before evaluation',
  { timeout: 5000 },
  () => {
    const bytes = Buffer.from('synthetic fixture')
    assert.doesNotThrow(() => checkSource(bytes, bytes.length, sha256(bytes)))
    assert.throws(() => checkSource(bytes, bytes.length + 1, sha256(bytes)))
    assert.throws(() => checkSource(Buffer.from('synthetic fixturE'), bytes.length, sha256(bytes)))
  },
)
test('comparison scenario identity includes rate and event script', { timeout: 5000 }, () => {
  assert.equal(scenarioHash('healthy', 1), scenarioHash('healthy', 1))
  assert.notEqual(scenarioHash('healthy', 1), scenarioHash('healthy', 2))
  assert.notEqual(scenarioHash('healthy', 1), scenarioHash('short-stall', 1))
})
test(
  'comparison event model preserves capture target bubble and dispatch lifetime',
  { timeout: 5000 },
  () => {
    const doc = new PageNode(),
      body = new PageNode(),
      order: string[] = []
    doc.append(body)
    doc.addEventListener('keydown', (e) => order.push(`capture:${e.eventPhase}`), true)
    body.addEventListener('keydown', (e) => order.push(`target:${e.eventPhase}`))
    doc.addEventListener('keydown', (e) => order.push(`bubble:${e.eventPhase}`))
    const event = new PageEvent('keydown', { trusted: true, key: 'Home' })
    body.dispatchEvent(event)
    assert.deepEqual(order, ['capture:1', 'target:2', 'bubble:3'])
    assert.equal(event.eventPhase, 0)
    assert.equal(event.currentTarget, null)
  },
)
test(
  'comparison pages isolate globals memory and owned resources without loading product',
  { timeout: 5000 },
  async (t) => {
    const first = new ComparisonPage(1, ['fixture.invalid']),
      second = new ComparisonPage(2, ['fixture.invalid'])
    testScope(t).defer(async () => {
      await first.close()
      await second.close()
    })
    first.load('GM_setValue("synthetic", 7); setInterval(() => {}, 1000)', 'fixture')
    assert.equal(first.memory.get('synthetic'), 7)
    assert.equal(second.memory.has('synthetic'), false)
    assert.equal(first.counts().timers, 1)
    assert.equal(second.counts().timers, 0)
  },
)
test(
  'comparison cleanup cancels page work before clock disposal and has no late callback',
  { timeout: 5000 },
  async () => {
    const page = new ComparisonPage(1, ['fixture.invalid'])
    page.load(
      'setInterval(() => GM_setValue("late", 1), 1000); document.addEventListener("x", () => {})',
      'fixture',
    )
    const cleanup = await page.close()
    assert.equal(cleanup.before.timers, 1)
    assert.equal(cleanup.before.listeners, 1)
    assert.deepEqual(cleanup.after, { timers: 0, listeners: 0, requests: 0, subscriptions: 0 })
    assert.equal(cleanup.callbacksAfterClose, 0)
    assert.equal(page.memory.has('late'), false)
  },
)
test(
  'comparison pending request is classified as incomplete before environment destruction',
  { timeout: 5000 },
  async () => {
    const page = new ComparisonPage(1, ['fixture.invalid'])
    const result = page.fetch('https://fixture.invalid/fixture').catch(() => null)
    const cleanup = await page.close()
    await result
    assert.equal(cleanup.unclassified, 1)
    assert.equal(cleanup.before.requests, 1)
    assert.equal(cleanup.after.requests, 0)
  },
)
test(
  'comparison calibration rejects a page with no installed hooks',
  { timeout: 5000 },
  async () => {
    const page = new ComparisonPage(1, ['fixture.invalid'])
    assert.equal(page.hooksInstalled(), false)
    await page.close()
  },
)
test(
  'comparison product side effects inside input dispatch cannot inherit the input label',
  { timeout: 5000 },
  async () => {
    const page = new ComparisonPage(1, ['fixture.invalid'])
    page.video.addEventListener('pause', () => {
      void page.player.play()
    })
    page.siteCall('pause', () => page.player.pause())
    assert.equal(page.observations.find((e) => e.kind === 'pause')?.origin, 'input')
    assert.equal(page.observations.find((e) => e.kind === 'play')?.origin, 'product')
    assert.equal(newOperationProtected(page.observations, 0, 'pause', 0), false)
    await page.close()
  },
)
for (const rate of [1, 2] as const) {
  const samples = (): Observation[] =>
    Array.from(
      { length: 16 },
      (_, i) =>
        [
          {
            seq: i * 4 + 1,
            at: i * 1000,
            origin: 'input',
            kind: 'tail-time',
            value: 100 + i * rate,
          },
          { seq: i * 4 + 2, at: i * 1000, origin: 'input', kind: 'tail-frames', value: i * 30 },
          { seq: i * 4 + 3, at: i * 1000, origin: 'input', kind: 'tail-rate', value: rate },
          { seq: i * 4 + 4, at: i * 1000, origin: 'input', kind: 'tail-qualified', value: true },
        ] satisfies Observation[],
    ).flat()
  test(
    `comparison 15-second continuous tail accepts every interval at rate ${rate}`,
    { timeout: 5000 },
    () => {
      assert.equal(sustainedPlayback(samples(), rate), true)
    },
  )
  test(
    `comparison continuous tail rejects an ineligible segment despite time and frames at rate ${rate}`,
    { timeout: 5000 },
    () => {
      const broken = samples().map((e) =>
        e.kind === 'tail-qualified' && e.at === 10000 ? { ...e, value: false } : e,
      )
      assert.equal(sustainedPlayback(broken, rate), false)
    },
  )
  test(
    `comparison continuous tail rejects recurrent stall despite earlier progress at rate ${rate}`,
    { timeout: 5000 },
    () => {
      const broken = samples().map((e) =>
        e.kind === 'tail-time' && e.at === 10000 ? { ...e, value: 100 + 9 * rate } : e,
      )
      assert.equal(sustainedPlayback(broken, rate), false)
    },
  )
  test(
    `comparison continuous tail rejects frame-only and wrong-rate success at rate ${rate}`,
    { timeout: 5000 },
    () => {
      assert.equal(
        sustainedPlayback(
          samples().map((e) => (e.kind === 'tail-time' ? { ...e, value: 100 } : e)),
          rate,
        ),
        false,
      )
      assert.equal(sustainedPlayback(samples(), rate === 1 ? 2 : 1), false)
      assert.equal(sustainedPlayback(samples().slice(3), rate), false)
    },
  )
  for (const target of [0, 600.25]) {
    test(
      `comparison restore validator rejects wrong position, order and duplication at rate ${rate} target ${target}`,
      { timeout: 5000 },
      () => {
        const events: Observation[] = ['reload', 'seek', 'setRate', 'play'].map((kind, i) => ({
          seq: i + 1,
          at: i,
          origin: 'product',
          kind,
          value: kind === 'seek' ? target : rate,
        }))
        assert.deepEqual(
          [
            restorationFacts(events, target, rate).position,
            restorationFacts(events, target, rate).rate,
            restorationFacts(events, target, rate).order,
          ],
          [true, true, true],
        )
        assert.equal(
          restorationFacts(
            events.map((e) => (e.kind === 'seek' ? { ...e, value: target + 1 } : e)),
            target,
            rate,
          ).position,
          false,
        )
        assert.equal(
          restorationFacts(
            events.map((e) => (e.kind === 'play' ? { ...e, seq: 0 } : e)),
            target,
            rate,
          ).order,
          false,
        )
        assert.equal(restorationFacts([...events, events[1]!], target, rate).position, false)
        assert.equal(restorationFacts(events, target, rate === 1 ? 2 : 1).rate, false)
      },
    )
  }
  test(
    `comparison newer seek and rate reject stale restoration at rate ${rate}`,
    { timeout: 5000 },
    () => {
      const event: Observation = { seq: 1, at: 10, origin: 'product', kind: 'seek', value: 100 }
      assert.equal(newOperationProtected([event], 10, 'seek', 900.5), false)
      assert.equal(newOperationProtected([event], 11, 'seek', 900.5), true)
      assert.equal(
        newOperationProtected(
          [{ ...event, kind: 'setRate', value: rate }],
          10,
          'rate',
          rate === 1 ? 2 : 1,
        ),
        false,
      )
    },
  )
}
test(
  'comparison failure and invalidity preserve nonzero result instead of counting as pass',
  { timeout: 5000 },
  () => {
    assert.equal(outcomeCode([{ validity: 'valid', verdict: 'pass' }]), 0)
    assert.equal(outcomeCode([{ validity: 'valid', verdict: 'fail' }]), 1)
    assert.equal(outcomeCode([{ validity: 'invalid', verdict: 'undetermined' }]), 1)
    assert.equal(outcomeCode([]), 1)
  },
)
test(
  'comparison CLI rejects arbitrary sources duplicate options and missing values',
  { timeout: 5000 },
  () => {
    assert.deepEqual(parseComparisonArgs([]), { json: false, calibration: false })
    assert.deepEqual(parseComparisonArgs(['--json', '--calibrate']), {
      json: true,
      calibration: true,
    })
    for (const args of [['--source', 'else.js'], ['--json', '--json'], ['--filter'], ['healthy']])
      assert.throws(() => parseComparisonArgs(args))
  },
)
test(
  'comparison route metrics distinguish actual video switches probe work and repeated hosts',
  { timeout: 5000 },
  () => {
    const events: Observation[] = [
      {
        seq: 1,
        at: 0,
        origin: 'platform',
        kind: 'dispatch',
        media: 'video',
        host: 'a',
        value: 'website',
      },
      {
        seq: 2,
        at: 10,
        origin: 'platform',
        kind: 'dispatch',
        media: 'video',
        host: 'a',
        value: 'website',
      },
      {
        seq: 3,
        at: 11,
        origin: 'platform',
        kind: 'dispatch',
        media: 'video',
        host: 'b',
        value: 'probe',
      },
      {
        seq: 4,
        at: 12,
        origin: 'platform',
        kind: 'dispatch',
        media: 'audio',
        host: 'b',
        value: 'website',
      },
      {
        seq: 5,
        at: 13,
        origin: 'platform',
        kind: 'dispatch',
        media: 'video',
        host: 'b',
        value: 'website',
      },
    ]
    const metrics = comparisonMetrics(events, 10)
    assert.equal(metrics.firstVideoHostChangeMs, 3)
    assert.equal(metrics.videoHostChanges, 1)
    assert.equal(metrics.probeDispatches, 1)
    assert.equal(metrics.wireDispatches, 3)
  },
)
test(
  'comparison result boundary rejects raw URLs objects tokens and lost event sequences',
  { timeout: 5000 },
  () => {
    const row = {
      id: 'healthy@1x/2.1.27',
      version: '2.1.27',
      scenario: 'healthy',
      rate: 1,
      scenarioHash: sha256('fixture'),
      validity: 'valid',
      verdict: 'pass',
      reasons: [],
      calibration: [],
      observations: [{ seq: 1, at: 0, origin: 'platform', kind: 'dispatch', value: 'website' }],
      assertions: [],
      cleanup: null,
      metrics: comparisonMetrics([], 0),
    }
    assert.equal(validCaseResult(row, row.id), true)
    for (const observation of [
      { ...row.observations[0], value: 'https://example.invalid/private?token=secret' },
      { ...row.observations[0], token: 'secret' },
      { ...row.observations[0], core: {} },
      { ...row.observations[0], seq: 3 },
      { ...row.observations[0], at: NaN },
    ])
      assert.equal(validCaseResult({ ...row, observations: [observation] }, row.id), false)
    assert.equal(validCaseResult(row, 'another-case'), false)
  },
)
