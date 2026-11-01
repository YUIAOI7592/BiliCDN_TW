import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import {
  requestId,
  type MediaKind,
  type TransportObservation,
} from '../../../src-v2/domain/model.ts'
import type { AppliedRouteDecision } from '../../../src-v2/application/route-contracts.ts'
import { EVIDENCE_KEY } from '../../../src-v2/state/evidence-store.ts'
import { EVIDENCE_TTL_MS, evidenceMetrics } from '../../../src-v2/domain/evidence.ts'
import { testScope } from '../../support/scope.ts'
import { FakeStorage } from '../../support/storage.ts'
import { fixture, media, dash } from './routing-fixture.ts'
import { fixture as runtimeFixture, media as runtimeMedia } from '../../support/runtime-fixture.ts'

async function capacityRoute(t: TestContext, role: 'primary' | 'backup' | 'startup' = 'primary') {
  const scope = testScope(t),
    f = fixture(scope),
    body = dash(media('capacity', 'video.m4s'))
  assert.equal(f.adapter.transform(body).accepted, true)
  const video = body.data.dash.video[0]!
  const url = role === 'backup' ? video.backup_url[0]! : video.base_url
  if (role === 'startup') {
    const options = f.routes.startupOptions(url)!
    assert.ok(f.routes.commitStartupChoice(url, options.candidates[0]!, 'capacity-startup'))
  }
  const applied = f.routes.apply(url, 'video')
  await f.routes.observe(completion(f, applied, 1))
  await f.routes.observe(completion(f, applied, 2))
  assert.equal(f.session.get().representation, applied.context!.representation)
  return { ...f, scope, url, applied }
}

for (const role of ['primary', 'backup', 'startup'] as const) {
  test(`V225 current capacity learns after ${role} planning without changing routing`, async (t) => {
    const f = await capacityRoute(t, role),
      host = f.applied.decision.host!
    if (role !== 'primary') assert.equal(f.applied.decision.ranking.length, 0)
    else
      assert.equal(
        f.applied.decision.ranking.find((row) => row.candidate.host === host)?.safeThroughputMbps,
        null,
      )
    const events: string[] = []
    f.scope.defer(f.routes.subscribe((event) => events.push(event.type)))
    const session = f.session.get(),
      stored = structuredClone([...f.storage.values])
    const first = f.routes.snapshot().currentCapacity
    assert.ok(first)
    assert.equal(first.host, host)
    assert.equal(first.decisionId, f.applied.decision.id)
    assert.equal(first.representation, session.representation)
    assert.equal(first.generation, session.generation)
    assert.equal(first.epoch, session.epoch)
    assert.equal(first.safeMbps, 10.48576)
    assert.equal(first.sampleStatus, 'available')
    assert.deepEqual(f.routes.snapshot().currentCapacity, first)
    assert.equal(f.session.get(), session)
    assert.deepEqual([...f.storage.values], stored)
    assert.deepEqual(events, [])
    if (role !== 'backup') assert.equal(f.routes.apply(f.url, 'video').decision, f.applied.decision)
  })
}

test('V225 capacity refresh respects inclusive TTL without deleting stored evidence', async (t) => {
  const f = await capacityRoute(t),
    stored = structuredClone([...f.storage.values])
  const session = f.session.get(),
    events: string[] = []
  f.scope.defer(f.routes.subscribe((event) => events.push(event.type)))
  f.clock.advance(EVIDENCE_TTL_MS - 1)
  assert.equal(f.routes.snapshot().currentCapacity?.safeMbps, 10.48576)
  f.clock.advance(1)
  assert.equal(f.routes.snapshot().currentCapacity?.safeMbps, 10.48576)
  f.clock.advance(1)
  assert.equal(f.routes.snapshot().currentCapacity?.safeMbps, null)
  assert.equal(f.routes.snapshot().currentCapacity?.sampleStatus, 'expired')
  assert.deepEqual([...f.storage.values], stored)
  assert.equal(f.session.get(), session)
  assert.deepEqual(events, [])
  await f.routes.observe(completion(f, f.applied, 3))
  assert.equal(f.routes.snapshot().currentCapacity?.safeMbps, 10.48576 * 0.7)
  assert.equal(f.routes.snapshot().currentCapacity?.sampleStatus, 'available')
})

