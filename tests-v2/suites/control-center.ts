import { writeClipboard } from '../../src-v2/adapters/clipboard.ts'
import { createControlReadModel } from '../../src-v2/ui/control-read-model.ts'
import test, { type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../support/runtime-fixture.ts'
import { FakeStorage } from '../support/storage.ts'
import { ControlCenter } from '../../src-v2/ui/control-center.ts'
import type { ControlModelSources } from '../../src-v2/ui/control-contracts.ts'
import { TRUSTED_CATALOG } from '../../src-v2/domain/catalog.ts'
import { DEFAULT_UNAVAILABLE_HOSTS } from '../../src-v2/domain/catalog.ts'
import { deferred } from '../support/deferred.ts'

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

class QueuedSettingsStorage extends FakeStorage {
  held = true
  tasks: (() => Promise<void>)[] = []
  override async withLock<T>(name: string, task: () => Promise<T> | T): Promise<T> {
    if (name !== 'settings' || !this.held) return await task()
    return await new Promise<T>((resolve, reject) =>
      this.tasks.push(async () => {
        try {
          resolve(await task())
        } catch (error) {
          reject(error)
        }
      }),
    )
  }
  async drain(): Promise<void> {
    while (this.tasks.length) await this.tasks.shift()!()
    await Promise.resolve()
  }
}

// Event-path contract model, not a browser or evidence of real isTrusted/default actions.
class UiEvent {
  defaultPrevented = false
  stopped = false
  eventPhase = 0
  target: Element
  currentTarget: Element | null = null
  constructor(
    readonly type: string,
    target: Element,
    readonly key = '',
    readonly isTrusted = true,
  ) {
    this.target = target
  }
  preventDefault() {
    this.defaultPrevented = true
  }
  stopPropagation() {
    this.stopped = true
  }
}
type UiListener = (event: UiEvent) => void
class Element {
  children: Element[] = []
  listeners = new Map<string, { callback: UiListener; capture: boolean }[]>()
  parent: Element | null = null
  dataset: Record<string, string> = {}
  style: Record<string, string> = {}
  textContent = ''
  className = ''
  type = ''
  value = ''
  checked = false
  disabled = false
  readOnly = false
  id = ''
  shadow: Element | null = null
  attributes = new Map<string, string>()
  get isConnected(): boolean {
    return this.tag === 'document' || this.parent?.isConnected === true
  }
  constructor(readonly tag = 'div') {}
  append(...elements: Element[]) {
    for (const element of elements) {
      element.parent = this
      this.children.push(element)
    }
  }
  replaceChildren(...elements: Element[]) {
    for (const child of this.children) child.parent = null
    this.children = []
    this.append(...elements)
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value)
  }
  attachShadow(_options: { mode: string }) {
    this.shadow = new Element('shadow')
    this.shadow.parent = this
    return this.shadow
  }
  addEventListener(type: string, callback: UiListener, capture = false) {
    const rows = this.listeners.get(type) ?? []
    if (!rows.some((row) => row.callback === callback && row.capture === capture))
      rows.push({ callback, capture })
    this.listeners.set(type, rows)
  }
  removeEventListener(type: string, callback: UiListener, capture = false) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter(
        (row) => row.callback !== callback || row.capture !== capture,
      ),
    )
  }
  emit(type: string, key = '', trusted = true): UiEvent {
    const event = new UiEvent(type, this, key, trusted),
      path: Element[] = []
    for (let node: Element | null = this; node; node = node.parent) path.push(node)
    const shadowIndex = path.findIndex((node) => node.tag === 'shadow')
    const invoke = (node: Element, capture: boolean) => {
      event.currentTarget = node
      event.eventPhase = node === this ? 2 : capture ? 1 : 3
      event.target =
        shadowIndex >= 0 && path.indexOf(node) > shadowIndex ? path[shadowIndex + 1]! : this
      for (const row of [...(node.listeners.get(type) ?? [])]) {
        if (row.capture === capture && node.listeners.get(type)?.includes(row)) row.callback(event)
      }
    }
    for (const node of [...path].reverse()) {
      invoke(node, true)
      if (event.stopped) break
    }
    if (!event.stopped)
      for (const node of path) {
        invoke(node, false)
        if (event.stopped) break
      }
    event.eventPhase = 0
    event.currentTarget = null
    return event
  }
  focusCount = 0
  click() {
    this.emit('click', '', false)
  }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this)
    this.parent = null
  }
  focus(_options?: unknown) {
    this.focusCount++
  }
  flatten(): Element[] {
    return [
      this,
      ...this.children.flatMap((child) => child.flatten()),
      ...(this.shadow?.flatten() ?? []),
    ]
  }
}

