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

const plain = (value: unknown, labels: Readonly<Record<string, string>>, fallback = '尚未確認'): string => {
  const key = String(value)
  return Object.hasOwn(labels, key) ? labels[key] ?? fallback : fallback
}

const routeLabel = (type: unknown): string => plain(type, {
  'catalog-generated': '腳本挑選的 CDN', 'native-signed': 'B 站提供的 CDN', 'root-original': 'B 站原本的 CDN',
})

const playbackLabel = (state: unknown): string => plain(state, {
  'no-video': '還沒找到影片', paused: '已暫停', 'seek-grace': '剛跳轉，等待載入',
  'buffered-to-end': '已緩衝到片尾', healthy: '播放正常', 'low-buffer': '緩衝不足', recovering: '正在嘗試恢復',
})

const recoveryLabel = (state: unknown): string => plain(state, {
  healthy: '正常', 'pause-armed': '已暫停，等待播放', 'play-intent': '正在嘗試繼續播放',
  waiting: '等待影片恢復', reloading: '正在重建播放器', recovered: '影片已恢復',
  'recovered-paused': '影片已恢復，等待手動播放', failed: '自動恢復失敗', breaker: '暫停自動恢復，避免反覆重試',
})

const recoveryReasonLabel = (reason: unknown): string => plain(reason, {
  'reload-unavailable': '播放器不支援自動重建', 'reload-threw': '播放器重建時出錯',
  'reload-rejected': '播放器拒絕重建', 'reload-timeout': '重建後仍未恢復',
  'play-rejected': '瀏覽器拒絕自動播放，請手動按播放', 'play-threw': '恢復播放時出錯',
  'restore-threw': '還原播放位置或倍速時出錯', 'media-error': '播放器回報媒體錯誤',
  'seek-interrupted': '跳轉影片時已停止恢復', 'lifecycle-ended': '影片已切換，舊的恢復流程已結束',
}, '原因請見診斷報告')

const measurementLabel = (state: unknown, reason: unknown): string => {
  const why = String(reason)
  if (why.startsWith('manual-')) return `已安排測速，${measurementLabel('waiting', why.slice(7))}`
  if (why.startsWith('candidate-')) return '正在測試 CDN 速度'
  if (why.startsWith('http-')) return `測試網址收到 HTTP ${why.slice(5)}，沒有取得有效速度`
  return plain(why, {
    disabled: '腳本已停用', 'no-representation': '尚未確認目前的影片資料', hidden: '分頁不在前景',
    seeking: '正在跳轉影片', recovering: '正在恢復播放', 'awaiting-progress': '等待影片穩定播放',
    'low-buffer': '緩衝還不夠，暫不測速', 'cross-tab-cooldown': '其他分頁最近測過速，等待冷卻',
    'no-stale-candidate': '目前沒有需要測試的 CDN', 'sample-recorded': '已記下測速結果',
    'short-response': '下載資料太少，無法判斷速度', timeout: '測速逾時', network: '測速時網路失敗',
    startup: '等待播放', generation: '等待新影片',
  }, plain(state, { idle: '尚未測速', waiting: '等待安全的測速時機', running: '正在測速',
    complete: '已完成測速', failed: '這次測速沒有結果', cancelled: '已停止測速' }))
}

const startupLabel = (state: unknown, reason: unknown): string => {
  if (state === 'running') return '正在起播前測試可用路線（最長 3 秒）'
  if (state === 'complete') return reason === 'measured' ? '已測試並選好起播路線' : '已放行合法路線，測試沒有明確結果'
  if (state === 'skipped') return plain(reason, {
    'unsupported-or-no-legal-candidate': '這筆請求無法安全預測試，已依原規則處理',
    'preflight-error': '預測試未完成，已依原規則處理',
  }, '這筆請求未進行起播預測試')
  return '等待播放器提出第一筆影音請求'
}

const attributionLabel = (status: unknown): string => plain(status, {
  matched: '已確認屬於這支影片', 'waiting-data': '還在等影片資料', weak: '只能辨識到相似網址，尚未確認',
  ambiguous: '可能對應多個畫質，尚未確認', detached: '屬於先前的影片',
  confirmed: '已確認', 'awaiting-second-video-transfer': '再收到一筆影片資料才能確認',
  'awaiting-matched-video': '等待可辨識的影片資料',
})