test('V225 capacity uses existing weighted decay and mixed sample expiry', async (t) => {
  const f = await capacityRoute(t),
    host = f.applied.decision.host!
  f.clock.advance(EVIDENCE_TTL_MS / 2)
  await f.routes.observe(completion(f, f.applied, 3, { bytes: 262144 }))
  await f.routes.observe(completion(f, f.applied, 4, { bytes: 524288 }))
  assert.equal(
    f.routes.snapshot().currentCapacity?.safeMbps,
    evidenceMetrics(f.evidence.get(host, 'video'), f.clock.now()).safeThroughputMbps,
  )
  f.clock.advance(EVIDENCE_TTL_MS / 2 + 1)
  assert.equal(f.routes.snapshot().currentCapacity?.safeMbps, 20.97152)
})

for (const source of ['startup', 'health'] as const) {
  test(`V225 ${source} measurement contributes only after a valid evidence commit`, async (t) => {
    const f = await capacityRoute(t)
    await f.evidence.clear()
    const candidate = f.routes
      .startupOptions(f.url)!
      .candidates.find((row) => row.host === f.applied.decision.host)!
    assert.ok(candidate)
    const record = (valid: boolean) =>
      source === 'startup'
        ? f.routes.recordStartupSuccess(candidate, 1024 * 1024, 200, 10, () => valid)
        : f.routes.recordChallenge(f.applied, 1024 * 1024, 200, 10, 'success', null, () => valid)
    await record(false)
    assert.equal(f.routes.snapshot().currentCapacity?.safeMbps, null)
    await record(true)
    assert.equal(f.routes.snapshot().currentCapacity?.safeMbps, 41.94304 * 0.7)
    assert.equal(f.evidence.get(candidate.host, 'video')?.samples[0]?.source, 'challenge')
    assert.equal(f.routes.apply(f.url, 'video').decision, f.applied.decision)
  })
}

test('V225 current capacity survives a selected host outside the twelve ranking rows', async (t) => {
  const scope = testScope(t),
    f = fixture(scope)
  await f.settings.update({
    considerNativeSources: true,
    catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map((host) => [host, true])),
  })
  const { original, representation } = register(f)
  const decision = f.routes.plan(
    representation,
    { kind: 'video', requiredMbps: 10, highDemand: false },
    'startup',
  )
  for (const host of TRUSTED_CATALOG)
    await f.evidence.record(host, 'video', {
      requestId: `rank-${host}`,
      at: f.clock.now(),
      source: 'transport',
      outcome: 'success',
      throughputMbps: 20,
      ttfbMs: 10,
      failureKind: null,
    })
  const applied = f.routes.apply(original, 'video')
  assert.equal(applied.decision, decision)
  await f.routes.observe(completion(f, applied, 1))
  await f.routes.observe(completion(f, applied, 2))
  const snapshot = f.routes.snapshot()
  assert.equal(snapshot.activePlan!.ranking.length, 12)
  assert.equal(
    snapshot.activePlan!.ranking.some((row) => row.host === decision.host),
    false,
  )
  assert.equal(snapshot.currentCapacity?.host, decision.host)
  assert.equal(snapshot.currentCapacity?.safeMbps, 10.48576)
  await f.settings.update({ considerNativeSources: false })
  assert.equal(f.routes.snapshot().currentCapacity, null)
  assert.equal(f.routes.apply(original, 'video').decision.routeType, 'catalog-generated')
})

