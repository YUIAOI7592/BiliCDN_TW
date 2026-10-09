import test, { type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../support/runtime-fixture.ts'
import { FakeStorage } from '../support/storage.ts'
import { ControlCenter } from '../../src-v2/ui/control-center.ts'
import { TRUSTED_CATALOG } from '../../src-v2/domain/catalog.ts'

class QueuedSettingsStorage extends FakeStorage {
  held = true
  tasks: (() => Promise<void>)[] = []
  override async withLock<T>(name: string, task: () => Promise<T> | T): Promise<T> {
    if (name !== 'settings' || !this.held) return await task()
    return await new Promise<T>((resolve, reject) => this.tasks.push(async () => {
      try { resolve(await task()) } catch (error) { reject(error) }
    }))
  }
  async drain(): Promise<void> { while (this.tasks.length) await this.tasks.shift()!(); await Promise.resolve() }
}

// Minimal DOM implements construction and event dispatch only. It does not model layout,
// real trust, native focus behavior, or browser rendering. Trusted flags model user handlers.
class Element {
  children: Element[] = []; listeners = new Map<string, ((event: any) => void)[]>()
  dataset: Record<string, string> = {}; style: Record<string, string> = {}; textContent = ''
  className = ''; type = ''; value = ''; checked = false; disabled = false; readOnly = false
  id = ''; isConnected = true; shadow: Element | null = null
  constructor(readonly tag = 'div') {}
  append(...elements: Element[]) { this.children.push(...elements) }
  replaceChildren(...elements: Element[]) { this.children = elements }
  setAttribute(_name: string, _value: string) {}
  attachShadow(_options: { mode: string }) { this.shadow = new Element('shadow'); return this.shadow }
  addEventListener(type: string, listener: (event: any) => void) {
    const rows = this.listeners.get(type) ?? []; rows.push(listener); this.listeners.set(type, rows)
  }
  emit(type: string) { for (const listener of this.listeners.get(type) ?? []) listener({ isTrusted: true, preventDefault() {}, stopPropagation() {} }) }
  focusCount = 0
  focus(_options?: unknown) { this.focusCount++ }
  flatten(): Element[] { return [this, ...this.children.flatMap(child => child.flatten()), ...(this.shadow?.flatten() ?? [])] }
}

test('R03 completing an older command cannot replace the settings view or take focus', async t => {
  const f = ui(t)
  f.button('停用腳本').emit('click')
  f.button('CDN 與播放設定').emit('click')
  const heading = f.doc.flatten().find(e => e.tag === 'h2')
  await f.storage.drain()
  for (let i = 0; i < 8; i++) await Promise.resolve()
  f.clock.advance(0)
  assert.equal(f.doc.flatten().find(e => e.tag === 'h2'), heading)
  assert.equal(heading?.textContent, 'CDN 與播放設定')
  const close = f.button('關閉'); assert.equal(close.focusCount, 1)
})

test('R03 a queued initial focus cannot steal focus after close', t => {
  const f = ui(t), oldClose = f.button('關閉')
  f.center.close(); f.clock.advance(0)
  assert.equal(oldClose.focusCount, 0)
  assert.equal(f.doc.flatten().filter(e => e.className === 'dialog').length, 0)
})

test('R02 a pending single-host edit merges the latest remote settings under lock', async t => {
  const f = ui(t), host = TRUSTED_CATALOG[0], remoteHost = TRUSTED_CATALOG[2]
  const pending = f.commands.setCatalogEnabled(host, false)
  f.storage.remote('bilicdn.v2.settings', { ...f.settings.get(), codec: 'hevc',
    catalogOverrides: { [remoteHost]: false }, updatedAt: f.clock.now() + 1 })
  await f.storage.drain(); await pending
  assert.equal(f.settings.get().codec, 'hevc')
  assert.deepEqual(f.settings.get().catalogOverrides, { [remoteHost]: false, [host]: false })
  await assert.rejects(f.commands.setCatalogEnabled('external.invalid', true), TypeError)
})
function ui(t: TestContext) {
  const storage = new QueuedSettingsStorage(), f = fixture(t, storage), doc = new Element('document')
  const body = new Element('body'), video = new Element('video'); doc.append(body, video)
  f.scope.defineGlobal('HTMLElement', { configurable: true, value: Element })
  f.scope.defineGlobal('document', { configurable: true, value: { documentElement: doc, body, activeElement: null,
    createElement: (tag: string) => new Element(tag), querySelector: () => video } })
  f.scope.defineGlobal('Option', { configurable: true, value: class extends Element {
    constructor(label: string, value: string) { super('option'); this.textContent = label; this.value = value }
  } })
  f.scope.defineGlobal('queueMicrotask', { configurable: true, value: (task: () => void) => f.clock.microtask(task) })
  const center = new ControlCenter(f.deps)
  center.show()
  const button = (label: string) => { const found = doc.flatten().find(e => e.tag === 'button' && e.textContent === label); assert.ok(found, label); return found }
  const toggle = (label: string) => {
    const row = doc.flatten().find(e => e.className === 'row' && e.children.some(child => child.tag === 'label' && child.textContent === label))
    const input = row?.children.find(e => e.tag === 'input'); assert.ok(input, label); return input
  }
  f.scope.defer(() => center.close())
  return { ...f, storage, doc, center, button, toggle }
}

for (const queued of [false, true]) {
  test(`${queued ? 'R02' : 'CONTROL R02'} separate Catalog checkbox edits survive ${queued ? 'queued' : 'sequential'} settings locks`, async t => {
    const f = ui(t)
    f.button('CDN 與播放設定').emit('click')
    const hostA = TRUSTED_CATALOG[0], hostB = TRUSTED_CATALOG[2]
    assert.ok(hostA && hostB)
    const first = f.toggle(hostA); first.checked = false; first.emit('change')
    if (!queued) await f.storage.drain()
    const second = f.toggle(hostB); second.checked = false; second.emit('change')
    await f.storage.drain()
    assert.equal(f.settings.get().catalogOverrides[hostA], false, 'second checkbox must preserve first committed user choice')
    assert.equal(f.settings.get().catalogOverrides[hostB], false)
  })
}

for (const closeWhilePending of [false, true]) {
  test(`${closeWhilePending ? 'R03' : 'CONTROL R03'} completing a settings action ${closeWhilePending ? 'keeps closed UI closed' : 'refreshes open UI'}`, async t => {
    const f = ui(t)
    f.button('停用腳本').emit('click')
    assert.equal(f.storage.tasks.length, 1)
    if (closeWhilePending) f.center.close()
    await f.storage.drain()
    // Flush the actual awaited SettingsStore/updateSettings continuations without wall-clock sleeps.
    for (let i = 0; i < 8; i++) await Promise.resolve()
    assert.equal(f.settings.get().disabled, true)
    const dialogs = f.doc.flatten().filter(e => e.className === 'dialog').length
    assert.equal(dialogs, closeWhilePending ? 0 : 1, 'completed stale action must not recreate a dismissed dialog')
  })
}
