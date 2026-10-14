import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, media, dash, progressive } from './routing-fixture.ts'
import { testScope } from '../../support/scope.ts'
import { requestId, type TransportObservation } from '../../../src-v2/domain/model.ts'

async function failedNativeBackup(t: TestContext) {
  const f = fixture(testScope(t))
  await f.settings.update({ considerNativeSources: true })
  const original = media('review-A', 'video.m4s')
  const backup = original.replace(
    'upos-hz-mirrorakam.akamaized.net',
    'upos-review-backup.akamaized.net',
  )
  const payload = dash(original)
  payload.data.dash.video[0]!.backup_url = [backup]
  assert.equal(f.adapter.transform(payload).accepted, true)
  const applied = f.routes.apply(backup)
  assert.ok(applied.context)
  assert.equal(applied.url, backup)
  assert.equal(applied.decision.routeType, 'native-signed')
  const identity = applied.context
  const host = new URL(backup).hostname
  const request = {
    requestId: requestId('review-backup-failure'),
    generation: identity.generation,
    epoch: identity.epoch,
    representation: identity.representation,
    authorityRevision: identity.authorityRevision,
    routePolicyRevision: f.routes.policyRevision(),
    kind: identity.kind,
    attributionStatus: 'matched' as const,
    attributionSource: 'exact' as const,
    decisionStage: 'request' as const,
    decisionId: applied.decision.id,
    routeType: applied.decision.routeType,
    originalHost: host,
    targetHost: host,
    sourceHost: applied.sourceHost,
    playurlHostChanged: false,
    playurlOutput: null,
    urlChanged: false,
    hostChanged: false,
    startedAt: f.clock.now(),
  }
  const failure: TransportObservation = {
    request,
    generation: identity.generation,
    epoch: identity.epoch,
    representation: identity.representation,
    kind: identity.kind,
    decisionId: applied.decision.id,
    routeType: applied.decision.routeType,
    originalHost: host,
    targetHost: host,
    finalHost: null,
    streamKey: applied.streamKey,
    status: 0,
    bytes: 0,
    ttfbMs: null,
    elapsedMs: 100,
    completedAt: f.clock.now(),
    outcome: 'failure',
    failureKind: 'network',
  }
  await f.routes.observe(failure)
  const fallback = f.routes.snapshot().fallback.video
  assert.equal(fallback?.plannedHost, new URL(original).hostname)
  return { f, original, backup }
}

test('CR-01/02 root fallback sends the selected legal original after a Native backup fails', async (t) => {
  const { f, original, backup } = await failedNativeBackup(t)
  const retry = f.routes.apply(backup)
  assert.equal(
    retry.url,
    original,
    'legal selected original must be materialized instead of blocking the failed backup',
  )
})

test('CR-01/02 control root fallback remains usable when the player itself returns to the original URL', async (t) => {
  const { f, original } = await failedNativeBackup(t)
  assert.equal(f.routes.apply(original).url, original)
})

test('CR-01 selected original keeps same-host DASH query strings and rejects a forbidden root', async (t) => {
  const { f, original } = await failedNativeBackup(t)
  const fresh = original.replace('fresh', 'current-request')
  f.vault.registerAlias(f.vault.match(original).context!.representation, fresh)
  assert.equal(f.routes.apply(fresh).url, fresh)
  await f.restrictions.add({
    host: new URL(original).hostname,
    type: 'black',
    kind: 'all',
    reason: 'synthetic',
    expireAt: f.clock.now() + 60_000,
  })
  const result = f.routes.apply(original)
  assert.notEqual(result.url, original)
})

for (const format of ['mp4', 'flv'] as const)
  test(`CR-02 ${format} primary permutation preserves handles but refreshes canonical order`, (t) => {
    const f = fixture(testScope(t)),
      root = media('set', 'segment.' + format)
    const backup = root.replace(
      'upos-hz-mirrorakam.akamaized.net',
      'upos-sz-mirrorali.bilivideo.com',
    )
    const first = progressive(root, format)
    first.data.durl[0]!.backup_url = [backup]
    f.adapter.transform(first)
    const identity = f.vault.match(root).context!
    assert.ok(identity)
    const handle = f.vault.candidates(identity.representation, new Set()).root!.handle!
    const reordered = progressive(backup, format)
    reordered.data.durl[0]!.backup_url = [root]
    assert.equal(f.adapter.transform(reordered).accepted, true)
    assert.equal(f.vault.identity(identity.representation), identity)
    assert.equal(f.vault.rootUrl(identity.representation), backup)
    assert.equal(f.vault.resolve(handle, identity), root)
    const renewed = progressive(backup.replace('fresh', 'new-signature'), format)
    assert.equal(f.adapter.transform(renewed).accepted, true)
    assert.equal(f.vault.resolve(handle, identity), null)
  })

