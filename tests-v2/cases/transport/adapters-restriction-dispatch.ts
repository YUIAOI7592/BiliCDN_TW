import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { installProgressEvent } from '../../support/progress-event.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import { TransportAdapter } from '../../../src-v2/adapters/transport/transport.ts'
import { testScope } from '../../support/scope.ts'
import { fixture } from '../routing/routing-fixture.ts'
import { createTransportHookResources } from './adapters-resources.ts'

const forbiddenUrl = 'https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/test/output/1.m4s?k=1'
function outputFixture(t: TestContext) {
  const scope = testScope(t),
    f = fixture(scope)
  const item = {
    id: 80,
    codecid: 13,
    height: 1080,
    bandwidth: 1_000_000,
    base_url: forbiddenUrl,
    backup_url: [forbiddenUrl],
  }
  assert.equal(f.adapter.transform({ data: { dash: { video: [item], audio: [] } } }).accepted, true)
  return { ...f, scope, item }
}

for (const type of ['black', 'dead'] as const) {
  test(`${type} invalidates cached fallback on next request [9]`, { timeout: 5000 }, async (t) => {
    const f = outputFixture(t)
    const alternate = f.item.backup_url.find(
      (url) => new URL(url).host !== new URL(f.item.base_url).host,
    )
    assert.ok(alternate)
    const host = new URL(alternate).host,
      adopted = f.routes.apply(alternate)
    assert.equal(adopted.url, alternate)
    assert.equal(adopted.decision.reason, 'player-fallback', 'the cached plan is an adopted backup')
    await f.restrictions.add({
      host,
      type,
      kind: 'all',
      reason: 'regression',
      expireAt: f.clock.now() + 60_000,
    })
    assert.notEqual(f.routes.apply(alternate).decision.host, host)
    await f.settings.update({ fixedHost: host })
    f.routes.invalidateForUserSetting()
    assert.notEqual(
      f.routes.apply(alternate).decision.host,
      host,
      'fixed selection still respects restrictions',
    )
    const item = { ...f.item, base_url: forbiddenUrl, backup_url: [alternate] }
    f.adapter.transform({ data: { dash: { video: [item], audio: [] } } })
    assert.ok(![item.base_url, ...item.backup_url].some((url) => url && new URL(url).host === host))
  })
}

for (const type of ['black', 'dead'] as const) {
  test(`${type} blocks PCDN-marked Catalog host [12]`, { timeout: 5000 }, async (t) => {
    const f = fixture(testScope(t)),
      host = TRUSTED_CATALOG[0]
    await f.settings.update({ considerNativeSources: true })
    const url = `https://${host}/upgcxcode/test/ungrouped/1.m4s?k=1&os=mcdn`
    assert.equal(
      f.routes.apply(url).url,
      url,
      'the ungrouped exceptional source is initially allowed',
    )
    await f.restrictions.add({
      host,
      type,
      kind: 'all',
      reason: 'exceptional',
      expireAt: f.clock.now() + 60_000,
    })
    assert.equal(f.routes.apply(url).url, null)
  })
}

test(
  'V221 audio restrictions remain enforced without diagnostic reports',
  { timeout: 5000 },
  async (t) => {
    const f = fixture(testScope(t)),
      host = TRUSTED_CATALOG[0]
    const ungroupedUrl = `https://${host}/upgcxcode/test/ungrouped/1.m4s?k=1`
    await f.restrictions.add({
      host,
      type: 'black',
      kind: 'audio',
      reason: 'ungrouped-audio',
      expireAt: f.clock.now() + 60_000,
    })
    assert.notEqual(
      f.routes.apply(ungroupedUrl).decision.host,
      host,
      'unknown media also observes audio-only blacklist',
    )
    await f.restrictions.remove(host, 'black')
    const audioUrl = `https://${host}/upgcxcode/test/audio/1.m4s?k=1`,
      state = f.session.get()
    assert.ok(
      f.vault.register({
        generation: state.generation,
        epoch: state.epoch,
        kind: 'audio',
        key: 'scope-audio',
        height: 0,
        codec: 'other',
        bandwidth: 128_000,
        urls: [audioUrl],
        source: 'trusted-api',
      }),
    )
    await f.restrictions.add({
      host,
      type: 'black',
      kind: 'all',
      reason: 'user',
      expireAt: f.clock.now() + 60_000,
    })
    assert.notEqual(f.routes.apply(audioUrl).decision.host, host)
    assert.equal(f.routes.apply(`${audioUrl}&os=mcdn`).url, null)
  },
)

test(
  'V221 XHR retains single dispatch and before-send restriction checks',
  { timeout: 5000 },
  async (t) => {
    const f = outputFixture(t)
    installProgressEvent(f.scope)
    const { fakeWindow, FakeXhr } = await createTransportHookResources()
    f.scope.defineGlobal('unsafeWindow', { configurable: true, value: fakeWindow })
    f.scope.defineGlobal('location', {
      configurable: true,
      value: new URL('https://www.bilibili.com/video/BVtest/'),
    })
    const adapter = f.scope.own(
      new TransportAdapter(
        f.session,
        f.settings,
        f.routes,
        f.adapter,
        { willGateStartup: () => false, prepareStartup: async () => {}, noteUnpreflighted() {} },
        f.clock.now,
        createRuntimeIds(),
        undefined,
        f.clock.now,
      ),
    )
    adapter.install()
    const tracedXhr = new FakeXhr()
    tracedXhr.open('GET', f.item.base_url)
    tracedXhr.send()
    await Promise.resolve()
    const latest = f.routes.snapshot().latest.video
    assert.equal(tracedXhr.nativeSends, 1)
    assert.equal(latest?.targetHost, new URL(tracedXhr.url).host)
    assert.equal(latest?.playurlOutput?.originalHost, 'upos-sz-mirrorcosov.bilivideo.com')
    const actualXhr = new FakeXhr()
    actualXhr.open('GET', forbiddenUrl)
    assert.ok(!actualXhr.url.includes('mirrorcosov'), 'open selects a legal replacement')
    const beforeSendHost = new URL(actualXhr.url).host
    await f.restrictions.add({
      host: beforeSendHost,
      type: 'black',
      kind: 'all',
      reason: 'before-send',
      expireAt: f.clock.now() + 60_000,
    })
    actualXhr.send()
    assert.equal(actualXhr.nativeSends, 1)
    assert.notEqual(new URL(actualXhr.url).host, beforeSendHost)
    await f.settings.update({
      catalogOverrides: Object.fromEntries(TRUSTED_CATALOG.map((host) => [host, false])),
    })
    const blockedXhr = new FakeXhr()
    blockedXhr.open('GET', forbiddenUrl)
    blockedXhr.send()
    assert.equal(blockedXhr.nativeSends, 0, 'no alternative never sends a forbidden request')
  },
)
