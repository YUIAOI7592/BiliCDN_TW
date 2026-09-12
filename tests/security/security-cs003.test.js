'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const { loadUserscript } = require('../harness/userscript-vm')

const root = path.resolve(__dirname, '../..')
const upstream = path.join(root, 'baseline', 'BiliCDN_TW_1.3.4.original.user.js')
const target = require('../harness/current-script')

test('CS-003 reproduction: upstream generated Worker accepts public target messages', () => {
    const h = loadUserscript(upstream, { gmSeed: { disabled: false }, enableWorkerIntercept: true })
    const source = h.evaluate('setupClassicWorkerIntercept.toString()')
    assert.match(source, /__biliCdnSetTarget/)
    assert.match(source, /self\.addEventListener\('message'/)
    assert.match(source, /BILICDN_TARGET_HOST = data\.__biliCdnSetTarget/)
})

test('CS-003 removed: production bundle contains no Worker interception runtime', () => {
    const source = fs.readFileSync(target, 'utf8')
    for (const pattern of [
        /EnableWorkerIntercept/,
        /bilicdn:worker/,
        /__biliCdnBootstrap/,
        /__biliCdnPatched/,
        /MessageChannel/,
        /buildWorkerPolicy/,
    ]) assert.doesNotMatch(source, pattern)
})

test('CS-003 removed: site Worker identity and every constructor input remain untouched', () => {
    class SiteWorker {
        static calls = []
        constructor(url, options) {
            this.url = url
            this.options = options
            SiteWorker.calls.push([url, options])
        }
    }
    const h = loadUserscript(target, {
        instrument: false,
        gmSeed: { disabled: false },
        pageGlobals: { Worker: SiteWorker },
    })
    assert.equal(h.pageWindow.Worker, SiteWorker)

    const inputs = [
        ['https://www.bilibili.com/plain-worker.js'],
        ['blob:https://www.bilibili.com/site-blob'],
        ['data:text/javascript,self.postMessage(1)'],
        ['https://www.bilibili.com/module-worker.js', { type: 'module', name: 'site-module' }],
    ]
    for (const args of inputs) new h.pageWindow.Worker(...args)
    assert.deepEqual(SiteWorker.calls, inputs.map(([url, options]) => [url, options]))
    assert.equal(h.blobStore.size, 0)
    assert.equal(h.getMessageChannelCount(), 0)
    assert.equal('worker' in h.pageWindow.BiliCDN, false)
})

test('CS-003 removed: page messages and console cannot recreate Worker controls', () => {
    class SiteWorker {}
    const h = loadUserscript(target, {
        gmSeed: { disabled: false },
        pageGlobals: { Worker: SiteWorker },
    })
    const before = {
        writes: h.gmWrites.length,
        fetches: h.fetchCalls.length,
        blobs: h.blobStore.size,
        channels: h.getMessageChannelCount(),
    }
    h.pageWindow.dispatchEvent({
        type: 'message',
        data: {
            __biliCdnSetTarget: 'attacker.example',
            __biliCdnDisabled: true,
            __biliCdnBootstrap: 'forged',
        },
    })
    h.context.console.error('[BiliCDN] worker failed attacker.example')
    assert.equal(h.pageWindow.Worker, SiteWorker)
    assert.deepEqual({
        writes: h.gmWrites.length,
        fetches: h.fetchCalls.length,
        blobs: h.blobStore.size,
        channels: h.getMessageChannelCount(),
    }, before)
})

test('v1.7.0 migration clears only obsolete Worker statistics', () => {
    const health = JSON.stringify({ 'upos-sz-mirrorali.bilivideo.com': { success: 2 } })
    const overrides = { 'upos-sz-mirrorali.bilivideo.com': true }
    const h = loadUserscript(target, {
        gmSeed: {
            disabled: false,
            blicdnVersion: '1.6.3',
            workerStats_v1: { created: 3, mediaSeen: 0 },
            CustomCDN: 'upos-sz-mirrorali.bilivideo.com',
            catalogOverrides_v1: overrides,
            cdnHealth_v1: health,
        },
    })
    assert.equal(h.gm.has('workerStats_v1'), false)
    assert.equal(h.gm.get('CustomCDN'), 'upos-sz-mirrorali.bilivideo.com')
    assert.deepEqual(h.gm.get('catalogOverrides_v1'), overrides)
    assert.equal(h.gm.get('cdnHealth_v1'), health)
    assert.equal(h.gmWrites.filter(entry => entry.op === 'delete' && entry.key === 'workerStats_v1').length, 1)
})
