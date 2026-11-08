import test from 'node:test'
import assert from 'node:assert/strict'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import { readSummary, ui } from './control-center-resources.ts'

for (const [phase, expected] of [
  ['isolated', '隔離中'],
  ['awaiting', '等待本頁新實傳'],
  ['observing', '本頁觀察 120／300 秒'],
  ['settling', '等待期末成功'],
] as const) {
  test(`V2211 UI: ${phase} uses the same current circuit projection in CDN and details`, (t) => {
    const f = ui(t),
      snapshot = f.routes.snapshot.bind(f.routes),
      host = TRUSTED_CATALOG[0]!
    f.routes.snapshot = () => ({
      ...snapshot(),
      circuits: [
        {
          host,
          kind: 'video',
          level: 2,
          until: phase === 'isolated' ? f.clock.now() + 600000 : 0,
          phase,
          reason: phase === 'settling' ? 'awaiting-end-success' : 'awaiting-new-transfer',
          progressSec: 120,
          remainingSec: 60,
        },
      ],
    })
    f.center.close()
    f.center.show()
    assert.match(readSummary(f).textContent, new RegExp(expected))
    f.button('CDN').emit('click')
    const row = f.doc
      .flatten()
      .find((e) => e.className === 'detail restriction' && e.textContent.includes('共享熔斷 L2'))
    assert.ok(row)
    assert.ok(row.textContent.includes(expected))
    assert.equal(
      f.doc.flatten().some((e) => e.className === 'summary'),
      false,
    )
  })
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
