import test from 'node:test'
import assert from 'node:assert/strict'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import { DEFAULT_UNAVAILABLE_HOSTS } from '../../../src-v2/domain/catalog.ts'
import { readSummary, ui } from './control-center-resources.ts'

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
  assert.equal(f.doc.flatten().filter((e) => e.type === 'checkbox').length, 3)
  for (const [key, label] of [
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
