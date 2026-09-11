// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createViews(deps) {
const showResetLearningDialog = () => deps.TrustedMenuUI.openConfirm({
    title: '重置所有學習狀態？',
    paragraphs: [
        '將清除 CDN health、blacklist、dead／soft block、probe cache、HTTPDNS 學習及 Watchdog 統計。',
        '固定 CDN 與 catalog override 不會被清除。此操作無法復原。',
    ],
    confirmLabel: '確認重置',
    cancelLabel: '返回節點維護',
    onCancel: () => showMaintenanceCenter(),
    danger: true,
    onConfirm: () => {
        const result = deps.BiliCDNControls.reset()
        deps.refreshPublicDiagnosticSnapshot()
        deps.TrustedMenuUI.toast(result.message + '，正在重新載入…', 'success')
        deps.reloadAfterFeedback()
    },
})

const showDiagnosticDialog = () => {
    deps.BiliCDNControls.diag()
    deps.refreshPublicDiagnosticSnapshot()
    return deps.TrustedMenuUI.openText({
        title: 'BiliCDN 診斷資訊',
        paragraphs: ['「排序首位」不等於已確認解碼 codec；此報告包含 UA，但不含影片 URL、cookie 或 IP。'],
        text: deps.buildDiagReport(),
        copyLabel: '複製報告',
        onCopy: () => { deps.copyDiagReport().catch(() => {}) },
        closeLabel: '返回控制中心',
        onClose: () => showControlCenter(),
    })
}

const showDeadReviveDialog = () => {
    const dead = deps.listDeadHosts().map(entry => entry.host).filter(host => deps.TRUSTED_CDN_CATALOG_SET.has(host))
    if (!dead.length) {
        deps.TrustedMenuUI.toast('目前沒有可救回的 dead catalog 節點', 'info')
        showMaintenanceCenter()
        return false
    }
    return deps.TrustedMenuUI.openChoice({
        title: '救回單一 dead catalog 節點',
        paragraphs: ['只解除所選節點的持久 dead 判定；不修改 catalog override。'],
        choices: dead.map(host => ({
            label: host,
            detail: (deps.listDeadHosts().find(entry => entry.host === host) || {}).reason || 'dead',
        })),
        selected: [0],
        confirmLabel: '救回節點',
        cancelLabel: '返回節點維護',
        onCancel: () => showMaintenanceCenter(),
        navigateOnConfirm: true,
        onConfirm: picked => {
            const index = picked[0]
            const host = Number.isInteger(index) ? dead[index] : null
            const stillDead = host && deps.listDeadHosts().some(entry => entry.host === host)
            const result = stillDead && deps.TRUSTED_CDN_CATALOG_SET.has(host)
                ? deps.BiliCDNControls.revive(host)
                : deps.controlResult(false, 'stale', '節點狀態已改變，請重新開啟選單')
            deps.syncWorkerCdnTarget()
            deps.refreshPublicDiagnosticSnapshot()
            deps.TrustedMenuUI.toast(result.message, result.ok ? 'success' : 'warning')
            showMaintenanceCenter()
        },
    })
}

const showWorkerStatsDialog = () => {
    const stats = deps.BiliCDNControls.workerStats()
    const lines = [
        'Worker 攔截：' + (deps.EnableWorkerIntercept ? '已開啟' : '預設關閉（目前數值為 0 屬正常）'),
        'created=' + stats.created,
        'netCalls=' + stats.netCalls,
        'mediaSeen=' + stats.mediaSeen,
        'rewrites=' + stats.rewrites,
        'bytes=' + stats.bytesMB + ' MB',
        '觀察天數=' + stats.observedDays,
        '判讀=' + stats.verdict,
    ]
    return deps.TrustedMenuUI.openText({
        title: 'Worker 使用量',
        text: lines.join('\n'),
        closeLabel: '返回進階設定',
        onClose: () => showAdvancedCenter(),
    })
}

