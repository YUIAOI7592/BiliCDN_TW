export const plain = (
  value: unknown,
  labels: Readonly<Record<string, string>>,
  fallback = '尚未確認',
): string => {
  const key = String(value)
  return Object.hasOwn(labels, key) ? (labels[key] ?? fallback) : fallback
}

export const routeLabel = (type: unknown): string =>
  plain(type, {
    'catalog-generated': '腳本挑選的 CDN',
    'native-signed': 'B 站提供的 CDN',
    'root-original': 'B 站原本的 CDN',
  })

export const playbackLabel = (state: unknown): string =>
  plain(state, {
    'no-video': '還沒找到影片',
    paused: '已暫停',
    'seek-grace': '剛跳轉，等待載入',
    'buffered-to-end': '已緩衝到片尾',
    healthy: '播放正常',
    'low-buffer': '緩衝不足',
    recovering: '正在嘗試恢復',
  })

export const recoveryLabel = (state: unknown): string =>
  plain(state, {
    healthy: '正常',
    'pause-armed': '已暫停，等待播放',
    'play-intent': '正在嘗試繼續播放',
    waiting: '等待影片恢復',
    reloading: '正在重建播放器',
    recovered: '核心觀察到播放進度',
    'recovered-paused': '核心已恢復，等待手動播放',
    failed: '自動恢復失敗',
    breaker: '暫停自動恢復，避免反覆重試',
  })

export const recoveryReasonLabel = (reason: unknown): string =>
  plain(
    reason,
    {
      'reload-unavailable': '播放器不支援自動重建',
      'reload-threw': '播放器重建時出錯',
      'reload-rejected': '播放器拒絕重建',
      'reload-timeout': '重建後仍未恢復',
      'play-rejected': '瀏覽器拒絕自動播放，請手動按播放',
      'play-threw': '恢復播放時出錯',
      'restore-threw': '還原播放位置或倍速時出錯',
      'media-error': '播放器回報媒體錯誤',
      'seek-interrupted': '跳轉影片時已停止恢復',
      'lifecycle-ended': '影片已切換，舊的恢復流程已結束',
    },
    '原因請見診斷報告',
  )

export const measurementLabel = (state: unknown, reason: unknown): string => {
  const why = String(reason)
  if (why.startsWith('manual-')) return `已安排測速，${measurementLabel('waiting', why.slice(7))}`
  if (why.startsWith('candidate-')) return '正在測試 CDN 速度'
  if (why.startsWith('http-')) return `測試網址收到 HTTP ${why.slice(5)}，沒有取得有效速度`
  return plain(
    why,
    {
      disabled: '腳本已停用',
      'no-representation': '尚未確認目前的影片資料',
      hidden: '分頁不在前景',
      seeking: '正在跳轉影片',
      recovering: '正在恢復播放',
      'awaiting-progress': '等待影片穩定播放',
      'low-buffer': '緩衝還不夠，暫不測速',
      'cross-tab-cooldown': '其他分頁最近測過速，等待冷卻',
      'no-stale-candidate': '目前沒有需要測試的 CDN',
      'sample-recorded': '已記下測速結果',
      'short-response': '下載資料太少，無法判斷速度',
      timeout: '測速逾時',
      network: '測速時網路失敗',
      startup: '等待播放',
      generation: '等待新影片',
    },
    plain(state, {
      idle: '尚未測速',
      waiting: '等待安全的測速時機',
      running: '正在測速',
      complete: '已完成測速',
      failed: '這次測速沒有結果',
      cancelled: '已停止測速',
    }),
  )
}

export const startupLabel = (state: unknown, reason: unknown): string => {
  if (state === 'running') return '正在起播前測試可用路線（最長 3 秒）'
  if (state === 'complete')
    return reason === 'measured' ? '已測試並選好起播路線' : '已選好合法起播路線，測試沒有明確結果'
  if (state === 'skipped')
    return plain(
      reason,
      {
        'unsupported-or-no-legal-candidate': '這筆請求無法安全預測試，後續依目前選路設定處理',
        'preflight-error': '預測試未完成，後續依目前選路設定處理',
      },
      '這筆請求未進行起播預測試',
    )
  return '等待播放器提出第一筆影音請求'
}

export const attributionLabel = (status: unknown): string =>
  plain(status, {
    matched: '已確認屬於這支影片',
    'waiting-data': '還在等影片資料',
    weak: '只能辨識到相似網址，尚未確認',
    ambiguous: '可能對應多個畫質，尚未確認',
    detached: '屬於先前的影片',
    confirmed: '已確認',
    'awaiting-second-video-transfer': '再收到一筆影片資料才能確認',
    'awaiting-matched-video': '等待可辨識的影片資料',
  })

export const restrictionLabel = (reason: unknown): string =>
  plain(reason, {
    black: '黑名單',
    dead: '已標記為不可用',
    'catalog-disabled': '已在設定中停用',
    'default-unavailable': '預設不使用',
    'circuit-open': '近期故障，暫時避開',
    'catalog-unavailable': '沒有合法的內建 CDN',
    'catalog-unreplaceable': '無法安全改寫成內建 CDN',
    'catalog-only-non-get': '這類請求無法安全改寫成內建 CDN',
  })
