import { createControlReadModel } from '../../src-v2/ui/control-read-model.ts'
import test, { type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../support/runtime-fixture.ts'
import { FakeStorage } from '../support/storage.ts'
import { ControlCenter } from '../../src-v2/ui/control-center.ts'
import type { ControlModelSources } from '../../src-v2/ui/control-contracts.ts'
import { TRUSTED_CATALOG } from '../../src-v2/domain/catalog.ts'
import { DEFAULT_UNAVAILABLE_HOSTS } from '../../src-v2/domain/catalog.ts'
import { media } from '../support/runtime-fixture.ts'
import { representationId } from '../../src-v2/domain/model.ts'
import { overviewPresentation } from '../../src-v2/ui/overview-presentation.ts'
import { EVIDENCE_TTL_MS } from '../../src-v2/domain/evidence.ts'
import { EVIDENCE_KEY } from '../../src-v2/state/evidence-store.ts'

async function completeVideo(f: ReturnType<typeof ui>, url: string) {
  f.request(url)
  const request = f.routes.latestRequested('video')!
  await f.routes.observe({
    request,
    generation: request.generation,
    epoch: request.epoch,
    representation: request.representation,
    kind: 'video',
    decisionId: request.decisionId,
    routeType: request.routeType,
    originalHost: request.originalHost,
    targetHost: request.targetHost,
    finalHost: request.targetHost,
    streamKey: null,
    status: 206,
    bytes: 1024 * 1024,
    elapsedMs: 200,
    ttfbMs: 10,
    completedAt: f.clock.now(),
    outcome: 'success',
    responseUrlMatchesRequest: true,
  })
}

function capacityView(t: TestContext) {
  const f = ui(t),
    body = media(225)
  assert.equal(f.playurl.transform(body, 'trusted-api').accepted, true)
  f.setVideo({
    ...f.video(),
    playbackRate: 1,
    effectiveRate: 1,
    paused: true,
    width: 1920,
    height: 1080,
    readyState: 4,
    bufferAheadSec: 100,
    playableBufferSec: 100,
  })
  f.deps.monitor.tick()
  return { f, body }
}

for (const role of ['primary', 'backup'] as const) {
  test(`V225 ${role} successful learning updates the real read model and overview on the existing tick`, async (t) => {
    const { f, body } = capacityView(t),
      row = body.data.dash.video[0]!
    const url = role === 'primary' ? row.base_url : row.backup_url[0]!
    assert.ok(url)
    const decision = f.routes.apply(url, 'video').decision
    if (role === 'backup') assert.equal(decision.ranking.length, 0)
    await completeVideo(f, url)
    assert.equal(
      f.routes.snapshot().currentCapacity,
      null,
      'one transfer does not confirm the video representation',
    )
    await completeVideo(f, url)
    f.clock.advance(1000)
    const display = overviewPresentation(createControlReadModel(f.deps).snapshot(), f.clock.now())
    assert.equal(display.safeMbps, 41.94304)
    assert.equal(display.requiredMbps, 5)
    assert.equal(display.ratio, 41.94304 / 5)
    assert.ok(display.speedHint.includes(f.routes.snapshot().currentCapacity!.host))
    const values = f.doc.flatten().filter((e) => e.className === 'value')
    assert.equal(values[1]!.textContent, '41.94')
    assert.equal(values[2]!.textContent, '8.39')
    assert.equal(
      f.doc.flatten().some((e) => e.className === 'summary'),
      false,
    )
    assert.match(readSummary(f).textContent, /保守吞吐 41\.94 Mbps｜需求 5\.00 Mbps｜餘裕 8\.39 倍/)
    if (role === 'primary') assert.equal(f.routes.apply(url, 'video').decision, decision)
  })
}

test('V225 actual rate changes update margin while on-demand text and route ownership remain stable', async (t) => {
  const { f, body } = capacityView(t),
    url = body.data.dash.video[0]!.base_url
  await completeVideo(f, url)
  await completeVideo(f, url)
  f.clock.advance(1000)
  const decision = f.routes.apply(url, 'video').decision,
    affinity = f.session.get().affinity
  const summary = readSummary(f),
    before = summary.textContent,
    calls = structuredClone(f.calls)
  const events: string[] = []
  f.scope.defer(f.routes.subscribe((event) => events.push(event.type)))
  const stored = structuredClone([...f.storage.values]),
    tasks = f.clock.pendingCount
  f.setVideo({ ...f.video(), playbackRate: 2, effectiveRate: 2 })
  f.clock.advance(1000)
  assert.equal(summary.textContent, before, 'the long text is not rebuilt on each tick')
  assert.equal(f.doc.flatten().filter((e) => e.className === 'value')[2]!.textContent, '4.19')
  f.button('收起詳細狀態').emit('click')
  assert.match(readSummary(f).textContent, /需求 10\.00 Mbps｜餘裕 4\.19 倍/)
  assert.equal(f.routes.apply(url, 'video').decision, decision)
  assert.equal(f.session.get().affinity, affinity)
  assert.deepEqual(events, [])
  assert.deepEqual([...f.storage.values], stored)
  assert.deepEqual(f.calls, calls)
  assert.equal(f.clock.pendingCount, tasks)
  for (const page of ['CDN', '播放設定', '總覽']) f.button(page).emit('click')
  assert.equal(f.doc.flatten().filter((e) => e.className === 'value')[2]!.textContent, '4.19')
  f.center.close()
  f.center.show()
  assert.match(readSummary(f).textContent, /需求 10\.00 Mbps/)
})

test('V225 confirmed representation change uses its bitrate and keeps the two-transfer threshold', async (t) => {
  const { f, body } = capacityView(t),
    first = body.data.dash.video[0]!.base_url
  await completeVideo(f, first)
  await completeVideo(f, first)
  const state = f.session.get(),
    second = first.replace('30080.m4s', '30120.m4s')
  const representation = f.vault.register({
    generation: state.generation,
    epoch: state.epoch,
    kind: 'video',
    key: 'higher-bitrate',
    height: 2160,
    codec: 'avc',
    bandwidth: 8_000_000,
    urls: [second],
    source: 'trusted-api',
  })
  assert.ok(representation)
  await completeVideo(f, second)
  assert.equal(f.session.get().representation, state.representation)
  await completeVideo(f, second)
  assert.equal(f.session.get().representation, representation)
  const display = overviewPresentation(createControlReadModel(f.deps).snapshot(), f.clock.now())
  assert.equal(display.requiredMbps, 10)
  assert.equal(display.ratio, 41.94304 / 10)
})

test('V225 overview expires retained samples without a transfer and recovers after learning', async (t) => {
  const { f, body } = capacityView(t),
    url = body.data.dash.video[0]!.base_url
  await completeVideo(f, url)
  await completeVideo(f, url)
  f.deps.monitor.stop()
  f.clock.advance(EVIDENCE_TTL_MS + 1)
  f.center.show()
  assert.equal(f.doc.flatten().filter((e) => e.className === 'value')[1]!.textContent, '—')
  assert.match(readSummary(f).textContent, /目前路線的速度樣本已過期/)
  await completeVideo(f, url)
  f.center.show()
  assert.equal(f.doc.flatten().filter((e) => e.className === 'value')[1]!.textContent, '29.36')
})

for (const rate of [NaN, Infinity, 0, -1, Number.MIN_VALUE, Number.MAX_VALUE]) {
  test(`V225 actual playback rate ${rate} never uses the control fallback for UI demand`, (t) => {
    const f = ui(t)
    setOverviewCapacity(f, 12, rate === Number.MAX_VALUE ? Number.MAX_VALUE : 4_000_000, rate)
    const display = overviewPresentation(createControlReadModel(f.deps).snapshot(), f.clock.now())
    assert.equal(display.safeMbps, 12)
    assert.equal(display.ratio, null)
    assert.equal(display.requiredMbps, null)
    assert.equal(display.marginHint, '尚無有效需求估計')
  })
}

test('V225 unavailable player keeps valid speed but cannot establish demand', (t) => {
  const f = ui(t)
  setOverviewCapacity(f, 12, 4_000_000)
  f.setVideo({ ...f.video(), available: false })
  f.deps.monitor.tick()
  const display = overviewPresentation(createControlReadModel(f.deps).snapshot(), f.clock.now())
  assert.equal(display.safeMbps, 12)
  assert.equal(display.requiredMbps, null)
  assert.equal(display.ratio, null)
})

test('V225 shared measurement cooldown does not attribute it to another tab', (t) => {
  const f = ui(t),
    before = f.measurement.snapshot()
  f.measurement.snapshot = () => ({ ...before, state: 'waiting', reason: 'cross-tab-cooldown' })
  f.center.show()
  assert.match(readSummary(f).textContent, /共用測速冷卻中/)
  assert.doesNotMatch(readSummary(f).textContent, /其他分頁最近/)
})

test('V225 remote learning and clear are reflected by the existing overview refresh', async (t) => {
  const { f, body } = capacityView(t),
    url = body.data.dash.video[0]!.base_url
  await completeVideo(f, url)
  await completeVideo(f, url)
  const saved = structuredClone(f.storage.values.get(EVIDENCE_KEY))
  await f.deps.evidence.clear()
  f.clock.advance(1000)
  assert.equal(f.doc.flatten().filter((e) => e.className === 'value')[1]!.textContent, '—')
  assert.match(readSummary(f).textContent, /目前路線尚無有效速度樣本/)
  f.storage.remote(EVIDENCE_KEY, { ...(saved as object), updatedAt: f.clock.now() })
  f.clock.advance(1000)
  assert.equal(f.doc.flatten().filter((e) => e.className === 'value')[1]!.textContent, '41.94')
  f.navigate()
  assert.equal(f.routes.snapshot().currentCapacity, null)
  f.clock.advance(1000)
  assert.equal(f.doc.flatten().filter((e) => e.className === 'value')[1]!.textContent, '—')
})

for (const field of [
  'generation',
  'epoch',
  'representation',
  'decisionId',
  'host',
  'routeType',
] as const) {
  test(`V225 mixed read-model ${field} cannot display another plan's capacity`, (t) => {
    const f = ui(t)
    setOverviewCapacity(f, 12, 4_000_000)
    const model = createControlReadModel(f.deps).snapshot(),
      capacity = model.routes.currentCapacity!
    const mismatch = {
      ...capacity,
      [field]: typeof capacity[field] === 'number' ? Number(capacity[field]) + 1 : 'other',
    }
    const display = overviewPresentation(
      { ...model, routes: { ...model.routes, currentCapacity: mismatch } },
      f.clock.now(),
    )
    assert.equal(display.safeMbps, null)
    assert.equal(display.ratio, null)
  })
}

test('V225 valid low bitrate uses the existing two Mbps display floor', (t) => {
  const f = ui(t)
  setOverviewCapacity(f, 12, 800_000, 1)
  const display = overviewPresentation(createControlReadModel(f.deps).snapshot(), f.clock.now())
  assert.equal(display.requiredMbps, 2)
  assert.equal(display.ratio, 6)
})

function setOverviewCapacity(
  f: ReturnType<typeof ui>,
  safeMbps: number | null,
  bandwidth: number | null,
  playbackRate = 1,
) {
  const representation = representationId('capacity-display')
  f.session.setRepresentation(representation)
  f.setVideo({ ...f.video(), playbackRate })
  f.deps.monitor.tick()
  const before = f.routes.snapshot()
  f.routes.snapshot = () => ({
    ...before,
    attribution: 'confirmed',
    representation: {
      kind: 'video',
      height: 1080,
      codec: 'avc',
      bandwidth: bandwidth ?? 0,
      routeCount: 1,
    },
    currentCapacity: {
      generation: f.session.get().generation,
      epoch: f.session.get().epoch,
      representation,
      decisionId: 'v224-capacity' as NonNullable<typeof before.activePlan>['id'],
      host: TRUSTED_CATALOG[0],
      routeType: 'catalog-generated',
      safeMbps,
      sampleStatus: safeMbps !== null ? 'available' : 'missing',
    },
    activePlan: {
      id: 'v224-capacity' as NonNullable<typeof before.activePlan>['id'],
      action: 'rewrite',
      reason: 'recent-success',
      routeType: 'catalog-generated',
      host: TRUSTED_CATALOG[0],
      ranking: [
        {
          host: TRUSTED_CATALOG[0],
          type: 'catalog-generated',
          state: 'usable',
          eligible: true,
          reasons: [],
          safeMbps,
          ratio: null,
          ttfbMs: 30,
        },
      ],
    },
  })
}

for (const boundary of ['generation', 'epoch'] as const) {
  test(`V224 display rejects media rows from an older ${boundary}`, (t) => {
    const f = ui(t),
      body = media(224)
    assert.equal(f.playurl.transform(body, 'trusted-api').accepted, true)
    f.request(body.data.dash.video[0]!.base_url)
    const before = f.routes.snapshot(),
      request = before.requested.video!
    const detached = { ...request, [boundary]: Number(request[boundary]) - 1 } as typeof request
    f.routes.snapshot = () => ({
      ...before,
      requested: { video: detached },
      latest: {
        video: {
          ...detached,
          kind: 'video',
          responseHost: 'old-response.example',
          outcome: 'success',
          status: 206,
          observedAt: f.clock.now(),
          attributionStatus: 'matched',
        },
      },
    })
    f.center.show()
    assert.ok(f.doc.flatten().some((e) => e.textContent === '目前尚未觀察到請求'))
    assert.equal(
      f.doc.flatten().some((e) => e.textContent.includes('old-response.example')),
      false,
    )
    assert.doesNotMatch(readSummary(f).textContent, /old-response\.example|影片：已送往/)
  })
}

for (const [label, width, height, available] of [
  ['non-finite', NaN, Infinity, true],
  ['zero', 0, 0, true],
  ['unavailable', 3840, 2160, false],
] as const) {
  test(`V224 ${label} native dimensions do not fabricate a format`, (t) => {
    const f = ui(t)
    f.setVideo({ ...f.video(), width, height, available })
    f.deps.monitor.tick()
    f.center.show()
    const badge = f.doc.flatten().find((e) => e.className === 'badge')!.textContent
    assert.equal(badge, '等待可辨識的影片資料')
    assert.doesNotMatch(badge, /NaN|Infinity|0×0|播放器，編碼/)
  })
}

test('V224 playing without request attribution shows native dimensions without granting route authority', (t) => {
  const f = ui(t)
  f.setVideo({
    ...f.video(),
    readyState: 4,
    width: 3840,
    height: 2160,
    playableBufferSec: 35.9,
    bufferAheadSec: 71.8,
    coreInitialized: true,
  })
  f.deps.monitor.tick()
  f.clock.advance(0)
  const state = f.session.get(),
    routes = f.routes.snapshot(),
    tasks = f.clock.pendingCount
  f.center.show()
  f.clock.advance(0)
  assert.ok(
    f.doc
      .flatten()
      .some((e) => e.className === 'badge' && e.textContent === '3840×2160（播放器，編碼未確認）'),
  )
  assert.deepEqual(
    f.doc
      .flatten()
      .filter((e) => e.className === 'value')
      .map((e) => e.textContent),
    ['35.9', '—', '—'],
  )
  assert.equal(
    f.doc.flatten().some((e) => e.className === 'summary'),
    false,
  )
  assert.match(readSummary(f).textContent, /目前畫質：3840×2160（播放器，編碼未確認）/)
  assert.match(readSummary(f).textContent, /等待可辨識影片資料/)
  assert.equal(f.session.get(), state)
  assert.deepEqual(f.routes.snapshot(), routes)
  assert.equal(f.clock.pendingCount, tasks)
})

for (const [label, safe, bandwidth, rate, ratio] of [
  ['missing demand', 12, null, 1, null],
  ['invalid demand', 12, NaN, 1, null],
  ['zero demand', 12, 0, 1, null],
  ['overflowing demand', Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE, null],
  ['underflowing demand', Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE, null],
  ['invalid speed', Infinity, 6_400_000, 1, null],
  ['missing speed', null, 6_400_000, 1, null],
  ['zero speed', 0, 6_400_000, 1, null],
  ['valid capacity', 12, 6_400_000, 1, 1.5],
] as const) {
  test(`V224 independent capacity display: ${label}`, (t) => {
    const f = ui(t)
    setOverviewCapacity(f, safe, bandwidth, rate)
    f.center.show()
    const speedValid = safe != null && Number.isFinite(safe) && safe > 0
    const demandValid = ratio !== null
    const values = f.doc.flatten().filter((e) => e.className === 'value')
    assert.equal(values[1]!.textContent, speedValid ? safe.toFixed(2) : '—')
    assert.equal(values[2]!.textContent, demandValid ? ratio.toFixed(2) : '—')
    const summary = readSummary(f).textContent
    assert.doesNotMatch(summary, /Infinity|NaN|需求 0\.00 Mbps/)
    if (speedValid) assert.ok(summary.includes('保守吞吐 ' + safe.toFixed(2) + ' Mbps'))
    if (speedValid && !demandValid) assert.match(summary, /尚無有效需求估計/)
  })
}

for (const [attribution, expected] of [
  ['awaiting-matched-video', '等待可辨識影片資料'],
  ['awaiting-second-video-transfer', '等待第二筆影片資料'],
  ['confirmed', '尚未建立目前路線'],
] as const) {
  test(`V224 missing route reason: ${attribution}`, (t) => {
    const f = ui(t),
      before = f.routes.snapshot()
    f.routes.snapshot = () => ({ ...before, attribution })
    f.center.show()
    assert.ok(f.doc.flatten().some((e) => e.className === 'detail' && e.textContent === expected))
    assert.ok(readSummary(f).textContent.includes(expected))
  })
}

test('V224 incomplete hooks and absent speed samples have distinct missing-data reasons', (t) => {
  const f = ui(t),
    before = f.deps.transport.snapshot()
  f.deps.transport.snapshot = () => ({ ...before, hookState: 'degraded', fetchInstalled: false })
  f.center.show()
  assert.ok(f.doc.flatten().some((e) => e.textContent === '請求攔截未完整'))
  f.deps.transport.snapshot = () => before
  setOverviewCapacity(f, null, null)
  f.center.show()
  assert.ok(f.doc.flatten().some((e) => e.textContent === '目前路線尚無有效速度樣本'))
})

for (const matches of [false, true]) {
  test(`V224 native dimensions ${matches ? 'agree with' : 'differ from'} the confirmed representation`, (t) => {
    const f = ui(t),
      before = f.routes.snapshot()
    f.setVideo({ ...f.video(), width: matches ? 3840 : 1920, height: matches ? 2160 : 1080 })
    f.deps.monitor.tick()
    f.routes.snapshot = () => ({
      ...before,
      representation: {
        kind: 'video',
        height: 2160,
        codec: 'av1',
        bandwidth: 12_000_000,
        routeCount: 1,
      },
    })
    f.center.show()
    const expected = matches ? '2160p / av1' : '1920×1080（播放器，編碼未確認）'
    assert.ok(f.doc.flatten().some((e) => e.className === 'badge' && e.textContent === expected))
    assert.ok(readSummary(f).textContent.includes('目前畫質：' + expected))
  })
}

test('V224 pending video target never becomes a response host and audio remains independent', (t) => {
  const f = ui(t),
    body = media(224)
  assert.equal(f.playurl.transform(body, 'trusted-api').accepted, true)
  f.request(body.data.dash.video[0]!.base_url)
  const before = f.routes.snapshot()
  assert.ok(before.requested.video)
  f.routes.snapshot = () => ({
    ...before,
    latest: {
      audio: {
        kind: 'audio',
        routeType: 'catalog-generated',
        originalHost: TRUSTED_CATALOG[0],
        targetHost: TRUSTED_CATALOG[1],
        responseHost: TRUSTED_CATALOG[1],
        outcome: 'success',
        status: 206,
        observedAt: f.clock.now(),
        attributionStatus: 'matched',
      },
    },
  })
  f.center.show()
  assert.deepEqual(
    f.doc
      .flatten()
      .filter((e) => e.className === 'route-host')
      .map((e) => e.textContent),
    ['尚未確認回應主機', TRUSTED_CATALOG[1]],
  )
  assert.ok(
    f.doc
      .flatten()
      .some((e) => e.textContent === '已送往 ' + before.requested.video!.targetHost + '，等待回應'),
  )
  assert.match(readSummary(f).textContent, /影片：已送往 .*等待回應/)
})

test('V221 control center exposes only overview, CDN and settings without diagnostic actions', (t) => {
  const f = ui(t)
  assert.deepEqual(
    f.doc
      .flatten()
      .filter((e) => e.className === 'tab')
      .map((e) => e.textContent),
    ['總覽', 'CDN', '播放設定'],
  )
  for (const page of ['總覽', 'CDN', '播放設定']) {
    f.button(page).emit('click')
    assert.equal(
      f.doc
        .flatten()
        .some((e) => /診斷|複製報告|匯出報告|記下剛剛的卡頓|只用 B 站原本/.test(e.textContent)),
      false,
    )
    assert.equal(
      f.doc.flatten().some((e) => e.tag === 'textarea'),
      false,
    )
  }
  f.button('總覽').emit('click')
  for (const label of ['可播放緩衝', '安全吞吐', '需求餘裕', '影片回應', '音訊回應'])
    assert.ok(f.doc.flatten().some((e) => e.textContent === label))
  assert.match(readSummary(f).textContent, /保守|緩衝/)
})

test('V220 CDN construction and refresh each capture one shared read model', (t) => {
  const f = ui(t)
  const original = f.routes.snapshot.bind(f.routes)
  let reads = 0
  f.routes.snapshot = () => {
    reads++
    return original()
  }
  f.button('CDN').emit('click')
  assert.equal(reads, 1)
  reads = 0
  f.storage.remote('bilicdn.v2.settings', { ...f.settings.get(), updatedAt: f.clock.now() + 1 })
  assert.equal(reads, 1)
})

test('V223 navigation initializes all three pages once from the current model', async (t) => {
  const f = ui(t)
  const playback = () => f.doc.flatten().find((e) => e.className === 'playback')!
  const initial = playback()
  assert.ok(initial.textContent)
  assert.ok(f.doc.flatten().some((e) => e.textContent === 'vcontract · 播放與路線狀態'))
  f.center.close()
  const host = TRUSTED_CATALOG[0]
  f.storage.remote('bilicdn.v2.settings', {
    ...f.settings.get(),
    fixedHost: host,
    considerNativeSources: false,
    earlyRetryEnabled: false,
    catalogOverrides: { [host]: false },
    updatedAt: f.clock.now() + 1,
  })
  await f.deps.restrictions.add({
    host,
    kind: 'all',
    type: 'black',
    reason: 'user',
    expireAt: f.clock.now() + 60000,
  })
  f.center.show()
  const reopened = playback()
  assert.notEqual(reopened, initial)
  assert.equal(reopened.textContent, initial.textContent)
  f.button('CDN').emit('click')
  const restrictions = f.doc.flatten().filter((e) => e.className === 'detail restriction')
  assert.equal(restrictions.length, TRUSTED_CATALOG.length)
  assert.equal(f.doc.flatten().find((e) => e.tag === 'select')!.value, host)
  assert.equal(f.toggle('允許參考 B 站原生來源').checked, false)
  for (const host of TRUSTED_CATALOG)
    assert.equal(
      f.toggle(host).checked,
      f.settings.get().catalogOverrides[host] ?? !DEFAULT_UNAVAILABLE_HOSTS.has(host),
    )
  assert.ok(restrictions.some((node) => /黑名單.*影片＋音訊/.test(node.textContent)))
  f.button('播放設定').emit('click')
  assert.equal(f.doc.flatten().filter((e) => e.type === 'checkbox').length, 6)
  for (const [key, label] of [
    ['startupEarlyReleaseEnabled', '起播提前放行'],
    ['healthMiddleRangeEnabled', '健康中段探測'],
    ['backupFamilyDiversityEnabled', '備援家族分散'],
    ['earlyRetryEnabled', '慢請求提前重試'],
    ['blockWebRtc', '阻止網頁使用 WebRTC'],
    ['blockHttpDns', '阻止網頁使用 HTTPDNS'],
  ] as const)
    assert.equal(f.toggle(label).checked, f.settings.get()[key])
  f.button('總覽').emit('click')
  const returned = playback()
  assert.notEqual(returned, reopened)
  assert.equal(returned.textContent, initial.textContent)
  assert.deepEqual(
    [initial, returned, reopened].map((node) => node.textWrites.filter(Boolean).length),
    [1, 1, 1],
  )
  assert.deepEqual(
    restrictions.map((node) => node.textWrites.length),
    restrictions.map(() => 1),
  )
})

class QueuedSettingsStorage extends FakeStorage {
  held = true
  tasks: (() => Promise<void>)[] = []
  override async withLock<T>(name: string, task: () => Promise<T> | T): Promise<T> {
    if (name !== 'settings' || !this.held) return await task()
    return await new Promise<T>((resolve, reject) =>
      this.tasks.push(async () => {
        try {
          resolve(await task())
        } catch (error) {
          reject(error)
        }
      }),
    )
  }
  async drain(): Promise<void> {
    while (this.tasks.length) await this.tasks.shift()!()
    await Promise.resolve()
  }
}

// Event-path contract model, not a browser or evidence of real isTrusted/default actions.
class UiEvent {
  defaultPrevented = false
  stopped = false
  eventPhase = 0
  target: Element
  currentTarget: Element | null = null
  constructor(
    readonly type: string,
    target: Element,
    readonly key = '',
    readonly isTrusted = true,
  ) {
    this.target = target
  }
  preventDefault() {
    this.defaultPrevented = true
  }
  stopPropagation() {
    this.stopped = true
  }
}
type UiListener = (event: UiEvent) => void
class Element {
  children: Element[] = []
  listeners = new Map<string, { callback: UiListener; capture: boolean }[]>()
  parent: Element | null = null
  dataset: Record<string, string> = {}
  style: Record<string, string> = {}
  #textContent = ''
  readonly textWrites: string[] = []
  get textContent(): string {
    return this.#textContent
  }
  set textContent(value: string) {
    this.#textContent = value
    this.textWrites.push(value)
  }
  className = ''
  type = ''
  value = ''
  checked = false
  disabled = false
  readOnly = false
  id = ''
  shadow: Element | null = null
  attributes = new Map<string, string>()
  get isConnected(): boolean {
    return this.tag === 'document' || this.parent?.isConnected === true
  }
  constructor(readonly tag = 'div') {}
  append(...elements: Element[]) {
    for (const element of elements) {
      element.parent = this
      this.children.push(element)
    }
  }
  replaceChildren(...elements: Element[]) {
    for (const child of this.children) child.parent = null
    this.children = []
    this.append(...elements)
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value)
  }
  attachShadow(_options: { mode: string }) {
    this.shadow = new Element('shadow')
    this.shadow.parent = this
    return this.shadow
  }
  addEventListener(type: string, callback: UiListener, capture = false) {
    const rows = this.listeners.get(type) ?? []
    if (!rows.some((row) => row.callback === callback && row.capture === capture))
      rows.push({ callback, capture })
    this.listeners.set(type, rows)
  }
  removeEventListener(type: string, callback: UiListener, capture = false) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter(
        (row) => row.callback !== callback || row.capture !== capture,
      ),
    )
  }
  emit(type: string, key = '', trusted = true): UiEvent {
    const event = new UiEvent(type, this, key, trusted),
      path: Element[] = []
    for (let node: Element | null = this; node; node = node.parent) path.push(node)
    const shadowIndex = path.findIndex((node) => node.tag === 'shadow')
    const invoke = (node: Element, capture: boolean) => {
      event.currentTarget = node
      event.eventPhase = node === this ? 2 : capture ? 1 : 3
      event.target =
        shadowIndex >= 0 && path.indexOf(node) > shadowIndex ? path[shadowIndex + 1]! : this
      for (const row of [...(node.listeners.get(type) ?? [])]) {
        if (row.capture === capture && node.listeners.get(type)?.includes(row)) row.callback(event)
      }
    }
    for (const node of [...path].reverse()) {
      invoke(node, true)
      if (event.stopped) break
    }
    if (!event.stopped)
      for (const node of path) {
        invoke(node, false)
        if (event.stopped) break
      }
    event.eventPhase = 0
    event.currentTarget = null
    return event
  }
  focusCount = 0
  click() {
    this.emit('click', '', false)
  }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this)
    this.parent = null
  }
  focus(_options?: unknown) {
    this.focusCount++
  }
  flatten(): Element[] {
    return [
      this,
      ...this.children.flatMap((child) => child.flatten()),
      ...(this.shadow?.flatten() ?? []),
    ]
  }
}

