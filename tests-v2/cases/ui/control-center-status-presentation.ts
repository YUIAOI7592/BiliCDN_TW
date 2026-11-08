import test from 'node:test'
import assert from 'node:assert/strict'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import { setOverviewCapacity, readSummary, ui } from './control-center-resources.ts'

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
