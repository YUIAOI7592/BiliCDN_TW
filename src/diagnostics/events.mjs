// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createEvents(deps) {
const PluginName = 'BiliCDN_TW_v' + deps.VERSION

const Config = { verbose: false }

const DiagnosticLog = (() => {
    const critical = [], detail = [], pending = new Map()
    const TTL = 15 * 60 * 1000
    const encoder = new TextEncoder()
    const codes = new Set(('runtime verbose settings-read settings-write settings-verify exception '
        + 'request headers body eof no-body http network-error body-error abort reopened detached '
        + 'rewrite measurement watchdog recovery breaker host-lock clipboard sample route-blocked startup-measurement video-core').split(' '))
    const enums = new Set(('fetch xhr video audio muxed unknown non-catalog headers body '
        + 'settings-read settings-write settings-verify startup active disabled spa epoch '
        + 'interceptor transform fetch-body playurl-body playurl-clone measurement watchdog snapshot '
        + 'health-save clipboard-gm clipboard-standard clipboard-manual page-hook ui '
        + 'no-video invalid-state no-metadata media-error ended paused seeking seek-grace '
        + 'background-gap player-nudge nudge-grace startup-grace switch-grace target-reached '
        + 'healthy low-data buffered-stall too-slow stall-count cooldown breaker '
        + 'attempt progress no-progress interrupted no-attribution attributed received httpdns '
        + 'accepted skipped complete cancelled failed timeout partial latency-only '
        + 'http network-error body-error abort eof no-body reopened detached automatic manual '
        + 'fixed no-segment busy hidden not-applicable host-lock forbidden insufficient ineligible host-restricted '
        + 'latency throughput waiting menu verified-failure startup-exhausted startup-waiting healthy-cache '
        + 'pause-armed play-intent waiting-metadata video-init-dead reloading recovered recovered-paused '
        + 'reload-failed hook-unavailable unavailable core-uninitialized installed not-installed lost '
        + 'trusted-media-play paused-transition none not-called pending resolved rejected').split(' '))
    const keys = new Set(('generation epoch id method kind originalHost targetHost finalHost host '
        + 'status bytes startAt responseAt endAt ageMs phase stage reason enabled persisted '
        + 'readyState networkState currentTime duration bufferAheadSec observedRate effectiveRate '
        + 'paused seeking ended available valid errorCode hidden waitMs count remainingMs remainingSec '
        + 'punished reselected preconnect requested received switchCount stallCount breakerSec '
        + 'outcome actionId playableSec progressTicks coreInitialized resumeToken reloadCount videoAgeSec audioAgeSec '
        + 'playHookState intentSource userActivationAccepted pauseSec intentAgeSec savedPositionSec savedRate '
        + 'postReloadPlayOutcome').split(' '))
    const state = { startedAt: Date.now(), verboseChangedAt: Date.now(), persisted: null,
        evicted: 0, expired: 0, rejected: 0, pendingEvicted: 0, failures: 0 }
    let seq = 0, nextRequest = 0, lastSampleAt = 0
    let context = { generation: 0, epoch: 0 }
    let decision = null
    const size = text => encoder.encode(text).byteLength
    const finite = x => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= Number.MAX_SAFE_INTEGER
    const host = value => {
        try {
            const h = typeof value === 'string' && value.length <= 16384
                ? (value.includes('/') ? new URL(value, 'https://www.bilibili.com').hostname : value) : ''
            return deps.TRUSTED_CDN_CATALOG_SET.has(h) ? h : 'non-catalog'
        } catch { return 'non-catalog' }
    }
    const clean = data => {
        const out = {}
        for (const key of Object.keys(data).slice(0, 40)) {
            if (!keys.has(key)) continue
            const value = data[key]
            if (/Host$/.test(key) || key === 'host') out[key] = value === null ? null : host(value)
            else if (value === null || typeof value === 'boolean' || finite(value)) out[key] = value
            else if (typeof value === 'string' && enums.has(value)) out[key] = value
        }
        return out
    }
    const prune = () => {
        const cutoff = Date.now() - TTL
        for (const ring of [critical, detail]) {
            while (ring.length && ring[0].lastAt < cutoff) { ring.shift(); state.expired++ }
        }
    }
    const record = (code, data = {}, important = false) => {
        try {
            if (!codes.has(code)) { state.rejected++; return }
            if (!important && !Config.verbose) return
            prune()
            const fields = { ...context, ...clean(data) }
            const now = Date.now(), ring = important ? critical : detail
            const previous = ring[ring.length - 1]
            if (previous && previous.seq === seq && previous.code === code
                && JSON.stringify(previous.data) === JSON.stringify(fields)) {
                previous.lastAt = now; previous.count = Math.min(10000, previous.count + 1); return
            }
            const entry = { seq: ++seq, firstAt: now, lastAt: now, count: 1, code, data: fields }
            if (size(JSON.stringify(entry)) > 1024) { state.rejected++; return }
            ring.push(entry)
            if (ring.length > (important ? 64 : 192)) { ring.shift(); state.evicted++ }
            try { if (Config.verbose) console.log('[BiliCDN evidence]', JSON.stringify(entry)) } catch {}
        } catch { state.failures++ }
    }
    const fault = stage => record('exception', { stage }, true)
    const requestActive = r => r && r.generation === context.generation && r.epoch === context.epoch
    const request = (method, media, original, target) => {
        try {
            if (!deps.mediaContextActive(media)) return null
            const r = { id: ++nextRequest, generation: media.runtime.generation, epoch: media.epoch,
                method, kind: media.rep?.kind || 'unknown', originalHost: host(original),
                targetHost: host(target), finalHost: null, startAt: Date.now(), responseAt: null,
                bytes: 0, status: null, phase: 'headers' }
            pending.set(r.id, r)
            if (pending.size > 64) { pending.delete(pending.keys().next().value); state.pendingEvicted++ }
            record('request', r)
            return r.id
        } catch { state.failures++; return null }
    }
    const updateRequest = (id, code, data = {}) => {
        try {
            const r = pending.get(id)
            if (!requestActive(r)) return
            Object.assign(r, clean(data))
            if (code === 'headers') { r.responseAt = Date.now(); r.phase = 'body' }
            if (code === 'body') return // Counters only: no per-chunk events.
            const terminal = code !== 'headers'
            if (terminal) { r.endAt = Date.now(); pending.delete(id) }
            record(code, r, ['http', 'network-error', 'body-error'].includes(code))
        } catch { state.failures++ }
    }
    const boundary = (generation, epoch, reason) => {
        try {
            for (const id of [...pending.keys()]) updateRequest(id, 'detached')
            context = { generation, epoch }
            record('runtime', { reason }, true)
        } catch { state.failures++ }
    }
    const setDecision = (reason, data = {}) => {
        try {
            const next = { ...context, reason, ...clean(data) }
            if (!decision || decision.reason !== reason || decision.generation !== context.generation) record('watchdog', next, reason === 'low-data')
            decision = { ...next, updatedAt: Date.now() }
        } catch { state.failures++ }
    }
    return Object.freeze({
        record, fault, request, updateRequest, boundary, setDecision, host, size,
        verbose(persisted) { state.persisted = persisted; state.verboseChangedAt = Date.now(); record('verbose', { enabled: Config.verbose, persisted }, true) },
        sample(data) { if (Date.now() - lastSampleAt >= 5000) { lastSampleAt = Date.now(); record('sample', data) } },
        summary() { prune(); return { ...state, verbose: Config.verbose, critical: critical.length, detail: detail.length, pending: pending.size } },
        snapshot() { prune(); return JSON.parse(JSON.stringify({ ...state, verbose: Config.verbose, decision,
            critical, detail, pending: [...pending.values()].map(r => ({ ...r, ageMs: Math.max(0, Date.now() - r.startAt) })) })) },
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
