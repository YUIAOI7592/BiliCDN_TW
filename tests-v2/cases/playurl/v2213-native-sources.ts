import { challengeOnce } from '../../support/challenge.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SignedRouteVault } from '../../../src-v2/state/signed-route-vault.ts'
import { generationId, epochId } from '../../../src-v2/domain/model.ts'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import { PlayurlAdapter } from '../../../src-v2/adapters/playurl/playurl.ts'
import { fixture } from '../routing/routing-fixture.ts'
import { testScope } from '../../support/scope.ts'
import { type RegisterRepresentationInput } from '../../../src-v2/state/vault-contracts.ts'

for (const opaque of [false, true])
  test(`V2219 registration: opaque=${opaque} preserves metadata and trusted promotion`, async (t) => {
    const scope = testScope(t),
      f = fixture(scope)
    await f.settings.update({ considerNativeSources: true })
    const original = opaque ? 'https://opaque.example.invalid/signed' : url(hosts[0]!, 'first')
    const replacement = opaque
      ? 'https://opaque.example.invalid/new-signed'
      : url(hosts[0]!, 'next')
    const registrations: RegisterRepresentationInput[] = []
    const register = f.vault.register.bind(f.vault)
    const previous = f.vault.register
    scope.defer(() => {
      f.vault.register = previous
    })
    f.vault.register = (input) => {
      registrations.push(input)
      return register(input)
    }
    const make = (sourceUrl: string) => {
      const value = payload([sourceUrl])
      Object.assign(value.data.dash.video[0]!, { frame_rate: '60000/1001' })
      return value
    }
    assert.equal(f.adapter.transform(make(original), 'page-hint').accepted, true)
    const provisional = f.vault.match(original).context
    assert.ok(provisional)
    assert.equal(f.vault.match(original).status, opaque ? 'weak' : 'matched')
    assert.equal(f.adapter.transform(make(replacement), 'trusted-api').accepted, true)
    const trusted = f.vault.match(replacement).context
    assert.ok(trusted)
    assert.equal(f.vault.match(replacement).status, opaque ? 'weak' : 'matched')
    assert.equal(f.vault.isCurrentIdentity(provisional), false)
    assert.equal(f.vault.source(trusted.representation), 'trusted-api')
    assert.deepEqual(f.vault.sourceURLs(trusted.representation), [replacement])
    assert.equal(f.adapter.transform(make(original), 'page-hint').accepted, true)
    assert.deepEqual(f.vault.sourceURLs(trusted.representation), [replacement])
    assert.equal(f.vault.isCurrentIdentity(trusted), true)
    assert.deepEqual(
      registrations.map(
        ({ source, refreshTrustedSources, kind, key, height, codec, bandwidth, frameRate }) => ({
          source,
          refreshTrustedSources,
          kind,
          key,
          height,
          codec,
          bandwidth,
          frameRate,
        }),
      ),
      ['page-hint', 'trusted-api', 'page-hint'].map((source) => ({
        source,
        refreshTrustedSources: source === 'trusted-api',
        kind: 'video',
        key: '80:avc:1080',
        height: 1080,
        codec: 'avc',
        bandwidth: 4_000_000,
        frameRate: 60000 / 1001,
      })),
    )
  })

const url = (host: string, variant = '') =>
  `https://${host}/upgcxcode/v2213/video.m4s?synthetic=${variant}`
const hosts = Array.from({ length: 6 }, (_, index) => `upos-v2213-${index}.bilivideo.com`)
function vaultFixture() {
  const vault = new SignedRouteVault()
  const generation = generationId(1),
    epoch = epochId(1)
  vault.reset(generation, epoch)
  const input = (
    urls: readonly string[],
    source: 'trusted-api' | 'page-hint' | 'player-mpd' = 'trusted-api',
  ) => ({
    generation,
    epoch,
    kind: 'video' as const,
    key: 'synthetic',
    height: 1080,
    codec: 'avc',
    bandwidth: 4_000_000,
    urls,
    source,
  })
  return { vault, input }
}
const payload = (sources: readonly string[]) => ({
  code: 0,
  data: {
    dash: {
      video: [
        {
          id: 80,
          height: 1080,
          codecs: 'avc1.640028',
          bandwidth: 4_000_000,
          base_url: sources[0]!,
          backup_url: sources.slice(1),
        },
      ],
      audio: [],
    },
  },
})

