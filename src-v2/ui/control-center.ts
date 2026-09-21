import { DEFAULT_UNAVAILABLE_HOSTS, TRUSTED_CATALOG } from '../domain/catalog.ts'
import { evidenceMetrics } from '../domain/evidence.ts'
import type { DiagnosticRecorder } from '../diagnostics/recorder.ts'
import type { MeasurementController } from '../application/measurement-controller.ts'
import type { PlayerMonitor } from '../application/player-monitor.ts'
import type { RecoveryController } from '../application/recovery-controller.ts'
import type { RouteCoordinator } from '../application/route-coordinator.ts'
import type { EvidenceStore } from '../state/evidence-store.ts'
import type { RestrictionStore } from '../state/restriction-store.ts'
import type { SessionStore } from '../state/session-store.ts'
import type { SettingsStore, CodecPreference } from '../state/settings-store.ts'

const css = `
:host{all:initial;color-scheme:dark}*{box-sizing:border-box}.backdrop{position:fixed;inset:0;z-index:2147483647;background:#000a;display:grid;place-items:center;padding:18px;font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;color:#eef6ff}.dialog{width:min(760px,100%);max-height:88vh;display:flex;flex-direction:column;background:#101a2b;border:1px solid #405169;border-radius:12px;box-shadow:0 20px 70px #000d}.head,.foot{display:flex;align-items:center;gap:8px;padding:14px 16px;border-bottom:1px solid #34445b}.head{justify-content:space-between}.foot{justify-content:flex-end;border:0;border-top:1px solid #34445b;flex-wrap:wrap}.body{padding:14px 16px;overflow:auto;display:grid;gap:12px}h2,h3,p{margin:0}.summary{white-space:pre-wrap;color:#cfe5ff}.grid{display:grid;gap:7px}.row{display:flex;align-items:center;gap:10px;padding:8px;border:1px solid #34445b;border-radius:7px;background:#162338}.row label{flex:1;overflow-wrap:anywhere}.detail{font-size:12px;color:#9fb3ca}.btn,select{font:inherit;border:1px solid #52657e;border-radius:7px;background:#213149;color:#f6fbff;padding:7px 11px}.btn{cursor:pointer}.btn.primary{background:#075985;border-color:#0ea5e9}.btn.danger{background:#7f1d1d;border-color:#f87171}.report{width:100%;height:min(52vh,520px);background:#050a12;color:#dbeafe;border:1px solid #405169;border-radius:8px;padding:10px;font:12px/1.5 ui-monospace,Consolas,monospace;resize:vertical}
`

export interface ControlCenterDependencies {
  readonly settings: SettingsStore
  readonly restrictions: RestrictionStore
  readonly evidence: EvidenceStore
  readonly session: SessionStore
  readonly routes: RouteCoordinator
  readonly measurement: MeasurementController
  readonly monitor: PlayerMonitor
  readonly recovery: RecoveryController
  readonly diagnostics: DiagnosticRecorder
  readonly storageDelete: (key: string) => void
  readonly now: () => number
}

export class ControlCenter {
  #host: HTMLDivElement | null = null
  #shadow: ShadowRoot | null = null
  #opener: HTMLElement | null = null
  constructor(private readonly deps: ControlCenterDependencies) {}

  show(opener?: HTMLElement | null): void {
    this.#opener = opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    this.#ensure()
    this.#renderOverview()
  }

  close(): void {
    if (this.#shadow) this.#shadow.replaceChildren(this.#style())
    const target = this.#opener?.isConnected ? this.#opener : document.querySelector('video') ?? document.body
    if (target instanceof HTMLElement) { try { target.focus({ preventScroll: true }) } catch { /* detached */ } }
  }

  #ensure(): void {
    if (this.#host?.isConnected && this.#shadow) return
    this.#host = document.createElement('div')
    this.#host.id = 'bilicdn-v2-control-center'
    this.#shadow = this.#host.attachShadow({ mode: 'closed' })
    this.#shadow.append(this.#style())
    document.documentElement.append(this.#host)
    this.#shadow.addEventListener('keydown', event => {
      const keyboard = event as KeyboardEvent
      if (!keyboard.isTrusted || keyboard.key !== 'Escape') return
      event.preventDefault(); event.stopPropagation(); this.close()
    })
  }

  #style(): HTMLStyleElement { const style = document.createElement('style'); style.textContent = css; return style }

