import { evidenceMetrics } from '../domain/evidence.ts'
import type { ControlCenterDependencies, ShowControlCenterPort } from './control-center-ports.ts'
import type { ControlCenterSnapshot } from './control-center-model.ts'
import type { ControlViewActions } from './view-ports.ts'
import { createControlCenterStyle } from './styles.ts'
import { createButton } from './elements.ts'
import { renderOverview } from './overview-view.ts'
import { renderSettings } from './settings-view.ts'
import { renderDiagnostics } from './diagnostics-view.ts'
export type { ControlCenterDependencies } from './control-center-ports.ts'
export type { ControlCenterSnapshot } from './control-center-model.ts'

export class ControlCenter implements ShowControlCenterPort {
  #host: HTMLDivElement | null = null
  #shadow: ShadowRoot | null = null
  #opener: HTMLElement | null = null
  #viewVersion = 0
  #open = false
  #releaseKeyboard: (() => void) | null = null
  #pendingCopy: object | null = null
  constructor(private readonly deps: ControlCenterDependencies) {}

  show(opener?: HTMLElement | null): void {
    this.#open = true
    this.#opener =
      opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    this.#ensure()
    this.#observeKeyboard()
    this.#renderOverview()
  }

  close(): void {
    this.#open = false
    this.#viewVersion++
    this.#clearKeyboard()
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

  #shell(title: string): { body: HTMLDivElement; foot: HTMLElement } {
    const version = ++this.#viewVersion
    const backdrop = document.createElement('div')
    backdrop.className = 'backdrop'
    const dialog = document.createElement('section')
    dialog.className = 'dialog'
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-modal', 'true')
    const head = document.createElement('header')
    head.className = 'head'
    const heading = document.createElement('h2')
    heading.textContent = title
    const close = createButton('關閉', () => this.close())
    close.dataset.action = 'close'
    head.append(heading, close)
    const body = document.createElement('div')
    body.className = 'body'
    const foot = document.createElement('footer')
    foot.className = 'foot'
    dialog.append(head, body, foot)
    backdrop.append(dialog)
    this.#shadow?.replaceChildren(createControlCenterStyle(), backdrop)
    queueMicrotask(() => {
      if (this.#ownsView(version)) close.focus()
    })
    return { body, foot }
  }

  #viewActions(): ControlViewActions {
    return {
      overview: () => this.#renderOverview(),
      settings: () => this.#renderSettings(),
      diagnostics: () => this.#renderDiagnostics(),
      close: () => this.close(),
      refreshAfter: (command, render) => this.#refreshAfter(command, render),
    }
  }
  #renderOverview(): void {
    const frame = this.#shell('BiliCDN v2 控制中心')
    renderOverview(this.deps, frame, this.#viewActions())
  }
  #renderSettings(): void {
    const frame = this.#shell('CDN 與播放設定')
    renderSettings(this.deps, frame, this.#viewActions())
  }
  #renderDiagnostics(): void {
    const frame = this.#shell('診斷報告')
    renderDiagnostics(this.deps.diagnostics, frame, {
      overview: () => this.#renderOverview(),
      refresh: () => this.#renderDiagnostics(),
      report: () => this.deps.diagnostics.buildReport(this.#readModel()),
      captureCopy: () => {
        const version = this.#viewVersion
        return (report, button, status) => this.#copyReport(report, button, status, version)
      },
    })
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

  #readModel(): ControlCenterSnapshot {
    const now = this.deps.now(),
      evidence = this.deps.evidence
        .list()
        .slice(0, 96)
        .map((row) => ({ host: row.host, kind: row.kind, ...evidenceMetrics(row, now) }))
    return Object.freeze({
      version: GM_info?.script?.version ?? '2.1.1',
      settings: this.deps.settings.get(),
      session: this.deps.session.get(),
      monitor: this.deps.monitor.snapshot(),
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

  async #refreshAfter(command: Promise<unknown>, render: () => void): Promise<void> {
    const version = this.#viewVersion
    await command
    if (this.#ownsView(version)) render()
  }
}
