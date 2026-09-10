// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createRate(deps) {
const ASSUMED_PLAYBACK_RATE = 2

const MAX_NETWORK_PLAYBACK_RATE = 4

const playbackRateState = {
    observedRate: ASSUMED_PLAYBACK_RATE,
    effectiveRate: ASSUMED_PLAYBACK_RATE,
    confirmed: false,
    source: 'assumed',
}

const resetPlaybackRateState = () => {
    playbackRateState.observedRate = ASSUMED_PLAYBACK_RATE
    playbackRateState.effectiveRate = ASSUMED_PLAYBACK_RATE
    playbackRateState.confirmed = false
    playbackRateState.source = 'assumed'
    return playbackRateState
}

const getEffectivePlaybackRate = value => {
    const numeric = value === undefined ? playbackRateState.effectiveRate : Number(value)
    if (!Number.isFinite(numeric) || numeric <= 0) return ASSUMED_PLAYBACK_RATE
    return Math.max(1, Math.min(MAX_NETWORK_PLAYBACK_RATE, numeric))
}

const syncPlaybackRateFromVideo = (video, source = 'watchdog') => {
    let numeric
    try { numeric = Number(video && video.playbackRate) } catch { return resetPlaybackRateState() }
    if (!Number.isFinite(numeric) || numeric <= 0) return resetPlaybackRateState()
    // 初始 1x 可能只是另一支腳本還沒套用預設；標準 ratechange 則是使用者/播放器的明確決定。
    if (!playbackRateState.confirmed && numeric === 1 && source !== 'ratechange') return playbackRateState
    playbackRateState.observedRate = numeric
    playbackRateState.effectiveRate = getEffectivePlaybackRate(numeric)
    playbackRateState.confirmed = true
    playbackRateState.source = String(source || 'watchdog').slice(0, 24)
    return playbackRateState
}

let seekGraceUntil = 0

const getSeekGraceMs = () => (deps.currentStreamBitsPerSec / 1e6 >= 12) ? 8000 : 5000

const bumpSeekGrace = () => {
    seekGraceUntil = Math.max(seekGraceUntil, Date.now() + getSeekGraceMs())
}

const inSeekGrace = () => Date.now() < seekGraceUntil
return { /* TEST_EXPORTS:rate */
get ASSUMED_PLAYBACK_RATE() { return ASSUMED_PLAYBACK_RATE; },
get playbackRateState() { return playbackRateState; },
get resetPlaybackRateState() { return resetPlaybackRateState; },
get getEffectivePlaybackRate() { return getEffectivePlaybackRate; },
get syncPlaybackRateFromVideo() { return syncPlaybackRateFromVideo; },
get seekGraceUntil() { return seekGraceUntil; }, set seekGraceUntil(value) { seekGraceUntil = value; },
get bumpSeekGrace() { return bumpSeekGrace; },
get inSeekGrace() { return inSeekGrace; }
};
}
