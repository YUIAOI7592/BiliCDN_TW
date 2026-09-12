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
const PROVISIONAL_TTL_MS = 60 * 1000
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
let activeRepresentation = null
let tentativeRepresentation = null
let lastAutoQualityReason = 'none'
let lastBakeoff = []

const parseEligibleUrl = url => {
    if (typeof url !== 'string' || !url || url.length > URL_MAX) return null
    let parsed
    try { parsed = deps.parseMediaHttpUrl(url) } catch { return null }
    if (!parsed || !/^https?:$/.test(parsed.protocol)) return null
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
    if (group?.provisionalHost === host && group.provisionalUntil > Date.now()) return 'provisional'
    if (record?.transportSamples > 0) return 'confirmed'
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
    lastAutoQualityReason = 'epoch-reset'; routeRevision++
}
const rawUrls = (item, isDash) => isDash
    ? [item?.base_url, item?.baseUrl, ...(Array.isArray(item?.backup_url) ? item.backup_url : []), ...(Array.isArray(item?.backupUrl) ? item.backupUrl : [])]
    : [item?.url, ...(Array.isArray(item?.backup_url) ? item.backup_url : []), ...(Array.isArray(item?.backupUrl) ? item.backupUrl : [])]

const registerSignedRouteGroup = (item, isDash, kind = 'video') => {
    if (!item || poolChars >= POOL_URL_CHARS_MAX) return null
    kind = ['video','audio','muxed'].includes(kind) ? kind : 'unknown'
    const groupLimit = kind === 'video' ? VIDEO_GROUP_LIMIT : AUDIO_GROUP_LIMIT
    if ([...groups.values()].filter(group => group.kind === kind).length >= groupLimit) return null
    const codec = deps.normalizeCodecName?.(item) || 'other'
    const group = {
        id: `${deps.playinfoEpoch}:${kind}:${++groupSeq}`,
        epoch: deps.playinfoEpoch, kind, height: int(item.height, 10000), codec,
        bandwidth: finite(item.bandwidth, 0, 1e10), originalOrder: groupSeq,
        routes: [], rootOriginal: null, invalidHosts: new Set(), provisionalHost: null,
        provisionalUntil: 0, currentRouteType: 'catalog-generated', currentHost: null,
        catalogFallback: null, transportEvidence: new Map(), revision: ++routeRevision,
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
        protectedUrls.add(parsed.url)
        if (!identityGroups.has(parsed.identity)) identityGroups.set(parsed.identity, group.id)
        else if (identityGroups.get(parsed.identity) !== group.id) identityGroups.set(parsed.identity, null)
        const ledgerKind = kind === 'audio' ? 'audio' : 'video'
        const historical = ledgers[ledgerKind].get(parsed.host)
        if (historical) { historical.lastSeen = Date.now(); touchedLedger = true }
    }
    if (!group.routes.length) return null
    groups.set(group.id, group)
    if (touchedLedger) scheduleSave()
    return group.id
}
const groupForUrl = url => {
    const parsed = parseEligibleUrl(url)
    const id = parsed && identityGroups.get(parsed.identity)
    return id ? groups.get(id) || null : null
}
const captureRouteContext = url => {
    const group = groupForUrl(url)
    return group ? { groupId: group.id, epoch: group.epoch, revision: group.revision } : null
}
const routeContextActive = context => !!context && context.epoch === deps.playinfoEpoch && groups.has(context.groupId)
const findNative = (group, host) => group?.routes.find(route => route.host === host && !deps.TRUSTED_CDN_CATALOG_SET.has(host)) || null

