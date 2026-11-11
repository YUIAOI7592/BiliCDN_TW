import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import { TransportAdapter } from '../../../src-v2/adapters/transport/transport.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { deferred } from '../../support/deferred.ts'
import { installProgressEvent } from '../../support/progress-event.ts'
import { testScope } from '../../support/scope.ts'
import { fixture as routingFixture } from '../routing/routing-fixture.ts'
import { createNativeTransportResources } from './native-transport-resources.ts'

const root =
  'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/dispatch/video.m4s?signature=private'
const backup = root.replace('upos-hz-mirrorakam.akamaized.net', 'upos-sz-mirrorali.bilivideo.com')
const thirdParty =
  'https://cdn.example.net/upgcxcode/emitted-backup/final.m4s?signature=old-player-backup'
const item = (backups: string[]) => ({
  id: 80,
  codecid: 13,
  height: 1080,
  bandwidth: 1_000_000,
  base_url: root,
  backup_url: backups,
})
const dash = (video: ReturnType<typeof item>) => ({ data: { dash: { video: [video], audio: [] } } })
const isCatalog = (url: string) =>
  TRUSTED_CATALOG.includes(new URL(url).host as (typeof TRUSTED_CATALOG)[number])

async function fixture(t: TestContext, gated = false) {
  const scope = testScope(t),
    f = routingFixture(scope),
    resources = await createNativeTransportResources()
  installProgressEvent(scope)
  scope.defineGlobal('unsafeWindow', { configurable: true, value: resources.fakeWindow })
  scope.defineGlobal('location', {
    configurable: true,
    value: new URL('https://www.bilibili.com/video/BVtest/'),
  })
  await f.settings.update({ considerNativeSources: true })
  let gate = deferred<void>()
  const transport = scope.own(
    new TransportAdapter(
      f.session,
      f.settings,
      f.routes,
      f.adapter,
      {
        willGateStartup: () => gated,
        prepareStartup: () => {
          gate = deferred<void>()
          return gate.promise
        },
        noteUnpreflighted: () => undefined,
      },
      f.clock.now,
      createRuntimeIds(),
      undefined,
      f.clock.now,
    ),
  )
  scope.defer(() => gate.resolve())
  transport.install()
  assert.equal(transport.snapshot().hookState, 'installed')
  const native = async (value: boolean) => {
    await f.settings.update({ considerNativeSources: value })
    f.routes.invalidateForUserSetting()
  }
  return {
    ...f,
    resources,
    transport,
    native,
    release: async () => {
      gate.resolve()
      await gate.promise
    },
  }
}

test('startup waiters recheck Native-to-Catalog switch in Fetch and XHR [1]', async (t) => {
  const f = await fixture(t, true),
    r = f.resources
  assert.equal(f.adapter.transform(dash(item([backup]))).accepted, true)
  const pending = r.fakeWindow.fetch(root)
  assert.equal(r.nativeFetchCalls, 0)
  await f.native(false)
  await f.release()
  const response = await pending
  assert.equal(r.nativeFetchCalls, 1)
  assert.ok(isCatalog(r.nativeFetchUrls[0]!))
  assert.equal(r.nativeFetchRedirects[0], 'error')
  await response.body?.cancel('case-complete')

  await f.native(true)
  const xhr = new r.FakeXhr()
  xhr.open('GET', root)
  xhr.send()
  assert.equal(xhr.nativeSends, 0)
  await f.native(false)
  await f.release()
  assert.equal(xhr.nativeSends, 1)
  assert.ok(isCatalog(xhr.url))
  const before = r.nativeFetchCalls
  await assert.rejects(r.fakeWindow.fetch(root, { method: 'POST' }), /blocked media request/)
  assert.equal(r.nativeFetchCalls, before)
})

