import { assessDemandRatio } from '../domain/routing.ts'
import type { ControlCenterDependencies } from './control-center-ports.ts'
import type { ControlViewFrame, ControlViewActions } from './view-ports.ts'
import { createButton } from './elements.ts'
import {
  plain,
  routeLabel,
  playbackLabel,
  recoveryLabel,
  recoveryReasonLabel,
  measurementLabel,
  startupLabel,
  attributionLabel,
  restrictionLabel,
} from './labels.ts'

export function renderOverview(
  deps: ControlCenterDependencies,
  frame: ControlViewFrame,
  actions: ControlViewActions,
): void {
  const { body, foot } = frame
  const state = deps.session.get(),
    settings = deps.settings.get(),
    monitor = deps.monitor.snapshot()
  const affinity = state.affinity
    ? `${state.affinity.host}（${routeLabel(state.affinity.type)}）`
    : '尚未確認'
  const summary = document.createElement('p')
  summary.className = 'summary'
  const stage = document.createElement('p')
  stage.className = 'detail'
  stage.textContent = '測試版／實機待驗證：UP141 功能已包含，正式採用與預設留待實機結果決定。'
  body.append(stage)
  const sourceMode = settings.considerNativeSources ? '可參考 B 站原生來源' : '僅內建 CDN'
  const mode = settings.disabled
    ? '腳本已停用，網站自行選擇 CDN'
    : deps.routes.isOriginalComparison()
      ? '本分頁只用 B 站提供的網址（對照測試）'
      : settings.fixedHost
        ? `優先固定 ${settings.fixedHost}（${sourceMode}）`
        : `自動挑選 CDN（${sourceMode}）`
  const recovery = deps.recovery.snapshot(),
    measurement = deps.measurement.snapshot()
  summary.textContent = `腳本：${settings.disabled ? '已停用' : '已啟用'}｜CDN：${mode}\n選定路線：${affinity}（實際請求見下方）\n播放：${playbackLabel(monitor.watchdog)}｜已緩衝約 ${monitor.video.playableBufferSec.toFixed(1)} 秒可播放內容｜${monitor.video.effectiveRate} 倍速\n播放器：${recoveryLabel(recovery.state)}｜測速：${measurementLabel(measurement.state, measurement.reason)}`
  if (recovery.state === 'failed' || recovery.state === 'recovered-paused')
    summary.textContent += `｜${recoveryReasonLabel(recovery.reason)}`
  if (measurement.startup) {
    const startup = measurement.startup
    summary.textContent += `\n起播前測試：${startup.state === 'complete' && startup.reason === 'qualified-early' ? '已測試並選好起播路線' : startupLabel(startup.state, startup.reason)}`
    if (startup.elapsedMs != null && Number.isFinite(startup.elapsedMs))
      summary.textContent += `｜等待 ${Math.max(0, Math.round(startup.elapsedMs))} ms`
    if (startup.state === 'complete')
      summary.textContent += `｜結束：${plain(startup.reason, { measured: '已取得有效量測', 'qualified-early': '已找到足夠快的候選，提早放行', inconclusive: '證據不足' })}`
  }
  if (measurement.range)
    summary.textContent += `\n健康探測：${measurement.range.mode === 'middle' ? '中段' : '首段'}｜${measurement.range.sizeKnown ? '大小已驗證' : '大小未知'}（不代表未快取）`
  if (measurement.validation)
    summary.textContent += `\n香港候選測試：${plain(measurement.validation.state, { queued: '等待資格或冷卻', running: '測試中', complete: '本輪結束', cancelled: '已撤銷' })}｜目標 ${measurement.validation.hosts.join('、')}｜已取得 ${measurement.validation.results.length} 筆結果（詳細結果見診斷）`
  const hook = deps.transport.snapshot()
  const retry = deps.earlyRetry?.snapshot()
  if (retry)
    summary.textContent += `\n慢請求提前重試：${settings.earlyRetryEnabled ? '實驗開啟' : '關閉'}｜${plain(retry.state, { idle: '尚未開始', waiting: '觀察中', armed: '已要求原生逾時', timedout: '已觀察原生逾時', claimed: '網站重試已配對', dispatched: '網站已重試', complete: '重試成功', cancelled: '已撤銷', suspended: '本分頁已停止提前重試' })}｜本分頁已嘗試 ${retry.attempts} 次`
  if (hook.lastApiEndpoint)
    summary.textContent += `\n播放入口：${plain(hook.lastApiEndpoint.kind, { playurl: '一般播放資料', 'ogv-playview': 'OGV 正片', 'ogv-precheck': 'OGV 片頭檢查（原文傳遞）' })}`
  summary.textContent += `\n請求攔截：${plain(hook.hookState, { installed: '運作中', degraded: '部分失效', failed: '無法啟用', 'not-installed': '未啟用' })}｜腳本看到 ${Number(hook.enteredFetch) + Number(hook.enteredXhr)} 筆請求，其中 ${hook.mediaRecognized} 筆像是影音請求；交給瀏覽器 ${hook.nativeCalled} 筆，看到回應 ${hook.responseObserved} 筆`
  if (
    !settings.disabled &&
    !settings.considerNativeSources &&
    !deps.routes.isOriginalComparison() &&
    hook.hookState !== 'installed'
  ) {
    summary.textContent +=
      '\n請求攔截未完整，無法確認影音只依內建 CDN 選路；請以 Chrome「網路」面板核對。'
  }
  const lastHook = hook.lastMediaRequest
  if (lastHook)
    summary.textContent += `\n最近一筆影音請求：${plain(lastHook.kind, { video: '影片', audio: '音訊', unknown: '尚未分類' })}，送往 ${lastHook.targetHost ?? '未知'}｜${lastHook.nativeCalled ? '已交給瀏覽器' : '未交給瀏覽器'}｜${lastHook.responseObserved ? `收到回應${lastHook.status ? `（HTTP ${lastHook.status}）` : ''}` : '尚未看到回應'}`
  const lastBlocked = hook.lastBlocked
  if (lastBlocked)
    summary.textContent += `\n最近擋下的請求：${lastBlocked.host}｜原因：${restrictionLabel(lastBlocked.reason)}｜沒有送給瀏覽器`
  const playurl = hook.lastPlayurl
  if (playurl) {
    const formats =
      playurl.formats
        .map((format) => plain(format, { dash: 'DASH', mp4: 'MP4', flv: 'FLV' }))
        .join('／') || '未辨識'
    summary.textContent += `\n最近播放資料：${playurl.transport === 'fetch' ? 'Fetch' : 'XHR'}｜${playurl.accepted ? '已接納' : '未接納'}｜格式：${formats}｜影片 ${playurl.videoCount}、音訊 ${playurl.audioCount}、分段 ${playurl.segmentCount}`
    if (playurl.status) summary.textContent += `｜上游 HTTP ${playurl.status}`
    if (playurl.upstreamCode !== null) summary.textContent += `｜上游代碼 ${playurl.upstreamCode}`
    if (playurl.reason)
      summary.textContent += `｜原因：${plain(playurl.reason, {
        'upstream-error': 'B 站回報錯誤',
        'unsupported-format': '不支援的資料格式',
        'malformed-payload': '播放資料無法解析',
        'unreplaceable-source': '來源網址無法安全改寫',
        'no-legal-route': '沒有合法路線',
        inactive: '處理時已停用或影片已切換',
      })}`
  }
  const routes = deps.routes.snapshot(),
    latest = routes.latest
  const routeRecovery = deps.diagnostics.snapshot().routeRecovery
  const lastAttempt = routeRecovery.attempts.at(-1)
  if (lastAttempt)
    summary.textContent += `\n影片備援接手：${lastAttempt.host ?? '未知 Host'}｜${plain(
      lastAttempt.stage,
      {
        planned: '已選定，尚未看到請求',
        sent: '已送出請求',
        'progress-unconfirmed': '播放器有進度，路線仍待確認',
        'response-observed': '已收到影片資料，播放接手待確認',
        'playback-observed': '播放進度與新路線接手一致',
        'mixed-evidence': '同時收到其他 Host 資料，無法歸因',
        unconfirmed: '30 秒內未取得足夠證據',
        superseded: '已由下一條備援取代',
        interrupted: '觀察因模式或影片切換中止',
      },
    )}`
  const activePlan = routes.activePlan
  const selected = activePlan?.ranking?.find(
    (row) => row.host === activePlan.host && row.type === activePlan.routeType,
  )
  if (activePlan?.host)
    summary.textContent += `\n目前路線容量：${plain(assessDemandRatio(selected?.ratio ?? null), {
      'below-required': '低於本次需求',
      'below-headroom': '未達安全餘量',
      'meets-headroom': '達到安全餘量',
      unknown: '速度樣本不足',
    })}${selected?.ratio == null || !Number.isFinite(selected.ratio) ? '' : `（保守速度約為需求的 ${selected.ratio.toFixed(2)} 倍）`}`
  const safeMbps = selected?.safeMbps,
    ratio = selected?.ratio,
    requiredMbps = safeMbps != null && ratio != null && ratio > 0 ? safeMbps / ratio : null
  if (
    safeMbps != null &&
    Number.isFinite(safeMbps) &&
    safeMbps > 0 &&
    ratio != null &&
    Number.isFinite(ratio) &&
    ratio > 0 &&
    requiredMbps != null &&
    Number.isFinite(requiredMbps) &&
    requiredMbps > 0
  )
    summary.textContent += `\n保守吞吐 ${safeMbps.toFixed(2)} Mbps｜需求 ${requiredMbps.toFixed(2)} Mbps｜餘裕 ${ratio.toFixed(2)} 倍`
  const restricted = activePlan?.ranking.filter((row) => !row.eligible).slice(0, 5) ?? []
  if (restricted.length)
    summary.textContent += `\n候選限制：${restricted.map((row) => `${row.host}（${row.reasons.map(restrictionLabel).join('、')}）`).join('；')}`
  for (const [kind, label] of [
    ['video', '影片'],
    ['audio', '音訊'],
    ['unknown', '尚未分類媒體'],
  ] as const) {
    const row = latest[kind]
    if (!row) {
      if (kind !== 'unknown') summary.textContent += `\n${label}：還沒有可確認的請求`
      continue
    }
    const age = Math.max(0, Math.floor((deps.now() - Number(row.observedAt)) / 1000))
    summary.textContent += `\n${label}：送往 ${row.targetHost ?? '未知'} → ${row.responseHost ? `回應來自 ${row.responseHost}` : '尚未取得回應來源'}｜${age} 秒前｜${plain(row.outcome, { success: '成功', failure: '失敗', abort: '已取消' })}${row.status ? `（HTTP ${row.status}）` : ''}\n  腳本在送出前換 CDN：${row.hostChanged === true ? '有' : row.hostChanged === false ? '沒有' : '尚未確認'}｜提供播放器時換 CDN：${row.playurlHostChanged === true ? '有' : row.playurlHostChanged === false ? '沒有' : '尚未確認'}｜這筆請求：${attributionLabel(row.attributionStatus)}`
    const output = row.playurlOutput
    if (output)
      summary.textContent += `\n  播放器取得的${output.role === 'backup' ? '備用' : '主要'}網址：${output.originalHost} → ${output.outputHost}`
  }
  const rep = routes.representation
  summary.textContent += `\n目前畫質：${rep ? `${rep.height}p / ${rep.codec}` : attributionLabel(routes.attribution)}`
  const fallback = routes.fallback
  for (const [kind, label] of [
    ['video', '影片'],
    ['audio', '音訊'],
  ] as const) {
    const row = fallback[kind]
    const stage = plain(row?.stage, {
      planned: '已選好，但還沒看到新請求',
      'entered-hook': '腳本看到新請求，尚未確認有回應',
      'response-observed': '已看到備用路線的回應',
      'request-failed': '備用路線請求失敗',
    })
    if (row)
      summary.textContent +=
        `\n${label}備用路線：${row.plannedHost}｜${stage}` +
        (row.responseHost
          ? `｜回應來自 ${row.responseHost}${row.status ? `（HTTP ${row.status}）` : ''}`
          : '')
  }
  summary.textContent +=
    '\n※ 上述請求與回應由腳本觀察；要確認瀏覽器實際送出的網址，仍須查看 Chrome「網路」面板。'
  body.append(summary)
  const actionGrid = document.createElement('div')
  actionGrid.className = 'grid'
  const measurementButton = createButton('安排測速（不會立即換 CDN）', () => {
    deps.commands.requestMeasurement()
    actions.overview()
  })
  const blacklistButton = createButton(
    '封鎖最近成功回應的影片 CDN 24 小時（影片＋音訊）',
    () => actions.refreshAfter(deps.commands.blacklistLatestVideo(), () => actions.overview()),
    'danger',
  )
  actionGrid.append(
    createButton(
      settings.disabled ? '啟用腳本' : '停用腳本',
      () =>
        actions.refreshAfter(deps.commands.updateSettings({ disabled: !settings.disabled }), () =>
          actions.overview(),
        ),
      'primary',
    ),
    createButton('CDN 與播放設定', () => actions.settings()),
    createButton('查看診斷報告', () => actions.diagnostics()),
    measurementButton,
    blacklistButton,
    createButton(
      '清除測速紀錄、黑名單與故障標記',
      () => actions.refreshAfter(deps.commands.clearLearning(), () => actions.overview()),
      'danger',
    ),
    createButton(
      '還原預設設定（不清除測速紀錄）',
      () => actions.refreshAfter(deps.commands.resetSettings(), () => actions.overview()),
      'danger',
    ),
  )
  if (!deps.routes.latestVideoHost()) {
    blacklistButton.disabled = true
    blacklistButton.textContent = '最近 60 秒沒有成功的影片請求，暫時無法指定要封鎖的 CDN'
  }
  if (deps.routes.isOriginalComparison()) {
    measurementButton.disabled = true
    measurementButton.textContent = '對照測試期間不測速'
  }
  body.append(actionGrid)
  foot.append(createButton('關閉', () => actions.close()))
}
