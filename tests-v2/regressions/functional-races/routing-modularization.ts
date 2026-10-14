import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TRUSTED_CATALOG, DEFAULT_UNAVAILABLE_HOSTS } from '../../../src-v2/domain/catalog.ts'
import { fixture, media } from './routing-fixture.ts'
import { testScope } from '../../support/scope.ts'

test('routing output preview registers bounded aliases without publishing output roles', (t) => {
  const f = fixture(testScope(t)),
    original = media('modular-output', 'video.m4s')
  const state = f.session.get()
  const representation = f.vault.register({
    generation: state.generation,
    epoch: state.epoch,
    kind: 'video',
    key: 'preview',
    height: 1080,
    codec: 'avc',
    bandwidth: 4_000_000,
    urls: [original],
    source: 'trusted-api',
  })
  assert.ok(representation)
  const plan = f.routes.plan(
    representation,
    { kind: 'video', requiredMbps: 8, highDemand: false },
    'startup',
  )
  const output = f.routes.playerOutput(
    representation,
    original,
    plan,
    [original],
    'trusted-api',
    false,
  )
  assert.ok(output.primary)
  assert.equal(output.backups.length, 5)
  for (const url of [output.primary, ...output.backups]) {
    assert.equal(f.vault.match(url).context?.representation, representation)
    assert.equal(f.vault.outputRole(representation, url), null)
  }
  assert.equal(f.session.get().affinity, null)
})

test('routing startup cursor wraps eligible Catalog order and expires cached throughput after five minutes', async (t) => {
  const f = fixture(testScope(t)),
    original = media('modular-startup', 'video.m4s')
  const state = f.session.get()
  assert.ok(
    f.vault.register({
      generation: state.generation,
      epoch: state.epoch,
      kind: 'video',
      key: 'startup',
      height: 1080,
      codec: 'avc',
      bandwidth: 4_000_000,
      urls: [original],
      source: 'trusted-api',
    }),
  )
  const eligible = TRUSTED_CATALOG.filter((host) => !DEFAULT_UNAVAILABLE_HOSTS.has(host))
  const cursor = eligible.length - 1
  const expected = [eligible[cursor], eligible[0], eligible[1]]
  const host = eligible[cursor]!
  await f.evidence.record(host, 'video', {
    requestId: 'modular-cached',
    at: f.clock.now(),
    source: 'challenge',
    outcome: 'success',
    throughputMbps: 40,
    ttfbMs: 20,
    failureKind: null,
  })
  const fresh = f.routes.startupOptions(original, cursor)
  assert.deepEqual(
    fresh?.candidates.map((candidate) => candidate.host),
    expected,
  )
  assert.ok(fresh?.candidates[0]?.cachedSafeMbps)
  f.clock.advance(5 * 60_000 + 1)
  const expired = f.routes.startupOptions(original, cursor)
  assert.deepEqual(
    expired?.candidates.map((candidate) => candidate.host),
    expected,
  )
  assert.equal(expired?.candidates[0]?.cachedSafeMbps, null)
})

test('routing Native startup preserves exact source order while challenge and output planning leave affinity unchanged', async (t) => {
  const f = fixture(testScope(t)),
    original = media('modular-native', 'video.m4s')
  const backup = original.replace(
    'upos-hz-mirrorakam.akamaized.net',
    'upos-sz-mirrorali.bilivideo.com',
  )
  await f.settings.update({ considerNativeSources: true })
  const state = f.session.get()
  const representation = f.vault.register({
    generation: state.generation,
    epoch: state.epoch,
    kind: 'video',
    key: 'native',
    height: 1080,
    codec: 'avc',
    bandwidth: 4_000_000,
    urls: [original, backup],
    source: 'trusted-api',
  })
  assert.ok(representation)
  const options = f.routes.startupOptions(original)
  assert.deepEqual(
    options?.candidates.slice(0, 2).map((candidate) => candidate.url),
    [original, backup],
  )
  assert.equal(options?.candidates[0]?.type, 'root-original')
  assert.equal(options?.candidates[1]?.type, 'native-signed')
  const demand = { kind: 'video' as const, requiredMbps: 8, highDemand: false }
  assert.ok(f.routes.challenge(representation, demand, true))
  const plan = f.routes.plan(representation, demand, 'startup')
  assert.equal(
    f.routes.playerOutput(representation, original, plan, [original, backup]).primary,
    original,
  )
  assert.equal(f.session.get().affinity, null)
  assert.equal(f.session.get().representation, null)
})

test('routing unattributed originals apply the union of video and audio host restrictions', async (t) => {
  const f = fixture(testScope(t)),
    original = media('modular-restriction', 'video.m4s')
  await f.settings.update({ considerNativeSources: true })
  await f.restrictions.add({
    host: new URL(original).hostname,
    type: 'black',
    kind: 'audio',
    reason: 'synthetic',
    expireAt: f.clock.now() + 60_000,
  })
  const inspected = f.routes.inspectOriginal(original)
  assert.equal(inspected.url, null)
  assert.equal(inspected.decision.action, 'block')
  assert.equal(inspected.decision.reason, 'black')
})
