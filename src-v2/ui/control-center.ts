import { evidenceMetrics } from '../domain/evidence.ts'
import type {
  ControlCenterDependencies,
  ControlCenterSnapshot,
  ShowControlCenterPort,
} from './control-center-ports.ts'
import type { ControlViewActions, ControlViewBinding, ControlPage } from './view-ports.ts'
import { createControlCenterStyle } from './styles.ts'
import { createButton } from './elements.ts'
import { renderOverview } from './overview-view.ts'
import { renderSettings } from './settings-view.ts'
import { renderCdn } from './cdn-view.ts'
import { renderDiagnostics } from './diagnostics-view.ts'
export type { ControlCenterDependencies } from './control-center-ports.ts'
export type { ControlCenterSnapshot } from './control-center-ports.ts'

export class ControlCenter implements ShowControlCenterPort {
  #host: HTMLDivElement | null = null
  #shadow: ShadowRoot | null = null
  #opener: HTMLElement | null = null
  #viewVersion = 0
  #open = false
  #releaseKeyboard: (() => void) | null = null
  #pendingCopy: object | null = null
  #binding: ControlViewBinding | null = null
  #subscriptions: (() => void)[] = []
  #frame: { body: HTMLDivElement; foot: HTMLElement } | null = null
  #tabs: Partial<Record<ControlPage, HTMLButtonElement>> = {}
  #power: HTMLButtonElement | null = null
  #notice: HTMLElement | null = null
  constructor(private readonly deps: ControlCenterDependencies) {}

  show(opener?: HTMLElement | null): void {
    this.#open = true
    this.#opener =
      opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    this.#ensure()
    this.#observeKeyboard()
    this.#releaseView()
    this.#shell()
    this.#navigate('overview')
    for (const source of [this.deps.settings, this.deps.monitor, this.deps.routes]) {
      if (source.subscribe) this.#subscriptions.push(source.subscribe(() => this.#refresh()))
    }
  }

  close(): void {
    this.#open = false
    this.#viewVersion++
    this.#clearKeyboard()
    this.#releaseView()
    this.#frame = null
    this.#tabs = {}
    this.#power = null
    this.#notice = null
    if (this.#shadow) this.#shadow.replaceChildren(createControlCenterStyle())
    const target = this.#opener?.isConnected
      ? this.#opener
      : (document.querySelector('video') ?? document.body)
    if (target instanceof HTMLElement) {
      try {
        target.focus({ preventScroll: true })
      } catch {
        /* detached */
      }
    }
  }

  #ensure(): void {
    if (this.#host?.isConnected && this.#shadow) return
    this.#clearKeyboard()
    this.#host = document.createElement('div')
    this.#host.id = 'bilicdn-v2-control-center'
    this.#shadow = this.#host.attachShadow({ mode: 'closed' })
    this.#shadow.append(createControlCenterStyle())
    document.documentElement.append(this.#host)
  }

  #clearKeyboard(): void {
    this.#releaseKeyboard?.()
    this.#releaseKeyboard = null
  }

  #observeKeyboard(): void {
    if (this.#releaseKeyboard || !this.#host || !this.#shadow) return
    const host = this.#host,
      shadow = this.#shadow
    const onKeyboard = (event: Event): void => {
      if (
        !event.isTrusted ||
        !this.#open ||
        this.#host !== host ||
        this.#shadow !== shadow ||
        !host.isConnected ||
        event.currentTarget !== shadow
      )
        return
      // Keep native controls' default actions; only isolate the page's bubble shortcuts.
      // An outer capture listener has already run and cannot be undone here.
      event.stopPropagation()
      if (event.type === 'keydown' && (event as KeyboardEvent).key === 'Escape') {
        event.preventDefault()
        this.close()
      }
    }
    const types = ['keydown', 'keypress', 'keyup'] as const
    for (const type of types) shadow.addEventListener(type, onKeyboard)
    this.#releaseKeyboard = () => {
      for (const type of types) shadow.removeEventListener(type, onKeyboard)
    }
  }

  #releaseView(): void {
    for (const release of this.#subscriptions.splice(0)) release()
    this.#binding?.dispose?.()
    this.#binding = null
  }

