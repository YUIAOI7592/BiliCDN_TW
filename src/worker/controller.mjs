import { WORKER_SOURCE } from 'bilicdn:worker';
// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createWorker(deps) {
const buildWorkerPolicy = () => {
    const target = deps.getWorkerCdnTarget()
    if (!deps.isValidCustomCdnHost(target)) return null
    const catalogSubset = values => [...new Set(values.filter(deps.isValidCustomCdnHost))]
    return {
        version: 1,
        type: 'policy',
        target,
        force: catalogSubset(deps.getWorkerForceList()),
        preferred: catalogSubset(deps.PREFERRED_CDN_LIST),
        excluded: catalogSubset(deps.TRUSTED_CDN_CATALOG.filter(deps.matchesExclude)),
        disabled: !!deps.disabled,
    }
}

const syncWorkerCdnTarget = () => {
    const message = buildWorkerPolicy()
    if (!message) return
    deps.biliCdnWorkers.forEach(worker => {
        const record = deps.workerControlPorts.get(worker)
        try {
            if (!record || !record.port) throw new Error('missing private Worker control port')
            record.port.postMessage(message)
        } catch {
            try { record && record.port && record.port.close() } catch {}
            deps.biliCdnWorkers.delete(worker)
        }
    })
}

const syncWorkerDisabledState = () => {
    syncWorkerCdnTarget()
}

