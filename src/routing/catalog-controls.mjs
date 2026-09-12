// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createCatalogControls(deps) {
let cdnProbeStarted = false

const startCdnProbe = () => {
    if (cdnProbeStarted || deps.disabled) return
    cdnProbeStarted = true
    // v1.3.3：先立刻對「這次最可能用到的節點」開連線。延遲探測要跑一秒以上才排得完序，
    // 但 playurl 可能更早到 —— 那樣第一個 segment 就得從零做 DNS + TCP + TLS 握手，
    // 跨國情境下這段就是好幾百毫秒的起播延遲。preconnect 幾乎零成本（沒用到的連線
    // 閒置一陣子就被瀏覽器回收），先開一定比等排序完再開好。
    try {
        // 對準「playurl 這次真的會寫進去」的那組 host：primary 用 getCurrentCdn(STARTUP_PICK)、
        // backup 用 getHealthyCdnList(STARTUP_PICK).slice(0,2)，跟 transformStreamItem /
        // buildBackupUrls 完全一致。舊版 backup 那兩顆取自 activeCdnList 的 index 順序，
        // 而 index 只是「沒有樣本時」的退路排序，跟實際會被寫進 backup_url 的節點常常不同
        // —— 等於熱身了兩條用不到的連線，真正的 backup 反而是冷的。
        // ★ 順序：先剔除 primary、再 slice(2)——不能反過來。buildBackupUrls 就是這樣做的
        // （它 filter(cdn !== primaryHost) 之後才 slice(0, 2)），而 primary 幾乎總是排名第一，
        // 所以先 slice 再交給 Set 去重的話，backup 的第一顆會跟 primary 重複被吃掉，
        // 只剩 2 個 host 被熱身——真正的第二顆 backup 反而是冷的。它正是「primary 失敗後
        // 播放器第二個會試」的節點，起播失敗時要靠它救場，卻得從零做 DNS + TCP + TLS。
        const primary = deps.getCurrentCdn(deps.STARTUP_PICK)
        const backups = deps.getHealthyCdnList(deps.STARTUP_PICK)
            .filter(c => c !== primary)
            .slice(0, 2)
        deps.preconnectBatch([primary, ...backups].filter(Boolean), false)
    } catch {}
    deps.reorderCdnsByLatency().catch(deps.reportMeasurementFailure())
}

const persistCatalogOverrides = () => {
    try {
        const payload = Object.fromEntries(Object.entries(deps.catalogOverrides)
            .filter(([host, enabled]) => deps.TRUSTED_CDN_CATALOG_SET.has(host) && typeof enabled === 'boolean'))
        if (Object.keys(payload).length) GM_setValue(deps.CATALOG_OVERRIDES_KEY, payload)
        else GM_deleteValue(deps.CATALOG_OVERRIDES_KEY)
    } catch {}
}

const reconcileCatalogCandidates = () => {
    deps.rebuildPreferredCdnList()
    for (let i = deps.activeCdnList.length - 1; i >= 0; i--) {
        if (!deps.PREFERRED_CDN_LIST.includes(deps.activeCdnList[i])) deps.activeCdnList.splice(i, 1)
    }
    deps.PREFERRED_CDN_LIST.forEach(host => {
        if (!deps.activeCdnList.includes(host) && !deps.blacklistSet.has(host) && !deps.knownDeadHosts.has(host)) {
            deps.activeCdnList.push(host)
        }
    })
    const ranked = deps.getHealthyCdnList()
    if (ranked.length) {
        const rest = deps.activeCdnList.filter(host => !ranked.includes(host))
        deps.activeCdnList.splice(0, deps.activeCdnList.length, ...ranked, ...rest)
    }
    if (deps.lastChosenCdn && !deps.PREFERRED_CDN_LIST.includes(deps.lastChosenCdn)) deps.lastChosenCdn = null
    if (deps.pageDiscoveredCdn && deps.TRUSTED_CDN_CATALOG_SET.has(deps.pageDiscoveredCdn)
        && !deps.PREFERRED_CDN_LIST.includes(deps.pageDiscoveredCdn)) deps.pageDiscoveredCdn = null
    try { GM_deleteValue(deps.PROBE_CACHE_KEY) } catch {}
    deps.clearRuntimeConnectionHints()
    deps.promoteBestCdnNow()
    if (!deps.disabled) deps.preconnectBatch(deps.getHealthyCdnList().slice(0, 3), false)
    deps.refreshPublicDiagnosticSnapshot()
}