async function flushCommands(): Promise<void> {
  for (let i = 0; i < 4; i++) await Promise.resolve()
}

test('UP141-DIAG overview reports conservative throughput, demand and rejected alternatives on demand', (t) => {
  const f = ui(t)
  setOverviewCapacity(f, 12, 6_400_000)
  const before = f.routes.snapshot()
  f.clock.advance(0)
  const baselineTasks = f.clock.pendingCount
  f.routes.snapshot = () => ({
    ...before,
    activePlan: {
      id: before.activePlan!.id,
      action: 'rewrite',
      reason: 'recent-success',
      routeType: 'catalog-generated',
      host: TRUSTED_CATALOG[0],
      ranking: [
        {
          host: TRUSTED_CATALOG[0],
          type: 'catalog-generated',
          state: 'usable',
          eligible: true,
          reasons: [],
          safeMbps: 12,
          ratio: 1.5,
          ttfbMs: 30,
        },
        {
          host: TRUSTED_CATALOG[1],
          type: 'catalog-generated',
          state: 'forbidden',
          eligible: false,
          reasons: ['black'],
          safeMbps: null,
          ratio: null,
          ttfbMs: null,
        },
      ],
    },
  })
  f.center.show()
  const text = readSummary(f)!.textContent
  assert.match(text, /保守吞吐 12\.00 Mbps｜需求 8\.00 Mbps｜餘裕 1\.50 倍/)
  assert.match(text, /候選限制：.*黑名單/)
  f.clock.advance(0)
  assert.equal(f.clock.pendingCount, baselineTasks)
})

