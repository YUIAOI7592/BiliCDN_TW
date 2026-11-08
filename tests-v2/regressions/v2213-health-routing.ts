import { test } from 'node:test'
import type { TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, dash, media } from './functional-races/routing-fixture.ts'
import { SharedEvidenceStorage } from '../support/shared-evidence-storage.ts'
import { FakeStorage } from '../support/storage.ts'
import { testScope } from '../support/scope.ts'
import { TRUSTED_CATALOG } from '../../src-v2/domain/catalog.ts'
import { EVIDENCE_KEY } from '../../src-v2/state/evidence-store.ts'
import type { ChallengeProposal } from '../../src-v2/application/route-contracts.ts'

const target = TRUSTED_CATALOG[2],
  demand = { kind: 'video' as const, requiredMbps: 5, highDemand: false }

async function createExpiredCircuit(t: TestContext, advance = 600_000, shared = true) {
  const f = fixture(testScope(t), shared ? new SharedEvidenceStorage() : new FakeStorage())
  const url = media('health/controlled', 'video.m4s')
  assert.equal(f.adapter.transform(dash(url)).accepted, true)
  const context = f.vault.contextForUrl(url)!
  assert.ok(context)
  await f.evidence.record(target, 'video', {
    requestId: 'initial-health-failure',
    at: f.clock.now(),
    source: 'transport',
    outcome: 'failure',
    throughputMbps: null,
    ttfbMs: null,
    failureKind: 'network',
  })
  f.clock.advance(advance)
  const excluded = new Set<string>(TRUSTED_CATALOG.filter((host) => host !== target))
  excluded.add(new URL(url).hostname)
  return { ...f, url, context, excluded }
}

type HealthFixture = Awaited<ReturnType<typeof createExpiredCircuit>>
const propose = (
  f: HealthFixture,
  claims: Parameters<typeof f.routes.proposeChallenge>[5] = {
    claims: [],
    allowNative: false,
  },
) => f.routes.proposeChallenge(f.context.representation, demand, false, f.excluded, 0, claims)

test('V2213 health routing: an expired L1 circuit is eligible before the ordinary six-hour age', async (t) => {
  const f = await createExpiredCircuit(t)
  assert.equal(f.routes.challenge(f.context.representation, demand, false, f.excluded), null)
  const proposal = propose(f)
  assert.ok(proposal)
  assert.equal(proposal.candidate.host, target)
  assert.equal(proposal.candidate.kind, 'video')
  assert.deepEqual(proposal.priorityStamp, f.evidence.control(target, 'video').stamp)
})

test('V2213 health routing: an unexpired isolation cannot acquire priority', async (t) => {
  const f = await createExpiredCircuit(t, 599_999)
  assert.equal(propose(f), null)
})

test('V2213 health routing: repeated proposals have no decisions, events, writes or attempt side effects', async (t) => {
  const f = await createExpiredCircuit(t),
    saved = structuredClone([...f.storage.values]),
    session = f.session.get(),
    events: unknown[] = []
  const stop = f.routes.subscribe((event) => events.push(event))
  testScope(t).defer(stop)
  for (let i = 0; i < 8; i++) assert.ok(propose(f))
  assert.deepEqual([...f.storage.values], saved)
  assert.strictEqual(f.session.get(), session)
  assert.equal(events.length, 0)
  const proposal = propose(f)!
  assert.equal(f.routes.commitChallenge(proposal), null, 'priority requires a confirmed claim')
  const applied = f.routes.commitChallenge(proposal, true)
  assert.ok(applied)
  assert.equal(events.length, 1)
  assert.strictEqual(f.session.get().affinity, session.affinity)
  assert.equal(f.routes.commitChallenge(proposal, true), null, 'a proposal commits at most once')
})

test('V2213 health routing: the same host-kind circuit claim cannot be selected again', async (t) => {
  const f = await createExpiredCircuit(t),
    proposal = propose(f)!
  assert.ok(proposal?.priorityStamp)
  const claim = {
    host: target,
    kind: 'video' as const,
    stamp: proposal.priorityStamp,
    claimId: 'health-claim',
    roundId: 'health-round',
  }
  assert.equal(propose(f, { claims: [claim], allowNative: false }), null)
  assert.ok(propose(f, { claims: [{ ...claim, kind: 'audio' }], allowNative: false }))
})

