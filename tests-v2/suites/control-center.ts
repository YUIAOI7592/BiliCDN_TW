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

// Event-path contract model, not a browser or evidence of real isTrusted/default actions.
class UiEvent {
  defaultPrevented = false; stopped = false; eventPhase = 0
  target: Element; currentTarget: Element | null = null
  constructor(readonly type: string, target: Element, readonly key = '', readonly isTrusted = true) { this.target = target }
  preventDefault() { this.defaultPrevented = true }
  stopPropagation() { this.stopped = true }
}
type UiListener = (event: UiEvent) => void
class Element {
  children: Element[] = []; listeners = new Map<string, { callback: UiListener; capture: boolean }[]>()
  parent: Element | null = null
  dataset: Record<string, string> = {}; style: Record<string, string> = {}; textContent = ''
  className = ''; type = ''; value = ''; checked = false; disabled = false; readOnly = false
  id = ''; shadow: Element | null = null
  get isConnected(): boolean { return this.tag === 'document' || this.parent?.isConnected === true }
  constructor(readonly tag = 'div') {}
  append(...elements: Element[]) { for (const element of elements) { element.parent = this; this.children.push(element) } }
  replaceChildren(...elements: Element[]) { for (const child of this.children) child.parent = null; this.children = []; this.append(...elements) }
  setAttribute(_name: string, _value: string) {}
  attachShadow(_options: { mode: string }) { this.shadow = new Element('shadow'); this.shadow.parent = this; return this.shadow }
  addEventListener(type: string, callback: UiListener, capture = false) {
    const rows = this.listeners.get(type) ?? []
    if (!rows.some(row => row.callback === callback && row.capture === capture)) rows.push({ callback, capture })
    this.listeners.set(type, rows)
  }
  removeEventListener(type: string, callback: UiListener, capture = false) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter(row => row.callback !== callback || row.capture !== capture))
  }
  emit(type: string, key = '', trusted = true): UiEvent {
    const event = new UiEvent(type, this, key, trusted), path: Element[] = []
    for (let node: Element | null = this; node; node = node.parent) path.push(node)
    const shadowIndex = path.findIndex(node => node.tag === 'shadow')
    const invoke = (node: Element, capture: boolean) => {
      event.currentTarget = node; event.eventPhase = node === this ? 2 : capture ? 1 : 3
      event.target = shadowIndex >= 0 && path.indexOf(node) > shadowIndex ? path[shadowIndex + 1]! : this
      for (const row of [...node.listeners.get(type) ?? []]) {
        if (row.capture === capture && node.listeners.get(type)?.includes(row)) row.callback(event)
      }
    }
    for (const node of [...path].reverse()) { invoke(node, true); if (event.stopped) break }
    if (!event.stopped) for (const node of path) { invoke(node, false); if (event.stopped) break }
    event.eventPhase = 0; event.currentTarget = null
    return event
  }
  focusCount = 0
  focus(_options?: unknown) { this.focusCount++ }
  flatten(): Element[] { return [this, ...this.children.flatMap(child => child.flatten()), ...(this.shadow?.flatten() ?? [])] }
}