test('UP141-DIAG qualified early release displays measured waiting and an unambiguous reason', (t) => {
  const f = ui(t),
    before = f.measurement.snapshot()
  f.measurement.snapshot = () => ({
    ...before,
    startup: {
      state: 'complete',
      reason: 'qualified-early',
      candidates: 3,
      selectedHost: TRUSTED_CATALOG[0],
      delayed: true,
      elapsedMs: 375.6,
    },
  })
  f.center.show()
  const text = readSummary(f)!.textContent
  assert.match(
    text,
    /起播前測試：已測試並選好起播路線｜等待 376 ms｜結束：已找到足夠快的候選，提早放行/,
  )
  assert.doesNotMatch(text, /測試沒有明確結果/)
})

for (const [reason, elapsedMs, expected] of [
  ['measured', 3000, '等待 3000 ms｜結束：已取得有效量測'],
  ['inconclusive', 3000, '等待 3000 ms｜結束：證據不足'],
  ['qualified-early', Infinity, '結束：已找到足夠快的候選，提早放行'],
] as const) {
  test(`UP141-DIAG ${reason} release omits an unavailable waiting duration`, (t) => {
    const f = ui(t),
      before = f.measurement.snapshot()
    f.measurement.snapshot = () => ({
      ...before,
      startup: {
        state: 'complete',
        reason,
        elapsedMs,
        candidates: 3,
        selectedHost: TRUSTED_CATALOG[0],
        delayed: true,
      },
    })
    f.center.show()
    const text = readSummary(f)!.textContent
    assert.ok(text.includes(expected))
    assert.doesNotMatch(text, /Infinity|NaN/)
    if (!Number.isFinite(elapsedMs)) assert.doesNotMatch(text, /等待 \d+ ms/)
  })
}