const showAsyncControlResult = async (startMessage, operation) => {
    const progress = deps.TrustedMenuUI.toast(startMessage, 'info', { sticky: true })
    try {
        const result = await operation()
        progress.update(result.message, result.ok ? 'success' : (result.status === 'disabled' ? 'warning' : 'info'))
        return result
    } catch (error) {
        const result = deps.controlResult(false, 'error', '操作失敗：' + (error && error.message ? error.message : '未知錯誤'))
        progress.update(result.message, 'error')
        return result
    }
}

const runSmartReassessment = () => {
    if (deps.lastSampleSegmentUrl) {
        return showAsyncControlResult('開始以目前影片分段重新測速…', () => deps.BiliCDNControls.bakeoff())
    }
    return showAsyncControlResult('尚無影片分段，改用延遲探測…', async () => {
        const result = await deps.BiliCDNControls.probe()
        return result && result.ok
            ? deps.controlResult(true, result.status, '尚無影片分段；' + result.message, result.data)
            : result
    })
}

const showRoutingCenter = () => {
    const routes = [
        { label: '自動選路', detail: deps.resolvedCdn ? '重新載入後恢復自動' : '目前模式' },
        ...deps.TRUSTED_CDN_CATALOG.map(host => ({
            label: host,
            detail: [
                host === deps.resolvedCdn ? '目前固定' : '',
                '檔頭預設=' + (deps.matchesHeaderExclude(host) ? '停用' : '啟用'),
                Object.prototype.hasOwnProperty.call(deps.catalogOverrides, host) ? 'override' : '',
                deps.knownDeadHosts.has(host) ? 'dead' : '',
                deps.isPresumedDnsFailHost(host) ? 'presumed' : '',
            ].filter(Boolean).join('；') || '可信 catalog 節點',
        })),
    ]
    const fixedSelected = deps.resolvedCdn ? Math.max(1, deps.TRUSTED_CDN_CATALOG.indexOf(deps.resolvedCdn) + 1) : 0
    const catalogSelected = deps.TRUSTED_CDN_CATALOG
        .map((host, index) => deps.isCatalogAutoEnabled(host) ? index : -1)
        .filter(index => index >= 0)
    return deps.TrustedMenuUI.openRouting({
        title: 'CDN 選路',
        paragraphs: [deps.resolvedCdn
            ? '目前使用固定 CDN；候選勾選會保留，恢復自動後生效。'
            : '固定節點優先於候選設定。至少保留一個非 presumed 自動候選。'],
        routes,
        fixedSelected,
        catalogSelected,
        backLabel: '返回控制中心',
        onBack: () => showControlCenter(),
        onDefaults: () => {
            const result = deps.restoreAutomaticDefaults()
            deps.refreshPublicDiagnosticSnapshot()
            deps.TrustedMenuUI.toast('已恢復自動選路與檔頭預設；正在重新載入…', result.ok ? 'success' : 'error')
            if (result.ok) deps.reloadAfterFeedback()
        },
        onConfirm: ({ routeIndex, enabled }) => {
            if (!Number.isInteger(routeIndex) || routeIndex < 0 || routeIndex > deps.TRUSTED_CDN_CATALOG.length) {
                deps.TrustedMenuUI.toast('固定節點選擇不合法', 'error')
                return
            }
            const catalogResult = deps.applyCatalogSelection(enabled)
            if (!catalogResult.ok) {
                deps.TrustedMenuUI.toast(catalogResult.message, 'error')
                return
            }
            const host = routeIndex === 0 ? null : deps.TRUSTED_CDN_CATALOG[routeIndex - 1]
            const routeResult = deps.BiliCDNControls.setCdn(host)
            deps.refreshPublicDiagnosticSnapshot()
            deps.TrustedMenuUI.toast(routeResult.ok ? '選路設定已套用；正在重新載入…' : routeResult.message,
                routeResult.ok ? 'success' : 'error')
            if (routeResult.ok) deps.reloadAfterFeedback()
        },
    })
}