for (const key of ['Enter', ' ']) {
  for (const interferes of [false, true]) {
    test(`BR-10 ${key === ' ' ? 'Space' : key} activation contract ${interferes ? 'isolates page bubble shortcuts' : 'preserves no-shortcut control'}`, t => {
      const f = ui(t), button = f.button('CDN 與播放設定'), external = new Element('input')
      f.doc.append(external); let pageCalls = 0
      if (interferes) f.doc.addEventListener('keydown', event => {
        pageCalls++; event.preventDefault(); if (event.key === 'Enter') external.focus()
      })
      const down = button.emit('keydown', key)
      const press = button.emit('keypress', key)
      const up = button.emit('keyup', key)
      // Model the contract that the native default action remains eligible. IAB proves actual activation.
      if (!down.defaultPrevented && !press.defaultPrevented && !up.defaultPrevented) button.emit('click')
      assert.equal(f.doc.flatten().find(e => e.tag === 'h2')?.textContent, 'CDN 與播放設定')
      assert.equal(pageCalls, 0); assert.equal(external.focusCount, 0)
    })
  }
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

test('BR-10 all keyboard phases preserve control defaults and stop only outer bubbling', t => {
  const f = ui(t); f.button('CDN 與播放設定').emit('click')
  const controls = f.doc.flatten().filter(e => ['button', 'input', 'select'].includes(e.tag))
  let captures = 0, bubbles = 0, targets = 0
  f.doc.addEventListener('keydown', () => { captures++ }, true)
  for (const type of ['keydown', 'keypress', 'keyup']) f.doc.addEventListener(type, () => { bubbles++ })
  for (const control of controls) {
    control.addEventListener('keydown', () => { targets++ })
    for (const key of ['Enter', ' ', 'Tab', 'ArrowDown', 'c']) {
      for (const type of ['keydown', 'keypress', 'keyup']) assert.equal(control.emit(type, key).defaultPrevented, false)
    }
  }
  assert.equal(captures, controls.length * 5); assert.equal(targets, captures); assert.equal(bubbles, 0)
  f.button('返回').emit('click'); f.button('查看診斷報告').emit('click')
  const report = f.doc.flatten().find(e => e.tag === 'textarea'); assert.ok(report)
  assert.equal(report.emit('keydown', 'c').defaultPrevented, false)
  assert.equal(bubbles, 0)
})

test('BR-10 outer capture cancellation remains observable rather than being claimed repaired', t => {
  const f = ui(t), button = f.button('CDN 與播放設定')
  f.doc.addEventListener('keydown', event => event.preventDefault(), true)
  assert.equal(button.emit('keydown', 'Enter').defaultPrevented, true)
  assert.equal(f.doc.flatten().find(e => e.tag === 'h2')?.textContent, 'BiliCDN v2 控制中心')
})

test('BR-10 synthetic keyboard click and change cannot close or execute settings commands', t => {
  const f = ui(t), before = f.settings.get()
  const stop = f.button('停用腳本')
  assert.equal(stop.emit('keydown', 'Escape', false).defaultPrevented, false)
  stop.emit('click', '', false)
  assert.equal(f.storage.tasks.length, 0)
  f.button('CDN 與播放設定').emit('click')
  const input = f.toggle('阻止網頁使用 HTTPDNS'); input.checked = false; input.emit('change', '', false)
  assert.equal(f.storage.tasks.length, 0); assert.deepEqual(f.settings.get(), before)
  assert.equal(f.doc.flatten().filter(e => e.className === 'dialog').length, 1)
})

test('BR-10 reopen installs one boundary and Escape removes all three listeners', t => {
  const f = ui(t), host = f.doc.flatten().find(e => e.id === 'bilicdn-v2-control-center')!
  const shadow = host.shadow!
  f.center.show(); f.center.show()
  for (const type of ['keydown', 'keypress', 'keyup']) assert.equal(shadow.listeners.get(type)?.length, 1)
  let closingCalls = 0
  const close = f.center.close.bind(f.center)
  f.center.close = () => { closingCalls++; close() }
  const event = f.button('關閉').emit('keydown', 'Escape')
  assert.equal(event.defaultPrevented, true); assert.equal(closingCalls, 1)
  for (const type of ['keydown', 'keypress', 'keyup']) assert.equal(shadow.listeners.get(type)?.length, 0)
  let pageCalls = 0; f.doc.addEventListener('keydown', () => { pageCalls++ })
  assert.equal(host.emit('keydown', 'Enter').defaultPrevented, false); assert.equal(pageCalls, 1)
  f.center.show()
  for (const type of ['keydown', 'keypress', 'keyup']) assert.equal(shadow.listeners.get(type)?.length, 1)
})

test('BR-10 outside keys and stale nodes cannot affect the current center', t => {
  const f = ui(t), oldButton = f.button('CDN 與播放設定')
  const oldHost = f.doc.flatten().find(e => e.id === 'bilicdn-v2-control-center')!, oldShadow = oldHost.shadow!
  const retained = [...oldShadow.listeners.get('keydown') ?? []]
  let pageCalls = 0; f.doc.addEventListener('keydown', () => { pageCalls++ })
  const outside = new Element('button'); f.doc.append(outside)
  outside.emit('keydown', 'Enter'); assert.equal(pageCalls, 1)
  oldHost.parent = null; f.doc.children = f.doc.children.filter(e => e !== oldHost)
  f.center.show()
  for (const type of ['keydown', 'keypress', 'keyup']) assert.equal(oldShadow.listeners.get(type)?.length, 0)
  const stale = new UiEvent('keydown', oldButton, 'Escape'); stale.currentTarget = oldShadow
  for (const row of retained) row.callback(stale)
  assert.equal(stale.defaultPrevented, false)
  assert.equal(f.doc.flatten().filter(e => e.className === 'dialog').length, 1)
  oldButton.emit('keydown', 'Escape')
  assert.equal(f.doc.flatten().filter(e => e.className === 'dialog').length, 1)
})

test('BR-10 target-side synchronous close and reopen leaves only the new event boundary', t => {
  const f = ui(t), button = f.button('CDN 與播放設定')
  button.addEventListener('keydown', () => { f.center.close(); f.center.show() })
  button.emit('keydown', 'Enter')
  const shadow = f.doc.flatten().find(e => e.id === 'bilicdn-v2-control-center')!.shadow!
  for (const type of ['keydown', 'keypress', 'keyup']) assert.equal(shadow.listeners.get(type)?.length, 1)
  assert.equal(f.doc.flatten().filter(e => e.className === 'dialog').length, 1)
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
  f.scope.defineGlobal('GM_info', { configurable: true, value: { script: { version: 'contract' } } })
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