for (const [mode, sizeKnown, expected] of [
  ['middle', true, '健康探測：中段｜大小已驗證（不代表未快取）'],
  ['head', false, '健康探測：首段｜大小未知（不代表未快取）'],
] as const) {
  test(`UP141-DIAG ${mode} probe summary exposes bounded facts without request details`, (t) => {
    const f = ui(t),
      before = f.measurement.snapshot()
    f.measurement.snapshot = () => ({
      ...before,
      range: Object.assign(
        { mode, sizeKnown },
        {
          url: 'https://example.invalid/private-path?token=summary-secret',
          totalBytes: 123456789,
          startByte: 1048576,
        },
      ),
    })
    f.center.show()
    const text = readSummary(f)!.textContent
    assert.ok(text.includes(expected))
    assert.doesNotMatch(text, /example\.invalid|private-path|summary-secret|123456789|1048576/)
  })
}

for (const [kind, expected] of [
  ['playurl', '一般播放資料'],
  ['ogv-playview', 'OGV 正片'],
  ['ogv-precheck', 'OGV 片頭檢查（原文傳遞）'],
] as const) {
  test(`UP141-DIAG ${kind} summary renders endpoint kind without URL or payload`, (t) => {
    const f = ui(t),
      before = f.deps.transport.snapshot()
    f.deps.transport.snapshot = () => ({
      ...before,
      lastApiEndpoint: Object.assign(
        { kind, transport: 'fetch' as const, observedAt: f.clock.now() },
        {
          url: 'https://api.bilibili.com/ogv/player/playview?cid=987654&token=summary-secret',
          payload: { cookie: 'cookie-secret', player: { marker: 'player-secret' } },
        },
      ),
    })
    f.center.show()
    const text = readSummary(f)!.textContent
    assert.ok(text.includes(`播放入口：${expected}`))
    assert.doesNotMatch(text, /https:|playview\?|987654|summary-secret|cookie-secret|player-secret/)
  })
}