const setItemUrls = (item, isDash, primary, backups) => {
    if (isDash) {
        item.base_url = primary; item.baseUrl = primary
        item.backup_url = backups; item.backupUrl = backups
    } else {
        item.url = primary; item.backup_url = backups; if ('backupUrl' in item) item.backupUrl = backups
    }
}
const applySignedRoutePlan = (item, isDash, groupId) => {
    const group = groups.get(groupId)
    if (!group) return null
    const transformed = rawUrls(item, isDash).filter(value => typeof value === 'string')
    const legacyPrimary = transformed[0] || group.rootOriginal
    const legacyHost = (() => { try { return new URL(legacyPrimary).hostname } catch { return null } })()
    group.catalogFallback = deps.TRUSTED_CDN_CATALOG_SET.has(legacyHost) ? legacyHost : deps.peekCurrentCdn()
    let primary = legacyPrimary
    let primaryType = deps.TRUSTED_CDN_CATALOG_SET.has(legacyHost) ? 'catalog-generated' : 'root-original'
    let primaryHost = legacyHost
    if (!deps.resolvedCdn) {
        const required = deps.getRequiredStreamMbps(undefined, 'startup')
        const catalogScore = group.catalogFallback ? deps.getCdnHealthScore(group.catalogFallback, { exploit: true }) : 0
        const eligible = group.routes
            .filter(route => !deps.TRUSTED_CDN_CATALOG_SET.has(route.host) && !group.invalidHosts.has(route.host))
            .map(route => ({ route, record: recordFor(group.kind === 'audio' ? 'audio' : 'video', route.host) }))
            .filter(entry => routeState(group.kind === 'audio' ? 'audio' : 'video', entry.route.host, group) !== 'unknown' && !isSoftBlocked(entry.record))
            .map(entry => ({ ...entry, score: scoreRecord(entry.record, required) }))
            .sort((a, b) => b.score - a.score || a.route.order - b.route.order)
        const chosen = eligible[0]
        if (chosen && chosen.score >= catalogScore + STICKY_MARGIN) {
            primary = chosen.route.url; primaryType = 'native-signed'; primaryHost = chosen.route.host
        }
    }
    const catalogBackups = transformed.slice(1).filter(url => {
        try { return deps.TRUSTED_CDN_CATALOG_SET.has(new URL(url).hostname) } catch { return false }
    }).slice(0, 2)
    const nativeBackups = group.routes.filter(route => !deps.TRUSTED_CDN_CATALOG_SET.has(route.host) && route.url !== primary)
        .sort((a, b) => {
            const ar = recordFor(group.kind === 'audio' ? 'audio' : 'video', a.host)
            const br = recordFor(group.kind === 'audio' ? 'audio' : 'video', b.host)
            return scoreRecord(br, deps.getRequiredStreamMbps(undefined, 'startup')) - scoreRecord(ar, deps.getRequiredStreamMbps(undefined, 'startup')) || a.order - b.order
        }).slice(0, 2).map(route => route.url)
    const backups = [...new Set([...catalogBackups, ...nativeBackups, group.rootOriginal].filter(url => url && url !== primary))]
    setItemUrls(item, isDash, primary, backups)
    group.currentRouteType = primaryType; group.currentHost = primaryHost; group.revision = ++routeRevision
    return { groupId, primaryType, primaryHost, catalogFallback: group.catalogFallback, revision: group.revision }
}

