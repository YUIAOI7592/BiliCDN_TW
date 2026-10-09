import { test } from 'node:test'
import assert from 'node:assert/strict'
import { testScope } from '../../support/scope.ts'
import { fixture, media, progressive, dash } from './routing-fixture.ts'
import { deferred } from '../../support/deferred.ts'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import { requestId, type TransportObservation } from '../../../src-v2/domain/model.ts'
import type { AppliedRouteDecision } from '../../../src-v2/application/route-coordinator.ts'
import { FakeStorage } from '../../support/storage.ts'

const success = (f: ReturnType<typeof fixture>, applied: AppliedRouteDecision, serial: number): TransportObservation => {
  const identity = applied.context!
  const host = applied.decision.host!
  return { request: { requestId: requestId(`synthetic-${serial}`), generation: identity.generation, epoch: identity.epoch,
    representation: identity.representation, authorityRevision: identity.authorityRevision, routePolicyRevision: f.routes.policyRevision(), kind: identity.kind,
    attributionStatus: 'matched', attributionSource: 'exact', decisionStage: 'request', decisionId: applied.decision.id,
    routeType: applied.decision.routeType, originalHost: applied.sourceHost!, targetHost: host, sourceHost: applied.sourceHost,
    playurlHostChanged: true, playurlOutput: null, urlChanged: true, hostChanged: true, startedAt: f.clock.now() - 1000 },
    generation: identity.generation, epoch: identity.epoch, representation: identity.representation, kind: identity.kind,
    decisionId: applied.decision.id, routeType: applied.decision.routeType, originalHost: applied.sourceHost!,
    targetHost: host, finalHost: host, streamKey: applied.streamKey, status: 206, bytes: 131072,
    ttfbMs: 10, elapsedMs: 1000, completedAt: f.clock.now(), outcome: 'success' }
}

for (const format of ['mp4', 'flv'] as const) {
  test(`A01 ${format}: renewed trusted signature replaces expired source`, { timeout: 5000 }, t => {
    const f = fixture(testScope(t))
    const old = progressive(media('content-A', `segment.${format}`, 'expired'), format)
    assert.equal(f.adapter.transform(old).accepted, true)
    const fresh = progressive(media('content-A', `segment.${format}`, 'renewed'), format)
    assert.equal(f.adapter.transform(fresh).accepted, true)
    assert.equal(new URL(fresh.data.durl[0]!.url).searchParams.get('syntheticSignature'), 'renewed',
      'fresh API source must remain fresh after Catalog host substitution')
    assert.ok(fresh.data.durl[0]!.backup_url.every(url => new URL(url).searchParams.get('syntheticSignature') === 'renewed'))
  })
}

test('A01 control: fresh DASH signature survives repeated trusted input', { timeout: 5000 }, t => {
  const f = fixture(testScope(t))
  assert.equal(f.adapter.transform(dash(media('content-A', 'video.m4s', 'expired'))).accepted, true)
  const fresh = dash(media('content-A', 'video.m4s', 'renewed'))
  assert.equal(f.adapter.transform(fresh).accepted, true)
  assert.equal(new URL(fresh.data.dash.video[0]!.base_url).searchParams.get('syntheticSignature'), 'renewed')
})

test('A02 protocol-relative content switch must retire earlier representation source', { timeout: 5000 }, t => {
  const f = fixture(testScope(t))
  const old = progressive(media('content-A', 'segment.mp4').replace('https:', ''))
  assert.equal(f.adapter.transform(old).accepted, true)
  const priorEpoch = f.session.get().epoch
  const fresh = progressive(media('content-B', 'segment.mp4').replace('https:', ''))
  assert.equal(f.adapter.transform(fresh).accepted, true)
  assert.equal(new URL(fresh.data.durl[0]!.url).pathname, '/upgcxcode/content-B/segment.mp4',
    'new content must not receive an earlier content body after Catalog rewrite')
  assert.notEqual(f.session.get().epoch, priorEpoch)
})

test('A02 control: absolute content switch retires earlier representation source', { timeout: 5000 }, t => {
  const f = fixture(testScope(t))
  assert.equal(f.adapter.transform(progressive(media('content-A', 'segment.mp4'))).accepted, true)
  const priorEpoch = f.session.get().epoch
  const fresh = progressive(media('content-B', 'segment.mp4'))
  assert.equal(f.adapter.transform(fresh).accepted, true)
  assert.equal(new URL(fresh.data.durl[0]!.url).pathname, '/upgcxcode/content-B/segment.mp4')
  assert.notEqual(f.session.get().epoch, priorEpoch)
})

