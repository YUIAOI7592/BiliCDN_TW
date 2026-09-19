// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createRuntime(deps) {
let disabled = !!GM_getValue('disabled')

let runtimeGeneration = 0

let runtimeAbortController = null

const runtimeTimeouts = new Set()

const clearRuntimeTimeout = (timer) => {
    if (timer == null) return
    clearTimeout(timer)
    runtimeTimeouts.delete(timer)
}

const scheduleRuntimeTimeout = (callback, delay) => {
    const generation = runtimeGeneration
    const timer = setTimeout(() => {
        runtimeTimeouts.delete(timer)
        if (disabled || generation !== runtimeGeneration) return
        callback()
    }, delay)
    runtimeTimeouts.add(timer)
    return timer
}

const stopRuntimeGeneration = () => {
    deps.resetStartup?.()
    deps.resetVideoCoreRecovery?.()
    runtimeGeneration++
    deps.DiagnosticLog.boundary(runtimeGeneration, deps.playinfoEpoch, disabled ? 'disabled' : 'active')
    deps.resetMediaDelivery()
    deps.invalidateCodecQueries()
    deps.resetPlaybackQuality()
    if (runtimeAbortController) {
        try { runtimeAbortController.abort() } catch {}
        runtimeAbortController = null
    }
    runtimeTimeouts.forEach(timer => clearTimeout(timer))
    runtimeTimeouts.clear()
}

const beginRuntimeGeneration = () => {
    stopRuntimeGeneration()
    if (disabled) return null
    try { runtimeAbortController = new AbortController() } catch { runtimeAbortController = null }
    return runtimeAbortController
        ? { generation: runtimeGeneration, signal: runtimeAbortController.signal }
        : { generation: runtimeGeneration, signal: null }
}

const captureRuntimeGeneration = () => ({
    generation: runtimeGeneration,
    signal: runtimeAbortController ? runtimeAbortController.signal : null,
})

const isRuntimeGenerationActive = token => !!token && !disabled
    && token.generation === runtimeGeneration
    && (!token.signal || !token.signal.aborted)

const reportMeasurementFailure = () => {
    const token = captureRuntimeGeneration(), epoch = deps.playinfoEpoch
    return () => { if (isRuntimeGenerationActive(token) && epoch === deps.playinfoEpoch) deps.DiagnosticLog.fault('measurement') }
}

let uiInjectStatus = 'pending'
return { /* TEST_EXPORTS:runtime */
get disabled() { return disabled; }, set disabled(value) { disabled = value; },
get runtimeGeneration() { return runtimeGeneration; }, set runtimeGeneration(value) { runtimeGeneration = value; },
get clearRuntimeTimeout() { return clearRuntimeTimeout; },
get scheduleRuntimeTimeout() { return scheduleRuntimeTimeout; },
get stopRuntimeGeneration() { return stopRuntimeGeneration; },
get beginRuntimeGeneration() { return beginRuntimeGeneration; },
get captureRuntimeGeneration() { return captureRuntimeGeneration; },
get isRuntimeGenerationActive() { return isRuntimeGenerationActive; },
get reportMeasurementFailure() { return reportMeasurementFailure; },
get uiInjectStatus() { return uiInjectStatus; }, set uiInjectStatus(value) { uiInjectStatus = value; }
};
}