for (const position of [16, 17])
  test(`V2213 sources: trusted raw position ${position} respects the sixteen-position scan`, () => {
    const f = vaultFixture(),
      good = url(hosts[0]!)
    const rep = f.vault.register(
      f.input([...Array.from({ length: position - 1 }, () => 'invalid'), good]),
    )
    assert.equal(rep !== null, position === 16)
    if (rep) assert.deepEqual(f.vault.sourceURLs(rep), [good])
  })

test('V2213 sources: primary and different selectable hosts precede same-host variants', () => {
  const f = vaultFixture(),
    primary = url(hosts[0]!, 'primary')
  const rep = f.vault.register(
    f.input([
      primary,
      ...[1, 2, 3].map((n) => url(hosts[0]!, String(n))),
      url(hosts[1]!),
      url(hosts[2]!),
      url(hosts[3]!),
    ]),
  )!
  assert.deepEqual(f.vault.sourceURLs(rep), [
    primary,
    url(hosts[1]!),
    url(hosts[2]!),
    url(hosts[3]!),
  ])
})

test('V2213 sources: selectable hosts precede extra opaque or PCDN observations without granting them Native rights', () => {
  const f = vaultFixture(),
    opaque = 'https://opaque.example.invalid/signed',
    pcdn = 'https://x.szbdyd.com/video.m4s'
  const sources = [
    opaque,
    pcdn,
    'https://opaque-2.example.invalid/signed',
    url(hosts[0]!),
    url(hosts[1]!),
    url(hosts[2]!),
  ]
  const rep = f.vault.register(f.input(sources))!
  assert.deepEqual(f.vault.sourceURLs(rep), [
    opaque,
    url(hosts[0]!),
    url(hosts[1]!),
    url(hosts[2]!),
  ])
  assert.deepEqual(
    f.vault.candidates(rep, new Set()).native.map((row) => row.host),
    hosts.slice(0, 3),
  )
  const other = f.vault.register({ ...f.input([pcdn, opaque]), key: 'non-selectable' })!
  assert.equal(f.vault.candidates(other, new Set()).native.length, 0)
  assert.equal(f.vault.candidates(other, new Set()).root, null)
})

for (const source of ['page-hint', 'player-mpd'] as const)
  test(`V2213 sources: ${source} retains its four-raw-position authority bound`, () => {
    const f = vaultFixture(),
      good = url(hosts[0]!)
    assert.equal(f.vault.register(f.input(['bad1', 'bad2', 'bad3', 'bad4', good], source)), null)
    const rep = f.vault.register(f.input([good]))!
    const identity = f.vault.identity(rep)
    f.vault.register(f.input([url(hosts[1]!), good], source))
    assert.equal(f.vault.identity(rep), identity)
    assert.deepEqual(f.vault.sourceURLs(rep), [good])
  })

test('V2213 sources: a trusted refresh with no admitted source revokes old exact authority', () => {
  const f = vaultFixture(),
    original = url(hosts[0]!)
  const rep = f.vault.register(f.input([original]))!,
    identity = f.vault.identity(rep)!
  const handle = f.vault.candidates(rep, new Set()).root!.handle!
  assert.equal(f.vault.register({ ...f.input(['invalid']), refreshTrustedSources: true }), null)
  assert.equal(f.vault.resolve(handle, identity), null)
  assert.equal(f.vault.match(original).source, 'none')
})

test('V2213 startup: a rejected first Native backup does not hide a later legal backup', async (t) => {
  const f = fixture(testScope(t)),
    primary = url(hosts[0]!),
    later = url(hosts[1]!)
  await f.settings.update({ considerNativeSources: true })
  await f.restrictions.add({
    host: TRUSTED_CATALOG[2]!,
    kind: 'video',
    type: 'black',
    reason: 'synthetic',
    expireAt: f.clock.now() + 60_000,
  })
  const state = f.session.get()
  f.vault.register({
    generation: state.generation,
    epoch: state.epoch,
    kind: 'video',
    key: 'startup',
    height: 1080,
    codec: 'avc',
    bandwidth: 4_000_000,
    urls: [primary, url(TRUSTED_CATALOG[2]!), later],
    source: 'trusted-api',
  })
  const options = f.routes.startupOptions(primary)!
  assert.equal(options.candidates.filter((row) => row.type === 'native-signed').length, 1)
  assert.ok(options.candidates.some((row) => row.url === later))
  assert.ok(options.candidates.length <= 3)
})