for (const [label, safeMbps, bandwidth, rate] of [
  ['missing', null, null, 1],
  ['non-finite', Infinity, NaN, 1],
  ['zero', 0, 0, 1],
  ['overflowing demand', Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE],
] as const) {
  test(`UP141-DIAG ${label} capacity never displays a fabricated or non-finite demand`, (t) => {
    const f = ui(t)
    setOverviewCapacity(f, safeMbps, bandwidth, rate)
    f.center.show()
    const text = readSummary(f)!.textContent
    assert.doesNotMatch(text, /需求 (?:Infinity|NaN)|餘裕 (?:Infinity|NaN)/)
    assert.doesNotMatch(
      text,
      /｜需求 .* Mbps｜餘裕 /,
      'invalid demand never becomes a capacity claim',
    )
    if (safeMbps != null && Number.isFinite(safeMbps) && safeMbps > 0)
      assert.ok(text.includes('保守吞吐 ' + safeMbps.toFixed(2) + ' Mbps'))
    else assert.doesNotMatch(text, /保守吞吐/)
    if (label === 'missing' || label === 'non-finite') assert.match(text, /速度樣本不足/)
  })
}

test('UP141-DIAG summaries are read on opening and add no periodic rendering or commands', (t) => {
  const f = ui(t),
    before = f.measurement.snapshot()
  let reads = 0
  f.measurement.snapshot = () => {
    reads++
    return before
  }
  f.clock.advance(0)
  const tasks = f.clock.pendingCount
  f.center.show()
  f.clock.advance(0)
  const initialReads = reads
  assert.ok(initialReads > 0)
  assert.equal(f.clock.pendingCount, tasks)
  f.clock.advance(2000)
  assert.equal(
    reads,
    initialReads + 2,
    'the existing one-second monitor tick refreshes the compact read model',
  )
  assert.equal(f.clock.pendingCount, tasks)
  assert.equal(f.storage.tasks.length, 0)
})