for (const change of [
  'disabled',
  'black',
  'dead',
  'catalog',
  'policy',
  'generation',
  'epoch',
  'authority',
] as const) {
  test(`V225 capacity rejects ${change} invalidation without cleaning the old plan`, async (t) => {
    const f = await capacityRoute(t),
      identity = f.applied.context!
    if (change === 'disabled') await f.settings.update({ disabled: true })
    else if (change === 'black' || change === 'dead')
      await f.restrictions.add({
        host: f.applied.decision.host!,
        kind: 'video',
        type: change,
        reason: 'contract',
        expireAt: f.clock.now() + 1000,
      })
    else if (change === 'catalog')
      await f.settings.update({ catalogOverrides: { [f.applied.decision.host!]: false } })
    else if (change === 'policy') f.routes.invalidateForUserSetting()
    else if (change === 'generation') f.session.beginGeneration(false)
    else if (change === 'epoch')
      f.vault.reset(identity.generation, (Number(identity.epoch) + 1) as typeof identity.epoch)
    else {
      assert.equal(
        f.vault.register({
          ...identity,
          key: '80:avc:1080',
          codec: 'avc',
          height: 1080,
          bandwidth: 4_000_000,
          urls: [media('capacity', 'video.m4s', 'renewed')],
          source: 'trusted-api',
          refreshTrustedSources: true,
        }),
        identity.representation,
      )
      assert.equal(f.vault.isCurrentIdentity(identity), false)
    }
    const before = f.session.get(),
      stored = structuredClone([...f.storage.values])
    const active = f.routes.snapshot().activePlan
    assert.equal(f.routes.snapshot().currentCapacity, null)
    assert.deepEqual(f.routes.snapshot().activePlan, active)
    assert.equal(f.session.get(), before)
    assert.deepEqual([...f.storage.values], stored)
  })
}

for (const boundary of ['evidence', 'policy'] as const) {
  test(`V225 capacity discards a synchronous ${boundary} read that changes ownership`, async (t) => {
    const f = await capacityRoute(t)
    if (boundary === 'evidence') {
      const get = f.evidence.get.bind(f.evidence)
      f.evidence.get = (host, kind) => {
        const result = get(host, kind)
        f.routes.invalidateForUserSetting()
        return result
      }
    } else {
      const snapshot = f.restrictions.snapshot.bind(f.restrictions)
      f.restrictions.snapshot = (kind) => {
        const result = snapshot(kind)
        f.session.beginGeneration(false)
        return result
      }
    }
    assert.equal(f.routes.snapshot().currentCapacity, null)
  })
}

test('V225 capacity isolates media and host evidence, clear and remote updates', async (t) => {
  const f = await capacityRoute(t),
    host = f.applied.decision.host!
  await f.evidence.clear()
  const sample = {
    requestId: 'capacity-sample',
    at: f.clock.now(),
    outcome: 'success' as const,
    throughputMbps: 20,
    ttfbMs: 10,
    source: 'transport' as const,
    failureKind: null,
  }
  await f.evidence.record(host, 'audio', sample)
  await f.evidence.record(
    TRUSTED_CATALOG.find((value) => value !== host)!,
    'video',
    sample,
  )
  assert.equal(f.routes.snapshot().currentCapacity?.safeMbps, null)
  assert.equal(f.routes.snapshot().currentCapacity?.sampleStatus, 'missing')
  await f.evidence.record(host, 'video', sample)
  const saved = structuredClone(f.storage.values.get(EVIDENCE_KEY))
  assert.equal(f.routes.snapshot().currentCapacity?.safeMbps, 14)
  await f.evidence.clear()
  assert.equal(f.routes.snapshot().currentCapacity?.sampleStatus, 'missing')
  f.storage.remote(EVIDENCE_KEY, saved)
  assert.equal(f.routes.snapshot().currentCapacity?.safeMbps, 14)
})

test('V225 failed evidence writes and stale completions do not create current capacity', async (t) => {
  const f = await capacityRoute(t)
  await f.evidence.clear()
  const set = f.storage.set.bind(f.storage)
  f.storage.set = (key, value) => {
    if (key === EVIDENCE_KEY) throw Error('capacity storage failure')
    set(key, value)
  }
  await assert.rejects(f.routes.observe(completion(f, f.applied, 3)), /capacity storage failure/)
  assert.equal(f.routes.snapshot().currentCapacity?.safeMbps, null)
  f.storage.set = set
  f.routes.invalidateForUserSetting()
  await f.routes.observe(
    completion(f, f.applied, 4, {
      request: {
        ...completion(f, f.applied, 4).request!,
        routePolicyRevision: f.routes.policyRevision() - 1,
      },
    }),
  )
  assert.equal(f.routes.snapshot().currentCapacity, null)
})