const setCatalogOverride = (host, enabled) => {
    if (!deps.TRUSTED_CDN_CATALOG_SET.has(host) || typeof enabled !== 'boolean') return false
    const next = Object.assign(Object.create(null), deps.catalogOverrides, { [host]: enabled })
    const usable = deps.TRUSTED_CDN_CATALOG.some(candidate => {
        const candidateEnabled = Object.prototype.hasOwnProperty.call(next, candidate)
            ? next[candidate]
            : !deps.matchesHeaderExclude(candidate)
        return candidateEnabled && !deps.isPresumedDnsFailHost(candidate)
    })
    if (!usable) {
        console.error('[BiliCDN] 拒絕：自動選路至少要保留一個非 presumed 候選')
        return false
    }
    deps.catalogOverrides[host] = enabled
    persistCatalogOverrides()
    reconcileCatalogCandidates()
    return true
}

const resetCatalogOverrides = () => {
    Object.keys(deps.catalogOverrides).forEach(host => delete deps.catalogOverrides[host])
    persistCatalogOverrides()
    reconcileCatalogCandidates()
    return deps.controlResult(true, 'defaults-restored', '已恢復檔頭的 catalog 預設')
}

const applyCatalogSelection = selectedIndices => {
    if (!Array.isArray(selectedIndices)) return deps.controlResult(false, 'invalid-selection', 'Catalog 選擇格式不合法')
    const selected = new Set(selectedIndices.filter(index => Number.isInteger(index)
        && index >= 0 && index < deps.TRUSTED_CDN_CATALOG.length))
    const usable = deps.TRUSTED_CDN_CATALOG.some((host, index) => selected.has(index) && !deps.isPresumedDnsFailHost(host))
    if (!usable) return deps.controlResult(false, 'zero-candidates', '自動選路至少要保留一個非 presumed 候選')
    Object.keys(deps.catalogOverrides).forEach(host => delete deps.catalogOverrides[host])
    deps.TRUSTED_CDN_CATALOG.forEach((host, index) => {
        const enabled = selected.has(index)
        const headerDefault = !deps.matchesHeaderExclude(host) && !(deps.INITIAL_DEAD_HOSTS_TW || []).includes(host)
        if (enabled !== headerDefault) deps.catalogOverrides[host] = enabled
    })
    persistCatalogOverrides()
    reconcileCatalogCandidates()
    return deps.controlResult(true, 'catalog-updated', 'Catalog 自動選路設定已套用', {
        enabled: deps.TRUSTED_CDN_CATALOG.filter((host, index) => selected.has(index)).length,
    })
}

const reloadAfterFeedback = () => setTimeout(() => { try { location.reload() } catch {} }, 450)
const restoreAutomaticDefaults = () => {
    GM_deleteValue('CustomCDN')
    return resetCatalogOverrides()
}
return { /* TEST_EXPORTS:catalogControls */
get restoreAutomaticDefaults() { return restoreAutomaticDefaults; },
get cdnProbeStarted() { return cdnProbeStarted; }, set cdnProbeStarted(value) { cdnProbeStarted = value; },
get startCdnProbe() { return startCdnProbe; },
get resetCatalogOverrides() { return resetCatalogOverrides; },
get applyCatalogSelection() { return applyCatalogSelection; },
get reloadAfterFeedback() { return reloadAfterFeedback; }
};
}
