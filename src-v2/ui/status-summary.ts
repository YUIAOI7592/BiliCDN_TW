import { assessDemandRatio } from '../domain/routing.ts'
import type { ControlCenterSnapshot } from './control-contracts.ts'
import { overviewPresentation } from './overview-presentation.ts'
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

export function describeStatus(model: ControlCenterSnapshot, now: number): string {
  const state = model.session,
    settings = model.settings,
    monitor = model.monitor
  const affinity = state.affinity
    ? `${state.affinity.host}（${routeLabel(state.affinity.type)}）`
    : '尚未確認'
  let summary = ''
  const sourceMode = settings.considerNativeSources ? '可參考 B 站原生來源' : '僅內建 CDN'
  const mode = settings.disabled
    ? '腳本已停用，網站自行選擇 CDN'
    : settings.fixedHost
      ? `優先固定 ${settings.fixedHost}（${sourceMode}）`
      : `自動挑選 CDN（${sourceMode}）`
  const recovery = model.recovery,
    measurement = model.measurement
  summary = `腳本：${settings.disabled ? '已停用' : '已啟用'}｜CDN：${mode}\n選定路線：${affinity}（實際請求見下方）\n播放：${playbackLabel(monitor.watchdog)}｜已緩衝約 ${monitor.video.playableBufferSec.toFixed(1)} 秒可播放內容｜${monitor.video.effectiveRate} 倍速\n播放器：${recoveryLabel(recovery.state)}｜測速：${measurementLabel(measurement.state, measurement.reason)}`
  if (recovery.state === 'failed' || recovery.state === 'recovered-paused')
    summary += `｜${recoveryReasonLabel(recovery.reason)}`
  if (measurement.startup) {
    const startup = measurement.startup
    summary += `\n起播前測試：${startup.state === 'complete' && startup.reason === 'qualified-early' ? '已測試並選好起播路線' : startupLabel(startup.state, startup.reason, startup.result)}`
    if (startup.elapsedMs != null && Number.isFinite(startup.elapsedMs))
      summary += `｜等待 ${Math.max(0, Math.round(startup.elapsedMs))} ms`
    if (startup.state === 'complete')
      summary += `｜結束：${plain(startup.reason, { measured: '已取得有效量測', 'qualified-early': '已找到足夠快的候選，提早放行', inconclusive: '證據不足' })}`
  }
  if (measurement.range)
    summary += `\n健康探測：${measurement.range.mode === 'middle' ? '中段' : '首段'}｜${measurement.range.sizeKnown ? '大小已驗證' : '大小未知'}（不代表未快取）`
  if (monitor.stall)
    summary += `
停滯段：${monitor.stall.id}｜${plain(monitor.stall.phase, { stalled: '等待進度', confirming: '確認短暫前進', settling: '確認持續健康' })}｜備援${monitor.stall.fallbackAvailable ? '尚可提交' : '已提交'}｜重載期限剩餘 ${Math.max(0, Math.ceil((monitor.stall.reloadAt - now) / 1000))} 秒`
  if (recovery.remainingReloads !== undefined)
    summary += `
重載剩餘額度：${recovery.remainingReloads}｜${plain(recovery.nextAction, { 'await-play': '等待播放命令結果', 'verify-restore': '核對還原結果', 'await-core': '等待核心就緒', 'await-reload-deadline': '等待升級期限', none: '沒有待處理動作' })}`
  if (recovery.deadlineAt !== undefined)
    summary += `｜本階段剩餘 ${Math.max(0, Math.ceil((recovery.deadlineAt - now) / 1000))} 秒`
  if (model.routes.selection?.phase === 'pending')
    summary += `
表示選擇：待確認（${model.routes.selection.sampleCount}／2 筆成功影片傳輸），等待目前選擇的下一筆成功`
  const hook = model.interception
  const retry = model.earlyRetry
  if (retry)
    summary += `\n慢請求提前重試：${settings.earlyRetryEnabled ? '開啟' : '關閉'}｜${plain(retry.state, { idle: '尚未開始', waiting: '觀察中', armed: '已要求原生逾時', timedout: '已觀察原生逾時', claimed: '網站重試已配對', dispatched: '網站已重試', complete: '重試成功', cancelled: '已撤銷', suspended: '本分頁已停止提前重試' })}｜本分頁已嘗試 ${retry.attempts} 次`
  if (hook.lastApiEndpoint)
    summary += `\n播放入口：${plain(hook.lastApiEndpoint.kind, { playurl: '一般播放資料', 'ogv-playview': 'OGV 正片', 'ogv-precheck': 'OGV 片頭檢查（原文傳遞）' })}`
  summary += `\n請求攔截：${plain(hook.hookState, { installed: '運作中', degraded: '部分失效', failed: '無法啟用', 'not-installed': '未啟用' })}｜腳本看到 ${Number(hook.enteredFetch) + Number(hook.enteredXhr)} 筆請求，其中 ${hook.mediaRecognized} 筆像是影音請求；交給瀏覽器 ${hook.nativeCalled} 筆，看到回應 ${hook.responseObserved} 筆`
  if (!settings.disabled && !settings.considerNativeSources && hook.hookState !== 'installed') {
    summary += '\n請求攔截未完整，無法確認影音只依內建 CDN 選路；請以 Chrome「網路」面板核對。'
  }
  const lastHook = hook.lastMediaRequest
  if (lastHook)
    summary += `\n最近一筆影音請求：${plain(lastHook.kind, { video: '影片', audio: '音訊', unknown: '尚未分類' })}，送往 ${lastHook.targetHost ?? '未知'}｜${lastHook.nativeCalled ? '已交給瀏覽器' : '未交給瀏覽器'}｜${lastHook.responseObserved ? `收到回應${lastHook.status ? `（HTTP ${lastHook.status}）` : ''}` : '尚未看到回應'}`
  const lastBlocked = hook.lastBlocked
  if (lastBlocked)
    summary += `\n最近擋下的請求：${lastBlocked.host}｜原因：${restrictionLabel(lastBlocked.reason)}｜沒有送給瀏覽器`
  const playurl = hook.lastPlayurl
  if (playurl) {
    const formats =
      playurl.formats
        .map((format) => plain(format, { dash: 'DASH', mp4: 'MP4', flv: 'FLV' }))
        .join('／') || '未辨識'
    summary += `\n最近播放資料：${playurl.transport === 'fetch' ? 'Fetch' : 'XHR'}｜${playurl.accepted ? '已接納' : '未接納'}｜格式：${formats}｜影片 ${playurl.videoCount}、音訊 ${playurl.audioCount}、分段 ${playurl.segmentCount}`
    if (playurl.status) summary += `｜上游 HTTP ${playurl.status}`
    if (playurl.upstreamCode !== null) summary += `｜上游代碼 ${playurl.upstreamCode}`
    if (playurl.reason)
      summary += `｜原因：${plain(playurl.reason, {
        'upstream-error': 'B 站回報錯誤',
        'unsupported-format': '不支援的資料格式',
        'malformed-payload': '播放資料無法解析',
        'unreplaceable-source': '來源網址無法安全改寫',
        'no-legal-route': '沒有合法路線',
        inactive: '處理時已停用或影片已切換',
      })}`
  }
  const routes = model.routes,
    latest = routes.latest
  const display = overviewPresentation(model, now)
  const activePlan = routes.activePlan
  if (activePlan?.host)
    summary += `\n目前路線容量：${display.historical ? '歷史估計，待驗證 · ' : ''}${plain(
      assessDemandRatio(display.ratio),
      {
        'below-required': '低於本次需求',
        'meets-headroom': '達到安全餘量',
        unknown: display.safeMbps !== null ? display.marginHint : '速度樣本不足',
      },
    )}${display.ratio === null ? '' : `（保守速度約為需求的 ${display.ratio.toFixed(2)} 倍）`}`
  const { safeMbps, ratio, requiredMbps } = display
  summary +=
    safeMbps !== null
      ? `\n保守吞吐 ${safeMbps.toFixed(2)} Mbps` +
        (ratio !== null && requiredMbps !== null
          ? `｜需求 ${requiredMbps.toFixed(2)} Mbps｜餘裕 ${ratio.toFixed(2)} 倍`
          : `｜${display.marginHint}`) +
        `｜${display.speedHint}`
      : `\n安全吞吐：${display.speedHint}`
  if (display.estimatedCompletionMs !== null)
    summary += '\n目前請求完成預估：約 ' + (display.estimatedCompletionMs / 1000).toFixed(2) + ' 秒'
  const restricted = activePlan?.ranking.filter((row) => !row.eligible).slice(0, 5) ?? []
  if (restricted.length)
    summary += `\n候選限制：${restricted.map((row) => `${row.host}（${row.reasons.map(restrictionLabel).join('、')}）`).join('；')}`
  for (const [kind, label] of [
    ['video', '影片'],
    ['audio', '音訊'],
    ['unknown', '尚未分類媒體'],
  ] as const) {
    const transfer = display.transfers.find((entry) => entry.kind === kind)
    const row = kind === 'unknown' ? latest[kind] : transfer?.observed
    if (!row) {
      if (kind !== 'unknown') summary += `\n${label}：${transfer!.detail}`
      continue
    }
    const age = Math.max(0, Math.floor((now - Number(row.observedAt)) / 1000))
    summary += `\n${label}：送往 ${row.targetHost ?? '未知'} → ${row.responseHost ? `回應來自 ${row.responseHost}` : '尚未取得回應來源'}｜${age} 秒前｜${plain(row.outcome, { success: '成功', failure: '失敗', abort: '已取消' })}${row.status ? `（HTTP ${row.status}）` : ''}\n  腳本在送出前換 CDN：${row.hostChanged === true ? '有' : row.hostChanged === false ? '沒有' : '尚未確認'}｜提供播放器時換 CDN：${row.playurlHostChanged === true ? '有' : row.playurlHostChanged === false ? '沒有' : '尚未確認'}｜這筆請求：${attributionLabel(row.attributionStatus)}`
    const output = row.playurlOutput
    if (output)
      summary += `\n  播放器取得的${output.role === 'backup' ? '備用' : '主要'}網址：${output.originalHost} → ${output.outputHost}`
  }
  summary += `\n目前畫質：${display.format}`
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
      summary +=
        `\n${label}備用路線：${row.plannedHost}｜${stage}` +
        (row.responseHost
          ? `｜回應來自 ${row.responseHost}${row.status ? `（HTTP ${row.status}）` : ''}`
          : '')
  }
  summary +=
    '\n※ 上述請求與回應由腳本觀察；要確認瀏覽器實際送出的網址，仍須查看 Chrome「網路」面板。'
  return summary
}