function register(f: ReturnType<typeof fixture>, kind: MediaKind = 'video') {
  const state = f.session.get()
  const original = media('convergence', `${kind}.m4s`)
  const representation = f.vault.register({
    generation: state.generation,
    epoch: state.epoch,
    kind,
    key: kind,
    height: kind === 'video' ? 1080 : 0,
    codec: kind === 'video' ? 'avc' : 'aac',
    bandwidth: kind === 'video' ? 4_000_000 : 192_000,
    urls: [original],
    source: 'trusted-api',
  })
  assert.ok(representation)
  return { original, representation }
}

function completion(
  f: ReturnType<typeof fixture>,
  applied: AppliedRouteDecision,
  serial: number,
  changes: Partial<TransportObservation> = {},
): TransportObservation {
  const identity = applied.context
  assert.ok(identity)
  assert.ok(applied.decision.host)
  const host = applied.decision.host
  return {
    request: {
      requestId: requestId(`convergence-${serial}`),
      generation: identity.generation,
      epoch: identity.epoch,
      representation: identity.representation,
      authorityRevision: identity.authorityRevision,
      routePolicyRevision: f.routes.policyRevision(),
      kind: identity.kind,
      attributionStatus: 'matched',
      attributionSource: 'exact',
      decisionStage: 'request',
      decisionId: applied.decision.id,
      routeType: applied.decision.routeType,
      originalHost: applied.sourceHost ?? host,
      targetHost: host,
      sourceHost: applied.sourceHost,
      playurlHostChanged: false,
      playurlOutput: null,
      urlChanged: false,
      hostChanged: false,
      startedAt: f.clock.now() - 100,
    },
    generation: identity.generation,
    epoch: identity.epoch,
    representation: identity.representation,
    kind: identity.kind,
    decisionId: applied.decision.id,
    routeType: applied.decision.routeType,
    originalHost: applied.sourceHost ?? host,
    targetHost: host,
    finalHost: host,
    streamKey: applied.streamKey,
    status: 206,
    bytes: 131072,
    ttfbMs: 10,
    elapsedMs: 100,
    completedAt: f.clock.now(),
    outcome: 'success',
    ...changes,
  }
}

async function fixedFailure(t: TestContext, noAlternative = false) {
  const f = fixture(testScope(t)),
    fixed = 'cn-hk-eq-01-05.bilivideo.com'
  await f.settings.update({
    considerNativeSources: false,
    fixedHost: fixed,
    ...(noAlternative
      ? {
          catalogOverrides: Object.fromEntries(
            TRUSTED_CATALOG.map((host) => [host, host === fixed]),
          ),
        }
      : {}),
  })
  f.routes.invalidateForUserSetting()
  const { original } = register(f),
    applied = f.routes.apply(original, 'video')
  assert.equal(applied.decision.host, fixed)
  const first = completion(f, applied, 1).request!
  f.routes.requestStarted(first)
  assert.equal(f.routes.recoveryEligible(first), true, 'healthy fixed route remains eligible')
  await f.routes.observe(
    completion(f, applied, 1, {
      outcome: 'failure',
      failureKind: 'timeout',
      status: 0,
      finalHost: null,
    }),
  )
  const next = f.routes.apply(original, 'video')
  return { ...f, original, fixed, next }
}

test('CC40 fixed failure retains recovery authority for its current legal Catalog fallback', async (t) => {
  const f = await fixedFailure(t)
  assert.equal(f.next.decision.action, 'rewrite')
  assert.notEqual(f.next.decision.host, f.fixed)
  const request = completion(f, f.next, 2).request!
  f.routes.requestStarted(request)
  assert.equal(f.routes.recoveryEligible(request), true)
  assert.equal(f.settings.get().fixedHost, f.fixed, 'failover does not rewrite user preference')
})

