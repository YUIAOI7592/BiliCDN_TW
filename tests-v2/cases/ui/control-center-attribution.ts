import test from 'node:test'
import assert from 'node:assert/strict'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import { media } from '../../support/runtime-fixture.ts'
import { setOverviewCapacity, readSummary, ui } from './control-center-resources.ts'

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
    else {
      assert.doesNotMatch(summary, /保守吞吐/)
      assert.match(summary, /速度樣本不足/)
    }
    if (!demandValid) assert.doesNotMatch(summary, /｜需求 .* Mbps｜餘裕 /)
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
