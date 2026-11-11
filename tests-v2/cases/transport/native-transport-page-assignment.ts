import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import { PagePlayinfoAdapter } from '../../../src-v2/adapters/playurl/page-playinfo.ts'
import { testScope } from '../../support/scope.ts'
import { fixture as routingFixture } from '../routing/routing-fixture.ts'

const media = (name: string) =>
  'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/page-hint/' + name + '.m4s?signature=' + name
const dash = (url: string) => ({
  data: {
    dash: {
      video: [
        {
          id: 80,
          codecid: 13,
          height: 1080,
          bandwidth: 1_000_000,
          base_url: url,
          backup_url: [] as string[],
        },
      ],
      audio: [],
    },
  },
})
function fixture(t: TestContext) {
  const scope = testScope(t),
    f = routingFixture(scope)
  const page: { __playinfo__?: unknown } = {}
  scope.defineGlobal('unsafeWindow', { configurable: true, value: page })
  const pageAdapter = () =>
    scope.own(
      new PagePlayinfoAdapter(
        (payload) => f.adapter.transform(payload, 'page-hint').accepted,
        () => f.routes.isCatalogOnly(),
      ),
    )
  return { ...f, page, pageAdapter }
}

test('page hints preserve trusted output authority and its first-use affinity [5]', async (t) => {
  const f = fixture(t),
    assigned: unknown[] = []
  let value: unknown
  Object.defineProperty(f.page, '__playinfo__', {
    configurable: true,
    get: () => value,
    set: (next: unknown) => {
      assigned.push(next)
      value = next
    },
  })
  f.pageAdapter().install()
  const early = dash(media('early'))
  f.page.__playinfo__ = early
  assert.equal(assigned.length, 1)
  assert.equal(assigned[0], early)
  assert.ok(
    TRUSTED_CATALOG.includes(
      new URL(early.data.dash.video[0]!.base_url).host as (typeof TRUSTED_CATALOG)[number],
    ),
  )

  const trustedUrl = media('trusted'),
    trusted = dash(trustedUrl)
  assert.equal(f.adapter.transform(trusted, 'trusted-api').accepted, true)
  const rep = f.vault.contextForUrl(trustedUrl)?.representation
  assert.ok(rep)
  const output = trusted.data.dash.video[0]!.base_url,
    role = f.vault.outputRole(rep, output)
  assert.equal(role?.source, 'trusted-api')
  assert.ok(role?.decisionId)
  const lateUrl = media('late').replace(
    'upos-hz-mirrorakam.akamaized.net',
    'upos-sz-mirrorali.bilivideo.com',
  )
  const late = dash(lateUrl)
  f.page.__playinfo__ = late
  assert.equal(assigned.length, 2)
  assert.equal(assigned[1], late)
  assert.equal(late.data.dash.video[0]!.base_url, output)
  assert.notEqual(output, lateUrl)
  assert.deepEqual(f.vault.outputRole(rep, output), role)
  assert.equal(f.vault.rootUrl(rep), trustedUrl)
  assert.equal(
    f.vault.candidates(rep, new Set()).native.some((route) => route.host === new URL(lateUrl).host),
    false,
  )

  const affinityRoot = media('affinity'),
    state = f.session.get()
  const affinityRep = f.vault.register({
    generation: state.generation,
    epoch: state.epoch,
    kind: 'video',
    key: 'affinity:64',
    height: 720,
    codec: 'av1',
    bandwidth: 1_000_000,
    urls: [affinityRoot],
    source: 'trusted-api',
  })
  assert.ok(affinityRep)
  const choice = f.routes
    .startupOptions(affinityRoot)
    ?.candidates.find(
      (candidate) =>
        candidate.type === 'catalog-generated' && candidate.host !== new URL(output).host,
    )
  assert.ok(choice)
  f.routes.commitStartupChoice(affinityRoot, choice, 'test-observed-affinity')
  const applied = f.routes.apply(affinityRoot)
  assert.equal(applied.decision.host, choice.host)
  for (let index = 0; index < 2; index++)
    await f.routes.observe({
      generation: state.generation,
      epoch: state.epoch,
      decisionId: applied.decision.id,
      representation: affinityRep,
      kind: 'video',
      routeType: 'catalog-generated',
      originalHost: new URL(affinityRoot).host,
      targetHost: choice.host,
      finalHost: choice.host,
      responseUrlMatchesRequest: true,
      streamKey: applied.streamKey,
      status: 206,
      bytes: 70 * 1024,
      ttfbMs: 20,
      elapsedMs: 100,
      completedAt: f.clock.now() + index + 1,
      outcome: 'success',
    })
  assert.equal(f.session.get().affinity?.host, choice.host)
  assert.equal(f.routes.apply(output).decision.host, choice.host)
})

test('page setter and initial getter reject unsupported Catalog-only values but preserve Native values [6]', async (t) => {
  const f = fixture(t),
    assigned: unknown[] = []
  Object.defineProperty(f.page, '__playinfo__', {
    configurable: true,
    set: (value: unknown) => assigned.push(value),
  })
  const adapter = f.pageAdapter()
  adapter.install()
  const unsupported = { data: { durl: [{ url: media('unsupported-secret') }] } }
  f.page.__playinfo__ = unsupported
  assert.deepEqual(assigned, [])
  assert.equal(f.page.__playinfo__, undefined)
  adapter.dispose()
  Reflect.deleteProperty(f.page, '__playinfo__')

  const initial = { data: { durl: [{ url: media('initial-secret') }] } }
  Object.defineProperty(f.page, '__playinfo__', {
    configurable: true,
    writable: true,
    value: initial,
  })
  const initialAdapter = f.pageAdapter()
  initialAdapter.install()
  assert.equal(f.page.__playinfo__, undefined)
  initialAdapter.dispose()
  Reflect.deleteProperty(f.page, '__playinfo__')
  await f.settings.update({ considerNativeSources: true })
  f.routes.invalidateForUserSetting()
  Object.defineProperty(f.page, '__playinfo__', {
    configurable: true,
    writable: true,
    value: initial,
  })
  f.pageAdapter().install()
  assert.equal(f.page.__playinfo__, initial)
})

for (const native of [false, true]) {
  test(`page accessor handles every fresh unsupported value with Native=${native} [7/8]`, async (t) => {
    const f = fixture(t)
    let reads = 0
    const original = () => ({ data: { durl: [{ url: media('fresh-' + ++reads) }] } })
    Object.defineProperty(f.page, '__playinfo__', { configurable: true, get: original })
    assert.equal(
      (f.page.__playinfo__ as ReturnType<typeof original>).data.durl[0]!.url,
      media('fresh-1'),
    )
    f.pageAdapter().install()
    assert.notEqual(Object.getOwnPropertyDescriptor(f.page, '__playinfo__')?.get, original)
    if (native) {
      await f.settings.update({ considerNativeSources: true })
      f.routes.invalidateForUserSetting()
    }
    for (let read = 0; read < 2; read++) {
      const before = reads,
        result = f.page.__playinfo__
      assert.equal(reads, before + 1)
      assert.deepEqual(
        result,
        native ? { data: { durl: [{ url: media('fresh-' + reads) }] } } : undefined,
      )
    }
  })
}