test('CC39-UI remote settings update the same focused inputs without rebuilding reports', (t) => {
  const f = ui(t)
  f.button('播放設定').emit('click')
  const input = f.toggle('阻止網頁使用 HTTPDNS')
  f.storage.remote('bilicdn.v2.settings', {
    ...f.settings.get(),
    blockHttpDns: false,
    updatedAt: f.clock.now() + 1,
  })
  assert.equal(f.toggle('阻止網頁使用 HTTPDNS'), input)
  assert.equal(input.checked, false)
  assert.equal(
    f.doc.flatten().some((e) => e.tag === 'textarea'),
    false,
  )
})

test('control-center pages preserve settings and CDN defaults', (t) => {
  const f = ui(t)
  assert.match(readSummary(f).textContent, /選定路線：尚未確認/)
  f.button('CDN').emit('click')
  assert.equal(f.toggle('允許參考 B 站原生來源').checked, true)
  for (const host of TRUSTED_CATALOG)
    assert.equal(f.toggle(host).checked, !DEFAULT_UNAVAILABLE_HOSTS.has(host))
  assert.equal(f.doc.flatten().filter((e) => e.tag === 'select').length, 1)
  assert.equal(
    f.doc.flatten().find((e) => e.tag === 'select')?.children.length,
    TRUSTED_CATALOG.length + 1,
  )
  assert.equal(f.storage.tasks.length, 0)
})

for (const key of ['Enter', ' ']) {
  for (const interferes of [false, true]) {
    test(`BR-10 ${key === ' ' ? 'Space' : key} activation contract ${interferes ? 'isolates page bubble shortcuts' : 'preserves no-shortcut control'}`, (t) => {
      const f = ui(t),
        button = f.button('播放設定'),
        external = new Element('input')
      f.doc.append(external)
      let pageCalls = 0
      if (interferes)
        f.doc.addEventListener('keydown', (event) => {
          pageCalls++
          event.preventDefault()
          if (event.key === 'Enter') external.focus()
        })
      const down = button.emit('keydown', key)
      const press = button.emit('keypress', key)
      const up = button.emit('keyup', key)
      // Model the contract that the native default action remains eligible. IAB proves actual activation.
      if (!down.defaultPrevented && !press.defaultPrevented && !up.defaultPrevented)
        button.emit('click')
      assert.equal(f.doc.flatten().find((e) => e.tag === 'h2')?.textContent, 'BiliCDN 控制中心')
      assert.equal(pageCalls, 0)
      assert.equal(external.focusCount, 0)
    })
  }
}

test('R03 completing an older command cannot replace the settings view or take focus', async (t) => {
  const f = ui(t)
  f.button('停用腳本').emit('click')
  f.button('播放設定').emit('click')
  const heading = f.doc.flatten().find((e) => e.tag === 'h2')
  await f.storage.drain()
  for (let i = 0; i < 8; i++) await Promise.resolve()
  f.clock.advance(0)
  assert.equal(
    f.doc.flatten().find((e) => e.tag === 'h2'),
    heading,
  )
  assert.equal(heading?.textContent, 'BiliCDN 控制中心')
  const close = f.button('關閉')
  assert.equal(close.focusCount, 1)
})