for (const change of ['black', 'dead', 'disabled', 'policy', 'generation', 'authority'] as const) {
  test(`CC40 fixed fallback loses recovery authority after ${change}`, async (t) => {
    const f = await fixedFailure(t),
      request = completion(f, f.next, 2).request!
    f.routes.requestStarted(request)
    if (change === 'black' || change === 'dead')
      await f.restrictions.add({
        host: request.targetHost,
        kind: 'video',
        type: change,
        reason: 'contract',
        expireAt: f.clock.now() + 60_000,
      })
    else if (change === 'disabled') await f.settings.update({ disabled: true })
    else if (change === 'policy') {
      await f.settings.update({ fixedHost: TRUSTED_CATALOG[4] })
      f.routes.invalidateForUserSetting()
    } else if (change === 'generation') {
      const state = f.session.beginGeneration(false)
      f.vault.reset(state.generation, state.epoch)
    } else {
      const state = f.session.get()
      f.vault.register({
        generation: state.generation,
        epoch: state.epoch,
        kind: 'video',
        key: 'video',
        height: 1080,
        codec: 'avc',
        bandwidth: 4_000_000,
        urls: [media('convergence', 'video.m4s', 'renewed')],
        source: 'trusted-api',
        refreshTrustedSources: true,
      })
      assert.equal(f.vault.isCurrentIdentity(f.next.context!), false)
    }
    assert.equal(f.routes.recoveryEligible(request), false)
  })
}

test('CC40 fixed failure with no legal alternative cannot authorize recovery', async (t) => {
  const f = await fixedFailure(t, true)
  assert.equal(f.next.decision.action, 'block')
  assert.equal(
    f.routes.recoveryEligible({
      ...f.next.context!,
      routePolicyRevision: f.routes.policyRevision(),
    }),
    false,
  )
})

test('CC40 audio failure cannot authorize video recovery under a fixed preference', async (t) => {
  const f = fixture(testScope(t))
  await f.settings.update({
    fixedHost: 'cn-hk-eq-01-05.bilivideo.com',
    considerNativeSources: false,
  })
  f.routes.invalidateForUserSetting()
  const { original } = register(f, 'audio'),
    applied = f.routes.apply(original, 'audio')
  const request = completion(f, applied, 1).request!
  f.routes.requestStarted(request)
  await f.routes.observe(
    completion(f, applied, 1, {
      outcome: 'failure',
      failureKind: 'timeout',
      status: 0,
      finalHost: null,
    }),
  )
  assert.equal(f.routes.recoveryEligible(request), false)
})

for (const resumes of [false, true]) {
  test(`CC40 legal fixed fallback ${resumes ? 'progress stops recovery' : 'stall reload remains bounded'}`, async (t) => {
    const f = runtimeFixture(t),
      fixed = 'cn-hk-eq-01-05.bilivideo.com'
    await f.settings.update({ fixedHost: fixed, considerNativeSources: false })
    const input = runtimeMedia(940)
    assert.equal(f.playurl.transform(input, 'trusted-api').accepted, true)
    const output = input.data.dash.video[0]!.base_url
    f.request(output)
    f.setVideo({
      ...f.video(),
      readyState: 4,
      width: 1920,
      height: 1080,
      coreInitialized: true,
      frames: 100,
    })
    f.deps.monitor.tick()
    f.setVideo({ ...f.video(), currentTime: 121, frames: 130 })
    f.clock.advance(1000)
    f.deps.monitor.tick()
    const request = f.routes.latestRequested('video')!
    const decision = f.routes.recover(
      request.representation!,
      { kind: 'video', requiredMbps: 8, highDemand: false },
      'verified-failure',
      fixed,
    )
    assert.notEqual(decision.host, fixed)
    f.request(output)
    assert.equal(f.routes.recoveryEligible(f.routes.latestRequested('video')!), true)
    for (let i = 1; i <= 35; i++) {
      if (resumes && i >= 6)
        f.setVideo({ ...f.video(), currentTime: 121 + i, frames: 130 + i * 30 })
      f.clock.advance(1000)
      f.deps.monitor.tick()
    }
    assert.equal(f.calls.reloads, resumes ? 0 : 1)
    assert.equal(f.recovery.isRecovering(), false)
  })
}

