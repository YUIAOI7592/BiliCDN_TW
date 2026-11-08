import test from 'node:test'
import assert from 'node:assert/strict'
import { type ControlModelSources } from '../../../src-v2/ui/control-contracts.ts'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import { flushCommands, ui } from './control-center-resources.ts'

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
  f.clock.advance(0)
  assert.ok(f.doc.flatten().some((e) => e.textContent === '42.5'))
  assert.equal(f.clock.pendingCount, tasks)
  assert.equal(listeners.size, 1)
  f.center.close()
  assert.equal(listeners.size, 0)
})