test('BR-10 all keyboard phases preserve control defaults and stop only outer bubbling', (t) => {
  const f = ui(t)
  f.button('播放設定').emit('click')
  const controls = f.doc.flatten().filter((e) => ['button', 'input', 'select'].includes(e.tag))
  let captures = 0,
    bubbles = 0,
    targets = 0
  f.doc.addEventListener(
    'keydown',
    () => {
      captures++
    },
    true,
  )
  for (const type of ['keydown', 'keypress', 'keyup'])
    f.doc.addEventListener(type, () => {
      bubbles++
    })
  for (const control of controls) {
    control.addEventListener('keydown', () => {
      targets++
    })
    for (const key of ['Enter', ' ', 'Tab', 'ArrowDown', 'c']) {
      for (const type of ['keydown', 'keypress', 'keyup'])
        assert.equal(control.emit(type, key).defaultPrevented, false)
    }
  }
  assert.equal(captures, controls.length * 5)
  assert.equal(targets, captures)
  assert.equal(bubbles, 0)
  f.button('總覽').emit('click')
})

test('BR-10 outer capture cancellation remains observable rather than being claimed repaired', (t) => {
  const f = ui(t),
    button = f.button('播放設定')
  f.doc.addEventListener('keydown', (event) => event.preventDefault(), true)
  assert.equal(button.emit('keydown', 'Enter').defaultPrevented, true)
  assert.equal(f.doc.flatten().find((e) => e.tag === 'h2')?.textContent, 'BiliCDN 控制中心')
})

test('BR-10 synthetic keyboard click and change cannot close or execute settings commands', (t) => {
  const f = ui(t),
    before = f.settings.get()
  const stop = f.button('停用腳本')
  assert.equal(stop.emit('keydown', 'Escape', false).defaultPrevented, false)
  stop.emit('click', '', false)
  assert.equal(f.storage.tasks.length, 0)
  f.button('播放設定').emit('click')
  const input = f.toggle('阻止網頁使用 HTTPDNS')
  input.checked = false
  input.emit('change', '', false)
  assert.equal(f.storage.tasks.length, 0)
  assert.deepEqual(f.settings.get(), before)
  assert.equal(f.doc.flatten().filter((e) => e.className === 'dialog').length, 1)
})

test('BR-10 reopen installs one boundary and Escape removes all three listeners', (t) => {
  const f = ui(t),
    host = f.doc.flatten().find((e) => e.id === 'bilicdn-v2-control-center')!
  const shadow = host.shadow!
  f.center.show()
  f.center.show()
  for (const type of ['keydown', 'keypress', 'keyup'])
    assert.equal(shadow.listeners.get(type)?.length, 1)
  let closingCalls = 0
  const close = f.center.close.bind(f.center)
  f.center.close = () => {
    closingCalls++
    close()
  }
  const event = f.button('關閉').emit('keydown', 'Escape')
  assert.equal(event.defaultPrevented, true)
  assert.equal(closingCalls, 1)
  for (const type of ['keydown', 'keypress', 'keyup'])
    assert.equal(shadow.listeners.get(type)?.length, 0)
  let pageCalls = 0
  f.doc.addEventListener('keydown', () => {
    pageCalls++
  })
  assert.equal(host.emit('keydown', 'Enter').defaultPrevented, false)
  assert.equal(pageCalls, 1)
  f.center.show()
  for (const type of ['keydown', 'keypress', 'keyup'])
    assert.equal(shadow.listeners.get(type)?.length, 1)
})

test('BR-10 outside keys and stale nodes cannot affect the current center', (t) => {
  const f = ui(t),
    oldButton = f.button('播放設定')
  const oldHost = f.doc.flatten().find((e) => e.id === 'bilicdn-v2-control-center')!,
    oldShadow = oldHost.shadow!
  const retained = [...(oldShadow.listeners.get('keydown') ?? [])]
  let pageCalls = 0
  f.doc.addEventListener('keydown', () => {
    pageCalls++
  })
  const outside = new Element('button')
  f.doc.append(outside)
  outside.emit('keydown', 'Enter')
  assert.equal(pageCalls, 1)
  oldHost.parent = null
  f.doc.children = f.doc.children.filter((e) => e !== oldHost)
  f.center.show()
  for (const type of ['keydown', 'keypress', 'keyup'])
    assert.equal(oldShadow.listeners.get(type)?.length, 0)
  const stale = new UiEvent('keydown', oldButton, 'Escape')
  stale.currentTarget = oldShadow
  for (const row of retained) row.callback(stale)
  assert.equal(stale.defaultPrevented, false)
  assert.equal(f.doc.flatten().filter((e) => e.className === 'dialog').length, 1)
  oldButton.emit('keydown', 'Escape')
  assert.equal(f.doc.flatten().filter((e) => e.className === 'dialog').length, 1)
})

test('BR-10 target-side synchronous close and reopen leaves only the new event boundary', (t) => {
  const f = ui(t),
    button = f.button('播放設定')
  button.addEventListener('keydown', () => {
    f.center.close()
    f.center.show()
  })
  button.emit('keydown', 'Enter')
  const shadow = f.doc.flatten().find((e) => e.id === 'bilicdn-v2-control-center')!.shadow!
  for (const type of ['keydown', 'keypress', 'keyup'])
    assert.equal(shadow.listeners.get(type)?.length, 1)
  assert.equal(f.doc.flatten().filter((e) => e.className === 'dialog').length, 1)
})

test('R03 a queued initial focus cannot steal focus after close', (t) => {
  const f = ui(t),
    oldClose = f.button('關閉')
  f.center.close()
  f.clock.advance(0)
  assert.equal(oldClose.focusCount, 0)
  assert.equal(f.doc.flatten().filter((e) => e.className === 'dialog').length, 0)
})

test('R02 a pending single-host edit merges the latest remote settings under lock', async (t) => {
  const f = ui(t),
    host = TRUSTED_CATALOG[0],
    remoteHost = TRUSTED_CATALOG[2]
  const pending = f.commands.setCatalogEnabled(host, false)
  f.storage.remote('bilicdn.v2.settings', {
    ...f.settings.get(),
    blockHttpDns: false,
    catalogOverrides: { [remoteHost]: false },
    updatedAt: f.clock.now() + 1,
  })
  await f.storage.drain()
  await pending
  assert.equal(f.settings.get().blockHttpDns, false)
  assert.deepEqual(f.settings.get().catalogOverrides, { [remoteHost]: false, [host]: false })
  await assert.rejects(f.commands.setCatalogEnabled('external.invalid', true), TypeError)
})
test('UP141-RETRY retained switch rejects synthetic changes and suppresses off before lock completion', async (t) => {
  const f = ui(t)
  f.button('播放設定').emit('click')
  const input = f.toggle('慢請求提前重試')
  assert.equal(input.checked, true)
  input.checked = false
  input.emit('change', '', false)
  assert.equal(input.checked, true)
  assert.equal(f.storage.tasks.length, 0)
  input.checked = false
  input.emit('change')
  assert.equal(f.settings.get().earlyRetryEnabled, false)
  await f.storage.drain()
  await flushCommands()
  assert.equal(f.toggle('慢請求提前重試'), input)
})

