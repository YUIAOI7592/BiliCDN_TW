// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createHints(deps) {
const runtimeHintIds = new Set()

const preconnectCdn = (cdn, force) => {
    try {
        if (!deps.isValidCustomCdnHost(cdn)) return
        if (deps.isHostAllowed && !deps.isHostAllowed(cdn)) return
        // presumed（已知在台灣不解析、本機從無成功紀錄）也要擋：preconnect 走的一樣是
        // DNS 解析，對 NXDOMAIN 的 host 熱身換不到任何東西。這裡的呼叫端目前都先經過
        // getHealthyCdnList()（會濾掉 presumed），但那是呼叫端的性質、不是這個函式的保證——
        // 死節點機制的設計目標寫的是「跳過所有 probe/preconnect」，就該在這裡也守住。
        if ((deps.knownDeadHosts.has(cdn) || deps.blacklistSet.has(cdn) || deps.isCdnSoftBlocked(cdn)
            || deps.matchesExclude(cdn) || deps.isPresumedDnsFailHost(cdn))) return
        const id = 'bilicdn-preconn-' + cdn
        const existing = document.getElementById(id)
        if (existing) {
            if (!force) return
            existing.remove()
        }
        const link = document.createElement('link')
        link.id   = id
        link.rel  = 'preconnect'
        link.href = 'https://' + cdn
        link.crossOrigin = 'anonymous'
        ;(document.head || document.documentElement).appendChild(link)
        runtimeHintIds.add(id)

        const dnsId = 'bilicdn-dns-' + cdn
        if (!document.getElementById(dnsId)) {
            const dns = document.createElement('link')
            dns.id   = dnsId
            dns.rel  = 'dns-prefetch'
            dns.href = 'https://' + cdn
            ;(document.head || document.documentElement).appendChild(dns)
            runtimeHintIds.add(dnsId)
        }
    } catch {}
}

const preconnectBatch = (hosts, force) => {
    ;[...new Set(hosts || [])].forEach(h => h && preconnectCdn(h, force))
}

const clearRuntimeConnectionHints = () => {
    runtimeHintIds.forEach(id => {
        try {
            const node = document.getElementById(id)
            if (node) node.remove()
        } catch {}
    })
    runtimeHintIds.clear()
}
return { /* TEST_EXPORTS:hints */
get preconnectCdn() { return preconnectCdn; },
get preconnectBatch() { return preconnectBatch; },
get clearRuntimeConnectionHints() { return clearRuntimeConnectionHints; }
};
}