test('CR-01/02 unchanged progressive source set in a different backup order preserves authority', (t) => {
  const f = fixture(testScope(t))
  const root = media('review-A', 'segment.mp4')
  const b1 = root.replace('upos-hz-mirrorakam.akamaized.net', 'upos-sz-mirrorali.bilivideo.com')
  const b2 = root.replace('upos-hz-mirrorakam.akamaized.net', 'upos-sz-mirroralib.bilivideo.com')
  const before = progressive(root)
  before.data.durl[0]!.backup_url = [b1, b2]
  assert.equal(f.adapter.transform(before).accepted, true)
  const identity = f.vault.match(root).context
  assert.ok(identity)
  const after = progressive(root)
  after.data.durl[0]!.backup_url = [b2, b1]
  assert.equal(f.adapter.transform(after).accepted, true)
  assert.equal(
    f.vault.identity(identity.representation),
    identity,
    'reordering unchanged backup URLs must not revoke in-flight transfer authority',
  )
})

test('CR-01/02 control unchanged progressive source order preserves authority', (t) => {
  const f = fixture(testScope(t))
  const root = media('review-A', 'segment.mp4')
  const backup = root.replace('upos-hz-mirrorakam.akamaized.net', 'upos-sz-mirrorali.bilivideo.com')
  const before = progressive(root)
  before.data.durl[0]!.backup_url = [backup]
  assert.equal(f.adapter.transform(before).accepted, true)
  const identity = f.vault.match(root).context
  assert.ok(identity)
  const after = progressive(root)
  after.data.durl[0]!.backup_url = [backup]
  assert.equal(f.adapter.transform(after).accepted, true)
  assert.equal(f.vault.identity(identity.representation), identity)
})

for (const changed of [false, true])
  test(`CR-01/02 ${changed ? 'control new signature rejects obsolete' : 'unchanged backup permutation retains in-flight'} completion evidence`, async (t) => {
    const f = fixture(testScope(t))
    const root = media('review-A', 'segment.mp4')
    const b1 = root.replace('upos-hz-mirrorakam.akamaized.net', 'upos-sz-mirrorali.bilivideo.com')
    const b2 = root.replace('upos-hz-mirrorakam.akamaized.net', 'upos-sz-mirroralib.bilivideo.com')
    const before = progressive(root)
    before.data.durl[0]!.backup_url = [b1, b2]
    assert.equal(f.adapter.transform(before).accepted, true)
    const applied = f.routes.apply(before.data.durl[0]!.url)
    assert.ok(applied.context)
    assert.ok(applied.url)
    const identity = applied.context,
      host = new URL(applied.url).hostname
    const request = {
      requestId: requestId('review-inflight-success'),
      generation: identity.generation,
      epoch: identity.epoch,
      representation: identity.representation,
      authorityRevision: identity.authorityRevision,
      routePolicyRevision: f.routes.policyRevision(),
      kind: identity.kind,
      attributionStatus: 'matched' as const,
      attributionSource: 'exact' as const,
      decisionStage: 'request' as const,
      decisionId: applied.decision.id,
      routeType: applied.decision.routeType,
      originalHost: host,
      targetHost: host,
      sourceHost: applied.sourceHost,
      playurlHostChanged: true,
      playurlOutput: null,
      urlChanged: true,
      hostChanged: true,
      startedAt: f.clock.now(),
    }
    const after = progressive(changed ? media('review-A', 'segment.mp4', 'renewed') : root)
    after.data.durl[0]!.backup_url = changed ? [] : [b2, b1]
    assert.equal(f.adapter.transform(after).accepted, true)
    await f.routes.observe({
      request,
      generation: identity.generation,
      epoch: identity.epoch,
      representation: identity.representation,
      kind: identity.kind,
      decisionId: applied.decision.id,
      routeType: applied.decision.routeType,
      originalHost: host,
      targetHost: host,
      finalHost: host,
      streamKey: applied.streamKey,
      status: 206,
      bytes: 131072,
      ttfbMs: 10,
      elapsedMs: 100,
      completedAt: f.clock.now(),
      outcome: 'success',
    })
    assert.equal(
      f.evidence.get(host, 'video')?.samples.length ?? 0,
      changed ? 0 : 1,
      'unchanged signed authority keeps evidence; genuinely renewed authority still revokes older completions',
    )
  })