test('old Native backups and opaque requests obey Catalog dispatch restrictions [2]', async (t) => {
  const f = await fixture(t),
    r = f.resources
  assert.equal(f.adapter.transform(dash(item([backup]))).accepted, true)
  await f.native(false)
  const response = await r.fakeWindow.fetch(backup)
  assert.equal(response.status, 206)
  assert.equal(r.nativeFetchCalls, 1)
  assert.ok(isCatalog(r.nativeFetchUrls[0]!))
  assert.equal(r.nativeFetchRedirects[0], 'error')
  await response.body?.cancel('case-complete')
  const post = new r.FakeXhr()
  post.open('POST', root)
  post.send()
  assert.equal(post.nativeSends, 0)
  const catalog = new r.FakeXhr()
  catalog.open('GET', root)
  catalog.send()
  assert.equal(catalog.nativeSends, 1)
  assert.ok(isCatalog(catalog.url))
  const redirected = new r.FakeXhr()
  redirected.finalResponseUrl = root
  redirected.open('GET', root)
  redirected.send()
  await Promise.resolve()
  assert.equal(f.evidence.get(new URL(root).host, 'video'), null)

  await f.native(true)
  const opaque = 'https://upos-hz-mirrorakam.akamaized.net/opaque/stale-audio?signature=private'
  const state = f.session.get()
  assert.ok(
    f.vault.register({
      generation: state.generation,
      epoch: state.epoch,
      kind: 'audio',
      key: 'stale-opaque',
      height: 0,
      codec: 'other',
      bandwidth: 192_000,
      urls: [opaque],
      source: 'trusted-api',
    }),
  )
  const stale = new r.FakeXhr()
  stale.open('GET', opaque)
  await f.native(false)
  const next = f.session.beginGeneration(false)
  f.vault.reset(next.generation, next.epoch)
  f.routes.resetEpoch()
  stale.send()
  assert.equal(stale.nativeSends, 0)
  await f.settings.update({ disabled: true })
  const disabled = new r.FakeXhr()
  disabled.open('GET', root)
  disabled.send()
  assert.equal(disabled.url, root)
  assert.equal(disabled.nativeSends, 1)
})

test('admitted third-party Native backup is blocked after Native is disabled [3]', async (t) => {
  const f = await fixture(t),
    r = f.resources
  const extra = backup
    .replace('mirrorali.', 'mirrorali02.')
    .replace('video.m4s?signature=private', 'third.m4s?signature=third')
  const video = item([backup, backup.replace('mirrorali.', 'mirroralib.'), thirdParty, extra])
  assert.equal(f.adapter.transform(dash(video)).accepted, true)
  const rep = f.vault.contextForUrl(root)?.representation
  assert.ok(rep)
  assert.equal(f.vault.sourceURLs(rep).length, 4)
  assert.ok(f.vault.sourceURLs(rep).includes(thirdParty))
  assert.ok(video.backup_url.includes(thirdParty))
  assert.equal(video.backup_url.includes(extra), false)
  await f.native(false)
  await assert.rejects(r.fakeWindow.fetch(thirdParty), /blocked media request/)
  assert.equal(r.nativeFetchCalls, 0)
  const xhr = new r.FakeXhr()
  xhr.open('GET', thirdParty)
  xhr.send()
  assert.equal(xhr.nativeSends, 0)

  const unrelated = 'https://media.other-example.org/unrelated/video.m4s?source=site'
  const response = await r.fakeWindow.fetch(unrelated)
  assert.deepEqual(r.nativeFetchUrls, [unrelated])
  await response.body?.cancel('case-complete')
  const other = new r.FakeXhr()
  other.open('GET', unrelated)
  other.send()
  assert.equal(other.nativeSends, 1)
  assert.equal(other.url, unrelated)
})

test('Native source cap withholds an unindexed backup without claiming unrelated traffic [4]', async (t) => {
  const f = await fixture(t),
    r = f.resources
  const video = item([
    backup,
    backup.replace('mirrorali.', 'mirroralib.'),
    backup.replace('mirrorali.', 'mirrorali02.'),
    thirdParty,
  ])
  assert.equal(f.settings.get().considerNativeSources, true)
  assert.equal(f.adapter.transform(dash(video)).accepted, true)
  const rep = f.vault.contextForUrl(root)?.representation
  assert.ok(rep)
  assert.deepEqual(f.vault.sourceURLs(rep), [
    root,
    backup,
    backup.replace('mirrorali.', 'mirroralib.'),
    backup.replace('mirrorali.', 'mirrorali02.'),
  ])
  assert.equal(video.backup_url.includes(thirdParty), false)
  await f.native(false)
  const response = await r.fakeWindow.fetch(thirdParty)
  assert.equal(r.nativeFetchCalls, 1)
  assert.deepEqual(r.nativeFetchUrls, [thirdParty])
  await response.body?.cancel('case-complete')
  const xhr = new r.FakeXhr()
  xhr.open('GET', thirdParty)
  xhr.send()
  assert.equal(xhr.nativeSends, 1)
  assert.equal(xhr.url, thirdParty)
})
