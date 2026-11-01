import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, dash, media } from './functional-races/routing-fixture.ts'
import { testScope } from '../support/scope.ts'
import { TRUSTED_CATALOG } from '../../src-v2/domain/catalog.ts'

test('V226 L01: reverse API responses cannot restore an older cid', async (t) => {
  const f = fixture(testScope(t))
  await f.settings.update({ considerNativeSources: true })
  const newer = media('new-cid', 'video.m4s'),
    older = media('old-cid', 'video.m4s')
  f.adapter.transform(dash(newer), 'trusted-api', 'api-2', { contentId: '2', requestSequence: 2 })
  const epoch = f.session.get().epoch,
    identity = f.vault.contextForUrl(newer)
  assert.ok(identity)
  f.adapter.transform(dash(older), 'trusted-api', 'api-1', { contentId: '1', requestSequence: 1 })
  assert.equal(f.session.get().epoch, epoch)
  assert.deepEqual(f.vault.contextForUrl(newer), identity)
  assert.equal(f.vault.contextForUrl(older), null)
})

test('V226 L01: older same-cid data adds a missing representation without adding stale sources', async (t) => {
  const f = fixture(testScope(t))
  await f.settings.update({ considerNativeSources: true })
  const newer = media('same', 'new.m4s'),
    older = media('same', 'old.m4s'),
    extra = media('same', 'extra.m4s')
  f.adapter.transform(dash(newer), 'trusted-api', 'api-2', { contentId: '7', requestSequence: 2 })
  const original = f.vault.contextForUrl(newer)!
  const payload = dash(older)
  payload.data.dash.video.push({
    ...payload.data.dash.video[0]!,
    id: 120,
    height: 2160,
    base_url: extra,
  })
  f.adapter.transform(payload, 'trusted-api', 'api-1', { contentId: '7', requestSequence: 1 })
  assert.deepEqual(f.vault.contextForUrl(newer), original)
  assert.equal(f.vault.contextForUrl(older), null)
  assert.ok(f.vault.contextForUrl(extra))
})

test('V226 L01: an old response without a cid cannot introduce Native authority', async (t) => {
  const f = fixture(testScope(t))
  await f.settings.update({ considerNativeSources: true })
  const current = media('same', 'current.m4s'),
    unknown = media('same', 'unknown.m4s')
  f.adapter.transform(dash(current), 'trusted-api', 'api-4', { contentId: '7', requestSequence: 4 })
  f.adapter.transform(dash(unknown), 'trusted-api', 'api-3', {
    contentId: null,
    requestSequence: 3,
  })
  assert.equal(f.vault.contextForUrl(unknown), null)
  assert.ok(f.vault.contextForUrl(current))
})

test('V226 L01: rejected newer output does not advance the accepted API watermark', async (t) => {
  const f = fixture(testScope(t))
  assert.equal(
    f.adapter.transform(dash(media('accepted-2', 'v.m4s')), 'trusted-api', '2', {
      contentId: '2',
      requestSequence: 2,
    }).accepted,
    true,
  )
  await f.settings.update({
    catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map((host) => [host, false])),
  })
  f.routes.invalidateForUserSetting()
  assert.equal(
    f.adapter.transform(dash(media('rejected-4', 'v.m4s')), 'trusted-api', '4', {
      contentId: '4',
      requestSequence: 4,
    }).accepted,
    false,
  )
  await f.settings.update({ catalogOverrides: {} })
  f.routes.invalidateForUserSetting()
  const valid = media('accepted-3', 'v.m4s')
  assert.equal(
    f.adapter.transform(dash(valid), 'trusted-api', '3', { contentId: '3', requestSequence: 3 })
      .accepted,
    true,
  )
  assert.ok(f.vault.contextForUrl(valid))
})