  #shell(title: string): { body: HTMLDivElement; foot: HTMLElement } {
    const backdrop = document.createElement('div'); backdrop.className = 'backdrop'
    const dialog = document.createElement('section'); dialog.className = 'dialog'; dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true')
    const head = document.createElement('header'); head.className = 'head'
    const heading = document.createElement('h2'); heading.textContent = title
    const close = this.#button('關閉', () => this.close()); close.dataset.action = 'close'
    head.append(heading, close)
    const body = document.createElement('div'); body.className = 'body'
    const foot = document.createElement('footer'); foot.className = 'foot'
    dialog.append(head, body, foot); backdrop.append(dialog)
    this.#shadow?.replaceChildren(this.#style(), backdrop)
    queueMicrotask(() => close.focus())
    return { body, foot }
  }

  #renderOverview(): void {
    const { body, foot } = this.#shell('BiliCDN v2 控制中心')
    const state = this.deps.session.get(), settings = this.deps.settings.get(), monitor = this.deps.monitor.snapshot()
    const affinity = state.affinity ? `${state.affinity.type} / ${state.affinity.host}` : '尚未觀察'
    const summary = document.createElement('p'); summary.className = 'summary'
    summary.textContent = `狀態：${settings.disabled ? '停用' : '啟用'}｜模式：${settings.fixedHost ? `固定 ${settings.fixedHost}` : '自動'}\n路線：${affinity}\n播放：${monitor.watchdog}｜可播放 ${monitor.video.playableBufferSec.toFixed(1)} 秒｜${monitor.video.effectiveRate}x\n核心：${this.deps.recovery.snapshot().state}｜單一挑戰者：${this.deps.measurement.snapshot().state}`
    const routes = this.deps.routes.snapshot(), latest = routes.latest as Record<string, Record<string, unknown>>
    for (const [kind, label] of [['video', '影片'], ['audio', '音訊'], ['unknown', '尚未分類媒體']] as const) {
      const row = latest[kind]
      if (!row) { if (kind !== 'unknown') summary.textContent += `\n${label}：尚無已歸因請求`; continue }
      const age = Math.max(0, Math.floor((this.deps.now() - Number(row.observedAt)) / 1000))
      summary.textContent += `\n${label}：送出 ${row.targetHost ?? '未知'} → 回應 ${row.responseHost ?? '未取得回應 host'}｜${age} 秒前｜結果 ${row.outcome ?? '未知'} / status ${row.status ?? '未知'}\n  請求攔截換 host：${row.hostChanged === true ? '是' : row.hostChanged === false ? '否' : '未知'}｜playurl 已改 host：${row.playurlHostChanged === true ? '是' : '否'}｜歸因：${row.attributionStatus ?? '等待資料'}`
    }
    const rep = routes.representation as { height: number; codec: string } | null
    summary.textContent += `\n畫質歸因：${rep ? `${rep.height}p / ${rep.codec}` : String(routes.attribution)}\n量測狀態：${this.deps.measurement.snapshot().reason}`
    body.append(summary)
    const actions = document.createElement('div'); actions.className = 'grid'
    actions.append(
      this.#button(settings.disabled ? '啟用腳本' : '停用腳本', async () => { await this.deps.settings.update({ disabled: !settings.disabled }); this.#renderOverview() }, 'primary'),
      this.#button('CDN 與播放設定', () => this.#renderSettings()),
      this.#button('診斷與事故記錄', () => this.#renderDiagnostics()),
      this.#button('重新評估一個安全候選', () => { this.deps.measurement.requestManual(); this.#renderOverview() }),
      this.#button('將目前影片路線加入黑名單 24 小時', async () => {
        const host = this.deps.routes.latestVideoHost()
        if (host) await this.deps.restrictions.add({ host, type: 'black', kind: 'video', reason: 'user', expireAt: this.deps.now() + 24 * 60 * 60 * 1000 })
        this.deps.routes.invalidateForUserSetting(); this.#renderOverview()
      }, 'danger'),
      this.#button('清除 v2 學習資料', async () => { await this.deps.evidence.clear(); await this.deps.restrictions.clear(); this.deps.storageDelete('bilicdn.v2.meta'); this.#renderOverview() }, 'danger'),
      this.#button('恢復 v2 預設設定', async () => { await this.deps.settings.reset(); this.deps.routes.invalidateForUserSetting(); this.#renderOverview() }, 'danger'),
    )
    const blacklistButton = [...actions.querySelectorAll('button')].find(button => button.textContent?.startsWith('將目前影片路線'))
    if (blacklistButton && !this.deps.routes.latestVideoHost()) {
      blacklistButton.disabled = true
      blacklistButton.textContent = '尚無 60 秒內成功歸因的影片回應，無法指定黑名單節點'
    }
    body.append(actions)
    foot.append(this.#button('關閉', () => this.close()))
  }

  #renderSettings(): void {
    const { body, foot } = this.#shell('CDN 與播放設定')
    const settings = this.deps.settings.get(), rows = document.createElement('div'); rows.className = 'grid'
    const mode = document.createElement('select')
    mode.append(new Option('自動選路', ''), ...TRUSTED_CATALOG.map(host => new Option(`固定：${host}`, host)))
    mode.value = settings.fixedHost ?? ''
    mode.addEventListener('change', event => { if (!event.isTrusted) return; void this.deps.settings.update({ fixedHost: mode.value || null }).then(() => { this.deps.routes.invalidateForUserSetting(); this.#renderSettings() }) })
    rows.append(this.#row('選路模式', mode))
    const codec = document.createElement('select')
    for (const value of ['av1','hevc','avc','auto'] as CodecPreference[]) codec.append(new Option(value.toUpperCase(), value))
    codec.value = settings.codec
    codec.addEventListener('change', event => { if (event.isTrusted) void this.deps.settings.update({ codec: codec.value as CodecPreference }) })
    rows.append(this.#row('Codec 偏好（下一份 playurl 生效）', codec))
    rows.append(this.#toggle('阻擋 WebRTC', settings.blockWebRtc, value => this.deps.settings.update({ blockWebRtc: value })))
    rows.append(this.#toggle('阻擋 HTTPDNS', settings.blockHttpDns, value => this.deps.settings.update({ blockHttpDns: value })))
    rows.append(this.#toggle('Verbose 診斷', settings.verbose, value => this.deps.settings.update({ verbose: value })))
    for (const host of TRUSTED_CATALOG) {
      const defaultEnabled = !DEFAULT_UNAVAILABLE_HOSTS.has(host)
      const enabled = settings.catalogOverrides[host] ?? defaultEnabled
      rows.append(this.#toggle(host, enabled, async value => {
        await this.deps.settings.update({ catalogOverrides: { ...this.deps.settings.get().catalogOverrides, [host]: value } })
        this.deps.routes.invalidateForUserSetting()
      }, defaultEnabled ? '內建 Catalog' : '預設不可用；勾選後才允許'))
    }
    body.append(rows); foot.append(this.#button('返回', () => this.#renderOverview()))
  }

  #renderDiagnostics(): void {
    const { body, foot } = this.#shell('診斷與事故記錄')
    const report = document.createElement('textarea'); report.className = 'report'; report.readOnly = true
    report.value = this.deps.diagnostics.buildReport(this.#readModel())
    body.append(report)
    foot.append(
      this.#button('標記剛剛卡頓', () => { this.deps.diagnostics.mark(); this.#renderDiagnostics() }),
      this.#button('清除事故', () => { this.deps.diagnostics.clear(); this.#renderDiagnostics() }),
      this.#button('複製報告', () => { try { GM_setClipboard(report.value) } catch { void navigator.clipboard?.writeText(report.value) } }),
      this.#button('返回', () => this.#renderOverview()),
    )
  }

  #readModel(): Readonly<Record<string, unknown>> {
    const now = this.deps.now(), evidence = this.deps.evidence.list().slice(0, 96).map(row => ({ host: row.host, kind: row.kind, ...evidenceMetrics(row, now) }))
    return Object.freeze({ version: GM_info?.script?.version ?? '2.0.2', settings: this.deps.settings.get(), session: this.deps.session.get(),
      monitor: this.deps.monitor.snapshot(), recovery: this.deps.recovery.snapshot(), measurement: this.deps.measurement.snapshot(),
      routes: this.deps.routes.snapshot(), restrictions: this.deps.restrictions.list(), evidence })
  }

  #button(label: string, action: () => void | Promise<void>, tone = ''): HTMLButtonElement {
    const button = document.createElement('button'); button.type = 'button'; button.className = `btn ${tone}`.trim(); button.textContent = label
    button.addEventListener('click', event => { if (!event.isTrusted) return; event.preventDefault(); event.stopPropagation(); void action() })
    return button
  }

  #row(label: string, control: HTMLElement, detail = ''): HTMLDivElement {
    const row = document.createElement('div'); row.className = 'row'; const text = document.createElement('label'); text.textContent = label
    if (detail) { const small = document.createElement('span'); small.className = 'detail'; small.textContent = detail; text.append(document.createElement('br'), small) }
    row.append(text, control); return row
  }

  #toggle(label: string, checked: boolean, update: (value: boolean) => void | Promise<unknown>, detail = ''): HTMLDivElement {
    const input = document.createElement('input'); input.type = 'checkbox'; input.checked = checked
    input.addEventListener('change', event => { if (!event.isTrusted) { input.checked = checked; return }; void update(input.checked) })
    return this.#row(label, input, detail)
  }
}