test('V2213 DASH: a newer trusted source set replaces old hosts and revokes old handles', async (t) => {
  const f = fixture(testScope(t))
  await f.settings.update({
    considerNativeSources: true,
    catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map((h) => [h, false])),
  })
  const old = payload(hosts.slice(0, 4).map((h) => url(h))),
    next = payload(hosts.slice(2, 6).map((h) => url(h)))
  assert.equal(
    f.adapter.transform(old, 'trusted-api', 'first', { contentId: '42', requestSequence: 1 })
      .accepted,
    true,
  )
  const identity = f.vault.match(url(hosts[0]!)).context!,
    handle = f.vault.candidates(identity.representation, new Set()).root!.handle!
  assert.equal(
    f.adapter.transform(next, 'trusted-api', 'second', { contentId: '42', requestSequence: 2 })
      .accepted,
    true,
  )
  assert.deepEqual(
    f.vault.sourceURLs(identity.representation),
    hosts.slice(2, 6).map((h) => url(h)),
  )
  assert.equal(f.vault.resolve(handle, identity), null)
  assert.ok(hosts.slice(2, 6).includes(new URL(next.data.dash.video[0]!.base_url).hostname))
})

test('V2213 DASH: reordered identical exact sources preserve handles and update primary', async (t) => {
  const f = fixture(testScope(t)),
    first = url(hosts[0]!),
    second = url(hosts[1]!)
  await f.settings.update({ considerNativeSources: true })
  f.adapter.transform(payload([first, second]), 'trusted-api', 'one', {
    contentId: '42',
    requestSequence: 1,
  })
  const identity = f.vault.match(first).context!,
    handle = f.vault.candidates(identity.representation, new Set()).root!.handle!
  f.adapter.transform(payload([second, first]), 'trusted-api', 'two', {
    contentId: '42',
    requestSequence: 2,
  })
  assert.equal(f.vault.identity(identity.representation), identity)
  assert.equal(f.vault.rootUrl(identity.representation), second)
  assert.equal(f.vault.resolve(handle, identity), first)
})

test('V2213 DASH: player output cannot grant aliases to non-admitted raw sources', async (t) => {
  const f = fixture(testScope(t)),
    original = payload(hosts.map((h) => url(h)))
  await f.settings.update({
    considerNativeSources: true,
    catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map((h) => [h, false])),
  })
  assert.equal(f.adapter.transform(original).accepted, true)
  const identity = f.vault.match(url(hosts[0]!)).context!,
    admitted = f.vault.sourceURLs(identity.representation)
  assert.equal(admitted.length, 4)
  assert.ok(
    [original.data.dash.video[0]!.base_url, ...original.data.dash.video[0]!.backup_url].every(
      (raw) => admitted.includes(raw),
    ),
  )
  assert.equal(f.vault.match(url(hosts[4]!)).source, 'path-hint')
  assert.equal(f.vault.match(url(hosts[4]!)).status, 'weak')
  assert.deepEqual(
    f.vault
      .candidates(identity.representation, new Set())
      .native.map((row) => f.vault.resolve(row.handle, identity)),
    admitted,
  )
})

test('V2213 DASH: the opaque-primary branch also replaces trusted exact sources', async (t) => {
  const f = fixture(testScope(t)),
    old = 'https://opaque-old.example.invalid/signed',
    fresh = 'https://opaque-fresh.example.invalid/signed'
  await f.settings.update({ considerNativeSources: true })
  assert.equal(
    f.adapter.transform(payload([old]), 'trusted-api', 'one', {
      contentId: '42',
      requestSequence: 1,
    }).accepted,
    true,
  )
  const identity = f.vault.match(old).context!
  assert.equal(
    f.adapter.transform(payload([fresh]), 'trusted-api', 'two', {
      contentId: '42',
      requestSequence: 2,
    }).accepted,
    true,
  )
  assert.deepEqual(f.vault.sourceURLs(identity.representation), [fresh])
  assert.equal(f.vault.match(old).source, 'none')
  assert.notEqual(f.vault.identity(identity.representation), identity)
  assert.equal(f.vault.candidates(identity.representation, new Set()).native.length, 0)
})