test('routing convergence keeps source branch decision IDs and decision-record ownership', async (t) => {
  const f = fixture(testScope(t))
  await f.settings.update({ considerNativeSources: true })
  const invalid = f.routes.apply('invalid:source')
  const opaque = f.routes.apply('https://media.example.invalid/opaque')
  const resource = f.routes.apply('https://media.example.invalid/v1/resource')
  const normal = f.routes.apply(media('convergence-unmatched', 'video.m4s'))
  assert.deepEqual(
    [invalid, opaque, resource, normal].map(({ decision }) => [decision.id, decision.reason]),
    [
      ['decision-1', 'invalid-url'],
      ['decision-2', 'opaque-media-observation-only'],
      ['decision-3', 'resource'],
      ['decision-4', 'unattributed-original-no-preflight'],
    ],
  )
  for (const applied of [invalid, opaque, resource])
    assert.equal(f.routes.decisionRecord(applied.decision.id), null)
  assert.equal(f.routes.decisionRecord(normal.decision.id)?.decision, normal.decision)
  await f.restrictions.add({
    host: 'media.example.invalid',
    type: 'black',
    kind: 'all',
    reason: 'synthetic',
    expireAt: f.clock.now() + 60_000,
  })
  const blocked = f.routes.apply('https://media.example.invalid/v1/resource')
  assert.equal(blocked.decision.id, 'decision-5')
  assert.equal(blocked.decision.reason, 'black')
  assert.equal(blocked.url, null)
  assert.equal(f.routes.decisionRecord(blocked.decision.id), null)
})

test('routing convergence route-planned reentry preserves nested IDs and outer plan commit order', async (t) => {
  const scope = testScope(t),
    f = fixture(scope)
  await f.settings.update({ considerNativeSources: true })
  const { original, representation } = register(f)
  const emitted: string[] = []
  let nested: AppliedRouteDecision | null = null
  scope.defer(
    f.routes.subscribe((event) => {
      if (event.type !== 'route-planned') return
      emitted.push(event.decision.id)
      if (emitted.length === 1) {
        nested = f.routes.apply(original)
        assert.notStrictEqual(nested.decision, event.decision)
        assert.equal(
          nested.decision.id,
          'decision-2',
          'outer plan is not committed during its event',
        )
      }
    }),
  )
  const outer = f.routes.plan(
    representation,
    { kind: 'video', requiredMbps: 8, highDemand: false },
    'startup',
  )
  assert.deepEqual(emitted, ['decision-1', 'decision-2'])
  assert.equal((nested as AppliedRouteDecision | null)?.decision.id, 'decision-2')
  assert.equal(outer.id, 'decision-1')
  assert.equal(f.session.get().lastDecisionId, 'decision-2')
  f.routes.snapshot()
  assert.strictEqual(f.routes.decisionRecord(outer.id)?.decision, outer)
  assert.strictEqual(
    f.routes.plan(representation, { kind: 'video', requiredMbps: 8, highDemand: false }, 'startup'),
    outer,
  )
  assert.equal(f.routes.apply(original).decision, outer)
})

class RecordingEvidenceStorage extends FakeStorage {
  readonly order: string[] = []
  override set<T>(key: string, value: T): void {
    if (key === EVIDENCE_KEY) this.order.push('persist')
    super.set(key, value)
  }
}