// Clipboard tests model trusted dispatch and async ownership; IAB proves native writes/default actions.
function copyUi(t: TestContext) {
  const f = ui(t),
    gmCalls: { text: string; format: unknown }[] = []
  f.scope.defineGlobal('navigator', { configurable: true, value: {} })
  f.scope.defineGlobal('GM_setClipboard', {
    configurable: true,
    value: (text: string, format?: unknown) => {
      gmCalls.push({ text, format })
    },
  })
  f.button('診斷').emit('click')
  f.clock.advance(0)
  const report = () => {
    if (!f.doc.flatten().some((e) => e.tag === 'textarea')) f.button('查看完整報告').emit('click')
    const value = f.doc.flatten().find((e) => e.tag === 'textarea')
    assert.ok(value)
    return value
  }
  const status = () => {
    const value = f.doc.flatten().find((e) => e.attributes.get('role') === 'status')
    assert.ok(value)
    return value
  }
  const native = (clipboard: { writeText(text: string): Promise<void> }) => {
    f.scope.defineGlobal('navigator', { configurable: true, value: { clipboard } })
  }
  report()
  return { ...f, gmCalls, report, status, native, copy: () => f.button('複製報告') }
}

async function flushCopy(): Promise<void> {
  for (let i = 0; i < 4; i++) await Promise.resolve()
}