test('V2213 DASH: a late probe from the replaced source cannot create health evidence', async (t) => {
  const f = fixture(testScope(t)),
    original = url(hosts[0]!),
    replacement = url(hosts[1]!)
  await f.settings.update({ considerNativeSources: true })
  f.adapter.transform(payload([original]), 'trusted-api', 'one', {
    contentId: '42',
    requestSequence: 1,
  })
  const rep = f.vault.match(original).context!.representation
  const applied = challengeOnce(f.routes, rep, true)!
  assert.ok(applied)
  f.adapter.transform(payload([replacement]), 'trusted-api', 'two', {
    contentId: '42',
    requestSequence: 2,
  })
  await f.routes.recordChallenge(applied, 128 * 1024, 1000, 10, 'success', null)
  assert.equal(f.evidence.get(applied.decision.host!, 'video'), null)
})

test('V2213 DASH: a full Vault cannot reintroduce unadmitted backups through fallback output', async (t) => {
  const f = fixture(testScope(t))
  await f.settings.update({
    considerNativeSources: true,
    catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map((host) => [host, false])),
  })
  const state = f.session.get()
  for (let index = 0; index < 128; index++)
    assert.ok(
      f.vault.register({
        generation: state.generation,
        epoch: state.epoch,
        kind: 'video',
        key: `filled-${index}`,
        height: 1080,
        codec: 'avc',
        bandwidth: 4_000_000,
        urls: [`https://${hosts[0]}/upgcxcode/cap/${index}.m4s`],
        source: 'trusted-api',
      }),
    )
  const body = payload(hosts.map((host) => url(host)))
  assert.equal(f.adapter.transform(body).accepted, true)
  const output = [body.data.dash.video[0]!.base_url, ...body.data.dash.video[0]!.backup_url]
  assert.equal(output.length, 4)
  assert.deepEqual(
    output,
    hosts.slice(0, 4).map((host) => url(host)),
  )
})

for (const kind of ['video', 'audio', 'combined-video', 'mixed-video', 'audio-variant'] as const)
  test(`V2213 parser: rejects ${kind} overflow before reading member fields`, () => {
    let reads = 0
    const poison = {
      get id() {
        reads++
        return 80
      },
      get url() {
        reads++
        return url(hosts[0]!)
      },
    }
    const entries = Array.from(
      { length: kind === 'audio' ? 65 : kind === 'combined-video' ? 65 : 129 },
      () => poison,
    )
    const body =
      kind === 'mixed-video'
        ? { data: { dash: { video: entries.slice(0, 64) }, durl: entries.slice(0, 65) } }
        : kind === 'audio-variant'
          ? { data: { dash: { audio: entries.slice(0, 64), dolby: { audio: poison } } } }
          : kind === 'combined-video'
            ? {
                data: { dash: { video: entries } },
                result: { dash: { video: entries.slice(0, 64) } },
              }
            : { data: { dash: { [kind]: entries } } }
    const adapter = new PlayurlAdapter({
      active: () => true,
      catalogOnly: () => false,
      lifecycleKey: () => 'synthetic',
      ingest: () => {
        throw Error('overflow reached ingestion')
      },
      acceptResponse: () => undefined,
    })
    const result = adapter.transform(body)
    assert.equal(result.reason, 'malformed-payload')
    assert.equal(reads, 0)
  })

test('V2213 parser: invalid raw positions are not compressed before the trusted scan bound', (t) => {
  const f = fixture(testScope(t)),
    good = url(hosts[0]!)
  const body = payload(['invalid'])
  body.data.dash.video[0]!.backup_url = [
    ...Array.from({ length: 15 }, () => null),
    good,
  ] as unknown as string[]
  assert.equal(f.adapter.transform(body).accepted, false)
  assert.equal(f.vault.match(good).context, null)
})

