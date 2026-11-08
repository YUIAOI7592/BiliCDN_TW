import { test } from 'node:test'
import assert from 'node:assert/strict'
import { startupLabel } from '../../../src-v2/ui/labels.ts'

test('V226 UI: exhausted startup states explicitly show no legal selection', () => {
  assert.equal(startupLabel('skipped', 'inconclusive', 'none'), '本輪沒有合法可用選擇')
})

for (const [reason, expected] of [
  ['video-priority', '等待影片取得起播窗口'],
  ['preflight-skipped:synchronous-xhr', '同步 XHR 保留原生行為，未消耗起播窗口'],
  ['preflight-skipped:xhr-explicit-timeout', '這筆請求未進行起播預測試'],
] as const)
  test(`V226 UI: bounded startup skip reason ${reason}`, () => {
    assert.equal(startupLabel('skipped', reason), expected)
  })