test('V2213 health routing: priority requires synchronized control storage', async (t) => {
  const f = await createExpiredCircuit(t, 600_000, false)
  assert.equal(f.evidence.control(target, 'video').synchronized, false)
  assert.equal(propose(f), null)
})

for (const invalidation of ['failure', 'policy', 'source', 'restriction'] as const) {
  test(`V2213 health routing: ${invalidation} invalidation rejects a claimed proposal`, async (t) => {
    const f = await createExpiredCircuit(t),
      proposal = propose(f)!
    assert.ok(proposal)
    if (invalidation === 'failure')
      await f.evidence.record(target, 'video', {
        requestId: 'new-health-failure',
        at: f.clock.now(),
        source: 'transport',
        outcome: 'failure',
        throughputMbps: null,
        ttfbMs: null,
        failureKind: 'network',
      })
    if (invalidation === 'policy') f.routes.invalidateForUserSetting()
    if (invalidation === 'source') f.vault.invalidate(f.context.representation, target)
    if (invalidation === 'restriction')
      await f.restrictions.add({
        host: target,
        type: 'black',
        kind: 'video',
        reason: 'controlled',
        expireAt: f.clock.now() + 60_000,
      })
    assert.equal(f.routes.commitChallenge(proposal, true), null)
  })
}

test('V2213 health routing: video priority cannot borrow an audio circuit stamp', async (t) => {
  const f = await createExpiredCircuit(t)
  const before = f.evidence.control(target, 'video').stamp
  await f.evidence.record(target, 'audio', {
    requestId: 'isolated-audio-failure',
    at: f.clock.now(),
    source: 'transport',
    outcome: 'failure',
    throughputMbps: null,
    ttfbMs: null,
    failureKind: 'network',
  })
  const proposal = propose(f)!
  assert.ok(proposal)
  assert.deepEqual(proposal.priorityStamp, before)
  assert.ok(f.routes.commitChallenge(proposal, true))
  assert.equal(f.evidence.control(target, 'audio').level, 1)
})

test('V2213 health routing: Native candidates respect allowNative and exact-source revocation', async (t) => {
  const f = await createExpiredCircuit(t)
  await f.settings.update({ considerNativeSources: true })
  f.routes.invalidateForUserSetting()
  const excluded = new Set<string>(TRUSTED_CATALOG)
  assert.equal(
    f.routes.proposeChallenge(f.context.representation, demand, true, excluded, 0, {
      claims: [],
      allowNative: false,
    }),
    null,
  )
  const proposal = f.routes.proposeChallenge(f.context.representation, demand, true, excluded)!
  assert.ok(proposal)
  assert.equal(proposal.candidate.type, 'native-signed')
  f.vault.register({
    generation: f.context.generation,
    epoch: f.context.epoch,
    kind: 'video',
    key: '80:avc:1080',
    height: 1080,
    codec: 'avc',
    bandwidth: 4_000_000,
    urls: [media('health/replacement', 'new.m4s')],
    source: 'trusted-api',
    refreshTrustedSources: true,
  })
  assert.equal(f.routes.commitChallenge(proposal), null)
})

test('V2213 health routing: forged proposals and changed media identities cannot commit', async (t) => {
  const f = await createExpiredCircuit(t),
    proposal = propose(f)!
  assert.ok(proposal)
  assert.equal(f.routes.commitChallenge({ ...proposal } as ChallengeProposal, true), null)
  f.session.beginEpoch()
  assert.equal(f.routes.commitChallenge(proposal, true), null)
})

test('V2213 health routing: a control stamp changed during route notification cannot dispatch', async (t) => {
  const f = await createExpiredCircuit(t),
    proposal = propose(f)!
  const stop = f.routes.subscribe((event) => {
    if (event.type !== 'route-planned') return
    const payload = structuredClone(
      f.storage.get<{ records: Record<string, { circuitControl: { revision: number } }> }>(
        EVIDENCE_KEY,
        null!,
      ),
    )
    const row = payload.records[`video:${target}`]
    assert.ok(row)
    row.circuitControl.revision++
    f.storage.remote(EVIDENCE_KEY, payload)
  })
  testScope(t).defer(stop)
  assert.equal(f.routes.commitChallenge(proposal, true), null)
})