const restrictionLabel = (reason: unknown): string => plain(reason, {
  black: '黑名單', dead: '已標記為不可用', 'catalog-disabled': '已在設定中停用',
  'default-unavailable': '預設不使用', 'circuit-open': '近期故障，暫時避開',
})

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
  readonly transport: { snapshot(): Readonly<Record<string, unknown>> }
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
    const affinity = state.affinity ? `${state.affinity.host}（${routeLabel(state.affinity.type)}）` : '尚未確認'
    const summary = document.createElement('p'); summary.className = 'summary'
    const mode = this.deps.routes.isOriginalComparison() ? '本分頁只用 B 站提供的網址（對照測試）'
      : settings.fixedHost ? `固定使用 ${settings.fixedHost}` : '自動挑選 CDN'
    const recovery = this.deps.recovery.snapshot(), measurement = this.deps.measurement.snapshot()
    summary.textContent = `腳本：${settings.disabled ? '已停用' : '已啟用'}｜CDN：${mode}\n選定路線：${affinity}（實際請求見下方）\n播放：${playbackLabel(monitor.watchdog)}｜已緩衝約 ${monitor.video.playableBufferSec.toFixed(1)} 秒可播放內容｜${monitor.video.effectiveRate} 倍速\n播放器：${recoveryLabel(recovery.state)}｜測速：${measurementLabel(measurement.state, measurement.reason)}`
    if (recovery.state === 'failed' || recovery.state === 'recovered-paused') summary.textContent += `｜${recoveryReasonLabel(recovery.reason)}`
    if (measurement.startup) summary.textContent += `\n起播前測試：${startupLabel(measurement.startup.state, measurement.startup.reason)}`
    const hook = this.deps.transport.snapshot()
    summary.textContent += `\n請求攔截：${plain(hook.hookState, { installed: '運作中', degraded: '部分失效', failed: '無法啟用', 'not-installed': '未啟用' })}｜腳本看到 ${Number(hook.enteredFetch) + Number(hook.enteredXhr)} 筆請求，其中 ${hook.mediaRecognized} 筆像是影音請求；交給瀏覽器 ${hook.nativeCalled} 筆，看到回應 ${hook.responseObserved} 筆`
    const lastHook = hook.lastMediaRequest as Record<string, unknown> | null
    if (lastHook) summary.textContent += `\n最近一筆影音請求：${plain(lastHook.kind, { video: '影片', audio: '音訊', unknown: '尚未分類' })}，送往 ${lastHook.targetHost ?? '未知'}｜${lastHook.nativeCalled ? '已交給瀏覽器' : '未交給瀏覽器'}｜${lastHook.responseObserved ? `收到回應${lastHook.status ? `（HTTP ${lastHook.status}）` : ''}` : '尚未看到回應'}`
    const lastBlocked = hook.lastBlocked as Record<string, unknown> | null
    if (lastBlocked) summary.textContent += `\n最近擋下的請求：${lastBlocked.host}｜原因：${restrictionLabel(lastBlocked.reason)}｜沒有送給瀏覽器`
    const routes = this.deps.routes.snapshot(), latest = routes.latest as Record<string, Record<string, unknown>>
    for (const [kind, label] of [['video', '影片'], ['audio', '音訊'], ['unknown', '尚未分類媒體']] as const) {
      const row = latest[kind]
      if (!row) { if (kind !== 'unknown') summary.textContent += `\n${label}：還沒有可確認的請求`; continue }
      const age = Math.max(0, Math.floor((this.deps.now() - Number(row.observedAt)) / 1000))
      summary.textContent += `\n${label}：送往 ${row.targetHost ?? '未知'} → ${row.responseHost ? `回應來自 ${row.responseHost}` : '尚未取得回應來源'}｜${age} 秒前｜${plain(row.outcome, { success: '成功', failure: '失敗', abort: '已取消' })}${row.status ? `（HTTP ${row.status}）` : ''}\n  腳本在送出前換 CDN：${row.hostChanged === true ? '有' : row.hostChanged === false ? '沒有' : '尚未確認'}｜提供播放器時換 CDN：${row.playurlHostChanged === true ? '有' : row.playurlHostChanged === false ? '沒有' : '尚未確認'}｜這筆請求：${attributionLabel(row.attributionStatus)}`
      const output = row.playurlOutput as Record<string, unknown> | null
      if (output) summary.textContent += `\n  播放器取得的${output.role === 'backup' ? '備用' : '主要'}網址：${output.originalHost} → ${output.outputHost}`
    }
    const rep = routes.representation as { height: number; codec: string } | null
    summary.textContent += `\n目前畫質：${rep ? `${rep.height}p / ${rep.codec}` : attributionLabel(routes.attribution)}`
    const fallback = routes.fallback as Record<string, Record<string, unknown>>
    for (const [kind, label] of [['video', '影片'], ['audio', '音訊']] as const) {
      const row = fallback[kind]
      const stage = plain(row?.stage, { planned: '已選好，但還沒看到新請求', 'entered-hook': '腳本看到新請求，尚未確認有回應',
        'response-observed': '已看到備用路線的回應', 'request-failed': '備用路線請求失敗' })
      if (row) summary.textContent += `\n${label}備用路線：${row.plannedHost}｜${stage}`
        + (row.responseHost ? `｜回應來自 ${row.responseHost}${row.status ? `（HTTP ${row.status}）` : ''}` : '')
    }
    summary.textContent += '\n※ 上述請求與回應由腳本觀察；要確認瀏覽器實際送出的網址，仍須查看 Chrome「網路」面板。'
    body.append(summary)
    const actions = document.createElement('div'); actions.className = 'grid'
    const measurementButton = this.#button('安排測速（不會立即換 CDN）', () => { this.deps.measurement.requestManual(); this.#renderOverview() })
    const blacklistButton = this.#button('封鎖最近成功回應的影片 CDN 24 小時（影片＋音訊）', async () => {
      const host = this.deps.routes.latestVideoHost()
      if (host) await this.deps.restrictions.add({ host, type: 'black', kind: 'all', reason: 'user', expireAt: this.deps.now() + 24 * 60 * 60 * 1000 })
      this.deps.routes.invalidateForUserSetting(); this.#renderOverview()
    }, 'danger')
    actions.append(
      this.#button(settings.disabled ? '啟用腳本' : '停用腳本', async () => { await this.deps.settings.update({ disabled: !settings.disabled }); this.#renderOverview() }, 'primary'),
      this.#button('CDN 與播放設定', () => this.#renderSettings()),
      this.#button('查看診斷報告', () => this.#renderDiagnostics()),
      measurementButton,
      blacklistButton,
      this.#button('清除測速紀錄、黑名單與故障標記', async () => { await this.deps.evidence.clear(); await this.deps.restrictions.clear(); this.deps.storageDelete('bilicdn.v2.meta'); this.#renderOverview() }, 'danger'),
      this.#button('還原預設設定（不清除測速紀錄）', async () => { await this.deps.settings.reset(); this.deps.routes.invalidateForUserSetting(); this.#renderOverview() }, 'danger'),
    )
    if (!this.deps.routes.latestVideoHost()) {
      blacklistButton.disabled = true
      blacklistButton.textContent = '最近 60 秒沒有成功的影片請求，暫時無法指定要封鎖的 CDN'
    }
    if (this.deps.routes.isOriginalComparison()) {
      measurementButton.disabled = true
      measurementButton.textContent = '對照測試期間不測速'
    }
    body.append(actions)
    foot.append(this.#button('關閉', () => this.close()))
  }

  #renderSettings(): void {
    const { body, foot } = this.#shell('CDN 與播放設定')
    const settings = this.deps.settings.get(), rows = document.createElement('div'); rows.className = 'grid'
    const mode = document.createElement('select')
    mode.append(new Option('由腳本自動挑選 CDN', ''), ...TRUSTED_CATALOG.map(host => new Option(`固定使用：${host}`, host)))
    mode.value = settings.fixedHost ?? ''
    mode.addEventListener('change', event => { if (!event.isTrusted) return; void this.deps.settings.update({ fixedHost: mode.value || null })
      .then(() => { this.deps.routes.invalidateForUserSetting(); this.#renderSettings() }) })
    rows.append(this.#row('要如何選 CDN', mode, '自動模式會參考可用性與測速結果；固定模式優先使用你指定的節點，但仍會避開已禁止使用的節點。'))
    rows.append(this.#toggle('測試：只用 B 站原本提供的 CDN', this.deps.routes.isOriginalComparison(), enabled => {
      this.deps.routes.setOriginalComparison(enabled)
      this.deps.measurement.reset()
      this.deps.recovery.reset()
      this.#renderSettings()
    }, '只影響這個分頁。新影片只用 B 站提供的原始或備用網址；被禁止的 CDN 仍不會使用。測試期間不測速，也不自動換 CDN。請先開新測試分頁、啟用後再點進影片；已經交給播放器的網址不會倒回重選。重新整理頁面即可退出。'))
    const codec = document.createElement('select')
    for (const value of ['av1','hevc','avc','auto'] as CodecPreference[]) codec.append(new Option(({ av1: 'AV1', hevc: 'H.265／HEVC', avc: 'H.264／AVC', auto: '由 B 站決定' })[value], value))
    codec.value = settings.codec
    codec.addEventListener('change', event => { if (event.isTrusted) void this.deps.settings.update({ codec: codec.value as CodecPreference }) })
    rows.append(this.#row('偏好的影片格式', codec, '下次取得新的影片播放網址時生效；這不會強制改變你現在的播放倍速。'))
    rows.append(this.#toggle('阻止網頁使用 WebRTC', settings.blockWebRtc, value => this.deps.settings.update({ blockWebRtc: value }),
      '避免網頁建立點對點連線；不熟悉這項功能時，可維持預設值。'))
    rows.append(this.#toggle('阻止網頁使用 HTTPDNS', settings.blockHttpDns, value => this.deps.settings.update({ blockHttpDns: value }),
      '避免網頁透過 HTTPDNS 另行尋找 CDN；不熟悉這項功能時，可維持預設值。'))
    rows.append(this.#toggle('記錄更多診斷細節', settings.verbose, value => this.deps.settings.update({ verbose: value }),
      '開啟後會多記錄選路與測速資訊；關閉時仍會保留重要故障。記錄只存在目前分頁，重新整理後清空。'))
    for (const host of TRUSTED_CATALOG) {
      const defaultEnabled = !DEFAULT_UNAVAILABLE_HOSTS.has(host)
      const enabled = settings.catalogOverrides[host] ?? defaultEnabled
      const penalties = this.deps.restrictions.list().filter(row => row.host === host)
        .map(row => `${restrictionLabel(row.type)}（${row.kind === 'all' ? '影片＋音訊' : row.kind === 'video' ? '影片' : '音訊'}）`)
      const detail = `${defaultEnabled ? '預設可用的內建 CDN' : '預設標為不可用；勾選後才允許'}${penalties.length ? `｜目前仍被禁止：${penalties.join('、')}；勾選不會解除禁止` : ''}`
      rows.append(this.#toggle(host, enabled, async value => {
        await this.deps.settings.update({ catalogOverrides: { ...this.deps.settings.get().catalogOverrides, [host]: value } })
        this.deps.routes.invalidateForUserSetting()
      }, detail))
    }
    body.append(rows); foot.append(this.#button('返回', () => this.#renderOverview()))
  }

  #renderDiagnostics(): void {
    const { body, foot } = this.#shell('診斷報告')
    const help = document.createElement('p'); help.className = 'detail'
    help.textContent = '遇到卡頓時，按「記下剛剛的卡頓」，再複製報告提供排查。下方是給排查用的詳細資料；只看播放狀態可返回首頁。清除事故只刪除本分頁的事故記錄，不會變更 CDN 設定。'
    body.append(help)
    const report = document.createElement('textarea'); report.className = 'report'; report.readOnly = true
    report.value = this.deps.diagnostics.buildReport(this.#readModel())
    body.append(report)
    foot.append(
      this.#button('記下剛剛的卡頓', () => { this.deps.diagnostics.mark(); this.#renderDiagnostics() }),
      this.#button('清除本分頁事故記錄', () => { this.deps.diagnostics.clear(); this.#renderDiagnostics() }),
      this.#button('複製報告', () => { try { GM_setClipboard(report.value) } catch { void navigator.clipboard?.writeText(report.value) } }),
      this.#button('返回', () => this.#renderOverview()),
    )
  }

  #readModel(): Readonly<Record<string, unknown>> {
    const now = this.deps.now(), evidence = this.deps.evidence.list().slice(0, 96).map(row => ({ host: row.host, kind: row.kind, ...evidenceMetrics(row, now) }))
    return Object.freeze({ version: GM_info?.script?.version ?? '2.1.1', settings: this.deps.settings.get(), session: this.deps.session.get(),
      monitor: this.deps.monitor.snapshot(), recovery: this.deps.recovery.snapshot(), measurement: this.deps.measurement.snapshot(),
      interception: this.deps.transport.snapshot(),
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
