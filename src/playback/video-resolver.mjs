// Shared main-video selection for playback observers. The resolver keeps a
// connected zero-size video as a fallback, but lets a newly visible player win.
export function createVideoResolver({ queryVideos }) {
    let cachedVideo = null

    const areaOf = video => {
        if (!video) return 0
        return Math.max(0, Number(video.clientWidth) || 0) * Math.max(0, Number(video.clientHeight) || 0)
    }

    const connected = video => !!video && video.isConnected !== false

    const get = () => {
        const cachedConnected = connected(cachedVideo)
        if (cachedConnected && areaOf(cachedVideo) > 0) return cachedVideo

        let first = null, best = null, bestArea = 0
        let videos = []
        try { videos = queryVideos ? queryVideos() : [] } catch { videos = [] }
        for (const video of videos || []) {
            if (!connected(video)) continue
            if (!first) first = video
            const area = areaOf(video)
            if (area > bestArea) { bestArea = area; best = video }
        }

        if (best) cachedVideo = best
        else if (!cachedConnected) cachedVideo = first
        return cachedVideo
    }

    const reset = () => { cachedVideo = null }

    return { get, reset }
}
