import { test } from 'node:test'
import assert from 'node:assert/strict'
import { testScope } from '../../support/scope.ts'
import { fixture } from './routing-fixture.ts'

const root = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/c/d/2.m4s?k=1'

test('opaque signed audio stays observation-only and obeys the blacklist [1]', async (t) => {
  const f = fixture(testScope(t))
  await f.settings.update({ considerNativeSources: true })
  const state = f.session.get()
  const url = 'https://upos-hz-mirrorakam.akamaized.net/opaque/audio-segment?signature=private'
  const rep = f.vault.register({
    generation: state.generation,
    epoch: state.epoch,
    kind: 'audio',
    key: 'opaque-audio',
    height: 0,
    codec: 'other',
    bandwidth: 192_000,
    urls: [url],
    source: 'trusted-api',
  })
  assert.ok(rep)
  assert.equal(f.routes.recognizesMedia(url), true)
  assert.equal(f.routes.startupOptions(url), null)
  const before = f.routes.apply(url)
  assert.equal(before.attributionStatus, 'weak')
  assert.equal(before.decision.action, 'pass')
  assert.equal(f.routes.inspectOriginal(url).decision.action, 'pass')
  await f.restrictions.add({
    host: new URL(url).host,
    type: 'black',
    kind: 'all',
    reason: 'opaque-test',
    expireAt: f.clock.now() + 60_000,
  })
  for (const result of [f.routes.apply(url), f.routes.inspectOriginal(url)]) {
    assert.equal(result.decision.action, 'block')
    assert.equal(result.decision.reason, 'black')
    assert.equal(result.url, null)
  }
})

test('cold startup preserves the legal original until preflight completes [2]', async (t) => {
  const f = fixture(testScope(t))
  await f.settings.update({ considerNativeSources: true })
  const state = f.session.get()
  const rep = f.vault.register({
    generation: state.generation,
    epoch: state.epoch,
    kind: 'video',
    key: '80:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 3_000_000,
    urls: [root],
    source: 'page-hint',
  })
  assert.ok(rep)
  assert.equal(
    f.routes.plan(rep, { kind: 'video', requiredMbps: 7.5, highDemand: false }, 'startup').action,
    'pass',
  )
  const choice = f.routes
    .startupOptions(root)
    ?.candidates.find((candidate) => candidate.type === 'catalog-generated')
  assert.ok(choice)
  assert.ok(f.routes.commitStartupChoice(root, choice, 'test-preflight'))
  const applied = f.routes.apply(root)
  assert.equal(applied.decision.action, 'rewrite')
  const expected = new URL(root)
  expected.hostname = choice.host
  assert.equal(applied.url, expected.href)
  await f.routes.observe({
    generation: state.generation,
    epoch: state.epoch,
    decisionId: applied.decision.id,
    representation: rep,
    kind: 'video',
    routeType: 'catalog-generated',
    originalHost: applied.sourceHost!,
    targetHost: choice.host,
    finalHost: choice.host,
    streamKey: applied.streamKey,
    status: 403,
    bytes: 0,
    ttfbMs: 30,
    elapsedMs: 60,
    completedAt: f.clock.now(),
    outcome: 'failure',
  })
  const restored = f.routes.apply(applied.url!)
  assert.equal(restored.decision.reason, 'host-locked')
  assert.equal(restored.url, root)
  await f.restrictions.add({
    host: new URL(root).host,
    type: 'black',
    kind: 'all',
    reason: 'cold-start-test',
    expireAt: f.clock.now() + 60_000,
  })
  const options = f.routes.startupOptions(root)
  assert.ok(options && options.candidates.length > 0)
  assert.equal(
    options.candidates.some((candidate) => candidate.host === new URL(root).host),
    false,
  )
  const fallback = f.routes.apply(root)
  assert.ok(fallback.url)
  assert.notEqual(fallback.url, root)
  assert.notEqual(fallback.decision.host, new URL(root).host)
})

test('many quality groups retain plans across snapshot reads [3]', (t) => {
  const scope = testScope(t),
    f = fixture(scope),
    state = f.session.get()
  const saved = structuredClone([...f.storage.values])
  const groups = Array.from({ length: 40 }, (_, index) => {
    const rep = f.vault.register({
      generation: state.generation,
      epoch: state.epoch,
      kind: 'video',
      key: `quality-group:${index}`,
      height: 1080,
      codec: 'av1',
      bandwidth: 3_000_000,
      urls: [`https://upos-sz-mirrorali.bilivideo.com/upgcxcode/c/d/${index + 100}.m4s?k=1`],
      source: 'page-hint',
    })
    assert.ok(rep)
    return {
      rep,
      decision: f.routes.plan(
        rep,
        { kind: 'video', requiredMbps: 7.5, highDemand: false },
        'startup',
      ),
    }
  })
  assert.equal(groups.length, 40)
  assert.equal(new Set(groups.map((row) => row.rep)).size, 40)
  for (const { rep, decision } of groups) {
    assert.equal(
      f.routes.plan(rep, { kind: 'video', requiredMbps: 7.5, highDemand: false }, 'startup'),
      decision,
    )
    assert.equal(f.routes.decisionRecord(decision.id)?.representation, rep)
  }
  const snapshot = f.routes.snapshot()
  for (const key of ['planCount', 'recentPlans', 'lastSuccess'])
    assert.equal(Object.hasOwn(snapshot, key), false)
  for (const { rep, decision } of groups)
    assert.equal(
      f.routes.plan(rep, { kind: 'video', requiredMbps: 7.5, highDemand: false }, 'startup'),
      decision,
    )
  assert.deepEqual([...f.storage.values], saved)
})