const resolveRequestRoute = (url, context) => {
    const routeContext = context?.route || context
    if (deps.resolvedCdn || !routeContextActive(routeContext)) return null
    const group = groups.get(routeContext.groupId)
    const selected = findNative(group, group.currentRouteType === 'native-signed' ? group.currentHost : group.provisionalHost)
    if (!selected || group.invalidHosts.has(selected.host)) return null
    if (group.provisionalHost === selected.host && group.provisionalUntil <= Date.now()) {
        group.provisionalHost = null; group.provisionalUntil = 0
        if (group.currentRouteType !== 'native-signed') return null
    }
    return { url: selected.url, host: selected.host, type: 'native-signed', groupId: group.id, revision: group.revision }
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
            revision: ++routeRevision, confirmedAt: Date.now(), reason }
        group.revision = routeRevision
        lastAutoQualityReason = reason
        deps.onActiveRepresentation?.(group.rootOriginal, group.id, { switched })
    }
    tentativeRepresentation = null
}
const observeTransport = (context, url, bytes, source) => {
    const routeContext = context?.route
    if (!routeContextActive(routeContext) || !Number.isSafeInteger(bytes) || bytes <= 0 || !['xhr','fetch'].includes(source)) return
    const group = groups.get(routeContext.groupId)
    const parsed = parseEligibleUrl(url)
    if (!group || !parsed) return
    const route = findNative(group, parsed.host)
    if (group.kind === 'video') {
        let matchesHeight = false
        try { const video = deps.getVideo?.(); matchesHeight = !!(video?.videoHeight && group.height && Math.abs(video.videoHeight - group.height) <= 16) } catch {}
        const now = Date.now(), prior = group.transportEvidence.get(parsed.host)
        const evidence = prior && now - prior.firstAt <= 8000 ? prior : { firstAt: now, count: 0, bytes: 0 }
        if (context.nativeActiveCounted !== group.id) {
            context.nativeActiveCounted = group.id
            evidence.count++
        }
        evidence.bytes += bytes; evidence.lastAt = now; group.transportEvidence.set(parsed.host, evidence)
        tentativeRepresentation = { groupId: group.id, height: group.height, codec: group.codec, reason: matchesHeight ? 'height-match' : 'transport-observed' }
        if (matchesHeight || evidence.count >= 2) activateGroup(group, matchesHeight ? 'video-height-match' : 'two-video-transfers')
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
    if (!group || !parsed || !findNative(group, parsed.host)) return { accepted: false, status: 'not-native' }
    if (source === 'transport' && context.nativeCompletionRecorded !== `${group.id}:${parsed.host}`) {
        context.nativeCompletionRecorded = `${group.id}:${parsed.host}`
        const kind = group.kind === 'audio' ? 'audio' : 'video'
        const record = ensureRecordFromTransport(kind, parsed.host)
        record.transportSamples = Math.min(12, record.transportSamples + 1)
        record.successes = Math.min(12, record.successes + 1)
        record.failures = Math.max(0, record.failures - 1)
        record.lastSuccessAt = record.lastSeen = Date.now()
        record.softBlockedUntil = 0
        if (group.provisionalHost === parsed.host) {
            group.provisionalUntil = 0
            group.currentRouteType = 'native-signed'; group.currentHost = parsed.host; group.revision = ++routeRevision
        }
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
    if ([403,451,959].includes(+status)) {
        group.invalidHosts.add(parsed.host)
        if (group.provisionalHost === parsed.host) { group.provisionalHost = null; group.provisionalUntil = 0 }
        if (group.currentHost === parsed.host) { group.currentRouteType = 'root-original'; group.currentHost = null }
        group.revision = ++routeRevision
        return true
    }
    if (!(+status >= 500 || ['network-error','body-error','timeout'].includes(failureKind))) return false
    const kind = group.kind === 'audio' ? 'audio' : 'video'
    const record = recordFor(kind, parsed.host, isKnownFamily(parsed.host))
    if (!record) return false
    record.failures = Math.min(3, record.failures + 1); record.softBlockedUntil = Date.now() + SOFT_BLOCK_MS
    record.lastFailureAt = record.lastSeen = Date.now(); scheduleSave(); return true
}

const getActiveGroup = sampleUrl => {
    if (activeRepresentation?.groupId && groups.has(activeRepresentation.groupId)) return groups.get(activeRepresentation.groupId)
    return null
}
const getNativeProbeCandidate = sampleUrl => {
    if (deps.resolvedCdn || deps.disabled) return null
    const group = getActiveGroup(sampleUrl)
    if (!group || group.epoch !== deps.playinfoEpoch) return null
    const kind = 'video'
    const now = Date.now()
    const candidates = group.routes.filter(route => !deps.TRUSTED_CDN_CATALOG_SET.has(route.host)
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
    if (latencyMs) recordNativeLatency(group.id, candidate.host, latencyMs)
    if (!result?.accepted) return result || { accepted: false, status: 'failed' }
    const sample = updateThroughput('video', candidate.host, result.bytes, result.durationMs, deps.playbackRateState.effectiveRate, 'probe')
    if (sample.accepted) considerProvisional(group, candidate.host, sample.mbps)
    return sample
}
const considerProvisional = (group, host, mbps) => {
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
    group.provisionalHost = host; group.provisionalUntil = now + PROVISIONAL_TTL_MS
    group.revision = ++routeRevision; return true
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
    const counts = { unknown: 0, provisional: 0, confirmed: 0, invalid: 0 }
    allNative.forEach(({ group, route }) => { counts[routeState(group.kind === 'audio' ? 'audio' : 'video', route.host, group)]++ })
    return {
        active: activeRepresentation ? { height: activeRepresentation.height, codec: activeRepresentation.codec,
            revision: activeRepresentation.revision, reason: activeRepresentation.reason } : null,
        tentative: tentativeRepresentation ? { height: tentativeRepresentation.height, codec: tentativeRepresentation.codec,
            reason: tentativeRepresentation.reason } : null,
        routeRevision, currentRouteType: activeGroup?.currentRouteType || 'catalog-generated',
        currentHost: activeGroup?.currentHost || null, catalogFallback: activeGroup?.catalogFallback || deps.peekCurrentCdn(),
        groupNativeCount: activeGroup ? activeGroup.routes.filter(route => !deps.TRUSTED_CDN_CATALOG_SET.has(route.host)).length : 0,
        counts, ledger: { video: ledgers.video.size, audio: ledgers.audio.size, evicted, rejected: loadRejected },
        lastBakeoff: lastBakeoff.map(item => ({ ...item })), autoQualityReason: lastAutoQualityReason,
    }
}

return {
    LEDGER_KEY, resetPool, clearLedger, registerSignedRouteGroup, applySignedRoutePlan,
    captureRouteContext, routeContextActive, resolveRequestRoute, isProtectedSignedUrl,
    observeTransport, recordNativeThroughput, noteNativeFailure, getNativeProbeCandidate,
    recordNativeProbe, setLastBakeoff, diagnostics, flushLedger: saveNow,
    get activeRepresentation() { return activeRepresentation },
    get routeRevision() { return routeRevision },
    get groups() { return groups },
    get ledgers() { return ledgers },
}
}
