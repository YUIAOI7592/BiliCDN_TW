// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createEvents(deps) {
const PluginName = 'BiliCDN_TW_v' + deps.VERSION

const Config = { verbose: false }

const DiagnosticLog = (() => {
    const nowMs = typeof deps.now === 'function' ? deps.now : () => Date.now()
    const scheduleTimeout = typeof deps.setTimeout === 'function' ? deps.setTimeout : setTimeout
    const cancelTimeout = typeof deps.clearTimeout === 'function' ? deps.clearTimeout : clearTimeout
    const critical = [], detail = [], pending = new Map(), aggregates = new Map()
    const rolling = [], externalAliases = new Map(), groupOrdinals = new Map()
    const TTL = 15 * 60 * 1000
    const CONTEXT_MS = 60 * 1000
    const POST_MS = 30 * 1000
    const MAX_POST_MS = 90 * 1000
    const CRITICAL_BYTES = 64 * 1024
    const ROLLING_BYTES = 32 * 1024
    const INCIDENT_BYTES = 64 * 1024
    const encoder = new TextEncoder()
    const codes = new Set(('runtime verbose settings-read settings-write settings-verify exception '
        + 'request-failure request-summary http network-error body-error '
        + 'rewrite measurement watchdog recovery breaker host-lock clipboard sample route-blocked '
        + 'startup-measurement video-core route representation incident').split(' '))
    const commonFields = new Set(['generation', 'epoch'])
    const schemas = Object.freeze({
        runtime: ['reason'], verbose: ['enabled', 'persisted'],
        'settings-read': [], 'settings-write': [], 'settings-verify': [], exception: ['stage'],
        rewrite: ['originalHost', 'targetHost', 'routeType', 'decisionId'],
        measurement: ['host', 'reason', 'status', 'bytes', 'received', 'requested', 'outcome', 'kind',
            'routeType', 'groupOrdinal', 'decisionId', 'waitMs'],
        watchdog: ['reason', 'readyState', 'networkState', 'currentTime', 'duration', 'bufferAheadSec',
            'observedRate', 'effectiveRate', 'paused', 'seeking', 'ended', 'available', 'valid', 'errorCode',
            'hidden', 'remainingMs', 'remainingSec'],
        recovery: ['stage', 'reason', 'outcome', 'actionId', 'host', 'originalHost', 'targetHost', 'finalHost',
            'kind', 'status', 'count', 'punished', 'reselected', 'preconnect', 'requested', 'received',
            'switchCount', 'stallCount', 'currentTime', 'bufferAheadSec', 'routeType', 'routeRevision',
            'decisionId', 'groupOrdinal', 'failureKind', 'fallbackType', 'fallbackHost', 'waitingForRetry', 'waitMs'],
        breaker: ['stage', 'reason', 'count', 'remainingMs', 'remainingSec', 'actionId'],
        'host-lock': ['host', 'status', 'kind', 'routeType', 'groupOrdinal', 'decisionId'],
        clipboard: ['stage', 'outcome'],
        sample: ['readyState', 'networkState', 'currentTime', 'duration', 'bufferAheadSec', 'observedRate',
            'effectiveRate', 'paused', 'seeking', 'ended', 'available', 'valid', 'errorCode', 'hidden'],
        'route-blocked': ['reason', 'method', 'kind', 'host', 'originalHost', 'targetHost', 'routeType',
            'groupOrdinal', 'routeRevision', 'decisionId', 'actionId'],
        'startup-measurement': ['kind', 'outcome', 'reason', 'count', 'phase', 'playableSec', 'progressTicks',
            'requested', 'received'],
        'video-core': ['stage', 'reason', 'outcome', 'actionId', 'kind', 'host', 'failedHost', 'fallbackHost',
            'fallbackType', 'groupOrdinal', 'routeType', 'routeRevision', 'decisionId', 'waitingForRetry',
            'coreInitialized', 'resumeToken', 'reloadCount', 'videoAgeSec', 'audioAgeSec', 'playHookState',
            'intentSource', 'userActivationAccepted', 'pauseSec', 'intentAgeSec', 'savedPositionSec', 'savedRate',
            'postReloadPlayOutcome', 'currentTime', 'effectiveRate', 'waitMs', 'remainingMs', 'breakerSec'],
        route: ['stage', 'reason', 'outcome', 'actionId', 'decisionId', 'kind', 'host', 'failedHost',
            'originalHost', 'targetHost', 'finalHost', 'routeType', 'routeRevision', 'groupOrdinal',
            'failureKind', 'status', 'fallbackType', 'fallbackHost', 'waitingForRetry'],
        representation: ['stage', 'reason', 'kind', 'groupOrdinal', 'routeRevision', 'height', 'codec'],
        incident: ['stage', 'reason', 'incidentId', 'incidentReplaced', 'triggerCode'],
        'request-failure': ['id', 'method', 'kind', 'originalHost', 'targetHost', 'finalHost', 'status', 'bytes',
            'startAt', 'responseAt', 'endAt', 'phase', 'reason', 'failureKind', 'ttfbMs', 'elapsedMs', 'progressCount',
            'maxNoProgressMs', 'routeType', 'groupOrdinal', 'routeRevision', 'decisionId', 'actionId'],
        'request-summary': ['bucketStart', 'bucketEnd', 'kind', 'targetHost', 'finalHost', 'routeType',
            'groupOrdinal', 'requestCount', 'successCount', 'abortCount', 'bytes', 'ttfbMs', 'elapsedMs',
            'progressCount', 'maxNoProgressMs', 'status', 'lastSuccessAt'],
    })
    const hostFields = new Set(['host', 'failedHost', 'originalHost', 'targetHost', 'finalHost', 'fallbackHost'])
    const numberFields = new Set(('generation epoch id status bytes startAt responseAt endAt ageMs readyState '
        + 'networkState currentTime duration bufferAheadSec observedRate effectiveRate errorCode waitMs count breakerSec '
        + 'remainingMs remainingSec switchCount stallCount playableSec progressTicks resumeToken reloadCount '
        + 'videoAgeSec audioAgeSec pauseSec intentAgeSec savedPositionSec savedRate routeRevision groupOrdinal '
        + 'bucketStart bucketEnd requestCount successCount abortCount ttfbMs elapsedMs progressCount '
        + 'maxNoProgressMs lastSuccessAt height incidentReplaced').split(' '))
    const booleanFields = new Set(('enabled persisted received requested punished reselected preconnect paused seeking '
        + 'ended available valid hidden coreInitialized userActivationAccepted waitingForRetry').split(' '))
    const tokenFields = new Set(('method kind phase stage reason outcome routeType decisionId actionId failureKind '
        + 'fallbackType codec playHookState intentSource postReloadPlayOutcome incidentId triggerCode').split(' '))
    const state = { startedAt: nowMs(), verboseChangedAt: nowMs(), persisted: null,
        evicted: 0, expired: 0, rejected: 0, pendingEvicted: 0, failures: 0,
        droppedFields: 0, droppedFieldNames: [], incidentReplaced: 0, aggregateEvicted: 0,
        lastRecorderFailure: null }
    let seq = 0, nextRequest = 0, nextAction = 0, nextIncident = 0, lastSampleAt = 0
    let context = { generation: 0, epoch: 0 }
    let decision = null, incident = null, incidentTimer = null

    const size = text => encoder.encode(text).byteLength
    const finite = x => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= Number.MAX_SAFE_INTEGER
    const safeToken = value => typeof value === 'string' && value.length <= 64
        && /^[a-z0-9][a-z0-9._:-]*$/i.test(value) ? value : null
    const aliasExternal = h => {
        if (!externalAliases.has(h) && externalAliases.size < 64) externalAliases.set(h, 'external#' + (externalAliases.size + 1))
        return externalAliases.get(h) || 'external#overflow'
    }
    const host = value => {
        try {
            const h = typeof value === 'string' && value.length <= 16384
                ? (value.includes('/') ? new URL(value, 'https://www.bilibili.com').hostname : value) : ''
            const normalized = String(h || '').toLowerCase().replace(/\.$/, '')
            if (!normalized) return 'unknown'
            if (deps.TRUSTED_CDN_CATALOG_SET.has(normalized)
                || /(^|\.)(?:bilivideo\.(?:com|cn|net)|akamaized\.net)$/.test(normalized)) return normalized
            return aliasExternal(normalized)
        } catch { return 'external#invalid' }
    }
    const noteDropped = key => {
        state.droppedFields++
        if (typeof key === 'string' && !state.droppedFieldNames.includes(key) && state.droppedFieldNames.length < 16) {
            state.droppedFieldNames.push(key.slice(0, 48))
        }
    }
    const clean = (code, data) => {
        const out = {}
        const allowed = new Set([...(schemas[code] || []), ...commonFields])
        let keys
        try { keys = Object.keys(data).slice(0, 64) } catch { state.failures++; return out }
        for (const key of keys) {
            if (!allowed.has(key)) { noteDropped(key); continue }
            let value
            try { value = data[key] } catch { state.failures++; noteDropped(key); continue }
            if (hostFields.has(key)) out[key] = value === null ? null : host(value)
            else if (numberFields.has(key) && finite(value)) out[key] = value
            else if (booleanFields.has(key) && (typeof value === 'boolean' || value === null)) out[key] = value
            else if (tokenFields.has(key)) {
                if (value === null || value === undefined) {
                    if (value === null) out[key] = null
                    continue
                }
                const token = (key === 'actionId' || key === 'decisionId') && finite(value)
                    ? String(value) : safeToken(value)
                if (token !== null) out[key] = token
                else noteDropped(key)
            } else if (value === null) out[key] = null
            else noteDropped(key)
        }
        return out
    }
    const entryBytes = entry => size(JSON.stringify(entry))
    const trimRing = (ring, maxBytes, maxCount = 512) => {
        let total = ring.reduce((n, entry) => n + entryBytes(entry), 0)
        while (ring.length && (ring.length > maxCount || total > maxBytes)) {
            total -= entryBytes(ring.shift()); state.evicted++
        }
    }
    const trimAggregates = () => {
        let total = [...aggregates.values()].reduce((n, entry) => n + size(JSON.stringify(entry)), 0)
        while (aggregates.size && total > ROLLING_BYTES) {
            const key = aggregates.keys().next().value
            const entry = aggregates.get(key)
            aggregates.delete(key)
            total -= size(JSON.stringify(entry))
            state.aggregateEvicted++
        }
    }
    const prune = () => {
        const now = nowMs(), cutoff = now - TTL, rollingCutoff = now - CONTEXT_MS
        while (critical.length && critical[0].lastAt < cutoff) { critical.shift(); state.expired++ }
        while (detail.length && detail[0].lastAt < cutoff) { detail.shift(); state.expired++ }
        while (rolling.length && rolling[0].lastAt < rollingCutoff) rolling.shift()
        for (const [key, aggregate] of aggregates) {
            if (aggregate.bucketEnd < rollingCutoff) aggregates.delete(key)
        }
    }
    const appendDedup = (ring, entry) => {
        const previous = ring[ring.length - 1]
        if (previous === entry) return previous
        if (previous && previous.code === entry.code && JSON.stringify(previous.data) === JSON.stringify(entry.data)) {
            previous.lastAt = entry.lastAt
            previous.count = Math.min(10000, previous.count + 1)
            return previous
        }
        ring.push(entry)
        return entry
    }
    const incidentTrigger = (code, data) => {
        if (code === 'exception' || code === 'request-failure' || code === 'route-blocked' || code === 'host-lock'
            || code === 'breaker') return true
        if (code === 'route') return ['failure-detected', 'fallback-planned', 'no-fallback', 'reload-requested',
            'reload-failed', 'core-waiting'].includes(data.stage)
        if (code === 'video-core') return ['route-failure-armed', 'video-init-dead', 'reloading', 'reload-failed',
            'breaker'].includes(data.stage)
        if (code === 'recovery') return ['attempt', 'no-progress', 'interrupted'].includes(data.outcome)
            || ['attributed', 'no-attribution'].includes(data.reason)
        return false
    }
    const trimIncident = () => {
        if (!incident) return
        let total = size(JSON.stringify(incident))
        while (incident.events.length > 1 && total > INCIDENT_BYTES) {
            const removable = incident.events.findIndex(entry => entry.seq !== incident.triggerSeq)
            if (removable < 0) break
            incident.events.splice(removable, 1)
            incident.evicted++
            total = size(JSON.stringify(incident))
        }
        incident.truncated = total > INCIDENT_BYTES
    }
    const freezeIncident = () => {
        if (!incident || incident.state !== 'capturing') return
        incident.state = 'frozen'
        incident.endedAt = nowMs()
        incidentTimer = null
        trimIncident()
    }
    const scheduleIncidentFreeze = () => {
        if (incidentTimer) cancelTimeout(incidentTimer)
        if (!incident || incident.state !== 'capturing') return
        incidentTimer = scheduleTimeout(freezeIncident, Math.max(0, incident.captureUntil - nowMs()))
    }
    const startIncident = (reason, triggerCode, triggerEntry = null) => {
        const now = nowMs()
        if (incident?.state === 'capturing') {
            incident.lastTriggerAt = now
            incident.captureUntil = Math.min(incident.hardUntil, now + POST_MS)
            if (triggerEntry && !incident.events.some(entry => entry.seq === triggerEntry.seq)) incident.events.push(triggerEntry)
            scheduleIncidentFreeze()
            return incident.id
        }
        if (incident) state.incidentReplaced++
        incident = {
            id: 'incident-' + (++nextIncident), state: 'capturing', reason: safeToken(reason) || 'unknown',
            triggerCode: safeToken(triggerCode) || 'unknown', startedAt: now, firstTriggerAt: now, lastTriggerAt: now,
            triggerSeq: triggerEntry?.seq || null,
            coverageStart: Math.max(state.startedAt, now - CONTEXT_MS), captureUntil: now + POST_MS,
            hardUntil: now + MAX_POST_MS, endedAt: null, evicted: 0, truncated: false,
            events: rolling.filter(entry => entry.lastAt >= now - CONTEXT_MS),
        }
        if (triggerEntry && !incident.events.some(entry => entry.seq === triggerEntry.seq)) incident.events.push(triggerEntry)
        trimIncident()
        scheduleIncidentFreeze()
        return incident.id
    }
    const appendIncident = entry => {
        if (!incident || incident.state !== 'capturing') return
        if (entry.firstAt <= incident.hardUntil && !incident.events.some(item => item.seq === entry.seq)) {
            incident.events.push(entry)
            trimIncident()
        }
    }
    const record = (code, data = {}, important = false) => {
        try {
            if (!codes.has(code)) { state.rejected++; return null }
            const fields = { ...context, ...clean(code, data) }
            const forced = important || incidentTrigger(code, fields)
            if (!forced && !Config.verbose && !['runtime', 'representation', 'route'].includes(code)) return null
            prune()
            const now = nowMs()
            const entry = { seq: ++seq, firstAt: now, lastAt: now, count: 1, code, data: fields }
            if (entryBytes(entry) > 2048) { state.rejected++; return null }
            const stored = forced ? appendDedup(critical, entry) : appendDedup(detail, entry)
            appendDedup(rolling, stored)
            trimRing(critical, CRITICAL_BYTES, 256)
            trimRing(detail, ROLLING_BYTES, 256)
            trimRing(rolling, ROLLING_BYTES, 256)
            appendIncident(stored)
            if (incidentTrigger(code, fields)) startIncident(fields.reason || fields.stage || code, code, stored)
            try { if (Config.verbose) console.log('[BiliCDN evidence]', JSON.stringify(stored)) } catch {}
            return stored
        } catch { state.failures++; return null }
    }
    const fault = stage => record('exception', { stage }, true)
    const requestActive = r => r && r.generation === context.generation && r.epoch === context.epoch
    const groupOrdinal = groupId => {
        if (!groupId) return null
        if (!groupOrdinals.has(groupId)) groupOrdinals.set(groupId, groupOrdinals.size + 1)
        return groupOrdinals.get(groupId)
    }
    const nextActionId = (prefix = 'action') => (safeToken(prefix) || 'action') + '-' + (++nextAction)
    const routeMeta = media => {
        const routeDecision = media?.routeDecision || null
        return {
            routeType: safeToken(routeDecision?.type) || 'unknown',
            groupOrdinal: groupOrdinal(media?.route?.groupId),
            routeRevision: finite(routeDecision?.revision) ? routeDecision.revision
                : finite(media?.route?.revision) ? media.route.revision : null,
            decisionId: safeToken(routeDecision?.decisionId) || nextActionId('decision'),
            actionId: safeToken(routeDecision?.actionId),
        }
    }
    const request = (method, media, original, target) => {
        try {
            if (!deps.mediaContextActive(media)) return null
            const meta = routeMeta(media)
            const now = nowMs()
            const r = { id: ++nextRequest, generation: media.runtime.generation, epoch: media.epoch,
                method, kind: media.rep?.kind || 'unknown', originalHost: host(original),
                targetHost: host(target), finalHost: null, startAt: now, responseAt: null,
                endAt: null, bytes: 0, status: null, phase: 'headers', progressCount: 0,
                lastProgressAt: now, maxNoProgressMs: 0, ...meta }
            pending.set(r.id, r)
            if (pending.size > 64) { pending.delete(pending.keys().next().value); state.pendingEvicted++ }
            if (r.actionId) record('route', { stage: 'fallback-requested', actionId: r.actionId,
                decisionId: r.decisionId, kind: r.kind, targetHost: r.targetHost, routeType: r.routeType,
                groupOrdinal: r.groupOrdinal, routeRevision: r.routeRevision, waitingForRetry: true }, true)
            return r.id
        } catch { state.failures++; return null }
    }
    const aggregateTerminal = (r, code) => {
        const bucketStart = Math.floor(r.startAt / 5000) * 5000
        const key = [bucketStart, r.kind, r.routeType, r.groupOrdinal ?? 0, r.targetHost, r.finalHost || 'unknown'].join('|')
        let a = aggregates.get(key)
        if (!a) {
            a = { bucketStart, bucketEnd: bucketStart + 4999, kind: r.kind, routeType: r.routeType,
                groupOrdinal: r.groupOrdinal, targetHost: r.targetHost, finalHost: r.finalHost,
                requestCount: 0, successCount: 0, abortCount: 0, bytes: 0, ttfbMs: 0,
                elapsedMs: 0, progressCount: 0, maxNoProgressMs: 0, status: null, lastSuccessAt: null }
            aggregates.set(key, a)
        }
        a.requestCount++
        if (['eof', 'no-body'].includes(code) && (!r.status || r.status < 400)) {
            a.successCount++
            a.lastSuccessAt = r.endAt
        } else if (['abort', 'reopened', 'detached'].includes(code)) a.abortCount++
        a.bytes += Math.max(0, r.bytes || 0)
        a.ttfbMs = Math.max(a.ttfbMs, r.responseAt ? r.responseAt - r.startAt : 0)
        a.elapsedMs = Math.max(a.elapsedMs, r.endAt - r.startAt)
        a.progressCount += r.progressCount
        a.maxNoProgressMs = Math.max(a.maxNoProgressMs, r.maxNoProgressMs,
            r.endAt - (r.lastProgressAt || r.startAt))
        a.status = r.status
        if (aggregates.size > 192) { aggregates.delete(aggregates.keys().next().value); state.aggregateEvicted++ }
        trimAggregates()
    }
    const failureEvent = (r, code) => record('request-failure', {
        ...r, failureKind: safeToken(r.reason) || code, ttfbMs: r.responseAt ? r.responseAt - r.startAt : 0,
        elapsedMs: r.endAt - r.startAt,
    }, true)
    const updateRequest = (id, code, data = {}) => {
        let recorderStage = 'lookup'
        try {
            const r = pending.get(id)
            if (!requestActive(r)) return
            recorderStage = 'clean'
            Object.assign(r, clean('request-failure', data))
            const now = nowMs()
            if (code === 'headers') { r.responseAt = now; r.phase = 'body'; return }
            if (code === 'body') {
                r.progressCount++
                r.maxNoProgressMs = Math.max(r.maxNoProgressMs, now - r.lastProgressAt)
                r.lastProgressAt = now
                return
            }
            r.endAt = now
            pending.delete(id)
            recorderStage = 'aggregate'
            aggregateTerminal(r, code)
            recorderStage = 'failure-event'
            if (['http', 'network-error', 'body-error'].includes(code)) failureEvent(r, code)
        } catch { state.failures++; state.lastRecorderFailure = recorderStage }
    }
    const boundary = (generation, epoch, reason) => {
        try {
            for (const id of [...pending.keys()]) updateRequest(id, 'detached')
            context = { generation, epoch }
            groupOrdinals.clear()
            record('runtime', { reason }, true)
        } catch { state.failures++ }
    }
    const setDecision = (reason, data = {}) => {
        try {
            const next = { ...context, reason, ...clean('watchdog', data) }
            if (!decision || decision.reason !== reason || decision.generation !== context.generation) {
                record('watchdog', next, ['low-data', 'buffered-stall', 'too-slow', 'breaker'].includes(reason))
            }
            decision = { ...next, updatedAt: nowMs() }
        } catch { state.failures++ }
    }
    const markIncident = (reason = 'manual') => {
        try {
            const id = startIncident(reason, 'manual')
            record('incident', { stage: 'manual-mark', reason, incidentId: id,
                incidentReplaced: state.incidentReplaced, triggerCode: 'manual' }, true)
            return { ok: true, id }
        } catch { state.failures++; return { ok: false, id: null } }
    }
    const clearIncident = () => {
        if (incidentTimer) cancelTimeout(incidentTimer)
        incidentTimer = null
        const hadIncident = !!incident
        incident = null
        return hadIncident
    }
    const aggregateSnapshot = () => [...aggregates.values()].map(a => ({ ...a }))
    const aggregateTotals = () => aggregateSnapshot().reduce((totals, entry) => {
        totals.requestCount += entry.requestCount || 0
        totals.successCount += entry.successCount || 0
        totals.abortCount += entry.abortCount || 0
        totals.bytes += entry.bytes || 0
        return totals
    }, { requestCount: 0, successCount: 0, abortCount: 0, bytes: 0 })
    return Object.freeze({
        record, fault, request, updateRequest, boundary, setDecision, host, size, nextActionId, groupOrdinal,
        markIncident, clearIncident,
        verbose(persisted) { state.persisted = persisted; state.verboseChangedAt = nowMs(); record('verbose', { enabled: Config.verbose, persisted }, true) },
        sample(data) { if (nowMs() - lastSampleAt >= 5000) { lastSampleAt = nowMs(); record('sample', data) } },
        summary() { prune(); return { ...state, droppedFieldNames: [...state.droppedFieldNames],
            verbose: Config.verbose, critical: critical.length, detail: detail.length,
            pending: pending.size, aggregates: aggregates.size, incident: incident ? { state: incident.state,
                reason: incident.reason, startedAt: incident.startedAt, coverageStart: incident.coverageStart } : null } },
        snapshot() { prune(); return JSON.parse(JSON.stringify({ ...state, verbose: Config.verbose, decision,
            incident, critical, detail: Config.verbose ? detail : [], aggregates: Config.verbose ? aggregateSnapshot() : [],
            aggregateTotals: aggregateTotals(),
            successSummary: aggregateSnapshot().filter(a => a.successCount > 0).slice(-12),
            pending: [...pending.values()].map(r => ({ ...r, ageMs: Math.max(0, nowMs() - r.startAt) })) })) },
    })
})()

try { Config.verbose = !!GM_getValue('verbose'); DiagnosticLog.verbose(true) }
catch { DiagnosticLog.record('settings-read', {}, true); DiagnosticLog.verbose(null) }

const log = (...args) => { try { if (Config.verbose) console.log('[' + PluginName + ']:', ...args) } catch {} }

const err = (...args) => { try { if (Config.verbose) console.error('[' + PluginName + ']:', ...args) } catch {} }
return { /* TEST_EXPORTS:events */
get PluginName() { return PluginName; },
get Config() { return Config; },
get DiagnosticLog() { return DiagnosticLog; },
get log() { return log; },
get err() { return err; }
};
}
