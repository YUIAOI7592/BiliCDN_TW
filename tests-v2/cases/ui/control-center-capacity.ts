import { createControlReadModel } from '../../../src-v2/ui/control-read-model.ts'
import test, { type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { media } from '../../support/runtime-fixture.ts'
import { overviewPresentation } from '../../../src-v2/ui/overview-presentation.ts'
import { EVIDENCE_TTL_MS } from '../../../src-v2/domain/evidence.ts'
import { EVIDENCE_KEY } from '../../../src-v2/state/evidence-store.ts'
import { setOverviewCapacity, readSummary, ui } from './control-center-resources.ts'

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
