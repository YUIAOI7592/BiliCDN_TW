import {
  type ControlCenterSnapshot,
  type ControlViewFrame,
  type ControlViewActions,
  type ControlViewBinding,
} from './control-contracts.ts'
import { createButton } from './elements.ts'
import { describeStatus } from './status-summary.ts'
import { monitorPlaybackLabel, measurementLabel, startupLabel, plain } from './labels.ts'
import { overviewPresentation } from './overview-presentation.ts'
function text(tag: string, className: string, value = ''): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  node.textContent = value
  return node
}
function metric(label: string, unit: string) {
  const node = text('section', 'metric')
  const value = text('strong', 'value', '—'),
    hint = text('p', 'detail')
  const number = text('div', 'number')
  number.append(value, text('span', 'unit', unit))
  node.append(text('p', 'detail', label), number, hint)
  return { node, value, hint }
}
export function renderOverview(
  frame: ControlViewFrame,
  actions: ControlViewActions,
  now: () => number,
  initialModel: ControlCenterSnapshot,
): ControlViewBinding {
  const status = text('h3', 'playback'),
    format = text('span', 'badge')
  const hero = text('div', 'hero')
  hero.append(status, format)
  const buffer = metric('可播放緩衝', '秒'),
    speed = metric('安全吞吐', 'Mbps'),
    margin = metric('需求餘裕', '倍')
  const metrics = text('div', 'metrics')
  metrics.append(buffer.node, speed.node, margin.node)
  const routes = text('section', 'panel routes')
  const transfers = (['video', 'audio'] as const).map((kind) => {
    const card = text('div', 'route'),
      host = text('p', 'route-host'),
      meta = text('p', 'detail')
    card.append(text('h3', '', kind === 'video' ? '影片回應' : '音訊回應'), host, meta)
    routes.append(card)
    return { kind, host, meta }
  })
  const selected = text('p', 'detail'),
    activity = text('section', 'panel activity')
  const startup = text('p', 'event'),
    measurement = text('p', 'event'),
    retry = text('p', 'event')
  activity.append(text('h3', '', '最近狀態'), startup, measurement, retry)
  const details = text('div', 'status-details'),
    summary = text('p', 'summary')
  let currentModel = initialModel
  let expanded = false
  const expand = createButton('查看詳細狀態', () => {
    if (!actions.ownsView()) return
    expanded = !expanded
    expand.textContent = expanded ? '收起詳細狀態' : '查看詳細狀態'
    details.replaceChildren(...(expanded ? [summary] : []))
    if (expanded) summary.textContent = describeStatus(currentModel, now())
  })
  frame.body.append(hero, metrics, routes, selected, activity, expand, details)
  const refresh = (model: ControlCenterSnapshot): void => {
    currentModel = model
    const video = model.monitor.video,
      plan = model.routes.activePlan
    const display = overviewPresentation(model, now())
    status.textContent = model.settings.disabled
      ? '腳本已停用'
      : monitorPlaybackLabel(model.monitor)
    format.textContent = display.format
    buffer.value.textContent =
      video.available && Number.isFinite(video.playableBufferSec)
        ? Math.max(0, video.playableBufferSec).toFixed(1)
        : '—'
    buffer.hint.textContent = video.available
      ? '已按 ' + video.effectiveRate + ' 倍速折算'
      : '尚未取得播放資料'
    speed.value.textContent = display.safeMbps !== null ? display.safeMbps.toFixed(2) : '—'
    speed.hint.textContent = display.speedHint
    margin.value.textContent = display.ratio !== null ? display.ratio.toFixed(2) : '—'
    margin.hint.textContent = display.marginHint
    for (const entry of transfers) {
      const transfer = display.transfers.find((row) => row.kind === entry.kind)!
      entry.host.textContent = transfer.host
      entry.meta.textContent = transfer.detail
    }
    selected.textContent =
      '選定路線：' +
      (model.session.affinity?.host ?? plan?.host ?? '尚未確認') +
      ' · ' +
      (model.settings.fixedHost ? '固定 CDN' : '自動 CDN')
    const start = model.measurement.startup
    startup.textContent =
      '起播：' +
      (start
        ? startupLabel(start.state, start.reason, start.result) +
          (start.elapsedMs != null && Number.isFinite(start.elapsedMs)
            ? ' · ' + Math.round(start.elapsedMs) + ' ms'
            : '')
        : '尚無起播量測')
    const range = model.measurement.range
    measurement.textContent =
      '健康探測：' +
      measurementLabel(model.measurement.state, model.measurement.reason) +
      (range
        ? ' · ' +
          (range.mode === 'middle' ? '中段' : '首段') +
          ' · ' +
          (range.sizeKnown ? '大小已驗證' : '大小未知')
        : '')
    retry.textContent =
      '提前重試：' +
      (!model.settings.earlyRetryEnabled
        ? '關閉'
        : model.earlyRetry
          ? plain(model.earlyRetry.state, {
              idle: '等待資格',
              waiting: '觀察中',
              armed: '已要求原生逾時',
              timedout: '已觀察原生逾時',
              claimed: '網站重試已配對',
              dispatched: '網站已重試',
              complete: '重試成功',
              cancelled: '已撤銷',
              suspended: '本分頁已停止',
            }) +
            ' · ' +
            model.earlyRetry.attempts +
            ' 次'
          : '尚未取得狀態')
    // The long summary is captured only on request, never rebuilt by the playback tick.
  }
  return { refresh }
}
