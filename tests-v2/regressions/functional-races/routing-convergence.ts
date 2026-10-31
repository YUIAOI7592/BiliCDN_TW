import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import {
  requestId,
  type MediaKind,
  type TransportObservation,
} from '../../../src-v2/domain/model.ts'
import type { AppliedRouteDecision } from '../../../src-v2/application/route-model.ts'
import { EVIDENCE_KEY } from '../../../src-v2/state/evidence-store.ts'
import { testScope } from '../../support/scope.ts'
import { FakeStorage } from '../../support/storage.ts'
import { fixture, media, dash } from './routing-fixture.ts'
import { fixture as runtimeFixture, media as runtimeMedia } from '../../support/runtime-fixture.ts'

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

for (const change of [
  'black',
  'dead',
  'disabled',
  'comparison',
  'policy',
  'generation',
  'authority',
] as const) {
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
    else if (change === 'comparison') f.routes.setOriginalComparison(true)
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

test('routing convergence original comparison keeps inspection and output decision allocation order', (t) => {
  const f = fixture(testScope(t))
  f.routes.setOriginalComparison(true)
  const original = media('convergence-comparison', 'video.m4s')
  const first = f.routes.apply(original)
  const second = f.routes.apply(original)
  assert.deepEqual([first.decision.id, second.decision.id], ['decision-2', 'decision-4'])
  assert.equal(first.decision.reason, 'original-observe-only')
  assert.equal(first.url, original)
  assert.equal(f.routes.decisionRecord(first.decision.id)?.decision, first.decision)
  assert.equal(f.routes.snapshot().planCount, 0)
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
        assert.equal(f.routes.snapshot().planCount, 0)
        nested = f.routes.apply(original)
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
  assert.equal(f.routes.snapshot().recentPlans[0]?.id, outer.id)
  assert.equal(f.routes.apply(original).decision, outer)
})

class RecordingEvidenceStorage extends FakeStorage {
  readonly order: string[] = []
  override set<T>(key: string, value: T): void {
    if (key === EVIDENCE_KEY) this.order.push('persist')
    super.set(key, value)
  }
}

test('routing convergence emits completion before evidence and confirms only after persistence', async (t) => {
  const scope = testScope(t),
    storage = new RecordingEvidenceStorage(),
    f = fixture(scope, storage)
  const { original } = register(f)
  const applied = f.routes.apply(original)
  const host = applied.decision.host!
  scope.defer(
    f.routes.subscribe((event) => {
      if (event.type === 'transport-completed')
        storage.order.push(`completed:${f.evidence.get(host, 'video')?.samples.length ?? 0}`)
      if (event.type === 'route-confirmed')
        storage.order.push(`confirmed:${f.session.get().affinity?.host === host}`)
    }),
  )
  await f.routes.observe(completion(f, applied, 1))
  await f.routes.observe(completion(f, applied, 2))
  assert.deepEqual(storage.order, [
    'completed:0',
    'persist',
    'confirmed:false',
    'completed:1',
    'persist',
    'confirmed:true',
  ])
  assert.equal(f.evidence.get(host, 'video')?.samples[0]?.throughputMbps, 10.48576)
  assert.equal(f.session.get().affinity?.decisionId, applied.decision.id)
})

test('routing convergence completion-event policy reentry records history without confirming control', async (t) => {
  const scope = testScope(t),
    f = fixture(scope)
  const { original } = register(f)
  const applied = f.routes.apply(original)
  let confirmed = 0
  scope.defer(
    f.routes.subscribe((event) => {
      if (event.type === 'transport-completed') f.routes.invalidateForUserSetting()
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
