import test from 'node:test'
import assert from 'node:assert/strict'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import { DEFAULT_UNAVAILABLE_HOSTS } from '../../../src-v2/domain/catalog.ts'
import { UiEvent, Element, readSummary, ui } from './control-center-resources.ts'

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
      assert.equal(f.doc.flatten().filter((e) => e.type === 'checkbox').length, 3)
      assert.ok(f.toggle('慢請求提前重試'))
      assert.equal(pageCalls, 0)
      assert.equal(external.focusCount, 0)
    })
  }
}

test('R03 completing an older command cannot replace the settings view or take focus', async (t) => {
  const f = ui(t)
  f.button('停用腳本').emit('click')
  f.button('播放設定').emit('click')
  const input = f.toggle('慢請求提前重試')
  await f.storage.drain()
  for (let i = 0; i < 8; i++) await Promise.resolve()
  f.clock.advance(0)
  assert.equal(f.toggle('慢請求提前重試'), input, 'the settings view and its input survive')
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
