// Current-playinfo signed routes and cross-playinfo, host-only native route ratings.
// A rating is evidence, never authority to synthesize a URL, preconnect, or extend the catalog.
export function createNativeRoutes(deps) {
const LEDGER_KEY = 'nativeRouteRatings_v1'
const LEDGER_VERSION = 1
const VIDEO_LIMIT = 48
const AUDIO_LIMIT = 16
const VIDEO_GROUP_LIMIT = 128
const AUDIO_GROUP_LIMIT = 64
const GROUP_ROUTE_LIMIT = 4
const POOL_URL_CHARS_MAX = 1024 * 1024
const URL_MAX = 16 * 1024
const RECORD_TTL_MS = 6 * 60 * 60 * 1000
const SOFT_BLOCK_MS = 10 * 60 * 1000
const SAMPLE_FRESH_MS = 60 * 1000
const ALPHA = 0.35
const MIN_SAMPLE_BYTES = 128 * 1024
const MIN_SAMPLE_MS = 5
const STICKY_MARGIN = 0.20

const finite = (value, fallback = 0, max = Number.MAX_SAFE_INTEGER) => {
    const n = Number(value)
    return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : fallback
}
const int = (value, max = 10000) => Math.trunc(finite(value, 0, max))
const safeHost = value => {
    const host = typeof value === 'string' ? value.trim().toLowerCase() : ''
    const label = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?'
    return host.length > 0 && host.length <= 253 && new RegExp(`^${label}(?:\\.${label})*$`).test(host) ? host : ''
}
const isIpLiteral = host => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(':')
const isKnownFamily = host => /(?:^|\.)bilivideo\.(?:com|cn|net)$/.test(host) || /(?:^|\.)akamaized\.net$/.test(host)
const emptyRecord = host => ({
    host, ewmaMbps: 0, varMbps: 0, samples: 0, probeSamples: 0, transportSamples: 0,
    successes: 0, failures: 0, slowSamples: 0, latencyMs: 0, softBlockedUntil: 0,
    lastSeen: 0, lastThroughputAt: 0, lastLatencyAt: 0, lastSuccessAt: 0,
    lastFailureAt: 0, lastSlowAt: 0,
})
const sanitizeRecord = (host, raw, now = Date.now()) => {
    host = safeHost(host)
    if (!host || !raw || typeof raw !== 'object' || isIpLiteral(host)) return null
    const record = emptyRecord(host)
    record.ewmaMbps = finite(raw.ewmaMbps, 0, 100000)
    record.varMbps = finite(raw.varMbps, 0, 1e10)
    record.samples = int(raw.samples, 12)
    record.probeSamples = int(raw.probeSamples, 12)
    record.transportSamples = int(raw.transportSamples, 12)
    record.successes = int(raw.successes, 12)
    record.failures = int(raw.failures, 3)
    record.slowSamples = int(raw.slowSamples, 3)
    record.latencyMs = finite(raw.latencyMs, 0, 60000)
    record.softBlockedUntil = finite(raw.softBlockedUntil, 0, now + SOFT_BLOCK_MS)
    for (const key of ['lastSeen','lastThroughputAt','lastLatencyAt','lastSuccessAt','lastFailureAt','lastSlowAt']) {
        record[key] = finite(raw[key], 0, now)
    }
    if (!record.lastSeen || now - record.lastSeen > RECORD_TTL_MS) return null
    // Unknown third-party families must have passive player evidence before persistence.
    if (!isKnownFamily(host) && record.transportSamples < 1) return null
    return record
}

const ledgers = { video: new Map(), audio: new Map() }
let evicted = 0
let loadRejected = 0
let saveTimer = null
const loadLedger = () => {
    let raw = null
    try { raw = JSON.parse(deps.gmGet(LEDGER_KEY) || 'null') } catch { loadRejected++ }
    if (!raw || raw.version !== LEDGER_VERSION) return
    for (const kind of ['video', 'audio']) {
        const source = raw[kind] && typeof raw[kind] === 'object' ? raw[kind] : {}
        for (const [host, value] of Object.entries(source)) {
            if (deps.TRUSTED_CDN_CATALOG_SET.has(host)) { loadRejected++; continue }
            const record = sanitizeRecord(host, value)
            if (record) ledgers[kind].set(host, record)
            else loadRejected++
        }
    }
}
const limitFor = kind => kind === 'audio' ? AUDIO_LIMIT : VIDEO_LIMIT
const trimLedger = kind => {
    const ledger = ledgers[kind]
    const now = Date.now()
    for (const [host, record] of ledger) {
        if (!record.lastSeen || now - record.lastSeen > RECORD_TTL_MS) ledger.delete(host)
    }
    while (ledger.size > limitFor(kind)) {
        const oldest = [...ledger.values()].sort((a, b) => a.lastSeen - b.lastSeen)[0]
        if (!oldest) break
        ledger.delete(oldest.host); evicted++
    }
}
loadLedger()
trimLedger('video'); trimLedger('audio')
const serialize = () => {
    trimLedger('video'); trimLedger('audio')
    const out = { version: LEDGER_VERSION, video: {}, audio: {} }
    for (const kind of ['video', 'audio']) for (const [host, record] of ledgers[kind]) out[kind][host] = { ...record }
    return out
}
const mergeRecord = (mine, theirs) => {
    if (!theirs) return mine
    if (!mine) return theirs
    const out = { ...(mine.lastSeen >= theirs.lastSeen ? mine : theirs) }
    const choose = (stamp, fields) => {
        const source = (mine[stamp] || 0) >= (theirs[stamp] || 0) ? mine : theirs
        fields.forEach(key => { out[key] = source[key] })
        out[stamp] = source[stamp]
    }
    choose('lastThroughputAt', ['ewmaMbps','varMbps','samples','probeSamples','slowSamples','lastSlowAt'])
    choose('lastLatencyAt', ['latencyMs'])
    choose('lastSuccessAt', ['successes','transportSamples'])
    choose('lastFailureAt', ['failures','softBlockedUntil'])
    out.lastSeen = Math.max(mine.lastSeen || 0, theirs.lastSeen || 0)
    return out
}
const saveNow = () => {
    saveTimer = null
    try {
        const mine = serialize()
        let stored = null
        try { stored = JSON.parse(deps.gmGet(LEDGER_KEY) || 'null') } catch {}
        for (const kind of ['video','audio']) {
            const other = stored?.version === LEDGER_VERSION && stored[kind] && typeof stored[kind] === 'object' ? stored[kind] : {}
            for (const [host, raw] of Object.entries(other)) {
                if (deps.TRUSTED_CDN_CATALOG_SET.has(host)) continue
                const theirs = sanitizeRecord(host, raw)
                if (!theirs) continue
                const merged = mergeRecord(ledgers[kind].get(host), theirs)
                if (merged) ledgers[kind].set(host, merged)
            }
            trimLedger(kind)
        }
        deps.gmSet(LEDGER_KEY, JSON.stringify(serialize()))
    } catch { deps.DiagnosticLog?.fault?.('native-ledger-save') }
}
const scheduleSave = () => {
    if (saveTimer) return
    saveTimer = setTimeout(saveNow, 1000)
}
const clearLedger = () => {
    ledgers.video.clear(); ledgers.audio.clear()
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
    try { deps.gmDelete(LEDGER_KEY) } catch {}
}

let groups = new Map()
let identityGroups = new Map()
let protectedUrls = new Set()
let poolChars = 0
let groupSeq = 0
let routeRevision = 0
let representationRevision = 0
let activeRepresentation = null
let tentativeRepresentation = null
let lastAutoQualityReason = 'none'
let lastBakeoff = []
let consecutiveVideoEvidence = { groupId: null, count: 0 }
let plannedAffinity = null
let routeAffinity = null
let lastPlannedRoute = null
let lastObservedRoute = null
let observedHostChanges = 0
let lastRouteBoundary = null
let suppressedSwitches = { probeHealthy: 0, representation: 0 }
let avoidedHosts = new Set()
let pageExact = new Map()
let generatedExact = new Map()
let candidateSerial = 0
let startupScheduled = false
let retainedAffinity = null
let upgradingSource = false
const retainAffinityForTrustedPlayinfo = () => {
    upgradingSource = [...groups.values()].some(g => g.source === 'page-hint')
    retainedAffinity = upgradingSource && routeAffinity ? { ...routeAffinity } : null
}
const scheduleStartupSample = url => {
    if (startupScheduled || deps.disabled || deps.resolvedCdn) return
    startupScheduled = true
    deps.scheduleObservedSample?.(url)
}

const parseEligibleUrl = url => {
    if (typeof url !== 'string' || !url || url.length > URL_MAX) return null
    let parsed
    try { parsed = deps.parseMediaHttpUrl(url) } catch { return null }
    if (!parsed || parsed.username || parsed.password || !/^https?:$/.test(parsed.protocol)) return null
    if (parsed.protocol !== 'https:' || (parsed.port && parsed.port !== '443')) return null
    const host = safeHost(parsed.hostname)
    if (!host || isIpLiteral(host)) return null
    const delivery = deps.classifyMediaDelivery(parsed.href)
    if (['pcdn','suspected-pcdn','live'].includes(delivery?.kind)) return null
    const decision = deps.mediaUrlPolicy.decide(parsed.href)
    if (decision.action === 'pass' && ['resource','live','suspected-pcdn','pcdn'].includes(decision.reason)) return null
    const mediaPath = deps.mediaUrlPolicy.isMediaPath
        ? deps.mediaUrlPolicy.isMediaPath(parsed.pathname)
        : deps.isMediaSegmentUrl(parsed.href)
    if (!mediaPath) return null
    return { url: parsed.href, host, identity: parsed.pathname + parsed.search }
}
const routeState = (kind, host, group) => {
    const record = ledgers[kind]?.get(host)
    if (group?.invalidHosts?.has(host)) return 'invalid'
    if (group?.ambiguous || (group?.source === 'page-hint' && !group.routes.some(r => r.host === host && group.unlocked.has(r.url)))) return 'unknown'
    if (record?.transportSamples > 0) return 'confirmed'
    if (record?.probeSamples > 0 && record.lastThroughputAt
        && Date.now() - record.lastThroughputAt <= SAMPLE_FRESH_MS) return 'probe-qualified'
    return 'unknown'
}
const recordFor = (kind, host, create = false) => {
    if (!['video','audio'].includes(kind) || deps.TRUSTED_CDN_CATALOG_SET.has(host)) return null
    let record = ledgers[kind].get(host)
    if (!record && create) {
        if (!isKnownFamily(host)) return null
        record = emptyRecord(host); ledgers[kind].set(host, record)
    }
    return record || null
}
const isSoftBlocked = record => !!record?.softBlockedUntil && record.softBlockedUntil > Date.now()
const scoreRecord = (record, required) => {
    if (!record) return 0
    return deps.scoreRouteHealth(record, { required, softBlocked: isSoftBlocked(record), exploreBonus: 0 })
}

const resetPool = () => {
    groups = new Map(); identityGroups = new Map(); protectedUrls = new Set()
    poolChars = 0; groupSeq = 0; activeRepresentation = null; tentativeRepresentation = null
    consecutiveVideoEvidence = { groupId: null, count: 0 }
    plannedAffinity = null; routeAffinity = null
    if (retainedAffinity) {
        routeAffinity = retainedAffinity
        plannedAffinity = { type: deps.TRUSTED_CDN_CATALOG_SET.has(retainedAffinity.host) ? 'catalog-generated' : 'native-signed',
            host: retainedAffinity.host, reason: 'source-upgrade', setAt: Date.now() }
        retainedAffinity = null
    }
    pageExact = new Map(); generatedExact = new Map()
    if (!upgradingSource) startupScheduled = false
    upgradingSource = false
    lastPlannedRoute = null; lastObservedRoute = null; lastRouteBoundary = null
    observedHostChanges = 0
    avoidedHosts = new Set()
    suppressedSwitches = { probeHealthy: 0, representation: 0 }
    lastAutoQualityReason = 'epoch-reset'; routeRevision++; representationRevision++
}
const rawUrls = (item, isDash) => isDash
    ? [item?.base_url, item?.baseUrl, ...(Array.isArray(item?.backup_url) ? item.backup_url.slice(0, 8) : []), ...(Array.isArray(item?.backupUrl) ? item.backupUrl.slice(0, 8) : [])]
    : [item?.url, ...(Array.isArray(item?.backup_url) ? item.backup_url.slice(0, 8) : []), ...(Array.isArray(item?.backupUrl) ? item.backupUrl.slice(0, 8) : [])]

const registerSignedRouteGroup = (item, isDash, kind = 'video', source = 'trusted-api') => {
    if (!item || poolChars >= POOL_URL_CHARS_MAX) return null
    const primary = rawUrls(item, isDash).find(value => typeof value === 'string' && value)
    if (!parseEligibleUrl(primary)) return null
    kind = ['video','audio','muxed'].includes(kind) ? kind : 'unknown'
    const groupLimit = kind === 'video' ? VIDEO_GROUP_LIMIT : AUDIO_GROUP_LIMIT
    if ([...groups.values()].filter(group => group.kind === kind).length >= groupLimit) return null
    const codec = deps.normalizeCodecName?.(item) || 'other'
    const urls = rawUrls(item, isDash).map(parseEligibleUrl).filter(Boolean)
    if (source === 'page-hint') {
        const existing = urls.map(route => pageExact.get(route.url)).filter(Boolean)
        if (existing.length) {
            for (const id of existing) {
                const old = groups.get(id)
                if (old && (old.kind !== kind || old.height !== int(item.height, 10000)
                    || old.codec !== codec || old.bandwidth !== finite(item.bandwidth, 0, 1e10)
                    || urls.some(route => !old.routes.some(prior => prior.url === route.url)))) old.ambiguous = true
            }
            return null
        }
        // Page input cannot replace a group admitted by an intercepted API.
        if (urls.some(route => identityGroups.has(route.identity))) return null
    }
    const group = {
        id: `${deps.playinfoEpoch}:${kind}:${++candidateSerial}`,
        epoch: deps.playinfoEpoch, kind, height: int(item.height, 10000), codec,
        bandwidth: finite(item.bandwidth, 0, 1e10), originalOrder: ++groupSeq,
        source, unlocked: new Set(), ambiguous: false, generatedUrls: new Set(), verifiedCatalogUrls: new Set(),
        routes: [], rootOriginal: null, verifiedSample: null, invalidHosts: new Set(),
        catalogSample: null,
        currentRouteType: 'unknown', currentHost: null,
        catalogFallback: null, transportEvidence: new Map(), revision: ++routeRevision,
        isDash: !!isDash,
    }
    const seenHosts = new Set()
    let touchedLedger = false
    for (const url of rawUrls(item, isDash)) {
        const parsed = parseEligibleUrl(url)
        if (!parsed || poolChars + parsed.url.length > POOL_URL_CHARS_MAX) continue
        if (seenHosts.has(parsed.host) || group.routes.length >= GROUP_ROUTE_LIMIT) continue
        if (!group.rootOriginal) group.rootOriginal = parsed.url
        seenHosts.add(parsed.host); poolChars += parsed.url.length
        group.routes.push({ ...parsed, order: group.routes.length })
        deps.noteHostDiscovery?.(parsed.host)
        protectedUrls.add(parsed.url)
        if (source === 'page-hint') pageExact.set(parsed.url, group.id)
        else if (!identityGroups.has(parsed.identity)) identityGroups.set(parsed.identity, group.id)
        else if (identityGroups.get(parsed.identity) !== group.id) identityGroups.set(parsed.identity, null)
        const ledgerKind = kind === 'audio' ? 'audio' : 'video'
        const historical = ledgers[ledgerKind].get(parsed.host)
        if (historical && source !== 'page-hint') { historical.lastSeen = Date.now(); touchedLedger = true }
    }
    if (!group.routes.length) return null
    groups.set(group.id, group)
    if (touchedLedger) scheduleSave()
    return group.id
}
const groupForUrl = url => {
    const parsed = parseEligibleUrl(url)
    const id = parsed && (identityGroups.get(parsed.identity) || pageExact.get(parsed.url) || generatedExact.get(parsed.url))
    const group = id && groups.get(id)
    return group && !group.ambiguous ? group : null
}
const captureRouteContext = url => {
    const group = groupForUrl(url)
    return group ? { groupId: group.id, epoch: group.epoch, revision: group.revision,
        source: group.source, requestedUrl: parseEligibleUrl(url)?.url,
        generated: group.generatedUrls.has(parseEligibleUrl(url)?.url) } : null
}
const routeContextActive = context => !!context && context.epoch === deps.playinfoEpoch
    && groups.has(context.groupId) && !groups.get(context.groupId).ambiguous
const findNative = (group, host) => group?.routes.find(route => route.host === host && !deps.TRUSTED_CDN_CATALOG_SET.has(host)) || null
const routeEligible = (group, route) => !!group && !group.ambiguous && !!route
    && (!deps.isHostAllowed || deps.isHostAllowed(route.host))
    && (group.source !== 'page-hint' || group.unlocked.has(route.url))
const pageRepresentation = context => {
    const route = context?.route || context
    if (!routeContextActive(route)) return null
    const group = groups.get(route.groupId)
    const catalogVerified = !!context?.pageCatalogCompleted && !!group.catalogSample
        && group.verifiedCatalogUrls.has(group.catalogSample)
    if (group.source !== 'page-hint'
        || (!group.unlocked.has(route.requestedUrl) && !catalogVerified)) return null
    return { kind: group.kind, height: group.height, bandwidth: group.bandwidth, codec: group.codec, source: 'page-hint' }
}

const rememberGeneratedUrl = (group, url) => {
    const parsed = parseEligibleUrl(url)
    if (!group || !parsed || !deps.TRUSTED_CDN_CATALOG_SET.has(parsed.host)) return null
    // A generated Catalog URL must retain the exact representation identity.
    // This map only restores provenance; it does not unlock the page URL or
    // grant Native admission/probe authority.
    if (!group.routes.some(route => route.identity === parsed.identity)) return null
    const prior = generatedExact.get(parsed.url)
    if (prior && prior !== group.id) { group.ambiguous = true; return null }
    group.generatedUrls.add(parsed.url)
    generatedExact.set(parsed.url, group.id)
    protectedUrls.add(parsed.url)
    return parsed.url
}

const setItemUrls = (item, isDash, primary, backups) => {
    if (deps.isHostAllowed) {
        const permitted = value => !!value && deps.isHostAllowed(deps.parseMediaHttpUrl(value)?.hostname)
        const urls = [...new Set([primary, ...backups].filter(permitted))]
        primary = urls.shift() || ''; backups = urls
    }
    if (isDash) {
        item.base_url = primary; item.baseUrl = primary
        item.backup_url = backups; item.backupUrl = backups
    } else {
        item.url = primary; item.backup_url = backups; if ('backupUrl' in item) item.backupUrl = backups
    }
}
const setPlannedAffinity = (next, reason, enforced = false) => {
    if (!next?.host || !['catalog-generated','native-signed'].includes(next.type)) return
    const changed = !plannedAffinity || plannedAffinity.type !== next.type || plannedAffinity.host !== next.host
        || !!plannedAffinity.enforced !== !!enforced
    plannedAffinity = { type: next.type, host: next.host, setAt: Date.now(), reason, enforced: !!enforced }
    if (changed) {
        lastPlannedRoute = { ...plannedAffinity, revision: ++routeRevision }
    }
}
const usableGroupSample = (group, requestedUrl = null) => {
    if (!group || group.ambiguous) return null
    if (group.source !== 'page-hint') return group.rootOriginal
    const sample = requestedUrl || group.verifiedSample || group.catalogSample
    if (group.unlocked.has(sample) && group.routes.some(route => route.url === sample)) return sample
    return group.verifiedCatalogUrls.has(sample) && group.generatedUrls.has(sample) ? sample : null
}
const catalogUrlFor = (group, host, requestedUrl = null, allowPendingExact = false) => {
    if (deps.isHostAllowed && !deps.isHostAllowed(host)) return null
    let sample = usableGroupSample(group, requestedUrl)
    if (!sample && allowPendingExact && group?.source === 'page-hint') {
        const parsed = parseEligibleUrl(requestedUrl)
        if (parsed && (group.routes.some(route => route.url === parsed.url)
            || group.generatedUrls.has(parsed.url))) sample = parsed.url
    }
    if (!sample || !deps.TRUSTED_CDN_CATALOG_SET.has(host)) return null
    try { return deps.replaceUrlHost?.(sample, host) || null } catch { return null }
}
const applySignedRoutePlan = (item, isDash, groupId) => {
    const group = groups.get(groupId)
    if (!group) return null
    if (group.source === 'page-hint' && !deps.resolvedCdn) {
        if (deps.isHostAllowed) {
            const raw = rawUrls(item, isDash)
            const first = raw[0]
            const decision = first && resolveRequestRoute(first, { route: captureRouteContext(first) })
            setItemUrls(item, isDash, decision?.action === 'block' ? '' : decision?.url || first, raw.slice(1))
            const emitted = rawUrls(item, isDash)[0]
            if (decision?.type === 'catalog-generated' && emitted) rememberGeneratedUrl(group, emitted)
        }
        return null
    }
    const transformed = rawUrls(item, isDash).filter(value => typeof value === 'string')
    const legacyPrimary = deps.replaceUrlHost?.(group.rootOriginal, deps.resolvedCdn || deps.peekCurrentCdn()) || group.rootOriginal
    const legacyHost = (() => { try { return new URL(legacyPrimary).hostname } catch { return null } })()
    group.catalogFallback = deps.TRUSTED_CDN_CATALOG_SET.has(legacyHost) ? legacyHost : deps.peekCurrentCdn()
    let primary = legacyPrimary
    let primaryType = deps.TRUSTED_CDN_CATALOG_SET.has(legacyHost) ? 'catalog-generated' : 'root-original'
    let primaryHost = legacyHost
    const ledgerKind = group.kind === 'audio' ? 'audio' : 'video'
    const chooseRatedNative = () => {
        const required = deps.getRequiredStreamMbps(undefined, 'startup')
        const catalogScore = group.catalogFallback ? deps.getCdnHealthScore(group.catalogFallback, { exploit: true }) : 0
        const eligible = group.routes
            .filter(route => routeEligible(group, route) && !deps.TRUSTED_CDN_CATALOG_SET.has(route.host) && !group.invalidHosts.has(route.host))
            .map(route => ({ route, record: recordFor(ledgerKind, route.host) }))
            .filter(entry => routeState(ledgerKind, entry.route.host, group) !== 'unknown' && !isSoftBlocked(entry.record))
            .map(entry => ({ ...entry, score: scoreRecord(entry.record, required) }))
            .sort((a, b) => b.score - a.score || a.route.order - b.route.order)
        const chosen = eligible[0]
        return chosen && chosen.score >= catalogScore + STICKY_MARGIN ? chosen.route : null
    }
    if (!deps.resolvedCdn) {
        if (group.kind === 'video' && plannedAffinity) {
            if (plannedAffinity.type === 'native-signed') {
                const retained = findNative(group, plannedAffinity.host)
                if (retained && routeEligible(group, retained) && !group.invalidHosts.has(retained.host)) {
                    primary = retained.url; primaryType = 'native-signed'; primaryHost = retained.host
                } else {
                    // A Native affinity cannot be synthesized for a representation that did
                    // not receive that exact signed host. Downgrade the epoch to one Catalog
                    // affinity so returning to an earlier group cannot bounce back to Native.
                    const fallback = group.catalogFallback || deps.peekCurrentCdn()
                    if (fallback) setPlannedAffinity({ type: 'catalog-generated', host: fallback }, 'native-unavailable', true)
                    const catalogUrl = catalogUrlFor(group, fallback)
                    if (catalogUrl) { primary = catalogUrl; primaryType = 'catalog-generated'; primaryHost = fallback }
                    suppressedSwitches.representation++
                }
            } else {
                const catalogUrl = catalogUrlFor(group, plannedAffinity.host)
                if (catalogUrl) { primary = catalogUrl; primaryType = 'catalog-generated'; primaryHost = plannedAffinity.host }
            }
        } else {
            const chosen = chooseRatedNative()
            if (chosen) { primary = chosen.url; primaryType = 'native-signed'; primaryHost = chosen.host }
            if (group.kind === 'video') {
                const host = primaryType === 'native-signed' ? primaryHost : (group.catalogFallback || primaryHost)
                const type = primaryType === 'native-signed' ? primaryType : 'catalog-generated'
                if (host) setPlannedAffinity({ type, host }, 'new-playinfo')
            }
        }
    }
    const catalogBackups = (deps.buildBackupUrls?.(group.rootOriginal, primary) || transformed.slice(1)).filter(url => {
        try { return deps.TRUSTED_CDN_CATALOG_SET.has(new URL(url).hostname) } catch { return false }
    }).slice(0, 2)
    const nativeBackups = group.routes.filter(route => !deps.TRUSTED_CDN_CATALOG_SET.has(route.host) && route.url !== primary)
        .sort((a, b) => {
            const ar = recordFor(group.kind === 'audio' ? 'audio' : 'video', a.host)
            const br = recordFor(group.kind === 'audio' ? 'audio' : 'video', b.host)
            return scoreRecord(br, deps.getRequiredStreamMbps(undefined, 'startup')) - scoreRecord(ar, deps.getRequiredStreamMbps(undefined, 'startup')) || a.order - b.order
        }).slice(0, 2).map(route => route.url)
    if (deps.isHostAllowed && !deps.isHostAllowed(primaryHost)) {
        const replacement = resolveRequestRoute(primary, { route: captureRouteContext(group.rootOriginal) })
        primary = replacement.action === 'block' ? '' : replacement.url
    }
    const backups = [...new Set([...catalogBackups, ...nativeBackups, group.rootOriginal].filter(url => url && url !== primary))]
    setItemUrls(item, isDash, primary, backups)
    primary = rawUrls(item, isDash)[0] || ''
    primaryHost = deps.parseMediaHttpUrl(primary)?.hostname || null
    primaryType = !primaryHost ? 'unknown' : deps.TRUSTED_CDN_CATALOG_SET.has(primaryHost)
        ? (primary === group.rootOriginal ? 'root-original' : 'catalog-generated') : 'native-signed'
    if (plannedAffinity && deps.isHostAllowed && !deps.isHostAllowed(plannedAffinity.host)) {
        plannedAffinity = null
        if (primaryHost && group.kind === 'video') setPlannedAffinity({ type: primaryType, host: primaryHost }, 'host-restricted')
    }
    for (const url of rawUrls(item, isDash)) {
        protectedUrls.add(url)
        if (!group.routes.some(route => route.url === url)
            && deps.TRUSTED_CDN_CATALOG_SET.has(deps.parseMediaHttpUrl(url)?.hostname)) rememberGeneratedUrl(group, url)
    }
    deps.preserveOriginalFallback?.(backups, group.rootOriginal, primary)
    group.currentRouteType = primaryType; group.currentHost = primaryHost; group.revision = ++routeRevision
    return { groupId, primaryType, primaryHost, catalogFallback: group.catalogFallback, revision: group.revision }
}
// Media excluded from Native admission (e.g. PCDN) still uses catalog policy.
const planUnregisteredItem = (item, isDash, trusted) => {
    if (!item) return
    if (!trusted) { if (deps.isHostAllowed) setItemUrls(item, isDash, rawUrls(item, isDash)[0], rawUrls(item, isDash).slice(1)); return }
    const original = rawUrls(item, isDash).find(value => typeof value === 'string')
    const primary = original && deps.replaceUrlHost?.(original, deps.resolvedCdn || deps.peekCurrentCdn())
    if (!primary) { if (deps.isHostAllowed) setItemUrls(item, isDash, original, rawUrls(item, isDash).slice(1)); return }
    const backups = deps.preserveOriginalFallback?.(deps.buildBackupUrls?.(original, primary) || [], original, primary) || []
    setItemUrls(item, isDash, primary, backups)
}

const resolveRequestRouteUnchecked = (url, context) => {
    const routeContext = context?.route || (context?.groupId ? context : null)
    if (!routeContextActive(routeContext)) {
        const parsed = parseEligibleUrl(url)
        // Lost/ambiguous evidence is an explicit pass, never legacy rewrite authority.
        if (routeContext || (parsed && (pageExact.has(parsed.url) || identityGroups.has(parsed.identity)))) {
            const decision = deps.decideMediaRewrite?.(url, true)
            const restored = decision?.action === 'restore' ? decision.url : url
            const fixed = deps.resolvedCdn && deps.replaceUrlHost?.(restored, deps.resolvedCdn)
            return { url: fixed || restored, host: deps.parseMediaHttpUrl(fixed || restored)?.hostname || null,
                type: fixed ? 'catalog-generated' : 'root-original', action: fixed ? 'rewrite' : restored !== url ? 'restore' : 'pass' }
        }
        const norm = deps.normalizeMediaUrl?.(url)
        return norm ? { ...norm, host: norm.targetCdn || norm.originCdn, type: norm.changed && !norm.restoredOriginal ? 'catalog-generated' : 'root-original',
            action: norm.restoredOriginal ? 'restore' : norm.changed ? 'rewrite' : 'pass' } : null
    }
    const group = groups.get(routeContext.groupId)
    const requested = parseEligibleUrl(url)
    const pass = { url, host: requested?.host || null, type: 'root-original', action: 'pass', groupId: group.id, revision: group.revision }
    const restored = deps.decideMediaRewrite?.(url, true)
    if (restored && restored.action !== 'rewrite') return { ...pass, url: restored.url,
        host: deps.parseMediaHttpUrl(restored.url)?.hostname || pass.host, action: restored.action }
    if (deps.resolvedCdn) {
        const fixed = deps.replaceUrlHost?.(url, deps.resolvedCdn)
        return fixed ? { ...pass, url: fixed, host: deps.resolvedCdn, type: 'catalog-generated', action: 'rewrite' } : pass
    }
    if (group.source === 'page-hint' && (!requested
        || (!group.unlocked.has(requested.url) && !group.verifiedCatalogUrls.has(requested.url)))
        && !plannedAffinity?.enforced) return pass
    const exactSignedRoute = requested
        ? group.routes.find(route => route.url === requested.url) || null
        : null

    // The player may explicitly consume one of the exact signed backups that
    // arrived in playurl.  That is a browser/player fallback, not permission for
    // this script to synthesize another host.  Preserve it unless a verified
    // recovery boundary has marked that exact host as the route to avoid.
    if (exactSignedRoute && !plannedAffinity?.enforced && !avoidedHosts.has(exactSignedRoute.host)
        && plannedAffinity?.type !== 'native-signed'
        && (!plannedAffinity || exactSignedRoute.host !== plannedAffinity.host)) {
        return { url: exactSignedRoute.url, host: exactSignedRoute.host, type: 'root-original',
            groupId: group.id, revision: group.revision }
    }
    if (group.kind === 'video' && plannedAffinity) {
        if (plannedAffinity.type === 'native-signed') {
            const selected = findNative(group, plannedAffinity.host)
            if (!selected || !routeEligible(group, selected) || group.invalidHosts.has(selected.host)) return pass
            return { url: selected.url, host: selected.host, type: 'native-signed', groupId: group.id, revision: group.revision }
        }
        const target = catalogUrlFor(group, plannedAffinity.host,
            group.source === 'page-hint' ? requested?.url : null, !!plannedAffinity.enforced)
        if (target) return { url: target, host: plannedAffinity.host, type: 'catalog-generated', groupId: group.id, revision: group.revision }
    }
    const selected = findNative(group, group.currentRouteType === 'native-signed' ? group.currentHost : null)
    return selected && !group.invalidHosts.has(selected.host)
        ? { url: selected.url, host: selected.host, type: 'native-signed', groupId: group.id, revision: group.revision }
        : pass
}
// Every exit, including original, stale context and legacy normalization, passes
// through this destination gate. Signed provenance never overrides a restriction.
const resolveRequestRoute = (url, context) => {
    const decision = resolveRequestRouteUnchecked(url, context)
    if (!deps.isHostAllowed || deps.disabled) return decision
    const effective = decision?.url || url
    const host = deps.parseMediaHttpUrl(effective)?.hostname
    if (deps.isHostAllowed(host)) {
        const sourceHost = deps.parseMediaHttpUrl(url)?.hostname
        if (sourceHost && !deps.isHostAllowed(sourceHost)) deps.noteHostRestriction?.(sourceHost, host)
        return decision
    }
    const rc = context?.route || (context?.groupId ? context : null)
    const group = routeContextActive(rc) ? groups.get(rc.groupId) : null
    const catalog = [...new Set([deps.resolvedCdn, ...(deps.getHealthyCdnList?.() || []), deps.peekCurrentCdn()])]
        .filter(h => h && deps.isHostAllowed(h) && deps.TRUSTED_CDN_CATALOG_SET.has(h))
    // Only replace a host through the existing signed/path guard. In particular
    // host-lock restore must not cause a retry of the forbidden original.
    for (const target of catalog) {
        const next = deps.replaceUrlHost?.(url, target)
        const actual = next && deps.parseMediaHttpUrl(next)?.hostname
        if (next && deps.isHostAllowed(actual)) {
            if (group?.kind === 'video') setPlannedAffinity({ type: 'catalog-generated', host: actual }, 'host-restricted')
            deps.noteHostRestriction?.(host, actual)
            return { url: next, host: actual, type: 'catalog-generated', action: 'rewrite', groupId: group?.id }
        }
    }
    const native = group?.routes.find(r => routeEligible(group, r) && !group.invalidHosts.has(r.host))
    if (native) {
        deps.noteHostRestriction?.(host, native.host)
        const type = deps.TRUSTED_CDN_CATALOG_SET.has(native.host) ? 'root-original' : 'native-signed'
        if (group.kind === 'video') setPlannedAffinity({ type, host: native.host }, 'host-restricted')
        return { url: native.url, host: native.host, type, groupId: group.id }
    }
    deps.noteHostRestriction?.(host, null)
    return { url, host, type: 'blocked', action: 'block', reason: 'host-restricted' }
}
const isProtectedSignedUrl = url => {
    try { return protectedUrls.has(deps.parseMediaHttpUrl(url)?.href) } catch { return false }
}

const ensureRecordFromTransport = (kind, host) => {
    const ledgerKind = kind === 'audio' ? 'audio' : 'video'
    let record = ledgers[ledgerKind].get(host)
    if (!record) { record = emptyRecord(host); ledgers[ledgerKind].set(host, record) }
    return record
}
const activateGroup = (group, reason) => {
    if (!group || group.kind !== 'video') return
    if (!activeRepresentation || activeRepresentation.groupId !== group.id) {
        const switched = !!activeRepresentation
        activeRepresentation = { groupId: group.id, height: group.height, codec: group.codec, bandwidth: group.bandwidth,
            revision: ++representationRevision, confirmedAt: Date.now(), reason }
        lastAutoQualityReason = reason
        deps.onActiveRepresentation?.(usableGroupSample(group), group.id, { switched })
    }
    tentativeRepresentation = null
}
const observeAffinity = (group, parsed, source, context) => {
    if (!group || group.kind !== 'video' || activeRepresentation?.groupId !== group.id || !parsed?.host) return
    const type = context?.routeDecision?.changed && context.routeDecision.host === parsed.host
        ? context.routeDecision.type : context?.route?.generated && group.generatedUrls.has(parsed.url)
            ? 'catalog-generated' : 'root-original'
    if (!routeAffinity || routeAffinity.host !== parsed.host || routeAffinity.type !== type) {
        const priorHost = routeAffinity?.host || lastObservedRoute?.host
        const hostChanged = !!priorHost && priorHost !== parsed.host
        if (hostChanged) observedHostChanges = Math.min(1000000, observedHostChanges + 1)
        routeAffinity = { type, host: parsed.host, confirmedAt: Date.now(), source }
        lastObservedRoute = { ...routeAffinity, revision: routeRevision,
            reason: hostChanged ? 'observed-host-change' : lastObservedRoute ? 'provenance-update' : 'first-observation', metadataSource: group.source }
        // Observation confirms what happened on the wire; it does not itself
        // grant authority to change the route plan.  Only the initial epoch or a
        // verified recovery boundary may replace plannedAffinity.
    }
    routeAffinity.confirmedAt = Date.now()
}
const getObservedRouteHost = () => !deps.disabled && routeAffinity && Date.now() - routeAffinity.confirmedAt <= 30000 ? routeAffinity.host : null
const observeTransport = (context, url, bytes, source) => {
    const routeContext = context?.route
    if (!routeContextActive(routeContext) || !Number.isSafeInteger(bytes) || bytes <= 0 || !['xhr','fetch'].includes(source)) return
    const group = groups.get(routeContext.groupId)
    const parsed = parseEligibleUrl(url)
    if (!group || !parsed) return
    if (group.source === 'page-hint' && (!context.pageCompleted
        || (!context.pageCatalogCompleted && (routeContext.requestedUrl !== parsed.url || !group.unlocked.has(parsed.url))))) return
    const route = findNative(group, parsed.host)
    if (group.kind === 'video') {
        let matchesHeight = false
        try { const video = deps.getVideo?.(); matchesHeight = !!(video?.videoHeight && group.height && Math.abs(video.videoHeight - group.height) <= 16) } catch {}
        const now = Date.now(), prior = group.transportEvidence.get(parsed.host)
        const evidence = prior && now - prior.firstAt <= 8000 ? prior : { firstAt: now, count: 0, bytes: 0 }
        if (context.nativeActiveCounted !== group.id) {
            context.nativeActiveCounted = group.id
            evidence.count++
            consecutiveVideoEvidence = consecutiveVideoEvidence.groupId === group.id
                ? { groupId: group.id, count: consecutiveVideoEvidence.count + 1 }
                : { groupId: group.id, count: 1 }
        }
        evidence.bytes += bytes; evidence.lastAt = now; group.transportEvidence.set(parsed.host, evidence)
        tentativeRepresentation = { groupId: group.id, height: group.height, codec: group.codec, reason: matchesHeight ? 'height-match' : 'transport-observed' }
        if (!activeRepresentation) {
            if (matchesHeight || consecutiveVideoEvidence.count >= 2) {
                activateGroup(group, matchesHeight ? 'initial-height-match' : 'initial-two-video-transfers')
            }
        } else if (activeRepresentation.groupId === group.id) {
            tentativeRepresentation = null
        } else {
            const sameHeight = activeRepresentation.height === group.height
            if (consecutiveVideoEvidence.count >= 2) {
                activateGroup(group, sameHeight ? 'consecutive-same-height-transfers' : 'consecutive-video-transfers')
            }
        }
        observeAffinity(group, parsed, source, context)
    }
    if (!route) return
}

const updateThroughput = (kind, host, bytes, durationMs, playbackRate, source) => {
    if (!Number.isSafeInteger(bytes) || bytes < MIN_SAMPLE_BYTES || !Number.isFinite(durationMs) || durationMs < MIN_SAMPLE_MS) return { accepted: false, status: 'insufficient' }
    const ledgerKind = kind === 'audio' ? 'audio' : 'video'
    let record = ledgers[ledgerKind].get(host)
    if (!record && isKnownFamily(host)) record = recordFor(ledgerKind, host, true)
    if (!record) return { accepted: false, status: 'untrusted' }
    const mbps = bytes * 8 / durationMs / 1000
    if (!Number.isFinite(mbps) || mbps <= 0) return { accepted: false, status: 'ineligible' }
    if (record.samples) {
        const diff = mbps - record.ewmaMbps, incr = ALPHA * diff
        record.ewmaMbps += incr
        record.varMbps = (1 - ALPHA) * ((record.varMbps || 0) + diff * incr)
    } else { record.ewmaMbps = mbps; record.varMbps = 0 }
    record.samples = Math.min(12, record.samples + 1)
    if (source === 'probe') record.probeSamples = Math.min(12, record.probeSamples + 1)
    const required = deps.getRequiredStreamMbps(playbackRate, 'steady')
    if (mbps < required) { record.slowSamples = Math.min(3, record.slowSamples + 1); record.lastSlowAt = Date.now() }
    else record.slowSamples = Math.max(0, record.slowSamples - 1)
    record.lastThroughputAt = record.lastSeen = Date.now(); scheduleSave()
    return { accepted: true, status: 'throughput', mbps, bytes, durationMs }
}
const recordNativeThroughput = (context, url, bytes, durationMs, playbackRate, source = 'transport') => {
    const routeContext = context?.route
    if (!routeContextActive(routeContext)) return { accepted: false, status: 'stale' }
    const group = groups.get(routeContext.groupId), parsed = parseEligibleUrl(url)
    if (!group || !parsed) return { accepted: false, status: 'not-native' }
    if (group.source === 'page-hint') {
        if (context.httpMethod !== 'GET') return { accepted: false, status: 'unverified-method' }
        // A successful script-generated Catalog request proves the emitted
        // representation route even when the excluded original URL was never
        // allowed to complete. Keep Native unlock separate: the original signed
        // URL remains pending and gains no rating/probe authority.
        const requested = parseEligibleUrl(routeContext.requestedUrl)
        const emittedCatalog = routeContext.generated && requested?.url === parsed.url
            && group.generatedUrls.has(parsed.url)
        const rewrittenCatalog = requested && group.routes.some(route => route.url === requested.url)
            && context.routeDecision?.changed && context.routeDecision.type === 'catalog-generated'
            && context.routeDecision.host === parsed.host
            && deps.replaceUrlHost?.(requested.url, parsed.host) === parsed.url
        if (source === 'transport' && deps.TRUSTED_CDN_CATALOG_SET.has(parsed.host)
            && (emittedCatalog || rewrittenCatalog) && Number.isSafeInteger(bytes) && bytes > 0) {
            rememberGeneratedUrl(group, parsed.url)
            group.verifiedCatalogUrls.add(parsed.url); group.catalogSample = parsed.url
            routeContext.generated = true
            context.pageCompleted = true; context.pageCatalogCompleted = true
            observeTransport(context, parsed.url, bytes, context.method || 'fetch')
            if (group.kind === 'video' && activeRepresentation?.groupId === group.id) scheduleStartupSample(parsed.url)
            return { accepted: false, status: 'catalog-observed' }
        }
        if (source !== 'transport' || routeContext.requestedUrl !== parsed.url || !isKnownFamily(parsed.host)
            || !Number.isSafeInteger(bytes) || bytes <= 0 || !group.routes.some(route => route.url === parsed.url)) return { accepted: false, status: 'unverified' }
        group.unlocked.add(parsed.url); group.verifiedSample = parsed.url; context.pageCompleted = true
        observeTransport(context, parsed.url, bytes, context.method || 'fetch')
        if (!plannedAffinity && activeRepresentation?.groupId === group.id) {
            plannedAffinity = { type: deps.TRUSTED_CDN_CATALOG_SET.has(parsed.host) ? 'catalog-generated' : 'native-signed',
                host: parsed.host, reason: 'observed-original', setAt: Date.now() }
        }
        if (group.kind === 'video' && activeRepresentation?.groupId === group.id) scheduleStartupSample(parsed.url)
    }
    if (!findNative(group, parsed.host)) return { accepted: false, status: 'not-native' }
    if (context.nativeCompletionRecorded === `${group.id}:${parsed.host}`) return { accepted: false, status: 'duplicate' }
    if (source === 'transport') {
        context.nativeCompletionRecorded = `${group.id}:${parsed.host}`
        const kind = group.kind === 'audio' ? 'audio' : 'video'
        const record = ensureRecordFromTransport(kind, parsed.host)
        record.transportSamples = Math.min(12, record.transportSamples + 1)
        record.successes = Math.min(12, record.successes + 1)
        record.failures = Math.max(0, record.failures - 1)
        record.lastSuccessAt = record.lastSeen = Date.now()
        // An in-flight success is evidence, not permission to lift a restriction.
        scheduleSave()
    }
    return updateThroughput(group.kind, parsed.host, bytes, durationMs, playbackRate, source)
}
const recordNativeLatency = (groupId, host, latencyMs) => {
    const group = groups.get(groupId), route = findNative(group, host)
    if (!group || !route || !Number.isFinite(latencyMs) || latencyMs <= 0) return false
    const kind = group.kind === 'audio' ? 'audio' : 'video'
    const record = recordFor(kind, host, isKnownFamily(host))
    if (!record) return false
    record.latencyMs = record.latencyMs ? record.latencyMs * 0.65 + latencyMs * 0.35 : latencyMs
    record.lastLatencyAt = record.lastSeen = Date.now(); scheduleSave(); return true
}
const noteNativeFailure = (context, url, status = 0, failureKind = 'http') => {
    const routeContext = context?.route
    if (!routeContextActive(routeContext)) return false
    const group = groups.get(routeContext.groupId), parsed = parseEligibleUrl(url)
    if (!group || !parsed || !findNative(group, parsed.host)) return false
    if (!routeEligible(group, group.routes.find(route => route.url === parsed.url))) return false
    if ([403,451,959].includes(+status)) {
        group.invalidHosts.add(parsed.host)
        avoidedHosts.add(parsed.host)
        if (group.currentHost === parsed.host) {
            group.currentRouteType = 'catalog-generated'; group.currentHost = group.catalogFallback
        }
        if (plannedAffinity?.host === parsed.host) {
            const fallback = group.catalogFallback || deps.peekCurrentCdn()
            if (fallback) setPlannedAffinity({ type: 'catalog-generated', host: fallback }, 'native-invalid', true)
        }
        if (routeAffinity?.host === parsed.host) routeAffinity = null
        group.revision = ++routeRevision
        return true
    }
    if (!(+status >= 500 || ['network-error','body-error','timeout'].includes(failureKind))) return false
    const kind = group.kind === 'audio' ? 'audio' : 'video'
    const record = recordFor(kind, parsed.host, isKnownFamily(parsed.host))
    if (!record) return false
    record.failures = Math.min(3, record.failures + 1); record.softBlockedUntil = Date.now() + SOFT_BLOCK_MS
    record.lastFailureAt = record.lastSeen = Date.now(); scheduleSave()
    beginRouteRecovery('verified-native-failure', parsed.host)
    return true
}

const chooseRecoveryRoute = (group, failedHost) => {
    const fallback = [deps.resolvedCdn, deps.peekCurrentCdn(), group?.catalogFallback]
        .find(host => host && (!deps.isHostAllowed || deps.isHostAllowed(host))) || null
    if (!group || group.kind !== 'video' || deps.resolvedCdn) {
        return fallback ? { type: 'catalog-generated', host: fallback } : null
    }
    const required = deps.getRequiredStreamMbps(undefined, 'steady')
    const catalogScore = fallback ? deps.getCdnHealthScore(fallback, { exploit: true }) : 0
    const native = group.routes
        .filter(route => routeEligible(group, route) && route.host !== failedHost && !deps.TRUSTED_CDN_CATALOG_SET.has(route.host)
            && !group.invalidHosts.has(route.host))
        .map(route => ({ route, record: recordFor('video', route.host) }))
        .filter(entry => entry.record && routeState('video', entry.route.host, group) !== 'unknown'
            && !isSoftBlocked(entry.record))
        .map(entry => ({ ...entry, score: scoreRecord(entry.record, required) }))
        .sort((a, b) => b.score - a.score || a.route.order - b.route.order)[0]
    if (native && (!fallback || native.score >= catalogScore + STICKY_MARGIN)) {
        return { type: 'native-signed', host: native.route.host }
    }
    return fallback ? { type: 'catalog-generated', host: fallback } : null
}

const beginRouteRecovery = (reason, failedHost = null) => {
    const host = safeHost(failedHost)
    if (host) avoidedHosts.add(host)
    const group = activeRepresentation?.groupId ? groups.get(activeRepresentation.groupId) : null
    const next = chooseRecoveryRoute(group, host)
    lastRouteBoundary = { reason: String(reason || 'recovery').slice(0, 48), failedHost: host || null,
        at: Date.now(), adopted: next ? { ...next } : null }
    routeAffinity = null
    if (!next) { plannedAffinity = null; routeRevision++; return null }
    setPlannedAffinity(next, lastRouteBoundary.reason, true)
    if (group) {
        group.currentRouteType = next.type
        group.currentHost = next.host
        group.revision = routeRevision
    }
    return { ...next }
}

const getActiveGroup = sampleUrl => {
    if (activeRepresentation?.groupId && groups.has(activeRepresentation.groupId)) return groups.get(activeRepresentation.groupId)
    return null
}
const canUseRouteSample = url => {
    const group = getActiveGroup(url), parsed = parseEligibleUrl(url)
    return !!group && !!parsed && !group.ambiguous && group.epoch === deps.playinfoEpoch
        && group.routes.some(route => route.url === parsed.url && routeEligible(group, route))
}
// Preserve the legacy unregistered Catalog sample path, but never let its URL
// family shortcut grant authority to pending/ambiguous page candidates. Captured
// context prevents a queued probe from reinterpreting a deleted group as legacy.
const isRouteSampleAllowed = (url, context = null) => {
    const parsed = parseEligibleUrl(url)
    if (context && !routeContextActive(context)) return false
    const known = parsed && (pageExact.has(parsed.url) || generatedExact.has(parsed.url) || identityGroups.has(parsed.identity))
    const group = context ? groups.get(context.groupId) : groupForUrl(url)
    if (group) {
        if (!parsed || group.ambiguous || group.epoch !== deps.playinfoEpoch) return false
        return group.source === 'page-hint'
            ? (group.unlocked.has(parsed.url) && group.routes.some(route => route.url === parsed.url))
                || (group.verifiedCatalogUrls.has(parsed.url) && group.generatedUrls.has(parsed.url))
            : group.routes.some(route => route.identity === parsed.identity)
    }
    return !known && !!deps.isBiliVideoUrl?.(url)
}
const getNativeProbeCandidate = sampleUrl => {
    if (deps.resolvedCdn || deps.disabled) return null
    const group = getActiveGroup(sampleUrl)
    if (!group || group.epoch !== deps.playinfoEpoch) return null
    const kind = 'video'
    const now = Date.now()
    const candidates = group.routes.filter(route => routeEligible(group, route) && !deps.TRUSTED_CDN_CATALOG_SET.has(route.host)
        && !group.invalidHosts.has(route.host) && (isKnownFamily(route.host) || recordFor(kind, route.host)?.transportSamples > 0))
        .filter(route => !isSoftBlocked(recordFor(kind, route.host)))
        .filter(route => {
            const record = recordFor(kind, route.host)
            return !(record?.samples && record.lastThroughputAt && now - record.lastThroughputAt < SAMPLE_FRESH_MS)
        })
        .sort((a, b) => {
            const ar = recordFor(kind, a.host), br = recordFor(kind, b.host)
            const au = !ar?.samples, bu = !br?.samples
            if (au !== bu) return au ? -1 : 1
            return (ar?.lastThroughputAt || 0) - (br?.lastThroughputAt || 0) || a.order - b.order
        })
    const route = candidates[0]
    return route ? { type: 'native-signed', groupId: group.id, epoch: group.epoch, host: route.host, url: route.url } : null
}
const recordNativeProbe = (candidate, result, latencyMs) => {
    const group = candidate && groups.get(candidate.groupId)
    if (!group || candidate.epoch !== deps.playinfoEpoch || !findNative(group, candidate.host)) return { accepted: false, status: 'stale' }
    if (!routeEligible(group, group.routes.find(route => route.url === candidate.url))) return { accepted: false, status: 'unverified' }
    if (latencyMs) recordNativeLatency(group.id, candidate.host, latencyMs)
    if (!result?.accepted) return result || { accepted: false, status: 'failed' }
    const sample = updateThroughput('video', candidate.host, result.bytes, result.durationMs, deps.playbackRateState.effectiveRate, 'probe')
    // A healthy-path probe is rating evidence only.  It may make this host
    // eligible at the next playinfo/recovery boundary, but it cannot rewrite the
    // next request in the currently playing representation.
    if (sample.accepted && wouldQualifyProbe(group, candidate.host, sample.mbps)) {
        suppressedSwitches.probeHealthy++
    }
    return sample
}
const wouldQualifyProbe = (group, host, mbps) => {
    if (!activeRepresentation || activeRepresentation.groupId !== group.id) return false
    const record = recordFor('video', host)
    const currentHost = group.currentHost || group.catalogFallback
    const current = currentHost && deps.cdnHealth[currentHost]
    const now = Date.now(), required = deps.getRequiredStreamMbps(undefined, 'startup')
    if (!record || !current || !current.samples || !current.lastThroughputAt || now - current.lastThroughputAt > SAMPLE_FRESH_MS) return false
    if (now - record.lastThroughputAt > SAMPLE_FRESH_MS || mbps < required * 1.5 || mbps < current.ewmaMbps * 1.6) return false
    const nativeScore = scoreRecord(record, deps.getRequiredStreamMbps(undefined, 'steady'))
    const currentScore = deps.getCdnHealthScore(currentHost, { exploit: true })
    if (nativeScore < currentScore + STICKY_MARGIN || isSoftBlocked(record)) return false
    return true
}
const setLastBakeoff = outcomes => {
    lastBakeoff = (Array.isArray(outcomes) ? outcomes : []).slice(0, 4).map(item => ({
        type: item.type === 'native-signed' ? 'native-signed' : 'catalog-generated',
        host: safeHost(item.host) || null,
        status: String(item.status || 'unknown').slice(0, 32),
        accepted: !!item.accepted,
    }))
}
const diagnostics = () => {
    const activeGroup = activeRepresentation && groups.get(activeRepresentation.groupId)
    const allNative = [...groups.values()].flatMap(group => group.routes.map(route => ({ group, route })))
        .filter(entry => !deps.TRUSTED_CDN_CATALOG_SET.has(entry.route.host))
    const counts = { unknown: 0, provisional: 0, probeQualified: 0, confirmed: 0, invalid: 0 }
    allNative.forEach(({ group, route }) => {
        const state = routeState(group.kind === 'audio' ? 'audio' : 'video', route.host, group)
        if (state === 'probe-qualified') counts.probeQualified++
        else counts[state]++
    })
    return {
        active: activeRepresentation ? { height: activeRepresentation.height, codec: activeRepresentation.codec,
            revision: activeRepresentation.revision, reason: activeRepresentation.reason } : null,
        tentative: tentativeRepresentation ? { height: tentativeRepresentation.height, codec: tentativeRepresentation.codec,
            reason: tentativeRepresentation.reason } : null,
        routeRevision, representationRevision, observedHostChanges,
        currentRouteType: routeAffinity?.type || plannedAffinity?.type || activeGroup?.currentRouteType || 'unknown',
        admission: { pageGroups: [...groups.values()].filter(g => g.source === 'page-hint').length,
            trustedGroups: [...groups.values()].filter(g => g.source !== 'page-hint').length,
            unlockedUrls: [...groups.values()].reduce((n,g) => n + g.unlocked.size, 0),
            catalogVerifiedUrls: [...groups.values()].reduce((n,g) => n + g.verifiedCatalogUrls.size, 0),
            pendingUrls: [...groups.values()].filter(g => g.source === 'page-hint').reduce((n,g) => n + g.routes.length - g.unlocked.size, 0),
            ambiguousGroups: [...groups.values()].filter(g => g.ambiguous).length,
            startupScheduled, waitingReason: !groups.size ? 'no-playinfo' : !activeRepresentation ? 'awaiting-video-completion' : 'active' },
        currentHost: routeAffinity?.host || plannedAffinity?.host || activeGroup?.currentHost || null,
        catalogFallback: activeGroup?.catalogFallback || deps.peekCurrentCdn(),
        groupNativeCount: activeGroup ? activeGroup.routes.filter(route => !deps.TRUSTED_CDN_CATALOG_SET.has(route.host)).length : 0,
        counts, ledger: { video: ledgers.video.size, audio: ledgers.audio.size, evicted, rejected: loadRejected },
        routeAffinity: routeAffinity ? { ...routeAffinity } : null,
        plannedRoute: plannedAffinity ? { ...plannedAffinity } : null,
        lastPlannedRoute: lastPlannedRoute ? { ...lastPlannedRoute } : null,
        lastObservedRoute: lastObservedRoute ? { ...lastObservedRoute } : null,
        lastRouteBoundary: lastRouteBoundary ? { ...lastRouteBoundary,
            adopted: lastRouteBoundary.adopted ? { ...lastRouteBoundary.adopted } : null } : null,
        suppressedSwitches: { ...suppressedSwitches },
        lastBakeoff: lastBakeoff.map(item => ({ ...item })), autoQualityReason: lastAutoQualityReason,
    }
}

return {
    isHostSoftBlocked: host => ['video','audio'].some(kind => isSoftBlocked(ledgers[kind].get(host))),
    LEDGER_KEY, resetPool, clearLedger, registerSignedRouteGroup, applySignedRoutePlan, planUnregisteredItem, pageRepresentation, retainAffinityForTrustedPlayinfo, scheduleStartupSample,
    captureRouteContext, routeContextActive, resolveRequestRoute, isProtectedSignedUrl,
    observeTransport, recordNativeThroughput, noteNativeFailure, getNativeProbeCandidate,
    recordNativeProbe, setLastBakeoff, beginRouteRecovery, diagnostics, canUseRouteSample, isRouteSampleAllowed, getObservedRouteHost, flushLedger: saveNow,
    get activeRepresentation() { return activeRepresentation },
    get routeRevision() { return routeRevision },
    get groups() { return groups },
    get ledgers() { return ledgers },
}
}