const showMaintenanceCenter = () => {
    const softCount = Object.keys(deps.cdnSoftBlockUntil).filter(deps.isCdnSoftBlocked).length
    const deadCount = deps.listDeadHosts().filter(entry => deps.TRUSTED_CDN_CATALOG_SET.has(entry.host)).length
    const blackCount = deps.blacklistSet.size
    return deps.TrustedMenuUI.openActions({
        title: '節點維護',
        paragraphs: ['soft=' + softCount + '、dead=' + deadCount + '、black=' + blackCount],
        items: [
            {
                label: '清除所有 soft block', action: 'clear-soft', onActivate: () => {
                    const result = deps.BiliCDNControls.clearSoft()
                    deps.refreshPublicDiagnosticSnapshot()
                    deps.TrustedMenuUI.toast(result.message, result.status === 'empty' ? 'info' : 'success')
                    showMaintenanceCenter()
                },
            },
            { label: '救回單一 dead catalog 節點', action: 'revive-dead', onActivate: showDeadReviveDialog },
            { label: '重置所有學習狀態', action: 'reset-all', onActivate: showResetLearningDialog },
            { label: '返回控制中心', action: 'back', onActivate: () => showControlCenter() },
        ],
    })
}

const showAdvancedCenter = () => deps.TrustedMenuUI.openActions({
    title: '進階',
    paragraphs: [
        'Verbose 目前' + (deps.Config.verbose ? '已開啟' : '已關閉') + '。',
        'Worker 攔截只能在檔頭設定；此處僅顯示使用量。',
    ],
    items: [
        {
            label: deps.Config.verbose ? '關閉 verbose' : '開啟 verbose', action: 'verbose-toggle', onActivate: () => {
                const result = deps.BiliCDNControls.verbose(!deps.Config.verbose)
                deps.refreshPublicDiagnosticSnapshot()
                deps.TrustedMenuUI.toast(result.message, result.ok ? 'success' : 'warning')
                showAdvancedCenter()
            },
        },
        { label: '顯示 Worker 使用量', action: 'worker-stats', onActivate: showWorkerStatsDialog },
        { label: '返回控制中心', action: 'back', onActivate: () => showControlCenter() },
    ],
})

function showControlCenter() {
    const stats = deps.Watchdog.stats()
    const worker = deps.summarizeWorkerStats()
    const httpdns = deps.getHttpDnsStatus()
    const abnormal = deps.blacklistSet.size + deps.knownDeadHosts.size
        + Object.keys(deps.cdnSoftBlockUntil).filter(deps.isCdnSoftBlocked).length
    const codecLead = deps.lastCodecDecision.groups && deps.lastCodecDecision.groups[0]
        ? (deps.lastCodecDecision.groups[0].selected || '未知')
        : '尚無資料'
    return deps.TrustedMenuUI.openActions({
        title: 'BiliCDN 控制中心',
        paragraphs: [
            '狀態：' + (deps.disabled ? '停用' : '啟用') + '｜模式：' + (deps.resolvedCdn ? '固定' : '自動')
                + '｜選路建議：' + deps.getCdnShortName(),
            '倍速：' + deps.playbackRateState.effectiveRate + 'x（' + (deps.playbackRateState.confirmed ? '已確認' : '假定')
                + '）｜' + deps.describePlaybackBuffer(stats),
            '串流：' + deps.streamEstimate.videoMbps + '+' + deps.streamEstimate.audioMbps + ' Mbps｜codec 排序首位：' + codecLead,
            '異常節點：' + abnormal + '｜HTTPDNS：' + httpdns.mode + '｜Worker：'
                + (deps.EnableWorkerIntercept ? ('created=' + worker.created + ' rewrites=' + worker.rewrites) : '停用'),
        ],
        items: [
            { label: '重新評估節點', action: 'reassess', onActivate: () => {
                runSmartReassessment()
                showControlCenter()
            } },
            { label: 'CDN 選路', action: 'routing', onActivate: showRoutingCenter },
            { label: '診斷', action: 'diagnostics', onActivate: showDiagnosticDialog },
            { label: '節點維護', action: 'maintenance', onActivate: showMaintenanceCenter },
            { label: '進階', action: 'advanced', onActivate: showAdvancedCenter },
        ],
    })
}

const registerControlMenu = register => register('⚙️ 開啟 BiliCDN 控制中心', showControlCenter)
return { /* TEST_EXPORTS:views */
get registerControlMenu() { return registerControlMenu; },

};
}