for (const lateCompletion of [true, false]) {
  test(`A03 fixed CDN remains authoritative after ${lateCompletion ? 'late old transfer completion' : 'normal completed transfer control'}`, { timeout: 5000 }, async t => {
    const scope = testScope(t), f = fixture(scope)
    const original = media('content-A', 'video.m4s')
    assert.equal(f.adapter.transform(dash(original)).accepted, true)
    const initial = f.routes.apply(original)
    assert.equal(initial.decision.host, TRUSTED_CATALOG[0])
    await f.routes.observe(success(f, initial, 1))
    await f.routes.observe(success(f, initial, 2))
    assert.equal(f.session.get().affinity?.host, TRUSTED_CATALOG[0])
    const gate = deferred<void>()
    const lateObservation = success(f, initial, 3)
    const pending = gate.promise.then(() => f.routes.observe(lateObservation))
    scope.defer(() => { gate.resolve(); return pending })
    if (!lateCompletion) { gate.resolve(); await pending }
    const fixed = TRUSTED_CATALOG[5]
    await f.settings.update({ fixedHost: fixed })
    // RuntimeController.settingsChanged invokes this on any fixedHost change.
    f.routes.invalidateForUserSetting()
    assert.equal(f.session.get().affinity, null)
    if (lateCompletion) { gate.resolve(); await pending }
    if (lateCompletion) assert.equal(f.session.get().affinity, null, 'obsolete request has no control authority')
    const nextQuality = dash(media('content-A', 'video-720.m4s'))
    nextQuality.data.dash.video[0]!.id = 64
    nextQuality.data.dash.video[0]!.height = 720
    assert.equal(f.adapter.transform(nextQuality).accepted, true)
    assert.equal(new URL(nextQuality.data.dash.video[0]!.base_url).hostname, fixed,
      'late observations may retain health evidence but cannot override the current fixed CDN on a new quality')
    assert.equal(f.routes.apply(nextQuality.data.dash.video[0]!.base_url).decision.host, fixed)
  })
}

test('A01 repeated progressive refresh revokes old handles and preserves unchanged normalized sources', t => {
  const f = fixture(testScope(t))
  for (let index = 0; index < 8; index++) {
    const url = media('content-A', 'segment.mp4', String(index)), payload = progressive(url)
    assert.equal(f.adapter.transform(payload).accepted, true)
    const identity = f.vault.match(url).context; assert.ok(identity)
    const oldHandle = f.vault.candidates(identity.representation, new Set()).native[0]?.handle
    assert.ok(oldHandle)
    const same = progressive(url); same.data.durl[0]!.backup_url = [url.replace('https:', '')]
    assert.equal(f.adapter.transform(same).accepted, true)
    assert.equal(f.vault.identity(identity.representation), identity, 'equivalent normalized source set retains authority')
    const next = progressive(media('content-A', 'segment.mp4', String(index + 1)))
    assert.equal(f.adapter.transform(next).accepted, true)
    assert.equal(f.vault.resolve(oldHandle, identity), null)
    assert.equal(f.vault.isCurrentIdentity(identity), false)
    assert.equal(new URL(next.data.durl[0]!.url).searchParams.get('syntheticSignature'), String(index + 1))
    assert.notEqual(f.vault.match(payload.data.durl[0]!.url).source, 'catalog-alias')
  }
})

test('A01 invalid progressive refresh cannot reuse earlier signed output', t => {
  const f = fixture(testScope(t)), first = progressive(media('content-A', 'segment.mp4', 'old'))
  assert.equal(f.adapter.transform(first).accepted, true)
  const invalid = progressive('http://invalid.example/segment.mp4')
  assert.equal(f.adapter.transform(invalid).accepted, false)
  assert.ok(!JSON.stringify(invalid).includes('syntheticSignature=old'))
})

class HeldEvidenceStorage extends FakeStorage {
  readonly entered = deferred<void>(); readonly gate = deferred<void>(); hold = false
  override async withLock<T>(name: string, task: () => T | Promise<T>): Promise<T> {
    if (this.hold && name === 'routeEvidence') { this.entered.resolve(); await this.gate.promise }
    return await super.withLock(name, task)
  }
}

for (const outcome of ['success', 'failure'] as const) {
  test(`A03 policy change during ${outcome} evidence lock cannot publish control state`, async t => {
    const scope = testScope(t), storage = new HeldEvidenceStorage(), f = fixture(scope, storage)
    const url = media('content-A', 'video.m4s'); f.adapter.transform(dash(url))
    const applied = f.routes.apply(url), observation = success(f, applied, 100)
    let recoveries = 0, confirmations = 0
    scope.defer(f.routes.subscribe(event => { if (event.type === 'recovery') recoveries++; if (event.type === 'route-confirmed') confirmations++ }))
    storage.hold = true
    const pending = f.routes.observe(outcome === 'success' ? observation : { ...observation, outcome, status: 500, failureKind: 'http-5xx' })
    scope.defer(() => { storage.gate.resolve(); return pending })
    await storage.entered.promise
    await f.settings.update({ fixedHost: TRUSTED_CATALOG[5] }); f.routes.invalidateForUserSetting()
    storage.gate.resolve(); await pending
    assert.equal(f.session.get().affinity, null); assert.equal(f.session.get().representation, null)
    assert.equal(recoveries, 0); assert.equal(confirmations, 0)
    assert.equal(f.evidence.get(applied.decision.host!, 'video')?.samples.length, 1, 'history remains usable')
    assert.equal(f.routes.apply(url).decision.host, TRUSTED_CATALOG[5])
  })
}