  #shell(): void {
    const backdrop = document.createElement('div')
    backdrop.className = 'backdrop'
    const dialog = document.createElement('section')
    dialog.className = 'dialog'
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-modal', 'true')
    dialog.setAttribute('aria-label', 'BiliCDN 控制中心')
    const head = document.createElement('header')
    head.className = 'head'
    const brand = document.createElement('div')
    brand.className = 'brand'
    const heading = document.createElement('h2')
    heading.textContent = 'BiliCDN 控制中心'
    const version = document.createElement('p')
    version.className = 'detail'
    version.textContent = 'v' + (GM_info?.script?.version ?? '未知') + ' · 播放與路線狀態'
    brand.append(heading, version)
    const power = createButton('', () => {
      if (!this.#open || this.#power !== power) return
      return this.#refreshAfter(
        this.deps.commands.updateSettings({ disabled: !this.deps.settings.get().disabled }),
      )
    })
    power.className = 'btn power'
    this.#power = power
    const close = createButton('關閉', () => {
      if (this.#open && this.#power === power) this.close()
    })
    close.dataset.action = 'close'
    head.append(brand, power, close)
    const nav = document.createElement('nav')
    nav.className = 'tabs'
    nav.setAttribute('aria-label', '控制中心頁面')
    this.#tabs = {}
    for (const [page, label] of [
      ['overview', '總覽'],
      ['cdn', 'CDN'],
      ['settings', '播放設定'],
      ['diagnostics', '診斷'],
    ] as const) {
      const tab = createButton(label, () => {
        if (this.#open && this.#tabs[page] === tab) this.#navigate(page)
      })
      tab.className = 'tab'
      this.#tabs[page] = tab
      nav.append(tab)
    }
    const body = document.createElement('div')
    body.className = 'body'
    const foot = document.createElement('footer')
    foot.className = 'foot'
    const notice = document.createElement('p')
    notice.className = 'notice'
    notice.setAttribute('aria-live', 'polite')
    this.#notice = notice
    dialog.append(head, nav, body, foot, notice)
    backdrop.append(dialog)
    this.#frame = { body, foot }
    this.#shadow?.replaceChildren(createControlCenterStyle(), backdrop)
    queueMicrotask(() => {
      if (this.#open && this.#power === power && close.isConnected) close.focus()
    })
  }

  #navigate(page: ControlPage): void {
    if (!this.#frame) return
    const version = ++this.#viewVersion
    this.#binding?.dispose?.()
    this.#binding = null
    this.#frame.body.replaceChildren()
    this.#frame.foot.replaceChildren()
    for (const [name, tab] of Object.entries(this.#tabs))
      tab.setAttribute('aria-current', name === page ? 'page' : 'false')
    if (this.#notice) this.#notice.textContent = ''
    const actions: ControlViewActions = {
      model: () => this.#readModel(),
      ownsView: () => this.#ownsView(version),
      refresh: () => {
        if (this.#ownsView(version)) this.#refresh()
      },
      refreshAfter: (command) => this.#refreshAfter(command),
    }
    this.#binding =
      page === 'overview'
        ? renderOverview(this.#frame, actions, this.deps.now)
        : page === 'cdn'
          ? renderCdn(this.deps, this.#frame, actions)
          : page === 'settings'
            ? renderSettings(this.deps, this.#frame, actions)
            : renderDiagnostics(this.deps, this.#frame, {
                ...actions,
                report: () => this.deps.diagnostics.buildReport(this.#readModel(true)),
                copy: (report, button, status) => this.#copyReport(report, button, status, version),
              })
    this.#refresh()
  }

  #refresh(): void {
    if (!this.#open || !this.#host?.isConnected) return
    if (this.#power) {
      const enabled = !this.deps.settings.get().disabled
      this.#power.textContent = enabled ? '停用腳本' : '啟用腳本'
      this.#power.setAttribute('aria-pressed', String(enabled))
    }
    this.#binding?.refresh(this.#readModel())
  }

  async #copyReport(
    report: HTMLTextAreaElement,
    button: HTMLButtonElement,
    status: HTMLElement,
    version: number,
  ): Promise<void> {
    const host = this.#host,
      shadow = this.#shadow
    const ownsView = (): boolean =>
      this.#ownsView(version) &&
      this.#host === host &&
      this.#shadow === shadow &&
      host?.isConnected === true &&
      report.isConnected &&
      button.isConnected &&
      status.isConnected
    if (!ownsView()) return
    if (this.#pendingCopy) {
      status.textContent = '前次複製尚未結束，請稍後再試'
      return
    }
    const operation = {}
    this.#pendingCopy = operation
    button.disabled = true
    status.textContent = '正在複製報告…'
    try {
      const text = report.value
      let clipboard: Clipboard | undefined, write: Clipboard['writeText'] | undefined
      try {
        clipboard = navigator.clipboard
        write = clipboard?.writeText
      } catch {
        /* API unavailable: GM compatibility path. */
      }
      // Clipboard lookup may synchronously replace the view. Never write for an obsolete owner.
      if (!ownsView()) return
      if (typeof write === 'function') {
        // Start during trusted click dispatch, with the native receiver and no preceding await.
        await write.call(clipboard, text)
        if (ownsView()) status.textContent = '已複製報告'
      } else {
        GM_setClipboard(text, 'text')
        if (ownsView()) status.textContent = '已交由腳本管理器處理，請貼上確認'
      }
    } catch {
      // A submitted write cannot be cancelled; do not issue a second write after a failure.
      if (ownsView()) status.textContent = '複製失敗，請選取報告自行複製'
    } finally {
      if (this.#pendingCopy === operation) this.#pendingCopy = null
      if (ownsView()) button.disabled = false
    }
  }

  #readModel(includeEvidence = false): ControlCenterSnapshot {
    const now = this.deps.now(),
      evidence = includeEvidence
        ? this.deps.evidence
            .list()
            .slice(0, 96)
            .map((row) => ({ host: row.host, kind: row.kind, ...evidenceMetrics(row, now) }))
        : []
    return Object.freeze({
      version: GM_info?.script?.version ?? '2.1.1',
      releaseStage: 'stable',
      settings: this.deps.settings.get(),
      session: this.deps.session.get(),
      monitor: this.deps.monitor.snapshot(),
      ...(this.deps.earlyRetry ? { earlyRetry: this.deps.earlyRetry.snapshot() } : {}),
      recovery: this.deps.recovery.snapshot(),
      measurement: this.deps.measurement.snapshot(),
      interception: this.deps.transport.snapshot(),
      routes: this.deps.routes.snapshot(),
      restrictions: this.deps.restrictions.list(),
      evidence,
    })
  }

  #ownsView(version: number): boolean {
    return this.#open && this.#viewVersion === version
  }

  async #refreshAfter(command: Promise<unknown>): Promise<void> {
    const version = this.#viewVersion
    try {
      await command
      if (this.#ownsView(version)) this.#refresh()
    } catch {
      if (this.#ownsView(version)) {
        this.#refresh()
        if (this.#notice) this.#notice.textContent = '設定未能保存，請稍後再試。'
      }
    }
  }
}
