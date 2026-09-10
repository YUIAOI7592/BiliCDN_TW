'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const { loadUserscript, runGeneratedClassicWorker } = require('../harness/userscript-vm')

const root = path.resolve(__dirname, '../..')
const v140 = path.join(root, 'baseline', 'BiliCDN_TW_1.3.4.original.user.js')
const fixedVersion = '1.5.2'
const v141 = require('../harness/current-script')

test('CS-003 reproduction: v1.4.0 generated Worker accepts public target messages', () => {
    const h = loadUserscript(v140, { gmSeed: { disabled: false }, enableWorkerIntercept: true })
    const source = h.evaluate("setupClassicWorkerIntercept.toString()")
    assert.match(source, /__biliCdnSetTarget/)
    assert.match(source, /self\.addEventListener\('message'/)
    assert.match(source, /BILICDN_TARGET_HOST = data\.__biliCdnSetTarget/)
})

test('CS-003 fixed: default false never patches Worker or creates a blob', { skip: !fs.existsSync(v141) }, () => {
    const h = loadUserscript(v141, { gmSeed: { disabled: false } })
    assert.equal(h.pageWindow.Worker.name, 'FakeWorker')
    assert.equal(h.blobStore.size, 0)
    assert.equal(h.getMessageChannelCount(), 0)
})

test('CS-003 fixed: missing secure randomness leaves each Worker unmodified', { skip: !fs.existsSync(v141) }, () => {
    const h = loadUserscript(v141, {
        gmSeed: { disabled: false },
        enableWorkerIntercept: true,
        cryptoImpl: null,
    })
    const worker = new h.pageWindow.Worker('https://www.bilibili.com/plain-worker.js')
    assert.equal(worker.scriptURL, 'https://www.bilibili.com/plain-worker.js')
    assert.equal(h.blobStore.size, 0)
    assert.equal(h.getMessageChannelCount(), 0)
})

test('CS-003 fixed: generated Worker has one-time bootstrap and private policy schema', { skip: !fs.existsSync(v141) }, () => {
    const h = loadUserscript(v141, { gmSeed: { disabled: false }, enableWorkerIntercept: true })
    const worker = new h.pageWindow.Worker('https://www.bilibili.com/schema-worker.js')
    const generated = h.blobStore.get(worker.scriptURL).parts.map(String).join('')
    const source = h.evaluate("setupClassicWorkerIntercept.toString()") + generated
    assert.doesNotMatch(source, /data\.__biliCdnSetTarget/)
    assert.match(source, /__biliCdnBootstrap/)
    assert.match(source, /event\.ports/)
    assert.match(source, /data\.type !== ['"]policy['"]/)
    assert.match(source, /getRandomValues/)
    assert.match(source, /256 \* 1024 \* 1024/)
    worker.terminate()
})

test('CS-003 fixed: ordinary messages cannot change policy; the private port can', { skip: !fs.existsSync(v141) }, async t => {
    const h = loadUserscript(v141, { gmSeed: { disabled: false }, enableWorkerIntercept: true })
    const worker = new h.pageWindow.Worker('https://www.bilibili.com/player-worker.js')
    assert.match(worker.scriptURL, /^blob:/)
    const blob = h.blobStore.get(worker.scriptURL)
    assert.ok(blob)
    const generated = blob.parts.map(String).join('')
    const originalMessages = []
    const wh = runGeneratedClassicWorker(generated, {
        onImport(self) {
            self.addEventListener('message', event => { originalMessages.push(event.data) })
        },
    })

    const bootstrap = worker.messages.find(message => message.data && message.data.__biliCdnBootstrap)
    assert.ok(bootstrap)
    assert.equal(bootstrap.transfer.length, 1)
    t.after(() => {
        try { worker.terminate() } catch {}
        try { bootstrap.transfer[0].close() } catch {}
    })

    wh.dispatchMessage({ __biliCdnSetTarget: 'httpdns.bilivideo.com', __biliCdnDisabled: true })
    assert.equal(originalMessages.length, 1)
    const bootstrapEvent = wh.dispatchMessage(bootstrap.data, bootstrap.transfer)
    assert.equal(bootstrapEvent.__stopImmediate, true)
    assert.equal(originalMessages.length, 1)
    await new Promise(resolve => setImmediate(resolve))

    const unstable = 'https://cn-hk-eq-bcache-01.bilivideo.com/upgcxcode/video.m4s?token=kept'
    await wh.self.fetch(unstable)
    const initialHost = new URL(wh.fetchCalls.at(-1).url).hostname
    assert.equal(h.evaluate(`TRUSTED_CDN_CATALOG_SET.has(${JSON.stringify(initialHost)})`), true)

    const workerXhr = new wh.self.XMLHttpRequest()
    workerXhr.open('GET', `https://${initialHost}/upgcxcode/fake.m4s`)
    await new Promise(resolve => setImmediate(resolve))
    const bytesBeforeForgedEvent = h.evaluate('workerStats.bytes')
    workerXhr.dispatchEvent(new wh.context.ProgressEvent('progress', { loaded: 4096 }))
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(h.evaluate('workerStats.bytes'), bytesBeforeForgedEvent)
    workerXhr.progress(4096)
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(h.evaluate('workerStats.bytes'), bytesBeforeForgedEvent + 4096)

    wh.dispatchMessage({ __biliCdnSetTarget: 'httpdns.bilivideo.com', __biliCdnDisabled: true })
    await wh.self.fetch(unstable)
    assert.equal(new URL(wh.fetchCalls.at(-1).url).hostname, initialHost)

    const catalog = h.evaluate('[...TRUSTED_CDN_CATALOG]')
    const nextTarget = catalog.find(host => host !== initialHost)
    const record = h.evaluate('workerControlPorts.get(unsafeWindow.__cs003Worker)')
    assert.equal(record, undefined)
    h.pageWindow.__cs003Worker = worker
    const port = h.evaluate('workerControlPorts.get(unsafeWindow.__cs003Worker).port')
    const legal = {
        version: 1,
        type: 'policy',
        target: nextTarget,
        preferred: catalog,
        force: [],
        excluded: [],
        disabled: false,
    }
    port.postMessage(legal)
    await new Promise(resolve => setImmediate(resolve))
    await wh.self.fetch(unstable)
    assert.equal(new URL(wh.fetchCalls.at(-1).url).hostname, nextTarget)

    port.postMessage({ ...legal, target: 'httpdns.bilivideo.com', disabled: true })
    await new Promise(resolve => setImmediate(resolve))
    await wh.self.fetch(unstable)
    assert.equal(new URL(wh.fetchCalls.at(-1).url).hostname, nextTarget)

    port.postMessage({ ...legal, preferred: [...catalog, ...catalog, 'attacker.example'], disabled: true })
    await new Promise(resolve => setImmediate(resolve))
    await wh.self.fetch(unstable)
    assert.equal(new URL(wh.fetchCalls.at(-1).url).hostname, nextTarget)

    await wh.self.fetch('https://cn-hk-eq-bcache-01.bilivideo.com/v1/resource/file.m4s?token=pcdn')
    assert.equal(new URL(wh.fetchCalls.at(-1).url).hostname, 'cn-hk-eq-bcache-01.bilivideo.com')

})

test('CS-003 fixed: private Worker reports reject unbounded or malformed values', { skip: !fs.existsSync(v141) }, async t => {
    const h = loadUserscript(v141, { gmSeed: { disabled: false }, enableWorkerIntercept: true })
    const worker = new h.pageWindow.Worker('https://www.bilibili.com/report-worker.js')
    const bootstrap = worker.messages.find(message => message.data && message.data.__biliCdnBootstrap)
    const workerPort = bootstrap.transfer[0]
    t.after(() => {
        try { worker.terminate() } catch {}
        try { workerPort.close() } catch {}
    })
    const catalogHost = h.evaluate('TRUSTED_CDN_CATALOG[0]')

    workerPort.postMessage({ version: 1, type: 'bytes', host: 'attacker.example', bytes: 1024 })
    workerPort.postMessage({ version: 1, type: 'bytes', host: catalogHost, bytes: -1 })
    workerPort.postMessage({ version: 1, type: 'bytes', host: catalogHost, bytes: Infinity })
    workerPort.postMessage({ version: 1, type: 'bytes', host: catalogHost, bytes: 256 * 1024 * 1024 + 1 })
    workerPort.postMessage({ version: 1, type: 'stats', netCalls: -1, mediaSeen: 0, rewrites: 0 })
    workerPort.postMessage({ version: 1, type: 'stats', netCalls: 0, mediaSeen: Infinity, rewrites: 0 })
    workerPort.postMessage({ version: 1, type: 'stats', netCalls: 10001, mediaSeen: 0, rewrites: 0 })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(h.evaluate('workerStats.bytes'), 0)
    assert.equal(h.evaluate('workerStats.netCalls'), 0)
    assert.equal(h.evaluate('workerStats.mediaSeen'), 0)
    assert.equal(h.evaluate('workerStats.rewrites'), 0)

    workerPort.postMessage({ version: 1, type: 'bytes', host: catalogHost, bytes: 4096 })
    workerPort.postMessage({ version: 1, type: 'stats', netCalls: 2, mediaSeen: 1, rewrites: 1 })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(h.evaluate('workerStats.bytes'), 4096)
    assert.equal(h.evaluate('workerStats.netCalls'), 2)
    assert.equal(h.evaluate('workerStats.mediaSeen'), 1)
    assert.equal(h.evaluate('workerStats.rewrites'), 1)
})

test('CS-003 fixed: Worker Fetch cancellation reaches the original single reader', { skip: !fs.existsSync(v141) }, async t => {
    let cancelledWith = null
    const h = loadUserscript(v141, { gmSeed: { disabled: false }, enableWorkerIntercept: true })
    const worker = new h.pageWindow.Worker('https://www.bilibili.com/cancel-worker.js')
    const bootstrap = worker.messages.find(message => message.data && message.data.__biliCdnBootstrap)
    t.after(() => {
        try { worker.terminate() } catch {}
        try { bootstrap.transfer[0].close() } catch {}
    })
    const blob = h.blobStore.get(worker.scriptURL)
    const wh = runGeneratedClassicWorker(blob.parts.map(String).join(''), {
        fetchImpl: async () => new Response(new ReadableStream({
            pull() {},
            cancel(reason) { cancelledWith = reason },
        }), { status: 206 }),
    })
    wh.dispatchMessage(bootstrap.data, bootstrap.transfer)
    await new Promise(resolve => setImmediate(resolve))
    const response = await wh.self.fetch('https://cn-hk-eq-bcache-01.bilivideo.com/upgcxcode/cancel.m4s')
    await response.body.cancel('seek-cancel')
    assert.equal(cancelledWith, 'seek-cancel')
})
