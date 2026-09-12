// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createReport(deps) {
const getPageTypeLabel = () => {
    const path = location.pathname
    const m = path.match(/^\/([a-z]+)(?:\/([a-z]+))?/)
    if (!m) return path || '/'
    return '/' + [m[1], m[2]].filter(Boolean).join('/')
}

let readDiagnosticHidden = () => null

const readPlaybackDiagnostic = (v) => {
    const out = { available: false, valid: false, paused: null, seeking: null, ended: null,
        readyState: null, networkState: null, currentTime: null, duration: null,
        bufferAheadSec: null, errorCode: null, hidden: null,
        observedRate: deps.playbackRateState.observedRate, effectiveRate: deps.playbackRateState.effectiveRate }
    try {
        out.hidden = readDiagnosticHidden()
        if (v === undefined) v = deps.Watchdog.getVideo()
        if (!v) return out
        out.available = true
        for (const key of ['paused', 'seeking', 'ended']) out[key] = typeof v[key] === 'boolean' ? v[key] : null
        for (const key of ['readyState', 'networkState', 'currentTime', 'duration']) {
            const value = v[key]
            out[key] = typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
        }
        const error = v.error
        out.errorCode = !error ? 0 : Number.isInteger(error.code) && error.code >= 1 && error.code <= 4 ? error.code : null
        if (out.currentTime === null || !v.buffered) return out
        let end = out.currentTime
        for (let i = 0; i < v.buffered.length; i++) {
            const a = v.buffered.start(i), b = v.buffered.end(i)
            if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return out
            if (out.currentTime >= a - 0.05 && out.currentTime <= b + 0.05) { end = b; break }
        }
        out.bufferAheadSec = Math.max(0, end - out.currentTime)
        out.valid = out.paused !== null && out.seeking !== null && out.ended !== null
            && Number.isInteger(out.readyState) && out.readyState <= 4 && out.errorCode !== null
    } catch { deps.DiagnosticLog.fault('snapshot') }
    return out
}

