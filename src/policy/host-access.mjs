// One policy for destinations, independent of route provenance or fixed mode.
export function createHostAccess(deps) {
    const counts = { blocked: 0, replaced: 0, discoveredForbidden: 0 }
    let last = null
    const restriction = host => {
        const reasons = []
        if (!host || typeof host !== 'string') return { allowed: false, reasons: ['invalid'] }
        if (deps.matchesExclude(host)) reasons.push('excluded')
        if (deps.initialDead.includes(host) && deps.overrides[host] !== true) reasons.push('preset-dead')
        if (deps.black?.has(host)) reasons.push('black')
        if (deps.dead?.has(host)) reasons.push('dead')
        if (deps.soft?.(host)) reasons.push('soft')
        if (deps.nativeBlocked?.(host)) reasons.push('native-soft')
        return { allowed: reasons.length === 0, reasons }
    }
    const allowed = host => restriction(host).allowed
    const note = (host, target) => {
        const outcome = target ? 'replaced' : 'blocked'
        counts[outcome] = Math.min(10000, counts[outcome] + 1)
        last = { outcome, reasons: restriction(host).reasons,
            host: deps.catalog.has(host) ? host : 'non-catalog',
            target: target ? (deps.catalog.has(target) ? target : 'non-catalog') : null }
    }
    const discover = host => { if (!allowed(host)) counts.discoveredForbidden = Math.min(10000, counts.discoveredForbidden + 1) }
    return { restriction, allowed, note, discover, summary: () => ({ ...counts, last: last && { ...last, reasons: [...last.reasons] } }) }
}
