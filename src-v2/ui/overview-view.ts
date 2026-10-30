import type { ControlCenterSnapshot } from './control-center-ports.ts'
import type { ControlViewFrame, ControlViewActions, ControlViewBinding } from './view-ports.ts'
import { createButton } from './elements.ts'
import { describeStatus } from './status-summary.ts'
import { playbackLabel, measurementLabel, startupLabel, plain, attributionLabel } from './labels.ts'

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
  let expanded = false
  const expand = createButton('查看詳細狀態', () => {
    if (!actions.ownsView()) return
    expanded = !expanded
    expand.textContent = expanded ? '收起詳細狀態' : '查看詳細狀態'
    details.replaceChildren(...(expanded ? [summary] : []))
    if (expanded) summary.textContent = describeStatus(actions.model(), now())
  })
  frame.body.append(hero, metrics, routes, selected, activity, expand, details)
  const refresh = (model: ControlCenterSnapshot): void => {
    const video = model.monitor.video,
      plan = model.routes.activePlan
    const row = plan?.ranking.find(
      (entry) => entry.host === plan.host && entry.type === plan.routeType,
    )
    const safe = row?.safeMbps,
      ratio = row?.ratio
    const valid =
      safe != null &&
      Number.isFinite(safe) &&
      safe > 0 &&
      ratio != null &&
      Number.isFinite(ratio) &&
      ratio > 0 &&
      Number.isFinite(safe / ratio)
    status.textContent = model.settings.disabled
      ? '腳本已停用'
      : playbackLabel(model.monitor.watchdog)
    const rep = model.routes.representation
    format.textContent = rep
      ? rep.height + 'p / ' + rep.codec
      : attributionLabel(model.routes.attribution)
    buffer.value.textContent =
      video.available && Number.isFinite(video.playableBufferSec)
        ? Math.max(0, video.playableBufferSec).toFixed(1)
        : '—'
    buffer.hint.textContent = video.available
      ? '已按 ' + video.effectiveRate + ' 倍速折算'
      : '尚未取得播放資料'
    speed.value.textContent = valid ? safe.toFixed(2) : '—'
    speed.hint.textContent = valid ? '最近選路的保守估計' : '缺少有效速度證據'
    margin.value.textContent = valid ? ratio.toFixed(2) : '—'
    margin.hint.textContent = valid
      ? '需求 ' +
        (safe / ratio).toFixed(2) +
        ' Mbps · ' +
        (ratio >= 1.35 ? '達到安全餘裕' : '未達安全餘裕')
      : '需求或證據不足'
    for (const entry of transfers) {
      const observed = model.routes.latest[entry.kind]
      const requested = model.routes.requested[entry.kind]
      entry.host.textContent = observed?.responseHost ?? '尚未確認回應主機'
      entry.meta.textContent = observed
        ? plain(observed.outcome, { success: '成功', failure: '失敗', abort: '已取消' }) +
          ' · HTTP ' +
          observed.status +
          ' · ' +
          Math.max(0, Math.floor((now() - observed.observedAt) / 1000)) +
          ' 秒前' +
          (now() - observed.observedAt > 60000 ? '（較早的回應）' : '')
        : requested
          ? '已送往 ' + requested.targetHost + '，等待回應'
          : '尚未觀察到請求'
    }
    selected.textContent =
      '選定路線：' +
      (model.session.affinity?.host ?? plan?.host ?? '尚未確認') +
      ' · ' +
      (model.routes.originalComparison
        ? '本分頁原線對照'
        : model.settings.fixedHost
          ? '固定 CDN'
          : '自動 CDN')
    const start = model.measurement.startup
    startup.textContent =
      '起播：' +
      (start
        ? startupLabel(start.state, start.reason) +
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
  refresh(actions.model())
  return { refresh }
}
