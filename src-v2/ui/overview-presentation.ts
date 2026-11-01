import { observedPlaybackDemand } from '../domain/playback-demand.ts'
import type { ControlCenterSnapshot } from './control-contracts.ts'
import { attributionLabel, plain } from './labels.ts'

const positive = (value: number | null | undefined): value is number =>
  value != null && Number.isFinite(value) && value > 0

function currentDemand(model: ControlCenterSnapshot): number | null {
  const video = model.monitor.video,
    rep = model.routes.representation
  if (
    !video.available ||
    !model.session.representation ||
    model.routes.attribution !== 'confirmed' ||
    rep?.kind !== 'video' ||
    !positive(rep.bandwidth) ||
    !positive(video.playbackRate)
  )
    return null
  return observedPlaybackDemand('video', rep.bandwidth, video.playbackRate)?.requiredMbps ?? null
}

/** Derive this refresh only; display fallbacks never change routing or retain history. */
export function overviewPresentation(model: ControlCenterSnapshot, now: number) {
  const video = model.monitor.video,
    routes = model.routes,
    plan = routes.activePlan
  const candidate = routes.currentCapacity
  const capacity =
    candidate &&
    !model.settings.disabled &&
    !model.session.disabled &&
    candidate.generation === model.session.generation &&
    candidate.epoch === model.session.epoch &&
    candidate.representation === model.session.representation &&
    candidate.decisionId === plan?.id &&
    candidate.host === plan.host &&
    candidate.routeType === plan.routeType
      ? candidate
      : null
  const safeMbps =
    capacity?.sampleStatus === 'available' && positive(capacity.safeMbps) ? capacity.safeMbps : null
  const requiredMbps = currentDemand(model)
  const margin = safeMbps !== null && requiredMbps !== null ? safeMbps / requiredMbps : null
  const ratio = positive(margin) ? margin : null
  const missing = model.settings.disabled
    ? '腳本已停用'
    : model.interception.hookState !== 'installed' ||
        !model.interception.fetchInstalled ||
        !model.interception.xhrInstalled
      ? '請求攔截未完整'
      : !capacity
        ? routes.attribution === 'awaiting-second-video-transfer'
          ? '等待第二筆影片資料'
          : routes.attribution === 'awaiting-matched-video'
            ? '等待可辨識影片資料'
            : '尚未建立目前路線'
        : capacity.sampleStatus === 'expired'
          ? '目前路線的速度樣本已過期'
          : '目前路線尚無有效速度樣本'
  const dimensions =
    video.available &&
    Number.isInteger(video.width) &&
    video.width > 0 &&
    Number.isInteger(video.height) &&
    video.height > 0
  const rep = routes.representation
  const format =
    rep && positive(rep.height) && (!dimensions || rep.height === video.height)
      ? rep.height + 'p / ' + rep.codec
      : dimensions
        ? video.width + '×' + video.height + '（播放器，編碼未確認）'
        : attributionLabel(routes.attribution)
  const transfers = (['video', 'audio'] as const).map((kind) => {
    const latest = routes.latest[kind],
      sent = routes.requested[kind]
    const observed =
      latest &&
      (latest.generation == null || latest.generation === model.session.generation) &&
      (latest.epoch == null || latest.epoch === model.session.epoch)
        ? latest
        : undefined
    const requested =
      sent && sent.generation === model.session.generation && sent.epoch === model.session.epoch
        ? sent
        : undefined
    const age = observed ? Math.max(0, Math.floor((now - observed.observedAt) / 1000)) : 0
    return {
      kind,
      observed,
      requested,
      host: observed?.responseHost ?? '尚未確認回應主機',
      detail: observed
        ? plain(observed.outcome, { success: '成功', failure: '失敗', abort: '已取消' }) +
          ' · HTTP ' +
          observed.status +
          ' · ' +
          age +
          ' 秒前' +
          (now - observed.observedAt > 60000 ? '（較早的回應）' : '')
        : requested
          ? '已送往 ' + requested.targetHost + '，等待回應'
          : '目前尚未觀察到請求',
    }
  })
  return {
    format,
    safeMbps,
    ratio,
    requiredMbps,
    transfers,
    speedHint: safeMbps !== null ? capacity!.host + ' · 有效影片樣本的保守估計' : missing,
    marginHint:
      ratio !== null && requiredMbps !== null
        ? '需求 ' +
          requiredMbps.toFixed(2) +
          ' Mbps · ' +
          (ratio >= 1.35 ? '達到安全餘裕' : '未達安全餘裕')
        : safeMbps !== null
          ? '尚無有效需求估計'
          : missing,
  }
}