test('V2213 parser: raw position sixteen is admitted without reading position seventeen', async (t) => {
  const f = fixture(testScope(t)),
    original = url(hosts[0]!),
    last = url(hosts[1]!)
  await f.settings.update({ considerNativeSources: true })
  const body = payload([original])
  const backups = Array.from({ length: 15 }, (_, i) => (i === 14 ? last : 'invalid'))
  Object.defineProperty(backups, 15, {
    get() {
      throw Error('read raw source seventeen')
    },
    enumerable: true,
  })
  body.data.dash.video[0]!.backup_url = backups
  assert.equal(f.adapter.transform(body).accepted, true)
  const rep = f.vault.match(original).context!.representation
  assert.deepEqual(f.vault.sourceURLs(rep), [original, last])
})

for (const kind of ['video', 'audio'] as const)
  test(`V2213 parser: page-hint ${kind} getter cannot extend preflighted inventory`, () => {
    const limit = kind === 'video' ? 128 : 64
    let extraUrlReads = 0,
      grown = false,
      admittedCount = 0
    const entries = Array.from({ length: limit }, (_, index) => ({
      id: index,
      base_url: url(hosts[0]!, String(index)),
    }))
    Object.defineProperty(entries[0]!, 'base_url', {
      get() {
        if (!grown) {
          grown = true
          entries.push({
            id: limit,
            get base_url() {
              extraUrlReads++
              return url(hosts[1]!, 'late-member')
            },
          })
        }
        return url(hosts[0]!, 'first-member')
      },
      enumerable: true,
    })
    const adapter = new PlayurlAdapter({
      active: () => true,
      catalogOnly: () => false,
      lifecycleKey: () => 'synthetic',
      ingest: (input) => {
        admittedCount = input![kind].length
        return []
      },
      acceptResponse: () => undefined,
    })
    const result = adapter.transform({ data: { dash: { [kind]: entries } } }, 'page-hint')
    assert.equal(result.accepted, true)
    assert.equal(entries.length, limit + 1, 'the ordinary member getter grew its source array')
    assert.equal(admittedCount, limit, 'ingestion retains the preflighted media bound')
    assert.equal(extraUrlReads, 0, 'late members cannot add URL reads to this transformation')
  })

for (const kind of ['video', 'audio'] as const) {
  const limit = kind === 'video' ? 128 : 64
  test(`V2213 parser: ${kind} rejects invalid inventory counts before reading members`, () => {
    for (const count of [NaN, -1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      let reads = 0
      const prefix = new Proxy([], {
        get(target, property, receiver) {
          return property === 'length' ? count : Reflect.get(target, property, receiver)
        },
      })
      const member = {
        get id() {
          reads++
          return 80
        },
      }
      const entries = Array.from({ length: Number.isNaN(count) ? limit + 1 : 1 }, () => member)
      const adapter = new PlayurlAdapter({
        active: () => true,
        catalogOnly: () => false,
        lifecycleKey: () => 'synthetic',
        ingest: () => [],
        acceptResponse: () => undefined,
      })
      const result = adapter.transform(
        {
          data: { dash: { [kind]: prefix } },
          result: { dash: { [kind]: entries } },
        },
        'page-hint',
      )
      assert.equal(reads, 0, `invalid count ${count} cannot expose later representation fields`)
      assert.equal(result.reason, 'malformed-payload', `invalid count ${count}`)
    }
  })

  test(`V2213 parser: ${kind} accepts zero and maximum valid inventory counts`, () => {
    let admittedCount = 0
    const adapter = new PlayurlAdapter({
      active: () => true,
      catalogOnly: () => false,
      lifecycleKey: () => 'synthetic',
      ingest: (input) => {
        admittedCount = input![kind].length
        return []
      },
      acceptResponse: () => undefined,
    })
    const result = adapter.transform(
      {
        data: { dash: { [kind]: [] } },
        result: { dash: { [kind]: Array.from({ length: limit }, (_, id) => ({ id })) } },
      },
      'page-hint',
    )
    assert.equal(result.accepted, true)
    assert.equal(admittedCount, limit)
  })
}