test('CC39-UI removed controls cannot be reached from any page', (t) => {
  const f = ui(t)
  for (const tab of ['總覽', 'CDN', '播放設定']) {
    f.button(tab).emit('click')
    const text = f.doc
      .flatten()
      .map((e) => e.textContent)
      .join(' ')
    assert.doesNotMatch(
      text,
      /偏好的影片格式|記錄更多診斷細節|安排測速|安排香港候選|封鎖最近|UP141 測試功能/,
    )
  }
})

test('CC39-UI three tabs separate CDN from six real settings', async (t) => {
  const f = ui(t)
  assert.ok(f.doc.flatten().some((e) => e.textContent === 'BiliCDN 控制中心'))
  for (const label of ['總覽', 'CDN', '播放設定']) assert.ok(f.button(label))
  f.button('播放設定').emit('click')
  assert.equal(f.doc.flatten().filter((e) => e.type === 'checkbox').length, 6)
  for (const [key, label] of [
    ['startupEarlyReleaseEnabled', '起播提前放行'],
    ['healthMiddleRangeEnabled', '健康中段探測'],
    ['backupFamilyDiversityEnabled', '備援家族分散'],
    ['earlyRetryEnabled', '慢請求提前重試'],
    ['blockWebRtc', '阻止網頁使用 WebRTC'],
    ['blockHttpDns', '阻止網頁使用 HTTPDNS'],
  ] as const) {
    const input = f.toggle(label)
    assert.equal(input.checked, true)
    input.checked = false
    input.emit('change')
    await f.storage.drain()
    await flushCommands()
    assert.equal(f.settings.get()[key], false)
    assert.equal(f.toggle(label), input, 'settings updates preserve the focused control')
  }
  f.button('CDN').emit('click')
  assert.equal(f.toggle('cn-hk-eq-01-03.bilivideo.com').checked, true)
  assert.equal(f.toggle('允許參考 B 站原生來源').checked, true)
})

test('CC39-UI opened view consumes existing notifications and releases all subscriptions', (t) => {
  const f = ui(t)
  f.center.close()
  const listeners = new Set<() => void>()
  const source: ControlModelSources['monitor'] = f.deps.monitor
  source.subscribe = (listener) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }
  f.center.show()
  f.clock.advance(0)
  const before = source.snapshot()
  source.snapshot = () => ({ ...before, video: { ...before.video, playableBufferSec: 42.5 } })
  const tasks = f.clock.pendingCount
  for (const listener of listeners) listener()
  assert.ok(f.doc.flatten().some((e) => e.textContent === '42.5'))
  assert.equal(f.clock.pendingCount, tasks)
  assert.equal(listeners.size, 1)
  f.center.close()
  assert.equal(listeners.size, 0)
})

function readSummary(f: ReturnType<typeof ui>): Element {
  if (!f.doc.flatten().some((e) => e.className === 'summary'))
    f.button('查看詳細狀態').emit('click')
  return f.doc.flatten().find((e) => e.className === 'summary')!
}

function ui(t: TestContext) {
  const storage = new QueuedSettingsStorage()
  storage.values.set('bilicdn.v2.settings', { schema: 2, considerNativeSources: true })
  const f = fixture(t, storage),
    doc = new Element('document')
  f.scope.defineGlobal('GM_info', {
    configurable: true,
    value: { script: { version: 'contract' } },
  })
  const body = new Element('body'),
    video = new Element('video')
  doc.append(body, video)
  f.scope.defineGlobal('HTMLElement', { configurable: true, value: Element })
  f.scope.defineGlobal('document', {
    configurable: true,
    value: {
      documentElement: doc,
      body,
      activeElement: null,
      createElement: (tag: string) => new Element(tag),
      querySelector: () => video,
    },
  })
  f.scope.defineGlobal('Option', {
    configurable: true,
    value: class extends Element {
      constructor(label: string, value: string) {
        super('option')
        this.textContent = label
        this.value = value
      }
    },
  })
  f.scope.defineGlobal('queueMicrotask', {
    configurable: true,
    value: (task: () => void) => f.clock.microtask(task),
  })
  const center = new ControlCenter({
    model: createControlReadModel(f.deps),
    version: 'contract',
    commands: f.deps.commands,
    now: f.deps.now,
  })
  center.show()
  const button = (label: string) => {
    const found = doc.flatten().find((e) => e.tag === 'button' && e.textContent === label)
    assert.ok(found, label)
    return found
  }
  const toggle = (label: string) => {
    const row = doc
      .flatten()
      .find(
        (e) =>
          e.className === 'row' &&
          e.children.some((child) => child.tag === 'label' && child.textContent === label),
      )
    const input = row?.children.find((e) => e.tag === 'input')
    assert.ok(input, label)
    return input
  }
  f.scope.defer(() => center.close())
  return { ...f, storage, doc, center, button, toggle }
}

for (const queued of [false, true]) {
  test(`${queued ? 'R02' : 'CONTROL R02'} separate Catalog checkbox edits survive ${queued ? 'queued' : 'sequential'} settings locks`, async (t) => {
    const f = ui(t)
    f.button('CDN').emit('click')
    const hostA = TRUSTED_CATALOG[0],
      hostB = TRUSTED_CATALOG[2]
    assert.ok(hostA && hostB)
    const first = f.toggle(hostA)
    first.checked = false
    first.emit('change')
    if (!queued) await f.storage.drain()
    const second = f.toggle(hostB)
    second.checked = false
    second.emit('change')
    await f.storage.drain()
    assert.equal(
      f.settings.get().catalogOverrides[hostA],
      false,
      'second checkbox must preserve first committed user choice',
    )
    assert.equal(f.settings.get().catalogOverrides[hostB], false)
  })
}

for (const closeWhilePending of [false, true]) {
  test(`${closeWhilePending ? 'R03' : 'CONTROL R03'} completing a settings action ${closeWhilePending ? 'keeps closed UI closed' : 'refreshes open UI'}`, async (t) => {
    const f = ui(t)
    f.button('停用腳本').emit('click')
    assert.equal(f.storage.tasks.length, 1)
    if (closeWhilePending) f.center.close()
    await f.storage.drain()
    // Flush the actual awaited SettingsStore/updateSettings continuations without wall-clock sleeps.
    for (let i = 0; i < 8; i++) await Promise.resolve()
    assert.equal(f.settings.get().disabled, true)
    const dialogs = f.doc.flatten().filter((e) => e.className === 'dialog').length
    assert.equal(
      dialogs,
      closeWhilePending ? 0 : 1,
      'completed stale action must not recreate a dismissed dialog',
    )
  })
}
