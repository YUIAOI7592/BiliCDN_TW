import type {
  ControlCenterDependencies,
  ControlCenterSnapshot,
  ShowControlCenterPort,
} from './control-contracts.ts'
import type { ControlViewActions, ControlViewBinding, ControlPage } from './control-contracts.ts'
import { createControlCenterStyle } from './styles.ts'
import { createButton } from './elements.ts'
import { renderOverview } from './overview-view.ts'
import { renderSettings } from './settings-view.ts'
import { renderCdn } from './cdn-view.ts'
export class ControlCenter implements ShowControlCenterPort {
  #host: HTMLDivElement | null = null
  #shadow: ShadowRoot | null = null
  #opener: HTMLElement | null = null
  #viewVersion = 0
  #queuedRefresh: { readonly version: number } | null = null
  #open = false
  #releaseKeyboard: (() => void) | null = null
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
    this.#subscriptions.push(
      this.deps.model.subscribe((source) => {
        if (source === 'settings') this.#refresh()
        else this.#queueRefresh()
      }),
    )
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
    this.#queuedRefresh = null
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
    version.textContent = 'v' + this.deps.version + ' · 播放與路線狀態'
    brand.append(heading, version)
    const power = createButton('', () => {
      if (!this.#open || this.#power !== power) return
      return this.#refreshAfter(
        this.deps.commands.updateSettings({
          disabled: !this.deps.model.snapshot().settings.disabled,
        }),
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
    this.#queuedRefresh = null
    const version = ++this.#viewVersion
    this.#binding?.dispose?.()
    this.#binding = null
    this.#frame.body.replaceChildren()
    this.#frame.foot.replaceChildren()
    for (const [name, tab] of Object.entries(this.#tabs))
      tab.setAttribute('aria-current', name === page ? 'page' : 'false')
    if (this.#notice) this.#notice.textContent = ''
    const actions: ControlViewActions = {
      ownsView: () => this.#ownsView(version),
      refresh: () => {
        if (this.#ownsView(version)) this.#refresh()
      },
      refreshAfter: (command, settled) => this.#refreshAfter(command, version, settled),
    }
    const model = this.deps.model.snapshot()
    if (!this.#ownsView(version)) return
    this.#binding =
      page === 'overview'
        ? renderOverview(this.#frame, actions, this.deps.now, model)
        : page === 'cdn'
          ? renderCdn(this.deps.commands, this.#frame, actions, model)
          : renderSettings(this.deps.commands, this.#frame, actions, model)
    this.#refresh(model)
  }

  #refresh(model?: ControlCenterSnapshot): void {
    if (!this.#open || !this.#host?.isConnected) return
    const version = this.#viewVersion,
      host = this.#host
    if (!model) {
      // Invalidate only work queued before this read; reentrant notifications are newer.
      this.#queuedRefresh = null
      model = this.deps.model.snapshot()
    }
    if (!this.#ownsView(version) || this.#host !== host || !host.isConnected) return
    if (this.#power) {
      const enabled = !model.settings.disabled
      this.#power.textContent = enabled ? '停用腳本' : '啟用腳本'
      this.#power.setAttribute('aria-pressed', String(enabled))
    }
    this.#binding?.refresh(model)
  }

  #queueRefresh(): void {
    if (!this.#open || this.#queuedRefresh) return
    const work = { version: this.#viewVersion }
    this.#queuedRefresh = work
    queueMicrotask(() => {
      if (this.#queuedRefresh !== work) return
      this.#queuedRefresh = null
      if (this.#ownsView(work.version)) this.#refresh()
    })
  }

  #ownsView(version: number): boolean {
    return this.#open && this.#viewVersion === version
  }

  async #refreshAfter(
    command: Promise<unknown>,
    version = this.#viewVersion,
    settled?: () => void,
  ): Promise<void> {
    try {
      await command
      settled?.()
      if (this.#ownsView(version)) this.#refresh()
    } catch {
      settled?.()
      if (this.#ownsView(version)) {
        this.#refresh()
        if (this.#notice) this.#notice.textContent = '設定未能保存，請稍後再試。'
      }
    }
  }
}