const setupClassicWorkerIntercept = () => {
    // 安全開關。關閉時整段攔截機制不生效，biliCdnWorkers
    // 維持空 Set——syncWorkerCdnTarget()/syncWorkerDisabledState() 的 forEach 在空 Set
    // 上單純不做事，不會因為開關關閉而丟例外。程式碼刻意保留不刪，等 workerStats()
    // 數據確認這段真的沒用後，才在未來版本整段移除（見 CHANGELOG）。
    if (!deps.EnableWorkerIntercept) return
    try {
        const OriginalWorker = unsafeWindow.Worker
        if (!OriginalWorker || OriginalWorker.__biliCdnPatched) return

        const preferred = [...new Set(deps.PREFERRED_CDN_LIST.filter(deps.isValidCustomCdnHost))]
        const targetHost = deps.getWorkerCdnTarget()
        if (!deps.isValidCustomCdnHost(targetHost)) return
        const forceList = deps.getWorkerForceList()

        const sharedWorkerPatch = (originalUrl, capability) => {
            const configuration = {
                originalUrl, capability, catalog: [...deps.TRUSTED_CDN_CATALOG],
                suffixes: [...deps.PCDN_SOURCE_SUFFIXES], hosts: [...deps.PCDN_SOURCE_HOSTS],
                target: targetHost, force: forceList, preferred,
                excluded: deps.TRUSTED_CDN_CATALOG.filter(deps.matchesExclude),
            };
            return '(function(){ const __BiliCDNWorkerConfiguration = ' + JSON.stringify(configuration)
                + ';\n' + WORKER_SOURCE + '\n})();';
        };

        const classicWorkerPatch = (originalUrl, capability) => `
(() => {
${sharedWorkerPatch(originalUrl, capability)}
const BiliCdnOriginalImportScripts = self.importScripts.bind(self);
self.importScripts = (...urls) => BiliCdnOriginalImportScripts(...urls.map((url) => {
    try { return new URL(url, BILICDN_ORIGINAL).href; } catch { return url; }
}));
const BILICDN_ORIGINAL = ${JSON.stringify(originalUrl)};
BiliCdnOriginalImportScripts(BILICDN_ORIGINAL);
})();
`

        const moduleWorkerPatch = (originalUrl, capability) => `
(() => {
${sharedWorkerPatch(originalUrl, capability)}
})();
import(${JSON.stringify(originalUrl)}).catch((e) => { try { console.error('[BiliCDN] worker module import 失敗', e); } catch (e2) {} });
`

        const OriginalWorkerPostMessage = OriginalWorker.prototype.postMessage
        const OriginalWorkerTerminate = OriginalWorker.prototype.terminate
        const NativeMessageChannel = typeof MessageChannel === 'function' ? MessageChannel : null
        const NativeBlob = typeof Blob === 'function' ? Blob : null
        const NativeCreateObjectURL = URL && typeof URL.createObjectURL === 'function'
            ? URL.createObjectURL.bind(URL)
            : null
        const NativeRevokeObjectURL = URL && typeof URL.revokeObjectURL === 'function'
            ? URL.revokeObjectURL.bind(URL)
            : null
        const NativeGetRandomValues = typeof crypto !== 'undefined' && crypto
            && typeof crypto.getRandomValues === 'function'
            ? crypto.getRandomValues.bind(crypto)
            : null

        const createWorkerCapability = () => {
            if (!NativeGetRandomValues) return null
            try {
                const bytes = new Uint8Array(16)
                NativeGetRandomValues(bytes)
                return [...bytes].map(value => value.toString(16).padStart(2, '0')).join('')
            } catch { return null }
        }

        const isBoundedWorkerStat = value => Number.isInteger(value) && value >= 0 && value <= 10000
        const hasExactWorkerKeys = (value, keys) => {
            if (!value || typeof value !== 'object' || Array.isArray(value)) return false
            const actual = Object.keys(value).sort()
            const expected = [...keys].sort()
            return actual.length === expected.length && actual.every((key, index) => key === expected[index])
        }
        const handlePrivateWorkerReport = data => {
            if (deps.disabled) return false
            if (hasExactWorkerKeys(data, ['version', 'type', 'host', 'bytes'])
                && data.version === 1 && data.type === 'bytes'
                && deps.isValidCustomCdnHost(data.host)
                && Number.isInteger(data.bytes) && data.bytes > 0 && data.bytes <= 256 * 1024 * 1024) {
                if (deps.Watchdog && deps.Watchdog.noteExternalBytes) deps.Watchdog.noteExternalBytes(data.host, data.bytes)
                // The existing Worker protocol carries no representation identity or kind.
                deps.mediaObservations.unknown = { host: data.host, classification: 'catalog', source: 'worker', kind: 'unknown',
                    height: 0, observedAt: Date.now(), bytes: data.bytes, generation: deps.runtimeGeneration, epoch: deps.playinfoEpoch }
                deps.bumpWorkerStats({ bytes: data.bytes })
                return true
            }
            if (hasExactWorkerKeys(data, ['version', 'type', 'netCalls', 'mediaSeen', 'rewrites'])
                && data.version === 1 && data.type === 'stats'
                && isBoundedWorkerStat(data.netCalls)
                && isBoundedWorkerStat(data.mediaSeen)
                && isBoundedWorkerStat(data.rewrites)) {
                deps.bumpWorkerStats({
                    netCalls: data.netCalls,
                    mediaSeen: data.mediaSeen,
                    rewrites: data.rewrites,
                })
                return true
            }
            return false
        }

        const cleanupWorker = worker => {
            const record = deps.workerControlPorts.get(worker)
            deps.biliCdnWorkers.delete(worker)
            deps.workerControlPorts.delete(worker)
            if (!record) return
            try { if (record.revokeTimer) clearTimeout(record.revokeTimer) } catch {}
            try { if (record.port) record.port.close() } catch {}
            try { if (record.blobUrl && NativeRevokeObjectURL) NativeRevokeObjectURL(record.blobUrl) } catch {}
        }

        const registerWorker = (worker, capability, blobUrl) => {
            if (!NativeMessageChannel || typeof OriginalWorkerPostMessage !== 'function') return false
            let channel = null
            try {
                channel = new NativeMessageChannel()
                const record = { port: channel.port1, blobUrl, revokeTimer: null }
                deps.workerControlPorts.set(worker, record)
                deps.biliCdnWorkers.add(worker)
                channel.port1.onmessage = event => { handlePrivateWorkerReport(event && event.data) }
                try { channel.port1.start() } catch {}
                OriginalWorkerPostMessage.call(worker, { __biliCdnBootstrap: capability }, [channel.port2])
                const policy = buildWorkerPolicy()
                if (!policy) throw new Error('invalid initial Worker policy')
                channel.port1.postMessage(policy)
                record.revokeTimer = setTimeout(() => {
                    record.revokeTimer = null
                    try { if (NativeRevokeObjectURL) NativeRevokeObjectURL(blobUrl) } catch {}
                    record.blobUrl = ''
                }, 5 * 60 * 1000)
                return true
            } catch {
                try { if (channel && channel.port1) channel.port1.close() } catch {}
                try { if (channel && channel.port2) channel.port2.close() } catch {}
                cleanupWorker(worker)
                return false
            }
        }

        unsafeWindow.Worker = class Worker extends OriginalWorker {
            constructor(scriptURL, options) {
                if (deps.disabled) return super(scriptURL, options)
                let originalUrl, source, blobUrl, capability
                try {
                    originalUrl = new URL(String(scriptURL), location.href).href
                    if (originalUrl.startsWith('blob:') || originalUrl.startsWith('data:')) {
                        return super(scriptURL, options)
                    }
                    const isModule = !!(options && options.type === 'module')
                    if (isModule && new URL(originalUrl).origin !== location.origin) {
                        return super(scriptURL, options)
                    }
                    capability = createWorkerCapability()
                    // 安全亂數、Blob 或私有 MessagePort 任一不可用時，不做功能較弱的降級攔截。
                    if (!capability || !NativeBlob || !NativeCreateObjectURL || !NativeMessageChannel) {
                        return super(scriptURL, options)
                    }
                    deps.log('[Worker] patched: ' + originalUrl)
                    source = isModule
                        ? moduleWorkerPatch(originalUrl, capability)
                        : classicWorkerPatch(originalUrl, capability)
                    const blob = new NativeBlob([source], { type: 'application/javascript' })
                    blobUrl = NativeCreateObjectURL(blob)
                } catch {
                    return super(scriptURL, options)
                }
                const worker = super(blobUrl, options)
                if (!registerWorker(worker, capability, blobUrl)) {
                    try {
                        if (typeof OriginalWorkerTerminate === 'function') OriginalWorkerTerminate.call(worker)
                    } catch {}
                    try { if (NativeRevokeObjectURL) NativeRevokeObjectURL(blobUrl) } catch {}
                    return new OriginalWorker(scriptURL, options)
                }
                deps.bumpWorkerStats({ created: 1, sample: originalUrl })
                return worker
            }

            terminate() {
                cleanupWorker(this)
                if (typeof OriginalWorkerTerminate === 'function') {
                    return OriginalWorkerTerminate.call(this)
                }
            }
        }
        unsafeWindow.Worker.__biliCdnPatched = true
    } catch (e) {}
}

setupClassicWorkerIntercept()
return { /* TEST_EXPORTS:worker */
get syncWorkerCdnTarget() { return syncWorkerCdnTarget; },
get syncWorkerDisabledState() { return syncWorkerDisabledState; }
};
}