test('UP141-DIAG overview reports conservative throughput, demand and rejected alternatives on demand', (t) => {
  const f = ui(t),
    before = f.routes.snapshot()
  f.clock.advance(0)
  const baselineTasks = f.clock.pendingCount
  f.routes.snapshot = () => ({
    ...before,
    activePlan: {
      id: 'up141' as NonNullable<typeof before.activePlan>['id'],
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

for (const [label, safeMbps, ratio] of [
  ['missing', null, null],
  ['non-finite', Infinity, NaN],
  ['zero', 0, 0],
  ['overflowing demand', Number.MAX_VALUE, Number.MIN_VALUE],
] as const) {
  test(`UP141-DIAG ${label} capacity never displays a fabricated or non-finite demand`, (t) => {
    const f = ui(t),
      before = f.routes.snapshot()
    f.routes.snapshot = () => ({
      ...before,
      activePlan: {
        id: 'up141' as NonNullable<typeof before.activePlan>['id'],
        action: 'rewrite',
        reason: 'recent-success',
        routeType: 'catalog-generated',
        host: TRUSTED_CATALOG[0],
        ranking: [
          {
            host: TRUSTED_CATALOG[0],
            type: 'catalog-generated',
            state: 'unknown',
            eligible: true,
            reasons: [],
            safeMbps,
            ratio,
            ttfbMs: null,
          },
        ],
      },
    })
    f.center.show()
    const text = readSummary(f)!.textContent
    assert.doesNotMatch(text, /保守吞吐|需求 (?:Infinity|NaN)|餘裕 (?:Infinity|NaN)/)
    if (ratio === null || !Number.isFinite(ratio)) assert.match(text, /速度樣本不足/)
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

test('CC39-UI report export only follows trusted action and releases the owned URL on navigation', (t) => {
  const f = copyUi(t)
  const created: Blob[] = [],
    revoked: string[] = []
  f.scope.defineGlobal('URL', {
    configurable: true,
    value: {
      createObjectURL: (blob: Blob) => {
        created.push(blob)
        return 'blob:owned-report'
      },
      revokeObjectURL: (url: string) => {
        revoked.push(url)
      },
    },
  })
  const button = f.button('匯出報告')
  button.emit('click', '', false)
  assert.equal(created.length, 0)
  button.emit('click')
  assert.equal(created.length, 1)
  assert.equal(created[0]!.type, 'application/json;charset=utf-8')
  assert.deepEqual(revoked, [])
  f.button('總覽').emit('click')
  assert.deepEqual(revoked, ['blob:owned-report'])
  button.emit('click')
  assert.equal(created.length, 1)
  f.center.close()
  assert.equal(revoked.length, 1)
})

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

test('control-center pages preserve defaults and build complete diagnostic report on request', (t) => {
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
  f.button('診斷').emit('click')
  assert.equal(f.toggle('只用 B 站原本提供的 CDN').checked, false)
  assert.equal(
    f.doc.flatten().some((e) => e.tag === 'textarea'),
    false,
  )
  f.button('查看完整報告').emit('click')
  const report = f.doc.flatten().find((e) => e.tag === 'textarea')!
  assert.equal(report.readOnly, true)
  const parsed = JSON.parse(report.value)
  assert.equal(parsed.current.version, 'contract')
  assert.equal(parsed.current.releaseStage, 'stable')
  assert.equal(parsed.export.truncated, false)
  assert.equal(f.storage.tasks.length, 0)
})

test('P05 native write starts in trusted dispatch with exact full report and original receiver', async (t) => {
  const f = copyUi(t),
    pending = deferred<void>(),
    rows: string[] = []
  const report = f.report(),
    text = '中文\n\n  保留空白  \n' + '完整報告 '.repeat(8000)
  report.value = text
  let dispatching = true
  const clipboard = {
    writeText(this: unknown, value: string) {
      assert.equal(this, clipboard)
      assert.equal(dispatching, true)
      rows.push(value)
      return pending.promise
    },
  }
  f.native(clipboard)
  const focusBefore = f.copy().focusCount
  f.copy().emit('click')
  dispatching = false
  assert.deepEqual(rows, [text])
  assert.deepEqual(f.gmCalls, [])
  assert.equal(f.copy().disabled, true)
  assert.equal(f.status().attributes.get('aria-live'), 'polite')
  assert.equal(f.status().textContent, '正在複製報告…')
  // Later edits must not replace the text already submitted by this operation.
  report.value = '不同的報告'
  pending.resolve()
  await flushCopy()
  assert.equal(f.report(), report)
  assert.equal(report.value, '不同的報告')
  assert.equal(f.status().textContent, '已複製報告')
  assert.equal(f.copy().disabled, false)
  assert.equal(f.copy().focusCount, focusBefore)
  assert.deepEqual(rows, [text])
})

for (const unavailable of [
  'navigator',
  'clipboard',
  'method',
  'clipboard-getter',
  'method-getter',
] as const) {
  test(`P05 ${unavailable} unavailable uses one plain-text GM fallback without claiming copied`, async (t) => {
    const f = copyUi(t),
      text = f.report().value
    if (unavailable === 'navigator')
      f.scope.defineGlobal('navigator', { configurable: true, value: undefined })
    if (unavailable === 'method')
      f.scope.defineGlobal('navigator', { configurable: true, value: { clipboard: {} } })
    if (unavailable === 'clipboard-getter')
      f.scope.defineGlobal('navigator', {
        configurable: true,
        value: {
          get clipboard(): never {
            throw Error('unavailable')
          },
        },
      })
    if (unavailable === 'method-getter')
      f.scope.defineGlobal('navigator', {
        configurable: true,
        value: {
          clipboard: {
            get writeText(): never {
              throw Error('unavailable')
            },
          },
        },
      })
    f.copy().emit('click')
    await flushCopy()
    assert.deepEqual(f.gmCalls, [{ text, format: 'text' }])
    assert.equal(f.status().textContent, '已交由腳本管理器處理，請貼上確認')
    assert.equal(f.copy().disabled, false)
  })
}

for (const failure of ['throw', 'reject'] as const) {
  test(`P05 native ${failure} preserves report and does not retry through GM`, async (t) => {
    const f = copyUi(t),
      report = f.report(),
      text = report.value,
      pending = deferred<void>()
    f.native({
      writeText: () => {
        if (failure === 'throw') throw Error('private error')
        return pending.promise
      },
    })
    f.copy().emit('click')
    if (failure === 'reject') pending.reject(Error('private rejection'))
    await flushCopy()
    assert.equal(f.status().textContent, '複製失敗，請選取報告自行複製')
    assert.deepEqual(f.gmCalls, [])
    assert.equal(f.copy().disabled, false)
    assert.equal(f.report(), report)
    assert.equal(report.value, text)
  })
}

for (const failure of ['missing', 'throw'] as const) {
  test(`P05 GM ${failure} has a bounded failure message and retains the report`, async (t) => {
    const f = copyUi(t),
      text = f.report().value
    f.scope.defineGlobal('GM_setClipboard', {
      configurable: true,
      value:
        failure === 'missing'
          ? undefined
          : () => {
              throw Error('private GM error')
            },
    })
    f.copy().emit('click')
    await flushCopy()
    assert.equal(f.status().textContent, '複製失敗，請選取報告自行複製')
    assert.equal(f.report().value, text)
    assert.equal(f.copy().disabled, false)
  })
}

test('P05 synthetic and detached old copy buttons cannot initiate a write', async (t) => {
  const f = copyUi(t),
    rows: string[] = []
  f.native({
    writeText: async (text) => {
      rows.push(text)
    },
  })
  const old = f.copy()
  old.emit('click', '', false)
  f.button('總覽').emit('click')
  old.emit('click')
  await flushCopy()
  assert.deepEqual(rows, [])
  assert.deepEqual(f.gmCalls, [])
})

test('P05 pending native write remains single flight across repeat click and close/reopen', async (t) => {
  const f = copyUi(t),
    pending = deferred<void>(),
    rows: string[] = []
  f.native({
    writeText: (text) => {
      rows.push(text)
      return pending.promise
    },
  })
  const old = f.copy()
  old.emit('click')
  old.emit('click')
  assert.equal(rows.length, 1)
  f.center.close()
  f.center.show()
  f.button('診斷').emit('click')
  f.clock.advance(0)
  f.copy().emit('click')
  assert.equal(rows.length, 1)
  assert.equal(f.status().textContent, '前次複製尚未結束，請稍後再試')
  const newStatus = f.status(),
    newButton = f.copy(),
    focus = newButton.focusCount
  pending.resolve()
  await flushCopy()
  assert.equal(newStatus.textContent, '前次複製尚未結束，請稍後再試')
  assert.equal(newButton.focusCount, focus)
  newButton.emit('click')
  await flushCopy()
  assert.equal(rows.length, 2)
  assert.equal(f.status().textContent, '已複製報告')
})

for (const action of ['close', 'navigate', 'rebuild'] as const) {
  for (const outcome of ['resolve', 'reject'] as const) {
    test(`P05 ${action} invalidates UI ownership of late native ${outcome}`, async (t) => {
      const f = copyUi(t),
        pending = deferred<void>()
      f.native({ writeText: () => pending.promise })
      f.copy().emit('click')
      const oldStatus = f.status(),
        oldButton = f.copy()
      if (action === 'close') f.center.close()
      if (action === 'navigate') f.button('總覽').emit('click')
      if (action === 'rebuild') {
        const host = f.doc.flatten().find((e) => e.id === 'bilicdn-v2-control-center')!
        host.parent = null
        f.doc.children = f.doc.children.filter((e) => e !== host)
        f.center.show()
        f.button('診斷').emit('click')
      }
      f.clock.advance(0)
      const before = f.doc.flatten().map((e) => [e, e.textContent, e.focusCount])
      if (outcome === 'resolve') pending.resolve()
      else pending.reject(Error('late private error'))
      await flushCopy()
      assert.deepEqual(
        f.doc.flatten().map((e) => [e, e.textContent, e.focusCount]),
        before,
      )
      assert.equal(oldStatus.textContent, '正在複製報告…')
      assert.equal(oldButton.disabled, true)
      assert.deepEqual(f.gmCalls, [])
    })
  }
}

test('P05 synchronous clipboard lookup reentry cannot submit an obsolete view write', async (t) => {
  const f = copyUi(t)
  let writes = 0
  f.scope.defineGlobal('navigator', {
    configurable: true,
    value: {
      get clipboard() {
        f.center.close()
        f.center.show()
        return {
          writeText: async () => {
            writes++
          },
        }
      },
    },
  })
  f.copy().emit('click')
  await flushCopy()
  assert.equal(writes, 0)
  assert.deepEqual(f.gmCalls, [])
  assert.equal(f.doc.flatten().find((e) => e.tag === 'h2')?.textContent, 'BiliCDN 控制中心')
})

test('P05 synchronous native write reentry does not publish into a replacement view', async (t) => {
  const f = copyUi(t)
  let writes = 0
  f.native({
    writeText: async () => {
      writes++
      f.center.close()
      f.center.show()
    },
  })
  f.copy().emit('click')
  f.clock.advance(0)
  const before = f.doc.flatten().map((e) => [e, e.textContent, e.focusCount])
  await flushCopy()
  assert.equal(writes, 1)
  assert.deepEqual(f.gmCalls, [])
  assert.deepEqual(
    f.doc.flatten().map((e) => [e, e.textContent, e.focusCount]),
    before,
  )
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
      assert.equal(f.doc.flatten().find((e) => e.tag === 'h2')?.textContent, 'BiliCDN 控制中心')
      assert.equal(pageCalls, 0)
      assert.equal(external.focusCount, 0)
    })
  }
}

test('R03 completing an older command cannot replace the settings view or take focus', async (t) => {
  const f = ui(t)
  f.button('停用腳本').emit('click')
  f.button('播放設定').emit('click')
  const heading = f.doc.flatten().find((e) => e.tag === 'h2')
  await f.storage.drain()
  for (let i = 0; i < 8; i++) await Promise.resolve()
  f.clock.advance(0)
  assert.equal(
    f.doc.flatten().find((e) => e.tag === 'h2'),
    heading,
  )
  assert.equal(heading?.textContent, 'BiliCDN 控制中心')
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
  f.button('診斷').emit('click')
  f.button('查看完整報告').emit('click')
  const report = f.doc.flatten().find((e) => e.tag === 'textarea')
  assert.ok(report)
  assert.equal(report.emit('keydown', 'c').defaultPrevented, false)
  assert.equal(bubbles, 0)
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
  await flushCopy()
  assert.equal(f.toggle('慢請求提前重試'), input)
})

test('CC39-UI removed controls cannot be reached from any page', (t) => {
  const f = ui(t)
  for (const tab of ['總覽', 'CDN', '播放設定', '診斷']) {
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

test('CC39-UI four tabs separate CDN from six real settings and defer complete report work', async (t) => {
  const f = ui(t)
  let reports = 0
  const original = f.deps.diagnostics.buildReport.bind(f.deps.diagnostics)
  f.deps.diagnostics.buildReport = (model) => {
    reports++
    return original(model)
  }
  assert.ok(f.doc.flatten().some((e) => e.textContent === 'BiliCDN 控制中心'))
  for (const label of ['總覽', 'CDN', '播放設定', '診斷']) assert.ok(f.button(label))
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
    await flushCopy()
    assert.equal(f.settings.get()[key], false)
    assert.equal(f.toggle(label), input, 'settings updates preserve the focused control')
  }
  f.button('CDN').emit('click')
  assert.equal(f.toggle('cn-hk-eq-01-03.bilivideo.com').checked, true)
  assert.equal(f.toggle('允許參考 B 站原生來源').checked, true)
  f.button('診斷').emit('click')
  assert.equal(reports, 0)
  f.button('查看完整報告').emit('click')
  assert.equal(reports, 1)
  f.button('總覽').emit('click')
  assert.equal(reports, 1)
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
  assert.ok(f.doc.flatten().some((e) => e.textContent === '42.5'))
  assert.equal(f.clock.pendingCount, tasks)
  assert.equal(listeners.size, 1)
  f.center.close()
  assert.equal(listeners.size, 0)
})

function readSummary(f: ReturnType<typeof ui>): Element {
  if (!f.doc.flatten().some((e) => e.className === 'summary'))
    f.button('查看詳細狀態').emit('click')
  return f.doc.flatten().find((e) => e.className === 'summary')!
}

function ui(t: TestContext) {
  const storage = new QueuedSettingsStorage()
  storage.values.set('bilicdn.v2.settings', { schema: 2, considerNativeSources: true })
  const f = fixture(t, storage),
    doc = new Element('document')
  f.scope.defineGlobal('GM_info', {
    configurable: true,
    value: { script: { version: 'contract' } },
  })
  const body = new Element('body'),
    video = new Element('video')
  doc.append(body, video)
  f.scope.defineGlobal('HTMLElement', { configurable: true, value: Element })
  f.scope.defineGlobal('document', {
    configurable: true,
    value: {
      documentElement: doc,
      body,
      activeElement: null,
      createElement: (tag: string) => new Element(tag),
      querySelector: () => video,
    },
  })
  f.scope.defineGlobal('Option', {
    configurable: true,
    value: class extends Element {
      constructor(label: string, value: string) {
        super('option')
        this.textContent = label
        this.value = value
      }
    },
  })
  f.scope.defineGlobal('queueMicrotask', {
    configurable: true,
    value: (task: () => void) => f.clock.microtask(task),
  })
  const center = new ControlCenter({
    model: createControlReadModel(f.deps, 'contract'),
    version: 'contract',
    clipboard: writeClipboard,
    diagnostics: f.deps.diagnostics,
    commands: f.deps.commands,
    now: f.deps.now,
  })
  center.show()
  const button = (label: string) => {
    const found = doc.flatten().find((e) => e.tag === 'button' && e.textContent === label)
    assert.ok(found, label)
    return found
  }
  const toggle = (label: string) => {
    const row = doc
      .flatten()
      .find(
        (e) =>
          e.className === 'row' &&
          e.children.some((child) => child.tag === 'label' && child.textContent === label),
      )
    const input = row?.children.find((e) => e.tag === 'input')
    assert.ok(input, label)
    return input
  }
  f.scope.defer(() => center.close())
  return { ...f, storage, doc, center, button, toggle }
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