test('routing convergence confirms only after evidence persistence', async (t) => {
  const scope = testScope(t),
    storage = new RecordingEvidenceStorage(),
    f = fixture(scope, storage)
  const { original } = register(f)
  const applied = f.routes.apply(original)
  const host = applied.decision.host!
  scope.defer(
    f.routes.subscribe((event) => {
      if (event.type === 'route-confirmed')
        storage.order.push(`confirmed:${f.session.get().affinity?.host === host}`)
    }),
  )
  await f.routes.observe(completion(f, applied, 1))
  await f.routes.observe(completion(f, applied, 2))
  assert.deepEqual(storage.order, ['persist', 'confirmed:false', 'persist', 'confirmed:true'])
  assert.equal(f.evidence.get(host, 'video')?.samples[0]?.throughputMbps, 10.48576)
  assert.equal(f.session.get().affinity?.decisionId, applied.decision.id)
})

test('routing convergence evidence persistence reentry records learning without confirming control', async (t) => {
  const scope = testScope(t),
    f = fixture(scope)
  const { original } = register(f)
  const applied = f.routes.apply(original)
  let confirmed = 0
  const record = f.evidence.record.bind(f.evidence)
  f.evidence.record = (...args) => {
    f.routes.invalidateForUserSetting()
    return record(...args)
  }
  scope.defer(
    f.routes.subscribe((event) => {
      if (event.type === 'route-confirmed') confirmed++
    }),
  )
  await f.routes.observe(completion(f, applied, 1))
  assert.equal(f.evidence.get(applied.decision.host!, 'video')?.samples.length, 1)
  assert.equal(f.session.get().affinity, null)
  assert.equal(f.session.get().representation, null)
  assert.equal(confirmed, 0)
  assert.equal(f.routes.snapshot().latest.video?.status, 206)
})

for (const native of [false, true])
  test(`routing convergence keeps ${native ? 'Native invalidation' : 'Catalog 403 incompatibility'} separate from health evidence`, async (t) => {
    const f = fixture(testScope(t))
    if (native) await f.settings.update({ considerNativeSources: true })
    const original = media('convergence-forbidden', 'video.m4s')
    const backup = original.replace(
      'upos-hz-mirrorakam.akamaized.net',
      'upos-convergence-backup.akamaized.net',
    )
    const payload = dash(original)
    payload.data.dash.video[0]!.backup_url = [backup]
    assert.equal(f.adapter.transform(payload).accepted, true)
    const applied = f.routes.apply(native ? backup : payload.data.dash.video[0]!.base_url)
    assert.ok(applied.context)
    if (native) assert.equal(applied.decision.routeType, 'native-signed')
    await f.routes.observe(
      completion(f, applied, 1, {
        outcome: 'failure',
        status: 403,
        finalHost: null,
        failureKind: 'native-invalid',
      }),
    )
    assert.equal(f.evidence.get(applied.decision.host!, 'video'), null)
    assert.equal(f.vault.isInvalid(applied.context.representation, applied.decision.host!), native)
    assert.notEqual(f.routes.apply(native ? backup : original).decision.host, applied.decision.host)
    assert.equal(f.session.get().affinity, null)
  })

test('routing convergence audio successes remain separate from video confirmation and affinity', async (t) => {
  const f = fixture(testScope(t))
  const { original } = register(f, 'audio')
  const applied = f.routes.apply(original, 'audio')
  await f.routes.observe(completion(f, applied, 1))
  await f.routes.observe(completion(f, applied, 2))
  assert.equal(f.evidence.get(applied.decision.host!, 'audio')?.samples.length, 2)
  assert.equal(f.evidence.get(applied.decision.host!, 'video'), null)
  assert.equal(f.session.get().representation, null)
  assert.equal(f.session.get().affinity, null)
})

test('routing convergence throughput sampling keeps byte and elapsed-time boundaries', async (t) => {
  const f = fixture(testScope(t))
  const { original } = register(f)
  const applied = f.routes.apply(original)
  for (const [index, bytes, elapsedMs] of [
    [1, 65535, 100],
    [2, 65536, 0],
    [3, 65536, 100],
  ] as const)
    await f.routes.observe(completion(f, applied, index, { bytes, elapsedMs }))
  assert.deepEqual(
    f.evidence.get(applied.decision.host!, 'video')?.samples.map((sample) => sample.throughputMbps),
    [null, null, 5.24288],
  )
})
