import { WORKER_SOURCE } from 'bilicdn:worker';
// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createWorker(deps) {
let installedWorkerConstructor = null
let workerReplacementNoted = false

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
            if (!record || typeof record.sendPolicy !== 'function') throw new Error('missing private Worker control port')
            record.sendPolicy(message)
        } catch {
            deps.noteWorkerDiagnostic('port-failure')
            try { if (record && record.revokeTimer) clearTimeout(record.revokeTimer) } catch {}
            try { if (record && record.handshakeTimer) clearTimeout(record.handshakeTimer) } catch {}
            try { if (record && typeof record.closePort === 'function') record.closePort() } catch {}
            try { if (record && record.blobUrl && record.revokeBlob) record.revokeBlob(record.blobUrl) } catch {}
            deps.workerControlPorts.delete(worker)
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
    if (!deps.EnableWorkerIntercept) {
        deps.setWorkerInstallState('disabled')
        return
    }
    deps.setWorkerInstallState('installing')
    deps.noteWorkerDiagnostic('install-attempt')
    try {
        // Worker 是跨越 userscript/page 信任邊界的 capability。只能從隔離的
        // userscript realm 捕捉原生 constructor；unsafeWindow.Worker 可由頁面預先替換，
        // 不能用作基底、fallback 或 private-port bootstrap 的 method source。
        const OriginalWorker = typeof Worker === 'function' ? Worker : null
        if (!OriginalWorker) {
            deps.noteWorkerDiagnostic('no-worker')
            deps.setWorkerInstallState('unavailable')
            return
        }

        const preferred = [...new Set(deps.PREFERRED_CDN_LIST.filter(deps.isValidCustomCdnHost))]
        const targetHost = deps.getWorkerCdnTarget()
        if (!deps.isValidCustomCdnHost(targetHost)) {
            deps.setWorkerInstallState('invalid-target')
            return
        }
        const forceList = deps.getWorkerForceList()

        const sharedWorkerPatch = (originalUrl, capability, moduleWorker) => {
            const configuration = {
                originalUrl, capability, catalog: [...deps.TRUSTED_CDN_CATALOG],
                suffixes: [...deps.PCDN_SOURCE_SUFFIXES], hosts: [...deps.PCDN_SOURCE_HOSTS],
                target: targetHost, force: forceList, preferred,
                excluded: deps.TRUSTED_CDN_CATALOG.filter(deps.matchesExclude),
                disabled: !!deps.disabled,
                moduleWorker: !!moduleWorker,
            };
            return '(function(){ const __BiliCDNWorkerConfiguration = ' + JSON.stringify(configuration)
                + ';\n' + WORKER_SOURCE + '\n})();';
        };

        // 原始 Worker 由 embedded entry 在 authenticated bootstrap 完成後才啟動。
        // 呼叫端在 constructor 返回前已送出 bootstrap，因此 classic Worker 的後續
        // application messages 仍依同一 sender 的 FIFO 排在 bootstrap 之後。
        const classicWorkerPatch = (originalUrl, capability) => sharedWorkerPatch(originalUrl, capability, false)
        const moduleWorkerPatch = (originalUrl, capability) => sharedWorkerPatch(originalUrl, capability, true)

        const OriginalWorkerPostMessage = OriginalWorker.prototype.postMessage
        const OriginalWorkerTerminate = OriginalWorker.prototype.terminate
        const NativeReflectApply = Reflect.apply
        const NativeMessageEventDataGetter = typeof MessageEvent === 'function'
            && MessageEvent.prototype
            ? Object.getOwnPropertyDescriptor(MessageEvent.prototype, 'data')?.get
            : null
        const readNativeMessageData = event => {
            if (!event) return undefined
            if (typeof NativeMessageEventDataGetter === 'function') {
                try {
                    const value = NativeReflectApply(NativeMessageEventDataGetter, event, [])
                    if (value !== undefined) return value
                } catch {}
            }
            return event.data
        }
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
        const handlePrivateWorkerReport = (data, worker) => {
            if (deps.disabled) return false
            const record = deps.workerControlPorts.get(worker)
            if (hasExactWorkerKeys(data, ['version', 'type'])
                && data.version === 1 && data.type === 'ready') {
                if (!record || record.ready) return false
                try { if (record.handshakeTimer) clearTimeout(record.handshakeTimer) } catch {}
                record.handshakeTimer = null
                record.ready = true
                deps.noteWorkerDiagnostic('bootstrap-ready')
                return true
            }
            // bytes/stats 只有在同一私有 port 完成一次 ready 握手後才具有效力。
            // 這也避免 transferred port 尚未交給真正 wrapper 前被測試替身或失敗路徑冒用。
            if (!record || !record.ready) return false
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
            try { if (record.handshakeTimer) clearTimeout(record.handshakeTimer) } catch {}
            try { if (typeof record.closePort === 'function') record.closePort() } catch {}
            try { if (record.blobUrl && NativeRevokeObjectURL) NativeRevokeObjectURL(record.blobUrl) } catch {}
        }

        const registerWorker = (worker, capability, blobUrl) => {
            if (!NativeMessageChannel || typeof OriginalWorkerPostMessage !== 'function') return false
            let channel = null
            try {
                channel = new NativeMessageChannel()
                const sendPolicy = typeof channel.port1.postMessage === 'function'
                    ? channel.port1.postMessage.bind(channel.port1)
                    : null
                const closePort = typeof channel.port1.close === 'function'
                    ? channel.port1.close.bind(channel.port1)
                    : null
                const startPort = typeof channel.port1.start === 'function'
                    ? channel.port1.start.bind(channel.port1)
                    : null
                if (!sendPolicy || !closePort) throw new Error('invalid private Worker control port')
                const record = { port: channel.port1, sendPolicy, closePort,
                    revokeBlob: NativeRevokeObjectURL, blobUrl, revokeTimer: null,
                    handshakeTimer: null, ready: false }
                deps.workerControlPorts.set(worker, record)
                deps.biliCdnWorkers.add(worker)
                channel.port1.onmessage = event => { handlePrivateWorkerReport(readNativeMessageData(event), worker) }
                try { if (startPort) startPort() } catch {}
                NativeReflectApply(OriginalWorkerPostMessage, worker,
                    [{ __biliCdnBootstrap: capability }, [channel.port2]])
                const policy = buildWorkerPolicy()
                if (!policy) throw new Error('invalid initial Worker policy')
                sendPolicy(policy)
                record.handshakeTimer = setTimeout(() => {
                    record.handshakeTimer = null
                    if (record.ready || deps.workerControlPorts.get(worker) !== record) return
                    deps.noteWorkerDiagnostic('bootstrap-timeout')
                    try { if (record.revokeTimer) clearTimeout(record.revokeTimer) } catch {}
                    record.revokeTimer = null
                    try { record.closePort() } catch {}
                    try { if (record.blobUrl && record.revokeBlob) record.revokeBlob(record.blobUrl) } catch {}
                    record.blobUrl = ''
                    deps.workerControlPorts.delete(worker)
                    deps.biliCdnWorkers.delete(worker)
                }, 2000)
                record.revokeTimer = setTimeout(() => {
                    record.revokeTimer = null
                    try { if (NativeRevokeObjectURL) NativeRevokeObjectURL(blobUrl) } catch {}
                    record.blobUrl = ''
                }, 5 * 60 * 1000)
                return true
            } catch {
                try { if (channel && channel.port1 && typeof channel.port1.close === 'function') channel.port1.close() } catch {}
                try { if (channel && channel.port2 && typeof channel.port2.close === 'function') channel.port2.close() } catch {}
                cleanupWorker(worker)
                return false
            }
        }

        installedWorkerConstructor = class Worker extends OriginalWorker {
            constructor(scriptURL, options) {
                deps.noteWorkerDiagnostic('constructor-call')
                if (deps.disabled) {
                    deps.noteWorkerDiagnostic('bypass-disabled')
                    return super(scriptURL, options)
                }
                let originalUrl, source, blobUrl, capability
                try {
                    originalUrl = new URL(String(scriptURL), location.href).href
                    if (originalUrl.startsWith('blob:')) {
                        deps.noteWorkerDiagnostic('bypass-blob')
                        return super(scriptURL, options)
                    }
                    if (originalUrl.startsWith('data:')) {
                        deps.noteWorkerDiagnostic('bypass-data')
                        return super(scriptURL, options)
                    }
                    const isModule = !!(options && options.type === 'module')
                    if (isModule && new URL(originalUrl).origin !== location.origin) {
                        deps.noteWorkerDiagnostic('bypass-cross-origin-module')
                        return super(scriptURL, options)
                    }
                    capability = createWorkerCapability()
                    // 安全亂數、Blob 或私有 MessagePort 任一不可用時，不做功能較弱的降級攔截。
                    if (!capability) {
                        deps.noteWorkerDiagnostic('bypass-no-random')
                        return super(scriptURL, options)
                    }
                    if (!NativeBlob || !NativeCreateObjectURL) {
                        deps.noteWorkerDiagnostic('bypass-no-blob-api')
                        return super(scriptURL, options)
                    }
                    if (!NativeMessageChannel) {
                        deps.noteWorkerDiagnostic('bypass-no-message-channel')
                        return super(scriptURL, options)
                    }
                    deps.log('[Worker] patched: ' + originalUrl)
                    source = isModule
                        ? moduleWorkerPatch(originalUrl, capability)
                        : classicWorkerPatch(originalUrl, capability)
                    const blob = new NativeBlob([source], { type: 'application/javascript' })
                    blobUrl = NativeCreateObjectURL(blob)
                } catch {
                    if (!originalUrl) deps.noteWorkerDiagnostic('resolve-failure')
                    else deps.noteWorkerDiagnostic('build-failure')
                    return super(scriptURL, options)
                }
                let worker
                try {
                    worker = super(blobUrl, options)
                } catch {
                    deps.noteWorkerDiagnostic('constructor-failure')
                    try { if (NativeRevokeObjectURL) NativeRevokeObjectURL(blobUrl) } catch {}
                    return new OriginalWorker(scriptURL, options)
                }
                if (!registerWorker(worker, capability, blobUrl)) {
                    deps.noteWorkerDiagnostic('register-failure')
                    try {
                        if (typeof OriginalWorkerTerminate === 'function') NativeReflectApply(OriginalWorkerTerminate, worker, [])
                    } catch {}
                    try { if (NativeRevokeObjectURL) NativeRevokeObjectURL(blobUrl) } catch {}
                    return new OriginalWorker(scriptURL, options)
                }
                deps.noteWorkerDiagnostic('wrapped', originalUrl)
                return worker
            }

            terminate() {
                cleanupWorker(this)
                if (typeof OriginalWorkerTerminate === 'function') {
                    return NativeReflectApply(OriginalWorkerTerminate, this, [])
                }
            }
        }
        unsafeWindow.Worker = installedWorkerConstructor
        unsafeWindow.Worker.__biliCdnPatched = true
        deps.setWorkerInstallState('installed')
    } catch (e) {
        deps.noteWorkerDiagnostic('install-failure')
        deps.setWorkerInstallState('failed')
    }
}

const checkWorkerInterceptState = () => {
    if (!deps.EnableWorkerIntercept || !installedWorkerConstructor || workerReplacementNoted) return
    try {
        if (unsafeWindow.Worker === installedWorkerConstructor) return
        workerReplacementNoted = true
        deps.noteWorkerDiagnostic('constructor-replaced')
        deps.setWorkerInstallState('replaced')
    } catch {
        workerReplacementNoted = true
        deps.noteWorkerDiagnostic('constructor-replaced')
        deps.setWorkerInstallState('replaced')
    }
}

setupClassicWorkerIntercept()
return { /* TEST_EXPORTS:worker */
get syncWorkerCdnTarget() { return syncWorkerCdnTarget; },
get syncWorkerDisabledState() { return syncWorkerDisabledState; },
get checkWorkerInterceptState() { return checkWorkerInterceptState; }
};
}
