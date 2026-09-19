// Background measurements observe playback; they never control it.
export function createStartup(deps) {
    let video = null, previous = null, ticks = 0, safe = false, reason = 'no-video'
    let healthAvailable = false, cacheAvailable = false
    const measurements = { latency: null, throughput: null }
    const listeners = new Set()
    let playableSec = null
    const notify = () => { if (!safe) for (const fn of [...listeners]) { try { fn() } catch {} } }
    const reset = () => {
        video = null; previous = null; ticks = 0; safe = false; reason = 'no-video'; playableSec = null
        healthAvailable = cacheAvailable = false
        measurements.latency = measurements.throughput = null
        notify()
    }
    const update = (v, s) => {
        if (v !== video) { video = v; previous = null; ticks = 0 }
        const valid = s?.available && s.valid && Number.isFinite(s.currentTime) && Number.isFinite(s.bufferAheadSec)
        const rate = Number.isFinite(s?.effectiveRate) && s.effectiveRate > 0 ? s.effectiveRate : 2
        playableSec = valid ? Math.max(0, s.bufferAheadSec / rate) : null
        const eligible = valid && !s.paused && !s.seeking && !s.ended && s.errorCode === 0 && !deps.inSeekGrace()
        ticks = eligible && previous !== null && s.currentTime - previous > 0.05 ? Math.min(2, ticks + 1) : 0
        previous = eligible ? s.currentTime : null
        const toEnd = valid && Number.isFinite(s.duration) && s.duration > 0
            && s.currentTime + s.bufferAheadSec >= s.duration - 0.1 && s.currentTime <= s.duration + 0.1
        reason = !s?.available ? 'no-video' : !valid ? 'invalid-state' : s.errorCode !== 0 ? 'media-error'
            : s.ended ? 'ended' : s.paused ? 'paused' : s.seeking || deps.inSeekGrace() ? 'seek-grace'
            : ticks < 2 ? 'no-progress' : playableSec < 12 && !toEnd ? 'low-data' : 'healthy'
        safe = eligible && ticks === 2 && (playableSec >= 12 || toEnd)
        notify()
    }
    const note = (kind, outcome, count = 0, mode = 'automatic') => {
        const next = { outcome, reason, count, mode }
        const old = measurements[kind]
        measurements[kind] = next
        if (!old || old.outcome !== outcome || old.reason !== reason || old.mode !== mode) {
            deps.DiagnosticLog.record('startup-measurement', { kind, outcome, reason, count, phase: mode,
                playableSec, progressTicks: ticks }, true)
        }
    }
    return {
        reset, update, note,
        allowed: () => safe && !deps.inSeekGrace(),
        watch: fn => { listeners.add(fn); return () => listeners.delete(fn) },
        availability: (health, cache) => { healthAvailable = !!health; cacheAvailable = !!cache },
        summary: () => ({ safe, reason, playableSec, progressTicks: ticks, healthAvailable, cacheAvailable,
            latency: measurements.latency && { ...measurements.latency }, throughput: measurements.throughput && { ...measurements.throughput } }),
    }
}