const buildDiagReport = () => {
    const buffer = deps.Watchdog.stats()
    const httpDns = deps.getHttpDnsStatus()
    const native = deps.getNativeRouteDiagnostics()
    const playerManifest = deps.getPlayerManifestDiagnostics()
    const routeHost = native.currentHost ? native.currentHost.split('.')[0] : '（無新鮮後態）'
    const lines = [
        '[BiliCDN_TW 診斷報告]',
        '版本：' + deps.VERSION,
        '頁面型態：' + getPageTypeLabel(),
        'UA：' + navigator.userAgent,
        '面板注入狀態：' + deps.uiInjectStatus,
        'Playinfo 生命週期：' + JSON.stringify(deps.getPagePlayInfoLifecycle()),
        '播放器 Manifest 同步：' + JSON.stringify(playerManifest)
            + '（只讀 player/core；不開啟統計面板、不新增網路）',
        '停用狀態：' + deps.disabled,
        '節點禁止／替代結果：' + JSON.stringify(deps.hostRestrictionSummary?.() || {}),
        '禁止規則：black／dead／soft、設定排除及預設不可用均生效；固定或原始 URL 不例外；無替代即阻止',
        '固定節點狀態：' + (deps.resolvedCdn ? deps.resolvedCdn + '｜' + (deps.hostRestriction?.(deps.resolvedCdn).allowed === false
            ? '暫時禁止，設定保留；原因=' + deps.hostRestriction(deps.resolvedCdn).reasons.join('、') : '允許') : '自動'),
        '候選順序：' + (deps.activeCdnList.map(c => c.split('.')[0]).join(' > ') || '（無）'),
        '真正可選節點：' + (deps.getHealthyCdnList().map(c => c.split('.')[0]).join(' > ') || '（無）'),
        '黑名單（24h）：' + ([...deps.blacklistSet].map(c => c.split('.')[0]).join(', ') || '（無）'),
        '持久死節點：' + (deps.listDeadHosts()
            .map(e => e.host.split('.')[0] + '(' + e.reason + '，剩 ' + e.daysLeft + 'd)')
            .join(', ') || '（無）'),
        '路由狀態：' + native.currentRouteType + '｜' + routeHost
            + '（計畫與 Transport 觀察分列如下；representation 改變不等於換路）',
        'Catalog 改寫建議：' + deps.getCdnShortName(),
        '目前 representation：' + (native.active ? JSON.stringify(native.active) : '未確認')
            + '｜tentative=' + (native.tentative ? JSON.stringify(native.tentative) : '無')
            + '｜representationRevision=' + native.representationRevision
            + '｜routeRevision=' + native.routeRevision,
        'Native Route：當前群組=' + native.groupNativeCount + '｜狀態=' + JSON.stringify(native.counts)
            + '｜Ledger=' + JSON.stringify(native.ledger),
        '候選來源／解鎖：' + JSON.stringify(native.admission)
            + '（優先序=playurl API > player-mpd > page-hint > transport-bootstrap；內建 Catalog 獨立參賽）',
        '路由後態：planned=' + JSON.stringify(native.plannedRoute)
            + '｜本 epoch 觀察到的影片 host 變更=' + native.observedHostChanges
            + '｜observed=' + JSON.stringify(native.lastObservedRoute)
            + '｜boundary=' + JSON.stringify(native.lastRouteBoundary)
            + '｜穩定性守門=' + JSON.stringify(native.suppressedSwitches),
        '最近 bakeoff 路線結果：' + JSON.stringify(native.lastBakeoff)
            + '（測速只更新評級）｜自動畫質原因=' + native.autoQualityReason,
        ...['video', 'audio'].map(kind => {
            const entry = deps.getMediaDeliverySnapshot()[kind]
            return (kind === 'video' ? '最近影片 CDN：' : '最近音訊 CDN：')
                + (entry.fresh ? (entry.host ? entry.host.split('.')[0] : entry.classification) : '無新鮮資料')
                + '（觀察到的請求；來源=' + entry.source + '；年齡=' + (entry.ageSec == null ? '無資料' : entry.ageSec + '秒') + '）'
        }),
        deps.describePlaybackBuffer(buffer),
        '累計觀察媒體資料（含快取重送，非 wire bytes／目前緩衝）：' + buffer.totalMB + ' MB',
        '播放倍速：' + deps.playbackRateState.effectiveRate + 'x（'
            + (deps.playbackRateState.confirmed ? '已確認' : '假定') + '，來源=' + deps.playbackRateState.source + '）',
        'Codec 偏好：' + deps.resolvedVideoCodecPreference + '；最近排序首位=' + JSON.stringify(deps.lastCodecDecision.groups),
        '目前配置能力（非硬解證明）：' + JSON.stringify(deps.getCurrentCodecDiagnostics()),
        '串流估計（觀察到的 representation）：' + JSON.stringify(deps.streamEstimate),
        '播放影格（自本次觀察起；唯讀）：' + (deps.playbackQualitySnapshot.available ? JSON.stringify(deps.playbackQualitySnapshot) : '無資料'),
        '頁面發現 CDN：' + (deps.pageDiscoveredCdn ? deps.pageDiscoveredCdn.split('.')[0] : '（無）'),
        '改寫統計：' + JSON.stringify(deps.redirectStats),
        'HTTPDNS：' + httpDns.mode + (httpDns.ttlMin ? '（' + httpDns.ttlMin + 'm）' : ''),
    ]
    const history = deps.DiagnosticLog.snapshot()
    lines.splice(5, 0,
        'Verbose：' + (deps.Config.verbose ? '已開啟' : '已關閉') + '；' + (history.persisted === true ? '設定已確認儲存' : '本分頁已套用，未確認儲存'),
        '紀錄：僅本分頁記憶體，重整清空；起點=' + history.startedAt + '；Verbose 最近切換=' + history.verboseChangedAt,
        '播放器現況：' + JSON.stringify(readPlaybackDiagnostic()),
        'Watchdog 決策：' + JSON.stringify(history.decision),
        'Watchdog 統計（修復嘗試不等於已換路；影片換 host 只代表觀察到的請求）：' + JSON.stringify({
            switchCount: buffer.switchCount, recoveryAttemptCount: buffer.recoveryAttemptCount,
            observedSwitchCount: buffer.observedSwitchCount, stallCount: buffer.stallCount, breakerSec: buffer.breakerSec }),
        '紀錄容量：' + JSON.stringify({ evicted: history.evicted, expired: history.expired, rejected: history.rejected,
            pendingEvicted: history.pendingEvicted, recorderFailures: history.failures }),
    )
    // Priority: current state, critical history, pending requests, then newest detail.
    const limit = 64 * 1024, reserve = 256
    let text = lines.join('\n'), omitted = 0
    if (deps.DiagnosticLog.size(text) > limit / 2) { text = text.slice(0, 8000); omitted++ }
    const append = line => {
        if (deps.DiagnosticLog.size(text) + deps.DiagnosticLog.size(line) + 1 > limit - reserve) { omitted++; return }
        text += '\n' + line
    }
    append('近期關鍵事件（新到舊）：')
    history.critical.slice().reverse().forEach(e => append(JSON.stringify(e)))
    append('等待中的請求（非完整網路面板；不包含已脫離 generation 的請求）：')
    history.pending.forEach(e => append(JSON.stringify(e)))
    append('Verbose 近期細節（新到舊；開啟前未收集的細節無法補回）：')
    history.detail.slice().reverse().forEach(e => append(JSON.stringify(e)))
    return text + '\n匯出截斷：' + (omitted ? omitted + ' 筆／區段未匯出' : '無')
}
return { /* TEST_EXPORTS:report */
get readDiagnosticHidden() { return readDiagnosticHidden; }, set readDiagnosticHidden(value) { readDiagnosticHidden = value; },
get readPlaybackDiagnostic() { return readPlaybackDiagnostic; },
get buildDiagReport() { return buildDiagReport; }
};
}
